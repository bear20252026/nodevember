import * as THREE from 'three';

// The volumes and their fracture.
// A volume is convex, its circumradius 1. It breaks into convex cells, each the
// volume clipped by planes; how they are laid out depends on the material (see
// STYLES): the cracks of glass run out from the impact (or, now and then, it
// bursts as wood does), wood bursts in long splinters fanned out from the
// middle, stone splits along its beds... The pieces are of all sizes (see
// SIZES): some big, where cracks did not run, and some cells crumbled into
// chips. Each cell is also cut by a plane facing the center, at HOLLOW from
// it, so the fragments together are a shell: the next volume waits in the
// hollow, inside a ball of radius HOLLOW.
// Then the breaks are roughened: the cut faces are finely tessellated and the
// whole space warped by a noise, the same for all cells, so their faces still
// fit together.

export const HOLLOW = 0.42;
// the size of the triangles of the curved surfaces
const CURVE_DETAIL = 0.035;

const EPS = 1e-7;

// ---- the shapes ---------------------------------------------------------------

// The shapes are cut as polyhedra, coarse enough to break quickly. Their
// surface is then drawn finely, on the true body: the sphere, or the polyhedron
// with its edges rounded off (the body within BEVEL of the polyhedron shrunk by
// BEVEL, see `rounded`). `core(planes)` gives the shrunk body, as a function
// returning the point of it closest to p, null inside, and `depth(p)` the depth
// of p below the surface when inside it, with the normal there. `fine(n)` tells
// the faces curved all over, drawn in small triangles everywhere; on the others
// only near the edges, in strips along them. A shape can also be sharp, its
// edges left as they are (radius 0): `sharp(p, n)` is then its normal at p on
// a face of normal n.
const BEVEL = 0.03;
const R_CYLINDER = 0.8, H_CYLINDER = 0.6;
const flatCore = (planes, r) => polyhedronCore(planes.map((pl) => ({ n: pl.n, d: pl.d - r })));
const flatDepth = (planes, r) => (p) => {
  let t = Infinity, n = null;
  for (const pl of planes) if (pl.d - pl.n.dot(p) < t) (t = pl.d - pl.n.dot(p)), (n = pl.n);
  return { t, n: n.clone() };
};
// the faces of the shape, sharp, each with how deep p is below it: the cracks
// slide along those close by (see warper)
const flatFaces = (planes) => (p) => planes.map((pl) => ({ n: pl.n, t: pl.d - pl.n.dot(p) }));
const polyhedral = (name, geometry) => ({ name, geometry, radius: BEVEL, core: flatCore, depth: flatDepth, faces: flatFaces, sharp: (p, n) => n });
const SHAPES = [
  polyhedral('cube', () => new THREE.BoxGeometry(1, 1, 1)),
  polyhedral('icosahedron', () => new THREE.IcosahedronGeometry(1, 0)),
  polyhedral('dodecahedron', () => new THREE.DodecahedronGeometry(1, 0)),
  polyhedral('octahedron', () => new THREE.OctahedronGeometry(1, 0)),
  {
    name: 'sphere',
    geometry: () => new THREE.IcosahedronGeometry(1, 3),
    // the ball of radius 1 around the center
    radius: 1,
    core: () => () => new THREE.Vector3(),
    depth: () => (p) => ({ t: 1, n: new THREE.Vector3(0, 1, 0) }),
    faces: () => (p) => [{ n: p.clone().normalize(), t: 1 - p.length() }],
    fine: () => true,
  },
  {
    name: 'cylinder',
    // its circumradius 1 already
    geometry: () => new THREE.CylinderGeometry(R_CYLINDER, R_CYLINDER, 2 * H_CYLINDER, 32),
    radius: BEVEL,
    core: (planes, radius) => (p) => {
      const r = Math.hypot(p.x, p.z), R = R_CYLINDER - radius, H = H_CYLINDER - radius;
      if (r <= R && Math.abs(p.y) <= H) return null;
      const k = r > R ? R / r : 1;
      return new THREE.Vector3(p.x * k, THREE.MathUtils.clamp(p.y, -H, H), p.z * k);
    },
    depth: () => (p) => {
      const r = Math.hypot(p.x, p.z), side = R_CYLINDER - r, cap = H_CYLINDER - Math.abs(p.y);
      return side < cap
        ? { t: side, n: new THREE.Vector3(p.x, 0, p.z).divideScalar(r || 1) }
        : { t: cap, n: new THREE.Vector3(0, Math.sign(p.y) || 1, 0) };
    },
    faces: () => (p) => {
      const r = Math.hypot(p.x, p.z);
      return [
        { n: new THREE.Vector3(p.x, 0, p.z).divideScalar(r || 1), t: R_CYLINDER - r },
        { n: new THREE.Vector3(0, 1, 0), t: H_CYLINDER - p.y },
        { n: new THREE.Vector3(0, -1, 0), t: H_CYLINDER + p.y },
      ];
    },
    sharp: (p, n) => (Math.abs(n.y) > 0.5 ? n : new THREE.Vector3(p.x, 0, p.z).normalize()),
    // curved one way only, its side would act as a cylindrical lens: what is
    // inside, seen through it, stretched sideways only. Seen through, it bends
    // the light as if curved both ways, like a sphere (see materials.js)
    lens: true,
  },
  polyhedral('prism', () => new THREE.CylinderGeometry(0.85, 0.85, 1, 6)),
];
export const SHAPE_COUNT = SHAPES.length;
// whether the shape's curved side refracts as if it were round (the cylinder)
export const shapeLens = (shapeIndex) => !!SHAPES[shapeIndex].lens;

// the shape as a polyhedron: its triangles, scaled to a circumradius of 1
function shapePolyhedron(shape) {
  let geometry = shape.geometry();
  if (geometry.index) geometry = geometry.toNonIndexed();
  const pos = geometry.attributes.position;
  const pts = [];
  let r = 0;
  for (let i = 0; i < pos.count; i++) {
    pts.push(new THREE.Vector3().fromBufferAttribute(pos, i));
    r = Math.max(r, pts[i].length());
  }
  const faces = [];
  for (let i = 0; i < pts.length; i += 3) {
    const f = [pts[i], pts[i + 1], pts[i + 2]].map((p) => p.clone().divideScalar(r));
    const n = new THREE.Vector3().subVectors(f[1], f[0]).cross(new THREE.Vector3().subVectors(f[2], f[0]));
    if (n.lengthSq() < 1e-12) continue;
    // src: which face of the shape it is, kept by its pieces
    faces.push({ pts: f, n: n.normalize(), cut: false, src: faces.length });
  }
  return faces;
}

// the planes of the polyhedron's faces; each face is told its own
function facePlanes(faces) {
  const planes = [];
  for (const f of faces) {
    const d = f.n.dot(f.pts[0]);
    f.plane = planes.find((q) => q.n.dot(f.n) > 1 - 1e-6 && Math.abs(q.d - d) < 1e-6);
    if (!f.plane) planes.push((f.plane = { n: f.n, d }));
  }
  return planes;
}

// where the strips along a rounded edge are, from the edge to where the round
// ends: in depths below the face across it, as a part of the deepest. The
// faces at a wide angle get them all, the others fewer.
const STRIPS = [0.04, 0.12, 0.25, 0.45, 0.7, 1];

// The true body of the shape (see SHAPES), once for each: surface(p) is the
// depth t of p below its surface and the normal n there, project(p) the point
// of the surface closest to p, strips the planes that cut the flat faces in
// strips along the rounded edges. Rounded or sharp (when it can be).
const bodies = new Map();
function shapeBody(shape, round = true) {
  const sharp = !round && shape.sharp;
  const id = `${shape.name}${sharp ? ' sharp' : ''}`;
  if (bodies.has(id)) return bodies.get(id);
  const radius = sharp ? 0 : shape.radius;
  const solid = shapePolyhedron(shape);
  const planes = facePlanes(solid);
  // the faces across an edge from a face, at an angle, or from the triangles
  // of the same face: the edges between them rounded off, it is cut in strips
  // along those whose round reaches it
  const vkey = (p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  const ekey = (a, b) => [vkey(a), vkey(b)].sort().join('|');
  const ends = new Map();
  for (const f of solid)
    f.pts.forEach((a, i) => {
      const k = ekey(a, f.pts[(i + 1) % f.pts.length]);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(f);
    });
  const across = (f) => f.pts.flatMap((a, i) => ends.get(ekey(a, f.pts[(i + 1) % f.pts.length])).filter((g) => g !== f));
  // the strips below each face: as deep as the round of its widest edge goes;
  // the same whichever face they cut, so an edge between two is cut alike
  for (const q of planes) {
    let cos = 1;
    for (const f of solid) if (f.plane === q) for (const g of across(f)) if (g.plane !== q) cos = Math.min(cos, g.n.dot(q.n));
    const deep = radius * (1 - cos), ks = !deep ? [] : cos > 0.5 ? STRIPS.filter((_, i) => i % 2) : STRIPS;
    q.strips = ks.map((k) => ({ n: q.n, d: q.d - k * deep }));
    q.deep = deep;
  }
  const strips = solid.map((f) => {
    // the edges of its face, between it and another at an angle, that it
    // touches: through the triangles of the face, the other faces across them
    const corners = new Set(f.pts.map(vkey));
    const same = new Set([f]), next = new Set();
    for (const g of same)
      g.pts.forEach((a, i) => {
        const b = g.pts[(i + 1) % g.pts.length];
        for (const o of ends.get(ekey(a, b))) {
          if (o === g) continue;
          if (o.plane === f.plane) same.add(o);
          else if (o.n.dot(f.n) < 0.9 && (corners.has(vkey(a)) || corners.has(vkey(b)))) next.add(o.plane);
        }
      });
    return [...next].flatMap((q) => q.strips);
  });
  const core = shape.core(planes, radius), depth = shape.depth(planes, radius);
  const surface = (p) => {
    const q = core(p);
    if (!q) {
      const { t, n } = depth(p);
      return { t: t, n };
    }
    const n = new THREE.Vector3().subVectors(p, q);
    const l = n.length();
    if (l < 1e-9) return { t: radius, n: depth(p).n };
    return { t: radius - l, n: n.divideScalar(l) };
  };
  const body = {
    surface,
    faces: shape.faces(planes),
    project: (p) => {
      const { t, n } = surface(p);
      return p.clone().addScaledVector(n, t);
    },
    // p on the surface, and the normal there
    place: (p) => {
      const { t, n } = surface(p);
      return { p: p.clone().addScaledVector(n, t), n };
    },
    // the planes that cut a face of the outside in strips
    strips: (f) => strips[f.src],
    // the normal at p on the face f of the outside, if sharp (else, n)
    normal: (p, f, n) => (sharp ? shape.sharp(p, f.n) : n),
  };
  bodies.set(id, body);
  return body;
}

// the point closest to p of the convex polyhedron n·x <= d, null if p is in it:
// p projected on one of the faces, edges or corners it is outside of
function polyhedronCore(planes) {
  const m = new THREE.Matrix3(), q = new THREE.Vector3(), best = new THREE.Vector3();
  const N = planes.length, s = new Float64Array(N);
  const inside = () => {
    for (const pl of planes) if (pl.n.x * q.x + pl.n.y * q.y + pl.n.z * q.z > pl.d + 1e-7) return false;
    return true;
  };
  // q: p projected on the faces i, i and j, or i, j and k (the corner)
  const onto1 = (p, i) => q.copy(p).addScaledVector(planes[i].n, -s[i]);
  const onto2 = (p, i, j) => {
    const a = planes[i].n, b = planes[j].n, c = a.dot(b), det = 1 - c * c;
    if (det < 1e-9) return false;
    const la = (s[i] - c * s[j]) / det, lb = (s[j] - c * s[i]) / det;
    q.copy(p).addScaledVector(a, -la).addScaledVector(b, -lb);
    return true;
  };
  const onto3 = (i, j, k) => {
    const a = planes[i].n, b = planes[j].n, c = planes[k].n;
    m.set(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    if (Math.abs(m.determinant()) < 1e-9) return false;
    q.set(planes[i].d, planes[j].d, planes[k].d).applyMatrix3(m.invert());
    return true;
  };
  const search = (p, cand) => {
    // on a face, else on an edge, else at a corner: the first that fits is the
    // nearest, fewer planes leave more room
    const n = cand.length;
    for (const i of cand) if (onto1(p, i) && inside()) return q.clone();
    let dist = Infinity;
    const keep = () => {
      const d = q.distanceToSquared(p);
      if (d < dist && inside()) (dist = d), best.copy(q);
    };
    for (let x = 0; x < n; x++) for (let y = x + 1; y < n; y++) if (onto2(p, cand[x], cand[y])) keep();
    if (dist < Infinity) return best.clone();
    for (let x = 0; x < n; x++)
      for (let y = x + 1; y < n; y++) for (let z = y + 1; z < n; z++) if (onto3(cand[x], cand[y], cand[z])) keep();
    return dist < Infinity ? best.clone() : null;
  };
  return (p) => {
    const out = [];
    for (let i = 0; i < N; i++) {
      const pl = planes[i];
      s[i] = pl.n.x * p.x + pl.n.y * p.y + pl.n.z * p.z - pl.d;
      if (s[i] > 1e-9) out.push(i);
    }
    if (!out.length) return null;
    // the faces p is beyond, else also those it is close to
    return search(p, out) ??
      search(p, [...s.keys()].filter((i) => s[i] > -0.05).sort((i, j) => s[j] - s[i]).slice(0, 6)) ??
      p.clone();
  };
}

// a convex polygon cut by the planes into convex pieces
function splitPolygon(pts, planes) {
  let pieces = [pts];
  for (const pl of planes) {
    const next = [];
    for (const piece of pieces) {
      const s = piece.map((p) => pl.n.dot(p) - pl.d);
      if (s.every((v) => v <= 1e-9) || s.every((v) => v >= -1e-9)) {
        next.push(piece);
        continue;
      }
      const lo = [], hi = [];
      piece.forEach((a, i) => {
        const j = (i + 1) % piece.length, b = piece[j], sa = s[i], sb = s[j];
        if (sa <= 1e-9) lo.push(a);
        if (sa >= -1e-9) hi.push(a);
        if ((sa < -1e-9 && sb > 1e-9) || (sa > 1e-9 && sb < -1e-9)) {
          const q = new THREE.Vector3().lerpVectors(a, b, sa / (sa - sb));
          lo.push(q);
          hi.push(q);
        }
      });
      for (const q of [lo, hi]) if (q.length >= 3) next.push(q);
    }
    pieces = next;
  }
  return pieces;
}

// where an edge from a to b crosses the planes, from 0 to 1 along it
function crossings(a, b, planes) {
  const out = [];
  for (const pl of planes) {
    const sa = pl.n.dot(a) - pl.d, sb = pl.n.dot(b) - pl.d;
    if ((sa < -1e-9 && sb > 1e-9) || (sa > 1e-9 && sb < -1e-9)) out.push(sa / (sa - sb));
  }
  return out.sort((x, y) => x - y);
}

// ---- clipping ---------------------------------------------------------------

// keeps the part of the polyhedron where n·x <= d, closed by a cut face (or
// by a face of another kind: tag, its properties)
function clip(faces, n, d, tag = null) {
  let inside = true, outside = true;
  for (const f of faces)
    for (const p of f.pts) {
      const s = n.dot(p) - d;
      if (s > EPS) inside = false;
      if (s < -EPS) outside = false;
    }
  if (inside) return faces;
  if (outside) return null;

  const out = [];
  const onPlane = [];
  for (const f of faces) {
    const kept = [];
    const k = f.pts.length;
    for (let i = 0; i < k; i++) {
      const a = f.pts[i], b = f.pts[(i + 1) % k];
      const sa = n.dot(a) - d, sb = n.dot(b) - d;
      if (sa <= EPS) {
        kept.push(a);
        if (sa >= -EPS) onPlane.push(a);
      }
      if ((sa < -EPS && sb > EPS) || (sa > EPS && sb < -EPS)) {
        const q = new THREE.Vector3().lerpVectors(a, b, sa / (sa - sb));
        kept.push(q);
        onPlane.push(q);
      }
    }
    const pts = dedupe(kept, true);
    if (pts.length >= 3) out.push({ ...f, pts });
  }

  // the cut face: the points on the plane, around their middle
  const cap = dedupe(onPlane, false);
  if (cap.length >= 3) {
    const c = new THREE.Vector3();
    for (const p of cap) c.add(p);
    c.divideScalar(cap.length);
    const u = new THREE.Vector3().subVectors(cap[0], c).normalize();
    const v = new THREE.Vector3().crossVectors(n, u);
    const t = new THREE.Vector3();
    const angle = (p) => (t.subVectors(p, c), Math.atan2(t.dot(v), t.dot(u)));
    cap.sort((a, b) => angle(a) - angle(b));
    out.push({ pts: cap, n: n.clone(), cut: true, ...tag });
  }
  return out.length >= 4 ? out : null;
}

function dedupe(pts, ring) {
  const out = [];
  for (const p of pts) if (!out.some((q) => q.distanceToSquared(p) < 1e-12)) out.push(p);
  if (ring) {
    // a ring only repeats its neighbours
    while (out.length > 1 && out[0].distanceToSquared(out[out.length - 1]) < 1e-12) out.pop();
  }
  return out;
}

// ---- how each material breaks -------------------------------------------------
// radial: cracks from the impact (`wedges`), and rings around it (`bands`),
//   the cracks branching farther out: long, sharp shards;
// voronoi: cells around `count` seeds, stretched along the material's direction
//   (`stretch` < 1: the long splinters of wood along the grain; > 1: the flat
//   slabs of stone between its beds), and `planes` through the whole volume:
//   cleavages, straight cracks across everything; `slender`: the cells split
//   lengthwise, along the direction, until they are no wider than that.
//   `fan`: as if blown from the inside, the volume first cut in that many
//   wedges around the axis toward the camera (view), the direction in each running
//   out from that axis: the splinters lie along the surface, fanned out from
//   the middle of the face, all pointing at it; `planks`: how often a
//   splinter is left wider.
// fanned: with `chance`, only that often, it breaks as a fanned voronoi
//   instead, as wood does; `taper`: its lengthwise splits run aslant, the
//   shards narrowing; `edged` of them are cut along, across their section
//   corner to corner, into blades with a sharp edge, and `slashed` of them
//   along their length corner to corner, into blades with a point.
// The cut faces are then warped: `warp` is how much, `freq` how fine, `octaves`
// how rough; `grain` pulls the fibers of wood out along the direction; `facets`
// shades the breaks flat, crystalline, or else smooth, glassy.
const STYLES = {
  glass: { radial: { wedges: 10, bands: 5, branch: 0.55 }, fanned: { chance: 0.2, count: 10, stretch: 0.1, slender: 0.6, fan: 8, planks: 0.4, taper: 0.4, edged: 0.7, slashed: 0.6 }, warp: 0.012, freq: 1.6, detail: 0.1 },
  obsidian: { radial: { wedges: 8, bands: 4, branch: 0.4 }, warp: 0.05, freq: 1.3, detail: 0.06 },
  ceramic: { radial: { wedges: 6, bands: 3, branch: 0.35 }, warp: 0.02, freq: 2.2, detail: 0.07 },
  ice: { voronoi: { count: 16, planes: 3 }, warp: 0.012, freq: 4, detail: 0.06, facets: true },
  wood: { voronoi: { count: 36, stretch: 0.08, slender: 0.15, fan: 24, planks: 0.3 }, crumble: 0.5, warp: 0.045, freq: 10, grain: true, detail: 0.045, facets: true },
  stone: { voronoi: { count: 22, stretch: 1.7, planes: 2, bedding: true }, warp: 0.04, freq: 4, octaves: 3, detail: 0.045, facets: true },
  marble: { voronoi: { count: 30, planes: 1 }, warp: 0.022, freq: 6, octaves: 2, detail: 0.05, facets: true },
  // the metals: gold soft, torn into a few big lumps, their breaks pulled
  // into smooth swells; silver between; steel brittle, snapped nearly flat
  // along a cleavage (its sparkle is in its crystals, see materials.js).
  // Smooth, one octave: no rocky lumps
  gold: { voronoi: { count: 12 }, warp: 0.05, freq: 1.8, detail: 0.06 },
  silver: { voronoi: { count: 18 }, warp: 0.03, freq: 2.4, detail: 0.055 },
  steel: { voronoi: { count: 24, planes: 1 }, warp: 0.025, freq: 3.2, detail: 0.06 },
};

// ---- the fracture -----------------------------------------------------------

// The pieces are of all sizes: some seeds claim more room than the others
// (BIG of them, their weight a share of the room of a seed squared), and some
// cells crumble into chips (CRUMBLE of them, more near the impact, scaled by
// the material's `crumble`). The big cells of a splintering material are split
// less, PLANK times wider.
const SIZES = { big: 0.3, weight: 1.2, crumble: 0.1, crumbleNear: 0.3, plank: 4 };

function seeds(count, impact) {
  const out = [];
  // the room of a seed, in the shell around the hollow
  const room = Math.cbrt(((4 / 3) * Math.PI * (1 - HOLLOW ** 3)) / count);
  const p = new THREE.Vector3();
  while (out.length < count) {
    // a third of them gather around the impact: small pieces there
    const near = out.length < count / 3;
    p.randomDirection();
    if (near) p.multiplyScalar(0.45).add(impact).normalize();
    const r = THREE.MathUtils.lerp(HOLLOW + 0.08, near ? 1.05 : 1.15, Math.random());
    const s = p.clone().multiplyScalar(r);
    s.w = !near && Math.random() < SIZES.big ? SIZES.weight * room * room * THREE.MathUtils.randFloat(0.5, 1) : 0;
    out.push(s);
  }
  return out;
}

// Voronoi cells, the distances shrunk (or stretched) by k along dir; a seed of
// weight w is nearer by w (its squared distances less w): its cell is bigger
function voronoi(solid, s, dir, k = 1) {
  const metric = (v) => v.lengthSq() + (k * k - 1) * v.dot(dir) ** 2;
  const d = new THREE.Vector3();
  const cells = [];
  const wMax = Math.max(0, ...s.map((p) => p.w ?? 0));
  for (let i = 0; i < s.length; i++) {
    const si = s[i], wi = si.w ?? 0;
    const dist = (p) => metric(d.subVectors(p, si));
    const others = s.filter((_, j) => j !== i).sort((a, b) => dist(a) - dist(b));
    let poly = solid;
    for (const sj of others) {
      const wj = sj.w ?? 0;
      // no farther seed can cut the cell any more: at a distance D, it is no
      // nearer than (D - R)² - w to the points of the cell, within R of si
      let reach = 0;
      for (const f of poly) for (const p of f.pts) reach = Math.max(reach, dist(p));
      const D = Math.sqrt(dist(sj)), R = Math.sqrt(reach);
      if (D > R && (D - R) ** 2 - wMax > reach - wi) break;
      if (D > R && (D - R) ** 2 - wj > reach - wi) continue;
      // the points nearer to si than to sj: n·x <= c
      const e = new THREE.Vector3().subVectors(sj, si);
      const n = e.clone().addScaledVector(dir, (k * k - 1) * e.dot(dir));
      const c = (metric(sj) - metric(si) + wi - wj) / 2;
      const l = n.length();
      poly = clip(poly, n.divideScalar(l), c / l);
      if (!poly) break;
    }
    if (poly) {
      // a big one, still told after
      poly.w = wi;
      cells.push(poly);
    }
  }
  return cells;
}

// wedges around the impact, cut in rings: shards pointing at the impact
function radial(solid, impact, { wedges, bands, branch }) {
  const a = impact.clone().normalize();
  const u = new THREE.Vector3().randomDirection().cross(a).normalize();
  const v = new THREE.Vector3().crossVectors(a, u);
  const around = (t) => u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
  // the plane of the crack at the angle t, facing the increasing angles
  const crack = (t) => new THREE.Vector3().crossVectors(a, around(t));
  const t0 = Math.random() * Math.PI * 2;
  const step = (Math.PI * 2) / wedges;
  const thetas = [];
  // some cracks don't run: two wedges as one, a big shard
  // (never two in a row: a wedge stays well under a half turn)
  let skipped = true;
  for (let i = 0; i < wedges; i++) {
    if (!skipped && Math.random() < SIZES.big) {
      skipped = true;
      continue;
    }
    skipped = false;
    thetas.push(t0 + (i + THREE.MathUtils.randFloatSpread(0.5)) * step);
  }

  const cells = [];
  for (let i = 0; i < thetas.length; i++) {
    const th0 = thetas[i], th1 = i + 1 < thetas.length ? thetas[i + 1] : thetas[0] + Math.PI * 2;
    let wedge = clip(solid, crack(th0).negate(), 0);
    if (wedge) wedge = clip(wedge, crack(th1), 0);
    if (!wedge) continue;
    // the rings, closer together near the impact, staggered from wedge to wedge;
    // a ring at the angle phi from the impact, its plane slightly tilted
    const mid = around((th0 + th1) / 2);
    const ring = (phi) =>
      a.clone().multiplyScalar(-Math.sin(phi)).addScaledVector(mid, Math.cos(phi))
        .add(new THREE.Vector3().randomDirection().multiplyScalar(0.1)).normalize();
    const phis = [];
    for (let k = 1; k < bands; k++) phis.push(Math.PI * 0.8 * Math.pow((k + THREE.MathUtils.randFloatSpread(0.6)) / bands, 1.4));
    phis.sort((x, y) => x - y);
    // and some rings are not cracked through, past the first
    for (let k = phis.length - 1; k > 0; k--) if (Math.random() < SIZES.big) phis.splice(k, 1);
    for (let k = 0; k <= phis.length; k++) {
      let piece = wedge;
      if (k > 0) piece = clip(piece, ring(phis[k - 1]).negate(), 0);
      if (piece && k < phis.length) piece = clip(piece, ring(phis[k]), 0);
      if (!piece) continue;
      // away from the impact, the cracks branch
      if (k > 0 && Math.random() < branch) {
        const n = crack(THREE.MathUtils.lerp(th0, th1, THREE.MathUtils.randFloat(0.3, 0.7)));
        const near = clip(piece, n, 0), far = clip(piece, n.clone().negate(), 0);
        if (near) cells.push(near);
        if (far) cells.push(far);
      } else cells.push(piece);
    }
  }
  return cells;
}

// the whole volume, before it breaks
// round: its edges rounded off, else sharp; wall: if hollow, how thick its
// shell is (see shell)
export function solidGeometry(shapeIndex, round = true, wall = 0) {
  const shape = SHAPES[shapeIndex];
  const body = shapeBody(shape, round);
  wall = shellWall(shape, body, wall);
  const solid = shapePolyhedron(shape);
  const faces = wall ? shell(solid, wall, shellPlanes(shape)).flat() : solid;
  return cellGeometry(faces, shape, body, null, {}, wall).geometry;
}

// the cells of the volume, each a geometry centered on its own middle. kind is
// the material, dir its direction (the grain of wood, the beds of stone...),
// view the direction toward the camera, wall: if hollow, how thick its wall
export function fracture(shapeIndex, impact, kind, dir, round = true, view = impact, wall = 0) {
  const shape = SHAPES[shapeIndex];
  const body = shapeBody(shape, round);
  wall = shellWall(shape, body, wall);
  const style = STYLES[kind] ?? STYLES.marble;
  const solid = shapePolyhedron(shape);
  let cells;
  // now and then, it breaks the other way it can
  const fanned = style.fanned && Math.random() < style.fanned.chance;
  if (style.radial && !fanned) cells = radial(solid, impact, style.radial);
  else {
    const { count, stretch = 1, planes = 0, bedding, slender, fan: wedges, planks, taper, edged = 0, slashed = 0 } = fanned ? style.fanned : style.voronoi;
    if (wedges) {
      const s = seeds(count, impact);
      cells = fan(solid, view, wedges).flatMap(({ poly, out, has }) => {
        const mine = s.filter(has);
        const parts = mine.length > 1 ? voronoi(poly, mine, out, stretch) : [poly];
        // the big ones split less: planks among the splinters
        const pieces = slender ? parts.flatMap((cell) => lengthwise(cell, out, cell.w ? slender * SIZES.plank : slender, planks, taper)) : parts;
        const blades = pieces.flatMap((q) => (Math.random() < edged ? edge(q, out) : [q]));
        return blades.flatMap((q) => (Math.random() < slashed ? slash(q, out) : [q]));
      });
      // the grain, for the roughness of the breaks: out from the axis
      const a = view.clone().normalize();
      const g = new THREE.Vector3();
      dir = (p) => {
        g.copy(p).addScaledVector(a, -p.dot(a));
        return g.lengthSq() > 1e-12 ? g.normalize() : null;
      };
    } else cells = voronoi(solid, seeds(count, impact), dir, stretch);
    // the cleavages
    for (let i = 0; i < planes; i++) {
      const n = bedding
        ? dir.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(0.15)).normalize()
        : new THREE.Vector3().randomDirection();
      const c = THREE.MathUtils.randFloatSpread(1);
      cells = cells.flatMap((cell) => [clip(cell, n, c), clip(cell, n.clone().negate(), -c)]).filter(Boolean);
    }
    if (slender && !wedges) cells = cells.flatMap((cell) => lengthwise(cell, dir, slender));
  }
  // some crumble, more near the impact; wood into splinters, along its grain
  const a = impact.clone().normalize();
  cells = cells.flatMap((cell) => {
    const near = THREE.MathUtils.smoothstep(middle(cell).normalize().dot(a), -0.2, 0.9);
    const p = THREE.MathUtils.lerp(SIZES.crumble, SIZES.crumbleNear, near);
    if (Math.random() >= p * (style.crumble ?? 1)) return [cell];
    // the grain there: the same everywhere, or fanned out from the middle (and
    // when fanned, the chips too stay long, along the fan)
    const grain = !style.grain && !fanned ? null : typeof dir === 'function' ? dir(middle(cell))?.clone() : dir;
    return crumble(cell, grain);
  });
  const warp = warper(style, dir, body, wall);
  const planes = wall && shellPlanes(shape);
  return cells
    .flatMap((poly) => (wall ? shell(poly, wall, planes) : hollow(poly)))
    .map((poly) => cellGeometry(poly, shape, body, warp, style, wall));
}

// the volume in about n wedges around the axis a, each with
// the direction out from the axis through its middle (out), and has(p): if p
// falls in it
function fan(solid, axis, n) {
  const a = axis.clone().normalize();
  const u = new THREE.Vector3().randomDirection().cross(a).normalize();
  const v = new THREE.Vector3().crossVectors(a, u);
  const around = (t) => u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
  const step = (Math.PI * 2) / n;
  const t0 = Math.random() * Math.PI * 2;
  const ts = [];
  // some cracks don't run: two wedges as one, its splinters wider apart
  // (never two in a row, the splinters would stray from the middle)
  let skipped = true;
  for (let i = 0; i < n; i++) {
    if (!skipped && Math.random() < SIZES.big) {
      skipped = true;
      continue;
    }
    skipped = false;
    ts.push(t0 + (i + THREE.MathUtils.randFloatSpread(0.6)) * step);
  }
  const out = [];
  for (let i = 0; i < ts.length; i++) {
    const t1 = ts[i], t2 = i + 1 < ts.length ? ts[i + 1] : ts[0] + Math.PI * 2;
    let poly = clip(solid, new THREE.Vector3().crossVectors(a, around(t1)).negate(), 0);
    if (poly) poly = clip(poly, new THREE.Vector3().crossVectors(a, around(t2)), 0);
    if (!poly) continue;
    const has = (p) => {
      let t = Math.atan2(p.dot(v), p.dot(u)) - t1;
      t -= Math.floor(t / (Math.PI * 2)) * Math.PI * 2;
      return t < t2 - t1;
    };
    out.push({ poly, out: around((t1 + t2) / 2), has });
  }
  return out;
}

function middle(poly) {
  const c = new THREE.Vector3();
  let n = 0;
  for (const f of poly) for (const p of f.pts) c.add(p), n++;
  return c.divideScalar(n);
}

// the cell broken into a few chips of uneven sizes, by planes across it, not
// through its middle; along dir if there is one
function crumble(poly, dir, depth = 0) {
  if (depth >= 2 || (depth > 0 && Math.random() < 0.3)) return [poly];
  const c = middle(poly);
  const n = new THREE.Vector3().randomDirection();
  if (dir) n.addScaledVector(dir, -n.dot(dir)).normalize();
  let lo = Infinity, hi = -Infinity;
  for (const f of poly) for (const p of f.pts) (lo = Math.min(lo, n.dot(p))), (hi = Math.max(hi, n.dot(p)));
  const at = n.dot(c) + THREE.MathUtils.randFloatSpread(0.7) * (hi - lo) / 2;
  return [clip(poly, n, at), clip(poly, n.clone().negate(), -at)].filter(Boolean).flatMap((q) => crumble(q, dir, depth + 1));
}

// the cell split along dir, again and again, across its widest, until it is a
// thin splinter; `stop`: how often a split is the last, a plank left;
// `taper`: how far aslant of dir the splits may run, the pieces narrowing
function lengthwise(poly, dir, width, stop = 0.15, taper = 0, depth = 0) {
  const c = new THREE.Vector3(), across = new THREE.Vector3();
  let n = 0;
  for (const f of poly) for (const p of f.pts) c.add(p), n++;
  c.divideScalar(n);
  let wide = 0;
  for (const f of poly)
    for (const p of f.pts) {
      const v = new THREE.Vector3().subVectors(p, c);
      v.addScaledVector(dir, -v.dot(dir));
      if (v.length() > wide) (wide = v.length()), across.copy(v);
    }
  // some stay whole: planks among the splinters
  if (depth >= 5 || 2 * wide < width || (depth > 0 && Math.random() < stop)) return [poly];
  // not quite across, not quite through the middle: splinters of uneven sizes
  across.normalize().add(new THREE.Vector3().randomDirection().multiplyScalar(0.3));
  across.addScaledVector(dir, -across.dot(dir)).normalize();
  if (taper) across.addScaledVector(dir, THREE.MathUtils.randFloatSpread(2 * taper)).normalize();
  const at = across.dot(c) + THREE.MathUtils.randFloatSpread(0.6) * wide;
  return [clip(poly, across, at), clip(poly, across.clone().negate(), -at)]
    .filter(Boolean)
    .flatMap((q) => lengthwise(q, dir, width, stop, taper, depth + 1));
}

// the piece cut along dir, across its section corner to corner: two blades of
// a three-sided section, each with a sharp edge
function edge(poly, dir) {
  const c = middle(poly);
  const up = c.clone().addScaledVector(dir, -c.dot(dir)).normalize();
  const side = new THREE.Vector3().crossVectors(dir, up);
  const ext = (d) => {
    let lo = Infinity, hi = -Infinity;
    for (const f of poly) for (const p of f.pts) (lo = Math.min(lo, p.dot(d))), (hi = Math.max(hi, p.dot(d)));
    return hi - lo;
  };
  const w = ext(side), t = ext(up);
  const n = side.multiplyScalar(t * (Math.random() < 0.5 ? 1 : -1)).addScaledVector(up, w).normalize();
  const at = n.dot(c);
  return [clip(poly, n, at), clip(poly, n.clone().negate(), -at)].filter(Boolean);
}

// the piece cut along its length, corner to corner more or less: two long
// blades, each narrowing to a point
function slash(poly, dir) {
  const side = new THREE.Vector3().randomDirection();
  side.addScaledVector(dir, -side.dot(dir)).normalize();
  const c = middle(poly);
  let lo = Infinity, hi = -Infinity, wlo = Infinity, whi = -Infinity;
  for (const f of poly)
    for (const p of f.pts) {
      const l = p.dot(dir), w = p.dot(side);
      (lo = Math.min(lo, l)), (hi = Math.max(hi, l)), (wlo = Math.min(wlo, w)), (whi = Math.max(whi, w));
    }
  const th = Math.atan2(whi - wlo, hi - lo) * THREE.MathUtils.randFloat(0.7, 1.1) * (Math.random() < 0.5 ? 1 : -1);
  const n = side.multiplyScalar(Math.cos(th)).addScaledVector(dir, -Math.sin(th));
  const at = n.dot(c);
  return [clip(poly, n, at), clip(poly, n.clone().negate(), -at)].filter(Boolean);
}

// the hollow in the core: the cell cut by a plane facing the center. A cell
// across the core (a splinter through the heart of the wood) is first split in
// two there, or the plane would take most of it.
function hollow(poly, depth = 0) {
  const c = new THREE.Vector3();
  let n = 0;
  for (const f of poly) for (const p of f.pts) c.add(p), n++;
  c.divideScalar(n);
  let far = c;
  for (const f of poly) for (const p of f.pts) if (p.distanceToSquared(c) > far.distanceToSquared(c)) far = p;
  if (depth < 3 && c.length() < far.distanceTo(c)) {
    const split = new THREE.Vector3().subVectors(far, c).normalize();
    return [clip(poly, split, 0), clip(poly, split.clone().negate(), 0)].filter(Boolean).flatMap((q) => hollow(q, depth + 1));
  }
  const cut = clip(poly, c.normalize().negate(), -HOLLOW);
  return cut ? [cut] : [];
}

// ---- the hollow volumes -------------------------------------------------------
// A hollow volume is a shell, its wall `wall` thick: what is less deep than
// that below its surface. Its inside follows its outside, the same shape
// shrunk, its edges sharp. A cell is cut along the inside in convex pieces, one
// per face of the polyhedron: where that face is the closest one, less deep
// than the wall below it (between the faces, the planes through their edges
// outside and inside). Where the shape is curved, its faces are below it by
// their sag: the inside is cut there farther out, touching its curve, so that
// the cracks do not reach into the hollow before they are brought onto it
// (see cellGeometry). The pieces of a cell that touch are put back together, the seams
// between them left out; those that do not (a splinter through the hollow,
// its two ends) fall apart.

// the wall, thin enough to leave room for the next volume inside
const shellWall = (shape, body, wall) => (wall ? Math.min(wall, body.surface(new THREE.Vector3()).t - HOLLOW * 0.95) : 0);

// The inside of the shell, for the shader of the glass to see it before it
// breaks (see materials.js): its kind (1: the planes n·x <= w, 2: a ball of
// radius size.x, 3: a cylinder of radius size.x, half height size.y), the
// planes of the outside (outer: their w), and the wall, as thin as it was made
export const SHELL_PLANES = 20;
export function shellShape(shapeIndex, wall) {
  const shape = SHAPES[shapeIndex];
  wall = shellWall(shape, shapeBody(shape, false), wall);
  const size = new THREE.Vector2();
  const planes = [];
  let kind = 1;
  if (shape.name === 'sphere') (kind = 2), size.set(1 - wall, 0);
  else if (shape.name === 'cylinder') (kind = 3), size.set(R_CYLINDER - wall, H_CYLINDER - wall);
  const outer = [];
  if (kind === 1)
    for (const q of shellPlanes(shape)) {
      planes.push(new THREE.Vector4(q.n.x, q.n.y, q.n.z, q.d - wall + q.sag));
      outer.push(q.d);
    }
  return { kind, planes, outer, size, wall };
}

// the planes of the faces of the shape, each with the planes across its edges,
// and how far below the curve of the shape it is at most (sag)
const shells = new Map();
function shellPlanes(shape) {
  if (shells.has(shape.name)) return shells.get(shape.name);
  const solid = shapePolyhedron(shape);
  const planes = facePlanes(solid);
  const { surface } = shapeBody(shape, false);
  for (const q of planes) q.sag = 0;
  for (const f of solid) {
    const [a, b, c] = f.pts;
    const at = [new THREE.Vector3().add(a).add(b).add(c).divideScalar(3), a.clone().lerp(b, 0.5), b.clone().lerp(c, 0.5), c.clone().lerp(a, 0.5)];
    for (const p of at) f.plane.sag = Math.max(f.plane.sag, surface(p).t);
  }
  const vkey = (p) => `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  const ekey = (a, b) => [vkey(a), vkey(b)].sort().join('|');
  const ends = new Map();
  for (const f of solid)
    f.pts.forEach((a, i) => {
      const k = ekey(a, f.pts[(i + 1) % f.pts.length]);
      if (!ends.has(k)) ends.set(k, []);
      ends.get(k).push(f.plane);
    });
  for (const q of planes) q.next = new Set();
  for (const qs of ends.values()) for (const a of qs) for (const b of qs) if (a !== b) a.next.add(planes.indexOf(b));
  shells.set(shape.name, planes);
  return planes;
}

// the cell cut along the inside: its parts that hold together, each a list of
// faces; those of the inside are told so (inner)
function shell(poly, wall, planes) {
  const pieces = [];
  planes.forEach((q, i) => {
    // how deep the inside is below the face: from 0 outside to 1 inside, it
    // must be less deep below it than below the others
    const wq = wall - q.sag;
    let piece = clip(poly, q.n.clone().negate(), wq - q.d, { cut: false, inner: true });
    for (const j of q.next) {
      if (!piece) break;
      const o = planes[j], wo = wall - o.sag;
      const n = new THREE.Vector3().copy(o.n).multiplyScalar(wq).addScaledVector(q.n, -wo);
      const l = n.length();
      piece = clip(piece, n.divideScalar(l), (o.d * wq - q.d * wo) / l, { cut: false, seam: j });
    }
    if (piece) pieces.push({ i, faces: piece, seams: new Set(piece.filter((f) => f.seam !== undefined).map((f) => f.seam)) });
  });
  // two pieces touch where both have their seam
  const group = pieces.map((_, k) => k);
  const root = (k) => (group[k] === k ? k : (group[k] = root(group[k])));
  const of = new Map(pieces.map((p, k) => [p.i, k]));
  pieces.forEach((p, k) => {
    for (const j of p.seams) if (of.has(j) && pieces[of.get(j)].seams.has(p.i)) group[root(k)] = root(of.get(j));
  });
  const parts = new Map();
  pieces.forEach((p, k) => {
    const r = root(k);
    if (!parts.has(r)) parts.set(r, []);
    parts.get(r).push(...p.faces.filter((f) => f.seam === undefined));
  });
  return [...parts.values()];
}

// ---- the roughness of the breaks ----------------------------------------------

// Perlin's improved noise, in [-1, 1] roughly
function perlin() {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (t, a, b) => a + t * (b - a);
  const grad = (h, x, y, z) => {
    h &= 15;
    const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  };
  return (x, y, z) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x), y -= Math.floor(y), z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z)),
        lerp(u, grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1)),
        lerp(u, grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1))));
  };
}

// The warp of the space, p -> p + D(p). On the surface of the volume D slides
// along it, so the volume keeps its shape and only the cracks waver; near the
// hollow too, so the fragments stay clear of the next volume. A shell (wall
// thick) keeps the shape of its inside the same way.
function warper(style, dir, body, wall = 0) {
  if (!style.warp) return null;
  const { warp, freq, octaves = 1, grain } = style;
  const noise = [perlin(), perlin(), perlin()];
  const reach = Math.max(0.06, warp * 1.4);
  // deeper than this, the surface is out of reach
  const { surface: curve, faces } = body;
  const inner = curve(new THREE.Vector3()).t - reach;
  const q = new THREE.Vector3();
  const fbm = (fn) => {
    let s = 0, a = 1, f = 1;
    for (let o = 0; o < octaves; o++, a *= 0.5, f *= 2.1) s += a * fn(q.x * f + o * 17.3, q.y * f, q.z * f);
    return s;
  };
  // D slides along the faces close to a depth t0 below the surface (the faces
  // of the outside, or of the inside of a shell): one per direction, so that
  // by an edge it slides along the edge
  const slide = (D, p, t0) => {
    const near = faces(p).map((f) => ({ n: f.n, t: Math.abs(f.t - t0) })).filter((f) => f.t < reach).sort((x, y) => x.t - y.t);
    // the normals made square to each other first: by an edge between
    // faces at an angle, nothing left across it
    const used = [];
    for (const f of near) {
      const e = f.n.clone();
      for (const u of used) e.addScaledVector(u, -e.dot(u));
      if (e.length() < 0.3) continue;
      e.normalize();
      used.push(e);
      D.addScaledVector(e, -(1 - THREE.MathUtils.smoothstep(f.t, 0, reach)) * D.dot(e));
    }
  };
  // at: where p is under the surface, if known (inner: on the inside of the
  // shell); the normal of the outside there after the warp is left in
  // warpTo.n, when close to the surface or the inside
  const warpTo = (p, at = null) => {
    warpTo.n = null;
    // the wood fibers: the noise is fine across the grain, long along it
    q.copy(p);
    // (fanned out from the middle, when the grain is)
    const g = grain && (typeof dir === 'function' ? dir(p) : dir);
    if (g) q.addScaledVector(g, -0.85 * p.dot(g));
    q.multiplyScalar(freq);
    const nx = fbm(noise[0]);
    const D = new THREE.Vector3(nx, fbm(noise[1]), fbm(noise[2])).multiplyScalar(warp);
    // torn fibers stick out along the grain, the splinters waver across it
    if (g) D.multiplyScalar(0.35).addScaledVector(g, warp * 2 * nx - D.dot(g));
    // slides along the surface: along the faces close by, one per direction,
    // so that by an edge it slides along the edge
    let onCurve = null, onInner = null;
    const known = at ?? (wall || p.length() > inner ? curve(p) : null);
    if (known && !at?.inner && known.t < reach) {
      const { t } = known;
      onCurve = { w: THREE.MathUtils.smoothstep(t, 0, reach), t };
      slide(D, p, 0);
    }
    if (wall && known && Math.abs(known.t - wall) < reach && (!at || at.inner)) {
      const { t } = known;
      onInner = { w: THREE.MathUtils.smoothstep(Math.abs(t - wall), 0, reach), t };
      slide(D, p, wall);
    }
    const r = p.length();
    if (r > 1e-6 && !wall) {
      const radial = p.clone().divideScalar(r);
      D.addScaledVector(radial, -(1 - THREE.MathUtils.smoothstep(r - HOLLOW, 0, reach)) * D.dot(radial));
    }
    D.add(p);
    // along the tangent it would leave the curve: back to the depth it had
    for (const on of [onCurve, onInner]) {
      if (!on) continue;
      const { t, n } = curve(D);
      D.addScaledVector(n, (t - on.t) * (1 - on.w));
      warpTo.n = n;
    }
    return D;
  };
  return warpTo;
}

// a convex polygon in small triangles, about h wide: rings around its middle,
// the outer one its edges, each cut in pieces about h long (only that one if
// single). An edge is cut the same way whichever face it borders: first where
// breaks(a, b) says (0 to 1 along it), then each part from p to q in pieces
// about edgeH(a, b, p, q) long.
// Each point is told the edge it is on, -1 inside.
function tessellate(pts, h, single = false, edgeH = () => h, breaks = () => []) {
  const c = new THREE.Vector3();
  for (const p of pts) c.add(p);
  c.divideScalar(pts.length);
  // the edge, and where each point of it is along it, from 0 to 1 around
  const edge = [], at = [], edgeOf = [];
  const lengths = pts.map((a, e) => a.distanceTo(pts[(e + 1) % pts.length]));
  const perimeter = lengths.reduce((x, y) => x + y, 0);
  let area = 0, run = 0;
  pts.forEach((a, e) => {
    const b = pts[(e + 1) % pts.length];
    const ts = [0, ...breaks(a, b), 1];
    for (let k = 0; k < ts.length - 1; k++) {
      const step = edgeH(a, b, ts[k] === 0 ? a : new THREE.Vector3().lerpVectors(a, b, ts[k]), ts[k + 1] === 1 ? b : new THREE.Vector3().lerpVectors(a, b, ts[k + 1]));
      const m = Math.max(1, Math.ceil(((ts[k + 1] - ts[k]) * lengths[e]) / step));
      for (let j = 0; j < m; j++) {
        const t = ts[k] + ((ts[k + 1] - ts[k]) * j) / m;
        edge.push(t === 0 ? a : new THREE.Vector3().lerpVectors(a, b, t));
        edgeOf.push(e);
        at.push((run + lengths[e] * t) / perimeter);
      }
    }
    run += lengths[e];
    area += new THREE.Vector3().subVectors(a, c).cross(new THREE.Vector3().subVectors(b, c)).length() / 2;
  });
  const pointAt = (t) => {
    let l = t * perimeter, e = 0;
    while (e < pts.length - 1 && l > lengths[e]) l -= lengths[e++];
    return new THREE.Vector3().lerpVectors(pts[e], pts[(e + 1) % pts.length], Math.min(l / lengths[e], 1));
  };

  const verts = [c], tris = [], on = [-1];
  // as many rings as fit across: the long polygons get long triangles
  const rows = single ? 1 : Math.max(1, Math.round((2 * area) / perimeter / h));
  let prev = null;
  for (let i = 1; i <= rows; i++) {
    let ring;
    if (i === rows) {
      ring = { ids: edge.map((p) => verts.push(p) - 1), at };
      on.push(...edgeOf);
    }
    else {
      const n = Math.max(3, Math.round((edge.length * i) / rows));
      ring = { ids: [], at: [] };
      for (let k = 0; k < n; k++) {
        ring.ids.push(verts.push(new THREE.Vector3().lerpVectors(c, pointAt(k / n), i / rows)) - 1);
        on.push(-1);
        ring.at.push(k / n);
      }
    }
    const B = ring.ids, nB = B.length;
    if (!prev) for (let k = 0; k < nB; k++) tris.push([0, B[k], B[(k + 1) % nB]]);
    else {
      // zip the two rings together
      const A = prev.ids, nA = A.length;
      const tA = (x) => (x < nA ? prev.at[x] : 1), tB = (y) => (y < nB ? ring.at[y] : 1);
      let x = 0, y = 0;
      while (x < nA || y < nB) {
        if (y < nB && (x >= nA || tB(y + 1) <= tA(x + 1))) tris.push([A[x % nA], B[y], B[++y % nB]]);
        else tris.push([A[x], B[y % nB], A[++x % nA]]);
      }
    }
    prev = ring;
  }
  return { verts, tris, on };
}

function cellGeometry(faces, shape, body, warp = null, style = {}, wall = 0) {
  const center = new THREE.Vector3();
  let n = 0;
  for (const f of faces) for (const p of f.pts) center.add(p), n++;
  center.divideScalar(n);

  const position = [], normal = [], rest = [], cut = [];
  const push = (p, nrm, c) => {
    position.push(p.x - center.x, p.y - center.y, p.z - center.z);
    rest.push(p.x, p.y, p.z);
    normal.push(nrm.x, nrm.y, nrm.z);
    cut.push(c);
  };
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const triNormal = (a, b, c) => e1.subVectors(b, a).cross(e2.subVectors(c, a));
  // the outside, on the true body of the shape (see shapeBody): its faces cut
  // in strips along the edges, or all in small triangles where curved. Its
  // edges are cut so on whichever face they border, and the points of a crack
  // on them moved onto the body too.
  const vkey = (p) => (p.key ??= `${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`);
  const key = (a, b) => (vkey(a) < vkey(b) ? vkey(a) + '|' + vkey(b) : vkey(b) + '|' + vkey(a));
  // the edges of the outside, and the strips of the face they are on
  const outerEdges = new Map();
  // and those of the inside of a shell
  const innerEdges = new Set();
  const pieces = [];
  for (const f of faces) {
    if (f.inner) {
      pieces.push({ f, pts: f.pts });
      f.pts.forEach((a, i) => innerEdges.add(key(a, f.pts[(i + 1) % f.pts.length])));
      continue;
    }
    if (f.cut) {
      pieces.push({ f, pts: f.pts });
      continue;
    }
    // an edge between two faces: cut by the strips of both
    const strips = body.strips(f);
    f.pts.forEach((a, i) => {
      const k = key(a, f.pts[(i + 1) % f.pts.length]);
      const e = outerEdges.get(k);
      outerEdges.set(k, e ? { strips: [...new Set([...e.strips, ...strips])] } : { strips });
    });
    for (const pts of splitPolygon(f.pts, strips)) pieces.push({ f, pts, strips });
  }
  // a piece of a face: its edges along the face's as those, the others (along
  // the strips) long
  const _u = new THREE.Vector3(), _v = new THREE.Vector3();
  const onEdge = (p, a, b) => _u.subVectors(b, a).cross(_v.subVectors(p, a)).lengthSq() < 1e-14 * _u.lengthSq();
  // the face's edge a piece's edge lies along, if any
  const along = (f, a, b) => {
    for (let i = 0; i < f.pts.length; i++) {
      const u = f.pts[i], w = f.pts[(i + 1) % f.pts.length];
      if (onEdge(a, u, w) && onEdge(b, u, w)) return outerEdges.get(key(u, w));
    }
    return null;
  };
  // An edge of the outside in small pieces where it bends on the body (around
  // the sphere, the rims of the cylinder, the corners); else as fine as the
  // cracks along it, or long (the strips, straight).
  const bends = (p, q) => {
    const m = new THREE.Vector3().addVectors(p, q).multiplyScalar(0.5);
    return body.project(m).distanceTo(body.project(p).add(body.project(q)).multiplyScalar(0.5)) > 2e-4;
  };
  // the inside: the surface of the shape wall deep, its normal facing in
  const placeInner = (p) => {
    const { t, n } = body.surface(p);
    return { p: p.clone().addScaledVector(n, t - wall), n };
  };
  const projectInner = (p) => placeInner(p).p;
  const bendsInner = (p, q) => {
    const m = new THREE.Vector3().addVectors(p, q).multiplyScalar(0.5);
    return projectInner(m).distanceTo(projectInner(p).add(projectInner(q)).multiplyScalar(0.5)) > 2e-4;
  };
  // flat where the shape is, else smooth
  const innerNormal = (p, f, n) => (shape.sharp ? shape.sharp(p, f.n.clone().negate()).clone() : n.clone()).negate();
  const crackH = style.detail ?? 1;
  const pieceH = (f) => (a, b, p, q) => (bends(p, q) ? CURVE_DETAIL : along(f, a, b) ? crackH : 0.25);
  const pieceBreaks = (f, strips) => (a, b) => crossings(a, b, along(f, a, b)?.strips ?? strips);
  const outerBreaks = (a, b) => {
    const e = outerEdges.get(key(a, b));
    return e ? crossings(a, b, e.strips) : [];
  };
  const cutH = (a, b, p, q) =>
    (outerEdges.has(key(a, b)) && bends(p, q)) || (innerEdges.has(key(a, b)) && bendsInner(p, q)) ? CURVE_DETAIL : crackH;
  const innerH = (a, b, p, q) => (bendsInner(p, q) ? CURVE_DETAIL : crackH);
  for (const { f, pts, strips } of pieces) {
    let verts, tris, on, placed;
    if (f.inner) {
      ({ verts, tris } = tessellate(pts, CURVE_DETAIL, !shape.fine?.(f.n), innerH));
      placed = verts.map(placeInner);
      verts = placed.map((x) => x.p);
    } else if (!f.cut) {
      const fine = shape.fine?.(f.n);
      ({ verts, tris } = tessellate(pts, CURVE_DETAIL, !fine, pieceH(f), pieceBreaks(f, strips)));
      placed = verts.map(body.place);
      verts = placed.map((x) => x.p);
    } else {
      // the cuts stay flat, their edges only waver with the cracks
      ({ verts, tris, on } = tessellate(pts, crackH, false, cutH, outerBreaks));
      const outer = pts.map((a, e) => outerEdges.has(key(a, pts[(e + 1) % pts.length])));
      const inside = pts.map((a, e) => innerEdges.has(key(a, pts[(e + 1) % pts.length])));
      verts = verts.map((p, i) => (on[i] >= 0 && outer[on[i]] ? body.project(p) : on[i] >= 0 && inside[on[i]] ? projectInner(p) : p));
    }
    // the winding follows the face's normal
    tris = tris.filter((t) => {
      const e = triNormal(verts[t[0]], verts[t[1]], verts[t[2]]);
      if (e.lengthSq() < 1e-14) return false;
      if (e.dot(f.n) < 0) t.reverse();
      return true;
    });
    if (f.inner) {
      const moved = [], normals = [];
      verts.forEach((p, i) => {
        const q = warp ? warp(p, { t: wall, n: placed[i].n, inner: true }) : p;
        moved.push(q);
        normals.push(innerNormal(q, f, warp?.n ?? placed[i].n));
      });
      for (const t of tris) for (const i of t) push(moved[i], normals[i], 0);
      continue;
    }
    if (!f.cut) {
      // on the surface: the normals come with the points
      const moved = [], normals = [];
      verts.forEach((p, i) => {
        const q = warp ? warp(p, { t: 0, n: placed[i].n }) : p;
        moved.push(q);
        normals.push(body.normal(q, f, warp?.n ?? placed[i].n));
      });
      for (const t of tris) for (const i of t) push(moved[i], normals[i], 0);
      continue;
    }
    const moved = warp ? verts.map((p) => warp(p)) : verts;
    if (!warp) {
      for (const t of tris) for (const i of t) push(moved[i], f.n, 1);
    } else if (style.facets) {
      for (const t of tris) {
        const nrm = triNormal(moved[t[0]], moved[t[1]], moved[t[2]]).normalize();
        for (const i of t) push(moved[i], nrm, 1);
      }
    } else {
      // smooth: the normals of the triangles around each point
      const acc = moved.map(() => new THREE.Vector3());
      for (const t of tris) {
        const nrm = triNormal(moved[t[0]], moved[t[1]], moved[t[2]]);
        for (const i of t) acc[i].add(nrm);
      }
      for (const t of tris) for (const i of t) push(moved[i], acc[i].normalize(), 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  g.setAttribute('rest', new THREE.Float32BufferAttribute(rest, 3));
  g.setAttribute('cut', new THREE.Float32BufferAttribute(cut, 1));
  g.computeBoundingSphere();
  return { geometry: g, center, volume: approxVolume(faces, center) };
}

// for the size of the pieces: how fast they spin, how far they fly
function approxVolume(faces, c) {
  let v = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  for (const f of faces)
    for (let i = 1; i < f.pts.length - 1; i++) {
      a.subVectors(f.pts[i], f.pts[0]);
      b.subVectors(f.pts[i + 1], f.pts[0]);
      v += Math.abs(a.cross(b).dot(new THREE.Vector3().subVectors(f.pts[0], c))) / 6;
    }
  return v;
}
