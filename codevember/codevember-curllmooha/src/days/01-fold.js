import "../lib/modulepreload-polyfill.js";
import { s as mn } from "../lib/studio-environment.js";
import { s as dn } from "../lib/studio-presets.js";
import {
  u as s,
  W as fn,
  P as pn,
  a as hn,
  M as gn,
  v as q,
  F as Ie,
  m as U,
  b as c,
  c as pt,
  s as ie,
  d as vn,
  n as oe,
  e as xn,
  f as Be,
  g as u,
  o as ht,
  p as bn,
  h as yn,
  i as wn,
  j as Cn,
  k as Sn,
  R as Mn,
  l as kn,
  q as Z,
  r as zn,
  t as ot,
  w as gt,
  x as de,
  y as Pe,
  z as vt,
  A as C,
  B as je,
  C as An,
  D as Te,
  E as pe,
  G as v,
  H as Re,
  I as T,
} from "../lib/stage.js";
import { d as En } from "../lib/DepthOfFieldNode.js";
import {
  N as Pn,
  S as xt,
  P as Tn,
  C as re,
  B as Ln,
  F as we,
  M as bt,
  D as Nn,
  H as Rn,
  V as Ce,
  c as _n,
  r as me,
  L as Hn,
  a as Un,
  b as Dn,
  d as Vn,
  u as Fn,
  e as at,
  f as Gn,
  g as I,
} from "../lib/leva.js";
import { r as In } from "../lib/rendering-panel.js";
const Q = Math.SQRT2,
  Bn = Q / 2,
  jn = 0.5,
  st = [-Q / 6, 1 / 6],
  lt = Math.log(Q),
  yt = 33,
  wt = 1 / 3,
  Wn = 3.4,
  P = yt * wt,
  w = {
    "Sky and Lemon": {
      paper: [
        "#ffe02e",
        "#fffdf6",
        "#2f9fe8",
        "#ffe02e",
        "#fffdf6",
        "#ffe02e",
        "#2f9fe8",
        "#fffdf6",
        "#ffe64d",
        "#2f9fe8",
      ],
      backdrop: "#a9def8",
      pool: 1.1,
      fill: 1.5,
    },
    Vermilion: {
      paper: [
        "#fff3df",
        "#141216",
        "#ffc531",
        "#fff3df",
        "#141216",
        "#fff3df",
        "#ffc531",
        "#fff3df",
        "#141216",
        "#ffe9c9",
      ],
      backdrop: "#cf2417",
      pool: 1.16,
      fill: 1.5,
    },
    Cream: {
      paper: [
        "#e23f2b",
        "#17295c",
        "#e9ad2f",
        "#fffdf7",
        "#e23f2b",
        "#17295c",
        "#fffdf7",
        "#e9ad2f",
        "#e23f2b",
        "#17295c",
      ],
      backdrop: "#f4ecdc",
      pool: 1.05,
      fill: 1.5,
    },
    Noir: {
      paper: [
        "#f6f2e9",
        "#c41f12",
        "#f6f2e9",
        "#0b0b0e",
        "#f0ebe0",
        "#f6f2e9",
        "#b31a10",
        "#f6f2e9",
        "#101014",
        "#eee8dc",
      ],
      backdrop: "#201e26",
      pool: 3.1,
      fill: 0.45,
    },
    "Golden Hour": {
      paper: [
        "#ffb68a",
        "#f4655c",
        "#fff0dc",
        "#f6c64f",
        "#ffb68a",
        "#f4655c",
        "#fff0dc",
        "#f6c64f",
        "#ffc9a6",
        "#f4655c",
      ],
      backdrop: "#0c4650",
      pool: 1.5,
      fill: 1.25,
    },
  },
  ct = 10,
  Ct = (t) => w[t].paper.map((e) => new re(e)),
  B = "Sky and Lemon",
  _ = new URLSearchParams(location.search),
  L = _.has("capture"),
  ae = L ? +_.get("w") : innerWidth,
  se = L ? +_.get("h") : innerHeight,
  he = s(0),
  r = new fn({ antialias: !0 });
r.setPixelRatio(L ? 1 : Math.min(devicePixelRatio, 1.5));
r.setSize(ae, se);
r.toneMapping = Pn;
r.toneMappingExposure = 1;
document.body.prepend(r.domElement);
await r.init();
const M = new xt(),
  p = new Tn(38, ae / se, 0.05, 120),
  We = new xt();
We.background = new re(0.34, 0.33, 0.33);
const qe = (t, e, n, o) => {
  const a = new bt(
    new Un(t, e),
    new Dn({ color: new re(o, o, o * 0.98), side: Vn }),
  );
  (a.position.set(...n), a.lookAt(0, 0, 0), We.add(a));
};
qe(14, 10, [-7, 10, 5], 5);
qe(8, 8, [10, 2, 6], 1.1);
qe(30, 30, [0, -12, 0], 0.5);
M.environment = new pn(r).fromScene(We, 0.05).texture;
M.environmentIntensity = 0.4;
const _e = s(0),
  St = s(0.02),
  Mt = s(1.3),
  He = hn(Ct(B), "color"),
  kt = s(1.5),
  zt = s(1.2),
  Ue = s(0.86),
  At = s(0.42),
  Et = s(0.12),
  Pt = s(0.5),
  Tt = s(1),
  Lt = s(0.5),
  le = s(new re(w[B].backdrop)),
  Se = s(w[B].pool),
  X = s(new Gn(0.5, 0.5)),
  Nt = s(0.9),
  Rt = (t) =>
    t
      .mul(t)
      .mul(t)
      .mul(t.mul(t.mul(6).sub(15)).add(10)),
  _t = (t) => {
    const e = Z(t).mul(ct),
      n = zn(e),
      o = Rt(ie(0.82, 1, e.sub(n)));
    return U(He.element(ot(n)), He.element(ot(gt(n.add(1), ct))), o);
  };
function it(t, e) {
  const { x: n, y: o, z: a, n: m, r: d } = t,
    l = pt(e.div(Mt), 0, 1),
    h = Rt(l),
    x = C(l.mul(Math.PI)).max(0),
    b = n.max(0),
    f = o.mul(0.24).mul(b).mul(x),
    y = h.mul(Math.PI).sub(f).max(2e-4),
    k = x.pow(0.55).mul(0.11).max(2e-4),
    D = b.lessThan(k),
    V = y.mul(b.div(k)),
    z = k.div(y),
    ze = z.mul(C(y)),
    Ae = z.mul(u(1).sub(T(y))),
    F = b.sub(k),
    J = v(D, z.mul(C(V)), ze.add(T(y).mul(F))),
    Ee = v(D, z.mul(u(1).sub(T(V))), Ae.add(C(y).mul(F))),
    ue = v(D, V, y),
    K = T(ue),
    R = C(ue),
    G = n.greaterThan(0),
    ee = (A) =>
      c(
        v(G, A.x.mul(K).sub(A.z.mul(R)), A.x),
        A.y,
        v(G, A.x.mul(R).add(A.z.mul(K)), A.z),
      );
  return {
    x: v(G, J.sub(R.mul(a)), n),
    y: o,
    z: v(G, Ee.add(pe(K).mul(a)).add(h.mul(0.012)), a),
    n: ee(m),
    r: ee(d),
    shade: x.pow(0.75).mul(Re(pe(n).mul(-3.2))),
  };
}
const rt = (t) => c(t.y.negate(), t.x, t.z),
  qn = (t) => ({
    x: t.y.negate().mul(Q),
    y: t.x.mul(Q).add(0.5),
    z: t.z.mul(Q),
    n: rt(t.n),
    r: rt(t.r),
  }),
  H = 120,
  j = 84,
  Ht = [],
  Ut = [],
  ge = [],
  Dt = [],
  ve = [],
  ne = (t, e, n, o = 0, a = 0) => (
    Ht.push(0, 0, 0),
    Ut.push(t, e),
    ge.push(n),
    Dt.push(o, a),
    ge.length - 1
  ),
  Vt = (t) => {
    const e = ge.length;
    for (let o = 0; o <= j; o++)
      for (let a = 0; a <= H; a++) ne(a / H, o / j, t);
    const n = (o, a) => e + a * (H + 1) + o;
    for (let o = 0; o < j; o++)
      for (let a = 0; a < H; a++)
        t > 0
          ? ve.push(
              n(a, o),
              n(a + 1, o),
              n(a, o + 1),
              n(a + 1, o),
              n(a + 1, o + 1),
              n(a, o + 1),
            )
          : ve.push(
              n(a, o),
              n(a, o + 1),
              n(a + 1, o),
              n(a + 1, o),
              n(a, o + 1),
              n(a + 1, o + 1),
            );
  };
Vt(1);
Vt(-1);
const Me = (t, e, n) => {
  for (let o = 0; o < t.length - 1; o++) {
    const [a, m] = t[o],
      [d, l] = t[o + 1],
      h = ne(a, m, 1, e, n),
      x = ne(d, l, 1, e, n),
      b = ne(d, l, -1, e, n),
      f = ne(a, m, -1, e, n);
    ve.push(h, f, x, x, f, b);
  }
};
Me(
  Array.from({ length: H + 1 }, (t, e) => [e / H, 0]),
  0,
  -1,
);
Me(
  Array.from({ length: H + 1 }, (t, e) => [1 - e / H, 1]),
  0,
  1,
);
Me(
  Array.from({ length: j + 1 }, (t, e) => [1, e / j]),
  1,
  0,
);
Me(
  Array.from({ length: j + 1 }, (t, e) => [0, 1 - e / j]),
  -1,
  0,
);
const Y = new Ln();
Y.setAttribute("position", new we(Ht, 3));
Y.setAttribute("aGrid", new we(Ut, 2));
Y.setAttribute("aSide", new we(ge, 1));
Y.setAttribute("aRim", new we(Dt, 2));
Y.setIndex(ve);
const N = new gn();
N.sheen = 0.16;
N.sheenRoughness = 0.65;
N.sheenColor = new re(1, 1, 1);
const Ft = q("vec3", "vNormal"),
  xe = q("vec3", "vLocal"),
  Gt = q("float", "vRim"),
  De = q("vec2", "vTone"),
  It = q("float", "vUpness"),
  Bt = q("float", "vHaze"),
  jt = q("float", "vFold"),
  Le = (t, e) => {
    const n = T(e),
      o = C(e);
    return c(t.x.mul(n).sub(t.y.mul(o)), t.x.mul(o).add(t.y.mul(n)), t.z);
  };
N.positionNode = Ie(() => {
  const t = u(An),
    e = Z(t.mul(0.61803)),
    n = gt(_e.add(t.mul(wt)), P).sub(P - Wn),
    o = Z(n),
    a = Te("aGrid", "vec2"),
    m = Te("aSide", "float"),
    d = Te("aRim", "vec2"),
    l = pe(d.x).add(pe(d.y)).greaterThan(0.5),
    h = {
      x: a.x.sub(0.5).mul(Bn * 2),
      y: a.y.sub(0.5).mul(jn * 2),
      z: u(0),
      n: c(0, 0, 1),
      r: c(d.x, d.y, 0),
    },
    x = it(h, o.add(1)),
    b = qn(x),
    f = it(b, o),
    y = b.n.z.mul(m).greaterThan(0),
    k = m.greaterThan(0),
    D = v(y, f.shade, u(0)),
    V = v(k, x.shade, u(0));
  jt.assign(v(l, u(0), D.add(V).min(1)));
  const z = o.mul(Math.PI / 2),
    ze = Re(o.mul(lt)),
    Ae = c(f.x.sub(st[0]), f.y.sub(st[1]), f.z),
    F = Le(Ae, z).mul(ze),
    J = oe(Le(f.n, z)),
    Ee = Le(f.r, z),
    ue = c(F.x, F.y, 0).mul(Et),
    K = oe(J.add(ue)),
    R = Re(n.mul(lt).mul(Ue)),
    G = e.mul(6.283).add(he.mul(0.11)),
    ee = C(G).mul(0.34).sub(0.62),
    A = T(G.mul(1.3)).mul(0.42),
    Ze = T(ee),
    Qe = C(ee),
    Ye = T(A),
    Je = C(A),
    Ke = (O) => {
      const un = O.y.mul(Ze).sub(O.z.mul(Qe)),
        nt = O.y.mul(Qe).add(O.z.mul(Ze));
      return c(
        O.x.mul(Ye).add(nt.mul(Je)),
        un,
        O.x.mul(Je).negate().add(nt.mul(Ye)),
      );
    },
    et = R.mul(At),
    on = F.mul(et).add(J.mul(m).mul(St.mul(0.5)).mul(et)),
    an = Ke(on),
    sn = Ke(v(l, oe(Ee), K.mul(m))),
    tt = n.mul(1.05).add(t.mul(2.0944)),
    ln = c(1, 0, 0).mul(T(tt)),
    cn = c(0, 0.91, -0.415).mul(C(tt)),
    rn = ln
      .add(cn)
      .mul(R.mul(kt))
      .add(c(0, 0.415, 0.91).mul(R.mul(zt)));
  return (
    Ft.assign(sn),
    xe.assign(F),
    Gt.assign(v(l, u(1), u(0))),
    It.assign(J.z.mul(m)),
    Bt.assign(R),
    De.assign(je(Z(t.mul(0.3819)), n)),
    an.add(rn)
  );
})();
const Wt = De.x.add(De.y.mul(0.008)),
  On = xe.x.mul(0.5).add(xe.y.mul(0.35)).add(0.5),
  ut = _t(Wt),
  Xn = U(ut, ut.mul(c(1.1, 1.03, 0.94)), pt(On, 0, 1).mul(Pt)),
  $n = ie(0.9, -0.05, It).mul(Tt),
  Zn = _t(Wt.add(0.3)),
  Ve = vn(xe.xy.mul(170), 3, 2.1, 0.55),
  Qn = oe(Ft.add(c(Ve.mul(0.035), Ve.mul(-0.03), 0)));
N.normalNode = oe(xn.mul(Be(Qn, 0)).xyz);
N.colorNode = U(
  U(Xn, Zn, $n)
    .mul(Ve.mul(0.05).add(1))
    .mul(u(1).sub(jt.mul(Lt))),
  c(0.97, 0.95, 0.91),
  Gt.mul(0.22),
);
N.roughnessNode = u(0.74);
const Yn = ie(0.34, 0.03, Bt).mul(Nt);
N.outputNode = Be(U(ht.rgb, le.mul(Se), Yn), 1);
const Oe = new bt(Y, N);
Oe.count = yt;
Oe.frustumCulled = !1;
M.add(Oe);
M.backgroundNode = Ie(() => {
  const t = ie(0.85, 0.02, vt(de.sub(X).mul(je(1.1, 1))));
  return le.mul(U(u(0.86), Se, t.mul(t)));
})();
const W = new Nn(16777215, 1.7);
M.add(W);
const ke = new Rn(16777215, 15267067, 1.5);
M.add(ke);
M.add(W.target);
const $ = { azimuth: 130, height: 58 };
function be() {
  const t = at.degToRad($.azimuth),
    e = at.degToRad($.height);
  (W.position.set(
    Math.cos(t) * Math.cos(e) * 16,
    Math.sin(e) * 16,
    Math.sin(t) * Math.cos(e) * 16,
  ),
    W.target.position.set(0, 0, 0));
}
be();
const qt = s(6.5),
  Ot = s(0.22),
  Xt = s(6),
  $t = s(0.75),
  ce = bn(M, p, { samples: 4 });
ce.setMRT(yn({ output: ht, normal: wn }));
const mt = ce.getTextureNode("output"),
  Xe = Cn(ce.getTextureNode("depth"), ce.getTextureNode("normal"), p);
Xe.resolutionScale = 0.4;
Xe.radius.value = 0.35;
const Jn = U(u(1), Xe.getTextureNode().r, $t),
  Zt = En(Be(mt.rgb.mul(Jn), mt.a), ce.getViewZNode(), qt, Xt, Ot),
  Kn = Sn(Zt, 0.1, 0.8, 0.55),
  Qt = s(0.012),
  Fe = s(8e-4),
  Yt = s(0.12),
  Jt = s(1.05),
  Kt = s(1.05),
  Ne = Zt.getTextureNode(),
  eo = Ie(() => {
    const t = de.sub(X),
      e = Pe(t, t).mul(2.2).min(1),
      n = 5;
    let o = c(0);
    for (let f = 0; f < n; f++) {
      const y = u(f / (n - 1)),
        k = u(1).sub(y.mul(Qt).mul(e)),
        D = Ne.sample(X.add(t.mul(k.add(Fe.mul(e))))).r,
        V = Ne.sample(X.add(t.mul(k))).g,
        z = Ne.sample(X.add(t.mul(k.sub(Fe.mul(e))))).b;
      o = o.add(c(D, V, z));
    }
    const m = o.div(n).add(Kn.rgb.mul(Yt)),
      d = Pe(m, c(0.2126, 0.7152, 0.0722)),
      h = U(c(d), m, Kt).max(0).div(0.42).pow(c(Jt)).mul(0.42),
      x = u(1).sub(ie(0.36, 0.92, vt(de.sub(0.5)).mul(1.1)).mul(0.16)),
      b = Z(C(Pe(de.add(Z(he)), je(12.9898, 78.233))).mul(43758.5453)).sub(0.5);
    return h.mul(x).add(b.mul(0.009));
  })(),
  ye = new Mn(r, eo);
kn(r, ye);
const S = {
    fit: 1,
    distance: 7.2,
    rollSpeed: 0.03,
    axis: new Ce(0, 0.415, 0.91).normalize(),
  },
  E = { x: 0, y: 0, sx: 0, sy: 0 };
addEventListener("pointermove", (t) => {
  ((E.x = t.clientX / innerWidth - 0.5), (E.y = t.clientY / innerHeight - 0.5));
});
function en() {
  const t = L ? ae : innerWidth,
    e = L ? se : innerHeight;
  ((p.aspect = t / e),
    (S.fit = 1 + Math.max(0, 1 - p.aspect) * 0.62),
    p.updateProjectionMatrix(),
    r.setSize(t, e));
}
L || addEventListener("resize", en);
en();
const i = { speed: 0.24, playing: !0, clock: 0, smoothDelta: 1 / 60 };
let $e = B,
  tn;
function nn(t) {
  $e = t;
  const e = w[t];
  (Ct(t).forEach((n, o) => He.array[o].copy(n)),
    le.value.set(fe?.sweep ?? e.backdrop),
    (Se.value = e.pool),
    (ke.intensity = e.fill * (fe ? fe.env / 0.5 : 1)),
    (document.body.style.background = "#" + le.value.getHexString()));
}
const to = M.environment,
  no = mn(r);
let fe = null;
const oo = dn(_, (t) => {
  ((fe = t),
    t
      ? W.position
          .set(...t.key)
          .normalize()
          .multiplyScalar(16)
      : be(),
    W.color.set(t?.keyColor ?? 16777215),
    (W.intensity = 1.7 * (t ? t.keyLevel / 4.4 : 1)),
    ke.groundColor.set(t?.fill ?? 15267067),
    (M.environment = t ? no(t) : to),
    (M.environmentIntensity = t ? t.env / 0.5 : 1),
    nn($e));
});
function ao() {
  const [, t] = Fn(() => ({
    Studio: oo,
    Motion: I({
      speed: {
        value: i.speed,
        min: -0.5,
        max: 0.5,
        step: 0.005,
        label: "folds / sec",
        onChange: (e) => {
          i.speed = e;
        },
      },
      overlap: {
        value: 1.3,
        min: 1,
        max: 1.8,
        step: 0.01,
        label: "fold overlap",
        onChange: (e) => {
          Mt.value = e;
        },
      },
      travel: {
        value: Ue.value,
        min: 0.3,
        max: 1.5,
        step: 0.01,
        label: "flight speed",
        onChange: (e) => {
          Ue.value = e;
        },
      },
      play: {
        value: !0,
        onChange: (e) => {
          i.playing = e;
        },
      },
      scrub: {
        value: 0,
        min: 0,
        max: P,
        step: 0.005,
        onChange: (e, n, o) => {
          o.initial || ((i.playing = !1), (i.clock = e), t({ play: !1 }));
        },
      },
    }),
    Colour: I({
      theme: {
        options: Object.keys(w),
        value: B,
        onChange: (e, n, o) => {
          (nn(e),
            o.initial ||
              t({
                backdrop: w[e].backdrop,
                "light pool": w[e].pool,
                fill: w[e].fill,
              }));
        },
      },
      gradient: {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          Pt.value = e;
        },
      },
      "fold shade": {
        value: 0.5,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          Lt.value = e;
        },
      },
      inside: {
        value: 1,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          Tt.value = e;
        },
      },
      backdrop: {
        value: w[B].backdrop,
        onChange: (e) => {
          le.value.set(e);
        },
      },
      "light pool": {
        value: w[B].pool,
        min: 0.8,
        max: 5,
        step: 0.01,
        onChange: (e) => {
          Se.value = e;
        },
      },
    }),
    Paper: I(
      {
        thickness: {
          value: 0.02,
          min: 0.003,
          max: 0.05,
          step: 0.001,
          onChange: (e) => {
            St.value = e;
          },
        },
        size: {
          value: 0.42,
          min: 0.2,
          max: 0.8,
          step: 0.01,
          onChange: (e) => {
            At.value = e;
          },
        },
        bow: {
          value: 0.12,
          min: 0,
          max: 0.4,
          step: 0.01,
          onChange: (e) => {
            Et.value = e;
          },
        },
      },
      { collapsed: !0 },
    ),
    Space: I(
      {
        spread: {
          value: 1.5,
          min: 0.8,
          max: 2.4,
          step: 0.01,
          onChange: (e) => {
            kt.value = e;
          },
        },
        depth: {
          value: 1.2,
          min: 0.4,
          max: 2.4,
          step: 0.01,
          onChange: (e) => {
            zt.value = e;
          },
        },
      },
      { collapsed: !0 },
    ),
    Light: I(
      {
        direction: {
          value: $.azimuth,
          min: 0,
          max: 360,
          step: 1,
          onChange: (e) => {
            (($.azimuth = e), be());
          },
        },
        height: {
          value: $.height,
          min: 20,
          max: 88,
          step: 1,
          onChange: (e) => {
            (($.height = e), be());
          },
        },
        fill: {
          value: 1.5,
          min: 0,
          max: 3,
          step: 0.01,
          onChange: (e) => {
            ke.intensity = e;
          },
        },
        exposure: {
          value: 1,
          min: 0.5,
          max: 2,
          step: 0.01,
          onChange: (e) => {
            r.toneMappingExposure = e;
          },
        },
      },
      { collapsed: !0 },
    ),
    Camera: I(
      {
        distance: {
          value: S.distance,
          min: 4,
          max: 12,
          step: 0.05,
          onChange: (e) => {
            S.distance = e;
          },
        },
        roll: {
          value: S.rollSpeed,
          min: -0.3,
          max: 0.3,
          step: 0.005,
          onChange: (e) => {
            S.rollSpeed = e;
          },
        },
        lens: {
          value: 38,
          min: 20,
          max: 70,
          step: 1,
          label: "field of view",
          onChange: (e) => {
            ((p.fov = e), p.updateProjectionMatrix());
          },
        },
      },
      { collapsed: !0 },
    ),
    Lens: I(
      {
        focus: {
          value: 6.5,
          min: 1,
          max: 15,
          step: 0.1,
          onChange: (e) => {
            qt.value = e;
          },
        },
        "sharp range": {
          value: 6,
          min: 0.5,
          max: 12,
          step: 0.1,
          onChange: (e) => {
            Xt.value = e;
          },
        },
        blur: {
          value: 0.22,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: (e) => {
            Ot.value = e;
          },
        },
        streak: {
          value: 0.012,
          min: 0,
          max: 0.15,
          step: 0.001,
          onChange: (e) => {
            Qt.value = e;
          },
        },
        chroma: {
          value: 8e-4,
          min: 0,
          max: 0.02,
          step: 5e-4,
          onChange: (e) => {
            Fe.value = e;
          },
        },
        halation: {
          value: 0.12,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (e) => {
            Yt.value = e;
          },
        },
        haze: {
          value: 0.9,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (e) => {
            Nt.value = e;
          },
        },
        contrast: {
          value: 1.05,
          min: 0.8,
          max: 1.6,
          step: 0.01,
          onChange: (e) => {
            Jt.value = e;
          },
        },
        saturation: {
          value: 1.05,
          min: 0.6,
          max: 1.6,
          step: 0.01,
          onChange: (e) => {
            Kt.value = e;
          },
        },
        AO: {
          value: 0.75,
          min: 0,
          max: 1,
          step: 0.05,
          onChange: (e) => {
            $t.value = e;
          },
        },
      },
      { collapsed: !0 },
    ),
    ...In({ renderer: r, pipeline: ye }),
  }));
  return ((tn = t), null);
}
document.querySelector("#random").addEventListener("click", () => {
  const t = Object.keys(w).filter((e) => e !== $e);
  tn({ theme: t[Math.floor(Math.random() * t.length)] });
});
L ||
  _n.createRoot(document.querySelector("#controls")).render(
    me.createElement(
      me.Fragment,
      null,
      me.createElement(Hn, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      me.createElement(ao),
    ),
  );
const Ge = { roll: 0 },
  so = new Ce(1, 0, 0),
  dt = new Ce(),
  te = new Ce();
function ft(t) {
  ((Ge.roll += t * S.rollSpeed),
    p.position.copy(S.axis).multiplyScalar(S.distance * S.fit),
    p.position.addScaledVector(so, E.sx * 0.7),
    (p.position.y += -E.sy * 0.45),
    dt.set(0, 0.91, -0.415).applyAxisAngle(S.axis, Ge.roll),
    p.up.copy(dt),
    p.lookAt(te),
    te.project(p),
    X.value.set(te.x * 0.5 + 0.5, 0.5 - te.y * 0.5),
    te.set(0, 0, 0));
}
const g = {
  samples: 0,
  total: 0,
  ratio: Math.min(devicePixelRatio, 1.5),
  settleUntil: performance.now() + 4e3,
};
function lo(t, e) {
  if (L || t < g.settleUntil || ((g.total += e), ++g.samples < 90)) return;
  const n = g.samples / g.total;
  ((g.samples = g.total = 0),
    n < 45 &&
      g.ratio > 0.75 &&
      ((g.ratio = Math.max(0.75, g.ratio - 0.25)),
      r.setPixelRatio(g.ratio),
      r.setSize(innerWidth, innerHeight),
      (g.settleUntil = t + 2e3)));
}
if (L) {
  (document.querySelector("#controls")?.remove(),
    document.querySelector("#random")?.remove());
  const t = +(_.get("start") ?? 0),
    e = r.domElement;
  e.style.cssText = `position:fixed;left:0;top:0;width:${ae}px;height:${se}px`;
  const n = document.createElement("canvas");
  ((n.width = ae), (n.height = se));
  const o = n.getContext("2d");
  ((window.__frame = async (l) => (
    (i.clock = (((t + l * i.speed) % P) + P) % P),
    (_e.value = i.clock),
    (he.value = l),
    (Ge.roll = l * S.rollSpeed),
    ft(0),
    ye.render(),
    o.drawImage(e, 0, 0),
    new Promise((h) => n.toBlob(h, "image/png"))
  )),
    (window.__ready = !0));
  const a = +_.get("frames"),
    m = +_.get("fps"),
    d = _.get("port");
  if (d) {
    for (let l = 0; l < 4; l++) await window.__frame(0);
    for (let l = 0; l < a; l++) {
      const h = await window.__frame(l / m);
      await fetch(`http://localhost:${d}/frame?i=${l}`, {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: h,
      });
    }
    await fetch(`http://localhost:${d}/done`);
  }
} else {
  let t = performance.now();
  r.setAnimationLoop((e) => {
    const n = Math.min((e - t) / 1e3, 0.06666666666666667);
    ((t = e),
      (i.smoothDelta += (n - i.smoothDelta) * 0.08),
      i.playing &&
        (i.clock = (((i.clock + i.smoothDelta * i.speed) % P) + P) % P),
      (_e.value = i.clock),
      (he.value = e / 1e3),
      (E.sx += (E.x - E.sx) * 0.025),
      (E.sy += (E.y - E.sy) * 0.025),
      ft(i.smoothDelta),
      lo(e, n),
      ye.render());
  });
}
