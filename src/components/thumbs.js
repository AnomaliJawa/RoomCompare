import { qsa, photoPlaceholder } from '../utils/dom.js';
import { loadMedia } from '../media.js';
import { urlFor, releaseUrl } from '../db.js';

/** Cards render with photo ids; thumbnails fill in later and fall back to the placeholder. */
export async function mountThumbs(root) {
  const nodes = qsa('img[data-photo-id]', root);
  if (!nodes.length) return { destroy() {} };

  const records = await loadMedia(nodes.map((node) => node.dataset.photoId));
  const byId = new Map(records.map((record) => [record.id, record]));
  const held = [];

  nodes.forEach((node) => {
    const record = byId.get(node.dataset.photoId);
    if (!record) {
      node.outerHTML = String(photoPlaceholder(node.dataset.kosName || '?'));
      return;
    }
    node.src = urlFor(record);
    held.push(record.id);
  });

  return {
    destroy() {
      held.forEach(releaseUrl);
    },
  };
}
