#!/usr/bin/env python3
"""Score and sound for "Kova comes to your shop" (KovaPointFilm). Reads src/atm/point-cues.json and
public/point/audio/vo.json; writes public/point/audio/score.wav. Mastered by scripts/mix-point.mjs.

Warm kalimba and music box at 96 BPM in F, as in "Your shop is a link". Dawn is a held pad and the
sign's bell; the groove starts at the reveal. Effects follow the machine: the card's whoosh and tap,
screen blips, bells on Sent!, a coin launching for Berlin, the drawer's motor and notes, coins
landing from abroad, and a last bell chord. The music ducks under the voice.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, band, bass, bell, blip, boing, glint, high, kalimba, low, mtof, musicbox, noise, pad, printer, shaker, snap, tap, thump, ts, whoosh  # noqa: E402

cues = json.load(open('src/atm/point-cues.json'))
vo = json.load(open('public/point/audio/vo.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / 96
BAR = 4 * BEAT
music = np.zeros((2, N))
fx = np.zeros((2, N))

CH = {'F': ([65, 69, 72, 77], 41, [53, 57, 60]), 'C': ([64, 67, 72, 76], 48, [52, 55, 60]), 'Dm': ([62, 65, 69, 74], 38, [50, 53, 57]), 'Bb': ([62, 65, 70, 74], 46, [50, 53, 58])}
PROG = ['F', 'C', 'Dm', 'Bb']
ARP = [0, 2, 3, 1, 2, 3, 1, 2]
groove_from = cues['title'][0]
END = cues['endIn']
for b in range(int(np.ceil(DUR / BAR))):
    start = b * BAR
    name = PROG[b % 4] if start < END else 'F'
    arp, root, triad = CH[name]
    add(music, pad(triad, BAR + 0.6, vel=0.8 if start < groove_from else 1.0), start)
    if start < groove_from - 0.1 or start >= END:
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.55), start + i * BEAT, pan=-0.2 + 0.12 * i)
        continue
    for i, idx in enumerate(ARP):
        add(music, kalimba(arp[idx] + 12, 0.85 if i % 2 == 0 else 0.55), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
    add(music, bass(root, 0.9), start)
    add(music, bass(root, 0.7), start + 2 * BEAT)
    for i in range(8):
        add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2, pan=0.35)
    add(music, snap(b * 3, 0.85), start + BEAT, pan=-0.15)
    add(music, snap(b * 3 + 1, 0.85), start + 3 * BEAT, pan=-0.15)
add(music, pad([53, 57, 60, 65], DUR - END + 0.5, vel=1.2), END)
for i, m in enumerate([72, 77, 81, 84]):
    add(music, bell(mtof(m), 3.0, 0.5), cues['vo']['end'] + 0.3 + i * 0.05, pan=-0.3 + 0.2 * i)
for i, m in enumerate([81, 79, 77, 79, 81, 84]):
    add(music, musicbox(m, 0.55), cues['line'] + i * BEAT / 2, pan=0.2)


def hum(seconds):
    """A sign's lightbox coming on: a soft electric hum that settles."""
    t = ts(seconds)
    s = np.sin(2 * np.pi * 100 * t) + 0.4 * np.sin(2 * np.pi * 200 * t)
    return low(s, 600) * np.minimum(1, t / 0.05) * np.exp(-t / 0.8) * 0.12


def motor(seconds):
    """The cash drawer: a small motor with paper feeding."""
    t = ts(seconds)
    s = band(noise(seconds, 77), 300, 1400) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * t))
    return s * np.minimum(1, t / 0.05) * np.minimum(1, (seconds - t) / 0.08) * 0.25


def clink(m, vel=1.0):
    t = ts(1.0)
    f = mtof(m)
    s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for r, a, d in [(1, 1, 0.45), (2.76, 0.5, 0.2), (5.4, 0.3, 0.08)])
    return s * np.minimum(1, t / 0.0008) * vel * 0.13


d0, d1 = cues['dawn']
add(fx, hum(1.4), d0 + 0.1)
add(fx, bell(mtof(84), 2.0, 0.35), d0 + 0.3, pan=0.1)
add(fx, whoosh(2.2, 400, 1200, 5, peak=0.5, vel=0.4), 5.6)
add(fx, whoosh(1.6, 500, 2000, 6, peak=0.5, vel=0.4), 11.0)
c0, c1 = cues['card']
add(fx, whoosh(c1 - c0, 600, 3200, 11, peak=0.8, vel=0.8), c0, pan=0.4)
add(fx, tap(), c1)
add(fx, blip(84, 0.9), c1 + 0.08)
add(fx, blip(88, 0.8), cues['menu'] + 0.05)
add(fx, blip(86, 0.7), cues['send'] + 0.05)
add(fx, tap(), cues['done'] - 0.45, pan=0.2)
for i, m in enumerate([79, 84, 88]):
    add(fx, bell(mtof(m), 1.6, 0.45), cues['done'] + i * 0.04)
for i in range(5):
    add(fx, glint(i), cues['done'] + 0.08 + i * 0.06, pan=-0.3 + 0.15 * i)
l0, l1 = cues['launch']
add(fx, whoosh(l1 - l0, 800, 4200, 21, peak=0.4, vel=0.6), l0, pan=0.6)
add(fx, bell(mtof(91), 1.2, 0.3), cues['lena'], pan=0.7)
add(fx, blip(84, 0.7), cues['cash'] + 0.05)
n0, n1 = cues['notes']
add(fx, motor(n1 - n0), n0)
add(fx, printer(), n0 + 0.1, pan=0.2)
add(fx, boing() * 0.4, n1 + 0.05)
for i, at in enumerate(cues['home']):
    add(fx, whoosh(1.2, 1200, 4800, 31 + i, peak=0.85, vel=0.4), at, pan=[-0.6, 0.6, -0.2][i])
    add(fx, clink([84, 88, 91][i]), at + 1.2)
    add(fx, thump(0.2), at + 1.2)
add(fx, whoosh(1.2, 400, 1600, 40, peak=0.5, vel=0.45), END)
add(fx, blip(91, 0.6), cues['url'])

speech = np.zeros(N)
for line in vo['lines']:
    a = int(cues['vo'][line['id']] * SR)
    speech[a : a + int(line['duration'] * SR)] = 1
ramp = int(0.18 * SR)
speech = np.convolve(speech, np.ones(ramp) / ramp, mode='same')
music *= 1 - 0.6 * speech
fx *= 1 - 0.3 * speech
mixed = high(music * 0.85 + fx, 35)
tail = int(1.2 * SR)
mixed[:, -tail:] *= np.linspace(1, 0, tail)
mixed = mixed / np.max(np.abs(mixed)) * 0.8
with wave.open('public/point/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'score.wav: {DUR} s')
