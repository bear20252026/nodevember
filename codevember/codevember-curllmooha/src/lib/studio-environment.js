import { P as g } from "./stage.js";
import {
  S as h,
  C as i,
  M as C,
  aD as G,
  a as P,
  b,
  d as v,
  V as z,
} from "./leva.js";
function V(m) {
  const l = new g(m),
    a = new Map();
  return (e) => {
    if (a.has(e)) return a.get(e).texture;
    const r = new h(),
      p = new i(e.sweep).multiplyScalar(0.55);
    r.background = p;
    const t = (s, w, y, d, M, S, x = !1) => {
        const f = new C(
          x ? new G(s / 2, 64) : new P(s, w),
          new b({ color: new i(M).multiplyScalar(S), side: v }),
        );
        (f.position.copy(new z(...y).normalize().multiplyScalar(d)),
          f.lookAt(0, 0, 0),
          r.add(f));
      },
      [n, u, o] = e.key;
    (t(
      2 + e.soft * 1.4,
      2 + e.soft * 1.4,
      [n, u, o],
      10,
      e.keyColor,
      (4.2 * 10) / (2 + e.soft * 1.4) ** 0.9,
      !0,
    ),
      t(9, 6, [-n, 0.25, -o * 0.4 + 0.6], 10, e.fill, 1.1),
      t(26, 26, [0, 1, 0], 11, 16777215, 1),
      t(4, 14, [-n * 0.2 - 0.9, 0.35, -0.8], 10, 16777215, 2.2),
      t(40, 40, [0, -1, 0], 9, e.sweep, 0.75));
    const c = l.fromScene(r, 0.025);
    return (
      r.traverse((s) => {
        (s.geometry?.dispose(), s.material?.dispose());
      }),
      a.set(e, c),
      c.texture
    );
  };
}
export { V as s };
