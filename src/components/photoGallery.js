import { html, raw, qs, qsa, mount } from '../utils/dom.js';
import { loadMedia } from '../media.js';
import { urlFor, releaseUrl } from '../db.js';

/** Object URLs are released on teardown: each pins its blob in memory until revoked. */

let openIds = [];

export function galleryField({ section, label, mediaIds = [], kind = 'photo' }) {
  if (!mediaIds.length) {
    return html`<p class="meta">No ${label} recorded.</p>`;
  }

  return html`
    <div class="gallery" data-gallery="${section}" data-kind="${kind}" data-ids="${mediaIds.join(',')}">
      <div class="gallery__grid" data-grid>
        ${mediaIds.map(
          () => html`<div class="gallery__item gallery__item--loading" aria-hidden="true">
            <span class="skeleton gallery__skeleton"></span>
          </div>`,
        )}
      </div>
      <p class="gallery__status meta" data-status role="status" aria-live="polite">
        Loading ${mediaIds.length} ${mediaIds.length === 1 ? 'file' : 'files'}…
      </p>
    </div>
  `;
}

function lightboxMarkup(records, index) {
  const record = records[index];
  return html`
    <div class="lightbox">
      <div class="lightbox__head">
        <span class="lightbox__count numeric">${index + 1} of ${records.length}</span>
        <button class="btn btn--secondary btn--small" type="button" data-lightbox="close">Close</button>
      </div>

      <figure class="lightbox__figure">
        <img class="lightbox__image" src="${urlFor(record)}" alt="${record.originalName || 'Survey photo'}" />
        <figcaption class="lightbox__caption meta">${record.originalName || ''}</figcaption>
      </figure>

      <div class="lightbox__nav">
        <button class="btn btn--secondary" type="button" data-lightbox="prev" ${records.length < 2 ? raw('disabled') : ''}>
          Previous
        </button>
        <button class="btn btn--secondary" type="button" data-lightbox="next" ${records.length < 2 ? raw('disabled') : ''}>
          Next
        </button>
      </div>
    </div>
  `;
}

function openLightbox(records, startIndex, returnFocusTo) {
  const node = qs('#app-lightbox');
  if (!node || !records.length) return;

  let index = startIndex;

  function draw() {
    mount(node, lightboxMarkup(records, index));
    // Close is the safe default, and it keeps focus inside the dialog.
    qs('[data-lightbox="close"]', node)?.focus();
  }

  function step(by) {
    if (records.length < 2) return;
    index = (index + by + records.length) % records.length;
    draw();
  }

  function onClick(event) {
    const button = event.target.closest('[data-lightbox]');
    if (!button) {
      if (event.target === node) node.close();
      return;
    }
    if (button.dataset.lightbox === 'close') node.close();
    if (button.dataset.lightbox === 'prev') step(-1);
    if (button.dataset.lightbox === 'next') step(1);
  }

  function onKeydown(event) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }
    // Escape is handled by <dialog> itself.
  }

  function onClose() {
    node.removeEventListener('click', onClick);
    node.removeEventListener('keydown', onKeydown);
    node.removeEventListener('close', onClose);
    node.innerHTML = '';
    returnFocusTo?.focus();
  }

  node.addEventListener('click', onClick);
  node.addEventListener('keydown', onKeydown);
  node.addEventListener('close', onClose);

  draw();
  node.showModal();
}

/** Files stay on the device that added them; elsewhere they are listed as not here. */
function notHere(count, kind) {
  const noun = kind === 'video' ? 'video' : 'photo';
  const what = count === 1 ? `1 ${noun} is` : `${count} ${noun}s are`;
  return `${what} not on this device. Photos and videos stay on the device they were added on.`;
}

function renderRecords(node, records, expected) {
  const grid = qs('[data-grid]', node);
  const status = qs('[data-status]', node);
  const kind = node.dataset.kind;
  const missing = expected - records.length;

  if (!records.length) {
    mount(grid, '');
    status.textContent = notHere(missing, kind);
    return;
  }

  if (kind === 'video') {
    mount(
      grid,
      html`${records.map(
        (record) => html`<div class="gallery__item gallery__item--video">
          <video class="gallery__video" controls preload="metadata" src="${urlFor(record)}"></video>
          <span class="meta">${record.originalName || 'Video'}</span>
        </div>`,
      )}`,
    );
    status.textContent = missing ? notHere(missing, kind) : '';
    return;
  }

  mount(
    grid,
    html`${records.map(
      (record, index) => html`<button
        class="gallery__item gallery__thumb-button"
        type="button"
        data-open="${index}"
        aria-label="Open photo ${index + 1} of ${records.length}"
      >
        <img class="gallery__thumb" src="${urlFor(record)}" alt="${record.originalName || `Survey photo ${index + 1}`}" />
      </button>`,
    )}`,
  );
  status.textContent = missing ? notHere(missing, kind) : '';

  grid.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open]');
    if (!button) return;
    openLightbox(records, Number(button.dataset.open), button);
  });
}

export async function mountGalleries(root) {
  const nodes = qsa('[data-gallery]', root);
  if (!nodes.length) return { destroy() {} };

  const loaded = [];

  await Promise.all(
    nodes.map(async (node) => {
      const ids = node.dataset.ids ? node.dataset.ids.split(',').filter(Boolean) : [];
      const records = await loadMedia(ids);
      loaded.push(...records.map((record) => record.id));
      renderRecords(node, records, ids.length);
    }),
  );

  openIds = loaded;

  return {
    destroy() {
      loaded.forEach(releaseUrl);
      openIds = openIds.filter((id) => !loaded.includes(id));
    },
  };
}
