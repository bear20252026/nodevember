// Planet: a ball built of the stairs page's cubes, stairs, fans and arches (world.ts), turning before the eye.
//
// It turns round the line toward the sun, so the light on every point of it never changes: it is gathered once,
// on the ball itself (gather.wgsl), into a table of small squares of its faces, and painted from there
// (paint.wgsl) with no noise, however it turns. A new ball, or a new sun, starts the gathering over.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Color } from "three";
import { createPlanet, planetDefaults, WORDS } from "./world.ts";
import commonCode from "./common.wgsl?raw";
import gatherCode from "./gather.wgsl?raw";
import paintCode from "./paint.wgsl?raw";
import showCode from "./show.wgsl?raw";
import stairsCode from "../stairs/trace.wgsl?raw";

const LOOP = 40; // seconds for the ball to turn once

// the shapes themselves (stairs, fans, small cubes, arches, and how they are laid) are the stairs page's own
const shapes = stairsCode.slice(stairsCode.indexOf("// a point of a cell, laid the way a shape wants it"), stairsCode.indexOf("struct Hit {"));

export const look = {
  // the ball (changing any of these makes a new one)
  ...planetDefaults,
  steps: 9, // steps in a flight
  turns: 12, // steps in a fan
  small: 0.5, // side of the small cubes
  // the sun, as it is before the eye: how far to the right, up, and toward the eye. The ball turns round it
  sunRight: 0.5,
  sunUp: 0.8,
  sunNear: 0.25,
  sunWide: 50, // degrees across
  sun: 2.9,
  sunTone: "#ffe5bd",
  skyHigh: "#c99fd6",
  skyLow: "#5a3c72",
  sky: 0.64,
  clay: "#e8aea6",
  // what only light that goes from thing to thing shows: lines of cubes and small cubes of polished gold, and
  // rooms lit from within (as on the stairs page)
  gold: 0.13, // lines of cubes that are gold
  polish: 1, // small cubes that are gold
  metalTone: "#e8c27e",
  shine: 2.2, // how much brighter the sky is, seen in gold
  glow: 0.35, // rooms that are lit
  glowTone: "#ffb066",
  glowPower: 9,
  // the picture
  exposure: 1,
  grain: 0.02,
  zoom: 1,
  spin: 1, // turns a loop
  tilt: 35, // degrees the eye is above the ball's middle
  detail: 2.5, // millions of pixels it is painted with, at most (the screen may have more)
  rays: 4, // rays a pixel, for smooth edges
  texel: 16, // squares across a cube that the light is kept in
  keep: 1024, // samples of light a square keeps, at most
  gather: 0.5, // points sampled a frame, as a share of the picture's width (and height)
};
const ranges: Record<string, [number, number, number?]> = {
  seed: [1, 999, 1],
  size: [3, 12, 0.5],
  round: [1, 2.5, 0.05],
  rough: [0, 4, 0.05],
  stairs: [0, 1, 0.01],
  fans: [0, 1, 0.01],
  pleats: [0, 1, 0.01],
  cubes: [0, 1, 0.01],
  arches: [0, 1, 0.01],
  pairs: [0, 1, 0.01],
  steps: [2, 24, 1],
  turns: [2, 32, 1],
  small: [0.2, 0.8, 0.01],
  sunRight: [-1, 1, 0.01],
  sunUp: [-1, 1, 0.01],
  sunNear: [-1, 1, 0.01],
  sunWide: [0, 120, 1],
  sun: [0, 8, 0.05],
  sky: [0, 3, 0.01],
  exposure: [0.2, 3, 0.01],
  grain: [0, 0.2, 0.005],
  zoom: [0.3, 4, 0.01],
  spin: [-3, 3, 1],
  tilt: [-89, 89, 1],
  detail: [0.3, 8, 0.1],
  rays: [1, 4, 1],
  texel: [6, 32, 1],
  keep: [16, 8192, 16],
  gather: [0.1, 1, 0.05],
  gold: [0, 1, 0.01],
  polish: [0, 1, 0.01],
  shine: [0, 5, 0.05],
  glow: [0, 1, 0.01],
  glowPower: [0, 40, 0.5],
};
const remake = new Set(["seed", "size", "round", "rough", "stairs", "fans", "pleats", "cubes", "arches", "pairs", "texel"]);
// what the light depends on: changing any of these gathers it again
const relight = new Set(["steps", "turns", "small", "sunRight", "sunUp", "sunNear", "sunWide", "sun", "sunTone", "skyHigh", "skyLow", "sky", "clay", "tilt", "gold", "polish", "metalTone", "shine", "glow", "glowTone", "glowPower"]);

type V = [number, number, number];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scaled = (a: number[], s: number) => a.map((v) => v * s) as V;
const sum = (...vs: number[][]) => [0, 1, 2].map((i) => vs.reduce((t, v) => t + v[i], 0)) as V;
const unit = (a: number[]) => scaled(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const cross = (a: number[], b: number[]): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// v turned by an angle round the line k (a unit)
const turn = (v: number[], k: number[], angle: number) => sum(scaled(v, Math.cos(angle)), scaled(cross(k, v), Math.sin(angle)), scaled(k, dot(k, v) * (1 - Math.cos(angle))));

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("WebGPU is not available");
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const common = commonCode.replace("//#shapes", shapes);
  const module = (code: string) => device.createShaderModule({ code });
  const gatherPipe = device.createComputePipeline({ layout: "auto", compute: { module: module(common + gatherCode), entryPoint: "gather" } });
  const painter = module(common + paintCode);
  const paintPipe = device.createRenderPipeline({ layout: "auto", vertex: { module: painter, entryPoint: "vert" }, fragment: { module: painter, entryPoint: "frag", targets: [{ format: "rgba16float" }] } });
  const shower = module(showCode);
  const showPipe = device.createRenderPipeline({ layout: "auto", vertex: { module: shower, entryPoint: "vert" }, fragment: { module: shower, entryPoint: "frag", targets: [{ format }] } });
  const uniform = (size: number) => device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const params = uniform(256);
  const shown = uniform(16);
  const smooth = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const group = (of: GPUComputePipeline | GPURenderPipeline, ...entries: (GPUBuffer | GPUTexture | GPUSampler)[]) =>
    device.createBindGroup({ layout: of.getBindGroupLayout(0), entries: entries.map((e, binding) => ({ binding, resource: e instanceof GPUTexture ? e.createView() : e instanceof GPUSampler ? e : { buffer: e } })) });

  let world = createPlanet(look);
  let cells: GPUBuffer | null = null;
  // the table the light is kept in: for each slot, what texel it is, and its red, green, blue and how many samples
  let slots = 0;
  let keys: GPUBuffer | null = null;
  let sums: GPUBuffer | null = null;
  let painted: GPUTexture | null = null;
  let size = [0, 0];
  let groups: { gather: GPUBindGroup; paint: GPUBindGroup; show: GPUBindGroup } | null = null;
  let clear = true; // the table is to be emptied before the next gathering
  let frame = 0; // frames gathered since then
  const state = { hold: -1, frame: 0, samples: 0, pause: false, rows: 0, spent: 0, interval: 0, slots: 0 };

  // how big the table must be: a texel for every square of every face that shows, and room to spare. (Up to 2^22
  // slots, 80 MB: beyond what fits, texels go without and are shown with a guess)
  const room = () => {
    const { G, data } = world;
    const solid = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < G && y < G && z < G && (data[((z * G + y) * G + x) * WORDS] & 1) === 1;
    let area = 0;
    for (let z = 0; z < G; z++)
      for (let y = 0; y < G; y++)
        for (let x = 0; x < G; x++) {
          const c = ((z * G + y) * G + x) * WORDS;
          if (data[c] & 1) {
            for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) if (!solid(x + dx, y + dy, z + dz)) area++;
            for (let f = 1; f <= 3; f++) if (data[c + f] & 1) area += 2;
          } else if ((data[c] >> 1) & 7) area += 3;
        }
    const texels = area * look.texel * look.texel * 1.3;
    return 2 ** Math.min(22, Math.max(18, Math.ceil(Math.log2(texels * 2.2))));
  };
  const bind = () => {
    if (!cells || !keys || !sums || !painted) return;
    groups = { gather: group(gatherPipe, params, cells, keys, sums), paint: group(paintPipe, params, cells, keys, sums), show: group(showPipe, shown, painted, smooth) };
  };
  const relit = () => ((clear = true), (frame = 0));
  const rebuild = () => {
    world = createPlanet(look);
    cells?.destroy();
    cells = device.createBuffer({ size: world.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(cells, 0, world.data);
    const want = room();
    if (want !== slots) {
      keys?.destroy();
      sums?.destroy();
      slots = want;
      const table = (bytes: number) => device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
      keys = table(slots * 4);
      sums = table(slots * 16);
      state.slots = slots;
    }
    bind();
    relit();
  };
  const resize = () => {
    // as many pixels as the screen has, up to `detail` millions: beyond that, fewer, stretched over the screen
    const fit = Math.min(1, Math.sqrt((look.detail * 1e6) / (canvas.width * canvas.height)));
    const [w, h] = [Math.max(16, Math.round(canvas.width * fit)), Math.max(16, Math.round(canvas.height * fit))];
    if (w === size[0] && h === size[1]) return;
    painted?.destroy();
    painted = device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    size = [w, h];
    bind();
  };
  rebuild();

  // ---- looking about: drag across turns the ball further round the sun, drag up and down shows its other sides
  const turned = [0, 0];
  let dragging = false;
  const down = () => ((dragging = true), (canvas.style.cursor = "grabbing"));
  const up = () => ((dragging = false), (canvas.style.cursor = "grab"));
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    turned[0] += e.movementX * 0.006;
    turned[1] = Math.min(1.5, Math.max(-1.5, turned[1] + e.movementY * 0.006));
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    look.zoom = Math.min(4, Math.max(0.3, look.zoom * Math.exp(-e.deltaY * 0.0015)));
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointermove", move);
  canvas.addEventListener("wheel", wheel, { passive: false });

  const gui = new GUI({ title: "planet" });
  gui.close();
  for (const k of Object.keys(look) as (keyof typeof look)[]) {
    const c = typeof look[k] === "string" ? gui.addColor(look, k) : gui.add(look as unknown as Record<string, number>, k, ...(ranges[k] as [number, number, number]));
    if (remake.has(k)) c.onFinishChange(rebuild);
    else if (relight.has(k)) c.onChange(relit);
  }
  gui.add({ another: () => ((look.seed = 1 + Math.floor(Math.random() * 998)), gui.controllersRecursive().forEach((c) => c.updateDisplay()), rebuild()) }, "another");
  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0";
  canvas.after(stats.dom);

  // (the stairs page's tools work on this page too: they look for these)
  Object.assign(window, { __stairs: { look, state, rebuild, refresh: relit, world: () => world, device, centre: [0, 0], turned } });

  const tone = (hex: string, gain = 1) => new Color(hex).toArray().map((v) => v * gain);
  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    resize();
    if (!groups) return;

    // The eye as it is before the ball has turned: above its middle by `tilt`, looking at it. The sun is placed by
    // that, and stays where it is on the ball; the ball turns round the line to it (the eye goes round the other
    // way, which is the same), and the sky is fixed to the ball as well. So the light on the ball never changes.
    const high = (look.tilt * Math.PI) / 180;
    const round0 = Math.PI / 4;
    const toEye0: V = [Math.cos(high) * Math.sin(round0), Math.sin(high), Math.cos(high) * Math.cos(round0)];
    const right0: V = [Math.cos(round0), 0, -Math.sin(round0)];
    const up0 = cross(toEye0, right0);
    const sun = unit(sum(scaled(right0, look.sunRight), scaled(up0, look.sunUp), scaled(toEye0, look.sunNear)));
    const skyUp = unit(sum(up0, scaled(toEye0, 0.35)));
    const angle = -(ph * look.spin * 2 * Math.PI + turned[0]);
    let right = turn(right0, sun, angle);
    let upward = turn(up0, sun, angle);
    let toEye = turn(toEye0, sun, angle);
    // and dragging up or down: the eye goes over the ball
    [upward, toEye] = [turn(upward, right, -turned[1]), turn(toEye, right, -turned[1])];
    right = cross(upward, toEye);
    const fore = scaled(toEye, -1);
    const scale = (look.zoom * 0.45 * Math.min(size[0], size[1])) / (look.size + 1); // pixels to a cube
    const grid = [Math.max(1, Math.round(size[0] * look.gather)), Math.max(1, Math.round(size[1] * look.gather))];
    device.queue.writeBuffer(
      params,
      0,
      new Float32Array([
        ...size, scale, frame,
        look.steps, look.turns, look.small, look.texel,
        ...right, world.half,
        ...upward, world.G,
        ...fore, 0,
        ...sun, ((look.sunWide / 2) * Math.PI) / 180,
        ...tone(look.sunTone, look.sun), 0,
        ...tone(look.skyHigh, look.sky), 0,
        ...tone(look.skyLow, look.sky), 0,
        ...tone(look.clay), 0,
        ...skyUp, 0,
        slots, look.keep, look.rays, look.exposure,
        ...grid, 0, 0,
        ...tone(look.glowTone, look.glowPower), look.glow,
        ...tone(look.metalTone), look.shine,
        look.gold, look.polish, look.seed * 7919, 0,
      ]),
    );
    device.queue.writeBuffer(shown, 0, new Float32Array([canvas.width, canvas.height, look.grain, Math.floor(ph * LOOP * 60) % 997]));

    const encoder = device.createCommandEncoder();
    if (clear) {
      encoder.clearBuffer(keys!);
      encoder.clearBuffer(sums!);
      clear = false;
    }
    const gathering = encoder.beginComputePass();
    gathering.setPipeline(gatherPipe);
    gathering.setBindGroup(0, groups.gather);
    gathering.dispatchWorkgroups(Math.ceil(grid[0] / 8), Math.ceil(grid[1] / 8));
    gathering.end();
    const draw = (to: GPUTextureView, of: GPURenderPipeline, bound: GPUBindGroup) => {
      const pass = encoder.beginRenderPass({ colorAttachments: [{ view: to, loadOp: "clear", storeOp: "store" }] });
      pass.setPipeline(of);
      pass.setBindGroup(0, bound);
      pass.draw(3);
      pass.end();
    };
    draw(painted!.createView(), paintPipe, groups.paint);
    draw(context.getCurrentTexture().createView(), showPipe, groups.show);
    device.queue.submit([encoder.finish()]);
    stats.update();
    frame++;
    state.frame++;
    state.samples = frame;
  };

  wrap.unload = () => {
    canvas.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointermove", move);
    canvas.removeEventListener("wheel", wheel);
    gui.destroy();
    stats.dom.remove();
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: LOOP * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
