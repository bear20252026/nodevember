import "../lib/modulepreload-polyfill.js";
import { s as We } from "../lib/studio-environment.js";
import { S as r0, c as Oe } from "../lib/studio-presets.js";
import {
  u as Dt,
  M as qe,
  Q as at,
  a2 as D,
  b as T,
  m as P,
  s as w,
  g as L,
  O as Yt,
  ax as rt,
  af as J,
  c as ct,
  a6 as Gt,
  F as De,
  K as Vt,
  i as Ye,
  av as Ge,
  y as y0,
  ay as Ve,
  X as ft,
  a1 as Jt,
  $ as F0,
  az as _e,
  aA as Xe,
  H as $e,
  aj as Ke,
  aw as Qe,
} from "../lib/stage.js";
import { O as Je } from "../lib/OrbitControls.js";
import {
  C as pt,
  V as R,
  aZ as Ne,
  aJ as tn,
  aK as en,
  E as nn,
  R as St,
  T as Nt,
  m as te,
  b6 as v0,
  b7 as O0,
  f as c0,
  aO as ee,
  p as ne,
  Q as gt,
  b8 as oe,
  aU as on,
  B as At,
  F as q0,
  e as V,
  b9 as se,
  a3 as D0,
  ar as sn,
  Y as _t,
  aB as Xt,
  aC as an,
  M as vt,
  t as rn,
  S as cn,
  P as ln,
  D as un,
  ah as ae,
  c as dn,
  r as H0,
  L as mn,
  ba as hn,
  aP as fn,
  u as pn,
  I as gn,
  aF as lt,
} from "../lib/leva.js";
import { r as bn } from "../lib/rendering-panel.js";
import { a as wn } from "../lib/pcss.js";
import { m as re, a as Mn, b as xn } from "../lib/BufferGeometryUtils.js";
import { R as $t } from "../lib/RoundedBoxGeometry.js";
import "../lib/three.js";
const yn = "" + new URL("../assets/rust-color.jpg", import.meta.url).href,
  kn = "" + new URL("../assets/rust-roughness.jpg", import.meta.url).href;
let Z0;
function Sn() {
  if (Z0) return Z0;
  const t = new Nt(),
    e = (n, o) => (
      (n.wrapS = n.wrapT = St),
      (n.anisotropy = 8),
      o && (n.colorSpace = te),
      n
    );
  return ((Z0 = { color: e(t.load(yn), !0), rough: e(t.load(kn), !1) }), Z0);
}
function An(t) {
  let e = t >>> 0;
  return () => {
    e = (e + 1831565813) | 0;
    let n = Math.imul(e ^ (e >>> 15), 1 | e);
    return (
      (n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
function Kt(t, e, n) {
  const o = t * t * t,
    s = new Float32Array(o).fill(1 / 0),
    a = new Float32Array(o * 7),
    r = new Int32Array(o * 7);
  let i = 0;
  const l = (c, m) => {
      let h = i++;
      for (; h > 0; ) {
        const u = (h - 1) >> 1;
        if (a[u] <= c) break;
        ((a[h] = a[u]), (r[h] = r[u]), (h = u));
      }
      ((a[h] = c), (r[h] = m));
    },
    d = () => {
      const c = a[0],
        m = r[0],
        h = a[--i],
        u = r[i];
      let g = 0;
      for (;;) {
        let f = 2 * g + 1;
        if (f >= i || (f + 1 < i && a[f + 1] < a[f] && f++, a[f] >= h)) break;
        ((a[g] = a[f]), (r[g] = r[f]), (g = f));
      }
      return ((a[g] = h), (r[g] = u), [c, m]);
    };
  for (const [c, m] of e) m < s[c] && ((s[c] = m), l(m, c));
  for (; i; ) {
    const [c, m] = d();
    if (c > s[m]) continue;
    const h = m % t,
      u = ((m / t) | 0) % t,
      g = (m / (t * t)) | 0,
      f = t * t,
      M = [
        h + 1 < t ? m + 1 : m - (t - 1),
        h > 0 ? m - 1 : m + (t - 1),
        u + 1 < t ? m + t : m - t * (t - 1),
        u > 0 ? m - t : m + t * (t - 1),
        g + 1 < t ? m + f : m - f * (t - 1),
        g > 0 ? m - f : m + f * (t - 1),
      ];
    for (const x of M) {
      const S = Math.fround(c + 0.5 * (n[m] + n[x]));
      S < s[x] && ((s[x] = S), l(S, x));
    }
  }
  return s;
}
function Qt(t) {
  const e = Array.from(t.keys()).sort((o, s) => t[o] - t[s]),
    n = new Float32Array(t.length);
  return (
    e.forEach((o, s) => {
      n[o] = s / (t.length - 1);
    }),
    n
  );
}
function vn(t = 48, e = 7) {
  const n = An(e),
    o = t * t * t,
    s = new Float32Array(o);
  for (let u = 0; u < o; u++) s[u] = 0.2 + n() ** 3 * 4;
  const a = () => (n() * o) | 0,
    r = Qt(
      Kt(
        t,
        Array.from({ length: 180 }, () => [a(), n() * 6]),
        s,
      ),
    );
  for (let u = 0; u < o; u++) s[u] = 0.4 + n() ** 2 * 2;
  const i = Qt(
      Kt(
        t,
        Array.from({ length: 14 }, () => [a(), n() * 18]),
        s,
      ),
    ),
    l = Array.from({ length: 150 }, () => [
      n() * t,
      n() * t,
      n() * t,
      0.6 + 3.2 * n() ** 4,
    ]),
    d = Array.from({ length: 90 }, () => [n() * t, n() * t, n() * t]),
    c = (u) => ((u = Math.abs(u) % t), Math.min(u, t - u)),
    m = new Uint8Array(o * 4);
  for (let u = 0; u < t; u++)
    for (let g = 0; g < t; g++)
      for (let f = 0; f < t; f++) {
        const M = f + g * t + u * t * t;
        let x = 1 / 0;
        for (const [E, Z, p, k] of l)
          x = Math.min(x, Math.hypot(c(f - E), c(g - Z), c(u - p)) - k);
        let S = 1 / 0,
          z = 1 / 0;
        for (const [E, Z, p] of d) {
          const k = Math.hypot(c(f - E), c(g - Z), c(u - p));
          k < S ? ((z = S), (S = k)) : k < z && (z = k);
        }
        ((m[M * 4] = Math.round(r[M] * 255)),
          (m[M * 4 + 1] = Math.round(i[M] * 255)),
          (m[M * 4 + 2] = Math.round(
            Math.max(0, Math.min(1, x / 8 + 0.15)) * 255,
          )),
          (m[M * 4 + 3] = Math.round(Math.min(1, (z - S) / 6) * 255)));
      }
  const h = new Ne(m, t, t, t);
  return (
    (h.format = tn),
    (h.type = en),
    (h.minFilter = h.magFilter = nn),
    (h.wrapS = h.wrapT = h.wrapR = St),
    (h.unpackAlignment = 1),
    (h.needsUpdate = !0),
    h
  );
}
const A = (t) => new pt(t),
  f0 = {
    Iron: {
      label: "Cast iron",
      verb: "rusts to a thick, flaking crust",
      kind: "rust",
      base: A(7894645),
      rough: 0.45,
      tarnish: A(4469290),
      tarnishAmt: 0.66,
      young: A(14186796),
      mature: A(9256990),
      old: A(3286050),
      crustRough: 0.89,
      crust: 0.85,
      flake: 1,
      pits: 1,
      speed: 1,
    },
    Steel: {
      label: "Mild steel",
      verb: "rusts in orange blooms",
      kind: "rust",
      base: A(12501701),
      rough: 0.28,
      tarnish: A(6639684),
      tarnishAmt: 0.55,
      young: A(14916163),
      mature: A(11224862),
      old: A(4334880),
      crustRough: 0.83,
      crust: 0.63,
      flake: 0.55,
      pits: 0.8,
      speed: 0.91,
    },
    Copper: {
      label: "Copper",
      verb: "browns, then grows blue-green patina",
      kind: "patina",
      base: A(16296059),
      rough: 0.23,
      tarnish: A(5779488),
      tarnishAmt: 0.95,
      young: A(7845536),
      mature: A(4425332),
      old: A(3168590),
      crustRough: 0.74,
      crust: 0.22,
      flake: 0,
      pits: 0.17,
      speed: 0.68,
    },
    Brass: {
      label: "Brass",
      verb: "dulls to brown with green deposits in patches",
      kind: "patina",
      base: A(15057015),
      rough: 0.24,
      tarnish: A(6705195),
      tarnishAmt: 0.83,
      young: A(9151610),
      mature: A(5664844),
      old: A(3622451),
      crustRough: 0.69,
      crust: 0.13,
      flake: 0,
      pits: 0.09,
      speed: 0.53,
    },
    Bronze: {
      label: "Bronze",
      verb: "darkens and develops green patina",
      kind: "patina",
      base: A(12881496),
      rough: 0.32,
      tarnish: A(3943459),
      tarnishAmt: 0.98,
      young: A(8431754),
      mature: A(5209703),
      old: A(2639677),
      crustRough: 0.76,
      crust: 0.19,
      flake: 0,
      pits: 0.14,
      speed: 0.61,
    },
    Silver: {
      label: "Silver",
      verb: "tarnishes amber, violet-blue, then black",
      kind: "film",
      base: A(16250353),
      rough: 0.15,
    },
    Galvanised: {
      label: "Galvanised steel",
      verb: "zinc turns chalky and exposed steel rusts",
      kind: "zinc",
      base: A(12633544),
      rough: 0.35,
      tarnish: A(10198683),
      tarnishAmt: 0.53,
      young: A(15000797),
      mature: A(12896453),
      old: A(9541525),
      crustRough: 0.9,
      crust: 0.15,
      flake: 0,
      pits: 0.12,
      speed: 0.72,
    },
  },
  it = [
    [0.36, 0.48, -0.8],
    [-0.8, 0.6, 0],
    [0.48, 0.64, 0.6],
  ],
  h0 = (t) => T(y0(t, T(...it[0])), y0(t, T(...it[1])), y0(t, T(...it[2])));
function Pn(t) {
  return { field: t, age: Dt(0), seed: Dt(new R()) };
}
function Pt(t, e, { polished: n = !1 } = {}) {
  const o = new qe(),
    { field: s, age: a, seed: r } = t,
    i = (I) => Ge(s, I),
    l = at.mul(5.5).add(r),
    d = ({ r: I, g: W, b: a0 }) => T(I, W, a0),
    c = (I) => d(A(I)),
    m = n && e === f0.Iron ? c(10594994) : d(e.base),
    h = D(l.mul(38)).mul(0.5).add(0.5);
  let u = m.mul(h.mul(0.065).add(0.966));
  const g = n ? Math.min(e.rough, 0.19) : e.rough;
  ((o.metalness = 1), (o.roughness = g));
  const f = T(
      D(l.mul(2.6).add(3.4)),
      D(l.mul(2.6).add(7.2)),
      D(l.mul(2.6).add(13.1)),
    ).mul(0.11),
    M = l.add(f),
    x = i(M),
    S = i(h0(M).mul(2.6).add(0.37)),
    z = i(h0(h0(M)).mul(7.3).add(0.71));
  if (e.kind === "film") {
    const I = a.mul(x.g.mul(0.52).add(S.r.mul(0.2)).add(0.61));
    let W = P(u, c(13345117), w(0.08, 0.36, I));
    return (
      (W = P(W, c(7885688), w(0.34, 0.53, I))),
      (W = P(W, c(4940168), w(0.48, 0.7, I))),
      (W = P(W, c(2565162), w(0.65, 0.99, I))),
      (o.colorNode = W),
      (o.metalnessNode = P(L(1), L(0.48), w(0.48, 1, I))),
      (o.roughnessNode = L(g).add(w(0.15, 0.98, I).mul(0.22))),
      o
    );
  }
  const E = Yt,
    Z = E.y,
    p = E.fwidth().length().div(at.fwidth().length().max(1e-5)),
    k = w(12, 60, p),
    y = h,
    v = D(l.mul(110).add(3.1)).mul(0.5).add(0.5),
    B = D(l.mul(1.4).add(9)).mul(0.5).add(0.5),
    F = w(0.55, 0, rt(l.mul(48))),
    $0 = w(0.5, 0, rt(l.mul(130).add(5))),
    M0 = D(l.mul(320).add(1.7)).mul(0.5).add(0.5),
    Tt = F.mul(0.65).add($0.mul(0.35)),
    K0 = Sn(),
    Q0 = (I, W, a0) => Ve(ft(I), null, null, L(W), at.add(r.mul(a0)), Yt),
    Re = Q0(K0.color, 13, 0.04),
    Ce = Q0(K0.color, 31, 0.07),
    Lt = (I) => y0(I.rgb, T(0.2126, 0.7152, 0.0722)),
    J0 = Lt(Re).mul(0.65).add(Lt(Ce).mul(0.35)),
    Te = Q0(K0.rough, 13, 0.04).r,
    q = e.kind === "rust",
    s0 = e.kind === "zinc",
    x0 = a.mul(e.speed),
    Bt = i(h0(M.mul(T(1.4, 0.26, 1.4))).add(0.23)).g,
    Et = P(x.r, x.g, 0.5)
      .mul(0.86)
      .add(S.r.mul(0.14))
      .add(z.r.sub(0.5).mul(0.1))
      .sub(J(Z, 0).mul(0.075))
      .sub(k.mul(q ? 0.045 : 0.085))
      .sub(Bt.sub(0.5).mul(0.12)),
    d0 = x0
      .mul(1.27)
      .sub(q ? 0.15 : s0 ? 0.16 : 0.4)
      .sub(Et)
      .add(q ? w(0.7, 1, x0).mul(0.12) : 0),
    z0 = w(0, 0.09, a),
    Le =
      q || s0
        ? L(0)
        : v
            .sub(0.5)
            .mul(0.07)
            .add(M0.sub(0.5).mul(0.035))
            .add(J0.sub(0.3).mul(0.1)),
    R0 = (q || s0 ? w(-0.025, 0.034, d0) : w(-0.13, 0.17, d0.add(Le))).mul(z0),
    m0 = ct(d0.div(q || s0 ? 0.52 : 0.8).add(S.g.sub(0.5).mul(0.23)), 0, 1),
    Ft = w(0, 1, ct(a.mul(1.23).sub(Et.mul(0.38)), 0, 1))
      .mul(e.tarnishAmt)
      .mul(z0);
  if (s0) {
    const I = w(0.04, 0.13, rt(l.mul(13)));
    u = u.mul(I.mul(0.21).add(0.79));
  }
  if (((u = P(u, d(e.tarnish), Ft)), q)) {
    const I = w(-0.21, 0.025, d0).mul(R0.oneMinus()).mul(z0);
    u = P(u, c(7951162), I.mul(0.58));
  }
  const N0 = d(e.young).mul(z.b.mul(0.23).add(0.89)),
    Be = d(e.mature).mul(S.g.mul(0.31).add(0.84)),
    C0 = d(e.old).mul(x.g.mul(0.38).add(0.8));
  let H = P(N0, Be, w(0.02, 0.48, m0));
  if (((H = P(H, C0, w(0.37, 1, m0.add(Bt.sub(0.5).mul(0.25))))), q)) {
    const I = w(0.5, 0.79, B.mul(0.52).add(S.g.mul(0.48)));
    H = P(H, c(12419628), I.mul(w(0.6, 0.07, m0)).mul(0.62));
  }
  const tt = Gt(S.b, x.b.mul(1.6)),
    Ht = R0.mul(w(0.35, 0.9, x0))
      .mul(e.pits)
      .mul(w(0.35, 0.8, m0))
      .mul(w(0.4, 0.65, B.add(x.g.mul(0.4)))),
    T0 = Ht.mul(w(0.14, 0.07, tt)),
    Ee = Ht.mul(w(0.1, 0.15, tt)).mul(w(0.24, 0.17, tt)),
    L0 = k
      .mul(w(0.1, 0.6, x0))
      .mul(e.pits)
      .mul(w(0.24, 0.14, Gt(z.b, S.b.mul(1.2)))),
    et = R0.mul(w(0.25, 0.75, x0)).mul(e.flake),
    nt = i(h0(l).mul(4).add(0.5)).a,
    Zt = et.mul(w(0.06, 0.02, nt)).mul(w(0.35, 0.6, B)),
    ot = et
      .mul(w(0.55, 0.7, B.mul(0.7).add(x.g.mul(0.3))))
      .mul(w(0.1, 0.16, nt))
      .mul(w(0.55, 0.6, i(h0(l).mul(4).add(0.5)).b.add(z.g.mul(0.2)))),
    jt = et.mul(w(0.22, 0.07, nt)).mul(ot.oneMinus());
  ((H = P(H, P(C0.mul(0.7), N0.mul(0.8), w(0.5, 0.55, z.g)), ot)),
    (H = H.mul(jt.mul(0.3).add(1))));
  const Fe = q ? 1 : s0 ? 0.55 : 0.4;
  H = H.mul(P(L(1), ct(J0.div(0.3), 0.45, 1.8), L(0.6 * Fe)));
  const B0 = q ? 1 : 0.38;
  H = H.mul(P(L(1 - 0.34 * B0), L(1 + 0.2 * B0), Tt)).mul(
    M0.mul(0.22 * B0).add(1 - 0.11 * B0),
  );
  let st = L(0);
  if (s0) {
    st = w(0.74, 0.99, a).mul(w(0.69, 0.88, z.g.mul(0.73).add(k.mul(0.27))));
    const I = P(c(14123070), c(6894110), S.g);
    H = P(H, I, st);
  }
  const E0 = J(R0, st);
  let _ = P(u, H, E0);
  const Ut = w(-0.035, 0.018, d0)
    .mul(w(0.12, 0.018, d0))
    .mul(z0);
  (q && (_ = P(_, N0, Ut.mul(0.52))),
    (_ = P(_, C0.mul(0.35), J(T0, L0).mul(0.85))),
    (_ = P(_, _.mul(1.25), Ee.mul(0.5))),
    (_ = P(_, C0.mul(0.3), Zt.mul(0.85))));
  const He = y
      .sub(0.5)
      .mul(0.35)
      .add(v.sub(0.5).mul(0.4))
      .add(J0.sub(0.3).mul(q ? 1.9 : 0.8))
      .add(Tt.sub(0.35).mul(1.1))
      .add(M0.sub(0.5).mul(0.35)),
    Ze = w(0.55, 0.78, x.g.mul(0.7).add(y.mul(0.4))).mul(w(0.3, 0.9, m0)),
    Wt = E0.mul(e.crust)
      .mul(L(0.25).add(m0.mul(0.45)).add(He).add(Ze.mul(0.68)))
      .add(Ut.mul(e.crust * 0.23))
      .sub(T0.mul(0.9))
      .sub(L0.mul(0.7))
      .sub(Zt.mul(0.8))
      .sub(ot.mul(0.7))
      .add(jt.mul(0.5))
      .mul(85e-5);
  return (
    (o.normalNode = De(() => {
      const I = Vt.dFdx(),
        W = Vt.dFdy(),
        a0 = Ye,
        Ot = W.cross(a0),
        je = a0.cross(I),
        qt = I.dot(Ot),
        Ue = Ot.mul(Wt.dFdx()).add(je.mul(Wt.dFdy())).mul(qt.sign());
      return a0.mul(qt.abs()).sub(Ue).normalize();
    })()),
    (o.colorNode = _),
    (o.metalnessNode = P(L(1), L(0), J(E0, J(T0, L0)))),
    (o.roughnessNode = P(
      L(g)
        .mul(y.mul(0.3).add(0.85))
        .add(Ft.mul(n ? 0.26 : 0.15)),
      L(e.crustRough)
        .mul(0.7)
        .add(Te.mul(0.3 * 0.9))
        .add(v.sub(0.5).mul(0.06)),
      J(E0, J(T0, L0)),
    )),
    (o.clearcoatNode = L(0)),
    o
  );
}
const Q = 2 * Math.PI,
  ce = ([t, e]) => new c0(t, e);
function w0(t) {
  const e = Mn(
    t.map((n) => (n.deleteAttribute("uv"), n.index ? n.toNonIndexed() : n)),
  );
  return re(e, 1e-7);
}
function le(t, e = 32) {
  return (
    t.scale(1e3, 1e3, 1e3),
    xn(t, V.degToRad(e)).scale(0.001, 0.001, 0.001)
  );
}
function l0(t, e, n, o = 24) {
  return le(
    new oe(t, {
      depth: e,
      bevelEnabled: n > 0,
      bevelThickness: n,
      bevelSize: n,
      bevelSegments: 1,
      curveSegments: o,
    }),
  );
}
function p0(t, e = 64) {
  return k0(
    t.map(([n, o]) => [o, n]),
    e,
  );
}
function It(t, e, n, o, s = !1, a = null) {
  const r = new on(t, e, n, o, s),
    i = r.attributes.position;
  if (a) {
    for (let c = 0; c <= e; c++) {
      const m = (s ? c % e : c) / e,
        h = t.getPointAt(m);
      for (let u = 0; u <= o; u++) {
        const g = c * (o + 1) + u,
          f = a(m, u / o);
        i.setXYZ(
          g,
          h.x + (i.getX(g) - h.x) * f,
          h.y + (i.getY(g) - h.y) * f,
          h.z + (i.getZ(g) - h.z) * f,
        );
      }
    }
    (r.deleteAttribute("uv"), r.deleteAttribute("normal"));
    const d = re(r, 1e-7);
    return (d.computeVertexNormals(), d);
  }
  if (s) return r;
  const l = (d) => {
    const c = t.getPointAt(d / e),
      m = r.tangents[d].clone().multiplyScalar(d === 0 ? -1 : 1),
      h = [c.x, c.y, c.z],
      u = [m.x, m.y, m.z],
      g = [];
    for (let M = 0; M < o; M++) {
      const x = d * (o + 1) + M;
      (h.push(i.getX(x), i.getY(x), i.getZ(x)), u.push(m.x, m.y, m.z));
      const S = ((M + 1) % o) + 1;
      g.push(0, d === 0 ? M + 1 : S, d === 0 ? S : M + 1);
    }
    const f = new At();
    return (
      f.setAttribute("position", new q0(h, 3)),
      f.setAttribute("normal", new q0(u, 3)),
      f.setIndex(g),
      f
    );
  };
  return w0([r, l(0), l(e)]);
}
const Y0 = { a: 0.036, R: 0.02, r: 0.00815 },
  ie = 0.052;
class In extends se {
  getPoint(e, n = new R()) {
    const { a: o, R: s } = Y0;
    let a = (e % 1) * (2 * o + Q * s);
    return a < o
      ? n.set(-o / 2 + a, -s, 0)
      : ((a -= o),
        a < Math.PI * s
          ? n.set(o / 2 + s * Math.sin(a / s), -s * Math.cos(a / s), 0)
          : ((a -= Math.PI * s),
            a < o
              ? n.set(o / 2 - a, s, 0)
              : ((a -= o),
                n.set(-o / 2 - s * Math.sin(a / s), s * Math.cos(a / s), 0))));
  }
  getPointAt(e, n) {
    return this.getPoint(e, n);
  }
}
function zn() {
  return It(new In(), 152, Y0.r, 20, !0, (t, e) => {
    const n = (t - 0.092) / 0.021,
      o = Math.exp(-n * n) * 0.037,
      s =
        Math.exp(-((n - 0.2) ** 2) * 9) * (0.018 + 0.008 * Math.cos(e * Q * 3));
    return 1 + o + s;
  });
}
const Rn = (t) =>
  new ee(
    t.map((e) => new R(...e)),
    !1,
    "centripetal",
  );
function Cn(t, e, n) {
  const o = [
    [-t, n, 0],
    [-t, V.lerp(n, e, 0.5), 0],
  ];
  for (let s = 0; s <= 32; s++) {
    const a = (Math.PI * s) / 32;
    o.push([-Math.cos(a) * t, e + Math.sin(a) * t, 0]);
  }
  return (o.push([t, V.lerp(n, e, 0.5), 0], [t, n, 0]), Rn(o));
}
function ue(t, e, n, o) {
  return It(Cn(t, e, n), 112, o, 24);
}
function Tn() {
  const n = ue(0.026, 0, -0.039, 0.0065),
    o = (r) =>
      p0([
        [0.0061, 0],
        [0.0098, 0],
        [0.0121, 0.0023],
        [0.0121, 0.0097],
        [0.0098, 0.012],
        [0.0061, 0.012],
        [0.0056, 0.0115],
        [0.0056, 5e-4],
        [0.0061, 0],
      ])
        .rotateZ(-Math.PI / 2)
        .translate(r - 0.006, -0.046, 0),
    s = p0(
      [
        [0, 0],
        [0.0045, 0],
        [0.0055, 0.0012],
        [0.0055, 0.062],
        [0.0089, 0.062],
        [0.0095, 0.0627],
        [0.0095, 0.065],
        [0.0089, 0.0657],
        [0, 0.0657],
      ],
      40,
    )
      .rotateZ(-Math.PI / 2)
      .translate(-0.032, -0.046, 0),
    a = new v0(
      [
        [-0.0045, -0.0065],
        [0.0025, -0.0077],
        [0.008, -0.0052],
        [0.0095, -0.002],
        [0.0095, 0.002],
        [0.008, 0.0052],
        [0.0025, 0.0077],
        [-0.0045, 0.0065],
      ].map(ce),
    );
  return (
    a.holes.push(new O0().absarc(0.005, 0, 0.0022, 0, Q, !0)),
    w0([
      n,
      o(-0.026),
      o(0.026),
      s,
      l0(a, 0.0036, 6e-4).translate(0.037, -0.046, -0.0018),
    ])
  );
}
function X0(t, e) {
  const n = new v0();
  t = t.map(ce);
  for (let o = 0; o < t.length; o++) {
    const s = t[o],
      a = t[(o + t.length - 1) % t.length].clone().sub(s),
      r = t[(o + 1) % t.length].clone().sub(s),
      i = Math.min(
        typeof e == "function" ? e(s) : e,
        a.length() * 0.47,
        r.length() * 0.47,
      ),
      l = a.setLength(i).add(s),
      d = r.setLength(i).add(s);
    (o === 0 ? n.moveTo(l.x, l.y) : n.lineTo(l.x, l.y),
      n.quadraticCurveTo(s.x, s.y, d.x, d.y));
  }
  return (n.closePath(), n);
}
function de() {
  const n = X0(
    [
      [-0.038, -0.063],
      [0.038, -0.063],
      [0.038, -0.004],
      [0.033, 0],
      [-0.033, 0],
      [-0.038, -0.004],
    ],
    0.0036,
  );
  n.holes.push(new O0().absarc(0, -0.038, 0.0116, 0, Q, !0));
  const o = l0(n, 0.029, 0.0015).translate(0, 0, -0.0145),
    s = new v0().absarc(0, 0, 0.0106, 0, Q),
    a = new O0(),
    r = Math.atan2(0.0021, 0.0015);
  (a.moveTo(-0.0015, -0.0064),
    a.lineTo(0.0015, -0.0064),
    a.absarc(0, 0.0025, Math.hypot(0.0015, 0.0021), -r, Math.PI + r),
    a.lineTo(-0.0015, -0.0064),
    s.holes.push(a));
  const i = l0(s, 0.0042, 35e-5, 40).translate(0, -0.038, 0.0103),
    l = p0(
      [
        [0, 0],
        [0.0111, 0],
        [0.0114, 5e-4],
        [0.0114, 0.024],
        [0, 0.024],
      ],
      64,
    )
      .rotateX(Math.PI / 2)
      .translate(0, -0.038, -0.0145);
  return { casework: w0([o, i, l]), bow: ue(0.024, 0.025, -0.008, 0.0064) };
}
function Ln() {
  return w0(Object.values(de()));
}
function Bn() {
  const t = new v0();
  (t.moveTo(0.031, 0.006),
    t.bezierCurveTo(0.017, 0.006, 0.014, 0.021, -0.002, 0.021),
    t.bezierCurveTo(-0.032, 0.021, -0.032, -0.021, -0.002, -0.021),
    t.bezierCurveTo(0.014, -0.021, 0.017, -0.006, 0.031, -0.006),
    t.closePath());
  const e = new O0();
  (e.absellipse(-0.006, 0, 0.013, 0.0135, 0, Q, !0), t.holes.push(e));
  const n = l0(t, 0.004, 0.00115).translate(0, 0, -0.002),
    o = p0(
      [
        [0, 0],
        [0.004, 0],
        [0.004, 0.003],
        [0.0064, 0.004],
        [0.0064, 0.007],
        [0.0052, 0.008],
        [0.0052, 0.01],
        [0.0061, 0.011],
        [0.0061, 0.013],
        [0.0041, 0.014],
        [0.0038, 0.07],
        [0.0038, 0.08],
        [0.0029, 0.081],
        [0, 0.081],
      ],
      48,
    )
      .rotateZ(-Math.PI / 2)
      .translate(0.024, 0, 0),
    s = X0(
      [
        [0.079, 5e-4],
        [0.101, 5e-4],
        [0.101, -0.0085],
        [0.095, -0.0085],
        [0.095, -0.013],
        [0.101, -0.013],
        [0.101, -0.018],
        [0.089, -0.018],
        [0.089, -0.014],
        [0.085, -0.014],
        [0.085, -0.019],
        [0.079, -0.019],
      ],
      5e-4,
    );
  return w0([n, o, l0(s, 0.0038, 45e-5).translate(0, 0, -0.0019)]);
}
const me = 0.012,
  En = 0.002;
function G0(t) {
  const e = Q / 6;
  return me / Math.cos((t % e) - e / 2);
}
function he(t, e) {
  const n = e / En - t / Q,
    o = 1 - Math.abs(2 * (n - Math.floor(n)) - 1);
  return V.clamp((o - 0.16) / 0.72, 0, 1);
}
function fe(t, e, n, o) {
  return Array.from({ length: n + 1 }, (s, a) => {
    const r = V.lerp(t, e, a / n);
    return [r, (i) => o(i, r)];
  });
}
function k0(t, e = 72, n = !0) {
  const o = [],
    s = [];
  for (const [r, i] of t)
    for (let l = 0; l < e; l++) {
      const d = (l * Q) / e,
        c = typeof i == "function" ? i(d) : i;
      o.push(c * Math.sin(d), r, c * Math.cos(d));
    }
  for (let r = 0; r < t.length - 1; r++)
    for (let i = 0; i < e; i++) {
      const l = r * e + i,
        d = r * e + ((i + 1) % e);
      (t[r][1] !== 0 && s.push(l, d, l + e),
        t[r + 1][1] !== 0 && s.push(d, d + e, l + e));
    }
  const a = new At();
  return (
    a.setAttribute("position", new q0(o, 3)),
    a.setIndex(s),
    n ? le(a) : (a.computeVertexNormals(), a)
  );
}
function Fn() {
  const o = fe(
    0.00135,
    0.011649999999999999,
    88,
    (s, a) => 0.00695 + 0.00105 * he(s, a),
  ).reverse();
  return k0([
    [0, 0.00855],
    [0, 0.0116],
    [0.00135, G0],
    [0.013 - 0.00135, G0],
    [0.013, 0.0116],
    [0.013, 0.00855],
    ...o,
    [0, 0.00855],
  ]);
}
function Hn() {
  const t = k0([
      [-0.01, 0],
      [-0.01, 0.01155],
      [-0.00845, G0],
      [-55e-5, G0],
      [0, 0.01165],
      [0, 0.00815],
      [0.001, 0.008],
      [0.001, 0],
    ]),
    e = fe(0.039, 0.109, 560, (s, a) => {
      const i =
        0.008 - 0.00113 * V.smoothstep(a, 0.039, 0.044) * (1 - he(s, a));
      return Math.min(i, 0.00645 + (0.11 - a) * 0.96);
    }),
    n = k0([[8e-4, 0.008], ...e, [0.11, 0.00645]], 56, !1),
    o = k0(
      [
        [0.11, 0.00645],
        [0.11, 0],
      ],
      56,
    );
  return w0([t, n, o]);
}
function Zn() {
  return p0(
    [
      [0.0085 + 25e-5, 0],
      [0.015 - 25e-5, 0],
      [0.015, 25e-5],
      [0.015, 0.003 - 5e-4],
      [0.015 - 5e-4, 0.003],
      [0.0085 + 45e-5, 0.003],
      [0.0085, 0.003 - 45e-5],
      [0.0085, 25e-5],
      [0.0085 + 25e-5, 0],
    ],
    80,
  );
}
function jn() {
  class o extends se {
    getPoint(a, r = new R()) {
      const i = a * 7.5,
        l = i * Q,
        d =
          0.0107 * i -
          0.0051 * (Math.min(i, 0.95) + Math.max(0, i - (7.5 - 0.95)));
      return r.set(Math.cos(l) * 0.016, Math.sin(l) * 0.016, d);
    }
  }
  return It(new o(), 384, 0.0026, 16);
}
function Un() {
  const s = X0(
    [
      [-0.035, -0.044],
      [0.035, -0.044],
      [0.035, -0.036],
      [0.003, -0.036],
      [0.003, 0.036],
      [0.035, 0.036],
      [0.035, 0.044],
      [-0.035, 0.044],
      [-0.035, 0.036],
      [-0.003, 0.036],
      [-0.003, -0.036],
      [-0.035, -0.036],
    ],
    (a) => (Math.abs(a.x) < 0.006 ? 0.0065 : 0.00135),
  );
  return l0(s, 0.26, 45e-5, 8);
}
function Wn() {
  const n = X0(
    [
      [0, 0],
      [0.055, 0],
      [0.055, 0.006],
      [0.006, 0.006],
      [0.006, 0.055],
      [0, 0.055],
    ],
    (o) => (o.x === 0.006 && o.y === 0.006 ? 0.007 : 0.0014),
  );
  return l0(n, 0.24, 45e-5, 8);
}
function On() {
  return p0(
    [
      [0.019 + 55e-5, 0],
      [0.024 - 9e-4, 0],
      [0.024, 9e-4],
      [0.024, 0.2 - 45e-5],
      [0.024 - 45e-5, 0.2],
      [0.019 + 8e-4, 0.2],
      [0.019, 0.2 - 8e-4],
      [0.019, 55e-5],
      [0.019 + 55e-5, 0],
    ],
    96,
  );
}
const qn = {
    link: (t) => t,
    shackle: (t) => t.rotateX(-Math.PI / 2),
    padlock: (t) => t.rotateX(-Math.PI / 2),
    key: (t) => t.rotateX(-Math.PI / 2).rotateZ(-0.035),
    nut: (t) => t,
    bolt: (t) =>
      t.rotateZ(
        Math.PI / 2 + Math.atan2(me / Math.cos(Math.PI / 6) - 0.008, 0.109),
      ),
    washer: (t) => t,
    spring: (t) => t.rotateY(Math.PI / 2),
    ibeam: (t) => t,
    angle: (t) => t.rotateZ(-Math.PI * 0.75),
    pipe: (t) => t.rotateZ(Math.PI / 2),
  },
  Dn = {
    link: zn,
    shackle: Tn,
    padlock: Ln,
    key: Bn,
    nut: Fn,
    bolt: Hn,
    washer: Zn,
    spring: jn,
    ibeam: Un,
    angle: Wn,
    pipe: On,
  };
function Yn() {
  const t = {};
  for (const [e, n] of Object.entries(Dn)) {
    const o = qn[e](n());
    o.computeBoundingBox();
    const s = o.boundingBox;
    (e !== "link" &&
      o.translate(-(s.min.x + s.max.x) / 2, -s.min.y, -(s.min.z + s.max.z) / 2),
      o.computeBoundingSphere(),
      o.computeBoundingBox(),
      (t[e] = o));
  }
  return t;
}
function Gn(t, e, n) {
  const o = [],
    s = ie * n;
  t.arcLengthDivisions = 400;
  const r = (t.getLength() - (e - 1) * s) / 2,
    i = new R(0, 1, 0),
    l = new R(1, 0, 0),
    d = new R().setScalar(n);
  for (let c = 0; c < e; c++) {
    const m = t.getUtoTmapping(0, r + c * s),
      h = t.getPoint(m),
      u = t.getTangent(m),
      g = Math.atan2(-u.z, u.x),
      f = ((c % 2 ? -1 : 1) * Math.PI) / 4 + Math.sin(c * 2.4) * 0.014,
      M = new gt()
        .setFromAxisAngle(i, g)
        .multiply(new gt().setFromAxisAngle(l, f));
    ((h.y = (Y0.R * Math.cos(f) + Y0.r * 1.045) * n),
      o.push(new ne().compose(h, M, d)));
  }
  return o;
}
function Vn(t) {
  let e = t >>> 0;
  return () => {
    e = (e + 1831565813) | 0;
    let n = Math.imul(e ^ (e >>> 15), 1 | e);
    return (
      (n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
const bt = { "Small chain": 0.6, Chain: 1, "Heavy chain": 1.45 },
  _n = [
    "shackle",
    "padlock",
    "key",
    "nut",
    "bolt",
    "washer",
    "spring",
    "ibeam",
    "angle",
    "pipe",
  ],
  pe = {
    Chain: (t) => {
      const e = [1, t() < 0.5 ? 0.6 : 1.45];
      return (
        t() < 0.6 && e.push([0.6, 1, 1.45][Math.floor(t() * 3)]),
        {
          chains: e.map((n) => ({
            scale: n,
            count: Math.round((10 + t() * 8) / Math.sqrt(n)),
          })),
          loose: [],
        }
      );
    },
    Hardware: (t) => ({
      chains: [],
      loose: [
        "bolt",
        "bolt",
        "nut",
        "nut",
        "nut",
        "washer",
        "washer",
        "washer",
        "spring",
        t() < 0.5 ? "key" : "nut",
      ],
    }),
    Beams: (t) => ({
      chains: t() < 0.5 ? [{ scale: 1, count: 9 }] : [],
      loose: ["ibeam", "angle", "pipe", "bolt", "nut", "nut", "washer"],
    }),
    Lock: (t) => ({
      chains: [{ scale: 1, count: 12 + Math.floor(t() * 5) }],
      loose: ["padlock", "key", "key", "washer"],
    }),
    Mixed: (t) => {
      const e = [
        "shackle",
        "padlock",
        "key",
        "nut",
        "bolt",
        "washer",
        "spring",
        "pipe",
        "angle",
      ];
      return {
        chains:
          t() < 0.6
            ? [{ scale: [0.6, 1, 1.45][Math.floor(t() * 3)], count: 12 }]
            : [],
        loose: Array.from(
          { length: 5 + Math.floor(t() * 3) },
          () => e[Math.floor(t() * e.length)],
        ),
      };
    },
  },
  Xn = Object.keys(pe);
function ge(t) {
  return { r: Vn(t * 7919 + 13), taken: [], chains: [], loose: [] };
}
const $n = 0.006;
function be(t, e, n, o) {
  return t.every(([s, a, r]) => Math.hypot(e - s, n - a) > r + o + $n);
}
function Kn(t, e, n, o) {
  const s = t.max.x - t.min.x,
    a = t.max.z - t.min.z,
    r = (t.min.x + t.max.x) / 2,
    i = (t.min.z + t.max.z) / 2,
    l = s >= a,
    d = l ? s : a,
    c = l ? a : s,
    m = Math.max(1, Math.ceil(d / c)),
    h = Math.hypot(c / 2, d / (2 * m)),
    u = Math.cos(e),
    g = Math.sin(e),
    f = [];
  for (let M = 0; M < m; M++) {
    const x = ((M + 0.5) / m) * d - d / 2,
      S = r + (l ? x : 0),
      z = i + (l ? 0 : x);
    f.push([n + S * u + z * g, o - S * g + z * u, h]);
  }
  return f;
}
function we(t, e, n) {
  const { r: o, taken: s } = t,
    a = n[e].boundingBox,
    r = o() * Math.PI * 2,
    i = o() * Math.PI * 2;
  for (let l = 0; l < 4e3; l++) {
    const d = s.length ? 0.012 * Math.sqrt(l) : 0,
      c = i + l * 2.39996,
      m = Math.cos(c) * d,
      h = Math.sin(c) * d,
      u = Kn(a, r, m, h);
    if (u.every(([g, f, M]) => be(s, g, f, M))) {
      s.push(...u);
      const g = new ne().compose(
          new R(m, 0, h),
          new gt().setFromAxisAngle(new R(0, 1, 0), r),
          new R(1, 1, 1),
        ),
        f = { name: e, matrix: g };
      return (t.loose.push(f), f);
    }
  }
  return null;
}
function Me(t, e, n) {
  const { r: o, taken: s } = t,
    a = o() * Math.PI,
    r = n * ie * e * 0.5,
    i = (o() - 0.5) * r * 0.24,
    l = new c0(Math.cos(a), Math.sin(a)),
    d = new c0(-l.y, l.x);
  for (let c = 0; c < 300; c++) {
    const m = c === 0 ? 0 : Math.ceil(c / 2) * 0.006 * (c % 2 ? 1 : -1),
      h = [];
    for (let f = 0; f <= 8; f++) {
      const M = f / 8 - 0.5,
        x = Math.sin(M * Math.PI * 2) * i + m;
      h.push(new R(l.x * M * r * 2 + d.x * x, 0, l.y * M * r * 2 + d.y * x));
    }
    const u = Gn(new ee(h, !1, "centripetal"), n, e),
      g = u.flatMap((f) =>
        [-0.019, 0.019].map((M) => {
          const x = new R(M, 0, 0).applyMatrix4(f);
          return [x.x, x.z, 0.032 * e];
        }),
      );
    if (g.every(([f, M, x]) => be(s, f, M, x))) {
      s.push(...g);
      const f = { scale: e, matrices: u };
      return (t.chains.push(f), f);
    }
  }
  return null;
}
function Qn(t, e, n) {
  const o = ge(e),
    s = pe[t](o.r);
  for (const r of s.chains) Me(o, r.scale, r.count);
  const a = [...s.loose].sort(
    (r, i) => n[i].boundingSphere.radius - n[r].boundingSphere.radius,
  );
  for (const r of a) we(o, r, n);
  return o;
}
const Jn = "" + new URL("../assets/wood-color.jpg", import.meta.url).href,
  Nn = "" + new URL("../assets/wood-normal.jpg", import.meta.url).href,
  to = "" + new URL("../assets/wood-roughness.jpg", import.meta.url).href,
  zt = { width: 0.46, depth: 0.265 };
function eo(t, e) {
  const n = new Jt(),
    o = ft(e.albedo).rgb,
    s = w(0.08, 1, t),
    a = D(F0.mul(T(14, 24, 20))),
    r = w(0.18, 0.92, s.add(a.mul(0.27))).mul(0.55),
    i = y0(o, T(0.2126, 0.7152, 0.0722)),
    l = T(i.mul(1.12).add(0.05)).mul(_e(14468004)),
    d = F0.y.add(F0.z.mul(0.9)).mul(19.6).floor(),
    c = D(T(d.mul(1.7), d.mul(0.31).add(2), 0.5)),
    m = P(T(1), T(1.1, 0.96, 0.82), c.mul(0.5).add(0.5)).mul(
      c.mul(0.09).add(1),
    );
  let h = P(o.mul(1.08).mul(m), l.mul(m), r);
  const u = F0,
    g = D(T(u.x.mul(95), u.y.mul(6.5), u.z.mul(95)))
      .mul(0.5)
      .add(0.5),
    f = D(T(u.x.mul(260), u.y.mul(14), u.z.mul(260)).add(7.3))
      .mul(0.5)
      .add(0.5),
    M = w(0.38, 0.74, g.mul(0.72).add(f.mul(0.28))),
    x = D(T(u.y.mul(9), u.z.mul(30), 3.1)).mul(0.006),
    S = (v) =>
      $e(
        u.x
          .sub(v)
          .add(x)
          .pow(2)
          .negate()
          .div(2 * 0.0145 * 0.0145),
      ),
    z = J(S(-0.218), J(S(0), S(0.218))).mul(
      L(1).sub(Xe.x.abs().mul(1.4).min(1)),
    ),
    Z = w(0.1, 0.125, u.z.abs())
      .mul(w(0.155, 0.135, u.y))
      .mul(w(-0, 0.1, u.y.negate().add(0.15)).oneMinus().mul(0.6).add(0.4)),
    p = w(0, 0.1, u.y.negate().add(0.46)).mul(0.5).add(0.5),
    k = z
      .mul(1.5)
      .add(Z.mul(1.25))
      .mul(M.mul(0.8).add(0.2))
      .mul(w(0.04, 0.5, t))
      .mul(p)
      .clamp(0, 1),
    y = P(T(0.5, 0.2, 0.065), T(0.22, 0.085, 0.035), f);
  return (
    (h = P(h, h.mul(y).mul(2.1), k.mul(0.95))),
    (n.colorNode = h),
    (n.roughnessNode = ft(e.roughness)
      .r.mul(0.33)
      .add(P(0.27, 0.57, r))),
    (n.normalMap = e.normal),
    (n.normalScale = new c0(0.68, 0.68)),
    n
  );
}
async function no() {
  const t = new Nt(),
    [e, n, o] = await Promise.all([Jn, Nn, to].map((s) => t.loadAsync(s)));
  e.colorSpace = te;
  for (const s of [e, n, o]) ((s.wrapS = s.wrapT = St), (s.anisotropy = 8));
  return { albedo: e, normal: n, roughness: o };
}
function ut(t, e = !1, n = !1) {
  const o = t.attributes.position,
    s = new Float32Array(o.count * 2);
  for (let a = 0; a < o.count; a++) {
    const r = o.getX(a),
      i = o.getY(a),
      l = o.getZ(a),
      d = n ? Math.atan2((i - O) / i0, l / C) * 0.117 : i;
    ((s[a * 2] = d / 0.48 + (e ? 0.28 : l < 0 && !n ? 0.53 : 0.06)),
      (s[a * 2 + 1] = (e ? l : r) / 0.59 + 0.5));
  }
  return (t.setAttribute("uv", new rn(s, 2)), t);
}
const O = 0.161,
  C = zt.depth / 2,
  i0 = 0.105,
  G = zt.width / 2;
function e0(t, e) {
  return [O + (i0 + e) * Math.sin(t), (C + e) * Math.cos(t)];
}
function j0(t, e, n, o, s, a, r) {
  const i = [],
    l = [];
  for (let g = 0; g <= r; g++) {
    const f = V.lerp(n, o, g / r),
      [M, x] = e0(f, a),
      [S, z] = e0(f, s);
    if ((i.push(t, M, x, e, M, x, e, S, z, t, S, z), !!g))
      for (let E = 0; E < 4; E++) {
        const Z = (g - 1) * 4 + E,
          p = (g - 1) * 4 + ((E + 1) % 4);
        l.push(Z, p, Z + 4, p, p + 4, Z + 4);
      }
  }
  l.push(0, 3, 2, 0, 2, 1);
  const d = r * 4;
  l.push(d, d + 1, d + 2, d, d + 2, d + 3);
  const c = new At();
  (c.setAttribute("position", new q0(i, 3)), c.setIndex(l));
  const m = c.toNonIndexed();
  m.computeVertexNormals();
  const h = m.attributes.position,
    u = m.attributes.normal;
  for (let g = 0; g < h.count; g++) {
    if (u.getY(g) ** 2 + u.getZ(g) ** 2 < 0.95 || g >= h.count - 12) continue;
    const f = u.getY(g) * (h.getY(g) - O) + u.getZ(g) * h.getZ(g) < 0 ? -1 : 1,
      M = new R(0, (h.getY(g) - O) / i0 ** 2, h.getZ(g) / C ** 2).normalize();
    u.setXYZ(g, 0, f * M.y, f * M.z);
  }
  return m;
}
function oo(t, e, n) {
  const s = Math.asin(e / (i0 + -0.005)),
    a = Math.asin(n / (i0 + -0.005)),
    [r, i] = e0(s, -0.005),
    [l, d] = e0(a, -0.005),
    c = new v0();
  (c.moveTo(-i, r - O), c.lineTo(i, r - O));
  for (let m = 1; m <= 12; m++) {
    const [h, u] = e0(V.lerp(s, a, m / 12), -0.005);
    c.lineTo(u, h - O);
  }
  d > 1e-6 && c.lineTo(-d, l - O);
  for (let m = 1; m < 12; m++) {
    const [h, u] = e0(Math.PI - V.lerp(a, s, m / 12), -0.005);
    c.lineTo(u, h - O);
  }
  return (
    c.closePath(),
    new oe(c, {
      depth: 0.011,
      bevelSize: 0.0012,
      bevelThickness: 0.0012,
      bevelSegments: 2,
    })
      .rotateY(-Math.PI / 2)
      .translate(t + 0.0055, O, 0)
  );
}
const dt = 0.017;
async function so(t, e) {
  const n = new D0(),
    o = new D0();
  ((o.position.y = dt), n.add(o));
  const s = eo(t, await no()),
    a = [],
    r = (p, k, y = 0, v = 0, B = 0) => {
      const F = new vt(p, k);
      return (
        F.position.set(y, v, B),
        (F.castShadow = F.receiveShadow = !0),
        o.add(F),
        k === e && a.push(F),
        F
      );
    },
    i = (p, k, y, v, B, F, $0 = !1, M0 = s) =>
      r(ut(new $t(p, k, y, 2, 0.0016).translate(v, B, F), $0), M0),
    l = (p, k, y, v, B, F) =>
      r(new $t(p, k, y, 2, Math.min(0.0015, y / 3)), e, v, B, F),
    d = new sn(0.0052, 16, 10).scale(1, 1, 0.56),
    c = (p, k, y, v) => {
      r(d, e, p, k, y).quaternion.setFromUnitVectors(new R(0, 0, 1), v);
    },
    m = new _t({ color: 2693650, roughness: 0.91 });
  i(0.443, 0.152, 0.25, 0, 0.08, 0, !1, m);
  for (const p of [-1, 1]) {
    for (let y = 0; y < 3; y++) {
      const v = 0.0315 + y * 0.051;
      (i(0.456, 0.0495, 0.012, 0, v, p * 0.125),
        i(0.013, 0.0495, 0.239, p * 0.224, v, 0, !0));
    }
    for (const [y, v] of [
      [0, 0.03],
      [0.032, 0.059],
      [0.061, 0.083],
      [0.085, i0 - 0.005],
    ])
      r(ut(oo(p * 0.222, y, v), !0), s);
    (l(0.472, 0.025, 0.006, 0, O - 0.011, p * (C + 0.001)),
      l(0.006, 0.025, 0.269, p * (G + 0.002), O - 0.011, 0),
      l(0.46, 0.01, 0.005, 0, 0.01, p * C),
      l(0.005, 0.01, 0.263, p * G, 0.01, 0));
    for (const y of [-1, 1]) {
      const v = y * (G - 0.014),
        B = y * (C - 0.013);
      (l(0.029, 0.139, 0.006, v, 0.078, p * (C + 5e-4)),
        l(0.006, 0.139, 0.028, p * (G + 0.001), 0.078, B));
      for (const F of [0.027, 0.072, 0.116, 0.15])
        (c(v, F, p * (C + 0.0035), new R(0, 0, p)),
          c(p * (G + 0.004), F, B, new R(p, 0, 0)));
      l(0.036, 0.016, 0.036, v, 0.008, p * (C - 0.013));
    }
    l(0.006, 0.048, 0.066, p * (G + 0.002), 0.118, 0);
    for (const y of [-0.022, 0.022])
      c(p * (G + 0.005), 0.13, y, new R(p, 0, 0));
    const k = new Xt(0.03, 0.0043, 14, 48)
      .scale(1, 0.78, 1)
      .rotateY(Math.PI / 2)
      .rotateZ(p * 0.15);
    (r(k, e, p * (G + 0.012), 0.076, 0),
      l(0.024, 0.013, 0.031, p * (G + 0.008), 0.099, 0));
  }
  for (const p of [-0.135, 0.135]) l(0.028, 0.023, 0.004, p, 0.139, -C);
  const h = new _t({ color: 3876377, roughness: 0.72 });
  for (const p of [-1, 1])
    for (const k of [-1, 1]) {
      const y = p * (G - 0.021),
        v = k * (C - 0.02);
      (r(
        new an(0.0145, 0.0175, dt, 20, 1),
        h,
        y,
        -dt / 2,
        v,
      ).geometry.computeVertexNormals(),
        l(0.04, 0.004, 0.04, y, -0.003, v));
    }
  const u = O + 0.0035;
  for (const p of [-1, 1])
    (i(0.482, 0.0085, 0.0075, 0, u, p * (C + 0.0058)),
      i(0.0075, 0.0085, 0.2755, p * (G + 0.0058), u, 0, !0));
  r(j0(-0.221, 0.221, 0, Math.PI, -0.013, -0.007, 48), m);
  for (let p = 0; p < 9; p++) {
    const k = Math.PI / 9;
    r(
      ut(
        j0(-0.228, 0.228, p * k + 0.007, (p + 1) * k - 0.007, -0.009, 0, 7),
        !1,
        !0,
      ),
      s,
    );
  }
  for (const p of [-0.218, 0, 0.218]) {
    const k = Math.abs(p) > 0.2 ? 0.035 : 0.032;
    r(j0(p - k / 2, p + k / 2, 0, Math.PI, -0.001, 0.0065, 50), e);
    for (const y of [0.14, 0.55, 0.98, 1.43, 1.9, 2.35, 2.83]) {
      const [v, B] = e0(y, 0.0065);
      c(p, v, B, new R(0, Math.sin(y) / i0, Math.cos(y) / C).normalize());
    }
  }
  for (const p of [-0.233, 0.233]) {
    r(j0(p - 0.003, p + 0.003, 0, Math.PI, -0.014, 0.0064, 50), e);
    for (const k of [0.3, 0.85, 1.43, 2.02, 2.62]) {
      const [y, v] = e0(k, -0.004);
      c(p + Math.sign(p) * 0.003, y, v, new R(Math.sign(p), 0, 0));
    }
  }
  l(0.028, 0.107, 0.006, 0, 0.063, C + 0.002);
  for (const p of [0.029, 0.058]) c(0, p, C + 0.005, new R(0, 0, 1));
  (l(0.042, 0.063, 0.008, 0, 0.138, C + 0.005),
    l(0.039, 0.01, 0.014, 0, 0.165, C + 0.008));
  const g = 0.012,
    f = C + 0.008,
    M = new Xt(g, 0.0028, 12, 32, Math.PI)
      .rotateZ(-Math.PI / 2)
      .rotateY(-Math.PI / 2);
  r(M, e, 0, 0.109, f);
  for (const p of [-0.013, 0.013]) c(p, 0.15, C + 0.009, new R(0, 0, 1));
  const { casework: x, bow: S } = de(),
    z = 0.63,
    E = 0.0795,
    Z = f + 0.0075;
  return (
    r(x.scale(z, z, z), e, 0, E, Z),
    r(S.scale(z, z, z), e, 0, E, Z),
    { group: n, hardware: a }
  );
}
const Y = new URLSearchParams(location.search),
  K = Y.has("thumb"),
  ao = matchMedia("(prefers-reduced-motion: reduce)").matches;
K && document.body.classList.add("capture");
const xe = document.querySelector("#label"),
  ro = xe.querySelector("strong"),
  co = xe.querySelector("span"),
  n0 = Object.keys(f0),
  mt = Y.get("metal"),
  S0 = "Chest",
  V0 = [S0, ...Xn],
  b = {
    metal: n0.includes(mt) || mt === "Mixed" ? mt : "Iron",
    pieces: V0.includes(Y.get("pieces")) ? Y.get("pieces") : S0,
    studio: r0.includes(Y.get("studio")) ? Y.get("studio") : "Workshop",
    add: "Chain",
    addMetal: "Same",
    timelapse: !ao && !Y.has("age"),
    speed: 1,
    age: V.clamp(Number(Y.get("age") ?? (K ? 0.59 : 0)) || 0, 0, 1),
  };
let U0 = Y.has("seed")
  ? Number(Y.get("seed"))
  : K
    ? 3
    : (Math.random() * 1e6) | 0;
const o0 = await Ke({ exposure: 0.92 }),
  P0 = o0.domElement;
P0.id = "view";
P0.setAttribute("tabindex", "0");
P0.setAttribute(
  "aria-label",
  "A wooden chest and metal hardware weathering over time. Press R for new pieces, drag to orbit.",
);
const t0 = new cn(),
  X = new ln(26, innerWidth / innerHeight, 0.02, 40);
X.position.set(0.57, 0.34, 0.82);
const j = new Je(X, P0);
j.enableDamping = !0;
j.dampingFactor = 0.06;
j.target.set(0, 0.025, 0);
j.minDistance = 0.25;
j.maxDistance = 2.4;
j.maxPolarAngle = Math.PI * 0.47;
j.autoRotate = !1;
j.autoRotateSpeed = 0.35;
const lo = We(o0);
function io() {
  const t = [];
  for (let s = 0; s <= 20; s++) t.push(new c0((s / 20) * 2.2, 0));
  for (let s = 1; s <= 40; s++) {
    const a = ((s / 40) * Math.PI) / 2;
    t.push(new c0(2.2 + Math.sin(a) * 3.5, 3.5 - Math.cos(a) * 3.5));
  }
  for (let s = 1; s <= 10; s++) t.push(new c0(2.2 + 3.5, 3.5 + s * 3));
  const o = new fn(t, 128);
  return (o.scale(-1, 1, 1), o.computeVertexNormals(), o);
}
const ye = new Jt({ roughness: 1, metalness: 0 }),
  ke = new vt(io(), ye);
ke.receiveShadow = !0;
t0.add(ke);
const U = new un(16777215, 4.2);
U.castShadow = !0;
U.shadow.mapSize.set(2048, 2048);
U.shadow.radius = 4;
U.shadow.bias = -4e-4;
U.shadow.normalBias = 0.002;
const g0 = U.shadow.camera;
g0.left = g0.bottom = -0.8;
g0.right = g0.top = 0.8;
g0.near = 0.1;
g0.far = 6;
t0.add(U, U.target);
const uo = wn(U, { renderer: o0 }),
  u0 = Pn(vn(48, 7)),
  mo = Object.fromEntries(n0.map((t) => [t, Pt(u0, f0[t])])),
  wt = { Iron: Pt(u0, f0.Iron, { polished: !0 }) },
  b0 = Yn(),
  A0 = await so(u0.age, wt.Iron);
A0.group.updateMatrixWorld(!0);
const ho = new ae().setFromObject(A0.group, !0);
let N = new D0();
t0.add(N);
function fo(t) {
  let e = t >>> 0;
  return () => {
    e = (e + 1831565813) | 0;
    let n = Math.imul(e ^ (e >>> 15), 1 | e);
    return (
      (n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
let W0 = {},
  $ = null,
  Se = "Iron";
function Ae(t) {
  return mo[t];
}
function ve(t, e) {
  const n = new gn(b0.link, Ae(e), t.matrices.length);
  (t.matrices.forEach((o, s) => n.setMatrixAt(s, o)),
    (n.castShadow = n.receiveShadow = !0),
    N.add(n));
}
function Pe(t, e) {
  const n = new vt(b0[t.name], Ae(e));
  (n.applyMatrix4(t.matrix), (n.castShadow = n.receiveShadow = !0), N.add(n));
}
function Rt() {
  const t = [];
  function e({ min: d, max: c }, m) {
    for (const h of [d.x, c.x])
      for (const u of [d.y, c.y])
        for (const g of [d.z, c.z]) {
          const f = new R(h, u, g);
          t.push(m ? f.applyMatrix4(m) : f);
        }
  }
  A0.group.parent === N && e(ho);
  for (const d of $.chains)
    for (const c of d.matrices) e(b0.link.boundingBox, c);
  for (const d of $.loose) e(b0[d.name].boundingBox, d.matrix);
  if (!t.length) return;
  const n = X.position.clone().sub(j.target).normalize(),
    o = new R().crossVectors(X.up, n).normalize(),
    s = new R().crossVectors(n, o),
    a = new ae().setFromPoints(t).getCenter(new R()),
    r = Math.tan(V.degToRad(X.fov / 2)) * 0.8,
    i = r * X.aspect;
  let l = j.minDistance;
  for (const d of t)
    (d.sub(a),
      (l = Math.max(
        l,
        d.dot(n) + Math.max(Math.abs(d.dot(o)) / i, Math.abs(d.dot(s)) / r),
      )));
  ((j.maxDistance = Math.max(2.4, l * 1.3)),
    j.target.copy(a),
    X.position.copy(a).addScaledVector(n, l));
}
let Mt;
function xt(t) {
  if (Mt === t) return;
  Mt = t;
  const e = Oe[t];
  ((t0.environment = lo(e)),
    (t0.environmentIntensity = e.env),
    (t0.background = new pt(e.sweep)),
    ye.color.set(e.sweep),
    U.color.set(e.keyColor),
    (U.intensity = e.keyLevel),
    (U.shadow.radius = e.soft),
    U.position
      .set(...e.key)
      .normalize()
      .multiplyScalar(3),
    (document.body.style.background = `#${new pt(e.sweep).getHexString()}`));
}
function _0() {
  const t = fo(U0),
    e = b.pieces === "Random" ? V0[Math.floor(t() * V0.length)] : b.pieces,
    n = b.studio === "Random" ? (Mt ?? r0[0]) : b.studio,
    o = b.metal === "Mixed" || (b.metal === "Random" && t() < 0.22),
    s = () => n0[Math.floor(t() * n0.length)],
    a = b.metal !== "Random" && b.metal !== "Mixed" ? b.metal : s();
  if (
    (t0.remove(N),
    N.traverse((i) => {
      i.isInstancedMesh && i.dispose();
    }),
    (N = new D0()),
    e === S0)
  ) {
    $ = ge(U0);
    const { width: i, depth: l } = zt,
      d = Math.hypot(i / 6, l / 2 + 0.034);
    for (const c of [-i / 3, 0, i / 3]) $.taken.push([c, 0, d]);
    wt[a] ??= Pt(u0, f0[a], { polished: !0 });
    for (const c of A0.hardware) c.material = wt[a];
    N.add(A0.group);
  } else $ = Qn(e, U0, b0);
  for (const i of $.chains) ve(i, o ? s() : a);
  for (const i of $.loose) Pe(i, o ? s() : a);
  (t0.add(N),
    (Se = a),
    xt(n),
    u0.seed.value.set(t() * 40, t() * 40, t() * 40),
    Rt(),
    (W0 = { set: e, studio: n, metal: o ? "Mixed" : a }));
  const r = f0[a];
  ((ro.textContent =
    e === S0
      ? `Wood and ${r.label.toLowerCase()}`
      : o
        ? "Mixed metals"
        : r.label),
    (co.textContent =
      e === S0
        ? "The timber greys as the fittings corrode"
        : o
          ? "each corrodes its own way"
          : r.verb));
}
function yt() {
  const t =
    b.addMetal === "Same"
      ? Se
      : b.addMetal === "Random"
        ? n0[(Math.random() * n0.length) | 0]
        : b.addMetal;
  if (bt[b.add]) {
    const e = bt[b.add],
      n = Me($, e, Math.round((10 + Math.random() * 6) / Math.sqrt(e)));
    n && ve(n, t);
  } else {
    const e = we($, b.add, b0);
    e && Pe(e, t);
  }
  Rt();
}
function kt() {
  ((U0 = (Math.random() * 1e6) | 0),
    (b.age = 0),
    (b.metal = b.pieces = "Random"),
    (b.studio = r0[Math.floor(Math.random() * r0.length)]),
    _0(),
    Object.assign(b, { metal: W0.metal, pieces: W0.set, studio: W0.studio }),
    I0({ Metal: b.metal, Pieces: b.pieces, Studio: b.studio }));
}
function po(t) {
  ((b.age = t), (b.timelapse = !1), I0({ Age: t, Timelapse: !1 }));
}
function Ie() {
  ((b.age = 0), (b.timelapse = !0), I0({ Age: 0, Timelapse: !0 }));
}
K ||
  (addEventListener("keydown", (t) => {
    if (t.target.closest?.("#controls, input")) return;
    const e = t.key.toLowerCase();
    if (e === "r") kt();
    else if (e === "a") yt();
    else if (e === "t") Ie();
    else return;
    t.preventDefault();
  }),
  document.querySelector("#random").addEventListener("click", kt),
  document.querySelector("#add").addEventListener("click", yt));
let I0 = () => {};
function go() {
  const [, t] = pn(() => ({
    Random: lt(kt),
    Metal: {
      value: b.metal,
      options: ["Random", "Mixed", ...n0],
      onChange: (e) => {
        e !== b.metal && ((b.metal = e), _0());
      },
    },
    Pieces: {
      value: b.pieces,
      options: ["Random", ...V0],
      onChange: (e) => {
        e !== b.pieces && ((b.pieces = e), _0());
      },
    },
    Add: {
      value: b.add,
      options: [...Object.keys(bt), ..._n],
      onChange: (e) => {
        b.add = e;
      },
    },
    "Add in": {
      value: b.addMetal,
      options: ["Same", "Random", ...n0],
      onChange: (e) => {
        b.addMetal = e;
      },
    },
    "Add it (A)": lt(yt),
    Studio: {
      value: b.studio,
      options: ["Random", ...r0],
      onChange: (e) => {
        e !== b.studio &&
          ((b.studio = e),
          xt(e === "Random" ? r0[Math.floor(Math.random() * r0.length)] : e));
      },
    },
    Age: {
      value: b.age,
      min: 0,
      max: 1,
      step: 0.001,
      onChange: (e, n, { initial: o, fromPanel: s }) => {
        !o && s && po(e);
      },
    },
    Timelapse: {
      value: b.timelapse,
      onChange: (e) => {
        b.timelapse = e;
      },
    },
    Speed: {
      value: b.speed,
      min: 0.2,
      max: 3,
      step: 0.05,
      onChange: (e) => {
        b.speed = e;
      },
    },
    "Replay ageing (T)": lt(Ie),
    ...bn({ renderer: o0, pipeline: Ct, lights: [U], pcss: [uo] }),
  }));
  return ((I0 = t), null);
}
K ||
  dn.createRoot(document.querySelector("#controls")).render(
    H0.createElement(
      H0.Fragment,
      null,
      H0.createElement(mn, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      H0.createElement(go),
    ),
  );
const Ct = Qe(o0, t0, X, {
  aoStrength: 0.45,
  bloomStrength: 0.03,
  vignette: 0.22,
  grain: 0.01,
});
function ze() {
  const t = K ? 1e3 : innerWidth,
    e = K ? 1e3 : innerHeight;
  (o0.setSize(t, e, !K),
    (X.aspect = t / e),
    X.updateProjectionMatrix(),
    $ && Rt());
}
addEventListener("resize", ze);
ze();
_0();
const bo = new hn();
let ht = -1;
o0.setAnimationLoop(() => {
  const t = Math.min(bo.getDelta(), 0.05);
  (b.timelapse && !K && (b.age = Math.min(1, b.age + (t * b.speed) / 24)),
    (u0.age.value = b.age),
    b.age !== ht &&
      (b.age === 0 || b.age === 1 || Math.abs(b.age - ht) >= 0.01) &&
      ((ht = b.age), I0({ Age: b.age })),
    j.update(),
    Ct.render());
});
document.body.classList.add("ready");
K &&
  setTimeout(
    () => {
      (o0.setAnimationLoop(null),
        (u0.age.value = b.age),
        j.update(),
        Ct.render(),
        P0.toBlob(
          (t) =>
            fetch(`http://localhost:${Y.get("port")}/`, {
              method: "POST",
              body: t,
            }),
          "image/jpeg",
          0.92,
        ));
    },
    +(Y.get("after") || 6e3),
  );
