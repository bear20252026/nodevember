// One rope from far left to far right, in two dimensions, thinner and thinner towards its middle. A
// stone lands on the middle and pulls it into a taut V, and at each period's start the stretch under
// the stone "tears": that stretch is remade as a whole new rope of half the size (its sheath gone,
// its core a little longer, so it hangs slack), and everything is made twice as big.
//
// Positions are in the measure of the rope the stone is about to tear (1 long when the period ends),
// seen from the point everything grows from.
//
// Left alone, such a chain always ends up a flat taut line: the sideways pull is one number for the
// whole rope, and nothing makes it shrink with the zoom. So only the two youngest ropes are free.
// What is older is drawn onto two rays from the centre, straight and taut as it was when it tore:
// old, big rope has had no time to move.

export const P = {
  S: 2, // how much smaller each rope is than the one it came out of
  N: 72, // segments in a rope
  NC: 32, // how many of them tear open; the core is N / (S * NC) times longer than the sheath it was in
  K: 4, // older ropes kept (what is left of each is a stub on either side)
  T: 2.4, // seconds between tears
  fps: 60,
  sub: 20,
  G: 1.5, // gravity as the picture sees it
  up: 0.13, // how high above the point the rays meet the stone is at a tear
  land: 0.1, // how high above the centre the stone meets the rope it will tear
  k1: 60, // how hard that rope pushes back, per length pressed, 1/s²
  k2: 20, // and the softer core under it
  stoneR: 0.115,
  rope: 0.018, // radius of the rope about to tear
  rayL: 47, // degrees above level of the two rays the old rope lies on
  rayR: 41,
  reach: 1.0, // how taut the old stubs are held: 1 is exactly their length
  hold: 2.5, // how fast a stub torn two tears ago is brought to its ray, 1/s
  hold1: 1.5, // and one torn at the last tear
  shift: 0, // how far off the stone the tear is centred, in segments
  stiff: [140, 260, 600], // pull that would double a rope's length, in ropes' weights: new core, torn rope, older
  bend: [0.02, 0.2, 1.5], // the same for folding
  damp: [8, 30, 60], // how fast neighbours agree on their speed along the rope, 1/s: new core, torn rope, older
  sway: [6, 14, 20], // and across it
  air: 4, // thin rope is light for the air it pushes: this is what lets the loop settle
  grip: 0.3, // friction of stone on rope
  slack: 0.07, // seconds for a freed core to reach its length
  heavy: 0.4, // and to weigh as much as a rope
  recoil: 2.5, // how fast a torn sheath snaps back, at its loose end, as the picture sees it
  tailStiff: 300,
  tailBend: 0.05,
};

import { bounce, type Bounce } from "./bounce.ts";

/** what is left of a torn sheath: a loose tail hanging from the torn end of a stub */
export type Tail = {
  right: boolean;
  gen: number;
  x: Float64Array;
  y: Float64Array;
  px: Float64Array;
  py: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  mat: Float64Array;
  rest: number;
};

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

export class Chain {
  cap = 0;
  n = 0;
  x!: Float64Array;
  y!: Float64Array;
  px!: Float64Array;
  py!: Float64Array;
  vx!: Float64Array;
  vy!: Float64Array;
  w!: Float64Array; // 1 / mass
  hx!: Float64Array; // where a node of an old stub belongs
  hy!: Float64Array;
  rest!: Float64Array; // of the segment after node i, at full length
  mat!: Float64Array; // where along its rope a node is, in segments: it keeps it through every tear, so the twist stays put
  pull!: Float64Array; // tension of that segment, in ropes' weights
  tails: Tail[] = [];
  jl: number[] = []; // the node where the stub torn k tears ago begins, nearest the middle, left and right
  jr: number[] = [];
  gen!: Int8Array; // of the segment after node i: 0 the rope under the stone, 1 the one torn last, ...
  age!: Int8Array; // of a node: the older of its two segments
  // the stone
  sx = 0;
  sy = 0;
  svx = 0;
  svy = 0;
  path!: Bounce;
  touch = 0; // how many times it pressed on a node in the last frame
  air = 0; // frames in a row off the rope
  frame = 0;
  period = 0;
  TF: number;
  // what the last period did
  log = { peak: 0, touched: 0, lands: -1, bottom: 0 };

  constructor() {
    this.TF = Math.round(P.T * P.fps);
    this.path = bounce({
      T: P.T,
      G: P.G,
      r1: P.land,
      k1: P.k1,
      k2: P.k2,
      dt: 1 / (P.fps * P.sub),
    });
    this.build();
  }

  get phase() {
    return (this.frame % this.TF) / this.TF;
  }
  /** what one length looks like at this phase */
  zoom(phase = this.phase) {
    return Math.pow(P.S, phase - 1);
  }
  /** the stone's height in this period's measure, `i` substeps after the tear */
  stoneAt(i: number) {
    const n = this.path.y.length - 1;
    i = Math.max(0, Math.min(n, i));
    return (this.path.y[i] + P.up) / this.zoom(i / n);
  }

  /** where the junction of the rope torn `k` tears ago with the one before it is held, on its ray */
  static ray(k: number, right: boolean): [number, number] {
    const a = ((right ? P.rayR : P.rayL) * Math.PI) / 180;
    const m = (P.N - P.NC) / 2;
    const r = ((2 * m) / P.N) * P.reach * P.S ** k;
    return [(right ? 1 : -1) * r * Math.cos(a), r * Math.sin(a)];
  }

  private room(n: number) {
    if (n <= this.cap) return;
    this.cap = n + 64;
    for (const k of [
      "x",
      "y",
      "px",
      "py",
      "vx",
      "vy",
      "w",
      "hx",
      "hy",
      "rest",
      "pull",
      "mat",
    ] as const) {
      const a = new Float64Array(this.cap);
      if (this[k]) a.set(this[k].subarray(0, this.n));
      this[k] = a;
    }
    for (const k of ["gen", "age"] as const) {
      const g = new Int8Array(this.cap);
      if (this[k]) g.set(this[k].subarray(0, this.n));
      this[k] = g;
    }
  }

  /** a taut V on the two rays, the stone sitting in it */
  build() {
    const { S, N, NC, K } = P;
    const m = (N - NC) / 2;
    const X: number[] = [],
      Y: number[] = [],
      Gn: number[] = [],
      R: number[] = [];
    // left stubs, outermost first
    for (let k = K; k >= 1; k--) {
      const a = Chain.ray(k, false),
        b = Chain.ray(k - 1, false);
      for (let j = 0; j < m; j++)
        (X.push(a[0] + ((b[0] - a[0]) * j) / m),
          Y.push(a[1] + ((b[1] - a[1]) * j) / m),
          Gn.push(k),
          R.push(S ** k / N));
    }
    const l = Chain.ray(0, false),
      r = Chain.ray(0, true);
    // the point of the V: half a rope from either end
    const d = Math.hypot(r[0] - l[0], r[1] - l[1]) / 2;
    const drop = Math.sqrt(Math.max(0.25 - d * d, 0.0004));
    const ux = (r[0] - l[0]) / (2 * d),
      uy = (r[1] - l[1]) / (2 * d);
    const tip = [(l[0] + r[0]) / 2 + uy * drop, (l[1] + r[1]) / 2 - ux * drop];
    for (let j = 0; j <= N; j++) {
      const from = j <= N / 2 ? l : tip,
        to = j <= N / 2 ? tip : r,
        u = j <= N / 2 ? j / (N / 2) : (j - N / 2) / (N / 2);
      (X.push(from[0] + (to[0] - from[0]) * u),
        Y.push(from[1] + (to[1] - from[1]) * u));
      if (j < N) (Gn.push(0), R.push(1 / N));
    }
    for (let k = 1; k <= K; k++) {
      const a = Chain.ray(k - 1, true),
        b = Chain.ray(k, true);
      for (let j = 1; j <= m; j++) {
        (Gn.push(k), R.push(S ** k / N));
        (X.push(a[0] + ((b[0] - a[0]) * j) / m),
          Y.push(a[1] + ((b[1] - a[1]) * j) / m));
      }
    }
    this.n = 0;
    this.room(X.length);
    this.n = X.length;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = X[i];
      this.y[i] = Y[i];
      this.vx[i] = this.vy[i] = 0;
      this.w[i] = N;
      this.mat[i] = i;
      this.gen[i] = i < Gn.length ? Gn[i] : 127;
      this.rest[i] = i < R.length ? R[i] : 0;
    }
    this.homes();
    this.sx = 0;
    this.sy = this.stoneAt(0);
    this.frame = 0;
    this.period = 0;
  }

  /** first and last node of the rope under the stone */
  child(): [number, number] {
    let a = 0;
    while (this.gen[a] !== 0) a++;
    let b = a;
    while (b < this.n - 1 && this.gen[b] === 0) b++;
    return [a, b];
  }

  /** each node's age, and for the old ones their place on the ray: evenly along their stub */
  private homes() {
    const n = this.n;
    const { gen, age, hx, hy, w } = this;
    for (let i = 0; i < n; i++)
      age[i] = Math.max(i > 0 ? gen[i - 1] : 0, i < n - 1 ? gen[i] : 0);
    const [c0, c1] = this.child();
    // walk outwards from the rope under the stone, a stub at a time
    for (const right of [false, true]) {
      let i = right ? c1 : c0; // inner node of the stub
      for (let k = 1; i > 0 && i < n - 1; k++) {
        (right ? this.jr : this.jl)[k] = i;
        let j = i; // outer node
        if (right) while (j < n - 1 && gen[j] === k) j++;
        else while (j > 0 && gen[j - 1] === k) j--;
        const a = Chain.ray(k - 1, right),
          b = Chain.ray(k, right);
        const len = Math.abs(j - i);
        for (let q = 0; q <= len; q++) {
          const at = right ? i + q : i - q;
          hx[at] = a[0] + ((b[0] - a[0]) * q) / len;
          hy[at] = a[1] + ((b[1] - a[1]) * q) / len;
        }
        if (len === 0) break;
        i = j;
      }
    }
    for (let i = 0; i < n; i++)
      if (age[i] >= 4 || i === 0 || i === n - 1) {
        w[i] = 0;
        this.x[i] = hx[i];
        this.y[i] = hy[i];
        this.vx[i] = this.vy[i] = 0;
      }
  }

  /** the tails: loose sheath, hanging from the end it was torn from */
  private tailStep(g: number, h: number, t: number) {
    const drag = Math.exp(-P.air * h);
    for (const tl of this.tails) {
      const { x, y, px, py, vx, vy } = tl;
      const L = x.length;
      const j = (tl.right ? this.jr : this.jl)[tl.gen];
      for (let q = 0; q < L; q++) {
        px[q] = x[q];
        py[q] = y[q];
        if (q === 0) continue;
        vy[q] -= g * h;
        vx[q] *= drag;
        vy[q] *= drag;
        x[q] += vx[q] * h;
        y[q] += vy[q] * h;
      }
      x[0] = this.x[j];
      y[0] = this.y[j];
      // a sheath ripped open is limp at first and tightens
      const R = tl.rest;
      for (let it = 0; it < 2; it++) {
        for (let q = 0; q < L - 1; q++) {
          const wa = q === 0 ? 0 : 1;
          const dx = x[q + 1] - x[q],
            dy = y[q + 1] - y[q];
          const d = Math.hypot(dx, dy) || 1e-12;
          const al = R / (P.tailStiff * g) / (h * h);
          const dl = (d - R) / (wa + 1 + al * 2);
          x[q] += (dx / d) * dl * wa;
          y[q] += (dy / d) * dl * wa;
          x[q + 1] -= (dx / d) * dl;
          y[q + 1] -= (dy / d) * dl;
        }
        for (let q = 0; q < L - 2; q++) {
          const wa = q === 0 ? 0 : 1;
          const dx = x[q + 2] - x[q],
            dy = y[q + 2] - y[q];
          const d = Math.hypot(dx, dy) || 1e-12;
          if (d >= 2 * R) continue;
          const al = (2 * R) / (P.tailBend * g) / (h * h);
          const dl = (d - 2 * R) / (wa + 1 + al * 2);
          x[q] += (dx / d) * dl * wa;
          y[q] += (dy / d) * dl * wa;
          x[q + 2] -= (dx / d) * dl;
          y[q + 2] -= (dy / d) * dl;
        }
      }
      for (let q = 0; q < L; q++) {
        vx[q] = (x[q] - px[q]) / h;
        vy[q] = (y[q] - py[q]) / h;
      }
      const kd = 1 - Math.exp(-P.sway[1] * h);
      for (let q = 0; q < L - 1; q++) {
        const wa = q === 0 ? 0 : 1;
        const dvx = (vx[q + 1] - vx[q]) * kd,
          dvy = (vy[q + 1] - vy[q]) * kd;
        vx[q] += (dvx * wa) / (wa + 1);
        vy[q] += (dvy * wa) / (wa + 1);
        vx[q + 1] -= dvx / (wa + 1);
        vy[q + 1] -= dvy / (wa + 1);
      }
    }
    void t;
  }

  /** the tear: the stretch under the stone becomes a new rope, the oldest stubs go, and all is doubled */
  private seam() {
    const { S, N, NC, K } = P;
    const [c0, c1] = this.child();
    // always the same stretch of it: choosing by where the stone is would flip between neighbours
    const a = c0 + (N - NC) / 2 + P.shift;
    const b = a + NC;
    // the torn sheath: each half stays on its end, snapping back
    for (const t of this.tails) {
      t.gen++;
      t.rest *= S;
      for (let q = 0; q < t.x.length; q++)
        ((t.x[q] *= S), (t.y[q] *= S), (t.vx[q] *= S), (t.vy[q] *= S));
    }
    this.tails = this.tails.filter((t) => t.gen < K);
    {
      const half = NC / 2;
      for (const right of [false, true]) {
        const at = (q: number) => (right ? b - q : a + q);
        const L = half + 1;
        const t: Tail = {
          right,
          gen: 1,
          x: new Float64Array(L),
          y: new Float64Array(L),
          px: new Float64Array(L),
          py: new Float64Array(L),
          vx: new Float64Array(L),
          vy: new Float64Array(L),
          mat: new Float64Array(L),
          rest: this.rest[a] * S,
        };
        const ex = this.x[at(half)] - this.x[at(0)],
          ey = this.y[at(half)] - this.y[at(0)];
        for (let q = 0; q < L; q++) {
          const i = at(q);
          t.x[q] = this.x[i] * S;
          t.y[q] = this.y[i] * S;
          // back towards the end it hangs from, the faster the further out
          const back = (q / half) * P.recoil * S;
          const d = Math.hypot(ex, ey) || 1;
          t.vx[q] = this.vx[i] * S - (ex / d) * back;
          t.vy[q] = this.vy[i] * S - (ey / d) * back;
          t.mat[q] = this.mat[i];
        }
        this.tails.push(t);
      }
    }
    // outermost survivors: the first and last node touching a segment younger than K
    let lo = 0;
    while (this.gen[lo] >= K) lo++;
    let hi = this.n - 1;
    while (this.gen[hi - 1] >= K) hi--;
    const X: number[] = [],
      Y: number[] = [],
      VX: number[] = [],
      VY: number[] = [],
      W: number[] = [],
      R: number[] = [],
      Gn: number[] = [],
      M: number[] = [];
    const put = (i: number) => {
      (X.push(this.x[i] * S),
        Y.push(this.y[i] * S),
        VX.push(this.vx[i] * S),
        VY.push(this.vy[i] * S),
        W.push(this.w[i]),
        M.push(this.mat[i]));
    };
    for (let i = lo; i <= a; i++) {
      put(i);
      if (i < a) (R.push(this.rest[i] * S), Gn.push(this.gen[i] + 1));
    }
    // the core: N segments laid along the torn stretch, each 1/N long once grown
    for (let j = 0; j < N; j++) {
      (R.push(1 / N), Gn.push(0));
      if (j === N - 1) break;
      const u = ((j + 1) * NC) / N,
        i = a + Math.floor(u),
        f = u - Math.floor(u);
      X.push((this.x[i] + (this.x[i + 1] - this.x[i]) * f) * S);
      Y.push((this.y[i] + (this.y[i + 1] - this.y[i]) * f) * S);
      VX.push((this.vx[i] + (this.vx[i + 1] - this.vx[i]) * f) * S);
      VY.push((this.vy[i] + (this.vy[i + 1] - this.vy[i]) * f) * S);
      W.push(N);
      M.push(this.mat[a] + j + 1);
    }
    for (let i = b; i <= hi; i++) {
      put(i);
      if (i < hi) (R.push(this.rest[i] * S), Gn.push(this.gen[i] + 1));
    }
    this.n = 0;
    this.room(X.length);
    this.n = X.length;
    for (let i = 0; i < this.n; i++) {
      this.x[i] = X[i];
      this.y[i] = Y[i];
      this.vx[i] = VX[i];
      this.vy[i] = VY[i];
      this.w[i] = W[i];
      this.mat[i] = M[i];
      this.rest[i] = i < R.length ? R[i] : 0;
      this.gen[i] = i < Gn.length ? Gn[i] : 127;
      this.pull[i] = 0;
    }
    this.homes();
    this.period++;
  }

  /** one frame */
  step() {
    const { S, N, NC, G } = P;
    const TF = this.TF;
    if (this.frame > 0 && this.frame % TF === 0) {
      this.seam();
      this.log = { peak: 0, touched: 0, lands: -1, bottom: 0 };
    }
    const f = this.frame % TF;
    const h = 1 / (P.fps * P.sub);
    const [c0, c1] = this.child();
    const first = this.period === 0;
    let touched = 0;
    const n = this.n;
    const { x, y, px, py, vx, vy, w, hx, hy, rest, gen, age, pull } = this;
    for (let s = 0; s < P.sub; s++) {
      const t = (f + s / P.sub) / P.fps;
      const ph = t / P.T;
      const g = G * Math.pow(S, 1 - ph);
      const R = P.stoneR * Math.pow(S, 1 - ph);
      const drag = Math.exp(-P.air * h);
      // a freed core takes a moment to weigh as much as a rope, and to reach its length
      const born = first ? 1 : ease(t / P.heavy);
      const mass = (NC / N + (1 - NC / N) * born) / N;
      const grown = first
        ? 1
        : (S * NC) / N + (1 - (S * NC) / N) * ease(t / P.slack);
      for (let i = c0 + 1; i < c1; i++) w[i] = 1 / mass;
      // a stub two tears old is drawn to its ray; one three tears old is on it by the next tear
      const soft = 1 - Math.exp(-P.hold * h),
        new1 = 1 - Math.exp(-P.hold1 * h);
      const firm = Math.min(1, (3 / Math.max(P.T - t, h)) * h);
      for (let i = 0; i < n; i++) {
        px[i] = x[i];
        py[i] = y[i];
        if (w[i] === 0) continue;
        vy[i] -= g * h;
        vx[i] *= drag;
        vy[i] *= drag;
        x[i] += vx[i] * h;
        y[i] += vy[i] * h;
        const a = age[i];
        if (a >= 1) {
          const k = a === 1 ? new1 : a === 2 ? soft : firm;
          x[i] += (hx[i] - x[i]) * k;
          y[i] += (hy[i] - y[i]) * k;
        }
      }
      const spx = this.sx,
        spy = this.sy;
      this.sy = this.stoneAt(f * P.sub + s + 1);
      pull.fill(0, 0, n);
      let hit = 0;
      for (let it = 0; it < 2; it++) {
        const fwd = (s + it) % 2 === 0;
        for (let q = 0; q < n - 1; q++) {
          const i = fwd ? q : n - 2 - q;
          const wa = w[i],
            wb = w[i + 1];
          if (wa + wb === 0) continue;
          const k = gen[i];
          const L = rest[i] * (k === 0 ? grown : 1);
          const dx = x[i + 1] - x[i],
            dy = y[i + 1] - y[i];
          const d = Math.hypot(dx, dy) || 1e-12;
          const al = L / (P.stiff[Math.min(k, 2)] * g) / (h * h);
          const dl = (d - L) / (wa + wb + al * 2); // two passes share the give
          const ux = dx / d,
            uy = dy / d;
          x[i] += ux * dl * wa;
          y[i] += uy * dl * wa;
          x[i + 1] -= ux * dl * wb;
          y[i + 1] -= uy * dl * wb;
          pull[i] += dl / (h * h) / g;
        }
        // folding: a rope resists having its second neighbour come nearer
        for (let q = 0; q < n - 2; q++) {
          const i = fwd ? q : n - 3 - q;
          const wa = w[i],
            wb = w[i + 2];
          if (wa + wb === 0) continue;
          const k = Math.max(gen[i], gen[i + 1]);
          const L =
            rest[i] * (gen[i] === 0 ? grown : 1) +
            rest[i + 1] * (gen[i + 1] === 0 ? grown : 1);
          const dx = x[i + 2] - x[i],
            dy = y[i + 2] - y[i];
          const d = Math.hypot(dx, dy) || 1e-12;
          if (d >= L) continue;
          const al = L / (P.bend[Math.min(k, 2)] * g) / (h * h);
          const dl = (d - L) / (wa + wb + al * 2);
          const ux = dx / d,
            uy = dy / d;
          x[i] += ux * dl * wa;
          y[i] += uy * dl * wa;
          x[i + 2] -= ux * dl * wb;
          y[i + 2] -= uy * dl * wb;
        }
        // the stone
        for (let i = 1; i < n - 1; i++) {
          const reach = R + P.rope * S ** Math.min(gen[i - 1], gen[i]);
          const dx = x[i] - this.sx,
            dy = y[i] - this.sy;
          if (Math.abs(dx) > reach || Math.abs(dy) > reach) continue;
          const d = Math.hypot(dx, dy);
          if (d >= reach || d === 0) continue;
          const pen = reach - d;
          const nx = dx / d,
            ny = dy / d;
          if (w[i] === 0) continue;
          x[i] += nx * pen;
          y[i] += ny * pen;
          // friction: undo some of this step's sliding of one past the other
          if (P.grip > 0) {
            const rx = x[i] - px[i] - (this.sx - spx),
              ry = y[i] - py[i] - (this.sy - spy);
            const tl = -rx * ny + ry * nx;
            const k =
              Math.min(1, (P.grip * pen) / (Math.abs(tl) || 1e-12)) * tl;
            x[i] += ny * k;
            y[i] -= nx * k;
          }
          hit++;
        }
      }
      for (let i = 0; i < n; i++) {
        vx[i] = (x[i] - px[i]) / h;
        vy[i] = (y[i] - py[i]) / h;
      }
      this.svx = (this.sx - spx) / h;
      this.svy = (this.sy - spy) / h;
      // neighbours agree on a speed, along the rope and across it
      for (let i = 0; i < n - 1; i++) {
        const wa = w[i],
          wb = w[i + 1];
        if (wa + wb === 0) continue;
        const k = Math.min(gen[i], 2);
        const dx = x[i + 1] - x[i],
          dy = y[i + 1] - y[i];
        const d = Math.hypot(dx, dy) || 1e-12;
        const ux = dx / d,
          uy = dy / d;
        const rvx = vx[i + 1] - vx[i],
          rvy = vy[i + 1] - vy[i];
        const al = rvx * ux + rvy * uy,
          ac = -rvx * uy + rvy * ux;
        const ka = (1 - Math.exp(-P.damp[k] * h)) * al,
          kc = (1 - Math.exp(-P.sway[k] * h)) * ac;
        const dvx = ka * ux - kc * uy,
          dvy = ka * uy + kc * ux;
        vx[i] += (dvx * wa) / (wa + wb);
        vy[i] += (dvy * wa) / (wa + wb);
        vx[i + 1] -= (dvx * wb) / (wa + wb);
        vy[i + 1] -= (dvy * wb) / (wa + wb);
      }
      touched += hit;
      this.tailStep(g, h, t);
    }
    let peak = 0;
    for (let i = c0; i < c1; i++) peak = Math.max(peak, this.pull[i]);
    this.log.peak = Math.max(this.log.peak, peak);
    this.log.touched += touched > 0 ? 1 : 0;
    if (touched > 0 && f > TF / 2 && this.log.lands < 0) this.log.lands = f;
    // how high the rope under the stone hangs at the middle, as the picture sees it, a moment before it lands
    if (f === Math.round(TF * 0.9)) {
      let best = 1e9;
      for (let i = c0; i < c1; i++)
        if (Math.abs(this.x[i]) < Math.abs(best))
          ((best = this.x[i]),
            (this.log.bottom = this.y[i] * this.zoom((f + 1) / TF)));
    }
    this.touch = touched;
    this.frame++;
  }
}
