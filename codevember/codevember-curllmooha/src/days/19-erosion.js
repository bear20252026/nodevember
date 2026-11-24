import "../lib/modulepreload-polyfill.js";
import {
  aj as Ve,
  az as We,
  a1 as ke,
  m as b,
  g as y,
  s as S,
  Q as re,
  u as g,
  d as oe,
  b as _e,
  D as $e,
  O as we,
  bc as qe,
  aw as Xe,
  P as Ye,
} from "../lib/stage.js";
import { O as Ze } from "../lib/OrbitControls.js";
import {
  S as xe,
  P as Ke,
  C as h,
  B as Le,
  F as Qe,
  d as ue,
  M as te,
  D as Je,
  a as Pe,
  t as me,
  a3 as et,
  f as tt,
  az as at,
  V as Y,
  c as nt,
  r as z,
  L as ot,
  e as ge,
  u as st,
  b as rt,
  g as be,
  aF as ye,
} from "../lib/leva.js";
import { r as it } from "../lib/rendering-panel.js";
import { a as lt } from "../lib/pcss.js";
import {
  L as ct,
  H as ve,
  D as dt,
  r as ut,
  m as mt,
  a as pt,
  c as ft,
} from "../lib/erode.js";
import "../lib/three.js";
const l = new URLSearchParams(location.search),
  x = l.has("thumb"),
  Z = l.has("capture");
document.body.classList.toggle("capture", x || Z);
const K = [
    {
      name: "Red mesas",
      land: "mesa",
      hardness: 0.9,
      talus: 0.01,
      gloss: 0,
      grain: 1,
      room: "#d6bba3",
      skin: "#9c4f33",
      bands: ["#7e3620", "#d3906a", "#b8673f", "#dca37a"],
      sand: "#c99a72",
      cut: "#4e2416",
      water: "#3d5866",
    },
    {
      name: "Glacier ice",
      land: "hills",
      hardness: 0.5,
      talus: 0.012,
      gloss: 1,
      grain: 0.35,
      room: "#c2ccd4",
      skin: "#f4f7f8",
      bands: ["#9fc3d6", "#e6f0f4", "#c4dce7", "#f0f5f7"],
      sand: "#8d9196",
      cut: "#3f7895",
      water: "#2f6f93",
    },
    {
      name: "Wet sand",
      land: "hills",
      hardness: 0,
      talus: 0.004,
      gloss: 0.45,
      grain: 0.5,
      room: "#d9ccb4",
      skin: "#d6bf96",
      bands: ["#b99a6e", "#dcc6a0", "#c8ad84", "#e4d2b0"],
      sand: "#efe3cc",
      cut: "#7d6646",
      water: "#5d7480",
    },
    {
      name: "Basalt cliffs",
      land: "mesa",
      hardness: 0.8,
      talus: 0.014,
      gloss: 0.15,
      grain: 1.3,
      room: "#b8b6b3",
      skin: "#6f7a58",
      bands: ["#2a2828", "#5d5753", "#45413e", "#6d655e"],
      sand: "#cbb994",
      cut: "#161515",
      water: "#2f4a58",
    },
  ],
  o = x ? 384 : 256,
  Q = 2.4,
  Ce = 1.25,
  Re = 0.02,
  A = await Ve({ shadows: !0 }),
  R = A.domElement;
R.id = "view";
R.tabIndex = 0;
R.setAttribute(
  "aria-label",
  "A block of land eroding under rain. Press Random for new land.",
);
const C = new xe(),
  v = new Ke(30, 1, 0.05, 60),
  ie = new h(),
  De = We(ie),
  ae = [[14, 0]],
  _ = 0.9,
  Be = -2.4;
for (let e = 0; e <= 48; e++) {
  const t = ((e / 48) * Math.PI) / 2;
  ae.push([Be + _ - Math.sin(t) * _, _ - Math.cos(t) * _]);
}
ae.push([Be, 14]);
const Te = [],
  ze = [];
ae.forEach(([e, t]) => Te.push(-15, t, e, 15, t, e));
for (let e = 0; e < ae.length - 1; e++) {
  const t = e * 2;
  ze.push(t, t + 2, t + 1, t + 1, t + 2, t + 3);
}
const ne = new Le();
ne.setAttribute("position", new Qe(Te, 3));
ne.setIndex(ze);
ne.computeVertexNormals();
const Fe = new ke({ roughness: 1, side: ue });
Fe.colorNode = De.mul(
  b(y(1), y(0.82), S(2, 8, re.xz.length().add(re.y.mul(0.6)))),
);
const Ie = new te(ne, Fe);
Ie.receiveShadow = !0;
C.add(Ie);
C.backgroundNode = De.mul(0.82);
const c = new Je(16772829, 3.4);
c.position.set(4.6, 2.9, 1.6);
c.target.position.set(0, 0.3, 0);
c.castShadow = !0;
c.shadow.mapSize.set(4096, 4096);
c.shadow.bias = -3e-4;
c.shadow.normalBias = 0.004;
Object.assign(c.shadow.camera, {
  left: -2.4,
  right: 2.4,
  top: 2.4,
  bottom: -2.4,
  near: 0.5,
  far: 14,
});
C.add(c, c.target);
const ht = lt(c, { renderer: A, lightSize: 0.1, filterTaps: 28, noise: !1 });
function wt(e) {
  const t = new xe();
  t.background = e.clone().multiplyScalar(0.85);
  const a = (p, d, f, F) => {
    const L = new te(new Pe(p, d), new rt({ color: f, side: ue }));
    (L.position.set(...F), L.lookAt(0, 0, 0), t.add(L));
  };
  (a(7, 5, new h(4, 3.8, 3.5), [6, 6, 4]),
    a(10, 10, new h(1.8, 1.8, 1.8), [0, 9, 0]),
    a(1, 9, new h(3, 3, 3), [-6, 2, 3]));
  const n = new Ye(A),
    s = n.fromScene(t, 0.02).texture;
  return (n.dispose(), s);
}
const B = new Pe(Q, Q, o - 1, o - 1);
B.rotateX(-Math.PI / 2);
const le = new me(new Float32Array(o * o), 1);
B.setAttribute("wear", le);
const H = [];
for (const [e, t] of [
  [0, 1],
  [o * (o - 1), 1],
  [0, o],
  [o - 1, o],
])
  H.push(Array.from({ length: o }, (a, n) => e + n * t));
const P = new Le(),
  D = new Float32Array(H.length * o * 2 * 3),
  Ne = [];
H.forEach((e, t) => {
  const a = t * o * 2;
  for (let n = 0; n < o - 1; n++) {
    const s = a + n * 2;
    Ne.push(s, s + 1, s + 2, s + 1, s + 3, s + 2);
  }
});
P.setAttribute("position", new me(D, 3));
P.setIndex(Ne);
P.setAttribute("wear", new me(new Float32Array(H.length * o * 2), 1));
const r = {
    b0: g(new h()),
    b1: g(new h()),
    b2: g(new h()),
    b3: g(new h()),
    sand: g(new h()),
    cut: g(new h()),
    skin: g(new h()),
    water: g(new h()),
    show: g(1),
    gloss: g(0),
    grain: g(1),
  },
  N = new ke({ roughness: 0.92, side: ue });
{
  const e = re,
    t = oe(e.mul(1.7), 3),
    a = oe(e.mul(_e(5, 40, 5)), 3),
    n = oe(e.mul(22), 3),
    p = e.y.sub(Re).div(Ce).add(t.mul(0.025)).add(a.mul(0.004)).mul(ct),
    d = p.fract(),
    f = d.mul(7).add(a.mul(0.6)).fract(),
    F = b(b(r.b1, r.b3, p.floor().mod(2)), r.b2, S(0.55, 1, f).mul(0.3)),
    L = y(1).sub(S(ve - 0.03, ve + 0.03, d.add(n.mul(0.03)))),
    j = b(F, r.b0, L.mul(0.75)).mul(
      y(1).add(t.mul(0.22).add(a.mul(0.12)).add(n.mul(0.1)).mul(r.grain)),
    ),
    i = $e("wear").mul(r.show),
    M = S(0.45, 0.8, we.y),
    E = b(
      j,
      r.skin.mul(y(1).add(t.mul(0.15))),
      M.mul(y(1).sub(S(0.003, 0.025, i.abs()))).mul(0.85),
    ),
    V = b(E, r.cut, S(0.01, 0.08, i).mul(0.5)),
    I = S(0.08, 0.25, i).mul(S(0.7, 0.95, we.y)),
    W = S(0.008, 0.05, i.negate());
  ((N.colorNode = b(
    b(V, r.water, I.mul(0.5)),
    r.sand.mul(y(1).add(n.mul(0.08))),
    W.mul(0.6),
  )),
    (N.roughnessNode = b(
      b(b(y(0.92), y(0.3), r.gloss), y(0.3), I),
      y(0.95),
      W,
    )),
    (N.normalNode = qe(n.mul(0.6).add(a).mul(r.grain).mul(0.02))));
}
const Ge = new et(),
  Ue = new te(B, N),
  gt = new te(P, N);
for (const e of [Ue, gt]) ((e.castShadow = e.receiveShadow = !0), Ge.add(e));
C.add(Ge);
let ce,
  k,
  u,
  U = 0;
const w = { ...dt, rate: 2e3, total: 5e5, running: !0 };
function J() {
  const e = B.attributes.position.array,
    t = le.array;
  for (let n = 0; n < o * o; n++)
    ((e[n * 3 + 1] = Re + ce[n] * Ce), (t[n] = k.wear[n]));
  ((B.attributes.position.needsUpdate = !0),
    (le.needsUpdate = !0),
    B.computeVertexNormals());
  const a = P.attributes.wear.array;
  (H.forEach((n, s) =>
    n.forEach((p, d) => {
      const f = (s * o * 2 + d * 2) * 3;
      ((D[f] = D[f + 3] = e[p * 3]),
        (D[f + 2] = D[f + 5] = e[p * 3 + 2]),
        (D[f + 1] = e[p * 3 + 1]),
        (D[f + 4] = 0),
        (a[s * o * 2 + d * 2] = a[s * o * 2 + d * 2 + 1] = 0));
    }),
  ),
    (P.attributes.position.needsUpdate = !0),
    P.computeVertexNormals(),
    P.computeBoundingSphere(),
    B.computeBoundingSphere());
}
let G = 0,
  de = 0;
const Me = document.querySelector("#label"),
  $ = {
    value: 0,
    listeners: new Set(),
    bump() {
      (this.value++, this.listeners.forEach((e) => e(this.value)));
    },
  };
function ee(
  e = Math.floor(Math.random() * K.length),
  t = (Math.random() * 1e9) | 0,
) {
  ((G = e), (de = t));
  const a = K[e];
  ((u = ut(t)),
    (ce =
      a.land === "mesa"
        ? mt(o, u)
        : pt(o, u, { ridge: 0.3 + u() * 0.3, scale: 2.2 + u() * 1.2 })),
    (w.hardness = a.hardness),
    (w.talus = a.talus),
    (r.gloss.value = a.gloss),
    (r.grain.value = a.grain),
    (k = ft(o, ce, w)),
    (U = 0),
    ["b0", "b1", "b2", "b3"].forEach((n, s) => r[n].value.set(a.bands[s])),
    r.sand.value.set(a.sand),
    r.cut.value.set(a.cut),
    r.skin.value.set(a.skin),
    r.water.value.set(a.water),
    ie.set(a.room),
    C.environment?.dispose?.(),
    (C.environment = wt(ie)),
    (C.environmentIntensity = 0.9),
    (document.body.style.background = a.room),
    J(),
    $.bump());
}
const bt = () => {
  Me && (Me.textContent = `${K[G].name} · ${(U / 2e3).toFixed(0)}k years`);
};
function pe() {
  (ee(), (fe = !1));
}
document.querySelector("#random")?.addEventListener("click", pe);
addEventListener("keydown", (e) => {
  (e.key === "r" || e.key === "R") && pe();
});
const Ee = new at(),
  Ae = new tt();
let T = null,
  q = null;
R.addEventListener("pointerdown", (e) => {
  q = [e.clientX, e.clientY];
});
R.addEventListener("pointerup", (e) => {
  if (!q || Math.hypot(e.clientX - q[0], e.clientY - q[1]) > 5) return;
  (Ae.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1),
    Ee.setFromCamera(Ae, v));
  const t = Ee.intersectObject(Ue)[0];
  t &&
    (T = {
      x: (t.point.x / Q + 0.5) * (o - 1),
      y: (t.point.z / Q + 0.5) * (o - 1),
      left: 6e3,
    });
});
const m = new Ze(v, R);
m.enableDamping = !0;
m.enablePan = !1;
m.minDistance = 3;
m.maxDistance = 7.5;
m.minPolarAngle = 0.5;
m.maxPolarAngle = 1.35;
m.minAzimuthAngle = -1.1;
m.maxAzimuthAngle = 1.1;
const He = new Y(2.9, 2.7, 4.2).multiplyScalar(x ? 1.3 : 1),
  Oe = new Y(0, 0.25, 0);
v.position.copy(He);
m.target.copy(Oe);
m.update();
let fe = !1;
m.addEventListener("start", () => {
  fe = !0;
});
ee(Number(l.get("pal") ?? 0), Number(l.get("seed") ?? 4242));
if (x) {
  for (let e = 0; e < w.total; e++)
    (k.drop(1 + u() * (o - 3), 1 + u() * (o - 3)), e % 1500 === 0 && k.slump());
  ((U = w.total), J());
}
const X = Xe(A, C, v, {
  aoStrength: 0.6,
  aoRadius: 0.08,
  aoThickness: 0.1,
  bloomStrength: 0.006,
  vignette: 0.14,
  grain: 0.005,
});
function je() {
  const e = x ? 1e3 : Z ? +l.get("w") : innerWidth,
    t = x ? 1e3 : Z ? +l.get("h") : innerHeight;
  (A.setSize(e, t, !x),
    (v.aspect = e / t),
    (v.fov = ge.radToDeg(
      2 * Math.atan(Math.tan(ge.degToRad(16)) / Math.min(1, v.aspect)),
    )),
    v.updateProjectionMatrix());
}
addEventListener("resize", je);
je();
let se,
  yt = 0,
  Se = 0;
if (Z) {
  A.setAnimationLoop(null);
  const e = +l.get("frames"),
    t = +(l.get("from") || 0),
    a = l.get("port"),
    n = 60,
    s = 1200,
    p = 450,
    d = l.has("t") ? l.get("t").split(",").map(Number) : null,
    f = new Y(0, 1, 0),
    F = c.position.clone();
  let L = 0;
  const O = async (i) => {
      for (; L < i; ) {
        for (let he = 0; he < p; he++)
          k.drop(1 + u() * (o - 3), 1 + u() * (o - 3));
        (k.slump(), L++);
      }
      J();
      const M = i / s,
        E = M * M * (3 - 2 * M),
        V = 5 - 1.1 * E,
        I = -0.55 + 1.15 * E,
        W = 2.6 - 1.4 * E + 0.35 * Math.sin(M * Math.PI);
      (v.position.set(Math.sin(I) * V, W, Math.cos(I) * V),
        v.lookAt(0, 0.25 + 0.05 * E, 0),
        c.position.copy(F).applyAxisAngle(f, -0.35 + 0.9 * E),
        (c.position.y = 3.4 - 1.5 * E),
        X.render(),
        await A.backend.device.queue.onSubmittedWorkDone());
    },
    j = async (i) => {
      const M = await new Promise((E) => R.toBlob(E, "image/png"));
      await fetch(`http://localhost:${a}/frame?i=${i}`, {
        method: "POST",
        body: M,
      });
    };
  for (let i = 0; i < 4; i++) await O(t);
  if (d)
    for (const [i, M] of d.entries()) (await O(Math.round(M * n)), await j(i));
  else for (let i = t; i < t + e; i++) (await O(i), await j(i));
  await fetch(`http://localhost:${a}/done`);
} else
  A.setAnimationLoop((e) => {
    const t = se === void 0 ? 0 : Math.min((e - se) / 1e3, 0.05);
    ((se = e), (Se += t));
    let a = 0;
    if (w.running && U < w.total)
      for (; a < w.rate; a++) k.drop(1 + u() * (o - 3), 1 + u() * (o - 3));
    if (T) {
      for (let n = 0; n < 900; n++)
        k.drop(
          Math.min(o - 3, Math.max(1, T.x + (u() - 0.5) * o * 0.18)),
          Math.min(o - 3, Math.max(1, T.y + (u() - 0.5) * o * 0.18)),
        );
      ((a += 900), (T.left -= 900) <= 0 && (T = null));
    }
    if ((a && ((U += a), k.slump(), J()), bt(), !fe)) {
      const n = He.clone().applyAxisAngle(
        new Y(0, 1, 0),
        Math.sin(Se * 0.07) * 0.25,
      );
      (v.position.lerp(n, 1 - Math.exp(-t * 1.4)),
        m.target.lerp(Oe, 1 - Math.exp(-t * 1.4)));
    }
    (m.update(t),
      X.render(),
      ++yt === 4 &&
        (document.body.classList.add("ready"),
        x && l.has("still") && A.setAnimationLoop(null),
        l.has("port") &&
          setTimeout(() => {
            (X.render(),
              R.toBlob(
                (n) =>
                  fetch(`http://localhost:${l.get("port")}/`, {
                    method: "POST",
                    body: n,
                  }),
                "image/jpeg",
                0.92,
              ));
          }, 1500)));
  });
function vt() {
  const [, e] = z.useState(0);
  z.useEffect(() => {
    const a = (n) => e(n);
    return ($.listeners.add(a), () => $.listeners.delete(a));
  }, []);
  const t = (a, n, s, p) => ({
    value: w[a],
    min: n,
    max: s,
    step: p,
    onChange: (d) => {
      w[a] = d;
    },
  });
  return (
    st(
      () => ({
        Erosion: be({
          Palette: {
            value: G,
            options: Object.fromEntries(K.map((a, n) => [a.name, n])),
            onChange: (a, n, s) => {
              !s.initial && a !== G && ee(a, de);
            },
          },
          Random: ye(pe),
          Restart: ye(() => ee(G, de)),
          Rain: {
            value: w.running,
            onChange: (a) => {
              w.running = a;
            },
          },
          "Drops / frame": t("rate", 0, 4e3, 50),
          "Total drops": t("total", 1e4, 1e6, 1e4),
          "Show wear": {
            value: 1,
            min: 0,
            max: 1,
            onChange: (a) => {
              r.show.value = a;
            },
          },
        }),
        Droplet: be(
          {
            Inertia: t("inertia", 0, 0.5, 0.01),
            Capacity: t("capacity", 0.5, 12, 0.1),
            Erode: t("erode", 0, 1, 0.01),
            Deposit: t("deposit", 0, 1, 0.01),
            Evaporate: t("evaporate", 0.001, 0.1, 0.001),
            Gravity: t("gravity", 0.5, 12, 0.1),
            Lifetime: t("life", 5, 80, 1),
            Radius: t("radius", 1, 8, 1),
            "Caprock hardness": t("hardness", 0, 1, 0.01),
            "Slump angle": t("talus", 0.001, 0.03, 0.001),
          },
          { collapsed: !0 },
        ),
        ...it({ renderer: A, pipeline: X, lights: [c], pcss: [ht] }),
      }),
      [$.value],
    ),
    null
  );
}
x ||
  nt
    .createRoot(document.querySelector("#controls"))
    .render(
      z.createElement(
        z.Fragment,
        null,
        z.createElement(ot, { collapsed: !0, titleBar: { title: "Controls" } }),
        z.createElement(vt),
      ),
    );
