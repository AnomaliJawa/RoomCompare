import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Conflict } from '../errors.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS surveys (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, id)
);
`;

/** Accounts, sessions and surveys in one SQLite file: local and self-hosted. Existing databases use this schema. */
export class SQLiteBackend {
  constructor(path) {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    // WAL lets a read and a write overlap instead of queueing.
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
  }

  transaction(work) {
    this.db.exec('BEGIN');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  async createUser(user, passwordHash, created) {
    try {
      this.db
        .prepare('INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(user.id, user.email, user.name, passwordHash, created);
    } catch (error) {
      if (/UNIQUE constraint failed/.test(error.message)) throw new Conflict();
      throw error;
    }
  }

  async findUser(email) {
    const row = this.db.prepare('SELECT id, email, name, password_hash FROM users WHERE email = ?').get(email);
    return row ? { ...row } : null;
  }

  async createSession(tokenHash, userId, now, expires) {
    this.transaction(() => {
      this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now);
      this.db
        .prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
        .run(tokenHash, userId, now, expires);
    });
  }

  async sessionUser(tokenHash, now) {
    const row = this.db
      .prepare(
        'SELECT users.id, users.email, users.name, sessions.expires_at FROM sessions' +
          ' JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ?',
      )
      .get(tokenHash);
    if (!row) return null;
    if (row.expires_at <= now) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }
    return { id: row.id, email: row.email, name: row.name };
  }

  async endSession(tokenHash) {
    this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
  }

  async listSurveys(userId) {
    return this.db
      .prepare('SELECT data FROM surveys WHERE user_id = ? ORDER BY created_at DESC, rowid DESC')
      .all(userId)
      .map((row) => JSON.parse(row.data));
  }

  async putSurvey(userId, surveyId, data, created, now) {
    this.db
      .prepare(
        'INSERT INTO surveys (user_id, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)' +
          ' ON CONFLICT (user_id, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
      )
      .run(userId, surveyId, data, created, now);
  }

  async deleteSurvey(userId, surveyId) {
    this.db.prepare('DELETE FROM surveys WHERE user_id = ? AND id = ?').run(userId, surveyId);
  }

  close() {
    this.db.close();
  }
}
