/** The API as one Vercel function: Redis storage, and the client address from Vercel's own headers. */
import express from 'express';
import { createApiRouter } from '../server/api.js';
import { contextFromEnv } from '../server/context.js';

// Built on first use and kept: a missing database must answer 503, not stop the function loading.
let context = null;
const ctx = () => (context ??= contextFromEnv());

// Vercel's edge sets these headers itself, replacing any a client sends.
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
  return req.headers['x-real-ip'] || forwarded || req.socket.remoteAddress || '';
}

export function createVercelApp({ ctx: getContext = ctx } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);
  app.use('/api', createApiRouter({ ctx: getContext, clientIp }));
  return app;
}

export default createVercelApp();
