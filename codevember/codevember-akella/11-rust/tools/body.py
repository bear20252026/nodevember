# Blender -b --python tools/body.py -- <name> <sealed.stl> [turn degrees] [target tris]: any closed mesh as a body for
# the rust page, in the format tools/suzanne.py writes (public/<name>.mesh.bin and public/<name>.sdf.bin).
# The input must already be watertight (day 3's blender/raw/*.stl are voxel-remeshed copies). It is decimated
# to a light render mesh, turned `turn` degrees about its up axis so the front faces the camera, centred, and
# scaled so it turns within FIT of the axis and FIT of the middle in height.
import bpy, bmesh, sys, os, struct
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1 :]
name, src = args[0], args[1]
turn = float(args[2]) if len(args) > 2 else 0.0
target = int(args[3]) if len(args) > 3 else 160000
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")
N = int(os.environ.get("N", "192"))  # sdf resolution
FIT = 1.05

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.stl_import(filepath=src)
ob = bpy.context.selected_objects[0]
bpy.context.view_layer.objects.active = ob
tris = len(ob.data.polygons)
if tris > target:
    dec = ob.modifiers.new("dec", "DECIMATE")
    dec.ratio = target / tris
dg = bpy.context.evaluated_depsgraph_get()
me = ob.evaluated_get(dg).to_mesh()
bm = bmesh.new()
bm.from_mesh(me)
bmesh.ops.triangulate(bm, faces=bm.faces[:])
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()

# Blender z up -> three y up, front (Blender -y) towards three's +z, then the turn
a = np.radians(turn)
P = np.array([(v.co.x, v.co.z, -v.co.y) for v in bm.verts], dtype=np.float64)
P = P @ np.array([[np.cos(a), 0, -np.sin(a)], [0, 1, 0], [np.sin(a), 0, np.cos(a)]])
lo, hi = P.min(0), P.max(0)
P -= 0.5 * (lo + hi)
scale = FIT / max(np.sqrt(P[:, 0] ** 2 + P[:, 2] ** 2).max(), np.abs(P[:, 1]).max())
P *= scale
for v, p in zip(bm.verts, P):
    v.co = Vector(p)
bm.normal_update()
Nrm = np.array([v.normal[:] for v in bm.verts], dtype=np.float32)
I = np.array([[v.index for v in f.verts] for f in bm.faces], dtype=np.uint32)
boundary = sum(1 for e in bm.edges if e.is_boundary)
size = (P.max(0) - P.min(0)).round(2)
print(f"{name}: {len(P)} verts, {len(I)} tris, boundary edges {boundary}, size {size}")
with open(os.path.join(out, f"{name}.mesh.bin"), "wb") as f:
    f.write(struct.pack("<II", len(P), len(I)))
    f.write(P.astype(np.float32).tobytes())
    f.write(Nrm.tobytes())
    f.write(I.tobytes())

tree = BVHTree.FromBMesh(bm)
R = 1.2
step = 2 * R / N
axis = -R + (np.arange(N) + 0.5) * step
# sign by parity: one ray along x per row, inside between odd and even crossings (the nearest face's normal
# gets it wrong off sharp edges, like under Venus's base)
inside = np.zeros((N, N, N), dtype=bool)
for zi, z in enumerate(axis):
    for yi, y in enumerate(axis):
        o = Vector((-R - 1.0, y + 1.3e-5, z + 1.7e-5))
        hits = []
        while True:
            loc, nrm, _, dist = tree.ray_cast(o, Vector((1, 0, 0)))
            if loc is None:
                break
            hits.append(loc.x)
            o = Vector((loc.x + 1e-6, o.y, o.z))
        for a0, a1 in zip(hits[0::2], hits[1::2]):
            inside[zi, yi, (axis > a0) & (axis < a1)] = True
D = np.empty(N * N * N, dtype=np.float32)
k = 0
for zi, z in enumerate(axis):
    for yi, y in enumerate(axis):
        for xi, x in enumerate(axis):
            dist = tree.find_nearest(Vector((x, y, z)))[3]
            D[k] = -dist if inside[zi, yi, xi] else dist
            k += 1
print(f"{name} sdf: {N}^3, step {step:.4f}, min {D.min():.3f}")
with open(os.path.join(out, f"{name}.sdf.bin"), "wb") as f:
    f.write(struct.pack("<Iff", N, -R, step))
    f.write(D.astype(np.float16).tobytes())
