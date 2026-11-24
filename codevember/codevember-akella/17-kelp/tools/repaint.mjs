// node tools/repaint.mjs <clown|butterfly> <in.glb> <out.png> [stats]: a fish's own paint from the photograph it came with.
// The photographs have their light in them (a clownfish dark underneath, a butterflyfish under a blue lamp), which
// is wrong as soon as the fish is lit again. So each texel the model uses is sorted into what it is (orange,
// white, black; or pale, band, black) by its colour and not its brightness, and painted that thing's own colour;
// what is kept of the photograph is its fine grain (fin rays, scales): its brightness over its brightness blurred.
// Alpha is how far the texel is the pale, silvery kind: where fish.ts lets a sheen play.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const [kind, file, out, stats] = process.argv.slice(2);
const glb = fs.readFileSync(file);
const jsonLength = glb.readUInt32LE(12);
const gltf = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8"));
const bin = glb.subarray(20 + jsonLength + 8);
const view = (k) => {
  const v = gltf.bufferViews[k];
  return bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
};
const prim = gltf.meshes[0].primitives[0];
const read = (k, size) => {
  const a = gltf.accessors[k],
    v = gltf.bufferViews[a.bufferView];
  const at = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const int = a.componentType !== 5126;
  const step = v.byteStride ?? size * (a.componentType === 5123 ? 2 : 4);
  const got = new Float64Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let d = 0; d < size; d++) got[i * size + d] = !int ? bin.readFloatLE(at + i * step + d * 4) : a.componentType === 5123 ? bin.readUInt16LE(at + i * step + d * 2) : bin.readUInt32LE(at + i * step + d * 4);
  return got;
};
const uv = read(prim.attributes.TEXCOORD_0, 2),
  index = read(prim.indices, 1);
const image = gltf.images[gltf.textures[gltf.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "kelp-paint-"));
const photo = path.join(tmp, image.mimeType === "image/png" ? "in.png" : "in.jpg");
fs.writeFileSync(photo, view(image.bufferView));
const [W, H] = execFileSync("magick", ["identify", "-format", "%w %h", photo]).toString().split(" ").map(Number);
execFileSync("magick", [photo, "-depth", "8", "rgb:" + path.join(tmp, "in.raw")]);
const raw = fs.readFileSync(path.join(tmp, "in.raw"));
const N = W * H;
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const enc = (v) => Math.round(255 * Math.min(1, Math.max(0, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)));
const R = new Float32Array(N),
  G = new Float32Array(N),
  B = new Float32Array(N);
for (let i = 0; i < N; i++) (R[i] = lin(raw[i * 3] / 255)), (G[i] = lin(raw[i * 3 + 1] / 255)), (B[i] = lin(raw[i * 3 + 2] / 255));

// ---- the texels the model uses
const used = new Uint8Array(N);
for (let t = 0; t < index.length; t += 3) {
  const p = [0, 1, 2].map((k) => [uv[index[t + k] * 2] * W - 0.5, uv[index[t + k] * 2 + 1] * H - 0.5]);
  const x0 = Math.max(0, Math.floor(Math.min(p[0][0], p[1][0], p[2][0])) - 1),
    x1 = Math.min(W - 1, Math.ceil(Math.max(p[0][0], p[1][0], p[2][0])) + 1);
  const y0 = Math.max(0, Math.floor(Math.min(p[0][1], p[1][1], p[2][1])) - 1),
    y1 = Math.min(H - 1, Math.ceil(Math.max(p[0][1], p[1][1], p[2][1])) + 1);
  const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
  const area = edge(p[0], p[1], p[2][0], p[2][1]);
  if (Math.abs(area) < 1e-9) continue;
  // a texel is used if the triangle comes within a texel of it
  const slack = 1.2 * Math.max(...[0, 1, 2].map((k) => Math.hypot(p[(k + 1) % 3][0] - p[k][0], p[(k + 1) % 3][1] - p[k][1])));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const s = Math.sign(area);
      if (edge(p[0], p[1], x, y) * s >= -slack && edge(p[1], p[2], x, y) * s >= -slack && edge(p[2], p[0], x, y) * s >= -slack) used[y * W + x] = 1;
    }
}

// ---- a blur of one thing weighted by another: three box blurs each way
const box = (src, r) => {
  const dst = new Float32Array(N),
    mid = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    let sum = 0;
    for (let x = -r; x <= r; x++) sum += src[y * W + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      mid[y * W + x] = sum / (2 * r + 1);
      sum += src[y * W + Math.min(W - 1, x + r + 1)] - src[y * W + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) sum += mid[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = sum / (2 * r + 1);
      sum += mid[Math.min(H - 1, y + r + 1) * W + x] - mid[Math.max(0, y - r) * W + x];
    }
  }
  return dst;
};
const blur = (value, weight, r) => {
  let a = Float32Array.from(value, (v, i) => v * weight[i]),
    b = Float32Array.from(weight);
  for (let k = 0; k < 3; k++) (a = box(a, r)), (b = box(b, r));
  return a.map((v, i) => v / Math.max(b[i], 1e-5));
};
const sm = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;

// ---- what each texel is: its share of each kind, and the brightness its grain is read from
const kinds =
  kind === "clown"
    ? {
        // orange (and red where it was in shadow): coloured. white: bright and not coloured. black: neither
        sort: (r, g, b) => {
          const v = Math.max(r, g, b),
            sat = (v - Math.min(r, g, b)) / Math.max(v, 1e-4);
          const black = 1 - sm(0.012, 0.045, v);
          const white = (1 - black) * (1 - sm(0.3, 0.6, sat)) * sm(0.1, 0.3, v);
          const dull = (1 - black) * (1 - sm(0.3, 0.6, sat)) * (1 - sm(0.1, 0.3, v)); // dark and grey: an edge of black
          return [1 - black - white - dull, white, black + dull];
        },
        grain: (r, g, b) => Math.max(r, g, b),
        paint: [
          [1.0, 0.21, 0.008],
          [0.9, 0.88, 0.84],
          [0.012, 0.011, 0.012],
        ],
        sheen: [0.12, 0.5, 0],
        // how far the orange keeps the photograph's own lean to yellow or red
        lean: 0.45,
      }
    : {
        // band (yellow under the lamp): hardly any blue. pale: mostly blue. black: dark
        sort: (r, g, b) => {
          const v = Math.max(r, g, b),
            blue = b / Math.max(r + g + b, 1e-4);
          const black = 1 - sm(0.05, 0.16, v);
          const band = (1 - black) * (1 - sm(0.22, 0.5, blue));
          return [1 - black - band, band, black];
        },
        // under a blue lamp the blue is the light and says little; the scales are in the red and green
        grain: (r, g) => r + g,
        paint: [
          [0.84, 0.87, 0.9],
          [1.0, 0.42, 0.035],
          [0.014, 0.014, 0.02],
        ],
        sheen: [1, 0.25, 0],
        lean: 0.35,
      };
const share = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
const grain = new Float32Array(N);
for (let i = 0; i < N; i++) {
  const s = kinds.sort(R[i], G[i], B[i]);
  for (let k = 0; k < 3; k++) share[k][i] = used[i] ? s[k] : 0;
  grain[i] = kinds.grain(R[i], G[i], B[i]);
}
if (stats) {
  const n = share.map((s) => s.reduce((a, b) => a + b, 0));
  const all = used.reduce((a, b) => a + b, 0);
  console.log(`${W}x${H}, ${((100 * all) / N).toFixed(0)}% used; shares ${n.map((v) => ((100 * v) / all).toFixed(0) + "%").join(" ")}`);
}
// each kind's brightness blurred among its own, and how red to green it is among its own (for the lean)
const radius = Math.round(W / 34);
const soft = share.map((s) => blur(grain, s, radius));
const ratio = Float32Array.from(R, (r, i) => G[i] / Math.max(r + G[i], 1e-4));
const usual = share.map((s) => {
  let a = 0,
    b = 0;
  for (let i = 0; i < N; i++) (a += ratio[i] * s[i]), (b += s[i]);
  return a / Math.max(b, 1e-5);
});

const px = new Float32Array(N * 4);
for (let i = 0; i < N; i++) {
  if (!used[i]) continue;
  let r = 0,
    g = 0,
    b = 0,
    a = 0;
  for (let k = 0; k < 3; k++) {
    const s = share[k][i];
    if (s <= 0) continue;
    // the grain: how bright it is among its own kind, and not all of that
    const fine = k === 2 ? 1 : Math.min(1.35, Math.max(0.55, (grain[i] / Math.max(soft[k][i], 1e-4)) ** 0.55));
    const [pr, pg, pb] = kinds.paint[k];
    // the lean: more green than its kind is yellower, less is redder
    const lean = k === 2 ? 1 : mix(1, Math.min(1.8, Math.max(0.5, ratio[i] / Math.max(usual[k], 1e-4))), kinds.lean);
    r += s * pr * fine;
    g += s * pg * fine * lean;
    b += s * pb * fine;
    a += s * kinds.sheen[k];
  }
  px.set([r, g, b, a], i * 4);
}
// ---- and the texels round the used ones take their colour, or the edges would be the photograph's backdrop
let filled = Uint8Array.from(used);
for (let pass = 0; pass < 24; pass++) {
  const next = Uint8Array.from(filled);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (filled[i]) continue;
      let n = 0;
      const sum = [0, 0, 0, 0];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx,
          Y = y + dy;
        if (X < 0 || Y < 0 || X >= W || Y >= H || !filled[Y * W + X]) continue;
        n++;
        for (let d = 0; d < 4; d++) sum[d] += px[(Y * W + X) * 4 + d];
      }
      if (!n) continue;
      for (let d = 0; d < 4; d++) px[i * 4 + d] = sum[d] / n;
      next[i] = 1;
    }
  filled = next;
}
const bytes = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  for (let d = 0; d < 3; d++) bytes[i * 4 + d] = enc(px[i * 4 + d]);
  bytes[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, px[i * 4 + 3])));
}
fs.writeFileSync(path.join(tmp, "out.raw"), bytes);
execFileSync("magick", ["-size", `${W}x${H}`, "-depth", "8", "rgba:" + path.join(tmp, "out.raw"), out]);
fs.rmSync(tmp, { recursive: true });
console.log(`${out}: ${W}x${H}, ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
