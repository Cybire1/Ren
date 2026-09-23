"""
Recolours Kova's flat artwork from its original palette to the app's current one.

The art is flat fills with ink outlines, so each pixel is moved by the offset between its
nearest source colour and that colour's replacement; anti-aliased edges shift with it.

  python3 scripts/recolor-art.py   (reads docs/design/art-source, writes assets/art)
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', '..', 'docs', 'design', 'art-source')
DST = os.path.join(ROOT, 'assets', 'art')

# old palette -> new palette (warm paper, teal, coral, yellow)
MAP = {
    '#A7B6F7': '#46878B',  # periwinkle -> teal
    '#DCE2FB': '#DEDCD8',  # light periwinkle -> paper shade
    '#E5A8F0': '#D46558',  # orchid -> coral
    '#C77FD9': '#A94B40',  # deep orchid -> deep coral
    '#EAC45E': '#EBB3AA',  # mustard -> soft coral (the coin colour)
    '#F09A48': '#D46558',  # tangerine -> coral
    '#6FD3A0': '#8FB9BB',  # mint -> light teal
    '#F4A7A0': '#E8A89C',  # blush
    '#FFFFFF': '#F1EFEA',  # white -> warm surface
    '#0D0D12': '#0B1A1D',  # ink -> teal-black
}
hexrgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], dtype=float)
OLD = np.stack([hexrgb(k) for k in MAP])
DELTA = np.stack([hexrgb(v) - hexrgb(k) for k, v in MAP.items()])

def recolor(path_in, path_out, mapping=None):
    """Moves palette fills and their anti-aliased ink edges; leaves other colours (skin) alone."""
    mapping = mapping or MAP
    old = np.stack([hexrgb(k) for k in mapping])
    delta_all = np.stack([hexrgb(v) - hexrgb(k) for k, v in mapping.items()])
    im = Image.open(path_in).convert('RGBA')
    a = np.array(im).astype(float)
    rgb = a[:, :, :3]
    ink = hexrgb('#0D0D12')
    ink_delta = hexrgb(mapping['#0D0D12']) - ink
    # Distance from each pixel to each segment ink -> palette colour, and where along it.
    seg = old - ink                                                    # k, 3
    t = ((rgb[:, :, None, :] - ink) * seg).sum(-1) / (seg * seg).sum(-1).clip(1)
    t = t.clip(0, 1)
    proj = ink + t[..., None] * seg                                    # h, w, k, 3
    dist = np.sqrt(((rgb[:, :, None, :] - proj) ** 2).sum(-1))         # h, w, k
    k = dist.argmin(-1)
    best = np.take_along_axis(dist, k[..., None], -1)[..., 0]
    tk = np.take_along_axis(t, k[..., None], -1)[..., 0]
    shift = tk[..., None] * delta_all[k] + (1 - tk[..., None]) * ink_delta
    keep = best > 14  # not a palette colour or an ink edge of one: leave it as painted
    # Skin tones are warm browns (red > green > blue); keep them unless they are a palette fill.
    r, g, bl = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    near_fill = np.sqrt(((rgb[:, :, None, :] - old[None, None]) ** 2).sum(-1)).min(-1) < 20
    keep |= (r > g) & (g > bl) & (r - bl > 30) & ~near_fill
    shift[keep] = 0
    a[:, :, :3] = np.clip(rgb + shift, 0, 255)
    Image.fromarray(a.astype(np.uint8), 'RGBA').save(path_out)


def finish():
    """Fits the recoloured art to the app: crops, circular avatars, single sparkles."""
    from PIL import ImageDraw
    from scipy import ndimage

    at = lambda n: os.path.join(DST, n)
    # Frozen card: the active card in frost colours, with no character baked in (the app draws
    # Kovi asleep on top of it).
    frost = dict(MAP, **{'#A7B6F7': '#DEDCD8', '#E5A8F0': '#F1EFEA', '#EAC45E': '#F1EFEA', '#C77FD9': '#DEDCD8'})
    recolor(os.path.join(SRC, 'card-active.png'), at('card-frozen-body.png'), frost)
    Image.open(at('card-frozen-body.png')).crop((162, 154, 1059, 730)).save(at('card-frozen-body.png'))

    # Cards: crop to the card body (the app sets text on it at known offsets).
    Image.open(at('card-active.png')).crop((162, 154, 1059, 730)).save(at('card-active.png'))
    Image.open(at('card-frozen.png')).crop((162, 61, 1059, 785)).save(at('card-frozen.png'))

    # Avatars: clip to the painted circle and redraw its ring, so shoulders sit inside it.
    S, cx, cy, r = 4, 256, 255, 236
    ink = (13, 13, 18, 255)
    for i in range(1, 7):
        n = at(f'avatar-{i}.png')
        im = Image.open(n).convert('RGBA').resize((512 * S, 512 * S), Image.LANCZOS)
        mask = Image.new('L', im.size, 0)
        ImageDraw.Draw(mask).ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=255)
        out = Image.new('RGBA', im.size, (0, 0, 0, 0))
        out.paste(im, (0, 0), mask)
        ImageDraw.Draw(out).ellipse([(cx - r + 4) * S, (cy - r + 4) * S, (cx + r - 4) * S, (cy + r - 4) * S], outline=ink, width=9 * S)
        out.crop(((cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S)).resize((2 * r, 2 * r), Image.LANCZOS).save(n)

    # Sparkles: split the strip into single sparkles, named by their original colour.
    src = np.array(Image.open(os.path.join(SRC, 'sparkles.png')).convert('RGBA'))
    strip = Image.open(at('sparkles.png')).convert('RGBA')
    lab, _ = ndimage.label(src[:, :, 3] > 20)
    ref = {'mustard': (234, 196, 94), 'white': (255, 255, 255), 'orchid': (229, 168, 240), 'tangerine': (240, 154, 72)}
    best = {}
    for i, (ys, xs) in enumerate(ndimage.find_objects(lab), 1):
        m = (lab[ys, xs] == i) & (src[ys, xs, 3] > 200)
        px = src[ys, xs][m][:, :3]
        px = px[px.sum(1) > 200]
        col = np.median(px, axis=0) if len(px) else np.zeros(3)
        name = min(ref, key=lambda k: ((col - np.array(ref[k])) ** 2).sum())
        if xs.stop - xs.start > best.get(name, (0,))[0]:
            best[name] = (xs.stop - xs.start, xs, ys)
    # Snowflakes: split the strip into single flakes for the frozen card's snowfall.
    flakes = np.array(Image.open(at('snowflakes.png')).convert('RGBA'))
    lab, _ = ndimage.label(ndimage.binary_dilation(flakes[:, :, 3] > 20, iterations=3))
    for i, (ys, xs) in enumerate(sorted(ndimage.find_objects(lab), key=lambda o: o[1].start), 1):
        side = max(xs.stop - xs.start, ys.stop - ys.start) + 6
        mx, my = (xs.start + xs.stop) // 2, (ys.start + ys.stop) // 2
        Image.fromarray(flakes).crop((mx - side // 2, my - side // 2, mx + side // 2, my + side // 2)).save(at(f'snowflake-{i}.png'))

    for name, (_, xs, ys) in best.items():
        side = max(xs.stop - xs.start, ys.stop - ys.start) + 8
        mx, my = (xs.start + xs.stop) // 2, (ys.start + ys.stop) // 2
        strip.crop((mx - side // 2, my - side // 2, mx + side // 2, my + side // 2)).save(at(f'sparkle-{name}.png'))


if __name__ == '__main__':
    for name in sorted(os.listdir(SRC)):
        if not name.endswith('.png'):
            continue
        if name.startswith('avatar-'):
            # People keep their original colours, as generated.
            Image.open(os.path.join(SRC, name)).save(os.path.join(DST, name))
        else:
            recolor(os.path.join(SRC, name), os.path.join(DST, name))
    finish()
    print('art rebuilt in', DST)
