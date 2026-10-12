#!/usr/bin/env python3
"""Sound for "Every table is a counter" (TableFilm): the score leads, a café murmur sits under the
filmed shots, and a few effects land on the real moments (pay, ready, stamps, free).
Mastered to -14 LUFS with one fixed gain and a peak limiter. Writes public/queue/hf/sound.wav.
"""
import subprocess

import numpy as np

SR = 48000
DUR = 34
N = DUR * SR


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


bus = np.zeros((N, 2), dtype=np.float32)
t = np.arange(N) / SR


def put(sig, at, gain=1.0):
    i = int(at * SR)
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i] * gain


sfx = lambda n: load(f'public/queue/sfx/{n}.mp3')
# The room: murmur under the filmed shots, gone on paper.
murmur = sfx('murmur')
room = np.zeros((N, 2), dtype=np.float32)
k = 0
while k < N:
    seg = murmur[: min(len(murmur), N - k)]
    room[k : k + len(seg)] += seg
    k += max(len(seg) - SR // 2, SR // 2)
on = ((t < 10) | ((t >= 12.5) & (t < 19)) | ((t >= 24) & (t < 29.5))).astype(float)
on = np.convolve(on, np.ones(SR // 5) / (SR // 5), mode='same')
bus += room * (0.3 * on)[:, None]

put(sfx('blip'), 2.4, 0.25)
put(sfx('blip'), 2.7, 0.2)
put(sfx('coin'), 14.75, 0.7)
put(sfx('ding'), 16.05, 0.8)
for i in range(5):
    put(sfx('stamp'), 19.5 + i * 0.32, 0.5)
put(sfx('reward'), 21.35, 0.6)

music = load('public/queue/hf/music.mp3')[:N]
score = np.zeros((N, 2), dtype=np.float32)
score[: len(music)] = music
duck = np.ones(N)
for at in [14.75, 16.05, 21.35]:
    duck -= 0.22 * np.exp(-((t - at - 0.3) ** 2) / 0.2)
duck *= np.clip((DUR - t) / 0.8, 0, 1)
bus += score * (0.85 * duck)[:, None]

raw = 'public/queue/hf/sound-raw.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', raw], input=np.clip(bus, -1, 1).astype(np.float32).tobytes(), check=True)
stats = subprocess.run(['ffmpeg', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
lufs = float([l for l in stats.splitlines() if l.strip().startswith('I:')][-1].split()[1])
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'volume={-14 - lufs}dB,alimiter=limit=0.84:level=false', '-ar', str(SR), 'public/queue/hf/sound.wav'], check=True)
subprocess.run(['rm', raw])
print(f'raw {lufs:.1f} LUFS -> -14')
