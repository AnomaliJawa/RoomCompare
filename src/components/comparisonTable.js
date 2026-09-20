import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import {
  ROOM_FACILITIES,
  BATHROOM_FACILITIES,
  SHARED_FACILITIES,
  SURROUNDINGS,
  STATUS_LABELS,
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
          surveys.map((s) => (s.kos.distanceKm == null ? MISSING : formatDistance(s.kos.distanceKm))),
          { best: lowestIndex(distances) },
        ),
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
  return html`<td class="numeric${best}" role="cell">${label}<span class="ledger__cell-value">${value}</span></td>`;
}

export function comparisonTable(surveys) {
  const groups = buildGroups(surveys);

  return html`
    <div class="ledger-wrap">
      <table class="ledger" role="table" data-reveal>
        <thead role="rowgroup">
          <tr role="row">
            <th class="ledger__criterion" scope="col" role="columnheader">Criterion</th>
            ${surveys.map(
              (survey, index) => html`<th scope="col" role="columnheader" style="--column: ${index}">
                <span class="ledger__kos">${survey.kos.name}</span>
                <button
                  class="btn btn--quiet btn--small"
                  type="button"
                  data-action="remove-compare"
                  data-id="${survey.id}"
                >Remove</button>
              </th>`,
            )}
          </tr>
        </thead>
        ${groups.map(
          (group) => html`<tbody role="rowgroup">
            <tr class="ledger__group" role="row">
              <th colspan="${surveys.length + 1}" scope="colgroup" role="columnheader">${group.label}</th>
            </tr>
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
          </tbody>`,
        )}
      </table>
    </div>
  `;
}
