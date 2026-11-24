// What the moss grows on: a weathered granite boulder, its grains, cracks,
// stains and lichens, and on its top a clump of crumbly dark soil, the
// support, that the short shoots will cover entirely, with a litter of
// crumbs, pebbles and dead fibres around.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { noise3, fbm, rng, smoothstep, GLSL_NOISE } from './noise.js';

// a low, broad slab: a superellipsoid (flat top, rounded edges), half sunk
// in the forest floor at GROUND_Y
const ROCK_C = new THREE.Vector3(0, -0.6, 0);
const ROCK_R = new THREE.Vector3(1.8, 0.55, 1.2);
const ROCK_E = 2.8; // > 2: boxier
export const GROUND_Y = -0.36;
const enorm = (x, y, z) => Math.pow(Math.abs(x) ** ROCK_E + Math.abs(y) ** ROCK_E + Math.abs(z) ** ROCK_E, 1 / ROCK_E);

export function createSupport(seed) {
  const n = noise3(seed);
  const n2 = noise3(seed + 101);
  const r = rng(seed * 31 + 7);

  // ---- the rock: the slab, its size varied by a noise on the direction —
  // an irregular outline, a gently undulating top
  const disp = (x, y, z) => 1 + 0.1 * fbm(n, x * 1.3 + 4, y * 0.8, z * 1.3, 4) + 0.012 * fbm(n2, x * 7, y * 7, z * 7, 3);
  const inside = (p) => {
    const qx = (p.x - ROCK_C.x) / ROCK_R.x, qy = (p.y - ROCK_C.y) / ROCK_R.y, qz = (p.z - ROCK_C.z) / ROCK_R.z;
    const l = Math.hypot(qx, qy, qz);
    return enorm(qx, qy, qz) < disp(qx / l, qy / l, qz / l);
  };
  // the height of the rock's top at (x, z)
  const tmp = new THREE.Vector3();
  const rockTop = (x, z) => {
    let lo = GROUND_Y - 0.3, hi = 0.6;
    for (let k = 0; k < 24; k++) {
      const m = (lo + hi) / 2;
      if (inside(tmp.set(x, m, z))) lo = m;
      else hi = m;
    }
    return lo;
  };

  const ico = new THREE.IcosahedronGeometry(1, 110);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const rockGeo = mergeVertices(ico);
  ico.dispose();
  {
    const p = rockGeo.attributes.position;
    const cav = new Float32Array(p.count);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      // weathering, finer than what the soil sits on: rounded knobs, and
      // creases along the cracks (ridged noise)
      const knob = fbm(n2, v.x * 16 + 3, v.y * 16, v.z * 16, 3);
      const crease = Math.pow(1 - Math.abs(n(v.x * 9 + 11, v.y * 9, v.z * 9)), 12);
      const fine = 0.008 * knob - 0.012 * crease;
      const d = (disp(v.x, v.y, v.z) + fine) / enorm(v.x, v.y, v.z);
      p.setXYZ(i, ROCK_C.x + v.x * d * ROCK_R.x, ROCK_C.y + v.y * d * ROCK_R.y, ROCK_C.z + v.z * d * ROCK_R.z);
      cav[i] = smoothstep(-0.012, 0.008, fine);
    }
    rockGeo.setAttribute('cavity', new THREE.BufferAttribute(cav, 1));
    rockGeo.computeVertexNormals();
  }
  const rock = new THREE.Mesh(rockGeo, rockMaterial());
  rock.receiveShadow = true;
  rock.castShadow = true;

  // ---- a soil clump: a mound over an irregular, elongated footprint
  // (o: an offset into the noises, so that each clump has its own outline)
  const makeMound = ({ cx, cz, rx, rz, rot, H, NR, NA, o }) => {
  const edge = (a) => 1 + 0.22 * fbm(n2, Math.cos(a) * 1.2 + o, Math.sin(a) * 1.2, 3.3, 3) + 0.07 * n2(Math.cos(a) * 5 + o, Math.sin(a) * 5, 9);
  // a point of the mound from its polar coordinates (f: 0 middle, 1 edge)
  const moundPoint = (f, a, out) => {
    const e = edge(a);
    const lx = Math.cos(a) * rx * e * f, lz = Math.sin(a) * rz * e * f;
    const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot);
    const z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
    const lump = 0.82 + 0.35 * (fbm(n, x * 3, 7.7 + o, z * 3, 3) * 0.5 + 0.5);
    const prof = Math.pow(Math.max(0, 1 - Math.pow(f, 2.4)), 0.42);
    const y = rockTop(x, z) + H * prof * lump - 0.025 * smoothstep(0.85, 1, f);
    return out.set(x, y, z);
  };
  const pos = [], fr = [], idx = [];
  const v = new THREE.Vector3();
  moundPoint(0, 0, v);
  pos.push(v.x, v.y, v.z);
  fr.push(0);
  for (let j = 1; j <= NR; j++) {
    const f = Math.pow(j / NR, 0.8);
    for (let i = 0; i < NA; i++) {
      moundPoint(f, (i / NA) * Math.PI * 2, v);
      pos.push(v.x, v.y, v.z);
      fr.push(f);
    }
  }
  const ring = (j, i) => (j === 0 ? 0 : 1 + (j - 1) * NA + (i % NA));
  for (let i = 0; i < NA; i++) idx.push(0, ring(1, i + 1), ring(1, i));
  for (let j = 1; j < NR; j++)
    for (let i = 0; i < NA; i++) {
      const a = ring(j, i), b = ring(j, i + 1), c = ring(j + 1, i), d = ring(j + 1, i + 1);
      idx.push(a, b, d, a, d, c);
    }
  const moundGeo = new THREE.BufferGeometry();
  moundGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  moundGeo.setAttribute('edge', new THREE.Float32BufferAttribute(fr, 1));
  moundGeo.setIndex(idx);
  moundGeo.computeVertexNormals();
  // crumbly: little clods along the normal, less towards the rim
  {
    const nr = moundGeo.attributes.normal.array;
    for (let i = 0; i < fr.length; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
      const k = (0.016 * fbm(n2, x * 9, y * 9 + 3, z * 9, 2) + 0.006 * fbm(n, x * 30, y * 30, z * 30, 2)) * (1 - smoothstep(0.88, 1, fr[i]));
      pos[i * 3] += nr[i * 3] * k;
      pos[i * 3 + 1] += nr[i * 3 + 1] * k;
      pos[i * 3 + 2] += nr[i * 3 + 2] * k;
    }
    moundGeo.attributes.position.array.set(pos);
    moundGeo.attributes.position.needsUpdate = true;
    moundGeo.computeVertexNormals();
  }
  const mound = new THREE.Mesh(moundGeo, soilMaterial());
  mound.receiveShadow = true;
  mound.castShadow = true;
  // a coarse copy of the mound (every 4th ring and spoke), cheap to aim the
  // pointer at every frame, and smoother under it
  const pickGeo = new THREE.BufferGeometry();
  {
    const pidx = [], ST = 4;
    for (let i = 0; i < NA; i += ST) pidx.push(0, ring(ST, i + ST), ring(ST, i));
    for (let j = ST; j + ST <= NR; j += ST)
      for (let i = 0; i < NA; i += ST) {
        const a = ring(j, i), b = ring(j, i + ST), c = ring(j + ST, i), d = ring(j + ST, i + ST);
        pidx.push(a, b, d, a, d, c);
      }
    pickGeo.setAttribute('position', moundGeo.attributes.position);
    pickGeo.setIndex(pidx);
    pickGeo.computeBoundingSphere();
  }
  const pick = new THREE.Mesh(pickGeo);

  // random points on the mound, evenly by area: position, normal, distance to
  // the edge (0 middle … 1 edge)
  const tris = [];
  let total = 0;
  {
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < idx.length; t += 3) {
      a.fromArray(pos, idx[t] * 3);
      b.fromArray(pos, idx[t + 1] * 3);
      c.fromArray(pos, idx[t + 2] * 3);
      total += b.sub(a).cross(c.sub(a)).length() / 2;
      tris.push(total);
    }
  }
  const nrm = moundGeo.attributes.normal.array;
  const sample = (rand, outP, outN) => {
    const u = rand() * total;
    let lo = 0, hi = tris.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (tris[m] < u) lo = m + 1;
      else hi = m;
    }
    let s = rand(), t = rand();
    if (s + t > 1) { s = 1 - s; t = 1 - t; }
    const w = 1 - s - t;
    const i0 = idx[lo * 3], i1 = idx[lo * 3 + 1], i2 = idx[lo * 3 + 2];
    outP.set(
      pos[i0 * 3] * w + pos[i1 * 3] * s + pos[i2 * 3] * t,
      pos[i0 * 3 + 1] * w + pos[i1 * 3 + 1] * s + pos[i2 * 3 + 1] * t,
      pos[i0 * 3 + 2] * w + pos[i1 * 3 + 2] * s + pos[i2 * 3 + 2] * t,
    );
    outN.set(
      nrm[i0 * 3] * w + nrm[i1 * 3] * s + nrm[i2 * 3] * t,
      nrm[i0 * 3 + 1] * w + nrm[i1 * 3 + 1] * s + nrm[i2 * 3 + 1] * t,
      nrm[i0 * 3 + 2] * w + nrm[i1 * 3 + 2] * s + nrm[i2 * 3 + 2] * t,
    ).normalize();
    return fr[i0] * w + fr[i1] * s + fr[i2] * t;
  };
  return {
    mesh: mound,
    geo: moundGeo,
    pick,
    area: total,
    sample,
    edge,
    moundPoint,
    center: new THREE.Vector3(cx, rockTop(cx, cz) + H * 0.6, cz),
    footprint: { cx, cz, rx, rz, rot },
  };
  };

  // the main clump, in the middle of the slab
  const main = makeMound({ cx: 0.05, cz: 0.02, rx: 0.78 + r() * 0.12, rz: 0.46 + r() * 0.08, rot: (r() - 0.5) * 0.5, H: 0.17, NR: 64, NA: 288, o: 0 });
  const { cx, cz, rx, rz, rot } = main.footprint;
  const edge = main.edge, moundPoint = main.moundPoint;

  // and two little ones on the slab beside it, towards the front: one tiny,
  // one a little larger — a gap of bare rock between them and the main one
  const smalls = [];
  for (const [rad, H] of [[0.16, 0.08], [0.085, 0.055]]) {
    let best = null;
    for (let k = 0; k < 400 && !best; k++) {
      // in front, to the left or right — not straight in front of the main one
      const ang = Math.PI * (r() < 0.5 ? 0.15 + r() * 0.25 : 0.6 + r() * 0.25);
      const e = edge(ang) * (1.18 + r() * 0.2);
      const lx = Math.cos(ang) * rx * e, lz = Math.sin(ang) * rz * e;
      const x = cx + lx * Math.cos(rot) - lz * Math.sin(rot) + Math.cos(ang) * rad * 1.3;
      const z = cz + lx * Math.sin(rot) + lz * Math.cos(rot) + Math.sin(ang) * rad * 1.3;
      // on the slab's top, not too far down its rounded edge, and clear of
      // the other little one
      if (rockTop(x, z) < GROUND_Y + 0.22) continue;
      if (rockTop(x + rad * 1.4, z) < GROUND_Y + 0.18 || rockTop(x - rad * 1.4, z) < GROUND_Y + 0.18 || rockTop(x, z + rad * 1.4) < GROUND_Y + 0.18) continue;
      if (smalls.some((m) => Math.hypot(m.footprint.cx - x, m.footprint.cz - z) < m.footprint.rx * 1.6 + rad * 1.6 + 0.15)) continue;
      best = { cx: x, cz: z };
    }
    if (!best) best = { cx: cx + (smalls.length ? -1 : 1) * 1.05, cz: 0.6 };
    smalls.push(makeMound({ ...best, rx: rad * (1 + r() * 0.2), rz: rad * (0.75 + r() * 0.2), rot: r() * Math.PI, H, NR: 20, NA: 96, o: 17 + smalls.length * 23 }));
  }
  const patches = [main, ...smalls];

  const litter = createLitter(r, n2, (f, a, out) => {
    // a point on the soil (f ≤ 1) or on the rock around it (f > 1)
    moundPoint(Math.min(f, 1), a, out);
    if (f > 1) {
      const e = edge(a);
      const lx = Math.cos(a) * rx * e * f, lz = Math.sin(a) * rz * e * f;
      out.x = cx + lx * Math.cos(rot) - lz * Math.sin(rot);
      out.z = cz + lx * Math.sin(rot) + lz * Math.cos(rot);
      out.y = rockTop(out.x, out.z);
    } else out.y = Math.max(out.y, rockTop(out.x, out.z));
    return out;
  });

  const group = new THREE.Group();
  group.add(rock, litter.group, ...patches.map((p) => p.mesh));
  return {
    group,
    // the clumps the moss grows on: the main one, a little one, a tiny one
    patches,
    // coarse copies of them, to aim the pointer at
    picks: patches.map((p) => p.pick),
    rockTop,
    center: main.center,
    dispose() {
      rockGeo.dispose();
      rock.material.dispose();
      for (const p of patches) {
        p.geo.dispose();
        p.pick.geometry.dispose();
        p.mesh.material.dispose();
      }
      litter.dispose();
    },
  };
}

// what lies about: crumbs of soil, small pebbles, dead fibres and rootlets,
// on the soil and spilling over the rim onto the rock. surf(f, a): a point
// from polar coordinates (f: 0 middle, 1 the soil's edge, more: on the rock)
function createLitter(rand, n, surf) {
  const group = new THREE.Group();
  const disposables = [];
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  // f: on the soil, or in a band around it (thinning out)
  const where = (rim) => (rim ? 0.9 + Math.pow(rand(), 2) * 0.45 : Math.sqrt(rand()) * 0.98);

  // a lumpy little stone, from an icosahedron pushed about
  const lumpy = (detail, amount) => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const o = rand() * 100;
    for (let i = 0; i < p.count; i++) {
      P.fromBufferAttribute(p, i);
      P.multiplyScalar(1 + amount * n(P.x * 1.7 + o, P.y * 1.7, P.z * 1.7));
      p.setXYZ(i, P.x, P.y * 0.6, P.z);
    }
    g.computeVertexNormals();
    disposables.push(g);
    return g;
  };
  const scatter = (geo, count, color, scale, rimShare) => {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
    disposables.push(mat);
    const m = new THREE.InstancedMesh(geo, mat, count);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), S = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      surf(where(rand() < rimShare), rand() * Math.PI * 2, P);
      const s = scale[0] + Math.pow(rand(), 2) * (scale[1] - scale[0]);
      q.setFromEuler(new THREE.Euler(rand() * 0.6 - 0.3, rand() * 6.3, rand() * 0.6 - 0.3));
      S.set(s * (0.7 + rand() * 0.6), s, s * (0.7 + rand() * 0.6));
      P.y += s * 0.15;
      m.setMatrixAt(i, M.compose(P, q, S));
      m.setColorAt(i, color(c));
    }
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  };
  scatter(lumpy(0, 0.5), 1600, (c) => c.setRGB(0.07, 0.045, 0.028).multiplyScalar(0.6 + rand() * 0.9), [0.0025, 0.008], 0.3);
  scatter(lumpy(1, 0.35), 160, (c) => {
    const k = rand();
    return k < 0.6 ? c.setRGB(0.17, 0.16, 0.15).multiplyScalar(0.6 + rand() * 0.6) : k < 0.85 ? c.setRGB(0.22, 0.18, 0.14) : c.setRGB(0.07, 0.065, 0.06);
  }, [0.004, 0.014], 0.85);

  // fibres: thin, gently arched, lying along the surface, 3-sided tubes
  const SEG = 7, SIDES = 3;
  const pos = [], col = [], idx = [];
  const c = new THREE.Color(), T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const pts = Array.from({ length: SEG + 1 }, () => new THREE.Vector3());
  for (let k = 0; k < 300; k++) {
    const rim = rand() < 0.5;
    let f = rim ? 0.88 + rand() * 0.15 : Math.sqrt(rand()) * 0.95;
    let a = rand() * Math.PI * 2;
    const len = 0.02 + rand() * 0.05;
    // outwards over the rim, or any way on the soil
    let df = rim ? 0.6 + rand() * 0.5 : (rand() - 0.5) * 2, da = rim ? (rand() - 0.5) * 0.6 : (rand() - 0.5) * 2;
    const norm = Math.hypot(df, da * 0.6) || 1;
    df /= norm; da /= norm;
    const arch = 0.002 + rand() * 0.008;
    for (let i = 0; i <= SEG; i++) {
      const s = i / SEG;
      surf(f + df * len * s * 1.6, a + da * len * s * 2.4 + 0.04 * Math.sin(s * 3 + k), pts[i]);
      pts[i].y += 0.0015 + arch * Math.sin(Math.PI * s);
    }
    const r = 0.0006 + rand() * 0.0009;
    const kind = rand();
    if (kind < 0.5) c.setRGB(0.16, 0.08, 0.03); // rootlets, rusty
    else if (kind < 0.85) c.setRGB(0.2, 0.14, 0.06); // dead stems, straw
    else c.setRGB(0.06, 0.04, 0.025);
    c.multiplyScalar(0.6 + rand() * 0.5);
    const base = pos.length / 3;
    for (let i = 0; i <= SEG; i++) {
      T.subVectors(pts[Math.min(i + 1, SEG)], pts[Math.max(i - 1, 0)]).normalize();
      Nn.crossVectors(T, up).normalize();
      B.crossVectors(Nn, T);
      for (let j = 0; j < SIDES; j++) {
        const an = (j / SIDES) * Math.PI * 2;
        Q.copy(Nn).multiplyScalar(Math.cos(an)).addScaledVector(B, Math.sin(an));
        pos.push(pts[i].x + Q.x * r, pts[i].y + Q.y * r, pts[i].z + Q.z * r);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < SEG; i++)
      for (let j = 0; j < SIDES; j++) {
        const a0 = base + i * SIDES + j, b0 = base + i * SIDES + ((j + 1) % SIDES);
        idx.push(a0, b0 + SIDES, b0, a0, a0 + SIDES, b0 + SIDES);
      }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  fg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  fg.setIndex(idx);
  fg.computeVertexNormals();
  const fm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const fibres = new THREE.Mesh(fg, fm);
  fibres.castShadow = fibres.receiveShadow = true;
  group.add(fibres);
  disposables.push(fg, fm);
  return { group, dispose: () => disposables.forEach((d) => d.dispose()) };
}

// a bump from a height computed in the fragment shader (surface gradient)
const BUMP = /* glsl */ `
  vec3 bumpFrom(float h, vec3 N, vec3 viewPos, float scale) {
    vec3 dpdx = dFdx(viewPos), dpdy = dFdy(viewPos);
    float hx = dFdx(h), hy = dFdy(h);
    vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 g = sign(det) * (hx * r1 + hy * r2);
    return normalize(abs(det) * N - g * scale);
  }
`;

function withObjectPosition(s, extra = '') {
  s.vertexShader = s.vertexShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vObj;\n${extra ? 'attribute float cavity;\nvarying float vCav;\nvarying vec3 vObjN;' : ''}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObj = position;\n${extra ? 'vCav = cavity;\nvObjN = normal;' : ''}`);
}

// granite: a mosaic of grains — creamy and pinkish feldspar, grey glassy
// quartz, black mica —, larger feldspar crystals here and there, fine cracks,
// grime in the hollows, warm stains, crusts of lichen; dull, the quartz a
// little shinier
function rockMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.onBeforeCompile = (s) => {
    withObjectPosition(s, true);
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj;
        varying vec3 vObjN;
        varying float vCav;
        ${GLSL_NOISE}
        ${BUMP}
        float rockH, rockR;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vObj;
        // the grains, two sizes
        // the grains, projected along the surface's main axis (cheaper in 2-D)
        vec3 an = abs(vObjN);
        vec2 gp = an.y > max(an.x, an.z) ? p.xz : an.x > an.z ? p.zy : p.xy;
        vec3 g = worley2(gp * 170.0 + vnoise(p * 40.0) * 0.9);
        float id = g.z;
        float fine = vnoise(p * 400.0);
        vec3 feld = mix(vec3(0.44, 0.41, 0.37), vec3(0.48, 0.4, 0.34), step(0.7, hash13(vec3(id * 91.0))));
        vec3 quartz = vec3(0.3, 0.29, 0.28);
        vec3 mica = vec3(0.14, 0.13, 0.12);
        vec3 col = id < 0.5 ? feld : id < 0.86 ? quartz : mica;
        float isQ = (id >= 0.5 && id < 0.86) ? 1.0 : 0.0;
        // a few big feldspar crystals
        float big = smoothstep(0.72, 0.76, vnoise(p * 40.0 + 5.0));
        col = mix(col, vec3(0.58, 0.52, 0.46), big * 0.6);
        col *= 0.85 + 0.25 * fine + (hash13(vec3(id * 37.0)) - 0.5) * 0.15;
        // the grains' boundaries, dark and sunken
        float seam = 1.0 - smoothstep(0.0, 0.08, g.y - g.x);
        col *= 1.0 - 0.18 * seam;
        // over it all: weathering — dirtier and warmer patches, grime in the hollows
        float w = fbm3l(p * 1.6);
        col *= mix(vec3(0.78, 0.76, 0.74), vec3(1.05, 1.0, 0.94), smoothstep(0.25, 0.75, w));
        float cav = clamp(vCav, 0.0, 1.0);
        col *= mix(vec3(0.68, 0.64, 0.6), vec3(1.0), smoothstep(0.0, 0.6, cav));
        // thin cracks
        float crack = 1.0 - smoothstep(0.0, 0.035, abs(vnoise(p * 7.0 + vnoise(p * 21.0) * 0.5) - 0.5));
        col *= 1.0 - 0.55 * crack * smoothstep(0.4, 0.7, vnoise(p * 3.0 + 9.0));
        // iron stains
        float rust = smoothstep(0.55, 0.75, fbm3l(p * 2.2 + 3.0));
        col = mix(col, col * vec3(1.35, 0.95, 0.65), rust * 0.8);
        // lichen: pale grey-green crusts with darker rims, and a few orange spots
        float L = fbm3l(p * 5.0 + 11.0);
        float lich = smoothstep(0.6, 0.64, L);
        col = mix(col, vec3(0.46, 0.45, 0.36) * (0.8 + 0.4 * vnoise(p * 120.0)), lich * 0.55);
        col *= 1.0 - 0.35 * (smoothstep(0.57, 0.6, L) - lich);
        float orange = smoothstep(0.7, 0.76, fbm3l(p * 9.0 + 41.0)) * smoothstep(0.35, 0.6, vnoise(p * 160.0));
        col = mix(col, vec3(0.62, 0.32, 0.08), orange * 0.85);
        diffuseColor.rgb *= col * vec3(1.06, 1.0, 0.9);
        rockH = (1.0 - seam) * 0.1 + hash13(vec3(id * 13.0)) * 0.06 + fbm3l(p * 30.0) * 0.4 + fine * 0.05 - crack * 0.4 + lich * 0.15 + orange * 0.1;
        rockR = mix(0.92, 0.55, isQ * (1.0 - seam)) - 0.1 * lich;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = bumpFrom(rockH, normal, -vViewPosition, 0.012);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = rockR;`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        float ao = mix(0.65, 1.0, smoothstep(0.0, 0.7, clamp(vCav, 0.0, 1.0)));
        reflectedLight.indirectDiffuse *= ao;
        reflectedLight.indirectSpecular *= ao;`,
      );
  };
  return m;
}

// the soil: dark peat in crumbly clods, specks of sand, a few pale fibres
// of dead moss, matte
function soilMaterial() {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 });
  m.onBeforeCompile = (s) => {
    withObjectPosition(s);
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObj;
        ${GLSL_NOISE}
        ${BUMP}
        float soilH;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vObj;
        vec3 q = p + (vec3(vnoise(p * 18.0), vnoise(p * 18.0 + 7.0), vnoise(p * 18.0 + 13.0)) - 0.5) * 0.05;
        vec3 c1 = worley(q * 45.0);
        vec3 c2 = worley(q * 150.0 + 3.0);
        // crevices: narrow, and only here and there, so the clods merge
        float gap = (1.0 - smoothstep(0.0, 0.07, c1.y - c1.x)) * smoothstep(0.5, 0.75, vnoise(p * 14.0));
        float crumb = 1.0 - smoothstep(0.0, 0.5, c2.x); // little round crumbs
        float w = fbm3(p * 7.0);
        vec3 col = mix(vec3(0.045, 0.03, 0.02), vec3(0.14, 0.095, 0.06), smoothstep(0.2, 0.85, w));
        col *= 0.85 + 0.3 * c1.z;
        col *= 0.8 + 0.35 * crumb * c2.z;
        col *= 1.0 - 0.6 * gap;
        // sand and grit
        float sand = step(0.985, hash13(floor(p * 420.0)));
        col = mix(col, vec3(0.2, 0.17, 0.13) * (0.6 + 0.6 * hash13(floor(p * 420.0) + 3.0)), sand * (1.0 - gap));
        diffuseColor.rgb *= col;
        soilH = w * 0.4 - gap * 0.5 + crumb * 0.25 + sand * 0.15;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = bumpFrom(soilH, normal, -vViewPosition, 0.01);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = mix(0.8, 1.0, clamp(gap + sand, 0.0, 1.0));`,
      );
  };
  return m;
}
