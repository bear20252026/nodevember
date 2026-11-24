// The sun under water, and what the plant does to it.
//
// A blade lets light through and keeps some: one blade is gold, two are amber, three brown. So a plain shadow map
// (lit or not) is no use. Here the plant is drawn from the sun four times, each time throwing away what the pass
// before already kept (depth peeling), which gives the first four things a ray of sun meets: how far along the
// ray each is, and how much it keeps. Light arriving anywhere is then the sun, less every layer met before there.
//
// The dancing network on everything, the sun focused by the waves on top, is web.ts.
import { Discard, Fn, abs, clamp, dot, exp, floor, ivec2, mix, positionWorld, screenCoordinate, smoothstep, step, textureLoad, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { BufferGeometry, Node, Side, WebGPURenderer } from "three/webgpu";
import { Color, FloatType, HalfFloatType, Matrix4, Mesh, NearestFilter, NoBlending, NodeMaterial, OrthographicCamera, QuadMesh, RGBAFormat, RGFormat, RenderTarget, Scene, Vector2, Vector3 } from "three/webgpu";
import { createWeb } from "./web.ts";

type V3 = Node<"vec3">;
const REACH = 1.5; // half the side of the square the sun map covers, round the tip
const DEEP = 3; // and half its depth
const LAYERS = 4;

// a part posed in its vertex shader says where its vertices go (`position`)
// what the things that are lit need of a sun map, whichever kind it is
type Whole = ReturnType<typeof createLight>;
export type Light = Pick<Whole, "through" | "throughWater" | "gathered" | "spread" | "web"> & { U: Pick<Whole["U"], "dir" | "takes" | "web" | "webSize"> };

export function createLight(parts: { geometry: BufferGeometry; keeps: Node<"float">; side: Side; position?: Node }[], size = 2048) {
  const net = createWeb();
  const U = {
    dir: uniform(new Vector3(0.2, 0.8, -0.56).normalize()), // towards the sun
    centre: uniform(new Vector3(0, -0.3, 0)),
    across: uniform(new Matrix4()), // world to the sun map
    takes: uniform(new Vector3(0.1, 0.5, 2.2)), // what one blade keeps of red, green, blue
    ...net.U, // phase, web, webSize, deep
    slack: uniform(new Vector2(0.0016, 0.011)), // how far apart two things must be to shade one another: this, and this much per unit from the middle
  };

  // ---- the layers
  const camera = new OrthographicCamera(-REACH, REACH, REACH, -REACH, 0.05, DEEP * 2);
  const high = (p: V3) => dot(p.sub(U.centre), U.dir).add(DEEP).div(DEEP * 2); // 1 nearest the sun; 0 is "nothing here"
  const target = (type: typeof FloatType | typeof HalfFloatType, format: typeof RGFormat | typeof RGBAFormat, depthBuffer: boolean) =>
    new RenderTarget(size, size, { type, format, depthBuffer, minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false });
  const layers = Array.from({ length: LAYERS }, () => target(FloatType, RGFormat, true));
  const here = () => ivec2(screenCoordinate.xy);
  const scenes = layers.map((_, k) => {
    const scene = new Scene();
    scene.background = new Color(0, 0, 0);
    for (const part of parts) {
      const m = new NodeMaterial();
      m.side = part.side;
      m.blending = NoBlending;
      if (part.position) m.positionNode = part.position;
      m.fragmentNode = Fn(() => {
        const q = high(positionWorld);
        // only what lies beyond the layer before
        if (k > 0) Discard(q.greaterThanEqual(textureLoad(layers[k - 1].texture, here()).r.sub(0.0004)));
        return vec4(q, part.keeps, 0, 1);
      })();
      const mesh = new Mesh(part.geometry, m);
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
    return scene;
  });
  // the four side by side in two textures, so a reader needs two reads, not four
  const heights = target(FloatType, RGBAFormat, false);
  const kept = target(HalfFloatType, RGBAFormat, false);
  const side = (channel: "r" | "g") => {
    const m = new NodeMaterial();
    m.blending = NoBlending;
    const [a, b, c, d] = layers.map((l) => textureLoad(l.texture, here())[channel]);
    m.fragmentNode = vec4(a, b, c, d);
    return new QuadMesh(m);
  };
  const packHeights = side("r");
  const packKept = side("g");

  // light left at a place, of the sun's, after the layers it met on the way
  const spot = (p: V3) => {
    const c = U.across.mul(vec4(p, 1));
    const flat = vec2(c.x.mul(0.5).add(0.5), c.y.mul(-0.5).add(0.5));
    const inside = step(abs(flat.x.sub(0.5)).max(abs(flat.y.sub(0.5))), 0.498);
    return { pix: flat.mul(size).sub(0.5), q: high(p), inside };
  };
  // (`_own`: what the thing asking keeps itself. Nothing is done with it here: the layers are whole things, and
  // one is not behind itself. The other kind of sun map, deep.ts, needs it)
  const through = (p: V3, _own?: Node<"float">) => {
    const { pix, q, inside } = spot(p);
    const i0 = floor(pix).toVar();
    const f = pix.sub(i0).toVar();
    // a blade must not shade itself, and things stand apart by about as much as they are far from the tip
    const slack = U.slack.x.add(dot(p, p).sqrt().mul(U.slack.y)).div(DEEP * 2);
    const tap = (dx: number, dy: number) => {
      const at = ivec2(clamp(i0.add(vec2(dx, dy)), 0, size - 1));
      const met = smoothstep(slack, slack.mul(2.6), textureLoad(heights.texture, at).sub(q));
      return exp(U.takes.mul(dot(textureLoad(kept.texture, at), met)).negate());
    };
    const left = mix(mix(tap(0, 0), tap(1, 0), f.x), mix(tap(0, 1), tap(1, 1), f.x), f.y);
    return mix(vec3(1), left, inside);
  };
  // the same, one read: for the water itself, where nothing is sharp
  const throughWater = (p: V3) => {
    const { pix, q, inside } = spot(p);
    const at = ivec2(clamp(floor(pix.add(0.5)), 0, size - 1));
    const met = step(q.add(0.002), textureLoad(heights.texture, at));
    return mix(vec3(1), exp(U.takes.mul(dot(textureLoad(kept.texture, at), met)).negate()), inside);
  };

  const { spread, gathered } = net;

  const aim = () => {
    const L = U.dir.value.normalize();
    camera.position.copy(U.centre.value).addScaledVector(L, DEEP);
    camera.up.set(0, 0, -1);
    camera.lookAt(U.centre.value);
    camera.updateMatrixWorld();
    net.face(L);
  };
  aim();

  const render = (renderer: WebGPURenderer, phase: number) => {
    const before = renderer.getRenderTarget();
    net.render(renderer, phase);
    for (let k = 0; k < LAYERS; k++) {
      renderer.setRenderTarget(layers[k]);
      renderer.render(scenes[k], camera);
    }
    renderer.setRenderTarget(heights);
    packHeights.render(renderer);
    renderer.setRenderTarget(kept);
    packKept.render(renderer);
    renderer.setRenderTarget(before);
    // after the first render the camera's matrices are the renderer's kind
    U.across.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  };

  return { U, aim, render, through, throughWater, gathered, spread, layers, heights, kept, web: net.target };
}
