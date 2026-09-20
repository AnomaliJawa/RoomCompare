import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { BEST_MATCH_WEIGHTS, TOTAL_FACILITY_COUNT, SURROUNDINGS } from '../constants.js';

/**
 * The optional weighted score.
 *
 * Deliberately separate from the comparison: this module imports nothing from
 * the table and the table imports nothing from here, so the whole feature can
 * be removed by deleting one mount point without touching the comparison the
 * product actually turns on.
 *
 * Every sub-score is derived from data the user recorded. The prototype
 * stored priceScore, facilityScore and the rest as literal constants on each
 * seed object, so the "score" ranked nothing and every new survey scored
 * identically.
 *
 * Two of the six criteria are relative to the kos being compared, not
 * absolute: being the cheapest of three says nothing about being cheap. The
 * panel says so rather than leaving "92" to be read as a rating.
 */

/** Likert 1-4 -> 0-100. 1 is the floor, so (v-1)/3 rather than v/4: a "Poor"
 *  rating should not read as a quarter mark. */
function fromLikert(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 4) return null;
  return ((n - 1) / 3) * 100;
}

/**
 * Position within the compared set, 100 for the best value.
 * When every kos matches, they all score full marks — none is worse.
 */
function relative(values, index, { lowerIsBetter }) {
  const present = values.filter((value) => Number.isFinite(value));
  if (!Number.isFinite(values[index]) || present.length < 2) return null;

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

/**
 * The requirement weights "Location" at 15% but never says which recorded
 * field it means. Coordinates are already spent on Distance, and raw
 * latitude does not rank. Surroundings is the only recorded field that
 * expresses locational quality, and section 5 describes it in those terms:
 * places nearby that support daily needs. Labelled as such in the panel so
 * the reading is visible rather than implied.
 */
function locationScore(survey) {
  return ((survey.surroundings?.length ?? 0) / SURROUNDINGS.length) * 100;
}

const MISSING_LABELS = {
  price: 'monthly rent',
  cleanliness: 'cleanliness',
  security: 'security',
  distance: 'distance to campus',
};

/**
 * Score every kos in the set.
 * A kos missing any weighted input gets no total at all: treating "not
 * recorded" as zero would rank an unfinished survey as the worst option,
 * which is a claim the data does not support.
 */
export function computeBestMatch(surveys) {
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

    const missing = Object.entries(parts)
      .filter(([, value]) => value === null)
      .map(([key]) => MISSING_LABELS[key] ?? key);

    const total = missing.length
      ? null
      : Math.round(
          BEST_MATCH_WEIGHTS.reduce((sum, criterion) => sum + parts[criterion.key] * criterion.weight, 0),
        );

    return { survey, parts, missing, total };
  });

  // Ties are shown as ties; picking a winner arbitrarily would invent a
  // distinction the numbers do not make.
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

/* --- Rendering ----------------------------------------------------------- */

function partCell(value) {
  if (value === null) return html`<td><span class="unrecorded">—</span></td>`;
  return html`<td class="numeric">${Math.round(value)}</td>`;
}

function scoreRow(item, leaders) {
  if (item.total === null) {
    const list =
      item.missing.length === 1
        ? item.missing[0]
        : `${item.missing.slice(0, -1).join(', ')} and ${item.missing[item.missing.length - 1]}`;
    return html`<span class="unrecorded">Score unavailable — ${list} not recorded</span>`;
  }
  const isLeader = leaders.includes(item.survey.id);
  return html`<span class="bestmatch__score${isLeader ? ' bestmatch__score--leader' : ''}">
    ${item.total}${isLeader ? html`<span class="bestmatch__flag">Best match</span>` : ''}
  </span>`;
}

export function bestMatchPanel(surveys) {
  const { scored, leaders } = computeBestMatch(surveys);
  const tied = leaders.length > 1;

  return html`
    <details class="bestmatch">
      <summary class="bestmatch__summary">
        <span class="bestmatch__summary-title">Optional: system-weighted score</span>
        <span class="meta">A guide, not a recommendation. The decision stays yours.</span>
      </summary>

      <div class="bestmatch__body">
        <p class="bestmatch__note meta">
          Scores are relative to these ${surveys.length} kos, not to kos in general:
          the cheapest of three is not necessarily cheap. Weights are fixed by the
          system and cannot be changed.
          ${tied ? ' Two kos scored the same, so both are marked.' : ''}
        </p>

        <ul class="bestmatch__results">
          ${scored.map(
            (item) => html`<li class="bestmatch__result">
              <span class="bestmatch__kos">${item.survey.kos.name}</span>
              ${scoreRow(item, leaders)}
            </li>`,
          )}
        </ul>

        <div class="ledger-wrap">
          <table class="ledger bestmatch__table">
            <thead>
              <tr>
                <th class="ledger__criterion" scope="col">Criterion</th>
                <th class="numeric" scope="col">Weight</th>
                ${surveys.map((survey) => html`<th scope="col">${survey.kos.name}</th>`)}
              </tr>
            </thead>
            <tbody>
              ${BEST_MATCH_WEIGHTS.map(
                (criterion) => html`<tr>
                  <th class="ledger__criterion" scope="row">${criterion.label}</th>
                  <td class="numeric">${Math.round(criterion.weight * 100)}%</td>
                  ${scored.map((item) => partCell(item.parts[criterion.key]))}
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
        </dl>
      </div>
    </details>
  `;
}
