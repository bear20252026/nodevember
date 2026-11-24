// node tools/orbit-search.mjs [seeds=400] [out=public/orbit.json]
// Finds relative periodic orbits of the double spherical pendulum: after a time T the whole state comes back
// turned by dphi about the vertical, x(T) = R(dphi) x(0). Random starts are integrated, near returns of the state
// with the turn about the vertical taken out become seeds, and Levenberg-Marquardt shooting closes them.
import fs from "node:fs";

const P = { l1: 1.0, l2: 0.85, m1: 1.3, m2: 1.0, g: 9.81 };
const [seeds = "400", out = "public/orbit.json"] = process.argv.slice(2);

// state: r1 (3), r2 (3), v1 (3), v2 (3); y is up, the pivot at the origin
function accel(s, a) {
  const { l1, l2, m1, m2, g } = P;
  const u1 = [s[0] / l1, s[1] / l1, s[2] / l1];
  const u2 = [(s[3] - s[0]) / l2, (s[4] - s[1]) / l2, (s[5] - s[2]) / l2];
  const c = u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2];
  const v1sq = s[6] ** 2 + s[7] ** 2 + s[8] ** 2;
  const dv = [s[9] - s[6], s[10] - s[7], s[11] - s[8]];
  const dvsq = dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2;
  const u1g = -g * u1[1];
  // rods' tensions T1, T2 from the constraints' second derivatives (plus a little Baumgarte pull back)
  const C1 = (s[0] ** 2 + s[1] ** 2 + s[2] ** 2 - l1 * l1) / (2 * l1);
  const C2 = ((s[3] - s[0]) ** 2 + (s[4] - s[1]) ** 2 + (s[5] - s[2]) ** 2 - l2 * l2) / (2 * l2);
  const D1 = (s[0] * s[6] + s[1] * s[7] + s[2] * s[8]) / l1;
  const D2 = ((s[3] - s[0]) * dv[0] + (s[4] - s[1]) * dv[1] + (s[5] - s[2]) * dv[2]) / l2;
  const k = 20;
  const b1 = -v1sq / l1 - u1g - 2 * k * D1 - k * k * C1;
  const b2 = -dvsq / l2 - 2 * k * D2 - k * k * C2;
  // [-1/m1, c/m1; c/m1, -(1/m1 + 1/m2)] [T1 T2] = [b1 b2]
  const a11 = -1 / m1;
  const a12 = c / m1;
  const a22 = -(1 / m1 + 1 / m2);
  const det = a11 * a22 - a12 * a12;
  const T1 = (b1 * a22 - a12 * b2) / det;
  const T2 = (a11 * b2 - a12 * b1) / det;
  for (let i = 0; i < 3; i++) {
    const gi = i === 1 ? -g : 0;
    a[i] = s[6 + i];
    a[3 + i] = s[9 + i];
    a[6 + i] = gi - (T1 / m1) * u1[i] + (T2 / m1) * u2[i];
    a[9 + i] = gi - (T2 / m2) * u2[i];
  }
}

const k1 = new Float64Array(12), k2 = new Float64Array(12), k3 = new Float64Array(12), k4 = new Float64Array(12), tmp = new Float64Array(12);
function step(s, h) {
  accel(s, k1);
  for (let i = 0; i < 12; i++) tmp[i] = s[i] + (h / 2) * k1[i];
  accel(tmp, k2);
  for (let i = 0; i < 12; i++) tmp[i] = s[i] + (h / 2) * k2[i];
  accel(tmp, k3);
  for (let i = 0; i < 12; i++) tmp[i] = s[i] + h * k3[i];
  accel(tmp, k4);
  for (let i = 0; i < 12; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
const H = 1 / 1200;
function flow(s0, T, each) {
  const s = Float64Array.from(s0);
  const n = Math.max(1, Math.round(T / H));
  const h = T / n;
  for (let i = 0; i < n; i++) {
    step(s, h);
    if (each) each(s, (i + 1) * h);
  }
  return s;
}

// a start from 7 numbers: bob 1 polar angle (azimuth 0), bob 2's direction, and their velocities in the planes
// across their rods
function start(p) {
  const [th1, th2, ph2, w1a, w1b, w2a, w2b] = p;
  const { l1, l2 } = P;
  const u1 = [Math.sin(th1), -Math.cos(th1), 0];
  const u2 = [Math.sin(th2) * Math.cos(ph2), -Math.cos(th2), Math.sin(th2) * Math.sin(ph2)];
  // tangent frames: e_theta, e_phi
  const e1a = [Math.cos(th1), Math.sin(th1), 0];
  const e1b = [0, 0, 1];
  const e2a = [Math.cos(th2) * Math.cos(ph2), Math.sin(th2), Math.cos(th2) * Math.sin(ph2)];
  const e2b = [-Math.sin(ph2), 0, Math.cos(ph2)];
  const s = new Float64Array(12);
  for (let i = 0; i < 3; i++) {
    s[i] = l1 * u1[i];
    s[3 + i] = s[i] + l2 * u2[i];
    s[6 + i] = l1 * (w1a * e1a[i] + w1b * e1b[i]);
    s[9 + i] = s[6 + i] + l2 * (w2a * e2a[i] + w2b * e2b[i]);
  }
  return s;
}
const turn = (s, a) => {
  const c = Math.cos(a), sn = Math.sin(a), o = new Float64Array(12);
  for (let b = 0; b < 4; b++) {
    const x = s[3 * b], y = s[3 * b + 1], z = s[3 * b + 2];
    // rotation about +y by a: x' = c x + s z, z' = -s x + c z
    o[3 * b] = c * x + sn * z;
    o[3 * b + 1] = y;
    o[3 * b + 2] = -sn * x + c * z;
  }
  return o;
};
const azimuth = (s) => Math.atan2(-s[2], s[0]); // turn(s, a) adds a to it; turn(s, -azimuth) brings bob 1 to z = 0, x > 0
const reduce = (s) => turn(s, -azimuth(s));
const energy = (s) => {
  const { m1, m2, g } = P;
  return 0.5 * m1 * (s[6] ** 2 + s[7] ** 2 + s[8] ** 2) + 0.5 * m2 * (s[9] ** 2 + s[10] ** 2 + s[11] ** 2) + g * (m1 * s[1] + m2 * s[4]);
};
const Ly = (s) => P.m1 * (s[2] * s[6] - s[0] * s[8]) + P.m2 * (s[5] * s[9] - s[3] * s[11]);

// unknowns z = p (7), T, dphi; residual = flow_T(start(p)) - R(dphi) start(p)
function residual(z) {
  const s0 = start(z.slice(0, 7));
  const s1 = flow(s0, z[7]);
  const r0 = turn(s0, z[8]);
  const scale = [1, 1, 1, 1, 1, 1, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
  return Array.from(s1, (v, i) => (v - r0[i]) * scale[i]);
}
const norm = (r) => Math.sqrt(r.reduce((a, b) => a + b * b, 0));

function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

function close(z0) {
  let z = z0.slice();
  let F = residual(z);
  let f = norm(F);
  let mu = 1e-3;
  for (let it = 0; it < 40 && f > 1e-10; it++) {
    const J = [];
    for (let j = 0; j < 9; j++) {
      const e = 1e-6;
      const zp = z.slice();
      zp[j] += e;
      const Fp = residual(zp);
      J.push(Fp.map((v, i) => (v - F[i]) / e));
    }
    // J[j][i] = dF_i/dz_j; normal equations (J^T J + mu I) d = -J^T F
    const A = Array.from({ length: 9 }, (_, a) => Array.from({ length: 9 }, (_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0) + (a === b ? mu : 0)));
    const g = J.map((col) => -col.reduce((s, v, i) => s + v * F[i], 0));
    const d = solveLinear(A, g);
    const zn = z.map((v, i) => v + d[i]);
    if (!(zn[7] > 0.5)) {
      mu *= 10;
      continue;
    }
    const Fn = residual(zn);
    const fn = norm(Fn);
    if (fn < f) {
      z = zn;
      F = Fn;
      f = fn;
      mu = Math.max(mu / 5, 1e-12);
    } else mu *= 8;
    if (mu > 1e6) break;
  }
  return { z, f };
}

// ---- search
let rnd = 12345;
const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const found = [];
const t0 = Date.now();
for (let k = 0; k < +seeds; k++) {
  const p = [0.5 + random() * 1.4, 0.4 + random() * 2.0, random() * 2 * Math.PI, (random() - 0.5) * 3, 1 + random() * 2.5, (random() - 0.5) * 4, (random() - 0.5) * 5];
  const s0 = start(p);
  const r0 = reduce(s0);
  let last = azimuth(s0);
  let wound = 0;
  const cands = [];
  let prev = [Infinity, Infinity];
  flow(s0, 14, (s, t) => {
    const a = azimuth(s);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    wound += d;
    last = a;
    if (t < 2.5) return;
    const r = reduce(s);
    let e = 0;
    for (let i = 0; i < 12; i++) e += (r[i] - r0[i]) ** 2 * (i < 6 ? 1 : 0.09);
    e = Math.sqrt(e);
    if (prev[0] < prev[1] && prev[0] < e && prev[0] < 0.35) cands.push({ t: t - H, e: prev[0], wound });
    prev = [e, prev[0]];
  });
  cands.sort((a, b) => a.e - b.e);
  for (const c of cands.slice(0, 2)) {
    const z0 = [...p, c.t, c.wound];
    const { z, f } = close(z0);
    if (f < 1e-8) {
      const s = start(z.slice(0, 7));
      found.push({ p: z.slice(0, 7), T: z[7], dphi: z[8], f, E: energy(s), L: Ly(s) });
      console.log(`#${found.length} seed ${k}: T ${z[7].toFixed(4)} dphi ${((z[8] * 180) / Math.PI).toFixed(2)} deg, residual ${f.toExponential(1)}, E ${energy(s).toFixed(3)} L ${Ly(s).toFixed(3)}`);
      break;
    }
  }
  if (k % 25 === 24) console.log(`${k + 1} seeds, ${found.length} orbits, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// bake every orbit found: 1440 samples of both bobs over one period
const baked = found.map((o) => {
  const s0 = start(o.p);
  const n = 1440;
  const pts = [];
  const sample = (s) => pts.push(...Array.from(s.slice(0, 6), (v) => +v.toFixed(6)));
  sample(s0);
  const s = Float64Array.from(s0);
  const sub = Math.ceil(o.T / n / H);
  const h = o.T / n / sub;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < sub; j++) step(s, h);
    if (i < n - 1) sample(s);
  }
  return { ...o, samples: n, r: pts };
});
fs.writeFileSync(out, JSON.stringify({ params: P, orbits: baked }));
console.log(`${out}: ${baked.length} orbits`);
