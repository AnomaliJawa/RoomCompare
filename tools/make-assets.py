"""Draws the app icons and the favicon. Not app code: its output is committed."""

import os

from PIL import Image, ImageDraw

# Vite copies client/public into the build as it is.
PUBLIC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'client', 'public')
OUT_ICONS = os.path.join(PUBLIC, 'icons')


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
    print('icons:', ', '.join(make_icons() + make_favicon()))
