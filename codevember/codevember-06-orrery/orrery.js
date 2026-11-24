// The orrery: a brass machine on a tripod. In an open cage between two brass
// bridges, a stack of gears driven by one pinion shaft; each gear turns a sleeve,
// the sleeves nested one inside the other rise through the top bridge, and each
// carries an arm out to its planet, raised on a rod to the plane of the sun.
// The gears really mesh: each planet turns at (its pinion / its gear) of the
// shaft's speed. A wide zodiac ring rides around it all on four arched struts.
// The sun at the top is a lamp: the only strong light in the room.
import * as THREE from 'three';
import { planetTextures, ringTexture, zodiacTexture, surface } from './textures.js';
import { createSun } from './sun.js';
import { createGalaxy } from './galaxy.js';
import { rng, noise3, fbm } from './noise.js';
import { buildWorks } from './works.js';

export const PLANE_Y = 2.45; // the planets and the sun
// the orbits are tilted, each out of the plane of the ecliptic (Earth's) by
// its inclination, about its line of nodes; both much exaggerated, the nodes
// spread round so that every hoop leans its own way. The arms still turn
// flat: the rod on each one slides up and down in its cup, as on a cam, so
// that the planet rides round its tilted hoop.
export const DEG = Math.PI / 180;
// (how far each can lean is set by how far its ball can dip before it meets
// its own arm; the asteroids lean with Jupiter)
export const INCL = { mercury: [30, 48], venus: [22, 160], earth: [0, 0], mars: [16, 260], belt: [10, 100], jupiter: [10, 100], saturn: [10, 330], uranus: [7, 210] };
const BELT_Y = PLANE_Y; // the asteroids, in the planets' plane with the rest
export const CAGE_LO = 0.8, CAGE_HI = 1.55;
export const D = 0.42; // from the central axis to the pinion shaft
const PITCH = 0.034; // the gears' tooth pitch
const TOOTH = 0.022;

// the orbital periods (years) squeezed so that one shaft can drive them all
// (ω ∝ T^-0.55); Earth's year takes YEAR seconds at speed 1
export const YEAR = 31.5;
const PLANETS = [
  { name: 'mercury', orbit: 0.62, size: 0.075, T: 0.24, tilt: 0.0, spin: 0.6 },
  { name: 'venus', orbit: 0.92, size: 0.115, T: 0.62, tilt: 0.05, spin: -0.3 },
  { name: 'earth', orbit: 1.28, size: 0.13, T: 1.0, tilt: 0.41, spin: 4 },
  { name: 'mars', orbit: 1.66, size: 0.1, T: 1.88, tilt: 0.44, spin: 3.8 },
  // the asteroids: no ball, but a swarm of stones (Ceres' year)
  { name: 'belt', orbit: 1.93, size: 0.02, T: 4.6, belt: true },
  { name: 'jupiter', orbit: 2.3, size: 0.27, T: 11.86, tilt: 0.05, spin: 1.6 },
  { name: 'saturn', orbit: 3.0, size: 0.22, T: 29.46, tilt: 0.47, spin: 1.4 },
  // Uranus, out beyond the zodiac ring (its arm passes over it), lying on its side
  { name: 'uranus', orbit: 3.6, size: 0.15, T: 84.0, tilt: 1.71, spin: -2.2 },
];
export const W_SHAFT = 1.3; // relative to Earth's
// the clockwork turns faster than the planets it drives (a look, not the
// mechanism), and the slow outer wheels much more so, so that every layer is
// seen going round: a wheel the arm turns at w goes at gearRate(w). Each
// pinion turns on the shaft at its own pace, to stay meshed with its wheel.
export const GEAR_K = 2.5; // the epicycles' little wheels, over their turn
export const gearRate = (w) => 3.5 * Math.sign(w) * Math.pow(Math.abs(w), 0.2);
const NIGHT = new THREE.Color(0.075, 0.095, 0.16); // the planets' night sides, lit by the sky

export function materials(env) {
  const brass = new THREE.MeshStandardMaterial({ color: 0xc89a48, metalness: 1, roughness: 0.3, envMap: env, envMapIntensity: 0.9 });
  const brassDark = new THREE.MeshStandardMaterial({ color: 0x8a6430, metalness: 1, roughness: 0.42, envMap: env, envMapIntensity: 0.8 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 1, roughness: 0.38, envMap: env, envMapIntensity: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.7, roughness: 0.55, envMap: env, envMapIntensity: 0.6 });
  return { brass, brassDark, steel, iron };
}

// a spur gear lying flat (axis y), centred on its axis, top at y = 0
export function gearGeometry(R, thick, { teeth, hole = 0.02, spokes = 0, bend = 0 } = {}) {
  const n = teeth ?? Math.max(8, Math.round((2 * Math.PI * R) / PITCH));
  const s = new THREE.Shape();
  const ro = R + TOOTH * 0.5, ri = R - TOOTH * 0.6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, st = (Math.PI * 2) / n;
    const pts = [
      [ri, a], [ri, a + st * 0.18], [ro, a + st * 0.3], [ro, a + st * 0.62], [ri, a + st * 0.74],
    ];
    pts.forEach(([r, b], k) => (i === 0 && k === 0 ? s.moveTo : s.lineTo).call(s, Math.cos(b) * r, Math.sin(b) * r));
  }
  s.closePath();
  const h = new THREE.Path();
  h.absarc(0, 0, hole, 0, Math.PI * 2, true);
  s.holes.push(h);
  // lightening holes between the spokes, as on a clock wheel; with `bend`,
  // the spokes curve (by that angle at mid-length), as on the finer ones
  if (spokes) {
    const r0 = Math.max(hole + 0.03, R * 0.22), r1 = R - TOOTH - 0.025;
    const sw = 0.018; // half a spoke's width
    const off = (r) => bend * Math.sin((Math.PI * (r - r0)) / (r1 - r0)); // the spoke's sweep at r
    const N = bend ? 10 : 1;
    for (let k = 0; k < spokes; k++) {
      const a0 = (k / spokes) * Math.PI * 2, a1 = ((k + 1) / spokes) * Math.PI * 2;
      const p = new THREE.Path();
      const d0 = sw / r0, d1 = sw / r1;
      p.absarc(0, 0, r1, a0 + d1, a1 - d1, false);
      for (let j = 1; j < N; j++) { // down the next spoke's near side
        const r = r1 - ((r1 - r0) * j) / N, a = a1 + off(r) - sw / r;
        p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      p.absarc(0, 0, r0, a1 - d0, a0 + d0, true);
      for (let j = 1; j < N; j++) { // and up this one's far side
        const r = r0 + ((r1 - r0) * j) / N, a = a0 + off(r) + sw / r;
        p.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      p.closePath();
      s.holes.push(p);
    }
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1, curveSegments: 6 });
  g.rotateX(Math.PI / 2); // extruded along +z → down along -y from y=0
  g.computeVertexNormals();
  return { geometry: g, teeth: n };
}

// a turned profile (r, y pairs) around the y axis
export function lathe(points, segs = 48) {
  return new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}
export function rod(r, len, segs = 12) {
  const g = new THREE.CylinderGeometry(r, r, len, segs);
  return g;
}
export function mesh(g, m, shadow = true) {
  const o = new THREE.Mesh(g, m);
  o.castShadow = shadow;
  o.receiveShadow = true;
  return o;
}

// the stand, the cage, the central spindle and the pinion shaft;
// returns the shaft, for the pinions
export function buildFrame(group, M, spinning) {
  // ---- the stand: a turned column on a tripod with claw feet
  const column = mesh(lathe([
    [0, 0.05], [0.2, 0.05], [0.22, 0.09], [0.15, 0.13], [0.11, 0.2], [0.075, 0.32], [0.065, 0.45],
    [0.1, 0.5], [0.07, 0.54], [0.06, 0.66], [0.09, 0.71], [0.16, 0.76], [0.17, CAGE_LO - 0.01], [0, CAGE_LO - 0.01],
  ]), M.brassDark);
  group.add(column);
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 6;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const pts = [
      new THREE.Vector3(0, 0.36, 0).addScaledVector(dir, 0.07),
      new THREE.Vector3(0, 0.3, 0).addScaledVector(dir, 0.35),
      new THREE.Vector3(0, 0.12, 0).addScaledVector(dir, 0.72),
      new THREE.Vector3(0, 0.03, 0).addScaledVector(dir, 0.92),
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    group.add(mesh(new THREE.TubeGeometry(curve, 32, 0.028, 10), M.brassDark));
    // a claw holding a ball
    const foot = mesh(new THREE.SphereGeometry(0.055, 20, 14), M.brass);
    foot.position.copy(pts[3]).setY(0.055);
    group.add(foot);
    // a scroll on the leg
    const scroll = mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 24, Math.PI * 1.5), M.brass);
    scroll.position.copy(pts[1]).add(new THREE.Vector3(0, 0.08, 0));
    scroll.lookAt(scroll.position.clone().add(new THREE.Vector3(-dir.z, 0, dir.x)));
    group.add(scroll);
  }

  // ---- the cage: four turned pillars, between two open bridges (works.js)
  // where there were plates, so the gears show
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const h = CAGE_HI - CAGE_LO - 0.03;
    const pil = mesh(lathe([
      [0.0, 0], [0.03, 0], [0.03, 0.03], [0.018, 0.06], [0.016, h * 0.4], [0.028, h * 0.5], [0.016, h * 0.6],
      [0.018, h - 0.06], [0.03, h - 0.03], [0.03, h], [0, h],
    ], 16), M.brass);
    pil.position.set(Math.cos(a) * 0.76, CAGE_LO, Math.sin(a) * 0.76);
    group.add(pil);
  }
  // the shaft through the middle, from the cage to the sun
  const spindle = mesh(rod(0.022, PLANE_Y - CAGE_LO), M.steel);
  spindle.position.y = (PLANE_Y + CAGE_LO) / 2;
  group.add(spindle);

  // ---- the pinion shaft, down through the bridge to the drive (works.js)
  const shaft = new THREE.Group();
  shaft.position.set(D, 0, 0);
  group.add(shaft);
  const lo = CAGE_LO - 0.17, hi = CAGE_HI + 0.045; // up to the deck
  const shaftRod = mesh(rod(0.014, hi - lo), M.steel);
  shaftRod.position.y = (hi + lo) / 2;
  shaft.add(shaftRod);
  spinning.push({ obj: shaft, w: -gearRate(W_SHAFT) });

  return shaft;
}

export function buildZodiac(group, M, env) {
  // ---- the zodiac ring on four arched struts
  const zr0 = 3.3, zr1 = 3.72, zy = CAGE_HI;
  const zg = new THREE.RingGeometry(zr0, zr1, 160, 1);
  {
    const pos = zg.attributes.position, uv = zg.attributes.uv;
    for (let v = 0; v < uv.count; v++) {
      const x = pos.getX(v), y = pos.getY(v);
      uv.setXY(v, 0.5 + (x / zr1) * 0.5, 0.5 + (y / zr1) * 0.5);
    }
  }
  const ztex = zodiacTexture(2048, zr0 / zr1);
  const zodiac = mesh(zg, new THREE.MeshStandardMaterial({
    color: 0xd8ac5a, map: ztex, metalness: 1, roughness: 0.34, envMap: env, envMapIntensity: 0.9, side: THREE.DoubleSide,
  }));
  zodiac.rotation.x = -Math.PI / 2;
  zodiac.position.y = zy;
  group.add(zodiac);
  for (const [rr, yy] of [[zr0, zy], [zr1, zy]]) {
    const edge = mesh(new THREE.TorusGeometry(rr, 0.016, 8, 160), M.brassDark);
    edge.rotation.x = Math.PI / 2;
    edge.position.y = yy - 0.004;
    group.add(edge);
  }
  // the band hanging below its outer edge
  const band = mesh(new THREE.CylinderGeometry(zr1, zr1, 0.07, 160, 1, true), M.brassDark);
  band.position.y = zy - 0.045;
  group.add(band);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0.62, 0).addScaledVector(dir, 0.12),
      new THREE.Vector3(0, 0.55, 0).addScaledVector(dir, 1.6),
      new THREE.Vector3(0, 0.85, 0).addScaledVector(dir, 3.0),
      new THREE.Vector3(0, zy - 0.13, 0).addScaledVector(dir, zr1 - 0.02),
    );
    group.add(mesh(new THREE.TubeGeometry(curve, 48, 0.022, 8), M.brassDark));
    // little scrolls along it
    for (const t of [0.35, 0.7]) {
      const s = mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 20, Math.PI * 1.6), M.brass);
      s.position.copy(curve.getPoint(t)).add(new THREE.Vector3(0, 0.07, 0));
      s.lookAt(s.position.clone().add(new THREE.Vector3(-dir.z, 0, dir.x)));
      group.add(s);
    }
  }

}

export function createOrrery(env) {
  const M = materials(env);
  const tex = planetTextures();
  const group = new THREE.Group();
  const spinning = []; // { obj, w } turned by w (radians per year-unit of time)

  const shaft = buildFrame(group, M, spinning);
  // the pinions, each on its own pace round the shaft (see gearRate)
  const pins = new THREE.Group();
  pins.position.copy(shaft.position);
  group.add(pins);
  const works = buildWorks(group, M, shaft);
  const wheels = []; // the central wheels, for the takeoffs

  // ---- the planets: gear, sleeve, arm, rod, ball
  const planets = [];
  const picks = []; // what a click can land on: the planets and the sun
  const tilted = []; // the planets and the belt, each with its tilted frame
  const n = PLANETS.length;
  const ringTex = ringTexture();
  PLANETS.forEach((p, i) => {
    const w = Math.pow(p.T, -0.55); // relative to Earth's
    const k = w / W_SHAFT;
    const R = D / (1 + k), r = D - R;
    // the sleeves nest: Mercury's innermost and longest, from the lowest gear
    // to the highest arm; Uranus' outermost and shortest
    const gy = CAGE_LO + 0.1 + i * (0.525 / (n - 1)); // the gear's top
    const ay = CAGE_HI + 0.1 + (n - 1 - i) * (0.28 / (n - 1)); // the arm, low: room for the planets to dip (but over the deck)
    const sleeveR = 0.03 + i * 0.009;

    const arm = new THREE.Group();
    group.add(arm);
    // the gear on the central axis
    const gearTeeth = Math.max(10, Math.round((2 * Math.PI * R) / PITCH));
    const g = mesh(gearGeometry(R, 0.022, { teeth: gearTeeth, spokes: R > 0.2 ? 6 : R > 0.12 ? 4 : 0, bend: R > 0.2 ? 0.32 : 0, hole: sleeveR }).geometry, i % 2 ? M.brass : M.brassDark);
    g.position.y = gy;
    arm.add(g);
    const gw = gearRate(w);
    spinning.push({ obj: g, w: gw - w }); // over the arm's turn, for the faster clockwork
    arm.userData.gear = g;
    wheels.push({ R, teeth: gearTeeth, gy, src: arm });
    // its sleeve, from the gear up to the arm
    const sl = mesh(lathe([[sleeveR, gy - 0.03], [sleeveR + 0.008, gy - 0.03], [sleeveR + 0.008, ay - 0.03], [sleeveR + 0.022, ay - 0.025], [sleeveR + 0.022, ay + 0.02], [sleeveR, ay + 0.025]], 32), M.brass);
    arm.add(sl);
    // the pinion on the shaft that drives it
    const pinTeeth = Math.max(6, Math.round(gearTeeth * (r / R)));
    const pin = mesh(gearGeometry(r, 0.03, { teeth: pinTeeth, hole: 0.014, spokes: r > 0.17 ? 5 : 0 }).geometry, M.brassDark);
    pin.position.y = gy + 0.004;
    pin.rotation.y = Math.PI / pinTeeth; // a tooth into a gap
    pins.add(pin);
    spinning.push({ obj: pin, w: -gw * (gearTeeth / pinTeeth) });

    // the arm: a flat bar out to the orbit, a counterweight behind
    const bar = mesh(new THREE.BoxGeometry(p.orbit + 0.18, 0.016, 0.026), M.brass);
    bar.position.set((p.orbit - 0.18) / 2, ay, 0);
    arm.add(bar);
    const cwt = mesh(new THREE.SphereGeometry(0.03 + p.size * 0.12, 16, 12), M.brassDark);
    cwt.position.set(-0.19, ay, 0);
    arm.add(cwt);
    // the rod up to the plane of the planets
    const top = p.belt ? BELT_Y : PLANE_Y - p.size - 0.01;
    const riserLen = top - ay + 0.01;
    const riser = mesh(rod(0.009, riserLen, 8), M.steel);
    riser.position.set(p.orbit, (top + ay) / 2, 0);
    arm.add(riser);
    const cup = mesh(lathe([[0.008, 0], [0.03, 0.0], [0.035, 0.012], [0.02, 0.02], [0.008, 0.02]], 16), M.brass);
    cup.position.set(p.orbit, ay + 0.005, 0);
    arm.add(cup);

    // the frame of the tilted orbit, and in it a group turning with the arm
    const [inc, node] = INCL[p.name];
    const frame = new THREE.Group();
    frame.matrixAutoUpdate = false;
    const spin = new THREE.Group();
    frame.add(spin);
    group.add(frame);
    const tiltRec = {
      orbit: p.orbit, arm, riser, riserLen, top, ay, frame, spin,
      tanI: Math.tan(inc * DEG), nx: Math.cos(node * DEG), nz: Math.sin(node * DEG),
    };
    tilted.push(tiltRec);

    if (p.belt) {
      spin.add(asteroidBelt(p.orbit, ay, M, env));
      arm.rotation.y = i * 2.1 + 0.4;
      spinning.push({ obj: arm, w });
      return;
    }

    // the planet, tilted, turning on its axis
    const holder = new THREE.Group();
    holder.position.set(p.orbit, PLANE_Y, 0);
    arm.add(holder);
    const tilt = new THREE.Group();
    tilt.rotation.z = p.tilt;
    holder.add(tilt);
    const ball = mesh(new THREE.SphereGeometry(p.size, 48, 32), new THREE.MeshStandardMaterial({
      map: tex[p.name], roughness: 0.55, metalness: 0, envMap: env, envMapIntensity: 0.35,
      ...surface(tex, p.name),
      // the night side is never black: a cool glow from the sky shows its
      // colours, as the plate's planets turn blue, not dark, away from the sun
      emissiveMap: tex[p.name], emissive: NIGHT,
      // the inner ones, close to the lamp, would glare almost as white as the
      // sun: toned down, as an engraver keeps one light in the plate
      color: new THREE.Color().setScalar(Math.min(1, Math.pow(p.orbit / 1.66, 1.4))),
    }));
    tilt.add(ball);
    ball.userData.unspin = true; // its engraving doesn't whirl with it
    spinning.push({ obj: ball, w: p.spin });

    if (p.name === 'saturn') {
      tilt.add(saturnRing(p.size, ringTex, env, () => light));
      // Titan, on a little wire
      const sat = satellite(p.size * 3.1, 0.022, tex.moon, 1.6, holder, M);
      spinning.push(sat);
    }
    if (p.name === 'jupiter') {
      [[0.33, 0.018, 5.2], [0.4, 0.016, 3.6], [0.48, 0.022, 2.4], [0.58, 0.02, 1.4]].forEach(([d, s, ws], q) => {
        const sat = satellite(d, s, tex.moon, ws, holder, M, q * 1.7);
        spinning.push(sat);
      });
    }
    if (p.name === 'earth') {
      spinning.push(satellite(0.24, 0.032, tex.moon, 4.5, holder, M));
    }
    if (p.name === 'uranus') {
      // Titania and Oberon, Herschel's two
      spinning.push(satellite(0.27, 0.018, tex.moon, 4.4, holder, M, 0.8));
      spinning.push(satellite(0.36, 0.017, tex.moon, 2.9, holder, M, 3.9));
    }

    // the orbit, made solid: a flat brass band in the plane of the planets,
    // threaded through the ball like a bead on a wire, a turned collar on
    // either side where it enters
    const hoop = orbitHoop(p.orbit, M);
    group.add(hoop);
    // the collars turn with the arm, inside the tilted frame of its hoop
    for (const side of [1, -1]) spin.add(orbitCollar(p.orbit, p.size, side, M));
    // and the rod takes the ball in a turned seat under it, so the planet
    // sits on its rod instead of floating over it (on the holder: it follows
    // the hoop's height, and the ball turns in it)
    holder.add(mesh(seatGeometry(p.size), M.brass));
    Object.assign(tiltRec, { holder, hoop });

    arm.rotation.y = i * 2.1 + 0.4; // they start spread around
    spinning.push({ obj: arm, w });
    planets.push({ ...p, arm, ball, holder });
    picks.push({ name: p.name, obj: holder, size: p.size });
  });

  // ---- the sun: a lamp, but drawn as the engravers drew it, ablaze
  const sun = createSun(0.27);
  sun.group.position.y = PLANE_Y;
  group.add(sun.group);
  picks.push({ name: 'sun', obj: sun.group, size: 0.27 });
  sun.globe.userData.unspin = true;
  spinning.push({ obj: sun.globe, w: 0.4 });
  // a gilded collar below it
  const collar = mesh(lathe([[0.022, -0.18], [0.07, -0.17], [0.05, -0.12], [0.09, -0.06], [0.0, -0.04]], 32), M.brass, false);
  collar.position.y = PLANE_Y - 0.21;
  group.add(collar);

  const light = new THREE.PointLight(0xffb366, 34, 0, 2);
  light.position.y = PLANE_Y;
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024);
  light.shadow.bias = -0.002;
  light.shadow.normalBias = 0.02;
  light.shadow.intensity = 0.55; // the planets darken the brass, they do not black it out
  light.shadow.camera.near = 0.3;
  light.shadow.camera.far = 30;
  group.add(light);

  // ---- the Milky Way, wound into the plane of the planets
  const galaxy = createGalaxy();
  galaxy.group.position.y = PLANE_Y - 0.03;
  group.add(galaxy.group);

  buildZodiac(group, M, env);
  works.takeoffs(wheels);

  // time: in years (Earth's), so each planet's arm turns by w · 2π · years
  let years = 0, flicker = 0;
  let tiltTarget = 0, tiltK = 0; // flat, until tilted
  function update(dt, speed, time) {
    years += (dt * speed) / YEAR;
    for (const s of spinning) s.obj.rotation.y = s.w * years * Math.PI * 2 + s.phase;
    works.update();
    // the tilt eases in and out when it is switched
    tiltK += (tiltTarget - tiltK) * Math.min(1, dt * 1.8);
    if (Math.abs(tiltTarget - tiltK) < 1e-4) tiltK = tiltTarget;
    for (const p of tilted) {
      const t = p.tanI * tiltK, sx = t * p.nx, sz = t * p.nz;
      // the plane of the orbit: y = PLANE_Y + sx·x + sz·z, a shear about the sun's axis
      p.frame.matrix.set(1, 0, 0, 0, sx, 1, sz, 0, 0, 0, 1, 0, 0, 0, 0, 1);
      p.frame.matrixWorldNeedsUpdate = true;
      if (p.hoop) {
        p.hoop.matrix.set(1, 0, 0, 0, sx, 1, sz, PLANE_Y, 0, 0, 1, 0, 0, 0, 0, 1);
        p.hoop.matrixWorldNeedsUpdate = true;
      }
      p.spin.rotation.y = p.arm.rotation.y;
      // the planet at (R cos θ, ·, -R sin θ): its height on the tilted hoop
      const a = p.arm.rotation.y;
      const h = p.orbit * (sx * Math.cos(a) - sz * Math.sin(a));
      if (p.holder) p.holder.position.y = PLANE_Y + h;
      p.riser.scale.y = (p.riserLen + h) / p.riserLen;
      p.riser.position.y = (p.top + h + p.ay) / 2;
    }
    // the flame breathes
    flicker = 0.9 + 0.06 * Math.sin(time * 7.3) + 0.04 * Math.sin(time * 13.1 + 1) + 0.03 * Math.sin(time * 2.1);
    light.intensity = 34 * flicker;
    sun.update(time, flicker);
    galaxy.update(time);
  }
  // the arms start spread around: keep the phase
  for (const s of spinning) s.phase = s.obj.rotation.y;

  return {
    group, update, light, sun, planets, picks,
    pick: (x, y, camera, w, h, slack) => pickBody(picks, x, y, camera, w, h, slack),
    get years() { return years; },
    get tilted() { return tiltTarget === 1; },
    setTilted(on, instant = false) { tiltTarget = on ? 1 : 0; if (instant) tiltK = tiltTarget; },
  };
}

// a flat band of brass on the orbit, a little wider than it is thick
function orbitHoop(R, M) {
  const w = 0.012, h = 0.0025; // half its width, half its thickness
  const band = mesh(lathe([
    [R - w, -h], [R + w, -h], [R + w + 0.002, 0], [R + w, h], [R - w, h], [R - w - 0.002, 0], [R - w, -h],
  ], Math.round(R * 160)), M.brass, false);
  band.matrixAutoUpdate = false;
  return band;
}

// where the hoop enters a ball: a small turned brass ferrule, its mouth
// flared into a lip sunk against the sphere, a bead, a short neck sleeving
// the band, a ring and a domed end the band runs out through. It rides with the arm,
// not the ball, so the planet turns inside it.
export const COLLAR_LEN = 0.0325;
export const collarScale = (size) => 0.6 * (0.85 + size * 1.4);
export const collarGeo = lathe([
  [0, -0.016], [0.024, -0.016], [0.0265, -0.002], [0.029, 0.001], [0.0285, 0.0045], [0.024, 0.007],
  [0.0215, 0.0095], [0.0225, 0.013], [0.0205, 0.016], [0.0172, 0.0185],
  [0.0195, 0.021], [0.0195, 0.0235], [0.0168, 0.026], [0.0162, 0.0285], [0.012, 0.0317], [0, COLLAR_LEN],
], 28);
// where the rod takes the ball: a small turned brass seat, a socket round
// the rod flaring into a narrow lip just under the sphere. (Around the
// ball's centre; the rod comes up to about y = -size - 0.008.)
export function seatGeometry(size) {
  const cupR = 0.2 * size + 0.006, cupY = -Math.sqrt(size * size - cupR * cupR);
  const L = 0.022 + 0.04 * size, y0 = -size - L;
  const pts = [[0, y0], [0.0115, y0], [0.0115, y0 + 0.006]];
  // the flare, from the socket up to under the lip
  const fy0 = y0 + 0.006, fy1 = cupY - 0.002, fr1 = cupR + 0.002;
  for (let i = 1; i <= 6; i++) {
    const u = i / 6;
    pts.push([0.0115 + (fr1 - 0.0115) * u * u, fy0 + (fy1 - fy0) * u]);
  }
  // the lip, a hair proud of the sphere, and back in under it
  pts.push([cupR + 0.004, cupY - 0.001], [cupR * 0.9, cupY + 0.001], [0, -size * 0.7]);
  return lathe(pts, 24);
}

function orbitCollar(R, size, side, M) {
  // the point on the hoop at the ball's surface, and the hoop's way out there
  const a = 2 * Math.asin(size / (2 * R)) * side;
  const dir = new THREE.Vector3(-Math.sin(Math.abs(a)), 0, Math.cos(a) * side);
  const o = mesh(collarGeo, M.brass);
  o.position.set(Math.cos(a) * R, PLANE_Y, Math.sin(a) * R);
  // its axis along the hoop, its local x up, its local z across the band
  const up = new THREE.Vector3(0, 1, 0);
  o.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(up, dir, up.clone().cross(dir)));
  // small, but never narrower than the band it sleeves (the neck, 0.0168,
  // must clear the band's half-width, 0.014): flattened a little when tiny
  const s = collarScale(size);
  o.scale.set(s, s, Math.max(s, 0.0148 / 0.0168));
  return o;
}

// Saturn's rings. The lamp sits in the plane of the planets, so it only ever
// grazes them, and half the year it lights the face we don't see: drawn as a
// plain lit plane they went dark, a smudge by the ball. But the rings are dust
// and ice, which throw the light on (Saturn's are brightest seen against the
// sun): here each point is lit as if it faced the lamp, whichever side it is
// on, its face bent towards the light, so they glow even edge-on; and, like
// the balls' night sides, a cool glow of their own from the sky
export function saturnRing(size, map, env, lamp) {
  const r0 = size * 1.35, r1 = size * 2.35;
  const rg = new THREE.RingGeometry(r0, r1, 96, 1);
  const uv = rg.attributes.uv, pos = rg.attributes.position;
  for (let v = 0; v < uv.count; v++) {
    const d = Math.hypot(pos.getX(v), pos.getY(v));
    uv.setXY(v, (d - r0) / (r1 - r0), 0.5);
  }
  const uSun = { value: new THREE.Vector3() };
  const uBall = { value: new THREE.Vector4() }; // the ball: centre (view space), radius
  const uAxis = { value: new THREE.Vector3() }; // the rings' normal (view space)
  const mat = new THREE.MeshStandardMaterial({
    map, transparent: true, side: THREE.DoubleSide, roughness: 0.75, alphaTest: 0.05, depthWrite: true,
    envMap: env, envMapIntensity: 0.4,
    emissiveMap: map, emissive: NIGHT.clone().multiplyScalar(1.6),
    color: new THREE.Color(1.25, 1.2, 1.12),
  });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uSun = uSun;
    sh.uniforms.uBall = uBall;
    sh.uniforms.uAxis = uAxis;
    sh.fragmentShader = 'uniform vec3 uSun;\nuniform vec4 uBall;\nuniform vec3 uAxis;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // the ball's shadow, worked out (not from the shadow map: nothing
        // else darkens the rings). Drawn as the Voyager photographs show
        // it, the sun low on the rings: a band as wide as the ball, cut
        // straight and sharp across them, away from the sun, rather than
        // the short round patch the lamp's height would give
        vec3 q = -vViewPosition - uBall.xyz;
        vec3 s = normalize(uSun - uBall.xyz);
        vec3 sp = normalize(s - uAxis * dot(s, uAxis) + 1e-5); // the sun, along the rings
        q -= uAxis * dot(q, uAxis);
        float along = dot(q, sp);
        float across = length(q - sp * along);
        float e = uBall.w * 0.012; // the edge: just not aliased
        float lit = max(smoothstep(uBall.w - e, uBall.w + e, across), smoothstep(-e, e, along));
        // the lamp gone, and most of the glow of the lit hall it threw
        // back too: a deep notch, as in the photographs from Cassini
        reflectedLight.directDiffuse *= mix(0.04, 1.0, lit);
        reflectedLight.directSpecular *= lit;
        reflectedLight.indirectDiffuse *= mix(0.12, 1.0, lit);
        reflectedLight.indirectSpecular *= mix(0.08, 1.0, lit);
      }`).replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {
        vec3 toSun = normalize(uSun + vViewPosition);
        normal = normalize(normal * (dot(normal, toSun) < 0.0 ? -1.0 : 1.0) + toSun * 0.9);
      }`);
  };
  const ring = mesh(rg, mat);
  ring.rotation.x = -Math.PI / 2;
  // no shadows from the shadow map: a flat thing grazed by the lamp only
  // speckles itself, and the rest of the machine would litter it; the ball's
  // own is drawn above. The rings' shadow on the ball is kept
  ring.receiveShadow = false;
  const at = new THREE.Vector3();
  ring.onBeforeRender = (renderer, scene, camera) => {
    const l = lamp();
    if (l) uSun.value.copy(l.getWorldPosition(at)).applyMatrix4(camera.matrixWorldInverse);
    ring.getWorldPosition(at).applyMatrix4(camera.matrixWorldInverse);
    uBall.value.set(at.x, at.y, at.z, size * ring.matrixWorld.getMaxScaleOnAxis());
    uAxis.value.set(0, 0, 1).transformDirection(ring.matrixWorld).transformDirection(camera.matrixWorldInverse);
  };
  return ring;
}

// a little moon on a wire from the planet's rod, going round it
export function satellite(dist, size, map, w, holder, M, phase = 0) {
  const g = new THREE.Group();
  g.rotation.y = phase;
  holder.add(g);
  const wire = mesh(rod(0.0035, dist, 6), M.steel, false);
  wire.rotation.z = Math.PI / 2;
  wire.position.set(dist / 2, -0.0, 0);
  g.add(wire);
  const m = mesh(new THREE.SphereGeometry(size, 32, 20), new THREE.MeshStandardMaterial({ map, roughness: 0.7, emissiveMap: map, emissive: NIGHT, bumpMap: map, bumpScale: 1.5 }));
  m.position.set(dist, 0, 0);
  g.add(m);
  return { obj: g, w };
}

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.45)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// the asteroid belt: a loose swarm of a few hundred rough stones of every
// size, with no hoop or wire to mark their path; the rod from their arm holds
// Ceres, the greatest of them, and the rest go round with it — Pallas, Juno
// and Vesta among them
export function asteroidBelt(R, ay, M, env) {
  const g = new THREE.Group();

  // a handful of rock shapes: lumpy, faceted, never round
  const rand = rng(41);
  const shapes = [0, 1, 2, 3, 4].map((v) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const n = noise3(70 + v);
    const pos = geo.attributes.position, p = new THREE.Vector3();
    const sx = 0.75 + rand() * 0.5, sy = 0.6 + rand() * 0.35, sz = 0.8 + rand() * 0.45;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i).normalize();
      const d = 1 + 0.32 * fbm(n, p.x * 1.3, p.y * 1.3, p.z * 1.3, 3);
      pos.setXYZ(i, p.x * d * sx, p.y * d * sy, p.z * d * sz);
    }
    geo.computeVertexNormals();
    return geo;
  });
  const stone = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.92, metalness: 0.05, envMap: env, envMapIntensity: 0.3, flatShading: true,
  });

  // the stones: where they sit, how big, how turned
  const rocks = [];
  // the great four
  [[0.034, 0], [0.025, 1.9], [0.02, 3.5], [0.027, 5.0]].forEach(([s, a]) => rocks.push({ r: R, a, s, y: 0 }));
  for (let i = 0; i < 1260; i++) {
    const s = 0.0045 + 0.017 * Math.pow(rand(), 3.6);
    // scattered wide and deep across the band, thinning towards its edges
    const r = R + (rand() + rand() - 1) * 0.24;
    const y = (rand() + rand() - 1) * 0.075;
    // thicker in some stretches, sparse in others
    let a;
    do a = rand() * Math.PI * 2; while (rand() > 0.55 + 0.45 * Math.sin(a * 3 + 1.2) * Math.sin(a * 2 - 0.4));
    rocks.push({ r, a, s, y });
  }
  const perShape = shapes.map(() => []);
  rocks.forEach((rk, i) => perShape[i % shapes.length].push(rk));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  perShape.forEach((list, k) => {
    const im = new THREE.InstancedMesh(shapes[k], stone, list.length);
    im.castShadow = true;
    im.receiveShadow = true;
    list.forEach((rk, j) => {
      v.set(Math.cos(rk.a) * rk.r, BELT_Y + rk.y, -Math.sin(rk.a) * rk.r);
      q.setFromEuler(e.set(rand() * 6.3, rand() * 6.3, rand() * 6.3));
      sc.setScalar(rk.s);
      im.setMatrixAt(j, m4.compose(v, q, sc));
      // grey-brown stone, some rusty, some pale
      const t = rand();
      c.setRGB(0.42 + t * 0.2, 0.36 + t * 0.15, 0.3 + t * 0.1);
      if (rand() < 0.2) c.multiply(new THREE.Color(1.15, 0.85, 0.65));
      im.setColorAt(j, c);
    });
    g.add(im);
  });
  return g;
}

// the body under a point of the canvas (in pixels), if any, among `picks`
// ({ name, obj, size }): the nearest on screen, with some slack round the small
// ones (`slack` pixels more round every one)
const pv = new THREE.Vector3(), pcv = new THREE.Vector3();
export function pickBody(picks, x, y, camera, w, h, slack = 0) {
  let best = null, bestD = Infinity;
  const f = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  for (const p of picks) {
    p.obj.getWorldPosition(pv);
    const dist = pv.distanceTo(camera.getWorldPosition(pcv));
    pv.project(camera);
    if (pv.z > 1) continue;
    const sx = (pv.x * 0.5 + 0.5) * w, sy = (0.5 - pv.y * 0.5) * h;
    const rad = (p.size / dist) * f;
    const d = Math.hypot(sx - x, sy - y);
    if (d < Math.max(14, rad + 8) + slack && d - rad < bestD) { best = p.name; bestD = d - rad; }
  }
  return best;
}
