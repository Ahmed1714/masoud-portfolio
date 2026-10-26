"""Render the preview MP4 of the Dr. B Focus reel (same timing as the After Effects build).
Usage: python3 scripts/render_preview.py [--frames a:b] [--still t1,t2,...]
"""
import math
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
A, F = ROOT / "assets", ROOT / "fonts"
W, H, FPS, DUR = 1080, 1920, 30, 16.5
GOLD = (232, 182, 90)
GOLD_HI = (250, 222, 150)
GOLD_LO = (176, 120, 40)

# ---------------------------------------------------------------- easing / keys
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def ease_out(x):
    return 1 - (1 - clamp(x)) ** 3

def ease_in_out(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2

def ease_back(x, s=1.4):
    x = clamp(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2

def ramp(t, t0, t1, v0, v1, ease=ease_out):
    return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0))

# ---------------------------------------------------------------- assets
def font(weight, size):
    return ImageFont.truetype(str(F / f"Montserrat-{weight}.ttf"), size)

def load(name):
    return Image.open(A / name).convert("RGBA")

PODIUM = load("scene_podium.png")
NOTEBOOK = load("scene_notebook.png")
PACK = load("focus_pack.png")
LOGO = load("drb_logo_gold.png")

def gold_fill(size):
    w, h = size
    y = np.linspace(0, 1, h)[:, None]
    k = np.clip(np.abs(y - 0.35) * 2.2, 0, 1)
    c = np.array(GOLD_HI) * (1 - k)[..., None] + np.array(GOLD_LO) * k[..., None]
    c = np.repeat(c, w, axis=1)
    return Image.fromarray(c.astype(np.uint8), "RGB")

@lru_cache(None)
def text_img(segments, tracking=0):
    """segments: tuple of (text, weight, size, color|'gold'). Returns RGBA trimmed image."""
    fonts = [font(wt, sz) for _, wt, sz, _ in segments]
    asc = max(f.getmetrics()[0] for f in fonts)
    desc = max(f.getmetrics()[1] for f in fonts)
    widths = []
    for (txt, _, _, _), f in zip(segments, fonts):
        widths.append(sum(f.getlength(ch) + tracking for ch in txt))
    tw = int(sum(widths)) + 40
    th = asc + desc + 40
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    x = 20
    for (txt, _, _, col), f in zip(segments, fonts):
        mask = Image.new("L", (tw, th), 0)
        d = ImageDraw.Draw(mask)
        for ch in txt:
            d.text((x, 20 + asc), ch, font=f, fill=255, anchor="ls")
            x += f.getlength(ch) + tracking
        fill = gold_fill((tw, th)) if col == "gold" else Image.new("RGB", (tw, th), col)
        layer = fill.convert("RGBA")
        layer.putalpha(mask)
        out = Image.alpha_composite(out, layer)
    return out.crop(out.getbbox())

# ---------------------------------------------------------------- compositing helpers
def place(canvas, img, cx, cy, opacity=1.0, blur=0.0, scale=1.0, rot=0.0):
    if opacity <= 0.003:
        return
    if scale != 1.0:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    if rot:
        img = img.rotate(rot, Image.BICUBIC, expand=True)
    if blur > 0.3:
        pad = int(blur * 3)
        big = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
        big.paste(img, (pad, pad))
        img = big.filter(ImageFilter.GaussianBlur(blur))
    if opacity < 1:
        a = img.getchannel("A").point(lambda v: int(v * opacity))
        img = img.copy(); img.putalpha(a)
    canvas.alpha_composite(img, (int(cx - img.width / 2), int(cy - img.height / 2)))

def bg_photo(img, scale, blur=0.0, dark=0.0):
    w, h = int(W * scale), int(H * scale)
    im = img.resize((w, h), Image.BILINEAR)
    im = im.crop(((w - W) // 2, (h - H) // 2, (w - W) // 2 + W, (h - H) // 2 + H))
    if blur > 0.3:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    if dark > 0:
        im = Image.blend(im, Image.new("RGBA", (W, H), (0, 0, 0, 255)), dark)
    return im

YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

def beam(angle_deg, offset, width, strength):
    """Diagonal soft light band (float HxW, 0..1)."""
    a = math.radians(angle_deg)
    d = (XX - W / 2) * math.cos(a) + (YY - H / 2) * math.sin(a) - offset
    return strength * np.exp(-(d / width) ** 2)

VIGNETTE = np.clip(1 - 0.55 * (((XX - W / 2) / (W * 0.75)) ** 2 + ((YY - H / 2) / (H * 0.62)) ** 2), 0.25, 1)[..., None]

@lru_cache(None)
def studio_bg():
    """Dark textured surface with a warm diagonal shaft (product + logo scenes)."""
    rng = np.random.default_rng(3)
    tex = Image.fromarray((rng.random((H // 4, W // 4)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    tex = np.asarray(tex.filter(ImageFilter.GaussianBlur(2)), np.float32)[..., None] / 255
    base = np.array([14, 11, 8], np.float32) * (0.85 + 0.3 * tex)
    shaft = beam(-58, -120, 260, 1.0)[..., None]
    col = base + shaft * np.array([170, 118, 52], np.float32) * (0.8 + 0.4 * tex)
    return col

def gradient_dark(top, bottom):
    y = np.linspace(0, 1, H)[:, None, None]
    return np.clip(top * np.clip(1 - y / 0.42, 0, 1) + bottom * np.clip((y - 0.55) / 0.45, 0, 1), 0, 1)

GRAD_TOP = gradient_dark(0.7, 0.0)
GRAD_BOTH = gradient_dark(0.75, 0.85)

def to_np(im):
    return np.asarray(im.convert("RGB"), np.float32)

# ---------------------------------------------------------------- particles
RNG = np.random.default_rng(11)
NP = 80
P_X = RNG.random(NP) * W
P_Y = RNG.random(NP) * H
P_S = RNG.random(NP) * 3.5 + 1.2
P_V = RNG.random(NP) * 22 + 8
P_PH = RNG.random(NP) * 6.28

def particles(arr, t, amount):
    if amount <= 0:
        return
    for i in range(NP):
        x = (P_X[i] + 18 * math.sin(t * 0.6 + P_PH[i])) % W
        y = (P_Y[i] - P_V[i] * t) % H
        tw = 0.55 + 0.45 * math.sin(t * 2.2 + P_PH[i] * 3)
        r = P_S[i]
        x0, x1 = int(max(0, x - r * 3)), int(min(W, x + r * 3 + 1))
        y0, y1 = int(max(0, y - r * 3)), int(min(H, y + r * 3 + 1))
        if x1 <= x0 or y1 <= y0:
            continue
        g = np.exp(-(((XX[y0:y1, x0:x1] - x) ** 2 + (YY[y0:y1, x0:x1] - y) ** 2) / (r * r)))
        arr[y0:y1, x0:x1] += g[..., None] * np.array(GOLD_HI, np.float32) * 0.55 * tw * amount

# ---------------------------------------------------------------- arrow
@lru_cache(None)
def arrow_img(progress_q):
    """Upward gold arrow; progress quantised 0..20."""
    p = progress_q / 20
    w, h = 90, 130
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    shaft = ease_out(p / 0.7)
    head = ease_back((p - 0.45) / 0.55)
    top = h - 10 - (h - 50) * shaft
    if shaft > 0:
        d.rounded_rectangle((w / 2 - 7, top, w / 2 + 7, h - 8), radius=7, fill=GOLD + (255,))
    if head > 0:
        s = 36 * head
        d.polygon([(w / 2, 6 + (1 - head) * 30), (w / 2 - s, 6 + (1 - head) * 30 + s), (w / 2 + s, 6 + (1 - head) * 30 + s)], fill=GOLD_HI + (255,))
    return im

# ---------------------------------------------------------------- scenes
def scene_hook(t):
    """0 - 5.6 : podium shot, rack-focus + 'been losing focus lately?' / 'that's okay...'"""
    blur = ramp(t, 1.3, 2.7, 22, 0, ease_in_out)
    cv = bg_photo(PODIUM, ramp(t, 0, 5.6, 1.18, 1.0, lambda x: x), blur)
    arr = to_np(cv) * (1 - GRAD_TOP * 0.9)
    arr += beam(-58, ramp(t, 3.3, 5.2, -900, 900, ease_in_out), 160, 0.22)[..., None] * np.array(GOLD_HI) * (3.3 < t < 5.4)
    cv = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

    # line 1
    if t < 3.3:
        out = ramp(t, 2.9, 3.2, 0, 1)
        l1 = text_img((("been losing", "Light", 78, (245, 240, 232)),), 4)
        a = ramp(t, 0.25, 0.9, 0, 1)
        place(cv, l1, 540, 470 + ramp(t, 0.25, 0.9, 30, 0), a * (1 - out), ramp(t, 0.25, 0.9, 10, 0) + out * 12)
        l2 = text_img((("focus", "Bold", 104, "gold"), (" lately?", "Light", 78, (245, 240, 232))), 4)
        a2 = ramp(t, 0.55, 1.2, 0, 1)
        fb = ramp(t, 1.2, 2.6, 9, 0, ease_in_out)  # the word is "out of focus" until the rack
        place(cv, l2, 540, 590 + ramp(t, 0.55, 1.2, 30, 0), a2 * (1 - out), fb + out * 12)
    else:
        out = ramp(t, 5.3, 5.6, 0, 1)
        l1 = text_img((("that's okay,", "Light", 72, (245, 240, 232)),), 4)
        place(cv, l1, 540, 470 + ramp(t, 3.3, 3.9, 30, 0), ramp(t, 3.3, 3.9, 0, 1) * (1 - out), ramp(t, 3.3, 3.9, 10, 0) + out * 12)
        l2 = text_img((("we got you covered", "SemiBold", 82, "gold"),), 2)
        place(cv, l2, 540, 580 + ramp(t, 3.65, 4.25, 30, 0), ramp(t, 3.65, 4.25, 0, 1) * (1 - out), ramp(t, 3.65, 4.25, 10, 0) + out * 12)
    return cv

def scene_product(t):
    """5.6 - 9.2 : hero product on the light shaft + 'say hello to Dr B's Focus Chocolate Tabs'"""
    lt = t - 5.6
    arr = studio_bg().copy()
    arr += beam(-58, -120, 140, ramp(lt, 0, 0.6, 0.6, 0.12))[..., None] * np.array(GOLD_HI)
    cv = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    out = ramp(t, 8.9, 9.2, 0, 1)

    # shadow
    sh = Image.new("RGBA", (900, 260), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse((80, 60, 820, 200), fill=(0, 0, 0, 200))
    sh = sh.filter(ImageFilter.GaussianBlur(40))
    place(cv, sh, 560, 1340, ramp(lt, 0.1, 0.6, 0, 0.85) * (1 - out))

    s = ease_back((lt) / 0.9, 1.2) * 0.25 + 0.75
    s *= 1 + 0.04 * clamp((lt - 0.9) / 2.7)
    pack = PACK.resize((860, int(860 * PACK.height / PACK.width)), Image.LANCZOS)
    # light sweep across the pack
    sw = ramp(lt, 1.0, 2.0, -1.2, 1.2, ease_in_out)
    if -1.1 < sw < 1.1:
        pa = np.asarray(pack, np.float32)
        yy, xx = np.mgrid[0:pack.height, 0:pack.width]
        band = np.exp(-(((xx / pack.width - 0.5) + (yy / pack.height - 0.5) * 0.6 - sw) / 0.08) ** 2)
        pa[..., :3] = np.clip(pa[..., :3] + band[..., None] * np.array(GOLD_HI) * 0.55, 0, 255)
        pack = Image.fromarray(pa.astype(np.uint8), "RGBA")
    place(cv, pack, 540, ramp(lt, 0, 0.9, 1250, 1080) - out * 40, ramp(lt, 0, 0.3, 0, 1) * (1 - out),
          out * 14, s, ramp(lt, 0, 1.2, -14, -5) + lt * 0.4)

    a = text_img((("say hello to", "Light", 58, (245, 240, 232)),), 8)
    place(cv, a, 540, 420 + ramp(t, 6.1, 6.7, 25, 0), ramp(t, 6.1, 6.7, 0, 1) * (1 - out), ramp(t, 6.1, 6.7, 8, 0) + out * 12)
    b = text_img((("Dr B's Focus", "SemiBold", 100, "gold"),), 2)
    place(cv, b, 540, 540 + ramp(t, 6.35, 6.95, 25, 0), ramp(t, 6.35, 6.95, 0, 1) * (1 - out), ramp(t, 6.35, 6.95, 8, 0) + out * 12)
    c = text_img((("CHOCOLATE TABS", "Medium", 50, (245, 240, 232)),), round(ramp(t, 6.6, 7.6, 30, 14)))
    place(cv, c, 540, 1580 + ramp(t, 6.6, 7.2, 25, 0), ramp(t, 6.6, 7.2, 0, 1) * (1 - out), ramp(t, 6.6, 7.2, 8, 0) + out * 12)
    return cv

BENEFITS = [("Mental Clarity", 9.6), ("Energy", 10.1), ("Concentration", 10.6)]

def scene_benefits(t):
    """9.2 - 13.2 : notebook shot + benefits with rising arrows"""
    cv = bg_photo(NOTEBOOK, ramp(t, 9.2, 13.2, 1.0, 1.07, lambda x: x), 0, 0.1)
    arr = to_np(cv) * (1 - GRAD_BOTH * 0.92)
    cv = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")
    out = ramp(t, 12.9, 13.2, 0, 1)
    intro = ramp(t, 9.2, 9.5, 0, 1)

    h = text_img((("it boosts your", "Light", 64, (245, 240, 232)),), 6)
    place(cv, h, 540, 330 + ramp(t, 9.25, 9.85, 25, 0), ramp(t, 9.25, 9.85, 0, 1) * (1 - out), ramp(t, 9.25, 9.85, 8, 0) + out * 12)
    for i, (word, st) in enumerate(BENEFITS):
        y = 1330 + i * 165
        p = clamp((t - st) / 0.7)
        bob = -6 * math.sin((t - st) * 3.2) if t > st + 0.7 else 0
        place(cv, arrow_img(round(p * 20)), 250, y + bob - 4, clamp(p * 3) * (1 - out) * intro, out * 10)
        wimg = text_img(((word, "SemiBold", 74, (245, 240, 232)),), 1)
        place(cv, wimg, 320 + wimg.width / 2 + ramp(t, st + 0.1, st + 0.7, 50, 0), y, ramp(t, st + 0.1, st + 0.6, 0, 1) * (1 - out),
              ramp(t, st + 0.1, st + 0.6, 8, 0) + out * 12)
    return cv

def scene_logo(t):
    """13.2 - 16.5 : logo reveal + 'the sharpest you can B'"""
    lt = t - 13.2
    arr = studio_bg() * 0.28
    glow = np.exp(-(((XX - 540) / 520) ** 2 + ((YY - 900) / 420) ** 2))[..., None]
    arr += glow * np.array([110, 72, 26]) * ramp(lt, 0, 0.8, 0.15, 0.45)
    arr += beam(-58, -120, 180, ramp(lt, 0, 0.5, 0.5, 0.0))[..., None] * np.array(GOLD_HI)
    cv = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

    logo = LOGO.resize((760, int(760 * LOGO.height / LOGO.width)), Image.LANCZOS)
    sw = ramp(lt, 1.8, 2.8, -1.2, 1.2, ease_in_out)
    if -1.1 < sw < 1.1:
        pa = np.asarray(logo, np.float32)
        yy, xx = np.mgrid[0:logo.height, 0:logo.width]
        band = np.exp(-(((xx / logo.width - 0.5) + (yy / logo.height - 0.5) * 0.5 - sw) / 0.07) ** 2)
        pa[..., :3] = np.clip(pa[..., :3] + band[..., None] * 200, 0, 255)
        logo = Image.fromarray(pa.astype(np.uint8), "RGBA")
    sc = ramp(lt, 0, 1.0, 1.18, 1.0) * (1 + 0.02 * clamp((lt - 1) / 2.3))
    place(cv, logo, 540, 860, ramp(lt, 0, 0.6, 0, 1), ramp(lt, 0, 0.7, 22, 0), sc)
    # glow pass
    gl = ramp(lt, 0.1, 0.4, 0, 1) * ramp(lt, 0.4, 1.6, 1, 0.35)
    place(cv, logo, 540, 860, gl * 0.8, 28, sc)

    lw = int(ramp(lt, 0.7, 1.3, 0, 440, ease_in_out))
    if lw > 2:
        line = Image.new("RGBA", (lw, 3), GOLD + (255,))
        place(cv, line, 540, 1090)
    tr = round(ramp(lt, 1.0, 2.2, 26, 5))
    tag = text_img((("the sharpest you can ", "Light", 60, (245, 240, 232)), ("B", "Bold", 72, "gold")), tr)
    place(cv, tag, 540, 1190 + ramp(lt, 1.0, 1.7, 20, 0), ramp(lt, 1.0, 1.7, 0, 1), ramp(lt, 1.0, 1.7, 8, 0))
    return cv

# ---------------------------------------------------------------- frame
GRAIN = np.random.default_rng(5).standard_normal((4, H, W)).astype(np.float32)

def frame(t):
    if t < 5.6:
        cv = scene_hook(t)
    elif t < 9.2:
        cv = scene_product(t)
    elif t < 13.2:
        cv = scene_benefits(t)
    else:
        cv = scene_logo(t)
    arr = to_np(cv)
    particles(arr, t, 0.6 if t < 5.6 else 1.0)
    # flashes on the two impacts
    for at, k in [(5.6, 0.9), (13.2, 0.8)]:
        f = math.exp(-max(0.0, t - at) / 0.09) if t >= at else 0
        arr += f * k * np.array([255, 225, 170], np.float32)
    arr *= VIGNETTE
    arr += GRAIN[int(t * FPS) % 4][..., None] * 4.0
    # warm grade
    arr = arr * np.array([1.03, 1.0, 0.93])
    fade_in = clamp(t / 0.35)
    return np.clip(arr * fade_in, 0, 255).astype(np.uint8)

def main():
    args = sys.argv[1:]
    if args and args[0] == "--still":
        for ts in args[1].split(","):
            Image.fromarray(frame(float(ts))).save(ROOT / "render" / f"still_{float(ts):05.2f}.jpg", quality=90)
        return
    total = int(DUR * FPS)
    out = ROOT / "render" / "DrB_Focus_Reel_preview.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(ROOT / "audio" / "drb_focus_score.wav"), "-c:v", "libx264", "-preset", "medium", "-crf", "18",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(out)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(total):
        p.stdin.write(frame(i / FPS).tobytes())
        if i % 30 == 0:
            print(f"frame {i}/{total}", flush=True)
    p.stdin.close(); p.wait()
    print("wrote", out)

if __name__ == "__main__":
    main()
