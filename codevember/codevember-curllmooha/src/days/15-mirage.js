import "../lib/modulepreload-polyfill.js";
import {
  F as zt,
  A as Z,
  s as D,
  g as _,
  z as Cs,
  u as H,
  b as A,
  a1 as Ft,
  D as Qt,
  a2 as X,
  Q as ht,
  n as be,
  Y as As,
  Z as te,
  af as $t,
  y as ee,
  at as Ye,
  al as vo,
  $ as yt,
  m as q,
  E as ks,
  O as Wo,
  as as Ps,
  aF as Ns,
  aj as Vs,
  J as ve,
  c as Is,
  B as ft,
  I as me,
  e as Es,
  f as Mt,
  h as Bo,
  aG as Ts,
  p as Rs,
  o as Ls,
  j as Ds,
  au as Gt,
  x as wt,
  H as oe,
  aH as Yo,
  k as Fs,
  aI as js,
  R as Ws,
  aa as Bs,
} from "../lib/stage.js";
import { m as Ys, a as Ne } from "../lib/BufferGeometryUtils.js";
import {
  V as Y,
  O as Gs,
  I as jt,
  C as Ve,
  q as Ge,
  d as ze,
  Y as Jt,
  M as gt,
  aM as Us,
  t as Me,
  B as kt,
  F as nt,
  bc as qs,
  aO as oo,
  aU as Go,
  b1 as Ue,
  aQ as Uo,
  m as qo,
  a3 as Xs,
  aB as Le,
  aR as Xo,
  ar as so,
  aC as Hs,
  Q as qe,
  b2 as Os,
  b as Zs,
  a as _s,
  p as $s,
  b3 as Ks,
  f as Ho,
  e as at,
  aX as Qs,
  S as Js,
  P as ta,
  D as ea,
  H as oa,
  bi as sa,
  aq as aa,
  aH as na,
  ba as ra,
  c as ca,
  r as he,
  L as la,
  u as ia,
  am as ua,
  l as da,
  g as De,
} from "../lib/leva.js";
import "../lib/three.js";
const ao = 0.42,
  Wt = Math.cos(ao),
  Bt = Math.sin(ao),
  Oo = ao + 0.62,
  Se = Math.cos(Oo),
  Ce = Math.sin(Oo),
  Zo = 110,
  _o = 4.4,
  $o = 34,
  Ko = 1,
  Ae = 230,
  Qo = -170,
  Jo = 20,
  ts = 650,
  es = 1200,
  zo = (t) => Math.sin(t) - Math.sin(2 * t) / 2 + Math.sin(3 * t) / 3,
  So = (t, e, o) => {
    const n = Math.min(1, Math.max(0, (o - t) / (e - t)));
    return n * n * (3 - 2 * n);
  },
  ma = (t, e) => So(Qo, Jo, e) * (1 - So(ts, es, Math.hypot(t, e)));
function ot(t, e) {
  const o =
      0.55 * Math.sin(((-t * Bt + e * Wt) / Ae) * 6.283) +
      0.25 * Math.sin((t * Wt + e * Bt) / (Ae * 0.43) + 1.7),
    n = ((t * Wt + e * Bt) / Zo + o) * 6.283,
    s =
      ((t * Se + e * Ce) / $o + 0.5 * Math.sin((-t * Ce + e * Se) / 70 + 0.4)) *
      6.283;
  return (_o * zo(n) * 0.62 + Ko * zo(s) * 0.55 + 1.3) * ma(t, e);
}
const Co = (t) =>
    Z(t)
      .sub(Z(t.mul(2)).mul(0.5))
      .add(Z(t.mul(3)).div(3)),
  ha = zt(([t]) => {
    const e = t.x,
      o = t.y,
      n = Z(e.mul(-Bt).add(o.mul(Wt)).div(Ae).mul(6.283))
        .mul(0.55)
        .add(
          Z(
            e
              .mul(Wt)
              .add(o.mul(Bt))
              .div(Ae * 0.43)
              .add(1.7),
          ).mul(0.25),
        ),
      s = e.mul(Wt).add(o.mul(Bt)).div(Zo).add(n).mul(6.283),
      l = e
        .mul(Se)
        .add(o.mul(Ce))
        .div($o)
        .add(Z(e.mul(-Ce).add(o.mul(Se)).div(70).add(0.4)).mul(0.5))
        .mul(6.283);
    return Co(s)
      .mul(_o * 0.62)
      .add(Co(l).mul(Ko * 0.55))
      .add(1.3);
  }),
  pa = zt(([t]) => D(Qo, Jo, t.y).mul(_(1).sub(D(ts, es, Cs(t))))),
  Ot = zt(([t]) => ha(t).mul(pa(t)));
function Ut(t) {
  let e = t >>> 0;
  return () => (e = (Math.imul(e, 1664525) + 1013904223) >>> 0) / 4294967296;
}
const fa = (t) => t - Math.floor(t),
  wa = (t, e, o) => fa(Math.sin(t * 127.1 + e * 311.7 + o * 74.7) * 43758.5453);
function xe(t, e, o) {
  const n = Math.floor(t),
    s = Math.floor(e),
    l = Math.floor(o),
    i = t - n,
    d = e - s,
    r = o - l,
    u = i * i * (3 - 2 * i),
    a = d * d * (3 - 2 * d),
    h = r * r * (3 - 2 * r),
    c = (x, y, M) => x + (y - x) * M,
    m = (x, y, M) => wa(n + x, s + y, l + M);
  return (
    c(
      c(c(m(0, 0, 0), m(1, 0, 0), u), c(m(0, 1, 0), m(1, 1, 0), u), a),
      c(c(m(0, 0, 1), m(1, 0, 1), u), c(m(0, 1, 1), m(1, 1, 1), u), a),
      h,
    ) *
      2 -
    1
  );
}
const Ao = (t, e, o, n = 4) => {
    let s = 0,
      l = 0.5,
      i = 1;
    for (let d = 0; d < n; d++)
      ((s += xe(t * i, e * i, o * i) * l), (i *= 2.03), (l *= 0.5));
    return s;
  },
  pe = (t, e, o) => {
    const n = Math.min(1, Math.max(0, (o - t) / (e - t)));
    return n * n * (3 - 2 * n);
  };
function Ma(t) {
  const e = Ut(t),
    o = [];
  for (let c = 0; c < 3; c++)
    for (const m of [-1, 1]) {
      const x = new Y((e() - 0.5) * 0.6, (e() - 0.5) * 0.6, (e() - 0.5) * 0.6);
      (x.setComponent(c, m), x.normalize(), o.push([x, 0.72 + e() * 0.3]));
    }
  for (let c = 0; c < 11; c++)
    o.push([
      new Y(e() * 2 - 1, e() * 2 - 1, e() * 2 - 1).normalize(),
      0.7 + e() * 0.34,
    ]);
  const n = [];
  for (let c = -2; c < 2; ) {
    const m = 0.07 + Math.pow(e(), 1.6) * 0.3;
    (n.push({ bottom: c, top: c + m, hard: e() }), (c += m));
  }
  const s = Array.from({ length: 3 }, () => {
      const c = e() * Math.PI * 2;
      return {
        nx: Math.cos(c),
        nz: Math.sin(c),
        dip: (e() - 0.5) * 0.6,
        off: (e() - 0.5) * 1.2,
        w: 0.015 + e() * 0.03,
        d: 0.02 + e() * 0.04,
      };
    }),
    l = (e() - 0.5) * 0.14,
    i = (e() - 0.5) * 0.1,
    d = t % 97;
  let r = new Us(1, 11);
  (r.deleteAttribute("normal"), r.deleteAttribute("uv"), (r = Ys(r)));
  const u = r.attributes.position,
    a = new Y(),
    h = new Float32Array(u.count);
  for (let c = 0; c < u.count; c++) {
    a.fromBufferAttribute(u, c).normalize();
    let m = 1.8;
    for (const [E, G] of o) {
      const f = a.dot(E);
      f > 0.001 && (m = Math.min(m, G / f));
    }
    let x = a.x * m,
      y = a.y * m,
      M = a.z * m;
    const S = y + x * l + M * i + xe(x * 2 + d, 0, M * 2) * 0.012,
      P = n.find((E) => S < E.top) || n[n.length - 1],
      I = (S - P.bottom) / (P.top - P.bottom),
      N = Math.min(I, 1 - I),
      j = (1 - pe(0.01, 0.2, N)) * (0.004 + (1 - P.hard) * 0.03),
      R = 0.4 + 0.6 * pe(-0.5, 0.5, xe(x * 2.1 + d, y * 0.9, M * 2.1));
    let V = 0;
    for (const E of s) {
      const G = Math.abs(
        x * E.nx +
          M * E.nz +
          y * E.dip -
          E.off +
          xe(x * 7 + d, y * 6, M * 7) * 0.012,
      );
      V = Math.max(V, (1 - pe(0, E.w, G)) * E.d);
    }
    const z =
        (1 - pe(-0.8, 0.3, y)) *
        (0.03 + Ao(x * 2.8 + d, y * 1.9, M * 2.8, 2) * 0.03),
      W = Ao(x * 3.3 + d, y * 4.1, M * 3.3, 4) * 0.045;
    ((m = Math.max(0.2, m - j * R - V - z + W)),
      u.setXYZ(c, a.x * m, a.y * m, a.z * m),
      (h[c] = S));
  }
  return (r.setAttribute("strata", new Me(h, 1)), r.computeVertexNormals(), r);
}
function xa(t) {
  const e = new Ft({ roughness: 0.94, metalness: 0 }),
    o = Qt("strata", "float"),
    n = yt,
    s = X(n.mul(9).add(3.1)).mul(0.5).add(0.5),
    l = X(n.mul(1.6).add(7.7)).mul(0.5).add(0.5),
    i = X(A(o.mul(11), n.x.mul(0.6), n.z.mul(0.6))),
    d = Z(o.mul(23).add(i.mul(4)).add(l.mul(3)))
      .mul(0.5)
      .add(0.5);
  let r = q(
    A(0.33, 0.17, 0.085),
    A(0.58, 0.36, 0.2),
    l.mul(0.7).add(s.mul(0.3)),
  );
  ((r = r.mul(d.mul(0.26).add(0.86))),
    (r = q(
      r,
      A(0.6, 0.45, 0.32),
      D(0.9, 0.99, d)
        .mul(D(0, 0.6, i))
        .mul(0.4),
    )));
  const u = D(0.55, 0.85, X(A(n.x.mul(6), n.y.mul(0.7), n.z.mul(6)))).mul(0.35);
  r = r.mul(_(1).sub(u)).mul(s.mul(0.18).add(0.9));
  const a = D(0.55, 0.9, Wo.y).mul(0.55),
    h = D(0.6, 0, ht.y.sub(Qt("groundY", "float"))).mul(0.8);
  return ((e.colorNode = q(r, t, a.max(h))), e);
}
function ya(t = 15971) {
  const e = Ut(t),
    o = [],
    n = [],
    s = [],
    l = [],
    i = [
      [0.78, 0.66, 0.42],
      [0.86, 0.76, 0.52],
      [0.66, 0.55, 0.34],
      [0.72, 0.62, 0.44],
      [0.58, 0.5, 0.36],
    ],
    d = 36;
  for (let a = 0; a < d; a++) {
    const h = a % 9 === 0,
      c = e() * Math.PI * 2,
      m = Math.pow(e(), 0.6),
      x = (h ? 0.08 : 0.15) + m * (h ? 0.2 : 0.55),
      y = h ? 0.75 + e() * 0.35 : 0.28 + e() * 0.5,
      M = h ? 0.004 : 0.006 + e() * 0.008,
      S = Math.cos(c) * m * 0.07,
      P = Math.sin(c) * m * 0.07,
      I = i[Math.floor(e() * i.length)],
      N = 0.85 + e() * 0.3,
      j = o.length / 3,
      R = 5;
    for (let V = 0; V < R; V++) {
      const z = V / (R - 1),
        W = M * (1 - z * 0.9),
        E = x * z * z * 1.3,
        G = y * (z - z * z * x * 0.6);
      for (const f of [-1, 1]) {
        (o.push(
          S + Math.cos(c) * E - Math.sin(c) * W * f,
          G,
          P + Math.sin(c) * E + Math.cos(c) * W * f,
        ),
          n.push((f + 1) / 2, z));
        const p = 0.45 + 0.55 * Math.min(1, z * 2.5);
        s.push(I[0] * N * p, I[1] * N * p, I[2] * N * p);
      }
    }
    for (let V = 0; V < R - 1; V++) {
      const z = V * 2;
      for (const W of [
        [z, z + 1, z + 2],
        [z + 1, z + 3, z + 2],
      ])
        l.push(...W.map((E) => j + E));
    }
    if (h) {
      const V = o.length / 3,
        z = S + Math.cos(c) * x * 1.3,
        W = P + Math.sin(c) * x * 1.3,
        E = y * (1 - x * 0.6);
      for (const [G, f] of [
        [-0.12, 0],
        [-0.06, 0.012],
        [0.04, 0],
      ])
        for (const p of [-1, 1])
          (o.push(z - Math.sin(c) * f * p, E + G, W + Math.cos(c) * f * p),
            n.push((p + 1) / 2, 1),
            s.push(0.93, 0.88, 0.76));
      for (const G of [
        [0, 1, 2],
        [1, 3, 2],
        [2, 3, 4],
        [3, 5, 4],
      ])
        l.push(...G.map((f) => V + f));
    }
  }
  const r = new kt();
  (r.setAttribute("position", new nt(o, 3)),
    r.setAttribute("uv", new nt(n, 2)),
    r.setAttribute("color", new nt(s, 3)),
    r.setIndex(l),
    r.computeVertexNormals());
  const u = r.attributes.normal;
  for (let a = 0; a < u.count; a++) {
    const h = u.getX(a) * 0.35,
      c = u.getZ(a) * 0.35,
      m = Math.hypot(h, 0.94, c);
    u.setXYZ(a, h / m, 0.94 / m, c / m);
  }
  return r;
}
function Xe(t, e, o, n = 6) {
  const s = new oo(t),
    l = Math.max(3, t.length * 4),
    i = s.computeFrenetFrames(l, !1),
    d = [],
    r = [];
  for (let a = 0; a <= l; a++) {
    const h = a / l,
      c = s.getPointAt(h),
      m = e + (o - e) * h;
    for (let x = 0; x < n; x++) {
      const y = (x / n) * Math.PI * 2,
        M = i.normals[a]
          .clone()
          .multiplyScalar(Math.cos(y))
          .add(i.binormals[a].clone().multiplyScalar(Math.sin(y)));
      d.push(c.x + M.x * m, c.y + M.y * m, c.z + M.z * m);
    }
  }
  for (let a = 0; a < l; a++)
    for (let h = 0; h < n; h++) {
      const c = a * n + h,
        m = a * n + ((h + 1) % n),
        x = c + n,
        y = m + n;
      r.push(c, m, x, m, y, x);
    }
  const u = new kt();
  return (
    u.setAttribute("position", new nt(d, 3)),
    u.setIndex(r),
    u.computeVertexNormals(),
    u
  );
}
function os(t, e, o, n, s, l, i, d, r) {
  const u = [n.clone()];
  let a = n.clone(),
    h = s.clone();
  const c = 4;
  for (let x = 0; x < c; x++)
    (h
      .add(
        new Y(
          (t() - 0.5) * r.twist,
          (t() - 0.5) * r.twist * 0.6 + r.rise,
          (t() - 0.5) * r.twist,
        ),
      )
      .normalize(),
      (a = a.clone().addScaledVector(h, l / c)),
      u.push(a));
  if ((e.push(Xe(u, i, i * r.taper, d > 1 ? 6 : 4)), d <= 0)) {
    o && o.push(a.clone());
    return;
  }
  const m = r.kids(d, t);
  for (let x = 0; x < m; x++) {
    const y = t() * Math.PI * 2,
      M = h
        .clone()
        .add(new Y(Math.cos(y), 0, Math.sin(y)).multiplyScalar(r.spread))
        .normalize(),
      S = u[Math.floor(2 + t() * (u.length - 2))];
    os(t, e, o, S, M, l * r.shrink, i * r.taper, d - 1, r);
  }
}
function fe(t) {
  const e = Ut(t),
    o = [],
    n = [],
    s = 9 + Math.floor(e() * 5);
  for (let a = 0; a < s; a++) {
    const h = e() * Math.PI * 2,
      c = 0.15 + e() * 0.35,
      m = new Y(Math.cos(h) * c, 1, Math.sin(h) * c).normalize();
    os(
      e,
      o,
      n,
      new Y((e() - 0.5) * 0.08, 0, (e() - 0.5) * 0.08),
      m,
      0.45 + e() * 0.35,
      0.014,
      2,
      {
        twist: 0.35,
        rise: 0.12,
        taper: 0.5,
        shrink: 0.6,
        spread: 0.45,
        kids: () => 2 + Math.floor(e() * 2),
      },
    );
  }
  const l = [],
    i = [],
    d = (a, h, c) => {
      const m = new Y()
          .crossVectors(h, new Y(e() - 0.5, e() - 0.5, e() - 0.5))
          .normalize(),
        x = a.clone().addScaledVector(h, c),
        y = a.clone().addScaledVector(h, c * 0.45),
        M = c * 0.22,
        S = y.clone().addScaledVector(m, M),
        P = y.clone().addScaledVector(m, -M),
        I = 0.75 + e() * 0.5,
        N = [0.24 * I, 0.27 * I, 0.15 * I];
      for (const [j, R, V] of [
        [a, S, x],
        [a, x, P],
        [a, x, S],
        [a, P, x],
      ]) {
        l.push(...j.toArray(), ...R.toArray(), ...V.toArray());
        for (let z = 0; z < 3; z++) i.push(...N);
      }
    };
  for (const a of n) {
    const h = 26 + Math.floor(e() * 12);
    for (let c = 0; c < h; c++) {
      const m = a
          .clone()
          .add(new Y((e() - 0.5) * 0.1, -e() * 0.16, (e() - 0.5) * 0.1)),
        x = new Y(e() - 0.5, e() * 0.8 + 0.1, e() - 0.5).normalize();
      d(m, x, 0.014 + e() * 0.014);
    }
  }
  const r = new kt();
  (r.setAttribute("position", new nt(l, 3)),
    r.setAttribute("color", new nt(i, 3)),
    r.computeVertexNormals());
  const u = r.attributes.normal;
  for (let a = 0; a < u.count; a++) {
    const h = u.getX(a) * 0.4,
      c = u.getZ(a) * 0.4,
      m = Math.hypot(h, 0.9, c);
    u.setXYZ(a, h / m, 0.9 / m, c / m);
  }
  return { wood: Ne(o), leaves: r };
}
function ga(t, e) {
  const o = Ut(t),
    n = [],
    s = [];
  function l(M, S, P, I, N, j, R) {
    const V = [M.clone()];
    let z = M.clone(),
      W = S.clone();
    const E = 3 + Math.floor(P * 1.5);
    for (let f = 0; f < E; f++)
      (W.add(
        new Y((o() - 0.5) * R, (o() - 0.35) * R * 0.7, (o() - 0.5) * R),
      ).normalize(),
        (z = z.clone().addScaledVector(W, P / E)),
        V.push(z));
    if ((n.push(Xe(V, I, N, j >= 2 ? 8 : j === 1 ? 5 : 3)), j === 0)) {
      s.push(z);
      return;
    }
    const G = j >= 2 ? 2 + Math.floor(o() * 2) : 2 + Math.floor(o() * 3);
    for (let f = 0; f < G; f++) {
      const p = 0.35 + o() * 0.6,
        g = Math.min(V.length - 1, Math.round(p * (V.length - 1))),
        k = I + (N - I) * (g / (V.length - 1)),
        L = o() * Math.PI * 2,
        C = W.clone()
          .multiplyScalar(0.6)
          .add(new Y(Math.cos(L), (e ? 0.04 : 0.2) + o() * 0.6, Math.sin(L)))
          .normalize();
      l(V[g], C, P * (0.45 + o() * 0.25), k * 0.82, k * 0.25, j - 1, R * 1.15);
    }
  }
  const i = 0.9 + o() * 0.9,
    d = new Y((o() - 0.5) * 0.3, 1, (o() - 0.5) * 0.3).normalize(),
    r = [new Y(0, -0.4, 0)];
  for (let M = 1; M <= 5; M++)
    r.push(
      new Y(
        (d.x * i * M) / 5 + (o() - 0.5) * 0.06,
        (i * M) / 5,
        (d.z * i * M) / 5 + (o() - 0.5) * 0.06,
      ),
    );
  n.push(Xe(r, 0.26, 0.17, 10));
  const u = new qs(0.5, 0.7, 10, 1, !0);
  (u.translate(0, -0.05, 0), n.push(u));
  const a = r[r.length - 1],
    h = 2 + Math.floor(o() * 3);
  for (let M = 0; M < h; M++) {
    const S = (M / h) * Math.PI * 2 + o() * 0.9;
    l(
      a,
      new Y(Math.cos(S) * 0.8, 0.7 + o() * 0.5, Math.sin(S) * 0.8).normalize(),
      2.4 + o() * 1.6,
      0.15,
      0.05,
      3,
      0.55,
    );
  }
  const c = Ne(n.map((M) => (M.attributes.uv && M.deleteAttribute("uv"), M)));
  if (!e) return { wood: c };
  const m = [],
    x = [];
  for (const M of s)
    for (let S = 0; S < 60; S++) {
      const P = o() * Math.PI * 2,
        I = Math.sqrt(o()) * 0.78,
        N = M.x + Math.cos(P) * I,
        j = M.z + Math.sin(P) * I,
        R = M.y + 0.25 * (1 - I) + o() * 0.23,
        V = 0.074 + o() * 0.09,
        z = Math.cos(P) * V,
        W = Math.sin(P) * V;
      m.push(
        N - z,
        R,
        j - W,
        N - W * 0.5,
        R + 0.055,
        j + z * 0.5,
        N + z,
        R + 0.08,
        j + W,
        N - z,
        R,
        j - W,
        N + z,
        R + 0.08,
        j + W,
        N + W * 0.5,
        R - 0.014,
        j - z * 0.5,
      );
      const E = 0.54 + o() * 0.54;
      for (let G = 0; G < 6; G++) x.push(0.19 * E, 0.215 * E, 0.093 * E);
    }
  const y = new kt();
  return (
    y.setAttribute("position", new nt(m, 3)),
    y.setAttribute("color", new nt(x, 3)),
    y.computeVertexNormals(),
    { wood: c, crown: y }
  );
}
function Fe(t, e, o, n, s = 300) {
  const l = t.count,
    i = t.instanceMatrix.array,
    d = t.instanceColor?.array,
    r = t.geometry.getAttribute("groundY")?.array,
    u = new Map();
  for (let a = 0; a < l; a++) {
    const h =
      Math.floor(i[a * 16 + 12] / s) + "," + Math.floor(i[a * 16 + 14] / s);
    (u.has(h) || u.set(h, []), u.get(h).push(a));
  }
  for (const a of u.values()) {
    let h = t.geometry;
    r &&
      ((h = h.clone()),
      h.setAttribute(
        "groundY",
        new Ge(
          Float32Array.from(a, (m) => r[m]),
          1,
        ),
      ));
    const c = new jt(h, t.material, a.length);
    (a.forEach((m, x) => {
      (c.instanceMatrix.array.set(i.subarray(m * 16, m * 16 + 16), x * 16),
        d &&
          (c.instanceColor ||
            (c.instanceColor = new Ge(new Float32Array(a.length * 3), 3)),
          c.instanceColor.array.set(d.subarray(m * 3, m * 3 + 3), x * 3)));
    }),
      (c.castShadow = t.castShadow),
      (c.receiveShadow = t.receiveShadow),
      c.computeBoundingSphere(),
      (c.userData.maxDist = n),
      e.add(c),
      o.push(c));
  }
}
const ko = H(new Y(0, 1, 0));
function ba(t, { sandColor: e, avoid: o, sunDir: n }) {
  n && ko.value.copy(n);
  const s = Ut(20261115),
    l = [],
    i = [],
    d = new Gs(),
    r = A(...e),
    u = [];
  for (let f = 0; f < 46; f++) {
    const p = s() * Math.PI * 2,
      g = 25 + Math.pow(s(), 0.8) * 520,
      k = Math.sin(p) * g,
      L = Math.cos(p) * g * 0.85 + 40;
    (L < -150 && s() < 0.8) ||
      o(k, L, 14) ||
      u.push({ x: k, z: L, s: 0.5 + s() });
  }
  const a = Array.from({ length: 6 }, (f, p) => Ma(101 + p * 7919)),
    h = xa(r),
    c = a.map(() => []);
  for (const f of u) {
    const p = 2 + Math.floor(s() * 8 * f.s);
    for (let g = 0; g < p; g++) {
      const k = s() * Math.PI * 2,
        L = Math.pow(s(), 1.5) * 12 * f.s,
        C = f.x + Math.cos(k) * L,
        b = f.z + Math.sin(k) * L,
        F =
          g === 0 && s() < 0.5
            ? 2.5 + s() * 4
            : 0.25 + Math.pow(s(), 2.2) * 2.2;
      c[Math.floor(s() * a.length)].push({
        x: C,
        z: b,
        size: F,
        sx: 0.8 + s() * 0.7,
        sy: 0.55 + s() * 0.45,
        sz: 0.8 + s() * 0.6,
        ry: s() * 6.28,
        tilt: (s() - 0.5) * 0.3,
      });
    }
  }
  for (let f = 0; f < 70; f++) {
    const p = (s() - 0.5) * 500,
      g = -160 - s() * 500;
    c[Math.floor(s() * a.length)].push({
      x: p,
      z: g,
      size: 0.15 + Math.pow(s(), 3) * 1.2,
      sx: 1 + s() * 0.5,
      sy: 0.5 + s() * 0.3,
      sz: 1 + s() * 0.4,
      ry: s() * 6.28,
      tilt: 0,
    });
  }
  a.forEach((f, p) => {
    const g = c[p];
    if (!g.length) return;
    const k = new Float32Array(g.length),
      L = new jt(f, h, g.length);
    (g.forEach((C, b) => {
      const v = ot(C.x, C.z);
      (d.position.set(C.x, v + C.size * C.sy * 0.35, C.z),
        d.rotation.set(C.tilt, C.ry, C.tilt * 0.6),
        d.scale.set(C.size * C.sx, C.size * C.sy, C.size * C.sz),
        d.updateMatrix(),
        L.setMatrixAt(b, d.matrix),
        (k[b] = v));
      const F = 0.82 + s() * 0.32,
        K = s() * 0.12;
      (L.setColorAt(b, new Ve(F + K, F, F - K * 0.6)),
        C.size > 0.5 &&
          l.push([C.x, C.z, C.size * Math.max(C.sx, C.sz) * 0.85]));
    }),
      (L.geometry = f.clone()),
      L.geometry.setAttribute("groundY", new Ge(k, 1)),
      (L.castShadow = !0),
      (L.receiveShadow = !0),
      Fe(L, t, i, 900));
  });
  const m = ya(),
    x = new Ft({ roughness: 0.95, side: ze });
  x.colorNode = Qt("color", "vec3").mul(X(ht.xz.mul(0.05)).mul(0.12).add(1));
  const y = be(As.sub(ht));
  ((x.emissiveNode = Qt("color", "vec3").mul(
    te($t(ee(y, ko.negate()), 0), 4)
      .mul(Ye().y)
      .mul(0.55),
  )),
    (x.positionNode = zt(() => {
      const f = yt,
        p = Ye().y,
        g = Z(vo.mul(1.6).add(ht.x.mul(0.35)).add(ht.z.mul(0.2)))
          .mul(0.5)
          .add(0.5);
      return f.add(A(1, 0, 0.4).mul(p.mul(p).mul(g).mul(0.07)));
    })()));
  const M = [...u, { x: -9, z: -22, s: 0.44 }, { x: 12, z: -37, s: 0.56 }],
    S = 3e3,
    P = new jt(m, x, S);
  for (let f = 0; f < S; f++) {
    const p = M[f % M.length],
      g = s() * Math.PI * 2,
      k = Math.pow(s(), 1.4) * 16 * p.s + (s() < 0.3 ? s() * 40 : 0),
      L = p.x + Math.cos(g) * k,
      C = p.z + Math.sin(g) * k * 0.8;
    (d.position.set(L, ot(L, C) - 0.03, C),
      d.rotation.set(0, s() * 6.28, 0),
      d.scale.setScalar(0.6 + s() * 0.9),
      d.updateMatrix(),
      P.setMatrixAt(f, d.matrix));
  }
  ((P.receiveShadow = !0), Fe(P, t, i, 165, 55));
  const I = [fe(7), fe(31), fe(77), fe(113)],
    N = new Ft({ roughness: 0.9 });
  N.colorNode = q(
    A(0.28, 0.23, 0.18),
    A(0.6, 0.54, 0.46),
    X(yt.mul(6)).mul(0.5).add(0.5),
  );
  const j = new Ft({ roughness: 0.8 });
  j.colorNode = Qt("color", "vec3").mul(
    q(A(1), A(1.25, 1.1, 0.8), X(ht.mul(1.7)).mul(0.5).add(0.5).mul(0.6)),
  );
  const R = zt(() => {
    const f = yt,
      p = Z(vo.mul(1.2).add(ht.x.mul(0.3)).add(ht.z.mul(0.21)));
    return f.add(A(0.6, 0, 0.3).mul(f.y.mul(f.y).mul(p).mul(0.025)));
  });
  ((N.positionNode = R()), (j.positionNode = R()));
  const V = I.map(() => []);
  for (let f = 0; f < 260; f++) {
    const p = u[Math.floor(s() * u.length)],
      g = s() * Math.PI * 2,
      k = 3 + s() * 22 * p.s;
    V[f % I.length].push([
      p.x + Math.cos(g) * k,
      p.z + Math.sin(g) * k,
      0.7 + s() * 1.1,
      s() * 6.28,
    ]);
  }
  I.forEach((f, p) => {
    const g = V[p],
      k = new jt(f.wood, N, g.length),
      L = new jt(f.leaves, j, g.length);
    g.forEach(([C, b, v, F], K) => {
      (d.position.set(C, ot(C, b) - 0.05, b),
        d.rotation.set(0, F, 0),
        d.scale.set(v, v * (0.8 + (K % 3) * 0.1), v),
        d.updateMatrix(),
        k.setMatrixAt(K, d.matrix),
        L.setMatrixAt(K, d.matrix));
    });
    for (const C of [k, L])
      ((C.castShadow = !0), (C.receiveShadow = !0), Fe(C, t, i, 520));
  });
  const z = new Ft({ roughness: 0.92 });
  {
    const f = yt,
      p = D(
        0.55,
        0.9,
        ks(X(A(f.x.mul(14), f.y.mul(2.2), f.z.mul(14)))).oneMinus(),
      ),
      g = X(f.mul(2.3)).mul(0.5).add(0.5);
    let k = q(A(0.17, 0.13, 0.1), A(0.34, 0.28, 0.22), g);
    ((k = q(k, A(0.5, 0.45, 0.39), D(0.2, 0.9, Wo.y).mul(0.55))),
      (z.colorNode = k.mul(_(1).sub(p.mul(0.45)))));
  }
  const W = new Jt({ vertexColors: !0, roughness: 0.95, side: ze });
  return (
    [
      [-12, -26],
      [34, -95],
      [-70, 20],
      [95, 60],
      [-140, -120],
      [160, -60],
      [-40, 150],
      [60, 210],
      [-210, 40],
    ].forEach(([f, p], g) => {
      const { wood: k, crown: L } = ga(500 + g * 13, g % 3 === 0),
        C = new gt(k, z);
      if (L) {
        const v = new gt(L, W);
        ((v.castShadow = v.receiveShadow = !0), C.add(v));
      }
      const b = 0.9 + (g % 4) * 0.18;
      (C.position.set(f, ot(f, p), p),
        C.scale.setScalar(b),
        (C.rotation.y = g * 1.7),
        (C.castShadow = !0),
        (C.receiveShadow = !0),
        t.add(C),
        l.push([f, p, 0.5]));
    }),
    {
      colliders: l,
      update: (f) => {
        for (const p of i) {
          const g = p.boundingSphere.center,
            k = p.boundingSphere.radius;
          p.visible = Math.hypot(g.x - f.x, g.z - f.z) - k < p.userData.maxDist;
        }
      },
    }
  );
}
const je = (t) => new Y(...t),
  va = new Y(0, 1, 0),
  We = Math.PI * 2,
  ye = 0.51;
function et(t, e, o = 0) {
  return new Jt({ color: t, roughness: e, metalness: o });
}
function mt(t) {
  const e = [],
    o = [],
    n = [
      [1, 0.24],
      [1, 0.73],
      [0.74, 1],
      [-0.74, 1],
      [-1, 0.73],
      [-1, 0.24],
      [-0.7, 0],
      [0.7, 0],
    ];
  for (const [i, d, r, u] of t)
    for (const [a, h] of n) e.push(a * u, d + h * (r - d), i);
  const s = (t.length - 1) * 8;
  for (let i = 0; i < s; i++) {
    const d = i % 8 === 7 ? i - 7 : i + 1;
    o.push(i, d, i + 8, d, d + 8, i + 8);
  }
  for (let i = 1; i < 7; i++) o.push(0, i + 1, i, s, s + i, s + i + 1);
  const l = new kt();
  return (
    l.setAttribute("position", new nt(e, 3)),
    l.setIndex(o),
    l.computeVertexNormals(),
    l
  );
}
function Zt(t) {
  const e = new Xs();
  e.name = t;
  const o = new Map();
  function n(r, u, a = [0, 0, 0]) {
    (r.translate(...a),
      r.index && (r = r.toNonIndexed()),
      r.deleteAttribute("uv"),
      o.has(u) || o.set(u, []),
      o.get(u).push(r));
  }
  function s(r, u, a, h, c = a, m = 12) {
    const x = je(r),
      y = je(u),
      M = y.clone().sub(x),
      S = new Hs(c, a, M.length(), m);
    (S.applyQuaternion(new qe().setFromUnitVectors(va, M.normalize())),
      n(S, h, x.lerp(y, 0.5).toArray()));
  }
  function l(r, u, a, h = 0) {
    n(new so(1, 24, 16).scale(...u).rotateX(h), a, r);
  }
  function i(r, u, a) {
    n(new Go(new oo(r.map(je)), 24, u, 8), a);
  }
  function d() {
    for (const [r, u] of o) {
      const a = new gt(Ne(u), r);
      ((a.castShadow = a.receiveShadow = !0), e.add(a));
    }
    return e;
  }
  return { part: n, rod: s, oval: l, tube: i, build: d };
}
function za() {
  const t = et("#eee4c9", 0.34),
    e = et("#bd3c20", 0.32),
    o = et("#163d43", 0.38),
    n = et("#c99a50", 0.37, 0.58),
    s = et("#b6b9b3", 0.36, 0.65),
    l = et("#393a36", 0.51, 0.45),
    i = et("#302c29", 0.95),
    d = et("#413a33", 0.92),
    r = et("#292e2e", 0.91),
    u = et("#8d6950", 0.49, 0.58),
    a = new Jt({
      color: "#fff3cf",
      emissive: "#ffce84",
      emissiveIntensity: 1.1,
    }),
    h = new Jt({
      color: "#a31108",
      emissive: "#d52c12",
      emissiveIntensity: 0.65,
    });
  function c(b) {
    const v = Zt(b ? "Front wheel" : "Rear wheel"),
      F = b ? 0.078 : 0.1,
      K = ye - F - 0.022;
    v.part(new Le(K, F, 16, 64).scale(1, 1, 1.36).rotateY(Math.PI / 2), i);
    const it = K - F + 0.014;
    (v.part(new Le(it, 0.024, 10, 64).scale(1, 1, 2.8).rotateY(Math.PI / 2), n),
      v.rod([-0.095, 0, 0], [0.095, 0, 0], 0.073, l));
    for (let rt = 0; rt < 36; rt++) {
      const ut = (We * rt) / 36,
        Rt = rt % 2 ? 1 : -1,
        ue = ut + Rt * 0.27;
      v.rod(
        [Rt * 0.079, 0.066 * Math.cos(ut), 0.066 * Math.sin(ut)],
        [Rt * 0.022, it * Math.cos(ue), it * Math.sin(ue)],
        0.0055,
        s,
        0.0055,
        5,
      );
      for (const Nt of [-1, 0, 1]) {
        const qt = ut + Math.abs(Nt) * 0.076,
          Xt = ye - 0.019 - Math.abs(Nt) * F * 0.29,
          Ht = new Ue(F * 0.83, 0.036, b ? 0.046 : 0.059);
        (Ht.rotateY((Nt || Rt) * 0.3)
          .rotateZ(-Nt * 0.46)
          .rotateX(qt),
          v.part(Ht, d, [Nt * F * 0.89, Xt * Math.cos(qt), Xt * Math.sin(qt)]));
      }
    }
    const xt = b ? 0.205 : 0.158;
    v.part(new Xo(xt * 0.72, xt, 48).rotateY(Math.PI / 2), s, [0.109, 0, 0]);
    for (let rt = 0; rt < 6; rt++) {
      const ut = (We * rt) / 6;
      v.rod(
        [0.108, 0, 0],
        [0.108, xt * 0.85 * Math.cos(ut), xt * 0.85 * Math.sin(ut)],
        0.012,
        l,
      );
    }
    return (
      b ||
        v.part(
          new Le(0.152, 0.015, 8, 48).rotateY(Math.PI / 2),
          u,
          [-0.143, 0, 0],
        ),
      v.build()
    );
  }
  const m = Zt("Mirage rally chassis"),
    { part: x, rod: y, tube: M, oval: S } = m;
  for (const b of [-1, 1]) {
    const v = 0.15 * b;
    (M(
      [
        [v, 1.39, -0.64],
        [v, 0.84, -0.48],
        [v, 0.45, -0.23],
        [v, 0.44, 0.23],
        [v, 0.78, 0.32],
        [v, 1.39, -0.64],
      ],
      0.038,
      e,
    ),
      y([v, 0.7, 0.22], [b * 0.158, 0.51, 0.95], 0.063, s, 0.036),
      y([v, 0.71, 0.21], [v, 1.21, 0.91], 0.026, l),
      y([v, 1.21, 0.91], [v, 1.12, -0.14], 0.026, l),
      y([v, 0.61, 0.23], [b * 0.33, 0.61, 0.23], 0.034, l));
  }
  y([0, 0.56, 0.55], [0, 1.13, 0.24], 0.047, s);
  const P = [];
  for (let b = 0; b <= 140; b++) {
    const v = b / 140,
      F = v * We * 8;
    P.push(
      new Y(
        0.08 * Math.cos(F),
        0.64 + v * 0.4 + 0.035 * Math.sin(F),
        0.51 - v * 0.22 + 0.068 * Math.sin(F),
      ),
    );
  }
  (x(new Go(new oo(P), 150, 0.014, 8), n),
    S([0, 0.69, 0.04], [0.208, 0.206, 0.234], l),
    y([-0.21, 0.69, 0.07], [0.21, 0.69, 0.07], 0.143, s, 0.155, 32),
    y([0, 0.72, -0.08], [0, 1.03, -0.24], 0.126, l));
  for (let b = 0; b < 6; b++)
    x(new Ue(0.285, 0.019, 0.235).rotateX(-0.38), s, [
      0,
      0.8 + b * 0.042,
      -0.12 - b * 0.017,
    ]);
  (x(
    mt([
      [-0.48, 0.55, 0.69, 0.13],
      [-0.23, 0.4, 0.5, 0.188],
      [0.24, 0.42, 0.48, 0.16],
    ]),
    s,
  ),
    M(
      [
        [0.13, 0.99, -0.23],
        [0.22, 0.91, -0.39],
        [0.247, 0.64, -0.27],
        [0.24, 0.73, 0.32],
        [0.215, 0.99, 0.68],
      ],
      0.044,
      u,
    ),
    y([0.215, 0.98, 0.62], [0.215, 1.15, 1.19], 0.088, s, 0.074, 24),
    y([0.215, 1.15, 1.19], [0.215, 1.163, 1.235], 0.056, l, 0.041),
    M(
      [
        [-0.145, 0.82, 0.12],
        [-0.145, 0.665, 0.95],
        [-0.145, 0.51, 1.1],
        [-0.145, 0.357, 0.95],
        [-0.145, 0.63, 0.12],
        [-0.145, 0.72, 0.04],
        [-0.145, 0.82, 0.12],
      ],
      0.013,
      l,
    ),
    x(
      mt([
        [-0.73, 1.08, 1.34, 0.14],
        [-0.55, 0.91, 1.47, 0.226],
        [-0.32, 0.85, 1.44, 0.24],
        [0.09, 1.03, 1.26, 0.154],
      ]),
      t,
    ),
    x(
      mt([
        [-0.67, 1.31, 1.38, 0.15],
        [-0.52, 1.39, 1.49, 0.19],
        [-0.34, 1.37, 1.46, 0.19],
        [-0.04, 1.23, 1.29, 0.135],
      ]),
      e,
    ),
    y([0, 1.458, -0.37], [0, 1.485, -0.37], 0.063, l),
    x(
      mt([
        [0, 1.09, 1.23, 0.158],
        [0.32, 1.01, 1.21, 0.197],
        [0.71, 1.07, 1.26, 0.18],
        [1.09, 1.21, 1.3, 0.125],
        [1.36, 1.24, 1.27, 0.082],
      ]),
      o,
    ),
    x(
      mt([
        [-0.29, 1.32, 1.39, 0.102],
        [-0.02, 1.2, 1.31, 0.145],
        [0.31, 1.19, 1.275, 0.164],
        [0.69, 1.24, 1.32, 0.152],
        [0.89, 1.27, 1.32, 0.121],
      ]),
      r,
    ));
  for (let b = 0; b < 5; b++) {
    const v = 1.277 + b * 0.009,
      F = 0.34 + b * 0.078;
    y([-0.116, v, F], [0.116, v, F], 0.006, l);
  }
  (x(
    mt([
      [0.82, 1.24, 1.31, 0.15],
      [1.12, 1.25, 1.32, 0.13],
      [1.42, 1.22, 1.26, 0.083],
    ]),
    e,
  ),
    S([0, 1.219, 1.34], [0.077, 0.024, 0.028], h));
  const I = document.createElement("canvas");
  ((I.width = 512), (I.height = 256));
  const N = I.getContext("2d");
  ((N.fillStyle = "#eee4c9"),
    N.fillRect(0, 0, 512, 256),
    (N.fillStyle = "#163d43"),
    N.fillRect(0, 0, 512, 47),
    (N.fillStyle = "#fff2dc"),
    (N.font = "bold 30px sans-serif"),
    N.fillText("MIRAGE   /   RALLY", 22, 34),
    (N.fillStyle = "#20393b"),
    (N.font = "italic bold 185px sans-serif"),
    N.fillText("15", 75, 202),
    (N.fillStyle = "#bd3c20"),
    N.fillRect(0, 218, 512, 38));
  const j = new Uo(I);
  j.colorSpace = qo;
  const R = new Jt({ map: j, roughness: 0.46, side: ze }),
    V = m.build();
  for (const b of [-1, 1]) {
    const v = new kt();
    v.setAttribute(
      "position",
      new nt(
        [
          b * 0.249,
          1.374,
          -0.6,
          b * 0.252,
          1.335,
          -0.23,
          b * 0.215,
          1.011,
          -0.06,
          b * 0.249,
          1.085,
          -0.51,
        ],
        3,
      ),
    );
    const F = b > 0 ? 1 : 0;
    (v.setAttribute("uv", new nt([F, 1, 1 - F, 1, 1 - F, 0, F, 0], 2)),
      v.setIndex([0, 1, 2, 0, 2, 3]),
      v.computeVertexNormals(),
      V.add(new gt(v, R)));
  }
  const z = Zt("Steering assembly");
  for (const b of [-1, 1]) {
    const v = 0.154 * b;
    (z.rod([v, -0.87, -0.39], [v, -0.42, -0.21], 0.033, s),
      z.rod([v, -0.44, -0.218], [v, 0.055, -0.012], 0.053, n, 0.046),
      z.rod([v, -0.86, -0.39], [v, -0.63, -0.3], 0.046, t),
      z.tube(
        [
          [0, 0.09, 0],
          [b * 0.16, 0.1, 0],
          [b * 0.28, 0.19, 0.03],
          [b * 0.46, 0.2, 0.078],
        ],
        0.02,
        l,
      ),
      z.rod([b * 0.34, 0.2, 0.048], [b * 0.48, 0.2, 0.082], 0.031, i),
      z.tube(
        [
          [b * 0.25, 0.18, 0.02],
          [b * 0.32, 0.2, -0.064],
          [b * 0.48, 0.2, -0.03],
        ],
        0.018,
        s,
      ),
      z.oval([b * 0.378, 0.21, -0.054], [0.104, 0.045, 0.035], e));
  }
  (z.rod([0, -0.09, -0.085], [0, 0.09, -0.25], 0.043, l),
    z.rod([0.134, -0.76, -0.348], [0.134, -0.72, -0.267], 0.05, l),
    z.rod([-0.18, 0, -0.04], [0.18, 0, -0.04], 0.045, l),
    z.part(
      mt([
        [-0.88, -0.205, -0.18, 0.065],
        [-0.66, -0.18, -0.13, 0.125],
        [-0.37, -0.19, -0.14, 0.145],
        [-0.08, -0.26, -0.19, 0.1],
      ]),
      e,
    ),
    z.part(
      mt([
        [-0.42, 0.02, 0.26, 0.141],
        [-0.37, -0.12, 0.3, 0.176],
        [-0.18, -0.08, 0.33, 0.14],
      ]),
      t,
    ),
    z.part(
      mt([
        [-0.434, 0.042, 0.23, 0.122],
        [-0.394, 0.028, 0.246, 0.138],
      ]),
      l,
    ));
  for (const b of [-1, 1])
    z.oval([b * 0.062, 0.137, -0.435], [0.05, 0.058, 0.019], a);
  (z.part(
    mt([
      [-0.365, 0.252, 0.28, 0.167],
      [-0.28, 0.29, 0.48, 0.15],
      [-0.215, 0.46, 0.51, 0.13],
    ]),
    et("#536569", 0.25, 0.37),
  ),
    z.tube(
      [
        [0.3, 0.2, 0.04],
        [0.16, 0.27, -0.11],
        [0.12, -0.08, -0.15],
        [0.172, -0.74, -0.31],
      ],
      0.009,
      i,
    ));
  const W = z.build();
  W.position.set(0, 1.38, -0.66);
  const E = c(!0),
    G = c(!1);
  (E.position.set(0, -0.87, -0.39),
    G.position.set(0, ye, 0.95),
    W.add(E),
    V.add(W, G));
  const f = Zt("Rally rider"),
    p = et("#39575a", 0.93),
    g = et("#494239", 0.85);
  (f.oval([0, 1.37, 0.35], [0.193, 0.167, 0.202], r),
    f.oval([0, 1.62, 0.21], [0.217, 0.315, 0.147], p, -0.48),
    f.oval([0, 1.66, 0.35], [0.145, 0.209, 0.079], l, -0.48),
    f.oval([0, 1.96, 0.023], [0.163, 0.19, 0.182], t, -0.12),
    f.oval([0, 1.972, -0.085], [0.157, 0.082, 0.11], o),
    f.oval([0, 1.886, -0.094], [0.142, 0.07, 0.115], t),
    f.oval([0, 2.064, -0.11], [0.168, 0.022, 0.166], e, -0.1));
  for (const b of [-1, 1]) {
    const v = [b * 0.175, 1.78, 0.13],
      F = [b * 0.34, 1.615, -0.17],
      K = [b * 0.41, 1.58, -0.59];
    (f.rod(v, F, 0.081, p, 0.057),
      f.oval(v, [0.083, 0.089, 0.087], p),
      f.rod(F, K, 0.061, p, 0.041),
      f.oval(K, [0.053, 0.047, 0.076], i));
    const it = [b * 0.236, 1.07, -0.095],
      xt = [b * 0.25, 0.69, 0.25];
    (f.rod([b * 0.129, 1.37, 0.35], it, 0.104, r, 0.083),
      f.oval(it, [0.088, 0.089, 0.092], l),
      f.rod(it, xt, 0.077, g, 0.056),
      f.oval([b * 0.25, 0.665, 0.192], [0.073, 0.064, 0.139], g));
  }
  const k = f.build();
  V.add(k);
  const L = Zt("Side stand");
  (L.rod([0, 0, 0], [-0.256, -0.61, 0.15], 0.017, l),
    L.oval([-0.256, -0.61, 0.15], [0.044, 0.012, 0.061], l));
  const C = L.build();
  return (
    C.position.set(-0.163, 0.624, 0.2),
    V.add(C),
    { group: V, steer: W, front: E, rear: G, rider: k, stand: C }
  );
}
function Sa(t) {
  const { group: e, steer: o, front: n, rear: s, rider: l, stand: i } = za();
  (e.scale.setScalar(1.2), t.add(e));
  const d = [],
    r = () => {
      const p = new Ps({ transparent: !0, depthWrite: !1, color: "#d9bd92" });
      return (
        (p.opacityNode = D(0.5, 0.05, Ye().sub(0.5).length()).mul(Ns)),
        p
      );
    };
  for (let p = 0; p < 72; p++) {
    const g = new Os(r());
    ((g.visible = !1),
      (g.userData = { life: 0, v: new Y(), max: 1 }),
      t.add(g),
      d.push(g));
  }
  let u = 0,
    a = 0;
  const h = document.createElement("canvas");
  h.width = h.height = 128;
  {
    const p = h.getContext("2d"),
      g = p.createLinearGradient(0, 0, 128, 0);
    (g.addColorStop(0, "rgba(0,0,0,0)"),
      g.addColorStop(0.2, "rgba(0,0,0,0.55)"),
      g.addColorStop(0.8, "rgba(0,0,0,0.55)"),
      g.addColorStop(1, "rgba(0,0,0,0)"),
      (p.fillStyle = g),
      p.fillRect(0, 0, 128, 128),
      (p.strokeStyle = "rgba(0,0,0,0.9)"),
      (p.lineWidth = 9),
      (p.lineCap = "round"));
    for (let k = -32; k < 160; k += 32)
      (p.beginPath(),
        p.moveTo(13, k),
        p.lineTo(64, k + 18),
        p.lineTo(115, k),
        p.stroke());
  }
  const c = new Uo(h);
  c.anisotropy = 8;
  const m = 8192,
    x = new Zs({
      color: "#5a3c22",
      alphaMap: c,
      transparent: !0,
      opacity: 0.55,
      depthWrite: !1,
      polygonOffset: !0,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    y = new jt(
      new _s(0.4, 0.27).rotateX(-Math.PI / 2).rotateY(Math.PI / 2),
      x,
      m,
    );
  ((y.frustumCulled = !1), (y.count = 0), (y.receiveShadow = !0), t.add(y));
  let M = 0;
  const S = [null, null],
    P = new $s(),
    I = new qe(),
    N = new Y(),
    j = new Y(0, 1, 0),
    R = new Y(1, 1, 1),
    V = new Y(),
    z = new Ks();
  function W(p, g, k, L) {
    const C = S[p];
    if (C && Math.hypot(g - C.x, k - C.z) < 0.22) return;
    S[p] = { x: g, z: k };
    const b = 0.3,
      v = f(g, k);
    (N.set(
      f(g - b, k) - f(g + b, k),
      2 * b,
      f(g, k - b) - f(g, k + b),
    ).normalize(),
      I.setFromUnitVectors(j, N).multiply(
        new qe().setFromEuler(z.set(0, L, 0)),
      ),
      P.compose(V.set(g, v + 0.014, k), I, R),
      y.setMatrixAt(M, P),
      (M = (M + 1) % m),
      (y.count = Math.max(y.count, M || m)),
      (y.instanceMatrix.needsUpdate = !0));
  }
  const E = new Y(),
    G = {
      group: e,
      pos: new Ho(3, -1),
      yaw: -0.4,
      speed: 0,
      steer: 0,
      y: 0,
      pitch: 0,
      roll: 0,
      spin: 0,
      rider: l,
    };
  G.setMounted = (p) => {
    ((l.visible = p), (i.rotation.x = p ? -1.2 : 0));
  };
  const f = (p, g) => ot(p, g);
  return (
    (G.update = function (p, g, k) {
      const L = g.boost ? 34 : 17,
        C = g.throttle * L;
      ((this.speed +=
        (C - this.speed) *
        (1 -
          Math.exp(-p * (g.throttle === 0 ? 0.9 : C > this.speed ? 1.6 : 4)))),
        (this.steer += (g.steer - this.steer) * (1 - Math.exp(-p * 7))));
      const b = 1 / (1 + Math.abs(this.speed) * 0.045);
      this.yaw +=
        -this.steer *
        b *
        1.45 *
        p *
        Math.sign(this.speed || 1) *
        Math.min(1, Math.abs(this.speed) / 2.5);
      const v = -Math.sin(this.yaw),
        F = -Math.cos(this.yaw),
        K = 2;
      for (let O = 0; O < K; O++) {
        ((this.pos.x += (v * this.speed * p) / K),
          (this.pos.y += (F * this.speed * p) / K));
        for (const [dt, Lt, Ss] of k) {
          const go = this.pos.x - dt,
            bo = this.pos.y - Lt,
            de = Math.hypot(go, bo),
            Re = Ss + 0.8;
          de < Re &&
            de > 1e-4 &&
            ((this.pos.x = dt + (go / de) * Re),
            (this.pos.y = Lt + (bo / de) * Re),
            Math.abs(this.speed) > 6 && (this.speed *= 0.35));
        }
      }
      const it = Math.cos(this.yaw),
        xt = -Math.sin(this.yaw),
        rt = f(this.pos.x + v * 1.05, this.pos.y + F * 1.05),
        ut = f(this.pos.x - v * 0.95, this.pos.y - F * 0.95),
        Rt = f(this.pos.x - it * 0.5, this.pos.y - xt * 0.5),
        ue = f(this.pos.x + it * 0.5, this.pos.y + xt * 0.5),
        Nt = Math.atan2(rt - ut, 2),
        qt =
          -Math.atan2(Rt - ue, 1) * 0.8 -
          this.steer * Math.min(1, this.speed / 14) * 0.38,
        Xt = 1 - Math.exp(-p * 14);
      ((this.pitch += (Nt - this.pitch) * Xt),
        (this.roll += (qt - this.roll) * Xt));
      const Ht = (rt + ut) / 2;
      if (
        (p === 0 && (this.y = Ht),
        (this.y += (Ht - this.y) * (1 - Math.exp(-p * 18))),
        e.position.set(this.pos.x, this.y, this.pos.y),
        e.rotation.set(this.pitch, this.yaw, this.roll, "YXZ"),
        (this.spin += (this.speed * p) / (ye * e.scale.x)),
        (n.rotation.x = -this.spin),
        (s.rotation.x = -this.spin),
        (o.rotation.y = -this.steer * 0.42),
        (l.rotation.z = -this.steer * 0.1),
        Math.abs(this.speed) > 0.3)
      ) {
        const O = e.scale.x;
        (W(
          0,
          this.pos.x + v * 1.05 * O,
          this.pos.y + F * 1.05 * O,
          this.yaw + o.rotation.y,
        ),
          W(1, this.pos.x - v * 0.95 * O, this.pos.y - F * 0.95 * O, this.yaw));
      }
      if (Math.abs(this.speed) > 2.5)
        for (u += p * (6 + Math.abs(this.speed) * 1.5); u > 1; ) {
          u--;
          const O = d[a++ % d.length];
          (E.set((Math.random() - 0.5) * 0.5, 0.15, 1)
            .applyEuler(e.rotation)
            .add(e.position),
            O.position.copy(E),
            (O.position.y = Math.max(O.position.y, f(E.x, E.z) + 0.12)),
            O.userData.v.set(
              (Math.random() - 0.5) * 1.2 - v * this.speed * 0.2,
              0.7 + Math.random() * 1.4,
              (Math.random() - 0.5) * 1.2 - F * this.speed * 0.2,
            ),
            (O.userData.life = O.userData.max = 0.9 + Math.random() * 0.8),
            (O.visible = !0));
        }
      for (const O of d) {
        if (!O.visible) continue;
        const dt = O.userData;
        if (((dt.life -= p), dt.life <= 0)) {
          O.visible = !1;
          continue;
        }
        const Lt = 1 - dt.life / dt.max;
        (O.position.addScaledVector(dt.v, p),
          dt.v.multiplyScalar(Math.exp(-p * 1.4)),
          (dt.v.y -= p * 0.8),
          O.scale.setScalar(0.35 + Lt * 1.6),
          (O.material.opacity = (1 - Lt) * 0.5 * Math.min(1, Lt * 8)));
      }
    }),
    G.update(0, { throttle: 0, steer: 0 }, []),
    G.setMounted(!1),
    G
  );
}
const _t = [
    [0, 2.7, 0.05, 3, 35, 0.6, 0],
    [2.6, 2.1, 0.09, 3.3, 37, 0.7, 0],
    [4.4, 1.25, 0.1, 4.3, 47, 1, 1.5],
    [7, 0.55, 0.14, 5.2, 55, 1.1, 3],
    [9.6, 1.62, 0.05, 5, 44, 0.8, 1],
    [12, 3.05, 0.08, 6.4, 41, 0.9, 0],
    [14.6, 4.7, 0.1, 7.6, 46, 1, 1],
    [16.8, 6.2, 0.03, 9.5, 36, 1, 3],
    [20, 6.3, 0, 13, 20, 1, 5],
  ],
  we = [15.4, 19.2],
  Ca = (t) => ((t = at.clamp(t, 0, 1)), t * t * t * (t * (t * 6 - 15) + 10));
function Dt(t, e) {
  let o = 0;
  for (; o < _t.length - 2 && t > _t[o + 1][0]; ) o++;
  const n = (y) => _t[at.clamp(y, 0, _t.length - 1)],
    s = n(o),
    l = n(o + 1),
    i = l[0] - s[0],
    d = at.clamp((t - s[0]) / i, 0, 1),
    r = (y, M, S, P) => (P - M) / (S - y),
    u = n(o - 1),
    a = n(o + 2),
    h = (o === 0 ? (l[e] - s[e]) / i : r(u[0], u[e], l[0], l[e])) * i,
    c =
      (o === _t.length - 2 ? (l[e] - s[e]) / i : r(s[0], s[e], a[0], a[e])) * i,
    m = d * d,
    x = m * d;
  return (
    (2 * x - 3 * m + 1) * s[e] +
    (x - 2 * m + d) * h +
    (-2 * x + 3 * m) * l[e] +
    (x - m) * c
  );
}
function Aa() {
  const t = new Y(),
    e = new Y();
  let o = null;
  return {
    drive(n, s) {
      const l =
        n < 3
          ? -0.4
          : 0.02 + 0.3 * Math.sin((n - 3) * 0.5) * Math.min(1, (n - 3) / 3);
      return {
        throttle: n < 3 ? 0 : 1,
        boost: n > 6.4,
        steer: at.clamp((s - l) * 2.4, -1, 1),
      };
    },
    camera(n, s) {
      const l = Dt(n, 1),
        i = Dt(n, 2),
        d = Dt(n, 3),
        r = Dt(n, 4),
        u = Dt(n, 5),
        a = Dt(n, 6),
        h = s.yaw + l;
      return (
        t.set(
          s.x + Math.sin(h) * Math.cos(i) * d,
          s.y + 0.9 + Math.sin(i) * d,
          s.z + Math.cos(h) * Math.cos(i) * d,
        ),
        n >= we[0] && !o && (o = t.clone()),
        o && t.lerp(o, Ca((n - we[0]) / (we[1] - we[0]))),
        (t.y = Math.max(t.y, ot(t.x, t.z) + 0.5)),
        e.set(s.x - Math.sin(s.yaw) * a, s.y + u, s.z - Math.cos(s.yaw) * a),
        { position: t, target: e, fov: r }
      );
    },
  };
}
const tt = new URLSearchParams(location.search),
  no = tt.has("thumb"),
  ro = tt.has("capture"),
  Yt = no || ro;
Yt && document.body.classList.add("capture");
const U = await Vs({ shadows: !0 });
U.toneMapping = Qs;
const pt = U.domElement;
pt.id = "view";
pt.setAttribute("tabindex", "0");
const J = new Js(),
  T = new ta(55, innerWidth / innerHeight, 0.1, 3e4),
  Be = at.degToRad(44),
  Po = at.degToRad(35),
  co = new Y(
    -Math.sin(Po) * Math.cos(Be),
    Math.sin(Be),
    -Math.cos(Po) * Math.cos(Be),
  ),
  No = H(co),
  ka = H(new Ve("#306ea0")),
  ge = H(new Ve("#e4d4b9")),
  Pa = H(new Ve("#fff4e3")),
  lt = new ea("#fff0d9", 3.65),
  ss = new oa("#c1d9e9", "#ce9565", 1.05);
lt.castShadow = !0;
lt.shadow.mapSize.set(4096, 4096);
Object.assign(lt.shadow.camera, {
  left: -45,
  right: 45,
  top: 45,
  bottom: -45,
  near: 1,
  far: 260,
});
lt.shadow.bias = -4e-4;
lt.shadow.normalBias = 0.04;
lt.layers.enable(1);
ss.layers.enable(1);
J.add(lt, lt.target, ss);
U.shadowMap.type = sa;
lt.shadow.radius = 2.5;
{
  const t = new ve({ side: aa, depthWrite: !1, fog: !1 });
  t.colorNode = zt(() => {
    const o = be(yt),
      n = o.y,
      s = Is(n, 0, 1);
    let l = q(A(0.32, 0.57, 0.75), ka, D(0.02, 0.55, s));
    l = q(ge, l, D(0, 0.095, s).mul(0.85).add(0.15));
    const i = $t(ee(o, No), 0);
    l = l.add(
      Pa.mul(
        te(i, 6)
          .mul(0.12)
          .add(te(i, 64).mul(0.5))
          .add(D(0.99965, 0.9999, i).mul(60)),
      ),
    );
    const d = _(1).div($t(n.add(0.05), 0.04)),
      r = ft(o.x.mul(d).mul(0.35), o.z.mul(d).mul(1.4)),
      u = X(A(r.mul(1.3), 0.6))
        .mul(0.6)
        .add(X(A(r.mul(4.1), 2.3)).mul(0.3)),
      a = D(0.35, 0.85, u)
        .mul(D(0.08, 0.35, s))
        .mul(D(0.9, 0.5, s))
        .mul(0.16);
    l = q(l, A(0.97, 0.98, 1).mul(1.1), a);
    const h = _(1).div($t(n, 0.012)),
      c = ft(o.x.mul(h), o.z.mul(h)).mul(0.32),
      m = X(A(c.mul(0.55), 1.3))
        .mul(0.55)
        .add(X(A(c.mul(1.6), 4.2)).mul(0.3))
        .add(X(A(c.mul(4.8), 7.7)).mul(0.15)),
      x = X(A(c.mul(0.12), 9.4))
        .mul(0.5)
        .add(0.5),
      y = D(0.08, 0.32, m.add(x.mul(0.4)).sub(0.22))
        .mul(D(0.012, 0.04, s))
        .mul(D(0.5, 0.18, s)),
      M = D(-0.2, 0.6, m.sub(X(A(c.mul(1.6).add(ft(0, 0.4)), 4.2)).mul(0.3))),
      S = $t(ee(o, No), 0).mul(0.25).add(0.75),
      P = q(A(0.62, 0.66, 0.74), A(1, 0.99, 0.96).mul(1.15), M.mul(S));
    return (
      (l = q(l, q(P, ge, D(0.06, 0, s).mul(0.6)), y.mul(0.34))),
      q(l, ge.mul(A(1, 0.97, 0.92)), D(0, -0.03, n))
    );
  })();
  const e = new gt(new so(2e4, 64, 32), t);
  ((e.frustumCulled = !1),
    (e.renderOrder = -10),
    e.layers.enable(1),
    J.add(e),
    (J.userData.sky = e));
}
function Na() {
  const o = new Float32Array(694083),
    n = new Float32Array(o.length),
    s = new Uint32Array(480 * 480 * 6),
    l = (r) => {
      const u = (r / 480) * 2 - 1;
      return 1300 * (0.35 * u + 0.65 * u * u * u);
    };
  for (let r = 0; r <= 480; r++)
    for (let u = 0; u <= 480; u++) {
      const a = (r * 481 + u) * 3;
      ((o[a] = l(u)), (o[a + 2] = l(r)), (n[a + 1] = 1));
    }
  let i = 0;
  for (let r = 0; r < 480; r++)
    for (let u = 0; u < 480; u++) {
      const a = r * 481 + u,
        h = a + 1,
        c = a + 480 + 1,
        m = c + 1;
      ((s[i++] = a),
        (s[i++] = c),
        (s[i++] = h),
        (s[i++] = h),
        (s[i++] = c),
        (s[i++] = m));
    }
  const d = new kt();
  return (
    d.setAttribute("position", new Me(o, 3)),
    d.setAttribute("normal", new Me(n, 3)),
    d.setIndex(new Me(s, 1)),
    d
  );
}
const It = new Ft({ roughness: 1, metalness: 0 });
{
  It.positionNode = zt(() => {
    const R = yt;
    return A(R.x, Ot(R.xz), R.z);
  })();
  const t = ht,
    e = X(A(t.xz.mul(0.009), 1.7))
      .mul(0.5)
      .add(0.5),
    o = X(A(t.xz.mul(0.045), 9.1)),
    n = t.z
      .mul(9.5)
      .add(t.x.mul(2.3))
      .add(e.mul(14))
      .add(Z(t.x.mul(0.13)).mul(2))
      .add(o.mul(9)),
    s = D(-0.35, 0.45, X(A(t.xz.mul(0.03), 5.3))),
    l = _(1).sub(D(0.75, 2, n.dFdx().abs().add(n.dFdy().abs()))),
    i = te(Z(n).mul(0.5).add(0.5), 2).mul(l).mul(s),
    d = t.z.mul(1.45).add(t.x.mul(0.29)).add(e.mul(6)),
    r = _(1).sub(D(0.8, 2.5, d.dFdx().abs().add(d.dFdy().abs()))),
    u = Z(d).mul(r),
    a = t.z.mul(0.24).add(t.x.mul(0.055)).add(e.mul(4)),
    h = _(1).sub(D(0.8, 2.5, a.dFdx().abs().add(a.dFdy().abs()))),
    c = Z(a).mul(h),
    m = X(A(t.x.mul(0.002), t.z.mul(0.025), 4.1))
      .mul(0.5)
      .add(0.5),
    x = X(A(t.xz.mul(3.1), 2.2))
      .mul(0.5)
      .add(0.5),
    y = D(75, 185, t.z.negate()).toVar(),
    M = e.mul(0.66).add(m.mul(0.34)),
    S = q(A(0.45, 0.216, 0.094), A(0.78, 0.504, 0.247), M),
    P = q(S, A(0.68, 0.523, 0.345), y.mul(0.82)),
    I = i.mul(0.09).add(u.mul(0.035)).add(c.mul(0.035)),
    N = t.xz.dFdx().length().max(t.xz.dFdy().length()),
    j = X(A(t.xz.mul(65), 3.7)).mul(D(0.003, 0.022, N).oneMinus());
  ((It.colorNode = P.mul(
    I.mul(y.mul(-0.78).add(1))
      .add(x.sub(0.5).mul(0.08))
      .add(j.mul(0.12))
      .add(0.98),
  )),
    (It.normalNode = zt(() => {
      const R = ht.xz,
        V = 0.4,
        z = Ot(R.add(ft(V, 0)))
          .sub(Ot(R.sub(ft(V, 0))))
          .div(2 * V),
        W = Ot(R.add(ft(0, V)))
          .sub(Ot(R.sub(ft(0, V))))
          .div(2 * V),
        E = be(A(z.negate(), 1, W.negate())),
        G = A(0.055, 0, 0.24).mul(me(a)).mul(h),
        f = A(0.29, 0, 1.45).mul(me(d)).mul(r),
        g = A(me(t.x.mul(0.13)).mul(0.26).add(2.3), 0, 9.5)
          .mul(Z(n).mul(0.5).add(0.5))
          .mul(me(n))
          .mul(l)
          .mul(s)
          .mul(0.021)
          .add(f.mul(0.031))
          .add(G.mul(0.08))
          .mul(y.mul(-0.8).add(1)),
        k = g.sub(E.mul(ee(g, E)));
      return Es.mul(Mt(be(E.sub(k)), 0)).xyz;
    })()));
}
It.mrtNode = Bo({ ground: _(1) });
const lo = new gt(Na(), It);
lo.frustumCulled = !1;
lo.receiveShadow = !0;
J.add(lo);
const ae = new gt(new Xo(1250, 4e4, 128, 2).rotateX(-Math.PI / 2), It.clone());
ae.material.positionNode = null;
ae.material.mrtNode = It.mrtNode;
ae.position.y = -0.15;
ae.receiveShadow = !0;
J.add(ae);
const ke = { x: 0, z: 6 },
  Kt = ba(J, {
    sandColor: [0.625, 0.371, 0.176],
    avoid: (t, e, o) => Math.hypot(t - ke.x, e - ke.z) < o,
    sunDir: co,
  });
{
  const o = [],
    n = [],
    s = (r) => {
      let u = 0;
      for (const [h, c, m] of [
        [3, 60, 0.3],
        [7, 35, 1.1],
        [17, 18, 2.2],
        [41, 8, 0.7],
        [97, 3, 1.9],
      ])
        u += c * (0.5 + 0.5 * Math.sin(r * h + m));
      const a = Math.max(0, Math.sin(r * 5 + 0.8)) ** 6 * 120;
      return (Math.max(0, u - 40) * 1.6 + Math.min(a, 85)) * 1.5;
    };
  for (let r = 0; r <= 720; r++) {
    const u = (r / 720) * Math.PI * 2,
      a = 4200 + 900 * Math.sin(u * 2.3 + 0.4),
      h = Math.sin(u) * a,
      c = -Math.cos(u) * a;
    if ((o.push(h, -2, c, h, s(u), c), r < 720)) {
      const m = r * 2;
      n.push(m, m + 2, m + 1, m + 1, m + 2, m + 3);
    }
  }
  const l = new kt();
  (l.setAttribute("position", new nt(o, 3)), l.setIndex(n));
  const i = new ve({ side: ze, fog: !1 });
  i.colorNode = q(A(0.4, 0.35, 0.31), A(0.58, 0.6, 0.64), D(-2, 200, yt.y));
  const d = new gt(l, i);
  ((d.frustumCulled = !1), d.layers.enable(1));
  {
    let r = 0,
      u = 1e9;
    for (let M = -0.7; M <= 0.7; M += 0.01) {
      const S = s(M);
      S < u && ((u = S), (r = M));
    }
    const a = Ut(1517),
      h = [],
      c = (M, S, P, I, N) => {
        const j = new Ue(P, N + 2, I);
        (j.translate(M, N / 2 - 1, S), h.push(j));
      },
      m = (M, S) => {
        const P = r + M;
        return [Math.sin(P) * S, -Math.cos(P) * S];
      };
    for (let M = 0; M < 150; M++) {
      const S = (a() - 0.5) * 0.15,
        [P, I] = m(S, 3150 + a() * 110),
        N = 1 - Math.abs(S) / 0.075;
      c(
        P,
        I,
        26 + a() * 46,
        26 + a() * 46,
        18 + Math.pow(a(), 1.8) * 120 * (0.3 + N),
      );
    }
    for (let M = 0; M < 9; M++) {
      const [S, P] = m((a() - 0.5) * 0.12, 3140 + a() * 80);
      c(S, P, 12, 12, 100 + a() * 90);
    }
    for (let M = 0; M < 3; M++) {
      const [S, P] = m((a() - 0.5) * 0.05, 3120),
        I = new so(26 + a() * 12, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      (I.translate(S, 80, P), h.push(I));
    }
    const x = new ve({ fog: !1 });
    x.colorNode = q(A(0.42, 0.37, 0.33), A(0.72, 0.7, 0.68), D(0, 200, yt.y));
    const y = new gt(Ne(h), x);
    ((y.frustumCulled = !1), y.layers.enable(1), d.add(y));
  }
  (J.add(d), (J.userData.range = d));
}
const io = tt.has("lite"),
  vt = Ts({
    resolutionScale: 0.5,
    depth: !0,
    bounces: !1,
    samples: io ? 0 : 4,
  });
vt.target.rotation.x = -Math.PI / 2;
J.add(vt.target);
const ct = T.clone(),
  Et = vt.reflector.getVirtualCamera(ct);
Et.layers.set(1);
const Va = new ve(),
  Ia = H(Et.projectionMatrix),
  Ea = H(Et.matrixWorldInverse),
  Ta = H(Et.projectionMatrixInverse),
  Ra = H(Et.matrixWorld),
  as = H(1);
function La() {
  const t = T.position.y;
  ((as.value = at.smoothstep(t, 0.15, 0.8) * (1 - at.smoothstep(t, 22, 60))),
    vt.target.position.set(T.position.x, 0, T.position.z),
    vt.target.updateMatrixWorld(),
    ct.copy(T, !1),
    (ct.position.y = Math.max(0.2, T.position.y)),
    (ct.coordinateSystem = U.coordinateSystem),
    ct.projectionMatrix.copy(T.projectionMatrix),
    (ct.projectionMatrix.elements[0] /= 1.08),
    (ct.projectionMatrix.elements[5] /= 1.08),
    ct.projectionMatrixInverse.copy(ct.projectionMatrix).invert(),
    ct.updateMatrixWorld());
  const e = U.toneMapping,
    o = U.outputColorSpace,
    n = U.shadowMap.autoUpdate;
  ((U.toneMapping = ua),
    (U.outputColorSpace = da),
    (U.shadowMap.autoUpdate = !1));
  try {
    (vt.reflector.updateBefore({
      renderer: U,
      scene: J,
      camera: ct,
      material: Va,
    }),
      Et.projectionMatrixInverse.copy(Et.projectionMatrix).invert());
  } finally {
    ((U.toneMapping = e),
      (U.outputColorSpace = o),
      (U.shadowMap.autoUpdate = n));
  }
}
const st = {
    heat: 1.6,
    mirage: 1,
    mirageScale: 9,
    mirageNear: 40,
    pace: 1,
    ao: 0.55,
  },
  ns = H(0),
  ne = H(st.heat),
  uo = H(st.mirage),
  mo = H(st.mirageScale),
  Pe = H(st.mirageNear),
  ho = H(0.82),
  He = H(1.05),
  Oe = H(1.04),
  Ze = H(0.4),
  rs = H(st.ao),
  Ie = Rs(J, T, { samples: io ? 0 : 4 });
Ie.setMRT(Bo({ output: Ls, ground: _(0) }));
const Da = Ie.getTextureNode("output"),
  Pt = Ie.getTextureNode("depth"),
  Fa = Ie.getTextureNode("ground").r,
  re = H(T.projectionMatrixInverse),
  Ee = H(T.matrixWorld),
  cs = H(new Ho(1, 1));
let ls = _(1);
if (!io) {
  const t = Ds(Pt, null, T);
  ((t.resolutionScale = 0.5),
    (t.radius.value = 3),
    (t.thickness.value = 2),
    (t.samples.value = 12),
    (ls = t.getTextureNode().r));
}
const ja = ge.mul(A(1, 0.97, 0.92)),
  is = (t, e, o, n) => {
    const s = e.mul(oe(o.max(0).div(-140)).mul(11e-5).add(4e-5)),
      l = oe(s.negate().mul(n)).mul(D(8e3, 24e3, e).mul(n).oneMinus());
    return t.mul(l).add(ja.mul(l.oneMinus()));
  },
  po = (t) => t.lessThan(0.99999).select(_(1), _(0)),
  Te = Gt(wt, Pt, re).toVar(),
  Wa = Ee.mul(Mt(Te, 1)).xyz.toVar(),
  _e = Te.length().toVar(),
  ce = Ee.element(3).xyz.toVar(),
  St = Ee.mul(Mt(Gt(wt, _(0.5), re).normalize(), 0))
    .xyz.normalize()
    .toVar(),
  le = ce.y.max(0.05).toVar();
let Tt = Pt.r;
for (const [t, e] of [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
])
  Tt = Tt.min(Pt.sample(wt.add(ft(t, e).div(cs)).clamp(0, 1)).r);
Tt = Tt.toVar();
const Ba = Gt(wt, Tt, re),
  Ya = Pt.r
    .greaterThan(0.99999)
    .and(Tt.lessThan(0.99999))
    .and(Ba.z.negate().greaterThan(2500)),
  us = Ya.select(Tt, Pt.r),
  ds = Gt(wt, us, re).toVar(),
  Ga = Ee.mul(Mt(ds, 1)).xyz.toVar(),
  fo = _(1600),
  wo = le.add(St.y.mul(fo)).max(0).toVar(),
  $e = wo.sub(le).toVar(),
  Ua = oe(le.div(-18))
    .sub(oe(wo.div(-18)))
    .mul(18)
    .div($e.abs().max(0.001))
    .mul($e.sign()),
  qa = q(oe(le.add(wo).div(-36)), Ua, $e.abs().smoothstep(0.01, 0.1)),
  Xa = qa.mul(fo).div(650).clamp(0, 1).sqrt(),
  Ct = ns.mul(1.4).toVar(),
  At = ce.add(St.mul(fo)).xz.mul(0.02).toVar(),
  Ha = Z(At.x.add(Ct.mul(0.6)).add(Z(At.y.mul(1.31).sub(Ct.mul(0.4))))),
  Oa = Z(
    At.y
      .mul(1.73)
      .sub(Ct.mul(0.75))
      .add(Z(At.x.mul(0.73).add(Ct))),
  ),
  Za = Z(At.x.mul(2.1).add(At.y.mul(2.43)).sub(Ct.mul(2.2))),
  Vo = wt.min(wt.oneMinus()),
  _a = Vo.x.min(Vo.y).smoothstep(0, 0.012),
  ms = X(A(At.x.mul(1.8), St.y.mul(180).sub(Ct), At.y.mul(1.8))).toVar(),
  $a = ft(Ha.mul(85e-5), Oa.mul(0.0013).add(Za.mul(45e-5)).add(ms.mul(0.0021)))
    .mul(Xa)
    .mul(ne)
    .mul(_a)
    .toVar(),
  Ke = wt.add($a).clamp(0, 1),
  hs = Gt(Ke, Pt.sample(Ke).r, re),
  Io = Te.z.negate().min(hs.z.negate()).smoothstep(40, 100),
  Ka = q(hs.z.sub(Te.z).abs().smoothstep(1, 5).oneMinus(), 1, Io).mul(Io),
  Qa = q(wt, Ke, Ka),
  Eo = St.y.negate().div(St.xz.length().max(1e-4)),
  ps = ce.y.div(St.y.negate().max(1e-4)).clamp(0, 2e5),
  se = ce.add(St.mul(ps)).toVar(),
  Ja = Z(
    se.x
      .mul(0.009)
      .add(Z(se.z.mul(0.013)))
      .add(Ct.mul(0.07)),
  ),
  fs = _(303.15)
    .add(_(50).add(Ja.mul(8).mul(ne)))
    .toVar(),
  t0 = _(303.15).add(fs.sub(303.15).mul(le.div(-0.8).exp())),
  e0 = _(0.0786252).div(fs).add(1),
  o0 = _(0.0786252).div(t0).add(1),
  s0 = o0.div(e0).pow2().sub(1).max(0).sqrt(),
  To = s0.mul(mo).max(1e-5),
  ws = Eo.smoothstep(To.mul(0.82), To.mul(1.05))
    .oneMinus()
    .mul(Eo.smoothstep(35e-5, 0.0012)),
  a0 = D(Pe, Pe.mul(2.6), _e).mul(D(1e4, 24e3, _e).oneMinus()),
  n0 = Wa.y.abs().smoothstep(0.6, 3).oneMinus(),
  Qe = Ia.mul(Ea.mul(Mt(se, 1))).toVar(),
  Je = Qe.xy.div(Qe.w.max(1e-4)).mul(0.5).add(0.5).flipY(),
  to = ce.xz.add(St.xz.mul(ps.min(3200))),
  Ms = X(A(to.x.mul(0.012), to.y.mul(0.035), 2.6)),
  r0 = Z(to.y.mul(0.13).add(Ms.mul(5)).sub(Ct.mul(0.26))),
  c0 = D(0.12, 0.85, ws.add(Ms.mul(0.48)).add(r0.mul(0.095))),
  Mo = Je.add(ft(0, ms.mul(ne).mul(0.0014))).clamp(0.001, 0.999),
  Ro = Je.min(Je.oneMinus()),
  l0 = Ro.x.min(Ro.y).smoothstep(0.003, 0.025).mul(Qe.w.smoothstep(0.01, 0.06)),
  i0 = D(95, 185, se.z.negate()).max(D(1300, 2200, se.xz.length())),
  u0 = po(Pt.r).mul(D(2500, 1800, _e)),
  d0 = Fa.max(u0)
    .mul(i0)
    .mul(n0)
    .mul(a0)
    .mul(ws)
    .mul(c0)
    .mul(l0)
    .mul(uo)
    .mul(as),
  xs = vt.getDepthNode().sample(Mo).r,
  ys = Gt(Mo, xs, Ta),
  m0 = Ra.mul(Mt(ys, 1)).xyz,
  Lo = po(xs),
  h0 = is(vt.sample(Mo).rgb, ys.length(), m0.y, Lo).mul(
    q(A(0.84, 0.97, 1.08), A(1), Lo),
  ),
  p0 = Da.rgb.mul(q(1, ls, rs)),
  f0 = is(p0, ds.length(), Ga.y, po(us)),
  w0 = Yo(Mt(q(f0, h0, d0), 1), null, null, { depthBuffer: !1 }),
  gs = Yo(Mt(w0.sample(Qa).rgb, 1), null, null, { depthBuffer: !1 }),
  M0 = Fs(gs, 0.12, 0.55, 1.2),
  x0 = _(1).sub(te(wt.sub(0.5).length(), 2).mul(Ze)),
  bs = js(Mt(gs.rgb.add(M0.rgb).mul(x0).mul(ho), 1), na, qo),
  y0 = ee(bs.rgb, A(0.2126, 0.7152, 0.0722)),
  g0 = q(A(y0), bs.rgb, He).sub(0.5).mul(Oe).add(0.5),
  vs = new Ws(U, Mt(g0.clamp(0, 1), 1));
vs.outputColorTransform = !1;
let bt = 55;
function ie() {
  const t = Yt ? +tt.get("w") || 1e3 : innerWidth,
    e = Yt ? +tt.get("h") || 1e3 : innerHeight;
  (U.setSize(t, e, !Yt),
    (T.aspect = t / e),
    (bt = T.fov = t / e < 1 ? 55 / Math.max(t / e, 0.6) : 55),
    T.updateProjectionMatrix());
}
addEventListener("resize", ie);
ie();
const w = {
    vx: 0,
    vz: 0,
    x: ke.x,
    z: ke.z,
    yaw: 0,
    pitch: at.degToRad(-2),
    yawT: 0,
    pitchT: at.degToRad(-2),
    clock: 0,
    stride: 0,
    eye: 0,
    mode: "walk",
    look: 0,
    lookP: 0,
    dragging: !1,
  },
  Q = {},
  Do = 1.68,
  B = Sa(J),
  eo = Aa(),
  zs = document.querySelector("#ride"),
  Fo = document.querySelector("#hint");
function xo() {
  if (w.mode === "walk") {
    if (Math.hypot(w.x - B.pos.x, w.z - B.pos.y) > 9) {
      Fo.textContent =
        "The bike is parked a little way off: walk to it, then press E.";
      return;
    }
    ((w.mode = "ride"), (B.speed = 0), (w.look = w.lookP = 0));
  } else
    ((w.mode = "walk"),
      (B.speed = 0),
      (w.x = B.pos.x + Math.cos(B.yaw) * 1.3),
      (w.z = B.pos.y - Math.sin(B.yaw) * 1.3),
      (w.yaw = w.yawT = B.yaw),
      (w.eye = 0));
  (B.setMounted(w.mode === "ride"),
    (zs.textContent =
      w.mode === "ride" ? "Hop off (E)" : "Ride the rally bike (E)"),
    (Fo.textContent =
      w.mode === "ride"
        ? "W to ride, A / D to steer, S to brake, shift to boost. Drag to look around. E to hop off."
        : "WASD to walk, shift to hurry, drag to look. E to ride the rally bike. The water out there is the sky."));
}
zs.addEventListener("click", () => {
  (xo(), pt.focus());
});
const jo = () =>
  innerWidth / innerHeight < 1
    ? 55 / Math.max(innerWidth / innerHeight, 0.6)
    : 55;
function Vt(t) {
  w.clock += t;
  const e = w.clock,
    o = Q.w || Q.arrowup ? 1 : 0,
    n = Q.s || Q.arrowdown ? 1 : 0,
    s = (Q.d || Q.arrowright ? 1 : 0) - (Q.a || Q.arrowleft ? 1 : 0);
  let l;
  if (ro) {
    B.update(t, eo.drive(e, B.yaw), Kt.colliders);
    const u = eo.camera(e, { x: B.pos.x, z: B.pos.y, y: B.y, yaw: B.yaw });
    (T.position.copy(u.position),
      T.lookAt(u.target),
      (bt = u.fov * (T.aspect < 1 ? 1.65 : 1)),
      (l = B.y),
      (w.x = B.pos.x),
      (w.z = B.pos.y));
  } else if (w.mode === "ride") {
    B.update(
      t,
      { throttle: o - n * 0.4, steer: s, boost: Q.shift },
      Kt.colliders,
    );
    const u = 1 - Math.exp(-t * 5);
    w.dragging ||
      ((w.look *= Math.exp(-t * 2.5)), (w.lookP *= Math.exp(-t * 2.5)));
    const a = B.yaw + w.look,
      h = 4.3 + Math.min(1, Math.abs(B.speed) / 34) * 1.4,
      c = B.pos.x,
      m = B.pos.y,
      x = B.y,
      y = c + Math.sin(a) * h,
      M = m + Math.cos(a) * h,
      S = Math.max(x + 1.55 + w.lookP * 3, ot(y, M) + 1);
    (w.eye ? T.position.lerp(b0.set(y, S, M), u) : T.position.set(y, S, M),
      (w.eye = T.position.y),
      (T.position.y = Math.max(
        T.position.y,
        ot(T.position.x, T.position.z) + 0.8,
      )),
      T.lookAt(c - Math.sin(a) * 4.5, x + 1.25, m - Math.cos(a) * 4.5),
      (bt +=
        (jo() + Math.min(1, Math.abs(B.speed) / 34) * 13 - bt) *
        (1 - Math.exp(-t * 3))),
      (l = x),
      (w.x = c),
      (w.z = m));
  } else {
    const u = 1 - Math.exp(-t * 16);
    ((w.yaw += (w.yawT - w.yaw) * u), (w.pitch += (w.pitchT - w.pitch) * u));
    const a = o - n,
      h = s,
      c = (Q.shift ? 6.5 : 2.4) * st.pace,
      m = Math.hypot(a, h) || 1,
      x = -Math.sin(w.yaw),
      y = -Math.cos(w.yaw),
      M = Math.cos(w.yaw),
      S = -Math.sin(w.yaw),
      P = ot(w.x + 0.5, w.z) - ot(w.x - 0.5, w.z),
      I = ot(w.x, w.z + 0.5) - ot(w.x, w.z - 0.5),
      N = (x * a + M * h) / m,
      j = (y * a + S * h) / m,
      R = P * N + I * j,
      V = c * Math.max(0.35, 1 - R * 0.9) * (a || h ? 1 : 0),
      z = 1 - Math.exp(-t * 6);
    ((w.vx += (N * V - w.vx) * z), (w.vz += (j * V - w.vz) * z));
    const W = Math.hypot(w.vx, w.vz);
    ((w.x += w.vx * t), (w.z += w.vz * t));
    for (const [p, g, k] of Kt.colliders) {
      const L = w.x - p,
        C = w.z - g,
        b = Math.hypot(L, C),
        v = k + 0.35;
      b < v && b > 1e-4 && ((w.x = p + (L / b) * v), (w.z = g + (C / b) * v));
    }
    w.stride += W * t * 1;
    const E = Math.min(1, W / 2.4),
      G =
        Math.cos(w.stride * Math.PI * 2) * 0.02 * E + Math.sin(e * 0.9) * 0.005,
      f = Math.sin(w.stride * Math.PI) * 0.005 * E;
    ((l = ot(w.x, w.z)),
      (w.eye = w.eye
        ? w.eye + (l + Do - w.eye) * (1 - Math.exp(-t * 7))
        : l + Do),
      T.position.set(w.x, w.eye + G, w.z),
      T.rotation.set(w.pitch, w.yaw, f, "YXZ"),
      (bt += (jo() - bt) * (1 - Math.exp(-t * 4))));
  }
  (Math.abs(T.fov - bt) > 0.01 && ((T.fov = bt), T.updateProjectionMatrix()),
    T.updateMatrixWorld(),
    J.userData.sky.position.copy(T.position),
    J.userData.range.position.set(T.position.x, 0, T.position.z),
    Kt.update(T.position));
  const i = 90 / 4096,
    d = Math.round(T.position.x / i) * i,
    r = Math.round(T.position.z / i) * i;
  (lt.target.position.set(d, l, r),
    lt.position.set(d, l, r).addScaledVector(co, 120),
    (ns.value = e),
    U.getDrawingBufferSize(cs.value));
}
const b0 = new Y();
addEventListener("keydown", (t) => {
  if (t.target.closest?.("#controls")) return;
  const e = t.key.toLowerCase();
  (e === "e" && !t.repeat && xo(), (Q[e] = !0));
});
addEventListener("keyup", (t) => {
  Q[t.key.toLowerCase()] = !1;
});
addEventListener("blur", () => {
  for (const t in Q) Q[t] = !1;
});
{
  let t = null;
  (pt.addEventListener("pointerdown", (o) => {
    ((t = { x: o.clientX, y: o.clientY }),
      (w.dragging = !0),
      pt.setPointerCapture(o.pointerId));
  }),
    pt.addEventListener("pointermove", (o) => {
      if (!t) return;
      const n = o.clientX - t.x,
        s = o.clientY - t.y;
      (w.mode === "ride"
        ? ((w.look = at.clamp(w.look + n * 0.0035, -3.2, 3.2)),
          (w.lookP = at.clamp(w.lookP + s * 0.003, -0.4, 1)))
        : ((w.yawT -= n * 0.0032),
          (w.pitchT = at.clamp(w.pitchT - s * 0.0032, -1.1, 0.9))),
        (t = { x: o.clientX, y: o.clientY }));
    }));
  const e = () => {
    ((t = null), (w.dragging = !1));
  };
  (pt.addEventListener("pointerup", e),
    pt.addEventListener("pointercancel", e));
}
function yo() {
  (La(), vs.render());
}
no &&
  ((w.x = 0),
  (w.z = -60),
  (w.yaw = w.yawT = 0.15),
  (w.pitch = w.pitchT = -0.03));
Vt(1 / 60);
const v0 = new ra(),
  $ = { adaptive: !Yt, ratio: U.getPixelRatio(), acc: 0, frames: 0 };
function z0(t) {
  if (!$.adaptive || t > 0.5 || (($.acc += t), $.frames++, $.acc < 1.5)) return;
  const e = $.frames / $.acc,
    o = Math.min(devicePixelRatio, 1.5);
  (($.acc = 0), ($.frames = 0));
  let n = $.ratio;
  (e < 44
    ? (n = Math.max(0.55, $.ratio * Math.max(0.78, e / 52)))
    : e > 58 && $.ratio < o && (n = Math.min(o, $.ratio + 0.1)),
    Math.abs(n - $.ratio) > 0.04 && (($.ratio = n), U.setPixelRatio(n), ie()));
}
U.setAnimationLoop(() => {
  const t = v0.getDelta();
  (Vt(Math.min(t, 1 / 30)), yo(), z0(t));
});
document.body.classList.add("ready");
if (ro) {
  (U.setAnimationLoop(null),
    U.setPixelRatio(1),
    ie(),
    (w.mode = "ride"),
    B.setMounted(!0));
  const t = +tt.get("frames"),
    e = tt.get("port"),
    o = tt.has("t") ? tt.get("t").split(",").map(Number) : null,
    n = async () => {
      (yo(), await U.backend.device.queue.onSubmittedWorkDone());
    },
    s = async (i) => {
      const d = await new Promise((r) => pt.toBlob(r, "image/png"));
      await fetch(`http://localhost:${e}/frame?i=${i}`, {
        method: "POST",
        body: d,
      });
    },
    l = 60;
  for (let i = 0; i < 6; i++) (Vt(1 / l), await n());
  if (((w.clock = 0), B.pos.set(3, -1), (B.yaw = -0.4), (B.speed = 0), o)) {
    let i = 0;
    for (const [d, r] of o.entries()) {
      for (; i < r; ) (Vt(1 / l), (i += 1 / l));
      (await n(), await s(d));
    }
  } else {
    const i = +(tt.get("from") || 0);
    for (let d = 0; d < i; d++) Vt(1 / l);
    for (let d = i; d < i + t; d++) (Vt(1 / l), await n(), await s(d));
  }
  await fetch(`http://localhost:${e}/done`);
}
no &&
  setTimeout(
    () =>
      pt.toBlob(
        (t) =>
          fetch(`http://localhost:${tt.get("port")}/`, {
            method: "POST",
            body: t,
          }),
        "image/jpeg",
        +(tt.get("q") || 0.92),
      ),
    +(tt.get("after") || 4e3),
  );
tt.has("debug") &&
  (window.mir = {
    film: eo,
    update: Vt,
    render: yo,
    state: w,
    bike: B,
    toggleRide: xo,
    nature: Kt,
    settings: st,
    keys: Q,
    camera: T,
    scene: J,
    THREE: Bs,
    renderer: U,
    heat: ne,
    mirage: uo,
    mirageScale: mo,
    mirageNear: Pe,
    exposure: ho,
  });
function S0() {
  return (
    ia(() => ({
      Walk: De({
        "Walking pace": {
          value: 1,
          min: 0.3,
          max: 4,
          step: 0.05,
          onChange: (t) => {
            st.pace = t;
          },
        },
        "Adaptive resolution": {
          value: $.adaptive,
          onChange: (t) => {
            $.adaptive = t;
          },
        },
        "Render scale": {
          value: U.getPixelRatio(),
          min: 0.5,
          max: 2,
          step: 0.05,
          onChange: (t, e, o) => {
            o.initial ||
              (($.adaptive = !1), ($.ratio = t), U.setPixelRatio(t), ie());
          },
        },
        "Contact shadow": {
          value: st.ao,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            rs.value = t;
          },
        },
      }),
      Mirage: De({
        Heat: {
          value: st.heat,
          min: 0,
          max: 4,
          step: 0.01,
          onChange: (t) => {
            ne.value = t;
          },
        },
        Strength: {
          value: st.mirage,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            uo.value = t;
          },
        },
        "Band width": {
          value: st.mirageScale,
          min: 1,
          max: 12,
          step: 0.1,
          onChange: (t) => {
            mo.value = t;
          },
        },
        "Nearest (m)": {
          value: st.mirageNear,
          min: 5,
          max: 200,
          step: 1,
          onChange: (t) => {
            Pe.value = t;
          },
        },
      }),
      Finish: De(
        {
          Exposure: {
            value: 0.82,
            min: 0.3,
            max: 2.5,
            step: 0.01,
            onChange: (t) => {
              ho.value = t;
            },
          },
          Colour: {
            value: He.value,
            min: 0,
            max: 2,
            step: 0.01,
            onChange: (t) => {
              He.value = t;
            },
          },
          Punch: {
            value: Oe.value,
            min: 0.5,
            max: 1.5,
            step: 0.01,
            onChange: (t) => {
              Oe.value = t;
            },
          },
          Vignette: {
            value: Ze.value,
            min: 0,
            max: 1,
            step: 0.01,
            onChange: (t) => {
              Ze.value = t;
            },
          },
        },
        { collapsed: !0 },
      ),
    })),
    null
  );
}
Yt ||
  ca.createRoot(document.querySelector("#controls")).render(
    he.createElement(
      he.Fragment,
      null,
      he.createElement(la, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      he.createElement(S0),
    ),
  );
