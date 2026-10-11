#!/usr/bin/env python3
"""Sound for "Pick a card" (KovaCards), from real recordings rather than synthesis.

- Music: public/audio/music-v2.mp3, generated for this film with ElevenLabs Music (paid plan: commercial use).
- Card handling: Kenney "Casino Audio", CC0 (card slide, place, fan, shove), copied into public/audio/kenney/.
- One-off effects: public/audio/sfx/*.mp3, generated with ElevenLabs Sound Effects (whoosh, sparkle,
  pop, boing, landing, squeak, chime, pull-out, flip).

Layered by frequency, as sound designers do: a crisp top (card), a mid whoosh, a low body (landing).
Music leads underneath and dips a little under the big hits. Reads src/cards-cues.json; writes
public/audio/cards-score.wav, which scripts/mix-cards.mjs masters to -14 LUFS.
"""
import json
import subprocess
import wave
from functools import lru_cache

import numpy as np

SR = 48000
cues = json.load(open('src/cards-cues.json'))
DUR = cues['duration']
N = int(DUR * SR)


# Per-file clean-up: the generated sparkle is mostly harsh treble, so it is rolled off above 9 kHz.
FILTERS = {'sparkle.mp3': 'lowpass=f=9000,lowpass=f=9000'}


@lru_cache(maxsize=None)
def load(path: str) -> np.ndarray:
    """Any audio file as a stereo float array at 48 kHz, peak-normalised to 1."""
    af = FILTERS.get(path.split('/')[-1])
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, *(['-af', af] if af else []), '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, dtype='<f4').reshape(-1, 2).T.copy()
    peak = np.max(np.abs(a)) or 1.0
    return a / peak


def db(x: float) -> float:
    return 10 ** (x / 20)


fx = np.zeros((2, N))


def put(path: str, at: float, gain_db: float = -12.0, pan: float = 0.0, rate: float = 1.0, fade_out: float | None = None):
    """Places a sound so it STARTS at `at` seconds."""
    a = load(path)
    if rate != 1.0:
        idx = np.arange(0, a.shape[1] - 1, rate)
        a = np.stack([np.interp(idx, np.arange(a.shape[1]), ch) for ch in a])
    if fade_out:
        n = min(a.shape[1], int(fade_out * SR))
        a = a.copy()
        a[:, -n:] *= np.linspace(1, 0, n)
    i = int(at * SR)
    if i >= N:
        return
    a = a[:, : N - i] * db(gain_db)
    left, right = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
    fx[0, i : i + a.shape[1]] += a[0] * left
    fx[1, i : i + a.shape[1]] += a[1] * right


def ending_at(path: str, at: float, **kw):
    """Places a sound so it ENDS at `at` (whooshes that arrive with the motion)."""
    put(path, at - load(path).shape[1] / SR, **kw)


K = 'public/audio/kenney/'
S = 'public/audio/sfx/'

# The hero spins in, lands, and catches the light.
ending_at(S + 'spin2.mp3', cues['spin'][1] + 0.05, gain_db=-12)
put(K + 'card-place-1.ogg', cues['spin'][1] - 0.02, gain_db=-7)
put(S + 'land.mp3', cues['spin'][1], gain_db=-16)
put(S + 'sparkle.mp3', cues['sheen1'] + 0.1, gain_db=-21, pan=0.3)

# The other cards slide in, then each one glides to the front and lands.
put(K + 'card-slide-3.ogg', cues['flow'][0] - 0.3, gain_db=-12, pan=0.5)
places = ['card-place-2.ogg', 'card-place-3.ogg', 'card-place-4.ogg', 'card-place-1.ogg', 'card-place-2.ogg']
for i, at in enumerate(cues['flow'][1:], start=1):
    put(S + 'swish.mp3', at - 0.02, gain_db=-17, pan=0.35)
    put(K + f'card-slide-{(i % 8) + 1}.ogg', at + 0.05, gain_db=-21, pan=0.25)
    put(K + places[i - 1], at + 0.48, gain_db=-11, pan=0.05)
put('public/audio/kenney/impactTin_medium_000.ogg', cues['flow'][2] + 0.5, gain_db=-22, pan=0.1)  # the metal one

# Dealt into a hand, then one pulled out, the rest shoved away, a flip.
put(K + 'card-fan-1.ogg', cues['fan'][0] + 0.05, gain_db=-9)
put(S + 'pullout.mp3', cues['pull'][0], gain_db=-13)
put(K + 'card-shove-2.ogg', cues['pull'][0] + 0.3, gain_db=-17, pan=-0.3)
put(K + 'card-slide-6.ogg', cues['flip'][0] + 0.12, gain_db=-17)  # a real card turning, not a generated flip
put(K + 'card-place-3.ogg', cues['flip'][1] - 0.02, gain_db=-14)

# The name, and Kovi flying over it.
put(S + 'chime.mp3', cues['end'], gain_db=-11)
put(S + 'swish.mp3', cues['kovi'][0] + 0.2, gain_db=-18, pan=-0.6, rate=0.8)
put(S + 'swish.mp3', cues['kovi'][0] + 0.9, gain_db=-18, pan=0.6, rate=0.8)

# Kovi on the line.
put(S + 'pop.mp3', cues['peek'] + 0.02, gain_db=-13)
put(S + 'squeak.mp3', cues['look'][0] + 0.12, gain_db=-20, pan=-0.4)
put(S + 'squeak.mp3', cues['look'][0] + 0.62, gain_db=-20, pan=0.4, rate=1.12)
put(S + 'boing.mp3', cues['jump'][1] - 0.02, gain_db=-13)
put(S + 'land.mp3', cues['jump'][2] - 0.02, gain_db=-12)
put(S + 'sparkle.mp3', cues['jump'][2] + 0.02, gain_db=-20, pan=-0.2)
put(S + 'sparkle.mp3', cues['wave'][0] + 0.4, gain_db=-19, pan=0.3)
put(S + 'boing.mp3', cues['exit'][1] - 0.02, gain_db=-15, rate=1.1)
put(S + 'swish.mp3', cues['exit'][1] + 0.2, gain_db=-19, rate=0.9)

# Music underneath: it leads, and dips about 3 dB under the biggest hits.
music = load('public/audio/music-v2.mp3')[:, :N]
music = np.pad(music, ((0, 0), (0, N - music.shape[1])))
env = np.ones(N)
for at in [cues['spin'][1], cues['fan'][0] + 0.1, cues['pull'][0], cues['end']]:
    a, b = int((at - 0.1) * SR), int((at + 0.5) * SR)
    env[a:b] = np.minimum(env[a:b], db(-3))
ramp = int(0.08 * SR)
env = np.convolve(env, np.ones(ramp) / ramp, mode='same')
# Space: a soft, short plate-like reverb on the effects so they sit in the music's room.
from scipy.signal import butter, fftconvolve, sosfilt  # noqa: E402

rng = np.random.default_rng(7)
ir_t = np.arange(int(1.1 * SR)) / SR
ir = rng.standard_normal((2, ir_t.size)) * np.exp(-ir_t / 0.28)
ir = sosfilt(butter(2, 7000, 'low', fs=SR, output='sos'), ir)
ir[:, : int(0.012 * SR)] = 0  # pre-delay
ir /= np.sqrt((ir**2).sum(axis=1, keepdims=True))
wet = np.stack([fftconvolve(fx[c], ir[c])[:N] for c in range(2)])
fx_bus = fx + wet * db(-15)

# Width: a little more side in the music.
mid, side = (music[0] + music[1]) / 2, (music[0] - music[1]) / 2
music = np.stack([mid + side * 1.25, mid - side * 1.25])

mix = music * db(-6) * env + fx_bus

tail = int(0.6 * SR)
mix[:, -tail:] *= np.linspace(1, 0, tail)
mix = mix / np.max(np.abs(mix)) * 0.85
with wave.open('public/audio/cards-score.wav', 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'cards-score.wav: {DUR} s')
