// The sun through a thing that is weed all the way in. The other sun map (light.ts) knows the first four things a
// ray of sun meets, which is right for a few big blades and wrong here, where a ray meets forty.
//
// What is wanted is how much weed lies in front of any depth along each ray, for all depths: a deep shadow map
// (Lokovic and Veach 2000). Kept here the way it is for hair (deep opacity maps, Yuksel and Keyser 2008):
//
//   front   how far along each ray the first thing is;
//   layers  eight depths measured from that first thing, thin at first and each about twice the one before, and at
//           each, all that the weed in front of it keeps.
//
// Slices at fixed depths cannot tell a frond at the front of a slice from the ones behind it in the same slice,
// and it is the front of the plant the eye sees. Layers that start at the plant's own surface can: the surface is
// lit, what is 3 cm behind it is behind one frond, and the layers are coarse only deep inside, where nothing is
// sharp anyway.
//
// It is drawn in three passes: one for the front, two that add up (a frond adds what it keeps to every layer
// behind it, and a share to the layer it is in, so that the whole is smooth in depth). The weed's colour is one
// tint, so what is added is one number, and the light left is the tint to the power of it.
//
// A thing that lets no light through (`solids`: a rock) is not put in the layers: a layer cannot tell what is just
// in front of a thing in it from what is just behind, and a frond lying on the sunny side of a rock would be as
// dark as the rock's far side. It has a map of its own, how far along each ray the rock is: what is behind that
// is dark, and nothing else is.
import { Fn, abs, clamp, dot, exp, float, floor, ivec2, mix, positionWorld, saturate, screenCoordinate, step, textureLoad, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { BufferGeometry, Node, Side, WebGPURenderer } from "three/webgpu";
import { AddEquation, Color, CustomBlending, FloatType, HalfFloatType, Matrix4, Mesh, NearestFilter, NoBlending, NodeMaterial, OneFactor, OrthographicCamera, RGBAFormat, RGFormat, RenderTarget, Scene, Vector3, Vector4 } from "three/webgpu";
import { createWeb } from "./web.ts";

type V3 = Node<"vec3">;
type N = Node<"float">;
// REACH: half the side of the square the sun map covers; DEEP: half its depth
export function createDeepLight(parts: { geometry: BufferGeometry; keeps: N; side: Side; position?: Node }[], size = 2048, REACH = 1.5, DEEP = 3, solids: { geometry: BufferGeometry; side: Side; position?: Node }[] = []) {
  const net = createWeb();
  const U = {
    dir: uniform(new Vector3(0.2, 0.8, -0.56).normalize()), // towards the sun
    centre: uniform(new Vector3(0, -0.3, 0)),
    across: uniform(new Matrix4()), // world to the sun map
    takes: uniform(new Vector3(0.1, 0.5, 2.2)), // what one frond keeps of red, green, blue
    ...net.U, // phase, web, webSize, deep
    // the layers: how far behind the first thing each ends, and how thick it is; four and four
    nearEnds: uniform(new Vector4()),
    nearThick: uniform(new Vector4(1, 1, 1, 1)),
    farEnds: uniform(new Vector4()),
    farThick: uniform(new Vector4(1, 1, 1, 1)),
  };
  // the first layer is `first` thick, and they grow evenly (as a ratio) until the last ends at `last`
  const setLayers = (first: number, last = 2.6) => {
    const ratio = Math.pow(last / first, 1 / 7);
    const ends = Array.from({ length: 8 }, (_, k) => first * Math.pow(ratio, k));
    const thick = ends.map((e, k) => e - (k ? ends[k - 1] : 0));
    U.nearEnds.value.fromArray(ends, 0);
    U.nearThick.value.fromArray(thick, 0);
    U.farEnds.value.fromArray(ends, 4);
    U.farThick.value.fromArray(thick, 4);
  };
  setLayers(0.03);

  const camera = new OrthographicCamera(-REACH, REACH, REACH, -REACH, 0.05, DEEP * 2);
  const high = (p: V3) => dot(p.sub(U.centre), U.dir).add(DEEP).div(DEEP * 2); // 1 nearest the sun; 0 is "nothing here"
  const target = (type: typeof FloatType | typeof HalfFloatType, format: typeof RGFormat | typeof RGBAFormat, depthBuffer: boolean) =>
    new RenderTarget(size, size, { type, format, depthBuffer, minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false });
  const front = target(FloatType, RGFormat, true);
  const near = target(HalfFloatType, RGBAFormat, false);
  const far = target(HalfFloatType, RGBAFormat, false);
  const here = () => ivec2(screenCoordinate.xy);
  const solid = solids.length ? target(FloatType, RGFormat, true) : null;
  const solidScene = new Scene();
  solidScene.background = new Color(0, 0, 0);
  for (const part of solids) {
    const m = new NodeMaterial();
    m.side = part.side;
    m.blending = NoBlending;
    if (part.position) m.positionNode = part.position;
    m.fragmentNode = vec4(high(positionWorld), 0, 0, 1);
    const mesh = new Mesh(part.geometry, m);
    mesh.frustumCulled = false;
    solidScene.add(mesh);
  }
  // 1 where no solid thing is between a place and the sun (by one texel of the map)
  const clearAt = (at: Node<"ivec2">, q: N) => (solid ? step(textureLoad(solid.texture, at).r.sub(q), 0.02 / (DEEP * 2)) : float(1));

  const frontScene = new Scene();
  frontScene.background = new Color(0, 0, 0);
  const nearScene = new Scene(),
    farScene = new Scene();
  for (const part of parts) {
    const first = new NodeMaterial();
    first.side = part.side;
    first.blending = NoBlending;
    if (part.position) first.positionNode = part.position;
    first.fragmentNode = vec4(high(positionWorld), 0, 0, 1);
    const firstMesh = new Mesh(part.geometry, first);
    firstMesh.frustumCulled = false;
    frontScene.add(firstMesh);
    for (const [scene, ends, thick] of [
      [nearScene, U.nearEnds, U.nearThick],
      [farScene, U.farEnds, U.farThick],
    ] as const) {
      const m = new NodeMaterial();
      m.side = part.side;
      // every frond a ray meets is added, whatever is in front of it
      m.transparent = true;
      m.blending = CustomBlending;
      m.blendEquation = AddEquation;
      m.blendSrc = m.blendSrcAlpha = OneFactor;
      m.blendDst = m.blendDstAlpha = OneFactor;
      m.depthTest = false;
      m.depthWrite = false;
      if (part.position) m.positionNode = part.position;
      m.fragmentNode = Fn(() => {
        const behind = textureLoad(front.texture, here())
          .r.sub(high(positionWorld))
          .mul(DEEP * 2)
          .max(0);
        // all of it to the layers that end behind it, a share to the one it is in, none to those in front
        return saturate(ends.sub(behind).div(thick)).mul(part.keeps);
      })();
      const mesh = new Mesh(part.geometry, m);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

  const spot = (p: V3) => {
    const c = U.across.mul(vec4(p, 1));
    const flat = vec2(c.x.mul(0.5).add(0.5), c.y.mul(-0.5).add(0.5));
    const inside = step(abs(flat.x.sub(0.5)).max(abs(flat.y.sub(0.5))), 0.498);
    return { pix: flat.mul(size).sub(0.5), q: high(p), inside };
  };
  // how much weed is in front of a place, by one texel of the map. `own`: what the thing asking keeps itself,
  // which the map has put partly in front of it (it cannot know better within a layer) and is taken off again
  const weedAt = (at: Node<"ivec2">, q: N, own?: N) => {
    const behind = textureLoad(front.texture, at)
      .r.sub(q)
      .mul(DEEP * 2)
      .max(0);
    const a = textureLoad(near.texture, at),
      b = textureLoad(far.texture, at);
    // how far through each layer the place is: 0 before it, 1 past it
    const wa = saturate(behind.sub(U.nearEnds.sub(U.nearThick)).div(U.nearThick)),
      wb = saturate(behind.sub(U.farEnds.sub(U.farThick)).div(U.farThick));
    const all = dot(a.sub(vec4(0, a.xyz)), wa).add(dot(b.sub(vec4(a.w, b.xyz)), wb));
    if (!own) return all;
    return all.sub(own.mul(dot(wa, wa.oneMinus()).add(dot(wb, wb.oneMinus())))).max(0);
  };
  // light left at a place, of the sun's
  const through = (p: V3, own?: N) => {
    const { pix, q, inside } = spot(p);
    const i0 = floor(pix).toVar();
    const f = pix.sub(i0).toVar();
    const tap = (dx: number, dy: number) => {
      const at = ivec2(clamp(i0.add(vec2(dx, dy)), 0, size - 1));
      return exp(U.takes.mul(weedAt(at, q, own)).negate()).mul(clearAt(at, q));
    };
    const left = mix(mix(tap(0, 0), tap(1, 0), f.x), mix(tap(0, 1), tap(1, 1), f.x), f.y);
    return mix(vec3(1), left, inside);
  };
  // the same, one read: for the water itself, where nothing is sharp
  const throughWater = (p: V3) => {
    const { pix, q, inside } = spot(p);
    const at = ivec2(clamp(floor(pix.add(0.5)), 0, size - 1));
    return mix(vec3(1), exp(U.takes.mul(weedAt(at, q)).negate()).mul(clearAt(at, q)), inside);
  };

  // `webAlong`: see web.ts' face
  const aim = (webAlong?: Vector3) => {
    const L = U.dir.value.normalize();
    camera.position.copy(U.centre.value).addScaledVector(L, DEEP);
    camera.up.set(0, 0, -1);
    camera.lookAt(U.centre.value);
    camera.updateMatrixWorld();
    net.face(L, webAlong);
  };
  aim();

  const was = new Color();
  const render = (renderer: WebGPURenderer, phase: number) => {
    const before = renderer.getRenderTarget();
    net.render(renderer, phase);
    renderer.setRenderTarget(front);
    renderer.render(frontScene, camera);
    if (solid) {
      renderer.setRenderTarget(solid);
      renderer.render(solidScene, camera);
    }
    // the adding passes must start from nothing in all four channels
    renderer.getClearColor(was);
    const wasAlpha = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(near);
    renderer.render(nearScene, camera);
    renderer.setRenderTarget(far);
    renderer.render(farScene, camera);
    renderer.setClearColor(was, wasAlpha);
    renderer.setRenderTarget(before);
    // after the first render the camera's matrices are the renderer's kind
    U.across.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  };

  return { U, aim, render, setLayers, through, throughWater, gathered: net.gathered, spread: net.spread, front, near, far, web: net.target };
}
