# RoomCompare

Record, organise and compare the boarding houses (*kos*) you have already
visited, so the choice of where to live rests on what you actually saw.

**Live:** https://www.roomcompare.my.id

Built for students in Indonesia who survey several kos before choosing one,
and whose notes otherwise end up scattered across a phone gallery, a notes
app and chat threads. RoomCompare starts after the search: it is not a
marketplace, a booking site or a kos directory.

## What it does

- **Record a survey on site.** Rent, kos type, the owner's phone, pins for
  the kos and the campus (with address search), the walking distance between
  them, room size, 24 facilities across the room, bathroom and shared areas,
  7 nearby amenities, ratings for cleanliness, internet and security, notes,
  and photos and videos. A draft needs only a name and saves itself as you
  go; publishing checks that the survey is complete.
- **Compare up to three kos** side by side, on every criterion, in the same
  order. Nothing is cut short, and anything not recorded reads
  *Not recorded* rather than a blank.
- **Best Match** (optional) scores each kos from weights you set: price,
  facilities, cleanliness, location, distance to campus and security. A kos
  missing a weighted value gets no score instead of a guessed one.
- **Community:** sample surveys to browse, filter, star and like.
- **Accounts** keep your survey records on any device you log in from. The
  app keeps working offline once open, and sends changes when the
  connection returns. Photos and videos stay on the device they were added
  on.

## Stack

| Part | Uses |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, lucide-react |
| Backend | Express 5 on Node.js 22.13 or later |
| Storage in the browser | localStorage (the working copy of your surveys), IndexedDB (photos and videos) |
| Storage on the server | SQLite (`node:sqlite`) locally; Upstash Redis on Vercel |
| Maps | Leaflet with OpenStreetMap, Nominatim address search, OSRM walking routes |
| Tests | Vitest, jsdom, Testing Library |

The map services are optional: without them the app falls back to typed
coordinates and straight-line distances. No API keys are needed.

## Getting started

Requires Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5173 and create an account on the Register page.
Accounts start empty. To get one with sample surveys:

```bash
npm run seed:demo
```

It creates a demo account holding 8 surveys and writes its login to
`data/demo-account.txt`. Running it again resets the account.

On Windows PowerShell, if `npm` is blocked by the script execution policy,
use `npm.cmd` instead (for example `npm.cmd run dev`).

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | The app and API on port 5173, with live reload |
| `npm run build` | Builds the app into `dist/` |
| `npm start` | Builds, then serves `dist/` and the API, as in production |
| `npm test` | All tests: client (jsdom) and server (Node) |
| `npm run test:client` / `npm run test:server` | One of the two |
| `npm run seed:demo` | Creates or resets the demo account |

The server also takes a port, `--host` and `--db <path>`, passed after
`--`: `npm start -- 8080 --db ./my.sqlite3`.

## Project structure

```
client/            the React app (Vite's root)
  public/          icons, sample photos, web manifest
  src/
    pages/         one per screen
    components/    by area: ui, form, survey, compare, community, feedback, layout
    hooks/         store, media and walking-distance hooks
    actions/       store actions with their confirmations and toasts
    services/      API client, sync, address search, walking routes
    data/          the store, localStorage, IndexedDB media
    utils/         pure logic: Best Match, comparison, filters, formatting
    content/       the survey form's guidance text
    seed/          sample surveys
server/            the Express app: routes, middleware, storage, services
api/index.js       the API as one Vercel function
shared/            account validation used by both sides
tests/             client/ and server/
tools/             demo seeding and asset generation
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ROOMCOMPARE_DB` | `data/roomcompare.sqlite3` | The local database file |
| `ROOMCOMPARE_SECURE_COOKIES` | off | Set to `1` when serving over HTTPS |
| `ROOMCOMPARE_PBKDF2_ITERATIONS` | 600000 | Password hashing cost |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | — | Redis storage on Vercel (`KV_REST_API_URL` and `KV_REST_API_TOKEN` also work) |

## Deployment

**Vercel:** `vercel.json` builds the app with Vite into `dist/` and runs
every `/api/*` request through one Node function, `api/index.js`. Connect an
Upstash Redis database so the variables above are set; without them the API
answers 503.

**Self-hosting:** run `npm start` behind HTTPS with
`ROOMCOMPARE_SECURE_COOKIES=1`. Accounts and surveys are kept in the SQLite
file; back it up with the server stopped.

## Privacy and security

- Photos and videos never leave the device they were added on.
- Passwords are stored only as salted PBKDF2-SHA256 hashes.
- The session is an HttpOnly cookie; the server keeps only a hash of it.
- Requests that change data are accepted only from the app's own site.

## Known limitations

- No password reset, account deletion, or export of your surveys.
- If two devices edit the same survey offline, the last one to sync wins.
- Changes made on another device appear at your next login or reload.
