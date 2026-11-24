// The works round the cage, now that it is open: no plates over and under the
// gears, only two skeleton bridges (a rim on the pillars, arms in to a
// bearing round the sleeves, and cocks out to the arbors), so the lamp falls
// straight into the machinery.
//  - takeoffs: on three of the central wheels, an arbor at the side of the
//    cage meshes with it, and through a pinion turns a second, outer wheel;
//    each arbor carries a little dial on top, its hand going round.
//  - the motion work on the top bridge (deck.js): from each takeoff arbor and
//    from the pinion shaft, a branch of wheels and pinions on two levels
//    going round into the gap before the next, ending in a dial.
//  - the drive, under the bottom bridge: a wheel on the pinion shaft, an
//    intermediate wheel and pinion, a great wheel with the crank, and a
//    heavy spoked flywheel at the foot of the shaft.
// Every wheel here really meshes: each turns from the one driving it, by
// its teeth, and is set so that a tooth goes into a gap.
import * as THREE from 'three';
import { CAGE_LO, CAGE_HI, D, gearGeometry, lathe, rod, mesh } from './orrery.js';
import { TAKEOFF, SHAFT, place } from './deck.js';

const PITCH = 0.034;
const TAU = Math.PI * 2;
const RIM_R = 0.76; // the pillars
const TAKE_R = 0.47; // the takeoff arbors, clear of every central wheel
const TAKE_AT = [100, 180, 260].map((d) => (d * Math.PI) / 180); // clear of the shaft (at 0)
const PIN_N = 9, OUT_N = 24; // the second stage of each takeoff
const DECK_T = 0.016;

const pitchR = (n) => (n * PITCH) / TAU;
const at = (r, phi, y = 0) => new THREE.Vector3(Math.cos(phi) * r, y, Math.sin(phi) * r);

// A gear's teeth, as gearGeometry cuts them: the shape's angle b lies at
// world angle b - rot (x = cos, z = sin), tooth centres at (i + 0.46)·step.
// For B driven by A (rotations rot_B = -rot_A·nA/nB + P), the P that puts a
// tooth of one into a gap of the other along the line between their centres.
function meshPhase(cA, nA, cB, nB) {
  const phi = Math.atan2(cB.z - cA.z, cB.x - cA.x);
  const sA = TAU / nA, sB = TAU / nB;
  return sB * (1.42 - phi / sA) - (phi + Math.PI);
}

export function buildWorks(group, M, shaft) {
  // the deck, over the top bridge: two levels of wheels (their tops), and
  // the dials over them; the lowest arm passes just above
  const DECK_Y = [CAGE_HI + 0.015, CAGE_HI + 0.035];
  const DECK_TOP = DECK_Y[1];
  const DIAL_Y = CAGE_HI + 0.055;
  const followers = []; // { obj, src, ratio, P }: obj.rotation.y = -src.rotation.y · ratio + P
  const follow = (obj, src, cA, nA, cB, nB) => followers.push({ obj, src, ratio: nA / nB, P: meshPhase(cA, nA, cB, nB) });

  // where the drive's arbors stand (under the bottom bridge)
  const cS = at(D, 0);
  const n1 = 22, n2 = 36, n3 = 11, n4 = 34;
  const c2 = cS.clone().add(at(pitchR(n1) + pitchR(n2), 1.2));
  const c3 = c2.clone().add(at(pitchR(n3) + pitchR(n4), 2.05));

  // ---- two open bridges, over and under the cage, in place of its plates:
  // a rim on the pillars, arms in to a bearing round the sleeves (or the
  // column), one to the pinion shaft, and cocks to the other arbors
  const yT = CAGE_HI - 0.015, yL = CAGE_LO - 0.015;
  const bar = (r0, r1, phi, y, w = 0.034, h = 0.022) => {
    const b = mesh(new THREE.BoxGeometry(r1 - r0, h, w), M.brass);
    b.position.copy(at((r0 + r1) / 2, phi, y));
    b.rotation.y = -phi;
    group.add(b);
    return b;
  };
  const bearing = (p, r = 0.024) => {
    const o = mesh(lathe([[0.006, -0.016], [r, -0.016], [r + 0.006, 0], [r, 0.016], [0.006, 0.016]], 20), M.brassDark);
    o.position.copy(p);
    group.add(o);
  };
  const pillarAt = (k) => (k / 4) * TAU + Math.PI / 4;
  function bridge(y, below) {
    const rim = mesh(new THREE.TorusGeometry(RIM_R, 0.018, 10, 120), M.brass);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = y;
    rim.scale.z = 0.8;
    group.add(rim);
    group.add(mesh(lathe([[0.125, y - 0.022], [0.17, y - 0.022], [0.178, y], [0.17, y + 0.018], [0.125, y + 0.018]], 48), M.brass));
    for (let k = 0; k < 4; k++) bar(0.165, RIM_R, pillarAt(k), y);
    bar(0.165, D, 0, y, 0.026);
    bearing(at(D, 0, y));
    for (const phi of TAKE_AT) bar(TAKE_R - 0.02, RIM_R, phi, y, 0.026, 0.018);
    // finials on the pillars, up from the top one and down from the bottom
    for (let k = 0; k < 4; k++) {
      const f = mesh(lathe([[0, 0], [0.03, 0], [0.034, 0.02], [0.018, 0.04], [0.026, 0.07], [0.008, 0.1], [0, 0.11]], 16), M.brass);
      f.position.copy(at(RIM_R, pillarAt(k), y));
      f.scale.y = below ? -0.7 : 0.8; // (the lowest arm passes just over the top ones)
      group.add(f);
    }
  }
  bridge(yT, false);
  bridge(yL, true);
  // the pinion shaft's own branch on the deck, built once
  deck(SHAFT, shaft, cS, 0, group, []);
  // under the bottom one, arms out to the drive's arbors
  for (const c of [c2, c3]) {
    const phi = Math.atan2(c.z, c.x), r = Math.hypot(c.x, c.z);
    bar(0.165, Math.min(r + 0.03, RIM_R), phi, yL, 0.026, 0.018);
  }

  // ---- the takeoffs, rebuilt whenever the central wheels are
  const takeGroup = new THREE.Group();
  group.add(takeGroup);
  let takeFollowers = [];
  // wheels: [{ R, teeth, gy, src }] the central wheels (src: what turns them)
  function takeoffs(wheels) {
    takeGroup.traverse((o) => { if (o.isMesh && o.userData.own) o.geometry.dispose(); });
    takeGroup.clear();
    for (const f of takeFollowers) followers.splice(followers.indexOf(f), 1);
    takeFollowers = [];
    // the three biggest (their takeoff wheels the smallest), lowest first
    const chosen = wheels.filter((w) => w.R < TAKE_R - 0.12).sort((a, b) => b.R - a.R).slice(0, 3).sort((a, b) => a.gy - b.gy);
    chosen.forEach((w, k) => {
      const phi = TAKE_AT[k];
      const n = Math.max(12, Math.round((TAU * (TAKE_R - w.R)) / PITCH));
      const rs = pitchR(n);
      const c = at(w.R + rs, phi);
      const arbor = new THREE.Group();
      arbor.position.copy(c);
      takeGroup.add(arbor);
      const own = (m) => { m.userData.own = true; arbor.add(m); return m; };
      const g = own(mesh(gearGeometry(rs, 0.02, { teeth: n, spokes: rs > 0.12 ? 5 : 0, hole: 0.008 }).geometry, k % 2 ? M.brassDark : M.brass));
      g.position.y = w.gy;
      const pin = own(mesh(gearGeometry(pitchR(PIN_N), 0.02, { teeth: PIN_N, hole: 0.008 }).geometry, M.steel));
      pin.position.y = w.gy + 0.036;
      const pole = own(mesh(rod(0.008, DECK_TOP + 0.012 - CAGE_LO, 8), M.steel));
      pole.position.y = (DECK_TOP + 0.012 + CAGE_LO) / 2;
      const cap = own(mesh(new THREE.SphereGeometry(0.013, 10, 8), M.brass));
      cap.position.y = DECK_TOP + 0.012;
      const f1 = { obj: arbor, src: w.src, ratio: w.teeth / n, P: meshPhase(new THREE.Vector3(), w.teeth, c, n) };
      takeFollowers.push(f1);
      followers.push(f1);
      deck(TAKEOFF, arbor, c, phi, takeGroup, takeFollowers);
      // the outer wheel, straight out from it
      const ro = pitchR(OUT_N);
      const c2 = at(w.R + rs + pitchR(PIN_N) + ro, phi);
      const outer = new THREE.Group();
      outer.position.copy(c2);
      takeGroup.add(outer);
      const own2 = (m) => { m.userData.own = true; outer.add(m); return m; };
      const g2 = own2(mesh(gearGeometry(ro, 0.02, { teeth: OUT_N, spokes: 4, hole: 0.008 }).geometry, M.brassDark));
      g2.position.y = w.gy + 0.036;
      const pole2 = own2(mesh(rod(0.008, DIAL_Y - CAGE_LO, 8), M.steel));
      pole2.position.y = (DIAL_Y + CAGE_LO) / 2;
      dial(own2, DIAL_Y, 0.07);
      const f2 = { obj: outer, src: arbor, ratio: PIN_N / OUT_N, P: meshPhase(c, PIN_N, c2, OUT_N) };
      takeFollowers.push(f2);
      followers.push(f2);
    });
  }
  // the motion work on the deck, from a root arbor (its group `rootObj`,
  // centred at c0, at angle phi round the machine): the root's pinions in
  // its own group, every other arbor a stud standing on a cock out to the rim
  function deck(spec, rootObj, c0, phi, parent, list) {
    const { roots, gears } = place(spec, [c0.x, c0.z], phi);
    const mk = (g, k) => mesh(gearGeometry(pitchR(g.n), DECK_T, {
      teeth: g.n, hole: 0.006, spokes: g.n >= 24 ? 5 : g.n >= 15 ? 4 : 0, bend: g.n >= 24 ? 0.4 : 0,
    }).geometry, g.n < 13 ? M.steel : k % 2 ? M.brassDark : M.brass);
    const rootGears = roots.map((g, q) => {
      const m = mk(g, q);
      m.position.y = DECK_Y[g.level];
      m.userData.own = true;
      rootObj.add(m);
      return { obj: rootObj, c: c0, n: g.n };
    });
    const made = [];
    const tops = new Map(); // each stud's group → the height it stands to
    const rise = (obj, y) => tops.set(obj, Math.max(tops.get(obj) || 0, y));
    gears.forEach((g, i) => {
      let node;
      if (g.on !== undefined) node = { obj: made[g.on].obj, c: made[g.on].c, n: g.n };
      else {
        const c = new THREE.Vector3(g.c[0], 0, g.c[1]);
        const obj = new THREE.Group();
        obj.position.copy(c);
        parent.add(obj);
        node = { obj, c, n: g.n };
        const drv = g.from < 0 ? rootGears[-g.from - 1] : made[g.from];
        const f = { obj, src: drv.obj, ratio: drv.n / g.n, P: meshPhase(drv.c, drv.n, c, g.n) };
        list.push(f);
        followers.push(f);
        // its cock, out to the rim, and the foot of the stud on it
        const r = Math.hypot(c.x, c.z), a = Math.atan2(c.z, c.x);
        const b = mesh(new THREE.BoxGeometry(RIM_R - r + 0.01, 0.014, 0.022), M.brass);
        b.position.copy(at((RIM_R + r) / 2, a, yT + 0.004));
        b.rotation.y = -a;
        b.userData.own = true;
        parent.add(b);
        const foot = mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.01, 16), M.brassDark);
        foot.position.set(c.x, yT + 0.014, c.z);
        foot.userData.own = true;
        parent.add(foot);
      }
      const m = mk(g, i);
      m.position.y = DECK_Y[g.level];
      m.userData.own = true;
      node.obj.add(m);
      rise(node.obj, DECK_Y[g.level]);
      if (g.dial) {
        dial((o) => { o.userData.own = true; node.obj.add(o); return o; }, DIAL_Y, g.dial);
        rise(node.obj, DIAL_Y);
      }
      made[i] = node;
    });
    for (const [obj, top] of tops) {
      const st = mesh(rod(0.006, top + 0.008 - yT, 8), M.steel);
      st.position.y = (top + 0.008 + yT) / 2;
      st.userData.own = true;
      obj.add(st);
    }
  }

  // a little dial over the bridge: a silvered face and a hand going round
  function dial(own, y, r) {
    const face = own(mesh(lathe([[0.008, -0.006], [r, -0.006], [r + 0.006, 0.002], [r, 0.008], [0.008, 0.008]], 32), M.steel));
    face.position.y = y;
    const hand = own(mesh(new THREE.BoxGeometry(r * 0.95, 0.006, 0.01).translate(r * 0.42, 0, 0), M.iron));
    hand.position.y = y + 0.014;
    const cap = own(mesh(new THREE.SphereGeometry(0.008, 10, 8), M.brass));
    cap.position.y = y + 0.016;
  }

  // ---- the drive, under the bottom bridge
  const yA = CAGE_LO - 0.05, yB = CAGE_LO - 0.1; // the two levels of wheels
  const drop = (c, y0, y1) => { // an arbor hanging from the bridge
    const r = mesh(rod(0.01, y0 - y1, 10), M.steel);
    r.position.set(c.x, (y0 + y1) / 2, c.z);
    group.add(r);
    bearing(new THREE.Vector3(c.x, y0 - 0.006, c.z), 0.026);
  };
  // on the shaft
  const g1 = mesh(gearGeometry(pitchR(n1), 0.024, { teeth: n1, hole: 0.012 }).geometry, M.brass);
  g1.position.y = yA;
  shaft.add(g1);
  // the intermediate wheel and its pinion
  const w2 = new THREE.Group();
  w2.position.copy(c2);
  group.add(w2);
  const g2 = mesh(gearGeometry(pitchR(n2), 0.024, { teeth: n2, spokes: 5, hole: 0.012 }).geometry, M.brassDark);
  g2.position.y = yA;
  w2.add(g2);
  const p3 = mesh(gearGeometry(pitchR(n3), 0.026, { teeth: n3, hole: 0.012 }).geometry, M.steel);
  p3.position.y = yB;
  w2.add(p3);
  drop(c2, yL - 0.01, yB - 0.04);
  follow(w2, shaft, cS, n1, c2, n2);
  // the great wheel, with the crank under it
  const w3 = new THREE.Group();
  w3.position.copy(c3);
  group.add(w3);
  const g3 = mesh(gearGeometry(pitchR(n4), 0.024, { teeth: n4, spokes: 6, bend: 0.35, hole: 0.012 }).geometry, M.brass);
  g3.position.y = yB;
  w3.add(g3);
  drop(c3, yL - 0.01, yB - 0.06);
  const crank = mesh(new THREE.BoxGeometry(0.16, 0.014, 0.026).translate(0.07, 0, 0), M.brass);
  crank.position.y = yB - 0.05;
  w3.add(crank);
  const knob = mesh(lathe([[0, 0], [0.018, 0], [0.012, 0.03], [0.02, 0.06], [0.012, 0.09], [0, 0.09]], 16), M.iron);
  knob.position.set(0.14, yB - 0.055, 0);
  knob.rotation.x = Math.PI;
  w3.add(knob);
  followers.push({ obj: w3, src: w2, ratio: n3 / n4, P: meshPhase(c2, n3, c3, n4) });
  // the flywheel at the foot of the shaft: a heavy rim on spokes
  const fly = new THREE.Group();
  fly.position.y = yB - 0.035;
  shaft.add(fly);
  const flyR = 0.15;
  const flyRim = mesh(lathe([[flyR - 0.022, -0.02], [flyR, -0.02], [flyR + 0.006, 0], [flyR, 0.02], [flyR - 0.022, 0.02]], 48), M.iron);
  fly.add(flyRim);
  for (let k = 0; k < 6; k++) {
    const s = mesh(new THREE.BoxGeometry(flyR - 0.03, 0.008, 0.012).translate((flyR - 0.03) / 2 + 0.01, 0, 0), M.brassDark);
    s.rotation.y = (k / 6) * TAU;
    fly.add(s);
  }
  fly.add(mesh(lathe([[0.012, -0.022], [0.028, -0.022], [0.032, 0], [0.028, 0.022], [0.012, 0.022]], 20), M.brass));

  // the source's angle unwound, so that a wheel driven by an arm whose angle
  // wraps at ±π (the geocentric ones) goes on turning smoothly
  function update() {
    for (const f of followers) {
      const a = f.src.rotation.y;
      if (f.acc === undefined) f.acc = a;
      else {
        let d = a - f.prev;
        d -= TAU * Math.round(d / TAU);
        f.acc += d;
      }
      f.prev = a;
      // driven by a planet's arm: its wheel turns faster than it, by the wheel's own turn on the arm
      const turn = f.acc + (f.src.userData.gear?.rotation.y ?? 0);
      f.obj.rotation.y = -turn * f.ratio + f.P;
    }
  }
  return { takeoffs, update };
}
