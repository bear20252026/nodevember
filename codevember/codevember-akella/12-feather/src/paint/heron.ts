// The great egret (Ardea alba): body, neck folded back in an S, bill, trailing legs, and two wings of
// separate feathers on a three-bone arm. Bird frame: x forward, y up, z to its right. Metres.
import * as TSL from "three/tsl";
import { BackSide, BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, Mesh, MeshBasicNodeMaterial, Object3D } from "three/webgpu";
import { featherMaterials, featherSet, skinDepthMaterial, solidDepthMaterial } from "./feather.ts";
import { toon, type Light, type N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { attribute, cameraPosition, float, length, mix, modelWorldMatrix, normalLocal, normalWorld, positionLocal, positionWorld, smoothstep, uniform, vec3, vec4 } = T;

type V3 = [number, number, number];
const RAD = Math.PI / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mix3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// how it flies; everything is a function of the beat phase, so a whole number of beats loops exactly
export const motion = {
  amp: 1, // depth of the stroke
  lag: 1, // how far the forearm, hand and tips trail the upper arm: the wave along the wing
  fold: 1, // how far the wing draws in on the way up
  flex: 1, // how far air bends the feathers
  twist: 1, // pitch of the wing through the stroke
  open: 1, // primaries turning like blinds on the upstroke
  bob: 0.017, // body rise and fall
  skew: 0.14, // downstroke a little longer than upstroke
};

// ---------------------------------------------------------------- solids

interface Ring {
  c: V3;
  t: V3;
  n: V3;
  b: V3;
  ry: number;
  rz: number;
  s: number; // arc length so far
  f: number; // 0..1 along the control points
}
interface LoftPoint {
  p: V3;
  ry: number;
  rz?: number;
}
// a tube through control points (Catmull-Rom), oval sections: ry in the tube's own "up", rz sideways
function loft(pts: LoftPoint[], sub_: number, ref: V3 = [0, 0, 1]): Ring[] {
  const n = pts.length;
  const get = (i: number) => pts[Math.min(n - 1, Math.max(0, i))];
  const cr = (a: number, b: number, c: number, d: number, t: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
  const rings: Ring[] = [];
  for (let i = 0; i < n - 1; i++)
    for (let k = 0; k < (i === n - 2 ? sub_ + 1 : sub_); k++) {
      const t = k / sub_;
      const [a, b, c, d] = [get(i - 1), get(i), get(i + 1), get(i + 2)];
      const p: V3 = [0, 1, 2].map((j) => cr(a.p[j], b.p[j], c.p[j], d.p[j], t)) as V3;
      const ry = Math.max(1e-4, cr(a.ry, b.ry, c.ry, d.ry, t));
      const rz = Math.max(1e-4, cr(a.rz ?? a.ry, b.rz ?? b.ry, c.rz ?? c.ry, d.rz ?? d.ry, t));
      rings.push({ c: p, t: [1, 0, 0], n: [0, 1, 0], b: [0, 0, 1], ry, rz, s: 0, f: (i + t) / (n - 1) });
    }
  for (let i = 0; i < rings.length; i++) {
    const a = rings[Math.max(0, i - 1)].c;
    const b = rings[Math.min(rings.length - 1, i + 1)].c;
    const t = norm(sub(b, a));
    const bb = norm(sub(ref, mul(t, dot(ref, t))));
    rings[i].t = t;
    rings[i].b = bb;
    rings[i].n = cross(bb, t);
    if (i > 0) rings[i].s = rings[i - 1].s + Math.hypot(...sub(rings[i].c, rings[i - 1].c));
  }
  return rings;
}
const ringPoint = (r: Ring, ang: number): V3 => add(r.c, add(mul(r.n, r.ry * Math.cos(ang)), mul(r.b, r.rz * Math.sin(ang))));
const ringNormal = (r: Ring, ang: number): V3 => norm(add(mul(r.n, Math.cos(ang) / r.ry), mul(r.b, Math.sin(ang) / r.rz)));

class Builder {
  pos: number[] = [];
  col: number[] = [];
  aux: number[] = [];
  idx: number[] = [];
  // colour and (steady, gloss) may vary along the tube and round it
  tube(rings: Ring[], seg: number, paint: (r: Ring, ang: number, p: V3) => { c: V3; steady: number; gloss: number }) {
    const base = this.pos.length / 3;
    for (const r of rings)
      for (let j = 0; j < seg; j++) {
        const ang = (j / seg) * Math.PI * 2;
        const p = ringPoint(r, ang);
        const q = paint(r, ang, p);
        this.pos.push(...p);
        this.col.push(...q.c);
        this.aux.push(q.steady, q.gloss);
      }
    for (let i = 0; i < rings.length - 1; i++)
      for (let j = 0; j < seg; j++) {
        const a = base + i * seg + j;
        const b = base + i * seg + ((j + 1) % seg);
        this.idx.push(a, b, a + seg, b, b + seg, a + seg);
      }
  }
  // pole along z, turned to face `side` (so rings run round the gaze)
  sphere(c: V3, r: number, side: number, paint: (d: V3) => { c: V3; steady: number; gloss: number }) {
    const base = this.pos.length / 3;
    const nu = 20;
    const nv = 14;
    for (let i = 0; i <= nv; i++)
      for (let j = 0; j < nu; j++) {
        const th = (i / nv) * Math.PI;
        const ph = (j / nu) * Math.PI * 2;
        const d: V3 = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th) * side];
        const q = paint(d);
        this.pos.push(...add(c, mul(d, r)));
        this.col.push(...q.c);
        this.aux.push(q.steady, q.gloss);
      }
    for (let i = 0; i < nv; i++)
      for (let j = 0; j < nu; j++) {
        const a = base + i * nu + j;
        const b = base + i * nu + ((j + 1) % nu);
        if (side > 0) this.idx.push(a, a + nu, b, b, a + nu, b + nu);
        else this.idx.push(a, b, a + nu, b, b + nu, a + nu);
      }
  }
  geometry() {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(this.pos), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(this.col), 3));
    g.setAttribute("aux", new BufferAttribute(new Float32Array(this.aux), 2));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

const WHITE: V3 = [1, 1, 1];
const BILL: V3 = [0.91, 0.45, 0.03];
const BILL_TIP: V3 = [0.2, 0.1, 0.03];
const LORE: V3 = [0.67, 0.67, 0.16];
const LEG: V3 = [0.022, 0.026, 0.05];
const HEAD_UP = 0.024; // the head rides above the fold of the neck

// the body's lines, all running tail to head
function bodyLofts() {
  const torso = loft(
    [
      { p: [-0.215, 0.012, 0], ry: 0.004, rz: 0.006 },
      { p: [-0.19, 0.008, 0], ry: 0.017, rz: 0.022 },
      { p: [-0.14, 0.0, 0], ry: 0.038, rz: 0.042 },
      { p: [-0.07, -0.006, 0], ry: 0.054, rz: 0.054 },
      { p: [0.01, -0.008, 0], ry: 0.062, rz: 0.058 },
      { p: [0.08, -0.006, 0], ry: 0.06, rz: 0.055 },
      { p: [0.14, -0.006, 0], ry: 0.05, rz: 0.044 },
      { p: [0.185, -0.01, 0], ry: 0.04, rz: 0.034 },
    ],
    6,
  );
  // a slim S: out of the chest, down and forward, round the kink, back up, and forward again to the head
  const neck = loft(
    [
      { p: [0.15, 0.0, 0], ry: 0.04, rz: 0.034 },
      { p: [0.205, -0.016, 0], ry: 0.029, rz: 0.025 },
      { p: [0.255, -0.03, 0], ry: 0.0215, rz: 0.0195 },
      { p: [0.295, -0.024, 0], ry: 0.018, rz: 0.017 },
      { p: [0.316, 0.0, 0], ry: 0.0162, rz: 0.0155 },
      { p: [0.306, 0.028, 0], ry: 0.0152, rz: 0.0146 },
      { p: [0.282, 0.046, 0], ry: 0.0146, rz: 0.014 },
      { p: [0.268, 0.066, 0], ry: 0.0145, rz: 0.014 },
      { p: [0.276, 0.084, 0], ry: 0.015, rz: 0.0145 },
      { p: [0.302, 0.091, 0], ry: 0.017, rz: 0.016 },
    ],
    8,
  );
  const head = loft(
    [
      { p: [0.296, 0.066 + HEAD_UP, 0], ry: 0.0182, rz: 0.017 },
      { p: [0.328, 0.069 + HEAD_UP, 0], ry: 0.0215, rz: 0.019 },
      { p: [0.352, 0.068 + HEAD_UP, 0], ry: 0.02, rz: 0.0172 },
      { p: [0.374, 0.064 + HEAD_UP, 0], ry: 0.0145, rz: 0.012 },
      { p: [0.39, 0.0625 + HEAD_UP, 0], ry: 0.0108, rz: 0.0082 },
      { p: [0.43, 0.059 + HEAD_UP, 0], ry: 0.0082, rz: 0.006 },
      { p: [0.47, 0.0555 + HEAD_UP, 0], ry: 0.0048, rz: 0.0034 },
      { p: [0.502, 0.053 + HEAD_UP, 0], ry: 0.0008, rz: 0.0006 },
    ],
    6,
  );
  return { torso, neck, head };
}

const BILL_FROM = 0.372; // x where feathers stop and horn starts

function buildSolids() {
  const b = new Builder();
  const { torso, neck, head } = bodyLofts();
  b.tube(torso, 24, () => ({ c: WHITE, steady: 0, gloss: 0 }));
  b.tube(neck, 20, (r) => ({ c: WHITE, steady: smooth(0.0, 0.8, r.f), gloss: 0 }));
  b.tube(head, 18, (r, ang, p) => {
    const t = smooth(BILL_FROM - 0.006, BILL_FROM + 0.004, p[0]);
    const tip = smooth(0.4, 0.5, p[0]);
    // bare skin between eye and bill
    const lore = smooth(0.354, 0.366, p[0]) * (1 - t) * smooth(0.55, 0.95, Math.abs(Math.sin(ang))) * smooth(0.056 + HEAD_UP, 0.064 + HEAD_UP, p[1]);
    let c = mix3(WHITE, LORE, lore);
    c = mix3(c, mix3(BILL, BILL_TIP, tip), t);
    return { c, steady: 1, gloss: t * 0.7 };
  });
  for (const side of [1, -1]) {
    // eye: a yellow iris round a black pupil, looking out sideways
    b.sphere([0.3555, 0.0715 + HEAD_UP, side * 0.0146], 0.005, side, (d) => {
      const out = d[2] * side;
      return { c: out > 0.78 ? [0.004, 0.004, 0.006] : out > 0.34 ? [0.96, 0.61, 0.045] : [0.05, 0.05, 0.06], steady: 1, gloss: out > 0.34 ? 1 : 0 };
    });
    // legs trail straight back, the white of the thigh giving way to black
    const leg = loft(
      [
        { p: [-0.07, -0.04, side * 0.024], ry: 0.016 },
        { p: [-0.14, -0.034, side * 0.02], ry: 0.011 },
        { p: [-0.21, -0.022, side * 0.016], ry: 0.0062 },
        { p: [-0.3, -0.016, side * 0.0135], ry: 0.0052 },
        { p: [-0.318, -0.0155, side * 0.013], ry: 0.0066 }, // the ankle
        { p: [-0.336, -0.0155, side * 0.0128], ry: 0.0048 },
        { p: [-0.44, -0.019, side * 0.012], ry: 0.0043 },
        { p: [-0.525, -0.024, side * 0.012], ry: 0.0045 },
      ],
      5,
    );
    b.tube(leg, 8, (r) => ({ c: mix3(WHITE, LEG, smooth(0.16, 0.3, r.f)), steady: 0, gloss: smooth(0.16, 0.3, r.f) * 0.45 }));
    // toes held loosely together behind, the hind toe tucked under
    const toes: [number, number, number][] = [
      [0.092, -0.012, 0.014],
      [0.1, -0.02, 0.0],
      [0.086, -0.014, -0.013],
      [0.045, -0.03, 0.002],
    ];
    for (const [len, dy, dz] of toes) {
      const o: V3 = [-0.522, -0.024, side * 0.012];
      const toe = loft(
        [
          { p: o, ry: 0.0036 },
          { p: add(o, [-len * 0.4, dy * 0.3, side * dz * 0.45]), ry: 0.003 },
          { p: add(o, [-len * 0.75, dy * 0.75, side * dz * 0.8]), ry: 0.0026 },
          { p: add(o, [-len, dy * 1.25, side * dz]), ry: 0.0012 },
        ],
        4,
      );
      b.tube(toe, 6, () => ({ c: LEG, steady: 0, gloss: 0.45 }));
    }
  }
  return b.geometry();
}

// ---------------------------------------------------------------- body plumage (fixed to the body)

function bodyFeathers() {
  const { torso } = bodyLofts();
  const rnd = rng(7);
  type Patch = { rings: Ring[]; n: number; len: number; wid: number; lift: number; steady: (f: number) => number; keep?: (p: V3) => boolean };
  // the body wears soft overlapping feathers; the neck and head are sleek (their feathers are too short and
  // close to read as anything but skin), so those stay bare tubes
  const patches: Patch[] = [{ rings: torso, n: 1100, len: 0.062, wid: 0.019, lift: 0.17, steady: () => 0 }];
  // plumes: a few long loose filaments on the nape, the breast and the back, which the air plays with.
  // Each is two crossed ribbons so it shows from any side
  type Plume = { root: V3; dir: V3; len: number; wid: number; bend: number; sweep: number; steady: number; loose: number };
  const plumes: Plume[] = [];
  for (let i = 0; i < 5; i++)
    plumes.push({
      root: [0.31 + i * 0.005, 0.086 + HEAD_UP, (rnd() - 0.5) * 0.012],
      dir: norm([-1, 0.0 + rnd() * 0.4, (rnd() - 0.5) * 0.4]),
      len: 0.08 + rnd() * 0.08,
      wid: 0.0016,
      bend: (rnd() < 0.5 ? 1 : -1) * (0.4 + rnd() * 0.9),
      sweep: (rnd() - 0.5) * 0.8,
      steady: 1,
      loose: 0.55,
    });
  for (let i = 0; i < 9; i++) {
    const z = (rnd() - 0.5) * 0.05;
    plumes.push({
      root: [0.165 + rnd() * 0.05, -0.036 + Math.abs(z) * 0.3, z],
      dir: norm([-0.85, -0.5 - rnd() * 0.25, z * 6]),
      len: 0.06 + rnd() * 0.05,
      wid: 0.0022,
      bend: 0.6 + rnd() * 0.8,
      sweep: (rnd() - 0.5) * 0.6,
      steady: 0.1,
      loose: 0.35,
    });
  }
  for (let i = 0; i < 12; i++) {
    const z = (rnd() - 0.5) * 0.07;
    plumes.push({
      root: [-0.08 + rnd() * 0.14, 0.05 - Math.abs(z) * 0.25, z],
      dir: norm([-1, 0.04 + rnd() * 0.1, z * 3]),
      len: 0.2 + rnd() * 0.14,
      wid: 0.003 + rnd() * 0.0015,
      bend: -0.7 + rnd() * 0.6,
      sweep: (rnd() - 0.5) * 0.5,
      steady: 0,
      loose: 0.3,
    });
  }
  const total = patches.reduce((s, p) => s + p.n, 0) + plumes.length * 2;
  const set = featherSet(total, 5, 7, false);
  let k = 0;
  for (const pt of patches) {
    const R = pt.rings;
    // pick by area: a table of ring spans weighted by girth
    const w: number[] = [];
    let acc = 0;
    for (let i = 0; i < R.length - 1; i++) {
      acc += (R[i + 1].s - R[i].s) * (R[i].ry + R[i].rz + R[i + 1].ry + R[i + 1].rz);
      w.push(acc);
    }
    for (let i = 0; i < pt.n; i++) {
      let p: V3, nn: V3, tt: V3, f: number, girth: number;
      let jj = 0;
      let tj = 0;
      let ang0 = 0;
      do {
        const u = rnd() * acc;
        let j = 0;
        while (w[j] < u) j++;
        const t = rnd();
        const ang = rnd() * Math.PI * 2;
        jj = j;
        tj = t;
        ang0 = ang;
        const ra: Ring = R[j];
        const rb: Ring = R[j + 1];
        const pa = ringPoint(ra, ang);
        const pb = ringPoint(rb, ang);
        p = mix3(pa, pb, t);
        // along the skin towards the head, and round it: the true surface, taper and all
        tt = norm(sub(pb, pa));
        const round = norm(sub(mix3(ringPoint(ra, ang + 0.05), ringPoint(rb, ang + 0.05), t), p));
        nn = norm(cross(tt, round));
        if (dot(nn, mix3(ringNormal(ra, ang), ringNormal(rb, ang), t)) < 0) nn = mul(nn, -1);
        f = lerp(ra.f, rb.f, t);
        girth = lerp(ra.ry, rb.ry, t);
      } while (pt.keep && !pt.keep(p));
      const size = (0.75 + rnd() * 0.5) * Math.min(1, girth / 0.02 + 0.35);
      const len = pt.len * size;
      // lie back along the body: aim at the skin one feather-length towards the tail (so they follow a bend
      // instead of sticking out of it), a little proud of it, with some disorder
      const sBack = lerp(R[jj].s, R[jj + 1].s, tj) - len;
      let b = jj;
      while (b > 0 && R[b].s > sBack) b--;
      const tb = clamp01((sBack - R[b].s) / Math.max(1e-6, R[b + 1].s - R[b].s));
      const behind = mix3(ringPoint(R[b], ang0), ringPoint(R[b + 1], ang0), tb);
      const nBehind = norm(mix3(ringNormal(R[b], ang0), ringNormal(R[b + 1], ang0), tb));
      const side = cross(nn, tt);
      const root = add(p, mul(nn, 0.0004));
      const aim = add(behind, mul(nBehind, pt.lift * len * (0.6 + rnd() * 0.8)));
      let flow = norm(add(norm(sub(aim, root)), mul(side, (rnd() - 0.5) * 0.4)));
      // never dive below the tangent of the skin it grows from
      const dive = dot(flow, nn);
      if (dive < 0.04) flow = norm(add(flow, mul(nn, 0.04 - dive)));
      const X = norm(cross(nn, flow));
      const Y = norm(cross(flow, X));
      set.shape.set([len, pt.wid * size, (rnd() - 0.5) * 0.2, 0.45, rnd() * 100, 0, 0.7 + rnd() * 0.3, 0.97 + rnd() * 0.06], k * 8);
      set.pose.set([...root, -0.08 - rnd() * 0.14, ...X, (rnd() - 0.5) * 0.3, ...Y, pt.steady(f), ...flow, (rnd() - 0.5) * 0.3], k * 16);
      k++;
    }
  }
  for (const pl of plumes) {
    const Z = pl.dir;
    const Y = norm(sub([0, 1, 0], mul(Z, Z[1])));
    const X = cross(Y, Z);
    const seed = rnd() * 100;
    for (const [A, B] of [
      [X, Y],
      [Y, mul(X, -1)],
    ] as [V3, V3][]) {
      // iB.y below zero is how much the air moves it (see feather.ts)
      set.shape.set([pl.len, pl.wid, 0, 0.3, seed, -pl.loose, 0, 1], k * 8);
      set.pose.set([...pl.root, pl.bend, ...A, 0, ...B, pl.steady, ...Z, pl.sweep], k * 16);
      k++;
    }
  }
  set.touch();
  return set;
}

// ---------------------------------------------------------------- wings

const ARM = [0.165, 0.215, 0.125]; // upper arm, forearm, hand
const SHOULDER: V3 = [0.088, 0.03, 0.044];
const KNOT = [0.5, 1.5, 2.5, 3.3]; // where each segment's angles hold, along the arm (the last is the feather tips)
const SWEEP0 = [-22, 20, -10, -14]; // spread wing, seen from above: upper arm back, forearm forward, hand back

const blend = (v: number[], a: number) => {
  if (a <= KNOT[0]) return v[0];
  for (let i = 0; i < 3; i++)
    if (a < KNOT[i + 1]) {
      const t = (a - KNOT[i]) / (KNOT[i + 1] - KNOT[i]);
      return lerp(v[i], v[i + 1], t * t * (3 - 2 * t));
    }
  return v[3];
};
// wing axes from sweep (in the wing's plane), pitch (about the span) and elevation (about the body's long axis), radians
function frame(sw: number, el: number, pt: number): { S: V3; C: V3; N: V3 } {
  const cs = Math.cos(sw);
  const ss = Math.sin(sw);
  const cp = Math.cos(pt);
  const sp = Math.sin(pt);
  const ce = Math.cos(el);
  const se = Math.sin(el);
  const up = (v: V3): V3 => [v[0], v[1] * ce + v[2] * se, v[2] * ce - v[1] * se];
  return { S: up([ss, 0, cs]), C: up([cs * cp, sp, -ss * cp]), N: up([-cs * sp, cp, ss * sp]) };
}

// which way a feather points with the wing spread, degrees from straight back round towards the tip
const psiOf = (a: number) => {
  const k: [number, number][] = [
    [0, -52],
    [0.28, -43],
    [0.94, -5],
    [1.04, -2],
    [1.96, 10],
    [2.04, 13],
  ];
  if (a >= 2.04) return 13 + 66 * Math.pow(clamp01((a - 2.04) / 0.94), 1.1);
  for (let i = 0; i < k.length - 1; i++) if (a <= k[i + 1][0]) return lerp(k[i][1], k[i + 1][1], clamp01((a - k[i][0]) / (k[i + 1][0] - k[i][0])));
  return 13;
};
// the arm with its skin and muscle is a flat lens from just behind the bones to the leading edge
const armThick = (a: number) => (a < 2 ? lerp(0.013, 0.009, a / 2) : lerp(0.009, 0.0025, smooth(2, 3, a)));

interface Spec {
  a: number; // along the arm, 0 shoulder .. 3 end of the hand
  q: number; // across the arm lens: -1 behind the bones .. 1 leading edge
  face: number; // 0 in the wing plane, 1 on top of the arm, -1 underneath
  hTip: number; // how far off the plane the tip ends up
  psi: number;
  len: number;
  wid: number;
  asym: number;
  tip: number;
  emarg: number;
  fluff: number;
  tone: number;
  seed: number;
  bend0: number;
  bendDyn: number;
  roll0: number;
  rollDyn: number;
  spread: number;
  sweep: number;
  hold: number; // 0 turns with the arm, 1 keeps to the body: the shoulder's feathers lie along the back whatever the wing does
}

function wingSpecs() {
  const rnd = rng(11);
  const specs: Spec[] = [];
  const base: Spec = { a: 0, q: -1, face: 0, hTip: 0, psi: 0, len: 0.1, wid: 0.02, asym: 0, tip: 0.7, emarg: 0, fluff: 0, tone: 1, seed: 0, bend0: 0, bendDyn: 0, roll0: 0, rollDyn: 0, spread: 0, sweep: 0, hold: 0 };
  const put = (s: Partial<Spec>) => specs.push({ ...base, ...s, seed: rnd() * 100, tone: (s.tone ?? 1) * (0.975 + rnd() * 0.05) });
  const flight: Spec[] = [];
  const remex = (s: Partial<Spec>) => {
    put(s);
    flight.push(specs[specs.length - 1]);
  };

  // primaries: on the hand, fanning from back to almost straight out; the outer ones narrow into fingers
  for (let i = 0; i < 10; i++) {
    const f = i / 9;
    const a = 2.04 + 0.94 * f;
    remex({
      a,
      psi: psiOf(a),
      len: 0.215 + 0.068 * Math.sin(Math.min(f / 0.75, 1) * Math.PI * 0.5) - 0.03 * Math.pow(Math.max(0, (f - 0.75) / 0.25), 2),
      wid: 0.0235 - 0.006 * f,
      asym: 0.18 + 0.4 * f,
      tip: 0.74 - 0.12 * f,
      emarg: smooth(0.4, 0.8, f),
      bend0: -0.1,
      bendDyn: 0.22 + 0.5 * f,
      roll0: 8,
      rollDyn: 8 + 30 * f,
      spread: 6 * clamp01((f - 0.35) / 0.65),
      sweep: -0.05 - 0.11 * f,
    });
  }
  // secondaries: along the forearm, pointing back
  for (let i = 0; i < 18; i++) {
    const f = i / 17;
    const a = 1.96 - 0.92 * f;
    remex({ a, psi: psiOf(a), len: 0.205 - 0.012 * f, wid: 0.0195, asym: 0.12, tip: 0.84, bend0: -0.12, bendDyn: 0.17 - 0.07 * f, roll0: 7, rollDyn: 5, sweep: -0.04 });
  }
  // tertials: closing the gap between elbow and body
  for (let i = 0; i < 8; i++) {
    const f = i / 7;
    const a = 0.94 - 0.7 * f;
    remex({ a, psi: psiOf(a), len: 0.198 - 0.05 * f, wid: 0.021, asym: 0.06, tip: 0.76, fluff: 0.05, bend0: -0.12, bendDyn: 0.05, roll0: 6, rollDyn: 2, hold: 0.45 * f * f });
  }

  for (const face of [1, -1]) {
    const top = face > 0;
    // greater coverts: one over (and one under) the base of each flight feather
    for (const r of flight) {
      const hand = r.a > 2;
      put({
        a: r.a + 0.012,
        q: -0.8,
        face,
        hTip: face * 0.0028,
        psi: r.psi * (hand ? 0.97 : 1) + (hand ? 0 : 1.5),
        len: r.len * (hand ? (top ? 0.36 : 0.3) : top ? 0.46 : 0.52),
        wid: r.wid * (hand ? 0.72 : 1.1),
        asym: r.asym * 0.5,
        tip: hand ? 0.62 : 0.72,
        fluff: top ? 0.08 : 0.16,
        bend0: face * -0.1,
        bendDyn: r.bendDyn * 0.25,
        roll0: 5,
        rollDyn: r.rollDyn * 0.2,
        hold: r.hold,
      });
    }
    // rows of smaller coverts shingled forward to the leading edge
    const rows = [
      { q: -0.42, n: 34, a0: 0.1, a1: 2.92, len: 0.074, wid: 0.016, fluff: 0.2, hTip: 0.0045 },
      { q: -0.02, n: 36, a0: 0.06, a1: 2.75, len: 0.056, wid: 0.0135, fluff: 0.28, hTip: 0.006 },
      { q: 0.38, n: 36, a0: 0.04, a1: 2.5, len: 0.046, wid: 0.012, fluff: 0.32, hTip: 0.007 },
      { q: 0.72, n: 38, a0: 0.03, a1: 2.96, len: 0.036, wid: 0.0105, fluff: 0.36, hTip: 0.007 },
      { q: 0.97, n: 44, a0: 0.02, a1: 2.98, len: 0.026, wid: 0.0085, fluff: 0.4, hTip: 0.006 },
    ];
    for (const row of rows)
      for (let i = 0; i < row.n; i++) {
        const a = lerp(row.a0, row.a1, (i + rnd() * 0.6) / row.n);
        const hand = smooth(1.95, 2.3, a);
        const k = lerp(1, 0.62, hand) * (0.9 + rnd() * 0.2) * (top ? 1 : 1.12);
        const len = row.len * k;
        const wid = row.wid * lerp(1.45, 0.95, hand);
        put({
          a,
          q: row.q + (rnd() - 0.5) * 0.1,
          face,
          hTip: face * row.hTip,
          psi: psiOf(a) * lerp(0.9, 0.96, hand) + (rnd() - 0.5) * 5,
          len,
          wid,
          tip: Math.max(0.3, 1 - (1.25 * wid) / len),
          fluff: row.fluff + (top ? 0 : 0.08),
          bend0: face * -0.16,
          bendDyn: 0.02,
          roll0: (rnd() - 0.5) * 4,
          hold: 0.45 * (1 - smooth(0, 0.7, a)) ** 2,
        });
      }
  }
  // alula: the thumb, three stiff little feathers at the wrist
  for (let i = 0; i < 3; i++) put({ a: 2.06 + i * 0.03, q: 0.9, face: 1, hTip: 0.003, psi: 60 + i * 5, len: 0.078 - i * 0.012, wid: 0.0105, asym: 0.3, tip: 0.62, bend0: -0.08, roll0: 6 });
  // scapulars: long feathers off the shoulder that lie back over the wing root; axillaries the same underneath
  for (let i = 0; i < 16; i++) {
    const row = i % 2;
    const f = (i >> 1) / 7;
    put({
      a: 0.02 + 0.42 * f,
      q: lerp(-0.7, 0.3, row) + (rnd() - 0.5) * 0.2,
      face: 1,
      hTip: 0.012 - 0.004 * row,
      psi: -78 + 22 * f + (rnd() - 0.5) * 6,
      len: lerp(0.17, 0.115, row) * (0.9 + rnd() * 0.2),
      wid: 0.021,
      tip: 0.6,
      fluff: 0.22,
      bend0: -0.2,
      bendDyn: 0.02,
      roll0: (rnd() - 0.5) * 8,
      hold: 0.85 - 0.3 * f,
    });
  }
  for (let i = 0; i < 9; i++) {
    const f = i / 8;
    put({
      a: 0.02 + 0.36 * f,
      q: -0.5 + (rnd() - 0.5) * 0.5,
      face: -1,
      hTip: -0.008,
      psi: -76 + 24 * f,
      len: 0.15 * (0.85 + rnd() * 0.25),
      wid: 0.02,
      tip: 0.6,
      fluff: 0.25,
      bend0: 0.16,
      bendDyn: 0.02,
      hold: 0.8 - 0.3 * f,
    });
  }
  return specs;
}

// tail: twelve short feathers in a shallow fan, with coverts over and under their bases
function tailSpecs() {
  const rnd = rng(23);
  const out: { root: V3; yaw: number; pitch: number; len: number; wid: number; fluff: number; seed: number; tip: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const f = (i + 0.5) / 12 - 0.5;
    out.push({ root: [-0.192, 0.008 - Math.abs(f) * 0.006, f * 0.034], yaw: f * 46, pitch: -3, len: 0.128 - Math.abs(f) * 0.03, wid: 0.0195, fluff: 0, seed: rnd() * 100, tip: 0.8 });
  }
  for (const face of [1, -1])
    for (let i = 0; i < 9; i++) {
      const f = (i + 0.5) / 9 - 0.5;
      out.push({ root: [-0.165 + (rnd() - 0.5) * 0.02, 0.006 + face * 0.02, f * 0.05], yaw: f * 50, pitch: -face * 9, len: 0.075 + rnd() * 0.02, wid: 0.017, fluff: 0.3, seed: rnd() * 100, tip: 0.5 });
    }
  return out;
}

const ARM_RINGS = 46;
const ARM_SEG = 10;

export interface Drawing {
  linePx: N; // width of drawn lines, pixels
  pxWorld: N; // size of a pixel one metre away (2·tan(fov/2) / viewport height)
}

export function createHeron(L: Light, draw: Drawing) {
  const steady = uniform(0);
  const beat = uniform(0);
  const group = new Object3D(); // what the camera sees
  const depthGroup = new Object3D(); // the same shapes as the sun's map wants them

  // --- solids
  const solidPos = positionLocal.add(vec3(0, attribute("aux", "vec2").x.mul(steady), 0));
  const aux = attribute("aux", "vec2");
  const paint = attribute("color", "vec3");
  // skin: the wing's arm, which light passes like the coverts over it, so a gap between them does not show
  const makeSolid = (skin: boolean) => {
    const m = new MeshBasicNodeMaterial();
    m.positionNode = solidPos;
    if (skin) m.side = DoubleSide;
    m.colorNode = toon(L, { P: positionWorld, N: normalWorld, albedo: paint, thin: float(skin ? 1 : 0), self: float(skin ? 3 : 0), gloss: aux.y, ao: float(skin ? 0.8 : 1) }).xyz;
    return m;
  };
  const solidMat = makeSolid(false);
  // the outline: the same solids turned inside out and swollen by a line's width, so only a rim shows
  const hullMat = new MeshBasicNodeMaterial();
  hullMat.side = BackSide;
  const far = length(cameraPosition.sub(modelWorldMatrix.mul(vec4(solidPos, 1)).xyz));
  hullMat.positionNode = solidPos.add(normalLocal.mul(far.mul(draw.pxWorld).mul(draw.linePx).mul(1.15)));
  const pale = T.dot(paint, vec3(0.3, 0.5, 0.2));
  hullMat.colorNode = mix(paint.mul(0.35), L.shadeTone.mul(L.lineTone).mul(0.9), smoothstep(0.3, 0.8, pale));
  const solidDepth = solidDepthMaterial(L, solidPos);
  const solidGeo = buildSolids();
  const body = new Mesh(solidGeo, solidMat);
  const hull = new Mesh(solidGeo, hullMat);
  const bodyDepth = new Mesh(solidGeo, solidDepth);

  // --- the arms: two lenses whose rings are rewritten every frame
  const armGeo = new BufferGeometry();
  const armN = 2 * ARM_RINGS * ARM_SEG;
  const armPos = new BufferAttribute(new Float32Array(armN * 3), 3).setUsage(DynamicDrawUsage);
  const armNor = new BufferAttribute(new Float32Array(armN * 3), 3).setUsage(DynamicDrawUsage);
  const armCol = new Float32Array(armN * 3);
  for (let i = 0; i < armN; i++) armCol.set(WHITE, i * 3);
  armGeo.setAttribute("position", armPos);
  armGeo.setAttribute("normal", armNor);
  armGeo.setAttribute("color", new BufferAttribute(armCol, 3));
  armGeo.setAttribute("aux", new BufferAttribute(new Float32Array(armN * 2), 2));
  const armIdx: number[] = [];
  for (let w = 0; w < 2; w++)
    for (let i = 0; i < ARM_RINGS - 1; i++)
      for (let j = 0; j < ARM_SEG; j++) {
        const a = w * ARM_RINGS * ARM_SEG + i * ARM_SEG + j;
        const b = w * ARM_RINGS * ARM_SEG + i * ARM_SEG + ((j + 1) % ARM_SEG);
        armIdx.push(a, b, a + ARM_SEG, b, b + ARM_SEG, a + ARM_SEG);
      }
  armGeo.setIndex(armIdx);
  const arms = new Mesh(armGeo, makeSolid(true));
  const armsDepth = new Mesh(armGeo, skinDepthMaterial(L, 1.6));

  // --- feathers
  const fm = featherMaterials(L, steady, beat, draw.linePx);
  const contour = bodyFeathers();
  const plumage = new Mesh(contour.geometry, fm.mat);
  const specs = wingSpecs();
  const tail = tailSpecs();
  const nWing = specs.length;
  const flying = featherSet(nWing * 2 + tail.length, 9, 18, true);
  const wings = new Mesh(flying.geometry, fm.mat);
  const wingsDepth = new Mesh(flying.geometry, fm.depth);

  for (const m of [body, hull, arms, plumage, wings]) {
    m.frustumCulled = false;
    group.add(m);
  }
  for (const m of [bodyDepth, armsDepth, wingsDepth]) {
    m.frustumCulled = false;
    depthGroup.add(m);
  }

  // fixed shape data
  for (let w = 0; w < 2; w++)
    specs.forEach((s, i) => {
      flying.shape.set([s.len, s.wid, s.asym, s.tip, s.seed + w * 31.7, s.emarg, s.fluff, s.tone], (w * nWing + i) * 8);
    });
  tail.forEach((t, i) => flying.shape.set([t.len, t.wid, 0.04, t.tip, t.seed, 0, t.fluff, 1], (nWing * 2 + i) * 8));
  // each feather's angle relative to its own stretch of arm, so it turns with the arm as the wing folds
  const psiLocal = specs.map((s) => s.psi - blend(SWEEP0, s.a));

  const pose = flying.pose;
  const state = { phase: 0, wrist: [0, 0, 0] as V3, tip: [0, 0, 0] as V3 };

  const update = (phase: number) => {
    const m = motion;
    const ph = phase - m.skew * (1 - Math.cos(phase));
    const lag = [0, 0.45 * m.lag, 1.0 * m.lag, 1.5 * m.lag];
    const c = (i: number) => Math.cos(ph - lag[i]);
    const s = (i: number) => Math.sin(ph - lag[i]);
    const fold = Math.pow(Math.max(0, -Math.sin(ph - 0.35)), 1.3) * m.fold;
    // the stroke: every stretch of the arm follows the same swing, later the further out it is
    const el = [8 + 36 * c(0) * m.amp, 5 + 43 * c(1) * m.amp, -2 + 50 * c(2) * m.amp, -6 + 56 * c(3) * m.amp].map((v) => v * RAD);
    const sw = [SWEEP0[0] - 14 * fold + 6 * s(0), SWEEP0[1] + 12 * fold, SWEEP0[2] - 26 * fold, SWEEP0[3] - 32 * fold].map((v) => v * RAD);
    // leading edge down on the way down, up on the way up, more so towards the tip
    const tw = (i: number, k: number) => -k * s(i) * (s(i) < 0 ? 1.35 : 1) * m.twist;
    const pt = [4 + tw(0, 5), 3 + tw(1, 9), 1 + tw(2, 15), tw(3, 20)].map((v) => v * RAD);

    // body rides the stroke: lowest half way down, highest half way up; the head stays nearly still
    const rise = -m.bob * Math.sin(ph);
    group.position.y = rise;
    group.rotation.z = (1.2 * Math.sin(ph + 0.7) - 1) * RAD;
    depthGroup.position.copy(group.position);
    depthGroup.rotation.copy(group.rotation);
    steady.value = -rise * 0.8;
    beat.value = phase;

    const fr = [0, 1, 2].map((i) => frame(sw[i], el[i], pt[i]));
    const elbow = add(SHOULDER, mul(fr[0].S, ARM[0]));
    const wrist = add(elbow, mul(fr[1].S, ARM[1]));
    const tip = add(wrist, mul(fr[2].S, ARM[2]));
    const lead0 = add(SHOULDER, mul(fr[0].C, 0.032));
    const lead2 = add(wrist, mul(fr[2].C, 0.012));
    const bone = (a: number): V3 => (a < 1 ? mix3(SHOULDER, elbow, Math.max(a, 0)) : a < 2 ? mix3(elbow, wrist, a - 1) : mix3(wrist, tip, Math.min(a - 2, 1)));
    const leadAt = (a: number, C: V3): V3 => (a < 2 ? mix3(lead0, lead2, a / 2) : add(bone(a), mul(C, lerp(0.012, 0.004, a - 2))));
    // the arm lens at a: its middle, its axis towards the leading edge, half its width
    const lens = (a: number) => {
      const f = frame(blend(sw, a), blend(el, a), blend(pt, a));
      const B = bone(a);
      const E = leadAt(a, f.C);
      const d = sub(E, B);
      const w = Math.hypot(...d);
      const dir = mul(d, 1 / w);
      const back = add(B, mul(dir, -0.009));
      const front = add(E, mul(dir, 0.003));
      return { f, mid: mix3(back, front, 0.5), dir, half: (w + 0.012) / 2, th: armThick(a) };
    };

    for (let w = 0; w < 2; w++) {
      const mz = w === 0 ? 1 : -1; // right wing, then its mirror
      const put = (k: number, root: V3, X: V3, Y: V3, Z: V3, bend: number, twist: number, sweep: number) => {
        pose[k] = root[0];
        pose[k + 1] = root[1];
        pose[k + 2] = root[2] * mz;
        pose[k + 3] = bend;
        pose[k + 4] = X[0];
        pose[k + 5] = X[1];
        pose[k + 6] = X[2] * mz;
        pose[k + 7] = twist;
        pose[k + 8] = Y[0];
        pose[k + 9] = Y[1];
        pose[k + 10] = Y[2] * mz;
        pose[k + 11] = 0;
        pose[k + 12] = Z[0];
        pose[k + 13] = Z[1];
        pose[k + 14] = Z[2] * mz;
        pose[k + 15] = sweep;
      };
      for (let i = 0; i < nWing; i++) {
        const sp = specs[i];
        const ln = lens(sp.a);
        // feathers of the shoulder keep mostly to the body's level while their roots ride the arm
        const { S, C, N } = sp.hold > 0 ? frame(blend(sw, sp.a), lerp(blend(el, sp.a), 5 * RAD, sp.hold), lerp(blend(pt, sp.a), 2 * RAD, sp.hold)) : ln.f;
        // air load at this place on the wing: pushes up on the way down, less (it spills) on the way up
        const load = Math.sin(ph - blend(lag, sp.a + 0.5) - 0.4);
        const push = load * (0.75 + 0.25 * load);
        const h = sp.face * (ln.th * Math.sqrt(Math.max(0, 1 - sp.q * sp.q)) + 0.0012);
        const root = add(add(ln.mid, mul(ln.dir, sp.q * ln.half)), mul(ln.f.N, h));
        const psi = (psiLocal[i] + sp.spread * Math.max(0, load) ** 2 * m.flex) * RAD;
        const cs = Math.cos(psi);
        const sn = Math.sin(psi);
        const dir: V3 = [-C[0] * cs + S[0] * sn, -C[1] * cs + S[1] * sn, -C[2] * cs + S[2] * sn];
        let X: V3 = [S[0] * cs + C[0] * sn, S[1] * cs + C[1] * sn, S[2] * cs + C[2] * sn];
        // tip the feather so its end comes down (or up) to lie on the feathers behind
        const tilt = (h - sp.hTip) / sp.len;
        const Z = norm(sub(dir, mul(N, tilt)));
        let Y = norm(add(N, mul(dir, tilt)));
        // roll about the shaft: a standing stagger, plus the blinds opening on the upstroke
        const roll = (sp.roll0 + sp.rollDyn * Math.pow(Math.max(0, -load), 1.5) * m.open) * RAD;
        const cr = Math.cos(roll);
        const sr = Math.sin(roll);
        const X2: V3 = [X[0] * cr + Y[0] * sr, X[1] * cr + Y[1] * sr, X[2] * cr + Y[2] * sr];
        Y = [Y[0] * cr - X[0] * sr, Y[1] * cr - X[1] * sr, Y[2] * cr - X[2] * sr];
        X = X2;
        put((w * nWing + i) * 16, root, X, Y, Z, sp.bend0 + sp.bendDyn * push * m.flex, 0, sp.sweep);
      }
      // arm rings
      for (let i = 0; i < ARM_RINGS; i++) {
        const a = (i / (ARM_RINGS - 1)) * 3;
        const ln = lens(a);
        for (let j = 0; j < ARM_SEG; j++) {
          const ang = (j / ARM_SEG) * Math.PI * 2;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const k = (w * ARM_RINGS * ARM_SEG + i * ARM_SEG + j) * 3;
          const p = add(ln.mid, add(mul(ln.dir, ln.half * ca), mul(ln.f.N, ln.th * sa)));
          const n = norm(add(mul(ln.dir, ca / ln.half), mul(ln.f.N, sa / ln.th)));
          armPos.array[k] = p[0];
          armPos.array[k + 1] = p[1];
          armPos.array[k + 2] = p[2] * mz;
          armNor.array[k] = n[0];
          armNor.array[k + 1] = n[1];
          armNor.array[k + 2] = n[2] * mz;
        }
      }
    }
    armPos.needsUpdate = true;
    armNor.needsUpdate = true;

    // tail: rides the body, flexing a touch against the bob
    const flexT = 0.1 * Math.sin(ph - 1.2) * m.flex;
    tail.forEach((t, i) => {
      const yaw = t.yaw * RAD;
      const pitch = t.pitch * RAD;
      const Z: V3 = [-Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch)];
      const sgn = t.yaw >= 0 ? 1 : -1;
      const X = mul(norm(cross([0, 1, 0], Z)), sgn);
      const Y = mul(norm(cross(Z, X)), sgn);
      const k = (nWing * 2 + i) * 16;
      pose.set([...t.root, -0.08 + flexT, ...X, 0, ...Y, 0, ...Z, 0], k);
    });

    flying.touch();
    state.phase = phase;
    state.wrist = wrist;
    state.tip = tip;
  };

  update(0);
  return { group, depthGroup, update, steady, state, counts: { wing: nWing, tail: tail.length, body: contour.count } };
}

export type Heron = ReturnType<typeof createHeron>;
export type { N };
