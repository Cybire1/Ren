#!/usr/bin/env python3
"""Sound for "Every table is a counter" (TableSpot): a sound design spot, like the reference.

Effects (public/spot/sfx/*.mp3, ElevenLabs Sound Effects) land on the cues in src/spot/spot-cues.json;
a light music bed (ElevenLabs Music) sits underneath and ducks under the big moments. Mastered to
-14 LUFS with one fixed gain and a peak limiter, never loudnorm's dynamic mode.
Writes public/spot/sound.wav.
"""
import json
import subprocess

import numpy as np

SR = 48000
cues = json.load(open('src/spot/spot-cues.json'))
S = cues['shots']
DUR = cues['duration']
N = int(DUR * SR)


def load(name):
    raw = subprocess.run(
        ['ffmpeg', '-v', 'error', '-i', f'public/spot/sfx/{name}.mp3', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
        capture_output=True, check=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


bus = np.zeros((N, 2), dtype=np.float32)


def put(name, at, gain=1.0, pan=0.0, seconds=None):
    sig = load(name)
    if seconds:
        sig = sig[: int(seconds * SR)]
        fade = min(len(sig), int(0.06 * SR))
        sig[-fade:] *= np.linspace(1, 0, fade)[:, None]
    sig = sig * gain
    sig[:, 0] *= min(1, 1 - pan)
    sig[:, 1] *= min(1, 1 + pan)
    i = int(at * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i]


# 1. Imagine: soft ticks under the letters, the scan takes it away.
for k in range(6):
    put('tick', cues['letters'][0] + k * 0.32, 0.25, pan=-0.3 + k * 0.12)
put('scan', cues['scan'][0] - 0.05, 0.7)

# 2. Bracket: each word pops in.
for k, at in enumerate(cues['words']):
    put('pop', at, 0.45, pan=-0.2 + 0.07 * k)
put('whoosh', S['table'] - 0.45, 0.6)

# 3. Table: the room resolves, the phone rises, the dive.
put('sparkle', cues['thermal'][0] + 0.2, 0.35)
put('whoosh', cues['phoneUp'][0], 0.5, pan=0.3)
put('rise', cues['dive'][0] - 0.9, 0.7)

# 4. Type: keys, then Pay and Face ID.
put('type', cues['typing'][0], 0.55, seconds=cues['typing'][1] - cues['typing'][0])
put('tick', cues['payTap'], 0.8)
put('faceid', cues['paid'] - 0.05, 0.8)

# 5. Ready: each step ticks in, the phone slides in, buzzes and chimes.
for at in cues['steps']:
    put('tick', at, 0.45)
put('whoosh', cues['readyPhone'] - 0.1, 0.45, pan=0.4)
put('buzz', cues['buzz'], 0.7, pan=0.3)
put('ready', cues['buzz'] + 0.05, 0.85)

# 6. Stamps: the dots gather, five stamps land, the receipts fan, the free one.
put('rise', cues['dots'][0], 0.35)
for k, at in enumerate(cues['stampHits']):
    put('stamp', at, 0.6 + 0.06 * k, pan=-0.3 + 0.15 * k)
put('cards', cues['fan'][0], 0.7)
put('sparkle', cues['free'], 0.55)

# 7. End: words pop, the tile lands, the logo.
for at in cues['endWords'][:3]:
    put('pop', at, 0.4)
put('whoosh', cues['tile'] - 0.2, 0.5)
put('thud', cues['url'] - 0.1, 0.7)

# The bed: low, ducked under the big moments, faded at both ends.
music = load('music')[:N]
bed = np.zeros((N, 2), dtype=np.float32)
bed[: len(music)] = music
t = np.arange(N) / SR
env = np.full(N, 0.32)
for at in [cues['paid'], cues['buzz'], cues['free'], cues['url']]:
    env -= 0.14 * np.exp(-((t - at - 0.4) ** 2) / 0.25)
env *= np.clip(t / 0.8, 0, 1) * np.clip((DUR - t) / 1.2, 0, 1)
bus += bed * env[:, None]

raw = 'public/spot/sound-raw.wav'
pcm = np.clip(bus, -1, 1)
subprocess.run(
    ['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', raw],
    input=pcm.astype(np.float32).tobytes(), check=True,
)
stats = subprocess.run(['ffmpeg', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
lufs = float([l for l in stats.splitlines() if l.strip().startswith('I:')][-1].split()[1])
gain = -14 - lufs
subprocess.run(
    ['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'volume={gain}dB,alimiter=limit=0.84:level=false', '-ar', str(SR), 'public/spot/sound.wav'],
    check=True,
)
print(f'raw {lufs:.1f} LUFS, gain {gain:+.1f} dB')
