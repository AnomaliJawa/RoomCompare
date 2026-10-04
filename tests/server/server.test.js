import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import vercelHandler, { createVercelApp } from '../../api/index.js';
import { LOGIN_LIMIT } from '../../server/config.js';
import { contextFromEnv, redisContext } from '../../server/context.js';
import { createLocalServer } from '../../server/local.js';
import { RedisThrottle } from '../../server/services/throttle.js';
import { RedisBackend, upstashTransport } from '../../server/storage/redis.js';
import { Client, sendRaw } from './client.js';
import { FakeRedis, serveUpstash } from './fakeUpstash.js';

/** The server over real HTTP; the account, throttle and survey suites run on SQLite and on Vercel's Redis path. */

const run = promisify(execFile);

const listen = (server) =>
  new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));

function stop(server) {
  server.closeAllConnections();
  return new Promise((resolve) => server.close(resolve));
}

/** A site folder with a page and a script, beside files that must never be served. */
function site() {
  const dir = mkdtempSync(join(tmpdir(), 'roomcompare-'));
  const root = join(dir, 'site');
  mkdirSync(join(root, 'assets'), { recursive: true });
  mkdirSync(join(root, '.git'));
  writeFileSync(join(root, 'index.html'), '<!doctype html><title>RoomCompare</title>');
  writeFileSync(join(root, 'assets', 'app.js'), 'export {};');
  writeFileSync(join(root, '.git', 'config'), '[core]');
  writeFileSync(join(dir, 'secret.txt'), 'not for anyone');
  return { dir, root };
}

const setups = {
  'the local server, on SQLite': async ({ loginLimit = LOGIN_LIMIT } = {}) => {
    const { dir, root } = site();
    const { server, context } = await createLocalServer({
      dbPath: join(dir, 'test.sqlite3'),
      iterations: 1000,
      secureCookies: false,
      loginLimit,
      staticDir: root,
      log: false,
    });
    const port = await listen(server);
    const { db } = context.backend;
    return {
      local: true,
      port,
      base: `http://127.0.0.1:${port}`,
      expireSessions: () => db.exec("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'"),
      storedPasswordHash: (email) => db.prepare('SELECT password_hash FROM users WHERE email = ?').get(email).password_hash,
      stop: async () => {
        await stop(server);
        rmSync(dir, { recursive: true, force: true });
      },
    };
  },
  'the Vercel function, on Redis': async ({ loginLimit = LOGIN_LIMIT } = {}) => {
    const redis = new FakeRedis();
    const upstash = await serveUpstash(redis, 'test-token');
    // Plain http in the tests, so no Secure cookie; production sets it.
    const context = redisContext({ send: upstashTransport(upstash.url, 'test-token'), iterations: 1000, secureCookies: false, loginLimit });
    const server = createServer(createVercelApp({ ctx: () => context }));
    const port = await listen(server);
    return {
      local: false,
      port,
      base: `http://127.0.0.1:${port}`,
      expireSessions: () => redis.expire('rc:session:'),
      storedPasswordHash: (email) => JSON.parse(redis.data.get(`rc:user:${redis.data.get(`rc:email:${email}`)}`)).password_hash,
      stop: async () => {
        await stop(server);
        await stop(upstash.server);
      },
    };
  },
};

function running(start, options) {
  const env = {};
  beforeAll(async () => Object.assign(env, await start(options)));
  afterAll(() => env.stop());
  return env;
}

const survey = (id, { name = 'Kos Melati', created = '2026-09-01T08:00:00.000Z' } = {}) => ({
  id,
  status: 'draft',
  createdAt: created,
  updatedAt: created,
  kos: { name },
});

describe.each(Object.entries(setups))('%s', (_, start) => {
  describe('accounts', () => {
    const env = running(start);
    const client = () => new Client(env.base);

    it('register logs in with a cookie scripts cannot read', async () => {
      const browser = client();
      const { status, body, headers, email } = await browser.register();
      expect(status).toBe(201);
      expect(body.user).toMatchObject({ email, name: 'Rahma' });
      const [cookie] = headers['set-cookie'];
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      // Plain http on localhost: a Secure cookie would never be sent back.
      expect(cookie).not.toContain('Secure');

      const me = await browser.call('GET', '/api/me');
      expect(me.status).toBe(200);
      expect(me.body.user.email).toBe(email);
    });

    it('holds one account per email, whatever its case', async () => {
      const email = `${randomUUID().slice(0, 8)}@Example.com`;
      expect((await client().register({ email })).status).toBe(201);
      const again = await client().register({ email: email.toUpperCase() });
      expect(again.status).toBe(409);
      expect(again.body.errors.email).toContain('already exists');
    });

    it('says what to fix on registration', async () => {
      const cases = [
        [{ name: '', email: 'a@b.co', password: 'longenough' }, 'name', 'Enter your name.'],
        [{ name: 'R', email: 'not-an-email', password: 'longenough' }, 'email', 'Enter an email address like name@example.com.'],
        [{ name: 'R', email: 'a@b.co', password: 'short' }, 'password', 'Use at least 8 characters.'],
      ];
      for (const [body, field, message] of cases) {
        const reply = await client().call('POST', '/api/register', { body });
        expect(reply.status).toBe(400);
        expect(reply.body.errors[field]).toBe(message);
      }
    });

    it('does not say which half of a login was wrong', async () => {
      const { email } = await client().register({ password: 'right password' });
      const wrongPassword = await client().call('POST', '/api/login', { body: { email, password: 'wrong password' } });
      const unknownEmail = await client().call('POST', '/api/login', { body: { email: 'nobody@example.com', password: 'wrong password' } });
      expect([wrongPassword.status, unknownEmail.status]).toEqual([401, 401]);
      expect(wrongPassword.body.error).toBe(unknownEmail.body.error);

      const right = await client().call('POST', '/api/login', { body: { email: email.toUpperCase(), password: 'right password' } });
      expect(right.status).toBe(200);
      expect(right.body.user.email).toBe(email);
      expect(right.headers['set-cookie'][0]).toContain('rc_session=');
    });

    it('ends the session on logout', async () => {
      const browser = client();
      await browser.register();
      expect((await browser.call('POST', '/api/logout')).status).toBe(204);
      expect((await browser.call('GET', '/api/me')).status).toBe(401);
    });

    it('refuses an expired session', async () => {
      const browser = client();
      await browser.register();
      env.expireSessions();
      expect((await browser.call('GET', '/api/me')).status).toBe(401);
    });

    it('stores passwords only as salted hashes', async () => {
      const { email } = await client().register({ password: 'a very secret phrase' });
      const stored = env.storedPasswordHash(email);
      expect(stored.startsWith('pbkdf2_sha256$1000$')).toBe(true);
      expect(stored).not.toContain('a very secret phrase');
    });
  });

  describe('the login throttle', () => {
    const env = running(start, { loginLimit: 3 });

    it('refuses repeated failures for a while', async () => {
      const { email } = await new Client(env.base).register({ password: 'right password' });
      for (let i = 0; i < 3; i += 1) {
        const reply = await new Client(env.base).call('POST', '/api/login', { body: { email, password: 'nope nope' } });
        expect(reply.status).toBe(401);
      }
      const reply = await new Client(env.base).call('POST', '/api/login', { body: { email, password: 'right password' } });
      expect(reply.status).toBe(429);
      expect(reply.body.error).toContain('Too many attempts');
    });
  });

  describe('surveys', () => {
    const env = running(start);
    const client = () => new Client(env.base);

    it('needs a session for every survey call', async () => {
      const anonymous = client();
      expect((await anonymous.call('GET', '/api/surveys')).status).toBe(401);
      expect((await anonymous.call('PUT', '/api/surveys/svy-a', { body: { survey: survey('svy-a') } })).status).toBe(401);
      expect((await anonymous.call('DELETE', '/api/surveys/svy-a')).status).toBe(401);
    });

    it('saves, lists, updates and deletes', async () => {
      const browser = client();
      await browser.register();
      const put = (record) => browser.call('PUT', `/api/surveys/${record.id}`, { body: { survey: record } });
      expect((await put(survey('svy-old', { created: '2026-08-01T08:00:00.000Z' }))).status).toBe(204);
      expect((await put(survey('svy-new', { created: '2026-09-01T08:00:00.000Z' }))).status).toBe(204);

      const listed = await browser.call('GET', '/api/surveys');
      expect(listed.status).toBe(200);
      expect(listed.body.surveys.map((s) => s.id)).toEqual(['svy-new', 'svy-old']);

      await put(survey('svy-old', { name: 'Kos Melati Residence', created: '2026-08-01T08:00:00.000Z' }));
      const names = Object.fromEntries((await browser.call('GET', '/api/surveys')).body.surveys.map((s) => [s.id, s.kos.name]));
      expect(names['svy-old']).toBe('Kos Melati Residence');

      expect((await browser.call('DELETE', '/api/surveys/svy-old')).status).toBe(204);
      // A retried delete after a dropped connection must not look like a failure.
      expect((await browser.call('DELETE', '/api/surveys/svy-old')).status).toBe(204);
      expect((await browser.call('GET', '/api/surveys')).body.surveys.map((s) => s.id)).toEqual(['svy-new']);
    });

    it('lets each account see and change only its own', async () => {
      const [rahma, budi] = [client(), client()];
      await rahma.register({ name: 'Rahma' });
      await budi.register({ name: 'Budi' });
      await rahma.call('PUT', '/api/surveys/svy-shared-id', { body: { survey: survey('svy-shared-id', { name: "Rahma's kos" }) } });

      expect((await budi.call('GET', '/api/surveys')).body.surveys).toEqual([]);
      await budi.call('PUT', '/api/surveys/svy-shared-id', { body: { survey: survey('svy-shared-id', { name: "Budi's kos" }) } });
      await budi.call('DELETE', '/api/surveys/svy-shared-id');

      const mine = (await rahma.call('GET', '/api/surveys')).body.surveys;
      expect(mine.map((s) => s.kos.name)).toEqual(["Rahma's kos"]);
    });

    it('refuses a survey that does not match its address', async () => {
      const browser = client();
      await browser.register();
      const reply = await browser.call('PUT', '/api/surveys/svy-a', { body: { survey: survey('svy-b') } });
      expect(reply.status).toBe(400);
      expect(reply.body.error).toContain('does not match');
    });

    it('keeps to the size and format limits', async () => {
      const browser = client();
      await browser.register();
      const tooBig = Buffer.from(JSON.stringify({ survey: { ...survey('svy-big'), notes: 'x'.repeat(1_100_000) } }));
      const asJson = { 'Content-Type': 'application/json' };
      expect((await browser.call('PUT', '/api/surveys/svy-big', { raw: tooBig, headers: asJson })).status).toBe(413);
      const form = { 'Content-Type': 'application/x-www-form-urlencoded' };
      expect((await browser.call('PUT', '/api/surveys/svy-a', { raw: Buffer.from('id=svy-a'), headers: form })).status).toBe(415);
    });

    it('refuses writes from another site', async () => {
      const { email } = await client().register({ password: 'right password' });
      const body = { email, password: 'right password' };
      const evil = await client().call('POST', '/api/login', { body, headers: { Origin: 'http://evil.example' } });
      expect(evil.status).toBe(403);
      const sameSite = await client().call('POST', '/api/login', { body, headers: { Origin: env.base } });
      expect(sameSite.status).toBe(200);
    });

    it('still sends a refusal when the body arrives late', async () => {
      const browser = client();
      await browser.register();
      const record = Buffer.from(JSON.stringify({ survey: survey('svy-a') }));
      const tooBig = Buffer.from(JSON.stringify({ survey: { ...survey('svy-a'), notes: 'x'.repeat(1_100_000) } }));
      const asJson = { 'Content-Type': 'application/json' };
      const cases = [
        [browser, record, { ...asJson, Origin: 'http://evil.example' }, 403, 'Requests from other sites are not accepted.'],
        [client(), record, asJson, 401, 'Log in to continue.'],
        [browser, Buffer.from('id=svy-a'), { 'Content-Type': 'application/x-www-form-urlencoded' }, 415, 'Send the request as JSON.'],
        [browser, tooBig, asJson, 413, 'That is too large to save.'],
      ];
      for (const [who, raw, headers, status, message] of cases) {
        const reply = await who.callWithLateBody('PUT', '/api/surveys/svy-a', raw, headers);
        expect([reply.status, reply.body]).toEqual([status, { error: message }]);
      }
    });

    it('refuses a negative length without reading the body', async ({ skip }) => {
      // Vercel's edge parses requests before the function sees them.
      if (!env.local) skip();
      const login = JSON.stringify({ email: 'nobody@example.com', password: 'wrong password' });
      for (const length of ['-1', '-2']) {
        const reply = await sendRaw(
          env.port,
          `POST /api/login HTTP/1.0\r\nContent-Type: application/json\r\nContent-Length: ${length}\r\n\r\n${login}`,
        );
        expect([reply.status, reply.body]).toEqual([400, { error: 'That request could not be read.' }]);
      }
    });
  });
});

describe('the app’s files, on the local server', () => {
  const env = running(setups['the local server, on SQLite']);

  it('are served without caching', async () => {
    const browser = new Client(env.base);
    const page = await browser.call('GET', '/');
    expect(page.status).toBe(200);
    expect(page.body.toString()).toContain('RoomCompare');
    expect(page.headers['cache-control']).toContain('no-store');
    expect((await browser.call('GET', '/assets/app.js')).status).toBe(200);
  });

  it('are the only thing served', async () => {
    const browser = new Client(env.base);
    for (const path of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/../../secret.txt', '/.git/config', '/assets/',
      '/server/app.js', '/package.json', '/data/roomcompare.sqlite3', '/docs/PRD.md']) {
      expect((await browser.call('GET', path)).status, path).toBe(404);
    }
  });
});

describe('the Vercel function', () => {
  const env = running(setups['the Vercel function, on Redis'], { loginLimit: 2 });

  it('counts each visitor by the address Vercel forwards', async () => {
    const { email } = await new Client(env.base).register({ password: 'right password' });
    const wrong = { body: { email, password: 'nope nope' } };
    const from = (address) => ({ ...wrong, headers: { 'X-Forwarded-For': address } });
    for (let i = 0; i < 2; i += 1) await new Client(env.base).call('POST', '/api/login', from('203.0.113.7'));
    expect((await new Client(env.base).call('POST', '/api/login', from('203.0.113.7'))).status).toBe(429);
    // Another visitor is not held up by the first one's failures.
    expect((await new Client(env.base).call('POST', '/api/login', from('198.51.100.4'))).status).toBe(401);
  });

  it('says so when its storage is not connected, instead of failing', async () => {
    const server = createServer(createVercelApp({ ctx: () => contextFromEnv({}) }));
    const port = await listen(server);
    try {
      // Logging in is the first thing that needs storage; a cookieless who-am-I rightly answers 401.
      const reply = await new Client(`http://127.0.0.1:${port}`).call('POST', '/api/login', {
        body: { email: 'a@b.co', password: 'longenough' },
      });
      expect(reply.status).toBe(503);
      expect(reply.body.error).toContain('storage is not connected');
    } finally {
      await stop(server);
    }
  });

  it('takes either Upstash naming, with Redis and HTTPS-only cookies', () => {
    for (const [url, token] of [
      ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
      ['KV_REST_API_URL', 'KV_REST_API_TOKEN'],
    ]) {
      const context = contextFromEnv({ [url]: 'https://example.upstash.io', [token]: 'token', ROOMCOMPARE_PBKDF2_ITERATIONS: '1000' });
      expect(context.backend).toBeInstanceOf(RedisBackend);
      expect(context.throttle).toBeInstanceOf(RedisThrottle);
      expect(context.secureCookies).toBe(true);
      expect(context.iterations).toBe(1000);
      expect(context.backend.send.url).toBe('https://example.upstash.io/pipeline');
    }
  });

  it('exports the app itself as the function', () => {
    expect(typeof vercelHandler).toBe('function');
    expect(typeof vercelHandler.use).toBe('function');
  });

  it('reaches Redis on its own module’s imports, in a fresh process', async () => {
    // A test's own imports once hid a missing import in the Redis client.
    const upstash = await serveUpstash(new FakeRedis(), 'token');
    try {
      const redisModule = pathToFileURL(fileURLToPath(new URL('../../server/storage/redis.js', import.meta.url))).href;
      const script =
        `const { upstashTransport } = await import(${JSON.stringify(redisModule)});` +
        `console.log(JSON.stringify(await upstashTransport(${JSON.stringify(upstash.url)}, 'token')([['SET', 'k', 'v'], ['GET', 'k']])));`;
      // Asynchronous: this process serves the fake Redis the child talks to.
      const { stdout } = await run(process.execPath, ['--input-type=module', '-e', script], { timeout: 60_000 });
      expect(stdout.trim()).toBe('["OK","v"]');
    } finally {
      await stop(upstash.server);
    }
  });
});
