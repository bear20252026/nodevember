import "../lib/modulepreload-polyfill.js";
import { s as Ke } from "../lib/studio-environment.js";
import { s as Je } from "../lib/studio-presets.js";
import {
  aj as tn,
  P as en,
  p as nn,
  u as I,
  R as on,
  l as an,
  F as re,
  z as Le,
  Q as ie,
  ak as sn,
  g as N,
  af as it,
  A as ut,
  s as E,
  c as rn,
  d as Gt,
  E as yt,
  m as dt,
  M as ce,
  X as cn,
  a3 as ln,
  D as un,
  k as hn,
  y as _t,
  b as zt,
  x as ve,
  q as qt,
  al as dn,
  am as Ie,
  a6 as Ee,
  K as mn,
  T as ye,
  i as pn,
} from "../lib/stage.js";
import { d as fn } from "../lib/DepthOfFieldNode.js";
import { O as gn } from "../lib/OrbitControls.js";
import { R as wn } from "../lib/RoomEnvironment.js";
import {
  aO as Mt,
  V as z,
  e as X,
  S as vn,
  C as U,
  Y as yn,
  d as kt,
  f as Y,
  M as S,
  aP as Bt,
  P as xn,
  n as Mn,
  D as Te,
  H as Sn,
  o as zn,
  k as gt,
  aQ as ke,
  m as Be,
  aR as bn,
  aB as ht,
  aS as Ut,
  aC as tt,
  a3 as Ae,
  aT as Pn,
  aU as Qt,
  ar as Cn,
  B as Rn,
  t as xe,
  aV as Ln,
  a0 as In,
  b as En,
  c as Tn,
  r as bt,
  L as kn,
  R as Bn,
  az as An,
  u as Fn,
  Q as On,
  g as K,
  aF as Dn,
  aW as Nn,
} from "../lib/leva.js";
import "../lib/three.js";
import { r as Wn } from "../lib/rendering-panel.js";
import { a as Vn } from "../lib/pcss.js";
const Gn = 20,
  Un = 8,
  et = [
    [0, [-0.8, 0.62, 2.5], [-0.1, 0.25, 1.55], 24, 0.1],
    [2.6, [0.6, 0.62, 2.15], [0.9, 0.2, 1], 27, 0.2],
    [4.6, [0.55, 0.5, 1], [0.1, -0.1, 0.25], 30, 0.3],
    [6.4, [0.3, 0.42, 0.45], [0, -0.45, 0], 36, 0.3],
    [8.2, [1.9, 0.8, 2], [0, -0.3, 0], 32, 0.4],
    [9.6, [2.5, -0.55, 2.4], [0, -0.75, 0], 32, 0.3],
    [11.6, [-1.2, -0.7, 2.9], [-0.9, -1.2, -0.7], 32, 0.1],
    [13.2, [-5.2, -0.4, 2.2], [-1.7, -0.45, -1.4], 34, 0],
    [15, [-3, 1.2, 0.8], [-1.55, 0.45, -0.9], 30, 0.2],
    [16.8, [-2.2, 1.5, 2.2], [-0.6, 0.15, -0.2], 30, 0.6],
    [20, [0.5, 2, 6.2], [0, -0.3, 0], 30, 1],
  ],
  jn = [
    { t: 5, drop: !0 },
    { t: 8, drop: !0 },
  ],
  Hn = new Mt(
    et.map((t) => new z(...t[1])),
    !1,
    "centripetal",
  ),
  Xn = new Mt(
    et.map((t) => new z(...t[2])),
    !1,
    "centripetal",
  );
function Yn(t, e) {
  let n = 0;
  for (; n < et.length - 2 && t >= et[n + 1][0]; ) n++;
  const [o, , , a, r] = et[n],
    [s, , , i, c] = et[n + 1],
    l = X.clamp((t - o) / (s - o), 0, 1),
    d = X.lerp(l, l * l * (3 - 2 * l), 0.35),
    p = (n + d) / (et.length - 1),
    P = Xn.getPoint(p),
    u = Hn.getPoint(p),
    g = X.lerp(r, c, d),
    m = Math.max(1, 1.5 / e);
  return (
    u
      .sub(P)
      .multiplyScalar(1 + (m - 1) * g)
      .add(P),
    { position: u, target: P, fov: X.lerp(a, i, d) }
  );
}
const _n = (t) => Math.max(0, 1 - t / 0.7) ** 2,
  qn = (t) => X.clamp((Gn - t) / 0.9, 0, 1),
  Zt = 0.12,
  f = 1.6,
  st = 0.15,
  R = 0.042,
  ot = { gravity: (9.8 * 0.36 * 5) / 7, friction: 0.032 },
  Z = (t) => -Zt / Math.max(t, st) + Zt / f,
  le = (t) => Zt / Math.max(t, st) ** 2,
  At = (t) => {
    const e = le(t);
    return Math.sqrt(((ot.gravity * e) / Math.sqrt(1 + e * e)) * t);
  };
function Qn(t, e) {
  const n = Math.hypot(t.x, t.z),
    o = le(n),
    a = t.x / n,
    r = t.z / n,
    s = Math.hypot(o, 1),
    i = (-o * a) / s,
    c = 1 / s,
    l = (-o * r) / s;
  let d = t.vx,
    p = t.vy,
    P = t.vz;
  const u = ot.gravity,
    g = -u * c;
  ((d += -(g * i) * e), (p += (-u - g * c) * e), (P += -(g * l) * e));
  const m = d * i + p * c + P * l;
  ((d -= m * i), (p -= m * c), (P -= m * l));
  const w = Math.exp(-ot.friction * e);
  ((t.vx = d * w),
    (t.vy = p * w),
    (t.vz = P * w),
    (t.x += t.vx * e),
    (t.z += t.vz * e));
  const M = Math.hypot(t.x, t.z);
  if (M > f - R) {
    const h = t.x / M,
      x = t.z / M,
      F = t.vx * h + t.vz * x;
    ((t.x = h * (f - R)),
      (t.z = x * (f - R)),
      F > 0 && ((t.vx -= 1.7 * F * h), (t.vz -= 1.7 * F * x)));
  }
  return ((t.y = Z(Math.hypot(t.x, t.z))), Math.hypot(t.x, t.z) < st + R * 0.3);
}
function Zn(t, e) {
  const n = Math.max(1e-6, Math.hypot(t.x, t.z)),
    o = le(n),
    a = Math.hypot(o, 1);
  return e.set(
    t.x - (o * (t.x / n) * R) / a,
    t.y + R / a,
    t.z - (o * (t.z / n) * R) / a,
  );
}
function $n(t, e) {
  const n = e.x - t.x,
    o = e.y - t.y,
    a = e.z - t.z,
    r = Math.hypot(n, o, a);
  if (r >= 2 * R || r === 0) return 0;
  const s = n / r,
    i = o / r,
    c = a / r,
    l = (2 * R - r) / 2;
  ((t.x -= s * l), (t.z -= c * l), (e.x += s * l), (e.z += c * l));
  const d = (e.vx - t.vx) * s + (e.vy - t.vy) * i + (e.vz - t.vz) * c;
  if (d >= 0) return 0;
  const p = -d * 0.9;
  return (
    (t.vx -= p * s),
    (t.vy -= p * i),
    (t.vz -= p * c),
    (e.vx += p * s),
    (e.vy += p * i),
    (e.vz += p * c),
    -d
  );
}
const Kn = document.querySelector("#message"),
  Jn = document.querySelector("#hint");
if (!navigator.gpu)
  throw (
    (Kn.textContent =
      "This piece needs WebGPU. Try a recent version of Chrome or Edge."),
    new Error("no webgpu")
  );
const wt =
  matchMedia("(pointer: coarse)").matches &&
  Math.min(innerWidth, innerHeight) < 820;
wt &&
  (Jn.textContent =
    "Tap or swipe on the funnel to set a planet orbiting. Drag elsewhere to turn");
const D = new URLSearchParams(location.search),
  $ = D.has("capture"),
  jt = +(D.get("fps") || 60);
if ($) {
  let t = 912367;
  Math.random = () => {
    t = (t + 1831565813) | 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    return (
      (e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e),
      ((e ^ (e >>> 14)) >>> 0) / 4294967296
    );
  };
  for (const e of ["#title", "#hint", "#controls"])
    document.querySelector(e).style.display = "none";
}
D.has("still") &&
  document.head.append(
    Object.assign(document.createElement("style"), {
      textContent: "* { transition: none !important }",
    }),
  );
const O = -1.75,
  _ = 0.25,
  Q = 0.32,
  Ft = "#c49a52",
  Fe = [
    { colour: "#a39b92", band: "#7d756d" },
    { colour: "#e7cf96", band: "#c9a866" },
    { colour: "#2f6fcf", band: "#e8f0ff" },
    { colour: "#c4502f", band: "#8a3018" },
    { colour: "#d9a978", band: "#9b6a44" },
    { colour: "#ead7a0", band: "#bfa46a" },
    { colour: "#7fd0de", band: "#4ea6b8" },
    { colour: "#2d48b8", band: "#7f9bff" },
    { steel: !0 },
    { gold: !0 },
    { steel: !0 },
  ],
  b = {
    autoRes: !$,
    maxRes: Math.min(devicePixelRatio, 2),
    launch: 1,
    autoLaunch: !0,
    dof: !wt,
    trails: !0,
  },
  C = await tn({ exposure: 0.78 });
C.setPixelRatio($ ? 1 : Math.min(b.maxRes, wt ? 1.25 : 1.5));
$ && C.setSize(+D.get("w"), +D.get("h"), !1);
const y = new vn();
y.background = new U("#eeebe6");
const to = new en(C),
  Ot = to.fromScene(new wn(), 0.04).texture;
y.environment = Ot;
y.environmentIntensity = 0.2;
const ue = new yn({ color: "#f3f0eb", roughness: 0.95, side: kt });
{
  const t = [];
  for (let n = 0; n <= 12; n++) t.push(new Y((10 * n) / 12, O));
  for (let n = 1; n <= 32; n++) {
    const o = ((n / 32) * Math.PI) / 2;
    t.push(new Y(10 + 5 * Math.sin(o), O + 5 * (1 - Math.cos(o))));
  }
  t.push(new Y(15, O + 40));
  const e = new S(new Bt(t, 96), ue);
  ((e.receiveShadow = !0), y.add(e));
}
const A = new xn(
    30,
    $ ? D.get("w") / D.get("h") : innerWidth / innerHeight,
    0.05,
    80,
  ),
  eo = new z(0.5, 2.8, 6.2),
  $t = () => Math.max(1, 1.5 / A.aspect);
A.position.copy(eo).multiplyScalar($t());
const L = new gn(A, C.domElement);
Object.assign(L, {
  enableDamping: !0,
  enablePan: !1,
  minDistance: 2.2,
  maxDistance: 24,
  maxPolarAngle: 1.45,
  autoRotate: !0,
  autoRotateSpeed: 0.16,
});
L.target.set(0, -0.3, 0);
const Oe = nn(y, A),
  De = Oe.getTextureNode("output"),
  Ne = I(6),
  Rt = I(4.8),
  Lt = I(0.22),
  Kt = I(1),
  Jt = I(0.18),
  We = I(0),
  Ve = I(1),
  Ge = (t) => {
    const e = hn(t, 0.1, 0.5, 0.85);
    return {
      node: re(() => {
        const o = t.rgb.add(e).toVar(),
          a = _t(o, zt(0.2126, 0.7152, 0.0722)),
          s = o
            .mul(dt(zt(0.97, 0.99, 1.04), zt(1.025, 1, 0.97), E(0.1, 0.8, a)))
            .sub(0.5)
            .mul(1.06)
            .add(0.5)
            .max(0),
          i = dt(o, s, Kt),
          c = E(0.3, 0.95, Le(ve.sub(0.5)).mul(1.3)),
          l = qt(
            ut(_t(ve.add(qt(dn)), zt(12.9898, 78.233, 0).xy)).mul(43758.5453),
          ).sub(0.5);
        return i
          .mul(N(1).sub(c.mul(Jt)))
          .add(l.mul(0.003))
          .add(We)
          .mul(Ve);
      })(),
      glow: e,
    };
  },
  he = Ge(fn(De, Oe.getViewZNode(), Ne, Rt, Lt)),
  de = Ge(De),
  mt = new on(C, b.dof ? he.node : de.node);
an(C, mt);
const no = (t) => {
    ((b.dof = t),
      (mt.outputNode = t ? he.node : de.node),
      (mt.needsUpdate = !0));
  },
  oo = (t) => {
    he.glow.strength.value = de.glow.strength.value = t;
  },
  v = new Mn("#fff0dc", 165, 22, 0.52, 0.9, 2);
v.position.set(-3.8, 2.9, 4.2);
v.target.position.set(0, -0.4, 0);
v.castShadow = !0;
v.shadow.mapSize.set(2048, 2048);
v.shadow.radius = 9;
const ao = Vn(v, { renderer: C, lightSize: 0.12 });
v.shadow.blurSamples = 12;
v.shadow.bias = -4e-4;
v.shadow.normalBias = 0.012;
const pt = new Te("#dce7fa", 0.2);
pt.position.set(5, 2.5, 3.5);
const It = new Te("#fff5e6", 0.9);
It.position.set(-1.5, 3, -6);
const te = new Sn("#ffffff", "#81776b", 0.13),
  Et = new zn("#ffd9a0", 1.8, 3.4, 1.6);
y.add(v, v.target, pt, It, te);
const me = I(1),
  ee = I(0.3),
  Dt = (t, e = 1.25) => Object.assign(t, { envMap: Ot, envMapIntensity: e }),
  k = Dt(new gt({ color: Ft, metalness: 1, roughness: 0.27 })),
  pe = Dt(
    new gt({
      color: new U(Ft).multiplyScalar(0.62),
      metalness: 1,
      roughness: 0.34,
    }),
  ),
  fe = Dt(new gt({ color: "#c9ccd2", metalness: 1, roughness: 0.1 })),
  Ht = new gt({
    color: "#ffffff",
    metalness: 0,
    roughness: 0.03,
    transparent: !0,
    opacity: 0.2,
    clearcoat: 1,
    depthWrite: !1,
    side: kt,
  }),
  Me = (t, e) => {
    const n = Ie(t).max(1e-6);
    return E(N(0.5 - e).sub(n), N(0.5 - e).add(n), yt(qt(t).sub(0.5))).mul(
      Ee(1, N(e * 2).div(n)),
    );
  },
  Pt = (t, e) => {
    const n = Ie(t).max(1e-4);
    return E(N(e).add(n), 0, yt(t)).mul(Ee(1, N(e * 2).div(n)));
  },
  so = [0.3, 0.58, 0.86, 1.14, 1.43],
  ro = re(() => {
    const t = ie,
      e = Le(t.xz),
      n = sn(t.z, t.x);
    let o = N(0);
    for (const c of so) o = it(o, Pt(e.sub(c), 0.009));
    const a = Pt(ut(n.mul(12)).mul(e).div(12), 0.003)
        .mul(E(0.205, 0.225, e))
        .mul(E(0.285, 0.255, e)),
      r = Pt(ut(n.mul(6)).mul(e).div(6), 0.0025)
        .mul(E(1.14, 1.18, e))
        .mul(E(1.43, 1.4, e)),
      s = Me(n.mul(180 / Math.PI), 0.1)
        .mul(E(1.52, 1.525, e))
        .mul(E(1.575, 1.57, e))
        .max(
          Me(n.mul(36 / Math.PI), 0.08)
            .mul(E(1.48, 1.485, e))
            .mul(E(1.575, 1.57, e)),
        ),
      i = Pt(ut(n.mul(36)).mul(0.012).add(e.sub(1.465)), 0.002);
    return rn(it(it(o, a), it(r, it(s, i))), 0, 1).mul(me);
  }),
  io = I(new U("#e2ded6")),
  co = I(new U("#f2eee6")),
  lo = I(new U("#aaa59b")),
  Ue = re(([t]) => {
    const e = t.mul(1.4),
      n = Gt(e, 5, 2, 0.5),
      o = yt(
        ut(e.x.mul(1.7).add(e.z.mul(1.1)).add(e.y.mul(0.8)).add(n.mul(6.5))),
      )
        .oneMinus()
        .pow(18),
      a = yt(
        ut(
          e.z
            .mul(4.3)
            .sub(e.x.mul(2.1))
            .add(Gt(e.mul(2.3), 4).mul(5)),
        ),
      )
        .oneMinus()
        .pow(40)
        .mul(0.5),
      r = Gt(e.mul(3.5), 3).mul(0.5).add(0.5);
    return dt(dt(io, co, r), lo, it(o.mul(0.48), a.mul(0.45)));
  }),
  uo = (t, e) => {
    const n = mn,
      o = pn,
      a = n.dFdx(),
      r = n.dFdy(),
      s = ye(r, o),
      i = ye(o, a),
      c = _t(a, s),
      l = t.dFdx().mul(s).add(t.dFdy().mul(i)).mul(c.sign()).mul(e);
    return yt(c).mul(o).sub(l).normalize();
  },
  je = I(new U(Ft)),
  ne = I(0.006),
  ge = (t) =>
    Object.assign(t, {
      metalness: 0,
      roughness: 0.28,
      clearcoat: 0.32,
      clearcoatRoughness: 0.18,
    }),
  ho = N(0.36);
function He(t, e) {
  const n = E(0.45, 0.95, e),
    o = E(0.02, 0.38, e).mul(n.oneMinus()),
    a = Ue(ie).mul(N(1).sub(o.mul(0.5)));
  ((t.colorNode = dt(a, je.mul(0.72), n)),
    (t.metalnessNode = n.mul(0.92)),
    (t.roughnessNode = dt(N(0.3).add(o.mul(0.16)), ho, n)),
    (t.clearcoatNode = N(0.2).mul(e.oneMinus())),
    (t.normalNode = uo(e.negate(), ne)),
    (t.aoNode = N(1).sub(e.mul(0.28))),
    (t.envMap = Ot),
    (t.envMapIntensity = 0.55));
}
const xt = ge(new ce({ side: kt }));
{
  const t = ro();
  He(xt, t);
}
const Tt = ge(new ce({ side: kt }));
Tt.colorNode = Ue(ie);
const Xe = (() => {
  const t = [];
  for (let n = 0; n <= 200; n++) {
    const o = st + (f - st) * (n / 200) ** 1.8;
    t.push(new Y(o, _ + Z(o)));
  }
  const e = new S(new Bt(t, 160), xt);
  return ((e.castShadow = e.receiveShadow = !0), e);
})();
y.add(Xe);
{
  const t = document.createElement("canvas"),
    e = 2048,
    n = e / 2,
    o = n / (f + Q);
  t.width = t.height = e;
  const a = t.getContext("2d"),
    r = "#3a2a14";
  ((a.fillStyle = "#fff"), a.fillRect(0, 0, e, e));
  const s = (h, x) => {
      ((a.lineWidth = x), a.beginPath(), a.arc(n, n, h * o, 0, 7), a.stroke());
    },
    i = (h, x, F, vt) => {
      ((a.lineWidth = vt),
        a.beginPath(),
        a.moveTo(n + Math.cos(h) * x * o, n + Math.sin(h) * x * o),
        a.lineTo(n + Math.cos(h) * F * o, n + Math.sin(h) * F * o),
        a.stroke());
    };
  ((a.strokeStyle = r),
    s(f + 0.03, 6),
    s(f + 0.09, 3),
    s(f + Q - 0.07, 3),
    s(f + Q - 0.025, 7));
  for (let h = 0; h < 360; h++)
    i(
      (h / 180) * Math.PI,
      f + 0.03,
      f + (h % 10 ? 0.06 : h % 30 ? 0.075 : 0.09),
      h % 10 ? 2.2 : 4.5,
    );
  ((a.fillStyle = r), (a.textAlign = "center"), (a.textBaseline = "middle"));
  const c = "♈♉♊♋♌♍♎♏♐♑♒♓";
  for (let h = 0; h < 12; h++) {
    const x = ((h + 0.5) / 6) * Math.PI,
      F = (f + 0.17) * o;
    (a.save(),
      a.translate(n + Math.cos(x) * F, n + Math.sin(x) * F),
      a.rotate(x + Math.PI / 2),
      (a.font = '70px "DejaVu Sans", "Segoe UI Symbol", serif'),
      a.fillText(c[h], 0, 0),
      a.restore(),
      i((h / 6) * Math.PI, f + 0.09, f + Q - 0.07, 3.5));
  }
  const l = new ke(t);
  ((l.colorSpace = Be), (l.anisotropy = 16));
  const d = ge(new ce()),
    p = cn(l).r.oneMinus().mul(me);
  He(d, p);
  const P = new S(new bn(f, f + Q, 160, 1).rotateX(-Math.PI / 2), d),
    u = new S(new ht(f, 0.016, 10, 160).rotateX(Math.PI / 2), k),
    g = new S(new ht(f + Q, 0.02, 10, 160).rotateX(Math.PI / 2), k);
  for (const h of [P, u, g])
    ((h.position.y = _), (h.castShadow = h.receiveShadow = !0), y.add(h));
  const m = f + Q,
    w = [
      [m - 0.01, 0],
      [m + 0.012, 0.022],
      [m + 0.035, 0.012],
      [m + 0.04, -0.01],
      [m + 0.03, -0.03],
      [m + 0.06, -0.06],
      [m + 0.078, -0.09],
      [m + 0.078, -0.12],
      [m + 0.06, -0.142],
      [m + 0.02, -0.16],
      [m - 0.08, -0.2],
      [f, -0.24],
    ].map(([h, x]) => new Y(h, _ + x));
  for (let h = 1; h <= 40; h++) {
    const x = f - (f - 0.17) * (h / 40) ** 0.6;
    w.push(new Y(x, _ + Z(x) - 0.09 - (0.15 * x) / f));
  }
  w.push(new Y(0.13, w.at(-1).y - 0.03));
  const M = new S(new Bt(w, 160), Tt);
  ((M.castShadow = M.receiveShadow = !0), y.add(M));
}
const Nt = _ + Z(st),
  we = new S(new ht(st + 0.004, 0.011, 16, 96).rotateX(Math.PI / 2), k);
we.position.y = Nt;
we.castShadow = !0;
Et.position.set(0, Nt - 0.25, 0);
y.add(we, Et);
const nt = -2.45,
  Ye = f + Q + 0.28,
  j = Math.cos(nt) * Ye,
  H = Math.sin(nt) * Ye,
  W = O + 0.13,
  q = _ + 0.32,
  oe = 0.11,
  _e = $ ? 0.75 : 0.3,
  V = [];
let qe = 0;
{
  const t = (s, i, c) => {
    for (let l = 0; l <= i; l++) V.push({ p: s.getPoint(l / i), speed: c });
  };
  t(new Ut(new z(0, Nt - 0.05, 0), new z(0, W, 0)), 40, 2.2);
  const e = j - Math.cos(nt) * 0.035,
    n = H - Math.sin(nt) * 0.035;
  (t(new Ut(new z(0, W, 0), new z(e, W, n)), 120, 0.9),
    t(new Ut(new z(e, W, n), new z(e, q, n)), 160, _e),
    (qe = V.length));
  const o = nt - 0.42,
    a = f - 0.08;
  t(
    new Mt([
      new z(e, q, n),
      new z(j * 0.93, q - 0.02, H * 0.93),
      new z(
        Math.cos(nt - 0.3) * (f + 0.12),
        _ + 0.11,
        Math.sin(nt - 0.3) * (f + 0.12),
      ),
      new z(Math.cos(o) * a, _ + Z(a) + R, Math.sin(o) * a),
    ]),
    80,
    0.9,
  );
  let r = 0;
  V.forEach((s, i) => {
    (i && (r += s.p.distanceTo(V[i - 1].p)), (s.s = r));
  });
}
const ae = V.at(-1).s,
  J = V.at(-1).p,
  Se = new z().subVectors(J, V.at(-6).p).setY(0).normalize(),
  ze = (t) => {
    let e = 0,
      n = V.length - 1;
    for (; n - e > 1; ) {
      const s = (e + n) >> 1;
      V[s].s < t ? (e = s) : (n = s);
    }
    const o = V[e],
      a = V[n],
      r = Math.min(1, Math.max(0, (t - o.s) / Math.max(1e-6, a.s - o.s)));
    return { p: o.p.clone().lerp(a.p, r), speed: o.speed };
  };
{
  const t = O + 0.23,
    e = Nt - 0.02,
    n = [
      [0.001, 0],
      [0.74, 0],
      [0.74, 0.06],
      [0.66, 0.072],
      [0.66, 0.12],
      [0.55, 0.132],
      [0.55, 0.17],
      [0.4, 0.2],
      [0.2, 0.225],
      [0.14, 0.23],
      [0.001, 0.23],
    ],
    o = new S(
      new Bt(
        n.map(([u, g]) => new Y(u, O + g)),
        96,
      ),
      Tt,
    ),
    a = new S(
      new tt(0.1, 0.1, e - t, 48, 1, !0).translate(0, (e + t) / 2, 0),
      Ht,
    ),
    r = new Ae(),
    s = (u, g, m, w = 0.011) => {
      const M = new S(new ht(u, m, 16, 96).rotateX(Math.PI / 2), k);
      ((M.position.y = g), (M.castShadow = !0), r.add(M));
    };
  for (const [u, g, m] of [
    [0.4, 0.2, 0.014],
    [0.55, 0.15, 0.01],
    [0.745, 0.03, 0.012],
  ])
    s(u, O + g, m);
  for (let u = 0; u < 4; u++)
    s(0.108, t + 0.04 + (u * (e - t - 0.1)) / 3, 0.012);
  s(0.125, e, 0.014);
  for (let u = 0; u < 3; u++) {
    const g = Math.PI / 6 + (u * Math.PI * 2) / 3,
      m = Math.cos(g),
      w = Math.sin(g),
      M = ([G, rt]) => new z(m * G, rt, w * G),
      h = new Pn(M([0.5, O + 0.17]), M([1.12, O + 0.85]), M([0.9, O + 1.72])),
      x = new S(new Qt(h, 48, 0.05, 20), Tt),
      F = x.geometry.attributes.position,
      vt = new z(),
      St = new z();
    for (let G = 0; G < F.count; G++) {
      const rt = Math.floor(G / 21) / 48;
      (h.getPoint(Math.min(1, rt), vt),
        St.fromBufferAttribute(F, G)
          .sub(vt)
          .multiplyScalar(1 - 0.38 * rt)
          .add(vt),
        F.setXYZ(G, St.x, St.y, St.z));
    }
    (x.geometry.computeVertexNormals(),
      (x.castShadow = x.receiveShadow = !0),
      y.add(x));
    for (const [G, rt] of [
      [0.5, O + 0.17],
      [0.9, O + 1.72],
    ]) {
      const Vt = new S(new ht(0.05, 0.01, 12, 32).rotateX(Math.PI / 2), k);
      (Vt.position.set(m * G, rt, w * G), (Vt.castShadow = !0), r.add(Vt));
    }
  }
  const i = Math.hypot(j, H),
    c = new S(new tt(0.062, 0.062, i, 32, 1, !0).rotateZ(Math.PI / 2), Ht);
  (c.position.set(j / 2, W, H / 2), (c.rotation.y = -Math.atan2(H, j)));
  for (let u = 1; u <= 4; u++) {
    const g = 0.28 + u * 0.145,
      m = new S(new ht(0.068, 0.009, 12, 40), k);
    (m.position.set(j * g, W, H * g),
      (m.rotation.y = -Math.atan2(H, j) + Math.PI / 2),
      (m.castShadow = !0),
      r.add(m));
  }
  const l = new S(new tt(0.16, 0.19, 0.18, 48).translate(0, O + 0.09, 0), k),
    d = new S(
      new tt(0.085, 0.085, q - W + 0.1, 48, 1, !0).translate(0, (q + W) / 2, 0),
      Ht,
    ),
    p = new S(new tt(0.11, 0.1, 0.05, 48).translate(0, q + 0.07, 0), k);
  for (const u of [l, d, p]) u.position.set(j, 0, H);
  for (const u of [o, r, l, p])
    ((u.castShadow = u.receiveShadow = !0), y.add(u));
  y.add(d, a, c);
  const P = V.slice(qe).map((u) => u.p);
  for (const u of [-1, 1]) {
    const g = P.map((w, M) => {
        const h = P[Math.min(M + 1, P.length - 1)]
          .clone()
          .sub(P[Math.max(M - 1, 0)])
          .normalize();
        return w
          .clone()
          .add(new z(-h.z, 0, h.x).normalize().multiplyScalar(u * R * 0.95))
          .add(new z(0, -R * 0.55, 0));
      }),
      m = new S(new Qt(new Mt(g), 120, 0.007, 8), k);
    ((m.castShadow = !0), y.add(m));
  }
}
const Wt = new Ae();
Wt.position.set(j, 0, H);
{
  const t = (q - W) / oe,
    e = [];
  for (let a = 0; a <= t * 32; a++) {
    const r = (a / 32) * Math.PI * 2;
    e.push(new z(Math.cos(r) * 0.06, W + (a / 32) * oe, Math.sin(r) * 0.06));
  }
  const n = new S(new Qt(new Mt(e), Math.ceil(t * 40), 0.011, 6), k),
    o = new S(new tt(0.018, 0.018, q - W, 12).translate(0, (q + W) / 2, 0), pe);
  for (const a of [n, o]) ((a.castShadow = !0), Wt.add(a));
}
y.add(Wt);
function mo(t) {
  const e = document.createElement("canvas");
  ((e.width = 512), (e.height = 256));
  const n = e.getContext("2d"),
    o = n.createImageData(e.width, e.height),
    a = new U(t.colour),
    r = new U(t.band),
    s = new U();
  for (let c = 0; c < e.height; c++)
    for (let l = 0; l < e.width; l++) {
      const d = (l / e.width) * Math.PI * 2,
        p = c / e.height,
        P = Math.sin(d * 3 + p * 19) * 0.018 + Math.sin(d * 7 - p * 31) * 0.008,
        u = Math.sin((p + P) * 48 + Math.sin(p * 17) * 2),
        g = Math.sin((p + P * 0.5) * 210 + Math.sin(d * 5) * 2),
        m = X.smoothstep(u, -0.25, 0.8) * 0.65 + g * 0.045;
      s.copy(a)
        .lerp(r, X.clamp(m, 0, 1))
        .convertLinearToSRGB();
      const w = (c * e.width + l) * 4;
      ((o.data[w] = s.r * 255),
        (o.data[w + 1] = s.g * 255),
        (o.data[w + 2] = s.b * 255),
        (o.data[w + 3] = 255));
    }
  n.putImageData(o, 0, 0);
  const i = new ke(e);
  return ((i.colorSpace = Be), (i.wrapS = Bn), (i.anisotropy = 8), i);
}
const po = new Cn(R, 32, 16),
  fo = Dt(new gt({ color: "#ecc060", metalness: 1, roughness: 0.1 })),
  B = Fe.map((t) => {
    const e = t.steel
        ? fe
        : t.gold
          ? fo
          : new gt({
              map: mo(t),
              roughness: 0.25,
              clearcoat: 1,
              clearcoatRoughness: 0.03,
            }),
      n = new S(po, e);
    return (
      (n.castShadow = !0),
      y.add(n),
      { mesh: n, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, free: !1, s: 0 }
    );
  });
{
  const t = Co(+(D.get("seed") || 7));
  B.forEach((e, n) => {
    if (n < 7) {
      const o = 0.45 + t() * 1,
        a = t() * Math.PI * 2,
        r = At(o) * (0.85 + t() * 0.3);
      Object.assign(e, {
        free: !0,
        x: Math.cos(a) * o,
        z: Math.sin(a) * o,
        vx: -Math.sin(a) * r,
        vy: 0,
        vz: Math.cos(a) * r,
        y: Z(o),
      });
    } else e.s = (n - 7) * 0.6;
  });
}
const ct = 140,
  go = Fe.map((t) => (t.steel ? "#7d8590" : t.gold ? "#b8892e" : t.colour)),
  wo = B.map((t, e) => {
    const n = new Float32Array(ct * 3),
      o = new Float32Array(ct);
    for (let i = 0; i < ct; i++) o[i] = (1 - i / ct) ** 1.6;
    const a = new Rn();
    (a.setAttribute("position", new xe(n, 3).setUsage(Ln)),
      a.setAttribute("fade", new xe(o, 1)));
    const r = new ln({ transparent: !0, depthWrite: !1 });
    ((r.colorNode = I(new U(go[e]))), (r.opacityNode = un("fade").mul(ee)));
    const s = new In(a, r);
    return ((s.frustumCulled = !1), y.add(s), { line: s, pos: n, wasFree: !1 });
  });
function vo() {
  B.forEach((t, e) => {
    const n = wo[e],
      o = t.mesh.position;
    if (t.free && !n.wasFree)
      for (let a = 0; a < ct; a++) n.pos.set([o.x, o.y, o.z], a * 3);
    (n.pos.copyWithin(3, 0, (ct - 1) * 3),
      t.free && n.pos.set([o.x, o.y - R * 0.6, o.z], 0),
      (n.wasFree = t.free),
      (n.line.geometry.attributes.position.needsUpdate = !0),
      (n.line.visible = b.trails));
  });
}
function Qe() {
  const t = B.filter((e) => !e.free).sort((e, n) => n.s - e.s)[0];
  t && (t.s = ae);
}
const be = new An(),
  Pe = new Y(),
  se = (t) => {
    (Pe.set(
      (t.clientX / innerWidth) * 2 - 1,
      -(t.clientY / innerHeight) * 2 + 1,
    ),
      be.setFromCamera(Pe, A));
    const e = be.intersectObject(Xe)[0],
      n = e && Math.hypot(e.point.x, e.point.z);
    return e && n < f - R * 2 && n > 0.3 ? e.point : null;
  },
  at = new S(
    new tt(0.006, 0.006, 1, 8).translate(0, 0.5, 0).rotateX(Math.PI / 2),
    new En({ color: "#ffe2a0" }),
  );
at.visible = !1;
y.add(at);
let T = null;
const ft = C.domElement;
ft.addEventListener(
  "pointerdown",
  (t) => {
    const e = se(t);
    e &&
      ((L.enabled = !1),
      (T = { start: e, trail: [{ p: e, t: performance.now() }] }),
      ft.setPointerCapture(t.pointerId));
  },
  { capture: !0 },
);
ft.addEventListener("pointermove", (t) => {
  if (!T) {
    !wt && !t.buttons && (ft.style.cursor = se(t) ? "crosshair" : "");
    return;
  }
  const e = se(t);
  if (!e) return;
  (T.trail.push({ p: e, t: performance.now() }),
    T.trail.length > 8 && T.trail.shift());
  const n = e.clone().sub(T.start);
  ((at.visible = n.length() > 0.02),
    at.position.copy(T.start).setY(T.start.y + R),
    at.scale.set(1, 1, n.length()),
    at.lookAt(e.x, T.start.y + R, e.z));
});
addEventListener("pointerup", () => {
  if (!T) return;
  const t = T.trail[0],
    e = T.trail.at(-1),
    n = Math.max(0.03, (e.t - t.t) / 1e3),
    o = e.p.clone().sub(t.p).setY(0).divideScalar(n),
    { x: a, z: r } = T.start,
    s = Math.hypot(a, r),
    i = -r / s,
    c = a / s,
    l = At(s) * b.launch,
    d = o.x * i + o.z * c,
    p = (o.x * a + o.z * r) / s,
    P = d < -0.05 ? -1 : 1,
    u = o.length() < 0.05 ? 1 : X.clamp(Math.abs(d) / l, 0.9, 1.18),
    g = X.clamp(p, -0.25 * l, 0.25 * l),
    m =
      B.filter((w) => !w.free).sort((w, M) => w.s - M.s)[0] ??
      B.slice().sort((w, M) => Math.hypot(w.x, w.z) - Math.hypot(M.x, M.z))[0];
  (Object.assign(m, {
    free: !0,
    x: a,
    z: r,
    y: Z(s),
    vx: i * l * u * P + (a / s) * g,
    vy: 0,
    vz: c * l * u * P + (r / s) * g,
  }),
    (T = null),
    (at.visible = !1),
    (L.enabled = !0),
    (ft.style.cursor = ""));
});
addEventListener("resize", () => {
  C.setSize(innerWidth, innerHeight);
  const t = $t();
  ((A.aspect = innerWidth / innerHeight),
    A.updateProjectionMatrix(),
    A.position
      .sub(L.target)
      .multiplyScalar($t() / t)
      .add(L.target));
});
let lt = 60;
const yo = Ke(C),
  Ze = v.position.clone(),
  xo = Ze.distanceTo(v.target.position),
  Mo = Je(D, (t) => {
    (t
      ? v.position
          .set(...t.key)
          .normalize()
          .multiplyScalar(xo)
          .add(v.target.position)
      : v.position.copy(Ze),
      v.color.set(t?.keyColor ?? "#fff0dc"),
      (v.intensity = 165 * (t ? t.keyLevel / 4.4 : 1)),
      (v.shadow.radius = t?.soft ?? 9),
      pt.color.set(t?.fill ?? "#dce7fa"),
      (pt.intensity = 0.2 * (t ? t.env / 0.5 : 1)),
      y.background.set(t?.sweep ?? "#eeebe6"),
      ue.color.set(t?.sweep ?? "#f3f0eb"));
    const e = t ? yo(t) : Ot;
    ((y.environment = e), (y.environmentIntensity = t ? t.env * 0.4 : 0.2));
    for (const n of [k, pe, fe, xt]) n.envMap = e;
  });
function So() {
  return (
    Fn(() => ({
      Studio: Mo,
      fps: Nn(() => lt, { graph: !0, interval: 250 }),
      Marbles: K({
        gravity: {
          value: ot.gravity,
          min: 0.5,
          max: 6,
          step: 0.05,
          onChange: (t) => {
            ot.gravity = t;
          },
        },
        friction: {
          value: ot.friction,
          min: 0,
          max: 0.2,
          step: 0.002,
          label: "rolling friction",
          onChange: (t) => {
            ot.friction = t;
          },
        },
        "launch speed": {
          value: b.launch,
          min: 0.85,
          max: 1.15,
          step: 0.01,
          onChange: (t) => {
            b.launch = t;
          },
        },
        "keep it busy": {
          value: b.autoLaunch,
          onChange: (t) => {
            b.autoLaunch = t;
          },
        },
        "release a marble": Dn(() => Qe()),
      }),
      Light: K({
        key: {
          value: v.intensity,
          min: 0,
          max: 400,
          step: 1,
          label: "key light",
          onChange: (t) => {
            v.intensity = t;
          },
        },
        "key height": {
          value: v.position.y,
          min: 1,
          max: 9,
          step: 0.05,
          onChange: (t) => {
            v.position.y = t;
          },
        },
        "cool fill": {
          value: pt.intensity,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: (t) => {
            pt.intensity = t;
          },
        },
        "soft fill": {
          value: te.intensity,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: (t) => {
            te.intensity = t;
          },
        },
        "rim light": {
          value: It.intensity,
          min: 0,
          max: 4,
          step: 0.05,
          onChange: (t) => {
            It.intensity = t;
          },
        },
        "throat light": {
          value: Et.intensity,
          min: 0,
          max: 8,
          step: 0.1,
          onChange: (t) => {
            Et.intensity = t;
          },
        },
        background: {
          value: "#" + y.background.getHexString(),
          onChange: (t) => {
            (y.background.set(t), ue.color.set(t).offsetHSL(0, 0, 0.04));
          },
        },
        "stone reflections": {
          value: y.environmentIntensity,
          min: 0,
          max: 1.5,
          step: 0.01,
          onChange: (t) => {
            y.environmentIntensity = t;
          },
        },
        "gold reflections": {
          value: k.envMapIntensity,
          min: 0,
          max: 4,
          step: 0.05,
          onChange: (t) => {
            for (const e of [k, pe, fe, xt])
              e.envMapIntensity = t * (e === xt ? 0.53 : 1);
          },
        },
        exposure: {
          value: C.toneMappingExposure,
          min: 0.4,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            C.toneMappingExposure = t;
          },
        },
        bloom: { value: 0.1, min: 0, max: 2, step: 0.01, onChange: oo },
      }),
      Engraving: K({
        gold: {
          value: Ft,
          onChange: (t) => {
            (je.value.set(t), k.color.set(t));
          },
        },
        "cut depth": {
          value: ne.value,
          min: 0,
          max: 0.03,
          step: 5e-4,
          onChange: (t) => {
            ne.value = t;
          },
        },
        visible: {
          value: 1,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            me.value = t;
          },
        },
      }),
      Lens: K({
        "depth of field": {
          value: b.dof,
          onChange: (t, e, n) => {
            n.initial || no(t);
          },
        },
        blur: {
          value: Lt.value,
          min: 0,
          max: 4,
          step: 0.05,
          onChange: (t) => {
            Lt.value = t;
          },
        },
        "focus range": {
          value: Rt.value,
          min: 0.5,
          max: 8,
          step: 0.1,
          onChange: (t) => {
            Rt.value = t;
          },
        },
        "colour grade": {
          value: Kt.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            Kt.value = t;
          },
        },
        vignette: {
          value: Jt.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            Jt.value = t;
          },
        },
      }),
      Trails: K({
        show: {
          value: b.trails,
          onChange: (t) => {
            b.trails = t;
          },
        },
        strength: {
          value: ee.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: (t) => {
            ee.value = t;
          },
        },
      }),
      Camera: K({
        "auto rotate": {
          value: L.autoRotate,
          onChange: (t) => {
            L.autoRotate = t;
          },
        },
        "rotate speed": {
          value: L.autoRotateSpeed,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: (t) => {
            L.autoRotateSpeed = t;
          },
        },
      }),
      Performance: K(
        {
          "auto resolution": {
            value: b.autoRes,
            onChange: (t) => {
              b.autoRes = t;
            },
          },
          resolution: {
            value: C.getPixelRatio(),
            min: 0.5,
            max: 2,
            step: 0.05,
            onChange: (t, e, n) => {
              n.initial || ((b.autoRes = !1), C.setPixelRatio(t));
            },
          },
          shadows: {
            value: !0,
            onChange: (t) => {
              v.castShadow = t;
            },
          },
        },
        { collapsed: !0 },
      ),
      ...Wn({ renderer: C, pipeline: mt, lights: [v], pcss: [ao] }),
    })),
    null
  );
}
!D.has("still") &&
  !wt &&
  !$ &&
  Tn.createRoot(document.querySelector("#controls")).render(
    bt.createElement(
      bt.Fragment,
      null,
      bt.createElement(kn, { collapsed: !0, titleBar: { title: "Controls" } }),
      bt.createElement(So),
    ),
  );
const zo = new On(),
  bo = new z(),
  Xt = new z();
let Ce = performance.now(),
  Re = 4,
  Yt = 0,
  Ct = 0,
  Po = 0;
function $e(t, e) {
  const o = t / 4;
  for (let r = 0; r < 4; r++) {
    for (const i of B)
      i.free &&
        Qn(i, o) &&
        ((i.free = !1), (i.s = 0), (i.from = i.mesh.position.clone()));
    const s = B.filter((i) => i.free);
    for (let i = 0; i < s.length; i++)
      for (let c = i + 1; c < s.length; c++) $n(s[i], s[c]);
  }
  for (const r of B)
    if (r.free) {
      (Xt.copy(r.mesh.position), (Zn(r, r.mesh.position).y += _));
      const s = r.mesh.position.x - Xt.x,
        i = r.mesh.position.z - Xt.z,
        c = Math.hypot(s, i);
      (c > 1e-6 &&
        c < 0.3 &&
        r.mesh.quaternion.premultiply(
          zo.setFromAxisAngle(bo.set(i, 0, -s).normalize(), c / R),
        ),
        (r.mesh.visible = !0));
    }
  let a = 1 / 0;
  for (const r of B.filter((s) => !s.free).sort((s, i) => i.s - s.s)) {
    if (
      ((r.s = Math.min(r.s + ze(r.s).speed * t, a - R * 2.3, ae)),
      (a = r.s),
      r.s >= ae &&
        B.every((s) => !s.free || Math.hypot(s.x - J.x, s.z - J.z) > R * 3))
    ) {
      const s = Math.hypot(J.x, J.z),
        i = At(s) * b.launch * (0.88 + Math.random() * 0.22);
      (Object.assign(r, {
        free: !0,
        x: J.x,
        z: J.z,
        y: Z(s),
        vx: Se.x * i,
        vy: 0,
        vz: Se.z * i,
      }),
        (a = 1 / 0));
      continue;
    }
    if ((r.mesh.position.copy(ze(r.s).p), r.from && r.s < 0.3)) {
      const s = r.s / 0.3;
      r.mesh.position.lerpVectors(r.from, r.mesh.position, s * s * (3 - 2 * s));
    }
    r.mesh.visible = !0;
  }
  ((Wt.rotation.y -= ((t * _e) / oe) * Math.PI * 2),
    b.autoLaunch &&
      (Re -= t) < 0 &&
      ((Re = 5 + Math.random() * 4),
      B.filter((r) => r.free).length < 5 && Qe()),
    Po++ % 2 === 0 && vo(),
    (Ne.value = A.position.distanceTo(L.target)));
}
C.setAnimationLoop(() => {
  const t = performance.now(),
    e = (t - Ce) / 1e3;
  if (((Ce = t), Yt++, (Ct += e), Ct > 1)) {
    if (((lt = Yt / Ct), b.autoRes)) {
      const n = C.getPixelRatio(),
        o = Math.min(b.maxRes, wt ? 0.75 : 1);
      lt < 57 && n > o
        ? C.setPixelRatio(Math.max(o, n - (lt < 45 ? 0.2 : 0.1)))
        : lt > 59.5 &&
          n < b.maxRes &&
          C.setPixelRatio(Math.min(b.maxRes, n + 0.05));
    }
    ((Yt = 0), (Ct = 0));
  }
  ($e(Math.min(0.05, e)), L.update(), mt.render());
});
if ($) {
  ((b.autoLaunch = !1), C.setAnimationLoop(null), (Lt.value = 1.1));
  const t = () => {
    $e(1 / jt);
  };
  for (let s = 0; s < Un * jt; s++) t();
  const e = () => {
      const i = B.filter((d) => d.free && Math.hypot(d.x, d.z) > 0.5).sort(
        (d, p) =>
          Math.hypot(d.x - L.target.x, d.z - L.target.z) -
          Math.hypot(p.x - L.target.x, p.z - L.target.z),
      )[0];
      if (!i) return;
      const c = Math.hypot(i.vx, i.vz) || 1,
        l = (At(Math.hypot(i.x, i.z)) * 0.3) / c;
      ((i.vx *= l), (i.vz *= l));
    },
    n = +D.get("frames"),
    o = +(D.get("every") || 1),
    a = D.get("port"),
    r = async (s) => {
      const i = await new Promise((c) => ft.toBlob(c, "image/png"));
      await fetch(`http://localhost:${a}/frame?i=${s}`, {
        method: "POST",
        body: i,
      });
    };
  for (let s = 0, i = 0; s < n; s++) {
    const c = s / jt,
      l = Yn(c, A.aspect);
    (A.position.copy(l.position),
      L.target.copy(l.target),
      (A.fov = l.fov),
      A.updateProjectionMatrix(),
      A.lookAt(l.target),
      (Rt.value = Math.max(1.8, l.position.distanceTo(l.target) * 0.55)),
      (We.value = _n(c)),
      (Ve.value = qn(c)));
    for (const d of jn) !d.done && c >= d.t && ((d.done = !0), d.drop && e());
    (t(),
      mt.render(),
      await C.backend.device.queue.onSubmittedWorkDone(),
      s % o === 0 && (await r(i++)));
  }
  await fetch(`http://localhost:${a}/done`);
}
document.body.classList.add("ready");
window.orrery = { marbles: B, fps: () => lt };
function Co(t) {
  return () => {
    t = (t + 1831565813) | 0;
    let e = Math.imul(t ^ (t >>> 15), 1 | t);
    return (
      (e = (e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ e),
      ((e ^ (e >>> 14)) >>> 0) / 4294967296
    );
  };
}
