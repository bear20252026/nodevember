import "../lib/modulepreload-polyfill.js";
import {
  M as ie,
  a1 as qe,
  u as Dt,
  Y as Ft,
  Q as lt,
  O as Ut,
  m as ht,
  b as at,
  s as dt,
  $ as xt,
  a2 as $t,
  aj as Ht,
  az as Wt,
  g as vt,
  aw as _t,
  P as jt,
} from "../lib/stage.js";
import { O as Xt } from "../lib/OrbitControls.js";
import {
  a3 as oe,
  C as xe,
  M,
  f as Oe,
  aP as Ve,
  aC as we,
  V as y,
  aB as Qe,
  e as mt,
  b6 as pt,
  b7 as gt,
  b8 as ut,
  b1 as Zt,
  ar as ke,
  I as je,
  O as Rt,
  bc as Kt,
  d as yt,
  a as wt,
  b3 as Qt,
  bm as Yt,
  aS as st,
  aT as Pt,
  aU as Jt,
  S as Lt,
  P as eo,
  B as to,
  F as oo,
  D as no,
  c as ao,
  r as Le,
  L as so,
  u as co,
  b as zt,
  g as Et,
  aF as ro,
} from "../lib/leva.js";
import { r as io } from "../lib/rendering-panel.js";
import { a as lo } from "../lib/pcss.js";
import { R as ct } from "../lib/RoundedBoxGeometry.js";
import "../lib/three.js";
function bt(e, t, o) {
  const l = Math.sin(t / 2),
    m = Math.PI / (2 * ho(1, Math.sqrt(1 - l * l)));
  return 2 * Math.asin(l * mo((e / o) * 4 * m, l));
}
function ho(e, t) {
  for (let o = 0; o < 12; o++) [e, t] = [(e + t) / 2, Math.sqrt(e * t)];
  return e;
}
function mo(e, t) {
  const o = [1],
    l = [t];
  let m = Math.sqrt(1 - t * t),
    n = 0;
  for (; Math.abs(l[n]) > 1e-12 && n < 12; )
    (o.push((o[n] + m) / 2),
      l.push((o[n] - m) / 2),
      (m = Math.sqrt(o[n] * m)),
      n++);
  let d = Math.pow(2, n) * o[n] * e;
  for (let r = n; r > 0; r--)
    d = (d + Math.asin((l[r] / o[r]) * Math.sin(d))) / 2;
  return Math.sin(d);
}
const ft = (e) => (
    (e = Math.min(1, Math.max(0, e))),
    e * e * e * (e * (e * 6 - 15) + 10)
  ),
  po = (e) => () => (e = (e * 16807) % 2147483647) / 2147483647,
  uo = [
    {
      name: "Ochre",
      room: "#d9a457",
      ring: "#eadccb",
      metal: "#ecebe8",
      metalRough: 0.06,
      thread: "#3b2c20",
    },
    {
      name: "Sage",
      room: "#b9c2b0",
      ring: "#f2f0ea",
      metal: "#e8e8e6",
      metalRough: 0.06,
      thread: "#2c332a",
    },
    {
      name: "Terracotta",
      room: "#c98a6e",
      ring: "#f1e6da",
      metal: "#dcbb7f",
      metalRough: 0.1,
      thread: "#3a2219",
    },
    {
      name: "Slate",
      room: "#8e9aa6",
      ring: "#ecebe8",
      metal: "#d9dbdf",
      metalRough: 0.05,
      thread: "#22262b",
    },
  ];
function wo(e, t, o) {
  const d = [
      [t + 0.012, -o / 2],
      [e - 0.012, -o / 2],
      [e, -o / 2 + 0.012],
      [e, o / 2 - 0.012],
      [e - 0.012, o / 2],
      [t + 0.012, o / 2],
      [t, o / 2 - 0.012],
      [t, 0.022],
      [t + 0.006, 0.018],
      [t + 0.006, -0.018],
      [t, -0.022],
      [t, -o / 2 + 0.012],
      [t + 0.012, -o / 2],
    ].map(([u, f]) => new Oe(u, f)),
    r = new Ve(d, 256);
  return (r.rotateX(Math.PI / 2), r);
}
function fo(e, t) {
  const o = [],
    l = [
      [e * 0.72, -t / 2 + 0.003],
      [e - 0.006, -t / 2],
      [e, -t / 2 + 0.006],
      [e, -0.007],
      [e - 0.009, -0.0025],
      [e - 0.009, 0.0025],
      [e, 0.007],
      [e, t / 2 - 0.006],
      [e - 0.006, t / 2],
      [e * 0.72, t / 2 - 0.003],
    ],
    m = new Ve(
      l.map(([u, f]) => new Oe(u, f)),
      96,
    );
  (m.rotateX(Math.PI / 2), o.push(m));
  const n = new pt();
  n.absarc(0, 0, e * 0.74, 0, Math.PI * 2, !1);
  for (let u = 0; u < 5; u++) {
    const f = (u / 5) * Math.PI * 2,
      S = new gt();
    (S.absarc(
      Math.cos(f) * e * 0.45,
      Math.sin(f) * e * 0.45,
      e * 0.17,
      0,
      Math.PI * 2,
      !0,
    ),
      n.holes.push(S));
  }
  const d = new ut(n, {
    depth: t * 0.35,
    bevelEnabled: !0,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 3,
    curveSegments: 48,
  });
  (d.translate(0, 0, -t * 0.175), o.push(d));
  const r = new Ve(
    [
      [0, t / 2 + 0.004],
      [e * 0.18, t / 2 + 0.002],
      [e * 0.24, t / 2 - 0.006],
      [e * 0.24, -t / 2 + 0.006],
      [e * 0.18, -t / 2 - 0.002],
      [0, -t / 2 - 0.004],
    ].map(([u, f]) => new Oe(u, f)),
    48,
  );
  return (r.rotateX(Math.PI / 2), o.push(r), o);
}
function Mo(e) {
  const t = new oe(),
    o = new ie({
      color: e.ring,
      roughness: 0.5,
      sheen: 0.5,
      sheenRoughness: 0.45,
      sheenColor: new xe("#fff8ee"),
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
    }),
    l = new ie({ color: e.metal, metalness: 1, roughness: e.metalRough }),
    m = new qe({ color: e.thread, roughness: 0.85 }),
    n = 1,
    d = 0.9,
    r = 0.17,
    u = new oe();
  ((u.position.y = n), t.add(u));
  const f = new M(wo(n, d, r), o);
  u.add(f);
  const S = new oe();
  u.add(S);
  const _ = (g = 0.0024) => {
      const R = new M(new we(g, g, 1, 8), m);
      return (S.add(R), R);
    },
    I = new y(0, 1, 0),
    w = (g, R, E) => {
      (g.position.copy(R).add(E).multiplyScalar(0.5),
        g.scale.set(1, R.distanceTo(E), 1),
        g.quaternion.setFromUnitVectors(I, E.clone().sub(R).normalize()));
    },
    x = () => {
      const g = new M(new Qe(0.01, 0.0032, 12, 28), l);
      return (S.add(g), g);
    },
    z = _();
  w(z, new y(0, -d + 0.006, 0), new y(0, d - 0.006, 0));
  for (const g of [1, -1]) {
    const R = x();
    (R.position.set(0, g * (d - 0.006), 0), (R.rotation.x = Math.PI / 2));
  }
  const K = [_(), _()],
    T = [0, 1, 2, 3].map(x),
    de = [_(0.0018), _(0.0018)],
    fe = (g, R) => {
      const E = new oe();
      return (fo(g, R).forEach((pe) => E.add(new M(pe, l))), S.add(E), E);
    },
    Me = fe(0.095, 0.06),
    se = [fe(0.085, 0.052), fe(0.085, 0.052)];
  t.traverse((g) => {
    g.isMesh && (g.castShadow = g.receiveShadow = !0);
  });
  const G = {
      swing: 62,
      period: 3.4,
      hubMid: 0.24,
      hubAmp: 0.12,
      arm: 0.52,
      recoil: 1,
    },
    ce = new y(),
    j = new y(),
    ge = new y(),
    $ = new y(),
    N = [0, 0],
    O = [null, null];
  let me = 0,
    X = 0,
    Pe = 0,
    ye = 0;
  function be(g) {
    const R = Math.max(0, Math.min(0.05, g - ye));
    ye = g;
    const E = bt(g, mt.degToRad(G.swing), G.period),
      pe = (E - me) / Math.max(R, 0.001);
    ((me = E),
      (Pe += (-pe * 0.006 * G.recoil - X * 90 - Pe * 9) * R),
      (X += Pe * R),
      (f.rotation.z = X),
      (S.rotation.z = X * 0.4));
    const b = G.hubMid + (G.hubAmp * (1 - Math.cos(E * 2))) / 2;
    (Me.position.set(0, b, 0),
      (Me.rotation.z = -b * 14),
      ce.set(Math.cos(E), Math.sin(E), 0),
      K.forEach((J, F) => {
        const v = F ? -0.022 : 0.022;
        (j
          .copy(ce)
          .multiplyScalar(-d + 0.008)
          .setZ(v),
          ge
            .copy(ce)
            .multiplyScalar(d - 0.008)
            .setZ(v),
          w(J, j, ge),
          T[F * 2].position.copy(j),
          T[F * 2 + 1].position.copy(ge),
          T[F * 2].rotation.set(0, Math.PI / 2, E),
          T[F * 2 + 1].rotation.set(0, Math.PI / 2, E));
      }));
    const Y = b * Math.sin(E),
      Ce = Math.max(0, Y * Y - b * b + G.arm * G.arm);
    [
      [Y + Math.sqrt(Ce), 1],
      [-Y + Math.sqrt(Ce), -1],
    ].forEach(([J, F], v) => {
      const re = se[v];
      (re.position.copy(ce).multiplyScalar(Math.min(J, d - 0.1) * F),
        O[v] !== null && (N[v] -= ((J - O[v]) * F) / 0.085),
        (O[v] = J),
        re.rotation.set(0, 0, E + N[v]),
        $.set(0, b, 0),
        w(de[v], $, re.position));
    });
  }
  return {
    group: t,
    update: be,
    motion: G,
    controls: {
      swing: [10, 85, 1],
      period: [1.5, 6, 0.05],
      hubAmp: [0, 0.18, 0.005],
      arm: [0.4, 0.6, 0.005],
      recoil: [0, 3, 0.01],
    },
    camera: { pos: [3.1, 1.55, 3.1], target: [0, 0.95, 0] },
    room: e.room,
    label: `The Mechanism · ${e.name}`,
  };
}
const go = [
    {
      name: "Plaster & sage",
      room: "#c9c8c3",
      plaster: "#f3f1ec",
      accent: "#9fb08a",
      chain: "#d9dadc",
    },
    {
      name: "Bone & clay",
      room: "#cfc5b8",
      plaster: "#f4efe6",
      accent: "#c97a5a",
      chain: "#d8c8a8",
    },
    {
      name: "Fog & blue",
      room: "#bfc6cc",
      plaster: "#f1f2f2",
      accent: "#6f8fae",
      chain: "#dcdfe2",
    },
    {
      name: "Ash & ochre",
      room: "#c8c3ba",
      plaster: "#efece6",
      accent: "#d2a040",
      chain: "#d6d6d6",
    },
  ],
  Tt = ["circle", "triangle", "square", "hexagon", "triangle", "diamond"];
function At(e, t, o, l, m) {
  const n = new gt();
  if (e === "circle") return (n.absarc(t, o, l, 0, Math.PI * 2, !0), n);
  const d = { triangle: 3, square: 4, hexagon: 6, diamond: 4 }[e],
    r =
      e === "diamond"
        ? 0
        : e === "square"
          ? Math.PI / 4
          : e === "triangle"
            ? -Math.PI / 2
            : 0,
    u = e === "triangle" ? l * 1.35 : e === "square" ? l * 1.2 : l * 1.12;
  for (let f = d; f >= 0; f--) {
    const S = m + r + (f / d) * Math.PI * 2;
    f === d
      ? n.moveTo(t + Math.cos(S) * u, o + Math.sin(S) * u)
      : n.lineTo(t + Math.cos(S) * u, o + Math.sin(S) * u);
  }
  return n;
}
function yo(e, t) {
  const o = new oe(),
    l = new ie({
      color: e.plaster,
      roughness: 0.62,
      sheen: 0.25,
      sheenColor: new xe("#ffffff"),
    }),
    m = new ie({
      color: e.accent,
      roughness: 0.38,
      clearcoat: 0.5,
      clearcoatRoughness: 0.25,
    }),
    n = new ie({ color: e.chain, metalness: 1, roughness: 0.1 }),
    d = new qe({ color: "#2a2826", roughness: 0.9 }),
    r = { w: 1.25, h: 0.34, d: 0.42 },
    u = new pt(),
    f = 0.04;
  (u.moveTo(-1.25 / 2 + f, 0),
    u.lineTo(r.w / 2 - f, 0),
    u.quadraticCurveTo(r.w / 2, 0, r.w / 2, f),
    u.lineTo(r.w / 2, r.h - f),
    u.quadraticCurveTo(r.w / 2, r.h, r.w / 2 - f, r.h),
    u.lineTo(-1.25 / 2 + f, r.h),
    u.quadraticCurveTo(-1.25 / 2, r.h, -1.25 / 2, r.h - f),
    u.lineTo(-1.25 / 2, f),
    u.quadraticCurveTo(-1.25 / 2, 0, -1.25 / 2 + f, 0));
  const S = new ut(u, {
    depth: r.d,
    bevelEnabled: !0,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 5,
    curveSegments: 12,
  });
  (S.translate(0, 0, -0.42 / 2), o.add(new M(S, l)));
  const _ = new M(new Zt(1.18, 0.004, 0.05), d);
  ((_.position.y = r.h + 0.021), o.add(_));
  const I = 0.56,
    w = 0.04,
    x = 0.37,
    z = 0.09;
  (t(), t());
  const K = [...Tt].sort(() => t() - 0.5),
    T = K.length,
    de = new pt();
  (de.absarc(0, 0, I, 0, Math.PI * 2, !1),
    K.forEach((P, L) => {
      const k = Math.PI / 2 + (L / T) * Math.PI * 2;
      de.holes.push(
        At(P, Math.cos(k) * x, Math.sin(k) * x, z, k - Math.PI / 2),
      );
    }));
  const fe = new gt();
  (fe.absarc(0, 0, 0.05, 0, Math.PI * 2, !0), de.holes.push(fe));
  const Me = new ut(de, {
    depth: w,
    bevelEnabled: !0,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 4,
    curveSegments: 96,
  });
  Me.translate(0, 0, -w / 2);
  const se = new M(Me, l),
    G = new oe();
  ((G.position.y = r.h + 0.02), G.add(se), o.add(G));
  const ce = new M(new we(0.045, 0.045, w + 0.03, 48), m);
  ((ce.rotation.x = Math.PI / 2), se.add(ce));
  const j = new y(0, r.h + 0.02 + x + 1.45, 0),
    ge = 1.45,
    $ = new oe(),
    N = new ke(1, 192, 128),
    O = N.attributes.position.array.slice(),
    me = (P) => {
      const L = new Float32Array(O.length / 3),
        k = 0.007;
      if (P === "circle") return (L.fill(z * 0.84), L);
      const Q = At(P, 0, 0, z * 0.84, 0).getPoints(),
        s = [];
      for (let c = 0; c < Q.length - 1; c++) {
        const p = Q[c],
          q = Q[c + 1],
          H = q.x - p.x,
          D = q.y - p.y,
          h = Math.hypot(H, D);
        if (h < 1e-6) continue;
        let i = D / h,
          C = -H / h;
        (i * p.x + C * p.y < 0 && ((i = -i), (C = -C)),
          s.push([i, C, i * p.x + C * p.y]));
      }
      const a = P === "square" ? z * 0.8 : 0.06;
      for (let c = 0; c < L.length; c++) {
        const p = O[c * 3],
          q = O[c * 3 + 1],
          H = O[c * 3 + 2];
        let D = 0,
          h = 1 / 0;
        Math.abs(H) > 1e-6 && (h = Math.min(h, a / Math.abs(H)));
        for (const [i, C, W] of s) {
          const Te = i * p + C * q;
          Te > 1e-6 && (h = Math.min(h, W / Te));
        }
        ((D = 0),
          Math.abs(H) > 1e-6 && (D += Math.exp(-(a / Math.abs(H) - h) / k)));
        for (const [i, C, W] of s) {
          const Te = i * p + C * q;
          Te > 1e-6 && (D += Math.exp(-(W / Te - h) / k));
        }
        L[c] = h - k * Math.log(D);
      }
      return L;
    },
    X = Object.fromEntries([...new Set(Tt)].map((P) => [P, me(P)])),
    Pe = new M(N, m);
  $.add(Pe);
  const ye = N.attributes.position;
  let be = null,
    Ie = null,
    g = -1;
  function R(P, L, k) {
    if (P === be && L === Ie && Math.abs(k - g) < 1e-4) return;
    ((be = P), (Ie = L), (g = k));
    const Q = X[P],
      s = X[L],
      a = ye.array;
    for (let c = 0; c < Q.length; c++) {
      const p = Q[c] + (s[c] - Q[c]) * k;
      ((a[c * 3] = O[c * 3] * p),
        (a[c * 3 + 1] = O[c * 3 + 1] * p),
        (a[c * 3 + 2] = O[c * 3 + 2] * p));
    }
    ((ye.needsUpdate = !0), N.computeVertexNormals());
  }
  const E = new M(new Qe(0.012, 0.003, 10, 24), n);
  E.position.y = z * 1.25;
  const pe = new M(new we(0.012, 0.02, 0.02, 24), n);
  ((pe.position.y = z * 1.25 - 0.022), $.add(E, pe), o.add($));
  const b = 150,
    Y = new M(new we(0.0018, 0.0018, 1, 6), n);
  o.add(Y);
  const Ce = z * 1.25 + 0.012,
    J = 0.014,
    F = new je(new ke(0.0058, 12, 8), n, b);
  o.add(F);
  const v = 0.045,
    re = r.w / 2 - v / 2 + 0.005,
    Se = j.y + 0.05,
    Ne = new M(new ct(v, Se + v / 2 - r.h, v, 3, 0.012), l);
  Ne.position.set(re, (r.h + Se + v / 2) / 2, 0);
  const Ue = re + v / 2 + 0.07,
    $e = new M(new ct(Ue, v, v, 3, 0.012), l);
  $e.position.set(re + v / 2 - Ue / 2, Se, 0);
  for (const P of [-0.022, 0.022]) {
    const L = new M(new ct(0.008, 0.07, 0.036, 2, 0.003), m);
    (L.position.set(P, j.y + 0.005, 0), o.add(L));
  }
  const V = new M(new we(0.006, 0.006, 0.06, 24), n);
  ((V.rotation.z = Math.PI / 2), V.position.copy(j));
  const ze = new M(new Qe(0.011, 0.0035, 10, 24), n);
  ((ze.rotation.y = Math.PI / 2),
    ze.position.copy(j),
    o.add(Ne, $e, V, ze),
    o.traverse((P) => {
      P.isMesh && (P.castShadow = P.receiveShadow = !0);
    }));
  const ee = { amp: 0.5, period: 2.6, wait: 0.22 },
    He = {
      amp: [0.3, 0.8, 0.01],
      period: [1.6, 5, 0.01],
      wait: [0.05, 0.35, 0.01],
    },
    te = new Rt(),
    Ee = new y();
  function We(P) {
    const L = bt(P, ee.amp, ee.period);
    (Ee.set(0, -Math.cos(L), Math.sin(L)),
      $.position.copy(j).addScaledVector(Ee, ge),
      ($.rotation.x = -L));
    const k = ge - Ce - J;
    for (let p = 0; p < b; p++)
      (te.position.copy(j).addScaledVector(Ee, J + ((p + 0.5) / b) * k),
        te.updateMatrix(),
        F.setMatrixAt(p, te.matrix));
    (Y.position.copy(j).addScaledVector(Ee, J + k / 2),
      Y.scale.set(1, k, 1),
      Y.quaternion.setFromUnitVectors(new y(0, 1, 0), Ee.clone().negate()),
      (F.instanceMatrix.needsUpdate = !0));
    const Q = ee.period / 2,
      s = Math.floor(P / Q),
      a = (P - s * Q) / Q;
    se.rotation.z =
      -(s + ft((a - ee.wait) / (1 - 2 * ee.wait))) * ((Math.PI * 2) / T);
    const c = ft((a - 0.3) / 0.4);
    R(K[((s % T) + T) % T], K[(((s + 1) % T) + T) % T], c);
  }
  return {
    group: o,
    update: We,
    motion: ee,
    controls: He,
    camera: { pos: [2.9, 1.7, 3.6], target: [0, 0.78, 0] },
    room: e.room,
    label: `Shape gate · ${e.name}`,
  };
}
const bo = [
  {
    name: "Mint & red",
    room: "#93b8ab",
    balloon: "#d9232f",
    frame: "#2b2d2e",
    gold: "#c9a253",
  },
  {
    name: "Mint & coral",
    room: "#93b8ab",
    balloon: "#ea5d64",
    frame: "#2b2d2e",
    gold: "#c9a253",
  },
  {
    name: "Lilac & lemon",
    room: "#b3aecb",
    balloon: "#f0c63c",
    frame: "#2b2a30",
    gold: "#c9a253",
  },
  {
    name: "Sand & sky",
    room: "#d6c3a5",
    balloon: "#3f86cf",
    frame: "#2c2a27",
    gold: "#c9a253",
  },
];
function So() {
  const e = [];
  for (let t = 0; t <= 60; t++) {
    const o = t / 60,
      l = -o * 0.3;
    let m =
      o < 0.64
        ? 0.11 * Math.pow(Math.sin(((Math.PI / 2) * o) / 0.64), 1.25)
        : 0.11 * Math.sqrt(Math.max(0, 1 - ((o - 0.64) / 0.36) ** 2));
    (o < 0.06 && (m = Math.max(m, 0.006 + 0.01 * (1 - o / 0.06))),
      e.push(new Oe(Math.max(m, 1e-4), l)));
  }
  return (e.reverse(), new Ve(e, 80));
}
function xo(e, t) {
  const o = new ke(e, 160, 96),
    l = o.attributes.position,
    m = new y();
  for (let n = 0; n < l.count; n++) {
    m.fromBufferAttribute(l, n);
    const d = Math.atan2(m.z, m.x),
      r = Math.pow(Math.abs(Math.cos((d * t) / 2)), 1.6),
      u = Math.sqrt(Math.max(0, 1 - (m.y / e) ** 2));
    ((m.x *= 1 - 0.1 * (1 - r) * u),
      (m.z *= 1 - 0.1 * (1 - r) * u),
      (m.y *= m.y > 0 ? 0.86 : 0.95),
      l.setXYZ(n, m.x, m.y, m.z));
  }
  return (o.computeVertexNormals(), o);
}
function vo(e) {
  const t = new oe(),
    o = Dt(new xe(e.balloon)),
    l = new ie({
      roughness: 0.22,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      sheen: 0.35,
    }),
    m = Ft.sub(lt).normalize(),
    n = Ut.dot(m).abs();
  ((l.colorNode = ht(o.mul(at(0.55, 0.45, 0.48)), o, dt(0, 0.7, n))),
    (l.sheenColorNode = o.mul(1.4)),
    (l.emissiveNode = o.mul(n.oneMinus().pow(2).mul(0.12))));
  const d = new ie({
      color: e.frame,
      metalness: 0.75,
      roughness: 0.28,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    }),
    r = new ie({ color: e.gold, metalness: 1, roughness: 0.18 }),
    u = new qe({ color: "#f4f2ee", roughness: 0.7 }),
    f = new ie({ roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.45 });
  f.colorNode = ht(
    at(0.05, 0.16, 0.08),
    at(0.2, 0.4, 0.2),
    dt(-0.1, 0.1, xt.y),
  ).mul($t(xt.mul(55)).mul(0.18).add(0.92));
  const S = new qe({ color: "#efe4c2", roughness: 0.45 }),
    _ = new qe({ color: "#f3efe6", roughness: 1 }),
    I = 1.75,
    w = 1.3,
    x = 0.28,
    z = 0.08,
    K = (s) => {
      const a = (p, q) => new y(p, q, s),
        c = new Yt();
      (c.add(new st(a(-I / 2, 0), a(-I / 2, w - z))),
        c.add(new Pt(a(-I / 2, w - z), a(-I / 2, w), a(-I / 2 + z, w))),
        c.add(new st(a(-I / 2 + z, w), a(I / 2 - z, w))),
        c.add(new Pt(a(I / 2 - z, w), a(I / 2, w), a(I / 2, w - z))),
        c.add(new st(a(I / 2, w - z), a(I / 2, 0))),
        t.add(new M(new Jt(c, 240, 0.011, 16), d)));
    };
  (K(x), K(-x));
  for (const s of [-I / 2, I / 2]) {
    const a = new M(new we(0.011, 0.011, x * 2, 12), d);
    ((a.rotation.x = Math.PI / 2), a.position.set(s, 0.011, 0), t.add(a));
  }
  const T = () => {
      const s = new M(new we(0.0012, 0.0012, 1, 6), u);
      return (t.add(s), s);
    },
    de = new y(0, 1, 0),
    fe = (s, a, c) => {
      (s.position.copy(a).add(c).multiplyScalar(0.5),
        s.scale.set(1, a.distanceTo(c), 1),
        s.quaternion.setFromUnitVectors(de, c.clone().sub(a).normalize()));
    },
    Me = (s) => {
      for (const a of [x, -x]) {
        const c = new M(new Qe(0.0135, 0.0028, 8, 20), r);
        (c.position.set(s, w, a), (c.rotation.y = Math.PI / 2), t.add(c));
      }
    },
    se = 0.78,
    G = 0.19,
    ce = 0.228,
    j = [-2, -1, 0, 1, 2].map((s) => s * ce - 0.22),
    ge = So(),
    $ = j.map((s) => {
      const a = new oe(),
        c = new M(ge, l),
        p = new M(new ke(0.009, 16, 12), l);
      ((p.position.y = 0.004), (p.scale.y = 0.8));
      const q = new M(new we(0.004, 0.006, 0.012, 12), r);
      return (
        (q.position.y = 0.014),
        a.add(c, p, q),
        t.add(a),
        Me(s),
        { g: a, x: s, threads: [T(), T()], popped: !1, popAt: -1 }
      );
    }),
    N = 0.105,
    O = 14,
    me = new oe(),
    X = new oe();
  ((X.position.y = -G), me.add(X), X.add(new M(xo(N, O), f)));
  const Pe = [
      [0, 0],
      [0.064, 0],
      [0.07, 0.006],
      [0.062, 0.012],
      [0.03, 0.02],
      [0.012, 0.024],
      [0.012, 0.042],
      [0, 0.042],
    ].map(([s, a]) => new Oe(s, a)),
    ye = new M(new Ve(Pe, 64), r);
  ((ye.position.y = N * 0.76), X.add(ye));
  const be = new M(new we(0.003, 0.003, G - N * 0.76 - 0.042, 8), r);
  ((be.position.y = (G + N * 0.76 + 0.042) / 2 - G + 0),
    (be.position.y = -0.06820000000000001 / 2),
    me.add(be));
  const Ie = new Kt(0.0014, 0.034, 4);
  Ie.translate(0, 0.017, 0);
  const g = 9,
    R = 6,
    E = new je(Ie, S, O * g * R),
    pe = new je(new ke(0.0045, 8, 6), _, O * g),
    b = new Rt();
  let Y = 0,
    Ce = 0;
  for (let s = 0; s < O; s++)
    for (let a = 0; a < g; a++) {
      const c = ((s + 0.5) / O) * Math.PI * 2,
        p = -1.05 + (a / (g - 1)) * 1.95,
        q = new y(
          Math.cos(c) * Math.cos(p),
          Math.sin(p),
          Math.sin(c) * Math.cos(p),
        ),
        H = q.clone().multiply(new y(N, N * (p > 0 ? 0.86 : 0.95), N));
      (b.position.copy(H),
        b.quaternion.identity(),
        b.scale.setScalar(1),
        b.updateMatrix(),
        pe.setMatrixAt(Ce++, b.matrix));
      for (let D = 0; D < R; D++)
        (b.position.copy(H),
          b.quaternion.setFromUnitVectors(
            de,
            q
              .clone()
              .add(new y().randomDirection().multiplyScalar(0.55))
              .normalize(),
          ),
          b.scale.setScalar(0.7 + Math.random() * 0.6),
          b.updateMatrix(),
          E.setMatrixAt(Y++, b.matrix));
    }
  (X.add(E, pe), t.add(me));
  const J = [T(), T()],
    F = j[4] + ce * 0.5 + N + 0.015;
  Me(F);
  const v = 120,
    re = new ie({ roughness: 0.3, clearcoat: 0.8, side: yt });
  re.colorNode = o;
  const Se = new je(new wt(0.032, 0.02), re, v),
    Ne = Array.from({ length: v }, () => ({
      p: new y(),
      v: new y(),
      r: new Qt(),
      w: new y(),
      life: 0,
    }));
  t.add(Se);
  let Ue = 0;
  function $e(s, a) {
    for (let c = 0; c < 24; c++) {
      const p = Ne[Ue++ % v];
      (p.p.copy(s).add(new y().randomDirection().multiplyScalar(0.09)),
        p.v
          .copy(p.p)
          .sub(s)
          .normalize()
          .multiplyScalar(1.2 + Math.random() * 1.6),
        (p.v.x += a * 0.6),
        p.w.set(Math.random() * 24, Math.random() * 24, Math.random() * 24),
        (p.life = 1));
    }
  }
  (t.traverse((s) => {
    s.isMesh && (s.castShadow = s.receiveShadow = !0);
  }),
    (Se.castShadow = !1));
  const V = { amp: 1.05, size: 1, regrow: 1.1, damping: 2.2, nudge: 0.05 },
    ze = new y(),
    ee = new y();
  let He = 0;
  const te = se + G,
    Ee = 2 * Math.PI * Math.sqrt(te / 9.81),
    We = (s, a, c, p, q = 0) => {
      (ze.set(a + Math.sin(c) * se, w - Math.cos(c) * se, Math.sin(q) * se),
        s.position.copy(ze),
        s.rotation.set(-q, 0, c),
        p.forEach((H, D) => fe(H, new y(a, w, D ? x : -x), ze)));
    };
  $.forEach((s) => {
    ((s.th = 0), (s.w = 0), (s.tz = 0), (s.wz = 0), (s.since = 99));
  });
  let P = V.amp;
  function L(s) {
    const a = Math.max(0, Math.min(0.05, s - He));
    He = s;
    const c = Ee * (1 + (V.amp * V.amp) / 16),
      p = bt(s + c / 4, V.amp, c),
      q = (p - P) / Math.max(a, 1e-4);
    ((P = p),
      We(me, F, p, J),
      (X.rotation.y += a * 0.25),
      ee.set(F + Math.sin(p) * te, w - Math.cos(p) * te, 0));
    const H = 6,
      D = a / H;
    for (let h = 0; h < H; h++) {
      for (const i of $)
        ((i.w += (-10.113402061855671 * Math.sin(i.th) - V.damping * i.w) * D),
          (i.th = Math.max(-0.12, Math.min(0.12, i.th + i.w * D))),
          (i.wz +=
            (-10.113402061855671 * Math.sin(i.tz) - V.damping * 0.5 * i.wz) *
            D),
          (i.tz = Math.max(-0.15, Math.min(0.15, i.tz + i.wz * D))));
      for (let i = 0; i < 4; i++) {
        const C = $[i],
          W = $[i + 1];
        if (C.popped || W.popped) continue;
        if (
          W.x + Math.sin(W.th) * te - (C.x + Math.sin(C.th) * te) < 0.222 &&
          C.w > W.w
        ) {
          const Ae = (C.w + W.w) / 2,
            Re = (C.w - W.w) * 0.25;
          ((C.w = Ae),
            (W.w = Ae),
            (C.wz -= Re * (0.5 + Math.random())),
            (W.wz += Re * (0.5 + Math.random())));
        }
      }
    }
    $.forEach((h, i) => {
      h.since += a;
      const C = h.x + Math.sin(h.th) * te,
        W = w - Math.cos(h.th) * te;
      (Math.hypot(ee.x - C, ee.y - W) < N + 0.1 &&
        !h.popped &&
        h.since > 0.4 &&
        ((h.popped = !0),
        (h.since = 0),
        $e(new y(C, W, 0), Math.sign(q)),
        $.forEach((ot, nt) => {
          !ot.popped &&
            nt !== i &&
            ((ot.w += (Math.sign(q) * V.nudge * 3) / (1 + Math.abs(nt - i))),
            (ot.wz +=
              ((Math.random() - 0.5) * V.nudge * 4) / (1 + Math.abs(nt - i))));
        })),
        h.popped &&
          h.since > V.regrow &&
          Math.abs(ee.x - h.x) > 0.4 &&
          ((h.popped = !1),
          (h.since = 0),
          (h.th = 0),
          (h.w = 0),
          (h.tz = 0),
          (h.wz = 0)));
      const Ae = h.popped ? 0 : ft(h.since / 0.6),
        Re =
          1 +
          Math.sin(Math.min(1, h.since / 0.6) * Math.PI * 2) * 0.05 * (1 - Ae);
      ((h.g.visible = !h.popped),
        We(h.g, h.x, h.th, h.threads, h.tz),
        h.g.scale.set(
          Math.max(0.001, Ae * Re * V.size),
          Math.max(0.001, (Ae / Re) * V.size),
          Math.max(0.001, Ae * Re * V.size),
        ));
    });
    for (let h = 0; h < v; h++) {
      const i = Ne[h];
      (i.life > 0 &&
        ((i.life -= a * 0.5),
        (i.v.y -= 9.81 * a * 0.35),
        i.v.multiplyScalar(1 - a * 2.5),
        i.p.addScaledVector(i.v, a),
        i.p.y < 0.005 &&
          ((i.p.y = 0.005),
          i.v.set(0, 0, 0),
          i.w.set(0, 0, 0),
          i.r.set(-Math.PI / 2, 0, i.r.z)),
        (i.r.x += i.w.x * a),
        (i.r.y += i.w.y * a),
        (i.r.z += i.w.z * a)),
        b.position.copy(i.p),
        b.rotation.copy(i.r),
        b.scale.setScalar(i.life > 0 ? Math.min(1, i.life * 4) : 0),
        b.updateMatrix(),
        Se.setMatrixAt(h, b.matrix));
    }
    Se.instanceMatrix.needsUpdate = !0;
  }
  const k = {
      amp: [0.5, 1.3, 0.01],
      regrow: [0.8, 5, 0.05],
      nudge: [0, 0.12, 0.005],
      damping: [0.5, 5, 0.05],
      size: [0.7, 1.2, 0.01],
    },
    Q = { Balloon: [e.balloon, (s) => o.value.set(s)] };
  return {
    group: t,
    update: L,
    motion: V,
    controls: k,
    colors: Q,
    camera: { pos: [2.7, 1.4, 3.4], target: [0, 0.62, 0] },
    room: e.room,
    label: `Pop cradle · ${e.name}`,
  };
}
const Z = new URLSearchParams(location.search),
  he = Z.has("thumb"),
  Ye = Z.has("capture");
document.body.classList.toggle("capture", he || Ye);
const le = await Ht({ shadows: !0 }),
  Ge = le.domElement;
Ge.id = "view";
Ge.tabIndex = 0;
Ge.setAttribute(
  "aria-label",
  "A pendulum mechanism whose parts always fit. Press Random for another.",
);
const ue = new Lt(),
  ne = new eo(30, 1, 0.05, 60),
  Xe = new xe(),
  qt = Wt(Xe),
  et = [[14, 0]],
  _e = 0.9,
  Gt = -1.35;
for (let e = 0; e <= 48; e++) {
  const t = ((e / 48) * Math.PI) / 2;
  et.push([Gt + _e - Math.sin(t) * _e, _e - Math.cos(t) * _e]);
}
et.push([Gt, 14]);
const It = 30,
  Bt = [],
  Nt = [];
et.forEach(([e, t]) => {
  Bt.push(-It / 2, t, e, It / 2, t, e);
});
for (let e = 0; e < et.length - 1; e++) {
  const t = e * 2;
  Nt.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
}
const tt = new to();
tt.setAttribute("position", new oo(Bt, 3));
tt.setIndex(Nt);
tt.computeVertexNormals();
const Ot = new qe({ roughness: 1, side: yt });
Ot.colorNode = qt.mul(
  ht(vt(1), vt(0.82), dt(1.5, 7, lt.xz.length().add(lt.y.mul(0.6)))),
);
const Vt = new M(tt, Ot);
Vt.receiveShadow = !0;
ue.add(Vt);
ue.backgroundNode = qt.mul(0.82);
const ae = new no(16774890, 3);
ae.position.set(4.4, 4.2, 2.2);
ae.target.position.set(0, 0.8, -0.3);
ae.castShadow = !0;
ae.shadow.mapSize.set(4096, 4096);
ae.shadow.bias = -3e-4;
ae.shadow.normalBias = 0.004;
Object.assign(ae.shadow.camera, {
  left: -2.4,
  right: 2.4,
  top: 2.4,
  bottom: -2.4,
  near: 0.5,
  far: 14,
});
ue.add(ae, ae.target);
const Po = lo(ae, { renderer: le, lightSize: 0.1, filterTaps: 28, noise: !1 });
function zo(e) {
  const t = new Lt();
  t.background = e.clone().multiplyScalar(0.85);
  const o = (d, r, u, f) => {
    const S = new M(new wt(d, r), new zt({ color: u, side: yt }));
    (S.position.set(...f), S.lookAt(0, 0, 0), t.add(S));
  };
  (o(7, 5, new xe(4, 3.8, 3.5), [6, 6, 4]),
    o(10, 10, new xe(1.8, 1.8, 1.8), [0, 9, 0]),
    o(1, 9, new xe(3, 3, 3), [-6, 2, 3]),
    o(1, 9, new xe(2, 2, 2.1), [5, 2, -6]));
  const l = new M(
    new wt(30, 30),
    new zt({ color: e.clone().multiplyScalar(0.7) }),
  );
  ((l.rotation.x = -Math.PI / 2), (l.position.y = -2), t.add(l));
  const m = new jt(le),
    n = m.fromScene(t, 0.02).texture;
  return (m.dispose(), n);
}
const Be = [
  { build: Mo, palettes: uo },
  { build: yo, palettes: go },
  { build: vo, palettes: bo },
];
let B = null,
  ve = -1,
  Je = 0;
const Ct = document.querySelector("#label");
function De(e, t, o = (Math.random() * 1e9) | 0) {
  (B &&
    (ue.remove(B.group),
    B.group.traverse((d) => {
      d.isMesh && d.geometry.dispose();
    })),
    (ve = e));
  const l = Be[e],
    m = l.palettes[t ?? Math.floor(Math.random() * l.palettes.length)];
  ((B = l.build(m, po((o % 2147483646) + 1))),
    ue.add(B.group),
    Xe.set(B.room),
    ue.environment?.dispose?.(),
    (ue.environment = zo(Xe)),
    (ue.environmentIntensity = 0.9),
    (document.body.style.background = B.room),
    document.documentElement.style.setProperty(
      "--ink",
      Xe.getHSL({}).l > 0.6 ? "#2a2723" : "#2a1d12",
    ),
    Ct && (Ct.textContent = B.label),
    A.pos.set(...B.camera.pos),
    A.target.set(...B.camera.target));
  const n = Math.atan2(A.pos.x - A.target.x, A.pos.z - A.target.z);
  (typeof U < "u" &&
    ((U.minAzimuthAngle = n - 0.85),
    (U.maxAzimuthAngle = Math.min(1.3, n + 0.55))),
    Ze.bump?.(),
    (Je = 0));
}
const A = { pos: new y(), target: new y() },
  Ze = {
    value: 0,
    listeners: new Set(),
    bump() {
      (this.value++, this.listeners.forEach((e) => e(this.value)));
    },
  };
function St() {
  const e =
    Math.random() < 0.75
      ? (ve + 1 + Math.floor(Math.random() * (Be.length - 1))) % Be.length
      : ve;
  De(e);
}
document.querySelector("#random")?.addEventListener("click", St);
addEventListener("keydown", (e) => {
  (e.key === "r" || e.key === "R") && St();
});
const U = new Xt(ne, Ge);
U.enableDamping = !0;
U.enablePan = !1;
U.minDistance = 2.6;
U.maxDistance = 5.2;
U.minPolarAngle = 0.95;
U.maxPolarAngle = 1.45;
const Eo = Number(Z.get("scene") ?? (he ? 1 : 0));
De(Eo, he ? Number(Z.get("pal") ?? 1) : 0, 4242);
he && (A.pos.set(1.7, 1.75, 4.6), A.target.set(0, 1.12, 0.2));
{
  const e = Math.atan2(A.pos.x - A.target.x, A.pos.z - A.target.z);
  ((U.minAzimuthAngle = e - 0.85),
    (U.maxAzimuthAngle = Math.min(1.3, e + 0.55)));
}
ne.position.copy(A.pos);
U.target.copy(A.target);
U.update();
let Fe = !1;
U.addEventListener("start", () => {
  Fe = !0;
});
const Ke = _t(le, ue, ne, {
  aoStrength: 0.6,
  aoRadius: 0.08,
  aoThickness: 0.1,
  bloomStrength: 0.006,
  vignette: 0.14,
  grain: 0.005,
});
function kt() {
  const e = he ? 1e3 : Ye ? +Z.get("w") : innerWidth,
    t = he ? 1e3 : Ye ? +Z.get("h") : innerHeight;
  (le.setSize(e, t, !he),
    (ne.aspect = e / t),
    (ne.fov = mt.radToDeg(
      2 * Math.atan(Math.tan(mt.degToRad(16)) / Math.min(1, ne.aspect)),
    )),
    ne.updateProjectionMatrix());
}
addEventListener("resize", kt);
kt();
const Mt = { value: 1 };
let rt,
  To = 0,
  it = 0;
he && (Je = 2.6 + 0.33);
if (Ye) {
  le.setAnimationLoop(null);
  const e = +Z.get("frames"),
    t = +(Z.get("from") || 0),
    o = Z.get("port"),
    l = 60,
    m = 1200,
    n = m / Be.length,
    d = Z.has("t") ? Z.get("t").split(",").map(Number) : null,
    r = new y(0, 1, 0),
    u = new y(),
    f = [0.9, 1.12, 0.8],
    S = [0, 0.45, 0],
    _ = async (w) => {
      const x = Math.min(Be.length - 1, Math.floor(w / n)),
        z = w - x * n,
        K = z / n,
        T = K * K * (3 - 2 * K);
      (x !== ve && De(x, 0, 4242),
        u
          .copy(A.pos)
          .sub(A.target)
          .applyAxisAngle(r, (T - 0.5) * 0.42)
          .multiplyScalar(f[x] * (1.06 - 0.14 * T)),
        ne.position.copy(A.target).add(u),
        (ne.position.y += S[x] + 0.12 - 0.2 * T),
        ne.lookAt(A.target.x, A.target.y + S[x], A.target.z),
        B.update(z / l + 1.2),
        Ke.render(),
        await le.backend.device.queue.onSubmittedWorkDone());
    },
    I = async (w) => {
      const x = await new Promise((z) => Ge.toBlob(z, "image/png"));
      await fetch(`http://localhost:${o}/frame?i=${w}`, {
        method: "POST",
        body: x,
      });
    };
  for (let w = 0; w < 4; w++) await _(t);
  if (d)
    for (const [w, x] of d.entries()) (await _(Math.round(x * l)), await I(w));
  else for (let w = t; w < t + e; w++) (await _(w), await I(w));
  await fetch(`http://localhost:${o}/done`);
} else
  le.setAnimationLoop((e) => {
    const t = rt === void 0 ? 0 : Math.min((e - rt) / 1e3, 0.05);
    if (((rt = e), (Je += t * Mt.value), (it += t), B.update(Je), !Fe)) {
      const o = A.pos
        .clone()
        .applyAxisAngle(new y(0, 1, 0), Math.sin(it * 0.07) * 0.12);
      ((o.y += Math.sin(it * 0.05) * 0.08),
        ne.position.lerp(o, 1 - Math.exp(-t * 1.4)),
        U.target.lerp(A.target, 1 - Math.exp(-t * 1.4)));
    }
    (U.update(t),
      Ke.render(),
      ++To === 4 &&
        (document.body.classList.add("ready"),
        he && Z.has("still") && le.setAnimationLoop(null),
        Z.has("port") &&
          setTimeout(() => {
            (Ke.render(),
              Ge.toBlob(
                (o) =>
                  fetch(`http://localhost:${Z.get("port")}/`, {
                    method: "POST",
                    body: o,
                  }),
                "image/jpeg",
                0.92,
              ));
          }, 1500)));
  });
document.querySelector("#random")?.addEventListener("click", () => {
  Fe = !1;
});
const Ao = { "The Mechanism": 0, "Shape gate": 1, "Pop cradle": 2 };
function Io() {
  const [, e] = Le.useState(0);
  Le.useEffect(() => {
    const n = (d) => e(d);
    return (Ze.listeners.add(n), () => Ze.listeners.delete(n));
  }, []);
  const t = Be[ve],
    o = Object.fromEntries(t.palettes.map((n, d) => [n.name, d])),
    l = Object.fromEntries(
      Object.entries(B.controls ?? {}).map(([n, [d, r, u]]) => [
        n,
        {
          value: B.motion[n],
          min: d,
          max: r,
          step: u,
          onChange: (f) => {
            B.motion[n] = f;
          },
        },
      ]),
    ),
    m = Object.fromEntries(
      Object.entries(B.colors ?? {}).map(([n, [d, r]]) => [
        n,
        { value: d, onChange: r },
      ]),
    );
  return (
    co(
      () => ({
        Pendulum: Et({
          Scene: {
            value: ve,
            options: Ao,
            onChange: (n, d, r) => {
              !r.initial && n !== ve && ((Fe = !1), De(n));
            },
          },
          Palette: {
            value: t.palettes.findIndex((n) => B.label.endsWith(n.name)),
            options: o,
            onChange: (n, d, r) => {
              r.initial || De(ve, n);
            },
          },
          Random: ro(() => {
            ((Fe = !1), St());
          }),
          Speed: {
            value: Mt.value,
            min: 0,
            max: 2,
            step: 0.01,
            onChange: (n) => {
              Mt.value = n;
            },
          },
        }),
        [B.label.split(" · ")[0]]: Et({ ...l, ...m }),
        ...io({ renderer: le, pipeline: Ke, lights: [ae], pcss: [Po] }),
      }),
      [Ze.value],
    ),
    null
  );
}
he ||
  ao.createRoot(document.querySelector("#controls")).render(
    Le.createElement(
      Le.Fragment,
      null,
      Le.createElement(so, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      Le.createElement(Io),
    ),
  );
