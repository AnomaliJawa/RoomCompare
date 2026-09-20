/**
 * Client-side image downscaling, applied before anything reaches storage.
 *
 * A survey can carry forty photos and a current phone camera produces files
 * of several megabytes each. Stored untouched they would fill the origin's
 * allowance and make every gallery render slowly, so images are resized to a
 * sensible viewing size on the way in. The original file is never kept: the
 * survey needs a usable record of what the room looked like, not an archival
 * master.
 */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // per image, before resizing
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

/** Thrown for one file so a batch can continue past it. */
export class MediaError extends Error {
  constructor(message, { fileName = '', code = 'failed' } = {}) {
    super(message);
    this.name = 'MediaError';
    this.fileName = fileName;
    this.code = code;
  }
}

function scaledSize(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height, scaled: false };
  const ratio = maxEdge / longest;
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
    scaled: true,
  };
}

/**
 * Decode to a bitmap. `createImageBitmap` applies EXIF orientation, so photos
 * taken in portrait are not stored rotated; the fallback path relies on the
 * browser auto-orienting an <img>, which current versions do.
 */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options argument; fall through.
      try {
        return await createImageBitmap(file);
      } catch {
        /* fall through to the <img> path */
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new MediaError('That image could not be read.', {
        fileName: file.name,
        code: 'decode',
      }));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new MediaError('That image could not be converted.'))),
      type,
      quality,
    );
  });
}

/**
 * Resize one image file.
 * Returns { blob, width, height, mimeType, byteSize } ready to store.
 */
export async function downscaleImage(file, { maxEdge = MAX_EDGE, quality = JPEG_QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new MediaError('Only image files can be added as photos.', {
      fileName: file?.name,
      code: 'type',
    });
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new MediaError('That image is larger than 10 MB.', {
      fileName: file.name,
      code: 'size',
    });
  }

  const source = await decode(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  if (!width || !height) {
    throw new MediaError('That image could not be read.', { fileName: file.name, code: 'decode' });
  }

  const target = scaledSize(width, height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext('2d');
  // JPEG has no alpha channel, so transparent pixels would otherwise composite
  // to black. Painting white first keeps a transparent PNG looking right.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (typeof source.close === 'function') source.close();

  const blob = await toBlob(canvas, 'image/jpeg', quality);

  // An already-small, well-compressed file can come out larger after
  // re-encoding. Keep whichever is smaller, as long as it needed no resizing.
  if (!target.scaled && blob.size >= file.size) {
    return {
      blob: file,
      width,
      height,
      mimeType: file.type,
      byteSize: file.size,
    };
  }

  return {
    blob,
    width: target.width,
    height: target.height,
    mimeType: 'image/jpeg',
    byteSize: blob.size,
  };
}

/** Videos cannot be transcoded in the browser, so they are only checked. */
export function acceptVideo(file) {
  if (!file || !file.type?.startsWith('video/')) {
    throw new MediaError('Only video files can be added here.', {
      fileName: file?.name,
      code: 'type',
    });
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new MediaError('Videos must be under 20 MB.', {
      fileName: file.name,
      code: 'size',
    });
  }
  return { blob: file, mimeType: file.type, byteSize: file.size, width: null, height: null };
}

/** Human-readable size for the storage notice and per-file feedback. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
