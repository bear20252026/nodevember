// The dancing network of light on everything under water: the sun focused by the waves on top. A sum of sine
// waves, whose curvature says how much a patch of light has been squeezed by the time it is this deep. All the
// waves fit the tile a whole number of times and go round a whole number of times in the loop.
import { Fn, dot, float, mix, sin, texture, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import type { Node, WebGPURenderer } from "three/webgpu";
import { HalfFloatType, LinearFilter, LinearMipmapLinearFilter, NoBlending, NodeMaterial, QuadMesh, RGBAFormat, RenderTarget, RepeatWrapping, Vector3 } from "three/webgpu";

type V3 = Node<"vec3">;
const TAU = Math.PI * 2;

export function createWeb() {
  const U = {
    phase: uniform(0),
    web: uniform(1), // how strongly the surface's waves gather the light
    webSize: uniform(1.7), // world size of the tile of them
    deep: uniform(1.0), // how far under the waves, for how tightly the light has gathered
    drift: uniform(new Vector3()), // how far the picture's frame has travelled through the water (tangle.ts: the eye goes with the growth)
  };
  const WAVES = 11;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const waves = Array.from({ length: WAVES }, (_, i) => {
    const turn = rnd() * TAU;
    const k = 1.2 + 4.2 * Math.pow(i / (WAVES - 1), 1.3);
    const kx = Math.round(Math.cos(turn) * k) || 1,
      ky = Math.round(Math.sin(turn) * k);
    const kk = Math.hypot(kx, ky);
    // longer waves are bigger and slower
    return { kx, ky, a: Math.pow(kk, -1.6), turns: Math.max(1, Math.round(1.1 * Math.sqrt(kk))) * (rnd() < 0.5 ? -1 : 1), at: rnd() * TAU };
  });
  // the scale that makes folds common but not everywhere
  const rms = Math.sqrt(waves.reduce((s, w) => s + 0.5 * (w.a * (w.kx * w.kx + w.ky * w.ky)) ** 2, 0));
  const target = new RenderTarget(512, 512, { type: HalfFloatType, format: RGBAFormat, depthBuffer: false, minFilter: LinearMipmapLinearFilter, magFilter: LinearFilter, generateMipmaps: true });
  target.texture.wrapS = target.texture.wrapT = RepeatWrapping;
  const material = new NodeMaterial();
  material.blending = NoBlending;
  material.fragmentNode = Fn(() => {
    const p = uv();
    const xx = float(0).toVar(),
      yy = float(0).toVar(),
      xy = float(0).toVar();
    for (const w of waves) {
      const s = sin(p.x.mul(w.kx * TAU).add(p.y.mul(w.ky * TAU)).add(U.phase.mul(w.turns * TAU)).add(w.at)).mul(w.a / rms);
      xx.addAssign(s.mul(w.kx * w.kx));
      yy.addAssign(s.mul(w.ky * w.ky));
      xy.addAssign(s.mul(w.kx * w.ky));
    }
    // a patch of light that started with area 1 arrives with this area; its brightness is one over that
    const d = U.deep;
    const area = xx.mul(d).oneMinus().mul(yy.mul(d).oneMinus()).sub(xy.mul(xy).mul(d).mul(d));
    const bright = float(1).div(area.mul(area).add(0.035).sqrt());
    return vec4(vec3(bright.min(7)), 1);
  })();
  const quad = new QuadMesh(material);
  const tex = texture(target.texture);
  // the web is the same all the way down a ray of sun, so it is read by where that ray crosses a plane square to it
  const ax = new Vector3(),
    ay = new Vector3();
  const sideways = uniform(new Vector3(1, 0, 0)),
    upways = uniform(new Vector3(0, 0, 1));
  const spread = (p: V3) => vec2(dot(p.add(U.drift), sideways), dot(p.add(U.drift), upways));
  // `blur` in mip levels. The map's mean is about 1.25: taken off, so that turning the web up does not brighten everything
  const gathered = (p: V3, blur: Node<"float">) => mix(float(1), tex.sample(spread(p).div(U.webSize)).level(blur).r.div(1.25), U.web);
  // the sun has moved: L is towards it. `along`: something the tile's first side is to lie along, as the sun sees it
  const face = (L: Vector3, along?: Vector3) => {
    if (along) ax.copy(along).addScaledVector(L, -along.dot(L)).normalize();
    else ax.crossVectors(L, new Vector3(0, 0, 1)).normalize();
    ay.crossVectors(ax, L).normalize();
    sideways.value.copy(ax);
    upways.value.copy(ay);
  };
  // call with the render target you want left set afterwards
  const render = (renderer: WebGPURenderer, phase: number) => {
    U.phase.value = phase;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };
  return { U, target, spread, gathered, face, render };
}
