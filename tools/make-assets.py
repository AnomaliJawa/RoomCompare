"""Draws the seed photos, the app icons and the favicon. Not app code: its output is committed."""

import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

# Vite copies client/public into the build as it is.
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'public')
OUT_PHOTOS = os.path.join(PUBLIC, 'seed-photos')
OUT_ICONS = os.path.join(PUBLIC, 'icons')
W, H = 1200, 900


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def wash(img, top, bottom, box=None):
    x0, y0, x1, y1 = box or (0, 0, img.width, img.height)
    d = ImageDraw.Draw(img)
    span = max(1, y1 - y0)
    for y in range(y0, y1):
        d.line([(x0, y), (x1, y)], fill=lerp(top, bottom, (y - y0) / span))


def grain(img, amount=7):
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
    # Three room photos, two bathroom, two shared: enough for a gallery to page through.
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


# --- Logo: the user's icons/logo.svg, drawn 16x larger then reduced, as Pillow cannot read SVG ---
PAPER = (247, 248, 246)
ACCENT = (31, 93, 76)

LOGO_FILLED = [(72, 42), (22, 84), (22, 162), (122, 162), (122, 84)]
LOGO_OUTLINED = [(128, 42), (78, 84), (78, 162), (178, 162), (178, 84)]
SS = 16


def logo_coverage(size, left, top, width):
    """The houses as 0-255 coverage at SS times size; the gap is cut out as the logo's mask cuts it."""
    unit = width * SS / 200

    def at(x, y):
        return (left * SS + x * unit, top * SS + y * unit)

    def stroke(points, width, value):
        # Round joins, as stroke-linejoin="round" draws them.
        w = width * unit
        corners = [at(x, y) for x, y in points]
        for a, b in zip(corners, corners[1:] + corners[:1]):
            d.line([a, b], fill=value, width=round(w))
        for x, y in corners:
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=value)

    coverage = Image.new('L', (size * SS, size * SS), 0)
    d = ImageDraw.Draw(coverage)
    d.polygon([at(x, y) for x, y in LOGO_FILLED], fill=255)
    stroke(LOGO_FILLED, 10, 255)
    stroke(LOGO_OUTLINED, 26, 0)
    stroke(LOGO_OUTLINED, 10, 255)
    return coverage


# --- Home-screen icons: the logo on off-white (the user's choice), at 3/4 for Android's round crop ---
LOGO_ON_ICON = 0.75

ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="RoomCompare">
  <defs>
    <mask id="rc-gap" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
      <rect width="200" height="200" fill="#fff"/>
      <path d="M128 42 L78 84 L78 162 L178 162 L178 84 Z" fill="none" stroke="#000" stroke-width="26" stroke-linejoin="round"/>
    </mask>
  </defs>
  <rect width="200" height="200" rx="45" fill="#f7f8f6"/>
  <g transform="translate(25 25) scale(0.75)">
    <path d="M72 42 L22 84 L22 162 L122 162 L122 84 Z" fill="#1F5D4C" stroke="#1F5D4C" stroke-width="10" stroke-linejoin="round" mask="url(#rc-gap)"/>
    <path d="M128 42 L78 84 L78 162 L178 162 L178 84 Z" fill="none" stroke="#1F5D4C" stroke-width="10" stroke-linejoin="round"/>
  </g>
</svg>
"""


def draw_home_icon(size, *, rounded):
    """`rounded` cuts corners where an icon shows as it is; phones round or crop full squares themselves."""
    canvas = size * SS
    inset = size * (1 - LOGO_ON_ICON) / 2
    houses = logo_coverage(size, inset, inset, size * LOGO_ON_ICON)

    square = Image.new('L', (canvas, canvas), 0 if rounded else 255)
    if rounded:
        ImageDraw.Draw(square).rounded_rectangle([0, 0, canvas - 1, canvas - 1], radius=canvas * 0.225, fill=255)
    img = Image.new('RGBA', (canvas, canvas), PAPER + (0,))
    img.putalpha(square)
    img = Image.composite(Image.new('RGBA', (canvas, canvas), ACCENT + (255,)), img, houses)
    img = img.resize((size, size), Image.LANCZOS)
    return img if rounded else img.convert('RGB')


def make_icons():
    os.makedirs(OUT_ICONS, exist_ok=True)
    with open(os.path.join(OUT_ICONS, 'icon.svg'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(ICON_SVG)

    made = ['icon.svg']
    icons = [
        (180, 'apple-touch-icon.png', False),  # iOS rounds it
        (512, 'icon-maskable-512.png', False),  # Android crops it to its shape
        (192, 'icon-192.png', True),  # shown as it is: a desktop install, a plain launcher
        (512, 'icon-512.png', True),
    ]
    for size, name, rounded in icons:
        draw_home_icon(size, rounded=rounded).save(os.path.join(OUT_ICONS, name), 'PNG', optimize=True)
        made.append(name)
    return made


# --- Favicon: the logo exactly as supplied, on no background (the user's choice) ---


def draw_favicon(size):
    img = Image.new('RGBA', (size * SS, size * SS), ACCENT + (0,))
    img.putalpha(logo_coverage(size, 0, 0, size))
    return img.resize((size, size), Image.LANCZOS)


def make_favicon():
    # A real .ico, each size drawn at that size rather than shrunk from the largest.
    frames = [draw_favicon(size) for size in (16, 32, 48)]
    frames[-1].save(os.path.join(PUBLIC, 'favicon.ico'), 'ICO', sizes=[(16, 16), (32, 32), (48, 48)], append_images=frames[:-1])
    return ['favicon.ico']


if __name__ == '__main__':
    photos = make_photos()
    total = sum(size for _, size in photos)
    print(f'photos: {len(photos)} files, {total / 1024:.0f} KB total')
    print(f'  largest: {max(size for _, size in photos) / 1024:.0f} KB')
    print('icons:', ', '.join(make_icons() + make_favicon()))
