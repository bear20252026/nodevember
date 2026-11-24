// Stairs: a generator of endless piles of cubes with stairs, fans, pleats and arches on them, after a picture
// in the spirit of Escher's Relativity. world.ts makes the pile, trace.wgsl lights one tile of it a sample at
// a time, and this page lays the tile over the screen, where it can be dragged about for ever.
//
// Lighting the whole tile once takes several frames' worth of time. So it is done a band at a time, as much a
// frame as the frame has room for, and while the samples are few the picture is shown cleaned (clean.wgsl).
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Color } from "three";
import { createWorld, worldDefaults } from "./world.ts";
import { createPeople, posePeople, peopleDefaults, CAPS, FIG, MOST, SLOTS, tally, type Figure } from "./people.ts";
import traceCode from "./trace.wgsl?raw";
import cleanCode from "./clean.wgsl?raw";
import showCode from "./show.wgsl?raw";
import peopleCode from "./people.wgsl?raw";

const LOOP = 48; // seconds for the picture to drift a repeat of the pile on, and the walkers on the way with it
// the light at dusk: the sun low and warm and weak, the sky dark, so that the lit rooms show what they do
const DUSK = { sun: 0.35, sunTone: "#ff9e6e", skyHigh: "#4a5580", skyLow: "#251d3a", sky: 0.4, exposure: 1.8, glow: 0.6, glowPower: 14 };
const SETTLED = 128; // samples from which the picture is shown just as it is
// when the picture is cleaned anew: often at first, then every time it has half as many samples again
const due = (n: number) => n < SETTLED && (n <= 4 || (n & (n - 1)) === 0 || (n % 3 === 0 && ((n / 3) & (n / 3 - 1)) === 0));

export const look = {
  // the pile (changing any of these makes a new one)
  ...worldDefaults,
  steps: 9, // steps in a flight
  turns: 12, // steps in a fan
  small: 0.5, // side of the small cubes
  // the sun, by how squarely it meets each of the three kinds of face
  onTop: 1,
  onRight: 0.4,
  onLeft: 0,
  sunWide: 50, // degrees across. Wide: shadows are soft, and no flat face is one flat colour
  sun: 2.9,
  sunTone: "#ffe5bd",
  skyHigh: "#c99fd6",
  skyLow: "#5a3c72",
  sky: 0.64,
  clay: "#e8aea6",
  // what only light that goes from thing to thing shows
  glow: 0.35, // how many of the rooms behind the arches are lit from within
  glowTone: "#ffb066",
  glowPower: 9,
  gold: 0.13, // how many columns are polished gold
  polish: 1, // how many of the small cubes are polished
  metalTone: "#e8c27e",
  blur: 0.06, // how far from a true mirror the polish is
  shine: 3, // how much brighter the sky is, seen in gold (never darker than at the horizon)
  // the people
  ...peopleDefaults,
  onWay: 4, // walkers on the way through the whole pile
  shade: 0.85, // how dark the shade they cast
  // the picture
  exposure: 1,
  grain: 0.02,
  zoom: 1, // screen pixels to a pixel of the tile
  drift: 0.5, // tiles a loop, down and to the right (a half: a repeat of the pile on, as the way goes)
  res: 2048, // the tile's width, pixels
  samples: 400, // how long to go on refining it
  smooth: true, // light a band of the tile a frame, as much as keeps the frames coming, and not the whole of it
  clean: true, // show it cleaned while the samples are few
  faces: false, // show which way each surface faces, instead of the light on it
};
const ranges: Record<string, [number, number, number?]> = {
  P: [4, 16, 2],
  seed: [1, 999, 1],
  rough: [0, 4, 0.05],
  stairs: [0, 1, 0.01],
  pleats: [0, 1, 0.01],
  fans: [0, 1, 0.01],
  cubes: [0, 1, 0.01],
  arches: [0, 1, 0.01],
  flights: [0, 0.5, 0.01],
  long: [2, 8, 1],
  passages: [0, 1, 0.01],
  path: [0, 1, 1],
  pairs: [0, 1, 0.01],
  walkers: [0, 1, 0.01],
  sitters: [0, 1, 0.01],
  tall: [0.2, 0.8, 0.01],
  pace: [0.5, 4, 0.05],
  shade: [0, 1, 0.01],
  steps: [2, 24, 1],
  turns: [2, 32, 1],
  small: [0.2, 0.8, 0.01],
  onTop: [0, 1, 0.01],
  onRight: [0, 1, 0.01],
  onLeft: [0, 1, 0.01],
  sunWide: [0, 120, 1],
  sun: [0, 8, 0.05],
  sky: [0, 3, 0.01],
  glow: [0, 1, 0.01],
  glowPower: [0, 12, 0.1],
  gold: [0, 0.5, 0.01],
  onWay: [0, 8, 1],
  polish: [0, 1, 0.01],
  blur: [0, 0.6, 0.01],
  shine: [0, 4, 0.05],
  exposure: [0.2, 3, 0.01],
  grain: [0, 0.2, 0.005],
  zoom: [0.25, 4, 0.01],
  drift: [-2, 2, 0.5],
  res: [512, 4096, 256],
  samples: [16, 2000, 16],
};
const remake = new Set(["P", "seed", "rough", "stairs", "pleats", "fans", "cubes", "arches", "flights", "long", "passages", "pairs", "path"]);

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("WebGPU is not available");
  const timed = adapter.features.has("timestamp-query"); // then a band's cost can be read off the graphics card's own clock
  const device = await adapter.requestDevice({ requiredFeatures: timed ? ["timestamp-query"] : [] });
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const module = (code: string) => device.createShaderModule({ code });
  const pipe = (code: GPUShaderModule, entryPoint: string, to: GPUTextureFormat) => device.createRenderPipeline({ layout: "auto", vertex: { module: code, entryPoint: "vert" }, fragment: { module: code, entryPoint, targets: [{ format: to }] } });
  const tracer = module(traceCode);
  const tracePipe = pipe(tracer, "frag", "rgba32float");
  const guidePipe = pipe(tracer, "guide", "rgba16float");
  const cleanPipe = pipe(module(cleanCode), "frag", "rgba16float");
  // the screen is drawn with four samples a pixel, for the people's edges
  const shower = module(showCode);
  const painted = format;
  const showPipe = device.createRenderPipeline({ layout: "auto", vertex: { module: shower, entryPoint: "vert" }, fragment: { module: shower, entryPoint: "frag", targets: [{ format: painted }] }, multisample: { count: 4 }, depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "always" } });
  const shadePipe = device.createRenderPipeline({ layout: "auto", vertex: { module: shower, entryPoint: "vert" }, fragment: { module: shower, entryPoint: "shade", targets: [{ format: "rgba8unorm" }] } });
  const soft = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const blendPipe = device.createRenderPipeline({ layout: "auto", vertex: { module: shower, entryPoint: "vert" }, fragment: { module: shower, entryPoint: "blend", targets: [{ format: "rgba16float" }] } });
  const tiled = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "repeat", addressModeV: "repeat" });
  let ready: GPUTexture | null = null; // the tile as shown
  let readyGroups: GPUBindGroup[] = [];
  let readyFor = ""; // what it was last made from
  // a bind group by binding number (for pipelines that do not use every binding of their shader)
  const bindAt = (of: GPURenderPipeline, entries: Record<number, GPUBuffer | GPUTexture | GPUSampler>) =>
    device.createBindGroup({ layout: of.getBindGroupLayout(0), entries: Object.entries(entries).map(([b, e]) => ({ binding: +b, resource: e instanceof GPUTexture ? e.createView() : e instanceof GPUSampler ? e : { buffer: e } })) });
  const painter = module(peopleCode);
  const peoplePipe = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: painter, entryPoint: "vert" },
    fragment: { module: painter, entryPoint: "frag", targets: [{ format: painted }] },
    primitive: { topology: "triangle-strip" },
    multisample: { count: 4, alphaToCoverageEnabled: true },
    depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
  });
  const uniform = (size: number) => device.createBuffer({ size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const params = uniform(160);
  const view = uniform(144);
  const storage = (size: number) => device.createBuffer({ size, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const bodies = new Float32Array(MOST * FIG * 4);
  const near = new Uint32Array(64 * 112 * SLOTS); // room for the widest tile's grid
  const bodiesOut = storage(bodies.byteLength);
  const nearOut = storage(near.byteLength);
  const reach = [uniform(16), uniform(16)]; // for the two goes of the cleaning
  const clock = timed ? device.createQuerySet({ type: "timestamp", count: 2 }) : null;
  const clockOut = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const clockRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  // (and the picture's own pass, now and then: what showing it costs, in state.shown)
  const showClock = timed ? device.createQuerySet({ type: "timestamp", count: 2 }) : null;
  const showOut = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
  const showRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  let showTiming = false;
  const group = (of: GPURenderPipeline, ...entries: (GPUBuffer | GPUTexture)[]) => device.createBindGroup({ layout: of.getBindGroupLayout(0), entries: entries.map((e, binding) => ({ binding, resource: e instanceof GPUTexture ? e.createView() : { buffer: e } })) });

  // what is remade with the pile, or with the tile's size
  let world = createWorld(look);
  let cells: GPUBuffer | null = null;
  let sheets: GPUTexture[] = []; // the light so far, and the one before: each sample reads one and writes the other
  let faces: GPUTexture | null = null; // what each pixel shows (the guide)
  let half: GPUTexture | null = null; // the cleaning, half done
  let cleans: GPUTexture[] = []; // the cleaned picture that is shown, and the one being made
  let traceGroups: GPUBindGroup[] = [];
  let guideGroup: GPUBindGroup | null = null;
  let firstGroups: GPUBindGroup[] = [];
  let secondGroup: GPUBindGroup | null = null;
  let showGroups: GPUBindGroup[] = [];
  let peopleGroups: GPUBindGroup[] = [];
  let people: Figure[] = [];
  let canvasOut: { w: number; h: number; tone: GPUTexture; depth: GPUTexture; shade: GPUTexture; groups: GPUBindGroup[]; shadeGroup: GPUBindGroup } | null = null;
  let tile = [0, 0];
  const state = { hold: -1, frame: 0, samples: 0, pause: false, rows: 0, spent: 0, interval: 0, people: 0, dropped: 0, shown: 0, skip: { people: false, shade: false }, rebuilt: 0 };

  // ---- the work, which is one thing after another, each done from the top of the tile to the bottom:
  // a sample of light, and now and then the two goes of the cleaning after it
  type Kind = "trace" | "first" | "second";
  let frame = 0; // whole samples in the picture so far
  let kind: Kind = "trace";
  let y = 0; // how far down the tile the work in hand has got
  let front = -1; // which of the cleaned pictures is fit to show
  let fresh = true; // nothing of this picture is on the screen yet
  // rows of the tile a frame, as a share of the tile, for each kind of work: put right as the frames show what they bear
  const share = { trace: 1 / 8, first: 1 / 8, second: 1 / 8 };
  const allowed = (k: Kind) => Math.max(8, Math.round(tile[1] * share[k]));

  const populate = () => (people = createPeople(world, { ...look, onWay: look.onWay }, look.steps, look.turns, LOOP, look.small));
  const refresh = () => ((frame = 0), (kind = "trace"), (y = 0), (front = -1), (fresh = true), populate());
  const rebuild = () => {
    world = createWorld(look);
    cells?.destroy();
    cells = device.createBuffer({ size: world.data.byteLength, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(cells, 0, world.data);
    const w = Math.round(look.res);
    // (even: so that half the tile down is a whole number of pixels, and the tile is the same half a tile on)
    const h = 2 * Math.round((look.res * Math.sqrt(3)) / 2);
    if (w !== tile[0]) {
      [...sheets, ...cleans, faces, half, canvasOut?.tone, canvasOut?.depth].forEach((t) => t?.destroy());
      canvasOut = null;
      const sheet = (format: GPUTextureFormat) => device.createTexture({ size: [w, h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      sheets = [sheet("rgba32float"), sheet("rgba32float")];
      [faces, half, ...cleans] = [0, 1, 2, 3].map(() => sheet("rgba16float"));
      tile = [w, h];
      firstGroups = sheets.map((t) => group(cleanPipe, reach[0], t, faces!));
      secondGroup = group(cleanPipe, reach[1], half!, faces!);
      showGroups = [];
      ready?.destroy();
      ready = device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      readyGroups = [0, 1, 2, 3].map((n) => bindAt(blendPipe, { 0: view, 1: sheets[n >> 1], 2: cleans[n & 1] }));
      readyFor = "";
      peopleGroups = [0, 1, 2, 3].map((n) => group(peoplePipe, view, sheets[n >> 1], cleans[n & 1], faces!, bodiesOut));
    }
    // each reads the other sheet and writes its own
    traceGroups = sheets.map((_, n) => group(tracePipe, params, cells!, sheets[1 - n]));
    guideGroup = group(guidePipe, params, cells!);
    refresh();
  };
  rebuild();

  const tone = (hex: string, gain = 1) => new Color(hex).toArray().map((v) => v * gain);
  const sunWay = () => {
    const sun = [look.onRight, look.onTop, look.onLeft];
    const len = Math.hypot(...sun) || 1;
    return sun.map((v) => v / len) as [number, number, number];
  };
  const writeParams = () => {
    const sun = sunWay();
    const len = 1;
    device.queue.writeBuffer(
      params,
      0,
      new Float32Array([
        ...tile,
        world.P,
        frame,
        world.high,
        look.steps,
        look.turns,
        look.small,
        ...sun.map((v) => v / len),
        ((look.sunWide / 2) * Math.PI) / 180,
        ...tone(look.sunTone, look.sun),
        0,
        ...tone(look.skyHigh, look.sky),
        0,
        ...tone(look.skyLow, look.sky),
        0,
        ...tone(look.clay),
        look.faces ? ((look as unknown as { probe?: number }).probe ?? 1) : 0,
        ...tone(look.glowTone, look.glowPower), look.glow,
        ...tone(look.metalTone), look.blur,
        look.gold, look.polish, (look.seed * 2654435761) % 4294967296, look.shine,
      ]),
    );
  };

  // ---- looking about: drag, and the wheel. A click on someone goes with them, and turns the picture so that they
  // stand upright: seen down the cube's diagonal the pile looks itself turned by a third of a turn, and then the
  // floors of another way up are the floors. T turns it by a third; Escape lets go. (Space is ssam's: play, pause)
  const centre = [0, 0]; // world units, on top of the drift
  const eye = { angle: 0, aim: 0, follow: -1, zoomAim: -1, zoomBefore: 1, time: performance.now() };
  let dragging = false;
  let moved = 0;
  const scale = () => (look.zoom * tile[0]) / (world.P * Math.SQRT2); // canvas pixels to a unit
  // a vector on the screen as it is in the picture (turned back)
  const unturn = (x: number, y: number) => [x * Math.cos(eye.angle) + y * Math.sin(eye.angle), y * Math.cos(eye.angle) - x * Math.sin(eye.angle)];
  const letGo = () => {
    if (eye.follow >= 0) eye.zoomAim = eye.zoomBefore;
    eye.follow = -1;
  };
  const down = (e: PointerEvent) => ((dragging = true), (moved = 0), (canvas.style.cursor = "grabbing"), void e);
  const up = (e: PointerEvent) => {
    if (dragging && moved < 5 && e.target === canvas) pick(e);
    dragging = false;
    canvas.style.cursor = "grab";
  };
  // who is under the pointer: the nearest of the people drawn there, the picture being the same a tile on
  let pickAt: number[] = [0, 0];
  const pick = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / canvas.clientWidth;
    const [ox, oy] = unturn(((e.clientX - r.left) * k - canvas.width / 2) / scale(), (canvas.height / 2 - (e.clientY - r.top) * k) / scale());
    const at = [pickAt[0] + ox, pickAt[1] + oy];
    const extent = [world.P * Math.SQRT2, world.P * Math.sqrt(6)];
    let best = -1;
    let bestD = Infinity;
    for (let n = 0; n < state.people; n++) {
      const b = n * FIG * 4;
      let dx = at[0] - bodies[b + 4];
      let dy = at[1] - bodies[b + 5];
      dx -= Math.round(dx / extent[0]) * extent[0];
      dy -= Math.round(dy / extent[1]) * extent[1];
      const d = Math.hypot(dx, dy);
      if (d < bodies[b + 7] * 1.4 + 0.08 && d < bestD) ((best = n >> 1), (bestD = d));
    }
    if (best < 0) return letGo();
    if (eye.follow < 0) eye.zoomBefore = look.zoom;
    eye.follow = best;
    eye.zoomAim = Math.max(eye.zoomBefore, 2.2);
    hint.style.opacity = "0";
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    if (moved < 5) return;
    letGo();
    const k = (canvas.width / canvas.clientWidth) / scale();
    const [dx, dy] = unturn(e.movementX * k, -e.movementY * k);
    centre[0] -= dx;
    centre[1] -= dy;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    look.zoom = Math.min(4, Math.max(0.25, look.zoom * Math.exp(-e.deltaY * 0.0015)));
    eye.zoomAim = -1;
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  canvas.addEventListener("pointerdown", down);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointermove", move);
  canvas.addEventListener("wheel", wheel, { passive: false });
  const key = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.code === "KeyT") ((eye.aim += (2 * Math.PI) / 3), (hint.style.opacity = "0"));
    if (e.code === "Escape") letGo();
  };
  window.addEventListener("keydown", key);
  const hint = document.createElement("div");
  hint.textContent = "click someone to go with them · T turns the world";
  hint.style.cssText = "position:fixed;left:0;right:0;bottom:max(18px, env(safe-area-inset-bottom, 0px));text-align:center;font:12px/1.4 system-ui,sans-serif;letter-spacing:0.04em;color:rgba(70,35,45,0.6);pointer-events:none;transition:opacity 1.2s";
  canvas.after(hint);
  setTimeout(() => (hint.style.opacity = "0"), 9000);

  const gui = new GUI({ title: "stairs" });
  gui.close();
  for (const k of Object.keys(look) as (keyof typeof look)[]) {
    const c = typeof look[k] === "boolean" ? gui.add(look as unknown as Record<string, boolean>, k) : typeof look[k] === "string" ? gui.addColor(look, k) : gui.add(look as unknown as Record<string, number>, k, ...(ranges[k] as [number, number, number]));
    if (remake.has(k) || k === "res") c.onFinishChange(rebuild);
    else if (["walkers", "sitters", "pace", "tall", "onWay"].includes(k)) c.onChange(populate);
    else if (!["exposure", "grain", "zoom", "drift", "samples", "smooth", "clean", "shade"].includes(k)) c.onChange(refresh);
  }
  gui.add({ another: () => ((look.seed = 1 + Math.floor(Math.random() * 998)), gui.controllersRecursive().forEach((c) => c.updateDisplay()), rebuild()) }, "another");
  gui.add({ turn: () => (eye.aim += (2 * Math.PI) / 3) }, "turn");
  // day and dusk
  const DAY = Object.fromEntries(Object.keys(DUSK).map((k) => [k, look[k as keyof typeof look]]));
  const light = (to: Record<string, unknown>) => (Object.assign(look, to), gui.controllersRecursive().forEach((c) => c.updateDisplay()), refresh());
  gui.add({ dusk: () => light(DUSK) }, "dusk");
  gui.add({ day: () => light(DAY) }, "day");
  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0";
  canvas.after(stats.dom);

  Object.assign(window, { __stairs: { look, state, rebuild, refresh, world: () => world, device, centre, eye, bodies: () => bodies, people: () => people, view: () => ({ middle: pickAt, scale: scale(), width: canvas.width, height: canvas.height, client: canvas.clientWidth }) } }); // (the last few: for tools that click on people)

  // some rows of the work in hand, from where it had got to; and on to the next work when this is done
  let timing = false; // a reading of the clock is on its way back
  let clocked = false; // this frame's band is being timed
  const band = (encoder: GPUCommandEncoder, to: GPUTexture, of: GPURenderPipeline, bound: GPUBindGroup, rows: number, time = false) => {
    clocked = time && !!clock && !timing;
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: to.createView(), loadOp: "load", storeOp: "store" }],
      ...(clocked ? { timestampWrites: { querySet: clock!, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}),
    });
    pass.setPipeline(of);
    pass.setBindGroup(0, bound);
    pass.setScissorRect(0, y, tile[0], rows);
    pass.draw(3);
    pass.end();
  };
  const work = (encoder: GPUCommandEncoder, whole: boolean) => {
    const rows = whole ? tile[1] - y : Math.min(tile[1] - y, allowed(kind));
    full = rows === allowed(kind);
    did = kind;
    if (kind === "trace") {
      writeParams();
      band(encoder, sheets[frame & 1], tracePipe, traceGroups[frame & 1], rows, !whole);
    } else {
      // far apart first, the closer the more samples there are to go by; then close
      const far = frame < 8 ? 3 : frame < 32 ? 2 : 1; // (5 left a weave of its own on the plain walls)
      device.queue.writeBuffer(reach[kind === "first" ? 0 : 1], 0, new Float32Array([...tile, world.P, kind === "first" ? far : 1]));
      if (kind === "first") band(encoder, half!, cleanPipe, firstGroups[(frame - 1) & 1], rows, !whole);
      else band(encoder, cleans[front < 0 ? 0 : 1 - front], cleanPipe, secondGroup!, rows, !whole);
    }
    y += rows;
    if (y < tile[1]) return;
    y = 0;
    if (kind === "trace") (frame++, (kind = look.clean && due(frame) ? "first" : "trace"));
    else if (kind === "first") kind = "second";
    else ((front = front < 0 ? 0 : 1 - front), (kind = "trace"));
  };

  // What the frames bear. The screen's own pace is taken from the quicker of the last frames; a band may cost
  // spend() of that on the graphics card, by its own clock. (Without that clock: less when a frame comes late.)
  // (once the picture is clean, the rest of the samples come at half the pace, so the graphics card can rest)
  const spend = () => 0.6 * (frame >= SETTLED ? 0.5 : 1);
  const gaps: number[] = [];
  let last = 0;
  let interval = 16.7;
  let full = false; // the band was as many rows as were allowed, not the short last one of a sample
  let wasBanded = false;
  let did: Kind = "trace";
  const bear = (k: Kind, by: number) => (share[k] = Math.min(1, Math.max(0.002, share[k] * by)));
  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    const now = performance.now();
    if (now - last < 250) {
      gaps.push(now - last);
      if (gaps.length > 60) gaps.shift();
      interval = Math.min(34, Math.max(6, [...gaps].sort((a, b) => a - b)[Math.floor(gaps.length * 0.2)]));
    }
    if (!clock && wasBanded && now - last < 250) bear(did, now - last > interval * 1.5 ? 0.8 : 1.01);
    last = now;
    let banded = false;
    clocked = false;

    const encoder = device.createCommandEncoder();
    if (fresh) {
      // a new picture: the guide, a first sample and its cleaning all at once, to have something to show
      writeParams();
      band(encoder, faces!, guidePipe, guideGroup!, tile[1]);
      do work(encoder, true);
      while (kind !== "trace");
      fresh = false;
    } else if (kind !== "trace" || frame < look.samples) {
      work(encoder, !look.smooth);
      banded = look.smooth;
    }
    // the picture drifts down and to the right, one tile across and one tile down a loop: then every pixel is
    // back on the very texel it began on, and the loop closes (half of that is also a step of the pattern, but
    // lands on other texels, whose grain of light is not the same)
    const along = ph * look.drift * world.P * 2;
    const raw = look.clean && front >= 0 && !look.faces ? Math.min(frame / SETTLED, 1) : 1;

    // the people, as they are at this moment of the loop
    const sun = sunWay();
    const squares = [world.P * 4, Math.round(world.P * 4 * Math.sqrt(3))]; // about a third of a cube each
    const count = look.faces ? 0 : posePeople(people, ph, { tall: look.tall, steps: look.steps, turns: look.turns, P: world.P, sun }, bodies, near, squares[0], squares[1]);

    // going with someone: the view comes round to them, and turns so that their up is up the screen
    const dt = Math.min(0.1, (now - eye.time) / 1000);
    eye.time = now;
    const drifted = [along / Math.SQRT2, -along * Math.sqrt(1.5)];
    if (eye.follow >= 0 && eye.follow * 2 + 1 < count) {
      const extent = [world.P * Math.SQRT2, world.P * Math.sqrt(6)];
      // of its two likenesses, and their repeats, the nearest
      let best = [0, 0];
      let bestD = Infinity;
      for (const n of [eye.follow * 2, eye.follow * 2 + 1]) {
        const b = n * FIG * 4;
        let dx = bodies[b + 4] - (centre[0] + drifted[0]);
        let dy = bodies[b + 5] - (centre[1] + drifted[1]);
        dx -= Math.round(dx / extent[0]) * extent[0];
        dy -= Math.round(dy / extent[1]) * extent[1];
        if (Math.hypot(dx, dy) < bestD) ((bestD = Math.hypot(dx, dy)), (best = [dx, dy]));
      }
      const pull = 1 - Math.exp(-dt * 4);
      centre[0] += best[0] * pull;
      centre[1] += best[1] * pull;
      // its up, on the screen, made to point up
      const b = eye.follow * 2 * FIG * 4;
      const upAngle = Math.atan2(bodies[b + 9], bodies[b + 8]);
      let aim = Math.PI / 2 - upAngle;
      aim += Math.round((eye.aim - aim) / (2 * Math.PI)) * 2 * Math.PI;
      eye.aim = aim;
    }
    eye.angle += (eye.aim - eye.angle) * (1 - Math.exp(-dt * 3.5));
    if (eye.zoomAim > 0) {
      look.zoom += (eye.zoomAim - look.zoom) * (1 - Math.exp(-dt * 3));
      if (Math.abs(eye.zoomAim - look.zoom) < 0.002) eye.zoomAim = -1;
    }
    const middle = [centre[0] + drifted[0], centre[1] + drifted[1]];
    pickAt = middle;
    if (count) {
      device.queue.writeBuffer(bodiesOut, 0, bodies, 0, count * FIG * 4);
      device.queue.writeBuffer(nearOut, 0, near, 0, squares[0] * squares[1] * SLOTS);
    }
    state.people = count;
    state.dropped = tally.dropped;
    // What is painted: the screen, wherever the view has wandered to. And the tiles the people must be drawn in:
    // every one that shows, and a margin (a figure may stand anywhere in its tile, and its second likeness half a
    // tile off)
    const extent = [world.P * Math.SQRT2, world.P * Math.sqrt(6)];
    const paint = { size: [canvas.width, canvas.height], middle, scale: scale(), grain: look.grain };
    // (turned, the screen takes in at most the circle about it)
    const wide = [1, 1].map(() => Math.hypot(paint.size[0], paint.size[1]) / paint.scale);
    const first = [Math.floor((paint.middle[0] - wide[0] / 2) / extent[0]) - 2, Math.floor((paint.middle[1] - wide[1] / 2) / extent[1]) - 1];
    const copies = [Math.ceil(wide[0] / extent[0]) + 4, Math.ceil(wide[1] / extent[1]) + 4];
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const moment = Math.floor(ph * LOOP * 60) % 997;
    device.queue.writeBuffer(
      view,
      0,
      new Float32Array([
        ...paint.size, ...tile,
        ...paint.middle, paint.scale, world.P,
        look.exposure, paint.grain, moment, raw,
        dot(sun, [Math.SQRT1_2, 0, -Math.SQRT1_2]), dot(sun, [-1, 2, -1]) / Math.sqrt(6), dot(sun, [1, 1, 1]) / Math.sqrt(3), 0.5 / Math.tan(Math.max(look.sunWide, 4) * 0.5 * (Math.PI / 180)),
        ...tone(look.sunTone, look.sun), (world.high + 3) / Math.sqrt(3),
        ...tone(look.clay), look.shade,
        ...squares, count, CAPS,
        ...copies, ...first,
        Math.cos(eye.angle), Math.sin(eye.angle), state.skip.shade || look.shade <= 0 ? 0 : 1, 0,
      ]),
    );
    if (!canvasOut || canvasOut.w !== paint.size[0] || canvasOut.h !== paint.size[1] || !showGroups.length) {
      canvasOut?.tone.destroy();
      canvasOut?.depth.destroy();
      canvasOut?.shade.destroy();
      const sized = (to: GPUTextureFormat) => device.createTexture({ size: paint.size, format: to, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      const shade = device.createTexture({ size: paint.size.map((v) => Math.ceil(v / 2)), format: "rgba8unorm", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      showGroups = [bindAt(showPipe, { 0: view, 6: shade, 7: soft, 8: ready!, 9: tiled })];
      canvasOut = { w: paint.size[0], h: paint.size[1], tone: sized(painted), depth: sized("depth24plus"), shade, groups: showGroups, shadeGroup: bindAt(shadePipe, { 0: view, 3: faces!, 4: bodiesOut, 5: nearOut }) };
    }
    // the tile as shown, made anew when there is something new in it
    const shown = (((frame + 1) & 1) << 1) | Math.max(front, 0);
    const key = `${shown} ${frame} ${front} ${raw} ${state.rebuilt}`;
    if (key !== readyFor) {
      readyFor = key;
      const making = encoder.beginRenderPass({ colorAttachments: [{ view: ready!.createView(), loadOp: "clear", storeOp: "store" }] });
      making.setPipeline(blendPipe);
      making.setBindGroup(0, readyGroups[shown]);
      making.draw(3);
      making.end();
    }
    // the people's shade, at half the size
    if (count && !state.skip.shade && look.shade > 0) {
      const shading = encoder.beginRenderPass({ colorAttachments: [{ view: canvasOut.shade.createView(), loadOp: "clear", clearValue: [1, 1, 1, 1], storeOp: "store" }] });
      shading.setPipeline(shadePipe);
      shading.setBindGroup(0, canvasOut.shadeGroup);
      shading.draw(3);
      shading.end();
    }
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: canvasOut.tone.createView(), resolveTarget: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "discard" }],
      depthStencilAttachment: { view: canvasOut.depth.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "discard" },
      ...(showClock && !showTiming && state.frame % 20 === 0 ? { timestampWrites: { querySet: showClock, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } } : {}),
    });
    pass.setPipeline(showPipe);
    pass.setBindGroup(0, showGroups[0]);
    pass.draw(3);
    if (count && !state.skip.people) {
      pass.setPipeline(peoplePipe);
      pass.setBindGroup(0, peopleGroups[shown]);
      pass.draw(4, count * CAPS * copies[0] * copies[1]);
    }
    pass.end();
    const showing = !!showClock && !showTiming && state.frame % 20 === 0;
    if (showing) {
      encoder.resolveQuerySet(showClock!, 0, 2, showOut, 0);
      encoder.copyBufferToBuffer(showOut, 0, showRead, 0, 16);
    }
    const read = banded && clocked;
    if (read) {
      encoder.resolveQuerySet(clock!, 0, 2, clockOut, 0);
      encoder.copyBufferToBuffer(clockOut, 0, clockRead, 0, 16);
    }
    device.queue.submit([encoder.finish()]);
    wasBanded = banded;
    if (showing) {
      showTiming = true;
      showRead.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigInt64Array(showRead.getMappedRange());
        const took = Number(t[1] - t[0]) / 1e6;
        state.shown = state.shown ? state.shown * 0.85 + took * 0.15 : took; // (a running mean)
        showRead.unmap();
        showTiming = false;
      }, () => (showTiming = false));
    }
    if (read) {
      timing = true;
      const [whole, which] = [full, did];
      clockRead.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigInt64Array(clockRead.getMappedRange());
        const spent = Number(t[1] - t[0]) / 1e6;
        clockRead.unmap();
        timing = false;
        if (!(spent > 0) || spent > 500) return;
        state.spent = spent;
        // a short band says how much can be borne only if it was already too much
        const budget = interval * spend();
        if (whole || spent > budget) bear(which, Math.min(1.15, Math.max(0.6, 1 + 0.5 * (budget / spent - 1))));
      }, () => (timing = false));
    }
    state.interval = interval;
    stats.update();
    state.frame++;
    state.samples = frame;
    state.rows = allowed("trace");
  };

  wrap.unload = () => {
    canvas.removeEventListener("pointerdown", down);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointermove", move);
    window.removeEventListener("keydown", key);
    hint.remove();
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
