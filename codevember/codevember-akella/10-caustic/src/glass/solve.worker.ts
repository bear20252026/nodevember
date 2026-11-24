/**
 * Designs the glass: a slab whose top is flat and whose underside is a height field s(x, y), so that light
 * falling straight down through it lands, a distance D below, as the target picture.
 *
 * 1. Transport: the slab's cells (equal light each) are matched to points drawn from the picture by
 *    brightness, by sliced optimal transport. An optimal map is a gradient (Brenier), which is just what a
 *    refracting surface can make.
 * 2. Normals: for each cell the direction from its exit point to its target fixes, by Snell's law, the
 *    normal the underside must have there: ior * in - out is parallel to it.
 * 3. Heights: the surface whose slopes best match those normals solves a Poisson equation, done exactly
 *    with cosine transforms (zero slope across the rim). The exit point's height changes the distance to
 *    the paper, so normals and heights are worked out again a few times.
 */
import { drawTarget, type TargetName } from "./targets";

export type SolveRequest = {
  name: TargetName;
  /** cells across the slab */
  n: number;
  /** half side of the slab */
  half: number;
  /** from the underside's top to the paper */
  distance: number;
  ior: number;
  /** picture half side against the slab's */
  magnify: number;
  /** darkest share of the picture's light, so dark parts can still be reached */
  floor: number;
  gamma: number;
  iters: number;
  /** blur of the matched targets, in cells */
  soften: number;
  /** send each cell to the picture turned half round, so all the light crosses on its way: the picture only
   * holds at the one distance and pose, and anywhere else the crossing beams tangle */
  cross: boolean;
  /** rounds of moving the light the surface really makes back onto the picture */
  refine: number;
};
export type SolveReply = {
  name: TargetName;
  n: number;
  /** per cell: height, slope x, slope y, 0 */
  field: Float32Array;
  ms: number;
  /** mean and largest distance between where light lands and where it was sent, in cells */
  err: [number, number];
  maxSlope: number;
  depth: number;
};

const RES = 512;

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** m points drawn from the weights on a RES grid, stratified, in a square of half side `half` (canvas y down, so flipped) */
const sample = (w: Float32Array, m: number, half: number) => {
  const cdf = new Float64Array(w.length + 1);
  for (let k = 0; k < w.length; k++) cdf[k + 1] = cdf[k] + w[k];
  const total = cdf[w.length];
  const random = rng(7);
  const out = new Float32Array(2 * m);
  let lo = 0;
  for (let i = 0; i < m; i++) {
    const u = ((i + random()) / m) * total;
    while (cdf[lo + 1] < u) lo++;
    const px = (lo % RES) + random();
    const py = Math.floor(lo / RES) + random();
    out[2 * i] = (px / RES - 0.5) * 2 * half;
    out[2 * i + 1] = (0.5 - py / RES) * 2 * half;
  }
  return out;
};

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
    return idx;
  };
})();

/** sliced optimal transport of x onto y, equal weights and counts */
const transport = (x: Float32Array, y: Float32Array, iters: number) => {
  const n = x.length / 2;
  const px = new Float32Array(n);
  const py = new Float32Array(n);
  const oy = new Uint32Array(n);
  for (let it = 0; it < iters; it++) {
    const a = it * 2.399963;
    for (const angle of [a, a + Math.PI / 2]) {
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      for (let i = 0; i < n; i++) {
        px[i] = x[2 * i] * dx + x[2 * i + 1] * dy;
        py[i] = y[2 * i] * dx + y[2 * i + 1] * dy;
      }
      oy.set(argsort(py).subarray(0, n));
      const ox = argsort(px);
      for (let r = 0; r < n; r++) {
        const i = ox[r];
        const d = py[oy[r]] - px[i];
        x[2 * i] += d * dx;
        x[2 * i + 1] += d * dy;
      }
    }
  }
};

/** separable gaussian blur of an n x n grid of 2-vectors, in place */
const blur2 = (v: Float32Array, n: number, sigma: number) => {
  if (sigma < 0.05) return;
  const r = Math.ceil(sigma * 3);
  const k = Array.from({ length: 2 * r + 1 }, (_, i) => Math.exp(-((i - r) ** 2) / (2 * sigma * sigma)));
  const tmp = new Float32Array(v.length);
  for (const [src, dst, horizontal] of [
    [v, tmp, true],
    [tmp, v, false],
  ] as const) {
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        let sx = 0;
        let sy = 0;
        let ws = 0;
        for (let o = -r; o <= r; o++) {
          const ii = horizontal ? i + o : i;
          const jj = horizontal ? j : j + o;
          if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
          const w = k[o + r];
          sx += src[2 * (jj * n + ii)] * w;
          sy += src[2 * (jj * n + ii) + 1] * w;
          ws += w;
        }
        dst[2 * (j * n + i)] = sx / ws;
        dst[2 * (j * n + i) + 1] = sy / ws;
      }
  }
};

/** cosine transform helpers: C[k][i] = cos(pi k (i + 0.5) / n) */
const poissonSolver = (n: number) => {
  const C = new Float64Array(n * n);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) C[k * n + i] = Math.cos((Math.PI * k * (i + 0.5)) / n);
  const tmp = new Float64Array(n * n);
  const out = new Float64Array(n * n);
  // out = A * B^T when bt, else A * B (row-major n x n)
  const mul = (A: Float64Array, B: Float64Array, bt: boolean, dst: Float64Array) => {
    dst.fill(0);
    if (bt) {
      for (let r = 0; r < n; r++)
        for (let c = 0; c < n; c++) {
          let s = 0;
          const ar = r * n;
          const bc = c * n;
          for (let k = 0; k < n; k++) s += A[ar + k] * B[bc + k];
          dst[r * n + c] = s;
        }
    } else {
      for (let r = 0; r < n; r++)
        for (let k = 0; k < n; k++) {
          const a = A[r * n + k];
          if (a === 0) continue;
          const bk = k * n;
          const dr = r * n;
          for (let c = 0; c < n; c++) dst[dr + c] += a * B[bk + c];
        }
    }
  };
  // C^T as its own matrix
  const CT = new Float64Array(n * n);
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) CT[i * n + k] = C[k * n + i];
  /** solves lap(s) = rhs with zero normal slope at the rim; rhs is [j][i], spacing h */
  return (rhs: Float64Array, h: number) => {
    // Y = C R C^T
    mul(C, rhs, false, tmp);
    mul(tmp, C, true, out);
    for (let k = 0; k < n; k++)
      for (let l = 0; l < n; l++) {
        const lam = (2 * Math.cos((Math.PI * k) / n) - 2 + 2 * Math.cos((Math.PI * l) / n) - 2) / (h * h);
        const wk = (k === 0 ? 1 : 2) / n;
        const wl = (l === 0 ? 1 : 2) / n;
        out[k * n + l] = k === 0 && l === 0 ? 0 : (out[k * n + l] / lam) * wk * wl;
      }
    // s = C^T Y C
    mul(CT, out, false, tmp);
    const s = new Float64Array(n * n);
    mul(tmp, C, false, s);
    return s;
  };
};

/** refraction as WGSL does it */
const refract = (I: number[], N: number[], eta: number) => {
  const d = N[0] * I[0] + N[1] * I[1] + N[2] * I[2];
  const k = 1 - eta * eta * (1 - d * d);
  if (k < 0) return null;
  const f = eta * d + Math.sqrt(k);
  return [eta * I[0] - f * N[0], eta * I[1] - f * N[1], eta * I[2] - f * N[2]];
};

self.onmessage = (e: MessageEvent<SolveRequest>) => {
  const t0 = performance.now();
  const q = e.data;
  const { n, half, ior } = q;
  const h = (2 * half) / n;
  const picture = drawTarget(q.name, RES);
  for (let k = 0; k < picture.length; k++) picture[k] = q.floor + (1 - q.floor) * Math.pow(picture[k], q.gamma);

  // 1. transport from cell centres to the picture
  const cells = n * n;
  const x = new Float32Array(2 * cells);
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      x[2 * (j * n + i)] = -half + (i + 0.5) * h;
      x[2 * (j * n + i) + 1] = -half + (j + 0.5) * h;
    }
  let goal = x.slice();
  const points = sample(picture, cells, half * q.magnify);
  const flipped = points.map((v) => (q.cross ? -v : v));
  transport(goal, flipped, q.iters);
  blur2(goal, n, q.soften);
  if (q.cross) for (let k = 0; k < goal.length; k++) goal[k] = -goal[k];

  // 2-3. normals and heights, worked out again with the heights' own distances
  const solve = poissonSolver(n);
  const gx = new Float64Array(cells);
  const gy = new Float64Array(cells);
  const heights = (goal: Float32Array, start: Float64Array) => {
    let s = start;
    for (let round = 0; round < 2; round++) {
      for (let k = 0; k < cells; k++) {
        const dx = goal[2 * k] - x[2 * k];
        const dy = goal[2 * k + 1] - x[2 * k + 1];
        const dz = -(q.distance + s[k]);
        const l = Math.hypot(dx, dy, dz);
        const tz = dz / l;
        gx[k] = -dx / l / (ior + tz);
        gy[k] = -dy / l / (ior + tz);
      }
      // divergence through faces, none across the rim
      const rhs = new Float64Array(cells);
      for (let j = 0; j < n; j++)
        for (let i = 0; i < n; i++) {
          const k = j * n + i;
          const east = i < n - 1 ? (gx[k] + gx[k + 1]) / 2 : 0;
          const west = i > 0 ? (gx[k] + gx[k - 1]) / 2 : 0;
          const north = j < n - 1 ? (gy[k] + gy[k + n]) / 2 : 0;
          const south = j > 0 ? (gy[k] + gy[k - n]) / 2 : 0;
          rhs[k] = (east - west + north - south) / h;
        }
      s = solve(rhs, h);
      // the underside's highest point touches z = 0
      let top = -Infinity;
      for (let k = 0; k < cells; k++) top = Math.max(top, s[k]);
      for (let k = 0; k < cells; k++) s[k] -= top;
    }
    return s;
  };
  const slopesOf = (s: Float64Array, k: number, i: number, j: number) => [
    i === 0 ? (s[k + 1] - s[k]) / h : i === n - 1 ? (s[k] - s[k - 1]) / h : (s[k + 1] - s[k - 1]) / (2 * h),
    j === 0 ? (s[k + n] - s[k]) / h : j === n - 1 ? (s[k] - s[k - n]) / h : (s[k + n] - s[k - n]) / (2 * h),
  ];
  /** where light through the surface really lands */
  const landing = (s: Float64Array) => {
    const out = new Float32Array(2 * cells);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const [sx, sy] = slopesOf(s, k, i, j);
        const l = Math.hypot(sx, sy, 1);
        const t = refract([0, 0, -1], [-sx / l, -sy / l, 1 / l], ior) ?? [0, 0, -1];
        const reach = (q.distance + s[k]) / -t[2];
        out[2 * k] = x[2 * k] + t[0] * reach;
        out[2 * k + 1] = x[2 * k + 1] + t[1] * reach;
      }
    return out;
  };
  let s = heights(goal, new Float64Array(cells));
  // the surface can only make gradient maps: move where its light lands onto the picture again (a short
  // transport, warm started) and fit the surface to that, a few times over
  for (let r = 0; r < q.refine; r++) {
    goal = landing(s);
    transport(goal, points, 40);
    blur2(goal, n, 0.5);
    s = heights(goal, s);
  }
  let maxSlope = 0;

  // slopes of the surface actually made, and how well it does
  const field = new Float32Array(cells * 4);
  let depth = 0;
  let errSum = 0;
  let errMax = 0;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const sx = i === 0 ? (s[k + 1] - s[k]) / h : i === n - 1 ? (s[k] - s[k - 1]) / h : (s[k + 1] - s[k - 1]) / (2 * h);
      const sy = j === 0 ? (s[k + n] - s[k]) / h : j === n - 1 ? (s[k] - s[k - n]) / h : (s[k + n] - s[k - n]) / (2 * h);
      field.set([s[k], sx, sy, 0], 4 * k);
      maxSlope = Math.max(maxSlope, Math.hypot(sx, sy));
      depth = Math.min(depth, s[k]);
      const l = Math.hypot(sx, sy, 1);
      const t = refract([0, 0, -1], [-sx / l, -sy / l, 1 / l], ior);
      if (!t) {
        errMax = Infinity;
        continue;
      }
      const reach = (q.distance + s[k]) / -t[2];
      const err = Math.hypot(x[2 * k] + t[0] * reach - goal[2 * k], x[2 * k + 1] + t[1] * reach - goal[2 * k + 1]) / h;
      errSum += err;
      errMax = Math.max(errMax, err);
    }
  const reply: SolveReply = { name: q.name, n, field, ms: performance.now() - t0, err: [errSum / cells, errMax], maxSlope, depth };
  (self as unknown as Worker).postMessage(reply, [field.buffer]);
};
