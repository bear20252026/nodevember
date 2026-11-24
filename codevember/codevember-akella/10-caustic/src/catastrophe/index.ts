/**
 * Catastrophe: light at the wave scale, where rays cross. Geometrical optics puts infinite brightness on a
 * caustic; waves dress it in fringes. Near a fold, a cusp, a swallowtail, a butterfly, the field is one of a
 * few universal integrals (Berry & Upstill, "Catastrophe optics", 1980):
 *
 *   psi(a) = integral of exp(i (t^n + a4 t^4 + a3 t^3 + a2 t^2 + a1 t)) dt,   n = 4, 5, 6
 *
 * Every pixel here is one of those integrals, worked out live on the GPU (integral.wgsl). The screen is a
 * slice through the control space (a1..a4), and the slice drifts, turns and bends with time, so cusps are
 * born, run into each other and annihilate. The cursor moves the slice through the higher parameters.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import displayCode from "./display.wgsl?raw";
import integralCode from "./integral.wgsl?raw";
import netCode from "./net.wgsl?raw";

const DURATION = 48_000;

type Mode = "organism" | "pearcey" | "swallowtail" | "butterfly" | "net";
const view = {
  mode: "organism" as Mode,
  /** control-space units per half screen height */
  zoom: 1,
  /** multiplies each mode's wavenumber: more, finer fringes (and a slower integral) */
  fringes: 1,
  /** field texels per css pixel; the fringes are many pixels wide, so the field is upsampled */
  res: 0.5,
  exposure: 1.7,
  gamma: 1.25,
  vignette: 0.6,
  dark: "#0b1a2a",
  light: "#fff4e6",
  cost: false,
};
const motion = {
  /** how far the slice wanders through the higher parameters */
  wander: 1,
  /** how much the slice curves (the highest parameter grows with distance from the middle) */
  bend: 1,
  /** how far the cursor pushes the parameters */
  reach: 1,
  turn: 1,
};
/** the "net" mode: Fresnel diffraction of a random phase screen, by FFT */
const net = {
  /** wavenumber: how many fringes each fold wears */
  k: 9000,
  /** depth of the screen's bumps, in units where its curvature is 1 */
  amp: 1,
  /** how far the light travels past the screen; near 1 it is in focus and the net is sharpest */
  z: 1,
  /** how much of the unit domain the screen height shows */
  window: 1,
  waves: 48,
  seed: 7,
};
const NET_N = 1024;

/** plane waves on the FFT's lattice, each turning a whole number of times per loop, scaled to rms curvature 1 */
const netWaves = () => {
  let seed = net.seed * 7919 + 1;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  const count = Math.min(64, net.waves);
  const data = new Float32Array(64 * 8);
  let curv2 = 0;
  const list: number[][] = [];
  for (let i = 0; i < count; i++) {
    let nx = 0;
    let ny = 0;
    let len = 0;
    while (len < 2.5 || len > 8) {
      nx = Math.round((random() * 2 - 1) * 8);
      ny = Math.round((random() * 2 - 1) * 8);
      len = Math.hypot(nx, ny);
    }
    const amp = Math.pow(len, -2.2) * (0.5 + random());
    const turns = [-2, -1, 1, 2][Math.floor(random() * 4)];
    list.push([nx, ny, amp, turns, random() * Math.PI * 2]);
    curv2 += (amp * (2 * Math.PI * len) ** 2) ** 2 / 2;
  }
  const norm = 1 / Math.sqrt(curv2);
  list.forEach((w, i) => data.set([w[0], w[1], w[2] * norm, w[3], w[4], 0, 0, 0], 8 * i));
  return { data, count };
};

const quad = { rad: 3, cap: 0.45, stop: 12, grow: 0.6, alphaF: 0.85, maxEvals: 4000 };

const UNIFORMS = [
  "ax",
  "scale",
  "lam",
  "n",
  "W",
  "H",
  "c1",
  "c2",
  "c3",
  "c4",
  "u1",
  "u2",
  "u3",
  "u4",
  "v1",
  "v2",
  "v3",
  "v4",
  "b1",
  "b2",
  "b3",
  "b4",
  "wa1",
  "wa2",
  "wa3",
  "wa4",
  "wakx",
  "waky",
  "waph",
  "wb1",
  "wb2",
  "wb3",
  "wb4",
  "wbkx",
  "wbky",
  "wbph",
  "rad",
  "cap",
  "stop",
  "grow",
  "alphaF",
  "maxEvals",
  "showCost",
  "netN",
  "netK",
  "netAmp",
  "netZ",
  "netWaves",
  "playhead",
  "exposure",
  "gamma",
  "vignette",
  "darkR",
  "darkG",
  "darkB",
  "lightR",
  "lightG",
  "lightB",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

const hex = (s: string) => {
  const v = parseInt(s.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => c / 255);
};
type V4 = [number, number, number, number];
const norm = (v: V4): V4 => {
  const l = Math.hypot(...v) || 1;
  return v.map((x) => x / l) as V4;
};

/** the slice at loop phase th (radians), with the cursor's push m in [-1, 1]^2 */
/** a slice set by hand (from the panel or a tool) instead of the modes' own */
/** a travelling sine warp of the slice: amplitude in each parameter, wave vector on screen, phase */
type Warp = { a: V4; k: [number, number]; ph: number };
const still: Warp = { a: [0, 0, 0, 0], k: [0, 0], ph: 0 };
type Slice = { n: number; scale: number; lam: number; c: V4; u: V4; v: V4; b: V4; wa?: Warp; wb?: Warp };

const explore = { on: false, n: 6, scale: 1, lam: 2, c: [0, 0, 0, -1] as V4, u: [0.4, 0, 0, 0] as V4, v: [0, 1, 0, 0] as V4, b: [0, 0, 0, 0] as V4 };

/**
 * The slice at loop phase th (radians), with the cursor's push m in [-1, 1]^2, in shape units: the screen
 * point p (2 high) goes to c + p.x u + p.y v + |p|^2 b, and the shader scales a_k by lam^(n-k).
 */
const slice = (mode: Mode, th: number, m: [number, number]): Slice => {
  const W = motion.wander;
  const R = motion.reach;
  const T = motion.turn;
  if (explore.on) return { ...explore };
  switch (mode) {
    case "pearcey": {
      // the cusp, its point up, breathing slowly
      const a = 0.12 * T * Math.sin(th);
      return {
        n: 4,
        scale: 1,
        lam: 3.2,
        c: [m[0] * 0.3 * R, -0.55 + m[1] * 0.25 * R, 0, 0] as V4,
        u: [0.55 * Math.cos(a), 0.55 * Math.sin(a), 0, 0] as V4,
        v: [-0.9 * Math.sin(a), 0.9 * Math.cos(a), 0, 0] as V4,
        b: [0, 0, 0, 0] as V4,
      };
    }
    case "swallowtail":
      // z runs from the swallowtail's pocket out through the point where its two cusps die
      return {
        n: 5,
        scale: 1,
        lam: 2.6,
        c: [0.2, m[1] * 0.2 * R, -0.6 + 0.75 * W * Math.sin(th) + m[0] * 0.6 * R, 0] as V4,
        u: [0.4, 0, 0, 0] as V4,
        v: [0, 0.75, 0, 0] as V4,
        b: [0, 0, 0, 0] as V4,
      };
    case "butterfly":
      return {
        n: 6,
        scale: 1,
        lam: 2.4,
        c: [0, 0.2, 0.2 * W * Math.sin(2 * th) + m[1] * 0.3 * R, -1.1 + 0.6 * W * Math.sin(th) + m[0] * 0.6 * R] as V4,
        u: [0.32, 0, 0, 0] as V4,
        v: [0, 0.65, 0, 0] as V4,
        b: [0, 0, 0, 0] as V4,
      };
    case "net":
      // only the scale is used: the window on the screen's periodic domain
      return { n: 6, scale: net.window, lam: 1, c: [0, 0, 0, 0] as V4, u: [0, 0, 0, 0] as V4, v: [0, 0, 0, 0] as V4, b: [0, 0, 0, 0] as V4 };
    default: {
      // a butterfly slice that drifts through all four parameters, turns, bends and ripples: the middle sits
      // deep in the butterfly's pocket, the rim shallower, and two slow waves cut other sections across it
      const a = th;
      const r = 0.22 * T * Math.sin(a);
      const u = norm([Math.cos(r), Math.sin(r), 0.25 * T * Math.sin(2 * a + 0.5), 0.12 * T * Math.cos(a)]);
      const v = norm([-Math.sin(r), Math.cos(r), 0.2 * T * Math.cos(a + 0.9), 0.15 * T * Math.sin(a + 0.3)]);
      return {
        n: 6,
        scale: 1.1,
        lam: 2.75,
        c: [0.05 * W * Math.sin(a + 0.4), 0.22 + 0.15 * W * Math.sin(2 * a + 1.3), 0.15 * W * Math.sin(a + 2.1) + m[1] * 0.55 * R, -1.15 + 0.45 * W * Math.sin(a) + m[0] * 0.95 * R] as V4,
        u: u.map((x) => x * 0.32) as V4,
        v: v.map((x) => x * 0.62) as V4,
        b: [0, 0.02 * motion.bend * Math.sin(a + 0.8), 0, 0.08 * motion.bend] as V4,
        wa: { a: [0.05 * W, 0.06 * W, 0.3 * W, 0.25 * W], k: [1.4, 0.6], ph: 2 * a },
        wb: { a: [0.04 * W, 0.1 * W, 0.2 * W, -0.3 * W], k: [-0.5, 1.7], ph: -a + 1 },
      };
    }
  }
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("this needs WebGPU");
  const device = await adapter.requestDevice();
  device.addEventListener("uncapturederror", (e) => console.error("gpu:", (e as GPUUncapturedErrorEvent).error.message));
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const compile = (code: string, label: string) => {
    const module = device.createShaderModule({ code: uniStruct + code, label });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) if (m.type === "error") console.error(`${label} wgsl ${m.lineNum}:${m.linePos} ${m.message}`);
    });
    return module;
  };

  const integralLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: "write-only", format: "rg32float" } },
    ],
  });
  const FS = GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX;
  const displayLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: FS, buffer: { type: "uniform" } },
      { binding: 1, visibility: FS, texture: { sampleType: "unfilterable-float" } },
    ],
  });
  const integralModule = compile(integralCode, "integral");
  const C = GPUShaderStage.COMPUTE;
  const netLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, storageTexture: { access: "write-only", format: "rg32float" } },
      { binding: 2, visibility: C, buffer: { type: "uniform" } },
      { binding: 3, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 4, visibility: C, buffer: { type: "storage" } },
      { binding: 5, visibility: C, buffer: { type: "read-only-storage" } },
    ],
  });
  const netModule = compile(netCode, "net");
  const netPipe = (entryPoint: string) => device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [netLayout] }), compute: { module: netModule, entryPoint } });
  const NP = { screen: netPipe("screen"), fft: netPipe("fft"), propagate: netPipe("propagate"), toField: netPipe("toField") };
  const netBuf = [0, 1].map(() => device.createBuffer({ size: NET_N * NET_N * 8, usage: GPUBufferUsage.STORAGE }));
  const waveBuf = device.createBuffer({ size: 64 * 8 * 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  let netWaveCount = 0;
  const writeNetWaves = () => {
    const w = netWaves();
    netWaveCount = w.count;
    device.queue.writeBuffer(waveBuf, 0, w.data);
  };
  writeNetWaves();
  const STAGES = Math.log2(NET_N);
  // one small uniform per pass: (stage, axis, inverse)
  const passParams = (stage: number, axis: number, inverse: number) => {
    const b = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM, mappedAtCreation: true });
    new Uint32Array(b.getMappedRange()).set([stage, axis, inverse, 0]);
    b.unmap();
    return b;
  };
  const fftPasses = (inverse: number) => {
    const out: GPUBuffer[] = [];
    for (const axis of [0, 1]) for (let st = 0; st < STAGES; st++) out.push(passParams(st, axis, inverse));
    return out;
  };
  const fwdParams = fftPasses(0);
  const invParams = fftPasses(1);
  const noParams = passParams(0, 0, 0);
  const displayModule = compile(displayCode, "display");
  const integratePipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [integralLayout] }),
    compute: { module: integralModule, entryPoint: "integrate" },
  });
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

  type Target = {
    W: number;
    H: number;
    cw: number;
    ch: number;
    tex: GPUTexture;
    ig: GPUBindGroup;
    dg: GPUBindGroup;
    net: { screen: GPUBindGroup; fwd: GPUBindGroup[]; propagate: GPUBindGroup; inv: GPUBindGroup[]; toField: GPUBindGroup };
  };
  let target: Target | undefined;
  const ensure = () => {
    const cw = canvas.width;
    const ch = canvas.height;
    // sized by css pixels: a retina screen shows the same fringes, so it needn't integrate four times as many
    const dpr = cw / Math.max(1, canvas.clientWidth || cw);
    const W = Math.max(8, Math.round((cw / dpr) * view.res));
    const H = Math.max(8, Math.round((ch / dpr) * view.res));
    if (target && target.W === W && target.H === H && target.cw === cw && target.ch === ch) return target;
    target?.tex.destroy();
    const tex = device.createTexture({
      size: [W, H],
      format: "rg32float",
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
    });
    const ig = device.createBindGroup({
      layout: integralLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: tex.createView() },
      ],
    });
    const dg = device.createBindGroup({
      layout: displayLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: tex.createView() },
      ],
    });
    const ng = (params: GPUBuffer, from: GPUBuffer, to: GPUBuffer) =>
      device.createBindGroup({
        layout: netLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: tex.createView() },
          { binding: 2, resource: { buffer: params } },
          { binding: 3, resource: { buffer: from } },
          { binding: 4, resource: { buffer: to } },
          { binding: 5, resource: { buffer: waveBuf } },
        ],
      });
    const [A, B] = netBuf;
    // screen -> A; forward passes ping-pong from A (an even count, so back in A); propagate A -> B;
    // inverse passes from B (back in B); B -> the field
    const netGroups = {
      screen: ng(noParams, B, A),
      fwd: fwdParams.map((p, i) => (i % 2 ? ng(p, B, A) : ng(p, A, B))),
      propagate: ng(noParams, A, B),
      inv: invParams.map((p, i) => (i % 2 ? ng(p, A, B) : ng(p, B, A))),
      toField: ng(noParams, B, A),
    };
    target = { W, H, cw, ch, tex, ig, dg, net: netGroups };
    return target;
  };

  // ---------- the cursor: where it rests pushes the parameters, eased ----------

  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = 1 - ((e.clientY - r.top) / r.height) * 2;
  };
  const onLeave = () => {
    mouse.x = 0;
    mouse.y = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view.zoom = Math.min(4, Math.max(0.25, view.zoom * Math.exp(-e.deltaY * 0.001)));
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.style.touchAction = "none";

  // ---------- panel ----------

  const gui = new GUI({ title: "catastrophe" });
  gui.close();
  gui.add(view, "mode", ["organism", "pearcey", "swallowtail", "butterfly", "net"]);
  gui.add(view, "zoom", 0.25, 4);
  gui.add(view, "fringes", 0.3, 2.5);
  gui.add(view, "res", 0.2, 1);
  gui.add(view, "exposure", 0.1, 8);
  gui.add(view, "gamma", 0.2, 1.5);
  gui.add(view, "vignette", 0, 1);
  gui.addColor(view, "dark");
  gui.addColor(view, "light");
  gui.add(view, "cost");
  const fm = gui.addFolder("motion");
  fm.add(motion, "wander", 0, 2);
  fm.add(motion, "bend", 0, 3);
  fm.add(motion, "reach", 0, 2);
  fm.add(motion, "turn", 0, 2);
  const fn = gui.addFolder("net");
  fn.add(net, "k", 1000, 30000);
  fn.add(net, "amp", 0.2, 3);
  fn.add(net, "z", 0.1, 3);
  fn.add(net, "window", 0.2, 2);
  fn.add(net, "waves", 4, 64, 1).onChange(() => writeNetWaves());
  fn.add(net, "seed", 0, 100, 1).onChange(() => writeNetWaves());
  fn.close();
  const fq = gui.addFolder("quadrature");
  fq.add(quad, "rad", 0.5, 4);
  fq.add(quad, "cap", 0.05, 1);
  fq.add(quad, "stop", 6, 40);
  fq.add(quad, "grow", 0, 2);
  fq.add(quad, "alphaF", 0.3, 0.98);
  fq.add(quad, "maxEvals", 100, 20000, 100);
  fq.close();

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // ---------- a frame ----------

  let frame = 0;
  const clock = { hold: undefined as number | undefined };
  let lastTh = 0;

  const draw = (playhead: number) => {
    const t = ensure();
    const th = 2 * Math.PI * playhead;
    lastTh = th;
    mouse.sx += (mouse.x - mouse.sx) * 0.06;
    mouse.sy += (mouse.y - mouse.sy) * 0.06;
    const s = slice(view.mode, th, [mouse.sx, mouse.sy]);
    const wa = s.wa ?? still;
    const wb = s.wb ?? still;
    const dark = hex(view.dark);
    const light = hex(view.light);
    setU({
      ax: t.cw / t.ch,
      scale: s.scale / view.zoom,
      lam: s.lam * view.fringes,
      n: s.n,
      W: t.W,
      H: t.H,
      c1: s.c[0],
      c2: s.c[1],
      c3: s.c[2],
      c4: s.c[3],
      u1: s.u[0],
      u2: s.u[1],
      u3: s.u[2],
      u4: s.u[3],
      v1: s.v[0],
      v2: s.v[1],
      v3: s.v[2],
      v4: s.v[3],
      b1: s.b[0],
      b2: s.b[1],
      b3: s.b[2],
      b4: s.b[3],
      wa1: wa.a[0],
      wa2: wa.a[1],
      wa3: wa.a[2],
      wa4: wa.a[3],
      wakx: wa.k[0],
      waky: wa.k[1],
      waph: wa.ph,
      wb1: wb.a[0],
      wb2: wb.a[1],
      wb3: wb.a[2],
      wb4: wb.a[3],
      wbkx: wb.k[0],
      wbky: wb.k[1],
      wbph: wb.ph,
      rad: quad.rad,
      cap: quad.cap,
      stop: quad.stop,
      grow: quad.grow,
      alphaF: quad.alphaF,
      maxEvals: quad.maxEvals,
      showCost: view.cost ? 1 : 0,
      netN: NET_N,
      netK: net.k,
      // the cursor deepens the bumps (more folds) and moves the focus; time breathes the focus
      netAmp: net.amp * (1 + 0.35 * motion.reach * mouse.sx),
      netZ: net.z * (1 + 0.3 * motion.wander * Math.sin(th) + 0.4 * motion.reach * mouse.sy),
      netWaves: netWaveCount,
      playhead,
      exposure: view.exposure,
      gamma: view.gamma,
      vignette: view.vignette,
      darkR: dark[0],
      darkG: dark[1],
      darkB: dark[2],
      lightR: light[0],
      lightG: light[1],
      lightB: light[2],
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    const encoder = device.createCommandEncoder();
    const cp = encoder.beginComputePass();
    if (view.mode === "net") {
      const run = (p: GPUComputePipeline, g: GPUBindGroup, x: number, y: number) => {
        cp.setPipeline(p);
        cp.setBindGroup(0, g);
        cp.dispatchWorkgroups(x, y);
      };
      run(NP.screen, t.net.screen, NET_N / 16, NET_N / 16);
      for (const g of t.net.fwd) run(NP.fft, g, NET_N / 2 / 256, NET_N);
      run(NP.propagate, t.net.propagate, NET_N / 16, NET_N / 16);
      for (const g of t.net.inv) run(NP.fft, g, NET_N / 2 / 256, NET_N);
      run(NP.toField, t.net.toField, Math.ceil(t.W / 8), Math.ceil(t.H / 8));
    } else {
      cp.setPipeline(integratePipeline);
      cp.setBindGroup(0, t.ig);
      cp.dispatchWorkgroups(Math.ceil(t.W / 8), Math.ceil(t.H / 8));
    }
    cp.end();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    pass.setPipeline(displayPipeline);
    pass.setBindGroup(0, t.dg);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    frame++;
  };

  /** the field as last computed: W x H pairs of (re, im) */
  const readField = async () => {
    const t = ensure();
    const bpr = Math.ceil((t.W * 8) / 256) * 256;
    const buf = device.createBuffer({ size: bpr * t.H, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: t.tex }, { buffer: buf, bytesPerRow: bpr }, [t.W, t.H]);
    device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const raw = new Float32Array(buf.getMappedRange().slice(0));
    buf.destroy();
    const out = new Float32Array(t.W * t.H * 2);
    for (let y = 0; y < t.H; y++) out.set(raw.subarray((y * bpr) / 4, (y * bpr) / 4 + t.W * 2), y * t.W * 2);
    return { W: t.W, H: t.H, data: Array.from(out) };
  };

  const api = {
    view,
    explore,
    net,
    writeNetWaves: () => writeNetWaves(),
    motion,
    quad,
    clock,
    slice: () => slice(view.mode, lastTh, [mouse.sx, mouse.sy]),
    setMouse: (x: number, y: number, settle = true) => {
      mouse.x = x;
      mouse.y = y;
      if (settle) {
        mouse.sx = x;
        mouse.sy = y;
      }
    },
    readField,
    get frame() {
      return frame;
    },
    bench: async (frames = 20) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        draw(clock.hold ?? 0);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
  };
  (window as any).__catastrophe = api;

  const due = frameCap(60);
  wrap.render = ({ playhead, recording }) => {
    if (!recording && !due()) return;
    draw(clock.hold ?? playhead);
    stats.update();
  };

  wrap.resize = () => {};

  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
    canvas.removeEventListener("wheel", onWheel);
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: DURATION,
  // no playFps: ssam's drops frames (see cap.ts), so the render caps itself at 60
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
