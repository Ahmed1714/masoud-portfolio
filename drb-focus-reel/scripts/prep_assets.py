"""Prepare clean, AE-ready assets from the raw client files.
Usage: python3 scripts/prep_assets.py <logo.png> <product.png> <scene_notebook.png> <scene_podium.png>
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "assets"
OUT.mkdir(exist_ok=True)
logo_p, product_p, notebook_p, podium_p = sys.argv[1:5]

# Logo: gold on white -> un-multiply white to get a real alpha channel
rgb = np.asarray(Image.open(logo_p).convert("RGB")).astype(np.float32) / 255.0
raw = 1.0 - rgb.min(axis=2)
safe = np.maximum(raw, 1e-4)[..., None]
col = np.clip((rgb - (1.0 - safe)) / safe, 0, 1)
alpha = np.clip(raw * 1.15, 0, 1)
# Re-tint along a clean gold ramp (removes the olive JPEG fringe) while keeping the bevel shading
luma = (col * [0.299, 0.587, 0.114]).sum(axis=2, keepdims=True)
luma = np.clip((luma - 0.12) / 0.6, 0, 1)
dark, mid, hi = np.array([0.45, 0.26, 0.05]), np.array([0.85, 0.58, 0.18]), np.array([1.0, 0.9, 0.62])
col = np.where(luma < 0.5, dark + (mid - dark) * (luma * 2), mid + (hi - mid) * (luma * 2 - 1))
logo = np.dstack([col, alpha]) * 255
logo = Image.fromarray(logo.astype(np.uint8), "RGBA")
logo = logo.crop(logo.getbbox())
logo = logo.resize((logo.width * 2, logo.height * 2), Image.LANCZOS)
logo.save(OUT / "drb_logo_gold.png")

# Product: already has alpha, just trim
prod = Image.open(product_p).convert("RGBA")
a = np.asarray(prod)[..., 3]
ys, xs = np.where(a > 8)
prod.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(OUT / "focus_pack.png")

# Scenes: upscale to 1080x1920
for src, name in [(notebook_p, "scene_notebook.png"), (podium_p, "scene_podium.png")]:
    Image.open(src).convert("RGB").resize((1080, 1920), Image.LANCZOS).save(OUT / name)
print("done", [p.name for p in OUT.iterdir()])
