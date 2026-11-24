import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const TABLE_SIZE = 1024;
const MAX_TRIANGLES = 1_200_000; // hard cap: past it the mesh stops getting finer
const SOFT_TRIANGLES = 500_000;
const CULL_FROM = 250_000;
const MIN_EDGE = 0.012; // about a pixel: shorter edges, squashed by the folds, are merged // above this, buried triangles are removed before refining // past it, edges are only split where a fold bends them

// damped spring from 0 to 1 with zero initial velocity: the "gum" wobble
export function spring(x, damping = 5, freq = 2.6) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const w = freq * Math.PI;
  return 1 - Math.exp(-damping * x) * (Math.cos(w * x) + (damping / w) * Math.sin(w * x));
}

export function easeInOut(x) {
  x = Math.min(Math.max(x, 0), 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

// One fold: stretch along the main axis u while slimming along the secondary axis v,
// then wind the ribbon into a serpentine stack (layers piled along v, bending around w).
// opts.axis forces the main axis. opts.stretch: stretch that much more along it
// than a regular fold, slimming only as much as one (the first fold: it turns the
// flat grid of cubes into bars and folds them at once).
// opts.cap: length kept unstretched at both ends, so the rounded ends stay round.
export class Fold {
  constructor(positions, prevAxis, opts = {}) {
    // main axis: X, Y or Z at random, never the same as the previous fold
    const choices = AXES.filter((ax) => !prevAxis || Math.abs(ax.dot(prevAxis)) < 0.5);
    const u = (opts.axis || choices[Math.floor(Math.random() * choices.length)]).clone();
    if (!opts.axis && Math.random() < 0.5) u.negate();
    // secondary axis: of the two remaining world axes, the one in which the shape
    // is thinnest, so the ribbon is a real ribbon and its layers can stack snugly
    const v = new THREE.Vector3();
    const stride = Math.max(1, Math.floor(positions.length / 3 / 6000)) * 3;
    let best = Infinity;
    for (const ax of AXES) {
      if (Math.abs(ax.dot(u)) > 0.5) continue;
      let lo = Infinity, hi = -Infinity;
      for (let i = 0; i < positions.length; i += stride) {
        const b = positions[i] * ax.x + positions[i + 1] * ax.y + positions[i + 2] * ax.z;
        if (b < lo) lo = b; if (b > hi) hi = b;
      }
      if (hi - lo < best) { best = hi - lo; v.copy(ax); }
    }
    if (Math.random() < 0.5) v.negate();
    const w = new THREE.Vector3().crossVectors(u, v);
    this.u = u; this.v = v; this.w = w;

    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity, dmin = Infinity, dmax = -Infinity;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const a = x * u.x + y * u.y + z * u.z;
      const b = x * v.x + y * v.y + z * v.z;
      const d = x * w.x + y * w.y + z * w.z;
      if (a < amin) amin = a; if (a > amax) amax = a;
      if (b < bmin) bmin = b; if (b > bmax) bmax = b;
      if (d < dmin) dmin = d; if (d > dmax) dmax = d;
    }
    this.c = new THREE.Vector3()
      .addScaledVector(u, (amin + amax) / 2)
      .addScaledVector(v, (bmin + bmax) / 2)
      .addScaledVector(w, (dmin + dmax) / 2);

    this.Lu = amax - amin;

    // the middle of the ribbon along its length: straightened while stretching,
    // so the thickness that matters is the local one, not the overall width
    const BINS = 48;
    const lo = new Float32Array(BINS).fill(Infinity), hi = new Float32Array(BINS).fill(-Infinity);
    const bc = (bmin + bmax) / 2;
    const binOf = (a) => Math.min(BINS - 1, Math.max(0, Math.floor(((a - amin) / this.Lu) * BINS)));
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      const a = x * u.x + y * u.y + z * u.z;
      const b = x * v.x + y * v.y + z * v.z - bc;
      const k = binOf(a);
      if (b < lo[k]) lo[k] = b; if (b > hi[k]) hi[k] = b;
    }
    let mids = [];
    for (let k = 0; k < BINS; k++) mids.push(lo[k] <= hi[k] ? (lo[k] + hi[k]) / 2 : null);
    for (let k = 0; k < BINS; k++) if (mids[k] === null) mids[k] = mids.slice(0, k).reverse().find((m) => m !== null) ?? mids.find((m) => m !== null) ?? 0;
    for (let pass = 0; pass < 3; pass++)
      mids = mids.map((m, k) => (mids[Math.max(k - 1, 0)] + 2 * m + mids[Math.min(k + 1, BINS - 1)]) / 4);
    this.centers = new Float32Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) {
      const fb = (i / (TABLE_SIZE - 1)) * BINS - 0.5;
      const k = Math.min(Math.max(Math.floor(fb), 0), BINS - 2), m = Math.min(Math.max(fb - k, 0), 1);
      this.centers[i] = mids[k] + (mids[k + 1] - mids[k]) * m;
    }
    let half = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i] - this.c.x, y = positions[i + 1] - this.c.y, z = positions[i + 2] - this.c.z;
      const a = x * u.x + y * u.y + z * u.z;
      const b = x * v.x + y * v.y + z * v.z;
      half = Math.max(half, Math.abs(b - this.centerAt(a)));
    }
    // always folded in two: one turn, two layers
    const N = 2;
    this.N = N;
    // stretch by the layer count so the folded shape keeps its size
    this.L = this.Lu * N * (opts.stretch || 1);
    const cap = opts.cap || 0;
    this.core = opts.stretch ? this.Lu / 2 - cap : 0;
    this.K = opts.stretch ? (this.L / 2 - cap) / this.core : N;
    // thinner by the layer count only, however much it stretches
    this.slim = (N - 1) / (this.K - 1);
    this.T = (2 * half) / N;
    this.r = this.T * 0.5 + 0.005; // layers pressed together
    // the turn sits in the middle of the ribbon
    this.turnStart = [(this.L - Math.PI * this.r) / 2];
    this.side = Math.random() < 0.5 ? 1 : -1;

    this.finalTable = this.buildTable(1);
    this.setState(0, 0);
  }

  // local middle of the ribbon, a measured from the center
  centerAt(a) {
    const f = Math.min(Math.max((a / this.Lu + 0.5) * (TABLE_SIZE - 1), 0), TABLE_SIZE - 1.0001);
    const i = Math.floor(f);
    return this.centers[i] + (this.centers[i + 1] - this.centers[i]) * (f - i);
  }

  // all the turns close together. The layers meet, bounce very slightly back
  // open and settle: a light spring, reflected so it never goes through itself
  turnProgress(j, t) {
    const p = spring(t, 7, 2);
    return p > 1 ? 2 - p : p;
  }

  curvature(s, prog) {
    let j = -1;
    for (let q = 0; q < this.N - 1; q++) {
      const s0 = this.turnStart[q];
      if (s >= s0 && s < s0 + Math.PI * this.r) j = q;
    }
    if (j < 0) return 0;
    // a turn may overshoot a little, but never tighter than the ribbon allows
    const k = Math.min(prog[j] / this.r, 1 / (this.T * 0.5 + 0.0025));
    return this.side * (j % 2 ? -1 : 1) * k;
  }

  // centerline of the ribbon, sampled by arc length, centered on its mean
  buildTable(t) {
    const tx = new Float32Array(TABLE_SIZE), ty = new Float32Array(TABLE_SIZE), tt = new Float32Array(TABLE_SIZE);
    const prog = [];
    for (let j = 0; j < this.N - 1; j++) prog.push(this.turnProgress(j, t));
    const ds = this.L / (TABLE_SIZE - 1);
    let x = 0, y = 0, th = 0, mx = 0, my = 0;
    for (let i = 0; i < TABLE_SIZE; i++) {
      tx[i] = x; ty[i] = y; tt[i] = th;
      mx += x; my += y;
      const k = this.curvature((i + 0.5) * ds, prog);
      const thm = th + (k * ds) / 2;
      x += Math.cos(thm) * ds;
      y += Math.sin(thm) * ds;
      th += k * ds;
    }
    mx /= TABLE_SIZE; my /= TABLE_SIZE;
    for (let i = 0; i < TABLE_SIZE; i++) { tx[i] -= mx; ty[i] -= my; }
    return { tx, ty, tt };
  }

  // s: stretch progress, t: fold progress
  setState(s, t) {
    this.se = spring(s, 6, 1.5); // a tiny elastic overshoot of the stretch
    this.neck = 0.32 * Math.sin(Math.PI * Math.min(Math.max(s, 0), 1));
    this.table = this.buildTable(t);
  }

  // push the current state to the shader
  upload() {
    const U = foldUniforms;
    U.uFoldActive.value = 1;
    U.uC.value.copy(this.c);
    U.uU.value.copy(this.u);
    U.uV.value.copy(this.v);
    U.uW.value.copy(this.w);
    U.uK.value = this.K;
    U.uSlim.value = this.slim;
    U.uCore.value = this.core;
    U.uSe.value = this.se;
    U.uNeck.value = this.neck;
    U.uLu.value = this.Lu;
    U.uL.value = this.L;
    const data = tableTexture.image.data;
    const { tx, ty, tt } = this.table;
    for (let i = 0; i < TABLE_SIZE; i++) {
      data[i * 4] = tx[i];
      data[i * 4 + 1] = ty[i];
      data[i * 4 + 2] = tt[i];
      data[i * 4 + 3] = this.centers[i];
    }
    tableTexture.needsUpdate = true;
  }

  apply(p, o, out, table = this.table, se = this.se, neck = this.neck) {
    const { u, v, w, c } = this;
    const x = p[o] - c.x, y = p[o + 1] - c.y, z = p[o + 2] - c.z;
    const a = x * u.x + y * u.y + z * u.z;
    const b = x * v.x + y * v.y + z * v.z;
    const d = x * w.x + y * w.y + z * w.z;

    const k = 1 + (this.K - 1) * se;
    const a1 = this.core ? Math.sign(a) * (Math.min(Math.abs(a), this.core) * k + Math.max(Math.abs(a) - this.core, 0)) : a * k;
    let b1 = (b - this.centerAt(a) * se) / (1 + (k - 1) * this.slim), d1 = d;
    if (neck > 0) {
      const q = a1 / (0.3 * this.Lu * k);
      const n = neck * Math.exp(-q * q);
      b1 *= 1 - n;
      d1 *= 1 - 0.6 * n;
    }

    // look up the centerline at arc length
    const arc = a1 + this.L / 2;
    const { tx, ty, tt } = table;
    let cx, cy, th;
    const f = (arc / this.L) * (TABLE_SIZE - 1);
    if (f <= 0) {
      th = tt[0]; cx = tx[0] + Math.cos(th) * arc; cy = ty[0] + Math.sin(th) * arc;
    } else if (f >= TABLE_SIZE - 1) {
      const e = arc - this.L, l = TABLE_SIZE - 1;
      th = tt[l]; cx = tx[l] + Math.cos(th) * e; cy = ty[l] + Math.sin(th) * e;
    } else {
      const i = Math.floor(f), m = f - i;
      cx = tx[i] + (tx[i + 1] - tx[i]) * m;
      cy = ty[i] + (ty[i + 1] - ty[i]) * m;
      th = tt[i] + (tt[i + 1] - tt[i]) * m;
    }
    const X = cx - Math.sin(th) * b1;
    const Y = cy + Math.cos(th) * b1;

    out[0] = c.x + u.x * X + v.x * Y + w.x * d1;
    out[1] = c.y + u.y * X + v.y * Y + w.y * d1;
    out[2] = c.z + u.z * X + v.z * Y + w.z * d1;
    return out;
  }

  applyFinal(p, o, out) {
    return this.apply(p, o, out, this.finalTable, 1, 0);
  }
}

// The shape: a grid of rounded cubes, kept as a welded triangle mesh.
// `base` holds the positions before the fold in progress, `fin` the positions
// once it is done. The fold itself is applied in the vertex shader.
// `rest` holds where each vertex was in the first grid: what is drawn there
// stretches and folds with the shape.
export class Shape {
  // a vertical n x n wall of cubes, in the X/Y plane, one cube deep
  constructor(palette, n = 4, size = 0.94, pitch = 1) {
    const base = [], cubeOf = [], index = []; // cubeOf: cube id of every vertex, to recolor at any time
    this.tints = []; // per cube: which color, and its own small variation

    this.grid = { n, pitch, size, bevel: 0.13 };
    const proto = new RoundedBoxGeometry(size, size, size, 2, this.grid.bevel);
    proto.deleteAttribute('normal');
    proto.deleteAttribute('uv');
    const cube = mergeVertices(proto);
    const cp = cube.attributes.position.array;
    const ci = cube.index.array;

    const total = n * n;
    const slots = [...Array(total).keys()].sort(() => Math.random() - 0.5);
    let id = 0;
    const off = ((n - 1) * pitch) / 2;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        this.tints.push({
          slot: slots[id],
          other: Math.random(),
          mix: Math.random() * 0.15,
          dh: (Math.random() - 0.5) * 0.03,
          dl: (Math.random() - 0.5) * 0.08,
        });
        const start = base.length / 3;
        for (let q = 0; q < cp.length; q += 3) {
          base.push(cp[q] + i * pitch - off, cp[q + 1] + j * pitch - off, cp[q + 2]);
          cubeOf.push(id);
        }
        for (let q = 0; q < ci.length; q++) index.push(ci[q] + start);
        id++;
      }
    this.foldCount = 0;
    this.geometry = null;
    this.setPalette(palette);
    this.adopt({ base, fin: base, rest: base, cubeOf, index });
  }

  // can be called at any time: planned meshes only carry cube ids, and get
  // their colors from the current palette when adopted
  setPalette(palette) {
    const cols = palette.colors;
    this.cubeColors = this.tints.map((t) =>
      cols[t.slot % cols.length].clone()
        .lerp(cols[Math.floor(t.other * cols.length)], t.mix)
        .offsetHSL(t.dh, 0, t.dl));
    if (this.geometry) this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors(), 3));
  }

  colors() {
    const color = new Float32Array(this.cubeOf.length * 3);
    this.cubeOf.forEach((c, i) => this.cubeColors[c].toArray(color, i * 3));
    return color;
  }

  get triangleCount() { return this.index.length / 3; }

  // positions once the fold in progress is done: where the next fold starts from
  get finT() { return this.finCache || (this.finCache = new Float32Array(this.fin)); }

  // Refine the mesh where the next fold will bend or stretch it, starting from
  // the state after the current fold. Edges are split at their midpoint (shared
  // between neighbours, so no cracks). A generator: it yields regularly so the
  // work runs over many frames, while the current fold is animating. Returns
  // the refined mesh, to be swapped in with adopt().
  // `findVisible(positions, index)`: optional generator flagging the vertices
  // that can be seen; triangles buried inside the shape are dropped.
  *plan(fold, findVisible, budget = 7, eps = 0.004) {
    // heavy mesh: trade detail evenly, rather than running into the hard cap
    const load = Math.max(1, this.index.length / 3 / SOFT_TRIANGLES);
    eps *= load;
    const maxLen = Math.min(0.24 * (1.6 + 0.6 * this.foldCount), 0.5);
    let base = this.fin.slice(), rest = this.rest.slice(), cubeOf = this.cubeOf.slice();
    let index = this.index;
    if (findVisible && index.length / 3 > CULL_FROM) {
      const visible = yield* findVisible(base, index);
      const remap = new Int32Array(base.length / 3).fill(-1);
      const nb = [], nr = [], nc = [], ni = [];
      for (let t = 0; t < index.length; t += 3) {
        const a = index[t], b = index[t + 1], c = index[t + 2];
        if (!(visible[a] || visible[b] || visible[c])) continue;
        for (const v of [a, b, c]) {
          if (remap[v] < 0) {
            remap[v] = nb.length / 3;
            nb.push(base[v * 3], base[v * 3 + 1], base[v * 3 + 2]);
            nr.push(rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]);
            nc.push(cubeOf[v]);
          }
          ni.push(remap[v]);
        }
      }
      base = nb; rest = nr; cubeOf = nc; index = ni;
      yield;
    }
    if (this.foldCount > 0) {
      ({ base, rest, cubeOf, index } = collapseShortEdges(base, rest, cubeOf, index, MIN_EDGE * load));
      yield;
    }
    let sliceStart = performance.now();
    const fin = [];
    const tmp = [0, 0, 0];
    for (let i = 0; i < base.length; i += 3) {
      fold.applyFinal(base, i, tmp);
      fin.push(tmp[0], tmp[1], tmp[2]);
      if ((i & 8191) === 0 && performance.now() - sliceStart > budget) {
        yield;
        sliceStart = performance.now();
      }
    }
    const baseMid = [0, 0, 0], finMid = [0, 0, 0];

    const keep = new Set(); // edges already found fine: no need to look at them again
    for (let pass = 0; pass < 7; pass++) {
      const useLength = index.length / 3 < SOFT_TRIANGLES;
      const mids = new Map();
      let splits = 0;
      const edge = (i, j) => {
        const key = i < j ? i * 4194304 + j : j * 4194304 + i;
        if (keep.has(key)) return -1;
        let m = mids.get(key);
        if (m !== undefined) return m;
        const i3 = i * 3, j3 = j * 3;
        const ex = fin[i3] - fin[j3], ey = fin[i3 + 1] - fin[j3 + 1], ez = fin[i3 + 2] - fin[j3 + 2];
        const len2 = ex * ex + ey * ey + ez * ez;
        for (let q = 0; q < 3; q++) baseMid[q] = (base[i3 + q] + base[j3 + q]) / 2;
        fold.applyFinal(baseMid, 0, finMid);
        let dev2 = 0;
        for (let q = 0; q < 3; q++) {
          const dq = finMid[q] - (fin[i3 + q] + fin[j3 + q]) / 2;
          dev2 += dq * dq;
        }
        const room = index.length / 3 + splits * 2 < MAX_TRIANGLES;
        if (room && ((useLength && len2 > maxLen * maxLen) || dev2 > eps * eps)) {
          m = base.length / 3;
          base.push(...baseMid);
          fin.push(...finMid);
          rest.push((rest[i3] + rest[j3]) / 2, (rest[i3 + 1] + rest[j3 + 1]) / 2, (rest[i3 + 2] + rest[j3 + 2]) / 2);
          cubeOf.push(cubeOf[i]); // edges never cross two cubes
          splits++;
        } else {
          m = -1;
          keep.add(key);
        }
        mids.set(key, m);
        return m;
      };

      if (index.length / 3 > MAX_TRIANGLES) break;
      const out = [];
      for (let t = 0; t < index.length; t += 3) {
        if ((t & 4095) === 0 && performance.now() - sliceStart > budget) {
          yield;
          sliceStart = performance.now();
        }
        let a = index[t], b = index[t + 1], c = index[t + 2];
        let ab = edge(a, b), bc = edge(b, c), ca = edge(c, a);
        const count = (ab >= 0) + (bc >= 0) + (ca >= 0);
        if (count === 0) out.push(a, b, c);
        else if (count === 3) out.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca);
        else {
          // rotate so that the configuration is canonical
          for (let r = 0; r < 3; r++) {
            const ok = count === 1 ? ab >= 0 : ca < 0;
            if (ok) break;
            [a, b, c] = [b, c, a];
            [ab, bc, ca] = [bc, ca, ab];
          }
          if (count === 1) out.push(a, ab, c, ab, b, c);
          else out.push(ab, b, bc, a, ab, bc, a, bc, c);
        }
      }
      index = out;
      if (splits === 0) break;
    }
    return { base, fin, rest, cubeOf, index };
  }

  // swap in a planned mesh: its fold starts now
  adopt(plan) {
    if (this.geometry) this.geometry.dispose();
    Object.assign(this, plan);
    this.finCache = null;
    const g = new THREE.BufferGeometry();
    this.baseT = new Float32Array(this.base);
    g.setAttribute('position', new THREE.BufferAttribute(this.baseT, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.colors(), 3));
    g.setAttribute('rest', new THREE.BufferAttribute(new Float32Array(this.rest), 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(this.index), 1));
    g.computeVertexNormals();
    this.geometry = g;
    foldUniforms.uFoldActive.value = 0;
  }

  // the fold in progress is applied in the vertex shader
  deform(fold, s, t) {
    fold.setState(s, t);
    fold.upload();
  }

  // approximate bounds of the deformed shape, from a subset of vertices
  bounds(min, max, fold) {
    min.set(Infinity, Infinity, Infinity);
    max.set(-Infinity, -Infinity, -Infinity);
    const p = this.baseT;
    const stride = Math.max(1, Math.floor(p.length / 3 / 8000)) * 3;
    const tmp = [0, 0, 0];
    for (let i = 0; i < p.length; i += stride) {
      if (fold) fold.apply(p, i, tmp);
      else { tmp[0] = p[i]; tmp[1] = p[i + 1]; tmp[2] = p[i + 2]; }
      min.x = Math.min(min.x, tmp[0]); max.x = Math.max(max.x, tmp[0]);
      min.y = Math.min(min.y, tmp[1]); max.y = Math.max(max.y, tmp[1]);
      min.z = Math.min(min.z, tmp[2]); max.z = Math.max(max.z, tmp[2]);
    }
  }
}

// Every stretch squashes the mesh 2 or 3 times in one direction, leaving
// slivers far thinner than a pixel. Merge the endpoints of such short edges
// (each vertex at most once per call) and drop the triangles that vanish.
function collapseShortEdges(base, rest, cubeOf, index, minLen) {
  const nv = base.length / 3;
  const rep = new Int32Array(nv);
  for (let i = 0; i < nv; i++) rep[i] = i;
  const used = new Uint8Array(nv);
  const min2 = minLen * minLen;
  for (let t = 0; t < index.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const i = index[t + e], j = index[t + ((e + 1) % 3)];
      if (used[i] || used[j]) continue;
      const dx = base[i * 3] - base[j * 3], dy = base[i * 3 + 1] - base[j * 3 + 1], dz = base[i * 3 + 2] - base[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz > min2) continue;
      used[i] = used[j] = 1;
      rep[j] = i;
      for (let q = 0; q < 3; q++) {
        base[i * 3 + q] = (base[i * 3 + q] + base[j * 3 + q]) / 2;
        rest[i * 3 + q] = (rest[i * 3 + q] + rest[j * 3 + q]) / 2;
      }
    }
  }
  const remap = new Int32Array(nv).fill(-1);
  const nb = [], nr = [], nc = [], ni = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = rep[index[t]], b = rep[index[t + 1]], c = rep[index[t + 2]];
    if (a === b || b === c || c === a) continue;
    for (const v of [a, b, c]) {
      if (remap[v] < 0) {
        remap[v] = nb.length / 3;
        nb.push(base[v * 3], base[v * 3 + 1], base[v * 3 + 2]);
        nr.push(rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2]);
        nc.push(cubeOf[v]);
      }
      ni.push(remap[v]);
    }
  }
  return { base: nb, rest: nr, cubeOf: nc, index: ni };
}

// ---- GPU side -----------------------------------------------------------------

const tableTexture = new THREE.DataTexture(new Float32Array(TABLE_SIZE * 4), TABLE_SIZE, 1, THREE.RGBAFormat, THREE.FloatType);
tableTexture.minFilter = tableTexture.magFilter = THREE.NearestFilter;

export const foldUniforms = {
  uFoldActive: { value: 0 },
  uC: { value: new THREE.Vector3() },
  uU: { value: new THREE.Vector3() },
  uV: { value: new THREE.Vector3() },
  uW: { value: new THREE.Vector3() },
  uK: { value: 1 },
  uSlim: { value: 1 },
  uCore: { value: 0 },
  uSe: { value: 0 },
  uNeck: { value: 0 },
  uLu: { value: 1 },
  uL: { value: 1 },
  uTable: { value: tableTexture },
};

const foldGLSL = /* glsl */ `
uniform float uFoldActive;
uniform vec3 uC, uU, uV, uW;
uniform float uK, uSlim, uCore, uSe, uNeck, uLu, uL;
uniform sampler2D uTable;
const float TABLE_SIZE = ${TABLE_SIZE}.0;

vec3 foldPos(vec3 p) {
  vec3 r = p - uC;
  float a = dot(r, uU), b = dot(r, uV), d = dot(r, uW);
  float k = 1.0 + (uK - 1.0) * uSe;
  float a1 = uCore > 0.0 ? sign(a) * (min(abs(a), uCore) * k + max(abs(a) - uCore, 0.0)) : a * k;
  float fa = clamp((a / uLu + 0.5) * (TABLE_SIZE - 1.0), 0.0, TABLE_SIZE - 1.0001);
  int ia = int(floor(fa));
  float center = mix(texelFetch(uTable, ivec2(ia, 0), 0).w, texelFetch(uTable, ivec2(ia + 1, 0), 0).w, fa - float(ia));
  float q = a1 / (0.3 * uLu * k);
  float n = uNeck * exp(-q * q);
  float b1 = (b - center * uSe) / mix(1.0, k, uSlim) * (1.0 - n);
  float d1 = d * (1.0 - 0.6 * n);

  float arc = a1 + uL * 0.5;
  float f = arc / uL * (TABLE_SIZE - 1.0);
  float fc = clamp(f, 0.0, TABLE_SIZE - 1.0001);
  int i = int(floor(fc));
  float m = fc - float(i);
  vec3 s = mix(texelFetch(uTable, ivec2(i, 0), 0).xyz, texelFetch(uTable, ivec2(i + 1, 0), 0).xyz, m);
  // past either end of the table: continue along the end tangent
  float e = (f - fc) * uL / (TABLE_SIZE - 1.0);
  vec2 dir = vec2(cos(s.z), sin(s.z));
  vec2 xy = s.xy + dir * e + vec2(-dir.y, dir.x) * b1;
  return uC + uU * xy.x + uV * xy.y + uW * d1;
}
`;

// patch a built-in material so it renders the fold in progress
export function foldMaterial(material) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, foldUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\n' + foldGLSL);
    // depth materials (shadows) don't need normals: only move the vertices
    if (material.isMeshDepthMaterial) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        'vec3 transformed = uFoldActive > 0.5 ? foldPos(position) : position;'
      );
      return;
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `
        vec3 objectNormal = normal;
        vec3 foldedPosition = position;
        if (uFoldActive > 0.5) {
          vec3 t1 = normalize(cross(objectNormal, abs(objectNormal.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
          vec3 t2 = cross(objectNormal, t1);
          const float h = 0.003;
          foldedPosition = foldPos(position);
          objectNormal = normalize(cross(foldPos(position + t1 * h) - foldedPosition, foldPos(position + t2 * h) - foldedPosition));
        }`
      )
      .replace('#include <begin_vertex>', 'vec3 transformed = foldedPosition;');
    // inside of a sliced cube: flat, slightly darker colour, like the cut face of a candy
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      'if (!gl_FrontFacing) outgoingLight = diffuseColor.rgb * 0.62;\n#include <opaque_fragment>'
    );
  };
  return material;
}
