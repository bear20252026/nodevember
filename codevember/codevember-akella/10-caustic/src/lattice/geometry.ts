/**
 * The lattice as a mesh. A foam of jittered cells is laid on the vessel's unrolled skin (round the vessel
 * by height, wrapping round): each cell's polygon is clipped from its neighbours' bisectors, so every edge
 * comes out once with both of its junctions, and the cuts along the crown and the foot are the rim rings.
 * Edges are warped by a noise of position alone (so they still meet), mapped onto the outline and swept
 * into tubes that swell towards their junctions; some cells get a thinner chord across. Thorns, crown
 * spikes and hanging threads are tapered tubes too.
 */

export type LatticeParams = {
  /** the vessel (unrolled, with rims, spikes and threads) or a mesh's own surface */
  form: "vessel" | "suzanne";
  cells: number;
  layers: number;
  shrink: number;
  jitter: number;
  warp: number;
  fine: number;
  rMain: number;
  rFine: number;
  rRim: number;
  flare: number;
  crown: number;
  crownLen: number;
  thorns: number;
  thornLen: number;
  hem: number;
  hemLen: number;
  sides: number;
  seed: number;
  /** one continuous surface with filleted junctions, rather than separate tubes */
  merge: boolean;
  /** how far strands melt into each other where they meet (metres) */
  fillet: number;
  /** the merged surface's grid on the skin (metres) */
  res: number;
};

export const SHAPE = { Rmax: 0.5, Hlen: 1.75, y0: -0.92 };

export const KIND = { strand: 0, rim: 1, thorn: 2, thread: 3, fine: 4 } as const;

/** floats per vertex: position, normal, (layer, kind, sway, seed), the form's own normal there */
export const STRIDE = 13;

type V3 = [number, number, number];

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** the outline, as in the ray-marched vessel: an egg-round foot, a straight body, a slight neck, a flared crown */
export const profile = (v: number) => {
  const f = clamp(v / 0.3, 0, 1);
  let r = mix(0.5, 1, Math.sqrt(1 - (1 - f) * (1 - f)));
  r *= 1 + 0.04 * Math.sin(Math.PI * clamp((v - 0.2) / 0.6, 0, 1));
  r = mix(r, 0.9, smoothstep(0.62, 0.86, v));
  r = mix(r, 1.12, smoothstep(0.86, 1, v) ** 1.3);
  return r;
};

export const mulberry = (a: number) => () => {
  a |= 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const hash2 = (x: number, y: number, s: number) => {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** value noise wrapping every `period` round */
const pnoise = (x: number, y: number, period: number, s: number) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const w = (i: number) => ((i % period) + period) % period;
  const a = hash2(w(ix), iy, s);
  const b = hash2(w(ix + 1), iy, s);
  const c = hash2(w(ix), iy + 1, s);
  const d = hash2(w(ix + 1), iy + 1, s);
  return mix(mix(a, b, ux), mix(c, d, ux), uy);
};

type Pt = { x: number; y: number; l: number };

/** keep the side of a line where f <= 0; the new edge along the line gets label `lab` */
const clip = (poly: Pt[], f: (x: number, y: number) => number, lab: number): Pt[] => {
  const out: Pt[] = [];
  const n = poly.length;
  for (let k = 0; k < n; k++) {
    const P = poly[k];
    const Q = poly[(k + 1) % n];
    const dp = f(P.x, P.y);
    const dq = f(Q.x, Q.y);
    if (dp <= 0) out.push(P);
    if (dp <= 0 !== dq <= 0) {
      const t = dp / (dp - dq);
      const I = { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t, l: 0 };
      I.l = dp <= 0 ? lab : P.l;
      out.push(I);
    }
  }
  return out;
};

export type Lattice = { vertices: Float32Array<ArrayBuffer>; indices: Uint32Array<ArrayBuffer>; glints: Float32Array<ArrayBuffer>; stats: { tris: number; edges: number; cells: number } };

/** a typed array that grows as it is pushed to */
export class Grow<T extends Float32Array<ArrayBuffer> | Uint32Array<ArrayBuffer>> {
  a: T;
  length = 0;
  constructor(private make: (n: number) => T) {
    this.a = make(1 << 16);
  }
  push(...v: number[]) {
    if (this.length + v.length > this.a.length) {
      const b = this.make(Math.max(this.a.length * 2, this.length + v.length));
      b.set(this.a);
      this.a = b;
    }
    for (let i = 0; i < v.length; i++) this.a[this.length++] = v[i];
    return this.length;
  }
  done() {
    return this.a.slice(0, this.length) as T;
  }
}

export const buildLattice = (p: LatticeParams): Lattice => {
  const verts = new Grow((n) => new Float32Array(n));
  const idx = new Grow((n) => new Uint32Array(n));
  const glints: number[] = [];
  let edgeCount = 0;
  let cellCount = 0;

  /** a tube along points, radius per point; tips may taper to nothing */
  const tube = (pts: V3[], radii: number[], layer: number, kind: number, sway: number[] | null, seed: number) => {
    const n = pts.length;
    if (n < 2) return;
    const S = p.sides;
    const base = verts.length / STRIDE;
    let N: V3 | null = null;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)];
      const b = pts[Math.min(n - 1, i + 1)];
      let T: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const tl = Math.hypot(...T) || 1;
      T = [T[0] / tl, T[1] / tl, T[2] / tl];
      if (!N) {
        // start from whichever axis is least along the tube
        const ref: V3 = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
        N = [ref[1] * T[2] - ref[2] * T[1], ref[2] * T[0] - ref[0] * T[2], ref[0] * T[1] - ref[1] * T[0]];
      }
      // carried along without twisting
      const d: number = N[0] * T[0] + N[1] * T[1] + N[2] * T[2];
      N = [N[0] - T[0] * d, N[1] - T[1] * d, N[2] - T[2] * d];
      const nl: number = Math.hypot(...N) || 1;
      N = [N[0] / nl, N[1] / nl, N[2] / nl];
      const B: V3 = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
      const r = radii[i];
      for (let s = 0; s < S; s++) {
        const ang = (s / S) * Math.PI * 2;
        const c = Math.cos(ang);
        const sn = Math.sin(ang);
        const dir: V3 = [N[0] * c + B[0] * sn, N[1] * c + B[1] * sn, N[2] * c + B[2] * sn];
        const rl = Math.hypot(pts[i][0], pts[i][2]) || 1;
        verts.push(pts[i][0] + dir[0] * r, pts[i][1] + dir[1] * r, pts[i][2] + dir[2] * r, dir[0], dir[1], dir[2], layer, kind, sway ? sway[i] : 0, seed, pts[i][0] / rl, 0, pts[i][2] / rl);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let s = 0; s < S; s++) {
        const a = base + i * S + s;
        const b = base + i * S + ((s + 1) % S);
        const c = base + (i + 1) * S + s;
        const d = base + (i + 1) * S + ((s + 1) % S);
        // outward facing: (b - a) x (c - a) runs along B x T = N, out of the tube
        idx.push(a, b, c, b, d, c);
      }
    }
  };

  /**
   * The strands of one skin as a single surface. On a fine grid over the skin, g is the smooth minimum over
   * nearby strands of (distance to the strand minus its radius), so where strands meet they melt into a
   * fillet. Wherever g < 0 there is glass, as thick as a round tube of the nearest strand's radius would be
   * there, and never more (so fillets become flat webs). Marching squares cut the outline exactly; the
   * top and bottom faces meet on it.
   */
  const meshSkin = (strands: { pts: [number, number][]; r: number }[], L: number, nx: number, ny: number, toWorld: (x: number, y: number) => V3) => {
    const k = p.fillet;
    // the skin's frame and scale at a point of the sheet: metres per sheet unit round and up, and the way out
    const frame = (x: number, y: number) => {
      const e = 1e-3;
      const P = toWorld(x, y);
      const a = toWorld(x + e, y);
      const b = toWorld(x - e, y);
      const c = toWorld(x, y + e);
      const d = toWorld(x, y - e);
      const px: V3 = [(a[0] - b[0]) / (2 * e), (a[1] - b[1]) / (2 * e), (a[2] - b[2]) / (2 * e)];
      const py: V3 = [(c[0] - d[0]) / (2 * e), (c[1] - d[1]) / (2 * e), (c[2] - d[2]) / (2 * e)];
      const sx = Math.hypot(...px);
      const sy = Math.hypot(...py);
      const ex: V3 = [px[0] / sx, px[1] / sx, px[2] / sx];
      const ey: V3 = [py[0] / sy, py[1] / sy, py[2] / sy];
      let n: V3 = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]];
      const nl = Math.hypot(...n) || 1;
      n = [n[0] / nl, n[1] / nl, n[2] / nl];
      if (n[0] * P[0] + n[2] * P[2] < 0) n = [-n[0], -n[1], -n[2]];
      return { P, ex, ey, n, sx, sy };
    };

    // the grid: square-ish at the belly, a little past both rims
    const belly = frame(0, ny * 0.45);
    const NX = Math.max(8, Math.round((nx * belly.sx) / p.res));
    const dx = nx / NX;
    const dy = p.res / belly.sy;
    const y0 = -(p.rRim * 2 + k) / belly.sy;
    const NY = Math.ceil((ny - 2 * y0) / dy) + 1;
    // metres per sheet unit along each row (the skin is narrower at the foot)
    const sxRow = new Float32Array(NY);
    for (let j = 0; j < NY; j++) sxRow[j] = frame(0.37, y0 + j * dy).sx;
    const sy = belly.sy;

    // strand segments into bins, so each sample looks only at what is near it
    const BW = 0.25;
    const nbx = Math.ceil(nx / BW);
    const nby = Math.ceil((NY * dy) / BW) + 1;
    const bins: number[][] = Array.from({ length: nbx * nby }, () => []);
    const segs: number[] = [];
    let rMax = 0;
    for (const st of strands) {
      rMax = Math.max(rMax, st.r);
      for (let i = 0; i < st.pts.length - 1; i++) {
        const [ax, ay] = st.pts[i];
        const [bx, by] = st.pts[i + 1];
        const id = segs.length / 5;
        segs.push(ax, ay, bx, by, st.r);
        const sxm = Math.min(sxRow[clamp(Math.round((Math.min(ay, by) - y0) / dy), 0, NY - 1)], sxRow[clamp(Math.round((Math.max(ay, by) - y0) / dy), 0, NY - 1)]);
        const mxr = (st.r + k + 2 * p.res) / sxm;
        const myr = (st.r + k + 2 * p.res) / sy;
        const i0 = Math.floor((Math.min(ax, bx) - mxr) / BW);
        const i1 = Math.floor((Math.max(ax, bx) + mxr) / BW);
        const j0 = Math.max(0, Math.floor((Math.min(ay, by) - myr - y0) / BW));
        const j1 = Math.min(nby - 1, Math.floor((Math.max(ay, by) + myr - y0) / BW));
        for (let bj = j0; bj <= j1; bj++) for (let bi = i0; bi <= i1; bi++) bins[bj * nbx + (((bi % nbx) + nbx) % nbx)].push(id);
      }
    }

    // the field
    const G = new Float32Array(NX * NY).fill(1);
    const Rn = new Float32Array(NX * NY);
    for (let j = 0; j < NY; j++) {
      const y = y0 + j * dy;
      const sxj = sxRow[j];
      const bj = Math.floor((y - y0) / BW);
      for (let i = 0; i < NX; i++) {
        const x = i * dx;
        const list = bins[bj * nbx + (Math.floor(x / BW) % nbx)];
        let g = 1;
        let best = 1;
        let rb = 0;
        for (const s of list) {
          const o = s * 5;
          const ax = segs[o];
          // the segment brought round to the sample's side of the seam
          const shift = nx * Math.round((x - ax) / nx);
          const qx = (x - shift - ax) * sxj;
          const qy = (y - segs[o + 1]) * sy;
          const vx = (segs[o + 2] - ax) * sxj;
          const vy = (segs[o + 3] - segs[o + 1]) * sy;
          const t = clamp((qx * vx + qy * vy) / (vx * vx + vy * vy || 1), 0, 1);
          const d = Math.hypot(qx - vx * t, qy - vy * t) - segs[o + 4];
          if (d < best) {
            best = d;
            rb = segs[o + 4];
          }
          // polynomial smooth minimum
          const h = Math.max(k - Math.abs(g - d), 0) / k;
          g = Math.min(g, d) - h * h * k * 0.25;
        }
        G[j * NX + i] = g;
        Rn[j * NX + i] = rb;
      }
    }

    const at = (i: number, j: number) => G[clamp(j, 0, NY - 1) * NX + (((i % NX) + NX) % NX)];
    /** a vertex of the surface at sheet point (x, y), given g, its world gradient, the strand radius, top or bottom */
    const emit = (x: number, y: number, g: number, gx: number, gy: number, r: number, side: number) => {
      const f = frame(x, y);
      const q = Math.max(0, g + r);
      const T = side * Math.sqrt(Math.max(0, r * r - q * q));
      const P: V3 = [f.P[0] + f.n[0] * T, f.P[1] + f.n[1] * T, f.P[2] + f.n[2] * T];
      // the gradient of sqrt(d^2 + h^2) - r: sideways on the outline, outwards on top
      let N: V3 = [q * (gx * f.ex[0] + gy * f.ey[0]) + T * f.n[0], q * (gx * f.ex[1] + gy * f.ey[1]) + T * f.n[1], q * (gx * f.ex[2] + gy * f.ey[2]) + T * f.n[2]];
      const nl = Math.hypot(...N);
      N = nl > 1e-9 ? [N[0] / nl, N[1] / nl, N[2] / nl] : [f.n[0] * side, f.n[1] * side, f.n[2] * side];
      verts.push(P[0], P[1], P[2], N[0], N[1], N[2], L, KIND.strand, 0, 0, f.n[0], f.n[1], f.n[2]);
      return verts.length / STRIDE - 1;
    };
    const grad = (i: number, j: number): [number, number] => [(at(i + 1, j) - at(i - 1, j)) / (2 * dx * sxRow[clamp(j, 0, NY - 1)]), (at(i, j + 1) - at(i, j - 1)) / (2 * dy * sy)];

    // a vertex pair (top, bottom) for every grid point inside; one shared vertex for every crossing of the outline
    const cornerV = new Int32Array(NX * NY).fill(-1);
    const edgeV = new Int32Array(2 * NX * NY).fill(-1);
    const corner = (i: number, j: number) => {
      const iw = ((i % NX) + NX) % NX;
      const id = j * NX + iw;
      if (cornerV[id] < 0) {
        const [gx, gy] = grad(iw, j);
        const x = i * dx;
        const y = y0 + j * dy;
        cornerV[id] = emit(x, y, G[id], gx, gy, Rn[id], 1);
        emit(x, y, G[id], gx, gy, Rn[id], -1);
      }
      return cornerV[id];
    };
    const crossing = (i0: number, j0: number, i1: number, j1: number) => {
      const iw0 = ((i0 % NX) + NX) % NX;
      const id = (j1 > j0 ? NX * NY : 0) + j0 * NX + iw0;
      if (edgeV[id] < 0) {
        const ga = at(i0, j0);
        const gb = at(i1, j1);
        const t = ga / (ga - gb);
        const [ax, ay] = grad(i0, j0);
        const [bx, by] = grad(i1, j1);
        const x = (i0 + (i1 - i0) * t) * dx;
        const y = y0 + (j0 + (j1 - j0) * t) * dy;
        const ra = Rn[clamp(j0, 0, NY - 1) * NX + iw0];
        const rb = Rn[clamp(j1, 0, NY - 1) * NX + (((i1 % NX) + NX) % NX)];
        edgeV[id] = emit(x, y, 0, ax + (bx - ax) * t, ay + (by - ay) * t, Math.max(ra, rb), 1);
      }
      return edgeV[id];
    };
    const tri = (a: number, b: number, c: number) => {
      // facing the way its corners' normals do
      const pa = a * STRIDE;
      const pb = b * STRIDE;
      const pc = c * STRIDE;
      const ux = verts.a[pb] - verts.a[pa];
      const uy = verts.a[pb + 1] - verts.a[pa + 1];
      const uz = verts.a[pb + 2] - verts.a[pa + 2];
      const wx = verts.a[pc] - verts.a[pa];
      const wy = verts.a[pc + 1] - verts.a[pa + 1];
      const wz = verts.a[pc + 2] - verts.a[pa + 2];
      const nx3 = uy * wz - uz * wy;
      const ny3 = uz * wx - ux * wz;
      const nz3 = ux * wy - uy * wx;
      const sx3 = verts.a[pa + 3] + verts.a[pb + 3] + verts.a[pc + 3];
      const sy3 = verts.a[pa + 4] + verts.a[pb + 4] + verts.a[pc + 4];
      const sz3 = verts.a[pa + 5] + verts.a[pb + 5] + verts.a[pc + 5];
      if (nx3 * sx3 + ny3 * sy3 + nz3 * sz3 >= 0) idx.push(a, b, c);
      else idx.push(a, c, b);
    };
    const C = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    for (let j = 0; j < NY - 1; j++) {
      for (let i = 0; i < NX; i++) {
        const g = C.map(([a, b]) => at(i + a, j + b));
        if (g[0] >= 0 && g[1] >= 0 && g[2] >= 0 && g[3] >= 0) continue;
        // the inside of this square: its inside corners and outline crossings in order round it
        const top: number[] = [];
        const bot: number[] = [];
        for (let c = 0; c < 4; c++) {
          const [ai, aj] = C[c];
          const [bi, bj] = C[(c + 1) % 4];
          if (g[c] < 0) {
            const v = corner(i + ai, j + aj);
            top.push(v);
            bot.push(v + 1);
          }
          if (g[c] < 0 !== g[(c + 1) % 4] < 0) {
            // crossings are keyed from the lower-numbered end of their grid edge
            const v = crossing(i + Math.min(ai, bi), j + Math.min(aj, bj), i + Math.max(ai, bi), j + Math.max(aj, bj));
            top.push(v);
            bot.push(v);
          }
        }
        for (let t = 1; t < top.length - 1; t++) {
          tri(top[0], top[t], top[t + 1]);
          tri(bot[0], bot[t + 1], bot[t]);
        }
      }
    }
  };

  for (let L = 0; L < p.layers; L++) {
    const rnd = mulberry(p.seed * 7919 + L * 104729 + 1);
    const nx = Math.max(6, Math.round(p.cells * Math.pow(0.88, L)));
    const cellW = (2 * Math.PI * SHAPE.Rmax) / nx;
    const ny = Math.max(3, Math.round(SHAPE.Hlen / cellW));
    const shrink = Math.pow(p.shrink, L);
    const salt = p.seed * 31 + L * 977;

    // seeds, with three rows of margin above and below
    const M = 3;
    const rows = ny + 2 * M;
    const jx = new Float32Array(nx * rows);
    const jy = new Float32Array(nx * rows);
    for (let k = 0; k < nx * rows; k++) {
      jx[k] = 0.5 + (rnd() - 0.5) * p.jitter;
      jy[k] = 0.5 + (rnd() - 0.5) * p.jitter;
    }
    const seedAt = (i: number, j: number): [number, number, number] => {
      const iw = ((i % nx) + nx) % nx;
      const k = (j + M) * nx + iw;
      return [i + jx[k], j + jy[k], k];
    };

    // from the sheet (cells round, cells up) to the vessel
    const warpAt = (x: number, y: number): [number, number] => {
      const w = p.warp;
      return [x + w * (pnoise(x, y, nx, salt) - 0.5 + 0.5 * (pnoise(x * 2, y * 2, nx * 2, salt + 5) - 0.5)), y + w * (pnoise(x, y, nx, salt + 9) - 0.5 + 0.5 * (pnoise(x * 2, y * 2, nx * 2, salt + 13) - 0.5))];
    };
    const toWorld = (x: number, y: number): V3 => {
      const u = x / nx;
      // a little past the rims too, where the rim strands' outer halves lie
      let v = y / ny;
      const ang = u * Math.PI * 2;
      // a scalloped crown
      const dip = 0.028 * (0.5 + 0.5 * Math.sin(ang * 13 + 0.6 * Math.sin(ang * 5))) ** 2;
      v -= dip * smoothstep(0.86, 1, v);
      const R = SHAPE.Rmax * profile(clamp(v, 0, 1)) * shrink;
      return [R * Math.cos(ang), SHAPE.y0 + v * SHAPE.Hlen, R * Math.sin(ang)];
    };
    const worldLen = (a: [number, number], b: [number, number]) => Math.hypot((b[0] - a[0]) * cellW, (b[1] - a[1]) * cellW);

    /** a strand between two points of the sheet: warped, mapped, swelling to its ends */
    const strand = (a: [number, number], b: [number, number], r: number, flare: number, kind: number, seed: number, bow = 0) => {
      const m = Math.max(3, Math.ceil(worldLen(a, b) / 0.012));
      const pts: V3[] = [];
      const radii: number[] = [];
      const nxv = -(b[1] - a[1]);
      const nyv = b[0] - a[0];
      const sheet: [number, number][] = [];
      for (let i = 0; i <= m; i++) {
        const t = i / m;
        const bw = bow * Math.sin(Math.PI * t);
        const [x, y] = warpAt(a[0] + (b[0] - a[0]) * t + nxv * bw, a[1] + (b[1] - a[1]) * t + nyv * bw);
        sheet.push([x, y]);
        pts.push(toWorld(x, y));
        radii.push(r * (1 + flare * (Math.exp(-t / 0.07) + Math.exp(-(1 - t) / 0.07))));
      }
      // no thinner than the merged surface's grid can draw cleanly
      if (p.merge) sheetStrands.push({ pts: sheet, r: Math.max(r, p.res * 1.15) });
      else tube(pts, radii, L, kind, null, seed);
      edgeCount++;
    };

    const sheetStrands: { pts: [number, number][]; r: number }[] = [];
    const junctions = new Map<string, [number, number]>();
    const rimPts: [number, number][] = [];
    const footPts: [number, number][] = [];
    for (let j = -1; j <= ny; j++) {
      for (let i = 0; i < nx; i++) {
        const [sx, sy, sk] = seedAt(i, j);
        let poly: Pt[] = [
          { x: sx - 3, y: sy - 3, l: -9 },
          { x: sx + 3, y: sy - 3, l: -9 },
          { x: sx + 3, y: sy + 3, l: -9 },
          { x: sx - 3, y: sy + 3, l: -9 },
        ];
        for (let dj = -2; dj <= 2; dj++) {
          for (let di = -2; di <= 2; di++) {
            if (!di && !dj) continue;
            if (j + dj < -M || j + dj >= ny + M) continue;
            const [tx, ty, tk] = seedAt(i + di, j + dj);
            const mx = (sx + tx) / 2;
            const my = (sy + ty) / 2;
            const ex = tx - sx;
            const ey = ty - sy;
            poly = clip(poly, (x, y) => (x - mx) * ex + (y - my) * ey, tk);
          }
        }
        poly = clip(poly, (_x, y) => -y, -1);
        poly = clip(poly, (_x, y) => y - ny, -2);
        if (poly.length < 3) continue;
        cellCount++;
        const n = poly.length;
        for (let k = 0; k < n; k++) {
          const P = poly[k];
          const Q = poly[(k + 1) % n];
          const lab = P.l;
          const a: [number, number] = [P.x, P.y];
          const b: [number, number] = [Q.x, Q.y];
          if (lab >= 0) {
            // between two cells: drawn once, by the one with the smaller number
            if (sk >= lab) continue;
            const h = hash2(Math.min(sk, lab), Math.max(sk, lab), salt);
            const weight = 0.35 + 1.3 * h * h;
            strand(a, b, p.rMain * weight, p.flare, KIND.strand, h);
            for (const q of [a, b]) junctions.set(`${Math.round((((q[0] % nx) + nx) % nx) * 1000)}:${Math.round(q[1] * 1000)}`, q);
          } else if (lab === -1 || lab === -2) {
            // the rims, on the outer skin only
            if (L > 0) continue;
            strand(a, b, p.rRim * (lab === -2 ? 1 : 0.8), 0.2, KIND.rim, hash2(sk, 7, salt));
            const list = lab === -2 ? rimPts : footPts;
            const len = Math.abs(b[0] - a[0]);
            for (let t = 0; t < len; t += 0.08) list.push([a[0] + ((b[0] - a[0]) * t) / len, a[1]]);
          }
        }
        // a thinner chord across some cells, from one side to another
        // only between edges that are themselves glass (the inner skin draws no rims), or a chord ends in the air
        const drawn = poly.map((P) => P.l >= 0 || (L === 0 && (P.l === -1 || P.l === -2)));
        const ends = [...drawn.keys()].filter((e) => drawn[e]);
        if (j >= 0 && j < ny && ends.length >= 3 && rnd() < p.fine) {
          const e1 = ends[Math.floor(rnd() * ends.length)];
          const others = ends.filter((e) => e !== e1 && e !== (e1 + 1) % n && e !== (e1 + n - 1) % n);
          const e2 = others.length ? others[Math.floor(rnd() * others.length)] : ends[(ends.indexOf(e1) + 1) % ends.length];
          const at = (e: number, t: number): [number, number] => {
            const P = poly[e];
            const Q = poly[(e + 1) % n];
            return [P.x + (Q.x - P.x) * t, P.y + (Q.y - P.y) * t];
          };
          strand(at(e1, 0.3 + 0.4 * rnd()), at(e2, 0.3 + 0.4 * rnd()), p.rFine * (0.7 + 0.6 * rnd()), p.flare * 0.6, KIND.fine, rnd(), (rnd() - 0.5) * 0.25);
        }
      }
    }

    if (p.merge && sheetStrands.length) meshSkin(sheetStrands, L, nx, ny, toWorld);

    const outward = (x: number, y: number) => {
      const w = toWorld(...warpAt(x, y));
      const l = Math.hypot(w[0], w[2]) || 1;
      return { w, radial: [w[0] / l, 0, w[2] / l] as V3, side: [-w[2] / l, 0, w[0] / l] as V3 };
    };
    if (L === 0) {
      // spikes along the crown, each its own angle and length
      for (const q of rimPts) {
        if (rnd() > p.crown) continue;
        const { w, radial, side } = outward(q[0], q[1]);
        const up = 0.35 + 0.8 * rnd();
        const dir: V3 = [radial[0] * (0.7 + 0.4 * rnd()) + side[0] * (rnd() - 0.5) * 0.5, up, radial[2] * (0.7 + 0.4 * rnd()) + side[2] * (rnd() - 0.5) * 0.5];
        const dl = Math.hypot(...dir);
        const len = p.crownLen * (0.5 + 1.5 * rnd() * rnd());
        const tip: V3 = [w[0] + (dir[0] / dl) * len, w[1] + (dir[1] / dl) * len, w[2] + (dir[2] / dl) * len];
        tube([w, [(w[0] + tip[0]) / 2, (w[1] + tip[1]) / 2, (w[2] + tip[2]) / 2], tip], [p.rRim * 0.8, p.rRim * 0.35, 0.0002], 0, KIND.thorn, null, rnd());
        glints.push(...tip, rnd());
      }
      // threads hanging from the foot, swaying more towards their ends
      for (const q of footPts) {
        if (rnd() > p.hem) continue;
        const { w, radial, side } = outward(q[0], q[1]);
        const len = p.hemLen * (0.35 + 0.65 * rnd());
        const curl = (rnd() - 0.5) * 0.4;
        const pts: V3[] = [];
        const radii: number[] = [];
        const sway: number[] = [];
        const m = 10;
        for (let i = 0; i <= m; i++) {
          const t = i / m;
          const out = 0.25 * t + curl * t * t;
          pts.push([w[0] + (radial[0] * out + side[0] * curl * t) * len, w[1] - t * len, w[2] + (radial[2] * out + side[2] * curl * t) * len]);
          radii.push(mix(p.rFine * 1.6, 0.0003, t));
          sway.push(t * t);
        }
        tube(pts, radii, 0, KIND.thread, sway, rnd());
        if (rnd() < 0.4) glints.push(...pts[m], rnd());
      }
      // short thorns from some junctions, slanting every way
      for (const q of junctions.values()) {
        const g = rnd();
        if (g < 0.35) {
          const ww = toWorld(...warpAt(q[0], q[1]));
          glints.push(...ww, rnd());
        }
        if (rnd() > p.thorns) continue;
        const { w, radial, side } = outward(q[0], q[1]);
        const dir: V3 = [radial[0] + side[0] * (rnd() - 0.5) * 0.8, (rnd() - 0.45) * 1.1, radial[2] + side[2] * (rnd() - 0.5) * 0.8];
        const dl = Math.hypot(...dir);
        const len = p.thornLen * (0.4 + 0.6 * rnd());
        const tip: V3 = [w[0] + (dir[0] / dl) * len, w[1] + (dir[1] / dl) * len, w[2] + (dir[2] / dl) * len];
        tube([w, tip], [p.rMain * 0.9, 0.0002], 0, KIND.thorn, null, rnd());
        glints.push(...tip, rnd());
      }
    }
  }

  return {
    vertices: verts.done(),
    indices: idx.done(),
    glints: new Float32Array(glints),
    stats: { tris: idx.length / 3, edges: edgeCount, cells: cellCount },
  };
};
