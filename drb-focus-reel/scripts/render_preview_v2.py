"""Option 2 (reference-style) preview render of the Dr. B Focus reel.
Kinetic type, whip transitions with motion blur, pseudo-3D pack, hand-drawn arrows.
Usage: python3 scripts/render_preview_v2.py [--still t1,t2,...]
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
W, H, FPS, DUR = 1080, 1920, 30, 16.0
CREAM = (248, 242, 232)
GOLD = (236, 184, 88)
GOLD_HI = (255, 224, 150)
GOLD_LO = (184, 124, 42)

# cuts (each transition is a vertical whip centred on the cut)
CUTS = [2.5, 5.0, 8.0, 11.5]

# ---------------------------------------------------------------- easing
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))

def e_out(x):          # expo-ish out, very soft landing
    x = clamp(x)
    return 1 - (1 - x) ** 4

def e_io(x):
    x = clamp(x)
    return 16 * x ** 5 if x < 0.5 else 1 - (-2 * x + 2) ** 5 / 2

def e_in(x):
    return clamp(x) ** 3

def e_back(x, s=1.7):
    x = clamp(x) - 1
    return 1 + (s + 1) * x ** 3 + s * x ** 2

def ramp(t, t0, t1, v0, v1, ease=e_out):
    return v0 + (v1 - v0) * ease((t - t0) / (t1 - t0))

# ---------------------------------------------------------------- assets
def font(weight, size):
    return ImageFont.truetype(str(F / f"Montserrat-{weight}.ttf"), size)

def load(name):
    return Image.open(A / name).convert("RGBA")

PACK = load("focus_pack.png")
LOGO = load("drb_logo_gold.png")
TAB = load("choc_tab.png")

def gold_fill(w, h):
    y = np.linspace(0, 1, h)[:, None]
    k = np.clip(np.abs(y - 0.35) * 2.0, 0, 1)
    c = np.array(GOLD_HI) * (1 - k)[..., None] + np.array(GOLD_LO) * k[..., None]
    return Image.fromarray(np.repeat(c, w, axis=1).astype(np.uint8), "RGB")

@lru_cache(None)
def text_img(segments, tracking=0, outline=0):
    """segments: tuple of (text, weight, size, colour|'gold'). outline>0 -> hollow stroke text."""
    fonts = [font(wt, sz) for _, wt, sz, _ in segments]
    asc = max(f.getmetrics()[0] for f in fonts)
    desc = max(f.getmetrics()[1] for f in fonts)
    tw = int(sum(sum(f.getlength(c) + tracking for c in s[0]) for s, f in zip(segments, fonts))) + 60
    th = asc + desc + 60
    out = Image.new("RGBA", (tw, th), (0, 0, 0, 0))
    x = 30
    for (txt, _, _, col), f in zip(segments, fonts):
        mask = Image.new("L", (tw, th), 0)
        d = ImageDraw.Draw(mask)
        xs = x
        for ch in txt:
            d.text((xs, 30 + asc), ch, font=f, fill=255, anchor="ls", stroke_width=outline, stroke_fill=255)
            xs += f.getlength(ch) + tracking
        if outline:
            inner = Image.new("L", (tw, th), 0)
            di = ImageDraw.Draw(inner)
            xs = x
            for ch in txt:
                di.text((xs, 30 + asc), ch, font=f, fill=255, anchor="ls")
                xs += f.getlength(ch) + tracking
            mask = Image.fromarray(np.clip(np.asarray(mask, np.int16) - np.asarray(inner, np.int16), 0, 255).astype(np.uint8))
        x = xs
        fill = gold_fill(tw, th) if col == "gold" else Image.new("RGB", (tw, th), col)
        layer = fill.convert("RGBA")
        layer.putalpha(mask)
        out = Image.alpha_composite(out, layer)
    return out.crop(out.getbbox())

def place(cv, img, cx, cy, opacity=1.0, blur=0.0, scale=1.0, rot=0.0):
    if opacity <= 0.003 or scale <= 0.01:
        return
    if abs(scale - 1.0) > 1e-3:
        img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    if abs(rot) > 0.05:
        img = img.rotate(rot, Image.BICUBIC, expand=True)
    if blur > 0.4:
        pad = int(blur * 3)
        big = Image.new("RGBA", (img.width + pad * 2, img.height + pad * 2), (0, 0, 0, 0))
        big.paste(img, (pad, pad))
        img = big.filter(ImageFilter.GaussianBlur(blur))
    if opacity < 0.999:
        img = img.copy()
        img.putalpha(img.getchannel("A").point(lambda v: int(v * opacity)))
    cv.alpha_composite(img, (int(round(cx - img.width / 2)), int(round(cy - img.height / 2))))

def pop(cv, img, x, y, t, t0, dur=0.45, out_t=None, rot=0.0):
    """Reference-style word pop: scale overshoot + rise + de-blur."""
    if t < t0:
        return
    p = (t - t0) / dur
    s = 0.55 + 0.45 * e_back(p, 2.0)
    o = clamp(p * 3)
    b = ramp(t, t0, t0 + dur * 0.6, 6, 0)
    if out_t is not None and t > out_t:
        q = (t - out_t) / 0.2
        o *= 1 - clamp(q)
    place(cv, img, x, y + ramp(t, t0, t0 + dur, 26, 0), o, b, s, rot)

# ---------------------------------------------------------------- background
YY, XX = np.mgrid[0:H, 0:W].astype(np.float32)

@lru_cache(None)
def background():
    r = np.sqrt(((XX - 540) / 900) ** 2 + ((YY - 980) / 1150) ** 2)
    k = np.clip(r, 0, 1)[..., None] ** 1.3
    centre, edge = np.array([52, 34, 20], np.float32), np.array([9, 6, 4], np.float32)
    bg = centre * (1 - k) + edge * k
    rng = np.random.default_rng(4)
    tex = Image.fromarray((rng.random((H // 3, W // 3)) * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)
    tex = np.asarray(tex.filter(ImageFilter.GaussianBlur(1.5)), np.float32)[..., None] / 255
    return bg * (0.94 + 0.12 * tex)

def glow(arr, cx, cy, rx, ry, strength, col=(150, 96, 36)):
    if strength <= 0:
        return
    g = np.exp(-(((XX - cx) / rx) ** 2 + ((YY - cy) / ry) ** 2))
    arr += g[..., None] * np.array(col, np.float32) * strength

# ---------------------------------------------------------------- 3D pack
def rot_m(rx, ry, rz):
    rx, ry, rz = map(math.radians, (rx, ry, rz))
    Rx = np.array([[1, 0, 0], [0, math.cos(rx), -math.sin(rx)], [0, math.sin(rx), math.cos(rx)]])
    Ry = np.array([[math.cos(ry), 0, math.sin(ry)], [0, 1, 0], [-math.sin(ry), 0, math.cos(ry)]])
    Rz = np.array([[math.cos(rz), -math.sin(rz), 0], [math.sin(rz), math.cos(rz), 0], [0, 0, 1]])
    return Rz @ Rx @ Ry

def coeffs(dst, src):
    m = []
    for (x, y), (X, Y) in zip(dst, src):
        m.append([x, y, 1, 0, 0, 0, -X * x, -X * y])
        m.append([0, 0, 0, x, y, 1, -Y * x, -Y * y])
    return np.linalg.solve(np.array(m, float), np.array(src, float).reshape(8))

@lru_cache(64)
def pack_tex(width):
    return PACK.resize((width, int(width * PACK.height / PACK.width)), Image.LANCZOS)

def warp(cv, tex, corners3d, R, cx, cy, focal=2200):
    pts = []
    for p in corners3d:
        X, Y, Z = R @ np.array(p, float)
        s = focal / (focal + Z)
        pts.append((cx + X * s, cy + Y * s))
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    x0, y0 = int(math.floor(min(xs))) - 2, int(math.floor(min(ys))) - 2
    x1, y1 = int(math.ceil(max(xs))) + 2, int(math.ceil(max(ys))) + 2
    if x1 < 0 or y1 < 0 or x0 > W or y0 > H:
        return
    w, h = tex.size
    dst = [(px - x0, py - y0) for px, py in pts]
    c = coeffs(dst, [(0, 0), (w, 0), (w, h), (0, h)])
    out = tex.transform((x1 - x0, y1 - y0), Image.PERSPECTIVE, tuple(c), Image.BICUBIC)
    cv.alpha_composite(out, (x0, y0)) if x0 >= 0 and y0 >= 0 else paste_clip(cv, out, x0, y0)

def paste_clip(cv, img, x0, y0):
    cx0, cy0 = max(0, -x0), max(0, -y0)
    img = img.crop((cx0, cy0, img.width, img.height))
    cv.alpha_composite(img, (x0 + cx0, y0 + cy0))

@lru_cache(64)
def pack_side(width):
    t = pack_tex(width)
    a = t.getchannel("A")
    side = Image.new("RGBA", t.size, (22, 19, 17, 255))
    side.putalpha(a)
    return side

def pack3d(cv, cx, cy, width, rx=0.0, ry=0.0, rz=0.0, depth=0.075, spec=0.0, shadow=0.0, blur=0.0):
    """Glossy pillow pack: shrinking extruded slices for thickness + angle-driven specular band."""
    width = int(round(width / 8) * 8)
    tex = pack_tex(width)
    w, h = tex.size
    R = rot_m(rx, ry, rz)
    target = cv if blur < 0.5 else Image.new("RGBA", cv.size, (0, 0, 0, 0))
    if shadow > 0:
        sh = Image.new("RGBA", (int(w * 1.1), int(h * 0.36)), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse((w * 0.08, h * 0.06, w * 1.02, h * 0.3), fill=(0, 0, 0, int(210 * shadow)))
        place(target, sh.filter(ImageFilter.GaussianBlur(w * 0.05)), cx + w * 0.03, cy + h * 0.52 * math.cos(math.radians(rx)))
    d = width * depth
    side = pack_side(width)
    K = 9
    for k in range(K, 0, -1):
        z = d * k / K
        s = 1 - 0.07 * (k / K) ** 1.5
        sl = side
        if k < 3:  # catch a little light on the rim nearest the front
            sl = side.copy()
            sl = Image.blend(sl, Image.new("RGBA", sl.size, (70, 62, 54, 255)), 0.35)
            sl.putalpha(side.getchannel("A"))
        warp(target, sl, [(-w / 2 * s, -h / 2 * s, z), (w / 2 * s, -h / 2 * s, z), (w / 2 * s, h / 2 * s, z), (-w / 2 * s, h / 2 * s, z)], R, cx, cy)
    # front face shading + specular sweep tied to rotation
    n = R @ np.array([0, 0, -1.0])
    facing = clamp(-n[2])
    pa = np.asarray(tex, np.float32).copy()
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u = 0.5 + ry / 40 - rx / 80 + spec
    band = np.exp(-(((xx / w - u) + (yy / h - 0.5) * 0.55) / 0.11) ** 2)
    shade = (0.78 + 0.22 * facing) * (0.92 + 0.12 * (1 - yy / h))
    pa[..., :3] = np.clip(pa[..., :3] * shade[..., None] + band[..., None] * np.array([255, 236, 200]) * 0.33, 0, 255)
    front = Image.fromarray(pa.astype(np.uint8), "RGBA")
    warp(target, front, [(-w / 2, -h / 2, 0), (w / 2, -h / 2, 0), (w / 2, h / 2, 0), (-w / 2, h / 2, 0)], R, cx, cy)
    if target is not cv:
        cv.alpha_composite(target.filter(ImageFilter.GaussianBlur(blur)))

# ---------------------------------------------------------------- chocolate tabs
@lru_cache(256)
def tab_img(size):
    return TAB.resize((size, size), Image.LANCZOS)

def tab(cv, x, y, size, rot=0.0, blur=0.0, opacity=1.0, tilt=0.0, shadow=True):
    size = max(8, int(round(size / 4) * 4))
    im = tab_img(size)
    if tilt:
        im = im.resize((size, max(4, int(size * abs(math.cos(math.radians(tilt)))))), Image.LANCZOS)
    if shadow and blur < 3:
        s = Image.new("RGBA", im.size, (0, 0, 0, 0))
        s.putalpha(im.getchannel("A").point(lambda v: int(v * 0.55)))
        place(cv, s, x + size * 0.06, y + size * 0.1, opacity, size * 0.08 + blur, 1.0, rot)
    place(cv, im, x, y, opacity, blur, 1.0, rot)

# ---------------------------------------------------------------- hand-drawn arrows
def bezier(p0, p1, p2, p3, n=90):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t ** 2 * p2 + t ** 3 * p3

def draw_arrow(cv, pts, progress, opacity=1.0, width=7.5, col=GOLD_HI):
    """Tapered hand-drawn stroke revealed by progress (0..1), arrowhead draws on at the end."""
    if progress <= 0 or opacity <= 0:
        return
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    n = len(pts)
    m = max(2, int(n * clamp(progress / 0.8)))
    for i in range(m - 1):
        f = i / (n - 1)
        r = width * (0.55 + 0.45 * math.sin(math.pi * min(1, f * 1.1)))
        x, y = pts[i]
        d.ellipse((x - r, y - r, x + r, y + r), fill=col + (255,))
    hp = clamp((progress - 0.75) / 0.25)
    if hp > 0:
        tip = np.array(pts[-1], float)
        tang = tip - np.array(pts[-6], float)
        tang /= np.linalg.norm(tang) + 1e-6
        for sgn in (-1, 1):
            a = math.radians(150 * sgn)
            v = np.array([tang[0] * math.cos(a) - tang[1] * math.sin(a), tang[0] * math.sin(a) + tang[1] * math.cos(a)])
            end = tip + v * 44 * e_out(hp)
            for k in range(14):
                q = tip + (end - tip) * k / 13
                r = width * (0.95 - 0.35 * k / 13)
                d.ellipse((q[0] - r, q[1] - r, q[0] + r, q[1] + r), fill=col + (255,))
    if opacity < 1:
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * opacity)))
    cv.alpha_composite(layer)

# ---------------------------------------------------------------- particles
RNG = np.random.default_rng(21)
NP = 60
P = dict(x=RNG.random(NP) * W, y=RNG.random(NP) * H, s=RNG.random(NP) * 3 + 1.2, v=RNG.random(NP) * 20 + 8, ph=RNG.random(NP) * 6.28)

def dust(arr, t, amt=1.0):
    for i in range(NP):
        x = (P["x"][i] + 16 * math.sin(t * 0.7 + P["ph"][i])) % W
        y = (P["y"][i] - P["v"][i] * t) % H
        r = P["s"][i]
        tw = 0.5 + 0.5 * math.sin(t * 2.4 + P["ph"][i] * 3)
        x0, x1 = int(max(0, x - r * 3)), int(min(W, x + r * 3 + 1))
        y0, y1 = int(max(0, y - r * 3)), int(min(H, y + r * 3 + 1))
        if x1 > x0 and y1 > y0:
            g = np.exp(-(((XX[y0:y1, x0:x1] - x) ** 2 + (YY[y0:y1, x0:x1] - y) ** 2) / (r * r)))
            arr[y0:y1, x0:x1] += g[..., None] * np.array(GOLD_HI, np.float32) * 0.45 * tw * amt

def new_canvas(t, glow_xy=(540, 1150), glow_s=1.0):
    arr = background().copy()
    glow(arr, glow_xy[0], glow_xy[1], 520, 560, 0.55 * glow_s)
    return arr

def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGBA")

WHITE = CREAM

# ---------------------------------------------------------------- scenes
def s1_hook(t):
    arr = new_canvas(t, (540, 1500), ramp(t, 1.1, 1.8, 0.3, 1.2))
    # warm orb (the reference's "moon") top-right, leaves as the pack arrives
    ox = 900 + ramp(t, 1.0, 1.5, 0, 420, e_in)
    glow(arr, ox, 260 - t * 12, 120, 120, 1.6, (255, 196, 110))
    glow(arr, ox, 260 - t * 12, 260, 260, 0.5, (190, 120, 50))
    cv = to_img(arr)
    # defocused tabs drifting in the corners (the reference's clouds)
    k = ramp(t, 1.0, 1.4, 0, 1, e_in)
    tab(cv, 120 - 420 * k, 300 + t * 10, 300, 18 + t * 6, blur=9, opacity=0.95, shadow=False)
    tab(cv, 930 + 420 * k, 1500 - t * 14, 340, -14 - t * 5, blur=12, opacity=0.95, shadow=False)

    if t < 1.25:  # phase A: centred question
        up = ramp(t, 1.0, 1.25, 0, -520, e_in)
        b = ramp(t, 1.0, 1.25, 0, 18, e_in)
        g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pop(g, text_img((("been", "Bold", 74, WHITE),)), 400, 840, t, 0.08)
        pop(g, text_img((("losing", "Bold", 74, WHITE),)), 640, 840, t, 0.22)
        pop(g, text_img((("FOCUS", "Black", 190, "gold"),), 4), 540, 990, t, 0.45, 0.5)
        if b > 0.5:
            g = g.transform(g.size, Image.AFFINE, (1, 0, 0, 0, 1, -up), Image.BICUBIC)
            g = vblur_img(g, b)
            cv.alpha_composite(g)
        else:
            cv.alpha_composite(g)
    else:         # phase B: question sits on top, giant pack rises
        dy = ramp(t, 1.25, 1.6, 300, 0)
        b = ramp(t, 1.25, 1.5, 14, 0)
        place(cv, text_img((("been losing", "Bold", 58, WHITE),), 1), 540, 205 + dy, 1, b)
        place(cv, text_img((("FOCUS", "Black", 132, "gold"),), 4), 540, 318 + dy, 1, b)
        pop(cv, text_img((("lately?", "ExtraBold", 92, WHITE),)), 540, 450, t, 1.5)
    if t > 1.05:
        rise = ramp(t, 1.05, 1.9, 1, 0)
        pack3d(cv, 560 + 40 * rise, 1430 + 1100 * rise + 10 * math.sin(t * 2), 1240,
               rx=10, ry=-16 + 6 * clamp((t - 1.05) / 1.4), rz=-7 + 4 * rise, spec=ramp(t, 1.3, 2.4, -0.6, 0.5, e_io))
    return cv

def stack_rows():
    return text_img((("COVERED", "Black", 178, WHITE),), 2, outline=3)

def s2_covered(t):
    arr = new_canvas(t, (540, 1500), 1.0)
    cv = to_img(arr)
    # a tab tumbles down behind the rows (the reference's falling gummy)
    ft = (t - 2.9) / 2.1
    if 0 < ft < 1:
        tab(cv, 700 + 60 * math.sin(ft * 3), 380 + ft * 1100, 120, ft * 400, opacity=clamp(ft * 8))
    pop(cv, text_img((("that's okay,", "Bold", 64, WHITE),)), 540, 215, t, 2.55)
    pop(cv, text_img((("we got you", "ExtraBold", 86, "gold"),)), 540, 310, t, 2.72)
    hollow = stack_rows()
    solid = text_img((("COVERED", "Black", 178, "gold"),), 2)
    order = [3, 2, 4, 1, 5, 0, 6]
    for rank, i in enumerate(order):
        y = 520 + i * 170
        t0 = 2.85 + rank * 0.06
        if t < t0:
            continue
        drift = (1 if i % 2 else -1) * ramp(t, 2.85, 5.0, -24, 24, lambda x: x)
        if i == 3:
            pop(cv, solid, 540 + drift, y, t, t0, 0.5)
        else:
            place(cv, hollow, 540 + drift, y + ramp(t, t0, t0 + 0.4, 30, 0), 0.42 * clamp((t - t0) / 0.3), ramp(t, t0, t0 + 0.35, 8, 0))
    # pack + tabs at its feet (the reference's clouds)
    pin = ramp(t, 2.5, 3.0, 1, 0)
    pack3d(cv, 540, 1600 + 500 * pin, 640, rx=8, ry=14 * math.sin(t * 1.6), rz=-4, spec=0.3 * math.sin(t * 1.6), shadow=0.8)
    tab(cv, 230 - 200 * pin, 1760, 230, -18 + t * 4)
    tab(cv, 860 + 200 * pin, 1730, 250, 14 - t * 4)
    return cv

DOODLES = [("SHARP!", 200, 690, 9, 5.55), ("WOW!", 885, 720, -9, 5.7), ("NEW!", 160, 1150, 7, 5.85),
           ("YES!", 230, 1590, -7, 6.0), ("LET'S GO!", 840, 1600, 8, 6.15)]

def s3_hello(t):
    arr = new_canvas(t, (540, 1150), 1.2)
    cv = to_img(arr)
    pop(cv, text_img((("say hello to", "Bold", 56, WHITE),)), 540, 205, t, 5.05)
    pop(cv, text_img((("Dr B's Focus", "Black", 108, "gold"),), 1), 540, 310, t, 5.2)
    pop(cv, text_img((("Chocolate Tabs", "ExtraBold", 92, WHITE),)), 540, 425, t, 5.35)
    lt = t - 5.0
    spin = ramp(t, 7.75, 8.0, 0, 1, e_in)       # whip into scene 4
    s = ramp(lt, 0, 0.7, 0.75, 1.0) * (1 + 0.6 * spin)
    pack3d(cv, 540, 1120 + 6 * math.sin(t * 1.8) + 240 * spin, 720 * s,
           rx=6 * math.sin(t * 1.3), ry=ramp(lt, 0, 0.9, 45, 0) + 16 * math.sin((t - 5.6) * 1.4) * clamp(lt - 0.6),
           rz=-90 * spin, spec=0.25 * math.sin(t * 1.4), shadow=0.9 * (1 - spin))
    tab(cv, 780, 1475 + 4 * math.sin(t * 2.4), 160, 16)
    tab(cv, 660, 1510 + 4 * math.sin(t * 2.0 + 1), 125, -22)
    for i, (word, x, y, r, t0) in enumerate(DOODLES):
        boil = 1.2 * math.sin(math.floor(t * 8) * 1.7 + i * 2)    # hand-lettering "boil"
        pop(cv, text_img(((word, "ExtraBoldItalic", 64, "gold" if i % 2 == 0 else WHITE),)), x, y, t, t0, 0.4, rot=r + boil)
    return cv

SPILL = [(560, 905, 128, 30), (720, 850, 118, -20), (885, 935, 132, 12), (640, 1060, 140, -35),
         (805, 1085, 124, 25), (965, 1010, 112, -8), (720, 1220, 120, 40)]
LABELS = [("Mental Clarity", 600, 560, 8.85, ((560, 625), (470, 700), (470, 800), (585, 835))),
          ("Energy", 300, 1450, 9.35, ((290, 1390), (270, 1300), (420, 1170), (565, 1130))),
          ("Concentration", 790, 1545, 9.85, ((850, 1485), (930, 1400), (900, 1270), (790, 1180)))]

def s4_benefits(t):
    arr = new_canvas(t, (620, 1000), 1.1)
    cv = to_img(arr)
    pop(cv, text_img((("it boosts your", "ExtraBold", 74, WHITE),)), 540, 235, t, 8.1)
    lt = t - 8.0
    rz = ramp(lt, 0, 0.55, -125, -78)
    s = ramp(lt, 0, 0.55, 1.45, 1.0)
    pack3d(cv, ramp(lt, 0, 0.55, 420, 150), 990 + 5 * math.sin(t * 1.7), 780 * s, rx=4, ry=10 + 4 * math.sin(t * 1.2), rz=rz,
           spec=0.2 * math.sin(t * 1.3))
    mouth = (395, 975)
    for i, (x, y, sz, r) in enumerate(SPILL):
        p = e_out((lt - 0.05 - i * 0.04) / 0.75)
        if p <= 0:
            continue
        bx = mouth[0] + (x - mouth[0]) * p
        by = mouth[1] + (y - mouth[1]) * p - 120 * math.sin(math.pi * p) * (0.4 + 0.2 * (i % 3))
        bob = 5 * math.sin(t * 2 + i) * clamp(p * 2 - 1)
        tab(cv, bx, by + bob, sz * (0.6 + 0.4 * p), r + (1 - p) * 220)
    for word, x, y, t0, ctrl in LABELS:
        pop(cv, text_img(((word, "ExtraBold", 64, WHITE),)), x, y, t, t0)
        pts = bezier(*[np.array(c, float) for c in ctrl])
        draw_arrow(cv, pts, clamp((t - t0 - 0.15) / 0.5))
    return cv

def s5_end(t):
    lt = t - 11.5
    arr = new_canvas(t, (540, 1280), ramp(lt, 0, 1.0, 0.6, 1.4))
    cv = to_img(arr)
    logo = LOGO.resize((680, int(680 * LOGO.height / LOGO.width)), Image.LANCZOS)
    place(cv, logo, 540, 330 + ramp(lt, 0.1, 0.8, 40, 0), clamp((lt - 0.1) / 0.4), ramp(lt, 0.1, 0.7, 14, 0),
          ramp(lt, 0.1, 0.9, 0.86, 1.0) * (1 + 0.015 * clamp(lt - 1)))
    gl = ramp(lt, 0.3, 0.6, 0, 1) * ramp(lt, 0.6, 1.8, 1, 0.3)
    place(cv, logo, 540, 330, gl * 0.7, 22, 1.0)
    words = [("the", 0.55), ("sharpest", 0.68), ("you", 0.81), ("can", 0.94)]
    x = 120
    xs = []
    for w_, _ in words:
        im = text_img(((w_, "Bold", 58, WHITE),))
        xs.append(x + im.width / 2)
        x += im.width + 18
    bimg = text_img((("B", "Black", 84, "gold"),))
    off = (W - (x - 120 + bimg.width)) / 2 - 120
    for (w_, t0), cx in zip(words, xs):
        pop(cv, text_img(((w_, "Bold", 58, WHITE),)), cx + off, 560, lt, t0)
    pop(cv, bimg, x + bimg.width / 2 + off, 552, lt, 1.15, 0.55)
    # pack on its glow + a pile of tabs (the reference's cloud)
    pin = ramp(lt, 0, 0.7, 1, 0)
    pack3d(cv, 540, 1210 + 700 * pin + 8 * math.sin(t * 1.6), 760, rx=5, ry=ramp(lt, 0, 0.9, -35, 0) + 9 * math.sin((t - 12.4) * 1.2) * clamp(lt - 0.9),
           rz=-2, spec=ramp(lt, 1.6, 2.6, -0.9, 0.9, e_io), shadow=0.8)
    for i, (x_, y_, sz, r) in enumerate([(230, 1640, 200, -18), (850, 1625, 210, 16), (410, 1715, 180, 8), (680, 1720, 190, -10), (540, 1800, 170, 24)]):
        side = -1 if x_ < 540 else 1
        tab(cv, x_ + side * 400 * ramp(lt, 0.1 + i * 0.05, 0.8 + i * 0.05, 1, 0), y_ + 3 * math.sin(t * 2 + i), sz, r)
    # gold swoosh line (the reference's streak)
    sp = (lt - 0.75) / 0.55
    if 0 < sp < 1.3:
        pts = bezier(np.array([1250.0, 640]), np.array([860, 700]), np.array([420, 760]), np.array([-160, 830]), 120)
        head = int(len(pts) * clamp(sp))
        tail = int(len(pts) * clamp(sp - 0.35))
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        for i in range(tail, head):
            f = (i - tail) / max(1, head - tail)
            r = 1 + 4 * f
            d.ellipse((pts[i][0] - r, pts[i][1] - r, pts[i][0] + r, pts[i][1] + r), fill=GOLD_HI + (int(255 * f),))
        cv.alpha_composite(layer)
    return cv

# ---------------------------------------------------------------- motion blur helpers
def vshift(arr, dy):
    """Shift rows by dy (no wrap-around; edges are clamped)."""
    dy = int(dy)
    if dy == 0:
        return arr
    src = np.arange(arr.shape[0]) - dy
    out = arr[np.clip(src, 0, arr.shape[0] - 1)]
    off = (src < 0) | (src >= arr.shape[0])
    out[off] = background()[off] if arr.shape[2] == 3 else 0   # reveal clean background, never wrap
    return out

def vblur(arr, amount):
    """Vertical motion blur (amount in px)."""
    if amount < 1:
        return arr
    n = max(2, min(24, int(amount / 6)))
    acc = np.zeros_like(arr)
    for k in range(n):
        acc += vshift(arr, -amount / 2 + amount * k / (n - 1))
    return acc / n

def vblur_img(img, amount):
    a = np.asarray(img, np.float32)
    a = vblur(a * np.concatenate([np.ones(3), [1]])[None, None, :], amount * 4)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")

SCENES = [(0, s1_hook), (2.5, s2_covered), (5.0, s3_hello), (8.0, s4_benefits), (11.5, s5_end)]

def scene_at(t):
    fn = SCENES[0][1]
    for st, f in SCENES:
        if t >= st:
            fn = f
    return fn

GRAIN = np.random.default_rng(5).standard_normal((4, H, W)).astype(np.float32)
VIG = np.clip(1 - 0.5 * (((XX - W / 2) / (W * 0.8)) ** 2 + ((YY - H / 2) / (H * 0.65)) ** 2), 0.3, 1)[..., None]

def frame(t):
    arr = np.asarray(scene_at(t)(t).convert("RGB"), np.float32)
    # whip transitions: outgoing scene accelerates up, incoming lands from below, vertical motion blur
    for c in CUTS:
        if c - 0.2 <= t < c:
            p = (t - (c - 0.2)) / 0.2
            arr = vblur(vshift(arr, -e_in(p) * 520), 260 * e_in(p))
        elif c <= t < c + 0.3:
            p = (t - c) / 0.3
            arr = vblur(vshift(arr, (1 - e_out(p)) * 520), 260 * (1 - e_out(p)))
    dust(arr, t, 0.8)
    arr *= VIG
    arr += GRAIN[int(t * FPS) % 4][..., None] * 3.5
    arr *= np.array([1.03, 1.0, 0.94])
    arr *= clamp(t / 0.25)
    return np.clip(arr, 0, 255).astype(np.uint8)

def main():
    args = sys.argv[1:]
    if args and args[0] == "--still":
        for ts in args[1].split(","):
            Image.fromarray(frame(float(ts))).save(ROOT / "render" / f"v2_still_{float(ts):05.2f}.jpg", quality=90)
        return
    total = int(DUR * FPS)
    out = ROOT / "render" / "DrB_Focus_Reel_V2_preview.mp4"
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-i", str(ROOT / "audio" / "drb_focus_score_v2.wav"), "-c:v", "libx264", "-preset", "slow", "-crf", "21",
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
