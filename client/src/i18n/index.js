import { ID } from './id.js';

/**
 * The English text is the key: `t('Add survey')` reads as it shows, and `id.js` maps it to Indonesian.
 * A test reads every t('…') in the source, so a sentence without its translation fails the build.
 */

export const LANGUAGES = [
  { code: 'en', short: 'EN', name: 'English' },
  { code: 'id', short: 'ID', name: 'Bahasa Indonesia' },
];

const TRANSLATIONS = { id: ID };
const KEY = 'roomcompare:lang';

function stored() {
  try {
    const code = window.localStorage.getItem(KEY);
    return LANGUAGES.some((language) => language.code === code) ? code : 'en';
  } catch {
    return 'en';
  }
}

let language = typeof window === 'undefined' ? 'en' : stored();

export const getLanguage = () => language;

/** Kept per device, like the photos: a shared phone keeps the language it was set to. */
export function applyLanguage(code) {
  if (!LANGUAGES.some((item) => item.code === code)) return false;
  language = code;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    // Blocked storage: the choice holds until the tab closes.
  }
  document.documentElement.lang = code;
  return true;
}

/** `vars` fill {name} slots. Text with no translation shows as written, as a stored value or a user's own words would. */
export function t(text, vars = null) {
  if (text === null || text === undefined) return text;
  const shown = TRANSLATIONS[language]?.[text] ?? text;
  if (!vars) return shown;
  return shown.replace(/\{(\w+)\}/g, (slot, name) => (name in vars ? String(vars[name]) : slot));
}

/** Marks text kept for later, as in a constant, so the test finds it; t() translates it where shown. */
export const msg = (text) => text;

/** Numbers and times in the reader's language: 1,000 and 2:05 PM, or 1.000 and 14.05. */
export const locale = () => (language === 'id' ? 'id-ID' : 'en-US');
