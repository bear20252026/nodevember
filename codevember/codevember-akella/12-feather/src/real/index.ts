import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TSL from "three/tsl";
import {
  ACESFilmicToneMapping,
  BackSide,
  Color,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  OrthographicCamera,
  PerspectiveCamera,
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
import { CLOUD_PERIOD, skyColor } from "./sky.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { normalize, positionLocal, uniform } = T;

export const look = {
  beats: 10, // wingbeats in one loop
  // the sun, as seen from the bird: azimuth from its nose round to its right, degrees
  sunAzimuth: -115,
  sunElevation: 42,
  sun: 0.64,
  sunColor: "#fff3df",
  sky: 0.36,
  skyColor: "#a4bdea",
  ground: 0.32,
  groundColor: "#a9b0b4",
  through: 1.2, // one vane lets 1 / (1 + through) of the sun past
  glow: 1.0,
  glowColor: "#fff0cf",
  shadow: 1.3,
  zenith: "#1f58a8",
  horizon: "#6fa4dc",
  haze: "#8fb4dc",
  river: "#2f5873",
  cloud: 0.35,
  wind: 1, // whole lengths of cloud that pass in one loop
  exposure: 1.0,
  // the camera drifts round the bird once a loop
  drift: true,
  driftAzimuth: 32,
  driftElevation: 20,
};

const MAP = 2048;
const EXTENT = 1.02; // half the sun map, metres: the bird with wings spread, and its bob

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.toneMapping = ACESFilmicToneMapping;
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
  const heron = createHeron(light);
  scene.add(heron.group);
  depthScene.add(heron.depthGroup);

  // ---- sky
  const zenith = uniform(new Color(look.zenith));
  const horizon = uniform(new Color(look.horizon));
  const haze = uniform(new Color(look.haze));
  const river = uniform(new Color(look.river));
  const skyMat = new MeshBasicNodeMaterial();
  skyMat.side = BackSide;
  skyMat.depthWrite = false;
  const cloud = uniform(look.cloud);
  const travel = uniform(0);
  skyMat.colorNode = skyColor(light, { zenith, horizon, haze, river, cloud, travel }, normalize(positionLocal));
  const sky = new Mesh(new SphereGeometry(60, 48, 24), skyMat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  // ---- camera: the orbit controls move a stand-in, the drift is added on top
  const camera = new PerspectiveCamera(24, width / height, 0.05, 200);
  const stand = new PerspectiveCamera(24, width / height, 0.05, 200);
  stand.position.setFromSpherical(new Spherical(3.15, (90 + 10) * (Math.PI / 180), 40 * (Math.PI / 180)));
  const controls = new OrbitControls(stand, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 12;
  controls.target.set(-0.03, 0, 0);
  const sph = new Spherical();
  const off = new Vector3();
  const aim = new Vector3();

  const refresh = () => {
    const az = look.sunAzimuth * (Math.PI / 180);
    const el = look.sunElevation * (Math.PI / 180);
    light.sunDir.value.set(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    light.sunColor.value.set(look.sunColor).multiplyScalar(look.sun);
    light.skyColor.value.set(look.skyColor).multiplyScalar(look.sky);
    light.groundColor.value.set(look.groundColor).multiplyScalar(look.ground);
    light.glowColor.value.set(look.glowColor);
    light.through.value = look.through;
    light.glow.value = look.glow;
    light.shadow.value = look.shadow;
    zenith.value.set(look.zenith);
    horizon.value.set(look.horizon);
    haze.value.set(look.haze);
    river.value.set(look.river);
    cloud.value = look.cloud;
    renderer.toneMappingExposure = look.exposure;
    sunCam.position.copy(light.sunDir.value).multiplyScalar(6);
    sunCam.up.set(0, 0, 1);
    sunCam.lookAt(0, 0, 0);
    sunCam.updateMatrixWorld(true);
    light.lx.value.setFromMatrixColumn(sunCam.matrixWorld, 0);
    light.ly.value.setFromMatrixColumn(sunCam.matrixWorld, 1);
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
  const fl = gui.addFolder("light");
  fl.add(look, "sunAzimuth", -180, 180, 1).onChange(refresh);
  fl.add(look, "sunElevation", 5, 89, 1).onChange(refresh);
  fl.add(look, "sun", 0, 6, 0.05).onChange(refresh);
  fl.add(look, "sky", 0, 3, 0.01).onChange(refresh);
  fl.add(look, "ground", 0, 3, 0.01).onChange(refresh);
  fl.add(look, "through", 0.1, 2, 0.01).onChange(refresh);
  fl.add(look, "glow", 0, 3, 0.01).onChange(refresh);
  fl.add(look, "shadow", 0, 4, 0.01).onChange(refresh);
  fl.add(look, "exposure", 0.2, 3, 0.01).onChange(refresh);
  fl.add(look, "cloud", 0, 1, 0.01).onChange(refresh);
  fl.add(look, "wind", 0, 4, 1);
  const fc = gui.addFolder("colour");
  for (const k of ["sunColor", "skyColor", "groundColor", "glowColor", "zenith", "horizon", "haze", "river"] as const) fc.addColor(look, k).onChange(refresh);
  const fv = gui.addFolder("camera");
  fv.add(look, "drift");
  fv.add(look, "driftAzimuth", 0, 180, 1);
  fv.add(look, "driftElevation", 0, 60, 1);

  const state = { hold: -1, frame: 0, pause: false, view: null as number[] | null };
  Object.assign(window, { __feather: { look, motion, state, refresh, heron, camera, stand, controls, renderer, scene, target, light } });

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    heron.update(ph * look.beats * Math.PI * 2);
    travel.value = ph * CLOUD_PERIOD * Math.round(look.wind);

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
    sky.position.copy(camera.position);

    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 1);
    renderer.render(depthScene, sunCam);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    stats.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = stand.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  wrap.unload = () => {
    renderer.dispose();
    target.dispose();
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
