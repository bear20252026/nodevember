// The growth of an eisenblüte (flos ferri): aragonite stalks that sprout from a
// flat crust, wander, curl like worms, fork, and tangle without ever going
// through each other. Pure JS, no three.js, so it also runs in node (see stats.js).
//
// grow(seed) → { seed, version, params, branches, stats }
//   branches[i] = { parent, points: Float32Array [x, y, z, r, x, y, z, r, …] }
//   a branch starts at the point of its parent where it forks off (parent -1:
//   it starts in the crust). Units: the crust is about 2.4 long.

// bump when the algorithm changes: saved generations keep the version they grew with
export const VERSION = 8; // 1: a round rock, 2: a flat crust, 3: stalks that swell and thin,
// 4: a crust with sharp crests, peaks and a jagged outline, bristling with small stalks;
// many more stalks; a lumpy outer bound, each stem reaching more or less far
// 5: the cluster is sculpted in masses — dense bushy clumps, sparse tall wild tufts,
// bare stretches of crust between them, a few long stalks shooting out
// 6: the crust takes a shape of its own — arched, bowl, saddle, wedge, thick block,
// stepped, with a spine, in chunks, bent — and the masses follow it
// (or, grown alongside: a little fewer stalks, shorter on average, the spikes still shooting far out)
// 7: the same forms, milder: smaller bends, thickness and reliefs, bounded when two kinds add up
// 8: both together: the milder forms, and a little fewer, shorter stalks

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the spirit: what every generation shares. Each seed shifts these a little.
export const BASE = {
  budget: 26000, // points in all, the size of the cluster
  stems: [35, 60], // stalks leaving the crust
  sprouts: [110, 190], // and small ones, short and thin, all over it
  sproutScale: [0.35, 0.7], // radius of a small one / r0
  sproutLife: [5, 34], // its steps
  sproutTaper: 0.55, // radius left at the end of its life
  crust: { length: [1.0, 1.35], width: [0.42, 0.7], thickness: [0.1, 0.18] }, // half sizes
  step: 0.016, // length of a step
  r0: 0.034, // radius of a stem at the crust
  minR: 0.012, // below this a stalk stops
  taper: 0.999, // radius kept at each step
  wander: 0.22, // random turn at each step
  curl: 0.16, // the worm-like twist: turn around an axis that drifts
  curlDrift: 0.25,
  up: 0.03, // pull upwards
  spread: 0.025, // push away from the middle of the crust, sideways
  forkP: 0.035, // chance to fork at each step
  forkAngle: [0.55, 1.2], // radians
  stemScale: [0.65, 1.45], // radius of a stem / r0
  swell: 0.22, // a stalk swells and thins along its length: how much (log of the radius)
  swellPace: 0.03, // and how fast it changes (per step)
  childScale: [0.6, 0.98], // radius of a fork / radius before it
  parentScale: 0.93,
  avoid: 2.6, // a stalk feels the others up to avoid × (both radii)
  avoidStrength: 0.9,
  deathP: 0.003, // a stalk can just stop
  maxSteps: [60, 420], // and stops anyway after that many steps: skewed, most stop early, a few go on much longer
  // the cluster is a few masses side by side along the crust, each its own
  // character, from bushy (0: dense, short, curly, forking a lot, packed tight)
  // to wild (1: sparse, long, tall, straighter, rarely forking)
  masses: [2, 4],
  massHeight: [0.38, 1.55], // how high a mass rises above the crust
  massWidth: [0.55, 1.25], // × its share of the crust's length
  massLean: 0.25, // a mass leans sideways: shift per unit of height
  lobes: [3, 7], // each mass bulges out and caves in, in that many directions
  lobeSize: [-0.45, 0.65], // by this much (× the bound)
  reach: [0.62, 1.06], // each stem goes up to this × its mass's bound, its forks about as far
  spikes: [0, 5], // per mass, stems that shoot far out of it, long and straight
  spikeReach: [1.3, 1.9],
  bare: 0.35, // share of the stems' feet spread anywhere on the crust, not in a mass
};

// what a mass's character changes: [bushy, wild] — the rest is the same everywhere
const CHARACTER = {
  wander: [1.3, 0.55],
  curl: [1.5, 0.45],
  up: [0.3, 2.2],
  forkP: [1.9, 0.35],
  avoid: [0.72, 1.05],
  radius: [1.0, 0.72],
  life: [1.1, 1.7], // long enough that the bound, not the age, shapes the mass
  density: [1.9, 0.4], // stems per crust area
};

// The crust the stalks grow from: a slab, long and flat, its outline wavy,
// thicker in the middle, its top lumpy. Its description (params.slab) is drawn
// from the seed; slabShape() gives the functions both the growth and the mesh use.
// Its large form: one kind leads, a second one mixes in at half strength, and
// all the kinds' features are a little there anyway
export const FORMS = ['slab', 'block', 'arch', 'bowl', 'saddle', 'wedge', 'steps', 'spine', 'chunks', 'tilted'];

function formParams(rand) {
  const pick = (a, b) => a + rand() * (b - a);
  const sgn = () => (rand() < 0.5 ? -1 : 1);
  const lump = (s, h) => ({ u: pick(-0.7, 0.7), v: pick(-0.6, 0.6), s: pick(...s), h: pick(...h) });
  const f = {
    kinds: [],
    thick: pick(0.8, 1.3), // × T
    full: pick(0.7, 1.2), // the profile across: < 1 flatter on top, steeper at the rim
    bend: [pick(-0.06, 0.06), pick(-0.04, 0.04)], // ends up (+) or down (−), along and across
    twist: pick(-0.05, 0.05),
    tilt: pick(-0.06, 0.06), // the whole crust sloping along its length
    wedge: { a: pick(0, Math.PI * 2), g: pick(0, 0.3) }, // thicker on one side
    bow: pick(-0.12, 0.12), // its outline bent like a banana
    lobe: pick(0.7, 1.4), // × the outline's harmonics
    size: [pick(0.85, 1.1), pick(0.8, 1.35)], // × its length and width: long and narrow, or squat
    hills: Array.from({ length: Math.floor(pick(1, 3)) }, () => lump([0.25, 0.5], [0, 0.07])), // on top
    under: Array.from({ length: Math.floor(pick(1, 3)) }, () => lump([0.25, 0.55], [0, 0.08])), // hanging under
    steps: [], // across the crust: a fault (all of it shifted) or a terrace (its top only)
    spine: null, // a long ridge along the top
  };
  const step = (k) => ({
    a: pick(0, Math.PI), off: pick(-0.4, 0.4), h: pick(0.05, 0.14) * k, w: pick(0.015, 0.05), fault: rand() < 0.5,
  });
  const apply = {
    slab: (k) => { f.thick *= 1 - 0.3 * k; f.bow += sgn() * pick(0.12, 0.25) * k; f.lobe *= 1 + 0.35 * k; f.size[0] *= 1 + 0.1 * k; },
    block: (k) => { f.thick *= 1 + pick(0.7, 1.2) * k; f.full *= 1 - 0.45 * k; f.size[0] *= 1 - 0.18 * k; f.size[1] *= 1 + 0.18 * k; },
    arch: (k) => { f.bend[0] -= pick(0.22, 0.4) * k; f.bend[1] -= pick(0, 0.1) * k; f.thick *= 1 + 0.2 * k; },
    bowl: (k) => { f.bend[0] += pick(0.18, 0.3) * k; f.bend[1] += pick(0.08, 0.18) * k; },
    saddle: (k) => { const s = sgn(); f.bend[0] += s * pick(0.18, 0.3) * k; f.bend[1] -= s * pick(0.1, 0.18) * k; f.twist += pick(-0.08, 0.08) * k; },
    wedge: (k) => { f.wedge.g = Math.max(f.wedge.g, pick(0.5, 0.75) * k); f.wedge.a = sgn() > 0 ? pick(-0.4, 0.4) : Math.PI + pick(-0.4, 0.4); f.thick *= 1 + 0.5 * k; },
    steps: (k) => { for (let i = 0, n = 1 + Math.floor(rand() * 3); i < n; i++) f.steps.push(step(k)); },
    spine: (k) => { f.spine = { v: pick(-0.35, 0.35), w: pick(0.18, 0.4), h: pick(0.15, 0.3) * k, wob: pick(0, 0.25), f: pick(1, 3), p: pick(0, 6.28) }; },
    chunks: (k) => {
      for (let i = 0, n = 2 + Math.floor(rand() * 2); i < n; i++) f.hills.push(lump([0.2, 0.45], [0.1 * k, 0.25 * k]));
      for (let i = 0, n = 1 + Math.floor(rand() * 3); i < n; i++) f.under.push(lump([0.25, 0.5], [0.06 * k, 0.16 * k]));
      f.lobe *= 1 + 0.6 * k;
    },
    tilted: (k) => { f.tilt += sgn() * pick(0.12, 0.2) * k; f.twist += pick(-0.06, 0.06) * k; },
  };
  const first = FORMS[Math.floor(rand() * FORMS.length)];
  let second = FORMS[Math.floor(rand() * FORMS.length)];
  if (second === first) second = FORMS[(FORMS.indexOf(first) + 1 + Math.floor(rand() * (FORMS.length - 1))) % FORMS.length];
  apply[first](1);
  apply[second](pick(0.3, 0.6));
  f.kinds = [first, second];
  // two kinds can add up: keep the whole within bounds
  const clamp = (v, a) => Math.max(-a, Math.min(a, v));
  f.bend = [clamp(f.bend[0], 0.32), clamp(f.bend[1], 0.18)];
  f.tilt = clamp(f.tilt, 0.2);
  f.bow = clamp(f.bow, 0.3);
  f.thick = Math.min(f.thick, 2.1);
  f.full = Math.max(f.full, 0.5);
  f.lobe = Math.min(f.lobe, 1.8);
  f.cap = 0.28; // the hills, terraces and spine together
  return f;
}

function slabParams(rand, c) {
  const range = (a) => a[0] + rand() * (a[1] - a[0]);
  const form = formParams(rand);
  return {
    A: range(c.length) * form.size[0],
    B: range(c.width) * form.size[1],
    T: range(c.thickness),
    form,
    // the outline: a few harmonics on an ellipse
    harm: [2, 3, 4, 5, 7].map((k) => ({ k, a: (rand() * 0.16 * form.lobe) / Math.sqrt(k - 1), phi: rand() * Math.PI * 2 })),
    // the lumps on top
    bumps: Array.from({ length: 6 + Math.floor(rand() * 6) }, () => ({
      u: rand() * 1.6 - 0.8, v: rand() * 1.6 - 0.8, s: 0.12 + rand() * 0.3, h: (rand() * 2 - 0.6) * 0.07,
    })),
    tilt: (rand() * 2 - 1) * 0.04 + form.tilt, // the top a little higher on one side
    // sharp features: teeth in the outline, crests across the top, pointed peaks
    teeth: Array.from({ length: 4 }, () => ({ k: 7 + Math.floor(rand() * 16), a: 0.02 + rand() * 0.04, phi: rand() * Math.PI * 2 })),
    ridges: Array.from({ length: 7 + Math.floor(rand() * 6) }, () => ({
      u: rand() * 1.5 - 0.75, v: rand() * 1.5 - 0.75, ang: rand() * Math.PI, len: 0.15 + rand() * 0.5,
      w: 0.04 + rand() * 0.07, h: 0.05 + rand() * 0.11,
    })),
    peaks: Array.from({ length: 14 + Math.floor(rand() * 14) }, () => ({
      u: rand() * 1.7 - 0.85, v: rand() * 1.7 - 0.85, s: 0.04 + rand() * 0.1, h: 0.04 + rand() * 0.12,
    })),
  };
}

const NO_FORM = { thick: 1, full: 1, bend: [0, 0], twist: 0, wedge: { a: 0, g: 0 }, bow: 0, hills: [], under: [], steps: [], spine: null };

export function slabShape(S) {
  // a triangle wave: the outline's teeth have sharp tips and sharp notches
  const tri = (x) => (2 / Math.PI) * Math.asin(Math.sin(x));
  const teeth = S.teeth || [], ridges = S.ridges || [], peaks = S.peaks || [];
  const F = S.form || NO_FORM; // before v6, a flat crust
  const rho = (t) => 1 + S.harm.reduce((sum, h) => sum + h.a * Math.cos(h.k * t + h.phi), 0)
    + teeth.reduce((sum, h) => sum + h.a * tri(h.k * t + h.phi), 0);
  // a point of the outline's polar grid: k = 0 in the middle, 1 on the outline
  const place = (k, t) => {
    const x = S.A * k * Math.cos(t);
    return [x, S.B * (k * Math.sin(t) + F.bow * (x / S.A) ** 2)];
  };
  // where (x, z) is: u = 0 in the middle, 1 on the outline
  const at = (x, z) => {
    const nx = x / S.A, nz = z / S.B - F.bow * nx * nx;
    return Math.hypot(nx, nz) / rho(Math.atan2(nz, nx));
  };
  const dome = (u) => Math.sqrt(Math.max(0, 1 - u * u));
  const smooth = (d, w) => 0.5 + 0.5 * Math.tanh(d / w);
  const lump = (l, x, z) => {
    const dx = x / S.A - l.u, dz = z / S.B - l.v;
    return l.h * Math.exp(-(dx * dx + dz * dz) / (l.s * l.s));
  };
  const across = (st, x, z) => Math.cos(st.a) * x / S.A + Math.sin(st.a) * z / S.B - st.off;
  // the large form. warp: where the whole crust is, bent, twisted, sloping, faulted
  const warp = (x, z) => {
    const nx = x / S.A, nz = z / S.B;
    let y = S.tilt * x + F.bend[0] * nx * nx + F.bend[1] * nz * nz + F.twist * nx * nz;
    for (const st of F.steps) if (st.fault) y += st.h * smooth(across(st, x, z), st.w);
    return y;
  };
  // its half thickness
  const swell = (x, z) => S.T * F.thick * Math.max(0.2, 1 + F.wedge.g * (Math.cos(F.wedge.a) * x / S.A + Math.sin(F.wedge.a) * z / S.B));
  // what rises on its top: hills, terraces, a spine
  const raise = (x, z) => {
    let y = 0;
    for (const l of F.hills) y += lump(l, x, z);
    for (const st of F.steps) if (!st.fault) y += st.h * smooth(across(st, x, z), st.w);
    const p = F.spine;
    if (p) {
      const nx = x / S.A, dz = (z / S.B - p.v - p.wob * Math.sin(nx * p.f + p.p)) / p.w;
      y += p.h * Math.exp(-dz * dz) * (1 - 0.3 * nx * nx);
    }
    return F.cap ? F.cap * Math.tanh(y / F.cap) : y; // where they pile up, never too high (since v7)
  };
  const sink = (x, z) => F.under.reduce((y, l) => y + lump(l, x, z), 0);
  // the top without its rim nor its small features: what the masses stand on
  const ground = (x, z) => warp(x, z) + swell(x, z) + raise(x, z);
  const top = (x, z, u = at(x, z)) => {
    const fade = dome(Math.min(u, 1)) ** 0.5;
    const cliff = dome(Math.min(u, 1)) ** 0.3; // the big forms drop steeply at the rim
    let y = warp(x, z) + swell(x, z) * (0.35 + 0.65 * dome(u) ** F.full) + raise(x, z) * cliff;
    for (const b of S.bumps) {
      const dx = x - b.u * S.A, dz = z - b.v * S.B;
      y += b.h * Math.exp(-(dx * dx + dz * dz) / (b.s * b.s)) * fade;
    }
    // crests: a triangular profile across, pointed at both ends
    for (const r of ridges) {
      const dx = x - r.u * S.A, dz = z - r.v * S.B;
      const c = Math.cos(r.ang), s = Math.sin(r.ang);
      const along = (dx * c + dz * s) / r.len, across = Math.abs(-dx * s + dz * c);
      if (Math.abs(along) >= 1) continue;
      const w = r.w * (1 - along * along);
      if (across < w) y += r.h * (1 - Math.abs(along)) * (1 - across / w) * fade;
    }
    // peaks: cones, sharp at the tip
    for (const p of peaks) {
      const d = Math.hypot(x - p.u * S.A, z - p.v * S.B);
      if (d < p.s) y += p.h * (1 - d / p.s) ** 1.4 * fade;
    }
    return y;
  };
  const bottom = (x, z, u = at(x, z)) =>
    warp(x, z) - swell(x, z) * (0.3 + 0.35 * dome(u) ** F.full) - sink(x, z) * dome(Math.min(u, 1)) ** 0.3;
  return { rho, place, at, top, bottom, warp, ground };
}

// the shortcut to test the algorithm quickly: fewer, coarser steps
export const QUICK = { budget: 0.35, step: 1.8 };

function jitter(rand, base) {
  const p = structuredClone(base);
  const f = (k, amount) => (p[k] *= 1 + (rand() * 2 - 1) * amount);
  f('wander', 0.35);
  f('curl', 0.5);
  f('curlDrift', 0.4);
  f('up', 0.8);
  f('spread', 0.5);
  f('forkP', 0.35);
  f('r0', 0.18);
  f('taper', 0.0004);
  f('budget', 0.25);
  f('swell', 0.4);
  return p;
}

const SKIP_OWN = 7; // a tip ignores the last points of its own stalk
const SKIP_PARENT = 10; // and a young fork its parent

export function grow(seed, options = {}) {
  const t0 = performance.now();
  const rand = rng(seed);
  const P = jitter(rand, { ...BASE, ...options.params });
  if (options.quick) {
    P.budget *= QUICK.budget;
    P.step *= QUICK.step;
    P.taper = 1 - (1 - P.taper) * QUICK.step;
    P.forkP *= QUICK.step;
    P.deathP *= QUICK.step;
    P.swellPace *= QUICK.step;
    P.maxSteps = P.maxSteps.map((m) => m / QUICK.step);
    P.sproutLife = P.sproutLife.map((m) => m / QUICK.step);
  }
  const range = (a) => a[0] + rand() * (a[1] - a[0]);
  P.slab = slabParams(rand, P.crust);
  const slab = slabShape(P.slab);
  const { A, B: SB } = P.slab;
  const lerp = (a, t) => a[0] + (a[1] - a[0]) * t;
  const bow = (x) => (P.slab.form ? P.slab.form.bow * SB * (x / A) ** 2 : 0); // the crust's bend, sideways

  // the masses: spread along the crust, each a lumpy half ellipsoid over its
  // footprint, leaning a little, with its own character
  const nm = Math.round(range(P.masses));
  // their heights stratified, shuffled: a low one next to a high one, never all alike
  const tiers = Array.from({ length: nm }, (_, i) => (i + rand()) / nm);
  for (let i = nm - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [tiers[i], tiers[j]] = [tiers[j], tiers[i]];
  }
  P.masses = [];
  for (let i = 0; i < nm; i++) {
    const c = rand() ** 0.8; // a little more often wild than bushy
    const share = (2 * A) / nm;
    const cx = -A + share * (i + 0.5) + (rand() * 2 - 1) * share * 0.3;
    const cz = (rand() * 2 - 1) * SB * 0.35 + bow(cx);
    const h = lerp(P.massHeight, tiers[i]) * lerp([0.85, 1.1], c);
    const fx = (share / 2) * range(P.massWidth) * lerp([0.8, 1.1], c);
    const fz = SB * (0.55 + rand() * 0.45);
    const lobes = Array.from({ length: Math.round(range(P.lobes)) }, () => {
      const a = rand() * Math.PI * 2, e = Math.asin(rand() * 0.95); // upper half
      return { d: [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)], h: range(P.lobeSize) * lerp([1.3, 0.9], c), w: 0.1 + rand() * 0.4 };
    });
    const k = Object.fromEntries(Object.entries(CHARACTER).map(([key, v]) => [key, lerp(v, c)]));
    P.masses.push({
      c, cx, cz, fx, fz, lobes, k,
      // the ellipsoid: centered under the crust, so the mass is a dome, its sides sloping;
      // it is draped over the crust's form (y0: where the crust is under its middle)
      y0: slab.ground(cx, cz) - P.slab.T,
      rx: fx * 1.35 + 0.15, ry: h * 1.45, rz: fz * 1.2 + 0.18, cy: -h * 0.45,
      lean: [Math.max(-0.3, Math.min(0.3, (rand() * 2 - 1) * P.massLean + cx / A * 0.12)), (rand() * 2 - 1) * P.massLean * 0.5],
    });
  }
  // where a point is, relative to its mass: 1 on the bound (lobes included)
  const massDist = (m, x, y, z) => {
    y -= m.y0 === undefined ? 0 : slab.ground(x, z) - P.slab.T; // its height above the crust's form
    const ly = (y - m.cy) / m.ry;
    const lx = (x - m.cx - m.lean[0] * Math.max(0, y)) / m.rx, lz = (z - m.cz - m.lean[1] * Math.max(0, y)) / m.rz;
    const l = Math.hypot(lx, ly, lz) || 1e-6;
    let b = 1;
    for (const o of m.lobes) b += o.h * Math.exp(((lx * o.d[0] + ly * o.d[1] + lz * o.d[2]) / l - 1) / o.w);
    return { d: l / Math.min(1.45, Math.max(0.45, b)), g: norm([lx / m.rx, ly / m.ry, lz / m.rz]) };
  };
  // the mass a point of the crust belongs to most (feet spread anywhere pick one)
  const nearest = (x, z) => {
    let best = P.masses[0], bd = Infinity;
    for (const m of P.masses) {
      const d = Math.hypot((x - m.cx) / m.fx, (z - m.cz) / m.fz);
      if (d < bd) (bd = d), (best = m);
    }
    return best;
  };

  // every point, for the collisions: position, radius, branch, index in branch
  const X = [], Y = [], Z = [], R = [], B = [], I = [];
  const cell = 0.1;
  const grid = new Map();
  const key = (x, y, z) => ((Math.floor(x / cell) + 512) * 1024 + Math.floor(y / cell) + 512) * 1024 + Math.floor(z / cell) + 512;
  const addPoint = (x, y, z, r, b, i) => {
    const n = X.length;
    X.push(x); Y.push(y); Z.push(z); R.push(r); B.push(b); I.push(i);
    const k = key(x, y, z);
    let c = grid.get(k);
    if (!c) grid.set(k, (c = []));
    c.push(n);
  };

  const unit = () => {
    const z = rand() * 2 - 1, a = rand() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a), z];
  };
  const norm = (v) => {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  const branches = [];
  const tips = [];
  let deaths = { collision: 0, thin: 0, age: 0, chance: 0, bound: 0 };

  // a small one (sprout) lives shorter, tapers to a point faster, and forks less
  // each stalk belongs to a mass (m) and grows as its character says; a spike
  // wanders and forks much less
  const startBranch = (parent, pos, dir, r, reach, sprout, m, spike = false) => {
    const id = branches.length;
    const life = sprout ? range(P.sproutLife) : (P.maxSteps[0] + rand() ** 2.2 * (P.maxSteps[1] - P.maxSteps[0])) * m.k.life;
    branches.push({ parent, points: [pos[0], pos[1], pos[2], r] });
    const k = spike ? { ...m.k, wander: m.k.wander * 0.45, curl: m.k.curl * 0.35, forkP: m.k.forkP * 0.35, up: m.k.up * 1.6 } : m.k;
    tips.push({
      id, parent, pos: [...pos], dir: norm(dir), r, base: r, s: 0, reach, n: 1, sinceFork: 0, axis: unit(), life, sprout, m, k, spike,
      taper: sprout ? Math.min(P.taper, P.sproutTaper ** (1 / life)) : P.taper,
      minR: sprout ? P.minR * 0.4 : P.minR,
    });
    return id;
  };

  // the stems leave the top of the crust, upwards, leaning out from their
  // mass's middle. Most stand in a mass, as many as its density wants;
  // the others anywhere, thin on the ground
  const weights = P.masses.map((m) => m.fx * m.fz * m.k.density);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const stems = Math.round(range(P.stems) * (0.7 + 0.45 * wsum / (A * SB)));
  const feet = [];
  const gauss = () => (rand() + rand() + rand() - 1.5) * 1.15;
  for (let s = 0, tries = 0; s < stems && tries < 4000; tries++) {
    let m, x, z, spike = false;
    if (rand() < P.bare) {
      x = (rand() * 2 - 1) * A * 1.2; z = (rand() * 2 - 1) * SB * 1.2 + bow(x);
      m = nearest(x, z);
    } else {
      let pick = rand() * wsum, i = 0;
      while (i < weights.length - 1 && (pick -= weights[i]) > 0) i++;
      m = P.masses[i];
      x = m.cx + gauss() * m.fx * 0.6; z = m.cz + gauss() * m.fz * 0.6;
    }
    const u = slab.at(x, z);
    const gap = P.r0 * 4 * lerp([0.6, 1.3], m.c);
    if (u > 0.9 || feet.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < gap)) continue;
    feet.push([x, z]);
    const w = unit();
    const ox = (x - m.cx) / m.rx, oz = (z - m.cz) / m.rz;
    const d = norm([ox * 0.9 + m.lean[0] + w[0] * 0.45, 1, oz * 0.9 + m.lean[1] + w[2] * 0.45]);
    const r = P.r0 * range(P.stemScale) * m.k.radius;
    startBranch(-1, [x, slab.top(x, z, u) - r * 0.5, z], d, r, range(P.reach), false, m);
    s++;
  }
  // and the spikes, from inside the masses, long and straight
  for (const m of P.masses) {
    const n = Math.round(range(P.spikes) * lerp([0.6, 1.3], m.c));
    for (let s = 0, tries = 0; s < n && tries < 200; tries++) {
      const x = m.cx + gauss() * m.fx * 0.45, z = m.cz + gauss() * m.fz * 0.45;
      const u = slab.at(x, z);
      if (u > 0.85 || feet.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < P.r0 * 2.5)) continue;
      feet.push([x, z]);
      const w = unit();
      const d = norm([(x - m.cx) / m.rx * 1.2 + m.lean[0] + w[0] * 0.3, 1, (z - m.cz) / m.rz * 1.2 + m.lean[1] + w[2] * 0.3]);
      const r = P.r0 * range(P.stemScale) * 0.8;
      startBranch(-1, [x, slab.top(x, z, u) - r * 0.5, z], d, r, range(P.spikeReach), false, m, true);
      tips[tips.length - 1].life *= 2.6;
      s++;
    }
  }

  // the small ones bristle all over the crust, out from its surface
  const sprouts = Math.round(range(P.sprouts));
  const sfeet = [];
  for (let s = 0, tries = 0; s < sprouts && tries < 6000; tries++) {
    const x = (rand() * 2 - 1) * A * 1.25, z = (rand() * 2 - 1) * SB * 1.25 + bow(x);
    const u = slab.at(x, z);
    if (u > 0.97) continue;
    const r = P.r0 * range(P.sproutScale);
    if (feet.some(([fx, fz]) => Math.hypot(fx - x, fz - z) < P.r0 * 2.5)) continue;
    if (sfeet.some(([fx, fz, fr]) => Math.hypot(fx - x, fz - z) < (fr + r) * 2.2)) continue;
    sfeet.push([x, z, r]);
    // the normal of the top there: on a crest's flank they lean out with it
    const e = 0.01, y = slab.top(x, z, u);
    const n = norm([-(slab.top(x + e, z) - y) / e, 1, -(slab.top(x, z + e) - y) / e]);
    const w = unit();
    const d = norm([n[0] + x / A * u * 0.5 + w[0] * 0.5, n[1], n[2] + (z - bow(x)) / SB * u * 0.5 + w[2] * 0.5]);
    startBranch(-1, [x, y - r * 0.5, z], d, r, range(P.reach), true, nearest(x, z));
    s++;
  }

  let total = 0, sproutPoints = 0; // the budget counts only the big stalks
  while (tips.length && total < P.budget) {
    for (let t = tips.length - 1; t >= 0; t--) {
      const tip = tips[t];
      const [px, py, pz] = tip.pos;
      let d = tip.dir;

      // wander and curl
      const w = unit();
      tip.axis = norm(tip.axis.map((a, k) => a + w[k] * P.curlDrift));
      const c = cross(tip.axis, d);
      const w2 = unit();
      const K = tip.k, M = tip.m;
      d = d.map((v, k) => v + w2[k] * P.wander * K.wander + c[k] * P.curl * K.curl);
      d[1] += P.up * K.up;
      // away from the middle of its mass, sideways, and with its lean
      const sx = (px - M.cx) / M.rx, sz = (pz - M.cz) / M.rz, sl = Math.hypot(sx, sz) || 1;
      const f0 = P.spread * Math.min(1, sl);
      d[0] += (sx / sl) * f0 + M.lean[0] * P.up * K.up * 0.5;
      d[2] += (sz / sl) * f0 + M.lean[1] * P.up * K.up * 0.5;

      // feel the others: turn away, die if touching
      const avoid = P.avoid * K.avoid;
      const reach = (tip.r + P.r0) * avoid + P.step;
      const push = [0, 0, 0];
      let hit = false;
      const cx = Math.floor(px / cell), cy = Math.floor(py / cell), cz = Math.floor(pz / cell);
      const span = Math.ceil(reach / cell);
      for (let i = -span; i <= span && !hit; i++)
        for (let j = -span; j <= span && !hit; j++)
          for (let k = -span; k <= span && !hit; k++) {
            const list = grid.get(((cx + i + 512) * 1024 + cy + j + 512) * 1024 + cz + k + 512);
            if (!list) continue;
            for (const q of list) {
              if (B[q] === tip.id && tip.n - I[q] < SKIP_OWN) continue;
              if (B[q] === tip.parent && tip.n < SKIP_PARENT) continue;
              // a stalk ignores the first points of its forks
              if (I[q] < SKIP_PARENT && branches[B[q]].parent === tip.id) continue;
              const vx = px - X[q], vy = py - Y[q], vz = pz - Z[q];
              const dist = Math.hypot(vx, vy, vz);
              const touch = tip.r + R[q];
              const feel = touch * avoid;
              if (dist < touch * 0.95) { hit = true; break; }
              if (dist < feel) {
                const f = (1 - dist / feel) / dist;
                push[0] += vx * f; push[1] += vy * f; push[2] += vz * f;
              }
            }
          }
      if (hit) { deaths.collision++; tips.splice(t, 1); continue; }

      // the crust: up and away from its top
      const u = slab.at(px, pz);
      if (u < 1.05 && tip.n > 2) {
        const above = py - slab.top(px, pz, u) - tip.r * 2;
        if (above < 0) push[1] += Math.min(3, -above / (tip.r * 2));
      } else if (tip.n > 2) { // past its edge: not hanging under it
        const below = slab.warp(px, pz) - py;
        if (below > 0) push[1] += Math.min(2, below / (tip.r * 4));
      }
      // the soft boundary: its mass, lumpy, leaning
      const md = massDist(M, px, py, pz);
      const dr = md.d / tip.reach;
      if (dr > 1) {
        const g = [md.g[0], Math.max(0.1, md.g[1]), md.g[2]]; // never pushed under the crust
        const f = (dr - 1) * 4;
        push[0] -= g[0] * f; push[1] -= g[1] * f; push[2] -= g[2] * f;
      }
      d = norm(d.map((v, k) => v + push[k] * P.avoidStrength));
      tip.dir = d;

      // step
      if (!tip.sprout) total++;
      else sproutPoints++;
      tip.pos = [px + d[0] * P.step, py + d[1] * P.step, pz + d[2] * P.step];
      // the point it leaves joins the obstacles only now, so it doesn't see itself
      addPoint(px, py, pz, tip.r, tip.id, tip.n - 1);
      // the radius: tapering, and swelling and thinning slowly around that
      tip.base *= tip.taper;
      tip.s += (rand() * 2 - 1) * P.swell * Math.sqrt(6 * P.swellPace) - tip.s * P.swellPace;
      tip.r = tip.base * Math.exp(tip.s);
      branches[tip.id].points.push(...tip.pos, tip.r);
      tip.n++;
      tip.sinceFork++;

      // the end of a stalk
      let end = null;
      if (tip.base < tip.minR) end = 'thin';
      else if (tip.n > tip.life) end = 'age';
      else if (rand() < P.deathP) end = 'chance';
      else if (dr > 1.4) end = 'bound';
      if (end) { deaths[end]++; tips.splice(t, 1); continue; }

      // fork
      if (tip.sinceFork > 6 && rand() < P.forkP * K.forkP * (tip.sprout ? 0.4 : 1)) {
        tip.sinceFork = 0;
        const childR = tip.r * range(P.childScale);
        tip.base *= P.parentScale;
        tip.r *= P.parentScale;
        // turn away from the stalk, around a random perpendicular
        const perp = norm(cross(d, unit()));
        const a = range(P.forkAngle);
        const cd = d.map((v, k) => v * Math.cos(a) + perp[k] * Math.sin(a));
        startBranch(tip.id, tip.pos, cd, childR, tip.reach * (tip.spike ? 0.75 : 0.88 + rand() * 0.26), tip.sprout, M);
        if (tip.sprout) tips[tips.length - 1].life = Math.max(4, (tip.life - tip.n) * 0.8);
        // and the stalk itself swerves a little the other way
        tip.dir = norm(d.map((v, k) => v - perp[k] * Math.sin(a) * 0.3));
      }
    }
  }
  const out = branches.map((b) => ({ parent: b.parent, points: new Float32Array(b.points) }));
  return {
    seed,
    version: VERSION,
    quick: !!options.quick,
    params: P,
    branches: out,
    stats: { points: total, sproutPoints, branches: out.length, stems, sprouts, alive: tips.length, deaths, ms: Math.round(performance.now() - t0) },
  };
}
