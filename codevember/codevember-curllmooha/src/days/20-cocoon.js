import "../lib/modulepreload-polyfill.js";
import { r as Ce } from "../lib/erode.js";
import {
  V as p,
  a3 as ee,
  Y as j,
  X as Re,
  b3 as ze,
  O as Ee,
  a0 as Pe,
  M as G,
  B as N,
  F as O,
  $ as ce,
  t as H,
  ar as te,
  bd as Fe,
  aH as We,
  S as ke,
  P as De,
  H as Ie,
  D as Ve,
  o as Be,
  C as pe,
  eU as Ge,
  aq as He,
  af as je,
  d as Te,
  b as qe,
  f as me,
  c as Oe,
  r as X,
  L as Ye,
  a as Ke,
  aQ as Ue,
  m as Xe,
  aO as Ne,
  aU as Qe,
  e as Ze,
  u as $e,
  g as le,
  aF as he,
} from "../lib/leva.js";
import { W as Je } from "../lib/three.js";
import { O as _e } from "../lib/OrbitControls.js";
const et = new p(-3.2, 3, 2.6).normalize(),
  Q = (e, n) =>
    n.R *
    Math.pow(Math.max(0, 1 - Math.pow(Math.abs(e), 2.2)), 1 / 2.2) *
    (1 - n.waist * Math.exp((-e * e) / 0.06)),
  tt = (e) => ((e = Math.min(1, Math.max(0, e))), e * e * (3 - 2 * e));
function at(e, n, a, r) {
  const t = new Float32Array(a * 3),
    o = new Float32Array(a),
    c = new Float32Array(a),
    s = new p(n() - 0.5, n() - 0.5, n() - 0.5).normalize(),
    i = new p(),
    u = new p(),
    d = new p();
  i.set(n() - 0.5, n() - 0.5, n() - 0.5)
    .cross(s)
    .normalize();
  let C = 0;
  const R = 0.32 + n() * 0.15;
  for (let m = 0; m < a; m++) {
    const S = 1 - tt(m / a / 0.2),
      L = (0.035 + 0.05 * S) * 0.8;
    C += R;
    const w = Math.sin(C) * (0.6 - 0.25 * S) + (n() - 0.5) * 0.5;
    (u.crossVectors(s, i),
      i.multiplyScalar(Math.cos(w)).addScaledVector(u, Math.sin(w)),
      u.copy(s),
      s.multiplyScalar(Math.cos(L)).addScaledVector(i, Math.sin(L)).normalize(),
      i.multiplyScalar(Math.cos(L)).addScaledVector(u, -Math.sin(L)),
      i.addScaledVector(s, -i.dot(s)).normalize());
    const k =
        1.012 +
        0.01 * Math.sin(m * 0.7) +
        S *
          (0.04 +
            0.14 *
              (0.5 +
                0.5 * Math.sin(m * 0.011 + e.R * 40) * Math.sin(m * 0.0043))),
      P = s.y,
      D = Math.hypot(s.x, s.z) || 1e-6,
      I = Q(P, e) * k,
      V = (s.x / D) * I,
      T = P * e.L * (1 + (k - 1) * 0.5),
      l = (s.z / D) * I;
    (t.set([V, T, l], m * 3),
      d
        .set(V / (e.R * e.R), T / (e.L * e.L), l / (e.R * e.R))
        .normalize()
        .applyQuaternion(r.quaternion),
      (o[m] =
        (0.3 + 0.7 * Math.max(0, d.dot(et) * 0.65 + 0.35)) *
        (0.75 + 0.5 * n())),
      (c[m] = 0.4 + 0.6 * (1 - S)));
  }
  const v = new N();
  return (
    v.setAttribute("position", new H(t, 3)),
    v.setAttribute("shade", new H(o, 1)),
    v.setAttribute("lit", new H(c, 1)),
    v
  );
}
function nt(e) {
  const n = new te(1, 128, 96),
    a = n.attributes.position;
  for (let r = 0; r < a.count; r++) {
    const t = a.getY(r),
      o = Math.atan2(a.getZ(r), a.getX(r)),
      c = Q(t, e);
    a.setXYZ(r, Math.cos(o) * c, t * e.L, Math.sin(o) * c);
  }
  return (n.computeVertexNormals(), n);
}
function ot() {
  const e = new p(0, 2.7, 0),
    n = new ee();
  n.position.copy(e);
  const a = [],
    r = { count: 4 },
    t = Ce(2020),
    o = new j({ color: 16118508, roughness: 0.95, emissive: 2433824 }),
    c = new Re({
      color: 16118508,
      transparent: !0,
      opacity: 0.38,
      depthWrite: !1,
    }),
    s = c.clone();
  s.opacity = 0.32;
  const i = [];
  for (let l = 0; i.length < r.count && l < 500; l++) {
    const h = 0.21 + t() * 0.05,
      b = new p((t() - 0.5) * 0.8, 0.95 + t() * 0.95, (t() - 0.5) * 0.5);
    if (i.some((M) => M.at.distanceTo(b) < (M.R + h) * 1.15)) continue;
    const A = 1.3;
    i.push({
      R: h,
      L: h * (1.65 + t() * 0.2),
      waist: 0.03 + t() * 0.05,
      at: b,
      rot: new ze((t() - 0.5) * A, t() * 6.28, (t() - 0.5) * A),
    });
  }
  const u = Math.max(...i.map((l) => l.at.y + l.L * 0.8));
  for (const l of i) {
    const h = new Ee();
    (h.position.copy(l.at).sub(e),
      h.rotation.copy(l.rot),
      n.add(h),
      h.updateWorldMatrix(!0, !1));
    const b = Math.round(4e4 * (l.R / 0.36) ** 1.5 * 1.6),
      A = new Pe(at(l, t, b, h), c);
    A.frustumCulled = !1;
    const M = new G(nt(l), o);
    ((M.castShadow = M.receiveShadow = !0),
      h.add(M, A),
      a.push({ ...l, obj: h }),
      t());
  }
  const d = 20,
    C = 70 * a.length + 40,
    R = new Float32Array(C * d * 2 * 3),
    v = new Float32Array(C * d * 2),
    m = new Float32Array(C * d * 2),
    S = new p(),
    L = new p(),
    w = new p(),
    k = new p();
  let P = 0;
  for (let l = 0; l < C; l++) {
    const h = a[l % a.length],
      b = 0.05 + t() * 0.9,
      A = t() * 6.283,
      M = 1.03 + t() * 0.06;
    if (
      (L.set(Math.cos(A) * Q(b, h) * M, b * h.L, Math.sin(A) * Q(b, h) * M),
      h.obj.localToWorld(L),
      t() < 0.7 || a.length === 1)
    )
      S.set((t() - 0.5) * 0.04, u + t() * (e.y - u) * 0.7, (t() - 0.5) * 0.04);
    else {
      const B = a[(t() * a.length) | 0];
      (S.set(t() - 0.5, t() * 0.8, t() - 0.5)
        .normalize()
        .multiplyScalar(B.R),
        B.obj.localToWorld(S));
    }
    const Se = 0.03 + t() * 0.12,
      Ae = new p(t() - 0.5, 0, t() - 0.5).multiplyScalar(0.15),
      re = t() * 9,
      Le = 0.5 + 0.5 * t();
    for (let B = 0; B <= d; B++) {
      const q = B / d,
        ie = 4 * q * (1 - q);
      (w
        .lerpVectors(S, L, q)
        .addScaledVector(Ae, ie)
        .add(
          new p(
            Math.sin(q * 13 + re) * 0.008,
            -Se * ie,
            Math.cos(q * 11 + re) * 0.008,
          ),
        )
        .sub(e),
        B &&
          (R.set([k.x, k.y, k.z, w.x, w.y, w.z], P * 3),
          (v[P] = v[P + 1] = Le),
          (m[P] = m[P + 1] = 0.15),
          (P += 2)),
        k.copy(w));
    }
  }
  const D = [];
  for (let l = 0; l < 3; l++)
    for (let h = 0; h < 40; h++) {
      const b = u - e.y + h * 0.3,
        A = b + 0.3,
        M = l * 2.1;
      D.push(
        Math.sin(b * 9 + M) * 0.004,
        b,
        Math.cos(b * 9 + M) * 0.004,
        Math.sin(A * 9 + M) * 0.004,
        A,
        Math.cos(A * 9 + M) * 0.004,
      );
    }
  const I = new N();
  (I.setAttribute("position", new O(D, 3)),
    I.setAttribute("shade", new O(new Array(D.length / 3).fill(1.1), 1)),
    I.setAttribute("lit", new O(new Array(D.length / 3).fill(0), 1)),
    n.add(new ce(I, c)));
  const V = new N();
  (V.setAttribute("position", new H(R, 3)),
    V.setAttribute("shade", new H(v, 1)),
    V.setAttribute("lit", new H(m, 1)));
  const T = new ce(V, s);
  return ((T.frustumCulled = !1), n.add(T), n);
}
const y = new Je({ antialias: !0, alpha: !0 });
y.setPixelRatio(Math.min(devicePixelRatio, 2));
y.shadowMap.enabled = !0;
y.shadowMap.type = Fe;
y.toneMapping = We;
y.domElement.id = "view";
document.body.prepend(y.domElement);
y.domElement.setAttribute(
  "aria-label",
  "Folded veneer pendant. Drag to orbit and scroll to zoom.",
);
const F = new ke(),
  W = new De(29, 1, 0.03, 40),
  x = new _e(W, y.domElement);
x.enableDamping = !0;
x.enablePan = !1;
x.minAzimuthAngle = -2.73;
x.maxAzimuthAngle = -1.91;
x.minPolarAngle = 1.19;
x.maxPolarAngle = 1.64;
x.rotateSpeed = 0.46;
x.minDistance = 4.3;
x.maxDistance = 6.6;
const K = new ee();
F.add(K);
F.add(new Ie(16774633, 6444364, 0.26));
const we = new Ve(16772833, 0.78);
we.position.set(-3, 3, -2);
F.add(we);
const f = new Be(16753964, 0, 12);
f.position.y = 0.36;
F.add(f);
F.background = new pe(1117970);
F.fog = new Ge(1117970, 0.072);
f.castShadow = !0;
f.shadow.mapSize.set(768, 768);
f.shadow.camera.near = 0.04;
f.shadow.camera.far = 12;
f.shadow.bias = -35e-5;
const fe = new j({ color: 6248020, roughness: 1 });
function ae(e, n) {
  const a = new G(new Ke(28, 28), fe);
  (a.rotation.set(...e),
    a.position.set(...n),
    (a.receiveShadow = !0),
    F.add(a));
}
ae([-Math.PI / 2, 0, 0], [0, -1.52, 0]);
ae([0, Math.PI, 0], [0, 0, 2.6]);
ae([0, -Math.PI / 2, 0], [3.3, 0, 0]);
function st() {
  const e = document.createElement("canvas");
  ((e.width = 768), (e.height = 160));
  const n = e.getContext("2d"),
    a = n.createImageData(e.width, e.height);
  for (let t = 0; t < e.height; t++)
    for (let o = 0; o < e.width; o++) {
      const c =
          t + 24e-6 * (o - 390) ** 2 + 2.1 * Math.sin(o * 0.008 + t * 0.021),
        s =
          0.045 * Math.sin(c * 2.8) +
          0.055 * Math.sin(c * 0.53) +
          0.04 * Math.sin(c * 0.17) +
          0.035 * Math.cos(o * 0.012 + c * 0.075),
        i = [184, 153, 118],
        u = (t * e.width + o) * 4;
      for (let d = 0; d < 3; d++) a.data[u + d] = i[d] * (1 + 0.58 * s);
      a.data[u + 3] = 255;
    }
  n.putImageData(a, 0, 0);
  const r = new Ue(e);
  return (
    (r.colorSpace = Xe),
    (r.anisotropy = Math.min(8, y.capabilities.getMaxAnisotropy())),
    r
  );
}
const Me = st(),
  E = {
    count: 19,
    sweep: 5.45,
    width: 0.82,
    twist: 0.14,
    arch: 1,
    travel: 1.9,
    period: 9,
    phase: 0,
  },
  z = { speed: 1, amplitude: 1, camera: !0, brightness: 1, light: "Warm" };
let J = 0;
function rt(e, n, a) {
  const r = [],
    t = [],
    o = [],
    c = 0.94 + 0.24 * Math.cos(e) + 0.14 * Math.cos(2 * e);
  for (let i = 0; i <= 96; i++) {
    const u = i / 96,
      d = Math.PI * u,
      C = Math.sin(d);
    for (let R = 0; R <= 6; R++) {
      const v = R / 6 - 0.5,
        m = n * E.width * v,
        S = e + m + E.twist * Math.sin(2 * d) + 0.1 * C,
        L = C * (c + 0.026 * Math.cos(v * Math.PI));
      if (
        (r.push(
          0.74 * Math.cos(d) * (1 + 0.004 * a),
          L * Math.cos(S),
          E.arch * L * Math.sin(S),
        ),
        t.push(u, v + 0.5),
        i < 96 && R < 6)
      ) {
        const w = i * 7 + R;
        o.push(w, w + 1, w + 7, w + 1, w + 8, w + 7);
      }
    }
  }
  const s = new N();
  return (
    s.setAttribute("position", new O(r, 3)),
    s.setAttribute("uv", new O(t, 2)),
    s.setIndex(o),
    s.computeVertexNormals(),
    s
  );
}
function it(e, n, a) {
  const r = new Ne(e);
  K.add(new G(new Qe(r, Math.max(20, e.length), n, 7, !1), a));
}
const ne = new j({ map: Me, roughness: 0.68, side: He }),
  _ = new j({
    map: Me,
    roughness: 0.8,
    side: je,
    emissive: 11946501,
    emissiveIntensity: 0.16,
  }),
  Y = [];
ne.shadowSide = Te;
function ge() {
  for (const a of Y) (K.remove(a), a.children[0].geometry.dispose());
  Y.length = 0;
  const e = E.count,
    n = E.sweep / e;
  for (let a = 0; a < e; a++) {
    const r = rt(-0.28 + a * n, n, a),
      t = new ee(),
      o = new G(r, ne),
      c = new G(r, _);
    ((o.castShadow = !0),
      (o.receiveShadow = c.receiveShadow = !0),
      t.add(o, c),
      Y.push(t),
      K.add(t));
  }
  document.querySelector("#label").textContent = "Maple · " + e + " leaves";
}
ge();
for (const e of [-1, 1]) {
  const n = new G(
    new te(0.033, 20, 12),
    new j({ color: 2630170, metalness: 0.55, roughness: 0.32 }),
  );
  ((n.position.x = e * 0.807), K.add(n));
}
it(
  [new p(0, 1.27, -0.05), new p(0, 5, -0.05)],
  0.009,
  new j({ color: 9472128 }),
);
f.color.set(16751409);
f.intensity = 13;
const ye = new G(new te(0.032, 32, 24), new qe({ color: 16768140 }));
f.add(ye);
x.target.set(0, 0.24, 0);
W.position.set(-3.95, 0.83, -3.6);
x.update();
const be = new me(),
  Z = new me();
addEventListener("pointermove", (e) =>
  be.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1),
);
let U = !1;
x.addEventListener("start", () => {
  U = !0;
});
const de = matchMedia("(prefers-reduced-motion: reduce)");
function xe() {
  ((W.aspect = innerWidth / innerHeight),
    (W.fov = Ze.radToDeg(
      2 * Math.atan(Math.tan(0.252) / Math.min(1, W.aspect)),
    )),
    W.updateProjectionMatrix(),
    y.setSize(innerWidth, innerHeight));
}
addEventListener("resize", xe);
xe();
const g = (e, n) => e + (n - e) * Math.random();
function oe() {
  (Object.assign(E, {
    count: Math.floor(g(13, 30)),
    sweep: g(4.75, 5.9),
    width: g(0.64, 0.95),
    twist: g(-0.33, 0.36),
    arch: g(0.78, 1.24),
    travel: g(1.35, 2.4),
    period: g(7.5, 12),
    phase: g(-2, 2),
  }),
    ne.color.setHSL(g(0.06, 0.105), g(0.1, 0.32), g(0.76, 0.96)),
    fe.color.setHSL(g(0.02, 0.12), g(0.04, 0.15), g(0.29, 0.4)),
    (J = 0),
    (U = !1),
    ge());
}
document.querySelector("#random").onclick = oe;
addEventListener("keydown", (e) => {
  !e.repeat &&
    e.key.toLowerCase() === "r" &&
    !e.ctrlKey &&
    !e.metaKey &&
    !e.altKey &&
    !e.target.closest?.("input,textarea,[contenteditable=true]") &&
    oe();
});
function ct() {
  return (
    $e(
      () => ({
        Lantern: le({
          Random: he(oe),
          Speed: {
            value: 1,
            min: 0,
            max: 2,
            step: 0.05,
            onChange: (e) => (z.speed = e),
          },
          "Fold travel": {
            value: 1,
            min: 0,
            max: 1.25,
            step: 0.01,
            onChange: (e) => (z.amplitude = e),
          },
          "Camera motion": {
            value: !0,
            onChange: (e) => {
              ((z.camera = e), (U = !1));
            },
          },
          "Resume camera": he(() => {
            U = !1;
          }),
        }),
        Rendering: le(
          {
            "Light palette": {
              value: "Warm",
              options: ["Warm", "Cool white"],
              onChange: (e) => (z.light = e),
            },
            "Lamp intensity": {
              value: 1,
              min: 0.15,
              max: 2,
              step: 0.05,
              onChange: (e) => (z.brightness = e),
            },
            Exposure: {
              value: 1,
              min: 0.5,
              max: 1.8,
              step: 0.02,
              onChange: (e) => (y.toneMappingExposure = e),
            },
            Shadows: { value: !0, onChange: (e) => (y.shadowMap.enabled = e) },
          },
          { collapsed: !0 },
        ),
      }),
      [],
    ),
    null
  );
}
const se = ot();
se.scale.setScalar(0.81);
se.position.set(-0.45, 1.96, 1.52);
F.add(se);
const ve = new URLSearchParams(location.search).has("thumb");
document.body.classList.toggle("capture", ve);
ve ||
  Oe.createRoot(document.querySelector("#controls")).render(
    X.createElement(
      X.Fragment,
      null,
      X.createElement(Ye, { collapsed: !0, titleBar: { title: "Controls" } }),
      X.createElement(ct),
    ),
  );
const lt = new pe(16777215);
let $;
const ue = new p();
y.setAnimationLoop((e) => {
  const n = $ === void 0 ? 0 : Math.min((e - $) / 1e3, 0.1);
  (($ = e), de.matches || (J += n * z.speed));
  const a = (J / E.period) * Math.PI * 2;
  for (const [o, c] of Y.entries()) {
    const s = o / (Y.length - 1),
      i = a - s * 0.92,
      u = 0.5 - 0.5 * Math.cos(i),
      d = u * u * (3 - 2 * u);
    c.rotation.x =
      z.amplitude *
      s *
      (-E.travel * d + 0.24 * Math.sin(3 * i - 2 * s) * Math.sin(i) ** 2 * s);
  }
  const r = 0.5 + 0.5 * Math.cos(a - 0.65),
    t = a + E.phase;
  if (
    (f.color.set(z.light === "Warm" ? 16756569 : 14478591),
    ye.material.color.copy(f.color).lerp(lt, 0.55),
    _.emissive.copy(f.color),
    (_.emissiveIntensity = 0.075),
    f.position.set(
      0.32 * Math.sin(t),
      0.12 + 0.33 * Math.cos(t),
      0.28 * Math.sin(t * 2),
    ),
    (f.intensity = z.brightness * (10 + 5 * r)),
    !U && z.camera && !de.matches)
  ) {
    Z.lerp(be, 0.045);
    const o = 0.29 * Math.sin(a * 0.5 + E.phase * 0.3) + Z.x * 0.06,
      c = 1 - 0.13 * r;
    (ue.set(
      (-4.35 * Math.cos(o) - 3.6 * Math.sin(o)) * c,
      0.88 + 0.68 * Math.sin(a * 0.5 - 0.4) - Z.y * 0.18,
      (4.35 * Math.sin(o) - 3.6 * Math.cos(o)) * c,
    ),
      W.position.lerp(ue, 1 - Math.exp(-n * 4)));
  }
  (x.update(), y.render(F, W));
});
