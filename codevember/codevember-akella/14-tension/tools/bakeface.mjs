// node tools/bakeface.mjs: the face from day 3 (03-melt/public/sdf/me-256, a signed distance field) as a pusher
// for the cloth (index.html): public/face.sdf (half floats, x fastest) and public/face.json (dims, origin, cell).
// Halved in resolution (the cloth's particles are coarser than that anyway), and moved so the origin is the
// nose tip: the face looks along +z, its top is +y.
import fs from "node:fs";
import zlib from "node:zlib";

const src = new URL("../../03-melt/public/sdf/", import.meta.url).pathname;
const out = new URL("../public/", import.meta.url).pathname;
const meta = JSON.parse(fs.readFileSync(`${src}me-256.json`));
// day 3's packing: gzip, then two byte planes of deltas of half floats
const planes = zlib.gunzipSync(fs.readFileSync(`${src}me-256.field`));
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
const at = (x, y, z) => field[(Math.min(z, NZ - 1) * NY + Math.min(y, NY - 1)) * NX + Math.min(x, NX - 1)];

// the nose tip: the furthest forward point inside
let tip = [0, 0, -1e9];
let lo = [1e9, 1e9, 1e9];
let hi = [-1e9, -1e9, -1e9];
for (let z = 0; z < NZ; z++)
  for (let y = 0; y < NY; y++)
    for (let x = 0; x < NX; x++)
      if (at(x, y, z) < 0) {
        const p = [meta.origin[0] + x * meta.cell, meta.origin[1] + y * meta.cell, meta.origin[2] + z * meta.cell];
        if (p[2] > tip[2]) tip = p;
        for (let k = 0; k < 3; k++) ((lo[k] = Math.min(lo[k], p[k])), (hi[k] = Math.max(hi[k], p[k])));
      }
console.log(
  "inside spans",
  lo.map((v) => v.toFixed(2)),
  hi.map((v) => v.toFixed(2)),
  "nose tip",
  tip.map((v) => v.toFixed(3)),
);

// halve, by averaging 2x2x2
const dims = [Math.ceil(NX / 2), Math.ceil(NY / 2), Math.ceil(NZ / 2)];
const half = new Uint16Array(dims[0] * dims[1] * dims[2]);
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
const toHalf = (v) => {
  f32[0] = v;
  const x = u32[0];
  const s = (x >>> 16) & 0x8000;
  let e = ((x >>> 23) & 0xff) - 127 + 15;
  const m = (x >>> 13) & 0x3ff;
  if (e <= 0) return s;
  if (e >= 31) return s | 0x7bff;
  return s | (e << 10) | m;
};
for (let z = 0; z < dims[2]; z++)
  for (let y = 0; y < dims[1]; y++)
    for (let x = 0; x < dims[0]; x++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) sum += at(2 * x + (k & 1), 2 * y + ((k >> 1) & 1), 2 * z + (k >> 2));
      half[(z * dims[1] + y) * dims[0] + x] = toHalf(sum / 8);
    }
const cell = meta.cell * 2;
// texel centres sit half a (new) cell in from the first old sample pair
const origin = [0, 1, 2].map((k) => meta.origin[k] + meta.cell * 0.5 - tip[k]);
fs.writeFileSync(`${out}face.sdf`, Buffer.from(half.buffer));
fs.writeFileSync(`${out}face.json`, JSON.stringify({ dims, origin, cell, height: hi[1] - lo[1], width: hi[0] - lo[0], depth: hi[2] - lo[2] }));
console.log(`face.sdf ${dims.join("x")}, ${(half.byteLength / 1e6).toFixed(1)} MB, origin at the nose tip`);
