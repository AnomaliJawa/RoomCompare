import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ID } from '../../client/src/i18n/id.js';
import { applyLanguage, t } from '../../client/src/i18n/index.js';
import { LIKERT, ROOM_FACILITIES, SHARED_FACILITIES, SURROUNDINGS } from '../../client/src/constants.js';
import { FACILITY_SECTIONS } from '../../client/src/utils/filters.js';
import { communitySurveys } from '../../client/src/seed/communitySurveys.js';
import { validateLogin, validateRegistration, ACCOUNT_LIMITS } from '../../shared/accounts.js';

// Vitest runs from the project root.
const ROOT = process.cwd();

function sources(dir) {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(join(ROOT, path)).isDirectory()) return sources(path);
    return /\.jsx?$/.test(name) ? [path] : [];
  });
}

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
// Our own source: a quoted literal evaluates to the string it spells, escapes included.
const literal = (quoted) => new Function(`return ${quoted}`)();

/** Every quoted literal handed to t() or msg() in the app; the i18n module itself only describes them. */
function marked() {
  const found = new Set();
  for (const path of sources('client/src').filter((file) => !file.includes('i18n'))) {
    for (const match of read(path).matchAll(/\b(?:t|msg)\(\s*('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g)) {
      found.add(literal(match[1]));
    }
  }
  return found;
}

/** What the server can answer with, written in English: shown translated by services/api.js. */
function serverMessages() {
  const found = new Set();
  for (const path of sources('server')) {
    const text = read(path);
    for (const match of text.matchAll(/new ApiError\(\d+, ('(?:[^'\\]|\\.)*')/g)) found.add(literal(match[1]));
    for (const match of text.matchAll(/\berror: ('(?:[^'\\]|\\.)*')/g)) found.add(literal(match[1]));
    for (const match of text.matchAll(/const message = ('(?:[^'\\]|\\.)*')/g)) found.add(literal(match[1]));
  }
  return found;
}

/** Every message the shared account rules can give, read from the rules themselves. */
function accountMessages() {
  const long = (n) => 'x'.repeat(n + 1);
  const results = [
    validateLogin({ email: '', password: '' }),
    validateLogin({ email: 'not-an-address', password: 'x' }),
    validateRegistration({ name: '', email: '', password: '' }),
    validateRegistration({ name: long(ACCOUNT_LIMITS.NAME_MAX), email: 'a@b.co', password: long(ACCOUNT_LIMITS.PASSWORD_MAX) }),
  ];
  return new Set(results.flatMap((result) => Object.values(result.errors)));
}

/** Stored values and fixed labels shown through t() with a variable. */
const enumerated = () =>
  new Set([
    ...ROOM_FACILITIES,
    ...SHARED_FACILITIES,
    ...SURROUNDINGS,
    ...FACILITY_SECTIONS.flatMap((section) => section.options),
    ...communitySurveys.map((survey) => survey.additional.notes).filter(Boolean),
  ]);

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

afterEach(() => applyLanguage('en'));

describe('the Indonesian translation', () => {
  it('covers every text the app marks for translation', () => {
    const missing = [...marked()].filter((text) => !(text in ID));
    expect(missing).toEqual([]);
  });

  it('marks text with a quoted literal, never a template', () => {
    const templated = sources('client/src').filter((path) => /\b(?:t|msg)\(\s*`/.test(read(path)));
    expect(templated).toEqual([]);
  });

  it('covers the stored values, the filters and the community notes', () => {
    expect([...enumerated()].filter((text) => !(text in ID))).toEqual([]);
  });

  it('covers everything the server and the account rules can say', () => {
    expect([...serverMessages(), ...accountMessages()].filter((text) => !(text in ID))).toEqual([]);
  });

  it('keeps no translation the app no longer uses', () => {
    const used = new Set([...marked(), ...enumerated(), ...serverMessages(), ...accountMessages()]);
    expect(Object.keys(ID).filter((text) => !used.has(text))).toEqual([]);
  });

  it('fills the same {slots} as the English it translates', () => {
    const differing = Object.entries(ID).filter(([en, id]) => placeholders(en).join() !== placeholders(id).join());
    expect(differing).toEqual([]);
  });

  it('names the scores as the rubrics do', () => {
    applyLanguage('id');
    expect(LIKERT.map((step) => t(step.label))).toEqual(['Buruk', 'Cukup', 'Baik', 'Sangat baik']);
  });
});

describe('switching language', () => {
  it('translates, fills the slots, and leaves unknown text as written', () => {
    applyLanguage('id');
    expect(t('Add survey')).toBe(ID['Add survey']);
    expect(t('{count} kos recorded.', { count: 3 })).toBe(ID['{count} kos recorded.'].replace('{count}', '3'));
    expect(t('Kos Melati, as typed')).toBe('Kos Melati, as typed');
    expect(document.documentElement.lang).toBe('id');
    applyLanguage('en');
    expect(t('Add survey')).toBe('Add survey');
    expect(document.documentElement.lang).toBe('en');
  });

  it('is remembered on this device', () => {
    applyLanguage('id');
    expect(localStorage.getItem('roomcompare:lang')).toBe('id');
    expect(applyLanguage('fr')).toBe(false);
    expect(localStorage.getItem('roomcompare:lang')).toBe('id');
  });
});
