import { createHash, randomBytes } from 'node:crypto';
import { SESSION_COOKIE, SESSION_DAYS } from '../config.js';

export const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export const newToken = () => randomBytes(32).toString('base64url');

// Only a hash of the session token is stored, so a copied database hands out no sessions.
export const tokenDigest = (token) => createHash('sha256').update(token, 'utf8').digest('hex');

/** One fixed format, so stored timestamps compare correctly as strings. */
export const stamp = (date) => date.toISOString().replace(/\.\d{3}Z$/, 'Z');

export function sessionToken(req) {
  for (const pair of String(req.headers.cookie ?? '').split(';')) {
    const at = pair.indexOf('=');
    if (at < 0 || pair.slice(0, at).trim() !== SESSION_COOKIE) continue;
    const value = pair.slice(at + 1).trim();
    return value || null;
  }
  return null;
}

/** Secure whenever the page arrived over HTTPS; plain http on localhost must work without it. */
export function sessionCookie(req, value, maxAge, secure) {
  const parts = [`${SESSION_COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`];
  if (secure || req.headers['x-forwarded-proto'] === 'https') parts.push('Secure');
  return parts.join('; ');
}
