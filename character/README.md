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

## Printing notes

- Print upright, on the base. No supports needed except light ones under the
  chin and the folded forearms.
- 0.12–0.16 mm layers keep the face features crisp at 130 mm; scale up to
  180–200 mm if you want the eyes and watch to read clearly.
- The base is 2.6 mm thick and can be removed with `--no-base` if you would
  rather print the soles flat on the bed.
