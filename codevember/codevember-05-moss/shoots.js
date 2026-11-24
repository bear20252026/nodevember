// The short, dense part of the moss: thousands of little leafy shoots, a thin
// stem clothed in narrow, pointed leaves set in five ranks, spreading over the soil
// from a few spots until they cover it all: wandering, forking, leaning every
// which way, wound through each other into a tangle.
// Among them, a second kind: long, simple runners, like lianas, arching out of
// the moss and back into it, winding as they go, their tips curled up.
import * as THREE from 'three';
import { rng, clamp, smoothstep, mix, noise3, fbm } from './noise.js';
import { plantMaterial } from './look.js';

const VARIANTS = 10;
const LIANAS = 4; // variants of the second kind: long, simple runners
const LIANA_SHARE = 0.09; // of all the short fibres
const TURN = Math.PI * 0.8; // 2/5 phyllotaxis: leaves in five ranks, slightly twisted

// one shoot, about 1 high along +y, as an indexed geometry with vertex colours:
// a slender, wandering stem — it leans, kinks and bends back up — forking into
// a few side branches, all clothed in narrow, pointed leaves: spreading and
// brown low down (old, dead), green higher, closed into a pointed bud at each
// tip, the tips paler and see-through. Neighbouring shoots, set at all angles,
// wind through each other into a tangle.
function shootGeometry(rand, { leaves = 26, length = 0.27, width = 0.032, spread = 1, lean = 0.25, branches = 2, sprawl = 0, liana = false } = {}) {
  const pos = [], col = [], idx = [];
  const c = new THREE.Color();
  const push = (x, y, z, color) => {
    pos.push(x, y, z);
    col.push(color.r, color.g, color.b);
    return pos.length / 3 - 1;
  };
  const Y = new THREE.Vector3(0, 1, 0);
  // a path walked from a point: its heading drifts, kinks and turns as it goes
  // (a rotating bend axis gives S-bends and corkscrews), pulled back up a
  // little at the end, as stems that fell over rise again towards the light;
  // the tip often curls over into a hook, like a crozier
  function walk(from, heading, len, { bend = 1.2, rise = 0.6, steps = 12, hook = 0 } = {}) {
    const pts = [from.clone()];
    const d = heading.clone().normalize();
    const p = from.clone();
    let ax = rand() * Math.PI * 2;
    const spin = (rand() - 0.5) * 11;
    const k1 = rand() * 6, f1 = 3 + rand() * 4;
    const tmp = new THREE.Vector3();
    const hookAxis = new THREE.Vector3(rand() - 0.5, 0, rand() - 0.5).cross(d);
    if (hookAxis.lengthSq() < 1e-6) hookAxis.set(1, 0, 0);
    hookAxis.normalize();
    for (let i = 1; i <= steps; i++) {
      const h = i / steps;
      ax += spin / steps;
      // bend around an axis across the heading
      tmp.set(Math.cos(ax), 0, Math.sin(ax)).cross(d);
      if (tmp.lengthSq() < 1e-6) tmp.set(1, 0, 0);
      tmp.normalize();
      const amt = (bend / steps) * (Math.sin(h * f1 + k1) + (rand() - 0.5) * 1.6);
      d.applyAxisAngle(tmp, amt);
      // the hook: a steady curl around a fixed axis, tighter towards the tip
      if (hook) d.applyAxisAngle(hookAxis, (hook / steps) * 2.5 * smoothstep(0.45, 1, h)).normalize();
      d.lerp(Y, (rise / steps) * h).normalize();
      p.addScaledVector(d, len / steps);
      pts.push(p.clone());
    }
    return pts;
  }
  const along = (pts, h, out) => {
    const f = clamp(h) * (pts.length - 1);
    const i = Math.min(Math.floor(f), pts.length - 2);
    return out.lerpVectors(pts[i], pts[i + 1], f - i);
  };
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), T = new THREE.Vector3();
  // a thin 3-sided prism along a path
  function stem(pts, R, c0, c1) {
    const base = pos.length / 3, rings = pts.length - 1;
    for (let j = 0; j <= rings; j++) {
      const h = j / rings;
      c.copy(c0).lerp(c1, h);
      const a0 = pts[Math.max(j - 1, 0)], a1 = pts[Math.min(j + 1, rings)];
      const t = Q.subVectors(a1, a0).normalize();
      const sx = T.crossVectors(t, Math.abs(t.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : Y).normalize().clone();
      const sz = new THREE.Vector3().crossVectors(t, sx);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2, r = R * (1 - 0.6 * h);
        const p = pts[j];
        push(p.x + (Math.cos(a) * sx.x + Math.sin(a) * sz.x) * r, p.y + (Math.cos(a) * sx.y + Math.sin(a) * sz.y) * r, p.z + (Math.cos(a) * sx.z + Math.sin(a) * sz.z) * r, c);
      }
    }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < 3; i++) {
        const a = base + j * 3 + i, b = base + j * 3 + ((i + 1) % 3);
        idx.push(a, b, b + 3, a, b + 3, a + 3);
      }
  }
  // the leaves: 4 stations along the blade (base, widest, narrowing, tip) — a
  // narrow lance, keeled (V-shaped across), curled into a sickle, twisted, and
  // all swept round the same way on a shoot (falcate-secund, crisped as they dry)
  const W = [0.55, 1, 0.6, 0];
  const SEG = [0, 0.3, 0.33, 0.37];
  const S = W.length;
  const dead = new THREE.Color(0.11, 0.07, 0.03);
  const olive = new THREE.Color(0.1, 0.16, 0.03);
  const green = new THREE.Color(0.15, 0.29, 0.05);
  const tip = new THREE.Color(0.4, 0.56, 0.12);
  const up = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3(), dir = new THREE.Vector3(), nrm = new THREE.Vector3();
  // u0 … 1: how old the axis is along its length (a branch starts mid-way)
  function clothe(pts, n, { u0 = 0, scale = 1 } = {}) {
    const a0 = rand() * Math.PI * 2;
    const sweep = (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 1.4); // how far the leaves sweep round
    for (let k = 0; k < n; k++) {
      const v = k / (n - 1);
      const u = mix(u0, 1, v);
      const h = 0.04 + 0.96 * Math.pow(v, 0.9);
      along(pts, h, P);
      along(pts, Math.min(h + 0.03, 1), Q);
      if (h >= 0.97) along(pts, 0.94, Q).subVectors(P, Q).add(P);
      up.subVectors(Q, P).normalize();
      const az = a0 + k * TURN + (rand() - 0.5) * 0.9;
      out.set(Math.cos(az), 0, Math.sin(az));
      out.addScaledVector(up, -out.dot(up));
      if (out.lengthSq() < 1e-6) out.set(1, 0, 0);
      out.normalize();
      side.crossVectors(up, out).normalize();
      const elev = (mix(1.0, 0.18, Math.pow(u, 1.6)) * spread + (rand() - 0.5) * 0.7) * (u < 0.25 ? 1.3 : 1);
      const len = length * scale * mix(1, 0.55, Math.pow(u, 2.5)) * (0.75 + rand() * 0.5);
      const wid = width * (0.8 + rand() * 0.4);
      const curl = (rand() - 0.25) * 2.6; // most curl outwards and down, some hook back inwards
      const sw = sweep * (0.6 + rand() * 0.8);
      const twist = (rand() - 0.5) * 1.6;
      const deadness = smoothstep(0.38, 0.08, u) * (0.7 + 0.3 * rand());
      const tint = 0.85 + rand() * 0.3;
      T.copy(P);
      const first = pos.length / 3;
      for (let s = 0; s < S; s++) {
        const t = s / (S - 1);
        const a = elev + Math.pow(t, 1.4) * curl;
        dir.copy(up).multiplyScalar(Math.cos(a)).addScaledVector(out, Math.sin(a)).applyAxisAngle(up, sw * t * t);
        const sd = side.clone().applyAxisAngle(up, sw * t * t).applyAxisAngle(dir, twist * t);
        nrm.crossVectors(dir, sd).normalize();
        if (s > 0) T.addScaledVector(dir, len * SEG[s]);
        const w = W[s] * wid;
        c.copy(green).lerp(tip, t * t * (0.5 + 0.5 * u));
        c.lerp(olive, (1 - u) * 0.5).lerp(dead, deadness).multiplyScalar(tint * mix(0.6, 1, u));
        push(T.x - sd.x * w - nrm.x * w * 0.35, T.y - sd.y * w - nrm.y * w * 0.35, T.z - sd.z * w - nrm.z * w * 0.35, c);
        const cm = c.clone().multiplyScalar(1.12);
        push(T.x + nrm.x * w * 0.1, T.y + nrm.y * w * 0.1, T.z + nrm.z * w * 0.1, cm);
        push(T.x + sd.x * w - nrm.x * w * 0.35, T.y + sd.y * w - nrm.y * w * 0.35, T.z + sd.z * w - nrm.z * w * 0.35, c);
      }
      for (let s = 0; s < S - 1; s++) {
        const a = first + s * 3;
        idx.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
      }
    }
  }

  if (liana) {
    // a liana: a long, thin runner arching out of the moss and diving back
    // into it, winding round itself as it goes, sparsely set with small leaves
    // pressed to it, its tip curled up like a fiddlehead
    const pts = [];
    const steps = 30;
    const RUN = 0.8; // how far it runs, for its height
    const peak = 0.55 + rand() * 0.35, drop = 0.15 + rand() * 0.25;
    const f = 4 + rand() * 5, k1 = rand() * 6, k2 = rand() * 6;
    const coil = 18 + rand() * 16, ca = 0.025 + rand() * 0.03; // the winding
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      pts.push(new THREE.Vector3(
        t * RUN,
        peak * Math.sin(Math.PI * Math.pow(t, 0.85)) - drop * t + ca * Math.sin(t * coil + k2),
        0.12 * Math.sin(t * f + k1) + 0.05 * Math.sin(t * f * 2.3 + k2) + ca * Math.cos(t * coil + k2),
      ));
    }
    // the fiddlehead: a spiral rolling up over the end, tighter and tighter
    const end = pts[steps].clone(), dirEnd = end.clone().sub(pts[steps - 1]).normalize();
    const turns = 1.2 + rand() * 0.8, R0 = 0.05 + rand() * 0.03;
    const sideA = new THREE.Vector3(0, 0, 1).cross(dirEnd).normalize(); // up-ish, across the end
    for (let j = 1; j <= 12; j++) {
      const a = (j / 12) * turns * Math.PI * 2, rr = R0 * (1 - 0.7 * (j / 12));
      pts.push(end.clone().addScaledVector(dirEnd, Math.sin(a) * rr).addScaledVector(sideA, (1 - Math.cos(a)) * rr));
    }
    stem(pts, 0.011, new THREE.Color(0.12, 0.13, 0.035), new THREE.Color(0.2, 0.3, 0.06));
    clothe(pts.slice(0, steps + 1), leaves, { u0: 0.5 });
    // now and then a bare tendril springing off it, curling too
    for (let b = 0; b < branches; b++) {
      const h = 0.25 + rand() * 0.5;
      along(pts, h, P);
      const d = new THREE.Vector3(rand() - 0.5, 0.8, rand() - 0.5);
      const tp = walk(P, d, 0.18 + rand() * 0.15, { bend: 2, rise: 0, steps: 10, hook: 3 + rand() * 2 });
      stem(tp, 0.007, new THREE.Color(0.1, 0.12, 0.03), new THREE.Color(0.2, 0.28, 0.07));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  // the main stem: leaning off the vertical, sprawling ones lying almost flat
  const la = rand() * Math.PI * 2;
  const tilt = lean + sprawl * (0.9 + rand() * 0.4);
  const head = new THREE.Vector3(Math.cos(la) * Math.sin(tilt), Math.cos(tilt), Math.sin(la) * Math.sin(tilt));
  const main = walk(new THREE.Vector3(), head, 1, { bend: 1.3 + 0.8 * sprawl, rise: 0.5 + 0.9 * sprawl, steps: 16, hook: rand() < 0.6 ? 0.8 + rand() * 1.6 : 0 });
  // bring the tip back to about 1 high, whatever the path did (sprawling ones stay lower)
  const top = main.reduce((m, p) => Math.max(m, p.y), 0.2);
  const sy = mix(1, 0.75, sprawl) / top;
  for (const p of main) p.y *= sy;
  stem(main, 0.014, new THREE.Color(0.07, 0.04, 0.02), new THREE.Color(0.1, 0.13, 0.03));
  clothe(main, leaves);
  // the side branches: forking off at a wide angle, wandering too
  for (let b = 0; b < branches; b++) {
    const h = 0.3 + rand() * 0.45;
    along(main, h, P);
    along(main, h + 0.05, Q);
    up.subVectors(Q, P).normalize();
    const az = rand() * Math.PI * 2;
    out.set(Math.cos(az), 0, Math.sin(az)).addScaledVector(up, -0.3).normalize();
    const d = up.clone().multiplyScalar(0.5).addScaledVector(out, 0.9 + rand() * 0.5);
    const len = (1 - h) * (0.5 + rand() * 0.5);
    const pts = walk(P, d, len, { bend: 1.8, rise: 0.3, steps: 8, hook: 1 + rand() * 2 });
    stem(pts, 0.009, new THREE.Color(0.08, 0.07, 0.02), new THREE.Color(0.1, 0.13, 0.03));
    clothe(pts, Math.max(5, Math.round(leaves * len * 0.9)), { u0: h * 0.7, scale: 0.8 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createShoots(support, seed, { density = 7000 } = {}) {
  const rand = rng(seed * 977 + 3);
  const nz = noise3(seed + 55);
  const geos = Array.from({ length: VARIANTS }, (_, v) =>
    shootGeometry(rand, {
      leaves: 22 + Math.floor(rand() * 10),
      length: 0.25 + rand() * 0.1,
      width: 0.019 + rand() * 0.01,
      spread: 0.8 + rand() * 0.45,
      lean: v === 0 ? 0.05 : rand() * 0.6,
      branches: Math.floor(rand() * 3.2),
      sprawl: v % 3 === 2 ? 1 : 0, // a third of the shoots lie over the others
    }),
  );
  for (let v = 0; v < LIANAS; v++)
    geos.push(
      shootGeometry(rand, {
        liana: true,
        leaves: 40 + Math.floor(rand() * 16),
        length: 0.11 + rand() * 0.04,
        width: 0.014 + rand() * 0.006,
        spread: 0.35 + rand() * 0.2,
        branches: Math.floor(rand() * 2.5),
      }),
    );
  // the pointer brushes through them: see brush below
  const brush = createBrush(support.footprint);
  const material = plantMaterial({ roughness: 0.55, through: 0xc4f070, amount: 1.2, vertex: brush.inject, key: '-brush' });
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depthMaterial.onBeforeCompile = brush.inject;
  depthMaterial.customProgramCacheKey = () => 'depth-brush';

  const count = Math.round(support.area * density);
  // where the growth starts: a few spots on the mound, each a little later
  const seeds = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3();
  const nSeeds = 4 + Math.floor(rand() * 3);
  for (let i = 0; i < nSeeds; i++) {
    support.sample(rand, P, N);
    seeds.push({ x: P.x, z: P.z, delay: i === 0 ? 0 : rand() * 0.6 });
  }

  const shoots = [];
  let rawMax = 0;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < count; i++) {
    const edge = support.sample(rand, P, N);
    const liana = rand() < LIANA_SHARE;
    const axis = N.clone().lerp(up, mix(0.45, 0.1, smoothstep(0.7, 1, edge)));
    // set at all angles, so that they cross and wind through their neighbours
    // (the lianas lie along the surface, arching over it)
    const jit = liana ? 0.35 : 1.1;
    axis.x += (rand() - 0.5) * jit;
    axis.z += (rand() - 0.5) * jit;
    axis.normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(up, axis);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(up, rand() * Math.PI * 2));
    // lumps and patches over the cushion: taller here, yellower or browner there
    const lump = fbm(nz, P.x * 5, 0.5, P.z * 5, 3);
    const patch = fbm(nz, P.x * 3 + 9, 2.5, P.z * 3, 3);
    const s = (liana ? 0.12 + 0.08 * rand() : 0.05 + 0.045 * Math.pow(rand(), 1.8)) * mix(1, 0.75, smoothstep(0.75, 1, edge)) * (1 + 0.25 * Math.max(lump, -0.4));
    const p = P.clone().addScaledVector(axis, liana ? -0.02 : -0.18 * s);
    let raw = Infinity;
    for (const sd of seeds) raw = Math.min(raw, Math.hypot(P.x - sd.x, P.z - sd.z) + sd.delay);
    raw += rand() * 0.12;
    rawMax = Math.max(rawMax, raw);
    // a tint: yellower or darker here and there, darker underneath the cushion
    const tint = new THREE.Color(1, 1, 1);
    const k = rand();
    if (k < 0.2) tint.setRGB(1.2, 1.1, 0.55);
    else if (k < 0.38) tint.setRGB(0.7, 0.78, 0.62);
    else if (k < 0.43) tint.setRGB(1.1, 0.8, 0.45); // a few browning
    tint.multiply(new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.25, 1.05, 0.45), smoothstep(0.15, 0.7, patch) * 0.9));
    tint.multiply(new THREE.Color(1, 1, 1).lerp(new THREE.Color(0.8, 0.62, 0.4), smoothstep(-0.3, -0.75, patch) * 0.7));
    // on the cushion's flanks and rim, many shoots are brown and dead
    if (rand() < 0.15 + 0.55 * smoothstep(0.6, 1, edge) * smoothstep(0.7, 0.1, N.y)) tint.setRGB(1.3, 0.75, 0.42).multiplyScalar(0.6 + rand() * 0.3);
    tint.multiplyScalar(mix(0.45, 1, smoothstep(-0.3, 0.7, N.y)) * (0.85 + rand() * 0.3) * (0.82 + 0.25 * smoothstep(-0.6, 0.6, lump)));
    shoots.push({ p, q, s, w: 0.9 + rand() * 0.35, raw, tint, variant: liana ? VARIANTS + Math.floor(rand() * LIANAS) : Math.floor(rand() * VARIANTS), dur: liana ? 0.2 + rand() * 0.1 : 0.1 + rand() * 0.08, liana });
  }
  for (const sh of shoots) sh.birth = 0.02 + (sh.raw / rawMax) * 0.5 + (sh.liana ? 0.05 : 0);

  const meshes = geos.map((g, v) => {
    const list = shoots.filter((s) => s.variant === v);
    const m = new THREE.InstancedMesh(g, material, list.length);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    list.forEach((s, i) => m.setColorAt(i, s.tint));
    m.castShadow = true;
    m.receiveShadow = true;
    m.customDepthMaterial = depthMaterial;
    m.frustumCulled = false;
    m.userData.list = list;
    return m;
  });
  const group = new THREE.Group();
  group.add(...meshes);

  const M = new THREE.Matrix4(), S = new THREE.Vector3();
  let last = -1;
  // t: the growth, 0 … 1 (all grown at about 0.75)
  function update(t) {
    if (t === last) return;
    last = t;
    for (const m of meshes) {
      const list = m.userData.list;
      for (let i = 0; i < list.length; i++) {
        const s = list[i];
        const g = clamp((t - s.birth) / s.dur);
        const e = 1 - Math.pow(1 - g, 3);
        S.set(s.s * s.w * (0.3 + 0.7 * e) * e, s.s * e, s.s * s.w * (0.3 + 0.7 * e) * e);
        M.compose(s.p, s.q, S);
        m.setMatrixAt(i, M);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  }
  update(0);
  return {
    group,
    count,
    update,
    touch: brush.touch,
    dispose() {
      geos.forEach((g) => g.dispose());
      material.dispose();
      depthMaterial.dispose();
      brush.dispose();
      meshes.forEach((m) => m.dispose());
    },
  };
}

// ---- the press: the pointer sinks into the moss like a finger into a
// cushion. Under it, the shoots and runners are squashed down against the
// soil, splaying out and spreading as they go (as if keeping their volume),
// darker in the dent; around it, a soft rim bulges up a little. Where it has
// been, the dent fills back slowly, like foam.
// How deep the moss is pressed is kept in a small texture seen from above,
// over the cushion: each frame it fills back a little, and the pointer is
// pressed into it along its path since the last frame (so a quick stroke
// leaves a smooth groove). The shoots read it in the vertex shader, each
// scaled to its size (so the young ones, still small, barely move); its slope
// says which way they splay and how the dent is lit.
const PRESS_R = 0.2; // how wide the dent is, around the pointer
const FIELD = 256;
function createBrush(footprint) {
  const extent = Math.max(footprint.rx, footprint.rz) * 2 * 1.45;
  const origin = new THREE.Vector2(footprint.cx, footprint.cz);
  const rt = () => new THREE.WebGLRenderTarget(FIELD, FIELD, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
  let read = rt(), write = rt();
  const stamp = new THREE.ShaderMaterial({
    uniforms: {
      tPrev: { value: null },
      uDt: { value: 0 },
      uA: { value: new THREE.Vector2() },
      uB: { value: new THREE.Vector2() },
      uDepth: { value: 0 },
      uR: { value: PRESS_R },
      uO: { value: origin },
      uE: { value: extent },
      uClear: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tPrev; uniform float uDt, uDepth, uR, uE, uClear; uniform vec2 uA, uB, uO;
      varying vec2 vUv;
      void main() {
        float v = uClear > 0.5 ? 0.0 : texture2D(tPrev, vUv).r;
        // filling back: slowly at first, as foam does, then on to the end
        v = max(0.0, v - uDt * (v * (0.3 + 1.3 * (1.0 - v)) + 0.03));
        // the pointer, along its way since the last frame
        vec2 p = uO + (vUv - 0.5) * uE;
        vec2 ab = uB - uA;
        float t = clamp(dot(p - uA, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
        float r = length(p - uA - ab * t) / uR;
        // a firm, flat-bottomed print, sinking in over a moment rather than at once
        float target = exp(-r * r * 1.4 - r * r * r * r * 0.9) * uDepth;
        if (target > v) v += (target - v) * (1.0 - exp(-uDt * 6.0));
        // nothing at the border
        vec2 e = smoothstep(0.0, 0.04, vUv) * smoothstep(0.0, 0.04, 1.0 - vUv);
        gl_FragColor = vec4(v * e.x * e.y, 0.0, 0.0, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), stamp);
  quad.frustumCulled = false;
  const qScene = new THREE.Scene().add(quad);
  const qCam = new THREE.Camera();

  const uniforms = {
    tPress: { value: read.texture },
    uPO: { value: origin },
    uPE: { value: extent },
    uR: { value: PRESS_R },
  };
  const inject = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D tPress;
        uniform vec2 uPO;
        uniform float uPE, uR;
        float pressAt(vec2 xz) { return texture2D(tPress, (xz - uPO) / uPE + 0.5).r; }
        #ifdef USE_COLOR
          varying float vPress;
        #endif`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 wp = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          vec3 foot = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float size = length(instanceMatrix[1].xyz); // how tall the shoot is now
        #else
          vec3 foot = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float size = 0.0;
        #endif
        wp = modelMatrix * wp;
        // how deep it's pressed here, the slope of the dent, and the rim
        // around it (where the moss is less pressed than all about)
        float o = uR * 0.6;
        float c = pressAt(foot.xz);
        float pe = pressAt(foot.xz + vec2(o, 0.0)), pw = pressAt(foot.xz - vec2(o, 0.0));
        float pn = pressAt(foot.xz + vec2(0.0, o)), ps = pressAt(foot.xz - vec2(0.0, o));
        vec2 slope = vec2(pe - pw, pn - ps) * 0.5 * uR / o; // across the dent: about ±0.5
        float dent = clamp(c, 0.0, 1.0);
        float rim = clamp((pe + pw + pn + ps) * 0.25 - c, 0.0, 1.0) * (1.0 - dent);
        vec2 away = -slope * 2.0; // outwards, 0 in the middle of the dent
        // the shoot, relative to its foot
        vec3 rel = wp.xyz - foot;
        float h = clamp(position.y, 0.0, 1.2);
        // pressed down and compacted: the tops flattened under the finger as
        // under a soft lid, the whole shoot crushed into a thin, dense mat
        // (folding and crumpling in place, not pushed aside)
        float de = dent * dent * (3.0 - 2.0 * dent); // a gentle first touch
        float lid = size * mix(1.2, 0.05, de);
        float y = rel.y * mix(1.0, 0.3, de);
        float kk = 0.2 * size + 1e-4;
        float hh = clamp(0.5 + 0.5 * (lid - y) / kk, 0.0, 1.0);
        rel.y = mix(lid, y, hh) - kk * hh * (1.0 - hh); // a smooth min(y, lid)
        // the moss on the dent's walls dragged down and in after it, as the
        // matter is packed together under the finger
        rel.xz -= away * size * 0.3 * h;
        // the rim: only a faint swell
        rel.y *= 1.0 + 0.2 * rim;
        wp.xyz = foot + rel;
        #if defined(USE_COLOR) && !defined(FLAT_SHADED)
          // lit as one soft surface: a bowl in the dent, a swell on the rim
          vec3 bowl = normalize(vec3(slope.x * 1.6, 1.0, slope.y * 1.6));
          vNormal = normalize(mix(vNormal, normalize((viewMatrix * vec4(bowl, 0.0)).xyz), 0.55 * clamp(dent + rim + length(slope), 0.0, 1.0)));
        #endif
        #ifdef USE_COLOR
          // packed tight in the dent, they shade each other
          vColor.rgb *= 1.0 - 0.5 * dent * (1.0 - 0.3 * h);
          vPress = dent;
        #endif
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;`,
      );
    // squeezed, the moss gives up its water: darker, richer, glossy
    if (s.fragmentShader.includes('#include <roughnessmap_fragment>'))
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
        varying float vPress;`)
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float wet = smoothstep(0.15, 0.9, vPress);
          roughnessFactor = mix(roughnessFactor, 0.22, wet * 0.8);
          diffuseColor.rgb = mix(diffuseColor.rgb, pow(diffuseColor.rgb, vec3(1.25)) * 0.8, wet);`,
        );
  };

  // each frame: the renderer, the point on the cushion under the pointer (or
  // null), the frame's length
  const S = new THREE.Vector3(); // the pointer, followed smoothly
  let has = false, depth = 0, still = 0, cleared = false;
  function touch(renderer, point, dt) {
    const U = stamp.uniforms;
    if (point) {
      if (!has) { S.copy(point); has = true; }
      const before = S.clone();
      // a soft follow: no jumps when the pointer events come unevenly
      S.lerp(point, 1 - Math.exp(-dt * 14));
      const moved = before.distanceTo(S) / Math.max(dt, 1e-3);
      // it sinks in softly, and further the longer it rests
      still = moved > 0.05 ? Math.max(0, still - dt * 3) : Math.min(1, still + dt * 0.8);
      depth += (0.75 + 0.25 * still - depth) * (1 - Math.exp(-dt * 3));
      U.uA.value.set(before.x, before.z);
    } else {
      has = false;
      depth = still = 0;
    }
    U.uB.value.set(S.x, S.z);
    if (!point) U.uA.value.copy(U.uB.value);
    U.uDepth.value = depth;
    U.uDt.value = dt;
    U.uClear.value = cleared ? 0 : 1;
    cleared = true;
    U.tPrev.value = read.texture;
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(write);
    renderer.render(qScene, qCam);
    renderer.setRenderTarget(prev);
    [read, write] = [write, read];
    uniforms.tPress.value = read.texture;
  }
  return {
    inject,
    touch,
    dispose() {
      read.dispose();
      write.dispose();
      stamp.dispose();
      quad.geometry.dispose();
    },
  };
}
