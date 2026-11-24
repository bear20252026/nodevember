/**
 * The lattice on any closed mesh (Suzanne to begin with). No unrolling: seeds are scattered evenly over the
 * surface, and the strands are where the surface crosses the 3D Voronoi walls between neighbouring seeds.
 * For a point, the distance to the wall between its nearest seed i and a neighbour j is a plane distance,
 * so the web needs no graph at all.
 *
 * The glass is grown as in the vessel's merged surface, but on the mesh's own triangles: each one near a
 * strand is split into a fine grid, g (a smooth minimum over walls of distance minus strand radius) is
 * worked out at its points, glass as thick as a round strand stands on both sides of the surface wherever
 * g < 0, and the outline is cut by marching triangles. Thorns grow from junctions (where three cells meet).
 */
import { Grow, hash2, KIND, mulberry, STRIDE, type Lattice, type LatticeParams } from "./geometry";

export type BaseMesh = { pos: Float32Array<ArrayBuffer>; nrm: Float32Array<ArrayBuffer>; idx: Uint32Array<ArrayBuffer> };

/** the rust page's watertight Suzanne (tools/suzanne.py there): u32 nv, nt; f32 positions; f32 normals; u32
 * indices; already in three's frame, y up and facing +z */
export const parseMeshBin = (buf: ArrayBuffer): BaseMesh => {
  const [nv, nt] = new Uint32Array(buf, 0, 2);
  return {
    pos: new Float32Array(buf, 8, nv * 3).slice(),
    nrm: new Float32Array(buf, 8 + nv * 12, nv * 3).slice(),
    idx: new Uint32Array(buf, 8 + nv * 24, nt * 3).slice(),
  };
};

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** seeds scattered over the surface no closer than `gap`, and a grid to find them by */
const scatter = (pos: Float32Array, idx: Uint32Array, gap: number, rnd: () => number) => {
  const nt = idx.length / 3;
  const cdf = new Float64Array(nt);
  let total = 0;
  for (let t = 0; t < nt; t++) {
    const a = idx[t * 3] * 3;
    const b = idx[t * 3 + 1] * 3;
    const c = idx[t * 3 + 2] * 3;
    const u: V3 = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]];
    const v: V3 = [pos[c] - pos[a], pos[c + 1] - pos[a + 1], pos[c + 2] - pos[a + 2]];
    total += 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
    cdf[t] = total;
  }
  const cell = gap;
  const grid = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => (Math.floor(x / cell) + 512) * 1048576 + (Math.floor(y / cell) + 512) * 1024 + (Math.floor(z / cell) + 512);
  const seeds: number[] = [];
  const target = Math.ceil(total / (gap * gap * 0.75));
  for (let tries = 0; tries < target * 30 && seeds.length / 3 < target; tries++) {
    const r = rnd() * total;
    let lo = 0;
    let hi = nt - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < r) lo = m + 1;
      else hi = m;
    }
    let u = rnd();
    let v = rnd();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const a = idx[lo * 3] * 3;
    const b = idx[lo * 3 + 1] * 3;
    const c = idx[lo * 3 + 2] * 3;
    const p: V3 = [0, 1, 2].map((k) => pos[a + k] + (pos[b + k] - pos[a + k]) * u + (pos[c + k] - pos[a + k]) * v) as V3;
    let ok = true;
    const cx = Math.floor(p[0] / cell);
    const cy = Math.floor(p[1] / cell);
    const cz = Math.floor(p[2] / cell);
    for (let i = -1; i <= 1 && ok; i++)
      for (let j = -1; j <= 1 && ok; j++)
        for (let k = -1; k <= 1 && ok; k++) {
          const list = grid.get((cx + i + 512) * 1048576 + (cy + j + 512) * 1024 + (cz + k + 512));
          if (!list) continue;
          for (const s of list) {
            if (Math.hypot(seeds[s * 3] - p[0], seeds[s * 3 + 1] - p[1], seeds[s * 3 + 2] - p[2]) < gap) {
              ok = false;
              break;
            }
          }
        }
    if (!ok) continue;
    const id = seeds.length / 3;
    seeds.push(...p);
    const kk = key(...p);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk)!.push(id);
  }
  return { seeds: new Float32Array(seeds), grid, cell, area: total };
};

export const buildForm = (p: LatticeParams, base: BaseMesh): Lattice => {
  const verts = new Grow((n) => new Float32Array(n));
  const idx = new Grow((n) => new Uint32Array(n));
  const glints: number[] = [];
  const rnd = mulberry(p.seed * 7919 + 13);

  // fitted to about the vessel's size: 1.65 wide
  let ext = 0;
  for (let i = 0; i < base.pos.length; i += 3) ext = Math.max(ext, Math.abs(base.pos[i]));
  const scale = 0.825 / ext;
  const pos = base.pos.map((v) => v * scale);
  const nrm = base.nrm;

  // the cells: as many round the widest part as the vessel has round its belly
  const gap = Math.PI / p.cells;
  const main = scatter(pos, base.idx, gap, rnd);
  const fine = scatter(pos, base.idx, gap / 1.8, rnd);
  // each finer seed belongs to the main cell it lies in: a chosen main cell is split by all of the finer walls
  // between its own seeds, so every finer strand runs from main strand to main strand, none ends in the air
  const fineOwner = new Int32Array(fine.seeds.length / 3);
  const k = p.fillet;

  /** g at a point (the smooth minimum over nearby walls of distance minus strand radius), the nearest strand's
   * radius, the wall's outward direction there, and which seed the point belongs to */
  const out = { g: 0, r: 0, dx: 0, dy: 0, dz: 0, owner: -1 };
  type Seeds = ReturnType<typeof scatter>;
  /** the seeds near a spot, gathered once for a whole (small) triangle */
  const gather = (S: Seeds, x: number, y: number, z: number) => {
    const cx = Math.floor(x / S.cell);
    const cy = Math.floor(y / S.cell);
    const cz = Math.floor(z / S.cell);
    const near: number[] = [];
    // a triangle is far smaller than a cell; the walls near it belong to seeds within a cell or so
    for (let i = -1; i <= 1; i++)
      for (let j = -1; j <= 1; j++)
        for (let l = -1; l <= 1; l++) {
          const list = S.grid.get((cx + i + 512) * 1048576 + (cy + j + 512) * 1024 + (cz + l + 512));
          if (list) for (const q of list) near.push(q);
        }
    return near;
  };
  const walls = (S: Seeds, near: number[], x: number, y: number, z: number, rBase: number, keep: number, salt: number, g0: number, within = -1) => {
    const s = S.seeds;
    let bi = -1;
    let bd = Infinity;
    for (const q of near) {
      if (within >= 0 && fineOwner[q] !== within) continue;
      const d = (s[q * 3] - x) ** 2 + (s[q * 3 + 1] - y) ** 2 + (s[q * 3 + 2] - z) ** 2;
      if (d < bd) {
        bd = d;
        bi = q;
      }
    }
    let g = g0;
    if (bi < 0) return g;
    const ix = s[bi * 3];
    const iy = s[bi * 3 + 1];
    const iz = s[bi * 3 + 2];
    for (const q of near) {
      if (q === bi) continue;
      if (within >= 0 && fineOwner[q] !== within) continue;
      const vx = s[q * 3] - ix;
      const vy = s[q * 3 + 1] - iy;
      const vz = s[q * 3 + 2] - iz;
      const L = Math.hypot(vx, vy, vz);
      // distance to the wall halfway between them
      const e = -((x - ix - vx / 2) * vx + (y - iy - vy / 2) * vy + (z - iz - vz / 2) * vz) / L;
      if (e > g + k + rBase * 2) continue;
      const h = hash2(Math.min(bi, q), Math.max(bi, q), salt);
      if (h > keep) continue;
      const r = Math.max(rBase * (0.35 + 1.3 * (h / keep) ** 2), p.res * 1.15);
      const d = e - r;
      if (d < out.g) {
        out.g = d;
        out.r = r;
        out.dx = -vx / L;
        out.dy = -vy / L;
        out.dz = -vz / L;
      }
      const hh = Math.max(k - Math.abs(g - d), 0) / k;
      g = Math.min(g, d) - hh * hh * k * 0.25;
    }
    if (salt === 1) out.owner = bi;
    return g;
  };
  for (let f = 0; f < fineOwner.length; f++) {
    const x = fine.seeds[f * 3];
    const y = fine.seeds[f * 3 + 1];
    const z = fine.seeds[f * 3 + 2];
    let best = -1;
    let bd = Infinity;
    for (const q of gather(main, x, y, z)) {
      const d = (main.seeds[q * 3] - x) ** 2 + (main.seeds[q * 3 + 1] - y) ** 2 + (main.seeds[q * 3 + 2] - z) ** 2;
      if (d < bd) {
        bd = d;
        best = q;
      }
    }
    fineOwner[f] = best;
  }
  let nearMain: number[] = [];
  let nearFine: number[] = [];
  const field = (x: number, y: number, z: number) => {
    out.g = 1;
    out.r = 0;
    out.owner = -1;
    let g = walls(main, nearMain, x, y, z, p.rMain, 1, 1, 1);
    const owner = out.owner;
    if (p.fine > 0 && owner >= 0 && hash2(owner, 3, p.seed) < p.fine) g = walls(fine, nearFine, x, y, z, p.rFine, 1, 2, g, owner);
    out.owner = owner;
    return g;
  };

  /** a pillow vertex standing off the surface point P (normal N) by the glass's thickness there */
  const emit = (P: V3, N: V3, g: number, r: number, d: V3, side: number) => {
    const q = Math.max(0, g + r);
    const T = side * Math.sqrt(Math.max(0, r * r - q * q));
    // the wall's direction laid into the surface: the outline's way out
    const dn = dot(d, N);
    const t = norm([d[0] - N[0] * dn, d[1] - N[1] * dn, d[2] - N[2] * dn]);
    let n: V3 = [q * t[0] + T * N[0], q * t[1] + T * N[1], q * t[2] + T * N[2]];
    const nl = Math.hypot(...n);
    n = nl > 1e-9 ? [n[0] / nl, n[1] / nl, n[2] / nl] : [N[0] * side, N[1] * side, N[2] * side];
    verts.push(P[0] + N[0] * T, P[1] + N[1] * T, P[2] + N[2] * T, n[0], n[1], n[2], 0, KIND.strand, 0, 0, N[0], N[1], N[2]);
    return verts.length / STRIDE - 1;
  };
  const tri = (a: number, b: number, c: number) => {
    const A = verts.a;
    const pa = a * STRIDE;
    const pb = b * STRIDE;
    const pc = c * STRIDE;
    const u: V3 = [A[pb] - A[pa], A[pb + 1] - A[pa + 1], A[pb + 2] - A[pa + 2]];
    const v: V3 = [A[pc] - A[pa], A[pc + 1] - A[pa + 1], A[pc + 2] - A[pa + 2]];
    const n: V3 = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const s: V3 = [A[pa + 3] + A[pb + 3] + A[pc + 3], A[pa + 4] + A[pb + 4] + A[pc + 4], A[pa + 5] + A[pb + 5] + A[pc + 5]];
    if (dot(n, s) >= 0) idx.push(a, b, c);
    else idx.push(a, c, b);
  };

  // the mesh's longest edge sets how finely every triangle is split, so neighbours split alike and meet
  const I = base.idx;
  let longest = 0;
  for (let t = 0; t < I.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = I[t + e] * 3;
      const b = I[t + ((e + 1) % 3)] * 3;
      longest = Math.max(longest, Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]));
    }
  }
  const n = Math.max(1, Math.ceil(longest / p.res));
  const npts = ((n + 1) * (n + 2)) / 2;
  const pid = (i: number, j: number) => (i * (2 * n + 3 - i)) / 2 + j; // row i has n + 1 - i points
  const PX = new Float32Array(npts * 3);
  const NX = new Float32Array(npts * 3);
  const G = new Float32Array(npts);
  const R = new Float32Array(npts);
  const D = new Float32Array(npts * 3);
  const top = new Int32Array(npts);
  const edgeMap = new Map<number, number>();
  const junctions = new Map<string, number[][]>();
  const cornerOwner = [0, 0, 0];

  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3;
    const b = I[t + 1] * 3;
    const c = I[t + 2] * 3;
    const A: V3 = [pos[a], pos[a + 1], pos[a + 2]];
    const B: V3 = [pos[b], pos[b + 1], pos[b + 2]];
    const C: V3 = [pos[c], pos[c + 1], pos[c + 2]];
    const mid: V3 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
    nearMain = gather(main, ...mid);
    nearFine = p.fine > 0 ? gather(fine, ...mid) : [];
    // far from every strand: nothing here
    let gmin = Infinity;
    [A, B, C].forEach((P, e) => {
      gmin = Math.min(gmin, field(...P));
      cornerOwner[e] = out.owner;
    });
    if (cornerOwner[0] !== cornerOwner[1] && cornerOwner[1] !== cornerOwner[2] && cornerOwner[0] !== cornerOwner[2]) {
      const key = [...cornerOwner].sort((x, y) => x - y).join(":");
      if (!junctions.has(key)) junctions.set(key, []);
      junctions.get(key)!.push([(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3, nrm[a] + nrm[b] + nrm[c], nrm[a + 1] + nrm[b + 1] + nrm[c + 1], nrm[a + 2] + nrm[b + 2] + nrm[c + 2]]);
    }
    if (gmin > longest * 1.1) continue;

    // the triangle as a fine grid of points
    const na: V3 = [nrm[a], nrm[a + 1], nrm[a + 2]];
    const nb: V3 = [nrm[b], nrm[b + 1], nrm[b + 2]];
    const nc: V3 = [nrm[c], nrm[c + 1], nrm[c + 2]];
    let any = false;
    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n - i; j++) {
        const u = i / n;
        const v = j / n;
        const w = 1 - u - v;
        const q = pid(i, j);
        const x = A[0] * w + B[0] * u + C[0] * v;
        const y = A[1] * w + B[1] * u + C[1] * v;
        const z = A[2] * w + B[2] * u + C[2] * v;
        PX[q * 3] = x;
        PX[q * 3 + 1] = y;
        PX[q * 3 + 2] = z;
        const N = norm([na[0] * w + nb[0] * u + nc[0] * v, na[1] * w + nb[1] * u + nc[1] * v, na[2] * w + nb[2] * u + nc[2] * v]);
        NX.set(N, q * 3);
        G[q] = field(x, y, z);
        R[q] = out.r;
        D[q * 3] = out.dx;
        D[q * 3 + 1] = out.dy;
        D[q * 3 + 2] = out.dz;
        top[q] = -1;
        if (G[q] < 0) any = true;
      }
    }
    if (!any) continue;
    edgeMap.clear();
    const P3 = (q: number): V3 => [PX[q * 3], PX[q * 3 + 1], PX[q * 3 + 2]];
    const N3 = (q: number): V3 => [NX[q * 3], NX[q * 3 + 1], NX[q * 3 + 2]];
    const D3 = (q: number): V3 => [D[q * 3], D[q * 3 + 1], D[q * 3 + 2]];
    const corner = (q: number) => {
      if (top[q] < 0) {
        top[q] = emit(P3(q), N3(q), G[q], R[q], D3(q), 1);
        emit(P3(q), N3(q), G[q], R[q], D3(q), -1);
      }
      return top[q];
    };
    const crossing = (q0: number, q1: number) => {
      const key = Math.min(q0, q1) * npts + Math.max(q0, q1);
      let v = edgeMap.get(key);
      if (v === undefined) {
        const s = G[q0] / (G[q0] - G[q1]);
        const lerp = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
        v = emit(lerp(P3(q0), P3(q1)), norm(lerp(N3(q0), N3(q1))), 0, Math.max(R[q0], R[q1]), lerp(D3(q0), D3(q1)), 1);
        edgeMap.set(key, v);
      }
      return v;
    };
    /** the inside of one small triangle, top face and bottom face */
    const piece = (q: [number, number, number]) => {
      if (G[q[0]] >= 0 && G[q[1]] >= 0 && G[q[2]] >= 0) return;
      const tp: number[] = [];
      const bt: number[] = [];
      for (let e = 0; e < 3; e++) {
        const q0 = q[e];
        const q1 = q[(e + 1) % 3];
        if (G[q0] < 0) {
          const v = corner(q0);
          tp.push(v);
          bt.push(v + 1);
        }
        if (G[q0] < 0 !== G[q1] < 0) {
          const v = crossing(q0, q1);
          tp.push(v);
          bt.push(v);
        }
      }
      for (let s = 1; s < tp.length - 1; s++) {
        tri(tp[0], tp[s], tp[s + 1]);
        tri(bt[0], bt[s + 1], bt[s]);
      }
    };
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        piece([pid(i, j), pid(i + 1, j), pid(i, j + 1)]);
        if (j < n - i - 1) piece([pid(i + 1, j), pid(i + 1, j + 1), pid(i, j + 1)]);
      }
    }
  }

  // thorns and glints where three cells meet
  const sides = p.sides;
  const tube = (pts: V3[], radii: number[], F: V3) => {
    const base0 = verts.length / STRIDE;
    const T = norm(sub(pts[pts.length - 1], pts[0]));
    const ref: V3 = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const Nn = norm([ref[1] * T[2] - ref[2] * T[1], ref[2] * T[0] - ref[0] * T[2], ref[0] * T[1] - ref[1] * T[0]]);
    const Bn: V3 = [T[1] * Nn[2] - T[2] * Nn[1], T[2] * Nn[0] - T[0] * Nn[2], T[0] * Nn[1] - T[1] * Nn[0]];
    pts.forEach((P, i) => {
      for (let s = 0; s < sides; s++) {
        const an = (s / sides) * Math.PI * 2;
        const d: V3 = [Nn[0] * Math.cos(an) + Bn[0] * Math.sin(an), Nn[1] * Math.cos(an) + Bn[1] * Math.sin(an), Nn[2] * Math.cos(an) + Bn[2] * Math.sin(an)];
        verts.push(P[0] + d[0] * radii[i], P[1] + d[1] * radii[i], P[2] + d[2] * radii[i], d[0], d[1], d[2], 0, KIND.thorn, 0, 0, F[0], F[1], F[2]);
      }
    });
    for (let i = 0; i < pts.length - 1; i++)
      for (let s = 0; s < sides; s++) {
        const a = base0 + i * sides + s;
        const b = base0 + i * sides + ((s + 1) % sides);
        idx.push(a, b, a + sides, b, b + sides, a + sides);
      }
  };
  for (const list of junctions.values()) {
    const J: V3 = [0, 0, 0];
    const Nsum: V3 = [0, 0, 0];
    for (const q of list)
      for (let e = 0; e < 3; e++) {
        J[e] += q[e] / list.length;
        Nsum[e] += q[e + 3];
      }
    const Nj = norm(Nsum);
    if (rnd() < 0.35) glints.push(...J, rnd());
    if (rnd() > p.thorns) continue;
    const side = norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]);
    const dir = norm([Nj[0] + side[0] * 0.6, Nj[1] + side[1] * 0.6, Nj[2] + side[2] * 0.6]);
    const len = p.thornLen * (0.4 + 0.6 * rnd());
    const tip: V3 = [J[0] + dir[0] * len, J[1] + dir[1] * len, J[2] + dir[2] * len];
    tube([J, tip], [p.rMain * 0.8, 0.0002], Nj);
    glints.push(...tip, rnd());
  }

  return { vertices: verts.done(), indices: idx.done(), glints: new Float32Array(glints), stats: { tris: idx.length / 3, edges: junctions.size, cells: main.seeds.length / 3 } };
};
