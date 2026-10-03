import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { BEST_MATCH_CRITERIA, TOTAL_FACILITY_COUNT, SURROUNDINGS } from '../constants.js';
import { DEFAULT_WEIGHTS, isDefault } from '../utils/weights.js';
import { bestMatchWeights } from '../store.js';

/** Imports nothing from the comparison; compare.js passes its totals to the table. */

/** 1 is the floor, so (v-1)/3: a "Poor" rating must not read as a quarter mark. */
function fromLikert(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 4) return null;
  return ((n - 1) / 3) * 100;
}

/** 100 for the best value; when every kos matches, none is worse. */
function relative(values, index, { lowerIsBetter }) {
  if (!Number.isFinite(values[index])) return null;

  // Only recorded values take part, so a missing one cannot drag the others down.
  const present = values.filter((value) => Number.isFinite(value));

  const min = Math.min(...present);
  const max = Math.max(...present);
  if (min === max) return 100;

  const position = (values[index] - min) / (max - min);
  return (lowerIsBetter ? 1 - position : position) * 100;
}

function facilityScore(survey) {
  const count =
    (survey.room.facilities?.length ?? 0) +
    (survey.bathroom.facilities?.length ?? 0) +
    (survey.shared.facilities?.length ?? 0);
  return (count / TOTAL_FACILITY_COUNT) * 100;
}

/** Location reads as surroundings recorded out of 7: the requirement names no field (unconfirmed). */
function locationScore(survey) {
  return ((survey.surroundings?.length ?? 0) / SURROUNDINGS.length) * 100;
}

const MISSING_LABELS = {
  price: 'monthly rent',
  cleanliness: 'cleanliness',
  security: 'security',
  distance: 'distance to campus',
};

/** A kos missing any weighted input gets no total; a criterion at 0% needs no data. */
export function computeBestMatch(surveys, weights = DEFAULT_WEIGHTS) {
  const counted = BEST_MATCH_CRITERIA.filter((criterion) => weights[criterion.key] > 0);
  const rents = surveys.map((survey) => survey.kos.rent ?? NaN);
  const distances = surveys.map((survey) => survey.kos.distanceKm ?? NaN);

  const scored = surveys.map((survey, index) => {
    const parts = {
      price: relative(rents, index, { lowerIsBetter: true }),
      facilities: facilityScore(survey),
      cleanliness: fromLikert(survey.room.cleanliness),
      location: locationScore(survey),
      distance: relative(distances, index, { lowerIsBetter: true }),
      security: fromLikert(survey.additional.security),
    };

    const missing = counted
      .filter((criterion) => parts[criterion.key] === null)
      .map((criterion) => MISSING_LABELS[criterion.key] ?? criterion.key);

    // Divided once, at the end: the weights are percentages.
    const total = missing.length
      ? null
      : Math.round(counted.reduce((sum, criterion) => sum + parts[criterion.key] * weights[criterion.key], 0) / 100);

    return { survey, parts, missing, total };
  });

  // Ties are shown as ties; picking a winner would invent a distinction.
  const best = scored.reduce((highest, item) => {
    if (item.total === null) return highest;
    return highest === null || item.total > highest ? item.total : highest;
  }, null);

  return {
    scored,
    best,
    leaders: best === null ? [] : scored.filter((item) => item.total === best).map((item) => item.survey.id),
  };
}

const joinList = (items) =>
  items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** For the comparison: each kos's total (null where an input is missing), whether it leads, and what is missing. */
export function bestMatchScores(surveys, weights = bestMatchWeights()) {
  const { scored, leaders } = computeBestMatch(surveys, weights);
  return scored.map((item) => ({
    total: item.total,
    leader: leaders.includes(item.survey.id),
    missing: item.missing.length ? joinList(item.missing) : null,
  }));
}

/** Names each figure on narrow screens; aria-hidden, as the column header names the cell. */
function cellLabel(name) {
  return html`<span class="ledger__cell-label" aria-hidden="true"><span class="bestmatch__cell-name">${name}</span>:</span>`;
}

function partCell(value, kosName) {
  if (value === null) {
    return html`<td role="cell">${cellLabel(kosName)}<span class="ledger__cell-value unrecorded">—</span></td>`;
  }
  return html`<td class="numeric" role="cell">${cellLabel(kosName)}<span class="ledger__cell-value">${Math.round(value)}</span></td>`;
}

function scoreRow(item, leaders) {
  if (item.total === null) {
    return html`<span class="unrecorded">Score unavailable — ${joinList(item.missing)} not recorded</span>`;
  }
  const isLeader = leaders.includes(item.survey.id);
  return html`<span class="bestmatch__score${isLeader ? ' bestmatch__score--leader' : ''}">
    ${item.total}${isLeader ? html`<span class="bestmatch__flag">Best match</span>` : ''}
  </span>`;
}

/** data-keep-open: refresh() reopens the panel after saving weights rebuilds the view. */
export function bestMatchPanel(surveys, weights = bestMatchWeights()) {
  const { scored, leaders } = computeBestMatch(surveys, weights);
  const tied = leaders.length > 1;

  return html`
    <details class="bestmatch" data-keep-open="bestmatch">
      <summary class="bestmatch__summary">
        <span class="bestmatch__summary-title">Optional: weighted score</span>
        <span class="meta">A guide, not a recommendation. The decision stays yours.</span>
      </summary>

      <div class="bestmatch__body">
        <div class="bestmatch__intro">
          <p class="bestmatch__note meta">
            Scores are relative to these ${surveys.length} kos, not to kos in general:
            the cheapest of three is not necessarily cheap.
            ${isDefault(weights) ? 'The weights are the defaults.' : 'The weights are your own.'}
            ${tied ? ' Two kos scored the same, so both are marked.' : ''}
          </p>
          <button class="btn btn--secondary btn--small" type="button" data-action="open-criteria" aria-haspopup="dialog">
            Edit criteria
          </button>
        </div>

        <ul class="bestmatch__results">
          ${scored.map(
            (item) => html`<li class="bestmatch__result">
              <span class="bestmatch__kos">${item.survey.kos.name}</span>
              ${scoreRow(item, leaders)}
            </li>`,
          )}
        </ul>

        <div class="ledger-wrap">
          <table class="ledger bestmatch__table" role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th class="ledger__criterion" scope="col" role="columnheader">Criterion</th>
                <th class="numeric" scope="col" role="columnheader">Weight</th>
                ${surveys.map((survey) => html`<th scope="col" role="columnheader">${survey.kos.name}</th>`)}
              </tr>
            </thead>
            <tbody role="rowgroup">
              ${BEST_MATCH_CRITERIA.map(
                // A criterion at 0% stays in the table, quieter: out of the score, not hidden.
                (criterion) => html`<tr role="row" class="${weights[criterion.key] === 0 ? 'bestmatch__row--off' : ''}">
                  <th class="ledger__criterion" scope="row" role="rowheader">${criterion.label}</th>
                  <td class="numeric bestmatch__weight" role="cell">${cellLabel('Weight')}<span class="ledger__cell-value">${weights[criterion.key]}%</span></td>
                  ${scored.map((item) => partCell(item.parts[criterion.key], item.survey.kos.name))}
                </tr>`,
              )}
            </tbody>
          </table>
        </div>

        <dl class="bestmatch__method">
          <dt>Price and distance</dt>
          <dd>Ranked against the other kos here. Best value scores 100.</dd>
          <dt>Facilities</dt>
          <dd>Recorded facilities out of ${TOTAL_FACILITY_COUNT} across room, bathroom and shared.</dd>
          <dt>Cleanliness and security</dt>
          <dd>The 1–4 rating, where 1 scores 0 and 4 scores 100.</dd>
          <dt>Location</dt>
          <dd>
            Recorded surroundings out of ${SURROUNDINGS.length}. The requirement weights
            “Location” without naming a field; this is the reading in use.
          </dd>
          <dt>Weights</dt>
          <dd>
            Set with Edit criteria, as whole percentages that total 100%. A criterion
            at 0% is left out of the score, so it does not need to be recorded.
          </dd>
        </dl>
      </div>
    </details>
  `;
}
