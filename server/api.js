import express from 'express';
import { ApiError } from './errors.js';
import { refuseCrossSite, securityHeaders } from './middleware.js';
import { accountRoutes } from './routes/accounts.js';
import { surveyRoutes } from './routes/surveys.js';

const READS = new Set(['GET', 'HEAD']);

/**
 * The JSON API, mounted at /api. `ctx()` returns the storage context, or throws an ApiError
 * when there is none (a Vercel deployment without its database).
 */
export function createApiRouter({ ctx, clientIp = (req) => req.socket.remoteAddress ?? '' }) {
  const router = express.Router();

  router.use(securityHeaders);
  router.use((req, res, next) => {
    if (!READS.has(req.method)) refuseCrossSite(req);
    next();
  });
  router.use(accountRoutes({ ctx, clientIp }));
  router.use(surveyRoutes({ ctx }));
  router.use(() => {
    throw new ApiError(404, 'That is not something this server does.');
  });

  // Four parameters: Express recognises an error handler by its arity.
  router.use((error, req, res, next) => {
    if (error instanceof ApiError) {
      res.status(error.status).json(error.errors ? { error: error.message, errors: error.errors } : { error: error.message });
      return;
    }
    console.error(`API failure on ${req.method} ${req.originalUrl}:`, error);
    res.status(500).json({ error: 'The server could not complete that. Try again.' });
  });

  return router;
}
