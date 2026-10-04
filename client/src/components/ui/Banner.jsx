import { button, cx } from './styles.js';

export function Banner({ message, tone = 'info', action = null }) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-4 rounded-sm border border-l-2 px-4 py-3',
        tone === 'alert' ? 'border-rule border-l-alert bg-alert-bg text-alert' : 'border-rule border-l-muted bg-surface',
      )}
      data-tone={tone}
    >
      <span>{message}</span>
      {action && (
        <button className={button({ variant: 'quiet', size: 'small' })} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/** Said once at the top: "Not recorded" is easy to miss halfway down a long table. */
export function IncompleteDataBanner({ names }) {
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return (
    <Banner message={`Some information is missing for ${list}. Rows below read “Not recorded” where nothing was captured.`} />
  );
}
