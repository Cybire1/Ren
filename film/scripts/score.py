#!/usr/bin/env python3
"""Score and sound design for "Kovi's day". Synthesised: no samples, nothing licensed.

Reads src/cues.json (every timing the film uses) and public/audio/vo.json (the voice's words),
and writes public/audio/score.wav: music and effects, with the music ducked under the voice.
scripts/mix.mjs adds the voice and masters the whole to -14 LUFS.

The theme is a kalimba and a music box over a C, Am, F, G loop at 100 BPM, so a beat is 0.6 s
and a bar 2.4 s. It follows the day: sparse in the morning, a groove for the coffee, a breath for
the proof, a lift over the globe, the full band at the shop, then the pad alone under the name.
"""
import json
import wave

import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
cues = json.load(open('src/cues.json'))
vo = json.load(open('public/audio/vo.json'))
DUR = cues['duration']
N = int(DUR * SR)
BEAT = 60 / cues['bpm']
BAR = 4 * BEAT

music = np.zeros((2, N))
fx = np.zeros((2, N))


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def ts(seconds):
    return np.arange(int(seconds * SR)) / SR


def noise(seconds, seed):
    return np.random.default_rng(seed).standard_normal(int(seconds * SR))


def band(sig, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], btype='band', fs=SR, output='sos'), sig)


def low(sig, hz, order=2):
    return sosfilt(butter(order, hz, btype='low', fs=SR, output='sos'), sig)


def high(sig, hz, order=2):
    return sosfilt(butter(order, hz, btype='high', fs=SR, output='sos'), sig)


def add(bus, sig, at, pan=0.0, gain=1.0):
    """Places a mono sound on a stereo bus, equal-power panned (-1 left, +1 right)."""
    i = int(at * SR)
    if i >= N or at < 0:
        return
    sig = sig[: N - i] * gain
    angle = (pan + 1) * np.pi / 4
    bus[0, i : i + len(sig)] += sig * np.cos(angle) * np.sqrt(2)
    bus[1, i : i + len(sig)] += sig * np.sin(angle) * np.sqrt(2)


# ── instruments ────────────────────────────────────────────────────────────────────────────

def kalimba(m, vel=1.0):
    f, t = mtof(m), ts(1.6)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.55)
    s += 0.16 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.22)
    s += 0.09 * np.sin(2 * np.pi * 5.95 * f * t) * np.exp(-t / 0.045)  # the tine's bright ping
    s *= np.minimum(1, t / 0.0025)
    s += noise(1.6, m) * np.exp(-t / 0.0018) * 0.04
    return s * vel * 0.42


def musicbox(m, vel=1.0):
    f, t = mtof(m), ts(2.2)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.95)
    s += 0.32 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / 0.28)
    s += 0.1 * np.sin(2 * np.pi * 5.2 * f * t) * np.exp(-t / 0.1)
    s *= np.minimum(1, t / 0.0015)
    return s * vel * 0.3


def bell(f, seconds=2.0, vel=1.0):
    t = ts(seconds)
    s = np.zeros_like(t)
    for ratio, amp, decay in [(1, 1, 1.5), (2.0, 0.45, 0.8), (2.76, 0.32, 0.55), (4.07, 0.18, 0.3), (5.4, 0.1, 0.18)]:
        s += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / decay)
    return s * np.minimum(1, t / 0.001) * vel * 0.28


def pad(notes, seconds, vel=1.0):
    t = ts(seconds)
    s = np.zeros_like(t)
    for m in notes:
        for detune in (-0.0017, 0.0017):
            f = mtof(m) * (1 + detune)
            for k in range(1, 7):
                s += np.sin(2 * np.pi * f * k * t + k * 0.7) / k
    s = low(s, 1300)
    attack, release = min(0.9, seconds / 3), min(0.9, seconds / 3)
    e = np.minimum(1, t / attack) * np.minimum(1, (seconds - t) / release)
    return s * e * vel * 0.02


def bass(m, vel=1.0):
    f, t = mtof(m), ts(0.9)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
    s = low(s * np.minimum(1, t / 0.006) * np.exp(-t / 0.32), 700)
    return s * vel * 0.3


def shaker(seed, vel=1.0):
    t = ts(0.09)
    return band(noise(0.09, seed), 5500, 11000) * np.exp(-t / 0.028) * vel * 0.05


def snap(seed, vel=1.0):
    t = ts(0.12)
    s = band(noise(0.12, seed), 1300, 3200) * np.exp(-t / 0.022)
    s += 0.4 * np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03)
    return s * vel * 0.16


# ── effects ────────────────────────────────────────────────────────────────────────────────

def whoosh(seconds, f0, f1, seed, peak=0.6, vel=1.0):
    """Air past a paper plane: noise through a band that sweeps, rising then falling."""
    hop, win = int(0.01 * SR), int(0.02 * SR)
    total = int(seconds * SR)
    out = np.zeros(total + win)
    src = noise(seconds + 0.05, seed)
    window = np.hanning(win)
    for start in range(0, total, hop):
        p = start / total
        centre = f0 * (f1 / f0) ** p
        seg = src[start : start + win]
        if len(seg) < win:
            break
        out[start : start + win] += band(seg, centre / 1.6, min(centre * 1.6, SR / 2 - 100)) * window
    t = np.arange(len(out)) / SR
    shape = np.where(t < seconds * peak, (t / (seconds * peak)) ** 1.6, np.clip((seconds - t) / (seconds * (1 - peak)), 0, 1) ** 1.2)
    return out * shape * vel * 0.5


def tap():
    t = ts(0.05)
    return (np.sin(2 * np.pi * 1800 * t) * np.exp(-t / 0.008) + noise(0.05, 7) * np.exp(-t / 0.0015) * 0.3) * 0.35


def blip(m, vel=1.0):
    t = ts(0.12)
    return np.sin(2 * np.pi * mtof(m) * t) * np.minimum(1, t / 0.004) * np.exp(-t / 0.045) * vel * 0.25


def printer():
    out = np.zeros(int(0.42 * SR))
    for k in range(12):
        tick = band(noise(0.012, 30 + k), 1800, 4200) * np.exp(-ts(0.012) / 0.003)
        i = int(k * SR / 30)
        out[i : i + len(tick)] += tick
    return out * 0.22


def thump(vel=1.0):
    t = ts(0.5)
    f = 78 * np.exp(-t / 0.25) + 48
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    s += low(noise(0.5, 11), 900) * np.exp(-t / 0.012) * 0.3
    return s * vel * 0.55


def glint(seed):
    f = 3200 + (seed * 373) % 1800
    t = ts(0.06)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.018) * 0.07


def snore(seconds):
    t = ts(seconds)
    breath = np.clip(np.sin(2 * np.pi * 0.62 * t - 1.2), 0, 1) ** 2
    s = low(noise(seconds, 51), 520) * breath + 0.25 * np.sin(2 * np.pi * 95 * t) * breath
    return s * 0.08


def knock():
    t = ts(0.12)
    return (np.sin(2 * np.pi * 540 * t) * np.exp(-t / 0.035) + band(noise(0.12, 61), 600, 2400) * np.exp(-t / 0.01) * 0.4) * 0.3


def boing():
    t = ts(0.42)
    f = 250 + 280 * (1 - np.exp(-t / 0.08)) + 18 * np.sin(2 * np.pi * 11 * t) * np.exp(-t / 0.15)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14) * 0.22


# ── the music ──────────────────────────────────────────────────────────────────────────────

# The loop, and what each bar plays (1-based bars; bar k starts at (k - 1) * 2.4 s).
CHORDS = {'C': (60, [72, 76, 79, 84], 48), 'Am': (57, [69, 72, 76, 81], 45), 'F': (53, [65, 69, 72, 77], 41), 'G': (55, [67, 71, 74, 79], 43)}
PROGRESSION = ['C', 'Am', 'F', 'G'] * 3 + ['C', 'F', 'G', 'C', 'C']
TRIADS = {'C': [60, 64, 67], 'Am': [57, 60, 64], 'F': [53, 57, 60], 'G': [55, 59, 62]}


def section(bar):
    """sparse, groove, breath, lift, full, end, button"""
    t = (bar - 1) * BAR
    if t < 4.8:
        return 'sparse'
    if t < 9.6:
        return 'groove'
    if t < 14.4:
        return 'breath'
    if t < 19.2:
        return 'lift'
    # The shop's full band runs from bar 9 to the name at 28.8 s.
    if t < 28.8:
        return 'full'
    if t < 36.0:
        return 'end'
    return 'button'


ARP = [0, 2, 3, 1, 2, 3, 1, 2]
for bar, name in enumerate(PROGRESSION, start=1):
    start = (bar - 1) * BAR
    if start >= DUR:
        break
    kind = section(bar)
    _, arp, low_note = CHORDS[name]
    tones = arp
    # Pad under everything but the button's quiet.
    if kind != 'button':
        add(music, pad(TRIADS[name], BAR + 0.6, vel=1.25 if kind in ('lift', 'end') else 1.0), start)
    # Kalimba: quarters when it breathes, eighths when it moves.
    if kind in ('sparse', 'breath'):
        for i, idx in enumerate([0, 2, 3, 2]):
            add(music, kalimba(tones[idx], vel=0.9 if i == 0 else 0.7), start + i * BEAT, pan=-0.2 + 0.13 * i)
    elif kind in ('groove', 'lift', 'full'):
        for i, idx in enumerate(ARP):
            vel = 0.95 if i % 2 == 0 else 0.62
            add(music, kalimba(tones[idx], vel=vel), start + i * BEAT / 2, pan=-0.3 + 0.08 * i)
    # Bass and time.
    if kind in ('groove', 'lift', 'full'):
        add(music, bass(low_note, 1.0), start)
        add(music, bass(low_note, 0.8), start + 2 * BEAT)
        for i in range(8):
            add(music, shaker(bar * 10 + i, 1.0 if i % 2 else 0.6), start + i * BEAT / 2 + (0.03 if i % 2 else 0), pan=0.35)
    if kind == 'breath':
        add(music, bass(low_note, 0.7), start)
    if kind == 'full':
        add(music, snap(bar * 3, 1.0), start + BEAT, pan=-0.15)
        add(music, snap(bar * 3 + 1, 1.0), start + 3 * BEAT, pan=-0.15)
    # The music box sings over the globe and at the end.
    if kind == 'lift':
        for i, m in enumerate([84, 83, 79, 76] if name in ('F', 'G') else [79, 81, 84, 88]):
            add(music, musicbox(m, 0.8), start + i * BEAT + BEAT / 2, pan=0.25)
    if kind == 'end':
        for i, m in enumerate([76, 79] if name != 'C' else [84, 79]):
            add(music, musicbox(m, 0.55), start + i * 2 * BEAT + BEAT, pan=0.2)

# The name: a warm resolve on C, and a chime on the address.
add(music, pad([48, 55, 60, 64, 67], 7.5, vel=1.6), cues['logo'])
for i, f in enumerate([mtof(72), mtof(76), mtof(79)]):
    add(fx, bell(f, 2.6, 0.55), cues['logo'] + i * 0.035, pan=-0.2 + 0.2 * i)
add(fx, bell(mtof(84), 2.0, 0.4), cues['url'], pan=0.1)
# The button: one tiny tune, and a last chord.
for i, m in enumerate([79, 84, 88]):
    add(music, musicbox(m, 0.5), cues['button']['line'] + 0.25 + i * 0.3, pan=0.2)

# ── the effects, on their cues ─────────────────────────────────────────────────────────────

add(fx, snore(cues['wake'] + 0.2), 0.0, gain=0.8)
for i, m in enumerate([84, 88, 91]):
    add(fx, blip(m, 0.7), cues['wake'] + i * 0.07, pan=0.3)  # waking twinkle
add(fx, musicbox(91, 0.5), cues['lives'][1] - 0.02, pan=0.35)  # into the coin
add(fx, blip(84, 0.6), cues['lives'][2], pan=0.35)  # and back out
add(fx, blip(91, 0.5), cues['lives'][2] + 0.06, pan=0.35)
add(fx, tap(), cues['tap'], pan=-0.45)
add(fx, blip(88, 0.8), cues['fly'][0] - 0.08, pan=-0.4)
add(fx, blip(95, 0.8), cues['fly'][0] - 0.01, pan=-0.4)
fly = cues['fly'][1] - cues['fly'][0]
add(fx, whoosh(fly + 0.2, 350, 2600, 21, peak=0.55, vel=0.9), cues['fly'][0], pan=0.1)
add(fx, bell(mtof(88), 1.8, 0.8), cues['fly'][1], pan=0.55)
add(fx, printer(), cues['fly'][1] + 0.12, pan=0.55)
add(fx, thump(0.8), cues['proof'])
for i, at in enumerate(cues['underlines']):
    add(fx, whoosh(0.35, 2500, 5000, 40 + i, peak=0.3, vel=0.35), at, pan=0.4)
glide = cues['glide'][1] - cues['glide'][0]
add(fx, whoosh(glide + 0.3, 300, 3200, 22, peak=0.6, vel=1.0), cues['glide'][0], pan=0.0)
for k in range(16):  # one glint per painted dot as it lights
    add(fx, glint(k), cues['glide'][0] + glide * (k / 15) * 0.95 + 0.05, pan=-0.6 + 1.2 * k / 15)
for i, m in enumerate([84, 88, 91]):
    add(fx, bell(mtof(m), 2.2, 0.6), cues['glide'][1] + i * 0.03, pan=0.45)
add(fx, bell(mtof(100), 0.8, 0.35), cues['glide'][1] + 0.25, pan=0.5)  # the coin turning
add(fx, whoosh(cues['arc'][1] - cues['arc'][0] + 0.2, 600, 3400, 23, peak=0.7, vel=0.45), cues['arc'][0], pan=0.2)
for i, at in enumerate(cues['lands']):
    add(fx, whoosh(1.3, 500 + 80 * i, 2600, 24 + i, peak=0.8, vel=0.4), at - 1.3, pan=0.6 - 0.1 * i)
    add(fx, musicbox([72, 74, 76, 79, 81, 84][i], 0.95), at, pan=-0.1)  # each sale, one note higher
    add(fx, tap() * 0.5, at, pan=-0.2)
add(fx, thump(0.5), cues['card'], pan=0.3)
add(fx, snore(cues['button']['wake'] - cues['button']['sleep']), cues['button']['sleep'], gain=1.1)
add(fx, whoosh(cues['button']['plane'][1] - cues['button']['plane'][0], 400, 1800, 25, peak=0.5, vel=0.6), cues['button']['plane'][0], pan=-0.4)
add(fx, knock(), cues['button']['plane'][1], pan=-0.1)
add(fx, boing(), cues['button']['wake'], pan=0.0)

# ── duck the music under the voice, and write ─────────────────────────────────────────────

# While the voice speaks, the music drops about 12 dB and the effects about 4 dB.
speaking = np.zeros(N)
ramp = int(0.12 * SR)
for line in vo['lines']:
    start = cues['vo'][line['id']] + line['words'][0]['start'] - 0.1
    end = cues['vo'][line['id']] + line['words'][-1]['end'] + 0.2
    speaking[int(start * SR) : int(end * SR)] = 1
speaking = np.convolve(speaking, np.ones(ramp) / ramp, mode='same')

mixed = music * (1 - 0.75 * speaking) * 0.9 + fx * (1 - 0.4 * speaking)
mixed = high(mixed, 35)  # nothing a phone speaker can't play anyway
fade = np.ones(N)
tail = int(0.6 * SR)
fade[-tail:] = np.linspace(1, 0, tail)
mixed *= fade
peak = np.max(np.abs(mixed))
mixed = mixed / peak * 0.5  # leave the voice room; mix.mjs masters the whole
pcm = (np.clip(mixed.T, -1, 1) * 32767).astype('<i2')
with wave.open('public/audio/score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print(f'score.wav: {DUR} s, peak before trim {peak:.2f}')
