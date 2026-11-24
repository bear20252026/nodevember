/**
 * Tunnel: a flight down a winding tunnel of rippled sand, lit by caustics on every side. There is no water
 * surface: the wall unrolled is a flat sheet, and a rippling sheet of light a little above it is bent onto it
 * as a pool's surface bends the sun onto its floor. The sand is made once on the GPU (phasor-noise ripples and
 * dunes, rocks); the caustics are a grid of light redrawn every frame, landing on the sand's real height.
 *
 * Rapana shells lie on the sand and small schools of grey mullet keep close over it, all the way round: the wall is
 * the sea bottom here; schools of hamsa go through the open water (life.ts, life.wgsl). The light shows in the
 * water too, as shafts gathering toward the bright lines on the sand (shaft.wgsl).
 *
 * Drag to look round, double click to look ahead again, wheel to fly faster or slower, space to stop.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { PerspectiveCamera, Vector3 } from "three";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import blitCode from "./blit.wgsl?raw";
import commonCode from "./common.wgsl?raw";
import { FISH, INST, VERT, inLoop, loadShell, makeAnchovy, makeFish, makeSchools, makeShoals, scatterGrass, scatterShells, shoal, swim } from "./life";
import lifeCode from "./life.wgsl?raw";
import lightCode from "./light.wgsl?raw";
import postCode from "./post.wgsl?raw";
import sceneCode from "./scene.wgsl?raw";
import shaftCode from "./shaft.wgsl?raw";
import terrainCode from "./terrain.wgsl?raw";

// the tunnel: radius 1, three times as long as it is round before it repeats; maps with square texels
const R = 1;
const TURNS = 3;
const L = 2 * Math.PI * R * TURNS;
const W = 1024;
const H = W * TURNS;
const CW = 1536;
const CH = CW * TURNS;
const HEIGHT_MIPS = 5;
const CAUSTIC_MIPS = 6;
// the wall: rings a texel apart near the eye, twice as far in each band after
const COLS = 1024;
const BANDS = 4;
const PER_BAND = 256;
// and a coarse band behind the eye, for looking round: 64 rings four texels apart
const BACK_ROWS = 64;
// the light mesh: a point of light a texel, with a margin round the seam so nothing is lost across it
const LCOLS = 1024;
const LMARGIN = 56;
const LROWS_MAX = Math.ceil(15 / (L / H));
const MAX_WAVES = 32;

const sand = {
  ripples: 215,
  height: 0.0095,
  // (against the light's lean: the long gentle face of each ripple looks toward the light, the short steep one away)
  lean: -0.65,
  loose: 0.55,
  wander: 0.14,
  vary: 0.05,
  dunes: 0.26,
  duneCount: 9,
  swell: 0.09,
  rocks: 0.3,
  rockSize: 0.24,
  seed: 1,
};
const light = {
  depth: 0.55,
  lean: 0.55,
  waves: 0.055,
  waveSize: 0.4,
  count: 24,
  speed: 1,
  spread: 0.06,
  colours: true,
  strength: 1,
  brightest: 40,
  soften: 0.8,
  reach: 11,
  seed: 2,
};
const look = {
  exposure: 1,
  bloom: 0.5,
  threshold: 1.1,
  vignette: 0.35,
  fog: 0.36,
  hazeFrom: 1.1,
  water: [0.13, 0.5, 0.66] as [number, number, number],
  deep: [0.02, 0.2, 0.46] as [number, number, number],
  redLoss: 1,
  sand: [0.84, 0.68, 0.46] as [number, number, number],
  around: 0.24,
  sun: 0.85,
  shade: 0.75,
  warmth: 0.6,
  sparkle: 0.6,
  rockRough: 1.2,
  specks: 0.3,
  speckLit: 0,
  // the shafts of light in the water: off unless asked for (they made the picture too busy)
  shafts: 0,
  shaftSoft: 1.5,
  shaftUp: 0.7,
  msaa: true,
};
// (`loop`: seconds in which everything comes round to where it began, the eye having gone one length of the tunnel;
// none, and nothing is held to it. `?loop=30` in the address sets it.)
const view = { along: 0, speed: 0.6, hold: false, fov: 64, sway: 1, windX: 0.8, windFine: 0.2, windY: 0.45, loop: Math.max(0, +(new URLSearchParams(location.search).get("loop") ?? 0) || 0) };
const life = { shells: 14, crawl: 0.004, schools: 8, hamsa: 3, hamsaEach: 260, grass: 3500, grassTall: 0.34, sway: 1, current: 1, seed: 4 };
const MAX_PLANTS = 9000;
const MAX_LEAVES = MAX_PLANTS * 9;
const MAX_SHELLS = 64;
const MAX_FISH = 64;
const MAX_SMALL = 2400;
const pose = { yaw: 0, pitch: 0 };
// passes to leave out, for timing them (tools/tunnel-prof.mjs)
const skip = { waves: false, land: false, light: false, wall: false, life: false, shafts: false, bloom: false };

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
    const module = device.createShaderModule({ code, label });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) if (m.type === "error") console.error(`${label} wgsl ${m.lineNum}:${m.linePos} ${m.message}`);
    });
    return module;
  };
  const HDR: GPUTextureFormat = "rgba16float";
  const TU = GPUTextureUsage;
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };

  const uni = new Float32Array(100 + MAX_WAVES * 8);
  const uniBuf = device.createBuffer({ size: uni.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const ub = { binding: 0, resource: { buffer: uniBuf } };
  const wrapSmp = device.createSampler({ magFilter: "linear", minFilter: "linear", mipmapFilter: "linear", addressModeU: "repeat", addressModeV: "repeat", maxAnisotropy: 8 });
  const clampSmp = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  // ---------------------------------------------------------------- the sand's maps
  const rawTex = device.createTexture({ size: [W, H], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const mapUse = TU.STORAGE_BINDING | TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT;
  const heightTex = device.createTexture({ size: [W, H], format: HDR, mipLevelCount: HEIGHT_MIPS, usage: mapUse | TU.COPY_SRC });
  const auxTex = device.createTexture({ size: [W, H], format: HDR, mipLevelCount: HEIGHT_MIPS, usage: mapUse });
  const causticTex = device.createTexture({ size: [CW, CH], format: HDR, mipLevelCount: CAUSTIC_MIPS, usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const causticRaw = device.createTexture({ size: [CW, CH], format: HDR, usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const level = (t: GPUTexture, k: number) => t.createView({ baseMipLevel: k, mipLevelCount: 1 });

  const terrain = compile(commonCode + terrainCode, "terrain");
  const heightsL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
    ],
  });
  const bakeL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
    ],
  });
  const heightsPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [heightsL] }), compute: { module: terrain, entryPoint: "heights" } });
  const bakePipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [bakeL] }), compute: { module: terrain, entryPoint: "bake" } });
  const heightsGroup = device.createBindGroup({ layout: heightsL, entries: [ub, { binding: 1, resource: rawTex.createView() }] });
  const bakeGroup = device.createBindGroup({
    layout: bakeL,
    entries: [ub, { binding: 2, resource: rawTex.createView() }, { binding: 3, resource: wrapSmp }, { binding: 4, resource: level(heightTex, 0) }, { binding: 5, resource: level(auxTex, 0) }],
  });

  // halving, for the maps' mip chains
  const blit = compile(blitCode, "blit");
  const blitL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
    ],
  });
  const blitPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blitL] }),
    vertex: { module: blit, entryPoint: "vs" },
    fragment: { module: blit, entryPoint: "fs", targets: [{ format: HDR }] },
  });
  const softPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blitL] }),
    vertex: { module: blit, entryPoint: "vs" },
    fragment: { module: blit, entryPoint: "fsSoft", targets: [{ format: HDR }] },
  });
  const halfSoftPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blitL] }),
    vertex: { module: blit, entryPoint: "vs" },
    fragment: { module: blit, entryPoint: "fsHalfSoft", targets: [{ format: HDR }] },
  });
  const tileSmp = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "repeat", addressModeV: "repeat" });
  const softGroup = device.createBindGroup({
    layout: blitL,
    entries: [
      { binding: 0, resource: causticRaw.createView() },
      { binding: 1, resource: tileSmp },
    ],
  });
  // the sand as the light mesh sees it: the heights at half size, blurred wide
  const proxyTex = device.createTexture({ size: [W / 2, H / 2], format: HDR, usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const proxyTmp = device.createTexture({ size: [W / 2, H / 2], format: HDR, usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const gaussPipe = (entryPoint: string) =>
    device.createRenderPipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [blitL] }), vertex: { module: blit, entryPoint: "vs" }, fragment: { module: blit, entryPoint, targets: [{ format: HDR }] } });
  const gaussX = gaussPipe("fsGaussX");
  const gaussY = gaussPipe("fsGaussY");
  const chain = (t: GPUTexture, levels: number, smp = clampSmp) =>
    Array.from({ length: levels - 1 }, (_, k) => ({
      to: level(t, k + 1),
      from: device.createBindGroup({
        layout: blitL,
        entries: [
          { binding: 0, resource: level(t, k) },
          { binding: 1, resource: smp },
        ],
      }),
    }));
  const heightChain = chain(heightTex, HEIGHT_MIPS);
  const blurSteps = [
    {
      pipe: gaussX,
      to: proxyTmp.createView(),
      from: device.createBindGroup({
        layout: blitL,
        entries: [
          { binding: 0, resource: level(heightTex, 1) },
          { binding: 1, resource: tileSmp },
        ],
      }),
    },
    {
      pipe: gaussY,
      to: proxyTex.createView(),
      from: device.createBindGroup({
        layout: blitL,
        entries: [
          { binding: 0, resource: proxyTmp.createView() },
          { binding: 1, resource: tileSmp },
        ],
      }),
    },
  ];
  const auxChain = chain(auxTex, HEIGHT_MIPS);
  // (the caustic map's smaller copies are halved softly, and wrap as the map does: the shafts of light read them close)
  const causticChain = chain(causticTex, CAUSTIC_MIPS, tileSmp);
  const halve = (enc: GPUCommandEncoder, steps: { to: GPUTextureView; from: GPUBindGroup }[], pipe = blitPipe) => {
    for (const s of steps) {
      const p = enc.beginRenderPass({ colorAttachments: [{ view: s.to, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      p.setPipeline(pipe);
      p.setBindGroup(0, s.from);
      p.draw(3);
      p.end();
    }
  };

  // ---------------------------------------------------------------- the light mesh
  const strips = (cols: number, rows: number) => {
    const per = 2 * (cols + 1) + 1;
    const idx = new Uint32Array(rows * per);
    for (let r = 0, o = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        idx[o++] = r * (cols + 1) + c;
        idx[o++] = (r + 1) * (cols + 1) + c;
      }
      idx[o++] = 0xffffffff;
    }
    const buf = device.createBuffer({ size: idx.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint32Array(buf.getMappedRange()).set(idx);
    buf.unmap();
    return { buf, per };
  };
  const lightCols = LCOLS + 2 * LMARGIN;
  const lightIdx = strips(lightCols, LROWS_MAX);
  const WALL_ROWS = BACK_ROWS + BANDS * PER_BAND;
  const wallIdx = strips(COLS, WALL_ROWS);

  const lightL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: VF, buffer: { type: "uniform" } },
      { binding: 6, visibility: GPUShaderStage.VERTEX, texture: { sampleType: "unfilterable-float" } },
    ],
  });
  // where each point of the mesh lands, found in a compute pass
  const landL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: "rgba32float", access: "write-only" } },
      { binding: 8, visibility: GPUShaderStage.COMPUTE, texture: {} },
    ],
  });
  const landTex = device.createTexture({ size: [LCOLS + 2 * LMARGIN + 1, LROWS_MAX + 1], format: "rgba32float", usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  // the waves' slopes over the stretch the mesh covers, summed once a frame at half the mesh's fineness
  const sheetL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
      { binding: 7, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
    ],
  });
  const curveTex = device.createTexture({ size: [LCOLS / 2, Math.ceil(LROWS_MAX / 2) + 2], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const sheetTex = device.createTexture({ size: [LCOLS / 2, Math.ceil(LROWS_MAX / 2) + 2], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
  const lightMod = compile(commonCode + lightCode, "light");
  const lightPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [lightL] }),
    vertex: { module: lightMod, entryPoint: "vsLight" },
    fragment: { module: lightMod, entryPoint: "fsLight", targets: [{ format: HDR, blend: add }] },
    primitive: { topology: "triangle-strip", stripIndexFormat: "uint32", cullMode: "none" },
  });
  const sheetPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [sheetL] }), compute: { module: lightMod, entryPoint: "sheet" } });
  const sheetGroup = device.createBindGroup({ layout: sheetL, entries: [ub, { binding: 3, resource: sheetTex.createView() }, { binding: 7, resource: curveTex.createView() }] });
  const landPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [landL] }), compute: { module: lightMod, entryPoint: "land" } });
  const landGroup = device.createBindGroup({
    layout: landL,
    entries: [
      ub,
      { binding: 1, resource: proxyTex.createView() },
      { binding: 2, resource: tileSmp },
      { binding: 4, resource: sheetTex.createView() },
      { binding: 5, resource: landTex.createView() },
      { binding: 8, resource: curveTex.createView() },
    ],
  });
  const lightGroup = device.createBindGroup({ layout: lightL, entries: [ub, { binding: 6, resource: landTex.createView() }] });

  // ---------------------------------------------------------------- the wall and the specks
  // what lives here: a shell and a fish, each drawn many times; and a map of the wall for their shadows
  const lifeMod = compile(commonCode + lifeCode, "life");
  const meshBuffers = (m: { verts: Float32Array; idx: Uint32Array }) => {
    const vb = device.createBuffer({ size: m.verts.byteLength, usage: GPUBufferUsage.VERTEX, mappedAtCreation: true });
    new Float32Array(vb.getMappedRange()).set(m.verts);
    vb.unmap();
    const ib = device.createBuffer({ size: m.idx.byteLength, usage: GPUBufferUsage.INDEX, mappedAtCreation: true });
    new Uint32Array(ib.getMappedRange()).set(m.idx);
    ib.unmap();
    return { vb, ib, count: m.idx.length };
  };
  const shellModel = await loadShell("./rapan.glb");
  const shellBuf = meshBuffers(shellModel);
  const shellTex = device.createTexture({
    size: [shellModel.pictures[0].width, shellModel.pictures[0].height],
    format: "rgba8unorm-srgb",
    mipLevelCount: shellModel.pictures.length,
    usage: TU.TEXTURE_BINDING | TU.COPY_DST | TU.RENDER_ATTACHMENT,
  });
  shellModel.pictures.forEach((source, mipLevel) => device.queue.copyExternalImageToTexture({ source }, { texture: shellTex, mipLevel }, [source.width, source.height]));
  const fishBuf = meshBuffers(makeFish());
  const smallBuf = meshBuffers(makeAnchovy());
  const instBuffer = (n: number) => device.createBuffer({ size: n * INST * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const shellInst = instBuffer(MAX_SHELLS);
  const fishInst = device.createBuffer({ size: MAX_FISH * FISH * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const smallInst = device.createBuffer({ size: MAX_SMALL * FISH * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
  const smallData = new Float32Array(MAX_SMALL * FISH);
  const blobInst = instBuffer(MAX_PLANTS + MAX_SHELLS + MAX_FISH + MAX_SMALL);
  const grassInst = instBuffer(MAX_LEAVES);
  const shellData = new Float32Array(MAX_SHELLS * INST);
  const fishData = new Float32Array(MAX_FISH * FISH);
  // (the animals' shadows, rewritten every frame; the plants' sit before them in the buffer, written once)
  const blobData = new Float32Array((MAX_SHELLS + MAX_FISH + MAX_SMALL) * INST);
  const instLayout: GPUVertexBufferLayout = {
    arrayStride: INST * 4,
    stepMode: "instance",
    attributes: [
      { shaderLocation: 3, offset: 0, format: "float32x4" },
      { shaderLocation: 4, offset: 16, format: "float32x4" },
    ],
  };
  const lifeBuffers: GPUVertexBufferLayout[] = [
    {
      arrayStride: VERT * 4,
      attributes: [
        { shaderLocation: 0, offset: 0, format: "float32x3" },
        { shaderLocation: 1, offset: 12, format: "float32x3" },
        { shaderLocation: 2, offset: 24, format: "float32x3" },
      ],
    },
    instLayout,
  ];
  const fishBuffers: GPUVertexBufferLayout[] = [
    lifeBuffers[0],
    {
      arrayStride: FISH * 4,
      stepMode: "instance",
      attributes: [
        { shaderLocation: 3, offset: 0, format: "float32x4" },
        { shaderLocation: 4, offset: 16, format: "float32x4" },
        { shaderLocation: 5, offset: 32, format: "float32x4" },
      ],
    },
  ];
  const blobTex = device.createTexture({ size: [W, H], format: "rgba8unorm", usage: TU.TEXTURE_BINDING | TU.RENDER_ATTACHMENT });
  const blobL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: VF, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, texture: {} },
      { binding: 4, visibility: GPUShaderStage.VERTEX, sampler: {} },
    ],
  });
  const blobPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blobL] }),
    vertex: { module: lifeMod, entryPoint: "vsBlob", buffers: [instLayout] },
    fragment: { module: lifeMod, entryPoint: "fsBlob", targets: [{ format: "rgba8unorm", blend: add }] },
  });
  const blobGroup = device.createBindGroup({ layout: blobL, entries: [ub, { binding: 1, resource: heightTex.createView() }, { binding: 4, resource: wrapSmp }] });

  const sceneL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: VF, buffer: { type: "uniform" } },
      { binding: 1, visibility: VF, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 3, visibility: VF, texture: {} },
      { binding: 4, visibility: VF, sampler: {} },
      { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ],
  });
  const scenePL = device.createPipelineLayout({ bindGroupLayouts: [sceneL] });
  const scene = compile(commonCode + sceneCode, "scene");
  const sceneGroup = device.createBindGroup({
    layout: sceneL,
    entries: [
      ub,
      { binding: 1, resource: heightTex.createView() },
      { binding: 2, resource: auxTex.createView() },
      { binding: 3, resource: causticTex.createView() },
      { binding: 4, resource: wrapSmp },
      { binding: 5, resource: blobTex.createView() },
      { binding: 6, resource: shellTex.createView() },
    ],
  });
  const scenePipes = new Map<number, { wall: GPURenderPipeline; speck: GPURenderPipeline; shell: GPURenderPipeline; fish: GPURenderPipeline; small: GPURenderPipeline; grass: GPURenderPipeline }>();
  const pipesFor = (samples: number) => {
    let p = scenePipes.get(samples);
    if (!p) {
      const living = (vs: string, fs: string) =>
        device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: lifeMod, entryPoint: vs, buffers: vs === "vsShell" ? lifeBuffers : fishBuffers },
          fragment: { module: lifeMod, entryPoint: fs, targets: [{ format: HDR }] },
          primitive: { topology: "triangle-list", cullMode: "none" },
          depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
          multisample: { count: samples },
        });
      p = {
        // leaves thinner than a pixel are thinned in coverage, which needs the multisampling
        grass: device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: lifeMod, entryPoint: "vsGrass", buffers: [instLayout] },
          fragment: { module: lifeMod, entryPoint: "fsGrass", targets: [{ format: HDR }] },
          primitive: { topology: "triangle-strip", cullMode: "none" },
          depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
          multisample: { count: samples, alphaToCoverageEnabled: samples > 1 },
        }),
        shell: living("vsShell", "fsShell"),
        fish: living("vsFish", "fsFish"),
        small: living("vsSmall", "fsSmall"),
        wall: device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: scene, entryPoint: "vsWall" },
          fragment: { module: scene, entryPoint: "fsWall", targets: [{ format: HDR }] },
          primitive: { topology: "triangle-strip", stripIndexFormat: "uint32", cullMode: "none" },
          depthStencil: { format: "depth24plus", depthWriteEnabled: true, depthCompare: "less" },
          multisample: { count: samples },
        }),
        speck: device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: scene, entryPoint: "vsSpeck" },
          fragment: { module: scene, entryPoint: "fsSpeck", targets: [{ format: HDR, blend: add }] },
          primitive: { topology: "triangle-strip" },
          depthStencil: { format: "depth24plus", depthWriteEnabled: false, depthCompare: "less" },
          multisample: { count: samples },
        }),
      };
      scenePipes.set(samples, p);
    }
    return p;
  };

  // ---------------------------------------------------------------- shafts of light in the water
  // (drawn small from the picture's depth, then laid over the picture; the depth is of one kind with
  // multisampling and of another without, so there is a pipeline for each)
  const shaftPipes = new Map<number, { layout: GPUBindGroupLayout; pipe: GPURenderPipeline }>();
  const shaftFor = (samples: number) => {
    let p = shaftPipes.get(samples);
    if (!p) {
      const layout = device.createBindGroupLayout({
        entries: [
          { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
          { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
          { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
          { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
          { binding: 4, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
          { binding: 5, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth", multisampled: samples > 1 } },
        ],
      });
      const module = compile(commonCode + shaftCode.replace("DEPTH_KIND", samples > 1 ? "texture_depth_multisampled_2d" : "texture_depth_2d"), "shaft");
      const pipe = device.createRenderPipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
        vertex: { module, entryPoint: "vs" },
        fragment: { module, entryPoint: "fs", targets: [{ format: HDR }] },
      });
      p = { layout, pipe };
      shaftPipes.set(samples, p);
    }
    return p;
  };
  const shaftAddPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [blitL] }),
    vertex: { module: blit, entryPoint: "vs" },
    fragment: { module: blit, entryPoint: "fsWide", targets: [{ format: HDR, blend: add }] },
  });

  // ---------------------------------------------------------------- bloom and the screen
  const post = compile(postCode, "post");
  const downL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, storageTexture: { format: HDR, access: "write-only" } },
    ],
  });
  const compL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ...[4, 5, 6, 7, 8].map((binding) => ({ binding, visibility: GPUShaderStage.FRAGMENT, texture: {} })),
    ],
  });
  const downPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [downL] }), compute: { module: post, entryPoint: "down" } });
  const compPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [compL] }),
    vertex: { module: post, entryPoint: "vs" },
    fragment: { module: post, entryPoint: "fs", targets: [{ format }] },
  });
  const postUni = new Float32Array(8);
  const postBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

  type Targets = {
    w: number;
    h: number;
    samples: number;
    ms?: GPUTexture;
    hdr: GPUTexture;
    depth: GPUTexture;
    shaft: GPUTexture;
    shaftGroup: GPUBindGroup;
    shaftAdd: GPUBindGroup;
    mips: GPUTexture[];
    downs: GPUBindGroup[];
    comp: GPUBindGroup;
  };
  let targets: Targets | undefined;
  const makeTargets = (w: number, h: number, samples: number): Targets => {
    const hdr = device.createTexture({ size: [w, h], format: HDR, usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    const ms = samples > 1 ? device.createTexture({ size: [w, h], format: HDR, sampleCount: samples, usage: TU.RENDER_ATTACHMENT }) : undefined;
    const depth = device.createTexture({ size: [w, h], format: "depth24plus", sampleCount: samples, usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    // (the shafts are soft: half the picture's size, and never more than some 800 across, so a dense screen pays no more)
    const coarse = Math.max(2, Math.ceil(w / 800));
    const shaft = device.createTexture({ size: [Math.ceil(w / coarse), Math.ceil(h / coarse)], format: HDR, usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    const shaftGroup = device.createBindGroup({
      layout: shaftFor(samples).layout,
      entries: [
        ub,
        { binding: 1, resource: heightTex.createView() },
        { binding: 2, resource: auxTex.createView() },
        { binding: 3, resource: causticTex.createView() },
        { binding: 4, resource: wrapSmp },
        { binding: 5, resource: depth.createView() },
      ],
    });
    const shaftAdd = device.createBindGroup({
      layout: blitL,
      entries: [
        { binding: 0, resource: shaft.createView() },
        { binding: 1, resource: clampSmp },
      ],
    });
    const mips: GPUTexture[] = [];
    let mw = w;
    let mh = h;
    for (let k = 0; k < 5; k++) {
      mw = Math.max(1, mw >> 1);
      mh = Math.max(1, mh >> 1);
      mips.push(device.createTexture({ size: [mw, mh], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }));
    }
    const pb = { binding: 0, resource: { buffer: postBuf } };
    const downs = mips.map((m, k) =>
      device.createBindGroup({
        layout: downL,
        entries: [pb, { binding: 1, resource: (k ? mips[k - 1] : hdr).createView() }, { binding: 2, resource: clampSmp }, { binding: 3, resource: m.createView() }],
      }),
    );
    const comp = device.createBindGroup({
      layout: compL,
      entries: [pb, { binding: 1, resource: hdr.createView() }, { binding: 2, resource: clampSmp }, ...mips.map((m, k) => ({ binding: 4 + k, resource: m.createView() }))],
    });
    return { w, h, samples, ms, hdr, depth, shaft, shaftGroup, shaftAdd, mips, downs, comp };
  };

  // ---------------------------------------------------------------- the waves on the sheet of light
  const mulberry = (seed: number) => () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let wavesKey = "";
  let waveCount = 0;
  /** a spread of waves, each a whole number of turns round the tunnel and along its length, so the light wraps */
  const makeWaves = () => {
    const rnd = mulberry(light.seed * 977 + 13);
    let n = 0;
    let power = 0;
    const rows: number[][] = [];
    for (let tries = 0; n < Math.min(light.count, MAX_WAVES) && tries < 400; tries++) {
      const lambda = light.waveSize * Math.pow(0.2, rnd());
      const a = rnd() * Math.PI * 2;
      const k = (2 * Math.PI) / lambda;
      const m = Math.round(k * Math.cos(a) * R);
      const kz = ((2 * Math.PI) / L) * Math.round((k * Math.sin(a) * L) / (2 * Math.PI));
      const kk = Math.hypot(m / R, kz);
      if (kk < 1e-3) continue;
      // finer waves run faster, as on water
      // (in a loop, a whole number of times round in it)
      const omega = inLoop(0.4 * Math.sqrt(kk) * (0.8 + 0.4 * rnd()) * (rnd() < 0.5 ? -1 : 1), view.loop * Math.max(light.speed, 1e-3));
      const s = Math.pow(lambda / light.waveSize, 0.35);
      power += (s * s) / 2;
      rows.push([m, kz, omega, rnd() * Math.PI * 2, (s * m) / R / kk, (s * kz) / kk, 0, 0]);
      n++;
    }
    const norm = 1 / Math.sqrt(power || 1);
    rows.forEach((r, i) => {
      r[4] *= norm;
      r[5] *= norm;
      uni.set(r, 100 + i * 8);
    });
    waveCount = n;
  };

  // ---------------------------------------------------------------- the panel
  const gui = new GUI({ title: "tunnel" });
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const fs = gui.addFolder("sand");
  fs.add(sand, "ripples", 40, 400, 1).name("ripples in the length");
  fs.add(sand, "height", 0, 0.04, 0.0005).name("ripple height");
  fs.add(sand, "lean", -1, 1, 0.01).name("ripple lean");
  fs.add(sand, "wander", 0, 0.6, 0.005).name("crests meander");
  fs.add(sand, "vary", 0, 0.3, 0.005).name("spacing varies");
  fs.add(sand, "loose", 0, 1.5, 0.01).name("forks");
  fs.add(sand, "dunes", 0, 0.45, 0.005).name("dune height");
  fs.add(sand, "duneCount", 3, 24, 1).name("dunes in the length");
  fs.add(sand, "swell", 0, 0.2, 0.005).name("bore swells");
  fs.add(sand, "rocks", 0, 1, 0.01).name("rocks");
  fs.add(sand, "rockSize", 0.08, 0.45, 0.005).name("rock size");
  fs.add(sand, "seed", 0, 50, 1);
  const fl = gui.addFolder("light");
  fl.add(light, "depth", 0.1, 0.9, 0.005).name("sheet above the sand");
  fl.add(light, "waves", 0, 0.3, 0.002).name("waves");
  fl.add(light, "waveSize", 0.2, 2, 0.01).name("longest wave");
  fl.add(light, "count", 4, MAX_WAVES, 1).name("how many waves");
  fl.add(light, "speed", 0, 4, 0.01).name("wave speed");
  fl.add(light, "lean", -1.5, 1.5, 0.01).name("light leans along");
  fl.add(light, "strength", 0, 2, 0.01).name("caustic strength");
  fl.add(light, "colours").name("colours split");
  fl.add(light, "spread", 0, 0.12, 0.001).name("colour spread");
  fl.add(light, "brightest", 4, 200, 1).name("brightest fold");
  fl.add(light, "soften", 0, 3, 0.01).name("folds widened");
  fl.add(light, "seed", 0, 50, 1);
  const fk = gui.addFolder("look");
  fk.add(look, "exposure", 0.2, 3, 0.01);
  fk.add(look, "sun", 0, 4, 0.01).name("direct light");
  fk.add(look, "around", 0, 2, 0.01).name("light from all round");
  fk.add(look, "shade", 0, 1, 0.01).name("shadows' depth");
  fk.add(look, "warmth", 0, 1, 0.01).name("sun's warmth");
  fk.addColor(look, "sand");
  fk.add(look, "sparkle", 0, 3, 0.01).name("grains sparkle");
  fk.add(look, "rockRough", 0, 3, 0.01).name("rock roughness");
  fk.add(look, "bloom", 0, 2, 0.01);
  fk.add(look, "threshold", 0, 3, 0.01).name("bloom above");
  fk.add(look, "vignette", 0, 1, 0.01);
  fk.add(look, "msaa").name("4x multisampling");
  const fw = gui.addFolder("water");
  fw.add(look, "fog", 0, 1.2, 0.005).name("haze");
  fw.add(look, "hazeFrom", 0, 4, 0.01).name("clear this far");
  fw.addColor(look, "water").name("colour, near");
  fw.addColor(look, "deep").name("colour, far");
  fw.add(look, "redLoss", 0, 2, 0.01).name("reds lost first");
  fw.add(look, "specks", 0, 3, 0.01);
  fw.add(look, "speckLit", 0, 2, 0.01).name("specks catch the shafts");
  fw.add(look, "shafts", 0, 4, 0.01).name("shafts of light");
  fw.add(look, "shaftSoft", 0, 3, 0.05).name("shafts soft");
  fw.add(look, "shaftUp", 0.2, 2, 0.01).name("shafts gather late");
  const fa = gui.addFolder("life");
  fa.add(life, "shells", 0, MAX_SHELLS, 1).name("rapana");
  fa.add(life, "crawl", 0, 0.05, 0.001).name("rapana crawl");
  fa.add(life, "schools", 0, 12, 1).name("schools of mullet");
  fa.add(life, "hamsa", 0, 6, 1).name("schools of hamsa");
  fa.add(life, "hamsaEach", 20, 400, 10).name("hamsa in a school");
  fa.add(life, "grass", 0, MAX_PLANTS, 50).name("eelgrass plants");
  fa.add(life, "grassTall", 0.1, 0.6, 0.005).name("eelgrass height");
  fa.add(life, "sway", 0, 3, 0.01).name("eelgrass sways");
  fa.add(life, "current", 0, 2, 0.01).name("current bends it");
  fa.add(life, "seed", 0, 50, 1);
  const fv = gui.addFolder("flight");
  fv.add(view, "along", 0, L, 0.01).name("distance along").listen();
  fv.add(view, "speed", -3, 3, 0.01).listen();
  fv.add(view, "hold").name("stop (space)").listen();
  fv.add(view, "fov", 30, 100, 0.5);
  fv.add(view, "sway", 0, 3, 0.01);
  fv.add(view, "windX", 0, 1.6, 0.01).name("winds sideways");
  fv.add(view, "windFine", 0, 0.5, 0.01).name("finer winding");
  fv.add(view, "windY", 0, 1.2, 0.01).name("winds up and down");
  fv.add(view, "loop", 0, 60, 1).name("loop, seconds (0: none)");
  for (const f of [fs, fl, fk, fw, fa, fv]) f.close();
  gui.close();

  // ---------------------------------------------------------------- looking round
  let dragging = false;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    pose.yaw = Math.max(-1.45, Math.min(1.45, pose.yaw - e.movementX * 0.004));
    pose.pitch = Math.max(-1.1, Math.min(1.1, pose.pitch - e.movementY * 0.004));
  };
  const onUp = () => (dragging = false);
  const onDouble = () => {
    pose.yaw = 0;
    pose.pitch = 0;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view.speed = Math.max(-3, Math.min(3, view.speed - e.deltaY * 0.001));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      view.hold = !view.hold;
      e.preventDefault();
    }
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("dblclick", onDouble);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  // ---------------------------------------------------------------- the path, as the shaders have it
  const K = (2 * Math.PI) / L;
  const centre = (z: number) => new Vector3(view.windX * Math.sin(K * z) + view.windFine * Math.sin(3 * K * z + 1.7), view.windY * Math.sin(2 * K * z + 0.6), z);
  const heading = (z: number) => new Vector3(view.windX * K * Math.cos(K * z) + view.windFine * 3 * K * Math.cos(3 * K * z + 1.7), view.windY * 2 * K * Math.cos(2 * K * z + 0.6), 1).normalize();
  const axes = (z: number) => {
    const t = heading(z);
    const a = new Vector3(0, 1, 0).cross(t).normalize();
    return { a, b: t.clone().cross(a), t };
  };

  // ---------------------------------------------------------------- a frame
  const cam = new PerspectiveCamera();
  let time = 0;
  let waveClock = 0;
  let frame = 0;
  // the sand's broad shape, read back from the GPU after each bake, for the fish to find their height by
  const GW = W >> (HEIGHT_MIPS - 1);
  const GH = H >> (HEIGHT_MIPS - 1);
  const groundBuf = device.createBuffer({ size: GW * GH * 8, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
  let groundGrid: Float32Array | undefined;
  let groundWanted = false;
  let groundBusy = false;
  const half = (h: number) => {
    const e = (h >> 10) & 31;
    const f = h & 1023;
    const v = e === 0 ? f * 2 ** -24 : (1 + f / 1024) * 2 ** (e - 15);
    return h & 0x8000 ? -v : v;
  };
  const readGround = () => {
    if (!groundWanted || groundBusy) return;
    groundWanted = false;
    groundBusy = true;
    const enc = device.createCommandEncoder();
    enc.copyTextureToBuffer({ texture: heightTex, mipLevel: HEIGHT_MIPS - 1 }, { buffer: groundBuf, bytesPerRow: GW * 8 }, [GW, GH]);
    device.queue.submit([enc.finish()]);
    groundBuf.mapAsync(GPUMapMode.READ).then(() => {
      const raw = new Uint16Array(groundBuf.getMappedRange());
      const grid = new Float32Array(GW * GH);
      // the height, and a share of how much is rock: a fish gives a stone more room than its blurred height asks
      for (let k = 0; k < GW * GH; k++) grid[k] = half(raw[k * 4]) + 0.3 * half(raw[k * 4 + 3]);
      groundBuf.unmap();
      groundGrid = grid;
      groundBusy = false;
    });
  };
  const groundAt = (a: number, z: number) => {
    if (!groundGrid) return 0;
    const x = (a / (Math.PI * 2)) * GW - 0.5;
    const y = (z / L) * GH - 0.5;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const at = (ii: number, jj: number) => groundGrid![(((ii % GW) + GW) % GW) + (((jj % GH) + GH) % GH) * GW];
    return (at(i, j) * (1 - fx) + at(i + 1, j) * fx) * (1 - fy) + (at(i, j + 1) * (1 - fx) + at(i + 1, j + 1) * fx) * fy;
  };
  let lifeKey = "";
  let grassKey = "";
  let plants = 0;
  let leaves = 0;
  let shells = new Float32Array(0);
  let schools: ReturnType<typeof makeSchools> = [];
  let fishCount = 0;
  let shoalKey = "";
  let shoals: ReturnType<typeof makeShoals> = [];
  let smallCount = 0;
  let madeSand = "";
  let madeBake = "";
  const clock = { paused: false };
  const dz = L / H;

  const step = (dt: number) => {
    time += dt;
    waveClock += dt * light.speed;
    if (view.loop > 0) view.speed = L / view.loop;
    if (!view.hold) view.along = (((view.along + dt * view.speed) % L) + L) % L;
    const along = view.along;
    const Wc = canvas.width;
    const Hc = canvas.height;
    const samples = look.msaa ? 4 : 1;
    if (!targets || targets.w !== Wc || targets.h !== Hc || targets.samples !== samples) {
      targets?.hdr.destroy();
      targets?.ms?.destroy();
      targets?.depth.destroy();
      targets?.shaft.destroy();
      targets?.mips.forEach((m) => m.destroy());
      targets = makeTargets(Wc, Hc, samples);
    }
    const T = targets;

    const key = JSON.stringify([light.count, light.waveSize, light.seed, view.loop, light.speed]);
    if (key !== wavesKey) {
      wavesKey = key;
      makeWaves();
    }

    // the eye: near the middle, adrift a little, looking down the tunnel ahead
    const ax = axes(along);
    const sw = 0.16 * view.sway;
    const sway = [0.31, 0.23, 0.17, 0.19].map((rate) => inLoop(rate, view.loop));
    const eye = centre(along)
      .addScaledVector(ax.a, sw * Math.sin(time * sway[0]))
      .addScaledVector(ax.b, sw * 0.7 * Math.sin(time * sway[1] + 1));
    const ahead = 1.8;
    const aim = centre(along + ahead)
      .addScaledVector(ax.a, 0.5 * sw * Math.sin(time * sway[2] + 2))
      .sub(eye)
      .normalize();
    const side = new Vector3(0, 1, 0).cross(aim).normalize();
    const over = aim.clone().cross(side);
    const dir = aim
      .clone()
      .multiplyScalar(Math.cos(pose.yaw) * Math.cos(pose.pitch))
      .addScaledVector(side, Math.sin(pose.yaw) * Math.cos(pose.pitch))
      .addScaledVector(over, Math.sin(pose.pitch));
    cam.fov = view.fov;
    cam.aspect = Wc / Hc;
    cam.near = 0.02;
    cam.far = 60;
    cam.position.copy(eye);
    const roll = 0.05 * view.sway * Math.sin(time * sway[3]);
    cam.up.copy(over).addScaledVector(side, roll).normalize();
    cam.lookAt(eye.clone().add(dir));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const vp = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    const f = new Vector3();
    cam.getWorldDirection(f);
    const r = new Vector3().crossVectors(f, cam.up).normalize();
    const u = new Vector3().crossVectors(r, f);

    // the light mesh: from a little behind the eye to as far as the tunnel shows, moved back by the light's lean
    const shift = light.depth * light.lean;
    const start = Math.floor((along - 1.75 - Math.max(shift, 0) - 0.2) / (2 * dz)) * 2 * dz;
    const rows = Math.min(LROWS_MAX, Math.ceil((light.reach + 2.35 + Math.abs(shift)) / dz));

    // the wall mesh: started on the coarsest band's grid, so no ring ever moves
    const coarsest = dz * (1 << (BANDS - 1));
    const base = Math.floor((along - 0.1) / coarsest) * coarsest - BACK_ROWS * 4 * dz;

    // what lives here: where each is now, kept within a length of tunnel of the eye; and the shadows they cast
    const lk = JSON.stringify([life.shells, life.schools, life.seed, view.loop]);
    if (lk !== lifeKey) {
      lifeKey = lk;
      shells = scatterShells(life.shells, life.seed, L);
      schools = makeSchools(life.schools, life.seed, L, view.loop);
    }
    const hk = JSON.stringify([life.hamsa, life.hamsaEach, life.seed, view.loop]);
    if (hk !== shoalKey) {
      shoalKey = hk;
      shoals = makeShoals(life.hamsa, life.hamsaEach, life.seed, L, view.loop);
    }
    const gk = JSON.stringify([life.grass, life.grassTall, life.seed, light.lean]);
    if (gk !== grassKey) {
      grassKey = gk;
      const g = scatterGrass(life.grass, life.seed, L, R, life.grassTall, light.lean);
      plants = g.plants;
      leaves = g.leaves.length / INST;
      if (leaves) device.queue.writeBuffer(grassInst, 0, g.leaves);
      if (plants) device.queue.writeBuffer(blobInst, 0, g.shadows);
    }
    const near = (z: number) => along - 3 + ((((z - along + 3) % L) + L) % L);
    // (in a loop the shells keep their places: at their pace they would not be back in time)
    const crawl = view.loop > 0 ? 0 : life.crawl;
    for (let k = 0; k < life.shells; k++) {
      const o = k * INST;
      // each creeps the way it is headed, canal first
      shells[o] += (dt * crawl * Math.sin(shells[o + 3])) / R;
      shells[o + 1] = (((shells[o + 1] + dt * crawl * Math.cos(shells[o + 3])) % L) + L) % L;
      shellData.set(shells.subarray(o, o + INST), o);
      shellData[o + 1] = near(shells[o + 1]);
      const size = shells[o + 2];
      blobData.set([shells[o], shells[o + 1] + light.lean * 0.3 * size, shells[o + 3], 0.6 * size, 0.45 * size, 0.8, 0, 1], o);
    }
    fishCount = swim(schools, time, along, L, R, light.lean, groundAt, fishData, blobData, life.shells);
    device.queue.writeBuffer(shellInst, 0, shellData, 0, Math.max(life.shells, 1) * INST);
    device.queue.writeBuffer(fishInst, 0, fishData, 0, Math.max(fishCount, 1) * FISH);
    // the hamsa, out in the water: they part round the eye, so they are told where it is, in its own ring's plane
    const c0 = centre(along);
    const wound = (z: number): [number, number] => {
      const dx = view.windX * Math.sin(K * z) + view.windFine * Math.sin(3 * K * z + 1.7) - c0.x;
      const dy = view.windY * Math.sin(2 * K * z + 0.6) - c0.y;
      const dzz = z - along;
      return [dx * ax.a.x + dy * ax.a.y + dzz * ax.a.z, dx * ax.b.x + dy * ax.b.y + dzz * ax.b.z];
    };
    smallCount = shoal(shoals, time, [sw * Math.sin(time * sway[0]), sw * 0.7 * Math.sin(time * sway[1] + 1), along], wound, L, R, light.lean, groundAt, smallData, blobData, life.shells + fishCount);
    device.queue.writeBuffer(smallInst, 0, smallData, 0, Math.max(smallCount, 1) * FISH);
    const casting = life.shells + fishCount + smallCount;
    device.queue.writeBuffer(blobInst, plants * INST * 4, blobData, 0, Math.max(casting, 1) * INST);

    uni.set(vp.elements, 0);
    uni.set([eye.x, eye.y, eye.z, time], 16);
    uni.set([L, R, W, H], 20);
    uni.set([light.depth, light.lean, light.waves, light.spread], 24);
    uni.set([start, dz, lightCols, rows], 28);
    uni.set([sand.ripples, sand.height, sand.lean, sand.loose], 32);
    uni.set([sand.wander, sand.vary, sand.dunes, sand.duneCount], 36);
    uni.set([sand.swell, sand.rocks, sand.rockSize, sand.seed], 40);
    uni.set([look.fog, light.strength, look.around, look.sun], 44);
    uni.set([...look.water, look.sparkle], 48);
    uni.set([...look.sand, waveClock], 52);
    uni.set([base, dz, COLS, PER_BAND], 56);
    uni.set([view.windX, view.windFine, view.windY, LMARGIN], 60);
    uni.set([CW, CH, look.specks, Hc], 64);
    uni.set([waveCount, light.colours ? 3 : 1, light.brightest, look.rockRough], 68);
    uni.set([r.x, r.y, r.z, look.warmth], 72);
    uni.set([u.x, u.y, u.z, look.shade], 76);
    uni.set([Wc / Hc, light.reach, light.soften, look.hazeFrom], 80);
    uni.set([...look.deep, look.redLoss], 84);
    uni.set([life.sway, life.current, Hc / (2 * Math.tan((view.fov * Math.PI) / 360)), plants], 88);
    uni.set([look.shafts, look.shaftSoft, look.shaftUp, look.speckLit], 92);
    uni.set([cam.near, cam.far, view.loop > 0 ? (2 * Math.PI) / view.loop : 0, 0], 96);
    device.queue.writeBuffer(uniBuf, 0, uni);
    postUni.set([look.exposure, look.bloom, frame, look.threshold, Wc, look.vignette, 0, 0]);
    device.queue.writeBuffer(postBuf, 0, postUni);

    const enc = device.createCommandEncoder();

    // the sand, when its settings change; its shadows too when the light leans another way
    const sandKey = JSON.stringify(sand);
    const bakeKey = sandKey + light.lean;
    if (sandKey !== madeSand || bakeKey !== madeBake) {
      const cp = enc.beginComputePass();
      if (sandKey !== madeSand) {
        cp.setPipeline(heightsPipe);
        cp.setBindGroup(0, heightsGroup);
        cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
      }
      cp.setPipeline(bakePipe);
      cp.setBindGroup(0, bakeGroup);
      cp.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
      cp.end();
      halve(enc, heightChain);
      halve(enc, auxChain);
      for (const b of blurSteps) {
        const p = enc.beginRenderPass({ colorAttachments: [{ view: b.to, loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
        p.setPipeline(b.pipe);
        p.setBindGroup(0, b.from);
        p.draw(3);
        p.end();
      }
      madeSand = sandKey;
      madeBake = bakeKey;
      groundWanted = true;
    }

    // the caustics: the mesh lands on a map of one length of tunnel, so what runs past the map's end is drawn
    // again a length back
    {
      const wp = enc.beginComputePass();
      wp.setPipeline(sheetPipe);
      wp.setBindGroup(0, sheetGroup);
      if (!skip.waves) wp.dispatchWorkgroups(Math.ceil(sheetTex.width / 8), Math.ceil((rows / 2 + 2) / 8));
      wp.end();
      // (its own pass: it reads the sheet the pass before wrote)
      const np = enc.beginComputePass();
      np.setPipeline(landPipe);
      np.setBindGroup(0, landGroup);
      if (!skip.land) np.dispatchWorkgroups(Math.ceil((lightCols + 1) / 8), Math.ceil((rows + 1) / 8));
      np.end();
      const lp = enc.beginRenderPass({ colorAttachments: [{ view: causticRaw.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      lp.setPipeline(lightPipe);
      lp.setBindGroup(0, lightGroup);
      lp.setIndexBuffer(lightIdx.buf, "uint32");
      const pad = Math.ceil((0.35 + Math.abs(shift)) / dz);
      for (let lap = -1; lap <= 1; lap++) {
        const r0 = Math.max(0, Math.floor((lap * L - start) / dz) - pad);
        const r1 = Math.min(rows, Math.ceil(((lap + 1) * L - start) / dz) + pad);
        if (r1 <= r0 || skip.light) continue;
        lp.drawIndexed((r1 - r0) * lightIdx.per, 1, r0 * lightIdx.per, 0, lap + 1);
      }
      lp.end();
      const soft = enc.beginRenderPass({ colorAttachments: [{ view: level(causticTex, 0), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      soft.setPipeline(softPipe);
      soft.setBindGroup(0, softGroup);
      soft.draw(3);
      soft.end();
      halve(enc, causticChain, halfSoftPipe);
    }

    // the shadows of what lives here, onto a map of the wall
    {
      const bp = enc.beginRenderPass({ colorAttachments: [{ view: blobTex.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      if (plants + casting > 0 && !skip.life) {
        bp.setPipeline(blobPipe);
        bp.setBindGroup(0, blobGroup);
        bp.setVertexBuffer(0, blobInst);
        bp.draw(24, plants + casting);
      }
      bp.end();
    }

    // the tunnel
    {
      const pipes = pipesFor(samples);
      const fogged: GPUColor = [look.deep[0], look.deep[1], look.deep[2], 1];
      const sp = enc.beginRenderPass({
        colorAttachments: [
          T.ms
            ? { view: T.ms.createView(), resolveTarget: T.hdr.createView(), loadOp: "clear", storeOp: "discard", clearValue: fogged }
            : { view: T.hdr.createView(), loadOp: "clear", storeOp: "store", clearValue: fogged },
        ],
        depthStencilAttachment: { view: T.depth.createView(), depthLoadOp: "clear", depthStoreOp: "store", depthClearValue: 1 },
      });
      sp.setBindGroup(0, sceneGroup);
      sp.setPipeline(pipes.wall);
      sp.setIndexBuffer(wallIdx.buf, "uint32");
      if (!skip.wall) sp.drawIndexed(WALL_ROWS * wallIdx.per);
      if (!skip.life) {
        if (leaves > 0) {
          sp.setPipeline(pipes.grass);
          sp.setVertexBuffer(0, grassInst);
          sp.draw(20, leaves);
        }
        if (life.shells > 0) {
          sp.setPipeline(pipes.shell);
          sp.setVertexBuffer(0, shellBuf.vb);
          sp.setVertexBuffer(1, shellInst);
          sp.setIndexBuffer(shellBuf.ib, "uint32");
          sp.drawIndexed(shellBuf.count, life.shells);
        }
        if (fishCount > 0) {
          sp.setPipeline(pipes.fish);
          sp.setVertexBuffer(0, fishBuf.vb);
          sp.setVertexBuffer(1, fishInst);
          sp.setIndexBuffer(fishBuf.ib, "uint32");
          sp.drawIndexed(fishBuf.count, fishCount);
        }
        if (smallCount > 0) {
          sp.setPipeline(pipes.small);
          sp.setVertexBuffer(0, smallBuf.vb);
          sp.setVertexBuffer(1, smallInst);
          sp.setIndexBuffer(smallBuf.ib, "uint32");
          sp.drawIndexed(smallBuf.count, smallCount);
        }
      }
      if (look.specks > 0) {
        sp.setPipeline(pipes.speck);
        sp.draw(4, 1200);
      }
      sp.end();
    }

    // the shafts of light, walked through the water at half size and laid over the picture
    if (look.shafts > 0 && !skip.shafts) {
      const hp = enc.beginRenderPass({ colorAttachments: [{ view: T.shaft.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] }] });
      hp.setPipeline(shaftFor(samples).pipe);
      hp.setBindGroup(0, T.shaftGroup);
      hp.draw(3);
      hp.end();
      const ap = enc.beginRenderPass({ colorAttachments: [{ view: T.hdr.createView(), loadOp: "load", storeOp: "store" }] });
      ap.setPipeline(shaftAddPipe);
      ap.setBindGroup(0, T.shaftAdd);
      ap.draw(3);
      ap.end();
    }

    const cp = enc.beginComputePass();
    cp.setPipeline(downPipe);
    T.mips.forEach((m, k) => {
      if (skip.bloom) return;
      cp.setBindGroup(0, T.downs[k]);
      cp.dispatchWorkgroups(Math.ceil(m.width / 8), Math.ceil(m.height / 8));
    });
    cp.end();
    const out = enc.beginRenderPass({ colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
    out.setPipeline(compPipe);
    out.setBindGroup(0, T.comp);
    out.draw(3);
    out.end();
    device.queue.submit([enc.finish()]);
    readGround();
    frame++;
  };

  (window as unknown as { __tunnel: unknown }).__tunnel = {
    sand,
    light,
    look,
    view,
    pose,
    clock,
    skip,
    life,
    get fish() {
      // (eight numbers each, as the tools expect: the first eight of its twelve)
      return Array.from({ length: fishCount * INST }, (_, k) => fishData[Math.floor(k / INST) * FISH + (k % INST)]);
    },
    // every mullet, all twelve of its numbers
    get fishAll() {
      return Array.from(fishData.subarray(0, fishCount * FISH));
    },
    // the hamsa: twelve numbers each
    get small() {
      return Array.from(smallData.subarray(0, smallCount * FISH));
    },
    get shellsAt() {
      return Array.from(shells);
    },
    // the shells' own numbers, to change by hand
    get shellsRaw() {
      return shells;
    },
    get frame() {
      return frame;
    },
    get time() {
      return time;
    },
    get ready() {
      return frame > 1;
    },
    reseed: () => {},
    advance: async (seconds: number) => {
      clock.paused = true;
      const n = Math.round(seconds * 60);
      for (let k = 0; k < n; k++) {
        step(1 / 60);
        if (k % 4 === 3) await device.queue.onSubmittedWorkDone();
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
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("dblclick", onDouble);
    canvas.removeEventListener("wheel", onWheel);
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
