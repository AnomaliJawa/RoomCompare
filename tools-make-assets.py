"""
Generate the seed photographs, the app icons and the favicon.

The photographs are illustrations, not photography: drawn room scenes at a
plausible size and compression so the galleries, thumbnails, lightbox and
comparison photo counts have real files to work with. Nothing here runs in
the app — it produces files that are committed and fetched on first run.
"""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

OUT_PHOTOS = 'seed-photos'
OUT_ICONS = 'icons'
W, H = 1200, 900


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wash(img, top, bottom, box=None):
    """Vertical gradient, which reads as light falling through a space."""
    x0, y0, x1, y1 = box or (0, 0, img.width, img.height)
    d = ImageDraw.Draw(img)
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        d.line([(x0, y), (x1, y)], fill=lerp(top, bottom, (y - y0) / span))


def grain(img, amount=7):
    """A little noise so the result does not read as flat vector art."""
    px = img.load()
    rnd = random.Random(20260920)
    for y in range(0, img.height, 2):
        for x in range(0, img.width, 2):
            n = rnd.randint(-amount, amount)
            r, g, b = px[x, y]
            px[x, y] = (
                max(0, min(255, r + n)),
                max(0, min(255, g + n)),
                max(0, min(255, b + n)),
            )
    return img


def vignette(img, strength=0.30):
    mask = Image.new('L', img.size, 0)
    d = ImageDraw.Draw(mask)
    d.ellipse(
        [-img.width * 0.25, -img.height * 0.25, img.width * 1.25, img.height * 1.25],
        fill=255,
    )
    mask = mask.filter(ImageFilter.GaussianBlur(img.width // 8))
    dark = Image.new('RGB', img.size, (0, 0, 0))
    return Image.composite(img, Image.blend(img, dark, strength), mask)


PALETTES = [
    {'wall': ((236, 232, 222), (214, 208, 196)), 'floor': ((150, 116, 84), (118, 90, 64)), 'accent': (86, 106, 122)},
    {'wall': ((228, 233, 231), (200, 208, 205)), 'floor': ((176, 154, 126), (140, 121, 98)), 'accent': (120, 96, 86)},
    {'wall': ((240, 235, 225), (218, 210, 196)), 'floor': ((132, 128, 124), (102, 99, 96)), 'accent': (94, 118, 100)},
    {'wall': ((226, 224, 228), (198, 196, 202)), 'floor': ((162, 132, 100), (128, 104, 78)), 'accent': (140, 112, 92)},
]


def room_scene(seed):
    """A bedroom: window light, a bed, a wardrobe, a desk."""
    rnd = random.Random(seed)
    pal = PALETTES[seed % len(PALETTES)]
    img = Image.new('RGB', (W, H), pal['wall'][0])
    horizon = int(H * rnd.uniform(0.54, 0.62))

    wash(img, pal['wall'][0], pal['wall'][1], (0, 0, W, horizon))
    wash(img, pal['floor'][0], pal['floor'][1], (0, horizon, W, H))
    d = ImageDraw.Draw(img, 'RGBA')

    # Window, and the light it throws onto the floor.
    wx = int(W * rnd.uniform(0.08, 0.2))
    ww = int(W * rnd.uniform(0.22, 0.3))
    wy, wh = int(H * 0.12), int(H * 0.3)
    d.rectangle([wx, wy, wx + ww, wy + wh], fill=(238, 240, 236), outline=(168, 168, 162), width=6)
    d.line([wx + ww // 2, wy, wx + ww // 2, wy + wh], fill=(168, 168, 162), width=5)
    d.line([wx, wy + wh // 2, wx + ww, wy + wh // 2], fill=(168, 168, 162), width=5)
    d.polygon(
        [(wx, horizon), (wx + ww, horizon), (wx + ww + 120, H), (wx - 60, H)],
        fill=(255, 250, 228, 42),
    )

    # Bed.
    bx = int(W * rnd.uniform(0.42, 0.52))
    bw, bh = int(W * 0.44), int(H * 0.26)
    by = horizon - int(H * 0.04)
    d.rectangle([bx, by, bx + bw, by + bh], fill=(232, 228, 220))
    d.rectangle([bx, by, bx + bw, by + int(bh * 0.34)], fill=pal['accent'])
    d.rectangle([bx + 18, by - 46, bx + 190, by + 6], fill=(246, 244, 238))
    d.rectangle([bx, by + bh, bx + bw, by + bh + 26], fill=(92, 74, 58))

    # Wardrobe.
    cx = int(W * 0.06)
    d.rectangle([cx, int(H * 0.3), cx + int(W * 0.16), horizon + int(H * 0.06)], fill=(118, 92, 68))
    d.line(
        [cx + int(W * 0.08), int(H * 0.3), cx + int(W * 0.08), horizon + int(H * 0.06)],
        fill=(96, 74, 54),
        width=5,
    )

    # Desk and chair.
    dx = int(W * rnd.uniform(0.26, 0.34))
    d.rectangle([dx, horizon - 6, dx + int(W * 0.17), horizon + 16], fill=(150, 118, 86))
    d.rectangle([dx + 12, horizon + 16, dx + 26, H - int(H * 0.16)], fill=(126, 98, 72))
    d.rectangle([dx + int(W * 0.145), horizon + 16, dx + int(W * 0.155), H - int(H * 0.16)], fill=(126, 98, 72))

    return vignette(grain(img))


def bathroom_scene(seed):
    rnd = random.Random(seed + 500)
    img = Image.new('RGB', (W, H), (226, 230, 231))
    horizon = int(H * 0.62)
    wash(img, (233, 238, 238), (206, 214, 214), (0, 0, W, horizon))
    wash(img, (186, 190, 190), (156, 160, 160), (0, horizon, W, H))
    d = ImageDraw.Draw(img, 'RGBA')

    # Tiling.
    tile = 96
    for y in range(0, horizon, tile):
        d.line([(0, y), (W, y)], fill=(196, 204, 204), width=3)
    for x in range(0, W, tile):
        d.line([(x, 0), (x, horizon)], fill=(196, 204, 204), width=3)

    # Shower panel.
    sx = int(W * 0.62)
    d.rectangle([sx, int(H * 0.08), W - 40, horizon + 40], fill=(214, 226, 228, 120), outline=(178, 190, 192), width=6)
    d.rectangle([sx + int(W * 0.12), int(H * 0.1), sx + int(W * 0.13), int(H * 0.2)], fill=(172, 176, 178))
    d.ellipse([sx + int(W * 0.10), int(H * 0.19), sx + int(W * 0.16), int(H * 0.23)], fill=(196, 200, 202))

    # Basin and toilet.
    d.rounded_rectangle([int(W * 0.08), int(H * 0.42), int(W * 0.28), int(H * 0.52)], 18, fill=(246, 248, 248))
    d.rectangle([int(W * 0.16), int(H * 0.52), int(W * 0.20), horizon], fill=(236, 240, 240))
    d.rounded_rectangle([int(W * 0.36), int(H * 0.46), int(W * 0.50), horizon + 30], 26, fill=(246, 248, 248))
    d.rounded_rectangle([int(W * 0.36), int(H * 0.36), int(W * 0.50), int(H * 0.47)], 12, fill=(238, 242, 242))

    if rnd.random() > 0.5:
        d.rectangle([int(W * 0.54), int(H * 0.30), int(W * 0.60), int(H * 0.42)], fill=(228, 230, 230))

    return vignette(grain(img), 0.24)


def shared_scene(seed):
    rnd = random.Random(seed + 900)
    pal = PALETTES[(seed + 1) % len(PALETTES)]
    img = Image.new('RGB', (W, H), pal['wall'][0])
    horizon = int(H * 0.58)
    wash(img, pal['wall'][0], pal['wall'][1], (0, 0, W, horizon))
    wash(img, (168, 166, 162), (134, 132, 128), (0, horizon, W, H))
    d = ImageDraw.Draw(img, 'RGBA')

    # Upper cabinets and counter.
    d.rectangle([int(W * 0.06), int(H * 0.12), int(W * 0.56), int(H * 0.32)], fill=(206, 198, 184))
    for i in range(3):
        x = int(W * 0.06) + i * int(W * 0.167)
        d.line([(x, int(H * 0.12)), (x, int(H * 0.32))], fill=(186, 178, 164), width=4)

    d.rectangle([int(W * 0.06), horizon - int(H * 0.06), int(W * 0.62), horizon], fill=(90, 92, 94))
    d.rectangle([int(W * 0.06), horizon, int(W * 0.62), H - int(H * 0.06)], fill=(196, 188, 174))

    # Sink and tap.
    d.rounded_rectangle(
        [int(W * 0.12), horizon - int(H * 0.055), int(W * 0.26), horizon - 6], 10, fill=(178, 180, 182)
    )
    d.rectangle([int(W * 0.185), horizon - int(H * 0.115), int(W * 0.195), horizon - int(H * 0.05)], fill=(170, 172, 174))

    # Appliance, and a table when there is room.
    d.rounded_rectangle([int(W * 0.66), int(H * 0.26), int(W * 0.82), horizon + int(H * 0.1)], 14, fill=(222, 224, 226))
    d.line(
        [int(W * 0.66), int(H * 0.42), int(W * 0.82), int(H * 0.42)], fill=(198, 200, 202), width=5
    )
    if rnd.random() > 0.4:
        d.ellipse([int(W * 0.30), horizon + int(H * 0.06), int(W * 0.56), horizon + int(H * 0.18)], fill=(150, 120, 90))

    return vignette(grain(img), 0.22)


SCENES = {'room': room_scene, 'bathroom': bathroom_scene, 'shared': shared_scene}


def make_photos():
    os.makedirs(OUT_PHOTOS, exist_ok=True)
    made = []
    # Three room photos, two bathroom, two shared: enough for a gallery and a
    # lightbox to have something to page through.
    plan = [('room', 3), ('bathroom', 2), ('shared', 2)]
    for variant in range(4):
        for section, count in plan:
            for i in range(count):
                seed = variant * 17 + i * 3 + len(section)
                img = SCENES[section](seed)
                name = f'{section}-{variant + 1}-{i + 1}.jpg'
                path = os.path.join(OUT_PHOTOS, name)
                img.save(path, 'JPEG', quality=78, optimize=True, progressive=True)
                made.append((name, os.path.getsize(path)))
    return made


# --- Icon ------------------------------------------------------------------
# Two columns and a rule: the comparison, which is what the product is for.
INK = (22, 36, 31)
PAPER = (247, 248, 246)
ACCENT = (31, 93, 76)

ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="RoomCompare">
  <rect width="64" height="64" rx="14" fill="#1f5d4c"/>
  <rect x="14" y="16" width="14" height="32" rx="2" fill="#f7f8f6"/>
  <rect x="36" y="24" width="14" height="24" rx="2" fill="#f7f8f6" opacity="0.62"/>
  <rect x="12" y="50" width="40" height="3" rx="1.5" fill="#f7f8f6"/>
</svg>
"""


def draw_icon(size):
    scale = size / 64
    img = Image.new('RGB', (size, size), ACCENT)
    d = ImageDraw.Draw(img)

    def box(x, y, w, h, fill):
        d.rounded_rectangle(
            [x * scale, y * scale, (x + w) * scale, (y + h) * scale],
            radius=max(1, int(2 * scale)),
            fill=fill,
        )

    box(14, 16, 14, 32, PAPER)
    box(36, 24, 14, 24, lerp(ACCENT, PAPER, 0.62))
    box(12, 50, 40, 3, PAPER)

    # Rounded corners, so the icon is not a hard square on a light background.
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=int(14 * scale), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def make_icons():
    """The home-screen icons. They still carry the columns above; the favicon
    below is the logo."""
    os.makedirs(OUT_ICONS, exist_ok=True)
    with open(os.path.join(OUT_ICONS, 'icon.svg'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(ICON_SVG)

    made = ['icon.svg']
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        path = os.path.join(OUT_ICONS, name)
        draw_icon(size).save(path, 'PNG', optimize=True)
        made.append(name)
    return made


# --- Favicon ---------------------------------------------------------------
# The logo itself, exactly as the user supplied it (icons/logo.svg): green
# houses on no background. index.html gives browsers the SVG; this draws the
# .ico for those that still ask for one. The user chose it over a version on
# the green tile, knowing its green shows less on a dark tab strip.

# The logo's two houses, copied from icons/logo.svg, in its 200-unit square.
LOGO_FILLED = [(72, 42), (22, 84), (22, 162), (122, 162), (122, 84)]
LOGO_OUTLINED = [(128, 42), (78, 84), (78, 162), (178, 162), (178, 84)]


def draw_favicon(size):
    """icons/logo.svg as pixels, its whole square at `size`. Pillow cannot
    read SVG, so the houses are drawn sixteen times larger and reduced, which
    smooths their edges much as a browser does. They are drawn as coverage
    alone: the gap is cut out of the filled house, as the logo's mask cuts
    it, so the tab shows through it."""
    ss = 16
    unit = size * ss / 200

    def stroke(points, width, value):
        # Round joins, as stroke-linejoin="round" draws them.
        w = width * unit
        corners = [(x * unit, y * unit) for x, y in points]
        for a, b in zip(corners, corners[1:] + corners[:1]):
            d.line([a, b], fill=value, width=round(w))
        for x, y in corners:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=value)

    coverage = Image.new('L', (size * ss, size * ss), 0)
    d = ImageDraw.Draw(coverage)
    d.polygon([(x * unit, y * unit) for x, y in LOGO_FILLED], fill=255)
    stroke(LOGO_FILLED, 10, 255)
    stroke(LOGO_OUTLINED, 26, 0)
    stroke(LOGO_OUTLINED, 10, 255)

    img = Image.new('RGBA', coverage.size, ACCENT + (0,))
    img.putalpha(coverage)
    return img.resize((size, size), Image.LANCZOS)


def make_favicon():
    # A real .ico for browsers that still ask for one at the site root, each
    # size drawn at that size rather than shrunk from the largest.
    frames = [draw_favicon(size) for size in (16, 32, 48)]
    frames[-1].save('favicon.ico', 'ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[:-1])
    return ['favicon.ico']


if __name__ == '__main__':
    photos = make_photos()
    total = sum(size for _, size in photos)
    print(f'photos: {len(photos)} files, {total / 1024:.0f} KB total')
    print(f'  largest: {max(size for _, size in photos) / 1024:.0f} KB')
    print('icons:', ', '.join(make_icons() + make_favicon()))
