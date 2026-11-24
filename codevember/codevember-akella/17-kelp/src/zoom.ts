import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { float, hash, length, pass, screenCoordinate, screenUV, smoothstep, uniform, vec2, vec4 } from "three/tsl";
import { ACESFilmicToneMapping, AgXToneMapping, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Mesh, NeutralToneMapping, PerspectiveCamera, RenderPipeline, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import { lens } from "./lens.ts";
import { createLight } from "./light.ts";
import { bladeKeeps, createLook, solidKeeps } from "./look.ts";
import { createPlant, shape } from "./plant.ts";
import { createSnow } from "./snow.ts";
import { createWater } from "./water.ts";

const look = {
  exposure: 1,
  tone: "neutral",
  sun: 2.3,
  sunColor: "#fff6dc",
  sunAzimuth: 160, // 180 is straight behind the plant
  sunElevation: 54,
  web: 0.85,
  webSize: 1.7,
  webDepth: 1.0,
  webBlur: 0.5,
  up: "#0e4f63",
  low: "#020d18",
  ambient: 1.5,
  takes: "#c79a22", // the colour of sunlight after one blade
  thick: 1,
  glow: 1,
  rind: "#5c4410",
  relief: 1,
  gloss: 0.35,
  haze: 0.11,
  clear: 1, // how far the colours of things carry
  top: 9,
  surface: 0.6,
  glare: 2.5,
  shafts: 0.4,
  shaftSize: 2.6,
  shaftBlur: 2.5,
  snow: 0.7,
  snowSize: 0.004,
  focus: 0, // in front of (+) or behind the tip
  blur: 1.2, // disc radius of the most out of focus, in 250ths of the picture's height
  depth: 1.6, // how far from the focal plane that is
  aged: 0.5,
  bloom: 0.25,
  bloomRadius: 0.5,
  bloomThreshold: 0.9,
  film: 0.02,
  vignette: 0.4,
  fov: 34,
  far: 3.0, // eye to the plant
  eyeHeight: -1.75,
  aim: -0.62,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio, duration }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const query = new URLSearchParams(location.search);

  const renderer = new WebGPURenderer({ canvas, antialias: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  const tones = { aces: ACESFilmicToneMapping, agx: AgXToneMapping, neutral: NeutralToneMapping };
  renderer.toneMapping = tones[(query.get("tone") ?? look.tone) as keyof typeof tones] ?? NeutralToneMapping;
  await renderer.init();
  flattenSwizzles(renderer);

  // ---- the plant
  const plant = createPlant();
  const geometryOf = (part: typeof plant.blade) => {
    const g = new BufferGeometry();
    const attrs = [new BufferAttribute(part.pos, 3), new BufferAttribute(part.nor, 3), new BufferAttribute(part.aux, 4), new BufferAttribute(part.aux2, 4)];
    for (const [i, name] of ["position", "normal", "aux", "aux2"].entries()) {
      attrs[i].setUsage(DynamicDrawUsage);
      g.setAttribute(name, attrs[i]);
    }
    g.setIndex(new BufferAttribute(part.index, 1));
    return { g, attrs };
  };
  const blades = geometryOf(plant.blade);
  const solids = geometryOf(plant.solid);

  const light = createLight([
    { geometry: blades.g, keeps: bladeKeeps(), side: DoubleSide },
    { geometry: solids.g, keeps: solidKeeps(), side: DoubleSide },
  ]);
  const shade = createLook(light);

  const scene = new Scene();
  for (const [part, material] of [
    [blades, shade.blade],
    [solids, shade.solid],
  ] as const) {
    const mesh = new Mesh(part.g, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // ---- the eye: below the tip, looking up past it at the light
  const camera = new PerspectiveCamera(look.fov, width / height, 0.05, 80);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  const frameUp = () => {
    // a tall picture gets a wider lens, so the plant keeps its width
    const aspect = camera.aspect;
    const half = Math.tan((look.fov * Math.PI) / 360) * Math.max(1, 1.15 / aspect);
    camera.fov = (Math.atan(half) * 360) / Math.PI;
    camera.position.set(0, look.eyeHeight, look.far);
    controls.target.set(0, look.aim, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  // ---- the water, then glow and film
  const scenePass = pass(scene, camera, { samples: Number(query.get("samples") ?? 4) });
  const tick = uniform(0);
  const water = createWater(light, shade, scenePass.getTextureNode(), scenePass.getTextureNode("depth"), camera, tick);
  // a lens focused on the tip, then the snow over it (each speck is its own disc already)
  const focus = uniform(3);
  const depthOfField = uniform(look.depth);
  const blur = uniform(look.blur);
  const sharp = lens(water.node.rgb, scenePass.getViewZNode(), focus, depthOfField, blur, 32);
  const snow = createSnow(light, scenePass.getTextureNode("depth"), water.takes);
  const snowScene = new Scene();
  snowScene.add(snow.sprite);
  const snowPass = pass(snowScene, camera);
  const picture = vec4(sharp.rgb.add(snowPass.getTextureNode().rgb), 1);
  const bloomPass = bloom(picture, look.bloom, look.bloomRadius, look.bloomThreshold);
  const film = uniform(look.film);
  const vignette = uniform(look.vignette);
  const noise = hash(screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(3571)).add(tick.mul(7919)).toUint()).sub(0.5);
  const dark = float(1).sub(vignette.mul(smoothstep(0.35, 1.05, length(screenUV.sub(0.5).mul(vec2(1.1, 1.3))))));
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = vec4(picture.rgb.add(bloomPass.rgb).mul(dark).mul(noise.mul(film).mul(4).add(1)), 1);

  const swatch = new Color();
  const tint = (v: Vector3, hex: string) => v.setFromColor(swatch.set(hex));
  const refresh = () => {
    renderer.toneMappingExposure = look.exposure;
    shade.U.sun.value = look.sun;
    tint(shade.U.sunColor.value, look.sunColor);
    const az = (look.sunAzimuth * Math.PI) / 180,
      el = (look.sunElevation * Math.PI) / 180;
    light.U.dir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    light.aim();
    light.U.dir.value.toArray(plant.sun);
    light.U.web.value = look.web;
    light.U.webSize.value = look.webSize;
    light.U.deep.value = look.webDepth;
    shade.U.webBlur.value = look.webBlur;
    tint(shade.U.up.value, look.up);
    tint(shade.U.low.value, look.low);
    shade.U.ambient.value = look.ambient;
    // the colour is what is left after a blade; what the blade keeps is its logarithm
    swatch.set(look.takes);
    light.U.takes.value.set(-Math.log(Math.max(swatch.r, 1e-3)), -Math.log(Math.max(swatch.g, 1e-3)), -Math.log(Math.max(swatch.b, 1e-3)));
    shade.U.thick.value = look.thick;
    shade.U.glow.value = look.glow;
    tint(shade.U.rind.value, look.rind);
    shade.U.relief.value = look.relief;
    shade.U.gloss.value = look.gloss;
    water.U.haze.value = look.haze;
    water.U.takes.value.set(0.2, 0.07, 0.05).divideScalar(look.clear);
    water.U.top.value = look.top;
    water.U.surface.value = look.surface;
    water.U.glare.value = look.glare;
    water.U.shafts.value = look.shafts;
    water.U.shaftSize.value = look.shaftSize;
    water.U.shaftBlur.value = look.shaftBlur;
    shade.U.aged.value = look.aged;
    blur.value = (look.blur * renderer.domElement.height) / 250;
    depthOfField.value = look.depth;
    snow.U.blur.value = blur.value;
    snow.U.range.value = look.depth;
    snow.U.pixel.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / renderer.domElement.height;
    snow.U.bright.value = look.snow;
    snow.U.size.value = look.snowSize;
    snow.U.sun.value = look.sun;
    snow.U.sunColor.value.copy(shade.U.sunColor.value);
    snow.U.dim.value.copy(shade.U.up.value).multiplyScalar(0.8);
    bloomPass.strength.value = look.bloom;
    bloomPass.radius.value = look.bloomRadius;
    bloomPass.threshold.value = look.bloomThreshold;
    film.value = look.film;
    vignette.value = look.vignette;
  };
  refresh();

  // ---- panel
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "kelp" });
  gui.close();
  const fs = gui.addFolder("sun");
  fs.add(look, "sun", 0, 10, 0.05).onChange(refresh);
  fs.addColor(look, "sunColor").onChange(refresh);
  fs.add(look, "sunAzimuth", 0, 360, 1).onChange(refresh);
  fs.add(look, "sunElevation", 30, 89, 1).onChange(refresh);
  fs.add(look, "web", 0, 1, 0.01).onChange(refresh);
  fs.add(look, "webSize", 0.3, 5, 0.01).onChange(refresh);
  fs.add(look, "webDepth", 0.2, 2.5, 0.01).onChange(refresh);
  fs.add(look, "webBlur", 0, 5, 0.01).onChange(refresh);
  const fb = gui.addFolder("blades");
  fb.addColor(look, "takes").name("through one").onChange(refresh);
  fb.add(look, "thick", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "glow", 0, 3, 0.01).onChange(refresh);
  fb.addColor(look, "rind").onChange(refresh);
  fb.add(look, "aged", 0, 1.5, 0.01).onChange(refresh);
  fb.add(look, "relief", 0, 4, 0.01).onChange(refresh);
  fb.add(look, "gloss", 0, 2, 0.01).onChange(refresh);
  fb.add(shape, "lean", 0.3, 1.8, 0.01);
  fb.add(shape, "face", 0, 1, 0.01);
  fb.add(shape, "length", 0.3, 1.5, 0.01);
  fb.add(shape, "width", 0.05, 0.4, 0.005);
  fb.add(shape, "ruffle", 0, 0.8, 0.01);
  fb.add(shape, "sway", 0, 3, 0.01);
  const fw = gui.addFolder("water");
  fw.addColor(look, "up").onChange(refresh);
  fw.addColor(look, "low").onChange(refresh);
  fw.add(look, "ambient", 0, 3, 0.01).onChange(refresh);
  fw.add(look, "haze", 0, 0.6, 0.005).onChange(refresh);
  fw.add(look, "clear", 0.2, 4, 0.01).onChange(refresh);
  fw.add(look, "top", 1, 10, 0.05).onChange(refresh);
  fw.add(look, "surface", 0, 5, 0.01).onChange(refresh);
  fw.add(look, "glare", 0, 10, 0.05).onChange(refresh);
  fw.add(look, "shafts", 0, 1, 0.005).onChange(refresh);
  fw.add(look, "shaftSize", 0.5, 8, 0.05).onChange(refresh);
  fw.add(look, "shaftBlur", 0, 6, 0.05).onChange(refresh);
  fw.add(look, "snow", 0, 5, 0.01).onChange(refresh);
  fw.add(look, "snowSize", 0.001, 0.02, 0.0005).onChange(refresh);
  const fp = gui.addFolder("picture");
  fp.add(look, "exposure", 0.2, 3, 0.01).onChange(refresh);
  fp.add(look, "focus", -2, 2, 0.01);
  fp.add(look, "depth", 0.1, 6, 0.01).onChange(refresh);
  fp.add(look, "blur", 0, 6, 0.01).onChange(refresh);
  fp.add(look, "bloom", 0, 2, 0.01).onChange(refresh);
  fp.add(look, "bloomRadius", 0, 1, 0.01).onChange(refresh);
  fp.add(look, "bloomThreshold", 0, 2, 0.01).onChange(refresh);
  fp.add(look, "film", 0, 0.1, 0.001).onChange(refresh);
  fp.add(look, "vignette", 0, 1, 0.01).onChange(refresh);
  fp.add(look, "fov", 10, 70, 1).onChange(frameUp);

  const state = { hold: -1, frame: 0, pause: false, ms: 0, still: false, skipPose: false, skipLight: false }; // still: no dither that changes by frame, for comparing frames
  Object.assign(window, { __kelp: { look, shape, state, refresh, frameUp, plant, light, camera, controls, renderer, scene } });
  const frames = Math.round((duration / 1000) * 60);

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = (state.hold >= 0 ? state.hold : playhead) % 1;
    const t0 = performance.now();
    if (!state.skipPose) {
      plant.pose(ph);
      for (const part of [blades, solids]) for (const a of part.attrs) a.needsUpdate = true;
    }
    state.ms += (performance.now() - t0 - state.ms) * 0.1;

    controls.update();
    camera.updateMatrixWorld();
    water.U.eye.value.copy(camera.position);
    focus.value = camera.position.length() - look.focus;
    snow.U.phase.value = ph;
    snow.U.focus.value = focus.value;
    snow.U.eye.value.copy(camera.position);
    camera.getWorldDirection(snow.U.ahead.value);
    tick.value = state.still ? 0 : Math.round(ph * frames) % frames;
    if (!state.skipLight) light.render(renderer, ph);
    pipeline.render();
    stats.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = width / height;
    renderer.setSize(width, height);
    frameUp();
    refresh();
  };

  wrap.unload = () => {
    renderer.dispose();
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
  duration: 16_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
