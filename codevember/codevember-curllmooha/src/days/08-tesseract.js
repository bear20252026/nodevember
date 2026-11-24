import "../lib/modulepreload-polyfill.js";
import { s as ye } from "../lib/studio-presets.js";
import {
  aj as Me,
  u as s,
  x as Pe,
  B as n,
  H as c,
  y as o,
  b as j,
  m as g,
  J as zt,
  Q as P,
  af as m,
  E as l,
  F as Ce,
  n as ot,
  O as Te,
  Y as Ve,
  N as Be,
  g as R,
  T as Tt,
  am as q,
  s as w,
  ap as Le,
  q as Vt,
  r as Se,
  A as G,
  a2 as Fe,
  a0 as Re,
  I as Bt,
  aw as Ae,
} from "../lib/stage.js";
import { O as Ne } from "../lib/OrbitControls.js";
import {
  N as Ee,
  aH as ze,
  aX as Ie,
  S as je,
  P as ke,
  V as Q,
  C as S,
  M as It,
  a as De,
  b1 as Oe,
  c as Ue,
  r as H,
  L as qe,
  e as L,
  u as Ge,
  b5 as at,
} from "../lib/leva.js";
import { r as He } from "../lib/rendering-panel.js";
import "../lib/three.js";
const d = new URLSearchParams(location.search),
  C = d.has("thumb"),
  pt = matchMedia("(prefers-reduced-motion: reduce)").matches,
  Lt = Number(d.get("t")),
  St = d.has("t") && Number.isFinite(Lt) ? Lt : C ? 1.2 : null;
C && document.body.classList.add("capture");
d.get("view") === "tunnel" && document.body.classList.add("tunnel");
const x = await Me({ shadows: !1, exposure: 0.92 }),
  We = { agx: Ie, aces: ze, neutral: Ee }[d.get("tm") || "neutral"];
x.toneMapping = We;
const Y = new je(),
  r = new ke(36, 1, 0.08, 80),
  jt = new Q(1.85, 1.48, 5.55),
  kt = new Q(0.025, 0.025, 2.94),
  ht = d.get("view") === "tunnel";
r.position.copy(ht ? kt : jt);
const u = new Ne(r, x.domElement);
u.enableDamping = !0;
u.enablePan = !1;
u.minDistance = 2.45;
u.maxDistance = 9;
u.minPolarAngle = 0.22;
u.maxPolarAngle = Math.PI * 0.498;
u.autoRotateSpeed = 0.23;
u.update();
const B = s(0),
  lt = s(1),
  A = s(new S("#168bff")),
  Dt = s(new S(0.008, 0.018, 0.047)),
  X = s(new S(0.32, 0.82, 1.65)),
  N = s(new S("#168bff")),
  _ = s(new S(0.32, 0.82, 1.65)),
  k = s(1),
  Ot = s(0),
  Ut = s(0),
  ut = s(0),
  it = s(1.32),
  ct = s(0.37),
  rt = s(1.2),
  ft = {
    Blue: {
      tint: "#168bff",
      tint2: "#168bff",
      deep: [0.008, 0.018, 0.047],
      glint: [0.32, 0.82, 1.65],
      glint2: [0.32, 0.82, 1.65],
    },
    Club: {
      tint: "#2f7bff",
      tint2: "#ff2aa6",
      deep: [0.014, 0.008, 0.042],
      glint: [0.3, 0.62, 1.9],
      glint2: [1.9, 0.34, 1.1],
    },
  };
function qt(t) {
  const e = ft[t];
  (A.value.set(e.tint),
    N.value.set(e.tint2),
    Dt.value.setRGB(...e.deep),
    X.value.setRGB(...e.glint),
    _.value.setRGB(...e.glint2));
}
const Gt = ft[d.get("palette")] ? d.get("palette") : "Blue";
qt(Gt);
const $ = d.get("backdrop") !== "studio";
k.value = $ ? 1 : 0;
document.body.classList.toggle("night", $);
const p = { speed: pt ? 0 : 1, view: ht ? "Tunnel" : "Cube", spiral: 1 },
  dt = s(new Q(1.4, 1.47, 1.56)),
  Ht = s(new Q(-0.55, 0.82, 0.48).normalize()),
  Wt = s(new S(16777215)),
  Xt = s(1),
  E = Pe.sub(n(0.5, 0.45)).mul(n(lt, 1)),
  Xe = dt.add(c(o(E, E).mul(-1.7)).mul(0.26)),
  _e = c(o(E.sub(n(-0.55, 0.05)), E.sub(n(-0.55, 0.05))).mul(-2.2)),
  Je = c(o(E.sub(n(0.55, 0.05)), E.sub(n(0.55, 0.05))).mul(-2.2)),
  Qe = j(0.006, 0.008, 0.02)
    .add(A.mul(_e).mul(0.045))
    .add(N.mul(Je).mul(0.045)),
  _t = g(Xe, Qe, k);
Y.backgroundNode = _t;
const Jt = new zt(),
  D = P.xz,
  Ft = m(l(D).sub(0.94), n(0)),
  Ye = c(o(Ft, Ft).mul(-16)).mul(0.66),
  Rt = c(o(D.sub(n(0.2, 0.05)), D.sub(n(0.2, 0.05))).mul(-0.48)),
  $e = c(o(D.sub(n(-0.7, -0.4)), D.sub(n(-0.7, -0.4))).mul(-0.5));
Jt.colorNode = _t
  .mul(Ye.add(Rt.mul(0.17)).oneMinus())
  .add(A.mul(Rt).mul(g(0.12, 0.34, k)))
  .add(N.mul($e).mul(k.mul(0.26)));
const gt = new It(new De(160, 160), Jt);
gt.rotation.x = -Math.PI / 2;
gt.position.y = -1.02;
Y.add(gt);
const Ke = Ce(() => {
    const t = ot(Te),
      e = ot(P.sub(Ve)),
      a = Be(e, t, R(1).div(it)),
      f = l(t.y)
        .lessThan(0.5)
        .select(j(0, 1, 0), j(0, 0, -1)),
      F = ot(Tt(f, t)),
      O = Tt(t, F),
      y = n(o(P, F), o(P, O)).toVar(),
      T = n(o(a, F), o(a, O))
        .div(m(o(a, t).negate(), 0.06))
        .add(y.mul(0.19))
        .toVar(),
      bt = n(q(y.x), q(y.y)).toVar(),
      vt = n(q(T.x), q(T.y)).toVar(),
      K = m(l(y.x), l(y.y)),
      Kt = w(0.85, 0.91, K).oneMinus(),
      Z = j(Dt).toVar(),
      U = 0.86,
      b = 0.785,
      Zt = (M, i) =>
        n(M.x.mul(Bt(i)).sub(M.y.mul(G(i))), M.x.mul(G(i)).add(M.y.mul(Bt(i))));
    Le(27, ({ i: M }) => {
      const i = R(M).sub(Vt(Ot.mul(0.11))),
        z = m(i.sub(11), 0),
        v = m(i, 0).mul(0.43).add(z.mul(z).mul(0.105)).add(0.19),
        et = w(0, 0.85, i).mul(R(1).sub(w(24, 26.5, i))),
        yt = y.add(T.mul(v)).toVar(),
        Mt = Se(yt.add(U).div(U * 2)),
        re = l(
          Vt(yt.div(U * 4).add(0.25))
            .mul(4)
            .sub(2),
        )
          .sub(1)
          .mul(U),
        Pt = Zt(re, v.mul(ut)).toVar(),
        de = l(Mt.x).add(l(Mt.y)),
        me = ct
          .pow(de)
          .mul(c(v.mul(-0.13)))
          .mul(et)
          .toVar(),
        pe = m(l(Pt.x), l(Pt.y)),
        Ct = l(pe.sub(b)),
        he = m(bt.x, bt.y).add(m(vt.x, vt.y).mul(v)),
        nt = m(he.mul(0.62), 0.0085),
        fe = w(nt.mul(0.35), nt.mul(1.6), Ct)
          .oneMinus()
          .mul(R(0.012).div(m(nt, 0.012))),
        ge = c(Ct.mul(-45)).mul(0.1),
        st = G(v.mul(3.2).sub(B.mul(2.4)))
          .mul(0.5)
          .add(0.5)
          .pow(3),
        be = g(A.mul(1.65), X, st.mul(0.66).add(0.2)),
        ve = g(N.mul(1.65), _, st.mul(0.66).add(0.2)),
        we = w(
          0.3,
          0.7,
          G(v.mul(0.85).sub(B.mul(0.55)))
            .mul(0.5)
            .add(0.5),
        ),
        xe = g(be, ve, we);
      Z.addAssign(
        xe.mul(fe.mul(1.65).add(ge)).mul(me).mul(st.mul(0.54).add(0.72)),
      );
    });
    const te = R(1).sub(w(0, 0.05, l(ut))),
      ee = [n(b, b), n(-b, b), n(b, -b), n(-b, -b)];
    for (const [M, i] of ee.entries()) {
      const z = o(i.sub(y), T)
          .div(m(o(T, T), 1e-5))
          .clamp(0, 28),
        v = y.add(T.mul(z)).sub(i),
        et = c(o(v, v).mul(-4300))
          .mul(c(z.mul(-0.15)))
          .mul(te);
      Z.addAssign(
        g(g(A, X, 0.28), g(N, _, 0.28), M % 2)
          .mul(et)
          .mul(1.35),
      );
    }
    const ne = P.sub(t.mul(0.23)).add(a.mul(0.44)),
      se = j(B.mul(0.036), B.mul(-0.027), B.mul(0.024)),
      tt = Fe(ne.mul(4.2).add(se)).mul(0.5).add(0.5),
      oe = c(l(tt.sub(0.48)).mul(-47)),
      wt = g(
        A,
        N,
        w(-0.7, 0.7, P.x.mul(0.8).add(P.y.mul(0.55)).sub(P.z.mul(0.2))),
      ),
      ae = wt.mul(tt.mul(tt).mul(0.24).add(oe.mul(0.045))),
      le = w(0.95, 1, K),
      ue = c(l(K.sub(0.878)).mul(-105)),
      xt = l(o(e, t)).oneMinus().pow(4).mul(0.9).add(0.045),
      ie = Re(e, t),
      ce = w(R(1).sub(Xt.mul(0.09)), 0.995, o(ie, Ht));
    return ae
      .add(
        Z.mul(Kt)
          .mul(rt.mul(Ut.mul(0.6).add(1)))
          .mul(xt.oneMinus()),
      )
      .add(wt.mul(le.mul(0.32).add(ue.mul(0.47))))
      .add(g(X, _, 0.5).mul(0.5).add(0.12).mul(ce).mul(Wt).mul(xt).mul(0.95));
  })(),
  Qt = new zt();
Qt.colorNode = Ke;
Y.add(new It(new Oe(2, 2, 2), Qt));
const J = Ae(x, Y, r, {
    aoStrength: 0,
    bloomStrength: 0.2,
    vignette: 0,
    grain: 0,
  }),
  Ze = { strength: 0.62, threshold: 0.9 },
  tn = { strength: 0.2, threshold: 2.3 };
function Yt(t) {
  ((k.value = t ? 1 : 0), document.body.classList.toggle("night", t));
  const e = t ? Ze : tn;
  ((J.bloom.strength.value = e.strength),
    (J.bloom.threshold.value = e.threshold));
}
Yt($);
let mt = 18;
function $t() {
  const t = C ? 1e3 : innerWidth,
    e = C ? 1e3 : innerHeight;
  ((lt.value = t / e), (r.aspect = lt.value));
  const a = L.degToRad(C ? 16 : 18);
  ((mt = L.radToDeg(2 * Math.atan(Math.tan(a) / Math.min(1, r.aspect)))),
    (r.fov = mt),
    r.updateProjectionMatrix(),
    x.setPixelRatio(C ? 1 : Math.min(devicePixelRatio, 1.5)),
    x.setSize(t, e));
}
addEventListener("resize", $t);
$t();
let V;
const At = new at();
function en(t) {
  if (t === p.view) return;
  ((p.view = t), document.body.classList.toggle("tunnel", t === "Tunnel"));
  const e = t === "Tunnel" ? kt : jt;
  if (pt) {
    (r.position.copy(e), u.update());
    return;
  }
  const a = new at().setFromVector3(r.position),
    h = new at().setFromVector3(e),
    f = L.euclideanModulo(h.theta - a.theta + Math.PI, 2 * Math.PI) - Math.PI;
  ((V = { origin: a, end: h, turn: f, elapsed: 0 }), (u.enabled = !1));
}
const nn = ye(d, (t) => {
  (Ht.value.set(...(t?.key ?? [-0.55, 0.82, 0.48])).normalize(),
    Wt.value
      .set(t?.keyColor ?? 16777215)
      .multiplyScalar(t ? t.keyLevel / 4.4 : 1),
    (Xt.value = t ? Math.sqrt(t.soft / 4) : 1),
    t
      ? dt.value.fromArray(new S(t.sweep).toArray()).multiplyScalar(2.55)
      : dt.value.set(1.4, 1.47, 1.56));
});
function sn() {
  return (
    Ge({
      Studio: nn,
      View: { value: p.view, options: ["Cube", "Tunnel"], onChange: en },
      "Light speed": {
        value: p.speed,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (t) => {
          p.speed = t;
        },
      },
      Spiral: {
        value: p.spiral,
        min: 0,
        max: 1.5,
        step: 0.01,
        onChange: (t) => {
          p.spiral = t;
        },
      },
      "Tunnel light": {
        value: rt.value,
        min: 0,
        max: 2.5,
        step: 0.01,
        onChange: (t) => {
          rt.value = t;
        },
      },
      Reflections: {
        value: ct.value,
        min: 0.04,
        max: 0.85,
        step: 0.01,
        onChange: (t) => {
          ct.value = t;
        },
      },
      Refraction: {
        value: it.value,
        min: 1.06,
        max: 1.65,
        step: 0.01,
        onChange: (t) => {
          it.value = t;
        },
      },
      Backdrop: {
        value: $ ? "Night" : "Studio",
        options: ["Night", "Studio"],
        onChange: (t) => Yt(t === "Night"),
      },
      Palette: { value: Gt, options: Object.keys(ft), onChange: qt },
      ...He({ renderer: x, pipeline: J }),
    }),
    null
  );
}
if (!C) {
  const t = document.createElement("div");
  (document.body.append(t),
    Ue.createRoot(t).render(
      H.createElement(
        H.Fragment,
        null,
        H.createElement(qe, {
          collapsed: !0,
          titleBar: { title: "Tesseract" },
        }),
        H.createElement(sn),
      ),
    ));
}
let W = 0,
  Nt = 0,
  I = pt ? 0 : ht ? 1 : 0,
  Et = performance.now();
x.setAnimationLoop((t) => {
  const e = Math.min((t - Et) / 1e3, 0.05);
  ((Et = t),
    (W += e * p.speed),
    (B.value = St ?? W),
    (ut.value = 0.02 * p.spiral * Math.sin(B.value * 0.19)));
  let a = 0;
  if (V) {
    V.elapsed += e;
    const h = L.smootherstep(V.elapsed, 0, 1.8);
    a = Math.sin(Math.PI * h);
    const { origin: f, end: F, turn: O } = V;
    (At.set(
      L.lerp(f.radius, F.radius, h),
      L.lerp(f.phi, F.phi, h),
      f.theta + O * h,
    ),
      r.position.setFromSpherical(At),
      V.elapsed >= 1.8 && ((V = void 0), (u.enabled = !0)));
  }
  if (
    ((I = L.damp(I, p.view === "Tunnel" ? 1 : 0, 2.2, e)),
    (Nt += e * p.speed * (0.85 + 0.9 * I + 7 * a * a)),
    (Ot.value = St ?? Nt),
    (Ut.value = a),
    (r.fov = mt * (1 + 0.85 * a)),
    r.updateProjectionMatrix(),
    u.target.set(
      0.055 * Math.sin(W * 0.43) * I,
      0.045 * Math.cos(W * 0.37) * I,
      0,
    ),
    u.update(e),
    J.render(),
    C && (x.setAnimationLoop(null), d.has("port")))
  ) {
    const h = Number(d.get("port"));
    x.domElement.toBlob(
      (f) => {
        f &&
          fetch(`http://localhost:${h}/`, { method: "POST", body: f }).catch(
            console.error,
          );
      },
      "image/jpeg",
      0.94,
    );
  }
});
