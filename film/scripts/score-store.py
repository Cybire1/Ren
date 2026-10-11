#!/usr/bin/env python3
"""Score and sound for "Kova OS for stores" (StoreFilm). Reads src/store/store-cues.json and
public/store/audio/vo.json; writes public/store/audio/score.wav. Mastered by scripts/mix-store.mjs.

110 BPM in F, cut to the bar. Blue hour is a held pad and a music box; the sign flips on a bell and
the groove wakes with the bakery. Every tap on a screen is a note of the melody; Paid is bells; the
stock count-down is a falling three-note figure into a hush (no voice there); the send is a whoosh
across the sea and a chime on arrival; the end resolves on F.
"""
import json
import sys
import wave

sys.path.insert(0, 'scripts')
import numpy as np  # noqa: E402
from synth import SR, add, bass, bell, blip, glint, high, kalimba, mtof, musicbox, pad, printer, shaker, snap, tap, thump, whoosh  # noqa: E402

cues = json.load(open('src/store/store-cues.json'))
vo = json.load(open('public/store/audio/vo.json'))
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

# Blue hour: a pad and a sleepy music box until the sign flips.
add(music, pad([41, 48, 53], cues['flip'] + 0.6, vel=1.0), 0)
for i, m in enumerate([72, 77, 76, 72]):
    add(music, musicbox(m, 0.45), 0.2 + i * BEAT * 0.75)
add(fx, bell(mtof(77), 2.0, 0.6), cues['flip'])
add(fx, bell(mtof(84), 1.6, 0.4), cues['flip'] + 0.05)
for i in range(4):
    add(fx, glint(i + 30), cues['flip'] + 0.35 + i * 0.07, pan=0.3)

quiet = [(S['stock'], S['today'])]  # the stock hush: pad and the falling notes only
b = 0
start = cues['flip']
start = S['open'] + 3 * BEAT  # the groove wakes on the flip's bar
while start < DUR - 0.01:
    end_part = start >= S['end'] - 0.01
    name = 'F' if end_part else PROG[b % 4]
    arp, root, triad = CH[name]
    span_len = BAR if start > S['open'] + 3 * BEAT else BEAT
    in_quiet = any(a - 0.01 <= start < z - 0.01 for a, z in quiet)
    add(music, pad(triad, span_len + 0.6), start)
    if end_part:
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(arp[idx] + 12, 0.6), start + i * BEAT)
    elif in_quiet:
        pass
    else:
        for i, idx in enumerate(ARP[: int(round(span_len / (BEAT / 2)))]):
            add(music, kalimba(arp[idx] + 12, 0.8 if i % 2 == 0 else 0.5), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
        add(music, bass(root, 0.9), start)
        if span_len > BEAT:
            add(music, bass(root, 0.7), start + 2 * BEAT)
            add(music, bass(root + 7, 0.5), start + 3.5 * BEAT)
        if start >= S['title'] - 0.01 and span_len > BEAT:
            for i in range(8):
                add(music, shaker(b * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2, pan=0.35)
            add(music, thump(0.5), start)
            add(music, thump(0.35), start + 2 * BEAT)
            add(music, snap(b * 3, 0.85), start + BEAT, pan=-0.15)
            add(music, snap(b * 3 + 1, 0.85), start + 3 * BEAT, pan=-0.15)
    start += span_len
    b += 1

for k in ['title', 'setup', 'online', 'orders', 'sell', 'pay', 'hand', 'stock', 'today', 'send', 'end']:
    add(fx, snap(len(k) * 7, 0.9), S[k])
add(fx, whoosh(0.7, 500, 3600, 9, peak=0.9, vel=0.6), S['title'] - 0.7)  # into the sign
add(fx, whoosh(S['setup'] - S['title'], 300, 2400, 2, peak=0.7, vel=0.22), S['title'])  # light streak
add(fx, whoosh(0.9, 500, 3600, 4, peak=0.9, vel=0.55), S['setup'] - 0.9)  # into the screen

# Setup: the snap, the scan, each line of the menu landing on a rising note.
add(fx, tap(), S['setup'] + BEAT)
add(fx, glint(3), S['setup'] + BEAT + 0.05)
add(fx, whoosh(0.9, 1200, 4200, 5, peak=0.5, vel=0.3), S['setup'] + 1.7 * BEAT)
for i in range(7):
    add(fx, blip(PENTA[i % 8], 0.5), S['setup'] + 3.5 * BEAT + i * 0.5 * BEAT + 0.4, pan=-0.2 + 0.06 * i)

# Online: the add, the Pay tap, Paid! bells, and the order whooshing off the phone.
on = S['online']
for at, m in [(cues['shopTaps']['add'], 79), (cues['shopTaps']['pay'], 84)]:
    add(fx, tap(), on + at, pan=0.3)
    add(fx, kalimba(m + 12, 0.8), on + at + 0.02, pan=0.3)
for i, m in enumerate([79, 84, 88]):
    add(fx, bell(mtof(m), 1.6, 0.5), on + cues['shopTaps']['paid'] + i * 0.04)
add(fx, whoosh(0.9, 800, 3600, 21, peak=0.8, vel=0.6), S['orders'] - 0.9, pan=0.5)

# Orders: the order lands, then the board's taps.
o = S['orders']
add(fx, musicbox(89, 0.7), o + cues['orderTaps']['arrives'])
for i, k in enumerate(['start', 'ready', 'handed']):
    add(fx, tap(), o + cues['orderTaps'][k], pan=-0.2)
    add(fx, blip([79, 81, 84][i], 0.6), o + cues['orderTaps'][k] + 0.03, pan=-0.2)

# Sell: the melody on the taps, a bell chord on Charge.
for i, at in enumerate([1, 2, 3, 4, 5]):
    add(fx, tap(), S['sell'] + at * BEAT, pan=0.25)
    add(fx, kalimba(PENTA[i] + 12, 0.9), S['sell'] + at * BEAT + 0.02, pan=0.25)
for i, m in enumerate([77, 81, 84]):
    add(fx, bell(mtof(m), 1.6, 0.45), S['sell'] + 7 * BEAT + i * 0.03)

# Pay: card, tap, Paid!, printer.
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

# The Terminal.
for i, at in enumerate([1, 2, 3, 4, 5]):
    add(fx, tap(), S['hand'] + at * BEAT, pan=0.3)
    add(fx, kalimba(PENTA[i + 1] + 12, 0.7), S['hand'] + at * BEAT + 0.02, pan=0.3)
h0, h1 = cues['handCard']
add(fx, whoosh(h1 - h0 + 0.1, 800, 3200, 19, peak=0.8, vel=0.6), h0 - 0.1, pan=0.5)
add(fx, tap(), h1)
for i, m in enumerate([81, 86, 89]):
    add(fx, bell(mtof(m), 1.4, 0.45), cues['handPaid'] + 0.05 + i * 0.04)

# Stock: three falling notes as the buns sell out, then a soft thump.
for i, m in enumerate([84, 81, 77]):
    add(fx, musicbox(m, 0.8), S['stock'] + (0.5 + i) * BEAT)
add(fx, thump(0.6), S['stock'] + 2.5 * BEAT)

# Today: ticks as it counts.
for k2 in range(16):
    t = S['today'] + 0.3 + 1.5 * (1 - (1 - k2 / 16) ** 0.33)
    add(fx, blip(96 + (k2 % 3), 0.18), t, pan=0.1)
add(fx, bell(mtof(84), 1.4, 0.4), S['today'] + 1.85)

# Send: three key taps, the Send tap, the flight over the sea, a chime as it lands.
for i, at in enumerate([0.55, 1.09, 1.64]):
    add(fx, blip([84, 86, 89][i], 0.5), S['send'] + at, pan=-0.25)
add(fx, tap(), cues['sendTap'], pan=-0.25)
add(fx, whoosh(cues['sent'] - cues['sendTap'] + 0.2, 700, 3400, 23, peak=0.8, vel=0.7), cues['sendTap'], pan=0.3)
for i, m in enumerate([81, 84, 89]):
    add(fx, bell(mtof(m), 1.6, 0.5), cues['sent'] + i * 0.05)

# The end.
for i, m in enumerate([72, 77, 81, 84]):
    add(music, bell(mtof(m), 3.0, 0.5), S['end'] + i * 0.05, pan=-0.3 + 0.2 * i)
for i, m in enumerate([81, 79, 77, 79, 84]):
    add(music, musicbox(m, 0.5), cues['url'] + 0.4 + i * BEAT / 2, pan=0.2)
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
tail = int(1.6 * SR)
mixed[:, -tail:] *= np.linspace(1, 0, tail)
mixed = mixed / np.max(np.abs(mixed)) * 0.8
with wave.open('public/store/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mixed.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'score.wav: {DUR} s')
