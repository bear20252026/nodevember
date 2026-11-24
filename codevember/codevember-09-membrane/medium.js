// What lives in the medium around the cell: specks, droplets, blurred motes and tiny free
// cells (crawling, pulsing), and strands (loose fibres; small wrigglers and thin spirals that
// swim about on their own, a wave running down their bodies), each at its
// own height in it, drifting. Still 2d (plus a height), still no three.js. They take the
// medium's motion where they are: the fluid grid's (so the cell pushes them aside as it moves
// and sways, and what pours out of it sweeps them along), its slow current past the grid; and
// they are kept out of the living cell, and out of the spilt cytoplasm. They are not the
// cell's: they stay from one cell to the next, wrapping round a square about the slide's
// centre (faded out near its edge, so they never pop in or out).
import { current, inside } from './sim.js';
import { FW } from './fluid.js';

export const B = 11; // the square's half side
const FADE = 2.2; // faded out over that much of its edge
export const PKIND = { SPECK: 0, DROP: 1, MOTE: 2, CELL: 3 };
export const SKIND = { FIBRE: 0, WRIGGLER: 1, SPIRAL: 2 };

export function createMedium(rand, density = 1) {
  const R = (a, b) => a + rand() * (b - a);

  // ---- particles: specks (small, dark, some in loose clumps), droplets (pale, rimmed), motes
  // (soft, high up, out of focus), and tiny free cells (round, pulsing, crawling about on their own)
  const P = Math.round(260 * density);
  const px = new Float32Array(P), py = new Float32Array(P), pz = new Float32Array(P);
  const pkind = new Uint8Array(P), psize = new Float32Array(P), pvary = new Float32Array(P);
  const pwx = new Float32Array(P), pwy = new Float32Array(P); // its own slow wander (units per second)
  const plife = new Float32Array(P).fill(1); // faded in from 0 when put back somewhere
  for (let i = 0; i < P; i++) {
    const u = rand(), k = u < 0.6 ? 0 : u < 0.8 ? 1 : u < 0.93 ? 2 : 3;
    // a speck now and then starts beside the last one (a clump, slowly drifting apart)
    if (k === 0 && i > 0 && pkind[i - 1] === 0 && rand() < 0.55) { px[i] = px[i - 1] + R(-0.15, 0.15); py[i] = py[i - 1] + R(-0.15, 0.15); }
    else { px[i] = R(-B, B); py[i] = R(-B, B); }
    pkind[i] = k;
    pz[i] = k === 2 ? R(0.45, 0.95) : k === 3 ? R(0.05, 0.3) : R(0.02, 0.5) ** 1.3;
    psize[i] = k === 0 ? R(0.045, 0.09) : k === 1 ? R(0.06, 0.14) : k === 2 ? R(0.1, 0.22) : R(0.16, 0.26);
    pvary[i] = rand();
  }
  // the free cells crawl: a heading, wandering, and a speed that comes and goes
  const ph = Float32Array.from({ length: P }, () => rand() * 6.28), pturn = new Float32Array(P);

  // ---- strands: chains of nodes held by links and a bending stiffness. Fibres, long and
  // supple, only carried; wrigglers, short, swimming head first on a weaving course (the body
  // follows the head, so it undulates)
  const strands = [], sx = [], sy = [];
  // spirals: long and thin, lashing fast (a tight weave) as they corkscrew along
  const nf = Math.round(12 * density), nw = Math.round(12 * density), ns = Math.round(6 * density);
  for (let s = 0; s < nf + nw + ns; s++) {
    const kind = s < nf ? SKIND.FIBRE : s < nf + nw ? SKIND.WRIGGLER : SKIND.SPIRAL;
    const wr = kind !== SKIND.FIBRE, sp = kind === SKIND.SPIRAL;
    const n = sp ? 14 + Math.floor(rand() * 8) : wr ? 8 + Math.floor(rand() * 5) : 10 + Math.floor(rand() * 12);
    const seg = sp ? R(0.045, 0.06) : wr ? R(0.06, 0.08) : R(0.11, 0.15);
    let h = rand() * 6.28, x = R(-B, B), y = R(-B, B);
    const bend = wr ? 0 : R(-0.25, 0.25);
    const st = {
      kind, start: sx.length, n, seg,
      z: wr ? R(0.04, 0.35) : R(0.03, 0.6), w: sp ? R(0.03, 0.042) : wr ? R(0.07, 0.1) : R(0.025, 0.05), v: rand(),
      heading: h, speed: sp ? R(0.3, 0.45) : R(0.18, 0.32), weave: sp ? R(0.9, 1.2) : R(0.5, 0.9),
      freq: sp ? R(6, 9) : R(1.6, 2.6), ph: rand() * 6.28,
      turn: 0, life: 1, dart: 0, beat: 0, // a wriggler's dart: a burst of speed, now and then
      crust: false, // a fibre crusted over with grains of debris (thicker, rougher)
    };
    if (kind === SKIND.FIBRE && rand() < 0.45) { st.crust = true; st.w = R(0.07, 0.12); }
    for (let i = 0; i < n; i++) {
      sx.push(x); sy.push(y);
      h += bend + (wr ? 0 : (rand() - 0.5) * 0.5);
      x -= Math.cos(h) * seg; y -= Math.sin(h) * seg; // laid out behind its head
    }
    strands.push(st);
  }
  const NN = sx.length;

  // ---- flocs: debris lying low in the medium, drifting heavily, turning slowly (drawn as flat
  // quads on the slide), of four kinds: 0 clumps, grainy and porous (a few huge, clotted dark
  // in the middle); 1 ghosts, pale frothy clumps, barely there; 2 cysts, clear ovals full of
  // fine grains, on a thin stalk; 3 eggs, thick dark-walled ovals
  const counts = [26, 9, 5, 4].map((c) => Math.round(c * density));
  const F = counts.reduce((a, c) => a + c, 0);
  const fx = new Float32Array(F), fy = new Float32Array(F), fz = new Float32Array(F), fsize = new Float32Array(F);
  const frot = new Float32Array(F), fspin = new Float32Array(F), fseed = new Float32Array(F), flife = new Float32Array(F).fill(1);
  const fkind = new Uint8Array(F);
  for (let i = 0, k = 0, c = 0; i < F; i++, c++) {
    while (c >= counts[k]) { k++; c = 0; }
    fkind[i] = k;
    fx[i] = R(-B, B); fy[i] = R(-B, B); fz[i] = R(0.02, 0.25);
    // across (world)
    fsize[i] = k === 0 ? (rand() < 0.12 ? R(2.8, 3.8) : rand() < 0.3 ? R(1.5, 2.6) : R(0.4, 1.0))
      : k === 1 ? R(0.9, 2.0) : k === 2 ? R(0.9, 1.3) : R(0.5, 0.75);
    frot[i] = rand() * 6.28; fspin[i] = R(-0.06, 0.06) / (k === 0 ? 1 : 0.6); fseed[i] = rand() * 100;
  }

  const nx = Float32Array.from(sx), ny = Float32Array.from(sy);
  const npx = Float32Array.from(sx), npy = Float32Array.from(sy);
  const nstrand = new Uint16Array(NN);
  strands.forEach((s, k) => nstrand.fill(k, s.start, s.start + s.n));

  // the medium's motion at (x, y), units per second: the fluid's, on its grid (blended
  // into the bare current towards the grid's edge, and past it)
  const cur = [0, 0];
  function flow(sim, x, y, out) {
    current(x, y, sim.time, cur);
    const e = Math.max(Math.abs(x), Math.abs(y));
    const g = e > FW - 0.4 ? 0 : e < FW - 1.6 ? 1 : (FW - 0.4 - e) / 1.2;
    if (g > 0) {
      const f = sim.fluid;
      out[0] = cur[0] + (f.velU(x, y) - cur[0]) * g;
      out[1] = cur[1] + (f.velV(x, y) - cur[1]) * g;
    } else { out[0] = cur[0]; out[1] = cur[1]; }
    return out;
  }

  // ---- kept clear of the cell: the living ring (with a margin), or the spilt cytoplasm
  const ring = { x0: 0, y0: 0, x1: 0, y1: 0 };
  function bounds(sim) {
    const { mx, my } = sim;
    ring.x0 = ring.y0 = Infinity; ring.x1 = ring.y1 = -Infinity;
    for (let i = 0; i < mx.length; i++) {
      ring.x0 = Math.min(ring.x0, mx[i]); ring.x1 = Math.max(ring.x1, mx[i]);
      ring.y0 = Math.min(ring.y0, my[i]); ring.y1 = Math.max(ring.y1, my[i]);
    }
  }
  const out = [0, 0];
  // its shift out of the cell into out (0 if it is clear of it); reach: its own half size
  function clear(sim, x, y, reach) {
    out[0] = out[1] = 0;
    if (sim.dying < 0) {
      const m = sim.RW + 0.12 + reach;
      if (x < ring.x0 - m || x > ring.x1 + m || y < ring.y0 - m || y > ring.y1 + m) return 0;
      const { mx, my } = sim, N = mx.length;
      let bd = Infinity, bx = 0, by = 0;
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, ex = mx[j] - mx[i], ey = my[j] - my[i];
        const t = Math.max(0, Math.min(1, ((x - mx[i]) * ex + (y - my[i]) * ey) / (ex * ex + ey * ey || 1)));
        const cx = mx[i] + ex * t, cy = my[i] + ey * t, d = Math.hypot(x - cx, y - cy);
        if (d < bd) { bd = d; bx = cx; by = cy; }
      }
      const inn = inside(mx, my, x, y);
      if (!inn && bd >= m) return 0;
      // out along the way to the ring (through it, if inside)
      let ux = (x - bx) / (bd || 1), uy = (y - by) / (bd || 1);
      if (inn) { ux = -ux; uy = -uy; }
      out[0] = bx + ux * m - x; out[1] = by + uy * m - y;
      return 1;
    }
    // dead: off the spilt fluid, down its slope (gently: it sweeps them)
    const f = sim.fluid, e = f.HC * 1.5;
    const c = f.dye(x, y);
    if (c < 0.25 || Math.max(Math.abs(x), Math.abs(y)) > FW - 0.5) return 0;
    const gx = f.dye(x + e, y) - f.dye(x - e, y), gy = f.dye(x, y + e) - f.dye(x, y - e), gl = Math.hypot(gx, gy);
    if (gl < 1e-3) return 0;
    const s = Math.min(c - 0.25, 0.5) * 0.04;
    out[0] = (-gx / gl) * s; out[1] = (-gy / gl) * s;
    return 1;
  }

  // somewhere new, clear of the cell (it fades in there)
  function respawn(sim, set) {
    for (let k = 0; k < 40; k++) {
      const x = R(-B, B), y = R(-B, B);
      if (!clear(sim, x, y, 0.1) && Math.hypot(x - (ring.x0 + ring.x1) / 2, y - (ring.y0 + ring.y1) / 2) > 2) { set(x, y); return; }
    }
  }

  const wrapC = (v) => (v > B ? v - 2 * B : v < -B ? v + 2 * B : v);
  const f = [0, 0];
  function step(dt, sim) {
    bounds(sim);
    const t = sim.time;
    // ---- particles
    for (let i = 0; i < P; i++) {
      flow(sim, px[i], py[i], f);
      // higher up, a little faster (less held back by the slide); each its own wander
      const lift = 0.8 + pz[i] * 0.6;
      const k = pkind[i], jit = k === 0 ? 0.09 : k === 1 ? 0.04 : 0.02; // brownian, the small ones the most
      pwx[i] += -pwx[i] * 0.5 * dt + (rand() - 0.5) * 0.3 * Math.sqrt(dt);
      pwy[i] += -pwy[i] * 0.5 * dt + (rand() - 0.5) * 0.3 * Math.sqrt(dt);
      px[i] += (f[0] * lift + pwx[i]) * dt + (rand() - 0.5) * jit * Math.sqrt(dt) * 0.3;
      py[i] += (f[1] * lift + pwy[i]) * dt + (rand() - 0.5) * jit * Math.sqrt(dt) * 0.3;
      if (clear(sim, px[i], py[i], psize[i] * 0.5)) {
        // far into it (a new cell born over it): put elsewhere
        if (Math.hypot(out[0], out[1]) > 0.5) respawn(sim, (x, y) => { px[i] = x; py[i] = y; plife[i] = 0; });
        else { px[i] += out[0]; py[i] += out[1]; }
      }
      px[i] = wrapC(px[i]); py[i] = wrapC(py[i]);
      if (k === 3) {
        // a free cell crawls on, in fits and starts (its speed swelling and ebbing with its pulse)
        pturn[i] += ((rand() - 0.5) * 3 - pturn[i] * 0.8) * dt;
        ph[i] += pturn[i] * dt;
        const go = 0.06 * (0.4 + 0.6 * Math.max(0, Math.sin(t * (0.7 + pvary[i] * 0.6) + pvary[i] * 20)));
        px[i] += Math.cos(ph[i]) * go * dt; py[i] += Math.sin(ph[i]) * go * dt;
      }
      plife[i] = Math.min(1, plife[i] + dt * 0.4);
    }
    // ---- flocs: heavy, they lag behind the flow (the bigger, the more)
    for (let i = 0; i < F; i++) {
      flow(sim, fx[i], fy[i], f);
      const lag = 0.85 / (1 + fsize[i] * 0.4);
      fx[i] += f[0] * lag * dt; fy[i] += f[1] * lag * dt;
      frot[i] += fspin[i] * dt;
      if (clear(sim, fx[i], fy[i], fsize[i] * 0.35)) {
        if (Math.hypot(out[0], out[1]) > 0.8) respawn(sim, (x, y) => { fx[i] = x; fy[i] = y; flife[i] = 0; });
        else { fx[i] += out[0]; fy[i] += out[1]; }
      }
      fx[i] = wrapC(fx[i]); fy[i] = wrapC(fy[i]);
      flife[i] = Math.min(1, flife[i] + dt * 0.3);
    }
    // ---- strands
    for (const s of strands) {
      const e = s.start + s.n;
      const lift = 0.8 + s.z * 0.6;
      for (let i = s.start; i < e; i++) {
        flow(sim, nx[i], ny[i], f);
        // verlet, its own motion damped hard by the medium, towards the flow's
        let vx = (nx[i] - npx[i]) * 0.86, vy = (ny[i] - npy[i]) * 0.86;
        vx += (f[0] * lift * dt - vx) * 0.25; vy += (f[1] * lift * dt - vy) * 0.25;
        npx[i] = nx[i]; npy[i] = ny[i];
        nx[i] += vx; ny[i] += vy;
      }
      if (s.kind !== SKIND.FIBRE) {
        // the head swims on a weaving course, its heading wandering (now and then it turns about);
        // a wriggler darts off now and then, a burst of speed dying away
        s.turn += ((rand() - 0.5) * 2.4 - s.turn * 0.6) * dt;
        s.heading += s.turn * dt;
        if (s.kind === SKIND.WRIGGLER && rand() < dt / 7) { s.dart = 1; s.heading += (rand() - 0.5) * 1.5; }
        s.dart *= Math.exp(-dt * 1.5);
        s.beat += s.freq * (1 + s.dart) * dt;
        const h = s.heading + 0.25 * s.weave * Math.sin(s.beat + s.ph);
        const v = s.speed * (1 + s.dart * 3);
        nx[s.start] += Math.cos(h) * v * dt;
        ny[s.start] += Math.sin(h) * v * dt;
      }
      // links, and bending (fibres stiffer than wrigglers)
      const bk = s.kind === SKIND.FIBRE ? 0.08 : 0.02;
      for (let it = 0; it < 3; it++) {
        for (let i = s.start; i < e - 1; i++) {
          const pin = s.kind !== SKIND.FIBRE && i === s.start;
          link(i, i + 1, s.seg, 1, pin);
        }
        for (let i = s.start; i < e - 2; i++) link(i, i + 2, s.seg * 1.96, bk, false);
      }
      // a swimmer's body bends in a wave running from its head to its tail: each next node
      // drawn towards the heading its link should have, turned from the last one's
      if (s.kind !== SKIND.FIBRE) {
        const sp = s.kind === SKIND.SPIRAL, per = sp ? 6 : 9; // nodes per wave
        const amp = (sp ? 0.75 : 0.42) * s.weave;
        for (let i = s.start + 1; i < e - 1; i++) {
          const a = Math.atan2(ny[i] - ny[i - 1], nx[i] - nx[i - 1]);
          const turn = amp * (Math.sin(-s.beat - s.ph + ((i - s.start) * 6.2832) / per) - Math.sin(-s.beat - s.ph + ((i - 1 - s.start) * 6.2832) / per));
          const tx = nx[i] + Math.cos(a + turn) * s.seg, ty = ny[i] + Math.sin(a + turn) * s.seg;
          nx[i + 1] += (tx - nx[i + 1]) * 0.5; ny[i + 1] += (ty - ny[i + 1]) * 0.5;
        }
      }
      // clear of the cell: a wriggler that bumps into it turns away
      let hit = false;
      for (let i = s.start; i < e; i++) {
        if (!clear(sim, nx[i], ny[i], s.w * 0.5)) continue;
        if (Math.hypot(out[0], out[1]) > 0.5) { hit = 2; break; }
        nx[i] += out[0]; ny[i] += out[1]; npx[i] += out[0] * 0.5; npy[i] += out[1] * 0.5;
        hit = hit || 1;
      }
      if (hit === 2) {
        // a new cell born over it: elsewhere
        respawn(sim, (x, y) => {
          const dx = x - nx[s.start], dy = y - ny[s.start];
          for (let i = s.start; i < e; i++) { nx[i] += dx; ny[i] += dy; npx[i] = nx[i]; npy[i] = ny[i]; }
          s.life = 0;
        });
      } else if (hit && s.kind !== SKIND.FIBRE) s.turn += (rand() < 0.5 ? -1 : 1) * 3 * dt * 10;
      // wrapped round as a whole, by its head
      const ox = wrapC(nx[s.start]) - nx[s.start], oy = wrapC(ny[s.start]) - ny[s.start];
      if (ox || oy) for (let i = s.start; i < e; i++) { nx[i] += ox; ny[i] += oy; npx[i] += ox; npy[i] += oy; }
      s.life = Math.min(1, s.life + dt * 0.4);
    }
  }
  function link(i, j, r, k, pinI) {
    const dx = nx[j] - nx[i], dy = ny[j] - ny[i], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const c = ((d - r) / d) * k;
    if (pinI) { nx[j] -= dx * c; ny[j] -= dy * c; return; }
    nx[i] += dx * c * 0.5; ny[i] += dy * c * 0.5;
    nx[j] -= dx * c * 0.5; ny[j] -= dy * c * 0.5;
  }

  // how visible it is at (x, y): faded out near the square's edge
  const edge = (x, y) => {
    const d = B - Math.max(Math.abs(x), Math.abs(y));
    return d >= FADE ? 1 : d <= 0 ? 0 : (d / FADE) * (d / FADE) * (3 - (2 * d) / FADE);
  };

  return { P, px, py, pz, pkind, psize, pvary, plife, F, fx, fy, fz, fsize, frot, fseed, flife, fkind, strands, NN, nx, ny, nstrand, step, edge };
}
