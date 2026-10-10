import { getLanguage, t } from '../i18n/index.js';
import * as en from './guidance.en.js';
import * as id from './guidance.id.js';

/** The survey form's copy in the reader's language; both files share one shape, and a test holds them to it. */
export const guidance = () => (getLanguage() === 'id' ? id : en);

export function rubricLine(level) {
  const base = `${level.score} ${level.label}: ${level.text}`;
  return level.benchmark ? `${base} ${t('Average Download {speed}.', { speed: level.benchmark })}` : base;
}

export function rubricText(key, score) {
  const level = guidance().RUBRICS[key]?.find((step) => step.score === Number(score));
  return level ? rubricLine(level) : '';
}
