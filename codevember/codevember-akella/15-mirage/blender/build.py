# The garden of mirrors as a Blender scene, made from what the page exports (tools/export-blender.mjs into
# blender/data/) and from Poly Haven assets (blender/fetch_assets.py into blender/assets/).
#
#   blender -b --factory-startup -P build.py -- [--frames 30,300] [--res 1920x1080] [--samples 512]
#           [--out renders/test] [--device OPTIX|METAL|CPU] [--save mirage.blend] [--plants 1]
#
# Everything is as the page has it: where the mirrors, the doors and the boulders stand, the ground's height,
# the sky, the sun, the eye's way. What the page could not afford is added: real rocks, plants, sand with
# grain and ripples, mirrors with a thickness and a frame. Doors are Ray Portal BSDFs that send a ray on just as
# the page's doors do (a point p behind one is M p + o).

import bpy, bmesh, json, math, os, random, sys, glob
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
ASSETS = os.path.join(HERE, "assets")

args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default):
    return args[args.index(name) + 1] if name in args else default


FRAMES = [int(f) for f in arg("--frames", "").split(",") if f]
# (or a range, first-last, and every so many: --range 0-1079 --step 1)
if arg("--range", ""):
    first, last = (int(v) for v in arg("--range", "").split("-"))
    FRAMES = list(range(first, last + 1, int(arg("--step", "1"))))
RES = [int(v) for v in arg("--res", "1920x1080").split("x")]
SAMPLES = int(arg("--samples", "512"))
OUT = os.path.abspath(os.path.join(HERE, arg("--out", "renders/test")))
DEVICE = arg("--device", "OPTIX")
PLANTS = float(arg("--plants", "1"))

W = json.load(open(os.path.join(DATA, "world.json")))
LOOK = W["look"]
# --path path_02.json: another way for the eye through the same world (tools/export-blender.mjs with LAPS)
# (plants keep clear of every lap's way, whichever the eye takes: the world is the same in every loop)
ALL_WAYS = W["frames"]
if arg("--path", ""):
    W.update(json.load(open(os.path.join(DATA, arg("--path", "")))))


def srgb(hex_):
    c = [int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c]


# --- the scene


def fresh():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.unit_settings.system = "METRIC"
    return s


scene = fresh()
lib = bpy.data.collections.new("library")  # what the instances are of: never drawn
scene.collection.children.link(lib)
lib.hide_render = True
lib.hide_viewport = True


def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


def node(tree, kind, loc=(0, 0), **inputs):
    n = tree.nodes.new(kind)
    n.location = loc
    for k, v in inputs.items():
        n.inputs[k].default_value = v
    return n


def link(tree, a, b):
    tree.links.new(a, b)


# --- the ground: three grids, each finer one cut out of the next coarser

GRIDS = json.load(open(os.path.join(DATA, "grids.json")))
HEIGHTS = {}
for g in GRIDS:
    HEIGHTS[g["name"]] = np.fromfile(os.path.join(DATA, "ground_%s.f32" % g["name"]), dtype=np.float32).reshape(g["nz"], g["nx"])


# --- ponds at the oasis, dug into the ground before anything stands on it: each an ellipse with a wavering
# edge, a bowl under the water and a bank that rises gently out of it

OASIS_NEAR = float(arg("--oasis-near", "160"))  # where the grove begins, metres down the valley
OASIS_DEEP = float(arg("--oasis-deep", "170"))  # and how far back it goes
OX = W["oasis"]["x"]
PONDS = [
    # middle x, y, half lengths, turn, its edge's wavering (a seed)
    (OX + 5, OASIS_NEAR + 26, 66, 20, 0.05, 1),
    (OX - 62, OASIS_NEAR + 78, 22, 10, -0.3, 2),
    (OX + 72, OASIS_NEAR + 58, 15, 8, 0.4, 3),
] if float(arg("--water", "1")) > 0 else []


def pond_reach(p, x, y):
    """how far out a point is, in the pond's own measure: 1 at its edge"""
    cx, cy, a, b, turn, seed = p
    dx, dy = x - cx, y - cy
    u = dx * np.cos(turn) + dy * np.sin(turn)
    v = -dx * np.sin(turn) + dy * np.cos(turn)
    ang = np.arctan2(v / b, u / a)
    wav = 1 + 0.12 * np.sin(3 * ang + seed) + 0.07 * np.sin(5 * ang + 2.1 * seed) + 0.04 * np.sin(9 * ang + seed * 0.7)
    return np.hypot(u / a, v / b) / wav


POND_LEVEL = []

# and a stream out of the big pond toward the valley, winding, so that water is seen near as well as far off
STREAM = []
STREAM_HALF = float(arg("--stream", "1.4"))  # its half width (0: none)
if PONDS and STREAM_HALF > 0:
    cx0, cy0, a0, b0 = PONDS[0][:4]
    y0, y1 = cy0 - 0.85 * b0, max(OASIS_NEAR - 62, 92)
    for k in range(41):
        f = k / 40
        y = y0 + (y1 - y0) * f
        # (out to the left, where no door stands in front of it)
        STREAM.append((cx0 - 30 * f ** 1.3 + 5 * math.sin(f * 6.5 + 0.4) * min(1, f * 3), y, STREAM_HALF * (1.0 - 0.4 * f)))


def stream_dist(X, Y):
    """how far a point is from the stream's middle, in its half widths (1 at its edge)"""
    out = np.full(np.shape(X), 1e9)
    for (xa, ya, wa), (xb, yb, wb) in zip(STREAM[:-1], STREAM[1:]):
        dx, dy = xb - xa, yb - ya
        t = np.clip(((X - xa) * dx + (Y - ya) * dy) / (dx * dx + dy * dy), 0, 1)
        d = np.hypot(X - xa - t * dx, Y - ya - t * dy) / (wa + (wb - wa) * t)
        out = np.minimum(out, d)
    return out


def raw_height(x, y):
    g = GRIDS[1]
    return float(HEIGHTS[g["name"]][int(round((y - g["z0"]) / g["texel"])), int(round((x - g["x0"]) / g["texel"]))])


# The water stands just under the valley floor in front of it, so that it can be seen from the valley at
# all: from two metres up and three hundred off, the line to it falls a degree, and any rise between hides it.
# So the ground between is laid flat no higher than the water's level and a little, and about each pond the
# ground is made a rim that rises from the water gently, whatever was there before.
if PONDS:
    floor_ = min(raw_height(OX + dx, OASIS_NEAR - 40) for dx in (-20, 0, 20))
    for k in range(len(PONDS)):
        POND_LEVEL.append(floor_ - 0.12)
for g in GRIDS:
    a_ = HEIGHTS[g["name"]]
    xs = g["x0"] + np.arange(g["nx"]) * g["texel"]
    ys = g["z0"] + np.arange(g["nz"]) * g["texel"]
    X, Y = np.meshgrid(xs, ys)
    if PONDS:
        sm = lambda v: np.clip(v, 0, 1) ** 2 * (3 - 2 * np.clip(v, 0, 1))
        start = max(OASIS_NEAR - 110, 85)  # (not the doors': their ground is the page's)
        flat = sm((Y - start) / 20) * sm((OASIS_NEAR + 20 - Y) / 20) * sm((110 - np.abs(X - OX)) / 40)
        a_[:] = np.where(flat > 0, np.minimum(a_, a_ * (1 - flat) + (POND_LEVEL[0] + 0.1) * flat), a_)
    if STREAM and g["texel"] <= 2:
        sd = stream_dist(X, Y)
        level = POND_LEVEL[0]
        bed = level - 0.35 * (1 - np.clip(sd, 0, 1) ** 2)
        bank = level + 0.05 + (sd - 1) * 0.06
        blend = 1 - np.clip((sd - 1.5) / 2.0, 0, 1)
        a_[:] = np.where(sd < 1, np.minimum(a_, bed), np.where(sd < 3.5, np.minimum(a_, a_ * (1 - blend) + bank * blend), a_))
    for k, p in enumerate(PONDS):
        rho = pond_reach(p, X, Y)
        if not (rho < 2.2).any():
            continue
        level = POND_LEVEL[k]
        bowl = level - 1.0 * (1 - np.clip(rho, 0, 1) ** 2)
        rim = level + 0.06 + (rho - 1) * 0.5
        blend = 1 - (np.clip((rho - 1.4) / 0.8, 0, 1))
        a_[:] = np.where(rho < 1, np.minimum(a_, bowl), np.where(rho < 2.2, a_ * (1 - blend) + rim * blend, a_))


def height(x, y):
    """the ground under a point, from the finest grid that has it (bilinear)"""
    for g in GRIDS:
        fx = (x - g["x0"]) / g["texel"]
        fy = (y - g["z0"]) / g["texel"]
        if 0 <= fx < g["nx"] - 1 and 0 <= fy < g["nz"] - 1:
            a = HEIGHTS[g["name"]]
            i, j = int(fy), int(fx)
            u, v = fx - j, fy - i
            return float((a[i, j] * (1 - u) + a[i, j + 1] * u) * (1 - v) + (a[i + 1, j] * (1 - u) + a[i + 1, j + 1] * u) * v)
    return 0.0


def grid_mesh(g, hole):
    a = HEIGHTS[g["name"]]
    nz, nx = a.shape
    t = g["texel"]
    xs = g["x0"] + np.arange(nx) * t
    ys = g["z0"] + np.arange(nz) * t
    X, Y = np.meshgrid(xs, ys)
    # (a coarser grid lies a little lower, so that where it overlaps a finer one at the hole's edge it is under it)
    drop = 0.0 if hole is None else 0.04 * t
    verts = np.stack([X, Y, a - drop], -1).reshape(-1, 3).astype(np.float32)
    i = (np.arange(nz - 1)[:, None] * nx + np.arange(nx - 1)[None, :]).ravel()
    quads = np.stack([i, i + 1, i + nx + 1, i + nx], -1)
    if hole is not None:
        # cells wholly inside the finer grid, but its outermost ring, go
        cx = (xs[:-1] + t / 2)[None, :].repeat(nz - 1, 0).ravel()
        cy = (ys[:-1] + t / 2)[:, None].repeat(nx - 1, 1).ravel()
        x0, y0, x1, y1 = hole
        inside = (cx > x0 + t) & (cx < x1 - t) & (cy > y0 + t) & (cy < y1 - t)
        quads = quads[~inside]
    mesh = bpy.data.meshes.new("ground_" + g["name"])
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set("co", verts.ravel())
    mesh.loops.add(quads.size)
    mesh.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    mesh.polygons.add(len(quads))
    mesh.polygons.foreach_set("loop_start", (np.arange(len(quads)) * 4).astype(np.int32))
    mesh.update(calc_edges=True)
    mesh.shade_smooth()
    return mesh


def sand_material():
    m = bpy.data.materials.new("sand")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    out = node(t, "ShaderNodeOutputMaterial", (1600, 0))
    coord = node(t, "ShaderNodeTexCoord", (-1800, 0))
    geo = node(t, "ShaderNodeNewGeometry", (-1800, -500))

    # grain and stains from a scanned sand, shifted to the page's colour
    tex = os.path.join(ASSETS, "sand_03")
    def image(name, colour, loc):
        n = node(t, "ShaderNodeTexImage", loc)
        n.image = bpy.data.images.load(glob.glob(os.path.join(tex, name))[0])
        if not colour:
            n.image.colorspace_settings.name = "Non-Color"
        n.projection = "BOX"
        return n
    mapping = node(t, "ShaderNodeMapping", (-1500, 0))
    mapping.inputs["Scale"].default_value = (1 / 1.6, 1 / 1.6, 1 / 1.6)
    link(t, coord.outputs["Object"], mapping.inputs["Vector"])
    diff = image("*diff*", True, (-1200, 300))
    nor = image("*nor_gl*", False, (-1200, -100))
    link(t, mapping.outputs["Vector"], diff.inputs["Vector"])
    link(t, mapping.outputs["Vector"], nor.inputs["Vector"])
    # the scan's own colour taken as light and dark only, about its mean, on the page's tone
    bw = node(t, "ShaderNodeRGBToBW", (-900, 300))
    link(t, diff.outputs["Color"], bw.inputs["Color"])
    spread = node(t, "ShaderNodeMapRange", (-700, 300))
    spread.inputs["From Min"].default_value = 0.15
    spread.inputs["From Max"].default_value = 0.55
    spread.inputs["To Min"].default_value = 0.72
    spread.inputs["To Max"].default_value = 1.12
    link(t, bw.outputs["Val"], spread.inputs["Value"])
    # broad stains
    stain = node(t, "ShaderNodeTexNoise", (-900, 600))
    stain.inputs["Scale"].default_value = 0.035
    stain.inputs["Detail"].default_value = 3
    link(t, coord.outputs["Object"], stain.inputs["Vector"])
    stain_r = node(t, "ShaderNodeMapRange", (-700, 600))
    stain_r.inputs["To Min"].default_value = 0.88
    stain_r.inputs["To Max"].default_value = 1.1
    link(t, stain.outputs["Fac"], stain_r.inputs["Value"])
    tone = node(t, "ShaderNodeRGB", (-700, 800))
    tone.outputs[0].default_value = (*srgb(arg("--sand", LOOK["sandTone"])), 1)
    m1 = node(t, "ShaderNodeVectorMath", (-450, 500))
    m1.operation = "SCALE"
    link(t, tone.outputs[0], m1.inputs[0])
    link(t, spread.outputs["Result"], m1.inputs["Scale"])
    m2 = node(t, "ShaderNodeVectorMath", (-250, 500))
    m2.operation = "SCALE"
    link(t, m1.outputs[0], m2.inputs[0])
    link(t, stain_r.outputs["Result"], m2.inputs["Scale"])

    # wind ripples: crests across the wind, a long back and a short steep front (a saw), pushed about by noise
    # so that they wander, end and join; none on the steep slip faces
    wind = W.get("wind", [-51.0, 5.0])
    turn = math.atan2(wind[1], wind[0])
    rip_map = node(t, "ShaderNodeMapping", (-1500, -800))
    rip_map.inputs["Rotation"].default_value = (0, 0, -turn)
    link(t, coord.outputs["Object"], rip_map.inputs["Vector"])
    wave = node(t, "ShaderNodeTexWave", (-1200, -800))
    wave.wave_type = "BANDS"
    wave.bands_direction = "X"
    wave.wave_profile = "SAW"
    wave.inputs["Scale"].default_value = 1 / 0.17 / (2 * math.pi) * (2 * math.pi)  # (scale is bands a unit)
    wave.inputs["Distortion"].default_value = 3.0
    wave.inputs["Detail"].default_value = 2.0
    wave.inputs["Detail Scale"].default_value = 0.4
    wave.inputs["Detail Roughness"].default_value = 0.6
    link(t, rip_map.outputs["Vector"], wave.inputs["Vector"])
    # (taller here, lower there)
    patch = node(t, "ShaderNodeTexNoise", (-1200, -1100))
    patch.inputs["Scale"].default_value = 0.12
    link(t, coord.outputs["Object"], patch.inputs["Vector"])
    flat = node(t, "ShaderNodeSeparateXYZ", (-1500, -1300))
    link(t, geo.outputs["Normal"], flat.inputs["Vector"])
    level = node(t, "ShaderNodeMapRange", (-1200, -1350))
    level.inputs["From Min"].default_value = 0.88
    level.inputs["From Max"].default_value = 0.96
    link(t, flat.outputs["Z"], level.inputs["Value"])
    amp = node(t, "ShaderNodeMath", (-900, -1100))
    amp.operation = "MULTIPLY"
    link(t, patch.outputs["Fac"], amp.inputs[0])
    link(t, level.outputs["Result"], amp.inputs[1])
    rip = node(t, "ShaderNodeMath", (-700, -900))
    rip.operation = "MULTIPLY"
    link(t, wave.outputs["Fac"], rip.inputs[0])
    link(t, amp.outputs[0], rip.inputs[1])
    bump_rip = node(t, "ShaderNodeBump", (-450, -700))
    bump_rip.inputs["Strength"].default_value = 1.0
    bump_rip.inputs["Distance"].default_value = float(arg("--ripples", "0.012"))
    link(t, rip.outputs[0], bump_rip.inputs["Height"])
    nmap = node(t, "ShaderNodeNormalMap", (-700, -200))
    nmap.inputs["Strength"].default_value = 0.8
    link(t, nor.outputs["Color"], nmap.inputs["Color"])
    link(t, nmap.outputs["Normal"], bump_rip.inputs["Normal"])

    sand = node(t, "ShaderNodeBsdfPrincipled", (0, 300))
    # under the grove the ground is soil, darker and richer, in patches; the desert about it stays sand
    sep_o = node(t, "ShaderNodeSeparateXYZ", (-450, 900))
    link(t, coord.outputs["Object"], sep_o.inputs[0])
    patchy = node(t, "ShaderNodeTexNoise", (-450, 1100))
    patchy.inputs["Scale"].default_value = 0.04
    patchy.inputs["Detail"].default_value = 4
    link(t, coord.outputs["Object"], patchy.inputs["Vector"])
    def band(sock, lo, hi, fade):
        a1 = node(t, "ShaderNodeMapRange", (-250, 900))
        a1.inputs["From Min"].default_value = lo - fade
        a1.inputs["From Max"].default_value = lo
        link(t, sock, a1.inputs["Value"])
        a2 = node(t, "ShaderNodeMapRange", (-250, 700))
        a2.inputs["From Min"].default_value = hi + fade
        a2.inputs["From Max"].default_value = hi
        link(t, sock, a2.inputs["Value"])
        mm = node(t, "ShaderNodeMath", (-50, 800))
        mm.operation = "MINIMUM"
        link(t, a1.outputs["Result"], mm.inputs[0])
        link(t, a2.outputs["Result"], mm.inputs[1])
        return mm.outputs[0]
    hw = LOOK["oasisWide"] * 0.5
    inside = node(t, "ShaderNodeMath", (150, 900))
    inside.operation = "MULTIPLY"
    link(t, band(sep_o.outputs["X"], OX - hw, OX + hw, 40), inside.inputs[0])
    link(t, band(sep_o.outputs["Y"], OASIS_NEAR + 5, OASIS_NEAR + OASIS_DEEP, 30), inside.inputs[1])
    soil_amt = node(t, "ShaderNodeMath", (350, 900))
    soil_amt.operation = "MULTIPLY"
    link(t, inside.outputs[0], soil_amt.inputs[0])
    patch_r = node(t, "ShaderNodeMapRange", (150, 1100))
    patch_r.inputs["From Min"].default_value = 0.35
    patch_r.inputs["From Max"].default_value = 0.6
    patch_r.inputs["To Min"].default_value = 0.35
    patch_r.inputs["To Max"].default_value = 0.85
    link(t, patchy.outputs["Fac"], patch_r.inputs["Value"])
    link(t, patch_r.outputs["Result"], soil_amt.inputs[1])
    soil = node(t, "ShaderNodeMix", (550, 700))
    soil.data_type = "RGBA"
    sin_ = [x for x in soil.inputs if x.type == "RGBA"]
    link(t, soil_amt.outputs[0], soil.inputs[0])
    link(t, m2.outputs[0], sin_[0])
    sin_[1].default_value = (*srgb(arg("--soil", "#6e5a36")), 1)
    link(t, [x for x in soil.outputs if x.type == "RGBA"][0], sand.inputs["Base Color"])
    sand.inputs["Roughness"].default_value = 0.92
    sand.inputs["Specular IOR Level"].default_value = 0.3
    link(t, bump_rip.outputs["Normal"], sand.inputs["Normal"])

    # the mirage: hot level sand seen under 1.5 degrees shows what is beyond it, as water would, and trembles
    facing = node(t, "ShaderNodeVectorMath", (-700, -1600))
    facing.operation = "DOT_PRODUCT"
    link(t, geo.outputs["True Normal"], facing.inputs[0])
    link(t, geo.outputs["Incoming"], facing.inputs[1])
    graze = node(t, "ShaderNodeMapRange", (-450, -1600))
    graze.inputs["From Min"].default_value = math.sin(math.radians(1.5))
    graze.inputs["From Max"].default_value = 0.55 * math.sin(math.radians(1.5))
    link(t, facing.outputs["Value"], graze.inputs["Value"])
    level2 = node(t, "ShaderNodeMapRange", (-450, -1850))
    level2.inputs["From Min"].default_value = 0.9988
    level2.inputs["From Max"].default_value = 0.9997
    link(t, flat.outputs["Z"], level2.inputs["Value"])
    hot = node(t, "ShaderNodeMath", (-200, -1700))
    hot.operation = "MULTIPLY"
    link(t, graze.outputs["Result"], hot.inputs[0])
    link(t, level2.outputs["Result"], hot.inputs[1])
    # (only for what is seen, from the eye or in a mirror: light that skims the sand on its way elsewhere would
    # pick the sun up off it, as sparkle)
    seen_lp = node(t, "ShaderNodeLightPath", (-450, -1400))
    seen = node(t, "ShaderNodeMath", (-200, -1400))
    seen.operation = "MAXIMUM"
    link(t, seen_lp.outputs["Is Camera Ray"], seen.inputs[0])
    link(t, seen_lp.outputs["Is Glossy Ray"], seen.inputs[1])
    hot_seen = node(t, "ShaderNodeMath", (-100, -1550))
    hot_seen.operation = "MULTIPLY"
    link(t, hot.outputs[0], hot_seen.inputs[0])
    link(t, seen.outputs[0], hot_seen.inputs[1])
    hot2 = node(t, "ShaderNodeMath", (0, -1700))
    hot2.operation = "MULTIPLY"
    hot2.inputs[1].default_value = 0.95
    link(t, hot_seen.outputs[0], hot2.inputs[0])
    shimmer = node(t, "ShaderNodeTexNoise", (-450, -2100))
    shimmer.inputs["Scale"].default_value = 0.4
    shimmer.inputs["Detail"].default_value = 2
    link(t, coord.outputs["Object"], shimmer.inputs["Vector"])
    wob = node(t, "ShaderNodeBump", (-200, -2100))
    wob.inputs["Strength"].default_value = 0.05
    wob.inputs["Distance"].default_value = 0.3
    link(t, shimmer.outputs["Fac"], wob.inputs["Height"])
    water = node(t, "ShaderNodeBsdfGlossy", (200, -1900))
    water.inputs["Roughness"].default_value = 0.01
    water.inputs["Color"].default_value = (1, 1, 1, 1)
    link(t, wob.outputs["Normal"], water.inputs["Normal"])
    mix = node(t, "ShaderNodeMixShader", (1200, 0))
    link(t, hot2.outputs[0], mix.inputs["Fac"])
    link(t, sand.outputs[0], mix.inputs[1])
    link(t, water.outputs[0], mix.inputs[2])
    link(t, mix.outputs[0], out.inputs["Surface"])
    return m


ground = collection("ground")
sand = sand_material()
holes = {"near": None, "mid": None, "far": None}
finer = None
for g in GRIDS:
    hole = None
    if finer is not None:
        hole = (finer["x0"], finer["z0"], finer["x0"] + (finer["nx"] - 1) * finer["texel"], finer["z0"] + (finer["nz"] - 1) * finer["texel"])
    mesh = grid_mesh(g, hole)
    mesh.materials.append(sand)
    o = bpy.data.objects.new("ground_" + g["name"], mesh)
    ground.objects.link(o)
    finer = g
print("[mirage] ground", flush=True)


# --- the glasses: a pane in a dark rounded frame; mirrors on both sides, doors a way through on the front

RIM = float(arg("--rim", "0.04"))  # the frame's width (the page's is 0.07, which reads heavy here)


def outline(width, tall, arched, inset, segments=48):
    """the outline of a glass in its own plane (u across, v up), `inset` metres in"""
    hw = width / 2 - inset
    if not arched:
        return [(-hw, inset), (hw, inset), (hw, tall - inset), (-hw, tall - inset)]
    spring = tall - width / 2
    pts = [(-hw, inset), (hw, inset)]
    for k in range(segments + 1):
        a = math.pi * k / segments
        pts.append((hw * math.cos(a), spring + hw * math.sin(a)))
    return pts


def glass_meshes(g):
    arched = g["door"]
    outer = outline(g["width"], g["tall"], arched, 0)
    inner = outline(g["width"], g["tall"], arched, RIM)
    frame = bmesh.new()
    vo = [frame.verts.new((u, 0, v)) for u, v in outer]
    vi = [frame.verts.new((u, 0, v)) for u, v in inner]
    n = len(vo)
    for k in range(n):
        frame.faces.new((vo[k], vo[(k + 1) % n], vi[(k + 1) % n], vi[k]))
    pane = bmesh.new()
    pv = [pane.verts.new((u, 0, v)) for u, v in outline(g["width"], g["tall"], arched, RIM * 0.6)]
    pane.faces.new(pv)
    meshes = []
    for name, bm in (("frame", frame), ("pane", pane)):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        meshes.append(me)
    return meshes


def frame_material():
    m = bpy.data.materials.new("frame")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*srgb(LOOK["rimTone"]), 1)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.22
    return m


def mirror_material():
    m = bpy.data.materials.new("mirror")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    out = node(t, "ShaderNodeOutputMaterial", (400, 0))
    gl = node(t, "ShaderNodeBsdfGlossy", (0, 0))
    gl.inputs["Color"].default_value = (0.9 * 0.97, 0.9 * 0.985, 0.9, 1)
    gl.inputs["Roughness"].default_value = 0.004
    link(t, gl.outputs[0], out.inputs["Surface"])
    return m


def door_material(g):
    """the front a way through (a point p there is M p + o here), the back a mirror, and a little of this side's
    sky glints on the front, none as the eye comes close"""
    m = bpy.data.materials.new("door")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    out = node(t, "ShaderNodeOutputMaterial", (1400, 0))
    geo = node(t, "ShaderNodeNewGeometry", (-1200, 0))
    M = g["portal"]["matrix"]  # its columns
    o = g["portal"]["offset"]

    def transform(vec_socket, offset, y):
        sep = node(t, "ShaderNodeSeparateXYZ", (-900, y))
        link(t, vec_socket, sep.inputs[0])
        acc = None
        for k, axis in enumerate(("X", "Y", "Z")):
            sc = node(t, "ShaderNodeVectorMath", (-650, y - 150 * k))
            sc.operation = "SCALE"
            sc.inputs[0].default_value = M[k]
            link(t, sep.outputs[axis], sc.inputs["Scale"])
            if acc is None:
                acc = sc.outputs[0]
            else:
                ad = node(t, "ShaderNodeVectorMath", (-400, y - 150 * k))
                ad.operation = "ADD"
                link(t, acc, ad.inputs[0])
                link(t, sc.outputs[0], ad.inputs[1])
                acc = ad.outputs[0]
        if offset is not None:
            ad = node(t, "ShaderNodeVectorMath", (-200, y))
            ad.operation = "ADD"
            link(t, acc, ad.inputs[0])
            ad.inputs[1].default_value = offset
            acc = ad.outputs[0]
        return acc

    back = node(t, "ShaderNodeVectorMath", (-1000, -600))
    back.operation = "SCALE"
    back.inputs["Scale"].default_value = -1.0
    link(t, geo.outputs["Incoming"], back.inputs[0])
    portal = node(t, "ShaderNodeBsdfRayPortal", (200, 200))
    link(t, transform(geo.outputs["Position"], o, 300), portal.inputs["Position"])
    link(t, transform(back.outputs[0], None, -500), portal.inputs["Direction"])
    mirror = node(t, "ShaderNodeBsdfGlossy", (200, -300))
    mirror.inputs["Color"].default_value = (0.9 * 0.97, 0.9 * 0.985, 0.9, 1)
    mirror.inputs["Roughness"].default_value = 0.004
    # (the glint)
    lw = node(t, "ShaderNodeLayerWeight", (-200, -900))
    lw.inputs["Blend"].default_value = 0.5
    path = node(t, "ShaderNodeLightPath", (-200, -1200))
    near = node(t, "ShaderNodeMapRange", (0, -1200))
    near.inputs["From Min"].default_value = 0.5
    near.inputs["From Max"].default_value = 12.0
    link(t, path.outputs["Ray Length"], near.inputs["Value"])
    glint = node(t, "ShaderNodeMath", (200, -1000))
    glint.operation = "MULTIPLY"
    link(t, lw.outputs["Facing"], glint.inputs[0])
    link(t, near.outputs["Result"], glint.inputs[1])
    glint2 = node(t, "ShaderNodeMath", (400, -1000))
    glint2.operation = "MULTIPLY"
    glint2.inputs[1].default_value = 0.16
    link(t, glint.outputs[0], glint2.inputs[0])
    sheen = node(t, "ShaderNodeMixShader", (700, 100))
    link(t, glint2.outputs[0], sheen.inputs["Fac"])
    link(t, portal.outputs[0], sheen.inputs[1])
    link(t, mirror.outputs[0], sheen.inputs[2])
    # front or back: by its own normal against the door's
    face = node(t, "ShaderNodeVectorMath", (200, -600))
    face.operation = "DOT_PRODUCT"
    face.inputs[1].default_value = g["normal"]
    link(t, geo.outputs["True Normal"], face.inputs[0])
    front = node(t, "ShaderNodeMath", (400, -600))
    front.operation = "GREATER_THAN"
    front.inputs[1].default_value = 0.0
    link(t, face.outputs["Value"], front.inputs[0])
    # (and only for what is seen, from the eye or in a mirror: for light, a door is the mirror it is made as,
    # and casts its shadow. Light through a portal can only be come on by chance, never aimed at, and the sun
    # coming through one onto the sand was nothing but sparkle.)
    lp2 = node(t, "ShaderNodeLightPath", (200, -800))
    seen = node(t, "ShaderNodeMath", (400, -800))
    seen.operation = "MAXIMUM"
    link(t, lp2.outputs["Is Camera Ray"], seen.inputs[0])
    link(t, lp2.outputs["Is Glossy Ray"], seen.inputs[1])
    seen_front = node(t, "ShaderNodeMath", (600, -700))
    seen_front.operation = "MULTIPLY"
    link(t, front.outputs[0], seen_front.inputs[0])
    link(t, seen.outputs[0], seen_front.inputs[1])
    side = node(t, "ShaderNodeMixShader", (1100, 0))
    link(t, seen_front.outputs[0], side.inputs["Fac"])
    link(t, mirror.outputs[0], side.inputs[1])
    link(t, sheen.outputs[0], side.inputs[2])
    link(t, side.outputs[0], out.inputs["Surface"])
    return m


glasses = collection("glasses")
FRAME = frame_material()
MIRROR = mirror_material()
for i, g in enumerate(W["glasses"]):
    frame_me, pane_me = glass_meshes(g)
    frame_me.materials.append(FRAME)
    pane_me.materials.append(door_material(g) if g["door"] else MIRROR)
    # its own axes: across, its front's way, up
    n = Vector(g["normal"])
    across = Vector((math.cos(g["face"]), -math.sin(g["face"]), 0))
    basis = Matrix((across, n, (0, 0, 1))).transposed().to_4x4()
    basis.translation = (g["x"], g["y"], g["bottom"])
    for me, thick, name in ((frame_me, LOOK["rimDepth"] + 0.01, "frame"), (pane_me, 0.012, "pane")):
        o = bpy.data.objects.new("%s_%02d" % (name, i), me)
        o.matrix_world = basis
        glasses.objects.link(o)
        s = o.modifiers.new("thick", "SOLIDIFY")
        s.thickness = thick
        s.offset = 0.0
        if name == "frame":
            b = o.modifiers.new("round", "BEVEL")
            b.width = 0.009
            b.segments = 4
            b.limit_method = "ANGLE"
print("[mirage] glasses", flush=True)


# --- assets: every variant of a Poly Haven model, at its finest, as a mesh to make instances of


def variants(asset):
    blend = glob.glob(os.path.join(ASSETS, asset, "*.blend"))[0]
    with bpy.data.libraries.load(blend, link=False) as (src, dst):
        dst.objects = src.objects
    # (not the shapes an asset's own scatter set-up grows things on: a grass's sphere, drawn bare, is a black ball)
    objs = [o for o in dst.objects if o is not None and o.type == "MESH" and "geometry_nodes" not in o.name and not any(s.material and s.material.name.endswith("_sphere") for s in o.material_slots)]
    best = {}
    for o in objs:
        name = o.name
        level = 0
        if "_LOD" in name:
            name, l = name.rsplit("_LOD", 1)
            level = int(l) if l.isdigit() else 0
        if name not in best or level < best[name][0]:
            best[name] = (level, o)
    out = []
    for level, o in best.values():
        lib.objects.link(o)
        # its size, and where its foot is, in its own frame
        co = np.empty(len(o.data.vertices) * 3, dtype=np.float32)
        o.data.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        lo, hi = co.min(0), co.max(0)
        out.append({"mesh": o.data, "lo": lo, "hi": hi, "size": hi - lo})
    for o in objs:
        if o.users_collection == ():
            bpy.data.objects.remove(o)
    return out


def place(col, v, x, y, z, scale, yaw, name):
    o = bpy.data.objects.new(name, v["mesh"])
    centre = (v["lo"] + v["hi"]) / 2
    o.matrix_world = Matrix.Translation((x, y, z)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Scale(scale, 4) @ Matrix.Translation((-centre[0], -centre[1], -v["lo"][2]))
    col.objects.link(o)
    return o


rng = random.Random(15)

# --- boulders, where the page has them, and stones about them

rocks = collection("rocks")
BIG = [v for a in ("namaqualand_boulder_02", "namaqualand_boulder_03", "namaqualand_boulder_04", "namaqualand_boulder_05", "namaqualand_boulder_06") for v in variants(a)]
SMALL = variants("namaqualand_boulders_01") + variants("namaqualand_rocks_01")
STONES = variants("namaqualand_stones_01") + variants("namaqualand_rocks_01")
for k, r in enumerate(W["rocks"]):
    pool = BIG if r["r"] > 0.32 else SMALL
    v = rng.choice(pool)
    # as wide across as the page's, and a little deeper in the sand than its middle is over it
    across = max(v["size"][0], v["size"][1])
    scale = 2.1 * r["r"] / across
    foot = height(r["x"], r["y"]) - 0.22 * v["size"][2] * scale
    place(rocks, v, r["x"], r["y"], foot, scale, rng.uniform(0, 2 * math.pi), "rock_%02d" % k)
    # stones strewn about it
    for s in range(int(3 + 10 * r["r"])):
        a = rng.uniform(0, 2 * math.pi)
        d = r["r"] * rng.uniform(1.0, 3.5)
        sx, sy = r["x"] + math.cos(a) * d, r["y"] + math.sin(a) * d
        sv = rng.choice(STONES)
        ss = rng.uniform(0.6, 1.8) * (0.5 if r["r"] < 0.3 else 1)
        place(rocks, sv, sx, sy, height(sx, sy) - 0.3 * sv["size"][2] * ss, ss, rng.uniform(0, 2 * math.pi), "stone")
print("[mirage] rocks", flush=True)


# --- plants: clear of the eye's ways and of the glasses, more of them in the lee of rocks


def path_points():
    pts = np.array([f["eye"][:2] for f in ALL_WAYS])
    return pts


WAY = path_points()
GLASS_XY = np.array([[g["x"], g["y"]] for g in W["glasses"]])


def clear(x, y, room):
    if np.min(np.hypot(WAY[:, 0] - x, WAY[:, 1] - y)) < room + 1.6:
        return False
    if np.min(np.hypot(GLASS_XY[:, 0] - x, GLASS_XY[:, 1] - y)) < room + 1.2:
        return False
    return True


plants = collection("plants")
if PLANTS > 0:
    KINDS = [
        # what, how many, how big a scale range, how far from the ways at least
        ("wild_rooibos_bush", 70, (0.9, 1.6)),
        ("othonna_cerarioides", 28, (0.8, 1.3)),
        ("searsia_lucida", 16, (0.8, 1.2)),
        ("didelta_spinosa", 14, (0.7, 1.1)),
        ("cheiridopsis_succulent", 40, (0.8, 1.5)),
        ("crystalline_iceplant", 50, (0.8, 1.6)),
        ("dead_quiver_branch_01", 30, (0.8, 1.6)),
        ("dry_quiver_leaf", 30, (0.8, 1.4)),
        ("bark_debris_01", 25, (0.8, 1.4)),
        ("quiver_tree_01", 5, (0.9, 1.3)),
        ("quiver_tree_02", 6, (0.9, 1.4)),
        ("dead_quiver_trunk", 4, (0.9, 1.2)),
    ]
    ROCK_XY = [(r["x"], r["y"], r["r"]) for r in W["rocks"]]
    for asset, count, (s0, s1) in KINDS:
        vs = variants(asset)
        made = 0
        tries = 0
        while made < int(count * PLANTS) and tries < count * 60:
            tries += 1
            v = rng.choice(vs)
            scale = rng.uniform(s0, s1)
            room = 0.5 * max(v["size"][0], v["size"][1]) * scale
            if rng.random() < 0.55 and ROCK_XY:
                # in a rock's lee
                rx, ry, rr = rng.choice(ROCK_XY)
                a = rng.uniform(0, 2 * math.pi)
                d = rr + room + rng.uniform(0.1, 1.5)
                x, y = rx + math.cos(a) * d, ry + math.sin(a) * d
            else:
                x, y = rng.uniform(-55, 55), rng.uniform(-35, 150)
            if not clear(x, y, room):
                continue
            place(plants, v, x, y, height(x, y) - 0.03 * v["size"][2] * scale, scale, rng.uniform(0, 2 * math.pi), asset)
            made += 1
    print("[mirage] plants", flush=True)


# --- the oasis: a grove of date palms at the end of the valley, young palms, tamarisk and grass under them, and
# clumps of the same leading out to it along the valley's sides (Sketchfab models, assets/sketchfab/, glTF)


def glb(name):
    """a glTF model as a collection to make instances of (never itself in the scene), standing on its foot"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(ASSETS, "sketchfab", name + ".glb"))
    new = [o for o in bpy.data.objects if o not in before]
    col = bpy.data.collections.new("glb " + name)
    for o in new:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        col.objects.link(o)
    bpy.context.view_layer.update()
    lo = Vector((1e9,) * 3)
    hi = Vector((-1e9,) * 3)
    for o in new:
        if o.type == "MESH":
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                lo = Vector(map(min, lo, w))
                hi = Vector(map(max, hi, w))
    col.instance_offset = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z)
    return {"col": col, "size": hi - lo}


def dry(x, y):
    return all(pond_reach(p, x, y) > 1.06 for p in PONDS) and (not STREAM or stream_dist(np.array([x]), np.array([y]))[0] > 1.4)


def open_view(x, y):
    """in front of the big pond, between it and the eye: kept clear, so that the water can be seen"""
    if not PONDS:
        return False
    cx, cy, a, b, turn, seed = PONDS[0]
    return y < cy and abs(x - cx) < a * 1.05


def put(dst, a, x, y, scale, yaw, sink=0.05):
    if not dry(x, y) or (open_view(x, y) and a["size"].z * scale > 0.8):
        return None
    e = bpy.data.objects.new(a["col"].name, None)
    e.instance_type = "COLLECTION"
    e.instance_collection = a["col"]
    e.location = (x, y, height(x, y) - sink * a["size"].z * scale)
    e.rotation_euler = (0, 0, yaw)
    e.scale = (scale, scale, scale)
    dst.objects.link(e)
    return e


oasis = collection("oasis")
TALL = [glb("Realistic HD Date Palm (1)"), glb("Realistic HD Date Palm (2)")]
YOUNG = [glb("Realistic HD Date Palm 5578"), glb("Realistic HD Date Palm"), glb("Canary Island Date Palm 3D Model")]
CLUMP = [glb("Date Palm and Vegetation")]
TAMARISK = [glb("Realistic HD French Tamarisk"), glb("Realistic HD French Tamarisk 3D Model")]
GRASS = [glb("Dry Realistic Grass LODs 1")]
BUSH = variants("searsia_burchellii")
ox, oy = W["oasis"]["x"], W["oasis"]["y"]
near, deep = OASIS_NEAR, OASIS_DEEP
wide = LOOK["oasisWide"]
grow = float(arg("--oasis", "1"))  # how thick it is


def clump(x, y, palms, size=1.0):
    """palms of all heights about one place, and what grows under them"""
    for k in range(palms):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, 7) * size
        put(oasis, rng.choice(TALL), x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(0.6, 1.15), rng.uniform(0, 6.28))
    for k in range(int(palms * 1.5) + 1):
        a, d = rng.uniform(0, 6.28), rng.uniform(1, 10) * size
        put(oasis, rng.choice(YOUNG), x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(1.0, 2.6), rng.uniform(0, 6.28))
    for k in range(palms * 2 + 2):
        a, d = rng.uniform(0, 6.28), rng.uniform(2, 13) * size
        put(oasis, rng.choice(TAMARISK), x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(1.4, 3.2), rng.uniform(0, 6.28))
    for k in range(palms * 3 + 3):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, 14) * size
        put(oasis, GRASS[0], x + math.cos(a) * d, y + math.sin(a) * d, rng.uniform(0.15, 0.28), rng.uniform(0, 6.28), sink=0.2)
    if rng.random() < 0.5:
        a, d = rng.uniform(0, 6.28), rng.uniform(3, 12) * size
        bx, by = x + math.cos(a) * d, y + math.sin(a) * d
        if dry(bx, by):
            place(oasis, rng.choice(BUSH), bx, by, height(bx, by) - 0.1, rng.uniform(1.2, 2.2), rng.uniform(0, 6.28), "oasis_bush")
    if rng.random() < 0.3:
        put(oasis, CLUMP[0], x + rng.uniform(-6, 6), y + rng.uniform(-6, 6), rng.uniform(0.8, 1.2), rng.uniform(0, 6.28), sink=0.12)


# the grove: thickest in its middle and toward the back, thinning to its edges, a few strays in front
for k in range(int(46 * grow)):
    u = rng.gauss(0, 0.38)
    x = ox + max(-1.0, min(1.0, u)) * wide / 2
    y = near + deep * (rng.random() ** 0.7)
    edge = 1 - min(1, abs(u) / 1.1)
    clump(x, y, max(1, int(rng.uniform(2, 7) * (0.4 + 0.6 * edge))), size=rng.uniform(0.8, 1.4))
for k in range(int(14 * grow)):
    # (to the sides of the view over the water)
    side = rng.choice((-1, 1))
    clump(ox + side * rng.uniform(80, wide * 0.6), near - rng.uniform(5, 60), rng.randint(1, 2), size=0.7)
# and on the way there, a few smaller clumps along the sides of the valley
for k in range(int(10 * grow)):
    side = rng.choice((-1, 1))
    x, y = side * rng.uniform(35, 90), rng.uniform(95, max(near - 20, 100))
    if clear(x, y, 12):
        clump(x, y, rng.randint(1, 3), size=0.8)
# the water: flat, dark, rippled a little by the wind; seen across it from the valley, mostly the sky and the
# palms in it
water_mat = bpy.data.materials.new("water")
water_mat.use_nodes = True
wtree = water_mat.node_tree
wtree.nodes.clear()
wout = wtree.nodes.new("ShaderNodeOutputMaterial")
# (a body of dark green-blue water, as a still oasis pond is, more of it the more square on it is looked at, and
# the sky glinting off it: by Fresnel it would be nearly all sky from the valley, as pale as the sand beside it,
# and not be seen as water at all)
body = wtree.nodes.new("ShaderNodeBsdfDiffuse")
body.inputs["Color"].default_value = (*srgb(arg("--water-tone", "#1f3d38")), 1)
gloss = wtree.nodes.new("ShaderNodeBsdfGlossy")
gloss.inputs["Roughness"].default_value = 0.03
gloss.inputs["Color"].default_value = (1, 1, 1, 1)
lw_ = wtree.nodes.new("ShaderNodeLayerWeight")
lw_.inputs["Blend"].default_value = 0.35
share = wtree.nodes.new("ShaderNodeMapRange")
share.inputs["To Min"].default_value = 0.25
share.inputs["To Max"].default_value = float(arg("--water-shine", "0.6"))
link(wtree, lw_.outputs["Fresnel"], share.inputs["Value"])
wn = wtree.nodes.new("ShaderNodeTexNoise")
wn.inputs["Scale"].default_value = 1.6
wn.inputs["Detail"].default_value = 6
wbump = wtree.nodes.new("ShaderNodeBump")
wbump.inputs["Strength"].default_value = 0.12
wbump.inputs["Distance"].default_value = 0.02
link(wtree, wn.outputs["Fac"], wbump.inputs["Height"])
link(wtree, wbump.outputs["Normal"], gloss.inputs["Normal"])
link(wtree, wbump.outputs["Normal"], lw_.inputs["Normal"])
wmix = wtree.nodes.new("ShaderNodeMixShader")
link(wtree, share.outputs["Result"], wmix.inputs["Fac"])
link(wtree, body.outputs[0], wmix.inputs[1])
link(wtree, gloss.outputs[0], wmix.inputs[2])
link(wtree, wmix.outputs[0], wout.inputs["Surface"])
GREEN = [v for a in ("shrub_02", "shrub_03", "shrub_04") for v in variants(a)]
CLUMPS = variants("grass_medium_02")
for k, p in enumerate(PONDS):
    cx, cy, a, b, turn, seed = p
    level = POND_LEVEL[k]
    # (its outline, a little past the edge: the bank is over the water there)
    pts = []
    for j in range(96):
        ang = 2 * math.pi * j / 96
        wav = 1 + 0.12 * math.sin(3 * ang + seed) + 0.07 * math.sin(5 * ang + 2.1 * seed) + 0.04 * math.sin(9 * ang + seed * 0.7)
        u, v = 1.15 * wav * a * math.cos(ang), 1.15 * wav * b * math.sin(ang)
        pts.append((cx + u * math.cos(turn) - v * math.sin(turn), cy + u * math.sin(turn) + v * math.cos(turn), level))
    bm = bmesh.new()
    face = bm.faces.new([bm.verts.new(q) for q in pts])
    bmesh.ops.triangulate(bm, faces=[face])
    me = bpy.data.meshes.new("pond")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(water_mat)
    o = bpy.data.objects.new("pond_%d" % k, me)
    oasis.objects.link(o)
    # and what grows at its edge, thick, then thinning away from it
    for j in range(int((a + b) * 6 * grow)):
        ang = rng.uniform(0, 2 * math.pi)
        out = 1.0 + abs(rng.gauss(0, 0.35))
        wav = 1 + 0.12 * math.sin(3 * ang + seed) + 0.07 * math.sin(5 * ang + 2.1 * seed) + 0.04 * math.sin(9 * ang + seed * 0.7)
        u, v = out * wav * a * math.cos(ang), out * wav * b * math.sin(ang)
        x, y = cx + u * math.cos(turn) - v * math.sin(turn), cy + u * math.sin(turn) + v * math.cos(turn)
        if not dry(x, y):
            continue
        r = rng.random()
        # (on the side the eye comes from, only low grass: the water is to be seen over it)
        facing_eye = k == 0 and y < cy
        if facing_eye:
            r = 0.0
        if r < 0.4:
            vv = rng.choice(CLUMPS)
            tall_ = rng.uniform(0.15, 0.35) if facing_eye else rng.uniform(0.6, 1.4)
            place(oasis, vv, x, y, height(x, y) - 0.05, tall_ / max(vv["size"][2], 0.05), rng.uniform(0, 6.28), "reeds")
        elif r < 0.75:
            vv = rng.choice(GREEN)
            place(oasis, vv, x, y, height(x, y) - 0.05, rng.uniform(0.9, 2.6) / max(vv["size"][2], 0.05), rng.uniform(0, 6.28), "green")
        elif r < 0.9:
            put(oasis, rng.choice(YOUNG), x, y, rng.uniform(1.2, 2.8), rng.uniform(0, 6.28))
        else:
            put(oasis, rng.choice(TALL), x, y, rng.uniform(0.7, 1.15), rng.uniform(0, 6.28))
# the stream's water, a strip a little wider than its bed, and low green along its banks
if STREAM:
    bm = bmesh.new()
    rows = []
    for k, (x, y, w_) in enumerate(STREAM):
        xa, ya = STREAM[max(k - 1, 0)][:2]
        xb, yb = STREAM[min(k + 1, len(STREAM) - 1)][:2]
        tx, ty = xb - xa, yb - ya
        ln = math.hypot(tx, ty) or 1
        nx, ny = -ty / ln, tx / ln
        rows.append((bm.verts.new((x + nx * w_ * 1.12, y + ny * w_ * 1.12, POND_LEVEL[0])), bm.verts.new((x - nx * w_ * 1.12, y - ny * w_ * 1.12, POND_LEVEL[0]))))
    for (a1, b1), (a2, b2) in zip(rows[:-1], rows[1:]):
        bm.faces.new((a1, b1, b2, a2))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f_ in bm.faces:
        if f_.normal.z < 0:
            f_.normal_flip()
    me = bpy.data.meshes.new("stream")
    bm.to_mesh(me)
    bm.free()
    me.materials.append(water_mat)
    oasis.objects.link(bpy.data.objects.new("stream", me))
    for j in range(int(len(STREAM) * 16 * grow)):
        k = rng.randrange(len(STREAM) - 1)
        (xa, ya, wa), (xb, yb, wb) = STREAM[k], STREAM[k + 1]
        t_ = rng.random()
        x, y = xa + (xb - xa) * t_, ya + (yb - ya) * t_
        tx, ty = xb - xa, yb - ya
        ln = math.hypot(tx, ty) or 1
        side = rng.choice((-1, 1)) * (wa * 1.5 + abs(rng.gauss(0, 1.6)))
        x, y = x - ty / ln * side, y + tx / ln * side
        vv = rng.choice(CLUMPS + GREEN)
        place(oasis, vv, x, y, height(x, y) - 0.03, rng.uniform(0.3, 0.9) / max(vv["size"][2], 0.05), rng.uniform(0, 6.28), "bank")

# green under the whole grove too, not only at the water
for j in range(int(500 * grow)):
    x = OX + rng.gauss(0, 0.33) * LOOK["oasisWide"] / 2
    y = near + deep * rng.random() ** 0.8
    if any(pond_reach(p, x, y) < 1.15 for p in PONDS) or open_view(x, y):
        continue
    vv = rng.choice(GREEN + CLUMPS)
    place(oasis, vv, x, y, height(x, y) - 0.05, rng.uniform(0.8, 2.4) / max(vv["size"][2], 0.05), rng.uniform(0, 6.28), "green")

# The oasis is to be alive: the leaves of what grows there greener and fuller than the dust has left them
LEAVES = ("leaf", "leaflet", "crown", "brch", "Vegetation", "Leaves", "shrub", "grass", "lft")
oasis_mats = set()
for o in oasis.all_objects:
    if o.instance_collection:
        for oo in o.instance_collection.all_objects:
            oasis_mats |= {sl.material for sl in oo.material_slots if sl.material}
    else:
        oasis_mats |= {sl.material for sl in o.material_slots if sl.material}
for m in oasis_mats:
    if not m.use_nodes or not any(w.lower() in m.name.lower() for w in LEAVES):
        continue
    t = m.node_tree
    for n in [n for n in t.nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"]:
        bc = n.inputs["Base Color"]
        if not bc.links:
            continue
        hs = t.nodes.new("ShaderNodeHueSaturation")
        hs.inputs["Hue"].default_value = 0.5 + float(arg("--green-hue", "0.02"))
        hs.inputs["Saturation"].default_value = float(arg("--green", "1.6"))
        hs.inputs["Value"].default_value = float(arg("--green-light", "1.12"))
        link(t, bc.links[0].from_socket, hs.inputs["Color"])
        link(t, hs.outputs["Color"], bc)
print("[mirage] oasis: %d ponds, water at %s" % (len(PONDS), [round(v, 2) for v in POND_LEVEL]), flush=True)


# --- the sky: the page's own picture of it, around the world; and the sun, as strong and as red as the air leaves it


def sun_light(up, haze=1.0, power=None):
    power = power if power is not None else LOOK["sunPower"]
    ground, top = 6360e3, 6460e3
    oy = ground + 300
    b = oy * up[2]
    far = -b + math.sqrt(b * b - (oy * oy - top * top))
    depth = [0.0, 0.0, 0.0]
    t0 = 0.0
    for i in range(1, 41):
        t1 = far * (i / 40) ** 2
        tm = 0.5 * (t0 + t1)
        q = (up[0] * tm, up[1] * tm, oy + up[2] * tm)
        h = max(math.sqrt(q[0] ** 2 + q[1] ** 2 + q[2] ** 2) - ground, 0)
        depth[0] += math.exp(-h / 8000) * (t1 - t0)
        depth[1] += haze * math.exp(-h / 1200) * (t1 - t0)
        depth[2] += max(0, 1 - abs(h - 25000) / 15000) * (t1 - t0)
        t0 = t1
    blue = [5.802e-6, 13.558e-6, 33.1e-6]
    ozone = [0.65e-6, 1.881e-6, 0.085e-6]
    return [power * math.exp(-(blue[c] * depth[0] + 4.44e-6 * depth[1] + ozone[c] * depth[2])) for c in range(3)]


def sky_image():
    raw = np.fromfile(os.path.join(DATA, "sky.f16"), dtype=np.float16).reshape(1536, 4096, 4).astype(np.float32)
    H, Wd = 2048, 4096
    # Blender's equirectangular way round: a column's way is (cos f, -sin f) for f from -pi to pi, here (x, y)
    # (Cycles: azimuth = pi - 2 pi u)
    f = (np.arange(Wd) + 0.5) / Wd * 2 * np.pi - np.pi
    dx, dy = np.cos(f), -np.sin(f)
    # the page's column for that way (its u is atan2(x, z) / 2 pi + 0.5, its z being Blender's y)
    u = (np.arctan2(dx, dy) / (2 * np.pi) + 0.5) * 4096 - 0.5
    u0 = np.floor(u).astype(int) % 4096
    u1 = (u0 + 1) % 4096
    fu = (u - np.floor(u))[None, :, None]
    # rows: Blender's from the bottom, -90 to 90 degrees; the page's from the horizon to the zenith
    elev = ((np.arange(H) + 0.5) / H) * 180 - 90
    v = np.clip(elev / 90, 0, 1) * 1535
    v0 = np.floor(v).astype(int)
    v1 = np.minimum(v0 + 1, 1535)
    fv = (v - v0)[:, None, None]
    top = raw[v0][:, u0] * (1 - fu) + raw[v0][:, u1] * fu
    bot = raw[v1][:, u0] * (1 - fu) + raw[v1][:, u1] * fu
    img = top * (1 - fv) + bot * fv
    img[..., 3] = 1
    im = bpy.data.images.new("sky", Wd, H, float_buffer=True, alpha=False)
    im.pixels.foreach_set(img.astype(np.float32).ravel())
    im.pack()
    return im


# Or (--sky <name>) a photographed sky from assets/skies/, sun and all, turned so that its sun stands at
# --sun-turn degrees (as the page's sunTurn: from ahead, +y, toward the right, +x)
SKY = arg("--sky", "")
SKY_TURN = 0.0  # how far the sky's picture is turned about z, radians
SUN_DIR = None


def find_sun(im):
    """the way to the brightest place in an equirectangular picture, in Blender's way round"""
    small = im.copy()
    small.scale(1024, 512)
    px = np.empty(1024 * 512 * 4, dtype=np.float32)
    small.pixels.foreach_get(px)
    px = px.reshape(512, 1024, 4)
    lum = px[..., 0] * 0.2126 + px[..., 1] * 0.7152 + px[..., 2] * 0.0722
    row, col = np.unravel_index(np.argmax(lum), lum.shape)
    bpy.data.images.remove(small)
    u, v = (col + 0.5) / 1024, (row + 0.5) / 512
    f = (u - 0.5) * 2 * math.pi
    el = (v - 0.5) * math.pi
    return Vector((math.cos(f) * math.cos(el), -math.sin(f) * math.cos(el), math.sin(el)))


world = bpy.data.worlds.new("sky")
scene.world = world
world.use_nodes = True
wt = world.node_tree
wt.nodes.clear()
wo = node(wt, "ShaderNodeOutputWorld", (400, 0))
bg = node(wt, "ShaderNodeBackground", (200, 0))
env = node(wt, "ShaderNodeTexEnvironment", (-100, 0))
if SKY:
    env.image = bpy.data.images.load(os.path.join(ASSETS, "skies", SKY + ".exr"))
    found = find_sun(env.image)
    turn = math.radians(float(arg("--sun-turn", "-35")))
    want = math.atan2(math.cos(turn), math.sin(turn))  # (as atan2(y, x) of the way to it)
    SKY_TURN = math.atan2(found.y, found.x) - want
    SUN_DIR = Matrix.Rotation(-SKY_TURN, 3, "Z") @ found
    coord = node(wt, "ShaderNodeTexCoord", (-500, 0))
    spin = node(wt, "ShaderNodeVectorRotate", (-300, 0))
    spin.rotation_type = "Z_AXIS"
    spin.inputs["Angle"].default_value = SKY_TURN
    link(wt, coord.outputs["Generated"], spin.inputs["Vector"])
    link(wt, spin.outputs["Vector"], env.inputs["Vector"])
    print("[mirage] sky %s, its sun %.1f deg up, turned %.1f deg" % (SKY, math.degrees(math.asin(found.z)), math.degrees(SKY_TURN)), flush=True)
    # A sun lower than the photograph's (--sun-high degrees): the photograph's own sun is taken out of it (it is
    # all that is brighter than anything else in the sky), and its light given to a lamp, as strong, as
    # coloured, where it is wanted.
    if arg("--sun-high", ""):
        Ws, Hs = 2048, 1024
        small = env.image.copy()
        small.scale(Ws, Hs)
        px = np.empty(Ws * Hs * 4, dtype=np.float32)
        small.pixels.foreach_get(px)
        bpy.data.images.remove(small)
        px = px.reshape(Hs, Ws, 4)[..., :3]
        u = (np.arange(Ws) + 0.5) / Ws
        el = ((np.arange(Hs) + 0.5) / Hs - 0.5) * np.pi
        f = (u - 0.5) * 2 * np.pi
        dirs = np.stack([np.cos(f)[None, :] * np.cos(el)[:, None], -np.sin(f)[None, :] * np.cos(el)[:, None], np.sin(el)[:, None].repeat(Ws, 1)], -1)
        off = np.degrees(np.arccos(np.clip(dirs @ np.array(found), -1, 1)))
        lum = px @ np.array([0.2126, 0.7152, 0.0722])
        # (the sky about the sun, between 3 and 8 degrees off it, as the brightest it gets but for the sun)
        ceiling = 1.2 * lum[(off > 3) & (off < 25)].max()
        solid = (2 * np.pi / Ws) * (np.pi / Hs) * np.cos(el)[:, None]
        over = np.clip(px - ceiling, 0, None) * (off < 3)[..., None]
        sun_rgb = (over * solid[..., None]).sum((0, 1))
        clamp = node(wt, "ShaderNodeVectorMath", (100, -200))
        clamp.operation = "MINIMUM"
        clamp.inputs[1].default_value = (ceiling, ceiling, ceiling)
        link(wt, env.outputs["Color"], clamp.inputs[0])
        SKY_COLOUR = clamp.outputs[0]
        high = math.radians(float(arg("--sun-high", "30")))
        SUN_DIR = Vector((math.sin(turn) * math.cos(high), math.cos(turn) * math.cos(high), math.sin(high)))
        strength = float(max(sun_rgb))
        lamp = bpy.data.lights.new("sun", "SUN")
        lamp.energy = strength * float(arg("--sun-power", "1"))
        lamp.color = [float(c) / strength for c in sun_rgb]
        lamp.angle = math.radians(0.53)
        lamp_o = bpy.data.objects.new("sun", lamp)
        lamp_o.rotation_euler = SUN_DIR.to_track_quat("Z", "Y").to_euler()
        scene.collection.objects.link(lamp_o)
        print("[mirage] the sky's sun taken out over %.1f, given to a lamp %.1f deg up: %s" % (ceiling, math.degrees(high), [round(float(c), 2) for c in sun_rgb]), flush=True)
else:
    env.image = sky_image()
if "SKY_COLOUR" not in globals():
    SKY_COLOUR = env.outputs["Color"]

# Dust: the haze is the colour of the air with sand in it (--dust, 0 to 1, how much it is that and not the
# sky's own colour at the horizon), and low over the dunes the sky itself is thick with it.
DUST = float(arg("--dust", "0"))
DUST_RGB = srgb(arg("--dust-tone", "#e8cfa8"))
if DUST > 0:
    # (as bright as the sky is at the horizon)
    hz = np.empty(4, dtype=np.float32)
    probe = env.image.copy()
    probe.scale(256, 128)
    pp = np.empty(256 * 128 * 4, dtype=np.float32)
    probe.pixels.foreach_get(pp)
    bpy.data.images.remove(probe)
    pp = pp.reshape(128, 256, 4)[65:68, :, :3]
    level = float(np.median(pp @ np.array([0.2126, 0.7152, 0.0722])))
    tone_l = sum(c * w for c, w in zip(DUST_RGB, (0.2126, 0.7152, 0.0722)))
    DUST_COL = [c * level / tone_l for c in DUST_RGB]
    gen = node(wt, "ShaderNodeTexCoord", (-500, 400))
    nz = node(wt, "ShaderNodeSeparateXYZ", (-300, 400))
    link(wt, gen.outputs["Generated"], nz.inputs[0])
    low = node(wt, "ShaderNodeMapRange", (-100, 400))
    low.inputs["From Min"].default_value = 0.0
    low.inputs["From Max"].default_value = float(arg("--dust-band", "0.09"))
    low.inputs["To Min"].default_value = DUST
    low.inputs["To Max"].default_value = 0.0
    link(wt, nz.outputs["Z"], low.inputs["Value"])
    band = node(wt, "ShaderNodeMix", (100, 200))
    band.data_type = "RGBA"
    cin = [x for x in band.inputs if x.type == "RGBA"]
    link(wt, low.outputs["Result"], band.inputs[0])
    link(wt, SKY_COLOUR, cin[0])
    cin[1].default_value = (*DUST_COL, 1)
    SKY_COLOUR = [x for x in band.outputs if x.type == "RGBA"][0]
    print("[mirage] dust %.2f, as bright as the horizon (%.2f)" % (DUST, level), flush=True)
link(wt, SKY_COLOUR, bg.inputs["Color"])
link(wt, bg.outputs[0], wo.inputs["Surface"])
# (the page gives the sand more of the sky's light than it would have, `skyFill`: here diffuse rays get it)
lp = node(wt, "ShaderNodeLightPath", (-100, 300))
fill = node(wt, "ShaderNodeMapRange", (100, 300))
fill.inputs["To Min"].default_value = 1.0
fill.inputs["To Max"].default_value = float(arg("--fill", "1.5"))
link(wt, lp.outputs["Is Diffuse Ray"], fill.inputs["Value"])
link(wt, fill.outputs["Result"], bg.inputs["Strength"])

# The air, as the page has it: what a ray meets is seen through 1 - exp(-length / sight) of the air's colour,
# the sky's just over the horizon the way the ray goes. Here in each material, by the length of the ray that
# met it (from the eye, a mirror or a door), and only for rays the eye is to see along, not those that light.
def air_group():
    g = bpy.data.node_groups.new("air", "ShaderNodeTree")
    g.interface.new_socket("Shader", in_out="INPUT", socket_type="NodeSocketShader")
    # (how much of the surface is there: a leaf's texture lets the rest through, and that rest is not hazed)
    al = g.interface.new_socket("Alpha", in_out="INPUT", socket_type="NodeSocketFloat")
    al.default_value = 1.0
    g.interface.new_socket("Shader", in_out="OUTPUT", socket_type="NodeSocketShader")
    gi = g.nodes.new("NodeGroupInput")
    go = g.nodes.new("NodeGroupOutput")
    geo = g.nodes.new("ShaderNodeNewGeometry")
    lp = g.nodes.new("ShaderNodeLightPath")
    way = g.nodes.new("ShaderNodeVectorMath")
    way.operation = "MULTIPLY"
    way.inputs[1].default_value = (-1, -1, 0)
    link(g, geo.outputs["Incoming"], way.inputs[0])
    lift = g.nodes.new("ShaderNodeVectorMath")
    lift.operation = "ADD"
    lift.inputs[1].default_value = (0, 0, 0.012)
    link(g, way.outputs[0], lift.inputs[0])
    flat = g.nodes.new("ShaderNodeVectorMath")
    flat.operation = "NORMALIZE"
    link(g, lift.outputs[0], flat.inputs[0])
    tex = g.nodes.new("ShaderNodeTexEnvironment")
    tex.image = env.image
    spin = g.nodes.new("ShaderNodeVectorRotate")
    spin.rotation_type = "Z_AXIS"
    spin.inputs["Angle"].default_value = SKY_TURN
    link(g, flat.outputs[0], spin.inputs["Vector"])
    link(g, spin.outputs["Vector"], tex.inputs["Vector"])
    glow = g.nodes.new("ShaderNodeEmission")
    if DUST > 0:
        dm = g.nodes.new("ShaderNodeMix")
        dm.data_type = "RGBA"
        din = [x for x in dm.inputs if x.type == "RGBA"]
        dm.inputs[0].default_value = DUST
        link(g, tex.outputs["Color"], din[0])
        din[1].default_value = (*DUST_COL, 1)
        link(g, [x for x in dm.outputs if x.type == "RGBA"][0], glow.inputs["Color"])
    else:
        link(g, tex.outputs["Color"], glow.inputs["Color"])
    # 1 - exp(-length / sight)
    m1 = g.nodes.new("ShaderNodeMath")
    m1.operation = "MULTIPLY"
    m1.inputs[1].default_value = -1 / (float(arg("--sight", str(LOOK["sight"]))) * 1000)
    link(g, lp.outputs["Ray Length"], m1.inputs[0])
    m2 = g.nodes.new("ShaderNodeMath")
    m2.operation = "EXPONENT"
    link(g, m1.outputs[0], m2.inputs[0])
    m3 = g.nodes.new("ShaderNodeMath")
    m3.operation = "SUBTRACT"
    m3.inputs[0].default_value = 1
    link(g, m2.outputs[0], m3.inputs[1])
    # (seen: a camera ray, or one gone on off a mirror or through a door)
    seen = None
    for out_name in ("Is Camera Ray", "Is Glossy Ray", "Is Transmission Ray"):
        if seen is None:
            seen = lp.outputs[out_name]
            continue
        mx = g.nodes.new("ShaderNodeMath")
        mx.operation = "MAXIMUM"
        link(g, seen, mx.inputs[0])
        link(g, lp.outputs[out_name], mx.inputs[1])
        seen = mx.outputs[0]
    fac0 = g.nodes.new("ShaderNodeMath")
    fac0.operation = "MULTIPLY"
    link(g, m3.outputs[0], fac0.inputs[0])
    link(g, seen, fac0.inputs[1])
    fac = g.nodes.new("ShaderNodeMath")
    fac.operation = "MULTIPLY"
    link(g, fac0.outputs[0], fac.inputs[0])
    link(g, gi.outputs[1], fac.inputs[1])
    mix = g.nodes.new("ShaderNodeMixShader")
    link(g, fac.outputs[0], mix.inputs["Fac"])
    link(g, gi.outputs[0], mix.inputs[1])
    link(g, glow.outputs[0], mix.inputs[2])
    link(g, mix.outputs[0], go.inputs[0])
    return g


AIR = air_group()
for m in bpy.data.materials:
    if not m.use_nodes:
        continue
    t = m.node_tree
    # (a leaf's alpha, if it has one, from its BSDF)
    alpha = None
    for n in t.nodes:
        if n.bl_idname == "ShaderNodeBsdfPrincipled" and n.inputs["Alpha"].links:
            alpha = n.inputs["Alpha"].links[0].from_socket
    for out in [n for n in t.nodes if n.bl_idname == "ShaderNodeOutputMaterial"]:
        if not out.inputs["Surface"].links:
            continue
        src = out.inputs["Surface"].links[0].from_socket
        grp = t.nodes.new("ShaderNodeGroup")
        grp.node_tree = AIR
        link(t, src, grp.inputs[0])
        if alpha is not None:
            link(t, alpha, grp.inputs[1])
        link(t, grp.outputs[0], out.inputs["Surface"])

# (a photographed sky has its own sun in it, as bright as it was: no lamp then)
if not SKY:
    sun = W["sun"]
    tone = sun_light(sun)
    strength = max(tone)
    lamp = bpy.data.lights.new("sun", "SUN")
    lamp.energy = strength
    lamp.color = [c / strength for c in tone]
    lamp.angle = math.radians(2 * LOOK["sunWide"])
    lamp_o = bpy.data.objects.new("sun", lamp)
    lamp_o.rotation_euler = Vector(sun).to_track_quat("Z", "Y").to_euler()
    scene.collection.objects.link(lamp_o)
    print("[mirage] sky and sun", tone, flush=True)


# --- the eye

cam = bpy.data.cameras.new("eye")
# the page's angle is the height of the picture; a tall frame (phone) wants its width set instead,
# else a 9:16 picture is a 31 deg slot: --wide <deg> is the width, --pitch <deg> looks up (+) / down
if arg("--wide", ""):
    cam.sensor_fit = "HORIZONTAL"
    cam.angle_x = math.radians(float(arg("--wide", "")))
else:
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(LOOK["fov"])
PITCH = math.radians(float(arg("--pitch", "0")))
# --shift lifts the picture (lens shift, a fraction of its longer side) without tilting: mirrors stay upright
cam.shift_y = float(arg("--shift", "0"))
# near clip under the closest any frame comes to a door (2.5 cm, frame 739): camera rays start at the clip,
# and with 5 cm they began past the portal and showed the world behind the door for one frame
cam.clip_start = 0.001
cam.clip_end = 20000
cam_o = bpy.data.objects.new("eye", cam)
scene.collection.objects.link(cam_o)
scene.camera = cam_o


def pose(f):
    p = W["frames"][f % len(W["frames"])]
    right, up, fore = Vector(p["right"]), Vector(p["up"]), Vector(p["fore"])
    if PITCH:
        fore, up = fore * math.cos(PITCH) + up * math.sin(PITCH), up * math.cos(PITCH) - fore * math.sin(PITCH)
    m = Matrix((right, up, -fore)).transposed().to_4x4()
    m.translation = p["eye"]
    return m


scene.frame_start = 0
scene.frame_end = len(W["frames"]) - 1
scene.render.fps = W["fps"]
for f in range(len(W["frames"])):
    cam_o.matrix_world = pose(f)
    cam_o.keyframe_insert("location", frame=f)
    cam_o.keyframe_insert("rotation_euler", frame=f)
for fc in cam_o.animation_data.action.fcurves if hasattr(cam_o.animation_data.action, "fcurves") else []:
    for kp in fc.keyframe_points:
        kp.interpolation = "CONSTANT"


# --- rendering: Cycles, haze in the compositor from the distance (the page's air: 1/e at `sight` km)

r = scene.render
r.resolution_x, r.resolution_y = RES
r.resolution_percentage = 100
c = scene.cycles
c.samples = SAMPLES
c.use_adaptive_sampling = True
c.adaptive_threshold = 0.01
c.use_denoising = True
c.max_bounces = 16
c.diffuse_bounces = 3
c.glossy_bounces = 14
c.transmission_bounces = 8
c.transparent_max_bounces = 16
c.caustics_reflective = False
c.caustics_refractive = False
c.blur_glossy = 0.5
# (the noise left is not the same from one frame to the next: a fixed pattern slides with the eye, and shows)
c.use_animated_seed = True
c.sample_clamp_indirect = float(arg("--clamp", "10"))
# (the page's own grading is done in the compositor, below: so no other curve here)
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0.0
prefs = bpy.context.preferences.addons["cycles"].preferences
try:
    prefs.compute_device_type = DEVICE
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == DEVICE or (DEVICE == "METAL" and d.type == "METAL")
    c.device = "GPU" if DEVICE != "CPU" else "CPU"
except TypeError:
    c.device = "CPU"
print("[mirage] device", c.device, [d.name for d in prefs.devices if d.use], flush=True)

vl = scene.view_layers[0]
# (Blender 5: the compositor is a node group of the scene's, with the shared Math and Mix nodes)
ct = bpy.data.node_groups.new("compositing", "CompositorNodeTree")
scene.compositing_node_group = ct
ct.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
rl = ct.nodes.new("CompositorNodeRLayers")


def math(op, a, b):
    n = ct.nodes.new("ShaderNodeMath")
    n.operation = op
    for k, v in enumerate((a, b)):
        if isinstance(v, (int, float)):
            n.inputs[k].default_value = v
        else:
            link(ct, v, n.inputs[k])
    return n.outputs[0]


hazed = rl.outputs["Image"]

# The page's grading (show.wgsl): dusk (blue toward violet, cream toward rose), exposure, a vignette, Hable's
# curve, a little more colour, then the display's gamma (the Standard view transform).
sep = ct.nodes.new("CompositorNodeSeparateColor")
link(ct, hazed, sep.inputs[0])
R, G, B = sep.outputs[0], sep.outputs[1], sep.outputs[2]
dusk = float(arg("--dusk", "1"))
expo = LOOK["exposure"] * float(arg("--expose", "1"))
R2 = math("ADD", R, math("MULTIPLY", B, 0.2 * dusk))
G2 = math("ADD", math("MULTIPLY", G, 1 - 0.1 * dusk), math("MULTIPLY", B, 0.02 * dusk))
B2 = math("ADD", B, math("MULTIPLY", R, 0.05 * dusk))
# (the vignette: 1 - 0.25 * 1.6 * |uv - 0.5|^2)
coords = ct.nodes.new("CompositorNodeImageCoordinates")
uvn = [o for o in coords.outputs if "Normalized" in o.name or o.name == "Uniform"]
vig = 1.0
if uvn:
    sepv = ct.nodes.new("ShaderNodeSeparateXYZ")
    link(ct, uvn[0], sepv.inputs[0])
    dx = math("SUBTRACT", sepv.outputs[0], 0.5)
    dy = math("SUBTRACT", sepv.outputs[1], 0.5)
    vig = math("SUBTRACT", 1.0, math("MULTIPLY", math("ADD", math("MULTIPLY", dx, dx), math("MULTIPLY", dy, dy)), 0.25 * 1.6))


def hable(x):
    a, b, c, d, e, f = 0.22, 0.3, 0.1, 0.2, 0.01, 0.3
    if isinstance(x, (int, float)):
        return (x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f) - e / f
    num = math("ADD", math("MULTIPLY", x, math("ADD", math("MULTIPLY", x, a), c * b)), d * e)
    den = math("ADD", math("MULTIPLY", x, math("ADD", math("MULTIPLY", x, b * 0 + a), b)), d * f)
    return math("SUBTRACT", math("DIVIDE", num, den), e / f)


white = hable(11.2)
chans = []
for ch in (R2, G2, B2):
    x = math("MULTIPLY", ch, expo)
    if vig != 1.0:
        x = math("MULTIPLY", x, vig)
    chans.append(math("DIVIDE", hable(math("MAXIMUM", x, 0.0)), white))
grey = math("ADD", math("ADD", math("MULTIPLY", chans[0], 0.2126), math("MULTIPLY", chans[1], 0.7152)), math("MULTIPLY", chans[2], 0.0722))
sat = float(arg("--sat", "1.25"))
chans = [math("ADD", math("MULTIPLY", ch, sat), math("MULTIPLY", grey, 1 - sat)) for ch in chans]
# A teal grade (--teal, 0 to 1): blue toward teal, the shadows cooler and lifted, the lights warmer, a little
# faded, as old film is.
TEAL = float(arg("--teal", "0"))
if TEAL > 0:
    r_, g_, b_ = chans
    blue = math("MAXIMUM", math("SUBTRACT", b_, r_), 0.0)
    g_ = math("ADD", g_, math("MULTIPLY", blue, 0.22 * TEAL))
    b_ = math("SUBTRACT", b_, math("MULTIPLY", blue, 0.06 * TEAL))
    lum = math("ADD", math("ADD", math("MULTIPLY", r_, 0.2126), math("MULTIPLY", g_, 0.7152)), math("MULTIPLY", b_, 0.0722))
    dark = math("POWER", math("SUBTRACT", 1.0, math("MINIMUM", lum, 1.0)), 2.0)
    light = math("POWER", math("MINIMUM", lum, 1.0), 2.0)
    out3 = []
    for ch, sh, hi in zip((r_, g_, b_), (-0.012, 0.016, 0.03), (0.035, 0.012, -0.03)):
        v = math("ADD", ch, math("ADD", math("MULTIPLY", dark, sh * TEAL), math("MULTIPLY", light, hi * TEAL)))
        out3.append(math("ADD", math("MULTIPLY", v, 1 - 0.06 * TEAL), 0.035 * TEAL))
    chans = out3
comb = ct.nodes.new("CompositorNodeCombineColor")
for k, ch in enumerate(chans):
    link(ct, ch, comb.inputs[k])
outn = ct.nodes.new("NodeGroupOutput")
link(ct, comb.outputs[0], outn.inputs[0])

print("[mirage] built: %d objects" % len(bpy.data.objects), flush=True)
if arg("--save", ""):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(HERE, arg("--save", ""))))

os.makedirs(OUT, exist_ok=True)
import time
for f in FRAMES:
    # (a frame already made is not made again: a long run can be started again where it stopped)
    if os.path.exists(os.path.join(OUT, "f_%04d.png" % f)) and "--again" not in args:
        continue
    scene.frame_set(f)
    cam_o.matrix_world = pose(f)
    r.filepath = os.path.join(OUT, "f_%04d.png" % f)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("[mirage] frame %d in %.1f s -> %s" % (f, time.time() - t0, r.filepath), flush=True)
