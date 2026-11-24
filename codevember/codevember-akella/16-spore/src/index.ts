import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { Loop, dot, float, getViewPosition, hash, interleavedGradientNoise, length, mix, normalize, pass, screenCoordinate, screenUV, smoothstep, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { ACESFilmicToneMapping, AgXToneMapping, NeutralToneMapping, BufferAttribute, BufferGeometry, Color, Data3DTexture, DynamicDrawUsage, HalfFloatType, LinearFilter, Mesh, PerspectiveCamera, RGFormat, RedFormat, RenderPipeline, RepeatWrapping, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import { lens } from "./lens.ts";
import { createLook } from "./look.ts";
import { createMotes } from "./motes.ts";
import { createPour } from "./pour.ts";
import { CAP_RINGS, CAP_SIDES, HALF, RINGS, ROUND, SIDES, VOL, load } from "./stage.ts";

const look = {
  density: 1, // share of the baked mushrooms drawn
  flop: 0.03, // how far a cap is left behind when its stem is thrown
  exposure: 1.0,
  lamp: 4.25,
  lampColor: "#ffd2a0",
  lampLow: -2.7,
  lampHigh: -1.2,
  lampSize: 0.6,
  redden: 1.5,
  soft: 0.15,
  through: 2.6,
  edge: 0.5,
  hollow: 2.6,
  tone: "neutral",
  key: 1.3,
  keyColor: "#b8d6ff",
  keyAzimuth: -130,
  keyElevation: 32,
  shade: 7,
  rim: 0.35,
  rimColor: "#8cb8ff",
  sky: 0.22,
  skyColor: "#4d6ba6",
  flesh: "#edE6d6",
  grain: 1,
  grainSize: 70,
  bumps: 0.45,
  air: 0.004,
  spores: 2.5,
  sporeSize: 0.0035,
  pour: 1, // spores let go by the ripe caps: how bright
  pourShare: 1, // how many of them
  pourSize: 0.0016,
  pourFall: 0.22, // units a second
  pourStray: 0.07, // how far a pour wanders as it falls
  bloom: 0.15,
  bloomRadius: 0.6,
  bloomThreshold: 0.75,
  focus: 0, // in front of (+) or behind the pile's axis
  blur: 1.4, // disc radius of the most out of focus, in 250ths of the picture's height
  depth: 1.6, // how far from the focal plane that is
  back: "#0a1220",
  backEdge: "#020409",
  film: 0.025,
  vignette: 0.35,
  fov: 26,
  eyeHeight: -0.45,
  aim: -0.05,
  tall: 3.5, // of the pile, in view
  wide: 2.3,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio, duration }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  const tones = { aces: ACESFilmicToneMapping, agx: AgXToneMapping, neutral: NeutralToneMapping };
  const want = new URLSearchParams(location.search).get("tone") as keyof typeof tones | null;
  renderer.toneMapping = tones[want ?? (look.tone as keyof typeof tones)] ?? ACESFilmicToneMapping;
  await renderer.init();
  flattenSwizzles(renderer);

  const stage = await load("./spore.bin");
  const T = stage.head.T;

  // ---- what the light crosses: round the axis for the lamp, in a box for the light outside
  const inside = new Data3DTexture(stage.inside, ROUND.nr, ROUND.ny, ROUND.nt);
  inside.format = RedFormat;
  inside.wrapR = RepeatWrapping;
  const outside = new Data3DTexture(stage.outside, HALF.nx, HALF.ny, HALF.nz);
  outside.format = RGFormat;
  for (const t of [inside, outside]) {
    t.type = HalfFloatType;
    t.minFilter = t.magFilter = LinearFilter;
    t.needsUpdate = true;
  }
  const { U, stem, cap, lampAt } = createLook(inside, outside);

  // ---- the pile
  const scene = new Scene();
  const meshOf = (part: typeof stage.stem, material: typeof stem) => {
    const g = new BufferGeometry();
    const attrs = { position: new BufferAttribute(part.pos, 3), normal: new BufferAttribute(part.nor, 3), aux: new BufferAttribute(part.aux, 4) };
    for (const [name, a] of Object.entries(attrs)) {
      a.setUsage(DynamicDrawUsage);
      g.setAttribute(name, a);
    }
    g.setIndex(new BufferAttribute(part.index, 1));
    const mesh = new Mesh(g, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { g, attrs };
  };
  const stems = meshOf(stage.stem, stem);
  const caps = meshOf(stage.cap, cap);

  const back = uniform(new Color(look.back));
  const backEdge = uniform(new Color(look.backEdge));
  scene.backgroundNode = mix(back, backEdge, smoothstep(0.1, 0.95, length(screenUV.sub(vec2(0.5, 0.46)).mul(vec2(1.25, 1.5)))));

  // ---- the eye
  const camera = new PerspectiveCamera(look.fov, width / height, 0.5, 60);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  const frameUp = () => {
    const aspect = camera.aspect;
    const half = Math.max(look.tall / 2, look.wide / 2 / aspect);
    const dist = half / Math.tan((look.fov * Math.PI) / 360);
    camera.fov = look.fov;
    camera.position.set(0, look.eyeHeight, dist);
    controls.target.set(0, look.aim, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  // ---- after the picture: air round the lamp, a lens, glow, film
  const scenePass = pass(scene, camera, { samples: Number(new URLSearchParams(location.search).get("samples") ?? 4) });
  const colour = scenePass.getTextureNode();
  const depth = scenePass.getTextureNode("depth");
  const viewZ = scenePass.getViewZNode();
  const projInv = uniform(camera.projectionMatrixInverse);
  const camWorld = uniform(camera.matrixWorld);
  const eye = uniform(new Vector3());
  const tick = uniform(0);
  const air = uniform(look.air);
  const seen = getViewPosition(screenUV, depth, projInv);
  const far = length(seen);
  const ray = normalize(camWorld.mul(vec4(seen, 0)).xyz);
  // light scattered by the air on the way to what is seen: walked through the pile's cylinder, so the stems
  // between the lamp and a place leave their shadows in it
  const reach = float(ROUND.R * 0.94);
  const jitter = interleavedGradientNoise(screenCoordinate.xy.add(tick.mul(5.3)));
  const qa = dot(ray.xz, ray.xz).max(1e-5);
  const qb = dot(eye.xz, ray.xz);
  const disc = qb.mul(qb).sub(qa.mul(dot(eye.xz, eye.xz).sub(reach.mul(reach))));
  const root = disc.max(0).sqrt();
  const t0 = qb.negate().sub(root).div(qa).max(0);
  const t1 = qb.negate().add(root).div(qa).min(far);
  const span = t1.sub(t0).max(0).mul(disc.greaterThan(0).select(1, 0));
  const AIR = 20;
  const glow = vec3(0).toVar();
  Loop(AIR, ({ i }) => {
    const p = eye.add(ray.mul(t0.add(span.mul(float(i).add(jitter).div(AIR)))));
    glow.addAssign(lampAt(p, float(0)).E.mul(smoothstep(VOL.y0 + 0.1, VOL.y0 + 0.5, p.y)));
  });
  const aired = colour.rgb.add(glow.mul(span.div(AIR)).mul(air));
  const focus = uniform(8);
  const depthOfField = uniform(look.depth);
  const blur = uniform(look.blur);
  const sharp = lens(aired, viewZ, focus, depthOfField, blur);
  // spores, laid over the picture already through the lens: each is its own disc
  const motes = createMotes(stage.head, lampAt, depth);
  const moteScene = new Scene();
  moteScene.add(motes.sprite);
  const pour = createPour(stage, lampAt, depth);
  moteScene.add(pour.sprite);
  const motePass = pass(moteScene, camera);
  const withMotes = vec4(sharp.rgb.add(motePass.getTextureNode().rgb), 1);
  const bloomPass = bloom(withMotes, look.bloom, look.bloomRadius, look.bloomThreshold);
  const film = uniform(look.film);
  const vignette = uniform(look.vignette);
  const noise = hash(screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(3571)).add(tick.mul(7919)).toUint()).sub(0.5);
  const dark = float(1).sub(vignette.mul(smoothstep(0.35, 1.05, length(screenUV.sub(0.5).mul(vec2(1.1, 1.3))))));
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputNode = vec4(withMotes.rgb.add(bloomPass.rgb).mul(dark).mul(noise.mul(film).mul(4).add(1)), 1);

  const swatch = new Color();
  const tint = (v: Vector3, hex: string) => v.setFromColor(swatch.set(hex));
  const refresh = () => {
    renderer.toneMappingExposure = look.exposure;
    U.lamp.value = look.lamp;
    tint(U.lampColor.value, look.lampColor);
    U.lampA.value.set(0, look.lampLow, 0);
    U.lampB.value.set(0, look.lampHigh, 0);
    U.lampSize.value = look.lampSize;
    U.redden.value.set(3.2, 7.5, 15).multiplyScalar(look.redden);
    U.soft.value = look.soft;
    U.through.value = look.through;
    U.edge.value = look.edge;
    U.hollow.value = look.hollow;
    U.key.value = look.key;
    tint(U.keyColor.value, look.keyColor);
    const az = (look.keyAzimuth * Math.PI) / 180,
      el = (look.keyElevation * Math.PI) / 180;
    U.keyDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    U.shade.value = look.shade;
    U.rim.value = look.rim;
    tint(U.rimColor.value, look.rimColor);
    U.sky.value = look.sky;
    tint(U.skyColor.value, look.skyColor);
    tint(U.flesh.value, look.flesh);
    U.grain.value = look.grain;
    U.grainSize.value = look.grainSize;
    U.bumps.value = look.bumps;
    air.value = look.air;
    bloomPass.strength.value = look.bloom;
    bloomPass.radius.value = look.bloomRadius;
    bloomPass.threshold.value = look.bloomThreshold;
    blur.value = (look.blur * renderer.domElement.height) / 250;
    motes.U.blur.value = blur.value;
    motes.U.range.value = look.depth;
    motes.U.pixel.value = (2 * Math.tan((look.fov * Math.PI) / 360)) / renderer.domElement.height;
    motes.U.bright.value = look.spores;
    motes.U.size.value = look.sporeSize;
    pour.U.blur.value = blur.value;
    pour.U.range.value = look.depth;
    pour.U.pixel.value = motes.U.pixel.value;
    pour.U.bright.value = look.pour * 5;
    pour.U.size.value = look.pourSize;
    depthOfField.value = look.depth;
    back.value.set(look.back);
    backEdge.value.set(look.backEdge);
    film.value = look.film;
    vignette.value = look.vignette;
  };
  refresh();

  // ---- panel
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "spore" });
  gui.close();
  gui.add(look, "density", 0.15, 1, 0.01);
  gui.add(look, "flop", 0, 0.08, 0.001).name("cap flop");
  const fl = gui.addFolder("lamp inside");
  fl.add(look, "lamp", 0, 8, 0.05).onChange(refresh);
  fl.addColor(look, "lampColor").onChange(refresh);
  fl.add(look, "lampLow", -3, 1, 0.05).onChange(refresh);
  fl.add(look, "lampHigh", -3, 1.5, 0.05).onChange(refresh);
  fl.add(look, "lampSize", 0.05, 1, 0.01).onChange(refresh);
  fl.add(look, "redden", 0, 3, 0.01).onChange(refresh);
  fl.add(look, "soft", 0, 2, 0.01).onChange(refresh);
  fl.add(look, "through", 0, 6, 0.01).onChange(refresh);
  fl.add(look, "edge", 0, 3, 0.01).onChange(refresh);
  fl.add(look, "air", 0, 0.1, 0.001).onChange(refresh);
  fl.add(look, "spores", 0, 4, 0.01).onChange(refresh);
  fl.add(look, "sporeSize", 0.001, 0.02, 0.0005).onChange(refresh);
  const fq = gui.addFolder("spores pouring");
  fq.add(look, "pour", 0, 4, 0.01).name("bright").onChange(refresh);
  fq.add(look, "pourShare", 0, 1, 0.01).name("how many");
  fq.add(look, "pourSize", 0.0005, 0.006, 0.0001).name("size").onChange(refresh);
  fq.add(look, "pourFall", 0, 0.8, 0.01).name("fall");
  fq.add(look, "pourStray", 0, 0.3, 0.005).name("stray");
  const fo = gui.addFolder("light outside");
  fo.add(look, "key", 0, 5, 0.05).onChange(refresh);
  fo.addColor(look, "keyColor").onChange(refresh);
  fo.add(look, "keyAzimuth", -180, 180, 1).onChange(refresh);
  fo.add(look, "keyElevation", -30, 89, 1).onChange(refresh);
  fo.add(look, "shade", 0, 20, 0.1).onChange(refresh);
  fo.add(look, "rim", 0, 3, 0.01).onChange(refresh);
  fo.addColor(look, "rimColor").onChange(refresh);
  fo.add(look, "sky", 0, 1, 0.01).onChange(refresh);
  fo.add(look, "hollow", 0, 8, 0.01).onChange(refresh);
  fo.addColor(look, "skyColor").onChange(refresh);
  const fp = gui.addFolder("picture");
  fp.add(look, "exposure", 0.2, 3, 0.01).onChange(refresh);
  fp.addColor(look, "flesh").onChange(refresh);
  fp.add(look, "grain", 0, 3, 0.01).onChange(refresh);
  fp.add(look, "grainSize", 10, 200, 1).onChange(refresh);
  fp.add(look, "bumps", 0, 2, 0.01).onChange(refresh);
  fp.add(look, "bloom", 0, 2, 0.01).onChange(refresh);
  fp.add(look, "bloomRadius", 0, 1, 0.01).onChange(refresh);
  fp.add(look, "bloomThreshold", 0, 2, 0.01).onChange(refresh);
  fp.add(look, "focus", -1.5, 1.5, 0.01);
  fp.add(look, "depth", 0.1, 6, 0.01).onChange(refresh);
  fp.add(look, "blur", 0, 6, 0.01).onChange(refresh);
  fp.addColor(look, "back").onChange(refresh);
  fp.addColor(look, "backEdge").onChange(refresh);
  fp.add(look, "film", 0, 0.1, 0.001).onChange(refresh);
  fp.add(look, "vignette", 0, 1, 0.01).onChange(refresh);
  fp.add(look, "fov", 10, 60, 1).onChange(frameUp);

  const state = { hold: -1, frame: 0, pause: false, ms: 0 };
  Object.assign(window, { __spore: { look, state, refresh, frameUp, stage, pour, camera, controls, renderer, scene, U } });
  const frames = Math.round((duration / 1000) * 60);

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    const t0 = performance.now();
    stage.share = look.density;
    stage.flop = look.flop;
    stage.pose((ph % 1) * T);
    pour.tune.share = look.pour > 0 ? look.pourShare : 0;
    pour.U.fall.value = look.pourFall;
    pour.U.stray.value = look.pourStray;
    pour.update((ph % 1) * T);
    // only the part of each buffer in use goes to the GPU
    for (const [part, verts] of [
      [stems, stage.count * RINGS * (SIDES + 1)],
      [caps, stage.count * CAP_RINGS * (CAP_SIDES + 1)],
    ] as const)
      for (const a of Object.values(part.attrs)) {
        a.clearUpdateRanges();
        a.addUpdateRange(0, verts * a.itemSize);
        a.needsUpdate = true;
      }
    stems.g.setDrawRange(0, stage.count * (RINGS - 1) * SIDES * 6);
    caps.g.setDrawRange(0, stage.count * (CAP_RINGS - 1) * CAP_SIDES * 6);
    stage.light(look.lampLow, look.lampHigh, U.keyDir.value.toArray());
    inside.needsUpdate = outside.needsUpdate = true;
    state.ms += (performance.now() - t0 - state.ms) * 0.1;

    controls.update();
    camera.updateMatrixWorld();
    eye.value.copy(camera.position);
    focus.value = camera.position.distanceTo(controls.target) - look.focus;
    motes.U.phase.value = ph % 1;
    motes.U.focus.value = focus.value;
    motes.U.eye.value.copy(camera.position);
    camera.getWorldDirection(motes.U.ahead.value);
    pour.U.focus.value = focus.value;
    pour.U.eye.value.copy(camera.position);
    pour.U.ahead.value.copy(motes.U.ahead.value);
    tick.value = Math.round(ph * frames) % frames;
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
  duration: 12_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
