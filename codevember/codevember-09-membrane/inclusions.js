// The cell's inclusions: the "stuff" the fluid carries besides the nucleus and vesicles. Still
// 2d, still no three.js. Two kinds of things, both passive tracers of the fluid (they take
// its local motion, read from the grid where they are), kept off the nucleus and vesicles
// and, while the cell lives, inside the membrane:
//   strands, chains of nodes held by links and a bending stiffness:
//     0 microtubules, long, stiff, radiating from a centrosome beside the nucleus (an aster)
//     1 actin fibres, short and supple, mostly along the cortex, under the membrane
//     2 mitochondria, fat rods (capsules), each its own: short and plump or long and snaking,
//       straight, bowed or wavy, thin or fat (w: its girth; v: its look, for the drawing)
//     3 cisternae of the endoplasmic reticulum, arcs stacked round the nucleus
//   granules, single points: 0 ribosomes (tiny, dark, many), 1 lipid droplets (pale), 2 dense granules
// Once torn, the strands fall apart (their links give way, the microtubules let go of the
// centrosome), and it all pours out with the fluid and drifts in the medium.

export const KIND = { TUBULE: 0, ACTIN: 1, MITO: 2, ER: 3 };
// per kind: half width (for collisions), how closely it follows the fluid, bending stiffness,
// how fast its links give way once the cell is dead (per second)
const HALF = [0.014, 0.009, 0.06, 0.038];
const FOLLOW = [0.2, 0.75, 0.4, 0.5];
const BEND = [0.9, 0.12, 0.6, 0.2];
const DECAY = [0.05, 0.08, 0.004, 0.03];

export function createInclusions(sim, rand, { inside, nearRing, fluidDisp, current, holdInSpill }) {
  const { mx, my, bodies } = sim;
  const nucleus = bodies[0];
  const free = (X, Y, margin, pad = 0.06, skipNucleus = false) =>
    inside(mx, my, X, Y) && nearRing(mx, my, X, Y) > margin &&
    bodies.every((b, k) => (skipNucleus && k === 0) || Math.hypot(b.x - X, b.y - Y) > b.r + pad);

  // ---- strands
  const sx = [], sy = [], strands = [];
  function add(kind, pts, extra = {}) {
    if (pts.length < 2) return;
    strands.push({ kind, start: sx.length, n: pts.length, anchored: kind === KIND.TUBULE, w: 1, v: rand(), ...extra });
    for (const [X, Y] of pts) { sx.push(X); sy.push(Y); }
  }
  // the centrosome: a point just off the nucleus, carried by the fluid but kept beside it
  // (where there is the most room round it)
  const centro = { a: 0, x: 0, y: 0 };
  {
    let best = -Infinity;
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * 6.2832 + rand() * 0.2;
      const X = nucleus.x + Math.cos(a) * (nucleus.r + 0.16), Y = nucleus.y + Math.sin(a) * (nucleus.r + 0.16);
      let room = Math.min(nearRing(mx, my, X, Y) * 0.5, inside(mx, my, X, Y) ? 9 : -9);
      for (const b of bodies.slice(1)) room = Math.min(room, Math.hypot(b.x - X, b.y - Y) - b.r);
      room += rand() * 0.1;
      if (room > best) { best = room; Object.assign(centro, { a, x: X, y: Y }); }
    }
  }
  const cf = [0, 0];
  const placeCentro = () => {
    fluidDisp(centro.x, centro.y, cf);
    centro.x += cf[0] * 0.5; centro.y += cf[1] * 0.5;
    if (sim.dying >= 0) return; // dead, it drifts off
    const dx = centro.x - nucleus.x, dy = centro.y - nucleus.y, d = Math.hypot(dx, dy) || 1, r = nucleus.r + 0.16;
    centro.x += (dx / d) * (r - d) * 0.3; centro.y += (dy / d) * (r - d) * 0.3;
  };
  // microtubules: walking out from it, wavering a little, until they meet something
  const nt = 16 + Math.floor(rand() * 7);
  for (let k = 0; k < nt; k++) {
    let h = centro.a + (k / nt) * 6.2832 + (rand() - 0.5) * 0.4;
    // those pointing back at the nucleus bend round it
    const pts = [[centro.x, centro.y]];
    const len = 8 + Math.floor(rand() * 9);
    for (let i = 1; i < len; i++) {
      const [X, Y] = pts[i - 1];
      h += (rand() - 0.5) * 0.3;
      let nx = X + Math.cos(h) * 0.17, ny = Y + Math.sin(h) * 0.17;
      if (Math.hypot(nx - nucleus.x, ny - nucleus.y) < nucleus.r + 0.08) {
        const out = Math.atan2(ny - nucleus.y, nx - nucleus.x);
        h = out + (wrap(h - out) > 0 ? 1.3 : -1.3);
        nx = X + Math.cos(h) * 0.17; ny = Y + Math.sin(h) * 0.17;
      }
      // something in the way: it veers round it, if it can
      let ok = false;
      for (const turn of [0, 0.35, -0.35, 0.7, -0.7]) {
        const hh = h + turn * (k & 1 ? 1 : -1);
        nx = X + Math.cos(hh) * 0.17; ny = Y + Math.sin(hh) * 0.17;
        if (free(nx, ny, 0.4, 0.05, i < 2)) { ok = true; h = hh; break; }
      }
      if (!ok) break;
      pts.push([nx, ny]);
    }
    add(KIND.TUBULE, pts);
  }
  // actin: along the cortex (tangent to it), and a few loose ones inside
  for (let k = 0, tries = 0; k < 34 && tries < 2000; tries++) {
    const a = rand() * 6.28, cortex = k < 26;
    const rr = cortex ? 0.8 + rand() * 0.12 : Math.sqrt(rand()) * 0.75;
    const X = Math.cos(a) * sim.R * rr, Y = Math.sin(a) * sim.R * rr;
    if (!free(X, Y, 0.38) || (cortex && nearRing(mx, my, X, Y) > 0.8)) continue;
    let h = cortex ? a + Math.PI / 2 + (rand() - 0.5) * 0.6 : rand() * 6.28;
    const pts = [[X, Y]], n = 4 + Math.floor(rand() * 5);
    for (let i = 1; i < n; i++) {
      h += (rand() - 0.5) * 0.5;
      const [px, py] = pts[i - 1], nx = px + Math.cos(h) * 0.1, ny = py + Math.sin(h) * 0.1;
      if (!free(nx, ny, 0.36)) break;
      pts.push([nx, ny]);
    }
    if (pts.length >= 3) { add(KIND.ACTIN, pts); k++; }
  }
  // the endoplasmic reticulum: two or three stacks of arcs round the nucleus
  const nst = 2 + Math.floor(rand() * 2);
  for (let s = 0; s < nst; s++) {
    const a0 = centro.a + Math.PI * (0.5 + s * (1.2 / nst)) + (rand() - 0.5) * 0.6;
    const span = 0.9 + rand() * 0.7, layers = 2 + Math.floor(rand() * 2);
    for (let l = 0; l < layers; l++) {
      const r = nucleus.r + 0.24 + l * 0.15 + rand() * 0.03;
      const sp = span * (1 - l * 0.12), n = Math.max(3, Math.round((sp * r) / 0.14));
      let pts = [];
      for (let i = 0; i < n; i++) {
        const a = a0 - sp / 2 + (i / (n - 1)) * sp;
        const w = 1 + 0.06 * Math.sin(i * 1.7 + l);
        const X = nucleus.x + Math.cos(a) * r * w, Y = nucleus.y + Math.sin(a) * r * w;
        if (free(X, Y, 0.4, 0.05)) pts.push([X, Y]);
        else { add(KIND.ER, pts); pts = []; }
      }
      add(KIND.ER, pts);
    }
  }
  // mitochondria, anywhere there's room for them, each its own shape: a short plump bean, a
  // rod, a long snaking thread; straight, bowed (a C) or wavy (an S, or more); thin or fat
  for (let k = 0, tries = 0, nm = 10 + Math.floor(rand() * 6); k < nm && tries < 3000; tries++) {
    const X = (rand() - 0.5) * 2 * sim.R, Y = (rand() - 0.5) * 2 * sim.R;
    const u = rand();
    const len = u < 0.25 ? 0.18 + rand() * 0.14 : u < 0.75 ? 0.32 + rand() * 0.3 : 0.65 + rand() * 0.45;
    const w = u < 0.25 ? 1.05 + rand() * 0.3 : u < 0.75 ? 0.8 + rand() * 0.35 : 0.65 + rand() * 0.3;
    const n = Math.max(3, Math.round(len / 0.11) + 1), seg = len / (n - 1);
    const bow = (rand() - 0.5) * (u < 0.25 ? 1.2 : 2.2); // total turn, end to end
    const wave = rand() < 0.45 ? (0.4 + rand() * 0.6) * (rand() < 0.5 ? -1 : 1) : 0, waves = 1 + Math.floor(rand() * 2);
    // walked from one end, then centred on (X, Y)
    let h = rand() * 6.28 - bow / 2, px = 0, py = 0;
    const pts = [[0, 0]];
    for (let i = 1; i < n; i++) {
      const t = (i - 0.5) / (n - 1);
      const hh = h + bow * t + wave * Math.sin(t * Math.PI * 2 * waves) * (len > 0.5 ? 1 : 0.5);
      px += Math.cos(hh) * seg; py += Math.sin(hh) * seg;
      pts.push([px, py]);
    }
    const mx0 = pts.reduce((a, p) => a + p[0], 0) / n, my0 = pts.reduce((a, p) => a + p[1], 0) / n;
    for (const p of pts) { p[0] += X - mx0; p[1] += Y - my0; }
    if (!pts.every(([qx, qy]) => free(qx, qy, 0.45, 0.1))) continue;
    if (strands.some((s) => s.kind === KIND.MITO && pts.some(([qx, qy]) => {
      for (let i = s.start; i < s.start + s.n; i++) if (Math.hypot(sx[i] - qx, sy[i] - qy) < 0.2) return true;
      return false;
    }))) continue;
    add(KIND.MITO, pts, { w });
    k++;
  }

  const NN = sx.length;
  const nx = Float32Array.from(sx), ny = Float32Array.from(sy);
  const npx = Float32Array.from(sx), npy = Float32Array.from(sy);
  const nkind = new Uint8Array(NN), link = new Uint8Array(NN); // link i: node i → i + 1 (same strand)
  const rest = new Float32Array(NN), bendRest = new Float32Array(NN);
  for (const s of strands) {
    s.release = 1 + rand() * 5; // seconds after the tear it lets go of the centrosome
    // its heading out of the centrosome, against the line from the nucleus (held there: an aster)
    s.dir = wrap(Math.atan2(sy[s.start + 1] - sy[s.start], sx[s.start + 1] - sx[s.start]) - Math.atan2(centro.y - nucleus.y, centro.x - nucleus.x));
    for (let i = s.start; i < s.start + s.n; i++) {
      nkind[i] = s.kind;
      if (i < s.start + s.n - 1) { link[i] = 1; rest[i] = Math.hypot(nx[i + 1] - nx[i], ny[i + 1] - ny[i]); }
      if (i < s.start + s.n - 2) bendRest[i] = Math.hypot(nx[i + 2] - nx[i], ny[i + 2] - ny[i]);
    }
  }

  // ---- granules
  const gxs = [], gys = [], gks = [], gss = [];
  for (let tries = 0; gxs.length < 620 && tries < 20000; tries++) {
    const X = (rand() - 0.5) * 2.4 * sim.R, Y = (rand() - 0.5) * 2.4 * sim.R;
    if (!free(X, Y, 0.34, 0.04)) continue;
    const u = rand(), k = u < 0.8 ? 0 : u < 0.86 ? 1 : 2;
    gxs.push(X); gys.push(Y); gks.push(k);
    gss.push(k === 0 ? 0.03 + rand() * 0.02 : k === 1 ? 0.07 + rand() * 0.06 : 0.06 + rand() * 0.03);
  }
  const G = gxs.length;
  const gx = Float32Array.from(gxs), gy = Float32Array.from(gys);
  const gpx = Float32Array.from(gxs), gpy = Float32Array.from(gys);
  const gkind = Uint8Array.from(gks), gsize = Float32Array.from(gss);

  // ---- each step, after the fluid's
  const f = [0, 0], cur = [0, 0];
  function carry(X, Y, PX, PY, i, follow, jitter, dt) {
    let vx = (X[i] - PX[i]) * 0.9, vy = (Y[i] - PY[i]) * 0.9;
    const w = fluidDisp(X[i], Y[i], f);
    const c = Math.min(1, w / 1.2) * follow;
    vx += (f[0] - vx) * c; vy += (f[1] - vy) * c;
    if (w < 0.6 && sim.dying >= 0) {
      // no fluid around it: out in the medium
      current(X[i], Y[i], sim.time, cur);
      const k = 0.08 * (1 - w / 0.6);
      vx += (cur[0] * dt - vx) * k; vy += (cur[1] * dt - vy) * k;
    }
    vx += (rand() - 0.5) * jitter; vy += (rand() - 0.5) * jitter;
    PX[i] = X[i]; PY[i] = Y[i];
    X[i] += vx; Y[i] += vy;
  }
  // kept off the content, and (alive) inside the membrane
  function keep(X, Y, i, half, skipNucleus) {
    for (let k = skipNucleus ? 1 : 0; k < bodies.length; k++) {
      const b = bodies[k], dx = X[i] - b.x, dy = Y[i] - b.y, d = Math.hypot(dx, dy), rr = b.r + half + 0.02;
      if (d < rr && d > 1e-6) { X[i] = b.x + (dx / d) * rr; Y[i] = b.y + (dy / d) * rr; }
    }
    if (sim.dying >= 0) { spill(X, Y, i, half); return; }
    const margin = sim.RW + half + 0.06;
    // (well inside the disc that fits in the ring: nothing to do, no need to look for its
    // nearest link)
    const cx = X[i] - core.x, cy = Y[i] - core.y, cr = core.r - margin;
    if (cr > 0 && cx * cx + cy * cy < cr * cr) return;
    const q = nearest(X[i], Y[i]), inn = inside(mx, my, X[i], Y[i]);
    if (inn && q.d >= margin) return;
    // pushed back in along the membrane's inward normal
    X[i] = q.x + q.nx * margin; Y[i] = q.y + q.ny * margin;
  }
  // (dead) in the spilt cytoplasm, not stranded on its rounded edge: drawn back in with its
  // previous place (no kick), its speed outwards taken away
  const hs = [0, 0, 0, 0];
  function spill(X, Y, i, half) {
    if (!holdInSpill(X[i], Y[i], half + 0.03, hs)) return;
    const [dx, dy, ux, uy] = hs, PX = X === nx ? npx : gpx, PY = X === nx ? npy : gpy;
    const vo = (X[i] - PX[i]) * ux + (Y[i] - PY[i]) * uy;
    X[i] += dx; Y[i] += dy; PX[i] += dx; PY[i] += dy;
    if (vo < 0) { PX[i] += ux * vo; PY[i] += uy * vo; }
  }
  const q = { x: 0, y: 0, d: 0, nx: 0, ny: 0 };
  function nearest(X, Y) {
    const N = mx.length;
    q.d = Infinity;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, ex = mx[j] - mx[i], ey = my[j] - my[i];
      const t = Math.max(0, Math.min(1, ((X - mx[i]) * ex + (Y - my[i]) * ey) / (ex * ex + ey * ey || 1)));
      const cx = mx[i] + ex * t, cy = my[i] + ey * t, d = Math.hypot(X - cx, Y - cy);
      if (d < q.d) { const l = Math.hypot(ex, ey) || 1; q.d = d; q.x = cx; q.y = cy; q.nx = -ey / l; q.ny = ex / l; } // inward (ccw ring)
    }
    return q;
  }
  function constrain(i, j, r, k, pinI) {
    const dx = nx[j] - nx[i], dy = ny[j] - ny[i], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const c = ((d - r) / d) * k;
    if (pinI) { nx[j] -= dx * c; ny[j] -= dy * c; return; }
    nx[i] += dx * c * 0.5; ny[i] += dy * c * 0.5;
    nx[j] -= dx * c * 0.5; ny[j] -= dy * c * 0.5;
  }

  // the disc round the ring's middle that fits inside it (none if the middle isn't inside)
  const core = { x: 0, y: 0, r: 0 };
  function fitCore() {
    const N = mx.length;
    let x = 0, y = 0;
    for (let i = 0; i < N; i++) { x += mx[i] / N; y += my[i] / N; }
    core.x = x; core.y = y; core.r = inside(mx, my, x, y) ? nearest(x, y).d : 0;
  }
  function step(dt) {
    const d = sim.dying;
    if (d < 0) fitCore();
    placeCentro();
    for (let i = 0; i < NN; i++) carry(nx, ny, npx, npy, i, FOLLOW[nkind[i]], 0.0012, dt);
    for (const s of strands) {
      if (s.anchored && d >= 0 && d > s.release) s.anchored = false;
      if (s.anchored) {
        const h = Math.atan2(centro.y - nucleus.y, centro.x - nucleus.x) + s.dir, i = s.start;
        nx[i] = centro.x; ny[i] = centro.y;
        nx[i + 1] += (centro.x + Math.cos(h) * rest[i] - nx[i + 1]) * 0.5;
        ny[i + 1] += (centro.y + Math.sin(h) * rest[i] - ny[i + 1]) * 0.5;
      }
    }
    for (let it = 0; it < 3; it++) {
      for (const s of strands) {
        const e = s.start + s.n, k = BEND[s.kind];
        for (let i = s.start; i < e - 1; i++) if (link[i]) constrain(i, i + 1, rest[i], 1, s.anchored && i === s.start);
        for (let i = s.start; i < e - 2; i++) if (link[i] && link[i + 1]) constrain(i, i + 2, bendRest[i], k, s.anchored && i === s.start);
      }
    }
    for (const s of strands) {
      for (let i = s.start; i < s.start + s.n; i++) if (!(s.anchored && i === s.start)) keep(nx, ny, i, HALF[s.kind], s.kind === KIND.TUBULE && i < s.start + 2);
    }
    for (let i = 0; i < G; i++) {
      carry(gx, gy, gpx, gpy, i, 0.7, gkind[i] === 0 ? 0.0025 : 0.0012, dt);
      keep(gx, gy, i, gsize[i] * 0.4, false);
    }
    // dead, the strands fall apart
    if (d >= 0) {
      const ramp = Math.min(1, d / 6);
      for (let i = 0; i < NN; i++) if (link[i] && rand() < DECAY[nkind[i]] * ramp * dt) link[i] = 0;
    }
  }

  return { NN, nx, ny, nkind, link, strands, centro, G, gx, gy, gkind, gsize, step };
}

function wrap(a) { return a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI; }
