"""Downloads the sample photos listed in seed-photos.json and writes them, cropped and resized, into
client/public/seed-photos. Not app code: its output is committed.

    python -I tools/seed-photos.py <download-dir> [<out-dir>]
"""

import hashlib
import json
import os
import sys
import urllib.request

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
MANIFEST = os.path.join(HERE, 'seed-photos.json')
OUT = os.path.join(HERE, '..', 'client', 'public', 'seed-photos')
W, H = 1200, 900
QUALITY = 72


def download(photo, folder):
    path = os.path.join(folder, photo['file'])
    if not os.path.exists(path):
        request = urllib.request.Request(photo['url'], headers={'User-Agent': 'RoomCompare seed-photos'})
        with urllib.request.urlopen(request, timeout=60) as response, open(path, 'wb') as file:
            file.write(response.read())
    return path


def crop(img, focus):
    """The largest 4:3 frame, centred across and at `focus` (0 top, 1 bottom) down."""
    width, height = img.size
    if width * H > height * W:
        frame = round(height * W / H)
        left = (width - frame) // 2
        return img.crop((left, 0, left + frame, height))
    frame = round(width * H / W)
    top = round((height - frame) * focus)
    return img.crop((0, top, width, top + frame))


def convert(source, target, focus):
    with Image.open(source) as img:
        img.verify()
    with Image.open(source) as img:
        if img.format not in ('JPEG', 'PNG', 'WEBP'):
            raise ValueError(f'{source}: {img.format} is not a photo format')
        photo = crop(img.convert('RGB'), focus).resize((W, H), Image.LANCZOS)
    # Saved without the source's EXIF, which can carry the place a photo was taken.
    photo.save(target, 'JPEG', quality=QUALITY, optimize=True, progressive=True)


def main(folder, out=OUT):
    photos = json.load(open(MANIFEST, encoding='utf-8'))['photos']
    os.makedirs(folder, exist_ok=True)
    os.makedirs(out, exist_ok=True)
    digests = {}
    for photo in photos:
        target = os.path.join(out, photo['file'])
        convert(download(photo, folder), target, photo.get('focus', 0.5))
        digest = hashlib.sha256(open(target, 'rb').read()).hexdigest()
        if digest in digests:
            raise SystemExit(f'{photo["file"]} is the same image as {digests[digest]}')
        digests[digest] = photo['file']
    listed = {photo['file'] for photo in photos}
    stray = sorted(name for name in os.listdir(out) if name not in listed)
    total = sum(os.path.getsize(os.path.join(out, name)) for name in listed)
    print(f'{len(listed)} photos, {total / 1024 / 1024:.1f} MB')
    if stray:
        print('not in the manifest:', ', '.join(stray))


if __name__ == '__main__':
    if len(sys.argv) not in (2, 3):
        raise SystemExit(__doc__)
    main(*sys.argv[1:])
