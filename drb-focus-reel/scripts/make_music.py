"""Synthesize the original 16.5s score for the reel (royalty free, no samples).
Hits are locked to the edit: 5.6s product reveal, 9.6/10.1/10.6s arrows, 13.2s logo.
"""
from pathlib import Path
import sys
import wave
import numpy as np

SR = 48000
DUR = 16.5
# optional tail (s) so the score keeps ringing under the client outro: make_music*.py 4.73
TAIL = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
DUR += TAIL
N = int(SR * DUR)
t = np.arange(N) / SR
rng = np.random.default_rng(7)
L = np.zeros(N); R = np.zeros(N)            # music bus
FXL = np.zeros(N); FXR = np.zeros(N)        # sound-effects bus
BUS = "music"

def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)

def env(start, a, d, length=None):
    e = np.zeros(N)
    i0 = int(start * SR)
    n = int((length if length else a + d) * SR)
    n = min(n, N - i0)
    tt = np.arange(n) / SR
    e[i0:i0 + n] = np.minimum(tt / max(a, 1e-4), 1) * np.exp(-np.maximum(tt - a, 0) / d)
    return e

def lowpass(x, cutoff):
    # one-pole, cutoff may be an array
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    k = 1 - np.exp(-2 * np.pi * c / SR)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc += k[i] * (x[i] - acc); y[i] = acc
    return y

def add(sig, pan=0.0, gain=1.0):
    global L, R, FXL, FXR
    if BUS == "sfx":
        FXL += sig * gain * np.sqrt(0.5 * (1 - pan)); FXR += sig * gain * np.sqrt(0.5 * (1 + pan))
        return
    L += sig * gain * np.sqrt(0.5 * (1 - pan)); R += sig * gain * np.sqrt(0.5 * (1 + pan))

# Pad: blurry/detuned until the reveal, then it "locks" into tune and opens up
reveal = 5.6
detune = np.where(t < reveal, 0.012 * np.sin(2 * np.pi * 0.35 * t), 0.0015)
chord_a = [45, 52, 59, 60, 67]           # Am9
chord_f = [41, 48, 57, 60, 64]           # Fmaj7 (under the benefits)
for idx, (ma, mf) in enumerate(zip(chord_a, chord_f)):
    for side in (-1, 1):
        f = np.where((t > 9.2) & (t < 13.2), hz(mf), hz(ma)) * (1 + side * detune * (idx + 1) / 3)
        ph = 2 * np.pi * np.cumsum(f) / SR
        saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
        add(saw * 0.05, pan=side * 0.5)
cut = np.interp(t, [0, 5.4, 5.7, 13.1, 13.3, DUR], [350, 600, 1500, 2200, 3200, 1200])
L = lowpass(L, cut); R = lowpass(R, cut)
pad_env = np.interp(t, [0, 1.5, 5.4, 5.6, 5.75, 13.1, 13.2, 13.35, 15.5, DUR], [0, 1, 1, .2, 1, 1, .2, 1.1, .9, 0])
L *= pad_env; R *= pad_env

BUS = "sfx"
# Clock ticks (0 - 5.4s): the "losing focus" tension
for k, st in enumerate(np.arange(0.2, 5.4, 60 / 100)):
    click = rng.standard_normal(N) * env(st, 0.001, 0.018)
    add(np.diff(np.concatenate([[0], click])) * (0.35 if k % 2 == 0 else 0.22), pan=0.3 if k % 2 else -0.3)

# Risers into the two big moments
for a, b in [(4.4, 5.6), (12.1, 13.2)]:
    m = (t >= a) & (t < b)
    p = np.zeros(N); p[m] = ((t[m] - a) / (b - a)) ** 2
    noise = lowpass(rng.standard_normal(N) * p, 300 + 6000 * p)
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 900 * p) / SR) * p * 0.08
    add(noise * 0.35 + sweep, gain=1.0)

def impact(at, gain=1.0):
    f = 30 + 70 * np.exp(-np.maximum(t - at, 0) / 0.08)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(at, 0.004, 0.9)
    crack = lowpass(rng.standard_normal(N), 2500) * env(at, 0.001, 0.12)
    add((boom * 0.9 + crack * 0.4) * gain)

impact(reveal); impact(13.2, 1.15)

BUS = "music"
# Soft pulse + pentatonic arp after the reveal (100 BPM eighths)
scale = [57, 60, 62, 64, 67, 69, 72]
step = 60 / 100 / 2
for k, st in enumerate(np.arange(reveal + step * 2, 13.0, step)):
    note = scale[[0, 2, 4, 6, 5, 3, 4, 1][k % 8]]
    e = env(st, 0.003, 0.22)
    pl = np.sin(2 * np.pi * hz(note) * t) * e + 0.3 * np.sin(4 * np.pi * hz(note) * t) * e ** 2
    add(pl * 0.09, pan=0.45 if k % 2 else -0.45)
    if k % 4 == 0:
        add(np.sin(2 * np.pi * hz(33) * t) * env(st, 0.01, 0.35) * 0.35)

BUS = "sfx"
# Chimes on each arrow (ascending = "boost")
for at, m in [(9.6, 76), (10.1, 79), (10.6, 84)]:
    e = env(at, 0.002, 0.9)
    bell = sum(np.sin(2 * np.pi * hz(m) * r * t) * w for r, w in [(1, 1), (2.76, .4), (5.4, .2)]) * e
    add(bell * 0.12, pan=0.2)

# Shimmer on the logo
for k, m in enumerate([81, 84, 88, 91, 93]):
    add(np.sin(2 * np.pi * hz(m) * t) * env(13.25 + k * 0.09, 0.01, 1.6) * 0.05, pan=(k - 2) * 0.3)

# Reverb: convolve with decaying noise
ir_len = int(SR * 2.2)
irt = np.arange(ir_len) / SR
def reverb(x, seed):
    ir = np.random.default_rng(seed).standard_normal(ir_len) * np.exp(-irt / 0.55)
    ir[0] = 0; ir /= np.abs(ir).sum() / 6
    n = 1 << int(np.ceil(np.log2(N + ir_len)))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(ir, n), n)[:N]
MUS, FX = [L, R], [FXL, FXR]
for bus in (MUS, FX):
    bus[0], bus[1] = bus[0] + 0.35 * reverb(bus[0], 1), bus[1] + 0.35 * reverb(bus[1], 2)

fade = np.clip((DUR - t) / (1.2 + TAIL * 0.4), 0, 1)
mus = np.stack(MUS, 1) * fade[:, None]
fx = np.stack(FX, 1) * fade[:, None]
full = mus + fx
g = 1.4 / np.abs(full).max()
mix = np.tanh(full * g) * 0.9
# per-sample limiter gain, applied to both stems so music + sfx == full mix exactly
safe = np.where(np.abs(full) < 1e-9, 1e-9, full)
k = np.where(np.abs(full) < 1e-9, g * 0.9, mix / safe)

def write(name, data):
    out = Path(__file__).resolve().parent.parent / "audio" / name
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(data, -1, 1) * 32767).astype("<i2").tobytes())
    print("wrote", out)

write("drb_focus_score.wav", mix)
write("drb_focus_score_MUSIC.wav", mus * k)
write("drb_focus_score_SFX.wav", fx * k)
