// Everything about the sphere that does not move: where corrosion starts and how fast it spreads under the
// enamel (an onset time per point), the vein channels it races along, and the paint cut into flakes.
// Pure TS with no three import, so node can run it too (tools/bake.ts).

// each flake is a centre vertex then RINGS rings of SEGS spokes, flakes one after another
export const FLAKE_RINGS = 10;
export const FLAKE_SEGS = 32;

export const shape = {
  seed: 11,
  pits: 13, // where corrosion starts
  flake: 0.1, // typical spacing of the paint cracks, in sphere radii
  flakeSpread: 1.1, // how much flake size varies over the sphere
  wobble: 0.22, // crack wiggle, as a fraction of the spacing
  paint: 1.0035, // radius of the paint skin
};

export type Baked = {
  fieldW: number;
  fieldH: number;
  field: Uint16Array; // half floats, RGBA: onset, vein, spare, spare
  position: Float32Array; // rest point on the paint skin
  lift: Float32Array; // vec4: peel gradient xyz, peel coordinate L
  cut: Float32Array; // distance to this flake's own crack line (chord units)
  flake: Float32Array; // vec4 per vertex, constant per flake: onset, Lmin, Lmax, curl radius
  seed: Float32Array; // vec4 per vertex, constant per flake: centre xyz, random
  index: Uint32Array;
  flakes: number;
  ms: Record<string, number>;
};

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Perlin's improved noise, about -1..1
export function noise3(seed: number) {
  const r = rng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h: number, x: number, y: number, z: number) => {
    h &= 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  };
  return (x: number, y: number, z: number) => {
    const X = Math.floor(x),
      Y = Math.floor(y),
      Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255,
      yi = Y & 255,
      zi = Z & 255;
    const u = fade(x),
      v = fade(y),
      w = fade(z);
    const A = p[xi] + yi,
      AA = p[A] + zi,
      AB = p[A + 1] + zi,
      B = p[xi + 1] + yi,
      BA = p[B] + zi,
      BB = p[B + 1] + zi;
    const l = (a: number, b: number, t: number) => a + t * (b - a);
    return l(
      l(l(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u), l(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      l(l(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u), l(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
function toHalf(v: number) {
  f32[0] = v;
  const x = u32[0];
  const sign = (x >>> 16) & 0x8000;
  const e = ((x >>> 23) & 0xff) - 112;
  if (e <= 0) return sign;
  if (e >= 31) return sign | 0x7c00;
  return sign | (e << 10) | ((x & 0x7fffff) >>> 13);
}

// direction of an equirect texel; lon = atan2(x, z), lat = asin(y), row 0 at the south pole
function dirOf(i: number, j: number, W: number, H: number, out: number[]) {
  const lon = ((i + 0.5) / W) * 2 * Math.PI - Math.PI;
  const lat = ((j + 0.5) / H) * Math.PI - Math.PI / 2;
  out[0] = Math.cos(lat) * Math.sin(lon);
  out[1] = Math.sin(lat);
  out[2] = Math.cos(lat) * Math.cos(lon);
}

// min-heap of (key, node) for Dijkstra, with stale entries skipped by the caller
class Heap {
  k = new Float64Array(1 << 16);
  v = new Int32Array(1 << 16);
  n = 0;
  push(key: number, node: number) {
    if (this.n === this.k.length) {
      const k = new Float64Array(this.n * 2);
      k.set(this.k);
      this.k = k;
      const v = new Int32Array(this.n * 2);
      v.set(this.v);
      this.v = v;
    }
    let i = this.n++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= key) break;
      this.k[i] = this.k[p];
      this.v[i] = this.v[p];
      i = p;
    }
    this.k[i] = key;
    this.v[i] = node;
  }
  pop(): [number, number] {
    const top: [number, number] = [this.k[0], this.v[0]];
    const key = this.k[--this.n];
    const node = this.v[this.n];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= this.n) break;
      if (c + 1 < this.n && this.k[c + 1] < this.k[c]) c++;
      if (this.k[c] >= key) break;
      this.k[i] = this.k[c];
      this.v[i] = this.v[c];
      i = c;
    }
    this.k[i] = key;
    this.v[i] = node;
    return top;
  }
}

export function bake(s = shape): Baked {
  const ms: Record<string, number> = {};
  let t0 = performance.now();
  const lap = (name: string) => {
    const t = performance.now();
    ms[name] = Math.round(t - t0);
    t0 = t;
  };
  const rand = rng(s.seed);
  const n1 = noise3(s.seed + 1);
  const n2 = noise3(s.seed + 2);
  const n3 = noise3(s.seed + 3);
  const n4 = noise3(s.seed + 4);
  const fbm = (x: number, y: number, z: number, oct: number) => {
    let a = 0,
      amp = 0.5,
      f = 1,
      norm = 0;
    for (let o = 0; o < oct; o++) {
      a += amp * n4(x * f + o * 7.1, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return a / norm;
  };

  // ---- veins: thin meandering channels (ridged, domain-warped noise), two sizes
  const W = 2048,
    H = 1024;
  const vein = new Float32Array(W * H);
  const d = [0, 0, 0];
  const veinAt = (x: number, y: number, z: number) => {
    const wx = x + 0.22 * n1(x * 2.1, y * 2.1, z * 2.1 + 3.3);
    const wy = y + 0.22 * n1(x * 2.1 + 5.2, y * 2.1, z * 2.1);
    const wz = z + 0.22 * n1(x * 2.1, y * 2.1 + 9.4, z * 2.1);
    const r1 = 1 - Math.abs(n2(wx * 3.2, wy * 3.2, wz * 3.2));
    const r2 = 1 - Math.abs(n3(wx * 7.7, wy * 7.7, wz * 7.7));
    return Math.max(Math.pow(r1, 14), 0.75 * Math.pow(r2, 18));
  };
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      dirOf(i, j, W, H, d);
      vein[j * W + i] = veinAt(d[0], d[1], d[2]);
    }
  lap("veins");

  // ---- onset: arrival time of corrosion spreading from a few pits, fast along the veins
  const w = W / 2,
    h = H / 2;
  const speed = new Float32Array(w * h);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      // max-pool so a one-texel channel stays connected at half resolution
      const v = Math.max(vein[2 * j * W + 2 * i], vein[2 * j * W + 2 * i + 1], vein[(2 * j + 1) * W + 2 * i], vein[(2 * j + 1) * W + 2 * i + 1]);
      dirOf(i, j, w, h, d);
      const slow = 0.5 + 0.5 * fbm(d[0] * 2.5, d[1] * 2.5, d[2] * 2.5, 4); // 0..1 roughly
      speed[j * w + i] = 0.25 + 0.9 * slow * slow + 5 * v;
    }
  const time = new Float64Array(w * h).fill(Infinity); // float64 like the heap keys, or rounding marks live entries stale
  const heap = new Heap();
  for (let k = 0; k < s.pits; k++) {
    const y = rand() * 1.6 - 0.8; // keep pits off the never-seen poles
    const lon = rand() * 2 * Math.PI - Math.PI;
    const i = Math.min(w - 1, Math.floor(((lon + Math.PI) / (2 * Math.PI)) * w));
    const j = Math.min(h - 1, Math.floor(((Math.asin(y) + Math.PI / 2) / Math.PI) * h));
    const start = rand() * 0.6;
    if (start < time[j * w + i]) {
      time[j * w + i] = start;
      heap.push(start, j * w + i);
    }
  }
  const dl = (2 * Math.PI) / w,
    dp = Math.PI / h;
  const cosLat = new Float32Array(h);
  for (let j = 0; j < h; j++) cosLat[j] = Math.cos(((j + 0.5) / h) * Math.PI - Math.PI / 2);
  while (heap.n) {
    const [t, node] = heap.pop();
    if (t > time[node]) continue;
    const i = node % w,
      j = (node - i) / w;
    for (let dj = -1; dj <= 1; dj++) {
      const jj = j + dj;
      if (jj < 0 || jj >= h) continue;
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = (i + di + w) % w;
        const m = jj * w + ii;
        const cl = 0.5 * (cosLat[j] + cosLat[jj]);
        const len = Math.sqrt((di * dl * cl) ** 2 + (dj * dp) ** 2);
        const nt = t + (2 * len) / (speed[node] + speed[m]);
        if (nt < time[m]) {
          time[m] = nt;
          heap.push(nt, m);
        }
      }
    }
  }
  // normalise: 3% of the surface starts at 0, 97% has started by 1
  const sorted = Float64Array.from(time).sort();
  const lo = sorted[Math.floor(sorted.length * 0.03)],
    hi = sorted[Math.floor(sorted.length * 0.97)];
  for (let k = 0; k < time.length; k++) time[k] = (time[k] - lo) / (hi - lo);
  lap("onset");

  const onsetAt = (x: number, y: number, z: number) => {
    const lon = Math.atan2(x, z),
      lat = Math.asin(Math.max(-1, Math.min(1, y)));
    const fx = ((lon + Math.PI) / (2 * Math.PI)) * w - 0.5;
    const fy = Math.max(0, Math.min(h - 1.001, ((lat + Math.PI / 2) / Math.PI) * h - 0.5));
    const i0 = Math.floor(fx),
      j0 = Math.floor(fy);
    const tx = fx - i0,
      ty = fy - j0;
    const a = (i0 + w) % w,
      b = (i0 + 1 + w) % w;
    const r0 = time[j0 * w + a] * (1 - tx) + time[j0 * w + b] * tx;
    const r1 = time[(j0 + 1) * w + a] * (1 - tx) + time[(j0 + 1) * w + b] * tx;
    return r0 * (1 - ty) + r1 * ty;
  };

  const field = new Uint16Array(W * H * 4);
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      dirOf(i, j, W, H, d);
      const k = (j * W + i) * 4;
      field[k] = toHalf(onsetAt(d[0], d[1], d[2]));
      field[k + 1] = toHalf(vein[j * W + i]);
      field[k + 2] = toHalf(0);
      field[k + 3] = toHalf(1);
    }
  lap("field");

  // ---- flakes: variable-density Poisson disk on the sphere, cut along a wobbly Voronoi
  const sizeAt = (x: number, y: number, z: number) => s.flake * Math.max(0.55, 1 + s.flakeSpread * fbm(x * 1.6 + 11, y * 1.6, z * 1.6, 3) * 1.6);
  const seeds: number[] = [];
  const cell = s.flake * 0.6;
  const G = Math.ceil(2.2 / cell);
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => {
    const gx = Math.floor((x + 1.1) / cell),
      gy = Math.floor((y + 1.1) / cell),
      gz = Math.floor((z + 1.1) / cell);
    return (gx * G + gy) * G + gz;
  };
  const near = (x: number, y: number, z: number, r: number, fn: (k: number) => void) => {
    const gx = Math.floor((x + 1.1) / cell),
      gy = Math.floor((y + 1.1) / cell),
      gz = Math.floor((z + 1.1) / cell);
    const R = Math.ceil(r / cell);
    for (let a = gx - R; a <= gx + R; a++)
      for (let b = gy - R; b <= gy + R; b++)
        for (let c = gz - R; c <= gz + R; c++) {
          const list = grid.get((a * G + b) * G + c);
          if (list) for (const k of list) fn(k);
        }
  };
  let misses = 0;
  while (misses < 4000) {
    const y = rand() * 2 - 1,
      lon = rand() * 2 * Math.PI,
      c = Math.sqrt(1 - y * y);
    const x = c * Math.sin(lon),
      z = c * Math.cos(lon);
    const r = sizeAt(x, y, z);
    let ok = true;
    near(x, y, z, r * 1.6, (k) => {
      if (!ok) return;
      const dx = seeds[k * 3] - x,
        dy = seeds[k * 3 + 1] - y,
        dz = seeds[k * 3 + 2] - z;
      const rk = Math.min(r, sizeAt(seeds[k * 3], seeds[k * 3 + 1], seeds[k * 3 + 2]));
      if (dx * dx + dy * dy + dz * dz < rk * rk) ok = false;
    });
    if (!ok) {
      misses++;
      continue;
    }
    misses = 0;
    const id = seeds.length / 3;
    seeds.push(x, y, z);
    const kk = key(x, y, z);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk)!.push(id);
  }
  const N = seeds.length / 3;
  // neighbours as bisector normals: on the unit sphere the distance from q to the bisector of a and b is q·(a-b)/|a-b|
  const nb: Float32Array[] = [];
  for (let a = 0; a < N; a++) {
    const ax = seeds[a * 3],
      ay = seeds[a * 3 + 1],
      az = seeds[a * 3 + 2];
    const r = sizeAt(ax, ay, az) * 2.8;
    const list: [number, number, number, number][] = [];
    near(ax, ay, az, r, (b) => {
      if (b === a) return;
      const ex = ax - seeds[b * 3],
        ey = ay - seeds[b * 3 + 1],
        ez = az - seeds[b * 3 + 2];
      const l = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (l < r) list.push([l, ex / l, ey / l, ez / l]);
    });
    list.sort((p, q) => p[0] - q[0]);
    const e = new Float32Array(Math.min(16, list.length) * 3);
    for (let k = 0; k < e.length / 3; k++) e.set(list[k].slice(1), k * 3);
    nb.push(e);
  }
  lap("seeds");

  // wobbly crack lines: Voronoi of the warped point
  const sharp = 1 / (0.05 * s.flake); // soft-min sharpness: rounds the corners a little
  const q = [0, 0, 0];
  const warp = (x: number, y: number, z: number) => {
    const f1 = 0.9 / s.flake,
      f2 = 3.7 / s.flake,
      A1 = s.wobble * s.flake,
      A2 = 0.25 * s.wobble * s.flake;
    q[0] = x + A1 * n1(x * f1, y * f1, z * f1 + 17.1) + A2 * n2(x * f2 + 3.3, y * f2, z * f2);
    q[1] = y + A1 * n1(x * f1 + 41.7, y * f1, z * f1) + A2 * n2(x * f2, y * f2 + 7.7, z * f2);
    q[2] = z + A1 * n1(x * f1, y * f1 + 23.9, z * f1) + A2 * n2(x * f2, y * f2, z * f2 + 1.9);
  };
  const g = [0, 0, 0];
  let hard = 0; // exact distance to the crack line, so that neighbours meet with no gap
  // soft distance to the cell border (positive inside), and its gradient into g
  const border = (a: number, x: number, y: number, z: number) => {
    warp(x, y, z);
    const e = nb[a];
    let lo = Infinity;
    const m = e.length / 3;
    const ds = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      ds[k] = q[0] * e[k * 3] + q[1] * e[k * 3 + 1] + q[2] * e[k * 3 + 2];
      if (ds[k] < lo) lo = ds[k];
    }
    hard = lo;
    let sum = 0;
    g[0] = g[1] = g[2] = 0;
    for (let k = 0; k < m; k++) {
      const wgt = Math.exp(-sharp * (ds[k] - lo));
      sum += wgt;
      g[0] += wgt * e[k * 3];
      g[1] += wgt * e[k * 3 + 1];
      g[2] += wgt * e[k * 3 + 2];
    }
    g[0] /= sum;
    g[1] /= sum;
    g[2] /= sum;
    return lo - Math.log(sum) / sharp;
  };

  // per flake: a polar patch whose rim follows the crack line in each direction
  const RINGS = FLAKE_RINGS,
    SEGS = FLAKE_SEGS;
  const pos: number[] = [],
    lift: number[] = [],
    cut: number[] = [],
    flk: number[] = [],
    sd: number[] = [],
    idx: number[] = [];
  const rimR = new Float32Array(SEGS);
  for (let a = 0; a < N; a++) {
    const ax = seeds[a * 3],
      ay = seeds[a * 3 + 1],
      az = seeds[a * 3 + 2];
    // tangent frame
    let tx = -az,
      ty = 0,
      tz = ax;
    let tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-4) {
      tx = 1;
      ty = 0;
      tz = 0;
      tl = 1;
    }
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const bx = ay * tz - az * ty,
      by = az * tx - ax * tz,
      bz = ax * ty - ay * tx;
    const size = sizeAt(ax, ay, az);
    const at = (rho: number, phi: number, out: number[]) => {
      const c = Math.cos(phi) * rho,
        sn = Math.sin(phi) * rho;
      let x = ax + c * tx + sn * bx,
        y = ay + c * ty + sn * by,
        z = az + c * tz + sn * bz;
      const l = Math.sqrt(x * x + y * y + z * z);
      x /= l;
      y /= l;
      z /= l;
      out[0] = x;
      out[1] = y;
      out[2] = z;
    };
    // the rim: walk out until just past the crack, then bisect
    const margin = 0.05 * s.flake; // patches overlap their neighbours; the fragment cut draws the edge
    for (let k = 0; k < SEGS; k++) {
      const phi = (k / SEGS) * 2 * Math.PI;
      let r0 = 0,
        r1 = 0;
      const step = size * 0.12;
      for (let r = step; r < size * 3; r += step) {
        at(r, phi, d);
        border(a, d[0], d[1], d[2]);
        if (hard < -margin) {
          r1 = r;
          break;
        }
        r0 = r;
      }
      if (!r1) r1 = size * 3;
      for (let it = 0; it < 7; it++) {
        const r = 0.5 * (r0 + r1);
        at(r, phi, d);
        border(a, d[0], d[1], d[2]);
        if (hard < -margin) r1 = r;
        else r0 = r;
      }
      rimR[k] = r1;
    }
    // a peel direction: the flake lets go from one side first and rolls up like a scroll
    const pa = rand() * 2 * Math.PI,
      beta = 0.35 + 0.65 * rand();
    const px = Math.cos(pa) * tx + Math.sin(pa) * bx,
      py = Math.cos(pa) * ty + Math.sin(pa) * by,
      pz = Math.cos(pa) * tz + Math.sin(pa) * bz;
    const base = pos.length / 3;
    const onset = onsetAt(ax, ay, az);
    const r = rand();
    let Lmin = Infinity,
      Lmax = -Infinity;
    const Ls: number[] = [];
    // centre, then rings denser towards the rim where the curl happens
    const verts: number[][] = [];
    verts.push([ax, ay, az]);
    for (let ring = 1; ring <= RINGS; ring++) {
      const f = 1 - Math.pow(1 - ring / RINGS, 1.6);
      for (let k = 0; k < SEGS; k++) {
        const out = [0, 0, 0];
        at(rimR[k] * f, (k / SEGS) * 2 * Math.PI, out);
        verts.push(out);
      }
    }
    for (const v of verts) {
      const dd = border(a, v[0], v[1], v[2]);
      // peel coordinate: border distance tilted along the peel direction; its gradient, laid in the tangent plane
      const ramp = beta * ((v[0] - ax) * px + (v[1] - ay) * py + (v[2] - az) * pz);
      const L = dd + ramp;
      let gx = g[0] + beta * px,
        gy = g[1] + beta * py,
        gz = g[2] + beta * pz;
      const dn = gx * v[0] + gy * v[1] + gz * v[2];
      gx -= dn * v[0];
      gy -= dn * v[1];
      gz -= dn * v[2];
      Ls.push(L);
      if (hard > 0) {
        Lmin = Math.min(Lmin, L);
        Lmax = Math.max(Lmax, L);
      }
      pos.push(v[0] * s.paint, v[1] * s.paint, v[2] * s.paint);
      lift.push(gx, gy, gz, L);
      cut.push(hard);
      sd.push(ax, ay, az, r);
    }
    const curl = (Lmax - Lmin) * (0.12 + 0.16 * rand());
    for (let k = 0; k < verts.length; k++) flk.push(onset, Lmin, Lmax, curl);
    // triangles: fan in the middle, quads outside
    for (let k = 0; k < SEGS; k++) idx.push(base, base + 1 + k, base + 1 + ((k + 1) % SEGS));
    for (let ring = 1; ring < RINGS; ring++)
      for (let k = 0; k < SEGS; k++) {
        const i0 = base + 1 + (ring - 1) * SEGS + k,
          i1 = base + 1 + (ring - 1) * SEGS + ((k + 1) % SEGS);
        const j0 = i0 + SEGS,
          j1 = i1 + SEGS;
        idx.push(i0, j0, j1, i0, j1, i1);
      }
  }
  lap("flakes");

  return {
    fieldW: W,
    fieldH: H,
    field,
    position: new Float32Array(pos),
    lift: new Float32Array(lift),
    cut: new Float32Array(cut),
    flake: new Float32Array(flk),
    seed: new Float32Array(sd),
    index: new Uint32Array(idx),
    flakes: N,
    ms,
  };
}

// ---- the same, on any closed surface (Suzanne): a dense mesh for the iron, and its signed distance field
// (tools/suzanne.py) to lay the paint on and for the flakes to slide on. Onset and veins live on the mesh
// vertices instead of an equirect texture; flakes are cut by 3D bisector planes and projected back onto the skin.
export type Surface = {
  position: Float32Array;
  normal: Float32Array;
  index: Uint32Array;
  sdf: { n: number; origin: number; step: number; data: Float32Array; half: Uint16Array };
};
export type BakedMesh = Baked & {
  coreField: Float32Array; // per iron vertex: onset, vein
  paintField: Float32Array; // per paint vertex: onset, vein
  paintNormal: Float32Array; // per paint vertex: rest normal
  flakeNormal: Float32Array; // per flake: normal at its centre
};

export function loadSurface(mesh: ArrayBuffer, sdf: ArrayBuffer): Surface {
  const [nv, nt] = new Uint32Array(mesh, 0, 2);
  const position = new Float32Array(mesh, 8, nv * 3);
  const normal = new Float32Array(mesh, 8 + nv * 12, nv * 3);
  const index = new Uint32Array(mesh, 8 + nv * 24, nt * 3);
  const n = new Uint32Array(sdf, 0, 1)[0];
  const [origin, step] = new Float32Array(sdf, 4, 2);
  const half = new Uint16Array(sdf, 12, n * n * n);
  const data = new Float32Array(n * n * n);
  for (let k = 0; k < data.length; k++) data[k] = fromHalf(half[k]);
  return { position, normal, index, sdf: { n, origin, step, data, half } };
}

function fromHalf(h: number) {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const m = h & 0x3ff;
  if (e === 0) return s * m * 2 ** -24;
  if (e === 31) return m ? NaN : s * Infinity;
  return s * (1 + m / 1024) * 2 ** (e - 15);
}

// trilinear signed distance and its gradient
export function sdfSampler(sdf: Surface["sdf"]) {
  const { n, origin, step, data } = sdf;
  const at = (x: number, y: number, z: number) => {
    const fx = Math.min(Math.max((x - origin) / step - 0.5, 0), n - 1.001),
      fy = Math.min(Math.max((y - origin) / step - 0.5, 0), n - 1.001),
      fz = Math.min(Math.max((z - origin) / step - 0.5, 0), n - 1.001);
    const i = Math.floor(fx),
      j = Math.floor(fy),
      k = Math.floor(fz);
    const tx = fx - i,
      ty = fy - j,
      tz = fz - k;
    const o = (k * n + j) * n + i;
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    const nn = n * n;
    return l(l(l(data[o], data[o + 1], tx), l(data[o + n], data[o + n + 1], tx), ty), l(l(data[o + nn], data[o + nn + 1], tx), l(data[o + nn + n], data[o + nn + n + 1], tx), ty), tz);
  };
  const e = step * 0.5;
  const grad = (x: number, y: number, z: number, out: number[]) => {
    const gx = at(x + e, y, z) - at(x - e, y, z),
      gy = at(x, y + e, z) - at(x, y - e, z),
      gz = at(x, y, z + e) - at(x, y, z - e);
    const l = Math.hypot(gx, gy, gz) || 1;
    out[0] = gx / l;
    out[1] = gy / l;
    out[2] = gz / l;
  };
  // onto the zero set, a few Newton steps along the gradient
  const g = [0, 0, 0];
  const project = (p: number[]) => {
    for (let it = 0; it < 4; it++) {
      const d = at(p[0], p[1], p[2]);
      grad(p[0], p[1], p[2], g);
      p[0] -= g[0] * d;
      p[1] -= g[1] * d;
      p[2] -= g[2] * d;
      if (Math.abs(d) < 1e-5) break;
    }
  };
  return { at, grad, project };
}

export function bakeMesh(surf: Surface, s = shape): BakedMesh {
  const ms: Record<string, number> = {};
  let t0 = performance.now();
  const lap = (name: string) => {
    const t = performance.now();
    ms[name] = Math.round(t - t0);
    t0 = t;
  };
  const rand = rng(s.seed);
  const n1 = noise3(s.seed + 1);
  const n2 = noise3(s.seed + 2);
  const n3 = noise3(s.seed + 3);
  const n4 = noise3(s.seed + 4);
  const fbm = (x: number, y: number, z: number, oct: number) => {
    let a = 0,
      amp = 0.5,
      f = 1,
      norm = 0;
    for (let o = 0; o < oct; o++) {
      a += amp * n4(x * f + o * 7.1, y * f, z * f);
      norm += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return a / norm;
  };
  const S = sdfSampler(surf.sdf);
  const P = surf.position,
    NV = P.length / 3;

  // ---- veins, on the iron's vertices (exact) and a wider version that sets how fast corrosion runs
  const ridges = (x: number, y: number, z: number) => {
    const wx = x + 0.22 * n1(x * 2.1, y * 2.1, z * 2.1 + 3.3);
    const wy = y + 0.22 * n1(x * 2.1 + 5.2, y * 2.1, z * 2.1);
    const wz = z + 0.22 * n1(x * 2.1, y * 2.1 + 9.4, z * 2.1);
    return [1 - Math.abs(n2(wx * 3.2, wy * 3.2, wz * 3.2)), 1 - Math.abs(n3(wx * 7.7, wy * 7.7, wz * 7.7))];
  };
  const veinAt = (x: number, y: number, z: number) => {
    const [r1, r2] = ridges(x, y, z);
    return Math.max(Math.pow(r1, 14), 0.75 * Math.pow(r2, 18));
  };
  const coreField = new Float32Array(NV * 2);
  const speed = new Float32Array(NV);
  for (let v = 0; v < NV; v++) {
    const x = P[v * 3],
      y = P[v * 3 + 1],
      z = P[v * 3 + 2];
    const [r1, r2] = ridges(x, y, z);
    coreField[v * 2 + 1] = Math.max(Math.pow(r1, 14), 0.75 * Math.pow(r2, 18));
    // the mesh is coarser than the sphere's texture: a wider channel keeps the fast tracks connected
    const wide = Math.max(Math.pow(r1, 6), 0.75 * Math.pow(r2, 8));
    const slow = 0.5 + 0.5 * fbm(x * 2.5, y * 2.5, z * 2.5, 4);
    speed[v] = 0.25 + 0.9 * slow * slow + 5 * wide;
  }
  lap("veins");

  // ---- onset: Dijkstra over the mesh edges from a few pits
  const deg = new Uint32Array(NV + 1);
  const I = surf.index;
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) deg[I[t + k] + 1] += 2;
  for (let v = 0; v < NV; v++) deg[v + 1] += deg[v];
  const adj = new Uint32Array(deg[NV]);
  const fillAt = deg.slice(0, NV);
  for (let t = 0; t < I.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = I[t + k],
        b = I[t + ((k + 1) % 3)];
      adj[fillAt[a]++] = b;
      adj[fillAt[b]++] = a;
    }
  const time = new Float64Array(NV).fill(Infinity);
  const heap = new Heap();
  for (let k = 0; k < s.pits; k++) {
    let v = 0;
    do v = Math.floor(rand() * NV);
    while (Math.abs(P[v * 3 + 1]) > 0.8);
    const start = rand() * 0.6;
    if (start < time[v]) {
      time[v] = start;
      heap.push(start, v);
    }
  }
  while (heap.n) {
    const [t, a] = heap.pop();
    if (t > time[a]) continue;
    for (let e = deg[a]; e < deg[a + 1]; e++) {
      const b = adj[e];
      const len = Math.hypot(P[a * 3] - P[b * 3], P[a * 3 + 1] - P[b * 3 + 1], P[a * 3 + 2] - P[b * 3 + 2]);
      const nt = t + (2 * len) / (speed[a] + speed[b]);
      if (nt < time[b]) {
        time[b] = nt;
        heap.push(nt, b);
      }
    }
  }
  const sorted = Float64Array.from(time).sort();
  const lo = sorted[Math.floor(NV * 0.03)],
    hi = sorted[Math.floor(NV * 0.97)];
  for (let v = 0; v < NV; v++) coreField[v * 2] = (time[v] - lo) / (hi - lo);
  // nearest iron vertex, for the onset under a point of paint
  const VC = 0.03,
    VG = Math.ceil(2.4 / VC);
  const vgrid = new Map<number, number[]>();
  const vkey = (x: number, y: number, z: number) => (Math.floor((x + 1.2) / VC) * VG + Math.floor((y + 1.2) / VC)) * VG + Math.floor((z + 1.2) / VC);
  for (let v = 0; v < NV; v++) {
    const k = vkey(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    if (!vgrid.has(k)) vgrid.set(k, []);
    vgrid.get(k)!.push(v);
  }
  const onsetAt = (x: number, y: number, z: number) => {
    const gx = Math.floor((x + 1.2) / VC),
      gy = Math.floor((y + 1.2) / VC),
      gz = Math.floor((z + 1.2) / VC);
    let best = Infinity,
      val = 0;
    for (let a = gx - 1; a <= gx + 1; a++)
      for (let b = gy - 1; b <= gy + 1; b++)
        for (let c = gz - 1; c <= gz + 1; c++) {
          const list = vgrid.get((a * VG + b) * VG + c);
          if (list)
            for (const v of list) {
              const d2 = (P[v * 3] - x) ** 2 + (P[v * 3 + 1] - y) ** 2 + (P[v * 3 + 2] - z) ** 2;
              if (d2 < best) ((best = d2), (val = coreField[v * 2]));
            }
        }
    return val;
  };
  lap("onset");

  // ---- flakes: Poisson disk over the surface (area-weighted triangle samples)
  const nT = I.length / 3;
  const cdf = new Float64Array(nT);
  let area = 0;
  for (let t = 0; t < nT; t++) {
    const a = I[t * 3] * 3,
      b = I[t * 3 + 1] * 3,
      c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a],
      uy = P[b + 1] - P[a + 1],
      uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a],
      vy = P[c + 1] - P[a + 1],
      vz = P[c + 2] - P[a + 2];
    area += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    cdf[t] = area;
  }
  const samplePoint = (out: number[]) => {
    const r = rand() * area;
    let l = 0,
      h = nT - 1;
    while (l < h) {
      const m = (l + h) >> 1;
      if (cdf[m] < r) l = m + 1;
      else h = m;
    }
    let u = rand(),
      w = rand();
    if (u + w > 1) ((u = 1 - u), (w = 1 - w));
    const a = I[l * 3] * 3,
      b = I[l * 3 + 1] * 3,
      c = I[l * 3 + 2] * 3;
    for (let k = 0; k < 3; k++) out[k] = P[a + k] + u * (P[b + k] - P[a + k]) + w * (P[c + k] - P[a + k]);
  };
  const sizeAt = (x: number, y: number, z: number) => s.flake * Math.max(0.55, 1 + s.flakeSpread * fbm(x * 1.6 + 11, y * 1.6, z * 1.6, 3) * 1.6);
  const seeds: number[] = [];
  const cell = s.flake * 0.6;
  const G = Math.ceil(2.4 / cell);
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => (Math.floor((x + 1.2) / cell) * G + Math.floor((y + 1.2) / cell)) * G + Math.floor((z + 1.2) / cell);
  const near = (x: number, y: number, z: number, r: number, fn: (k: number) => void) => {
    const gx = Math.floor((x + 1.2) / cell),
      gy = Math.floor((y + 1.2) / cell),
      gz = Math.floor((z + 1.2) / cell);
    const R = Math.ceil(r / cell);
    for (let a = gx - R; a <= gx + R; a++)
      for (let b = gy - R; b <= gy + R; b++)
        for (let c = gz - R; c <= gz + R; c++) {
          const list = grid.get((a * G + b) * G + c);
          if (list) for (const k of list) fn(k);
        }
  };
  const d = [0, 0, 0];
  let misses = 0;
  while (misses < 4000) {
    samplePoint(d);
    const [x, y, z] = d;
    const r = sizeAt(x, y, z);
    let ok = true;
    near(x, y, z, r * 1.6, (k) => {
      if (!ok) return;
      const dx = seeds[k * 3] - x,
        dy = seeds[k * 3 + 1] - y,
        dz = seeds[k * 3 + 2] - z;
      const rk = Math.min(r, sizeAt(seeds[k * 3], seeds[k * 3 + 1], seeds[k * 3 + 2]));
      if (dx * dx + dy * dy + dz * dz < rk * rk) ok = false;
    });
    if (!ok) {
      misses++;
      continue;
    }
    misses = 0;
    const id = seeds.length / 3;
    seeds.push(x, y, z);
    const kk = key(x, y, z);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk)!.push(id);
  }
  const N = seeds.length / 3;
  // cells are cut in position + LAM·normal: across a thin part (an ear) the two faces are near in space but
  // far apart in normal, so a flake on one face never loses ground to a seed on the other
  const LAM = 0.12;
  const sn = new Float32Array(N * 3);
  for (let a = 0; a < N; a++) {
    S.grad(seeds[a * 3], seeds[a * 3 + 1], seeds[a * 3 + 2], d);
    sn.set([d[0] * LAM, d[1] * LAM, d[2] * LAM], a * 3);
  }
  // bisector planes: distance from q to the plane between a and b is q·e − c, e = (a−b)/|a−b|, c = mid·e (6D)
  const nb: Float32Array[] = [];
  for (let a = 0; a < N; a++) {
    const ax = seeds[a * 3],
      ay = seeds[a * 3 + 1],
      az = seeds[a * 3 + 2];
    const r = sizeAt(ax, ay, az) * 2.8;
    const list: number[][] = [];
    near(ax, ay, az, r, (b) => {
      if (b === a) return;
      const bx = seeds[b * 3],
        by = seeds[b * 3 + 1],
        bz = seeds[b * 3 + 2];
      const ex = ax - bx,
        ey = ay - by,
        ez = az - bz;
      if (ex * ex + ey * ey + ez * ez > r * r) return;
      const fx = sn[a * 3] - sn[b * 3],
        fy = sn[a * 3 + 1] - sn[b * 3 + 1],
        fz = sn[a * 3 + 2] - sn[b * 3 + 2];
      const l = Math.sqrt(ex * ex + ey * ey + ez * ez + fx * fx + fy * fy + fz * fz);
      const c = 0.5 * ((ax + bx) * ex + (ay + by) * ey + (az + bz) * ez + (sn[a * 3] + sn[b * 3]) * fx + (sn[a * 3 + 1] + sn[b * 3 + 1]) * fy + (sn[a * 3 + 2] + sn[b * 3 + 2]) * fz);
      list.push([l, ex / l, ey / l, ez / l, fx / l, fy / l, fz / l, c / l]);
    });
    list.sort((p, q) => p[0] - q[0]);
    const e = new Float32Array(Math.min(16, list.length) * 7);
    for (let k = 0; k < e.length / 7; k++) e.set(list[k].slice(1), k * 7);
    nb.push(e);
  }
  lap("seeds");

  const sharp = 1 / (0.05 * s.flake);
  const q = [0, 0, 0];
  const warp = (x: number, y: number, z: number) => {
    const f1 = 0.9 / s.flake,
      f2 = 3.7 / s.flake,
      A1 = s.wobble * s.flake,
      A2 = 0.25 * s.wobble * s.flake;
    q[0] = x + A1 * n1(x * f1, y * f1, z * f1 + 17.1) + A2 * n2(x * f2 + 3.3, y * f2, z * f2);
    q[1] = y + A1 * n1(x * f1 + 41.7, y * f1, z * f1) + A2 * n2(x * f2, y * f2 + 7.7, z * f2);
    q[2] = z + A1 * n1(x * f1, y * f1 + 23.9, z * f1) + A2 * n2(x * f2, y * f2, z * f2 + 1.9);
  };
  const g = [0, 0, 0];
  let hard = 0;
  const nq = [0, 0, 0];
  const border = (a: number, x: number, y: number, z: number) => {
    S.grad(x, y, z, nq);
    warp(x, y, z);
    const e = nb[a];
    let lo = Infinity;
    const m = e.length / 7;
    const ds = new Float64Array(m);
    for (let k = 0; k < m; k++) {
      const o = k * 7;
      ds[k] = q[0] * e[o] + q[1] * e[o + 1] + q[2] * e[o + 2] + LAM * (nq[0] * e[o + 3] + nq[1] * e[o + 4] + nq[2] * e[o + 5]) - e[o + 6];
      if (ds[k] < lo) lo = ds[k];
    }
    hard = lo;
    let sum = 0;
    g[0] = g[1] = g[2] = 0;
    for (let k = 0; k < m; k++) {
      const wgt = Math.exp(-sharp * (ds[k] - lo));
      sum += wgt;
      g[0] += wgt * e[k * 7];
      g[1] += wgt * e[k * 7 + 1];
      g[2] += wgt * e[k * 7 + 2];
    }
    g[0] /= sum;
    g[1] /= sum;
    g[2] /= sum;
    return lo - Math.log(sum) / sharp;
  };

  const RINGS = FLAKE_RINGS,
    SEGS = FLAKE_SEGS;
  const off = s.paint - 1; // the paint skin sits this far out along the normal
  const pos: number[] = [],
    nrm: number[] = [],
    pf: number[] = [],
    lift: number[] = [],
    cut: number[] = [],
    flk: number[] = [],
    sd: number[] = [],
    fn: number[] = [],
    idx: number[] = [];
  const rimR = new Float32Array(SEGS);
  const nv = [0, 0, 0];
  for (let a = 0; a < N; a++) {
    const ax = seeds[a * 3],
      ay = seeds[a * 3 + 1],
      az = seeds[a * 3 + 2];
    const na = [0, 0, 0];
    S.grad(ax, ay, az, na);
    // tangent frame
    let tx = na[2],
      ty = 0,
      tz = -na[0];
    let tl = Math.hypot(tx, ty, tz);
    if (tl < 1e-4) ((tx = 1), (ty = 0), (tz = 0), (tl = 1));
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const bx = na[1] * tz - na[2] * ty,
      by = na[2] * tx - na[0] * tz,
      bz = na[0] * ty - na[1] * tx;
    const size = sizeAt(ax, ay, az);
    const at = (rho: number, phi: number, out: number[]) => {
      const c = Math.cos(phi) * rho,
        sn = Math.sin(phi) * rho;
      out[0] = ax + c * tx + sn * bx;
      out[1] = ay + c * ty + sn * by;
      out[2] = az + c * tz + sn * bz;
      S.project(out);
    };
    const margin = 0.05 * s.flake;
    for (let k = 0; k < SEGS; k++) {
      const phi = (k / SEGS) * 2 * Math.PI;
      let r0 = 0,
        r1 = 0;
      const step = size * 0.12;
      for (let r = step; r < size * 3; r += step) {
        at(r, phi, d);
        border(a, d[0], d[1], d[2]);
        if (hard < -margin) {
          r1 = r;
          break;
        }
        r0 = r;
      }
      if (!r1) r1 = size * 3;
      for (let it = 0; it < 7; it++) {
        const r = 0.5 * (r0 + r1);
        at(r, phi, d);
        border(a, d[0], d[1], d[2]);
        if (hard < -margin) r1 = r;
        else r0 = r;
      }
      rimR[k] = r1;
    }
    const pa = rand() * 2 * Math.PI,
      beta = 0.35 + 0.65 * rand();
    const px = Math.cos(pa) * tx + Math.sin(pa) * bx,
      py = Math.cos(pa) * ty + Math.sin(pa) * by,
      pz = Math.cos(pa) * tz + Math.sin(pa) * bz;
    const base = pos.length / 3;
    const onset = onsetAt(ax, ay, az);
    const r = rand();
    let Lmin = Infinity,
      Lmax = -Infinity;
    const verts: number[][] = [[ax, ay, az]];
    for (let ring = 1; ring <= RINGS; ring++) {
      const f = 1 - Math.pow(1 - ring / RINGS, 1.6);
      for (let k = 0; k < SEGS; k++) {
        const out = [0, 0, 0];
        at(rimR[k] * f, (k / SEGS) * 2 * Math.PI, out);
        verts.push(out);
      }
    }
    const nvs: number[][] = [],
      Ls: number[] = [];
    for (const v of verts) {
      const dd = border(a, v[0], v[1], v[2]);
      S.grad(v[0], v[1], v[2], nv);
      nvs.push([nv[0], nv[1], nv[2]]);
      const L = dd + beta * ((v[0] - ax) * px + (v[1] - ay) * py + (v[2] - az) * pz);
      Ls.push(L);
      if (hard > 0) {
        Lmin = Math.min(Lmin, L);
        Lmax = Math.max(Lmax, L);
      }
      pos.push(v[0] + nv[0] * off, v[1] + nv[1] * off, v[2] + nv[2] * off);
      nrm.push(nv[0], nv[1], nv[2]);
      pf.push(onsetAt(v[0], v[1], v[2]), veinAt(v[0], v[1], v[2]));
      cut.push(hard);
      sd.push(ax + na[0] * off, ay + na[1] * off, az + na[2] * off, r);
    }
    // the peel gradient along the skin, fitted (least squares, in each vertex's tangent plane) to how L changes
    // to its neighbours on the flake's own grid. The vertex stage divides by its length to turn L into distance;
    // the cut's own gradient leaves out the normal half of its 6D planes, so across a thin edge it came out short
    // and flakes there curled up to 4× too far, into spikes.
    const nbrs = (k: number) => {
      if (k === 0) return Array.from({ length: SEGS }, (_, j) => 1 + j);
      const ring = 1 + Math.floor((k - 1) / SEGS),
        j = (k - 1) % SEGS,
        at = (rr: number, jj: number) => 1 + (rr - 1) * SEGS + ((jj + SEGS) % SEGS);
      const out = [at(ring, j - 1), at(ring, j + 1), ring > 1 ? at(ring - 1, j) : 0];
      if (ring < RINGS) out.push(at(ring + 1, j));
      return out;
    };
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k],
        n = nvs[k];
      // tangent basis
      let ux = n[2],
        uy = 0,
        uz = -n[0];
      let ul = Math.hypot(ux, uy, uz);
      if (ul < 1e-4) ((ux = 1), (uy = 0), (uz = 0), (ul = 1));
      ((ux /= ul), (uy /= ul), (uz /= ul));
      const wx = n[1] * uz - n[2] * uy,
        wy = n[2] * ux - n[0] * uz,
        wz = n[0] * uy - n[1] * ux;
      let s11 = 0,
        s12 = 0,
        s22 = 0,
        b1 = 0,
        b2 = 0;
      for (const o of nbrs(k)) {
        const dx = verts[o][0] - v[0],
          dy = verts[o][1] - v[1],
          dz = verts[o][2] - v[2];
        const p = dx * ux + dy * uy + dz * uz,
          q = dx * wx + dy * wy + dz * wz,
          dL = Ls[o] - Ls[k];
        const wgt = 1 / (p * p + q * q + 1e-10); // each edge counts as a slope, whatever its length
        s11 += wgt * p * p;
        s12 += wgt * p * q;
        s22 += wgt * q * q;
        b1 += wgt * p * dL;
        b2 += wgt * q * dL;
      }
      const det = s11 * s22 - s12 * s12;
      let gp = 0,
        gq = 0;
      if (det > 1e-12) ((gp = (s22 * b1 - s12 * b2) / det), (gq = (s11 * b2 - s12 * b1) / det));
      lift.push(gp * ux + gq * wx, gp * uy + gq * wy, gp * uz + gq * wz, Ls[k]);
    }
    fn.push(na[0], na[1], na[2]);
    const curl = (Lmax - Lmin) * (0.12 + 0.16 * rand());
    for (let k = 0; k < verts.length; k++) flk.push(onset, Lmin, Lmax, curl);
    for (let k = 0; k < SEGS; k++) idx.push(base, base + 1 + k, base + 1 + ((k + 1) % SEGS));
    for (let ring = 1; ring < RINGS; ring++)
      for (let k = 0; k < SEGS; k++) {
        const i0 = base + 1 + (ring - 1) * SEGS + k,
          i1 = base + 1 + (ring - 1) * SEGS + ((k + 1) % SEGS);
        idx.push(i0, i0 + SEGS, i1 + SEGS, i0, i1 + SEGS, i1);
      }
  }
  lap("flakes");

  return {
    fieldW: 0,
    fieldH: 0,
    field: new Uint16Array(0),
    position: new Float32Array(pos),
    lift: new Float32Array(lift),
    cut: new Float32Array(cut),
    flake: new Float32Array(flk),
    seed: new Float32Array(sd),
    index: new Uint32Array(idx),
    flakes: N,
    ms,
    coreField,
    paintField: new Float32Array(pf),
    paintNormal: new Float32Array(nrm),
    flakeNormal: new Float32Array(fn),
  };
}
