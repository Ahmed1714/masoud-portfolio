# Masoud — 3D character

A printable 3D model of the Masoud character, built from the character model
sheet and exported as STL.

| File | What it is |
| --- | --- |
| `masoud.stl` | The model. Binary STL, millimetres, watertight, 87k triangles. |
| `masoud.glb` | Same mesh as GLB, for viewers that prefer it. |
| `preview.png` | Rendered turnaround of the exported mesh. |
| `generate_model.py` | The script that builds the mesh. |
| `refs/` | Front, 3/4 front, side and back views cropped from the model sheet. |

## The model

- 130 mm tall (1:10 of the sheet's 130 cm stylized height), 45 × 50 mm footprint
  including the base.
- Watertight and consistently wound, so slicers accept it without repair.
- Solid volume 86.7 cm³ — around 30 g of filament at 20 % infill.
- Oriented Z up, +Y is the direction the character faces, soles on Z = 0.

## How it was built

The front and side silhouettes were traced from the turnaround in `refs/`, and
the sampled width / depth / centre-offset profiles drive the shapes in
`generate_model.py`. The head, torso, hips, legs and sneakers are lofted through
those cross-sections; the folded arms, hair mass and face features are added as
primitives and merged with a boolean union.

Measured against the reference turnaround, the exported mesh tracks the drawn
silhouette to within **4.5 % mean error in width** and **5.2 % in depth** over
the body.

## Regenerating

```bash
pip install numpy scipy trimesh manifold3d networkx
python3 character/generate_model.py                    # character/masoud.stl
python3 character/generate_model.py --height 200       # a 200 mm print
python3 character/generate_model.py --no-base          # drop the display base
python3 character/generate_model.py --glb out.glb      # also write a GLB
```

## Parts and posing

STL stores triangles only — no parts, no bones — so the shipped `masoud.stl` is
one fused solid. The generator keeps the body split internally, though, so you
can get separate pieces or a different pose out of it.

```bash
# one watertight STL per body part, for multi-colour printing or assembly
python3 character/generate_model.py --parts character/parts

# rotate joints (degrees, rx/ry/rz) and fuse the result back into one model
python3 character/generate_model.py \
    --pose "head=0/0/18 arm_fore_left=-45/0/10 leg_right=8/0/0" \
    --out character/masoud_posed.stl
```

Joints, each carrying its children: `head`, `arm_upper_left`, `arm_fore_left`,
`arm_upper_right`, `arm_fore_right`, `leg_left`, `foot_left`, `leg_right`,
`foot_right`. Rotating a leg lifts that foot off the base, so re-ground the
model in the slicer or add a matching `foot_*` rotation.

For real posing and animation — bones, weights, smooth deformation at the
joints — you want a rigged GLB rather than STL. That is the AI reconstruction
path noted below, which supports rigging directly.

## Likeness

This is a parametric sculpt: the proportions, pose and silhouette come from the
model sheet, but the face is built from primitives, so it reads as the character
rather than reproducing the render's exact features. Beard, hair strands, shirt
folds, eye and mouth detail are not in it.

A photo-accurate version needs image-to-3D reconstruction from the turnaround in
`refs/` (Higgsfield `multi_image_to_3d`, optionally with texturing and rigging).
The inputs are already uploaded; the job needs credits on the workspace to run.

## Printing notes

- Print upright, on the base. No supports needed except light ones under the
  chin and the folded forearms.
- 0.12–0.16 mm layers keep the face features crisp at 130 mm; scale up to
  180–200 mm if you want the eyes and watch to read clearly.
- The base is 2.6 mm thick and can be removed with `--no-base` if you would
  rather print the soles flat on the bed.
