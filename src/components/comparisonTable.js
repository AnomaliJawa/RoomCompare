import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  likertLabel,
  kosTypeLabel,
} from '../constants.js';

/** Never truncated: every facility row gets an explicit ✓ or —. */

const MISSING = Symbol('missing');

/** prose: notes keep their line breaks and sit under the kos name on narrow screens. */
function textRow(label, values, { best = null, prose = false } = {}) {
  return { kind: 'text', label, values, best, prose };
}

function facilityRows(all, pick) {
  return all.map((item) => ({
    kind: 'facility',
    label: item,
    values: pick.map((list) => (list ?? []).includes(item)),
    best: null,
  }));
}

function lowestIndex(numbers) {
  let best = null;
  numbers.forEach((n, i) => {
    if (!Number.isFinite(n)) return;
    if (best === null || n < numbers[best]) best = i;
  });
  const finite = numbers.filter(Number.isFinite);
  if (finite.length < 2 || new Set(finite).size === 1) return null;
  return best;
}

export function buildGroups(surveys) {
  const rents = surveys.map((s) => s.kos.rent ?? NaN);
  const distances = surveys.map((s) => s.kos.distanceKm ?? NaN);

  // No Status row: draft or published describes the record, not the kos.
  return [
    {
      label: 'Kos information',
      rows: [
        textRow('Type', surveys.map((s) => kosTypeLabel(s.kos.type) ?? MISSING)),
        textRow('Location', surveys.map((s) => s.kos.kosLocation?.label ?? MISSING)),
        textRow('Monthly rent', surveys.map((s) => (s.kos.rent == null ? MISSING : numberToCurrency(s.kos.rent))), {
          best: lowestIndex(rents),
        }),
        textRow(
          'Distance to campus',
          surveys.map((s) => (s.kos.distanceKm == null ? MISSING : formatKosDistance(s.kos))),
          { best: lowestIndex(distances) },
        ),
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
        textRow('Notes', surveys.map((s) => s.additional.notes || MISSING), { prose: true }),
        textRow(
          'Photos recorded',
          surveys.map((s) => {
            const count =
              (s.room.photoIds?.length ?? 0) +
              (s.bathroom.photoIds?.length ?? 0) +
              (s.shared.photoIds?.length ?? 0);
            return count === 0 ? 'None' : String(count);
          }),
        ),
      ],
    },
  ];
}

/** Leads the comparison when scores are passed; the panel under it shows how each total is reached. */
function scoreGroup(scores) {
  return {
    label: 'Best Match score',
    rows: [{ kind: 'score', label: 'Score', values: scores.map((score) => score.total), scores, best: null }],
  };
}

export function rowDiffers(row) {
  // Identity comparison, so "not recorded" never equals a value that stringifies alike.
  const [first, ...rest] = row.values;
  return rest.some((value) => value !== first);
}

/** The kos name repeats in each cell for the stacked layout; aria-hidden, as the header names it. */
function cell(row, value, index, kosName) {
  const label = html`<span class="ledger__cell-label" aria-hidden="true">${kosName}</span>`;

  if (row.kind === 'facility') {
    return value
      ? html`<td class="ledger__check" role="cell">${label}<span class="ledger__cell-value">✓<span class="visually-hidden"> present</span></span></td>`
      : html`<td class="ledger__absent" role="cell">${label}<span class="ledger__cell-value">—<span class="visually-hidden"> not available</span></span></td>`;
  }
  if (row.kind === 'score') {
    const score = row.scores[index];
    if (score.total === null) {
      return html`<td role="cell">${label}<span class="ledger__cell-value unrecorded">Score unavailable — ${score.missing} not recorded</span></td>`;
    }
    return html`<td class="numeric${score.leader ? ' ledger__best' : ''}" role="cell">${label}<span class="ledger__cell-value">${score.total}</span></td>`;
  }
  if (value === MISSING) {
    return html`<td role="cell">${label}<span class="ledger__cell-value unrecorded">Not recorded</span></td>`;
  }
  const best = row.best === index ? ' ledger__best' : '';
  const kind = row.prose ? 'ledger__prose' : 'numeric';
  return html`<td class="${kind}${best}" role="cell">${label}<span class="ledger__cell-value">${value}</span></td>`;
}

/** One column set for every table, so the columns line up across sections. */
function columns(count) {
  return html`<colgroup>
    <col class="ledger__col-criterion" />
    ${Array.from({ length: count }, () => html`<col />`)}
  </colgroup>`;
}

// Names only: a kos is removed from its chip or the picker, never from the table.
function headerRow(names) {
  return html`<tr role="row">
    <th class="ledger__criterion" scope="col" role="columnheader">Criterion</th>
    ${names.map(
      (name, index) => html`<th scope="col" role="columnheader" style="--column: ${index}">
        <span class="ledger__kos">${name}</span>
      </th>`,
    )}
  </tr>`;
}

/** Each table repeats its column headers for assistive technology; they show once, above. */
function section(group, index, names) {
  const id = `ledger-group-${index}`;
  return html`<section class="ledger-section" aria-labelledby="${id}">
    <h2 class="ledger-section__title" id="${id}">${group.label}</h2>
    <table class="ledger ledger--sectioned" role="table" aria-labelledby="${id}">
      ${columns(names.length)}
      <thead class="visually-hidden" role="rowgroup">${headerRow(names)}</thead>
      <tbody role="rowgroup">
        ${group.rows.map(
          (row) => html`<tr role="row" data-differs="${rowDiffers(row) ? 'true' : 'false'}">
            <th class="ledger__criterion" scope="row" role="rowheader">${row.label}</th>
            ${row.values.map((value, index) =>
              raw(
                String(cell(row, value, index, names[index])).replace(
                  '<td',
                  `<td style="--column: ${index}"`,
                ),
              ),
            )}
          </tr>`,
        )}
      </tbody>
    </table>
  </section>`;
}

/** `scores`: each kos's Best Match `{ total, leader, missing }`; omitted, no score section. */
export function comparisonTable(surveys, { scores = null } = {}) {
  const groups = [...(scores ? [scoreGroup(scores)] : []), ...buildGroups(surveys)];
  const names = surveys.map((s) => s.kos.name);

  // One scroller for every section, so the columns stay lined up when it scrolls.
  return html`
    <div class="ledger-sections" data-reveal>
      <div class="ledger-section ledger-section--columns">
        <table class="ledger ledger--sectioned" role="table" aria-label="Kos in this comparison">
          ${columns(names.length)}
          <thead role="rowgroup">${headerRow(names)}</thead>
        </table>
      </div>
      ${groups.map((group, index) => section(group, index, names))}
    </div>
  `;
}
