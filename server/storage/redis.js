import { Conflict } from '../errors.js';

/** Upstash's REST API: Redis commands as JSON over HTTPS, one /pipeline POST per call. */
export function upstashTransport(url, token, { timeoutMs = 10_000 } = {}) {
  const endpoint = `${url.replace(/\/+$/, '')}/pipeline`;
  const send = async (commands) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`Redis answered ${response.status}`);
    const replies = await response.json();
    return replies.map((reply) => {
      if ('error' in reply) throw new Error(`Redis refused a command: ${reply.error}`);
      return reply.result ?? null;
    });
  };
  send.url = endpoint;
  return send;
}

const parseStamp = (text) => Date.parse(text);

/** The same records in Redis, for hosts whose disk does not persist (Vercel). Live accounts use these keys. */
export class RedisBackend {
  constructor(send) {
    this.send = send;
  }

  async one(...command) {
    return (await this.send([command]))[0];
  }

  async createUser(user, passwordHash, created) {
    if ((await this.one('SET', `rc:email:${user.email}`, user.id, 'NX')) === null) throw new Conflict();
    const record = { ...user, password_hash: passwordHash, created_at: created };
    await this.one('SET', `rc:user:${user.id}`, JSON.stringify(record));
  }

  async user(userId) {
    const raw = await this.one('GET', `rc:user:${userId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async findUser(email) {
    const userId = await this.one('GET', `rc:email:${email}`);
    return userId ? this.user(userId) : null;
  }

  async createSession(tokenHash, userId, now, expires) {
    const seconds = Math.round((parseStamp(expires) - parseStamp(now)) / 1000);
    await this.one('SET', `rc:session:${tokenHash}`, userId, 'EX', String(seconds));
  }

  // Redis drops the key when the session expires, so there is no date to check.
  async sessionUser(tokenHash) {
    const userId = await this.one('GET', `rc:session:${tokenHash}`);
    const user = userId ? await this.user(userId) : null;
    return user ? { id: user.id, email: user.email, name: user.name } : null;
  }

  async endSession(tokenHash) {
    await this.one('DEL', `rc:session:${tokenHash}`);
  }

  async listSurveys(userId) {
    const flat = (await this.one('HGETALL', `rc:surveys:${userId}`)) ?? [];
    const records = flat.filter((_, index) => index % 2 === 1).map((value) => JSON.parse(value));
    records.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
    return records.map((record) => record.survey);
  }

  async putSurvey(userId, surveyId, data, created, now) {
    const key = `rc:surveys:${userId}`;
    const existing = await this.one('HGET', key, surveyId);
    // An update keeps the survey's place in the list, as SQLite's upsert does.
    const record = {
      created_at: existing ? JSON.parse(existing).created_at : created,
      updated_at: now,
      survey: JSON.parse(data),
    };
    await this.one('HSET', key, surveyId, JSON.stringify(record));
  }

  async deleteSurvey(userId, surveyId) {
    await this.one('HDEL', `rc:surveys:${userId}`, surveyId);
  }
}
