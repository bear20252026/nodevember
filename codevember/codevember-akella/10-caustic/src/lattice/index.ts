/**
 * Lattice: the vessel of glass threads as a real mesh. A foam of cells on the vessel's skin, built as a
 * graph on the CPU (geometry.ts), swept into tubes and drawn additively with 4x multisampling over dark
 * water, with a cyan glow inside, glints and drifting specks. Fast, and its edges are clean.
 *
 * Drag to turn, wheel to come closer, space to hold it still.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { PerspectiveCamera, Vector3 } from "three";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import { parseMeshBin } from "./form";
import { STRIDE, SHAPE, type Lattice, type LatticeParams } from "./geometry";
import postCode from "./post.wgsl?raw";
import sceneCode from "./scene.wgsl?raw";

const lattice: LatticeParams = {
  form: "vessel",
  cells: 22,
  layers: 2,
  shrink: 0.84,
  jitter: 0.8,
  warp: 0.3,
  fine: 0.45,
  rMain: 0.0042,
  rFine: 0.0018,
  rRim: 0.0065,
  flare: 0.8,
  crown: 0.55,
  crownLen: 0.07,
  thorns: 0.3,
  thornLen: 0.035,
  hem: 0.45,
  hemLen: 0.32,
  sides: 7,
  seed: 3,
  merge: true,
  fillet: 0.009,
  res: 0.0015,
};
const look = {
  exposure: 1,
  bloom: 0.8,
  core: 1.3,
  coreSize: 0.3,
  coreY: 0.42,
  strand: 1,
  farDim: 0.35,
  behind: 0.06,
  form: 0.6,
  hide: 0.35,
  threshold: 0.6,
  dof: true,
  aperture: 40,
  focus: -0.4,
  maxBlur: 14,
  waterBlur: 1,
  snow: 0.35,
  stars: 1,
  starSize: 22,
  sway: 0.05,
  msaa: true,
};
// glass wrapping itself onto the form from the bottom up, holding, unwrapping from the top, again
// (progress is how far it has got, 0 nothing to 1 all wrapped; drag it to scrub, and the clock stops)
const weave = { on: true, play: true, progress: 0, grow: 7, hold: 5, undo: 4, rest: 1.2, band: 0.35, flare: 0.3, uneven: 0.3, scale: 2.4, glow: 1.2, loop: true };
const view = { spin: 0.03, hold: false, distance: 3.9, fov: 34, pitch: 4 };
const MAX_GLINTS = 8192;

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

  // ---------------------------------------------------------------- pipelines
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const sceneL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: VF, buffer: { type: "uniform" } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: "depth" } },
    ],
  });
  const scenePL = device.createPipelineLayout({ bindGroupLayouts: [sceneL] });
  const scene = compile(sceneCode, "scene");
  const HDR: GPUTextureFormat = "rgba16float";
  const add: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one" }, alpha: { srcFactor: "one", dstFactor: "one" } };
  // the glass adds its light and hides a little of what is behind its middle
  const glassBlend: GPUBlendState = { color: { srcFactor: "one", dstFactor: "one-minus-src-alpha" }, alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" } };
  const tubeVertex: GPUVertexState = {
    module: scene,
    entryPoint: "vsTube",
    buffers: [
      {
        arrayStride: STRIDE * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
          { shaderLocation: 2, offset: 24, format: "float32x4" },
          { shaderLocation: 3, offset: 40, format: "float32x3" },
        ],
      },
    ],
  };
  // the out-of-focus share of the glass and glints, drawn at half size into three layers to be blurred
  const layerTargets: GPUColorTargetState[] = [0, 1, 2].map(() => ({ format: HDR, blend: add }));
  const tubeBlurredPipe = device.createRenderPipeline({
    layout: scenePL,
    vertex: tubeVertex,
    fragment: { module: scene, entryPoint: "fsTubeBlurred", targets: layerTargets },
    primitive: { topology: "triangle-list", cullMode: "back" },
  });
  const starBlurredPipe = device.createRenderPipeline({
    layout: scenePL,
    vertex: { module: scene, entryPoint: "vsStar" },
    fragment: { module: scene, entryPoint: "fsStarBlurred", targets: layerTargets },
    primitive: { topology: "triangle-strip" },
  });
  const pipes = new Map<number, { back: GPURenderPipeline; tube: GPURenderPipeline; star: GPURenderPipeline; snow: GPURenderPipeline }>();
  const pipesFor = (count: number) => {
    if (!pipes.has(count)) {
      const multisample = { count };
      const sprite = (vs: string, fs: string) =>
        device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: scene, entryPoint: vs },
          fragment: {
            module: scene,
            entryPoint: fs,
            targets: [{ format: HDR, blend: add }],
          },
          primitive: { topology: "triangle-strip" },
          multisample,
        });
      pipes.set(count, {
        back: device.createRenderPipeline({
          layout: scenePL,
          vertex: { module: scene, entryPoint: "vsBack" },
          fragment: { module: scene, entryPoint: "fsBack", targets: [{ format: HDR }] },
          multisample,
        }),
        tube: device.createRenderPipeline({
          layout: scenePL,
          vertex: {
            module: scene,
            entryPoint: "vsTube",
            buffers: [
              {
                arrayStride: STRIDE * 4,
                attributes: [
                  { shaderLocation: 0, offset: 0, format: "float32x3" },
                  { shaderLocation: 1, offset: 12, format: "float32x3" },
                  { shaderLocation: 2, offset: 24, format: "float32x4" },
                  { shaderLocation: 3, offset: 40, format: "float32x3" },
                ],
              },
            ],
          },
          fragment: {
            module: scene,
            entryPoint: "fsTube",
            targets: [{ format: HDR, blend: glassBlend }],
          },
          primitive: { topology: "triangle-list", cullMode: "back" },
          multisample,
        }),
        star: sprite("vsStar", "fsStar"),
        snow: sprite("vsSnow", "fsSnow"),
      });
    }
    return pipes.get(count)!;
  };

  const C = GPUShaderStage.COMPUTE;
  const F = GPUShaderStage.FRAGMENT;
  const post = compile(postCode, "post");
  const downL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, texture: { sampleType: "float" } },
      { binding: 2, visibility: C, sampler: { type: "filtering" } },
      { binding: 3, visibility: C, storageTexture: { access: "write-only", format: HDR } },
    ],
  });
  const compL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: F, buffer: { type: "uniform" } },
      { binding: 1, visibility: F, texture: { sampleType: "float" } },
      { binding: 2, visibility: F, sampler: { type: "filtering" } },
      ...[4, 5, 6, 7, 8].map((binding) => ({ binding, visibility: F, texture: { sampleType: "float" as const } })),
    ],
  });
  const blurL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, texture: { sampleType: "unfilterable-float" } },
      { binding: 3, visibility: C, storageTexture: { access: "write-only", format: HDR } },
      { binding: 11, visibility: C, buffer: { type: "uniform" } },
    ],
  });
  const combL = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, texture: { sampleType: "unfilterable-float" } },
      { binding: 2, visibility: C, sampler: { type: "filtering" } },
      { binding: 3, visibility: C, storageTexture: { access: "write-only", format: HDR } },
      ...[12, 13, 14].map((binding) => ({ binding, visibility: C, texture: { sampleType: "float" as const } })),
    ],
  });
  const blurPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [blurL] }), compute: { module: post, entryPoint: "layerBlur" } });
  const combPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [combL] }), compute: { module: post, entryPoint: "layersCombine" } });
  // each blur step's direction and width: three layers, across then down
  const blurSteps = [0, 1, 2, 3, 4, 5].map(() => device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
  const downPipe = device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [downL] }), compute: { module: post, entryPoint: "down" } });
  const compPipe = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [compL] }),
    vertex: { module: post, entryPoint: "vs" },
    fragment: { module: post, entryPoint: "fs", targets: [{ format }] },
  });

  // ---------------------------------------------------------------- buffers
  const uni = new Float32Array(68);
  const uniBuf = device.createBuffer({ size: uni.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const postUni = new Float32Array(8);
  const postBuf = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const glintBuf = device.createBuffer({ size: MAX_GLINTS * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const sceneGroupFor = (depth: GPUTexture) =>
    device.createBindGroup({
      layout: sceneL,
      entries: [
        { binding: 0, resource: { buffer: uniBuf } },
        { binding: 1, resource: { buffer: glintBuf } },
        { binding: 2, resource: depth.createView() },
      ],
    });
  // the form itself, fitted as the builder fits it, for its depth
  let formMesh: { vb: GPUBuffer; ib: GPUBuffer; count: number } | null = null;
  const makeFormMesh = (buf: ArrayBuffer) => {
    const m = parseMeshBin(buf);
    const pos = m.pos;
    let ext = 0;
    for (let i = 0; i < pos.length; i += 3) ext = Math.max(ext, Math.abs(pos[i]));
    for (let i = 0; i < pos.length; i++) pos[i] *= 0.825 / ext;
    const vb = device.createBuffer({ size: pos.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const ib = device.createBuffer({ size: m.idx.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, pos);
    device.queue.writeBuffer(ib, 0, m.idx);
    formMesh = { vb, ib, count: m.idx.length };
  };
  const depthPipe = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: scene, entryPoint: "vsDepth", buffers: [{ arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] }] },
    primitive: { topology: "triangle-list" },
    depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
  });
  const depthGroup = device.createBindGroup({ layout: depthPipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: uniBuf } }] });
  let mesh: { vb: GPUBuffer; ib: GPUBuffer; count: number; glints: number; ms: number; tris: number } | null = null;
  let meshKey = "";
  // built in a worker; while one build runs, only the latest settings wait for the next
  const worker = new Worker(new URL("./build.worker.ts", import.meta.url), { type: "module" });
  let building = false;
  let waiting: LatticeParams | null = null;
  let built = 0;
  // Suzanne is fetched the first time she is asked for, and handed to the worker once
  let meshBin: ArrayBuffer | null = null;
  let meshSent = false;
  const request = async (params: LatticeParams) => {
    if (building) {
      waiting = { ...params };
      return;
    }
    building = true;
    if (params.form === "suzanne" && !meshBin) {
      meshBin = await (await fetch("./suzanne.mesh.bin")).arrayBuffer();
      makeFormMesh(meshBin);
    }
    const mesh = params.form !== "vessel" && !meshSent && meshBin ? meshBin.slice(0) : undefined;
    if (mesh) meshSent = true;
    worker.postMessage({ id: ++built, params: { ...params }, mesh }, mesh ? [mesh] : []);
  };
  worker.onmessage = (e: MessageEvent<Lattice & { ms: number }>) => {
    building = false;
    upload(e.data, e.data.ms);
    if (waiting) {
      const w = waiting;
      waiting = null;
      request(w);
    }
  };
  const upload = (L: Lattice, ms: number) => {
    mesh?.vb.destroy();
    mesh?.ib.destroy();
    const vb = device.createBuffer({ size: Math.max(16, L.vertices.byteLength), usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const ib = device.createBuffer({ size: Math.max(16, L.indices.byteLength), usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vb, 0, L.vertices);
    device.queue.writeBuffer(ib, 0, L.indices);
    const glints = Math.min(MAX_GLINTS, L.glints.length / 4);
    if (glints) device.queue.writeBuffer(glintBuf, 0, L.glints, 0, glints * 4);
    mesh = { vb, ib, count: L.indices.length, glints, ms, tris: L.indices.length / 3 };
  };

  // ---------------------------------------------------------------- targets
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge" });
  type Targets = {
    w: number;
    h: number;
    samples: number;
    ms: GPUTexture | null;
    hdr: GPUTexture;
    dofTex: GPUTexture;
    layers: { rt: GPUTexture; tmp: GPUTexture; out: GPUTexture }[];
    blurs: GPUBindGroup[];
    combine: GPUBindGroup;
    depth: GPUTexture;
    scene: GPUBindGroup;
    mips: GPUTexture[];
    downs: GPUBindGroup[];
    comp: GPUBindGroup;
  };
  let targets: Targets | null = null;
  const makeTargets = (w: number, h: number, samples: number): Targets => {
    const TU = GPUTextureUsage;
    const ms = samples > 1 ? device.createTexture({ size: [w, h], format: HDR, sampleCount: samples, usage: TU.RENDER_ATTACHMENT }) : null;
    const hdr = device.createTexture({ size: [w, h], format: HDR, usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    // the picture after the depth of field
    const dofTex = device.createTexture({ size: [w, h], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING });
    const mips: GPUTexture[] = [];
    let mw = w;
    let mh = h;
    for (let k = 0; k < 5; k++) {
      mw = Math.max(1, Math.ceil(mw / 2));
      mh = Math.max(1, Math.ceil(mh / 2));
      mips.push(device.createTexture({ size: [mw, mh], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }));
    }
    const pb = { binding: 0, resource: { buffer: postBuf } };
    const downs = mips.map((m, k) =>
      device.createBindGroup({
        layout: downL,
        entries: [pb, { binding: 1, resource: (k ? mips[k - 1] : dofTex).createView() }, { binding: 2, resource: sampler }, { binding: 3, resource: m.createView() }],
      }),
    );
    const comp = device.createBindGroup({
      layout: compL,
      entries: [pb, { binding: 1, resource: dofTex.createView() }, { binding: 2, resource: sampler }, ...mips.map((m, k) => ({ binding: 4 + k, resource: m.createView() }))],
    });
    const depth = device.createTexture({ size: [w, h], format: "depth32float", usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING });
    // the three out-of-focus layers at half size: drawn into, blurred across, blurred down
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    const layers = [0, 1, 2].map(() => ({
      rt: device.createTexture({ size: [hw, hh], format: HDR, usage: TU.RENDER_ATTACHMENT | TU.TEXTURE_BINDING }),
      tmp: device.createTexture({ size: [hw, hh], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }),
      out: device.createTexture({ size: [hw, hh], format: HDR, usage: TU.STORAGE_BINDING | TU.TEXTURE_BINDING }),
    }));
    const blurs = layers.flatMap((L, k) =>
      [
        [L.rt, L.tmp],
        [L.tmp, L.out],
      ].map(([a, b], d) =>
        device.createBindGroup({
          layout: blurL,
          entries: [pb, { binding: 1, resource: a.createView() }, { binding: 3, resource: b.createView() }, { binding: 11, resource: { buffer: blurSteps[k * 2 + d] } }],
        }),
      ),
    );
    const combine = device.createBindGroup({
      layout: combL,
      entries: [
        pb,
        { binding: 1, resource: hdr.createView() },
        { binding: 2, resource: sampler },
        { binding: 3, resource: dofTex.createView() },
        ...layers.map((L, k) => ({ binding: 12 + k, resource: L.out.createView() })),
      ],
    });
    return { w, h, samples, ms, hdr, dofTex, layers, blurs, combine, depth, scene: sceneGroupFor(depth), mips, downs, comp };
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
    pose.yaw += (e.clientX - drag.x) * 0.005;
    pose.pitch = Math.max(-40, Math.min(50, pose.pitch + (e.clientY - drag.y) * 0.15));
    drag = { x: e.clientX, y: e.clientY };
  };
  const onUp = () => (drag = null);
  const onWheel = (e: WheelEvent) => {
    view.distance = Math.max(1.2, Math.min(8, view.distance * Math.exp(e.deltaY * 0.001)));
    e.preventDefault();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === " ") {
      view.hold = !view.hold;
      e.preventDefault();
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    }
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("keydown", onKey);

  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0;";
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "lattice" });
  gui.close();
  // each form its own cell size and framing
  const PRESETS: Record<string, { lattice: Partial<LatticeParams>; view: Partial<typeof view>; look: Partial<typeof look> }> = {
    vessel: { lattice: { cells: 22, fine: 0.45, thorns: 0.3 }, view: { distance: 3.9 }, look: { core: 1.3, farDim: 0.35, form: 0.6, bloom: 1.2, focus: -0.4 } },
    // a face reads by its own shading: less glow from inside, more of the form's edges and planes
    suzanne: { lattice: { cells: 46, fine: 0.35, thorns: 0.15 }, view: { distance: 2.75 }, look: { core: 0.7, farDim: 0.15, form: 1.5, bloom: 1.2, focus: -0.45 } },
  };
  const usePreset = (form: string) => {
    Object.assign(lattice, PRESETS[form].lattice);
    Object.assign(view, PRESETS[form].view);
    Object.assign(look, PRESETS[form].look);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  gui.add(lattice, "form", ["vessel", "suzanne"]).name("form").onChange(usePreset);
  const fw = gui.addFolder("web");
  fw.add(lattice, "cells", 8, 60, 1).name("cells round");
  fw.add(lattice, "layers", 1, 3, 1).name("skins");
  fw.add(lattice, "shrink", 0.5, 0.97, 0.01).name("inner skin size");
  fw.add(lattice, "jitter", 0, 1, 0.01).name("irregularity");
  fw.add(lattice, "warp", 0, 1.5, 0.01).name("wobble");
  fw.add(lattice, "fine", 0, 1, 0.01).name("finer chords");
  fw.add(lattice, "seed", 0, 99, 1);
  const fg = gui.addFolder("glass");
  fg.add(lattice, "rMain", 0.0005, 0.01, 0.0001).name("strand radius");
  fg.add(lattice, "rFine", 0.0003, 0.005, 0.0001).name("chord radius");
  fg.add(lattice, "rRim", 0.001, 0.015, 0.0001).name("rim radius");
  fg.add(lattice, "flare", 0, 3, 0.01).name("knot swelling");
  fg.add(lattice, "crown", 0, 1, 0.01).name("crown spikes");
  fg.add(lattice, "crownLen", 0, 0.2, 0.001).name("spike length");
  fg.add(lattice, "thorns", 0, 1, 0.01).name("body thorns");
  fg.add(lattice, "thornLen", 0, 0.1, 0.001).name("thorn length");
  fg.add(lattice, "hem", 0, 1, 0.01).name("hem threads");
  fg.add(lattice, "hemLen", 0, 0.8, 0.01).name("thread length");
  fg.add(lattice, "sides", 3, 12, 1).name("tube sides");
  fg.add(lattice, "merge").name("one surface");
  fg.add(lattice, "fillet", 0, 0.03, 0.0005).name("fillets");
  fg.add(lattice, "res", 0.0008, 0.005, 0.0001).name("surface grid");
  const fl = gui.addFolder("look");
  fl.add(look, "exposure", 0.1, 4, 0.01);
  fl.add(look, "bloom", 0, 3, 0.01);
  fl.add(look, "strand", 0, 3, 0.01).name("glass brightness");
  fl.add(look, "farDim", 0, 1, 0.01).name("far side");
  fl.add(look, "behind", 0.005, 0.3, 0.001).name("behind the front");
  fl.add(look, "form", 0, 2, 0.01).name("form shading");
  fl.add(look, "hide", 0, 1, 0.01).name("rod darkness");
  fl.add(look, "threshold", 0, 3, 0.01).name("bloom from");
  const fd = gui.addFolder("depth of field");
  fd.add(look, "dof").name("on");
  fd.add(look, "focus", -1.5, 1.5, 0.01).name("focus (from the middle)");
  fd.add(look, "aperture", 0, 150, 0.5).name("aperture");
  fd.add(look, "maxBlur", 0, 40, 0.5).name("most blur (px)");
  fd.close();
  fl.add(look, "core", 0, 5, 0.01).name("inner glow");
  fl.add(look, "coreSize", 0.05, 0.8, 0.01).name("glow size");
  fl.add(look, "snow", 0, 3, 0.01).name("specks");
  fl.add(look, "stars", 0, 3, 0.01).name("glints");
  fl.add(look, "sway", 0, 0.2, 0.001).name("thread sway");
  fl.add(look, "msaa").name("4x multisampling");
  const fa = gui.addFolder("wrapping");
  fa.add(weave, "on");
  fa.add(weave, "progress", 0, 1, 0.001)
    .name("wrapped")
    .listen()
    .onChange(() => (weave.play = false));
  // playing on from where the slider was left: the clock put where the wrapping reaches that far
  fa.add(weave, "play")
    .listen()
    .onChange((v: boolean) => v && (wrapClock = weave.grow * (0.5 - Math.sin(Math.asin(1 - 2 * weave.progress) / 3))));
  fa.add(weave, "loop");
  fa.add({ replay: () => ((wrapClock = 0), (weave.play = true)) }, "replay");
  fa.add(weave, "grow", 1, 20, 0.1).name("wrap (s)");
  fa.add(weave, "hold", 0, 20, 0.1).name("hold (s)");
  fa.add(weave, "undo", 0, 20, 0.1).name("unwrap (s)");
  fa.add(weave, "band", 0.05, 1, 0.01).name("settling band");
  fa.add(weave, "flare", 0, 1, 0.01).name("curl out");
  fa.add(weave, "uneven", 0, 1, 0.01).name("unevenness");
  fa.add(weave, "scale", 0.3, 6, 0.01).name("uneven patch scale");
  fa.add(weave, "glow", 0, 4, 0.01).name("hot edge");
  const fv = gui.addFolder("view");
  fv.add(view, "spin", -0.3, 0.3, 0.001);
  fv.add(view, "hold").name("hold still (space)");
  fv.add(view, "distance", 1.2, 8, 0.01);
  fv.add(view, "fov", 15, 70, 0.5);
  for (const f of [fw, fg, fl, fa, fv]) f.close();

  // ---------------------------------------------------------------- a frame
  const cam = new PerspectiveCamera();
  let time = 0;
  let spinAngle = 0;
  let wrapClock = 0;
  let glowGrown = 1;
  let frame = 0;
  const clock = { paused: false };

  const step = (dt: number) => {
    time += dt;
    spinAngle += view.hold ? 0 : dt * view.spin * Math.PI * 2;
    if (weave.play) wrapClock += dt;
    const key = JSON.stringify(lattice);
    if (key !== meshKey) {
      meshKey = key;
      request(lattice);
    }
    const W = canvas.width;
    const H = canvas.height;
    const samples = look.msaa ? 4 : 1;
    if (!targets || targets.w !== W || targets.h !== H || targets.samples !== samples) {
      targets?.hdr.destroy();
      targets?.dofTex.destroy();
      targets?.layers.forEach((L) => [L.rt, L.tmp, L.out].forEach((t) => t.destroy()));
      targets?.depth.destroy();
      targets?.ms?.destroy();
      targets?.mips.forEach((m) => m.destroy());
      targets = makeTargets(W, H, samples);
    }
    const T = targets;

    const pit = (pose.pitch * Math.PI) / 180;
    cam.fov = view.fov;
    cam.aspect = W / H;
    cam.near = 0.05;
    cam.far = 50;
    cam.position.set(Math.sin(pose.yaw) * Math.cos(pit) * view.distance, Math.sin(pit) * view.distance, Math.cos(pose.yaw) * Math.cos(pit) * view.distance);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    const vp = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse);
    const f = new Vector3();
    cam.getWorldDirection(f);
    const r = new Vector3().crossVectors(f, cam.up).normalize();
    const u = new Vector3().crossVectors(r, f);
    uni.set(vp.elements, 0);
    uni.set([cam.position.x, cam.position.y, cam.position.z, time], 16);
    uni.set([f.x, f.y, f.z, spinAngle], 20);
    uni.set([r.x, r.y, r.z, Math.tan((view.fov * Math.PI) / 360)], 24);
    uni.set([u.x, u.y, u.z, W / H], 28);
    // the glow sits in the vessel's belly, or the middle of the head
    uni.set([0, lattice.form === "vessel" ? SHAPE.y0 + look.coreY * SHAPE.Hlen : 0, 0, look.core * glowGrown], 32);
    uni.set([look.exposure, look.bloom, look.coreSize, look.strand], 36);
    uni.set([look.snow, look.stars, look.starSize * (H / 900), look.sway], 40);
    uni.set([W, H, look.farDim, mesh?.glints ?? 0], 44);
    const useDepth = lattice.form !== "vessel" && !!formMesh;
    uni.set([cam.near, cam.far, useDepth ? 1 : 0, look.behind], 48);
    uni.set([look.form, look.hide, 0, 0], 52);
    // focus on the near side of the form; blur sized for the picture's height
    const px = H / 900;
    const maxR = look.dof ? look.maxBlur * px : 0;
    uni.set([look.aperture * px, view.distance + look.focus, maxR, 0], 56);
    // where the wrapping front is: up through the form while growing, back down while unwrapping
    const [lo, hi] = lattice.form === "vessel" ? [-1.3, 1.08] : [-0.62, 0.62];
    const cycle = weave.grow + weave.hold + weave.undo + weave.rest;
    let tw = wrapClock;
    if (weave.loop) tw %= cycle;
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    if (weave.play) {
      if (tw < weave.grow) weave.progress = ease(tw / weave.grow);
      else if (tw < weave.grow + weave.hold) weave.progress = 1;
      else if (tw < weave.grow + weave.hold + weave.undo) weave.progress = 1 - ease((tw - weave.grow - weave.hold) / weave.undo);
      else weave.progress = 0;
    }
    const reach = weave.progress;
    // the noise moves the front by up to `amp` either way, but rarely past 0.6 of it: the sweep is sized for that,
    // so the whole slider is spent wrapping (the shader holds 0 to nothing and 1 to all settled exactly)
    const amp = weave.uneven * (hi - lo);
    const front = lo - weave.band - 0.6 * amp + reach * (hi - lo + 2 * weave.band + 1.2 * amp);
    uni.set([front, weave.band, weave.flare, amp], 60);
    // the light inside gathers as the glass closes round it
    glowGrown = weave.on ? 0.08 + 0.92 * reach * reach : 1;
    uni.set([weave.on ? 1 : 0, weave.glow, weave.scale, reach], 64);
    device.queue.writeBuffer(uniBuf, 0, uni);
    postUni.set([look.exposure, look.bloom, frame, look.threshold, W, maxR, 0, look.dof ? 1 : 0]);
    device.queue.writeBuffer(postBuf, 0, postUni);
    // a disc of radius r blurs about like a Gaussian of r / 2; the layers are half size, so r / 4 of their pixels
    [0.25, 0.5, 1].forEach((share, k) => {
      const sigma = (maxR * share) / 4;
      device.queue.writeBuffer(blurSteps[k * 2], 0, new Float32Array([1, 0, sigma, 0]));
      device.queue.writeBuffer(blurSteps[k * 2 + 1], 0, new Float32Array([0, 1, sigma, 0]));
    });

    const P = pipesFor(samples);
    const enc = device.createCommandEncoder();
    // the form's front surface, depth only
    const dp = enc.beginRenderPass({ colorAttachments: [], depthStencilAttachment: { view: T.depth.createView(), depthClearValue: 1, depthLoadOp: "clear", depthStoreOp: "store" } });
    if (useDepth && formMesh) {
      dp.setPipeline(depthPipe);
      dp.setBindGroup(0, depthGroup);
      dp.setVertexBuffer(0, formMesh.vb);
      dp.setIndexBuffer(formMesh.ib, "uint32");
      dp.drawIndexed(formMesh.count);
    }
    dp.end();
    const rp = enc.beginRenderPass({
      colorAttachments: [
        {
          view: (T.ms ?? T.hdr).createView(),
          resolveTarget: T.ms ? T.hdr.createView() : undefined,
          loadOp: "clear",
          storeOp: T.ms ? "discard" : "store",
          clearValue: [0, 0, 0, 1],
        },
      ],
    });
    rp.setBindGroup(0, T.scene);
    rp.setPipeline(P.back);
    rp.draw(3);
    if (mesh && mesh.count) {
      rp.setPipeline(P.tube);
      rp.setVertexBuffer(0, mesh.vb);
      rp.setIndexBuffer(mesh.ib, "uint32");
      rp.drawIndexed(mesh.count);
    }
    rp.setPipeline(P.snow);
    rp.draw(4, 1400);
    if (mesh?.glints) {
      rp.setPipeline(P.star);
      rp.draw(4, mesh.glints);
    }
    rp.end();
    // the out-of-focus share, at half size
    if (look.dof && mesh && mesh.count) {
      const bp = enc.beginRenderPass({ colorAttachments: T.layers.map((L) => ({ view: L.rt.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 0] })) });
      bp.setBindGroup(0, T.scene);
      bp.setPipeline(tubeBlurredPipe);
      bp.setVertexBuffer(0, mesh.vb);
      bp.setIndexBuffer(mesh.ib, "uint32");
      bp.drawIndexed(mesh.count);
      if (mesh.glints) {
        bp.setPipeline(starBlurredPipe);
        bp.draw(4, mesh.glints);
      }
      bp.end();
    }
    const cp = enc.beginComputePass();
    if (look.dof) {
      cp.setPipeline(blurPipe);
      T.blurs.forEach((g) => {
        cp.setBindGroup(0, g);
        cp.dispatchWorkgroups(Math.ceil(T.layers[0].rt.width / 8), Math.ceil(T.layers[0].rt.height / 8));
      });
    }
    cp.setPipeline(combPipe);
    cp.setBindGroup(0, T.combine);
    cp.dispatchWorkgroups(Math.ceil(T.w / 8), Math.ceil(T.h / 8));
    cp.setPipeline(downPipe);
    T.mips.forEach((m, k) => {
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
    frame++;
  };

  (window as any).__lattice = {
    lattice,
    usePreset,
    weave,
    setWrapClock: (t: number) => (wrapClock = t),
    look,
    view,
    pose,
    clock,
    get frame() {
      return frame;
    },
    get mesh() {
      return mesh && { tris: mesh.tris, glints: mesh.glints, ms: Math.round(mesh.ms) };
    },
    get ready() {
      return !!mesh && !building && !waiting;
    },
    // so the shot tool can call it like the other pages
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
    canvas.removeEventListener("wheel", onWheel);
    window.removeEventListener("keydown", onKey);
    worker.terminate();
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
