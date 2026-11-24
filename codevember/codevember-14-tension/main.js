// Tension. A rope stretched top to bottom, about to snap: in its middle five of its six
// strands have broken, their ends burst into yarns and fibres, and the last one, untwisted out
// of the lay into the middle, is left holding, taut across the gap. The view zooms in on it, and
// it is the same rope again, a third the size: its own strands strain, neck, their yarns giving
// way one by one, and snap one after the other while its last strand untwists into the middle,
// until that one alone is left holding — and so on forever, it never breaks. Meanwhile the larger
// strands, snapped earlier, are pulled out of the frame one by one along their lay. Whatever holds
// across a gap is taut: thinner there, paler, its grains drawn out, humming like a string, higher
// the more load it takes, plucked by each snap, which jolts the whole view. Each snap creaks
// first, time holding back, then goes, its ends whipping as they spring back, time rushing on.
// The sound slows down and rises forever (a Risset rhythm getting slower, its ticks Shepard
// chords going up), with the snaps' cracks over it.
//   ?t=5      start that many seconds in
//   &T=12     seconds for each ×3 of the zoom (and each halving of the tempo)
//   &still    stopped there
//   &pr=2     a fixed pixel ratio
//   &capture  driven frame by frame, for scripts/tension-video.js
//   &ss=4     (with &capture) drawn that many times finer than it will be shown, its detail
//             fading at the shown pixel (the GIF, scaled down after, without moiré)
//   &snap=1   broken (as by space, silently) that many seconds after it starts
// The cursor plucks the whole rope as it sweeps across it, like a stiff guitar string held
// beyond the frame (see pluck.js).
// Space breaks it for good: everything still holding snaps at once, the halves are flung apart
// out of the frame, the zoom stops and the rhythm with it. Space again starts over with a brand
// new rope, whole, at full size, its strands snapping one by one, before the zoom starts in on
// its last strand and the loop goes on from there.
// Dragging turns the view round the rope, left and right (see orbit.js). The sound comes on
// with the button in the middle, which then sits in the bottom left corner to turn it off and
// on. Keys: p pause, h hide the bar.
import * as THREE from 'three';
import { strandGeometries, fuzzGeometries, survivorGeometry, strands, YARN_LEAD, SURVIVOR, PITCH, BEND, untwistAt, unwoundAt, straightAt, apartAt } from './rope.js';
import { ropeMaterial, setupLights, createLens, pixel, footprint, chain, NL } from './look.js';
import { createSound } from './sound.js';
import { warp, creaks, popLength } from './beat.js';
import { createPluck, L as PLUCK_L } from './pluck.js';
import { createOrbit } from './orbit.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
const T = num('T', 12);
let paused = params.has('still');
let t = num('t', 0);

const renderer = new THREE.WebGLRenderer({ antialias: false });
const PR = Math.min(devicePixelRatio, num('pr', 1.5));
footprint.value = params.has('capture') ? num('ss', 1) : 1;
document.body.prepend(renderer.domElement);

const D = 12; // the camera's distance
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const H = 1.8; // half the height seen at the rope, in the units of the largest rope in view
const camera = new THREE.PerspectiveCamera((2 * Math.atan(H / D) * 180) / Math.PI, 1, 0.3, 600);
camera.position.set(0, 0, D);
const scene = new THREE.Scene();
setupLights(renderer, scene);
const lens = createLens(renderer);

const geos = strandGeometries(), fuzzGeos = fuzzGeometries(), survivorGeo = survivorGeometry();

// the levels seen at once: -1 (ropes 3× the main one) … 7 (well below a pixel), each the
// survivor strand of the one before, laid in it (see t_chain in look.js); each of the other
// strands of each level whole (with the fibres breaking out of it before it snaps) or snapped,
// with its own uniforms
const LO = -1, HI = LO + NL - 1;
const levels = [];
for (let n = LO; n <= HI; n++) {
  const g = new THREE.Group();
  const mats = [];
  // mode: how its outer yarns' own breaking shows on it (see look.js)
  const mesh = (geo, hair, mode = 0) => {
    const m = new THREE.Mesh(geo, ropeMaterial(hair ? 'fibre' : 'strand', n - LO));
    m.frustumCulled = false; // (laid where it is in the shader)
    m.material.userData.snap.uMode.value = mode;
    m.customDepthMaterial = m.material.userData.depth;
    m.castShadow = !hair; // the fibres' shadows would be lost in the soft blur anyway
    m.receiveShadow = !hair; // fine fibres would only catch speckles of their own shadow
    m.userData.fibre = hair;
    mats.push(m.material);
    g.add(m);
    return m;
  };
  const survivor = n === HI ? mesh(survivorGeo, false) : null;
  if (survivor) survivor.material.userData.snap.uStrand.value = SURVIVOR;
  const parts = geos.map((sg, i) => {
    if (!sg) return null;
    const p = {
      fuzz: mesh(fuzzGeos[i], true),
      intact: mesh(sg.yarns, false, 1), plain: mesh(sg.plain, false), strain: mesh(sg.strain, true),
      yarnPieces: mesh(sg.yarnPieces, false, 2), yarnFibres: mesh(sg.yarnFibres, true, 2),
      pieces: mesh(sg.pieces, false, 3), fibres: mesh(sg.fibres, true, 3),
    };
    for (const m of [p.intact, p.plain, p.yarnPieces]) m.material.userData.snap.uYb.value = strands[i].yb;
    for (const m of Object.values(p)) m.material.userData.snap.uStrand.value = i;
    return p;
  });
  g.userData = { n, mats, parts, survivor };
  scene.add(g);
  levels.push(g);
}

const hash = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const easeOutBack = (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
const firstYarn = strands.map((st) => Math.min(...st.yarns.map((y) => y.at)));
// a level at stage x: below 0 whole, past 1 snapped; in between its strands snap one by one,
// each once its outer yarns have given way one by one.
// Once snapped and grown large, each strand's two pieces are pulled out of the frame, along
// their lay, one by one, in the order they snapped (as the next level's strands snap): just
// past stage 2 they are all gone. At stage x the level is 3^(x-1) times the main rope, so OUT
// (in the view's units, past the edge of the frame) is OUT·3^(1-x) in the level's own.
const OUT = 3.2;
const outAt = (st, x) => smooth(1 + st.tau + 0.03, 1 + st.tau + 0.21, x);
// Space breaks the rope for good: the zoom stops where it is, and every strand not yet
// snapped, in every level, the last ones holding with them, goes at once (each a few ms its
// own), so nothing holds across the gap any more; the rope's two halves are flung apart, its
// top up and its bottom down, out of the frame, leaving it empty. `broken`: the stage then (the
// cycle, its count), `since`: the seconds since (the picture's own, stopped while paused).
let broken = null, since = 0;
const LAG = strands.map((st, i) => 0.035 * hash(i, 9));
// each half is shot out of the frame at once, the top up and the bottom down, the energy the
// rope held let go: full speed from the first frame, a little faster still as the rest of it,
// beyond the frame, pulls it in, veering off to one side and turning over as it goes; gone in
// about a third of a second (in the view's units: well past its edge, broken ends, frayed
// yarns and all, then still)
const SPLIT = [1, 0.85]; // how hard each half goes (top, bottom)
const EJECT = 8; // how far each goes in all, past the frame
const VEER = [0.9, -0.7], TURN = [-0.7, 0.55]; // how far each veers off sideways and turns, per unit it goes
const splitAt = (s, a) => Math.min(EJECT, a * (5.5 * s + 6 * s * s)) * Math.min(1, s / 0.012);
// the slack: 0 while it holds, 1 once its tension has gone
const slack = () => (broken ? smooth(0, 0.25, since) : 0);

// The stage at the time t: `cyc` (warped, see beat.js), `f` (unwarped). Before 0 (t from -T,
// a new rope, space again after the break) it is the cycle before the loop, the new rope's own:
// the main rope whole at first, not yet laid in any rope round it, at its full size, the zoom
// held still, its strands snapping one by one as in any other cycle, so that at 0 it is
// exactly where the loop starts (`intro`; `cyc`, `f` then -1…0).
const frac1 = (x) => ((x % 1) + 1) % 1;
function stageAt(t) {
  const f = frac1(t / T), intro = t < 0;
  return { cyc: warp(f, T) - (intro ? 1 : 0), f: f - (intro ? 1 : 0), intro };
}
// in the intro there's no rope round the new one: that level isn't drawn (by the loop's start,
// stage 2 for it, its pieces have all been pulled out of the frame anyway)
const hiddenIn = (g, st) => st.intro && g.userData.n < 0;

// the level's survivor, untwisting into the middle as the others snap (see rope.js), laid
// mirrored (m = -1) or not
// (`fresh`: the stage of the new rope inside it, in the intro: it is laid straight in it, as at
// the loop's start, without its strain, drawn thinner only as its own load comes on)
function setLay(g, x, m, fresh = null) {
  const j = g.userData.n - LO;
  const phi = strands[SURVIVOR].phi, K = (2 * Math.PI) / PITCH;
  chain.uChainA.value[j].set(m > 0 ? phi : Math.PI - phi, m * K, untwistAt(x), m);
  const [up, down] = straightAt((st) => outAt(st, x) ** 2 * OUT * Math.pow(3, 1 - x));
  const w = unwoundAt(x);
  chain.uChainB.value[j].set(up, down, BEND, w);
  // how far its top half has turned, as a whole, beyond the unwound stretch (see t_unwound), the
  // right way round: the halves of the ropes it is laid in turn with it
  chain.uChainS.value[j] = -m * K * (w - Math.min(0.7, w) / 2);
  // drawn in thinner as it takes the load; it eases back once it is the outermost rope's, long
  // gone out of the frame, so that dropping that level at the turn of the cycle (and the
  // thinning it put on everything inside it) changes nothing
  chain.uChainN.value[j] = untwistAt(x) * (1 - smooth(2, 2.9, x)) * (1 - slack());
  // and it shows the strain (paler, its grains drawn out) while the load is new on it, until
  // its own strands take it on and start straining in turn
  chain.uChainW.value[j] = untwistAt(x) * (1 - smooth(1, 1.45, x)) * (1 - slack());
  if (fresh !== null) {
    chain.uChainN.value[j] *= loadAt(fresh);
    chain.uChainW.value[j] = 0;
  }
}
// and its swing across the gap: alone holding, it is taut as a string, so it hums (a fine fast
// whirl, growing as it comes to carry the load), and each snap, of the strands round it or of its
// own strands later, plucks it (a sharp shake ringing down). The tighter it is drawn the higher
// it rings, and the smaller it swings. Sizes in the view's units, at the time t (seconds); `id`
// the level whatever the zoom, for each its own phases.
const JOLT = 0.015; // the view's shake at a snap
const CREAKS = creaks(T), POP = popLength(T); // (see beat.js)
const HUM = 0.0028, PLUCK = 0.06, F = 7; // (Hz, slack)
const pitch = (load) => 1 + 2 * Math.sqrt(load); // (F's multiple under the load)
const plucks = [];
strands.forEach((st, i) => {
  if (i === SURVIVOR) return;
  plucks.push({ at: st.tau, a: 1, i }); // its own, either side of it
  plucks.push({ at: 1 + st.tau, a: 0.6, i: i + 6 }); // its strands', thinner
  // and the strands round it creaking just before they go: small knocks
  CREAKS.forEach((d, q) => plucks.push({ at: st.tau - d, a: 0.12 + 0.05 * q, i: i + 12 + 6 * q }));
});
// the hum's phase, as a function of the level's stage alone (unwarped: s = frac(t/T) + 1 - n,
// the same for a level before and after the turn of the cycle), so that it loops exactly with
// the cycle: the integral of its rising frequency over time, tabulated (a phase of the rising
// frequency times t would sweep wildly)
const loadAt = (x) => (x < 1 ? untwistAt(x) : 1);
const PH0 = -1, PH1 = 3, PHN = 16000;
const humTable = new Float64Array(PHN + 1);
{
  const ds = (PH1 - PH0) / PHN, f = (s) => 2 * Math.PI * F * pitch(loadAt(warp(s, T))) * T;
  for (let i = 1; i <= PHN; i++) humTable[i] = humTable[i - 1] + 0.5 * (f(PH0 + (i - 1) * ds) + f(PH0 + i * ds)) * ds;
}
const humPhaseAt = (s) => {
  const q = Math.min(PHN, Math.max(0, ((s - PH0) / (PH1 - PH0)) * PHN)), i = Math.min(PHN - 1, Math.floor(q));
  return humTable[i] + (humTable[i + 1] - humTable[i]) * (q - i);
};
function setSwing(j, x, s) {
  const C = chain.uChainC.value[j];
  const load = loadAt(x);
  const k = Math.sqrt(load) * (1 - smooth(1.6, 2.1, x)) * Math.pow(3, 1 - x);
  if (k <= 0) return C.set(0, 0, 0, 0);
  const fr = pitch(load);
  const ph = humPhaseAt(s);
  const id = 0; // (the same phases for every level, so that the cycle repeats exactly)
  const hum = (HUM * load) / fr;
  let x1 = hum * Math.sin(ph), z1 = hum * Math.sin(1.013 * ph + 6.28 * hash(id, 2));
  let x2 = 0, z2 = 0;
  for (const p of plucks) {
    const s = (x - p.at) * T;
    if (s < 0 || s > 3) continue;
    const th = 6.28 * hash(id, p.i + 3);
    // ringing at the pitch it had when plucked
    const f = pitch(loadAt(p.at)), wp = 2 * Math.PI * F * f;
    const a1 = (PLUCK * p.a * Math.exp(-s / 0.45) * Math.sin(wp * s)) / f;
    const a2 = (0.4 * PLUCK * p.a * Math.exp(-s / 0.18) * Math.sin(2.1 * wp * s)) / f;
    x1 += a1 * Math.cos(th); z1 += a1 * Math.sin(th);
    x2 += a2 * Math.cos(th + 1); z2 += a2 * Math.sin(th + 1);
  }
  // (broken, nothing is taut any more: it stops humming)
  const kk = k * (1 - slack());
  C.set(kk * x1, kk * z1, kk * x2, kk * z2);
}
// a snapped strand's ends whip across the lay at the break, a little outward too
const WHIP = 0.09;
const whipDir = strands.map((st) => {
  const th = st.phi + ((2 * Math.PI) / PITCH) * st.yb;
  return new THREE.Vector3(-Math.sin(th) * 0.8 + Math.cos(th) * 0.6, 0, Math.cos(th) * 0.8 + Math.sin(th) * 0.6);
});
// Broken for good, the halves' tips are cut about flat across: the ropes inside, a third the
// size each (the survivor of the one round it, and its own survivor, and so on), would each
// snap with their ends a third as far from the break as the one round them, and stick out of
// it in steps, narrower and narrower, like a cone. Instead all their ends are brought to about
// where the outermost rope's ends rest, though not further out than FLAT_MAX, so that the
// tips stay in the frame (`flat`: above, below, in the view's units), each a little off it so
// that it doesn't read as a clean cut.
const flat = [0, 0];
const FLAT_MAX = 0.75;
const endOf = (st, x, k) => {
  const ap = apartAt(x), uo = outAt(st, x) ** 2 * OUT * Math.pow(3, 1 - x);
  return [st.top + uo + st.apart[0] * ap, st.bottom + uo + st.apart[1] * ap][k];
};
function setFlat(cyc, stage) {
  flat[0] = flat[1] = 0;
  if (!broken) return;
  // the outermost level with strands snapped before the break and not yet being pulled out
  for (const g of levels) {
    if (hiddenIn(g, stage)) continue;
    const x = cyc + 1 - g.userData.n, sc = Math.pow(3, x - 1);
    const ends = x < 2 ? strands.filter((st) => !st.survivor && x >= st.tau && outAt(st, x) < 0.02) : [];
    if (!ends.length) continue;
    for (let k = 0; k < 2; k++) flat[k] = Math.min(FLAT_MAX, (sc * ends.reduce((a, st) => a + endOf(st, x, k), 0)) / ends.length);
    return;
  }
}
function setStage(g, x, sc) {
  const near = sc > 1 / 14; // strands big enough to show their yarns
  g.userData.parts.forEach((p, i) => {
    if (!p) return;
    const { tau } = strands[i];
    // (its own stage, as far as its snapping goes: once the rope has broken for good, snapped then)
    const xs = broken && since >= LAG[i] ? Math.max(x, tau + (since - LAG[i]) / T) : x;
    const strain = smooth(tau - 0.2, tau, xs);
    const snapped = xs >= tau;
    const k = Math.min(1, (xs - tau) / 0.03);
    p.intact.visible = !snapped && near;
    p.plain.visible = !snapped && !near;
    p.strain.visible = !snapped && strain > 0;
    const cut = xs - (tau - YARN_LEAD);
    p.yarnPieces.visible = p.yarnFibres.visible = !snapped && near && cut >= firstYarn[i];
    for (const m of [p.intact, p.yarnPieces, p.yarnFibres]) m.material.userData.snap.uCut.value = cut;
    p.intact.material.userData.snap.uUntw.value = strands[i].yarnUntwist(cut);
    p.yarnPieces.material.userData.snap.uNeck.value = strain;
    const o = outAt(strands[i], x);
    const gone = o >= 1;
    p.pieces.visible = p.fibres.visible = snapped && !gone;
    p.fuzz.visible = !gone;
    for (const m of [p.pieces, p.fibres, p.fuzz]) m.material.userData.snap.uOut.value = o * o * OUT * Math.pow(3, 1 - x);
    // drawn further apart as the survivor comes in (see rope.js), once it has sprung back
    const ap = apartAt(x) * (snapped ? Math.min(1, k) : 0);
    // (broken for good, drawn back as far as the outermost rope's ends: see `flat`)
    const fl = [0, 1].map((q) => {
      // (not those already being pulled out of the frame)
      if (!broken || !snapped || !flat[q] || o > 0.02) return 0;
      const want = (flat[q] / sc) * (1 + 0.16 * (hash(i + 7 * q, g.userData.n) - 0.5));
      return (want - endOf(strands[i], x, q)) * easeOutBack(k) * smooth(0, 0.04, since);
    });
    for (const m of [p.pieces, p.fibres, p.fuzz]) m.material.userData.snap.uApart.value.set(strands[i].apart[0] * ap + fl[0], strands[i].apart[1] * ap + fl[1]);
    // where its two pieces end now, for the strands still there to close up between them (see
    // t_ring in look.js)
    {
      const { yb, top, bottom, apart } = strands[i];
      const rec = snapped ? easeOutBack(k) : 0, uo = o * o * OUT * Math.pow(3, 1 - x);
      chain.uRing.value[6 * (g.userData.n - LO) + i].set(snapped ? 1 : 0, yb + (top - yb) * rec + uo + apart[0] * ap + fl[0], -yb + (bottom + yb) * rec + uo + apart[1] * ap + fl[1]);
    }
    p.intact.material.userData.snap.uNeck.value = p.plain.material.userData.snap.uNeck.value = strain;
    // the fibres breaking out of it come out steadily, then, as it creaks, in a few pops
    let spread = 0.6 * smooth(tau - 0.2, tau - CREAKS[0], xs);
    for (const d of CREAKS) spread += 0.1 * smooth(tau - d, tau - d + POP, xs);
    p.strain.material.userData.snap.uSpread.value = spread;
    if (snapped) {
      const rec = easeOutBack(k), spread = 0.1 + 0.9 * Math.sqrt(k);
      // the energy it held let go: its ends lash sideways, ringing down in a few swings
      const sw = (xs - tau) * T;
      const whip = sw > 2 ? 0 : WHIP * Math.sin(2 * Math.PI * 3.2 * sw) * Math.exp(-sw / 0.22) * Math.min(1, sw / 0.015);
      for (const m of [p.pieces, p.fibres]) {
        m.material.userData.snap.uRecoil.value = rec;
        m.material.userData.snap.uSpread.value = spread;
        m.material.userData.snap.uWhip.value.copy(whipDir[i]).multiplyScalar(whip);
      }
    }
  });
}

// ---------- sound ----------
const sound = createSound(T);
const info = document.getElementById('info');
// the sound's button: in the middle at first, then, once the sound has been on, in the bar's
// corner, on or muted
const soundButton = document.getElementById('sound');
const showInfo = () => {
  info.textContent = paused ? 'paused' : broken ? 'broken' : '';
  if (sound.on) soundButton.classList.add('corner');
  const corner = soundButton.classList.contains('corner');
  document.body.classList.toggle('corner', corner);
  soundButton.classList.toggle('muted', !sound.on);
  soundButton.setAttribute('aria-label', sound.on ? 'sound off' : 'sound on');
};
async function toggleSound() {
  await sound.toggle(t);
  showInfo();
}
soundButton.addEventListener('click', () => {
  soundButton.blur(); // (so that space breaks the rope rather than pressing it again)
  // (to the corner at once, not once the sound has started)
  soundButton.classList.add('corner');
  document.body.classList.add('corner');
  toggleSound();
});
const pluck = createPluck();
pluck.attach(renderer.domElement, H);
const orbit = createOrbit(renderer.domElement);
// the view's shake, in the view's units (right, up)
const shake = { x: 0, y: 0 };
chain.uPluckL.value = PLUCK_L;
renderer.domElement.style.touchAction = 'none';
// (once: broken, it stays broken)
function snapNow() {
  broken = stageAt(t);
  since = 0;
  pluck.slacken();
  showInfo();
}
async function breakRope() {
  if (broken) return;
  snapNow();
  await sound.breakForGood(t);
  showInfo();
}
// broken, space again: a new rope in its place, brand new, whole, its own cycle before the loop
// (see stageAt), the rhythm starting over with it; the old one's halves gone with whatever was
// left of their flight
async function newRope() {
  if (!broken) return;
  broken = null;
  since = 0;
  t = -T;
  paused = false; // (a fresh start, the sound with it)
  pluck.renew();
  showInfo();
  await sound.renew(t);
  showInfo();
}
// (&snap: only the first rope, once)
let SNAP = params.has('snap') ? num('snap', 0) : null;
addEventListener('keydown', (e) => {
  if (e.key === ' ') { e.preventDefault(); if (!e.repeat) (broken ? newRope() : breakRope()); }
  else if (e.key === 'p') { paused = !paused; sound.pause(paused); showInfo(); }
  else if (e.key === 'h') {
    document.getElementById('bar').classList.toggle('hidden');
    document.body.classList.toggle('hide');
  }
});
showInfo();

function resize() {
  renderer.setPixelRatio(PR);
  renderer.setSize(innerWidth, innerHeight);
  lens.setSize(innerWidth, innerHeight, PR);
  pixel.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / (innerHeight * PR) * footprint.value;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function frame(now) {
  const last0 = last, dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!paused && broken) since += dt;
  if (SNAP !== null && !broken && now / 1000 >= SNAP) { SNAP = null; snapNow(); }
  if (!paused) {
    // the picture's time runs on the frames' own clock, smooth, and only leans towards the sound's
    // while it plays: the audio clock moves on in steps (a buffer at a time, tens of ms on some
    // systems) and would make the zoom lurch forward. Far ahead (the tab was hidden while the
    // sound went on) it catches up at once; behind (the sound held up) it waits, never going back.
    const err = sound.running ? sound.time() - t : 0;
    t += err > 1 ? err : Math.max(0, dt + err * Math.min(1, dt / 0.6));
  }
  // (the plucking runs on the frames' own clock, whatever the picture's time: see pluck.js)
  orbit.update(Math.min(0.05, (now - last0) / 1000));
  // its modes are across the view and towards it (x, z): turned with the view into the world's
  const ca = Math.cos(orbit.angle), sa = Math.sin(orbit.angle);
  const modes = pluck.update(Math.min(0.05, (now - last0) / 1000), shake);
  for (let q = 0; q < modes.length; q += 2) {
    const a = modes[q], b = modes[q + 1], P = chain.uPluck.value[q >> 2], o = q & 3;
    P.setComponent(o, a * ca + b * sa);
    P.setComponent(o + 1, -a * sa + b * ca);
  }
  renderer.domElement.style.cursor = pluck.holding || orbit.dragging ? 'grabbing' : 'grab';
  draw(t, now / 1000);
  requestAnimationFrame(frame);
}
// the picture at the time t, a pure function of it (but for the grain, moving on with `grain`,
// and the break, once clicked)
function draw(t, grain) {
  // (time holding before each snap and rushing after it, see beat.js)
  // (broken, it stays where it was)
  const stage = broken || stageAt(t);
  const { cyc, f } = stage;
  const zoom = stage.intro ? 1 : 3 ** cyc;
  // each level laid the same way as the one before, so that their halves all spin the same way
  // round as each takes over from the one before (m = -1 would lay one the other way)
  setFlat(cyc, stage);
  for (const g of levels) {
    const sc = zoom * Math.pow(3, -g.userData.n);
    const m = 1;
    g.scale.set(m * sc, sc, sc);
    const x = cyc + 1 - g.userData.n;
    // (in the intro, the rope round the new one isn't drawn, though it still lays it, straight
    // through, as at the loop's start)
    const ghost = hiddenIn(g, stage);
    setLay(g, ghost ? 2 : x, m, ghost ? cyc + 1 : null);
    setSwing(g.userData.n - LO, x, f + 1 - g.userData.n);
    if (ghost) {
      setStage(g, 2, sc);
      g.visible = false;
      continue;
    }
    // nothing to draw once a level is below a pixel; its fibres go well before
    g.visible = sc > 1 / 400;
    if (g.userData.survivor) g.userData.survivor.visible = !broken;
    for (const m of g.children) if (m.userData.fibre) m.material.visible = sc > 1 / 60;
    setStage(g, x, sc);
  }
  // broken, the halves are flung apart, out of the frame
  {
    const d = SPLIT.map((a) => (broken ? splitAt(since, a) : 0));
    chain.uSplit.value.set(d[0], d[1]);
    chain.uSplitX.value.set(VEER[0] * d[0] * 0.4, VEER[1] * d[1] * 0.4);
    chain.uSplitR.value.set(TURN[0] * d[0] * 0.4, TURN[1] * d[1] * 0.4);
  }
  // each snap jolts the whole rope as the load jumps onto what's left: a short sharp shake
  let jx = 0, jy = 0;
  for (const st of strands) {
    if (st.survivor) continue;
    const s = (cyc - st.tau + 1) % 1 * T; // (seconds since it snapped, in the level snapping now)
    if (s < 0 || s > 1) continue; // (in the intro, none before the new rope's own)
    const e = JOLT * Math.exp(-s / 0.14) * Math.min(1, s / 0.01);
    jx += e * 0.4 * Math.sin(2 * Math.PI * 11 * s + st.phi);
    jy += e * Math.sin(2 * Math.PI * 8 * s);
    // and a faint knock at each creak before it
    for (const d of CREAKS) {
      const sc = (cyc - st.tau + d + 1) % 1 * T;
      if (sc < 0 || sc > 0.25) continue;
      const ec = 0.18 * JOLT * Math.exp(-sc / 0.05) * Math.min(1, sc / 0.006);
      jx += ec * 0.5 * Math.sin(2 * Math.PI * 17 * sc + st.phi + d * 40);
      jy += ec * Math.sin(2 * Math.PI * 13 * sc);
    }
  }
  // (the stage stopped, the shake it was in fades), and the break itself jolts it hard
  if (broken) {
    const fade = 1 - smooth(0, 0.2, since), e = 3 * JOLT * Math.exp(-since / 0.18) * Math.min(1, since / 0.01);
    jx = jx * fade + e * 0.5 * Math.sin(2 * Math.PI * 9 * since + 1);
    jy = jy * fade + e * Math.sin(2 * Math.PI * 7 * since);
  }
  // the view turned round the rope (see orbit.js), shaken across itself
  shake.x = jx; shake.y = jy;
  const a = params.has('capture') ? 0 : orbit.angle, ca = Math.cos(a), sa = Math.sin(a);
  camera.position.set(D * sa + jx * ca, jy, D * ca - jx * sa);
  camera.quaternion.setFromAxisAngle(Y_AXIS, a);
  lens.render(scene, camera, grain);
}
// ?capture (scripts/tension-video.js): no clock of its own, no bar; tension.capture(t) draws
// the picture at t (resolving once it is on screen; its grain held still at `grain` if given), tension.sound(seconds) renders the sound
// offline (see sound.js)
if (params.has('capture')) {
  document.getElementById('bar').remove();
  soundButton.remove();
  window.tension = {
    T,
    capture: (tt, grain = tt) => new Promise((ok) => { draw(tt, grain); requestAnimationFrame(() => requestAnimationFrame(ok)); }),
    sound: (seconds) => sound.offline(seconds),
  };
} else requestAnimationFrame(frame);
