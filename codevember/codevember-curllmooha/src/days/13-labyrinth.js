import "../lib/modulepreload-polyfill.js";
import {
  aj as Qe,
  az as Ze,
  s as Je,
  z as Ke,
  x as tn,
  P as en,
  aE as nn,
  u as Nt,
  M as on,
  a2 as xt,
  $ as an,
  b as oe,
  m as ae,
  g as se,
  aw as sn,
} from "../lib/stage.js";
import { O as rn } from "../lib/OrbitControls.js";
import { R as Ht } from "../lib/RoundedBoxGeometry.js";
import { a as cn } from "../lib/BufferGeometryUtils.js";
import {
  V as x,
  aO as wt,
  e as T,
  bd as ln,
  S as xe,
  P as hn,
  C as X,
  D as pn,
  H as un,
  M as R,
  a as Gt,
  aQ as fn,
  Y as Bt,
  k as ve,
  d as dn,
  b as Se,
  I as W,
  ar as Wt,
  aD as Yt,
  f as ze,
  az as mn,
  aE as gn,
  c as wn,
  r as vt,
  L as yn,
  p as Ae,
  ba as Mn,
  a3 as Pe,
  b6 as Ft,
  b8 as re,
  bb as bn,
  aB as xn,
  u as vn,
  Q as ke,
  aC as Sn,
  aF as ce,
} from "../lib/leva.js";
import { r as zn } from "../lib/rendering-panel.js";
import { a as An } from "../lib/pcss.js";
import "../lib/three.js";
function It(t) {
  let o = t >>> 0;
  return () => {
    o = (o + 1831565813) >>> 0;
    let n = Math.imul(o ^ (o >>> 15), 1 | o);
    return (
      (n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
function Ce(t, o, n) {
  const i = new Map(t.map((a, f) => [`${a.i},${a.j}`, f])),
    c = [],
    u = new Set();
  return (
    t.forEach((a, f) =>
      o.forEach(([e, s]) => {
        const r = i.get(`${a.i + e},${a.j + s}`) ?? -1,
          l = r < 0 ? `o${f},${e},${s}` : `${Math.min(f, r)}_${Math.max(f, r)}`;
        if (u.has(l)) return;
        u.add(l);
        const h = r >= 0 ? t[r] : m(a.i + e, a.j + s),
          d = (a.x + h.x) / 2,
          p = (a.z + h.z) / 2,
          g = h.x - a.x,
          M = h.z - a.z,
          v = Math.hypot(g, M),
          E = (-M / v) * n,
          I = (g / v) * n;
        c.push({ a: f, b: r, p1: [d - E, p - I], p2: [d + E, p + I] });
      }),
    ),
    c
  );
  function m(a, f) {
    return t.pos(a, f);
  }
}
function Pn(t = 21) {
  const o = (i, c) => ({ x: i - (t - 1) / 2, z: c - (t - 1) / 2 }),
    n = [];
  for (let i = 0; i < t; i++)
    for (let c = 0; c < t; c++) n.push({ i: c, j: i, ...o(c, i) });
  return (
    (n.pos = o),
    {
      name: "Square",
      cells: n,
      edges: Ce(
        n,
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ],
        0.5,
      ),
      bound: t * 0.72,
    }
  );
}
function kn(t = 9) {
  const o = (i, c) => ({ x: i + c / 2, z: (c * Math.sqrt(3)) / 2 }),
    n = [];
  for (let i = -t; i <= t; i++)
    for (let c = -t; c <= t; c++)
      Math.abs(c + i) <= t && n.push({ i: c, j: i, ...o(c, i) });
  return (
    (n.pos = o),
    {
      name: "Hex",
      cells: n,
      edges: Ce(
        n,
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          [1, -1],
          [-1, 1],
        ],
        0.5 / Math.sqrt(3),
      ),
      bound: t + 1,
    }
  );
}
function Ee(t = 11, o = 0, n = 0) {
  const i = [],
    c = [],
    u = [1],
    m = [],
    a = (e, s) => [Math.cos(s) * e, Math.sin(s) * e];
  o || (i.push({ x: 0, z: 0, y: n, ring: 0 }), (m[0] = 0));
  for (let e = 1; e < t; e++) {
    const s = u[e - 1],
      r = e === 1 ? 6 : (2 * Math.PI * e) / s > 1.7 ? s * 2 : s;
    if ((u.push(r), !(e < o))) {
      m[e] = i.length;
      for (let l = 0; l < r; l++) {
        const [h, d] = a(e + 0.5, ((l + 0.5) / r) * 2 * Math.PI);
        i.push({ x: h, z: d, y: n, ring: e });
      }
      for (let l = 0; l < r; l++)
        c.push({
          a: m[e] + l,
          b: m[e] + ((l + 1) % r),
          p1: a(e, ((l + 1) / r) * 2 * Math.PI),
          p2: a(e + 1, ((l + 1) / r) * 2 * Math.PI),
          y: n,
        });
      for (let l = 0; l < r; l++) {
        const h =
          e === o ? -1 : e === 1 ? 0 : m[e - 1] + Math.floor((l * s) / r);
        c.push({
          a: m[e] + l,
          b: h,
          p1: a(e, (l / r) * 2 * Math.PI),
          p2: a(e, ((l + 1) / r) * 2 * Math.PI),
          y: n,
        });
      }
    }
  }
  const f = u[t - 1];
  for (let e = 0; e < f; e++)
    c.push({
      a: m[t - 1] + e,
      b: -1,
      p1: a(t, (e / f) * 2 * Math.PI),
      p2: a(t, ((e + 1) / f) * 2 * Math.PI),
      y: n,
    });
  return {
    name: "Rings",
    cells: i,
    edges: c,
    bound: t + 0.3,
    tiers: [{ y: n, inner: o, outer: t }],
  };
}
function Cn(t = Math.random) {
  const n = [
      [11, 8, 0],
      [7, 4, 1.25],
      [3, 0, 2.5],
    ],
    i = n.map(([e, s, r]) => Ee(e, s, r)),
    c = [],
    u = [],
    m = [];
  i.forEach((e) => {
    const s = c.length;
    (c.push(...e.cells),
      u.push(
        ...e.edges.map((r) => ({
          ...r,
          a: r.a + s,
          b: r.b < 0 ? -1 : r.b + s,
        })),
      ));
  });
  const a = (e) => Math.atan2(e.z, e.x),
    f = (e, s, r) => {
      let l = null;
      return (
        c.forEach((h, d) => {
          if (h.ring !== e || h.y !== s) return;
          const p = Math.abs(
            Math.atan2(Math.sin(a(h) - r), Math.cos(a(h) - r)),
          );
          (!l || p < l.d) && (l = { i: d, d: p });
        }),
        l
      );
    };
  for (let e = 0; e < n.length - 1; e++) {
    const [, s, r] = n[e],
      [l, , h] = n[e + 1],
      d = (s + l) / 2 + 0.06,
      p = f(s, r, t() * Math.PI * 2).i,
      g = a(c[p]),
      M = 7.5 / d,
      v = f(l - 1, h, g + M).i,
      E = a(c[v]) + (a(c[v]) < g ? Math.PI * 2 : 0);
    for (let y = u.length - 1; y >= 0; y--) {
      const A = u[y];
      if (A.ramp) continue;
      const F = Math.hypot(...A.p1);
      A.b < 0 &&
        ((A.a === p && Math.abs(F - s) < 1e-6) ||
          (A.a === v && Math.abs(F - l) < 1e-6)) &&
        u.splice(y, 1);
    }
    const I = (y, A, F) => [Math.cos(A) * y, F, Math.sin(A) * y],
      S = [I(Math.hypot(c[p].x, c[p].z), g, r)];
    for (let y = 0; y <= 24; y++) {
      const A = y / 24,
        F = A * A * (3 - 2 * A);
      S.push(I(d, g + (E - g) * A, r + (h - r) * F));
    }
    S.push(I(Math.hypot(c[v].x, c[v].z), E, h));
    let z = 0;
    for (let y = 1; y < S.length; y++)
      z += Math.hypot(
        S[y][0] - S[y - 1][0],
        S[y][1] - S[y - 1][1],
        S[y][2] - S[y - 1][2],
      );
    (u.push({
      a: p,
      b: v,
      p1: null,
      p2: null,
      y: r,
      ramp: !0,
      path: S,
      length: z,
      arc: { r: d, a0: g, a1: E, y0: r, y1: h },
    }),
      m.push([p, v]));
  }
  return {
    name: "Tower",
    cells: c,
    edges: u,
    bound: 11.3,
    ramps: m,
    tiers: n.map(([e, s, r]) => ({ outer: e, inner: s, y: r })),
  };
}
const Le = {
    Square: () => Pn(),
    Rings: () => Ee(11),
    Hex: () => kn(),
    Tower: Cn,
  },
  Xt = Object.keys(Le);
function En(t, o, n = 0.18) {
  const i = It(o),
    c = Le[t](i),
    { cells: u, edges: m } = c,
    a = u.map(() => []);
  m.forEach((p, g) => {
    (a[p.a].push(g), p.b >= 0 && a[p.b].push(g));
  });
  const f = new Uint8Array(m.length),
    e = (p, g) => (m[p].a === g ? m[p].b : m[p].a),
    s = new Uint8Array(u.length),
    r = [Math.floor(i() * u.length)];
  for (s[r[0]] = 1; r.length; ) {
    const p = r[r.length - 1],
      g = a[p].filter((v) => m[v].b >= 0 && !s[e(v, p)]);
    if (!g.length) {
      r.pop();
      continue;
    }
    const M = g[Math.floor(i() * g.length)];
    ((f[M] = 1), (s[e(M, p)] = 1), r.push(e(M, p)));
  }
  (u.forEach((p, g) => {
    if (a[g].filter((v) => f[v]).length !== 1 || i() > n) return;
    const M = a[g].filter((v) => !f[v] && m[v].b >= 0);
    M.length && (f[M[Math.floor(i() * M.length)]] = 1);
  }),
    m.forEach((p, g) => {
      p.ramp && (f[g] = 1);
    }));
  for (const p of u) p.y ??= 0;
  m.forEach((p) => {
    ((p.y ??= 0), (p.y1 ??= p.y), (p.y2 ??= p.y));
  });
  const l = {
    ...c,
    tiers: c.tiers ?? [{ y: 0 }],
    cellEdges: a,
    open: f,
    other: e,
    nest: 0,
    food: 0,
  };
  l.linkLen = new Map(
    m
      .filter((p) => p.ramp)
      .flatMap((p) => [
        [`${p.a}_${p.b}`, p.length],
        [`${p.b}_${p.a}`, p.length],
      ]),
  );
  const h = Math.min(...u.map((p) => p.y)),
    d = u.reduce(
      (p, g, M) =>
        g.y === h &&
        (p < 0 || g.z - Math.abs(g.x) * 0.3 > u[p].z - Math.abs(u[p].x) * 0.3)
          ? M
          : p,
      -1,
    );
  return (
    (l.nest = d),
    (l.food =
      t === "Rings"
        ? 0
        : t === "Tower"
          ? u.findIndex((p) => p.ring === 0)
          : Ln(l, d)),
    l
  );
}
function Ct(t, o) {
  const n = [];
  for (const i of t.cellEdges[o])
    t.open[i] && t.edges[i].b >= 0 && n.push(t.other(i, o));
  return n;
}
const jt = (t, o, n) =>
  t.linkLen?.get(`${o}_${n}`) ??
  (Math.hypot(
    t.cells[o].x - t.cells[n].x,
    t.cells[o].y - t.cells[n].y,
    t.cells[o].z - t.cells[n].z,
  ) ||
    1);
function le(t, o, n) {
  return t.edges[o].b < 0 ? !1 : ((t.open[o] = n ? 0 : 1), !0);
}
function Ie(t, o) {
  const n = new Int32Array(t.cells.length).fill(-1),
    i = [o];
  n[o] = 0;
  for (let c = 0; c < i.length; c++)
    for (const u of Ct(t, i[c])) n[u] < 0 && ((n[u] = n[i[c]] + 1), i.push(u));
  return { dist: n, q: i };
}
function Ln(t, o) {
  const { q: n } = Ie(t, o);
  return n[n.length - 1];
}
const Vt = (t) => Ie(t, t.nest).dist[t.food];
function In(t, o, n) {
  const i = It(n ^ 2654435769),
    c = new Float32Array(t.cells.length),
    u = Array.from({ length: o }, () => ({
      from: t.nest,
      to: t.nest,
      t: 1,
      path: [t.nest],
      carrying: !1,
      wait: i() * 14,
      speed: 0.85 + i() * 0.3,
      trip: 0,
    }));
  return { m: t, ants: u, scent: c, rand: i, delivered: 0, best: 1 / 0 };
}
function Et(t, o, { pace: n = 2.4, evaporate: i = 0.06, follow: c = 2 } = {}) {
  const { m: u, ants: m, scent: a } = t,
    f = Math.exp(-i * o);
  for (let e = 0; e < a.length; e++) a[e] *= f;
  for (const e of m) {
    if (e.wait > 0) {
      e.wait -= o;
      continue;
    }
    e.t += (o * n * e.speed) / jt(u, e.from, e.to);
    let s = 0;
    for (; e.t >= 1 && s++ < 8; ) {
      e.t -= 1;
      const r = e.from;
      e.from = e.to;
      const l = e.from;
      if (e.carrying)
        ((a[l] += (6 / Math.max(1, e.trip)) * (t.best / e.trip) ** 3),
          l === u.nest &&
            ((e.carrying = !1), (e.path = [u.nest]), t.delivered++));
      else {
        const h = e.path.lastIndexOf(l);
        (h >= 0 ? (e.path.length = h + 1) : e.path.push(l),
          l === u.food &&
            ((e.carrying = !0),
            (e.trip = e.path.length - 1),
            (t.best = Math.min(t.best, e.trip))));
      }
      ((e.to = Tn(t, e, l, r, c)), (e.t *= jt(u, r, l) / jt(u, e.from, e.to)));
    }
  }
}
function Tn(t, o, n, i, c) {
  const { m: u, scent: m, rand: a } = t;
  if (o.carrying) {
    const l = o.path.lastIndexOf(n);
    if (l > 0 && Ct(u, n).includes(o.path[l - 1]))
      return ((o.path.length = l), o.path[l - 1]);
    ((o.carrying = !1), (o.path = [n]));
  }
  const f = Ct(u, n);
  if (!f.length) return n;
  const e = f.length > 1 ? f.filter((l) => l !== i) : f,
    s = e.map((l) => (0.04 + m[l]) ** c);
  let r = a() * s.reduce((l, h) => l + h, 0);
  for (let l = 0; l < e.length; l++) if (((r -= s[l]), r <= 0)) return e[l];
  return e[e.length - 1];
}
const Te = 20,
  K = 12.4,
  ut = [13.1, 19.3],
  ie = (t) => t * t * (3 - 2 * t),
  Rt = (t) => ((t = T.clamp(t, 0, 1)), t * t * t * (t * (t * 6 - 15) + 10));
function $n(t, o) {
  const n = new Map([[t.nest, -1]]),
    i = [t.nest];
  for (let a = 0; a < i.length; a++)
    for (const f of Ct(t, i[a])) n.has(f) || (n.set(f, i[a]), i.push(f));
  const c = [];
  for (let a = t.food; a >= 0; a = n.get(a)) c.push(a);
  c.reverse();
  let u = [new x(t.cells[c[0]].x, t.cells[c[0]].y, t.cells[c[0]].z)];
  for (let a = 1; a < c.length; a++) {
    const f = o.get(c[a - 1] * 1e5 + c[a]);
    if (f)
      for (let e = 1; e <= 24; e++)
        u.push(f.curve.getPointAt(f.reverse ? 1 - e / 24 : e / 24));
    else {
      const e = t.cells[c[a]];
      u.push(new x(e.x, e.y, e.z));
    }
  }
  for (let a = 0; a < 3; a++) {
    const f = [u[0]];
    for (let e = 0; e < u.length - 1; e++)
      f.push(
        u[e].clone().lerp(u[e + 1], 0.25),
        u[e].clone().lerp(u[e + 1], 0.75),
      );
    (f.push(u.at(-1)), (u = f));
  }
  const m = new wt(u, !1, "centripetal");
  return ((m.arcLengthDivisions = 6e3), m);
}
function Fn(t, o, n) {
  const i = $n(t, o),
    c = i.getLength(),
    u = c - 0.9,
    m = (S) => i.getPointAt(T.clamp(S / c, 0, 1)),
    a = new x(t.cells[t.food].x, t.cells[t.food].y, t.cells[t.food].z),
    f = 0.19,
    e = new x(),
    s = new x(),
    r = new x(),
    l = (S) => u * ie(T.clamp(S / K, 0, 1)),
    h = (1.5 * u) / K,
    d = (S) => {
      const z = m(S + 0.05).sub(m(S));
      return Math.atan2(z.x, z.z);
    };
  function p(S) {
    const z = l(S);
    (e.copy(m(z)),
      (e.y += f + Math.sin(z * 9) * 0.004),
      s.copy(m(z + 1.5 + 0.35 * Math.min(1, z / 6))),
      (s.y += f * 0.6));
    const y = ie(T.clamp((S - (K - 1.8)) / 1.8, 0, 1));
    s.lerp(r.copy(a).setY(a.y + 0.2), y * 0.85);
    const A = Math.atan2(
        Math.sin(d(z + 1.2) - d(Math.max(0, z - 1.2))),
        Math.cos(d(z + 1.2) - d(Math.max(0, z - 1.2))),
      ),
      F = (l(S + 0.01) - l(S)) / 0.01;
    return {
      position: e.clone(),
      target: s.clone(),
      roll: T.clamp(-A * 0.5, -0.16, 0.16) + Math.sin(z * 4.7) * 0.004,
      fov: 62 + 26 * T.clamp(F / h, 0, 1),
      speed: F,
    };
  }
  const g = p(ut[0]),
    M = {
      position: n.position
        .clone()
        .sub(n.target)
        .multiplyScalar(0.8)
        .add(n.target),
      target: n.target.clone(),
      fov: n.fov,
    },
    v = a.clone().add(new x(0.9, 3.2, 1.7)),
    E = new wt(
      [
        g.position,
        v,
        new x().lerpVectors(v, M.position, 0.55).add(new x(0, 3, 0)),
        M.position,
      ],
      !1,
      "centripetal",
    ),
    I = new wt(
      [
        g.target,
        a.clone().add(new x(0, 0.3, 0)),
        new x().lerpVectors(a, M.target, 0.5),
        M.target,
      ],
      !1,
      "centripetal",
    );
  return function (z) {
    if (((z = T.clamp(z, 0, Te)), z < ut[0])) return p(Math.min(z, K));
    const y = Rt((z - ut[0]) / (ut[1] - ut[0])),
      A = T.lerp(g.fov, M.fov, Rt(y * 1.15));
    return {
      position: E.getPoint(y),
      target: I.getPoint(y),
      roll: g.roll * (1 - Rt(y * 3)),
      fov: A,
      speed: 0,
    };
  };
}
const jn = (t) => T.clamp(t / 0.9, 0, 1) * T.clamp((Te - t) / 0.7, 0, 1),
  k = new URLSearchParams(location.search),
  V = k.has("thumb"),
  yt = k.has("capture");
(V || yt) && document.body.classList.add("capture");
const $e = {
    Porcelain: {
      base: "#efece6",
      rough: 0.28,
      clear: 0.9,
      grain: 0.03,
      trail: "#b98a4a",
    },
    Terracotta: {
      base: "#bd6440",
      rough: 0.82,
      clear: 0,
      grain: 0.1,
      trail: "#5e2412",
    },
    Basalt: {
      base: "#2b2c2f",
      rough: 0.55,
      clear: 0.3,
      grain: 0.12,
      trail: "#b08a4e",
    },
    Sandstone: {
      base: "#d6bb8e",
      rough: 0.9,
      clear: 0,
      grain: 0.16,
      trail: "#8f4f22",
    },
    Walnut: {
      base: "#7a4c2b",
      rough: 0.4,
      clear: 0.7,
      grain: 0,
      wood: 1,
      trail: "#2a160a",
    },
  },
  Qt = {
    "Black garden ants": { body: "#1c130e", size: 1, speed: 1, carry: "sugar" },
    "Fire ants": { body: "#8e2b12", size: 0.85, speed: 1.25, carry: "sugar" },
    "Leafcutter ants": {
      body: "#7b3a17",
      size: 1.15,
      speed: 0.85,
      carry: "leaf",
    },
    "Carpenter ants": {
      body: "#0d0c0c",
      size: 1.35,
      speed: 0.8,
      carry: "seed",
    },
    "Weaver ants": { body: "#c7792c", size: 1.05, speed: 1.05, carry: "sugar" },
  },
  Zt = Object.keys($e),
  Jt = Object.keys(Qt),
  qt = (t, o) => (o.includes(t) ? t : "Random"),
  b = {
    layout: qt(k.get("maze") ?? "Tower", Xt),
    finish: qt(k.get("finish") ?? "Sandstone", Zt),
    species: qt(k.get("species") ?? "Black garden ants", Jt),
    ants: Math.min(600, Math.max(50, Number(k.get("ants")) || 320)),
    speed: 1.5,
    evaporate: 0.06,
    trail: !0,
  };
let pt = k.has("seed") ? Number(k.get("seed")) : 13;
const Ot = (t, o, n) =>
    t !== "Random" ? t : o[Math.floor(It(pt * 31 + n)() * o.length)],
  $ = await Qe();
$.shadowMap.type = ln;
$.setPixelRatio(Math.min(devicePixelRatio, 1.5));
const N = $.domElement;
N.id = "view";
N.setAttribute("tabindex", "0");
const q = new xe(),
  P = new hn(28, innerWidth / innerHeight, 0.1, 300),
  Fe = new X("#d9d8d5");
q.backgroundNode = Ze(Fe.clone().multiplyScalar(1.9)).mul(
  Je(0.05, 0.9, Ke(tn.sub(0.5)))
    .mul(-0.38)
    .add(1),
);
const D = new rn(P, N);
D.enableDamping = !0;
D.enablePan = !1;
D.maxPolarAngle = Math.PI * 0.42;
const je = new x(-0.55, 0.72, 0.42).normalize();
{
  const t = new xe();
  t.background = Fe.clone().multiplyScalar(1.05);
  const o = (i, c, u, m) => {
    const a = new R(new Gt(i, c), new Se({ color: m }));
    (a.position.copy(u).multiplyScalar(10), a.lookAt(0, 0, 0), t.add(a));
  };
  (o(8, 7, je, new X(4.6, 4.2, 3.6)),
    o(3, 12, new x(0.9, 0.3, -0.5).normalize(), new X(2.4, 2.4, 2.5)),
    o(16, 2, new x(0, 0.15, 1).normalize(), new X(1.8, 1.7, 1.6)));
  const n = new en($);
  ((q.environment = n.fromScene(t, 0.035).texture),
    (q.environmentIntensity = 0.65),
    n.dispose());
}
const j = new pn(16773340, 2.6);
j.castShadow = !0;
j.shadow.mapSize.set(2048, 2048);
j.shadow.bias = -4e-4;
j.shadow.normalBias = 0.03;
q.add(j, j.target, new un(16774374, 8018490, 0.45));
const Rn = An(j, { renderer: $, lightSize: 0.4 }),
  bt = new R(new Gt(400, 400), new nn({ color: 3811866, opacity: 0.22 }));
bt.rotation.x = -Math.PI / 2;
bt.position.y = -1;
bt.receiveShadow = !0;
q.add(bt);
const Re = Nt(new X()),
  qe = Nt(0.1),
  Oe = Nt(0),
  Z = new on({ clearcoatRoughness: 0.12 });
{
  const t = an,
    o = xt(t.mul(9))
      .mul(0.6)
      .add(xt(t.mul(70)).mul(0.4)),
    n = t.z
      .mul(9)
      .add(xt(t.mul(oe(0.25, 2.5, 2.5))).mul(6))
      .sin()
      .mul(0.5)
      .add(0.5),
    i = ae(se(0.75), se(1.1), n.pow(1.4)).mul(
      xt(t.mul(oe(2, 80, 80)))
        .mul(0.1)
        .add(1),
    );
  Z.colorNode = Re.mul(ae(o.mul(qe).add(1), i, Oe));
}
const qn = (() => {
    const t = document.createElement("canvas");
    t.width = t.height = 64;
    const o = t.getContext("2d"),
      n = o.createRadialGradient(32, 32, 0, 32, 32, 32);
    return (
      n.addColorStop(0, "#fff"),
      n.addColorStop(0.55, "#ffffffaa"),
      n.addColorStop(1, "#fff0"),
      (o.fillStyle = n),
      o.fillRect(0, 0, 64, 64),
      new fn(t)
    );
  })(),
  he = new Bt({
    roughness: 0.6,
    transparent: !0,
    opacity: 0.62,
    depthWrite: !1,
    alphaMap: qn,
  }),
  Kt = new ve({ roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
  Ue = new ve({
    color: 16777215,
    roughness: 0.18,
    transmission: 0.25,
    thickness: 0.1,
  }),
  _e = new Bt({ color: 6265394, roughness: 0.6, side: dn }),
  De = new Bt({ color: 13146714, roughness: 0.45 }),
  On = new Se({ color: 1182213 });
function Un() {
  const t = [],
    o = (c, u, m, a, f, e) =>
      t.push(new Wt(1, 9, 6).scale(c, u, m).translate(a, f, e));
  (o(0.05, 0.04, 0.072, 0, 0.05, 0.085),
    o(0.016, 0.016, 0.02, 0, 0.045, 0.02),
    o(0.026, 0.024, 0.042, 0, 0.05, -0.02),
    o(0.033, 0.028, 0.031, 0, 0.05, -0.076));
  const n = (c, u, m, a, f, e, s) => {
    const r = new x(c, u, m),
      l = new x(a, f, e),
      h = r.distanceTo(l),
      d = new Sn(s, s * 0.8, h, 4, 1, !0).translate(0, h / 2, 0);
    (d.applyQuaternion(
      new ke().setFromUnitVectors(new x(0, 1, 0), l.clone().sub(r).normalize()),
    ),
      t.push(d.translate(r.x, r.y, r.z)));
  };
  for (const c of [-1, 1])
    for (const [u, m] of [
      [-0.035, -0.085],
      [-0.02, -0.005],
      [-0.005, 0.075],
    ]) {
      const a = c * 0.06,
        f = (u + m) / 2;
      (n(0, 0.05, u, a, 0.065, f, 0.0055),
        n(a, 0.065, f, c * 0.09, 0, m, 0.004));
    }
  for (const c of [-1, 1])
    (n(0.012 * c, 0.062, -0.098, c * 0.03, 0.09, -0.13, 0.003),
      n(c * 0.03, 0.09, -0.13, c * 0.05, 0.075, -0.165, 0.0025));
  const i = cn(t.map((c) => (c.deleteAttribute("uv"), c)));
  return (t.forEach((c) => c.dispose()), i);
}
const Ne = Un(),
  dt = 600,
  rt = new W(Ne, Kt, dt);
rt.castShadow = !0;
const Tt = {
  sugar: new W(new Ht(0.065, 0.065, 0.065, 1, 0.012), Ue, dt),
  leaf: new W(new Yt(0.09, 10).scale(0.8, 1, 1), _e, dt),
  seed: new W(new Wt(0.045, 10, 8).scale(0.7, 0.7, 1.2), De, dt),
};
for (const t of Object.values(Tt)) t.castShadow = !0;
q.add(rt, ...Object.values(Tt));
let it = new Map(),
  Lt = !0,
  ht = 1,
  O = null,
  w,
  C,
  te = 0,
  At,
  mt,
  _,
  Ut = null,
  tt,
  ct,
  Y,
  J,
  st = [],
  B;
const _t = 0.42,
  ft = 0.16,
  lt = { soil: new X(), trail: new X() };
function gt() {
  (O && (q.remove(O), O.traverse((h) => h.geometry?.dispose())),
    (_ = Ot(b.layout, Xt, 1)),
    (At = Ot(b.finish, Zt, 2)),
    (mt = Ot(b.species, Jt, 3)),
    (w = En(_, pt)),
    (O = new Pe()));
  const t = $e[At],
    o = Qt[mt];
  (Re.value.set(t.base),
    (qe.value = t.grain),
    (Oe.value = t.wood ?? 0),
    Object.assign(Z, { roughness: t.rough, clearcoat: t.clear }),
    lt.soil.set(t.base),
    lt.trail.set(t.trail),
    Kt.color.set(o.body));
  const n = new Ft(),
    i = 0.42;
  if (_ === "Rings") n.absarc(0, 0, w.bound + i - 0.3, 0, Math.PI * 2, !1);
  else if (_ === "Hex") {
    const h = w.bound + i - 0.45;
    for (let d = 0; d <= 6; d++) {
      const p = (d / 6) * Math.PI * 2,
        g = Math.cos(p) * h,
        M = Math.sin(p) * h;
      d ? n.lineTo(g, M) : n.moveTo(g, M);
    }
  } else {
    const h = Math.sqrt(w.cells.length) / 2 + i;
    n.moveTo(-h, -h).lineTo(h, -h).lineTo(h, h).lineTo(-h, h).lineTo(-h, -h);
  }
  const c = 0.7,
    u = {
      bevelEnabled: !0,
      bevelSize: 0.12,
      bevelThickness: 0.12,
      bevelSegments: 6,
      curveSegments: 120,
    },
    m =
      _ === "Tower"
        ? w.tiers.map((h) => [
            new Ft().absarc(0, 0, h.outer + 0.12, 0, Math.PI * 2, !1),
            h.y,
          ])
        : [[n, 0]];
  for (const [h, d] of m) {
    const p = new R(
      new re(h, { depth: c + d, ...u })
        .rotateX(Math.PI / 2)
        .translate(0, d - 0.12, 0),
      Z,
    );
    ((p.castShadow = p.receiveShadow = !0), O.add(p));
  }
  it = new Map();
  for (const h of w.edges)
    if (h.ramp) {
      const d = new wt(
        h.path.map((Q) => new x(...Q)),
        !1,
        "centripetal",
      );
      (it.set(h.a * 1e5 + h.b, { curve: d, reverse: !1 }),
        it.set(h.b * 1e5 + h.a, { curve: d, reverse: !0 }));
      const { r: p, a0: g, a1: M, y0: v, y1: E } = h.arc,
        I = [];
      for (let Q = 0; Q <= 64; Q++) {
        const nt = Q / 64,
          Ve = nt * nt * (3 - 2 * nt),
          ne = g + (M - g) * nt;
        I.push(
          new x(Math.cos(ne) * p, v + (E - v) * Ve - 0.03, Math.sin(ne) * p),
        );
      }
      const S = new wt(I),
        z = S.computeFrenetFrames(1).binormals[0].y < 0 ? -1 : 1,
        y = 0.42,
        A = 0.13,
        F = new Ft(
          [
            [-y, -0.06],
            [y, -0.06],
            [y, A],
            [y - 0.07, A],
            [y - 0.07, 0.03],
            [-y + 0.07, 0.03],
            [-y + 0.07, A],
            [-y, A],
          ].map(([Q, nt]) => new ze(Q, nt * z)),
        ),
        $t = new R(
          new re(F, { steps: 64, bevelEnabled: !1, extrudePath: S }),
          Z,
        );
      (($t.castShadow = $t.receiveShadow = !0), O.add($t));
    }
  const a = w.bound + 1.2;
  ((bt.position.y = -c - 0.24),
    Object.assign(j.shadow.camera, {
      left: -a - 1,
      right: a + 1,
      top: a + 1,
      bottom: -a - 1,
      near: 10,
      far: 90,
    }),
    j.position.copy(je).multiplyScalar(40),
    j.shadow.camera.updateProjectionMatrix());
  const f = w.edges;
  ((tt = new W(new Ht(1, 1, ft, 2, ft * 0.48), Z, f.length)),
    (tt.castShadow = tt.receiveShadow = !0),
    (B = new Float32Array(f.length).map((h, d) => (w.open[d] ? 0 : 1))),
    (Lt = !0));
  const e = new Map();
  ((st = []),
    f.forEach(
      (h, d) =>
        !h.ramp &&
        [h.p1, h.p2].forEach((p) => {
          const g = `${p[0].toFixed(3)},${p[1].toFixed(3)},${h.y}`;
          (e.has(g) ||
            (e.set(g, st.length),
            st.push({ x: p[0], z: p[1], y: h.y, edges: [] })),
            st[e.get(g)].edges.push(d));
        }),
    ),
    (ct = new W(
      new bn(ft * 0.52, _t - ft * 0.52, 3, 10).translate(
        0,
        (_t - ft * 0.52) / 2,
        0,
      ),
      Z,
      st.length,
    )),
    (ct.castShadow = ct.receiveShadow = !0),
    (Y = new W(new Gt(1, 1).rotateX(-Math.PI / 2), he, w.cells.length)),
    (Y.receiveShadow = !0),
    (J = new W(Y.geometry, he, f.length)),
    O.add(tt, ct, Y, J));
  const s = w.cells[w.nest],
    r = new R(new Yt(0.18, 32).rotateX(-Math.PI / 2), On);
  r.position.set(s.x, s.y + 0.006, s.z);
  const l = new R(
    new xn(0.25, 0.07, 12, 40).rotateX(Math.PI / 2).scale(1, 0.5, 1),
    Z,
  );
  (l.position.set(s.x, s.y + 0.01, s.z),
    (l.castShadow = l.receiveShadow = !0),
    (Ut = _n(o.carry)),
    O.add(r, l, Ut),
    He(),
    q.add(O));
  for (const [h, d] of Object.entries(Tt)) d.visible = h === o.carry;
  (Dt(),
    (ht = 1),
    Be(),
    V || history.replaceState(null, "", `?seed=${pt}`),
    N.setAttribute(
      "aria-label",
      `A ${_.toLowerCase()} labyrinth carved in one block of ${w.cells.length} cells in ${At.toLowerCase()}, and ${b.ants} ${mt.toLowerCase()} exploring it. Their scent slowly picks out the shortest way from the nest to the food. Click a wall to knock it down or put it back; click a corridor to move the food.`,
    ));
}
function _n(t) {
  const o = new Pe(),
    n = It(pt + 5);
  for (let i = 0; i < 10; i++) {
    const c = i * 2.4,
      u = i < 7 ? 0.12 + (i % 2) * 0.06 : 0.04,
      m = i >= 7;
    let a;
    (t === "sugar"
      ? (a = new R(new Ht(0.13, 0.13, 0.13, 2, 0.02), Ue))
      : t === "leaf"
        ? (a = new R(
            new Yt(0.16, 12).scale(0.6, 1, 1).rotateX(-Math.PI / 2),
            _e,
          ))
        : (a = new R(new Wt(0.07, 12, 10).scale(0.7, 0.7, 1.2), De)),
      a.position.set(
        Math.cos(c) * u,
        t === "leaf" ? 0.02 + i * 0.012 : m ? 0.17 : 0.065,
        Math.sin(c) * u,
      ),
      a.rotation.set(n() * 0.5 - 0.25, n() * Math.PI * 2, n() * 0.5 - 0.25),
      (a.castShadow = a.receiveShadow = !0),
      o.add(a));
  }
  return o;
}
function He() {
  const t = w.cells[w.food];
  Ut.position.set(t.x, t.y, t.z);
}
function Dt() {
  ((C = In(w, b.ants, pt)), (te = Vt(w)));
}
function pe() {
  ((C.best = 1 / 0), (te = Vt(w)));
}
const ue = new mn(),
  fe = new ze(),
  de = new gn(new x(0, 1, 0), 0),
  U = new x();
let Pt = null;
N.addEventListener("pointerdown", (t) => {
  Pt = { x: t.clientX, y: t.clientY };
});
N.addEventListener("pointerup", (t) => {
  if (!Pt || Math.hypot(t.clientX - Pt.x, t.clientY - Pt.y) > 5) return;
  const o = N.getBoundingClientRect();
  (fe.set(
    ((t.clientX - o.left) / o.width) * 2 - 1,
    -((t.clientY - o.top) / o.height) * 2 + 1,
  ),
    ue.setFromCamera(fe, P));
  const n = [...w.tiers]
    .sort((a, f) => f.y - a.y)
    .find((a) => {
      if (((de.constant = -a.y), !ue.ray.intersectPlane(de, U))) return !1;
      const f = Math.hypot(U.x, U.z);
      return (
        a.outer === void 0 || (f <= a.outer + 0.1 && f >= (a.inner || 0) - 0.1)
      );
    });
  if (!n) return;
  let i = -1,
    c = 0.2;
  if (
    (w.edges.forEach((a, f) => {
      if (a.ramp || Math.abs(a.y - n.y) > 0.001) return;
      const [e, s] = a.p1,
        [r, l] = a.p2,
        h = r - e,
        d = l - s,
        p = Math.max(
          0,
          Math.min(1, ((U.x - e) * h + (U.z - s) * d) / (h * h + d * d)),
        ),
        g = Math.hypot(U.x - e - h * p, U.z - s - d * p);
      g < c && ((c = g), (i = f));
    }),
    i >= 0)
  ) {
    le(w, i, !!w.open[i]) && (Vt(w) < 0 && le(w, i, !1), pe(), (Lt = !0));
    return;
  }
  let u = -1,
    m = 0.7;
  (w.cells.forEach((a, f) => {
    const e = Math.hypot(a.x - U.x, a.z - U.z);
    Math.abs(a.y - n.y) < 0.001 && e < m && ((m = e), (u = f));
  }),
    u >= 0 && u !== w.nest && ((w.food = u), He(), pe()));
});
function ee() {
  (pt++, gt());
}
addEventListener("keydown", (t) => {
  if (t.target.closest?.("#controls, input")) return;
  const o = t.key.toLowerCase();
  if (o === "r") ee();
  else if (o === "t")
    ((b.trail = !b.trail), Ge({ "Scent trail (T)": b.trail }));
  else return;
  t.preventDefault();
});
document.querySelector("#random").addEventListener("click", ee);
let Ge = () => {};
function Dn() {
  const [, t] = vn(() => ({
    "New labyrinth (R)": ce(ee),
    Maze: {
      value: b.layout,
      options: ["Random", ...Xt],
      onChange: (o, n, { initial: i }) => {
        !i && o !== b.layout && ((b.layout = o), gt());
      },
    },
    Finish: {
      value: b.finish,
      options: ["Random", ...Zt],
      onChange: (o, n, { initial: i }) => {
        !i && o !== b.finish && ((b.finish = o), gt());
      },
    },
    Species: {
      value: b.species,
      options: ["Random", ...Jt],
      onChange: (o, n, { initial: i }) => {
        !i && o !== b.species && ((b.species = o), gt());
      },
    },
    Ants: {
      value: b.ants,
      min: 50,
      max: dt,
      step: 10,
      onChange: (o, n, { initial: i }) => {
        !i && o !== b.ants && ((b.ants = o), Dt());
      },
    },
    Speed: {
      value: b.speed,
      min: 0.25,
      max: 8,
      step: 0.05,
      onChange: (o) => {
        b.speed = o;
      },
    },
    "Scent fades": {
      value: b.evaporate,
      min: 0.01,
      max: 0.3,
      step: 0.005,
      onChange: (o) => {
        b.evaporate = o;
      },
    },
    "Scent trail (T)": {
      value: b.trail,
      onChange: (o) => {
        b.trail = o;
      },
    },
    "Fresh colony": ce(Dt),
    ...zn({ renderer: $, pipeline: et, lights: [j], pcss: [Rn] }),
  }));
  return ((Ge = t), null);
}
const et = sn($, q, P, {
  aoStrength: 1,
  aoRadius: 0.2,
  aoThickness: 0.3,
  bloomStrength: 0.02,
  vignette: 0.14,
  grain: 0.005,
});
et.look.contrast.value = 1.12;
function Be() {
  const t = T.degToRad(P.fov),
    n =
      (((w.bound + 1.6) * 1.08) / Math.tan(t / 2)) * Math.max(1, 1 / P.aspect);
  (P.position
    .set(0, 0.8, 0.72)
    .normalize()
    .multiplyScalar(n)
    .add(new x(0, _ === "Tower" ? 1.1 : 0, 0)),
    D.target.set(0, _ === "Tower" ? 1.1 : 0, 0.35),
    (D.minDistance = n * 0.3),
    (D.maxDistance = n * 1.6),
    D.update());
}
function We() {
  const t = V ? 1e3 : yt ? +k.get("w") : innerWidth,
    o = V ? 1e3 : yt ? +k.get("h") : innerHeight;
  ($.setSize(t, o, !V),
    (P.aspect = t / o),
    P.updateProjectionMatrix(),
    w && Be());
}
const me = document.querySelector("#label strong"),
  Nn = document.querySelector("#label span");
addEventListener("resize", We);
We();
gt();
V ||
  wn.createRoot(document.querySelector("#controls")).render(
    vt.createElement(
      vt.Fragment,
      null,
      vt.createElement(yn, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      vt.createElement(Dn),
    ),
  );
const Mt = { js: 0, frame: 0 };
k.has("debug") &&
  (window.lab = {
    get colony() {
      return C;
    },
    get maze() {
      return w;
    },
    stats: Mt,
  });
if (V)
  for (let t = 0; t < 160; t += 1 / 30)
    Et(C, 1 / 30, { evaporate: b.evaporate });
const ot = new Ae(),
  H = new ke(),
  ge = new x(0, 1, 0),
  L = new x(),
  at = new x(),
  G = new Ae().makeScale(0, 0, 0),
  we = new X(),
  ye = new x(),
  Hn = new x();
let Me = "",
  St = 0,
  zt = 1;
const kt = new x();
let Ye = !1;
const Gn = new Mn();
let be = performance.now();
function Xe(t) {
  const o = performance.now();
  St += t;
  let n = t * b.speed;
  for (; n > 1e-6; ) {
    const e = Math.min(n, 0.03333333333333333);
    (Et(C, e, { evaporate: b.evaporate }), (n -= e));
  }
  if (
    ((zt += ((b.trail ? 1 : 0) - zt) * Math.min(1, t * 4)),
    (ht += t),
    ht >= 0.1)
  ) {
    ht = 0;
    let e = 1e-6;
    for (const s of C.scent) e = Math.max(e, s);
    (w.cells.forEach((s, r) => {
      const l = Math.sqrt(C.scent[r] / e) * zt;
      if (l < 0.02) {
        Y.setMatrixAt(r, G);
        return;
      }
      (Y.setMatrixAt(
        r,
        ot.compose(
          L.set(s.x, s.y + 0.004 + l * 0.002, s.z),
          H.identity(),
          at.setScalar(0.8 + l * 0.3),
        ),
      ),
        Y.setColorAt(r, we.copy(lt.soil).lerp(lt.trail, Math.min(1, l * 1.1))));
    }),
      w.edges.forEach((s, r) => {
        if (!w.open[r] || s.b < 0 || s.ramp) {
          J.setMatrixAt(r, G);
          return;
        }
        const l = Math.sqrt(Math.min(C.scent[s.a], C.scent[s.b]) / e) * zt;
        if (l < 0.02) {
          J.setMatrixAt(r, G);
          return;
        }
        const h = w.cells[s.a],
          d = w.cells[s.b];
        (J.setMatrixAt(
          r,
          ot.compose(
            L.set((h.x + d.x) / 2, h.y + 0.0045, (h.z + d.z) / 2),
            H.identity(),
            at.setScalar(0.8 + l * 0.3),
          ),
        ),
          J.setColorAt(
            r,
            we.copy(lt.soil).lerp(lt.trail, Math.min(1, l * 1.1)),
          ));
      }));
    for (const s of [Y, J])
      ((s.instanceMatrix.needsUpdate = !0),
        s.instanceColor && (s.instanceColor.needsUpdate = !0));
  }
  if (Lt) {
    let e = !0;
    (w.edges.forEach((s, r) => {
      const l = w.open[r] ? 0 : 1;
      if (
        ((B[r] += (l - B[r]) * Math.min(1, t * 8)),
        Math.abs(l - B[r]) > 0.002 ? (e = !1) : (B[r] = l),
        s.ramp || B[r] < 0.02)
      ) {
        tt.setMatrixAt(r, G);
        return;
      }
      const [h, d] = s.p1,
        [p, g] = s.p2,
        M = B[r] * _t;
      (H.setFromAxisAngle(ge, -Math.atan2(g - d, p - h)),
        tt.setMatrixAt(
          r,
          ot.compose(
            L.set((h + p) / 2, s.y + M / 2, (d + g) / 2),
            H,
            at.set(Math.hypot(p - h, g - d), M, 1),
          ),
        ));
    }),
      (tt.instanceMatrix.needsUpdate = !0),
      st.forEach((s, r) => {
        let l = 0;
        for (const h of s.edges) l = Math.max(l, B[h]);
        ct.setMatrixAt(
          r,
          l < 0.02
            ? G
            : ot.compose(L.set(s.x, s.y, s.z), H.identity(), at.set(1, l, 1)),
        );
      }),
      (ct.instanceMatrix.needsUpdate = !0),
      (Lt = !e));
  }
  const i = Qt[mt],
    c = Tt[i.carry];
  let u = 0;
  (C.ants.forEach((e, s) => {
    if (e.wait > 0) {
      (rt.setMatrixAt(s, G), c.setMatrixAt(s, G));
      return;
    }
    const r = w.cells[e.from],
      l = w.cells[e.to];
    let h = l.x - r.x,
      d = l.z - r.z,
      p = Math.hypot(h, d) || 1;
    const g = it.size ? it.get(e.from * 1e5 + e.to) : void 0,
      M = (((s * 0.618) % 1) - 0.5) * 0.22 + Math.sin(St * 6 + s) * 0.012;
    if (
      (L.set(
        r.x + h * e.t - (d / p) * M,
        r.y + (l.y - r.y) * e.t + Math.abs(Math.sin(St * 20 + s)) * 0.005,
        r.z + d * e.t + (h / p) * M,
      ),
      g)
    ) {
      const E = Math.min(1, Math.max(0, g.reverse ? 1 - e.t : e.t));
      g.curve.getPointAt(E, L);
      const I = g.curve.getTangentAt(E, Hn).multiplyScalar(g.reverse ? -1 : 1);
      ((h = I.x),
        (d = I.z),
        (p = Math.hypot(h, d) || 1),
        (L.x -= (d / p) * M * 0.6),
        (L.z += (h / p) * M * 0.6));
    }
    H.setFromAxisAngle(
      ge,
      Math.atan2(-h, -d) + Math.sin(St * 9 + s * 1.7) * 0.16,
    );
    const v = Ye
      ? T.smoothstep(
          Math.hypot(L.x - kt.x, L.y + 0.1 - kt.y, L.z - kt.z),
          0.25,
          0.6,
        )
      : 1;
    if (
      (rt.setMatrixAt(s, ot.compose(L, H, at.setScalar(1.6 * i.size * v))),
      e.carrying)
    ) {
      const E = i.carry === "leaf" ? 0.15 : 0.085;
      (ye.set(L.x - (h / p) * 0.15, L.y + E * i.size, L.z - (d / p) * 0.15),
        c.setMatrixAt(s, ot.compose(ye, H, at.setScalar(i.size * v))));
    } else c.setMatrixAt(s, G);
    u++;
  }),
    (rt.count = c.count = C.ants.length),
    (rt.instanceMatrix.needsUpdate = c.instanceMatrix.needsUpdate = !0),
    yt || D.update());
  const m =
      i.carry === "leaf"
        ? "leaves"
        : i.carry === "seed"
          ? "seeds"
          : "sugar grains",
    a = `${mt} · ${C.delivered.toLocaleString()} ${m} home`;
  me.textContent !== a && (me.textContent = a);
  const f = `${_} maze in ${At.toLowerCase()} · ${w.cells.length} cells · ${u} ants out · best trip ${isFinite(C.best) ? C.best : "—"} · shortest ${te}`;
  (f !== Me && (Nn.textContent = Me = f),
    (Mt.js += (performance.now() - o - Mt.js) * 0.05),
    et.render());
}
$.setAnimationLoop(() => {
  const t = performance.now();
  ((Mt.frame += (t - be - Mt.frame) * 0.05),
    (be = t),
    Xe(Math.min(Gn.getDelta(), 1 / 20)));
});
document.body.classList.add("ready");
if (yt) {
  $.setAnimationLoop(null);
  const t = 60,
    o = +k.get("frames"),
    n = k.get("port"),
    i = k.has("t") ? k.get("t").split(",").map(Number) : null,
    c = 1.5,
    u = Fn(w, it, {
      position: P.position.clone(),
      target: D.target.clone(),
      fov: P.fov,
    }),
    m = new R(Ne, Kt);
  (m.scale.setScalar(1.6), q.add(m));
  for (let e = 0; e < 160; e += 1 / 30)
    Et(C, 1 / 30, { evaporate: b.evaporate });
  ht = 1;
  const a = async (e) => {
      const s = u(e);
      (P.position.copy(s.position),
        (P.near = Math.min(0.03 + s.position.y * 0.02, 0.4)),
        (P.fov = s.fov),
        P.lookAt(s.target),
        P.rotateZ(s.roll),
        P.updateProjectionMatrix(),
        P.updateMatrixWorld());
      const r = u(Math.min(e, K)),
        l = r.target.clone().sub(r.position).setY(0).normalize();
      (m.position
        .copy(r.position)
        .addScaledVector(l, -0.02)
        .setY(r.position.y - 0.215),
        m.rotation.set(
          0,
          Math.atan2(-l.x, -l.z) + Math.sin(e * 9) * 0.1 * (e < K),
          0,
        ),
        (et.look.exposure.value = jn(e)),
        (et.look.aberration.value = 0.5 * Math.min(1, s.speed / 6)),
        (et.look.vignette.value = T.lerp(0.14, 0.4, Math.min(1, s.speed / 6))),
        (Ye = s.position.y < 3.5 && e < K + 0.5),
        kt.copy(s.position),
        (ht = 1),
        Xe(0),
        await $.backend.device.queue.onSubmittedWorkDone());
    },
    f = async (e) => {
      const s = await new Promise((r) => N.toBlob(r, "image/png"));
      await fetch(`http://localhost:${n}/frame?i=${e}`, {
        method: "POST",
        body: s,
      });
    };
  if (i) for (const [e, s] of i.entries()) (await a(s), await f(e));
  else
    for (let e = 0; e < o; e++)
      (Et(C, c / t, { evaporate: b.evaporate }), await a(e / t), await f(e));
  await fetch(`http://localhost:${n}/done`);
}
V &&
  setTimeout(
    () => {
      ($.setAnimationLoop(null),
        et.render(),
        N.toBlob(
          (t) =>
            fetch(`http://localhost:${k.get("port")}/`, {
              method: "POST",
              body: t,
            }),
          "image/jpeg",
          0.92,
        ));
    },
    +(k.get("after") || 6e3),
  );
