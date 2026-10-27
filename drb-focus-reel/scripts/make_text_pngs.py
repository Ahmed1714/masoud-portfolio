"""Render the reel copy as transparent PNGs (Montserrat), named exactly as the AE build scripts expect.
Usage: node scripts/collect_text_specs.js <script.jsx> > specs.json
       python3 scripts/make_text_pngs.py specs.json <out_dir>
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = Path(__file__).resolve().parent.parent / "fonts"
CREAM = (246, 241, 232)
GOLD_HI, GOLD_LO = (255, 224, 150), (184, 124, 42)

def render(spec):
    segs, tracking, outline = spec["segs"], spec["tracking"], spec["outline"]
    fonts = [ImageFont.truetype(str(FONTS / f"{s[1]}.ttf"), s[2]) for s in segs]
    big = max(s[2] for s in segs)
    asc = max(f.getmetrics()[0] for f in fonts)
    W = int(sum(sum(f.getlength(c) + tracking / 1000 * s[2] for c in s[0]) for s, f in zip(segs, fonts))) + big * 2
    H = int(big * 2.4)
    alpha = np.zeros((H, W), np.float32)
    gold = np.zeros((H, W), np.float32)
    x = big
    for s, f in zip(segs, fonts):
        m = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(m)
        inner = Image.new("L", (W, H), 0)
        di = ImageDraw.Draw(inner)
        for ch in s[0]:
            d.text((x, big * 0.4 + asc), ch, font=f, fill=255, anchor="ls", stroke_width=outline, stroke_fill=255)
            if outline:
                di.text((x, big * 0.4 + asc), ch, font=f, fill=255, anchor="ls")
            x += f.getlength(ch) + tracking / 1000 * s[2]
        a = np.asarray(m, np.float32) / 255
        if outline:
            a = np.clip(a - np.asarray(inner, np.float32) / 255, 0, 1)
        alpha = np.maximum(alpha, a)
        if s[3] == "gold":
            gold = np.maximum(gold, a)
    ys, xs = np.where(alpha > 0.01)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    yy = (np.arange(H)[:, None] - y0) / max(1, y1 - y0)
    k = np.clip(np.abs(yy - 0.35) * 2.0, 0, 1)
    grad = np.array(GOLD_HI) * (1 - k)[..., None] + np.array(GOLD_LO) * k[..., None]
    grad = np.repeat(grad, W, axis=1)
    isgold = (gold > 0.01)[..., None]
    rgb = np.where(isgold, grad, np.array(CREAM, np.float32))
    img = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    img = img[y0:y1, x0:x1]
    pad = round(big * 0.6)                       # must match textPad() in the .jsx
    out = np.zeros((img.shape[0] + pad * 2, img.shape[1] + pad * 2, 4), np.uint8)
    out[pad:pad + img.shape[0], pad:pad + img.shape[1]] = img
    return Image.fromarray(out, "RGBA")

def main():
    specs = json.load(open(sys.argv[1]))
    out = Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    for s in specs:
        render(s).save(out / s["name"])
    print(f"{len(specs)} text images -> {out}")

if __name__ == "__main__":
    main()
