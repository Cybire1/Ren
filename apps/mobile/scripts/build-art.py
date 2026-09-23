"""
Builds assets/art from the generated artwork in docs/design/art-source, as painted.

Nothing is recoloured. The script only does what the app needs on top:
- avatar-7 arrives as a portrait on a square tile; it is cut to its circle like the others;
- the sparkle and snowflake strips are split into single pieces for animation.

  python3 scripts/build-art.py
"""
import os
import shutil
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '..', '..', 'docs', 'design', 'art-source')
DST = os.path.join(ROOT, 'assets', 'art')


def circle_crop(path_in, path_out):
    """Keeps the painted disc of a square portrait: the largest circle inside the ink ring."""
    im = Image.open(path_in).convert('RGBA')
    a = np.array(im).astype(int)
    ink = (a[:, :, 3] > 200) & (a[:, :, :3].sum(2) < 160)
    ys, xs = np.nonzero(ink)
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2
    S = 4
    big = im.resize((im.width * S, im.height * S), Image.LANCZOS)
    mask = Image.new('L', big.size, 0)
    ImageDraw.Draw(mask).ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=255)
    out = Image.new('RGBA', big.size, (0, 0, 0, 0))
    out.paste(big, (0, 0), mask)
    box = tuple(int(v * S) for v in (cx - r, cy - r, cx + r, cy + r))
    out.crop(box).resize((512, 512), Image.LANCZOS).save(path_out)


def split(strip, prefix, name_of=None):
    """Cuts a strip of separate shapes into one square PNG per shape, left to right."""
    a = np.array(Image.open(os.path.join(SRC, strip)).convert('RGBA'))
    lab, _ = ndimage.label(ndimage.binary_dilation(a[:, :, 3] > 20, iterations=4))
    pieces = sorted(ndimage.find_objects(lab), key=lambda o: o[1].start)
    names = []
    for i, (ys, xs) in enumerate(pieces, 1):
        side = max(xs.stop - xs.start, ys.stop - ys.start) + 8
        mx, my = (xs.start + xs.stop) // 2, (ys.start + ys.stop) // 2
        crop = Image.fromarray(a).crop((mx - side // 2, my - side // 2, mx + side // 2, my + side // 2))
        name = f'{prefix}-{i}.png'
        crop.save(os.path.join(DST, name))
        names.append(name)
    return names


if __name__ == '__main__':
    for name in os.listdir(DST):
        if name.endswith('.png'):
            os.remove(os.path.join(DST, name))
    for name in sorted(os.listdir(SRC)):
        if name.endswith('.png'):
            shutil.copy(os.path.join(SRC, name), os.path.join(DST, name))
    circle_crop(os.path.join(SRC, 'avatar-7.png'), os.path.join(DST, 'avatar-7.png'))
    print('sparkles:', split('sparkles.png', 'sparkle'))
    print('snowflakes:', split('snowflakes.png', 'snowflake'))
    print('art built in', DST)
