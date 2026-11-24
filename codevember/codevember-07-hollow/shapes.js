// The shapes the shell can be made of: a fine mesh of the outside surface,
// its points, their normals (out), its triangles counterclockwise seen from
// outside, and for the shapes known exactly, `project`, which puts a point
// back on the surface (the seams' points, cut on the triangles' edges). The
// models also tell, at each point, how thick the wall can be there: `room`,
// so that in their hollows (a nostril, an ear) the inside does not come out
// through the outside.
// All fitted in the unit sphere, then scaled to the radius; the models, which
// fill their sphere less than the sphere does (a head is flat, a bunny squat),
// by `scale` more, so that they take about as much room in the picture.
// Plain arrays, no three.js.

export const SHAPES = {
  sphere: { label: 'Sphere', make: sphere },
  cube: { label: 'Cube', make: cube },
  'lee-perry-smith': { label: 'Lee Perry-Smith', url: new URL('./models/lee-perry-smith.bin', import.meta.url), upright: true, scale: 1.3 },
  bunny: { label: 'Bunny', url: new URL('./models/bunny.bin', import.meta.url), upright: true, scale: 1.3 },
};

// how many triangles at most, for the detail asked: as many as the icosphere's
// (7: 330 000)
const budget = (detail) => 20 * 4 ** detail * 1.1;

const cache = new Map();
export async function loadShape(name, { radius = 1, detail = 7 } = {}) {
  const key = `${name}:${radius}:${detail}`;
  if (cache.has(key)) return cache.get(key);
  const s = SHAPES[name];
  let surface;
  if (s.make) surface = s.make(radius, detail);
  else {
    const buf = await (await fetch(s.url)).arrayBuffer();
    surface = fromMesh(...decode(buf), radius * (s.scale ?? 1), detail);
  }
  // its size: the radius of the sphere of the same area, which the seams and
  // the wall are set to (the sphere's own, the cube's a little less, the
  // models' about 0.6 of the sphere they fit in)
  let area = 0;
  const { pos, tris } = surface;
  for (let i = 0; i < tris.length; i += 3) {
    const a = tris[i] * 3, b = tris[i + 1] * 3, c = tris[i + 2] * 3;
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const v = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    area += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  }
  surface.size = Math.sqrt(area / (4 * Math.PI));
  cache.set(key, surface);
  return surface;
}

// an icosphere: the icosahedron, each triangle cut in 4, `level` times; the
// points on the unit sphere, the triangles counterclockwise seen from outside
export function icosphere(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  const pts = [];
  const add = (x, y, z) => {
    const l = Math.hypot(x, y, z);
    pts.push(x / l, y / l, z / l);
    return pts.length / 3 - 1;
  };
  [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]]
    .forEach((p) => add(...p));
  let tris = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8,
    3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  for (let l = 0; l < level; l++) {
    const next = [];
    const half = midpoints(pts, (a, b) => add(pts[a * 3] + pts[b * 3], pts[a * 3 + 1] + pts[b * 3 + 1], pts[a * 3 + 2] + pts[b * 3 + 2]));
    for (let i = 0; i < tris.length; i += 3) split(tris[i], tris[i + 1], tris[i + 2], half, next);
    tris = next;
  }
  return { pts, tris };
}

// the middle of each edge once, shared by the triangles on both sides
function midpoints(pts, make) {
  const mid = new Map();
  return (a, b) => {
    const key = a < b ? a * 1e7 + b : b * 1e7 + a;
    let m = mid.get(key);
    if (m === undefined) mid.set(key, (m = make(a, b)));
    return m;
  };
}
function split(a, b, c, half, out) {
  const ab = half(a, b), bc = half(b, c), ca = half(c, a);
  out.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
}

function sphere(R, detail) {
  const { pts, tris } = icosphere(detail);
  return {
    pos: pts.map((v) => v * R),
    nrm: pts,
    tris,
    project(x, y, z) {
      const l = Math.hypot(x, y, z);
      return [x / l * R, y / l * R, z / l * R, x / l, y / l, z / l];
    },
  };
}

// a cube, its edges and corners rounded (the brass could not follow a sharp
// edge, nor the wall go in along it): the closest point of a smaller box,
// pushed out by the rounding
function cube(R, detail) {
  const s = 0.62 * R, rr = 0.15 * R, h = s - rr;
  const project = (x, y, z) => {
    const qx = Math.max(-h, Math.min(h, x)), qy = Math.max(-h, Math.min(h, y)), qz = Math.max(-h, Math.min(h, z));
    let nx = x - qx, ny = y - qy, nz = z - qz;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    return [qx + nx * rr, qy + ny * rr, qz + nz * rr, nx, ny, nz];
  };
  // the cube in 12 triangles, cut evenly, its points then rounded
  const pts = [];
  for (let i = 0; i < 8; i++) pts.push(i & 1 ? s : -s, i & 2 ? s : -s, i & 4 ? s : -s);
  let tris = [0, 2, 3, 0, 3, 1, 4, 5, 7, 4, 7, 6, 0, 1, 5, 0, 5, 4, 2, 6, 7, 2, 7, 3, 0, 4, 6, 0, 6, 2, 1, 3, 7, 1, 7, 5];
  const add = (x, y, z) => (pts.push(x, y, z), pts.length / 3 - 1);
  while (tris.length * 4 <= budget(detail) * 3) {
    const half = midpoints(pts, (a, b) => add((pts[a * 3] + pts[b * 3]) / 2, (pts[a * 3 + 1] + pts[b * 3 + 1]) / 2, (pts[a * 3 + 2] + pts[b * 3 + 2]) / 2));
    const next = [];
    for (let i = 0; i < tris.length; i += 3) split(tris[i], tris[i + 1], tris[i + 2], half, next);
    tris = next;
  }
  const pos = [], nrm = [];
  for (let i = 0; i < pts.length; i += 3) {
    const p = project(pts[i], pts[i + 1], pts[i + 2]);
    pos.push(p[0], p[1], p[2]);
    nrm.push(p[3], p[4], p[5]);
  }
  return { pos, nrm, tris, project };
}

// a model, as made by the converter (see models/README.md): the counts of
// points and triangles, the points (in the unit sphere), the triangles
function decode(buf) {
  const [nv, nt] = new Uint32Array(buf, 0, 2);
  const pts = new Float32Array(buf, 8, nv * 3);
  const tris = nv < 65536 ? new Uint16Array(buf, 8 + nv * 12, nt * 3) : new Uint32Array(buf, 8 + nv * 12, nt * 3);
  return [Array.from(pts), Array.from(tris)];
}

// a model made fine enough for the seams: its normals (the faces' around
// each point, by their angles there), then each triangle cut in 4, as long as
// it stays under the budget, the middles of the edges set on the curved
// surface the normals draw (as PN triangles do), so that it gets smoother
function fromMesh(pts, tris, R, detail) {
  const pos = pts.map((v) => v * R);
  const nrm = new Array(pos.length).fill(0);
  for (let i = 0; i < tris.length; i += 3) {
    const t = [tris[i], tris[i + 1], tris[i + 2]];
    const p = t.map((k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]]);
    const u = sub(p[1], p[0]), v = sub(p[2], p[0]);
    const n = norm([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]);
    for (let k = 0; k < 3; k++) {
      const a = norm(sub(p[(k + 1) % 3], p[k])), b = norm(sub(p[(k + 2) % 3], p[k]));
      const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
      for (let j = 0; j < 3; j++) nrm[t[k] * 3 + j] += n[j] * angle;
    }
  }
  for (let i = 0; i < nrm.length; i += 3) {
    const n = norm([nrm[i], nrm[i + 1], nrm[i + 2]]);
    nrm[i] = n[0]; nrm[i + 1] = n[1]; nrm[i + 2] = n[2];
  }
  const room = roomOf(pos, nrm, tris);
  while (tris.length * 4 <= budget(detail) * 3) {
    const half = midpoints(pos, (a, b) => {
      const pa = [pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2]], pb = [pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]];
      const na = [nrm[a * 3], nrm[a * 3 + 1], nrm[a * 3 + 2]], nb = [nrm[b * 3], nrm[b * 3 + 1], nrm[b * 3 + 2]];
      const d = sub(pb, pa);
      const wa = dot(d, na), wb = -dot(d, nb);
      for (let j = 0; j < 3; j++) pos.push((pa[j] + pb[j]) / 2 - (wa * na[j] + wb * nb[j]) / 8);
      nrm.push(...norm([na[0] + nb[0], na[1] + nb[1], na[2] + nb[2]]));
      room.push((room[a] + room[b]) / 2);
      return pos.length / 3 - 1;
    });
    const next = [];
    for (let i = 0; i < tris.length; i += 3) split(tris[i], tris[i + 1], tris[i + 2], half, next);
    tris = next;
  }
  return { pos, nrm, tris, room };
}

// how thick the wall can be at each point: a share of the radius of the
// surface where it curves in the most (the inside, offset along the normals,
// crosses itself past that radius), and of the thickness of the model there
// (an ear: the points close behind, facing the other way); its neighbours'
// a little too, then smoothed
function roomOf(pos, nrm, tris) {
  const n = pos.length / 3;
  const near = Array.from({ length: n }, () => new Set());
  for (let i = 0; i < tris.length; i += 3) for (let k = 0; k < 3; k++) {
    near[tris[i + k]].add(tris[i + (k + 1) % 3]);
    near[tris[i + k]].add(tris[i + (k + 2) % 3]);
  }
  let room = new Array(n).fill(Infinity);
  for (let i = 0; i < n; i++) for (const j of near[i]) {
    const d = [pos[j * 3] - pos[i * 3], pos[j * 3 + 1] - pos[i * 3 + 1], pos[j * 3 + 2] - pos[i * 3 + 2]];
    const h = dot(d, [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]]);
    // the neighbour above the tangent plane: the surface curves in, the
    // radius of the circle through both, tangent at i
    if (h > 1e-9) room[i] = Math.min(room[i], (0.6 * dot(d, d)) / (2 * h));
  }
  // the points in cells as big as the thickest wall looked for
  const cell = 0.12, grid = new Map();
  const keyOf = (x, y, z) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
  for (let i = 0; i < n; i++) {
    const k = keyOf(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  for (let i = 0; i < n; i++) {
    const p = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]], ni = [nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]];
    const [cx, cy, cz] = p.map((v) => Math.floor(v / cell));
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        if (dot(ni, [nrm[j * 3], nrm[j * 3 + 1], nrm[j * 3 + 2]]) > -0.3) continue;
        const d = [pos[j * 3] - p[0], pos[j * 3 + 1] - p[1], pos[j * 3 + 2] - p[2]];
        const behind = -dot(d, ni);
        // behind, and about straight behind
        if (behind > 0 && dot(d, d) - behind * behind < behind * behind) room[i] = Math.min(room[i], 0.4 * behind);
      }
    }
  }
  const pass = (f) => (room = room.map((r, i) => f(r, [...near[i]].map((j) => room[j]))));
  for (let k = 0; k < 2; k++) pass((r, m) => Math.min(r, ...m));
  for (let k = 0; k < 3; k++) pass((r, m) => (r + m.reduce((a, b) => a + Math.min(b, 1), 0) / m.length) / 2);
  return room;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
