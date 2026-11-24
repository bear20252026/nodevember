import "../lib/modulepreload-polyfill.js";
import {
  F as Wt,
  K as yt,
  i as at,
  L as Nt,
  D as Lt,
  M as st,
  b as N,
  m as q,
  az as x,
  s as F,
  g as K,
  O as zt,
  ae as Ot,
  a2 as jt,
  u as C,
  aJ as vt,
  H as $t,
  A as $,
  as as Ht,
  Y as Ut,
  at as Kt,
  aj as Jt,
  x as xt,
  p as Yt,
  k as Zt,
  R as _t,
  l as Qt,
} from "../lib/stage.js";
import { d as Xt } from "../lib/DepthOfFieldNode.js";
import { O as te } from "../lib/OrbitControls.js";
import {
  a3 as ee,
  d as nt,
  M as oe,
  B as At,
  F as J,
  V as Q,
  q as St,
  ap as ae,
  b2 as se,
  e as Y,
  S as ne,
  H as le,
  D as Rt,
  bd as ie,
  P as re,
  c as ce,
  r as H,
  L as ue,
  u as de,
  g as L,
} from "../lib/leva.js";
import { r as me } from "../lib/rendering-panel.js";
import "../lib/three.js";
function he() {
  const e = document.querySelector("#specimen canvas"),
    a = document.querySelector("#specimen-mode"),
    t = e.getContext("2d"),
    o = e.width,
    c = o / 66;
  let l;
  const s = () => (l = (l * 48271) % 2147483647) / 2147483647;
  function n(u) {
    const r = new Path2D();
    return (
      r.moveTo(-1, 0),
      r.bezierCurveTo(-1, -0.6, -0.55, -1, 0, -1),
      r.bezierCurveTo(0.5, -1, 0.84, u ? -0.55 : -0.46, 0.93, -0.2),
      r.quadraticCurveTo(0.97, 0, 0.93, 0.2),
      r.bezierCurveTo(0.84, u ? 0.55 : 0.46, 0.5, 1, 0, 1),
      r.bezierCurveTo(-0.55, 1, -1, 0.6, -1, 0),
      r.closePath(),
      r
    );
  }
  function i(u, r, w, v, M, d, h) {
    (t.save(), t.translate(u, r), t.rotate(M), t.scale(w / 2, v / 2));
    const p = n(h),
      f = d * 3.4;
    ((t.lineJoin = "round"), (t.filter = "blur(" + (1.4 + f * 1.6) + "px)"));
    for (const [V, W] of [
      [-0.05, "rgba(170,205,255,.55)"],
      [0.05, "rgba(255,236,170,.5)"],
    ])
      (t.save(),
        t.translate(V, 0),
        (t.lineWidth = 0.32 + d * 0.3),
        (t.strokeStyle = W),
        t.stroke(p),
        t.restore());
    ((t.filter = "blur(" + (0.35 + f) + "px)"), (t.globalAlpha = 1 - d * 0.45));
    const y = t.createRadialGradient(-0.22, -0.2, 0.05, 0, 0, 1.05);
    (y.addColorStop(0, "#8a5a3f"),
      y.addColorStop(0.45, "#5f3a28"),
      y.addColorStop(0.78, "#3a2219"),
      y.addColorStop(1, "#1c120e"),
      (t.fillStyle = y),
      t.fill(p),
      (t.lineWidth = 0.11),
      (t.strokeStyle = "#140c09"),
      t.stroke(p),
      (t.fillStyle = "#2a1912"),
      t.beginPath(),
      t.ellipse(-1.02, 0.12, 0.09, 0.07, 0, 0, 2 * Math.PI),
      t.fill(),
      (t.fillStyle = "#c7aa86"),
      t.beginPath(),
      t.ellipse(0.9, 0, 0.05, h ? 0.1 : 0.15, 0, 0, 2 * Math.PI),
      t.fill(),
      (t.strokeStyle = "#24150f"),
      (t.lineWidth = 0.035),
      t.stroke());
    const I = t.createRadialGradient(-0.08 + s() * 0.16, -0.05, 0, 0, 0, 0.34);
    (I.addColorStop(0, "rgba(222,178,128,.42)"),
      I.addColorStop(1, "rgba(222,178,128,0)"),
      (t.fillStyle = I),
      t.beginPath(),
      t.arc(0, 0, 0.4, 0, 2 * Math.PI),
      t.fill(),
      (t.fillStyle = "rgba(255,244,220,.5)"),
      t.beginPath(),
      t.ellipse(-0.38, -0.5, 0.16, 0.06, -0.5, 0, 2 * Math.PI),
      t.fill(),
      t.restore());
  }
  function g() {
    (t.save(), t.scale(c, c));
    const u = t.createRadialGradient(29, 26, 2, 33, 33, 47);
    (u.addColorStop(0, "#f1ebda"),
      u.addColorStop(0.62, "#dfdbc7"),
      u.addColorStop(0.9, "#bdb9a9"),
      u.addColorStop(1, "#8f8b7f"),
      (t.fillStyle = u),
      t.fillRect(0, 0, 66, 66));
    for (let d = 0; d < 7; d++) {
      ((t.filter = "blur(" + (1 + s() * 4) + "px)"),
        (t.strokeStyle = "rgba(120,110,92," + (0.12 + s() * 0.18) + ")"),
        (t.lineWidth = 0.5 + s() * 0.9));
      const h = s() * 66,
        p = s() * 66,
        f = s() * 6.3,
        y = 8 + s() * 20;
      (t.beginPath(),
        t.moveTo(h, p),
        t.quadraticCurveTo(
          h + Math.cos(f + 0.6) * y * 0.5,
          p + Math.sin(f + 0.6) * y * 0.5,
          h + Math.cos(f) * y,
          p + Math.sin(f) * y,
        ),
        t.stroke());
    }
    for (let d = 0; d < 40; d++)
      ((t.filter = "blur(" + s() * 1.5 + "px)"),
        (t.fillStyle = "rgba(70,60,50," + (0.08 + s() * 0.3) + ")"),
        t.beginPath(),
        t.arc(s() * 66, s() * 66, 0.1 + s() * 0.35, 0, 2 * Math.PI),
        t.fill());
    const r = [];
    for (let d = 0; r.length < 24 && d < 600; d++) {
      const h = -3 + s() * 72,
        p = -3 + s() * 72;
      (h > 38 && p > 46) ||
        r.some(([f, y]) => Math.hypot(f - h, y - p) < 9) ||
        r.push([h, p]);
    }
    r.sort(() => s() - 0.5);
    for (const [d, h] of r) {
      const p = s() < 0.3,
        f = 10.2 + s() * 2.8,
        y = f * (p ? 0.6 + s() * 0.08 : 0.74 + s() * 0.1),
        I = s() < 0.25 ? 0.6 + s() * 0.4 : s() * 0.25;
      i(d, h, f, y, s() * 6.3, I, p);
    }
    ((t.filter = "none"),
      (t.globalAlpha = 1),
      (t.fillStyle = "#2f2a25"),
      t.fillRect(46, 54, 10, 0.5),
      (t.font = "2.6px sans-serif"),
      (t.textAlign = "center"),
      t.fillText("10 µm", 51, 58),
      t.restore());
    const w = t.getImageData(0, 0, o, o),
      v = w.data;
    for (let d = 0; d < v.length; d += 4) {
      const h = (s() - 0.5) * 14;
      ((v[d] += h), (v[d + 1] += h), (v[d + 2] += h * 1.1));
    }
    t.putImageData(w, 0, 0);
    const M = t.createRadialGradient(
      o / 2,
      o / 2,
      o * 0.36,
      o / 2,
      o / 2,
      o * 0.52,
    );
    (M.addColorStop(0, "rgba(0,0,0,0)"),
      M.addColorStop(1, "rgba(10,8,6,.55)"),
      (t.fillStyle = M),
      t.fillRect(0, 0, o, o));
  }
  function b() {
    ((t.fillStyle = "#e5dfce"), t.fillRect(0, 0, o, o));
    const u = 2 * Math.PI;
    for (let r = 0; r < 42e3; r++) {
      const w = Math.floor(s() * 86),
        v = Math.sqrt(s()),
        M = (s() + s() - 1) * (0.008 + 0.012 * v),
        d = (u * w) / 86 + M + 0.024 * Math.sin(v * 4 + w * 0.07),
        h =
          o *
          (0.043 + 0.365 * v) *
          (1 + 0.046 * Math.cos(d * 3) + 0.02 * Math.sin(d * 7));
      ((t.fillStyle = "rgba(48,37,32," + (0.12 + 0.34 * s()) + ")"),
        t.fillRect(
          o * 0.49 + Math.cos(d) * h,
          o * 0.49 + Math.sin(d) * h * 0.93,
          1.6,
          1.6,
        ));
    }
  }
  function S(u) {
    ((l = 1531),
      u ? b() : g(),
      e.setAttribute(
        "aria-label",
        u
          ? "Illustrated dark radial spore print on paper"
          : "Illustrated pleated inkcap spores under transmitted light with a ten micrometre scale bar",
      ),
      (a.textContent = u ? "View spores" : "View print"),
      (document.querySelector("#specimen-caption").textContent = u
        ? "Spore print · illustration"
        : "Microscope · illustration"));
  }
  let m = !1;
  ((a.onclick = () => {
    ((m = !m), S(m));
  }),
    S(!1));
}
const X = Math.PI * 2,
  It = 1.14;
function pe(e) {
  return (
    1 +
    0.032 * Math.sin(3 * e + 0.5) +
    0.021 * Math.cos(5 * e - 1) +
    0.009 * Math.sin(11 * e)
  );
}
function ft(e, a) {
  return (
    0.065 -
    0.09 * e +
    e * e * (0.049 * Math.sin(3 * a + 0.6) + 0.024 * Math.cos(7 * a))
  );
}
function gt(e, a, t) {
  const o = It * e * pe(a);
  return [o * Math.cos(a), t, 0.96 * o * Math.sin(a)];
}
function Tt(e, a, t, o = !1) {
  const c = [],
    l = [],
    s = [],
    n = o ? a : a + 1;
  for (let g = 0; g <= e; g++)
    for (let b = 0; b < n; b++) {
      const [S, m, u] = t(g / e, b / a);
      if ((c.push(...S), l.push(m, u), g === e || (!o && b === a))) continue;
      const r = g * n + b,
        w = g * n + ((b + 1) % n);
      s.push(r, r + n, w, w, r + n, w + n);
    }
  const i = new At();
  return (
    i.setAttribute("position", new J(c, 3)),
    i.setAttribute("tissue", new J(l, 2)),
    i.setIndex(s),
    i.computeVertexNormals(),
    i
  );
}
function fe() {
  return Tt(
    80,
    320,
    (e, a) => {
      const t = X * a,
        o = e <= 0.45,
        c = o ? e / 0.45 : Math.cos((((e - 0.45) / 0.55) * Math.PI) / 2),
        l = o ? 0 : Math.sin((((e - 0.45) / 0.55) * Math.PI) / 2),
        s = Math.sin(93 * t + 1.4 * Math.sin(5 * t)) * 0.004 * c ** 8,
        n = ft(c, t) + 0.32 * l + s;
      return [gt(c, t, n), o ? 0 : l, c];
    },
    !0,
  );
}
function ge() {
  const e = [],
    a = [],
    t = [];
  for (let s = 0; s < 144; s++) {
    const n = (X * s) / 144,
      i = s % 3 === 0,
      g = i
        ? 0.114 + 0.018 * Math.sin(s * 4.1)
        : (s % 3 === 1 ? 0.3 : 0.57) + 0.07 * Math.sin(s * 2.1),
      b = 0.986 + 0.008 * Math.sin(s * 3.7),
      S = e.length / 3;
    for (let m = 0; m <= 55; m++) {
      const u = m / 55,
        r = g + (b - g) * u,
        w =
          0.022 * Math.sin(5 * r + 3 * n) + 0.006 * Math.sin(14 * r + s * 0.48),
        v = n + w,
        M = Math.sin(Math.PI * u) ** 0.66,
        d = (0.014 + (0.23 + 0.035 * Math.cos(n * 3)) * M) * (i ? 1 : 0.87),
        h = 0.006 + 0.005 * r;
      for (const [p, f, y] of [
        [-1, 0, 0],
        [-0.6, 0.6, 0.16],
        [-0.35, 0.96, 0.7],
        [0, 1, 1],
        [0.35, 0.96, 0.7],
        [0.6, 0.6, 0.16],
        [1, 0, 0],
      ]) {
        const I =
            0.012 * Math.sin(s * 0.81 + r * 11) * f +
            0.003 * Math.sin(33 * r + s) * f,
          V = v + (p * h + I) / (It * r),
          W = ft(r, v) + 0.003 - f * d + y * 0.004 * Math.sin(51 * r + s * 0.6);
        (e.push(...gt(r, V, W)), a.push(f, y));
      }
      if (m !== 55)
        for (let p = 0; p < 6; p++) {
          const f = S + m * 7 + p;
          t.push(f, f + 7, f + 1, f + 1, f + 7, f + 8);
        }
    }
  }
  const l = new At();
  return (
    l.setAttribute("position", new J(e, 3)),
    l.setAttribute("tissue", new J(a, 2)),
    l.setIndex(t),
    l.computeVertexNormals(),
    l
  );
}
function be(e, a) {
  const t = new Float32Array(e * 3);
  for (let o = 0; o < e; o++) {
    const c = a() * X,
      l = 0.2 + 0.76 * Math.sqrt(a()),
      s = (l - 0.114) / 0.872,
      n =
        0.014 +
        (0.23 + 0.035 * Math.cos(3 * c)) * Math.sin(Math.PI * s) ** 0.66;
    t.set(gt(l, c, ft(l, c) - n * (0.7 + 0.3 * a())), o * 3);
  }
  return t;
}
function we() {
  return Tt(
    80,
    128,
    (e, a) => {
      const t = a * X,
        o = 0.08 * Math.exp(-((e - 0.1) ** 2) / 0.013),
        c = 0.003 * Math.sin(29 * t + 3 * e) + 0.002 * Math.sin(45 * t - 2 * e),
        l = (0.122 + o + 0.016 * e ** 8 + c) * Math.min(1, Math.sqrt(e) * 6);
      return [
        [
          0.17 * (1 - e) ** 1.7 + l * Math.cos(t),
          -1.72 + 1.81 * e,
          0.045 * Math.sin(e * 3) + l * Math.sin(t),
        ],
        e,
        0,
      ];
    },
    !0,
  );
}
const lt = Wt(([e]) => {
    const a = yt.dFdx(),
      o = yt.dFdy().cross(at),
      c = at.cross(a),
      l = a.dot(o).mul(Nt),
      s = l.sign().mul(o.mul(e.dFdx()).add(c.mul(e.dFdy())));
    return l.abs().mul(at).sub(s).normalize();
  }),
  it = (e, a, t) =>
    zt
      .mul(Nt)
      .dot(N(...e).normalize())
      .negate()
      .max(0)
      .pow(1.6)
      .mul(x(a))
      .mul(t),
  rt = [2, 2, -1];
function Me() {
  const e = new ee(),
    a = Ot,
    t = Lt("tissue", "vec2"),
    o = (d, h = a) => jt(h.mul(d)).mul(0.5).add(0.5),
    c = o(162),
    l = o(6.4),
    s = o(520),
    n = new st({ side: nt, sheen: 0.4, sheenRoughness: 0.6 }),
    i = o(N(9, 60, 9)).mul(o(N(60, 2, 60))),
    g = q(x("#7a5232"), x("#d2ad79"), l.mul(0.7).add(i.mul(0.3)));
  ((n.colorNode = q(g, x("#efd2a2"), F(0.86, 1, t.y)).mul(
    c.mul(0.22).add(0.86),
  )),
    (n.sheenColorNode = x("#f4dcb4")),
    (n.roughnessNode = K(0.62).add(c.mul(0.2)).sub(t.x.mul(0.18))),
    (n.normalNode = lt(i.mul(0.003).add(s.mul(4e-4)))),
    (n.emissiveNode = it(rt, "#d98a3e", 0.22).mul(F(0.75, 1, t.y))));
  const b = new st({ side: nt, sheen: 0.5, sheenRoughness: 0.42 }),
    S = o(N(3, 120, 3))
      .mul(0.6)
      .add(o(30).mul(0.4)),
    m = q(
      x("#1d161b"),
      x("#8e726b"),
      t.x.mul(0.55).add(l.mul(0.25)).add(S.mul(0.25)),
    );
  ((b.colorNode = q(m, x("#dcc8b8"), t.y.pow(2.4).mul(0.92))
    .mul(c.mul(0.42).add(0.78))
    .mul(s.pow(6).mul(-0.35).add(1))),
    (b.sheenColorNode = x("#8d7a72")),
    (b.roughnessNode = K(0.9).sub(t.y.mul(0.2))),
    (b.normalNode = lt(S.mul(0.0012).add(c.mul(4e-4)))),
    (b.emissiveNode = it(rt, "#b0623a", 0.16).mul(t.x.pow(3))));
  const u = new st({ side: nt, sheen: 0.8, sheenRoughness: 0.35 }),
    r = o(N(175, 4, 175)),
    w = o(N(420, 9, 420)),
    v = F(0.25, 0, t.x);
  u.colorNode = q(
    x("#a38772"),
    x("#ece0d2"),
    r.mul(0.6).add(w.mul(0.2)).add(l.mul(0.2)),
  )
    .mul(c.mul(0.14).add(0.9))
    .mul(q(N(1), N(0.66, 0.55, 0.45), v.mul(l.add(0.4))));
  const M = F(0.4, 0.62, o(240).mul(0.55).add(o(28).mul(0.45)))
    .mul(F(0.15, 0.9, t.x))
    .mul(zt.y.mul(0.5).add(0.75));
  ((u.colorNode = q(u.colorNode, x("#3b2a2c"), M.mul(0.85))),
    (u.sheenColorNode = x("#fff3e2").mul(M.oneMinus())),
    (u.roughnessNode = K(0.58).add(w.mul(0.25)).add(M.mul(0.3))),
    (u.normalNode = lt(r.mul(0.0016).add(w.mul(7e-4)))),
    (u.emissiveNode = it(rt, "#c98a5a", 0.14)));
  for (const [d, h] of [
    [fe(), n],
    [ge(), b],
    [we(), u],
  ]) {
    const p = new oe(d, h);
    ((p.castShadow = p.receiveShadow = !0), e.add(p));
  }
  return (e.rotation.set(-0.23, 0.23, 0.47), e);
}
function ye() {
  return {
    clock: C(0),
    fall: C(0.11),
    air: C(1),
    life: C(9),
    light: C(new Q(2, 2, -1).normalize()),
  };
}
function Ft(e, a, t, o) {
  const c = e.length / 3,
    l = new Float32Array(c * 4);
  for (let ot = 0; ot < l.length; ot++) l[ot] = a();
  const s = vt(new St(e, 3)),
    n = vt(new St(l, 4)),
    i = {
      ...t,
      amount: C(o.amount),
      glint: C(o.glint),
      size: C(o.size),
      sparkle: C(o.sparkle),
    },
    g = i.clock.div(i.life.mul(n.y.mul(0.6).add(0.7))).add(n.x),
    b = g.fract(),
    S = g.floor(),
    m = b.mul(i.life),
    u = n.z.mul(6.283).add(S.mul(2.4)),
    r = N(u.cos(), 0, u.sin()).mul(
      K(1)
        .sub($t(m.mul(-6)))
        .mul(0.035),
    ),
    w = N(
      $(m.mul(0.7).add(n.w.mul(40)))
        .mul(0.05)
        .add(m.mul(0.018)),
      $(m.mul(1.3).add(n.z.mul(30))).mul(0.012),
      $(m.mul(0.9).add(n.y.mul(50))).mul(0.04),
    ).mul(i.air),
    v = s
      .add(r)
      .add(w)
      .add(N(0, m.mul(i.fall).negate(), 0)),
    M = new Ht({ transparent: !0, depthWrite: !1, blending: ae });
  ((M.positionNode = v), (M.scaleNode = i.size.mul(n.w.mul(0.7).add(0.6))));
  const h = Ut.sub(v)
      .normalize()
      .dot(i.light)
      .negate()
      .max(0)
      .pow(3)
      .mul(2.4)
      .add(0.35),
    p = Kt().sub(0.5).length(),
    f = F(0.5, 0.05, p)
      .mul(0.45)
      .add(F(0.18, 0, p)),
    y = F(0, 0.04, b).mul(F(1, 0.7, b)),
    I = n.y.lessThan(i.amount).select(1, 0),
    V = $(m.mul(n.z.mul(7).add(3)).add(n.x.mul(60)))
      .mul(0.5)
      .add(0.5)
      .pow(10),
    W = n.w.pow(3).mul(1.2).add(0.3).add(V.mul(i.sparkle));
  ((M.colorNode = x(o.tint).mul(h).mul(W).mul(i.glint)),
    (M.opacityNode = f.mul(y).mul(I).mul(o.opacity)));
  const et = new se(M);
  return ((et.count = c), (et.frustumCulled = !1), { sprite: et, S: i });
}
const O = [
  [0, -0.9, -0.7, 1.3, 0.2, 0, 0.4, 10, -0.05, 3],
  [2.5, -1.3, -0.9, 1.5, 0.3, 0, 0.5, 10, -0.05, 2.8],
  [5, -2, -1, 1.8, 0.3, -0.05, 0.2, 11, -0.05, 2.8],
  [7.5, -2.7, -0.9, 2, 0.2, 0, 0.1, 12, -0.06, 2.4],
  [10, -3.4, -0.7, 2.2, 0, 0.05, 0, 13, -0.1, 2],
  [12, -4, -0.6, 1.9, 0, 0.1, 0, 12, -0.1, 2],
  [14.5, -4.8, -1.6, 2.6, 0, 0.1, 0, 14, -0.14, 1.8],
  [17, -5.6, -2.2, 3.4, 0, 0.12, 0, 15, -0.16, 1.7],
  [20, -6, -2.3, 4.4, 0, 0.12, 0, 16, -0.16, 1.65],
];
function T(e, a) {
  let t = 0;
  for (; t < O.length - 2 && e > O[t + 1][0]; ) t++;
  const o = (r) => O[Y.clamp(r, 0, O.length - 1)],
    c = o(t),
    l = o(t + 1),
    s = o(t - 1),
    n = o(t + 2),
    i = l[0] - c[0],
    g = Y.clamp((e - c[0]) / i, 0, 1),
    b = (t === 0 ? (l[a] - c[a]) / i : (l[a] - s[a]) / (l[0] - s[0])) * i,
    S =
      (t === O.length - 2 ? (l[a] - c[a]) / i : (n[a] - c[a]) / (n[0] - c[0])) *
      i,
    m = g * g,
    u = m * g;
  return (
    (2 * u - 3 * m + 1) * c[a] +
    (u - 2 * m + g) * b +
    (-2 * u + 3 * m) * l[a] +
    (u - m) * S
  );
}
const U = new Q(),
  Ct = new Q();
function ve(e) {
  const a = T(e, 1),
    t = T(e, 3);
  return (
    U.set(Math.sin(a) * t, T(e, 2), Math.cos(a) * t),
    Ct.set(T(e, 4), T(e, 5), T(e, 6)),
    (U.x += 0.006 * Math.sin(e * 1.7)),
    (U.y += 0.005 * Math.sin(e * 2.3 + 1)),
    {
      position: U,
      target: Ct,
      halfFov: T(e, 7),
      focus: T(e, 8),
      bokeh: T(e, 9),
      roll: 0.022 * Math.sin(e * 0.9) + 0.01 * Math.sin(e * 2.1),
    }
  );
}
const P = new URLSearchParams(location.search),
  tt = P.has("thumb"),
  E = P.has("capture");
document.body.classList.toggle("capture", tt || E);
he();
const z = await Jt({ shadows: !0 }),
  G = z.domElement;
G.id = "view";
G.tabIndex = 0;
G.setAttribute(
  "aria-label",
  "Macro view of a mushroom shedding spores. Drag to orbit and scroll to zoom.",
);
const j = new ne();
j.backgroundNode = q(
  x("#17212c"),
  x("#4b5a69"),
  xt.y.mul(0.72).add(xt.x.mul(0.16)),
);
const bt = Me();
j.add(bt);
let Pt = 90217;
const wt = () => (Pt = (Pt * 48271) % 2147483647) / 2147483647;
bt.updateMatrixWorld();
const xe = new Q();
function Dt(e) {
  const a = be(e, wt);
  for (let t = 0; t < a.length; t += 3)
    a.set(xe.fromArray(a, t).applyMatrix4(bt.matrixWorld).toArray(), t);
  return a;
}
const D = ye(),
  Bt = Ft(Dt(24e3), wt, D, {
    size: 0.0024,
    amount: 0.85,
    glint: 1.8,
    sparkle: 0.6,
    opacity: 0.75,
    tint: "#eadfce",
  }),
  qt = Ft(Dt(1600), wt, D, {
    size: 0.0042,
    amount: 0.6,
    glint: 5,
    sparkle: 8,
    opacity: 1,
    tint: "#ffcf8f",
  });
j.add(Bt.sprite, qt.sprite);
const ut = new le("#ece3d5", "#a8bad2", 0.61),
  A = new Rt("#fff0d7", 2.35);
A.position.set(-2.5, -0.8, 2);
z.shadowMap.type = ie;
A.castShadow = !0;
A.shadow.mapSize.set(2048, 2048);
Object.assign(A.shadow.camera, {
  left: -1.8,
  right: 1.8,
  top: 1.8,
  bottom: -1.8,
  near: 0.1,
  far: 7,
});
A.shadow.normalBias = 8e-4;
A.shadow.bias = -1e-4;
A.shadow.radius = 4;
const Z = new Rt("#ffd5a1", 1.55);
Z.position.set(2, 2, -1);
j.add(ut, A, Z);
const k = new re(32, 1, 0.025, 35),
  R = new te(k, G);
R.target.set(0, 0.12, 0);
k.position.set(0.22, -2.3, 3.12);
R.enableDamping = !0;
R.enablePan = !1;
R.minDistance = 1.4;
R.maxDistance = 6.2;
R.autoRotateSpeed = 0.35;
R.update();
let Et = 16;
function Mt() {
  const e = E ? +P.get("w") : innerWidth,
    a = E ? +P.get("h") : innerHeight;
  ((k.aspect = e / a),
    (k.fov = Y.radToDeg(
      2 * Math.atan(Math.tan(Y.degToRad(Et)) / Math.min(1, k.aspect)),
    )),
    k.updateProjectionMatrix(),
    z.setPixelRatio(E ? 1 : Math.min(devicePixelRatio, 2)),
    z.setSize(e, a, !E));
}
Mt();
addEventListener("resize", Mt);
const kt = Yt(j, k),
  dt = C(3),
  mt = C(0.65),
  _ = C(1.65),
  ht = C(-0.16),
  Gt = Xt(kt.getTextureNode("output"), kt.getViewZNode(), dt, mt, _),
  Vt = Zt(Gt, 0.12, 0.4, 0.7),
  B = new _t(z, Gt.add(Vt));
Qt(z, B);
B.bloom = Vt;
B.look.vignette.value = 0.4;
B.look.grain.value = 0.004;
B.look.tint.value = 0.25;
const pt = { speed: 1 };
D.clock.value = tt ? 7 : 0;
let Se = 0,
  ct;
if (E) {
  z.setAnimationLoop(null);
  const e = +P.get("frames"),
    a = +(P.get("from") || 0),
    t = P.get("port"),
    o = 60,
    c = P.has("t") ? P.get("t").split(",").map(Number) : null,
    l = async (n) => {
      const i = ve(n);
      ((Et = i.halfFov),
        Mt(),
        k.position.copy(i.position),
        k.lookAt(i.target),
        k.rotateZ(i.roll),
        (D.clock.value = 7 + n * 0.85),
        (dt.value = k.position.distanceTo(i.target) + i.focus),
        (_.value = i.bokeh),
        B.render(),
        await z.backend.device.queue.onSubmittedWorkDone());
    },
    s = async (n) => {
      const i = await new Promise((g) => G.toBlob(g, "image/png"));
      await fetch(`http://localhost:${t}/frame?i=${n}`, {
        method: "POST",
        body: i,
      });
    };
  for (let n = 0; n < 4; n++) await l(0);
  if (c) for (const [n, i] of c.entries()) (await l(i), await s(n));
  else for (let n = a; n < a + e; n++) (await l(n / o), await s(n));
  await fetch(`http://localhost:${t}/done`);
} else
  z.setAnimationLoop((e) => {
    const a = ct === void 0 ? 0 : Math.min((e - ct) / 1e3, 0.05);
    ((ct = e),
      (D.clock.value += a * pt.speed),
      R.update(a),
      (dt.value = k.position.distanceTo(R.target) + ht.value),
      B.render(),
      ++Se === 4 &&
        (document.body.classList.add("ready"),
        tt && P.has("still") && z.setAnimationLoop(null),
        P.has("port") &&
          setTimeout(() => {
            (B.render(),
              G.toBlob(
                (t) =>
                  fetch(`http://localhost:${P.get("port")}/`, {
                    method: "POST",
                    body: t,
                  }),
                "image/jpeg",
                0.92,
              ));
          }, 1500)));
  });
function Ce() {
  const e = (t) => (o) => {
      t.value = o;
    },
    a = (t, o) => ({
      [o + "Amount"]: {
        label: "Amount",
        value: t.amount.value,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: e(t.amount),
      },
      [o + "Size"]: {
        label: "Size",
        value: t.size.value,
        min: 5e-4,
        max: 0.012,
        step: 1e-4,
        onChange: e(t.size),
      },
      [o + "Brightness"]: {
        label: "Brightness",
        value: t.glint.value,
        min: 0,
        max: 8,
        step: 0.05,
        onChange: e(t.glint),
      },
      [o + "Sparkle"]: {
        label: "Sparkle",
        value: t.sparkle.value,
        min: 0,
        max: 12,
        step: 0.1,
        onChange: e(t.sparkle),
      },
    });
  return (
    de(() => ({
      Spores: L({
        "Fall speed": {
          value: D.fall.value,
          min: 0,
          max: 0.4,
          step: 0.005,
          onChange: e(D.fall),
        },
        Air: {
          value: D.air.value,
          min: 0,
          max: 4,
          step: 0.05,
          onChange: e(D.air),
        },
        "Time scale": {
          value: pt.speed,
          min: 0,
          max: 4,
          step: 0.05,
          onChange: (t) => {
            pt.speed = t;
          },
        },
        Mist: L(a(Bt.S, "mist")),
        Glitter: L(a(qt.S, "glitter")),
      }),
      Light: L({
        Key: {
          value: A.intensity,
          min: 0,
          max: 6,
          step: 0.05,
          onChange: (t) => {
            A.intensity = t;
          },
        },
        Rim: {
          value: Z.intensity,
          min: 0,
          max: 6,
          step: 0.05,
          onChange: (t) => {
            Z.intensity = t;
          },
        },
        Sky: {
          value: ut.intensity,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (t) => {
            ut.intensity = t;
          },
        },
      }),
      Lens: L({
        "Depth of field": {
          value: mt.value,
          min: 0.03,
          max: 2,
          step: 0.01,
          onChange: e(mt),
        },
        Bokeh: { value: _.value, min: 0, max: 8, step: 0.05, onChange: e(_) },
        "Focus shift": {
          value: ht.value,
          min: -1.2,
          max: 1.2,
          step: 0.01,
          onChange: e(ht),
        },
        "Slow orbit": {
          value: !1,
          onChange: (t) => {
            R.autoRotate = t;
          },
        },
      }),
      ...me({ renderer: z, pipeline: B, lights: [A] }),
    })),
    null
  );
}
tt ||
  ce
    .createRoot(document.querySelector("#controls"))
    .render(
      H.createElement(
        H.Fragment,
        null,
        H.createElement(ue, { collapsed: !0, titleBar: { title: "Controls" } }),
        H.createElement(Ce),
      ),
    );
