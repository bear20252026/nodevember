// The page. Weed that keeps growing up the picture's diagonal, and the eye going with it: day 4's composition, and the body is
// the seaweed of the shapes, in their light. The shoots and fronds are stems.ts; the sun through them is deep.ts;
// water, snow and lens are the zoom page's own. Everything is in the frame that travels with the growth, so the water goes by the other way.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { float, hash, length, pass, screenCoordinate, screenUV, smoothstep, uniform, vec2, vec4 } from "three/tsl";
import { ACESFilmicToneMapping, AgXToneMapping, Color, DoubleSide, FrontSide, Mesh, NeutralToneMapping, NodeMaterial, PerspectiveCamera, RenderPipeline, Scene, Vector3, WebGPURenderer } from "three/webgpu";
import { createDeepLight } from "./deep.ts";
import { createFish, drawnFish, loadFish } from "./fish.ts";
import { lens } from "./lens.ts";
import { createLook, solidKeeps } from "./look.ts";
import { createRocks } from "./rock.ts";
import { createSnow } from "./snow.ts";
import type { Mesh as Shape, Put } from "./stems.ts";
import { createStems } from "./stems.ts";
import { createWater } from "./water.ts";

const look = {
  exposure: 1,
  tone: "neutral",
  sun: 2.1,
  sunColor: "#fff6dc",
  sunAzimuth: 300, // 0 is from the eye's side, 180 straight behind the plant
  sunElevation: 50,
  sunSway: 20, // degrees the sun goes either side of that in a loop, so that its light moves through the kelp
  web: 0.85,
  webSize: 1.7,
  webDepth: 1.0,
  webBlur: 0.6,
  up: "#0e4f63",
  low: "#020d18",
  ambient: 1.9,
  takes: "#84a850", // the colour of sunlight after one blade
  thick: 1,
  glow: 1,
  rind: "#3e5a1a",
  stem: "#39441a",
  relief: 1,
  gloss: 0.35,
  aged: 0.5,
  apart: 0.03, // how thick the first layer of the sun map is
  haze: 0.1,
  clear: 1,
  top: 4.5,
  surface: 0.45,
  glare: 2.5,
  shafts: 0.3,
  shaftSize: 2.6,
  shaftBlur: 3,
  gap: 0.3,
  snow: 0.7,
  snowSize: 0.004,
  stipes: 300, // how many shoots
  leaves: 125, // fronds a loop on each
  leaf: 1, // how big a frond is
  surge: 1, // how unevenly the heads go on, part of the front by part: 0 abreast
  gust: 1, // and how unevenly the whole front does
  wide: 0.42, // the tube's radius
  lumps: 0.8, // how far from a plain tube it is
  bends: 1, // and how far its spine wanders
  cube: 0.55, // half the edge of the rounded cube the tube goes through, corner to corner; 0 for none
  cubeRound: 0.14, // the radius of its edges
  put: "suzanne", // what the tube goes through: none, cube, suzanne, both
  figure: 0.9, // how big the monkey is
  figureTurn: -30, // degrees she is turned from facing the eye
  blend: 0.3, // how softly she comes out of the tube
  stone: "#857a6a", // the rock those are, ahead of the front
  stoneDark: "#2c2a25",
  fish: 40, // how many fish
  fishKind: "both", // clown, butterfly, both, or drawn (the one that is only rings)
  fishShare: 0.7, // of both, how many are clowns
  fishSize: 1,
  fishColour: "#ffffff", // what their own colours are seen through
  fishWander: 1, // how far they stray from their places
  fishHurry: 1, // how quick they are to a rock and home from it
  fishSheen: 1, // the film of colours on the silvery parts of them
  fishShine: 0.09, // a little light of their own, to be found by in the shade
  fishGain: 1.2, // how much of the sun they give back: they are the bright things in the picture
  ripe: 0.7, // how long a frond takes to grow
  smooth: 0.8, // how far a frond of the skin is lit as the skin
  breathe: 0.5, // how far the skin's fronds lift as the water's push passes
  comb: 0.55, // how far they are combed downstream
  sway: 1,
  flutter: 1,
  bladeLength: 1,
  bladeWidth: 1,
  cup: 0.45,
  focus: 0,
  blur: 1.0,
  depth: 2.2,
  bloom: 0.18,
  bloomRadius: 0.5,
  bloomThreshold: 0.9,
  film: 0.02,
  vignette: 0.4,
  fov: 38,
  far: 5, // eye to what it looks at
  back: 0.25, // how far behind the heads that is, down the bundle: it puts the heads up the diagonal
  swing: 6, // degrees the eye goes either side in a loop
  // two ways to be quicker: fewer pixels (of the screen's own), and the sun map made on every other frame, so that
  // shadows are a frame late. Neither when a moment is held (the tools) or ssam is recording: then it is all there
  resolution: 0.8,
  sunHalf: true,
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

  // ---- the kelp. ?stems={"count":17,"seed":4} for any of stems.ts' numbers
  const stems = createStems(JSON.parse(query.get("stems") ?? "{}"));
  look.stipes = stems.options.count;
  look.leaves = stems.options.perLoop;
  look.wide = stems.options.wide;
  look.lumps = stems.options.lumps;
  look.bends = stems.options.bends;
  look.cube = stems.options.cube;
  look.cubeRound = stems.options.cubeRound;
  // ?put=suzanne (or none, cube, both) for what the tube goes through
  look.put = query.get("put") ?? look.put;
  const monkey: Shape = await (await fetch("./suzanne.json")).json();
  // and those things themselves, as rock: ahead of the front bare, behind it inside the weed
  const rocks = createRocks(stems, monkey);
  rocks.update(stems.things);
  const light = createDeepLight(
    [
      ...stems.blade.shadows.map((geometry) => ({ geometry, keeps: stems.blade.keeps, side: DoubleSide, position: stems.blade.position(false) })),
      { geometry: stems.stipe.geometry, keeps: solidKeeps(float(0)), side: FrontSide, position: stems.stipe.position(false) },
    ],
    Number(query.get("sun") ?? 2048),
    3.6,
    6,
    rocks.solids,
  );
  const shade = createLook(light);

  const scene = new Scene();
  const put = (geometry: Mesh["geometry"], material: NodeMaterial) => {
    const mesh = new Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
  };
  const bladeMaterial = new NodeMaterial();
  bladeMaterial.side = DoubleSide;
  bladeMaterial.positionNode = stems.blade.position(true);
  bladeMaterial.fragmentNode = shade.bladeLit(stems.blade.drawn, stems.blade.normal);
  for (const geometry of stems.blade.geometries) put(geometry, bladeMaterial);
  const stipeMaterial = new NodeMaterial();
  stipeMaterial.positionNode = stems.stipe.position(true);
  stipeMaterial.fragmentNode = shade.solidLit(stems.stipe.drawn, stems.stipe.normal);
  put(stems.stipe.geometry, stipeMaterial);
  for (const rock of rocks.dress(light, shade)) put(rock.geometry, rock.material);
  // and fish, which live in the weed's shade and go out to the rock
  // ?fish=clown (or butterfly, both, drawn). The two that are models are from Sketchfab, CC-BY: see the README
  look.fishKind = query.get("fish") ?? look.fishKind;
  const fish = createFish(stems, light, shade, [await loadFish("./clownfish.glb", Math.PI / 2, undefined, { pace: 0.5, kick: [2, 4] }), await loadFish("./butterflyfish.glb", 0, "./butterflyfish.png", { size: 1.25, stiff: 3, beat: 0.4, pace: 0.6, kick: [2, 3], pale: 0.68 }), drawnFish()]);
  for (const kind of fish.kinds) put(kind.geometry, kind.material);

  // ---- the eye: square on to the bundle, which runs up its diagonal, the heads above and to the right of the middle
  const camera = new PerspectiveCamera(look.fov, width / height, 0.05, 120);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  const aim = new Vector3();
  let swung = 0;
  const frameUp = () => {
    const aspect = camera.aspect;
    const half = Math.tan((look.fov * Math.PI) / 360) * Math.max(1, 0.85 / aspect);
    camera.fov = (Math.atan(half) * 360) / Math.PI;
    aim.copy(stems.axis).multiplyScalar(-look.back);
    // the sun map is about what is seen: most of that is behind the heads
    light.U.centre.value.copy(stems.axis).multiplyScalar(-look.back - 0.4);
    camera.position.set(0.1, -0.32, 1).normalize().multiplyScalar(look.far).add(aim);
    controls.target.copy(aim);
    camera.updateProjectionMatrix();
    controls.update();
    swung = 0;
  };
  frameUp();

  // ---- the water, then glow and film
  const scenePass = pass(scene, camera, { samples: Number(query.get("samples") ?? 4) });
  const tick = uniform(0);
  const water = createWater(light, shade, scenePass.getTextureNode(), scenePass.getTextureNode("depth"), camera, tick, { steps: Number(query.get("steps") ?? 16), scale: Number(query.get("shaft") ?? 0.34) });
  const focus = uniform(3);
  const depthOfField = uniform(look.depth);
  const blur = uniform(look.blur);
  const sharp = lens(water.node.rgb, scenePass.getViewZNode(), focus, depthOfField, blur, Number(query.get("taps") ?? 18));
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
  // ?only= stops the picture at a stage, to time what each costs: scene (the kelp alone), water (with the water and
  // its shafts), lens (with the blur), snow (with the specks); nothing after it is drawn
  const stages = { scene: scenePass.getTextureNode(), water: water.node, lens: vec4(sharp.rgb, 1), snow: picture };
  pipeline.outputNode = stages[query.get("only") as keyof typeof stages] ?? vec4(picture.rgb.add(bloomPass.rgb).mul(dark).mul(noise.mul(film).mul(4).add(1)), 1);

  const swatch = new Color();
  const tint = (v: Vector3, hex: string) => v.setFromColor(swatch.set(hex));
  let lastPhase = 0;
  const sunAt = (ph: number) => {
    lastPhase = ph;
    const az = ((look.sunAzimuth + look.sunSway * Math.sin(ph * Math.PI * 2)) * Math.PI) / 180,
      el = (look.sunElevation * Math.PI) / 180;
    light.U.dir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    // The eye goes with the growth, so the sun's web, which stays where it is in the water, goes back past it at
    // the speed of the growth. The web's tile is laid along the body (as the sun sees it), so that all of that
    // is along one side of the tile, and `refresh` fits the tile to it
    light.aim(stems.axis);
    light.U.drift.value.copy(stems.axis).multiplyScalar(stems.options.pitch * ph);
  };
  const sun0 = new Vector3(),
    eyeWay = new Vector3();
  const refresh = () => {
    // where the sun is as the loop begins
    const az0 = (look.sunAzimuth * Math.PI) / 180,
      el0 = (look.sunElevation * Math.PI) / 180;
    renderer.toneMappingExposure = look.exposure;
    shade.U.sun.value = look.sun;
    tint(shade.U.sunColor.value, look.sunColor);
    sunAt(lastPhase);
    light.U.web.value = look.web;
    // a loop's travel is a whole number of tiles, or the web would jump where the loop closes: the nearest size that does
    const travel = stems.options.pitch * Math.sqrt(1 - sun0.set(Math.sin(az0) * Math.cos(el0), Math.sin(el0), Math.cos(az0) * Math.cos(el0)).dot(stems.axis) ** 2);
    const tiles = Math.max(1, Math.round(travel / look.webSize));
    light.U.webSize.value = travel / tiles;
    light.U.deep.value = look.webDepth;
    light.setLayers(look.apart, 3);
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
    // what gets round into the deepest shade has come through kelp: a dark green
    tint(shade.U.around.value, look.takes).multiplyScalar(0.11);
    shade.U.relief.value = look.relief;
    shade.U.gloss.value = look.gloss;
    shade.U.aged.value = look.aged;
    water.U.haze.value = look.haze;
    water.U.takes.value.set(0.2, 0.07, 0.05).divideScalar(look.clear);
    water.U.top.value = look.top;
    water.U.surface.value = look.surface;
    water.U.glare.value = look.glare;
    water.U.shafts.value = look.shafts;
    // the shafts read the same web bigger, and a loop's travel is to be a whole number of those tiles too
    water.U.shaftSize.value = tiles / Math.max(1, Math.round(tiles / look.shaftSize));
    water.U.shaftBlur.value = look.shaftBlur;
    water.U.gap.value = look.gap;
    stems.show(look.stipes, look.leaves);
    stems.pace(look.surge, look.gust);
    const put: Put = look.put === "suzanne" ? "figure" : (look.put as Put);
    if (stems.reshape({ wide: look.wide, lumps: look.lumps, bends: look.bends, cube: look.cube, cubeRound: look.cubeRound, put, figure: look.figure, figureTurn: look.figureTurn, blend: look.blend, mesh: monkey })) rocks.update(stems.things);
    fish.about(rocks.there);
    const clowns = look.fishKind === "both" ? Math.round(look.fish * look.fishShare) : look.fish;
    fish.show(look.fishKind === "drawn" ? [0, 0, look.fish] : look.fishKind === "clown" ? [look.fish, 0] : look.fishKind === "butterfly" ? [0, look.fish] : [clowns, look.fish - clowns]);
    fish.U.hurry.value = look.fishHurry;
    fish.U.sheen.value = look.fishSheen;
    fish.U.size.value = look.fishSize;
    fish.U.wander.value = look.fishWander;
    fish.U.shine.value = look.fishShine;
    fish.U.gain.value = look.fishGain;
    tint(fish.U.colour.value, look.fishColour);
    fish.face(sun0, eyeWay.copy(camera.position).sub(controls.target));
    tint(rocks.colour.stone.value, look.stone);
    tint(rocks.colour.dark.value, look.stoneDark);
    stems.U.ripe.value = look.ripe;
    stems.U.smooth.value = look.smooth;
    stems.U.breathe.value = look.breathe;
    stems.U.stream.value = look.comb;
    stems.U.sway.value = look.sway;
    stems.U.flutter.value = look.flutter;
    stems.U.bladeLength.value = look.bladeLength * look.leaf;
    stems.U.bladeWidth.value = look.bladeWidth * look.leaf;
    stems.U.cup.value = look.cup;
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
    snow.U.flow.value = -1; // the eye goes up and to the right with the growth, so the water's specks go back past it
    snow.U.top.value = 1.6;
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
  const gui = new GUI({ title: "kelp tangle" });
  const fd = gui.addFolder("density");
  fd.add(look, "stipes", 1, stems.options.most, 1).name("shoots").onChange(refresh);
  fd.add(look, "leaves", 0, stems.options.mostPerLoop, 1).name("fronds a loop").onChange(refresh);
  fd.add(look, "leaf", 0.3, 3, 0.01).name("frond size").onChange(refresh);
  const fg = gui.addFolder("growth");
  fg.add(look, "surge", 0, 1.1, 0.01).name("surge (parts of the front)").onChange(refresh);
  fg.add(look, "gust", 0, 1.2, 0.01).name("gust (whole front)").onChange(refresh);
  fg.add(look, "ripe", 0.2, 4, 0.01).name("frond ripens in").onChange(refresh);
  const fc = gui.addFolder("in the tube");
  fc.add(look, "put", ["none", "cube", "suzanne", "both"]).name("what").onChange(refresh);
  fc.add(look, "cube", 0, 0.8, 0.01).name("cube size").onFinishChange(refresh);
  fc.add(look, "cubeRound", 0.02, 0.4, 0.01).name("cube round").onFinishChange(refresh);
  fc.add(look, "figure", 0.3, 1, 0.01).name("monkey size").onFinishChange(refresh);
  fc.add(look, "figureTurn", -180, 180, 1).name("monkey turned").onFinishChange(refresh);
  fc.add(look, "blend", 0, 0.6, 0.01).name("monkey blends in").onFinishChange(refresh);
  fc.addColor(look, "stone").onChange(refresh);
  fc.addColor(look, "stoneDark").name("stone, dark").onChange(refresh);
  const ff = gui.addFolder("fish");
  ff.add(look, "fish", 0, fish.most, 1).name("how many").onChange(refresh);
  ff.add(look, "fishKind", ["clown", "butterfly", "both", "drawn"]).name("which").onChange(refresh);
  ff.add(look, "fishShare", 0, 1, 0.01).name("of both, clowns").onChange(refresh);
  ff.add(look, "fishSize", 0.3, 3, 0.01).name("size").onChange(refresh);
  ff.add(look, "fishHurry", 0.5, 2.5, 0.01).name("hurry to the rock").onChange(refresh);
  ff.add(look, "fishWander", 0, 2, 0.01).name("wander").onChange(refresh);
  ff.add(look, "fishGain", 0.5, 3, 0.01).name("bright in the sun").onChange(refresh);
  ff.add(look, "fishShine", 0, 0.5, 0.005).name("own light").onChange(refresh);
  ff.add(look, "fishSheen", 0, 2.5, 0.01).name("sheen").onChange(refresh);
  ff.addColor(look, "fishColour").name("seen through").onChange(refresh);
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
  const fb = gui.addFolder("kelp");
  fb.add(look, "wide", 0.2, 1.2, 0.01).onFinishChange(refresh);
  fb.add(look, "lumps", 0, 1.5, 0.01).onFinishChange(refresh);
  fb.add(look, "bends", 0, 3, 0.01).onFinishChange(refresh);
  fb.add(look, "smooth", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "breathe", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "comb", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "sway", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "flutter", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "bladeLength", 0.3, 2.5, 0.01).onChange(refresh);
  fb.add(look, "bladeWidth", 0.3, 2.5, 0.01).onChange(refresh);
  fb.add(look, "cup", 0.05, 2, 0.01).onChange(refresh);
  fb.addColor(look, "takes").name("through one").onChange(refresh);
  fb.add(look, "thick", 0, 3, 0.01).onChange(refresh);
  fb.add(look, "glow", 0, 3, 0.01).onChange(refresh);
  fb.addColor(look, "rind").onChange(refresh);
  fb.addColor(look, "stem").onChange(refresh);
  fb.add(look, "aged", 0, 1.5, 0.01).onChange(refresh);
  fb.add(look, "relief", 0, 4, 0.01).onChange(refresh);
  fb.add(look, "gloss", 0, 2, 0.01).onChange(refresh);
  fb.add(look, "apart", 0.005, 0.2, 0.001).onChange(refresh);
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
  fw.add(look, "gap", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "snow", 0, 5, 0.01).onChange(refresh);
  fw.add(look, "snowSize", 0.001, 0.02, 0.0005).onChange(refresh);
  const fp = gui.addFolder("picture");
  fp.add(look, "resolution", 0.4, 1, 0.05).name("resolution (under 1 is quicker)");
  fp.add(look, "sunHalf").name("sun map every other frame (quicker)");
  for (const folder of [fs, fb, fw, fp]) folder.close();
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
  fp.add(look, "far", 2, 10, 0.05).onChange(frameUp);
  fp.add(look, "back", 0, 4, 0.05).onChange(frameUp);
  fp.add(look, "swing", 0, 45, 1);

  const state = { hold: -1, frame: 0, pause: false, still: false, skipLight: false };
  Object.assign(window, { __kelp: { look, state, refresh, frameUp, stems, rocks, fish, light, camera, controls, renderer, scene } });
  const frames = Math.round((duration / 1000) * 60);
  const loader = document.getElementById("loader");
  const up = new Vector3(0, 1, 0);
  const sharpAt = new Vector3();

  wrap.render = ({ playhead, recording }) => {
    if (state.pause) return;
    const ph = (state.hold >= 0 ? state.hold : playhead) % 1;
    sunAt(ph);
    stems.U.phase.value = ph;

    // the swing is added to wherever the hand has put the eye
    const swing = ((look.swing * Math.PI) / 180) * Math.sin(ph * Math.PI * 2);
    camera.position.sub(controls.target).applyAxisAngle(up, swing - swung).add(controls.target);
    swung = swing;
    controls.update();
    camera.updateMatrixWorld();

    water.U.eye.value.copy(camera.position);
    // sharp a little behind the heads, where the blades have opened
    focus.value = camera.position.distanceTo(sharpAt.copy(stems.axis).multiplyScalar(-0.7)) - look.focus;
    snow.U.phase.value = ph;
    snow.U.focus.value = focus.value;
    snow.U.eye.value.copy(camera.position);
    camera.getWorldDirection(snow.U.ahead.value);
    tick.value = state.still ? 0 : Math.round(ph * frames) % frames;
    const whole = recording || state.hold >= 0;
    const sharpness = pixelRatio * (whole ? 1 : look.resolution);
    if (renderer.getPixelRatio() !== sharpness) renderer.setPixelRatio(sharpness);
    if (!state.skipLight && (!look.sunHalf || whole || state.frame % 2 === 0)) light.render(renderer, ph);
    pipeline.render();
    stats.update();
    state.frame++;
    // the loader goes when a picture is on the screen, not when it has been asked for: the first one has every
    // shader to build, and the frames come back from here long before the card has drawn them. Four, so that the
    // sun map (every other frame) is in it
    if (state.frame === 4 && loader && !loader.classList.contains("done")) {
      const device = (renderer.backend as unknown as { device?: GPUDevice }).device;
      (device ? device.queue.onSubmittedWorkDone() : Promise.resolve()).then(() => loader.classList.add("done"));
    }
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
