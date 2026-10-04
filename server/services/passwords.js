import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(pbkdf2);

/** Stored as pbkdf2_sha256$<iterations>$<salt>$<hash>: the format existing accounts were made with. */
export async function hashPassword(password, iterations) {
  const salt = randomBytes(16);
  const digest = await derive(password, salt, iterations, 32, 'sha256');
  return `pbkdf2_sha256$${iterations}$${salt.toString('base64')}$${digest.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, count, salt, digest, ...rest] = String(stored ?? '').split('$');
  const iterations = Number(count);
  if (scheme !== 'pbkdf2_sha256' || rest.length || !Number.isInteger(iterations) || iterations < 1) return false;
  const expected = Buffer.from(digest ?? '', 'base64');
  if (!expected.length) return false;
  const candidate = await derive(password, Buffer.from(salt ?? '', 'base64'), iterations, expected.length, 'sha256');
  return timingSafeEqual(candidate, expected);
}
