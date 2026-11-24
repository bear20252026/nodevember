// node tools/spring-search.mjs [seeds=300] [out=public/spring.json]
// The resonant swinging spring (elastic pendulum near 2:1, Lynch & Houghton): bouncing turns into swinging and
// back, and the swing plane steps round between episodes. Looks for orbits that come back turned by a whole
// fraction of a turn, x(T) = R(2 pi k / q) x(0), so q of them make an exactly periodic motion.
import fs from "node:fs";

const P = { L: 1.0, g: 9.81 }; // L: length at rest under the weight
const W = Math.sqrt(P.g / P.L); // swing
const K = 4 * W * W; // spring per unit mass: bounce at twice the swing frequency
const L0 = P.L - P.g / K; // unstretched
const [seeds = "300", out = "public/spring.json"] = process.argv.slice(2);

function accel(s, a) {
  const r = Math.hypot(s[0], s[1], s[2]);
  const f = -K * (r - L0) / r;
  a[0] = s[3];
  a[1] = s[4];
  a[2] = s[5];
  a[3] = f * s[0];
  a[4] = f * s[1] - P.g;
  a[5] = f * s[2];
}
const k1 = new Float64Array(6), k2 = new Float64Array(6), k3 = new Float64Array(6), k4 = new Float64Array(6), tmp = new Float64Array(6);
function step(s, h) {
  accel(s, k1);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + (h / 2) * k1[i];
  accel(tmp, k2);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + (h / 2) * k2[i];
  accel(tmp, k3);
  for (let i = 0; i < 6; i++) tmp[i] = s[i] + h * k3[i];
  accel(tmp, k4);
  for (let i = 0; i < 6; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
const H = 1 / 800;
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
const turn = (s, a) => {
  const c = Math.cos(a), sn = Math.sin(a);
  return Float64Array.from([c * s[0] + sn * s[2], s[1], -sn * s[0] + c * s[2], c * s[3] + sn * s[5], s[4], -sn * s[3] + c * s[5]]);
};
// unknowns: x0 (on the x axis), y0, vx, vy, vz, T
const start = (p) => Float64Array.from([p[0], p[1], 0, p[2], p[3], p[4]]);
function residual(z, angle) {
  const s0 = start(z);
  const s1 = flow(s0, z[5]);
  const r0 = turn(s0, angle);
  return Array.from(s1, (v, i) => (v - r0[i]) * (i < 3 ? 1 : 0.2));
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
function close(z0, angle) {
  let z = z0.slice();
  let F = residual(z, angle);
  let f = norm(F);
  let mu = 1e-3;
  for (let it = 0; it < 50 && f > 1e-10; it++) {
    const J = [];
    for (let j = 0; j < 6; j++) {
      const zp = z.slice();
      zp[j] += 1e-6;
      J.push(residual(zp, angle).map((v, i) => (v - F[i]) / 1e-6));
    }
    const A = Array.from({ length: 6 }, (_, a) => Array.from({ length: 6 }, (_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0) + (a === b ? mu : 0)));
    const g = J.map((col) => -col.reduce((s, v, i) => s + v * F[i], 0));
    const d = solveLinear(A, g);
    const zn = z.map((v, i) => v + d[i]);
    if (!(zn[5] > 1)) {
      mu *= 10;
      continue;
    }
    const Fn = residual(zn, angle);
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

const fractions = [];
for (let q = 1; q <= 6; q++) for (let k = 0; k < q; k++) if (k === 0 ? q === 1 : gcd(k, q) === 1) fractions.push([k, q]);
function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

let rnd = 777;
const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const found = [];
for (let n = 0; n < +seeds; n++) {
  // mostly bouncing, a little swing, a little sideways push (that is what makes the plane step round)
  const p = [0.02 + random() * 0.2, -P.L - (0.1 + random() * 0.3), 0, 0, (random() - 0.5) * 0.4];
  const s0 = start(p);
  const targets = fractions.map(([k, q]) => ({ k, q, r: turn(s0, (2 * Math.PI * k) / q), best: { t: 0, e: Infinity }, prev: [Infinity, Infinity] }));
  flow(s0, 25, (s, t) => {
    if (t < 4) return;
    for (const c of targets) {
      let e = 0;
      for (let i = 0; i < 6; i++) e += (s[i] - c.r[i]) ** 2 * (i < 3 ? 1 : 0.04);
      e = Math.sqrt(e);
      if (c.prev[0] < c.prev[1] && c.prev[0] < e && c.prev[0] < c.best.e) c.best = { t: t - H, e: c.prev[0] };
      c.prev = [e, c.prev[0]];
    }
  });
  targets.sort((a, b) => a.best.e - b.best.e);
  for (const c of targets.slice(0, 2)) {
    if (c.best.e > 0.05) continue;
    const angle = (2 * Math.PI * c.k) / c.q;
    const { z, f } = close([...p, c.best.t], angle);
    if (f < 1e-8) {
      // how much it trades: the least and most swing over the orbit
      let lo = Infinity, hi = 0, ylo = Infinity, yhi = -Infinity;
      flow(start(z), z[5], (s) => {
        const h = Math.hypot(s[0], s[2]);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
        ylo = Math.min(ylo, s[1]);
        yhi = Math.max(yhi, s[1]);
      });
      found.push({ z, T: z[5], k: c.k, q: c.q, angle, f, swingMin: lo, swingMax: hi, bounce: yhi - ylo });
      console.log(`#${found.length} seed ${n}: T ${z[5].toFixed(3)} turn ${c.k}/${c.q}, loop ${(z[5] * c.q).toFixed(2)} s, swing ${lo.toFixed(3)}..${hi.toFixed(3)}, bounce ${(yhi - ylo).toFixed(3)}, residual ${f.toExponential(1)}`);
      break;
    }
  }
}
const baked = found.map((o) => {
  const n = Math.max(600, Math.round(o.T * 240));
  const r = [];
  const s0 = start(o.z);
  r.push(...Array.from(s0.slice(0, 3), (v) => +v.toFixed(6)));
  const s = Float64Array.from(s0);
  const sub = Math.ceil(o.T / n / H);
  const h = o.T / n / sub;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < sub; j++) step(s, h);
    r.push(...Array.from(s.slice(0, 3), (v) => +v.toFixed(6)));
  }
  return { T: o.T, k: o.k, q: o.q, angle: o.angle, swingMin: o.swingMin, swingMax: o.swingMax, bounce: o.bounce, samples: n, r };
});
fs.writeFileSync(out, JSON.stringify({ params: { ...P, L0 }, orbits: baked }));
console.log(`${out}: ${baked.length} orbits`);
