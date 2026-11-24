// The studio every pendulum page stands in: renderer, a lit room for the metal to reflect, a key light with
// shadows, a dark mirror floor, and the picture's finish (glow, vignette, grain).
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { safe3 } from "./finite.ts";
import { float, hash, length, luminance, max, min, mix, pass, reflector, renderOutput, screenCoordinate, screenUV, smoothstep, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NeutralToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  RenderPipeline,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGPURenderer,
} from "three/webgpu";

export type Look = Record<string, number | string | boolean>;

export const studioLook = {
  exposure: 1,
  envLight: 1.5,
  key: 2.2,
  keyAzimuth: 35,
  keyElevation: 58,
  mirror: 0.35, // how much the floor reflects
  floorTone: "#0d0d10",
  back: "#1a1b20",
  backEdge: "#050506",
  bloom: 0.18,
  bloomRadius: 0.5,
  bloomThreshold: 0.9,
  bloomCap: 4, // the brightest a pixel goes into the bloom: a one-pixel glint thousands of times too bright flares into a blinking square
  vignette: 0.45,
  film: 0.02,
  tone: "neutral", // "neutral", "agx" or "aces"
  // a grade after the tone mapping, in the screen's colours (0 leaves the picture as the tone mapping made it)
  grade: 0,
  gradeContrast: 0.15, // toward an S curve
  gradeSaturation: 1.05,
  gradeShadows: "#6f86a8", // tinted toward in the darks
  gradeLights: "#ffd9b8", // and in the lights
  gradeSplit: 0.06,
};

type Room = "studio" | "ring" | "front" | "sky" | "cyc";

// The room only exists to be reflected: dark walls and a few bright shapes. A "ring" room is the same all the
// way round the vertical axis, so an eye circling about that axis sees an unchanging room.
function roomScene(name: Room) {
  // "cyc": the sky room with the lit floor of a studio cyclorama (as bright as the floor seen in the picture,
  // so a mirror that sees the real floor in one place and the room's in the next doesn't show the seam)
  const kind = name === "cyc" ? "sky" : name;
  const ground = name === "cyc" ? [0.95, 1, 1.08] : [0.5, 0.53, 0.57];
  const room = new Scene();
  const wall = new MeshBasicNodeMaterial({ side: BackSide });
  wall.colorNode = mix(vec3(0.02, 0.019, 0.018), vec3(0.12, 0.12, 0.13), uv().y.smoothstep(0.25, 0.85));
  if (kind === "sky") {
    // a pale blue day: bright above, a slate ground below the horizon (the dark streaks in polished folds)
    const y = uv().y;
    // a light studio: pale floor and walls, brighter above (the floor the machine stands on, as metal sees it)
    wall.colorNode = mix(mix(vec3(...ground), vec3(0.62, 0.68, 0.76), y.smoothstep(0.3, 0.5)), vec3(0.85, 0.92, 1.02), y.smoothstep(0.5, 0.95));
  }
  room.add(new Mesh(new SphereGeometry(40, 32, 16), wall));
  const glow = (r: number, g: number, b: number) => {
    const m = new MeshBasicNodeMaterial({ side: DoubleSide });
    m.colorNode = vec3(r, g, b);
    return m;
  };
  if (kind === "front") {
    // for things that face the eye: a large soft panel behind it, up and to the left, a cool strip to the right,
    // a warm low card behind the subject
    const panel = new Mesh(new PlaneGeometry(12, 7), glow(2.6, 2.55, 2.45));
    panel.position.set(-8, 7, 15);
    panel.lookAt(0, 0, 0);
    const strip = new Mesh(new PlaneGeometry(1.6, 12), glow(1.6, 1.75, 2.0));
    strip.position.set(13, 2, 9);
    strip.lookAt(0, 0, 0);
    const low = new Mesh(new PlaneGeometry(9, 1.5), glow(1.2, 0.75, 0.4));
    low.position.set(3, -7, 14);
    low.lookAt(0, 0, 0);
    const top = new Mesh(new PlaneGeometry(9, 5), glow(3, 3, 2.9));
    top.position.set(0, 14, 2);
    top.lookAt(0, 0, 0);
    room.add(panel, strip, low, top);
  } else if (kind === "sky") {
    // soft boxes all round, tall and narrow, so every fold finds a bright line and a dark gap next to it
    const top = new Mesh(new PlaneGeometry(12, 8), glow(4.5, 4.5, 4.4));
    top.position.set(-3, 15, 4);
    top.lookAt(0, 0, 0);
    room.add(top);
    for (const [az, w, c, y] of [
      [-150, 3, 3.2, 3],
      [-95, 1.2, 2.4, 2],
      [-40, 4, 2.8, 4],
      [10, 1, 3.5, 1],
      [55, 2.5, 2.2, 3],
      [110, 1.5, 3, 2],
      [165, 3.5, 2, 4],
    ] as const) {
      const a = (az * Math.PI) / 180;
      const m = new Mesh(new PlaneGeometry(w, 9), glow(c * 0.98, c, c * 1.04));
      m.position.set(Math.sin(a) * 16, y, Math.cos(a) * 16);
      m.lookAt(0, y, 0);
      room.add(m);
    }
    const floor = new Mesh(new PlaneGeometry(80, 80), glow(ground[0], ground[1], ground[2]));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    room.add(floor);
    // black flags between the soft boxes: polished metal needs dark lines as much as bright ones
    for (const [az, w, y] of [
      [-120, 3, 3],
      [-15, 2.2, 2],
      [80, 3, 3],
      [140, 1.6, 2],
    ] as const) {
      const a = (az * Math.PI) / 180;
      const m = new Mesh(new PlaneGeometry(w, 10), glow(0.02, 0.02, 0.025));
      m.position.set(Math.sin(a) * 15, y, Math.cos(a) * 15);
      m.lookAt(0, y, 0);
      room.add(m);
    }
  } else if (kind === "studio") {
    // one wide box above, two tall strips at the sides, a warm card low behind
    const top = new Mesh(new PlaneGeometry(9, 5), glow(5, 5, 4.8));
    top.position.set(0, 14, 2);
    top.lookAt(0, 0, 0);
    const left = new Mesh(new PlaneGeometry(1.4, 12), glow(3.5, 3.6, 3.9));
    left.position.set(-13, 4, 4);
    left.lookAt(0, 2, 0);
    const right = new Mesh(new PlaneGeometry(1.4, 12), glow(2.4, 2.5, 2.7));
    right.position.set(12, 4, -6);
    right.lookAt(0, 2, 0);
    const card = new Mesh(new PlaneGeometry(10, 2.5), glow(0.9, 0.55, 0.3));
    card.position.set(0, 1, -16);
    card.lookAt(0, 1, 0);
    const front = new Mesh(new PlaneGeometry(6, 1.2), glow(1.1, 1.15, 1.25));
    front.position.set(4, 2, 16);
    front.lookAt(0, 2, 0);
    room.add(top, left, right, card, front);
  } else {
    for (const [r, y, w, c] of [
      [6, 12, 0.5, 6],
      [11, 9, 0.25, 2.5],
      [24, 2.5, 0.35, 1.2],
    ] as const) {
      const ring = new Mesh(new TorusGeometry(r, w, 8, 96), glow(c, c * 0.98, c * 0.94));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      room.add(ring);
    }
    const warm = new Mesh(new TorusGeometry(30, 1.2, 8, 96), glow(0.9, 0.5, 0.25));
    warm.rotation.x = Math.PI / 2;
    warm.position.y = -1;
    room.add(warm);
  }
  return room;
}

export async function createStage(o: { canvas: HTMLCanvasElement; width: number; height: number; pixelRatio: number; name: string; look: Look; room?: Room; floorY?: number; floorSize?: number; timestamps?: boolean }) {
  const look = o.look as unknown as typeof studioLook;
  // timestamps: the GPU's own time for the frame's render passes, for a page's performance readout
  const renderer = new WebGPURenderer({ canvas: o.canvas, antialias: false, trackTimestamp: o.timestamps === true });
  renderer.setPixelRatio(o.pixelRatio);
  renderer.setSize(o.width, o.height);
  const toneOf = (t: string) => (t === "agx" ? AgXToneMapping : t === "aces" ? ACESFilmicToneMapping : NeutralToneMapping);
  renderer.toneMapping = toneOf(look.tone);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  await renderer.init();
  flattenSwizzles(renderer);

  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(roomScene(o.room ?? "studio"), 0.02).texture;
  scene.environmentIntensity = look.envLight;

  const back = uniform(new Color(look.back));
  const backEdge = uniform(new Color(look.backEdge));
  scene.backgroundNode = mix(back, backEdge, smoothstep(0.05, 0.95, length(screenUV.sub(vec2(0.5, 0.42)).mul(vec2(1.2, 1.4)))));

  const camera = new PerspectiveCamera(35, o.width / o.height, 0.05, 200);
  const controls = new OrbitControls(camera, o.canvas);
  controls.enableDamping = true;

  // key light: the only thing that casts shadows
  const key = new DirectionalLight(0xfff4e8, look.key);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  key.shadow.radius = 4;
  key.shadow.camera.up.set(0, 0, 1); // so a light straight down still has a frame
  scene.add(key, key.target);
  const aimKey = (reach: number, at = { x: 0, y: 0, z: 0 }) => {
    const az = ((look.keyAzimuth as number) * Math.PI) / 180;
    const el = ((look.keyElevation as number) * Math.PI) / 180;
    const d = reach * 3;
    key.position.set(at.x + d * Math.cos(el) * Math.sin(az), at.y + d * Math.sin(el), at.z + d * Math.cos(el) * Math.cos(az));
    key.target.position.set(at.x, at.y, at.z);
    const c = key.shadow.camera;
    c.left = c.bottom = -reach;
    c.right = c.top = reach;
    c.near = 0.1;
    c.far = d * 2;
    c.updateProjectionMatrix();
  };

  // floor: dark, glossy, a soft mirror that fades out with distance so it has no edge
  const floorY = o.floorY ?? 0;
  const size = o.floorSize ?? 12;
  const mirrorAmount = uniform(look.mirror);
  const floorTone = uniform(new Color(look.floorTone));
  const reflection = reflector({ resolutionScale: 0.5 });
  const floorMat = new MeshStandardNodeMaterial({ transparent: true, depthWrite: false });
  floorMat.roughness = 0.75;
  floorMat.metalness = 0;
  const fade = smoothstep(1, 0.15, length(uv().sub(0.5)).mul(2));
  floorMat.colorNode = floorTone;
  floorMat.emissiveNode = reflection.rgb.mul(mirrorAmount).mul(fade);
  floorMat.opacityNode = fade;
  const floor = new Mesh(new CircleGeometry(size, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  floor.add(reflection.target);
  reflection.target.rotation.x = 0; // the target follows the floor's own frame
  scene.add(floor);

  // the finish
  const scenePass = pass(scene, camera, { samples: Number(new URLSearchParams(location.search).get("samples") ?? 4) });
  const colour = scenePass.getTextureNode();
  // the bloom sees each pixel at most bloomCap bright (its colour kept): a glint on a mirror fold, a pixel or two
  // and a few thousand times brighter than the room, otherwise blooms into a square that blinks as it moves
  const bloomCap = uniform(look.bloomCap);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // (and nothing that is not a finite number gets in: in its smallest image one such pixel is a big black square)
  const tamed = (c: any) => {
    const v = safe3(c.rgb, vec3(0));
    return vec4(v.mul(min(float(1), bloomCap.div(max(max(v.r, v.g), max(v.b, 1e-4))))), 1);
  };
  let glow = bloom(tamed(colour), look.bloom, look.bloomRadius, look.bloomThreshold);
  const tick = uniform(0);
  const film = uniform(look.film);
  const vignette = uniform(look.vignette);
  const noise = hash(screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(3571)).add(tick.mul(7919)).toUint()).sub(0.5);
  const dark = float(1).sub(vignette.mul(smoothstep(0.3, 1.05, length(screenUV.sub(0.5).mul(vec2(1.1, 1.3))))));
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = vec4(colour.rgb.add(glow.rgb).mul(dark).mul(noise.mul(film).mul(4).add(1)), 1);
  // a page that works on the picture first (reflections, occlusion) hands its result here for the finish
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // (both outputs made once: rebuilding the finish leaves the old passes' work behind, frame after frame)
  let outputs: { glow: any; plain: any } | null = null;
  // the grade: the tone mapping and the screen's colours done here (not by the pipeline), then a gentle S curve,
  // saturation, and the darks and lights each tinted a little (cool and warm: the studio's light against its shade)
  const G = {
    amount: uniform(look.grade),
    contrast: uniform(look.gradeContrast),
    saturation: uniform(look.gradeSaturation),
    shadows: uniform(new Color(look.gradeShadows)),
    lights: uniform(new Color(look.gradeLights)),
    split: uniform(look.gradeSplit),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graded = (c: any) => {
    const d = renderOutput(c).rgb.clamp(0, 1);
    const l = luminance(d);
    const sat = mix(vec3(l), d, G.saturation);
    const curve = mix(sat, sat.mul(sat).mul(sat.mul(-2).add(3)), G.contrast);
    const toned = curve.add(G.shadows.sub(0.5).mul(G.split).mul(l.oneMinus().pow(2))).add(G.lights.sub(0.5).mul(G.split).mul(l.pow(2)));
    return vec4(mix(d, toned, G.amount), 1);
  };
  const finish = (picture: any) => {
    glow = bloom(tamed(picture), look.bloom, look.bloomRadius, look.bloomThreshold);
    const grain = noise.mul(film).mul(4).add(1);
    pipeline.outputColorTransform = false;
    outputs = { glow: graded(vec4(picture.rgb.add(glow.rgb).mul(dark).mul(grain), 1)), plain: graded(vec4(picture.rgb.mul(dark).mul(grain), 1)) };
    pipeline.outputNode = outputs.glow;
    pipeline.needsUpdate = true;
  };
  const setGlow = (on: boolean) => {
    if (!outputs) return;
    pipeline.outputNode = on ? outputs.glow : outputs.plain;
    pipeline.needsUpdate = true;
  };

  const refresh = () => {
    renderer.toneMappingExposure = look.exposure;
    if (renderer.toneMapping !== toneOf(look.tone)) {
      renderer.toneMapping = toneOf(look.tone);
      pipeline.needsUpdate = true;
    }
    G.amount.value = look.grade;
    G.contrast.value = look.gradeContrast;
    G.saturation.value = look.gradeSaturation;
    G.shadows.value.set(look.gradeShadows);
    G.lights.value.set(look.gradeLights);
    G.split.value = look.gradeSplit;
    scene.environmentIntensity = look.envLight;
    key.intensity = look.key;
    mirrorAmount.value = look.mirror;
    floorTone.value.set(look.floorTone);
    back.value.set(look.back);
    backEdge.value.set(look.backEdge);
    glow.strength.value = look.bloom;
    glow.radius.value = look.bloomRadius;
    glow.threshold.value = look.bloomThreshold;
    bloomCap.value = look.bloomCap;
    vignette.value = look.vignette;
    film.value = look.film;
  };

  const gui = new GUI({ title: o.name });
  gui.close();
  const studio = gui.addFolder("studio").close();
  studio.add(look, "exposure", 0.2, 3, 0.01).onChange(refresh);
  studio.add(look, "envLight", 0, 3, 0.01).onChange(refresh);
  studio.add(look, "key", 0, 8, 0.01).onChange(refresh);
  studio.add(look, "mirror", 0, 1, 0.01).onChange(refresh);
  studio.addColor(look, "floorTone").onChange(refresh);
  studio.addColor(look, "back").onChange(refresh);
  studio.addColor(look, "backEdge").onChange(refresh);
  studio.add(look, "bloom", 0, 2, 0.01).onChange(refresh);
  studio.add(look, "bloomRadius", 0, 1, 0.01).onChange(refresh);
  studio.add(look, "bloomThreshold", 0, 3, 0.01).onChange(refresh);
  studio.add(look, "bloomCap", 1, 64, 0.5).onChange(refresh);
  studio.add(look, "vignette", 0, 1, 0.01).onChange(refresh);
  studio.add(look, "tone", ["neutral", "agx", "aces"]).onChange(refresh);
  const gr = studio.addFolder("grade").close();
  gr.add(look, "grade", 0, 1, 0.01).onChange(refresh);
  gr.add(look, "gradeContrast", 0, 1, 0.01).name("contrast").onChange(refresh);
  gr.add(look, "gradeSaturation", 0, 2, 0.01).name("saturation").onChange(refresh);
  gr.addColor(look, "gradeShadows").name("shadows").onChange(refresh);
  gr.addColor(look, "gradeLights").name("lights").onChange(refresh);
  gr.add(look, "gradeSplit", 0, 0.3, 0.005).name("split").onChange(refresh);
  studio.add(look, "film", 0, 0.1, 0.001).onChange(refresh);

  const stats = new Stats();
  stats.dom.id = "stats";
  document.body.appendChild(stats.dom);

  // hold >= 0 pins the loop at that moment (for stills and films made from the page)
  const state = { hold: -1, frame: 0, ms: 0 };
  const render = () => {
    tick.value = (tick.value + 1) % 4096;
    controls.update();
    pipeline.render();
    stats.update();
    state.frame++;
  };
  const resize = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  const phase = (playhead: number) => (state.hold >= 0 ? state.hold : playhead);

  return { renderer, scene, camera, controls, gui, key, aimKey, floor, state, refresh, render, resize, phase, look, scenePass, pipeline, finish, setGlow };
}

export type Stage = Awaited<ReturnType<typeof createStage>>;

// ---- metals

export function brass(o: { rough?: number; color?: string; brushed?: number } = {}) {
  const m = new MeshPhysicalNodeMaterial();
  m.color.set(o.color ?? "#d9a95b");
  m.metalness = 1;
  m.roughness = o.rough ?? 0.22;
  if (o.brushed) {
    m.anisotropy = o.brushed;
    m.anisotropyRotation = 0;
  }
  m.clearcoat = 0.3;
  m.clearcoatRoughness = 0.08;
  return m;
}

export function chrome(rough = 0.06, color = "#e8e9ec") {
  const m = new MeshStandardNodeMaterial();
  m.color.set(color);
  m.metalness = 1;
  m.roughness = rough;
  return m;
}

export function blackSteel(rough = 0.35) {
  const m = new MeshStandardNodeMaterial();
  m.color.set("#1c1d20");
  m.metalness = 0.85;
  m.roughness = rough;
  return m;
}

// a rod of unit length along +y from the origin, radius 1: scaled per use
export const rodGeometry = (sides = 10) => {
  const g = new CylinderGeometry(1, 1, 1, sides, 1, false);
  g.translate(0, 0.5, 0);
  return g;
};
export const unitBox = () => new BoxGeometry(1, 1, 1);

// Tint's bounds-check lowering in Chromium chokes on three's `v.xy.x`; flatten such double swizzles
// before the shader reaches the device (see 04-tangle).
function flattenSwizzles(renderer: WebGPURenderer) {
  const { device } = renderer.backend as unknown as { device?: GPUDevice };
  if (!device) return;
  const create = device.createShaderModule.bind(device);
  const flat = (_: string, first: string, second: string) => `.${first["xyzw".indexOf(second)]}`;
  device.createShaderModule = (descriptor) => create({ ...descriptor, code: descriptor.code.replace(/\.([xyzw]{2,4})\.([xyzw])\b/g, flat) });
}
