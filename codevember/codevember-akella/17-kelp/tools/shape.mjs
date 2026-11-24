// node tools/shape.mjs <in.glb> <out.json> [cell]: makes a light shape for the weed to grow into out of a glb.
// All its meshes are put where the file's nodes put them, centred, sized so that half the height is 1, and thinned
// by putting every vertex that falls in the same small cube (`cell` on a side, 0.02) at the cube's mean. What comes
// out is { position, index }, as public/suzanne.json is.
import fs from "node:fs";
const [src, out, cellArg = "0.02"] = process.argv.slice(2);
if (!src || !out) throw new Error("node tools/shape.mjs <in.glb> <out.json> [cell]");
const cell = +cellArg;
const file = fs.readFileSync(src);
if (file.readUInt32LE(0) !== 0x46546c67) throw new Error("not a glb");
const jsonLength = file.readUInt32LE(12);
const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString());
const bin = file.subarray(20 + jsonLength + 8);
if (gltf.extensionsRequired?.length) throw new Error(`needs ${gltf.extensionsRequired}: not read here`);

const mul = (a, b) => {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
};
const local = (n) => {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1],
    [sx, sy, sz] = n.scale ?? [1, 1, 1],
    [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
};
const read = (index) => {
  const a = gltf.accessors[index],
    view = gltf.bufferViews[a.bufferView];
  const size = { SCALAR: 1, VEC3: 3 }[a.type];
  const [get, bytes] = { 5126: ["readFloatLE", 4], 5125: ["readUInt32LE", 4], 5123: ["readUInt16LE", 2], 5121: ["readUInt8", 1] }[a.componentType];
  const stride = view.byteStride ?? size * bytes;
  const at = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const o = new Float64Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) o[i * size + c] = bin[get](at + i * stride + c * bytes);
  return o;
};
const P = [],
  I = [];
const walk = (i, m) => {
  const n = gltf.nodes[i];
  const w = mul(m, local(n));
  if (n.mesh !== undefined)
    for (const prim of gltf.meshes[n.mesh].primitives) {
      if ((prim.mode ?? 4) !== 4) continue;
      const p = read(prim.attributes.POSITION);
      const base = P.length / 3;
      for (let v = 0; v < p.length; v += 3) P.push(w[0] * p[v] + w[4] * p[v + 1] + w[8] * p[v + 2] + w[12], w[1] * p[v] + w[5] * p[v + 1] + w[9] * p[v + 2] + w[13], w[2] * p[v] + w[6] * p[v + 1] + w[10] * p[v + 2] + w[14]);
      const idx = prim.indices !== undefined ? read(prim.indices) : Array.from({ length: p.length / 3 }, (_, k) => k);
      for (const k of idx) I.push(base + k);
    }
  for (const c of n.children ?? []) walk(c, w);
};
const one = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const root of gltf.scenes[gltf.scene ?? 0].nodes) walk(root, one);

const lo = [1e30, 1e30, 1e30],
  hi = [-1e30, -1e30, -1e30];
for (let v = 0; v < P.length; v += 3)
  for (let c = 0; c < 3; c++) {
    lo[c] = Math.min(lo[c], P[v + c]);
    hi[c] = Math.max(hi[c], P[v + c]);
  }
const scale = 2 / (hi[1] - lo[1]);
// thin it
const where = new Map();
const sum = [],
  to = new Int32Array(P.length / 3);
for (let v = 0; v < P.length; v += 3) {
  const p = [0, 1, 2].map((c) => (P[v + c] - (lo[c] + hi[c]) / 2) * scale);
  const key = p.map((x) => Math.floor(x / cell)).join(",");
  let k = where.get(key);
  if (k === undefined) {
    k = sum.length / 4;
    where.set(key, k);
    sum.push(0, 0, 0, 0);
  }
  for (let c = 0; c < 3; c++) sum[k * 4 + c] += p[c];
  sum[k * 4 + 3]++;
  to[v / 3] = k;
}
const position = [];
for (let k = 0; k < sum.length; k += 4) for (let c = 0; c < 3; c++) position.push(+(sum[k + c] / sum[k + 3]).toFixed(4));
// two sides of something thin may have fallen onto the same triangle: such a pair is no skin at all (a ray that
// crosses both has not gone in or out), so a triangle is kept only if it is there an odd number of times
const times = new Map();
for (let t = 0; t < I.length; t += 3) {
  const tri = [to[I[t]], to[I[t + 1]], to[I[t + 2]]];
  if (tri[0] === tri[1] || tri[1] === tri[2] || tri[0] === tri[2]) continue;
  const key = [...tri].sort((x, y) => x - y).join(",");
  const had = times.get(key);
  if (had) had.n++;
  else times.set(key, { n: 1, tri });
}
const index = [];
for (const { n, tri } of times.values()) if (n & 1) index.push(...tri);
fs.writeFileSync(out, JSON.stringify({ position, index }));
console.log(`${P.length / 3} vertices, ${I.length / 3} triangles -> ${position.length / 3}, ${index.length / 3}; ${(fs.statSync(out).size / 1024).toFixed(0)} kB`);
console.log(`size before ${[0, 1, 2].map((c) => (hi[c] - lo[c]).toFixed(3))}, after ${[0, 1, 2].map((c) => ((hi[c] - lo[c]) * scale).toFixed(3))}`);
