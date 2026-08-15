#!/usr/bin/env python3
"""Build the Masoud 3D character as a watertight, printable mesh.

The proportions come from the character model sheet in ``character/refs``:
the front and side silhouettes were traced and sampled, and the resulting
width / depth / centre-offset profiles drive the shapes below.

Run:  python3 character/generate_model.py [--height 130] [--out character/masoud.stl]

Outputs a binary STL (millimetres, Z up, +Y is the direction the character
faces, feet resting on Z = 0).
"""

from __future__ import annotations

import argparse
import math
import os

import numpy as np
import trimesh
from scipy.interpolate import PchipInterpolator

# --------------------------------------------------------------------------
# Proportions, as fractions of the total height (0.0 = top of hair, 1.0 = sole)
# --------------------------------------------------------------------------

# Head + hair outer shell, traced from the turnaround.
# (t, half-width, half-depth, depth-centre offset)  -- all as fractions of height
HEAD_PROFILE = [
    (0.000, 0.016, 0.032, 0.018),
    (0.020, 0.064, 0.088, 0.025),
    (0.035, 0.083, 0.101, 0.028),
    (0.050, 0.096, 0.113, 0.029),
    (0.075, 0.105, 0.126, 0.029),
    (0.100, 0.109, 0.131, 0.028),
    (0.150, 0.114, 0.136, 0.024),
    (0.200, 0.124, 0.130, 0.014),
    (0.230, 0.121, 0.130, 0.004),
    (0.250, 0.113, 0.128, -0.002),
    (0.280, 0.105, 0.109, -0.006),
    (0.305, 0.098, 0.098, -0.012),
    (0.325, 0.083, 0.083, -0.015),
    (0.340, 0.058, 0.060, -0.014),
]

T_CHIN = 0.340
T_SHOULDER = 0.385
T_ARM_TOP = 0.395
T_ARM_BOTTOM = 0.520
T_WAIST = 0.560
T_HIP = 0.620
T_KNEE = 0.760
T_ANKLE = 0.925
T_SOLE = 1.000


def _f(t: float, height: float) -> float:
    """Height fraction measured from the top -> Z in millimetres."""
    return (1.0 - t) * height


# --------------------------------------------------------------------------
# Mesh helpers
# --------------------------------------------------------------------------


def superellipse(n: int, power: float) -> np.ndarray:
    """Unit superellipse outline; power 2 is a circle, higher is boxier."""
    th = np.linspace(0.0, 2.0 * math.pi, n, endpoint=False)
    e = 2.0 / power
    x = np.sign(np.cos(th)) * np.abs(np.cos(th)) ** e
    y = np.sign(np.sin(th)) * np.abs(np.sin(th)) ** e
    return np.column_stack([x, y])


def loft(sections, n_theta: int = 64, n_z: int = 96, power: float = 2.0) -> trimesh.Trimesh:
    """Loft a closed tube through cross-sections.

    ``sections`` is a list of ``(z, rx, ry, cx, cy)`` in millimetres, ordered
    bottom to top. Radii are smoothly interpolated so the surface stays soft.
    """
    s = np.asarray(sections, dtype=float)
    z_key = s[:, 0]
    curves = [PchipInterpolator(z_key, s[:, i]) for i in range(1, 5)]

    z = np.linspace(z_key[0], z_key[-1], n_z)
    rx, ry, cx, cy = (np.clip(c(z), 1e-4 if i < 2 else -1e9, None) for i, c in enumerate(curves))

    outline = superellipse(n_theta, power)
    verts = np.empty((n_z * n_theta + 2, 3))
    verts[: n_z * n_theta, 0] = (outline[None, :, 0] * rx[:, None] + cx[:, None]).ravel()
    verts[: n_z * n_theta, 1] = (outline[None, :, 1] * ry[:, None] + cy[:, None]).ravel()
    verts[: n_z * n_theta, 2] = np.repeat(z, n_theta)

    bottom_c, top_c = n_z * n_theta, n_z * n_theta + 1
    verts[bottom_c] = [cx[0], cy[0], z[0]]
    verts[top_c] = [cx[-1], cy[-1], z[-1]]

    faces = []
    for i in range(n_z - 1):
        a = i * n_theta
        b = (i + 1) * n_theta
        for j in range(n_theta):
            k = (j + 1) % n_theta
            faces.append([a + j, b + j, b + k])
            faces.append([a + j, b + k, a + k])
    for j in range(n_theta):
        k = (j + 1) % n_theta
        faces.append([bottom_c, k, j])
        faces.append([top_c, (n_z - 1) * n_theta + j, (n_z - 1) * n_theta + k])

    mesh = trimesh.Trimesh(vertices=verts, faces=np.asarray(faces), process=True)
    mesh.fix_normals()
    return mesh


def ellipsoid(radii, centre, subdivisions: int = 3) -> trimesh.Trimesh:
    m = trimesh.creation.icosphere(subdivisions=subdivisions, radius=1.0)
    m.apply_scale(radii)
    m.apply_translation(centre)
    return m


def capsule(p0, p1, r0: float, r1: float | None = None, sections: int = 32) -> trimesh.Trimesh:
    """Tapered capsule between two points, with rounded ends."""
    p0 = np.asarray(p0, dtype=float)
    p1 = np.asarray(p1, dtype=float)
    r1 = r0 if r1 is None else r1
    axis = p1 - p0
    length = float(np.linalg.norm(axis))
    body = loft(
        [(0.0, r0, r0, 0.0, 0.0), (length, r1, r1, 0.0, 0.0)],
        n_theta=sections,
        n_z=12,
    )
    parts = [body, ellipsoid([r0] * 3, [0, 0, 0]), ellipsoid([r1] * 3, [0, 0, length])]
    m = trimesh.util.concatenate(parts)

    z = axis / length
    helper = np.array([0.0, 0.0, 1.0])
    if abs(float(np.dot(z, helper))) > 0.99:
        helper = np.array([1.0, 0.0, 0.0])
    x = np.cross(helper, z)
    x /= np.linalg.norm(x)
    y = np.cross(z, x)
    T = np.eye(4)
    T[:3, :3] = np.column_stack([x, y, z])
    T[:3, 3] = p0
    m.apply_transform(T)
    return m


def union(meshes) -> trimesh.Trimesh:
    return trimesh.boolean.union(meshes, engine="manifold")


# --------------------------------------------------------------------------
# Character parts
# --------------------------------------------------------------------------


def build_head(h: float):
    """Big round cranium, soft jaw, and a separate swept-back hair mass."""
    skull = ellipsoid([0.118 * h, 0.120 * h, 0.126 * h], [0.0, 0.006 * h, _f(0.180, h)])
    cheeks = ellipsoid([0.104 * h, 0.106 * h, 0.076 * h], [0.0, 0.012 * h, _f(0.262, h)])
    chin = ellipsoid([0.062 * h, 0.068 * h, 0.048 * h], [0.0, 0.030 * h, _f(0.302, h)])

    # Hair: a slightly larger shell, pushed back, with the front cut away at
    # the hairline so the face stays open, plus the quiff over the forehead.
    hair_shell = ellipsoid([0.124 * h, 0.126 * h, 0.130 * h], [0.0, -0.008 * h, _f(0.162, h)])
    face_cut = trimesh.creation.box(extents=[0.60 * h, 0.40 * h, 0.60 * h])
    face_cut.apply_translation([0.0, 0.20 * h + 0.028 * h, _f(0.150, h) - 0.30 * h])
    hair = trimesh.boolean.difference([hair_shell, face_cut], engine="manifold")
    quiff = ellipsoid([0.104 * h, 0.078 * h, 0.050 * h], [0.0, 0.046 * h, _f(0.072, h)])
    crest = ellipsoid([0.086 * h, 0.050 * h, 0.036 * h], [0.0, 0.062 * h, _f(0.038, h)])

    # Face features keep the silhouette readable from three-quarter angles.
    eyes = [
        ellipsoid([0.032 * h, 0.026 * h, 0.034 * h], [sx * 0.046 * h, 0.086 * h, _f(0.208, h)])
        for sx in (-1, 1)
    ]
    brow = [
        ellipsoid([0.038 * h, 0.016 * h, 0.011 * h], [sx * 0.046 * h, 0.092 * h, _f(0.168, h)])
        for sx in (-1, 1)
    ]
    nose = ellipsoid([0.021 * h, 0.028 * h, 0.019 * h], [0.0, 0.104 * h, _f(0.243, h)])
    ears = [
        ellipsoid([0.014 * h, 0.030 * h, 0.038 * h], [sx * 0.112 * h, -0.006 * h, _f(0.232, h)])
        for sx in (-1, 1)
    ]
    return [skull, cheeks, chin, hair, quiff, crest, nose] + eyes + brow + ears


def build_body(h: float):
    neck = loft(
        [
            (_f(0.400, h), 0.062 * h, 0.058 * h, 0.0, 0.0),
            (_f(0.360, h), 0.052 * h, 0.050 * h, 0.0, 0.0),
            (_f(T_CHIN, h) + 0.004 * h, 0.048 * h, 0.048 * h, 0.0, -0.004 * h),
        ],
        n_theta=48,
        power=2.0,
    )

    # T-shirt: shoulders slope out, hem flares slightly over the waist.
    torso = loft(
        [
            (_f(T_WAIST + 0.012, h), 0.110 * h, 0.094 * h, 0.0, 0.0),
            (_f(T_WAIST, h), 0.117 * h, 0.099 * h, 0.0, 0.0),
            (_f(0.520, h), 0.117 * h, 0.100 * h, 0.0, 0.002 * h),
            (_f(0.470, h), 0.121 * h, 0.102 * h, 0.0, 0.004 * h),
            (_f(0.420, h), 0.127 * h, 0.100 * h, 0.0, 0.002 * h),
            (_f(T_SHOULDER, h), 0.130 * h, 0.094 * h, 0.0, 0.0),
            (_f(0.362, h), 0.116 * h, 0.084 * h, 0.0, 0.0),
            (_f(0.348, h), 0.078 * h, 0.064 * h, 0.0, 0.0),
        ],
        n_theta=64,
        n_z=110,
        power=2.35,
    )

    hips = loft(
        [
            (_f(T_HIP + 0.030, h), 0.112 * h, 0.088 * h, 0.0, -0.002 * h),
            (_f(T_HIP, h), 0.118 * h, 0.094 * h, 0.0, 0.0),
            (_f(0.585, h), 0.120 * h, 0.098 * h, 0.0, 0.0),
            (_f(T_WAIST, h), 0.114 * h, 0.096 * h, 0.0, 0.0),
            (_f(0.535, h), 0.106 * h, 0.090 * h, 0.0, 0.0),
        ],
        n_theta=64,
        power=2.3,
    )
    return [neck, torso, hips]


def build_arms(h: float):
    """Arms folded across the chest, right forearm resting on top."""
    parts = []
    sh_z = _f(0.378, h)
    el_z = _f(0.472, h)

    for sx in (-1, 1):
        # Shoulder cap and upper arm dropping to the elbow at the side.
        parts.append(ellipsoid([0.044 * h, 0.046 * h, 0.042 * h], [sx * 0.108 * h, 0.0, sh_z]))
        parts.append(
            capsule(
                [sx * 0.112 * h, 0.004 * h, sh_z],
                [sx * 0.130 * h, 0.016 * h, el_z],
                0.040 * h,
                0.034 * h,
            )
        )

    # Two forearms crossing in front of the chest at slightly different heights.
    for sx, z_t, y_off in ((1, 0.482, 0.104), (-1, 0.450, 0.098)):
        z = _f(z_t, h)
        parts.append(
            capsule(
                [sx * 0.124 * h, 0.046 * h, el_z + 0.004 * h],
                [-sx * 0.078 * h, y_off * h, z],
                0.038 * h,
                0.033 * h,
            )
        )
        # Hand tucked under the opposite upper arm.
        parts.append(
            ellipsoid(
                [0.036 * h, 0.033 * h, 0.029 * h],
                [-sx * 0.096 * h, y_off * h - 0.012 * h, z],
            )
        )

    # Smart watch on the left wrist (character's left, +X here).
    watch = loft(
        [
            (0.0, 0.036 * h, 0.034 * h, 0.0, 0.0),
            (0.013 * h, 0.036 * h, 0.034 * h, 0.0, 0.0),
        ],
        n_theta=48,
        n_z=8,
        power=2.6,
    )
    T = trimesh.transformations.rotation_matrix(math.radians(90), [0, 1, 0])
    watch.apply_transform(T)
    watch.apply_translation([0.052 * h, 0.092 * h, _f(0.455, h)])
    parts.append(watch)
    return parts


def build_legs(h: float):
    parts = []
    for sx in (-1, 1):
        x = sx * 0.062 * h
        parts.append(
            loft(
                [
                    (_f(0.905, h), 0.068 * h, 0.076 * h, x, 0.008 * h),
                    (_f(0.878, h), 0.064 * h, 0.078 * h, x, 0.004 * h),
                    (_f(0.840, h), 0.058 * h, 0.079 * h, x, 0.002 * h),
                    (_f(T_KNEE, h), 0.060 * h, 0.080 * h, x, 0.0),
                    (_f(0.690, h), 0.066 * h, 0.080 * h, x, 0.0),
                    (_f(T_HIP + 0.010, h), 0.068 * h, 0.084 * h, x, 0.0),
                    (_f(T_HIP - 0.030, h), 0.068 * h, 0.086 * h, x, 0.0),
                ],
                n_theta=56,
                power=2.15,
            )
        )
    return parts


def build_shoes(h: float):
    """Chunky sneakers: a wide sole with a rounded upper and a raised tongue."""
    parts = []
    sole_top = 0.026 * h
    for sx in (-1, 1):
        x = sx * 0.070 * h
        toe_out = sx * 0.012 * h
        sole = loft(
            [
                (0.0, 0.076 * h, 0.152 * h, x, 0.030 * h),
                (0.012 * h, 0.084 * h, 0.160 * h, x + toe_out * 0.3, 0.032 * h),
                (sole_top, 0.082 * h, 0.156 * h, x + toe_out * 0.5, 0.030 * h),
            ],
            n_theta=64,
            n_z=40,
            power=3.2,
        )
        upper = loft(
            [
                (sole_top - 0.006 * h, 0.080 * h, 0.150 * h, x + toe_out * 0.5, 0.028 * h),
                (0.050 * h, 0.076 * h, 0.140 * h, x + toe_out * 0.6, 0.014 * h),
                (0.074 * h, 0.072 * h, 0.098 * h, x + toe_out * 0.6, -0.004 * h),
                (0.100 * h, 0.062 * h, 0.064 * h, x + toe_out * 0.5, -0.006 * h),
            ],
            n_theta=64,
            n_z=48,
            power=2.6,
        )
        parts += [sole, upper]
    return parts


def build_base(h: float, thickness: float = 0.020):
    t = thickness * h
    return loft(
        [
            (-t, 0.170 * h, 0.190 * h, 0.0, 0.020 * h),
            (-t * 0.35, 0.176 * h, 0.196 * h, 0.0, 0.020 * h),
            (0.004 * h, 0.172 * h, 0.192 * h, 0.0, 0.020 * h),
        ],
        n_theta=80,
        n_z=32,
        power=2.0,
    )


def build_character(height: float = 130.0, with_base: bool = True) -> trimesh.Trimesh:
    parts = (
        build_head(height)
        + build_body(height)
        + build_arms(height)
        + build_legs(height)
        + build_shoes(height)
    )
    if with_base:
        parts.append(build_base(height))

    # The boolean union already returns a clean manifold; further cleanup
    # passes only re-weld vertices and punch holes in it, so leave it alone.
    mesh = union(parts)

    # Sit the model on Z = 0 and centre it in X/Y.
    centre = mesh.bounds.mean(axis=0)
    mesh.apply_translation([-centre[0], -centre[1], -mesh.bounds[0][2]])

    # Normalise to the requested overall height (the base adds a little).
    scale = height / float(mesh.extents[2])
    mesh.apply_scale(scale)
    mesh.apply_translation([0.0, 0.0, -mesh.bounds[0][2]])
    return mesh


def main() -> None:
    ap = argparse.ArgumentParser(description="Generate the Masoud character mesh.")
    ap.add_argument("--height", type=float, default=130.0, help="total height in mm")
    ap.add_argument("--out", default="character/masoud.stl", help="output STL path")
    ap.add_argument("--no-base", action="store_true", help="skip the display base")
    ap.add_argument("--glb", help="also write a GLB copy to this path")
    args = ap.parse_args()

    mesh = build_character(args.height, with_base=not args.no_base)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    mesh.export(args.out)
    if args.glb:
        mesh.export(args.glb)

    size = mesh.bounds[1] - mesh.bounds[0]
    print(f"wrote      {args.out}")
    print(f"triangles  {len(mesh.faces):,}")
    print(f"watertight {mesh.is_watertight}  winding_consistent {mesh.is_winding_consistent}")
    print(f"volume     {mesh.volume / 1000.0:.1f} cm^3")
    print(f"size       {size[0]:.1f} x {size[1]:.1f} x {size[2]:.1f} mm (W x D x H)")


if __name__ == "__main__":
    main()
