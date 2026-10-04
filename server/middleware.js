import { MAX_BODY } from './config.js';
import { ApiError } from './errors.js';

/** On every response: nothing cached, plus the security headers. */
export function securityHeaders(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Not same-origin: OSM tiles, Nominatim and the router need a Referer.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
}

/** Errors only, never 401 (every logged-out visit) and never request bodies (passwords). */
export function errorLog({ enabled = true } = {}) {
  return (req, res, next) => {
    if (enabled) {
      res.on('finish', () => {
        if (res.statusCode >= 400 && res.statusCode !== 401) {
          console.log(`[${new Date().toISOString()}] "${req.method} ${req.originalUrl}" ${res.statusCode}`);
        }
      });
    }
    next();
  };
}

/** Writes must come from this site's own pages: a third check beside SameSite=Lax and JSON only. */
export function refuseCrossSite(req) {
  const origin = req.headers.origin;
  if (origin === undefined) return;
  let host = '';
  try {
    host = new URL(origin).host;
  } catch {
    // An opaque origin ("null") is not this site.
  }
  if (host !== req.headers.host) throw new ApiError(403, 'Requests from other sites are not accepted.');
}

const contentType = (req) => String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();

const unreadable = () => new ApiError(400, 'That request could not be read.');

export async function readJson(req) {
  if (contentType(req) !== 'application/json') throw new ApiError(415, 'Send the request as JSON.');
  if (Number(req.headers['content-length']) > MAX_BODY) throw new ApiError(413, 'That is too large to save.');

  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new ApiError(413, 'That is too large to save.');
      chunks.push(chunk);
    }
  } catch (error) {
    throw error instanceof ApiError ? error : unreadable();
  }

  let body;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    body = JSON.parse(text || '{}');
  } catch {
    throw unreadable();
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) throw unreadable();
  return body;
}
