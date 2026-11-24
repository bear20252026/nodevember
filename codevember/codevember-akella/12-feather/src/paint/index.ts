import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import * as TSL from "three/tsl";
import {
  BackSide,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  NoToneMapping,
  OrthographicCamera,
  PerspectiveCamera,
  RenderPipeline,
  RenderTarget,
  RGBAFormat,
  Scene,
  SphereGeometry,
  Spherical,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { createHeron, motion } from "./heron.ts";
import { createLight } from "./shade.ts";
import { CLOUD_PERIOD, createSky, GROUND_PERIOD } from "./sky.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { normalize, pass, positionLocal, uniform } = T;

export const look = {
  beats: 10, // wingbeats in one loop
  // the sun, as seen from the bird: azimuth from its nose round to its right, degrees
  sunAzimuth: -115,
  sunElevation: 42,
  // the bird's three tones, and how it is drawn
  light: "#f9f7f0",
  shade: "#b9c6f3",
  glowTone: "#ffe7a8",
  deep: "#dfe4fb", // multiplies what is tucked under something
  lineTone: "#c4c8e2", // multiplies the surface along a drawn line
  line: 1.1, // line width, pixels
  edge: 0.42, // where light turns to shade
  soft: 0.1,
  rim: 0.8,
  through: 1.2, // one vane lets 1 / (1 + through) of the sun past
  glow: 1.0,
  shadow: 1.3,
  // sky and ground
  zenith: "#1f5fd0",
  horizon: "#8cc4f5",
  cloudLight: "#fff6e2",
  cloudMid: "#eef0ff",
  cloudShade: "#9fb1ea",
  sunTint: "#ffe9b8",
  haze: "#cfe4fb",
  water: "#3f86d8",
  meadow: "#77b866",
  trees: "#3f8563",
  sand: "#efe6b6",
  hill: "#6f9ad6",
  cloud: 0.5,
  wisp: 0.4,
  rays: 0.35,
  wind: 1, // whole lengths of overhead cloud that pass in one loop
  land: 1, // whole lengths of ground (12 heights each)
  // the glow over everything
  bloom: 0.3,
  bloomRadius: 0.55,
  bloomFrom: 0.97,
  // the camera drifts round the bird once a loop
  drift: true,
  driftAzimuth: 32,
  driftElevation: 15,
};

const MAP = 2048;
const EXTENT = 1.02; // half the sun map, metres: the bird with wings spread, and its bob
const FOV = 24;

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.toneMapping = NoToneMapping; // the colours are chosen, not exposed
  await renderer.init();
  flattenSwizzles(renderer);

  // ---- the sun's map
  const target = new RenderTarget(MAP, MAP, { type: HalfFloatType, format: RGBAFormat, samples: 4, depthBuffer: false });
  target.texture.minFilter = LinearFilter;
  target.texture.magFilter = LinearFilter;
  target.texture.generateMipmaps = false;
  const light = createLight(target.texture);
  light.extent.value = EXTENT;
  light.texel.value = 1 / MAP;
  const sunCam = new OrthographicCamera(-EXTENT, EXTENT, EXTENT, -EXTENT, 0.1, 20);

  const scene = new Scene();
  const depthScene = new Scene();
  const draw = { linePx: uniform(look.line * pixelRatio), pxWorld: uniform(1) };
  const heron = createHeron(light, draw);
  scene.add(heron.group);
  depthScene.add(heron.depthGroup);

  // ---- sky
  const sky = createSky(renderer, light);
  const skyMat = new MeshBasicNodeMaterial();
  skyMat.side = BackSide;
  skyMat.depthWrite = false;
  skyMat.colorNode = sky.color(normalize(positionLocal));
  const dome = new Mesh(new SphereGeometry(60, 48, 24), skyMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);

  // ---- camera: the orbit controls move a stand-in, the drift is added on top
  const camera = new PerspectiveCamera(FOV, width / height, 0.05, 200);
  const stand = new PerspectiveCamera(FOV, width / height, 0.05, 200);
  stand.position.setFromSpherical(new Spherical(3.15, (90 + 6) * (Math.PI / 180), 40 * (Math.PI / 180)));
  const controls = new OrbitControls(stand, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 12;
  controls.target.set(-0.03, 0.02, 0);
  const sph = new Spherical();
  const off = new Vector3();
  const aim = new Vector3();
  const size = (h: number) => (draw.pxWorld.value = (2 * Math.tan((FOV * Math.PI) / 360)) / (h * pixelRatio));
  size(height);

  // ---- the picture, with a soft glow over its brightest parts
  const pipeline = new RenderPipeline(renderer);
  const picture = pass(scene, camera).getTextureNode("output");
  const halo = bloom(picture, look.bloom, look.bloomRadius, look.bloomFrom);
  pipeline.outputNode = picture.add(halo);

  let baked = "";
  const refresh = () => {
    const az = look.sunAzimuth * (Math.PI / 180);
    const el = look.sunElevation * (Math.PI / 180);
    light.sunDir.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    light.lightTone.value.set(look.light);
    light.shadeTone.value.set(look.shade);
    light.glowTone.value.set(look.glowTone).multiplyScalar(1.12);
    light.deepTone.value.set(look.deep);
    light.lineTone.value.set(look.lineTone);
    light.edge.value = look.edge;
    light.soft.value = look.soft;
    light.rim.value = look.rim;
    light.through.value = look.through;
    light.glow.value = look.glow;
    light.shadow.value = look.shadow;
    draw.linePx.value = look.line * pixelRatio;
    for (const k of ["zenith", "horizon", "cloudLight", "cloudMid", "cloudShade", "sunTint", "haze", "water", "meadow", "trees", "sand", "hill"] as const) sky.u[k].value.set(look[k]);
    sky.u.cloud.value = look.cloud;
    sky.u.wisp.value = look.wisp;
    sky.u.rays.value = look.rays;
    sky.u.sunAz.value = look.sunAzimuth;
    sky.u.sunEl.value = look.sunElevation;
    halo.strength.value = look.bloom;
    halo.radius.value = look.bloomRadius;
    halo.threshold.value = look.bloomFrom;
    sunCam.position.copy(light.sunDir.value).multiplyScalar(6);
    sunCam.up.set(0, 0, 1);
    sunCam.lookAt(0, 0, 0);
    sunCam.updateMatrixWorld(true);
    light.lx.value.setFromMatrixColumn(sunCam.matrixWorld, 0);
    light.ly.value.setFromMatrixColumn(sunCam.matrixWorld, 1);
    // the cumulus is painted once, and again only if what shapes or lights it changes
    const key = [look.sunAzimuth, look.sunElevation, look.cloud].join();
    if (key !== baked) {
      baked = key;
      sky.bake();
    }
  };
  refresh();

  // ---- panel
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "feather" });
  gui.close();
  const ff = gui.addFolder("flight");
  ff.add(look, "beats", 4, 24, 1);
  ff.add(motion, "amp", 0.3, 1.4, 0.01);
  ff.add(motion, "lag", 0, 1.8, 0.01);
  ff.add(motion, "fold", 0, 1.6, 0.01);
  ff.add(motion, "flex", 0, 2.5, 0.01);
  ff.add(motion, "twist", 0, 2, 0.01);
  ff.add(motion, "open", 0, 2, 0.01);
  ff.add(motion, "bob", 0, 0.05, 0.001);
  const fb = gui.addFolder("bird");
  for (const k of ["light", "shade", "glowTone", "deep", "lineTone"] as const) fb.addColor(look, k).onChange(refresh);
  fb.add(look, "line", 0, 3, 0.05).onChange(refresh);
  fb.add(look, "edge", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "soft", 0.005, 0.5, 0.005).onChange(refresh);
  fb.add(look, "rim", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "through", 0.1, 3, 0.01).onChange(refresh);
  fb.add(look, "glow", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "shadow", 0, 4, 0.01).onChange(refresh);
  const fs = gui.addFolder("sky");
  fs.add(look, "sunAzimuth", -180, 180, 1).onFinishChange(refresh);
  fs.add(look, "sunElevation", 5, 89, 1).onFinishChange(refresh);
  fs.add(look, "cloud", 0, 1, 0.01).onFinishChange(refresh);
  fs.add(look, "wisp", 0, 1, 0.01).onChange(refresh);
  fs.add(look, "rays", 0, 2, 0.01).onChange(refresh);
  fs.add(look, "wind", 0, 4, 1);
  fs.add(look, "land", 0, 4, 1);
  for (const k of ["zenith", "horizon", "cloudLight", "cloudMid", "cloudShade", "sunTint", "haze"] as const) fs.addColor(look, k).onChange(refresh);
  const fg = gui.addFolder("ground");
  for (const k of ["water", "meadow", "trees", "sand", "hill"] as const) fg.addColor(look, k).onChange(refresh);
  const fp = gui.addFolder("glow");
  fp.add(look, "bloom", 0, 1.5, 0.01).onChange(refresh);
  fp.add(look, "bloomRadius", 0, 1, 0.01).onChange(refresh);
  fp.add(look, "bloomFrom", 0, 1.2, 0.01).onChange(refresh);
  const fv = gui.addFolder("camera");
  fv.add(look, "drift");
  fv.add(look, "driftAzimuth", 0, 180, 1);
  fv.add(look, "driftElevation", 0, 60, 1);

  const state = { hold: -1, frame: 0, pause: false, view: null as number[] | null };
  Object.assign(window, { __feather: { look, motion, state, refresh, heron, camera, stand, controls, renderer, scene, target, light, sky } });

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    heron.update(ph * look.beats * Math.PI * 2);
    sky.u.travel.value = ph * CLOUD_PERIOD * Math.round(look.wind);
    sky.u.ground.value = ph * GROUND_PERIOD * Math.round(look.land);

    controls.update();
    off.copy(stand.position).sub(controls.target);
    sph.setFromVector3(off);
    if (state.view) {
      // tooling: [azimuth, elevation, distance, target xyz]: degrees, from the bird's right round to its nose, up positive
      sph.theta = state.view[0] * (Math.PI / 180);
      sph.phi = (90 - state.view[1]) * (Math.PI / 180);
      sph.radius = state.view[2] ?? sph.radius;
    } else if (look.drift) {
      const a = ph * Math.PI * 2;
      sph.theta += Math.sin(a) * look.driftAzimuth * (Math.PI / 180);
      sph.phi -= Math.sin(a * 1 + 1.9) * look.driftElevation * (Math.PI / 180);
    }
    sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi));
    aim.copy(controls.target);
    if (state.view && state.view.length > 5) aim.set(state.view[3], state.view[4], state.view[5]);
    camera.position.setFromSpherical(sph).add(aim);
    camera.lookAt(aim);
    dome.position.copy(camera.position);

    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.render(depthScene, sunCam);
    renderer.setRenderTarget(null);
    pipeline.render();
    stats.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = stand.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    size(height);
  };

  wrap.unload = () => {
    renderer.dispose();
    target.dispose();
    sky.target.dispose();
    gui.destroy();
    stats.dom.remove();
  };
};

// Chromium with unsafe-webgpu off chokes on three's `v.xy.x` (see day 4)
function flattenSwizzles(renderer: WebGPURenderer) {
  const { device } = renderer.backend as unknown as { device?: GPUDevice };
  if (!device) return;
  const create = device.createShaderModule.bind(device);
  const flat = (_: string, first: string, second: string) => `.${first["xyzw".indexOf(second)]}`;
  device.createShaderModule = (descriptor) => create({ ...descriptor, code: descriptor.code.replace(/\.([xyzw]{2,4})\.([xyzw])\b/g, flat) });
}

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 12_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
