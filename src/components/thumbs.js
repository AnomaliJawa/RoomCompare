import { qsa, photoPlaceholder } from '../utils/dom.js';
import { loadMedia } from '../media.js';
import { urlFor, releaseUrl } from '../db.js';

/**
 * Resolve card thumbnails.
 *
 * Cards render synchronously from the survey record, which holds photo ids
 * rather than images, so each one leaves an <img> carrying its id for this to
 * fill in once the blobs arrive. A card whose photo has gone falls back to the
 * placeholder tile instead of showing a broken image.
 *
 * The urls are released when the view is torn down, or every list visited
 * would pin its images in memory for the rest of the session.
 */
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
