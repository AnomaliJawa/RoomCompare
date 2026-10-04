import { CircleHelp } from 'lucide-react';
import { SURVEY_GUIDE } from '../../content/guidance.js';
import { Modal, useCloseModal } from '../ui/Modal.jsx';
import { button, cx, dialogBody, dialogFoot, dialogFrame, dialogHead, dialogTitle, sheetFoot } from '../ui/styles.js';
import { iconButton } from './fields.jsx';

/** Opens by itself on the first new survey on this device, and from the ? beside the title. */

const SEEN_KEY = 'roomcompare:survey-guide-seen';

// Where storage is blocked, the guide still shows only once per visit.
let seenThisVisit = false;

function seen() {
  if (seenThisVisit) return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === 'true';
  } catch {
    return false;
  }
}

/** True the first time on this device, and remembers that it was. */
export function firstSurveyGuide() {
  if (seen()) return false;
  seenThisVisit = true;
  try {
    window.localStorage.setItem(SEEN_KEY, 'true');
  } catch {
    // Blocked storage: this visit's flag above still holds.
  }
  return true;
}

export function SurveyGuideButton({ onOpen, buttonRef }) {
  return (
    <button ref={buttonRef} className={iconButton} type="button" aria-label={SURVEY_GUIDE.title} aria-haspopup="dialog" onClick={onOpen}>
      <CircleHelp size={24} strokeWidth={1.75} absoluteStrokeWidth className="block" />
    </button>
  );
}

function GuideContent() {
  const close = useCloseModal();
  const list = 'mt-2 pl-6 [&>li+li]:mt-1';
  return (
    <div className={dialogFrame}>
      <div className={cx(dialogHead, 'guide-head')}>
        <h2 className={dialogTitle} id="survey-guide-title">
          {SURVEY_GUIDE.title}
        </h2>
        <button className={button({ variant: 'quiet', size: 'small' })} type="button" onClick={close}>
          Close
        </button>
      </div>
      <div className={dialogBody}>
        {SURVEY_GUIDE.sections.map((section) => (
          <section key={section.heading} data-guide-section>
            <h3 className="text-base font-semibold">{section.heading}</h3>
            {section.ordered ? (
              <ol className={cx(list, 'list-decimal')}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul className={cx(list, 'list-disc')}>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <div className={cx(dialogFoot, sheetFoot)}>
        <button className={button({ variant: 'primary' })} type="button" onClick={close}>
          Got it
        </button>
      </div>
    </div>
  );
}

/** `returnFocus`: the ? that opened it, if any. */
export function SurveyGuide({ open, onClose, returnFocus }) {
  return (
    <Modal
      open={open}
      kind="guide"
      sheetHandle=".guide-head"
      aria-labelledby="survey-guide-title"
      onClose={() => {
        onClose();
        if (returnFocus?.current?.isConnected) returnFocus.current.focus();
      }}
    >
      <GuideContent />
    </Modal>
  );
}
