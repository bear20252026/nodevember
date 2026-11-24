// The long filaments: the moss's sporophytes, a thin stalk (the seta) that
// rises well above the cushion, red at the foot, orange then yellow higher
// (redder or more golden, some still green under the capsule), a little wavy,
// mostly upright, often in a soft S, with several gentle turns, and a capsule at the tip: a spindle,
// a long slender one, a plump one bent at the neck, a still-narrow spear, or a
// bare one with a red lid. Its body is green; the top sits in the hood, golden to
// rusty with a darker rim and faint furrows, drawn out into a long, slightly
// crooked point, dark-tipped or pale.
// They grow once the cushion has, stretch, then the capsule swells and the
// stalk ripens to orange. Each one is a bent rod on two springs, one
// swaying the tip, a quicker one bowing the middle: the wind sways it, and it
// bends away from the pointer.
// Rebuilt on the CPU every frame (a few tens of thousands of vertices), so the
// shadows, the occlusion and the depth of field all see the same shape.
import * as THREE from 'three';
import { rng, clamp, smoothstep, mix } from './noise.js';
import { plantMaterial } from './look.js';

const NS = 30; // segments of the stalk
const NC = 22; // rings of the capsule
const NB = 9; // rings of the beak, the thin point at the tip
const RINGS = NS + 1 + NC + NB;
const RS = 8; // sides
const VERTS = RINGS * RS;

// the bend along a rod pushed at its tip, 0 at the foot, 1 at the tip
const bend = (s) => (s * s * (3 - s)) / 2;

const C = (r, g, b) => new THREE.Color(r, g, b);
const YOUNG = C(0.42, 0.6, 0.1);
// two stalk palettes, each filament somewhere between: red, and golden
const FOOT_R = C(0.24, 0.035, 0.015), MID_R = C(0.78, 0.2, 0.04), TOP_R = C(0.86, 0.5, 0.1);
const FOOT_G = C(0.36, 0.12, 0.02), MID_G = C(0.86, 0.46, 0.06), TOP_G = C(0.86, 0.76, 0.2);
const TOP_GREEN = C(0.6, 0.7, 0.16); // the top of the stalk, still green on some
const CAPS_YOUNG = C(0.5, 0.66, 0.12);
const CAPS_A = C(0.22, 0.46, 0.05), CAPS_B = C(0.42, 0.6, 0.08); // deep green … yellow-green
const CAPS_RIPE = C(0.62, 0.36, 0.07); // the odd old capsule, gone orange-brown
const NECK = C(0.8, 0.55, 0.1);
const LID = C(0.55, 0.12, 0.03); // the little red lid of the bare capsules
// the hood (calyptra) sheathing the top of the capsule: golden … rusty
const HOOD_GOLD = C(0.92, 0.6, 0.08), HOOD_RUST = C(0.66, 0.24, 0.04), HOOD_GREEN = C(0.6, 0.66, 0.1);
const HOOD_EDGE = C(0.4, 0.16, 0.04);
const BEAK_DARK = C(0.22, 0.08, 0.03), BEAK_PALE = C(0.9, 0.72, 0.32);
const footC = new THREE.Color(), midC = new THREE.Color(), topC = new THREE.Color(), capC = new THREE.Color(), beakC = new THREE.Color(), hoodC = new THREE.Color();

// the shape of the tips, some of each
const KINDS = [
  // a spindle, its top in the hood, a long point
  { w: 0.38, len: [0.05, 0.075], r: [0.005, 0.0068], tilt: [0.02, 0.3], beak: [0.022, 0.045], belly: [0.38, 0.55], hood: [0.38, 0.6] },
  // long and slender, upright, a longer point
  { w: 0.26, len: [0.07, 0.1], r: [0.0038, 0.0048], tilt: [0, 0.18], beak: [0.028, 0.055], belly: [0.4, 0.6], hood: [0.45, 0.7] },
  // short and plump, bent over at the neck
  { w: 0.1, len: [0.045, 0.06], r: [0.0058, 0.0075], tilt: [0.4, 0.85], beak: [0.016, 0.032], belly: [0.35, 0.5], hood: [0.35, 0.55] },
  // still a spear: all hood, narrow, pointed
  { w: 0.16, len: [0.035, 0.06], r: [0.0036, 0.0046], tilt: [0, 0.12], beak: [0.018, 0.038], belly: [0.3, 0.45], hood: [0.05, 0.25], young: true },
  // the hood fallen: a bare capsule with a little red lid
  { w: 0.1, len: [0.045, 0.07], r: [0.0055, 0.007], tilt: [0.05, 0.4], beak: [0.003, 0.007], belly: [0.45, 0.6], hood: [2, 2], bare: true },
];
const pick = (rand) => {
  let x = rand();
  for (const k of KINDS) if ((x -= k.w) < 0) return k;
  return KINDS[0];
};
const range = (rand, [a, b]) => a + (b - a) * rand();

export function createFilaments(support, seed, { count = 46 } = {}) {
  const rand = rng(seed * 1543 + 11);
  const up = new THREE.Vector3(0, 1, 0);
  const center = support.center;

  // in a few tufts, with a few strays
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const tufts = [];
  const nTufts = 2 + Math.floor(rand() * 3);
  for (let i = 0; i < nTufts; i++) {
    let f = 1;
    while (f > 0.75) f = support.sample(rand, P, N);
    tufts.push({ x: P.x, z: P.z, r: 0.06 + rand() * 0.1, w: 0.6 + rand() });
  }
  const fils = [];
  let guard = 0;
  while (fils.length < count && guard++ < 200000) {
    const f = support.sample(rand, P, N);
    if (f > 0.88) continue;
    let p = 0.02;
    for (const t of tufts) p = Math.max(p, t.w * Math.exp(-((P.x - t.x) ** 2 + (P.z - t.z) ** 2) / (t.r * t.r)));
    if (rand() > p) continue;

    // mostly upright, leaning out from the middle a little, a few strays more
    const out = new THREE.Vector3(P.x - center.x, 0, P.z - center.z);
    const wild = rand() < 0.08;
    out.multiplyScalar(0.5).add(new THREE.Vector3((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4));
    let lean = Math.min(out.length() * 0.55, 0.28) + (wild ? 0.15 + rand() * 0.25 : 0);
    if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
    out.normalize();
    const axis = new THREE.Vector3().crossVectors(up, out).normalize();
    // many rise in an S: the foot tilted out more, righting itself higher up
    const footBend = rand() < 0.7 ? 0.1 + rand() * 0.35 : 0;
    const dir = up.clone().applyAxisAngle(axis, lean + footBend);
    const short = !wild && rand() < 0.16;
    const L = (wild ? 0.6 + rand() * 0.2 : short ? 0.14 + rand() * 0.12 : 0.3 + rand() * 0.4) * mix(1, 0.8, f);
    const capAxis = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5)).normalize();
    const kind = pick(rand);
    // turns along the stalk, each a soft bend about its own axis
    const turns = [];
    const nTurns = 3 + Math.floor(rand() * 3);
    for (let k = 0; k < nTurns; k++) {
      const a = rand() * Math.PI * 2;
      const ax = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      ax.addScaledVector(dir, -ax.dot(dir)).normalize();
      turns.push({ s: 0.1 + rand() * 0.85, w: 0.07 + rand() * 0.16, a: (0.07 + rand() * 0.17) * (rand() < 0.5 ? -1 : 1), ax });
    }
    const ripeCaps = !kind.young && rand() < 0.14;
    fils.push({
      kind,
      turns,
      footBend,
      kink: (rand() - 0.5) * 0.3, // a little bend just under the capsule
      warm: rand(), // red … golden stalk
      greenTop: kind.young ? 0.5 + rand() * 0.4 : rand() < 0.35 ? rand() * 0.7 : 0,
      capMix: rand(),
      capRipe: ripeCaps ? 0.5 + rand() * 0.5 : 0,
      beakLen: range(rand, kind.beak),
      beakDark: rand() < 0.55 ? 0.5 + rand() * 0.5 : rand() * 0.3, // a dark tip, or pale
      beakBend: (rand() - 0.5) * 0.8,
      hood: range(rand, kind.hood), // where the hood starts along the capsule
      hoodLip: 0.07 + rand() * 0.12,
      hoodMix: rand() * rand(),
      hoodGreen: kind.young ? 0.2 + rand() * 0.4 : rand() * rand() * 0.3,
      fill: 0.5 + rand() * 0.35, // the capsule's profile: lower is more cylindrical
      belly: range(rand, kind.belly), // where the capsule is fullest
      ridges: rand() < 0.7 ? 0.05 + rand() * 0.08 : 0.02, // furrows along the capsule
      shade: 0.85 + rand() * 0.3,
      base: P.clone().addScaledVector(N, -0.01),
      dir,
      axis,
      curve: (wild ? 0.25 : 0.06) + (rand() - 0.35) * 0.25,
      L,
      r0: (0.0022 + rand() * 0.0012) * (short ? 0.85 : 1),
      capLen: range(rand, kind.len) * (short ? 0.8 : 1) * 1.15,
      capR: range(rand, kind.r) * (short ? 0.85 : 1) * 0.86,
      capAxis,
      capTilt: range(rand, kind.tilt),
      birth: 0.32 + rand() * 0.3 + f * 0.05,
      dur: 0.32 + rand() * 0.12,
      ripe: kind.young ? 0.3 + rand() * 0.5 : 0.75 + rand() * 0.45, // how far it ripens to orange
      phase: rand() * 100,
      stiff: 0.85 + rand() * 0.45,
      D: new THREE.Vector3(),
      D2: new THREE.Vector3(), // a second, quicker sway, bulging the middle
      V2: new THREE.Vector3(),
      V: new THREE.Vector3(),
      rest: Array.from({ length: NS + 1 }, () => new THREE.Vector3()),
      q: Array.from({ length: NS + 1 }, () => new THREE.Vector3()),
    });
  }

  // the geometry: every filament a tube of RINGS rings of RS vertices
  const n = fils.length;
  const positions = new Float32Array(n * VERTS * 3);
  const normals = new Float32Array(n * VERTS * 3);
  const colors = new Float32Array(n * VERTS * 3);
  const index = [];
  for (let f = 0; f < n; f++) {
    const o = f * VERTS;
    for (let j = 0; j < RINGS - 1; j++)
      for (let i = 0; i < RS; i++) {
        const a = o + j * RS + i, b = o + j * RS + ((i + 1) % RS);
        index.push(a, b + RS, b, a, a + RS, b + RS);
      }
  }
  const geo = new THREE.BufferGeometry();
  const posAttr = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  const nrmAttr = new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', posAttr);
  geo.setAttribute('normal', nrmAttr);
  geo.setAttribute('color', colAttr);
  geo.setIndex(index);
  const material = plantMaterial({ roughness: 0.32, through: 0xffb45a, amount: 1.4, side: THREE.FrontSide });
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;

  // scratch
  const centre = Array.from({ length: RINGS }, () => new THREE.Vector3());
  const radius = new Float32Array(RINGS);
  const ridge = new Float32Array(RINGS); // the depth of the furrows
  const ringCol = Array.from({ length: RINGS }, () => new THREE.Color());
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), d = new THREE.Vector3();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), F = new THREE.Vector3();
  const tipT = new THREE.Vector3(), cdir = new THREE.Vector3(), F2 = new THREE.Vector3();

  const POINTER_R = 0.11;
  const K = 38, ZETA = 0.42;

  // t: the growth 0 … 1, dt: seconds since the last frame, time: seconds,
  // ray: the pointer's ray (or null)
  function update(t, dt, time, ray) {
    const gust = 0.55 + 0.45 * Math.sin(time * 0.31) * Math.sin(time * 0.17 + 1.3);
    for (let fi = 0; fi < n; fi++) {
      const fl = fils[fi];
      const u = (t - fl.birth) / fl.dur;
      const gs = clamp(u / 0.75);
      const grow = 1 - Math.pow(1 - gs, 2.2);
      const cap = smoothstep(0.55, 1.05, u);
      const ripe = smoothstep(0.75, 1.6, u) * fl.ripe;
      const Lc = Math.max(fl.L * grow, 1e-4);
      footC.copy(FOOT_R).lerp(FOOT_G, fl.warm);
      midC.copy(MID_R).lerp(MID_G, fl.warm);
      topC.copy(TOP_R).lerp(TOP_G, fl.warm);

      // the rest shape: a slightly arched rod, unrolling as it grows (young
      // ones straighter)
      const curve = fl.curve * grow;
      fl.rest[0].copy(fl.base);
      for (let i = 1; i <= NS; i++) {
        const s = (i - 0.5) / NS;
        tmp.copy(fl.dir).applyAxisAngle(fl.axis, curve * s - fl.footBend * mix(0.4, 1, grow) * smoothstep(0.02, 0.5, s) + fl.kink * grow * smoothstep(0.8, 1, s));
        for (const tn of fl.turns) tmp.applyAxisAngle(tn.ax, tn.a * grow * smoothstep(tn.s - tn.w, tn.s + tn.w, s));
        fl.rest[i].copy(fl.rest[i - 1]).addScaledVector(tmp, Lc / NS);
      }
      tipT.subVectors(fl.rest[NS], fl.rest[NS - 1]).normalize();

      // the forces at the tip: the wind, and the pointer
      F.set(
        Math.sin(time * 1.3 + fl.phase) + 0.6 * Math.sin(time * 2.9 + fl.phase * 1.7) + 0.9,
        0,
        Math.sin(time * 1.1 + fl.phase * 0.7) * 0.7 + 0.3 * Math.sin(time * 3.3 + fl.phase),
      ).multiplyScalar(0.012 * gust * K * (Lc / 0.6) * (Lc / 0.6));
      const wind2 = 0.006 * gust * K * (Lc / 0.6) * (Lc / 0.6);
      F2.set(
        (Math.sin(time * 2.3 + fl.phase * 1.3) + 0.5 * Math.sin(time * 4.1 + fl.phase * 0.6)) * wind2,
        0,
        (Math.sin(time * 2.7 + fl.phase * 0.9) + 0.4 * Math.sin(time * 3.7 + fl.phase * 2.1)) * wind2,
      );
      if (ray && grow > 0.02) {
        let best = 0;
        tmp2.set(0, 0, 0);
        for (let i = 3; i <= NS; i += 3) {
          const q = fl.q[i];
          d.subVectors(q, ray.origin);
          const along = d.dot(ray.direction);
          if (along < 0) continue;
          d.addScaledVector(ray.direction, -along); // from the ray to the point
          const dist = d.length();
          if (dist >= POINTER_R) continue;
          const s = i / NS;
          const pen = ((POINTER_R - dist) / Math.max(bend(s), 0.12)) * (1 + 0.4 * (1 - dist / POINTER_R));
          if (pen > best) {
            best = pen;
            if (dist < 1e-5) d.crossVectors(ray.direction, up);
            tmp2.copy(d).normalize().multiplyScalar(pen);
          }
        }
        if (best > 0) {
          // only across the stalk, and not down into the moss
          tmp2.addScaledVector(tipT, -tmp2.dot(tipT));
          F.addScaledVector(tmp2, K * 1.25);
          F2.addScaledVector(tmp2, K * 0.35);
        }
      }

      // the spring
      const k = K * fl.stiff, c = 2 * ZETA * Math.sqrt(k);
      const steps = 3, h = dt / steps;
      for (let sI = 0; sI < steps; sI++) {
        tmp.copy(fl.D).multiplyScalar(-k).addScaledVector(fl.V, -c).add(F);
        fl.V.addScaledVector(tmp, h);
        fl.D.addScaledVector(fl.V, h);
      }
      const maxD = fl.L * 0.9;
      if (fl.D.length() > maxD) fl.D.setLength(maxD);
      const k2 = k * 3.2, c2 = 2 * 0.38 * Math.sqrt(k2);
      for (let sI = 0; sI < steps; sI++) {
        tmp.copy(fl.D2).multiplyScalar(-k2).addScaledVector(fl.V2, -c2).add(F2);
        fl.V2.addScaledVector(tmp, h);
        fl.D2.addScaledVector(fl.V2, h);
      }
      if (fl.D2.length() > fl.L * 0.12) fl.D2.setLength(fl.L * 0.12);

      // the bent shape, kept the same length: each segment along the bent
      // direction, its rest length
      const scaleD = Lc / fl.L;
      fl.q[0].copy(fl.base);
      let prevX = fl.base.x, prevY = fl.base.y, prevZ = fl.base.z;
      for (let i = 1; i <= NS; i++) {
        const b = bend(i / NS) * scaleD, b2 = Math.sin(Math.PI * i / NS) * scaleD;
        const x = fl.rest[i].x + fl.D.x * b + fl.D2.x * b2, y = fl.rest[i].y + fl.D.y * b + fl.D2.y * b2, z = fl.rest[i].z + fl.D.z * b + fl.D2.z * b2;
        d.set(x - prevX, y - prevY, z - prevZ).setLength(Lc / NS);
        fl.q[i].copy(fl.q[i - 1]).add(d);
        prevX = x; prevY = y; prevZ = z;
      }

      // the centre line and radius of the tube, the stalk then the capsule
      for (let i = 0; i <= NS; i++) {
        centre[i].copy(fl.q[i]);
        const s = i / NS;
        radius[i] = fl.r0 * mix(1, 0.65, s) * (0.4 + 0.6 * grow);
        const c = ringCol[i];
        c.copy(footC).lerp(midC, smoothstep(0, 0.45, s)).lerp(topC, smoothstep(0.5, 1, s));
        c.lerp(TOP_GREEN, fl.greenTop * smoothstep(0.55, 1, s));
        c.lerp(YOUNG, 1 - ripe);
        c.multiplyScalar(fl.shade * (1 + 0.07 * Math.sin(s * 37 + fl.phase) * Math.sin(s * 13 + fl.phase * 2)));
        c.multiplyScalar(mix(0.3, 1, smoothstep(0.01, 0.09, s * Lc))); // shaded down in the moss
      }
      tipT.subVectors(fl.q[NS], fl.q[NS - 1]).normalize();
      cdir.copy(tipT).applyAxisAngle(fl.capAxis, fl.capTilt * cap);
      const cl = fl.capLen * (0.25 + 0.75 * cap);
      const tipR = radius[NS];
      capC.copy(CAPS_A).lerp(CAPS_B, fl.capMix).lerp(CAPS_RIPE, fl.capRipe * ripe);
      hoodC.copy(HOOD_GOLD).lerp(HOOD_RUST, fl.hoodMix).lerp(HOOD_GREEN, fl.hoodGreen);
      hoodC.lerp(CAPS_YOUNG, clamp(1 - ripe) * 0.6);
      beakC.copy(BEAK_PALE).lerp(BEAK_DARK, fl.beakDark);
      const kind = fl.kind;
      const ex = Math.log(0.5) / Math.log(fl.belly); // the belly where asked
      const hs = fl.hood;
      for (let j = 1; j <= NC; j++) {
        const w = j / NC;
        // curving from the stalk's direction into the capsule's
        tmp.copy(tipT).lerp(cdir, smoothstep(0, 0.45, w)).normalize();
        centre[NS + j].copy(centre[NS + j - 1]).addScaledVector(tmp, cl / NC);
        // narrow neck, full belly, tapering into the point; the hood's lower
        // edge stands a little proud of the capsule
        const belly = Math.pow(Math.sin(Math.PI * Math.pow(w, ex)), fl.fill);
        const inHood = smoothstep(hs - 0.025, hs + 0.025, w);
        // (the hood keeps some girth at the end: it goes on into a long cone)
        const cone = kind.bare ? 0 : fl.capR * cap * 0.38 * smoothstep(hs, 1, w);
        radius[NS + j] = Math.max(mix(tipR, tipR * 0.6, w), fl.capR * cap * belly, cone) * (1 + fl.hoodLip * inHood * cap);
        ridge[NS + j] = fl.ridges * cap * Math.sin(Math.PI * w) * (1 + inHood);
        const c = ringCol[NS + j];
        c.copy(NECK).lerp(capC, smoothstep(0.04, 0.22, w));
        c.lerp(CAPS_YOUNG, (1 - ripe * 0.9) * (1 - fl.capRipe * 0.5));
        if (kind.bare) c.lerp(LID, smoothstep(0.8, 0.95, w) * ripe);
        else {
          // the hood: a darker rim, then golden or rusty, darker towards the point
          c.lerp(hoodC, inHood);
          c.lerp(HOOD_EDGE, 0.55 * Math.exp(-(((w - hs - 0.03) / 0.035) ** 2)) * cap);
          c.lerp(beakC, smoothstep(hs + 0.2, 1.3, w) * 0.5);
        }
      }
      // the beak: the hood drawn out into a fine point, slightly crooked
      const bl = fl.beakLen * (0.3 + 0.7 * cap) * (0.4 + 0.6 * grow);
      const baseR = radius[NS + NC];
      tmp2.copy(cdir);
      for (let j = 1; j <= NB; j++) {
        const v = j / NB;
        tmp2.applyAxisAngle(fl.capAxis, (fl.beakBend * cap) / NB);
        const k = NS + NC + j;
        centre[k].copy(centre[k - 1]).addScaledVector(tmp2, bl / NB);
        radius[k] = j === NB ? 0 : baseR * Math.pow(1 - v, kind.bare ? 1.2 : 1.5);
        ridge[k] = 0;
        ringCol[k].copy(ringCol[NS + NC]).lerp(kind.bare ? LID : beakC, smoothstep(0, 0.85, v) * (0.4 + 0.6 * ripe));
      }

      // the rings, with frames carried along the line
      const o = fi * VERTS * 3;
      for (let j = 0; j < RINGS; j++) {
        const a = centre[Math.max(j - 1, 0)], b = centre[Math.min(j + 1, RINGS - 1)];
        T.subVectors(b, a);
        if (T.lengthSq() < 1e-14) T.copy(tipT);
        T.normalize();
        if (j === 0) {
          Nn.crossVectors(T, fl.axis);
          if (Nn.lengthSq() < 1e-6) Nn.crossVectors(T, up);
          Nn.normalize();
        } else {
          Nn.addScaledVector(T, -Nn.dot(T)).normalize();
        }
        B.crossVectors(T, Nn);
        const r = radius[j], cc = ringCol[j], p = centre[j], rg = ridge[j];
        for (let i = 0; i < RS; i++) {
          const ang = (i / RS) * Math.PI * 2;
          const cs = Math.cos(ang), sn = Math.sin(ang);
          let nx = Nn.x * cs + B.x * sn, ny = Nn.y * cs + B.y * sn, nz = Nn.z * cs + B.z * sn;
          const k3 = o + (j * RS + i) * 3;
          // the capsule's furrows: crests and grooves, the crests paler
          const fr = rg * Math.cos(ang * 4 + 0.4);
          const rr = r * (1 + fr);
          positions[k3] = p.x + nx * rr;
          positions[k3 + 1] = p.y + ny * rr;
          positions[k3 + 2] = p.z + nz * rr;
          if (rg > 0) {
            const tq = (-4 * rg * Math.sin(ang * 4 + 0.4)) / (1 + fr); // the slope around the ring
            const tx = -Nn.x * sn + B.x * cs, ty = -Nn.y * sn + B.y * cs, tz = -Nn.z * sn + B.z * cs;
            nx -= tx * tq; ny -= ty * tq; nz -= tz * tq;
            const l = 1 / Math.hypot(nx, ny, nz);
            nx *= l; ny *= l; nz *= l;
          }
          normals[k3] = nx;
          normals[k3 + 1] = ny;
          normals[k3 + 2] = nz;
          const lit = 1 + fr * 3;
          colors[k3] = cc.r * lit;
          colors[k3 + 1] = cc.g * lit;
          colors[k3 + 2] = cc.b * lit;
        }
      }
    }
    posAttr.needsUpdate = true;
    nrmAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  return {
    group: mesh,
    count: n,
    update,
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
