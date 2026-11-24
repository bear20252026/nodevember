// A shape made of seaweed, on a stalk, in a current, with the sun going over it: weed all the way through, and on
// the side the current leaves by it lets go into streamers. The pointer is a hand in it. Which shape is the page's
// (`data-shape` on its body: Blender's monkey, or the Venus de Milo). The shape is grown in grow.ts and drawn in
// weed.ts; the sun through it is deep.ts; water, snow and lens are the zoom page's own.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { Fn, cameraPosition, dot, float, hash, length, mx_noise_float, normalize, pass, positionWorld, saturate, screenCoordinate, screenUV, sin, smoothstep, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { ACESFilmicToneMapping, AgXToneMapping, Color, DoubleSide, FrontSide, Mesh, NeutralToneMapping, NodeMaterial, PerspectiveCamera, PlaneGeometry, RenderPipeline, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import type { Options } from "./grow.ts";
import { defaults, grow } from "./grow.ts";
import { lens } from "./lens.ts";
import { createDeepLight } from "./deep.ts";
import { bladeKeeps, createLook, solidKeeps } from "./look.ts";
import type { WeedOptions } from "./weed.ts";
import { createWeed } from "./weed.ts";
import { createSnow } from "./snow.ts";
import { createWater } from "./water.ts";

const look = {
  exposure: 1,
  tone: "neutral",
  sun: 2.1,
  sunColor: "#fff6dc",
  sunAzimuth: 300, // 0 is from the eye's side, 180 straight behind the plant (try 152); under 180 it comes from downstream
  sunElevation: 46,
  sunSway: 22, // degrees the sun goes either side of that in a loop, so that its light moves through the weed
  web: 0.85,
  webSize: 1.7,
  webDepth: 1.0,
  webBlur: 0.6,
  up: "#0e4f63",
  low: "#020d18",
  ambient: 1.9,
  takes: "#84a850", // the colour of sunlight after one frond
  thick: 1,
  glow: 1,
  rind: "#3e5a1a",
  stem: "#2c3513",
  relief: 1,
  gloss: 0.35,
  sand: "#3d3829",
  haze: 0.1,
  clear: 1,
  top: 5,
  surface: 0.45,
  glare: 2.5,
  shafts: 0.3,
  shaftSize: 2.6,
  shaftBlur: 3,
  gap: 0.3, // how dark the water between shafts may get
  snow: 0.7,
  snowSize: 0.004,
  current: 1, // slab widths the snow is carried in a loop
  sway: 1,
  flutter: 1,
  stream: 0.55,
  bladeLength: 1,
  bladeWidth: 1,
  cup: 0.45,
  smooth: 0.8,
  apart: 0.03, // how thick the first layer of the sun map is: fronds nearer than this shade each other only in part
  breathe: 0.5,
  aged: 0.5,
  age: 0,
  focus: 0,
  blur: 1.0,
  depth: 1.8,
  bloom: 0.18,
  bloomRadius: 0.5,
  bloomThreshold: 0.9,
  film: 0.02,
  vignette: 0.4,
  fov: 34,
  wide: 1, // how wide the shape is against the monkey, for a tall picture
  far: 4.1, // eye to the plant
  eyeHeight: -0.5,
  aim: 0.1,
  turn: -28, // degrees round from straight in front: from the side the current comes from, where the face holds
  grown: 1, // 0 nothing yet .. 1 all there
  hand: 1, // how hard the pointer pushes the weed
  swing: 16, // and how far it goes either side of that in a loop
};

const FULL = 1.4; // the growth clock when everything born has opened and thickened

// the shapes: where each is, what is different about growing it, drawing it and looking at it
type Piece = { file: string; title: string; grow: Partial<Options>; weed: WeedOptions; look: Partial<typeof look> };
const pieces: Record<string, Piece> = {
  suzanne: { file: "./suzanne.json", title: "kelp monkey", grow: {}, weed: {}, look: {} },
  // tall and narrow, with finer features: stood nearly on the sand, more and shorter fronds, and "downstream" begins sooner
  venus: {
    file: "./venus.json", // made from 03-melt/venus.glb by tools/shape.mjs
    title: "kelp venus",
    grow: { size: 1.25, at: [0, 0.15, 0], floor: -1.3, step: 0.011, near: 0.013, skin: 34000, inside: 7000, blades: 16000, bladeGap: 0.013, inner: 6000, innerGap: 0.026 },
    // she is slight, and a limb as thick as the monkey's would show through her skin: only the stalk is drawn
    weed: { hold: 0.26, gone: 0.66, stray: 0.03, limb: 1, quads: [4, 1] },
    look: { far: 5.3, aim: 0.1, eyeHeight: -0.3, wide: 0.62, bladeLength: 0.6, bladeWidth: 0.75, smooth: 0.9, breathe: 0.25, flutter: 0.7, turn: -25, swing: 20 },
  },
};
const piece = pieces[document.body.dataset.shape ?? "suzanne"] ?? pieces.suzanne;
Object.assign(look, piece.look);

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
  const shape = await (await fetch(piece.file)).json();
  const t0 = performance.now();
  // ?seed=7 for another plant; ?grow={"blades":3000} for any of grow.ts' numbers; ?weed={"gone":2} for weed.ts'
  const grown = grow(shape, { seed: Number(query.get("seed") ?? defaults.seed), ...piece.grow, ...JSON.parse(query.get("grow") ?? "{}") });
  const weed = createWeed(grown, { ...piece.weed, ...JSON.parse(query.get("weed") ?? "{}") });
  console.log(`kelp: grown in ${(performance.now() - t0).toFixed(0)} ms: ${weed.blade.count} fronds (${weed.blade.inside} of them inside, ${weed.blade.freed} free), ${weed.branch.tris} triangles of limb`);
  const middle = new Vector3(...grown.options.at);
  const floorY = grown.options.floor;

  const light = createDeepLight([
    ...weed.blade.geometries.map((geometry) => ({ geometry, keeps: bladeKeeps(weed.blade.drawn), side: DoubleSide, position: weed.blade.position(false) })),
    { geometry: weed.branch.geometry, keeps: solidKeeps(float(0)), side: FrontSide, position: weed.branch.position() },
  ]);
  light.U.centre.value.set(0, (grown.hi[1] + floorY) / 2, 0);
  const shade = createLook(light);

  const scene = new Scene();
  const put = (geometry: Mesh["geometry"], material: NodeMaterial) => {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  const bladeMaterial = new NodeMaterial();
  bladeMaterial.side = DoubleSide;
  bladeMaterial.positionNode = weed.blade.position(true);
  bladeMaterial.fragmentNode = shade.bladeLit(weed.blade.drawn, weed.blade.normal);
  for (const geometry of weed.blade.geometries) put(geometry, bladeMaterial);
  const branchMaterial = new NodeMaterial();
  branchMaterial.positionNode = weed.branch.position();
  branchMaterial.fragmentNode = shade.solidLit(weed.branch.drawn, weed.branch.normal);
  put(weed.branch.geometry, branchMaterial);

  // ---- the sand: ridges square to the current, and on it the plant's shadow, amber where blades stand in the sun
  const sand = uniform(new Vector3(0.3, 0.28, 0.2));
  const floorMaterial = new NodeMaterial();
  floorMaterial.fragmentNode = Fn(() => {
    const pos = positionWorld;
    const away = length(cameraPosition.sub(pos));
    const fine = smoothstep(9, 2.5, away); // the ridges are let go before they are finer than the picture
    const high = (p: Node<"vec2">) => {
      const wander = mx_noise_float(vec3(p.mul(0.7), 3)).mul(9).add(mx_noise_float(vec3(p.mul(2.6), 7)).mul(2.2));
      const ridge = sin(dot(p, weed.U.flow.xz).mul(44).add(wander));
      return ridge.mul(0.0016).mul(fine).add(mx_noise_float(vec3(p.mul(0.5), 9)).mul(0.02));
    };
    const e = 0.012;
    const h = high(pos.xz);
    const normal = normalize(vec3(h.sub(high(pos.xz.add(vec2(e, 0)))).div(e), 1, h.sub(high(pos.xz.add(vec2(0, e)))).div(e)));
    const grain = mx_noise_float(vec3(pos.xz.mul(60), 1)).mul(fine).mul(0.12).add(mx_noise_float(vec3(pos.xz.mul(1.7), 5)).mul(0.12)).add(1);
    const sun = shade.U.sunColor
      .mul(shade.U.sun)
      .mul(light.gathered(pos, shade.U.webBlur.add(1.3)))
      .mul(light.through(pos))
      .mul(saturate(dot(normal, light.U.dir)));
    // far sand is lost sooner than the water alone would lose it, so there is no line where it ends
    return vec4(sand.mul(grain).mul(sun.add(shade.sky(normal).mul(shade.U.ambient).mul(0.5))).mul(smoothstep(22, 5, away)), 1);
  })();
  const floor = put(new PlaneGeometry(90, 90).rotateX(-Math.PI / 2), floorMaterial);
  floor.position.y = floorY;

  // ---- the eye: a little under the head, looking up at it, and going slowly from side to side
  const camera = new PerspectiveCamera(look.fov, width / height, 0.05, 120);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.62;
  let swung = 0;
  const frameUp = () => {
    const aspect = camera.aspect;
    // a tall picture gets a wider lens, as far as the shape is wide
    const half = Math.tan((look.fov * Math.PI) / 360) * Math.max(1, look.wide / aspect);
    camera.fov = (Math.atan(half) * 360) / Math.PI;
    const turn = (look.turn * Math.PI) / 180;
    camera.position.set(Math.sin(turn) * look.far, look.eyeHeight, Math.cos(turn) * look.far);
    controls.target.set(0, look.aim, 0);
    camera.updateProjectionMatrix();
    controls.update();
    swung = 0;
  };
  frameUp();

  // ---- the water, then glow and film
  const scenePass = pass(scene, camera, { samples: Number(query.get("samples") ?? 4) });
  const tick = uniform(0);
  const water = createWater(light, shade, scenePass.getTextureNode(), scenePass.getTextureNode("depth"), camera, tick);
  const focus = uniform(3);
  const depthOfField = uniform(look.depth);
  const blur = uniform(look.blur);
  const sharp = lens(water.node.rgb, scenePass.getViewZNode(), focus, depthOfField, blur, 32);
  const snow = createSnow(light, scenePass.getTextureNode("depth"), water.takes, 1400, true);
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
  let lastPhase = 0;
  const sunAt = (ph: number) => {
    lastPhase = ph;
    const az = ((look.sunAzimuth + look.sunSway * Math.sin(ph * Math.PI * 2)) * Math.PI) / 180,
      el = (look.sunElevation * Math.PI) / 180;
    light.U.dir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    light.aim();
  };
  const refresh = () => {
    renderer.toneMappingExposure = look.exposure;
    shade.U.sun.value = look.sun;
    tint(shade.U.sunColor.value, look.sunColor);
    sunAt(lastPhase);
    light.U.web.value = look.web;
    light.U.webSize.value = look.webSize;
    light.U.deep.value = look.webDepth;
    shade.U.webBlur.value = look.webBlur;
    tint(shade.U.up.value, look.up);
    tint(shade.U.low.value, look.low);
    shade.U.ambient.value = look.ambient;
    swatch.set(look.takes);
    light.U.takes.value.set(-Math.log(Math.max(swatch.r, 1e-3)), -Math.log(Math.max(swatch.g, 1e-3)), -Math.log(Math.max(swatch.b, 1e-3)));
    shade.U.thick.value = look.thick;
    shade.U.glow.value = look.glow;
    tint(shade.U.rind.value, look.rind);
    tint(shade.U.stem.value, look.stem);
    // what gets round into the deepest shade has come through weed: a dark green
    tint(shade.U.around.value, look.takes).multiplyScalar(0.11);
    shade.U.relief.value = look.relief;
    shade.U.gloss.value = look.gloss;
    shade.U.aged.value = look.aged;
    tint(sand.value, look.sand);
    water.U.haze.value = look.haze;
    water.U.takes.value.set(0.2, 0.07, 0.05).divideScalar(look.clear);
    water.U.top.value = look.top;
    water.U.surface.value = look.surface;
    water.U.glare.value = look.glare;
    water.U.shafts.value = look.shafts;
    water.U.shaftSize.value = look.shaftSize;
    water.U.shaftBlur.value = look.shaftBlur;
    water.U.gap.value = look.gap;
    weed.U.sway.value = look.sway;
    weed.U.flutter.value = look.flutter;
    weed.U.stream.value = look.stream;
    weed.U.bladeLength.value = look.bladeLength;
    weed.U.bladeWidth.value = look.bladeWidth;
    weed.U.cup.value = look.cup;
    weed.U.smooth.value = look.smooth;
    weed.U.breathe.value = look.breathe;
    light.setLayers(look.apart);
    weed.U.age.value = look.age;
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
    snow.U.flow.value = Math.round(look.current);
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
  const gui = new GUI({ title: piece.title });
  gui.close();
  const fs = gui.addFolder("sun");
  fs.add(look, "sun", 0, 10, 0.05).onChange(refresh);
  fs.addColor(look, "sunColor").onChange(refresh);
  fs.add(look, "sunAzimuth", 0, 360, 1).onChange(refresh);
  fs.add(look, "sunElevation", 30, 89, 1).onChange(refresh);
  fs.add(look, "sunSway", 0, 90, 1);
  fs.add(look, "web", 0, 1, 0.01).onChange(refresh);
  fs.add(look, "webSize", 0.3, 5, 0.01).onChange(refresh);
  fs.add(look, "webDepth", 0.2, 2.5, 0.01).onChange(refresh);
  fs.add(look, "webBlur", 0, 5, 0.01).onChange(refresh);
  const fb = gui.addFolder("plant");
  fb.addColor(look, "takes").name("through one").onChange(refresh);
  fb.add(look, "thick", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "glow", 0, 3, 0.01).onChange(refresh);
  fb.addColor(look, "rind").onChange(refresh);
  fb.addColor(look, "stem").onChange(refresh);
  fb.add(look, "aged", 0, 1.5, 0.01).onChange(refresh);
  fb.add(look, "age", -30, 30, 0.5).onChange(refresh);
  fb.add(look, "relief", 0, 4, 0.01).onChange(refresh);
  fb.add(look, "gloss", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "bladeLength", 0.3, 2.5, 0.01).onChange(refresh);
  fb.add(look, "bladeWidth", 0.3, 2.5, 0.01).onChange(refresh);
  fb.add(look, "cup", 0.05, 2, 0.01).onChange(refresh);
  fb.add(look, "smooth", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "apart", 0.005, 0.15, 0.001).onChange(refresh);
  fb.add(look, "breathe", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "sway", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "flutter", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "stream", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "grown", 0, 1, 0.001);
  fb.add(look, "hand", 0, 3, 0.01);
  const fw = gui.addFolder("water");
  fw.addColor(look, "up").onChange(refresh);
  fw.addColor(look, "low").onChange(refresh);
  fw.add(look, "ambient", 0, 3, 0.01).onChange(refresh);
  fw.addColor(look, "sand").onChange(refresh);
  fw.add(look, "haze", 0, 0.6, 0.005).onChange(refresh);
  fw.add(look, "clear", 0.2, 4, 0.01).onChange(refresh);
  fw.add(look, "top", 1, 10, 0.05).onChange(refresh);
  fw.add(look, "surface", 0, 5, 0.01).onChange(refresh);
  fw.add(look, "glare", 0, 10, 0.05).onChange(refresh);
  fw.add(look, "shafts", 0, 1, 0.005).onChange(refresh);
  fw.add(look, "shaftSize", 0.5, 8, 0.05).onChange(refresh);
  fw.add(look, "shaftBlur", 0, 6, 0.05).onChange(refresh);
  fw.add(look, "gap", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "snow", 0, 5, 0.01).onChange(refresh);
  fw.add(look, "snowSize", 0.001, 0.02, 0.0005).onChange(refresh);
  fw.add(look, "current", 0, 3, 1).onChange(refresh);
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
  fp.add(look, "turn", -180, 180, 1).onChange(frameUp);
  fp.add(look, "swing", 0, 90, 1);

  // ---- the hand: the pointer's line through the water, eased after the pointer. What it does to the weed is
  // weed.ts' `touch`: every frond is a spring under it
  const pointer = { x: 0, y: 0, here: false };
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = 1 - ((e.clientY - r.top) / r.height) * 2;
    pointer.here = e.buttons === 0; // a drag turns the eye instead
  };
  const onLeave = () => (pointer.here = false);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", onLeave);
  const hand = { at: new Vector3(), was: new Vector3(), speed: new Vector3(), want: new Vector3(), step: new Vector3(), there: 0, begun: false, time: performance.now() };

  const state = { hold: -1, frame: 0, pause: false, still: false, skipLight: false };
  Object.assign(window, { __kelp: { look, state, refresh, frameUp, grown, weed, light, camera, controls, renderer, scene, pointer } });
  const frames = Math.round((duration / 1000) * 60);
  const up = new Vector3(0, 1, 0);

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = (state.hold >= 0 ? state.hold : playhead) % 1;
    sunAt(ph);
    weed.U.grow.value = look.grown * FULL;
    weed.U.phase.value = ph;

    // the swing is added to wherever the hand has put the eye
    const swing = ((look.swing * Math.PI) / 180) * Math.sin(ph * Math.PI * 2);
    camera.position.sub(controls.target).applyAxisAngle(up, swing - swung).add(controls.target);
    swung = swing;
    controls.update();
    camera.updateMatrixWorld();

    // where the pointer's line passes the plant, followed with a little lag; its speed drags the weed along
    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - hand.time) / 1000));
    hand.time = now;
    hand.want.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize().multiplyScalar(camera.position.distanceTo(middle)).add(camera.position);
    if (!hand.begun && pointer.here) {
      hand.at.copy(hand.want);
      hand.begun = true;
    }
    hand.was.copy(hand.at);
    hand.at.lerp(hand.want, 1 - Math.exp(-dt * 14));
    hand.speed.lerp(hand.step.copy(hand.at).sub(hand.was).divideScalar(dt), 1 - Math.exp(-dt * 7));
    hand.there += ((pointer.here ? 1 : 0) - hand.there) * (1 - Math.exp(-dt * 5));
    weed.blade.touch(dt, camera.position, hand.step.copy(hand.at).sub(camera.position).normalize(), hand.speed, hand.there, look.hand);

    water.U.eye.value.copy(camera.position);
    focus.value = camera.position.distanceTo(middle) - look.focus;
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
    canvas.removeEventListener("pointermove", onMove);
    canvas.removeEventListener("pointerleave", onLeave);
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
  duration: 24_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
