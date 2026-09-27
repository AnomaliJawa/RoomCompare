import { html, mount } from '../utils/dom.js';
import { FIELD_GUIDE, PANEL_PARTS, RUBRICS } from '../content/guidance.js';

/**
 * The How to fill panel behind each survey field's ⓘ.
 *
 * It always reads in the same order — what to fill, how to find it, an
 * example, the rules the form checks, a survey tip — so it can be scanned.
 * A 1–4 field adds all four levels, and a photo field lists what to shoot.
 *
 * One <dialog> (#app-howto) serves every field, so only one panel is ever
 * open. It lives outside the form, so reading it cannot change an answer.
 * On a phone it is a sheet (components.css); on a wider screen it sits
 * beside the ⓘ, like a popover. Being a modal dialog, it closes on Esc and
 * on Android's back gesture without any code here.
 */

const NARROW = '(max-width: 640px)';
const GAP = 8; // between the ⓘ and the panel: --space-2
const MARGIN = 16; // kept clear of the window's edges: --space-4
const MIN_ROOM = 160; // the least height worth scrolling through: head and a part

let opener = null;

function part(heading, body) {
  return html`<section class="howto__part">
    <h3 class="howto__heading">${heading}</h3>
    ${body}
  </section>`;
}

function scores(levels) {
  return part(
    'Scores',
    html`<dl class="howto__scores">
      ${levels.map(
        (level) => html`<div class="howto__score">
          <dt>${level.score} ${level.label}</dt>
          <dd>
            ${level.text}
            ${level.benchmark ? html`<span class="howto__benchmark">Average Download ${level.benchmark}</span>` : ''}
          </dd>
        </div>`,
      )}
    </dl>`,
  );
}

function shots(list) {
  return part('Suggested shots', html`<ul class="howto__shots">${list.map((item) => html`<li>${item}</li>`)}</ul>`);
}

/** The panel for one field, or null when the field has none. */
export function renderHowTo(key) {
  const guide = FIELD_GUIDE[key];
  if (!guide?.panel) return null;

  const sections = [];
  for (const [name, heading] of PANEL_PARTS) {
    // The four levels come before the example that uses them; a photo
    // field's list of shots is its example.
    if (name === 'example' && RUBRICS[key]) sections.push(scores(RUBRICS[key]));
    if (name === 'example' && guide.photos) sections.push(shots(guide.photos));
    if (guide.panel[name]) sections.push(part(heading, html`<p>${guide.panel[name]}</p>`));
  }

  return html`
    <div class="howto" data-guide="${key}">
      <div class="howto__head">
        <h2 class="howto__title" id="howto-title">How to fill ${guide.label}</h2>
        <button class="btn btn--quiet btn--small" type="button" data-action="close-howto">Close</button>
      </div>
      <div class="howto__body">${sections}</div>
    </div>
  `;
}

/**
 * Beside the ⓘ on a wide screen: below it, or above when it only fits
 * there. When it fits neither side, it takes the roomier one and scrolls
 * inside it, rather than covering the ⓘ it belongs to. It always stays
 * inside the window. A phone's sheet is placed by CSS.
 */
export function placeHowTo(node, trigger) {
  node.style.top = '';
  node.style.left = '';
  node.style.maxHeight = '';
  if (!trigger || window.matchMedia?.(NARROW).matches) return;

  const anchor = trigger.getBoundingClientRect();
  const below = window.innerHeight - MARGIN - (anchor.bottom + GAP);
  const above = anchor.top - GAP - MARGIN;
  // Its layout size, not its drawn box: the panel is placed while its
  // arrival animation still has it scaled down, which would place it short.
  let panel = node.offsetHeight;

  let top;
  if (panel <= below) {
    top = anchor.bottom + GAP;
  } else if (panel <= above) {
    top = anchor.top - GAP - panel;
  } else {
    const room = Math.max(below, above, MIN_ROOM);
    node.style.maxHeight = `${Math.floor(room)}px`;
    panel = Math.min(panel, room);
    top = below >= above ? anchor.bottom + GAP : anchor.top - GAP - panel;
  }
  const left = Math.min(anchor.left, window.innerWidth - MARGIN - node.offsetWidth);

  node.style.top = `${Math.round(Math.max(MARGIN, top))}px`;
  node.style.left = `${Math.round(Math.max(MARGIN, left))}px`;
}

/** Open a field's panel. Returns false when there is nothing to show. */
export function openHowTo(key, trigger = null) {
  const node = document.getElementById('app-howto');
  const content = renderHowTo(key);
  if (!node || !content) return false;

  mount(node, content);
  opener = trigger;
  if (!node.open) node.showModal();
  placeHowTo(node, trigger);
  return true;
}

/**
 * Wire the panel once, at startup.
 * - A click on the backdrop closes it, as the area outside a popover would.
 * - Closing returns focus to the ⓘ that opened it, in the field's own head,
 *   rather than leaving it at the top of the page. Safari does not focus a
 *   clicked button, so the browser's own return would miss it there.
 */
export function initHowTo() {
  const node = document.getElementById('app-howto');
  if (!node) return;
  node.addEventListener('click', (event) => {
    if (event.target === node) node.close();
  });
  node.addEventListener('close', () => {
    // `close` arrives a moment after the panel shuts. If another ⓘ has
    // opened it again since, that one is its opener now: leave it.
    if (node.open) return;
    const trigger = opener;
    opener = null;
    if (trigger?.isConnected) trigger.focus();
  });
}
