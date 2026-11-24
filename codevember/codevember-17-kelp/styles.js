// The kinds of kelp a stroke can grow into. Each gives its stipe (the stroke itself),
// what it hangs on the stipe as the stroke passes (onSegment), what rides its tip
// (init: strands attached at node -1 follow the tip as it is drawn), and what grows once
// the stroke is let go (done).
//
// No two plants of a kind are the same colour: each is somewhere between the kind's two
// tones (a giant kelp can be the gold of one lit from above, or the near-black olive of
// one seen against the light), its tissue more or less blistered, spotted, worn.
// What sets a plant apart is picked in spine(), drawn from the plant's look: a branch has
// its host's look, so it is picked the same for it (it grows the same kind of plant).
import * as THREE from 'three';

const PI = Math.PI;
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// a colour of the kind, nudged for this plant
function tint(hex, plant, amount = 1) {
  const r = plant.rand;
  return new THREE.Color(hex).offsetHSL((plant.hue - 0.5) * 0.035 * amount, (r() - 0.5) * 0.12 * amount, (r() - 0.5) * 0.06 * amount);
}
// a colour between the kind's two tones, where this plant falls (u: 0…1)
function tone(a, b, plant, u = plant.hue, amount = 1) {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), u);
  return tint('#' + c.getHexString(), plant, amount);
}
const hashVary = (k, ph) => (i, j) => Math.sin(i * 12.9898 + j * 78.233 + ph) * k;

// the holdfast: long, fine brown roots clawing at the sand round the root
function holdfast(plant, t, count = 7, size = 1) {
  if (!plant.anchored || plant.host) return;
  const r = plant.rand;
  const c = tint('#5e4a2a', plant);
  for (let k = 0; k < count; k++) {
    const side = k % 2 ? 1 : -1;
    // each its own length: about one in three a short stub, the rest mostly middling, a few
    // reaching far out over the sand; its curl spread over its length so a long one sweeps
    // as gently as a short one bends
    const segs = r() < 0.35 ? 2 + Math.floor(r() * 4) : 6 + Math.floor(r() * 7 + r() * r() * 8);
    // crooked, as roots are: its heading wanders (a slow meander, never twice the same),
    // it is kinked sharply here and there, its segments uneven and its girth lumpy
    const curl = -side * (0.7 + r() * 0.8) / segs, seg = (0.48 + r() * 0.12) * size;
    const mA = 0.12 + r() * 0.14, mF = 0.6 + r() * 0.7, mP = r() * 6.3;
    const lump = r() * 6.3;
    const root = plant.addStrand({
      parent: plant.spine, at: 0, abs: true, holdfast: true,
      rootAngle: -PI / 2 + side * (0.5 + r() * 0.9),
      width: (i, n) => 0.09 * size * (1 - 0.65 * i / n) * (1 + 0.22 * Math.sin(i * 2.3 + lump) * Math.sin(i * 0.9 + lump * 1.7)),
      round: true, cols: 4,
      color: c, buoy: -0.4, drag: 0.05, bend: 0.2, born: t, grow: 0.5,
    });
    let way = r() < 0.5 ? -1 : 1; // each kink turns back the other way, so they zigzag rather than coil
    for (let i = 0; i < segs; i++) {
      const kink = r() < 0.22 ? (way = -way) * (0.3 + r() * 0.45) : 0;
      const rel = i === 0 ? 0 : curl + mA * (Math.sin(i * mF + mP) - Math.sin((i - 1) * mF + mP)) / Math.max(0.3, mF) + kink + (r() - 0.5) * 0.18;
      root.add(rel, seg * (0.7 + r() * 0.6));
    }
  }
}

// a lance-shaped blade, a short stalk at its base
const lance = (hw, stalk = 1, sharp = 0.6) => (i, n) => {
  if (i <= stalk) return 0.16;
  const u = (i - stalk) / Math.max(1, n - stalk);
  return 0.12 + hw * Math.pow(Math.sin(PI * Math.pow(u, sharp)), 0.75);
};

// ---- giant kelp's parts, hung on its stipe
function giantBlade(p, parent, i, t, side) {
  const r = p.rand;
  const old = Math.max(0, 1 - i / 26); // the lower blades are the older ones: worn, spotted
  // no two alike: one in the light, gold, the next in the shade of the others, near-black
  const u = Math.min(1, Math.max(0, p.hue + (r() - 0.5) * 0.7));
  const blade = p.addStrand({
    parent, at: i, side: side * 0.7,
    rootAngle: side * (0.4 + r() * 0.5),
    seg: 1.05, segs: 10 + Math.floor(r() * 7), curl: -side * (0.012 + r() * 0.048), wobble: 0.1,
    width: lance((0.95 + r() * 0.55) * p.bladeW, 1, 0.5 + r() * 0.15), cols: 7,
    ruffle: { amp: 0.3 + r() * 0.12, freq: 2.6 + r() * 1.2, speed: 1.5 + r() * 0.5 },
    color: tone(p.palette[0], p.palette[1], p, u), vary: hashVary(0.07, r() * 10),
    buoy: 0.25, drag: 1.3, bend: 9 + r() * 3,
    twist: side * 0.5 + (r() - 0.5) * 1.3, twistRate: 0.03 + r() * 0.03, flutter: 0.45 + r() * 0.3,
    bump: 1.1, teeth: 0.5 + r() * 0.5, spots: p.spots * (0.4 + old), tatter: 0.25 + 0.75 * old * r(),
    born: t, grow: 0.9,
  });
  // its gas float, a golden pear on a short stalk
  blade.bulbs.push({ node: 1, r: 0.3 + r() * 0.08, elong: 1.9, shift: 0.15, pear: 0.7, color: tint(p.floatC, p) });
  return blade;
}

// a strand grown alongside the stroke rather than along it (the cords of sea lace): rooted at the holdfast, splayed from the stipe by a (radians), it
// turns back over its first `turn` segments to run beside it, taking on its shape and,
// `follow` of the way, its sway; it keeps up with the stroke at its own rate, meandering
// about it: its heading off the stroke's a long, slow wave and a shorter one over it
// (wave: a1, f1, a2, f2: radians, radians per segment), never twice the same, and `jitter`
function companion(p, o, a, { rate, turn = 8, wave, jitter = 0.02, seg = 1 }) {
  const r = p.rand;
  const c = p.addStrand({ parent: p.spine, at: 0, rootAngle: a, born: p.time, ...o });
  c.rate = rate;
  c.acc = 0;
  c.wave = { ...wave, p1: r() * 6.3, p2: r() * 6.3, lean: -a * (0.75 + r() * 0.2) / turn, turn, jitter, seg };
  return c;
}
// how far a companion's heading is off the stroke's at segment j (eased in once it has
// turned to run beside it)
function meander(w, j) {
  return sstep(w.turn * 0.5, w.turn * 2.5, j) * (w.a1 * Math.sin(j * w.f1 + w.p1) + w.a2 * Math.sin(j * w.f2 + w.p2));
}
// the companions take a step for each of the stroke's, at their own rate (onGrow: what
// grows on one as it lengthens)
function keepUp(p, list, onGrow) {
  const r = p.rand;
  for (const c of list) {
    c.acc += c.rate;
    while (c.acc >= 1) {
      c.acc -= 1;
      const j = c.n, w = c.wave;
      const rel = j === 0 ? 0 : (j <= w.turn ? w.lean : 0) + meander(w, j) - meander(w, j - 1) + (r() - 0.5) * w.jitter;
      c.add(rel, w.seg);
      onGrow?.(c, j);
    }
  }
}

// the growing tip: one curved scimitar of a blade, splitting off young blades along its edge
function giantTip(p, parent, t) {
  const r = p.rand;
  const side = r() < 0.5 ? -1 : 1;
  const c = tone(p.palette[0], p.palette[1], p, p.hue * 0.6);
  p.addStrand({
    parent, at: -1, rootAngle: side * 0.15, seg: 0.55, segs: 12, curl: -side * 0.075, wobble: 0.03,
    width: (i, n) => 0.2 + 1.0 * p.bladeW * Math.sin(PI * Math.pow(i / n, 0.45)) ** 0.8, cols: 7,
    ruffle: { amp: 0.3, freq: 3.5, speed: 1.6 }, color: c,
    buoy: 0.5, drag: 0.8, bend: 3, twist: side * 0.4, flutter: 0.45, bump: 0.8, teeth: 0.4, born: t, grow: 1.2,
  });
  for (let k = 0; k < 3; k++) {
    p.addStrand({
      parent, at: -1, side: -side * 0.6, rootAngle: -side * (0.3 + k * 0.25), seg: 0.5, segs: 4 + k * 2, curl: side * 0.04,
      width: lance(0.35 + k * 0.18, 0), cols: 5, color: c, ruffle: { amp: 0.25, freq: 3, speed: 1.6 },
      buoy: 0.5, drag: 0.8, bend: 3, twist: (k - 1) * 0.6, flutter: 0.45, bump: 0.7, teeth: 0.5, born: t + 0.1 * k, grow: 1.2,
    });
  }
}

// the fringed strap of a feather boa's little blades
function boaBlade(p, i, t, side, size) {
  const r = p.rand;
  const len = (1.4 + r() * 2.4) * size;
  const segs = 5;
  p.addStrand({
    parent: p.spine, at: i, side: side * 0.85, rootAngle: side * (0.7 + r() * 0.6),
    seg: len / segs, segs, curl: -side * 0.12,
    width: (k, n) => 0.03 + 0.46 * size * Math.sin(PI * Math.pow(k / n, 0.8)), cols: 5,
    color: tone(p.palette[0], p.palette[1], p, Math.min(1, Math.max(0, p.hue + (r() - 0.5) * 0.4)), 1.6),
    buoy: 0.3, drag: 0.9, bend: 5, twist: (r() - 0.5) * 2, flutter: 0.6, bump: 0.5, teeth: 0.3 * r(),
    born: t, grow: 0.5,
  });
}

// a strap: a long, broad, leathery blade off a short stalk, as wide nearly all its length
// and rounded off at its worn end, its margins waved; it turns its face only a little
// along its length, a lazy half turn at most, not a corkscrew
function strap(p, at, t, side, { len = 1, hw = 1, a = 0.5, lag = 0 } = {}) {
  const r = p.rand;
  // blades of one plant are far from all alike in length: some short and stubby, worn or
  // young, most middling, a few streaming out half again as long as the rest
  const segs = Math.max(10, Math.round(35 * (0.45 + 1.2 * r() ** 1.3) * len));
  const w = hw * p.strapW * (0.85 + r() * 0.3);
  // light amber in the sun, dark brown where it lies in the others' shade
  const u = Math.min(1, Math.max(0, p.hue + (r() - 0.5) * 0.8));
  return p.addStrand({
    parent: p.spine, at, side: side * 0.6, rootAngle: side * a,
    seg: 1.15, segs, curl: (r() - 0.5) * 0.012, wobble: 0.05,
    width: (i, n) => {
      if (i < 1) return 0.22;
      const u = i / n;
      return 0.2 + (w - 0.2) * sstep(0, 0.22, u) * (1 - 0.35 * sstep(0.55, 1, u)) * (1 - 0.6 * sstep(0.9, 1, u) ** 2);
    },
    cols: 9,
    // its margins waved all along, the waves running out to its end
    ruffle: { amp: 0.45 + r() * 0.15, freq: 0.5 + r() * 0.2, speed: 0.9 + r() * 0.5 },
    color: tone(p.palette[0], p.palette[1], p, u), vary: hashVary(0.05, r() * 10),
    // limp, carried by the water node by node, each in its own time: a wave of push of its
    // own running out along it, and the current taking it now harder, now softer than the next
    limp: true, flap: 1.4,
    undulate: { amp: 0.07 + r() * 0.06, freq: 0.22 + r() * 0.14, speed: 1.0 + r() * 0.8 },
    gust: { amp: 0.45 + r() * 0.25, speed: 0.35 + r() * 0.4, push: 0.25 + r() * 0.2 },
    buoy: 0.32 + r() * 0.14, drag: 0.9 + r() * 0.6, bend: 32 + r() * 14,
    twist: side * 0.3 + (r() - 0.5) * 0.8, twistRate: (r() - 0.5) * 0.04, flutter: 0.2 + r() * 0.15,
    bump: 1.4, spots: p.spots * r(), tatter: 0.35 + r() * 0.5,
    born: t + lag, grow: 1.8,
  });
}

// ---- knotted wrack's parts. Its frond is one cord, swelling every so often into an
// egg-shaped bladder and narrowing back past it, like beads on a string: the bladder is the
// frond itself, swollen, not a float hung on it. It forks just past a bladder, both legs
// going on from there, and where it forks or between bladders, short shoots tipped with
// yellow, club-shaped pods (receptacles) stand off it.
// how far node i is into a bladder (0 outside, 1 at its fullest): an egg, its fuller end up
function swell(sw, i) {
  let e = 0;
  for (const b of sw) {
    const d = (i - b.c) / (i < b.c ? b.h * 1.15 : b.h * 0.85);
    if (d > -1 && d < 1) e = Math.max(e, (0.5 + 0.5 * Math.cos(PI * d)) ** 0.35);
  }
  return e;
}
// a cord's half-width: hw, pinched at its base, tapering to its tip, swollen into its
// bladders (sw: { c: the middle node, h: half its length in nodes, r: its half-width })
const cord = (hw, sw, stalk = 5, tip = 11) => (i, n) => {
  const w = hw * (0.55 + 0.45 * sstep(0, stalk, i)) * (1 - 0.8 * sstep(n - tip, n, i)) + 0.03;
  let out = w;
  for (const b of sw) {
    const e = swell([b], i);
    if (e > 0) out = Math.max(out, w + (b.r - w) * e);
  }
  return out;
};
// the bladders lighter, their walls stretched thin, glossy
const cordShade = (sw, ph) => (i, j) => 0.2 * swell(sw, i) + Math.sin(i * 12.9898 + j * 78.233 + ph) * 0.04;
// cut fine as it is, it curls no tighter than a coarser kind would (curb), and the
// pointer's wake only sets it rolling, about as hard as the surge at its strongest (tame)
const wrackOpts = (p, hw, sw, u, t, grow) => ({
  width: cord(hw, sw), round: true, cols: 5, curb: 1, tame: 1,
  color: tone(p.palette[0], p.palette[1], p, u), vary: cordShade(sw, p.rand() * 10),
  bump: 0.5, spots: p.spots, born: t, grow,
});
// how far a shoot stands out of its parent's plane, round it: either way, never quite
// toward or away from the eye (it would be lost end-on)
const rollOff = (r, lo, hi) => (r() < 0.5 ? -1 : 1) * (lo + r() * (hi - lo));
// a pod: a short shoot off a cord's side, thickening into a yellow club
function receptacle(p, parent, at, side, t) {
  const r = p.rand, n = 6 + Math.floor(r() * 3);
  p.addStrand({
    parent, at, side: side * 0.7, rootAngle: side * (0.35 + r() * 0.45), roll: rollOff(r, 0.3, 1.1), seg: 0.24, segs: n, curl: -side * 0.05, wobble: 0.06,
    ...wrackOpts(p, 0.05, [{ c: n - 2, h: 3, r: 0.2 + r() * 0.1 }], 0, t, 0.9),
    color: tone(p.podC[0], p.podC[1], p, r()), buoy: 0.3, drag: 0.5, bend: 2,
  });
}
// where a cord's bladders go: the first a little way along it, then one every so often
function beads(p, n, hw, from) {
  const r = p.rand, sw = [];
  for (let j = from + r() * 6; j < n - 11; j += 10 + r() * 10) {
    const h = 3.3 + r() * 1.4;
    sw.push({ c: j + h, h, r: hw * (2.1 + r() * 0.6) });
    j += 2 * h;
  }
  return sw;
}
// a frond: a cord off its parent at node `at`, splayed by `a` (radians) and turning back over
// its first nodes to run up near it, wandering a little; forking past its bladders (depth:
// how many times more), pods off it
function frond(p, parent, at, a, segs, depth, t, hw = p.strapW) {
  const r = p.rand;
  const side = Math.sign(a) || 1;
  const sw = beads(p, segs, hw, 8);
  const f = p.addStrand({
    // standing out of its parent's plane, so the plant is a bush all round, not a flat fan
    parent, at, side: side * 0.3, rootAngle: a, roll: rollOff(r, 0.35, 1.15), seg: 0.3, segs,
    ...wrackOpts(p, hw, sw, Math.min(1, Math.max(0, p.hue + (r() - 0.5) * 0.5)), t, 1.1),
    // soft as rope, barely buoyant: the surge bends it all along, a slow wave running up it
    buoy: 0.18 + r() * 0.1, drag: 1.1, bend: 12 + r() * 8,
    undulate: { amp: 0.012 + r() * 0.012, freq: 0.1 + r() * 0.08, speed: 0.6 + r() * 0.5 },
  });
  const back = 7 + Math.floor(r() * 6), bias = (r() - 0.5) * 0.009;
  // at rest, long S-curves: its bend swinging one way then the other every few units, no
  // more than half a turn or so either way (a sway, never a loop)
  const lam = 28 + r() * 26, A = 0.035 + r() * 0.035, ph = r() * 6;
  for (let j = 1; j < f.n; j++) f.rest[j] = (j <= back ? -a * (0.4 + r() * 0.3) / back : 0) + bias
    + A * Math.sin((2 * PI * j) / lam + ph) * Math.min(1, j / 8) + (r() - 0.5) * 0.015;
  for (const b of sw) {
    const j = Math.round(b.c + b.h) + 1; // just past the bladder
    if (j >= f.n - 10) break;
    if (depth > 0 && r() < 0.75) {
      // a fork: the new leg goes one way, the cord turns a little the other
      const s = r() < 0.5 ? -1 : 1;
      f.rest[j] -= s * (0.1 + r() * 0.1);
      frond(p, f, j, s * (0.3 + r() * 0.3), Math.max(14, Math.floor((f.n - j) * (0.6 + r() * 0.4))), depth - 1, t + 0.15, hw * 0.9);
    } else if (r() < 0.6) receptacle(p, f, j, r() < 0.5 ? -1 : 1, t + 0.4);
    if (r() < 0.4) receptacle(p, f, j + 1, r() < 0.5 ? -1 : 1, t + 0.45);
  }
  return f;
}

// sea lace's cords, let go: how firmly they keep fanned out, and keep the bends they grew
// with (and the swell running up them)
const SPLAY = 0.7, MEMORY = 0.04;

export const STYLES = {
  // giant kelp: thin, glossy orange stipes, a blade off them at every node (by turns one
  // side then the other), each swung on its own gas float, a scimitar of a blade at the
  // tip (one frond to a stroke: more come from branching it)
  giant: {
    label: 'giant',
    seg: 1.3,
    spine: (p) => {
      const r = p.rand;
      p.palette = r() < 0.6 ? ['#c99838', '#3e2c12'] : ['#b88a2c', '#4e3e16']; // gold … dark olive-brown
      p.floatC = r() < 0.5 ? '#b8661c' : '#a35a1a';
      p.bladeW = 0.85 + r() * 0.45;
      p.spots = r() < 0.55 ? 0.05 + r() * 0.18 : 0;
      p.stipeC = tone('#e0841c', '#8a4e14', p, p.hue * 0.7); // orange, glossy
      return {
        width: (i, n) => 0.3 * (1 - 0.3 * i / Math.max(n, 1)), round: true, cols: 5,
        color: p.stipeC, buoy: 1.1, drag: 0.5, bend: 0.9, grow: 1e-3,
      };
    },
    init(p) {
      holdfast(p, p.time, 9, 1.15);
      giantTip(p, p.spine, p.time);
    },
    onSegment(p, i, t) {
      if (i >= 3) {
        p.side = -(p.side || 1);
        giantBlade(p, p.spine, i, t, p.side);
      }
    },
  },

  // bull kelp: a whip of a stipe swelling into one big float, a mane of long ribbons off it
  bull: {
    label: 'bull',
    seg: 1.3,
    spine: (p) => {
      const r = p.rand;
      p.palette = ['#a37a2c', '#4a3816'];
      p.spots = r() < 0.5 ? 0.04 + r() * 0.1 : 0;
      p.floatC = tone('#b8923c', '#76602a', p);
      return {
        width: (i, n) => 0.2 + 0.42 * Math.pow(i / Math.max(n, 1), 2.2), round: true, cols: 5,
        color: tone('#93722e', '#5e4a20', p), buoy: 0.9, drag: 0.35, bend: 0.7, grow: 1e-3,
      };
    },
    init(p) {
      holdfast(p, p.time, 8);
      const r = p.rand;
      p.spine.bulbs.push({ node: -1, r: 1.6, elong: 1.35, shift: 0.7, pear: -0.25, color: p.floatC });
      const spots = p.spots;
      const count = 11 + Math.floor(r() * 6);
      for (let k = 0; k < count; k++) {
        const a = ((k + 0.5) / count - 0.5) * 1.5 + (r() - 0.5) * 0.3;
        p.addStrand({
          parent: p.spine, at: -1, ahead: 2.0, rootAngle: a,
          seg: 1.1, segs: 22 + Math.floor(r() * 14), curl: -a * 0.015, wobble: 0.06,
          width: (i, n) => (i < 1 ? 0.25 : 0.95 * (1 - 0.6 * Math.pow(i / n, 3))), cols: 7,
          ruffle: { amp: 0.5, freq: 2.2, speed: 1.6 },
          color: tone(p.palette[0], p.palette[1], p, Math.min(1, Math.max(0, p.hue + (r() - 0.5) * 0.3))), vary: hashVary(0.07, k),
          buoy: 0.04, drag: 1.4, bend: 22, twist: (r() - 0.5) * 1.6, twistRate: 0.02, flutter: 0.45,
          bump: 1, spots, tatter: 0.5 + r() * 0.5,
          born: p.time + k * 0.03, grow: 1.6,
        });
      }
    },
  },

  // sugar kelp: a short stalk and the stroke one long, broad blade, blistered down its
  // middle and frilled at its edges, worn at its tip
  sugar: {
    label: 'sugar',
    seg: 1.0,
    spine: (p) => {
      const r = p.rand;
      const hw = 3.4 + r() * 1.6;
      return {
        width: (i, n) => Math.max(0.32 * (1 - sstep(1, 4, i)), 0.1 + (hw - 0.1) * sstep(2, 11, i) * sstep(-1.5, 9, n - i)),
        cols: 13, rows: 4, ruffle: { amp: 0.11 + r() * 0.04, freq: 0.85 + r() * 0.2, speed: 0, irr: 0.35, margin: 0.35, rock: 0.3, cup: 0.06 }, color: tone('#c09640', '#6b5420', p), vary: hashVary(0.04, 3),
        buoy: 0.55, drag: 1.0, bend: 1.3, flutter: 0.3, twistRate: 0.008, grow: 1e-3,
        bump: 1.5, spots: r() < 0.4 ? 0.05 : 0, tatter: 0.5 + r() * 0.5, dents: 0.3 + r() * 0.3,
      };
    },
    init(p) { holdfast(p, p.time); },
  },

  // feather boa kelp: a flat strap fringed all along with little blades and floats
  boa: {
    label: 'feather boa',
    seg: 1.0,
    spine: (p) => {
      p.palette = ['#a6853a', '#56441a'];
      return {
        width: (i, n) => 0.55 * (1 - 0.6 * sstep(n - 6, n, i)), cols: 3,
        color: tone('#7a6430', '#46381a', p), buoy: 0.85, drag: 0.8, bend: 0.9, twistRate: 0.05, flutter: 0.2, grow: 1e-3, bump: 0.4,
      };
    },
    init(p) { holdfast(p, p.time); },
    onSegment(p, i, t) {
      if (i < 2) return;
      const r = p.rand;
      const size = Math.min(1, 0.35 + i / 14);
      for (const side of [-1, 1]) {
        if (r() > 0.9) continue;
        if (r() < 0.12) {
          const f = p.addStrand({
            parent: p.spine, at: i, side: side * 0.8, rootAngle: side * 0.9, seg: 0.3, segs: 1,
            width: () => 0.07, cols: 3, color: tint('#4f4320', p), buoy: 0.6, drag: 0.3, bend: 1, born: t, grow: 0.5,
          });
          f.bulbs.push({ node: 1, r: 0.36, elong: 1.7, shift: 0.8, pear: 0.4, color: tint('#8a7430', p) });
          continue;
        }
        boaBlade(p, i, t, side, size);
        if (r() < 0.4) boaBlade(p, i, t + 0.1, side, size * 0.6);
      }
    },
  },

  // strap kelp: a dark, supple stipe bearing only a few blades, far apart, each a long,
  // broad, wavy-edged strap, limp as a ribbon, streaming in its own time, two more off its tip
  strap: {
    label: 'strap',
    seg: 1.3,
    spine: (p) => {
      const r = p.rand;
      p.palette = r() < 0.6 ? ['#d0a034', '#3c2a0e'] : ['#b88a30', '#4a3a14']; // amber … dark brown
      p.strapW = 2.1 + r() * 0.8;
      p.spots = r() < 0.4 ? 0.04 + r() * 0.08 : 0;
      p.gap = 8 + Math.floor(r() * 4); // segments between two blades
      p.next = 4 + Math.floor(r() * 3);
      return {
        width: (i, n) => 0.28 * (1 - 0.35 * i / Math.max(n, 1)), round: true, cols: 5,
        color: tone('#8a6424', '#3e2c10', p), buoy: 1.0, drag: 0.45, bend: 0.8, grow: 1e-3,
      };
    },
    init(p) {
      holdfast(p, p.time, 8, 1.1);
      // the tip's pair, riding it as it is drawn: the youngest, not yet the longest
      const side = p.rand() < 0.5 ? -1 : 1;
      strap(p, -1, p.time, side, { len: 0.8, hw: 0.9, a: 0.18 });
      strap(p, -1, p.time, -side, { len: 0.6, hw: 0.8, a: 0.32, lag: 0.15 });
    },
    onSegment(p, i, t) {
      if (i < p.next) return;
      p.next = i + p.gap + Math.floor(p.rand() * 3);
      p.side = -(p.side || 1);
      strap(p, i, t, p.side);
    },
  },

  // sea lace: a tangle of long, thin, round cords, some pale and some dark, growing
  // alongside the stroke and swaying with it, each meandering about it in its own way,
  // now and then swerving off in a wide, open S (or a bend it keeps), their tips hooked
  // over as they grow, a few into a small spiral; they run all round the stipe, not in
  // its plane, and twist with it
  lace: {
    label: 'sea lace',
    seg: 1.0,
    spine: (p) => {
      const r = p.rand;
      p.palette = r() < 0.65 ? ['#8daa80', '#0e2414'] : ['#aaa170', '#22240e']; // sage … bottle green, or straw … olive
      p.cords = [];
      // the swell running up the whole tuft: one long, slow wave, the stipe's and every
      // cord's in step (each a little detuned, a little ahead or behind), so it passes
      // through the tuft as a ripple through hair rather than each cord wriggling alone
      p.swell = { freq: 0.15 + r() * 0.05, speed: 0.6 + r() * 0.2, phase: r() * 6.3 };
      return {
        width: (i, n) => 0.12 * (1 - 0.5 * sstep(n - 8, n, i)), round: true, cols: 4,
        color: tone(p.palette[0], p.palette[1], p, r()), buoy: 0.6, drag: 1.0, bend: 1.8, flex: 1, grow: 1e-3,
        undulate: { amp: 0.035, freq: p.swell.freq, speed: p.swell.speed, tip: 0.8 }, phase: p.swell.phase,
      };
    },
    init(p) {
      holdfast(p, p.time, 5, 0.8);
      const r = p.rand;
      const count = 34 + Math.floor(r() * 26);
      for (let k = 0; k < count; k++) {
        const a = (r() - 0.5) * 1.5, w = 0.05 + 0.07 * r();
        // two families, the pale and the dark, few in between
        const u = r() < 0.5 ? r() * 0.3 : 0.6 + r() * 0.4;
        // its tip: mostly a hook, a gentle lean, now and then a small spiral (tightest at
        // the very end); the hook rides on the tip as the cord grows
        const t = r(), dir = r() < 0.5 ? -1 : 1;
        const hook = t < 0.1 ? { amt: dir * (0.45 + r() * 0.2), k: 14 + Math.floor(r() * 5), pow: 1.8 }
          : t < 0.65 ? { amt: dir * (0.1 + r() * 0.2), k: 7 + Math.floor(r() * 5), pow: 1.3 }
          : { amt: dir * (0.02 + r() * 0.05), k: 8, pow: 1 };
        const cord = companion(p, {
          width: (i, n) => (w + 0.035) * (1 - 0.55 * i / Math.max(n, 1)) * (1 - 0.6 * sstep(n - 10, n, i)) + 0.012, round: true, cols: 4,
          color: tone(p.palette[0], p.palette[1], p, u, 0.6),
          buoy: 0.2 + r() * 0.35, drag: 1.0, bend: 2.5 + r() * 3, flex: 1, follow: 0.55 + r() * 0.45,
          // held to the stipe at the holdfast, ever freer and softer out to the tip, so it
          // gives along its length and its outer reach trails in the water
          followFade: 0.55 + r() * 0.3, supple: 2 + r() * 2,
          // the swell running up it, long and unhurried, swelling smoothly toward the tip
          // (its turn in proportion to its wavelength, so it swings no further for being
          // long), in step with the stipe's and its neighbours', give or take a little
          undulate: ((sw, freq) => ({ amp: freq * (0.22 + r() * 0.1), freq, speed: sw.speed * (0.92 + r() * 0.16), tip: 1 + r() * 0.4 }))(p.swell, p.swell.freq * (0.9 + r() * 0.2)),
          phase: p.swell.phase + (r() - 0.5) * 1.5,
          grow: 0.4, hook,
          // where round the stipe it runs, and how it wanders round it along its length
          orbit: { phi: (r() - 0.5) * 2.7, amp: 0.3 + r() * 0.6, freq: 0.03 + r() * 0.05, ph: r() * 6.3 },
        }, a, {
          rate: 0.45 + r() * 0.75, turn: 8,
          // its meander long and open: the short wave over it only a faint ripple, so it
          // has no kinks for the swell to bend into wriggles
          wave: { a1: 0.15 + r() * 0.4, f1: 0.05 + r() * 0.07, a2: 0.02 + r() * r() * 0.08, f2: 0.14 + r() * 0.12 },
          jitter: 0.012,
        });
        // how far off the stipe it fans out, per unit up it: its splay at the root, and then some
        cord.fan = Math.tan(a) * 0.5 + (r() - 0.5) * 0.5;
        cord.ed = [(r() - 0.5) * 10, (r() - 0.5) * 10]; // its share of the water round the tuft
        cord.swerves = r() < 0.75 ? 1 + Math.floor(r() * 2) : 0; // how many it may make
        cord.sw = 0;
        p.cords.push(cord);
      }
      // the water round the tuft: eddies about as big as a hand, drifting up through it
      p.eddy = { amp: 0.4 + r() * 0.15, size: 22 + r() * 10, speed: 0.35 + r() * 0.15, rise: 3 + r() * 2 };
    },
    // let go, each cord is a rope carried by the water, no longer a spring bent to a shape:
    // it starts from the shape it grew with, and from then on where it lies is where the
    // water (one water for the whole tuft) has put it, so cords side by side bend together
    // where the water turns, and nothing curls up by itself
    done(p) {
      for (const c of p.cords) Object.assign(c, { limp: true, fold: 0.6, memory: MEMORY, eddy: { ...p.eddy, dx: c.ed[0], dy: c.ed[1] }, buoy: 0.55 + c.buoy, splay: { from: p.spine, w: c.fan, k: SPLAY } });
      // the stipe too: only one cord among the others, it moves as they do
      Object.assign(p.spine, { limp: true, fold: 0.6, eddy: p.eddy, buoy: 1 });
    },
    onSegment(p) {
      const r = p.rand;
      keepUp(p, p.cords, (c, j) => {
        // a swerve: the heading eased off by H over L segments, then (for an S) eased back,
        // never turning more than ~0.3 a segment, so it stays a wide, open curve, not a loop
        if (c.sw > 0) {
          const L = c.swN, m = L - c.sw, f = c.swS ? (x) => Math.sin(PI * x) ** 2 : (x) => sstep(0, 1, x);
          c.rest[j] += c.swH * (f((m + 1) / L) - f(m / L));
          c.sw--;
          return;
        }
        if (c.swerves > 0 && j > 12 && r() < 0.025) {
          c.swerves--;
          c.swS = r() < 0.65;
          const H = c.swS ? 0.8 + r() * 1.0 : 0.4 + r() * 0.6;
          c.sw = c.swN = Math.ceil(H * (c.swS ? 11 : 7)) + 8 + Math.floor(r() * 8);
          c.swH = (r() < 0.5 ? -1 : 1) * H;
        }
      });
    },
  },

  // knotted wrack: the stroke one cord, swelling every so often into an egg-shaped bladder
  // and narrowing back past it; just past its bladders (never down by the holdfast) it
  // forks, fronds going off to run up beside it, swelling and forking the same way in turn,
  // short shoots tipped with yellow pods standing off it here and there
  wrack: {
    label: 'knotted wrack',
    seg: 0.45,
    spine: (p) => {
      const r = p.rand;
      // straw-gold … dark olive, or a greener olive
      p.palette = r() < 0.65 ? ['#d0ae3a', '#3a3410'] : ['#b4a43c', '#2e3212'];
      p.podC = ['#e8c840', '#b89428'];
      p.strapW = 0.3 + r() * 0.06;
      p.pods = 0.5 + r() * 0.3;
      p.spots = r() < 0.4 ? 0.03 + r() * 0.06 : 0;
      p.swells = [];
      p.nextB = 12 + Math.floor(r() * 8);
      const o = wrackOpts(p, p.strapW * 1.25, p.swells, Math.min(1, p.hue * 1.1), p.time, 1e-3);
      o.width = cord(p.strapW * 1.25, p.swells, 5, 9);
      return { ...o, tame: 2, buoy: 0.5, drag: 0.9, bend: 2.6, undulate: { amp: 0.012, freq: 0.12, speed: 0.6 } };
    },
    init(p) { holdfast(p, p.time, 6, 0.8); },
    onSegment(p, i, t) {
      const r = p.rand;
      // a bladder starting here, filling out as the stroke goes on through it
      if (i === p.nextB) {
        const h = 3.2 + r() * 1.3;
        p.swells.push({ c: i + h, h, r: p.strapW * 1.2 * (2.1 + r() * 0.5) });
        p.forkAt = i + Math.round(2 * h) + 1;
        p.nextB = p.forkAt + 7 + Math.floor(r() * 8);
      }
      if (i === p.forkAt) {
        // a frond, sometimes one each way
        for (let k = r() < 0.35 ? 2 : 1; k > 0; k--) {
          p.side = -(p.side || 1);
          frond(p, p.spine, i, p.side * (0.3 + r() * 0.35), 50 + Math.floor(r() * 60), 2, t);
        }
        if (r() < p.pods) receptacle(p, p.spine, i + 1, -(p.side || 1), t + 0.2);
      }
    },
  },
};

export const STYLE_KEYS = Object.keys(STYLES);
