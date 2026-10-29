"""Make every icon of My Dream Bucket from the one app icon picture.

    python tools/make-icons.py [source picture]      (default: icons/brand/icon-source.webp)

The source is the app icon as drawn: a rounded tile on a white page, with a soft shadow under it. The tile is cut out
(everything joined to the page's edge that is white or grey is the page) and made into:

    icons/icon-192.png, icon-512.png     the tile with clear corners - the app's own logo, the browser tab, a computer's app list
    icons/maskable-192.png, -512.png     full-bleed square (the corners filled from the picture's own edge colours) for the
                                         phone's home screen, which cuts its own shape
    icons/apple-touch-icon.png           180 px full-bleed (iPhone and iPad round it themselves)
    icons/favicon-32.png, favicon.ico    small tab icons
    icons/og-image.png                   1200 x 630, for links shared on WhatsApp, X, LinkedIn...

Needs Pillow and numpy.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / 'icons'
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ICONS / 'brand' / 'icon-source.webp'


def page_mask(rgb):
    """True where the picture is the page around the tile: low-colour pixels joined to the edge."""
    a = rgb.astype(int)
    spread = a.max(axis=2) - a.min(axis=2)
    light = a.sum(axis=2) > 3 * 150
    pale = (spread < 26) & light
    h, w = pale.shape
    seen = np.zeros_like(pale)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if pale[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if pale[y, x] and not seen[y, x]:
                seen[y, x] = True; q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and pale[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen


def cut_tile(img):
    rgb = np.asarray(img.convert('RGB'))
    tile = ~page_mask(rgb)
    ys, xs = np.where(tile)
    x0, x1 = xs.min(), xs.max() + 1
    # The shadow under the tile is grey, so it falls to the page; the tile is square, so its height is its width.
    y0 = ys.min()
    side = x1 - x0
    box = (x0, y0, x0 + side, y0 + side)
    # The tile's shape from its two top corners (sky there, so cleanly cut), the same at all four corners: the lake's
    # sunlit water reaches the right edge and is as pale as the page, so the cut itself is not used lower down.
    t = tile[y0:y0 + side, x0:x0 + side]
    half = side // 2
    left = np.array([np.argmax(t[r, :half]) if t[r, :half].any() else half for r in range(half)])
    right = np.array([np.argmax(t[r, side - 1:half:-1]) if t[r, side - 1:half:-1].any() else half for r in range(half)])
    inset = np.maximum.accumulate(((left + right) / 2.0)[::-1])[::-1]   # never wider higher up
    # Drawn 4x larger and scaled down, so the curve is smooth; a pixel in from the cut (edge pixels are mixed with white).
    k = 4
    big = np.zeros((side * k, side * k), dtype=np.uint8)
    for r in range(side * k):
        rr = min(r, side * k - 1 - r) / k
        i = min(int(rr), half - 1)
        f = rr - int(rr)
        ins = (inset[i] * (1 - f) + inset[min(i + 1, half - 1)] * f + 1.2) * k
        a, b = int(round(ins)), int(round(side * k - ins))
        if b > a:
            big[r, a:b] = 255
    big[:int(1.2 * k), :] = 0; big[-int(1.2 * k):, :] = 0
    alpha = Image.fromarray(big).resize((side, side), Image.LANCZOS)
    art = img.convert('RGB').crop(box)
    out = art.convert('RGBA'); out.putalpha(alpha)
    return out


def full_bleed(tile):
    """The tile as a full square: the clear corners filled with the colours just inside them."""
    a = np.asarray(tile).astype(float)
    alpha = a[..., 3:4] / 255.0
    pre = Image.fromarray(np.clip(a[..., :3] * alpha, 0, 255).astype(np.uint8))
    am = Image.fromarray((alpha[..., 0] * 255).astype(np.uint8))
    r = tile.width // 10
    pb = np.asarray(pre.filter(ImageFilter.GaussianBlur(r))).astype(float)
    ab = np.asarray(am.filter(ImageFilter.GaussianBlur(r))).astype(float)[..., None] / 255.0
    fill = np.clip(pb / np.maximum(ab, 1e-3), 0, 255)
    rgb = a[..., :3] * alpha + fill * (1 - alpha)
    return Image.fromarray(rgb.astype(np.uint8), 'RGB')


def save(img, name, size):
    img.resize((size, size), Image.LANCZOS).save(ICONS / name, optimize=True)
    print('wrote icons/' + name)


def font(names, size):
    for n in names:
        p = Path('C:/Windows/Fonts') / n
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def og_image(tile):
    W, H = 1200, 630
    # The icon's sky: mint at the left, sky blue, then lavender; a sunset glow low on the right.
    x = np.linspace(0, 1, W)[None, :, None]
    y = np.linspace(0, 1, H)[:, None, None]
    mint, sky, lav = np.array([126, 232, 211]), np.array([142, 197, 255]), np.array([183, 148, 246])
    t = x * 0.85 + y * 0.15
    bg = np.where(t < 0.5, mint + (sky - mint) * (t / 0.5), sky + (lav - sky) * ((t - 0.5) / 0.5))
    glow = np.exp(-(((x - 0.82) / 0.35) ** 2 + ((y - 1.05) / 0.45) ** 2))
    bg = bg * (1 - glow * 0.55) + np.array([253, 196, 140]) * glow * 0.55
    img = Image.fromarray(np.clip(bg, 0, 255).astype(np.uint8), 'RGB').convert('RGBA')
    s = 440
    t2 = tile.resize((s, s), Image.LANCZOS)
    shadow = Image.new('RGBA', (s + 120, s + 120), (0, 0, 0, 0))
    sh = Image.new('RGBA', (s, s), (40, 20, 90, 90)); sh.putalpha(t2.getchannel('A').point(lambda v: v * 90 // 255))
    shadow.paste(sh, (60, 80), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    img.alpha_composite(shadow, (40, 35))
    img.alpha_composite(t2, (100, 95))
    d = ImageDraw.Draw(img)
    big = font(['segoeuib.ttf', 'arialbd.ttf'], 84)
    mid = font(['segoeuib.ttf', 'arialbd.ttf'], 38)
    small = font(['segoeui.ttf', 'arial.ttf'], 30)
    d.text((600, 150), 'My Dream', font=big, fill=(22, 101, 84))
    d.text((600, 242), 'Bucket', font=big, fill=(76, 29, 149))
    d.text((604, 362), 'Dream it. Plan it. Live it.', font=mid, fill=(30, 20, 66))
    d.text((604, 420), 'Your bucket list, the places you have been', font=small, fill=(52, 40, 100))
    d.text((604, 458), 'and the memories - private, on your phone.', font=small, fill=(52, 40, 100))
    img.convert('RGB').save(ICONS / 'og-image.png', optimize=True)
    print('wrote icons/og-image.png')


def main():
    src = Image.open(SRC)
    tile = cut_tile(src)
    print('tile', tile.size)
    for s in (192, 512):
        save(tile, 'icon-%d.png' % s, s)
    square = full_bleed(tile)
    for s in (192, 512):
        save(square, 'maskable-%d.png' % s, s)
    save(square, 'apple-touch-icon.png', 180)
    save(tile, 'favicon-32.png', 32)
    tile.resize((256, 256), Image.LANCZOS).save(ICONS / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    print('wrote icons/favicon.ico')
    og_image(tile)


if __name__ == '__main__':
    main()
