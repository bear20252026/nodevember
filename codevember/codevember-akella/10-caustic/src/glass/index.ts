/**
 * Glass: a slab of glass floats over white paper under a light straight above. Its underside is designed
 * (see solve.worker.ts) so that, held level at the right height, the light it lets through lands as a
 * picture: an eye, a skull, the word CAUSTIC. Tilted or lifted, the same light is a tangle.
 *
 * After Schwartzburg et al., "High-contrast Computational Caustic Design" (2014) and Matt Ferraro's
 * causticsEngineering. The light is not baked: each frame a million photons are traced through the
 * slab's two faces and splatted on the paper, and frames add up while nothing moves.
 */
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { Matrix4, Quaternion, Vector3 } from "three";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { frameCap } from "../cap";
import commonCode from "./common.wgsl?raw";
import displayCode from "./display.wgsl?raw";
import photonsCode from "./photons.wgsl?raw";
import type { SolveReply, SolveRequest } from "./solve.worker";
import { TARGETS, type TargetName } from "./targets";

const lens = {
  /** half side of the slab */
  half: 0.42,
  /** top face above the underside's highest point */
  th: 0.06,
  corner: 0.09,
  /** the underside's highest point above the paper, held level */
  distance: 2,
  ior: 1.49,
  /** spread of the index from red to blue */
  disp: 0.0025,
};

const design = { n: 256, iters: 110, floor: 0.012, gamma: 1.1, soften: 1.5, magnify: 1.05, cross: true, refine: 3 };

const view = { exposure: 0.45, ambient: 0.015, glassTint: 0.35, elevation: 36, azimuth: 0, distance: 4.5, fov: 34, lookY: 1.1, spotR: 1.45, direct: 0.5 };

const show = {
  /** the slab drifts and comes level by itself; any drag takes over for a while */
  auto: true,
  /** seconds of tumbling, settling and holding level, per picture */
  drift: 6,
  settle: 3.2,
  hold: 3.6,
  /** another picture each time the light is tangled */
  cycle: true,
  /** nearly level slabs are drawn the rest of the way */
  magnet: 10,
};

const render = { photons: 1024, res: 1536, phalf: 1.6 };

const UNIFORMS = [
  "mx0",
  "mx1",
  "mx2",
  "my0",
  "my1",
  "my2",
  "mz0",
  "mz1",
  "mz2",
  "cx",
  "cy",
  "cz",
  "pivot",
  "half",
  "th",
  "depth",
  "corner",
  "ior",
  "disp",
  "n",
  "np",
  "frame",
  "res",
  "phalf",
  "norm",
  "ema",
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
  "exposure",
  "ambient",
  "glassTint",
  "spotR",
  "direct",
] as const;
type UName = (typeof UNIFORMS)[number];
const uniStruct = `struct Uni {\n${UNIFORMS.map((n) => `  ${n}: f32,`).join("\n")}\n};\n`;

const loopLength = () => (show.drift + show.settle + show.hold) * TARGETS.length;
const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** the slab's own axes to the world's: x stays, y goes away from the camera (-z), z (its top) is up */
const BASE = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(1, 0, 0), new Vector3(0, 0, -1), new Vector3(0, 1, 0)));

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
  const C = GPUShaderStage.COMPUTE;
  const FS = GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX;
  const photonLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: C, buffer: { type: "uniform" } },
      { binding: 1, visibility: C, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: C, buffer: { type: "storage" } },
      { binding: 3, visibility: C, texture: { sampleType: "unfilterable-float" } },
      { binding: 4, visibility: C, storageTexture: { access: "write-only", format: "rgba16float" } },
    ],
  });
  const displayLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: FS, buffer: { type: "uniform" } },
      { binding: 1, visibility: FS, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: FS, texture: { sampleType: "float" } },
      { binding: 3, visibility: FS, sampler: { type: "filtering" } },
    ],
  });
  const photonModule = compile(photonsCode, "glass photons");
  const displayModule = compile(displayCode, "glass display");
  const pipe = (entryPoint: string) => device.createComputePipeline({ layout: device.createPipelineLayout({ bindGroupLayouts: [photonLayout] }), compute: { module: photonModule, entryPoint } });
  const shinePipe = pipe("shine");
  const resolvePipe = pipe("resolve");
  const displayPipe = device.createRenderPipeline({
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
  const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

  // ---------- the designed undersides, one worker each ----------

  const fieldBuffer = device.createBuffer({ size: design.n * design.n * 16, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
  const designs = new Map<TargetName, SolveReply>();
  let current: TargetName = "eye";
  let shown: TargetName | undefined;
  let depth = 0;
  const workers = TARGETS.map(() => new Worker(new URL("./solve.worker.ts", import.meta.url), { type: "module" }));
  const solveAll = () => {
    designs.clear();
    TARGETS.forEach((name, k) => {
      workers[k].onmessage = (e: MessageEvent<SolveReply>) => {
        designs.set(e.data.name, e.data);
        console.log(
          `glass ${e.data.name}: ${e.data.ms.toFixed(0)} ms, landing error ${e.data.err[0].toFixed(3)} / ${e.data.err[1].toFixed(2)} cells, slope ${e.data.maxSlope.toFixed(2)}, depth ${e.data.depth.toFixed(3)}`,
        );
      };
      const req: SolveRequest = {
        name,
        n: design.n,
        half: lens.half,
        distance: lens.distance,
        ior: lens.ior,
        magnify: design.magnify,
        floor: design.floor,
        gamma: design.gamma,
        iters: design.iters,
        soften: design.soften,
        cross: design.cross,
        refine: design.refine,
      };
      workers[k].postMessage(req);
    });
  };
  solveAll();
  const useDesign = () => {
    const d = designs.get(current);
    if (!d || shown === current) return;
    device.queue.writeBuffer(fieldBuffer, 0, d.field as Float32Array<ArrayBuffer>);
    depth = d.depth;
    shown = current;
    still = 0;
    fresh = true;
  };

  // ---------- the light on the paper ----------

  type Paper = { res: number; light: GPUBuffer; acc: GPUTexture[]; groups: GPUBindGroup[]; display: GPUBindGroup[] };
  let paperRes: Paper | undefined;
  const makePaper = (res: number): Paper => {
    const light = device.createBuffer({ size: res * res * 12, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const acc = [0, 1].map(() => device.createTexture({ size: [res, res], format: "rgba16float", usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING }));
    const groups = [0, 1].map((f) =>
      device.createBindGroup({
        layout: photonLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: fieldBuffer } },
          { binding: 2, resource: { buffer: light } },
          { binding: 3, resource: acc[1 - f].createView() },
          { binding: 4, resource: acc[f].createView() },
        ],
      }),
    );
    const display = [0, 1].map((f) =>
      device.createBindGroup({
        layout: displayLayout,
        entries: [
          { binding: 0, resource: { buffer: uniformBuffer } },
          { binding: 1, resource: { buffer: fieldBuffer } },
          { binding: 2, resource: acc[f].createView() },
          { binding: 3, resource: sampler },
        ],
      }),
    );
    return { res, light, acc, groups, display };
  };

  // ---------- the slab's pose ----------

  const pose = { q: BASE.clone(), lift: 0 };
  const lastPose = { q: new Quaternion(), lift: NaN };
  let still = 0;
  /** the next frame starts the light afresh (after a jump, not a drag) */
  let fresh = true;
  let dragging = false;
  let lastTouch = -1e9;
  let seconds = 0;

  /** where the show wants the slab at time t of its loop */
  const showPose = (t: number) => {
    const L = loopLength();
    const tt = ((t % L) + L) % L;
    const per = show.drift + show.settle + show.hold;
    const k = Math.floor(tt / per);
    const lt = tt - k * per;
    // level-ness: leaving level in the first stretch of the drift, coming back over the settle
    const w = lt < show.drift ? 1 - ease(lt / Math.min(2, show.drift * 0.4)) : ease((lt - show.drift) / show.settle);
    const a = t * 0.9;
    const tilt = 0.55 + 0.25 * Math.sin(a * 0.7);
    const axis = new Vector3(Math.cos(a * 0.45), 0, Math.sin(a * 0.45));
    const wobble = new Quaternion().setFromAxisAngle(axis, tilt);
    const spin = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.6 * Math.sin(a * 0.31));
    const drift = spin.multiply(wobble).multiply(BASE.clone());
    const level = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.04 * Math.sin(t * 0.5)).multiply(BASE.clone());
    const q = drift.slerp(level, w);
    // down towards the paper the crossing light knots up; at its height it opens into the picture
    const lift = -(1 - w) * (0.62 + 0.25 * Math.sin(a * 0.53));
    // a new picture halfway through the drift, when the light is most tangled
    const pictureAt = lt < show.drift * 0.5 ? (k + TARGETS.length - 1) % TARGETS.length : k;
    return { q, lift, picture: TARGETS[pictureAt] };
  };

  // ---------- the cursor ----------

  let px = 0;
  let py = 0;
  const onDown = (e: PointerEvent) => {
    dragging = true;
    px = e.clientX;
    py = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - px;
    const dy = e.clientY - py;
    px = e.clientX;
    py = e.clientY;
    const k = 0.006;
    // horizontal drags spin it about the vertical, vertical ones tip it towards or away from you
    const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), dx * k);
    const pitch = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), dy * k);
    pose.q.premultiply(pitch).premultiply(yaw).normalize();
    lastTouch = seconds;
  };
  const onUp = () => (dragging = false);
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    pose.lift = Math.min(1.2, Math.max(-0.9, pose.lift - e.deltaY * 0.001));
    lastTouch = seconds;
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.style.touchAction = "none";

  // ---------- panel ----------

  const gui = new GUI({ title: "glass" });
  gui.close();
  const pick = { picture: current as TargetName };
  gui.add(pick, "picture", [...TARGETS]).onChange((v: TargetName) => {
    current = v;
    show.cycle = false;
    lastTouch = seconds;
  });
  const fs = gui.addFolder("show");
  fs.add(show, "auto");
  fs.add(show, "cycle");
  fs.add(show, "magnet", 0, 30);
  fs.add(show, "drift", 1, 15);
  fs.add(show, "settle", 0.5, 8);
  fs.add(show, "hold", 0.5, 10);
  const fl = gui.addFolder("glass");
  fl.add(lens, "disp", 0, 0.05);
  fl.add(lens, "distance", 0.5, 3).onFinishChange(solveAll);
  fl.add(lens, "ior", 1.3, 1.9).onFinishChange(solveAll);
  fl.add(design, "floor", 0, 0.2).onFinishChange(solveAll);
  fl.add(design, "gamma", 0.4, 2.5).onFinishChange(solveAll);
  fl.add(design, "soften", 0, 3).onFinishChange(solveAll);
  fl.add(design, "magnify", 0.5, 2).onFinishChange(solveAll);
  fl.add(design, "cross").onFinishChange(solveAll);
  fl.add(design, "refine", 0, 8, 1).onFinishChange(solveAll);
  const fv = gui.addFolder("view");
  fv.add(view, "exposure", 0.1, 3);
  fv.add(view, "ambient", 0, 0.3);
  fv.add(view, "glassTint", 0, 5);
  fv.add(view, "spotR", 0.3, 4);
  fv.add(view, "direct", 0, 1);
  fv.add(view, "elevation", 5, 89);
  fv.add(view, "azimuth", -180, 180);
  fv.add(view, "distance", 2, 10);
  fv.add(view, "fov", 15, 70);
  fv.add(render, "photons", [512, 768, 1024, 1448, 2048]);

  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // ---------- a frame ----------

  let frame = 0;
  const clock = { hold: undefined as number | undefined };
  const camera = () => {
    const el = (view.elevation * Math.PI) / 180;
    const az = (view.azimuth * Math.PI) / 180;
    const look = new Vector3(0, view.lookY, 0);
    const pos = new Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(view.distance).add(look);
    const f = look.clone().sub(pos).normalize();
    const r = f
      .clone()
      .cross(new Vector3(0, 1, 0))
      .normalize();
    const u = r.clone().cross(f);
    return { pos, f, r, u };
  };

  const step = (t: number, dt: number) => {
    seconds += dt;
    if (!paperRes || paperRes.res !== render.res) {
      paperRes?.light.destroy();
      paperRes?.acc.forEach((a) => a.destroy());
      paperRes = makePaper(render.res);
      still = 0;
    }
    const P = paperRes;

    // the show leads unless the hand has been on the slab lately
    const idle = !dragging && seconds - lastTouch > 4;
    if (show.auto && idle) {
      const s = showPose(t);
      const k = 1 - Math.exp(-dt * 2.2);
      pose.q.slerp(s.q, k);
      pose.lift += (s.lift - pose.lift) * k;
      if (show.cycle) current = s.picture;
    } else if (!dragging) {
      // close to level, it is drawn the rest of the way, and to the right height
      const normal = new Vector3(0, 0, 1).applyQuaternion(pose.q);
      const angle = normal.angleTo(new Vector3(0, 1, 0));
      if ((angle * 180) / Math.PI < show.magnet) {
        const fix = new Quaternion().setFromUnitVectors(normal, new Vector3(0, 1, 0));
        const level = fix.multiply(pose.q.clone());
        const k = 1 - Math.exp(-dt * 3);
        pose.q.slerp(level, k);
        if (Math.abs(pose.lift) < 0.25) pose.lift *= 1 - k;
      }
    }
    useDesign();

    const moved = Math.abs(pose.q.dot(lastPose.q)) < 1 - 1e-9 || Math.abs(pose.lift - lastPose.lift) > 1e-6;
    lastPose.q.copy(pose.q);
    lastPose.lift = pose.lift;
    still = moved ? 0 : still + 1;

    const m = new Matrix4().makeRotationFromQuaternion(pose.q).elements;
    const pivot = 0.5 * (lens.th + depth);
    const cam = camera();
    const W = canvas.width;
    const H = canvas.height;
    const cell = (2 * lens.half) / render.photons;
    const texel = (2 * render.phalf) / P.res;
    setU({
      mx0: m[0],
      mx1: m[1],
      mx2: m[2],
      my0: m[4],
      my1: m[5],
      my2: m[6],
      mz0: m[8],
      mz1: m[9],
      mz2: m[10],
      cx: 0,
      cy: lens.distance + pivot + pose.lift,
      cz: 0,
      pivot,
      half: lens.half,
      th: lens.th,
      depth,
      corner: lens.corner,
      ior: lens.ior,
      disp: lens.disp,
      n: design.n,
      np: render.photons,
      frame,
      res: P.res,
      phalf: render.phalf,
      // each channel gets a third of the photons
      norm: (3 * cell * cell) / (texel * texel) / 256,
      ema: fresh ? 1 : still === 0 ? 0.4 : Math.max(1 / (still + 1), 1 / 160),
      camX: cam.pos.x,
      camY: cam.pos.y,
      camZ: cam.pos.z,
      fX: cam.f.x,
      fY: cam.f.y,
      fZ: cam.f.z,
      rX: cam.r.x,
      rY: cam.r.y,
      rZ: cam.r.z,
      uX: cam.u.x,
      uY: cam.u.y,
      uZ: cam.u.z,
      tanFov: Math.tan((view.fov * Math.PI) / 360),
      aspect: W / H,
      exposure: view.exposure,
      ambient: view.ambient,
      glassTint: view.glassTint,
      spotR: view.spotR,
      direct: view.direct,
    });
    device.queue.writeBuffer(uniformBuffer, 0, uniforms);

    const encoder = device.createCommandEncoder();
    encoder.clearBuffer(P.light);
    const cp = encoder.beginComputePass();
    cp.setBindGroup(0, P.groups[frame & 1]);
    cp.setPipeline(shinePipe);
    cp.dispatchWorkgroups(Math.ceil((render.photons * render.photons) / 256));
    cp.setPipeline(resolvePipe);
    cp.dispatchWorkgroups(Math.ceil(P.res / 8), Math.ceil(P.res / 8));
    cp.end();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }],
    });
    pass.setPipeline(displayPipe);
    pass.setBindGroup(0, P.display[frame & 1]);
    pass.draw(3);
    pass.end();
    device.queue.submit([encoder.finish()]);
    fresh = false;
    frame++;
  };

  (window as any).__glass = {
    lens,
    design,
    view,
    show,
    render,
    pose,
    clock,
    showPose,
    loopLength,
    solveAll,
    get ready() {
      return TARGETS.every((t) => designs.has(t));
    },
    get designs() {
      return [...designs.values()].map((d) => ({ name: d.name, ms: d.ms, err: d.err, maxSlope: d.maxSlope, depth: d.depth }));
    },
    get frame() {
      return frame;
    },
    /** stop the show and set the slab: picture, tilt in degrees about x (towards the camera), spin about y, lift */
    place: (picture: TargetName, tilt = 0, spin = 0, lift = 0) => {
      show.auto = false;
      current = picture;
      pose.q.copy(BASE);
      pose.q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), (tilt * Math.PI) / 180));
      pose.q.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), (spin * Math.PI) / 180));
      pose.lift = lift;
      show.magnet = 0;
      fresh = true;
    },
    /** frames drawn back to back, to let the light converge */
    settle: async (frames = 60) => {
      for (let k = 0; k < frames; k++) {
        step(clock.hold ?? 0, 0);
        if (k % 20 === 19) await device.queue.onSubmittedWorkDone();
      }
      await device.queue.onSubmittedWorkDone();
    },
    bench: async (frames = 30) => {
      await device.queue.onSubmittedWorkDone();
      const t0 = performance.now();
      for (let k = 0; k < frames; k++) {
        pose.lift += 1e-5;
        step(clock.hold ?? 0, 0);
        await device.queue.onSubmittedWorkDone();
      }
      return (performance.now() - t0) / frames;
    },
  };

  const due = frameCap(60);
  let tPrev = 0;
  wrap.render = ({ playhead, recording }) => {
    if (!recording && !due()) return;
    const L = loopLength();
    const t = clock.hold ?? playhead * L;
    let dt = t - tPrev;
    if (dt < 0) dt += L;
    if (dt > 0.1) dt = 1 / 60;
    tPrev = t;
    step(t, dt);
    stats.update();
  };

  wrap.resize = () => {};
  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    workers.forEach((w) => w.terminate());
    canvas.removeEventListener("pointerdown", onDown);
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerup", onUp);
    canvas.removeEventListener("pointercancel", onUp);
    canvas.removeEventListener("wheel", onWheel);
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: loopLength() * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
