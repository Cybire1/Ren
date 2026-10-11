#!/usr/bin/env python3
"""Score and sound for "Kova Terminal" (TerminalFilm). Reads src/terminal/terminal-cues.json and
public/terminal/audio/vo.json; writes public/terminal/audio/score.wav. Mastered by scripts/mix-terminal.mjs.

A product-film pulse: a dark held pad and a low heartbeat under the cold open, then the warm kalimba
groove in F at 104 BPM from the reveal. Each cut lands a snap; the tap gets a whoosh, a click and the
Paid! bells; the printer chatters as the receipt comes out; the finishes cut on bright plucks.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, band, bass, bell, blip, glint, high, kalimba, low, mtof, musicbox, noise, pad, printer, shaker, snap, tap, thump, ts, whoosh  # noqa: E402

cues = json.load(open('src/terminal/terminal-cues.json'))
vo = json.load(open('public/terminal/audio/vo.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / 104
BAR = 4 * BEAT
music = np.zeros((2, N))
fx = np.zeros((2, N))
S = cues['shots']

CH = {'F': ([65, 69, 72, 77], 41, [53, 57, 60]), 'C': ([64, 67, 72, 76], 48, [52, 55, 60]), 'Dm': ([62, 65, 69, 74], 38, [50, 53, 57]), 'Bb': ([62, 65, 70, 74], 46, [50, 53, 58])}
PROG = ['F', 'C', 'Dm', 'Bb']
ARP = [0, 2, 3, 1, 2, 3, 1, 2]
add(music, pad([41, 48, 53], S['B'] + 0.5, vel=1.3), 0)
for k in range(int(S['B'] / BEAT)):
    add(music, thump(0.35 if k % 2 == 0 else 0.2), k * BEAT)
b = 0
start = S['B']
while start < DUR:
    end_part = start >= S['G']
    name = 'F' if end_part else PROG[b % 4]
    arp, root, triad = CH[name]
    add(music, pad(triad, BAR + 0.6), start)
    if end_part:
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.6), start + i * BEAT)
    else:
        for i, idx in enumerate(ARP):
            add(music, kalimba(arp[idx] + 12, 0.85 if i % 2 == 0 else 0.55), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
        add(music, bass(root, 0.9), start)
        add(music, bass(root, 0.7), start + 2 * BEAT)
        if start >= S['C']:
            for i in range(8):
                add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2, pan=0.35)
            add(music, snap(b * 3, 0.85), start + BEAT, pan=-0.15)
            add(music, snap(b * 3 + 1, 0.85), start + 3 * BEAT, pan=-0.15)
    start += BAR
    b += 1
for i, m in enumerate([72, 77, 81, 84]):
    add(music, bell(mtof(m), 3.0, 0.5), cues['vo']['end'] + i * 0.05, pan=-0.3 + 0.2 * i)
for i, m in enumerate([81, 79, 77, 79, 84]):
    add(music, musicbox(m, 0.5), cues['vo']['end'] + 1.6 + i * BEAT / 2, pan=0.2)

# Cuts land with a snap and a breath of air.
for k in ['B', 'C', 'D', 'E', 'F', 'G']:
    add(fx, whoosh(0.5, 2000, 500, 3 + ord(k), peak=0.2, vel=0.35), S[k] - 0.25)
    add(fx, snap(ord(k), 0.9), S[k])
add(fx, whoosh(S['B'] - 0.3, 300, 2400, 2, peak=0.7, vel=0.35), 0.3)  # the light streak
add(fx, blip(84, 0.7), cues['wake'])
add(fx, glint(1), cues['wake'] + 0.1)
c0, c1 = cues['card']
add(fx, whoosh(c1 - c0, 600, 3200, 11, peak=0.8, vel=0.8), c0, pan=0.4)
add(fx, tap(), c1)
for i, m in enumerate([79, 84, 88]):
    add(fx, bell(mtof(m), 1.6, 0.5), cues['paid'] + i * 0.04)
for i in range(5):
    add(fx, glint(i + 5), cues['paid'] + 0.08 + i * 0.06, pan=-0.3 + 0.15 * i)
p0, p1 = cues['print']
k = 0
while p0 + k * 0.42 < p1:
    add(fx, printer(), p0 + k * 0.42, pan=0.1)
    k += 1
add(fx, blip(91, 0.7), cues['zero'])
for i, at in enumerate(cues['finish']):
    add(fx, kalimba([84, 88, 91, 96][i], 0.9), at)
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
with wave.open('public/terminal/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'score.wav: {DUR} s')
