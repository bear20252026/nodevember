// The geocentric orrery: the same brass machine, but the world as Ptolemy
// built it — or as anyone would build it from wherever they stood. Whichever
// body is at the centre sits still on the spindle (the Sun to begin with);
// every other one is carried round on an arm (its deferent) with, at the end,
// a wheel turning at its own rate (its epicycle), so that, seen from the
// centre, it runs ahead, stops, turns back and runs on again.
// Each body's motion is the sum of two turning radii: its own round the Sun,
// and the centre's round the Sun turned back the other way. The longer one
// is the deferent, the shorter the epicycle; seen from the Sun, there are no
// epicycles at all, only circles.
// The path each body traces about the centre is laid out as a wire of brass
// in the plane of the planets — a rosette of loops — and a glow runs along
// the wire behind the body. Click on a body to put it at the centre.
// The change is animated: the centre glides from the old body to the new
// one, and every path is drawn about that moving point — the sum of up to
// three turning radii — so the rosettes unwind and wind up again into their
// new shapes, the arms lengthening and shortening to follow. The tubes are
// rebuilt on the CPU each frame, but only while the change lasts.
// The rates are whole numbers of turns in twenty-four years (Uranus makes
// one), so every path closes.
// The orbits can tilt (T), each out of the plane by the same inclination as
// in the heliocentric machine: a body's height is its own over the Sun's
// plane less the centre's, so the paths become loops in space, the bodies
// ride up and down their rods, and the epicycles' hoops lean.
import * as THREE from 'three';
import { planetTextures, ringTexture, surface } from './textures.js';
import { createSun } from './sun.js';
import { createGalaxy } from './galaxy.js';
import { asteroidBelt, pickBody } from './orrery.js';
import { buildWorks } from './works.js';
import {
  PLANE_Y, INCL, DEG, CAGE_LO, CAGE_HI, D as D_SHAFT, W_SHAFT, GEAR_K, gearRate, YEAR,
  materials, buildFrame, buildZodiac, gearGeometry, lathe, rod, mesh, satellite, saturnRing,
  collarGeo, collarScale, seatGeometry,
} from './orrery.js';

const PITCH = 0.034;
const TAU = Math.PI * 2;
const CYCLE = 24; // years: every body makes a whole number of turns in it

// r: the radius round the Sun; n: turns round the Sun in CYCLE years
export const BODIES = {
  sun: { r: 0, n: 0, phase: 0, size: 0.27, label: 'the Sun' },
  mercury: { r: 0.62, n: 88, phase: 2.9, size: 0.075, tilt: 0.0, spin: 0.6, label: 'Mercury' },
  venus: { r: 0.92, n: 38, phase: 5.0, size: 0.115, tilt: 0.05, spin: -0.3, label: 'Venus' },
  earth: { r: 1.28, n: 24, phase: 0.4 + Math.PI, size: 0.13, tilt: 0.41, spin: 4, label: 'the Earth' },
  mars: { r: 1.66, n: 14, phase: 3.7, size: 0.1, tilt: 0.44, spin: 3.8, label: 'Mars' },
  jupiter: { r: 2.3, n: 4, phase: 1.6, size: 0.27, tilt: 0.05, spin: 1.6, label: 'Jupiter' },
  saturn: { r: 3.0, n: 2, phase: 5.8, size: 0.22, tilt: 0.47, spin: 1.4, label: 'Saturn' },
  uranus: { r: 3.6, n: 1, phase: 4.3, size: 0.15, tilt: 1.71, spin: -2.2, label: 'Uranus' },
};
// the asteroids: a ring of stones round the Sun, wherever the Sun is carried;
// not a centre one can stand on
const BELT = { r: 1.93, n: 6, phase: 0.9 };

const TRANSITION = 3.2; // seconds
const RADIAL = 6; // sides of the path tubes
const WIRE_R = 0.0042;
const ORDER = [...Object.keys(BODIES), 'belt']; // a fixed gear slot for each
const NMAX = Math.max(...Object.values(BODIES).map((b) => b.n));

// the turning radius of a body round the Sun at t years, as (x, z)
const helio = (b, t) => {
  const a = b.phase + (TAU * b.n * t) / CYCLE;
  return [b.r * Math.cos(a), -b.r * Math.sin(a)];
};

// for one centre, how each mover's arm is laid out: the deferent is the
// longer of its two radii (its own round the Sun, and the centre's turned
// back), the epicycle the rest; the belt's deferent carries it to the Sun's
// place. Returns, per mover, a function of t giving the deferent's vector,
// the arm's height, and the deferent's rate (turns a year) for the gears.
function layout(c) {
  const C = BODIES[c];
  const L = {};
  for (const name of ORDER) {
    if (name === c) { L[name] = { def: null, len: 0, epi: null }; continue; }
    if (name === 'belt') {
      L[name] = C.r ? { def: { b: C, name: c, k: -1 }, len: C.r, rate: C.n / CYCLE, epi: null } : { def: null, len: 0, epi: null };
      continue;
    }
    const X = BODIES[name];
    // epi: whose orbit the epicycle is, so whose tilt it leans by
    const own = { def: { b: X, name, k: 1 }, len: X.r, rate: X.n / CYCLE, epi: c };
    const cen = { def: { b: C, name: c, k: -1 }, len: C.r, rate: C.n / CYCLE, epi: name };
    if (!C.r) L[name] = { ...own, epi: null };
    else if (!X.r) L[name] = { ...cen, epi: null };
    else L[name] = X.r >= C.r ? own : cen;
  }
  // the widest arms lowest, the centre's (none) at the top
  const sorted = [...ORDER].sort((a, b) => L[b].len - L[a].len);
  // and the sleeves nest: the highest arm's innermost
  sorted.forEach((name, i) => {
    L[name].ay = CAGE_HI + 0.1 + i * (0.5 / (ORDER.length - 1));
    // tilted, the arms come down to let the bodies dip below the plane
    L[name].ayT = CAGE_HI + 0.08 + i * (0.3 / (ORDER.length - 1));
    L[name].sr = 0.03 + (ORDER.length - 1 - i) * 0.009;
  });
  return L;
}
const defVec = (d, t) => {
  if (!d) return [0, 0];
  const [x, z] = helio(d.b, t);
  return [x * d.k, z * d.k];
};

export function createGeocentric(env, centre = 'sun') {
  const M = materials(env);
  const tex = planetTextures();
  const ringTex = ringTexture();
  const group = new THREE.Group();
  const frameSpinning = [];
  const shaft = buildFrame(group, M, frameSpinning);
  const works = buildWorks(group, M, shaft);
  for (const s of frameSpinning) s.phase = s.obj.rotation.y;
  buildZodiac(group, M, env);
  const galaxy = createGalaxy();
  galaxy.group.position.y = PLANE_Y - 0.03;
  group.add(galaxy.group);

  const planetMat = {};
  const matFor = (name) => (planetMat[name] ??= new THREE.MeshStandardMaterial({
    map: tex[name], roughness: 0.55, metalness: 0, envMap: env, envMapIntensity: 0.35,
    ...surface(tex, name),
  }));
  const spinning = []; // balls, moons, the Sun's globe: rotation.y = w · 2π · years + phase
  let sunObj, sunLight;

  // a body, ball and all, in a holder at its centre; for the Sun, the lamp
  function makeBody(name, size) {
    const b = BODIES[name];
    const holder = new THREE.Group();
    if (name === 'sun') {
      const sun = createSun(size);
      holder.add(sun.group);
      spinning.push({ obj: sun.globe, w: 0.4, phase: 0 });
      const light = new THREE.PointLight(0xffb366, 34, 0, 2);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.02;
      light.shadow.radius = 3;
      light.shadow.camera.near = 0.3;
      light.shadow.camera.far = 30;
      holder.add(light);
      sunObj = sun;
      sunLight = light;
      return holder;
    }
    const tilt = new THREE.Group();
    tilt.rotation.z = b.tilt;
    holder.add(tilt);
    const ball = mesh(new THREE.SphereGeometry(size, 48, 32), matFor(name));
    tilt.add(ball);
    // the turned seat the rod takes it in (on the holder: the ball turns in it)
    holder.add(mesh(seatGeometry(size), M.brass));
    spinning.push({ obj: ball, w: b.spin, phase: 0 });
    if (name === 'saturn') {
      tilt.add(saturnRing(size, ringTex, env, () => sunLight));
      spinning.push({ ...satellite(size * 3.1, 0.022, tex.moon, 1.6, holder, M), phase: 0 }); // Titan
    }
    if (name === 'jupiter') {
      [[0.33, 0.018, 5.2], [0.4, 0.016, 3.6], [0.48, 0.022, 2.4], [0.58, 0.02, 1.4]].forEach(([d, s, ws], q) => {
        spinning.push({ ...satellite(d, s, tex.moon, ws, holder, M, q * 1.7), phase: q * 1.7 });
      });
    }
    if (name === 'earth') {
      spinning.push({ ...satellite(0.24, 0.032, tex.moon, 4.5, holder, M), phase: 0 });
    }
    if (name === 'uranus') {
      // Titania and Oberon
      spinning.push({ ...satellite(0.27, 0.018, tex.moon, 4.4, holder, M, 0.8), phase: 0.8 });
      spinning.push({ ...satellite(0.36, 0.017, tex.moon, 2.9, holder, M, 3.9), phase: 3.9 });
    }
    return holder;
  }


  // unit pieces, stretched to length each frame
  const unitBar = new THREE.BoxGeometry(1, 0.016, 0.026);
  const unitEBar = new THREE.BoxGeometry(1, 0.012, 0.02);
  const unitRod = (r) => rod(r, 1, 8).translate(0, 0.5, 0); // from y = 0 to 1
  const hoopGeo = new THREE.TorusGeometry(1, 0.003, 6, 220);

  // ---- the centre's collar, on top of the spindle
  const collar = mesh(lathe([[0.022, -0.18], [0.07, -0.17], [0.05, -0.12], [0.09, -0.06], [0.0, -0.04]], 32), M.brass, false);
  group.add(collar);

  // ---- one rig per mover, kept for good: what changes with the centre is
  // only how long its arms are, which way they point, and how high they ride
  const pins = new THREE.Group(); // each at its own pace round the shaft (see gearRate)
  pins.position.copy(shaft.position);
  group.add(pins);
  const picks = [];
  const rigs = ORDER.map((name, slot) => {
    const size = name === 'belt' ? 0.02 : BODIES[name].size;
    const gy = CAGE_LO + 0.1 + slot * (0.525 / (ORDER.length - 1));
    const sleeveR = 0.03 + slot * 0.009;
    const R = { name, size, gy, sleeveR, aD: 0, aE: 0 };
    R.arm = new THREE.Group();
    group.add(R.arm);
    R.gear = new THREE.Group();
    R.arm.add(R.gear);
    R.arm.userData.gear = R.gear;
    R.sleeve = mesh(new THREE.CylinderGeometry(1, 1, 1, 24, 1, true).translate(0, 0.5, 0), M.brass);
    R.sleeve.position.y = gy - 0.03;
    R.arm.add(R.sleeve);
    R.sleeveTop = mesh(new THREE.CylinderGeometry(1, 1, 0.045, 32), M.brass);
    R.arm.add(R.sleeveTop);
    R.bar = mesh(unitBar, M.brass);
    R.arm.add(R.bar);
    R.cwt = mesh(new THREE.SphereGeometry(0.035 + size * 0.1, 16, 12), M.brassDark);
    R.arm.add(R.cwt);
    // the epicycle's hub, wheel and the pinion that turns it
    R.post = mesh(lathe([[0.0, -0.012], [0.03, -0.012], [0.03, 0.008], [0.016, 0.012], [0.014, 0.06], [0, 0.06]], 16), M.brass);
    R.arm.add(R.post);
    R.epi = new THREE.Group();
    R.arm.add(R.epi);
    R.wheel = mesh(gearGeometry(0.075, 0.012, { teeth: 16, spokes: 4, hole: 0.016 }).geometry, M.brassDark);
    R.epi.add(R.wheel);
    R.p2 = new THREE.Group();
    R.arm.add(R.p2);
    R.p2.add(mesh(gearGeometry(0.03, 0.014, { teeth: 7, hole: 0.006 }).geometry, M.brass));
    const p2post = mesh(unitRod(0.007), M.steel);
    p2post.scale.y = 0.04;
    p2post.position.y = -0.04;
    R.p2.add(p2post);
    R.ebar = mesh(unitEBar, M.brass);
    R.epi.add(R.ebar);
    R.ecwt = mesh(new THREE.SphereGeometry(0.025, 12, 10), M.brassDark);
    R.epi.add(R.ecwt);
    if (name !== 'belt') {
      // the epicycle drawn out: a thin hoop in the plane, riding the deferent
      R.hoop = mesh(hoopGeo, M.brassDark, false);
      R.hoop.matrixAutoUpdate = false;
      R.arm.add(R.hoop);
      R.spoke = mesh(unitRod(0.004), M.steel, false);
      R.arm.add(R.spoke);
    }
    // the rod up to the body
    R.riser = mesh(unitRod(name === 'sun' ? 0.011 : name === 'belt' ? 0.009 : 0.008), M.steel);
    R.epi.add(R.riser);
    R.cup = mesh(lathe([[0.006, 0], [0.024, 0], [0.028, 0.01], [0.016, 0.016], [0.006, 0.016]], 16), M.brass);
    R.epi.add(R.cup);
    if (name === 'belt') {
      R.top = PLANE_Y;
      R.belt = asteroidBelt(BELT.r, 0, M, env);
      R.belt.matrixAutoUpdate = false;
      R.epi.add(R.belt);
    } else {
      R.top = PLANE_Y - size - 0.008;
      R.holder = makeBody(name, size);
      R.epi.add(R.holder);
      picks.push({ name, obj: R.holder, size });
      R.path = pathTube(M, NMAX * 150);
      group.add(R.path.wire);
      if (name !== 'sun') {
        // a turned collar on either side of the ball, where its path enters
        const s = collarScale(size);
        R.collars = [1, -1].map((side) => {
          const c = mesh(collarGeo, M.brass);
          c.scale.setScalar(s);
          c.userData.side = side;
          group.add(c);
          return c;
        });
      }
    }
    return R;
  });
  const rigOf = Object.fromEntries(rigs.map((R) => [R.name, R]));

  // the gears on the central axis, and their pinions on the shaft, sized for
  // the deferents' rates under one centre
  function buildGears(L) {
    for (const R of rigs) {
      R.gear.traverse((o) => o.geometry?.dispose());
      R.gear.clear();
      R.pin = null;
    }
    pins.traverse((o) => o.geometry?.dispose());
    pins.clear();
    const wheels = [];
    rigs.forEach((R, slot) => {
      const l = L[R.name];
      if (!l.def) return;
      const k = l.rate / W_SHAFT;
      const Rg = D_SHAFT / (1 + k), r = D_SHAFT - Rg;
      const teeth = Math.max(10, Math.round((TAU * Rg) / PITCH));
      const g = mesh(gearGeometry(Rg, 0.022, { teeth, spokes: Rg > 0.2 ? 6 : Rg > 0.12 ? 4 : 0, bend: Rg > 0.2 ? 0.32 : 0, hole: R.sleeveR }).geometry, slot % 2 ? M.brass : M.brassDark);
      g.position.y = R.gy;
      R.gear.add(g);
      wheels.push({ R: Rg, teeth, gy: R.gy, src: R.arm });
      const pinTeeth = Math.max(6, Math.round(teeth * (r / Rg)));
      const pin = mesh(gearGeometry(Math.max(r, 0.03), 0.03, { teeth: pinTeeth, hole: 0.014, spokes: r > 0.17 ? 5 : 0 }).geometry, M.brassDark);
      pin.position.y = R.gy + 0.004;
      pin.rotation.y = Math.PI / pinTeeth;
      pins.add(pin);
      Object.assign(R, { f: gearRate(l.rate) / l.rate, pin, nG: teeth, nP: pinTeeth, base: R.gTurn ?? 0 });
    });
    works.takeoffs(wheels);
  }

  // ---- the state: from centre A to centre B, s from 0 to 1
  let A = centre, B = centre, s = 1, LA = layout(A), LB = LA;
  let elapsed = 0, pathsDirty = true, queued = null;
  buildGears(LA);
  let tiltTarget = 0, tiltK = 0; // flat, until tilted

  // the tilt of a body's orbit, as the slope of its plane (y = sx·x + sz·z
  // about the Sun), and its height over the Sun's plane at t years
  const slope = (name) => {
    const inc = name && INCL[name];
    if (!inc || !tiltK) return [0, 0];
    const k = Math.tan(inc[0] * DEG) * tiltK;
    return [k * Math.cos(inc[1] * DEG), k * Math.sin(inc[1] * DEG)];
  };
  const height = (name, t) => {
    const b = name === 'belt' ? BELT : BODIES[name];
    if (!b.r) return 0;
    const [sx, sz] = slope(name), [x, z] = helio(b, t);
    return sx * x + sz * z;
  };
  const centreH = (t, sv) => height(A, t) * (1 - sv) + height(B, t) * sv;
  const defH = (l, t) => (l.def ? l.def.k * height(l.def.name, t) : 0);
  const mShear = new THREE.Matrix4(), mRest = new THREE.Matrix4(), hoopScale = new THREE.Vector3();
  // a shear by a world slope, seen in a frame turned by `a` about y, lifted by y
  const shearIn = (m, sx, sz, a, y) => {
    const c = Math.cos(a), s = Math.sin(a);
    return m.set(1, 0, 0, 0, sx * c - sz * s, 1, sx * s + sz * c, y, 0, 0, 1, 0, 0, 0, 0, 1);
  };

  // the point everything is drawn about, at t years: the centre's place
  // round the Sun, gliding from A's to B's
  const centreAt = (t, sv) => {
    const [ax, az] = helio(BODIES[A], t), [bx, bz] = helio(BODIES[B], t);
    return [ax + (bx - ax) * sv, az + (bz - az) * sv];
  };

  function placeRig(R, t, sv) {
    const la = LA[R.name], lb = LB[R.name];
    const [dax, daz] = defVec(la.def, t), [dbx, dbz] = defVec(lb.def, t);
    const dx = dax + (dbx - dax) * sv, dz = daz + (dbz - daz) * sv;
    const [cx, cz] = centreAt(t, sv);
    let px, pz;
    if (R.name === 'belt') {
      const [bx, bz] = helio(BELT, t);
      px = bx - cx; pz = bz - cz; // Ceres
    } else {
      const [hx, hz] = helio(BODIES[R.name], t);
      px = hx - cx; pz = hz - cz;
    }
    const ex = px - dx, ez = pz - dz;
    const D = Math.hypot(dx, dz), E = Math.hypot(ex, ez);
    if (D > 1e-6) R.aD = Math.atan2(-dz, dx);
    if (E > 1e-6) R.aE = Math.atan2(-ez, ex);
    const ay = la.ay + (lb.ay - la.ay) * sv + ((la.ayT - la.ay) + ((lb.ayT - lb.ay) - (la.ayT - la.ay)) * sv) * tiltK;
    // heights over the plane, about the centre: the body's, the deferent's end
    const h = height(R.name, t) - centreH(t, sv);
    const hD = defH(la, t) + (defH(lb, t) - defH(la, t)) * sv;
    const hasD = D > 1e-4, hasE = E > 1e-4;
    const hubY = ay + 0.04 * Math.min(1, E / 0.08);

    R.arm.rotation.y = R.aD;
    // the clockwork turns faster than the arms: their angles unwound, the gears' extra turn on top
    const unwind = (key, a) => {
      if (R[key] === undefined) R[key] = { prev: a, acc: 0, d: 0 };
      const u = R[key], d = a - u.prev;
      u.d = d - TAU * Math.round(d / TAU);
      u.acc += u.d;
      u.prev = a;
      return u.acc;
    };
    const uD = unwind('uD', R.aD);
    if (R.pin) {
      // the wheel's own turn, at gearRate: over the arm's, and its pinion with it
      R.gTurn = (R.gTurn ?? 0) + R.f * R.uD.d;
      R.gear.rotation.y = R.gTurn - uD;
      R.pin.rotation.y = Math.PI / R.nP - (R.gTurn - R.base) * (R.nG / R.nP);
    }
    const sr = la.sr + (lb.sr - la.sr) * sv;
    R.sleeve.scale.set(sr + 0.008, ay - R.gy + 0.03, sr + 0.008);
    R.sleeveTop.position.y = ay - 0.002;
    R.sleeveTop.scale.set(sr + 0.022, 1, sr + 0.022);
    R.bar.visible = R.cwt.visible = hasD;
    R.bar.scale.x = D + 0.18;
    R.bar.position.set((D - 0.18) / 2, ay, 0);
    R.cwt.position.set(-0.19, ay, 0);

    R.post.visible = R.wheel.visible = R.ebar.visible = R.ecwt.visible = R.p2.visible = hasE;
    R.post.position.set(D, ay, 0);
    R.epi.position.set(D, 0, 0);
    const rel = R.aE - R.aD;
    R.epi.rotation.y = rel;
    const relU = unwind('uE', rel);
    R.wheel.rotation.y = (GEAR_K - 1) * relU;
    R.wheel.position.y = hubY - 0.012;
    R.p2.position.set(D - 0.075 - 0.03, hubY - 0.01, 0);
    R.p2.rotation.y = -(rel + (GEAR_K - 1) * relU) * (0.075 / 0.03);
    R.ebar.scale.x = E + 0.12;
    R.ebar.position.set((E - 0.12) / 2, hubY + 0.01, 0);
    R.ecwt.position.set(-0.12, hubY + 0.01, 0);
    if (R.hoop) {
      R.hoop.visible = R.spoke.visible = hasE;
      // in the plane of the epicycle's orbit, about the deferent's end
      const [ax, az] = slope(la.epi), [bx, bz] = slope(lb.epi);
      const e = Math.max(E, 1e-3);
      shearIn(R.hoop.matrix, ax + (bx - ax) * sv, az + (bz - az) * sv, R.aD, 0)
        .premultiply(mRest.makeTranslation(D, PLANE_Y + hD, 0))
        .multiply(mShear.makeRotationX(Math.PI / 2).scale(hoopScale.set(e, e, 1)));
      R.hoop.matrixWorldNeedsUpdate = true;
      R.spoke.position.set(D, hubY + 0.02, 0);
      R.spoke.scale.y = Math.max(0.01, PLANE_Y + hD - hubY - 0.02);
    }
    R.riser.position.set(E, hubY, 0);
    R.riser.scale.y = Math.max(0.01, R.top + h - hubY + (R.name === 'belt' ? 0.01 : 0));
    R.cup.position.set(E, hubY + 0.016, 0);
    if (R.holder) R.holder.position.set(E, PLANE_Y + h, 0);
    if (R.belt) {
      // the ring of stones round the Sun, leaning in its own plane
      const [sx, sz] = slope('belt');
      shearIn(R.belt.matrix, sx, sz, R.aE, -centreH(t, sv));
      R.belt.matrixWorldNeedsUpdate = true;
    }
  }

  // the paths, about the gliding centre: X's own radius, less A's and B's
  function updatePaths(sv) {
    for (const R of rigs) {
      if (!R.path) continue;
      const coef = new Map();
      const add = (k, c) => coef.set(k, (coef.get(k) || 0) + c);
      add(R.name, 1);
      add(A, -(1 - sv));
      add(B, -sv);
      const terms = [];
      for (const [k, c] of coef) if (Math.abs(c) > 1e-6 && BODIES[k].r > 0) terms.push({ b: BODIES[k], c, s: slope(k) });
      const show = terms.length > 0;
      R.terms = terms;
      R.path.wire.visible = show;
      if (R.collars) for (const c of R.collars) c.visible = show;
      if (!show) continue;
      R.path.fill(terms);
    }
  }

  // the collars sit where the path leaves the ball, ahead of it and behind:
  // the point of the path at the ball's radius, found along the path in time
  // (it can turn tightly in its loops), the collar's axis along it there
  const up = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), across = new THREE.Vector3(), side3 = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  function placeCollars(R, t) {
    const [x0, y0, z0, vx, vy, vz] = pathAt(R.terms, t);
    const step = R.size / Math.max(Math.hypot(vx, vy, vz), 1e-6) / 4;
    for (const c of R.collars) {
      const side = c.userData.side;
      const dist = (u) => { const [x, y, z] = pathAt(R.terms, t + side * u); return Math.hypot(x - x0, y - y0, z - z0); };
      let lo = 0, hi = step, n = 0;
      while (dist(hi) < R.size && n++ < 64) { lo = hi; hi += step; }
      for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (dist(m) < R.size) lo = m; else hi = m; }
      const [x, y, z, tx, ty, tz] = pathAt(R.terms, t + side * hi);
      c.position.set(x, PLANE_Y + y, z);
      // pointing away from the ball, along the path (out of the plane when
      // the orbits tilt), kept as level across it as it can be
      dir.set(tx * side, ty * side, tz * side).normalize();
      across.crossVectors(up, dir).normalize();
      side3.crossVectors(dir, across);
      c.quaternion.setFromRotationMatrix(basis.makeBasis(side3, dir, across));
    }
  }

  let years = 0, flicker = 0;
  const sunPos = new THREE.Vector3(0, PLANE_Y, 0); // where the Sun is, about the centre
  let curSv = 0;
  const ease = (x) => x * x * (3 - 2 * x);
  function update(dt, speed, time) {
    years += (dt * speed) / YEAR;
    // the tilt eases in and out when it is switched; the paths follow it
    if (tiltK !== tiltTarget) {
      tiltK += (tiltTarget - tiltK) * Math.min(1, dt * 1.8);
      if (Math.abs(tiltTarget - tiltK) < 1e-4) tiltK = tiltTarget;
      pathsDirty = true;
    }
    if (s < 1) {
      elapsed += dt;
      s = Math.min(1, elapsed / TRANSITION);
      pathsDirty = true;
      if (s === 1) {
        A = B; LA = LB; buildGears(LA);
        // a centre asked for while this one was on its way: go on to it
        if (queued && queued !== B) { B = queued; LB = layout(B); s = 0; elapsed = 0; }
        queued = null;
      }
    }
    const sv = ease(s);
    if (pathsDirty) { updatePaths(A === B ? 0 : sv); pathsDirty = false; }
    for (const sp of frameSpinning) sp.obj.rotation.y = sp.w * years * TAU + sp.phase;
    for (const sp of spinning) sp.obj.rotation.y = sp.w * years * TAU + sp.phase;
    for (const R of rigs) placeRig(R, years, A === B ? 0 : sv);
    works.update();
    for (const R of rigs) {
      if (R.collars && R.terms.length) placeCollars(R, years);
    }
    curSv = A === B ? 0 : sv;
    const [cx, cz] = centreAt(years, curSv);
    sunPos.set(-cx, PLANE_Y - centreH(years, curSv), -cz);
    const sa = BODIES[A].size, sb = BODIES[B].size;
    collar.position.y = PLANE_Y - (sa + (sb - sa) * (A === B ? 0 : sv)) + 0.06;
    flicker = 0.9 + 0.06 * Math.sin(time * 7.3) + 0.04 * Math.sin(time * 13.1 + 1) + 0.03 * Math.sin(time * 2.1);
    sunLight.intensity = 34 * flicker;
    sunObj.update(time, flicker);
    galaxy.update(time);
  }

  update(0, 0, 0);
  return {
    group, update, picks,
    pick: (x, y, camera, w, h, slack) => pickBody(picks, x, y, camera, w, h, slack),
    // a new centre; if one is already on its way, this one follows it
    setCentre(c) {
      if (!BODIES[c]) return false;
      if (s < 1) { queued = c === B ? null : c; return true; }
      if (c === B) return false;
      B = c; LB = layout(c); s = 0; elapsed = 0;
      return true;
    },
    // where the machine is going: the queued centre, or the one on its way
    get centre() { return queued || B; },
    get light() { return sunLight; },
    get sunPos() { return sunPos; },
    // where the Sun is about the centre at any time t (years), for the
    // meteorite's path; `frame` changes whenever that motion does, and
    // `spread` is how far from the spindle the Sun ever goes
    sunAt(t, v) {
      const [cx, cz] = centreAt(t, curSv);
      return v.set(-cx, PLANE_Y - centreH(t, curSv), -cz);
    },
    get frame() { return A + '>' + B + ':' + curSv + ':' + tiltK; },
    get tilted() { return tiltTarget === 1; },
    setTilted(on, instant = false) {
      tiltTarget = on ? 1 : 0;
      if (instant) { tiltK = tiltTarget; pathsDirty = true; }
    },
    get spread() { return BODIES[A].r * (1 - curSv) + BODIES[B].r * curSv; },
    get years() { return years; },
  };
}

// a point of a path (a sum of turning radii) at t years, and its velocity
function pathAt(terms, t) {
  let x = 0, y = 0, z = 0, vx = 0, vy = 0, vz = 0;
  for (const { b, c, s: [sx, sz] } of terms) {
    const w = (TAU * b.n) / CYCLE, a = b.phase + w * t, k = c * b.r;
    const ca = Math.cos(a), sa = Math.sin(a);
    x += k * ca; z -= k * sa; y += k * (sx * ca - sz * sa);
    vx -= k * w * sa; vz -= k * w * ca; vy -= k * w * (sx * sa + sz * ca);
  }
  return [x, y, z, vx, vy, vz];
}

// a path tube, closed, sampled evenly in time over the whole cycle (the body
// slows in its loops, so the samples crowd where the path turns tightest);
// its points are refilled from a sum of turning radii.
function pathTube(M, segs) {
  const n = segs * RADIAL;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  const index = new Uint32Array(segs * RADIAL * 6);
  let q = 0;
  for (let i = 0; i < segs; i++) {
    const i2 = (i + 1) % segs;
    for (let j = 0; j < RADIAL; j++) {
      const j2 = (j + 1) % RADIAL;
      const a = i * RADIAL + j, b = i2 * RADIAL + j, c = i2 * RADIAL + j2, d = i * RADIAL + j2;
      index[q++] = a; index[q++] = d; index[q++] = b;
      index[q++] = d; index[q++] = c; index[q++] = b;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const pa = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const na = new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', pa);
  geo.setAttribute('normal', na);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, PLANE_Y, 0), 8);
  const wire = mesh(geo, M.brass, false);
  wire.frustumCulled = false;

  const cs = [], sn = [];
  for (let j = 0; j < RADIAL; j++) { cs.push(Math.cos((j / RADIAL) * TAU)); sn.push(Math.sin((j / RADIAL) * TAU)); }
  let tx0 = 1, ty0 = 0, tz0 = 0;
  function fill(terms) {
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * CYCLE;
      let x = 0, y = 0, z = 0, tx = 0, ty = 0, tz = 0;
      for (const { b, c, s: [sx, sz] } of terms) {
        const w = (TAU * b.n) / CYCLE, a = b.phase + w * t, k = c * b.r;
        const ca = Math.cos(a), sa = Math.sin(a);
        x += k * ca; z -= k * sa; y += k * (sx * ca - sz * sa);
        tx -= k * w * sa; tz -= k * w * ca; ty -= k * w * (sx * sa + sz * ca);
      }
      const hl = Math.hypot(tx, tz);
      if (hl > 1e-9) { const tl = Math.hypot(hl, ty); tx /= tl; ty /= tl; tz /= tl; tx0 = tx; ty0 = ty; tz0 = tz; } else { tx = tx0; ty = ty0; tz = tz0; }
      // the frame: across the path, level, and the normal to both
      const l = Math.hypot(tx, tz) || 1;
      const nx = tz / l, nz = -tx / l;
      const ux0 = -ty * tx / l, uy0 = l, uz0 = -ty * tz / l;
      for (let j = 0; j < RADIAL; j++) {
        const o = (i * RADIAL + j) * 3;
        const ux = cs[j] * nx + sn[j] * ux0, uy = sn[j] * uy0, uz = cs[j] * nz + sn[j] * uz0;
        nor[o] = ux; nor[o + 1] = uy; nor[o + 2] = uz;
        pos[o] = x + ux * WIRE_R; pos[o + 1] = PLANE_Y + y + uy * WIRE_R; pos[o + 2] = z + uz * WIRE_R;
      }
    }
    pa.needsUpdate = true;
    na.needsUpdate = true;
  }
  return { wire, fill };
}

