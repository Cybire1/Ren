#!/usr/bin/env python3
"""Sound for "The Queue": the score leads (ElevenLabs Music, timed to the story), with a café murmur
while everyone waits and a few game-like effects on the cues in src/queue/queue-cues.json.
Mastered to -14 LUFS with one fixed gain and a peak limiter. Writes public/queue/sound.wav.
"""
import json
import subprocess

import numpy as np

SR = 48000
c = json.load(open('src/queue/queue-cues.json'))
DUR = c['duration']
N = int(DUR * SR)


def load(name):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'public/queue/sfx/{name}.mp3', '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


bus = np.zeros((N, 2), dtype=np.float32)


def put(name, at, gain=1.0, pan=0.0, seconds=None):
    sig = load(name)
    if seconds:
        sig = sig[: int(seconds * SR)]
        f = min(len(sig), int(0.08 * SR))
        sig[-f:] *= np.linspace(1, 0, f)[:, None]
    sig = sig * gain
    sig[:, 0] *= min(1, 1 - pan)
    sig[:, 1] *= min(1, 1 + pan)
    i = int(at * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    bus[i:j] += sig[: j - i]


t = np.arange(N) / SR
# The waiting room: a murmur that thins as the queue breaks.
murmur = load('murmur')
bed = np.zeros((N, 2), dtype=np.float32)
k = 0
while k < N:
    seg = murmur[: min(len(murmur), N - k)]
    bed[k : k + len(seg)] += seg
    k += max(len(seg) - int(0.5 * SR), int(0.5 * SR))
env = 0.35 * np.clip(t / 1.0, 0, 1) * (1 - np.clip((t - c['cascade']) / 3.0, 0, 1)) * (1 - 0.5 * np.clip((t - c['phone'][0]) / 1.0, 0, 1))
bus += bed * env[:, None]

for at in c['steps']:
    put('shuffle', at - 0.05, 0.5)
put('steps', c['koviIn'][0], 0.45, pan=0.4)
for at in [c['rule'][0], c['ask'][0]]:
    for n in range(8):
        put('blip', at + 0.1 + n * 0.12, 0.12)
put('steps', c['toTable'][0], 0.4, pan=0.2)
put('coin', c['coin'][0] - 0.05, 0.75)
put('blip', c['ticket'], 0.4)
put('steps', c['carry'][0] + 0.3, 0.3, pan=-0.2)
put('ding', c['ready'] - 0.05, 0.8)
for at in c['days']:
    put('stamp', at, 0.55)
put('reward', c['free'] - 0.05, 0.7)
put('shuffle', c['leave'], 0.35)
put('steps', c['cascade'], 0.35, pan=-0.3)
put('steps', c['cascade'] + 1.0, 0.3, pan=0.3)
put('sign', c['flip'] - 0.1, 0.6)

# The score leads, ducking a little under the coin, the ding and the reward.
music = load('music')[:N]
score = np.zeros((N, 2), dtype=np.float32)
score[: len(music)] = music
duck = np.ones(N)
for at in [c['coin'][0], c['ready'], c['free']]:
    duck -= 0.25 * np.exp(-((t - at - 0.3) ** 2) / 0.2)
duck *= np.clip((DUR - t) / 1.0, 0, 1)
bus += score * (0.8 * duck)[:, None]

raw = 'public/queue/sound-raw.wav'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', raw], input=np.clip(bus, -1, 1).astype(np.float32).tobytes(), check=True)
stats = subprocess.run(['ffmpeg', '-i', raw, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
lufs = float([l for l in stats.splitlines() if l.strip().startswith('I:')][-1].split()[1])
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af', f'volume={-14 - lufs}dB,alimiter=limit=0.84:level=false', '-ar', str(SR), 'public/queue/sound.wav'], check=True)
subprocess.run(['rm', raw])
print(f'raw {lufs:.1f} LUFS -> -14')
