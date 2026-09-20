import { html, raw, qs, qsa, mount } from '../utils/dom.js';
import { formatBytes } from '../utils/image.js';
import { addPhotos, addVideo, loadMedia, MAX_VIDEOS } from '../media.js';
import { urlFor, releaseUrl } from '../db.js';
import { MAX_PHOTOS_PER_SECTION } from '../constants.js';

/**
 * Photo and video picker.
 *
 * Files are stored the moment they are chosen rather than held until submit:
 * a survey is recorded standing in someone else's room on a phone, and an
 * interrupted session should not lose the photos already taken. The survey id
 * is therefore assigned when the form opens, not when it is saved, and any
 * media left behind by an abandoned form is swept on the next boot.
 *
 * The chosen ids travel in a hidden input so the existing form read picks
 * them up with everything else.
 */

const ACCEPT = {
  photo: 'image/*',
  video: 'video/*',
};

function limitFor(kind) {
  return kind === 'video' ? MAX_VIDEOS : MAX_PHOTOS_PER_SECTION;
}

/* --- Markup -------------------------------------------------------------- */

export function uploaderField({ section, kind = 'photo', label, name, mediaIds = [] }) {
  const max = limitFor(kind);
  const noun = kind === 'video' ? 'videos' : 'photos';

  return html`
    <div class="uploader" data-uploader="${section}" data-kind="${kind}">
      <div class="uploader__head">
        <span class="field__label" id="${section}-uploader-label">${label}</span>
        <span class="uploader__count" data-count>${mediaIds.length} of ${max}</span>
      </div>

      <button
        class="uploader__drop"
        type="button"
        data-pick
        aria-describedby="${section}-uploader-hint"
      >
        <span class="uploader__drop-main">Choose ${noun}, or drag them here</span>
        <span class="uploader__drop-hint" id="${section}-uploader-hint">
          ${kind === 'video'
            ? `Up to ${max}, 20 MB each.`
            : `Up to ${max}. Large photos are resized automatically.`}
        </span>
      </button>

      <input
        class="visually-hidden"
        type="file"
        accept="${ACCEPT[kind]}"
        ${kind === 'video' ? '' : raw('multiple')}
        data-input
        tabindex="-1"
        aria-hidden="true"
      />

      <ul class="uploader__grid" data-grid aria-labelledby="${section}-uploader-label"></ul>
      <div class="uploader__status" data-status role="status" aria-live="polite"></div>

      <input type="hidden" name="${name}" value="${mediaIds.join(',')}" data-ids />
    </div>
  `;
}

/* --- Behaviour ----------------------------------------------------------- */

function thumbnail(record, kind) {
  const remove = html`<button
    class="uploader__remove"
    type="button"
    data-remove="${record.id}"
    aria-label="Remove ${record.originalName || 'file'}"
  >Remove</button>`;

  if (kind === 'video') {
    return html`<li class="uploader__item uploader__item--file">
      <div class="uploader__file">
        <span class="uploader__file-name">${record.originalName || 'Video'}</span>
        <span class="meta">${formatBytes(record.byteSize)}</span>
      </div>
      ${remove}
    </li>`;
  }

  return html`<li class="uploader__item">
    <img class="uploader__thumb" src="${urlFor(record)}" alt="${record.originalName || 'Survey photo'}" />
    ${remove}
  </li>`;
}

function mountOne(node, { surveyId, onChange }) {
  const kind = node.dataset.kind;
  const section = node.dataset.uploader;
  const max = limitFor(kind);

  const input = qs('[data-input]', node);
  const grid = qs('[data-grid]', node);
  const status = qs('[data-status]', node);
  const counter = qs('[data-count]', node);
  const hidden = qs('[data-ids]', node);
  const drop = qs('[data-pick]', node);

  let ids = hidden.value ? hidden.value.split(',').filter(Boolean) : [];
  let busy = false;

  function syncCount() {
    counter.textContent = `${ids.length} of ${max}`;
    hidden.value = ids.join(',');
    drop.disabled = ids.length >= max;
    drop.querySelector('.uploader__drop-main').textContent =
      ids.length >= max
        ? `Maximum of ${max} reached`
        : `Choose ${kind === 'video' ? 'videos' : 'photos'}, or drag them here`;
  }

  async function paint() {
    const records = await loadMedia(ids);
    // An id with no record left means the file is gone; drop it rather than
    // rendering a broken tile.
    ids = records.map((record) => record.id);
    mount(grid, html`${records.map((record) => thumbnail(record, kind))}`);
    syncCount();
    onChange?.();
  }

  function report(failures) {
    if (!failures.length) {
      status.textContent = '';
      return;
    }
    mount(
      status,
      html`<ul class="uploader__errors">
        ${failures.map(
          (failure) => html`<li class="field__error">
            ${failure.fileName ? `${failure.fileName}: ` : ''}${failure.message}
          </li>`,
        )}
      </ul>`,
    );
  }

  async function handleFiles(fileList) {
    const files = [...fileList];
    if (!files.length || busy) return;

    busy = true;
    status.textContent = `Adding ${files.length} file${files.length === 1 ? '' : 's'}…`;

    try {
      if (kind === 'video') {
        const room = Math.max(0, max - ids.length);
        const accepted = files.slice(0, room);
        const failures = files.slice(room).map((file) => ({
          fileName: file.name,
          message: `Only ${max} videos can be added.`,
        }));
        for (const file of accepted) {
          const result = await addVideo(file, { surveyId });
          if (result.ok) ids.push(result.record.id);
          else failures.push(result);
        }
        await paint();
        report(failures);
      } else {
        const { stored, failed } = await addPhotos(files, {
          surveyId,
          section,
          existingCount: ids.length,
        });
        ids.push(...stored.map((record) => record.id));
        await paint();
        report(failed);
      }
    } finally {
      busy = false;
      input.value = '';
    }
  }

  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', () => handleFiles(input.files));

  ['dragenter', 'dragover'].forEach((type) =>
    node.addEventListener(type, (event) => {
      event.preventDefault();
      if (!drop.disabled) node.dataset.dragging = 'true';
    }),
  );
  ['dragleave', 'drop'].forEach((type) =>
    node.addEventListener(type, (event) => {
      event.preventDefault();
      if (type === 'dragleave' && node.contains(event.relatedTarget)) return;
      delete node.dataset.dragging;
    }),
  );
  node.addEventListener('drop', (event) => {
    if (drop.disabled) return;
    handleFiles(event.dataTransfer?.files ?? []);
  });

  grid.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove]');
    if (!button) return;
    const id = button.dataset.remove;

    // Dropped from the list, not from the database. Deleting here would
    // destroy the file before the form is saved, so cancelling an edit could
    // not put it back — and the survey would still be pointing at it.
    // Anything left unreferenced after a save is pruned then.
    ids = ids.filter((item) => item !== id);
    releaseUrl(id);
    await paint();
    status.textContent = 'Photo removed. It is deleted when you save.';
  });

  paint();

  return {
    getIds: () => [...ids],
    destroy() {
      ids.forEach(releaseUrl);
    },
  };
}

/** Wire every uploader inside a form. Returns a handle per section. */
export function mountUploaders(root, { surveyId, onChange } = {}) {
  const handles = qsa('[data-uploader]', root).map((node) => mountOne(node, { surveyId, onChange }));
  return {
    destroy: () => handles.forEach((handle) => handle.destroy()),
  };
}
