// The two thin films on each side of the blocks, in 2d (no three.js here, so it runs in node
// too). Each is a closed strand of points, S per block, its own thing: while the cell lives
// it lies on a smooth curve through the blocks (a Catmull-Rom spline through their centres,
// offset to each side — not a polygon from block to block), held to it. Once the cell is
// torn, a film is cut where it tore and, later, in a few more places — a handful of long
// strands — peels off the blocks (from the cuts and the broken links on), and its strands
// float off in the fluid, supple, stiffer once free, drifting away from the blocks and out
// from the remains, opening into wide bends (never winding up into loops), and twisting
// slowly about their length in a few places.
import { N, current, rng } from './sim.js';

export const S = 4; // a film's points per block
export const M = N * S; // a film's points
const MIN_PIECE = 30; // points: no strand shorter than that (~7 blocks)
const PEEL = 5; // points per second a peel spreads along a film
const DRAG = 0.06; // how much of a free point's own motion the medium takes away each frame (towards its current)
const BEND = 10; // how far along a film its bending reaches (points)
const YIELD = 0.04; // how fast a free strand's curve gives way to the currents (per second)
const RMIN = 0.7; // the tightest a strand curls (radius)
const RFREE = 1.6; // free, the tightest it curls: no loops nor hooks, only wide bends
const LONG = [16, 32, 64]; // the spans (points) over which a free strand is kept from folding back
const STIFF = 0.2; // how much stiffer it bends once free
const OUT = 0.06; // and how fast it drifts out from the remains (units per second)
// once free, a strand twists here and there: a few places where it turns about its own length
// (and back), slowly, over TWIST_T seconds
const TWISTS = 4, TWIST_T = 10;
const RELAX = 0.06; // how fast a free strand's curve eases out into a gentle arc (per second)
const AWAY = 0.08; // how fast a free strand drifts off the blocks near it (units per second)
const ROVE = 0.045; // and wanders on its own (units per second)
const SHUN = 1.2; // how far it feels the blocks (units)

// the curve through the blocks: per point, its place, outward normal, and the block's half
// thickness and half height there (eased between two blocks). A broken link's two ends are
// curved on their own (the missing neighbour mirrored).
export function ringCurve(sim, halfT, halfH, out) {
  const { mx, my, linkOn } = sim;
  const { x, y, nx, ny, ht, hh } = out;
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N, j = (i + 1) % N, b = (i + 2) % N;
    const x1 = mx[i], y1 = my[i], x2 = mx[j], y2 = my[j];
    const x0 = linkOn[a] ? mx[a] : 2 * x1 - x2, y0 = linkOn[a] ? my[a] : 2 * y1 - y2;
    const x3 = linkOn[j] ? mx[b] : 2 * x2 - x1, y3 = linkOn[j] ? my[b] : 2 * y2 - y1;
    for (let s = 0; s < S; s++) {
      const t = s / S, t2 = t * t, t3 = t2 * t, k = i * S + s;
      x[k] = 0.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3);
      y[k] = 0.5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3);
      const tx = 0.5 * (x2 - x0 + 2 * (2 * x0 - 5 * x1 + 4 * x2 - x3) * t + 3 * (3 * x1 - x0 - 3 * x2 + x3) * t2);
      const ty = 0.5 * (y2 - y0 + 2 * (2 * y0 - 5 * y1 + 4 * y2 - y3) * t + 3 * (3 * y1 - y0 - 3 * y2 + y3) * t2);
      const l = Math.hypot(tx, ty) || 1;
      nx[k] = ty / l; ny[k] = -tx / l; // outward (the ring turns ccw)
      const e = t * t * (3 - 2 * t);
      ht[k] = halfT[i] + (halfT[j] - halfT[i]) * e;
      hh[k] = halfH[i] + (halfH[j] - halfH[i]) * e;
    }
  }
}
export function createCurve() {
  const f = () => new Float32Array(M);
  return { x: f(), y: f(), nx: f(), ny: f(), ht: f(), hh: f() };
}

export function createFilms(sim) {
  const rand = rng(sim.seed * 13 + 5);
  const trand = rng(sim.seed * 31 + 11); // (the twists': the cuts stay as they were)
  const films = [1, -1].map((side) => ({
    side,
    x: new Float32Array(M), y: new Float32Array(M), px: new Float32Array(M), py: new Float32Array(M),
    h: new Float32Array(M), // half height
    att: new Float32Array(M).fill(1), // held to the blocks: 1 pinned, 0 free
    peeled: new Uint8Array(M), peelT: new Float32Array(M),
    cut: new Uint8Array(M), // segment k (point k → k+1) cut
    cuts: 0, maxCuts: 3 + Math.floor(rand() * 3), // 3 to 5 strands
    rest: new Float32Array(M), // segment lengths, from birth
    bend: new Float32Array(M * BEND), // the curve it keeps: point k to k + n's distance at rest
    dx: new Float32Array(M), dy: new Float32Array(M), // its own drift (units per second), eased
    twist: new Float32Array(M), // how far it is turned about its length (radians; 0: upright)
    sites: [], maxSites: 0, // where it twists: { c, w, a, g }
    born: false,
  }));
  let torn = false;
  const cur = [0, 0];
  const strand = new Int32Array(M); // per point, its strand (the point after its cut)
  const pos = new Int32Array(M).fill(-1); // and how far along it

  // where a cut is allowed: no strand left shorter than MIN_PIECE (a first cut opens the ring)
  function canCut(f, k) {
    if (f.cut[k] || f.cuts >= f.maxCuts) return false;
    if (f.cuts === 0) return true;
    for (const dir of [1, -1]) {
      let n = 0;
      for (let m = k; n < MIN_PIECE; n++) {
        m = (m + dir + M) % M;
        if (f.cut[dir > 0 ? (m - 1 + M) % M : m]) break;
      }
      if (n < MIN_PIECE) return false;
    }
    return true;
  }
  function doCut(f, k) {
    f.cut[k] = 1; f.cuts++;
    for (const m of [k, (k + 1) % M]) f.peeled[m] = 1;
  }

  // dt: the frame's (0 when paused); curve: ringCurve's
  function step(dt, curve) {
    const { linkOn } = sim;
    for (const f of films) {
      if (!f.born) {
        for (let k = 0; k < M; k++) {
          f.x[k] = f.px[k] = curve.x[k] + curve.nx[k] * offset(f, curve, k);
          f.y[k] = f.py[k] = curve.y[k] + curve.ny[k] * offset(f, curve, k);
          f.h[k] = curve.hh[k];
        }
        for (let k = 0; k < M; k++) { const m = (k + 1) % M; f.rest[k] = Math.hypot(f.x[m] - f.x[k], f.y[m] - f.y[k]); }
        f.born = true;
      }
    }
    if (dt <= 0) return;
    const dying = sim.dying;

    if (dying >= 0 && !torn) {
      // torn: each film is cut there (not quite at the same place)
      torn = true;
      for (const f of films) doCut(f, (sim.tearAt * S + S / 2 + Math.floor(rand() * 3) - 1 + M) % M);
    }

    for (const f of films) {
      if (dying >= 0) {
        // a while after the tear, now and then, a film gives way somewhere else
        if (dying > 3 && f.cuts < f.maxCuts && rand() < dt * 0.25) {
          const k = Math.floor(rand() * M);
          if (canCut(f, k)) doCut(f, k);
        }
        // it peels off the blocks: where their link broke, and spreading from there and from the cuts
        for (let k = 0; k < M; k++) {
          if (f.peeled[k]) continue;
          if (!linkOn[Math.floor(k / S)]) { f.peeled[k] = 1; continue; }
          const a = (k - 1 + M) % M, b = (k + 1) % M;
          if ((f.peeled[a] && !f.cut[a]) || (f.peeled[b] && !f.cut[k])) {
            f.peelT[k] += dt * PEEL;
            if (f.peelT[k] > 1) f.peeled[k] = 1;
          }
        }
      }

      // each strand drifts as a whole: off the blocks near it (it doesn't linger round the
      // remains) and on a slow wandering course of its own
      if (dying >= 0 && f.cuts) drift(f, dt);

      // here and there, once free, it twists, more and more
      if (dying >= 0) twisting(f, dt);

      // verlet: the free points drift in the medium, dragged towards the fluid's flow there
      // (the spill pouring out, the medium's current), and their strand's own drift
      const t = sim.time, fl = sim.fluid;
      for (let k = 0; k < M; k++) {
        if (f.peeled[k]) f.att[k] = Math.max(0, f.att[k] - dt * 1.5);
        const w = 1 - f.att[k];
        if (w <= 0) continue;
        if (fl) { cur[0] = fl.velU(f.x[k], f.y[k]); cur[1] = fl.velV(f.x[k], f.y[k]); }
        else current(f.x[k], f.y[k], t, cur);
        cur[0] += f.dx[k]; cur[1] += f.dy[k];
        let vx = (f.x[k] - f.px[k]) * 0.98, vy = (f.y[k] - f.py[k]) * 0.98;
        vx += (cur[0] * dt - vx) * DRAG; vy += (cur[1] * dt - vy) * DRAG;
        f.px[k] = f.x[k]; f.py[k] = f.y[k];
        f.x[k] += vx * w; f.y[k] += vy * w;
        // its height: free, it settles to an even one, a little lower
        f.h[k] += (0.1 - f.h[k]) * dt * 0.1 * w;
      }

      // the curve it keeps: on the blocks, theirs; free, the one it had, slowly giving way to
      // the currents — never curled tighter than RMIN
      for (let k = 0; k < M; k++) {
        let arc = f.rest[k];
        for (let n = 2; n <= BEND; n++) {
          const m = (k + n - 1) % M, e = (k + n) % M;
          if (f.cut[m]) break;
          arc += f.rest[m];
          const d = Math.hypot(f.x[e] - f.x[k], f.y[e] - f.y[k]), b = k * BEND + n - 1;
          const held = Math.min(f.att[k], f.att[e]);
          f.bend[b] += (d - f.bend[b]) * (held > 0.5 ? 1 : Math.min(1, dt * YIELD));
          // free, its kinks and crumples ease out: it opens slowly into a gentle arc
          if (held <= 0.5) f.bend[b] += (arc * 0.97 - f.bend[b]) * Math.min(1, dt * RELAX);
          const rmin = held > 0.5 ? RMIN : RFREE;
          f.bend[b] = Math.min(arc * 0.995, Math.max(2 * rmin * Math.sin(Math.min(arc / (2 * rmin), Math.PI / 2)), f.bend[b]));
        }
      }

      for (let it = 0; it < 6; it++) {
        // held to the curve, as much as it is still attached
        for (let k = 0; k < M; k++) {
          const a = f.att[k];
          if (a <= 0) continue;
          const o = offset(f, curve, k);
          const tx = curve.x[k] + curve.nx[k] * o, ty = curve.y[k] + curve.ny[k] * o;
          f.x[k] += (tx - f.x[k]) * a; f.y[k] += (ty - f.y[k]) * a;
          if (it === 0) f.h[k] += (curve.hh[k] - f.h[k]) * a;
        }
        // it hardly stretches, and keeps its curve, supple
        for (let k = 0; k < M; k++) {
          if (f.cut[k]) continue;
          link(f, k, (k + 1) % M, f.rest[k], 0.9);
          for (let n = 2; n <= BEND; n++) {
            if (f.cut[(k + n - 1) % M]) break;
            // (free, stiffer: the fluid's eddies would wind it up into loops)
            const free = 1 - Math.max(f.att[k], f.att[(k + n) % M]);
            link(f, k, (k + n) % M, f.bend[k * BEND + n - 1], (n === 2 ? 0.3 : 0.06) + free * STIFF);
          }
        }
      }

      // free, it doesn't wind up nor fold back on itself: far along a strand, two of its
      // points are kept at least as far apart as on a wide arc (only pushed apart)
      if (dying >= 0 && f.cuts) {
        for (const n of LONG) {
          const lo = 2 * RFREE * Math.sin(Math.min(n * f.rest[0] / (2 * RFREE), Math.PI / 2)) * 0.97;
          for (let k = 0; k < M; k++) {
            const e = (k + n) % M;
            if (strand[e] !== strand[k] || pos[e] < pos[k] || f.att[k] > 0.5 || f.att[e] > 0.5) continue;
            const dx = f.x[e] - f.x[k], dy = f.y[e] - f.y[k], d = Math.hypot(dx, dy);
            if (d >= lo || d < 1e-6) continue;
            const c = ((lo - d) / d) * 0.1;
            f.x[k] -= dx * c; f.y[k] -= dy * c; f.x[e] += dx * c; f.y[e] += dy * c;
          }
        }
      }

      // free, it is pushed off the blocks it drifts into (across their width), it doesn't pass through them
      if (dying >= 0) {
        const { mx, my } = sim;
        for (let k = 0; k < M; k++) {
          const w = 1 - f.att[k];
          if (w <= 0) continue;
          for (let i = 0; i < N; i++) {
            const r = curve.ht[i * S] + 0.04;
            const dx = f.x[k] - mx[i], dy = f.y[k] - my[i], d2 = dx * dx + dy * dy;
            if (d2 >= r * r || d2 < 1e-12) continue;
            const d = Math.sqrt(d2), p = ((r - d) / d) * w * 0.5;
            f.x[k] += dx * p; f.y[k] += dy * p;
          }
        }
        // stretched too far (pulled between two drifting clumps), it gives way
        for (let k = 0; k < M; k++) {
          const m = (k + 1) % M;
          if (!f.cut[k] && Math.hypot(f.x[m] - f.x[k], f.y[m] - f.y[k]) > f.rest[k] * 2 && canCut(f, k)) doCut(f, k);
        }
      }
    }
  }

  // a strand's own drift: away from the blocks within SHUN of it (summed over its points,
  // the nearer the stronger), out from the remains' middle, and a heading of its own,
  // turning slowly; eased in, so a new cut doesn't jerk it
  const sx = [], sy = [], sn = [], px = [], py = [];
  function drift(f, dt) {
    const { mx, my } = sim, t = sim.time;
    let k0 = 0;
    while (!f.cut[(k0 - 1 + M) % M]) k0++;
    for (let n = 0, id = k0; n < M; n++) {
      const k = (k0 + n) % M;
      strand[k] = id; pos[k] = (k - id + M) % M;
      if (f.cut[k]) id = (k + 1) % M;
    }
    sx.length = sy.length = sn.length = px.length = py.length = 0;
    for (let k = 0; k < M; k++) {
      const id = strand[k];
      sx[id] ??= 0; sy[id] ??= 0; sn[id] ??= 0; px[id] ??= 0; py[id] ??= 0;
      sn[id]++; px[id] += f.x[k]; py[id] += f.y[k];
      for (let i = 0; i < N; i++) {
        const ex = f.x[k] - mx[i], ey = f.y[k] - my[i], e2 = ex * ex + ey * ey;
        if (e2 >= SHUN * SHUN || e2 < 1e-9) continue;
        const e = Math.sqrt(e2), p = 1 - e / SHUN;
        sx[id] += (ex / e) * p * p; sy[id] += (ey / e) * p * p;
      }
    }
    let cx = 0, cy = 0;
    for (let i = 0; i < N; i++) { cx += mx[i] / N; cy += my[i] / N; }
    const ease = Math.min(1, dt * 0.5);
    for (let k = 0; k < M; k++) {
      const id = strand[k], n = sn[id];
      const ax = sx[id] / n, ay = sy[id] / n, al = Math.hypot(ax, ay);
      const away = AWAY * Math.min(1, al * 8) / (al || 1);
      const ox = px[id] / n - cx, oy = py[id] / n - cy, ol = Math.hypot(ox, oy) || 1;
      const out = OUT / ol;
      const h = id * 2.39996 + f.side + t * (0.12 + 0.1 * Math.sin(id * 1.7)) + Math.sin(t * 0.21 + id) * 1.3;
      f.dx[k] += (ax * away + ox * out + Math.cos(h) * ROVE - f.dx[k]) * ease;
      f.dy[k] += (ay * away + oy * out + Math.sin(h) * ROVE - f.dy[k]) * ease;
    }
  }

  // a twist: a stretch of the strand (2w points about c) turns about its length up to a (and
  // back on either side), grown in slowly; one starts now and then where the strand is free
  // and away from the other twists; never across a cut (its end stays as it is)
  function twisting(f, dt) {
    if (!f.maxSites) f.maxSites = 2 + Math.floor(trand() * (TWISTS - 1));
    if (f.sites.length < f.maxSites && trand() < dt * 0.25) {
      const c = Math.floor(trand() * M);
      if (f.att[c] <= 0 && f.sites.every((q) => Math.min(Math.abs(q.c - c), M - Math.abs(q.c - c)) > q.w * 2 + 12)) {
        const sgn = trand() < 0.5 ? -1 : 1;
        f.sites.push({ c, w: 5 + Math.floor(trand() * 8), a: sgn * Math.PI * (0.4 + trand() * 0.6), g: 0, rate: 0.6 + trand() * 0.8 });
      }
    }
    f.twist.fill(0);
    for (const q of f.sites) {
      q.g = Math.min(1, q.g + (dt / TWIST_T) * q.rate);
      const amp = q.a * q.g * q.g * (3 - 2 * q.g);
      for (const dir of [1, -1]) {
        for (let n = dir > 0 ? 0 : 1; n <= q.w * 2; n++) {
          const k = (q.c + dir * n + M) % M;
          if (dir < 0 && f.cut[k]) break; // (the segment k → k + 1, just crossed)
          const e = 1 - n / (q.w * 2), b = e * e * (3 - 2 * e); // 1 at its middle, 0 at its ends
          f.twist[k] += amp * b * (1 - f.att[k]);
          if (dir > 0 && f.cut[k]) break;
        }
      }
    }
  }

  // close against the blocks, however squashed
  function offset(f, curve, k) { return f.side * (curve.ht[k] + 0.03); }
  function link(f, i, j, rest, stiff) {
    const wi = 1 - f.att[i], wj = 1 - f.att[j], w = wi + wj;
    if (w <= 0) return;
    const dx = f.x[j] - f.x[i], dy = f.y[j] - f.y[i], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const c = ((d - rest) / d) * stiff / w;
    f.x[i] += dx * c * wi; f.y[i] += dy * c * wi;
    f.x[j] -= dx * c * wj; f.y[j] -= dy * c * wj;
  }

  return { films, step };
}
