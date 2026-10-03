import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatKosDistance } from '../utils/format.js';
import { getState, bestMatchWeights } from '../store.js';
import { BEST_MATCH_CRITERIA, STATUS } from '../constants.js';
import { isDefault } from '../utils/weights.js';
import { emptyState } from '../components/emptyState.js';

function emptyHero() {
  return emptyState({
    title: 'No kos recorded yet',
    body:
      'Start with the first kos you visited. Record what you saw, add photos and ' +
      'notes, then compare your options side by side when you have two or more.',
    actions: [{ label: 'Add survey', href: '#/surveys/new' }],
  });
}

/** Explicit ARIA roles keep the tables tables when the narrow layout turns them into blocks. */
function heroStrip(surveys) {
  const cheapest = Math.min(...surveys.map((s) => s.kos.rent ?? Infinity));
  const nearest = Math.min(...surveys.map((s) => s.kos.distanceKm ?? Infinity));

  const criteria = [
    {
      id: 'strip-rent',
      label: 'Monthly rent',
      value: (s) => (s.kos.rent == null ? null : numberToCurrency(s.kos.rent)),
      best: (s) => s.kos.rent === cheapest,
    },
    {
      id: 'strip-distance',
      label: 'To campus',
      value: (s) => (s.kos.distanceKm == null ? null : formatKosDistance(s.kos)),
      best: (s) => s.kos.distanceKm === nearest,
    },
  ];

  const columns = html`<colgroup>${surveys.map(() => html`<col />`)}</colgroup>`;
  const names = html`<tr role="row">
    ${surveys.map((s) => html`<th scope="col" role="columnheader">${s.kos.name}</th>`)}
  </tr>`;

  const cell = (criterion, s) => {
    const value = criterion.value(s);
    return html`<td class="numeric${criterion.best(s) ? ' strip__best' : ''}" role="cell">
      <span class="strip__kos" aria-hidden="true">${s.kos.name}</span>
      ${value === null
        ? html`<span class="strip__value unrecorded">Not recorded</span>`
        : html`<span class="strip__value">${value}</span>`}
    </td>`;
  };

  return html`
    <section class="hero">
      <div class="hero__text">
        <h2>Your last ${surveys.length} visits, side by side</h2>
        <p>
          Everything you recorded in one place, so you can weigh the options
          without opening your gallery, your notes and a chat thread at once.
        </p>
      </div>
      <div class="hero__strip">
        <div class="hero__actions">
          <a class="btn btn--primary" href="#/compare">Compare kos</a>
        </div>
        <div class="strip-sections">
          <div class="strip-section strip-section--names" aria-hidden="true">
            <table class="strip">
              ${columns}
              <thead>${names}</thead>
            </table>
          </div>
          ${criteria.map(
            (criterion) => html`<section class="strip-section" aria-labelledby="${criterion.id}">
              <h3 class="strip-section__title" id="${criterion.id}">${criterion.label}</h3>
              <table class="strip" role="table" aria-labelledby="${criterion.id}">
                ${columns}
                <thead class="visually-hidden" role="rowgroup">${names}</thead>
                <tbody role="rowgroup">
                  <tr role="row">${surveys.map((s) => cell(criterion, s))}</tr>
                </tbody>
              </table>
            </section>`,
          )}
        </div>
      </div>
    </section>
  `;
}

export function renderDashboard() {
  const { surveys } = getState();
  const recent = [...surveys]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 3);

  const drafts = surveys.filter((s) => s.status === STATUS.DRAFT).length;
  const weights = bestMatchWeights();

  return html`
    <div class="page-head">
      <div class="page-head__text">
        <h1>Dashboard</h1>
        <p class="page-head__lede">Survey, record, organize, compare.</p>
      </div>
    </div>

    ${recent.length ? heroStrip(recent) : emptyHero()}

    <div class="grid-split section">
      <section class="panel">
        <div class="section__head">
          <h2>Recent surveys</h2>
          <a class="btn btn--quiet btn--small" href="#/surveys">View all</a>
        </div>
        ${
          recent.length
            ? raw(
                html`<ul class="stack">
                  ${raw(
                    recent
                      .map(
                        (s) => html`<li class="listing">
                          <div>
                            <a class="listing__title" href="#/surveys/${s.id}">${s.kos.name}</a>
                            <p class="meta">${s.kos.kosLocation?.label}</p>
                          </div>
                          <span class="numeric">${numberToCurrency(s.kos.rent)}</span>
                        </li>`,
                      )
                      .join(''),
                  )}
                </ul>`,
              )
            : raw(html`<p class="meta">Nothing recorded yet.</p>`)
        }
        ${drafts ? raw(html`<p class="meta" style="margin-top: var(--space-4)">${drafts} draft${drafts === 1 ? '' : 's'} still to finish.</p>`) : ''}
      </section>

      <section class="panel">
        <div class="section__head">
          <h2>Best Match criteria</h2>
          <button
            class="btn btn--secondary btn--small"
            type="button"
            data-action="open-criteria"
            aria-haspopup="dialog"
            aria-label="Edit Best Match criteria"
          >Edit</button>
        </div>
        <p class="meta">
          How much each criterion counts in the optional score under a comparison.
          The comparison itself is never scored.
          ${isDefault(weights) ? 'These are the defaults.' : 'These are your own.'}
        </p>
        <ul class="stack" style="margin-top: var(--space-4)">
          ${raw(
            BEST_MATCH_CRITERIA.map(
              (c) => html`<li class="listing">
                <span>${c.label}</span>
                <span class="numeric">${weights[c.key]}%</span>
              </li>`,
            ).join(''),
          )}
        </ul>
      </section>
    </div>
  `;
}
