import "../lib/modulepreload-polyfill.js";
import { s as Ha } from "../lib/studio-presets.js";
import {
  u as J,
  aj as Oa,
  P as Va,
  a1 as U0,
  D as _0,
  n as _,
  Q as He,
  E as ce,
  z as wt,
  am as G0,
  g as r,
  af as V,
  m as I,
  b as l,
  y as Y,
  q as ft,
  H as gt,
  an as Oe,
  c as Tt,
  ak as X0,
  Y as de,
  Z as kt,
  a as d0,
  J as ie,
  ao as z0,
  A as At,
  F as pe,
  ap as Ve,
  aq as Ue,
  G as Ua,
  e as Y0,
  f as Wt,
  K as n0,
  s as Zt,
  a6 as Ee,
  a7 as t0,
  ar as R0,
  a8 as _a,
  S as Ga,
  as as K0,
  at as $0,
  O as Xa,
  ae as Z0,
  au as Ya,
  x as c0,
  r as s0,
  p as Ka,
  B as Ot,
  k as $a,
  R as Za,
  l as Qa,
  av as Q0,
  X as J0,
  T as I0,
  i as Ja,
  C as tn,
  a4 as oe,
  I as Kt,
} from "../lib/stage.js";
import { R as en } from "../lib/RoomEnvironment.js";
import { O as an } from "../lib/OrbitControls.js";
import {
  V as K,
  B as L0,
  t as be,
  e as Pt,
  aO as ta,
  N as ea,
  aH as aa,
  aX as na,
  S as nn,
  P as sn,
  D as on,
  aY as ln,
  p as _e,
  aZ as un,
  R as Ce,
  E as o0,
  aK as sa,
  a_ as mn,
  aI as oa,
  a$ as la,
  as as rn,
  aL as i0,
  M as te,
  aM as Ge,
  ap as Xe,
  a3 as dn,
  b0 as cn,
  o as pn,
  aq as hn,
  b1 as fn,
  b2 as ua,
  f as ma,
  aP as bn,
  I as ra,
  d as da,
  aC as gn,
  C as wn,
  c as vn,
  r as Re,
  L as Mn,
  Q as ca,
  u as yn,
  g as Gt,
  aW as xn,
  b3 as Cn,
} from "../lib/leva.js";
import "../lib/three.js";
import { r as An } from "../lib/rendering-panel.js";
const at = 10,
  Sn = 1.15,
  Pn = p0(31),
  Et = 0.38,
  Tn = Array.from({ length: 6 }, (t, e) => ({
    k: e + 2,
    a: 0.05 / (1 + e * 0.55),
    b: Pn() * 6.283,
  })),
  Nn = [
    { c: 0.9, w: 0.08, h: 0.18 },
    { c: 2.15, w: 0.06, h: 0.26 },
    { c: 3.3, w: 0.09, h: 0.14 },
    { c: 4.25, w: 0.055, h: 0.3 },
    { c: 5.2, w: 0.07, h: 0.2 },
  ];
function ia(t) {
  let e = Et;
  for (const { k: a, a: s, b: m } of Tn) e += s * Math.cos(a * t + m);
  for (const { c: a, w: s, h: m } of Nn) {
    const c = Math.atan2(Math.sin(t - a), Math.cos(t - a));
    e += m * Math.exp((-c * c) / (2 * s * s));
  }
  return e;
}
function p0(t) {
  return () => {
    t = (t + 1831565813) | 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    return (
      (e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e),
      ((e ^ (e >>> 14)) >>> 0) / 4294967296
    );
  };
}
function De(t) {
  const e = p0(t),
    a = new Uint8Array(512),
    s = Array.from({ length: 256 }, (n, d) => d);
  for (let n = 255; n > 0; n--) {
    const d = Math.floor(e() * (n + 1));
    [s[n], s[d]] = [s[d], s[n]];
  }
  for (let n = 0; n < 512; n++) a[n] = s[n & 255];
  const m = (n) => n * n * n * (n * (n * 6 - 15) + 10),
    c = (n, d, u) => d + n * (u - d),
    h = (n, d, u, b) => {
      n &= 15;
      const w = n < 8 ? d : u,
        v = n < 4 ? u : n === 12 || n === 14 ? d : b;
      return (n & 1 ? -w : w) + (n & 2 ? -v : v);
    };
  return (n, d, u) => {
    const b = Math.floor(n) & 255,
      w = Math.floor(d) & 255,
      v = Math.floor(u) & 255;
    ((n -= Math.floor(n)), (d -= Math.floor(d)), (u -= Math.floor(u)));
    const y = m(n),
      F = m(d),
      S = m(u),
      D = a[b] + w,
      M = a[D] + v,
      E = a[D + 1] + v,
      j = a[b + 1] + w,
      tt = a[j] + v,
      O = a[j + 1] + v;
    return (
      c(
        S,
        c(
          F,
          c(y, h(a[M], n, d, u), h(a[tt], n - 1, d, u)),
          c(y, h(a[E], n, d - 1, u), h(a[O], n - 1, d - 1, u)),
        ),
        c(
          F,
          c(y, h(a[M + 1], n, d, u - 1), h(a[tt + 1], n - 1, d, u - 1)),
          c(y, h(a[E + 1], n, d - 1, u - 1), h(a[O + 1], n - 1, d - 1, u - 1)),
        ),
      ) * 0.9
    );
  };
}
function zn({
  seed: t = 11,
  cols: e = 1080,
  rows: a = 520,
  outerRows: s = 200,
  wallRows: m = 14,
  bands: c = 10,
  sectors: h = 12,
} = {}) {
  const n = De(t),
    d = De(t + 101),
    u = De(t + 202),
    b = (o, i, f, g, z, T = 0.5) => {
      let x = 0,
        B = 1,
        P = 0;
      for (let R = 0; R < z; R++)
        ((x += B * o(i, f, g)),
          (P += B),
          (B *= T),
          (i *= 2.03),
          (f *= 2.03),
          (g *= 2.03));
      return x / P;
    },
    w = (o, i, f, g) => {
      let z = 0,
        T = 0.5,
        x = 1;
      for (let B = 0; B < g; B++) {
        let P = 1 - Math.abs(n(o, i, f));
        ((P *= P),
          (z += P * T * x),
          (x = Math.min(1, P * 2)),
          (T *= 0.5),
          (o *= 2.1),
          (i *= 2.1),
          (f *= 2.1));
      }
      return z;
    },
    v = -0.05,
    y = (o, i, f) => {
      const g = b(n, o * 2.1 + 5, i * 2.1, f * 2.1, 2),
        z = b(n, o * 2.1, i * 2.1 + 9, f * 2.1, 2),
        T = b(n, o * 2.1, i * 2.1, f * 2.1 + 17, 2),
        x =
          b(
            n,
            o * 1.15 + g * 0.55,
            i * 1.15 + z * 0.55,
            f * 1.15 + T * 0.55,
            6,
          ) *
            1.6 -
          v,
        B = je(0.06, 0.5, x);
      let P = x > 0 ? Math.pow(x, 1.15) * 1.1 : x * 0.9;
      if (x > -0.02) {
        const k = je(-0.02, 0.06, x);
        ((P +=
          Math.pow(w(o * 2.6 + g * 0.3, i * 2.6, f * 2.6 + T * 0.3, 5), 2) *
          1.05 *
          B),
          (P += b(u, o * 9, i * 9, f * 9, 5) * 0.16 * (0.2 + B) * k),
          (P += Math.abs(b(u, o * 31, i * 31, f * 31, 3)) * 0.05 * B));
      }
      const R =
        b(d, o * 1.9 + g * 0.4, i * 1.9, f * 1.9 + T * 0.4, 5) * 0.75 +
        0.5 -
        Math.max(0, P - 0.8) * 0.15;
      return [P, R];
    },
    F = (o, i, f) => {
      const [g, z] = y(i, f, o);
      return [Math.max(0, g) * 0.18, z, g];
    },
    S = Float32Array.from({ length: e }, (o, i) => ia((i / e) * Math.PI * 2)),
    D = (o, i) => {
      const f = (i / e) * Math.PI * 2,
        g = Math.sin(o);
      return [g * Math.cos(f), Math.cos(o), g * Math.sin(f)];
    },
    M = e,
    E = a + 1,
    j = new Float32Array(M * E * 3),
    tt = new Float32Array(M * E),
    O = new Float32Array(M * E),
    vt = new Float32Array(M * E);
  for (let o = 0; o < E; o++)
    for (let i = 0; i < M; i++) {
      const f = S[i] + (o / a) * (Math.PI - S[i]),
        [g, z, T] = D(f, i),
        [x, B] = y(g, z, T),
        P = o * M + i,
        R = je(0.42, 0.2, Math.acos(Math.max(-1, Math.min(1, -z)))),
        k = x + (Math.min(x, -0.25) - x) * R,
        Q = at - Math.max(0, k);
      ((j[P * 3] = g * Q),
        (j[P * 3 + 1] = z * Q),
        (j[P * 3 + 2] = T * Q),
        (tt[P] = k),
        (O[P] = B),
        (vt[P] = b(d, g * 7 + 11, z * 7, T * 7, 3)));
    }
  const Z = new Float32Array(M * E * 3),
    ct = (o) => [j[o * 3], j[o * 3 + 1], j[o * 3 + 2]];
  for (let o = 0; o < E; o++)
    for (let i = 0; i < M; i++) {
      const f = o * M + i,
        g = ct(o * M + ((i + 1) % M)),
        z = ct(o * M + ((i - 1 + M) % M)),
        T = ct(Math.min(E - 1, o + 1) * M + i),
        x = ct(Math.max(0, o - 1) * M + i),
        B = [g[0] - z[0], g[1] - z[1], g[2] - z[2]],
        P = [T[0] - x[0], T[1] - x[1], T[2] - x[2]];
      let R = B[1] * P[2] - B[2] * P[1],
        k = B[2] * P[0] - B[0] * P[2],
        Q = B[0] * P[1] - B[1] * P[0];
      const ut = ct(f),
        yt = Math.hypot(R, k, Q);
      if (yt < 1e-9 || o === E - 1) {
        const et = Math.hypot(...ut);
        ((R = -ut[0] / et), (k = -ut[1] / et), (Q = -ut[2] / et));
      } else {
        const et = (R * ut[0] + k * ut[1] + Q * ut[2] > 0 ? -1 : 1) / yt;
        ((R *= et), (k *= et), (Q *= et));
      }
      ((Z[f * 3] = R), (Z[f * 3 + 1] = k), (Z[f * 3 + 2] = Q));
    }
  const Mt = new Float32Array(M * E),
    St = new Float32Array(M * E),
    it = 7;
  for (let o = 0; o < E; o++)
    for (let i = 0; i < M; i++) {
      let f = 0;
      for (let g = -it; g <= it; g++)
        f += Math.max(0, tt[o * M + ((i + g + M) % M)]);
      St[o * M + i] = f / (2 * it + 1);
    }
  for (let o = 0; o < E; o++)
    for (let i = 0; i < M; i++) {
      let f = 0;
      for (let g = -it; g <= it; g++)
        f += St[Math.min(E - 1, Math.max(0, o + g)) * M + i];
      Mt[o * M + i] = f / (2 * it + 1);
    }
  const bt = [],
    Nt = a / c,
    zt = e / h;
  for (let o = 0; o < c; o++)
    for (let i = 0; i < h; i++) {
      const f = Math.round(o * Nt),
        g = Math.round((o + 1) * Nt),
        z = i * zt,
        T = z + zt,
        x = new K();
      for (let P = f; P <= g; P += 4)
        for (let R = z; R <= T; R += 4) {
          const k = (P * M + (R % M)) * 3;
          ((x.x += j[k]), (x.y += j[k + 1]), (x.z += j[k + 2]));
        }
      x.divideScalar(Math.ceil((g - f + 1) / 4) * Math.ceil((T - z + 1) / 4));
      const B = [1, 2, 4, 8].map((P) => {
        const R = [],
          k = [];
        for (let q = f; q < g; q += P) R.push(q);
        R.push(g);
        for (let q = z; q < T; q += P) k.push(q);
        k.push(T);
        const Q = R.length,
          ut = k.length,
          yt = Q * ut + 2 * (Q + ut),
          et = new Float32Array(yt * 3),
          Dt = new Float32Array(yt * 3),
          jt = new Float32Array(yt * 4);
        let mt = 0;
        const fe = (q, W, rt) => {
          const xt = q * M + (W % M),
            It = xt * 3,
            Je = rt ? 1 + 0.025 : 1;
          return (
            (et[mt * 3] = j[It] * Je - x.x),
            (et[mt * 3 + 1] = j[It + 1] * Je - x.y),
            (et[mt * 3 + 2] = j[It + 2] * Je - x.z),
            (Dt[mt * 3] = Z[It]),
            (Dt[mt * 3 + 1] = Z[It + 1]),
            (Dt[mt * 3 + 2] = Z[It + 2]),
            (jt[mt * 4] = tt[xt]),
            (jt[mt * 4 + 1] = O[xt]),
            (jt[mt * 4 + 2] = Pt.clamp(
              1 + (Math.max(0, tt[xt]) - Mt[xt]) * 1.5,
              0.35,
              1.15,
            )),
            (jt[mt * 4 + 3] = vt[xt]),
            mt++
          );
        };
        for (const q of R) for (const W of k) fe(q, W, !1);
        const Qe = [],
          ee = (q, W) => q * ut + W,
          Wa = (q, W, rt, xt) => Qe.push(q, rt, W, W, rt, xt);
        for (let q = 0; q < Q - 1; q++)
          for (let W = 0; W < ut - 1; W++)
            Wa(ee(q, W), ee(q, W + 1), ee(q + 1, W), ee(q + 1, W + 1));
        const ze = (q) => {
          const W = q.map(([rt, xt]) => fe(R[rt], k[xt], !0));
          for (let rt = 0; rt < q.length - 1; rt++) {
            const xt = ee(...q[rt]),
              It = ee(...q[rt + 1]);
            Qe.push(
              xt,
              W[rt],
              It,
              It,
              W[rt],
              W[rt + 1],
              xt,
              It,
              W[rt],
              It,
              W[rt + 1],
              W[rt],
            );
          }
        };
        (ze(k.map((q, W) => [0, W])),
          ze(k.map((q, W) => [Q - 1, W])),
          ze(R.map((q, W) => [W, 0])),
          ze(R.map((q, W) => [W, ut - 1])));
        const ae = new L0();
        return (
          ae.setAttribute("position", new be(et.subarray(0, mt * 3), 3)),
          ae.setAttribute("normal", new be(Dt.subarray(0, mt * 3), 3)),
          ae.setAttribute("aTer", new be(jt.subarray(0, mt * 4), 4)),
          ae.setIndex(Qe),
          ae.computeBoundingSphere(),
          ae
        );
      });
      bt.push({ centre: x, levels: B });
    }
  {
    const o = bt[Math.floor(bt.length / 2)],
      i = o.levels[0],
      f = i.attributes.position.array,
      g = i.index.array,
      z = new K(f[g[0] * 3], f[g[0] * 3 + 1], f[g[0] * 3 + 2]),
      T = new K(f[g[1] * 3], f[g[1] * 3 + 1], f[g[1] * 3 + 2]),
      x = new K(f[g[2] * 3], f[g[2] * 3 + 1], f[g[2] * 3 + 2]);
    if (
      T.clone().sub(z).cross(x.clone().sub(z)).dot(z.clone().add(o.centre)) > 0
    )
      for (const B of bt)
        for (const P of B.levels) {
          const R = P.index.array;
          for (let k = 0; k < R.length; k += 3) {
            const Q = R[k + 1];
            ((R[k + 1] = R[k + 2]), (R[k + 2] = Q));
          }
        }
  }
  const dt = [];
  for (let o = 0; o <= s; o++) dt.push([0, o / s]);
  for (let o = 1; o <= m; o++) dt.push([1, o / m]);
  const pt = dt.length,
    G = new Float32Array(pt * e * 3),
    ht = new Float32Array(pt * e * 4);
  for (let o = 0; o < pt; o++) {
    const [i, f] = dt[o];
    for (let g = 0; g < e; g++) {
      const z = S[g],
        T = o * e + g;
      if (i === 1 && f === 1) {
        (G.set(j.subarray(g * 3, g * 3 + 3), T * 3), (ht[T * 4 + 1] = 1));
        continue;
      }
      const x =
          i === 0
            ? Math.PI - f * (Math.PI - z)
            : z +
              Math.sin(f * Math.PI) *
                (n((g / e) * 18.8, f * 9, 1.7) * 0.025 +
                  n((g / e) * 107, f * 3, 4.1) * 0.01),
        [B, P, R] = D(x, g),
        [k, Q, ut] = F(B, P, R),
        yt = at + Sn + k;
      let et = yt;
      if (i === 1) {
        const Dt = Math.hypot(j[g * 3], j[g * 3 + 1], j[g * 3 + 2]);
        et = yt + (Dt - yt) * f;
      }
      ((G[T * 3] = B * et),
        (G[T * 3 + 1] = P * et),
        (G[T * 3 + 2] = R * et),
        (ht[T * 4] = ut),
        (ht[T * 4 + 1] = i === 0 ? 0 : f),
        (ht[T * 4 + 2] = Q),
        (ht[T * 4 + 3] = 0));
    }
  }
  const U = [];
  for (let o = 0; o < pt - 1; o++)
    for (let i = 0; i < e; i++) {
      const f = o * e + i,
        g = o * e + ((i + 1) % e),
        z = f + e,
        T = g + e;
      U.push(f, z, g, g, z, T);
    }
  const H = new L0();
  (H.setAttribute("position", new be(G, 3)),
    H.setAttribute("aTer", new be(ht, 4)),
    H.setIndex(U));
  {
    const o = H.index.array,
      i = (s >> 1) * e * 6 + 42,
      f = (x) => new K(G[o[x] * 3], G[o[x] * 3 + 1], G[o[x] * 3 + 2]),
      g = f(i),
      z = f(i + 1),
      T = f(i + 2);
    if (z.clone().sub(g).cross(T.clone().sub(g)).dot(g) < 0)
      for (let x = 0; x < o.length; x += 3) {
        const B = o[x + 1];
        ((o[x + 1] = o[x + 2]), (o[x + 2] = B));
      }
  }
  H.computeVertexNormals();
  const lt = H.attributes.normal.array;
  for (let o = 0; o < e; o++) {
    const i = Math.hypot(G[o * 3], G[o * 3 + 1], G[o * 3 + 2]);
    for (let f = 0; f < 3; f++) lt[o * 3 + f] = G[o * 3 + f] / i;
  }
  return (
    H.computeBoundingSphere(),
    { crust: H, chunks: bt, heightAt: (o, i, f) => Math.max(0, y(o, i, f)[0]) }
  );
}
function Rn(t = 2048, e = 1024, a = 23) {
  const s = De(a),
    m = new Uint8Array(t * e),
    c = (h, n, d, u) => {
      let b = 0,
        w = 0.5,
        v = 0;
      for (let y = 0; y < u; y++)
        ((b += w * s(h, n, d)),
          (v += w),
          (w *= 0.5),
          (h *= 2.07),
          (n *= 2.07),
          (d *= 2.07));
      return b / v;
    };
  for (let h = 0; h < e; h++) {
    const n = ((h + 0.5) / e) * Math.PI,
      d = Math.sin(n),
      u = Math.cos(n);
    for (let b = 0; b < t; b++) {
      const w = ((b + 0.5) / t) * Math.PI * 2 - Math.PI,
        v = d * Math.cos(w),
        y = d * Math.sin(w),
        F = s(v * 1.7 + 4, u * 1.7, y * 1.7),
        S = s(v * 1.7, u * 1.7 + 8, y * 1.7),
        D =
          c(v * 3.2 + F * 0.7, u * 3.2 * 1.3, y * 3.2 + S * 0.7, 6) * 1.7 -
          0.03;
      m[h * t + b] = Math.round(je(0.1, 0.62, D) * 255);
    }
  }
  return m;
}
const je = (t, e, a) => {
  const s = Math.min(1, Math.max(0, (a - t) / (e - t)));
  return s * s * (3 - 2 * s);
};
function In(t = 5) {
  const m = p0(t),
    c = new Uint8Array(4096 * 64 * 2),
    h = Float32Array.from({ length: 256 * 16 }, () => m()),
    n = Float32Array.from({ length: 512 * 3 }, () => 0.15 + m() * 0.7),
    d = (b) => b * b * b * (b * (b * 6 - 15) + 10),
    u = (b, w) => ((b % w) + w) % w;
  for (let b = 0; b < 64; b++)
    for (let w = 0; w < 64; w++)
      for (let v = 0; v < 64; v++) {
        const y = v / 4,
          F = w / 4,
          S = b / 4,
          D = Math.floor(y),
          M = Math.floor(F),
          E = Math.floor(S),
          j = d(y - D),
          tt = d(F - M),
          O = d(S - E),
          vt = (U, H, lt) =>
            h[u(D + U, 16) + u(M + H, 16) * 16 + u(E + lt, 16) * 16 * 16],
          Z = (U, H) => vt(0, U, H) + (vt(1, U, H) - vt(0, U, H)) * j,
          ct = (U) => Z(0, U) + (Z(1, U) - Z(0, U)) * tt,
          Mt = ct(0) + (ct(1) - ct(0)) * O,
          St = ((v + 0.5) / 64) * 8,
          it = ((w + 0.5) / 64) * 8,
          bt = ((b + 0.5) / 64) * 8,
          Nt = Math.floor(St),
          zt = Math.floor(it),
          dt = Math.floor(bt);
        let pt = 9,
          G = 9;
        for (let U = -1; U <= 1; U++)
          for (let H = -1; H <= 1; H++)
            for (let lt = -1; lt <= 1; lt++) {
              const Rt =
                  (u(Nt + U, 8) + u(zt + H, 8) * 8 + u(dt + lt, 8) * 8 * 8) * 3,
                o = Math.hypot(
                  Nt + U + n[Rt] - St,
                  zt + H + n[Rt + 1] - it,
                  dt + lt + n[Rt + 2] - bt,
                );
              o < pt ? ((G = pt), (pt = o)) : o < G && (G = o);
            }
        const ht = (v + w * 64 + b * 64 * 64) * 2;
        ((c[ht] = Math.round(Mt * 255)),
          (c[ht + 1] = Math.round(Math.min(1, (G - pt) * 1.6) * 255)));
      }
  return c;
}
const re = 11.5,
  qe = 20,
  Yt = [
    [0, [-10, 24, 38], [0, 2, 0], 38],
    [4.5, [-4, 25, 33], [0, 3, 0], 38],
    [8, [0, 26, 16], [0, 8, 0], 42],
    [11.5, [0.8, 13, 3], [0, 2, 0], 58],
    [14, [4.5, 3, 3.5], [0, -1.5, 0], 66],
    [16, [4.4, -5.5, -3], [0, -5, 0], 72],
    [18, [4.6, -7.2, -2], [0, 3, 0], 80],
    [20, [5.5, -6.5, -1], [0, 9, 0], 84],
  ].map(([t, e, a, s]) => ({ t, p: new K(...e), a: new K(...a), fov: s })),
  Ie = Yt.map((t) => t.t),
  Ln = new ta(
    Yt.map((t) => t.p),
    !1,
    "centripetal",
  ),
  kn = new ta(
    Yt.map((t) => t.a),
    !1,
    "centripetal",
  );
function Fn(t, e) {
  t = Pt.clamp(t, 0, qe);
  let a = 0;
  for (; a < Yt.length - 2 && t >= Ie[a + 1]; ) a++;
  const s = (t - Ie[a]) / (Ie[a + 1] - Ie[a]),
    m = (a + s) / (Yt.length - 1),
    c = {
      position: Ln.getPoint(m),
      target: kn.getPoint(m),
      fov: Pt.lerp(Yt[a].fov, Yt[a + 1].fov, s),
    };
  return (
    e < 1 &&
      (c.fov =
        2 *
        Pt.radToDeg(
          Math.atan(
            Math.tan(Pt.degToRad(c.fov / 2)) / Math.max(0.55, e) ** 0.6,
          ),
        )),
    c
  );
}
const En = (t) => Pt.clamp(t / 0.6, 0, 1) * Pt.clamp((qe - t) / 0.8, 0, 1),
  nt = J(0),
  h0 = document.querySelector("#message"),
  Dn = document.querySelector("#hint");
if (!navigator.gpu)
  throw (
    (h0.textContent =
      "This piece needs WebGPU. Try a recent version of Chrome or Edge."),
    new Error("no webgpu")
  );
const he =
  matchMedia("(pointer: coarse)").matches &&
  Math.min(innerWidth, innerHeight) < 820;
he && (Dn.textContent = "Swipe to look around");
const st = new URLSearchParams(location.search),
  _t = st.has("capture"),
  jn = +(st.get("fps") || 60),
  Ye = st.has("t") ? +st.get("t") : null;
_t && document.body.classList.add("capture");
(st.has("still") || Ye !== null) &&
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "* { transition: none !important }",
    }),
  );
h0.textContent = "Building the world…";
await new Promise(requestAnimationFrame);
const X = await Oa({ exposure: +(st.get("exposure") || 1) });
X.setPixelRatio(_t ? 1 : Math.min(devicePixelRatio, he ? 1.25 : 1.5));
_t && X.setSize(+st.get("w"), +st.get("h"), !1);
X.toneMapping = { agx: na, aces: aa, neutral: ea }[st.get("tm") || "aces"];
X.shadowMap.enabled = !1;
const ot = new nn(),
  Bn = new Va(X);
ot.environment = Bn.fromScene(new en(), 0.04).texture;
ot.environmentIntensity = 0.06;
const L = new sn(
  30,
  _t ? st.get("w") / st.get("h") : innerWidth / innerHeight,
  0.05,
  900,
);
ot.add(L);
const Ke = new K(-0.75, 0.42, 0.5).normalize(),
  Se = new on("#fff4e6", 3.2);
Se.position.copy(Ke).multiplyScalar(50);
ot.add(Se, new ln("#8aa0d0", 0.04));
const f0 = J(new _e()),
  b0 = J(new _e()),
  $e = new un(In(), 64, 64, 64);
Object.assign($e, {
  format: mn,
  type: sa,
  minFilter: o0,
  magFilter: o0,
  wrapS: Ce,
  wrapT: Ce,
  wrapR: Ce,
  unpackAlignment: 1,
});
$e.needsUpdate = !0;
const A = (t) => Q0($e, t.div(16)).r.mul(2).sub(1),
  Ht = (t) => Q0($e, t.div(8)).g,
  p = (t, e, a) => Zt(t, e, a),
  pa = (t, e) => {
    const a = n0,
      s = Ja,
      m = a.dFdx(),
      c = a.dFdy(),
      h = I0(c, s),
      n = I0(s, m),
      d = Y(m, h),
      u = t.dFdx().mul(h).add(t.dFdy().mul(n)).mul(d.sign()).mul(e);
    return ce(d).mul(s).sub(u).normalize();
  },
  g0 = new oa(
    Float32Array.from({ length: 2048 }, (t, e) => ia((e / 2048) * Math.PI * 2)),
    2048,
    1,
    la,
    rn,
  );
g0.wrapS = Ce;
g0.needsUpdate = !0;
const qn = (t) => J0(g0, Ot(ft(t.div(Math.PI * 2)), 0.5)).r,
  w0 = (t) =>
    I(
      I(l(0.55, 0.02, 0), l(1, 0.24, 0.02), p(0.15, 0.5, t)),
      l(1, 0.66, 0.32),
      p(0.62, 1, t),
    ).mul(t.mul(t).mul(6)),
  C = He,
  Qt = 2.5,
  Pe = J(+(st.get("core") || 85)),
  v0 = J(1),
  ha = J(1),
  M0 = J(1),
  y0 = J(1),
  fa = J(1),
  ba = J(1),
  ga = J(1),
  $t = J(Ke.clone()),
  Vt = { autoRes: !_t, dripSpeed: 1, dripSize: 1 },
  wa = zn(),
  Te = new oa(Rn(2048, 1024, 61), 2048, 1024, la, sa);
Te.wrapS = Ce;
Te.minFilter = Te.magFilter = o0;
Te.needsUpdate = !0;
const x0 = (t, e) =>
    J0(
      Te,
      Ot(
        ft(
          X0(t.z, t.x)
            .div(Math.PI * 2)
            .add(0.5)
            .add(nt.mul(e)),
        ),
        Oe(Tt(t.y, -1, 1)).div(Math.PI),
      ),
    ).r,
  xe = new U0({ metalness: 0 });
{
  const t = _0("aTer", "vec4"),
    e = p(0.02, 0.16, t.y),
    a = t.x,
    s = t.z,
    m = _(C),
    c = ce(m.y),
    h = wt(G0(C)),
    n = r(1).sub(p(0.1, 0.5, h.mul(7))),
    d = r(1).sub(p(0.1, 0.5, h.mul(34))),
    u = A(C.mul(7)).mul(n),
    b = A(C.mul(34).add(3.7)).mul(d),
    w = A(C.mul(0.7)),
    v = r(1).sub(p(-0.02, 0.012, a.add(u.mul(0.01)))),
    y = r(1)
      .sub(p(0.3, 0.95, c.add(w.mul(0.12))))
      .sub(V(a.sub(0.45), 0).mul(0.4)),
    F = p(-0.25, 0.35, b.mul(0.7).add(u).add(w.mul(0.6))),
    S = A(C.mul(19).add(2.2)).mul(n).mul(0.5).add(0.5),
    D = I(l(0.6, 0.46, 0.3), l(0.5, 0.33, 0.2), p(-0.2, 0.4, w)).mul(
      r(0.85).add(S.mul(0.3)),
    ),
    M = l(0.34, 0.31, 0.17),
    E = l(0.3, 0.28, 0.23),
    j = I(l(0.17, 0.23, 0.08), l(0.06, 0.11, 0.04), F).mul(
      r(0.8).add(S.mul(0.4)),
    ),
    tt = l(0.035, 0.075, 0.03);
  let O = I(I(E, M, p(0.05, 0.4, y)), D, p(0.55, 0.9, y));
  ((O = I(O, I(j, tt, p(0.6, 0.8, s)), p(0.32, 0.5, s).mul(p(0.08, 0.3, y)))),
    (O = I(O, l(0.32, 0.27, 0.22), p(0.8, 1.3, a.add(w.mul(0.3))))),
    (O = I(O, l(0.62, 0.56, 0.42), r(1).sub(p(0.004, 0.025, a)))));
  const vt = I(
      l(0.02, 0.14, 0.18),
      l(0.004, 0.022, 0.07),
      p(0, 0.07, a.negate()),
    ),
    Z = V(p(1.2, 1.5, a.add(u.mul(0.2))), r(1).sub(p(-0.05, 0.1, y))),
    ct = r(1).sub(
      x0(_(m.sub($t.mul(0.012))), 0.002)
        .mul(0.55)
        .mul(M0),
    ),
    Mt = I(I(O.mul(r(0.9).add(b.mul(0.2))), vt, v), l(0.9, 0.93, 0.97), Z).mul(
      ct,
    ),
    St = p(0.08, -0.22, Y(m, $t)),
    bt = p(
      0.55,
      0.85,
      A(C.mul(2.4).add(11.3))
        .mul(0.6)
        .add(A(C.mul(9)).mul(0.4)),
    )
      .mul(A(C.mul(38)).mul(0.5).add(0.5))
      .mul(r(1).sub(v))
      .mul(r(1).sub(Z))
      .mul(p(0.7, 0.05, a))
      .mul(St)
      .mul(fa),
    Nt = wt(C),
    zt = Nt.mul(2.6)
      .add(A(C.mul(0.9)).mul(0.35))
      .add(u.mul(0.04)),
    dt = ft(zt),
    pt = I(
      I(l(0.12, 0.08, 0.055), l(0.05, 0.04, 0.036), p(0.3, 0.42, dt)),
      l(0.14, 0.12, 0.1),
      p(0.6, 0.72, dt).mul(r(1).sub(p(0.8, 0.9, dt))),
    ).mul(r(0.9).add(b.mul(0.12)).add(u.mul(0.08)));
  ((xe.colorNode = I(Mt, pt, e)),
    (xe.roughnessNode = I(I(r(0.9), r(0.14), v.mul(r(1).sub(Z))), r(0.85), e)));
  const G = A(l(C.x.mul(1.3), C.y.mul(1.3).add(nt.mul(0.6)), C.z.mul(1.3)))
      .mul(0.5)
      .add(0.5),
    ht = Ht(C.mul(2.3).add(1.3)),
    U = gt(V(Oe(Tt(m.y, -1, 1)).sub(qn(X0(C.z, C.x))), 0).mul(-40)).mul(
      r(1).sub(e),
    ),
    H = p(0.35, 1, t.y)
      .mul(e)
      .mul(
        r(1)
          .sub(p(0.02, 0.1, ht))
          .mul(0.7)
          .add(0.3),
      ),
    lt = Tt(Y(m, _(de.sub(C))), 0, 1),
    Rt = p(-0.15, 0.35, Y(m, $t)),
    o = l(0.1, 0.22, 0.5)
      .mul(kt(r(1).sub(lt), 2.2).mul(0.55).add(0.035))
      .mul(Rt)
      .mul(y0)
      .mul(r(1).sub(e));
  ((xe.emissiveNode = w0(H.mul(0.6).add(U.mul(0.4).mul(G.add(0.5))))
    .add(l(1, 0.68, 0.32).mul(bt.mul(0.9)).mul(r(1).sub(e)))
    .add(o)),
    (xe.normalNode = pa(
      I(
        u.mul(0.4).add(b.mul(0.2)).mul(r(1).sub(v).mul(0.8).add(0.2)),
        b.mul(0.25).add(u.mul(0.3)),
        e,
      ),
      0.03,
    )));
}
const Ne = [
    [0, 0],
    [0.85, 0.35],
    [-0.65, 0.75],
    [-0.4, -0.95],
    [0.95, -0.7],
    [0.3, 1.1],
    [-1.1, 0.05],
  ].map(([t, e], a) => {
    const s = Math.sin(a * 12.9898 + 4.1) * 43758.5453,
      m = s - Math.floor(s);
    return {
      x: t,
      z: e,
      y: -Math.sqrt(Qt * Qt - t * t - e * e),
      period: 5.5 + m * 3,
      offset: m * 11,
      size: 1 - a * 0.06,
    };
  }),
  Ze = Ne.length,
  va = d0(
    Ne.map(() => new i0()),
    "vec4",
  ),
  Ma = d0(
    Ne.map(() => new i0()),
    "vec4",
  ),
  ya = d0(
    Ne.map(
      (t) => new i0(t.x, -Math.sqrt(at * at - t.x * t.x - t.z * t.z), t.z, -99),
    ),
    "vec4",
  ),
  ge = r(7),
  Ft = J(0),
  C0 = (t) =>
    I(
      I(
        I(l(0.5, 0.025, 0), l(1, 0.3, 0.03), p(700, 900, t)),
        l(1, 0.58, 0.14),
        p(900, 1090, t),
      ),
      l(1, 0.86, 0.6),
      p(1090, 1180, t),
    ).mul(kt(Tt(t.sub(600).div(600), 0, 1), 3).mul(8)),
  xa = new ie();
{
  const t = _0("aTer", "vec4"),
    e = _(C),
    a = wt(G0(C)),
    s = p(0.1, 0.45, a.mul(8.5)),
    m = p(0.1, 0.45, a.mul(47)),
    c = A(C.mul(8.5)).mul(r(1).sub(s)),
    h = A(C.mul(47).add(5.1)).mul(r(1).sub(m)),
    n = t.x.add(c.mul(0.02)),
    d = t.z,
    u = t.w,
    b = Tt(Y(z0, e.negate()), 0, 1),
    w = r(1).sub(p(0.07, 0.13, t.x)),
    v = l(ge.mul(0.03), ge.mul(-0.018), ge.mul(0.024)),
    y = A(C.mul(1.6).add(v))
      .mul(0.6)
      .add(A(C.mul(4.5).sub(v.mul(2))).mul(0.4)),
    F = Ht(C.mul(0.55).add(v.mul(1.5)).add(y.mul(0.2))),
    S = Ht(C.mul(1.7).sub(v).add(y.mul(0.15))),
    D = At(
      Y(C.add(v.mul(2)), l(1, 0.3, 0.6))
        .mul(48)
        .add(A(C.mul(6)).mul(5)),
    ).mul(r(1).sub(m)),
    M = p(0.55, 0.9, y),
    E = V(V(gt(F.mul(-9)), gt(S.mul(-15)).mul(0.8)), M),
    j = pe(() => {
      const yt = r(0).toVar();
      return (
        Ve(Ze, ({ i: et }) => {
          const Dt = ya.element(et),
            jt = Ft.sub(Dt.w),
            mt = wt(C.sub(Dt.xyz)),
            fe = Ue(V(jt, 0).mul(0.06)).add(0.12);
          yt.addAssign(
            Ua(
              jt.greaterThan(0),
              gt(mt.mul(mt).div(fe.mul(fe)).negate()).mul(gt(jt.mul(-0.35))),
              r(0),
            ).mul(1.4),
          );
        }),
        yt
      );
    })(),
    tt = C.add(v.mul(3)),
    O = A(tt.mul(0.8)),
    vt = p(0.25, 0.85, A(tt.mul(1.8).add(l(O.mul(2.5), O, O.mul(-2)))));
  p(0.1, 0.32, F).mul(p(0.5, 0.78, A(C.mul(0.9).add(v.mul(0.8)))));
  const Z = gt(F.mul(-4.5)),
    ct = gt(S.mul(-14))
      .mul(0.45)
      .mul(r(1).sub(p(0.1, 0.4, a.mul(3)))),
    Mt = p(0.5, 0.8, y),
    St = r(560)
      .add(V(V(Z, ct), Mt).mul(620))
      .sub(vt.mul(Z).mul(80))
      .add(j.mul(300)),
    it = r(1).sub(p(0.02, 0.08, Ht(C.mul(0.75).add(2.1)))),
    bt = r(1)
      .sub(p(0.02, 0.06, Ht(C.mul(2.6))))
      .mul(r(1).sub(p(0.2, 0.7, a.mul(20)))),
    Nt = r(1).sub(p(0.02, 0.7, n.add(u.mul(0.25)))),
    zt = r(1).sub(p(0, 0.06, n)),
    dt = p(0, 0.12, Ht(C.mul(5.5))),
    pt = I(
      l(0.018, 0.017, 0.018),
      l(0.055, 0.05, 0.048),
      c.mul(0.5).add(0.5),
    ).mul(dt.mul(0.35).add(0.65)),
    G = I(l(0.09, 0.085, 0.08), l(0.15, 0.14, 0.13), c.mul(0.5).add(0.5)),
    ht = I(pt, G, p(0.7, 1.2, n.add(u.mul(0.3))).mul(p(0.6, 0.85, b))),
    U = p(0.95, 0.75, d).mul(p(0.9, 0.05, n)),
    lt = r(1)
      .sub(
        p(
          0,
          0.07,
          Ht(
            C.mul(1.1)
              .add(v.mul(0.6))
              .add(l(A(C.mul(2)).mul(0.4), 0, 0)),
          ),
        ),
      )
      .mul(U),
    Rt = r(1).sub(p(0.35, 0.75, ce(z0.y))),
    o = p(
      0.5,
      0.8,
      A(l(C.x.mul(5), C.y.mul(0.7).add(ge.mul(0.12)), C.z.mul(5))),
    )
      .mul(p(0.1, 0.4, A(C.mul(0.7).add(5.5))))
      .mul(Rt),
    i = V(it, bt.mul(0.6))
      .mul(Nt.mul(0.75).add(0.08))
      .mul(r(0.8).add(A(C.mul(3).add(ge.mul(0.2))).mul(0.2))),
    f = r(500)
      .add(V(V(i.mul(560), lt.mul(640)), o.mul(560)))
      .add(zt.mul(420))
      .add(
        A(C.mul(9).sub(v.mul(3)))
          .mul(lt)
          .mul(60),
      )
      .sub(p(0.9, 1.3, n).mul(300)),
    g = l(0.022, 0.02, 0.022),
    z = I(ht, g, w).mul(I(r(1), d, 0.8)),
    T = pa(
      I(
        c
          .mul(0.6)
          .add(h.mul(0.08))
          .mul(0.012)
          .sub(it.mul(0.005))
          .sub(lt.mul(0.006))
          .add(dt.mul(0.0015)),
        p(0, 0.3, F)
          .mul(0.05)
          .add(D.mul(5e-4))
          .add(y.mul(0.02))
          .add(vt.mul(E).mul(0.01)),
        w,
      ),
      1,
    ),
    x = Y0.mul(Wt(0, 0, 0, 1)).xyz.sub(n0),
    B = _(x),
    P = Pe.div(wt(x)).div(Math.PI),
    R = z.mul(l(1, 0.62, 0.36)).mul(P.mul(V(Y(T, B), 0)).add(0.05)),
    k = _(B.add(_(n0.negate()))),
    Q = kt(V(Y(T, k), 0), 24)
      .mul(P)
      .mul(0.03)
      .mul(w)
      .mul(p(0.5, 0.1, V(Z, Mt)))
      .add(
        kt(V(Y(T, k), 0), 24)
          .mul(P)
          .mul(0.015)
          .mul(r(1).sub(w)),
      ),
    ut = I(f, St, w);
  xa.colorNode = R.add(l(0.85, 0.8, 0.78).mul(Q)).add(
    C0(ut).mul(d).mul(0.26).mul(ha),
  );
}
const Ca = new te(wa.crust, xe);
ot.add(Ca);
const Aa = at + 1.15 + 0.32,
  Wn = new te(
    new Ge(Aa, 6),
    (() => {
      const t = new U0({
          transparent: !0,
          depthWrite: !1,
          roughness: 1,
          metalness: 0,
        }),
        e = _(C),
        a = x0(e, 0.002),
        s = A(e.mul(60).add(nt.mul(0.01)))
          .mul(0.5)
          .add(0.5),
        m = p(Et + 0.15, Et + 0.45, Oe(Tt(e.y, -1, 1)));
      return (
        (t.colorNode = l(0.95)),
        (t.opacityNode = p(0, 1, a.mul(1.15).sub(s.mul(0.35)))
          .mul(0.9)
          .mul(m)
          .mul(M0)),
        t
      );
    })(),
  );
ot.add(Wn);
const Hn = (t, e) => {
    const a = Y(t, $t);
    return I(l(1, 0.42, 0.15), l(0.32, 0.56, 1), p(-0.05, 0.35, a))
      .mul(p(-0.3, 0.15, a))
      .mul(e)
      .mul(y0);
  },
  On = new te(
    new Ge(Aa + 0.3, 6),
    (() => {
      const t = new ie({ transparent: !0, depthWrite: !1, blending: Xe }),
        e = _(C),
        a = _(de.sub(C));
      return (
        (t.colorNode = Wt(
          Hn(e, kt(r(1).sub(Tt(Y(e, a), 0, 1)), 3).mul(0.45)),
          1,
        )),
        t
      );
    })(),
  );
ot.add(On);
const A0 = new dn();
for (const { centre: t, levels: e } of wa.chunks) {
  const a = new cn();
  (e.forEach((s, m) => a.addLevel(new te(s, xa), [0, 7, 13, 22][m])),
    a.position.copy(t),
    A0.add(a));
}
ot.add(A0);
const Sa = new pn("#ff6a24", Pe.value, 0, 1);
ot.add(Sa);
const k0 = (t, e, a) => {
    const s = V(r(a).sub(ce(t.sub(e))), 0).div(a);
    return Ee(t, e).sub(s.mul(s).mul(a * 0.25));
  },
  Xt = l(Ft.mul(0.04), Ft.mul(0.06), Ft.mul(-0.03)),
  we = pe(([t]) => {
    const e = t.mul(l(1, 1.06, 1)).add(l(0, Zt(0, -Qt, t.y).mul(0.25), 0)),
      a = wt(e)
        .sub(Qt)
        .add(A(t.mul(0.45).add(Xt)).mul(0.32))
        .add(A(t.mul(1.3).sub(Xt)).mul(0.07))
        .toVar();
    return (
      Ve(Ze, ({ i: s }) => {
        const m = va.element(s),
          c = Ma.element(s),
          h = m.xyz,
          n = V(m.w, 0.001),
          d = Tt(h.y.sub(t.y).div(n), 0, 1),
          u = wt(t.sub(l(h.x, h.y.sub(d.mul(n)), h.z))).sub(
            I(c.x, c.y, kt(d, 0.55)),
          ),
          b = wt(t.sub(l(h.x, h.y.sub(n), h.z)).mul(l(1, 0.88, 1)))
            .sub(c.z)
            .add(r(1).sub(c.w).mul(9));
        a.assign(k0(a, k0(u, b, 0.14), 0.4));
      }),
      a
    );
  }),
  Bt = new K(-3.4, -6.4, -3.4),
  qt = new K(3.4, 3.4, 3.4),
  l0 = new ie({ side: hn });
{
  const t = de,
    e = _(He.sub(de)),
    a = l(Bt.x, Bt.y, Bt.z).sub(t).div(e),
    s = l(qt.x, qt.y, qt.z).sub(t).div(e),
    m = Ee(a, s),
    c = V(a, s),
    h = V(V(m.x, m.y), V(m.z, 0)),
    n = Ee(Ee(c.x, c.y), c.z),
    d = pe(() => {
      const H = h.toVar(),
        lt = r(0).toVar();
      return (
        Ve(64, () => {
          const Rt = we(t.add(e.mul(H)));
          (t0(Rt.lessThan(H.mul(0.0015).add(0.002)), () => {
            (lt.assign(1), R0());
          }),
            H.addAssign(Rt.mul(0.8)),
            t0(H.greaterThan(n), () => {
              R0();
            }));
        }),
        t0(lt.lessThan(0.5), () => {
          _a();
        }),
        H
      );
    })(),
    u = t.add(e.mul(d)),
    b = 0.004,
    w = l(1, -1, -1),
    v = l(-1, -1, 1),
    y = l(-1, 1, -1),
    F = l(1, 1, 1),
    S = _(
      w
        .mul(we(u.add(w.mul(b))))
        .add(v.mul(we(u.add(v.mul(b)))))
        .add(y.mul(we(u.add(y.mul(b)))))
        .add(F.mul(we(u.add(F.mul(b))))),
    ),
    D = u.div(Qt),
    M = l(
      A(D.mul(2.4).add(Xt)),
      A(D.mul(2.4).add(Xt).add(11.7)),
      A(D.mul(2.4).add(Xt).add(23.1)),
    ),
    E = D.mul(5.2).add(M.mul(1.15)).add(Xt.mul(1.5)),
    j = Ht(E),
    tt = r(1).sub(p(0.025, 0.19, j)),
    O = A(D.mul(3.1).add(M).sub(Xt)).mul(0.5).add(0.5),
    vt = p(0.48, 0.78, O),
    Z = At(
      u.y
        .mul(24)
        .add(A(E.mul(2)).mul(5))
        .add(Ft.mul(0.35)),
    )
      .mul(0.5)
      .add(0.5),
    ct = A(E.mul(5)).mul(0.5).add(0.5),
    Mt = V(tt, vt.mul(0.88)),
    St = Tt(wt(u).sub(Qt).div(2.2), 0, 1),
    it = A(l(u.x.mul(7), u.y.mul(1.8).add(Ft.mul(0.38)), u.z.mul(7)))
      .mul(0.5)
      .add(0.5),
    bt = Tt(Y(S, e.negate()), 0, 1),
    Nt = I(
      r(0.23).add(ct.mul(0.085)).add(Z.mul(0.025)),
      r(0.76).add(O.mul(0.16)),
      Mt,
    ),
    zt = r(0.58).add(it.mul(0.16)).sub(St.mul(0.09)),
    dt = I(Nt, zt, p(0.015, 0.24, St)).mul(v0),
    pt = l(0.045, 0.018, 0.012).mul(
      r(0.35).add(V(Y(S, _(l(-0.6, 0.8, 0.4))), 0).mul(0.65)),
    ),
    G = w0(dt)
      .mul(0.48)
      .mul(r(0.66).add(kt(bt, 0.55).mul(0.34))),
    ht = kt(V(Y(S, _(e.negate().add(l(-0.6, 0.8, 0.4)))), 0), 32)
      .mul(r(1).sub(Mt))
      .mul(0.11);
  l0.colorNode = G.add(pt.mul(r(1).sub(Mt))).add(l(1, 0.38, 0.12).mul(ht));
  const U = Ga.mul(Y0).mul(Wt(u, 1));
  l0.depthNode = U.z.div(U.w);
}
const Pa = new te(
  new fn(qt.x - Bt.x, qt.y - Bt.y, qt.z - Bt.z).translate(
    (qt.x + Bt.x) / 2,
    (qt.y + Bt.y) / 2,
    (qt.z + Bt.z) / 2,
  ),
  l0,
);
Pa.frustumCulled = !1;
ot.add(Pa);
const Ta = new ua(
  (() => {
    const t = new K0({ transparent: !0, depthWrite: !1, blending: Xe }),
      e = wt($0().sub(0.5)).mul(2),
      a = gt(e.mul(e).mul(-9))
        .mul(0.5)
        .add(gt(e.mul(-5)).mul(0.25))
        .mul(r(1).sub(p(0.7, 1, e)));
    return ((t.colorNode = Wt(l(1, 0.32, 0.08).mul(a.mul(0.28)), 1)), t);
  })(),
);
Ta.scale.setScalar(Qt * 7);
ot.add(Ta);
const Vn = (() => {
    const t = [];
    for (let e = 0; e <= 24; e++) {
      const a = 1.9 - (e / 24) * 2.9;
      t.push(
        new ma(
          a > 0
            ? 0.98 * Math.pow(Math.max(0, 1 - a / 1.9), 1.5)
            : Math.sqrt(Math.max(0, 1 - a * a)),
          a,
        ),
      );
    }
    return new bn(t, 20);
  })(),
  Na = (() => {
    const t = new ie(),
      e = Tt(Y(_(Xa), _(de.sub(He))), 0, 1),
      a = A(Z0.mul(l(9, 2.5, 9)).add(l(0, Ft.mul(0.35), 0)))
        .mul(0.5)
        .add(0.5);
    return (
      (t.colorNode = w0(
        r(0.48).add(a.mul(0.14)).add(kt(e, 0.6).mul(0.12)).mul(v0),
      ).mul(0.48)),
      t
    );
  })(),
  Ae = new ra(Vn, Na, Ze),
  le = new ra(new Ge(1, 2), Na, Ze * 3);
Ae.frustumCulled = le.frustumCulled = !1;
ot.add(Ae, le);
const ve = 3.2,
  Le = 0.7,
  ne = 0.74,
  u0 = new _e(),
  F0 = new ca(),
  E0 = new K(),
  D0 = new K(),
  e0 = (t, e) => t.setMatrixAt(e, u0.makeScale(0, 0, 0));
function S0(t) {
  (Ne.forEach((e, a) => {
    const s = e.period,
      m = ((((t + e.offset) / s) % 1) + 1) % 1,
      c = va.array[a],
      h = Ma.array[a],
      n = e.size * Vt.dripSize,
      d = 2 * n + 0.1,
      u = 0.32 * n,
      b = -Math.sqrt(at * at - e.x * e.x - e.z * e.z);
    if (m < Le) {
      const S = m / Le;
      (c.set(e.x, e.y + 0.05, e.z, 0.1 + (d - 0.1) * Math.pow(S, 2.4)),
        h.set(
          0.42 * n,
          (0.3 - 0.22 * Math.pow(S, 1.3)) * n,
          (0.16 + 0.16 * S) * n,
          1,
        ));
    } else if (m < ne) {
      const S = (m - Le) / (ne - Le);
      (c.set(e.x, e.y + 0.05, e.z, d + 0.15 * S),
        h.set(0.42 * n, (0.08 - 0.065 * S) * n, u, 1));
    } else {
      const S = Math.min(1, (m - ne) / 0.16);
      (c.set(
        e.x,
        e.y + 0.05,
        e.z,
        Math.max(0.05, d * 0.7 * Math.pow(1 - S, 2)),
      ),
        h.set(0.42 * n * (1 - 0.4 * S), 0.04 * n, 0.05 * n, 0));
    }
    const w = (m - ne) * s,
      v = e.y + 0.05 - d - 0.15,
      y = Math.sqrt((2 * (v - b)) / ve);
    if (m >= ne && w < y) {
      const S = v - 0.5 * ve * w * w,
        D = ve * w;
      Ae.setMatrixAt(
        a,
        u0.compose(
          E0.set(e.x, S, e.z),
          F0.identity(),
          D0.set(u * 0.95, u * (1 + D * 0.06), u * 0.95),
        ),
      );
      for (let M = 0; M < 3; M++) {
        const E = 0.12 + M * 0.1,
          j = Math.max(0, w - E),
          tt = v + 0.35 + M * 0.25 - 0.5 * ve * j * j,
          O = (M === 0 ? 0.07 : 0.045) * n * Math.min(1, w * 6);
        tt > b
          ? le.setMatrixAt(
              a * 3 + M,
              u0.compose(
                E0.set(e.x + (M - 1) * 0.01, tt, e.z),
                F0.identity(),
                D0.set(O, O * (1 + ve * j * 0.08), O),
              ),
            )
          : e0(le, a * 3 + M);
      }
    } else {
      e0(Ae, a);
      for (let S = 0; S < 3; S++) e0(le, a * 3 + S);
    }
    const F = t - (((((t + e.offset) / s) % 1) + 1) % 1) * s + (ne * s + y);
    ya.array[a].w = F <= t ? F : F - s;
  }),
    (Ae.instanceMatrix.needsUpdate = !0),
    (le.instanceMatrix.needsUpdate = !0));
}
S0(0);
const j0 = at - 1,
  P0 = new te(
    new Ge(j0, 5),
    (() => {
      const t = new ie({ transparent: !0, depthWrite: !1, side: da }),
        e = _(C),
        a = x0(_(l(e.z, e.y, e.x.negate())), 0.004),
        s = A(e.mul(40).add(nt.mul(0.03)))
          .mul(0.5)
          .add(0.5),
        m = p(0.05, 1, a.mul(1.1).sub(s.mul(0.35))),
        c = r(1).sub(p(Et + 0.1, Et + 0.4, Oe(Tt(e.y, -1, 1))));
      return (
        (t.colorNode = Wt(
          l(0.07, 0.06, 0.055).add(
            l(1, 0.35, 0.1).mul(Pe.div(j0).mul(0.006)).mul(s.mul(0.5).add(0.5)),
          ),
          m.mul(0.16).mul(r(1).sub(c)),
        )),
        t
      );
    })(),
  );
P0.visible = !1;
ot.add(P0);
ot.backgroundNode = pe(() => {
  const t = _(f0.mul(Wt(Ya(c0, r(1), b0), 0)).xyz),
    e = (u, b, w) => {
      const v = t.mul(u),
        y = s0(v),
        F = ft(v).sub(0.5),
        S = ft(At(Y(y, l(12.9898, 78.233, 37.719))).mul(43758.5453)),
        D = ft(S.mul(97.13)),
        M = ft(S.mul(31.7)),
        E = l(D, M, ft(D.mul(7.7)))
          .sub(0.5)
          .mul(0.6);
      return r(1)
        .sub(p(0, b, wt(F.sub(E))))
        .mul(p(w, 1, S))
        .mul(M.mul(M).mul(1.6).add(0.15));
    },
    a = e(520, 0.09, 0.9).add(e(260, 0.08, 0.985).mul(1.8)),
    s = I(
      l(0.75, 0.85, 1),
      l(1, 0.88, 0.75),
      ft(At(Y(s0(t.mul(260)), l(4.1, 9.7, 2.3))).mul(9341.7)),
    ),
    m = gt(ce(Y(t, _(l(0.25, 0.85, -0.45)))).mul(-6))
      .mul(A(t.mul(9)).mul(0.5).add(0.5))
      .mul(A(t.mul(23)).mul(0.3).add(0.7)),
    c = Y(t, $t),
    h = p(0.99985, 0.99993, c)
      .mul(30)
      .add(gt(r(1).sub(c).mul(-900)).mul(2))
      .add(gt(r(1).sub(c).mul(-60)).mul(0.08)),
    n = p(
      0.1,
      0.9,
      A(t.mul(2.2).add(3.1))
        .mul(0.6)
        .add(A(t.mul(5.5)).mul(0.4))
        .add(0.3),
    ),
    d = I(
      l(0.35, 0.12, 0.45),
      l(0.08, 0.25, 0.45),
      p(-0.4, 0.4, A(t.mul(1.4).add(9.2))),
    )
      .mul(n.mul(n))
      .mul(m.mul(0.7).add(0.15))
      .mul(0.06)
      .mul(ga);
  return l(0.002, 0.003, 0.006)
    .add(l(0.5, 0.55, 0.75).mul(m).mul(0.035))
    .add(d)
    .add(s.mul(a).mul(ba))
    .add(l(1, 0.95, 0.88).mul(h));
})();
const za = J(1),
  Ra = J(1),
  T0 = (t, e, a) => {
    const s = new K0({ transparent: !0, depthWrite: !1, blending: Xe }),
      m = r(tn),
      c = oe(m),
      h = oe(m.add(17.31)),
      n = oe(m.add(41.73)),
      d = oe(m.add(73.1)),
      { pos: u, vel: b, age: w, T: v } = a(m, c, h, n, d);
    ((s.positionNode = u),
      (s.scaleNode = r(e)
        .mul(d.mul(0.7).add(0.5))
        .mul(Zt(0, 0.04, w))
        .mul(r(1).sub(w.mul(0.5)))));
    const y = wt($0().sub(0.5)).mul(2),
      F = gt(y.mul(y).mul(-7)).mul(r(1).sub(Zt(0.85, 1, y))),
      S = r(1);
    s.colorNode = Wt(C0(v).mul(F).mul(S).mul(0.16).mul(Ra), 1);
    const D = new ua(s);
    ((D.count = t), (D.frustumCulled = !1), ot.add(D));
  };
T0(he ? 600 : 1400, 0.03, (t, e, a, s) => {
  const m = ft(nt.div(6.5).add(e)),
    c = a.mul(Math.PI * 2),
    h = s.mul(-0.85).sub(0.15),
    n = Ue(r(1).sub(h.mul(h))),
    d = l(Kt(c).mul(n), h, At(c).mul(n)).mul(at - 0.4),
    u = l(At(nt.mul(0.9).add(t)), 0, Kt(nt.mul(0.8).add(t.mul(1.7)))).mul(
      m.mul(0.6),
    ),
    b = d.add(l(0, m.mul(3.6), 0)).add(u),
    w = l(
      Kt(nt.mul(0.9).add(t)).mul(0.5),
      0.6,
      At(nt.mul(0.8).add(t.mul(1.7))).mul(-0.5),
    ).mul(0.6);
  return { pos: b, vel: w, age: m, T: r(1120).sub(m.mul(420)).sub(s.mul(80)) };
});
T0(he ? 400 : 1e3, 0.05, (t, e, a, s, m) => {
  const h = ft(nt.div(4.5).add(e)),
    n = h.mul(4.5),
    d = a.mul(Math.PI * 2),
    u = Ue(s).mul(at * Math.sin(Et) * 0.85),
    b = l(Kt(d).mul(u), at * Math.cos(Et) + 0.2, At(d).mul(u)),
    w = m.mul(6).add(7),
    v = e.mul(1.4).add(0.3),
    y = 5.5,
    F = l(Kt(d).mul(v), w, At(d).mul(v)),
    S = b.add(F.mul(n)).sub(l(0, n.mul(n).mul(y * 0.5), 0)),
    D = F.sub(l(0, n.mul(y), 0));
  return { pos: S, vel: D, age: h, T: r(1150).sub(h.mul(520)).sub(s.mul(60)) };
});
T0(he ? 300 : 700, 0.09, (t, e, a, s, m) => {
  const h = ft(nt.div(2.2).add(e)),
    n = h.mul(2.2),
    d = s0(nt.div(2.2).add(e)),
    u = oe(d.add(t.mul(0.013))).mul(Math.PI * 2),
    b = Ue(oe(d.mul(1.7).add(t.mul(0.007)))).mul(2.4),
    w = _(l(Kt(u).mul(b).div(at), -1, At(u).mul(b).div(at))).mul(at - 0.05),
    v = l(
      Kt(u.add(s.mul(3))).mul(a.mul(0.7)),
      m.mul(2.6).add(1.2),
      At(u.add(s.mul(3))).mul(a.mul(0.7)),
    );
  return {
    pos: w.add(v.mul(n)).sub(l(0, n.mul(n).mul(1.6), 0)),
    vel: v,
    age: h,
    T: r(1130).sub(h.mul(330)),
  };
});
{
  const e = at * Math.sin(Et) * 1.05,
    a = new ie({ transparent: !0, depthWrite: !1, blending: Xe, side: da }),
    s = Z0,
    m = s.y.div(16).add(0.5),
    c = _(l(s.x, 0, s.z)),
    h = _(de.sub(He)),
    n = kt(ce(Y(c, _(l(h.x, 0, h.z)))), 1.6),
    d = nt.mul(1.4),
    u = l(s.x.mul(0.35), s.y.mul(0.22).sub(d), s.z.mul(0.35)),
    b = A(u.add(l(A(u.mul(0.5)).mul(1.5), 0, A(u.mul(0.5).add(4.4)).mul(1.5))))
      .mul(0.6)
      .add(A(u.mul(2.3).sub(l(0, d.mul(0.6), 0))).mul(0.4)),
    w = Zt(-0.35, 0.6, b)
      .mul(n)
      .mul(kt(r(1).sub(m), 1.8))
      .mul(Zt(0, 0.06, m));
  a.colorNode = Wt(
    C0(r(980).sub(m.mul(380)))
      .mul(w)
      .mul(0.13)
      .mul(za),
    1,
  );
  const v = new te(new gn(e * 2.1, e, 16, 64, 24, !0), a);
  ((v.position.y = at * Math.cos(Et) + 16 / 2 - 0.2), ot.add(v));
}
const Ia = J(new ma(0.5, 0.5)),
  We = J(0),
  La = J(0.45),
  N0 = J(1),
  m0 = J(new wn("#ff8a3a")),
  Un = Ka(ot, L),
  ke = Un.getTextureNode("output"),
  ka = pe(() => {
    const t = c0,
      e = Ia.sub(t),
      a = wt(e.mul(Ot(L.aspect, 1))),
      s = Ot(
        A(l(t.mul(Ot(18, 10)), nt.mul(0.9))),
        A(l(t.mul(Ot(18, 10)).add(7.7), nt.mul(0.9).add(3.1))),
      ),
      m = gt(a.mul(-2.2)).mul(We).mul(N0),
      c = t.add(s.mul(0.006).mul(m)),
      h = t.sub(0.5),
      n = h.mul(Y(h, h)).mul(0.012),
      d = l(ke.sample(c.add(n)).r, ke.sample(c).g, ke.sample(c.sub(n)).b),
      u = l(0).toVar(),
      b = r(1).toVar();
    Ve(28, ({ i: v }) => {
      const y = r(v)
          .add(ft(At(Y(t, Ot(12.9898, 78.233))).mul(43758.5453)))
          .div(28),
        F = ke.sample(c.add(e.mul(y.mul(0.85)))).rgb;
      (u.addAssign(V(F.sub(0.9), l(0)).mul(b)), b.mulAssign(0.93));
    });
    const w = u.div(28).mul(m0).mul(We).mul(La).mul(1.1);
    return d.add(w);
  })(),
  Fa = $a(ka, 0.1, 0.55, 0.85),
  _n = pe(() => {
    const t = c0,
      e = Zt(0.25, 0.95, wt(t.sub(0.5)).mul(1.25)),
      a = ft(At(Y(t.add(ft(nt)), Ot(12.9898, 78.233))).mul(43758.5453)).sub(
        0.5,
      );
    return Wt(
      ka
        .add(Fa.rgb)
        .mul(r(1).sub(e.mul(0.32)))
        .add(a.mul(0.01)),
      1,
    );
  })(),
  Ut = new Za(X, _n);
Ut.bloom = Fa;
Qa(X, Ut);
const Me = new K(),
  ye = new K(),
  B0 = new K();
function Ea() {
  const t = L.position.length() < at;
  (t
    ? (Me.set(0, 0, 0), m0.value.set("#ff8a3a"))
    : (Me.set(0, at * Math.cos(Et) + 2.5, 0),
      m0.value.set("#ffa25a").multiplyScalar(0.7)),
    ye.copy(Me).project(L),
    L.getWorldDirection(B0));
  const e = B0.dot(Me.clone().sub(L.position)) > 0,
    a = Math.max(0, 1 - Math.max(Math.abs(ye.x), Math.abs(ye.y)) / 1.6);
  (Ia.value.set(ye.x * 0.5 + 0.5, 0.5 - ye.y * 0.5),
    (N0.value = t
      ? 2.4
      : 1 + 3 * Math.exp(-Math.max(0, L.position.distanceTo(Me) - 4) / 9)),
    (We.value += ((e ? a : 0) - We.value) * 0.06));
}
const Jt = X.domElement,
  Lt = new an(L, Jt);
Object.assign(Lt, {
  enabled: !1,
  enableDamping: !0,
  dampingFactor: 0.06,
  rotateSpeed: 0.6,
  zoomSpeed: 0.8,
  enablePan: !1,
  autoRotateSpeed: 0.4,
});
const Gn = {
    outside: {
      position: new K(24, 14, 34),
      target: new K(0, 0, 0),
      min: 15,
      max: 90,
    },
    inside: {
      position: new K(5.8, 0.6, 3.2),
      target: new K(0, -1.8, 0),
      min: 2.6,
      max: 7.4,
    },
  },
  N = {
    mode: "film",
    orbit: null,
    travelTo: 0,
    travelThen: null,
    settle: 0,
    fov: 50,
    from: { p: new K(), t: new K(), fov: 50 },
  };
let $ = Ye ?? 0;
const Ct = { yaw: 0, pitch: 0, dragging: !1 },
  Xn = new ca(),
  Yn = new Cn(0, 0, 0, "YXZ"),
  q0 = new _e(),
  W0 = new K();
function Be(t) {
  if (((Ct.yaw = Ct.pitch = 0), t === "film")) {
    ((N.mode = "film"), ($ = 0), (Lt.enabled = !1));
    return;
  }
  const e = L.position.length() < at;
  if (((Lt.enabled = !1), t === "inside" && !e)) {
    (N.mode !== "film" && ($ = 0),
      (N.mode = "travel"),
      (N.travelTo = re),
      (N.travelThen = t));
    return;
  }
  if (t === "outside" && e) {
    (($ = Math.min($, re)),
      (N.mode = "travel"),
      (N.travelTo = 0),
      (N.travelThen = t));
    return;
  }
  Da(t);
}
function Da(t) {
  ((N.mode = "settle"),
    (N.orbit = t),
    (N.settle = 0),
    (N.from.fov = L.fov),
    N.from.p.copy(L.position),
    L.getWorldDirection(W0),
    N.from.t.copy(L.position).addScaledVector(W0, 6));
}
function r0(t) {
  const e = Fn(t, L.aspect);
  (L.position.copy(e.position),
    q0.lookAt(e.position, e.target, L.up),
    L.quaternion.setFromRotationMatrix(q0),
    (L.fov = e.fov));
}
function Kn(t) {
  if (N.mode === "film" || N.mode === "travel") {
    if (N.mode === "travel") {
      const e = Math.sign(N.travelTo - $);
      (($ += e * t * 2.2),
        Math.sign(N.travelTo - $) !== e &&
          (($ = N.travelTo), r0($), Da(N.travelThen)));
    } else
      Ye === null && (($ += t), $ > qe && ($ = re + (($ - re) % (qe - re))));
    if (N.mode !== "settle") {
      if ((r0($), !Ct.dragging && !_t)) {
        const e = Math.exp(-t * 0.35);
        ((Ct.yaw *= e), (Ct.pitch *= e));
      }
      L.quaternion.multiply(Xn.setFromEuler(Yn.set(Ct.pitch, Ct.yaw, 0)));
    }
  }
  if (N.mode === "settle") {
    const e = Gn[N.orbit];
    N.settle = Math.min(1, N.settle + t / 2.4);
    const a = N.settle,
      s = a * a * a * (a * (a * 6 - 15) + 10);
    (L.position.lerpVectors(N.from.p, e.position, s),
      Lt.target.lerpVectors(N.from.t, e.target, s),
      L.lookAt(Lt.target),
      (L.fov = Pt.lerp(N.from.fov, N.fov, s)),
      N.settle >= 1 &&
        ((N.mode = "orbit"),
        Object.assign(Lt, {
          enabled: !0,
          minDistance: e.min,
          maxDistance: e.max,
        }),
        Lt.update()));
  }
  (N.mode === "orbit" && ((L.fov = N.fov), Lt.update()),
    L.updateProjectionMatrix(),
    L.updateMatrixWorld(),
    f0.value.copy(L.matrixWorld),
    b0.value.copy(L.projectionMatrixInverse));
}
let ue = null;
Jt.addEventListener("pointerdown", (t) => {
  N.mode === "film" &&
    ((ue = { x: t.clientX, y: t.clientY }),
    (Ct.dragging = !0),
    Jt.setPointerCapture(t.pointerId));
});
Jt.addEventListener("pointermove", (t) => {
  if (!ue) return;
  const e = Pt.degToRad(L.fov) / innerHeight;
  ((Ct.yaw = Pt.clamp(Ct.yaw + (t.clientX - ue.x) * e, -1.6, 1.6)),
    (Ct.pitch = Pt.clamp(Ct.pitch + (t.clientY - ue.y) * e, -1.2, 1.2)),
    (ue = { x: t.clientX, y: t.clientY }));
});
const ja = () => {
  ((ue = null), (Ct.dragging = !1));
};
Jt.addEventListener("pointerup", ja);
Jt.addEventListener("pointercancel", ja);
addEventListener("keydown", (t) => {
  t.target.closest?.("input, textarea, select") ||
    (t.code === "Space" && (t.preventDefault(), Be("film")),
    t.code === "KeyO" && Be("outside"),
    t.code === "KeyI" && Be("inside"));
});
addEventListener("resize", () => {
  (X.setSize(innerWidth, innerHeight), (L.aspect = innerWidth / innerHeight));
});
let Ba = 0;
const se = Ke.clone(),
  qa = (t) => {
    Ba = t;
    const e = Pt.degToRad(t),
      a = Math.cos(e),
      s = Math.sin(e);
    ($t.value.set(se.x * a - se.z * s, se.y, se.x * s + se.z * a).normalize(),
      Se.position.copy($t.value).multiplyScalar(50));
  },
  $n = Ha(st, (t) => {
    (se.set(...(t?.key ?? Ke)).normalize(),
      Se.color.set(t?.keyColor ?? "#fff4e6"),
      (Se.intensity = 3.2 * (t ? t.keyLevel / 4.4 : 1)),
      qa(Ba));
  });
function Zn() {
  return (
    yn({
      Studio: $n,
      fps: xn(() => me, { graph: !0, interval: 250 }),
      Camera: Gt({
        "auto rotate": {
          value: !1,
          onChange: (t) => {
            Lt.autoRotate = t;
          },
        },
        "rotate speed": {
          value: Lt.autoRotateSpeed,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: (t) => {
            Lt.autoRotateSpeed = t;
          },
        },
        "field of view": {
          value: N.fov,
          min: 25,
          max: 80,
          step: 1,
          onChange: (t) => {
            N.fov = t;
          },
        },
      }),
      Core: Gt({
        heat: {
          value: 1,
          min: 0.6,
          max: 1.4,
          step: 0.01,
          onChange: (t) => {
            v0.value = t;
          },
        },
        light: {
          value: Pe.value,
          min: 0,
          max: 200,
          step: 1,
          onChange: (t) => {
            ((Pe.value = t), (Sa.intensity = t));
          },
        },
        "drip speed": {
          value: 1,
          min: 0.2,
          max: 3,
          step: 0.05,
          onChange: (t) => {
            Vt.dripSpeed = t;
          },
        },
        "drip size": {
          value: 1,
          min: 0.6,
          max: 1.3,
          step: 0.01,
          onChange: (t) => {
            Vt.dripSize = t;
          },
        },
      }),
      Lava: Gt({
        glow: {
          value: 1,
          min: 0,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            ha.value = t;
          },
        },
      }),
      Earth: Gt({
        "sun angle": { value: 0, min: -180, max: 180, step: 1, onChange: qa },
        clouds: {
          value: 1,
          min: 0,
          max: 1.3,
          step: 0.01,
          onChange: (t) => {
            M0.value = t;
          },
        },
        atmosphere: {
          value: 1,
          min: 0,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            y0.value = t;
          },
        },
        "city lights": {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            fa.value = t;
          },
        },
        "heat column": {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            za.value = t;
          },
        },
        embers: {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            Ra.value = t;
          },
        },
      }),
      Space: Gt({
        stars: {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            ba.value = t;
          },
        },
        nebula: {
          value: 1,
          min: 0,
          max: 4,
          step: 0.01,
          onChange: (t) => {
            ga.value = t;
          },
        },
      }),
      Finish: Gt({
        exposure: {
          value: X.toneMappingExposure,
          min: 0.3,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            X.toneMappingExposure = t;
          },
        },
        bloom: {
          value: 0.1,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            Ut.bloom.strength.value = t;
          },
        },
        "light shafts": {
          value: 0.45,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            La.value = t;
          },
        },
        "heat shimmer": {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            N0.value = t;
          },
        },
        "tone mapping": {
          value: "aces",
          options: ["aces", "agx", "neutral"],
          onChange: (t, e, a) => {
            a.initial ||
              ((X.toneMapping = { agx: na, aces: aa, neutral: ea }[t]),
              (Ut.needsUpdate = !0));
          },
        },
      }),
      Performance: Gt(
        {
          "auto resolution": {
            value: Vt.autoRes,
            onChange: (t) => {
              Vt.autoRes = t;
            },
          },
          resolution: {
            value: X.getPixelRatio(),
            min: 0.5,
            max: 2,
            step: 0.05,
            onChange: (t, e, a) => {
              a.initial || ((Vt.autoRes = !1), X.setPixelRatio(t));
            },
          },
        },
        { collapsed: !0 },
      ),
      ...An({ renderer: X, pipeline: Ut }),
    }),
    null
  );
}
if (!_t) {
  const t = document.querySelector("#controls");
  vn.createRoot(t).render(
    Re.createElement(
      Re.Fragment,
      null,
      Re.createElement(Mn, { collapsed: !0, titleBar: { title: "Controls" } }),
      Re.createElement(Zn),
    ),
  );
}
let H0 = performance.now(),
  a0 = 0,
  Fe = 0,
  me = 60,
  O0 = 0;
const V0 = Math.min(devicePixelRatio, he ? 1.25 : 1.5);
X.setAnimationLoop(() => {
  const t = performance.now(),
    e = (t - H0) / 1e3;
  if (((H0 = t), a0++, (Fe += e), Fe > 1)) {
    me = a0 / Fe;
    const s = X.getPixelRatio();
    (st.has("fixres") ||
      !Vt.autoRes ||
      (me < 55 && s > 0.6
        ? X.setPixelRatio(Math.max(0.6, s - (me < 40 ? 0.2 : 0.1)))
        : me > 59.5 && s < V0 && X.setPixelRatio(Math.min(V0, s + 0.05))),
      (a0 = 0),
      (Fe = 0));
  }
  const a = Math.min(0.05, e);
  (Kn(a),
    Ea(),
    (O0 += a * Vt.dripSpeed),
    (Ft.value = Ye ?? O0),
    (nt.value = performance.now() / 1e3),
    S0(Ft.value),
    Ut.render());
});
if (_t) {
  X.setAnimationLoop(null);
  const t = +st.get("frames"),
    e = +(st.get("every") || 1),
    a = st.get("port"),
    s = +(st.get("start") || 0),
    m = async (c) => {
      const h = await new Promise((n) => Jt.toBlob(n, "image/png"));
      await fetch(`http://localhost:${a}/frame?i=${c}`, {
        method: "POST",
        body: h,
      });
    };
  for (let c = 0, h = 0; c < t; c++)
    (($ = s + c / jn),
      r0($),
      L.updateProjectionMatrix(),
      L.updateMatrixWorld(),
      Ea(),
      f0.value.copy(L.matrixWorld),
      b0.value.copy(L.projectionMatrixInverse),
      (Ft.value = $),
      (nt.value = $),
      S0($),
      (X.toneMappingExposure = En($)),
      Ut.render(),
      await X.backend.device.queue.onSubmittedWorkDone(),
      c % e === 0 && (await m(h++)));
  await fetch(`http://localhost:${a}/done`);
}
h0.textContent = "";
document.body.classList.add("ready");
window.hollow = {
  scene: ot,
  camera: L,
  renderer: X,
  pipeline: Ut,
  world: A0,
  crustMesh: Ca,
  ash: P0,
  go: Be,
  setTime: (t) => {
    $ = t;
  },
  fps: () => me,
  DIVE: re,
};
