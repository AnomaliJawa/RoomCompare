import { createServer } from 'node:http';
import { createApp } from './app.js';
import { DIST_DIR, ROOT } from './config.js';
import { localContext } from './context.js';

const BAD_REQUEST = JSON.stringify({ error: 'That request could not be read.' });

/** A request Node cannot parse, such as a negative Content-Length, still gets the API's JSON refusal. */
function refuseMalformed(error, socket) {
  if (error.code === 'ECONNRESET' || !socket.writable) {
    socket.destroy();
    return;
  }
  socket.end(
    'HTTP/1.1 400 Bad Request\r\nContent-Type: application/json; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(BAD_REQUEST)}\r\nConnection: close\r\n\r\n${BAD_REQUEST}`,
  );
}

/** The local and self-hosted server, built without listening; the tests start it on port 0. */
export async function createLocalServer({ dev = false, staticDir = DIST_DIR, log = true, ...options } = {}) {
  const context = await localContext(options);
  const server = createServer();
  let vite = null;

  if (dev) {
    const { createServer: createVite } = await import('vite');
    vite = await createVite({
      configFile: `${ROOT}vite.config.js`,
      server: { middlewareMode: true, ws: { server } },
      appType: 'mpa',
    });
  }

  const app = createApp({
    ctx: () => context,
    frontend: vite?.middlewares ?? null,
    staticDir: dev ? null : staticDir,
    log,
  });
  server.on('request', app);
  server.on('clientError', refuseMalformed);
  server.on('close', () => {
    vite?.close();
    context.backend.close?.();
  });
  return { server, context };
}
