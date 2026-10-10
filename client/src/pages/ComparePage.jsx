import { useRef, useState } from 'react';
import { MIN_COMPARE } from '../constants.js';
import * as store from '../data/store.js';
import { clearCompare } from '../actions/compare.js';
import { requireAccount } from '../actions/account.js';
import { useStore } from '../hooks/useStore.js';
import { CompareBar } from '../components/compare/CompareBar.jsx';
import { CandidatePicker } from '../components/compare/CandidatePicker.jsx';
import { ComparisonTable } from '../components/compare/ComparisonTable.jsx';
// Best Match feeds the panel under the table and the score section atop it (the user's request).
import { BestMatchPanel, bestMatchScores } from '../components/compare/BestMatchPanel.jsx';
import { IncompleteDataBanner } from '../components/ui/Banner.jsx';
import { EmptyState, GuestCompare, NeedsOneMore, NothingSelected } from '../components/ui/EmptyState.jsx';
import { PageHead } from '../components/ui/PageHead.jsx';
import { button } from '../components/ui/styles.js';
import { msg, t } from '../i18n/index.js';

function Result({ selected, shown }) {
  if (selected.length < MIN_COMPARE) {
    return selected.length === 0 ? <NothingSelected /> : <NeedsOneMore name={selected[0].kos.name} />;
  }
  if (!shown) {
    return (
      <EmptyState
        title={msg('Ready when you are')}
        body={t('{count} kos selected. Compare them on the same criteria, in the same order, with nothing left out.', { count: selected.length })}
      >
        <button className={button({ variant: 'primary' })} type="button" onClick={() => store.showComparison()}>
          {t('Compare {count} kos', { count: selected.length })}
        </button>
      </EmptyState>
    );
  }
  const incomplete = selected.filter((s) => s.room.internet == null || s.additional.security == null);
  return (
    <>
      {incomplete.length > 0 && <IncompleteDataBanner names={incomplete.map((s) => s.kos.name)} />}
      <ComparisonTable surveys={selected} scores={bestMatchScores(selected)} />
      <BestMatchPanel surveys={selected} />
    </>
  );
}

export function ComparePage() {
  const { compareShown, user } = useStore();
  const selected = store.selectedForCompare();
  const [picker, setPicker] = useState({ open: false, replacing: null, slot: 0 });
  const bar = useRef(null);

  const focusSlot = (slot) => bar.current?.querySelector(`[data-slot="${slot}"]`)?.focus();

  // The slot it was opened from gets focus back, whatever now fills it.
  const closePicker = () => {
    setPicker((now) => ({ ...now, open: false }));
    focusSlot(picker.slot);
  };

  const startOver = () => {
    clearCompare();
    // Start over is gone with the table, so focus moves to the first slot.
    requestAnimationFrame(() => focusSlot(0));
  };

  return (
    <>
      <PageHead
        title={t('Compare kos')}
        lede={t('The same criteria for every kos, in the same order. Nothing is hidden, and the decision stays yours.')}
      />

      {/* A guest sees the empty slots, and is asked to log in on picking one. */}
      <CompareBar
        barRef={bar}
        selected={selected}
        shown={compareShown}
        onAdd={(slot) => (user ? setPicker({ open: true, replacing: null, slot }) : requireAccount(msg('Log in to compare kos.')))}
        onChange={(id, slot) => setPicker({ open: true, replacing: id, slot })}
        onCompare={() => store.showComparison()}
        onStartOver={startOver}
      />

      <div data-compare-result>{user ? <Result selected={selected} shown={compareShown} /> : <GuestCompare />}</div>

      {user && <CandidatePicker open={picker.open} replacingId={picker.replacing} onClose={closePicker} />}
    </>
  );
}
