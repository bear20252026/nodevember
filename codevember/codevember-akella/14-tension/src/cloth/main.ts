// Cloth: a sheet hung in the air from cables, and things nobody sees coming up from below, pressing,
// dragging and going. Only the cloth shows them. Light comes through it where it is one layer thick,
// less and redder where it folds over itself. See sim.ts / cloth.wgsl for the cloth, show.ts for the
// shapes and their paths.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import * as TSL from "three/tsl";
import {
  AgXToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  FloatType,
  Matrix4,
  Mesh,
  MeshBasicNodeMaterial,
  MOUSE,
  NearestFilter,
  OrthographicCamera,
  PerspectiveCamera,
  Raycaster,
  RenderPipeline,
  RenderTarget,
  RGBAFormat,
  Scene,
  StorageTexture,
  TOUCH,
  Vector2,
  Vector3,
  Vector4,
  WebGPURenderer,
} from "three/webgpu";
import { BEAT, makePins, PERIOD, pushersAt, restY, setWaltzEdits, SHOW, sync, waltzNotes, type NoteEdits } from "./show.ts";
import { Touch } from "./touch.ts";
import { Music, Recording } from "./music.ts";
import { ClothSim, physics, type Face } from "./sim.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const {
  abs,
  attribute,
  cameraPosition,
  clamp,
  cos,
  cross,
  dot,
  exp,
  faceDirection,
  float,
  Fn,
  hash,
  If,
  Discard,
  int,
  ivec2,
  length,
  log2,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  normalize,
  pass,
  pow,
  screenCoordinate,
  screenUV,
  select,
  sin,
  smoothstep,
  sqrt,
  step,
  texture,
  textureLoad,
  uniform,
  uniformArray,
  varying,
  vec2,
  vec3,
  vec4,
} = T;

const query = new URLSearchParams(location.search);
// live: a sheet the GPU runs in a few ms. Recording keeps to the playhead however slow, so a take can
// afford more: ?n=512&sub=32
const N = Number(query.get("n") ?? 320);
if (query.has("sub")) physics.substeps = Number(query.get("sub"));

// Two lights, each with its own view and two depth layers. The key lights the face we see; the back
// second shines up through it from underneath. Two looks (earlier ones, a low sun behind the sheet and a
// plain spot from above, are in the history): `c`, seen from above at an angle, a spot falling off into
// black, light from below coming through (white through one layer, red where it lies doubled), graded;
// and `d`, iridescent.
const presets = {
  // c: graded: an off-centre spot sweeps the sheet from a hot far corner to the near edge, and
  // the tones run through a ramp on the way, cream, coral, wine, plum; the light from below is rose
  c: {
    cloth: "#f1ece6",
    through: "#f7e0d2",
    deep: "#c8483e",
    transmit: 0.5,
    wrap: 0.25,
    sheen: 0.8,
    forward: 1.0,
    key: 1.7,
    keyColor: "#fff1e0",
    keyUp: 30,
    keyTurn: 170,
    keySpot: 1.0,
    keySpotR: 0.7,
    keySpotX: -0.3,
    keySpotY: -0.4,
    back: 0.6,
    backColor: "#ff8c7a",
    backUp: -50,
    backTurn: 300,
    backSpot: 0.6,
    backSpotR: 1.0,
    sky: "#4a5470",
    skyLight: 0.03,
    hollow: 9,
    offset: 3,
    fade: 0.02,
    soft: 40,
    cable: "#0b0b0c",
    background: "#08090a",
    clouds: 0.08,
    bloom: 0.2,
    vignette: 1.0,
    grain: 0.03,
    exposure: 1.0,
    fov: 30,
    camUp: 33.9,
    camTurn: 44.8,
    dist: 4.0,
    camX: 0.213, // where it looks
    camY: -0.184,
    camZ: 0.008,
    debug: 0,
    grade: 0.75,
    ink: "#140a1c",
    low: "#5a1a34",
    mid: "#d8735e",
    high: "#fff2dc",
    white: 1.25,
    stops: 4.5,
    contrast: 1.6,
    iri: 0, // the nap's look: 0 plain cloth, 1 all hairs
    tipColor: "#2a1650", // looking down the hairs, into the pile
    sideColor: "#3fd0c0", // seeing them side on
    rainbow: 0.5, // how far the hue runs on round the wheel with the angle
    bands: 1.2, // turns of the wheel from side on to down the hairs
    hue: 0.0,
    tilt: 1.2, // how far the hairs lean
    fibre: 0.8, // their glint
    fibreSharp: 40,
  },
  // d: the nap: a pile whose hairs all lean one way, shot through with colour that turns as the sheet turns
  d: {
    cloth: "#f1ece6",
    through: "#e8dcf0", // the colour of what one layer lets through
    deep: "#8a3c9a", // and of light that came through other layers first
    transmit: 0.5, // and how much: cotton sends back about half and lets through a little less
    wrap: 0.3,
    sheen: 0.25,
    forward: 1.0, // light through the cloth, brighter looking towards the light
    key: 2.2,
    keyColor: "#fff6ee",
    keyUp: 26,
    keyTurn: 170,
    keySpot: 0.7, // how far a spot: 0 even everywhere, 1 to black outside its circle
    keySpotR: 1.0, // m
    keySpotX: -0.1,
    keySpotY: 0.1,
    back: 0.35,
    backColor: "#ffe9dc",
    backUp: -50,
    backTurn: 300,
    backSpot: 0.4,
    backSpotR: 1.1,
    sky: "#5a6270",
    skyLight: 0.05,
    hollow: 8,
    offset: 3, // texels off the sheet, lightwards, for the layer lookups
    fade: 0.02, // m: a layer in front counts in full this far in front
    soft: 40, // texels of penumbra per metre behind the layer in front
    cable: "#a39fb8", // pale, lilac grey: on the dark it reads as a thread of light
    background: "#08090a",
    clouds: 0.09,
    bloom: 0.25,
    vignette: 1.0,
    grain: 0.03,
    exposure: 1.0,
    fov: 30,
    camUp: 33.9,
    camTurn: 44.8,
    dist: 4.0,
    camX: 0.213, // where it looks
    camY: -0.184,
    camZ: 0.008,
    debug: 0, // 1 layers before the key, 2 hollows, 3 key N.L, 4 layers before the back light
    grade: 0, // how far the cloth's tones are mapped onto the ramp below
    ink: "#120a10", // the darkest, `stops` below white
    low: "#6a1d2a",
    mid: "#e08a6a",
    high: "#fff4e8", // at white
    white: 1.0, // the brightness counted as white
    stops: 6, // how many stops down from white to the ink
    contrast: 1.0, // an S through the ramp
    iri: 1, // the nap's look: 0 plain cloth, 1 all hairs
    tipColor: "#3a1f7a", // looking down the hairs, into the pile
    sideColor: "#2aa89a", // seeing them side on
    rainbow: 0.45, // how far the hue runs on round the wheel with the angle
    bands: 2.0, // turns of the wheel from side on to down the hairs
    hue: 0.0,
    tilt: 0.8, // how far the hairs lean
    fibre: 0.45, // their glint
    fibreSharp: 40,
  },
};
type Look = typeof presets.c;
const lookName = (query.get("look") ?? "c") as keyof typeof presets;
export const look: Look = { ...(presets[lookName] ?? presets.c) };

function flattenSwizzles(renderer: WebGPURenderer) {
  const { device } = renderer.backend as unknown as { device?: GPUDevice };
  if (!device) return;
  const create = device.createShaderModule.bind(device);
  const flat = (_: string, first: string, second: string) => `.${first["xyzw".indexOf(second)]}`;
  device.createShaderModule = (d) => create({ ...d, code: d.code.replace(/\.([xyzw]{2,4})\.([xyzw])\b/g, flat) });
}

const storageTexture = (n: number) => {
  const t = new StorageTexture(n, n);
  t.format = RGBAFormat;
  t.type = FloatType;
  t.minFilter = t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const renderer = new WebGPURenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(pixelRatio, Number(query.get("dpr") ?? 1.5)));
  renderer.setSize(width, height);
  renderer.toneMapping = AgXToneMapping;
  await renderer.init();
  flattenSwizzles(renderer);
  const backend = renderer.backend as unknown as { device?: GPUDevice; get(t: unknown): { texture: GPUTexture } };
  if (!backend.device) throw new Error("the cloth needs WebGPU");

  // ---- the sim
  const posTex = storageTexture(N);
  const norTex = storageTexture(N);
  const napTex = storageTexture(N);
  renderer.initTexture(posTex);
  renderer.initTexture(norTex);
  renderer.initTexture(napTex);
  const pins = makePins(N);
  const faceMeta = await (await fetch("face.json")).json();
  const face: Face = { ...faceMeta, data: new Uint16Array(await (await fetch("face.sdf")).arrayBuffer()) };
  const sim = new ClothSim(backend.device, N, pins, backend.get(posTex).texture, backend.get(norTex).texture, backend.get(napTex).texture, face);
  const DT = 1 / 60;
  const state = { t: 0, f: 0, frame: 0, pause: false, ms: 0, warm: 3, feed: 0, feedFor: 1.5 };
  const F = Math.round(PERIOD / DT);
  const settle = (seconds: number) => {
    for (let k = 0; k < seconds * 60; k++) sim.advance(DT, pushersAt(0), false);
  };
  settle(state.warm);

  // ---- uniforms
  const U = {
    cloth: uniform(new Color()),
    through: uniform(new Color()),
    deep: uniform(new Color()),
    transmit: uniform(1),
    sheen: uniform(1),
    sky: uniform(new Color()),
    skyLight: uniform(1),
    hollow: uniform(1),
    cable: uniform(new Color()),
    bg: uniform(new Color()),
    clouds: uniform(0),
    vignette: uniform(0),
    grain: uniform(0),
    frame: uniform(0),
    debug: uniform(0, "int"),
    offset: uniform(0),
    fade: uniform(0),
    soft: uniform(0),
    wrap: uniform(0),
    forward: uniform(0),
    grade: uniform(0),
    ink: uniform(new Color()),
    low: uniform(new Color()),
    mid: uniform(new Color()),
    high: uniform(new Color()),
    white: uniform(1),
    stops: uniform(6),
    contrast: uniform(1),
    iri: uniform(0),
    tipColor: uniform(new Color()),
    sideColor: uniform(new Color()),
    rainbow: uniform(0),
    bands: uniform(1),
    hue: uniform(0),
    tilt: uniform(1),
    fibre: uniform(0),
    fibreSharp: uniform(40),
  };

  // ---- the sheet as a mesh whose vertices read the sim's textures
  const geometry = new BufferGeometry();
  const cell = new Float32Array(N * N * 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cell.set([x, y], (y * N + x) * 2);
  const index = new Uint32Array((N - 1) * (N - 1) * 6);
  let o = 0;
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N - 1; x++) {
      const a = y * N + x;
      // alternate the diagonals, so the triangles don't lean one way
      if ((x + y) % 2) index.set([a, a + N, a + 1, a + 1, a + N, a + N + 1], o);
      else index.set([a, a + N, a + N + 1, a, a + N + 1, a + 1], o);
      o += 6;
    }
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(N * N * 3), 3));
  geometry.setAttribute("cell", new BufferAttribute(cell, 2));
  geometry.setIndex(new BufferAttribute(index, 1));

  const cellOf = () => ivec2(attribute("cell", "vec2"));
  const clothPos = Fn(() => textureLoad(posTex, cellOf()).xyz);
  const clothNor = Fn(() => textureLoad(norTex, cellOf()));
  const clothNap = Fn(() => textureLoad(napTex, cellOf()));

  // ---- lights: each sees the sheet in two depth layers, the nearest surface and the next one behind it
  const SHADOW = 2048;
  const HALF = 1.75; // a light's view, just round the sheet: every texel counts at a low light
  const TEXEL = (2 * HALF) / SHADOW; // m
  const layerTarget = () => {
    const rt = new RenderTarget(SHADOW, SHADOW, { type: FloatType, format: RGBAFormat, depthBuffer: true });
    rt.texture.minFilter = rt.texture.magFilter = NearestFilter;
    rt.texture.generateMipmaps = false;
    return rt;
  };
  const makeLight = () => {
    const L = {
      dir: uniform(new Vector3(0, 1, 0)),
      view: uniform(new Matrix4()),
      vp: uniform(new Matrix4()),
      near: uniform(0.1),
      far: uniform(12),
      color: uniform(new Color()), // colour x intensity
      spot: uniform(0),
      spotAt: uniform(new Vector2()), // m, in the light's view
      spotR: uniform(1),
    };
    const cam = new OrthographicCamera(-HALF, HALF, HALF, -HALF, 0.1, 12);
    const layer1 = layerTarget();
    const layer2 = layerTarget();
    const depthOf = (p: unknown) => {
      const lv = L.view.mul(vec4(p, 1));
      return lv.z.negate().sub(L.near).div(L.far.sub(L.near));
    };
    const depthMaterial = (peel: boolean) => {
      const m = new MeshBasicNodeMaterial({ side: DoubleSide });
      m.toneMapped = false;
      const wp = varying(clothPos(), "vLightPos");
      m.positionNode = clothPos();
      m.colorNode = Fn(() => {
        const d = depthOf(wp);
        if (peel) {
          const first = textureLoad(layer1.texture, ivec2(screenCoordinate.xy)).x;
          If(d.lessThanEqual(first.add(float(0.003).div(L.far.sub(L.near)))), () => {
            Discard();
          });
        }
        return vec4(d, 0, 0, 1);
      })();
      return m;
    };
    const scene1 = new Scene();
    const scene2 = new Scene();
    const m1 = new Mesh(geometry, depthMaterial(false));
    const m2 = new Mesh(geometry, depthMaterial(true));
    m1.frustumCulled = m2.frustumCulled = false;
    scene1.add(m1);
    scene2.add(m2);
    let on = true;

    const aim = (up: number, turn: number, intensity: number, color: string, spot: number, spotR: number, spotX = 0, spotY = 0) => {
      const e = (up * Math.PI) / 180;
      const a = (turn * Math.PI) / 180;
      L.dir.value.set(Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)).normalize();
      cam.position.copy(L.dir.value).multiplyScalar(6);
      cam.up.set(0, 1, 0);
      if (Math.abs(L.dir.value.y) > 0.99) cam.up.set(0, 0, 1);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      cam.updateProjectionMatrix();
      L.view.value.copy(cam.matrixWorldInverse);
      L.vp.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      L.near.value = cam.near;
      L.far.value = cam.far;
      L.color.value.set(color).multiplyScalar(intensity);
      L.spot.value = spot;
      L.spotR.value = spotR;
      // the spot's centre given on the sheet (x, z), seen from the light
      const at = new Vector3(spotX, 0, spotY).applyMatrix4(cam.matrixWorldInverse);
      L.spotAt.value.set(at.x, at.y);
      on = intensity > 0;
    };
    const render = () => {
      if (!on) return;
      renderer.setRenderTarget(layer1);
      renderer.clear();
      renderer.render(scene1, cam);
      renderer.setRenderTarget(layer2);
      renderer.clear();
      renderer.render(scene2, cam);
    };

    // what this light gives a point p of the cloth, with n its normal on our side and n0 the sheet's own
    const shade = (p: any, n0: any, n: any, V: any) => {
      const Ld = L.dir;
      const ndl = dot(n, Ld);
      // looked up from a little off the sheet, on its lit side: a low light grazing the cloth otherwise
      // finds it in front of itself, in stripes along every ripple
      const nL = n0.mul(select(dot(n0, Ld).greaterThan(0), float(1), float(-1)));
      const graze = sqrt(max(float(1).sub(dot(n0, Ld).pow(2)), 0));
      const ps = p.add(nL.mul(float(TEXEL).mul(U.offset).mul(graze.add(0.25))));
      const lc = L.vp.mul(vec4(ps, 1));
      const uv = vec2(lc.x.mul(0.5).add(0.5), lc.y.mul(-0.5).add(0.5));
      const depth = depthOf(ps);
      const range = L.far.sub(L.near);
      const tan = sqrt(max(float(1).sub(ndl.mul(ndl)), 0)).div(max(abs(ndl), 0.2));
      const eps = float(0.004)
        .add(float(TEXEL * 2.5).mul(tan))
        .div(range);
      const occ = float(0).toVar();
      // a soft edge, wider the further the layer in front is: the light has a size and cloth scatters
      const gap = max(depth.sub(texture(layer1.texture, uv).x), 0).mul(range);
      const radius = clamp(gap.mul(U.soft).add(1.5), 1.5, 14);
      const spin = hash(screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(2311))).mul(6.2832);
      const epsR = eps.add(float(TEXEL).mul(radius).mul(tan).div(range));
      const fade = U.fade.div(range);
      const TAPS = 10;
      for (let k = 0; k < TAPS; k++) {
        // a Vogel disc, turned differently at each pixel
        const rr = Math.sqrt((k + 0.5) / TAPS);
        const ang = spin.add(k * 2.39996);
        const q = uv.add(vec2(cos(ang), sin(ang)).mul(radius.mul(rr / SHADOW)));
        const d1 = texture(layer1.texture, q).x;
        const d2 = texture(layer2.texture, q).x;
        // a layer counts in full only some way in front: touching layers fade in, not flicker
        occ.addAssign(smoothstep(0, fade, depth.sub(d1).sub(epsR)).add(smoothstep(0, fade, depth.sub(d2).sub(epsR))));
      }
      occ.divAssign(TAPS);
      // one layer sends back `cloth` and lets through `through` x `transmit`, the same for light reaching
      // a fold behind it as for light we see through it; the red goes furthest
      const Tr = U.through.mul(U.transmit);
      // light that has come through layers on the way travels further in cloth: it reddens faster
      const passed = pow(U.deep.mul(U.transmit), vec3(occ));
      // both sides soft at the terminator (light scatters inside the weave), so a fold has no dark seam
      const lit = clamp(ndl.add(U.wrap).div(U.wrap.add(1)), 0, 1);
      const unlit = clamp(ndl.negate().add(U.wrap).div(U.wrap.add(1)), 0, 1);
      const fwd = pow(max(dot(V, Ld.negate()), 0), 4)
        .mul(U.forward)
        .add(1);
      const front = U.cloth.mul(lit);
      const back = Tr.mul(unlit).mul(fwd);
      // fabric sheen (Charlie), on the lit side
      const H = normalize(Ld.add(V));
      const sinH = sqrt(max(float(1).sub(dot(n, H).pow(2)), 1e-4));
      const r = float(0.45);
      const D = float(2)
        .add(float(1).div(r))
        .mul(pow(sinH, float(1).div(r)))
        .div(6.2832);
      const ndv = max(dot(n, V), 1e-3);
      const nl = max(ndl, 0);
      const sheen = D.div(float(4).mul(ndv.add(nl).sub(ndv.mul(nl))))
        .mul(nl)
        .mul(U.sheen);
      // a spot: falls off round its centre, across the light's view
      const off = lc.xy.mul(HALF).sub(L.spotAt);
      const spot = mix(float(1), exp(dot(off, off).div(L.spotR.mul(L.spotR)).negate()), L.spot);
      return { light: front.add(back).add(sheen).mul(passed).mul(L.color).mul(spot), occ, ndl };
    };
    return { L, aim, render, shade, layer1, layer2, cam };
  };
  const key = makeLight();
  const backLight = makeLight();

  // ---- the cloth's light
  const material = new MeshBasicNodeMaterial({ side: DoubleSide });
  const vPos = varying(clothPos(), "vClothPos");
  const vNor = varying(clothNor(), "vClothNor");
  const vNap = varying(clothNap(), "vClothNap");
  material.positionNode = clothPos();
  material.colorNode = Fn(() => {
    const n0 = normalize(vNor.xyz);
    // the side we see: thin sheet, so it's whichever way faces us
    const side = select(dot(n0, cameraPosition.sub(vPos)).greaterThan(0), float(1), float(-1));
    const n = n0.mul(side).toVar();
    const p = vPos;
    const V = normalize(cameraPosition.sub(p));
    // where the smooth normal turns from us on a grazing fold, keep it facing us
    n.assign(normalize(n.add(V.mul(max(dot(n, V).negate().add(0.05), 0)))));
    const k = key.shade(p, n0, n, V);
    const bk = backLight.shade(p, n0, n, V);

    // the sky: from above on an upward face, through the cloth on a downward one; folds take some
    const hollow = max(vNor.w.mul(side), 0);
    const ao = exp(hollow.mul(U.hollow).negate());
    const up = n.y.mul(0.5).add(0.5);
    const Tr = U.through.mul(U.transmit);
    const sky = U.sky
      .mul(U.skyLight)
      .mul(U.cloth.mul(up).add(Tr.mul(float(1).sub(up))))
      .mul(ao);
    const litPlain = k.light
      .add(bk.light)
      .mul(mix(float(1), ao, 0.5))
      .add(sky);
    // nap: the hairs stand off the face we see, all combed one way along the sheet; we see into the pile
    // looking down them (the tips' colour) and their sides looking across (the sides' colour), and the hue
    // runs on with that angle, so it changes only as the sheet turns
    const leanW = vNap.xyz;
    const leanT = leanW.sub(n.mul(dot(leanW, n)));
    const hair = normalize(n.add(leanT.mul(U.tilt)));
    const along = clamp(dot(V, hair), 0, 1);
    const phase = along.mul(U.bands).add(U.hue).mul(6.2832);
    const rainbowC = vec3(cos(phase), cos(phase.sub(2.0944)), cos(phase.add(2.0944)))
      .mul(0.5)
      .add(0.5);
    const twoTone = mix(U.tipColor, U.sideColor, smoothstep(0.15, 0.95, float(1).sub(along)));
    const tint = mix(twoTone, twoTone.mul(rainbowC).mul(2.2), U.rainbow);
    const clothLum = max(dot(U.cloth, vec3(0.2126, 0.7152, 0.0722)), 0.05);
    // a fibre's glint (Kajiya-Kay): bright where the half vector lies across the hairs, tinted half a turn on
    const Lk = key.L.dir;
    const H = normalize(Lk.add(V));
    const th = dot(hair, H);
    const glintPhase = phase.add(3.1416);
    const glintC = mix(
      vec3(1),
      vec3(cos(glintPhase), cos(glintPhase.sub(2.0944)), cos(glintPhase.add(2.0944)))
        .mul(0.5)
        .add(0.5),
      U.rainbow,
    );
    const glint = pow(sqrt(max(float(1).sub(th.mul(th)), 0)), U.fibreSharp)
      .mul(smoothstep(-0.1, 0.3, k.ndl))
      .mul(exp(k.occ.mul(-2.5)))
      .mul(U.fibre);
    const lit = mix(litPlain, litPlain.mul(tint).div(clothLum), U.iri).add(key.L.color.mul(glintC).mul(glint).mul(U.iri));
    // the grade: where this point sits between ink and white, in stops, through an S, onto the ramp; what
    // is brighter than white keeps its excess, for the bloom
    const Y = max(dot(lit, vec3(0.2126, 0.7152, 0.0722)), 1e-5);
    const st = clamp(log2(Y.div(U.white)).div(U.stops).add(1), 0, 1);
    const sc = pow(st, U.contrast).div(pow(st, U.contrast).add(pow(float(1).sub(st), U.contrast)));
    // through the four colours on a Catmull-Rom spline: no kinks, which the eye would see as bands
    const x3 = sc.mul(3);
    const seg = clamp(x3.floor(), 0, 2);
    const u = x3.sub(seg);
    const first = seg.lessThan(0.5);
    const last = seg.greaterThan(1.5);
    const P0 = select(first, U.ink, select(last, U.low, U.ink));
    const P1 = select(first, U.ink, select(last, U.mid, U.low));
    const P2 = select(first, U.low, select(last, U.high, U.mid));
    const P3 = select(first, U.mid, select(last, U.high, U.high));
    const u2 = u.mul(u);
    const ramp = max(
      P1.mul(2)
        .add(P2.sub(P0).mul(u))
        .add(P0.mul(2).sub(P1.mul(5)).add(P2.mul(4)).sub(P3).mul(u2))
        .add(P1.mul(3).sub(P0).sub(P2.mul(3)).add(P3).mul(u2.mul(u)))
        .mul(0.5),
      vec3(0),
    );
    const graded = ramp.mul(max(Y.div(U.white), 1));
    const color = mix(lit, graded, U.grade);
    const dbg = U.debug;
    return vec4(select(dbg.equal(1), vec3(k.occ.mul(0.5)), select(dbg.equal(2), vec3(ao), select(dbg.equal(3), vec3(k.ndl.mul(0.5).add(0.5)), select(dbg.equal(4), vec3(bk.occ.mul(0.5)), color)))), 1);
  })();
  const cloth = new Mesh(geometry, material);
  cloth.frustumCulled = false;

  // ---- cables: from each pin, straight to its anchor
  const SIDES = 6;
  const cg = new BufferGeometry();
  const cid: number[] = [];
  const ct: number[] = [];
  const ca: number[] = [];
  const ci: number[] = [];
  pins.forEach((_, j) => {
    const base = cid.length;
    for (let e = 0; e < 2; e++)
      for (let s = 0; s < SIDES; s++) {
        cid.push(j);
        ct.push(e);
        ca.push((s / SIDES) * Math.PI * 2);
      }
    for (let s = 0; s < SIDES; s++) {
      const a = base + s;
      const b = base + ((s + 1) % SIDES);
      ci.push(a, a + SIDES, b, b, a + SIDES, b + SIDES);
    }
  });
  cg.setAttribute("position", new BufferAttribute(new Float32Array(cid.length * 3), 3));
  cg.setAttribute("cid", new BufferAttribute(new Float32Array(cid), 1));
  cg.setAttribute("ct", new BufferAttribute(new Float32Array(ct), 1));
  cg.setAttribute("ca", new BufferAttribute(new Float32Array(ca), 1));
  cg.setIndex(ci);
  const pinCells = uniformArray(pins.map((p) => new Vector4(p.gx, p.gy, 0, 0)));
  const anchors = uniformArray(pins.map((p) => new Vector4(...p.anchor, 0)));
  const cableMat = new MeshBasicNodeMaterial();
  const cableN = varying(vec3(0, 1, 0), "vCableN");
  cableMat.positionNode = Fn(() => {
    const j = int(attribute("cid", "float"));
    const c = pinCells.element(j);
    const a = textureLoad(posTex, ivec2(c.xy)).xyz;
    const b = anchors.element(j).xyz;
    const ax = normalize(b.sub(a));
    const side = normalize(cross(ax, vec3(0.3, 1, 0.1)));
    const other = cross(ax, side);
    const ang = attribute("ca", "float");
    const off = side.mul(cos(ang)).add(other.mul(sin(ang)));
    cableN.assign(off);
    const t = attribute("ct", "float");
    // thinner far off: a cable keeps its look as it leaves the frame
    return mix(a, b, t).add(off.mul(mix(float(0.0035), float(0.005), t)));
  })();
  cableMat.colorNode = Fn(() => {
    const L = key.L.dir;
    const lit = max(dot(normalize(cableN), L), 0)
      .mul(0.25)
      .add(0.04);
    return vec4(U.cable.add(vec3(lit.mul(0.15))), 1);
  })();
  const cables = new Mesh(cg, cableMat);
  cables.frustumCulled = false;

  const scene = new Scene();
  scene.add(cloth, cables);
  scene.backgroundNode = Fn(() => {
    const uv = screenUV;
    const c = mx_fractal_noise_float(vec3(uv.mul(vec2(2.2, 1.6)), 0.3), 5, 2.0, 0.55, 1.0)
      .mul(0.5)
      .add(0.5);
    const c2 = mx_fractal_noise_float(vec3(uv.mul(vec2(5, 3.5)).add(c), 1.7), 4, 2.0, 0.5, 1.0)
      .mul(0.5)
      .add(0.5);
    const glow = smoothstep(1.4, 0, length(uv.sub(vec2(0.25, 0.05))));
    const clouds = c.mul(c2).mul(glow).mul(U.clouds);
    return U.bg.add(vec3(clouds));
  })();

  const camera = new PerspectiveCamera(look.fov, width / height, 0.05, 50);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.05, 0);
  controls.enableDamping = true;
  controls.update();

  // ---- post: bloom for what glows, vignette and grain
  const pipeline = new RenderPipeline(renderer);
  const scenePass = pass(scene, camera, { samples: 4 });
  const color = scenePass.getTextureNode("output");
  const glow = bloom(color, 0.35, 0.4, 0.75);
  pipeline.outputNode = Fn(() => {
    const c = color.add(glow).toVar();
    const q = screenUV.sub(0.5);
    const v = float(1).sub(dot(q, q).mul(U.vignette).mul(1.6));
    const g = hash(screenCoordinate.x.floor().add(screenCoordinate.y.floor().mul(1931)).add(U.frame.mul(7919)))
      .sub(0.5)
      .mul(U.grain);
    return vec4(c.rgb.mul(clamp(v, 0, 1)).add(g), 1);
  })();

  const refresh = (moveCamera = false) => {
    key.aim(look.keyUp, look.keyTurn, look.key, look.keyColor, look.keySpot, look.keySpotR, look.keySpotX, look.keySpotY);
    backLight.aim(look.backUp, look.backTurn, look.back, look.backColor, look.backSpot, look.backSpotR);
    U.cloth.value.set(look.cloth);
    U.through.value.set(look.through);
    U.deep.value.set(look.deep);
    U.transmit.value = look.transmit;
    U.sheen.value = look.sheen;
    U.sky.value.set(look.sky);
    U.skyLight.value = look.skyLight;
    U.hollow.value = look.hollow;
    U.cable.value.set(look.cable);
    U.bg.value.set(look.background);
    U.clouds.value = look.clouds;
    U.vignette.value = look.vignette;
    U.grain.value = look.grain;
    U.debug.value = look.debug;
    glow.strength.value = look.bloom;
    renderer.toneMappingExposure = look.exposure;
    camera.fov = look.fov;
    // only the camera's own controls (and a preset) move it, so orbiting survives other changes
    if (moveCamera) {
      controls.target.set(look.camX, look.camY, look.camZ);
      const ce = (look.camUp * Math.PI) / 180;
      const ca = (look.camTurn * Math.PI) / 180;
      camera.position
        .set(Math.cos(ce) * Math.cos(ca), Math.sin(ce), Math.cos(ce) * Math.sin(ca))
        .multiplyScalar(look.dist)
        .add(controls.target);
      camera.lookAt(controls.target);
    }
    U.offset.value = look.offset;
    U.fade.value = look.fade;
    U.soft.value = look.soft;
    U.wrap.value = look.wrap;
    U.forward.value = look.forward;
    U.grade.value = look.grade;
    U.ink.value.set(look.ink);
    U.low.value.set(look.low);
    U.mid.value.set(look.mid);
    U.high.value.set(look.high);
    U.white.value = look.white;
    U.stops.value = look.stops;
    U.contrast.value = look.contrast;
    U.iri.value = look.iri;
    U.tipColor.value.set(look.tipColor);
    U.sideColor.value.set(look.sideColor);
    U.rainbow.value = look.rainbow;
    U.bands.value = look.bands;
    U.hue.value = look.hue;
    U.tilt.value = look.tilt;
    U.fibre.value = look.fibre;
    U.fibreSharp.value = look.fibreSharp;
    camera.updateProjectionMatrix();
  };
  refresh(true);
  // `?cam=up,turn,dist,fov,tx,ty,tz`: a camera saved with the `c` key
  const camQ = query.get("cam")?.split(",").map(Number);
  if (camQ && camQ.length >= 3 && camQ.every(Number.isFinite)) {
    [look.camUp, look.camTurn, look.dist] = camQ;
    if (camQ.length >= 4) look.fov = camQ[3];
    if (camQ.length >= 7) [look.camX, look.camY, look.camZ] = camQ.slice(4, 7);
    refresh(true);
  }

  // published, the panel is just the look, the show and the sound; in dev (or with `?dev`) every knob
  const tune = import.meta.env.DEV || query.has("dev");
  const gui = new GUI({ title: tune ? "Controls" : "cloth" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pick: any = { look: lookName in presets ? lookName : "c" };
  gui
    .add(pick, "look", { "c, graded": "c", "d, iridescent": "d" })
    .name("look")
    .onChange((name: keyof typeof presets) => {
      Object.assign(look, presets[name]);
      refresh(true);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
    });
  // the show: the waltz (the recording), the Danube sung by a little synth, the silent beat show, or by
  // hand (reloads, the whole timeline changes)
  gui
    .add({ show: SHOW }, "show", { "waltz, recording": "waltz", "danube, synth": "danube", "beats, silent": "beats", "manual, by hand": "manual" })
    .onChange((name: string) => {
      const url = new URL(location.href);
      url.searchParams.set("show", name);
      location.href = url.toString();
    });
  if (tune) {
    gui.add(physics, "density", 0.04, 2, 0.01).name("weight kg/m²");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lk = look as any;
    const groups: [string, string[], boolean?][] = [
      ["cloth", ["cloth", "through", "deep", "transmit", "wrap", "sheen", "forward", "hollow"]],
      ["key light", ["key", "keyColor", "keyUp", "keyTurn", "keySpot", "keySpotR", "keySpotX", "keySpotY"]],
      ["back light", ["back", "backColor", "backUp", "backTurn", "backSpot", "backSpotR"]],
      ["grade", ["grade", "ink", "low", "mid", "high", "white", "stops", "contrast"]],
      ["nap (iridescent)", ["iri", "tipColor", "sideColor", "rainbow", "bands", "hue", "tilt", "fibre", "fibreSharp"]],
      ["camera", ["camUp", "camTurn", "dist", "fov", "camX", "camY", "camZ"], true],
      ["sky and print", ["sky", "skyLight", "background", "clouds", "cable", "exposure", "bloom", "vignette", "grain"]],
      ["layers (shadow tuning)", ["offset", "fade", "soft", "debug"]],
    ];
    const RANGES: Record<string, [number, number, number]> = {
      grade: [0, 1, 0.01],
      white: [0.1, 4, 0.01],
      stops: [2, 12, 0.1],
      contrast: [0.5, 3, 0.01],
      iri: [0, 1, 0.01],
      rainbow: [0, 1, 0.01],
      bands: [0, 4, 0.01],
      hue: [0, 1, 0.01],
      tilt: [0, 3, 0.01],
      fibre: [0, 3, 0.01],
      fibreSharp: [2, 200, 1],
    };
    const placed = new Set<string>();
    for (const [title, names, camera] of groups) {
      const folder = gui.addFolder(title);
      if (title.startsWith("layers") || title.startsWith("sky")) folder.close();
      for (const name of names) {
        if (!(name in lk)) continue;
        placed.add(name);
        const range = RANGES[name];
        const c = typeof lk[name] === "string" ? folder.addColor(lk, name) : range ? folder.add(lk, name, ...range) : folder.add(lk, name);
        c.onChange(() => refresh(!!camera));
      }
    }
    // anything not in a group yet still gets a control
    for (const name of Object.keys(look)) if (!placed.has(name)) (typeof lk[name] === "string" ? gui.addColor(lk, name) : gui.add(lk, name)).onChange(() => refresh());
    const ph = gui.addFolder("physics").close();
    for (const name of Object.keys(physics)) if (name !== "density") ph.add(physics as any, name);
    ph.add({ restart: () => (sim.reset(), settle(state.warm), (state.t = 0), (state.f = 0)) }, "restart");
    ph.add(state, "feed", 0, 400);
  }
  const stats = tune ? new Stats() : undefined;
  if (stats) document.body.appendChild(stats.dom);

  // `c`: save the camera: into the camera sliders, the address bar (`?cam=`), the clipboard and the console
  const toast = document.createElement("div");
  toast.style.cssText =
    "position:fixed;left:50%;bottom:24px;transform:translateX(-50%);padding:8px 12px;border-radius:6px;background:#000c;color:#fff;font:12px/1.4 ui-monospace,monospace;white-space:pre;pointer-events:none;opacity:0;transition:opacity .3s;z-index:10";
  document.body.appendChild(toast);
  let toastTimer = 0;
  const showToast = (text: string, ms = 4000) => {
    toast.textContent = text;
    toast.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.style.opacity = "0"), ms);
  };
  // `[` `]`: the shapes 10 ms earlier / later against the sound (with shift 50 ms); kept in the address
  // as `?lag=`, so a reload or a take keeps it
  const setLag = (lag: number) => {
    sync.lag = Math.round(Math.min(0.8, Math.max(-0.4, lag)) * 1000) / 1000;
    const url = new URL(location.href);
    url.searchParams.set("lag", String(sync.lag));
    history.replaceState(null, "", url);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    showToast(`shapes ${Math.round(sync.lag * 1000)} ms behind the sound   ([ earlier, ] later, shift x5)`, 2500);
  };
  const onKey = (e: KeyboardEvent) => {
    if (!tune || e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest?.("input,textarea,select")) return;
    if (e.code === "BracketLeft" || e.code === "BracketRight") {
      if (SHOW !== "beats") setLag(sync.lag + (e.code === "BracketRight" ? 1 : -1) * (e.shiftKey ? 0.05 : 0.01));
      return;
    }
    if (e.key !== "c") return;
    const r = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
    const off = camera.position.clone().sub(controls.target);
    const dist = off.length();
    look.camUp = r((Math.asin(off.y / dist) * 180) / Math.PI, 1);
    look.camTurn = r((((Math.atan2(off.z, off.x) * 180) / Math.PI + 360) % 360), 1);
    look.dist = r(dist, 3);
    const t = controls.target.toArray().map((v) => r(v, 3));
    [look.camX, look.camY, look.camZ] = t;
    const cam = [look.camUp, look.camTurn, look.dist, look.fov, ...t].join(",");
    const url = new URL(location.href);
    url.searchParams.set("cam", cam);
    history.replaceState(null, "", url);
    const text = `cam=${cam}  (camUp ${look.camUp}, camTurn ${look.camTurn}, dist ${look.dist}, fov ${look.fov}, target ${t.join(", ")})`;
    console.log(`cloth camera: ${text}`);
    gui.controllersRecursive().forEach((c) => c.updateDisplay());
    const done = (copied: boolean) => showToast(`${copied ? "copied" : "saved (copy from the address bar)"}: ${text}`);
    navigator.clipboard?.writeText(text).then(() => done(true), () => done(false)) ?? done(false);
  };
  window.addEventListener("keydown", onKey);

  // the Danube's tune (synthesised, or the recording): starts on the first click or key (browsers allow
  // sound no sooner)
  const music = SHOW === "danube" ? new Music(BEAT, PERIOD) : SHOW === "waltz" ? new Recording("waltz.flac", PERIOD) : undefined;
  const hint = document.createElement("div");
  const startMusic = () => {
    music?.start();
    hint.remove();
  };
  if (music) {
    hint.textContent = "click for sound";
    hint.style.cssText =
      "position:fixed;left:50%;top:20px;transform:translateX(-50%);padding:6px 12px;border-radius:6px;background:#0008;color:#fffc;font:12px/1.4 ui-monospace,monospace;pointer-events:none;z-index:10";
    document.body.appendChild(hint);
    window.addEventListener("pointerdown", startMusic);
    window.addEventListener("keydown", startMusic);
    const snd = gui.addFolder("sound");
    snd.add(music, "volume", 0, 1, 0.01).onChange(() => music.setVolume());
    snd.add(music, "muted").onChange(() => music.setVolume());
    if (tune) snd.add(sync, "lag", -0.4, 0.8, 0.005).name("shapes lag s ([ ])").onChange((v: number) => setLag(v));
    snd.open();
    if (tune) hint.textContent = "click for sound  ·  [ ] shapes earlier / later";
  }
  // the recording's notes as edited by hand (public/waltz-edits.json); the editor itself only in dev
  let closeEditor: (() => void) | undefined;
  if (SHOW === "waltz") {
    const edits: NoteEdits = await fetch("waltz-edits.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
    setWaltzEdits(edits);
    if (import.meta.env.DEV && !query.has("loop")) closeEditor = (await import("./editor.ts")).noteEditor(() => state.t, edits, "waltz.flac");
  }

  // the manual show: press on the sheet and a shape comes up there; drag and it follows; let go and it
  // drops. The left button (one finger) is the hand's, so orbiting moves to the right (two fingers)
  const touch = SHOW === "manual" ? new Touch() : undefined;
  const ray = new Raycaster();
  /** where the pointer meets the resting sheet (strict: only over the sheet) */
  const onSheet = (e: PointerEvent, strict: boolean): [number, number] | undefined => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const { origin: o, direction: d } = ray.ray;
    if (d.y > -1e-4) return;
    let [x, y, z] = [0, 0, 0];
    // onto the plane at the sheet's height there, a few times over as that height changes with x z
    for (let i = 0; i < 4; i++) {
      const s = (y - o.y) / d.y;
      x = o.x + d.x * s;
      z = o.z + d.z * s;
      y = restY(x, z);
    }
    const half = physics.size / 2;
    return strict && (Math.abs(x) > half || Math.abs(z) > half) ? undefined : [x, z];
  };
  const touchHint = document.createElement("div");
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const p = onSheet(e, true);
    if (!p) return;
    touch!.press(e.pointerId, ...p);
    touchHint.remove();
  };
  const onMove = (e: PointerEvent) => {
    const p = onSheet(e, false);
    if (p) touch!.move(e.pointerId, ...p);
  };
  const onUp = (e: PointerEvent) => touch!.release(e.pointerId);
  if (touch) {
    controls.mouseButtons = { LEFT: -1 as MOUSE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    controls.touches = { ONE: -1 as TOUCH, TWO: TOUCH.DOLLY_ROTATE };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    touchHint.textContent = "press on the sheet, drag, let go";
    touchHint.style.cssText =
      "position:fixed;left:50%;top:20px;transform:translateX(-50%);padding:6px 12px;border-radius:6px;background:#0008;color:#fffc;font:12px/1.4 ui-monospace,monospace;pointer-events:none;z-index:10";
    document.body.appendChild(touchHint);
  }

  // one frame of sim. At each period's start the sheet is kept; over the last stretch of the period
  // it is drawn softly back towards that, so the end meets the start (the pull vanishes once it does)
  const tick = () => {
    state.f++;
    state.t = state.f * DT;
    const j = state.f % F;
    const left = (F - j) * DT;
    const ramp = Math.min(Math.max(1 - left / state.feedFor, 0), 1);
    sim.feed = state.f > F ? state.feed * ramp * ramp : 0;
    if (touch) touch.step(DT);
    sim.advance(DT, touch ? touch.pushers() : pushersAt(state.t), true, j === 0);
  };
  Object.assign(window, { __cloth: { key, backLight, presets, look, physics, state, sim, refresh, tick, camera, controls, renderer, pushersAt, music, period: PERIOD, waltzNotes, touch } });
  console.log(`cloth: ${N}x${N} particles, ${physics.substeps} substeps, period ${PERIOD} s`);

  // `?loop`: one period run unseen first, after which each period is the same as the last (to ~0.3 mm)
  if (query.has("loop")) {
    const device = backend.device;
    for (let k = 0; k < F; k++) {
      tick();
      if (k % 60 === 0) await device.queue.onSubmittedWorkDone();
    }
  }

  // Live, the sim takes at most one frame per frame drawn, so a slow machine just plays slower.
  // Recording, it keeps exactly to ssam's playhead: when the take starts at 0 it runs on unseen to the
  // start of its next period, so a take is one whole period, seam to seam.
  let due = 0;
  wrap.render = ({ playhead, recording, deltaTime }) => {
    if (!state.pause) {
      if (recording) {
        let ahead = (Math.round(playhead * F) - (state.f % F) + F) % F;
        while (ahead-- > 0) tick();
      } else {
        // a 120 Hz screen draws two frames per frame of sim
        due = Math.min(due + deltaTime / 1000, 2 * DT);
        if (due >= DT * 0.99) {
          due -= DT;
          tick();
        }
      }
    }
    if (music instanceof Recording) music.update(state.t, recording || state.pause);
    else music?.update(state.t);
    controls.update();
    U.frame.value = state.frame % 1024;
    renderer.setClearColor(0xffffff, 1);
    key.render();
    backLight.render();
    renderer.setRenderTarget(null);
    renderer.setClearColor(0x000000, 1);
    pipeline.render();
    stats?.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  wrap.unload = () => {
    renderer.dispose();
    controls.dispose();
    gui.destroy();
    stats?.dom.remove();
    toast.remove();
    window.removeEventListener("keydown", onKey);
    hint.remove();
    window.removeEventListener("pointerdown", startMusic);
    window.removeEventListener("keydown", startMusic);
    music?.dispose();
    closeEditor?.();
    touchHint.remove();
    canvas.removeEventListener("pointerdown", onDown);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: PERIOD * 1000 + 1000 / 240, // ssam floors to frames: a quarter frame over keeps all 960
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
