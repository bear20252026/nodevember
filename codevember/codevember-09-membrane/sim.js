// The life form's slice, all in 2d (the plane z = 0); no three.js here, so it runs in node too.
//
// The membrane is a closed chain of blocks: nodes (one per block) held to their neighbours
// by links a little shorter than their spacing (the chain is under tension), stiffened by
// links skipping one node (bending). Each node is also a disc the fluid can't cross: the
// discs overlap along the chain, so nothing leaks until a link breaks and the two ends
// pull apart.
//
// The fluid is a continuum on a grid (fluid.js: stable fluids, made incompressible by a
// pressure projection), the cytoplasm inside and the medium outside one flow, told apart by
// a dye. The membrane's discs and the nucleus are walls in it, moving the fluid as they
// move (the fluid doesn't push back: the living membrane holds its own area, and the dead
// one, shrinking, squeezes the cytoplasm out). Thick (a strong viscosity), the
// living cytoplasm streams slowly round the cell in two drifting eddies. Torn, it swells
// (a source in the projection), so it pours out through the tear — and slowly, for the
// medium holds it back.
//
// All of it lies in a medium, thick and invisible (the tissue's fluid around the cell): it
// drags on everything outside the membrane and drifts in slow, swirling currents. The
// living cell sways in it; what pours out through a tear creeps out into it, heavily, and
// the remains keep drifting in it after death.
//
// The content: a nucleus (a wall in the flow) and a few vesicles, carried by the fluid;
// and, carried along with it, the cell's inclusions (inclusions.js): filaments,
// mitochondria, the reticulum's cisternae, granules.
import { createFluid } from './fluid.js';
import { createInclusions } from './inclusions.js';

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const R = 3; // the cell's radius
export const N = 80; // blocks in the membrane
export const T = 0.3; // the blocks' thickness (across the membrane)
const RW = 0.17; // a membrane node's disc
// the medium: how much of a body's own motion it takes away each substep (towards its
// current's), and the current's speed (units per second) and size
const DRAG_MEM = 0.03;
const FLOW = 0.07, FLOW_SCALE = 0.45;
// torn, how fast a loose block wanders off on its own (units per second)
const ROAM = 0.25;
// the fluid: how fast the medium takes its current back (per step), the living
// cytoplasm's streaming (how fast it follows it, per step; its speed, units per second),
// and its viscosity
const MEDIUM = 0.12, STREAM = 0.04, STREAM_SPEED = 0.45, VISC = 0.5;
// spilt, how fast the cytoplasm creeps out along the medium's grain (per step, in cells²)
const CREEP = 0.06;
// torn, how fast the cytoplasm pours out through the tear (units per second) and how
// strongly it is drawn that way (per step)
const POUR = 0.32, POUR_K = 0.04;
// how readily the membrane gives way to the fluid's pressure on it (each substep)
let PUSH = +(globalThis.PUSH_TEST ?? 0.003), EASE = +(globalThis.EASE_TEST ?? 0.1);

// the medium's current at (x, y) and time t, in units per second: divergence-free (the curl
// of a stream function), two slowly drifting layers of large eddies
export function current(x, y, t, out = [0, 0]) {
  const k1 = FLOW_SCALE, k2 = FLOW_SCALE * 1.9;
  const a1 = k1 * x + 0.05 * t, b1 = k1 * y - 0.037 * t + 1.3;
  const a2 = k2 * (0.8 * x - 0.6 * y) - 0.031 * t + 4.1, b2 = k2 * (0.6 * x + 0.8 * y) + 0.043 * t;
  // psi = sin a1 · cos b1 / k1 + 0.5 · sin a2 · sin b2 / k2  →  u = dpsi/dy, v = -dpsi/dx
  const s1 = Math.sin(a1), c1 = Math.cos(a1), s1b = Math.sin(b1), c1b = Math.cos(b1);
  const s2 = Math.sin(a2), c2 = Math.cos(a2), s2b = Math.sin(b2), c2b = Math.cos(b2);
  const d2x = 0.5 * (c2 * s2b * 0.8 + s2 * c2b * 0.6), d2y = 0.5 * (-c2 * s2b * 0.6 + s2 * c2b * 0.8);
  out[0] = FLOW * (-s1 * s1b + d2y);
  out[1] = -FLOW * (c1 * c1b + d2x);
  return out;
}

// cyclosis: the living cytoplasm streams round the cell, in two slow eddies that drift,
// turning opposite ways, and a finer swirl over them (units per second)
function streaming(x, y, t, out) {
  const ex = Math.cos(t * 0.11) * 1.2, ey = Math.sin(t * 0.11) * 1.2;
  let sx = 0, sy = 0;
  for (let sgn = -1; sgn <= 1; sgn += 2) {
    const rx = x - ex * sgn, ry = y - ey * sgn;
    const f = sgn * STREAM_SPEED * Math.exp(-(rx * rx + ry * ry) / 3);
    sx -= ry * f; sy += rx * f;
  }
  // psi = B sin(a) cos(b)
  const a = 1.3 * x + 0.21 * t, b = 1.1 * y - 0.17 * t + 2, B = 0.07;
  sx += -B * 1.1 * Math.sin(a) * Math.sin(b);
  sy -= B * 1.3 * Math.cos(a) * Math.cos(b);
  out[0] = sx; out[1] = sy;
  return out;
}

export function createSim(seed) {
  const rand = rng(seed);

  // ---- membrane
  const mx = new Float32Array(N), my = new Float32Array(N);
  const mpx = new Float32Array(N), mpy = new Float32Array(N);
  const mvx = new Float32Array(N), mvy = new Float32Array(N); // over the last step, units per second
  const m0x = new Float32Array(N), m0y = new Float32Array(N);
  // the membrane is longer than the circle its fluid would fill: slack, it can't be
  // pressed round, so it takes any shape its content and the hand give it; its links are
  // at rest where they are born, and bending only smooths kinks (it prefers no curve)
  const linkRest = new Float32Array(N); // link i: node i → i+1
  const linkOn = new Uint8Array(N).fill(1);
  const bendRest = new Float32Array(N);
  {
    // a lobed outline, the blocks spaced evenly along it
    const ph = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
    const M = 2048, cx = [], cy = [], cl = [0];
    for (let k = 0; k <= M; k++) {
      const a = (k / M) * Math.PI * 2;
      const r = R * (1 + 0.13 * Math.sin(2 * a + ph[0]) + 0.07 * Math.sin(3 * a + ph[1]) + 0.04 * Math.sin(5 * a + ph[2]));
      cx.push(Math.cos(a) * r); cy.push(Math.sin(a) * r);
      if (k) cl.push(cl[k - 1] + Math.hypot(cx[k] - cx[k - 1], cy[k] - cy[k - 1]));
    }
    for (let i = 0, k = 0; i < N; i++) {
      const want = (i / N) * cl[M];
      while (cl[k + 1] < want) k++;
      const f = (want - cl[k]) / (cl[k + 1] - cl[k]);
      mx[i] = mpx[i] = cx[k] + (cx[k + 1] - cx[k]) * f;
      my[i] = mpy[i] = cy[k] + (cy[k + 1] - cy[k]) * f;
    }
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    linkRest[i] = Math.hypot(mx[j] - mx[i], my[j] - my[i]);
  }
  for (let i = 0; i < N; i++) bendRest[i] = linkRest[i] + linkRest[(i + 1) % N];
  const area0 = polyArea(mx, my);
  // the slow, wandering drive of a living cell: lobes pushed out and drawn in along the
  // membrane, travelling round it (the amoeba's way of changing shape)
  const lobes = [2, 3, 4, 5].map((k) => ({ k, w: (rand() - 0.5) * 0.5, ph: rand() * 6.28, a: 1 / k }));
  // once torn, each block wanders off on a slow course of its own (a heading that turns
  // slowly, a speed), on top of what carries it (its own random stream: the cell is unchanged)
  const roam = [];
  {
    const r2 = rng(seed * 7 + 3);
    for (let i = 0; i < N; i++) roam.push({ ph: r2() * 6.28, w: (r2() - 0.5) * 0.5, w2: 0.2 + r2() * 0.3, v: 0.5 + r2() * 0.5 });
  }

  // ---- content (placeholder): a nucleus (a wall in the flow) and vesicles (carried by it)
  const bodies = [];
  bodies.push({ kind: 'nucleus', r: 0.85, m: 25, solid: true });
  const nv = 9 + Math.floor(rand() * 5);
  for (let i = 0; i < nv; i++) bodies.push({ kind: 'vesicle', r: 0.14 + rand() * 0.16, m: 2 });
  {
    const a = rand() * 6.28;
    const placed = [];
    for (const b of bodies) {
      for (let k = 0; k < 200; k++) {
        const rr = b.kind === 'nucleus' ? rand() * 0.4 : Math.sqrt(rand()) * (R * 0.75 - 0.5 - b.r);
        const aa = b.kind === 'nucleus' ? a : rand() * 6.28;
        b.x = Math.cos(aa) * rr; b.y = Math.sin(aa) * rr;
        if (placed.every((o) => Math.hypot(o.x - b.x, o.y - b.y) > o.r + b.r + 0.1)) break;
      }
      b.px = b.x; b.py = b.y; b.angle = rand() * 6.28;
      b.vx = b.vy = 0; // over the last step, units per second
      b.out = false; // has left the cell
      placed.push(b);
    }
  }

  // ---- fluid: the cytoplasm fills the ring
  const fluid = createFluid(seed);
  const { G, X, HC, u, v, c, solid, inCell, src } = fluid;
  const mem = { mx, my, vx: mvx, vy: mvy, linkOn, N, RW };
  fluid.rasterize(mem, bodies);
  for (let k = 0; k < G * G; k++) c[k] = inCell[k] ? 1 : 0;
  fluid.fillWalls(false);
  // the medium's current and the cytoplasm's streaming, at the cells' centres: they change
  // slowly, so they are worked out now and then
  const curX = new Float32Array(G * G), curY = new Float32Array(G * G);
  const strX = new Float32Array(G * G), strY = new Float32Array(G * G);
  let fieldsAt = -1;
  // (the streaming goes round the cell's centre, wherever the cell has gone)
  function updateFields(t, ox = 0, oy = 0) {
    const o = [0, 0];
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i, x = X(i), y = X(j);
      current(x, y, t, o); curX[k] = o[0]; curY[k] = o[1];
      const rx = x - ox, ry = y - oy;
      if (rx * rx + ry * ry < 64) { streaming(rx, ry, t, o); strX[k] = o[0]; strY[k] = o[1]; } else strX[k] = strY[k] = 0;
    }
    fieldsAt = t;
  }
  updateFields(0);
  // the medium already in motion
  for (let j = 0; j < G; j++) for (let i = 1; i < G; i++) { const a = j * G + i - 1; if (!inCell[a]) u[j * (G + 1) + i] = (curX[a] + curX[a + 1]) / 2; }
  for (let j = 1; j < G; j++) for (let i = 0; i < G; i++) { const a = (j - 1) * G + i; if (!inCell[a]) v[j * G + i] = (curY[a] + curY[a + G]) / 2; }

  const cell0 = new Uint8Array(G * G); // the cell's inside when it tore
  const frame = { x: 0, y: 0, vx: 0, vy: 0 }; // the cell's centre and its velocity
  const push = new Float32Array(N), raw = new Float32Array(N); // the fluid's pressure on each node, outwards
  const state = {
    seed, N, R, T, RW,
    L: linkRest.reduce((a, b) => a + b) / N, // the blocks' spacing along the membrane
    mx, my, linkOn, bodies, fluid,
    time: 0, // seconds
    dying: -1, // seconds since the tear, -1 alive
    tearAt: -1,
    leaked: 0, // the cytoplasm's fraction out of the cell
    drive: 1, // how much the living cell moves on its own
    grabbed: () => !!grab,
  };

  function tear(at) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < N; i++) {
      if (!linkOn[i]) continue;
      const j = (i + 1) % N;
      const d = Math.hypot((mx[i] + mx[j]) / 2 - at[0], (my[i] + my[j]) / 2 - at[1]);
      if (d < bd) { bd = d; best = i; }
    }
    if (bd > 1.2) return false;
    linkOn[best] = 0;
    linkOn[(best + 1) % N] = rand() < 0.5 ? 0 : linkOn[(best + 1) % N]; // a ragged tear, two links at times
    if (state.dying < 0) { state.dying = 0; state.tearAt = best; cell0.set(inCell); }
    return true;
  }

  // ---- the hand: a grabbed part (membrane, content, all within reach of the point, the
  // nearest held hardest) is carried rigidly with the pointer, and the fluid under it is
  // swept along with it; the rest follows through the links and the fluid, so the cell
  // stretches and distorts
  let grab = null;
  const REACH = 0.85;
  function grabAt(at) {
    const [gx, gy] = at;
    const ring = nearRing(mx, my, gx, gy), within = inside(mx, my, gx, gy);
    // near the membrane, inside the cell, or among the loose blocks and the spilt fluid
    let near = ring < 0.6 || within;
    const nodes = [], held = [];
    const w = (dd) => { const t = Math.max(0, 1 - dd / REACH); return t * t * (3 - 2 * t); };
    for (let i = 0; i < N; i++) {
      const dd = Math.hypot(mx[i] - gx, my[i] - gy);
      if (dd < REACH) nodes.push([i, mx[i] - gx, my[i] - gy, w(dd)]);
    }
    for (const b of bodies) {
      const dd = Math.hypot(b.x - gx, b.y - gy);
      if (dd < b.r + 0.1) { held.push([b, b.x - gx, b.y - gy, 1]); near = true; }
      else if (dd < b.r + REACH * 0.5) held.push([b, b.x - gx, b.y - gy, 0.5 * w((dd - b.r) / 0.5)]);
    }
    if (!near && nodes.length < 6 && fluid.dye(gx, gy) < 0.3) return false;
    grab = { x: gx, y: gy, lx: gx, ly: gy, nodes, held, inner: within && ring > 0.6, has: new Set(nodes.map((n) => n[0])) };
    return true;
  }
  // grabbed from inside and pulled against the membrane, the content catches it and pushes it out
  function catchMembrane() {
    const { x: gx, y: gy } = grab;
    if (inside(mx, my, gx, gy) && nearRing(mx, my, gx, gy) > 0.45) return;
    for (let i = 0; i < N; i++) {
      if (grab.has.has(i)) continue;
      const dd = Math.hypot(mx[i] - gx, my[i] - gy);
      if (dd > REACH * 0.7) continue;
      const t = 1 - dd / (REACH * 0.7);
      grab.nodes.push([i, mx[i] - gx, my[i] - gy, t * t * (3 - 2 * t) * 0.8]);
      grab.has.add(i);
    }
  }
  function near(at) { return nearRing(mx, my, at[0], at[1]) < 0.6 || inside(mx, my, at[0], at[1]); }
  function moveGrab(at) { if (grab) { grab.x = at[0]; grab.y = at[1]; } }
  function release() { grab = null; }
  function applyGrab() {
    if (!grab) return;
    if (grab.inner && state.dying < 0) catchMembrane();
    const { x: gx, y: gy } = grab, k = 0.35;
    for (const [i, ox_, oy_, w] of grab.nodes) { mx[i] += (gx + ox_ - mx[i]) * w * k; my[i] += (gy + oy_ - my[i]) * w * k; }
    for (const [b, ox_, oy_, w] of grab.held) { b.x += (gx + ox_ - b.x) * w * k; b.y += (gy + oy_ - b.y) * w * k; }
  }

  // the fluid's displacement over the last step at (X, Y), into out; returns how much
  // cytoplasm is there (its dye, scaled as the inclusions expect: ~1.2 in the cell, 0 out
  // in the medium)
  let lastDt = 0;
  function fluidDisp(X, Y, out) {
    out[0] = fluid.velU(X, Y) * lastDt; out[1] = fluid.velV(X, Y) * lastDt;
    return Math.max(0, Math.min(1, fluid.dye(X, Y))) * 1.2;
  }

  // once spilt, the content stays in the cytoplasm: something whose outer side (reach from its
  // centre, away from the fluid) lies on the spilt fluid's rounded edge, or out past it, is
  // drawn back in, up the dye's slope, until all of it is under the fluid's full surface.
  // Its shift into out, and the way in into out[2], out[3]; returns 0 if it is well inside
  // (or lost far out in the medium, no fluid near it to go back to)
  const FULL = 0.75; // the dye under its outer side (the surface is full height from ~0.8)
  function holdInSpill(X, Y, reach, out) {
    const e = fluid.HC * 1.5;
    const gx = fluid.dye(X + e, Y) - fluid.dye(X - e, Y), gy = fluid.dye(X, Y + e) - fluid.dye(X, Y - e);
    const gl = Math.hypot(gx, gy);
    if (gl < 1e-3) { out[0] = out[1] = 0; return 0; }
    const nx = gx / gl, ny = gy / gl;
    const lack = FULL - fluid.dye(X - nx * reach, Y - ny * reach);
    if (lack <= 0) { out[0] = out[1] = 0; return 0; }
    const s = Math.min(lack, 0.6) * fluid.HC * 0.5;
    out[0] = nx * s; out[1] = ny * s; out[2] = nx; out[3] = ny;
    return 1;
  }
  // the same, on a verlet point (X, Y, its previous place PX, PY): shifted in with its past
  // (no kick), and its speed outwards taken away
  const hold = [0, 0, 0, 0];
  function keepInSpill(p, reach) {
    if (!holdInSpill(p.x, p.y, reach, hold)) return;
    const [dx, dy, nx, ny] = hold;
    const vo = (p.x - p.px) * nx + (p.y - p.py) * ny;
    p.x += dx; p.y += dy; p.px += dx; p.py += dy;
    if (vo < 0) { p.px += nx * vo; p.py += ny * vo; }
  }

  function step(dt) {
    const sub = 3, h = dt / sub;
    m0x.set(mx); m0y.set(my);
    for (const b of bodies) { b.x0 = b.x; b.y0 = b.y; }
    pressurePush();
    for (let s = 0; s < sub; s++) substep(h);
    // the living cell's walls move the fluid as fast as they move (the dead membrane's
    // snaps and crumpling, less: they would splash it); and the cell's frame: where it is, how fast it goes
    const snap = state.dying < 0 ? 12 : 1.5;
    let ccx = 0, ccy = 0, cvx = 0, cvy = 0;
    for (let i = 0; i < N; i++) {
      mvx[i] = (mx[i] - m0x[i]) / dt; mvy[i] = (my[i] - m0y[i]) / dt;
      ccx += mx[i] / N; ccy += my[i] / N; cvx += mvx[i] / N; cvy += mvy[i] / N;
      const sp = Math.hypot(mvx[i], mvy[i]);
      if (sp > snap) { mvx[i] *= snap / sp; mvy[i] *= snap / sp; }
    }
    frame.x = ccx; frame.y = ccy; frame.vx = cvx; frame.vy = cvy;
    for (const b of bodies) { b.vx = (b.x - b.x0) / dt; b.vy = (b.y - b.y0) / dt; }
    fluidStep(dt);
    lastDt = dt;
    state.inc.step(dt);
    state.time += dt;
    if (state.dying >= 0) state.dying += dt;
  }

  // the fluid's pressure on the membrane, inside against outside across each node: where it
  // presses harder the membrane gives way, where less it is drawn in (so the cell's content,
  // pulled or pushed, moves its membrane at once). Living, only how the pressure differs
  // round the ring (its whole, the cell's volume, is the area pressure's to keep). Eased: at
  // once, it and the walls' push on the fluid would set each other shaking. Torn, it is let
  // go (the dead membrane would swell like a balloon instead of letting the fluid pour out).
  function pressurePush() {
    const off = RW + fluid.HC * 2;
    let mean = 0;
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      let nx = my[b] - my[a], ny = -(mx[b] - mx[a]);
      const l = Math.hypot(nx, ny) || 1;
      nx /= l; ny /= l;
      raw[i] = fluid.pressure(mx[i] - nx * off, my[i] - ny * off) - fluid.pressure(mx[i] + nx * off, my[i] + ny * off);
      mean += raw[i] / N;
    }
    const alive = state.dying < 0;
    for (let i = 0; i < N; i++) {
      const target = alive ? Math.max(-0.01, Math.min(0.01, (raw[i] - mean) * PUSH)) : 0;
      push[i] += (target - push[i]) * EASE;
    }
  }

  function fluidStep(dt) {
    const dying = state.dying, d = dying < 0 ? 0 : dying, alive = dying < 0;
    const t = state.time;
    if (t - fieldsAt > 0.2) updateFields(t, frame.x, frame.y);
    fluid.rasterize(mem, bodies);
    // dying, the cytoplasm thickens and sets, in the cell and out of it
    const thick = Math.min(1, d / 18);
    const stir = alive ? 1 : Math.max(0, 1 - d / 4);
    const G1 = G + 1;
    // torn, it pours out through the tear: the mouth (the torn link's middle, wherever the
    // cell has gone) and the way out of it (from the cell's middle); the cytoplasm inside
    // drawn towards it, and what has come out carried on away from it, a tongue rather than a
    // ring round the whole cell; strongest at first, dying away as it sets
    let pour = 0, mX = 0, mY = 0, oX = 0, oY = 0;
    if (!alive) {
      const a = state.tearAt, b = (a + 1) % N;
      mX = (mx[a] + mx[b]) / 2; mY = (my[a] + my[b]) / 2;
      oX = mX - frame.x; oY = mY - frame.y;
      const ol = Math.hypot(oX, oY) || 1;
      oX /= ol; oY /= ol;
      pour = POUR * smooth(d / 1.5) * (1 - smooth(d / 24));
    }
    // ---- forces, on each face: inside, the streaming (in the cell's frame: it is carried
    // along with the cell, not held back as the cell moves); outside, the medium's current
    for (let pass = 0; pass < 2; pass++) {
      const fv = pass ? frame.vy : frame.vx;
      const W = pass ? G : G1, H = pass ? G1 : G, F = pass ? v : u, sx = pass ? strY : strX, cx = pass ? curY : curX;
      const step_ = pass ? G : 1; // from a face's first cell to its second
      for (let j = pass; j < H - pass; j++) for (let i = 1 - pass; i < W - 1 + pass; i++) {
        const f = j * W + i, a = pass ? (j - 1) * G + i : j * G + i - 1, b = a + step_;
        const ins = inCell[a] | inCell[b], dye = (c[a] + c[b]) * 0.5;
        if (ins) {
          if (stir > 0) F[f] += ((sx[a] + sx[b]) * 0.5 + (alive ? fv : 0) - F[f]) * STREAM * stir;
          if (!alive) F[f] *= 1 - 0.06 * thick; // setting
        } else {
          // the medium; the cytoplasm out in it is held back more, and more as it sets
          const k = MEDIUM + (alive ? 0 : dye * (0.05 + 0.25 * thick));
          F[f] += ((cx[a] + cx[b]) * 0.5 - F[f]) * Math.min(1, k);
        }
        if (pour > 0 && dye > 0.05) {
          // the face's place, and the way from the mouth to it
          const fx = pass ? X(i) : X(i) - HC / 2, fy = pass ? X(j) - HC / 2 : X(j);
          const rx = fx - mX, ry = fy - mY, rl = Math.hypot(rx, ry) || 1;
          let dir;
          if (ins) dir = -(pass ? ry : rx) / rl * Math.min(1, rl / 0.8); // inside: to the mouth
          else {
            // outside: on away from it, along the way out, fanning out a little, fading with
            // the distance from it
            const fan = Math.max(0, (rx * oX + ry * oY) / rl);
            dir = ((pass ? oY : oX) * 0.7 + (pass ? ry : rx) / rl * 0.3) * fan * Math.exp(-rl / 3.5);
          }
          F[f] += (dir * pour - F[f]) * POUR_K * Math.min(1, dye * 1.5);
        }
      }
    }
    // the hand sweeps the fluid under it along (inside the living cell only)
    if (grab) {
      const gvx = (grab.x - grab.lx) / dt, gvy = (grab.y - grab.ly) / dt, RR = REACH * 0.8;
      grab.lx = grab.x; grab.ly = grab.y;
      const i0 = Math.max(1, Math.floor(fluid.at(grab.x - RR))), i1 = Math.min(G - 1, Math.ceil(fluid.at(grab.x + RR)));
      const j0 = Math.max(1, Math.floor(fluid.at(grab.y - RR))), j1 = Math.min(G - 1, Math.ceil(fluid.at(grab.y + RR)));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * G + i;
        if (alive && !inCell[k]) continue;
        const dd = Math.hypot(X(i) - grab.x, X(j) - grab.y);
        if (dd > RR) continue;
        const w = 0.5 * smooth(1 - dd / RR);
        u[j * G1 + i] += (gvx - u[j * G1 + i]) * w;
        v[k] += (gvy - v[k]) * w;
      }
    }
    // ---- the swelling: torn, the cytoplasm takes up more room, inside (so it pours out) and
    // out in the medium (so it spreads there), less and less as it sets
    src.fill(0);
    if (!alive) {
      const sIn = 0.06 * (1 - smooth(d / 25)), sOut = 0.04 * (1 - smooth(d / 30));
      for (let k = 0; k < G * G; k++) {
        if (solid[k] || c[k] < 0.05) continue;
        src[k] = inCell[k] ? sIn * Math.min(1, c[k] * 2) : sOut * c[k];
      }
    }
    fluid.enforceWalls();
    fluid.advectVelocity(dt);
    fluid.viscosity(VISC * (1 + thick));
    fluid.enforceWalls();
    fluid.project(3);
    fluid.advectScalars(dt);
    // the living cell is full of its cytoplasm (what the grid's blur takes from it, restored),
    // and none of it outside
    if (alive) {
      for (let k = 0; k < G * G; k++) {
        if (solid[k]) continue;
        if (inCell[k]) c[k] += (1 - c[k]) * 0.05;
        else c[k] *= 0.9;
      }
    }
    // spilt, it creeps out along the medium's grain, slower as it sets
    if (!alive) fluid.creep(CREEP * (1 - 0.8 * thick) * Math.min(1, dt * 60));
    fluid.fillWalls(!alive);
    fluid.resetCoords(t);
  }

  const RFL = RW + fluid.HC * 2.5; // where a block feels the fluid round it
  function substep(h) {
    const dying = state.dying;
    const d = dying < 0 ? 0 : dying;
    const tt = state.time;
    const breath = 1 + 0.025 * Math.sin(tt * 1.3) + 0.012 * Math.sin(tt * 0.47 + 1);

    // ---- membrane: verlet + area pressure (the living cell holds its shape) + links
    const area = polyArea(mx, my);
    const intact = dying < 0;
    const press = intact ? (area0 * 0.93 * breath - area) * 0.0008 : 0;
    // the dead membrane recoils from the tear (as a taut one would), shrinks, crumples
    const slack = intact ? 1 : Math.max(0.5, 0.92 - d * 0.03);
    const drive = intact ? state.drive : 0;
    const cur = [0, 0];
    msx.set(mx); msy.set(my); // where the substep starts (the ring doesn't cross itself there)
    for (const b of bodies) { b.sx = b.x; b.sy = b.y; }
    for (let i = 0; i < N; i++) {
      const a = (i - 1 + N) % N, b = (i + 1) % N;
      const nx = my[b] - my[a], ny = -(mx[b] - mx[a]); // outward (ccw ring)
      const nl = Math.hypot(nx, ny) || 1;
      let vxm = (mx[i] - mpx[i]) * (intact ? 0.97 : 0.95);
      let vym = (my[i] - mpy[i]) * (intact ? 0.97 : 0.95);
      // bathed in the medium: dragged towards its current (the living cell sways in it)
      current(mx[i], my[i], tt, cur);
      if (!intact) {
        // torn, the blocks float free: carried by the fluid round them (the spill pouring out,
        // the medium's current), and wandering off each its own way, a little outwards from
        // the remains at first — the looser, the more (a block still in a chain is held by it)
        const free = (linkOn[a] ? 0 : 0.5) + (linkOn[i] ? 0 : 0.5), on = smooth(d / 3);
        const r = roam[i], hd = r.ph + tt * r.w + Math.sin(tt * r.w2 + r.ph) * 1.2;
        let ox = mx[i] - frame.x, oy = my[i] - frame.y;
        const ol = Math.hypot(ox, oy) || 1;
        const sp = ROAM * r.v * (0.3 + 0.7 * free) * on, out = 0.6 * (1 - 0.7 * smooth((d - 5) / 25));
        // (the fluid just round it: under it, it is the block's own wall, moving as it moves)
        let fx = 0, fy = 0;
        for (let q = 0; q < 4; q++) {
          const qa = q * 1.5708 + 0.4, qx = mx[i] + Math.cos(qa) * RFL, qy = my[i] + Math.sin(qa) * RFL;
          fx += fluid.velU(qx, qy) / 4; fy += fluid.velV(qx, qy) / 4;
        }
        cur[0] = fx + (Math.cos(hd) + (ox / ol) * out) * sp;
        cur[1] = fy + (Math.sin(hd) + (oy / ol) * out) * sp;
      }
      vxm += (cur[0] * h - vxm) * DRAG_MEM;
      vym += (cur[1] * h - vym) * DRAG_MEM;
      mpx[i] = mx[i]; mpy[i] = my[i];
      // the lobes: a push along the normal, out here, in there (their sum is nought round the ring)
      let lobe = 0;
      if (drive > 0) {
        const uu = (i / N) * Math.PI * 2;
        for (const l of lobes) lobe += l.a * Math.sin(l.k * uu + l.ph + tt * l.w) * (0.6 + 0.4 * Math.sin(tt * 0.13 * l.k + l.ph * 3));
        lobe *= drive * 0.0016;
      }
      mx[i] += vxm + nx * (press + lobe) + (nx / nl) * push[i];
      my[i] += vym + ny * (press + lobe) + (ny / nl) * push[i];
    }
    if (intact) {
      // held loosely in place (it is a slice of a tissue): the ring's centre drifts back
      let cx = 0, cy = 0;
      for (let i = 0; i < N; i++) { cx += mx[i]; cy += my[i]; }
      cx /= N; cy /= N;
      const k = grab ? 0 : 0.002;
      for (let i = 0; i < N; i++) { mx[i] -= cx * k; my[i] -= cy * k; }
    }
    applyGrab();
    for (let it = 0; it < 4; it++) {
      for (let i = 0; i < N; i++) {
        if (!linkOn[i]) continue;
        const j = (i + 1) % N;
        distance(mx, my, i, j, linkRest[i] * Math.max(0.88, slack), 0.9);
      }
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N, k = (i + 2) % N;
        if (!linkOn[i] || !linkOn[j]) continue;
        distance(mx, my, i, k, bendRest[i] * slack, intact ? 0.035 : 0.06);
      }
    }
    // blocks don't pass into each other (those not linked: across a fold, or loose): a
    // block is kept a block's thickness off the stretches of membrane it isn't next to
    // (node against link, so none slips through the gap of a stretched one), and loose ones
    // off each other
    separate(state.T * 0.95, state.L * 0.8);
    // pulled too far, the membrane gives way
    if (intact && grab) {
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        if (Math.hypot(mx[j] - mx[i], my[j] - my[i]) > linkRest[i] * 2.4) { tear([(mx[i] + mx[j]) / 2, (my[i] + my[j]) / 2]); break; }
      }
    }
    // the tear spreads: overstretched links give way once it has begun
    if (!intact) {
      for (let i = 0; i < N; i++) {
        if (!linkOn[i]) continue;
        const j = (i + 1) % N;
        const L = Math.hypot(mx[j] - mx[i], my[j] - my[i]);
        if (L > linkRest[i] * Math.max(0.88, slack) * 1.35 && rand() < 0.08) linkOn[i] = 0;
        // and it falls apart, from the tear on round the ring (the far side holds a while, so
        // the cytoplasm pours out of the tear rather than all round)
        else if (d > 2 && chainGap(i, state.tearAt) < 3 + d * 1.6 && rand() < 0.00012 * Math.min(d, 10)) linkOn[i] = 0;
      }
    }

    // ---- content: verlet, carried by the fluid (dying, the nucleus shrinks into a dark
    // clot, as it's drawn)
    const nb = bodies[0];
    nb.r0 ??= nb.r;
    nb.r = nb.r0 * (1 - 0.15 * smooth(d / 3));
    for (const b of bodies) {
      let bvx = (b.x - b.px) * 0.96, bvy = (b.y - b.py) * 0.96;
      b.px = b.x; b.py = b.y;
      if (!intact && b.x * b.x + b.y * b.y > R * R) b.out = true;
      // the fluid round it (the nucleus is a wall in it: what streams past its rim)
      let fu = 0, fv = 0;
      if (b.solid) {
        const rr = b.r + fluid.HC * 3;
        for (let q = 0; q < 8; q++) {
          const a = (q / 8) * Math.PI * 2, x = b.x + Math.cos(a) * rr, y = b.y + Math.sin(a) * rr;
          fu += fluid.velU(x, y) / 8; fv += fluid.velV(x, y) / 8;
        }
      } else { fu = fluid.velU(b.x, b.y); fv = fluid.velV(b.x, b.y); }
      const k = b.solid ? 0.2 : 0.35;
      bvx += (fu * h - bvx) * k;
      bvy += (fv * h - bvy) * k;
      b.x += bvx; b.y += bvy;
      // spilt, it stays in the cytoplasm, not stranded on its edge
      if (!intact) keepInSpill(b, b.r + 0.04);
    }

    // content / content, content / membrane
    for (let a = 0; a < bodies.length; a++) {
      const A = bodies[a];
      for (let cI = a + 1; cI < bodies.length; cI++) {
        const B = bodies[cI];
        const ddx = B.x - A.x, ddy = B.y - A.y, dd = Math.hypot(ddx, ddy), rr = A.r + B.r;
        if (dd < rr && dd > 1e-6) {
          const pen = rr - dd, wa = B.m / (A.m + B.m);
          A.x -= (ddx / dd) * pen * wa; A.y -= (ddy / dd) * pen * wa;
          B.x += (ddx / dd) * pen * (1 - wa); B.y += (ddy / dd) * pen * (1 - wa);
        }
      }
      // against the membrane's links (not only its blocks: none slips through the gap of a
      // stretched one), and against the loose blocks
      const rr = A.r + RW, w = 4 / (A.m + 4);
      for (let n = 0; n < N; n++) {
        const n1 = (n + 1) % N;
        let t = 0;
        if (linkOn[n]) {
          const sx = mx[n1] - mx[n], sy = my[n1] - my[n], l2 = sx * sx + sy * sy;
          if (l2 > 1e-12) t = Math.max(0, Math.min(1, ((A.x - mx[n]) * sx + (A.y - my[n]) * sy) / l2));
        }
        const qx = mx[n] + (mx[n1] - mx[n]) * t, qy = my[n] + (my[n1] - my[n]) * t;
        const ddx = A.x - qx, ddy = A.y - qy, dd = Math.hypot(ddx, ddy);
        if (dd < rr && dd > 1e-6) {
          const pen = rr - dd, ex = ddx / dd, ey = ddy / dd;
          A.x += ex * pen * w; A.y += ey * pen * w;
          const m = pen * (1 - w);
          mx[n] -= ex * m * (1 - t); my[n] -= ey * m * (1 - t);
          mx[n1] -= ex * m * t; my[n1] -= ey * m * t;
        }
      }
      A.angle += ((A.x - A.px) * 0.7 - (A.y - A.py) * 0.4) / A.r;
    }

    // and the ring never crosses itself: a move that would (a hard pull or a shake carrying
    // a block through the membrane) is taken back, the blocks involved left where they were
    uncross();

    // the living cell keeps its content: what a shake carried out through the membrane is
    // taken back in (where it was, or else just inside the ring, off it)
    if (intact) for (const b of bodies) {
      if (inside(mx, my, b.x, b.y)) continue;
      if (inside(mx, my, b.sx, b.sy)) { b.x = b.px = b.sx; b.y = b.py = b.sy; continue; }
      let best = Infinity, qx = 0, qy = 0, ox = 0, oy = 0;
      for (let n = 0; n < N; n++) {
        const n1 = (n + 1) % N, sx = mx[n1] - mx[n], sy = my[n1] - my[n], l2 = sx * sx + sy * sy;
        if (l2 < 1e-12) continue;
        const t = Math.max(0, Math.min(1, ((b.x - mx[n]) * sx + (b.y - my[n]) * sy) / l2));
        const px = mx[n] + sx * t, py = my[n] + sy * t, dd = Math.hypot(b.x - px, b.y - py);
        if (dd < best) { best = dd; qx = px; qy = py; const l = Math.sqrt(l2); ox = sy / l; oy = -sx / l; }
      }
      let ok = false;
      for (const off of [b.r + RW, (b.r + RW) * 0.5, 0.03]) {
        const x = qx - ox * off, y = qy - oy * off;
        if (inside(mx, my, x, y)) { b.x = b.px = x; b.y = b.py = y; ok = true; break; }
      }
      // (in a pinched fold: towards the cell's middle, till it is in)
      if (!ok) {
        let cx = 0, cy = 0;
        for (let n = 0; n < N; n++) { cx += mx[n] / N; cy += my[n] / N; }
        for (let k = 1; k <= 10 && !inside(mx, my, b.x, b.y); k++) { b.x += (cx - b.x) * 0.2; b.y += (cy - b.y) * 0.2; }
        b.px = b.x; b.py = b.y;
      }
    }
  }

  // ---- the membrane against itself
  const msx = new Float32Array(N), msy = new Float32Array(N);
  // links whose chain is within this many nodes of a node don't push it (its own bend)
  const NEAR = 3;
  function chainGap(i, j) { const d = Math.abs(i - j); return Math.min(d, N - d); }
  function separate(minS, minD) {
    for (let it = 0; it < 2; it++) {
      for (let p = 0; p < N; p++) {
        for (let i = 0; i < N; i++) {
          if (!linkOn[i]) continue;
          const j = (i + 1) % N;
          if (chainGap(p, i) <= NEAR || chainGap(p, j) <= NEAR) continue;
          const sx = mx[j] - mx[i], sy = my[j] - my[i], l2 = sx * sx + sy * sy;
          const ax = mx[p] - mx[i], ay = my[p] - my[i];
          if (l2 < 1e-12 || ax * ax + ay * ay > 2 * (minS * minS + l2)) continue; // (far off it)
          const t = Math.max(0, Math.min(1, (ax * sx + ay * sy) / l2));
          const qx = mx[i] + sx * t, qy = my[i] + sy * t;
          let dx = mx[p] - qx, dy = my[p] - qy, dd = Math.hypot(dx, dy);
          if (dd >= minS) continue;
          if (dd < 1e-6) { const l = Math.sqrt(l2); dx = -sy / l; dy = sx / l; dd = 1; } else { dx /= dd; dy /= dd; }
          const pen = (minS - Math.min(dd, minS)) * 0.5;
          mx[p] += dx * pen; my[p] += dy * pen;
          mx[i] -= dx * pen * (1 - t); my[i] -= dy * pen * (1 - t);
          mx[j] -= dx * pen * t; my[j] -= dy * pen * t;
        }
      }
    }
    // and blocks off each other, node against node (the loose ones too)
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      if (chainGap(i, j) <= 1 && linkOn[(j === (i + 1) % N) ? i : j]) continue;
      const dx = mx[j] - mx[i], dy = my[j] - my[i], d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 < 1e-12) continue;
      const dd = Math.sqrt(d2), cc = ((minD - dd) / dd) * 0.5;
      mx[i] -= dx * cc; my[i] -= dy * cc;
      mx[j] += dx * cc; my[j] += dy * cc;
    }
  }
  // the pairs of links crossing each other, in the current positions
  function crossings(out) {
    out.length = 0;
    for (let i = 0; i < N; i++) {
      if (!linkOn[i]) continue;
      const i1 = (i + 1) % N;
      for (let j = i + 2; j < N; j++) {
        if (!linkOn[j]) continue;
        const j1 = (j + 1) % N;
        if (j1 === i) continue;
        if (segCross(mx[i], my[i], mx[i1], my[i1], mx[j], my[j], mx[j1], my[j1])) out.push(i, j);
      }
    }
    return out;
  }
  const crossed = [];
  function uncross() {
    for (let it = 0; it < 6; it++) {
      if (!crossings(crossed).length) return;
      const all = it === 5; // still tangled: the whole ring back where it was
      for (let k = 0; k < crossed.length; k++) {
        const i = crossed[k];
        for (const n of all ? [] : [i, (i + 1) % N]) { mx[n] = msx[n]; my[n] = msy[n]; }
      }
      if (all) { mx.set(msx); my.set(msy); }
    }
  }

  function distance(Xs, Ys, i, j, rest, k) {
    const dx = Xs[j] - Xs[i], dy = Ys[j] - Ys[i], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const cc = ((d - rest) / d) * 0.5 * k;
    Xs[i] += dx * cc; Ys[i] += dy * cc;
    Xs[j] -= dx * cc; Ys[j] -= dy * cc;
  }

  // the leaked fraction: the cytoplasm out of the cell as it was when it tore (for the bar;
  // the ring itself means nothing once its blocks scatter, and the fraction out of it would
  // go down as they spread over the spill)
  function measure() {
    const ref = state.dying < 0 ? inCell : cell0;
    let out = 0, all = 0;
    for (let k = 0; k < G * G; k++) {
      if (solid[k]) continue;
      all += c[k];
      if (!ref[k]) out += c[k];
    }
    state.leaked = all > 0 ? out / all : 0;
    return state.leaked;
  }

  state.inc = createInclusions(state, rng(seed * 13 + 5), { inside, nearRing, fluidDisp, current, holdInSpill });

  Object.assign(state, { step, tear, measure, grabAt, moveGrab, release, near });
  return state;
}

function smooth(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

function polyArea(X, Y) {
  let a = 0;
  for (let i = 0, n = X.length; i < n; i++) {
    const j = (i + 1) % n;
    a += X[i] * Y[j] - X[j] * Y[i];
  }
  return a / 2;
}

// do segments a→b and c→d cross (strictly)?
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const den = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (den === 0) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / den;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / den;
  return t > 0 && t < 1 && u > 0 && u < 1;
}

export function inside(X, Y, px, py) {
  let c = false;
  for (let i = 0, n = X.length, j = n - 1; i < n; j = i++) {
    if ((Y[i] > py) !== (Y[j] > py) && px < ((X[j] - X[i]) * (py - Y[i])) / (Y[j] - Y[i]) + X[i]) c = !c;
  }
  return c;
}

function nearRing(X, Y, px, py) {
  let best = Infinity;
  for (let i = 0, n = X.length; i < n; i++) {
    const j = (i + 1) % n, sx = X[j] - X[i], sy = Y[j] - Y[i];
    const t = Math.max(0, Math.min(1, ((px - X[i]) * sx + (py - Y[i]) * sy) / (sx * sx + sy * sy)));
    best = Math.min(best, Math.hypot(px - X[i] - sx * t, py - Y[i] - sy * t));
  }
  return best;
}
