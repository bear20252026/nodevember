/**
 * Prism: a small glass knot, slowly melting, hangs in a beam of white light in a dark room and paints
 * ribbons of spectrum across the floor.
 *
 * Each frame a grid of photons per wavelength band is traced from the lamp through the knot (in, any
 * total internal reflections, out, and into another strand if it meets one) to the floor. Every cell of
 * a band's grid is then drawn where its four corners landed, as bright as the cell was squeezed: the
 * neighbours tell how each bundle stretched (adaptive anisotropic footprints, taken to the limit of a
 * light mesh), so the caustics stay razor sharp however thin. Bands are weighted to sum to white.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { Matrix4, PerspectiveCamera, Vector3 } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import commonCode from "./common.wgsl?raw";
import blendCode from "./blend.wgsl?raw";
import meshCode from "./mesh.wgsl?raw";
import traceCode from "./trace.wgsl?raw";
import viewCode from "./view.wgsl?raw";

const DURATION = 24_000;

const knot = {
  /** radius of the knot's core circle, its swing about it, and the tube */
  R: 0.32,
  r0: 0.14,
  tube: 0.075,
  /** how flat the tube's section is, breathing about this */
  flat: 0.45,
  /** how much the tube swells and thins along its length */
  bulge: 0.35,
  /** strength of the melting warp */
  melt: 0.035,
  /** turns about the vertical per loop, and the lean of its plane */
  turns: 1,
  tilt: 0.9,
  height: 2.2,
};

const light = {
  /** where the lamp is, as compass and elevation in degrees */
  azimuth: 200,
  elevation: 34,
  /** a thin slit of light, which the knot fans into spectra, or the whole knot flooded */
  beam: "slit" as "slit" | "flood",
  /** slit width, as a share of the beam's radius */
  slitWidth: 0.03,
  /** how far the slit sweeps across the knot, either way, and how far it turns, over a loop */
  sweep: 0.3,
  swing: 0.6,
  /** the lamp's strength through a slit (a flood is 1) */
  power: 12,
  /** strength of the light that misses the glass */
  direct: 0,
  /** wavelength bands */
  bands: 8,
  /** spread of the index of refraction, as a multiple of crown glass's */
  dispersion: 18,
  ior: 1.5,
  /** photons along each side of the beam */
  res: 384,
};

const look = {
  exposure: 4,
  ambient: 0.012,
  haze: 0.02,
  /** how much the lamp glints off the knot and lights its edges */
  glassLight: 1,
  floor: "#d9d4cc",
  /** brightest a cell may be made, against the beam */
  maxGain: 400,
  /** cells longer than this on the floor are torn, not drawn */
  tearLen: 0.6,
  /** light image texels per side */
  lightRes: 2048,
  /** weight of each new frame in the light image's running average while playing (held still it converges) */
  ema: 0.3,
  /** side of the floor the light image covers */
  span: 9,
  /** light shaded per photon, from its neighbours, rather than flat per cell */
  smooth: true,
  /** the scene, or the light image from above */
  view: "scene" as "scene" | "light",
};

const UNIFORMS = [
  "time",
  "nu",
  "nv",
  "power",
  "bands",
  "direct",
  "beamR",
  "beamDist",
  "bound",
  "cx",
  "cy",
  "cz",
  "R",
  "r0",
  "tube",
  "ex",
  "ey",
  "twistPh",
  "bulge",
  "bulgePh",
  "melt",
  "meltPh",
  "spin",
  "tilt",
  "lx",
  "ly",
  "lz",
  "cellArea",
  "maxGain",
  "tearLen",
  "fx0",
  "fz0",
  "fsize",
  "exposure",
  "ambient",
  "haze",
  "glassLight",
  "debug",
  "smoothShade",
  "jx",
  "jy",
  "slitW",
  "slitOff",
  "slitAngle",
  "floorR",
  "floorG",
  "floorB",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

// CIE 1931 colour matching, the multi-lobe fit of Wyman, Sloan and Shirley (2013)
const g = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
const cie = (l: number) => [
  1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
  0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
  1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
];

/** per band: index of refraction (Cauchy) and a colour; the colours over all bands add up to white */
const makeBands = () => {
  const n = Math.max(3, Math.min(16, Math.round(light.bands)));
  const lo = 400;
  const hi = 700;
  const out = new Float32Array(64);
  const rgbs: number[][] = [];
  const iors: number[] = [];
  for (let b = 0; b < n; b++) {
    const a = lo + ((hi - lo) * b) / n;
    const e = lo + ((hi - lo) * (b + 1)) / n;
    let X = 0;
    let Y = 0;
    let Z = 0;
    for (let k = 0; k < 16; k++) {
      const [x, y, z] = cie(a + ((e - a) * (k + 0.5)) / 16);
      X += x;
      Y += y;
      Z += z;
    }
    // to linear sRGB, out-of-gamut spectral colours clipped
    const rgb = [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z].map((v) => Math.max(0, v));
    rgbs.push(rgb);
    const um = ((a + e) / 2) * 1e-3;
    // crown glass's Cauchy B is about 0.0042 um^2, its A set so the middle sits at `ior`
    const B = 0.0042 * light.dispersion;
    iors.push(light.ior - B / 0.55 ** 2 + B / (um * um));
  }
  const sum = [0, 1, 2].map((c) => rgbs.reduce((s, v) => s + v[c], 0) || 1);
  rgbs.forEach((v, b) => out.set([iors[b], v[0] / sum[0], v[1] / sum[1], v[2] / sum[2]], 4 * b));
  return { data: out, count: n };
};

const hex = (s: string) => {
  const v = parseInt(s.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.pow(c / 255, 2.2));
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const adapter = await navigator.gpu?.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) throw new Error("this needs WebGPU");
  const device = await adapter.requestDevice({
    requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize, maxBufferSize: adapter.limits.maxBufferSize },
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
  const V = GPUShaderStage.VERTEX;
  const F = GPUShaderStage.FRAGMENT;
  const uni = (visibility: number) => [
    { binding: 0, visibility, buffer: { type: "uniform" as const } },
    { binding: 1, visibility, buffer: { type: "uniform" as const } },
  ];
  const traceLayout = device.createBindGroupLayout({ entries: [...uni(C), { binding: 2, visibility: C, buffer: { type: "storage" } }] });
  const meshLayout = device.createBindGroupLayout({ entries: [...uni(V | F), { binding: 2, visibility: V, buffer: { type: "read-only-storage" } }] });
  const viewLayout = device.createBindGroupLayout({
    entries: [
      ...uni(V | F),
      { binding: 2, visibility: V | F, buffer: { type: "uniform" } },
      { binding: 3, visibility: F, texture: { sampleType: "float" } },
      { binding: 4, visibility: F, sampler: { type: "filtering" } },
    ],
  });
  const layoutOf = (l: GPUBindGroupLayout) => device.createPipelineLayout({ bindGroupLayouts: [l] });

  const traceModule = compile(traceCode, "trace");
  const meshModule = compile(meshCode, "mesh");
  const viewModule = compile(viewCode, "view");
  const blendModule = compile(blendCode, "blend");
  const tracePipeline = device.createComputePipeline({ layout: layoutOf(traceLayout), compute: { module: traceModule, entryPoint: "trace" } });
  const LIGHT_FORMAT: GPUTextureFormat = "rgba16float";
  const add: GPUBlendComponent = { operation: "add", srcFactor: "one", dstFactor: "one" };
  const meshPipeline = device.createRenderPipeline({
    layout: layoutOf(meshLayout),
    vertex: { module: meshModule, entryPoint: "vs" },
    fragment: { module: meshModule, entryPoint: "fs", targets: [{ format: LIGHT_FORMAT, blend: { color: add, alpha: add } }] },
    primitive: { topology: "triangle-list" },
    multisample: { count: 4 },
  });
  const blendLayout = device.createBindGroupLayout({ entries: [...uni(V | F), { binding: 2, visibility: F, texture: { sampleType: "unfilterable-float" } }] });
  const blendPipeline = device.createRenderPipeline({
    layout: layoutOf(blendLayout),
    vertex: { module: blendModule, entryPoint: "vs" },
    fragment: {
      module: blendModule,
      entryPoint: "fs",
      targets: [
        {
          format: LIGHT_FORMAT,
          blend: {
            color: { operation: "add", srcFactor: "constant", dstFactor: "one-minus-constant" },
            alpha: { operation: "add", srcFactor: "constant", dstFactor: "one-minus-constant" },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" },
  });
  const viewPipeline = device.createRenderPipeline({
    layout: layoutOf(viewLayout),
    vertex: { module: viewModule, entryPoint: "vs" },
    fragment: { module: viewModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const uniforms = new Float32Array(Math.ceil(UNIFORMS.length / 4) * 4);
  const uIndex = Object.fromEntries(UNIFORMS.map((n, i) => [n, i])) as Record<UName, number>;
  const setU = (values: Partial<Record<UName, number>>) => {
    for (const k in values) uniforms[uIndex[k as UName]] = values[k as UName]!;
  };
  const uniformBuffer = device.createBuffer({ size: uniforms.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const bandBuffer = device.createBuffer({ size: 256, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const camBuffer = device.createBuffer({ size: 80, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  let bandCount = 0;
  const writeBands = () => {
    const b = makeBands();
    bandCount = b.count;
    device.queue.writeBuffer(bandBuffer, 0, b.data);
  };
  writeBands();
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const uniEntries = [
    { binding: 0, resource: { buffer: uniformBuffer } },
    { binding: 1, resource: { buffer: bandBuffer } },
  ];

  // ---------- photons and the light image ----------

  type Res = {
    /** photons along and across the beam, and how many the buffer holds */
    nu: number;
    nv: number;
    capacity: number;
    bands: number;
    lightRes: number;
    landed: GPUBuffer;
    light: GPUTexture;
    acc: GPUTexture;
    msaa: GPUTexture;
    trace: GPUBindGroup;
    mesh: GPUBindGroup;
    blend: GPUBindGroup;
    view: GPUBindGroup;
  };
  let R: Res | undefined;
  /** frames the light has been accumulating unchanged (time held, settings untouched) */
  let settled = 0;
  let lastKey = "";
  const ensure = () => {
    // a slit has many photons along it and few across, so a cell is about square on the glass
    const res = Math.round(light.res);
    const slit = light.beam === "slit";
    const nu = slit ? res * 3 : res;
    const nv = slit ? Math.max(6, Math.round(nu * light.slitWidth)) : res;
    const lightRes = Math.round(look.lightRes);
    if (R && R.capacity >= nu * nv * bandCount && R.lightRes === lightRes) {
      R.nu = nu;
      R.nv = nv;
      R.bands = bandCount;
      return R;
    }
    if (R) {
      R.landed.destroy();
      R.light.destroy();
      R.acc.destroy();
      R.msaa.destroy();
    }
    const capacity = nu * nv * bandCount;
    const landed = device.createBuffer({ size: capacity * 16, usage: GPUBufferUsage.STORAGE });
    const light2 = device.createTexture({ size: [lightRes, lightRes], format: LIGHT_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    const acc = device.createTexture({ size: [lightRes, lightRes], format: LIGHT_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
    settled = 0;
    const msaa = device.createTexture({ size: [lightRes, lightRes], format: LIGHT_FORMAT, sampleCount: 4, usage: GPUTextureUsage.RENDER_ATTACHMENT });
    R = {
      nu,
      nv,
      capacity,
      bands: bandCount,
      lightRes,
      landed,
      light: light2,
      acc,
      msaa,
      trace: device.createBindGroup({ layout: traceLayout, entries: [...uniEntries, { binding: 2, resource: { buffer: landed } }] }),
      mesh: device.createBindGroup({ layout: meshLayout, entries: [...uniEntries, { binding: 2, resource: { buffer: landed } }] }),
      blend: device.createBindGroup({ layout: blendLayout, entries: [...uniEntries, { binding: 2, resource: light2.createView() }] }),
      view: device.createBindGroup({
        layout: viewLayout,
        entries: [...uniEntries, { binding: 2, resource: { buffer: camBuffer } }, { binding: 3, resource: acc.createView() }, { binding: 4, resource: sampler }],
      }),
    };
    return R;
  };

  // ---------- camera ----------

  const camera = new PerspectiveCamera(38, width / height, 0.05, 100);
  const controls = new OrbitControls(camera, canvas);
  // look at where the light lands, from the side, with the knot up in the corner of the frame
  {
    const az = (light.azimuth * Math.PI) / 180;
    const el = (light.elevation * Math.PI) / 180;
    const reachOut = knot.height / Math.tan(el);
    const sx = Math.cos(az) * -reachOut;
    const sz = Math.sin(az) * -reachOut;
    controls.target.set(sx * 0.6, 0.6, sz * 0.6);
    camera.position.set(sx * 0.6 - 0.2, 4.6, sz * 0.6 + 8.2);
  }
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.update();

  // ---------- panel ----------

  const play = { playing: true, t: 0 };
  const playing = () => play.playing;
  const gui = new GUI({ title: "prism" });
  gui.close();
  gui.add(play, "playing");
  gui
    .add(play, "t", 0, 1, 0.0001)
    .name("time")
    .listen()
    .onChange(() => (play.playing = false));
  const fk = gui.addFolder("knot");
  fk.add(knot, "R", 0.15, 0.6);
  fk.add(knot, "r0", 0.02, 0.3);
  fk.add(knot, "tube", 0.02, 0.15);
  fk.add(knot, "flat", 0, 0.8);
  fk.add(knot, "bulge", 0, 0.8);
  fk.add(knot, "melt", 0, 0.12);
  fk.add(knot, "turns", 0, 3, 1);
  fk.add(knot, "tilt", -1.6, 1.6);
  fk.add(knot, "height", 0.5, 3);
  const fl = gui.addFolder("light");
  fl.add(light, "azimuth", 0, 360);
  fl.add(light, "elevation", 10, 89);
  fl.add(light, "beam", ["slit", "flood"]);
  fl.add(light, "slitWidth", 0.005, 0.4);
  fl.add(light, "sweep", 0, 1);
  fl.add(light, "swing", 0, 1.6);
  fl.add(light, "power", 0.5, 40);
  fl.add(light, "direct", 0, 1);
  fl.add(light, "bands", 3, 16, 1).onChange(writeBands);
  fl.add(light, "dispersion", 0, 20).onChange(writeBands);
  fl.add(light, "ior", 1.2, 2).onChange(writeBands);
  fl.add(light, "res", [192, 256, 384, 512, 768]);
  const fo = gui.addFolder("look");
  fo.add(look, "exposure", 0, 4);
  fo.add(look, "ambient", 0, 0.5);
  fo.add(look, "haze", 0, 0.3);
  fo.add(look, "glassLight", 0, 4);
  fo.addColor(look, "floor");
  fo.add(look, "maxGain", 10, 2000);
  fo.add(look, "tearLen", 0.05, 3);
  fo.add(look, "lightRes", [1024, 1536, 2048, 3072]);
  fo.add(look, "view", ["scene", "light"]);
  fo.add(look, "smooth");
  fo.add(look, "span", 2, 20);
  fo.add(look, "ema", 0.02, 1);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // ---------- a frame ----------

  const viewProj = new Matrix4();
  const camData = new Float32Array(20);
  let frame = 0;
  const draw = (t01: number) => {
    const r = ensure();
    if (canvas.width / canvas.height !== camera.aspect) {
      camera.aspect = canvas.width / canvas.height;
      camera.updateProjectionMatrix();
    }
    controls.update();
    camera.updateMatrixWorld();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse).invert();
    camData.set(viewProj.elements, 0);
    camData.set([camera.position.x, camera.position.y, camera.position.z, 1], 16);
    device.queue.writeBuffer(camBuffer, 0, camData);

    // held still, the light image converges to the plain average of every jittered frame
    const key = JSON.stringify([t01, knot, light, look.span, look.maxGain, look.tearLen, look.smooth]);
    settled = key === lastKey ? settled + 1 : 0;
    lastKey = key;
    // R2 low-discrepancy offsets
    const jx = ((0.7548776662 * frame) % 1) - 0.5;
    const jy = ((0.5698402909 * frame) % 1) - 0.5;
    const weight = settled === 0 ? (playing() ? look.ema : 1) : Math.max(1 / (settled + 1), 0.004);

    const slit = light.beam === "slit";
    // everything breathes with whole turns of the loop, so the loop closes
    const ph = t01 * Math.PI * 2;
    const az = (light.azimuth * Math.PI) / 180;
    const el = (light.elevation * Math.PI) / 180;
    const L = new Vector3(-Math.cos(el) * Math.cos(az), -Math.sin(el), -Math.cos(el) * Math.sin(az));
    const cy = knot.height;
    const flat = knot.flat * (0.75 + 0.25 * Math.sin(ph * 2 + 0.7));
    const reach = knot.R + knot.r0 + knot.tube * (1 + knot.bulge) * (1 + knot.flat) + knot.melt * 2;
    // the light image covers the floor round where the knot's shadow falls, out to where ribbons reach
    const shadow = new Vector3(0, cy, 0).addScaledVector(L, cy / -L.y);
    const fsize = look.span;
    const floor = hex(look.floor);
    setU({
      time: t01,
      nu: r.nu,
      nv: r.nv,
      power: slit ? light.power : 1,
      bands: r.bands,
      direct: light.direct,
      beamR: reach * 1.02,
      beamDist: 6,
      bound: reach * 1.05,
      cx: 0,
      cy,
      cz: 0,
      R: knot.R * (1 + 0.06 * Math.sin(ph + 2.1)),
      r0: knot.r0 * (1 + 0.25 * Math.sin(ph * 2 - 0.4)),
      tube: knot.tube,
      ex: 1 + flat,
      ey: 1 - flat,
      twistPh: ph * 2,
      bulge: knot.bulge,
      bulgePh: ph * 3,
      melt: knot.melt * (0.6 + 0.4 * Math.sin(ph + 1)),
      meltPh: ph,
      spin: ph * knot.turns,
      tilt: knot.tilt + 0.25 * Math.sin(ph),
      lx: L.x,
      ly: L.y,
      lz: L.z,
      cellArea: ((2 * reach * 1.02) / r.nu) * ((2 * reach * 1.02 * (slit ? light.slitWidth : 1)) / r.nv),
      maxGain: look.maxGain,
      tearLen: look.tearLen,
      fx0: shadow.x - fsize / 2,
      fz0: shadow.z - fsize / 2,
      fsize,
      exposure: look.exposure,
      ambient: look.ambient,
      haze: look.haze,
      glassLight: look.glassLight,
      jx,
      jy,
      slitW: slit ? light.slitWidth : 0,
      slitOff: slit ? light.sweep * Math.sin(ph) : 0,
      slitAngle: slit ? 0.4 + light.swing * Math.sin(ph * 2 + 0.5) : 0,
      debug: look.view === "light" ? 1 : 0,
      smoothShade: look.smooth ? 1 : 0,
      floorR: floor[0],
      floorG: floor[1],
      floorB: floor[2],
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    const cp = encoder.beginComputePass();
    cp.setPipeline(tracePipeline);
    cp.setBindGroup(0, r.trace);
    cp.dispatchWorkgroups(Math.ceil(r.nu / 8), Math.ceil(r.nv / 8));
    cp.end();
    const lp = encoder.beginRenderPass({
      colorAttachments: [{ view: r.msaa.createView(), resolveTarget: r.light.createView(), loadOp: "clear", storeOp: "discard", clearValue: [0, 0, 0, 0] }],
    });
    lp.setPipeline(meshPipeline);
    lp.setBindGroup(0, r.mesh);
    lp.draw(6 * (r.nu - 1) * (r.nv - 1), r.bands);
    lp.end();
    const bp = encoder.beginRenderPass({ colorAttachments: [{ view: r.acc.createView(), loadOp: "load", storeOp: "store" }] });
    bp.setPipeline(blendPipeline);
    bp.setBindGroup(0, r.blend);
    bp.setBlendConstant([weight, weight, weight, weight]);
    bp.draw(3);
    bp.end();
    const vp = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    vp.setPipeline(viewPipeline);
    vp.setBindGroup(0, r.view);
    vp.draw(3);
    vp.end();
    device.queue.submit([encoder.finish()]);
    frame++;
  };

  const prism = {
    knot,
    light,
    look,
    play,
    camera,
    controls,
    writeBands,
    get frame() {
      return frame;
    },
    draw,
    bench: async (frames = 20) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        draw(play.t);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
  };
  (window as any).__prism = prism;

  const due = frameCap(60);
  wrap.render = ({ playhead, recording }) => {
    if (!recording && !due()) return;
    if (play.playing) play.t = playhead;
    draw(play.t);
    stats.update();
  };

  wrap.resize = () => {};

  wrap.unload = () => {
    gui.destroy();
    controls.dispose();
    stats.dom.remove();
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
