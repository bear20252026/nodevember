/**
 * Pool: a little pool on a sunny deck, drawn like an anime background. The sun's light through its
 * surface is worked out each frame as a light mesh (a fine grid of rays refracted onto the floor, each
 * triangle as bright as it is squeezed), and stylised into flat white lines with a cyan glow over
 * painted stones. Click to throw things in: beach balls float and bob, stones sink, glass marbles sink
 * and focus a spot of their own, petals drift on top. Each one moves the water, and the light changes.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import blurCode from "./blur.wgsl?raw";
import commonCode from "./common.wgsl?raw";
import meshCode from "./mesh.wgsl?raw";
import objectsCode from "./objects.wgsl?raw";
import raysCode from "./rays.wgsl?raw";
import sceneCode from "./scene.wgsl?raw";
import simCode from "./sim.wgsl?raw";
import spritesCode from "./sprites.wgsl?raw";
import surfaceCode from "./surface.wgsl?raw";
import bakedCode from "./baked.wgsl?raw";

const pool = { PX: 1.5, PZ: 1.0, D: 0.5, RIM: 0.07, coping: 0.2, nx: 384, nz: 256, margin: 0.45 };
const water = { bend: 2.6, short: 0.13, long: 0.42, view: 0.45, waves: 1, stiff: 1.5, damp: 0.995, visc: 0.06, displace: 0.35, couple: 0.5, substeps: 2, speed: 0.8 };
const light = { elevation: 64, azimuth: 196 };
const look = {
  amb: 0.5,
  diffuse: 0.42,
  clampLit: 1.6,
  lineLo: 1.35,
  lineHi: 2.1,
  lineMix: 0.95,
  glow: 0.9,
  glowFloor: 1.2,
  glowSigma: 3,
  blur: 1.7,
  absorb: 1,
  stoneScale: 4.2,
  spec0: 0.9988,
  spec1: 0.9995,
  specW: 0.8,
  spark0: 0.9955,
  spark1: 0.999,
  starSize: 36,
  cmax: 40,
};
const view = { elevation: 55, distance: 3.55, fov: 36, lookY: -0.25, lookZ: 0.06 };
const caustic = { mx: 640, mz: 427, texel: 0.003 };
const MAX_OBJ = 64;
/** profiling: 1 sim, 2 rays, 4 mesh, 8 blur, 16 scene, 32 sprites */
const dbg = { skip: 0 };
const MAX_DROPS = 600;
const MAX_IMP = 96;

const UNIFORMS = [
  "time",
  "nObj",
  "nImp",
  "PX",
  "PZ",
  "D",
  "RIM",
  "coping",
  "cell",
  "nx",
  "nz",
  "stiff",
  "damp",
  "displace",
  "visc",
  "waveAmp",
  "viewBend",
  "sunX",
  "sunY",
  "sunZ",
  "dmX",
  "dmY",
  "dmZ",
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
  "W",
  "H",
  "dpr",
  "mx",
  "mz",
  "cMinX",
  "cMinZ",
  "cSizeX",
  "cSizeZ",
  "cmax",
  "blur",
  "glowSigma",
  "glowFloor",
  "amb",
  "diffuse",
  "clampLit",
  "lineLo",
  "lineHi",
  "lineMix",
  "glow",
  "absorb",
  "stoneScale",
  "spec0",
  "spec1",
  "specW",
  "spark0",
  "spark1",
  "starSize",
  "starsX",
  "starsN",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

// ---------------------------------------------------------------- the breeze ripples, shared with the GPU

type Wave = { kx: number; kz: number; w: number; phi: number; a: number };
const makeWaves = (): Wave[] => {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const out: Wave[] = [];
  const n = 10;
  for (let k = 0; k < n; k++) {
    const lambda = water.short + (water.long - water.short) * (k / (n - 1)) ** 1.4 + 0.02 * rnd();
    const dir = 0.4 + k * 2.399963 + 0.5 * rnd();
    const kk = (2 * Math.PI) / lambda;
    // each wave bends the surface by about as much (curvature a k^2), so all of them make lines
    const a = water.bend / (kk * kk);
    out.push({ kx: kk * Math.cos(dir), kz: kk * Math.sin(dir), w: Math.sqrt(9.8 * kk) * water.speed, phi: rnd() * 6.283, a });
  }
  return out;
};
const WAVES = makeWaves();
// written out with its numbers in place: far cheaper on the GPU than looping over an array
const f = (x: number) => x.toFixed(6);
const waveCode = `
/** the standing breeze ripples: height and its slope (h, dh/dx, dh/dz) */
fn ambient(p: vec2f) -> vec3f {
  var r = vec3f(0.0);
  var ph = 0.0;
${WAVES.map((w) => `  ph = ${f(w.kx)} * p.x + ${f(w.kz)} * p.y - ${f(w.w)} * U.time + ${f(w.phi)};\n  r += ${f(w.a)} * vec3f(sin(ph), cos(ph) * vec2f(${f(w.kx)}, ${f(w.kz)}));`).join("\n")}
  return r * U.waveAmp;
}
`;
const ambientCPU = (x: number, z: number, t: number) => {
  let h = 0;
  let gx = 0;
  let gz = 0;
  for (const w of WAVES) {
    const ph = w.kx * x + w.kz * z - w.w * t + w.phi;
    const a = w.a * water.waves;
    h += a * Math.sin(ph);
    gx += a * Math.cos(ph) * w.kx;
    gz += a * Math.cos(ph) * w.kz;
  }
  return [h, gx, gz];
};

// ---------------------------------------------------------------- things to throw

type Kind = "ball" | "stone" | "marble" | "petal";
const KINDS: Record<Kind, { id: number; r: () => number; density: number; scale: () => number[] }> = {
  ball: { id: 0, r: () => 0.13 + 0.04 * Math.random(), density: 0.15, scale: () => [1, 1, 1] },
  stone: { id: 1, r: () => 0.085 + 0.045 * Math.random(), density: 2.6, scale: () => [1.15 + 0.2 * Math.random(), 0.62 + 0.15 * Math.random(), 0.9 + 0.15 * Math.random()] },
  marble: { id: 2, r: () => 0.075 + 0.025 * Math.random(), density: 2.5, scale: () => [1, 1, 1] },
  petal: { id: 3, r: () => 0.06 + 0.02 * Math.random(), density: 0.3, scale: () => [1, 1, 1] },
};

type V3 = [number, number, number];
type Q = [number, number, number, number];
interface Body {
  id: number;
  kind: Kind;
  p: V3;
  prev: V3;
  v: V3;
  q: Q;
  w: V3;
  r: number;
  s: V3;
  density: number;
  seed: number;
  /** below the surface last step (for the splash) */
  wet: boolean;
}

const qmul = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qnorm = (q: Q): Q => {
  const l = Math.hypot(...q) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};
const qaxis = (x: number, y: number, z: number, ang: number): Q => {
  const l = Math.hypot(x, y, z) || 1;
  const s = Math.sin(ang / 2) / l;
  return [x * s, y * s, z * s, Math.cos(ang / 2)];
};
const qrot = (q: Q, v: V3): V3 => {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [v[0] + w * tx + (y * tz - z * ty), v[1] + w * ty + (z * tx - x * tz), v[2] + w * tz + (x * ty - y * tx)];
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

  const compile = (label: string, ...parts: string[]) => {
    const module = device.createShaderModule({ code: uniStruct + waveCode + commonCode + parts.join("\n"), label });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) if (m.type === "error") console.error(`${label} wgsl ${m.lineNum}:${m.linePos} ${m.message}`);
    });
    return module;
  };

  // ---------------------------------------------------------------- layouts
  const C = GPUShaderStage.COMPUTE;
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const uni = (visibility: number): GPUBindGroupLayoutEntry => ({ binding: 0, visibility, buffer: { type: "uniform" } });
  const simLayout = device.createBindGroupLayout({
    entries: [
      uni(C),
      { binding: 1, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: C, buffer: { type: "storage" } },
      { binding: 3, visibility: C, buffer: { type: "storage" } },
      { binding: 4, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } },
      { binding: 5, visibility: C, buffer: { type: "storage" } },
      { binding: 6, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 7, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } },
    ],
  });
  const raysLayout = device.createBindGroupLayout({
    entries: [
      uni(C),
      { binding: 1, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: C, texture: { sampleType: "float" } },
      { binding: 3, visibility: C, sampler: { type: "filtering" } },
      { binding: 4, visibility: C, buffer: { type: "storage" } },
    ],
  });
  const meshLayout = device.createBindGroupLayout({ entries: [uni(VF), { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } }] });
  const blurLayout = device.createBindGroupLayout({
    entries: [uni(C), { binding: 2, visibility: C, texture: { sampleType: "unfilterable-float" } }, { binding: 3, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } }],
  });
  const sceneLayout = device.createBindGroupLayout({
    entries: [
      uni(VF),
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: { type: "filtering" } },
      { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "float" } },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
    ],
  });
  const spriteLayout = device.createBindGroupLayout({
    entries: [
      uni(VF),
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, texture: { sampleType: "float" } },
      { binding: 3, visibility: GPUShaderStage.VERTEX, sampler: { type: "filtering" } },
    ],
  });

  // ---------------------------------------------------------------- pipelines
  const simModule = compile("sim", simCode);
  const simPipe = (entryPoint: string) => device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [simLayout] }), compute: { module: simModule, entryPoint } });
  const disturbPipe = simPipe("disturb");
  const stepPipe = simPipe("step");
  const surfacePipe = simPipe("surface");
  const probePipe = simPipe("probe");
  const raysPipe = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [raysLayout] }),
    compute: { module: compile("rays", objectsCode, surfaceCode, raysCode), entryPoint: "rays" },
  });
  const meshModule = compile("mesh", meshCode);
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
  const meshPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [meshLayout] }),
    vertex: { module: meshModule, entryPoint: "vs" },
    fragment: { module: meshModule, entryPoint: "fs", targets: [{ format: "rgba16float", blend: add }] },
    primitive: { topology: "triangle-list" },
  });
  const blurModule = compile("blur", blurCode);
  const blurPipe = (entryPoint: string) => device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [blurLayout] }), compute: { module: blurModule, entryPoint } });
  const [kdeH, kdeV, glowH, glowV, down4] = ["kdeH", "kdeV", "glowH", "glowV", "down4"].map(blurPipe);
  const sceneModule = compile("scene", objectsCode, bakedCode, sceneCode);
  const scenePipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [sceneLayout] }),
    vertex: { module: sceneModule, entryPoint: "vs" },
    fragment: { module: sceneModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });
  const spriteModule = compile("sprites", bakedCode, spritesCode);
  const spritePipe = (vs: string, fs: string, blend: GPUBlendState) =>
    device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [spriteLayout] }),
      vertex: { module: spriteModule, entryPoint: vs },
      fragment: { module: spriteModule, entryPoint: fs, targets: [{ format, blend }] },
      primitive: { topology: "triangle-strip" },
    });
  const starPipe = spritePipe("vsStar", "fsStar", add);
  const dropPipe = spritePipe("vsDrop", "fsDrop", {
    color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
  });

  // ---------------------------------------------------------------- resources
  const SB = GPUBufferUsage.STORAGE;
  const CD = GPUBufferUsage.COPY_DST;
  const uniforms = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | CD });
  const setU = (v: Partial<Record<UName, number>>) => {
    for (const [k, x] of Object.entries(v)) uniforms[UNIFORMS.indexOf(k as UName)] = x!;
  };
  const objData = new Float32Array(MAX_OBJ * 16);
  const objBuf = device.createBuffer({ size: objData.byteLength, usage: SB | CD });
  const boundData = new Float32Array(MAX_OBJ * 4);
  const boundBuf = device.createBuffer({ size: boundData.byteLength, usage: SB | CD });
  const impData = new Float32Array(MAX_IMP * 4);
  const impBuf = device.createBuffer({ size: impData.byteLength, usage: SB | CD });
  const dropData = new Float32Array(MAX_DROPS * 8);
  const dropBuf = device.createBuffer({ size: dropData.byteLength, usage: SB | CD });
  const cells = pool.nx * pool.nz;
  const stateA = device.createBuffer({ size: cells * 8, usage: SB | CD });
  const stateB = device.createBuffer({ size: cells * 8, usage: SB | CD });
  const probeBuf = device.createBuffer({ size: MAX_OBJ * 16, usage: SB | GPUBufferUsage.COPY_SRC });
  const probeRead = device.createBuffer({ size: MAX_OBJ * 16, usage: GPUBufferUsage.MAP_READ | CD });
  const surfTex = device.createTexture({ size: [pool.nx, pool.nz], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
  const allTex = device.createTexture({ size: [pool.nx, pool.nz], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
  const nVerts = caustic.mx * caustic.mz;
  const vertBuf = device.createBuffer({ size: nVerts * 16, usage: SB });
  const indices = new Uint32Array((caustic.mx - 1) * (caustic.mz - 1) * 6);
  for (let z = 0, o = 0; z < caustic.mz - 1; z++) {
    for (let x = 0; x < caustic.mx - 1; x++) {
      const a = z * caustic.mx + x;
      indices.set([a, a + 1, a + caustic.mx, a + 1, a + caustic.mx + 1, a + caustic.mx], o);
      o += 6;
    }
  }
  const indexBuf = device.createBuffer({ size: indices.byteLength, usage: GPUBufferUsage.INDEX | CD });
  device.queue.writeBuffer(indexBuf, 0, indices);

  const cMinX = -pool.PX - pool.margin;
  const cMinZ = -pool.PZ - pool.margin;
  const cSizeX = 2 * (pool.PX + pool.margin);
  const cSizeZ = 2 * (pool.PZ + pool.margin);
  const cw = Math.round(cSizeX / caustic.texel);
  const ch = Math.round(cSizeZ / caustic.texel);
  const TU = GPUTextureUsage;
  const lightTex = (w: number, h: number, extra = 0) => device.createTexture({ size: [w, h], format: "rgba16float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING | extra });
  const causRaw = lightTex(cw, ch, TU.RENDER_ATTACHMENT);
  const causTmp = lightTex(cw, ch);
  const caus = lightTex(cw, ch);
  const gw = Math.ceil(cw / 4);
  const gh = Math.ceil(ch / 4);
  const glowA = lightTex(gw, gh);
  const glowB = lightTex(gw, gh);
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });

  const ub = { binding: 0, resource: { buffer: uniformBuffer } };
  const simGroup = (a: GPUBuffer, b: GPUBuffer) =>
    device.createBindGroup({
      layout: simLayout,
      entries: [
        ub,
        { binding: 1, resource: { buffer: objBuf } },
        { binding: 2, resource: { buffer: a } },
        { binding: 3, resource: { buffer: b } },
        { binding: 4, resource: surfTex.createView() },
        { binding: 5, resource: { buffer: probeBuf } },
        { binding: 6, resource: { buffer: impBuf } },
        { binding: 7, resource: allTex.createView() },
      ],
    });
  const simAB = simGroup(stateA, stateB);
  const simBA = simGroup(stateB, stateA);
  const raysGroup = device.createBindGroup({
    layout: raysLayout,
    entries: [ub, { binding: 1, resource: { buffer: objBuf } }, { binding: 2, resource: surfTex.createView() }, { binding: 3, resource: sampler }, { binding: 4, resource: { buffer: vertBuf } }],
  });
  const meshGroup = device.createBindGroup({ layout: meshLayout, entries: [ub, { binding: 1, resource: { buffer: vertBuf } }] });
  const blurGroup = (src: GPUTexture, dst: GPUTexture) =>
    device.createBindGroup({
      layout: blurLayout,
      entries: [ub, { binding: 2, resource: src.createView() }, { binding: 3, resource: dst.createView() }],
    });
  const blurs = {
    h: blurGroup(causRaw, causTmp),
    v: blurGroup(causTmp, caus),
    down: blurGroup(caus, glowA),
    gh: blurGroup(glowA, glowB),
    gv: blurGroup(glowB, glowA),
  };
  const sceneGroup = device.createBindGroup({
    layout: sceneLayout,
    entries: [
      ub,
      { binding: 1, resource: { buffer: objBuf } },
      { binding: 2, resource: allTex.createView() },
      { binding: 3, resource: sampler },
      { binding: 4, resource: caus.createView() },
      { binding: 5, resource: glowA.createView() },
      { binding: 6, resource: { buffer: boundBuf } },
    ],
  });
  const spriteGroup = device.createBindGroup({
    layout: spriteLayout,
    entries: [ub, { binding: 1, resource: { buffer: dropBuf } }, { binding: 2, resource: allTex.createView() }, { binding: 3, resource: sampler }],
  });

  // ---------------------------------------------------------------- the world
  const bodies: Body[] = [];
  let nextId = 1;
  type Drop = { p: V3; v: V3; size: number; life: number };
  const drops: Drop[] = [];
  const later: { at: number; fn: () => void }[] = [];
  const imps: number[][] = [];
  let simTime = 0;
  let calm = 0;

  const probes = new Map<number, number[]>();
  let probeBusy = false;
  const waterAt = (b: Body) => {
    const s = probes.get(b.id) ?? [0, 0, 0];
    const a = ambientCPU(b.p[0], b.p[2], simTime);
    // the rings are read a frame or two late: lean on them only partly, or a bobbing float pumps them up
    const k = water.couple;
    return [s[0] * k + a[0], s[1] * k + a[1], s[2] * k + a[2]];
  };

  const camera = () => {
    const el = (view.elevation * Math.PI) / 180;
    const target: V3 = [0, view.lookY, view.lookZ];
    const pos: V3 = [0, target[1] + view.distance * Math.sin(el), target[2] + view.distance * Math.cos(el)];
    const f: V3 = [0, -Math.sin(el), -Math.cos(el)];
    const r: V3 = [1, 0, 0];
    const u: V3 = [0, Math.cos(el), -Math.sin(el)];
    return { pos, f, r, u, tan: Math.tan((view.fov * Math.PI) / 360) };
  };
  const sun = () => {
    const e = (light.elevation * Math.PI) / 180;
    const a = (light.azimuth * Math.PI) / 180;
    const S: V3 = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
    // refracted into flat water
    const eta = 1 / 1.333;
    const cosi = S[1];
    const k = 1 - eta * eta * (1 - cosi * cosi);
    const dm: V3 = [-S[0] * eta, -S[1] * eta - (Math.sqrt(k) - eta * cosi), -S[2] * eta];
    return { S, dm };
  };

  const spawn = (kind: Kind, p: V3, v: V3) => {
    const K = KINDS[kind];
    const yaw = Math.random() * Math.PI * 2;
    let q = qaxis(0, 1, 0, yaw);
    if (kind === "stone") q = qmul(qaxis(1, 0, 0, (Math.random() - 0.5) * 0.4), q);
    const b: Body = {
      id: nextId++,
      kind,
      p: [...p],
      prev: [...p],
      v: [...v],
      q,
      w: kind === "petal" ? [Math.random() * 6 - 3, Math.random() * 4 - 2, Math.random() * 6 - 3] : [Math.random() * 10 - 5, Math.random() * 6 - 3, Math.random() * 10 - 5],
      r: K.r(),
      s: K.scale() as V3,
      density: K.density,
      seed: Math.random(),
      wet: false,
    };
    bodies.push(b);
    while (bodies.length > MAX_OBJ) bodies.shift();
    return b;
  };

  /** thrown from just below the camera so that it comes down at (x, z) */
  const throwAt = (kind: Kind, x: number, z: number) => {
    const cam = camera();
    if (kind === "petal") {
      for (let k = 0; k < 9; k++) {
        const a = Math.random() * Math.PI * 2;
        const d = Math.sqrt(Math.random()) * 0.35;
        spawn("petal", [x + Math.cos(a) * d, 0.9 + Math.random() * 0.8, z + Math.sin(a) * d], [Math.random() * 0.4 - 0.2, -0.3, Math.random() * 0.4 - 0.2]);
      }
      return;
    }
    const r = KINDS[kind].r();
    x = Math.max(-pool.PX + r, Math.min(pool.PX - r, x));
    z = Math.max(-pool.PZ + r, Math.min(pool.PZ - r, z));
    const start: V3 = [cam.pos[0] + (Math.random() - 0.5) * 0.6, cam.pos[1] - 1.2, cam.pos[2] - 0.4];
    const dist = Math.hypot(x - start[0], z - start[2]);
    const T = 0.55 + 0.1 * dist;
    const g = 9.8;
    spawn(kind, start, [(x - start[0]) / T, (0 - start[1]) / T + 0.5 * g * T, (z - start[2]) / T]);
  };

  const splash = (b: Body, speed: number) => {
    const big = (b.r * (b.s[0] + b.s[1] + b.s[2])) / 3;
    const n = Math.min(60, Math.round(10 + speed * big * 170));
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const out = (0.35 + Math.random() * 0.9) * Math.min(speed, 5) * 0.35;
      const up = (0.6 + Math.random()) * Math.sqrt(speed) * 0.9;
      drops.push({
        p: [b.p[0] + Math.cos(a) * big, 0.01, b.p[2] + Math.sin(a) * big],
        v: [Math.cos(a) * out + b.v[0] * 0.15, up, Math.sin(a) * out + b.v[2] * 0.15],
        size: 0.006 + Math.random() * 0.012 * (0.5 + big * 6),
        life: 1,
      });
    }
    // the jet that comes back up after anything heavy
    if (b.density > 1) {
      const x = b.p[0];
      const z = b.p[2];
      later.push({
        at: simTime + 0.16,
        fn: () => {
          for (let k = 0; k < 7; k++)
            drops.push({
              p: [x + (Math.random() - 0.5) * 0.02, 0.01, z + (Math.random() - 0.5) * 0.02],
              v: [(Math.random() - 0.5) * 0.25, 1.2 + Math.random() * 0.9 * Math.sqrt(speed), (Math.random() - 0.5) * 0.25],
              size: 0.008 + Math.random() * 0.01,
              life: 1,
            });
        },
      });
    }
    while (drops.length > MAX_DROPS) drops.shift();
  };

  const physics = (dt: number) => {
    const g = 9.8;
    const sub = 4;
    const h = dt / sub;
    for (const b of bodies) b.prev = [...b.p];
    for (let s = 0; s < sub; s++) {
      for (const b of bodies) {
        const wasIn = Math.abs(b.p[0]) < pool.PX && Math.abs(b.p[2]) < pool.PZ;
        // no water over the deck
        const [hw, gx, gz] = wasIn ? waterAt(b) : [-10, 0, 0];
        if (b.kind === "petal") {
          const above = b.p[1] - hw;
          if (above > 0.004) {
            // flutter down
            b.v[1] -= g * h;
            const drag = Math.exp(-7 * h);
            b.v = [b.v[0] * drag + Math.sin(simTime * 4 + b.seed * 30) * 0.9 * h, b.v[1] * drag, b.v[2] * drag + Math.cos(simTime * 3.3 + b.seed * 20) * 0.9 * h];
            b.q = qnorm(qmul(qaxis(b.w[0], b.w[1], b.w[2], Math.hypot(...b.w) * h), b.q));
          } else {
            if (!b.wet) {
              b.wet = true;
              imps.push([b.p[0], b.p[2], 0.04, 0.0015]);
            }
            // ride the surface, slide down its slopes, lie flat on it
            b.v[1] += (-above * 900 - b.v[1] * 40) * h;
            b.v[0] += -g * gx * 0.5 * h;
            b.v[2] += -g * gz * 0.5 * h;
            const drag = Math.exp(-1.2 * h);
            b.v[0] *= drag;
            b.v[2] *= drag;
            const up = qrot(b.q, [0, 1, 0]);
            const n: V3 = [-gx, 1, -gz];
            const nl = Math.hypot(...n);
            const ax: V3 = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
            const sa = Math.hypot(...ax) / nl;
            const flip = up[1] * n[1] + up[0] * n[0] + up[2] * n[2] < 0;
            if (sa > 1e-5 || flip) {
              const ang = flip ? Math.PI - Math.asin(Math.min(1, sa)) : Math.asin(Math.min(1, sa));
              b.q = qnorm(qmul(qaxis(ax[0] || 1, ax[1], ax[2], ang * Math.min(1, 10 * h)), b.q));
            }
            b.q = qnorm(qmul(qaxis(0, 1, 0, (b.seed - 0.5) * 0.6 * h), b.q));
          }
        } else {
          const R = (b.r * (b.s[0] + b.s[1] + b.s[2])) / 3;
          const depth = hw - b.p[1];
          const hs = Math.max(0, Math.min(2 * R, R + depth));
          const frac = (hs * hs * (3 * R - hs)) / (4 * R * R * R);
          if (!b.wet && b.p[1] - R * b.s[1] < hw && b.v[1] < -0.6) {
            splash(b, -b.v[1]);
            // the slap of hitting the water takes most of the speed
            const k = b.density < 1 ? 0.3 : 0.6;
            b.v = [b.v[0] * k, b.v[1] * (b.density < 1 ? 0.25 : 0.7), b.v[2] * k];
          }
          b.wet = b.p[1] - R * b.s[1] < hw;
          b.v[1] += (-g + (g * frac) / b.density) * h;
          b.v[0] += -g * gx * frac * 0.6 * h;
          b.v[2] += -g * gz * frac * 0.6 * h;
          // floats are near critically damped up and down (their bob is a stiff spring), sinkers slow alike
          const dv = Math.exp(-(frac * (b.density < 1 ? 22 : 4) + 0.05) * h);
          const dl = Math.exp(-(frac * (b.density < 1 ? 4 : 4) + 0.05) * h);
          b.v = [b.v[0] * dl, b.v[1] * dv, b.v[2] * dl];
          // a float pops up, it does not leap out
          if (b.density < 1 && frac > 0) b.v[1] = Math.min(b.v[1], 1.1);
          const spin = Math.exp(-(frac * 2.5 + 0.1) * h);
          b.w = [b.w[0] * spin, b.w[1] * spin, b.w[2] * spin];
          b.q = qnorm(qmul(qaxis(b.w[0], b.w[1], b.w[2], Math.hypot(...b.w) * h), b.q));
        }
        b.p = [b.p[0] + b.v[0] * h, b.p[1] + b.v[1] * h, b.p[2] + b.v[2] * h];
        // the floor and the walls inside, the deck outside
        const ry = b.kind === "petal" ? 0.002 : b.r * b.s[1];
        const rx = b.kind === "petal" ? b.r * 0.7 : b.r * Math.max(b.s[0], b.s[2]);
        if (wasIn) {
          if (b.p[1] < -pool.D + ry) {
            b.p[1] = -pool.D + ry;
            if (b.v[1] < 0) b.v[1] *= -0.2;
            const f = Math.exp(-(b.kind === "stone" ? 14 : b.kind === "marble" ? 1.2 : 4) * h);
            b.v[0] *= f;
            b.v[2] *= f;
            // marbles roll
            if (b.kind === "marble") b.w = [b.v[2] / b.r, b.w[1] * f, -b.v[0] / b.r];
            else b.w = [b.w[0] * f * f, b.w[1] * f, b.w[2] * f * f];
          }
          if (b.p[1] < pool.RIM + ry) {
            for (const [i, lim] of [
              [0, pool.PX - rx],
              [2, pool.PZ - rx],
            ] as const) {
              if (Math.abs(b.p[i]) > lim) {
                b.p[i] = Math.sign(b.p[i]) * lim;
                if (b.v[i] * Math.sign(b.p[i]) > 0) b.v[i] *= -0.4;
              }
            }
          }
        } else if (b.p[1] < pool.RIM + ry) {
          b.p[1] = pool.RIM + ry;
          if (b.v[1] < 0) b.v[1] *= -0.3;
          const f = Math.exp(-6 * h);
          b.v[0] *= f;
          b.v[2] *= f;
          b.w = [b.w[0] * f, b.w[1] * f, b.w[2] * f];
        }
      }
      // bump into each other (petals only push petals a little)
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i];
          const c = bodies[j];
          if ((a.kind === "petal") !== (c.kind === "petal")) continue;
          const ra = a.kind === "petal" ? a.r * 0.7 : a.r * Math.max(...a.s) * 0.9;
          const rc = c.kind === "petal" ? c.r * 0.7 : c.r * Math.max(...c.s) * 0.9;
          const dx = c.p[0] - a.p[0];
          const dy = a.kind === "petal" ? 0 : c.p[1] - a.p[1];
          const dz = c.p[2] - a.p[2];
          const d = Math.hypot(dx, dy, dz);
          const overlap = ra + rc - d;
          if (overlap <= 0 || d < 1e-6) continue;
          const nx = dx / d;
          const ny = dy / d;
          const nz = dz / d;
          const ma = a.density * a.r ** 3;
          const mc = c.density * c.r ** 3;
          const wa = mc / (ma + mc);
          const wc = ma / (ma + mc);
          a.p = [a.p[0] - nx * overlap * wa, a.p[1] - ny * overlap * wa, a.p[2] - nz * overlap * wa];
          c.p = [c.p[0] + nx * overlap * wc, c.p[1] + ny * overlap * wc, c.p[2] + nz * overlap * wc];
          const rv = (c.v[0] - a.v[0]) * nx + (c.v[1] - a.v[1]) * ny + (c.v[2] - a.v[2]) * nz;
          if (rv < 0) {
            const j2 = -1.3 * rv;
            a.v = [a.v[0] - nx * j2 * wa, a.v[1] - ny * j2 * wa, a.v[2] - nz * j2 * wa];
            c.v = [c.v[0] + nx * j2 * wc, c.v[1] + ny * j2 * wc, c.v[2] + nz * j2 * wc];
          }
        }
      }
    }
    // gone over the edge or never landed
    for (let i = bodies.length - 1; i >= 0; i--) if (bodies[i].p[1] < -5 || Math.abs(bodies[i].p[0]) > 20) bodies.splice(i, 1);

    // drops fly, and ring the water where they land
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.v[1] -= g * dt;
      d.p = [d.p[0] + d.v[0] * dt, d.p[1] + d.v[1] * dt, d.p[2] + d.v[2] * dt];
      const inPool = Math.abs(d.p[0]) < pool.PX && Math.abs(d.p[2]) < pool.PZ;
      if (d.v[1] < 0 && d.p[1] < (inPool ? 0 : pool.RIM)) {
        if (inPool && imps.length < MAX_IMP - 8) imps.push([d.p[0], d.p[2], 0.012 + d.size, d.size * 0.12]);
        d.life -= 0.34;
        if (!inPool) d.v = [d.v[0] * 0.3, Math.abs(d.v[1]) * 0.15, d.v[2] * 0.3];
        if (inPool || d.life <= 0) drops.splice(i, 1);
      }
    }
    for (let i = later.length - 1; i >= 0; i--) {
      if (later[i].at <= simTime) {
        later[i].fn();
        later.splice(i, 1);
      }
    }
  };

  // a ball already afloat and a few petals, so the pool is never quite empty to begin with
  spawn("ball", [-0.75, 0.05, -0.35], [0, 0, 0]).wet = true;
  for (let k = 0; k < 6; k++) spawn("petal", [0.35 + Math.random() * 0.7, 0.002, -0.2 + Math.random() * 0.6], [0, 0, 0]).wet = true;

  // ---------------------------------------------------------------- the hand
  const kindButtons = [...document.querySelectorAll<HTMLButtonElement>("#tray button")];
  let selected: Kind = "ball";
  const select = (k: string) => {
    if (k === "clear") {
      bodies.length = 0;
      drops.length = 0;
      calm = 1;
      return;
    }
    selected = k as Kind;
    for (const b of kindButtons) b.classList.toggle("on", b.dataset.kind === k);
  };
  const onTray = (e: MouseEvent) => {
    const b = (e.target as HTMLElement).closest("button");
    if (b?.dataset.kind) select(b.dataset.kind);
  };
  document.querySelector("#tray")?.addEventListener("click", onTray as EventListener);
  const onKey = (e: KeyboardEvent) => {
    const k = ["ball", "stone", "marble", "petal"][+e.key - 1];
    if (k) select(k);
  };
  window.addEventListener("keydown", onKey);
  const hint = document.querySelector<HTMLElement>("#hint");

  /** where a screen point looks onto the still water */
  const pick = (cx: number, cy: number): [number, number] | null => {
    const rect = canvas.getBoundingClientRect();
    const nx = ((cx - rect.left) / rect.width) * 2 - 1;
    const ny = 1 - ((cy - rect.top) / rect.height) * 2;
    const cam = camera();
    const asp = rect.width / rect.height;
    const d = [0, 1, 2].map((i) => cam.f[i] + cam.r[i] * nx * cam.tan * asp + cam.u[i] * ny * cam.tan);
    if (d[1] >= -1e-4) return null;
    const t = -cam.pos[1] / d[1];
    return [cam.pos[0] + d[0] * t, cam.pos[2] + d[2] * t];
  };
  let down: { x: number; y: number; t: number; moved: boolean; last: [number, number] | null } | null = null;
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, last: pick(e.clientX, e.clientY) };
  };
  const onMove = (e: PointerEvent) => {
    if (!down) return;
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) down.moved = true;
    if (!down.moved) return;
    const p = pick(e.clientX, e.clientY);
    if (!p || !down.last) {
      down.last = p;
      return;
    }
    // a finger through the water: pokes along the way, deeper the faster it goes
    const [x0, z0] = down.last;
    const len = Math.hypot(p[0] - x0, p[1] - z0);
    const n = Math.min(12, Math.ceil(len / 0.03));
    for (let k = 1; k <= n && imps.length < MAX_IMP; k++) {
      const x = x0 + ((p[0] - x0) * k) / n;
      const z = z0 + ((p[1] - z0) * k) / n;
      if (Math.abs(x) < pool.PX && Math.abs(z) < pool.PZ) imps.push([x, z, 0.05, Math.min(0.012, (len / n) * 0.35)]);
    }
    down.last = p;
  };
  const onUp = (e: PointerEvent) => {
    if (down && !down.moved && performance.now() - down.t < 600) {
      const p = pick(e.clientX, e.clientY);
      if (p) {
        throwAt(selected, p[0], p[1]);
        if (hint) hint.style.opacity = "0";
      }
    }
    down = null;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  // ---------------------------------------------------------------- panel
  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0;";
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "pool" });
  gui.close();
  const fw = gui.addFolder("water");
  fw.add(water, "waves", 0, 3, 0.01).name("breeze ripples");
  fw.add(water, "view", 0, 1, 0.01).name("view wobble");
  fw.add(water, "damp", 0.97, 0.999, 0.001).name("ring life");
  fw.add(water, "displace", 0, 2, 0.01).name("push");
  fw.add(look, "absorb", 0, 3, 0.01).name("depth tint");
  const fl = gui.addFolder("sun");
  fl.add(light, "elevation", 30, 89, 0.5);
  fl.add(light, "azimuth", 0, 360, 1);
  const fk = gui.addFolder("look");
  fk.add(look, "lineLo", 0.5, 4, 0.01).name("line from");
  fk.add(look, "lineHi", 0.6, 6, 0.01).name("line full");
  fk.add(look, "lineMix", 0, 1, 0.01).name("line white");
  fk.add(look, "glow", 0, 2, 0.01);
  fk.add(look, "amb", 0, 1, 0.01).name("shade");
  fk.add(look, "diffuse", 0, 1, 0.01).name("light");
  fk.add(look, "blur", 0, 4, 0.05).name("line softness");
  fk.add(look, "stoneScale", 1, 10, 0.1).name("stones");
  fk.add(look, "starSize", 0, 60, 1).name("glint size");
  fk.add(look, "spark0", 0.98, 0.9999, 0.0001).name("glints");
  const fv = gui.addFolder("view");
  fv.add(view, "elevation", 20, 89, 0.5);
  fv.add(view, "distance", 2, 8, 0.01);
  fv.add(view, "fov", 15, 70, 0.5);
  for (const f of [fw, fl, fk, fv]) f.close();

  // ---------------------------------------------------------------- a frame
  let frame = 0;
  const clock = { paused: false };
  const step = (dt: number) => {
    simTime += dt;
    physics(dt);

    const W = canvas.width;
    const H = canvas.height;
    const cam = camera();
    const { S, dm } = sun();
    if (calm > 0) {
      const zero = new Float32Array(cells * 2);
      device.queue.writeBuffer(stateA, 0, zero);
      device.queue.writeBuffer(stateB, 0, zero);
      calm = 0;
    }
    setU({
      time: simTime,
      nObj: bodies.length,
      nImp: Math.min(imps.length, MAX_IMP),
      PX: pool.PX,
      PZ: pool.PZ,
      D: pool.D,
      RIM: pool.RIM,
      coping: pool.coping,
      cell: (2 * pool.PX) / pool.nx,
      nx: pool.nx,
      nz: pool.nz,
      stiff: water.stiff,
      damp: water.damp,
      displace: water.displace,
      visc: water.visc,
      waveAmp: water.waves,
      viewBend: water.view,
      sunX: S[0],
      sunY: S[1],
      sunZ: S[2],
      dmX: dm[0],
      dmY: dm[1],
      dmZ: dm[2],
      camX: cam.pos[0],
      camY: cam.pos[1],
      camZ: cam.pos[2],
      fX: cam.f[0],
      fY: cam.f[1],
      fZ: cam.f[2],
      rX: cam.r[0],
      rY: cam.r[1],
      rZ: cam.r[2],
      uX: cam.u[0],
      uY: cam.u[1],
      uZ: cam.u[2],
      tanFov: cam.tan,
      aspect: W / H,
      W,
      H,
      dpr: W / canvas.getBoundingClientRect().width || 1,
      mx: caustic.mx,
      mz: caustic.mz,
      cMinX,
      cMinZ,
      cSizeX,
      cSizeZ,
      cmax: look.cmax,
      blur: look.blur,
      glowSigma: look.glowSigma,
      glowFloor: look.glowFloor,
      amb: look.amb,
      diffuse: look.diffuse,
      clampLit: look.clampLit,
      lineLo: look.lineLo,
      lineHi: Math.max(look.lineHi, look.lineLo + 0.01),
      lineMix: look.lineMix,
      glow: look.glow,
      absorb: look.absorb,
      stoneScale: look.stoneScale,
      spec0: look.spec0,
      spec1: look.spec1,
      specW: look.specW,
      spark0: look.spark0,
      spark1: Math.max(look.spark1, look.spark0 + 1e-4),
      starSize: look.starSize,
      starsX: 48,
      starsN: 48 * 32,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);
    bodies.forEach((b, i) => {
      objData.set([...b.p, b.r, ...b.q, ...b.prev, KINDS[b.kind].id, ...b.s, b.seed], i * 16);
    });
    if (bodies.length) device.queue.writeBuffer(objBuf, 0, objData, 0, bodies.length * 16);
    // where each one can show on screen: a box round its bounding sphere, and round where it seems to be
    // from above the water (raised, and a little wider for the waves), both together
    bodies.forEach((b, i) => {
      const R = b.r * Math.max(...b.s) + 0.01;
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      const add = (y: number, rad: number) => {
        const v = [b.p[0] - cam.pos[0], y - cam.pos[1], b.p[2] - cam.pos[2]];
        const z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
        const zn = z - rad;
        if (zn < 0.05) {
          box.splice(0, 4, -9, -9, 9, 9);
          return;
        }
        const x = (v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2]) / (zn * cam.tan * (W / H));
        const y2 = (v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2]) / (zn * cam.tan);
        const rx = rad / (zn * cam.tan * (W / H));
        const ry = rad / (zn * cam.tan);
        box[0] = Math.min(box[0], x - rx);
        box[1] = Math.min(box[1], y2 - ry);
        box[2] = Math.max(box[2], x + rx);
        box[3] = Math.max(box[3], y2 + ry);
      };
      add(b.p[1], R);
      if (b.p[1] - R < 0.05) add(b.p[1] * 0.45, R * 1.2 + 0.08);
      boundData.set(box, i * 4);
    });
    if (bodies.length) device.queue.writeBuffer(boundBuf, 0, boundData, 0, bodies.length * 4);
    const nImp = Math.min(imps.length, MAX_IMP);
    imps.slice(0, nImp).forEach((m, i) => impData.set(m, i * 4));
    if (nImp) device.queue.writeBuffer(impBuf, 0, impData, 0, nImp * 4);
    imps.length = 0;
    const nDrops = Math.min(drops.length, MAX_DROPS);
    drops.slice(0, nDrops).forEach((d, i) => dropData.set([...d.p, d.size, ...d.v, d.life], i * 8));
    if (nDrops) device.queue.writeBuffer(dropBuf, 0, dropData, 0, nDrops * 8);

    const encoder = device.createCommandEncoder();
    const sx = Math.ceil(pool.nx / 8);
    const sz = Math.ceil(pool.nz / 8);
    let cp = encoder.beginComputePass();
    if (!(dbg.skip & 1)) {
      cp.setBindGroup(0, simAB);
      cp.setPipeline(disturbPipe);
      cp.dispatchWorkgroups(sx, sz);
      // an even number of steps, A to B and back
      for (let k = 0; k < water.substeps; k++) {
        cp.setBindGroup(0, k % 2 ? simBA : simAB);
        cp.setPipeline(stepPipe);
        cp.dispatchWorkgroups(sx, sz);
      }
      cp.setBindGroup(0, simBA);
      cp.setPipeline(surfacePipe);
      cp.dispatchWorkgroups(sx, sz);
      if (bodies.length) {
        cp.setPipeline(probePipe);
        cp.dispatchWorkgroups(Math.ceil(bodies.length / 64));
      }
    }
    if (!(dbg.skip & 2)) {
      cp.setBindGroup(0, raysGroup);
      cp.setPipeline(raysPipe);
      cp.dispatchWorkgroups(Math.ceil(nVerts / 64));
    }
    cp.end();

    const mp = encoder.beginRenderPass({ colorAttachments: [{ view: causRaw.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
    mp.setPipeline(meshPipe);
    mp.setBindGroup(0, meshGroup);
    mp.setIndexBuffer(indexBuf, "uint32");
    if (!(dbg.skip & 4)) mp.drawIndexed(indices.length);
    mp.end();

    cp = encoder.beginComputePass();
    const blurPass = (pipe: GPUComputePipeline, group: GPUBindGroup, w: number, h: number) => {
      cp.setPipeline(pipe);
      cp.setBindGroup(0, group);
      cp.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
    };
    if (!(dbg.skip & 8)) {
      blurPass(kdeH, blurs.h, cw, ch);
      blurPass(kdeV, blurs.v, cw, ch);
      blurPass(down4, blurs.down, gw, gh);
      blurPass(glowH, blurs.gh, gw, gh);
      blurPass(glowV, blurs.gv, gw, gh);
    }
    cp.end();

    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    pass.setPipeline(scenePipe);
    pass.setBindGroup(0, sceneGroup);
    if (!(dbg.skip & 16)) pass.draw(3);
    pass.setBindGroup(0, spriteGroup);
    pass.setPipeline(starPipe);
    if (!(dbg.skip & 32)) pass.draw(4, 48 * 32);
    if (nDrops) {
      pass.setPipeline(dropPipe);
      pass.draw(4, nDrops);
    }
    pass.end();

    const readIds = bodies.map((b) => b.id);
    const doProbe = !probeBusy && readIds.length > 0;
    if (doProbe) encoder.copyBufferToBuffer(probeBuf, 0, probeRead, 0, readIds.length * 16);
    device.queue.submit([encoder.finish()]);
    if (doProbe) {
      probeBusy = true;
      probeRead
        .mapAsync(GPUMapMode.READ, 0, readIds.length * 16)
        .then(() => {
          const a = new Float32Array(probeRead.getMappedRange(0, readIds.length * 16).slice(0));
          probeRead.unmap();
          probes.clear();
          readIds.forEach((id, i) => probes.set(id, [a[i * 4], a[i * 4 + 1], a[i * 4 + 2]]));
          probeBusy = false;
        })
        .catch(() => (probeBusy = false));
    }
    frame++;
  };

  (window as any).__pool = {
    dbg,
    pool,
    water,
    light,
    look,
    view,
    clock,
    bodies,
    drops,
    get pendingImps() {
      return imps.length;
    },
    throwAt,
    drop: (kind: Kind, x: number, y: number, z: number) => spawn(kind, [x, y, z], [0, 0, 0]),
    calm: () => select("clear"),
    get frame() {
      return frame;
    },
    /** run the world on by `seconds` at 60 steps a second, without the render loop */
    advance: async (seconds: number) => {
      clock.paused = true;
      const n = Math.round(seconds * 60);
      for (let k = 0; k < n; k++) {
        step(1 / 60);
        if (k % 3 === 2) await device.queue.onSubmittedWorkDone();
      }
      await device.queue.onSubmittedWorkDone();
    },
    bench: async (frames = 30) => {
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
    document.querySelector("#tray")?.removeEventListener("click", onTray as EventListener);
    window.removeEventListener("keydown", onKey);
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
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
