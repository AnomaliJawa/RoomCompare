import { t } from '../../i18n/index.js';

const link =
  'font-semibold whitespace-nowrap no-underline active:text-accent-press active:underline hover:underline touch-hit';

/** The chevrons are drawn, not written, so a screen reader reads the names alone. */
function Chevron() {
  return <span className="size-1.5 shrink-0 rotate-45 border-t-[1.5px] border-r-[1.5px] border-muted" aria-hidden="true" />;
}

export function Breadcrumbs({ trail, current }) {
  return (
    <nav className="mb-3" aria-label={t('Breadcrumb')}>
      <ol className="flex min-w-0 items-center gap-2 text-xs">
        {trail.map(({ label, href }, index) => (
          <li key={href} className="flex min-w-0 shrink-0 items-center gap-2">
            {index > 0 && <Chevron />}
            <a className={link} href={href}>
              {t(label)}
            </a>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-2">
          <Chevron />
          <span className="truncate text-muted" aria-current="page">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
