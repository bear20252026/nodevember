import "../lib/modulepreload-polyfill.js";
import {
  a1 as $e,
  D as Vt,
  a2 as gt,
  Q as X,
  b as V,
  m as K,
  K as cs,
  F as nt,
  aK as nn,
  a4 as on,
  C as rn,
  $ as Ut,
  aJ as xe,
  A as Kt,
  s as rt,
  g as P,
  B as Tt,
  Y as wt,
  E as ln,
  O as Me,
  aL as pa,
  u as I,
  ad as Ks,
  aM as cn,
  aN as Pe,
  a as Zs,
  aO as un,
  aP as dn,
  aQ as Xs,
  aR as hn,
  at as ue,
  aS as mn,
  f as Et,
  aT as pn,
  au as fn,
  ap as qt,
  af as $s,
  a7 as Mt,
  aU as fa,
  a5 as ga,
  aV as gn,
  aW as wn,
  aX as yn,
  aY as xn,
  Z as Ot,
  c as Mn,
  H as ht,
  aZ as bn,
  a_ as vn,
  y as Qs,
  a$ as An,
  b0 as zn,
  X as Vs,
  b1 as Sn,
  b2 as Cn,
  b3 as wa,
  b4 as kt,
  t as Wt,
  b5 as kn,
  b6 as _n,
  ai as Nn,
  G as bt,
  o as Js,
  aj as Tn,
  J as ya,
  b7 as ta,
  b8 as xa,
  b9 as Ma,
  as as ba,
  p as Fn,
  k as Pn,
  R as Vn,
  l as En,
} from "../lib/stage.js";
import {
  a3 as va,
  M as Qe,
  O as Ln,
  I as xs,
  B as ke,
  t as Ue,
  aM as Aa,
  V as C,
  F as vt,
  d as Je,
  aO as Rn,
  e as le,
  aI as za,
  aJ as Sa,
  as as Ca,
  G as ka,
  q as be,
  p as Es,
  Q as ze,
  an as In,
  f as Ls,
  bj as Dn,
  aE as jn,
  S as Gn,
  ar as Bn,
  aq as qn,
  D as On,
  C as _a,
  ap as Rs,
  a as Un,
  b2 as Na,
  P as Wn,
  c as Hn,
  r as Ve,
  L as Yn,
  u as Kn,
  g as Ee,
} from "../lib/leva.js";
import { r as Zn } from "../lib/rendering-panel.js";
import { a as Xn } from "../lib/pcss.js";
import { m as Ta } from "../lib/BufferGeometryUtils.js";
import { d as $n } from "../lib/DepthOfFieldNode.js";
import "../lib/three.js";
function Ms(s) {
  return () => {
    ((s |= 0), (s = (s + 1831565813) | 0));
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    return (
      (t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  };
}
const _e = (s, t, e) => {
  const a = Math.max(0, Math.min(1, (e - s) / (t - s)));
  return a * a * (3 - 2 * a);
};
function Qn(s, t, e) {
  let a =
    Math.imul(s, 374761393) ^
    Math.imul(t, 668265263) ^
    Math.imul(e, 2147483647);
  return (
    (a = Math.imul(a ^ (a >>> 13), 1274126177)),
    ((a ^ (a >>> 16)) >>> 0) / 4294967295
  );
}
function Jn(s, t, e) {
  const a = Math.floor(s),
    l = Math.floor(t),
    o = Math.floor(e),
    i = s - a,
    n = t - l,
    h = e - o,
    m = i * i * (3 - 2 * i),
    r = n * n * (3 - 2 * n),
    c = h * h * (3 - 2 * h);
  let d = 0;
  for (let p = 0; p < 2; p++)
    for (let u = 0; u < 2; u++)
      for (let f = 0; f < 2; f++)
        d +=
          Qn(a + f, l + u, o + p) *
          (f ? m : 1 - m) *
          (u ? r : 1 - r) *
          (p ? c : 1 - c);
  return d;
}
function oe(s, t, e, a = 4) {
  let l = 0,
    o = 0.5;
  for (let i = 0; i < a; i++)
    ((l += o * Jn(s, t, e)),
      (s = s * 2.03 + 7.1),
      (t = t * 2.03 + 3.7),
      (e = e * 2.03 + 1.9),
      (o *= 0.5));
  return l;
}
const We = [0.6, 9],
  ne = (s, t) => _e(0.31, 0.45, oe(s * 0.045 + 11, t * 0.045 - 7, 0.5, 3));
function to(s, t) {
  const e = (oe(s * 0.018, t * 0.018, 9.1, 3) - 0.5) * 1.1,
    a = oe(s * 0.16, t * 0.16, 3.3, 4),
    l = (1 - Math.abs(a * 2 - 1)) ** 2,
    o = oe(s * 0.7, t * 0.7, 1.7, 3) - 0.5;
  return e + ne(s, t) * (l * 1.5 + o * 0.3);
}
const Zt = (s, t) =>
    to(s, t) * (0.75 + 0.25 * _e(1.5, 4, Math.hypot(s - We[0], t - We[1]))),
  us = 170,
  Le = 440;
function eo() {
  const s = Le + 1,
    t = us / Le,
    e = new Float32Array(s * s * 3),
    a = new Float32Array(s * s * 4),
    l = new Float32Array(s * s);
  for (let h = 0; h < s; h++)
    for (let m = 0; m < s; m++) {
      const r = -us / 2 + m * t,
        c = -us / 2 - 20 + h * t,
        d = h * s + m;
      ((l[d] = Zt(r, c)), e.set([r, l[d], c], d * 3));
    }
  const o = 4;
  for (let h = 0; h < s; h++)
    for (let m = 0; m < s; m++) {
      let r = 0,
        c = 0;
      for (let u = -o; u <= o; u += 2)
        for (let f = -o; f <= o; f += 2) {
          const y = Math.min(s - 1, Math.max(0, m + f)),
            b = Math.min(s - 1, Math.max(0, h + u));
          ((r += l[b * s + y]), c++);
        }
      const d = h * s + m,
        p = Math.max(0, r / c - l[d]);
      a.set(
        [
          ne(e[d * 3], e[d * 3 + 2]),
          Math.max(0.35, 1 - Math.min(0.55, p * 1.1)),
          0,
          0,
        ],
        d * 4,
      );
    }
  const i = [];
  for (let h = 0; h < Le; h++)
    for (let m = 0; m < Le; m++) {
      const r = h * s + m,
        c = r + 1,
        d = r + s,
        p = d + 1;
      i.push(r, d, c, c, d, p);
    }
  const n = new ke();
  return (
    n.setAttribute("position", new Ue(e, 3)),
    n.setAttribute("seabed", new Ue(a, 4)),
    n.setIndex(i),
    n.computeVertexNormals(),
    n
  );
}
function Re(s, t = 2) {
  const e = new Aa(1, t);
  (e.deleteAttribute("normal"), e.deleteAttribute("uv"));
  const a = Ta(e),
    l = a.getAttribute("position"),
    o = new C();
  for (let n = 0; n < l.count; n++)
    (o.fromBufferAttribute(l, n),
      o.multiplyScalar(
        1 + (oe(o.x * 1.3 + s, o.y * 1.3, o.z * 1.3, 3) - 0.5) * 0.75,
      ),
      (o.y = o.y < 0 ? o.y * 0.45 : o.y * 0.8),
      l.setXYZ(n, o.x, o.y, o.z));
  a.computeVertexNormals();
  const i = new Float32Array(l.count * 4);
  for (let n = 0; n < l.count; n++)
    ((i[n * 4] = 1), (i[n * 4 + 1] = 0.45 + 0.55 * _e(-0.35, 0.55, l.getY(n))));
  return (a.setAttribute("seabed", new vt(i, 4)), a);
}
function ea(s) {
  const t = Ms(s),
    e = [],
    a = [],
    l = [];
  for (let i = 0; i < 18; i++) {
    const n = i * 2.399963 + t() * 0.5,
      h = 0.3 + t() * 0.6,
      m = 0.2 + t() * 0.25,
      r = 0.016 + t() * 0.02,
      c = new C(Math.cos(n), 0, Math.sin(n)),
      d = new C(-c.z, 0, c.x),
      p = e.length / 3;
    for (let u = 0; u <= 5; u++) {
      const f = u / 5,
        y = c
          .clone()
          .multiplyScalar(h * m * f * f)
          .setY((m * Math.sin(f * 1.3)) / Math.sin(1.3)),
        b = r * (1 - f * 0.8);
      for (const M of [-1, 1]) {
        const v = y.clone().addScaledVector(d, M * b);
        (e.push(v.x, v.y, v.z), a.push(0.55, 0.35 + 0.65 * f, f, 0));
      }
    }
    for (let u = 0; u < 5; u++) {
      const f = p + u * 2;
      l.push(f, f + 1, f + 2, f + 1, f + 3, f + 2);
    }
  }
  const o = new ke();
  return (
    o.setAttribute("position", new vt(e, 3)),
    o.setAttribute("seabed", new vt(a, 4)),
    o.setIndex(l),
    o.computeVertexNormals(),
    o
  );
}
function so() {
  const s = new Aa(0.035, 1);
  (s.deleteAttribute("normal"), s.deleteAttribute("uv"));
  const t = Ta(s),
    e = [...t.getAttribute("position").array],
    a = [...t.index.array];
  for (let n = 1; n < e.length; n += 3) e[n] *= 0.7;
  const l = Array.from({ length: 70 }, (n, h) => {
    const m = 1 - (2 * (h + 0.5)) / 70,
      r = Math.sqrt(1 - m * m),
      c = h * 2.399963;
    return new C(Math.cos(c) * r, m, Math.sin(c) * r);
  }).filter((n) => n.y > -0.35);
  for (const n of l) {
    const h = n
        .clone()
        .multiplyScalar(0.03)
        .setY(n.y * 0.021),
      m = n
        .clone()
        .multiplyScalar(0.06)
        .setY(n.y * 0.05),
      r = new C()
        .crossVectors(n, new C(0, 1, 0.01))
        .normalize()
        .multiplyScalar(0.004),
      c = new C().crossVectors(n, r).normalize().multiplyScalar(0.004),
      d = e.length / 3;
    for (const p of [
      h.clone().add(r),
      h.clone().add(c),
      h.clone().sub(r),
      h.clone().sub(c),
      m,
    ])
      e.push(p.x, p.y, p.z);
    for (let p = 0; p < 4; p++) a.push(d + p, d + ((p + 1) % 4), d + 4);
  }
  const o = new ke();
  o.setAttribute("position", new vt(e, 3));
  const i = new Float32Array((e.length / 3) * 4);
  for (let n = 0; n < e.length / 3; n++)
    ((i[n * 4] = 0.9),
      (i[n * 4 + 1] = 0.6 + 0.4 * _e(-0.02, 0.04, e[n * 3 + 1])),
      (i[n * 4 + 3] = 1));
  return (
    o.setAttribute("seabed", new vt(i, 4)),
    o.setIndex(a),
    o.computeVertexNormals(),
    o
  );
}
function Fa(s, t, e, a, l) {
  ((s.colorNode = t.mul(a.sunAt(X)).mul(l(X.xz, X.y)).mul(0.42)),
    (s.emissiveNode = t.mul(a.ambientAt(X, V(0, 1, 0))).mul(e)));
}
function ao(s, t) {
  const e = new $e({ roughness: 0.95, metalness: 0 }),
    a = X,
    l = Vt("seabed", "vec4"),
    o = l.x,
    i = l.y,
    n = gt(a.xz.mul(0.32)),
    h = gt(a.xz.mul(0.21).add(17)),
    m = gt(a.mul(2.3)),
    r = gt(a.mul(11)),
    c = V(0.22, 0.2, 0.165).mul(m.mul(0.07).add(r.mul(0.06)).add(0.96)),
    d = K(V(0.08, 0.075, 0.065), V(0.16, 0.14, 0.115), m.mul(0.5).add(0.5)),
    p = K(d, V(0.34, 0.18, 0.24), n.smoothstep(0.05, 0.45).mul(0.8)),
    u = K(p, V(0.2, 0.12, 0.07), h.smoothstep(0.15, 0.55).mul(0.7));
  Fa(e, K(c, u, o), i, s, t);
  const f = a.x
      .mul(0.8)
      .add(a.z.mul(0.6))
      .mul(9)
      .add(m.mul(2.2))
      .sin()
      .mul(0.004),
    y = gt(a.mul(0.9)).abs().oneMinus().pow2().mul(0.12),
    b = K(f.add(r.mul(0.0015)), y.add(m.mul(0.05)).add(r.mul(0.008)), o),
    M = cs.z.negate().smoothstep(32, 6);
  return (
    (e.normalNode = nt(() => {
      const v = cs.dFdx(),
        x = cs.dFdy(),
        g = nn,
        w = x.cross(g),
        z = g.cross(v),
        S = v.dot(w),
        N = w.mul(b.dFdx()).add(z.mul(b.dFdy())).mul(S.sign());
      return g.mul(S.abs().max(1e-10)).sub(N.mul(M)).normalize();
    })()),
    e
  );
}
function no(s, t, e) {
  const a = new $e({ roughness: 0.7, metalness: 0, side: Je }),
    l = Vt("seabed", "vec4"),
    o = l.y,
    i = l.z,
    n = l.w,
    h = on(rn),
    m = K(
      K(V(0.26, 0.05, 0.07), V(0.22, 0.1, 0.05), h.smoothstep(0, 0.6)),
      V(0.3, 0.12, 0.18),
      h.smoothstep(0.6, 1),
    );
  Fa(a, K(m, K(V(0.17, 0.05, 0.2), V(0.24, 0.08, 0.25), h), n), o, s, t);
  const r = e.mul(0.9).add(h.mul(6.28));
  return (
    (a.positionNode = Ut.add(
      V(r.sin().mul(0.05), 0, r.mul(0.73).cos().mul(0.035)).mul(i.pow2()),
    )),
    a
  );
}
function oo(s, t, e, a) {
  const l = new va(),
    o = Ms(3110),
    i = (x, g, w) =>
      a.every((z) => Math.hypot(z[0] - x, z[1] - g) > w + 0.7) &&
      Math.hypot(x - We[0], g - We[1]) > w + 1.3,
    n = ao(s, t),
    h = new Qe(eo(), n);
  ((h.receiveShadow = !0), l.add(h));
  const m = [],
    r = [];
  for (let x = 0; x < 9e3 && m.length < 320; x++) {
    const g = -38 + o() * 76,
      w = -56 + o() * 68,
      z = 0.35 + o() ** 2 * 1.6;
    o() > ne(g, w) * 0.9 + 0.1 ||
      !i(g, w, z) ||
      m.push({
        x: g,
        z: w,
        size: z,
        turn: o() * 6.283,
        stretch: 0.75 + o() * 0.5,
        variant: m.length % 3,
      });
  }
  for (let x = 0; x < 9e3 && r.length < 900; x++) {
    const g = -30 + o() * 60,
      w = -40 + o() * 52,
      z = 0.07 + o() * 0.2;
    o() > ne(g, w) * 0.7 + 0.3 ||
      !i(g, w, z) ||
      r.push({
        x: g,
        z: w,
        size: z,
        turn: o() * 6.283,
        stretch: 0.7 + o() * 0.6,
        variant: 3,
      });
  }
  const c = [Re(1.7), Re(5.3), Re(9.1), Re(2.9, 1)],
    d = new Ln();
  c.forEach((x, g) => {
    const w = [...m, ...r].filter((S) => S.variant === g),
      z = new xs(x, n, w.length);
    (w.forEach((S, N) => {
      ((S.y = Zt(S.x, S.z) + S.size * 0.12),
        d.position.set(S.x, S.y, S.z),
        d.rotation.set(0, S.turn, 0),
        d.scale.set(S.size * S.stretch, S.size, S.size / S.stretch),
        d.updateMatrix(),
        z.setMatrixAt(N, d.matrix));
    }),
      (z.castShadow = z.receiveShadow = !0),
      (z.frustumCulled = !1),
      l.add(z));
  });
  const p = Ms(7777),
    u = (x, g) =>
      m.some(
        (w) =>
          Math.abs(w.x - x) < w.size * 1.6 &&
          Math.hypot(w.x - x, w.z - g) < w.size * 1.05,
      ),
    f = (x, g) => {
      const w = [];
      for (let z = 0; z < x * 12 && w.length < x; z++) {
        const S = -26 + p() * 52,
          N = -34 + p() * 46;
        g(S, N) &&
          i(S, N, -0.35) &&
          !u(S, N) &&
          w.push({ x: S, z: N, turn: p() * 6.283, size: 0.45 + p() * 0.6 });
      }
      return w;
    },
    y = f(3600, (x, g) => p() < ne(x, g) * 0.9),
    b = (x, g) => _e(0.5, 0.62, oe(x * 0.09 - 4, g * 0.09 + 8, 2.2, 3)),
    M = f(1200, (x, g) => ne(x, g) > 0.5 && p() < b(x, g)),
    v = no(s, t, e);
  for (const [x, g] of [
    [ea(11), y.filter((w, z) => z % 2 === 0)],
    [ea(23), y.filter((w, z) => z % 2 === 1)],
    [so(), M],
  ]) {
    const w = new xs(x, v, g.length);
    (g.forEach((z, S) => {
      (d.position.set(z.x, Zt(z.x, z.z) - 0.01, z.z),
        d.rotation.set(0, z.turn, 0),
        d.scale.setScalar(z.size),
        d.updateMatrix(),
        w.setMatrixAt(S, d.matrix));
    }),
      (w.frustumCulled = !1),
      (w.receiveShadow = !0),
      l.add(w));
  }
  return l;
}
const J = 16,
  at = new C(1, 0, 0.25).normalize();
let sa = 17017;
const D = () => (sa = (sa * 48271) % 2147483647) / 2147483647,
  j = (s, t) => s + (t - s) * D(),
  ts = [],
  He = new Rn(
    [
      [0.6, 3, 9],
      [4.5, 4.2, 4],
      [7, 6, -3],
      [5, 7.5, -11],
      [-1, 7, -16],
      [-7, 5.5, -11],
      [-8, 4, -3],
      [-4, 3, 4],
    ].map((s) => new C(...s)),
    !0,
    "centripetal",
  ),
  ro = He.getSpacedPoints(240);
function Pa(s, t, e = 2.8) {
  for (let a = 0; a < 4; a++) {
    let l = null,
      o = 1e9;
    for (const m of ro) {
      const r = Math.hypot(s - m.x, t - m.z);
      r < o && ((o = r), (l = m));
    }
    if (o >= e) break;
    const i = s - l.x,
      n = t - l.z,
      h = Math.hypot(i, n) || 1;
    ((s = l.x + (i / h) * e), (t = l.z + (n / h) * e));
  }
  return [s, t];
}
const Va = [],
  bs = [],
  Ea = [],
  La = [],
  Ra = [],
  Se = [],
  Ia = [],
  Da = [],
  ja = [],
  Be = [];
let qe = -1,
  Oe = new C();
const aa = new C(0.6, 1.5, 9),
  vs = [],
  ie = {
    giant: { drag: 3, stiff: 0.65, buoy: 0.4, top: 0.3, lid: J - 0.1 },
    bull: { drag: 3.3, stiff: 0.25, buoy: 0.15, top: 2.5, lid: J - 0.3 },
    palm: { drag: 0.9, stiff: 12, buoy: 0, top: 0, lid: 0 },
  };
let Is = 0,
  Xt = ie.giant,
  Ce = 0;
const Ye = new C(),
  Ft = new C(0, 1, 0);
function Ke(s, t, e, a, l) {
  return (
    Va.push(s.x, s.y, s.z),
    bs.push(t),
    Ia.push(Is),
    Da.push(qe),
    ja.push(Oe.x, Oe.y, Oe.z),
    Ea.push(e),
    La.push(a),
    Ra.push(l),
    Ce++
  );
}
function Ds(s, t, e, a, l) {
  const i = Ce,
    n = [0];
  for (let r = 1; r < s.length; r++)
    n.push(n[r - 1] + s[r].distanceTo(s[r - 1]));
  const h = n[n.length - 1];
  t = n.map((r) => r / h);
  const m = new Float32Array(42);
  for (let r = 0, c = 0; r < 14; r++) {
    const d = (r / 13) * h;
    for (; c < s.length - 2 && n[c + 1] < d; ) c++;
    const p = Math.min(1, Math.max(0, (d - n[c]) / (n[c + 1] - n[c] || 1)));
    new C().lerpVectors(s[c], s[c + 1], p).toArray(m, r * 3);
  }
  ((Is = vs.length),
    vs.push({ nodes: m, ...Xt, drag: Xt.drag * (0.85 + 0.3 * D()) }));
  for (let r = 0; r < s.length; r++) {
    const c = s[Math.min(r + 1, s.length - 1)]
        .clone()
        .sub(s[Math.max(r - 1, 0)])
        .normalize(),
      d = Math.abs(c.y) > 0.9 ? new C(1, 0, 0) : Ft,
      p = new C().crossVectors(c, d).normalize(),
      u = new C().crossVectors(c, p),
      f = e * (1 - (0.4 * r) / s.length);
    for (let y = 0; y < 5; y++) {
      const b = (y / 5) * Math.PI * 2;
      Ke(
        Ye.copy(s[r])
          .addScaledVector(p, Math.cos(b) * f)
          .addScaledVector(u, Math.sin(b) * f),
        t[r],
        0,
        a,
        l,
      );
    }
  }
  for (let r = 0; r < s.length - 1; r++)
    for (let c = 0; c < 5; c++) {
      const d = i + r * 5 + c,
        p = i + r * 5 + ((c + 1) % 5);
      Se.push(d, d + 5, p, p, d + 5, p + 5);
    }
  return t;
}
function js(s, t, e, a, l, o, i, n, h = 0.2, m = 7, r = 0) {
  const d = s
    .clone()
    .addScaledVector(e, l)
    .addScaledVector(Ft, -h * l)
    .addScaledVector(at, 0.25 * l)
    .clone()
    .sub(s);
  if (
    (Oe.copy(s),
    (qe =
      l > 0.45 && s.distanceTo(aa) < 30 && Be.length < 9e3 ? Be.length : -1),
    qe >= 0 &&
      Be.push({
        col: Is,
        h: t,
        attach: s.clone(),
        dir: d.clone().normalize(),
        len: d.length(),
        kind: Xt === ie.bull ? 1 : Xt === ie.palm ? 2 : 0,
      }),
    r > 0)
  ) {
    const S = r * 2.8,
      N = Ce,
      L = e.clone(),
      q = new C()
        .crossVectors(L, Math.abs(L.y) < 0.9 ? Ft : new C(1, 0, 0))
        .normalize(),
      G = new C().crossVectors(L, q),
      U = [0, 0.006, r * 0.9, r, r * 0.55, 0.004];
    U.forEach((T, k) => {
      const _ = s.clone().addScaledVector(L, (S * k) / (U.length - 1));
      for (let A = 0; A < 6; A++) {
        const R = (A / 6) * Math.PI * 2;
        Ke(
          Ye.copy(_)
            .addScaledVector(q, Math.cos(R) * T)
            .addScaledVector(G, Math.sin(R) * T),
          t,
          -0.5,
          i,
          n,
        );
      }
    });
    for (let T = 0; T < U.length - 1; T++)
      for (let k = 0; k < 6; k++) {
        const _ = N + T * 6 + k,
          A = N + T * 6 + ((k + 1) % 6);
        Se.push(_, _ + 6, A, A, _ + 6, A + 6);
      }
    s = s.clone().addScaledVector(L, S);
  }
  const p = s.distanceTo(aa) < 22,
    u = p ? 5 : 3,
    f = (u - 1) / 2;
  p && (m = Math.max(m, Math.round(l * 8) + 5));
  const y = Ce,
    b = new C().crossVectors(e, a).normalize(),
    M = new C().crossVectors(b, e).normalize(),
    v = D() * 10,
    x = j(-0.25, 0.9),
    g = j(-0.8, 0.8),
    w = new C(),
    z = new C();
  for (let S = 0; S <= m; S++) {
    const N = S / m,
      L = s
        .clone()
        .addScaledVector(e, l * N)
        .addScaledVector(Ft, -h * l * N * N)
        .addScaledVector(at, 0.25 * l * N * N),
      q =
        o *
        Math.sin(Math.PI * Math.pow(N, 0.62)) *
        (1 - 0.25 * N) *
        Math.sqrt(Math.min(1, N / 0.08) * 0.9 + 0.1) *
        0.5,
      G = g * N;
    (w.copy(b).applyAxisAngle(e, G), z.copy(M).applyAxisAngle(e, G));
    const U = x * (0.3 + 0.7 * N),
      T =
        0.22 *
        q *
        le.smoothstep(N, 0.05, 0.3) *
        (1 - 0.6 * le.smoothstep(N, 0.85, 1));
    for (let k = -f; k <= f; k++) {
      const _ = k / f,
        A = Math.abs(_),
        R = Math.abs(U) < 0.001 ? _ : Math.sin(_ * U) / U,
        W =
          (Math.abs(U) < 0.001 ? 0 : (1 - Math.cos(_ * U)) / U) * q +
          T *
            A *
            A *
            Math.sin((N * l * 2 * Math.PI) / 0.3 + v + (_ > 0 ? 0 : 2.1));
      Ke(
        Ye.copy(L)
          .addScaledVector(w, R * q)
          .addScaledVector(z, W),
        t,
        N * (0.75 + 0.25 * A),
        i,
        n,
      );
    }
  }
  for (let S = 0; S < m; S++)
    for (let N = 0; N < u - 1; N++) {
      const L = y + S * u + N;
      Se.push(L, L + u, L + 1, L + 1, L + u, L + u + 1);
    }
  qe = -1;
}
function jt(s, t, e = 0) {
  (([s, t] = Pa(s, t, 3.6 + (e ? 1 : 0))), (Xt = ie.giant), ts.push([s, t]));
  const a = Zt(s, t),
    l = D(),
    o = e || 3 + Math.floor(D() * 5);
  for (let i = 0; i < o; i++) {
    const n = D() < 0.78,
      h = n ? J - j(0.05, 0.35) : j(0.35, 0.85) * (J - a) + a,
      m = s + j(-0.25, 0.25),
      r = t + j(-0.25, 0.25),
      c = j(0.8, 2.4),
      d = D() * 6,
      p = j(-0.12, 0.12),
      u = [];
    let f = [];
    const y = 46;
    for (let g = 0; g <= y; g++) {
      const w = g / y,
        z = a + (h - a) * w;
      (u.push(
        new C(
          m + at.x * c * w * w + Math.sin(w * 5 + d) * 0.35 * w,
          z,
          r + at.z * c * w * w + Math.cos(w * 4 + d) * 0.35 * w,
        ),
      ),
        f.push((z - a) / J));
    }
    if (n) {
      const g = j(2, 6),
        w = u[u.length - 1];
      for (let z = 1; z <= 14; z++) {
        const S = z / 14;
        (u.push(
          new C(
            w.x + at.x * g * S + Math.sin(S * 3 + d) * 0.4,
            w.y - Math.sin(S * 9 + d) * 0.06,
            w.z + at.z * g * S + Math.cos(S * 3 + d) * 0.6 * S,
          ),
        ),
          f.push(f[f.length - 1]));
      }
    }
    const b = Ds(u, f, 0.028, l, p),
      M = y + 1;
    let v = 3,
      x = 1;
    for (; v < u.length - 1; ) {
      const g = Math.min(v / M, 1),
        w = v >= M,
        z = u[v + 1]
          .clone()
          .sub(u[v - 1])
          .normalize(),
        N = new C()
          .crossVectors(z, w ? new C(0, 0, 1) : Ft)
          .normalize()
          .multiplyScalar(x)
          .applyAxisAngle(z, j(-0.6, 0.6))
          .clone()
          .multiplyScalar(w ? 0.5 : 0.75)
          .add(at.clone().multiplyScalar(0.55))
          .addScaledVector(Ft, w ? -0.7 : j(0.05, 0.5))
          .normalize(),
        L = w ? j(0.35, 0.7) : le.lerp(1.35, 0.45, g) * j(0.75, 1.2);
      (D() > 0.12 &&
        js(
          u[v],
          b[v],
          N,
          z,
          L,
          L * j(0.22, 0.32),
          l,
          p,
          w ? 0.05 : 0.28,
          7,
          0.011 + 0.01 * Math.min(1, L),
        ),
        (x = -x),
        (v += 1));
    }
  }
}
function lo(s, t) {
  (([s, t] = Pa(s, t, 4.2)), (Xt = ie.bull), ts.push([s, t]));
  const e = Zt(s, t),
    a = D(),
    l = j(0.05, 0.2),
    o = J - j(0.6, 1.6),
    i = j(1, 3),
    n = D() * 6,
    h = [];
  let m = [];
  for (let f = 0; f <= 50; f++) {
    const y = f / 50,
      b = e + (o - e) * y;
    (h.push(
      new C(
        s + at.x * i * y * y + Math.sin(y * 4 + n) * 0.3 * y,
        b,
        t + at.z * i * y * y,
      ),
    ),
      m.push((b - e) / J));
  }
  (Ds(h, m, 0.016, a, l), (m = m.map(() => 1)));
  const r = h[h.length - 1],
    c = m[m.length - 1],
    d = [];
  for (let f = 0; f <= 8; f++) d.push(r.clone().add(new C(0, f * 0.03, 0)));
  const p = 6,
    u = Ce;
  for (let f = 0; f < d.length; f++) {
    const y = Math.sin((Math.PI * f) / (d.length - 1)) * 0.09 + 0.012;
    for (let b = 0; b < p; b++) {
      const M = (b / p) * Math.PI * 2;
      Ke(
        Ye.copy(d[f]).add(new C(Math.cos(M) * y, 0, Math.sin(M) * y)),
        c,
        0,
        a,
        l,
      );
    }
  }
  for (let f = 0; f < d.length - 1; f++)
    for (let y = 0; y < p; y++) {
      const b = u + f * p + y,
        M = u + f * p + ((y + 1) % p);
      Se.push(b, b + p, M, M, b + p, M + p);
    }
  for (let f = 0; f < 2; f++)
    for (let y = 0; y < 9; y++) {
      const b = at
        .clone()
        .add(new C(j(-0.4, 0.4), j(-0.1, 0.5), (f ? 1 : -1) * j(0.2, 0.7)))
        .normalize();
      js(
        r.clone().add(new C(0, 0.2, 0)),
        c,
        b,
        Ft,
        j(2.2, 3.8),
        j(0.07, 0.12),
        a,
        l,
        0.35,
        12,
      );
    }
}
function io(s, t) {
  ((Xt = ie.palm), ts.push([s, t]));
  const e = Zt(s, t),
    a = D(),
    l = j(-0.3, -0.15),
    o = j(0.6, 1.3),
    i = [];
  let n = [];
  for (let r = 0; r <= 8; r++) {
    const c = r / 8;
    (i.push(new C(s + Math.sin(c * 2) * 0.05, e + o * c, t)),
      n.push(((o * c) / J) * 0.3));
  }
  n = Ds(i, n, 0.03, a, l);
  const h = i[8],
    m = D() * 6;
  for (let r = 0; r < 16; r++) {
    const c = r % 2 ? 1 : -1,
      d = new C(Math.cos(m) * c, j(0.3, 1.1), Math.sin(m) * c)
        .add(new C(j(-0.3, 0.3), 0, j(-0.3, 0.3)))
        .normalize();
    js(
      h.clone().add(new C(0, -r * 0.02, 0)),
      n[8],
      d,
      Ft,
      j(0.5, 0.9),
      j(0.05, 0.08),
      a,
      l,
      0.5,
    );
  }
}
function co() {
  const s = (n, h) => n * n + (h - 9) ** 2 > 30;
  (jt(-5.5, 3, 14),
    jt(4.8, -2.5, 12),
    jt(-1.5, -8, 11),
    jt(7.5, 4, 8),
    jt(-9, -3, 10),
    jt(2, -14, 10));
  let t = 0;
  for (; t < 170; ) {
    const n = j(-34, 34),
      h = j(-48, 4);
    s(n, h) && (jt(n, h), t++);
  }
  for (t = 0; t < 12; ) {
    const n = j(-30, 30),
      h = j(-40, 2);
    s(n, h) && (lo(n, h), t++);
  }
  for (t = 0; t < 150; ) {
    const n = j(-24, 24),
      h = j(-30, 9);
    (n - 0.6) ** 2 + (h - 9) ** 2 > 16 && (io(n, h), t++);
  }
  const e = new ke();
  e.setAttribute("position", new vt(Va, 3));
  const a = bs.length,
    l = new Float32Array(a * 4),
    o = new Float32Array(a * 2);
  for (let n = 0; n < a; n++)
    (l.set([bs[n], Ea[n], Ia[n], Da[n]], n * 4),
      (o[n * 2] = La[n]),
      (o[n * 2 + 1] = Ra[n]));
  (e.setAttribute("aKelp", new Ue(l, 4)),
    e.setAttribute("aST", new Ue(o, 2)),
    e.setAttribute("aAttach", new vt(ja, 3)),
    e.setIndex(Se),
    e.computeVertexNormals());
  const i = e.attributes.normal.array;
  for (let n = 0; n < i.length; n += 3)
    Math.abs(i[n]) + Math.abs(i[n + 1]) + Math.abs(i[n + 2]) > 1e-6 ||
      ((i[n] = 0), (i[n + 1] = 1), (i[n + 2] = 0));
  return e;
}
const uo = [
    [10, 0.12, 0.75],
    [6.3, 0.5, 0.12],
    [4.1, -0.7, 0.05],
  ],
  fe = 1.8,
  ds = 1.2,
  na = 3.5,
  oa = 0.05;
class ho {
  constructor(t = 24, e = 14, a = 24) {
    (Object.assign(this, { nx: t, ny: e, nz: a, n: t * e * a }),
      (this.min = [-40, -2, -54]),
      (this.size = [80, J + 3, 72]),
      (this.cell = [
        this.size[0] / (t - 1),
        this.size[1] / (e - 1),
        this.size[2] / (a - 1),
      ]));
    for (const o of [
      "u",
      "v",
      "w",
      "u0",
      "v0",
      "w0",
      "tu",
      "tv",
      "tw",
      "p",
      "div",
      "cx",
      "cy",
      "cz",
      "cm",
    ])
      this[o] = new Float32Array(this.n);
    ((this.time = 0),
      (this.current = { x: oa, y: 0, z: 0 }),
      (this.pulse = { x: 0, z: 0, start: -1e9 }),
      (this.swellGain = 1));
    const l = J - this.min[1];
    ((this.swell = uo.map(([o, i, n], h) => {
      const m = (2 * Math.PI) / o;
      let r = (m * m) / 9.81;
      for (let u = 0; u < 30; u++) r = (m * m) / (9.81 * Math.tanh(r * l));
      const c = Math.sinh(r * l),
        d = new Float32Array(e),
        p = new Float32Array(e);
      for (let u = 0; u < e; u++) {
        const f = Math.min(J, this.min[1] + u * this.cell[1]),
          y = f - this.min[1],
          b = Math.min(1, Math.max(0, (f - (J - 6)) / 6));
        ((d[u] = (n * m * Math.cosh(r * y)) / c),
          (p[u] =
            ((n * m * Math.sinh(r * y)) / c) *
            (1 - 0.7 * b * b * (3 - 2 * b))));
      }
      return {
        w: m,
        kx: r * Math.cos(i),
        kz: r * Math.sin(i),
        cx: Math.cos(i),
        cz: Math.sin(i),
        hy: d,
        vy: p,
        phase: h * 2.1,
      };
    })),
      this.updateTotal());
  }
  setStream(t, e, a = oa) {
    const l = Math.hypot(t, e) || 1;
    ((this.current.x = (t / l) * a), (this.current.z = (e / l) * a));
  }
  surge(t = 0.55, e = 0) {
    const a = Math.hypot(this.current.x, this.current.z) || 1,
      l = Math.cos(e),
      o = Math.sin(e),
      i = this.current.x / a,
      n = this.current.z / a;
    this.pulse = {
      x: (i * l - n * o) * t,
      z: (i * o + n * l) * t,
      start: this.time,
    };
  }
  pulseAt(t) {
    const e = t - this.pulse.start,
      a = (l) => l * l * (3 - 2 * l);
    return e < 0 || e > fe + ds + na
      ? 0
      : e < fe
        ? a(e / fe)
        : e < fe + ds
          ? 1
          : 1 - a((e - fe - ds) / na);
  }
  toGrid(t, e, a) {
    return [
      ((t - this.min[0]) / this.size[0]) * (this.nx - 1),
      ((e - this.min[1]) / this.size[1]) * (this.ny - 1),
      ((a - this.min[2]) / this.size[2]) * (this.nz - 1),
    ];
  }
  addImpulse(t, e, a, l, o, i, n = 6) {
    const { nx: h, ny: m, nz: r } = this,
      [c, d, p] = this.toGrid(t, e, a),
      u = n / this.cell[0],
      f = u * u;
    for (
      let y = Math.max(1, Math.floor(p - u));
      y <= Math.min(r - 2, Math.ceil(p + u));
      y++
    )
      for (
        let b = Math.max(1, Math.floor(d - u));
        b <= Math.min(m - 2, Math.ceil(d + u));
        b++
      )
        for (
          let M = Math.max(1, Math.floor(c - u));
          M <= Math.min(h - 2, Math.ceil(c + u));
          M++
        ) {
          const v = (M - c) ** 2 + (b - d) ** 2 + (y - p) ** 2;
          if (v >= f) continue;
          const x = Math.exp(-v / (f * 0.45)),
            g = M + h * (b + m * y);
          ((this.u[g] += l * x), (this.v[g] += o * x), (this.w[g] += i * x));
        }
  }
  sample3(t, e, a, l, o, i, n, h = 0) {
    const { nx: m, ny: r, nz: c } = this,
      d = Math.min(Math.max(l, 0.5), m - 1.5),
      p = Math.min(Math.max(o, 0.5), r - 1.5),
      u = Math.min(Math.max(i, 0.5), c - 1.5),
      f = d | 0,
      y = p | 0,
      b = u | 0,
      M = d - f,
      v = p - y,
      x = u - b,
      g = f + m * (y + r * b),
      w = g + 1,
      z = g + m,
      S = z + 1,
      N = m * r,
      L = g + N,
      q = w + N,
      G = z + N,
      U = S + N,
      T = 1 - M,
      k = 1 - v,
      _ = 1 - x,
      A = T * k * _,
      R = M * k * _,
      H = T * v * _,
      W = M * v * _,
      Z = T * k * x,
      st = M * k * x,
      $ = T * v * x,
      pt = M * v * x;
    ((n[h] =
      t[g] * A +
      t[w] * R +
      t[z] * H +
      t[S] * W +
      t[L] * Z +
      t[q] * st +
      t[G] * $ +
      t[U] * pt),
      (n[h + 1] =
        e[g] * A +
        e[w] * R +
        e[z] * H +
        e[S] * W +
        e[L] * Z +
        e[q] * st +
        e[G] * $ +
        e[U] * pt),
      (n[h + 2] =
        a[g] * A +
        a[w] * R +
        a[z] * H +
        a[S] * W +
        a[L] * Z +
        a[q] * st +
        a[G] * $ +
        a[U] * pt));
  }
  sample(t, e, a, l, o = 0) {
    const [i, n, h] = this.toGrid(t, e, a);
    this.sample3(this.tu, this.tv, this.tw, i, n, h, l, o);
  }
  updateTotal() {
    const {
        nx: t,
        ny: e,
        nz: a,
        cell: l,
        u: o,
        v: i,
        w: n,
        tu: h,
        tv: m,
        tw: r,
      } = this,
      [c, d, p] = this.swell,
      u = this.swellGain,
      f = this.pulseAt(this.time),
      y = this.current.x + this.pulse.x * f,
      b = this.current.z + this.pulse.z * f;
    for (let M = 0; M < a; M++) {
      const v = this.min[2] + M * l[2];
      for (let x = 0; x < t; x++) {
        const g = this.min[0] + x * l[0],
          w = c.kx * g + c.kz * v - c.w * this.time + c.phase,
          z = d.kx * g + d.kz * v - d.w * this.time + d.phase,
          S = p.kx * g + p.kz * v - p.w * this.time + p.phase,
          N = Math.cos(w) * u,
          L = Math.cos(z) * u,
          q = Math.cos(S) * u,
          G = Math.sin(w) * u,
          U = Math.sin(z) * u,
          T = Math.sin(S) * u;
        for (let k = 0, _ = x + t * e * M; k < e; k++, _ += t)
          ((h[_] =
            o[_] +
            y +
            c.hy[k] * N * c.cx +
            d.hy[k] * L * d.cx +
            p.hy[k] * q * p.cx),
            (m[_] = i[_] + c.vy[k] * G + d.vy[k] * U + p.vy[k] * T),
            (r[_] =
              n[_] +
              b +
              c.hy[k] * N * c.cz +
              d.hy[k] * L * d.cz +
              p.hy[k] * q * p.cz));
      }
    }
  }
  step(t) {
    if (t <= 0) return;
    this.time += t;
    const {
        nx: e,
        ny: a,
        nz: l,
        u: o,
        v: i,
        w: n,
        u0: h,
        v0: m,
        w0: r,
        tu: c,
        tv: d,
        tw: p,
        p: u,
        div: f,
        cell: y,
      } = this,
      b = this.time,
      M = e,
      v = e * a,
      x = 1 - 0.18 * t;
    for (let T = 1; T < l - 1; T++) {
      const k = this.min[2] + T * y[2];
      for (let _ = 1; _ < a - 1; _++) {
        const A = this.min[1] + _ * y[1],
          R = Math.exp(-Math.max(0, (J - A) / 25) * 0.95);
        for (let H = 1; H < e - 1; H++) {
          const W = this.min[0] + H * y[0],
            Z = H + M * _ + v * T,
            st = 0.45 * W + 0.3 * k - 0.31 * b,
            $ = -0.38 * W + 0.52 * k - 0.42 * b + 1.4,
            pt = 0.5 * A + 0.25 * W - 0.37 * b,
            lt = Math.sin(pt);
          ((o[Z] =
            (o[Z] +
              (lt * 0.03 + Math.cos($) * Math.sin(st) * 0.025) * R * t * 3) *
            x),
            (i[Z] = (i[Z] + Math.cos(pt) * 0.012 * R * t * 3) * x),
            (n[Z] =
              (n[Z] +
                (-lt * 0.025 + Math.cos(st) * Math.sin($) * 0.025) *
                  R *
                  t *
                  3) *
              x));
        }
      }
    }
    const { cx: g, cy: w, cz: z, cm: S } = this;
    for (let T = 1; T < l - 1; T++)
      for (let k = 1; k < a - 1; k++)
        for (let _ = 1; _ < e - 1; _++) {
          const A = _ + M * k + v * T,
            R = (n[A + M] - n[A - M] - i[A + v] + i[A - v]) * 0.5,
            H = (o[A + v] - o[A - v] - n[A + 1] + n[A - 1]) * 0.5,
            W = (i[A + 1] - i[A - 1] - o[A + M] + o[A - M]) * 0.5;
          ((g[A] = R), (w[A] = H), (z[A] = W), (S[A] = Math.hypot(R, H, W)));
        }
    const N = 0.8 * t;
    for (let T = 2; T < l - 2; T++)
      for (let k = 2; k < a - 2; k++)
        for (let _ = 2; _ < e - 2; _++) {
          const A = _ + M * k + v * T;
          let R = S[A + 1] - S[A - 1],
            H = S[A + M] - S[A - M],
            W = S[A + v] - S[A - v];
          const Z = Math.hypot(R, H, W) + 1e-5;
          ((R /= Z),
            (H /= Z),
            (W /= Z),
            (o[A] += (H * z[A] - W * w[A]) * N),
            (i[A] += (W * g[A] - R * z[A]) * N),
            (n[A] += (R * w[A] - H * g[A]) * N));
        }
    (h.set(o), m.set(i), r.set(n));
    const L = (this._s ??= new Float32Array(3)),
      q = t / y[0],
      G = t / y[1],
      U = t / y[2];
    for (let T = 1; T < l - 1; T++)
      for (let k = 1; k < a - 1; k++)
        for (let _ = 1; _ < e - 1; _++) {
          const A = _ + M * k + v * T;
          (this.sample3(h, m, r, _ - c[A] * q, k - d[A] * G, T - p[A] * U, L),
            (o[A] = L[0]),
            (i[A] = L[1]),
            (n[A] = L[2]));
        }
    for (let T = 1; T < l - 1; T++)
      for (let k = 1; k < a - 1; k++)
        for (let _ = 1; _ < e - 1; _++) {
          const A = _ + M * k + v * T;
          ((f[A] =
            (-0.5 *
              (o[A + 1] -
                o[A - 1] +
                i[A + M] -
                i[A - M] +
                n[A + v] -
                n[A - v])) /
            3),
            (u[A] = 0));
        }
    for (let T = 0; T < 8; T++)
      for (let k = 1; k < l - 1; k++)
        for (let _ = 1; _ < a - 1; _++)
          for (let A = 1; A < e - 1; A++) {
            const R = A + M * _ + v * k;
            u[R] =
              (f[R] +
                u[R - 1] +
                u[R + 1] +
                u[R - M] +
                u[R + M] +
                u[R - v] +
                u[R + v]) /
              6;
          }
    for (let T = 1; T < l - 1; T++)
      for (let k = 1; k < a - 1; k++)
        for (let _ = 1; _ < e - 1; _++) {
          const A = _ + M * k + v * T;
          ((o[A] -= 0.5 * (u[A + 1] - u[A - 1])),
            (i[A] -= 0.5 * (u[A + M] - u[A - M])),
            (n[A] -= 0.5 * (u[A + v] - u[A - v])));
        }
    for (let T = 0; T < l; T++)
      for (let k = 0; k < e; k++) {
        const _ = k + e * a * T;
        ((o[_] = i[_] = n[_] = 0), (i[k + e * (a - 1 + a * T)] *= 0.25));
      }
    this.updateTotal();
  }
}
const O = 14;
class mo {
  constructor(t) {
    const e = (this.nc = t.length);
    ((this.rest = new Float32Array(e * O * 3)),
      (this.seg = new Float32Array(e * (O - 1))),
      (this.prm = new Float32Array(e * 5)),
      t.forEach((a, l) => {
        this.rest.set(a.nodes, l * O * 3);
        for (let i = 0; i < O - 1; i++) {
          const n = i * 3;
          this.seg[l * (O - 1) + i] = Math.hypot(
            a.nodes[n + 3] - a.nodes[n],
            a.nodes[n + 4] - a.nodes[n + 1],
            a.nodes[n + 5] - a.nodes[n + 2],
          );
        }
        let o = a.lid;
        for (let i = 1; i < O; i++) o = Math.max(o, a.nodes[i * 3 + 1]);
        this.prm.set([a.drag, a.stiff, a.buoy, a.top, o], l * 5);
      }),
      (this.pos = this.rest.slice()),
      (this.prev = this.rest.slice()),
      (this.speed = new Float32Array(e * O)),
      (this.data = new Float32Array(O * e * 4)),
      (this.texture = new za(this.data, O, e, Sa, Ca)),
      (this.texture.minFilter = this.texture.magFilter = ka),
      (this.texture.needsUpdate = !0),
      (this._f = new Float32Array(3)));
  }
  step(t, e, a = 3) {
    if (t <= 0) return;
    const { nc: l, pos: o, prev: i, rest: n, prm: h, speed: m, seg: r } = this,
      c = this._f,
      d = e.current,
      p = t * t,
      u = 1 / t,
      f = 0.995;
    for (let y = 0; y < l; y++) {
      const b = h[y * 5],
        M = h[y * 5 + 1],
        v = h[y * 5 + 2],
        x = h[y * 5 + 3];
      for (let g = 1; g < O; g++) {
        const w = (y * O + g) * 3,
          z = o[w],
          S = o[w + 1],
          N = o[w + 2],
          L = (z - i[w]) * f,
          q = (S - i[w + 1]) * f,
          G = (N - i[w + 2]) * f;
        ((i[w] = z), (i[w + 1] = S), (i[w + 2] = N), e.sample(z, S, N, c));
        const U = c[0] - L * u,
          T = c[1] - q * u,
          k = c[2] - G * u;
        ((m[y * O + g] = Math.hypot(U, T, k)),
          (o[w] = z + L + ((U - d.x) * b + (n[w] - z) * M) * p),
          (o[w + 1] =
            S +
            q +
            (T * b + (n[w + 1] - S) * M + v + (g === O - 1 ? x : 0)) * p),
          (o[w + 2] = N + G + ((k - d.z) * b + (n[w + 2] - N) * M) * p));
      }
      m[y * O] = m[y * O + 1];
    }
    for (let y = 0; y < a; y++)
      for (let b = 0; b < l; b++) {
        const M = b * O * 3,
          v = h[b * 5 + 4];
        ((o[M] = n[M]), (o[M + 1] = n[M + 1]), (o[M + 2] = n[M + 2]));
        for (let x = 0; x < O - 1; x++) {
          const g = M + x * 3,
            w = g + 3,
            z = o[w] - o[g],
            S = o[w + 1] - o[g + 1],
            N = o[w + 2] - o[g + 2],
            L = Math.sqrt(z * z + S * S + N * N) + 1e-6,
            q = (L - r[b * (O - 1) + x]) / L;
          if (x === 0)
            ((o[w] -= z * q), (o[w + 1] -= S * q), (o[w + 2] -= N * q));
          else {
            const G = q * 0.5;
            ((o[g] += z * G),
              (o[g + 1] += S * G),
              (o[g + 2] += N * G),
              (o[w] -= z * G),
              (o[w + 1] -= S * G),
              (o[w + 2] -= N * G));
          }
        }
        for (let x = 1; x < O; x++)
          o[M + x * 3 + 1] > v && (o[M + x * 3 + 1] = v);
      }
    for (let y = 0; y < l; y++)
      for (let b = 0; b < O; b++) {
        const M = (y * O + b) * 3,
          v = (y * O + b) * 4;
        ((this.data[v] = o[M] - n[M]),
          (this.data[v + 1] = o[M + 1] - n[M + 1]),
          (this.data[v + 2] = o[M + 2] - n[M + 2]),
          (this.data[v + 3] = m[y * O + b]));
      }
    this.texture.needsUpdate = !0;
  }
}
const po = [
    { max: 1.6, k: 2.5 },
    { max: 2.2, k: 0.3 },
    { max: 1, k: 2.5 },
  ],
  hs = 20,
  ms = 2048;
class fo {
  constructor(t, e) {
    const a = (this.n = t.length);
    ((this.kelp = e),
      (this.attach = new Float32Array(a * 3)),
      (this.dir = new Float32Array(a * 3)),
      (this.len = new Float32Array(a)),
      (this.tip = new Float32Array(a * 3)),
      (this.prev = new Float32Array(a * 3)),
      (this.node = new Int32Array(a * 4)),
      (this.w = new Float32Array(a * 4)),
      (this.cosMax = new Float32Array(a)),
      (this.sinMax = new Float32Array(a)),
      (this.k = new Float32Array(a)),
      t.forEach((o, i) => {
        (o.attach.toArray(this.attach, i * 3),
          o.dir.toArray(this.dir, i * 3),
          (this.len[i] = o.len));
        for (let u = 0; u < 3; u++)
          this.tip[i * 3 + u] = this.prev[i * 3 + u] =
            this.attach[i * 3 + u] + this.dir[i * 3 + u] * o.len;
        const n = Math.min(1, Math.max(0, o.h)) * (O - 1),
          h = Math.min(Math.floor(n), O - 2),
          m = n - h,
          r = m * m,
          c = r * m;
        ([Math.max(h - 1, 0), h, h + 1, Math.min(h + 2, O - 1)].forEach(
          (u, f) => {
            this.node[i * 4 + f] = (o.col * O + u) * 3;
          },
        ),
          this.w.set(
            [
              0.5 * (2 * r - m - c),
              0.5 * (2 - 5 * r + 3 * c),
              0.5 * (m + 4 * r - 3 * c),
              0.5 * (c - r),
            ],
            i * 4,
          ));
        const p = po[o.kind];
        ((this.cosMax[i] = Math.cos(p.max)),
          (this.sinMax[i] = Math.sin(p.max)),
          (this.k[i] = p.k * (0.7 + 0.6 * ((i * 0.618) % 1))));
      }));
    const l = Math.max(1, Math.ceil(a / ms));
    ((this.data = new Float32Array(ms * l * 4)),
      (this.texture = new za(this.data, ms, l, Sa, Ca)),
      (this.texture.minFilter = this.texture.magFilter = ka),
      (this.texture.needsUpdate = !0),
      (this._f = new Float32Array(3)),
      (this._a = new Float32Array(3)));
  }
  attachNow(t, e) {
    const { node: a, w: l, attach: o } = this,
      i = this.kelp.pos,
      n = this.kelp.rest;
    for (let h = 0; h < 3; h++) {
      let m = 0;
      for (let r = 0; r < 4; r++) {
        const c = a[t * 4 + r] + h;
        m += (i[c] - n[c]) * l[t * 4 + r];
      }
      e[h] = o[t * 3 + h] + m;
    }
  }
  step(t, e, a = 2) {
    if (t <= 0) return;
    const {
        n: l,
        tip: o,
        prev: i,
        dir: n,
        len: h,
        k: m,
        cosMax: r,
        sinMax: c,
        data: d,
      } = this,
      p = this._f,
      u = this._a,
      f = e.current,
      y = t * t,
      b = 1 / t,
      M = 0.995,
      v = 15.95;
    for (let x = 0; x < l; x++) {
      const g = x * 3;
      this.attachNow(x, u);
      const w = o[g],
        z = o[g + 1],
        S = o[g + 2],
        N = (w - i[g]) * M,
        L = (z - i[g + 1]) * M,
        q = (S - i[g + 2]) * M;
      ((i[g] = w),
        (i[g + 1] = z),
        (i[g + 2] = S),
        e.sample((u[0] + w) * 0.5, (u[1] + z) * 0.5, (u[2] + S) * 0.5, p));
      const G = h[x],
        U = m[x];
      let T =
          w + N + ((p[0] - f.x - N * b) * hs + (u[0] + n[g] * G - w) * U) * y,
        k = z + L + ((p[1] - L * b) * hs + (u[1] + n[g + 1] * G - z) * U) * y,
        _ =
          S +
          q +
          ((p[2] - f.z - q * b) * hs + (u[2] + n[g + 2] * G - S) * U) * y;
      for (let he = 0; he < a; he++) {
        let B = T - u[0],
          tt = k - u[1],
          it = _ - u[2],
          ft = Math.hypot(B, tt, it) + 1e-6;
        const zt = B / ft,
          F = tt / ft,
          St = it / ft,
          ct = n[g],
          It = n[g + 1],
          Jt = n[g + 2],
          te = zt * ct + F * It + St * Jt;
        if (te < r[x]) {
          const Dt = zt - te * ct,
            ee = F - te * It,
            se = St - te * Jt,
            pe = Math.hypot(Dt, ee, se) + 1e-6,
            Ct = c[x] / pe;
          ((T += (u[0] + (ct * r[x] + Dt * Ct) * G - T) * 0.55),
            (k += (u[1] + (It * r[x] + ee * Ct) * G - k) * 0.55),
            (_ += (u[2] + (Jt * r[x] + se * Ct) * G - _) * 0.55));
        }
        ((B = T - u[0]),
          (tt = k - u[1]),
          (it = _ - u[2]),
          (ft = Math.hypot(B, tt, it) + 1e-6));
        const me = (ft - G) / ft;
        ((T -= B * me), (k -= tt * me), (_ -= it * me));
      }
      ((o[g] = T), (o[g + 1] = Math.min(k, v)), (o[g + 2] = _));
      let A = T - u[0],
        R = o[g + 1] - u[1],
        H = _ - u[2];
      const W = Math.hypot(A, R, H) || 1;
      ((A /= W), (R /= W), (H /= W));
      const Z = n[g],
        st = n[g + 1],
        $ = n[g + 2];
      let pt = st * H - $ * R,
        lt = $ * A - Z * H,
        de = Z * R - st * A;
      const Qt = Math.hypot(pt, lt, de),
        is = Math.atan2(Qt, Z * A + st * R + $ * H),
        dt = Qt > 1e-6 ? is / Qt : 0;
      ((d[x * 4] = pt * dt),
        (d[x * 4 + 1] = lt * dt),
        (d[x * 4 + 2] = de * dt),
        (d[x * 4 + 3] = Math.hypot(p[0] - f.x, p[1], p[2] - f.z)));
    }
    this.texture.needsUpdate = !0;
  }
}
function go() {
  const s = [],
    t = [],
    e = [],
    i = (r) => {
      const c = Math.sqrt(Math.min(1, r / 0.3)),
        d = 1 - Math.pow(Math.max(0, (r - 0.3) / 0.7), 1.35) * 0.86;
      return 0.2 * c * d + 0.008;
    };
  for (let r = 0; r <= 22; r++) {
    const c = r / 22,
      d = 0.5 - c * 0.78 * 1,
      p = i(c),
      u = p * 0.42;
    for (let f = 0; f < 14; f++) {
      const y = (f / 14) * Math.PI * 2,
        b = Math.sin(y) * p * (Math.sin(y) > 0 ? 1.05 : 0.9);
      (s.push(Math.cos(y) * u, b, d), t.push(c * 0.78, 0));
    }
  }
  for (let r = 0; r < 22; r++)
    for (let c = 0; c < 14; c++) {
      const d = r * 14 + c,
        p = r * 14 + ((c + 1) % 14);
      e.push(d, d + 14, p, p, d + 14, p + 14);
    }
  const n = s.length / 3;
  (s.push(0, 0, 0.51), t.push(0, 0));
  for (let r = 0; r < 14; r++) e.push(n, (r + 1) % 14, r);
  const h = (r, c) => {
    const d = s.length / 3;
    r.forEach((p, u) => {
      (s.push(...p), t.push(c[u], 1));
    });
    for (let p = 1; p < r.length - 1; p++) e.push(d, d + p, d + p + 1);
  };
  (h(
    [
      [0, 0, -0.28],
      [0, 0.2, -0.52],
      [0, 0.05, -0.42],
      [0, 0, -0.4],
      [0, -0.05, -0.42],
      [0, -0.2, -0.52],
    ],
    [0.78, 1, 0.93, 0.9, 0.93, 1],
  ),
    h(
      [
        [0, 0.19, 0.2],
        [0, 0.27, 0.02],
        [0, 0.2, -0.12],
        [0, 0.14, -0.18],
      ],
      [0.3, 0.5, 0.62, 0.68],
    ),
    h(
      [
        [0, -0.15, -0.02],
        [0, -0.22, -0.12],
        [0, -0.12, -0.2],
      ],
      [0.52, 0.62, 0.7],
    ),
    h(
      [
        [0.07, -0.03, 0.26],
        [0.2, -0.09, 0.12],
        [0.08, -0.06, 0.16],
      ],
      [0.24, 0.38, 0.34],
    ),
    h(
      [
        [-0.07, -0.03, 0.26],
        [-0.2, -0.09, 0.12],
        [-0.08, -0.06, 0.16],
      ],
      [0.24, 0.38, 0.34],
    ));
  const m = new ke();
  return (
    m.setAttribute("position", new vt(s, 3)),
    m.setAttribute("uv", new vt(t, 2)),
    m.setIndex(e),
    m.computeVertexNormals(),
    m
  );
}
function wo(s, t, e) {
  const a = [];
  for (let B = 0; B < 4; B++)
    a.push({
      seed: D() * 100,
      y: 4 + B * 2.4,
      r: 9 + D() * 8,
      speed: 0.045 + D() * 0.03,
      cx: -6 + D() * 12,
      cz: -14 + D() * 12,
    });
  const h = [];
  for (let B = 0; B < 188; B++) {
    const tt = B < 180 ? Math.floor(B / 45) : -1;
    h.push({
      school: tt,
      pos: new C(D() * 20 - 10, 3 + D() * 9, -D() * 20),
      vel: new C(0.5, 0, 0),
      off: new C(D() - 0.5, (D() - 0.5) * 0.6, D() - 0.5).multiplyScalar(
        tt >= 0 ? 4.5 : 0,
      ),
      size: tt >= 0 ? 0.13 + D() * 0.05 : 0.24 + D() * 0.06,
      phase: D() * 100,
      home: tt < 0 ? new C(D() * 24 - 12, 0, D() * 22 - 16) : null,
    });
  }
  for (const B of h)
    B.home && (B.home.y = Zt(B.home.x, B.home.z) + 0.6 + D() * 1.2);
  const m = go(),
    r = new Float32Array(188),
    c = new Float32Array(188),
    d = new Float32Array(188);
  h.forEach((B, tt) => {
    ((r[tt] = B.school < 0 ? 1 : 0), (c[tt] = B.phase));
  });
  const p = new be(d, 1),
    u = xe(new be(r, 1)),
    f = xe(new be(c, 1)),
    y = xe(p),
    b = new $e({ roughness: 0.55, metalness: 0, side: Je }),
    M = Vt("uv").x,
    v = Vt("uv").y,
    x = M.pow(2.2).mul(0.16).add(0.006),
    g = e.mul(y.mul(7).add(4)).add(f).sub(M.mul(4.5));
  b.positionNode = Ut.add(V(Kt(g).mul(x), 0, 0));
  const w = rt(0.04, -0.1, Ut.y),
    z = gt(Ut.mul(28)).smoothstep(0.25, 0.6).mul(M.smoothstep(0.35, 0.7)),
    S = K(
      V(0.035, 0.045, 0.06).mul(P(1).sub(z.mul(0.5))),
      V(0.48, 0.13, 0.015),
      u,
    ),
    N = K(V(0.09, 0.11, 0.13), V(0.55, 0.18, 0.03), u),
    L = Tt(Ut.z.sub(0.4), Ut.y.sub(0.04)).length(),
    q = rt(0.034, 0.026, L).mul(v.oneMinus()),
    G = rt(0.045, 0.038, L).mul(v.oneMinus()).sub(q),
    U = K(K(S, N, w).mul(K(1, 0.75, v)), V(0.18, 0.17, 0.14), G.mul(0.6)).mul(
      q.oneMinus().mul(0.95).add(0.05),
    ),
    T = s.sunAt(X).mul(t(X.xz, X.y));
  b.colorNode = U.mul(T);
  const k = wt.sub(X).normalize(),
    _ = ln(Me.dot(k))
      .pow(3)
      .mul(w.mul(0.7).add(0.15))
      .mul(P(1).sub(u))
      .mul(v.oneMinus())
      .mul(0.02),
    A = v.mul(k.negate().dot(s.sun).max(0).pow(3)).mul(0.05);
  b.emissiveNode = U.mul(s.ambientAt(X, Me)).add(
    s.sunAt(X).mul(_.add(A.mul(K(V(0.5, 0.55, 0.5), V(1, 0.45, 0.1), u)))),
  );
  const R = new xs(m, b, 188);
  ((R.frustumCulled = !1), (R.castShadow = !0));
  const H = new Es(),
    W = new ze(),
    Z = new C(),
    st = new C(),
    $ = new C(),
    pt = new C(0, 0, 1),
    lt = new C(),
    de = new ze(),
    Qt = a.map(() => new C()),
    is = a.map((B, tt) => h.filter((it) => it.school === tt));
  let dt = 0;
  function he(B, tt) {
    ((dt += B),
      a.forEach((F, St) => {
        const ct = dt * F.speed + F.seed;
        Qt[St].set(
          F.cx + Math.cos(ct) * F.r,
          F.y + Math.sin(ct * 2.3) * 1.5,
          F.cz + Math.sin(ct * 1.3) * F.r * 0.7,
        );
      }));
    const it = new Float32Array(3),
      ft = a.map(() => new C()),
      zt = a.map(() => 0);
    (h.forEach((F) => {
      F.school >= 0 && (ft[F.school].add(F.vel), zt[F.school]++);
    }),
      ft.forEach((F, St) => F.divideScalar(Math.max(1, zt[St]))),
      h.forEach((F, St) => {
        if (($.set(0, 0, 0), F.school >= 0)) {
          const te = is[F.school];
          for (const Dt of te) {
            if (Dt === F) continue;
            const ee = F.pos.x - Dt.pos.x,
              se = F.pos.y - Dt.pos.y,
              pe = F.pos.z - Dt.pos.z,
              Ct = ee * ee + se * se + pe * pe;
            Ct < 0.5 &&
              Ct > 1e-6 &&
              $.add(
                Z.set(ee, se * 1.5, pe).multiplyScalar(((0.5 - Ct) * 6) / Ct),
              );
          }
          ($.addScaledVector(st.copy(ft[F.school]).sub(F.vel), 1.2),
            st.subVectors(Qt[F.school], F.pos));
          const me = st.length();
          ($.addScaledVector(st, 0.25 + Math.max(0, me - 2.5) * 0.3),
            $.add(
              Z.set(
                Math.sin(dt * 1.3 + F.phase),
                Math.sin(dt * 0.9 + F.phase * 2) * 0.3,
                Math.cos(dt * 1.1 + F.phase),
              ).multiplyScalar(0.35),
            ));
        } else
          (st
            .copy(F.home)
            .add(
              Z.set(
                Math.sin(dt * 0.23 + F.phase) * 2.2,
                Math.sin(dt * 0.4 + F.phase) * 0.4,
                Math.cos(dt * 0.19 + F.phase * 1.7) * 2.2,
              ),
            )
            .sub(F.pos),
            $.copy(st).multiplyScalar(0.6).sub(F.vel));
        (F.vel.addScaledVector($, B), tt.sample(F.pos.x, F.pos.y, F.pos.z, it));
        const ct = F.vel.length(),
          It = F.school >= 0 ? 0.9 + (F.phase % 1) * 0.5 : 0.6,
          Jt = F.school >= 0 ? 0.35 : 0.05;
        (ct > It
          ? F.vel.multiplyScalar(It / ct)
          : ct < Jt && ct > 1e-4 && F.vel.multiplyScalar(Jt / ct),
          F.pos
            .addScaledVector(F.vel, B)
            .addScaledVector(Z.set(it[0], it[1], it[2]), B * 0.6),
          (F.pos.y = Math.min(F.pos.y, J - 0.6)),
          (d[St] = Math.min(F.vel.length() / It, 1)),
          lt.copy(F.vel).normalize(),
          lt.lengthSq() < 0.5 && lt.set(1, 0, 0),
          W.setFromUnitVectors(pt, lt),
          (F.q ??= W.clone()),
          F.q.slerp(W, Math.min(1, B * 6)),
          W.copy(F.q),
          de.setFromAxisAngle(
            lt,
            Math.max(-0.5, Math.min(0.5, $.x * lt.z - $.z * lt.x)) * 0.15,
          ),
          W.premultiply(de),
          H.compose(F.pos, W, Z.setScalar(F.size * 1.6)),
          R.setMatrixAt(St, H));
      }),
      (R.instanceMatrix.needsUpdate = !0),
      (p.needsUpdate = !0));
  }
  for (let B = 0; B < 400; B++)
    he(1 / 30, {
      sample: (tt, it, ft, zt) => {
        zt[0] = zt[1] = zt[2] = 0;
      },
    });
  return { mesh: R, update: he };
}
const ps = new hn(),
  yo = new Ls(),
  we = [
    new C(1, 0, 0),
    new C(-1, 0, 0),
    new C(0, 1, 0),
    new C(0, -1, 0),
    new C(0, 0, 1),
    new C(0, 0, -1),
  ],
  xo = we.map(() => new jn()),
  fs = new C(),
  ra = new Es(),
  la = new Dn();
let gs;
class Mo extends pa {
  static get type() {
    return "GodraysNode";
  }
  constructor(t, e, a) {
    (super("vec4"),
      (this.depthNode = t),
      (this.raymarchSteps = I(Ks(60))),
      (this.density = I(P(0.7))),
      (this.maxDensity = I(P(0.5))),
      (this.distanceAttenuation = I(P(2))),
      (this.resolutionScale = 0.5),
      (this.updateBeforeType = cn.FRAME),
      (this._cameraMatrixWorld = I(e.matrixWorld)),
      (this._cameraProjectionMatrixInverse = I(e.projectionMatrixInverse)),
      (this._premultipliedLightCameraMatrix = I(new Es())),
      (this._cameraPosition = I(new C())),
      (this._cameraNear = Pe("near", "float", e)),
      (this._cameraFar = Pe("far", "float", e)),
      (this._shadowCameraNear = Pe("near", "float", a.shadow.camera)),
      (this._shadowCameraFar = Pe("far", "float", a.shadow.camera)),
      (this._fNormals = Zs(we.map(() => new C()))),
      (this._fConstants = Zs(we.map(() => 0))),
      (this._light = a),
      (this._camera = e),
      (this._godraysRenderTarget = new In(1, 1, { depthBuffer: !1 })),
      (this._godraysRenderTarget.texture.name = "Godrays"),
      (this._material = new un()),
      (this._material.name = "Godrays"),
      (this._textureNode = dn(this, this._godraysRenderTarget.texture)));
  }
  getTextureNode() {
    return this._textureNode;
  }
  setSize(t, e) {
    ((t = Math.round(this.resolutionScale * t)),
      (e = Math.round(this.resolutionScale * e)),
      this._godraysRenderTarget.setSize(t, e));
  }
  updateBefore(t) {
    const { renderer: e } = t;
    gs = Xs.resetRendererState(e, gs);
    const a = e.getDrawingBufferSize(yo);
    (this.setSize(a.width, a.height),
      (ps.material = this._material),
      (ps.name = "Godrays"),
      this._updateLightParams(),
      this._cameraPosition.value.setFromMatrixPosition(
        this._camera.matrixWorld,
      ),
      e.setClearColor(16777215, 1),
      e.setRenderTarget(this._godraysRenderTarget),
      ps.render(e),
      Xs.restoreRendererState(e, gs));
  }
  _updateLightParams() {
    const t = this._light,
      e = t.shadow.camera;
    if (
      (this._premultipliedLightCameraMatrix.value.multiplyMatrices(
        e.projectionMatrix,
        e.matrixWorldInverse,
      ),
      t.isPointLight)
    )
      for (let a = 0; a < we.length; a++) {
        const l = we[a],
          o = xo[a];
        (fs.copy(t.position),
          fs.addScaledVector(l, e.far),
          o.setFromNormalAndCoplanarPoint(l, fs),
          this._fNormals.array[a].copy(o.normal),
          (this._fConstants.array[a] = o.constant));
      }
    else if (t.isDirectionalLight) {
      (ra.multiplyMatrices(e.projectionMatrix, e.matrixWorldInverse),
        la.setFromProjectionMatrix(ra));
      for (let a = 0; a < 6; a++) {
        const l = la.planes[a];
        (this._fNormals.array[a].copy(l.normal).multiplyScalar(-1),
          (this._fConstants.array[a] = l.constant * -1));
      }
    }
  }
  setup(t) {
    const e = ue(),
      a = mn(this._light),
      l = (r) =>
        vn(this.depthNode.sample(r).r, this._cameraNear, this._cameraFar),
      o = (r, c, d) => Qs(r, c).add(d),
      i = (r, c, d, p) => {
        const u = Qs(d, c);
        return o(r, d, p).div(u).negate();
      },
      n = (r) => {
        const c = Cn(this._light).mul(r),
          d = c.xyz.div(c.w);
        return V(d.x, d.y.oneMinus(), d.z);
      },
      h = (r) => {
        if (this._light.isPointLight) {
          const c = r.sub(a).toConst(),
            d = c.abs().toConst(),
            p = d.x.max(d.y).max(d.z).negate(),
            u = An(p, this._shadowCameraNear, this._shadowCameraFar),
            f = zn(this._light.shadow.map.depthTexture, c).compare(u).r;
          return Tt(f.oneMinus().add(0.005), p.negate());
        } else if (this._light.isDirectionalLight) {
          const c = n(r).toConst(),
            d = c.x
              .greaterThanEqual(0)
              .and(c.x.lessThanEqual(1))
              .and(c.y.greaterThanEqual(0))
              .and(c.y.lessThanEqual(1))
              .and(c.z.greaterThanEqual(0))
              .and(c.z.lessThanEqual(1)),
            p = Tt(1, 0);
          return (
            Mt(d.equal(!0), () => {
              const u = Vs(this._light.shadow.map.depthTexture, c.xy).compare(
                  c.z,
                ).r,
                f = Sn(c.z, this._shadowCameraNear, this._shadowCameraFar);
              p.assign(Tt(u.oneMinus(), f.negate()));
            }),
            p
          );
        } else throw new Error("THREE.GodraysNode: Unsupported light type.");
      },
      m = nt(() => {
        const r = Et(0, 0, 0, 1).toVar(),
          c = pn(!1),
          d = l(e).toConst(),
          p = fn(e, d, this._cameraProjectionMatrixInverse).toConst(),
          u = this._cameraMatrixWorld.mul(p),
          f = P(-1e4).toVar();
        qt(6, ({ i: b }) => {
          f.assign(
            $s(
              f,
              o(
                this._cameraPosition,
                this._fNormals.element(b),
                this._fConstants.element(b),
              ),
            ),
          );
        });
        const y = this._cameraPosition.toVar();
        return (
          Mt(f.lessThan(0), () => {
            qt(6, ({ i: b }) => {
              Mt(
                o(
                  u,
                  this._fNormals.element(b),
                  this._fConstants.element(b),
                ).greaterThan(0),
                () => {
                  const M = u.sub(this._cameraPosition).toConst(),
                    v = i(
                      this._cameraPosition,
                      M,
                      this._fNormals.element(b),
                      this._fConstants.element(b),
                    );
                  u.assign(this._cameraPosition.add(v.mul(M)));
                },
              );
            });
          }).Else(() => {
            const b = u.sub(this._cameraPosition).toConst(),
              M = P(1e4).toVar();
            (qt(6, ({ i: v }) => {
              const x = i(
                this._cameraPosition,
                b,
                this._fNormals.element(v),
                this._fConstants.element(v),
              );
              Mt(x.lessThan(M).and(x.greaterThan(0)), () => {
                M.assign(x);
              });
            }),
              Mt(M.equal(1e4), () => {
                c.assign(!0);
              }).Else(() => {
                y.assign(this._cameraPosition.add(M.add(0.001).mul(b)));
                const v = P(-1e4).toVar();
                (qt(6, ({ i: x }) => {
                  v.assign(
                    $s(
                      v,
                      o(
                        u,
                        this._fNormals.element(x),
                        this._fConstants.element(x),
                      ),
                    ),
                  );
                }),
                  Mt(v.greaterThanEqual(0), () => {
                    const x = P(1e4).toVar();
                    (qt(6, ({ i: g }) => {
                      Mt(
                        o(
                          u,
                          this._fNormals.element(g),
                          this._fConstants.element(g),
                        ).greaterThan(0),
                        () => {
                          const w = i(
                            y,
                            b,
                            this._fNormals.element(g),
                            this._fConstants.element(g),
                          );
                          Mt(w.lessThan(x).and(w.greaterThan(0)), () => {
                            x.assign(w);
                          });
                        },
                      );
                    }),
                      Mt(x.lessThan(u.distance(y)), () => {
                        u.assign(y.add(x.mul(b)));
                      }));
                  }));
              }));
          }),
          Mt(c.equal(!1), () => {
            const b = P(0).toVar(),
              M = fa(ga).toConst(),
              v = gn(
                wn(this.raymarchSteps, yn(this.raymarchSteps.div(8).add(2), M)),
              ).toConst(),
              x = Ks(v).toConst();
            (qt(x, ({ i: g }) => {
              const w = K(y, u, P(g).div(v)).toConst(),
                z = h(w),
                S = z.x.oneMinus().toConst();
              b.addAssign(
                S.mul(xn(y, u).mul(this.density.div(100))).mul(
                  Ot(
                    z.y.div(this._shadowCameraFar).oneMinus(),
                    this.distanceAttenuation,
                  ),
                ),
              );
            }),
              b.divAssign(v),
              r.assign(
                Et(V(Mn(ht(b.negate()).oneMinus(), 0, this.maxDensity)), d),
              ));
          }),
          r
        );
      });
    return (
      (this._material.contextNode = bn(t.getSharedContext())),
      (this._material.fragmentNode = m()),
      (this._material.needsUpdate = !0),
      this._textureNode
    );
  }
  dispose() {
    (super.dispose(),
      this._godraysRenderTarget.dispose(),
      this._material.dispose());
  }
}
const bo = (s, t, e) => new Mo(s, t, e),
  vo = nt(([s, t = {}]) => {
    s = wa(s);
    const e = kt(t.center) || Tt(0.5, 0.5),
      a = kt(t.weight) || P(0.9),
      l = kt(t.decay) || P(0.95),
      o = kt(t.count) || Wt(32),
      i = kt(t.exposure) || P(5),
      n = t.premultipliedAlpha || !1,
      h = (y) => {
        const b = s.sample(y);
        return n ? _n(b) : b;
      },
      m = Tt(s.uvNode || ue()),
      r = h(m).toConst(),
      c = Et().toVar(),
      d = e.sub(m).div(o).toConst(),
      p = P(a).toVar(),
      u = fa(ga);
    (m.addAssign(d.mul(u)),
      qt({ start: Wt(0), end: Wt(o), type: "int", condition: "<" }, () => {
        m.addAssign(d);
        const y = h(m);
        (c.addAssign(y.mul(p)), p.mulAssign(l));
      }),
      c.divAssign(o),
      c.mulAssign(i));
    const f = K(c, r.mul(2), 0.5);
    return n ? kn(f) : f;
  });
class Ao extends pa {
  static get type() {
    return "ChromaticAberrationNode";
  }
  constructor(t, e, a, l) {
    (super("vec4"),
      (this.textureNode = t),
      (this.strengthNode = e),
      (this.centerNode = a),
      (this.scaleNode = l));
  }
  setup() {
    const t = this.textureNode,
      e = t.uvNode || ue(),
      a = nt(([i, n, h, m]) => {
        const r = i.sub(h),
          c = r.length(),
          d = P(1).add(m.mul(0.02).mul(n)),
          p = P(1),
          u = P(1).sub(m.mul(0.02).mul(n)),
          f = n.mul(c),
          y = h.add(r.mul(d)),
          b = h.add(r.mul(p)),
          M = h.add(r.mul(u)),
          v = r.mul(f).mul(P(0.01)),
          x = r.mul(f).mul(P(0)),
          g = r.mul(f).mul(P(-0.01)),
          w = y.add(v),
          z = b.add(x),
          S = M.add(g),
          N = t.sample(w).r,
          L = t.sample(z).g,
          q = t.sample(S).b,
          G = t.sample(i).a;
        return Et(N, L, q, G);
      });
    return nt(() => a(e, this.strengthNode, this.centerNode, this.scaleNode))();
  }
}
const zo = (s, t = 1, e = null, a = 1.1) => new Ao(wa(s), kt(t), kt(e), kt(a)),
  ye = 1.333;
function So() {
  const s = new C(-0.16, 0.82, -0.55).normalize(),
    t = {
      sun: I(s),
      sunAir: I(Co(s)),
      sigma: I(new C(0.11, 0.068, 0.066)),
      sigmaLight: I(new C(0.05, 0.043, 0.042)),
      scatter: I(new C(0.0024, 0.0125, 0.0175)),
      scatterSun: I(new C(7e-4, 0.0024, 0.003)),
      sunColor: I(new C(1, 0.93, 0.8).multiplyScalar(13)),
      ambient: I(new C(0.3, 0.72, 1).multiplyScalar(0.95)),
      clock: I(0),
      sky: I(2),
    },
    e = P(J),
    a = (l) => e.sub(l.y).max(0);
  return (
    (t.depthAt = a),
    (t.sunAt = nt(([l]) =>
      t.sunColor.mul(ht(t.sigmaLight.mul(a(l).div(t.sun.y)).negate())),
    )),
    (t.ambientAt = nt(([l, o]) => {
      const i = o.y.mul(0.5).add(0.5).clamp();
      return t.ambient
        .mul(
          ht(
            t.sigmaLight
              .mul(1.15 * 1)
              .mul(a(l))
              .negate(),
          ),
        )
        .mul(i.mul(i.sqrt()).mul(0.88).add(0.12));
    })),
    (t.phase = (l, o) => {
      const i = P(1 + o * o).sub(l.mul(2 * o));
      return P((1 - o * o) / (4 * Math.PI)).div(i.mul(i.sqrt()));
    }),
    (t.inscatter = nt(([l, o, i]) => {
      const n = t.sigmaLight.mul(1.15),
        h = t.sigma.sub(n.mul(o.y)),
        m = (f) => K(V(-1), V(1), Nn(V(0), f)).mul(f.abs().max(1e-4)),
        r = m(h),
        c = t.ambient.mul(ht(n.mul(a(l)).negate())),
        d = t.scatter
          .mul(c)
          .mul(P(1).sub(ht(r.mul(i).negate())))
          .div(r),
        p = m(t.sigma.sub(t.sigmaLight.mul(o.dot(t.sun).max(0).mul(0.5)))),
        u = t.scatterSun
          .mul(t.sunAt(l))
          .mul(t.phase(o.dot(t.sun), 0.78))
          .mul(P(1).sub(ht(p.mul(i.min(60)).negate())))
          .div(p)
          .mul(0.35);
      return d.add(u);
    })),
    (t.applyWater = nt(([l, o]) => {
      const i = o.sub(wt),
        n = i.length();
      return l
        .mul(ht(t.sigma.mul(n).negate()))
        .add(t.inscatter(wt, i.div(n.max(1e-4)), n));
    })),
    (t.background = nt(([l]) => {
      const o = wt,
        i = e.sub(o.y).max(0).div(l.y.max(1e-4)),
        n = bt(l.y.greaterThan(0.001), i, P(400)),
        h = t.inscatter(o, l, n),
        m = o.xz.add(l.xz.mul(i)),
        r = t.clock,
        c = Tt(
          gt(V(m.mul(0.35), r.mul(0.3)))
            .mul(0.16)
            .add(gt(V(m.mul(1.7).add(5), r.mul(0.7))).mul(0.07)),
          gt(V(m.mul(0.35).add(9), r.mul(0.3)))
            .mul(0.16)
            .add(gt(V(m.mul(1.7).add(13), r.mul(0.7))).mul(0.07)),
        ),
        d = V(c.x.negate(), 1, c.y.negate()).normalize(),
        p = l.dot(d).max(0),
        u = P(ye * ye).mul(P(1).sub(p.mul(p))),
        f = u.lessThan(1),
        y = P(1).sub(u.min(1)).sqrt(),
        b = l
          .mul(ye)
          .add(d.mul(y.sub(p.mul(ye))))
          .normalize(),
        M = b.dot(t.sunAir).max(0),
        v = K(V(0.36, 0.6, 1), V(0.82, 0.9, 1), Ot(P(1).sub(b.y.max(0)), 3))
          .mul(t.sky)
          .add(
            t.sunColor
              .mul(
                rt(0.9995, 0.9998, M)
                  .mul(60)
                  .add(Ot(M, 400).mul(4))
                  .add(Ot(M, 24).mul(0.25)),
              )
              .div(10),
          )
          .add(
            t.sunColor
              .mul(V(1, 0.85, 0.6))
              .mul(Ot(M, 8).mul(0.1).add(Ot(M, 48).mul(0.25))),
          ),
        x = P(0.02).add(Ot(P(1).sub(y), 5).mul(0.98)),
        g = t.inscatter(o, V(l.x, l.y.negate(), l.z), P(400)).mul(0.9),
        z = bt(f, v.mul(P(1).sub(x)).add(g.mul(x)), g)
          .mul(ht(t.sigma.mul(i).negate()))
          .add(h);
      return bt(l.y.greaterThan(0.001), z, h);
    })),
    (t.fogNode = nt(() => Et(t.applyWater(Js.rgb, X), Js.a))()),
    t
  );
}
function Co(s) {
  const t = Math.hypot(s.x, s.z),
    e = Math.min(1, t * ye);
  return new C((s.x / t) * e, Math.sqrt(1 - e * e), (s.z / t) * e);
}
const Pt = new URLSearchParams(location.search),
  Lt = Pt.has("thumb");
document.body.classList.toggle("capture", Lt);
const Rt = await Tn({ shadows: !0 }),
  yt = Rt.domElement;
yt.id = "view";
yt.tabIndex = 0;
yt.setAttribute(
  "aria-label",
  "A giant kelp forest seen from the reef, looking up at the sun. Click to send a surge.",
);
const At = new Gn(),
  E = {
    clock: I(0),
    surge: I(0),
    swell: I(0.55),
    period: I(9),
    eddies: I(1),
    flutter: I(1),
    caustics: I(1),
    glow: I(2.2),
    green: I(0.55),
  },
  Y = So();
Y.clock = E.clock;
E.sun = Y.sun;
const Ht = new Qe(
  new Bn(300, 64, 32),
  new ya({ side: qn, fog: !1, depthWrite: !1 }),
);
Ht.material.colorNode = Y.background(X.sub(wt).normalize());
Ht.onBeforeRender = (s, t, e) => {
  (Ht.position.copy(e.position), Ht.updateMatrixWorld());
};
Ht.frustumCulled = !1;
Ht.renderOrder = -2;
At.add(Ht);
const Gs = nt(([s, t]) => {
    const e = P(J).sub(t).max(0),
      a = s.add(Tt(E.sun.x, E.sun.z).div(E.sun.y).mul(e)),
      l = E.clock.mul(0.45),
      o = ta(V(a.mul(0.85), l)),
      i = ta(V(a.mul(1.25).add(7.1), l.mul(1.3))),
      n = e.sub(9).abs().mul(0.012).add(0.16),
      h = rt(n, 0, o.y.sub(o.x)),
      m = rt(n, 0, i.y.sub(i.x)),
      r = h.mul(m).mul(5).add(h.add(m).mul(0.6)).add(0.25);
    return K(P(1), r, E.caustics).max(0);
  }),
  es = new $e({ side: Je, roughness: 0.3 }),
  ss = Vt("aKelp", "vec4"),
  Ga = Vt("aST", "vec2"),
  Ba = ss.x,
  qa = ss.y,
  _t = qa.max(0),
  Oa = qa.lessThan(-0.1),
  Ze = Ga.x,
  Ua = Ga.y,
  ko = co(),
  ot = new ho();
ot.setStream(at.x, at.z);
const ce = new mo(vs),
  Bs = new fo(Be, ce),
  _o = Vs(ce.texture),
  No = Vs(Bs.texture),
  Ie = ss.w,
  ia = Vt("aAttach", "vec3"),
  To = (s, t, e) =>
    s
      .mul(e.cos())
      .add(t.cross(s).mul(e.sin()))
      .add(t.mul(t.dot(s)).mul(e.cos().oneMinus())),
  Fo = ss.z,
  De = nt(([s]) => xa(_o, Ma(Wt(s).clamp(0, O - 1), Wt(Fo.add(0.5))))),
  Po = nt(() => {
    const s = Ut,
      t = E.clock,
      e = Ba.clamp().mul(O - 1),
      a = e.floor().min(O - 2),
      l = e.sub(a),
      o = l.mul(l),
      i = o.mul(l),
      n = De(a.sub(1)),
      h = De(a),
      m = De(a.add(1)),
      r = De(a.add(2)),
      c = n
        .mul(o.mul(2).sub(l).sub(i))
        .add(h.mul(o.mul(-5).add(i.mul(3)).add(2)))
        .add(m.mul(l.add(o.mul(4)).sub(i.mul(3))))
        .add(r.mul(i.sub(o)))
        .mul(0.5),
      d = c.w.max(0).min(0.6),
      p = Wt(Ie.add(0.5)).max(0),
      u = xa(No, Ma(p.mod(2048), p.div(2048))),
      f = u.xyz.length(),
      y = u.xyz.div(f.max(1e-5)),
      b = f
        .mul(P(1).sub(P(1).sub(_t).pow(2)).mul(0.6).add(0.4))
        .mul(bt(Ie.greaterThan(-0.5), 1, 0)),
      M = bt(f.greaterThan(1e-4), ia.add(To(s.sub(ia), y, b)), s),
      v = Kt(
        t
          .mul(K(2.2, 3.4, Ze))
          .sub(_t.mul(6))
          .add(Ze.mul(70))
          .add(s.y.mul(2)),
      )
        .mul(_t.pow(1.5))
        .mul(d.mul(0.35).add(0.05))
        .mul(E.flutter),
      x = V(at.x, 0.1, at.z).mul(_t.mul(_t).mul(d).mul(0.6)),
      g = bt(Ie.greaterThan(-0.5), u.w.min(0.6), d);
    return M.add(c.xyz)
      .add(V(v.mul(0.5), v, v.mul(0.4)).mul(g.mul(1.5).add(0.4)))
      .add(x.mul(bt(Ie.greaterThan(-0.5), 0.3, 1)));
  });
es.positionNode = Po();
const qs = _t
    .mul(0.45)
    .add(P(1).sub(Ba).mul(0.5))
    .add(Ze.sub(0.5).mul(0.3))
    .clamp(),
  Os = rt(-0.12, -0.2, Ua),
  Vo = K(V(0.12, 0.1, 0.03), V(0.08, 0.05, 0.018), Os),
  Eo = K(V(0.07, 0.048, 0.015), V(0.045, 0.028, 0.01), Os),
  Wa = K(Vo, Eo, rt(0.05, 0.95, qs)).mul(Ua.mul(0.6).add(1)),
  Us = wt.sub(X).normalize(),
  as = bt(Me.dot(Us).lessThan(0), Me.negate(), Me),
  Ha = as.dot(Us),
  Lo = Ha.max(0.2),
  Ro = K(
    V(1.2, 1.75, 7),
    V(1.75, 1.45, 5.6),
    rt(0.55, 1, Ze)
      .mul(E.green)
      .add(P(1).sub(qs).mul(E.green).mul(0.35))
      .clamp(),
  ),
  Io = P(0.5)
    .add(P(1).sub(_t.mul(0.6)).mul(0.55))
    .mul(K(0.85, 1.25, qs))
    .mul(P(1).add(Os)),
  Do = ht(
    Ro.mul(Io)
      .mul(P(0.5).add(P(0.5).div(Lo)))
      .negate(),
  ),
  jo = bt(
    Oa,
    ht(
      V(1.2, 1.7, 7)
        .mul(0.5)
        .mul(P(1).add(P(1).div(Ha.max(0.12))))
        .negate(),
    ),
    Do,
  ),
  Go = Gs(X.xz, X.y),
  Ya = Y.sunAt(X).mul(Go),
  As = rt(1, J, X.y).mul(0.75).add(0.25).mul(_t.mul(0.45).add(0.55)),
  Bo = bt(Oa, P(1), P(0.1).sub(as.dot(Y.sun)).div(1.1).clamp()),
  qo = Us.negate().dot(Y.sun).max(0),
  Oo = jo.mul(
    Ya.mul(As)
      .mul(Bo)
      .mul(Y.phase(qo, 0.55).add(0.5 / Math.PI))
      .add(Y.ambientAt(X, as.negate()).mul(As)),
  );
es.colorNode = Wa.mul(Ya);
es.emissiveNode = Oo.mul(E.glow)
  .add(Wa.mul(Y.ambientAt(X, as)).mul(As))
  .min(V(20));
const ns = new Qe(ko, es);
ns.castShadow = !0;
ns.receiveShadow = !1;
ns.frustumCulled = !1;
At.add(ns);
const Uo = oo(Y, Gs, E.clock, ts);
At.add(Uo);
At.fogNode = Y.fogNode;
const ut = new On("#ffffff", 1);
ut.position.copy(E.sun.value).multiplyScalar(40);
ut.target.position.set(0, 0, -8);
ut.castShadow = !0;
ut.shadow.mapSize.set(2048, 2048);
Object.assign(ut.shadow.camera, {
  left: -34,
  right: 34,
  top: 34,
  bottom: -34,
  near: 1,
  far: 90,
});
ut.shadow.bias = -4e-4;
ut.shadow.normalBias = 0.02;
ut.shadow.radius = 6;
const Wo = Xn(ut, {
  renderer: Rt,
  lightSize: 0.045,
  blockerTaps: 12,
  filterTaps: 24,
  noise: !1,
});
At.add(ut, ut.target);
const Ho = I(new _a("#ffd98f")),
  Ne = new va(),
  os = new ya({
    transparent: !0,
    depthWrite: !1,
    blending: Rs,
    side: Je,
    fog: !1,
  }),
  Yo = Vt("aShaft", "float"),
  Xe = ue(),
  Ko = gt(V(Xe.x.mul(3).add(Yo.mul(20)), Xe.y.mul(0.6), E.clock.mul(0.25)))
    .mul(0.5)
    .add(0.5),
  Zo = Xe.y.pow(1.6);
os.colorNode = Y.sunAt(X).mul(Ho).mul(0.05);
os.opacityNode = Kt(Xe.x.mul(Math.PI)).pow(2).mul(Zo).mul(Ko.pow(2)).mul(0.17);
for (let s = 0; s < 26; s++) {
  const t = new Un(1, 1);
  (t.translate(0, -0.5, 0),
    t.setAttribute("aShaft", new vt(new Array(4).fill(D()), 1)));
  const e = new Qe(t, os);
  (e.scale.set(0.6 + D() * 3.2, 26, 1),
    e.position.set(-24 + D() * 48, J + 0.2, -40 + D() * 46),
    (e.userData.tilt = new ze().setFromUnitVectors(
      new C(0, 1, 0),
      E.sun.value,
    )),
    Ne.add(e));
}
At.add(Ne);
const Ka = 16e3,
  zs = new Float32Array(Ka * 4);
for (let s = 0; s < zs.length; s++) zs[s] = D();
const Yt = xe(new be(zs, 4)),
  Te = new ba({ transparent: !0, depthWrite: !1, blending: Rs, fog: !1 }),
  ge = V(36, J, 30),
  Xo = E.clock.mul(0.05).mul(Yt.w.add(0.5)),
  $o = V(
    Kt(E.clock.mul(6.2832).div(E.period).add(Yt.x.mul(3)))
      .mul(E.swell)
      .mul(0.8)
      .add(E.surge.mul(1.5)),
    0,
    Kt(E.clock.mul(0.3).add(Yt.y.mul(20))).mul(0.4),
  ),
  ve = V(
    Yt.x.mul(ge.x).sub(ge.x.mul(0.5)),
    Yt.y.mul(ge.y).sub(Xo).mod(ge.y),
    Yt.z.mul(ge.z).negate().add(10),
  ).add($o);
Te.positionNode = ve;
Te.scaleNode = Yt.w.pow(2).mul(0.035).add(0.008);
const Qo = ue().sub(0.5).length(),
  Jo = ht(ve.sub(wt).length().mul(-0.06));
Te.colorNode = Y.sunAt(ve)
  .mul(Y.phase(ve.sub(wt).normalize().dot(E.sun), 0.6))
  .mul(0.09)
  .add(0.012)
  .mul(ht(Y.sigma.mul(ve.sub(wt).length()).negate()));
Te.opacityNode = rt(0.5, 0.1, Qo).mul(Jo).mul(0.6);
const rs = new Na(Te);
rs.count = Ka;
rs.frustumCulled = !1;
At.add(rs);
Pt.has("nosnow") && (rs.visible = !1);
const Za = 2600,
  Ss = new Float32Array(Za * 4);
for (let s = 0; s < Ss.length; s++) Ss[s] = D();
const ae = xe(new be(Ss, 4)),
  Fe = new ba({ transparent: !0, depthWrite: !1, blending: Rs, fog: !1 }),
  Ae = 7,
  re = V(ae.x, ae.y, ae.z)
    .mul(Ae)
    .add(
      V(
        Kt(E.clock.mul(0.62).add(ae.w.mul(30)))
          .mul(0.6)
          .add(E.surge.mul(E.clock.mul(0).add(1.2))),
        E.clock.mul(-0.05),
        Kt(E.clock.mul(0.4).add(ae.x.mul(20))).mul(0.5),
      ),
    )
    .sub(wt)
    .mod(Ae)
    .sub(Ae / 2),
  Cs = wt.add(re);
Fe.positionNode = Cs;
const Xa = re.length();
Fe.scaleNode = Xa.sub(1.2)
  .abs()
  .mul(0.018)
  .add(0.006)
  .mul(ae.w.mul(0.8).add(0.4));
const tr = rt(Ae / 2, Ae / 2 - 1, re.abs().x.max(re.abs().y).max(re.abs().z));
Fe.colorNode = Y.sunAt(Cs)
  .mul(Y.phase(re.normalize().dot(E.sun), 0.6))
  .mul(0.05)
  .add(Y.ambientAt(Cs, V(0, 1, 0)).mul(0.04));
Fe.opacityNode = rt(0.5, 0, ue().sub(0.5).length())
  .mul(tr)
  .mul(P(0.35).div(Xa.sub(1.2).abs().mul(2).add(1)));
const Ws = new Na(Fe);
Ws.count = Za;
Ws.frustumCulled = !1;
At.add(Ws);
Pt.has("noshafts") && (Ne.visible = !1);
const et = new Wn(50, 1, 0.05, 400),
  Q = {
    speed: Lt ? 0 : 0.32,
    u: Lt ? 0.09 : 0,
    look: { yaw: 0, pitch: 0 },
    drag: null,
  },
  ca = He.getLength(),
  Gt = new C(),
  ws = new C(),
  Nt = new C(),
  ua = new C();
let je = null;
const Bt = new C(),
  da = new C();
function er(s, t) {
  ((Q.u = (Q.u + (s * Q.speed) / ca) % 1),
    He.getPointAt(Q.u, Gt),
    He.getPointAt((Q.u + 4 / ca) % 1, ws),
    ua.set(
      Math.sin(t * 0.63) * 0.12 +
        ot.swell[0].hy[3] * Math.sin(t * 0.628) * 0.25,
      Math.sin(t * 0.21) * 0.25 + Math.sin(t * 0.628 + 1) * 0.08,
      Math.cos(t * 0.5) * 0.1,
    ),
    Bt.set(0, 0, 0));
  const e = ce.pos,
    a = 2.4;
  for (let h = 0; h < e.length; h += 3) {
    const m = Gt.x - e[h],
      r = Gt.y - e[h + 1],
      c = Gt.z - e[h + 2];
    if (m > a || m < -a || c > a || c < -a || r > a || r < -a) continue;
    const d = Math.hypot(m, r * 0.6, c);
    d < a &&
      d > 0.001 &&
      ((Bt.x += (m / d) * (a - d)),
      (Bt.z += (c / d) * (a - d)),
      (Bt.y += (r / d) * (a - d) * 0.3));
  }
  (Bt.length() > 2.5 && Bt.setLength(2.5),
    da.lerp(Bt, 1 - Math.exp(-s * 0.8)),
    et.position.copy(Gt).add(ua).add(da),
    Nt.subVectors(ws, Gt).normalize());
  let l = Math.atan2(Nt.x, Nt.z),
    o = 0.32 + 0.24 * Math.sin(t * 0.045) + 0.05 * Math.sin(t * 0.23);
  (Q.drag ||
    ((Q.look.yaw *= Math.exp(-s * 0.35)),
    (Q.look.pitch *= Math.exp(-s * 0.35))),
    (l += Q.look.yaw + Math.sin(t * 0.11) * 0.25),
    (o = Math.max(-0.6, Math.min(1.25, o + Q.look.pitch))));
  const i = new C(
      Math.sin(l) * Math.cos(o),
      Math.sin(o),
      Math.cos(l) * Math.cos(o),
    ),
    n = Math.pow(0.5 + 0.5 * Math.sin(t * 0.09 - 1.2), 2) * 0.75;
  (i.lerp(ws.copy(E.sun.value).setY(E.sun.value.y * 0.85), n).normalize(),
    (je = je ? je.lerp(i, 1 - Math.exp(-s * 1.5)).normalize() : i),
    et.lookAt(Gt.copy(et.position).add(je)));
}
yt.addEventListener("pointerdown", (s) => {
  ((Q.drag = [s.clientX, s.clientY]), yt.setPointerCapture(s.pointerId));
});
yt.addEventListener("pointermove", (s) => {
  Q.drag &&
    ((Q.look.yaw -= (s.clientX - Q.drag[0]) * 0.004),
    (Q.look.pitch += (s.clientY - Q.drag[1]) * 0.004),
    (Q.drag = [s.clientX, s.clientY]));
});
addEventListener("pointerup", () => {
  Q.drag = null;
});
function $a() {
  ((et.aspect = innerWidth / innerHeight),
    (et.fov = le.radToDeg(
      2 * Math.atan(Math.tan(le.degToRad(27)) / Math.min(1, et.aspect)),
    )),
    et.updateProjectionMatrix(),
    Rt.setSize(innerWidth, innerHeight));
}
$a();
addEventListener("resize", $a);
const Hs = Fn(At, et),
  Qa = Hs.getTextureNode("output"),
  $t = bo(Hs.getTextureNode("depth"), et, ut);
$t.raymarchSteps.value = Lt ? 90 : 60;
$t.density.value = 0.8;
$t.maxDensity.value = 0.7;
$t.distanceAttenuation.value = 0.6;
const Ys = I(new _a("#ffcf7a")),
  ks = I(Pt.has("norays") ? 0 : 2.2),
  sr = I(0.22),
  ar = rt(sr, 1, $t.getTextureNode().r).pow(1.6),
  nr = Qa.add(Et(ar.mul(ks).mul(Ys), 0)),
  Ja = I(new Ls(0.5, 0.9)),
  tn = I(1),
  _s = I(Pt.has("norays") ? 0 : 1.1),
  or = I(0.45),
  rr = Qa.rgb
    .sub(or)
    .max(0)
    .mul(V(1, 0.93, 0.75)),
  lr = vo(Et(rr, 1), {
    center: Ja,
    weight: P(0.85),
    decay: P(0.965),
    count: Wt(56),
    exposure: P(1),
  }),
  en = nr.add(Et(lr.rgb.mul(_s).mul(tn).mul(Ys), 0)),
  sn = Pn(en, 0.35, 0.55, 0.72),
  Ns = I(7),
  Ts = I(14),
  Fs = I(0.45),
  Ps = I(0.07),
  ir = $n(en.add(sn), Hs.getViewZNode(), Ns, Ts, Fs),
  xt = new Vn(Rt, zo(ir, Ps, new Ls(0.5, 0.5), 1.004));
En(Rt, xt);
xt.bloom = sn;
xt.look.vignette.value = 0.72;
xt.look.grain.value = 0.009;
xt.look.tint.value = 0.08;
xt.look.exposure.value = 1.5;
xt.look.contrast.value = 1.14;
xt.look.saturation.value = 1.15;
let ha = 5;
const mt = { speed: 1, auto: !0, strength: 0.55 },
  ls = () => ot.surge(mt.strength, (Math.random() - 0.5) * 0.6);
yt.addEventListener("pointerdown", (s) => {
  yt._down = [s.clientX, s.clientY];
});
yt.addEventListener("pointerup", (s) => {
  const t = yt._down;
  t && Math.hypot(s.clientX - t[0], s.clientY - t[1]) < 5 && ls();
});
addEventListener("keydown", (s) => {
  s.key === " " && ls();
});
const an = wo(Y, Gs, E.clock);
At.add(an.mesh);
E.clock.value = Lt ? 31 : 0;
for (let s = 0; s < (Lt ? 600 : 240); s++)
  (ot.step(1 / 30), ce.step(1 / 30, ot), Bs.step(1 / 30, ot));
const cr = new ze(),
  ma = new ze();
let ur = 0,
  ys,
  Ge = 0;
Rt.setAnimationLoop((s) => {
  const t = ys === void 0 ? 0 : Math.min((s - ys) / 1e3, 0.05);
  ys = s;
  const e = (E.clock.value += t * mt.speed);
  (mt.auto && e > ha && (ls(), (ha = e + 10 + Math.random() * 15)),
    (Ge = Math.min(Ge + t * mt.speed, 3 / 60)));
  const a = 1 / 60;
  for (; Ge >= a; ) (ot.step(a), ce.step(a, ot), Bs.step(a, ot), (Ge -= a));
  (an.update(t * mt.speed, ot),
    (E.surge.value = ot.pulseAt(ot.time) * mt.strength * 2));
  for (const n of Ne.children) {
    const h = Math.atan2(
      et.position.x - n.position.x,
      et.position.z - n.position.z,
    );
    (ma.setFromAxisAngle(new C(0, 1, 0), h),
      n.quaternion.copy(cr.copy(n.userData.tilt).multiply(ma)));
  }
  (er(t, E.clock.value), et.getWorldDirection(Nt));
  let l = 14;
  const o = ce.pos;
  for (let n = 0; n < o.length; n += 3) {
    const h = o[n] - et.position.x,
      m = o[n + 1] - et.position.y,
      r = o[n + 2] - et.position.z,
      c = Math.hypot(h, m, r);
    c > 2.5 && c < l && (h * Nt.x + m * Nt.y + r * Nt.z) / c > 0.97 && (l = c);
  }
  Ns.value += (l - Ns.value) * (1 - Math.exp(-t * 0.9));
  const i = et.position.clone().addScaledVector(E.sun.value, 100).project(et);
  (Ja.value.set(i.x * 0.5 + 0.5, i.y * 0.5 + 0.5),
    (tn.value = le.smoothstep(
      et.getWorldDirection(Nt).dot(E.sun.value),
      0.1,
      0.6,
    )),
    xt.render(),
    ++ur === 4 &&
      (document.body.classList.add("ready"),
      Lt && Pt.has("still") && Rt.setAnimationLoop(null),
      Pt.has("port") &&
        setTimeout(() => {
          (xt.render(),
            yt.toBlob(
              (n) =>
                fetch(`http://localhost:${Pt.get("port")}/`, {
                  method: "POST",
                  body: n,
                }),
              "image/jpeg",
              0.92,
            ));
        }, 1500)));
});
function dr() {
  const s = (t) => (e) => {
    t.value = e;
  };
  return (
    Kn(() => ({
      Sea: Ee({
        Swell: {
          value: 1,
          min: 0,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            ot.swellGain = t;
          },
        },
        Current: {
          value: 0.05,
          min: 0,
          max: 0.3,
          step: 0.005,
          onChange: (t) => ot.setStream(at.x, at.z, t),
        },
        Flutter: {
          value: E.flutter.value,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: s(E.flutter),
        },
        "Auto surges": {
          value: mt.auto,
          onChange: (t) => {
            mt.auto = t;
          },
        },
        "Surge strength": {
          value: mt.strength,
          min: 0,
          max: 1.5,
          step: 0.01,
          onChange: (t) => {
            mt.strength = t;
          },
        },
        "Surge now": {
          value: !1,
          onChange: (t) => {
            t && ls();
          },
        },
        "Time scale": {
          value: mt.speed,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: (t) => {
            mt.speed = t;
          },
        },
      }),
      Rays: Ee({
        Strength: {
          value: ks.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: s(ks),
        },
        Colour: { value: "#ffcf7a", onChange: (t) => Ys.value.set(t) },
        Fringe: {
          value: Ps.value,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: s(Ps),
        },
        Bokeh: { value: Fs.value, min: 0, max: 5, step: 0.01, onChange: s(Fs) },
        "Focus range": {
          value: Ts.value,
          min: 0.5,
          max: 20,
          step: 0.1,
          onChange: s(Ts),
        },
        Streaks: {
          value: _s.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: s(_s),
        },
        Density: {
          value: $t.density.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: s($t.density),
        },
      }),
      Water: Ee({
        Clarity: {
          value: 1,
          min: 0.3,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            Y.sigma.value.set(0.11, 0.068, 0.066).divideScalar(t);
          },
        },
        "Water glow": {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            Y.scatter.value.set(0.0024, 0.0125, 0.0175).multiplyScalar(t);
          },
        },
        "Sun haze": {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            Y.scatterSun.value.set(7e-4, 0.0024, 0.003).multiplyScalar(t);
          },
        },
        Sky: {
          value: Y.sky.value,
          min: 0,
          max: 8,
          step: 0.05,
          onChange: s(Y.sky),
        },
        Caustics: {
          value: E.caustics.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: s(E.caustics),
        },
        Shafts: {
          value: 1,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (t) => {
            ((Ne.visible = t > 0), (os.opacity = t));
          },
        },
      }),
      Light: Ee({
        Sun: {
          value: 13,
          min: 0,
          max: 40,
          step: 0.1,
          onChange: (t) => {
            Y.sunColor.value.set(1, 0.93, 0.8).multiplyScalar(t);
          },
        },
        Ambient: {
          value: 0.95,
          min: 0,
          max: 5,
          step: 0.01,
          onChange: (t) => {
            Y.ambient.value.set(0.3, 0.72, 1).multiplyScalar(t);
          },
        },
        "Green in blades": {
          value: E.green.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: s(E.green),
        },
        "Through blades": {
          value: E.glow.value,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: s(E.glow),
        },
        "Drift speed": {
          value: Q.speed,
          min: 0,
          max: 1.2,
          step: 0.01,
          onChange: (t) => {
            Q.speed = t;
          },
        },
      }),
      ...Zn({ renderer: Rt, pipeline: xt, lights: [ut], pcss: [Wo] }),
    })),
    null
  );
}
Lt ||
  Hn.createRoot(document.querySelector("#controls")).render(
    Ve.createElement(
      Ve.Fragment,
      null,
      Ve.createElement(Yn, { collapsed: !0, titleBar: { title: "Controls" } }),
      Ve.createElement(dr),
    ),
  );
