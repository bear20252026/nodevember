import "../lib/modulepreload-polyfill.js";
import {
  M as ye,
  a2 as ie,
  $ as X,
  s as $,
  g as Y,
  E as ue,
  af as Je,
  m as K,
  az as Ee,
  at as io,
  aj as lo,
  X as co,
  u as fo,
  J as ho,
  y as zt,
  i as uo,
  aC as mo,
  B as po,
  x as a0,
  a0 as go,
  Z as Le,
  b as O,
  a1 as wo,
  aw as bo,
  P as yo,
} from "../lib/stage.js";
import {
  ar as Ae,
  aC as Ht,
  k as _e,
  bc as $0,
  p as Mt,
  a3 as Ce,
  M as z,
  I as Nt,
  V as M,
  Q as Zt,
  f as Ie,
  e as Me,
  C as F,
  Y as Ze,
  S as V0,
  P as Mo,
  D as W0,
  H as xo,
  o as So,
  aa as ko,
  X as vo,
  ap as xt,
  b6 as Co,
  bf as zo,
  d as Ke,
  b as De,
  aQ as ne,
  m as ae,
  a as fe,
  c as To,
  r as et,
  L as Po,
  ba as Ao,
  az as _o,
  aE as Io,
  B as Eo,
  t as gt,
  aV as s0,
  $ as jo,
  bg as $o,
  u as Vo,
  b1 as r0,
  aB as Wo,
  b2 as R0,
  bh as F0,
  T as Ro,
  R as Fo,
  g as qe,
  aF as i0,
} from "../lib/leva.js";
import { r as Do } from "../lib/rendering-panel.js";
const Go =
    "" + new URL("../assets/bark_brown_02_arm_1k.jpg", import.meta.url).href,
  qo =
    "" + new URL("../assets/bark_brown_02_diff_1k.jpg", import.meta.url).href,
  Bo =
    "" + new URL("../assets/bark_brown_02_disp_1k.jpg", import.meta.url).href,
  No =
    "" + new URL("../assets/bark_brown_02_nor_gl_1k.jpg", import.meta.url).href;
function Pe(e) {
  let o = e >>> 0;
  return () => {
    o = (o + 1831565813) >>> 0;
    let t = Math.imul(o ^ (o >>> 15), 1 | o);
    return (
      (t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  };
}
function Kt(
  e,
  o,
  { drag: t = null, gravity: n = 0.12, substeps: r = 12 } = {},
) {
  const { x: l, prev: i, v: d, inv: g, members: c, n: a } = e,
    s = o / r,
    u = [],
    f = Math.exp(-3 * s);
  for (let m = 0; m < r; m++) {
    for (let h = 0; h < a; h++)
      if (g[h]) {
        d[h * 3 + 1] -= n * s;
        for (let p = 0; p < 3; p++)
          ((i[h * 3 + p] = l[h * 3 + p]), (l[h * 3 + p] += d[h * 3 + p] * s));
      }
    for (const h of c) {
      if (h.broken) continue;
      const { i: p, j: w } = h,
        b = g[p],
        k = g[w],
        v = b + k;
      if (!v) continue;
      const R = l[w * 3] - l[p * 3],
        C = l[w * 3 + 1] - l[p * 3 + 1],
        T = l[w * 3 + 2] - l[p * 3 + 2],
        I = Math.hypot(R, C, T) || 1e-9,
        G = I - h.rest;
      if (h.cable && G <= 0) continue;
      const Q = h.comp / (s * s),
        U = -G / (v + Q) / I;
      ((l[p * 3] -= R * U * b),
        (l[p * 3 + 1] -= C * U * b),
        (l[p * 3 + 2] -= T * U * b),
        (l[w * 3] += R * U * k),
        (l[w * 3 + 1] += C * U * k),
        (l[w * 3 + 2] += T * U * k));
    }
    if (t && g[t.node]) {
      const h = t.node * 3,
        p = 2e-4 / (s * s),
        w = 1 / (1 + p);
      for (let b = 0; b < 3; b++) l[h + b] += (t.target[b] - l[h + b]) * w;
    }
    for (let h = 0; h < a; h++)
      if (g[h])
        for (let p = 0; p < 3; p++)
          d[h * 3 + p] = ((l[h * 3 + p] - i[h * 3 + p]) / s) * f;
  }
  for (const m of c) {
    if (m.broken) continue;
    const { i: h, j: p } = m;
    ((m.len = Math.hypot(
      l[p * 3] - l[h * 3],
      l[p * 3 + 1] - l[h * 3 + 1],
      l[p * 3 + 2] - l[h * 3 + 2],
    )),
      (m.strain = (m.len - m.rest) / m.rest),
      m.strain > m.breakAt &&
        ((m.broken = !0), (m.brokenAt = e.time), u.push(m)));
  }
  return ((e.time += o), u);
}
const Oo = {
    moor: { pre: 0.05, comp: 2e-5, breakAt: 1 / 0 },
    frame: { pre: 0.05, comp: 4e-5, breakAt: 0.35 },
    radial: { pre: 0.04, comp: 6e-5, breakAt: 0.3 },
    signal: { pre: 0.04, comp: 6e-5, breakAt: 0.4 },
    hub: { pre: 0.02, comp: 2e-4, breakAt: 0.5 },
    deco: { pre: 0.01, comp: 3e-4, breakAt: 0.6 },
    spiral: { pre: 0.015, comp: 6e-4, breakAt: 0.9 },
    tangle: { pre: 0.03, comp: 15e-5, breakAt: 0.5 },
    gumfoot: { pre: 0.03, comp: 3e-4, breakAt: 0.25 },
  },
  Uo = ["Orb", "Argiope", "Zygiella", "Tattered", "Cobweb"],
  D0 = new Set(["spiral", "gumfoot", "tangle"]);
function Yo(
  e,
  {
    type: o = "Orb",
    cx: t = 0,
    cy: n = 0,
    z: r = 0,
    R: l = 2,
    anchor: i = null,
  } = {},
) {
  const d = Pe(e),
    g = [],
    c = [],
    a = [],
    s = (y, S, P = r) => g.push([y, S, P]) - 1,
    u = (y, S, P) => c.push({ i: y, j: S, kind: P }) - 1;
  if (o === "Cobweb")
    return c0(
      Xo(d, {
        cx: t,
        cy: n,
        z: r,
        R: l,
        node: s,
        link: u,
        pinned: a,
        nodes: g,
      }),
      { nodes: g, members: c, pinned: a, cx: t, cy: n, z: r, R: l, type: o },
    );
  const f = o === "Argiope",
    m = o === "Tattered",
    h = f ? 4 + Math.floor(d() * 2) : 5 + Math.floor(d() * 3),
    p = [];
  for (let y = 0; y < h; y++) {
    const S = (y / h + ((d() - 0.5) * 0.35) / h) * Math.PI * 2 + 0.3,
      P = l * (1 + d() * 0.3) * (Math.sin(S) < 0 ? 1.15 : 1);
    p.push({ a: S, x: Math.cos(S) * P, y: Math.sin(S) * P, on: [] });
  }
  p.sort((y, S) => y.a - S.a);
  for (const y of p) {
    y.i = s(t + y.x, n + y.y);
    const S = 2.4 + d() * 1.5,
      P = (d() - 0.5) * 0.5,
      E = [t + y.x * S + P, n + y.y * S + P, r + (d() - 0.5) * 0.6],
      j = s(...(i ? i(E[0], E[1], r) : E));
    (a.push(j), u(y.i, j, "moor"));
  }
  const w = (f ? 30 : 24) + Math.floor(d() * 10),
    b = [];
  for (let y = 0; y < w; y++) {
    const S = ((y + (d() - 0.5) * (f ? 0.15 : 0.45)) / w) * Math.PI * 2,
      P = Math.cos(S),
      E = Math.sin(S);
    for (let j = 0; j < h; j++) {
      const A = p[j],
        W = p[(j + 1) % h],
        se = W.x - A.x,
        Qe = W.y - A.y,
        vt = P * Qe - E * se;
      if (Math.abs(vt) < 1e-9) continue;
      const n0 = (A.x * Qe - A.y * se) / vt,
        Ct = (A.x * E - A.y * P) / vt;
      if (n0 > 0 && Ct >= 0 && Ct <= 1) {
        b.push({ a: S, dx: P, dy: E, L: n0, edge: j, u: Ct, chain: [] });
        break;
      }
    }
  }
  const k = Math.PI / 2 + (d() - 0.5) * 0.6,
    v = (y) =>
      o === "Zygiella" &&
      Math.abs(Math.atan2(Math.sin(y.a - k), Math.cos(y.a - k))) < 0.42,
    R = s(t, n),
    C = (y, S) => s(t + y.dx * S, n + y.dy * S, r + (d() - 0.5) * 0.004),
    T = 3 + Math.floor(d() * 2);
  for (let y = 0; y < T; y++)
    for (const S of b)
      S.chain.push({
        rho: l * (0.035 + y * 0.03),
        i: C(S, l * (0.035 + y * 0.03)),
        ring: "hub",
      });
  const I = (f ? 25 : 20) + Math.floor(d() * 10),
    G = I * b.length,
    Q = 0.93,
    U = 0.24;
  let H = -1;
  for (let y = 0; y < G; y++) {
    const S = b[y % b.length],
      P = y / G;
    if (v(S)) {
      H = -1;
      continue;
    }
    const E =
        Q -
        (Q - U) * (1 - Math.pow(1 - P, 1.25)) +
        (d() - 0.5) * (f ? 0.002 : 0.006),
      j = C(S, S.L * E);
    (S.chain.push({ rho: S.L * E, i: j, ring: "spiral" }),
      H >= 0 && u(H, j, "spiral"),
      (H = j));
  }
  for (const y of b) {
    y.chain.sort((A, W) => A.rho - W.rho);
    const S = p[y.edge],
      P = p[(y.edge + 1) % h],
      E = s(t + S.x + (P.x - S.x) * y.u, n + S.y + (P.y - S.y) * y.u);
    S.on.push({ u: y.u, i: E });
    let j = R;
    for (const A of y.chain) (u(j, A.i, "radial"), (j = A.i));
    u(j, E, "radial");
  }
  for (let y = 0; y < T; y++) {
    const S = b.map((P) => P.chain.filter((E) => E.ring === "hub")[y].i);
    S.forEach((P, E) => u(P, S[(E + 1) % S.length], "hub"));
  }
  if (
    (p.forEach((y, S) => {
      const P = p[(S + 1) % h],
        E = [...y.on].sort((A, W) => A.u - W.u);
      let j = y.i;
      for (const A of E) (u(j, A.i, "frame"), (j = A.i));
      u(j, P.i, "frame");
    }),
    o === "Zygiella")
  ) {
    const y = s(t + Math.cos(k) * l * 2.6, n + Math.sin(k) * l * 2.6, r);
    (a.push(y), u(R, y, "signal"));
  }
  if (o === "Argiope")
    for (const y of [Math.PI / 2, -Math.PI / 2]) {
      const S = b.reduce(
          (A, W, se) =>
            Math.abs(Math.atan2(Math.sin(W.a - y), Math.cos(W.a - y))) <
            Math.abs(Math.atan2(Math.sin(b[A].a - y), Math.cos(b[A].a - y)))
              ? se
              : A,
          0,
        ),
        P = b[S].chain.filter((A) => A.ring === "spiral"),
        E = b[(S + 1) % b.length].chain.filter((A) => A.ring === "spiral"),
        j = Math.min(P.length, E.length, Math.floor(P.length * 0.55));
      for (let A = P.length - 1, W = 0; W < j - 1; A--, W++) {
        const se = E.length - 1 - W;
        if (A < 1 || se < 1) break;
        (u(P[A].i, E[se - 1].i, "deco"), u(E[se - 1].i, P[A - 1].i, "deco"));
      }
    }
  const Se = c0(R, {
    nodes: g,
    members: c,
    pinned: a,
    cx: t,
    cy: n,
    z: r,
    R: l,
    type: o,
    slack: m,
  });
  if (o === "Tattered") {
    for (let y = 0; y < 3 + Math.floor(d() * 3); y++) {
      const S = d() * Math.PI * 2,
        P = l * (0.35 + d() * 0.5),
        E = t + Math.cos(S) * P,
        j = n + Math.sin(S) * P,
        A = l * (0.1 + d() * 0.18);
      for (const W of Se.members) {
        if (W.kind !== "spiral" && !(W.kind === "radial" && d() < 0.15))
          continue;
        const se = (Se.x[W.i * 3] + Se.x[W.j * 3]) / 2,
          Qe = (Se.x[W.i * 3 + 1] + Se.x[W.j * 3 + 1]) / 2;
        Math.hypot(se - E, Qe - j) < A * (0.7 + d() * 0.5) && (W.broken = !0);
      }
    }
    G0(Se);
  }
  return Se;
}
function Xo(
  e,
  { cx: o, cy: t, z: n, R: r, node: l, link: i, pinned: d, nodes: g },
) {
  const c = [];
  for (let m = 0; m < 170; m++) {
    const h = Math.pow(e(), 0.7),
      p = e() * Math.PI * 2,
      w = Math.acos(2 * e() - 1);
    c.push(
      l(
        o + Math.sin(w) * Math.cos(p) * r * h,
        t + r * 0.15 + Math.cos(w) * r * 0.75 * h,
        n + Math.sin(w) * Math.sin(p) * r * 0.55 * h,
      ),
    );
  }
  const a = (m) => ({
      x: g[m][0],
      y: g[m][1],
      z: g[m][2],
      d: Math.hypot(g[m][0] - o, g[m][1] - t - r * 0.15, g[m][2] - n),
    }),
    s = [...c].sort((m, h) => a(m).d - a(h).d),
    u = new Set();
  for (let m = 1; m < s.length; m++) {
    let h = s[0],
      p = 1 / 0;
    for (let w = 0; w < m; w++) {
      const b = l0(a(s[m]), a(s[w]));
      b < p && ((p = b), (h = s[w]));
    }
    (i(s[m], h, "tangle"), u.add(s[m] + "," + h));
  }
  for (const m of c)
    for (let h = 0; h < 2; h++) {
      const p = c[Math.floor(e() * c.length)];
      p !== m &&
        l0(a(m), a(p)) < r * 0.7 &&
        !u.has(m + "," + p) &&
        !u.has(p + "," + m) &&
        (i(m, p, "tangle"), u.add(m + "," + p));
    }
  for (let m = 0; m < 9; m++) {
    const h = (m / 9) * Math.PI * 2 + e() * 0.4,
      p = m % 3 === 0 ? 1.8 : 0.2,
      w = l(
        o + Math.cos(h) * r * 2.4,
        t + r * p + Math.sin(h) * r * 1.2,
        n + (e() - 0.5) * r,
      );
    d.push(w);
    let b = c[0],
      k = 1 / 0;
    for (const v of c) {
      const R = a(v),
        C = Math.hypot(
          R.x - (o + Math.cos(h) * r * 2.4),
          R.y - (t + r * p + Math.sin(h) * r * 1.2),
        );
      C < k && ((k = C), (b = v));
    }
    i(b, w, "moor");
  }
  const f = [...c].sort((m, h) => a(m).y - a(h).y).slice(0, 10);
  for (const m of f) {
    const h = a(m),
      p = l(h.x + (e() - 0.5) * 0.1, t - r * 3.2, h.z);
    (d.push(p), i(m, p, "gumfoot"));
  }
  return s[0];
}
const l0 = (e, o) => Math.hypot(e.x - o.x, e.y - o.y, e.z - o.z);
function c0(
  e,
  {
    nodes: o,
    members: t,
    pinned: n,
    cx: r,
    cy: l,
    z: i,
    R: d,
    type: g,
    slack: c,
  },
) {
  const a = o.length,
    s = new Float64Array(a * 3);
  o.forEach((h, p) => {
    ((s[p * 3] = h[0]), (s[p * 3 + 1] = h[1]), (s[p * 3 + 2] = h[2]));
  });
  const u = new Float64Array(a).fill(1);
  for (const h of n) u[h] = 0;
  for (const h of t) {
    const p = Oo[h.kind],
      w = Math.hypot(...[0, 1, 2].map((k) => s[h.i * 3 + k] - s[h.j * 3 + k])),
      b = c && h.kind !== "moor" ? p.pre * 0.3 : p.pre;
    Object.assign(h, {
      cable: !0,
      rest: w * (1 - b),
      comp: (p.comp * w) / 0.1,
      breakAt: p.breakAt,
      len: w,
      strain: b,
      broken: !1,
    });
  }
  const f = Array.from({ length: a }, () => []);
  t.forEach((h, p) => {
    (f[h.i].push(p), f[h.j].push(p));
  });
  const m = {
    n: a,
    x: s,
    prev: new Float64Array(s),
    v: new Float64Array(a * 3),
    inv: u,
    members: t,
    pinned: n,
    hub: e,
    adj: f,
    time: 0,
    cx: r,
    cy: l,
    z: i,
    R: d,
    type: g,
    mass: new Float64Array(a),
  };
  return (G0(m), m);
}
function G0(e) {
  for (const o of e.members) ((o.limit ??= o.breakAt), (o.breakAt = 1 / 0));
  for (let o = 0; o < 150; o++) (Kt(e, 1 / 60), o % 10 === 0 && e.v.fill(0));
  e.v.fill(0);
  for (const o of e.members) ((o.breakAt = o.limit), (o.calm = o.strain));
  e.time = 0;
}
function tt(e, o, t) {
  const { n, adj: r, members: l, x: i } = e,
    d = new Float64Array(n).fill(1 / 0),
    g = new Int32Array(n).fill(-1),
    c = new Uint8Array(n);
  for (d[o] = 0; ; ) {
    let s = -1,
      u = 1 / 0;
    for (let f = 0; f < n; f++) !c[f] && d[f] < u && ((u = d[f]), (s = f));
    if (s < 0 || s === t) break;
    c[s] = 1;
    for (const f of r[s]) {
      const m = l[f];
      if (m.broken || m.kind === "moor" || m.kind === "gumfoot") continue;
      const h = m.i === s ? m.j : m.i,
        p = u + m.len * (m.kind === "spiral" ? 2.5 : 1);
      p < d[h] && ((d[h] = p), (g[h] = s));
    }
  }
  if (!isFinite(d[t])) return null;
  const a = [t];
  for (; a[0] !== o; ) a.unshift(g[a[0]]);
  return a;
}
function St(e, o, t, n = 1 / 0) {
  let r = -1,
    l = n;
  for (let i = 0; i < e.n; i++) {
    if (!e.inv[i]) continue;
    const d = Math.hypot(e.x[i * 3] - o, e.x[i * 3 + 1] - t);
    d < l && e.adj[i].some((g) => !e.members[g].broken) && ((l = d), (r = i));
  }
  return r;
}
function Re(e, o, t) {
  ((e.mass[o] = t), (e.inv[o] = 1 / (1 + t)));
}
const Tt = new Ae(1, 28, 20),
  je = new Ht(0.62, 1, 1, 10, 1).translate(0, 0.5, 0),
  Ho = new Ae(1, 10, 8),
  Qt = {
    "Garden spider": {
      humps: !0,
      abdomen: [0.068, 0.086, 0.06],
      base: ["#2e1a0a", "#a8733a"],
      accent: "#efe0bf",
      folium: 0.68,
      cross: 1,
      legs: ["#24160b", "#9a7448"],
      gloss: 0.12,
      size: 1,
      stance: [
        [0.42, 1],
        [0.95, 0.9],
        [1.75, 0.62],
        [2.5, 0.84],
      ],
    },
    "Wasp spider": {
      flat: !0,
      abdomen: [0.054, 0.1, 0.048],
      base: ["#d9b22c", "#f4dc6a"],
      accent: "#f6f2e4",
      stripes: 1,
      legs: ["#1a140c", "#cdb070"],
      gloss: 0.35,
      size: 1.1,
      stance: [
        [0.28, 1.25],
        [0.42, 1.15],
        [1.95, 0.55],
        [2.78, 1.1],
      ],
    },
    "Pumpkin spider": {
      humps: !0,
      abdomen: [0.078, 0.084, 0.07],
      base: ["#a8410c", "#f39a3c"],
      accent: "#fbe3b0",
      folium: 0.45,
      cross: 0.5,
      legs: ["#5a2a0e", "#e0a060"],
      gloss: 0.2,
      size: 1.05,
      stance: [
        [0.45, 0.95],
        [1, 0.85],
        [1.75, 0.6],
        [2.5, 0.8],
      ],
    },
    "Silver-sided spider": {
      abdomen: [0.05, 0.07, 0.044],
      base: ["#5e5a52", "#cfcac0"],
      accent: "#f2f0ea",
      folium: 0.75,
      legs: ["#3a342c", "#b0a48a"],
      gloss: 0.5,
      size: 0.8,
      stance: [
        [0.4, 1.05],
        [0.95, 0.92],
        [1.75, 0.62],
        [2.5, 0.86],
      ],
    },
    "False widow": {
      abdomen: [0.07, 0.074, 0.062],
      base: ["#170c07", "#4a2716"],
      accent: "#e8d8b4",
      crescent: 1,
      legs: ["#4a200c", "#93542a"],
      gloss: 0.95,
      size: 0.9,
      stance: [
        [0.5, 0.95],
        [1.05, 0.8],
        [1.8, 0.62],
        [2.55, 0.85],
      ],
    },
  },
  Zo = {
    Orb: "Garden spider",
    Argiope: "Wasp spider",
    Zygiella: "Silver-sided spider",
    Tattered: "Pumpkin spider",
    Cobweb: "False widow",
  },
  Pt = {};
function Ko(e) {
  if (Pt[e]) return Pt[e];
  const o = Qt[e],
    t = X,
    n = new ye({
      roughness: 0.6 - o.gloss * 0.4,
      clearcoat: o.gloss,
      clearcoatRoughness: 0.35,
      sheen: 1 - o.gloss * 0.6,
      sheenRoughness: 0.45,
      sheenColor: new F(o.legs[1]),
    }),
    r = ie(t.mul(6))
      .mul(0.5)
      .add(ie(t.mul(19)).mul(0.3))
      .add(0.5)
      .clamp(0, 1),
    l = $(-0.1, 0.45, t.z),
    i = Y(0.5)
      .sub(t.y.mul(t.y).mul(0.3))
      .add(t.y.mul(9).sin().mul(0.04))
      .add(ie(t.mul(11)).mul(0.05)),
    d = Y(1)
      .sub($(i.sub(0.05), i.add(0.02), ue(t.x)))
      .mul(l)
      .mul(o.folium ?? 0),
    g = Y(1)
      .sub($(0, 0.05, ue(ue(t.x).sub(i))))
      .mul(l)
      .mul($(0.1, 0.5, ie(t.mul(30))))
      .mul(o.folium ? 0.7 : 0),
    c = $(0.05, 0.3, ie(t.mul(30))),
    a = Y(1)
      .sub($(0.03, 0.1, ue(t.x)))
      .mul($(-0.25, -0.1, t.y))
      .mul(Y(1).sub($(0.62, 0.75, t.y))),
    s = Y(1)
      .sub($(0.03, 0.08, ue(t.y.sub(0.4))))
      .mul(Y(1).sub($(0.2, 0.3, ue(t.x)))),
    u = Je(a, s)
      .mul(l)
      .mul(c)
      .mul(o.cross ?? 0),
    f = $(
      0.55,
      0.8,
      t.y
        .mul(17)
        .add(ue(t.x).mul(3))
        .add(ie(t.mul(8)).mul(0.6))
        .sin(),
    )
      .mul(l)
      .mul(o.stripes ?? 0),
    m = $(0.45, 0.65, t.y).mul(o.stripes ?? 0),
    h = Y(1)
      .sub($(0.04, 0.1, ue(t.y.sub(0.62).add(t.x.mul(t.x).mul(0.5)))))
      .mul(l)
      .mul(o.crescent ?? 0),
    p = K(Ee(o.base[0]), Ee(o.base[1]), r.mul(r)),
    w = Je(Je(g, u), Je(m, h));
  n.colorNode = K(K(K(p, p.mul(0.3), d), Ee("#120c06"), f), Ee(o.accent), w);
  const b = new ye({
      color: new F(o.legs[0]).lerp(new F(o.base[0]), 0.4),
      roughness: 0.5,
      clearcoat: 0.3,
      sheen: 0.8,
      sheenColor: new F(o.legs[1]),
    }),
    k = new ye({
      roughness: 0.55,
      sheen: 1,
      sheenRoughness: 0.3,
      sheenColor: new F(o.legs[1]),
      clearcoat: 0.3,
    }),
    v = io().y,
    R = $(0.62, 0.72, v).mul(Y(1).sub($(0.86, 0.92, v)));
  k.colorNode = K(Ee(o.legs[0]), Ee(o.legs[1]), R.mul(0.85));
  const C = new Ze({
    color: new F(o.legs[1]).lerp(new F(o.base[1]), 0.3),
    roughness: 0.7,
  });
  return (Pt[e] = { abdomen: n, head: b, leg: k, hair: C });
}
const d0 = new _e({ color: 328707, roughness: 0.05, clearcoat: 1 }),
  At = {};
function f0(e) {
  if (At[e]) return At[e];
  const o = Qt[e],
    t = new Ae(1, 48, 36),
    n = t.attributes.position;
  for (let r = 0; r < n.count; r++) {
    let l = n.getX(r),
      i = n.getY(r),
      d = n.getZ(r);
    const g = Math.max(0, i);
    if (
      ((l *= 1 + g * (o.humps ? 0.18 : 0.06) - Math.max(0, -i - 0.4) * 0.35),
      (d *= 1 - Math.max(0, -i - 0.5) * 0.3),
      o.humps)
    )
      for (const c of [-1, 1]) {
        const a = Math.hypot(l - c * 0.5, i - 0.55, d - 0.62),
          s = Math.exp(-a * a * 22) * 0.16;
        ((l += c * s * 0.4), (i += s * 0.3), (d += s));
      }
    (o.flat && (d *= 0.82), n.setXYZ(r, l, i, d));
  }
  return (t.computeVertexNormals(), (At[e] = t));
}
const h0 = new $0(1, 1, 3, 1).translate(0, 0.5, 0);
function Qo(e, o, t = "Garden spider") {
  const n = Qt[t],
    r = Ko(t),
    l = o * n.size,
    i = new Ce(),
    d = new z(f0(t), r.abdomen);
  (d.scale.set(...n.abdomen).multiplyScalar(l),
    d.position.set(0, -(n.abdomen[1] - 0.016) * l, 0.035 * l));
  const g = new z(Jo, r.head);
  (g.scale.set(0.036, 0.046, 0.024).multiplyScalar(l),
    g.position.set(0, 0.045 * l, 0.028 * l),
    i.add(d, g));
  const c = new z(Tt, r.head);
  (c.scale.set(0.008, 0.01, 0.007).multiplyScalar(l),
    c.position.set(0, -(n.abdomen[1] * 1.95 - 0.016) * l, 0.026 * l),
    i.add(c));
  for (const [C, T, I] of [
    [-0.006, 0.084, 0.0042],
    [0.006, 0.084, 0.0042],
    [-0.0055, 0.0765, 0.0036],
    [0.0055, 0.0765, 0.0036],
    [-0.016, 0.079, 0.003],
    [-0.0175, 0.075, 0.0028],
    [0.016, 0.079, 0.003],
    [0.0175, 0.075, 0.0028],
  ]) {
    const G = new z(Tt, d0);
    (G.scale.setScalar(I * l),
      G.position.set(C * l, T * l, 0.046 * l),
      i.add(G));
  }
  for (const C of [-1, 1]) {
    const T = new z(Tt, r.head);
    (T.scale.set(0.009, 0.016, 0.009).multiplyScalar(l),
      T.position.set(C * 0.008 * l, 0.093 * l, 0.024 * l),
      (T.rotation.x = 0.5),
      i.add(T));
    const I = new z(je, d0);
    (I.scale.set(0.0025 * l, 0.01 * l, 0.0025 * l),
      I.position.set(C * 0.008 * l, 0.105 * l, 0.018 * l),
      I.rotation.set(-0.9, 0, -C * 0.6),
      i.add(I));
  }
  const a = new Nt(h0, r.hair, 520),
    s = new Mt(),
    u = new Zt(),
    f = new M(),
    m = new M(),
    h = f0(t),
    p = h.attributes.position,
    w = h.attributes.normal;
  for (let C = 0; C < a.count; C++) {
    const T = Math.floor(Math.random() * p.count);
    (m.fromBufferAttribute(p, T),
      f.fromBufferAttribute(w, T),
      (f.y -= 0.9),
      f.normalize(),
      u.setFromUnitVectors(wt, f));
    const I = 0.1 + Math.random() * 0.12;
    (s.compose(
      m,
      u,
      new M((0.006 / n.abdomen[0]) * 0.07, I, (0.006 / n.abdomen[2]) * 0.06),
    ),
      a.setMatrixAt(C, s));
  }
  d.add(a);
  const b = [-1, 1].map((C) => {
    const T = new z(je, r.leg);
    return (i.add(T), { p: T, side: C });
  });
  e.add(i);
  const k = [];
  for (const C of [-1, 1])
    n.stance.forEach(([T, I], G) => {
      const Q = I * 0.34 * l,
        U = [
          new z(je, r.leg),
          new z(je, r.leg),
          new z(je, r.leg),
          new z(Ho, r.leg),
          new z(je, r.leg),
        ];
      (U.forEach((H) => e.add(H)),
        k.push({
          side: C,
          ang: T,
          L: Q,
          parts: U,
          a: Q * 0.44,
          b: Q * 0.56,
          group: (G + (C > 0 ? 1 : 0)) % 2,
          foot: new M(),
          node: -1,
          off: new M(),
          step: null,
          planted: !1,
          tap: 0,
        }));
    });
  const v = new Nt(h0, r.hair, 24 * _t);
  ((v.frustumCulled = !1), e.add(v));
  const R = Array.from({ length: _t }, (C, T) => ({
    t: 0.08 + (T / _t) * 0.84 + Math.random() * 0.04,
    a: Math.random() * Math.PI * 2,
    len: T % 4 === 0 ? 0.55 : 0.28 + Math.random() * 0.15,
  }));
  return {
    s: l,
    species: t,
    abY: n.abdomen[1],
    body: i,
    abdomen: d,
    palps: b,
    legs: k,
    spines: v,
    spineAt: R,
    pos: new M(),
    heading: new Ie(0, -1),
    vel: new M(),
    lastPos: null,
    time: Math.random() * 10,
    fidget: 1 + Math.random() * 2,
    tapIn: 2 + Math.random() * 3,
    moving: !1,
    turn: 0,
    parts: [i, v, ...k.flatMap((C) => C.parts)],
  };
}
const _t = 12,
  Jo = (() => {
    const e = new Ae(1, 36, 24),
      o = e.attributes.position;
    for (let t = 0; t < o.count; t++) {
      let n = o.getX(t),
        r = o.getY(t),
        l = o.getZ(t);
      ((n *= 1 - Math.max(0, r) * 0.32),
        (l += 0.12 * Math.max(0, r)),
        (l -= 0.14 * Math.exp(-(n * n + (r + 0.1) ** 2) * 18) * Math.max(0, l)),
        o.setXYZ(t, n, r, l));
    }
    return (e.computeVertexNormals(), e);
  })(),
  Ot = new M(),
  Ut = new M(),
  pe = new M(0, 0, 1),
  $e = new M(),
  me = new M(),
  ke = new M(),
  Be = new M(),
  Ve = new M(),
  It = new M(),
  ct = new M(),
  wt = new M(0, 1, 0),
  u0 = new Mt(),
  Et = (e, o, t, n, r) =>
    r
      .copy(e.pos)
      .addScaledVector(Ut, o)
      .addScaledVector(Ot, t)
      .addScaledVector(pe, n);
function ot(e, o, t, n) {
  ct.subVectors(t, o);
  const r = ct.length() || 1e-6;
  (e.position.copy(o),
    e.quaternion.setFromUnitVectors(wt, ct.divideScalar(r)),
    e.scale.set(n, r, n));
}
function Lo(e, o, t) {
  const n = e.s;
  ((e.time += t),
    Ot.set(e.heading.x, e.heading.y, 0),
    Ut.set(e.heading.y, -e.heading.x, 0),
    e.lastPos
      ? e.vel.subVectors(e.pos, e.lastPos).divideScalar(Math.max(t, 1e-4))
      : e.vel.set(0, 0, 0),
    (e.lastPos = (e.lastPos ?? new M()).copy(e.pos)));
  const r = e.vel.length();
  (u0.makeBasis(Ut, Ot, pe), e.body.quaternion.setFromRotationMatrix(u0));
  const l = e.moving
    ? Math.sin(e.time * 28) * 0.004 * n
    : Math.sin(e.time * 1.7) * 0.0015 * n;
  (e.body.position.copy(e.pos).addScaledVector(pe, 0.012 * n + l),
    (e.abdomen.rotation.z +=
      (Me.clamp(-e.turn * 0.08, -0.35, 0.35) - e.abdomen.rotation.z) *
      Math.min(1, t * 6)),
    (e.abdomen.scale.y = e.abY * n * (1 + Math.sin(e.time * 2.2) * 0.015)));
  for (const { p: c, side: a } of e.palps) {
    const s = Math.sin(e.time * (e.moving ? 18 : 3) + a) * 0.012 * n;
    (c.position.set(a * 0.012 * n, 0.085 * n, 0.03 * n),
      c.quaternion.setFromUnitVectors(
        wt,
        ct.set(a * 0.35, 1, 0.3 + s * 20).normalize(),
      ),
      c.scale.set(0.006 * n, 0.035 * n, 0.006 * n));
  }
  e.fidget -= t;
  let i = -1;
  (!e.moving &&
    e.fidget <= 0 &&
    ((e.fidget = 0.8 + Math.random() * 2.5),
    (i = Math.floor(Math.random() * 8))),
    (e.tapIn -= t),
    !e.moving &&
      e.tapIn <= 0 &&
      ((e.tapIn = 2 + Math.random() * 4),
      (e.legs[Math.random() < 0.5 ? 0 : 4].tap = 0.45)));
  const d = [!1, !1];
  for (const c of e.legs) c.step && (d[c.group] = !0);
  let g = 0;
  (e.legs.forEach((c, a) => {
    Et(
      e,
      c.side * 0.022 * n * Math.sin(c.ang) + c.side * 0.01 * n,
      0.045 * n + Math.cos(c.ang) * 0.016 * n,
      0.025 * n,
      $e,
    );
    const s = c.L * 0.8;
    (Et(
      e,
      c.side * Math.sin(c.ang) * s,
      0.045 * n + Math.cos(c.ang) * s,
      0,
      me,
    ),
      me.addScaledVector(e.vel, 0.09),
      (me.z = e.pos.z),
      c.planted &&
        c.node >= 0 &&
        c.foot
          .set(o.x[c.node * 3], o.x[c.node * 3 + 1], o.x[c.node * 3 + 2])
          .add(c.off),
      !c.planted && !c.step && (c.foot.copy(me), y0(c, o, me, n)));
    const u = c.foot.distanceTo(me),
      f = c.L * (e.moving ? 0.34 : 0.55);
    if (
      (!c.step &&
        !d[1 - c.group] &&
        (u > f || a === i) &&
        ((c.step = {
          from: c.foot.clone(),
          t: 0,
          len: e.moving ? Math.max(0.07, 0.11 - r * 0.02) : 0.22,
        }),
        (c.planted = !1),
        (d[c.group] = !0)),
      c.step)
    ) {
      c.step.t += t / c.step.len;
      const b = Math.min(1, c.step.t),
        k = b * b * (3 - 2 * b);
      (c.foot
        .copy(c.step.from)
        .lerp(me, k)
        .addScaledVector(pe, Math.sin(Math.PI * b) * 0.05 * n),
        b >= 1 && ((c.step = null), y0(c, o, me, n)));
    } else
      c.tap > 0 &&
        ((c.tap -= t),
        c.foot.addScaledVector(
          pe,
          Math.sin(Math.PI * Math.min(1, (0.45 - c.tap) / 0.45)) * 0.045 * n,
        ));
    Ve.subVectors(c.foot, $e);
    const m = Math.min(Ve.length(), (c.a + c.b) * 0.995) || 1e-5;
    Ve.normalize();
    const h = (c.a * c.a - c.b * c.b + m * m) / (2 * m),
      p = Math.sqrt(Math.max(0, c.a * c.a - h * h));
    (It.copy(pe).addScaledVector(Ve, -Ve.dot(pe)).normalize(),
      ke.copy($e).addScaledVector(Ve, h).addScaledVector(It, p),
      Be.copy(ke)
        .lerp(c.foot, 0.66)
        .addScaledVector(It, c.b * 0.08));
    const w = 0.0085 * n * (c.L / (0.34 * n));
    (Et(
      e,
      c.side * 0.012 * n * Math.sin(c.ang) + c.side * 0.004 * n,
      0.045 * n + Math.cos(c.ang) * 0.008 * n,
      0.022 * n,
      m0,
    ),
      ot(c.parts[4], m0, $e, w * 1.25),
      ot(c.parts[0], $e, ke, w),
      ot(c.parts[1], ke, Be, w * 0.72),
      ot(c.parts[2], Be, c.foot, w * 0.5),
      c.parts[3].position.copy(ke),
      c.parts[3].scale.setScalar(w * 0.8),
      [
        [$e, ke, w],
        [ke, Be, w * 0.72],
        [Be, c.foot, w * 0.5],
      ].forEach(([b, k, v], R) => {
        ve.subVectors(k, b);
        const C = ve.length();
        (ve.divideScalar(C || 1),
          jt.crossVectors(ve, pe).normalize(),
          p0.crossVectors(ve, jt));
        for (const T of e.spineAt) {
          const I = Math.cos(T.a),
            G = Math.sin(T.a);
          ($t.copy(jt).multiplyScalar(I).addScaledVector(p0, G),
            g0
              .copy(b)
              .addScaledVector(ve, C * T.t)
              .addScaledVector($t, v * 0.8),
            w0
              .copy($t)
              .multiplyScalar(0.55)
              .addScaledVector(ve, 0.85)
              .normalize(),
            b0.setFromUnitVectors(wt, w0),
            e.spines.setMatrixAt(
              g++,
              en.compose(
                g0,
                b0,
                tn.set(
                  v * 0.18,
                  v * 4.2 * T.len * (R === 2 ? 0.7 : 1),
                  v * 0.18,
                ),
              ),
            ));
        }
      }));
  }),
    (e.spines.instanceMatrix.needsUpdate = !0));
}
const m0 = new M(),
  ve = new M(),
  jt = new M(),
  p0 = new M(),
  $t = new M(),
  g0 = new M(),
  w0 = new M(),
  b0 = new Zt(),
  en = new Mt(),
  tn = new M();
function y0(e, o, t, n) {
  ((e.planted = !0),
    (e.node = St(o, t.x, t.y, 0.12 * n)),
    e.node >= 0
      ? e.off.set(
          t.x - o.x[e.node * 3],
          t.y - o.x[e.node * 3 + 1],
          t.z - o.x[e.node * 3 + 2],
        )
      : e.off.set(0, 0, 0),
    e.node < 0 && e.foot.copy(t));
}
const N = new URLSearchParams(location.search),
  he = N.has("thumb");
he && document.body.classList.add("capture");
const dt = ["garden", "wood", "lamp"];
let _ = dt.includes(N.get("scene")) ? N.get("scene") : "garden";
const x = {
  every: 3.2,
  tension: !0,
  dew: !0,
  glow: 2.4,
  glint: 1.25,
  droop: 1,
  dewSize: 1,
  spiderSpeed: 1,
  mend: !0,
  parallax: 1,
  timeScale: 1,
  auto: !0,
  travelEvery: 40,
};
let Oe = N.has("seed") ? Number(N.get("seed")) : 14;
const xe = await lo({ shadows: !0 });
xe.setPixelRatio(Math.min(devicePixelRatio, 2));
const q = xe.domElement;
q.id = "view";
q.setAttribute("tabindex", "0");
const te = new V0(),
  Jt = 9,
  D = new Mo(35, innerWidth / innerHeight, 0.1, 100);
D.position.set(0, 0, Jt);
const He = new M(),
  le = new M();
function on(e) {
  if (_ === "wood") return nn(e);
  if (_ === "lamp") return mn(e);
  const o = document.createElement("canvas");
  ((o.width = 1280), (o.height = 800));
  const t = o.getContext("2d"),
    n = o.width,
    r = o.height,
    l = t.createLinearGradient(0, 0, 0, r);
  (l.addColorStop(0, "#2a3027"),
    l.addColorStop(0.5, "#1b2019"),
    l.addColorStop(1, "#262117"),
    (t.fillStyle = l),
    t.fillRect(0, 0, n, r));
  const i = t.createRadialGradient(
    n * 0.8,
    r * 0.14,
    0,
    n * 0.8,
    r * 0.14,
    n * 0.65,
  );
  (i.addColorStop(0, "rgba(236,206,150,0.42)"),
    i.addColorStop(0.3, "rgba(180,150,100,0.14)"),
    i.addColorStop(1, "rgba(0,0,0,0)"),
    (t.fillStyle = i),
    t.fillRect(0, 0, n, r),
    (t.filter = "blur(40px)"));
  for (let g = 0; g < 22; g++) {
    const c = e();
    ((t.fillStyle = `rgba(${58 + c * 30},${66 + c * 30},${50 + c * 18},${0.18 + e() * 0.22})`),
      t.beginPath(),
      t.arc(e() * n, e() * r * 0.8, 80 + e() * 200, 0, 7),
      t.fill());
  }
  ((t.filter = "blur(16px)"), (t.lineCap = "round"));
  for (let g = 0; g < 5; g++) {
    ((t.strokeStyle = `rgba(16,18,13,${0.35 + e() * 0.3})`),
      (t.lineWidth = 14 + e() * 30));
    const c = e() * n;
    (t.beginPath(),
      t.moveTo(c, -40),
      t.bezierCurveTo(
        c + (e() - 0.5) * 400,
        r * 0.4,
        c + (e() - 0.5) * 500,
        r * 0.7,
        c + (e() - 0.5) * 600,
        r + 40,
      ),
      t.stroke());
  }
  t.filter = "blur(3px)";
  for (let g = 0; g < 70; g++) {
    const c = e() * n,
      a = r * (0.15 + e() * 0.35),
      s = (e() - 0.5) * 120,
      u = e() < 0.25;
    ((t.strokeStyle = u
      ? `rgba(200,180,120,${0.18 + e() * 0.2})`
      : `rgba(28,34,22,${0.4 + e() * 0.3})`),
      (t.lineWidth = 1.5 + e() * 3),
      t.beginPath(),
      t.moveTo(c, r + 10),
      t.quadraticCurveTo(c + s * 0.3, r - a * 0.6, c + s, r - a),
      t.stroke());
  }
  t.filter = "blur(2px)";
  for (let g = 0; g < 24; g++) {
    const c = n * (0.5 + e() * 0.5),
      a = r * e() * 0.6,
      s = 8 + e() * 24,
      u = 0.05 + e() * 0.12;
    ((t.fillStyle = `rgba(240,214,160,${u})`),
      t.beginPath(),
      t.arc(c, a, s, 0, 7),
      t.fill(),
      (t.strokeStyle = `rgba(250,226,176,${u * 1.4})`),
      (t.lineWidth = 1.5),
      t.stroke());
  }
  ((t.filter = "none"),
    (t.fillStyle = "rgba(210,190,150,0.05)"),
    t.fillRect(0, 0, n, r));
  const d = new ne(o);
  return ((d.colorSpace = ae), d);
}
function nn(e) {
  const o = document.createElement("canvas");
  ((o.width = 1280), (o.height = 800));
  const t = o.getContext("2d"),
    n = o.width,
    r = o.height,
    l = t.createLinearGradient(0, 0, n, r);
  (l.addColorStop(0, "#1d262a"),
    l.addColorStop(0.5, "#121a1b"),
    l.addColorStop(1, "#0c0f0d"),
    (t.fillStyle = l),
    t.fillRect(0, 0, n, r));
  const i = t.createRadialGradient(
    n * 0.95,
    r * 0.3,
    0,
    n * 0.95,
    r * 0.3,
    n * 0.7,
  );
  (i.addColorStop(0, "rgba(240,196,130,0.5)"),
    i.addColorStop(0.4, "rgba(150,120,90,0.14)"),
    i.addColorStop(1, "rgba(0,0,0,0)"),
    (t.fillStyle = i),
    t.fillRect(0, 0, n, r));
  for (const [g, c, a, s] of [
    [7, 30, [70, 84, 88], 0.5],
    [6, 14, [34, 40, 40], 0.7],
    [4, 6, [16, 18, 17], 0.85],
  ]) {
    t.filter = `blur(${c}px)`;
    for (let u = 0; u < g; u++) {
      const f = e() * n,
        m = 20 + e() * 70 * (c < 10 ? 2 : 1);
      ((t.fillStyle = `rgba(${a[0]},${a[1]},${a[2]},${s})`),
        t.beginPath(),
        t.moveTo(f, -20),
        t.lineTo(f + m, -20),
        t.lineTo(f + m * 1.15 + (e() - 0.5) * 60, r + 20),
        t.lineTo(f - m * 0.15 + (e() - 0.5) * 60, r + 20),
        t.fill());
    }
  }
  t.filter = "blur(22px)";
  for (let g = 0; g < 6; g++) {
    const c = n * (0.45 + e() * 0.55),
      a = 30 + e() * 90,
      s = t.createLinearGradient(0, 0, 0, r);
    (s.addColorStop(0, `rgba(255,214,150,${0.1 + e() * 0.12})`),
      s.addColorStop(1, "rgba(255,214,150,0)"),
      (t.fillStyle = s),
      t.beginPath(),
      t.moveTo(c, -10),
      t.lineTo(c + a, -10),
      t.lineTo(c + a - 380, r),
      t.lineTo(c - 380 - a * 0.5, r),
      t.fill());
  }
  t.filter = "blur(1.5px)";
  for (let g = 0; g < 60; g++)
    ((t.fillStyle = `rgba(255,226,180,${0.08 + e() * 0.25})`),
      t.beginPath(),
      t.arc(n * (0.4 + e() * 0.6), r * e() * 0.8, 1 + e() * 2.5, 0, 7),
      t.fill());
  t.filter = "none";
  const d = new ne(o);
  return ((d.colorSpace = ae), d);
}
const q0 = {
    garden: {
      sun: [0.55, 0.5, -0.67],
      sunCol: 16767392,
      sunI: 3.2,
      fillCol: 13162688,
      fillI: 0.7,
      fillAt: [-2, 1, 8],
      sky: 5269578,
      ground: 1709068,
      hemi: 0.6,
      shadows: !1,
      grade: [0.85, 1.03, 0.2],
      env: ["#0d150f", [9, 7, 4], [0.25, 0.4, 0.28]],
    },
    wood: {
      sun: [0.82, 0.3, -0.48],
      sunCol: 16761466,
      sunI: 5.5,
      fillCol: 9086664,
      fillI: 0.95,
      fillAt: [-6, 2, 8],
      sky: 3820122,
      ground: 1314570,
      hemi: 0.35,
      shadows: !0,
      grade: [0.9, 1.1, 0.32],
      env: ["#0b0f10", [9, 6, 3.5], [0.15, 0.2, 0.28]],
    },
    lamp: {
      sun: [-0.3, 0.6, 0.3],
      sunCol: 16756832,
      sunI: 0,
      fillCol: 6059176,
      fillI: 0.22,
      fillAt: [-4, 3, 8],
      sky: 1713216,
      ground: 657414,
      hemi: 0.22,
      shadows: !1,
      grade: [0.95, 1.12, 0.42],
      env: ["#04060a", [12, 7, 3], [0.03, 0.045, 0.09]],
    },
  },
  oe = new W0(),
  ft = new W0(),
  ht = new xo(),
  bt = new So(16753746, 0, 0, 2);
te.add(oe, oe.target, ft, ht, bt);
oe.shadow.mapSize.set(2048, 2048);
oe.shadow.bias = -5e-4;
oe.shadow.normalBias = 0.04;
Object.assign(oe.shadow.camera, {
  left: -8,
  right: 8,
  top: 8,
  bottom: -8,
  near: 1,
  far: 50,
});
const nt = {};
function an(e) {
  if (nt[e]) return nt[e];
  const o = q0[e],
    t = new V0();
  t.background = new F(o.env[0]);
  const n = (l, i, d, g) => {
    const c = new z(new fe(l, i), new De({ color: new F(...g) }));
    (c.position.copy(d).normalize().multiplyScalar(10),
      c.lookAt(0, 0, 0),
      t.add(c));
  };
  (n(e === "lamp" ? 2 : 4, e === "lamp" ? 2 : 4, new M(...o.sun), o.env[1]),
    n(14, 4, new M(0, 1, 0.2), o.env[2]),
    n(
      6,
      6,
      new M(-0.3, 0.2, 1),
      o.env[2].map((l) => l * 1.6),
    ));
  const r = new yo(xe);
  return ((nt[e] = r.fromScene(t, 0.02).texture), r.dispose(), nt[e]);
}
function sn() {
  const e = q0[_];
  (He.set(...e.sun).normalize(),
    oe.color.set(e.sunCol),
    (oe.intensity = e.sunI),
    oe.position.copy(He).multiplyScalar(20),
    (oe.castShadow = e.shadows),
    ft.color.set(e.fillCol),
    (ft.intensity = e.fillI),
    ft.position.set(...e.fillAt),
    ht.color.set(e.sky),
    ht.groundColor.set(e.ground),
    (ht.intensity = e.hemi),
    (bt.intensity = 0),
    (te.environment = an(_)));
  const [o, t, n] = e.grade;
  ((Te.look.saturation.value = o),
    (Te.look.contrast.value = t),
    (Te.look.vignette.value = n));
}
const B0 = co(new ko()),
  Yt = fo(new M()),
  Lt = new ho({ fog: !1 });
{
  const e = uo,
    o = mo,
    t = zt(e, o).clamp(0, 1),
    n = po(a0.x, a0.y.oneMinus()),
    r = B0.sample(n.sub(e.xy.mul(0.14)))
      .rgb.mul(1.55)
      .add(0.02),
    l = Y(1).sub($(0, 0.22, t)),
    i = go(o.negate(), e),
    d = zt(i, Yt).max(0),
    g = Le(d, 700).mul(30).add(Le(d, 60).mul(0.35)),
    c = zt(
      e,
      Yt.negate()
        .add(O(0, 0, 0.6))
        .normalize(),
    ).max(0),
    a = Le(c, 140).mul(9).add(Le(c, 14).mul(0.9)),
    s = $(0.2, 0.9, e.y).mul(l.oneMinus()).mul(0.05);
  Lt.colorNode = K(r, r.mul(0.18), l)
    .add(O(1, 0.88, 0.66).mul(g.add(a)))
    .add(s);
}
const rn = new vo({
    vertexColors: !0,
    transparent: !0,
    depthWrite: !1,
    blending: xt,
    fog: !1,
  }),
  N0 = new ye({
    roughness: 0.8,
    sheen: 0.7,
    sheenRoughness: 0.4,
    sheenColor: new F(16777215),
  });
N0.colorNode = K(
  O(0.55, 0.52, 0.46),
  O(0.78, 0.75, 0.68),
  X.y.mul(70).add(X.x.mul(25)).sin().mul(0.5).add(0.5),
);
const at = new Ze({ color: 5913890, roughness: 0.85 }),
  re = new Ht(1, 1, 1, 8, 1).translate(0, 0.5, 0),
  B = new Ae(1, 16, 12);
(() => {
  const e = new Co();
  return (
    e.moveTo(0, -1),
    e.bezierCurveTo(0.7, -0.6, 0.65, 0.5, 0, 1),
    e.bezierCurveTo(-0.65, 0.5, -0.7, -0.6, 0, -1),
    new zo(e, 10)
  );
})();
const Vt = new M(),
  st = new M(),
  rt = new M(),
  M0 = new Zt(),
  x0 = new Mt(),
  S0 = new M(),
  L = new F(),
  k0 = new F();
let O0 = [],
  V = [],
  we,
  ze,
  Z = [],
  We = [],
  ee = [],
  ut = [],
  J = null,
  e0 = 0,
  mt = 0,
  yt = 0,
  pt = 1.5;
const Ye = 16e3,
  ln = new Ae(1, 14, 10);
function be(e) {
  const o = (Jt - e) * Math.tan(Me.degToRad(D.fov / 2));
  return [o * D.aspect, o];
}
function Wt(e, o) {
  const t = (c, a) => {
      const s = Math.sin(c * 127.1 + a * 311.7) * 43758.5453;
      return s - Math.floor(s);
    },
    n = Math.floor(e),
    r = Math.floor(o),
    l = e - n,
    i = o - r,
    d = l * l * (3 - 2 * l),
    g = i * i * (3 - 2 * i);
  return (
    (t(n, r) * (1 - d) + t(n + 1, r) * d) * (1 - g) +
    (t(n, r + 1) * (1 - d) + t(n + 1, r + 1) * d) * g
  );
}
const Xt = (e, o) =>
    Wt(e, o) * 0.55 + Wt(e * 2.1, o * 2.1) * 0.28 + Wt(e * 4.3, o * 4.3) * 0.17,
  it = (e, o) => {
    const t = new Ro().load(
      new URL(
        Object.assign({
          "./textures/bark_brown_02_arm_1k.jpg": Go,
          "./textures/bark_brown_02_diff_1k.jpg": qo,
          "./textures/bark_brown_02_disp_1k.jpg": Bo,
          "./textures/bark_brown_02_nor_gl_1k.jpg": No,
        })[`./textures/bark_brown_02_${e}_1k.jpg`],
        import.meta.url,
      ).href,
    );
    return (
      (t.wrapS = t.wrapT = Fo),
      t.repeat.set(2, 5),
      (t.anisotropy = 8),
      o && (t.colorSpace = ae),
      t
    );
  };
let cn = null;
const U0 = () =>
  (cn ??= (() => {
    const e = it("arm");
    return new Ze({
      map: it("diff", !0),
      normalMap: it("nor_gl"),
      normalScale: new Ie(1.6, 1.6),
      aoMap: e,
      roughnessMap: e,
      displacementMap: it("disp"),
      displacementScale: 0.16,
      displacementBias: -0.08,
      vertexColors: !0,
    });
  })());
function dn(e, o, t, n = -0.15, r = !1) {
  const l = o * 4,
    i = new Ht(e.r, e.r * 1.15, l, r ? 48 : 160, r ? 60 : 240, !0),
    d = i.attributes.position,
    g = new Float32Array(d.count * 3),
    c = t() * 50;
  for (let s = 0; s < d.count; s++) {
    const u = d.getX(s),
      f = d.getY(s),
      m = d.getZ(s),
      h = Math.atan2(m, u),
      p = 1 + (Xt(h * 1.2 + c, f * 0.25) - 0.5) * 0.25;
    d.setXYZ(s, u * p, f, m * p);
    const w = Me.smoothstep(-f / l, -0.1, 0.4),
      b = w * Xt(h * 2 + 3, f * 0.6) * 1.4;
    g.set(
      [1 - w * 0.35 - b * 0.25, 1 - w * 0.25, 1 - w * 0.4 - b * 0.35],
      s * 3,
    );
  }
  (i.setAttribute("color", new gt(g, 3)), i.computeVertexNormals());
  const a = new z(i, U0());
  return (
    (a.castShadow = a.receiveShadow = !r),
    a.position.set(e.x, 0, n),
    (a.rotation.z = -e.lean),
    a
  );
}
const ge = new wo({ metalness: 0.55, roughness: 0.7 });
ge.colorNode = K(
  O(0.05, 0.048, 0.045),
  O(0.32, 0.13, 0.05),
  $(
    0.45,
    0.75,
    ie(X.mul(9))
      .mul(0.5)
      .add(ie(X.mul(40)).mul(0.25))
      .add(0.5),
  ),
);
const fn = new _e({
    color: 16764810,
    emissive: 16751164,
    emissiveIntensity: 0.9,
    transparent: !0,
    opacity: 0.32,
    roughness: 0.3,
    side: Ke,
    depthWrite: !1,
  }),
  hn = new De({ color: new F(9, 5.2, 1.8) }),
  Y0 = (() => {
    const e = document.createElement("canvas");
    e.width = e.height = 256;
    const o = e.getContext("2d"),
      t = o.createRadialGradient(128, 128, 0, 128, 128, 128);
    return (
      t.addColorStop(0, "rgba(255,200,130,0.9)"),
      t.addColorStop(0.15, "rgba(255,170,90,0.35)"),
      t.addColorStop(0.5, "rgba(255,140,60,0.08)"),
      t.addColorStop(1, "rgba(0,0,0,0)"),
      (o.fillStyle = t),
      o.fillRect(0, 0, 256, 256),
      new ne(e)
    );
  })();
function un(e, o, t) {
  const n = new Ce(),
    r = (w, b, k, v, R, C, T = 0) => {
      const I = new z(new r0(w, b, k), v);
      return (I.position.set(R, C, T), n.add(I), I);
    },
    l = o * 4,
    i = new r0(e.w, l, e.w, 6, 120, 6);
  i.setAttribute(
    "color",
    new gt(new Float32Array(i.attributes.position.count * 3).fill(0.62), 3),
  );
  const d = new z(i, U0());
  (d.position.set(e.x, -o * 0.6, -0.25), n.add(d));
  const g = o * 0.62,
    c = e.x - 1.25;
  r(1.35, 0.045, 0.045, ge, e.x - 0.67, g, -0.2);
  const a = new z(new Wo(0.32, 0.018, 8, 40, Math.PI / 2), ge);
  (a.position.set(e.x - e.w / 2, g - 0.32, -0.2),
    (a.rotation.z = Math.PI / 2),
    n.add(a));
  const s = c + 0.05,
    u = g - 0.12;
  r(0.012, 0.12, 0.012, ge, s, g - 0.06, -0.2);
  const f = new z(new $0(0.24, 0.2, 4), ge);
  ((f.rotation.y = Math.PI / 4),
    f.position.set(s, u - 0.08, -0.2),
    n.add(f),
    r(0.36, 0.03, 0.36, ge, s, u - 0.18, -0.2),
    r(0.3, 0.035, 0.3, ge, s, u - 0.62, -0.2));
  for (const [w, b] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    r(0.022, 0.44, 0.022, ge, s + w * 0.15, u - 0.4, -0.2 + b * 0.15);
  for (const [w, b, k] of [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, Math.PI / 2],
    [-1, 0, Math.PI / 2],
  ]) {
    const v = new z(new fe(0.28, 0.42), fn);
    (v.position.set(s + w * 0.15, u - 0.4, -0.2 + b * 0.15),
      (v.rotation.y = k),
      n.add(v));
  }
  const m = new M(s, u - 0.42, -0.2),
    h = new z(new Ae(1, 16, 12), hn);
  (h.scale.set(0.035, 0.07, 0.035), h.position.copy(m), n.add(h));
  const p = new R0(
    new F0({ map: Y0, blending: xt, depthWrite: !1, transparent: !0 }),
  );
  return (
    p.scale.setScalar(3.4),
    p.position.copy(m),
    n.add(p),
    { group: n, flame: m, armY: g, armX0: c }
  );
}
function mn(e) {
  const o = document.createElement("canvas");
  ((o.width = 1280), (o.height = 800));
  const t = o.getContext("2d"),
    n = o.width,
    r = o.height,
    l = t.createLinearGradient(0, 0, 0, r);
  (l.addColorStop(0, "#05070d"),
    l.addColorStop(0.6, "#0a0e18"),
    l.addColorStop(1, "#120e0c"),
    (t.fillStyle = l),
    t.fillRect(0, 0, n, r),
    (t.filter = "blur(26px)"));
  for (let d = 0; d < 8; d++)
    ((t.fillStyle = `rgba(2,3,5,${0.5 + e() * 0.4})`),
      t.beginPath(),
      t.arc(e() * n, r * (0.3 + e() * 0.5), 120 + e() * 220, 0, 7),
      t.fill());
  t.filter = "blur(4px)";
  for (let d = 0; d < 22; d++) {
    const g = e() * n,
      c = r * (0.45 + e() * 0.4),
      a = 4 + e() * 18,
      s = e() < 0.7;
    ((t.fillStyle = s
      ? `rgba(255,190,110,${0.08 + e() * 0.18})`
      : `rgba(150,180,255,${0.05 + e() * 0.1})`),
      t.beginPath(),
      t.arc(g, c, a, 0, 7),
      t.fill());
  }
  t.filter = "none";
  const i = new ne(o);
  return ((i.colorSpace = ae), i);
}
const pn = (() => {
    const e = document.createElement("canvas");
    ((e.width = 256), (e.height = 512));
    const o = e.getContext("2d");
    o.filter = "blur(14px)";
    for (let n = 0; n < 4; n++) {
      const r = 40 + n * 55,
        l = (Math.random() - 0.3) * 120;
      ((o.fillStyle = `rgba(12,16,10,${0.75 + Math.random() * 0.2})`),
        o.beginPath(),
        o.moveTo(r - 14, 530),
        o.quadraticCurveTo(r + l * 0.3, 260, r + l, 20),
        o.quadraticCurveTo(r + l * 0.3 + 10, 260, r + 16, 530),
        o.fill(),
        (o.strokeStyle = "rgba(210,180,120,0.35)"),
        (o.lineWidth = 5),
        o.beginPath(),
        o.moveTo(r + 14, 530),
        o.quadraticCurveTo(r + l * 0.3 + 9, 260, r + l + 2, 30),
        o.stroke());
    }
    const t = new ne(e);
    return ((t.colorSpace = ae), t);
  })(),
  gn = new De({ map: pn, transparent: !0, depthWrite: !1 });
function wn(e) {
  const [o, t] = be(5.5);
  return [-1, 1].map((n) => {
    const r = new z(new fe(1, 2), gn);
    return (
      r.scale.setScalar(t * (0.9 + e() * 0.4)),
      r.position.set(n * o * (0.75 + e() * 0.2), -t * 0.62, 5.5),
      (r.scale.x *= n),
      r
    );
  });
}
function bn(e, o) {
  const t = document.createElement("canvas");
  ((t.width = 256), (t.height = 512));
  const n = t.getContext("2d"),
    r = Pe(e.length * 31 + o);
  if (((n.filter = `blur(${o}px)`), e === "meadow"))
    for (let i = 0; i < 7; i++) {
      const d = 30 + r() * 196,
        g = 40 + r() * 240,
        c = (r() - 0.5) * 60;
      ((n.strokeStyle = `rgba(150,150,110,${0.5 + r() * 0.3})`),
        (n.lineWidth = 3 + r() * 3),
        n.beginPath(),
        n.moveTo(d, 520),
        n.quadraticCurveTo(d + c * 0.4, (520 + g) / 2, d + c, g),
        n.stroke(),
        (n.fillStyle = `rgba(240,228,190,${0.55 + r() * 0.3})`));
      for (let a = 0; a < 14; a++)
        (n.beginPath(),
          n.arc(
            d + c + (r() - 0.5) * 34,
            g + (r() - 0.6) * 16,
            3 + r() * 4,
            0,
            7,
          ),
          n.fill());
    }
  else if (e === "fern")
    for (let i = 0; i < 5; i++) {
      const d = r() * 256,
        g = -Math.PI / 2 + (r() - 0.5) * 1.2,
        c = 260 + r() * 200;
      ((n.strokeStyle = "rgba(28,40,24,0.9)"), (n.lineWidth = 4));
      for (let a = 0; a < 1; a += 0.06) {
        const s = d + Math.cos(g) * c * a,
          u = 520 + Math.sin(g) * c * a,
          f = (1 - a) * 60;
        (n.beginPath(),
          n.moveTo(s, u),
          n.lineTo(s + f, u - 20),
          n.moveTo(s, u),
          n.lineTo(s - f, u - 20),
          n.stroke());
      }
    }
  else {
    n.fillStyle = "rgba(2,3,6,0.95)";
    for (let i = 0; i < 3; i++) {
      const d = 40 + r() * 176,
        g = 14 + r() * 30;
      n.fillRect(d - g / 2, 120, g, 400);
      for (let c = 0; c < 8; c++)
        (n.beginPath(),
          n.arc(d + (r() - 0.5) * 160, 60 + r() * 200, 30 + r() * 50, 0, 7),
          n.fill());
    }
  }
  const l = new ne(t);
  return ((l.colorSpace = ae), l);
}
const yn = {},
  Mn = (e, o) =>
    (yn[e + o] ??= new De({
      map: bn(e, o),
      color: e === "meadow" ? 7368806 : 16777215,
      transparent: !0,
      depthWrite: !1,
      fog: !0,
    }));
function xn(e) {
  const o = document.createElement("canvas");
  ((o.width = 128), (o.height = 512));
  const t = o.getContext("2d"),
    n = Pe(e * 7);
  ((t.filter = `blur(${e}px)`),
    (t.fillStyle = "#26221d"),
    t.fillRect(28, -20, 72, 560));
  for (let i = 0; i < 18; i++)
    ((t.fillStyle = `rgba(${n() < 0.5 ? "12,10,8" : "60,54,46"},0.5)`),
      t.fillRect(30 + n() * 64, n() * 512, 2 + n() * 4, 40 + n() * 140));
  const r = t.createLinearGradient(80, 0, 102, 0);
  (r.addColorStop(0, "rgba(255,200,130,0)"),
    r.addColorStop(1, "rgba(255,200,130,0.55)"),
    (t.fillStyle = r),
    t.fillRect(80, -20, 22, 560));
  const l = new ne(o);
  return ((l.colorSpace = ae), l);
}
const Sn = {},
  kn = (e) =>
    (Sn[e] ??= new De({
      map: xn(e === "near" ? 5 : 11),
      color: e === "near" ? 9079428 : 10465462,
      transparent: !0,
      depthWrite: !1,
      fog: !0,
    })),
  vn = new De({
    map: (() => {
      const e = document.createElement("canvas");
      ((e.width = 64), (e.height = 256));
      const o = e.getContext("2d"),
        t = o.createLinearGradient(0, 0, 64, 0);
      (t.addColorStop(0, "rgba(255,214,150,0)"),
        t.addColorStop(0.5, "rgba(255,214,150,0.16)"),
        t.addColorStop(1, "rgba(255,214,150,0)"),
        (o.fillStyle = t),
        o.fillRect(0, 0, 64, 256));
      const n = o.createLinearGradient(0, 0, 0, 256);
      (n.addColorStop(0, "rgba(0,0,0,0)"),
        n.addColorStop(1, "rgba(0,0,0,1)"),
        (o.globalCompositeOperation = "destination-out"),
        (o.fillStyle = n),
        o.fillRect(0, 0, 64, 256));
      const r = new ne(e);
      return ((r.colorSpace = ae), r);
    })(),
    blending: xt,
    transparent: !0,
    depthWrite: !1,
    fog: !1,
  }),
  Cn = {
    garden: [3159596, 10, 34],
    wood: [1844777, 11, 32],
    lamp: [395277, 9, 30],
  };
function zn(e) {
  const o = [],
    t = _ === "garden" ? "meadow" : _ === "wood" ? "fern" : "night";
  if (_ === "wood") {
    for (let n = 0; n < 16; n++) {
      const r = e(),
        l = -3 - r * 20,
        [i, d] = be(l),
        g = (e() * 2 - 1) * i;
      if (r < 0.3 && Math.abs(g) < i * 0.3) continue;
      const c = d * (0.14 + e() * 0.16) * (1.2 - r * 0.4),
        a = new z(new fe(c, d * 2.6), kn(r < 0.45 ? "near" : "far"));
      (a.position.set(g, 0, l), (a.rotation.z = (e() - 0.5) * 0.05), o.push(a));
    }
    for (let n = 0; n < 5; n++) {
      const r = -5 - e() * 12,
        [l, i] = be(r),
        d = new z(new fe(i * (0.3 + e() * 0.4), i * 3.2), vn);
      (d.position.set(l * (0.1 + e() * 0.8), i * 0.2, r),
        (d.rotation.z = 0.42 + e() * 0.1),
        o.push(d));
    }
  }
  for (let n = 0; n < 14; n++) {
    const r = -3 - e() * 16,
      [l, i] = be(r),
      d =
        i *
        (t === "night"
          ? 1.4
          : t === "meadow"
            ? 0.45 + e() * 0.35
            : 0.7 + e() * 0.5),
      g = new z(new fe(d * 0.5, d), Mn(t, r < -10 ? 14 : 6));
    (g.position.set(
      (e() * 2 - 1) * l,
      -i + d * 0.5 - (t === "night" ? i * 0.1 : 0),
      r,
    ),
      e() < 0.5 && (g.scale.x = -1),
      o.push(g));
  }
  if (_ === "lamp")
    for (let n = 0; n < 7; n++) {
      const r = -14 - e() * 10,
        [l, i] = be(r),
        d = new R0(
          new F0({
            map: Y0,
            color: 16756848,
            blending: xt,
            depthWrite: !1,
            transparent: !0,
            opacity: 0.6,
            fog: !1,
          }),
        );
      (d.scale.setScalar(0.5 + e() * 0.8),
        d.position.set((e() * 2 - 1) * l, -i * (0.1 + e() * 0.5), r),
        o.push(d));
    }
  return o;
}
function X0() {
  J && (te.remove(J), we.geometry.dispose());
  const e = Pe(Oe * 7 + 1);
  (sn(), (te.background = B0.value = on(Pe(Oe * 13 + 5))), (J = new Ce()));
  const o = _ === "garden" && e() < 0.5 ? -1 : 1,
    t =
      _ === "wood"
        ? [{ fx: -0.02, fy: 0.04, z: 0, k: 0.92, fade: 1 }]
        : _ === "lamp"
          ? [{ fx: -0.2, fy: -0.12, z: 0, k: 0.82, fade: 1 }]
          : [
              { fx: -0.34, fy: 0.02, z: 0, k: 0.86, fade: 1 },
              { fx: 0.55, fy: 0.32, z: -3.2, k: 0.62, fade: 0.62 },
              { fx: 0.18, fy: -0.4, z: -8, k: 0.7, fade: 0.34 },
              { fx: 0.92, fy: -0.85, z: 3.6, k: 0.95, fade: 0.8 },
            ],
    n = [...Uo].sort(() => e() - 0.5);
  n[0] === "Cobweb" && n.push(n.shift());
  let r = null;
  if (_ === "wood") {
    const [s, u] = be(0),
      f = [-1, 1].map((m) => ({
        x: m * s * (0.74 + e() * 0.08),
        lean: m * (e() * 0.08) - 0.03,
        r: u * (0.2 + e() * 0.1),
      }));
    for (const m of f) J.add(dn(m, u, e));
    r = (m, h, p) => {
      const w = f[m < 0 ? 0 : 1],
        b = Me.clamp(h, -u * 1.4, u * 1.4);
      return [w.x + w.lean * b - Math.sign(w.x) * w.r * 0.92, b, p];
    };
  }
  if (_ === "lamp") {
    const [s, u] = be(0),
      f = { x: s * (0.55 + e() * 0.08), w: 0.42 },
      m = un(f, u);
    (J.add(m.group),
      le.copy(m.flame),
      bt.position.copy(le),
      (bt.intensity = 22),
      He.copy(le)
        .sub(new M(t[0].fx * s, t[0].fy * u, 0))
        .normalize(),
      (r = (h, p, w) =>
        h > f.x - f.w * 2
          ? [f.x - f.w / 2, Me.clamp(p, -u * 1.3, m.armY - 0.1), w]
          : p > m.armY - 0.4 && h > m.armX0
            ? [Me.clamp(h, m.armX0, f.x), m.armY - 0.03, w]
            : [h, p, w]),
      n.splice(n.indexOf("Orb"), 1),
      n.unshift("Orb"));
  }
  V = t.map((s, u) => {
    const [f, m] = be(s.z),
      h = s.k * Math.min(m, f * 0.62) * (0.9 + e() * 0.2),
      p = Yo(Oe * 100 + u, {
        type: n[u],
        cx: (s.fx + (e() - 0.5) * 0.12) * f * o,
        cy: (s.fy + (e() - 0.5) * 0.1) * m,
        z: s.z,
        R: n[u] === "Cobweb" ? h * 0.75 : h,
        anchor: r,
      });
    return ((p.fade = s.fade), (p.scale = h / 2.2), p);
  });
  const l = V.reduce(
      (s, u) =>
        s +
        u.members.length +
        u.members.filter((f) => f.kind === "spiral").length,
      0,
    ),
    i = new Eo();
  (i.setAttribute("position", new gt(new Float32Array(l * 6), 3).setUsage(s0)),
    i.setAttribute("color", new gt(new Float32Array(l * 6), 3).setUsage(s0)),
    (we = new jo(i, rn)),
    (we.frustumCulled = !1),
    (Z = []));
  const d = _ === "lamp" ? 0.05 : _ === "wood" ? 0.32 : 0.55;
  V.forEach((s, u) =>
    s.members.forEach((f, m) => {
      if (!D0.has(f.kind)) return;
      const h = (s.x[f.i * 3] + s.x[f.j * 3]) / 2,
        p = (s.x[f.i * 3 + 1] + s.x[f.j * 3 + 1]) / 2;
      if (Xt(h * 1.3 + u * 7, p * 1.3) * 1.4 - 0.3 + e() * 0.25 < 1 - d) return;
      const w =
          (0.0055 + Math.pow(e(), 2) * 0.009) *
          s.scale *
          (f.kind === "gumfoot" ? 1.4 : 1),
        b = Math.max(1, Math.round(f.len / (w * 7)));
      for (let k = 0; k < b; k++) {
        const v = (k + 0.5 + (e() - 0.5) * 0.25) / b;
        (Z.push({ w: u, k: m, t: v, size: w * (0.7 + e() * 0.5) }),
          k < b - 1 &&
            Z.push({ w: u, k: m, t: (k + 1) / b, size: w * 0.28, tiny: !0 }));
      }
    }),
  );
  for (const s of Z) {
    if (s.tiny) continue;
    const u = V[s.w],
      f = u.members[s.k],
      m = s.t < 0.5 ? f.i : f.j;
    Re(u, m, u.mass[m] + Math.pow(s.size / (0.01 * u.scale), 3) * 0.02);
  }
  for (const s of V)
    for (let u = 0; u < 45; u++) Kt(s, 1 / 60, { substeps: 10 });
  for (const s of V) s.v.fill(0);
  ((We = []),
    Z.length > Ye - 600 && (Z.length = Ye - 600),
    (ze = new Nt(ln, Lt, Ye)),
    (ze.frustumCulled = !1),
    J.add(we, ze));
  for (const s of ee) te.remove(s.mesh);
  ((ee = []), (ut = V.map((s, u) => Tn(s, u))));
  const [g, c, a] = Cn[_];
  ((te.fog = new $o(g, c, a)),
    J.add(...zn(e)),
    (O0 =
      _ === "lamp"
        ? Array.from({ length: 6 }, (s, u) => {
            const f = L0("moth", V[0].scale * 1.7, e);
            return (
              J.add(f),
              {
                mesh: f,
                a: e() * 7,
                rad: 0.25 + e() * 0.5,
                speed: (0.9 + e() * 1.4) * (e() < 0.5 ? -1 : 1),
                tilt: e() * 2,
                t: e() * 9,
              }
            );
          })
        : []),
    _ === "garden" && J.add(...wn(e)),
    (e0 = mt = yt = 0),
    te.add(J),
    he || history.replaceState(null, "", `?scene=${_}&seed=${Oe}`),
    q.setAttribute(
      "aria-label",
      _ === "wood"
        ? "One big orb web strung between two old trees in a dark wood, its silk glowing gold where a low sun breaks through, a large spider at its hub. Things fall into it; the spider runs to wrap them and mends broken threads. Drag a thread to pull it."
        : _ === "lamp"
          ? "An old iron lantern glowing on a weathered post at night. Its light picks out a web in rings; moths circle the lamp and blunder into the silk, and the spider comes for them. Drag a thread to pull it."
          : "Four orb webs strung across a dim morning garden, backlit by a low sun and beaded with dew, each with a garden spider resting head-down at its hub. Flies, leaves and raindrops blow into the webs; the silk stretches under them and the spider runs out to wrap what it caught. Click to throw something in; drag a thread to pull it.",
    ));
}
function Tn(e, o) {
  const t = Qo(
    J,
    e.scale * (_ === "wood" ? 2.6 : _ === "lamp" ? 2.3 : 1.9),
    Zo[e.type],
  );
  if (_ === "wood")
    for (const n of t.parts)
      n.traverse((r) => {
        r.castShadow = !0;
      });
  return Object.assign(t, {
    w: o,
    node: e.hub,
    path: null,
    at: 0,
    state: "rest",
    target: null,
    wrapT: 0,
    wait: 0,
    run: 0,
    angle: Math.atan2(-1, 0),
  });
}
const Pn = new Ie();
function lt(e, o, t, n, r) {
  const l = Math.hypot(o, t);
  l > 1e-6 &&
    e.heading.lerp(Pn.set(o / l, t / l), Math.min(1, r * n)).normalize();
}
function An(e, o) {
  const t = V[e.w],
    n = (l) => st.set(t.x[l * 3], t.x[l * 3 + 1], t.x[l * 3 + 2]);
  if (e.state === "rest") {
    (lt(e, 0, -1, 2.5, o), e.pos.copy(n(e.node)));
    const l = ee.find(
      (i) => i.state === "stuck" && i.web === e.w && !i.claimed,
    );
    if (l) {
      const i = tt(t, e.node, l.node);
      i &&
        ((l.claimed = !0),
        (e.target = l),
        (e.goal = l.node),
        (e.path = i),
        (e.at = 0),
        (e.state = "sense"),
        (e.wait = 0.3 + Math.random() * 0.4));
    } else if (x.mend && t.repairs?.length) {
      const i = t.repairs.shift(),
        d =
          t.inv[i.i] && t.adj[i.i].some((c) => !t.members[c].broken)
            ? i.i
            : i.j,
        g = i.broken ? tt(t, e.node, d) : null;
      g &&
        ((e.repair = i),
        (e.goal = d),
        (e.path = g),
        (e.at = 0),
        (e.state = "sense"),
        (e.wait = 0.5));
    }
  } else if (e.state === "sense") {
    e.pos.copy(n(e.node));
    const l = n(e.goal).clone().sub(e.pos);
    (lt(e, l.x, l.y, 7, o),
      (e.wait -= o) <= 0 && ((e.state = "go"), (e.run = 0)));
  } else if (e.state === "go" || e.state === "home") {
    e.run = Math.min(1, e.run + o * 3);
    let l =
      (e.state === "go" ? 1.5 : 0.8) * t.scale * e.run * o * x.spiderSpeed;
    for (; l > 0 && e.at < e.path.length - 1; ) {
      const i = Math.floor(e.at),
        d = e.path[i],
        g = e.path[i + 1],
        c =
          Math.hypot(
            t.x[g * 3] - t.x[d * 3],
            t.x[g * 3 + 1] - t.x[d * 3 + 1],
          ) || 1e-4,
        a = (i + 1 - e.at) * c;
      l >= a ? ((e.at = i + 1), (l -= a)) : ((e.at += l / c), (l = 0));
    }
    if (e.at >= e.path.length - 1)
      ((e.node = e.path.at(-1)),
        (e.path = null),
        e.pos.copy(n(e.node)),
        e.state === "go"
          ? ((e.state = e.repair ? "spin" : "wrap"), (e.wrapT = 0))
          : (e.state = "rest"));
    else {
      const i = Math.floor(e.at),
        d = e.at - i;
      (rt.copy(n(e.path[i + 1])),
        n(e.path[i]),
        e.pos.copy(st).lerp(rt, d),
        lt(e, rt.x - st.x, rt.y - st.y, 12, o));
    }
  } else if (e.state === "spin") {
    const l = e.repair,
      i = l.i === e.node ? l.j : l.i;
    e.pos.copy(n(e.node));
    const d = n(i).clone().sub(e.pos);
    if (
      (lt(e, d.x + Math.sin(e.wrapT * 20) * 0.1, d.y, 6, o),
      (e.wrapT += o / 1.6),
      e.wrapT >= 1)
    ) {
      const g = Math.hypot(
        t.x[l.i * 3] - t.x[l.j * 3],
        t.x[l.i * 3 + 1] - t.x[l.j * 3 + 1],
        t.x[l.i * 3 + 2] - t.x[l.j * 3 + 2],
      );
      (Object.assign(l, {
        broken: !1,
        rest: g * 0.985,
        len: g,
        strain: 0.015,
        calm: 0.015,
        heat: 1,
      }),
        yt++,
        (e.repair = null));
      const c = tt(t, e.node, t.hub);
      c
        ? ((e.path = c), (e.at = 0), (e.state = "home"), (e.run = 0))
        : (e.state = "rest");
    }
  } else if (
    e.state === "wrap" &&
    (e.pos.copy(n(e.node)),
    (e.wrapT += o / 2.6),
    e.target && (e.target.wrap = Math.min(1, e.wrapT)),
    e.heading.rotateAround(new Ie(), o * 1.8),
    e.wrapT >= 1)
  ) {
    const l = tt(t, e.node, t.hub);
    ((e.target = null),
      l
        ? ((e.path = l), (e.at = 0), (e.state = "home"), (e.run = 0))
        : (e.state = "rest"));
  }
  const r = Math.atan2(e.heading.y, e.heading.x);
  ((e.turn = Me.euclideanModulo(r - e.angle + Math.PI, Math.PI * 2) - Math.PI),
    (e.turn /= Math.max(o, 1e-4)),
    (e.angle = r),
    (e.moving =
      e.state === "go" ||
      e.state === "home" ||
      e.state === "wrap" ||
      e.state === "spin"),
    Lo(e, t, o));
}
const _n = {
  garden: [
    ["fly", 45],
    ["leaf", 28],
    ["drop", 17],
    ["twig", 10],
  ],
  wood: [
    ["beetle", 50],
    ["leaf", 38],
    ["twig", 12],
  ],
  lamp: [["moth", 100]],
};
function In(e, o) {
  const t = document.createElement("canvas");
  t.width = t.height = 256;
  const n = t.getContext("2d"),
    r = () => {
      (n.beginPath(),
        n.moveTo(128, 8),
        n.bezierCurveTo(215, 70, 205, 190, 128, 236),
        n.bezierCurveTo(51, 190, 41, 70, 128, 8),
        n.closePath());
    };
  (r(), n.save(), n.clip());
  const l = n.createLinearGradient(0, 0, 256, 256);
  (l.addColorStop(0, e),
    l.addColorStop(1, new F(e).multiplyScalar(0.62).getStyle()),
    (n.fillStyle = l),
    n.fillRect(0, 0, 256, 256));
  for (let d = 0; d < 260; d++)
    ((n.fillStyle = `rgba(60,30,10,${o() * 0.18})`),
      n.beginPath(),
      n.arc(o() * 256, o() * 256, 1 + o() * 4, 0, 7),
      n.fill());
  ((n.strokeStyle = "rgba(255,235,180,0.45)"),
    (n.lineWidth = 3.5),
    n.beginPath(),
    n.moveTo(128, 236),
    n.lineTo(128, 14),
    n.stroke(),
    (n.lineWidth = 1.6));
  for (let d = 0; d < 7; d++)
    for (const g of [-1, 1]) {
      const c = 210 - d * 27;
      (n.beginPath(),
        n.moveTo(128, c),
        n.quadraticCurveTo(
          128 + g * 40,
          c - 22,
          128 + g * (70 - d * 4),
          c - 50,
        ),
        n.stroke());
    }
  (n.restore(),
    r(),
    (n.lineWidth = 9),
    (n.strokeStyle = "rgba(70,35,12,0.55)"),
    n.stroke());
  const i = new ne(t);
  return ((i.colorSpace = ae), i);
}
const v0 = ["#d4922f", "#b5521c", "#c9ae3c", "#8f9a33", "#a8401c"].map(
    (e, o) => {
      const t = In(e, Pe(o + 3));
      return new Ze({
        map: t,
        emissiveMap: t,
        emissive: 6965800,
        alphaTest: 0.5,
        side: Ke,
        roughness: 0.65,
      });
    },
  ),
  En = (() => {
    const e = new fe(1, 1, 8, 12),
      o = e.attributes.position;
    for (let t = 0; t < o.count; t++) {
      const n = o.getX(t),
        r = o.getY(t);
      o.setZ(t, n * n * 0.35 - r * r * 0.18 + Math.sin(r * 3) * 0.03);
    }
    return (e.computeVertexNormals(), e);
  })(),
  Ne = new _e({
    color: 8022614,
    roughness: 0.95,
    sheen: 1,
    sheenColor: 14206112,
    sheenRoughness: 0.4,
  });
function H0(e) {
  const o = document.createElement("canvas");
  o.width = o.height = 256;
  const t = o.getContext("2d"),
    n = e ? "#a89880" : "#8a7860";
  (t.beginPath(),
    t.moveTo(4, 128),
    t.bezierCurveTo(60, 20, 200, 10, 250, 40),
    t.bezierCurveTo(240, 120, 200, 200, 4, 140),
    t.closePath(),
    t.save(),
    t.clip());
  const r = t.createLinearGradient(0, 0, 256, 0);
  (r.addColorStop(0, "#6a5a46"),
    r.addColorStop(1, n),
    (t.fillStyle = r),
    t.fillRect(0, 0, 256, 256));
  for (let i = 0; i < 900; i++)
    ((t.fillStyle = `rgba(${Math.random() < 0.5 ? "40,30,20" : "220,205,180"},${Math.random() * 0.25})`),
      t.fillRect(Math.random() * 256, Math.random() * 256, 2, 2));
  if (!e) {
    ((t.strokeStyle = "rgba(40,28,18,0.7)"), (t.lineWidth = 5));
    for (const i of [80, 165]) {
      (t.beginPath(), t.moveTo(i, 20));
      for (let d = 20; d < 200; d += 12)
        t.lineTo(i + Math.sin(d * 0.15) * 8 - d * 0.15, d);
      t.stroke();
    }
    ((t.fillStyle = "rgba(30,20,12,0.8)"),
      t.beginPath(),
      t.ellipse(125, 80, 12, 18, 0.4, 0, 7),
      t.fill());
  }
  (t.restore(),
    (t.strokeStyle = "rgba(230,215,190,0.5)"),
    (t.lineWidth = 4),
    t.beginPath(),
    t.moveTo(250, 40),
    t.bezierCurveTo(240, 120, 200, 200, 4, 140),
    t.stroke());
  const l = new ne(o);
  return (
    (l.colorSpace = ae),
    new Ze({ map: l, alphaTest: 0.5, side: Ke, roughness: 0.9 })
  );
}
const jn = H0(!1),
  $n = H0(!0),
  Vn = new fe(1, 1).translate(0.5, -0.12, 0),
  Z0 = new ye({ roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
Z0.colorNode = K(
  O(0.62, 0.05, 0.02),
  O(0.015, 0.012, 0.01),
  $(
    0.66,
    0.72,
    ie(X.mul(O(2.4, 1.8, 2.4)).add(3.1))
      .mul(0.5)
      .add(0.5),
  ),
);
const Wn = new _e({ color: 15262936, roughness: 0.3, clearcoat: 1 }),
  Rn = new _e({
    color: 9071176,
    transparent: !0,
    opacity: 0.45,
    depthWrite: !1,
    side: Ke,
    roughness: 0.2,
  }),
  K0 = new ye({ roughness: 0.6, sheen: 0.8, sheenColor: new F(11577496) });
K0.colorNode = K(
  O(0.13, 0.125, 0.12),
  O(0.03, 0.028, 0.026),
  $(0.82, 0.95, X.x.mul(11).cos().abs())
    .mul($(0.35, 0.75, X.z))
    .mul(Y(1).sub($(0.5, 0.65, X.x.abs()))),
);
const Q0 = new ye({
  roughness: 0.45,
  clearcoat: 0.4,
  sheen: 0.5,
  sheenColor: new F(10522736),
});
Q0.colorNode = K(
  K(
    O(0.24, 0.19, 0.12),
    O(0.06, 0.05, 0.04),
    Y(1)
      .sub($(-0.9, 0.1, X.y))
      .mul(0.6)
      .add(X.y.mul(14).sin().mul(0.08)),
  ),
  O(0.06, 0.05, 0.045),
  Y(1).sub($(0.1, 0.22, X.x.abs())),
);
const de = new _e({
    color: 1315344,
    roughness: 0.5,
    sheen: 0.5,
    sheenColor: 7366752,
  }),
  J0 = new ye({ roughness: 0.25, clearcoat: 0.8, iridescence: 0.4 });
J0.colorNode = O(0.42, 0.08, 0.05).mul(ie(X.mul(90)).mul(0.35).add(0.85));
const Fn = new _e({
  map: Dn(),
  transparent: !0,
  depthWrite: !1,
  side: Ke,
  roughness: 0.15,
  iridescence: 1,
  iridescenceIOR: 1.6,
});
function Dn() {
  const e = document.createElement("canvas");
  ((e.width = 128), (e.height = 256));
  const o = e.getContext("2d");
  (o.beginPath(),
    o.moveTo(64, 250),
    o.bezierCurveTo(10, 200, 12, 40, 60, 8),
    o.bezierCurveTo(118, 30, 120, 190, 64, 250),
    o.closePath(),
    (o.fillStyle = "rgba(205,210,214,0.38)"),
    o.fill(),
    (o.strokeStyle = "rgba(40,36,32,0.75)"),
    (o.lineWidth = 2.5),
    o.stroke(),
    (o.lineWidth = 1.6));
  for (const [n, r, l, i] of [
    [64, 248, 40, 30],
    [64, 248, 58, 14],
    [64, 248, 80, 40],
    [64, 248, 96, 110],
    [64, 248, 30, 120],
    [44, 150, 86, 140],
  ])
    (o.beginPath(),
      o.moveTo(n, r),
      o.quadraticCurveTo((n + l) / 2 + 6, (r + i) / 2, l, i),
      o.stroke());
  const t = new ne(e);
  return ((t.colorSpace = ae), t);
}
const C0 = new fe(1, 1).translate(0, -0.5, 0);
function L0(e, o, t) {
  const n = new Ce(),
    r = (i, d, g, c, a, s = 0, u = 0, f = 0) => {
      const m = new z(i, d);
      return (
        m.scale.set(g * o, c * o, a * o),
        m.position.set(s * o, u * o, f * o),
        n.add(m),
        m
      );
    };
  if (e === "fly") {
    const i = o * 1.45,
      d = (a, s, u, f, m, h = 0, p = 0, w = 0) => {
        const b = new z(a, s);
        return (
          b.scale.set(u * i, f * i, m * i),
          b.position.set(h * i, p * i, w * i),
          n.add(b),
          b
        );
      };
    (d(B, K0, 0.017, 0.019, 0.016, 0, 0.004, 0.003),
      d(B, Q0, 0.015, 0.022, 0.011, 0, -0.026, 0.001),
      d(B, de, 0.012, 0.008, 0.01, 0, 0.026, 0.001));
    for (const a of [-1, 1])
      d(B, J0, 0.0085, 0.0085, 0.0085, a * 0.0068, 0.028, 0.004);
    for (let a = 0; a < 28; a++)
      d(
        re,
        de,
        6e-4,
        0.008,
        6e-4,
        (Math.random() - 0.5) * 0.024,
        0.012 - Math.random() * 0.02,
        0.014,
      ).rotation.set(
        -0.6 + Math.random() * 0.4,
        0,
        (Math.random() - 0.5) * 0.8,
      );
    const g = [];
    for (const a of [-1, 1])
      for (const s of [-1, 0, 1]) {
        const u = new Ce();
        u.position.set(a * 0.008 * i, (0.004 + s * 0.007) * i, -0.006 * i);
        const f = new z(re, de);
        f.scale.set(0.0012 * i, 0.026 * i, 0.0012 * i);
        const m = new Ce();
        m.position.y = 0.026 * i;
        const h = new z(re, de);
        (h.scale.set(9e-4 * i, 0.03 * i, 9e-4 * i),
          (h.rotation.x = -1.3),
          m.add(h),
          u.add(f, m),
          u.rotation.set(-0.9, 0, a * (1.3 - s * 0.45)),
          n.add(u),
          g.push(u));
      }
    const c = [-1, 1].map((a) => {
      const s = new z(C0, Fn);
      return (
        s.scale.set(0.017 * i, 0.046 * i, 1),
        s.position.set(a * 0.006 * i, 0.008 * i, 0.024 * i),
        s.rotation.set(0.12, 0, a * 0.42),
        a > 0 && (s.scale.x *= -1),
        n.add(s),
        s
      );
    });
    Object.assign(n.userData, { wings: c, legs: g });
  } else if (e === "beetle") {
    const i = o * 1.4,
      d = (s, u, f, m, h, p = 0, w = 0, b = 0, k = n) => {
        const v = new z(s, u);
        return (
          v.scale.set(f * i, m * i, h * i),
          v.position.set(p * i, w * i, b * i),
          k.add(v),
          v
        );
      };
    (d(B, de, 0.014, 0.022, 0.009, 0, -0.004),
      d(B, de, 0.012, 0.0075, 0.008, 0, 0.016, 0.004));
    for (const s of [-1, 1])
      d(B, Wn, 0.0035, 0.003, 0.003, s * 0.008, 0.017, 0.008);
    d(B, de, 0.007, 0.005, 0.006, 0, 0.024, 0.003);
    const g = [-1, 1].map((s) => {
        const u = new Ce();
        return (
          u.position.set(s * 5e-4 * i, 0.012 * i, 0.006 * i),
          n.add(u),
          d(B, Z0, 0.0088, 0.021, 0.0125, s * 0.0078, -0.014, 0, u),
          { hinge: u, side: s }
        );
      }),
      c = [];
    for (const s of [-1, 1])
      for (const u of [-1, 0, 1]) {
        const f = new z(re, de);
        (f.position.set(s * 0.009 * i, u * 0.007 * i, -0.004 * i),
          f.scale.set(0.0012 * i, 0.014 * i, 0.0012 * i),
          f.rotation.set(-0.6, 0, s * (1.5 - u * 0.4)),
          n.add(f),
          c.push(f));
      }
    const a = [-1, 1].map((s) => {
      const u = new z(C0, Rn);
      return (
        u.scale.set(-s * 0.016 * i, 0.04 * i, 1),
        u.position.set(s * 0.004 * i, 0.008 * i, 0.014 * i),
        (u.rotation.z = s * 0.9),
        (u.visible = !1),
        n.add(u),
        u
      );
    });
    Object.assign(n.userData, { wings: a, legs: c, elytra: g });
  } else if (e === "moth") {
    const i = o * 1.5,
      d = (c, a, s, u, f, m = 0, h = 0, p = 0) => {
        const w = new z(c, a);
        return (
          w.scale.set(s * i, u * i, f * i),
          w.position.set(m * i, h * i, p * i),
          n.add(w),
          w
        );
      };
    (d(B, Ne, 0.014, 0.018, 0.013, 0, 0.004),
      d(B, Ne, 0.011, 0.026, 0.01, 0, -0.03),
      d(B, Ne, 0.009, 0.008, 0.009, 0, 0.024));
    for (const c of [-1, 1])
      d(B, de, 0.004, 0.004, 0.004, c * 0.006, 0.028, 0.004);
    for (const c of [-1, 1]) {
      const a = d(re, Ne, 0.0012, 0.03, 0.0012, c * 0.004, 0.03, 0.004);
      a.rotation.z = -c * 0.5;
    }
    for (let c = 0; c < 30; c++)
      d(
        re,
        Ne,
        0.0012,
        0.007,
        0.0012,
        (Math.random() - 0.5) * 0.02,
        0.01 - Math.random() * 0.015,
        0.01,
      ).rotation.set(-0.5 + Math.random(), 0, Math.random() - 0.5);
    const g = [];
    for (const c of [-1, 1])
      for (const a of [0, 1]) {
        const s = new z(Vn, a ? $n : jn);
        (s.scale.set(c * (a ? 0.034 : 0.05) * i, (a ? 0.034 : 0.044) * i, 1),
          s.position.set(
            c * 0.006 * i,
            (a ? -0.008 : 0.006) * i,
            (0.014 - a * 0.001) * i,
          ),
          (s.rotation.z = c * (a ? -0.35 : -0.15)),
          n.add(s),
          g.push(s));
      }
    Object.assign(n.userData, { wings: g, moth: !0, legs: [] });
  } else if (e === "leaf") {
    const i = 0.75 + t() * 0.55;
    r(En, v0[Math.floor(t() * v0.length)], 0.15 * i, 0.2 * i, 0.15 * i);
    const d = r(re, at, 0.004, 0.05 * i, 0.004, 0, -0.14 * i);
    d.rotation.z = 0.2;
  } else if (e === "drop") n.userData.drop = r(B, Lt, 0.022, 0.022, 0.022);
  else {
    r(re, at, 0.011, 0.34, 0.011, 0, -0.17);
    const i = r(re, at, 0.007, 0.12, 0.007, 0, -0.02);
    i.rotation.z = 0.7;
    const d = r(re, at, 0.006, 0.08, 0.006, 0, -0.12);
    d.rotation.z = -0.9;
  }
  const l = new z(B, N0);
  return (l.scale.setScalar(0), n.add(l), (n.userData.bundle = l), n);
}
const Gn = { fly: 1.2, leaf: 2.5, drop: 0.8, twig: 9, moth: 1.6, beetle: 1.8 };
function Ge(e = qn(), o = null) {
  const t = Pe((performance.now() * 1e3) | 0),
    n = V[e];
  let r = t() * 100,
    l = "fly";
  for (const [k, v] of _n[_]) {
    if (r < v) {
      l = k;
      break;
    }
    r -= v;
  }
  const i = t() * Math.PI * 2,
    d = Math.sqrt(t()) * 0.8 * n.R,
    g = o ? o[0] : n.cx + Math.cos(i) * d,
    c = o ? o[1] : n.cy + Math.sin(i) * d,
    a = St(n, g, c, n.R * 0.4);
  if (a < 0) return;
  const s = n.scale,
    u = t() < 0.5 ? -1 : 1,
    f = {
      drop: 0.8 + t() * 0.3,
      leaf: 2.6 + t() * 1.2,
      fly: 1.4 + t() * 0.8,
      twig: 1.3 + t() * 0.5,
      moth: 1.6 + t() * 0.8,
      beetle: 1.6 + t() * 0.6,
    }[l],
    m =
      { drop: 5, leaf: 0.5, fly: 0.15, twig: 3.2, moth: 0.1, beetle: 0.3 }[l] *
      s,
    h = new M(n.x[a * 3], n.x[a * 3 + 1], n.x[a * 3 + 2]);
  let p, w;
  l === "moth"
    ? ((w = le
        .clone()
        .add(new M((t() - 0.5) * 0.8, (t() - 0.5) * 0.6, 0.3 + t() * 0.5))),
      (p = h.clone().sub(w).divideScalar(f)),
      (p.y += 0.5 * m * f))
    : ((p =
        l === "fly" || l === "beetle"
          ? new M(
              u * (0.9 + t() * 0.6) * s,
              (t() - 0.3) * 0.4 * s,
              -(0.6 + t() * 0.5),
            )
          : new M(
              (t() - 0.5) * 0.5 * s,
              l === "leaf" ? -0.25 * s : -0.6 * s,
              -(0.7 + t() * 0.6),
            )),
      (w = h.clone().addScaledVector(p, -f)),
      (w.y += 0.5 * m * f * f));
  const b = L0(l, s * 1.7, t);
  (b.position.copy(w),
    te.add(b),
    ee.push({
      kind: l,
      mesh: b,
      web: e,
      node: -1,
      state: "fly",
      t: 0,
      T: f,
      p0: w,
      v0: p,
      g: m,
      target: h,
      spin: (t() - 0.5) * 6,
      seed: t() * 100,
      omega: 2.4 + t() * 1.2,
      yaw: 0,
      last: w.clone(),
      wrap: 0,
      struggle: 0.3,
      miss: (l === "leaf" || l === "drop" || l === "twig") && t() < 0.18,
    }));
}
function qn() {
  if (V.length === 1) return 0;
  const e = Math.random();
  return e < 0.5 ? 0 : e < 0.72 ? 1 : e < 0.85 ? 2 : 3;
}
function Bn(e) {
  const o = V[e.web],
    t = e.mesh.position,
    n = e.v0.clone();
  if (
    ((n.y -= e.g * e.T),
    (e.node = St(o, t.x, t.y, o.R * 0.3)),
    e.node < 0 || e.miss)
  ) {
    if (e.node >= 0)
      for (let a = 0; a < 3; a++)
        o.v[e.node * 3 + a] += n.getComponent(a) * 0.25;
    ((e.state = "fall"), (e.vel = n), (e.node = -1));
    return;
  }
  const r = Gn[e.kind],
    l = r / (r + 1),
    i = new Set(),
    d = new Set(),
    g = (a) =>
      o.adj[a]
        .map((s) => o.members[s])
        .filter((s) => !s.broken)
        .map((s) => (s.i === a ? s.j : s.i));
  for (const a of g(e.node)) i.add(a);
  for (const a of i)
    for (const s of g(a)) s !== e.node && !i.has(s) && d.add(s);
  const c = (a, s) => {
    if (o.inv[a])
      for (let u = 0; u < 3; u++) o.v[a * 3 + u] += n.getComponent(u) * l * s;
  };
  if (
    (c(e.node, 1),
    i.forEach((a) => c(a, 0.4)),
    d.forEach((a) => c(a, 0.15)),
    e0++,
    e.kind === "drop")
  ) {
    const a = [...i, ...d]
      .flatMap((s) => o.adj[s])
      .filter((s) => D0.has(o.members[s].kind) && !o.members[s].broken);
    for (let s = 0; s < 7 && a.length && Z.length < Ye - 200; s++) {
      const u = a[Math.floor(Math.random() * a.length)],
        f = (0.006 + Math.random() * 0.012) * o.scale;
      Z.push({ w: e.web, k: u, t: 0.2 + Math.random() * 0.6, size: f });
      const m = o.members[u];
      Re(o, m.i, o.mass[m.i] + Math.pow(f / (0.01 * o.scale), 3) * 0.02);
    }
    for (let s = 0; s < 5; s++)
      We.push({
        p: t.clone(),
        v: new M(
          (Math.random() - 0.5) * 1.2,
          Math.random() * 0.8,
          (Math.random() - 0.2) * 0.8,
        ).multiplyScalar(o.scale),
        size: (0.004 + Math.random() * 0.006) * o.scale,
        floor: o.cy - 8,
        g: 3 * o.scale,
      });
    (te.remove(e.mesh), (e.state = "gone"));
    return;
  }
  (Re(o, e.node, o.mass[e.node] + r * 0.4), (e.state = "stuck"));
}
const z0 = new _o(),
  T0 = new Ie(),
  P0 = new Io(new M(0, 0, 1), 0),
  A0 = new M();
let ce = null,
  Ue = null,
  Rt = new Ie(),
  eo = new Ie();
function t0(e, o) {
  const t = q.getBoundingClientRect();
  return (
    T0.set(
      ((e.clientX - t.left) / t.width) * 2 - 1,
      -((e.clientY - t.top) / t.height) * 2 + 1,
    ),
    z0.setFromCamera(T0, D),
    (P0.constant = -o),
    z0.ray.intersectPlane(P0, A0) ? A0 : null
  );
}
q.addEventListener("pointerdown", (e) => {
  Ue = { x: e.clientX, y: e.clientY };
  for (let o = 0; o < V.length; o++) {
    const t = V[o],
      n = t0(e, t.z);
    if (!n || Math.hypot(n.x - t.cx, n.y - t.cy) > t.R * 1.2) continue;
    const r = St(t, n.x, n.y, t.R * 0.06);
    if (r >= 0) {
      ((ce = { wi: o, node: r, target: [n.x, n.y, t.z] }),
        q.setPointerCapture(e.pointerId),
        (q.style.cursor = "grabbing"));
      return;
    }
  }
});
q.addEventListener("pointermove", (e) => {
  const o = q.getBoundingClientRect();
  if (
    (eo.set(
      ((e.clientX - o.left) / o.width) * 2 - 1,
      -((e.clientY - o.top) / o.height) * 2 + 1,
    ),
    !ce)
  )
    return;
  const t = V[ce.wi],
    n = t0(e, t.z);
  n &&
    (ce.target = [
      n.x,
      n.y,
      t.z +
        Math.min(
          0.6,
          Math.hypot(n.x - t.x[ce.node * 3], n.y - t.x[ce.node * 3 + 1]) * 0.5,
        ),
    ]);
});
function to(e) {
  if (!ce) {
    if (Ue && Math.hypot(e.clientX - Ue.x, e.clientY - Ue.y) < 6)
      for (let o = 0; o < V.length; o++) {
        const t = V[o],
          n = t0(e, t.z);
        if (n && Math.hypot(n.x - t.cx, n.y - t.cy) < t.R * 0.95) {
          Ge(o, [n.x, n.y]);
          break;
        }
      }
  }
  ((ce = null), (Ue = null), (q.style.cursor = ""));
}
q.addEventListener("pointerup", to);
q.addEventListener("pointercancel", to);
const Ft = document.querySelector("#veil");
let Fe = null,
  oo = 0,
  Xe = 0;
function kt() {
  no(dt[(dt.indexOf(_) + 1) % dt.length]);
}
function no(e) {
  Fe ||
    he ||
    ((oo = 0), (Fe = { phase: "out", t: 0, place: e }), o0({ Place: e }));
}
function Nn(e) {
  const o = Fe,
    t = (n) => n * n * (3 - 2 * n);
  o.phase === "out"
    ? ((o.t = Math.min(1, o.t + e / 1.5)),
      (Xe = -Math.pow(o.t, 2.6) * 12),
      (Ft.style.opacity = t(Math.max(0, (o.t - 0.55) / 0.45))),
      (q.style.filter = `blur(${(Math.pow(o.t, 3) * 6).toFixed(1)}px)`),
      o.t >= 1 && ((_ = o.place), Oe++, X0(), (o.phase = "in"), (o.t = 0)))
    : ((o.t = Math.min(1, o.t + e / 2.2)),
      (Xe = Math.pow(1 - o.t, 3) * 9),
      (Ft.style.opacity = 1 - t(Math.min(1, o.t / 0.55))),
      (q.style.filter =
        o.t < 1 ? `blur(${(Math.pow(1 - o.t, 2) * 5).toFixed(1)}px)` : ""),
      o.t >= 1 &&
        ((Fe = null), (Xe = 0), (Ft.style.opacity = 0), (q.style.filter = "")));
}
document.querySelector("#random").addEventListener("click", kt);
addEventListener("keydown", (e) => {
  if (e.target.closest?.("#controls, input")) return;
  const o = e.key.toLowerCase();
  if (o === "r") kt();
  else if (o === " " || o === "d") Ge();
  else if (o === "t")
    ((x.tension = !x.tension), o0({ "Show tension (T)": x.tension }));
  else return;
  e.preventDefault();
});
let o0 = () => {};
function On() {
  const [, e] = Vo(() => ({
    Place: qe({
      Place: {
        value: _,
        options: {
          Garden: "garden",
          "Old wood": "wood",
          "Lantern at night": "lamp",
        },
        onChange: (o, t, { initial: n }) => {
          !n && o !== _ && !Fe && no(o);
        },
      },
      "Next place (R)": i0(kt),
      "Travel on its own": {
        value: x.auto,
        onChange: (o) => {
          x.auto = o;
        },
      },
      "Travel every (s)": {
        value: x.travelEvery,
        min: 10,
        max: 180,
        step: 5,
        onChange: (o) => {
          x.travelEvery = o;
        },
      },
    }),
    Wildlife: qe({
      "Throw something (D)": i0(() => Ge()),
      "Something every (s)": {
        value: x.every,
        min: 0.6,
        max: 12,
        step: 0.1,
        onChange: (o) => {
          x.every = o;
        },
      },
      "Spider speed": {
        value: x.spiderSpeed,
        min: 0.3,
        max: 3,
        step: 0.05,
        onChange: (o) => {
          x.spiderSpeed = o;
        },
      },
      "Spiders mend webs": {
        value: x.mend,
        onChange: (o) => {
          x.mend = o;
        },
      },
    }),
    Silk: qe({
      "Show tension (T)": {
        value: x.tension,
        onChange: (o) => {
          x.tension = o;
        },
      },
      "Tension glow": {
        value: x.glow,
        min: 0,
        max: 6,
        step: 0.1,
        onChange: (o) => {
          x.glow = o;
        },
      },
      Glint: {
        value: x.glint,
        min: 0,
        max: 3,
        step: 0.05,
        onChange: (o) => {
          x.glint = o;
        },
      },
      Droop: {
        value: x.droop,
        min: 0,
        max: 3,
        step: 0.05,
        onChange: (o) => {
          x.droop = o;
        },
      },
    }),
    Dew: qe({
      Dew: {
        value: x.dew,
        onChange: (o) => {
          x.dew = o;
        },
      },
      "Drop size": {
        value: x.dewSize,
        min: 0.4,
        max: 2.2,
        step: 0.05,
        onChange: (o) => {
          x.dewSize = o;
        },
      },
    }),
    Camera: qe({
      Parallax: {
        value: x.parallax,
        min: 0,
        max: 3,
        step: 0.05,
        onChange: (o) => {
          x.parallax = o;
        },
      },
      "Time scale": {
        value: x.timeScale,
        min: 0.1,
        max: 2,
        step: 0.05,
        onChange: (o) => {
          x.timeScale = o;
        },
      },
    }),
    ...Do({ renderer: xe, pipeline: Te, lights: [oe] }),
  }));
  return ((o0 = e), null);
}
const Te = bo(xe, te, D, {
    aoStrength: 0,
    bloomStrength: 0.16,
    vignette: 0.2,
    grain: 0.003,
  }),
  _0 = document.querySelector("#label strong"),
  Un = document.querySelector("#label span");
let I0 = "";
const E0 = new M(),
  Dt = new M(),
  Gt = new M(),
  Yn = new F(1, 0.86, 0.62),
  Xn = new F(1, 0.72, 0.28),
  Hn = new F(1, 0.22, 0.06),
  Zn = new F(),
  qt = new M(),
  j0 = (e, o) =>
    o.kind === "spiral"
      ? Math.min(
          o.len * 0.16,
          o.len * (0.035 + (e.mass[o.i] + e.mass[o.j]) * 0.05),
        ) * x.droop
      : 0,
  Bt = (e, o) => {
    ((L.r += e.r * o), (L.g += e.g * o), (L.b += e.b * o));
  };
function ao(e) {
  ((pt -= e),
    pt <= 0 && (Ge(), (pt = x.every * (0.6 + Math.random() * 0.8))),
    V.forEach((a, s) => {
      for (const u of Kt(a, e, {
        drag: ce?.wi === s ? ce : null,
        substeps: 10,
      })) {
        (mt++,
          u.kind !== "moor" &&
            u.kind !== "gumfoot" &&
            (a.repairs ??= []).push(u));
        for (const f of ee)
          f.web === s &&
            f.state === "stuck" &&
            (f.node === u.i || f.node === u.j) &&
            !a.adj[f.node].some((m) => !a.members[m].broken) &&
            ((f.state = "fall"), (f.vel = new M()), Re(a, f.node, 0));
      }
    }));
  for (const a of ee) {
    const s = a.mesh,
      u = V[a.web];
    if (((a.t += e), a.state === "fly")) {
      const f = Math.min(a.t, a.T),
        m = 1 - (f / a.T) ** 2,
        h = u.scale;
      if (
        (s.position.copy(a.p0).addScaledVector(a.v0, f),
        (s.position.y -= 0.5 * a.g * f * f),
        a.kind === "leaf")
      ) {
        const p = f * a.omega + a.seed;
        ((s.position.x += Math.sin(p) * 0.5 * h * m),
          (s.position.y += (Math.cos(2 * p) - 1) * 0.09 * h * m),
          s.rotation.set(
            (0.6 + Math.sin(2 * p) * 0.4) * m,
            f * a.spin * 0.2,
            -Math.cos(p) * 1.1 * m + (a.seed % 1),
          ));
      } else if (a.kind === "fly" || a.kind === "moth" || a.kind === "beetle") {
        const p = a.kind === "moth" ? 2.2 : a.kind === "beetle" ? 0.6 : 1;
        ((s.position.x +=
          (Math.sin(f * 7 + a.seed) + 0.5 * Math.sin(f * 13.3)) *
          0.1 *
          h *
          m *
          p),
          (s.position.y +=
            (Math.sin(f * 10.7 + a.seed * 2) + 0.4 * Math.sin(f * 23)) *
            0.07 *
            h *
            m *
            p),
          (s.position.z += Math.sin(f * 5.3) * 0.12 * m));
        const w = s.position.x - a.last.x,
          b = s.position.y - a.last.y;
        (Math.hypot(w, b) > 1e-5 &&
          (a.yaw +=
            (Me.euclideanModulo(
              Math.atan2(-w, b) - a.yaw + Math.PI,
              Math.PI * 2,
            ) -
              Math.PI) *
            Math.min(1, e * 8)),
          s.rotation.set(-0.35, 0, a.yaw));
      } else if (a.kind === "twig")
        s.rotation.set(f * a.spin * 0.5, 0, f * a.spin);
      else {
        const p = Math.abs(a.v0.y - a.g * f),
          w = 1 + Math.min(3, p * 0.25);
        s.userData.drop.scale.set(
          (0.022 * 1.7 * h) / Math.sqrt(w),
          0.022 * 1.7 * h * w,
          (0.022 * 1.7 * h) / Math.sqrt(w),
        );
      }
      (a.last.copy(s.position), a.t >= a.T && Bn(a));
    } else if (a.state === "stuck") {
      const f = a.node;
      if (
        (s.position.set(
          u.x[f * 3],
          u.x[f * 3 + 1],
          u.x[f * 3 + 2] + 0.012 * u.scale,
        ),
        (a.kind === "leaf" || a.kind === "twig") &&
          ((s.rotation.x *= 1 - Math.min(1, e * 4)),
          (s.rotation.y *= 1 - Math.min(1, e * 4))),
        (a.kind === "fly" || a.kind === "moth" || a.kind === "beetle") &&
          a.wrap < 0.3)
      ) {
        s.rotation.z += Math.sin(a.t * 31) * e * 2;
        for (const [h, p] of s.userData.legs.entries())
          p.rotation.x = -0.9 + Math.sin(a.t * 24 + h) * 0.5;
      }
      if (
        (a.kind === "fly" || a.kind === "moth" || a.kind === "beetle") &&
        a.wrap < 0.3 &&
        ((a.struggle -= e), a.struggle <= 0)
      ) {
        a.struggle = 0.2 + Math.random() * 0.6;
        const h = Math.random() * Math.PI * 2;
        ((u.v[f * 3] += Math.cos(h) * 1.4 * u.scale),
          (u.v[f * 3 + 1] += Math.sin(h) * 1.4 * u.scale),
          (u.v[f * 3 + 2] += (Math.random() - 0.5) * 2));
      }
      const m = a.wrap;
      (s.userData.bundle.scale
        .set(0.022, 0.034, 0.02)
        .multiplyScalar(
          1.7 *
            u.scale *
            Math.min(1, m * 1.3) *
            (a.kind === "twig" ? 1.4 : a.kind === "leaf" ? 1.3 : 1),
        ),
        s.children.forEach((h) => {
          h !== s.userData.bundle && (h.visible = m < 0.85);
        }));
    } else
      a.state === "fall" &&
        ((a.vel.y -= a.g * e),
        s.position.addScaledVector(a.vel, e),
        (s.rotation.z += e * 2),
        s.position.y < u.cy - 8 && (te.remove(s), (a.state = "gone")));
    if (a.mesh.userData.wings) {
      const f = a.state === "fly" || (a.state === "stuck" && a.wrap < 0.3),
        m = a.kind === "moth",
        h = m ? Math.sin(a.t * 38) * 1 : Math.sin(a.t * 90) * 1.1;
      if (a.kind === "beetle") {
        const p = a.state === "fly" ? 1 : 0;
        for (const w of a.mesh.userData.elytra)
          w.hinge.rotation.set(-0.5 * p, 0.55 * p * w.side, 0);
        for (const w of a.mesh.userData.wings) w.visible = !!p;
      }
      for (const p of a.mesh.userData.wings)
        p.rotation.y = (f ? h : m ? 0 : 0.12) * Math.sign(p.scale.x);
    }
  }
  const o = ee.filter((a) => a.state === "stuck" && a.wrap >= 1);
  if (o.length > 9) {
    const a = o[0];
    ((a.state = "fall"), (a.vel = new M()), Re(V[a.web], a.node, 0));
  }
  ee = ee.filter((a) => a.state !== "gone");
  for (const a of ut) An(a, e);
  for (const a of O0) {
    ((a.t += e), (a.a += a.speed * e));
    const s = a.rad * (1 + Math.sin(a.t * 1.7) * 0.35);
    (a.mesh.position.set(
      le.x + Math.cos(a.a) * s,
      le.y + Math.sin(a.a * 1.3 + a.tilt) * s * 0.7 + Math.sin(a.t * 7) * 0.03,
      le.z + 0.25 + Math.sin(a.a) * s * 0.6,
    ),
      a.mesh.rotation.set(-0.4, 0, a.a + (a.speed > 0 ? Math.PI : 0)));
    for (const u of a.mesh.userData.wings)
      u.rotation.y = Math.sin(a.t * 38) * Math.sign(u.scale.x);
  }
  const t = we.geometry.attributes.position.array,
    n = we.geometry.attributes.color.array;
  let r = 0,
    l = 0,
    i = 0;
  for (const a of V) {
    const s = a.x,
      u = a.fade;
    for (const f of a.members) {
      const m = f.kind === "spiral";
      if (f.broken) {
        for (let I = 0; I < (m ? 12 : 6); I++) ((t[r + I] = 0), (n[r + I] = 0));
        r += m ? 12 : 6;
        continue;
      }
      i++;
      const h = f.i * 3,
        p = f.j * 3;
      (E0.set(
        s[p] - s[h],
        s[p + 1] - s[h + 1],
        s[p + 2] - s[h + 2],
      ).normalize(),
        Gt.set(
          D.position.x - s[h],
          D.position.y - s[h + 1],
          D.position.z - s[h + 2],
        ).normalize());
      let w = 1;
      _ === "lamp"
        ? (qt.set(le.x - s[h], le.y - s[h + 1], le.z - s[h + 2]),
          (w = 5 / (1 + qt.lengthSq() * 0.9)),
          Dt.copy(Gt).add(qt.normalize()).normalize())
        : Dt.copy(Gt).add(He).normalize();
      const b = E0.dot(Dt),
        k = Math.sqrt(Math.max(0, 1 - b * b)),
        v = Math.pow(k, 160) * w,
        R = Math.pow(k, 12) * w;
      k0.setHSL((b * 2.5 + 0.55) % 1, 0.85, 0.55);
      const C =
        (f.kind === "deco"
          ? 0.3
          : f.kind === "moor" || f.kind === "frame" || f.kind === "signal"
            ? 0.06
            : 0.035) * (_ === "lamp" ? Math.min(1.4, 0.3 + w * 0.4) : 1);
      (L.setRGB(C, C * 1.02, C * 0.95),
        Bt(Yn, v * x.glint + R * 0.07),
        Bt(k0, v * (1 - v) * 1.1));
      const T = Math.max(
        0,
        (f.strain - f.calm) / (f.limit === 1 / 0 ? 0.3 : f.limit - f.calm),
      );
      if (
        ((l = Math.max(l, T)),
        (f.heat = Math.max(
          (f.heat ?? 0) * Math.exp(-e * 1.8),
          Math.min(1, T * 2.5),
        )),
        x.tension &&
          f.heat > 0.02 &&
          Bt(Zn.copy(Xn).lerp(Hn, Math.min(1, f.heat * 1.4)), f.heat * x.glow),
        L.multiplyScalar(u),
        m)
      ) {
        const I = j0(a, f),
          G = (s[h] + s[p]) / 2,
          Q = (s[h + 1] + s[p + 1]) / 2 - I,
          U = (s[h + 2] + s[p + 2]) / 2;
        t.set(
          [
            s[h],
            s[h + 1],
            s[h + 2],
            G,
            Q,
            U,
            G,
            Q,
            U,
            s[p],
            s[p + 1],
            s[p + 2],
          ],
          r,
        );
        for (let H = 0; H < 4; H++)
          ((n[r + H * 3] = L.r),
            (n[r + H * 3 + 1] = L.g),
            (n[r + H * 3 + 2] = L.b));
        r += 12;
      } else
        ((t[r] = s[h]),
          (t[r + 1] = s[h + 1]),
          (t[r + 2] = s[h + 2]),
          (t[r + 3] = s[p]),
          (t[r + 4] = s[p + 1]),
          (t[r + 5] = s[p + 2]),
          (n[r] = n[r + 3] = L.r),
          (n[r + 1] = n[r + 4] = L.g),
          (n[r + 2] = n[r + 5] = L.b),
          (r += 6));
    }
  }
  we.geometry.attributes.position.needsUpdate =
    we.geometry.attributes.color.needsUpdate = !0;
  let d = 0;
  if (x.dew)
    for (const a of Z) {
      const s = V[a.w],
        u = s.members[a.k];
      if (u.broken) {
        a.gone = !0;
        continue;
      }
      const f = u.i * 3,
        m = u.j * 3,
        h = j0(s, u) * 4 * a.t * (1 - a.t);
      Vt.set(
        s.x[f] + (s.x[m] - s.x[f]) * a.t,
        s.x[f + 1] + (s.x[m + 1] - s.x[f + 1]) * a.t - h - a.size * 0.45,
        s.x[f + 2] + (s.x[m + 2] - s.x[f + 2]) * a.t,
      );
      const p = a.t < 0.5 ? u.i : u.j,
        w = Math.hypot(s.v[p * 3], s.v[p * 3 + 1], s.v[p * 3 + 2]);
      if (w > 0.7 * s.scale && Math.random() < e * w * 3) {
        ((a.gone = !0),
          Re(
            s,
            p,
            Math.max(
              0,
              s.mass[p] - Math.pow(a.size / (0.01 * s.scale), 3) * 0.02,
            ),
          ),
          We.push({
            p: Vt.clone(),
            v: new M(s.v[p * 3], s.v[p * 3 + 1], s.v[p * 3 + 2]).multiplyScalar(
              0.6,
            ),
            size: a.size,
            floor: s.cy - 8,
            g: 3 * s.scale,
          }));
        continue;
      }
      const b = 1 + Math.min(0.25, w * 0.15) * Math.sin(s.time * 40 + a.t * 9);
      ze.setMatrixAt(
        d++,
        x0.compose(
          Vt,
          M0.identity(),
          S0.set(
            a.size * b * x.dewSize,
            (a.size / b) * x.dewSize,
            a.size * x.dewSize,
          ),
        ),
      );
    }
  Z.some((a) => a.gone) && (Z = Z.filter((a) => !a.gone));
  for (const a of We) {
    ((a.v.y -= a.g * e), a.p.addScaledVector(a.v, e));
    const s = 1 + Math.min(2.5, Math.abs(a.v.y) * 0.35);
    d < Ye &&
      ze.setMatrixAt(
        d++,
        x0.compose(
          a.p,
          M0.identity(),
          S0.set(a.size / Math.sqrt(s), a.size * s, a.size / Math.sqrt(s)),
        ),
      );
  }
  if (
    ((We = We.filter((a) => a.p.y > a.floor)),
    (ze.count = d),
    (ze.instanceMatrix.needsUpdate = !0),
    Rt.lerp(eo, Math.min(1, e * 2)),
    D.position.set(Rt.x * 0.35 * x.parallax, Rt.y * 0.2 * x.parallax, Jt + Xe),
    D.lookAt(0, 0, -2 + Xe),
    N.has("flyclose"))
  ) {
    const a = ee.find((s) => s.kind === "fly");
    if (a) {
      const s = a.mesh.position;
      (D.position.set(s.x + 0.05, s.y - 0.05, s.z + 0.5), D.lookAt(s));
    }
  }
  if (N.has("closeup")) {
    const a = ut[+N.get("closeup") || 0].pos;
    (D.position.set(a.x + 0.15, a.y - 0.2, a.z + 1.6), D.lookAt(a));
  }
  const g = `${ut.map((a) => a.species).join(", ")} · ${e0} caught`;
  _0.textContent !== g && (_0.textContent = g);
  const c = `${i.toLocaleString()} threads · ${d.toLocaleString()} dew drops · tightest at ${Math.round(Math.min(1, l) * 100)}% of breaking${mt ? ` · ${mt} snapped` : ""}${yt ? `, ${yt} mended` : ""}`;
  c !== I0 && (Un.textContent = I0 = c);
}
function so() {
  const e = he ? +N.get("w") || 1e3 : innerWidth,
    o = he ? +N.get("h") || 1e3 : innerHeight;
  (xe.setSize(e, o, !he), (D.aspect = e / o), D.updateProjectionMatrix());
}
addEventListener("resize", so);
so();
X0();
he ||
  To.createRoot(document.querySelector("#controls")).render(
    et.createElement(
      et.Fragment,
      null,
      et.createElement(Po, { collapsed: !0, titleBar: { title: "Controls" } }),
      et.createElement(On),
    ),
  );
N.has("debug") &&
  (window.web = {
    get webs() {
      return V;
    },
    get items() {
      return ee;
    },
    throwItem: Ge,
    settings: x,
  });
function ro() {
  (D.updateMatrixWorld(),
    Yt.value.copy(He).transformDirection(D.matrixWorldInverse));
}
const Kn = new Ao();
xe.setAnimationLoop(() => {
  const e = Math.min(Kn.getDelta(), 0.03333333333333333) * x.timeScale;
  (e > 0 && ao(e),
    Fe
      ? Nn(e / x.timeScale)
      : x.auto && !he && (oo += e / x.timeScale) > x.travelEvery && kt(),
    ro(),
    Te.render());
});
document.body.classList.add("ready");
if (he) {
  (xe.setAnimationLoop(null), (pt = 1 / 0));
  for (const e of [0, 0, 1, 0, 2]) Ge(e % V.length);
  for (let e = 0; e < 60 * (+N.get("sim") || 3.4); e++) ao(1 / 60);
  (ro(),
    Te.render(),
    setTimeout(
      () => {
        (Te.render(),
          q.toBlob(
            (e) =>
              fetch(`http://localhost:${N.get("port")}/`, {
                method: "POST",
                body: e,
              }),
            "image/jpeg",
            +(N.get("q") || 0.92),
          ));
      },
      +(N.get("after") || 2e3),
    ));
}
