# Rubber duck — 3D model

Built the same way as the character in `../character`: the four views in
`refs/` were cut out of the source sheet and fed to Higgsfield
`multi_image_to_3d` (30 credits, textured, no rig).

- Rendered turnaround:
  <https://d2ol7oe51mr4n9.cloudfront.net/user_2xhkOVQnFmFjZSspDkDWygRGWsG/eaa2e092-0bb7-4b06-b3d0-e889f17e2c45.png>
- Bundle (GLB + STL + parts + texture):
  <https://d2ol7oe51mr4n9.cloudfront.net/user_2xhkOVQnFmFjZSspDkDWygRGWsG/f2d7a68d-1e32-455b-b224-50e2732b7a04.zip>

## The model

| | |
| --- | --- |
| Triangles | 29,988 |
| Size | 100 mm tall, 99 × 125 mm footprint |
| Volume | 447.8 cm³, watertight and a valid solid |
| Colour | baked PBR texture in the GLB |
| Rig | none — a rubber duck is rigid, an auto-rig would only bolt on a meaningless humanoid armature |

## Cutting the views out

The glow behind the duck is the same yellow as the duck itself — at the top of
the frame the background reads `241, 200, 22` against a duck body of roughly the
same value — so no brightness or saturation threshold separates them. The
cutouts come from a Sobel edge map instead: threshold at the 92nd percentile,
dilate to seal the outline, flood-fill from the image borders, and keep what the
fill cannot reach.

## Smoothing

The raw reconstruction carries the faceting typical of photogrammetry. The mesh
is Taubin-smoothed (λ 0.55, μ 0.58, 14 iterations) before export — Taubin rather
than plain Laplacian because it holds the volume instead of shrinking the model.
Smoothing runs on a welded copy and the result is scattered back through the
weld map, so the UV seams keep their per-vertex colours.

## Parts

Split by texture colour for multi-colour printing:

| Part | Volume |
| --- | --- |
| `body.stl` | 439.54 cm³ |
| `beak.stl` | 7.97 cm³ |
| `eyes.stl` | 0.28 cm³ (18 pieces — eyes and lashes) |

Each is a closed, valid solid. The body is the whole duck with the beak and eye
solids booleaned out of it rather than a shell of leftover faces, so the parts
fit together exactly — their volumes sum to 447.79 cm³ against the whole duck's
447.77 cm³.

## Printing

Body upright on its flat base, no supports. The beak wants light support under
the overhang. 0.12–0.16 mm layers.
