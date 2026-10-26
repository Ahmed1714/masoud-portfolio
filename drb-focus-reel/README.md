# Dr. B — FOCUS Chocolate Tabs · Reel (9:16)

1080×1920 · 30fps · 16.5s · Montserrat font · original music (no copyright)

## How to open it in After Effects
1. Install the fonts from the `fonts/` folder (Light / Regular / Medium / SemiBold / Bold).
2. Open After Effects ← `File > Scripts > Run Script File…` ← pick `DrB_Focus_Reel_BUILD.jsx`.
3. The script builds the whole project and saves it as `DrB_Focus_Reel.aep` in the same folder, with a Render Queue entry ready to go.

> Keep the folder structure as it is (`assets/` and `audio/` next to the script).
> It uses only built-in AE effects: Gaussian Blur, Glow, CC Light Sweep, Gradient Ramp, Fractal Noise, Noise, Drop Shadow, with no plugins.

## Project structure
| Comp | Time | Content |
|---|---|---|
| `01_Hook` | 0 – 5.6s | Podium shot with a rack focus from blurred to sharp. "been losing **focus** lately?" (the word focus stays blurry until the shot sharpens), then "that's okay, we got you covered" |
| `02_Product` | 5.6 – 9.2s | Impact + flash, the product drops into the light shaft with a light sweep. "say hello to / Dr B's Focus / CHOCOLATE TABS" |
| `03_Benefits` | 9.2 – 13.2s | Notebook shot. "it boosts your" + 3 gold arrows drawn with Trim Paths: Mental Clarity · Energy · Concentration |
| `04_Logo` | 13.2 – 16.5s | Logo comes in from blur with a Glow, the gold rule opens from the center, then "the sharpest you can **B**" |
| `FX_GoldDust` | whole video | 45 gold dust particles driven by expressions |
| `BG_Studio` | – | Dark background with the diagonal light shaft (shared) |

The edit beats are marked as markers on the main comp `DrB_Focus_Reel_9x16`.

## Music
`audio/drb_focus_score.wav` is an original track generated with code, so there are no copyright issues. Its hits are synced to the edit:
clock ticks at the start (the "losing focus" feeling) → a riser into an impact on the product reveal at 5.6s → a soft pulse with gold notes → three ascending chimes on the arrows → a big impact with shimmer on the logo at 13.2s.

If you'd rather use a licensed track, search Artlist / Epidemic Sound for: `luxury cinematic minimal`, `dark elegant pulse`, `premium product reveal` (90–110 BPM, with a hit around second 5–6).

## Files
- `render/DrB_Focus_Reel_preview.mp4`: a preview of the video, rendered outside AE with the same timing
- `assets/`: logo with transparency (cut from the white background), product PNG, and the two shots at 1080×1920
- `scripts/`: asset prep, music generation, and the preview render (Python)

---

# Option 2: reference style (stronger)

`DrB_Focus_Reel_V2_BUILD.jsx` → saves `DrB_Focus_Reel_V2.aep` · 1080×1920 · 30fps · 16s · music `audio/drb_focus_score_v2.wav` (120 BPM)

Same structure as the reference (Goli), in Dr B's colors: dark chocolate and gold.

| Comp | Time | Content |
|---|---|---|
| `S1_Hook` | 0 – 2.5 | Words pop in one at a time "been losing **FOCUS**", whip up, then "lately?" with a huge 3D pack rising from the bottom |
| `S2_Covered` | 2.5 – 5.0 | "that's okay, we got you" + stack of hollow **COVERED** rows (the "SO YUMMY" idea) with a falling chocolate tab |
| `S3_SayHello` | 5.0 – 8.0 | "say hello to / Dr B's Focus / Chocolate Tabs" + the pack rotating in 3D + handwritten-style words: SHARP! WOW! NEW! YES! LET'S GO! |
| `S4_Benefits` | 8.0 – 11.5 | The pack spins and lands on its side, the tabs pour out of it, and **gold curved arrows like the reference** point to Mental Clarity · Energy · Concentration |
| `S5_EndCard` | 11.5 – 16 | Dr. B logo + "the sharpest you can **B**" + the pack standing on a pile of tabs + a gold streak line |

**3D pack:** `PACK CTRL` (a 3D null) + 9 dark layers stacked behind the front face to give it thickness, plus a camera. Rotate the Null on X/Y/Z and the gloss moves automatically (CC Light Sweep is linked to the rotation by an expression).
**Transitions:** vertical whips with real Motion Blur (shutter 270°, 16 samples) + Directional Blur, keyed to speed up at the cut and settle softly.
**Arrows:** each arrow is a Bezier Shape + a two-stroke arrowhead, drawn on with Trim Paths. Change the color from the Stroke.
**Chocolate tabs:** `assets/choc_tab.png` is a 3D-looking chocolate piece with the B embossed on it (made by `scripts/make_choc_tab.py`).
**Extra fonts:** Montserrat ExtraBold / Black / ExtraBold Italic (in `fonts/`).

Preview: `render/DrB_Focus_Reel_V2_preview.mp4`
