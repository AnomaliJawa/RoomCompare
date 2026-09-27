/**
 * Creates — or resets — a demo account holding the eight sample surveys.
 *
 * Every account starts empty, so a demo or a usability session needs a known
 * starting point to begin from. The server must be running:
 *
 *     python server.py 5173
 *     node tools-seed-demo.mjs [base-url]        (default http://localhost:5173)
 *
 * It goes through the app's own API, so the account and its surveys obey the
 * same rules as anyone else's. The password is random unless
 * ROOMCOMPARE_DEMO_PASSWORD is set when the account is created, and it is
 * written to data/demo-account.txt — gitignored like the database beside it —
 * rather than printed.
 *
 * Run it again to reset the account: it logs in with that file and leaves
 * exactly the samples, deleting surveys added since and restoring any that
 * were deleted.
 *
 * The samples' photos are the images that ship with the app (seed-photos/),
 * referenced by id, so they show on every device without being uploaded.
 *
 * Not app code.
 */

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ownSurveys } from './src/seed/ownSurveys.js';

const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const DATA = new URL('./data/', import.meta.url);
const FILE = new URL('demo-account.txt', DATA);
const EMAIL = 'demo@roomcompare.test';
const NAME = 'Demo';

let cookie = '';

async function call(method, path, body) {
  let response;
  try {
    response = await fetch(`${BASE}/api${path}`, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`No RoomCompare server at ${BASE}. Start it first: python server.py 5173`);
  }
  const session = response.headers.get('set-cookie');
  if (session) cookie = session.split(';')[0];
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  return { status: response.status, payload };
}

function refused(what, { status, payload }) {
  return new Error(`${what} failed (${status}): ${payload?.error ?? 'no reason given'}`);
}

async function signIn() {
  const saved = existsSync(FILE) ? readFileSync(FILE, 'utf8').match(/^Password:\s*(.+)$/m)?.[1]?.trim() : null;
  if (saved) {
    const login = await call('POST', '/login', { email: EMAIL, password: saved });
    if (login.status === 200) return { password: saved, created: false };
    if (login.status !== 401) throw refused('Logging in', login);
  }

  const password = process.env.ROOMCOMPARE_DEMO_PASSWORD || randomBytes(12).toString('base64url');
  const register = await call('POST', '/register', { name: NAME, email: EMAIL, password });
  if (register.status === 201) return { password, created: true };
  if (register.status === 409) {
    throw new Error(
      `${EMAIL} already exists, but data/demo-account.txt does not hold its password. ` +
        'Remove that account from data/roomcompare.sqlite3 and run this again.',
    );
  }
  throw refused('Creating the account', register);
}

const { password, created } = await signIn();

// Exactly the samples: anything else goes, and every sample is put back as shipped.
const samples = new Set(ownSurveys.map((survey) => survey.id));
const listed = await call('GET', '/surveys');
if (listed.status !== 200) throw refused('Reading the surveys', listed);
for (const survey of listed.payload.surveys) {
  if (samples.has(survey.id)) continue;
  const removed = await call('DELETE', `/surveys/${encodeURIComponent(survey.id)}`);
  if (removed.status !== 204) throw refused(`Deleting ${survey.id}`, removed);
}
for (const survey of ownSurveys) {
  const saved = await call('PUT', `/surveys/${encodeURIComponent(survey.id)}`, { survey });
  if (saved.status !== 204) throw refused(`Saving ${survey.kos.name}`, saved);
}
const after = await call('GET', '/surveys');
await call('POST', '/logout');

mkdirSync(DATA, { recursive: true });
writeFileSync(
  FILE,
  [
    'RoomCompare demo account, made by tools-seed-demo.mjs.',
    'Local only: data/ is gitignored. Run the tool again to reset the account.',
    '',
    `Email:    ${EMAIL}`,
    `Password: ${password}`,
    '',
  ].join('\n'),
);

console.log(
  `Demo account ${created ? 'created' : 'reset'}: ${after.payload.surveys.length} sample surveys. ` +
    'Its email and password are in data/demo-account.txt.',
);
