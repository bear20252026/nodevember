// A kelp plant: a stipe (the stroke drawn) and the strands hung on it (blades, fingers,
// holdfast roots), each a chain of segments in the plane of the plant, facing the camera.
// Every segment bends about its joint by an angle δ that a spring pulls back to the shape
// it was drawn or grown with, while buoyancy lifts the chain and the current (and the
// wake of the pointer) drags it: the load beyond each joint turns it, so the waves run up
// the stipe and whip out along the blades. Blades twist out of the plane and ruffle, so
// they catch the light. Once let go, the stipe twists slowly about its own axis, carrying
// what hangs on it (and its branches) in and out of the plane.
//
// The plant works in its own units: 1 = 1% of the screen's height at its depth, origin at
// its root, so its local coordinates are also screen coordinates (the camera looks
// straight along -z), and the mesh is scaled by U (world per unit) and set at the root.
import * as THREE from 'three';
import { createLitMaterial } from './water.js';

const PI = Math.PI;
const K = 5.5, C = 3.2; // the joints' spring and damping
// how far a joint gives under its load (the stipe a little softer than its kind says); a
// joint stiffens as it bends further (STIFFEN), up to LIMIT
const FLEX_SPINE = 1.15, FLEX = 1, STIFFEN = 1.4, LIMIT = 1.6;
// a stipe (taper) is stiff at its base and ever softer up to its tip: how much it gives
// there, from TAPER[0] times at the base to TAPER[1] at the tip (u: 0 at the base, 1 at the
// tip), its joints' springs slackening toward the tip by SLACK so the tip gives more
// without whipping faster
const TAPER = [0.45, 5], TAPER_POW = 1.6, SLACK = 0.45;
const softness = (u) => TAPER[0] + (TAPER[1] - TAPER[0]) * u ** TAPER_POW;
// the stipe's freedom from the stroke drawn: where it rests drifts away from it, taking on
// the bends the water holds it in (CREEP, seconds), slowly wandering by itself (WANDER,
// radians per joint), recalled to the stroke over RECALL seconds, never more than FREE
// radians per joint off it (all of these as much again as it is soft there: the tip is
// freest, the base keeps to the stroke); and only HOLD of its buoyancy is held against, so
// the rest lifts it, straightening it a little
const CREEP = 3, RECALL = 6, WANDER = 0.014, FREE = 0.08, HOLD = 0.5;
const freedom = (u) => 0.2 + 3.4 * u ** 1.6;
// a joint feels the load of all the stipe beyond it as a whole, so a push on its lower
// reaches alone is lost in it: there it also feels the pointer's wake on the stretch just
// beyond it (over about NEAR units), LOCAL times, fading out toward the tip (which bends
// to it well enough as it is), so a stiff base still gives where it is stirred
const LOCAL = 3, NEAR = 8;
const local = (u) => LOCAL * (1 - u) ** 3;
// the water holding the stipe back: swung round by the joints below it, each stretch comes
// round after the one below it, lagTime(u) seconds per unit of its length late (later up
// the stipe), so the delays add up, the stipe bending as a swing runs up it and its tip
// trailing most; while a stretch the pointer's wake pushes itself answers at once (the
// more so the harder it is pushed: TOUCH, the push at which it lags half as much)
const LAG = 0.01, TOUCH = 0.15;
const lagTime = (u) => LAG * (0.3 + 1.4 * u);
const MAX_SEGS = 170;
const TURN = 0.32; // the most the stroke turns from one segment to the next
// torsion: once let go, the stipe slowly twists about its own axis, a wave running up it,
// the base held and the tip turning most (TORSION radians at the tip at most), eased in
// over TOR_EASE seconds after the stroke ends; what hangs on the stipe turns with it
const TORSION = 1.5, TOR_EASE = 3;
// a limp strand (a strap kelp's blade): not jointed springs but a rope, every node of it
// carried by the water round it on its own, so it takes the current's shape, bending
// one way here and the other there; how hard the water pulls a node (LIMP_PULL), how
// thick the water is (LIMP_DAMP: per second, the slowness of it all), how sharply two of its links can fold on each other (LIMP_FOLD, radians), how many
// times a step its links are pulled back to length (LIMP_ITER), and how many links of its
// stalk are held firm as grown (STALK). It is heavy with water: slow to get
// going and slow to stop (a light pull, little damping), and the water it feels lags
// behind the water's motion (LIMP_LAG, seconds) and is tempered past LIMP_CAP (the
// pointer's wake, ten times the surge, only sets it rolling, never thrashing)
const LIMP_PULL = 5, LIMP_DAMP = 1.6, LIMP_FOLD = 0.3, LIMP_STRAIGHT = 0.025, LIMP_ITER = 6, STALK = 2;
const LIMP_LAG = 0.8, LIMP_CAP = 1.4;
// cut loose, a plant rises base first, balancing about its middle: it tips (at most TILT,
// toward the side it leans, or either way if it stands straight) and turns about its middle
// rather than its base (BALANCE: how much). WAKE: the water it rises through, pressing down
// on it as it gathers speed (by how much faster it goes than WAKE_EASE s ago), so its top
// lags behind its base, then catches up; and while it does, the base outrunning the top
// tips it further (WAKE_TURN, rad per unit of wake). Each plant draws its own share of all
// these (±VARY), so no two leave alike. It tips slowly, as something heavy in thick water:
// eased in and out (TIP_RATE: per second, critically damped, so it gathers and loses its
// turn gently rather than snapping round), and never so fast that its far end sweeps more
// than TIP_SPEED units a second (so a long plant turns slower than a short one)
const TILT = 0.28, BALANCE = 0.75, WAKE = 0.07, WAKE_EASE = 1.2, WAKE_TURN = 0.6, VARY = 0.35;
const TIP_RATE = 0.9, TIP_SPEED = 6;
// cut loose, the holdfast lets go of the sand: over LOOSEN s its roots stop clawing (their
// curl eased to UNCURL of what it was) and gather under the stipe's base, turning with it,
// splayed only GATHER of how wide they gripped, so they trail below it as a loose tuft
const LOOSEN = 1.4, UNCURL = 0.25, GATHER = 0.3;
const ALIGN = 0.62, ALIGN_SEGS = 10; // how much a branch's base follows its host's stipe, over how many segments

// a plant's look (its shade, palette, blade width, spots: what makes it unlike others of its
// kind) is drawn from its own seed, so a branch, given its host's, looks like its host
function rngOf(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the water swirling on the scale of a plant: a stream function of a few waves crossing
// at odd angles (size: their wavelength, units), its curl the flow (so it neither gathers
// nor spreads, only turns), eddies drifting up by rise (units per second) and slowly
// reshaping (speed); world coordinates, so plants side by side share it
const EDDY = [[0.3, 1, 0.0], [2.2, 0.73, 1.9], [4.1, 1.37, 4.2], [1.2, 1.9, 2.7]]; // angle, scale, phase
function eddyAt(x, y, t, e, out) {
  let u = 0, v = 0;
  const y1 = y - e.rise * t;
  for (let k = 0; k < EDDY.length; k++) {
    const [th, m, ph] = EDDY[k], kk = (2 * Math.PI * m) / e.size, c = Math.cos(th), s = Math.sin(th);
    const a = Math.cos(kk * (c * x + s * y1) + ph + t * e.speed * (0.6 + 0.3 * k)) / m;
    u += a * s; v -= a * c;
  }
  out.x = e.amp * u; out.y = e.amp * v;
}

export class Strand {
  // o: seg (length of a segment), segs (count, for grown strands), curl (rest turn per
  // segment), wobble, width(i, n) half-width at node i of n, round, ruffle {amp, freq,
  // speed, irr (0…1: how uneven its waves are along it), margin (0…1: the frill on the
  // margins alone, from that far out from the midline, each margin its own), rock (radians: how far its
  // waves rock about where they lie with the swell; with speed 0 they stay put on the
  // blade rather than running along it), cup (how far, in half-widths, its margins are
  // pushed over to one face as it flutters)}, color, buoy, drag, bend (radians per 100 units under a unit side load),
  // flex (bend scaled by it: FLEX, FLEX_SPINE for a stipe), twist, twistRate, flutter,
  // cols, parent, at (node, -1 the tip), rootAngle, abs, born,
  // grow (seconds to unfurl), side (offset off the parent's edge, in its half-widths);
  // the tissue, for the shader: bump (how blistered and wrinkled), spots (the white specks
  // of epiphytes), teeth (spines along the margins, 0…1), tatter (a worn, torn tip),
  // dents (0…1: how many small bites are taken out of its margins, here and there);
  // undulate {amp, freq, speed, tip}: a wave running along the strand by itself, tip
  // times as strong again at its tip (growing along it, so it whips out toward the end);
  // follow (0…1): it takes on its parent's shape joint for joint from where it is rooted
  // (the parent's rest turns fully, so it keeps to the stroke as drawn) and this much of
  // how the parent bends and waves beyond them, so it sways along with it; followFade
  // (0…1): how much less of that sway it takes on at its tip than at its root, so its
  // outer reach answers the water by itself, a little behind; supple: how much softer its
  // joints are toward the tip (the gain there 1 + supple times its usual), so it gives along
  // its length like a cord rather than swinging as a rod;
  // hook {amt, k, pow}: its last k joints turned over (amt at the very tip, easing in
  // toward it by pow), carried along with the tip as the strand grows, so a growing tip is
  // already hooked rather than curling over once it is done;
  // orbit {phi, amp, freq, ph}: a strand running alongside its parent (a companion) is
  // turned about the parent's axis where it lies alongside, out of the plane: by phi,
  // wandering about it by amp (radians) along its length (freq: per unit) and slowly in
  // time, and with the parent's torsion there, so a bundle of them fills the space round
  // the stipe rather than a flat fan, and twists with it
  // gust {amp, speed, push}: how hard the current takes it swells and eases in its own time
  // (drag times 1 ± amp), and an eddy of its own sets it to and fro across (push, as a
  // current), so strands of a kind side by side are not pushed as one
  // roll: how far it is turned out of its parent's plane, about the parent's axis where it
  // is rooted (radians), so branches stand off all round their parent, not in one fan
  // flap: how fast it flaps where the water is churned (radians per second)
  // curb: a strand of short segments stiffens by how sharply it curves, not by how far each
  // joint turns (STIFFEN and LIMIT as for a segment curb units long), so cut fine it does
  // not curl up any further than a coarser one would
  // tame: the pointer's wake it feels tempered past this (the surge left as it is), so a
  // soft, rope-like strand rolls with the stirred water rather than thrashing in it
  // limp: a rope rather than springs (LIMP_*): every node carried by the water round it,
  // its shape only faintly held (its undulate then a wave of sideways push running out
  // along it, amp as a current); fold: how sharply two of its links may fold (radians,
  // LIMP_FOLD by default); memory (0…1): how firmly it keeps the bends it had as it went
  // limp, each joint eased back toward its turn then (so a cord carried by the water stays
  // as wavy as it grew rather than pulled straight); eddy {amp, size, speed, rise, dx, dy}: the water swirling
  // round it on the scale of the plant (eddyAt), the same water for every strand in it, so
  // strands side by side are bent together where it turns, like hair in a current (dx, dy:
  // where it feels it from, a little off where it is, so each takes its own share of it);
  // splay {from, w, k}: a limp strand rooted with others (from: the strand it is rooted
  // beside) keeps a little apart from it, drawn toward lying w units off to its side per
  // unit up it (k: how hard, as a current), so a tuft of them fans out like hair rather
  // than gathering into one lock where the water takes it
  // rows: how many rows of the mesh each segment is drawn with (the strand a smooth curve
  // through its nodes between them), so a broad blade's frilled margin waves smoothly
  // rather than in a few straight facets (not for a strand with an orbit)
  constructor(o, rand) {
    Object.assign(this, {
      width: () => 0.5, round: false, ruffle: null, buoy: 0.5, drag: 1, bend: 2,
      twist: 0, twistRate: 0, flutter: 0, cols: 5, parent: null, at: 0, rootAngle: 0,
      abs: false, ahead: 0, roll: 0, hook: null, orbit: null, follow: 0, followFade: 0, supple: 0, gust: null, limp: false, fold: LIMP_FOLD, eddy: null, splay: null, memory: 0, flap: 6.5, curb: 0, tame: 0, flex: FLEX, free: false, taper: false, born: -1e9, grow: 0.8, side: 0, phase: rand() * 100,
      bump: 0, spots: 0, teeth: 0, tatter: 0, dents: 0, undulate: null, seed: rand(), agit: 0, rows: 1,
    }, o);
    this.rows = this.orbit ? 1 : Math.max(1, Math.round(this.rows));
    // a round strand is a tube: its columns run all the way round it (cols on each half),
    // so it keeps its girth however it turns (a flat ribbon would go edge-on as it twists)
    if (this.round) this.cols = 2 * this.cols - 1;
    this.rest = []; this.len = [];
    this.d = []; this.w = []; this.pre = []; this.o = []; // o: how far its rest has drifted off the shape drawn
    this.e = []; this.free_ = []; // how far each joint lags behind the stretch below it; how free it is to (not pushed itself)
    this.px = [0]; this.py = [0]; this.ang = []; this.s = [0];
    this.ca = []; this.sa = []; // the segments' directions (cos, sin of ang), as laid out
    this.tor = [0]; // the torsion at each node, about the strand's own axis (the stipe's only)
    this.M = new Float64Array(12); // where the strand is turned to: [3x3 rotation | offset], set in write
    this.bulbs = []; // { node, r, elong, shift, pear, color }
    if (o.segs) {
      for (let i = 0; i < o.segs; i++) {
        const rel = i === 0 ? 0 : (o.curl || 0) + (rand() - 0.5) * (o.wobble || 0);
        this.add(rel, o.seg);
      }
    }
  }
  get n() { return this.len.length; }
  // its half-widths at each node, as long as it is now (kept until it grows)
  widths() {
    const n = this.n;
    if (this.wn !== n) {
      this.wn = n;
      this.wc = new Float32Array(n + 1);
      for (let i = 0; i <= n; i++) this.wc[i] = this.width(i, n);
    }
    return this.wc;
  }
  add(rel, len) {
    this.rest.push(rel); this.len.push(len);
    this.d.push(0); this.w.push(0); this.e.push(0); this.free_.push(1); this.pre.push(0); this.o.push(0);
    this.px.push(0); this.py.push(0); this.ang.push(0); this.s.push(0); this.ca.push(1); this.sa.push(0); this.tor.push(0);
  }
  growth(t) {
    const g = Math.min(1, Math.max(0, (t - this.born) / this.grow));
    return 1 - (1 - g) ** 3;
  }
  // the chain's nodes from its root, its joints bent by δ
  layout(x, y, a0, g, t = 0) {
    if (this.limp) return this.rope(x, y, a0, g, t);
    let x0 = x, y0 = y, a = a0, s = 0;
    this.px[0] = x; this.py[0] = y; this.s[0] = 0;
    const un = this.undulate;
    const fp = this.follow && this.parent, f0 = fp ? (this.at < 0 ? fp.n : this.at) : 0;
    const hk = this.hook, hn = hk ? Math.min(hk.k, this.n >> 1) : 0, h0 = this.n - hn;
    for (let i = 0; i < this.n; i++) {
      a += (i === 0 ? 0 : this.rest[i]) + this.o[i] + this.d[i] + this.e[i];
      if (hn && i > h0) a += hk.amt * ((i - h0) / hn) ** hk.pow;
      if (fp && i) {
        const k = f0 + i; // the parent's joint alongside: its rest turn, and how far it turns beyond it
        if (k < fp.n) a += fp.rest[k] + this.follow * (1 - this.followFade * i / this.n) * (fp.ang[k] - fp.ang[k - 1] - fp.rest[k]);
      }
      if (un && i) a += un.amp * Math.min(1, i / 4) * (1 + (un.tip || 0) * i / this.n) * Math.sin(i * un.freq - t * un.speed + this.phase);
      const L = this.len[i] * g;
      const ca = Math.cos(a), sa = Math.sin(a);
      x0 += ca * L; y0 += sa * L; s += L;
      this.ang[i] = a; this.ca[i] = ca; this.sa[i] = sa;
      this.px[i + 1] = x0; this.py[i + 1] = y0; this.s[i + 1] = s;
    }
  }
  // the torque on each joint from its buoyancy alone, as it lies now (d = 0, the shape
  // drawn): held against it, that shape is where the strand comes to rest in still water,
  // however soft its joints, and the current and the pointer bend it from there
  settle() {
    const n = this.n;
    let Sx = 0, Sy = 0, Sc = 0, Ss = 0, cnt = 0;
    const total = this.s[n] || 1;
    for (let j = n; j >= 1; j--) {
      const fy = this.buoy * this.len[j - 1];
      Sy += fy; Sc += this.px[j] * fy; Ss += this.s[j]; cnt++;
      const i = j - 1;
      const lever = Ss - cnt * this.s[i];
      const tau = (Sc - this.px[i] * Sy) / (lever + 1e-6) / (this.len[i] || 1);
      this.pre[i] = HOLD * this.gainOf(i, total) * tau;
    }
  }
  gainOf(i, total) {
    const u = this.s[i] / total;
    return (this.bend * this.flex * K * this.len[i] / 100) * (this.taper ? softness(u) : (0.55 + 0.9 * u) * (1 + this.supple * u * u));
  }
  // the joints turned by the load beyond them (pre: how much of the rest torque is held)
  step(dt, flow, so, t, gain, rootK, pre = 0) {
    const n = this.n;
    if (!n || gain <= 0) return;
    if (this.limp) return this.ropeStep(dt, flow, so, t, gain);
    let Sx = 0, Sy = 0, Sc = 0, Ss = 0, cnt = 0;
    const total = this.s[n] || 1;
    const fo = step.f;
    const gu = this.gust, drag = gu ? this.drag * (1 + gu.amp * (0.7 * Math.sin(t * gu.speed + this.phase) + 0.3 * Math.sin(t * gu.speed * 2.3 + this.phase * 1.9))) : this.drag;
    const own = gu?.push ? gu.push * Math.sin(t * gu.speed * 0.83 + this.phase * 2.7) : 0;
    let churn = 0, near = 0, nearW = 0;
    for (let j = n; j >= 1; j--) {
      fo.stir = 0; fo.wx = 0; fo.wy = 0;
      flow(so.x + this.px[j], so.y + this.py[j], t, fo);
      if (fo.stir > churn) churn = fo.stir;
      if (this.tame) {
        // the wake taken off and put back tempered
        const m = Math.hypot(fo.wx, fo.wy), c = 1 / Math.sqrt(1 + (m / this.tame) ** 2) - 1;
        fo.x += fo.wx * c; fo.y += fo.wy * c; fo.wx *= 1 + c; fo.wy *= 1 + c;
      }
      if (this.taper) {
        // the wake across the stretch just beyond joint j - 1, the nearest most
        const keep = Math.exp(-this.len[j - 1] / NEAR);
        near = near * keep + this.drag * (this.ca[j - 1] * fo.wy - this.sa[j - 1] * fo.wx);
        nearW = nearW * keep + 1;
      }
      const wgt = this.len[j - 1];
      const fx = (drag * (fo.x + own)) * wgt, fy = (this.buoy + drag * fo.y) * wgt;
      Sx += fx; Sy += fy; Sc += this.px[j] * fy - this.py[j] * fx;
      Ss += this.s[j]; cnt++;
      const i = j - 1; // the joint at node i turns segment i and all beyond
      const lever = Ss - cnt * this.s[i];
      let tau = (Sc - (this.px[i] * Sy - this.py[i] * Sx)) / (lever + 1e-6) / (this.len[i] || 1);
      if (this.taper) tau += local(this.s[i] / total) * near / nearW;
      const k = i === 0 && rootK !== undefined ? rootK : this.taper ? K * (1 - SLACK * this.s[i] / total) : K;
      const G = this.gainOf(i, total) * gain;
      const d = this.d[i];
      if (this.taper) this.free_[i] = 1 / (1 + Math.abs(near / nearW) / TOUCH);
      const cr = this.curb ? this.curb / (this.len[i] || 1) : 1, lim = LIMIT / cr;
      this.w[i] += dt * (G * tau - pre * gain * this.pre[i] - k * d * (1 + STIFFEN * cr * cr * d * d) - C * this.w[i]);
      this.d[i] += dt * this.w[i];
      if (this.d[i] > lim) { this.d[i] = lim; this.w[i] = Math.min(0, this.w[i]); }
      else if (this.d[i] < -lim) { this.d[i] = -lim; this.w[i] = Math.max(0, this.w[i]); }
    }
    if (this.taper) this.trail(dt * gain, total);
    // how churned the water round it is: quick to rise, slow to calm (the blades flap)
    const want = Math.min(1.2, churn / 12);
    this.agit += (want - this.agit) * Math.min(1, dt * (want > this.agit ? 6 : 1.1));
    if (this.free) this.drift(dt * gain, t);
  }
  // each stretch coming round late after the one below it: it holds against the turn the
  // stretch below makes (its own joints and lag), letting it go over its lag time
  // (backward Euler, so the delay holds whatever the frame rate); from the base up, so
  // each sees the stretch below as it is this step
  trail(dt, total) {
    const n = this.n;
    let spin = 0; // how fast the stretch below turns, lag and all
    for (let i = 0; i < n; i++) {
      const free = this.free_[i];
      const lt = free * lagTime(this.s[i] / total) * this.len[i];
      const was = this.e[i];
      if (dt > 0) this.e[i] = (was - free * spin * dt) * (lt / (lt + dt));
      spin += this.w[i] + (dt > 0 ? (this.e[i] - was) / dt : 0);
    }
  }
  // a limp strand's nodes as they lie, its root held where it is attached (the first
  // time, laid out as grown)
  rope(x, y, a0, g, t) {
    const n = this.n;
    if (!this.qx || this.qx.length !== n + 1) {
      this.limp = false; this.layout(x, y, a0, g, t); this.limp = true;
      this.qx = Float64Array.from(this.px); this.qy = Float64Array.from(this.py);
      this.ox = Float64Array.from(this.px); this.oy = Float64Array.from(this.py);
      // the turns it has as it goes limp (no sharper than it may fold): the bends it keeps
      this.mem = new Float64Array(n);
      for (let i = 1; i < n; i++) {
        const d = Math.atan2(Math.sin(this.ang[i] - this.ang[i - 1]), Math.cos(this.ang[i] - this.ang[i - 1]));
        this.mem[i] = Math.max(-0.85 * this.fold, Math.min(0.85 * this.fold, d));
      }
    }
    this.ra = a0; this.rg = g;
    // unfurling, it keeps the shape it grows with, and only once grown is it limp
    if (g < 1) {
      this.limp = false; this.layout(x, y, a0, g, t); this.limp = true;
      this.qx.set(this.px); this.qy.set(this.py); this.ox.set(this.px); this.oy.set(this.py);
      return;
    }
    const qx = this.qx, qy = this.qy;
    this.ox[0] = qx[0] = x; this.oy[0] = qy[0] = y;
    this.px[0] = x; this.py[0] = y; this.s[0] = 0;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const dx = qx[i + 1] - qx[i], dy = qy[i + 1] - qy[i];
      const l = Math.hypot(dx, dy) || 1e-6;
      this.ca[i] = dx / l; this.sa[i] = dy / l; this.ang[i] = Math.atan2(dy, dx);
      s += this.len[i] * g;
      this.px[i + 1] = qx[i + 1]; this.py[i + 1] = qy[i + 1]; this.s[i + 1] = s;
    }
  }
  // the rope carried by the water: each node pulled toward moving with the water round it
  // and lifted by its buoyancy, slowed by the water's thickness, then the rope's links
  // kept their length from the root out, each joint eased back toward the shape it grew
  // with, faintly (the stalk firmly), and never folded beyond LIMP_FOLD
  ropeStep(dt, flow, so, t, gain) {
    const n = this.n, qx = this.qx, qy = this.qy, ox = this.ox, oy = this.oy;
    if (!qx) return;
    const fo = step.f, gu = this.gust, un = this.undulate;
    const drag = gu ? this.drag * (1 + gu.amp * (0.7 * Math.sin(t * gu.speed + this.phase) + 0.3 * Math.sin(t * gu.speed * 2.3 + this.phase * 1.9))) : this.drag;
    const own = gu?.push ? gu.push * Math.sin(t * gu.speed * 0.83 + this.phase * 2.7) : 0;
    const ax = step.ax ??= [], ay = step.ay ??= [];
    if (!this.wx || this.wx.length !== n + 1) { this.wx = new Float64Array(n + 1); this.wy = new Float64Array(n + 1); }
    const wx = this.wx, wy = this.wy;
    let churn = 0;
    for (let j = 1; j <= n; j++) {
      fo.stir = 0;
      flow(so.x + qx[j], so.y + qy[j], t, fo);
      if (fo.stir > churn) churn = fo.stir;
      // the water it feels: tempered, and catching up with the water's motion only slowly
      const m = Math.hypot(fo.x, fo.y), cap = 1 / Math.sqrt(1 + (m / LIMP_CAP) ** 2);
      const lag = Math.min(1, dt / LIMP_LAG);
      wx[j] += (fo.x * cap - wx[j]) * lag; wy[j] += (fo.y * cap - wy[j]) * lag;
      let fx = drag * (wx[j] + own), fy = this.buoy + drag * wy[j];
      if (this.eddy) {
        eddyAt(so.x + qx[j] + (this.eddy.dx || 0), so.y + qy[j] + (this.eddy.dy || 0), t, this.eddy, fo);
        fx += drag * fo.x; fy += drag * fo.y;
      }
      const sp = this.splay, f = sp?.from;
      if (f?.qx && f.n) {
        // where it would lie, off to the side of the strand it is rooted beside (beyond that
        // strand's end, carried on along its last link)
        const m = Math.min(j, f.n), ex = f.qx[m] - f.qx[m - 1], ey = f.qy[m] - f.qy[m - 1];
        const el = Math.hypot(ex, ey) || 1, over = j - m, s = (f.s[m] || m) + over;
        const tx = f.qx[m] + (ex / el) * over - (ey / el) * sp.w * s, ty = f.qy[m] + (ey / el) * over + (ex / el) * sp.w * s;
        // a pull across, gentle, never more than a slow current
        const dx = tx - qx[j], dy = ty - qy[j], d = Math.hypot(dx, dy), c = sp.k / (1 + d / 6);
        fx += dx * c * 0.15; fy += dy * c * 0.15;
      }
      if (un && !this.memory) {
        // a wave of sideways push, running out along it
        const w = un.amp * Math.min(1, j / 4) * Math.sin(j * un.freq - t * un.speed + this.phase);
        fx += -this.sa[j - 1] * w; fy += this.ca[j - 1] * w;
      }
      ax[j] = fx * LIMP_PULL * gain; ay[j] = fy * LIMP_PULL * gain;
    }
    const sub = Math.max(1, Math.ceil(dt * 90)), h = dt / sub, keep = Math.exp(-LIMP_DAMP * h);
    const g = this.rg, S = Math.min(STALK, n), mem = this.mem ? this.memory : 0;
    for (let k = 0; k < sub; k++) {
      // its stalk held as it grew, off its root
      let a = this.ra;
      for (let i = 0; i < S; i++) {
        if (i) a += this.rest[i];
        const L = this.len[i] * g;
        ox[i + 1] = qx[i + 1]; oy[i + 1] = qy[i + 1];
        qx[i + 1] = qx[i] + Math.cos(a) * L; qy[i + 1] = qy[i] + Math.sin(a) * L;
      }
      // the rest carried by the water, keeping some of its speed
      for (let j = S + 1; j <= n; j++) {
        const vx = (qx[j] - ox[j]) * keep, vy = (qy[j] - oy[j]) * keep;
        ox[j] = qx[j]; oy[j] = qy[j];
        qx[j] += vx + ax[j] * h * h; qy[j] += vy + ay[j] * h * h;
      }
      // its bends eased back toward the ones it keeps: from the root out, all of it beyond
      // each joint turned about that joint (and where it was with it, so the bend is set
      // without setting it moving), which changes the turn there and nowhere else
      if (mem) {
        let c = 1, sn = 0, tx = 0, ty = 0; // the turn so far: p -> R p + t
        for (let j = S; j < n; j++) {
          // nodes j and j + 1 as turned so far (j - 1 already is)
          for (const k of j === S ? [j, j + 1] : [j + 1]) {
            let x = qx[k], y = qy[k];
            qx[k] = c * x - sn * y + tx; qy[k] = sn * x + c * y + ty;
            x = ox[k]; y = oy[k];
            ox[k] = c * x - sn * y + tx; oy[k] = sn * x + c * y + ty;
          }
          if (j === 0) continue;
          const ax = qx[j] - qx[j - 1], ay = qy[j] - qy[j - 1], bx = qx[j + 1] - qx[j], by = qy[j + 1] - qy[j];
          // (and its swell running up it, as it did while it grew: the bend it keeps rippling)
          const want = this.mem[j] + (un ? un.amp * Math.min(1, j / 4) * (1 + (un.tip || 0) * j / n) * Math.sin(j * un.freq - t * un.speed + this.phase) : 0);
          const e = (want - Math.atan2(ax * by - ay * bx, ax * bx + ay * by)) * mem;
          const ce = Math.cos(e), se = Math.sin(e), px = qx[j], py = qy[j];
          // node j + 1 turned about node j now, and the rest by the same from here on
          let x = qx[j + 1] - px, y = qy[j + 1] - py;
          qx[j + 1] = px + ce * x - se * y; qy[j + 1] = py + se * x + ce * y;
          x = ox[j + 1] - px; y = oy[j + 1] - py;
          ox[j + 1] = px + ce * x - se * y; oy[j + 1] = py + se * x + ce * y;
          // compose: p -> Re (R p + t - P) + P
          const c2 = ce * c - se * sn, s2 = se * c + ce * sn;
          const tx2 = ce * (tx - px) - se * (ty - py) + px, ty2 = se * (tx - px) + ce * (ty - py) + py;
          c = c2; sn = s2; tx = tx2; ty = ty2;
        }
      }
      // its links kept their length, and no two links folded on each other sharper than
      // LIMP_FOLD (every other node kept at least so far apart), pulled from both ends
      for (let it = 0; it < LIMP_ITER; it++) {
        for (let i = S; i < n; i++) {
          const wa = i <= S ? 0 : 1;
          const dx = qx[i + 1] - qx[i], dy = qy[i + 1] - qy[i], d = Math.hypot(dx, dy) || 1e-6;
          const c = (d - this.len[i] * g) / d / (wa + 1);
          qx[i] += wa * c * dx; qy[i] += wa * c * dy;
          qx[i + 1] -= c * dx; qy[i + 1] -= c * dy;
        }
        for (let i = Math.max(0, S - 1); i < n - 1; i++) {
          const wa = i <= S ? 0 : 1; // (its stalk's nodes held, the rest moved)
          // eased a little toward straight, firmly away from folding sharper than LIMP_FOLD
          const full = (this.len[i] + this.len[i + 1]) * g, min = full * Math.cos(this.fold / 2);
          const dx = qx[i + 2] - qx[i], dy = qy[i + 2] - qy[i], d = Math.hypot(dx, dy) || 1e-6;
          const c = (d < min ? (d - min) * 0.5 : (d - full) * LIMP_STRAIGHT) / d / (wa + 1);
          qx[i] += wa * c * dx; qy[i] += wa * c * dy;
          qx[i + 2] -= c * dx; qy[i + 2] -= c * dy;
        }
      }
    }
    // churned, it only rolls slowly: a little, coming on and dying away gently
    const want = Math.min(0.5, churn / 24);
    this.agit += (want - this.agit) * Math.min(1, dt * (want > this.agit ? 1.2 : 0.5));
  }
  // the rest drifting: a bend held long enough sets in (moved from d to o, the shape as it
  // is), a slow wave of its own runs along it, and the stroke draws it back; smoothed
  // along the stipe so it bends as a whole, not joint by joint
  drift(dt, t) {
    const n = this.n, o = this.o, ph = this.phase, total = this.s[n] || 1;
    for (let i = 0; i < n; i++) {
      const s = this.s[i], fr = freedom(s / total);
      const wander = fr * WANDER * (Math.sin(s * 0.045 - t * 0.09 + ph) + 0.6 * Math.sin(s * 0.11 + t * 0.06 + ph * 1.7));
      const set = this.d[i] * Math.min(1, dt * fr / CREEP);
      o[i] += set; this.d[i] -= set;
      o[i] += (wander - o[i]) * Math.min(1, dt / RECALL);
    }
    for (let i = 1; i < n - 1; i++) o[i] += ((o[i - 1] + o[i + 1]) * 0.5 - o[i]) * Math.min(1, dt * 1.5);
    for (let i = 0; i < n; i++) {
      // the shape kept as it is when the rest is stopped short
      const m = FREE * freedom(this.s[i] / total);
      const c = Math.max(-m, Math.min(m, o[i]));
      this.d[i] += o[i] - c; o[i] = c;
    }
  }
}
const step = { f: { x: 0, y: 0 } };
const tq_ = new THREE.Quaternion(), ax_ = new THREE.Vector3(), mq_ = new THREE.Matrix4(), pr_ = { x: 0, y: 0 };

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0];
// out = P ∘ R, R the turn by th about the axis through (cx, cy, 0) along (ux, uy, 0)
// (matrices row-major 3x3, then the offset)
function turnAbout(out, P, cx, cy, ux, uy, th) {
  const c = Math.cos(th), s = Math.sin(th), k = 1 - c;
  const r00 = c + ux * ux * k, r01 = ux * uy * k, r02 = uy * s;
  const r10 = ux * uy * k, r11 = c + uy * uy * k, r12 = -ux * s;
  const r20 = -uy * s, r21 = ux * s, r22 = c;
  // R's offset: c - R c
  const t0 = cx - (r00 * cx + r01 * cy), t1 = cy - (r10 * cx + r11 * cy), t2 = -(r20 * cx + r21 * cy);
  for (let i = 0; i < 3; i++) {
    const a = P[i * 3], b = P[i * 3 + 1], d = P[i * 3 + 2];
    out[i * 3] = a * r00 + b * r10 + d * r20;
    out[i * 3 + 1] = a * r01 + b * r11 + d * r21;
    out[i * 3 + 2] = a * r02 + b * r12 + d * r22;
    out[9 + i] = a * t0 + b * t1 + d * t2 + P[9 + i];
  }
}

// a unit sphere, the template of the floats
const SPH_LAT = 7, SPH_LON = 10;
const sph = [];
for (let a = 0; a <= SPH_LAT; a++) {
  for (let b = 0; b <= SPH_LON; b++) {
    const th = (a / SPH_LAT) * Math.PI, ph = (b / SPH_LON) * Math.PI * 2;
    sph.push([Math.cos(th), Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph)]);
  }
}
const SPH_V = sph.length;

const material = createLitMaterial();

// the plant's own shade (Plant.shadow): the grid's cells (units, at most SH_MAX a side), how
// much of the light a layer of tissue stops, how far its shade reaches (units), and how
// far the light comes from the left per unit it comes down (as water.js's LIGHT)
const SH_CELL = 2.2, SH_MAX = 48, SH_OPAC = 0.45, SH_RANGE = 12, SH_SLANT = 0.27;
const shD = new Float32Array(SH_MAX * SH_MAX), shA = new Float32Array(SH_MAX * SH_MAX);

// across a strand of k columns: where each is (vv, -1 … 1), the sin and cos of the ruffle's
// lag there (0.9 vv), and, round a tube, the sin and cos of the angle round it (π vv: 0 its
// face, ±π its back)
const colTables = {};
// a strand's direction at node i: between its two segments (into dir_)
const dir_ = { x: 1, y: 0 };
function nodeDir(s, i) {
  const i0 = Math.max(0, i - 1), i1 = Math.min(s.n - 1, i);
  const x = s.ca[i0] + s.ca[i1], y = s.sa[i0] + s.sa[i1];
  const l = Math.sqrt(x * x + y * y) || 1;
  dir_.x = x / l; dir_.y = y / l;
}
function cols(k) {
  if (!colTables[k]) {
    const vv = [], s = [], c = [], rs = [], rc = [];
    for (let j = 0; j < k; j++) {
      const u = (j / (k - 1)) * 2 - 1;
      vv.push(u); s.push(Math.sin(u * 0.9)); c.push(Math.cos(u * 0.9)); rs.push(Math.sin(u * PI)); rc.push(Math.cos(u * PI));
    }
    colTables[k] = { vv, s, c, rs, rc };
  }
  return colTables[k];
}

export class Plant {
  // host: a branch, rooted on another plant's stipe at { i, f } (segment i, f along it),
  // riding it and turning with it (ang0: the host's segment's angle when it branched), and
  // looking like it (it takes on its host's look)
  constructor({ style, origin, U, screen, anchored, rand, time, host = null, at = null }) {
    this.style = style;
    this.host = host;
    this.at = at;
    this.turn = 0;
    this.rand = rand;
    this.U = U;
    this.so = { x: screen.x, y: screen.y }; // the root on screen (units)
    this.anchored = anchored;
    this.drawing = true;
    this.releasedAt = 0;
    this.time = time;
    this.rise = 0; // floating: speed up
    this.driftX = 0;
    this.spin = 0; // the stipe turned at its base (floating: tipping to balance)
    this.spinV = 0; // how fast it is tipping (radians per second)
    this.tilt = null; // floating: the tip it eases to, and its own way of leaving (see TILT)
    this.leave = null;
    this.mid = null; // the stipe's middle (plant units, from its base) as last laid out
    this.riseLate = 0; // floating: its speed a little while ago
    this.wake = 0; // floating: the water pressing down on it as it climbs
    this.outer = null;
    this.wakeFlow = (x, y, t, out) => { this.outer(x, y, t, out); out.y -= this.base.wake; };
    this.strands = [];
    // held (hovered, or what a hovered branch rides): its stipe stands still, its own time
    // (the stipe's) falling behind the plant's by lag, while all it bears goes on moving
    this.hold = 0;
    this.lag = 0;
    this.st = time; // the stipe's time
    this.tip = { x: 0, y: 0 }; // the smoothed pointer the stipe grows toward
    this.pen = { x: 0, y: 0, a: 0 }; // the end of the stroke as drawn (a branch's stipe bends off it near its base)
    this.geometry = new THREE.BufferGeometry();
    this.cap = 0;
    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.position.copy(origin);
    this.mesh.scale.setScalar(U);
    this.mesh.frustumCulled = false;
    this.dirty = true;
    // its look: the stipe (style.spine) is laid out from the look's seed alone, so what it
    // picks there (palette, shade, blade width, spots) is the same for a branch as its host
    this.look = host ? host.look : Math.floor(rand() * 1e9);
    this.rand = rngOf(this.look);
    this.hue = this.rand();
    const spine = style.spine(this);
    this.rand = rand;
    this.torPh = [rand() * 100, rand() * 100]; this.torAmp = 0.7 + 0.6 * rand();
    this.spine = this.addStrand({ flex: FLEX_SPINE, free: true, taper: true, ...spine, born: time });
    // a branch is laid in the plane of the screen as it is drawn, wherever its host's stipe
    // has turned it (by its own host and its torsion): drawnTurn undoes how the host is turned
    // where it is rooted now, so it goes on turning with it from there
    this.drawnTurn = new THREE.Quaternion();
    if (host) { this.follow(); this.drawnTurn.copy(this.mesh.quaternion).invert(); this.mesh.quaternion.identity(); }
    style.init?.(this);
  }

  // where the point (x, y) of the plant (its units) is on screen, off its root (screen units)
  project(x, y, out = { x: 0, y: 0 }) {
    ax_.set(x, y, 0).applyQuaternion(this.mesh.quaternion);
    out.x = ax_.x; out.y = ax_.y;
    return out;
  }

  // the point of the plant's plane that is (dx, dy) off its root on screen (the inverse of
  // project; a plane turned near edge-on is stretched no more than 1/EDGE across)
  unproject(dx, dy, out = { x: 0, y: 0 }) {
    const e = mq_.makeRotationFromQuaternion(this.mesh.quaternion).elements; // column-major
    const a = e[0], b = e[4], c = e[1], d = e[5]; // [a b; c d]: the plane's x, y on screen
    let det = a * d - b * c;
    const EDGE = 0.15;
    if (Math.abs(det) < EDGE) det = det < 0 ? -EDGE : EDGE;
    out.x = (d * dx - b * dy) / det; out.y = (a * dy - c * dx) / det;
    return out;
  }

  addStrand(o) {
    const s = new Strand(o, this.rand);
    this.strands.push(s);
    this.dirty = true;
    return s;
  }

  // the stroke goes on to (x, y) (plant units): the stipe follows it a segment at a time
  extend(x, y) {
    if (!this.drawing) return;
    const sp = this.spine;
    this.tip.x += (x - this.tip.x) * 0.55;
    this.tip.y += (y - this.tip.y) * 0.55;
    if (sp.n === 0) { this.tip.x = x; this.tip.y = y; }
    const seg = this.style.seg;
    for (let k = 0; k < 24 && sp.n < MAX_SEGS; k++) {
      const n = sp.n;
      const pen = this.pen;
      const dx = this.tip.x - pen.x, dy = this.tip.y - pen.y;
      if (dx * dx + dy * dy < seg * seg) break;
      let a = Math.atan2(dy, dx);
      if (n > 0) {
        const turn = Math.atan2(Math.sin(a - pen.a), Math.cos(a - pen.a)), at = Math.abs(turn);
        // the stipe turns at most TURN a segment, on a circle of radius R: a point inside that
        // circle can't be reached by turning, and chasing it would only orbit it, looping the
        // stipe; it waits there instead, until the stroke has gone far enough to turn toward
        if (at > TURN) {
          const R = seg / (2 * Math.sin(TURN / 2));
          const reach = 2 * R * (at > Math.PI / 2 ? 1 : Math.sin(at));
          if (dx * dx + dy * dy < reach * reach) break;
        }
        a = pen.a + Math.max(-TURN, Math.min(TURN, turn));
      }
      pen.x += Math.cos(a) * seg; pen.y += Math.sin(a) * seg; pen.a = a;
      // the stipe as laid: a branch leaves its host's stipe close along it, turning out to
      // the stroke over its first segments (the stroke itself is followed unbent, so the
      // stipe keeps to it, only a little off to the side)
      let b = a;
      if (this.host && n < ALIGN_SEGS) {
        const h = this.at.dir0 ?? this.at.ang0; // the host's stipe there, on screen
        let off = Math.atan2(Math.sin(h - a), Math.cos(h - a));
        if (Math.abs(off) > Math.PI / 2) off = Math.atan2(Math.sin(h + Math.PI - a), Math.cos(h + Math.PI - a)); // drawn down: along it downward
        b += off * ALIGN * (1 - n / ALIGN_SEGS) ** 2;
      }
      const lx = sp.px[n], ly = sp.py[n];
      sp.add(n > 0 ? b - sp.ang[n - 1] : 0, seg);
      if (n === 0) sp.rootAngle = b;
      sp.ang[n] = b;
      sp.px[n + 1] = lx + Math.cos(b) * seg; sp.py[n + 1] = ly + Math.sin(b) * seg;
      sp.s[n + 1] = sp.s[n] + seg;
      this.style.onSegment?.(this, n, this.time);
      this.dirty = true;
    }
  }

  release(time) {
    this.drawing = false;
    this.releasedAt = time;
    this.spine.settle(); // the stipe as drawn (still unbent) is where it rests
    this.style.done?.(this, time);
  }

  detach(time) {
    if (!this.anchored || this.host) return;
    this.anchored = false;
    this.cutTime = time;
    this.releasedAt = Math.min(this.releasedAt, time - 1);
  }

  // a holdfast root's heading at its base (a: as it grips the sand), let go of it: eased
  // round to trail under the stipe's base, nearer together, and less curled
  loosen(s, a, t) {
    const u = Math.min(1, Math.max(0, (t - this.cutTime) / LOOSEN)), k = u * u * (3 - 2 * u);
    if (!s.rest0) s.rest0 = s.rest.slice();
    for (let i = 1; i < s.n; i++) s.rest[i] = s.rest0[i] * (1 - (1 - UNCURL) * k);
    const sp = this.spine;
    const to = (sp.ang[0] ?? sp.rootAngle) - this.spin + Math.PI + (s.rootAngle + Math.PI / 2) * GATHER;
    return a + Math.atan2(Math.sin(to - a), Math.cos(to - a)) * k;
  }

  // the stipe's middle (its nodes weighted by length), from its base (plant units)
  middle() {
    const s = this.spine, n = s.n;
    let x = 0, y = 0, w = 0;
    for (let i = 0; i < n; i++) {
      const l = s.len[i];
      x += (s.px[i] + s.px[i + 1]) * 0.5 * l; y += (s.py[i] + s.py[i + 1]) * 0.5 * l; w += l;
    }
    return w ? { x: x / w, y: y / w } : { x: 0, y: 0 };
  }

  // the rooted plant it all hangs from (itself, or its host's)
  get base() { let p = this; while (p.host) p = p.host; return p; }

  get floating() { return !this.anchored && !this.drawing; }

  // the lowest point on screen, to know when a floating plant has left the view
  get bottom() {
    let m = Infinity;
    for (const s of this.strands) for (let i = 0; i <= s.n; i++) m = Math.min(m, s.py[i]);
    return this.so.y + m;
  }

  // where on the host's stipe a branch is rooted (host units), and how the host has turned there
  follow() {
    const h = this.host, hs = h.spine, i = Math.min(this.at.i, hs.n - 1), f = this.at.f;
    const x = hs.px[i] + (hs.px[i + 1] - hs.px[i]) * f, y = hs.py[i] + (hs.py[i + 1] - hs.py[i]) * f;
    const o = h.project(x, y, pr_);
    this.so.x = h.so.x + o.x; this.so.y = h.so.y + o.y;
    this.mesh.position.copy(ax_.set(x * h.U, y * h.U, 0).applyQuaternion(h.mesh.quaternion)).add(h.mesh.position);
    this.turn = hs.ang[i] - this.at.ang0;
    // and turned with the host's stipe about its axis, as twisted there (from how it was
    // turned when the branch was drawn: drawnTurn)
    const tq = hs.tor[i] + (hs.tor[i + 1] - hs.tor[i]) * f, a = hs.ang[i];
    this.mesh.quaternion.copy(h.mesh.quaternion).multiply(tq_.setFromAxisAngle(ax_.set(Math.cos(a), Math.sin(a), 0), tq));
    if (this.drawnTurn) this.mesh.quaternion.multiply(this.drawnTurn);
  }

  // the stipe's torsion now: none while drawn, eased in after; a slow wave up the stipe
  twist(t) {
    const sp = this.spine, n = sp.n, total = sp.s[n] || 1;
    const e = this.drawing ? 0 : Math.min(1, Math.max(0, (t - this.releasedAt - 0.4) / TOR_EASE));
    const g = e * e * (3 - 2 * e) * TORSION * this.torAmp, [p0, p1] = this.torPh;
    for (let i = 0; i <= n; i++) {
      const s = sp.s[i], u = s / total;
      sp.tor[i] = g === 0 ? 0 : g * u ** 0.8 * (0.75 * Math.sin(t * 0.55 - s * 0.03 + p0) + 0.35 * Math.sin(t * 0.71 + s * 0.05 + p1));
    }
  }

  update(dt, t, flow) {
    this.time = t;
    const sp = this.spine;
    // the stipe's own time and step, slowed to a stop as it is held
    this.lag += dt * this.hold;
    const st = this.st = t - this.lag, sdt = dt * (1 - this.hold);
    if (this.host) this.follow();
    if (this.floating) {
      const age = t - this.releasedAt;
      // a slow start, then gathering speed as it climbs, so it doesn't linger on screen
      const want = 7 + 4 * this.hue + 2.5 * Math.max(0, age - 1);
      this.rise += (want * Math.min(1, Math.max(0, age - 0.25)) - this.rise) * Math.min(1, dt * 0.8);
      // its own way of leaving, and its tip toward the side its middle lies from its base
      if (this.tilt === null) {
        const v = () => 1 + (Math.random() * 2 - 1) * VARY;
        const m = this.middle(), r = Math.hypot(m.x, m.y) || 1;
        const lean = Math.max(-1, Math.min(1, (2.5 * m.x) / r));
        const side = Math.abs(lean) > 0.15 ? Math.sign(lean) : Math.random() < 0.5 ? -1 : 1;
        this.tilt = -side * TILT * Math.max(Math.abs(lean), 0.3 + 0.4 * Math.random()) * v();
        this.leave = { side: -side, wake: WAKE * v(), ease: WAKE_EASE * v(), turn: WAKE_TURN * v(), balance: Math.min(0.95, BALANCE * v()), rate: TIP_RATE * v() };
      }
      const L = this.leave;
      this.riseLate += (this.rise - this.riseLate) * Math.min(1, dt / L.ease);
      this.wake = L.wake * Math.max(0, this.rise - this.riseLate);
      const fo = step.f;
      flow(this.so.x, this.so.y, t, fo);
      this.driftX += (fo.x * 2.5 - this.driftX) * Math.min(1, dt * 0.5);
      this.so.x += this.driftX * dt;
      this.so.y += this.rise * dt;
      this.mesh.position.x += this.driftX * dt * this.U;
      this.mesh.position.y += this.rise * dt * this.U;
      // tipping over a little, the more while its base outruns its top
      const to = this.tilt + L.side * L.turn * this.wake;
      const w = L.rate * Math.min(1, age), h = Math.min(dt, 0.05);
      this.spinV += (w * w * (to - this.spin) - 2 * w * this.spinV) * h;
      const vmax = TIP_SPEED / Math.max(10, sp.s[sp.n] || 0);
      this.spinV = Math.max(-vmax, Math.min(vmax, this.spinV));
      this.spin += this.spinV * h;
    }
    // the stipe: still while drawn, eased into the current after
    const gain = this.drawing ? 0 : Math.min(1, (t - this.releasedAt) / 1.5);
    // and so are the strands that follow it (they would otherwise thrash beside a still stipe)
    if (this.drawing) {
      for (const s of this.strands) if (s === sp || s.follow) for (let i = 0; i < s.n; i++) { s.d[i] = 0; s.w[i] = 0; }
    }
    if (this.base.floating && this.base.wake > 0) { this.outer = flow; flow = this.wakeFlow; }
    for (const s of this.strands) {
      let x = 0, y = 0, a = s.rootAngle;
      if (s.parent) {
        const p = s.parent;
        const node = s.at < 0 ? p.n : Math.min(s.at, p.n);
        const pa = p.ang[Math.max(0, Math.min(node, p.n - 1))] ?? p.rootAngle;
        x = p.px[node]; y = p.py[node];
        const pg = p.growth(p === sp ? st : t);
        if (s.side) {
          const hw = p.widths()[node] * pg;
          x += -Math.sin(pa) * hw * s.side; y += Math.cos(pa) * hw * s.side;
        }
        if (s.ahead) { x += Math.cos(pa) * s.ahead * pg; y += Math.sin(pa) * s.ahead * pg; }
        a = s.abs ? s.rootAngle : pa + s.rootAngle;
        if (s.holdfast && this.cutTime != null) a = this.loosen(s, a, t);
      }
      a += this.spin;
      if (s === sp) a += this.turn;
      const isSpine = s === sp, ts = isSpine ? st : t;
      s.layout(x, y, a, s.growth(ts), ts);
      s.step(isSpine ? sdt : dt, flow, this.so, ts, isSpine || s.follow ? gain : 1, isSpine && !this.anchored ? 0.25 : undefined, isSpine && this.anchored ? 1 : 0);
    }
    // floating, it turns about its middle: as the stipe swings, the base moves (up) instead
    const mid = this.middle();
    if (this.floating && this.mid) {
      const b = this.leave?.balance ?? BALANCE;
      const dx = (this.mid.x - mid.x) * b, dy = (this.mid.y - mid.y) * b;
      this.so.x += dx; this.so.y += dy;
      this.mesh.position.x += dx * this.U; this.mesh.position.y += dy * this.U;
    }
    this.mid = mid;
    this.twist(st);
    if (this.dirty) this.rebuild();
    this.write(t);
  }

  // ---- geometry: the counts and the static attributes, when the plant has grown
  rebuild() {
    this.dirty = false;
    let nv = 0, ni = 0;
    for (const s of this.strands) {
      if (s.n < 1) continue;
      nv += (s.n * s.rows + 1) * s.cols; ni += s.n * s.rows * (s.cols - 1) * 6;
      nv += s.bulbs.length * SPH_V; ni += s.bulbs.length * SPH_LAT * SPH_LON * 6;
    }
    if (!nv) return; // nothing grown yet (a branch with no holdfast, not yet drawn)
    if (nv > this.cap) {
      this.cap = Math.ceil(nv * 1.6) + 256;
      const g = this.geometry;
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.cap * 3), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.cap * 2), 2));
      g.setAttribute('aInfo', new THREE.BufferAttribute(new Float32Array(this.cap * 4), 4));
      g.setAttribute('aEdge', new THREE.BufferAttribute(new Float32Array(this.cap * 3), 3));
      g.setAttribute('aOcc', new THREE.BufferAttribute(new Float32Array(this.cap), 1).setUsage(THREE.DynamicDrawUsage));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(Math.ceil(this.cap * 6.2)), 1));
    }
    const g = this.geometry;
    const col = g.attributes.color.array, uv = g.attributes.uv.array, idx = g.index.array;
    const inf = g.attributes.aInfo.array, edg = g.attributes.aEdge.array;
    let v = 0, k = 0;
    for (const s of this.strands) {
      if (s.n < 1) continue;
      const c = s.color;
      let sl = s.seed * 97; // the arc length along the tissue, offset so no two strands match
      const R = s.rows, rn = s.n * R, W = s.widths();
      for (let row = 0; row <= rn; row++) {
        // the row's place between its nodes i and i + 1 (f: 0 … 1)
        const i = Math.floor(row / R), f = row / R - i, i1 = Math.min(i + 1, s.n);
        const u = row / rn;
        const hw = W[i] + (W[i1] - W[i]) * f;
        for (let j = 0; j < s.cols; j++) {
          const vv = (j / (s.cols - 1)) * 2 - 1;
          const shade = 1 + (s.vary ? s.vary(i, j) + (f ? (s.vary(i1, j) - s.vary(i, j)) * f : 0) : 0);
          col[v * 3] = c.r * shade; col[v * 3 + 1] = c.g * shade; col[v * 3 + 2] = c.b * shade;
          // round a tube: v how far toward its sides (as seen face on), the tissue's across
          // coordinate the way round it
          uv[v * 2] = u; uv[v * 2 + 1] = s.round ? Math.sin(vv * PI) * 0.6 : vv;
          inf[v * 4] = sl; inf[v * 4 + 1] = s.round ? vv * hw * 0.5 * PI : vv * hw; inf[v * 4 + 2] = s.bump; inf[v * 4 + 3] = s.spots;
          edg[v * 3] = s.round ? -1 : s.teeth; edg[v * 3 + 1] = s.round ? 0 : s.tatter; edg[v * 3 + 2] = s.round ? 0 : s.dents;
          if (row < rn && j < s.cols - 1) {
            const a = v, b = v + 1, d = v + s.cols, e = v + s.cols + 1;
            idx[k++] = a; idx[k++] = d; idx[k++] = b;
            idx[k++] = b; idx[k++] = d; idx[k++] = e;
          }
          v++;
        }
        sl += s.len[Math.min(i, s.n - 1)] / R;
      }
      for (const bl of s.bulbs) {
        const bc = bl.color;
        for (let q = 0; q < SPH_V; q++) {
          const sh = 0.85 + 0.25 * (sph[q][1] * 0.5 + 0.5);
          col[(v + q) * 3] = bc.r * sh; col[(v + q) * 3 + 1] = bc.g * sh; col[(v + q) * 3 + 2] = bc.b * sh;
          uv[(v + q) * 2] = 0.5 + 0.5 * sph[q][0]; uv[(v + q) * 2 + 1] = 2;
          inf.fill(0, (v + q) * 4, (v + q) * 4 + 4); edg.fill(0, (v + q) * 3, (v + q) * 3 + 3);
        }
        for (let a = 0; a < SPH_LAT; a++) {
          for (let b = 0; b < SPH_LON; b++) {
            const p0 = v + a * (SPH_LON + 1) + b, p1 = p0 + SPH_LON + 1;
            idx[k++] = p0; idx[k++] = p1; idx[k++] = p0 + 1;
            idx[k++] = p0 + 1; idx[k++] = p1; idx[k++] = p1 + 1;
          }
        }
        v += SPH_V;
      }
    }
    g.attributes.color.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
    g.attributes.aInfo.needsUpdate = true;
    g.attributes.aEdge.needsUpdate = true;
    g.index.needsUpdate = true;
    g.setDrawRange(0, k);
    this.nv = v;
  }

  // ---- geometry: where every vertex is now
  write(t0) {
    const g = this.geometry;
    if (!g.attributes.position) return;
    const P = g.attributes.position.array, N = g.attributes.normal.array, O = g.attributes.aOcc.array;
    this.shadow(t0);
    let v = 0;
    for (const s of this.strands) {
      // the strand turned with what it hangs on: about its parent's axis where it is rooted,
      // by the parent's torsion there (only the stipe twists, carrying all it bears) and by
      // its own roll out of the parent's plane
      const M = s.M;
      if (!s.parent) M.set(IDENT);
      else {
        const p = s.parent, node = s.at < 0 ? p.n : Math.min(s.at, p.n);
        const pa = p.ang[Math.max(0, Math.min(node, p.n - 1))] ?? p.rootAngle;
        turnAbout(M, p.M, p.px[node], p.py[node], Math.cos(pa), Math.sin(pa), (p.tor[node] || 0) + s.roll);
      }
    }
    for (const s of this.strands) {
      if (s.n < 1) continue;
      const t = s === this.spine ? this.st : t0; // the stipe in its own time
      const occ = s.occ;
      const M = s.M, v0 = v, moved = s.parent && (M[0] !== 1 || M[4] !== 1 || M[8] !== 1 || M[9] || M[10] || M[11]);
      const gr = s.growth(t);
      const gw = Math.sqrt(gr);
      const n = s.n;
      const rf = s.ruffle;
      const W = s.widths(), C = cols(s.cols);
      const ob = s.orbit && s.parent, op = ob && s.parent;
      let ok = 0, qx = 0, qy = 0, qz = 0;
      const R = s.rows, rn = n * R;
      for (let row = 0; row <= rn; row++) {
        const vi = v;
        // the row's place between its nodes i and i + 1 (f: 0 … 1; a node's own row at 0)
        const i = Math.floor(row / R), f = row / R - i;
        // the node's direction: between its two segments
        nodeDir(s, i);
        let tx = dir_.x, ty = dir_.y;
        let cx = s.px[i], cy = s.py[i], si = s.s[i], tor = s.tor[i], wi = W[i], oc = occ[i];
        if (f > 0) {
          // between two nodes: on the smooth curve through them (a cubic Hermite, each
          // node's direction its tangent), the rest eased from one to the next
          const j = i + 1, ax = tx, ay = ty;
          nodeDir(s, j);
          const bx = dir_.x, by = dir_.y;
          const L = Math.hypot(s.px[j] - cx, s.py[j] - cy);
          const f2 = f * f, f3 = f2 * f;
          const h00 = 2 * f3 - 3 * f2 + 1, h10 = (f3 - 2 * f2 + f) * L, h01 = 3 * f2 - 2 * f3, h11 = (f3 - f2) * L;
          const d00 = 6 * f2 - 6 * f, d10 = (3 * f2 - 4 * f + 1) * L, d11 = (3 * f2 - 2 * f) * L;
          const x1 = s.px[j], y1 = s.py[j];
          tx = d00 * cx + d10 * ax - d00 * x1 + d11 * bx;
          ty = d00 * cy + d10 * ay - d00 * y1 + d11 * by;
          const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
          cx = h00 * cx + h10 * ax + h01 * x1 + h11 * bx;
          cy = h00 * cy + h10 * ay + h01 * y1 + h11 * by;
          si += (s.s[j] - si) * f; tor += (s.tor[j] - tor) * f; wi += (W[j] - wi) * f; oc += (occ[j] - oc) * f;
        }
        const nx = -ty, ny = tx; // in the plane, across
        // twisting with the swell, and flapping where the pointer has churned the water
        const tw = s.twist + s.twistRate * si + s.flutter * Math.sin(t * 1.3 + si * 0.35 + s.phase)
          + s.agit * (0.5 + s.flutter) * Math.sin(t * s.flap - si * (s.flap > 3 ? 0.5 : 0.15) + s.phase * 3) * Math.min(1, si / 6) + tor;
        const ct = Math.cos(tw), st = Math.sin(tw);
        // W across the blade, B its face's normal
        const Wx = nx * ct, Wy = ny * ct, Wz = st;
        const Bx = -nx * st, By = -ny * st, Bz = ct;
        const h = wi * gw;
        let amp = 0, dph = 0, sp = 0, cp = 1, sg = 0;
        if (rf) {
          sg = si / Math.max(gr, 0.2);
          let ph = rf.freq * sg - t * rf.speed + s.phase;
          amp = rf.amp * h * Math.min(1, (i + f) / 3);
          dph = rf.freq;
          if (rf.irr) {
            // an uneven frill: its waves drawn out here, crowded there, deeper and shallower
            // along the blade (slow waves of their own, never twice the same)
            const k = rf.irr;
            ph += k * (1.6 * Math.sin(sg * 0.23 + s.phase * 1.3) + 0.7 * Math.sin(sg * 0.57 + s.phase * 0.7));
            dph += k * (1.6 * 0.23 * Math.cos(sg * 0.23 + s.phase * 1.3) + 0.7 * 0.57 * Math.cos(sg * 0.57 + s.phase * 0.7));
            amp *= 1 + k * (0.35 * Math.sin(sg * 0.31 + s.phase * 2.1) + 0.2 * Math.sin(sg * 0.83 + s.phase * 0.4));
          }
          if (rf.rock) {
            // frills that are the tissue's own (speed 0: they stay where they are on the
            // blade) rock about where they lie with the swell, a long wave of it running out
            // along the blade, and flap quicker where the pointer has churned the water
            const a1 = t * 0.4 - sg * 0.12 + s.phase, a2 = t * s.flap * 0.6 - sg * 0.45 + s.phase * 2;
            const ag = s.agit * Math.min(1, si / 6);
            ph += rf.rock * (Math.sin(a1) + 1.5 * ag * Math.sin(a2));
            dph -= rf.rock * (0.12 * Math.cos(a1) + 0.45 * 1.5 * ag * Math.cos(a2));
            amp *= 1 + 0.1 * Math.sin(t * 0.3 + sg * 0.15 + s.phase * 1.7) + 0.3 * ag;
          }
          sp = Math.sin(ph); cp = Math.cos(ph);
        }
        // a frill on the margins alone (rf.margin: where it starts, out from the midline):
        // the middle of the blade flat, each margin waving in its own way, out of step with
        // the other by more here, less there (its own phase, its own slow drift)
        let mPh = 0, mDp = 0, mOff = 0, mDo = 0;
        if (rf?.margin != null) {
          const k = rf.irr || 0, lb = sg * 0.29 + s.phase * 3, lc = sg * 0.41 + s.phase * 5;
          mOff = 1.9 + k * 1.3 * (Math.sin(lb) - Math.sin(lc));
          mDo = k * 1.3 * (0.29 * Math.cos(lb) - 0.41 * Math.cos(lc));
          mPh = Math.atan2(sp, cp); mDp = dph;
        }
        // the margins cupped as the blade flutters, a beat behind its turn: the water pressing
        // on the face it turns toward pushes them back (both the same way, unlike the frill)
        const cup = rf?.cup ? rf.cup * h * Math.min(1, si / 4) * Math.sin(t * 1.3 + si * 0.35 + s.phase - 0.9) : 0;
        for (let j = 0; j < s.cols; j++) {
          const vv = C.vv[j];
          let r = 0, dru = 0, drw = 0;
          if (rf && rf.margin != null) {
            const c0 = rf.margin, av = Math.abs(vv), sd = vv < 0 ? -1 : 1;
            const a = Math.max(0, (av - c0) / (1 - c0)), g = a * a, gp = sd * 2 * a / (1 - c0);
            // its crests leaning back a little toward the margin, as frills do
            const q = mPh + (sd > 0 ? mOff : 0) + 0.5 * a, dp = mDp + (sd > 0 ? mDo : 0);
            const sn = Math.sin(q), cs = Math.cos(q);
            r = amp * g * sn + cup * vv * vv;
            dru = amp * g * cs * dp;
            drw = h > 1e-4 ? (amp * gp * sn + 2 * cup * vv) / h : 0;
          } else if (rf) {
            // sin, cos of (ph + 0.9 vv), from their parts
            const sn = sp * C.c[j] + cp * C.s[j], cs = cp * C.c[j] - sp * C.s[j];
            r = amp * vv * vv * sn + cup * vv * vv;
            dru = amp * vv * vv * cs * dph;
            drw = h > 1e-4 ? (2 * amp * vv * sn + 2 * cup * vv) / h : 0;
          }
          const o = v * 3;
          let mx, my, mz;
          if (s.round) {
            // round the tube, turned with its twist: its girth the same whichever way it faces
            const a = C.rs[j], b = C.rc[j];
            mx = Wx * a + Bx * b; my = Wy * a + By * b; mz = Wz * a + Bz * b;
            P[o] = cx + mx * h + Bx * r;
            P[o + 1] = cy + my * h + By * r;
            P[o + 2] = mz * h + Bz * r;
          } else {
            P[o] = cx + Wx * vv * h + Bx * r;
            P[o + 1] = cy + Wy * vv * h + By * r;
            P[o + 2] = Wz * vv * h + Bz * r;
            mx = Bx - Wx * drw - tx * dru; my = By - Wy * drw - ty * dru; mz = Bz - Wz * drw;
          }
          const ml = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
          N[o] = mx / ml; N[o + 1] = my / ml; N[o + 2] = mz / ml;
          O[v] = oc;
          v++;
        }
        if (ob) {
          // turned about the parent's axis where it lies alongside (by arc length): each
          // segment turned about that axis (its direction between the parent's nodes, eased
          // from one to the next, so the turn changes smoothly along the strand) and the
          // segments chained again from the root, so the strand stays a smooth curve
          const si = s.s[i], pn = op.n;
          while (ok < pn - 1 && op.s[ok + 1] <= si) ok++;
          const seg = op.s[ok + 1] - op.s[ok];
          const f = seg > 1e-6 ? Math.min(1, Math.max(0, (si - op.s[ok]) / seg)) : 0;
          // the parent's directions at its nodes ok and ok + 1 (between their segments)
          const ka = Math.max(0, ok - 1), kb = Math.min(pn - 1, ok + 1);
          const dax = (op.ca[ka] ?? 1) + (op.ca[ok] ?? 1), day = (op.sa[ka] ?? 0) + (op.sa[ok] ?? 0);
          const dbx = (op.ca[ok] ?? 1) + (op.ca[kb] ?? 1), dby = (op.sa[ok] ?? 0) + (op.sa[kb] ?? 0);
          let ux = dax + (dbx - dax) * f, uy = day + (dby - day) * f;
          const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
          const o = s.orbit, tor = (op.tor[ok] || 0) + ((op.tor[ok + 1] || 0) - (op.tor[ok] || 0)) * f;
          const th = o.phi + o.amp * Math.sin(si * o.freq + o.ph) + 0.15 * Math.sin(t * 0.21 + o.ph * 1.7) + tor;
          const c = Math.cos(th), sn = Math.sin(th), kk = 1 - c;
          const r00 = c + ux * ux * kk, r01 = ux * uy * kk, r02 = uy * sn;
          const r10 = ux * uy * kk, r11 = c + uy * uy * kk, r12 = -ux * sn;
          const r20 = -uy * sn, r21 = ux * sn, r22 = c;
          // where the node goes: the last one moved on by this segment, turned
          if (i === 0) { qx = s.px[0]; qy = s.py[0]; qz = 0; }
          else {
            const ex = s.px[i] - s.px[i - 1], ey = s.py[i] - s.py[i - 1];
            qx += r00 * ex + r01 * ey; qy += r10 * ex + r11 * ey; qz += r20 * ex + r21 * ey;
          }
          const cx0 = s.px[i], cy0 = s.py[i];
          for (let q = vi; q < v; q++) {
            const o3 = q * 3, x = P[o3] - cx0, y = P[o3 + 1] - cy0, z = P[o3 + 2], a = N[o3], b = N[o3 + 1], d = N[o3 + 2];
            P[o3] = qx + r00 * x + r01 * y + r02 * z;
            P[o3 + 1] = qy + r10 * x + r11 * y + r12 * z;
            P[o3 + 2] = qz + r20 * x + r21 * y + r22 * z;
            N[o3] = r00 * a + r01 * b + r02 * d;
            N[o3 + 1] = r10 * a + r11 * b + r12 * d;
            N[o3 + 2] = r20 * a + r21 * b + r22 * d;
          }
        }
      }
      for (const bl of s.bulbs) {
        const node = bl.node < 0 ? n : Math.min(bl.node, n);
        const a = s.ang[Math.max(0, Math.min(node, n - 1))];
        const tx = Math.cos(a), ty = Math.sin(a);
        const r = bl.r * gr, el = bl.elong || 1, pear = bl.pear || 0;
        const cx = s.px[node] + tx * r * (bl.shift || 0), cy = s.py[node] + ty * r * (bl.shift || 0);
        for (let q = 0; q < SPH_V; q++) {
          const [sx, sy, sz] = sph[q];
          // a pear: narrow at its stalk (sx = -1), full toward its blade
          const f = 1 + pear * (sx * 0.5 - 0.15) - pear * 0.35 * Math.max(0, -sx) ** 2;
          const o = (v + q) * 3;
          P[o] = cx + tx * sx * r * el - ty * sy * r * f;
          P[o + 1] = cy + ty * sx * r * el + tx * sy * r * f;
          P[o + 2] = sz * r * f;
          const ny = sy / f, nz = sz / f, nx = sx / el - pear * 0.5 * (sy * sy + sz * sz) / (f * el);
          N[o] = tx * nx - ty * ny; N[o + 1] = ty * nx + tx * ny; N[o + 2] = nz;
          O[v + q] = occ[node];
        }
        v += SPH_V;
      }
      if (moved) {
        for (let q = v0; q < v; q++) {
          const o = q * 3, x = P[o], y = P[o + 1], z = P[o + 2], a = N[o], b = N[o + 1], c = N[o + 2];
          P[o] = M[0] * x + M[1] * y + M[2] * z + M[9];
          P[o + 1] = M[3] * x + M[4] * y + M[5] * z + M[10];
          P[o + 2] = M[6] * x + M[7] * y + M[8] * z + M[11];
          N[o] = M[0] * a + M[1] * b + M[2] * c;
          N[o + 1] = M[3] * a + M[4] * b + M[5] * c;
          N[o + 2] = M[6] * a + M[7] * b + M[8] * c;
        }
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.normal.needsUpdate = true;
    g.attributes.position.clearUpdateRanges?.();
    g.attributes.position.addUpdateRange?.(0, v * 3);
    g.attributes.normal.clearUpdateRanges?.();
    g.attributes.normal.addUpdateRange?.(0, v * 3);
    g.attributes.aOcc.needsUpdate = true;
    g.attributes.aOcc.clearUpdateRanges?.();
    g.attributes.aOcc.addUpdateRange?.(0, v);
  }

  // ---- its own shade: how much of the plant lies between each node and the light (above,
  // a little from the left: water.js), so the lower blades and its heart are darker than
  // the tips in the light. Its tissue is laid on a coarse grid of the plant (how much of
  // each cell it covers), summed down from the top along the light, fading with distance
  // (the water scatters the light back in under a blade): s.occ, 0 lit … 1 deep in shade
  shadow(t) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const s of this.strands) {
      for (let i = 0; i <= s.n; i++) {
        const x = s.px[i], y = s.py[i];
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
      if (!s.occ || s.occ.length < s.n + 1) s.occ = new Float32Array(s.n + 16);
    }
    if (!(x1 >= x0)) return;
    x0 -= SH_CELL * 2; x1 += SH_CELL; y0 -= SH_CELL; y1 += SH_CELL;
    const gw = Math.min(SH_MAX, Math.ceil((x1 - x0) / SH_CELL) + 1), gh = Math.min(SH_MAX, Math.ceil((y1 - y0) / SH_CELL) + 1);
    const cx = (x1 - x0) / (gw - 1), cy = (y1 - y0) / (gh - 1); // a cell's size, units
    const D = shD, A = shA;
    D.fill(0, 0, gw * gh);
    // the tissue laid down: each segment's area, as a fraction of a cell, shared between
    // the four cells round its middle
    const cell = cx * cy;
    for (const s of this.strands) {
      if (s.n < 1) continue;
      const W = s.widths(), gwid = Math.sqrt(s.growth(s === this.spine ? this.st : t)), k = (s.round ? 0.6 : 1) * SH_OPAC / cell;
      for (let i = 0; i < s.n; i++) {
        const fx = ((s.px[i] + s.px[i + 1]) * 0.5 - x0) / cx, fy = ((s.py[i] + s.py[i + 1]) * 0.5 - y0) / cy;
        const ix = Math.min(gw - 2, Math.max(0, Math.floor(fx))), iy = Math.min(gh - 2, Math.max(0, Math.floor(fy)));
        const ux = Math.min(1, Math.max(0, fx - ix)), uy = Math.min(1, Math.max(0, fy - iy));
        const a = (W[i] + W[i + 1]) * gwid * s.len[i] * k;
        const o = iy * gw + ix;
        D[o] += a * (1 - ux) * (1 - uy); D[o + 1] += a * ux * (1 - uy);
        D[o + gw] += a * (1 - ux) * uy; D[o + gw + 1] += a * ux * uy;
      }
    }
    // summed from the top row down, each row taking the one above it from a little to the
    // left (toward the light), faded by the water between
    const shift = SH_SLANT * cy / cx, fade = Math.exp(-cy / SH_RANGE);
    A.fill(0, (gh - 1) * gw, gh * gw);
    for (let r = gh - 2; r >= 0; r--) {
      const up = (r + 1) * gw, row = r * gw;
      for (let c = 0; c < gw; c++) {
        const f = c - shift, i = Math.floor(f), u = f - i;
        const a = i >= 0 && i < gw ? A[up + i] + D[up + i] : 0;
        const b = i + 1 >= 0 && i + 1 < gw ? A[up + i + 1] + D[up + i + 1] : 0;
        A[row + c] = fade * (a + (b - a) * u);
      }
    }
    // (less a blade's own share: seen edge on to the light, a blade standing upright does
    // not shade itself, though flattened on the grid its tip lies above its base)
    for (const s of this.strands) {
      const occ = s.occ, own = !s.round && s.n > 1;
      const W = s.widths(), gwid = Math.sqrt(s.growth(s === this.spine ? this.st : t)), k = SH_OPAC / cell;
      for (let i = 0; i <= s.n; i++) {
        let self = 0;
        if (own) {
          for (let j = i; j < s.n; j++) {
            const mx = (s.px[j] + s.px[j + 1]) * 0.5, my = (s.py[j] + s.py[j + 1]) * 0.5;
            const dy = my - s.py[i];
            if (dy <= 0) continue;
            const wx = 1 - Math.abs(mx + SH_SLANT * dy - s.px[i]) / cx;
            if (wx > 0) self += (W[j] + W[j + 1]) * gwid * s.len[j] * k * wx * Math.exp(-dy / SH_RANGE);
          }
        }
        const fx = (s.px[i] - x0) / cx, fy = (s.py[i] - y0) / cy;
        const ix = Math.min(gw - 2, Math.max(0, Math.floor(fx))), iy = Math.min(gh - 2, Math.max(0, Math.floor(fy)));
        const ux = Math.min(1, Math.max(0, fx - ix)), uy = Math.min(1, Math.max(0, fy - iy));
        const o = iy * gw + ix;
        const a = A[o] + (A[o + 1] - A[o]) * ux, b = A[o + gw] + (A[o + gw + 1] - A[o + gw]) * ux;
        occ[i] = 1 - Math.exp(-Math.max(0, a + (b - a) * uy - self));
      }
    }
  }

  dispose() {
    this.geometry.dispose();
  }
}
