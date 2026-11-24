// One level of the rope, in its own units: a rope 1 wide, laid tight, made of six strands
// round an empty middle, each built the same way, as six yarns laid round an empty middle (the
// yarns' own fibres are drawn on their surface). One of the strands, the survivor, is not drawn
// here: it is the next level, the same rope a third the size, laid in its place (look.js lays
// it). Each other strand can be shown whole, or snapped: two pieces whose ends have sprung back
// from the break, their yarns unravelling out of the lay and coming apart into their plies and
// fibres. main.js snaps them one after the other while the survivor untwists out of the lay into
// the middle, alone holding across the gap, and zooms ×3 onto it, whose own strands start
// snapping next, and so on.
import * as THREE from 'three';

export const S = 1 / 3; // a strand's size relative to its rope
export const PITCH = 2.6; // length of one turn of the lay
export const YMAX = 4.2; // the strands' half length
const RHO = S / 2; // a strand's radius
const RY = RHO / 3; // a yarn's radius

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const shuffle = (a, r) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// the six strands, all alike, laid round an empty middle: where each one snaps (yb), where its
// two broken ends come to rest (top, -bottom), and when it snaps in the cycle (tau, 0..1). Five
// snap, a sixth of the cycle apart; the sixth, the survivor, is the last left holding: it is
// not drawn here but is the next level, the same rope a third the size, laid in its place. Its
// two neighbours go first (it can't come in to the middle before they are out of its way),
// then it untwists out of the lay into the middle, a step at each snap after that (see untwistAt), and settles
// there on the sixth beat (its tau), a sixth before the next level's first snap: one steady
// cadence on, from a rope to its last strand, with no lull between them
const rand = rng(14);
export const strands = [];
export const SURVIVOR = 2;
{
  // (the survivor's neighbours' ends spring back furthest, leaving it a long stretch to
  // straighten over)
  const ranks = () => {
    const far = shuffle([4, 5], rand), near = shuffle([0, 1, 2, 3], rand), o = [];
    for (let k = 0; k < 6; k++) o[(SURVIVOR + k) % 6] = k === 1 ? far[0] : k === 5 ? far[1] : near.pop();
    return o;
  };
  const ot = ranks(), ob = ranks();
  const when = [];
  const early = shuffle([0, 1, 2], rand), late = shuffle([early[2], 3, 4], rand);
  when[SURVIVOR] = 5;
  when[(SURVIVOR + 1) % 6] = early[0];
  when[(SURVIVOR + 5) % 6] = early[1];
  for (let k = 2, q = 0; k <= 4; k++) when[(SURVIVOR + k) % 6] = late[q++];
  // (the survivor's neighbours, ranked 4 and 5, well beyond the rest: the survivor eases in
  // from the lay over that stretch)
  const rest = (k) => (k < 4 ? 0.5 + 0.5 * (k / 5) : 1.2 + 0.15 * (k - 4)) + 0.06 * (rand() - 0.5);
  for (let i = 0; i < 6; i++)
    strands.push({
      phi: (i * Math.PI) / 3,
      yb: 0.1 * (rand() * 2 - 1),
      top: rest(ot[i]),
      bottom: rest(ob[i]),
      tau: (when[i] + 0.5) / 6 + (i === SURVIVOR ? 0 : 0.03 * (rand() - 0.5)),
      survivor: i === SURVIVOR,
    });
}
const NB = [strands[(SURVIVOR + 1) % 6], strands[(SURVIVOR + 5) % 6]];
// the survivor's untwisting: at stage x, how far it has come in from the lay to the middle
// (0..1), steadily from when both its neighbours are gone to the end of the stage
const X0 = Math.max(...NB.map((n) => n.tau)) + 0.02;
// it comes in by steps, each snap of the strands still round it handing it more of the load
// and letting it in further with a quick give that eases off, the last one as it settles on
// its own beat; with a slow creep in between, so it never stands quite still
const UNTW_STEPS = [X0, ...strands.filter((st) => !st.survivor && st.tau > X0).map((st) => st.tau).sort((a, b) => a - b), strands[SURVIVOR].tau];
const UNTW_GIVE = 0.1, UNTW_CREEP = 0.3;
export function untwistAt(x) {
  let s = 0;
  for (const at of UNTW_STEPS) {
    const k = Math.min(1, Math.max(0, (x - at) / UNTW_GIVE));
    s += 1 - (1 - k) ** 3;
  }
  return (1 - UNTW_CREEP) * (s / UNTW_STEPS.length) + UNTW_CREEP * smooth(X0, strands[SURVIVOR].tau, x);
}
// and, as it comes in, the load it takes stretches it and draws the two halves of the rope
// further apart: the broken ends that rested within the stretch where it leaves the lay
// (between its neighbours' ends) are drawn back to about there, so that none is left lying
// in the open ring round it as it goes. How far each end is drawn back in all (`apart`, above,
// below) and, at stage x, how much of that it has been (0..1)
{
  const r = rng(16);
  const [nt, nb] = [Math.min(...NB.map((n) => n.top)), Math.min(...NB.map((n) => n.bottom))];
  for (const st of strands) {
    // (each still at its own height, in the order they were, so that they don't end in an even cut)
    const far = (e, lim) => (st.survivor || NB.includes(st) ? 0 : Math.max(0, lim - 0.25 + 1.1 * (e - 0.5) + 0.08 * r() - e));
    st.apart = [far(st.top, nt), far(st.bottom, nb)];
  }
}
export function apartAt(x) {
  return smooth(X0 - 0.03, X0 + 0.25 * (1 - X0), x);
}
// and the rope's two halves spinning opposite ways to unwind it: how long a stretch of the
// lay round the break has been unwound (in the level's units, each way), growing at a steady
// rate from then on, on through the next stage (the halves keep spinning at a steady speed),
// long enough by the end of this one for the survivor to come in straight
const SPIN_EASE = 0.08, SPIN_RATE = 1.6 / (1 - X0 - SPIN_EASE / 2);
export function unwoundAt(x) {
  const d = x - X0;
  return d <= 0 ? 0 : SPIN_RATE * (d < SPIN_EASE ? (d * d) / (2 * SPIN_EASE) : d - SPIN_EASE / 2);
}
// and the stretch it's in the middle over (above, below), easing out of it over BEND, most of
// that stretch, back into the lay at its neighbours' broken ends, which keep it there beyond; they are pulled out along it later (`out(st)`
// how far), and it straightens on after them
export const BEND = 0.85;
export function straightAt(out) {
  return [Math.min(...NB.map((n) => n.top + out(n))), Math.min(...NB.map((n) => n.bottom + out(n)))];
}

// a strand is built the same way, six yarns round an empty middle, and goes the same way:
// before it snaps, five of its yarns give way one by one, the two either side of the sixth
// first, and the sixth, left holding, untwists into the middle as the others go, until it
// snaps too and the strand with it. On a steady beat from the snap of the strand before (in
// the level before for the first) to its own, which is the beat's last: when each one breaks
// (`at`, in the cycle, counted from tau - YARN_LEAD; the last one's is the strand's snap), and
// how far its two ends spring back from the break (`gap`, above and below: the last one's
// neighbours further, to leave it room to come in)
export const YARN_LEAD = 0.18; // (at most: the strand before snapped about a sixth earlier)
{
  const r = rng(15);
  const taus = strands.map((st) => st.tau).sort((a, b) => a - b);
  for (const st of strands) {
    const k = taus.indexOf(st.tau);
    const lead = Math.min(YARN_LEAD, st.tau - (k > 0 ? taus[k - 1] : taus[5] - 1));
    const last = Math.floor(r() * 6);
    const early = shuffle([0, 1, 2], r), late = shuffle([early[2], 3, 4], r);
    const order = [];
    order[last] = 5;
    order[(last + 1) % 6] = early[0];
    order[(last + 5) % 6] = early[1];
    for (let q = 2; q <= 4; q++) order[(last + q) % 6] = late[q - 2];
    st.yarns = order.map((o, j) => {
      const nb = j === (last + 1) % 6 || j === (last + 5) % 6;
      const g = () => (nb ? 0.15 + 0.05 * r() : 0.06 + 0.1 * r());
      return { at: o === 5 ? YARN_LEAD : YARN_LEAD - lead + (lead / 6) * (o + 1 + 0.3 * (r() - 0.5)), gap: [g(), g()], last: o === 5 };
    });
    // the last one's untwisting (0..1) at time `cut` (as `at`): steadily from when both its
    // neighbours are gone to the snap
    const nbAt = Math.max(st.yarns[(last + 1) % 6].at, st.yarns[(last + 5) % 6].at);
    st.yarnUntwist = (cut) => smooth(nbAt + 0.01, YARN_LEAD - 0.01, cut);
  }
}

const lay = (st, y, r = S, out = new THREE.Vector3()) => {
  const th = st.phi + ((2 * Math.PI) / PITCH) * y;
  return out.set(r * Math.cos(th), y, r * Math.sin(th));
};
// a broken piece's centre at height y (σ = 1 for the piece above, -1 below), its end at
// height σe: it springs out a little and loses some twist near the end
function piecePoint(st, sigma, e, y, out = new THREE.Vector3()) {
  const loose = 1 - smooth(0, 0.5, Math.max(0, sigma * y - e));
  const r = S + 0.07 * loose * loose;
  const th = st.phi + ((2 * Math.PI) / PITCH) * y - sigma * 0.45 * loose * loose;
  return out.set(r * Math.cos(th), y, r * Math.sin(th));
}

// Per vertex: uv (s along, a round), tw (twist of the tube's own strands), fr (how loose),
// rad (the tube's radius), ctr (the centre of the strand it is laid in), and for the
// snapping: anchor (what it gathers to before it bursts out), pull (how far the end has to
// spring back from the break), dend (height from the end), sig (σ), tuft (0..1).
const buffers = () => ({ pos: [], nor: [], uv: [], tw: [], fr: [], rad: [], ctr: [], anchor: [], pull: [], dend: [], sig: [], tuft: [], ord: [], idx: [] });
const at = (x, i) => (typeof x === 'function' ? x(i) : x);
function tube(points, radii, o, { R = 8, twistRate = 0, tw0 = 0, loose = 1, anchor = null, ctr = null, pull = 0, end = null, sig = 0, tuft = 0, face = 0, ord = -1 } = {}) {
  const n = points.length - 1;
  const T = [];
  for (let i = 0; i <= n; i++) {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n, i + 1)];
    T.push(b.clone().sub(a).normalize());
  }
  let nrm = new THREE.Vector3(0, 0, 1).cross(T[0]);
  if (nrm.lengthSq() < 1e-6) nrm.set(1, 0, 0).cross(T[0]);
  nrm.normalize();
  const base = o.pos.length / 3;
  let s = 0, tw = tw0;
  const ax = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      ax.copy(T[i - 1]).cross(T[i]);
      const l = ax.length();
      if (l > 1e-8) nrm.applyAxisAngle(ax.divideScalar(l), Math.asin(Math.min(1, l)));
      nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
      const ds = points[i].distanceTo(points[i - 1]);
      s += ds;
      tw += ds * at(twistRate, i);
    }
    const bn = T[i].clone().cross(nrm);
    const p = points[i];
    const an = at(anchor, i) || p, ce = at(ctr, i) || p;
    const de = end === null ? 0 : Math.max(0, sig * p.y - end);
    const lo = at(loose, i), tu = at(tuft, i), pu = at(pull, i);
    // `face` (0..1) turns the normal from round the tube toward along it, for a blunt end
    // to be lit as the face it is rather than as more of the tube's side
    const fc = at(face, i);
    for (let j = 0; j <= R; j++) {
      const ang = (j / R) * Math.PI * 2;
      const c = Math.cos(ang), sn = Math.sin(ang);
      const nx = nrm.x * c + bn.x * sn, ny = nrm.y * c + bn.y * sn, nz = nrm.z * c + bn.z * sn;
      o.pos.push(p.x + nx * radii[i], p.y + ny * radii[i], p.z + nz * radii[i]);
      if (fc > 0) {
        const mx = nx * (1 - fc) + T[i].x * fc, my = ny * (1 - fc) + T[i].y * fc, mz = nz * (1 - fc) + T[i].z * fc;
        const ml = Math.hypot(mx, my, mz);
        o.nor.push(mx / ml, my / ml, mz / ml);
      } else o.nor.push(nx, ny, nz);
      o.uv.push(s, j / R);
      o.tw.push(tw);
      o.fr.push(lo);
      o.rad.push(radii[i]);
      o.ctr.push(ce.x, ce.y, ce.z);
      o.anchor.push(an.x, an.y, an.z);
      o.pull.push(pu);
      o.dend.push(de);
      o.sig.push(sig);
      o.tuft.push(tu);
      o.ord.push(ord);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < R; j++) {
      const a = base + i * (R + 1) + j, b = a + R + 1;
      // counter-clockwise seen from outside, so that the front faces are the outer ones
      o.idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  // its frame and twist at the end, for what goes on from there
  return { N: nrm.clone(), B: T[n].clone().cross(nrm), tw };
}
function toGeometry(o) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2));
  for (const k of ['tw', 'fr', 'rad', 'pull', 'dend', 'sig', 'tuft', 'ord']) g.setAttribute(k, new THREE.Float32BufferAttribute(o[k], 1));
  g.setAttribute('ctr', new THREE.Float32BufferAttribute(o.ctr, 3));
  g.setAttribute('anchor', new THREE.Float32BufferAttribute(o.anchor, 3));
  g.setIndex(o.idx);
  g.computeBoundingSphere();
  return g;
}

function curlPath(p, d, len, curl, n) {
  const pts = [], pos = p.clone(), dir = d.clone().normalize();
  for (let i = 0; i <= n; i++) {
    pts.push(pos.clone());
    dir.addScaledVector(curl, len / n).normalize();
    pos.addScaledVector(dir, len / n);
  }
  return pts;
}
// a crimped fibre: like curlPath, its direction wandering a little at each step
function wavyPath(p, d, len, curl, n, r, crimp = 0.35) {
  const pts = [], pos = p.clone(), dir = d.clone().normalize(), j = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    pts.push(pos.clone());
    dir.addScaledVector(curl, len / n).add(j.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(crimp)).normalize();
    pos.addScaledVector(dir, len / n);
  }
  return pts;
}
const taper = (pts, w, k = 0.8) => pts.map((_, q) => w * (1 - k * (q / (pts.length - 1))));
const jitter = (r, v, a) => v.set(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(a);

// parallel transport frames along a centre line
function frames(pts) {
  const n = pts.length - 1, T = [], N = [], B = [];
  for (let i = 0; i <= n; i++) T.push(pts[Math.min(n, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize());
  let nrm = new THREE.Vector3(1, 0, 0).cross(T[0]).normalize();
  const ax = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    if (i > 0) {
      ax.copy(T[i - 1]).cross(T[i]);
      const l = ax.length();
      if (l > 1e-8) nrm.applyAxisAngle(ax.divideScalar(l), Math.asin(Math.min(1, l)));
      nrm.addScaledVector(T[i], -nrm.dot(T[i])).normalize();
    }
    N.push(nrm.clone());
    B.push(T[i].clone().cross(nrm));
  }
  return { T, N, B };
}

// the six yarns of a strand laid along centre line `pts` (round an empty middle, laid the
// same way as the strands, as the next rope's are): their centre lines, and the length along the strand at each point. `untwist` (per
// point, 0..1) slackens their lay
function yarnLines(pts, phase, untwist = () => 0) {
  const { N, B } = frames(pts);
  const lines = [[], [], [], [], [], []];
  let s = 0, psi = phase;
  for (let i = 0; i < pts.length; i++) {
    if (i > 0) {
      const ds = pts[i].distanceTo(pts[i - 1]);
      s += ds;
      psi += ((2 * Math.PI) / (PITCH * S)) * ds * (1 - 0.6 * untwist(i));
    }
    // slackened, the yarns also come apart from each other, so the gaps between them show
    const rr = ((2 * RHO) / 3) * (1 + 0.45 * Math.pow(untwist(i), 3));
    for (let j = 0; j < 6; j++) {
      const a = psi + (j * Math.PI) / 3;
      lines[j].push(pts[i].clone().addScaledVector(N[i], rr * Math.cos(a)).addScaledVector(B[i], rr * Math.sin(a)));
    }
  }
  return lines;
}
const YARN = { R: 11, twistRate: 1 / (PITCH * S * S) };
// the brushes of fibres at broken yarns' ends have their own random numbers (see brokenYarn);
// how many the brushes used to take from the rest's, per ply
const rf = rng(17);
const FIBRE_DRAWS = 33 * 38 + 5 * 37;

// strand whole, laid tight from top to bottom: its six yarns (`yarns`), or a plain tube for
// when it's small (`plain`)
function intact(st) {
  const n = 330, pts = [];
  for (let i = 0; i <= n; i++) pts.push(lay(st, -YMAX + (2 * YMAX * i) / n));
  const yo = buffers(), po = buffers();
  // (each drawn until it gives way, see yarnBreaks; the last one, ord -2, untwisting into the
  // middle, see look.js)
  yarnLines(pts, st.phi).forEach((line, j) => tube(line, line.map(() => RY), yo, { ...YARN, loose: 0, ctr: (i) => pts[i], ord: st.yarns[j].last ? -2 : st.yarns[j].at }));
  tube(pts, pts.map(() => RHO), po, { R: 20, twistRate: -1 / (PITCH * S), loose: 0 });
  return { yarns: toGeometry(yo), plain: toGeometry(po) };
}

// fibres starting to break out of a strand round its weak point, before it snaps
function strain(st, r) {
  const o = buffers(), w = new THREE.Vector3();
  for (let f = 0; f < 120; f++) {
    const y = st.yb + 0.09 * (r() + r() - 1);
    const c0 = lay(st, y);
    const t0 = lay(st, y + 0.01).sub(c0).normalize();
    const out = new THREE.Vector3(c0.x, 0, c0.z).normalize();
    const side = t0.clone().cross(out).normalize();
    const ang = r() * Math.PI * 2;
    const rad = out.clone().multiplyScalar(Math.cos(ang)).addScaledVector(side, Math.sin(ang));
    const root = c0.clone().addScaledVector(rad, RHO * 0.98);
    const d = rad.clone().addScaledVector(t0, (r() - 0.5) * 2).add(jitter(r, w, 0.6));
    const curl = jitter(r, new THREE.Vector3(), 12);
    const fp = curlPath(root, d, 0.02 + 0.09 * r(), curl, 8);
    tube(fp, taper(fp, 0.0007 + 0.0009 * r(), 0.9), o, { R: 4, tw0: r(), loose: (q) => 0.3 + q / 8, anchor: root, ctr: c0, tuft: 1 });
  }
  return toGeometry(o);
}

// a yarn broken off at the end of `laid` (its centre line, from where it's held to where it
// breaks; `ctrAt` the strand's centre along it, `ctrEnd` at the break), going on free, out of
// the lay and away from the break: still a round twisted yarn, it loosens a little, then
// comes apart into its own six plies (the bundles drawn on its surface), which splay out and
// end in short brushes of their fibres. `slip`: it
// slips back along the lay as it springs back (see look.js), its plies and fibres going round
// the strand with it; `extra` goes to all its tubes
function brokenYarn(laid, ctrAt, ctrEnd, looseAt, outward, common, r, po, fo, { slip = false, extra = {} } = {}) {
  const w = new THREE.Vector3();
  const cut = laid.length - 1;
  const last = laid[cut], prev = laid[cut - 2];
  const dir = last.clone().sub(prev).normalize();
  const away = last.clone().sub(ctrAt(cut));
  if (away.lengthSq() < 1e-8) away.copy(outward);
  away.normalize();
  // (long enough, and leaning out enough, for the end to open out like a broom rather than
  // stop short like a cut)
  const len = 0.09 + 0.13 * r();
  const d0 = dir.clone().addScaledVector(away, 0.45 + 0.5 * r()).addScaledVector(outward, 0.22);
  const curl = away.clone().multiplyScalar(1.8 + 2.2 * r()).add(jitter(r, w, 1.5));
  const NF = 8;
  const free = curlPath(last, d0, len, curl, NF).slice(1);
  // a rounded end where the plies come out of it (hidden among them)
  const yEnd = free[NF - 1], yDir = free[NF - 1].clone().sub(free[NF - 2]).normalize();
  const CAP = 4;
  const cap = [];
  for (let q = 1; q <= CAP; q++) cap.push(yEnd.clone().addScaledVector(yDir, RY * 1.1 * 0.5 * Math.sin((q / CAP) * Math.PI * 0.5)));
  const all = laid.concat(free, cap);
  const nl = laid.length, nf = nl + free.length;
  const ft = (i) => Math.min(1, (i - nl + 1) / free.length); // 0..1 along the free part
  const SW = 1.1; // a loosened yarn swells a little
  const radii = all.map((_, i) => {
    if (i < nl) return RY;
    if (i < nf) return RY * (1 + (SW - 1) * ft(i));
    const q = (i - nf + 1) / CAP;
    return RY * SW * Math.max(0.05, Math.cos(q * Math.PI * 0.5));
  });
  const twistAt = (i) => (i < nl ? YARN.twistRate : YARN.twistRate * (1 - 0.5 * ft(i)));
  const end = tube(all, radii, po, {
    ...YARN,
    ...common,
    twistRate: twistAt,
    // shaded like the laid strand where it leaves it, less and less as it gets free
    loose: (i) => (i < nl ? looseAt(i) * 0.5 : 0.5 + 0.3 * ft(i)),
    ctr: (i) => (i < nl ? ctrAt(i) : ctrEnd),
    anchor: last,
    // (its rounded end, in among the plies, darkened as deep in the brush: never a bare pale knob)
    tuft: (i) => (i < nl ? 0 : i < nf ? 0.3 * ft(i) : 0.95),
    ...extra,
  });
  // the frame and twist where the free part ends (the cap only rounds it off)
  let tw = end.tw;
  for (let i = all.length - 1; i > nf - 1; i--) tw -= all[i].distanceTo(all[i - 1]) * twistAt(i);
  const eN = end.N, eB = end.B;
  // the plies: one per bundle of the shader's yarn texture, starting just inside the yarn
  // where that bundle is, then each its own way
  const PR = RY * 0.38;
  const start = free[NF - 3];
  // (and a thinner core ply, filling the middle, shorter)
  for (let k = 0; k < 7; k++) {
    const coreP = k === 6;
    const a = 2 * Math.PI * (tw + (k + 0.5) / 6);
    const off = coreP ? jitter(r, new THREE.Vector3(), 1).projectOnPlane(yDir).normalize() : eN.clone().multiplyScalar(Math.cos(a)).addScaledVector(eB, Math.sin(a));
    const root = start.clone().addScaledVector(off, coreP ? 0 : RY * SW * 0.58);
    const pl = coreP ? 0.025 + 0.035 * r() : 0.055 + 0.09 * Math.pow(r(), 0.8);
    const pd = yDir.clone().addScaledVector(off, 0.12 + 0.22 * r()).add(jitter(r, w, 0.1));
    const pc = off.clone().multiplyScalar(0.8 + 1.5 * r()).add(jitter(r, w, 3));
    const NP = 10;
    const ply = wavyPath(root, pd, pl, pc, NP, r, 0.12);
    const pt = (q) => q / NP;
    // round, then thinning toward its end like a paintbrush as its fibres leave it, and
    // still blunt at the end (closed off there, hidden in the brush)
    const pk = PR * (coreP ? 0.8 : 0.9 + 0.15 * r());
    const pr = ply.map((_, q) => pk * (1 + 0.1 * pt(q)) * (1 - 0.5 * smooth(0.4, 1, pt(q))) * (q === NP ? 0.05 : 1));
    tube(ply, pr, po, {
      R: 7,
      twistRate: (1 / (PITCH * S * S * S)) * 0.5,
      tw0: r(),
      ...common,
      loose: (q) => 0.75 + 0.25 * pt(q),
      // (round the strand's centre while it slips back along the lay, see look.js)
      // (and with it where the ring closes up round a missing strand, see look.js: all of a
      // yarn's end moves with the cross-section of the strand it leaves, or it would come loose)
      ctr: () => ctrEnd,
      anchor: last,
      // the broken face at its end: lit as a face, darkened among its fibre ends
      tuft: (q) => (q === NP ? 0.65 : 0.25 + 0.2 * pt(q)),
      face: (q) => (q === NP ? 1 : q === NP - 1 ? 0.35 : 0),
      ...extra,
    });
    // its fibres going on out of its end: a brush a little wider than it, fanning out, the
    // fibres crimped, of uneven lengths, a few strays beyond the rest curling off on their
    // own; and some loose ones along it, pulled out of it by the break. (Drawn from their own random numbers, so the rest is drawn as it
    // was: `r` moved on as far as it used to go here.)
    for (let k = 0; k < FIBRE_DRAWS; k++) r();
    const { N: fN, B: fB } = frames(ply);
    for (let f = 0; f < 50; f++) {
      const along = f < 40, stray = along && rf() < 0.1;
      const q = along ? Math.min(NP - 1, Math.round(NP * (0.45 + 0.55 * Math.pow(rf(), 0.6)))) : Math.floor(rf() * NP * 0.8);
      const fa = rf() * Math.PI * 2, fr = Math.sqrt(rf()) * pr[q] * 0.95;
      const fo2 = fN[q].clone().multiplyScalar(Math.cos(fa)).addScaledVector(fB[q], Math.sin(fa));
      const froot = ply[q].clone().addScaledVector(fo2, along ? fr : pr[q] * 0.95);
      const fdir = ply[Math.min(NP, q + 1)].clone().sub(ply[Math.max(0, q - 1)]).normalize();
      const d = along
        ? fdir.addScaledVector(fo2, 0.08 + 0.4 * (fr / PR) * rf() + (stray ? 0.3 * rf() : 0)).add(jitter(rf, w, 0.2))
        : fdir.addScaledVector(fo2, 0.6 + 0.5 * rf()).add(jitter(rf, w, 0.7));
      const c = jitter(rf, new THREE.Vector3(), stray ? 5 : 3).addScaledVector(fo2, 1.3 * rf());
      const fl = stray ? 0.14 + 0.1 * rf() : along ? 0.055 + 0.1 * Math.pow(rf(), 1.1) : 0.02 + 0.045 * rf();
      const fp = wavyPath(froot, d, fl, c, stray ? 12 : 9, rf, stray ? 0.5 : 0.35);
      tube(fp, taper(fp, 0.0009 + 0.0009 * rf(), 0.75), fo, { R: 3, tw0: rf(), loose: (qq) => 0.2 + qq / 9, anchor: last, tuft: 1, ...common, end: null, ctr: ctrEnd, ...extra });
    }
  }
}

// the outer yarns of a strand giving way one by one before it snaps, each drawn once it has
// broken, in place of its laid yarn: its two pieces, still laid in the strand from its ends,
// sprung back `gap` from the break, loosening out of the lay there and fraying (`yarnPieces`,
// `yarnFibres`)
function yarnBreaks(st, r) {
  const n = 330, pts = [];
  for (let i = 0; i <= n; i++) pts.push(lay(st, -YMAX + (2 * YMAX * i) / n));
  const lines = yarnLines(pts, st.phi);
  const po = buffers(), fo = buffers();
  for (let j = 0; j < 6; j++) {
    const { at, gap, last } = st.yarns[j];
    if (last) continue;
    for (const sigma of [1, -1]) {
      const g = gap[sigma > 0 ? 0 : 1];
      const e = sigma * st.yb + g; // where its end rests (in σy)
      const idx = []; // from the strand's end to there
      for (let i = 0; i <= n; i++) {
        const k = sigma > 0 ? n - i : i;
        if (sigma * pts[k].y < e) break;
        idx.push(k);
      }
      const looseAt = (i) => 1 - smooth(0, 0.3, sigma * pts[idx[i]].y - e);
      const laid = idx.map((k, i) => {
        const away = lines[j][k].clone().sub(pts[k]).normalize();
        return lines[j][k].clone().addScaledVector(away, 0.8 * RY * looseAt(i) ** 2);
      });
      const ce = pts[idx[idx.length - 1]];
      const outward = new THREE.Vector3(ce.x, 0, ce.z).normalize();
      brokenYarn(laid, (i) => pts[idx[i]], ce, looseAt, outward, { pull: g, sig: sigma, end: e }, r, po, fo, { slip: true, extra: { ord: at } });
    }
  }
  return { yarnPieces: toGeometry(po), yarnFibres: toGeometry(fo) };
}

// strand snapped: its two pieces, their yarns unravelling out of the lay at the end
// (`pieces`), and the fibres the yarns fray into (`fibres`)
function snapped(st, r) {
  const po = buffers(), fo = buffers(), w = new THREE.Vector3();
  for (const sigma of [1, -1]) {
    const e = sigma > 0 ? st.top : st.bottom;
    const pull = e - sigma * st.yb; // how far this end springs back from the break
    const n = 250, pts = [];
    for (let i = 0; i <= n; i++) pts.push(piecePoint(st, sigma, e, sigma * (YMAX - (YMAX - e) * Math.pow(i / n, 0.6))));
    const looseAt = (i) => 1 - smooth(0, 0.5, sigma * pts[i].y - e);
    const lines = yarnLines(pts, st.phi, looseAt);
    const tip = pts[n];
    const outward = new THREE.Vector3(tip.x, 0, tip.z).normalize();
    const common = { pull, sig: sigma, end: e };
    lines.forEach((line, j) => {
      // each yarn breaks a little before or after the others and goes on free (see
      // brokenYarn); the outer ones gave way before (their ends already sprung back some way
      // and opened, see yarnBreaks)
      // the yarns break at quite different heights (an even cut would read as a stump), the
      // last one, which broke with the strand, deeper in the brush
      const { last, gap } = st.yarns[j];
      const cut = n - Math.floor((last ? 0.3 + 0.4 * r() : Math.pow(r(), 1.1)) * 60);
      const laid = line.slice(0, cut + 1);
      brokenYarn(laid, (i) => pts[i], pts[cut], looseAt, outward, common, r, po, fo, last ? {} : { extra: { pull: pull - gap[sigma > 0 ? 0 : 1], ord: 0 } });
    });
    // fibres sticking out of the piece just before its end
    for (let f = 0; f < 60; f++) {
      const d0 = 0.02 + 0.35 * Math.pow(r(), 1.8);
      const i = Math.round(n * Math.pow(1 - (d0 / (YMAX - e)), 1 / 0.6));
      const c0 = pts[Math.min(n, i)];
      const t0 = pts[Math.min(n, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const ang = r() * Math.PI * 2;
      const o2 = new THREE.Vector3(c0.x, 0, c0.z).normalize();
      const s2 = t0.clone().cross(o2).normalize();
      const rad = o2.clone().multiplyScalar(Math.cos(ang)).addScaledVector(s2, Math.sin(ang));
      const root = c0.clone().addScaledVector(rad, RHO * 0.98);
      const d = t0.clone().multiplyScalar(0.6).addScaledVector(rad, 0.5 + r()).add(jitter(r, w, 0.6));
      const c = jitter(r, new THREE.Vector3(), 10);
      // (longer and more crimped nearer the end, where the break tore them loose)
      const fp = wavyPath(root, d, 0.04 + 0.14 * r() * (1 - d0) ** 2, c, 9, rf, 0.35);
      tube(fp, taper(fp, 0.0007 + 0.0009 * r(), 0.9), fo, { R: 4, tw0: r(), loose: (q) => 0.3 + q / 8, anchor: root, ctr: c0, tuft: 1, sig: sigma, pull: pull * Math.exp(-d0 / 0.4) });
    }
  }
  return { pieces: toGeometry(po), fibres: toGeometry(fo) };
}

// a light fuzz along the laid rope, away from where it breaks: one geometry per strand that
// snaps, so that it goes with its strand when that is pulled out (σ the side of the break it is
// on); the survivor has its own, as the next level
export function fuzzGeometries() {
  const os = strands.map(() => buffers()), r = rng(3), w = new THREE.Vector3();
  for (let f = 0; f < 900; f++) {
    const st = strands[f % 6];
    const sig = r() < 0.5 ? 1 : -1;
    const y = sig * (1.15 + r() * (YMAX - 1.15));
    const c0 = lay(st, y);
    const out = new THREE.Vector3(c0.x, 0, c0.z).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), (r() - 0.5) * 2.4);
    const root = c0.clone().addScaledVector(out, RHO * 0.98);
    const d = out.clone().add(w.set(r() - 0.5, (r() - 0.5) * 2, r() - 0.5));
    const fp = curlPath(root, d, 0.02 + 0.06 * r(), jitter(r, new THREE.Vector3(), 14), 6);
    if (!st.survivor) tube(fp, taper(fp, 0.0007 + 0.0009 * r(), 0.9), os[f % 6], { R: 4, tw0: r(), loose: (q) => 0.4 + q / 6, ctr: c0, sig });
  }
  return os.map((o, i) => (strands[i].survivor ? null : toGeometry(o)));
}

// (null for the survivor, which is drawn as the next level)
export function strandGeometries() {
  const r = rng(7);
  const ry = rng(8); // (its own, so the rest is drawn as it was)
  return strands.map((st) => (st.survivor ? null : { ...intact(st), strain: strain(st, r), ...snapped(st, r), ...yarnBreaks(st, ry) }));
}

// the survivor as a plain strand laid in its place, for the innermost level
export function survivorGeometry() {
  return intact(strands[SURVIVOR]).plain;
}
