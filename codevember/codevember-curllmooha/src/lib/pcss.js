import {
  u as e,
  F as M,
  B,
  aU as C,
  a5 as P,
  g as a,
  af as G,
  bd as v,
  b8 as L,
  b9 as N,
  a7 as R,
  c as T,
  X as U,
} from "./stage.js";
import { bd as D, f as I, bi as W } from "./leva.js";
const X = 6.28318530718;
function E(
  y,
  {
    renderer: n,
    lightSize: w = 0.3,
    softness: V = 1,
    blockerTaps: f = 16,
    filterTaps: c = 20,
    noise: k = !0,
  } = {},
) {
  const m = y.shadow;
  n && (n.shadowMap.type = D);
  const s = {
    lightSize: e(w),
    softness: e(V),
    minTexels: e(1.2),
    bias: e(6e-4),
    mapSize: e(new I(m.mapSize.x, m.mapSize.y)),
  };
  return n?.backend?.isWebGLBackend
    ? ((n.shadowMap.type = W), s)
    : ((m.filterNode = M(({ depthTexture: x, shadowCoord: l }) => {
        const S = B(1).div(s.mapSize),
          b = k ? C(P.xy).mul(X) : a(0.4),
          u = l.z,
          h = s.lightSize.mul(s.softness),
          A = G(h.mul(0.5), S.x.mul(s.minTexels)),
          z = a(0).toVar(),
          d = a(0).toVar();
        for (let t = 0; t < f; t++) {
          const r = l.xy.add(v(t, f, b).mul(A)),
            i = L(x, N(r.mul(s.mapSize).floor())).x,
            o = i.lessThan(u.sub(s.bias)).select(a(1), a(0));
          (z.addAssign(i.mul(o)), d.addAssign(o));
        }
        const g = a(1).toVar();
        return (
          R(d.greaterThan(0), () => {
            const t = z.div(d),
              r = u.sub(t).mul(h),
              i = T(r, S.x.mul(s.minTexels), 0.08),
              o = a(0).toVar();
            for (let p = 0; p < c; p++) {
              const F = l.xy.add(v(p, c, b).mul(i));
              o.addAssign(U(x, F).compare(u));
            }
            g.assign(o.div(c));
          }),
          g
        );
      })),
      s);
}
export { E as a };
