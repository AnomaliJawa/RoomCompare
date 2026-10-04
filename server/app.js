import express from 'express';
import { createApiRouter } from './api.js';
import { errorLog, securityHeaders } from './middleware.js';

/**
 * The whole site: the API under /api, then the app's files. `frontend` is Vite's dev middleware or
 * the built dist/ folder; nothing outside it is ever served.
 */
export function createApp({ ctx, clientIp, frontend = null, staticDir = null, log = true }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('etag', false);

  app.use(errorLog({ enabled: log }));
  app.use(securityHeaders);
  app.use('/api', createApiRouter({ ctx, clientIp }));

  if (frontend) app.use(frontend);
  if (staticDir) {
    app.use(
      express.static(staticDir, {
        cacheControl: false,
        etag: false,
        lastModified: false,
        dotfiles: 'ignore',
        redirect: false,
        index: 'index.html',
      }),
    );
  }

  // Hash routing: only / serves the page, so anything else is genuinely not here.
  app.use((req, res) => {
    if (req.method === 'GET' || req.method === 'HEAD') res.status(404).type('text/plain').send('Not found');
    else res.status(405).json({ error: 'That is not something this server does.' });
  });

  return app;
}
