// The cell's fluid as a continuum on a grid, instead of particles: "stable fluids" (Stam
// 1999) on a staggered (MAC) grid — velocities advected semi-Lagrangian, then made
// incompressible by a pressure projection — the medium around the cell and the cytoplasm
// inside are one and the same flow, told apart by a dye (c: how much of it is cytoplasm).
//
// The membrane and the nucleus are solid cells in it, their velocity imposed on the flow
// (so the moving membrane pushes the fluid, and the fluid can only leave through a tear).
// A swelling (a source in the projection) is what pushes the cytoplasm out once torn.
//
// The fluid's look isn't the dye alone: two fields of material coordinates (where the fluid
// at a cell was some seconds ago) are carried by the flow, so a texture drawn through them
// is stretched and swirled with it — the marbling of the cytoplasm. Each is reset in turn,
// half a period apart, and the look crossfades between them (as a flow map does), so the
// streaks never stretch past recognition.
//
// No three.js here: it runs in node too.

export const FW = 9; // the grid covers [-FW, FW]²
export const G = 160; // cells per side
export const HC = (2 * FW) / G; // a cell's size
export const PERIOD = 6; // seconds between two resets of a field of material coordinates

export function createFluid(seed = 1) {
  const n = G * G, G1 = G + 1;
  const u = new Float32Array(G1 * G), v = new Float32Array(G * G1);
  const u2 = new Float32Array(G1 * G), v2 = new Float32Array(G * G1);
  const p = new Float32Array(n), rhs = new Float32Array(n), src = new Float32Array(n);
  const solid = new Uint8Array(n), sux = new Float32Array(n), suy = new Float32Array(n);
  const inCell = new Uint8Array(n); // inside the membrane's ring (closed across its tears)
  const c = new Float32Array(n);
  // material coordinates, two phases (a, b), as displacements from the cell's centre
  const ax = new Float32Array(n), ay = new Float32Array(n), bx = new Float32Array(n), by = new Float32Array(n);
  const tmp = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const cLo = new Float32Array(n), cHi = new Float32Array(n), fwd = new Float32Array(2 * n); // (-1: none)
  const fields = [c, ax, ay, bx, by];
  const fiber = grain(seed);

  const X = (i) => -FW + (i + 0.5) * HC; // a cell's centre
  const at = (x) => (x + FW) / HC - 0.5; // world → cell coordinate

  function sample(f, w, h, fx, fy) {
    fx = fx < 0 ? 0 : fx > w - 1.001 ? w - 1.001 : fx;
    fy = fy < 0 ? 0 : fy > h - 1.001 ? h - 1.001 : fy;
    const i = fx | 0, j = fy | 0, tx = fx - i, ty = fy - j, k = j * w + i;
    return (f[k] * (1 - tx) + f[k + 1] * tx) * (1 - ty) + (f[k + w] * (1 - tx) + f[k + w + 1] * tx) * ty;
  }
  const velU = (x, y) => sample(u, G1, G, (x + FW) / HC, (y + FW) / HC - 0.5);
  const velV = (x, y) => sample(v, G, G1, (x + FW) / HC - 0.5, (y + FW) / HC);
  const dye = (x, y) => sample(c, G, G, at(x), at(y));
  const pressure = (x, y) => sample(p, G, G, at(x), at(y));

  // the walls: the membrane (capsules along its intact links, discs at the nodes of broken
  // ones) and the nucleus, each cell taking the velocity of what covers it
  function rasterize(mem, bodies) {
    const { mx, my, vx, vy, linkOn, N, RW } = mem;
    solid.fill(0);
    inCell.fill(0);
    // the ring, scanline by scanline
    const xs = [];
    for (let j = 0; j < G; j++) {
      const y = X(j);
      xs.length = 0;
      for (let a = 0, b = N - 1; a < N; b = a++) {
        if ((my[a] > y) !== (my[b] > y)) xs.push(mx[a] + ((y - my[a]) * (mx[b] - mx[a])) / (my[b] - my[a]));
      }
      xs.sort((a, b) => a - b);
      for (let q = 0; q + 1 < xs.length; q += 2) {
        const i0 = Math.max(0, Math.ceil(at(xs[q]))), i1 = Math.min(G - 1, Math.floor(at(xs[q + 1])));
        for (let i = i0; i <= i1; i++) inCell[j * G + i] = 1;
      }
    }
    const r2 = RW * RW;
    for (let a = 0; a < N; a++) {
      const b = (a + 1) % N, on = linkOn[a];
      const x0 = mx[a], y0 = my[a], x1 = on ? mx[b] : x0, y1 = on ? my[b] : y0;
      const sx = x1 - x0, sy = y1 - y0, s2 = sx * sx + sy * sy;
      const i0 = Math.max(0, Math.floor(at(Math.min(x0, x1) - RW))), i1 = Math.min(G - 1, Math.ceil(at(Math.max(x0, x1) + RW)));
      const j0 = Math.max(0, Math.floor(at(Math.min(y0, y1) - RW))), j1 = Math.min(G - 1, Math.ceil(at(Math.max(y0, y1) + RW)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = X(i), py = X(j);
        let t = s2 > 1e-9 ? ((px - x0) * sx + (py - y0) * sy) / s2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = px - x0 - sx * t, dy = py - y0 - sy * t;
        if (dx * dx + dy * dy > r2) continue;
        const k = j * G + i;
        solid[k] = 1;
        sux[k] = vx[a] + ((on ? vx[b] : vx[a]) - vx[a]) * t;
        suy[k] = vy[a] + ((on ? vy[b] : vy[a]) - vy[a]) * t;
      }
    }
    for (const B of bodies) {
      if (!B.solid) continue;
      const i0 = Math.max(0, Math.floor(at(B.x - B.r))), i1 = Math.min(G - 1, Math.ceil(at(B.x + B.r)));
      const j0 = Math.max(0, Math.floor(at(B.y - B.r))), j1 = Math.min(G - 1, Math.ceil(at(B.y + B.r)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = X(i) - B.x, dy = X(j) - B.y;
        if (dx * dx + dy * dy > B.r * B.r) continue;
        const k = j * G + i;
        solid[k] = 1; sux[k] = B.vx; suy[k] = B.vy;
      }
    }
  }

  // the faces touching a wall move with it
  function enforceWalls() {
    for (let j = 0; j < G; j++) for (let i = 1; i < G; i++) {
      const a = j * G + i - 1, b = a + 1;
      if (solid[a] || solid[b]) u[j * G1 + i] = solid[a] && solid[b] ? (sux[a] + sux[b]) / 2 : solid[a] ? sux[a] : sux[b];
    }
    for (let j = 1; j < G; j++) for (let i = 0; i < G; i++) {
      const a = (j - 1) * G + i, b = a + G;
      if (solid[a] || solid[b]) v[j * G + i] = solid[a] && solid[b] ? (suy[a] + suy[b]) / 2 : solid[a] ? suy[a] : suy[b];
    }
  }

  function advectVelocity(dt) {
    for (let j = 0; j < G; j++) for (let i = 0; i <= G; i++) {
      const x = -FW + i * HC, y = X(j);
      const bx_ = x - dt * velU(x, y), by_ = y - dt * velV(x, y);
      u2[j * G1 + i] = velU(bx_, by_);
    }
    for (let j = 0; j <= G; j++) for (let i = 0; i < G; i++) {
      const x = X(i), y = -FW + j * HC;
      const bx_ = x - dt * velU(x, y), by_ = y - dt * velV(x, y);
      v2[j * G + i] = velV(bx_, by_);
    }
    u.set(u2); v.set(v2);
  }

  // the cytoplasm is thick: its velocity is smoothed towards its neighbours' (a viscosity),
  // more where there is more of it
  function viscosity(k) {
    u2.set(u); v2.set(v);
    for (let j = 1; j < G - 1; j++) for (let i = 1; i < G; i++) {
      const f = j * G1 + i, w = k * (c[j * G + i - 1] + c[j * G + i]) * 0.5;
      if (w <= 0) continue;
      u[f] += ((u2[f - 1] + u2[f + 1] + u2[f - G1] + u2[f + G1]) * 0.25 - u2[f]) * w;
    }
    for (let j = 1; j < G; j++) for (let i = 1; i < G - 1; i++) {
      const f = j * G + i, w = k * (c[f - G] + c[f]) * 0.5;
      if (w <= 0) continue;
      v[f] += ((v2[f - 1] + v2[f + 1] + v2[f - G] + v2[f + G]) * 0.25 - v2[f]) * w;
    }
  }

  // incompressible (but for the sources): Σ (p_neighbour - p) = div · h² in each fluid cell,
  // solved by multigrid V-cycles (red-black Gauss-Seidel on each level, the residual handed
  // down to a grid half as fine, its correction brought back up) — relaxation alone can't
  // carry a pressure across the whole cell in a step, and the cell would only pour out
  // through its tear by fits and starts. On padded grids, whose border stays at p = 0 (the
  // grid's edge is open); the walls are closed (left out of their neighbours' sums). A
  // coarse cell is a wall only if all four of its own are.
  const levels = [];
  for (let m = G; ; m /= 2) {
    const mp = m + 2, sz = mp * mp, F = () => new Float32Array(sz);
    levels.push({ n: m, np: mp, s: new Uint8Array(m * m), p: F(), r: F(), res: F(), wl: F(), wr: F(), wd: F(), wu: F(), cnt: F(), im: F() });
    if (m <= 20 || m % 2) break;
  }
  const L0 = levels[0], pp = L0.p, GP = L0.np;
  function setup(L) {
    const { n: m, np: mp, s: S, wl, wr, wd, wu, cnt, im } = L;
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const k = j * m + i, P = (j + 1) * mp + i + 1;
      if (S[k]) { im[P] = cnt[P] = 0; wl[P] = wr[P] = wd[P] = wu[P] = 0; continue; }
      const l = i > 0 && S[k - 1] ? 0 : 1, r = i < m - 1 && S[k + 1] ? 0 : 1;
      const d = j > 0 && S[k - m] ? 0 : 1, uu = j < m - 1 && S[k + m] ? 0 : 1;
      const c_ = l + r + d + uu;
      wl[P] = l; wr[P] = r; wd[P] = d; wu[P] = uu; cnt[P] = c_; im[P] = c_ ? 1 / c_ : 0;
    }
  }
  function relax(L, iters, w) {
    const { n: m, np: mp, p: P_, r, wl, wr, wd, wu, im } = L;
    for (let it = 0; it < iters; it++) for (let red = 0; red < 2; red++) {
      for (let j = 1; j <= m; j++) {
        const row = j * mp;
        for (let i = 1 + ((j + red) & 1); i <= m; i += 2) {
          const P = row + i;
          const sm = P_[P - 1] * wl[P] + P_[P + 1] * wr[P] + P_[P - mp] * wd[P] + P_[P + mp] * wu[P];
          P_[P] += w * ((sm - r[P]) * im[P] - P_[P]);
        }
      }
    }
  }
  function vcycle(l) {
    const L = levels[l];
    if (l === levels.length - 1) { relax(L, 30, 1.6); return; }
    relax(L, 2, 1.15);
    const { n: m, np: mp, p: P_, r, res, wl, wr, wd, wu, cnt } = L;
    for (let j = 1; j <= m; j++) for (let i = 1; i <= m; i++) {
      const P = j * mp + i;
      res[P] = cnt[P] ? r[P] - (P_[P - 1] * wl[P] + P_[P + 1] * wr[P] + P_[P - mp] * wd[P] + P_[P + mp] * wu[P] - cnt[P] * P_[P]) : 0;
    }
    const C = levels[l + 1], cm = C.n, cmp = C.np;
    for (let j = 0; j < cm; j++) for (let i = 0; i < cm; i++) {
      const f = (2 * j + 1) * mp + 2 * i + 1, k = (2 * j) * m + 2 * i, Pc = (j + 1) * cmp + i + 1;
      C.s[j * cm + i] = L.s[k] & L.s[k + 1] & L.s[k + m] & L.s[k + m + 1];
      C.r[Pc] = res[f] + res[f + 1] + res[f + mp] + res[f + mp + 1];
      C.p[Pc] = 0;
    }
    setup(C);
    vcycle(l + 1);
    for (let j = 1; j <= m; j++) for (let i = 1; i <= m; i++) {
      const P = j * mp + i;
      if (cnt[P]) P_[P] += C.p[(((j - 1) >> 1) + 1) * cmp + ((i - 1) >> 1) + 1];
    }
    relax(L, 2, 1.15);
  }
  function project(cycles) {
    const h2 = HC * HC;
    L0.s.set(solid);
    setup(L0);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i, P = (j + 1) * GP + i + 1;
      L0.r[P] = solid[k] ? 0 : ((u[j * G1 + i + 1] - u[j * G1 + i] + v[(j + 1) * G + i] - v[k]) / HC - src[k]) * h2;
      // from the last step's (it changes little from one to the next), let go a little so it
      // can't drift away where a wall closes the fluid in
      pp[P] *= solid[k] ? 0 : 0.98;
    }
    for (let c_ = 0; c_ < cycles; c_++) vcycle(0);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) p[j * G + i] = pp[(j + 1) * GP + i + 1];
    for (let j = 0; j < G; j++) for (let i = 0; i <= G; i++) {
      const a = i > 0 ? j * G + i - 1 : -1, b = i < G ? j * G + i : -1;
      if ((a >= 0 && solid[a]) || (b >= 0 && solid[b])) continue;
      u[j * G1 + i] -= ((b >= 0 ? p[b] : 0) - (a >= 0 ? p[a] : 0)) / HC;
    }
    for (let j = 0; j <= G; j++) for (let i = 0; i < G; i++) {
      const a = j > 0 ? (j - 1) * G + i : -1, b = j < G ? j * G + i : -1;
      if ((a >= 0 && solid[a]) || (b >= 0 && solid[b])) continue;
      v[j * G + i] -= ((b >= 0 ? p[b] : 0) - (a >= 0 ? p[a] : 0)) / HC;
    }
  }

  // the dye and the material coordinates, carried by the flow; nothing is drawn out of a wall
  // (its cells are left out of the interpolation). The dye, MacCormack: carried there and
  // back, half the error made is taken off (within what it was drawn from), so the
  // cytoplasm keeps an edge rather than blurring into the medium step after step
  // Only over the box round the cytoplasm (with a margin, far more than it moves in a step):
  // out of it there is no dye to carry, and the coordinates are only ever seen through it
  const MARGIN = 6;
  function advectScalars(dt) {
    let bi0 = G, bi1 = -1, bj0 = G, bj1 = -1;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      if (c[j * G + i] <= 1e-5) continue;
      if (i < bi0) bi0 = i; if (i > bi1) bi1 = i;
      if (j < bj0) bj0 = j; if (j > bj1) bj1 = j;
    }
    if (bi1 < 0) return;
    bi0 = Math.max(0, bi0 - MARGIN); bi1 = Math.min(G - 1, bi1 + MARGIN);
    bj0 = Math.max(0, bj0 - MARGIN); bj1 = Math.min(G - 1, bj1 + MARGIN);
    for (let j = bj0; j <= bj1; j++) for (let i = bi0; i <= bi1; i++) {
      const k = j * G + i;
      cLo[k] = cHi[k] = c[k]; fwd[2 * k] = -1;
      if (solid[k]) { for (let f = 0; f < 5; f++) tmp[f][k] = fields[f][k]; continue; }
      const x = X(i), y = X(j);
      const uc = (u[j * G1 + i] + u[j * G1 + i + 1]) * 0.5, vc = (v[k] + v[k + G]) * 0.5;
      // midpoint: a better path where the flow curls
      const mx_ = x - 0.5 * dt * uc, my_ = y - 0.5 * dt * vc;
      const sx = x - dt * velU(mx_, my_), sy = y - dt * velV(mx_, my_);
      let fx = at(sx), fy = at(sy);
      fx = fx < 0 ? 0 : fx > G - 1.001 ? G - 1.001 : fx;
      fy = fy < 0 ? 0 : fy > G - 1.001 ? G - 1.001 : fy;
      const i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, q = j0 * G + i0;
      const w00 = solid[q] ? 0 : (1 - tx) * (1 - ty), w10 = solid[q + 1] ? 0 : tx * (1 - ty);
      const w01 = solid[q + G] ? 0 : (1 - tx) * ty, w11 = solid[q + G + 1] ? 0 : tx * ty;
      const W = w00 + w10 + w01 + w11;
      if (W < 1e-4) { for (let f = 0; f < 5; f++) tmp[f][k] = fields[f][k]; continue; }
      let lo = 1e9, hi = -1e9;
      if (w00) { lo = Math.min(lo, c[q]); hi = Math.max(hi, c[q]); }
      if (w10) { lo = Math.min(lo, c[q + 1]); hi = Math.max(hi, c[q + 1]); }
      if (w01) { lo = Math.min(lo, c[q + G]); hi = Math.max(hi, c[q + G]); }
      if (w11) { lo = Math.min(lo, c[q + G + 1]); hi = Math.max(hi, c[q + G + 1]); }
      cLo[k] = lo; cHi[k] = hi;
      fwd[2 * k] = x + dt * uc; fwd[2 * k + 1] = y + dt * vc;
      // the coordinates are displacements: carried, they shift by the way travelled
      const ox = sx - x, oy = sy - y;
      for (let f = 0; f < 5; f++) {
        const F = fields[f];
        let s = (F[q] * w00 + F[q + 1] * w10 + F[q + G] * w01 + F[q + G + 1] * w11) / W;
        if (f === 1 || f === 3) s += ox; else if (f === 2 || f === 4) s += oy;
        tmp[f][k] = s;
      }
    }
    // the dye carried back the other way, from where it went
    const cf = tmp[0];
    for (let j = bj0; j <= bj1; j++) for (let k = j * G + bi0; k <= j * G + bi1; k++) {
      if (fwd[2 * k] === -1) { c[k] = cf[k]; continue; } // a wall, or nothing to draw from
      let fx = at(fwd[2 * k]), fy = at(fwd[2 * k + 1]);
      fx = fx < 0 ? 0 : fx > G - 1.001 ? G - 1.001 : fx;
      fy = fy < 0 ? 0 : fy > G - 1.001 ? G - 1.001 : fy;
      const i0 = fx | 0, j0 = fy | 0, tx = fx - i0, ty = fy - j0, q = j0 * G + i0;
      const w00 = solid[q] ? 0 : (1 - tx) * (1 - ty), w10 = solid[q + 1] ? 0 : tx * (1 - ty);
      const w01 = solid[q + G] ? 0 : (1 - tx) * ty, w11 = solid[q + G + 1] ? 0 : tx * ty;
      const W = w00 + w10 + w01 + w11;
      if (W < 1e-4) { c[k] = cf[k]; continue; }
      const back = (cf[q] * w00 + cf[q + 1] * w10 + cf[q + G] * w01 + cf[q + G + 1] * w11) / W;
      const s = cf[k] + 0.5 * (c[k] - back);
      c[k] = s < cLo[k] ? cLo[k] : s > cHi[k] ? cHi[k] : s;
    }
    for (let f = 1; f < 5; f++) {
      const F = fields[f], T = tmp[f];
      for (let j = bj0; j <= bj1; j++) F.set(T.subarray(j * G + bi0, j * G + bi1 + 1), j * G + bi0);
    }
  }

  // under the walls, for the look only: the dye of the cell's side (spread in from the
  // inside; once torn, from either side), so it reaches in under the blocks (as far as the
  // living membrane's middle) rather than stopping short of them, and fills under the
  // nucleus (seen as it fades)
  function fillWalls(any) {
    for (let pass = 0; pass < 8; pass++) {
      for (let k = G + 1; k < n - G - 1; k++) {
        if (!solid[k]) continue;
        if (!inCell[k] && !any) { c[k] = 0; continue; } // the living membrane's outer half: none
        let s = 0, m = 0;
        for (let e = 0; e < 4; e++) {
          const q = e === 0 ? k - 1 : e === 1 ? k + 1 : e === 2 ? k - G : k + G;
          if (solid[q] && pass === 0) continue;
          if (!inCell[q] && !any) continue; // nor from the outer half (none there)
          s += c[q]; m++;
        }
        if (m) c[k] = s / m;
      }
    }
  }

  // spilt, the cytoplasm creeps out into the medium along its grain (as ink into a wet
  // slide's film, or paper): spreading along the fibres, readily along their channels,
  // hardly across or between them — so the free edge frays into streaks and wisps where
  // the grain runs out of it, and stays smoother where it runs along it. rate: per step,
  // in cells² (a diffusion along the fibre's direction, ≤ 0.25)
  function creep(rate) {
    const { fc, fs, fk } = fiber, s = tmp[0];
    s.set(c);
    for (let j = 1; j < G - 1; j++) for (let i = 1; i < G - 1; i++) {
      const k = j * G + i;
      if (solid[k] || inCell[k]) continue;
      const dx = fc[k], dy = fs[k];
      const a = sample(s, G, G, i + dx, j + dy), b = sample(s, G, G, i - dx, j - dy);
      c[k] += rate * fk[k] * (a + b - 2 * s[k]);
    }
  }

  let phaseA = -1, phaseB = -1;
  function resetCoords(time) {
    const pa = Math.floor(time / PERIOD), pb = Math.floor(time / PERIOD + 0.5);
    if (pa !== phaseA) { ax.fill(0); ay.fill(0); phaseA = pa; }
    if (pb !== phaseB) { bx.fill(0); by.fill(0); phaseB = pb; }
  }
  // how much of the look comes from the coordinates a (the rest from b): nought as a is reset
  const weightA = (time) => 1 - Math.abs(2 * ((time / PERIOD) % 1) - 1);

  return {
    G, FW, HC, u, v, p, c, ax, ay, bx, by, solid, inCell, src,
    X, at, velU, velV, dye, pressure, rasterize, enforceWalls, advectVelocity, viscosity,
    project, advectScalars, fillWalls, resetCoords, weightA, fiber, creep,
  };
}

// the medium's grain, fixed on the slide: its fibres' direction (cos, sin: slowly turning,
// swirled) and how readily the fluid creeps along them there (fk: channels, streaks drawn
// along the fibres — a noise smeared along their lines — with little between them)
function grain(seed) {
  const n = G * G, fc = new Float32Array(n), fs = new Float32Array(n), fk = new Float32Array(n);
  const h = (i, j, o) => { const t = Math.sin(i * 127.1 + j * 311.7 + o * 74.7) * 43758.5453; return t - Math.floor(t); };
  const vn = (x, y, o) => {
    const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
    return (h(i, j, o) * (1 - su) + h(i + 1, j, o) * su) * (1 - sv) + (h(i, j + 1, o) * (1 - su) + h(i + 1, j + 1, o) * su) * sv;
  };
  const o = (seed % 997) * 0.731;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    const x = -FW + (i + 0.5) * HC, y = -FW + (j + 0.5) * HC;
    const th = Math.PI * (2.2 * vn(x * 0.16 + 3.1, y * 0.16, o) + 0.8 * vn(x * 0.45, y * 0.45 + 7.7, o + 1.3));
    fc[j * G + i] = Math.cos(th); fs[j * G + i] = Math.sin(th);
  }
  // a white noise, a value per cell, averaged along each fibre's line both ways
  const wn = new Float32Array(n);
  for (let k = 0; k < n; k++) wn[k] = h(k % G, Math.floor(k / G), o + 5.9);
  const at = (f, x, y) => {
    x = x < 0 ? 0 : x > G - 1.001 ? G - 1.001 : x; y = y < 0 ? 0 : y > G - 1.001 ? G - 1.001 : y;
    const i = x | 0, j = y | 0, u = x - i, v = y - j, k = j * G + i;
    return (f[k] * (1 - u) + f[k + 1] * u) * (1 - v) + (f[k + G] * (1 - u) + f[k + G + 1] * u) * v;
  };
  const L = 7, raw = new Float32Array(n);
  let m = 0, m2 = 0;
  for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
    let s = wn[j * G + i], cnt = 1;
    for (const dir of [1, -1]) {
      let x = i, y = j;
      for (let q = 0; q < L; q++) {
        const dx = at(fc, x, y), dy = at(fs, x, y);
        x += dir * dx * 0.8; y += dir * dy * 0.8;
        s += at(wn, x, y); cnt++;
      }
    }
    s /= cnt; raw[j * G + i] = s; m += s; m2 += s * s;
  }
  m /= n; const sd = Math.sqrt(Math.max(1e-9, m2 / n - m * m));
  for (let k = 0; k < n; k++) {
    const z = (raw[k] - m) / sd, t = Math.min(1, Math.max(0, (z + 0.2) / 1.6));
    fk[k] = 0.06 + 0.94 * t * t * (3 - 2 * t);
  }
  return { fc, fs, fk };
}
