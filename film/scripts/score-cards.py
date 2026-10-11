#!/usr/bin/env python3
"""Score and sound for "Pick a card" (KovaCards). Reads src/cards-cues.json; writes public/audio/cards-score.wav.

A playful kalimba groove at 112 BPM (C, Am, F, G) under crisp card sounds: a whoosh and a landing for
the spin-in, a flick for every card that arrives, a clink for the metal one, a shuffle as they fan
into a hand, a flip, and bells on the name. Mastered by scripts/mix-cards.mjs.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, band, bass, bell, blip, boing, glint, high, kalimba, low, mtof, musicbox, noise, pad, shaker, snap, thump, ts, whoosh  # noqa: E402

cues = json.load(open('src/cards-cues.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / cues['bpm']
BAR = 4 * BEAT

music = np.zeros((2, N))
fx = np.zeros((2, N))


def flick(seed, vel=1.0):
    """A card snapped down: a bright paper click with a small body."""
    t = ts(0.09)
    s = band(noise(0.09, seed), 2200, 7000) * np.exp(-t / 0.012)
    s += 0.5 * low(noise(0.09, seed + 1), 600) * np.exp(-t / 0.02)
    return s * vel * 0.5


def clink(vel=1.0):
    """Metal: an inharmonic ring, short and bright."""
    t = ts(1.2)
    s = np.zeros_like(t)
    for ratio, amp, decay in [(1, 1, 0.5), (2.41, 0.6, 0.3), (3.93, 0.4, 0.18), (5.8, 0.25, 0.1)]:
        s += amp * np.sin(2 * np.pi * 1320 * ratio * t) * np.exp(-t / decay)
    return s * np.minimum(1, t / 0.0008) * vel * 0.12


def shimmer(seconds=0.6):
    """The sheen crossing a card: a soft rising air."""
    return whoosh(seconds, 3000, 9000, 77, peak=0.55, vel=0.25)


# ── music ───────────────────────────────────────────────────────────────────────────────────
CHORDS = {'C': ([72, 76, 79, 84], 48, [60, 64, 67]), 'Am': ([69, 72, 76, 81], 45, [57, 60, 64]), 'F': ([65, 69, 72, 77], 41, [53, 57, 60]), 'G': ([67, 71, 74, 79], 43, [55, 59, 62])}
LOOP = ['C', 'Am', 'F', 'G']
ARP = [0, 2, 3, 1, 2, 3, 1, 2]
flow0 = cues['flow'][0]
bars = int(np.ceil(DUR / BAR))
for b in range(bars):
    start = b * BAR
    name = LOOP[b % 4] if start < cues['end'] - 0.1 else 'C'
    arp, root, triad = CHORDS[name]
    ending = start >= cues['end'] - 0.1
    add(music, pad(triad, BAR + 0.6, vel=1.3 if ending else 1.0), start)
    if start < flow0 - 0.1 or ending:
        for i, idx in enumerate([0, 2, 3, 2]):  # sparse: the hero and the name breathe
            add(music, kalimba(arp[idx], 0.8 if i else 0.95), start + i * BEAT, pan=-0.2 + 0.12 * i)
        continue
    for i, idx in enumerate(ARP):
        add(music, kalimba(arp[idx], 0.95 if i % 2 == 0 else 0.6), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
    add(music, bass(root, 1.0), start)
    add(music, bass(root, 0.8), start + 2 * BEAT)
    for i in range(8):
        add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2 + (0.02 if i % 2 else 0), pan=0.35)
    add(music, snap(b * 3, 1.0), start + BEAT, pan=-0.15)
    add(music, snap(b * 3 + 1, 1.0), start + 3 * BEAT, pan=-0.15)

# ── the cards ───────────────────────────────────────────────────────────────────────────────
spin0, spin1 = cues['spin']
add(fx, whoosh(spin1 - spin0 + 0.15, 250, 3200, 11, peak=0.8, vel=1.1), spin0)
add(fx, thump(0.7), spin1)
add(fx, flick(1, 1.2), spin1 + 0.01)
add(fx, shimmer(0.7), cues['sheen1'])
for i, at in enumerate([0.12, 0.3, 0.45]):
    add(fx, glint(i), cues['sheen1'] + at, pan=0.3)

notes = [72, 74, 76, 79, 81, 84]
for i, at in enumerate(cues['flow']):
    if i == 0:
        add(fx, whoosh(0.7, 500, 2600, 12, peak=0.6, vel=0.55), at - 0.35, pan=0.5)  # the others slide in
        continue
    add(fx, whoosh(0.55, 700, 3000, 20 + i, peak=0.5, vel=0.55), at, pan=0.4)
    add(fx, flick(30 + i, 0.9), at + 0.5, pan=0.1)
    add(fx, musicbox(notes[i], 0.8), at + 0.5, pan=-0.1)  # each card one note higher
    add(fx, shimmer(0.6), at + 0.4, pan=0.2)
add(fx, clink(1.0), cues['flow'][2] + 0.55, pan=0.2)  # the metal card

for i in range(6):  # dealt into a hand
    add(fx, flick(60 + i, 0.8), cues['fan'][1] - 0.25 + i * 0.07, pan=-0.5 + 0.2 * i)
add(fx, whoosh(0.8, 400, 2200, 70, peak=0.5, vel=0.5), cues['fan'][0], pan=0.0)

add(fx, whoosh(cues['pull'][1] - cues['pull'][0] + 0.2, 300, 2400, 80, peak=0.6, vel=0.7), cues['pull'][0])
for i in range(5):  # the others fall away
    add(fx, flick(90 + i, 0.35), cues['pull'][0] + 0.35 + i * 0.05, pan=-0.4 + 0.2 * i)
add(fx, whoosh(cues['flip'][1] - cues['flip'][0] + 0.1, 900, 4200, 81, peak=0.5, vel=0.5), cues['flip'][0])
add(fx, flick(95, 1.0), cues['flip'][1])
add(fx, blip(84, 0.7), cues['whereLine'] + 0.05, pan=0.2)

for i, m in enumerate([72, 76, 79, 84]):  # the name
    add(fx, bell(mtof(m), 2.6, 0.55), cues['end'] + i * 0.035, pan=-0.3 + 0.2 * i)
add(fx, whoosh(cues['kovi'][1] - cues['kovi'][0], 350, 2600, 90, peak=0.5, vel=0.7), cues['kovi'][0])
add(fx, bell(mtof(88), 1.8, 0.4), cues['url'], pan=0.1)
add(fx, blip(91, 0.6), cues['url'] + 0.4, pan=0.0)

# Kovi on the line: a pop, two peeks, a boing, a soft landing, a hello, and the hop back down.
def pop(vel=1.0):
    t = ts(0.14)
    f = 300 + 900 * (1 - np.exp(-t / 0.03))
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.05) * vel * 0.3


add(fx, pop(1.0), cues['peek'] + 0.03, pan=0.0)
add(fx, blip(93, 0.55), cues['look'][0] + 0.2, pan=-0.35)
add(fx, blip(96, 0.55), cues['look'][0] + 0.65, pan=0.35)
add(fx, boing(), cues['jump'][1], pan=0.0)
add(fx, thump(0.35), cues['jump'][2], pan=0.0)
add(fx, flick(120, 0.5), cues['jump'][2] + 0.01)
for i, m in enumerate([84, 88, 91]):
    add(fx, bell(mtof(m), 1.4, 0.4), cues['wave'][0] + 0.05 + i * 0.15, pan=-0.3 + 0.3 * i)
for i in range(4):
    add(fx, glint(i + 20), cues['wave'][0] + 0.05 + i * 0.15, pan=-0.5 + 0.33 * i)
add(fx, boing() * 0.7, cues['exit'][1], pan=0.0)
add(fx, whoosh(0.4, 1800, 400, 121, peak=0.4, vel=0.35), cues['exit'][1] + 0.15)

mixed = high(music * 0.8 + fx * 1.0, 35)
tail = int(0.8 * SR)
mixed[:, -tail:] *= np.linspace(1, 0, tail)
mixed = mixed / np.max(np.abs(mixed)) * 0.8
with wave.open('public/audio/cards-score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'cards-score.wav: {DUR} s')
