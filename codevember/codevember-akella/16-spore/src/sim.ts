// The pile. Each stem is a chain of nodes clamped at its root, lengthening along its whole length towards a
// shape of its own, and shouldering its neighbours aside. Nothing here knows about the picture.
//
// The world repeats under a screw: after T seconds everything is the same, H higher and turned by TURN.
// A stem is one of NK kinds (its key), born again every period, so key i of one period and key i of the next
// are the same mushroom a screw step apart.

export const P = {
  T: 12, // seconds a loop
  H: 2.0, // how far the eye climbs in it
  TURN: Math.PI / 4, // and how far the pile turns
  NK: 124, // mushrooms born in a period
  N: 28, // segments in a stem
  FPS: 30, // steps a second kept
  SUB: 6, // and solved in between
  DEPTH: 2.3, // roots are born this far under the eye
  OUT: 2.5, // and a cap this far under it is gone
  ROOT: 0.34, // roots fall in a disc this wide (radius)
  SEED: 11,
  DRAG: 0.4, // per second: the air, on everything alike
  RING: 0.08, // and each part's own damping, as a share of critical: how many times it swings once shoved, not how long
  SPRING: [30, 5], // radians a second: a stem is a spring about its own shape, at most this stiff, and this slow...
  SPRING_AT: 5, // ...this far up from the root: the further a part is from the foot the slower it swings,
  SPRING_POW: 1.5, // as a rod with a weight on its end does. A short stem quivers, a long one sways
  WAVES: 3, // births bunch into this many flushes a period
  BUNCH: 0.6, // 0 evenly spread .. 1 all at once
  SPURT: [1.0, 1.8], // seconds a spurt of growth lasts
  REST: [0.7, 2.4], // and the pause before the next
  CREEP: 0.16, // share of the length that comes steadily, not in spurts
  POP: 0.55, // seconds a cap takes to open
  POP_AT: [0.82, 0.93], // and how much of its full length the stem has when it starts to
  KICK: 0, // how fast the top is thrown when it does (the cap's weight does this now: DROP)
  DROP: 0.4, // the share of a stem's hang that comes all at once as its cap opens: the cap is heavy, the stem bows and bobs
  NUT: [0.016, 0.3], // growing tips circle: how wide, in stem lengths, and the share of that a grown stem keeps for good
  NUT_T: [3, 5.5], // seconds a turn
  BEND: 0.55, // how hard a stem keeps its own shape, 0..1 a pass
  PUSH: 0.55, // how hard two stems part, 0..1 a pass
  PASSES: 2,
  LEN: [4.0, 5.6], // stem lengths
  RUNT: 0.18, // share that stay short
  RAD: [0.024, 0.034], // stem radius
  CAP: [2.5, 3.5], // cap radius, in stem radii
  TILT: [0.04, 0.24], // how far a stem leans out, at the middle and at the rim of the root disc (tangent)
  WOB: 0.055, // waviness
  SAG: 0.11, // how far the top ends up hanging out sideways once grown, in stem lengths
  SAG_T: 13, // seconds it takes, from full length
};

export type Key = {
  tau: number; // born this long into the period
  x: number; // root, for the first of its line
  y: number; // above DEPTH under the eye
  z: number;
  L: number;
  D: number;
  rad: number;
  cap: number;
  life: number;
  seed: number;
  burst: number[]; // spurts of growth: start, duration (seconds of age), share of the length; three numbers each
  creep: number;
  pop: number; // the age its cap opens
  rest: Float64Array; // its own shape, for unit length, from the root: (N+1)*3
  sx: number; // which way and how far it comes to hang
  sz: number;
};

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// how long, how thick and how open a mushroom is at an age
const G0 = 0.03;
type Growing = { L: number; D: number; burst: number[]; creep: number };
// a spurt: off gently, quickest early, a long soft landing
const spurt = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const q = 1 - Math.pow(t, 1.5);
  return 1 - q * q * q;
};
export const lengthAt = (k: Growing, age: number) => {
  let g = k.creep * Math.min(1, Math.max(0, age / k.D));
  for (let i = 0; i < k.burst.length; i += 3) g += k.burst[i + 2] * spurt((age - k.burst[i]) / k.burst[i + 1]);
  return k.L * (G0 + (1 - G0) * g);
};
export const radAt = (k: { rad: number; D: number }, age: number) => k.rad * (0.5 + 0.5 * smooth(0, 0.7, age / k.D)) * smooth(-0.2, 1.2, age);
// how far along its hanging a stem is: an old mushroom leans out of the crowd
export const sagAt = (k: { D: number; pop: number }, age: number) => P.DROP * smooth(0, 0.6 * P.POP, age - k.pop) + (1 - P.DROP) * smooth(0.5 * k.D, k.D + P.SAG_T, age);
// and the circling of a tip as it grows, as timelapse shows: never quite round, never quite the same, never quite over
const frac = (x: number) => x - Math.floor(x);
export const nutAt = (k: { D: number; seed: number }, age: number, out: Float64Array) => {
  const turn = P.NUT_T[0] + (P.NUT_T[1] - P.NUT_T[0]) * frac(k.seed * 31.71);
  const way = frac(k.seed * 7.39) < 0.5 ? 1 : -1;
  const a = 6.2832 * (frac(k.seed * 97.13) + (way * age) / turn);
  const wide = P.NUT[0] * (P.NUT[1] + (1 - P.NUT[1]) * (1 - smooth(k.D, k.D + 5, age))) * smooth(0, 1.5, age) * (1 + 0.5 * Math.sin(6.2832 * (frac(k.seed * 53.3) + age / (turn * 1.618))));
  out[0] = Math.cos(a) * wide;
  out[1] = Math.sin(a) * wide * 0.7;
};
// a cap stays a pin, swelling a little, then opens all at once and overshoots before it settles
export const openAt = (k: { D: number; pop: number }, age: number) => {
  const pin = 0.2 * smooth(0.25 * k.D, k.D, age);
  const p = (age - k.pop) / P.POP;
  return pin + (p <= 0 ? 0 : (1 - pin) * (1 - Math.exp(-4.2 * p) * Math.cos(7.5 * p)));
};
export const capAt = (k: { rad: number; cap: number; D: number; pop: number }, age: number) => {
  const r = radAt(k, age);
  return r * 1.3 + (k.cap - k.rad * 1.3) * openAt(k, age) * smooth(-0.2, 1.2, age);
};

export function makeKeys(): Key[] {
  const R = mulberry(P.SEED);
  const N = P.N;
  const v = P.H / P.T;
  const keys: Key[] = [];
  // births evenly through the period, places evenly over the disc, the two shuffled against each other
  const order = [...Array(P.NK).keys()];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < P.NK; i++) {
    // births in flushes: evenly spread, then drawn towards the middle of each wave
    const beat = ((i + 0.15 + 0.7 * R()) / P.NK) * P.WAVES;
    const part = beat - Math.floor(beat);
    const tau = ((Math.floor(beat) + part + (P.BUNCH * Math.sin(6.2832 * part)) / 6.2832) / P.WAVES) * P.T;
    const q = order[i];
    const rr = Math.sqrt((q + 0.5) / P.NK);
    const th = q * 2.399963 + R() * 0.5;
    const x = Math.cos(th) * rr * P.ROOT;
    const z = Math.sin(th) * rr * P.ROOT;
    const runt = R() < P.RUNT;
    const L = runt ? 2.0 + 1.6 * R() : P.LEN[0] + (P.LEN[1] - P.LEN[0]) * Math.pow(R(), 0.8);
    // growth: a first shoot from the root, then two or three more spurts with rests between
    const n = (runt ? 2 : 3) + (R() < 0.4 ? 1 : 0);
    const burst: number[] = [];
    let at = 0.3 * R();
    const shares = [0.34 + 0.12 * R()];
    for (let b = 1; b < n; b++) shares.push(0.5 + R());
    const others = shares.slice(1).reduce((a, c) => a + c, 0);
    for (let b = 0; b < n; b++) {
      const d = (P.SPURT[0] + (P.SPURT[1] - P.SPURT[0]) * R()) * (b === 0 ? 1.25 : 1);
      burst.push(at, d, b === 0 ? shares[0] * (1 - P.CREEP) : ((1 - shares[0]) * (1 - P.CREEP) * shares[b]) / others);
      at += d + (b < n - 1 ? P.REST[0] + (P.REST[1] - P.REST[0]) * R() : 0);
    }
    const D = at;
    // the cap opens as the stem makes its last push, a little short of its full length, so the two land together
    const short = P.POP_AT[0] + (P.POP_AT[1] - P.POP_AT[0]) * R();
    let pop = burst[burst.length - 3];
    while (pop < D && lengthAt({ L: 1, D, burst, creep: P.CREEP }, pop) < short) pop += 0.01;
    const rad = (P.RAD[0] + (P.RAD[1] - P.RAD[0]) * R()) * (runt ? 0.85 : 1);
    const cap = rad * (P.CAP[0] + (P.CAP[1] - P.CAP[0]) * R());
    const y = (R() - 0.5) * 0.3;
    // its shape: leaning out where it stands, straightening as it climbs, wandering a little, nodding at the top
    const tilt = P.TILT[0] + (P.TILT[1] - P.TILT[0]) * rr + (R() - 0.5) * 0.08;
    const ta = th + (R() - 0.5) * 1.1;
    const ox = Math.cos(ta),
      oz = Math.sin(ta);
    const modes = [0, 1, 2].map((m) => ({ f: 0.6 + m * 0.9 + R() * 0.7, a: (P.WOB * (0.5 + R())) / (1 + m), p1: R() * 6.283, p2: R() * 6.283 }));
    const nod = { a: R() * R() * 0.5, th: R() * 6.283 };
    const rest = new Float64Array((N + 1) * 3);
    let px = 0,
      py = 0,
      pz = 0;
    for (let k = 0; k < N; k++) {
      const u = (k + 0.5) / N;
      const lean = tilt * (0.45 + 0.55 * Math.pow(1 - u, 1.4));
      const env = smooth(0.02, 0.3, u);
      let dx = ox * lean,
        dz = oz * lean;
      for (const m of modes) {
        dx += Math.cos(m.p1 + 6.283 * m.f * u) * m.a * env;
        dz += Math.sin(m.p2 + 6.283 * m.f * u) * m.a * env;
      }
      const nd = nod.a * smooth(0.78, 1, u);
      dx += Math.cos(nod.th) * nd;
      dz += Math.sin(nod.th) * nd;
      const il = 1 / Math.hypot(dx, 1, dz) / N;
      px += dx * il;
      py += il;
      pz += dz * il;
      rest[(k + 1) * 3] = px;
      rest[(k + 1) * 3 + 1] = py;
      rest[(k + 1) * 3 + 2] = pz;
    }
    const life = (L * py + y + P.OUT - P.DEPTH + 2.2 * cap + 0.12) / v;
    const sag = P.SAG * (0.35 + 1.1 * R()) * (0.5 + 0.5 * rr);
    keys.push({ tau, x, y, z, L, D, rad, cap, life, seed: R(), burst, creep: P.CREEP, pop, rest, sx: ox * sag, sz: oz * sag });
  }
  return keys;
}

// turn about the vertical: the same turn everywhere, here and in the picture
export const turnX = (x: number, z: number, c: number, s: number) => x * c - z * s;
export const turnZ = (x: number, z: number, c: number, s: number) => x * s + z * c;

export class Pile {
  keys: Key[];
  NN = P.N + 1;
  max: number;
  x: Float64Array;
  xp: Float64Array;
  v: Float64Array;
  d2: Float64Array; // each stem's rest bend, turned for its generation
  shape: Float64Array; // and its rest shape
  dir0: Float64Array;
  sag: Float64Array; // each stem's hang, turned
  root: Float64Array;
  alive: Uint8Array;
  key: Int32Array;
  gen: Int32Array;
  age: Float64Array;
  seg: Float64Array;
  hang: Float64Array; // how far each top is carried sideways just now: its hang and its circling
  nut = new Float64Array(2);
  rad: Float64Array;
  cap: Float64Array;
  rec: (Float32Array | null)[]; // what it did, from its root, unturned: frames * NN * 3; frame m is at age a0 + m / FPS
  nf: Int32Array;
  next: Int32Array; // the generation each key bears next
  time = 0;
  frame = 0;
  pairs = new Int32Array(1 << 16);
  npairs = 0;
  guide = 0; // per second: how hard a stem is drawn to what its key did before
  target: (Float32Array | null)[];
  done: (key: number, gen: number, rec: Float32Array, frames: number) => void = () => {};
  deepest = 0;
  drawn = 0; // how far the guide moved things, summed
  moved = 0;

  constructor(keys = makeKeys()) {
    this.keys = keys;
    const maxLife = Math.max(...keys.map((k) => k.life));
    this.max = P.NK * (Math.ceil(maxLife / P.T) + 1);
    const n = this.max * this.NN * 3;
    this.x = new Float64Array(n);
    this.xp = new Float64Array(n);
    this.v = new Float64Array(n);
    this.d2 = new Float64Array(n);
    this.shape = new Float64Array(n);
    this.dir0 = new Float64Array(this.max * 3);
    this.sag = new Float64Array(this.max * 2);
    this.root = new Float64Array(this.max * 3);
    this.alive = new Uint8Array(this.max);
    this.key = new Int32Array(this.max);
    this.gen = new Int32Array(this.max);
    this.age = new Float64Array(this.max);
    this.seg = new Float64Array(this.max);
    this.hang = new Float64Array(this.max * 2);
    this.rad = new Float64Array(this.max);
    this.cap = new Float64Array(this.max);
    this.rec = Array(this.max).fill(null);
    this.nf = new Int32Array(this.max);
    this.next = new Int32Array(P.NK);
    this.target = Array(P.NK).fill(null);
  }

  framesOf(k: Key) {
    return Math.ceil(k.life * P.FPS) + 3;
  }

  spawn(ki: number, gen: number, age: number) {
    const s = this.alive.indexOf(0);
    if (s < 0) throw new Error("no room for a stem");
    const k = this.keys[ki];
    const NN = this.NN;
    const a = gen * P.TURN;
    const c = Math.cos(a),
      sn = Math.sin(a);
    const birth = k.tau + gen * P.T;
    const rx = turnX(k.x, k.z, c, sn),
      rz = turnZ(k.x, k.z, c, sn),
      ry = (P.H / P.T) * birth - P.DEPTH + k.y;
    this.root.set([rx, ry, rz], s * 3);
    const o = s * NN * 3;
    const r = k.rest;
    const turned = new Float64Array(NN * 3);
    for (let i = 0; i < NN; i++) {
      turned[i * 3] = turnX(r[i * 3], r[i * 3 + 2], c, sn);
      turned[i * 3 + 1] = r[i * 3 + 1];
      turned[i * 3 + 2] = turnZ(r[i * 3], r[i * 3 + 2], c, sn);
    }
    const L0 = lengthAt(k, age);
    for (let i = 0; i < NN; i++) {
      for (let d = 0; d < 3; d++) {
        this.x[o + i * 3 + d] = this.root[s * 3 + d] + turned[i * 3 + d] * L0;
        this.v[o + i * 3 + d] = 0;
        this.shape[o + i * 3 + d] = turned[i * 3 + d];
        this.d2[o + i * 3 + d] = i > 0 && i < NN - 1 ? turned[(i - 1) * 3 + d] - 2 * turned[i * 3 + d] + turned[(i + 1) * 3 + d] : 0;
      }
    }
    const dl = Math.hypot(turned[3], turned[4], turned[5]);
    this.dir0.set([turned[3] / dl, turned[4] / dl, turned[5] / dl], s * 3);
    this.sag[s * 2] = turnX(k.sx, k.sz, c, sn);
    this.sag[s * 2 + 1] = turnZ(k.sx, k.sz, c, sn);
    this.alive[s] = 1;
    this.key[s] = ki;
    this.gen[s] = gen;
    this.age[s] = age;
    this.rec[s] = new Float32Array(this.framesOf(k) * NN * 3);
    this.nf[s] = 0;
    this.put(s);
    return s;
  }

  // one kept frame: SUB solves, then every stem writes down where it is
  step() {
    const dt = 1 / (P.FPS * P.SUB);
    for (let i = 0; i < P.NK; i++) {
      const k = this.keys[i];
      while (k.tau + this.next[i] * P.T <= this.time + 1e-9) {
        this.spawn(i, this.next[i], this.time - (k.tau + this.next[i] * P.T));
        this.next[i]++;
      }
    }
    this.broad();
    for (let q = 0; q < P.SUB; q++) this.sub(dt, q);
    this.time = ++this.frame / P.FPS;
    this.write();
  }

  put(s: number) {
    const NN = this.NN;
    const rec = this.rec[s]!;
    const a = -this.gen[s] * P.TURN;
    const c = Math.cos(a),
      sn = Math.sin(a);
    const o = s * NN * 3,
      w = this.nf[s]++ * NN * 3;
    if (w + NN * 3 > rec.length) return;
    for (let i = 0; i < NN; i++) {
      const dx = this.x[o + i * 3] - this.root[s * 3],
        dz = this.x[o + i * 3 + 2] - this.root[s * 3 + 2];
      rec[w + i * 3] = turnX(dx, dz, c, sn);
      rec[w + i * 3 + 1] = this.x[o + i * 3 + 1] - this.root[s * 3 + 1];
      rec[w + i * 3 + 2] = turnZ(dx, dz, c, sn);
    }
  }

  write() {
    for (let s = 0; s < this.max; s++) {
      if (!this.alive[s]) continue;
      const k = this.keys[this.key[s]];
      this.put(s);
      if (this.nf[s] >= this.framesOf(k)) {
        this.alive[s] = 0;
        this.done(this.key[s], this.gen[s], this.rec[s]!, this.nf[s]);
        this.rec[s] = null;
      }
    }
  }

  // pairs of segments near enough to touch within a frame; a stem's last "segment" is its cap, a ball on the tip
  broad() {
    const NN = this.NN,
      N = P.N;
    const CELL = 0.3;
    const grid = new Map<number, number[]>();
    const mid: number[] = [];
    const ids: number[] = [];
    const reach: number[] = [];
    for (let s = 0; s < this.max; s++) {
      if (!this.alive[s]) continue;
      const k = this.keys[this.key[s]];
      const o = s * NN * 3;
      const seg = lengthAt(k, this.age[s]) / N;
      const rad = radAt(k, this.age[s] + 0.1),
        cap = capAt(k, this.age[s] + 0.1) * 0.85;
      for (let i = 1; i <= N; i++) {
        const a = o + i * 3,
          b = i < N ? a + 3 : a;
        const mx = (this.x[a] + this.x[b]) / 2,
          my = (this.x[a + 1] + this.x[b + 1]) / 2,
          mz = (this.x[a + 2] + this.x[b + 2]) / 2;
        const id = ids.length;
        ids.push(s * NN + i);
        mid.push(mx, my, mz);
        reach.push(i < N ? seg / 2 + rad : cap);
        const key = Math.floor(mx / CELL + 512) + 1024 * (Math.floor(mz / CELL + 512) + 1024 * Math.floor(my / CELL + 512));
        const cell = grid.get(key);
        if (cell) cell.push(id);
        else grid.set(key, [id]);
      }
    }
    let np = 0;
    const MARGIN = 0.03;
    for (let id = 0; id < ids.length; id++) {
      const mx = mid[id * 3],
        my = mid[id * 3 + 1],
        mz = mid[id * 3 + 2];
      const cx = Math.floor(mx / CELL + 512),
        cy = Math.floor(my / CELL + 512),
        cz = Math.floor(mz / CELL + 512);
      const sa = (ids[id] / NN) | 0;
      for (let ix = -1; ix <= 1; ix++)
        for (let iy = -1; iy <= 1; iy++)
          for (let iz = -1; iz <= 1; iz++) {
            const cell = grid.get(cx + ix + 1024 * (cz + iz + 1024 * (cy + iy)));
            if (!cell) continue;
            for (const jd of cell) {
              if (jd <= id) continue;
              if (((ids[jd] / NN) | 0) === sa) continue;
              const dx = mid[jd * 3] - mx,
                dy = mid[jd * 3 + 1] - my,
                dz = mid[jd * 3 + 2] - mz;
              const r = reach[id] + reach[jd] + MARGIN;
              if (dx * dx + dy * dy + dz * dz > r * r) continue;
              if (np * 2 + 2 > this.pairs.length) {
                const bigger = new Int32Array(this.pairs.length * 2);
                bigger.set(this.pairs);
                this.pairs = bigger;
              }
              this.pairs[np * 2] = ids[id];
              this.pairs[np * 2 + 1] = ids[jd];
              np++;
            }
          }
    }
    this.npairs = np;
  }

  sub(dt: number, q = 0) {
    const NN = this.NN,
      N = P.N;
    const { x, xp, v, d2 } = this;
    const nut = this.nut;
    for (let s = 0; s < this.max; s++) {
      if (!this.alive[s]) continue;
      const k = this.keys[this.key[s]];
      const age = (this.age[s] += dt);
      const seg = (this.seg[s] = lengthAt(k, age) / N);
      this.rad[s] = radAt(k, age);
      this.cap[s] = capAt(k, age) * 0.85;
      const o = s * NN * 3;
      for (let d = 0; d < 3; d++) {
        x[o + d] = this.root[s * 3 + d];
        x[o + 3 + d] = this.root[s * 3 + d] + this.dir0[s * 3 + d] * seg;
      }
      // a spring about its own shape, set by how far up from the foot a part is: stiff low down, slow high up, and
      // damped by the same share of critical everywhere, so a shove makes every part swing as many times
      const Lnow = seg * N;
      const hang = sagAt(k, age) * Lnow;
      nutAt(k, age, nut);
      const ga = this.gen[s] * P.TURN;
      const gc = Math.cos(ga),
        gs = Math.sin(ga);
      const hx = (this.hang[s * 2] = this.sag[s * 2] * hang + turnX(nut[0], nut[1], gc, gs) * Lnow),
        hz = (this.hang[s * 2 + 1] = this.sag[s * 2 + 1] * hang + turnZ(nut[0], nut[1], gc, gs) * Lnow);
      // the moment its cap opens the top is thrown the way it leans
      const thrown = age - dt < k.pop && age >= k.pop ? P.KICK / (Math.hypot(k.sx, k.sz) || 1) : 0;
      for (let i = 2; i < NN; i++) {
        const w = Math.min(P.SPRING[0], P.SPRING[1] * Math.pow((P.SPRING_AT * N) / (i * Lnow), P.SPRING_POW));
        const w2 = w * w * dt;
        const keep = Math.exp(-(P.DRAG + 2 * P.RING * w) * dt);
        const up = (i / N) * (i / N); // it hangs as a rod held at the foot bends: most at the top
        const q = o + i * 3;
        v[q] += (this.root[s * 3] + this.shape[q] * Lnow + hx * up - x[q]) * w2 + this.sag[s * 2] * thrown * up;
        v[q + 1] += (this.root[s * 3 + 1] + this.shape[q + 1] * Lnow - x[q + 1]) * w2;
        v[q + 2] += (this.root[s * 3 + 2] + this.shape[q + 2] * Lnow + hz * up - x[q + 2]) * w2 + this.sag[s * 2 + 1] * thrown * up;
        for (let d = 0; d < 3; d++) {
          v[q + d] *= keep;
          xp[q + d] = x[q + d];
          x[q + d] += v[q + d] * dt;
        }
      }
    }
    for (let pass = 0; pass < P.PASSES; pass++) {
      for (let s = 0; s < this.max; s++) {
        if (!this.alive[s]) continue;
        const o = s * NN * 3;
        const seg = this.seg[s];
        const Lnow = seg * N;
        const bow = 2 / (N * N); // the hang's own bend, the same all the way up
        // keep its shape: the second difference of the chain is that of its own curve
        for (let q = 1; q < N; q++) {
          const i = pass & 1 ? N - q : q;
          const a = o + (i - 1) * 3,
            b = a + 3,
            c = b + 3;
          const wa = i - 1 > 1 ? 1 : 0,
            wb = i > 1 ? 1 : 0;
          const W = wa + 4 * wb + 1;
          for (let d = 0; d < 3; d++) {
            const C = x[a + d] - 2 * x[b + d] + x[c + d] - d2[b + d] * Lnow - (d === 1 ? 0 : this.hang[s * 2 + (d >> 1)] * bow);
            const l = (-C / W) * P.BEND;
            x[a + d] += wa * l;
            x[b + d] -= 2 * wb * l;
            x[c + d] += l;
          }
        }
        // and its length
        for (let i = 1; i < N; i++) {
          const a = o + i * 3,
            b = a + 3;
          const dx = x[b] - x[a],
            dy = x[b + 1] - x[a + 1],
            dz = x[b + 2] - x[a + 2];
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
          const wa = i > 1 ? 1 : 0;
          const l = (len - seg) / len / (wa + 1);
          x[a] += dx * l * wa;
          x[a + 1] += dy * l * wa;
          x[a + 2] += dz * l * wa;
          x[b] -= dx * l;
          x[b + 1] -= dy * l;
          x[b + 2] -= dz * l;
        }
      }
      this.touch();
    }
    // the guide: what this key did at this age before
    if (this.guide > 0) {
      const g = 1 - Math.exp(-this.guide * dt);
      for (let s = 0; s < this.max; s++) {
        if (!this.alive[s]) continue;
        const t = this.target[this.key[s]];
        if (!t) continue;
        // between the frame last written and the next
        const f0 = this.nf[s] - 1,
          w = (q + 1) / P.SUB;
        if ((f0 + 2) * NN * 3 > t.length) continue;
        const a = this.gen[s] * P.TURN;
        const c = Math.cos(a),
          sn = Math.sin(a);
        const o = s * NN * 3,
          t0 = f0 * NN * 3,
          t1 = t0 + NN * 3;
        for (let i = 2; i < NN; i++) {
          const tx = t[t0 + i * 3] * (1 - w) + t[t1 + i * 3] * w,
            ty = t[t0 + i * 3 + 1] * (1 - w) + t[t1 + i * 3 + 1] * w,
            tz = t[t0 + i * 3 + 2] * (1 - w) + t[t1 + i * 3 + 2] * w;
          const gx = (this.root[s * 3] + turnX(tx, tz, c, sn) - x[o + i * 3]) * g,
            gy = (this.root[s * 3 + 1] + ty - x[o + i * 3 + 1]) * g,
            gz = (this.root[s * 3 + 2] + turnZ(tx, tz, c, sn) - x[o + i * 3 + 2]) * g;
          x[o + i * 3] += gx;
          x[o + i * 3 + 1] += gy;
          x[o + i * 3 + 2] += gz;
          this.drawn += Math.sqrt(gx * gx + gy * gy + gz * gz);
        }
      }
    }
    for (let s = 0; s < this.max; s++) {
      if (!this.alive[s]) continue;
      const o = s * NN * 3;
      for (let i = o + 6; i < o + NN * 3; i++) {
        v[i] = (x[i] - xp[i]) / dt;
        this.moved += Math.abs(x[i] - xp[i]);
      }
    }
  }

  // part every pair that overlaps, at the nearest points of the two segments
  touch() {
    const NN = this.NN,
      N = P.N;
    const x = this.x;
    const pairs = this.pairs;
    let deepest = 0;
    for (let p = 0; p < this.npairs; p++) {
      const A = pairs[p * 2],
        B = pairs[p * 2 + 1];
      const sa = (A / NN) | 0,
        ia = A - sa * NN,
        sb = (B / NN) | 0,
        ib = B - sb * NN;
      const a0 = A * 3,
        a1 = ia < N ? a0 + 3 : a0,
        b0 = B * 3,
        b1 = ib < N ? b0 + 3 : b0;
      const R = (ia < N ? this.rad[sa] : this.cap[sa]) + (ib < N ? this.rad[sb] : this.cap[sb]);
      const d1x = x[a1] - x[a0],
        d1y = x[a1 + 1] - x[a0 + 1],
        d1z = x[a1 + 2] - x[a0 + 2];
      const d2x = x[b1] - x[b0],
        d2y = x[b1 + 1] - x[b0 + 1],
        d2z = x[b1 + 2] - x[b0 + 2];
      const rx = x[a0] - x[b0],
        ry = x[a0 + 1] - x[b0 + 1],
        rz = x[a0 + 2] - x[b0 + 2];
      const a = d1x * d1x + d1y * d1y + d1z * d1z,
        e = d2x * d2x + d2y * d2y + d2z * d2z,
        f = d2x * rx + d2y * ry + d2z * rz;
      let s = 0,
        t = 0;
      if (a > 1e-14 || e > 1e-14) {
        if (a <= 1e-14) t = Math.min(1, Math.max(0, f / e));
        else {
          const c = d1x * rx + d1y * ry + d1z * rz;
          if (e <= 1e-14) s = Math.min(1, Math.max(0, -c / a));
          else {
            const b = d1x * d2x + d1y * d2y + d1z * d2z;
            const den = a * e - b * b;
            s = den > 1e-12 * a * e ? Math.min(1, Math.max(0, (b * f - c * e) / den)) : 0.5;
            t = (b * s + f) / e;
            if (t < 0) {
              t = 0;
              s = Math.min(1, Math.max(0, -c / a));
            } else if (t > 1) {
              t = 1;
              s = Math.min(1, Math.max(0, (b - c) / a));
            }
          }
        }
      }
      let nx = rx + d1x * s - d2x * t,
        ny = ry + d1y * s - d2y * t,
        nz = rz + d1z * s - d2z * t;
      const dd = nx * nx + ny * ny + nz * nz;
      if (dd >= R * R) continue;
      let dist = Math.sqrt(dd);
      if (dist < 1e-9) {
        // on top of each other: part them across the pile's axis, which turns with the screw
        nx = x[a0];
        ny = 0;
        nz = x[a0 + 2];
        dist = Math.hypot(nx, nz) || 1;
        nx /= dist;
        nz /= dist;
        dist = 0;
      } else {
        nx /= dist;
        ny /= dist;
        nz /= dist;
      }
      const pen = R - dist;
      if (pen > deepest) deepest = pen;
      const wa0 = ia > 1 ? 1 - s : 0,
        wa1 = ia < N && ia + 1 > 1 ? s : 0,
        wb0 = ib > 1 ? 1 - t : 0,
        wb1 = ib < N && ib + 1 > 1 ? t : 0;
      const W = wa0 * wa0 + wa1 * wa1 + wb0 * wb0 + wb1 * wb1;
      if (W < 1e-9) continue;
      // a touch right beside a clamped node can only be answered by the free end of that segment, which would
      // have to fly: let it give what it reasonably can
      const l = (pen * P.PUSH) / Math.max(W, 0.3);
      x[a0] += nx * l * wa0;
      x[a0 + 1] += ny * l * wa0;
      x[a0 + 2] += nz * l * wa0;
      if (wa1) {
        x[a1] += nx * l * wa1;
        x[a1 + 1] += ny * l * wa1;
        x[a1 + 2] += nz * l * wa1;
      }
      x[b0] -= nx * l * wb0;
      x[b0 + 1] -= ny * l * wb0;
      x[b0 + 2] -= nz * l * wb0;
      if (wb1) {
        x[b1] -= nx * l * wb1;
        x[b1 + 1] -= ny * l * wb1;
        x[b1 + 2] -= nz * l * wb1;
      }
    }
    this.deepest = deepest;
  }
}
