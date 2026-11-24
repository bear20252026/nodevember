import "../lib/modulepreload-polyfill.js";
import { s as Jn } from "../lib/studio-presets.js";
import {
  u as S,
  W as Yn,
  D as Lt,
  s as j,
  X as Zo,
  g as h,
  B as Qt,
  F as te,
  A as U,
  y as I,
  Z as E,
  ab as Ca,
  ac as be,
  C as qa,
  b as x,
  f as jt,
  ad as Xn,
  ae as Mt,
  Y as se,
  n as q,
  T as Ce,
  af as fe,
  z as Dt,
  m as W,
  ag as Ra,
  J as le,
  ah as _,
  c as st,
  N as Za,
  S as Le,
  e as We,
  a0 as oa,
  Q as Se,
  x as ma,
  O as Kn,
  H as Re,
  q as me,
  E as Jt,
  I as _a,
  p as Zn,
  k as _n,
  R as $n,
  l as Qn,
  a7 as ts,
  G as _o,
  w as es,
  j as as,
  ai as os,
} from "../lib/stage.js";
import {
  aH as ns,
  S as ss,
  P as ls,
  V as lt,
  C as Na,
  aI as us,
  aJ as rs,
  aK as cs,
  E as $o,
  aL as Ie,
  B as Qo,
  t as tn,
  aM as go,
  M as Fa,
  f as en,
  ar as is,
  aN as la,
  a as ka,
  q as de,
  ap as Pa,
  c as ms,
  r as ca,
  L as ds,
  d as hs,
  ai as fs,
  F as Fo,
  az as ps,
  aO as vs,
  u as ys,
  g as ia,
  aF as Ms,
} from "../lib/leva.js";
import { d as xs } from "../lib/DepthOfFieldNode.js";
import { O as gs } from "../lib/OrbitControls.js";
import { r as ws } from "../lib/rendering-panel.js";
import "../lib/three.js";
const Te = -0.95,
  ee = Ye([-0.44, 0.66, -0.6]);
function Ye(t) {
  const e = Math.hypot(t[0], t[1], t[2]);
  return [t[0] / e, t[1] / e, t[2] / e];
}
const Va = (t, e, a) => {
  const n = Math.min(1, Math.max(0, (a - t) / (e - t)));
  return n * n * (3 - 2 * n);
};
function Et(t, e, a, n = 0) {
  let o =
    Math.imul(t, 374761393) +
    Math.imul(e, 668265263) +
    Math.imul(a, 2147483629) +
    Math.imul(n, 1013904223);
  return (
    (o = Math.imul(o ^ (o >>> 13), 1274126177)),
    ((o ^ (o >>> 16)) >>> 0) / 4294967296
  );
}
function ae(t, e, a) {
  const n = Math.floor(t),
    o = Math.floor(e),
    s = Math.floor(a),
    l = t - n,
    r = e - o,
    u = a - s,
    c = l * l * (3 - 2 * l),
    p = r * r * (3 - 2 * r),
    i = u * u * (3 - 2 * u),
    m = (f, v, D) => f + (v - f) * D;
  return m(
    m(
      m(Et(n, o, s), Et(n + 1, o, s), c),
      m(Et(n, o + 1, s), Et(n + 1, o + 1, s), c),
      p,
    ),
    m(
      m(Et(n, o, s + 1), Et(n + 1, o, s + 1), c),
      m(Et(n, o + 1, s + 1), Et(n + 1, o + 1, s + 1), c),
      p,
    ),
    i,
  );
}
const Ve = new Float64Array(4);
function $a(t, e, a, n) {
  const o = t / n,
    s = e / n,
    l = a / n,
    r = Math.floor(o),
    u = Math.floor(s),
    c = Math.floor(l);
  let p = 1e9;
  for (let i = -1; i <= 1; i++)
    for (let m = -1; m <= 1; m++)
      for (let f = -1; f <= 1; f++) {
        const v = r + i,
          D = u + m,
          O = c + f,
          K = v + Et(v, D, O, 1),
          X = D + Et(v, D, O, 2),
          P = O + Et(v, D, O, 3),
          C = (K - o) ** 2 + (X - s) ** 2 + (P - l) ** 2;
        C < p && ((p = C), (Ve[0] = K * n), (Ve[1] = X * n), (Ve[2] = P * n));
      }
  return ((Ve[3] = Math.sqrt(p) * n), Ve);
}
function bs(t, e, a) {
  const o =
      1.6 *
      (1 +
        0.16 * (ae(t * 1.5 + 7, e * 1.5, a * 1.5 + 3) - 0.5) +
        0.07 * (ae(t * 3.4, e * 3.4 + 9, a * 3.4) - 0.5)),
    s = 0.68,
    l = 3,
    r = Math.hypot(t, a);
  let u = Math.pow(Math.pow(r / o, l) + Math.pow(Math.abs(e) / s, l), -1 / l);
  const c = t * u,
    p = e * u,
    i = a * u,
    m = $a(c, p, i, 0.62)[3],
    f = 1 - Math.min(1, (m / 0.5) ** 2),
    v = $a(c + 11, p, i, 0.27)[3],
    D = 1 - Math.min(1, (v / 0.22) ** 2);
  return (
    (u += 0.13 * f + 0.05 * D + 0.07 * (ae(c * 2.2, p * 2.2, i * 2.2) - 0.5)),
    e < 0 && (u = Math.min(u, Te / e)),
    u
  );
}
function zs(t) {
  const n = new Float32Array(524288);
  for (let d = 0; d < 512; d++) {
    const y = ((d + 0.5) / 512) * Math.PI,
      A = Math.sin(y),
      b = Math.cos(y);
    for (let N = 0; N < 1024; N++) {
      const R = ((N + 0.5) / 1024) * 2 * Math.PI;
      n[d * 1024 + N] = bs(A * Math.cos(R), b, A * Math.sin(R));
    }
  }
  const o = (d, y, A, b = Math.hypot(d, y, A)) => {
      const N = ((Math.atan2(A, d) / (2 * Math.PI) + 1) % 1) * 1024 - 0.5,
        R = (Math.acos(Math.max(-1, Math.min(1, y / b))) / Math.PI) * 512 - 0.5,
        M = Math.floor(N),
        F = Math.max(0, Math.min(510, Math.floor(R))),
        T = N - M,
        et = Math.max(0, Math.min(1, R - F)),
        pt = (M + 1024) % 1024,
        zt = (M + 1) % 1024,
        At = n[F * 1024 + pt] * (1 - T) + n[F * 1024 + zt] * T,
        $ = n[(F + 1) * 1024 + pt] * (1 - T) + n[(F + 1) * 1024 + zt] * T;
      return At * (1 - et) + $ * et;
    },
    s = 512,
    l = 256,
    r = new Float32Array(s * l * 5),
    u = 0.012,
    c = (d, y, A) => {
      const b = o(d, y, A, 1);
      return [d * b, y * b, A * b];
    },
    p = [];
  for (let d = 0; d < 10; d++) {
    const y = (d + 0.5) / 10,
      A = d * 2.399963,
      b = Math.sqrt(1 - y * y);
    p.push([b * Math.cos(A), y, b * Math.sin(A)]);
  }
  for (let d = 0; d < l; d++) {
    const y = ((d + 0.5) / l) * Math.PI,
      A = Math.sin(y),
      b = Math.cos(y);
    for (let N = 0; N < s; N++) {
      const R = ((N + 0.5) / s) * 2 * Math.PI,
        M = [A * Math.cos(R), b, A * Math.sin(R)],
        F = c(M[0], M[1], M[2]),
        T = Ye([-M[2] + 1e-4, 0, M[0]]),
        et = [
          M[1] * T[2] - M[2] * T[1],
          M[2] * T[0] - M[0] * T[2],
          M[0] * T[1] - M[1] * T[0],
        ],
        pt = (Z, bt) => {
          const Kt = Ye([
            M[0] + T[0] * Z + et[0] * bt,
            M[1] + T[1] * Z + et[1] * bt,
            M[2] + T[2] * Z + et[2] * bt,
          ]);
          return c(Kt[0], Kt[1], Kt[2]);
        },
        zt = pt(u, 0),
        At = pt(0, u),
        $ = [zt[0] - F[0], zt[1] - F[1], zt[2] - F[2]],
        Wt = [At[0] - F[0], At[1] - F[1], At[2] - F[2]];
      let L = Ye([
        $[1] * Wt[2] - $[2] * Wt[1],
        $[2] * Wt[0] - $[0] * Wt[2],
        $[0] * Wt[1] - $[1] * Wt[0],
      ]);
      L[0] * M[0] + L[1] * M[1] + L[2] * M[2] < 0 &&
        (L = [-L[0], -L[1], -L[2]]);
      const St = (Z, bt, Kt, ze) => {
        let ue = 1;
        for (let Zt = 1; Zt <= bt; Zt++) {
          const yt = (Zt / bt) ** 1.5 * Kt,
            Ae = F[0] + L[0] * 0.03 + Z[0] * yt,
            He = F[1] + L[1] * 0.03 + Z[1] * yt,
            Pt = F[2] + L[2] * 0.03 + Z[2] * yt,
            je = Math.hypot(Ae, He, Pt),
            qe = o(Ae, He, Pt, je) - je;
          qe > 0 &&
            (ue = Math.min(ue, 1 - Math.min(1, qe / (yt * ze + 0.012))));
        }
        return ue;
      };
      let dt = 0,
        wt = 0;
      const Q = Ye([L[1] + 0.01, -L[0], 0.13]),
        vt = [
          L[1] * Q[2] - L[2] * Q[1],
          L[2] * Q[0] - L[0] * Q[2],
          L[0] * Q[1] - L[1] * Q[0],
        ];
      for (const Z of p) {
        const bt = [
          Q[0] * Z[0] + L[0] * Z[1] + vt[0] * Z[2],
          Q[1] * Z[0] + L[1] * Z[1] + vt[1] * Z[2],
          Q[2] * Z[0] + L[2] * Z[1] + vt[2] * Z[2],
        ];
        ((dt += St(bt, 4, 0.55, 0.5) * Z[1]), (wt += Z[1]));
      }
      const kt = Va(0, 0.5, F[1] - Te) * 0.65 + 0.35,
        Vt = (d * s + N) * 5;
      ((r[Vt] = L[0]),
        (r[Vt + 1] = L[1]),
        (r[Vt + 2] = L[2]),
        (r[Vt + 3] = (dt / wt) * kt),
        (r[Vt + 4] = Math.max(0.12, St(ee, 14, 2.2, 1.1))));
    }
  }
  const i = (d, y, A, b, N) => {
      const R = ((Math.atan2(A, d) / (2 * Math.PI) + 1) % 1) * s - 0.5,
        M = (Math.acos(y / b) / Math.PI) * l - 0.5,
        F = Math.floor(R),
        T = Math.max(0, Math.min(l - 2, Math.floor(M))),
        et = R - F,
        pt = Math.max(0, Math.min(1, M - T)),
        zt = (F + s) % s,
        At = (F + 1) % s;
      for (let $ = 0; $ < 5; $++)
        N[$] =
          (r[(T * s + zt) * 5 + $] * (1 - et) + r[(T * s + At) * 5 + $] * et) *
            (1 - pt) +
          (r[((T + 1) * s + zt) * 5 + $] * (1 - et) +
            r[((T + 1) * s + At) * 5 + $] * et) *
            pt;
      return N;
    },
    m = new Float32Array(5);
  let f = 12345;
  const v = () => {
      f = (f + 1831565813) | 0;
      let d = Math.imul(f ^ (f >>> 15), 1 | f);
      return (
        (d = (d + Math.imul(d ^ (d >>> 7), 61 | d)) ^ d),
        ((d ^ (d >>> 14)) >>> 0) / 4294967296
      );
    },
    D = 0.05,
    O = 2.1,
    K = (d, y, A = -2) => {
      const b = new Float32Array(d * 3),
        N = new Float32Array(d * 3),
        R = new Float32Array(d * 3),
        M = new Float32Array(d * 3),
        F = new Float32Array(d * 4);
      let T = 0;
      for (; T < d; ) {
        const et = v() * 2 - 1,
          pt = v() * 2 * Math.PI,
          zt = Math.sqrt(1 - et * et),
          At = zt * Math.cos(pt),
          $ = et,
          Wt = zt * Math.sin(pt),
          L = o(At, $, Wt, 1),
          St = At * L,
          dt = $ * L,
          wt = Wt * L;
        if (dt < Te + 0.004) continue;
        i(St, dt, wt, L, m);
        let Q = m[0],
          vt = m[1],
          kt = m[2];
        const Vt = Math.hypot(Q, vt, kt);
        if (((Q /= Vt), (vt /= Vt), (kt /= Vt), vt < A)) continue;
        const Z = Math.max(0.22, Q * At + vt * $ + kt * Wt);
        if (v() > (L * L) / (O * O) / Z) continue;
        const bt = $a(St, dt, wt, D),
          Kt = bt[0],
          ze = bt[1],
          ue = bt[2],
          Zt = Math.min(1, bt[3] / (D * 0.82)),
          yt = [Kt - St, ze - dt, ue - wt],
          Ae = yt[0] * Q + yt[1] * vt + yt[2] * kt;
        ((yt[0] -= Q * Ae), (yt[1] -= vt * Ae), (yt[2] -= kt * Ae));
        const He = ae(St * 2.3 + 3, dt * 2.3, wt * 2.3 + 8),
          Pt =
            (0.06 + 0.04 * v()) * (1 - 0.5 * Zt * Zt) * (0.78 + 0.5 * He) * y,
          je = ae(St * 1.4 + 20, dt * 1.4, wt * 1.4) - 0.5,
          qe = ae(St * 1.4, dt * 1.4 + 31, wt * 1.4) - 0.5,
          No = ae(St * 1.4, dt * 1.4, wt * 1.4 + 47) - 0.5,
          Ha = je * Q + qe * vt + No * kt,
          ja = 1.5 * Pt,
          Vn = v() - 0.5,
          Gn = v() - 0.5,
          Un = v() - 0.5,
          It = T * 3,
          ra = T * 4;
        ((b[It] = St),
          (b[It + 1] = dt),
          (b[It + 2] = wt),
          (N[It] = Q * Pt + yt[0] * 0.42 + (je - Q * Ha) * ja + Vn * Pt * 0.5),
          (N[It + 1] =
            vt * Pt + yt[1] * 0.42 + (qe - vt * Ha) * ja + Gn * Pt * 0.5),
          (N[It + 2] =
            kt * Pt + yt[2] * 0.42 + (No - kt * Ha) * ja + Un * Pt * 0.5),
          (R[It] = (v() - 0.5) * Pt * 0.5),
          (R[It + 1] = (v() - 0.5) * Pt * 0.5),
          (R[It + 2] = (v() - 0.5) * Pt * 0.5),
          (M[It] = Q),
          (M[It + 1] = vt),
          (M[It + 2] = kt),
          (F[ra] = m[3] * (1 - 0.45 * Zt * Zt)),
          (F[ra + 1] = m[4]),
          (F[ra + 2] =
            Et(Math.floor(Kt * 97), Math.floor(ze * 97), Math.floor(ue * 97)) *
              0.55 +
            v() * 0.2 +
            He * 0.25),
          (F[ra + 3] = Math.min(
            0.999,
            Math.max(
              0,
              0.08 +
                0.55 * (1 - Va(-0.5, 0.75, dt)) +
                0.3 * ae(St * 3, dt * 3, wt * 3) +
                v() * 0.06,
            ),
          )),
          T++);
      }
      return { aRoot: b, aTip: N, aBend: R, aNormal: M, aShade: F, count: d };
    },
    X = K(t.fuzz, 0.72),
    P = K(t.shoots, 1.05),
    C = K(t.stalks, 1, 0.25);
  for (let d = 0; d < C.count; d++) {
    const y = d * 3,
      A = C.aNormal[y],
      b = C.aNormal[y + 1],
      N = C.aNormal[y + 2],
      R = C.aRoot[y],
      M = C.aRoot[y + 2],
      F = Va(0.45, 0.75, ae(R * 1.7 + 40, 5, M * 1.7)),
      T = 0.17 + 0.15 * v(),
      et = 0.34;
    ((C.aTip[y] = A * T + (v() - 0.5) * T * et),
      (C.aTip[y + 1] = b * T + (v() - 0.5) * T * et),
      (C.aTip[y + 2] = N * T + (v() - 0.5) * T * et));
    const pt = v() * 6.283;
    ((C.aBend[y] = Math.cos(pt) * T * 0.12),
      (C.aBend[y + 1] = (v() - 0.5) * T * 0.04),
      (C.aBend[y + 2] = Math.sin(pt) * T * 0.12),
      (C.aShade[d * 4 + 3] = F > 0.25 ? 0.72 + v() * 0.25 : 99));
  }
  const B = (d, y, A, b, N, R, M) => {
      for (const F of ["aRoot", "aTip", "aBend"])
        for (let T = 0; T < 3; T++) A[F][b * 3 + T] = d[F][y * 3 + T];
      ((A.aShade[b * 4] = N),
        (A.aShade[b * 4 + 1] = R),
        (A.aShade[b * 4 + 2] = v()),
        (A.aShade[b * 4 + 3] = M));
    },
    it = (d) => ({
      aRoot: new Float32Array(d * 3),
      aTip: new Float32Array(d * 3),
      aBend: new Float32Array(d * 3),
      aShade: new Float32Array(d * 4),
      count: d,
    }),
    mt = it(t.dew);
  for (let d = 0; d < mt.count; d++) {
    const y = Math.floor(v() * P.count);
    B(P, y, mt, d, 1, 0.0035 + 0.0065 * v() ** 2, 0.9 + v() * 0.08);
  }
  const ot = { ...it(t.beads), aNormal: new Float32Array(t.beads * 3) };
  for (let d = 0; d < ot.count; d++) {
    let y = 0;
    do y = Math.floor(v() * P.count);
    while (P.aNormal[y * 3 + 1] < 0.05);
    B(P, y, ot, d, 1, 0.0035 + 0.0125 * v() ** 2.2, v());
    for (let A = 0; A < 3; A++) ot.aNormal[d * 3 + A] = P.aNormal[y * 3 + A];
  }
  const xt = it(t.drops);
  for (let d = 0; d < xt.count; d++) {
    let y = 0;
    do y = Math.floor(v() * C.count);
    while (C.aShade[y * 4 + 3] > 2);
    B(
      C,
      y,
      xt,
      d,
      0.5 + 0.42 * v(),
      0.005 + 0.009 * v() ** 2,
      1.02 + v() * 0.1,
    );
  }
  const J = 128,
    Ft = 2.4,
    rt = new Float32Array(J * J);
  for (let d = 0; d < J; d++)
    for (let y = 0; y < J; y++) {
      const A = (((y + 0.5) / J) * 2 - 1) * Ft,
        b = (((d + 0.5) / J) * 2 - 1) * Ft;
      let N = Te;
      for (let R = 1.2; R > Te; R -= 0.01) {
        const M = Math.hypot(A, R, b);
        if (o(A, R, b, M) > M) {
          N = R;
          break;
        }
      }
      rt[d * J + y] = N;
    }
  return {
    fuzz: X,
    shoots: P,
    stalks: C,
    dew: mt,
    drops: xt,
    beads: ot,
    radius: o,
    sample: i,
    heightAt: (d, y) => {
      const A = Math.max(0, Math.min(J - 1.001, ((d / Ft + 1) / 2) * J - 0.5)),
        b = Math.max(0, Math.min(J - 1.001, ((y / Ft + 1) / 2) * J - 0.5)),
        N = Math.floor(A),
        R = Math.floor(b),
        M = A - N,
        F = b - R;
      return (
        (rt[R * J + N] * (1 - M) + rt[R * J + N + 1] * M) * (1 - F) +
        (rt[(R + 1) * J + N] * (1 - M) + rt[(R + 1) * J + N + 1] * M) * F
      );
    },
    hit: (d, y) => {
      const A = Math.max(0.02, Math.hypot(d.x, d.y, d.z) - 2.6);
      for (let b = A; b < A + 5.5; b += 0.012) {
        const N = d.x + y.x * b,
          R = d.y + y.y * b,
          M = d.z + y.z * b,
          F = Math.hypot(N, R, M);
        if (R > Te && o(N, R, M, F) > F) return { x: N, y: R, z: M };
      }
      return null;
    },
  };
}
const G = new URLSearchParams(location.search),
  Tt = S(0),
  Nt = G.has("capture"),
  ko = +(G.get("fps") || 60);
if (Nt) {
  let t = 912367;
  Math.random = () => {
    t = (t + 1831565813) | 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    return (
      (e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e),
      ((e ^ (e >>> 14)) >>> 0) / 4294967296
    );
  };
}
const va = {
    elapsedTime: Nt ? 45 : 0,
    last: null,
    getDelta() {
      if (Nt) return ((this.elapsedTime += 1 / ko), 1 / ko);
      const t = performance.now(),
        e = this.last === null ? 0 : (t - this.last) / 1e3;
      return ((this.last = t), (this.elapsedTime += e), e);
    },
  },
  an = Nt ? +G.get("w") : innerWidth,
  on = Nt ? +G.get("h") : innerHeight,
  $t =
    G.has("phone") ||
    (matchMedia("(pointer: coarse)").matches &&
      Math.min(innerWidth, innerHeight) < 820),
  ke = G.get("shot"),
  he = G.has("still") && !ke,
  Ba = G.has("thumb"),
  As = G.has("reveal");
if (Ba || Nt)
  for (const t of ["#title", "#hint", "#bar-ui", "#controls", "#dissolve"])
    document.querySelector(t)?.remove();
else
  $t &&
    (document.querySelector("#hint").textContent =
      "Drag to orbit. Hold, then drag, to brush the moss");
const Po = +(G.get("q") || ($t ? 0.42 : 1)),
  Ss = document.querySelector("#message"),
  Ts = document.querySelector("#hint");
if (!navigator.gpu)
  throw (
    (Ss.textContent =
      "This piece needs WebGPU. Try a recent version of Chrome or Edge."),
    new Error("no webgpu")
  );
const nn = performance.now(),
  ut = zs({
    fuzz: (52e4 * Po) | 0,
    shoots: (15e4 * Po) | 0,
    stalks: 1,
    dew: 5e3,
    drops: 0,
    beads: $t ? 2500 : 7e3,
  }),
  Cs = Math.round(performance.now() - nn),
  Y = new Yn({ canvas: document.querySelector("#view"), antialias: !0 }),
  Qa = $t
    ? Math.min(devicePixelRatio, 1.2)
    : Math.min(Math.max(devicePixelRatio, 1.5), 2);
Y.setPixelRatio(Nt ? 1 : +(G.get("pr") || Qa));
Y.setSize(an, on, !Nt);
Y.toneMapping = ns;
Y.toneMappingExposure = 1.1;
await Y.init();
const Ee = new ss(),
  z = new ls(24, an / on, 0.03, 200),
  na = new lt(0, -0.05, 0),
  ya = Math.max(1, 1.3 / z.aspect),
  wo = new lt(1.9, 1.15, 8.6).multiplyScalar(ya),
  sn = S(new lt(...ee)),
  ie = sn,
  Yt = S(he || ke ? 1.5 : 0.3),
  k = {
    letterbox: !Nt,
    detail: $t ? 2.6 : 3.4,
    lodDistance: $t ? 0.8 : 1.3,
    autoRes: !0,
    director: !he && !As,
    weather: !he && !Nt,
    flyCount: 3,
    flySpeed: 0.62,
    bokeh: 0.8,
    focalK: 0.55,
    screenAO: !1,
  },
  to = S(0.2),
  eo = S(1.25),
  ao = S(0.5),
  Ma = S(1),
  xa = S(1.15),
  Ut = S(+(G.get("wet") || 0)),
  ga = S(1),
  Pe = S(1),
  wa = S(1),
  oo = S(0.105),
  no = S(0.72),
  so = S(0.012),
  ne = S(0),
  lo = S(0.8),
  ln = S(new Na("#265119")),
  un = S(new Na("#648e1e")),
  at = 192,
  Me = 2.3,
  ft = new Float32Array(at * at * 4),
  ve = new Uint8Array(at * at * 4).fill(128);
for (let t = 0; t < at * at; t++) ((ve[t * 4 + 2] = 0), (ve[t * 4 + 3] = 0));
const Be = new us(ve, at, at, rs, cs);
Be.minFilter = Be.magFilter = $o;
Be.needsUpdate = !0;
function ba(t, e, a, n, o, s, l = 0) {
  const r = ((t / Me + 1) / 2) * at,
    u = ((e / Me + 1) / 2) * at,
    c = (a / Me / 2) * at;
  for (
    let p = Math.max(0, Math.floor(u - c));
    p <= Math.min(at - 1, Math.ceil(u + c));
    p++
  )
    for (
      let i = Math.max(0, Math.floor(r - c));
      i <= Math.min(at - 1, Math.ceil(r + c));
      i++
    ) {
      const m = Math.hypot(i - r, p - u) / c;
      if (m >= 1) continue;
      const f = (1 - m * m) ** 2,
        v = (p * at + i) * 4;
      ((ft[v] += (n - ft[v]) * f * 0.55),
        (ft[v + 1] += (o - ft[v + 1]) * f * 0.55),
        (ft[v + 2] = Math.max(ft[v + 2], s * f)),
        l && (ft[v + 3] = Math.max(ft[v + 3], Math.min(1, l * f * 1.8))));
    }
}
const Rs = (t, e) => {
  const a = Math.floor(((t / Me + 1) / 2) * at),
    n = Math.floor(((e / Me + 1) / 2) * at);
  return a < 0 || n < 0 || a >= at || n >= at ? 1 : ft[(n * at + a) * 4 + 3];
};
function Ns(t, e) {
  const a = Math.exp(-t / 4.5),
    n = Math.exp(-t / 2.6),
    o = Math.exp(-t * e * 0.9);
  for (let s = 0; s < at * at; s++) {
    const l = s * 4;
    ((ft[l] *= a),
      (ft[l + 1] *= a),
      (ft[l + 2] *= n),
      (ft[l + 3] *= o),
      (ve[l] = 128 + Math.max(-1, Math.min(1, ft[l])) * 127),
      (ve[l + 1] = 128 + Math.max(-1, Math.min(1, ft[l + 1])) * 127),
      (ve[l + 2] = ft[l + 2] * 255),
      (ve[l + 3] = ft[l + 3] * 255));
  }
  Be.needsUpdate = !0;
}
const Xt = [
  [-0.62, 0.3, 0.42],
  [0.46, 0.46, -0.1],
  [0.72, 0.26, 0.74],
  [-0.2, 0.2, -0.72],
].map(([t, e, a]) => {
  const n = ut.heightAt(t, a) + e * 0.62;
  return { x: t, z: a, y: n, vx: 0, vz: 0, r: e, u: S(new Ie(t, n, a, e)) };
});
function rn(t) {
  let e = t;
  for (const a of Xt) {
    const n = e.sub(a.u.xyz),
      o = fe(Dt(n), 1e-4),
      s = a.u.w.mul(1.012);
    e = _o(o.lessThan(s), a.u.xyz.add(n.div(o).mul(s)), e);
  }
  return e;
}
function Fs(t) {
  let e = h(1),
    a = h(0),
    n = h(1),
    o = h(0);
  for (const s of Xt) {
    const l = s.u.xyz.sub(t),
      r = I(l, ie),
      u = Dt(l.sub(ie.mul(r))),
      c = s.u.w,
      p = j(0, 0.1, r);
    ((e = e.mul(W(1, W(0.38, 1, j(c.mul(0.5), c.mul(1.2), u)), p))),
      (a = a.add(
        Re(u.div(c.mul(0.3)).pow(2).negate())
          .mul(p)
          .mul(Re(r.div(c.mul(2.2)).negate()))
          .mul(1.5),
      )),
      (n = n.mul(h(1).sub(E(st(c.mul(1.08).div(Dt(l)), 0, 1), 5).mul(0.3)))),
      (o = fe(o, j(c.mul(1.28), c.mul(1.02), Dt(l)))));
  }
  return { shade: e, glow: a, occl: n, near: o };
}
const Ht = Lt("aRoot", "vec3"),
  ua = Lt("aTip", "vec3"),
  za = Lt("aBend", "vec3"),
  cn = Lt("aNormal", "vec3"),
  Gt = Lt("aShade", "vec4"),
  ge = j(Gt.w, Gt.w.add(0.28), Yt),
  Da = Zo(Be, Ht.xz.div(Me).add(1).mul(0.5)).level(0),
  Bo = Da.rg.sub(0.502).mul(2),
  ks = Da.b,
  mn = Ut.mul(h(1).sub(Da.a)),
  Fe = Qt(0.8, 0.6),
  Ps = te(() => {
    const t = U(I(Ht.xz, Fe).mul(1.7).sub(Tt.mul(1.15)))
        .mul(0.5)
        .add(0.5),
      e = U(I(Ht.xz, Qt(-0.5, 0.86)).mul(3.1).sub(Tt.mul(0.7)).add(1.3))
        .mul(0.5)
        .add(0.5);
    return E(t.mul(e.mul(0.5).add(0.5)), 2);
  })(),
  Bs = U(Tt.mul(3.1).add(Ht.x.mul(61)).add(Ht.z.mul(47)));
function dn(t, e, a = h(0)) {
  const n = ua
      .mul(t)
      .add(za.mul(4).mul(t).mul(h(1).sub(t)))
      .add(za.mul(a).mul(E(t, 9))),
    o = h(1).sub(ks.mul(0.62)),
    s = x(Fe.x, 0.15, Fe.y)
      .mul(Ps.mul(0.05).add(Bs.mul(0.0025)))
      .mul(e)
      .mul(ga)
      .add(x(Bo.x, 0, Bo.y).mul(0.13).mul(e.mul(0.6).add(0.4)))
      .mul(t)
      .mul(t);
  return rn(Ht.add(n.mul(ge).mul(o)).add(s.mul(ge)));
}
const hn = (t) =>
    q(ua.add(za.mul(4).mul(h(1).sub(t.mul(2)))).add(x(0, 1e-4, 0))),
  qt = ut.fuzz.count + ut.shoots.count,
  bo = new Ca(new Float32Array(qt * 4), 4),
  fn = new Ca(new Float32Array(qt * 4), 4),
  pn = new Ca(new Float32Array(qt * 4), 4),
  vn = new Ca(new Float32Array(qt * 4), 4);
{
  const t = (e, a, n) => {
    const o = Math.min(1, Math.max(0, (n - e) / (a - e)));
    return o * o * (3 - 2 * o);
  };
  [ut.fuzz, ut.shoots].forEach((e, a) => {
    const n = a ? ut.fuzz.count : 0;
    for (let o = 0; o < e.count; o++) {
      const s = e.aRoot[o * 3],
        l = e.aRoot[o * 3 + 1],
        r = e.aRoot[o * 3 + 2],
        u = e.aTip[o * 3],
        c = e.aTip[o * 3 + 1],
        p = e.aTip[o * 3 + 2],
        i = Math.hypot(u, c, p),
        m = s + u * 0.6,
        f = l + c * 0.6,
        v = r + p * 0.6;
      let D = 1,
        O = 0,
        K = 1,
        X = 0,
        P = 0;
      for (const B of Xt) {
        const it = B.x - m,
          mt = B.y - f,
          ot = B.z - v,
          xt = Math.hypot(it, mt, ot),
          J = it * ee[0] + mt * ee[1] + ot * ee[2],
          Ft = Math.hypot(it - ee[0] * J, mt - ee[1] * J, ot - ee[2] * J),
          rt = t(0, 0.1, J),
          nt = 0.38 + 0.62 * t(B.r * 0.5, B.r * 1.2, Ft);
        ((D *= 1 + (nt - 1) * rt),
          (O +=
            Math.exp(-((Ft / (B.r * 0.3)) ** 2)) *
            rt *
            Math.exp(-J / (B.r * 2.2)) *
            1.5),
          (K *= 1 - Math.min(1, (B.r * 1.08) / xt) ** 5 * 0.3),
          (X = Math.max(X, 1 - t(B.r * 1.02, B.r * 1.28, xt))),
          Math.hypot(B.x - s, B.y - l, B.z - r) < B.r * 1.02 + i * 1.7 &&
            (P = 1));
      }
      const C = (n + o) * 4;
      (bo.array.set([s, l, r, P], C), fn.array.set([D, O, K, X], C));
    }
  });
}
const Ds = be(pn, "vec4", qt),
  Ls = be(vn, "vec4", qt),
  Ws = be(bo, "vec4", qt).toReadOnly(),
  yn = te(() => {
    const t = Ws.element(qa).xyz,
      e = Zo(Be, t.xz.div(Me).add(1).mul(0.5)).level(0),
      a = e.rg.sub(0.502).mul(2),
      n = U(I(t.xz, Fe).mul(1.7).sub(Tt.mul(1.15)))
        .mul(0.5)
        .add(0.5),
      o = U(I(t.xz, Qt(-0.5, 0.86)).mul(3.1).sub(Tt.mul(0.7)).add(1.3))
        .mul(0.5)
        .add(0.5),
      s = E(n.mul(o.mul(0.5).add(0.5)), 2),
      l = U(Tt.mul(3.1).add(t.x.mul(61)).add(t.z.mul(47))),
      r = x(Fe.x, 0.15, Fe.y)
        .mul(s.mul(0.05).add(l.mul(0.0025)))
        .mul(ga)
        .add(x(a.x, 0, a.y).mul(0.13));
    Ds.element(qa).assign(jt(r, e.b));
    const u = U(
        t.x
          .mul(1.9)
          .add(Tt.mul(0.11))
          .add(U(t.z.mul(1.3).sub(Tt.mul(0.07))).mul(1.4)),
      ),
      c = U(
        t.z
          .mul(2.3)
          .sub(Tt.mul(0.09))
          .add(U(t.x.mul(1.1).add(Tt.mul(0.05))).mul(1.7)),
      );
    Ls.element(qa).assign(
      jt(j(-0.7, 0.8, u.add(c).mul(0.5)), s, Ut.mul(h(1).sub(e.a)), e.a),
    );
  })().compute(qt),
  La = Xn(Lt("aId", "float")),
  uo = be(pn, "vec4", qt).toReadOnly().element(La),
  Is = be(vn, "vec4", qt).toReadOnly().element(La),
  Es = be(fn, "vec4", qt).toReadOnly().element(La),
  Os = be(bo, "vec4", qt).toReadOnly().element(La).w;
function Mn(t) {
  return te(() => {
    const e = ua.mul(t).add(za.mul(4).mul(t).mul(h(1).sub(t))),
      a = h(1).sub(uo.w.mul(0.62)),
      n = Ht.add(e.mul(ge).mul(a)).add(uo.xyz.mul(t).mul(t).mul(ge)).toVar();
    return (
      ts(Os.greaterThan(0.5), () => {
        n.assign(rn(n));
      }),
      n
    );
  })();
}
const ro = S(new Na(1, 0.86, 0.62)),
  co = S(new Na(0.32, 0.52, 0.72)),
  Hs = x(0.004, 0.012, 0.003),
  js = ln,
  Do = un,
  Ge = x(0.2, 0.5, 0.04),
  Bt = S(new Ie(0, 2, 0, 0)),
  zo = S(new Ie(0, 2, 0, 0)),
  Ao = S(new Ie(0, 2, 0, 0)),
  Wa = x(1, 0.68, 0.2),
  Aa = S(new Ie(0, 2, 0, 0));
function xn({
  centerNode: t,
  positionNode: e,
  heightNode: a,
  normalNode: n,
  shape: o,
  latNode: s = h(0),
  jitNode: l = h(0.5),
}) {
  const r = _(s, "vLat"),
    u = _(l, "vJit"),
    c = (rt) => {
      const nt = rt.xyz.sub(Ht);
      return rt.w.mul(0.0035).div(I(nt, nt).add(0.03));
    },
    p = _(c(zo).add(c(Ao)).add(c(Aa).mul(1.6)), "vFlyB"),
    i = _(Es, "vLit"),
    m = i.x,
    f = i.y,
    v = i.z,
    D = i.w,
    O = _(t, "vP"),
    K = _(a, "vH"),
    X = _(n, "vNorm"),
    P = _(cn, "vSurf"),
    C = _(Gt.xyz, "vS"),
    B = _(Is, "vLive"),
    it = B.x,
    mt = B.y,
    ot = _(uo.w, "vLean"),
    xt = B.z,
    J = B.w,
    Ft = new le({ side: hs });
  return (
    (Ft.positionNode = e),
    (Ft.colorNode = te(() => {
      const rt = q(se.sub(O));
      let nt = q(X);
      nt = _o(I(nt, rt).lessThan(0), nt.negate(), nt);
      const gt = fe(K, D.mul(0.78)),
        d = W(Hs, W(js, Do, j(0.42, 0.95, gt)), j(0.02, 0.5, gt)),
        y = C.z.add(u.sub(0.5).mul(0.3)),
        A = W(
          d,
          d.mul(x(1.7, 1.25, 0.7)).add(Ge.mul(0.05).mul(gt)),
          j(0.42, 0.85, y),
        )
          .mul(W(0.6, 1.3, y))
          .mul(W(1.14, 0.9, Jt(r))),
        b = xt,
        N = E(W(0.05, 1, E(gt, 1.6)), xa),
        R = W(E(C.x.mul(v), xa), 0.85, D),
        M = W(C.y.mul(m), 0.7, D)
          .mul(W(0.5, 1.2, it))
          .mul(Pe),
        F = st(I(nt, ie).add(0.22).div(1.22), 0, 1),
        T = x(0.62, 0.8, 0.72)
          .mul(
            st(
              I(nt, q(se.sub(O)))
                .mul(0.5)
                .add(0.5),
              0,
              1,
            ),
          )
          .mul(N)
          .mul(R.add(0.25))
          .mul(to),
        et = co
          .mul(R)
          .mul(N)
          .mul(W(0.34, 1, nt.y.mul(0.5).add(0.5)))
          .mul(ao),
        pt = ro
          .mul(M)
          .mul(F)
          .mul(W(0.1, 1, E(gt, 1.3)))
          .mul(eo),
        zt = Ge.mul(M)
          .mul(st(I(nt.negate(), ie).add(0.15), 0, 1))
          .mul(E(gt, 1.5))
          .mul(0.28)
          .mul(Ma),
        At = Ge.mul(M)
          .mul(E(st(I(rt.negate(), ie), 0, 1), 2))
          .mul(E(gt, 2))
          .mul(0.4)
          .mul(Ma),
        $ = Do.mul(E(h(1).sub(Jt(I(P, rt))), 3))
          .mul(gt)
          .mul(R.add(M.mul(0.5)))
          .mul(0.5),
        Wt = q(ie.add(rt)),
        L = x(1, 0.97, 0.88)
          .mul(E(st(I(nt, Wt), 0, 1), 420))
          .mul(M)
          .mul(gt)
          .mul(o === "leaf" ? 0.1 : 0.05)
          .mul(b.mul(5).add(1)),
        St = Ge.mul(f)
          .mul(M)
          .mul(W(0.3, 1, gt)),
        dt = Bt.xyz.sub(O),
        wt = I(dt, dt),
        Q = dt.div(wt.sqrt().add(1e-4)),
        vt = Bt.w.mul(0.006).mul(wa).div(wt.add(0.03)),
        kt = Jt(I(nt, Q)).mul(0.65).add(I(nt, Q).mul(0.2)).add(0.15),
        Vt = Wa.mul(vt.mul(kt).add(p.mul(0.6).mul(wa))).mul(
          W(0.12, 1, E(gt, 1.2)),
        ),
        Z = h(1).add(ot.mul(0.2)).add(mt.mul(0.22).mul(gt)),
        bt = q(ie.add(rt)),
        Kt = x(0.8, 0.9, 0.85)
          .mul(E(st(I(nt, bt), 0, 1), 34))
          .mul(b)
          .mul(M)
          .mul(gt)
          .mul(0.14),
        ze = j(0.66, 0.94, gt),
        ue = E(me(u.mul(7.3).add(C.z.mul(13))), 5),
        Zt = x(0.62, 0.84, 0.86)
          .mul(ze)
          .mul(b)
          .mul(ue.mul(0.75).add(0.1))
          .mul(Pe.add(0.5)),
        yt = h(1).add(J.mul(Ut).mul(0.55));
      return Kt.add(Zt).add(
        A.mul(yt)
          .mul(W(x(1), x(0.5, 0.68, 0.58), b))
          .mul(et.add(pt).add(T))
          .add(zt)
          .add(At)
          .add($)
          .add(St)
          .mul(Z)
          .add(A.mul(4.5).add(Ge.mul(0.07)).mul(Vt))
          .add(L),
      );
    })()),
    Ft
  );
}
function gn(t, e, a = ["aRoot", "aTip", "aBend", "aNormal", "aShade"]) {
  const n = new la();
  for (const o of Object.keys(t.attributes)) n.setAttribute(o, t.attributes[o]);
  (n.setIndex(t.index), (n.instanceCount = e.count));
  for (const o of a) n.setAttribute(o, new de(e[o], o === "aShade" ? 4 : 3));
  return n;
}
const Oe = (t, e, a = 0) => {
    const n = new Fa(t, e);
    return ((n.frustumCulled = !1), (n.renderOrder = a), Ee.add(n), n);
  },
  sa = { fuzz: [], shoots: [] };
function wn(t, e, a) {
  const n = new Map();
  for (let s = 0; s < t.count; s++) {
    const l = [0, 1, 2].map((r) => Math.floor(t.aRoot[s * 3 + r] / e)).join();
    (n.has(l) || n.set(l, []), n.get(l).push(s));
  }
  const o = [];
  for (const s of n.values()) {
    const l = s.length,
      r = {},
      u = new lt(),
      c = new lt();
    for (const [i, m] of [
      ["aRoot", 3],
      ["aTip", 3],
      ["aBend", 3],
      ["aNormal", 3],
      ["aShade", 4],
    ]) {
      const f = new Float32Array(l * m);
      (s.forEach((v, D) => {
        for (let O = 0; O < m; O++) f[D * m + O] = t[i][v * m + O];
      }),
        (r[i] = new de(f, m)));
    }
    r.aId = new de(
      Float32Array.from(s, (i) => i + a),
      1,
    );
    for (let i = 0; i < l; i++)
      ((u.x += r.aRoot.array[i * 3]),
        (u.y += r.aRoot.array[i * 3 + 1]),
        (u.z += r.aRoot.array[i * 3 + 2]),
        (c.x += r.aNormal.array[i * 3]),
        (c.y += r.aNormal.array[i * 3 + 1]),
        (c.z += r.aNormal.array[i * 3 + 2]));
    (u.divideScalar(l), c.normalize());
    let p = 0;
    for (let i = 0; i < l; i++)
      p = Math.max(p, u.distanceTo(new lt().fromArray(r.aRoot.array, i * 3)));
    o.push({
      count: l,
      attrs: r,
      center: u,
      normal: c,
      radius: p + 0.22,
      low: null,
      high: null,
    });
  }
  return o;
}
function io(t, e, a) {
  const n = new la();
  for (const s of Object.keys(e.attributes)) n.setAttribute(s, e.attributes[s]);
  n.setIndex(e.index);
  for (const s of Object.keys(t.attrs)) n.setAttribute(s, t.attrs[s]);
  ((n.instanceCount = t.count),
    (n.boundingSphere = new fs(t.center.clone(), t.radius)));
  const o = new Fa(n, a);
  return (Ee.add(o), o);
}
const Lo = new lt();
let bn = 0;
const Wo = $t ? 6e3 : 34e3;
function zn() {
  const t = z.position;
  let e = 0,
    a = 0;
  const n = De.value,
    o = (s, l) => (
      Lo.copy(t).sub(s.center).divideScalar(l),
      l < s.radius * 1.6 || Lo.dot(s.normal) > -0.5
    );
  for (const s of sa.fuzz) {
    const l = t.distanceTo(s.center),
      r = o(s, l);
    if (((s.low.visible = r), r)) {
      const u = Math.max(0.16, Math.min(1, (k.detail / l) ** 1.3));
      ((s.low.geometry.instanceCount = Math.ceil(s.count * u)),
        (a += s.low.geometry.instanceCount * 8));
    }
  }
  for (const s of sa.shoots) {
    const l = t.distanceTo(s.center),
      r = o(s, l);
    if (
      ((s.high.visible = r && l - s.radius < n),
      (s.low.visible = r && l + s.radius > n * 0.88),
      s.high.visible && ((e += s.count), (a += s.count * 176)),
      s.low.visible)
    ) {
      const u = Math.max(0.12, Math.min(1, (k.detail / l) ** 1.3));
      ((s.low.geometry.instanceCount = Math.ceil(s.count * u)),
        (a += s.low.geometry.instanceCount * 44));
    }
  }
  ((bn = a),
    (De.value =
      e > Wo
        ? Math.max(1, n * 0.98)
        : e < Wo * 0.7
          ? Math.min(k.lodDistance, n * 1.02)
          : n));
}
{
  const e = new Float32Array(24),
    a = [];
  for (let m = 0; m < 4; m++)
    if ((e.set([-1, m / 3, 0, 1, m / 3, 0], m * 6), m < 3)) {
      const f = m * 2;
      a.push(f, f + 1, f + 2, f + 1, f + 3, f + 2);
    }
  const n = new Qo();
  (n.setAttribute("position", new tn(e, 3)), n.setIndex(a));
  const o = Mt.y,
    s = Mt.x,
    l = Mn(o),
    r = hn(o),
    u = se.sub(l),
    c = q(Ce(r, u)),
    p = fe(
      h(0.0032)
        .mul(E(h(1).sub(o), 0.62))
        .add(5e-4),
      Dt(u)
        .mul(6e-4)
        .mul(h(1).sub(o.mul(0.6))),
    ).mul(ge),
    i = xn({
      centerNode: l,
      positionNode: l.add(c.mul(s).mul(p)),
      heightNode: o.mul(0.86),
      normalNode: q(W(cn, r, 0.45).add(c.mul(s).mul(0.55))),
      shape: "fuzz",
    });
  for (const m of wn(ut.fuzz, 0.5, 0)) ((m.low = io(m, n, i)), sa.fuzz.push(m));
}
const De = S(k.lodDistance);
function Io(t, e) {
  const a = [],
    n = [],
    o = [];
  for (let l = 0; l < t; l++) {
    const r = 0.13 + (0.86 * l) / (t - 1),
      u = l * 2.39996,
      c = a.length / 3;
    if (!e.length) {
      (a.push(0, 0, r, -1, 0.36, r, 1, 0.36, r, 0, 1, r),
        n.push(u, u, u, u),
        o.push(c, c + 1, c + 2, c + 1, c + 3, c + 2));
      continue;
    }
    (a.push(0, 0, r), n.push(u));
    for (const m of e) (a.push(-1, m, r, 0, m, r, 1, m, r), n.push(u, u, u));
    (a.push(0, 1, r), n.push(u), o.push(c, c + 1, c + 2, c, c + 2, c + 3));
    for (let m = 0; m < e.length - 1; m++) {
      const f = c + 1 + m * 3;
      o.push(
        f,
        f + 3,
        f + 1,
        f + 1,
        f + 3,
        f + 4,
        f + 1,
        f + 4,
        f + 2,
        f + 2,
        f + 4,
        f + 5,
      );
    }
    const p = c + 1 + (e.length - 1) * 3,
      i = p + 3;
    o.push(p, i, p + 1, p + 1, i, p + 2);
  }
  const s = new Qo();
  return (
    s.setAttribute("position", new Fo(a, 3)),
    s.setAttribute("aAng", new Fo(n, 1)),
    s.setIndex(o),
    s
  );
}
function Eo(t) {
  const e = Mt.x,
    a = Mt.y,
    n = Mt.z,
    o = Mn(n),
    s = hn(n),
    l = q(Ce(s, q(Ht.add(x(0.31, 0.77, -0.53))))),
    r = Ce(s, l),
    u = me(Ht.x.mul(91.7).add(Ht.z.mul(57.3))),
    c = Lt("aAng", "float"),
    p = c.add(u.mul(6.283)),
    i = l.mul(_a(p)).add(r.mul(U(p))),
    m = Ce(s, i),
    f = Dt(se.sub(Ht)),
    v = j(De.mul(0.88), De, f),
    D = t ? h(1).sub(v) : v,
    O = me(c.mul(3.7).add(u)).mul(0.35).add(0.8),
    K = t ? h(1) : W(1, 1.45, j(2.5, 8, f)),
    X = Dt(ua)
      .mul(0.52)
      .mul(K)
      .mul(U(n.mul(3.1416)).mul(0.35).add(0.65))
      .mul(O)
      .mul(ge)
      .mul(D),
    P = E(U(E(a, 0.66).mul(3.1416)), 1.35),
    C = Dt(se.sub(o)).mul(85e-5).mul(ge).mul(D),
    B = fe(X.mul(oo), t ? h(0) : C),
    it = n.mul(0.64).add(0.17),
    mt = h(1).sub(it.mul(it)).sqrt(),
    ot = X.mul(a).mul(mt),
    xt = X.mul(
      a
        .mul(it)
        .add(U(a.mul(3.1416)).mul(0.2))
        .sub(a.mul(a).mul(0.14)),
    ),
    J = h(1).sub(Jt(e)).mul(B).mul(P).mul(0.32),
    Ft = o
      .add(i.mul(ot))
      .add(s.mul(xt.add(J)))
      .add(m.mul(e).mul(B).mul(P)),
    rt = i
      .mul(mt)
      .add(s.mul(it.add(_a(a.mul(3.1416)).mul(0.628)).sub(a.mul(0.28)))),
    nt = q(q(Ce(rt, m)).add(m.mul(e).mul(0.45)));
  return xn({
    centerNode: o,
    positionNode: Ft,
    heightNode: n.mul(0.45).add(a.mul(0.42)).add(0.05),
    normalNode: nt,
    shape: "leaf",
    latNode: e,
    jitNode: me(c.mul(1.37).add(u.mul(9))),
  });
}
{
  const t = Io(11, []),
    e = Io(16, [0.18, 0.42, 0.7]),
    a = Eo(!1),
    n = Eo(!0);
  for (const o of wn(ut.shoots, 0.5, ut.fuzz.count))
    ((o.low = io(o, t, a)),
      (o.high = io(o, e, n)),
      (o.high.visible = !1),
      sa.shoots.push(o));
}
const Oo = new lt(),
  So = (t) => h(1).sub(Jt(h(1).sub(es(t, Qt(2))))),
  An = (t) => j(0, 0.22, fe(Jt(t.x.sub(0.5)), Jt(t.y.sub(0.5))).sub(0.5)),
  mo = (t) => W(x(0.012, 0.05, 0.012), x(0.03, 0.1, 0.16), j(-0.25, 0.3, t.y)),
  Ho = Ra().value;
Ho.minFilter = Ho.magFilter = $o;
function Sn(t) {
  const e = j(0.988, 0.994, I(t, q(x(-0.5, 0.42, -0.2)))),
    a = j(0.2, 0.05, Jt(t.x.sub(0.72)))
      .mul(j(-0.2, 0.15, t.y))
      .mul(j(0.85, 0.5, t.y));
  return W(x(0.01, 0.03, 0.03), x(0.1, 0.24, 0.34), j(-0.3, 0.6, t.y))
    .add(x(13).mul(e))
    .add(x(1.2).mul(a));
}
function qs(t, e, a) {
  const n = new go(1, 1),
    o = gn(n, t, ["aRoot", "aTip", "aBend", "aShade"]),
    s = e(Gt.x),
    l = Gt.y
      .mul(mn.mul(0.8).add(1))
      .mul(h(1).sub(Da.a.mul(Ut.min(1)).mul(0.9)))
      .mul(j(Gt.w, Gt.w.add(0.2), Yt))
      .mul(
        U(Tt.mul(0.3).add(Gt.z.mul(40)))
          .mul(0.06)
          .add(1),
      ),
    r = q(Mt),
    u = new le({ transparent: !0 });
  u.positionNode = s.add(
    r.mul(l).mul(x(1, h(1).add(a.mul(fe(r.y.negate(), 0))), 1)),
  );
  const c = _(s, "vDropC"),
    p = _(r, "vDropN"),
    i = _(l, "vDropR");
  ((u.colorNode = te(() => {
    const m = q(p),
      f = c.add(m.mul(i)),
      v = q(f.sub(se)),
      D = c.sub(m.mul(i.mul(5))),
      O = Le.mul(We).mul(jt(D, 1)),
      K = Ra(So(O.xy.div(O.w).mul(Qt(0.5, -0.5)).add(0.5))).rgb,
      X = st(I(v.negate(), m), 0, 1),
      P = h(0.03).add(h(0.97).mul(E(h(1).sub(X), 5))),
      C = E(st(I(oa(v, m), q(Bt.xyz.sub(f))), 0, 1), 220)
        .mul(Bt.w)
        .mul(1.6)
        .div(I(Bt.xyz.sub(f), Bt.xyz.sub(f)).mul(9).add(1));
    return K.mul(W(0.55, 1.08, j(0, 0.5, X)))
      .mul(h(1).sub(P))
      .add(Sn(oa(v, m)).mul(P))
      .add(Wa.mul(C));
  })()),
    Oe(o, u, 1));
}
qs(ut.dew, (t) => dn(t, h(1)), h(0.1));
const da = (() => {
    const t = new go(1, 2),
      e = gn(t, ut.beads, ["aRoot", "aTip", "aBend", "aNormal", "aShade"]),
      a = j(Gt.z.mul(0.7), Gt.z.mul(0.7).add(0.2), mn),
      n = Gt.y.mul(a),
      o = q(Mt),
      s = dn(h(1), h(0.55))
        .add(q(ua).mul(n.mul(0.7)))
        .add(x(0, n.mul(-0.25), 0)),
      l = new le({ transparent: !0 });
    l.positionNode = s.add(
      o.mul(n).mul(x(1, h(1).add(fe(o.y.negate(), 0).mul(0.28)), 1)),
    );
    const r = _(s, "vBeadC"),
      u = _(o, "vBeadN"),
      c = _(n, "vBeadR");
    l.colorNode = te(() => {
      const i = q(u),
        m = r.add(i.mul(c)),
        f = q(m.sub(se)),
        v = st(I(f.negate(), i), 0, 1),
        D = Za(f, i, h(1 / 1.33)),
        O = Le.mul(We).mul(jt(r.add(D.mul(c.mul(3.5))), 1)),
        K = O.xy.div(O.w).mul(Qt(0.5, -0.5)).add(0.5),
        X = W(Ra(So(K)).rgb, mo(D), An(K)),
        P = h(0.02).add(h(0.98).mul(E(h(1).sub(v), 5))),
        C = oa(f, i),
        B = j(0.1, -0.75, i.y)
          .mul(x(0.5, 0.68, 0.72))
          .mul(0.55)
          .mul(Pe.add(0.3)),
        it = j(0, 0.4, v).mul(0.78).add(0.22),
        mt = E(st(I(C, ie), 0, 1), 900)
          .mul(34)
          .mul(Pe),
        ot = mo(C).mul(P).mul(2.5),
        xt = E(st(I(C, q(Bt.xyz.sub(m))), 0, 1), 400)
          .mul(Bt.w)
          .mul(9);
      return X.mul(0.9)
        .add(B)
        .mul(it)
        .add(ot)
        .add(x(1, 0.97, 0.9).mul(mt))
        .add(Wa.mul(xt));
    })();
    const p = Oe(e, l, 1);
    return ((p.visible = !1), p);
  })(),
  ho = new go(1, 96);
{
  const t = ho.attributes.position,
    e = new Float32Array(t.count),
    a = new Float32Array(5);
  for (let n = 0; n < t.count; n++) {
    const o = t.getX(n),
      s = t.getY(n),
      l = t.getZ(n),
      r = Math.hypot(o, s, l),
      u = ut.radius(o, s, l, r) - 0.004;
    (t.setXYZ(n, (o / r) * u, (s / r) * u, (l / r) * u),
      ut.sample(o, s, l, r, a),
      (e[n] = a[3]));
  }
  ho.setAttribute("aDark", new tn(e, 1));
}
const Tn = new le();
Tn.colorNode = te(() => {
  const t = U(Se.x.mul(23).add(U(Se.z.mul(17)).mul(2.4)))
      .mul(U(Se.z.mul(29).add(U(Se.y.mul(19)).mul(2.4))))
      .mul(0.5)
      .add(0.5),
    e = W(
      W(x(0.006, 0.006, 0.004), x(0.03, 0.022, 0.012), t),
      x(0.012, 0.028, 0.006),
      j(0.35, 0.9, Yt),
    ),
    a = Se,
    n = U(a.x.mul(83).add(U(a.z.mul(61)).mul(2)))
      .mul(U(a.z.mul(97).add(U(a.x.mul(71)).mul(2))))
      .mul(0.5)
      .add(0.5);
  return W(
    e.mul(Lt("aDark", "float").add(0.25)),
    W(x(0.008, 0.035, 0.006), x(0.05, 0.15, 0.018), n),
    Fs(a).near,
  );
})();
Ee.add(new Fa(ho, Tn));
const Cn = S(new en(0.5, 0.45)),
  Rn = S(z.aspect),
  Vs = x(0.022, 0.085, 0.145),
  Gs = x(0.002, 0.009, 0.024);
Ee.backgroundNode = te(() => {
  const t = ma.sub(Cn).mul(Qt(Rn.min(1.5), 1));
  return W(Vs, Gs, j(0, 0.78, Dt(t))).mul(Pe.mul(0.3).add(0.7));
})();
const ha = S(new Ie(0, 0, 0, 0)),
  Xe = Array.from({ length: 7 }, () => S(new lt())),
  Ct = Xt.reduce((t, e) => (e.z > t.z ? e : t));
for (const t of Xt) {
  const e = new le({ transparent: !0 });
  ((e.colorNode = te(() => {
    const a = Se,
      n = q(Kn),
      o = q(a.sub(se)),
      s = t.u.xyz,
      l = t.u.w,
      r = Za(o, n, h(1 / 1.5)),
      u = a.add(r.mul(l.mul(-2).mul(I(r, n)))),
      c = Za(r, q(u.sub(s)).negate(), h(1.5)),
      p = Le.mul(We).mul(jt(u.add(c.mul(l.mul(2.1))), 1)),
      i = p.xy.div(p.w).mul(Qt(0.5, -0.5)).add(0.5),
      m = W(Ra(So(i)).rgb, mo(c), An(i)),
      f = st(I(o.negate(), n), 0, 1),
      v = h(0.04).add(h(0.96).mul(E(h(1).sub(f), 5))),
      D = W(x(0.8, 0.88, 0.82), x(1.06), j(0, 0.55, f)),
      O = E(st(I(oa(o, n), q(Bt.xyz.sub(a))), 0, 1), 260)
        .mul(Bt.w)
        .mul(5);
    let K = x(0);
    if (t === Ct) {
      const X = (mt) => {
          const ot = mt.sub(a),
            xt = I(ot, r);
          return I(ot, ot).sub(xt.mul(xt));
        },
        P = X(ha.xyz),
        C = Re(P.div(l.mul(0.032).pow(2)).negate())
          .mul(16)
          .add(Re(P.div(l.mul(0.09).pow(2)).negate()).mul(1.7))
          .add(Re(P.div(l.mul(0.34).pow(2)).negate()).mul(0.2));
      let B = h(0);
      Xe.forEach((mt, ot) => {
        B = B.add(
          Re(X(mt).div(l.mul(0.016).pow(2)).negate()).mul(2.6 * (1 - ot / 7)),
        );
      });
      const it = E(st(I(q(ha.xyz.sub(u)), r.negate()), 0, 1), 4)
        .mul(0.02)
        .add(E(h(1).sub(f), 3).mul(0.05));
      K = x(1, 0.68, 0.22).mul(C.add(B).add(it)).mul(ha.w);
    }
    return m
      .mul(D)
      .mul(h(1).sub(v))
      .add(Sn(oa(o, n)).mul(v))
      .add(Wa.mul(O))
      .add(K);
  })()),
    (t.mesh = new Fa(new is(t.r, 96, 64), e)),
    t.mesh.position.set(t.x, t.y, t.z),
    (t.mesh.renderOrder = 2),
    Ee.add(t.mesh));
}
const Ke = S(6),
  fa = (() => {
    const e = new Float32Array(2800);
    for (let i = 0; i < 700; i++) {
      const m = Math.random() * 6.283,
        f = Math.sqrt(Math.random()) * 3.6;
      e.set(
        [
          Math.cos(m) * f,
          Math.sin(m) * f,
          0.75 + Math.random() * 0.5,
          Math.random(),
        ],
        i * 4,
      );
    }
    const a = new la(),
      n = new ka(2, 2);
    (a.setAttribute("position", n.attributes.position),
      a.setIndex(n.index),
      (a.instanceCount = 700),
      a.setAttribute("aDrop", new de(e, 4)));
    const o = Lt("aDrop", "vec4"),
      s = h(4.2).sub(me(Tt.mul(0.62).mul(o.z).add(o.w)).mul(6)),
      l = x(o.x, s, o.y),
      r = q(Ce(x(0, 1, 0), se.sub(l))),
      u = new le({ transparent: !0, depthWrite: !1, blending: Pa });
    u.positionNode = l
      .add(r.mul(Mt.x).mul(0.0011))
      .add(x(0, 1, 0).mul(Mt.y).mul(0.12));
    const c = _(Mt.xy, "vRainUv");
    u.colorNode = x(0.62, 0.78, 0.9)
      .mul(h(1).sub(Jt(c.y)))
      .mul(h(1).sub(Jt(c.x)))
      .mul(0.24)
      .mul(ne);
    const p = Oe(a, u, 3);
    return ((p.visible = !1), p);
  })(),
  Ia = 220,
  Ze = new Float32Array(Ia * 4).fill(-99),
  _e = new Float32Array(Ia * 4);
let Us = 0;
const re = new la(),
  To = S(0),
  Nn = S(1);
{
  const t = new ka(2, 2);
  (re.setAttribute("position", t.attributes.position),
    re.setIndex(t.index),
    (re.instanceCount = Ia),
    re.setAttribute("aS", new de(Ze, 4)),
    re.setAttribute("aV", new de(_e, 4)));
  const e = Lt("aS", "vec4"),
    a = Lt("aV", "vec4"),
    n = To.sub(e.w),
    o = st(n.div(a.w), 0, 1),
    s = e.xyz.add(a.xyz.mul(n)).add(x(0, -1.35, 0).mul(n).mul(n)),
    l = We.mul(jt(s, 1)),
    r = new le({ transparent: !0, depthWrite: !1, blending: Pa });
  r.vertexNode = Le.mul(l.add(jt(Mt.xy.mul(h(0.0048).mul(Nn)), 0, 0)));
  const u = _(Mt.xy, "vSprayUv"),
    c = _(h(1).sub(o), "vSprayF");
  ((r.colorNode = x(0.78, 0.92, 1)
    .mul(E(st(h(1).sub(Dt(u)), 0, 1), 1.6))
    .mul(c)
    .mul(2.4)),
    Oe(re, r, 3));
}
function Js(t, e, a, n, o, s) {
  const l = To.value;
  for (let r = 0; r < s; r++) {
    const u = (Us++ % Ia) * 4;
    ((Ze[u] = t + (Math.random() - 0.5) * 0.14),
      (Ze[u + 1] = e + 0.03),
      (Ze[u + 2] = a + (Math.random() - 0.5) * 0.14),
      (Ze[u + 3] = l),
      (_e[u] = n * 0.22 + (Math.random() - 0.5) * 0.26),
      (_e[u + 1] = 0.22 + Math.random() * 0.4),
      (_e[u + 2] = o * 0.22 + (Math.random() - 0.5) * 0.26),
      (_e[u + 3] = 0.45 + Math.random() * 0.4));
  }
  ((re.attributes.aS.needsUpdate = !0), (re.attributes.aV.needsUpdate = !0));
}
const $e = S(0),
  Ea = 420,
  Qe = new Float32Array(Ea * 4).fill(-99),
  ta = new Float32Array(Ea * 4);
let Ys = 0;
const ce = new la(),
  Fn = S(1);
{
  const t = new ka(2, 2);
  (ce.setAttribute("position", t.attributes.position),
    ce.setIndex(t.index),
    (ce.instanceCount = Ea),
    ce.setAttribute("aEmber", new de(Qe, 4)),
    ce.setAttribute("aDrift", new de(ta, 4)));
  const e = Lt("aEmber", "vec4"),
    a = Lt("aDrift", "vec4"),
    n = $e.sub(e.w),
    o = a.w,
    s = st(n.div(o), 0, 1),
    l = x(U($e.mul(2.3).add(a.x.mul(50))), 0, _a($e.mul(1.9).add(a.z.mul(50))))
      .mul(0.016)
      .mul(s),
    r = e.xyz.add(a.xyz.mul(n)).add(l),
    u = We.mul(jt(r, 1)),
    c = W(0.0055, 0.0012, s)
      .mul(h(1).add(me(o.mul(7)).mul(0.8)))
      .mul(Fn),
    p = new le({ transparent: !0, depthWrite: !1, blending: Pa });
  p.vertexNode = Le.mul(u.add(jt(Mt.xy.mul(c), 0, 0)));
  const i = _(Mt.xy, "vEmberUv"),
    m = _(
      E(h(1).sub(s), 1.6)
        .mul(j(0, 0.04, n))
        .mul(
          U($e.mul(9).add(o.mul(90)))
            .mul(0.3)
            .add(0.8),
        ),
      "vEmberB",
    );
  ((p.colorNode = x(1, 0.62, 0.16)
    .mul(E(st(h(1).sub(Dt(i)), 0, 1), 2))
    .mul(m)
    .mul(4)),
    Oe(ce, p, 0.5));
}
const ea = [S(1), S(1), S(1)];
function aa(t, e, a, n, o, s = 0.6, l = 1) {
  const r = new le({ transparent: !0, depthWrite: !1, blending: Pa }),
    u = We.mul(jt(t.xyz, 1));
  r.vertexNode = Le.mul(
    u.add(jt(Mt.xy.mul(Qt(l, 1)).mul(a).mul(e), h(a).mul(e).mul(0.6), 0)),
  );
  const c = _(Mt.xy, "vFlyUv");
  ((r.colorNode = x(1, 0.7, 0.24)
    .mul(E(st(h(1).sub(Dt(c)), 0, 1), n))
    .mul(o)
    .mul(t.w)),
    Oe(new ka(2, 2), r, s));
}
for (const [t, e] of [Bt, zo, Ao].entries())
  (aa(e, ea[t], 0.42, h(3), h(0.5)),
    aa(e, ea[t], 0.07, h(2), h(1.5)),
    aa(e, ea[t], 0.014, h(1.5), h(12)));
aa(Bt, ea[0], 0.011, h(1.6), h(0.42), 0.6, 30);
const kn = S(0.5);
aa(Aa, kn, 0.5, h(3), h(0.26), 2.5);
const Rt = Y.domElement,
  Ga = new ps(),
  jo = new en(),
  V = { x: 0, z: 0, y: 0, on: !1, vx: 0, vz: 0, last: 0, lastMove: 0 };
let Pn = !1,
  Oa = -1e9,
  ht = null,
  Ne = !1,
  H = null;
function Bn(t) {
  return (
    jo.set(
      (t.clientX / innerWidth) * 2 - 1,
      -(t.clientY / innerHeight) * 2 + 1,
    ),
    Ga.setFromCamera(jo, z),
    ut.hit(Ga.ray.origin, Ga.ray.direction)
  );
}
let Co = !1,
  Ro = 0,
  ye = null;
function Xs(t) {
  if (
    (ye &&
      Math.hypot(t.clientX - ye.x, t.clientY - ye.y) > 9 &&
      (clearTimeout(Ro), (ye = null)),
    t.buttons && !Co)
  ) {
    V.on = !1;
    return;
  }
  const e = Bn(t);
  if (!e) {
    V.on = !1;
    return;
  }
  const a = performance.now(),
    n = Math.max(8, a - V.last) / 1e3;
  if (V.on) {
    ((V.vx += ((e.x - V.x) / n - V.vx) * 0.3),
      (V.vz += ((e.z - V.z) / n - V.vz) * 0.3));
    const o = e.x - V.x,
      s = e.z - V.z,
      l = Math.hypot(o, s),
      r = Math.min(6, Math.ceil(l / 0.04)),
      u = Math.max(-1, Math.min(1, V.vx * 0.5)),
      c = Math.max(-1, Math.min(1, V.vz * 0.5));
    for (let p = 1; p <= r; p++) {
      const i = V.x + (o * p) / r,
        m = V.z + (s * p) / r;
      (Ut.value > 0.1 &&
        Rs(i, m) < 0.5 &&
        l > 0.004 &&
        Js(i, ut.heightAt(i, m) + 0.05, m, V.vx, V.vz, 2),
        ba(i, m, 0.21, u, c, 0.3, 1));
    }
    l > 0.01 && (Pn = !0);
  }
  ((V.x = e.x),
    (V.y = e.y),
    (V.z = e.z),
    (V.on = !0),
    (V.last = a),
    (V.lastMove = a));
}
Rt.addEventListener("pointermove", Xs);
Rt.addEventListener("pointerleave", () => {
  V.on = !1;
});
const Dn = () => {
  ((Oa = performance.now()), (ht = null), Pn && (Ts.style.opacity = 0));
};
Rt.addEventListener("wheel", Dn, { passive: !0 });
Rt.addEventListener("pointerdown", (t) => {
  (Dn(),
    (V.on = !1),
    t.pointerType === "touch" &&
      ((ye = { x: t.clientX, y: t.clientY }),
      (Ro = setTimeout(() => {
        ((ye = null), (Co = !0), (H.enabled = !1), navigator.vibrate?.(8));
      }, 240))));
});
addEventListener("pointerup", () => {
  (clearTimeout(Ro), (ye = null), (Co = !1), (H.enabled = !0), (V.on = !1));
});
Rt.addEventListener("dblclick", (t) => {
  Oa = performance.now();
  const e = Bn(t),
    a = z.position.clone(),
    n = H.target.clone();
  if (!e) {
    ((ht = { t: 0, dur: 2.4, from: a, fromT: n, to: wo, toT: na }), (Ne = !1));
    return;
  }
  $s(e);
  const o = new lt(e.x, e.y, e.z),
    s = a.clone().sub(o).normalize();
  ((s.y = Math.max(s.y, 0.35)),
    s.normalize(),
    (ht = {
      t: 0,
      dur: 2.4,
      from: a,
      fromT: n,
      to: o.clone().addScaledVector(s, 1.05),
      toT: o,
    }),
    (Ne = !0));
});
H = new gs(z, Rt);
H.target.copy(na);
H.enableDamping = !0;
H.dampingFactor = 0.055;
H.rotateSpeed = 0.55;
H.zoomSpeed = 0.7;
H.minDistance = 2.5;
H.maxDistance = 28 * ya;
H.minPolarAngle = 0.15;
H.maxPolarAngle = 2.15;
H.enablePan = !1;
H.autoRotateSpeed = 0.3;
const Sa = G.get("cam")?.split(",").map(Number);
z.position.copy(Sa ? new lt(...Sa) : wo);
G.get("tgt") && H.target.set(...G.get("tgt").split(",").map(Number));
!he &&
  !Sa &&
  !ke &&
  (ht = {
    t: 0,
    dur: 11,
    from: new lt(-1.2, 0.95, 2.5),
    fromT: new lt(-0.4, 0.3, 0.5),
    to: wo,
    toT: na,
  });
addEventListener("resize", () => {
  ((z.aspect = innerWidth / innerHeight),
    z.updateProjectionMatrix(),
    Y.setSize(innerWidth, innerHeight));
});
const Ln = S(1.6),
  Wn = S(k.bokeh),
  fo = Zn(Ee, z),
  po = fo.getTextureNode("output"),
  vo = _n(po, 0.14, 0.5, 0.82),
  yo = S(0);
function In(t) {
  let e = po;
  if (t) {
    const o = as(fo.getTextureNode("depth"), null, z);
    ((o.resolutionScale = 0.5),
      (o.radius.value = 0.35),
      (e = po.rgb.mul(W(1, o.getTextureNode().r, lo))));
  }
  const n = ($t ? e : xs(e, fo.getViewZNode(), Ke, Ln, Wn)).rgb.add(vo.rgb);
  return te(() => {
    const o = Dt(ma.sub(0.5)),
      s = me(U(I(ma.add(me(Tt)), Qt(12.9898, 78.233))).mul(43758.5453))
        .sub(0.5)
        .mul(so),
      l = I(n, x(0.2126, 0.7152, 0.0722)),
      u = W(
        n.mul(x(0.93, 1, 1.07)).add(x(0.0015, 0.004, 0.007)),
        n.mul(x(1.05, 1, 0.92)),
        j(0.02, 0.5, l),
      )
        .mul(h(1).sub(j(0.3, 0.85, o).mul(no)))
        .add(s),
      c = os(h(0.5).sub(yo), Jt(ma.y.sub(0.5)));
    return jt(u.mul(h(1).sub(c)), 1);
  })();
}
const we = new $n(Y, In(G.has("ao")));
Qn(Y, we);
const Ks = (t) => {
  ((we.outputNode = In(t)), (we.needsUpdate = !0));
};
let Zs = 0,
  Ue = 8,
  pe = null;
const oe = [
  { u: Bt, scale: 1, wake: 0, x: -0.5, y: 0.1, z: 0.4 },
  { u: zo, scale: 0.62, wake: 13, x: 0.8, y: 0.1, z: -0.5 },
  { u: Ao, scale: 0.5, wake: 26, x: 0.1, y: 0.1, z: 1 },
].map((t, e) => ({
  ...t,
  i: e,
  vx: 0,
  vy: 0,
  vz: 0,
  wx: t.x,
  wy: 0.5,
  wz: t.z,
  hold: 0,
  emit: 0,
  seed: e * 17.3 + 1,
  level: 0,
}));
function _s(t) {
  const e = Math.random();
  if (e < 0.2) {
    const a = Xt[Math.floor(Math.random() * Xt.length)],
      n = Math.random() * 6.283;
    ((t.wx = a.x + Math.cos(n) * (a.r + 0.14)),
      (t.wz = a.z + Math.sin(n) * (a.r + 0.14)),
      (t.wy = a.y + a.r * 0.8));
  } else if (e < 0.36) {
    const a = Math.random() * 6.283,
      n = 1.95 + Math.random() * 0.3;
    ((t.wx = Math.cos(a) * n),
      (t.wz = Math.sin(a) * n),
      (t.wy = -0.1 + Math.random() * 0.8));
  } else {
    const a = Math.random() * 6.283,
      n = 0.25 + Math.random() * 1.25;
    ((t.wx = Math.cos(a) * n),
      (t.wz = Math.sin(a) * n),
      (t.wy = ut.heightAt(t.wx, t.wz) + 0.1 + Math.random() * 0.24));
  }
  t.hold = 0;
}
function $s(t) {
  const e = oe[0];
  ((e.wx = t.x), (e.wz = t.z), (e.wy = t.y + 0.16), (e.hold = 0));
}
function En(t, e) {
  ((t = Math.min(t, 1 / 30)),
    ($e.value = e),
    (To.value = e),
    (Nn.value = Math.max(
      0.3,
      Math.min(1.5, z.position.distanceTo(H.target) / 6),
    )),
    (Fn.value = Math.max(0.14, Math.min(1.4, z.position.length() / 6))),
    oe.forEach((a, n) => {
      const o = n < k.flyCount && Yt.value > 0.15 && (he || e > 7 + a.wake);
      a.level += ((o ? 1 : 0) - a.level) * Math.min(1, t * 0.8);
      const s = a.wx - a.x,
        l = a.wy - a.y,
        r = a.wz - a.z,
        u = Math.hypot(s, l, r);
      (u < 0.1 && a.hold <= 0 && (a.hold = 0.6 + Math.random() * 2.2),
        a.hold > 0 && ((a.hold -= t), a.hold <= 0 && _s(a)));
      const c =
        ((n === 0 && g.shot && xe[g.shot].actor
          ? Math.max(k.flySpeed, 1.05)
          : k.flySpeed) *
          Qs(0, 0.55, u)) /
        Math.max(u, 0.001);
      let p = (s * c - a.vx) * 2.1,
        i = (l * c - a.vy) * 2.1,
        m = (r * c - a.vz) * 2.1;
      const f = a.seed;
      ((p += Math.sin(e * 1.3 + f) * 0.55 + Math.sin(e * 3.7 + f * 2) * 0.28),
        (i += Math.sin(e * 1.7 + f * 3) * 0.42 + Math.sin(e * 4.3 + f) * 0.2),
        (m += Math.cos(e * 1.1 + f * 5) * 0.55 + Math.cos(e * 3.1 + f) * 0.28));
      const v = ut.heightAt(a.x, a.z) + 0.085;
      (a.y < v && (i += (v - a.y) * 26),
        (a.vx += p * t),
        (a.vy += i * t),
        (a.vz += m * t),
        (a.x += a.vx * t),
        (a.y += a.vy * t),
        (a.z += a.vz * t));
      const D = 0.5 + 0.5 * Math.sin(e * (1.5 + n * 0.37) + f),
        O = (0.55 + 0.45 * D * D) * a.level;
      (a.u.value.set(a.x, a.y, a.z, O),
        (ea[n].value =
          a.scale *
          Math.max(0.14, Math.min(1.4, z.position.distanceTo(a.u.value) / 6))));
      const K = Math.hypot(a.vx, a.vy, a.vz);
      for (a.emit += t * (9 + K * 60) * a.level * a.scale; a.emit > 1; ) {
        a.emit -= 1;
        const X = Ys++ % Ea,
          P = X * 4,
          C = Math.random() * 6.283,
          B = Math.random() * 0.016;
        ((Qe[P] = a.x + Math.cos(C) * B),
          (Qe[P + 1] = a.y + (Math.random() - 0.5) * 0.016),
          (Qe[P + 2] = a.z + Math.sin(C) * B),
          (Qe[P + 3] = e),
          (ta[P] = -a.vx * 0.09 + (Math.random() - 0.5) * 0.05),
          (ta[P + 1] = 0.03 + Math.random() * 0.05 - a.vy * 0.09),
          (ta[P + 2] = -a.vz * 0.09 + (Math.random() - 0.5) * 0.05),
          (ta[P + 3] = 1.2 + Math.random() * 1.9));
      }
    }),
    (ce.attributes.aEmber.needsUpdate = !0),
    (ce.attributes.aDrift.needsUpdate = !0));
}
const Qs = (t, e, a) => {
    const n = Math.min(1, Math.max(0, (a - t) / (e - t)));
    return n * n * (3 - 2 * n);
  },
  _t = { next: 30, end: -1 };
function On() {
  const t = va.elapsedTime;
  t < _t.end ? ((_t.end = t), (_t.next = t + 90)) : (_t.end = t + 1e6);
}
function t0(t, e) {
  const a = e < _t.end;
  if (
    (k.weather &&
      e > _t.next &&
      !a &&
      Yt.value >= 1.3 &&
      ((_t.end = e + 14), (_t.next = e + 58)),
    l0(a),
    (ne.value += ((a ? 1 : 0) - ne.value) * Math.min(1, t * 0.7)),
    (fa.visible = ne.value > 0.01),
    (Ut.value = a
      ? Math.min(1, Ut.value + t / 7)
      : Math.max(0, Ut.value - t / 75)),
    (Pe.value = 1 - 0.42 * ne.value),
    (da.visible = Ut.value > 0.005),
    a)
  )
    for (let n = 0; n < 3; n++) {
      if (Math.random() > t * 28) continue;
      const o = Math.random() * 6.283,
        s = Math.sqrt(Math.random()) * 1.5;
      ba(
        Math.cos(o) * s,
        Math.sin(o) * s,
        0.055,
        (Math.random() - 0.5) * 0.7,
        (Math.random() - 0.5) * 0.7,
        0.5,
      );
    }
}
const w = (t, e, a) => new lt(t, e, a),
  ct = (...t) => new vs(t, !1, "centripetal"),
  qo = (t, e, a) => w(t, ut.heightAt(t, e) + a, e),
  [w0, Ua] = [Xt[0], Xt[1]],
  Je = w(Ct.x, Ct.y, Ct.z),
  Vo = w(Ua.x, Ua.y, Ua.z),
  Ja = (t) =>
    w(Ct.x + Math.sin(t) * 3.7, Ct.y + 0.42, Ct.z + Math.cos(t) * 3.7),
  xe = {
    wide: {
      dur: 9,
      fov: [10, 9.6],
      roll: [0.5, -0.3],
      focal: 60,
      far: !0,
      pos: ct(w(-9, 0.5, 22), w(-3.5, 0.8, 23.5), w(2.6, 1.1, 23)),
      tgt: ct(w(0.25, 0.7, 0), w(0.2, 0.72, 0), w(0.15, 0.74, 0)),
      focus: ct(w(0, 0.2, 1.1), w(0, 0.2, 1.1)),
    },
    glide: {
      dur: 8,
      fov: [19, 19],
      roll: [-0.8, 0.4],
      focal: 4.5,
      pos: ct(w(-1.8, 0.72, 3.1), w(-1, 0.7, 3.25), w(-0.2, 0.7, 3.2)),
      tgt: ct(w(-0.75, 0.56, 0.7), w(-0.1, 0.58, 0.65), w(0.5, 0.6, 0.6)),
      focus: ct(
        qo(-0.75, 1.32, 0.1),
        qo(-0.2, 1.25, 0.1),
        Je.clone().add(w(-0.1, 0, 0.15)),
      ),
    },
    portrait: {
      dur: 9,
      fov: [13.5, 12.2],
      roll: [0, 0],
      focal: 2.6,
      pos: ct(Ja(0.82), Ja(0.6), Ja(0.38)),
      tgt: ct(
        Je.clone().add(w(-0.17, 0.04, 0)),
        Je.clone().add(w(-0.15, 0.04, 0)),
      ),
      focus: ct(Je, Je),
    },
    crossing: {
      dur: 8,
      fov: [15.5, 15],
      roll: [0, 0],
      focal: 5,
      actor: ct(
        w(-1.5, 0.85, 1.3),
        w(-0.75, 0.62, 1.2),
        w(-0.05, 0.72, 0.9),
        w(0.65, 0.95, 0.45),
      ),
      pos: ct(w(-2.5, 0.72, 4.9), w(-2.4, 0.71, 4.72)),
      tgt: ct(w(-0.25, 0.55, 0.55), w(-0.22, 0.55, 0.55)),
      focusActor: !0,
    },
    rise: {
      dur: 11,
      fov: [15, 11.5],
      roll: [-0.5, 0.2],
      focal: 60,
      far: !0,
      pos: ct(
        Vo.clone().add(w(0.8, 0.5, 3.7)),
        w(1.7, 1.7, 9),
        w(3.6, 3.7, 19.5),
      ),
      tgt: ct(Vo, w(0.2, 0.45, 0), w(0, 0.25, 0)),
      focusOnTarget: !0,
    },
    macro: {
      dur: 8,
      fov: [16, 15],
      roll: [0.7, -0.3],
      focal: 2.2,
      pos: ct(w(-0.8, 1.2, 2.65), w(-0.62, 1.1, 2.45), w(-0.46, 1.02, 2.28)),
      tgt: ct(w(-0.22, 0.32, 0.95), w(-0.18, 0.32, 0.92)),
      focusDist: [1.45, 2.05],
    },
    under: {
      dur: 8,
      fov: [12.5, 11.8],
      roll: [1.2, 0.3],
      focal: 60,
      far: !0,
      pos: ct(w(7, -4.2, 15.5), w(4.4, -3.9, 17), w(1.8, -3.6, 18)),
      tgt: ct(w(0, 0.42, 0), w(-0.05, 0.46, 0)),
      focus: ct(w(0, -0.2, 1), w(0, -0.2, 1)),
    },
  };
G.get("dur") && xe[ke] && (xe[ke].dur = +G.get("dur"));
const Go = ["wide", "glide", "portrait", "crossing", "rise", "macro", "under"],
  g = {
    forced: ke,
    shot: null,
    t: +(G.get("at") || 0),
    reelI: -1,
    active: !1,
    focalK: 1,
    bars: 0,
    snap: !1,
    cutReady: !0,
    sawWet: !1,
    fovBack: !1,
  },
  tt = { p: new lt(), t: new lt(), f: new lt() },
  Ot = document.querySelector("#dissolve"),
  Uo = Ot?.getContext("2d");
function e0() {
  if (g.forced) {
    const t = g.forced;
    return ((g.forced = null), t);
  }
  return Ut.value > 0.3 && ne.value < 0.7 && !g.sawWet
    ? ((g.sawWet = !0), "macro")
    : ((g.reelI = (g.reelI + 1) % Go.length), Go[g.reelI]);
}
function a0() {
  !Ot ||
    !Ot.width ||
    Nt ||
    ((Ot.style.transition = "none"),
    (Ot.style.opacity = 1),
    Ot.offsetWidth,
    (Ot.style.transition = "opacity .9s cubic-bezier(.45,0,.55,1)"),
    (Ot.style.opacity = 0));
}
function o0() {
  if (!Uo || Ba) return;
  const t = Math.min(Rt.width, 1400),
    e = Math.round((t * Rt.height) / Rt.width);
  ((Ot.width !== t || Ot.height !== e) && ((Ot.width = t), (Ot.height = e)),
    Uo.drawImage(Rt, 0, 0, t, e));
}
function n0(t, e) {
  ne.value > 0.5 && (g.sawWet = !1);
  const a =
      k.director && !ht && !he && !Sa && Yt.value >= 1.25 && e - Oa > 12e3,
    n = $t ? 0.03 : 0.04;
  if (!a) {
    if (
      (g.active &&
        ((g.shot = null),
        (g.cutReady = !0),
        z.up.set(0, 1, 0),
        (oe[0].hold = 0),
        (g.fovBack = !0),
        H.target.copy(tt.t)),
      g.fovBack)
    ) {
      const u = Math.tan((z.fov * Math.PI) / 360);
      ((z.fov += (24 - z.fov) * Math.min(1, t * 1.5)),
        z.updateProjectionMatrix(),
        z.position
          .sub(H.target)
          .multiplyScalar(u / Math.tan((z.fov * Math.PI) / 360))
          .add(H.target),
        Math.abs(z.fov - 24) < 0.05 && (g.fovBack = !1));
    }
    return (
      (g.active = !1),
      (g.bars += (0 - g.bars) * Math.min(1, t * 3)),
      (yo.value = g.bars * n),
      Mo.forEach((u) => {
        u.style.opacity = 1;
      }),
      (pe = null),
      !1
    );
  }
  if (
    ((g.active = !0),
    (g.fovBack = !1),
    (g.bars += ((k.letterbox ? 1 : 0) - g.bars) * Math.min(1, t * 1.2)),
    (yo.value = g.bars * n),
    Mo.forEach((u) => {
      u.style.opacity = 0;
    }),
    g.shot && ((g.t += t), !Nt && g.t > xe[g.shot].dur - 0.2 && (g.snap = !0)),
    g.cutReady || !g.shot)
  ) {
    const u = !!g.shot;
    ((oe[0].hold = 0),
      (g.shot = e0()),
      (g.cutReady = !1),
      (g.snap = !1),
      (g.t = u ? 0 : g.t * xe[g.shot].dur),
      a0());
  }
  const o = xe[g.shot],
    s = Math.min(1, g.t / o.dur),
    l = s * 0.82 + s * s * (3 - 2 * s) * 0.18,
    r = o.far ? ya : Math.min(1.5, ya);
  if (
    (o.pos.getPoint(l, tt.p),
    o.tgt.getPoint(l, tt.t),
    o.focus &&
      !o.far &&
      z.aspect < 1 &&
      g.shot === "portrait" &&
      o.focus.getPoint(l, tt.t),
    r !== 1 && tt.p.sub(tt.t).multiplyScalar(r).add(tt.t),
    z.position.copy(tt.p),
    (z.fov = o.fov[0] + (o.fov[1] - o.fov[0]) * l),
    z.updateProjectionMatrix(),
    z.up.set(0, 1, 0),
    z.lookAt(tt.t),
    z.rotateZ(((o.roll[0] + (o.roll[1] - o.roll[0]) * l) * Math.PI) / 180),
    z.updateMatrixWorld(),
    H.target.copy(tt.t),
    o.actor)
  ) {
    const u = oe[0];
    (o.actor.getPoint(Math.min(1, l + 0.03), tt.f),
      (u.wx = tt.f.x),
      (u.wy = tt.f.y),
      (u.wz = tt.f.z),
      (u.hold = 1),
      s < 0.02 &&
        (o.actor.getPoint(0, tt.f),
        (u.x = tt.f.x),
        (u.y = tt.f.y),
        (u.z = tt.f.z),
        (u.vx = u.vy = u.vz = 0),
        (u.level = 1)));
  }
  return (
    o.focusActor
      ? (pe = z.position.distanceTo(tt.f.set(oe[0].x, oe[0].y, oe[0].z)))
      : o.focusOnTarget
        ? (pe = z.position.distanceTo(tt.t) - (1 - l) * 0.3)
        : o.focusDist
          ? (pe =
              o.focusDist[0] +
              (o.focusDist[1] - o.focusDist[0]) *
                s0(Math.min(1, Math.max(0, (s - 0.2) / 0.55))) *
                r +
              o.focusDist[0] * (r - 1))
          : (o.focus.getPoint(l, tt.f), (pe = z.position.distanceTo(tt.f))),
    !0
  );
}
const s0 = (t) => t * t * (3 - 2 * t),
  Mo = ["#title", "#hint"]
    .map((t) => document.querySelector(t))
    .filter(Boolean);
Mo.forEach((t) => {
  t.style.transition = "opacity .8s";
});
const Ta = document.querySelector("#btn-cinematic"),
  xo = document.querySelector("#btn-rain");
let Jo = null;
function l0(t) {
  t !== Jo && xo && ((Jo = t), xo.setAttribute("aria-pressed", t));
}
function Hn(t) {
  if (t === k.director) {
    Ta?.setAttribute("aria-pressed", t);
    return;
  }
  ((k.director = t),
    Ta?.setAttribute("aria-pressed", t),
    t && (Oa = -1e9),
    qn?.({ "auto camera": t }));
}
Ta?.setAttribute("aria-pressed", k.director);
Ta?.addEventListener("click", () => Hn(!k.director));
xo?.addEventListener("click", () => On());
const Yo = { emitAt: 0 };
function u0(t, e) {
  const a = Ct.r * 0.56,
    n = Math.sin(e * 0.83) * Math.cos(e * 0.31 + 1) + 0.25 * Math.sin(e * 3.7),
    o = Math.sin(e * 0.61 + 2) * 0.8 + 0.2 * Math.sin(e * 4.9 + 1),
    s = Math.cos(e * 0.71) * Math.sin(e * 0.37) + 0.25 * Math.cos(e * 3.1),
    l = Ct.x + n * a,
    r = Ct.y + o * a,
    u = Ct.z + s * a,
    c = 0.5 + 0.5 * Math.sin(e * 1.7),
    p = (0.5 + 0.5 * c * c) * Math.min(1, Math.max(0, (Yt.value - 0.5) * 1.5));
  if (
    (ha.value.set(l, r, u, p),
    Aa.value.set(Ct.x, Ct.y, Ct.z, p * 0.9),
    (kn.value =
      Math.max(0.2, Math.min(1, z.position.distanceTo(Aa.value) / 6)) * 0.9),
    e > Yo.emitAt)
  ) {
    Yo.emitAt = e + 0.11;
    for (let i = Xe.length - 1; i > 0; i--) Xe[i].value.copy(Xe[i - 1].value);
    Xe[0].value.set(l, r, u);
  }
}
let jn = 0,
  Ya = 0,
  Xa = performance.now(),
  pa = 0,
  Xo = !0;
const r0 = (t) => t * t * t * (t * (6 * t - 15) + 10),
  c0 = new lt(),
  i0 = new lt();
window.moss = {
  stamp: ba,
  uWet: Ut,
  cut: (t) => {
    ((g.forced = t), (g.cutReady = !0));
  },
  firstFrame: () => jn,
  dir: g,
  flies: oe,
  sky: _t,
  renderer: Y,
  camera: z,
  controls: H,
  uGrow: Yt,
  marbles: Xt,
  stamp: ba,
  stats: () => ({
    verts: bn,
    hiD: +De.value.toFixed(2),
    fps: pa,
    buildMs: Cs,
    pr: Y.getPixelRatio(),
    size: [Rt.width, Rt.height],
  }),
};
const Ka = new lt(),
  Ko = () => {
    const t = Math.min(va.getDelta(), 0.05);
    if (
      (!he && Yt.value < 1.5 && (Yt.value = Math.min(1.5, Yt.value + t / 8.5)),
      Ns(Math.min(t, 0.1), ne.value),
      ht)
    ) {
      ht.t += t;
      const o = r0(Math.min(1, ht.t / ht.dur));
      (z.position.copy(c0.lerpVectors(ht.from, ht.to, o)),
        H.target.copy(i0.lerpVectors(ht.fromT, ht.toT, o)),
        ht.t >= ht.dur && (ht = null));
    }
    const e = n0(t, performance.now());
    if (((H.autoRotate = !ht && !he && !e && !k.director), !ht && !e)) {
      const o = z.position.distanceTo(H.target);
      ((H.minDistance = Ne ? 0.55 : 2.5),
        Ne && o > 3.4 && (Ne = !1),
        !Ne &&
          H.target.distanceTo(na) > 0.001 &&
          H.target.lerp(na, 1 - Math.exp(-t * 2.5)));
    } else H.minDistance = 0.2;
    if (!e) {
      H.update();
      const o = z.position,
        s = o.length(),
        l = ut.radius(o.x, o.y, o.z, s) + 0.3;
      s < l && o.multiplyScalar(l / s);
      for (const r of Xt) {
        const u = o.x - r.x,
          c = o.y - r.y,
          p = o.z - r.z,
          i = Math.hypot(u, c, p),
          m = r.r * 2.2;
        i < m &&
          i > 0.001 &&
          o.set(r.x + (u / i) * m, r.y + (c / i) * m, r.z + (p / i) * m);
      }
    }
    if ((Zs++ & 7) === 0) {
      z.getWorldDirection(Oo);
      const o = ut.hit(z.position, Oo);
      o
        ? (Ue = z.position.distanceTo(o))
        : (Ue = z.position.distanceTo(H.target));
    }
    (pe !== null && (Ue = pe),
      zn(),
      (Ke.value = e ? Ue : Ke.value + (Ue - Ke.value) * Math.min(1, t * 3)),
      Ka.set(0, 0.55, 0).project(z),
      Cn.value.set(Ka.x * 0.5 + 0.5, -Ka.y * 0.5 + 0.5),
      (Rn.value = z.aspect));
    const a = va.elapsedTime;
    ((Tt.value = a),
      En(t, a),
      t0(t, a),
      u0(t, a),
      Y.compute(yn),
      (Ln.value = e ? xe[g.shot].focal : Math.max(1.8, Ke.value * k.focalK)),
      we.render(),
      g.snap && (o0(), (g.snap = !1), (g.cutReady = !0)),
      Xo && ((Xo = !1), (jn = Math.round(performance.now()))),
      Ya++);
    const n = performance.now();
    if (
      n - Xa > 1e3 &&
      ((pa = Math.round((Ya * 1e3) / (n - Xa))),
      (Ya = 0),
      (Xa = n),
      k.autoRes && !G.has("pr") && n - nn > 6e3)
    ) {
      const o = Y.getPixelRatio();
      pa < 40 && o > 1.25
        ? Y.setPixelRatio(Math.max(1.25, o - 0.05))
        : pa > 56 && o < Qa && Y.setPixelRatio(Math.min(Qa, o + 0.1));
    }
  };
let qn = null;
const m0 = Jn(G, (t) => {
  (sn.value.set(...(t?.key ?? ee)).normalize(),
    t
      ? (ro.value.set(t.keyColor).multiplyScalar(t.keyLevel / 4.4),
        co.value.set(t.fill).multiplyScalar(t.env))
      : (ro.value.setRGB(1, 0.86, 0.62), co.value.setRGB(0.32, 0.52, 0.72)));
});
function d0() {
  const [, t] = ys(() => ({
    Studio: m0,
    Performance: ia(
      {
        detail: {
          value: k.detail,
          min: 1.5,
          max: 9,
          step: 0.1,
          label: "far density",
          onChange: (e) => {
            k.detail = e;
          },
        },
        "near range": {
          value: k.lodDistance,
          min: 0.4,
          max: 2.4,
          step: 0.05,
          onChange: (e) => {
            ((k.lodDistance = e), (De.value = e));
          },
        },
        "auto resolution": {
          value: k.autoRes,
          onChange: (e) => {
            k.autoRes = e;
          },
        },
        resolution: {
          value: Y.getPixelRatio(),
          min: 0.75,
          max: 2,
          step: 0.05,
          onChange: (e, a, n) => {
            n.initial || ((k.autoRes = !1), Y.setPixelRatio(e));
          },
        },
      },
      { collapsed: !0 },
    ),
    Life: ia({
      "auto camera": {
        value: k.director,
        onChange: (e) => {
          Hn(e);
        },
      },
      letterbox: {
        value: k.letterbox,
        onChange: (e) => {
          k.letterbox = e;
        },
      },
      "rain showers": {
        value: k.weather,
        onChange: (e) => {
          k.weather = e;
        },
      },
      rain: Ms(() => On()),
      fireflies: {
        value: k.flyCount,
        min: 0,
        max: 3,
        step: 1,
        onChange: (e) => {
          k.flyCount = e;
        },
      },
      "firefly speed": {
        value: k.flySpeed,
        min: 0.1,
        max: 2,
        step: 0.01,
        onChange: (e) => {
          k.flySpeed = e;
        },
      },
      "firefly light": {
        value: wa.value,
        min: 0,
        max: 5,
        step: 0.01,
        onChange: (e) => {
          wa.value = e;
        },
      },
      wind: {
        value: ga.value,
        min: 0,
        max: 4,
        step: 0.01,
        onChange: (e) => {
          ga.value = e;
        },
      },
    }),
    Shading: ia({
      sun: {
        value: eo.value,
        min: 0,
        max: 5,
        step: 0.01,
        onChange: (e) => {
          eo.value = e;
        },
      },
      fill: {
        value: to.value,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (e) => {
          to.value = e;
        },
      },
      sky: {
        value: ao.value,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (e) => {
          ao.value = e;
        },
      },
      "back glow": {
        value: Ma.value,
        min: 0,
        max: 5,
        step: 0.01,
        onChange: (e) => {
          Ma.value = e;
        },
      },
      "baked AO": {
        value: xa.value,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (e) => {
          xa.value = e;
        },
      },
      "screen AO": {
        value: k.screenAO,
        onChange: (e, a, n) => {
          n.initial || Ks(e);
        },
      },
      "screen AO amount": {
        value: lo.value,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          lo.value = e;
        },
      },
      "leaf width": {
        value: oo.value,
        min: 0.05,
        max: 0.3,
        step: 0.005,
        onChange: (e) => {
          oo.value = e;
        },
      },
      "mid colour": {
        value: "#265119",
        onChange: (e) => {
          ln.value.set(e);
        },
      },
      "tip colour": {
        value: "#648e1e",
        onChange: (e) => {
          un.value.set(e);
        },
      },
    }),
    Lens: ia({
      exposure: {
        value: Y.toneMappingExposure,
        min: 0.3,
        max: 2.5,
        step: 0.01,
        onChange: (e) => {
          Y.toneMappingExposure = e;
        },
      },
      bloom: {
        value: vo.strength.value,
        min: 0,
        max: 1,
        step: 0.005,
        onChange: (e) => {
          vo.strength.value = e;
        },
      },
      blur: {
        value: k.bokeh,
        min: 0,
        max: 5,
        step: 0.05,
        onChange: (e) => {
          Wn.value = e;
        },
      },
      "focus range": {
        value: k.focalK,
        min: 0.03,
        max: 0.6,
        step: 0.005,
        onChange: (e) => {
          k.focalK = e;
        },
      },
      vignette: {
        value: no.value,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          no.value = e;
        },
      },
      grain: {
        value: so.value,
        min: 0,
        max: 0.06,
        step: 0.001,
        onChange: (e) => {
          so.value = e;
        },
      },
    }),
    ...ws({ renderer: Y, pipeline: we }),
  }));
  return ((qn = t), null);
}
!Ba &&
  !Nt &&
  !$t &&
  ms.createRoot(document.querySelector("#controls")).render(
    ca.createElement(
      ca.Fragment,
      null,
      ca.createElement(ds, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      ca.createElement(d0),
    ),
  );
Ba &&
  setTimeout(
    () => {
      ((k.autoRes = !1),
        Y.setAnimationLoop(null),
        we.render(),
        Rt.toBlob(
          (t) =>
            fetch(`http://localhost:${G.get("port")}/thumb`, {
              method: "POST",
              body: t,
            }),
          "image/jpeg",
          0.92,
        ));
    },
    +(G.get("after") || 9e3),
  );
{
  const t = sa.shoots[0].high,
    e = fa.visible,
    a = da.visible;
  ((t.visible = fa.visible = da.visible = !0),
    zn(),
    (t.visible = !0),
    Y.compute(yn),
    we.render(),
    (t.visible = !1),
    (fa.visible = e),
    (da.visible = a),
    await Y.backend.device?.queue.onSubmittedWorkDone());
}
if (Nt) {
  G.has("rain") && ((_t.end = 1e9), (ne.value = 1));
  for (let o = 0; o < 300; o++) En(1 / 60, va.elapsedTime - (300 - o) / 60);
  const t = +G.get("frames"),
    e = +(G.get("every") || 1),
    a = G.get("port"),
    n = async (o) => {
      const s = await new Promise((l) => Rt.toBlob(l, "image/png"));
      await fetch(`http://localhost:${a}/frame?i=${o}`, {
        method: "POST",
        body: s,
      });
    };
  for (let o = 0, s = 0; o < t; o++)
    (Ko(),
      o % e === 0
        ? await n(s++)
        : await Y.backend.device.queue.onSubmittedWorkDone());
  await fetch(`http://localhost:${a}/done`);
} else Y.setAnimationLoop(Ko);
document.body.classList.add("ready");
