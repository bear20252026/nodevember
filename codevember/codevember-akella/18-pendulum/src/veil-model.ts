// A ball through a liquid sheet. The sheet is a film under surface tension: its energy is tension x area. Each
// step is Dziuk's semi-implicit scheme: the cotan Laplacian of the surface as it is now (refreshed every few
// steps), positions solved implicitly, so the tension is the same in every direction however the cells stretch,
// and the tiniest cells (the tip, the neck) cannot blow up. A little of the rest mesh's own Laplacian keeps the
// cells from drifting where the area does not care.
//
// A wet ball pushed through such a film is wrapped; the tension pulls the tube behind it into a neck, the neck
// pinches, the film seals behind the ball and the sheet heals. The mesh is a log-polar disc (rings shrinking
// geometrically into a centre pole): flat sheet, sock, tube and wrapped ball keep the ring structure, and the neck
// is a ring. Pinching is a ring collapsing: when a ring behind the ball shrinks below the film's thickness it is
// cut into two poles, one closing the bag, one the sheet's new centre. Each part has its own banded Cholesky
// factor; the ball touches the film by projection, and what it pushes, it feels.

export type VeilParams = {
  S: number; // sectors round a ring
  R: number; // sheet radius (pinned in a hoop)
  r0: number; // innermost ring
  ball: number; // ball radius
  thick: number; // film thickness (the ball touches its inner face)
  gamma: number; // tension
  rho: number; // film mass per area
  mass: number; // ball mass
  v0: number; // ball speed
  z0: number; // ball start (the sheet is the plane z = 0, the ball moves to -z)
  dir: [number, number, number]; // ball direction
  offset: [number, number]; // aim off centre
  fluid: number; // 0: rubber (springs on the rest mesh), 1: liquid (tension on the surface as it is)
  refresh: number; // steps between refactors of the liquid Laplacian
  viscosity: number; // stiffness-proportional damping (film internal)
  drag: number; // mass-proportional damping (air)
  grip: number; // tangential stick on the ball, per unit time
  seal: number; // neck radius at which the film merges
  dt: number;
};

export const VEIL: VeilParams = {
  S: 64,
  R: 4.5,
  r0: 0.03,
  ball: 1,
  thick: 0.06,
  gamma: 1,
  rho: 0.25,
  mass: 60,
  v0: 1.3,
  z0: 2.2,
  dir: [0, 0, -1],
  offset: [0, 0],
  fluid: 0.95,
  refresh: 4,
  viscosity: 0.02,
  drag: 0.4,
  grip: 60,
  seal: 0.05,
  dt: 1 / 60,
};

type Piece = { free: Int32Array; bw: number; L: Float64Array; local: Int32Array };

export class Veil {
  p: VeilParams;
  n = 0; // vertices in use
  cap: number;
  x: Float64Array;
  v: Float64Array;
  m: Float64Array;
  ring: Int32Array; // ring index (-1 for the centre pole)
  sector: Int32Array;
  pinned: Uint8Array;
  // springs: ends, rest weight, weight in use
  ei: number[] = [];
  ej: number[] = [];
  rest: number[] = [];
  W = new Float64Array(0);
  tris: number[] = [];
  triEdge = new Int32Array(0); // per triangle corner: the edge opposite
  adjOff = new Int32Array(0);
  adjJ = new Int32Array(0);
  adjE = new Int32Array(0);
  pieces: Piece[] = [];
  ballX = new Float64Array(3);
  ballV = new Float64Array(3);
  time = 0;
  steps = 0;
  seals: { time: number; ring: number }[] = [];
  topology = 0; // bumped when triangles change
  Nr: number;
  ringRadius: Float64Array;
  private tmp: Float64Array;

  constructor(p: Partial<VeilParams> = {}) {
    this.p = { ...VEIL, ...p };
    const { S, R } = this.p;
    const q = Math.exp((2 * Math.PI) / S);
    this.Nr = Math.ceil(Math.log(R / this.p.r0) / Math.log(q)) + 1;
    this.cap = 1 + this.Nr * S + 16;
    this.x = new Float64Array(this.cap * 3);
    this.v = new Float64Array(this.cap * 3);
    this.m = new Float64Array(this.cap);
    this.ring = new Int32Array(this.cap);
    this.sector = new Int32Array(this.cap);
    this.pinned = new Uint8Array(this.cap);
    this.ringRadius = new Float64Array(this.Nr);
    this.tmp = new Float64Array(this.cap * 3);
    this.reset();
  }

  reset() {
    const { S, R } = this.p;
    const q = Math.exp((2 * Math.PI) / S);
    const Nr = this.Nr;
    const r0 = R / Math.pow(q, Nr - 1);
    this.n = 1 + Nr * S;
    this.x.fill(0);
    this.v.fill(0);
    this.m.fill(0);
    this.ring[0] = -1;
    this.pinned.fill(0);
    const id = (i: number, j: number) => 1 + i * S + (((j % S) + S) % S);
    for (let i = 0; i < Nr; i++) {
      const r = r0 * Math.pow(q, i);
      for (let j = 0; j < S; j++) {
        const k = id(i, j);
        // alternate rings turned half a cell: the cells become rhombi
        const a = ((j + 0.5 * (i & 1)) * 2 * Math.PI) / S;
        this.x[3 * k] = r * Math.cos(a);
        this.x[3 * k + 1] = r * Math.sin(a);
        this.ring[k] = i;
        this.sector[k] = j;
        if (i === Nr - 1) this.pinned[k] = 1;
      }
    }
    // triangles, counter-clockwise seen from +z
    const t: number[] = [];
    for (let j = 0; j < S; j++) t.push(0, id(0, j), id(0, j + 1));
    for (let i = 0; i + 1 < Nr; i++)
      for (let j = 0; j < S; j++) {
        const a = id(i, j), b = id(i, j + 1);
        if (i % 2 === 0) t.push(a, id(i + 1, j), b, b, id(i + 1, j), id(i + 1, j + 1));
        else t.push(a, id(i + 1, j + 1), b, a, id(i + 1, j), id(i + 1, j + 1));
      }
    this.tris = t;
    // springs on every triangle edge, rest weights from the flat mesh; lumped masses
    this.ei = [];
    this.ej = [];
    this.rest = [];
    this.edgeList();
    const w = this.cotan();
    for (let f = 0; f < t.length; f += 3) {
      const a = this.area(t[f], t[f + 1], t[f + 2]);
      for (let c = 0; c < 3; c++) this.m[t[f + c]] += (a / 3) * this.p.rho;
    }
    this.rest = Array.from(w);
    // the ball
    const { dir, offset, z0, v0 } = this.p;
    const dl = Math.hypot(...dir);
    const s = z0 / Math.abs(dir[2] / dl);
    this.ballX.set([offset[0] - (dir[0] / dl) * s, offset[1] - (dir[1] / dl) * s, z0]);
    this.ballV.set(dir.map((d) => (d / dl) * v0));
    this.time = 0;
    this.steps = 0;
    this.seals = [];
    this.build();
  }

  private area(a: number, b: number, c: number) {
    const X = this.x;
    const ux = X[3 * b] - X[3 * a], uy = X[3 * b + 1] - X[3 * a + 1], uz = X[3 * b + 2] - X[3 * a + 2];
    const vx = X[3 * c] - X[3 * a], vy = X[3 * c + 1] - X[3 * a + 1], vz = X[3 * c + 2] - X[3 * a + 2];
    return 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }

  // the edges of the triangles (keeping the rest weights of edges already known), and each corner's opposite edge
  private edgeList() {
    const t = this.tris;
    const key = (i: number, j: number) => (i < j ? i * this.cap + j : j * this.cap + i);
    const known = new Map<number, number>();
    for (let e = 0; e < this.ei.length; e++) known.set(key(this.ei[e], this.ej[e]), this.rest[e]);
    const index = new Map<number, number>();
    const ei: number[] = [], ej: number[] = [], rest: number[] = [];
    this.triEdge = new Int32Array(t.length);
    for (let f = 0; f < t.length; f += 3)
      for (let c = 0; c < 3; c++) {
        const a = t[f + ((c + 1) % 3)], b = t[f + ((c + 2) % 3)];
        const kk = key(a, b);
        let e = index.get(kk);
        if (e === undefined) {
          e = ei.length;
          index.set(kk, e);
          ei.push(a);
          ej.push(b);
          rest.push(known.get(kk) ?? 0);
        }
        this.triEdge[f + c] = e;
      }
    this.ei = ei;
    this.ej = ej;
    this.rest = rest;
    this.W = new Float64Array(ei.length);
  }

  // cotan weights of the surface as it is now (half the cotangent of each opposite corner)
  private cotan(out = new Float64Array(this.ei.length)) {
    out.fill(0);
    const t = this.tris, X = this.x;
    for (let f = 0; f < t.length; f += 3)
      for (let c = 0; c < 3; c++) {
        const o = t[f + c], a = t[f + ((c + 1) % 3)], b = t[f + ((c + 2) % 3)];
        const ux = X[3 * a] - X[3 * o], uy = X[3 * a + 1] - X[3 * o + 1], uz = X[3 * a + 2] - X[3 * o + 2];
        const vx = X[3 * b] - X[3 * o], vy = X[3 * b + 1] - X[3 * o + 1], vz = X[3 * b + 2] - X[3 * o + 2];
        const cr = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
        out[this.triEdge[f + c]] += (0.5 * (ux * vx + uy * vy + uz * vz)) / Math.max(cr, 1e-14);
      }
    return out;
  }

  // pieces (connected parts), each with its own banded factor
  private build() {
    const n = this.n, E = this.ei.length;
    const deg = new Int32Array(n + 1);
    for (let e = 0; e < E; e++) deg[this.ei[e] + 1]++, deg[this.ej[e] + 1]++;
    for (let k = 0; k < n; k++) deg[k + 1] += deg[k];
    this.adjOff = deg.slice();
    this.adjJ = new Int32Array(2 * E);
    this.adjE = new Int32Array(2 * E);
    const fill = deg.slice();
    for (let e = 0; e < E; e++) {
      const i = this.ei[e], j = this.ej[e];
      this.adjJ[fill[i]] = j;
      this.adjE[fill[i]++] = e;
      this.adjJ[fill[j]] = i;
      this.adjE[fill[j]++] = e;
    }
    const seen = new Int32Array(n).fill(-1);
    const used = new Uint8Array(n);
    for (let f = 0; f < this.tris.length; f++) used[this.tris[f]] = 1;
    this.pieces = [];
    const S = this.p.S;
    const zig = (j: number) => (j < S / 2 ? 2 * j : 2 * (S - 1 - j) + 1);
    for (let s = 0; s < n; s++) {
      if (seen[s] >= 0 || !used[s]) continue;
      const list = [s];
      seen[s] = this.pieces.length;
      for (let k = 0; k < list.length; k++)
        for (let a = this.adjOff[list[k]]; a < this.adjOff[list[k] + 1]; a++) {
          const j = this.adjJ[a];
          if (seen[j] < 0) {
            seen[j] = this.pieces.length;
            list.push(j);
          }
        }
      // band order: by ring, then sector zigzagged (0, S-1, 1, S-2, ...) so the ring's wrap is a near neighbour
      // too and the band is about S wide, not 2S (poles sit at their ring's place)
      list.sort((a, b) => this.ring[a] - this.ring[b] || zig(this.sector[a]) - zig(this.sector[b]));
      const free = Int32Array.from(list.filter((k) => !this.pinned[k]));
      const local = new Int32Array(n).fill(-1);
      free.forEach((k, i) => (local[k] = i));
      let bw = 0;
      for (const k of free)
        for (let a = this.adjOff[k]; a < this.adjOff[k + 1]; a++) {
          const l = local[this.adjJ[a]];
          if (l >= 0) bw = Math.max(bw, Math.abs(l - local[k]));
        }
      this.pieces.push({ free, bw, L: new Float64Array(0), local });
    }
    this.factor();
    this.topology++;
  }

  // weights: rest and live blended (live ones clamped at zero so the matrix stays positive), then
  // M (1 + h drag) + gamma (h^2 + h viscosity) L, factored
  factor() {
    const { dt: h, gamma, viscosity, drag, fluid } = this.p;
    const live = fluid > 0 ? this.cotan() : null;
    for (let e = 0; e < this.W.length; e++) this.W[e] = (1 - fluid) * this.rest[e] + (live ? fluid * Math.max(0, live[e]) : 0);
    for (const P of this.pieces) {
      const N = P.free.length, bw = P.bw, B = bw + 1;
      const A = P.L.length === N * B ? P.L.fill(0) : new Float64Array(N * B); // row i, column i - c at A[i * B + c]
      for (let i = 0; i < N; i++) {
        const k = P.free[i];
        A[i * B] += this.m[k] * (1 + h * drag);
        for (let a = this.adjOff[k]; a < this.adjOff[k + 1]; a++) {
          const c = gamma * (h * h + h * viscosity) * this.W[this.adjE[a]];
          A[i * B] += c;
          const l = P.local[this.adjJ[a]];
          if (l >= 0 && l < i) A[i * B + (i - l)] -= c;
        }
      }
      // banded Cholesky, in place (lower)
      for (let i = 0; i < N; i++) {
        const k0 = Math.max(0, i - bw);
        for (let j = k0; j <= i; j++) {
          let s = A[i * B + (i - j)];
          const ri = i * B + i, rj = j * B + j;
          for (let k = Math.max(k0, j - bw); k < j; k++) s -= A[ri - k] * A[rj - k];
          A[i * B + (i - j)] = j === i ? Math.sqrt(Math.max(s, 1e-30)) : s / A[j * B];
        }
      }
      P.L = A;
    }
  }

  step() {
    const { dt: h, gamma, ball, thick, grip, fluid, refresh } = this.p;
    if (fluid > 0 && this.steps % refresh === 0 && this.steps > 0) this.factor();
    const X = this.x, V = this.v, T = this.tmp, Wt = this.W;
    // rhs = M v - h gamma L x
    for (const P of this.pieces) {
      const N = P.free.length, B = P.bw + 1, Lm = P.L, bw = P.bw;
      for (let i = 0; i < N; i++) {
        const k = P.free[i];
        let lx = 0, ly = 0, lz = 0;
        for (let a = this.adjOff[k]; a < this.adjOff[k + 1]; a++) {
          const j = this.adjJ[a], w = Wt[this.adjE[a]];
          lx += w * (X[3 * k] - X[3 * j]);
          ly += w * (X[3 * k + 1] - X[3 * j + 1]);
          lz += w * (X[3 * k + 2] - X[3 * j + 2]);
        }
        const m = this.m[k];
        T[3 * i] = m * V[3 * k] - h * gamma * lx;
        T[3 * i + 1] = m * V[3 * k + 1] - h * gamma * ly;
        T[3 * i + 2] = m * V[3 * k + 2] - h * gamma * lz;
      }
      for (let i = 0; i < N; i++) {
        let a = T[3 * i], b = T[3 * i + 1], c = T[3 * i + 2];
        const r = i * B + i;
        for (let k = Math.max(0, i - bw); k < i; k++) {
          const l = Lm[r - k];
          a -= l * T[3 * k];
          b -= l * T[3 * k + 1];
          c -= l * T[3 * k + 2];
        }
        const d = Lm[i * B];
        T[3 * i] = a / d;
        T[3 * i + 1] = b / d;
        T[3 * i + 2] = c / d;
      }
      for (let i = N - 1; i >= 0; i--) {
        let a = T[3 * i], b = T[3 * i + 1], c = T[3 * i + 2];
        for (let k = i + 1; k <= Math.min(N - 1, i + bw); k++) {
          const l = Lm[k * B + (k - i)];
          a -= l * T[3 * k];
          b -= l * T[3 * k + 1];
          c -= l * T[3 * k + 2];
        }
        const d = Lm[i * B];
        T[3 * i] = a / d;
        T[3 * i + 1] = b / d;
        T[3 * i + 2] = c / d;
      }
      for (let i = 0; i < N; i++) {
        const k = P.free[i];
        for (let c = 0; c < 3; c++) {
          V[3 * k + c] = T[3 * i + c];
          X[3 * k + c] += h * T[3 * i + c];
        }
      }
    }
    // the ball, and the film's inner face against it
    const bx = this.ballX, bv = this.ballV;
    for (let c = 0; c < 3; c++) bx[c] += h * bv[c];
    const rc = ball + thick / 2;
    let px = 0, py = 0, pz = 0;
    const keep = Math.exp(-grip * h);
    for (let k = 0; k < this.n; k++) {
      if (this.pinned[k] || this.m[k] === 0) continue;
      const dx = X[3 * k] - bx[0], dy = X[3 * k + 1] - bx[1], dz = X[3 * k + 2] - bx[2];
      const d = Math.hypot(dx, dy, dz);
      if (d >= rc || d < 1e-12) continue;
      const nx = dx / d, ny = dy / d, nz = dz / d;
      X[3 * k] = bx[0] + nx * rc;
      X[3 * k + 1] = bx[1] + ny * rc;
      X[3 * k + 2] = bx[2] + nz * rc;
      const rx = V[3 * k] - bv[0], ry = V[3 * k + 1] - bv[1], rz = V[3 * k + 2] - bv[2];
      const vn = rx * nx + ry * ny + rz * nz;
      const m = this.m[k];
      // normal: no getting in; tangential: grip
      const un = Math.max(0, vn);
      const tx = (rx - vn * nx) * keep, ty = (ry - vn * ny) * keep, tz = (rz - vn * nz) * keep;
      const nvx = bv[0] + tx + un * nx, nvy = bv[1] + ty + un * ny, nvz = bv[2] + tz + un * nz;
      px += m * (nvx - V[3 * k]);
      py += m * (nvy - V[3 * k + 1]);
      pz += m * (nvz - V[3 * k + 2]);
      V[3 * k] = nvx;
      V[3 * k + 1] = nvy;
      V[3 * k + 2] = nvz;
    }
    const M = this.p.mass;
    bv[0] -= px / M;
    bv[1] -= py / M;
    bv[2] -= pz / M;
    this.time += h;
    this.steps++;
    this.checkSeal();
  }

  // rings: centroid and spread; a neck is a ring that has shrunk below the seal radius with wide rings on both
  // sides, behind the ball
  private checkSeal() {
    const { S, ball, seal } = this.p;
    const X = this.x;
    const rad = this.ringRadius;
    const cen = new Float64Array(this.Nr * 3);
    rad.fill(-1);
    for (let i = 0; i < this.Nr; i++) {
      const k0 = 1 + i * S;
      if (this.m[k0] === 0) continue; // merged
      let cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < S; j++) {
        cx += X[3 * (k0 + j)];
        cy += X[3 * (k0 + j) + 1];
        cz += X[3 * (k0 + j) + 2];
      }
      cx /= S;
      cy /= S;
      cz /= S;
      let r = 0;
      for (let j = 0; j < S; j++) r = Math.max(r, Math.hypot(X[3 * (k0 + j)] - cx, X[3 * (k0 + j) + 1] - cy, X[3 * (k0 + j) + 2] - cz));
      rad[i] = r;
      cen.set([cx, cy, cz], 3 * i);
    }
    const bv = this.ballV, bx = this.ballX;
    for (let i = 1; i + 1 < this.Nr; i++) {
      if (rad[i] < 0 || rad[i] > seal) continue;
      const along = (cen[3 * i] - bx[0]) * bv[0] + (cen[3 * i + 1] - bx[1]) * bv[1] + (cen[3 * i + 2] - bx[2]) * bv[2];
      if (along > 0) continue; // behind the ball only
      let wideIn = false, wideOut = false;
      for (let j = i - 1; j >= 0 && rad[j] >= 0; j--) if (rad[j] > 0.5 * ball) wideIn = true;
      for (let j = i + 1; j < this.Nr && rad[j] >= 0; j++) if (rad[j] > 0.5 * ball) wideOut = true;
      if (!wideIn || !wideOut) continue;
      let k = i;
      for (let j = i + 1; j < this.Nr && rad[j] >= 0 && rad[j] <= seal; j++) if (rad[j] < rad[k]) k = j;
      this.cut(k, [cen[3 * k], cen[3 * k + 1], cen[3 * k + 2]]);
      return;
    }
  }

  // ring k becomes two poles: one closes the bag (rings below), one is the sheet's new centre (rings above)
  private cut(k: number, c: number[]) {
    const S = this.p.S;
    const bag = this.n++, sheet = this.n++;
    const X = this.x, V = this.v;
    let m = 0;
    const mv = [0, 0, 0];
    for (let j = 0; j < S; j++) {
      const v = 1 + k * S + j;
      m += this.m[v];
      for (let a = 0; a < 3; a++) mv[a] += this.m[v] * V[3 * v + a];
    }
    for (const p of [bag, sheet]) {
      X.set(c, 3 * p);
      for (let a = 0; a < 3; a++) V[3 * p + a] = mv[a] / m;
      this.m[p] = m / 2;
      this.ring[p] = k;
      this.sector[p] = 0;
      this.pinned[p] = 0;
    }
    const onRing = (v: number) => v > 0 && v < 1 + this.Nr * S && this.ring[v] === k;
    for (let j = 0; j < S; j++) this.m[1 + k * S + j] = 0;
    // triangles touching ring k go to the pole on their side; those with two corners on it vanish
    const t: number[] = [];
    for (let f = 0; f < this.tris.length; f += 3) {
      const tri = [this.tris[f], this.tris[f + 1], this.tris[f + 2]];
      const hit = tri.filter(onRing).length;
      if (!hit) t.push(...tri);
      else if (hit === 1) {
        const other = tri.find((v) => !onRing(v))!;
        const pole = this.ring[other] < k ? bag : sheet;
        t.push(...tri.map((v) => (onRing(v) ? pole : v)));
      }
    }
    // rest weights of springs to the ring move to the pole on their side (summed)
    const key = (i: number, j: number) => (i < j ? i * this.cap + j : j * this.cap + i);
    const moved = new Map<number, number>();
    for (let e = 0; e < this.ei.length; e++) {
      const i = this.ei[e], j = this.ej[e];
      const ri = onRing(i), rj = onRing(j);
      if (ri === rj) continue;
      const other = ri ? j : i;
      const kk = key(other, this.ring[other] < k ? bag : sheet);
      moved.set(kk, (moved.get(kk) ?? 0) + this.rest[e]);
    }
    for (const [kk, w] of moved) {
      this.ei.push(Math.floor(kk / this.cap));
      this.ej.push(kk % this.cap);
      this.rest.push(w);
    }
    this.tris = t;
    this.edgeList();
    this.seals.push({ time: this.time, ring: k });
    this.build();
  }
}
