// The cell's hairs: fine strands standing out of its outer film, all round it, in 2d (no
// three.js here, so it runs in node too). Each is a short chain of points rooted on the outer
// film itself (films.js: on one of its points, or between two), just outside it, standing out
// along its normal. Alive, each beats on its own, slowly (a stroke and a bend running out along it), the
// beats travelling round the cell in waves (metachronal), and it is dragged by the medium: it
// trails behind when the cell moves. They grow in tufts and bare patches, mostly short, a few
// long, lazy ones. Torn, they stop beating and go limp, drooping and swaying in the currents,
// lying down on the slide, clumping in small bunches (as wet hairs do), and many of them
// shed; still rooted on the film: where it peels off and floats away in ribbons, they go with it.
import { N, current, rng } from './sim.js';
import { S, M } from './films.js';

export const HP = 8; // a hair's points (root included)
const DRAG = 0.08; // how much of a point's own motion the medium takes away each frame (towards its current)

export function createHairs(sim, film, density = 1) {
  const rand = rng(sim.seed * 17 + 9);
  // where they grow round the ring: a few tufts, thicker, longer, and bare stretches between
  const lumps = [...Array(3)].map((_, n) => ({ f: n + 2 + Math.floor(rand() * 2), p: rand() * 6.28, a: 0.5 / (n + 1) }));
  const grow = (u) => lumps.reduce((s, l) => s + l.a * Math.sin(u * 6.2832 * l.f + l.p), 0.55);
  const want = Math.round(340 * density);
  const hairs = [];
  for (let tries = 0; hairs.length < want && tries < want * 20; tries++) {
    const u = rand(), g = grow(u);
    if (rand() > Math.max(0.08, Math.min(1, g))) continue;
    const long = rand() < 0.07;
    const len = long ? 1.0 + rand() * 0.7 : (0.35 + rand() * 0.3) * (0.7 + 0.6 * Math.max(0, Math.min(1, g)));
    hairs.push({
      at: u * M, // its root on the curve (fractional point)
      len, long,
      w: (long ? 0.034 : 0.028) * (0.8 + rand() * 0.4), // its width at the root
      tilt: (rand() - 0.5) * 0.9, // leaning off the normal, each its own way
      amp: (long ? 0.25 : 0.45) * (0.7 + rand() * 0.6), // how far it beats
      rate: (long ? 0.5 : 1) * (1.6 + rand() * 0.6), // radians per second
      ph: rand() * 0.8, // off the wave a little
      curl: (rand() - 0.5) * 0.12, // its own bend at rest (per joint)
      // how high up the film it comes out (of its half height above the slide): all over its
      // wall, more of them up towards its rim
      zf: 1.05 - 0.9 * rand() ** 1.6,
      // out of the plane: each rising or sinking its own way as it leaves the film (radians),
      // sagging along it, and beating up and down a little too
      elev: -0.4 + rand() * 1.1, sag: 0.2 + rand() * 0.8, zamp: 0.1 + rand() * 0.3,
      v: rand(),
    });
  }
  hairs.sort((a, b) => a.at - b.at);
  const H = hairs.length;
  // dead, they clump as wet hairs do: neighbours along the film in small bunches (a few to
  // half a dozen), each its own
  const clump = new Uint16Array(H);
  let C = 0;
  for (let k = 0; k < H; k++) { if (k > 0 && rand() < 0.28) C++; clump[k] = C; }
  C++;
  const kx = new Float32Array(C * HP), ky = new Float32Array(C * HP), kn = new Float32Array(C);
  const krx = new Float32Array(C), kry = new Float32Array(C);
  const x = new Float32Array(H * HP), y = new Float32Array(H * HP), px = new Float32Array(H * HP), py = new Float32Array(H * HP);
  const el = new Float32Array(H); // each hair's elevation where it leaves the film, this frame
  const rx = new Float32Array(H), ry = new Float32Array(H), rz = new Float32Array(H), nx = new Float32Array(H), ny = new Float32Array(H);
  let born = false;
  const cur = [0, 0];

  // its root and its outward normal, on the outer film (eased between two of its points, not
  // across a cut), just outside it; the normal from the film's own tangent there, so it
  // follows the film when it peels off and twists about
  function root(h, k) {
    const { x: fx, y: fy, cut } = film;
    const a = Math.floor(h.at) % M, b = (a + 1) % M, t = cut[a] ? 0 : h.at - Math.floor(h.at);
    const p = (a - 1 + M) % M, q = (b + 1) % M;
    // the tangent over a point on each side, or only this side of a cut
    const i0 = cut[p] ? a : p, i1 = cut[a] ? a : cut[b] ? b : q;
    const tx = fx[i1] - fx[i0], ty = fy[i1] - fy[i0], l = Math.hypot(tx, ty) || 1;
    nx[k] = ty / l; ny[k] = -tx / l; // outward (the ring turns ccw)
    rx[k] = fx[a] + (fx[b] - fx[a]) * t + nx[k] * 0.01;
    ry[k] = fy[a] + (fy[b] - fy[a]) * t + ny[k] * 0.01;
    rz[k] = (film.h[a] + (film.h[b] - film.h[a]) * t) * h.zf;
  }

  // dt: the frame's (0 when paused); curve: ringCurve's (for the blocks' thickness), after
  // the films have stepped
  function step(dt, curve) {
    for (let k = 0; k < H; k++) root(hairs[k], k);
    if (!born) {
      for (let k = 0; k < H; k++) {
        const h = hairs[k], l = h.len / (HP - 1);
        for (let j = 0; j < HP; j++) {
          const i = k * HP + j;
          x[i] = px[i] = rx[k] + nx[k] * l * j; y[i] = py[i] = ry[k] + ny[k] * l * j;
        }
      }
      born = true;
    }
    if (dt <= 0) return;
    const dying = sim.dying, t = sim.time;
    // torn: the beat dies down within a few seconds, and they go limp a little slower
    const beat = dying < 0 ? 1 : Math.max(0, 1 - dying / 4);
    // (and once limp, they lose what shape they had left: lying any way on the slide)
    const stiff = dying < 0 ? 1 : 0.08 * Math.max(0, 1 - dying / 20) + 0.92 * Math.max(0, 1 - dying / 10);
    // how hard each is drawn into its bunch
    const bunch = dying < 0 ? 0 : 0.05 * Math.min(1, dying / 8);
    const { mx, my } = sim;

    for (let k = 0; k < H; k++) {
      const h = hairs[k], l = h.len / (HP - 1), o = k * HP;
      // the medium's drag: each point keeps some of its own motion, the rest towards the current
      for (let j = 1; j < HP; j++) {
        const i = o + j;
        current(x[i], y[i], t, cur);
        let vx = (x[i] - px[i]) * 0.97, vy = (y[i] - py[i]) * 0.97;
        vx += (cur[0] * dt - vx) * DRAG; vy += (cur[1] * dt - vy) * DRAG;
        px[i] = x[i]; py[i] = y[i];
        x[i] += vx; y[i] += vy;
      }
      x[o] = px[o] = rx[k]; y[o] = py[o] = ry[k];
      // its shape: a stroke at the root, and a bend running out along it, the beat's phase
      // travelling round the ring
      const phase = h.rate * t - (h.at / M) * 6.2832 * 3 + h.ph;
      const a0 = h.tilt + beat * h.amp * (Math.sin(phase) + 0.35 * Math.sin(2 * phase));
      // its elevation: its own, beating up and down a little (a quarter turn off the stroke, so
      // the tip sweeps a loop); limp, it sinks towards the slide
      const limp = 1 - stiff;
      el[k] = (h.elev + beat * h.zamp * Math.sin(phase + 1.57)) * (1 - limp) - 0.35 * limp;
      for (let it = 0; it < 2; it++) {
        let dx = nx[k], dy = ny[k], ang = a0;
        for (let j = 1; j < HP; j++) {
          const i = o + j, p = i - 1;
          if (j > 1) {
            const ex = x[p] - x[p - 1], ey = y[p] - y[p - 1], el = Math.hypot(ex, ey) || 1;
            dx = ex / el; dy = ey / el;
            ang = h.curl + beat * h.amp * 0.35 * Math.sin(phase - j * 0.7);
          }
          // held to its shape, firmly at the root, more loosely out along it
          const c = Math.cos(ang), s = Math.sin(ang);
          const tx = x[p] + (dx * c - dy * s) * l, ty = y[p] + (dx * s + dy * c) * l;
          // (the root not quite rigid: it gives a little, so the hair bends out of the film, not off a hinge)
          const w = stiff * (j === 1 ? 0.55 : j === 2 ? 0.45 : 0.35 * (1 - (j / HP) * 0.5));
          x[i] += (tx - x[i]) * w; y[i] += (ty - y[i]) * w;
          // it doesn't stretch
          const qx = x[i] - x[p], qy = y[i] - y[p], q = Math.hypot(qx, qy) || 1;
          x[i] = x[p] + (qx / q) * l; y[i] = y[p] + (qy / q) * l;
        }
      }
    }
    // dead: drawn into their bunches, more towards the tips (the roots stay where the film is)
    if (bunch > 0) {
      kx.fill(0); ky.fill(0); kn.fill(0); krx.fill(0); kry.fill(0);
      for (let k = 0; k < H; k++) {
        const c = clump[k], o = k * HP;
        kn[c]++; krx[c] += rx[k]; kry[c] += ry[k];
        for (let j = 1; j < HP; j++) { kx[c * HP + j] += x[o + j]; ky[c * HP + j] += y[o + j]; }
      }
      for (let k = 0; k < H; k++) {
        const c = clump[k], o = k * HP, n = kn[c];
        // (not across a cut: a bunch the film has torn apart is two)
        if (n < 2 || Math.hypot(rx[k] - krx[c] / n, ry[k] - kry[c] / n) > 0.35) continue;
        for (let j = 2; j < HP; j++) {
          const w = bunch * (j / (HP - 1)), i = o + j;
          x[i] += (kx[c * HP + j] / n - x[i]) * w; y[i] += (ky[c * HP + j] / n - y[i]) * w;
        }
      }
    }
    for (let k = 0; k < H; k++) {
      const o = k * HP;
      // it doesn't pass into the blocks (theirs, nor the others'), across their width
      for (let j = 2; j < HP; j++) {
        const i = o + j;
        for (let b = 0; b < N; b++) {
          const r = curve.ht[b * S] + 0.05;
          const dx = x[i] - mx[b], dy = y[i] - my[b], d2 = dx * dx + dy * dy;
          if (d2 >= r * r || d2 < 1e-12) continue;
          const d = Math.sqrt(d2), p = (r - d) / d;
          x[i] += dx * p; y[i] += dy * p;
        }
      }
    }
  }

  return { hairs, H, x, y, rz, el, step };
}
