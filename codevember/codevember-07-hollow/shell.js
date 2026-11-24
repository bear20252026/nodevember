import { rng, noise3 } from './noise.js';

// The hollow shell, cut along seams. A fine mesh of its outside (a sphere,
// or another shape: see shapes.js) carries a noise; the seams run where it crosses a threshold, a
// band of about the same width all along (the noise is divided by its slope:
// the distance to the seam, more or less). The triangles are clipped along
// both sides of the band, each side keeping its own points on the contour, so
// that the sphere falls apart into the regions between the seams: the parts,
// their corners rounded where seams cross.
// Each part is a piece of shell: its outside on the surface, its inside a wall
// thickness in (along the normals), and the walls of the seams between them,
// from one to the other. Where the surface itself is open (a model with holes)
// its edges are walled as the seams are. Plain arrays, no three.js: the parts
// are built into meshes in main.js.

// The seams: at the point p of the surface (in radii), its normal n, the
// signed distance to the middle of the nearest seam (about), and the half
// width of the seam there.
//   freq       how close together the seams run (the size of the parts)
//   threshold  where the noise is cut, -1 to 1: away from 0, the parts on
//              one side get smaller, rounder, islands among the others
//   seam       the width of the seams, wall the thickness of the shell
//   wobble     how much the width of a seam varies along it (0: even)
//   round      the radius of the corners where seams cross (default: from
//              the brass, so that its lips go around them)
//   layers     how many noises: the seams of each cross those of the others
//   border     the brass along the seams: its thickness, and how far its
//              lips come over the faces of the marble (0: no brass)
export const DEFAULTS = { seed: 1, radius: 1, wall: 0.045, seam: 0.04, border: 0.006, lip: 0.017, freq: 1.1, threshold: 0, octaves: 2, wobble: 0.5, layers: 2, detail: 7 };

export function seamField(o) {
  const r = rng(o.seed);
  const n = noise3(o.seed), m = noise3(o.seed + 101);
  // the noise is moved off the lattice (whose points it is 0 at)
  const off = [r() * 100, r() * 100, r() * 100];
  const value = (x, y, z) => {
    let s = 0, a = 1, f = o.freq;
    for (let i = 0; i < o.octaves; i++) {
      s += a * n(x * f + off[0] + i * 31.7, y * f + off[1], z * f + off[2]);
      a *= 0.45;
      f *= 2.1;
    }
    return s * 1.8;
  };
  const e = 1e-3;
  return (x, y, z, nx, ny, nz) => {
    const v = value(x, y, z) - o.threshold;
    // the slope along the surface: the gradient less its part along n
    let gx = (value(x + e, y, z) - value(x - e, y, z)) / (2 * e);
    let gy = (value(x, y + e, z) - value(x, y - e, z)) / (2 * e);
    let gz = (value(x, y, z + e) - value(x, y, z - e)) / (2 * e);
    const k = gx * nx + gy * ny + gz * nz;
    gx -= k * nx; gy -= k * ny; gz -= k * nz;
    // where the noise is flat (a peak, a pass) the distance is unreliable;
    // there it is far from the seams anyway, unless the threshold is there
    const slope = Math.max(Math.hypot(gx, gy, gz), 0.6 * o.freq);
    const width = (o.seam / o.radius) * 0.5 * (1 + o.wobble * 0.8 * m(x * 2.3 + 7, y * 2.3, z * 2.3));
    return [v / slope, Math.max(width, 0.002)];
  };
}

// the shell of a surface (see shapes.js), made at o.radius and o.detail.
// The seams, the wall and the brass are those of the sphere, set to the size
// of the surface (`size`, see shapes.js): a head or a bunny, smaller than the
// sphere they fit in, is cut into as many parts as it, as thin.
export function hollowShell(surface, options = {}) {
  const o = { ...DEFAULTS, ...options };
  const k = (surface.size ?? o.radius) / o.radius;
  o.freq /= k;
  for (const key of ['seam', 'wall', 'border', 'lip', 'round']) if (o[key] !== undefined) o[key] *= k;
  o.minArea = (o.minArea ?? 0.006) * k * k;
  const { pos: pts, nrm, tris, project, room } = surface;
  const R = o.radius;
  // one field per layer, each its own noise
  const fields = Array.from({ length: o.layers }, (_, l) => seamField({ ...o, seed: o.seed + l * 7717 }));
  const count = pts.length / 3;
  // per layer, at each point: the distance to the seam, its half width
  const F = fields.map(() => []), H = fields.map(() => []);
  for (let i = 0; i < count; i++) {
    fields.forEach((field, l) => {
      const [f, h] = field(pts[i * 3] / R, pts[i * 3 + 1] / R, pts[i * 3 + 2] / R, nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]);
      F[l].push(f);
      H[l].push(h);
    });
  }

  // The regions between the seams: one per side of each layer's seam, the
  // points on all the chosen sides. How far a point is inside one: the
  // nearest of its sides' edges, but where two seams cross, the corner
  // rounded, a fillet of radius `round` (as a rounded intersection of
  // distance fields), so that no part ends in a sharp tip the brass can't
  // follow. By default the fillet is wide enough for the brass's lips.
  const round = (o.round ?? (o.lip + o.border) * 3) / o.radius;
  const inside = (pattern, i) => {
    let g = Infinity;
    for (let l = 0; l < fields.length; l++) {
      const a = ((pattern >> l) & 1 ? -1 : 1) * F[l][i] - H[l][i];
      if (g === Infinity) g = a;
      else {
        const u = Math.max(round - g, 0), v = Math.max(round - a, 0);
        g = Math.max(round, Math.min(g, a)) - Math.hypot(u, v);
      }
    }
    return g;
  };
  const patterns = 1 << fields.length;
  const G = Array.from({ length: patterns }, (_, p) => Float64Array.from({ length: count }, (_, i) => inside(p, i)));

  // the edges of the surface itself, where it is open: on one triangle only
  const sides = new Map();
  for (let f = 0; f < tris.length; f += 3) for (let k = 0; k < 3; k++) {
    const a = tris[f + k], b = tris[f + (k + 1) % 3];
    const key = a < b ? a * 1e7 + b : b * 1e7 + a;
    sides.set(key, (sides.get(key) ?? 0) + 1);
  }
  const open = (a, b) => sides.get(a < b ? a * 1e7 + b : b * 1e7 + a) === 1;

  // the points: those of the surface, then those on the contours, and their
  // normals
  const P = [...pts], N = [...nrm];
  // the thickness of the wall at each point: the same all over, or less
  // where the surface has no room for it
  const W = room ? room.map((r) => Math.min(o.wall, r)) : new Array(pts.length / 3).fill(o.wall);
  const contour = new Map();
  // the point of the edge i → j on the contour of a region, i inside: the
  // same for the triangles on both sides of the edge
  const cross = (p, i, j) => {
    const key = `${p}:${i}:${j}`;
    let k = contour.get(key);
    if (k === undefined) {
      const t = G[p][i] / (G[p][i] - G[p][j]);
      const at = (A, k) => A[i * 3 + k] + (A[j * 3 + k] - A[i * 3 + k]) * t;
      const x = at(P, 0), y = at(P, 1), z = at(P, 2);
      let nx = at(N, 0), ny = at(N, 1), nz = at(N, 2);
      const len = Math.hypot(nx, ny, nz) || 1;
      // back on the surface, where it is known
      const q = project ? project(x, y, z) : [x, y, z, nx / len, ny / len, nz / len];
      P.push(q[0], q[1], q[2]);
      N.push(q[3], q[4], q[5]);
      W.push(W[i] + (W[j] - W[i]) * t);
      k = P.length / 3 - 1;
      contour.set(key, k);
    }
    return k;
  };
  // a triangle clipped to a region: what is kept, its points, and for each
  // whether the edge from it to the next runs along a seam (or along an
  // open edge of the surface)
  const clip = (tri, p) => {
    const a = tri.map((i) => G[p][i]);
    if (a.every((v) => v <= 0)) return null;
    if (a.every((v) => v > 0)) return { ids: tri, seam: tri.map((i, k) => open(i, tri[(k + 1) % 3])) };
    const ids = [], seam = [];
    for (let k = 0; k < 3; k++) {
      const i = tri[k], j = tri[(k + 1) % 3];
      const inI = a[k] > 0, inJ = a[(k + 1) % 3] > 0;
      if (inI) {
        ids.push(i);
        seam.push(open(i, j));
      }
      if (inI && !inJ) {
        // it leaves: from there the contour, to where it comes back in
        ids.push(cross(p, i, j));
        seam.push(true);
      }
      if (!inI && inJ) {
        ids.push(cross(p, j, i));
        seam.push(open(i, j));
      }
    }
    return { ids, seam };
  };
  const polys = [], edges = [];
  for (let f = 0; f < tris.length; f += 3) {
    const tri = [tris[f], tris[f + 1], tris[f + 2]];
    for (let p = 0; p < patterns; p++) {
      const c = clip(tri, p);
      if (!c) continue;
      const { ids, seam } = c;
      polys.push(ids);
      // the walls: the edges along a seam, the inside on their left
      seam.forEach((s, k) => s && edges.push([ids[k], ids[(k + 1) % ids.length]]));
    }
  }

  // the parts: the polygons that share points
  const total = P.length / 3;
  const parent = new Int32Array(total).map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) i = parent[i] = parent[parent[i]];
    return i;
  };
  for (const poly of polys) for (let k = 1; k < poly.length; k++) parent[find(poly[k])] = find(poly[0]);

  const groups = new Map();
  const group = (i) => {
    const root = find(i);
    let g = groups.get(root);
    if (!g) groups.set(root, (g = { polys: [], edges: [] }));
    return g;
  };
  for (const poly of polys) group(poly[0]).polys.push(poly);
  for (const e of edges) group(e[0]).edges.push(e);

  const parts = [];
  for (const g of groups.values()) {
    const part = buildPart(g, P, N, W, o);
    if (part.area >= o.minArea * R * R) parts.push(part);
  }
  // the biggest first
  parts.sort((a, b) => b.area - a.area);
  return { parts, options: o };
}

// a part as arrays: the outside, the inside, the walls along the seams. The
// points relative to its center; `rest` where they are in the shell (the
// marble's pattern is drawn there), `cut` 1 on the faces that were not
// polished: the inside and the walls of the seams, `depth` how far in the
// wall, 0 outside, 1 inside
function buildPart({ polys, edges }, P, N, W, o) {
  const normal = [], rest = [], cut = [], depth = [], index = [];
  const local = new Map();
  let area = 0;
  const vertex = (x, y, z, nx, ny, nz, c, d) => {
    rest.push(x, y, z);
    normal.push(nx, ny, nz);
    cut.push(c);
    depth.push(d);
    return rest.length / 3 - 1;
  };
  // the outside and the inside share the points of the surface: each point once
  const point = (i) => {
    let v = local.get(i);
    if (v === undefined) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], w = W[i];
      v = vertex(x, y, z, nx, ny, nz, 0, 0);
      vertex(x - nx * w, y - ny * w, z - nz * w, -nx, -ny, -nz, 1, 1);
      local.set(i, v);
    }
    return v;
  };
  for (const poly of polys) {
    const v = poly.map(point);
    for (let k = 1; k < v.length - 1; k++) {
      index.push(v[0], v[k], v[k + 1]);
      index.push(v[0] + 1, v[k + 1] + 1, v[k] + 1);
      area += triArea(P, poly[0], poly[k], poly[k + 1]);
    }
  }
  // the walls: each segment of the contour a quad from the outside to the
  // inside, facing out of the part, on its right. Their normals are smoothed
  // along the contour: the average of the segments at each point
  const wallNormal = new Map();
  const segs = edges.map(([a, b]) => {
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const bx = P[b * 3], by = P[b * 3 + 1], bz = P[b * 3 + 2];
    const mx = N[a * 3] + N[b * 3], my = N[a * 3 + 1] + N[b * 3 + 1], mz = N[a * 3 + 2] + N[b * 3 + 2];
    // (b - a) × the normal
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    let nx = dy * mz - dz * my, ny = dz * mx - dx * mz, nz = dx * my - dy * mx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const i of [a, b]) {
      const n = wallNormal.get(i) ?? [0, 0, 0];
      n[0] += nx; n[1] += ny; n[2] += nz;
      wallNormal.set(i, n);
    }
    return [a, b, nx, ny, nz];
  });
  const wallPoint = new Map();
  const wall = (i) => {
    let v = wallPoint.get(i);
    if (v === undefined) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2], w = W[i];
      const n = wallNormal.get(i);
      const l = Math.hypot(...n) || 1;
      v = vertex(x, y, z, n[0] / l, n[1] / l, n[2] / l, 1, 0);
      vertex(x - nx * w, y - ny * w, z - nz * w, n[0] / l, n[1] / l, n[2] / l, 1, 1);
      wallPoint.set(i, v);
    }
    return v;
  };
  for (const [a, b] of segs) {
    const va = wall(a), vb = wall(b);
    // seen from the right of a → b, with the outside up: a out, b out, b in, a in
    index.push(va, va + 1, vb + 1, va, vb + 1, vb);
  }

  // the center: the middle of the outside points, the points relative to it
  const count = rest.length / 3;
  const center = [0, 0, 0];
  for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) center[k] += rest[i * 3 + k] / count;
  const pos = new Float32Array(rest.length);
  for (let i = 0; i < rest.length; i++) pos[i] = rest[i] - center[i % 3];
  return {
    center,
    area,
    position: pos,
    normal: new Float32Array(normal),
    rest: new Float32Array(rest),
    cut: new Float32Array(cut),
    depth: new Float32Array(depth),
    index: count > 65535 ? new Uint32Array(index) : new Uint16Array(index),
    border: o.border > 0 && segs.length ? buildBorder(segs, wallNormal, P, N, W, o, center) : null,
  };
}

// The brass along the seams of a part: a channel that caps the edge of the
// shell, its lips over the outside and the inside, its back over the wall of
// the seam, the corners rounded. Its profile is swept along the contour, in
// the plane of the surface's normal (up) and of the wall's normal (out, into
// the seam). Up is measured from the outside, R, the inside at r: where the
// wall is thinner, the inner half of the profile goes up as much.
function buildBorder(segs, wallNormal, P, N, W, o, center) {
  const R = 0, r = -o.wall, t = o.border, w = o.lip;
  // the profile: [up, out] and its normal [up, out], from the end of the
  // outside lip, over the edge, down the wall, to the end of the inside lip
  const prof = [];
  let inner = 0;
  const add = (u, s, nu, ns) => prof.push([u, s, nu, ns, inner]);
  const ARC = 6;
  // the end of the outside lip, bevelled (its points doubled: a sharp edge)
  const bev = Math.SQRT1_2;
  add(R, -w - t * 0.8, bev, -bev);
  add(R + t, -w, bev, -bev);
  add(R + t, -w, 1, 0);
  // around the outer edge of the marble, then down the wall
  for (let k = 0; k <= ARC; k++) {
    const a = (k / ARC) * Math.PI / 2;
    add(R + t * Math.cos(a), t * Math.sin(a), Math.cos(a), Math.sin(a));
  }
  // around the inner edge, then the inside lip
  inner = 1;
  for (let k = 0; k <= ARC; k++) {
    const a = Math.PI / 2 + (k / ARC) * Math.PI / 2;
    add(r + t * Math.cos(a), t * Math.sin(a), Math.cos(a), Math.sin(a));
  }
  add(r - t, -w, -1, 0);
  add(r - t, -w, -bev, -bev);
  add(r, -w - t * 0.8, -bev, -bev);
  const np = prof.length;

  // at each point of the contour, the out direction, longer at the corners
  // (mitred, a little: at the sharp ones the lips would cross)
  const segNormals = new Map();
  for (const [a, b, nx, ny, nz] of segs) for (const i of [a, b]) {
    if (!segNormals.has(i)) segNormals.set(i, []);
    segNormals.get(i).push([nx, ny, nz]);
  }
  const position = [], normal = [], rest = [], depth = [], index = [];
  const ring = new Map();
  const ringOf = (i) => {
    let v = ring.get(i);
    if (v !== undefined) return v;
    v = rest.length / 3;
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    const dx = N[i * 3], dy = N[i * 3 + 1], dz = N[i * 3 + 2];
    const n = wallNormal.get(i);
    const l = Math.hypot(...n) || 1;
    const nx = n[0] / l, ny = n[1] / l, nz = n[2] / l;
    const cos = Math.min(...segNormals.get(i).map((m) => m[0] * nx + m[1] * ny + m[2] * nz));
    const miter = 1 / Math.max(cos, 0.85);
    const lift = o.wall - W[i];
    for (const [u0, s, nu, ns, inside] of prof) {
      const u = u0 + inside * lift;
      const k = s * miter;
      const x = px + dx * u + nx * k, y = py + dy * u + ny * k, z = pz + dz * u + nz * k;
      rest.push(x, y, z);
      depth.push(-u / W[i]);
      position.push(x - center[0], y - center[1], z - center[2]);
      const m = Math.hypot(nu, ns);
      normal.push((dx * nu + nx * ns) / m, (dy * nu + ny * ns) / m, (dz * nu + nz * ns) / m);
    }
    ring.set(i, v);
    return v;
  };
  for (const [a, b] of segs) {
    const va = ringOf(a), vb = ringOf(b);
    // as the walls: seen from the seam, the profile going down, a k, a k+1, b k+1
    for (let k = 0; k < np - 1; k++) index.push(va + k, va + k + 1, vb + k + 1, va + k, vb + k + 1, vb + k);
  }
  const count = rest.length / 3;
  return {
    position: new Float32Array(position),
    normal: new Float32Array(normal),
    rest: new Float32Array(rest),
    depth: new Float32Array(depth),
    index: count > 65535 ? new Uint32Array(index) : new Uint16Array(index),
  };
}

function triArea(P, a, b, c) {
  const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
  const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
  return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
}

// Which part a ray meets first, the parts at their place in the shell: its
// outside, or from within the hollow, its inside (a wall in). The points of
// the outsides, with their normals, in a grid of cells a little wider than
// the wall; the ray walked in steps, at each the nearest of these points
// tells on which side of the surface it is, and how deep. Any shape, not only
// the sphere; cheaper than casting a ray through all the triangles each frame.
// Returns (origin, direction, skip) → { id, t } or null, `skip` the parts to
// see through (those not at their place), a Set of ids.
export function partCaster(parts, o) {
  const cell = Math.max(0.06 * o.radius, 1.5 * o.wall), stepLen = cell / 4;
  const K = 1 << 10, M = 1 << 11;
  const key = (x, y, z) => ((Math.floor(x / cell) + K) * M + Math.floor(y / cell) + K) * M + Math.floor(z / cell) + K;
  const grid = new Map();
  let bound = 0;
  parts.forEach((part, id) => {
    const { rest, normal, cut } = part;
    for (let i = 0; i < cut.length; i++) {
      if (cut[i] !== 0) continue;
      const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2];
      bound = Math.max(bound, Math.hypot(x, y, z));
      const k = key(x, y, z);
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(x, y, z, normal[i * 3], normal[i * 3 + 1], normal[i * 3 + 2], id);
    }
  });
  bound += cell;
  // in the material: just under the outside, down to a wall in
  const deep = o.wall + stepLen;
  return ([ox, oy, oz], [dx, dy, dz], skip) => {
    // the ray within the bounds of the shape
    const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz;
    const disc = b * b - c + bound * bound;
    if (disc <= 0) return null;
    const end = -b + Math.sqrt(disc);
    for (let t = Math.max(-b - Math.sqrt(disc), 0); t < end; t += stepLen) {
      const x = ox + dx * t, y = oy + dy * t, z = oz + dz * t;
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell), cz = Math.floor(z / cell);
      let best = -1, d2 = Infinity, side = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const g = grid.get(((cx + i + K) * M + cy + j + K) * M + cz + k + K);
        if (!g) continue;
        for (let m = 0; m < g.length; m += 7) {
          if (skip?.has(g[m + 6])) continue;
          const ex = x - g[m], ey = y - g[m + 1], ez = z - g[m + 2];
          const d = ex * ex + ey * ey + ez * ez;
          if (d < d2) {
            d2 = d;
            best = g[m + 6];
            side = ex * g[m + 3] + ey * g[m + 4] + ez * g[m + 5];
          }
        }
      }
      if (best >= 0 && side <= 0 && d2 < deep * deep) return { id: best, t };
    }
    return null;
  };
}
