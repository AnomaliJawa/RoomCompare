/** The app's files plus its JSON API: node server/index.js [port] [--host HOST] [--db PATH] [--dev]. */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { DIST_DIR } from './config.js';
import { createLocalServer } from './local.js';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    host: { type: 'string', default: '' },
    db: { type: 'string' },
    dev: { type: 'boolean', default: false },
  },
});
const port = Number(positionals[0] ?? 5173);

if (!values.dev && !existsSync(join(DIST_DIR, 'index.html'))) {
  console.error('There is no build to serve. Run `npm run build` first, or `npm run dev` while working on the app.');
  process.exit(1);
}

const { server, context } = await createLocalServer({ dev: values.dev, dbPath: values.db });
// Every interface and both IP families by default, so localhost is fast and a phone on the network can connect.
server.listen(port, values.host || undefined, () => {
  const mode = values.dev ? ', live reload on' : '';
  console.log(`RoomCompare on http://localhost:${port} (API at /api, data in ${context.backend.path}${mode})`);
});
