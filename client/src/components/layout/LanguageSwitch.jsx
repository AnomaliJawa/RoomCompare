import * as store from '../../data/store.js';
import { LANGUAGES, getLanguage, t } from '../../i18n/index.js';
import { cx } from '../ui/styles.js';

const option = cx(
  'inline-flex min-h-8 min-w-8 items-center justify-center rounded-sm px-2 text-xs font-semibold transition-colors',
  '[-webkit-tap-highlight-color:transparent] pointer-coarse:min-h-target pointer-coarse:min-w-target',
);

/** EN and ID, the one shown pressed; each code's tooltip names its language in that language. */
export function LanguageSwitch({ className = '' }) {
  const current = getLanguage();
  return (
    <div className={cx('items-center gap-1', className)} role="group" aria-label={t('Language')}>
      {LANGUAGES.map(({ code, short, name }) => {
        const pressed = code === current;
        return (
          <button
            key={code}
            className={cx(
              option,
              pressed
                ? 'bg-accent-tint text-accent active:bg-accent-tint active:text-accent-press'
                : 'text-muted hover:text-ink active:bg-accent-tint active:text-ink',
            )}
            type="button"
            lang={code}
            title={name}
            aria-pressed={pressed ? 'true' : 'false'}
            onClick={() => store.setLanguage(code)}
          >
            {short}
          </button>
        );
      })}
    </div>
  );
}
