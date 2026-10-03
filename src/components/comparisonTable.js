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

/**
 * The comparison itself: never scored, never truncated.
 *
 * The prototype joined facilities into a comma list and cut it with
 * `.slice(0, 5)`, so a reader could not tell whether "AC" was absent or
 * merely hidden. Every facility gets its own row with an explicit mark.
 *
 * Explicit ARIA roles are set because the narrow layout turns the table into
 * blocks, which would otherwise strip the roles a browser derives from table
 * elements.
 */

const MISSING = Symbol('missing');

/**
 * `prose` marks a value written by the user as sentences rather than a
 * figure — notes. It keeps the writer's line breaks, wraps at any length, and
 * on narrow screens sits under its kos name instead of beside it.
 */
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

/** Index of the lowest finite number, or null when nothing separates them. */
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

  // No Status row (removed at the user's request, 2026-10-03): draft or
  // published describes the record, not the kos, so it never helps choose
  // between them. The survey page and the card still show it.
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

export function rowDiffers(row) {
  // Values are primitives or the MISSING symbol, so identity comparison is
  // enough — "not recorded" never reads as equal to a real value that
  // happens to stringify the same way.
  const [first, ...rest] = row.values;
  return rest.some((value) => value !== first);
}

/**
 * One value. The kos name is repeated inside the cell for the stacked narrow
 * layout, and marked aria-hidden because the column header still provides
 * that association.
 */
function cell(row, value, index, kosName) {
  const label = html`<span class="ledger__cell-label" aria-hidden="true">${kosName}</span>`;

  if (row.kind === 'facility') {
    return value
      ? html`<td class="ledger__check" role="cell">${label}<span class="ledger__cell-value">✓<span class="visually-hidden"> present</span></span></td>`
      : html`<td class="ledger__absent" role="cell">${label}<span class="ledger__cell-value">—<span class="visually-hidden"> not available</span></span></td>`;
  }
  if (value === MISSING) {
    return html`<td role="cell">${label}<span class="ledger__cell-value unrecorded">Not recorded</span></td>`;
  }
  const best = row.best === index ? ' ledger__best' : '';
  const kind = row.prose ? 'ledger__prose' : 'numeric';
  return html`<td class="${kind}${best}" role="cell">${label}<span class="ledger__cell-value">${value}</span></td>`;
}

/**
 * One column set, shared by every table in the comparison. With
 * `table-layout: fixed` the columns take their widths from here rather than
 * from their contents, so "Monthly rent" in the first section and "Laundry"
 * in the fifth sit on exactly the same vertical lines.
 */
function columns(count) {
  return html`<colgroup>
    <col class="ledger__col-criterion" />
    ${Array.from({ length: count }, () => html`<col />`)}
  </colgroup>`;
}

/* Names only. A kos is removed from its chip in the compare bar, or by
   toggling it off in the picker; a Remove here only duplicated the chip's. */
function headerRow(surveys) {
  return html`<tr role="row">
    <th class="ledger__criterion" scope="col" role="columnheader">Criterion</th>
    ${surveys.map(
      (survey, index) => html`<th scope="col" role="columnheader" style="--column: ${index}">
        <span class="ledger__kos">${survey.kos.name}</span>
      </th>`,
    )}
  </tr>`;
}

/**
 * A category as its own card. The heading names the table, so a screen
 * reader announces "Room, table" and heading navigation reaches each
 * category. The column headers are repeated inside every table for assistive
 * technology — each table has to stand on its own — but shown only once, in
 * the card above the first section.
 */
function section(group, index, surveys) {
  const id = `ledger-group-${index}`;
  return html`<section class="ledger-section" aria-labelledby="${id}">
    <h2 class="ledger-section__title" id="${id}">${group.label}</h2>
    <table class="ledger ledger--sectioned" role="table" aria-labelledby="${id}">
      ${columns(surveys.length)}
      <thead class="visually-hidden" role="rowgroup">${headerRow(surveys)}</thead>
      <tbody role="rowgroup">
        ${group.rows.map(
          (row) => html`<tr role="row" data-differs="${rowDiffers(row) ? 'true' : 'false'}">
            <th class="ledger__criterion" scope="row" role="rowheader">${row.label}</th>
            ${row.values.map((value, index) =>
              raw(
                String(cell(row, value, index, surveys[index].kos.name)).replace(
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

export function comparisonTable(surveys) {
  const groups = buildGroups(surveys);

  // One scroller around everything: if the page ever gets narrow enough to
  // scroll sideways, every section moves together and the columns stay lined
  // up, instead of each card scrolling on its own.
  return html`
    <div class="ledger-sections" data-reveal>
      <div class="ledger-section ledger-section--columns">
        <table class="ledger ledger--sectioned" role="table" aria-label="Kos in this comparison">
          ${columns(surveys.length)}
          <thead role="rowgroup">${headerRow(surveys)}</thead>
        </table>
      </div>
      ${groups.map((group, index) => section(group, index, surveys))}
    </div>
  `;
}
