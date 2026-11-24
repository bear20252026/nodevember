// node tools/chain-search.mjs [seeds=200] [out=public/triple.json] [rng=1] [maxT=9] [energy=0.25,1.15]
// Relative periodic orbits of a spherical pendulum chain (N bobs on rigid rods; three here): after a time T the
// whole state comes back turned by dphi about the vertical, x(T) = R(dphi) x(0). Same recipe as orbit-search.mjs:
// random starts, near returns (the turn about the vertical taken out) as seeds, Levenberg-Marquardt shooting.
// The rods' tensions come from a tridiagonal system: rod i only meets rods i-1 and i+1.
import fs from "node:fs";

const P = { l: [0.9, 0.75, 0.6], m: [1.3, 1.0, 0.75], g: 9.81 };
const N = P.l.length;
const D = 6 * N; // state: positions (3N), velocities (3N); y up, the pivot at the origin
const [seeds = "200", out = "public/triple.json", rng = "1", maxT = "9", band = "0.25,1.15"] = process.argv.slice(2);
const [eLo, eHi] = band.split(",").map(Number);

const u = Array.from({ length: N }, () => [0, 0, 0]);
const tau = new Float64Array(N);
function accel(s, a) {
  const { l, m, g } = P;
  const kB = 20; // Baumgarte pull back onto the rods
  const A = Array.from({ length: N }, () => new Float64Array(N));
  const b = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const d = [0, 0, 0], dv = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      d[c] = s[3 * i + c] - (i ? s[3 * (i - 1) + c] : 0);
      dv[c] = s[3 * N + 3 * i + c] - (i ? s[3 * N + 3 * (i - 1) + c] : 0);
    }
    for (let c = 0; c < 3; c++) u[i][c] = d[c] / l[i];
    const C = (d[0] ** 2 + d[1] ** 2 + d[2] ** 2 - l[i] ** 2) / (2 * l[i]);
    const Dd = (d[0] * dv[0] + d[1] * dv[1] + d[2] * dv[2]) / l[i];
    b[i] = -(dv[0] ** 2 + dv[1] ** 2 + dv[2] ** 2) / l[i] - 2 * kB * Dd - kB * kB * C;
  }
  b[0] -= -g * u[0][1]; // the first rod's far end is fixed: gravity stays in its balance
  for (let i = 0; i < N; i++) {
    A[i][i] = -(1 / m[i] + (i ? 1 / m[i - 1] : 0));
    if (i + 1 < N) A[i][i + 1] = (u[i][0] * u[i + 1][0] + u[i][1] * u[i + 1][1] + u[i][2] * u[i + 1][2]) / m[i];
    if (i > 0) A[i][i - 1] = (u[i][0] * u[i - 1][0] + u[i][1] * u[i - 1][1] + u[i][2] * u[i - 1][2]) / m[i - 1];
  }
  // tridiagonal solve (Thomas)
  const cp = new Float64Array(N), dp = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const lo = i ? A[i][i - 1] : 0;
    const den = A[i][i] - (i ? lo * cp[i - 1] : 0);
    cp[i] = i + 1 < N ? A[i][i + 1] / den : 0;
    dp[i] = (b[i] - (i ? lo * dp[i - 1] : 0)) / den;
  }
  for (let i = N - 1; i >= 0; i--) tau[i] = dp[i] - (i + 1 < N ? cp[i] * tau[i + 1] : 0);
  for (let i = 0; i < N; i++)
    for (let c = 0; c < 3; c++) {
      a[3 * i + c] = s[3 * N + 3 * i + c];
      a[3 * N + 3 * i + c] = (c === 1 ? -g : 0) + (-tau[i] * u[i][c] + (i + 1 < N ? tau[i + 1] * u[i + 1][c] : 0)) / m[i];
    }
}

const k1 = new Float64Array(D), k2 = new Float64Array(D), k3 = new Float64Array(D), k4 = new Float64Array(D), tmp = new Float64Array(D);
function step(s, h) {
  accel(s, k1);
  for (let i = 0; i < D; i++) tmp[i] = s[i] + (h / 2) * k1[i];
  accel(tmp, k2);
  for (let i = 0; i < D; i++) tmp[i] = s[i] + (h / 2) * k2[i];
  accel(tmp, k3);
  for (let i = 0; i < D; i++) tmp[i] = s[i] + h * k3[i];
  accel(tmp, k4);
  for (let i = 0; i < D; i++) s[i] += (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
}
const H = 1 / 1500;
function flow(s0, T, each) {
  const s = Float64Array.from(s0);
  const n = Math.max(1, Math.round(T / H));
  const h = T / n;
  for (let i = 0; i < n; i++) {
    step(s, h);
    if (each && each(s, (i + 1) * h) === false) break;
  }
  return s;
}

// a start: bob 1's polar angle (azimuth 0), (polar, azimuth) of each later rod, two velocities across every rod
const NP = 1 + 2 * (N - 1) + 2 * N;
function start(p) {
  const s = new Float64Array(D);
  let q = 0;
  const prev = [0, 0, 0], vprev = [0, 0, 0];
  for (let i = 0; i < N; i++) {
    const th = p[q++];
    const ph = i ? p[q++] : 0;
    const dir = [Math.sin(th) * Math.cos(ph), -Math.cos(th), Math.sin(th) * Math.sin(ph)];
    const ea = [Math.cos(th) * Math.cos(ph), Math.sin(th), Math.cos(th) * Math.sin(ph)];
    const eb = [-Math.sin(ph), 0, Math.cos(ph)];
    const wa = p[NP - 2 * N + 2 * i], wb = p[NP - 2 * N + 2 * i + 1];
    for (let c = 0; c < 3; c++) {
      s[3 * i + c] = prev[c] + P.l[i] * dir[c];
      s[3 * N + 3 * i + c] = vprev[c] + P.l[i] * (wa * ea[c] + wb * eb[c]);
      prev[c] = s[3 * i + c];
      vprev[c] = s[3 * N + 3 * i + c];
    }
  }
  return s;
}
const turn = (s, a) => {
  const c = Math.cos(a), sn = Math.sin(a), o = new Float64Array(D);
  for (let b = 0; b < 2 * N; b++) {
    const x = s[3 * b], y = s[3 * b + 1], z = s[3 * b + 2];
    o[3 * b] = c * x + sn * z;
    o[3 * b + 1] = y;
    o[3 * b + 2] = -sn * x + c * z;
  }
  return o;
};
const azimuth = (s) => Math.atan2(-s[2], s[0]);
const reduce = (s) => turn(s, -azimuth(s));
const energy = (s) => {
  let e = 0;
  for (let i = 0; i < N; i++) {
    const v = s.slice(3 * N + 3 * i, 3 * N + 3 * i + 3);
    e += 0.5 * P.m[i] * (v[0] ** 2 + v[1] ** 2 + v[2] ** 2) + P.m[i] * P.g * s[3 * i + 1];
  }
  return e;
};
const VW = 0.3; // velocities count less than positions in the residual
function residual(z) {
  const s0 = start(z.slice(0, NP));
  const s1 = flow(s0, z[NP]);
  const r0 = turn(s0, z[NP + 1]);
  return Array.from(s1, (v, i) => (v - r0[i]) * (i < 3 * N ? 1 : VW));
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
  const nz = z0.length;
  let z = z0.slice();
  let F = residual(z);
  let f = norm(F);
  let mu = 1e-3;
  for (let it = 0; it < 40 && f > 1e-10; it++) {
    const J = [];
    for (let j = 0; j < nz; j++) {
      const zp = z.slice();
      zp[j] += 1e-6;
      J.push(residual(zp).map((v, i) => (v - F[i]) / 1e-6));
    }
    const A = Array.from({ length: nz }, (_, a) => Array.from({ length: nz }, (_, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0) + (a === b ? mu : 0)));
    const g = J.map((col) => -col.reduce((s, v, i) => s + v * F[i], 0));
    const d = solveLinear(A, g);
    const zn = z.map((v, i) => v + d[i]);
    if (!(zn[NP] > 0.5)) {
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
    if (mu > 1e6 || (it > 12 && f > 1e-2)) break; // not getting there
  }
  return { z, f };
}

const found = [];
if (process.env.FROM) {
  // continuation: FROM=file.json:index pumps an orbit's speeds up step by step, closing it again each time, so a
  // gentle orbit grows into a wild one along its family (random starts that wild almost never come back near)
  const [file, idx] = process.env.FROM.split(":");
  const o = JSON.parse(fs.readFileSync(file)).orbits[+idx];
  let z = [...o.p, o.T, o.dphi];
  let gain = 1.04;
  for (let k = 0; k < +seeds && gain > 1.002; k++) {
    const zt = z.map((v, i) => (i >= NP - 2 * N && i < NP ? v * gain : v));
    const { z: zc, f } = close(zt);
    if (f < 1e-8 && zc[NP] < 14) {
      z = zc;
      const s = start(z.slice(0, NP));
      found.push({ p: z.slice(0, NP), T: z[NP], dphi: z[NP + 1], f, E: energy(s) });
      console.log(`#${found.length} step ${k}: T ${z[NP].toFixed(4)} dphi ${((z[NP + 1] * 180) / Math.PI).toFixed(1)} deg, E ${energy(s).toFixed(2)}, gain ${gain.toFixed(3)}`);
      gain = 1 + (gain - 1) * 1.3;
    } else gain = 1 + (gain - 1) / 2;
  }
} else {
let rnd = (+rng * 7919) % 2147483648;
const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
const t0 = Date.now();
for (let k = 0; k < +seeds; k++) {
  // energies from gentle to wild: a scale on every angle and speed
  const e = eLo + random() * (eHi - eLo);
  const p = [];
  p.push(e * (0.3 + random() * 1.6));
  for (let i = 1; i < N; i++) p.push(e * (0.2 + random() * 2.2), random() * 2 * Math.PI);
  for (let i = 0; i < N; i++) p.push(e * (random() - 0.5) * 4, e * (0.5 + random() * 3) * (i ? (random() < 0.5 ? -1 : 1) : 1));
  const s0 = start(p);
  const r0 = reduce(s0);
  let last = azimuth(s0);
  let wound = 0;
  const cands = [];
  let prev = [Infinity, Infinity];
  flow(s0, +maxT, (s, t) => {
    const a = azimuth(s);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    wound += d;
    last = a;
    if (t < 2) return;
    const r = reduce(s);
    let err = 0;
    for (let i = 0; i < D; i++) err += (r[i] - r0[i]) ** 2 * (i < 3 * N ? 1 : VW * VW);
    err = Math.sqrt(err);
    if (prev[0] < prev[1] && prev[0] < err && prev[0] < 0.45) cands.push({ t: t - H, e: prev[0], wound });
    prev = [err, prev[0]];
  });
  cands.sort((a, b) => a.e - b.e);
  for (const c of cands.slice(0, 3)) {
    const { z, f } = close([...p, c.t, c.wound]);
    if (f < 1e-8) {
      const s = start(z.slice(0, NP));
      found.push({ p: z.slice(0, NP), T: z[NP], dphi: z[NP + 1], f, E: energy(s) });
      console.log(`#${found.length} seed ${k}: T ${z[NP].toFixed(4)} dphi ${((z[NP + 1] * 180) / Math.PI).toFixed(1)} deg, residual ${f.toExponential(1)}, E ${energy(s).toFixed(2)}`);
      break;
    }
  }
  if (k % 20 === 19) console.log(`${k + 1} seeds, ${found.length} orbits, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

}

const baked = found.map((o) => {
  const s0 = start(o.p);
  const n = 1800;
  const pts = [];
  const sample = (s) => pts.push(...Array.from(s.slice(0, 3 * N), (v) => +v.toFixed(6)));
  sample(s0);
  const s = Float64Array.from(s0);
  const sub = Math.ceil(o.T / n / H);
  const h = o.T / n / sub;
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < sub; j++) step(s, h);
    sample(s);
  }
  return { ...o, samples: n, r: pts };
});
fs.writeFileSync(out, JSON.stringify({ params: { ...P, n: N }, orbits: baked }));
console.log(`${out}: ${baked.length} orbits`);
