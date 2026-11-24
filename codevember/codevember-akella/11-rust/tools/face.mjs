// node tools/face.mjs: the face from day 3 (03-melt/public/sdf/me-256, a signed distance field) as a body for the
// rust page: public/face.mesh.bin and public/face.sdf.bin, in the same format as tools/suzanne.py writes.
// Surface nets for the mesh (as day 7's bakeface.mjs), with everything outside the field's box counted as
// outside so the skin closes; centred, and scaled so it turns within FIT of the axis and FIT of the middle in y.
import fs from "node:fs";
import zlib from "node:zlib";

const src = new URL("../../03-melt/public/sdf/", import.meta.url).pathname;
const out = new URL("../public/", import.meta.url).pathname;
const name = process.argv[2] ?? "me-256";
const FIT = 1.05;
const N = Number(process.env.N ?? 192); // sdf resolution, over [-1.2, 1.2]^3
const R = 1.2;

const meta = JSON.parse(fs.readFileSync(`${src}${name}.json`));
// day 3's packing: gzip, then two byte planes of deltas of half floats
const planes = zlib.gunzipSync(fs.readFileSync(`${src}${name}.field`));
const count = planes.length / 2;
const toFloat = (h) => {
  const s = h & 0x8000 ? -1 : 1,
    e = (h >> 10) & 31,
    m = h & 1023;
  return e === 0 ? s * m * 2 ** -24 : s * (1 + m / 1024) * 2 ** (e - 15);
};
const field = new Float32Array(count);
let last = 0;
for (let i = 0; i < count; i++) field[i] = toFloat((last = (last + ((planes[i] << 8) | planes[count + i])) & 0xffff));
const [NX, NY, NZ] = meta.dims;
const cell = meta.cell;
// outside the box: positive, so the surface closes at the box faces
const at = (x, y, z) => (x < 0 || y < 0 || z < 0 || x >= NX || y >= NY || z >= NZ ? cell : field[(z * NY + y) * NX + x]);

// ---- surface nets on the padded grid (cells from -1 so the box faces get a skin)
const nx = NX + 1,
  ny = NY + 1,
  nz = NZ + 1;
const cid = (x, y, z) => ((z + 1) * (ny + 1) + (y + 1)) * (nx + 1) + (x + 1);
const vertexOf = new Int32Array((nx + 1) * (ny + 1) * (nz + 1)).fill(-1);
const pos = [];
const corners = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
const edges = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
];
const v = new Float32Array(8);
for (let z = -1; z < NZ; z++)
  for (let y = -1; y < NY; y++)
    for (let x = -1; x < NX; x++) {
      let inside = 0;
      for (let k = 0; k < 8; k++) {
        v[k] = at(x + corners[k][0], y + corners[k][1], z + corners[k][2]);
        if (v[k] < 0) inside++;
      }
      if (inside === 0 || inside === 8) continue;
      let sx = 0,
        sy = 0,
        sz = 0,
        n = 0;
      for (const [a, b] of edges) {
        if (v[a] < 0 === v[b] < 0) continue;
        const t = v[a] / (v[a] - v[b]);
        sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
        sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
        sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
        n++;
      }
      vertexOf[cid(x, y, z)] = pos.length / 3;
      pos.push(x + sx / n, y + sy / n, z + sz / n);
    }
const index = [];
const quad = (a, b, c, d, flip) => {
  if (a < 0 || b < 0 || c < 0 || d < 0) return;
  if (flip) index.push(a, b, c, a, c, d);
  else index.push(a, c, b, a, d, c);
};
for (let z = 0; z < NZ; z++)
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++) {
      const here = at(x, y, z) < 0;
      if (here !== at(x + 1, y, z) < 0) quad(vertexOf[cid(x, y - 1, z - 1)], vertexOf[cid(x, y, z - 1)], vertexOf[cid(x, y, z)], vertexOf[cid(x, y - 1, z)], here);
      if (here !== at(x, y + 1, z) < 0) quad(vertexOf[cid(x - 1, y, z - 1)], vertexOf[cid(x - 1, y, z)], vertexOf[cid(x, y, z)], vertexOf[cid(x, y, z - 1)], here);
      if (here !== at(x, y, z + 1) < 0) quad(vertexOf[cid(x - 1, y - 1, z)], vertexOf[cid(x, y - 1, z)], vertexOf[cid(x, y, z)], vertexOf[cid(x - 1, y, z)], here);
    }

// trilinear field in grid units (padded the same way)
const sample = (gx, gy, gz) => {
  const x0 = Math.floor(gx),
    y0 = Math.floor(gy),
    z0 = Math.floor(gz);
  const fx = gx - x0,
    fy = gy - y0,
    fz = gz - z0;
  let s = 0;
  for (let k = 0; k < 8; k++) {
    const [cx, cy, cz] = corners[k];
    s += at(x0 + cx, y0 + cy, z0 + cz) * (cx ? fx : 1 - fx) * (cy ? fy : 1 - fy) * (cz ? fz : 1 - fz);
  }
  return s;
};

// ---- place it: centre of the bounding box, scaled to turn within FIT
const nv = pos.length / 3;
const lo = [Infinity, Infinity, Infinity],
  hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < nv; i++) for (let a = 0; a < 3; a++) ((lo[a] = Math.min(lo[a], pos[i * 3 + a])), (hi[a] = Math.max(hi[a], pos[i * 3 + a])));
const c = lo.map((l, a) => (l + hi[a]) / 2);
let rxz = 0,
  ry = 0;
for (let i = 0; i < nv; i++) {
  rxz = Math.max(rxz, Math.hypot(pos[i * 3] - c[0], pos[i * 3 + 2] - c[2]));
  ry = Math.max(ry, Math.abs(pos[i * 3 + 1] - c[1]));
}
const k = FIT / Math.max(rxz, ry); // grid units -> body units
const world = new Float32Array(nv * 3),
  normals = new Float32Array(nv * 3);
for (let i = 0; i < nv; i++) {
  const g = [pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]];
  for (let a = 0; a < 3; a++) world[i * 3 + a] = (g[a] - c[a]) * k;
  const e = 0.75;
  const d = [sample(g[0] + e, g[1], g[2]) - sample(g[0] - e, g[1], g[2]), sample(g[0], g[1] + e, g[2]) - sample(g[0], g[1] - e, g[2]), sample(g[0], g[1], g[2] + e) - sample(g[0], g[1], g[2] - e)];
  const l = Math.hypot(...d) || 1;
  for (let a = 0; a < 3; a++) normals[i * 3 + a] = d[a] / l;
}
const idx = new Uint32Array(index);
const head = new Uint32Array([nv, idx.length / 3]);
fs.writeFileSync(`${out}face.mesh.bin`, Buffer.concat([Buffer.from(head.buffer), Buffer.from(world.buffer), Buffer.from(normals.buffer), Buffer.from(idx.buffer)]));

// ---- the sdf, resampled into the body's box (distances in body units)
const step = (2 * R) / N;
const toHalf = (val) => {
  const f32 = new Float32Array([val]);
  const x = new Uint32Array(f32.buffer)[0];
  const sign = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 112;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7bff;
  return sign | (e << 10) | ((x & 0x7fffff) >>> 13);
};
const half = new Uint16Array(N * N * N);
let m = 0;
for (let z = 0; z < N; z++)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const p = [-R + (x + 0.5) * step, -R + (y + 0.5) * step, -R + (z + 0.5) * step];
      const g = p.map((val, a) => val / k + c[a]);
      // past the field's box: distance to the box plus what the field says at its face
      const cl = [Math.min(Math.max(g[0], 0), NX - 1.001), Math.min(Math.max(g[1], 0), NY - 1.001), Math.min(Math.max(g[2], 0), NZ - 1.001)];
      const outside = Math.hypot(g[0] - cl[0], g[1] - cl[1], g[2] - cl[2]);
      const d = (sample(cl[0], cl[1], cl[2]) / cell + outside) * k; // the field is in world units, `cell` per grid step
      half[m++] = toHalf(d);
    }
const sh = Buffer.alloc(12);
sh.writeUInt32LE(N, 0);
sh.writeFloatLE(-R, 4);
sh.writeFloatLE(step, 8);
fs.writeFileSync(`${out}face.sdf.bin`, Buffer.concat([sh, Buffer.from(half.buffer)]));
console.log(`face: ${nv} verts, ${idx.length / 3} tris, ${k.toFixed(4)} body units per cell, size ${hi.map((h, a) => ((h - lo[a]) * k).toFixed(2)).join(" × ")}`);
