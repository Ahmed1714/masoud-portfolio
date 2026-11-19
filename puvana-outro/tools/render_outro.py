"""Frame renderer that mirrors PUVANA_Outro.jsx (same timings, easing, random seed)
and pipes 1920x1080 @30fps frames into ffmpeg together with the sound design.
usage: python3 render_outro.py logo.png sfx.wav out.mp4"""
import sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

LOGO, SFX, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
W, H, FPS, DUR = 1920, 1080, 30, 6.0
SS = 2                                   # supersampling for vector elements
MB = int(sys.argv[4]) if len(sys.argv) > 4 else 4   # motion-blur sub-samples
TAGLINE = "PURE  •  NATURAL  •  FRESH"
FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
WHITE, BGEDGE = hexc("FFFFFF"), hexc("EEF3F5")
TEAL, TEALD, GOLD, GOLDL, SHADOW = hexc("16A0B8"), hexc("0F4A63"), hexc("C9A052"), hexc("E6C987"), hexc("0B2E3D")

# ---------------- AE-style keyframe easing ----------------
INF = {"e": (70, 70), "s": (92, 92), "ei": (88, None), "eo": (None, 88), "l": (None, None)}

def bez(x1, x2, x):
    # cubic-bezier(x1,0,x2,1) timing: solve for t with given x
    lo, hi = 0.0, 1.0
    for _ in range(40):
        t = (lo + hi) / 2
        xt = 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t * t * x2 + t ** 3
        if xt < x: lo = t
        else: hi = t
    t = (lo + hi) / 2
    return 3 * (1 - t) * t * t + t ** 3        # y with y1=0,y2=1

def kv(keys, time):
    v = _kv(keys, time)
    return float(v) if v.ndim == 0 else v

def _kv(keys, time):
    if time <= keys[0][0]: return np.array(keys[0][1], float)
    if time >= keys[-1][0]: return np.array(keys[-1][1], float)
    for a, b in zip(keys, keys[1:]):
        if a[0] <= time <= b[0]:
            x = (time - a[0]) / (b[0] - a[0])
            oi = INF[a[2] if len(a) > 2 else "e"][1]
            ii = INF[b[2] if len(b) > 2 else "e"][0]
            x1 = oi / 100 if oi else 1 / 3
            x2 = 1 - (ii / 100 if ii else 1 / 3)
            y = bez(x1, x2, x)
            va, vb = np.array(a[1], float), np.array(b[1], float)
            return va + (vb - va) * y

# ---------------- seeded random (same LCG as the JSX) ----------------
seed = 1714
def rnd():
    global seed
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
def rr(a, b): return a + (b - a) * rnd()

# ---------------- layout ----------------
logo_src = Image.open(LOGO).convert("RGBA")
S = 640 / logo_src.width
LW, LH = logo_src.width * S, logo_src.height * S
CX, CY = W / 2, H / 2 - 45
T_IMPACT, T_LOGO = 0.55, 1.10
logo_hi = logo_src.resize((int(LW * 1.25), int(LH * 1.25)), Image.LANCZOS)  # base for transforms

# splash droplets
splash = []
for d in range(10):
    ang = (d / 10) * math.pi * 2 + rr(-0.2, 0.2); dist = rr(140, 340)
    dx, dy = math.cos(ang) * dist, math.sin(ang) * dist * 0.6
    ds = rr(10, 20); st = T_IMPACT + rr(0, 0.06); up = rr(60, 130)
    col = GOLD if d % 3 == 0 else TEAL
    splash.append(dict(ds=ds, st=st, col=col, pos=[[st, [CX, CY], "l"], [st + .28, [CX + dx * .65, CY + dy * .65 - up], "e"], [st + .6, [CX + dx, CY + dy + 40], "ei"]]))

sparkles = []
for p in range(16):
    a2 = rr(0, math.pi * 2)
    sx, sy = CX + math.cos(a2) * LW * .42, CY + math.sin(a2) * LH * .42
    push = rr(90, 230); ex, ey = sx + math.cos(a2) * push, sy + math.sin(a2) * push * .8
    big = rr(10, 22)
    col = TEAL if p % 4 == 0 else (GOLD if p % 2 else GOLDL)
    s0 = T_LOGO + .15 + rr(0, .3); sd = rr(.7, 1.1); rot = rr(90, 200)
    sparkles.append(dict(big=big, col=col, s0=s0, sd=sd, pos=[[s0, [sx, sy], "l"], [s0 + sd, [ex, ey], "ei"]],
                         sc=[[s0, 0], [s0 + sd * .35, 100], [s0 + sd, 0]], rot=[[s0, 0, "l"], [s0 + sd, rot, "l"]]))
twinkles = [(.36, -.30, 2.45), (-.40, .18, 2.75), (.12, -.45, 2.95)]

# ---------------- static assets ----------------
yy, xx = np.mgrid[0:H, 0:W]
dist = np.sqrt((xx - CX) ** 2 + (yy - CY) ** 2) / math.hypot(CX, CY)
dist = np.clip(dist, 0, 1)[..., None]
BG = (np.array(WHITE) * (1 - dist) + np.array(BGEDGE) * dist).astype(np.uint8)
BG_IMG = Image.fromarray(BG, "RGB").convert("RGBA")

def blurred_ellipse(w, h, blur, color):
    pad = int(blur * 3)
    im = Image.new("L", (int(w) + 2 * pad, int(h) + 2 * pad), 0)
    ImageDraw.Draw(im).ellipse([pad, pad, pad + w, pad + h], fill=255)
    im = im.filter(ImageFilter.GaussianBlur(blur / 2))
    out = Image.new("RGBA", im.size, color + (0,)); out.putalpha(im); return out
SHADOW_IMG = blurred_ellipse(LW * .62, 26, 22, SHADOW)

def make_shine():
    bw, bh = 110, int(LH * 2.4)
    im = Image.new("L", (bw + 200, bh + 200), 0)
    ImageDraw.Draw(im).rectangle([100, 100, 100 + bw, 100 + bh], fill=int(255 * .75))
    im = im.rotate(-22, resample=Image.BICUBIC, expand=True).filter(ImageFilter.GaussianBlur(17))
    return im
SHINE = make_shine()

font = ImageFont.truetype(FONT, 34)

# ---------------- geometry helpers ----------------
def cubic(p0, c0, c1, p1, n=24):
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * c0 + 3 * (1 - t) * t ** 2 * c1 + t ** 3 * p1

def bezier_path(verts, inT, outT, closed):
    v = [np.array(p, float) for p in verts]; pts = []
    n = len(v); segs = n if closed else n - 1
    for i in range(segs):
        j = (i + 1) % n
        seg = cubic(v[i], v[i] + outT[i], v[j] + inT[j], v[j])
        pts.append(seg if i == 0 else seg[1:])
    return np.vstack(pts)

hw, hh = LW * .515, LH * .515; cy2 = hh * .594; k = hw * .56
HEX = bezier_path([[0, hh], [-hw, cy2], [-hw, -cy2], [0, -hh], [hw, -cy2], [hw, cy2]],
                  [[k, 0], [0, 0], [0, 0], [-k, 0], [0, 0], [0, 0]],
                  [[-k, 0], [0, 0], [0, 0], [k, 0], [0, 0], [0, 0]], True)
DROP = bezier_path([[0, -55], [28, 12], [0, 40], [-28, 12]], [[0, 0], [0, -24], [16, 0], [0, 16]],
                   [[0, 0], [0, 16], [-16, 0], [0, -24]], True)

def trim(pts, a, b):
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1); cum = np.r_[0, np.cumsum(seg)]; tot = cum[-1]
    a, b = a * tot, b * tot
    if b - a < 0.5: return None
    out = [np.interp(a, cum, pts[:, 0]), np.interp(a, cum, pts[:, 1])]
    res = [out] + [list(p) for p, c in zip(pts, cum) if a < c < b] + [[np.interp(b, cum, pts[:, 0]), np.interp(b, cum, pts[:, 1])]]
    return np.array(res)

def star_pts(outer, inner, rot):
    pts = []
    for i in range(8):
        r = outer if i % 2 == 0 else inner
        a = math.radians(rot) + i * math.pi / 4 - math.pi / 2
        pts.append((math.cos(a) * r, math.sin(a) * r))
    return np.array(pts)

def rgba(c, a): return tuple(c) + (int(max(0, min(1, a)) * 255),)

def perspective_coeffs(src, dst):
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    return np.linalg.solve(np.array(A, float), np.array(B, float))

ZOOM = 2666.7
def logo_layer(t):
    """returns full-frame RGBA image of the 3D logo at time t"""
    sc = kv([[T_LOGO, 0, "l"], [T_LOGO + .30, 110], [T_LOGO + .48, 96.5], [T_LOGO + .62, 100.8], [T_LOGO + .75, 100, "eo"], [DUR, 103, "l"]], t) / 100
    ry = math.radians(kv([[T_LOGO, -80, "l"], [T_LOGO + .7, 0, "s"]], t))
    op = kv([[T_LOGO, 0, "l"], [T_LOGO + .12, 100, "l"]], t) / 100
    if t < T_LOGO or sc < 0.01 or op <= 0: return None
    hw2, hh2 = LW * sc / 2, LH * sc / 2
    corners = []
    for x, y in [(-hw2, -hh2), (hw2, -hh2), (hw2, hh2), (-hw2, hh2)]:
        X = x * math.cos(ry); Z = -x * math.sin(ry)
        f = ZOOM / (ZOOM + Z)
        corners.append((CX + X * f, CY + y * f))
    sw, sh = logo_hi.size
    coeffs = perspective_coeffs([(0, 0), (sw, 0), (sw, sh), (0, sh)], corners)
    im = logo_hi.transform((W, H), Image.PERSPECTIVE, tuple(coeffs), Image.BICUBIC)
    if op < 1:
        a = im.getchannel("A").point(lambda v: int(v * op)); im.putalpha(a)
    return im

# ---------------- frame composition ----------------
def vector_layer(t, which):
    """draw supersampled vector elements; which = 'below' (under logo) or 'above'"""
    im = Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    def P(x, y): return (x * SS, y * SS)
    if which == "below":
        # ripples
        for r, size in enumerate([700, 1000, 1350]):
            t0 = T_IMPACT + r * .12
            if not (t0 <= t <= t0 + 1.5): continue
            dia = kv([[t0, 10, "l"], [t0 + 1.4, size, "ei"]], t)
            sw = kv([[t0, 8 - r * 2, "l"], [t0 + 1.4, .5, "ei"]], t)
            op = kv([[t0, 0, "l"], [t0 + .08, 70, "l"], [t0 + 1.4, 0, "ei"]], t) / 100
            col = GOLD if r == 1 else TEAL
            rad = dia / 2
            d.ellipse([P(CX - rad, CY - rad), P(CX + rad, CY + rad)], outline=rgba(col, op), width=max(1, int(sw * SS)))
        # splash
        for s in splash:
            if not (s["st"] <= t <= s["st"] + .65): continue
            x, y = kv(s["pos"], t)
            scl = kv([[s["st"], 0, "l"], [s["st"] + .1, 100], [s["st"] + .6, 0, "ei"]], t) / 100
            r = s["ds"] * scl / 2
            if r > 0.2: d.ellipse([P(x - r, y - r), P(x + r, y + r)], fill=rgba(s["col"], 1))
        # drop
        if t <= T_IMPACT + .04:
            x, y = kv([[0, [CX, -120], "eo"], [T_IMPACT, [CX, CY], "l"]], t)
            sx, sy = kv([[0, [85, 85]], [T_IMPACT - .08, [80, 125], "l"], [T_IMPACT, [150, 55], "l"]], t) / 100
            pts = DROP * [sx, sy] + [x, y]
            d.polygon([P(*p) for p in pts], fill=rgba(TEAL, 1))
            hx, hy = x - 10 * sx, y + 8 * sy
            d.ellipse([P(hx - 4.5 * sx, hy - 8 * sy), P(hx + 4.5 * sx, hy + 8 * sy)], fill=rgba(WHITE, .8))
        # gold outline
        if .6 <= t <= 1.9:
            a = kv([[.6, 50, "eo"], [1.2, 0, "ei"]], t) / 100
            b = kv([[.6, 50, "eo"], [1.2, 100, "ei"]], t) / 100
            sw = kv([[1.15, 7], [1.85, 1]], t)
            sc = kv([[1.15, 100, "eo"], [1.85, 122, "ei"]], t) / 100
            op = kv([[.6, 100, "l"], [1.35, 100], [1.85, 0]], t) / 100
            seg = trim(HEX * sc, a, b)
            if seg is not None and op > 0:
                pts = [P(CX + p[0], CY + p[1]) for p in seg]
                d.line(pts, fill=rgba(GOLD, op), width=max(1, int(sw * SS)), joint="curve")
                for e in (pts[0], pts[-1]):
                    rr_ = sw * SS / 2; d.ellipse([e[0] - rr_, e[1] - rr_, e[0] + rr_, e[1] + rr_], fill=rgba(GOLD, op))
    else:
        for s in sparkles:
            if not (s["s0"] <= t <= s["s0"] + s["sd"] + .05): continue
            x, y = kv(s["pos"], t); sc = kv(s["sc"], t) / 100; rot = kv(s["rot"], t)
            if sc <= 0.01: continue
            pts = star_pts(s["big"] * sc, s["big"] * .18 * sc, rot) + [x, y]
            d.polygon([P(*p) for p in pts], fill=rgba(s["col"], 1))
        # gold lines beside tagline
        if t >= 2.6:
            te = kv([[2.6, 0, "l"], [3.4, 100, "s"]], t) / 100
            tw = text_width(0); gap, ln = tw / 2 + 40, 140; TY = CY + LH / 2 + 95 - 11
            for sg in (-1, 1):
                x0 = CX + sg * gap; x1 = CX + sg * (gap + ln * te)
                if te > 0.005:
                    d.line([P(x0, TY), P(x1, TY)], fill=rgba(GOLD, 1), width=3 * SS)
                    for e in (x0, x1): d.ellipse([P(e - 1.5, TY - 1.5), P(e + 1.5, TY + 1.5)], fill=rgba(GOLD, 1))
    return im.resize((W, H), Image.LANCZOS)

def text_width(extra):
    trk = (260 + extra) / 1000 * 34
    return sum(font.getlength(c) for c in TAGLINE) + trk * (len(TAGLINE) - 1)

def tagline_layer(t):
    if t < 2.4: return None
    extra = kv([[2.4, 120, "l"], [3.4, 0, "s"]], t)
    blur = kv([[2.4, 14], [3.1, 0]], t)
    op = kv([[2.4, 0], [2.9, 100]], t) / 100
    TY = CY + LH / 2 + 95 + kv([[2.4, 25, "eo"], [3.2, 0, "s"]], t)
    im = Image.new("RGBA", (W, H), TEALD + (0,))
    mask = Image.new("L", (W, H), 0); d = ImageDraw.Draw(mask)
    trk = (260 + extra) / 1000 * 34
    x = CX - text_width(extra) / 2
    for c in TAGLINE:
        d.text((x, TY), c, font=font, fill=int(255 * op), anchor="ls"); x += font.getlength(c) + trk
    if blur > 0.3: mask = mask.filter(ImageFilter.GaussianBlur(blur / 2))
    im.putalpha(mask); return im

def render(t):
    fr = BG_IMG.copy()
    fr.alpha_composite(vector_layer(t, "below"))
    # shadow
    sop = kv([[T_LOGO + .2, 0], [T_LOGO + .8, 22]], t) / 100
    if sop > 0:
        ssc = kv([[T_LOGO + .2, 40], [T_LOGO + .8, 100], [DUR, 104, "l"]], t) / 100
        sh = SHADOW_IMG.resize((max(1, int(SHADOW_IMG.width * ssc)), max(1, int(SHADOW_IMG.height * ssc))), Image.BILINEAR)
        a = sh.getchannel("A").point(lambda v: int(v * sop)); sh.putalpha(a)
        fr.alpha_composite(sh, (int(CX - sh.width / 2), int(CY + LH / 2 + 22 - sh.height / 2)))
    lg = logo_layer(t)
    if lg is not None:
        fr.alpha_composite(lg)
        if 2.1 <= t <= 3.1:
            x = kv([[2.2, CX - LW * .9], [3.0, CX + LW * .9]], t)
            sh_l = Image.new("L", (W, H), 0)
            sh_l.paste(SHINE, (int(x - SHINE.width / 2), int(CY - SHINE.height / 2)))
            m = np.asarray(sh_l, np.float32) * np.asarray(lg.getchannel("A"), np.float32) / 255
            white = Image.new("RGBA", (W, H), (255, 255, 255, 0)); white.putalpha(Image.fromarray(m.astype(np.uint8)))
            fr.alpha_composite(white)
        # twinkles
        for ox, oy, tt0 in twinkles:
            if not (tt0 <= t <= tt0 + .55): continue
            sc = kv([[tt0, 0], [tt0 + .22, 100], [tt0 + .5, 0]], t) / 100
            rot = kv([[tt0, 0, "l"], [tt0 + .5, 90, "l"]], t)
            if sc <= .01: continue
            x, y = CX + LW * ox, CY + LH * oy
            star = Image.new("L", (160 * SS, 160 * SS), 0)
            pts = star_pts(26 * sc * SS, 3.5 * sc * SS, rot) + [80 * SS, 80 * SS]
            ImageDraw.Draw(star).polygon([tuple(p) for p in pts], fill=255)
            star = star.resize((160, 160), Image.LANCZOS)
            glow = star.filter(ImageFilter.GaussianBlur(8))
            m = np.clip(np.asarray(star, np.float32) + np.asarray(glow, np.float32) * 1.6, 0, 255).astype(np.uint8)
            wi = Image.new("RGBA", (160, 160), (255, 255, 255, 0)); wi.putalpha(Image.fromarray(m))
            fr.alpha_composite(wi, (int(x - 80), int(y - 80)))
    fr.alpha_composite(vector_layer(t, "above"))
    tg = tagline_layer(t)
    if tg is not None: fr.alpha_composite(tg)
    return np.asarray(fr.convert("RGB"), np.float32)

def frame(i):
    # motion blur: average sub-frames over a 180-degree shutter
    if MB <= 1: return render(i / FPS).astype(np.uint8)
    acc = np.zeros((H, W, 3), np.float32)
    for s in range(MB):
        acc += render((i + (s / MB - 0.25) * 0.5) / FPS)
    return (acc / MB).clip(0, 255).astype(np.uint8)

if __name__ == "__main__":
    nfr = int(DUR * FPS)
    only = [int(x) for x in sys.argv[5].split(",")] if len(sys.argv) > 5 else None
    if only:
        for i in only: Image.fromarray(frame(i)).save(f"{OUT}_{i:03d}.png")
        sys.exit()
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                           "-i", "-", "-i", SFX, "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-pix_fmt", "yuv420p",
                           "-c:a", "aac", "-b:a", "320k", "-shortest", "-movflags", "+faststart", OUT], stdin=subprocess.PIPE)
    for i in range(nfr):
        ff.stdin.write(frame(i).tobytes())
        if i % 15 == 0: print("frame", i, "/", nfr, flush=True)
    ff.stdin.close(); ff.wait(); print("done", OUT)
