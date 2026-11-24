// The meteorite: no arm carries it. A burning rock flying on its own orbit,
// which is nothing like the planets'. The orbit is a long, narrow ellipse
// tilted 34° to their plane, the sun at a focus. It whips round under the
// lamp at perihelion, comes up through the plane in the gap between Earth and
// Mars, climbs high over the machine at aphelion, and dives back in close by
// the lamp. It obeys Kepler: slow at the top, quick at the bottom.
//  - the rock: an angular, chipped shard, spinning about its path, its leading face white-hot and
//    lava glowing in its cracks,
//  - three small shards it has shed, flying behind it, burning too,
//  - its fire: puffs of flame torn off its face and left behind, white-hot,
//    then orange, red and out in a short plume, and sparks,
//  - thin white streaks close round it, each a short arc of its path, shot
//    backwards out of the rock and then wiped, as if it tore the air,
//  - its orbit: a faint continuous hairline,
//  - a warm flickering light thrown on the brass as it passes.
import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLSL_NOISE, rng, noise3, fbm } from './noise.js';

const A = 1.48, B = 0.99; // the half-axes of the ellipse: long and narrow
const E = Math.sqrt(1 - (B * B) / A / A);
const Q = A * (1 - E), AP = A * (1 + E); // perihelion (0.38, grazing the lamp) and aphelion (2.58)
// the line of nodes is turned so that, on its way out, it crosses the
// planets' plane at NODE from the sun: between Earth's orbit (1.28) and
// Mars' (1.66). (It crosses back in at 0.42, just outside the lamp.)
const NODE = 1.47;
const OMEGA = -Math.acos(((B * B) / A / NODE - 1) / E); // the perihelion's angle from the node
const INC = 0.6; // the tilt to the planets' plane (34°)
const CYCLE = 24; // years: the machine's great cycle, in which every path closes
const TURNS = 54; // the meteorite's turns in it
const PERIOD = CYCLE / TURNS; // in Earth years (0.44: about 14 s at speed 1)
const PHASE0 = -0.09; // starts on its way in, a few seconds from perihelion
const SIZE = 0.036; // the rock

// a shard of rock: a lump cut down by many planes into an angular, chipped
// block, longer than it is wide, with a few craters and a rough skin
function rockGeometry(size, seed, detail, stretch = [1.6, 0.95, 0.72], { cuts = 11, craters = 3 } = {}) {
  const R = rng(seed), n = noise3(seed);
  const dir = () => {
    const z = R() * 2 - 1, t = R() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return new THREE.Vector3(Math.cos(t) * s, z, Math.sin(t) * s);
  };
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g); // shared vertices: no seams
  const bumps = Array.from({ length: 4 }, () => [dir(), (R() - 0.3) * 0.5, 2 + R() * 3]);
  const pits = Array.from({ length: craters }, () => [dir(), 0.2 + R() * 0.25, 0.04 + R() * 0.05]);
  // the planes, in the stretched space so the faces stay flat
  const planes = Array.from({ length: cuts }, () => {
    const d = dir(), k = Math.hypot(d.x * stretch[0], d.y * stretch[1], d.z * stretch[2]);
    return [d, k * (0.62 + R() * 0.26)];
  });
  const pos = g.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const u = v.clone();
    let s = 1;
    for (const [d, h, k] of bumps) s += h * Math.pow(Math.max(0, v.dot(d)), k);
    s += 0.08 * fbm(n, v.x * 1.5, v.y * 1.5, v.z * 1.5, 3);
    v.multiplyScalar(s).set(v.x * stretch[0], v.y * stretch[1], v.z * stretch[2]);
    // chipped off: pulled back radially onto each plane it pokes through
    for (const [d, h] of planes) {
      const c = v.dot(d);
      if (c > h) v.multiplyScalar(h / c);
    }
    let r = 1 + 0.018 * fbm(n, u.x * 9 + 5, u.y * 9, u.z * 9, 3); // the rough skin
    for (const [c, rc, depth] of pits) {
      const t = u.distanceTo(c) / rc;
      if (t < 1.6) r += depth * ((t < 1 ? t * t - 1 : 0) + 0.35 * Math.exp(-(((t - 1) / 0.22) ** 2)));
    }
    v.multiplyScalar(size * r);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  // crisp edges between the faces, smooth within them
  return toCreasedNormals(g, 0.6);
}

export function createComet(sunPos, start = PHASE0) {
  const group = new THREE.Group();
  const U = { uTime: { value: 0 }, uPhase: { value: 0 }, uScale: { value: 800 }, uHeat: { value: 1 } };

  // the orbit's frame: perihelion below the plane on the far side from the
  // giant; the minor axis (where it crosses the plane) lies in the plane
  const hdir = new THREE.Vector3(0.986, 0, 0.164).normalize();
  const nodes = new THREE.Vector3(0, 1, 0).cross(hdir).normalize(); // the line of nodes
  const M = new THREE.Vector3(0, Math.sin(INC), 0).addScaledVector(hdir, -Math.cos(INC)); // in the orbit's plane, ⊥ nodes
  const X = nodes.clone().multiplyScalar(Math.cos(OMEGA)).addScaledVector(M, Math.sin(OMEGA)); // towards perihelion
  const Y = nodes.clone().multiplyScalar(-Math.sin(OMEGA)).addScaledVector(M, Math.cos(OMEGA));
  const N = new THREE.Vector3().crossVectors(X, Y); // the orbit's normal
  // a point on the ellipse from its eccentric anomaly (the sun at a focus)
  const at = (Ea, v = new THREE.Vector3()) =>
    v.copy(sunPos).addScaledVector(X, A * (Math.cos(Ea) - E)).addScaledVector(Y, B * Math.sin(Ea));
  const kepler = (M) => { // mean → eccentric anomaly
    let Ea = M + E * Math.sin(M);
    for (let k = 0; k < 8; k++) Ea -= (Ea - E * Math.sin(Ea) - M) / (1 - E * Math.cos(Ea));
    return Ea;
  };
  // the eccentric anomaly a distance `dist` back along the orbit from Ea
  const back = (Ea, dist) => {
    const h = 0.004;
    for (;;) {
      const sp = Math.hypot(A * Math.sin(Ea), B * Math.cos(Ea)); // |dP/dEa|
      if (sp * h >= dist) return Ea - dist / sp;
      dist -= sp * h;
      Ea -= h;
    }
  };

  // ---- the orbit: a faint hairline. About the Sun it is the ellipse; seen
  // from anywhere else it is the ellipse carried round on the Sun's own
  // motion about the centre, a different loop each turn, closing only after
  // the TURNS turns of the great cycle. So it is drawn whole, a tube sampled
  // evenly in eccentric anomaly over all the turns, each point where the
  // meteorite is at that time plus where the Sun is then; refilled whenever
  // the Sun's motion changes (all through a change of centre). A glow runs
  // along it behind the rock, once the turns have come apart.
  const SEG = 480, NP = SEG * TURNS, RAD = 4, PATH_R = 0.0028;
  const pPos = new Float32Array(NP * RAD * 3), pT = new Float32Array(NP * RAD);
  const pIndex = new Uint32Array(NP * RAD * 6);
  const line = new Float32Array(NP * 3), lineT = new Float32Array(NP);
  for (let i = 0, q = 0; i < NP; i++) {
    const i2 = (i + 1) % NP;
    for (let j = 0; j < RAD; j++) {
      const j2 = (j + 1) % RAD;
      const a = i * RAD + j, b = i2 * RAD + j, c = i2 * RAD + j2, d = i * RAD + j2;
      pIndex[q++] = a; pIndex[q++] = d; pIndex[q++] = b;
      pIndex[q++] = d; pIndex[q++] = c; pIndex[q++] = b;
    }
    // the time of each sample, from its eccentric anomaly by Kepler
    const k = Math.floor(i / SEG), Ea = ((i % SEG) / SEG) * Math.PI * 2;
    lineT[i] = (k + (Ea - E * Math.sin(Ea)) / (Math.PI * 2) - start) * PERIOD;
    for (let j = 0; j < RAD; j++) pT[i * RAD + j] = ((lineT[i] % CYCLE) + CYCLE) % CYCLE;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setIndex(new THREE.BufferAttribute(pIndex, 1));
  const pAttr = new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage);
  pGeo.setAttribute('position', pAttr);
  pGeo.setAttribute('aT', new THREE.BufferAttribute(pT, 1));
  const PU = { uNow: { value: 0 }, uSpan: { value: PERIOD }, uFloor: { value: 1 / TURNS }, uGlow: { value: 0 } };
  const path = new THREE.Mesh(pGeo, new THREE.ShaderMaterial({
    uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aT;
      varying float vT;
      void main() {
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNow, uSpan, uFloor, uGlow;
      varying float vT;
      void main() {
        float age = mod(uNow - vT, ${CYCLE.toFixed(1)}) / uSpan;
        vec3 c = vec3(0.2, 0.16, 0.12) * uFloor;
        if (age < 1.0) c += vec3(1.3, 0.62, 0.26) * pow(1.0 - age, 2.2) * uGlow;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  path.renderOrder = 2;
  path.frustumCulled = false;
  const root = new THREE.Group(); // the path, fixed; the rest rides with the Sun
  root.add(group, path);

  let source = null, filled = null;
  const sunNow = new THREE.Vector3(), tv = new THREE.Vector3(), nv = new THREE.Vector3(), bv = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const sunAtT = (t, v) => (source ? source.sunAt(t, v) : v.copy(sunPos));
  // ---- where the rock really is: on its ellipse, carried with the Sun. A
  // point of the ellipse is passed at a time of its own: `timeAt` is when it
  // is at eccentric anomaly e, being at Ea0 at t0 (e unwound near Ea0)
  const meanOf = (Ea) => Ea - E * Math.sin(Ea);
  const timeAt = (e, Ea0, t0) => t0 + ((meanOf(e) - meanOf(Ea0)) / (Math.PI * 2)) * PERIOD;
  const so = new THREE.Vector3(), w1 = new THREE.Vector3(), w2 = new THREE.Vector3();
  const onPath = (e, t, v) => { sunAtT(t, so); return at(e, v).add(so).sub(sunPos); };
  // the direction it really flies in there (the Sun's motion added)
  const pathVel = (e, t, v) => {
    const h = 0.002;
    onPath(e - h, timeAt(e - h, e, t), w1);
    onPath(e + h, timeAt(e + h, e, t), w2);
    return v.subVectors(w2, w1).normalize();
  };
  // a frame across the path: side, and up out of it
  const across = (fv, side, up) => {
    side.crossVectors(fv, N);
    if (side.lengthSq() < 1e-6) side.crossVectors(fv, X);
    side.normalize();
    return up.crossVectors(side, fv);
  };
  function fillPath() {
    const ell = new THREE.Vector3();
    for (let i = 0; i < NP; i++) {
      const Ea = ((i % SEG) / SEG) * Math.PI * 2;
      sunAtT(lineT[i], ell);
      ell.addScaledVector(X, A * (Math.cos(Ea) - E)).addScaledVector(Y, B * Math.sin(Ea));
      ell.toArray(line, i * 3);
    }
    for (let i = 0; i < NP; i++) {
      const a = ((i + NP - 1) % NP) * 3, b = ((i + 1) % NP) * 3;
      tv.set(line[b] - line[a], line[b + 1] - line[a + 1], line[b + 2] - line[a + 2]).normalize();
      nv.crossVectors(tv, UP).normalize();
      bv.crossVectors(nv, tv);
      for (let j = 0; j < RAD; j++) {
        const th = (j / RAD) * Math.PI * 2, c = Math.cos(th) * PATH_R, sn = Math.sin(th) * PATH_R;
        const o = (i * RAD + j) * 3;
        pPos[o] = line[i * 3] + nv.x * c + bv.x * sn;
        pPos[o + 1] = line[i * 3 + 1] + nv.y * c + bv.y * sn;
        pPos[o + 2] = line[i * 3 + 2] + nv.z * c + bv.z * sn;
      }
    }
    pAttr.needsUpdate = true;
    // the turns lie on one another about the Sun: each a TURNS-th as bright,
    // and no glow; brighter and glowing as they come apart
    const k = THREE.MathUtils.smoothstep(source ? source.spread : 0, 0, 0.2);
    PU.uFloor.value = THREE.MathUtils.lerp(1 / TURNS, 0.22, k);
    PU.uGlow.value = 0.7 * k;
  }

  // ---- the rock, and the stone of its fragments
  const head = new THREE.Group();
  group.add(head);
  const uFront = { value: new THREE.Vector3() };
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x2e2620, roughness: 0.92, metalness: 0.1 });
  rockMat.onBeforeCompile = (sh) => {
    sh.uniforms.uFront = uFront;
    sh.uniforms.uHeat = U.uHeat;
    sh.vertexShader = 'varying vec3 vObj;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = normalize(position);');
    sh.fragmentShader = 'uniform vec3 uFront;\nuniform float uHeat;\nvarying vec3 vObj;\n' + GLSL_NOISE + sh.fragmentShader
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', /* glsl */ `
        vec4 diffuseColor = vec4( diffuse, opacity );
        // speckled stone, scorched black towards the front
        float grain = fbm3l(vObj * 9.0);
        diffuseColor.rgb *= 0.65 + 0.7 * grain;
        float front0 = dot(normalize(vNormal), uFront);
        diffuseColor.rgb *= mix(1.0, 0.35, smoothstep(-0.2, 0.6, front0));`)
      .replace('#include <emissivemap_fragment>', /* glsl */ `
      #include <emissivemap_fragment>
      // the face it flies into burns: white-hot at the front, a red rim
      float fr = dot(normal, uFront);
      float front = max(fr, 0.0);
      totalEmissiveRadiance += (vec3(4.0, 2.0, 0.8) * pow(front, 1.6) + vec3(0.9, 0.2, 0.04) * smoothstep(-0.3, 0.4, fr)) * uHeat;
      // lava in the cracks between the plates, brightest towards the front
      // a few fissures, not a net: thin cell edges, broken up by a noise
      vec3 w = worley(vObj * 2.2 + 4.0);
      float crack = smoothstep(0.035, 0.0, w.y - w.x) * smoothstep(0.5, 0.7, vnoise(vObj * 3.5 + 11.0));
      totalEmissiveRadiance += vec3(2.2, 0.6, 0.1) * crack * mix(0.25, 1.4, smoothstep(-0.6, 0.6, fr)) * uHeat;`);
  };
  const rock = new THREE.Mesh(rockGeometry(SIZE, 17, 5), rockMat);
  head.add(rock);
  // it flies long axis first, spinning about its path like a rifle ball
  const LONG = new THREE.Vector3(1, 0, 0), aim = new THREE.Quaternion(), roll = new THREE.Quaternion();
  // uFront: the direction of flight, in view space
  rock.onBeforeRender = (r, s, cam) => uFront.value.copy(vel).transformDirection(cam.matrixWorldInverse);

  const light = new THREE.PointLight(0xff9040, 0.4, 0, 2);
  head.add(light);

  // ---- the fragments: flakes of the rock flying behind it, a little off its
  // path, each tumbling and burning
  const R = rng(5);
  const frags = Array.from({ length: 3 }, (_, k) => {
    const size = SIZE * (0.2 + R() * 0.16);
    const m = new THREE.Mesh(rockGeometry(size, 40 + k, 3, [1.2 + R() * 0.5, 0.8 + R() * 0.3, 0.6 + R() * 0.3], { cuts: 7, craters: 0 }), rockMat);
    group.add(m);
    return {
      m, size, last: new THREE.Vector3(),
      lag: 0.06 + k * 0.08 + R() * 0.03, // its distance behind the rock
      off: [(R() - 0.5) * 0.07, (R() - 0.5) * 0.07], // across and above its path
      wob: R() * 6.28,
      axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
      spin: 20 + R() * 60,
    };
  });
  const fv = new THREE.Vector3(), fs = new THREE.Vector3(), fu = new THREE.Vector3();
  // where a fragment is: on the path, pushed aside across it
  const fragAt = (f, Ea, t, time, v) => {
    onPath(Ea, t, v);
    pathVel(Ea, t, fv);
    across(fv, fs, fu);
    const w = time * 0.7 + f.wob;
    return v.addScaledVector(fs, f.off[0] + 0.006 * Math.sin(w)).addScaledVector(fu, f.off[1] + 0.006 * Math.cos(w * 1.3));
  };

  // ---- the fire: no painted shape, but real puffs of flame torn off the
  // rock's burning face. Each is born white-hot at the rock, left behind as it
  // flies on, swells, cools to orange and red and goes out within a moment.
  // Sparks fly off now and then.
  function pool(n, vertexShader, fragmentShader, blending, order) {
    const P = {
      n, next: 0,
      pos: new Float32Array(n * 3), vel: new Float32Array(n * 3),
      age: new Float32Array(n).fill(1), life: new Float32Array(n),
      size: new Float32Array(n), seed: new Float32Array(n), kind: new Float32Array(n),
    };
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P.pos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(P.age, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(P.size, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(P.seed, 1));
    geo.setAttribute('aKind', new THREE.BufferAttribute(P.kind, 1));
    const pts = new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending, vertexShader, fragmentShader,
    }));
    pts.frustumCulled = false;
    pts.renderOrder = order;
    group.add(pts);
    P.geo = geo;
    return P;
  }
  const puffVS = (grow) => /* glsl */ `
    uniform float uScale;
    attribute float aAge, aSize, aSeed, aKind;
    varying float vAge, vSeed, vKind;
    void main() {
      vAge = aAge; vSeed = aSeed; vKind = aKind;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      float s = aKind > 0.5 ? aSize * (1.0 - 0.5 * aAge) : aSize * (0.5 + ${grow} * sqrt(aAge));
      gl_PointSize = aAge >= 1.0 ? 0.0 : max(1.0, uScale * s / -mv.z);
      gl_Position = projectionMatrix * mv;
    }`;
  // a ragged puff: a disc whose edge is eaten by a noise of its own
  const PUFF = /* glsl */ `
    float puff(vec2 q, float seed, float t) {
      float r = length(q) * 2.0;
      float n = fbm3l(vec3(q * 4.5 + seed * 31.0, t + seed * 7.0));
      return smoothstep(0.35 + 0.6 * n, 0.1 + 0.3 * n, r);
    }`;
  const fire = pool(2400, puffVS('1.3'), /* glsl */ `
    uniform float uHeat;
    varying float vAge, vSeed, vKind;
    ${GLSL_NOISE}
    ${PUFF}
    void main() {
      vec2 q = gl_PointCoord - 0.5;
      float a = vAge;
      if (vKind > 0.5) { // a spark: a hot pinpoint
        float f = exp(-dot(q, q) * 60.0);
        vec3 c = mix(vec3(2.0, 1.4, 0.7), vec3(1.2, 0.35, 0.06), smoothstep(0.0, 0.6, a));
        gl_FragColor = vec4(c * f * (1.0 - a) * 1.5, 1.0);
        return;
      }
      float f = puff(q, vSeed, a * 2.0);
      // white-hot, yellow, orange, a deep red, out
      vec3 c = mix(vec3(2.2, 1.8, 1.2), vec3(2.0, 0.95, 0.25), smoothstep(0.0, 0.07, a));
      c = mix(c, vec3(1.3, 0.32, 0.05), smoothstep(0.07, 0.35, a));
      c = mix(c, vec3(0.35, 0.05, 0.015), smoothstep(0.4, 0.85, a));
      gl_FragColor = vec4(c * f * pow(1.0 - a, 1.3) * 0.24 * uHeat, 1.0);
    }`, THREE.AdditiveBlending, 4);
  // ---- the streaks: thin white lines, each a short arc of the path close
  // around and behind the rock, traced and wiped in under a second
  const NS = 80, K = 12; // streaks, points on each
  const sPos = new Float32Array(NS * (K - 1) * 2 * 3), sT = new Float32Array(NS * (K - 1) * 2);
  const sAge = new Float32Array(NS * (K - 1) * 2).fill(1), sLife = new Float32Array(NS), sBorn = new Float32Array(NS).fill(-1);
  for (let i = 0; i < NS; i++) for (let j = 0; j < K - 1; j++) {
    const v = (i * (K - 1) + j) * 2;
    sT[v] = j / (K - 1); sT[v + 1] = (j + 1) / (K - 1);
  }
  const sgeo = new THREE.BufferGeometry();
  sgeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sgeo.setAttribute('aT', new THREE.BufferAttribute(sT, 1));
  sgeo.setAttribute('aAge', new THREE.BufferAttribute(sAge, 1));
  const streakLines = new THREE.LineSegments(sgeo, new THREE.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aT, aAge;
      varying float vT, vAge;
      void main() {
        vT = aT; vAge = aAge;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uHeat;
      varying float vT, vAge;
      void main() {
        if (vAge >= 1.0) discard;
        // the line stays put and is traced along its arc: its head runs
        // back from the end nearest the rock, as if shot out of it, then its
        // tail follows and wipes it out
        float u = vT; // 0 at the end nearest the rock, 1 at the far one
        float head = smoothstep(0.0, 0.65, vAge), tail = smoothstep(0.35, 1.0, vAge);
        float on = smoothstep(tail, tail + 0.1, u) * (1.0 - smoothstep(head - 0.12, head, u));
        // brighter towards its head
        float b = on * (0.35 + 0.65 * clamp((u - tail) / max(head - tail, 1e-3), 0.0, 1.0));
        gl_FragColor = vec4(vec3(1.5, 1.45, 1.3) * b * 1.3 * uHeat, 1.0);
      }`,
  }));
  streakLines.frustumCulled = false;
  streakLines.renderOrder = 4;
  group.add(streakLines);
  let sNext = 0, sOwed = 0;
  const sp = new THREE.Vector3(), sv = new THREE.Vector3(), ss = new THREE.Vector3(), su = new THREE.Vector3();
  function streak(Ea, years, time) {
    const i = sNext; sNext = (sNext + 1) % NS;
    // where: a little ahead to well behind the rock, off its path in a cone
    const d0 = -SIZE + Math.random() * Math.random() * 0.15;
    const len = 0.1 + Math.random() * 0.2;
    const th = Math.random() * Math.PI * 2;
    const rad = SIZE * (0.25 + 0.5 * Math.random()) * (1 + d0 * 1.5);
    const ca = Math.cos(th) * rad, sa = Math.sin(th) * rad;
    let prev = null;
    for (let j = 0; j < K; j++) {
      const d = d0 + (len * j) / (K - 1);
      const e = d >= 0 ? back(Ea, d) : Ea - d / Math.hypot(A * Math.sin(Ea), B * Math.cos(Ea));
      const te = timeAt(e, Ea, years);
      onPath(e, te, sp);
      pathVel(e, te, sv);
      across(sv, ss, su);
      sp.addScaledVector(ss, ca).addScaledVector(su, sa);
      if (prev) {
        const v = (i * (K - 1) + j - 1) * 2;
        sPos.set(prev, v * 3);
        sp.toArray(sPos, (v + 1) * 3);
      }
      prev = sp.toArray();
    }
    sBorn[i] = time;
    sLife[i] = 0.5 + Math.random() * 0.4;
  }
  function stepStreaks(time) {
    for (let i = 0; i < NS; i++) {
      const age = sBorn[i] < 0 ? 1 : Math.min(1, (time - sBorn[i]) / sLife[i]);
      for (let v = i * (K - 1) * 2; v < (i + 1) * (K - 1) * 2; v++) sAge[v] = age;
    }
    sgeo.attributes.position.needsUpdate = true;
    sgeo.attributes.aAge.needsUpdate = true;
  }

  const rnd = new THREE.Vector3(), q = new THREE.Vector3();
  function emit(P, at, spread, fwd, back, life, size, kind = 0, spd = 0) {
    const i = P.next; P.next = (P.next + 1) % P.n;
    rnd.randomDirection();
    // from the rock's skin, more on its leading face
    const f = Math.random() * fwd;
    P.pos[i * 3] = at.x + rnd.x * spread + vel.x * f;
    P.pos[i * 3 + 1] = at.y + rnd.y * spread + vel.y * f;
    P.pos[i * 3 + 2] = at.z + rnd.z * spread + vel.z * f;
    // blown back off the rock, spreading a little; sparks fly off fast
    const b = back * (0.5 + Math.random());
    rnd.randomDirection().multiplyScalar(spd || back * 0.35);
    P.vel[i * 3] = -vel.x * b + rnd.x;
    P.vel[i * 3 + 1] = -vel.y * b + rnd.y;
    P.vel[i * 3 + 2] = -vel.z * b + rnd.z;
    P.age[i] = 0;
    P.life[i] = life * (0.6 + 0.8 * Math.random());
    P.size[i] = size * (0.6 + 0.8 * Math.random());
    P.seed[i] = Math.random();
    P.kind[i] = kind;
  }
  function step(P, dts, drag) {
    const damp = Math.exp(-dts * drag);
    for (let i = 0; i < P.n; i++) {
      if (P.age[i] >= 1) continue;
      P.age[i] = Math.min(1, P.age[i] + dts / P.life[i]);
      P.vel[i * 3] *= damp; P.vel[i * 3 + 1] *= damp; P.vel[i * 3 + 2] *= damp;
      P.pos[i * 3] += P.vel[i * 3] * dts;
      P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dts;
      P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dts;
    }
    for (const k of ['position', 'aAge', 'aSize', 'aSeed', 'aKind']) P.geo.attributes[k].needsUpdate = true;
  }
  // a burning body: fire and sparks along the way it flew this frame
  function burn(body, from, to, size, rate, dts, heat) {
    body.owed = (body.owed || 0) + rate * dts * (0.5 + 0.5 * heat);
    const n = Math.min(Math.floor(body.owed), 200);
    body.owed -= n;
    for (let k = 0; k < n; k++) {
      q.lerpVectors(from, to, Math.random());
      emit(fire, q, size * 0.5, size * 0.6, 0.08, 0.22, size * 1.4);
      if (Math.random() < 0.04) emit(fire, q, size * 0.5, size, 0.05, 0.5, 0.006, 1, 0.25);
    }
  }

  // ---- each frame
  const p = new THREE.Vector3(), vel = new THREE.Vector3(), last = new THREE.Vector3();
  const lastVel = new THREE.Vector3(), turn = new THREE.Quaternion();
  let hasLast = false;
  function update(years, dts, time) {
    U.uTime.value = time % 1000;
    // the rock is carried with the Sun, about whatever centre; what it sheds
    // (fire, streaks) stays where it was left, along the path it really took
    const key = source ? source.frame : '';
    if (key !== filled) { fillPath(); filled = key; }
    sunAtT(years, sunNow);
    PU.uNow.value = ((years % CYCLE) + CYCLE) % CYCLE;
    const phase = years / PERIOD + start;
    const ph = ((phase % 1) + 1) % 1;
    U.uPhase.value = ph;
    const Ea = kepler(ph * Math.PI * 2);
    onPath(Ea, years, p);
    pathVel(Ea, years, vel);
    head.position.copy(p);
    // its long axis kept on its line of flight, turned on smoothly from one
    // frame to the next however the line swings, and spun about it
    if (!hasLast || p.distanceTo(last) > 0.5) aim.setFromUnitVectors(LONG, vel);
    else aim.premultiply(turn.setFromUnitVectors(lastVel, vel));
    lastVel.copy(vel);
    roll.setFromAxisAngle(LONG, years * 90);
    rock.quaternion.multiplyQuaternions(aim, roll);
    const r = p.distanceTo(sunNow);
    // it burns hotter near the sun, and flickers
    const heat = Math.pow(Q / r, 0.8);
    U.uHeat.value = 0.5 + 0.5 * heat;
    light.intensity = (0.1 + 0.5 * heat) * (0.85 + 0.15 * Math.sin(time * 21) * Math.sin(time * 13.7));

    // a jump (a new start): don't fill in the way between
    const jump = !hasLast || p.distanceTo(last) > 0.5;
    if (jump) last.copy(p);
    hasLast = true;
    if (dts > 0) burn(head, last, p, SIZE, 700, dts, heat);
    last.copy(p);
    for (const f of frags) {
      const Ef = back(Ea, f.lag);
      fragAt(f, Ef, timeAt(Ef, Ea, years), time, f.m.position);
      f.m.quaternion.setFromAxisAngle(f.axis, years * f.spin);
      if (jump) f.last.copy(f.m.position);
      if (dts > 0) burn(f, f.last, f.m.position, f.size, 120, dts, heat);
      f.last.copy(f.m.position);
    }
    stepStreaks(time);
    if (dts > 0) {
      step(fire, dts, 1.2);
      // the streaks, more of them the faster it flies
      sOwed += dts * 40 * (0.4 + 0.6 * heat);
      for (; sOwed >= 1; sOwed--) streak(Ea, years, time);
    }
  }

  return {
    group: root,
    update,
    // something that knows where the Sun is about the centre at any time
    follow(src) { source = src; filled = null; },
    head,
    setScale(h) { U.uScale.value = h; },
  };
}
