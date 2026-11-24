/**
 * Frozen light: a twisted glass ring hangs in dark fog under a strong light, and the light it focuses
 * hangs in the air as sheets, threads and folds. After photon beams (Jarosz et al. 2011): photons are
 * traced from the light through the glass on the GPU, and the straight runs they make through the fog
 * are kept as beams, each drawn as a thin ribbon whose brightness is its power, scattered toward the eye.
 * Where many beams cross, the caustic surfaces stand in the air. A white plane can be moved through them,
 * and a pulse can be sent through in slow motion (each beam knows how far light has come along it).
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { Euler, Matrix4, PerspectiveCamera, Vector3, WebGPUCoordinateSystem } from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import commonCode from "./common.wgsl?raw";
import compositeCode from "./composite.wgsl?raw";
import drawCode from "./draw.wgsl?raw";
import frameCode from "./frame.wgsl?raw";
import glowCode from "./glow.wgsl?raw";
import traceCode from "./trace.wgsl?raw";

const glass = {
  /** radius of the ring */
  ring: 1,
  /** half length and half width of the lens-shaped section */
  length: 0.42,
  width: 0.08,
  round: 0.012,
  /** half turns of the section per lap (only halves close the ring) */
  twist: 5,
  /** how much the section swells and thins round the ring */
  swell: 0.05,
  ior: 1.5,
  /** spread of the index across red, green, blue; 0 for white light */
  dispersion: 0.02,
  absorb: 0.05,
  /** the ring's lean, degrees */
  tilt: 58,
  yaw: 24,
  /** turns per minute; above 0 the light is traced again every frame */
  spin: 0,
};

const light = {
  elevation: 64,
  azimuth: 28,
  /** radius of the spot falling on the glass */
  spot: 1.55,
  /** photons per side of the grid */
  photons: 512,
  /** straight runs kept per photon */
  segs: 5,
  /** 0 keeps the photons on a grid, which the bundles (neighbours) need */
  jitter: 0,
};

const fog = {
  /** extinction per unit */
  sigma: 0.07,
  /** forward scattering of the fog, Henyey-Greenstein g */
  g: 0.45,
  /** the light missing the glass, as beams (costly: 0 draws it as a smooth shaft instead) */
  direct: 0,
  /** the spot's shaft above the glass */
  shaft: 0.05,
  haze: 0.015,
};

const plane = {
  on: false,
  /** distance from the ring's centre along the light */
  depth: 1.4,
  size: 6,
  /** the light that misses the glass, on the paper */
  direct: 0.12,
  gain: 1.2,
  albedo: 0.85,
  ambient: 0.004,
};

const pulse = {
  on: false,
  /** units of optical path a second */
  speed: 0.9,
  /** length of the trail behind the front */
  trail: 0.45,
  /** the sculpture faintly there between pulses */
  floor: 0.04,
};

const look = {
  exposure: 1,
  /** beam brightness */
  gain: 0.06,
  /** beam radius in world units, and the narrowest it is drawn, in pixels */
  radius: 0.0018,
  minPx: 0.5,
  /** ribbons widen to meet their neighbours (1 just touches), up to maxPx half-width */
  fill: 1.2,
  maxPx: 4,
  minSin: 0.25,
  glow: 0.12,
  glowSize: 6,
  /** how much bunched light outshines spread light: (cross-section in the spot / here) ^ pow */
  bunchPow: 1.3,
  bunchMax: 25,
  /** a ray with no neighbours on its course counts as this bunched */
  stray: 0.01,
  glassRim: 0.35,
  glassSpec: 0.8,
  autoRotate: true,
};

const SCALARS = [
  "camX",
  "camY",
  "camZ",
  "lightX",
  "lightY",
  "lightZ",
  "ringR",
  "twist",
  "twistPhase",
  "swell",
  "lensR",
  "lensD",
  "lensRound",
  "ior",
  "dispersion",
  "absorb",
  "spotR",
  "launch",
  "far",
  "jitter",
  "segs",
  "np",
  "planeOn",
  "planeX",
  "planeY",
  "planeZ",
  "planeNX",
  "planeNY",
  "planeNZ",
  "planeUX",
  "planeUY",
  "planeUZ",
  "planeSize",
  "planeRes",
  "planeDirect",
  "planeGain",
  "albedo",
  "ambient",
  "beamR",
  "minPx",
  "resX",
  "resY",
  "focalPx",
  "gain",
  "directW",
  "sigma",
  "phaseG",
  "minSin",
  "pulseOn",
  "pulseFront",
  "pulseW",
  "pulseFloor",
  "exposure",
  "glow",
  "glowSize",
  "glassRim",
  "glassSpec",
  "haze",
  "shaft",
  "time",
  "bundle",
  "areaRef",
  "stray",
  "bunchMax",
  "bunchPow",
  "fill",
  "maxPx",
] as const;
type SName = (typeof SCALARS)[number];
const MATS = ["view", "proj", "invViewProj", "ringRot"] as const;
const uniStruct = `struct Uni {\n${MATS.map((m) => `  ${m}: mat4x4f,`).join("\n")}\n${SCALARS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n@group(0) @binding(0) var<uniform> U: Uni;\n`;

const LAUNCH = 4.5;
const FAR = 5.5;
const PLANE_RES = 512;

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
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

  const ALL = GPUShaderStage.COMPUTE | GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const C = GPUShaderStage.COMPUTE;
  const VF = GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT;
  const uniEntry = { binding: 0, visibility: ALL, buffer: { type: "uniform" as const } };
  const traceLayout = device.createBindGroupLayout({
    entries: [uniEntry, ...[1, 2, 3, 4].map((binding) => ({ binding, visibility: C, buffer: { type: "storage" as const } }))],
  });
  const frameLayout = device.createBindGroupLayout({
    entries: [
      uniEntry,
      { binding: 1, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: C, buffer: { type: "storage" } },
      { binding: 3, visibility: C, buffer: { type: "storage" } },
      { binding: 4, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } },
    ],
  });
  const glowLayout = device.createBindGroupLayout({
    entries: [uniEntry, { binding: 1, visibility: C, texture: { sampleType: "unfilterable-float" } }, { binding: 2, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } }],
  });
  const drawLayout = device.createBindGroupLayout({
    entries: [
      uniEntry,
      { binding: 1, visibility: VF, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: VF, buffer: { type: "read-only-storage" } },
      { binding: 3, visibility: VF, texture: { sampleType: "float" } },
      { binding: 4, visibility: VF, sampler: { type: "filtering" } },
      { binding: 5, visibility: VF, buffer: { type: "read-only-storage" } },
      { binding: 6, visibility: VF, buffer: { type: "read-only-storage" } },
    ],
  });
  const compositeLayout = device.createBindGroupLayout({
    entries: [uniEntry, { binding: 1, visibility: VF, texture: { sampleType: "float" } }, { binding: 2, visibility: VF, texture: { sampleType: "float" } }, { binding: 3, visibility: VF, sampler: { type: "filtering" } }],
  });

  const traceModule = compile(traceCode, "trace");
  const frameModule = compile(frameCode, "frame");
  const glowModule = compile(glowCode, "glow");
  const drawModule = compile(drawCode, "draw");
  const compositeModule = compile(compositeCode, "composite");
  const layoutOf = (l: GPUBindGroupLayout) => device.createPipelineLayout({ bindGroupLayouts: [l] });
  const cpipe = (l: GPUBindGroupLayout, module: GPUShaderModule, entryPoint: string) => device.createComputePipeline({ layout: layoutOf(l), compute: { module, entryPoint } });
  const P = {
    trace: cpipe(traceLayout, traceModule, "trace"),
    compact: cpipe(traceLayout, traceModule, "compact"),
    cutAndLand: cpipe(frameLayout, frameModule, "cutAndLand"),
    resolvePlane: cpipe(frameLayout, frameModule, "resolvePlane"),
    down4: cpipe(glowLayout, glowModule, "down4"),
    blurH: cpipe(glowLayout, glowModule, "blurH"),
    blurV: cpipe(glowLayout, glowModule, "blurV"),
  };
  const HDR: GPUTextureFormat = "rgba16float";
  const planePipeline = device.createRenderPipeline({
    layout: layoutOf(drawLayout),
    vertex: { module: drawModule, entryPoint: "planeVS" },
    fragment: { module: drawModule, entryPoint: "planeFS", targets: [{ format: HDR }] },
    primitive: { topology: "triangle-list" },
    depthStencil: { format: "depth32float", depthWriteEnabled: true, depthCompare: "less" },
  });
  const add: GPUBlendComponent = { srcFactor: "one", dstFactor: "one", operation: "add" };
  const beamPipeline = device.createRenderPipeline({
    layout: layoutOf(drawLayout),
    vertex: { module: drawModule, entryPoint: "beamVS" },
    fragment: { module: drawModule, entryPoint: "beamFS", targets: [{ format: HDR, blend: { color: add, alpha: add } }] },
    primitive: { topology: "triangle-list" },
    depthStencil: { format: "depth32float", depthWriteEnabled: false, depthCompare: "less" },
  });
  const compositePipeline = device.createRenderPipeline({
    layout: layoutOf(compositeLayout),
    vertex: { module: compositeModule, entryPoint: "vs" },
    fragment: { module: compositeModule, entryPoint: "fs", targets: [{ format }] },
    primitive: { topology: "triangle-list" },
  });

  const floats = new Float32Array(Math.ceil((MATS.length * 16 + SCALARS.length) / 4) * 4);
  const sIndex = Object.fromEntries(SCALARS.map((n, i) => [n, MATS.length * 16 + i])) as Record<SName, number>;
  const setU = (v: Partial<Record<SName, number>>) => {
    for (const k in v) floats[sIndex[k as SName]] = v[k as SName]!;
  };
  const setMat = (name: (typeof MATS)[number], m: Matrix4) => floats.set(m.elements, MATS.indexOf(name) * 16);
  const uniformBuffer = device.createBuffer({ size: floats.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const linear = device.createSampler({ magFilter: "linear", minFilter: "linear" });
  const uniBind = { binding: 0, resource: { buffer: uniformBuffer } };

  // ---------- photons: their beams, and per frame where the plane cuts them ----------

  type Photons = { n: number; segs: number; seg: GPUBuffer; cut: GPUBuffer; list: GPUBuffer; foot: GPUBuffer; args: GPUBuffer; trace: GPUBindGroup };
  let photons: Photons | undefined;
  const planeAcc = device.createBuffer({ size: PLANE_RES * PLANE_RES * 12, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const planeTex = device.createTexture({ size: [PLANE_RES, PLANE_RES], format: HDR, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
  let frameGroup: GPUBindGroup | undefined;
  let drawGroup: GPUBindGroup | undefined;
  let dirty = true;
  const ensurePhotons = () => {
    if (photons && photons.n === light.photons && photons.segs === light.segs) return photons;
    if (photons) [photons.seg, photons.cut, photons.list, photons.foot, photons.args].forEach((b) => b.destroy());
    const n = light.photons;
    const seg = device.createBuffer({ size: n * n * light.segs * 32, usage: GPUBufferUsage.STORAGE });
    const cut = device.createBuffer({ size: n * n * 8, usage: GPUBufferUsage.STORAGE });
    const slots = n * n * light.segs;
    const list = device.createBuffer({ size: slots * 4, usage: GPUBufferUsage.STORAGE });
    const foot = device.createBuffer({ size: slots * 48, usage: GPUBufferUsage.STORAGE });
    const args = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    photons = {
      n,
      segs: light.segs,
      seg,
      cut,
      list,
      foot,
      args,
      trace: device.createBindGroup({
        layout: traceLayout,
        entries: [uniBind, { binding: 1, resource: { buffer: seg } }, { binding: 2, resource: { buffer: list } }, { binding: 3, resource: { buffer: foot } }, { binding: 4, resource: { buffer: args } }],
      }),
    };
    frameGroup = device.createBindGroup({
      layout: frameLayout,
      entries: [uniBind, { binding: 1, resource: { buffer: seg } }, { binding: 2, resource: { buffer: cut } }, { binding: 3, resource: { buffer: planeAcc } }, { binding: 4, resource: planeTex.createView() }],
    });
    drawGroup = device.createBindGroup({
      layout: drawLayout,
      entries: [
        uniBind,
        { binding: 1, resource: { buffer: seg } },
        { binding: 2, resource: { buffer: cut } },
        { binding: 3, resource: planeTex.createView() },
        { binding: 4, resource: linear },
        { binding: 5, resource: { buffer: list } },
        { binding: 6, resource: { buffer: foot } },
      ],
    });
    dirty = true;
    return photons;
  };

  // ---------- screen targets ----------

  type Targets = { w: number; h: number; hdr: GPUTexture; depth: GPUTexture; q: GPUTexture[]; glow: GPUBindGroup[]; composite: GPUBindGroup };
  let targets: Targets | undefined;
  const ensureTargets = (w: number, h: number) => {
    if (targets && targets.w === w && targets.h === h) return targets;
    if (targets) [targets.hdr, targets.depth, ...targets.q].forEach((t) => t.destroy());
    const tex = (tw: number, th: number) => device.createTexture({ size: [tw, th], format: HDR, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT });
    const hdr = tex(w, h);
    const depth = device.createTexture({ size: [w, h], format: "depth32float", usage: GPUTextureUsage.RENDER_ATTACHMENT });
    const q = [tex(Math.ceil(w / 4), Math.ceil(h / 4)), tex(Math.ceil(w / 4), Math.ceil(h / 4))];
    const g = (a: GPUTexture, b: GPUTexture) => device.createBindGroup({ layout: glowLayout, entries: [uniBind, { binding: 1, resource: a.createView() }, { binding: 2, resource: b.createView() }] });
    targets = {
      w,
      h,
      hdr,
      depth,
      q,
      glow: [g(hdr, q[0]), g(q[0], q[1]), g(q[1], q[0])],
      composite: device.createBindGroup({
        layout: compositeLayout,
        entries: [uniBind, { binding: 1, resource: hdr.createView() }, { binding: 2, resource: q[0].createView() }, { binding: 3, resource: linear }],
      }),
    };
    return targets;
  };

  // ---------- camera ----------

  const camera = new PerspectiveCamera(38, canvas.width / canvas.height, 0.05, 100);
  camera.coordinateSystem = WebGPUCoordinateSystem;
  camera.position.set(4.8, 0.2, 5.4);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, -1.1, 0);
  controls.enableDamping = true;
  controls.autoRotateSpeed = 0.35;
  controls.update();

  // shift-drag moves the white plane along the light
  let planeDrag: { y: number; depth: number } | undefined;
  const onDown = (e: PointerEvent) => {
    if (!e.shiftKey || !plane.on) return;
    planeDrag = { y: e.clientY, depth: plane.depth };
    controls.enabled = false;
  };
  const onMove = (e: PointerEvent) => {
    if (!planeDrag) return;
    plane.depth = Math.min(5.5, Math.max(-2, planeDrag.depth + (planeDrag.y - e.clientY) * -0.01));
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  const onUp = () => {
    planeDrag = undefined;
    controls.enabled = true;
  };
  canvas.addEventListener("pointerdown", onDown, { capture: true });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);

  // ---------- panel ----------

  const gui = new GUI({ title: "frozen light" });
  gui.close();
  const retrace = () => (dirty = true);
  const fg = gui.addFolder("glass");
  fg.add(glass, "ring", 0.5, 1.5).onChange(retrace);
  fg.add(glass, "length", 0.1, 0.6).onChange(retrace);
  fg.add(glass, "width", 0.04, 0.3).onChange(retrace);
  fg.add(glass, "round", 0, 0.05).onChange(retrace);
  fg.add(glass, "twist", 0, 8, 1).onChange(retrace);
  fg.add(glass, "swell", 0, 0.4).onChange(retrace);
  fg.add(glass, "ior", 1.1, 2.4).onChange(retrace);
  fg.add(glass, "dispersion", 0, 0.1).onChange(retrace);
  fg.add(glass, "absorb", 0, 1).onChange(retrace);
  fg.add(glass, "tilt", 0, 90).onChange(retrace);
  fg.add(glass, "yaw", -180, 180).onChange(retrace);
  fg.add(glass, "spin", 0, 6);
  const fl = gui.addFolder("light");
  fl.add(light, "elevation", 20, 90).onChange(retrace);
  fl.add(light, "azimuth", -180, 180).onChange(retrace);
  fl.add(light, "spot", 0.5, 3).onChange(retrace);
  fl.add(light, "photons", [256, 384, 512, 640, 768, 1024]).onChange(retrace);
  fl.add(light, "segs", 1, 8, 1).onChange(retrace);
  fl.add(light, "jitter", 0, 1).onChange(retrace);
  const ff = gui.addFolder("fog");
  ff.add(fog, "sigma", 0, 0.5);
  ff.add(fog, "g", -0.5, 0.95);
  ff.add(fog, "direct", 0, 0.3);
  ff.add(fog, "haze", 0, 0.2);
  ff.add(fog, "shaft", 0, 0.5);
  const fp = gui.addFolder("plane (shift-drag moves it)");
  fp.add(plane, "on");
  fp.add(plane, "depth", -2, 5.5);
  fp.add(plane, "size", 1, 12);
  fp.add(plane, "direct", 0, 1);
  fp.add(plane, "gain", 0, 5);
  fp.add(plane, "ambient", 0, 0.05);
  const fpu = gui.addFolder("pulse");
  fpu.add(pulse, "on");
  fpu.add(pulse, "speed", 0.05, 4);
  fpu.add(pulse, "trail", 0.02, 3);
  fpu.add(pulse, "floor", 0, 0.2);
  const fk = gui.addFolder("look");
  fk.add(look, "exposure", 0, 4);
  fk.add(look, "gain", 0, 10);
  fk.add(look, "radius", 0.0003, 0.02);
  fk.add(look, "minPx", 0.3, 3);
  fk.add(look, "minSin", 0.01, 0.5);
  fk.add(look, "fill", 0, 3);
  fk.add(fog, "direct", 0, 0.3).name("direct (unused)").hide();
  fk.add(look, "maxPx", 0.5, 16);
  fk.add(look, "glow", 0, 2);
  fk.add(look, "glowSize", 1, 20);
  fk.add(look, "bunchPow", 0, 2);
  fk.add(look, "bunchMax", 1, 500);
  fk.add(look, "stray", 0, 1);
  fk.add(look, "glassRim", 0, 3);
  fk.add(look, "glassSpec", 0, 20);
  fk.add(look, "autoRotate");

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // ---------- a frame ----------

  const clock = { time: 0, hold: undefined as number | undefined };
  let spinAngle = 0;
  let frame = 0;
  const vp = new Matrix4();
  const inv = new Matrix4();
  const ringRot = new Matrix4();

  const lightDir = () => {
    const el = (light.elevation * Math.PI) / 180;
    const az = (light.azimuth * Math.PI) / 180;
    return new Vector3(-Math.cos(el) * Math.sin(az), -Math.sin(el), -Math.cos(el) * Math.cos(az));
  };
  const planeFrame = () => {
    const L = lightDir();
    const up = Math.abs(L.y) > 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
    const ex = new Vector3().crossVectors(up, L).normalize();
    const p = L.clone().multiplyScalar(plane.depth);
    // facing the light
    return { p, n: L.clone().negate(), u: ex };
  };

  const draw = (dt: number) => {
    const ph = ensurePhotons();
    const t = ensureTargets(canvas.width, canvas.height);
    if (clock.hold === undefined) clock.time += dt;
    if (glass.spin > 0 && clock.hold === undefined) {
      spinAngle += (dt * glass.spin * 2 * Math.PI) / 60;
      dirty = true;
    }
    controls.autoRotate = look.autoRotate && !planeDrag;
    controls.update();
    camera.aspect = t.w / t.h;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    inv.copy(vp).invert();
    setMat("view", camera.matrixWorldInverse);
    setMat("proj", camera.projectionMatrix);
    setMat("invViewProj", inv);
    // world to ring: the ring lies in its own xz plane, leaned by tilt and turned by yaw (and spin)
    ringRot.makeRotationFromEuler(new Euler((glass.tilt * Math.PI) / 180, (glass.yaw * Math.PI) / 180 + spinAngle, 0, "YXZ")).invert();
    setMat("ringRot", ringRot);
    const L = lightDir();
    const pf = planeFrame();
    // a lens of half length l and half width w: two circles of radius r, centres d apart from the middle
    const l = glass.length;
    const w = glass.width;
    const r = (w + (l * l) / w) / 2;
    const d = ((l * l) / w - w) / 2;
    const span = FAR + LAUNCH - (LAUNCH - glass.ring - 0.6);
    setU({
      camX: camera.position.x,
      camY: camera.position.y,
      camZ: camera.position.z,
      lightX: L.x,
      lightY: L.y,
      lightZ: L.z,
      ringR: glass.ring,
      twist: glass.twist / 2,
      twistPhase: 0,
      swell: glass.swell,
      lensR: r,
      lensD: d,
      lensRound: glass.round,
      ior: glass.ior,
      dispersion: glass.dispersion,
      absorb: glass.absorb,
      spotR: light.spot,
      launch: LAUNCH,
      far: FAR,
      jitter: light.jitter,
      segs: ph.segs,
      np: ph.n,
      planeOn: plane.on ? 1 : 0,
      planeX: pf.p.x,
      planeY: pf.p.y,
      planeZ: pf.p.z,
      planeNX: pf.n.x,
      planeNY: pf.n.y,
      planeNZ: pf.n.z,
      planeUX: pf.u.x,
      planeUY: pf.u.y,
      planeUZ: pf.u.z,
      planeSize: plane.size,
      planeRes: PLANE_RES,
      planeDirect: plane.direct,
      planeGain: plane.gain,
      albedo: plane.albedo,
      ambient: plane.ambient,
      beamR: look.radius,
      minPx: look.minPx,
      resX: t.w,
      resY: t.h,
      focalPx: t.h / 2 / Math.tan((camera.fov * Math.PI) / 360),
      // the same overall light whatever the number of photons, and whatever the beam's width
      gain: (look.gain * (640 * 640)) / (ph.n * ph.n) / (look.radius / 0.0018),
      directW: fog.direct,
      sigma: fog.sigma,
      phaseG: fog.g,
      minSin: look.minSin,
      pulseOn: pulse.on ? 1 : 0,
      pulseFront: LAUNCH - glass.ring - 0.6 + ((clock.time * pulse.speed) % span),
      pulseW: pulse.trail,
      pulseFloor: pulse.floor,
      exposure: look.exposure,
      glow: look.glow,
      glowSize: look.glowSize,
      glassRim: look.glassRim,
      glassSpec: look.glassSpec,
      haze: fog.haze,
      shaft: fog.shaft,
      bundle: (6 * light.spot) / ph.n,
      areaRef: 3 * Math.pow((2 * light.spot) / ph.n, 2),
      stray: look.stray,
      bunchMax: look.bunchMax,
      bunchPow: look.bunchPow,
      fill: look.fill,
      maxPx: look.maxPx,
      time: clock.time,
    });
    device.queue.writeBuffer(uniformBuffer, 0, floats);

    const encoder = device.createCommandEncoder();
    if (plane.on) encoder.clearBuffer(planeAcc);
    const cp = encoder.beginComputePass();
    const n2 = ph.n * ph.n;
    if (dirty) {
      // six vertices per beam, as many beams as compact lists
      device.queue.writeBuffer(ph.args, 0, new Uint32Array([6, 0, 0, 0]));
      cp.setPipeline(P.trace);
      cp.setBindGroup(0, ph.trace);
      cp.dispatchWorkgroups(Math.ceil(n2 / 64));
      cp.setPipeline(P.compact);
      cp.dispatchWorkgroups(Math.ceil(n2 / 64));
      dirty = false;
    }
    cp.setPipeline(P.cutAndLand);
    cp.setBindGroup(0, frameGroup!);
    cp.dispatchWorkgroups(Math.ceil(n2 / 64));
    if (plane.on) {
      cp.setPipeline(P.resolvePlane);
      cp.dispatchWorkgroups(PLANE_RES / 8, PLANE_RES / 8);
    }
    cp.end();

    const rp = encoder.beginRenderPass({
      colorAttachments: [{ view: t.hdr.createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
      depthStencilAttachment: { view: t.depth.createView(), depthLoadOp: "clear", depthStoreOp: "store", depthClearValue: 1 },
    });
    rp.setBindGroup(0, drawGroup!);
    if (plane.on) {
      rp.setPipeline(planePipeline);
      rp.draw(6);
    }
    rp.setPipeline(beamPipeline);
    rp.drawIndirect(ph.args, 0);
    rp.end();

    const gp = encoder.beginComputePass();
    const qw = Math.ceil(Math.ceil(t.w / 4) / 8);
    const qh = Math.ceil(Math.ceil(t.h / 4) / 8);
    [P.down4, P.blurH, P.blurV].forEach((p, k) => {
      gp.setPipeline(p);
      gp.setBindGroup(0, t.glow[k]);
      gp.dispatchWorkgroups(qw, qh);
    });
    gp.end();

    const out = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    out.setPipeline(compositePipeline);
    out.setBindGroup(0, t.composite);
    out.draw(3);
    out.end();
    device.queue.submit([encoder.finish()]);
    frame++;
  };

  const beams = {
    glass,
    light,
    fog,
    plane,
    pulse,
    look,
    clock,
    camera,
    controls,
    retrace,
    get frame() {
      return frame;
    },
    /** GPU milliseconds per frame, waiting for each */
    bench: async (frames = 20) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        draw(0);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
    /** the indirect draw's arguments (how many beams are listed) */
    args: async () => {
      const ph = photons!;
      const read = device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
      const enc = device.createCommandEncoder();
      enc.copyBufferToBuffer(ph.args, 0, read, 0, 16);
      device.queue.submit([enc.finish()]);
      await read.mapAsync(GPUMapMode.READ);
      const v = [...new Uint32Array(read.getMappedRange())];
      read.destroy();
      return v;
    },
    /** GPU milliseconds of one trace */
    traceBench: async () => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      dirty = true;
      draw(0);
      await device.queue.onSubmittedWorkDone();
      return performance.now() - t0;
    },
  };
  (window as any).__beams = beams;

  const due = frameCap(60);
  let last = performance.now();
  wrap.render = ({ recording }) => {
    if (!recording && !due()) return;
    const now = performance.now();
    const dt = recording ? 1 / 60 : Math.min(0.1, (now - last) / 1000);
    last = now;
    draw(dt);
    stats.update();
  };

  wrap.resize = () => {};

  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    controls.dispose();
    canvas.removeEventListener("pointerdown", onDown, { capture: true });
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 20_000,
  // no playFps: ssam's drops frames (see cap.ts), so the render caps itself at 60
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
