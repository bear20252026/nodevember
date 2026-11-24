import {
  b3 as Z,
  aL as K,
  u as Q,
  aP as W,
  aM as X,
  aQ as D,
  aR as j,
  at as S,
  B as z,
  F as g,
  f as y,
  g as U,
  b6 as ee,
  b5 as te,
  aO as C,
  aZ as Y,
  X as R,
  b4 as w,
  ba as E,
  bb as se,
  s as re,
  ai as V,
  a as L,
  b as ae,
  ap as k,
  a6 as P,
  m as q,
  af as ie,
} from "./stage.js";
import { f as O, an as m, bl as H, a$ as $, ao as x } from "./leva.js";
const b = new j();
let A;
class oe extends K {
  static get type() {
    return "GaussianBlurNode";
  }
  constructor(t, e = null, s = 4, r = {}) {
    (super("vec4"),
      (this.textureNode = t),
      (this.directionNode = e),
      (this.sigma = s),
      (this._invSize = Q(new O())),
      (this._horizontalRT = new m(1, 1, { depthBuffer: !1 })),
      (this._horizontalRT.texture.name = "GaussianBlurNode.horizontal"),
      (this._verticalRT = new m(1, 1, { depthBuffer: !1 })),
      (this._verticalRT.texture.name = "GaussianBlurNode.vertical"),
      (this._textureNode = W(this, this._verticalRT.texture)),
      (this._textureNode.uvNode = t.uvNode),
      (this._hMaterial = null),
      (this._vMaterial = null),
      (this.updateBeforeType = X.FRAME),
      (this.resolutionScale = r.resolutionScale || 1),
      (this.premultipliedAlpha = r.premultipliedAlpha || !1),
      (this.isGaussianBlurNode = !0));
  }
  setSize(t, e) {
    ((t = Math.max(Math.round(t * this.resolutionScale), 1)),
      (e = Math.max(Math.round(e * this.resolutionScale), 1)),
      this._invSize.value.set(1 / t, 1 / e),
      this._horizontalRT.setSize(t, e),
      this._verticalRT.setSize(t, e));
  }
  updateBefore(t) {
    const { renderer: e } = t;
    A = D.resetRendererState(e, A);
    const s = this.textureNode.value;
    ((b.material = this._hMaterial),
      this.setSize(s.image.width, s.image.height));
    const r = s.type;
    ((this._horizontalRT.texture.type = r),
      (this._verticalRT.texture.type = r),
      e.setRenderTarget(this._horizontalRT),
      (b.name = "Gaussian Blur [ Horizontal Pass ]"),
      b.render(e),
      (b.material = this._vMaterial),
      e.setRenderTarget(this._verticalRT),
      (b.name = "Gaussian Blur [ Vertical Pass ]"),
      b.render(e),
      D.restoreRendererState(e, A));
  }
  getTextureNode() {
    return this._textureNode;
  }
  setup(t) {
    const e = S(),
      s = z(this.directionNode || 1),
      r = g(([T, f]) => {
        let p, v;
        this.premultipliedAlpha
          ? ((p = (i) => ee(T.sample(i))), (v = (i) => te(i)))
          : ((p = (i) => T.sample(i)), (v = (i) => i));
        const B = 3 + 2 * this.sigma,
          l = this._getCoefficients(B),
          n = this._invSize,
          u = s.mul(f),
          _ = y(p(e).mul(l[0])).toVar();
        for (let i = 1; i < B; i++) {
          const N = U(i),
            c = U(l[i]),
            F = z(u.mul(n.mul(N))).toVar(),
            I = p(e.add(F)),
            J = p(e.sub(F));
          _.addAssign(I.add(J).mul(c));
        }
        return v(_);
      }),
      o = this.textureNode;
    ((this._hMaterial = this._hMaterial || new C()),
      (this._hMaterial.contextNode = Y(t.getSharedContext())),
      (this._hMaterial.fragmentNode = r(o, z(1, 0))),
      (this._hMaterial.name = "Gaussian_blur_horizontal"),
      (this._hMaterial.needsUpdate = !0));
    const h = R(this._horizontalRT.texture, S());
    ((this._vMaterial = this._vMaterial || new C()),
      (this._vMaterial.fragmentNode = r(h, z(0, 1))),
      (this._vMaterial.name = "Gaussian_blur_vertical"),
      (this._vMaterial.needsUpdate = !0));
    const d = t.getNodeProperties(this);
    return ((d.hTextureNode = o), (d.vTextureNode = h), this._textureNode);
  }
  dispose() {
    (this._horizontalRT.dispose(),
      this._verticalRT.dispose(),
      this._hMaterial !== null &&
        (this._hMaterial.dispose(),
        this._vMaterial.dispose(),
        (this._hMaterial = null),
        (this._vMaterial = null)),
      super.dispose());
  }
  _getCoefficients(t) {
    const e = [],
      s = t / 3;
    let r = 1;
    e.push(1);
    for (let o = 1; o < t; o++) {
      const h = Math.exp((-0.5 * o * o) / (s * s));
      (e.push(h), (r += 2 * h));
    }
    return e.map((o) => o / r);
  }
  get resolution() {
    return (
      H(
        'THREE.GaussianBlurNode: The "resolution" property has been renamed to "resolutionScale" and is now of type `number`.',
      ),
      new O(this.resolutionScale, this.resolutionScale)
    );
  }
  set resolution(t) {
    (H(
      'THREE.GaussianBlurNode: The "resolution" property has been renamed to "resolutionScale" and is now of type `number`.',
    ),
      (this.resolutionScale = t.x));
  }
}
const le = (M, t, e, s = {}) => new oe(Z(M), t, e, s),
  a = new j();
let G;
class ne extends K {
  static get type() {
    return "DepthOfFieldNode";
  }
  constructor(t, e, s, r, o) {
    (super("vec4"),
      (this.textureNode = t),
      (this.viewZNode = e),
      (this.focusDistanceNode = s),
      (this.focalLengthNode = r),
      (this.bokehScaleNode = o),
      (this._invSize = Q(new O())),
      (this._CoCRT = new m(1, 1, {
        depthBuffer: !1,
        type: x,
        format: $,
        count: 2,
      })),
      (this._CoCRT.textures[0].name = "DepthOfField.NearField"),
      (this._CoCRT.textures[1].name = "DepthOfField.FarField"),
      (this._CoCBlurredRT = new m(1, 1, {
        depthBuffer: !1,
        type: x,
        format: $,
      })),
      (this._CoCBlurredRT.texture.name = "DepthOfField.NearFieldBlurred"),
      (this._blur64RT = new m(1, 1, { depthBuffer: !1, type: x })),
      (this._blur64RT.texture.name = "DepthOfField.Blur64"),
      (this._blur16NearRT = new m(1, 1, { depthBuffer: !1, type: x })),
      (this._blur16NearRT.texture.name = "DepthOfField.Blur16Near"),
      (this._blur16FarRT = new m(1, 1, { depthBuffer: !1, type: x })),
      (this._blur16FarRT.texture.name = "DepthOfField.Blur16Far"),
      (this._compositeRT = new m(1, 1, { depthBuffer: !1, type: x })),
      (this._compositeRT.texture.name = "DepthOfField.Composite"),
      (this._CoCMaterial = new C()),
      (this._CoCBlurredMaterial = new C()),
      (this._blur64Material = new C()),
      (this._blur16Material = new C()),
      (this._compositeMaterial = new C()),
      (this._textureNode = R(this._compositeRT.texture)),
      (this._CoCTextureNode = R(this._CoCRT.texture)),
      (this._CoCBlurNode = le(this._CoCTextureNode, 1, 2)),
      (this._blur64TextureNode = R(this._blur64RT.texture)),
      (this._blur16NearTextureNode = R(this._blur16NearRT.texture)),
      (this._blur16FarTextureNode = R(this._blur16FarRT.texture)),
      (this.updateBeforeType = X.FRAME));
  }
  setSize(t, e) {
    (this._invSize.value.set(1 / t, 1 / e),
      this._CoCRT.setSize(t, e),
      this._compositeRT.setSize(t, e));
    const s = Math.round(t / 2),
      r = Math.round(e / 2);
    (this._CoCBlurredRT.setSize(s, r),
      this._blur64RT.setSize(s, r),
      this._blur16NearRT.setSize(s, r),
      this._blur16FarRT.setSize(s, r));
  }
  getTextureNode() {
    return this._textureNode;
  }
  updateBefore(t) {
    const { renderer: e } = t,
      s = this.textureNode.value;
    (this.setSize(s.image.width, s.image.height),
      (G = D.resetRendererState(e, G)),
      e.setClearColor(0, 0),
      (a.material = this._CoCMaterial),
      e.setRenderTarget(this._CoCRT),
      (a.name = "DoF [ CoC ]"),
      a.render(e),
      (this._CoCTextureNode.value = this._CoCRT.textures[0]),
      (a.material = this._CoCBlurredMaterial),
      e.setRenderTarget(this._CoCBlurredRT),
      (a.name = "DoF [ CoC Blur ]"),
      a.render(e),
      (this._CoCTextureNode.value = this._CoCBlurredRT.texture),
      (a.material = this._blur64Material),
      e.setRenderTarget(this._blur64RT),
      (a.name = "DoF [ Blur64 Near ]"),
      a.render(e),
      (a.material = this._blur16Material),
      e.setRenderTarget(this._blur16NearRT),
      (a.name = "DoF [ Blur16 Near ]"),
      a.render(e),
      (this._CoCTextureNode.value = this._CoCRT.textures[1]),
      (a.material = this._blur64Material),
      e.setRenderTarget(this._blur64RT),
      (a.name = "DoF [ Blur64 Far ]"),
      a.render(e),
      (a.material = this._blur16Material),
      e.setRenderTarget(this._blur16FarRT),
      (a.name = "DoF [ Blur16 Far ]"),
      a.render(e),
      (a.material = this._compositeMaterial),
      e.setRenderTarget(this._compositeRT),
      (a.name = "DoF [ Composite ]"),
      a.render(e),
      D.restoreRendererState(e, G));
  }
  setup(t) {
    const e = Y(t.getSharedContext()),
      s = this._generateKernels(),
      r = E("float"),
      o = E("float"),
      h = se(r, o),
      d = g(() => {
        const l = this.viewZNode.negate().sub(this.focusDistanceNode),
          n = re(0, this.focalLengthNode, l.abs());
        return (r.assign(V(l, 0).mul(n)), o.assign(V(0, l).mul(n)), U(0));
      });
    ((this._CoCMaterial.contextNode = e),
      (this._CoCMaterial.colorNode = d()),
      (this._CoCMaterial.outputNode = h),
      (this._CoCMaterial.needsUpdate = !0),
      (this._CoCBlurredMaterial.colorNode = this._CoCBlurNode),
      (this._CoCBlurredMaterial.needsUpdate = !0));
    const T = L(s.points64),
      f = g(() => {
        const l = ae(),
          n = S(),
          u = this._CoCTextureNode.sample(n).r,
          _ = this._invSize.mul(this.bokehScaleNode).mul(u);
        return (
          k(64, ({ i }) => {
            const N = n.add(_.mul(T.element(i))),
              c = this.textureNode.sample(N);
            l.addAssign(c.rgb);
          }),
          l.divAssign(64),
          y(l, u)
        );
      });
    ((this._blur64Material.contextNode = e),
      (this._blur64Material.fragmentNode = f()),
      (this._blur64Material.needsUpdate = !0));
    const p = L(s.points16),
      v = g(() => {
        const l = S(),
          n = this._blur64TextureNode.sample(l).toVar(),
          u = n.rgb,
          _ = n.a,
          i = this._invSize.mul(this.bokehScaleNode).mul(_);
        return (
          k(16, ({ i: N }) => {
            const c = l.add(i.mul(p.element(N))),
              F = this._blur64TextureNode.sample(c);
            u.assign(ie(F.rgb, u));
          }),
          y(u, _)
        );
      });
    ((this._blur16Material.contextNode = e),
      (this._blur16Material.fragmentNode = v()),
      (this._blur16Material.needsUpdate = !0));
    const B = g(() => {
      const l = S(),
        n = this._blur16NearTextureNode.sample(l),
        u = this._blur16FarTextureNode.sample(l),
        _ = this.textureNode.sample(l),
        i = P(n.a, 0.5).mul(2),
        N = P(u.a, 0.5).mul(2),
        c = y(0, 0, 0, 1).toVar();
      return ((c.rgb = q(_.rgb, u.rgb, N)), (c.rgb = q(c.rgb, n.rgb, i)), c);
    });
    return (
      (this._compositeMaterial.contextNode = e),
      (this._compositeMaterial.fragmentNode = B()),
      (this._compositeMaterial.needsUpdate = !0),
      this._textureNode
    );
  }
  _generateKernels() {
    const t = 2.39996323,
      e = 80,
      s = [],
      r = [];
    let o = 0,
      h = 0;
    for (let d = 0; d < e; d++) {
      const T = d * t,
        f = Math.sqrt(d) / Math.sqrt(e),
        p = new O(f * Math.cos(T), f * Math.sin(T));
      d % 5 === 0 ? ((r[h] = p), h++) : ((s[o] = p), o++);
    }
    return { points16: r, points64: s };
  }
  dispose() {
    (super.dispose(),
      this._CoCRT.dispose(),
      this._CoCBlurredRT.dispose(),
      this._blur64RT.dispose(),
      this._blur16NearRT.dispose(),
      this._blur16FarRT.dispose(),
      this._compositeRT.dispose(),
      this._CoCMaterial.dispose(),
      this._CoCBlurredMaterial.dispose(),
      this._blur64Material.dispose(),
      this._blur16Material.dispose(),
      this._compositeMaterial.dispose(),
      this._CoCBlurNode.dispose());
  }
}
const de = (M, t, e = 1, s = 1, r = 1) => new ne(Z(M), w(t), w(e), w(s), w(r));
export { de as d };
