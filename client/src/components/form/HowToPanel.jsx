import { FIELD_GUIDE, PANEL_PARTS, RUBRICS } from '../../content/guidance.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import { button, cx, narrowLabel } from '../ui/styles.js';

/** One dialog serves every field's ⓘ: a sheet on phones, placed beside the ⓘ elsewhere. */

const NARROW = '(max-width: 640px)';
const GAP = 8; // between the ⓘ and the panel: 2 steps of the spacing scale
const MARGIN = 16; // kept clear of the window's edges: 4 steps
const MIN_ROOM = 160; // the least height worth scrolling through: head and a part

/** Below or above the ⓘ, whichever fits, scrolling inside rather than covering it. */
export function placeHowTo(node, trigger) {
  node.style.top = '';
  node.style.left = '';
  node.style.maxHeight = '';
  if (!trigger || window.matchMedia?.(NARROW).matches) return;

  const anchor = trigger.getBoundingClientRect();
  const below = window.innerHeight - MARGIN - (anchor.bottom + GAP);
  const above = anchor.top - GAP - MARGIN;
  // Layout size, not the drawn box: the arrival animation still has it scaled down.
  let panel = node.offsetHeight;

  let top;
  if (panel <= below) {
    top = anchor.bottom + GAP;
  } else if (panel <= above) {
    top = anchor.top - GAP - panel;
  } else {
    const room = Math.max(below, above, MIN_ROOM);
    node.style.maxHeight = `${Math.floor(room)}px`;
    panel = Math.min(panel, room);
    top = below >= above ? anchor.bottom + GAP : anchor.top - GAP - panel;
  }
  const left = Math.min(anchor.left, window.innerWidth - MARGIN - node.offsetWidth);

  node.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
  node.style.left = `${Math.round(Math.max(MARGIN, left))}px`;
}

const heading = cx(narrowLabel, 'mb-1 text-muted');

function Part({ title, children }) {
  return (
    <section>
      <h3 className={heading}>{title}</h3>
      {children}
    </section>
  );
}

function Scores({ levels }) {
  return (
    <Part title="Scores">
      <dl className="m-0 flex flex-col gap-2">
        {levels.map((level) => (
          <div key={level.score} data-score>
            <dt className="font-semibold">
              {level.score} {level.label}
            </dt>
            <dd className="m-0">
              {level.text}
              {level.benchmark && (
                <span className="block text-xs text-muted tabular-nums lining-nums" data-benchmark>
                  Average Download {level.benchmark}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Part>
  );
}

export function HowToContent({ guideKey }) {
  const close = useCloseModal();
  const guide = FIELD_GUIDE[guideKey];
  if (!guide?.panel) return null;

  const parts = [];
  for (const [name, title] of PANEL_PARTS) {
    if (name === 'example' && RUBRICS[guideKey]) parts.push(<Scores key="scores" levels={RUBRICS[guideKey]} />);
    if (name === 'example' && guide.photos) {
      parts.push(
        <Part key="shots" title="Suggested shots">
          <ul className="m-0 list-disc pl-6">
            {guide.photos.map((shot) => (
              <li key={shot}>{shot}</li>
            ))}
          </ul>
        </Part>,
      );
    }
    if (guide.panel[name]) {
      parts.push(
        <Part key={name} title={title}>
          <p>{guide.panel[name]}</p>
        </Part>,
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-col" data-guide={guideKey}>
      <div className="howto-head flex items-center justify-between gap-3 border-b border-rule px-4 py-3 max-lg:touch-none">
        <h2 className="text-base font-semibold" id="howto-title">
          How to fill {guide.label}
        </h2>
        <button className={button({ variant: 'quiet', size: 'small' })} type="button" onClick={close}>
          Close
        </button>
      </div>
      {/* The sheet's own close button clears the home indicator. */}
      <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-4 max-lg:pb-[max(1rem,env(safe-area-inset-bottom))]">
        {parts}
      </div>
    </div>
  );
}

/** `open`: { key, trigger } for the ⓘ pressed, or null. Focus returns to that ⓘ: Safari does not focus a clicked button. */
export function HowToPanel({ open, onClose }) {
  return (
    <Modal
      open={Boolean(open)}
      kind="howto"
      sheetHandle=".howto-head"
      closeOnBackdrop
      aria-labelledby="howto-title"
      onOpened={(dialog) => placeHowTo(dialog, open?.trigger)}
      onClose={() => {
        const trigger = open?.trigger;
        onClose();
        if (trigger?.isConnected) trigger.focus();
      }}
    >
      {open && <HowToContent key={open.key} guideKey={open.key} />}
    </Modal>
  );
}
