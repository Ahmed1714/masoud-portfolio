"""Procedural sound design for the PUVANA outro (6 s, 48 kHz stereo WAV).
Timings match PUVANA_Outro.jsx."""
import numpy as np, wave, sys

SR = 48000
DUR = 6.0
N = int(SR * DUR)
rng = np.random.default_rng(1714)
L = np.zeros(N); R = np.zeros(N)


def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N: return
    sig = sig[: N - i] * gain
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * l * 1.414
    R[i:i + len(sig)] += sig * r * 1.414


def tt(d): return np.arange(int(d * SR)) / SR


def env(d, a, rel_tau):
    t = tt(d)
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-np.maximum(t - a, 0) / rel_tau)
    return e


def bandnoise(d, lo, hi):
    n = rng.standard_normal(int(d * SR))
    F = np.fft.rfft(n); f = np.fft.rfftfreq(len(n), 1 / SR)
    F[(f < lo) | (f > hi)] = 0
    out = np.fft.irfft(F, len(n))
    return out / (np.abs(out).max() + 1e-9)


def sweep_lp(sig, f0, f1):
    """one-pole lowpass with exponentially swept cutoff"""
    n = len(sig); out = np.zeros(n); y = 0.0
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    a = 1 - np.exp(-2 * np.pi * fc / SR)
    for i in range(n):
        y += a[i] * (sig[i] - y); out[i] = y
    return out / (np.abs(out).max() + 1e-9)


def bell(freq, d, tau, partials=((1, 1), (2.76, .35), (5.4, .15), (8.9, .06))):
    t = tt(d); s = np.zeros_like(t)
    for m, g in partials:
        s += g * np.sin(2 * np.pi * freq * m * t) * np.exp(-t / (tau / m ** 0.6))
    return s * np.minimum(t / 0.002, 1)


# 1. Ambient pad bed (D major add9), fades in & out
t = tt(DUR)
pad = np.zeros_like(t)
for f, g in [(146.83, .5), (220.0, .45), (293.66, .35), (369.99, .25), (329.63, .2), (440.0, .15)]:
    for det in (-0.6, 0.6):
        pad += g * np.sin(2 * np.pi * (f + det) * t + rng.uniform(0, 6))
pad *= (0.85 + 0.15 * np.sin(2 * np.pi * 0.35 * t))
pad_env = np.clip(t / 1.6, 0, 1) ** 2 * np.clip((DUR - t) / 1.3, 0, 1)
pad *= pad_env / np.abs(pad).max()
L += pad * 0.10; R += np.roll(pad, 240) * 0.10

# 2. Falling whoosh (0.0 -> 0.55)
w = sweep_lp(bandnoise(0.6, 100, 9000), 300, 4000) * np.linspace(0, 1, int(0.6 * SR)) ** 2
w *= np.r_[np.ones(int(0.55 * SR)), np.linspace(1, 0, int(0.05 * SR))]
add(w, 0.0, 0, 0.18)

# 3. Water drop "bloop" + splash at impact 0.55
d = tt(0.18)
f_inst = 500 + 1500 * (1 - np.exp(-d / 0.03))
bloop = np.sin(2 * np.pi * np.cumsum(f_inst) / SR) * np.exp(-d / 0.04) * np.minimum(d / 0.002, 1)
add(bloop, 0.55, 0, 0.55)
splash = bandnoise(0.5, 1500, 12000) * env(0.5, 0.004, 0.09)
add(splash, 0.55, -0.2, 0.22); add(np.roll(splash, 300), 0.56, 0.2, 0.18)
for k in range(9):  # little droplets
    f = rng.uniform(900, 2200); dd = tt(0.09)
    p = np.sin(2 * np.pi * np.cumsum(f + 900 * (1 - np.exp(-dd / 0.02))) / SR) * np.exp(-dd / 0.025)
    add(p, 0.6 + rng.uniform(0, 0.45), rng.uniform(-0.8, 0.8), rng.uniform(0.08, 0.16))

# 4. Shimmer riser while gold outline draws (0.6 -> 1.1)
rd = 0.55; rt = tt(rd)
riser = sweep_lp(bandnoise(rd, 2000, 14000), 1500, 12000) * (rt / rd) ** 2.5
gl = np.sin(2 * np.pi * np.cumsum(800 * (2 ** (2 * rt / rd))) / SR) * (rt / rd) ** 3 * 0.25
add(riser + gl, 0.58, 0, 0.16)

# 5. Logo hit at 1.10 : sub boom + soft impact + bell chord
bd = tt(1.6)
boom = np.sin(2 * np.pi * np.cumsum(38 + 40 * np.exp(-bd / 0.08)) / SR) * np.exp(-bd / 0.45) * np.minimum(bd / 0.005, 1)
add(boom, 1.10, 0, 0.75)
thud = sweep_lp(bandnoise(0.4, 60, 3000), 3000, 200) * env(0.4, 0.003, 0.07)
add(thud, 1.10, 0, 0.3)
for f, pan, g in [(587.33, -0.3, .22), (880.0, 0.3, .18), (1174.66, -0.1, .14), (1479.98, 0.15, .09)]:
    add(bell(f, 3.0, 1.4), 1.12, pan, g)

# 6. Gold sparkle chimes 1.25 -> 2.1
for k in range(14):
    f = rng.choice([1760, 2093, 2349.3, 2637, 2960, 3520])
    add(bell(f, 0.8, 0.25, ((1, 1), (2.0, .3), (3.0, .1))), 1.25 + rng.uniform(0, 0.85), rng.uniform(-0.9, 0.9), rng.uniform(0.03, 0.07))

# 7. Shine swish 2.2 -> 3.0, panned L -> R, + glints
sd = 0.85; st = tt(sd)
sw = bandnoise(sd, 3000, 15000) * np.sin(np.pi * st / sd) ** 2
i0 = int(2.2 * SR); n = len(sw); pan = np.linspace(-0.9, 0.9, n)
L[i0:i0 + n] += sw * np.cos((pan + 1) * np.pi / 4) * 0.12 * 1.414
R[i0:i0 + n] += sw * np.sin((pan + 1) * np.pi / 4) * 0.12 * 1.414
for tg, p in [(2.45, 0.3), (2.75, -0.4), (2.95, 0.1)]:
    add(bell(3951, 1.2, 0.35, ((1, 1), (1.5, .4), (2.0, .2))), tg, p, 0.08)

# 8. Tagline soft whoosh at 2.4
td = 0.9; tw = sweep_lp(bandnoise(td, 150, 6000), 400, 2500) * np.sin(np.pi * tt(td) / td) ** 2
add(tw, 2.35, 0, 0.12)

# 9. Reverb (FFT convolution with decaying noise IR)
ir_len = int(2.2 * SR); it = np.arange(ir_len) / SR
irL = rng.standard_normal(ir_len) * np.exp(-it / 0.55); irR = rng.standard_normal(ir_len) * np.exp(-it / 0.55)
irL[:int(0.02 * SR)] = 0; irR[:int(0.023 * SR)] = 0
def conv(x, h):
    m = len(x) + len(h); nfft = 1 << (m - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(h, nfft), nfft)[:len(x)]
    return y / (np.abs(y).max() + 1e-9)
dry = np.stack([L, R]); peak = np.abs(dry).max()
wetL = conv(L, irL) * peak; wetR = conv(R, irR) * peak
L = L + wetL * 0.22; R = R + wetR * 0.22

# master: fade tail, soft limit, normalize to -1 dBFS
fade = np.clip((DUR - t) / 0.4, 0, 1)
mix = np.stack([L, R]) * fade
mix = np.tanh(mix / np.abs(mix).max() * 1.4)
mix = mix / np.abs(mix).max() * 10 ** (-1 / 20)

out = sys.argv[1] if len(sys.argv) > 1 else "puvana_outro_sfx.wav"
pcm = (mix.T * 32767).astype("<i2")
with wave.open(out, "wb") as wf:
    wf.setnchannels(2); wf.setsampwidth(2); wf.setframerate(SR); wf.writeframes(pcm.tobytes())
print("wrote", out)
