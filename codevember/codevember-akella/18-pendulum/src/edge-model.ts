// The lattice of 4: pendulum pairs on a square grid, coupled so that the pair (a, b) at a site behaves as one
// complex amplitude a + i b hopping in a magnetic field (Harper-Hofstadter, flux 1/3 a plaquette), after
// Suesstrunk and Huber (Science 2015). Both "spins" live in the real system: a + i b sees the flux, a - i b its
// opposite, so a pluck on the rim splits into two waves going round in opposite senses. Modes in a bulk gap live on
// the edge only.
import { symmetricEigen } from "./linalg.ts";

export type LatticeShape = { W: number; H: number; hole: [number, number, number, number]; notch: [number, number, number, number] };

export const SHAPE: LatticeShape = { W: 24, H: 15, hole: [8, 5, 16, 10], notch: [15, 0, 18, 3] };

export function buildLattice(shape = SHAPE, flux = 1 / 3) {
  const { W, H, hole, notch } = shape;
  const inside = (r: [number, number, number, number], i: number, j: number) => i >= r[0] && i < r[2] && j >= r[1] && j < r[3];
  const id = new Int32Array(W * H).fill(-1);
  const sites: { i: number; j: number; outer: boolean; inner: boolean }[] = [];
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      if (inside(hole, i, j) || inside(notch, i, j)) continue;
      id[j * W + i] = sites.length;
      sites.push({ i, j, outer: false, inner: false });
    }
  const at = (i: number, j: number) => (i < 0 || j < 0 || i >= W || j >= H ? -1 : id[j * W + i]);
  for (const s of sites)
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const i = s.i + di;
      const j = s.j + dj;
      if (at(i, j) >= 0) continue;
      if (inside(hole, i, j)) s.inner = true;
      else s.outer = true;
    }
  const N = sites.length;
  const n = 2 * N;
  const Hr = new Float64Array(n * n); // real form of the hopping, -t with Peierls phases
  const links: [number, number][] = [];
  const hop = (s: number, r: number, theta: number) => {
    // H[r][s] = -e^{i theta}, H[s][r] = its conjugate; real form [[A, -B], [B, A]]
    const A = -Math.cos(theta);
    const B = -Math.sin(theta);
    const put = (row: number, col: number, a: number, b: number) => {
      Hr[row * n + col] += a;
      Hr[row * n + N + col] += -b;
      Hr[(N + row) * n + col] += b;
      Hr[(N + row) * n + N + col] += a;
    };
    put(r, s, A, B);
    put(s, r, A, -B);
    links.push([s, r]);
  };
  for (const [k, s] of sites.entries()) {
    const right = at(s.i + 1, s.j);
    if (right >= 0) hop(k, right, 2 * Math.PI * flux * s.j);
    const up = at(s.i, s.j + 1);
    if (up >= 0) hop(k, up, 0);
  }
  const { values, vectors } = symmetricEigen(Hr, n);
  return { shape, sites, N, n, links, energies: values, vectors, at };
}

export type Lattice = ReturnType<typeof buildLattice>;

// a pluck at one rim site, filtered to the gap, then every kept mode rounded to a whole number of swings a loop.
// Physical time: w^2 = w0^2 + kappa E.
export function planPluck(L: Lattice, o: { w0: number; kappa: number; at: [number, number]; spread: number; width: number; tmax: number; rimPower?: number; centre?: number }) {
  const { sites, N, n, energies, vectors } = L;
  // where the gap is: the energy (below zero) whose modes sit most on the outer rim
  const rim = vectors.map((v) => {
    let s = 0;
    for (const [k, site] of sites.entries()) if (site.outer) s += v[k] ** 2 + v[N + k] ** 2;
    return s;
  });
  let centre = o.centre ?? 0;
  if (o.centre === undefined) {
    let best = -1;
    for (let e = -3.2; e <= -0.4; e += 0.01) {
      let a = 0;
      let w = 0;
      for (const [j, E] of energies.entries()) {
        const g = Math.exp(-(((E - e) / 0.2) ** 2));
        a += g * rim[j];
        w += g;
      }
      if (w > 2 && a / w > best) {
        best = a / w;
        centre = e;
      }
    }
  }
  const x0 = new Float64Array(n);
  const [pi, pj] = o.at;
  for (const [k, s] of sites.entries()) x0[k] = Math.exp(-((s.i - pi) ** 2 + (s.j - pj) ** 2) / (2 * o.spread * o.spread));
  const modes: { v: Float64Array; A: number; omega: number; E: number; rim: number }[] = [];
  for (const [j, v] of vectors.entries()) {
    const E = energies[j];
    const w = Math.exp(-(((E - centre) / o.width) ** 2));
    if (w < 1e-3) continue;
    let A = 0;
    for (let i = 0; i < n; i++) A += v[i] * x0[i];
    A *= w * rim[j] ** (o.rimPower ?? 0);
    if (Math.abs(A) < 1e-6) continue;
    modes.push({ v, A, omega: Math.sqrt(o.w0 * o.w0 + o.kappa * E), E, rim: rim[j] });
  }
  // the loop: the time over which the kept frequencies best agree, up to one shift common to all of them
  const weight = modes.map((m) => m.A * m.A);
  const total = weight.reduce((a, b) => a + b, 0);
  // (the agreement starts at 1 for T near 0: look only after it has first fallen away)
  let best = { T: 0, R: 0 };
  let fallen = false;
  const curve: [number, number][] = [];
  for (let T = 0.5; T <= o.tmax; T += 0.01) {
    let re = 0;
    let im = 0;
    for (const [k, m] of modes.entries()) {
      const f = (m.omega * T) / (2 * Math.PI);
      re += weight[k] * Math.cos(2 * Math.PI * f);
      im += weight[k] * Math.sin(2 * Math.PI * f);
    }
    const R = Math.hypot(re, im) / total;
    curve.push([T, R]);
    if (R < 0.4) fallen = true;
    if (fallen && R > best.R + 1e-4) best = { T, R };
  }
  const T = best.T;
  // shift common to all: taken out before rounding, so the waves keep their shape all through the loop
  let re = 0;
  let im = 0;
  for (const [k, m] of modes.entries()) {
    const f = (m.omega * T) / (2 * Math.PI);
    re += weight[k] * Math.cos(2 * Math.PI * f);
    im += weight[k] * Math.sin(2 * Math.PI * f);
  }
  const shift = Math.atan2(im, re) / (2 * Math.PI);
  const turns = modes.map((m) => Math.round((m.omega * T) / (2 * Math.PI) - shift));
  return { centre, modes, turns, T, R: best.R, curve };
}
