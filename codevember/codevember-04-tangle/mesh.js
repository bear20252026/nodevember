// Geometry from a generation's skeleton (see growth.js): tubes with rounded
// tips for the stalks, a lumpy rock for the base, or plain lines.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, slabShape } from './growth.js';

// When each point appears in the animation. A step of the growth lays one
// point at the tip of every living stalk, so point i of a branch comes at
// birth + i. A stem's birth is 0, a fork's the step its parent was at where
// it forks off. Then, for the animation only, some stems (and their forks with
// them) start late, so they don't all rise at once — the growth itself had
// them all start together. Found from the skeleton alone, so it works for
// saved generations too.
export const DELAY = { share: 0.55, max: 0.6 }; // stems that start late, and how late at most (× the growth's length)
export function timeline(gen) {
  const birth = new Float64Array(gen.branches.length);
  const root = new Int32Array(gen.branches.length);
  let end = 0;
  gen.branches.forEach((b, k) => {
    const q = b.points;
    root[k] = k;
    if (b.parent >= 0) {
      const p = gen.branches[b.parent].points;
      let j = 0;
      for (let i = p.length - 4; i >= 0; i -= 4)
        if (p[i] === q[0] && p[i + 1] === q[1] && p[i + 2] === q[2]) { j = i / 4; break; }
      birth[k] = birth[b.parent] + j;
      root[k] = root[b.parent];
    }
    end = Math.max(end, birth[k] + q.length / 4 - 1);
  });
  // the delays: most late ones only a little, a few much later
  const rand = rng(gen.seed ^ 0x2545f491);
  const delay = new Float64Array(gen.branches.length);
  gen.branches.forEach((b, k) => {
    if (b.parent < 0 && rand() < DELAY.share) delay[k] = rand() ** 1.6 * DELAY.max * end;
  });
  let late = 0;
  gen.branches.forEach((b, k) => {
    birth[k] += delay[root[k]];
    late = Math.max(late, birth[k] + b.points.length / 4 - 1);
  });
  return { birth, end: late };
}

// For the animation, the geometries carry per vertex the time it's laid
// (aTime) and the way back to where the stalk was a step before (aBack);
// their segments are sorted by time, and userData.times (sorted too) says how
// many to draw up to a time. See growMaterial() in main.js.
function sortByTime(times, arrays) {
  const order = Array.from(times.keys()).sort((a, b) => times[a] - times[b]);
  const out = arrays.map((a) => {
    const n = a.length / times.length;
    const s = new a.constructor(a.length);
    order.forEach((o, i) => s.set(a.subarray(o * n, o * n + n), i * n));
    return s;
  });
  return { times: Float32Array.from(order, (o) => times[o]), out };
}

// the stalks as lines: the fast version
export function skeletonGeometry(gen) {
  const { birth } = timeline(gen);
  const pos = [], time = [], back = [], seg = [];
  gen.branches.forEach((b, k) => {
    const p = b.points;
    for (let i = 4; i < p.length; i += 4) {
      pos.push(p[i - 4], p[i - 3], p[i - 2], p[i], p[i + 1], p[i + 2]);
      const t = birth[k] + i / 4;
      time.push(0, t);
      back.push(0, 0, 0, p[i - 4] - p[i], p[i - 3] - p[i + 1], p[i - 2] - p[i + 2]);
      seg.push(t);
    }
  });
  const { times, out } = sortByTime(seg, [new Float32Array(pos), new Float32Array(time), new Float32Array(back)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out[0], 3));
  g.setAttribute('aTime', new THREE.BufferAttribute(out[1], 1));
  g.setAttribute('aBack', new THREE.BufferAttribute(out[2], 3));
  g.userData = { times, per: 2 };
  return g;
}

// The end of a stalk is pointed: it thins gradually over a long part of it —
// about its last 40% (share), at least min points, at most max — down to thin ×
// its radius, then closes in a short cone (tipRadius along it, TIP.length × its
// radius there). taper(e) is the radius kept, e going from 0 at the tip to 1
// where the thinning starts. The geometry is thinned as the stalk is once
// grown, so the shadows and the occlusion see its point; while the animation
// plays the material thins it more (see growMaterial() in main.js), from
// aCenter (the ring's middle) and aTaper (when the stalk ends, over how many
// steps it thins), so that the growing tip is always the pointed end.
export const TIP = { length: 3, share: 0.4, min: 8, max: 90, thin: 0.14 };
export const taperLength = (n) => Math.min(TIP.max, Math.max(TIP.min, TIP.share * n));
export const taper = (e) => TIP.thin + (1 - TIP.thin) * e * (2 - e);
export const tipRadius = (s) => (1 - s) ** 0.85;

// the stalks as tubes, knobbly a little, with a pointed end
export function stalksGeometry(gen, { radial = 10, cap = 6, occlusion = null, strength = 1.6 } = {}) {
  const rand = rng(gen.seed ^ 0x9e3779b9);
  const { birth } = timeline(gen);
  const pos = [], time = [], back = [], center = [], tap = [];
  const radii = [];
  const occ = [];
  const index = [], tri = [];
  let point = 0; // index of the point in the whole skeleton
  const O = occlusion;
  const T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3();
  const P = new THREE.Vector3(), Q = new THREE.Vector3(), prevT = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  gen.branches.forEach((b, bk) => {
    const p = b.points;
    const n = p.length / 4;
    if (n < 2) {
      point += n;
      return;
    }
    const base = pos.length / 3;
    const t0 = birth[bk], tl = taperLength(n);
    const phase = rand() * 100, freq = 0.25 + rand() * 0.3;
    let rings = 0;
    const ring = (c, r, k, along = 0, mid = c) => {
      // ring i is laid at t0 + i; the cap with the last one, sliding with it
      const from = Math.min(rings, n - 1);
      // thinned around its middle as it is once grown
      const f = taper(Math.min(1, (n - 1 - from) / tl));
      for (let j = 0; j < radial; j++) {
        center.push(mid.x, mid.y, mid.z);
        tap.push(t0 + n - 1, tl);
        const a = (j / radial) * Math.PI * 2;
        tmp.copy(N).multiplyScalar(Math.cos(a)).addScaledVector(Bn, Math.sin(a));
        if (O) {
          // the direction the surface faces there (the cap leans forward)
          const ca = Math.cos(along), sa = Math.sin(along);
          const fx = tmp.x * ca + T.x * sa, fy = tmp.y * ca + T.y * sa, fz = tmp.z * ca + T.z * sa;
          const o = O[k * 4] + O[k * 4 + 1] * fx + O[k * 4 + 2] * fy + O[k * 4 + 3] * fz;
          occ.push(Math.exp(-strength * Math.max(0, o)));
        }
        tmp.multiplyScalar(r).add(c).sub(mid).multiplyScalar(f).add(mid);
        pos.push(tmp.x, tmp.y, tmp.z);
        time.push(t0 + from);
        if (from === 0) back.push(0, 0, 0);
        else {
          const w = base + (from - 1) * radial + j, l = base + from * radial + j;
          back.push(pos[w * 3] - pos[l * 3], pos[w * 3 + 1] - pos[l * 3 + 1], pos[w * 3 + 2] - pos[l * 3 + 2]);
        }
        radii.push(r * f);
      }
      rings++;
    };
    for (let i = 0; i < n; i++) {
      P.fromArray(p, i * 4);
      // tangent, and a normal carried along it (parallel transport)
      const a = Math.max(0, i - 1), c = Math.min(n - 1, i + 1);
      T.set(p[c * 4] - p[a * 4], p[c * 4 + 1] - p[a * 4 + 1], p[c * 4 + 2] - p[a * 4 + 2]).normalize();
      if (i === 0) {
        N.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0).cross(T).normalize();
      } else {
        const axis = tmp.crossVectors(prevT, T);
        const s = axis.length();
        if (s > 1e-6) N.applyAxisAngle(axis.divideScalar(s), Math.asin(Math.min(1, s)));
        N.addScaledVector(T, -N.dot(T)).normalize();
      }
      Bn.crossVectors(T, N);
      prevT.copy(T);
      const bump = 1 + 0.09 * Math.sin(i * freq + phase) + 0.05 * Math.sin(i * freq * 2.7 + phase * 1.3);
      ring(P, p[i * 4 + 3] * bump, point + i);
    }
    // the pointed end (thinned to thin × by ring(), like the end of the tube)
    const r = p[(n - 1) * 4 + 3];
    for (let k = 1; k <= cap; k++) {
      const s = k / cap;
      Q.copy(P).addScaledVector(T, s * TIP.length * r);
      // the cone's surface leans forward (its slope), for the occlusion
      ring(Q, tipRadius(s) * r, point + n - 1, Math.atan((0.85 * (1 - s) ** -0.15) / TIP.length), P);
    }
    for (let i = 0; i < rings - 1; i++)
      for (let j = 0; j < radial; j++) {
        const a = base + i * radial + j, b2 = base + i * radial + ((j + 1) % radial);
        const c = a + radial, d = b2 + radial;
        index.push(a, b2, c, b2, d, c); // counterclockwise seen from outside
        tri.push(t0 + Math.min(i + 1, n - 1), t0 + Math.min(i + 1, n - 1));
      }
    point += n;
  });
  const { times, out } = sortByTime(tri, [new Uint32Array(index)]);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aTime', new THREE.Float32BufferAttribute(time, 1));
  g.setAttribute('aBack', new THREE.Float32BufferAttribute(back, 3));
  g.setAttribute('aCenter', new THREE.Float32BufferAttribute(center, 3));
  g.setAttribute('aTaper', new THREE.Float32BufferAttribute(tap, 2));
  g.setAttribute('radius', new THREE.Float32BufferAttribute(radii, 1));
  if (O) g.setAttribute('occlusion', new THREE.Float32BufferAttribute(occ, 1));
  g.setIndex(new THREE.BufferAttribute(out[0], 1));
  g.computeVertexNormals();
  g.userData = { times, per: 3 };
  return g;
}

// How much of the sky a bit of surface sees, baked from the skeleton: each of
// its points is a piece of stalk (a strip 2r wide, a step long) hiding the part
// of the sky it covers. 1 open, 0 buried: the hollows inside the tangle and the
// crust under it go dark.
function skeletonGrid(gen, reach) {
  let n = 0;
  for (const b of gen.branches) n += b.points.length / 4;
  const P = new Float32Array(n * 5); // x, y, z, r, the area it covers
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let k = 0;
  for (const b of gen.branches) {
    const p = b.points, m = p.length / 4;
    for (let i = 0; i < m; i++, k++) {
      const a = Math.max(0, i - 1), c = Math.min(m - 1, i + 1);
      const len = Math.hypot(p[c * 4] - p[a * 4], p[c * 4 + 1] - p[a * 4 + 1], p[c * 4 + 2] - p[a * 4 + 2]) / Math.max(1, c - a);
      for (let d = 0; d < 3; d++) {
        const v = p[i * 4 + d];
        P[k * 5 + d] = v;
        if (v < min[d]) min[d] = v;
        if (v > max[d]) max[d] = v;
      }
      const r = p[i * 4 + 3];
      P[k * 5 + 3] = r;
      P[k * 5 + 4] = (2 * r * (len || r)) / Math.PI;
    }
  }
  // sorted in cells as large as the reach, x fastest, so a row of cells is one run
  const dims = [0, 1, 2].map((d) => Math.max(1, Math.ceil((max[d] - min[d]) / reach) + 1));
  const cells = dims[0] * dims[1] * dims[2];
  const start = new Int32Array(cells + 1), order = new Int32Array(n), cellIdx = new Int32Array(n);
  const cell = (d, v) => Math.min(dims[d] - 1, Math.max(0, Math.floor((v - min[d]) / reach)));
  for (let i = 0; i < n; i++) {
    cellIdx[i] = cell(0, P[i * 5]) + dims[0] * (cell(1, P[i * 5 + 1]) + dims[1] * cell(2, P[i * 5 + 2]));
    start[cellIdx[i] + 1]++;
  }
  for (let c = 0; c < cells; c++) start[c + 1] += start[c];
  const fill = start.slice(0, cells);
  for (let i = 0; i < n; i++) order[fill[cellIdx[i]]++] = i;
  // the points sorted that way, and the runs of them that may be within reach
  // of x, y, z: runs[2k] to runs[2k + 1] in S (x, y, z, r, area each)
  const S = new Float32Array(n * 5);
  for (let o = 0; o < n; o++) S.set(P.subarray(order[o] * 5, order[o] * 5 + 5), o * 5);
  const runs = new Int32Array(18);
  const near = (x, y, z) => {
    const ci = cell(0, x), cj = cell(1, y), cl = cell(2, z);
    const i0 = Math.max(0, ci - 1), i1 = Math.min(dims[0] - 1, ci + 1);
    let k = 0;
    for (let c = Math.max(0, cl - 1); c <= Math.min(dims[2] - 1, cl + 1); c++)
      for (let b = Math.max(0, cj - 1); b <= Math.min(dims[1] - 1, cj + 1); b++) {
        const row = dims[0] * (b + dims[1] * c);
        runs[k++] = start[row + i0] * 5;
        runs[k++] = start[row + i1 + 1] * 5;
      }
    return k;
  };
  return { n, P, S, runs, near };
}

// for each point of the skeleton, in the order of the branches, what hides the
// sky around it, by direction: o(normal) ≈ a0 + a · normal (a clamped cosine
// lobe, to the first order). Its own stalk (what overlaps it) doesn't count.
export function skeletonOcclusion(gen, { reach = 0.16 } = {}) {
  const { n, P, S, runs, near } = skeletonGrid(gen, reach);
  const out = new Float32Array(n * 4);
  const R2 = reach * reach;
  for (let i = 0; i < n; i++) {
    const x = P[i * 5], y = P[i * 5 + 1], z = P[i * 5 + 2], r = P[i * 5 + 3];
    let a0 = 0, ax = 0, ay = 0, az = 0;
    const k = near(x, y, z);
    for (let m = 0; m < k; m += 2)
      for (let q = runs[m]; q < runs[m + 1]; q += 5) {
        const dx = S[q] - x, dy = S[q + 1] - y, dz = S[q + 2] - z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R2) continue;
        const d = Math.sqrt(d2);
        if (d < (r + S[q + 3]) * 1.05) continue; // the same tube, or a fork of it
        const s = d - r * 0.8; // from the surface rather than the axis
        const a = S[q + 4] / (s * s);
        const w = (a < 1 ? a : 1) * (1 - d2 / R2);
        a0 += w;
        ax += (w * dx) / d;
        ay += (w * dy) / d;
        az += (w * dz) / d;
      }
    out[i * 4] = a0 * 0.25;
    out[i * 4 + 1] = ax * 0.5;
    out[i * 4 + 2] = ay * 0.5;
    out[i * 4 + 3] = az * 0.5;
  }
  return out;
}

// the same, straight for each vertex of a surface (the crust): adds 'occlusion'
export function bakeOcclusion(gen, g, { reach = 0.3, strength = 1.6 } = {}) {
  const { S, runs, near } = skeletonGrid(gen, reach);
  const pos = g.attributes.position.array, nor = g.attributes.normal.array;
  const count = g.attributes.position.count;
  const out = new Float32Array(count);
  const R2 = reach * reach;
  for (let v = 0; v < count; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const nx = nor[v * 3], ny = nor[v * 3 + 1], nz = nor[v * 3 + 2];
    let occ = 0;
    const k = near(x, y, z);
    for (let m = 0; m < k; m += 2)
      for (let q = runs[m]; q < runs[m + 1]; q += 5) {
        const dx = S[q] - x, dy = S[q + 1] - y, dz = S[q + 2] - z;
        const dot = dx * nx + dy * ny + dz * nz;
        if (dot <= 0) continue;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > R2) continue;
        const a = S[q + 4] / d2;
        occ += (a < 1 ? a : 1) * (dot / Math.sqrt(d2)) * (1 - d2 / R2);
      }
    out[v] = Math.exp(-strength * occ);
  }
  g.setAttribute('occlusion', new THREE.BufferAttribute(out, 1));
  return g;
}

// what the stalks grow from: the crust, or the round rock of the first version
export const baseGeometry = (gen) => (gen.params.slab ? slabGeometry(gen) : rockGeometry(gen));

// the crust: its top and its underside on a polar grid, joined by a rough edge
export function slabGeometry(gen, { rings = 56, segments = 240 } = {}) {
  const S = gen.params.slab;
  const shape = slabShape(S);
  const rand = rng(gen.seed ^ 0x5bd1e995);
  // a crusty roughness, finer than the lumps the growth knows about
  const waves = Array.from({ length: 6 }, (_, i) => ({
    fx: (rand() * 2 - 1) * (10 + i * 7), fz: (rand() * 2 - 1) * (10 + i * 7), p: rand() * 6.28, a: 0.012 / (1 + i * 0.6),
  }));
  // since v4 a sharp one: creases (|sin|) instead of soft waves
  const sharp = !!S.ridges;
  const rough = sharp
    ? (x, z) => waves.reduce((s, w) => s + w.a * 2.2 * (0.6 - Math.abs(Math.sin(x * w.fx + z * w.fz + w.p))), 0)
    : (x, z) => waves.reduce((s, w) => s + w.a * Math.sin(x * w.fx + z * w.fz + w.p), 0);

  const pos = [];
  const index = [];
  const vertex = (x, y, z) => pos.push(x, y, z) / 3 - 1;
  const top = [], bottom = [], edge = [];
  for (let i = 0; i <= rings; i++) {
    const u = i / rings;
    top.push([]); bottom.push([]);
    for (let j = 0; j < segments; j++) {
      const t = (j / segments) * Math.PI * 2;
      const k = shape.rho(t) * u;
      const [x, z] = shape.place(k, t);
      const r = rough(x, z);
      top[i].push(vertex(x, shape.top(x, z, u) + r, z));
      bottom[i].push(vertex(x, shape.bottom(x, z, u) - Math.abs(r), z));
      if (i === rings) {
        // the edge bulges out a little, unevenly
        const b = 1 + 0.04 + rough(z * 1.3, x * 1.3) * 2;
        const [ex, ez] = shape.place(k * b, t);
        edge.push(vertex(ex, (shape.top(x, z, u) + shape.bottom(x, z, u)) / 2 + r, ez));
      }
    }
  }
  const quad = (a, b, c, d) => index.push(a, b, c, b, d, c);
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      quad(top[i][j], top[i][j2], top[i + 1][j], top[i + 1][j2]);
      quad(bottom[i][j], bottom[i + 1][j], bottom[i][j2], bottom[i + 1][j2]);
    }
  for (let j = 0; j < segments; j++) {
    const j2 = (j + 1) % segments;
    quad(top[rings][j], top[rings][j2], edge[j], edge[j2]);
    quad(edge[j], edge[j2], bottom[rings][j], bottom[rings][j2]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

// the round rock of the first version (saved generations v1)
export function rockGeometry(gen) {
  const rand = rng(gen.seed ^ 0x5bd1e995);
  const radius = gen.params.rock;
  const ico = new THREE.IcosahedronGeometry(radius, 4);
  ico.deleteAttribute('normal');
  ico.deleteAttribute('uv');
  const g = mergeVertices(ico);
  const lumps = Array.from({ length: 7 }, () => {
    const v = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    return { v, s: 0.15 + rand() * 0.25 };
  });
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = v.clone().normalize();
    let f = 1;
    for (const l of lumps) f += l.s * Math.max(0, d.dot(l.v)) ** 3;
    f *= 0.95 + 0.05 * Math.sin(d.x * 9 + d.y * 7) * Math.sin(d.z * 8);
    // flatter underneath
    if (d.y < -0.3) f *= 0.8 + 0.2 * (1 + d.y) / 0.7;
    v.multiplyScalar(f);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}
