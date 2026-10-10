import { MAX_COMPARE, MIN_COMPARE } from '../../constants.js';
import * as store from '../../data/store.js';
import { toggleCompare } from '../../actions/surveys.js';
import { useStore } from '../../hooks/useStore.js';
import { formatKosDistance, numberToCurrency } from '../../utils/format.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import {
  button,
  cx,
  dialogBody,
  dialogFoot,
  dialogFrame,
  dialogHead,
  dialogTitle,
  meta,
  narrowLabel,
  sheetFoot,
} from '../ui/styles.js';

/** Own published surveys and every community survey; drafts are left out and counted. */

const small = (variant) => button({ variant, size: 'small' });

function AddButton({ survey, selection }) {
  const picked = selection.includes(survey.id);
  const blocked = !picked && selection.length >= MAX_COMPARE;
  return (
    <button
      className={small(picked ? 'primary' : 'secondary')}
      type="button"
      data-id={survey.id}
      disabled={blocked}
      onClick={() => toggleCompare(survey.id)}
    >
      {picked ? 'Selected' : blocked ? `Maximum of ${MAX_COMPARE}` : 'Add'}
    </button>
  );
}

/** Changing a kos swaps it in its slot, so the others keep their places. */
function ChangeButton({ survey, selection, replacing, onReplace }) {
  if (survey.id === replacing.id) {
    return (
      <button className={small('primary')} type="button" data-id={survey.id} disabled>
        Current
      </button>
    );
  }
  if (selection.includes(survey.id)) {
    return (
      <button className={small('secondary')} type="button" data-id={survey.id} disabled>
        Selected
      </button>
    );
  }
  return (
    <button className={small('secondary')} type="button" data-id={survey.id} onClick={() => onReplace(survey.id)}>
      Choose
    </button>
  );
}

function CandidateList({ candidates, selection, replacing, onReplace }) {
  return (
    <ul className="flex flex-col gap-3">
      {candidates.map((survey) => (
        <li
          key={survey.id}
          className="flex items-center justify-between gap-4 border-b border-rule pb-3 tabular-nums lining-nums last:border-b-0 last:pb-0"
        >
          <div>
            <span className="font-semibold text-ink" data-candidate>
              {survey.kos.name}
            </span>
            <p className={meta}>
              {survey.kos.kosLocation?.label ?? 'Location not recorded'} · {numberToCurrency(survey.kos.rent)} ·{' '}
              {formatKosDistance(survey.kos)}
            </p>
          </div>
          {replacing ? (
            <ChangeButton survey={survey} selection={selection} replacing={replacing} onReplace={onReplace} />
          ) : (
            <AddButton survey={survey} selection={selection} />
          )}
        </li>
      ))}
    </ul>
  );
}

function Group({ id, title, candidates, empty, note = null, ...list }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h3 className={cx(narrowLabel, 'text-muted')} id={id}>
        {title}
      </h3>
      {candidates.length ? (
        <>
          {note}
          <CandidateList candidates={candidates} {...list} />
        </>
      ) : (
        empty
      )}
    </section>
  );
}

const draftCount = (drafts) => (drafts === 1 ? 'One draft isn’t' : `${drafts} drafts aren’t`);

/** Both links leave the Compare page, so they close the dialog too. */
function OwnEmpty({ drafts }) {
  const close = useCloseModal();
  const [text, label, href] = drafts
    ? [`${draftCount(drafts)} listed: only published surveys can be compared.`, 'Go to my surveys', '#/surveys']
    : ['You have not recorded a kos yet.', 'Add survey', '#/surveys/new'];
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className={meta}>{text}</p>
      <a className={small('secondary')} href={href} onClick={close}>
        {label}
      </a>
    </div>
  );
}

/** `replacing`: the kos a filled slot was opened for; the picker then changes or removes it. */
export function PickerContent({ candidates, selection, replacing = null, onReplace = () => {}, onRemove = () => {} }) {
  const close = useCloseModal();
  const { own, community, drafts = 0 } = candidates;
  const list = { selection, replacing, onReplace };

  return (
    <div className={dialogFrame}>
      <div className={cx(dialogHead, 'picker-head')}>
        <h2 className={dialogTitle} id="picker-dialog-title">
          {replacing ? 'Change kos' : 'Add kos'}
        </h2>
        <button className={small('quiet')} type="button" onClick={close}>
          Close
        </button>
      </div>

      <div className={dialogBody} data-picker-body>
        <p className={meta} data-picker-intro>
          {replacing
            ? `Choose a kos to compare in place of ${replacing.kos.name}, or remove it.`
            : `Your published surveys and the community’s. Up to ${MAX_COMPARE} at once.`}
        </p>
        <Group
          id="picker-own"
          title="My surveys"
          candidates={own}
          note={drafts ? <p className={meta}>{draftCount(drafts)} listed. Publish a survey to compare it.</p> : null}
          empty={<OwnEmpty drafts={drafts} />}
          {...list}
        />
        <Group
          id="picker-community"
          title="Community"
          candidates={community}
          empty={<p className={meta}>No community surveys to show right now.</p>}
          {...list}
        />
      </div>

      {replacing ? (
        <div className={cx(dialogFoot, sheetFoot)}>
          <button className={button({ variant: 'danger' })} type="button" onClick={() => onRemove(replacing.id)}>
            Remove {replacing.kos.name}
          </button>
          <button className={button({ variant: 'secondary' })} type="button" onClick={close}>
            Cancel
          </button>
        </div>
      ) : (
        <div className={cx(dialogFoot, sheetFoot)}>
          <p className={meta} role="status" aria-live="polite">
            {selection.length} of {MAX_COMPARE} selected
            {selection.length < MIN_COMPARE ? `, ${MIN_COMPARE - selection.length} more to compare` : ''}.
          </p>
          {/* Compare, not Done: closing and then pressing Compare in the bar was two steps for one intent. */}
          <button
            className={button({ variant: 'primary' })}
            type="button"
            disabled={selection.length < MIN_COMPARE}
            title={selection.length < MIN_COMPARE ? 'Select at least two kos' : undefined}
            onClick={() => {
              store.showComparison();
              close();
            }}
          >
            Compare
          </button>
        </div>
      )}
    </div>
  );
}

/** Opened from a compare bar slot: an empty one adds, a filled one changes its kos. */
export function CandidatePicker({ open, replacingId, onClose }) {
  const { compareSelection } = useStore();
  const replacing = replacingId && compareSelection.includes(replacingId) ? store.findSurvey(replacingId) : null;

  const replace = (id) => {
    if (store.replaceInCompare(replacingId, id)) onClose();
  };
  const remove = (id) => {
    store.removeFromCompare(id);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} kind="picker" sheetHandle=".picker-head" aria-labelledby="picker-dialog-title">
      <PickerContent
        candidates={store.compareCandidates()}
        selection={compareSelection}
        replacing={replacing}
        onReplace={replace}
        onRemove={remove}
      />
    </Modal>
  );
}
