#!/usr/bin/env python3
"""Score and sound for "Your shop is a link" (ShopLink). Reads src/shop-cues.json and
public/shop/audio/vo.json; writes public/shop/audio/score.wav. Mastered by scripts/mix-shop.mjs.

A warm kalimba and music-box piece at 96 BPM in F (F, Dm, Bb, C), in sections that follow the story:
  village  sparse kalimba over a pad, the loom's wooden ticks as each row is woven
  road     Kovi's footsteps as soft plucks on the half beat, the harmony sinks; DECLINED is a thump
           and two falling notes
  shop     the groove starts (bass, shaker, snaps); each weaving lands on a rising note
  link     a whoosh into the screen, a pop as the link lifts, the camera pulls back to the world, three
           whooshes along the arcs and a bell on each city, rising
  buyers   the full groove; a tap, then a chime and glints on each Paid!, rising
  today    coins clink into the Today card, rising
  end      a breath, then the last chord in bells, a music-box line under "Your shop is a link"
The music ducks about 8 dB under the voice, the effects about 3 dB.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, band, bass, bell, blip, boing, glint, high, kalimba, knock, low, mtof, musicbox, noise, pad, shaker, snap, tap, thump, ts, whoosh  # noqa: E402

cues = json.load(open('src/shop-cues.json'))
vo = json.load(open('public/shop/audio/vo.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / 96
BAR = 4 * BEAT

music = np.zeros((2, N))
fx = np.zeros((2, N))

SHOP = cues['shopIn']
BUYERS_END = cues['todayIn']
END = cues['endIn']
FLIP = (SHOP - 0.7, SHOP + 0.5)


def pluck(m, vel=1.0):
    """A soft nylon pluck for Kovi's steps."""
    f, t = mtof(m), ts(0.5)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.12) + 0.3 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.05)
    return low(s * np.minimum(1, t / 0.003), 2400) * vel * 0.22


def clink(m, vel=1.0):
    """A coin: an inharmonic ring tuned to a note."""
    t = ts(1.0)
    f = mtof(m)
    s = np.zeros_like(t)
    for ratio, amp, decay in [(1, 1, 0.45), (2.76, 0.5, 0.2), (5.4, 0.3, 0.08)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / decay)
    return s * np.minimum(1, t / 0.0008) * vel * 0.13


def pop(vel=1.0):
    """A cork-like pop: a quick pitch drop."""
    t = ts(0.14)
    f = 900 * np.exp(-t / 0.02) + 280
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.035) * vel * 0.3


# ── music ───────────────────────────────────────────────────────────────────────────────────
CHORDS = {
    'F': ([65, 69, 72, 77], 41, [53, 57, 60]),
    'Dm': ([62, 65, 69, 74], 38, [50, 53, 57]),
    'Bb': ([62, 65, 70, 74], 46, [50, 53, 58]),
    'C': ([64, 67, 72, 76], 48, [52, 55, 60]),
    'Gm': ([62, 67, 70, 74], 43, [50, 55, 58]),
}
ARP = [0, 2, 3, 1, 2, 3, 1, 2]


def section(t):
    if t < cues['road'][0] - 0.6:
        return 'village'
    if t < FLIP[0]:
        return 'road'
    if t < cues['fly'][1]:
        return 'shop'
    if t < BUYERS_END:
        return 'buyers'
    if t < END:
        return 'today'
    return 'end'


PROG = {
    'village': ['F', 'Dm', 'Bb', 'C'],
    'road': ['Dm', 'Bb', 'Gm', 'C'],
    'shop': ['F', 'C', 'Dm', 'Bb'],
    'buyers': ['F', 'C', 'Dm', 'Bb'],
    'today': ['F', 'C', 'Bb', 'C'],
    'end': ['F', 'F', 'F', 'F'],
}
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    start = b * BAR
    sec = section(start + 0.05)
    name = PROG[sec][b % 4]
    arp, root, triad = CHORDS[name]
    add(music, pad(triad, BAR + 0.6, vel=0.9 if sec in ('village', 'road') else 1.0), start)
    if sec == 'village':
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.7), start + i * BEAT, pan=-0.2 + 0.12 * i)
        continue
    if sec == 'road':
        for i, idx in enumerate([0, 3]):
            add(music, kalimba(arp[idx], 0.6), start + i * 2 * BEAT, pan=-0.1)
        add(music, bass(root, 0.6), start)
        continue
    if sec == 'end':
        continue
    light = sec == 'shop' and start < SHOP + BAR
    for i, idx in enumerate(ARP):
        add(music, kalimba(arp[idx] + 12, 0.85 if i % 2 == 0 else 0.55), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
    add(music, bass(root, 0.9), start)
    add(music, bass(root, 0.7), start + 2 * BEAT)
    add(music, bass(root + 7, 0.55), start + 3.5 * BEAT)
    if not light:
        for i in range(8):
            add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2 + (0.02 if i % 2 else 0), pan=0.35)
        add(music, snap(b * 3, 0.9), start + BEAT, pan=-0.15)
        add(music, snap(b * 3 + 1, 0.9), start + 3 * BEAT, pan=-0.15)
    if sec == 'buyers' and b % 2 == 1:
        for i, m in enumerate([77, 76, 72, 74]):  # a music-box answer every other bar
            add(music, musicbox(m + 12, 0.45), start + (4 + i) * BEAT / 2, pan=0.3)

# The end: one held chord, and a music-box line under "Your shop is a link".
add(music, pad([53, 57, 60, 65], DUR - END + 0.5, vel=1.2), END)
for i, m in enumerate([72, 77, 81, 84]):
    add(music, bell(mtof(m), 3.0, 0.5), cues['logo'] + i * 0.05, pan=-0.3 + 0.2 * i)
for i, m in enumerate([81, 79, 77, 79, 81, 84]):
    add(music, musicbox(m, 0.6), cues['line'] + i * BEAT / 2, pan=0.2)

# ── village ─────────────────────────────────────────────────────────────────────────────────
rows = 18
w0, w1 = cues['weave']
for k in range(rows):
    add(fx, knock() * 0.5, w0 + (k + 1) * (w1 - w0) / rows, pan=0.4 + (0.1 if k % 2 else -0.1))
add(fx, bell(mtof(84), 1.6, 0.35), w1 + 0.05, pan=0.4)
add(fx, pop(0.8), 3.45, pan=0.35)  # Kovi peeks over the loom
add(fx, boing() * 0.5, w1 + 0.05, pan=0.35)
add(fx, whoosh(1.4, 500, 1400, 3, peak=0.5, vel=0.45), cues['road'][0] - 0.9)  # the pan to the road

# ── road ────────────────────────────────────────────────────────────────────────────────────
r0, r1 = cues['road']
step = 1 / 3.2
k = 0
t = r0 + step / 2
while t < r1:
    add(fx, pluck([62, 65, 69, 65][k % 4], 0.8), t, pan=-0.4 + 0.8 * (t - r0) / (r1 - r0))
    t += step
    k += 1
add(fx, bell(mtof(74), 1.2, 0.25), r1 - 0.2, pan=0.6)  # the bank
d = cues['declined']
add(fx, whoosh(0.5, 2400, 600, 21, peak=0.7, vel=0.5), d - 0.7)  # the card drops in
add(fx, thump(0.9), d)
add(fx, blip(64, 0.8), d + 0.25)
add(fx, blip(59, 0.8), d + 0.5)
add(fx, boing() * 0.6, d + 0.12, pan=0.5)

# ── shop ────────────────────────────────────────────────────────────────────────────────────
add(fx, whoosh(FLIP[1] - FLIP[0], 300, 2600, 31, peak=0.5, vel=0.8), FLIP[0])  # the card flips into the phone
add(fx, thump(0.35), FLIP[1])
for i, at in enumerate(cues['items']):
    add(fx, pop(0.7), at - 0.5, pan=-0.2)
    add(fx, whoosh(0.55, 800, 3000, 40 + i, peak=0.6, vel=0.35), at, pan=0.3)
    add(fx, blip([72, 76, 79, 84][i], 0.9), at + 0.55, pan=0.4)
add(fx, tap(), cues['shareSwap'] - 0.05, pan=0.4)

# ── link ────────────────────────────────────────────────────────────────────────────────────
lo = cues['linkOut']
add(fx, whoosh(1.1, 300, 3600, 51, peak=0.85, vel=0.9), lo - 1.0)  # into the screen
add(fx, pop(1.0), lo)
add(fx, bell(mtof(84), 1.4, 0.35), lo + 0.05)
f0, f1 = cues['fly']
add(fx, whoosh(1.0, 3600, 500, 52, peak=0.3, vel=0.7), f0 - 0.3)  # the camera pulls back to the world
for i in range(14):
    add(fx, glint(i + 70) * 0.7, f0 - 0.1 + i * 0.05, pan=-0.6 + 0.09 * i)  # the map's dots ripple in
for i, m in enumerate([81, 84, 88]):
    a = f0 + 0.5 + 0.25 * i
    add(fx, whoosh(1.5, 600, 2400, 60 + i, peak=0.55, vel=0.5), a, pan=[-0.5, 0.0, 0.6][i])
    add(fx, bell(mtof(m), 1.8, 0.5), a + 1.5, pan=[-0.5, 0.0, 0.6][i])
    add(fx, pop(0.6), a + 1.5, pan=[-0.5, 0.0, 0.6][i])

# ── buyers ──────────────────────────────────────────────────────────────────────────────────
PANS = {'yuki': 0.6, 'lena': 0.0, 'sam': -0.6}
for i, b in enumerate(['yuki', 'lena', 'sam']):
    inAt = f1 + 0.1 + i * 0.15
    add(fx, whoosh(0.6, 500, 2600, 80 + i, peak=0.5, vel=0.45), inAt, pan=PANS[b])
    add(fx, tap(), cues['bags'][i], pan=PANS[b])
    paid = cues['paid'][i]
    add(fx, tap(), paid - 0.55, pan=PANS[b])
    for j, m in enumerate([[79, 84, 88], [81, 86, 89], [84, 88, 91]][i]):
        add(fx, bell(mtof(m), 1.6, 0.45), paid + j * 0.04, pan=PANS[b])
    for j in range(4):
        add(fx, glint(i * 10 + j), paid + 0.08 + j * 0.06, pan=PANS[b])
    add(fx, pop(0.6), paid + 0.2, pan=PANS[b])

# ── today ───────────────────────────────────────────────────────────────────────────────────
add(fx, whoosh(0.9, 400, 2000, 90, peak=0.5, vel=0.5), cues['todayIn'] - 0.8)
for i, at in enumerate(cues['count']):
    add(fx, whoosh(1.4, 1200, 4800, 95 + i, peak=0.85, vel=0.35), at - 1.4, pan=0.4)
    add(fx, clink([84, 88, 91][i], 1.0), at, pan=0.4)
    add(fx, thump(0.25), at)
add(fx, boing() * 0.6, cues['count'][2] + 0.05)

# ── end ─────────────────────────────────────────────────────────────────────────────────────
add(fx, whoosh(0.9, 500, 2400, 110, peak=0.5, vel=0.5), END - 0.3)  # the phone turns round
add(fx, blip(91, 0.6), cues['url'], pan=0.0)
add(fx, pop(0.7), cues['url'] + 0.05)
add(fx, pop(0.6), cues['logo'] + 0.2, pan=0.4)  # Kovi waves

# ── duck under the voice ────────────────────────────────────────────────────────────────────
speech = np.zeros(N)
for line in vo['lines']:
    a = int(cues['vo'][line['id']] * SR)
    speech[a : a + int(line['duration'] * SR)] = 1
ramp = int(0.18 * SR)
speech = np.convolve(speech, np.ones(ramp) / ramp, mode='same')
music *= 1 - 0.6 * speech  # about 8 dB
fx *= 1 - 0.3 * speech  # about 3 dB

mixed = high(music * 0.85 + fx * 1.0, 35)
tail = int(1.2 * SR)
mixed[:, -tail:] *= np.linspace(1, 0, tail)
mixed = mixed / np.max(np.abs(mixed)) * 0.8
with wave.open('public/shop/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'score.wav: {DUR} s')
