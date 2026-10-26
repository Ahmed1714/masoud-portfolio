"""Original 16s score for Option 2 (120 BPM, upbeat/premium). Whooshes on every cut,
pops on the doodles/labels, chimes on the arrows, impact on the end card."""
from pathlib import Path
import wave
import numpy as np

SR, DUR = 48000, 16.0
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(9)
L = np.zeros(N); R = np.zeros(N)
BEAT = 0.5
CUTS = [2.5, 5.0, 8.0, 11.5]

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def env(st, a, d):
    e = np.zeros(N); i0 = int(st * SR)
    if i0 >= N: return e
    n = min(int((a + d * 6) * SR), N - i0); tt = np.arange(n) / SR
    e[i0:i0 + n] = np.minimum(tt / max(a, 1e-4), 1) * np.exp(-np.maximum(tt - a, 0) / d)
    return e

def lp1(x, c):
    c = np.broadcast_to(np.asarray(c, float), x.shape); k = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += k[i] * (x[i] - acc); y[i] = acc
    return y

def add(s, pan=0.0, g=1.0):
    global L, R
    L += s * g * np.sqrt(0.5 * (1 - pan)); R += s * g * np.sqrt(0.5 * (1 + pan))

groove = (t >= 2.5) & (t < 11.5)
# chords per bar (2s): Am, F, C, G ... then Am on the end card
prog = [[57, 60, 64, 67], [53, 57, 60, 64], [48, 55, 60, 64], [55, 59, 62, 67]]
def chord_at(x):
    if x >= 11.5: return [57, 60, 64, 71]
    return prog[int(x // 2) % 4]

# pad
pad = np.zeros(N)
for b in range(8):
    st = b * 2.0
    for m in chord_at(st):
        seg = (t >= st) & (t < st + 2.0) if st < 11.5 else (t >= 11.5)
        for det in (-0.004, 0.004):
            ph = 2 * np.pi * hz(m) * (1 + det) * t
            pad += np.where(seg, (2 * ((ph / (2 * np.pi)) % 1) - 1), 0) * 0.03
pad = lp1(pad, np.interp(t, [0, 2.4, 2.6, 11.4, 11.6, DUR], [500, 900, 1800, 2200, 2600, 900]))
add(pad * np.interp(t, [0, 1, 11.4, 11.5, 11.6, 14.5, DUR], [0, 1, 1, .3, 1.2, 1, 0]))

# drums
for k, st in enumerate(np.arange(2.5, 11.5, BEAT)):
    f = 45 + 110 * np.exp(-np.maximum(t - st, 0) / 0.03)
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(st, 0.002, 0.16) * 0.75)            # kick
    if k % 2 == 1:
        add(lp1(rng.standard_normal(N) * env(st, 0.001, 0.07), 4000) * 0.5)               # clap/snap
for k, st in enumerate(np.arange(0.0, 11.5, BEAT / 2)):
    amt = 0.10 if st < 2.5 else 0.16
    h = np.diff(np.concatenate([[0], rng.standard_normal(N) * env(st + 0.001, 0.001, 0.025)]))
    add(h * amt * (1.3 if k % 2 else 0.8), pan=0.35 if k % 2 else -0.35)                   # hats / clock ticks

# bass (8ths, root)
for k, st in enumerate(np.arange(2.5, 11.5, BEAT / 2)):
    root = chord_at(st)[0] - 24
    e = env(st, 0.004, 0.12)
    add(np.tanh(2.5 * np.sin(2 * np.pi * hz(root) * t)) * e * 0.22)

# pluck arp (16ths) — whole piece, brighter in the groove
for k, st in enumerate(np.arange(0.0, 15.0, BEAT / 4)):
    ch = chord_at(st)
    m = ch[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + 12
    e = env(st, 0.002, 0.09)
    g = 0.045 if st < 2.5 else (0.06 if st < 11.5 else 0.03)
    add((np.sin(2 * np.pi * hz(m) * t) + 0.3 * np.sin(4 * np.pi * hz(m) * t)) * e * g, pan=0.4 if k % 2 else -0.4)

# whooshes into every cut
for c in CUTS:
    a, b = c - 0.45, c + 0.15
    m = (t >= a) & (t < b)
    p = np.zeros(N); p[m] = np.sin(np.pi * (t[m] - a) / (b - a)) ** 2
    add(lp1(rng.standard_normal(N) * p, 400 + 7000 * p) * 0.5)

# pops on doodles + labels + words
for st in [0.08, 0.22, 0.45, 1.5, 2.55, 2.72, 2.85, 5.05, 5.2, 5.35, 5.55, 5.7, 5.85, 6.0, 6.15, 8.1, 8.85, 9.35, 9.85]:
    f = 900 * np.exp(-np.maximum(t - st, 0) / 0.02) + 500
    add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(st, 0.001, 0.035) * 0.16)

# chimes as the arrows draw
for st, m in [(9.0, 81), (9.5, 84), (10.0, 88)]:
    e = env(st, 0.002, 0.5)
    add(sum(np.sin(2 * np.pi * hz(m) * r * t) * w for r, w in [(1, 1), (2.76, .35), (5.4, .15)]) * e * 0.1, pan=0.2)

# end card: impact + shimmer
f = 30 + 80 * np.exp(-np.maximum(t - 11.5, 0) / 0.07)
add(np.sin(2 * np.pi * np.cumsum(f) / SR) * env(11.5, 0.003, 0.8) * 1.0)
for k, m in enumerate([81, 84, 88, 91, 93]):
    add(np.sin(2 * np.pi * hz(m) * t) * env(11.55 + k * 0.08, 0.01, 1.2) * 0.045, pan=(k - 2) * 0.3)
# streak swoosh at 12.25
m = (t >= 12.15) & (t < 12.85)
p = np.zeros(N); p[m] = np.sin(np.pi * (t[m] - 12.15) / 0.7) ** 2
add(lp1(rng.standard_normal(N) * p, 2000 + 6000 * p) * 0.25, pan=0.0)

# small room
ir_len = int(SR * 1.4); irt = np.arange(ir_len) / SR
def rev(x, seed):
    ir = np.random.default_rng(seed).standard_normal(ir_len) * np.exp(-irt / 0.35); ir[0] = 0
    ir /= np.abs(ir).sum() / 5
    n = 1 << int(np.ceil(np.log2(N + ir_len)))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:N]
L, R = L + 0.25 * rev(L, 1), R + 0.25 * rev(R, 2)
fade = np.clip((DUR - t) / 1.0, 0, 1)
mix = np.stack([L, R], 1) * fade[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.6) * 0.9
out = Path(__file__).resolve().parent.parent / "audio" / "drb_focus_score_v2.wav"
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", out)
