import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const DEFAULT_DB = fileURLToPath(new URL('../data/roomcompare.sqlite3', import.meta.url));
export const DIST_DIR = fileURLToPath(new URL('../dist', import.meta.url));

export const SESSION_COOKIE = 'rc_session';
export const SESSION_DAYS = 30;

// OWASP's 2023 figure for PBKDF2-HMAC-SHA256; each hash records its own count.
export const DEFAULT_ITERATIONS = 600_000;

// A survey record is a few kilobytes; photos never travel through here.
export const MAX_BODY = 1_000_000;
export const MAX_SURVEY_BYTES = 256_000;

export const SURVEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;

export const LOGIN_LIMIT = 10;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
