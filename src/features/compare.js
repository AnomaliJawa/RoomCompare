import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { getState, comparableSurveys, selectedForCompare } from '../store.js';
import { nothingSelected, needsOneMore } from '../components/emptyState.js';
import { incompleteDataBanner } from '../components/banner.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  STATUS_LABELS,
  MAX_COMPARE,
  MIN_COMPARE,
  likertLabel,
  kosTypeLabel,
} from '../constants.js';

/**
 * The comparison is never scored and never truncated.
 *
 * The prototype joined facilities into a comma list and cut it with
 * `.slice(0, 5)`, so a reader could not tell whether "AC" was absent or merely
 * hidden. Every facility gets its own row with an explicit present/absent mark.
 */

const MISSING = Symbol('missing');

function textRow(label, values, { best = null } = {}) {
  return { kind: 'text', label, values, best };
}

function facilityRows(all, pick) {
  return all.map((item) => ({
    kind: 'facility',
    label: item,
    values: pick.map((list) => (list ?? []).includes(item)),
    best: null,
  }));
}

/** Index of the lowest finite number, or null when nothing is comparable. */
function lowestIndex(numbers) {
  let best = null;
  numbers.forEach((n, i) => {
    if (!Number.isFinite(n)) return;
    if (best === null || n < numbers[best]) best = i;
  });
  // A "best" only means something when the values actually differ.
  const finite = numbers.filter(Number.isFinite);
  if (finite.length < 2 || new Set(finite).size === 1) return null;
  return best;
}

function buildGroups(surveys) {
  const rents = surveys.map((s) => s.kos.rent ?? NaN);
  const distances = surveys.map((s) => s.kos.distanceKm ?? NaN);

  return [
    {
      label: 'Kos information',
      rows: [
        textRow('Type', surveys.map((s) => kosTypeLabel(s.kos.type) ?? MISSING)),
        textRow('Location', surveys.map((s) => s.kos.kosLocation?.label ?? MISSING)),
        textRow('Monthly rent', surveys.map((s) => (s.kos.rent == null ? MISSING : numberToCurrency(s.kos.rent))), {
          best: lowestIndex(rents),
        }),
        textRow('Distance to campus', surveys.map((s) => (s.kos.distanceKm == null ? MISSING : formatDistance(s.kos.distanceKm))), {
          best: lowestIndex(distances),
        }),
        textRow('Status', surveys.map((s) => STATUS_LABELS[s.status] ?? MISSING)),
      ],
    },
    {
      label: 'Room',
      rows: [
        textRow(
          'Dimensions',
          surveys.map((s) => (s.room.lengthM && s.room.widthM ? `${s.room.lengthM} × ${s.room.widthM} m` : MISSING)),
        ),
        textRow(
          'Floor area',
          surveys.map((s) =>
            s.room.lengthM && s.room.widthM ? `${(s.room.lengthM * s.room.widthM).toFixed(1)} m²` : MISSING,
          ),
        ),
        textRow('Cleanliness', surveys.map((s) => likertLabel(s.room.cleanliness) ?? MISSING)),
        textRow('Internet quality', surveys.map((s) => likertLabel(s.room.internet) ?? MISSING)),
        ...facilityRows(ROOM_FACILITIES, surveys.map((s) => s.room.facilities)),
      ],
    },
    { label: 'Bathroom', rows: facilityRows(BATHROOM_FACILITIES, surveys.map((s) => s.bathroom.facilities)) },
    { label: 'Shared facilities', rows: facilityRows(SHARED_FACILITIES, surveys.map((s) => s.shared.facilities)) },
    { label: 'Surroundings', rows: facilityRows(SURROUNDINGS, surveys.map((s) => s.surroundings)) },
    {
      label: 'Additional information',
      rows: [
        textRow('Security', surveys.map((s) => likertLabel(s.additional.security) ?? MISSING)),
        textRow('Notes', surveys.map((s) => s.additional.notes || MISSING)),
        textRow('Photos recorded', surveys.map((s) => {
          const count =
            (s.room.photoIds?.length ?? 0) +
            (s.bathroom.photoIds?.length ?? 0) +
            (s.shared.photoIds?.length ?? 0);
          return count === 0 ? 'None' : String(count);
        })),
      ],
    },
  ];
}

function rowDiffers(row) {
  // Values are primitives or the MISSING symbol, so identity comparison is
  // enough — no sentinel string, and "not recorded" never reads as equal to
  // a real value that happens to stringify the same way.
  const [first, ...rest] = row.values;
  return rest.some((value) => value !== first);
}

function cell(row, value, index) {
  if (row.kind === 'facility') {
    return value
      ? html`<td class="ledger__check">✓<span class="visually-hidden"> present</span></td>`
      : html`<td class="ledger__absent">—<span class="visually-hidden"> not available</span></td>`;
  }
  if (value === MISSING) {
    return html`<td><span class="unrecorded">Not recorded</span></td>`;
  }
  const best = row.best === index ? ' ledger__best' : '';
  return html`<td class="numeric${best}">${value}</td>`;
}

function ledger(surveys) {
  const groups = buildGroups(surveys);
  return html`
    <div class="ledger-wrap">
      <table class="ledger">
        <thead>
          <tr>
            <th class="ledger__criterion" scope="col">Criterion</th>
            ${raw(
              surveys
                .map(
                  (s) => html`<th scope="col">
                    <span class="ledger__kos">${s.kos.name}</span>
                    <button class="btn btn--quiet btn--small" type="button"
                      data-action="remove-compare" data-id="${s.id}">Remove</button>
                  </th>`,
                )
                .join(''),
            )}
          </tr>
        </thead>
        ${raw(
          groups
            .map(
              (group) => html`<tbody>
                <tr class="ledger__group">
                  <th colspan="${surveys.length + 1}" scope="colgroup">${group.label}</th>
                </tr>
                ${raw(
                  group.rows
                    .map(
                      (row) => html`<tr data-differs="${rowDiffers(row) ? 'true' : 'false'}">
                        <th class="ledger__criterion" scope="row">${row.label}</th>
                        ${raw(row.values.map((v, i) => cell(row, v, i)).join(''))}
                      </tr>`,
                    )
                    .join(''),
                )}
              </tbody>`,
            )
            .join(''),
        )}
      </table>
    </div>
  `;
}

function picker(candidates, selection) {
  if (!candidates.length) {
    return html`<p class="meta">
      Nothing to compare yet. Record a survey, or star a community survey to bring it in.
    </p>`;
  }
  const full = selection.length >= MAX_COMPARE;
  return html`
    <ul class="stack">
      ${raw(
        candidates
          .map((survey) => {
            const picked = selection.includes(survey.id);
            return html`<li class="listing">
              <div>
                <span class="listing__title">${survey.kos.name}</span>
                <p class="meta">${survey.kos.kosLocation?.label} · ${numberToCurrency(survey.kos.rent)}</p>
              </div>
              <button
                class="btn ${picked ? 'btn--primary' : 'btn--secondary'} btn--small"
                type="button"
                data-action="toggle-compare"
                data-id="${survey.id}"
                ${!picked && full ? 'disabled' : ''}
              >${picked ? 'Selected' : full ? 'Maximum of 3' : 'Add'}</button>
            </li>`;
          })
          .join(''),
      )}
    </ul>
  `;
}

export function renderCompare() {
  const { compareSelection } = getState();
  const candidates = comparableSurveys();
  const selected = selectedForCompare();

  let result;
  if (selected.length === 0) {
    result = nothingSelected();
  } else if (selected.length < MIN_COMPARE) {
    result = needsOneMore(selected[0].kos.name);
  } else {
    const incomplete = selected.filter((s) => s.room.internet == null || s.additional.security == null);
    const notice = incomplete.length ? incompleteDataBanner(incomplete.map((s) => s.kos.name)) : '';
    result = html`${notice}${ledger(selected)}`;
  }

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>Compare kos</h1>
        <p class="page-head__lede">
          The same criteria for every kos, in the same order. Nothing is scored
          and nothing is hidden — the decision stays yours.
        </p>
      </div>
    </div>

    <div class="compare-layout">
      <section class="panel">
        <div class="section__head">
          <h2>Add kos</h2>
          <span class="meta">${compareSelection.length} of ${MAX_COMPARE}</span>
        </div>
        ${picker(candidates, compareSelection)}
      </section>

      <div class="compare-result">${result}</div>
    </div>
  `;
}
