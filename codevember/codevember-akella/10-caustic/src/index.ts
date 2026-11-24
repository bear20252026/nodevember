/**
 * Caustic: light through moving water, on a floor. Every so often the light gathers into a drawn
 * creature, holds it, and is let go again through turbulence back into the water's pattern.
 *
 * After Baeza, Gross & Günther, "Controllable Caustic Animation Using Vector Fields" (EG 2020 short):
 * photons are particles; each knows where it is wanted (its place in the drawing, or where the water
 * sends it) and asks to go straight there, arriving as the transition ends. Those wishes are fitted by
 * one smooth field, partly made divergence-free like a liquid, plus curl-noise turbulence; photons ride
 * the field and only hand over to their own straight path in the last stretch.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "./cap";
import { creatures } from "./creatures";
import commonCode from "./shaders/common.wgsl?raw";
import displayCode from "./shaders/display.wgsl?raw";
import gridCode from "./shaders/grid.wgsl?raw";
import imageCode from "./shaders/image.wgsl?raw";
import photonsCode from "./shaders/photons.wgsl?raw";
import type { TransportReply, TransportRequest } from "./transport.worker";

const water = {
  /** depth of the floor under the surface, in screen half-heights */
  depth: 1,
  ior: 1.333,
  /** spread of the index of refraction from red to blue (water's own is about 0.006) */
  dispersion: 0.012,
  /** how far past focus the surface's curvature takes the light; above 1 the pattern folds into a net */
  sharp: 1.35,
  /** wavelength of the longest wave, in screen half-heights */
  scale: 0.55,
  speed: 1,
  waves: 12,
  seed: 3,
};

const show = {
  /** seconds of each part of a creature's turn */
  free: 2.4,
  gather: 3.4,
  hold: 2.2,
  dissolve: 3.8,
};

const flow = {
  /** how much of the fitted flow's divergence is taken out: 0 converges straight, 1 swirls like a liquid */
  liquid: 0.5,
  /** smoothness of the fitted flow, against matching each lead's wish */
  smooth: 3,
  /** where photons start handing over from the flow to their own straight path (the paper's 0.85) */
  tau: 0.85,
  turbGather: 0.25,
  turbDissolve: 1.4,
  /** spatial frequency of the largest eddies */
  turbScale: 1.6,
  turbSpeed: 0.25,
  /** how much a held drawing still trembles with the water */
  shimmer: 0.05,
  /** share of photons near the drawing that never leave the water's pattern */
  keep: 0.04,
  /** brightness of the light in the drawing against the water's (the paper's rho; 1 would blind) */
  rho: 0.3,
  /** the light gathers from round the drawing: all of it within `inner` half-sizes of its centre, fading to `far` by `outer` */
  inner: 0.75,
  outer: 1.9,
  far: 0.06,
  /** seconds for pushed light to settle back */
  relax: 0.45,
  /** leads further apart than this went to different strokes, and photons between them are not spread across */
  tear: 0.05,
  fitIters: 24,
  pressureIters: 40,
};

const stirring = { force: 1.2, radius: 0.16, fade: 0.9 };

const look = {
  exposure: 0.5,
  ambient: 0.025,
  /** weight of this frame in the running average of the light */
  ema: 0.45,
  /** kernel of the density estimate, in light pixels */
  blur: 1,
  glow: 0.05,
  glowSize: 7,
  floor: "#8c9898",
  tint: "#fff4e2",
  /** light image pixels per canvas pixel */
  res: Math.min(1, 1.25 / window.devicePixelRatio),
};

const photons = { count: 2_000_000 };

const UNIFORMS = [
  "ax", "margin", "nx", "ny", "lstep", "lx", "ly", "creature",
  "time", "timePrev", "dt", "phase", "s", "sPrev", "reset",
  "depth", "ior", "dispersion", "waveCount",
  "tau", "relax", "shimmer", "keep", "tear",
  "gx", "gy", "smoothing", "liquid", "turb", "turbScale", "turbSpeed",
  "flux", "boxX", "boxY", "boxSize", "inner", "outer", "far", "stirDecay", "mouseX", "mouseY", "mouseVX", "mouseVY", "mouseR", "mouseForce",
  "W", "H", "norm", "ema", "blur", "glowSigma",
  "exposure", "ambient", "glow", "floorR", "floorG", "floorB", "tintR", "tintG", "tintB",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

const cycle = () => show.free + show.gather + show.hold + show.dissolve;
const loopLength = () => cycle() * creatures.length;

// mulberry32
const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** a sum of plane waves, each turning a whole number of times per loop so the loop closes */
const makeWaves = () => {
  const random = rng(water.seed);
  const L = loopLength();
  const n = Math.min(16, water.waves);
  const out = new Float32Array(128);
  let curv2 = 0;
  const list: { kx: number; ky: number; amp: number; omega: number; phase: number }[] = [];
  for (let i = 0; i < n; i++) {
    const lam = water.scale * Math.pow(0.22, i / Math.max(1, n - 1)) * (0.85 + 0.3 * random());
    const k = (2 * Math.PI) / lam;
    const angle = random() * Math.PI * 2;
    const amp = Math.pow(lam, 1.6) * (0.6 + 0.8 * random());
    // longer waves run faster, as on deep water
    const speed = water.speed * 0.1 * Math.sqrt(lam / 0.3);
    const turns = Math.max(1, Math.round((speed * k * L) / (2 * Math.PI)));
    list.push({ kx: Math.cos(angle) * k, ky: Math.sin(angle) * k, amp, omega: (2 * Math.PI * turns) / L, phase: random() * Math.PI * 2 });
    curv2 += (amp * k * k) ** 2 / 2;
  }
  // scale so the curvature, through the lens it makes, reaches `sharp` times the focus on average
  const kappa = water.depth * (1 - 1 / water.ior);
  const A = water.sharp / (kappa * Math.sqrt(curv2));
  list.forEach((w, i) => out.set([w.kx, w.ky, w.amp * A, w.omega, w.phase, 0, 0, 0], 8 * i));
  return { data: out, count: n };
};

const smooth01 = (x: number) => x * x * (3 - 2 * x);

const hex = (s: string) => {
  const v = parseInt(s.slice(1), 16);
  // sRGB to linear, roughly
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.pow(c / 255, 2.2));
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, update }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("this needs WebGPU");
  const device = await adapter.requestDevice({
    requiredLimits: {
      maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
      maxBufferSize: adapter.limits.maxBufferSize,
    },
  });
  device.addEventListener("uncapturederror", (e) => console.error("gpu:", (e as GPUUncapturedErrorEvent).error.message));
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const compile = (code: string, label: string) => {
    const module = device.createShaderModule({ code: uniStruct + commonCode + code, label });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) if (m.type === "error") console.error(`${label} wgsl ${m.lineNum}:${m.linePos} ${m.message}`);
    });
    return module;
  };

  const C = GPUShaderStage.COMPUTE;
  const uni = (visibility = C) => [
    { binding: 0, visibility, buffer: { type: "uniform" as const } },
    { binding: 1, visibility, buffer: { type: "uniform" as const } },
  ];
  const sb = (binding: number, type: GPUBufferBindingType) => ({ binding, visibility: C, buffer: { type } });
  const photonsLayout = device.createBindGroupLayout({
    entries: [...uni(), sb(2, "storage"), sb(3, "read-only-storage"), sb(4, "storage"), sb(5, "read-only-storage"), sb(6, "read-only-storage"), sb(7, "storage")],
  });
  const gridLayout = device.createBindGroupLayout({
    entries: [...uni(), sb(2, "read-only-storage"), sb(3, "read-only-storage"), sb(4, "storage"), sb(5, "read-only-storage"), sb(6, "storage"), sb(7, "storage")],
  });
  const imageLayout = device.createBindGroupLayout({
    entries: [
      ...uni(),
      sb(2, "read-only-storage"),
      { binding: 3, visibility: C, texture: { sampleType: "unfilterable-float" } },
      { binding: 4, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } },
      { binding: 5, visibility: C, texture: { sampleType: "unfilterable-float" } },
    ],
  });
  const F = GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX;
  const displayLayout = device.createBindGroupLayout({
    entries: [
      ...uni(F),
      { binding: 2, visibility: F, texture: { sampleType: "float" } },
      { binding: 3, visibility: F, texture: { sampleType: "float" } },
      { binding: 4, visibility: F, sampler: { type: "filtering" } },
      { binding: 5, visibility: F, texture: { sampleType: "float" } },
    ],
  });

  const photonsModule = compile(photonsCode, "photons");
  const gridModule = compile(gridCode, "grid");
  const imageModule = compile(imageCode, "image");
  const displayModule = compile(displayCode, "display");
  const pipe = (layout: GPUBindGroupLayout, module: GPUShaderModule, entryPoint: string) =>
    device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }), compute: { module, entryPoint } });
  const P = {
    leads: pipe(photonsLayout, photonsModule, "leads"),
    advance: pipe(photonsLayout, photonsModule, "advance"),
    fit: pipe(gridLayout, gridModule, "fit"),
    divergence: pipe(gridLayout, gridModule, "divergence"),
    pressure: pipe(gridLayout, gridModule, "pressure"),
    projectFit: pipe(gridLayout, gridModule, "projectFit"),
    stirAdvect: pipe(gridLayout, gridModule, "stirAdvect"),
    projectStir: pipe(gridLayout, gridModule, "projectStir"),
    resolve: pipe(imageLayout, imageModule, "resolve"),
    kdeH: pipe(imageLayout, imageModule, "kdeH"),
    kdeV: pipe(imageLayout, imageModule, "kdeV"),
    down4: pipe(imageLayout, imageModule, "down4"),
    glowH: pipe(imageLayout, imageModule, "glowH"),
    glowV: pipe(imageLayout, imageModule, "glowV"),
    bakeFloor: pipe(imageLayout, imageModule, "bakeFloor"),
  };
  const displayPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [displayLayout] }),
    vertex: { module: displayModule, entryPoint: "vs" },
    fragment: { module: displayModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const uniforms = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  const uIndex = Object.fromEntries(UNIFORMS.map((n, i) => [n, i])) as Record<UName, number>;
  const setU = (values: Partial<Record<UName, number>>) => {
    for (const k in values) uniforms[uIndex[k as UName]] = values[k as UName]!;
  };
  const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const waveBuffer = device.createBuffer({ size: 512, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let waveCount = 0;
  const writeWaves = () => {
    const w = makeWaves();
    waveCount = w.count;
    device.queue.writeBuffer(waveBuffer, 0, w.data);
  };
  writeWaves();
  const linear = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const uniEntries = [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: { buffer: waveBuffer } },
  ];
  const storage = (size: number) => device.createBuffer({ size: Math.max(16, size), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });

  // ---------- the photons and their grid, sized by the screen's shape ----------

  type World = {
    ax: number;
    margin: number;
    nx: number;
    ny: number;
    step: number;
    lx: number;
    ly: number;
    gx: number;
    gy: number;
    pos: GPUBuffer;
    leadT: GPUBuffer;
    acc: GPUBuffer;
    fit: GPUBuffer[];
    fitP: GPUBuffer[];
    field: GPUBuffer;
    stir: GPUBuffer[];
    stirP: GPUBuffer[];
    dv: GPUBuffer;
    groups: Record<string, GPUBindGroup>;
    ready: boolean[];
    /** where the drawings go, and the reach their targets were worked out for (the GPU must agree) */
    box: { x: number; y: number; size: number };
    reach: { inner: number; outer: number; far: number };
    destroy: () => void;
  };
  let world: World | undefined;
  let photonGroup: GPUBindGroup | undefined;
  let lightBuffer: GPUBuffer | undefined;

  const makeWorld = (ax: number): World => {
    const margin = 0.2;
    const Wd = 2 * (ax + margin);
    const Hd = 2 * (1 + margin);
    const N = photons.count;
    const step = Math.max(2, Math.round(Math.sqrt(N / 64000)));
    const lx = Math.max(2, Math.round(Math.sqrt((N * Wd) / Hd) / step));
    const ly = Math.max(2, Math.round(N / (lx * step) / step));
    const nx = lx * step;
    const ny = ly * step;
    const gx = 160;
    const gy = Math.max(8, Math.round((gx * Hd) / Wd));
    const cells = gx * gy;
    const fit = [storage(cells * 8), storage(cells * 8)];
    const fitP = [storage(cells * 4), storage(cells * 4)];
    const stir = [storage(cells * 8), storage(cells * 8)];
    const stirP = [storage(cells * 4), storage(cells * 4)];
    const field = storage(cells * 8);
    const dv = storage(cells * 4);
    const acc = storage(cells * 12);
    const pos = storage(nx * ny * 8);
    const leadT = storage(creatures.length * lx * ly * 8);
    const g = (uIn: GPUBuffer, uOut: GPUBuffer, pIn: GPUBuffer, pOut: GPUBuffer) =>
      device.createBindGroup({
        layout: gridLayout,
        entries: [
          ...uniEntries,
          { binding: 2, resource: { buffer: acc } },
          { binding: 3, resource: { buffer: uIn } },
          { binding: 4, resource: { buffer: uOut } },
          { binding: 5, resource: { buffer: pIn } },
          { binding: 6, resource: { buffer: pOut } },
          { binding: 7, resource: { buffer: dv } },
        ],
      });
    const groups = {
      fitA: g(fit[0], fit[1], fitP[0], fitP[1]),
      fitB: g(fit[1], fit[0], fitP[0], fitP[1]),
      presB: g(fit[0], fit[1], fitP[1], fitP[0]),
      projF: g(fit[0], field, fitP[0], fitP[1]),
      stirAdv: g(stir[0], stir[1], stirP[0], stirP[1]),
      stirA: g(stir[1], stir[0], stirP[0], stirP[1]),
      stirB: g(stir[1], stir[0], stirP[1], stirP[0]),
    };
    const all = [...fit, ...fitP, ...stir, ...stirP, field, dv, acc, pos, leadT];
    return {
      ax,
      margin,
      nx,
      ny,
      step,
      lx,
      ly,
      gx,
      gy,
      pos,
      leadT,
      acc,
      fit,
      fitP,
      field,
      stir,
      stirP,
      dv,
      groups,
      ready: creatures.map(() => false),
      box: { x: 0, y: 0.02, size: 1.62 * Math.min(1, ax) },
      reach: { inner: flow.inner, outer: flow.outer, far: flow.far },
      destroy: () => all.forEach((b) => b.destroy()),
    };
  };

  // ---------- where the leads go in each creature, worked out off the main thread ----------

  const workers = creatures.map(() => new Worker(new URL("./transport.worker.ts", import.meta.url), { type: "module" }));
  let version = 0;
  const transportMs: number[] = [];
  const requestTargets = (w: World) => {
    const ver = ++version;
    const src = new Float32Array(2 * w.lx * w.ly);
    const Wd = 2 * (w.ax + w.margin);
    const Hd = 2 * (1 + w.margin);
    const off = Math.floor(w.step / 2);
    for (let ly = 0; ly < w.ly; ly++)
      for (let lx = 0; lx < w.lx; lx++) {
        const i = ly * w.lx + lx;
        src[2 * i] = -w.ax - w.margin + ((lx * w.step + off + 0.5) / w.nx) * Wd;
        src[2 * i + 1] = -1 - w.margin + ((ly * w.step + off + 0.5) / w.ny) * Hd;
      }
    // the drawing fills most of the screen's height, or its width if that is less
    w.reach = { inner: flow.inner, outer: flow.outer, far: flow.far };
    w.ready.fill(false);
    workers.forEach((worker, c) => {
      worker.onmessage = (e: MessageEvent<TransportReply>) => {
        const r = e.data;
        if (r.ver !== version || world !== w) return;
        device.queue.writeBuffer(w.leadT, r.creature * w.lx * w.ly * 8, r.targets as Float32Array<ArrayBuffer>);
        w.ready[r.creature] = true;
        transportMs[r.creature] = r.ms;
      };
      const req: TransportRequest = { ver, creature: c, src: src.slice(), box: w.box, reach: w.reach, iters: 90 };
      worker.postMessage(req, [req.src.buffer]);
    });
  };

  // ---------- the light image, sized by the canvas ----------

  type Image = {
    W: number;
    H: number;
    canvasW: number;
    canvasH: number;
    textures: GPUTexture[];
    groups: GPUBindGroup[][];
    display: GPUBindGroup;
    /** writes the floor's mottle, once */
    floor: GPUBindGroup | undefined;
  };
  let image: Image | undefined;
  const dummyTex = device.createTexture({ size: [1, 1], format: "rgba16float", usage: GPUTextureUsage.TEXTURE_BINDING });
  const makeImage = (canvasW: number, canvasH: number): Image => {
    const W = Math.max(4, Math.round(canvasW * look.res));
    const H = Math.max(4, Math.round(canvasH * look.res));
    const tex = (w: number, h: number) =>
      device.createTexture({ size: [w, h], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    const raw = [tex(W, H), tex(W, H)];
    const tmp = tex(W, H);
    const lit = tex(W, H);
    const qw = Math.ceil(W / 4);
    const qh = Math.ceil(H / 4);
    const q1 = tex(qw, qh);
    const q2 = tex(qw, qh);
    const floorTex = tex(W, H);
    lightBuffer?.destroy();
    lightBuffer = storage(W * H * 12);
    const ig = (texIn: GPUTexture, texOut: GPUTexture, texPrev: GPUTexture) =>
      device.createBindGroup({
        layout: imageLayout,
        entries: [
          ...uniEntries,
          { binding: 2, resource: { buffer: lightBuffer! } },
          { binding: 3, resource: texIn.createView() },
          { binding: 4, resource: texOut.createView() },
          { binding: 5, resource: texPrev.createView() },
        ],
      });
    const chain = (f: number) => [ig(dummyTex, raw[f], raw[1 - f]), ig(raw[f], tmp, dummyTex), ig(tmp, lit, dummyTex), ig(lit, q1, dummyTex), ig(q1, q2, dummyTex), ig(q2, q1, dummyTex)];
    const display = device.createBindGroup({
      layout: displayLayout,
      entries: [...uniEntries, { binding: 2, resource: lit.createView() }, { binding: 3, resource: q1.createView() }, { binding: 4, resource: linear }, { binding: 5, resource: floorTex.createView() }],
    });
    return { W, H, canvasW, canvasH, textures: [...raw, tmp, lit, q1, q2, floorTex], groups: [chain(0), chain(1)], display, floor: ig(dummyTex, floorTex, dummyTex) };
  };

  let needReset = true;
  const ensure = (canvasW: number, canvasH: number) => {
    const ax = canvasW / canvasH;
    let changed = false;
    if (!world || Math.abs(world.ax - ax) > 1e-3 || world.nx * world.ny !== currentCount()) {
      world?.destroy();
      world = makeWorld(ax);
      requestTargets(world);
      needReset = true;
      changed = true;
    }
    if (!image || image.canvasW !== canvasW || image.canvasH !== canvasH || image.W !== Math.max(4, Math.round(canvasW * look.res))) {
      image?.textures.forEach((t) => t.destroy());
      image = makeImage(canvasW, canvasH);
      changed = true;
    }
    if (changed) {
      photonGroup = device.createBindGroup({
        layout: photonsLayout,
        entries: [
          ...uniEntries,
          { binding: 2, resource: { buffer: world.pos } },
          { binding: 3, resource: { buffer: world.leadT } },
          { binding: 4, resource: { buffer: world.acc } },
          { binding: 5, resource: { buffer: world.field } },
          { binding: 6, resource: { buffer: world.stir[0] } },
          { binding: 7, resource: { buffer: lightBuffer! } },
        ],
      });
    }
    return { world: world!, image: image! };
  };
  // the count the world was built for, so a change in the panel rebuilds it
  let builtCount = photons.count;
  const currentCount = () => {
    if (!world) return -1;
    return builtCount === photons.count ? world.nx * world.ny : -1;
  };

  // ---------- the choreography ----------

  type Phase = { k: number; cre: number; phase: number; s: number };
  const phaseAt = (t: number): Phase => {
    const c = cycle();
    const k = Math.floor(t / c);
    const n = creatures.length;
    const cre = ((k % n) + n) % n;
    let lt = t - k * c;
    if (lt < show.free) return { k, cre, phase: 0, s: 0 };
    lt -= show.free;
    if (lt < show.gather) return { k, cre, phase: 1, s: lt / show.gather };
    lt -= show.gather;
    if (lt < show.hold) return { k, cre, phase: 2, s: lt / show.hold };
    lt -= show.hold;
    return { k, cre, phase: 3, s: Math.min(1, lt / show.dissolve) };
  };
  let last: Phase = { k: -1, cre: 0, phase: 0, s: 0 };

  // ---------- the cursor ----------

  const mouse = { x: 0, y: 0, dx: 0, dy: 0, has: false };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const ax = r.width / r.height;
    const x = ((e.clientX - r.left) / r.width - 0.5) * 2 * ax;
    const y = (0.5 - (e.clientY - r.top) / r.height) * 2;
    if (mouse.has) {
      mouse.dx += x - mouse.x;
      mouse.dy += y - mouse.y;
    }
    mouse.x = x;
    mouse.y = y;
    mouse.has = true;
  };
  const onLeave = () => (mouse.has = false);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.style.touchAction = "none";

  // ---------- panel ----------

  const gui = new GUI({ title: "caustic" });
  gui.close();
  const fw = gui.addFolder("water");
  fw.add(water, "depth", 0.2, 3).onChange(writeWaves);
  fw.add(water, "sharp", 0.2, 3).onChange(writeWaves);
  fw.add(water, "scale", 0.1, 2).onChange(writeWaves);
  fw.add(water, "speed", 0, 3).onChange(writeWaves);
  fw.add(water, "waves", 1, 16, 1).onChange(writeWaves);
  fw.add(water, "seed", 0, 100, 1).onChange(writeWaves);
  fw.add(water, "dispersion", 0, 0.05);
  const fs = gui.addFolder("show");
  const retime = () => {
    writeWaves();
    update?.({ duration: loopLength() * 1000 });
  };
  for (const k of ["free", "gather", "hold", "dissolve"] as const) fs.add(show, k, 0.2, 10).onFinishChange(retime);
  const ff = gui.addFolder("flow");
  ff.add(flow, "liquid", 0, 1);
  ff.add(flow, "smooth", 0, 20);
  ff.add(flow, "tau", 0.3, 0.99);
  ff.add(flow, "turbGather", 0, 3);
  ff.add(flow, "turbDissolve", 0, 4);
  ff.add(flow, "turbScale", 0.3, 6);
  ff.add(flow, "turbSpeed", 0, 2);
  ff.add(flow, "shimmer", 0, 0.5);
  ff.add(flow, "keep", 0, 1);
  ff.add(flow, "rho", 0.05, 1);
  const regather = () => world && requestTargets(world);
  ff.add(flow, "inner", 0.2, 3).onFinishChange(regather);
  ff.add(flow, "outer", 0.3, 4).onFinishChange(regather);
  ff.add(flow, "far", 0, 1).onFinishChange(regather);
  ff.add(flow, "relax", 0.05, 3);
  ff.add(flow, "tear", 0.005, 0.3);
  const fstir = gui.addFolder("stir");
  fstir.add(stirring, "force", 0, 5);
  fstir.add(stirring, "radius", 0.03, 0.6);
  fstir.add(stirring, "fade", 0.1, 4);
  const fl = gui.addFolder("look");
  fl.add(look, "exposure", 0, 3);
  fl.add(look, "ambient", 0, 0.5);
  fl.add(look, "ema", 0.05, 1);
  fl.add(look, "blur", 0, 4);
  fl.add(look, "glow", 0, 1);
  fl.add(look, "glowSize", 1, 20);
  fl.addColor(look, "floor");
  fl.addColor(look, "tint");
  fl.add(look, "res", 0.25, 1);
  gui.add(photons, "count", [500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000]).onChange(() => (builtCount = -1));

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // ---------- a frame ----------

  let tPrev = 0;
  let frame = 0;
  const clock = { hold: undefined as number | undefined, seeking: false };

  const step = (t: number, dt: number) => {
    const { world: w, image: im } = ensure(canvas.width, canvas.height);
    if (builtCount !== photons.count) builtCount = photons.count;
    let cur = phaseAt(t);
    // a transition only begins at its start, with its targets ready, and carries on only if it was running
    const running = last.k === cur.k && last.phase >= 1;
    const live = cur.phase >= 1 && w.ready[cur.cre] && (running || (cur.phase === 1 && cur.s < 0.08));
    if (!live) cur = { ...cur, phase: 0, s: 0 };
    const sPrev = last.k === cur.k && last.phase === cur.phase ? last.s : 0;
    const transition = cur.phase === 1 || cur.phase === 3;

    const Wd = 2 * (w.ax + w.margin);
    const Hd = 2 * (1 + w.margin);
    const domainPx = ((Wd / (2 * w.ax)) * im.W) * ((Hd / 2) * im.H);
    const mu = (256 * (w.nx * w.ny)) / 3 / domainPx;
    const floor = hex(look.floor);
    const tint = hex(look.tint);
    const mv = dt > 0 && mouse.has ? [mouse.dx / dt, mouse.dy / dt] : [0, 0];
    const vmax = 6;
    const vm = Math.hypot(mv[0], mv[1]);
    if (vm > vmax) mv.forEach((_, i) => (mv[i] *= vmax / vm));
    // a held frame (dt 0) leaves the cursor's motion for the next real one
    if (dt > 0) mouse.dx = mouse.dy = 0;
    setU({
      ax: w.ax,
      margin: w.margin,
      nx: w.nx,
      ny: w.ny,
      lstep: w.step,
      lx: w.lx,
      ly: w.ly,
      creature: cur.cre,
      time: t,
      timePrev: t - dt,
      dt,
      phase: cur.phase,
      s: cur.phase === 1 || cur.phase === 3 ? cur.s : 0,
      sPrev,
      reset: needReset ? 1 : 0,
      depth: water.depth,
      ior: water.ior,
      dispersion: water.dispersion,
      waveCount,
      tau: flow.tau,
      relax: Math.exp(-dt / flow.relax),
      shimmer: flow.shimmer,
      keep: flow.keep,
      tear: flow.tear,
      gx: w.gx,
      gy: w.gy,
      smoothing: flow.smooth,
      liquid: flow.liquid,
      // turbulence swells in the middle of a transition and is gone at both ends
      turb: transition ? (cur.phase === 1 ? flow.turbGather : flow.turbDissolve) * Math.sin(Math.PI * Math.min(1, cur.s)) : 0,
      turbScale: flow.turbScale,
      turbSpeed: flow.turbSpeed,
      flux: 1 + (flow.rho - 1) * smooth01(cur.phase === 1 ? cur.s : cur.phase === 2 ? 1 : cur.phase === 3 ? 1 - cur.s : 0),
      boxX: w.box.x,
      boxY: w.box.y,
      boxSize: w.box.size,
      inner: w.reach.inner,
      outer: w.reach.outer,
      far: w.reach.far,
      stirDecay: Math.exp(-dt / stirring.fade),
      mouseX: mouse.x,
      mouseY: mouse.y,
      mouseVX: mv[0],
      mouseVY: mv[1],
      mouseR: stirring.radius,
      mouseForce: stirring.force * Math.min(1, dt * 30),
      W: im.W,
      H: im.H,
      norm: 1 / mu,
      ema: needReset ? 1 : look.ema,
      blur: look.blur,
      glowSigma: look.glowSize,
      exposure: look.exposure,
      ambient: look.ambient,
      glow: look.glow,
      floorR: floor[0],
      floorG: floor[1],
      floorB: floor[2],
      tintR: tint[0],
      tintG: tint[1],
      tintB: tint[2],
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    encoder.clearBuffer(lightBuffer!);
    if (transition) {
      encoder.clearBuffer(w.acc);
      if (sPrev === 0) {
        encoder.clearBuffer(w.fit[0]);
        encoder.clearBuffer(w.fitP[0]);
      }
    }
    if (needReset) for (const b of [...w.stir, ...w.stirP]) encoder.clearBuffer(b);
    const cp = encoder.beginComputePass();
    const gxs = Math.ceil(w.gx / 8);
    const gys = Math.ceil(w.gy / 8);
    const grid = (p: GPUComputePipeline, g: GPUBindGroup) => {
      cp.setPipeline(p);
      cp.setBindGroup(0, g);
      cp.dispatchWorkgroups(gxs, gys);
    };
    if (transition) {
      cp.setPipeline(P.leads);
      cp.setBindGroup(0, photonGroup!);
      cp.dispatchWorkgroups(Math.ceil((w.lx * w.ly) / 256));
      for (let k = 0; k < flow.fitIters; k++) grid(P.fit, k % 2 ? w.groups.fitB : w.groups.fitA);
      grid(P.divergence, w.groups.fitA);
      for (let k = 0; k < flow.pressureIters; k++) grid(P.pressure, k % 2 ? w.groups.presB : w.groups.fitA);
      grid(P.projectFit, w.groups.projF);
    }
    grid(P.stirAdvect, w.groups.stirAdv);
    grid(P.divergence, w.groups.stirA);
    for (let k = 0; k < 30; k++) grid(P.pressure, k % 2 ? w.groups.stirB : w.groups.stirA);
    grid(P.projectStir, w.groups.stirA);

    cp.setPipeline(P.advance);
    cp.setBindGroup(0, photonGroup!);
    cp.dispatchWorkgroups(Math.ceil((w.nx * w.ny) / 256));

    const chain = im.groups[frame & 1];
    const full = [Math.ceil(im.W / 8), Math.ceil(im.H / 8)] as const;
    const quarter = [Math.ceil(Math.ceil(im.W / 4) / 8), Math.ceil(Math.ceil(im.H / 4) / 8)] as const;
    const img = (p: GPUComputePipeline, g: GPUBindGroup, size: readonly [number, number]) => {
      cp.setPipeline(p);
      cp.setBindGroup(0, g);
      cp.dispatchWorkgroups(size[0], size[1]);
    };
    if (im.floor) {
      img(P.bakeFloor, im.floor, full);
      im.floor = undefined;
    }
    img(P.resolve, chain[0], full);
    img(P.kdeH, chain[1], full);
    img(P.kdeV, chain[2], full);
    img(P.down4, chain[3], quarter);
    img(P.glowH, chain[4], quarter);
    img(P.glowV, chain[5], quarter);
    cp.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    pass.setPipeline(displayPipeline);
    pass.setBindGroup(0, im.display);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);

    last = { ...cur, s: cur.phase === 1 || cur.phase === 3 ? cur.s : 0 };
    needReset = false;
    frame++;
  };

  const caustic = {
    water,
    show,
    flow,
    stirring,
    look,
    photons,
    clock,
    phaseAt,
    loopLength,
    writeWaves,
    get frame() {
      return frame;
    },
    get world() {
      return world && { nx: world.nx, ny: world.ny, step: world.step, lx: world.lx, ly: world.ly, gx: world.gx, gy: world.gy, ready: world.ready, transportMs };
    },
    get phase() {
      return last;
    },
    /** run the show from the start of t's creature up to t, at 60 steps a second, and hold there */
    seek: async (t: number) => {
      const c = cycle();
      const t0 = Math.floor(t / c) * c;
      clock.seeking = true;
      ensure(canvas.width, canvas.height);
      while (!world!.ready.every(Boolean)) await new Promise((r) => setTimeout(r, 50));
      needReset = true;
      last = { k: -1, cre: 0, phase: 0, s: 0 };
      const n = Math.round((t - t0) * 60);
      step(t0, 0);
      for (let k = 1; k <= n; k++) {
        step(t0 + (k / n) * (t - t0), (t - t0) / n);
        if (k % 30 === 0) await device.queue.onSubmittedWorkDone();
      }
      clock.hold = t;
      clock.seeking = false;
      tPrev = t;
      await device.queue.onSubmittedWorkDone();
    },
    stir: (x: number, y: number, dx: number, dy: number) => {
      mouse.x = x;
      mouse.y = y;
      mouse.dx += dx;
      mouse.dy += dy;
      mouse.has = true;
    },
    step,
    bench: async (frames = 30) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        step(tPrev, 0);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
  };
  (window as any).__caustic = caustic;

  const due = frameCap(60);
  wrap.render = ({ playhead, recording }) => {
    if (clock.seeking || (!recording && !due())) return;
    const L = loopLength();
    const t = clock.hold ?? playhead * L;
    let dt = t - tPrev;
    if (dt < 0) dt += L;
    // a stall (a hidden tab) doesn't make one giant step
    if (dt > 0.1) dt = 1 / 60;
    step(t, clock.hold !== undefined ? 0 : dt);
    tPrev = t;
    stats.update();
  };

  wrap.resize = () => {};

  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    workers.forEach((w) => w.terminate());
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: loopLength() * 1000,
  // no playFps: ssam's drops frames (see cap.ts), so the render caps itself at 60
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
