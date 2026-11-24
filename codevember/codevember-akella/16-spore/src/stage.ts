// The baked pile, replayed. Every key's one life is drawn several times over, a period apart: the older copies a
// screw step lower each, so the picture at the end of the loop is the picture at its start whatever the lives did.
// Everything is put in the stage's frame, which climbs and turns with the screw: there the eye and the lights
// stand still, and the pile sinks and turns past them.
import { capAt, lengthAt, openAt, radAt } from "./sim.ts";

export const RINGS = 38;
export const SIDES = 8;
export const CAP_TOP = 9; // rings over the dome
export const CAP_UNDER = 5; // and back under it to the stem
export const CAP_RINGS = CAP_TOP + CAP_UNDER;
export const CAP_SIDES = 18;

// the box the light is followed through, in the stage's frame
export const VOL = {
  nx: 72,
  ny: 104,
  nz: 72,
  cell: 0.05,
  x0: -1.8,
  y0: -2.9,
  z0: -1.8,
};
// the same box at half the fineness, for the light from outside; and round the axis, for the lamp inside
export const HALF = { nx: 36, ny: 52, nz: 36, cell: 0.1 };
export const ROUND = { nr: 32, ny: 52, nt: 64, R: 1.8, dy: 0.1 };

type KeyHead = {
  tau: number;
  x: number;
  y: number;
  z: number;
  L: number;
  D: number;
  rad: number;
  cap: number;
  life: number;
  seed: number; burst: number[]; creep: number; pop: number;
  a0: number;
  frames: number;
};
type Head = {
  T: number;
  H: number;
  TURN: number;
  DEPTH: number;
  fps: number;
  pts: number;
  Q: number;
  keys: KeyHead[];
};

export async function load(url: string) {
  const buf = await (await fetch(url)).arrayBuffer();
  const hl = new DataView(buf).getUint32(0, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl))) as Head;
  return new Stage(head, new Int16Array(buf, 4 + hl));
}

const table = (n: number) => {
  const c = new Float64Array(n + 1),
    s = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    c[i] = Math.cos((i / n) * Math.PI * 2);
    s[i] = Math.sin((i / n) * Math.PI * 2);
  }
  return { c, s };
};
const UNDER = -2.75; // no picture reaches this far down
const ROUND_STEM = table(SIDES),
  ROUND_CAP = table(CAP_SIDES);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Stage {
  head: Head;
  data: Int16Array;
  start: number[] = [];
  max: number;
  count = 0;
  share = 1; // of the mushrooms baked, how many are drawn: the rest are left out, every copy of them
  flop = 0.03; // how far a cap is left behind when its stem is thrown: a lean, per unit of the top's acceleration
  rank: number[]; // which go first: spread evenly through the period
  stem: {
    pos: Float32Array;
    nor: Float32Array;
    aux: Float32Array;
    index: Uint32Array;
  };
  cap: {
    pos: Float32Array;
    nor: Float32Array;
    aux: Float32Array;
    index: Uint32Array;
  };
  fill: Float32Array;
  coarse: Float32Array; // how full each place is, 0..1
  keyWay: Float32Array; // flesh the outside light crossed to get there, as a length
  outside: Uint16Array; // the two as half floats, for the picture
  ring: Float32Array; // how full, round the axis
  lampWay: Float32Array; // flesh the lamp's light crossed
  inside: Uint16Array;
  tips: Float32Array; // of each mushroom drawn: tip xyz and cap radius, for whoever wants them
  private ctrl: Float64Array;
  private line: Float64Array;
  private near = new Float64Array(6);

  constructor(head: Head, data: Int16Array) {
    this.head = head;
    this.data = data;
    let at = 0;
    for (const k of head.keys) {
      this.start.push(at);
      at += k.frames;
    }
    // the order of leaving: bits of the index reversed, so any share is spread evenly over the births
    const bits = Math.ceil(Math.log2(head.keys.length));
    const rev = head.keys.map((_, i) => {
      let r = 0;
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
      return r;
    });
    const sorted = rev.map((r, i) => [r, i]).sort((a, b) => a[0] - b[0]);
    this.rank = [];
    sorted.forEach(([, i], place) => (this.rank[i] = place));
    this.max = head.keys.reduce((a, k) => a + Math.ceil(k.life / head.T) + 1, 0);
    const sv = this.max * RINGS * (SIDES + 1),
      cv = this.max * CAP_RINGS * (CAP_SIDES + 1);
    this.stem = {
      pos: new Float32Array(sv * 3),
      nor: new Float32Array(sv * 3),
      aux: new Float32Array(sv * 4),
      index: tubes(this.max, RINGS, SIDES),
    };
    this.cap = {
      pos: new Float32Array(cv * 3),
      nor: new Float32Array(cv * 3),
      aux: new Float32Array(cv * 4),
      index: tubes(this.max, CAP_RINGS, CAP_SIDES, true),
    };
    this.fill = new Float32Array(VOL.nx * VOL.ny * VOL.nz);
    const hn = HALF.nx * HALF.ny * HALF.nz,
      rn = ROUND.nr * ROUND.ny * ROUND.nt;
    this.coarse = new Float32Array(hn);
    this.keyWay = new Float32Array(hn);
    this.outside = new Uint16Array(hn * 2);
    this.ring = new Float32Array(rn);
    this.lampWay = new Float32Array(rn);
    this.inside = new Uint16Array(rn);
    this.tips = new Float32Array(this.max * 4);
    this.ctrl = new Float64Array(head.pts * 3);
    this.line = new Float64Array(RINGS * 3);
  }

  // where a key's top (or the point `back` below it) is at a place between its kept frames
  topAt(ki: number, frames: number, f: number, out: Float64Array, o: number, back = 0) {
    const { pts, Q } = this.head;
    const data = this.data;
    f = Math.min(frames - 1.0001, Math.max(0, f));
    const i1 = Math.floor(f),
      w = f - i1;
    const i0 = Math.max(0, i1 - 1),
      i2 = Math.min(frames - 1, i1 + 1),
      i3 = Math.min(frames - 1, i1 + 2);
    const w0 = ((-w + 2) * w - 1) * w * 0.5,
      w1 = ((3 * w - 5) * w * w + 2) * 0.5,
      w2 = ((-3 * w + 4) * w + 1) * w * 0.5,
      w3 = (w - 1) * w * w * 0.5;
    const step = pts * 3,
      base = (this.start[ki] * pts + pts - 1 - back) * 3;
    for (let d = 0; d < 3; d++) out[o + d] = (data[base + i0 * step + d] * w0 + data[base + i1 * step + d] * w1 + data[base + i2 * step + d] * w2 + data[base + i3 * step + d] * w3) * Q;
  }

  // the pile at `t` seconds into the loop
  pose(t: number) {
    const { T, H, TURN, DEPTH, fps, pts, Q, keys } = this.head;
    const data = this.data;
    const ctrl = this.ctrl,
      line = this.line;
    const v = H / T;
    this.fill.fill(0);
    let n = 0;
    for (let ki = 0; ki < keys.length; ki++) {
      const k = keys[ki];
      if (this.rank[ki] >= this.share * keys.length) continue;
      for (let g = 0; ; g++) {
        const age = t - k.tau + g * T;
        if (age < 0) continue;
        if (age >= k.life) break;
        // ---- where its points are: between four kept frames
        const f = Math.min(k.frames - 1.0001, Math.max(0, (age - k.a0) * fps));
        const i1 = Math.floor(f),
          w = f - i1;
        const i0 = Math.max(0, i1 - 1),
          i2 = Math.min(k.frames - 1, i1 + 1),
          i3 = Math.min(k.frames - 1, i1 + 2);
        const w0 = ((-w + 2) * w - 1) * w * 0.5,
          w1 = ((3 * w - 5) * w * w + 2) * 0.5,
          w2 = ((-3 * w + 4) * w + 1) * w * 0.5,
          w3 = (w - 1) * w * w * 0.5;
        const base = this.start[ki] * pts * 3;
        const o0 = base + i0 * pts * 3,
          o1 = base + i1 * pts * 3,
          o2 = base + i2 * pts * 3,
          o3 = base + i3 * pts * 3;
        for (let i = 0; i < pts * 3; i++) ctrl[i] = (data[o0 + i] * w0 + data[o1 + i] * w1 + data[o2 + i] * w2 + data[o3 + i] * w3) * Q;
        // ---- a smooth line through them
        for (let r = 0; r < RINGS; r++) {
          const s = (r / (RINGS - 1)) * (pts - 1);
          const j1 = Math.min(pts - 2, Math.floor(s)),
            u = s - j1;
          const j0 = Math.max(0, j1 - 1),
            j2 = j1 + 1,
            j3 = Math.min(pts - 1, j1 + 2);
          const c0 = ((-u + 2) * u - 1) * u * 0.5,
            c1 = ((3 * u - 5) * u * u + 2) * 0.5,
            c2 = ((-3 * u + 4) * u + 1) * u * 0.5,
            c3 = (u - 1) * u * u * 0.5;
          for (let d = 0; d < 3; d++) line[r * 3 + d] = ctrl[j0 * 3 + d] * c0 + ctrl[j1 * 3 + d] * c1 + ctrl[j2 * 3 + d] * c2 + ctrl[j3 * 3 + d] * c3;
        }
        // ---- into the stage: turned and sunk by how long ago it was born
        const phase = g + t / T;
        const a = -phase * TURN;
        const ca = Math.cos(a),
          sa = Math.sin(a);
        const rx = k.x * ca - k.z * sa,
          rz = k.x * sa + k.z * ca,
          ry = -DEPTH + k.y - v * age;
        const rad = radAt(k, age),
          capR = capAt(k, age),
          open = openAt(k, age),
          len = lengthAt(k, age);
        this.stemOf(n, line, ca, sa, rx, ry, rz, rad, len, k.seed, age / k.D);
        // a cap has weight: when its stem is thrown one way the cap is left behind, leaning the other. How hard the
        // top is being thrown is read off its track a kept frame either side, so it is the same every time round
        const near = this.near;
        this.topAt(ki, k.frames, f - 1, near, 0);
        this.topAt(ki, k.frames, f + 1, near, 3);
        const heavy = -this.flop * fps * fps * Math.min(1, Math.max(0, open));
        let fx = (near[0] + near[3] - 2 * ctrl[pts * 3 - 3]) * heavy,
          fy = (near[1] + near[4] - 2 * ctrl[pts * 3 - 2]) * heavy,
          fz = (near[2] + near[5] - 2 * ctrl[pts * 3 - 1]) * heavy;
        const far = Math.hypot(fx, fy, fz);
        if (far > 0.45) {
          fx *= 0.45 / far;
          fy *= 0.45 / far;
          fz *= 0.45 / far;
        }
        this.capOf(n, line, ca, sa, rx, ry, rz, rad, capR, open, k.seed, fx, fy, fz);
        n++;
      }
    }
    this.count = n;
  }

  // What the light crosses on its way to every place, for the pile as posed. The lamp is a length of the axis from
  // `low` to `high`; the outside light comes from `key` (towards it). One sweep each: a cell is its neighbour nearer
  // the light plus its own flesh.
  light(low: number, high: number, key: [number, number, number]) {
    const fill = this.fill;
    const { coarse, keyWay, outside, ring, lampWay, inside } = this;
    const hx = HALF.nx,
      hy = HALF.ny,
      hz = HALF.nz;
    const fx = VOL.nx,
      fxy = VOL.nx * VOL.ny;
    for (let z = 0; z < hz; z++)
      for (let y = 0; y < hy; y++) {
        const o = fx * (2 * y) + fxy * (2 * z);
        for (let x = 0; x < hx; x++) {
          const q = o + 2 * x;
          const v = (fill[q] + fill[q + 1] + fill[q + fx] + fill[q + fx + 1] + fill[q + fxy] + fill[q + fxy + 1] + fill[q + fxy + fx] + fill[q + fxy + fx + 1]) * 0.125;
          coarse[x + hx * (y + hy * z)] = v > 1 ? 1 : v;
        }
      }
    // ---- from outside: slice by slice along the axis the light runs most along
    const ak = [Math.abs(key[0]), Math.abs(key[1]), Math.abs(key[2])];
    const A = ak[0] >= ak[1] && ak[0] >= ak[2] ? 0 : ak[1] >= ak[2] ? 1 : 2;
    const B = (A + 1) % 3,
      C = (A + 2) % 3;
    const dims = [hx, hy, hz],
      strides = [1, hx, hx * hy];
    const nA = dims[A],
      nB = dims[B],
      nC = dims[C],
      sA = strides[A],
      sB = strides[B],
      sC = strides[C];
    const dir = key[A] > 0 ? 1 : -1; // the light comes from this end
    const db = key[B] / ak[A],
      dc = key[C] / ak[A];
    const step = HALF.cell / ak[A];
    for (let q = 0; q < nA; q++) {
      const a = dir > 0 ? nA - 1 - q : q;
      for (let c = 0; c < nC; c++)
        for (let b = 0; b < nB; b++) {
          const o = a * sA + b * sB + c * sC;
          let before = 0;
          if (q > 0) {
            const pb = b + db,
              pc = c + dc;
            const ib = Math.floor(pb),
              ic = Math.floor(pc);
            const wb = pb - ib,
              wc = pc - ic;
            const po = (a + dir) * sA;
            const b0 = ib >= 0 && ib < nB,
              b1 = ib + 1 >= 0 && ib + 1 < nB,
              c0 = ic >= 0 && ic < nC,
              c1 = ic + 1 >= 0 && ic + 1 < nC;
            const q00 = po + ib * sB + ic * sC;
            const v00 = b0 && c0 ? keyWay[q00] : 0,
              v10 = b1 && c0 ? keyWay[q00 + sB] : 0,
              v01 = b0 && c1 ? keyWay[q00 + sC] : 0,
              v11 = b1 && c1 ? keyWay[q00 + sB + sC] : 0;
            before = (v00 * (1 - wb) + v10 * wb) * (1 - wc) + (v01 * (1 - wb) + v11 * wb) * wc;
          }
          keyWay[o] = before + coarse[o] * step;
        }
    }
    for (let i = 0; i < coarse.length; i++) {
      outside[i * 2] = half(coarse[i]);
      outside[i * 2 + 1] = half(keyWay[i]);
    }
    // ---- from the lamp: the box read round the axis, then swept outward along the rays from the lamp
    const { nr, ny, nt, R, dy } = ROUND;
    const dr = R / nr;
    const inv = 1 / VOL.cell;
    for (let t = 0; t < nt; t++) {
      const th = ((t + 0.5) / nt) * Math.PI * 2;
      const ct = Math.cos(th),
        st = Math.sin(th);
      for (let i = 0; i < nr; i++) {
        const r = (i + 0.5) * dr;
        const gx = (r * ct - VOL.x0) * inv - 0.5,
          gz = (r * st - VOL.z0) * inv - 0.5;
        const ix = Math.min(VOL.nx - 2, Math.max(0, Math.floor(gx))),
          iz = Math.min(VOL.nz - 2, Math.max(0, Math.floor(gz)));
        const wx = Math.min(1, Math.max(0, gx - ix)),
          wz = Math.min(1, Math.max(0, gz - iz));
        const w00 = (1 - wx) * (1 - wz) * 0.5,
          w10 = wx * (1 - wz) * 0.5,
          w01 = (1 - wx) * wz * 0.5,
          w11 = wx * wz * 0.5;
        const col = ix + fxy * iz;
        for (let j = 0; j < ny; j++) {
          const o = col + fx * (2 * j);
          const v = (fill[o] + fill[o + fx]) * w00 + (fill[o + 1] + fill[o + fx + 1]) * w10 + (fill[o + fxy] + fill[o + fxy + fx]) * w01 + (fill[o + fxy + 1] + fill[o + fxy + fx + 1]) * w11;
          ring[i + nr * (j + ny * t)] = v > 1 ? 1 : v;
        }
      }
      const base = nr * ny * t;
      const jLow = Math.max(0, Math.ceil((low - VOL.y0) / dy - 0.5)),
        jHigh = Math.min(ny - 1, Math.floor((high - VOL.y0) / dy - 0.5));
      // level with the lamp the light goes straight out
      for (let j = jLow; j <= jHigh; j++) {
        const o = base + nr * j;
        lampWay[o] = ring[o] * dr * 0.5;
        for (let i = 1; i < nr; i++) lampWay[o + i] = lampWay[o + i - 1] + (ring[o + i - 1] + ring[o + i]) * 0.5 * dr;
      }
      // above it (then below it) the light fans from the lamp's end
      for (const up of [1, -1]) {
        const end = up > 0 ? high : low;
        for (let j = up > 0 ? jHigh + 1 : jLow - 1; j >= 0 && j < ny; j += up) {
          const y = VOL.y0 + (j + 0.5) * dy;
          const h = (y - end) * up;
          const o = base + nr * j;
          for (let i = 0; i < nr; i++) {
            const r = (i + 0.5) * dr;
            const rho = ring[o + i];
            if (r <= h) {
              // steep: it came through the row before
              if (h <= dy) {
                lampWay[o + i] = rho * Math.sqrt(r * r + h * h);
                continue;
              }
              const fi = Math.max(0, (r * (h - dy)) / h / dr - 0.5);
              const i0 = Math.min(nr - 2, Math.floor(fi)),
                w = Math.min(1, fi - i0);
              const p = o - up * nr;
              lampWay[o + i] = lampWay[p + i0] * (1 - w) + lampWay[p + i0 + 1] * w + rho * dy * Math.sqrt(1 + (r * r) / (h * h));
            } else {
              // shallow: it came through the column before
              if (i === 0) {
                lampWay[o] = rho * Math.sqrt(r * r + h * h);
                continue;
              }
              const yp = end + (up * h * (r - dr)) / r;
              const fj = Math.min(ny - 1, Math.max(0, (yp - VOL.y0) / dy - 0.5));
              const j0 = Math.min(ny - 2, Math.floor(fj)),
                w = fj - j0;
              lampWay[o + i] = lampWay[base + nr * j0 + i - 1] * (1 - w) + lampWay[base + nr * (j0 + 1) + i - 1] * w + rho * dr * Math.sqrt(1 + (h * h) / (r * r));
            }
          }
        }
      }
    }
    for (let i = 0; i < lampWay.length; i++) inside[i] = half(lampWay[i]);
  }

  private stemOf(n: number, line: Float64Array, ca: number, sa: number, rx: number, ry: number, rz: number, rad: number, len: number, seed: number, grown: number) {
    const { pos, nor, aux } = this.stem;
    // a frame carried up the line without twisting, begun the same way every time in the mushroom's own frame
    let nx = 1,
      ny = 0,
      nz = 0;
    let px = 0,
      py = 0,
      pz = 0;
    for (let r = 0; r < RINGS; r++) {
      const a = Math.max(0, r - 1) * 3,
        b = Math.min(RINGS - 1, r + 1) * 3;
      let tx = line[b] - line[a],
        ty = line[b + 1] - line[a + 1],
        tz = line[b + 2] - line[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      const dn = nx * tx + ny * ty + nz * tz;
      nx -= tx * dn;
      ny -= ty * dn;
      nz -= tz * dn;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const bx = ty * nz - tz * ny,
        by = tz * nx - tx * nz,
        bz = tx * ny - ty * nx;
      const u = r / (RINGS - 1);
      // a little stouter at the foot, drawn in under the cap
      const rr = rad * (1 + 0.28 * (1 - u) ** 3 - 0.14 * smooth(0.45, 0.97, u));
      const cx = line[r * 3],
        cy = line[r * 3 + 1],
        cz = line[r * 3 + 2];
      const o = (n * RINGS + r) * (SIDES + 1);
      // far under the picture a ring is only a point: nothing sees it, the light still counts it below
      if (ry + cy < UNDER && ry + line[Math.min(RINGS - 1, r + 1) * 3 + 1] < UNDER) {
        const X = rx + cx * ca - cz * sa,
          Y = ry + cy,
          Z = rz + cx * sa + cz * ca;
        for (let s = 0; s <= SIDES; s++) {
          const q = (o + s) * 3;
          pos[q] = X;
          pos[q + 1] = Y;
          pos[q + 2] = Z;
        }
      } else
        for (let s = 0; s <= SIDES; s++) {
          const c = ROUND_STEM.c[s],
            sn = ROUND_STEM.s[s];
          const ox = nx * c + bx * sn,
            oy = ny * c + by * sn,
            oz = nz * c + bz * sn;
          const X = cx + ox * rr,
            Z = cz + oz * rr;
          const q = (o + s) * 3;
          pos[q] = rx + X * ca - Z * sa;
          pos[q + 1] = ry + cy + oy * rr;
          pos[q + 2] = rz + X * sa + Z * ca;
          nor[q] = ox * ca - oz * sa;
          nor[q + 1] = oy;
          nor[q + 2] = ox * sa + oz * ca;
          const w = (o + s) * 4;
          aux[w] = u * len;
          aux[w + 1] = s / SIDES;
          aux[w + 2] = rr;
          aux[w + 3] = seed + Math.floor(Math.min(1.5, grown) * 100);
        }
      // what the light has to cross
      if (r > 0) {
        const d = Math.hypot(cx - px, cy - py, cz - pz);
        const steps = Math.max(1, Math.ceil(d / (VOL.cell * 0.8)));
        const vol = (Math.PI * rr * rr * d) / steps;
        for (let q = 0; q < steps; q++) {
          const f = (q + 0.5) / steps;
          const X = px + (cx - px) * f,
            Z = pz + (cz - pz) * f;
          this.splat(rx + X * ca - Z * sa, ry + py + (cy - py) * f, rz + X * sa + Z * ca, vol);
        }
      }
      px = cx;
      py = cy;
      pz = cz;
    }
  }

  private capOf(n: number, line: Float64Array, ca: number, sa: number, rx: number, ry: number, rz: number, rad: number, c: number, open: number, seed: number, fx: number, fy: number, fz: number) {
    const { pos, nor, aux } = this.cap;
    const e = (RINGS - 1) * 3;
    let ax = line[e] - line[e - 6],
      ay = line[e + 1] - line[e - 5],
      az = line[e + 2] - line[e - 4];
    let al = Math.hypot(ax, ay, az) || 1;
    ax = ax / al + fx;
    ay = ay / al + fy;
    az = az / al + fz;
    al = Math.hypot(ax, ay, az) || 1;
    ax /= al;
    ay /= al;
    az /= al;
    // any two directions across the axis
    let ux = 1 - ax * ax,
      uy = -ax * ay,
      uz = -ax * az;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = ay * uz - az * uy,
      vy = az * ux - ax * uz,
      vz = ax * uy - ay * ux;
    // the dome: a ball when young, flatter and wider as it opens, its rim rolled a little under
    const kh = 1.05 - 0.25 * open - 0.12 * (seed * 7.13 - Math.floor(seed * 7.13));
    const tm = 2.1 - 0.15 * open;
    const neck = rad * 0.86;
    const rm = c * Math.sin(tm);
    const hm = c * kh * Math.cos(tm);
    const rise = 0.3 * c * kh * (0.4 + 0.6 * open);
    const h0 = -(hm + rise);
    const cl1 = Math.cos(seed * 31.7),
      sl1 = Math.sin(seed * 31.7),
      cl2 = Math.cos(seed * 57.3),
      sl2 = Math.sin(seed * 57.3);
    const tx = line[e],
      ty = line[e + 1],
      tz = line[e + 2];
    if (ry + ty + c * 1.2 < UNDER) {
      // under the picture: nothing sees it
      const X = rx + tx * ca - tz * sa,
        Y = ry + ty,
        Z = rz + tx * sa + tz * ca;
      const o = n * CAP_RINGS * (CAP_SIDES + 1) * 3;
      for (let q = o; q < o + CAP_RINGS * (CAP_SIDES + 1) * 3; q += 3) {
        pos[q] = X;
        pos[q + 1] = Y;
        pos[q + 2] = Z;
      }
    } else
      for (let r = 0; r < CAP_RINGS; r++) {
        let R: number, Hh: number, dR: number, dH: number, w: number;
        if (r < CAP_TOP) {
          const th = Math.max(1e-3, (r / (CAP_TOP - 1)) * tm);
          R = c * Math.sin(th);
          Hh = h0 + c * kh * Math.cos(th);
          dR = c * Math.cos(th);
          dH = -c * kh * Math.sin(th);
          w = r / (CAP_TOP - 1);
        } else {
          const q = (r - CAP_TOP + 1) / CAP_UNDER;
          R = rm + (neck - rm) * q;
          Hh = h0 + hm + rise * (1 - (1 - q) * (1 - q));
          dR = neck - rm;
          dH = rise * 2 * (1 - q);
          w = 1 + q;
        }
        const dl = Math.hypot(dR, dH) || 1;
        // outward normal of the profile: its tangent turned a quarter
        const nR = -dH / dl,
          nH = dR / dl;
        const o = (n * CAP_RINGS + r) * (CAP_SIDES + 1);
        for (let s = 0; s <= CAP_SIDES; s++) {
          const cs = ROUND_CAP.c[s],
            sn = ROUND_CAP.s[s];
          // two and three lumps round the rim, from the same table
          const s2 = (2 * s) % CAP_SIDES,
            s3 = (3 * s) % CAP_SIDES;
          const lump = 1 + (0.07 * (ROUND_CAP.s[s2] * cl1 + ROUND_CAP.c[s2] * sl1) + 0.045 * (ROUND_CAP.s[s3] * cl2 + ROUND_CAP.c[s3] * sl2)) * Math.min(1, w) * open;
          const ox = ux * cs + vx * sn,
            oy = uy * cs + vy * sn,
            oz = uz * cs + vz * sn;
          const X = tx + ox * R * lump + ax * Hh,
            Y = ty + oy * R * lump + ay * Hh,
            Z = tz + oz * R * lump + az * Hh;
          const NX = ox * nR + ax * nH,
            NY = oy * nR + ay * nH,
            NZ = oz * nR + az * nH;
          const q = (o + s) * 3;
          pos[q] = rx + X * ca - Z * sa;
          pos[q + 1] = ry + Y;
          pos[q + 2] = rz + X * sa + Z * ca;
          nor[q] = NX * ca - NZ * sa;
          nor[q + 1] = NY;
          nor[q + 2] = NX * sa + NZ * ca;
          const wq = (o + s) * 4;
          aux[wq] = w;
          aux[wq + 1] = s / CAP_SIDES;
          aux[wq + 2] = c;
          aux[wq + 3] = seed + Math.floor(open * 250);
        }
      }
    const X = tx + ax * (h0 + 0.3 * c * kh),
      Y = ty + ay * (h0 + 0.3 * c * kh),
      Z = tz + az * (h0 + 0.3 * c * kh);
    const sx = rx + X * ca - Z * sa,
      sy = ry + Y,
      sz = rz + X * sa + Z * ca;
    this.tips[n * 4] = sx;
    this.tips[n * 4 + 1] = sy;
    this.tips[n * 4 + 2] = sz;
    this.tips[n * 4 + 3] = c;
    const vol = 1.6 * c * c * c * kh;
    const d = 0.45 * c;
    this.splat(sx, sy, sz, vol * 0.4);
    this.splat(sx + d, sy, sz, vol * 0.15);
    this.splat(sx - d, sy, sz, vol * 0.15);
    this.splat(sx, sy, sz + d, vol * 0.15);
    this.splat(sx, sy, sz - d, vol * 0.15);
  }

  private splat(x: number, y: number, z: number, vol: number) {
    const { nx, ny, nz, cell, x0, y0, z0 } = VOL;
    const fx = (x - x0) / cell - 0.5,
      fy = (y - y0) / cell - 0.5,
      fz = (z - z0) / cell - 0.5;
    const ix = Math.floor(fx),
      iy = Math.floor(fy),
      iz = Math.floor(fz);
    if (ix < 0 || iy < 0 || iz < 0 || ix >= nx - 1 || iy >= ny - 1 || iz >= nz - 1) return;
    const wx = fx - ix,
      wy = fy - iy,
      wz = fz - iz;
    const m = vol / (cell * cell * cell);
    const fill = this.fill;
    const o = ix + nx * (iy + ny * iz);
    const a = m * (1 - wz),
      b = m * wz;
    fill[o] += a * (1 - wy) * (1 - wx);
    fill[o + 1] += a * (1 - wy) * wx;
    fill[o + nx] += a * wy * (1 - wx);
    fill[o + nx + 1] += a * wy * wx;
    fill[o + nx * ny] += b * (1 - wy) * (1 - wx);
    fill[o + nx * ny + 1] += b * (1 - wy) * wx;
    fill[o + nx * ny + nx] += b * wy * (1 - wx);
    fill[o + nx * ny + nx + 1] += b * wy * wx;
  }
}

// a float as the 16 bits of a half float (small positive numbers only)
const f32 = new Float32Array(1),
  u32 = new Uint32Array(f32.buffer);
function half(v: number) {
  f32[0] = v;
  const x = u32[0];
  const e = ((x >> 23) & 0xff) - 112;
  if (e <= 0) return e < -10 ? 0 : (((x & 0x7fffff) | 0x800000) >> (14 - e)) & 0x3ff;
  if (e >= 31) return 0x7c00;
  return (e << 10) | ((x >> 13) & 0x3ff);
}

// triangles of `count` tubes of `rings` rings of `sides` faces each: a ring has one more point than faces, the
// last on top of the first, so that what is drawn round it does not run backwards across the last face
function tubes(count: number, rings: number, sides: number, flip = false) {
  const index = new Uint32Array(count * (rings - 1) * sides * 6);
  let w = 0;
  for (let n = 0; n < count; n++)
    for (let r = 0; r < rings - 1; r++)
      for (let s = 0; s < sides; s++) {
        const a = (n * rings + r) * (sides + 1) + s,
          b = a + 1,
          c = a + sides + 1,
          d = c + 1;
        index[w++] = a;
        index[w++] = flip ? c : b;
        index[w++] = flip ? b : c;
        index[w++] = b;
        index[w++] = flip ? c : d;
        index[w++] = flip ? d : c;
      }
  return index;
}
