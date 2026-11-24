# Blender -b --python tools/suzanne.py: a watertight Suzanne for the rust page (public/suzanne.mesh.bin) and its
# signed distance field (public/suzanne.sdf.bin). The stock monkey has holes behind the eyes and loose eyeballs;
# subdividing then voxel-remeshing fuses it into one closed skin, which the flake sim can collide with.
# mesh.bin: u32 nv, nt; f32 positions nv*3; f32 normals nv*3; u32 indices nt*3  (three's frame: y up, face +z)
# sdf.bin:  u32 n; f32 origin, step; f16 n^3 distances, x fastest, sample i at origin + (i + 0.5) * step
import bpy, bmesh, sys, os, struct
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
os.makedirs(out, exist_ok=True)
VOXEL = float(os.environ.get("VOXEL", "0.014"))  # remesh size, in the monkey's own units (it is ~2.7 wide)
N = int(os.environ.get("N", "160"))  # sdf resolution
FIT = 1.05  # largest radius round the turning axis, and half height

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_monkey_add(size=2)
ob = bpy.context.active_object
sub = ob.modifiers.new("sub", "SUBSURF")
sub.levels = sub.render_levels = 2
rem = ob.modifiers.new("rem", "REMESH")
rem.mode = "VOXEL"
rem.voxel_size = VOXEL
rem.adaptivity = 0.0
rem.use_smooth_shade = True
sm = ob.modifiers.new("sm", "SMOOTH")
sm.factor = 0.5
sm.iterations = 4
dg = bpy.context.evaluated_depsgraph_get()
me = ob.evaluated_get(dg).to_mesh()
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
# keep the biggest shell only (remesh can leave specks)
bm.verts.ensure_lookup_table()
seen, shells = set(), []
for v in bm.verts:
    if v.index in seen:
        continue
    stack, shell = [v], []
    seen.add(v.index)
    while stack:
        a = stack.pop()
        shell.append(a)
        for e in a.link_edges:
            b = e.other_vert(a)
            if b.index not in seen:
                seen.add(b.index)
                stack.append(b)
    shells.append(shell)
shells.sort(key=len)
for shell in shells[:-1]:
    bmesh.ops.delete(bm, geom=shell, context="VERTS")
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# Blender z up, monkey looking down -y  ->  three y up, looking down +z
P = np.array([(v.co.x, v.co.z, -v.co.y) for v in bm.verts], dtype=np.float64)
lo, hi = P.min(0), P.max(0)
c = 0.5 * (lo + hi)
P -= c
scale = FIT / max(np.sqrt(P[:, 0] ** 2 + P[:, 2] ** 2).max(), np.abs(P[:, 1]).max())
P *= scale
for v, p in zip(bm.verts, P):
    v.co = Vector(p)
bm.normal_update()
Nrm = np.array([v.normal[:] for v in bm.verts], dtype=np.float32)
I = np.array([[v.index for v in f.verts] for f in bm.faces], dtype=np.uint32)
boundary = sum(1 for e in bm.edges if e.is_boundary)
print(f"suzanne: {len(P)} verts, {len(I)} tris, boundary edges {boundary}, scale {scale:.4f}")
with open(os.path.join(out, "suzanne.mesh.bin"), "wb") as f:
    f.write(struct.pack("<II", len(P), len(I)))
    f.write(P.astype(np.float32).tobytes())
    f.write(Nrm.tobytes())
    f.write(I.tobytes())

# signed distance: nearest point on the skin, outside where we sit on the side its face normal points to
tree = BVHTree.FromBMesh(bm)
R = 1.2
step = 2 * R / N
axis = -R + (np.arange(N) + 0.5) * step
D = np.empty(N * N * N, dtype=np.float32)
k = 0
for z in axis:
    for y in axis:
        for x in axis:
            p = Vector((x, y, z))
            loc, nrm, _, dist = tree.find_nearest(p)
            D[k] = dist if (p - loc).dot(nrm) >= 0 else -dist
            k += 1
print(f"sdf: {N}^3, step {step:.4f}, min {D.min():.3f}")
with open(os.path.join(out, "suzanne.sdf.bin"), "wb") as f:
    f.write(struct.pack("<Iff", N, -R, step))
    f.write(D.astype(np.float16).tobytes())
