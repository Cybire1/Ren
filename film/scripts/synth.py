"""Synthesised instruments and effects shared by the Kova film scores (numpy + scipy, nothing licensed)."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000


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
    n = bus.shape[1]
    i = int(at * SR)
    if i >= n or at < 0:
        return
    sig = sig[: n - i] * gain
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


