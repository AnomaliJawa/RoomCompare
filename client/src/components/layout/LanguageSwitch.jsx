import { Globe } from 'lucide-react';
import * as store from '../../data/store.js';
import { LANGUAGES, getLanguage, t } from '../../i18n/index.js';
import { ICON } from '../ui/icons.js';
import { button, cx } from '../ui/styles.js';

/**
 * One button naming the language shown, "EN" or "ID" (the user's choice); pressing it switches to the
 * other, as its tooltip says. Its spoken name adds the language's own name.
 */
export function LanguageSwitch({ className = '' }) {
  const current = LANGUAGES.find(({ code }) => code === getLanguage());
  const next = LANGUAGES.find(({ code }) => code !== current.code);
  return (
    <button
      className={button({ variant: 'quiet', gap: 'gap-1', className: cx('shrink-0 pointer-coarse:min-w-target', className) })}
      type="button"
      title={t('Switch to {language}', { language: next.name })}
      onClick={() => store.setLanguage(next.code)}
    >
      <Globe {...ICON} className="block max-xs:hidden" aria-hidden="true" />
      {current.short}
      <span className="sr-only"> · {current.name}</span>
    </button>
  );
}
