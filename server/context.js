import { randomBytes } from 'node:crypto';
import { DEFAULT_DB, DEFAULT_ITERATIONS, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS } from './config.js';
import { ApiError } from './errors.js';
import { hashPassword } from './services/passwords.js';
import { MemoryThrottle, RedisThrottle } from './services/throttle.js';
import { RedisBackend, upstashTransport } from './storage/redis.js';

/** What the API needs: storage, the login throttle, the hashing cost and whether cookies are HTTPS-only. */
function context({ backend, throttle, iterations, secureCookies }) {
  let decoy = null;
  return {
    backend,
    throttle,
    iterations,
    secureCookies,
    // Checked against for unknown emails, so timing does not reveal which emails have accounts.
    decoyHash: () => (decoy ??= hashPassword(randomBytes(16).toString('hex'), iterations)),
  };
}

const envIterations = (env) => Number(env.ROOMCOMPARE_PBKDF2_ITERATIONS) || DEFAULT_ITERATIONS;

/** Local and self-hosted: SQLite, a throttle in memory. Imported lazily, so Vercel never loads node:sqlite. */
export async function localContext({
  dbPath = process.env.ROOMCOMPARE_DB || DEFAULT_DB,
  iterations = envIterations(process.env),
  secureCookies = process.env.ROOMCOMPARE_SECURE_COOKIES === '1',
  loginLimit = LOGIN_LIMIT,
} = {}) {
  const { SQLiteBackend } = await import('./storage/sqlite.js');
  return context({
    backend: new SQLiteBackend(dbPath),
    throttle: new MemoryThrottle(loginLimit, LOGIN_WINDOW_SECONDS),
    iterations,
    secureCookies,
  });
}

export function redisContext({ send, iterations, secureCookies = true, loginLimit = LOGIN_LIMIT }) {
  return context({
    backend: new RedisBackend(send),
    throttle: new RedisThrottle(send, loginLimit, LOGIN_WINDOW_SECONDS),
    iterations,
    secureCookies,
  });
}

/** The app as Vercel runs it: Redis storage, HTTPS-only cookies. */
export function contextFromEnv(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token) throw new ApiError(503, "RoomCompare's storage is not connected yet. Try again later.");
  return redisContext({ send: upstashTransport(url, token), iterations: envIterations(env) });
}
