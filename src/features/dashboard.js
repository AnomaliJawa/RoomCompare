import { html, raw } from '../utils/dom.js';
import { numberToCurrency, formatDistance } from '../utils/format.js';
import { getState } from '../store.js';
import { BEST_MATCH_WEIGHTS, STATUS } from '../constants.js';
import { emptyState } from '../components/emptyState.js';

/**
 * The dashboard opens with the most characteristic thing in this product's
 * world: the user's own kos, already side by side, in the same ledger type as
 * the full comparison. It shows the core feature rather than describing it.
 *
 * With nothing recorded, the hero becomes the invitation instead.
 */

function emptyHero() {
  return emptyState({
    title: 'No kos recorded yet',
    body:
      'Start with the first kos you visited. Record what you saw, add photos and ' +
      'notes, then compare your options side by side when you have two or more.',
    actions: [{ label: 'Add survey', href: '#/surveys/new' }],
  });
}

function heroStrip(surveys) {
  const cheapest = Math.min(...surveys.map((s) => s.kos.rent ?? Infinity));
  const nearest = Math.min(...surveys.map((s) => s.kos.distanceKm ?? Infinity));

  return html`
    <section class="hero">
      <div class="hero__text">
        <h2>Your last ${surveys.length} visits, side by side</h2>
        <p>
          Everything you recorded in one place, so you can weigh the options
          without opening your gallery, your notes and a chat thread at once.
        </p>
        <div class="row">
          <a class="btn btn--primary" href="#/compare">Compare kos</a>
        </div>
      </div>
      <div class="hero__strip">
        <table class="strip">
          <thead>
            <tr>
              <th class="strip__label" scope="col">Criterion</th>
              ${raw(surveys.map((s) => html`<th scope="col">${s.kos.name}</th>`).join(''))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th class="strip__label" scope="row">Monthly rent</th>
              ${raw(
                surveys
                  .map(
                    (s) => html`<td class="numeric ${s.kos.rent === cheapest ? 'strip__best' : ''}">
                      ${numberToCurrency(s.kos.rent)}
                    </td>`,
                  )
                  .join(''),
              )}
            </tr>
            <tr>
              <th class="strip__label" scope="row">To campus</th>
              ${raw(
                surveys
                  .map(
                    (s) => html`<td class="numeric ${s.kos.distanceKm === nearest ? 'strip__best' : ''}">
                      ${formatDistance(s.kos.distanceKm)}
                    </td>`,
                  )
                  .join(''),
              )}
            </tr>
          </tbody>
        </table>
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
        </div>
        <p class="meta">
          Fixed weights, used only in the optional score under a comparison.
          The comparison itself is never scored.
        </p>
        <ul class="stack" style="margin-top: var(--space-4)">
          ${raw(
            BEST_MATCH_WEIGHTS.map(
              (c) => html`<li class="listing">
                <span>${c.label}</span>
                <span class="numeric">${Math.round(c.weight * 100)}%</span>
              </li>`,
            ).join(''),
          )}
        </ul>
      </section>
    </div>
  `;
}
