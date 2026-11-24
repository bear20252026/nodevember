/**
 * Where each lead photon goes in a creature. The creature's strokes are drawn on a canvas, as many points
 * as there are leads are drawn from it by brightness (importance sampling, as Baeza et al. do), and the
 * leads are matched to them by sliced optimal transport: the leads' own places are moved, a direction at a
 * time, onto the sorted target points along that direction, until they lie as the drawing does. An optimal
 * map is the one under which straight paths cross least, so neighbours stay neighbours on the way.
 */
import { creatures } from "./creatures";

export type TransportRequest = {
  ver: number;
  creature: number;
  /** lead places, x y pairs, in the light's units */
  src: Float32Array;
  /** centre and side of the square the creature is drawn in */
  box: { x: number; y: number; size: number };
  /** a photon joins with certainty within `inner` box half-sides of the centre, fading to `far` at `outer` */
  reach: { inner: number; outer: number; far: number };
  iters: number;
};
export type TransportReply = { ver: number; creature: number; targets: Float32Array; ms: number };

const RES = 1024;

/** the share of photons at r box half-sides from the drawing's centre that join it */
export const reach01 = (r: number, reach: TransportRequest["reach"]) => {
  const s = Math.min(1, Math.max(0, (r - reach.inner) / (reach.outer - reach.inner)));
  return 1 + (reach.far - 1) * s * s * (3 - 2 * s);
};

// mulberry32: the same targets each time for the same drawing
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** a Catmull-Rom curve through the points, as a dense polyline */
const smooth = (pts: number[][], closed: boolean) => {
  const out: number[][] = [];
  const n = pts.length;
  const at = (k: number) => (closed ? pts[(k + n) % n] : pts[Math.max(0, Math.min(n - 1, k))]);
  const segs = closed ? n : n - 1;
  for (let k = 0; k < segs; k++) {
    const [p0, p1, p2, p3] = [at(k - 1), at(k), at(k + 1), at(k + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const m = Math.max(2, Math.ceil(len / 2));
    for (let j = 0; j < m; j++) {
      const t = j / m;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(closed ? pts[0] : pts[n - 1]);
  return out;
};

/** brush weights on a RES x RES grid */
const draw = (index: number) => {
  const canvas = new OffscreenCanvas(RES, RES);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  const scale = RES / 1000;
  const random = rng(17 + index);
  for (const stroke of creatures[index].strokes) {
    const line = smooth(stroke.pts, !!stroke.closed);
    // arc length, so the brush tapers by distance along the stroke
    const along = [0];
    for (let k = 1; k < line.length; k++) along.push(along[k - 1] + Math.hypot(line[k][0] - line[k - 1][0], line[k][1] - line[k - 1][1]));
    const total = along[along.length - 1] || 1;
    const base = 5.5 * (stroke.w ?? 1);
    const wobble = random() * 6;
    for (let k = 0; k < line.length; k++) {
      const s = along[k] / total;
      // ink thins at both ends, and the hand presses a little unevenly
      const r = base * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0.04, s))), 0.45) * (0.85 + 0.15 * Math.sin(wobble + along[k] * 0.02));
      ctx.beginPath();
      ctx.arc(line[k][0] * scale, line[k][1] * scale, Math.max(0.6, r * scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const data = ctx.getImageData(0, 0, RES, RES).data;
  const w = new Float32Array(RES * RES);
  for (let k = 0; k < w.length; k++) w[k] = data[4 * k + 3] / 255;
  return w;
};

/** n points drawn from the weights, stratified, inside the box */
const sample = (w: Float32Array, n: number, box: TransportRequest["box"], seed: number) => {
  const cdf = new Float64Array(w.length + 1);
  for (let k = 0; k < w.length; k++) cdf[k + 1] = cdf[k] + w[k];
  const total = cdf[w.length];
  const random = rng(seed);
  const out = new Float32Array(2 * n);
  let lo = 0;
  for (let i = 0; i < n; i++) {
    const u = ((i + random()) / n) * total;
    // u only grows, so the search can start where the last one ended
    while (cdf[lo + 1] < u) lo++;
    const px = (lo % RES) + random();
    const py = Math.floor(lo / RES) + random();
    out[2 * i] = box.x + (px / RES - 0.5) * box.size;
    out[2 * i + 1] = box.y - (py / RES - 0.5) * box.size;
  }
  return out;
};

/** order of the values, by two 11-bit radix passes on a 22-bit key */
const argsort = (() => {
  let keys = new Uint32Array(0);
  let tmpKeys = new Uint32Array(0);
  let idx = new Uint32Array(0);
  let tmpIdx = new Uint32Array(0);
  const count = new Uint32Array(2048);
  return (v: Float32Array) => {
    const n = v.length;
    if (keys.length < n) {
      keys = new Uint32Array(n);
      tmpKeys = new Uint32Array(n);
      idx = new Uint32Array(n);
      tmpIdx = new Uint32Array(n);
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, v[i]);
      hi = Math.max(hi, v[i]);
    }
    const q = (4194303 / Math.max(hi - lo, 1e-9)) * 0.999999;
    for (let i = 0; i < n; i++) {
      keys[i] = Math.floor((v[i] - lo) * q);
      idx[i] = i;
    }
    for (const shift of [0, 11]) {
      count.fill(0);
      for (let i = 0; i < n; i++) count[(keys[i] >>> shift) & 2047]++;
      let sum = 0;
      for (let b = 0; b < 2048; b++) {
        const c = count[b];
        count[b] = sum;
        sum += c;
      }
      for (let i = 0; i < n; i++) {
        const b = (keys[i] >>> shift) & 2047;
        const at = count[b]++;
        tmpKeys[at] = keys[i];
        tmpIdx[at] = idx[i];
      }
      [keys, tmpKeys] = [tmpKeys, keys];
      [idx, tmpIdx] = [tmpIdx, idx];
    }
    return idx.slice(0, n);
  };
})();

/**
 * Sliced optimal transport of weighted sources onto equally weighted targets. Along one direction the
 * optimal map matches quantiles: a source covering the cumulative weight [a, b] goes to the target at the
 * quantile in the middle of it.
 */
const transport = (x: Float32Array, weight: Float32Array, y: Float32Array, iters: number) => {
  const n = x.length / 2;
  const m = y.length / 2;
  let total = 0;
  for (let i = 0; i < n; i++) total += weight[i];
  const px = new Float32Array(n);
  const py = new Float32Array(m);
  for (let it = 0; it < iters; it++) {
    // golden-angle directions cover the half circle evenly; each comes with its perpendicular
    const a = it * 2.399963;
    for (const angle of [a, a + Math.PI / 2]) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (let i = 0; i < n; i++) px[i] = x[2 * i] * dx + x[2 * i + 1] * dy;
      for (let j = 0; j < m; j++) py[j] = y[2 * j] * dx + y[2 * j + 1] * dy;
      const ox = argsort(px);
      const oy = argsort(py);
      let cum = 0;
      for (let r = 0; r < n; r++) {
        const i = ox[r];
        const q = ((cum + weight[i] / 2) / total) * m - 0.5;
        cum += weight[i];
        // between the two targets either side of the quantile
        const j0 = Math.max(0, Math.min(m - 1, Math.floor(q)));
        const j1 = Math.min(m - 1, j0 + 1);
        const f = Math.max(0, Math.min(1, q - j0));
        const d = py[oy[j0]] * (1 - f) + py[oy[j1]] * f - px[i];
        x[2 * i] += d * dx;
        x[2 * i + 1] += d * dy;
      }
    }
  }
};

const drawings = new Map<number, Float32Array>();

self.onmessage = (e: MessageEvent<TransportRequest>) => {
  const t0 = performance.now();
  const { ver, creature, src, box, reach, iters } = e.data;
  if (!drawings.has(creature)) drawings.set(creature, draw(creature));
  const n = src.length / 2;
  // each lead stands for the photons round it that join, ever fewer away from the drawing (the same
  // rule decides each photon on the GPU)
  const weight = new Float32Array(n);
  for (let i = 0; i < n; i++) weight[i] = reach01(Math.hypot(src[2 * i] - box.x, src[2 * i + 1] - box.y) / (box.size / 2), reach);
  const goal = sample(drawings.get(creature)!, n, box, 101 + creature);
  const targets = src.slice();
  transport(targets, weight, goal, iters);
  const reply: TransportReply = { ver, creature, targets, ms: performance.now() - t0 };
  (self as unknown as Worker).postMessage(reply, [targets.buffer]);
};
