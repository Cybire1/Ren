#!/usr/bin/env python3
"""Score and sound for "Kova Shop OS" (ShopOsFilm). Reads src/os/os-cues.json and
public/os/audio/vo.json; writes public/os/audio/score.wav. Mastered by scripts/mix-os.mjs.

110 BPM in F, cut to the bar. The cold open is a dark pad and a heartbeat, each chore popping in on a
rising note. The groove starts on the title. On Sell every tap is a note of the melody and Charge
is a bell chord. The exploded screen is the breakdown: no drums. The pay shot brings the groove
back with the card's whoosh, the tap and the Paid! bells. Orders and the Terminal tap their own
notes; Today ticks as it counts; the end resolves on F.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, bass, bell, blip, glint, high, kalimba, mtof, musicbox, pad, printer, shaker, snap, tap, thump, whoosh  # noqa: E402

cues = json.load(open('src/os/os-cues.json'))
vo = json.load(open('public/os/audio/vo.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / cues['bpm']
BAR = 4 * BEAT
S = cues['shots']
music = np.zeros((2, N))
fx = np.zeros((2, N))

CH = {'F': ([65, 69, 72, 77], 41, [53, 57, 60]), 'C': ([64, 67, 72, 76], 48, [52, 55, 60]), 'Dm': ([62, 65, 69, 74], 38, [50, 53, 57]), 'Bb': ([62, 65, 70, 74], 46, [50, 53, 58])}
PROG = ['F', 'C', 'Dm', 'Bb']
ARP = [0, 2, 3, 1, 2, 3, 1, 2]
PENTA = [72, 74, 77, 79, 81, 84, 86, 89]

# Cold open: a dark pad, a heartbeat, a rising note for each chore.
add(music, pad([38, 45, 50], S['title'] + 0.4, vel=1.2), 0)
for k in range(int(S['title'] / BEAT)):
    add(music, thump(0.4 if k % 2 == 0 else 0.22), k * BEAT)
for i in range(6):
    add(fx, blip(PENTA[i], 0.55), (i + 2) * BEAT, pan=-0.4 + 0.16 * i)
add(fx, whoosh(1.2, 400, 3000, 7, peak=0.85, vel=0.5), S['title'] - 1.15)

# The groove, bar by bar from the title.
breakdown = (S['explode'], S['pay'])
b = 0
start = S['title']
while start < DUR - 0.01:
    end_part = start >= S['end'] - 0.01
    name = 'F' if end_part else PROG[b % 4]
    arp, root, triad = CH[name]
    add(music, pad(triad, BAR + 0.6), start)
    if end_part:
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.6), start + i * BEAT)
    elif breakdown[0] - 0.01 <= start < breakdown[1] - 0.01:
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.5), start + i * BEAT, pan=-0.2 + 0.13 * i)
    else:
        for i, idx in enumerate(ARP):
            add(music, kalimba(arp[idx] + 12, 0.8 if i % 2 == 0 else 0.5), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
        add(music, bass(root, 0.9), start)
        add(music, bass(root, 0.7), start + 2 * BEAT)
        add(music, bass(root + 7, 0.5), start + 3.5 * BEAT)
        if start >= S['sell'] - 0.01:
            for i in range(8):
                add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2, pan=0.35)
            add(music, thump(0.5), start)
            add(music, thump(0.35), start + 2 * BEAT)
            add(music, snap(b * 3, 0.85), start + BEAT, pan=-0.15)
            add(music, snap(b * 3 + 1, 0.85), start + 3 * BEAT, pan=-0.15)
    start += BAR
    b += 1

# Every cut lands with a snap.
for k in ['title', 'sell', 'explode', 'pay', 'orders', 'hand', 'today', 'end']:
    add(fx, snap(len(k) * 7, 0.9), S[k])
add(fx, bell(mtof(77), 2.4, 0.5), S['title'])
add(fx, whoosh(S['title'] + 0.2, 300, 2400, 2, peak=0.7, vel=0.25), S['title'])  # the light streak
add(fx, whoosh(0.9, 500, 3600, 9, peak=0.9, vel=0.6), S['sell'] - 0.9)  # the dive into the screen

# Sell: each tap a note of the melody, Charge a bell chord.
for i, at in enumerate([1, 2, 3, 4, 5]):
    t = S['sell'] + at * BEAT
    add(fx, tap(), t, pan=0.25)
    add(fx, kalimba(PENTA[i] + 12, 0.9), t + 0.02, pan=0.25)
for i, m in enumerate([77, 81, 84]):
    add(fx, bell(mtof(m), 1.6, 0.45), S['sell'] + 7 * BEAT + i * 0.03)

# The breakdown: the screen comes apart, glints on the beat, a riser back in.
add(fx, whoosh(1.0, 2600, 500, 13, peak=0.3, vel=0.45), S['explode'] + 0.2)
for k in range(8):
    add(fx, glint(k + 20), S['explode'] + k * BEAT, pan=-0.3 + 0.08 * k)
add(fx, whoosh(1.4, 300, 3600, 17, peak=0.9, vel=0.5), S['pay'] - 1.4)

# Pay: the card, the tap, Paid!, the printer.
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

# Orders: the board's taps and a chime for the new order.
for i, at in enumerate([2, 4, 6]):
    add(fx, tap(), S['orders'] + at * BEAT, pan=-0.2)
    add(fx, blip([79, 81, 84][i], 0.6), S['orders'] + at * BEAT + 0.03, pan=-0.2)
for i, m in enumerate([84, 89]):
    add(fx, musicbox(m, 0.7), S['orders'] + 7 * BEAT + i * 0.12)

# The Terminal: its taps, then the card on its reader.
for i, at in enumerate([1, 2, 3, 4, 5]):
    t = S['hand'] + at * BEAT
    add(fx, tap(), t, pan=0.3)
    add(fx, kalimba(PENTA[i + 1] + 12, 0.7), t + 0.02, pan=0.3)
h0, h1 = cues['handCard']
add(fx, whoosh(h1 - h0 + 0.1, 800, 3200, 19, peak=0.8, vel=0.6), h0 - 0.1, pan=0.5)
add(fx, tap(), h1)
for i, m in enumerate([81, 86, 89]):
    add(fx, bell(mtof(m), 1.4, 0.45), cues['handPaid'] + 0.05 + i * 0.04)

# Today: the totals tick as they count up.
for k in range(16):
    t = S['today'] + 0.3 + 1.5 * (1 - (1 - k / 16) ** 0.33)
    add(fx, blip(96 + (k % 3), 0.18), t, pan=0.1)
add(fx, bell(mtof(84), 1.4, 0.4), S['today'] + 1.85)

# The end.
for i, m in enumerate([72, 77, 81, 84]):
    add(music, bell(mtof(m), 3.0, 0.5), S['end'] + i * 0.05, pan=-0.3 + 0.2 * i)
for i, m in enumerate([81, 79, 77, 79, 84]):
    add(music, musicbox(m, 0.5), cues['vo']['end'] + 2.0 + i * BEAT / 2, pan=0.2)
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
tail = int(1.5 * SR)
mixed[:, -tail:] *= np.linspace(1, 0, tail)
mixed = mixed / np.max(np.abs(mixed)) * 0.8
with wave.open('public/os/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'score.wav: {DUR} s')
