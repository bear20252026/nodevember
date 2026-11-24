import "../lib/modulepreload-polyfill.js";
import {
  u as q,
  M as Na,
  D as dt,
  f as bt,
  aq as Ha,
  af as H,
  g as r,
  y as yt,
  ae as Mn,
  v as qo,
  F as Oa,
  b as O,
  a4 as Ve,
  ai as Q,
  m as T,
  s as b,
  n as wt,
  an as ja,
  c as vn,
  A as x,
  al as ut,
  I as Ce,
  H as Nt,
  T as vo,
  a6 as Ba,
  E as Ht,
  r as gt,
  q as No,
  B as Qa,
  aB as Wa,
  L as Ho,
  aC as Ga,
  aD as _a,
  Z as Sn,
  aj as Ua,
  z as Xa,
  x as Ya,
  az as Ka,
  P as $a,
  aE as Za,
  aw as Ja,
} from "../lib/stage.js";
import { O as es } from "../lib/OrbitControls.js";
import {
  V as l,
  aL as ts,
  q as mt,
  M as pe,
  aN as os,
  F as ns,
  d as as,
  C as Y,
  e as Re,
  p as ss,
  a3 as Gt,
  ar as Ot,
  Y as xn,
  b as Bn,
  k as Uo,
  aB as kn,
  bb as zn,
  bc as ls,
  Q as ko,
  aQ as Qn,
  m as Wn,
  bd as rs,
  S as Gn,
  P as cs,
  a as _n,
  D as is,
  az as ds,
  f as us,
  ai as Un,
  c as ms,
  r as fo,
  L as fs,
  ba as ps,
  b3 as hs,
  be as ws,
  u as bs,
  aF as Pn,
} from "../lib/leva.js";
import { r as ys } from "../lib/rendering-panel.js";
import { a as gs } from "../lib/pcss.js";
import "../lib/three.js";
const Xn = {
    Contour: {
      L: 0.11,
      solid: 0.013,
      reach: 0.03,
      sa: 0.7,
      sb: 0.5,
      tipK: 0.6,
      curl: 0.9,
      density: 2600,
      fuzz: 1.1,
      fall: 0.2,
      down: 0.026,
    },
    Down: {
      L: 0.09,
      solid: 0,
      reach: 0.036,
      sa: 0.7,
      sb: 0.5,
      tipK: 0.3,
      curl: 1.2,
      density: 2200,
      fuzz: 1.3,
      fall: 0.12,
      down: 0.022,
      layer: 0.5,
    },
    Ribbon: {
      L: 0.42,
      solid: 0.012,
      reach: 0.006,
      sa: 0.5,
      sb: 0.3,
      tipK: 0.9,
      curl: 1,
      density: 2e3,
      fuzz: 0.4,
      fall: 0.5,
      asym: 0.3,
    },
    Tail: {
      L: 0.22,
      solid: 0.034,
      reach: 0.016,
      sa: 0.62,
      sb: 0.4,
      tipK: 0.45,
      curl: 0.9,
      density: 2200,
      fuzz: 0.6,
      fall: 0.3,
      down: 0.022,
    },
    Curl: {
      L: 0.26,
      solid: 0.009,
      reach: 0.03,
      sa: 0.6,
      sb: 0.45,
      tipK: 0.6,
      curl: 1,
      density: 1800,
      fuzz: 1.1,
      fall: 0.25,
      down: 0.02,
    },
    Plume: {
      L: 0.3,
      solid: 0,
      reach: 0.06,
      sa: 0.78,
      sb: 0.55,
      tipK: 0.45,
      curl: 1.1,
      density: 1700,
      fuzz: 1,
      fall: 0.25,
    },
  },
  Ms = (e) => {
    const t = e.nx,
      n = e.ny,
      o = new os(),
      u = [],
      a = [];
    for (let h = 0; h <= n; h++)
      for (let p = 0; p <= t; p++) u.push((p / t) * 2 - 1, h / n, 0);
    for (let h = 0; h < n; h++)
      for (let p = 0; p < t; p++) {
        const w = h * (t + 1) + p,
          y = w + 1,
          f = w + t + 1,
          F = f + 1;
        a.push(w, y, f, y, F, f);
      }
    return (o.setAttribute("position", new ns(u, 3)), o.setIndex(a), o);
  },
  vs = { high: { nx: 10, ny: 40 }, low: { nx: 6, ny: 14 } },
  Cn = (e) => {
    const t = new Y(e).convertLinearToSRGB(),
      n = (o) => Math.round(Re.clamp(o, 0, 1) * 255);
    return n(t.r) * 65536 + n(t.g) * 256 + n(t.b);
  },
  Rn = (e) => {
    const t = O(gt(e.div(65536)), gt(e.div(256)).mod(256), e.mod(256)).div(255);
    return T(t.div(12.92), t.add(0.055).div(1.055).pow(2.4), Q(0.04045, t));
  };
class jt {
  constructor(t, n = "low") {
    ((this.species = t),
      (this.res = n),
      (this.pos = []),
      (this.quat = []),
      (this.info = []),
      (this.normal = []));
  }
  add(
    t,
    n,
    o,
    u,
    a,
    h = 1,
    p = Math.random(),
    w = Math.random() * 6.28,
    y = u,
  ) {
    (this.pos.push(t.x, t.y, t.z, o),
      this.quat.push(n.x, n.y, n.z, n.w),
      this.info.push(h, p, w, Cn(u)),
      this.normal.push(a.x, a.y, a.z),
      (this.tip = this.tip || []),
      this.tip.push(Cn(y)));
  }
  get count() {
    return this.pos.length / 4;
  }
}
function Oo(e, t, n) {
  return (
    (Math.sin(e * 1.7 + t * 0.6 + 1.3) * Math.cos(t * 1.3 - n * 0.9 + 0.7) +
      Math.sin(n * 1.9 + e * 0.4 + 2.1) * Math.cos(e * 1.1 + n * 0.7) +
      Math.sin(t * 2.3 - e * 0.8 + 0.4) * 0.6) /
    2.6
  );
}
function Ss(e, t) {
  const n = Ms(vs[e.res]),
    o = e.count,
    u = new Float32Array(e.pos),
    a = new Float32Array(e.quat);
  for (let f = 0; f < o; f++) {
    const F = u[f * 4],
      R = u[f * 4 + 1],
      V = u[f * 4 + 2];
    if (
      (e.free || (u[f * 4 + 3] *= 1 + 0.22 * Oo(F * 9 + 3.7, R * 9, V * 9)),
      a[f * 4 + 3] < 0)
    )
      for (let P = 0; P < 3; P++) a[f * 4 + P] *= -1;
    a[f * 4 + 3] =
      0.5 +
      0.5 *
        (0.6 * Oo(F * 14, R * 14, V * 14) +
          0.4 * Oo(F * 33 + 7, R * 33, V * 33));
  }
  (n.setAttribute("aPos", new mt(u, 4)),
    n.setAttribute("aQuat", new mt(a, 4)),
    n.setAttribute("aInfo", new mt(new Float32Array(e.info), 4)));
  const h = new Float32Array(o * 4),
    p = new Float32Array(o * 4),
    w = new Float32Array(o * 4);
  for (let f = 0; f < o; f++) ((p[f * 4] = -1), (w[f * 4 + 3] = e.tip[f]));
  (n.setAttribute("aFly0", new mt(h, 4)),
    n.setAttribute("aFly1", new mt(p, 4)),
    n.setAttribute("aFly2", new mt(w, 4)),
    (n.instanceCount = o));
  const y = new pe(n, xs(e.species, t, e));
  return (
    (y.frustumCulled = !1),
    (y.castShadow = !1),
    (y.receiveShadow = !0),
    (y.userData.set = e),
    y
  );
}
const Ee = (e, t) => t.add(vo(e.xyz, vo(e.xyz, t).add(t.mul(e.w))).mul(2)),
  Bt = (e, t) =>
    bt(
      t.xyz.mul(e.w).add(e.xyz.mul(t.w)).add(vo(e.xyz, t.xyz)),
      e.w.mul(t.w).sub(yt(e.xyz, t.xyz)),
    ),
  ft = (e, t) => bt(e.mul(x(t.mul(0.5))), Ce(t.mul(0.5))),
  jo = (e, t, n) => wt(T(e, t.mul(Q(0, yt(e, t)).mul(2).sub(1)), n)),
  po = Math.PI;
function xs(e, t, { free: n, brow: o, crest: u }) {
  const a = Xn[e],
    h = a.L,
    p = new Na({ side: as }),
    w = dt("aPos", "vec4"),
    y = dt("aQuat", "vec4"),
    f = bt(y.xyz, Ha(H(r(1).sub(yt(y.xyz, y.xyz)), 0))),
    F = dt("aInfo", "vec4"),
    R = dt("aFly0", "vec4"),
    V = dt("aFly1", "vec4"),
    P = dt("aFly2", "vec4"),
    G = Mn.x,
    A = Mn.y,
    I = qo("vec4", "vA"),
    et = qo("vec4", "vB"),
    _e = qo("vec3", "vT"),
    qe = I.xy,
    re = I.z,
    Je = et.xyz,
    ce = (z) =>
      Sn(H(x(Sn(H(z, 1e-4), a.sa).mul(po)), 0), a.sb)
        .mul(b(0, 0.05, z))
        .mul(r(1).sub(b(0.92, 1, z).mul(a.tipK))),
    _ = (z) => H(ce(z).mul(a.solid), r(0.0012)),
    $ = (z) => ce(z).mul(a.reach),
    xt = (z) =>
      b(0.5, 0.08, z)
        .mul(b(0, 0.06, z))
        .mul(a.down ?? 0);
  p.positionNode = Oa(() => {
    const z = F.y,
      ee = F.z,
      Tt = O(1, 0, 0),
      en = Ve(z.mul(37).add(5)),
      tn = Ve(z.mul(13).add(2)),
      on = R.w,
      nn = V.x,
      Ro = V.y,
      Ao = V.z,
      ra = V.w,
      an = Q(0, nn),
      so = an.mul(Q(t.now, Ao)),
      ca = an.mul(Q(Ao, t.now)),
      ia = T(r(1), b(0, 1.3, t.now.sub(Ao)), ca),
      Lo = r(1).sub(so),
      da = wt(w.xyz.div(t.coatRadii)),
      ua = ja(vn(yt(da, t.rouseOrigin), -1, 1)).mul(0.48 / po),
      lo = t.now.sub(t.rouseStart).sub(ua),
      To = b(0, 0.085, lo)
        .mul(b(0.1, 0.38, lo).oneMinus())
        .mul(Lo),
      ae = r(h).mul(w.w),
      sn = H(H(_(A), $(A)), xt(A)).mul(r(1).add(r(a.asym ?? 0).mul(G.sign()))),
      Ft = G.mul(sn).mul(w.w),
      ln = A.mul(ae);
    let rt, ct, Vt;
    if (n) {
      const Ne = r(a.curl).mul(F.x).div(ae),
        it = x(ut.mul(1.6).add(ee)).mul(0.04),
        He = Ne.mul(ln).add(1e-4);
      ((rt = O(
        Ft.add(it.mul(A.mul(A)).mul(ae)),
        x(He).div(Ne.add(1e-4)),
        r(1).sub(Ce(He)).div(Ne.add(1e-4)),
      ).add(O(0, 0, sn.mul(G.mul(G)).mul(0.2).mul(w.w)))),
        (ct = O(0, Ce(He), x(He))),
        (Vt = Tt));
    } else {
      const Ne = Ee(t.bodyQuat, w.xyz.mul(t.bodyScale)).add(t.bodyPos),
        it = y.w,
        He = Ne.sub(t.blowPos),
        It = He.dot(t.blowDir).max(0),
        co = He.sub(t.blowDir.mul(It)).length(),
        Ra = Ee(Bt(t.bodyQuat, f), O(0, 0, 1)),
        Aa = b(-0.3, 0.6, Ra.dot(t.blowDir)),
        La = Nt(co.mul(co).div(0.0065).negate())
          .mul(t.blowPower)
          .mul(r(0.35).add(Aa.mul(0.9)))
          .add(t.hover.mul(Nt(co.mul(co).div(0.004).negate()))),
        Ta = x(ut.mul(0.6).add(it.mul(6.283)))
          .mul(0.08)
          .add(1),
        Eo = (o ? t.brow.max(0).mul(1.4) : r(0))
          .add(La)
          .add(t.shiver.mul(0.25))
          .add(on.mul(0.8)),
        Io = x(ut.mul(34).add(ee.mul(3))),
        Fa = r(0.45)
          .add(it.mul(1.1))
          .mul(r(a.layer ?? 1))
          .mul(t.fluffAngle.add(t.fluff.mul(0.9)))
          .mul(Ta)
          .mul(
            r(1)
              .add(Eo.mul(r(1).add(Io.mul(0.4))))
              .add(To.mul(0.95)),
          ),
        Va = (Oe) => {
          const gn = Oe.div(ae);
          return ae
            .mul(
              r(0.035)
                .add(gn.mul(0.16))
                .add(r(0.1).mul(r(1).sub(Nt(gn.div(0.22).negate())))),
            )
            .mul(Fa);
        },
        Dt = r(a.curl)
          .mul(F.x)
          .mul(r(0.5).add(tn.mul(0.8)))
          .div(ae),
        Ea = (Oe) =>
          r(1)
            .sub(Ce(Dt.mul(Oe)))
            .div(Dt),
        io = (Oe) =>
          Oe.mul(Oe).div(t.skinR.mul(2)).add(Ea(Oe)).add(Va(Oe)).div(Oe),
        uo = H(
          H(io(ae.mul(0.25)), io(ae.mul(0.5))),
          H(io(ae.mul(0.75)), io(ae)),
        )
          .atan()
          .add(Eo.mul(r(0.35).add(Io.mul(0.12))))
          .add(To.mul(0.43))
          .mul(Lo),
        Do = O(0, Ce(uo), x(uo)),
        qt = O(0, x(uo).negate(), Ce(uo)),
        mo = Dt.mul(ln),
        Ia = Do.mul(x(mo).div(Dt)).sub(qt.mul(r(1).sub(Ce(mo)).div(Dt)));
      ct = Do.mul(Ce(mo)).sub(qt.mul(x(mo)));
      const wn = en
          .sub(0.5)
          .mul(r(0.5).add(on.mul(1.4)))
          .mul(A),
        Da = x(lo.max(0).mul(29)).mul(To).mul(0.2),
        qa = Io.mul(Eo)
          .mul(0.3)
          .add(Da)
          .add(x(ut.mul(1.3).add(ee)).mul(0.03)),
        bn = wt(
          Tt.mul(Ce(wn))
            .add(qt.mul(x(wn)))
            .add(Do.mul(qa)),
        ),
        yn = r(1)
          .div(t.skinR)
          .add(r(14).add(tn.mul(10)));
      ((Vt = bn.sub(qt.mul(yn.mul(Ft)))),
        (rt = Ia.add(bn.mul(Ft))
          .sub(qt.mul(yn.mul(Ft).mul(Ft).mul(0.5)))
          .add(O(0, 0, 0.0015))));
    }
    if (n) {
      const Ne = lo.sub(u ? 0.12 : 0).max(0),
        it = b(0, 0.045, Ne).mul(b(0.045, 0.4, Ne).oneMinus()),
        He = x(Ne.mul(32).add(en.mul(0.7)))
          .mul(it)
          .mul(Lo)
          .mul(u ? 0.23 : 0.1),
        It = ft(O(0, 0, 1), He);
      ((rt = Ee(It, rt)), (ct = Ee(It, ct)), (Vt = Ee(It, Vt)));
    }
    const ma = wt(vo(Vt, ct)),
      Fo = Bt(t.bodyQuat, f),
      fa = t.jiggle.mul(A.mul(A)).mul(ae),
      pa = Ee(Fo, rt.mul(ia))
        .add(Ee(t.bodyQuat, w.xyz.mul(t.bodyScale)))
        .add(t.bodyPos)
        .add(fa),
      rn = H(t.now.sub(nn), 0).mul(so),
      Pe = Ba(rn, Ro);
    Ve(z.mul(131).add(7));
    const ha = Ve(z.mul(71).add(3));
    Ve(z.mul(17).add(11));
    const cn = r(1.65)
        .add(x(ee.mul(2.3)).mul(0.35))
        .mul(1.6),
      Et = Pe.mul(cn)
        .add(ee)
        .add(x(Pe.mul(0.47).add(ee.mul(1.7))).mul(0.22)),
      wa = x(Et),
      dn = Ce(Et),
      ro = b(Ro, Ro.sub(0.5), Pe),
      un = b(0, 0.8, Pe),
      Vo = ee.mul(2.4).add(x(Pe.mul(0.23).add(ee)).mul(0.35)),
      mn = ae.mul(0.55).mul(wa).mul(un),
      ba = r(1)
        .sub(Nt(Pe.mul(-2.2)))
        .div(2.2),
      ya = ra.mul(Pe.sub(x(Et.mul(2)).mul(0.12).div(cn).mul(un))),
      ga = R.xyz
        .add(O(P.x, 0, P.z).mul(ba))
        .add(
          O(
            0,
            P.y
              .mul(r(1).sub(Nt(Pe.mul(-3))))
              .div(3)
              .sub(ya),
            0,
          ),
        )
        .add(O(Ce(Vo).mul(mn), 0, x(Vo).mul(mn))),
      Ma = ha.sub(0.5).mul(2.4),
      va = x(Et.sub(0.6))
        .mul(0.28)
        .add(x(Pe.mul(0.51).add(ee)).mul(0.12)),
      fn = x(Pe.mul(0.46).add(ee))
        .mul(0.55)
        .add(dn.mul(0.32))
        .add(Pe.mul(0.085))
        .add(Vo),
      Sa = Ma.add(dn.mul(0.62)).add(x(Et.mul(2).sub(0.4)).mul(0.1)),
      xa = Bt(
        ft(O(0, 1, 0), fn),
        Bt(ft(O(1, 0, 0), va.mul(ro)), ft(O(0, 0, 1), Sa.mul(ro))),
      ),
      ka = Bt(ft(O(0, 1, 0), fn), ft(O(1, 0, 0), r(-po / 2))),
      za = jo(ka, xa, ro),
      pn = jo(Fo, za, b(0, 0.6, rn)),
      Pa = x(ut.mul(2.8).add(G.mul(11)).add(ee))
        .mul(Ht(G).pow(1.4))
        .mul(0.04)
        .mul(ae)
        .add(
          x(ut.mul(1.3).add(ee).add(A.mul(2.4)))
            .mul(A.mul(A))
            .mul(0.055)
            .mul(ae),
        )
        .mul(ro),
      Ca = Ee(pn, rt.add(O(0, 0, Pa))).add(ga),
      hn = jo(Fo, pn, so);
    return (
      I.assign(bt(G, A, z, F.w)),
      et.assign(bt(Ee(hn, ma), P.w)),
      _e.assign(Ee(hn, ct)),
      T(pa, Ca, so)
    );
  })();
  const kt = qe.x,
    v = qe.y,
    zt = Rn(I.w),
    j = Rn(et.w),
    Me = _(v),
    ie = $(v),
    ve = H(Me, ie),
    de = Ht(kt).mul(ve),
    Ue = Q(0, kt),
    Xe = v.sub(de.mul(1.2).div(h)).mul(a.density * h),
    tt = Xe.fwidth(),
    U = b(0.28, 0.95, tt).oneMinus(),
    Kt = b(0.8, 2.8, tt).oneMinus(),
    ot = gt(Xe),
    Pt = No(Xe),
    $t = H(de.fwidth(), 1e-4).mul(0.55),
    te = (z) => b($t.negate(), $t, z.sub(de)),
    nt = Ve(ot.add(re.mul(97)).add(Ue.mul(313))),
    Ct = Ve(ot.mul(1.7).add(re.mul(53)).add(Ue.mul(41))),
    at = gt(ot.div(7)),
    Se = Ve(at.mul(3.1).add(re.mul(71)).add(Ue.mul(17))),
    Ye = Me.add(
      ie
        .sub(Me)
        .max(0)
        .mul(
          r(0.675)
            .add(Se.sub(0.5).mul(0.5).mul(Kt))
            .add(nt.sub(0.5).mul(0.15).mul(U)),
        ),
    ),
    Rt = No(Xe.div(7)),
    At = Q(0.72, Se)
      .mul(b(0.05, 0.19, Rt).oneMinus())
      .mul(Q(Me.mul(0.25), de))
      .mul(b(0.25, 0.45, v))
      .mul(U),
    Po = te(Me.add(5e-4)),
    we = b(0, 0.25, Pt).mul(b(1, 0.75, Pt)),
    Lt = vn(de.sub(Me).div(H(Ye.sub(Me), 3e-4)), 0, 1),
    Zt = b(0.55, 1, Lt.add(T(r(0.5), Ct, U).mul(0.35 * a.fuzz))).oneMinus(),
    Co = te(Me.mul(r(0.92).add(nt.sub(0.5).mul(0.2).mul(U))).add(5e-4)),
    st = T(Po, Co, b(0.3, 0.9, v)),
    Jt = st
      .oneMinus()
      .mul(te(Ye))
      .mul(T(r(0.94), T(r(0.75), r(1), we), U))
      .mul(T(r(1), Zt, 0.8)),
    eo = xt(v),
    to = Xe.mul(0.55).add(x(de.mul(700).add(re.mul(6))).mul(0.25)),
    lt = b(0.25, 0.9, to.fwidth()).oneMinus(),
    oo = b(0, 0.35, Ht(No(to).sub(0.5))).oneMinus(),
    no = te(eo.mul(r(0.775).add(Ct.sub(0.5).mul(0.45).mul(lt))))
      .mul(T(r(0.35), oo, lt))
      .mul(0.8)
      .mul(Q(1e-4, eo)),
    ao = H(st, Jt).mul(r(1).sub(At)),
    s = H(ao, no)
      .mul(b(1.002, 0.985, v))
      .mul(Q(0, v)),
    i = T(r(1), T(r(0.78), r(1), we), U.mul(0.85)),
    m = Ve(ot.mul(0.37).add(re.mul(31))),
    g = b(0.6, 0.82, v.add(T(r(0.5), nt, U).mul(0.06)).add(Lt.mul(0.1)));
  let S = T(zt, j, g);
  const k = b(
    0.55,
    0.75,
    x(v.mul(h).mul(170).sub(de.mul(120)).add(re.mul(6)))
      .mul(0.5)
      .add(0.5),
  );
  S = S.mul(
    r(1).sub(
      k
        .mul(t.bars)
        .mul(0.5)
        .mul(r(1).sub(g.mul(0.7))),
    ),
  );
  const L = de.div(H(ve, 0.001)),
    ue = b(0.035, 0, Ht(v.sub(0.55).sub(L.mul(0.16)))).mul(Q(L, 0.95)),
    D = b(0.3, 0.22, Qa(L.mul(0.9), v.sub(0.72).mul(h / 0.03)).length()),
    C = b(0.78, 0.92, L)
      .mul(st)
      .mul(b(0.25, 0.5, v)),
    E = t.motif,
    B = T(j, O(1), 0.1),
    Te = ue
      .mul(Q(0.5, E))
      .mul(Q(E, 1.5))
      .add(D.mul(Q(1.5, E)).mul(Q(E, 2.5)))
      .add(C.mul(Q(2.5, E)));
  S = T(S, B, Te.mul(t.markings));
  const X = x(Pt.mul(2 * po))
      .mul(0.12)
      .mul(U),
    K = wt(Je.add(_e.mul(X))),
    me = Wa(K).mul(Ho),
    Fe = r(1).sub(Ht(yt(me, Ga))),
    oe = b(0.1, 0.7, v)
      .oneMinus()
      .mul(b(0.45, 0.85, Fe).oneMinus())
      .mul(H(Ho, 0)),
    be = no.mul(ao.oneMinus()),
    ne = b(0.0012, 6e-4, de).mul(Q(0.001, r(a.solid))),
    Z = H(H(b(0.7, 1, L), b(0.7, 1, v)), H(st.oneMinus(), be));
  let J = S.mul(T(r(1.08), r(0.93), Z)).mul(oe.mul(-0.23).add(1));
  ((J = J.mul(Se.sub(0.5).mul(0.06).mul(Kt).add(1))
    .mul(m.mul(0.06).add(0.97))
    .mul(T(r(1), i, 0.45))),
    (J = T(J, zt.mul(0.42), ne.mul(0.75))),
    (J = T(J, zt.mul(1.08), be)),
    (p.colorNode = J),
    (p.opacityNode = s),
    (p.alphaTest = 0.18),
    (p.alphaToCoverage = !0),
    (p.transparent = !1));
  const xe = Ve(
    gt(kt.mul(43))
      .mul(127)
      .add(gt(v.mul(97)))
      .add(re.mul(919)),
  );
  ((p.maskShadowNode = s.mul(T(r(0.61), r(0.32), Z)).greaterThan(xe)),
    (p.normalNode = me),
    (p.receivedShadowNode = (z) => T(z, 1, 0.3)),
    (p.roughnessNode = T(r(0.52), r(0.83), H(be, Z.mul(0.35)))),
    (p.metalnessNode = r(0)),
    (p.specularIntensityNode = r(0.45)),
    (p.sheenNode = J.mul(T(r(0.12), r(0.28), Z))),
    (p.sheenRoughnessNode = r(0.6)),
    (p.iridescenceNode = t.iridescence.mul(0.12).mul(Q(1.5, t.iridescence))),
    (p.iridescenceIORNode = r(1.5)),
    (p.iridescenceThicknessNode = T(r(300), r(520), m)));
  const ke = wt(_a.mul(bt(K, 0)).xyz).mul(Ho),
    Ke = b(0.05, 0.8, yt(ke, t.keyDirection).negate()),
    ze = b(0.55, 0.95, Fe).mul(b(0.4, 0.9, v)),
    fe = T(r(0.18), r(0.42), Z)
      .mul(Ke)
      .add(ze.mul(0.23))
      .mul(T(r(1), r(0.28), ne))
      .mul(oe.mul(-0.45).add(1));
  return (
    (p.emissiveNode = S.mul(S)
      .mul(1.6)
      .add(S.mul(0.4))
      .mul(O(1.05, 0.82, 0.68))
      .mul(fe)),
    p
  );
}
function ks() {
  return {
    now: q(0, "float"),
    bodyPos: q(new l()),
    bodyQuat: q(new ts(0, 0, 0, 1)),
    bodyScale: q(new l(1, 1, 1)),
    jiggle: q(new l()),
    shiver: q(0, "float"),
    coatRadii: q(new l(0.22, 0.22, 0.22)),
    rouseOrigin: q(new l(0, 0, 1)),
    rouseStart: q(-2, "float"),
    bars: q(0, "float"),
    motif: q(0, "float"),
    markings: q(0, "float"),
    fluff: q(0, "float"),
    fluffAngle: q(1, "float"),
    brow: q(0, "float"),
    skinR: q(0.22, "float"),
    blowPower: q(0, "float"),
    blowPos: q(new l(9, 9, 9)),
    blowDir: q(new l(0, 0, -1)),
    hover: q(0, "float"),
    iridescence: q(1, "float"),
    keyDirection: q(new l()),
  };
}
function zs(e) {
  let t = e >>> 0;
  return () => {
    t = (t + 1831565813) | 0;
    let n = Math.imul(t ^ (t >>> 15), 1 | t);
    return (
      (n = (n + Math.imul(n ^ (n >>> 7), 61 | n)) ^ n),
      ((n ^ (n >>> 14)) >>> 0) / 4294967296
    );
  };
}
const pt = new l(),
  ho = new l(),
  An = new l(),
  Ln = new ss();
function ye(e, t) {
  return (
    ho.copy(e).normalize(),
    pt.crossVectors(ho, t),
    pt.lengthSq() < 1e-6 && pt.set(1, 0, 0),
    pt.normalize(),
    An.crossVectors(pt, ho).normalize(),
    Ln.makeBasis(pt, ho, An),
    new ko().setFromRotationMatrix(Ln)
  );
}
const Yn = {
    Coral: {
      coat: ["#ec6e48", "#f69467", "#d4513a"],
      belly: "#ffd3b8",
      face: "#ffe2cf",
      crest: "#e2553a",
      iris: "#6a3a26",
      tip: "#c9452f",
      feet: "#e09474",
      blush: "#ff8475",
      markings: 0.18,
    },
    Apricot: {
      coat: ["#f4a259", "#f7c08a", "#e07a3f"],
      belly: "#ffe6c9",
      face: "#fff0de",
      crest: "#e8763a",
      iris: "#5a3a26",
      tip: "#d8662f",
      feet: "#e0a070",
      blush: "#ff9a7a",
      markings: 0.15,
    },
    Snow: {
      coat: ["#f3f0ea", "#ffffff", "#e1dbd1"],
      belly: "#fffaf3",
      face: "#fbf9f5",
      crest: "#e9e3d8",
      iris: "#7a5532",
      tip: "#eae5dc",
      feet: "#e3b37c",
      blush: "#f3b8bd",
      markings: 0.18,
    },
    Ink: {
      coat: ["#23252e", "#333742", "#161820"],
      belly: "#3f3c49",
      face: "#48434e",
      crest: "#313440",
      iris: "#c48a4b",
      tip: "#373945",
      feet: "#8b6959",
      blush: "#805565",
      markings: 0,
    },
    Parakeet: {
      coat: ["#8dbf74", "#bdd985", "#5c9b70"],
      belly: "#efe7a5",
      face: "#e2e7a8",
      crest: "#74ac89",
      iris: "#84644b",
      tip: "#a5c990",
      feet: "#dda982",
      blush: "#edaa98",
      markings: 0.3,
    },
    Sunbird: {
      coat: ["#f7bd61", "#f7d77f", "#e59259"],
      belly: "#ffe8ab",
      face: "#fff0bd",
      crest: "#efa172",
      iris: "#906241",
      tip: "#f2c075",
      feet: "#d89861",
      blush: "#ef9984",
      markings: 0.22,
    },
    Kingfisher: {
      coat: ["#4388ab", "#69bac1", "#355c94"],
      belly: "#f7b782",
      face: "#f7cf9d",
      crest: "#376d9d",
      iris: "#bd7c4c",
      tip: "#659db1",
      feet: "#dc997b",
      blush: "#ed9787",
      markings: 0.3,
    },
    Flamingo: {
      coat: ["#eaa1ad", "#f6bcc7", "#cf7891"],
      belly: "#ffe0dd",
      face: "#fbd7d9",
      crest: "#df859c",
      iris: "#815563",
      tip: "#e7a0b3",
      feet: "#d88b8c",
      blush: "#e8879b",
      markings: 0.25,
    },
    Lorikeet: {
      coat: ["#718bd1", "#79bfc1", "#9c83c7"],
      belly: "#f4abbd",
      face: "#f9d49e",
      crest: "#cc87ac",
      iris: "#a96d53",
      tip: "#a79ecf",
      feet: "#dfaa83",
      blush: "#ea96a7",
      markings: 0.36,
    },
    Moss: {
      coat: ["#74987b", "#9bb58a", "#4d7567"],
      belly: "#d3d6a4",
      face: "#c6cfab",
      crest: "#779981",
      iris: "#ad7c53",
      tip: "#99ae8e",
      feet: "#c69b7b",
      blush: "#d7988f",
      markings: 0.33,
    },
    Plum: {
      coat: ["#9478ba", "#b498d6", "#705685"],
      belly: "#e8bfdf",
      face: "#e2c2eb",
      crest: "#ab86c3",
      iris: "#9c6957",
      tip: "#bb9dce",
      feet: "#c28b88",
      blush: "#dc92bc",
      markings: 0.28,
    },
    Ember: {
      coat: ["#d87562", "#ed9c64", "#ae5b58"],
      belly: "#f7c98c",
      face: "#f7d3a4",
      crest: "#d38373",
      iris: "#97604b",
      tip: "#e69d7a",
      feet: "#bc806a",
      blush: "#e79386",
      markings: 0.28,
    },
  },
  Ut = Object.keys(Yn),
  Tn = ["ombre", "cape", "sweep", "banded"],
  Fn = ["tipped", "tipped", "plain"],
  go = ["tuft", "ears", "curl", "pompom", "antennae", "mohawk", "plume"],
  Mo = ["glossy", "button", "sparkle", "sleepy"],
  Vn = [
    "Mop",
    "Puff",
    "Tuft",
    "Fuzzle",
    "Bobbin",
    "Pip",
    "Fluff",
    "Wisp",
    "Mumble",
    "Dandy",
    "Pompon",
    "Ruff",
    "Scruff",
    "Floof",
  ],
  En = (e) =>
    new Uo({
      color: e,
      roughness: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    });
function Ps(e, t = "glossy") {
  const u = document.createElement("canvas");
  ((u.width = 512), (u.height = 256));
  const a = u.getContext("2d");
  ((a.fillStyle = "#0b0705"), a.fillRect(0, 0, 512, 256));
  const h = 512 * 0.25,
    p = 256 * 0.5;
  (a.save(), a.translate(h, p));
  const w = new Y(e),
    y = a.createRadialGradient(0, 0, 0, 0, 0, 120),
    f = t === "button" ? 0.86 : t === "sparkle" ? 0.6 : 0.5;
  (y.addColorStop(0, "#050304"),
    y.addColorStop(f, "#0a0607"),
    t !== "button" &&
      (y.addColorStop(f + 0.08, w.clone().multiplyScalar(0.35).getStyle()),
      y.addColorStop(
        Math.min(0.8, f + 0.2),
        w
          .clone()
          .multiplyScalar(t === "sparkle" ? 1.25 : 1)
          .getStyle(),
      ),
      y.addColorStop(0.86, w.clone().multiplyScalar(0.5).getStyle())),
    y.addColorStop(0.9, "#0b0705"),
    y.addColorStop(1, "#0b0705"),
    (a.fillStyle = y),
    a.beginPath(),
    a.arc(0, 0, 120, 0, 6.29),
    a.fill(),
    (a.globalAlpha = 0.18));
  for (let R = 0; R < 120; R++) {
    const V = (R / 120) * 6.283;
    ((a.strokeStyle = R % 2 ? "#000" : "#fff"),
      (a.lineWidth = 1.5),
      a.beginPath(),
      a.moveTo(Math.cos(V) * 66, Math.sin(V) * 66),
      a.lineTo(Math.cos(V) * 100, Math.sin(V) * 100),
      a.stroke());
  }
  if (((a.globalAlpha = 1), (a.fillStyle = "#fff"), t === "button"))
    (a.beginPath(), a.ellipse(-26, -30, 22, 24, -0.4, 0, 6.29), a.fill());
  else if (t === "sparkle") {
    (a.beginPath(),
      a.ellipse(-30, -32, 20, 22, -0.4, 0, 6.29),
      a.fill(),
      a.beginPath(),
      a.arc(30, 26, 10, 0, 6.29),
      a.fill(),
      (a.globalAlpha = 0.8));
    for (const [R, V, P] of [
      [-8, 44, 5],
      [40, -12, 4],
      [-44, 10, 3],
    ])
      (a.beginPath(), a.arc(R, V, P, 0, 6.29), a.fill());
  } else
    (a.beginPath(),
      a.ellipse(-30, -34, 15, 17, -0.4, 0, 6.29),
      a.fill(),
      (a.globalAlpha = 0.6),
      a.beginPath(),
      a.arc(28, 30, 6, 0, 6.29),
      a.fill());
  a.restore();
  const F = new Qn(u);
  return ((F.colorSpace = Wn), (F.anisotropy = 8), F);
}
function Cs(e) {
  const t = Array.from({ length: 6 }, () => [
    e() * 6 + 2,
    e() * 6 + 2,
    e() * 6 + 2,
    e() * 6.28,
  ]);
  return (n, o, u) =>
    t.reduce((a, [h, p, w, y]) => a + Math.sin(h * n + p * o + w * u + y), 0) /
    t.length;
}
function Rs(e, t, n = {}) {
  const o = zs(e),
    u = Ut[Math.floor(o() * Ut.length)],
    a = Ut.includes(t) ? t : u,
    h = Yn[a],
    p = Vn[Math.floor(o() * Vn.length)],
    w = Tn[Math.floor(o() * Tn.length)],
    y = go[Math.floor(o() * go.length)],
    f = go.includes(n.top) ? n.top : y,
    F = Mo[Math.floor(o() * Mo.length)],
    R = Mo.includes(n.eyes) ? n.eyes : F,
    V = Fn[Math.floor(o() * Fn.length)],
    P = 1 + Math.floor(o() * 3),
    G = P === 3 && o() < 0.5 ? 0.6 + o() * 0.4 : 0,
    A = h.markings ? V : "plain",
    I = h.markings ? P : 0,
    et = G * h.markings,
    _e = new Y(h.tip),
    qe = [2, 2, 2, 2, 1][Math.floor(o() * 5)],
    re = o() < 0.75 ? 2 : 3,
    Je = 0.22,
    ce = Je * (0.95 + o() * 0.2),
    _ = Je * (0.95 + o() * 0.3),
    $ = Je * (0.9 + o() * 0.15),
    xt = 0.1 + o() * 0.07,
    kt = Cs(o),
    v = h.coat.map((s) => new Y(s)),
    zt = new Y(h.belly),
    j =
      (qe === 1 ? 0.1 : 0.074) *
      (0.95 + o() * 0.15) *
      (R === "button" ? 0.62 : R === "sparkle" ? 1.12 : 1),
    Me = qe === 1 ? 0 : 0.4 + o() * 0.06,
    ie = [];
  for (let s = 0; s < qe; s++) {
    const i = qe === 1 ? 0 : (s / (qe - 1) - 0.5) * 2,
      m = 0.1 + o() * 0.05;
    ie.push(new l(Math.sin(i * Me), m, Math.cos(i * Me)).normalize());
  }
  const ve = (s) => new l(s.x * ce, s.y * _, s.z * $),
    de = (s) =>
      new l(s.x / (ce * ce), s.y / (_ * _), s.z / ($ * $)).normalize(),
    Ue = new jt("Contour"),
    zo = Object.assign(new jt("Contour", "high"), { brow: !0 }),
    Xe = Object.assign(new jt("Tail", "high"), { free: !0 }),
    tt = new jt("Down"),
    U = Object.assign(
      new jt(
        f === "curl"
          ? "Curl"
          : f === "antennae"
            ? "Ribbon"
            : f === "tuft" || f === "pompom"
              ? "Down"
              : "Plume",
        f === "antennae" || f === "plume" || f === "curl" || f === "ears"
          ? "high"
          : "low",
      ),
      { free: !0, crest: !0 },
    ),
    Kt = ve(ie.reduce((s, i) => s.add(i), new l()).normalize()),
    ot = Math.PI * (3 - Math.sqrt(5)),
    Pt = new Y(h.blush ?? "#ff8a9a"),
    $t =
      ie.length === 2
        ? ie.map((s) => new l(s.x * 1.55, s.y - 0.3, 0).setZ(1).normalize())
        : [
            new l(-0.5, -0.2, 0.85).normalize(),
            new l(0.5, -0.2, 0.85).normalize(),
          ],
    te = Re.smoothstep,
    nt = (s, i) => {
      const m = kt(s.x * 1.1, s.y * 1.1, s.z * 1.1) * 0.12;
      let g;
      if (w === "ombre")
        g = v[0]
          .clone()
          .lerp(v[1], te(s.y + m, -0.2, 0.75))
          .lerp(v[2], te(-s.y + m, 0.35, 1) * 0.85);
      else if (w === "cape")
        g = v[0]
          .clone()
          .lerp(v[2], te(-s.z * 0.8 + s.y * 0.5 + m, -0.1, 0.6))
          .lerp(v[1], te(s.y, 0.7, 1) * 0.6);
      else if (w === "sweep")
        g = v[0]
          .clone()
          .lerp(
            v[1],
            te((Math.atan2(s.x, s.z) / Math.PI) * 0.5 + 0.5 + m, 0.15, 0.85),
          )
          .lerp(v[2], te(-s.y, 0.5, 1) * 0.6);
      else {
        const k = Math.sin(s.y * 9 + m * 6);
        g = v[0]
          .clone()
          .lerp(v[1], te(k, 0.2, 0.8) * 0.8)
          .lerp(v[2], te(-s.y, 0.55, 1) * 0.6);
      }
      g.lerp(zt, te(s.z * 0.8 - s.y * 0.7, 0.4, 0.9) * 0.75);
      const S = o() - 0.5;
      return (
        g.offsetHSL((i - 0.5) * 0.012, 0.08, S * (0.006 + h.markings * 0.03)),
        g
      );
    },
    Ct = (s, i, m, g, S) => {
      for (let k = 0; k < i; k++) {
        const L = 1 - ((k + 0.5) / i) * 2,
          ue = Math.sqrt(1 - L * L),
          D = k * ot,
          C = new l(Math.cos(D) * ue, L, Math.sin(D) * ue);
        ((C.x += (o() - 0.5) * 0.04),
          (C.z += (o() - 0.5) * 0.04),
          C.normalize());
        let E = 9;
        for (const ze of ie) E = Math.min(E, C.angleTo(ze));
        const B = (j / Je) * 0.8;
        if (E < B * 1.5) continue;
        const Te = ve(C),
          X = de(Te),
          K = Te.clone().sub(Kt),
          me = K.length(),
          Fe = Re.smoothstep(me, j * 0.8, j * 2.2),
          oe = K.normalize()
            .multiplyScalar((1.6 * Math.exp(-me * 4) + 0.5) * Fe)
            .add(new l(0, -0.8 - (1 - Fe) * 1.5, -0.3 * Fe));
        let ne = oe
            .sub(X.clone().multiplyScalar(oe.dot(X)))
            .normalize()
            .clone(),
          Z = 0;
        if (E < B * 2.2) {
          const ze = ie.reduce((ee, Tt) =>
              C.angleTo(Tt) < C.angleTo(ee) ? Tt : ee,
            ),
            fe = C.clone().sub(ze).normalize(),
            z = fe.sub(X.clone().multiplyScalar(fe.dot(X))).normalize();
          ((Z = 1 - Re.smoothstep(E, B, B * 2.2)), ne.lerp(z, Z));
        }
        ne.normalize();
        const J = o();
        let xe = nt(C, J);
        Z > 0.05 && (xe = xe.lerp(new Y(h.face), 0.85 * Z));
        for (const ze of $t) {
          const fe = 1 - Re.smoothstep(C.angleTo(ze), 0.08, 0.28);
          fe > 0 && xe.lerp(Pt, 0.55 * fe);
        }
        let ke = m(C, Z) * (0.85 + 0.3 * o());
        for (const ze of ie) {
          const fe = ve(ze).sub(Te),
            z = fe.length();
          z < 0.11 * ke + j * 1.05 &&
            fe.normalize().dot(ne) > 0.1 &&
            (ke = Math.min(ke, Math.max(0.12, (z - j * 1.02) / 0.11)));
        }
        const Ke =
          A === "tipped"
            ? xe.clone().lerp(_e, 0.5)
            : A === "frosted"
              ? xe.clone().lerp(new Y(1, 1, 1), 0.55)
              : xe;
        (Te.multiplyScalar(S).addScaledVector(
          ne,
          Math.floor(o() * 5) * 0.045 * 0.11 * ke,
        ),
          s.add(
            Te,
            ye(ne, X),
            ke,
            xe,
            X,
            g * (0.8 + 0.4 * o()),
            o(),
            o() * 6.28,
            Ke,
          ));
      }
    };
  (Ct(
    Ue,
    7600,
    (s, i) =>
      (1 - 0.3 * Re.smoothstep(s.y, 0.45, 0.95)) *
      (1 + 0.45 * Re.smoothstep(-s.y, -0.2, 0.9) * (1 - Math.abs(s.z) * 0.4)) *
      (1 - 0.72 * i),
    1,
    0.975,
  ),
    Ct(tt, 2600, () => 1.3, 1, 0.965));
  const at = new l(0, _, 0),
    Se = new Y(h.crest);
  if (f === "antennae")
    for (const s of [-1, 1])
      for (let i = 0; i < 3; i++) {
        const m = new l(s * (0.35 + i * 0.12), 1, -0.1 + i * 0.1).normalize();
        U.add(
          at.clone().add(new l(s * 0.03, -0.02, 0.02)),
          ye(m, new l(-s, 0.2, 0.6)),
          0.7 + (0.25 * (2 - i)) / 2,
          Se.clone().offsetHSL(0, 0, i * 0.06),
          m,
          1.4,
          o(),
          o() * 6.28,
        );
      }
  else if (f === "mohawk")
    for (let s = 0; s < 13; s++) {
      const i = (s / 12 - 0.4) * 1.9,
        m = new l(0, Math.cos(i) * _, Math.sin(i) * $).multiplyScalar(0.95),
        g = de(m)
          .add(new l(0, 0, -0.5))
          .normalize();
      U.add(
        m,
        ye(g, new l(1, 0, 0)),
        0.55 + 0.35 * Math.sin((s / 12) * Math.PI),
        Se,
        g,
        0.8,
        o(),
        o() * 6.28,
      );
    }
  else if (f === "ears")
    for (const s of [-1, 1])
      for (let i = 0; i < 5; i++) {
        const m = ve(new l(s * 0.55, 0.8, 0.2).normalize()).multiplyScalar(
            0.95,
          ),
          g = new l(s * (0.55 + i * 0.08), 1, 0.05 - i * 0.06).normalize();
        U.add(
          m,
          ye(g, new l(0, 0, 1)),
          0.42 + (0.12 * (4 - i)) / 4,
          Se.clone().offsetHSL(0, 0, (i - 2) * 0.03),
          g,
          0.9,
          o(),
          o() * 6.28,
        );
      }
  else if (f === "curl")
    for (let s = 0; s < 40; s++) {
      const i = (s / 40) * 6.283 * 2.618 + o() * 0.3,
        m = 0.1 + 0.75 * Math.sqrt(o()),
        g = ve(
          new l(Math.sin(i) * m, 1, Math.cos(i) * m * 0.8).normalize(),
        ).multiplyScalar(1.03),
        S = new l(
          Math.sin(i) * (0.5 + m),
          1,
          Math.cos(i) * (0.4 + m),
        ).normalize(),
        k = new l(Math.cos(i), 0, -Math.sin(i)),
        L = Se.clone()
          .lerp(_e, 0.45)
          .offsetHSL(0, 0.05, (o() - 0.5) * 0.1);
      U.add(
        g,
        ye(S, k),
        0.95 + o() * 0.4,
        L,
        S,
        4.2 + o() * 1.4,
        o(),
        o() * 6.28,
        L.clone().offsetHSL(0, 0, 0.12),
      );
    }
  else if (f === "pompom") {
    const s = at.clone().multiplyScalar(1.02);
    for (let i = 0; i < 140; i++) {
      const m = new l(o() - 0.5, o() * 0.9 + 0.1, o() - 0.5).normalize();
      U.add(
        s.clone().addScaledVector(m, 0.012),
        ye(m, new l(o() - 0.5, 0, o() - 0.5).add(m)),
        0.8 + o() * 0.35,
        Se.clone().offsetHSL(0, 0, (o() - 0.5) * 0.08),
        m,
        1.6,
        o(),
        o() * 6.28,
      );
    }
  } else if (f === "tuft")
    for (let s = 0; s < 60; s++) {
      const i = new l((o() - 0.5) * 0.9, 1, (o() - 0.5) * 0.9).normalize();
      U.add(
        at.clone().multiplyScalar(0.95),
        ye(i, new l(o() - 0.5, 0, o() - 0.5)),
        1.4 + o() * 0.8,
        Se.clone().offsetHSL(0, 0, (o() - 0.5) * 0.1),
        i,
        1.3,
        o(),
        o() * 6.28,
      );
    }
  else
    for (let s = 0; s < 4; s++) {
      const i = new l((o() - 0.5) * 0.5, 1, -0.3 - o() * 0.3).normalize();
      U.add(
        at.clone().multiplyScalar(0.95),
        ye(i, new l(0, 0, 1)),
        0.75 + o() * 0.35,
        Se.clone().offsetHSL(0, 0, s * 0.04),
        i,
        1.4,
        o(),
        o() * 6.28,
      );
    }
  {
    const s = ve(new l(0, -0.6, -1).normalize()).multiplyScalar(0.93),
      i = 11;
    for (let m = 0; m < i; m++) {
      const g = m / (i - 1) - 0.5,
        S = new l(g * 1.6, 0.3 - Math.abs(g) * 0.35, -1).normalize(),
        k = new l(g * 0.4, 0.4, -1).normalize(),
        L = new Y(h.crest)
          .lerp(v[1], Math.abs(g) * 1.4)
          .offsetHSL(0, 0, (o() - 0.5) * 0.05);
      Xe.add(
        s.clone().addScaledVector(S, 0.02),
        ye(S, k),
        (1.25 - Math.abs(g) * 0.6) * (0.95 + o() * 0.1),
        L,
        k,
        0.7,
        o(),
        o() * 6.28,
        L.clone().lerp(_e, 0.6),
      );
    }
  }
  const Ye = new Gt(),
    Rt = new pe(
      new Ot(1, 48, 32),
      new xn({ color: v[0].clone().multiplyScalar(0.55), roughness: 1 }),
    );
  (Rt.scale.set(ce * 0.965, _ * 0.965, $ * 0.965),
    (Rt.castShadow = !0),
    Ye.add(Rt));
  const At = new pe(
    new Ot(1, 32, 16),
    new Bn({ colorWrite: !1, depthWrite: !1 }),
  );
  (At.scale.set(ce * 1.22, _ * 1.18, $ * 1.22),
    (At.castShadow = !0),
    Ye.add(At));
  const Po = Ps(h.iris, R),
    we = new Y(h.face),
    Lt = (s) => {
      const i = document.createElement("canvas");
      ((i.width = 512), (i.height = 128));
      const m = i.getContext("2d");
      ((m.fillStyle = we.getStyle()), m.fillRect(0, 0, 512, 128));
      for (let k = 0; k < 1400; k++) {
        const L = Math.random() * 512,
          ue = Math.random() * 128,
          D = 6 + Math.random() * 14,
          C = Math.random();
        ((m.strokeStyle = (
          C < 0.5
            ? we.clone().offsetHSL(0, 0, 0.08)
            : we.clone().offsetHSL(0, 0.05, -0.08)
        ).getStyle()),
          (m.globalAlpha = 0.5),
          (m.lineWidth = 1.5),
          m.beginPath(),
          m.moveTo(L, ue),
          m.lineTo(L + (Math.random() - 0.5) * 3, ue + (s ? -D : D)),
          m.stroke());
      }
      m.globalAlpha = 1;
      const g = m.createLinearGradient(0, s ? 128 : 0, 0, s ? 100 : 28);
      (g.addColorStop(0, "#1a0f0a"),
        g.addColorStop(1, "rgba(26,15,10,0)"),
        (m.fillStyle = g),
        m.fillRect(0, 0, 512, 128));
      const S = new Qn(i);
      return ((S.colorSpace = Wn), (S.anisotropy = 8), S);
    },
    Zt = (s) =>
      new Uo({
        map: s,
        roughness: 0.8,
        sheen: 1,
        sheenColor: we.clone().lerp(new Y(1, 1, 1), 0.5),
        sheenRoughness: 0.4,
      }),
    Co = Zt(Lt(!0)),
    st = Zt(Lt(!1)),
    Jt = new xn({ color: 1313543, roughness: 0.5 }),
    eo = new Y(h.tip).lerp(we, 0.25),
    to = ie.map((s) => {
      const i = new Gt();
      (i.position.copy(ve(s).multiplyScalar(0.865)),
        i.lookAt(i.position.clone().add(s)));
      const m = new Gt(),
        g = new pe(
          new Ot(j, 48, 32),
          new Uo({
            map: Po,
            roughness: 0.15,
            specularIntensity: 0.45,
            clearcoat: 0.3,
            clearcoatRoughness: 0.02,
          }),
        );
      ((g.castShadow = !0), (g.scale.z = 0.8), m.add(g), i.add(m));
      const S = new pe(
          new Ot(j * 1.035, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2),
          Co,
        ),
        k = new pe(
          new Ot(j * 1.03, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
          st,
        );
      S.castShadow = k.castShadow = !0;
      const L = new pe(new kn(j * 1.035, j * 0.03, 8, 64), Jt);
      ((L.rotation.x = Math.PI / 2), S.add(L));
      const ue = new pe(new kn(j * 1.03, j * 0.025, 8, 64), Jt);
      ((ue.rotation.x = Math.PI / 2), k.add(ue));
      const D = ie.length === 1 ? 1 : Math.sign(s.x) || 1;
      (i.add(S, k), Ye.add(i));
      const C = s.clone(),
        E = new l().crossVectors(C, new l(0, 1, 0)).normalize(),
        B = new l().crossVectors(E, C);
      [
        [0.98, 54, 0.22, eo],
        [1.14, 60, 0.28, we],
        [1.32, 66, 0.34, we],
      ].forEach(([X, K, me, Fe], oe) => {
        for (let be = 0; be < K; be++) {
          const ne = ((be + oe * 0.5) / K) * 6.283 + (o() - 0.5) * 0.05,
            Z = E.clone()
              .multiplyScalar(Math.cos(ne))
              .addScaledVector(B, Math.sin(ne)),
            J = i.position.clone().addScaledVector(Z, j * X),
            xe = Math.sqrt((J.x / ce) ** 2 + (J.y / _) ** 2 + (J.z / $) ** 2),
            ke = J.divideScalar(xe).multiplyScalar(0.985);
          if (
            ie.some(
              (z) =>
                z !== s && ke.distanceTo(ve(z).multiplyScalar(0.9)) < j * 1.25,
            )
          )
            continue;
          const Ke = de(ke)
              .lerp(C, oe === 0 ? 0.5 : 0.2)
              .normalize(),
            ze = Z.clone().addScaledVector(Ke, -Z.dot(Ke)).normalize(),
            fe = Fe.clone().offsetHSL(
              0,
              0,
              (o() - 0.5) * (0.008 + h.markings * 0.035),
            );
          Ue.add(
            ke,
            ye(ze, Ke),
            me * (0.9 + o() * 0.2),
            fe,
            Ke,
            0.5,
            o(),
            o() * 6.28,
            fe.clone().lerp(we, oe ? 0.24 : 0.1),
          );
        }
      });
      for (let X = 0; X < 9; X++) {
        const K = Math.PI / 2 + (X / 8 - 0.5) * 1.5 * (D > 0 ? 1 : -1),
          me = E.clone()
            .multiplyScalar(Math.cos(K))
            .addScaledVector(B, Math.sin(K)),
          Fe = i.position
            .clone()
            .addScaledVector(me, j * 1.4)
            .addScaledVector(C, j * 0.05),
          oe = C.clone().addScaledVector(me, 0.5).normalize(),
          be = me
            .clone()
            .multiplyScalar(0.6)
            .add(E.clone().multiplyScalar(D * 0.8))
            .addScaledVector(new l(0, 1, 0), 0.3);
        be.addScaledVector(oe, -be.dot(oe)).normalize();
        const ne = new Y(h.crest)
          .lerp(we, 0.2)
          .offsetHSL(0, 0, (o() - 0.5) * 0.06);
        zo.add(
          Fe,
          ye(be, oe),
          0.55 + 0.25 * Math.sin((X / 8) * Math.PI),
          ne,
          oe,
          0.8,
          o(),
          o() * 6.28,
          ne.clone().lerp(_e, 0.4),
        );
      }
      return { socket: i, ball: m, upper: S, lower: k };
    }),
    lt = En(h.feet);
  lt.roughness = 0.45;
  const oo = [],
    no = En("#1a120c");
  for (let s = 0; s < re; s++) {
    const m = (re === 1 ? 0 : (s / (re - 1) - 0.5) * 2) * ce * 0.42,
      g = re === 3 && s === 1 ? -$ * 0.25 : $ * 0.05,
      S = -Math.sqrt(Math.max(0, 1 - (m / ce) ** 2 - (g / $) ** 2)) * _ * 0.85,
      k = new Gt();
    k.position.set(m, S, g);
    const L = _ + xt + S,
      ue = new pe(new zn(0.011, Math.max(0.01, L - 0.01), 4, 12), lt);
    ((ue.position.y = -L / 2), k.add(ue));
    for (let D = 0; D < 3; D++) {
      const C = new pe(new zn(0.007, 0.032, 4, 8), lt),
        E = (D - 1) * 0.55;
      (C.position.set(
        Math.sin(E) * 0.018,
        -L + 0.004,
        Math.cos(E) * 0.018 + 0.004,
      ),
        C.rotation.set(Math.PI / 2 - 0.1, 0, -E),
        k.add(C));
      const B = new pe(new ls(0.005, 0.014, 8), no);
      (B.position.set(
        Math.sin(E) * 0.04,
        -L + 0.003,
        Math.cos(E) * 0.04 + 0.004,
      ),
        B.rotation.set(Math.PI / 2 + 0.3, 0, -E),
        k.add(B));
    }
    k.traverse((D) => {
      D.isMesh && (D.castShadow = !0);
    });
    for (let D = 0; D < 90; D++) {
      const C = o() * 6.283,
        E = o(),
        B = new l(Math.cos(C), 0, Math.sin(C)),
        Te = new l(m, S - E * L * 0.5, g).addScaledVector(
          B,
          0.012 + 0.01 * (1 - E),
        ),
        X = new l(0, -1, 0),
        K = nt(new l(B.x * 0.5, -0.9, B.z * 0.5 + 0.3).normalize(), o()),
        me =
          A === "tipped"
            ? K.clone().lerp(_e, 0.6)
            : A === "frosted"
              ? K.clone().lerp(new Y(1, 1, 1), 0.5)
              : K;
      (D % 3 ? tt : Ue).add(
        Te,
        ye(X, B),
        (D % 3 ? 0.9 : 0.55) + o() * 0.3,
        K,
        B,
        1.1,
        o(),
        o() * 6.28,
        me,
      );
    }
    (Ye.add(k), oo.push(k));
  }
  const ao = [
    qe === 1 ? "one-eyed" : "two-eyed",
    w === "ombre"
      ? "shaded"
      : w === "cape"
        ? "caped"
        : w === "sweep"
          ? "two-tone"
          : "banded",
    A === "tipped" ? "tipped" : "plain-tipped",
    ["", "chevroned", "spotted", "piped"][I],
    ...(et ? ["barred"] : []),
    {
      antennae: "ribbon feelers",
      mohawk: "crested",
      tuft: "tufted",
      plume: "plumed",
      ears: "ear tufts",
      curl: "curly",
      pompom: "pompom",
    }[f],
    `${R} eyes`,
    `${re} legs`,
  ];
  return {
    sets: [Ue, tt, U, zo, Xe],
    props: Ye,
    eyes: to,
    legs: oo,
    radii: new l(ce, _, $),
    radius: Math.max(ce, _, $),
    rest: _ + xt,
    ry: _,
    R: Je,
    eyeStyle: R,
    top: f,
    restOpen: R === "sleepy" ? 0.5 : 1,
    bars: et,
    motif: I,
    markings: h.markings,
    name: p,
    palette: a,
    traits: ao.filter(Boolean).join(", "),
  };
}
const In = [
  [0.52, 0.38],
  [1.42, 0.27],
  [2.18, 0.27],
  [2.94, 0.46],
  [3.95, 0.34],
];
function As() {
  let e = null,
    t = null,
    n = null,
    o = !1,
    u = 1,
    a = 0.6;
  function h() {
    e ||
      ((e = new AudioContext()),
      (t = e.createGain()),
      (t.gain.value = a),
      t.connect(e.destination),
      fetch(
        new URL(
          "" + new URL("../assets/chirps.m4a", import.meta.url).href,
          import.meta.url,
        ),
      )
        .then((w) => w.arrayBuffer())
        .then((w) => e.decodeAudioData(w))
        .then((w) => {
          n = w;
        })
        .catch(() => {}));
  }
  function p(w = Math.floor(Math.random() * In.length), y = 1, f = 1, F = 0) {
    if (!o || !n) return;
    const [R, V] = In[w],
      P = e.createBufferSource(),
      G = e.createGain();
    ((P.buffer = n),
      (P.playbackRate.value = y * u * (0.96 + Math.random() * 0.08)));
    const A = e.currentTime + F,
      I = V / P.playbackRate.value;
    (G.gain.setValueAtTime(0, A),
      G.gain.linearRampToValueAtTime(f, A + 0.01),
      G.gain.setValueAtTime(f, A + I - 0.04),
      G.gain.linearRampToValueAtTime(0, A + I),
      P.connect(G).connect(t),
      P.start(A, R, V));
  }
  return {
    get on() {
      return o;
    },
    setOn(w) {
      ((o = w), o && (h(), e.resume()));
    },
    setPitch(w) {
      u = w;
    },
    setVolume(w) {
      ((a = w), t && (t.gain.value = w));
    },
    idle() {
      p(void 0, 1.05, 0.45);
    },
    happy() {
      const w = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let y = 0; y < w; y++)
        p(Math.floor(Math.random() * 3) + 1, 1.25 + y * 0.08, 0.6, y * 0.13);
    },
    startle() {
      (p(1, 1.7, 0.8), p(2, 1.9, 0.5, 0.09));
    },
    content() {
      p(Math.random() < 0.5 ? 0 : 4, 0.85, 0.35);
    },
    peck() {
      p(3, 1.5, 0.4);
    },
  };
}
const Qe = As(),
  Ge = new URLSearchParams(location.search),
  Mt = Ge.has("thumb");
Mt && document.body.classList.add("capture");
let Xo = Ge.has("seed") ? Number(Ge.get("seed")) : 7,
  So = Ut.includes(Ge.get("palette")) ? Ge.get("palette") : null;
const _t = { eyes: Ge.get("eyes"), top: Ge.get("top") },
  Ze = { regrow: 8, drop: 1, blownOff: 1 },
  De = await Ua();
De.setPixelRatio(Math.min(devicePixelRatio, 1.5));
De.shadowMap.type = rs;
const le = De.domElement;
le.id = "view";
le.setAttribute("tabindex", "0");
le.setAttribute(
  "aria-label",
  "A round feathered creature on a studio floor. Tap the coat to send a ruffle through it, or press and hold to blow air.",
);
const Ae = new Gn(),
  Ie = new cs(26, innerWidth / innerHeight, 0.05, 60),
  Le = new es(Ie, le);
Le.enableDamping = !0;
Le.dampingFactor = 0.06;
Le.minDistance = 0.8;
Le.maxDistance = 5;
Le.maxPolarAngle = Math.PI * 0.48;
Le.enablePan = !1;
Le.enableRotate = !1;
const he = { on: !1, x: 0, v: 0 };
le.addEventListener("pointerdown", (e) => {
  W.stroking || ((he.on = !0), (he.x = e.clientX), (he.v = 0));
});
addEventListener("pointermove", (e) => {
  he.on &&
    ((he.v = ((e.clientX - he.x) * 5) / Math.max(innerHeight, 1)),
    (he.x = e.clientX),
    (d.heading += he.v));
});
for (const e of ["pointerup", "pointercancel"])
  addEventListener(e, () => {
    he.on = !1;
  });
const Kn = new Y("#f3f2ef"),
  Yo = new l(0.65, 0.6, 0.45).normalize(),
  Ls = b(0.05, 0.85, Xa(Ya.sub(0.5)));
Ae.backgroundNode = Ka(Kn.clone().multiplyScalar(2.1)).mul(
  Ls.mul(-0.32).add(1),
);
const Ko = new Gn();
Ko.background = Kn.clone().multiplyScalar(1.35);
const Yt = new pe(new _n(8, 7), new Bn({ color: new Y(4.2, 4.15, 4.05) }));
Yt.position.copy(Yo).multiplyScalar(10);
Yt.lookAt(0, 0, 0);
Ko.add(Yt);
const $n = new $a(De);
Ae.environment = $n.fromScene(Ko, 0.035).texture;
Ae.environmentIntensity = 0.95;
$n.dispose();
Yt.geometry.dispose();
Yt.material.dispose();
const $o = new pe(new _n(30, 30), new Za({ color: 5328199, opacity: 0.13 }));
$o.rotation.x = -Math.PI / 2;
$o.receiveShadow = !0;
Ae.add($o);
const ge = new is(16776438, 3.1);
ge.position
  .copy(Yo)
  .multiplyScalar(4)
  .add(new l(0, 0.3, 0));
ge.target.position.y = 0.3;
ge.castShadow = !0;
ge.shadow.mapSize.set(2048, 2048);
ge.shadow.bias = -4e-4;
ge.shadow.normalBias = 0.003;
ge.shadow.radius = 16;
Object.assign(ge.shadow.camera, {
  left: -1.4,
  right: 1.4,
  top: 1.4,
  bottom: -1.4,
  near: 0.5,
  far: 8,
});
Ae.add(ge, ge.target);
const Ts = gs(ge, { renderer: De }),
  M = ks();
M.keyDirection.value.copy(Yo);
let N = null,
  $e = null,
  We = [];
const vt = new Gt();
Ae.add(vt);
const d = {
    heading: 0,
    p: new l(),
    v: new l(),
    prevV: new l(),
    lean: new l(),
    leanV: new l(),
    squash: 0,
    squashV: 0,
    jig: new l(),
    jigV: new l(),
    hop: 2,
  },
  se = new ko();
let Be = 0;
function Xt() {
  for (const e of [...vt.children]) vt.remove(e);
  $e &&
    (Ae.remove($e),
    $e.traverse((e) => {
      (e.geometry?.dispose(), e.material?.dispose?.());
    }));
  for (const e of We)
    (Ae.remove(e), e.geometry.dispose(), e.material.dispose());
  ((N = Rs(Xo, So, _t)), ($e = N.props), Ae.add($e));
  for (const e of N.legs) vt.add(e);
  ((We = N.sets
    .filter((e) => e.count)
    .map((e) => {
      const t = Ss(e, M),
        n = new Float32Array(e.count * 3),
        o = new ko(),
        u = new l();
      for (let a = 0; a < e.count; a++)
        (o.fromArray(e.quat, a * 4),
          u.set(0, 1, 0).applyQuaternion(o),
          n.set([u.x, u.y, u.z], a * 3));
      return ((t.userData.shaft = n), Ae.add(t), t);
    })),
    (M.bars.value = N.bars),
    (M.skinR.value = N.R),
    M.coatRadii.value.copy(N.radii),
    (M.rouseStart.value = -2),
    Qe.setPitch(0.8 + (((Xo * 9301 + 49297) % 233280) / 233280) * 0.5),
    (M.motif.value = N.motif),
    (M.markings.value = N.markings),
    d.p.set(0, N.rest, 0),
    d.v.set(0, 0, 0),
    (Zn = We.reduce((e, t) => e + t.userData.set.count, 0)),
    Jn());
}
let Zn = 0;
function Jn() {
  let e = 0;
  for (const t of We) {
    const n = t.geometry.attributes.aFly1.array;
    for (let o = 0; o < n.length; o += 4) (n[o] < 0 || Be > n[o + 2]) && e++;
  }
  le.setAttribute(
    "aria-label",
    `A round feathered creature, ${N.palette.toLowerCase()}: ${N.traits}. ${e.toLocaleString()} of ${Zn.toLocaleString()} feathers on. Click to make it puff up; press and hold to blow air.`,
  );
}
function St() {
  const e = Re.degToRad(Ie.fov),
    t = Math.max(1, 0.75 / Ie.aspect);
  Le.target.set(0, N.rest * 0.85, 0);
  const n = (0.62 / Math.tan(e / 2)) * t;
  Ie.position
    .set(0, N.rest + 0.18, 0)
    .addScaledVector(new l(0.18, 0.12, 1).normalize(), n);
}
const Qt = new l(),
  wo = new l();
function ea(e, t, n, o) {
  const u = e.userData.set,
    a = e.geometry.attributes.aFly0.array,
    h = e.geometry.attributes.aFly1.array,
    p = e.geometry.attributes.aFly2.array;
  if (h[t * 4] >= 0) return !1;
  (Qt.set(u.pos[t * 4], u.pos[t * 4 + 1], u.pos[t * 4 + 2])
    .applyQuaternion(se)
    .add(d.p),
    wo
      .set(u.normal[t * 3], u.normal[t * 3 + 1], u.normal[t * 3 + 2])
      .applyQuaternion(se));
  const w = d.v.x * 0.55 + wo.x * n * (0.4 + Math.random()),
    y = d.v.z * 0.55 + wo.z * n * (0.4 + Math.random()),
    f = o ? 0.6 + Math.random() * 0.9 : 0,
    F =
      d.v.y * 0.4 +
      wo.y * n * 0.6 +
      0.25 +
      Math.random() * 0.4 +
      (o?.y ?? 0) * f,
    R = Xn[u.species].fall * (0.75 + 0.5 * Math.random()),
    V = 0.003 + Math.random() * 0.012;
  let P = 0;
  for (; P < 30 && Qt.y + (F * (1 - Math.exp(-3 * P))) / 3 - R * P > V; )
    P += 0.01;
  return (
    a.set([Qt.x, Qt.y, Qt.z, 0], t * 4),
    h.set([Be, P, Be + P + Ze.regrow + Math.random() * 4, R], t * 4),
    p.set([w + (o?.x ?? 0) * f, F, y + (o?.z ?? 0) * f], t * 4),
    !0
  );
}
function ta() {
  for (const e of We)
    for (const t of ["aFly0", "aFly1", "aFly2"])
      e.geometry.attributes[t].needsUpdate = !0;
}
function Fs(e, t) {
  let n = 0,
    o = 0;
  for (; n < e && o < e * 6; ) {
    o++;
    const u =
      We[Math.random() < 0.8 ? 0 : Math.floor(Math.random() * We.length)];
    ea(u, Math.floor(Math.random() * u.userData.set.count), t) && n++;
  }
  return (n && ta(), n);
}
const Dn = new l(),
  qn = new l();
function Vs(e) {
  const t = We[0],
    n = t.userData.set,
    o = M.blowPos.value;
  for (let u = 0; u < 60; u++) {
    const a = Math.floor(Math.random() * n.count);
    Dn.set(n.pos[a * 4], n.pos[a * 4 + 1], n.pos[a * 4 + 2])
      .applyQuaternion(se)
      .add(d.p);
    const h = Dn.clone().sub(o),
      p = h.dot(e);
    if (
      !(h.addScaledVector(e, -p).length() > 0.09) &&
      (qn
        .set(n.normal[a * 3], n.normal[a * 3 + 1], n.normal[a * 3 + 2])
        .applyQuaternion(se),
      !(qn.dot(e) < -0.2) &&
        ea(
          t,
          a,
          0.3,
          e
            .clone()
            .multiplyScalar(1.6)
            .add(new l(0, 0.5, 0)),
        ))
    ) {
      ta();
      return;
    }
  }
}
function Es() {
  for (const e of We) {
    const t = e.geometry.attributes.aFly1,
      n = t.array;
    let o = !1;
    for (let u = 0; u < n.length; u += 4)
      n[u] >= 0 && Be > n[u + 2] + 1.4 && ((n[u] = -1), (o = !0));
    o && (t.needsUpdate = !0);
  }
}
const je = new ds(),
  xo = new us(),
  W = { down: null, stroking: !1 },
  oa = 180,
  na = 6,
  bo = new ws(),
  Nn = new Un(new l(), 1),
  Bo = new l(),
  c = {
    hover: 0,
    blowFor: 0,
    joy: 0,
    startle: 0,
    bliss: 0,
    stroke: 0,
    grain: 0,
    chirp: 3,
    trill: 0,
    drop: 4,
    idle: 0,
    wander: 0,
  },
  yo = new l(0, 0.3, 2),
  Hn = new l(0, 0.3, 2);
function aa(e) {
  const t = le.getBoundingClientRect();
  xo.set(
    ((e.clientX - t.left) / t.width) * 2 - 1,
    -((e.clientY - t.top) / t.height) * 2 + 1,
  );
}
function sa() {
  ((c.display = 1.8), (c.startle = 1), Qe.happy());
}
function On() {
  sa();
}
function Is(e) {
  const t = se.clone().invert();
  (Bo.copy(N.radii).multiply(M.bodyScale.value),
    bo.origin.copy(e.origin).sub(d.p).applyQuaternion(t).divide(Bo),
    bo.direction.copy(e.direction).applyQuaternion(t).divide(Bo).normalize());
  const n = new l();
  return (
    bo.intersectSphere(Nn, n) || bo.closestPointToPoint(Nn.center, n),
    n.normalize()
  );
}
le.addEventListener(
  "pointerdown",
  (e) => {
    W.down ||
      !e.isPrimary ||
      e.button !== 0 ||
      (aa(e),
      je.setFromCamera(xo, Ie),
      je.ray.intersectsSphere(new Un(d.p, N.radius * 1.7)) &&
        ((Le.enabled = !1),
        (W.down = {
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
          id: e.pointerId,
          origin: Is(je.ray),
          moved: !1,
        }),
        (W.stroking = !0),
        le.setPointerCapture(e.pointerId)));
  },
  { capture: !0 },
);
le.addEventListener("pointermove", (e) => {
  if (W.down && W.down.id !== e.pointerId) return;
  (W.down &&
    Math.hypot(e.clientX - W.down.x, e.clientY - W.down.y) >= na &&
    (W.down.moved = !0),
    aa(e),
    (c.idle = 0));
  const t = Math.hypot(e.movementX || 0, e.movementY || 0);
  c.hover = Math.min(1, c.hover + t * 0.01);
});
const Zo = (e) => {
  const t = W.down;
  !t ||
    t.id !== e.pointerId ||
    ((W.down = null),
    (W.stroking = !1),
    (Le.enabled = !0),
    e.type === "pointerup" &&
      !t.moved &&
      performance.now() - t.time < oa &&
      Math.hypot(e.clientX - t.x, e.clientY - t.y) < na &&
      sa(t.origin));
};
le.addEventListener("pointerup", Zo);
le.addEventListener("pointercancel", Zo);
le.addEventListener("lostpointercapture", Zo);
function Qo() {
  ((Xo = (Math.random() * 1e6) | 0),
    (So = null),
    Xt(),
    St(),
    (d.p.y = N.rest + 0.5));
}
if (!Mt) {
  let e = function () {
    const [, t] = bs(() => ({
      "Another one (R)": Pn(Qo),
      Plumage: {
        value: So ?? "Random",
        options: ["Random", ...Ut],
        onChange: (n, o, { initial: u }) => {
          u || ((So = n === "Random" ? null : n), Xt(), St());
        },
      },
      Eyes: {
        value: _t.eyes ?? "Random",
        options: ["Random", ...Mo],
        onChange: (n, o, { initial: u }) => {
          u || ((_t.eyes = n === "Random" ? null : n), Xt(), St());
        },
      },
      Tuft: {
        value: _t.top ?? "Random",
        options: ["Random", ...go],
        onChange: (n, o, { initial: u }) => {
          u || ((_t.top = n === "Random" ? null : n), Xt(), St());
        },
      },
      Fluff: {
        value: 1,
        min: 0.3,
        max: 2.2,
        step: 0.01,
        onChange: (n) => {
          M.fluffAngle.value = n;
        },
      },
      Sheen: {
        value: 1,
        min: 0,
        max: 3,
        step: 0.01,
        onChange: (n) => {
          M.iridescence.value = n;
        },
      },
      Volume: {
        value: 0.6,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (n) => Qe.setVolume(n),
      },
      "Feathers fall": {
        value: 1,
        min: 0,
        max: 4,
        step: 0.1,
        onChange: (n) => {
          Ze.drop = n;
        },
      },
      "Regrow after": {
        value: Ze.regrow,
        min: 1,
        max: 60,
        step: 1,
        onChange: (n) => {
          Ze.regrow = n;
        },
      },
      "Blown off": {
        value: 1,
        min: 0,
        max: 4,
        step: 0.1,
        onChange: (n) => {
          Ze.blownOff = n;
        },
      },
      "Puff up (P)": Pn(On),
      ...ys({ renderer: De, pipeline: Jo, lights: [ge], pcss: [Ts] }),
    }));
    return null;
  };
  (addEventListener("keydown", (t) => {
    if (t.target.closest?.("#controls, input")) return;
    const n = t.key.toLowerCase();
    if (n === "r") Qo();
    else if ((n === "p" || n === " ") && !t.repeat) On();
    else return;
    t.preventDefault();
  }),
    document.querySelector("#random").addEventListener("click", Qo),
    addEventListener("pointerdown", () => {
      Qe.on || (Qe.setOn(!0), setTimeout(() => Qe.idle(), 400));
    }),
    ms.createRoot(document.querySelector("#controls")).render(
      fo.createElement(
        fo.Fragment,
        null,
        fo.createElement(fs, {
          collapsed: !0,
          titleBar: { title: "Controls" },
        }),
        fo.createElement(e),
      ),
    ));
}
const Jo = Ja(De, Ae, Ie, {
  aoStrength: 0.45,
  aoRadius: 0.055,
  aoThickness: 0.09,
  bloomStrength: 0.008,
  vignette: 0.025,
  grain: 0.003,
});
function la() {
  const e = Mt ? 1e3 : innerWidth,
    t = Mt ? 1e3 : innerHeight;
  (De.setSize(e, t, !Mt),
    (Ie.aspect = e / t),
    Ie.updateProjectionMatrix(),
    N && St());
}
addEventListener("resize", la);
la();
Xt();
St();
const Ds = new ps(),
  jn = new l(0, 1, 0),
  Wo = new l(),
  ht = new l(),
  Go = new l();
let _o = 0,
  Wt = 3;
De.setAnimationLoop(() => {
  const e = Math.max(1e-4, Math.min(Ds.getDelta(), 0.03333333333333333));
  ((Be += e), (M.now.value = Be));
  const t = N.rest;
  if (
    (d.prevV.copy(d.v),
    ht.set(0, -9.8, 0),
    (d.hop -= e),
    d.hop < 0 &&
      d.p.y <= t + 0.001 &&
      !W.stroking &&
      ((d.v.y = 1.1 + Math.random() * 0.5),
      (d.v.x += (Math.random() - 0.5) * 0.3),
      (d.hop = 3 + Math.random() * 5)),
    !he.on &&
      Math.abs(he.v) > 1e-5 &&
      ((he.v *= Math.exp(-e * 3)), (d.heading += he.v)),
    (ht.x += -d.p.x * 1.5),
    (ht.z += -d.p.z * 1.5),
    d.v.addScaledVector(ht, e),
    d.p.addScaledVector(d.v, e),
    d.p.y < t)
  ) {
    const I = -d.v.y;
    ((d.p.y = t),
      I > 0.4 && (d.squashV -= I * 3),
      (d.v.y = I > 0.6 ? I * 0.3 : 0),
      (d.v.x *= Math.exp(-e * 8)),
      (d.v.z *= Math.exp(-e * 8)));
  }
  (je.setFromCamera(xo, Ie),
    M.blowPos.value.copy(je.ray.origin),
    M.blowDir.value.copy(je.ray.direction));
  const n = W.down && performance.now() - W.down.time >= oa;
  ((M.blowPower.value +=
    ((n ? 1 : 0) - M.blowPower.value) * (1 - Math.exp(-e * (n ? 5 : 3)))),
    (c.blowFor = n ? c.blowFor + e : 0),
    (c.hover *= Math.exp(-e * 2)),
    (M.hover.value = W.stroking ? 0 : c.hover * 0.7),
    (c.display = Math.max(0, (c.display ?? 0) - e)));
  const o = c.display > 0.5 ? 1 : c.display / 0.5;
  if (
    ((c.puffNow =
      (c.puffNow ?? 0) +
      (o - (c.puffNow ?? 0)) *
        (1 - Math.exp(-e * (o > (c.puffNow ?? 0) ? 9 : 2.5)))),
    (M.fluff.value = c.puffNow * 1.3),
    c.display > 0 && (c.startle = Math.max(c.startle, 0.8)),
    n)
  ) {
    const I = M.blowDir.value;
    (d.leanV.addScaledVector(new l(I.z, 0, -I.x), e * 20 * M.blowPower.value),
      Math.random() < e * 5 * Ze.blownOff * M.blowPower.value && Vs(I),
      c.blowFor > 0.2 && c.blowFor - e <= 0.2 && Qe.startle());
  }
  ((c.bliss += (M.blowPower.value * 0.9 - c.bliss) * (1 - Math.exp(-e * 6))),
    (c.startle = Math.max(0, c.startle - e * 1.5)),
    (c.joy = Math.max(0, (c.joy ?? 0) - e)),
    Wo.set(d.v.z, 0, -d.v.x));
  const u = Wo.multiplyScalar(0.35).clampLength(0, 0.7);
  (d.leanV
    .addScaledVector(u.sub(d.lean), e * 120)
    .multiplyScalar(Math.exp(-e * 9)),
    d.lean.addScaledVector(d.leanV, e),
    (d.squashV += (-d.squash * 260 - d.squashV * 10) * e),
    (d.squash += d.squashV * e));
  const a = d.lean.length();
  se.setFromAxisAngle(a > 1e-5 ? Wo.copy(d.lean).divideScalar(a) : jn, a);
  const h = yo.clone().sub(d.p),
    p = Math.atan2(h.x, h.z) - d.heading,
    w = Re.clamp(Math.atan2(Math.sin(p), Math.cos(p)), -0.6, 0.6) * 0.5;
  ((c.tilt =
    (c.tilt ?? 0) +
    (Math.sin(Be * 0.37) * 0.05 + w * 0.12 - (c.tilt ?? 0)) *
      (1 - Math.exp(-e * 2))),
    (c.turn = (c.turn ?? 0) + (w - (c.turn ?? 0)) * (1 - Math.exp(-e * 3))));
  const y = 0;
  se.multiply(
    new ko().setFromEuler(new hs(y, d.heading + c.turn, c.tilt, "YXZ")),
  );
  const f = Re.clamp(d.squash, -0.25, 0.25),
    F = Math.sin(Be * 2.2) * 0.012;
  (M.bodyScale.value.set(
    1 - f * 0.5 - F * 0.5,
    1 + f + F,
    1 - f * 0.5 - F * 0.5,
  ),
    M.bodyScale.value.multiplyScalar(1 + (c.puffNow ?? 0) * 0.16),
    M.bodyPos.value.copy(d.p),
    M.bodyQuat.value.set(se.x, se.y, se.z, se.w),
    $e.position.copy(d.p),
    $e.quaternion.copy(se),
    $e.scale.copy(M.bodyScale.value),
    vt.position.copy(d.p),
    vt.quaternion.setFromAxisAngle(jn, d.heading + c.turn),
    ht
      .copy(d.v)
      .sub(d.prevV)
      .divideScalar(e)
      .applyQuaternion(se.clone().invert()),
    d.jigV
      .addScaledVector(d.jig, -e * 160)
      .addScaledVector(ht, -e * 0.05)
      .multiplyScalar(Math.exp(-e * 7)),
    d.jig.addScaledVector(d.jigV, e).clampLength(0, 1.4),
    M.jiggle.value.copy(d.jig).applyQuaternion(se),
    (M.shiver.value +=
      (Math.min(1, M.blowPower.value * 0.5 + c.hover * 0.2) - M.shiver.value) *
      (1 - Math.exp(-e * 6))),
    (c.idle += e),
    je.setFromCamera(xo, Ie),
    Go.copy(je.ray.origin).addScaledVector(je.ray.direction, 1.5),
    c.idle > 2.5 &&
      ((c.wander -= e),
      c.wander < 0 &&
        ((c.wander = 0.8 + Math.random() * 2),
        Hn.set(
          (Math.random() - 0.5) * 2.4,
          0.1 + Math.random() * 0.8,
          0.6 + Math.random() * 1.4,
        )),
      Go.copy(Hn)),
    yo.lerp(Go, 1 - Math.exp(-e * (c.idle > 2.5 ? 6 : 12))),
    (Wt -= e));
  const R = Wt < 0.14 ? Math.abs(Wt - 0.07) / 0.07 : 1;
  Wt < 0 && (Wt = Math.random() < 0.25 ? 0.25 : 2 + Math.random() * 4);
  const V = Math.max(
      c.bliss,
      Math.min(1, c.joy ?? 0),
      c.stroke * 0.5 * (c.grain > 0 ? 1 : 0.3),
    ),
    P = R * N.restOpen * (1 - V * 0.5) + c.startle * (1.25 - N.restOpen),
    G = 1 - V * 0.65,
    A = Re.clamp((yo.y - d.p.y) * 0.6, 0, 0.5);
  M.brow.value +=
    (c.startle * 1.4 +
      A +
      Math.max(0, Math.sin(Be * 0.23)) * 0.15 -
      V * 0.3 -
      M.brow.value) *
    (1 - Math.exp(-e * 6));
  for (const I of N.eyes)
    (I.ball.lookAt(yo),
      I.ball.scale.setScalar(1 + c.startle * 0.12),
      (I.upper.rotation.x = -P * 1.55 + 0.12),
      (I.lower.rotation.x = G * 1.45 - 0.08));
  ((c.stroke = Math.max(0, c.stroke - e * 1.2)),
    (c.grain *= Math.exp(-e * 2)),
    (c.chirp -= e),
    c.chirp < 0 && ((c.chirp = 4 + Math.random() * 6), W.stroking || Qe.idle()),
    (c.trill -= e),
    c.bliss > 0.6 &&
      c.trill < 0 &&
      ((c.trill = 1.4 + Math.random() * 1.5), Qe.content()),
    (c.drop -= e),
    c.drop < 0 &&
      Ze.drop > 0 &&
      ((c.drop = (2 + Math.random() * 4) / Ze.drop),
      Fs(1 + (Math.random() < 0.3 ? 1 : 0), 0.25)),
    Es(),
    (_o -= e),
    _o < 0 && ((_o = 0.2), Jn()),
    Le.update(),
    Jo.render());
});
document.body.classList.add("ready");
Mt &&
  setTimeout(
    () => {
      (De.setAnimationLoop(null),
        Jo.render(),
        le.toBlob(
          (e) =>
            fetch(`http://localhost:${Ge.get("port")}/`, {
              method: "POST",
              body: e,
            }),
          "image/jpeg",
          0.92,
        ));
    },
    +(Ge.get("after") || 6e3),
  );
