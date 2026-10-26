"""Procedural 3D-shaded chocolate tab (rounded square, bevel, embossed B) -> assets/choc_tab.png"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
S = 480
yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)

def rounded_sdf(cx, cy, half, r):
    qx = np.abs(xx - cx) - (half - r)
    qy = np.abs(yy - cy) - (half - r)
    return np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r

d = rounded_sdf(S / 2, S / 2, 200, 60)                     # <0 inside
alpha = np.clip(0.5 - d, 0, 1)
h = np.clip(-d / 46, 0, 1)
h = h * h * (3 - 2 * h)                                     # soft bevel
inner = np.clip((-rounded_sdf(S / 2, S / 2, 138, 34)) / 8, 0, 1)
h -= 0.10 * inner                                           # recessed panel
# embossed B
m = Image.new("L", (S, S), 0)
ImageDraw.Draw(m).text((S / 2, S / 2 + 6), "B", font=ImageFont.truetype(str(ROOT / "fonts/Montserrat-ExtraBold.ttf"), 190), fill=255, anchor="mm")
m = np.asarray(m.filter(ImageFilter.GaussianBlur(3)), np.float32) / 255
h += 0.16 * m
h += np.random.default_rng(1).standard_normal((S, S)).astype(np.float32) * 0.0005

gy, gx = np.gradient(h * 60)
n = np.dstack([-gx, -gy, np.ones_like(h)])
n /= np.linalg.norm(n, axis=2, keepdims=True)
L = np.array([-0.45, -0.6, 0.66]); L /= np.linalg.norm(L)
lam = np.clip((n * L).sum(2), 0, 1)
Hv = L + np.array([0, 0, 1.0]); Hv /= np.linalg.norm(Hv)
spec = np.clip((n * Hv).sum(2), 0, 1) ** 40
base = np.array([70, 38, 21], np.float32)
col = base * (0.35 + 0.85 * lam)[..., None] + spec[..., None] * np.array([255, 225, 190]) * 0.7
col *= (0.75 + 0.25 * h)[..., None]
img = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
Image.fromarray(img, "RGBA").save(ROOT / "assets" / "choc_tab.png")
print("ok")
