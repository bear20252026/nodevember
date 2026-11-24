/**
 * Vessel: a vase of glass threads, grown. A physarum web (agents that follow and lay down trail) grows on
 * the vessel's unrolled skin, fed, if you like, by a caustic traced onto the same skin, so the slime grows
 * along lines of focused light. Every frame the web's ridges become seeds, a jump flood gives each texel
 * its nearest strand, and that is the glass: round strands wrapped round the outline in nested skins, with
 * thorns from the strongest knots, a spiked crown and a frayed hem. Ray marched, with a cyan glow inside.
 *
 * Press W (or the panel) for the web lab: the sheets laid flat.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import commonCode from "./common.wgsl?raw";
import compositeCode from "./composite.wgsl?raw";
import jfaCode from "./jfa.wgsl?raw";
import marchCode from "./march.wgsl?raw";
import postCode from "./post.wgsl?raw";
import spritesCode from "./sprites.wgsl?raw";
import webCode from "./web.wgsl?raw";

const MODES = { physarum: 0, caustic: 1, fed: 2, foam: 3 } as const;
type Mode = keyof typeof MODES;

const sheet = { W: 1280, Rmax: 0.5, Hlen: 1.75, maxLayers: 3 };
// texels square at the belly
const H = Math.round(sheet.Hlen / ((2 * Math.PI * sheet.Rmax) / sheet.W));
const foam = { cells: 20, warp: 0.25, fine: 0.18, peak: 7 };
const web = { mode: "foam" as Mode, food: 0.8, rim: 2, SA: 60, RA: 30, SD: 6, SS: 0.8, deposit: 5, decay: 0.15, steps: 2, density: 0.5 };
const caustic = { depth: 70, focus: 1.5, drift: 0.04 };
const glass = { layers: 2, shrink: 0.82, thr: 1.6, rMin: 0.0014, rK: 0.0011, nodeThr: 9, thornLen: 0.035, tendril: 0.32, crown: 0.45, hem: 0.3, thorns: 0.3 };
const look = { exposure: 1, bloom: 0.8, core: 1.4, coreSize: 0.28, coreY: 0.42, alpha: 0.55, halo: 1, snow: 0.35, stars: 1, starSize: 22, scale: 1, budget: 0.75e6, taa: true, taaBlend: 0.1, taaClip: 1.25 };
const view = { lab: false, hold: false, spin: 0.014, distance: 3.9, fov: 34, pitch: 4, y0: -0.92 };
const MAX_KNOTS = 4096;
/** profiling: skip 1 caustic food, 2 growth, 4 strands, 8 knots, 16 march, 32 bloom */
const dbg = { skip: 0 };

const UNIFORMS = [
  "time",
  "frame",
  "W",
  "H",
  "layers",
  "nAgents",
  "SA",
  "RA",
  "SD",
  "SS",
  "deposit",
  "decay",
  "foodW",
  "cells",
  "warp",
  "fine",
  "webPeak",
  "crown",
  "hem",
  "thorns",
  "rim",
  "trailMean",
  "mode",
  "cDepth",
  "cBend",
  "drift",
  "thr",
  "nodeThr",
  "rMin",
  "rK",
  "Rmax",
  "Hlen",
  "y0",
  "shrink",
  "thornLen",
  "tendril",
  "rot",
  "camX",
  "camY",
  "camZ",
  "fX",
  "fY",
  "fZ",
  "rX",
  "rY",
  "rZ",
  "uX",
  "uY",
  "uZ",
  "tanFov",
  "aspect",
  "rW",
  "rH",
  "pix",
  "exposure",
  "bloom",
  "coreI",
  "coreSize",
  "coreY",
  "alpha",
  "halo",
  "viewMode",
  "snow",
  "stars",
  "starSize",
  "focus",
  "jx",
  "jy",
  "taaAlpha",
  "taaClip",
  "dRot",
  "pcX",
  "pcY",
  "pcZ",
  "pfX",
  "pfY",
  "pfZ",
  "prX",
  "prY",
  "prZ",
  "puX",
  "puY",
  "puZ",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

// the light the web feeds on: ripples with whole numbers of waves round the vessel, so it wraps
const rippleCode = (() => {
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const lines: string[] = [];
  for (let k = 0; k < 9; k++) {
    const lambda = 45 + 75 * rnd();
    const dir = k * 2.399963 + rnd();
    const m = Math.round((sheet.W * Math.cos(dir)) / lambda);
    const kx = (2 * Math.PI * m) / sheet.W;
    const ky = ((2 * Math.PI) / lambda) * Math.sin(dir);
    const a = 1 / (kx * kx + ky * ky);
    const w = 0.6 + rnd();
    const phi = rnd() * 6.283;
    lines.push(`  ph = ${kx.toFixed(6)} * p.x + ${ky.toFixed(6)} * p.y - ${w.toFixed(4)} * U.time * U.drift + ${phi.toFixed(4)} + L * ${(1.3 + 0.7 * k).toFixed(3)};`);
    lines.push(`  g += ${a.toFixed(4)} * cos(ph) * vec2f(${kx.toFixed(6)}, ${ky.toFixed(6)});`);
  }
  return `
/** the slope of the ripples over the sheet, in texels, times how sharply they bend */
fn ripples(p: vec2f, L: f32) -> vec2f {
  var g = vec2f(0.0);
  var ph = 0.0;
${lines.join("\n")}
  return g * U.cBend;
}
`;
})();

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("this needs WebGPU");
  const device = await adapter.requestDevice({
    requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize, maxStorageBuffersPerShaderStage: 8 },
  });
  device.addEventListener("uncapturederror", (e) => console.error("gpu:", (e as GPUUncapturedErrorEvent).error.message));
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const compile = (label: string, ...parts: string[]) => {
    const module = device.createShaderModule({ code: uniStruct + commonCode + parts.join("\n"), label });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) if (m.type === "error") console.error(`${label} wgsl ${m.lineNum}:${m.linePos} ${m.message}`);
    });
    return module;
  };

  // ---------------------------------------------------------------- layouts
  type K = "uniform" | "storage" | "read" | "tex" | "sampler" | "wtex";
  const entry = (binding: number, k: K, visibility: number): GPUBindGroupLayoutEntry => {
    if (k === "uniform") return { binding, visibility, buffer: { type: "uniform" } };
    if (k === "storage") return { binding, visibility, buffer: { type: "storage" } };
    if (k === "read") return { binding, visibility, buffer: { type: "read-only-storage" } };
    if (k === "tex") return { binding, visibility, texture: { sampleType: "float" } };
    if (k === "sampler") return { binding, visibility, sampler: { type: "filtering" } };
    return { binding, visibility, storageTexture: { access: "write-only", format: "rgba16float" } };
  };
  const mkLayout = (visibility: number, kinds: K[]) => device.createBindGroupLayout({ entries: kinds.map((k, i) => entry(i, k, visibility)) });
  const C = GPUShaderStage.COMPUTE;
  const F = GPUShaderStage.FRAGMENT;
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const webL = mkLayout(C, ["uniform", "storage", "storage", "storage", "storage", "storage", "storage", "storage"]);
  const jfaL = mkLayout(C, ["uniform", "storage", "storage", "storage", "storage", "storage", "storage", "uniform", "storage"]);
  const marchL = mkLayout(F, ["uniform", "read", "read"]);
  const downL = mkLayout(C, ["uniform", "tex", "sampler", "wtex"]);
  const taaL = mkLayout(C, ["uniform", "tex", "sampler", "wtex", "tex"]);
  const compL = mkLayout(F, ["uniform", "tex", "sampler", "tex", "tex", "tex", "tex", "tex", "read", "read", "read"]);
  const sprL = mkLayout(VF, ["uniform", "read", "read"]);
  const pl = (l: GPUBindGroupLayout) => device.createPipelineLayout({ bindGroupLayouts: [l] });

  // ---------------------------------------------------------------- pipelines
  const webModule = compile("web", rippleCode, webCode);
  const cp = (layout: GPUBindGroupLayout, module: GPUShaderModule, entryPoint: string) => device.createComputePipeline({ layout: pl(layout), compute: { module, entryPoint } });
  const movePipe = cp(webL, webModule, "crawl");
  const diffusePipe = cp(webL, webModule, "diffuse");
  const shinePipe = cp(webL, webModule, "shine");
  const resolvePipe = cp(webL, webModule, "resolve");
  const foamPipe = cp(webL, webModule, "foam");
  const jfaModule = compile("jfa", jfaCode);
  const seedStrandsPipe = cp(jfaL, jfaModule, "seedStrands");
  const seedKnotsPipe = cp(jfaL, jfaModule, "seedKnots");
  const floodPipe = cp(jfaL, jfaModule, "flood");
  const blockMaxPipe = cp(jfaL, jfaModule, "blockMax");
  const floodKnotsPipe = cp(jfaL, jfaModule, "floodKnots");
  const softenPipe = cp(jfaL, jfaModule, "soften");
  const postModule = compile("post", postCode);
  const downPipe = cp(downL, postModule, "down");
  const taaPipe = cp(taaL, postModule, "taa");
  const marchModule = compile("march", marchCode);
  const marchPipe = device.createRenderPipeline({
    layout: pl(marchL),
    vertex: { module: marchModule, entryPoint: "vs" },
    fragment: { module: marchModule, entryPoint: "fs", targets: [{ format: "rgba16float" }] },
  });
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
  const sprModule = compile("sprites", spritesCode);
  const spritePipe = (vs: string, fs: string) =>
    device.createRenderPipeline({
      layout: pl(sprL),
      vertex: { module: sprModule, entryPoint: vs },
      fragment: { module: sprModule, entryPoint: fs, targets: [{ format: "rgba16float", blend: add }] },
      primitive: { topology: "triangle-strip" },
    });
  const snowPipe = spritePipe("vsSnow", "fsSnow");
  const starPipe = spritePipe("vsStar", "fsStar");
  const compModule = compile("composite", compositeCode);
  const compPipe = device.createRenderPipeline({
    layout: pl(compL),
    vertex: { module: compModule, entryPoint: "vs" },
    fragment: { module: compModule, entryPoint: "fs", targets: [{ format }] },
  });

  // ---------------------------------------------------------------- buffers
  const SB = GPUBufferUsage.STORAGE;
  const CD = GPUBufferUsage.COPY_DST;
  const W = sheet.W;
  const N = W * H * sheet.maxLayers;
  const uniforms = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | CD });
  const setU = (v: Partial<Record<UName, number>>) => {
    for (const [k, x] of Object.entries(v)) uniforms[UNIFORMS.indexOf(k as UName)] = x!;
  };
  const maxAgents = Math.ceil(0.8 * W * H * sheet.maxLayers);
  const agentBuf = device.createBuffer({ size: maxAgents * 16, usage: SB | CD });
  const depBuf = device.createBuffer({ size: N * 4, usage: SB | CD });
  const trailA = device.createBuffer({ size: N * 4, usage: SB | CD });
  const trailB = device.createBuffer({ size: N * 4, usage: SB | CD });
  const foodBuf = device.createBuffer({ size: N * 4, usage: SB | CD });
  const photonBuf = device.createBuffer({ size: N * 4, usage: SB | CD });
  const softBuf = device.createBuffer({ size: N * 4, usage: SB });
  const sumBuf = device.createBuffer({ size: 16, usage: SB | CD | GPUBufferUsage.COPY_SRC });
  const sumRead = device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | CD });
  const strandA = device.createBuffer({ label: "sA", size: N * 16, usage: SB });
  const strandB = device.createBuffer({ label: "sB", size: N * 16, usage: SB });
  // knots live on the outer skin only
  const KW = W / 4;
  const KH = Math.ceil(H / 4);
  const knotA = device.createBuffer({ label: "kA", size: KW * KH * 16, usage: SB });
  const knotB = device.createBuffer({ label: "kB", size: KW * KH * 16, usage: SB });
  const knotList = device.createBuffer({ size: MAX_KNOTS * 16, usage: SB });
  const knotCount = device.createBuffer({ size: 16, usage: SB | CD });
  // the glass needs exact distances only near strands; past 15 texels a lower bound will do
  const STEPS = [8, 4, 2, 1];
  const stepBufs = new Map<string, GPUBuffer>();
  const stepBuf = (step: number, layers: number) => {
    const key = `${step}:${layers}`;
    if (!stepBufs.has(key)) {
      const b = device.createBuffer({ label: key, size: 16, usage: GPUBufferUsage.UNIFORM | CD });
      device.queue.writeBuffer(b, 0, new Float32Array([step, layers, 0, 0]));
      stepBufs.set(key, b);
    }
    return stepBufs.get(key)!;
  };

  let nAgents = 0;
  let layersSeeded = 0;
  const reseed = () => {
    const layers = glass.layers;
    nAgents = Math.min(maxAgents, Math.round(web.density * W * H * layers));
    const a = new Float32Array(nAgents * 4);
    for (let i = 0; i < nAgents; i++) a.set([Math.random() * W, Math.random() * (H - 1), Math.random() * Math.PI * 2, i % layers], i * 4);
    device.queue.writeBuffer(agentBuf, 0, a);
    const zero = new Float32Array(N);
    device.queue.writeBuffer(trailA, 0, zero);
    device.queue.writeBuffer(trailB, 0, zero);
    layersSeeded = layers;
    warm = 360;
  };
  let warm = 0;

  const ub = { binding: 0, resource: { buffer: uniformBuffer } };
  const B = (binding: number, buffer: GPUBuffer) => ({ binding, resource: { buffer } });
  const webGroup = (a: GPUBuffer, b: GPUBuffer) => device.createBindGroup({ layout: webL, entries: [ub, B(1, agentBuf), B(2, depBuf), B(3, a), B(4, b), B(5, foodBuf), B(6, photonBuf), B(7, sumBuf)] });
  const webAB = webGroup(trailA, trailB);
  const webBA = webGroup(trailB, trailA);
  const jfaGroups = new Map<string, GPUBindGroup>();
  const jfaGroup = (jIn: GPUBuffer, jOut: GPUBuffer, step: GPUBuffer) => {
    const key = `${jIn.label}>${jOut.label}@${step.label}`;
    if (!jfaGroups.has(key)) jfaGroups.set(key, device.createBindGroup({ layout: jfaL, entries: [ub, B(1, trailA), B(2, foodBuf), B(3, jIn), B(4, jOut), B(5, knotList), B(6, knotCount), B(7, step), B(8, softBuf)] }));
    return jfaGroups.get(key)!;
  };
  const marchGroup = device.createBindGroup({ layout: marchL, entries: [ub, B(1, strandA), B(2, knotA)] });
  const sprGroup = device.createBindGroup({ layout: sprL, entries: [ub, B(1, knotList), B(2, knotCount)] });

  // ---------------------------------------------------------------- render targets (rebuilt with the size)
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  type Targets = { w: number; h: number; hdr: GPUTexture; hist: GPUTexture[]; mips: GPUTexture[]; taa: GPUBindGroup[]; downs: GPUBindGroup[][]; comp: GPUBindGroup[]; age: number };
  let targets: Targets | null = null;
  const makeTargets = (w: number, h: number): Targets => {
    const TU = GPUTextureUsage;
    const hdr = device.createTexture({ size: [w, h], format: "rgba16float", usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    const mips: GPUTexture[] = [];
    let mw = w;
    let mh = h;
    for (let k = 0; k < 5; k++) {
      mw = Math.max(1, Math.ceil(mw / 2));
      mh = Math.max(1, Math.ceil(mh / 2));
      mips.push(device.createTexture({ size: [mw, mh], format: "rgba16float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }));
    }
    // the anti-aliased history, two of them taking turns
    const hist = [0, 1].map(() => device.createTexture({ size: [w, h], format: "rgba16float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }));
    const taa = [0, 1].map((k) =>
      device.createBindGroup({
        layout: taaL,
        entries: [ub, { binding: 1, resource: hdr.createView() }, { binding: 2, resource: sampler }, { binding: 3, resource: hist[k].createView() }, { binding: 4, resource: hist[1 - k].createView() }],
      }),
    );
    const downs = [0, 1].map((h) =>
      mips.map((m, k) =>
        device.createBindGroup({
          layout: downL,
          entries: [ub, { binding: 1, resource: (k ? mips[k - 1] : hist[h]).createView() }, { binding: 2, resource: sampler }, { binding: 3, resource: m.createView() }],
        }),
      ),
    );
    const comp = [0, 1].map((h) =>
      device.createBindGroup({
        layout: compL,
        entries: [
          ub,
          { binding: 1, resource: hist[h].createView() },
          { binding: 2, resource: sampler },
          ...mips.map((m, k) => ({ binding: 3 + k, resource: m.createView() })),
          B(8, trailA),
          B(9, foodBuf),
          B(10, strandA),
        ],
      }),
    );
    return { w, h, hdr, hist, mips, taa, downs, comp, age: 0 };
  };

  // ---------------------------------------------------------------- the hand and the panel
  const pose = { yaw: 0, pitch: view.pitch };
  let drag: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) return;
    pose.yaw += (e.clientX - drag.x) * 0.004;
    pose.pitch = Math.max(-35, Math.min(45, pose.pitch + (e.clientY - drag.y) * 0.15));
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => (drag = null);
  const onKey = (e: KeyboardEvent) => {
    // space holds the turn still, so the anti-aliasing can settle on a sharp frame
    if (e.key === " ") {
      view.hold = !view.hold;
      e.preventDefault();
    }
    if (e.key === "w") {
      view.lab = !view.lab;
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    }
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  window.addEventListener("keydown", onKey);

  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0;";
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "vessel" });
  gui.close();
  gui.add(view, "lab").name("web lab (W)");
  const fw = gui.addFolder("web");
  fw.add(web as Record<string, unknown>, "mode", Object.keys(MODES)).name("grown from");
  fw.add(web, "food", 0, 3, 0.01).name("appetite for light");
  fw.add(web, "rim", 0, 6, 0.01).name("crown scent");
  fw.add(web, "SA", 5, 90, 0.5).name("sensor angle");
  fw.add(web, "RA", 5, 90, 0.5).name("turn");
  fw.add(web, "SD", 2, 40, 0.1).name("sensor reach");
  fw.add(web, "SS", 0.2, 3, 0.05).name("stride");
  fw.add(web, "decay", 0.01, 0.4, 0.005);
  fw.add(web, "steps", 0, 16, 2).name("growth / frame");
  fw.add(web, "density", 0.05, 0.8, 0.01)
    .name("agents")
    .onFinishChange(() => reseed());
  fw.add({ reseed }, "reseed").name("grow again");
  const ff = gui.addFolder("foam");
  ff.add(foam, "cells", 10, 90, 1).name("cells round");
  ff.add(foam, "warp", 0, 1.5, 0.01).name("wobble");
  ff.add(foam, "fine", 0, 1, 0.01).name("finer net");
  ff.add(foam, "peak", 2, 15, 0.1).name("strength");
  const fc = gui.addFolder("light it feeds on");
  fc.add(caustic, "depth", 10, 200, 1);
  fc.add(caustic, "focus", 0, 4, 0.01);
  fc.add(caustic, "drift", 0, 0.5, 0.001);
  const fg = gui.addFolder("glass");
  fg.add(glass, "layers", 1, 3, 1)
    .name("skins")
    .onFinishChange(() => reseed());
  fg.add(glass, "shrink", 0.5, 0.95, 0.01).name("inner skin size");
  fg.add(glass, "thr", 0.5, 6, 0.01).name("strand from");
  fg.add(glass, "rMin", 0.0005, 0.01, 0.0001).name("thinnest");
  fg.add(glass, "rK", 0, 0.01, 0.0001).name("thickening");
  fg.add(glass, "nodeThr", 1, 15, 0.1).name("thorn from");
  fg.add(glass, "thornLen", 0, 0.15, 0.001).name("thorns");
  fg.add(glass, "tendril", 0, 0.8, 0.01).name("hem threads");
  fg.add(glass, "crown", 0, 1, 0.01).name("crown spikes");
  fg.add(glass, "hem", 0, 1, 0.01).name("hem density");
  fg.add(glass, "thorns", 0, 1, 0.01).name("body thorns");
  const fl = gui.addFolder("look");
  fl.add(look, "exposure", 0.1, 4, 0.01);
  fl.add(look, "bloom", 0, 3, 0.01);
  fl.add(look, "core", 0, 5, 0.01).name("inner glow");
  fl.add(look, "coreSize", 0.05, 0.8, 0.01).name("glow size");
  fl.add(look, "alpha", 0.05, 1, 0.01).name("glass opacity");
  fl.add(look, "halo", 0, 4, 0.01).name("thread halo");
  fl.add(look, "snow", 0, 3, 0.01).name("specks");
  fl.add(look, "stars", 0, 3, 0.01).name("glints");
  fl.add(look, "scale", 0.3, 1, 0.05).name("render scale");
  fl.add(look, "budget", 2e5, 6e6, 1e5).name("pixel budget");
  fl.add(look, "taa").name("anti-aliasing");
  fl.add(look, "taaBlend", 0.03, 1, 0.01).name("aa blend");
  fl.add(look, "taaClip", 0.5, 4, 0.05).name("aa clip");
  const fv = gui.addFolder("view");
  fv.add(view, "spin", -0.2, 0.2, 0.001);
  fv.add(view, "hold").name("hold still (space)");
  fv.add(view, "distance", 2, 8, 0.01);
  fv.add(view, "fov", 15, 70, 0.5);
  for (const f of [fw, ff, fc, fg, fl, fv]) f.close();

  // ---------------------------------------------------------------- a frame
  let frame = 0;
  let foamKey = "";
  let spinAngle = 0;
  let prevCam: { pos: number[]; f: number[]; r: number[]; u: number[]; rot: number } | null = null;
  let foamPending = false;
  let time = 0;
  let trailMean = 10;
  let sumBusy = false;
  const clock = { paused: false };
  reseed();

  const step = (dt: number) => {
    time += dt;
    spinAngle += view.hold ? 0 : dt * view.spin;
    if (glass.layers !== layersSeeded) reseed();
    const cw = canvas.width;
    const ch = canvas.height;
    // marched at most about a million pixels (render scale is the most it may use); bloom hides the rest
    const sc = Math.min(look.scale, Math.sqrt(look.budget / (cw * ch)));
    const rw = Math.max(1, Math.round(cw * sc));
    const rh = Math.max(1, Math.round(ch * sc));
    if (!targets || targets.w !== rw || targets.h !== rh) {
      targets?.hdr.destroy();
      targets?.hist.forEach((t) => t.destroy());
      targets?.mips.forEach((m) => m.destroy());
      targets = makeTargets(rw, rh);
    }
    const T = targets;

    // the camera orbits the vessel's middle
    const yaw = pose.yaw;
    const pit = (pose.pitch * Math.PI) / 180;
    const target = [0, 0.0, 0];
    const pos = [Math.sin(yaw) * Math.cos(pit) * view.distance, target[1] + Math.sin(pit) * view.distance, Math.cos(yaw) * Math.cos(pit) * view.distance];
    const f = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
    const fl = Math.hypot(...f);
    f.forEach((_, i) => (f[i] /= fl));
    const r = [-f[2], 0, f[0]];
    const rl = Math.hypot(...r);
    r.forEach((_, i) => (r[i] /= rl));
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const tanFov = Math.tan((view.fov * Math.PI) / 360);

    // the slow work takes turns: growth (and its light) one frame, the glass made from it the next. Growth
    // takes an even number of steps so the trail ends where everything reads it; a rush at the start
    const mode = MODES[web.mode];
    // grown webs take turns: growth one frame, the glass the next. Foam stands still: it is worked out once,
    // and the glass the frame after, and again only when a setting changes
    let growth = frame % 2 === 0;
    let geometry = !growth;
    if (mode === 3) {
      const key = JSON.stringify([foam, glass, web.mode]);
      growth = key !== foamKey;
      geometry = foamPending;
      foamPending = growth;
      foamKey = key;
    }
    let steps = mode === 1 || mode === 3 ? 0 : warm > 0 ? 24 : web.steps * 2;
    steps += steps % 2;
    if (growth) warm = Math.max(0, warm - steps);

    setU({
      time,
      frame,
      W,
      H,
      layers: glass.layers,
      nAgents,
      SA: (web.SA * Math.PI) / 180,
      RA: (web.RA * Math.PI) / 180,
      SD: web.SD,
      SS: web.SS,
      deposit: web.deposit,
      decay: web.decay,
      foodW: mode === 2 ? web.food : 0,
      cells: foam.cells,
      warp: foam.warp,
      fine: foam.fine,
      webPeak: foam.peak,
      crown: glass.crown,
      hem: glass.hem,
      thorns: glass.thorns,
      rim: web.rim,
      trailMean,
      mode,
      cDepth: caustic.depth,
      cBend: caustic.focus / caustic.depth,
      drift: caustic.drift,
      thr: glass.thr,
      nodeThr: glass.nodeThr,
      rMin: glass.rMin,
      rK: glass.rK,
      Rmax: sheet.Rmax,
      Hlen: sheet.Hlen,
      y0: view.y0,
      shrink: glass.shrink,
      thornLen: glass.thornLen,
      tendril: glass.tendril,
      rot: spinAngle,
      camX: pos[0],
      camY: pos[1],
      camZ: pos[2],
      fX: f[0],
      fY: f[1],
      fZ: f[2],
      rX: r[0],
      rY: r[1],
      rZ: r[2],
      uX: u[0],
      uY: u[1],
      uZ: u[2],
      tanFov,
      aspect: rw / rh,
      rW: rw,
      rH: rh,
      pix: (2 * tanFov) / rh,
      exposure: look.exposure,
      bloom: look.bloom,
      coreI: look.core,
      coreSize: look.coreSize,
      coreY: look.coreY,
      alpha: look.alpha,
      halo: look.halo,
      viewMode: view.lab ? 1 : 0,
      snow: look.snow,
      stars: look.stars,
      starSize: look.starSize,
      focus: view.distance,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    // a sub-pixel step each frame along a Halton (2, 3) walk; the first frame after a resize starts the history
    const halton = (i: number, b: number) => {
      let f = 1;
      let r = 0;
      for (let k = i; k > 0; k = Math.floor(k / b)) {
        f /= b;
        r += f * (k % b);
      }
      return r;
    };
    const par = frame & 1;
    const n = (frame % 16) + 1;
    const fresh = T.age === 0 || !look.taa || view.lab;
    const rot = spinAngle;
    const pc = prevCam ?? { pos, f, r, u, rot };
    setU({
      dRot: rot - pc.rot,
      pcX: pc.pos[0],
      pcY: pc.pos[1],
      pcZ: pc.pos[2],
      pfX: pc.f[0],
      pfY: pc.f[1],
      pfZ: pc.f[2],
      prX: pc.r[0],
      prY: pc.r[1],
      prZ: pc.r[2],
      puX: pc.u[0],
      puY: pc.u[1],
      puZ: pc.u[2],
    });
    prevCam = { pos, f, r, u, rot };
    setU({
      jx: look.taa ? halton(n, 2) - 0.5 : 0,
      jy: look.taa ? halton(n, 3) - 0.5 : 0,
      taaAlpha: fresh ? 1 : look.taaBlend,
      taaClip: look.taaClip,
    });
    T.age++;
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    const enc = device.createCommandEncoder();
    const rows = H * glass.layers;
    const gx = Math.ceil(W / 16);
    const gy = Math.ceil(rows / 16);
    if (growth) enc.clearBuffer(photonBuf);
    enc.clearBuffer(sumBuf);
    if (geometry) enc.clearBuffer(knotCount);
    let pass = enc.beginComputePass();
    pass.setBindGroup(0, webAB);
    if (mode === 3 && !(dbg.skip & 1) && growth) {
      pass.setPipeline(foamPipe);
      pass.dispatchWorkgroups(gx, gy);
    }
    if ((mode === 1 || mode === 2) && !(dbg.skip & 1) && growth) {
      pass.setPipeline(shinePipe);
      pass.dispatchWorkgroups(Math.ceil((W * H * 4 * glass.layers) / 256));
      pass.setPipeline(resolvePipe);
      pass.dispatchWorkgroups(gx, gy);
    }
    for (let s = 0; s < (dbg.skip & 2 || !growth ? 0 : steps); s++) {
      pass.setBindGroup(0, s % 2 ? webBA : webAB);
      pass.setPipeline(movePipe);
      pass.dispatchWorkgroups(Math.ceil(nAgents / 256));
      pass.setPipeline(diffusePipe);
      pass.dispatchWorkgroups(gx, gy);
    }
    // web to strands, and knots to thorns
    if (!(dbg.skip & 4) && geometry) {
      pass.setBindGroup(0, jfaGroup(strandB, strandA, stepBuf(0, glass.layers)));
      pass.setPipeline(softenPipe);
      pass.dispatchWorkgroups(gx, gy);
      pass.setPipeline(seedStrandsPipe);
      pass.dispatchWorkgroups(gx, gy);
      STEPS.forEach((st, k) => {
        pass.setBindGroup(0, k % 2 ? jfaGroup(strandB, strandA, stepBuf(st, glass.layers)) : jfaGroup(strandA, strandB, stepBuf(st, glass.layers)));
        pass.setPipeline(floodPipe);
        pass.dispatchWorkgroups(gx, gy);
      });
    }
    if (!(dbg.skip & 8) && geometry) {
      // knots: each block's strongest texel (into kB), the blocks stronger than their neighbours (into kA), flooded
      const kg = [Math.ceil(KW / 16), Math.ceil(KH / 16)] as const;
      pass.setBindGroup(0, jfaGroup(knotB, knotA, stepBuf(0, 1)));
      pass.setPipeline(blockMaxPipe);
      pass.dispatchWorkgroups(...kg);
      pass.setPipeline(seedKnotsPipe);
      pass.dispatchWorkgroups(...kg);
      STEPS.forEach((st, k) => {
        pass.setBindGroup(0, k % 2 ? jfaGroup(knotB, knotA, stepBuf(st, 1)) : jfaGroup(knotA, knotB, stepBuf(st, 1)));
        pass.setPipeline(floodKnotsPipe);
        pass.dispatchWorkgroups(...kg);
      });
    }
    pass.end();

    if (!view.lab) {
      const rp = enc.beginRenderPass({ colorAttachments: [{ view: T.hdr.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
      rp.setPipeline(marchPipe);
      rp.setBindGroup(0, marchGroup);
      if (!(dbg.skip & 16)) rp.draw(3);
      rp.setBindGroup(0, sprGroup);
      rp.setPipeline(snowPipe);
      rp.draw(4, 1400);
      rp.setPipeline(starPipe);
      rp.draw(4, MAX_KNOTS);
      rp.end();
      pass = enc.beginComputePass();
      pass.setPipeline(taaPipe);
      pass.setBindGroup(0, T.taa[par]);
      pass.dispatchWorkgroups(Math.ceil(T.w / 8), Math.ceil(T.h / 8));
      pass.setPipeline(downPipe);
      if (!(dbg.skip & 32))
        T.mips.forEach((m, k) => {
          pass.setBindGroup(0, T.downs[par][k]);
          pass.dispatchWorkgroups(Math.ceil(m.width / 8), Math.ceil(m.height / 8));
        });
      pass.end();
    }
    const out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    out.setPipeline(compPipe);
    out.setBindGroup(0, T.comp[par]);
    out.draw(3);
    out.end();

    const readSum = !sumBusy && steps > 0 && growth;
    if (readSum) enc.copyBufferToBuffer(sumBuf, 0, sumRead, 0, 16);
    device.queue.submit([enc.finish()]);
    if (readSum) {
      sumBusy = true;
      const cells = W * H * glass.layers * steps;
      sumRead
        .mapAsync(GPUMapMode.READ)
        .then(() => {
          const s = new Uint32Array(sumRead.getMappedRange())[0];
          sumRead.unmap();
          const m = (s * 4) / cells;
          if (m > 0) trailMean += (m - trailMean) * 0.3;
          sumBusy = false;
        })
        .catch(() => (sumBusy = false));
    }
    frame++;
  };

  (window as any).__vessel = {
    dbg,
    web,
    foam,
    caustic,
    glass,
    look,
    view,
    pose,
    clock,
    reseed,
    get frame() {
      return frame;
    },
    get warm() {
      return warm;
    },
    get trailMean() {
      return trailMean;
    },
    advance: async (seconds: number) => {
      clock.paused = true;
      const n = Math.round(seconds * 60);
      for (let k = 0; k < n; k++) {
        step(1 / 60);
        if (k % 4 === 3) await device.queue.onSubmittedWorkDone();
      }
      await device.queue.onSubmittedWorkDone();
    },
    bench: async (frames = 20) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        step(1 / 60);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
  };

  const due = frameCap(60);
  let tPrev = performance.now();
  wrap.render = () => {
    const now = performance.now();
    if (clock.paused || !due()) {
      tPrev = now;
      return;
    }
    const dt = Math.min((now - tPrev) / 1000, 1 / 30);
    tPrev = now;
    step(dt);
    stats.update();
  };
  wrap.resize = () => {};
  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    window.removeEventListener("keydown", onKey);
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 60_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
