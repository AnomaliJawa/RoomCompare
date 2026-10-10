import { CircleCheck, CircleDashed } from 'lucide-react';
import { STATUS, kosTypeLabel, statusLabel } from '../../constants.js';
import { t } from '../../i18n/index.js';
import { toggleCompare } from '../../actions/surveys.js';
import { useMediaRecords } from '../../hooks/useMediaRecords.js';
import { campusName, formatKosDistance, numberToCurrency } from '../../utils/format.js';
import { ICON } from '../ui/icons.js';
import { button, cx, meta, narrowLabel } from '../ui/styles.js';
import { DeleteButton, EditLink, LikeButton, StarButton } from './SurveyButtons.jsx';

const firstPhoto = (survey) => survey.room?.photoIds?.[0] ?? survey.shared?.photoIds?.[0] ?? survey.bathroom?.photoIds?.[0];

export function PhotoPlaceholder({ name }) {
  const initial = String(name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="grid h-30 w-full place-items-center rounded-sm border border-rule bg-accent-tint text-lg font-bold text-accent"
      aria-hidden="true"
      data-placeholder
    >
      <span>{initial}</span>
    </div>
  );
}

/** The record only carries ids: the photo fills in once loaded, or the initial stands in. */
function Thumb({ survey }) {
  const id = firstPhoto(survey);
  const { ready, records } = useMediaRecords(id ? [id] : []);
  if (!id || (ready && !records.length)) return <PhotoPlaceholder name={survey.kos.name} />;
  return <img className="h-30 w-full rounded-sm object-cover" src={records[0]?.url} alt={survey.kos.name} loading="lazy" />;
}

const STATUS_ICONS = { [STATUS.DRAFT]: CircleDashed, [STATUS.PUBLISHED]: CircleCheck };

/** The status word stays as the icon's name and tooltip. */
export function StatusBadge({ status }) {
  const label = statusLabel(status);
  const Icon = STATUS_ICONS[status];
  return (
    <span
      className={cx('relative z-1 inline-flex', status === STATUS.PUBLISHED ? 'text-accent' : 'text-muted')}
      data-status={status}
      role="img"
      aria-label={label}
      title={label}
    >
      {Icon && <Icon {...ICON} />}
    </span>
  );
}

function Fact({ label, value, className = '' }) {
  return (
    <div className={className}>
      <span className={cx('block truncate text-muted', narrowLabel)} title={label}>
        {label}
      </span>
      <span className="mt-1 block text-base font-semibold tabular-nums lining-nums">{value}</span>
    </div>
  );
}

const small = { variant: 'secondary', size: 'small' };

/** Cards in a row share a height, with their actions pinned to the bottom. */
export function SurveyCard({ survey, variant = 'own', starred = false, inCompare = false, liked = false, likes = 0 }) {
  const community = variant === 'community';
  const href = community ? `#/community/${survey.id}` : `#/surveys/${survey.id}`;

  return (
    <article
      className={cx(
        'relative flex h-full flex-col gap-3 rounded-md border border-rule bg-surface p-3 transition-[border-color]',
        'hover:border-muted focus-within:border-accent',
      )}
    >
      <Thumb survey={survey} />
      <div className="flex flex-1 flex-col gap-2 px-1 pb-1">
        <h2 className="line-clamp-2 text-md leading-snug font-semibold">
          {/* The whole card clicks through the title, without nesting controls inside a link. */}
          <a
            className="text-inherit no-underline after:absolute after:inset-0 after:rounded-md hover:underline active:text-inherit active:underline"
            href={href}
          >
            {survey.kos.name}
          </a>
        </h2>
        <div className="flex min-h-5 items-center justify-between gap-3">
          {/* The location only: a community card does not name who shared it. */}
          <span className={meta}>{survey.kos.kosLocation?.label}</span>
          {community ? <span className={meta}>{kosTypeLabel(survey.kos.type)}</span> : <StatusBadge status={survey.status} />}
        </div>
        <div className="mt-2 flex gap-6 border-t border-rule pt-3">
          <Fact label={t('Rent')} value={numberToCurrency(survey.kos.rent)} />
          <Fact
            className="min-w-0 flex-1"
            label={campusName(survey.kos) ? t('To {campus}', { campus: campusName(survey.kos) }) : t('To campus')}
            value={formatKosDistance(survey.kos)}
          />
        </div>
        <div className="relative z-1 mt-auto flex flex-wrap gap-2 pt-4 pointer-coarse:gap-3">
          <a className={button(small)} href={href}>
            {t('View')}
          </a>
          {community ? (
            <>
              <button className={button(small)} type="button" onClick={() => toggleCompare(survey.id, { go: community })}>
                {inCompare ? t('In comparison') : t('Add to compare')}
              </button>
              <StarButton survey={survey} starred={starred} small className="ml-auto" />
              <LikeButton survey={survey} liked={liked} count={likes} small />
            </>
          ) : (
            <>
              <EditLink survey={survey} small className="ml-auto" />
              <DeleteButton survey={survey} small />
            </>
          )}
        </div>
      </div>
    </article>
  );
}
