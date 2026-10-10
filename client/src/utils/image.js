import { msg } from '../i18n/index.js';

/** Images are downscaled before storage; the original is never kept. */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.82;
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024; // per image, before resizing
export const MAX_VIDEO_BYTES = 20 * 1024 * 1024;

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

/** createImageBitmap applies EXIF orientation, so portraits are not stored rotated. */
async function decode(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Older Safari rejects the options argument; fall through.
      try {
        return await createImageBitmap(file);
      } catch {
      }
    }
  }

  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new MediaError(msg('That image could not be read.'), {
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
      (blob) => (blob ? resolve(blob) : reject(new MediaError(msg('That image could not be converted.')))),
      type,
      quality,
    );
  });
}

export async function downscaleImage(file, { maxEdge = MAX_EDGE, quality = JPEG_QUALITY } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new MediaError(msg('Only image files can be added as photos.'), {
      fileName: file?.name,
      code: 'type',
    });
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new MediaError(msg('That image is larger than 10 MB.'), {
      fileName: file.name,
      code: 'size',
    });
  }

  const source = await decode(file);
  const width = source.width || source.naturalWidth;
  const height = source.height || source.naturalHeight;

  if (!width || !height) {
    throw new MediaError(msg('That image could not be read.'), { fileName: file.name, code: 'decode' });
  }

  const target = scaledSize(width, height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = target.width;
  canvas.height = target.height;

  const context = canvas.getContext('2d');
  // JPEG has no alpha, so transparency is painted white rather than black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  if (typeof source.close === 'function') source.close();

  const blob = await toBlob(canvas, 'image/jpeg', quality);

  // Re-encoding can grow a small file; keep the smaller when no resize was needed.
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
    throw new MediaError(msg('Only video files can be added here.'), {
      fileName: file?.name,
      code: 'type',
    });
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new MediaError(msg('Videos must be under 20 MB.'), {
      fileName: file.name,
      code: 'size',
    });
  }
  return { blob: file, mimeType: file.type, byteSize: file.size, width: null, height: null };
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
