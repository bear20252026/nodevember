// Mirage: a flight over a desert toward an oasis that is never reached. Mirrors stand in the sand; the arched
// ones are doors, each back to where the flight began, and the eye goes through one after another.
//
// The ground (ground.wgsl, made by fields.wgsl), the sky (sky.wgsl) and the palms (palms.ts) are made once.
// Every frame is then one pass of trace.wgsl, a ray a pixel, and show.wgsl puts it on the screen.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import { Color } from "three";
import {
  along,
  asks,
  createWorld,
  settle,
  through,
  where,
  worldDefaults,
  type V3,
  type World,
} from "./world.ts";
import { drawGrove } from "./palms.ts";
import groundCode from "./ground.wgsl?raw";
import reachCode from "./reach.wgsl?raw";
import fieldsCode from "./fields.wgsl?raw";
import topsCode from "./tops.wgsl?raw";
import grainCode from "./grain.wgsl?raw";
import skyCode from "./sky.wgsl?raw";
import traceCode from "./trace.wgsl?raw";
import showCode from "./show.wgsl?raw";

const LOOP = 36; // seconds
const GLASSES = 40; // at most
const ROCKS = 64;
const SPAN = 4096; // metres until the ground repeats (as in ground.wgsl)
const CELLS = 2048;
const SKY = [4096, 1536]; // the picture of the sky
const AIR = [512, 256]; // and of the air alone

// every number the shaders are given, four to a name
const NAMES = [
  "size",
  "eye",
  "right",
  "up",
  "fore",
  "vel",
  "sun",
  "sunTone",
  "sky",
  "wave",
  "dune",
  "land",
  "sand",
  "ripple",
  "mirage",
  "oasis",
  "oasis2",
  "air",
  "air2",
  "cloud",
  "cloud2",
  "cloud3",
  "cloud4",
  "cloud5",
  "tune",
  "map",
  "seed",
  "bake",
  "small",
  "small2",
  "rock",
  "edge",
  "side",
  "lit",
  "lit2",
  "frame",
  "frame2",
] as const;
type Name = (typeof NAMES)[number];
const paramsCode = `
struct Glass {
  c: vec4f, // the middle of its lower edge, and half its width
  n: vec4f, // the way its front looks, and its height
  to: vec4f, // a door: what to add to a point, once turned, to have it through; and 1 if it is a door
  rot: vec4f, // a door: the cosine and sine of that turn; then 1 if it is arched
  sun: vec4f, // the way to the sun as its light comes off this (a mirror) or out of it (a door)
};
struct Params {
${NAMES.map((n) => `  ${n}: vec4f,`).join("\n")}
  glass: array<Glass, ${GLASSES}>,
  shade: array<vec4f, ${GLASSES}>, // the stripe along the sun's way a glass shades: from, to, across that way
  shine: array<vec4f, ${GLASSES}>, // and the one it lights: the way across (x, z), then from, to
};
`;
const shared = `
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var lin: sampler;
@group(0) @binding(2) var ctlA: texture_2d<f32>;
@group(0) @binding(3) var ctlB: texture_2d<f32>;
@group(0) @binding(4) var tops: texture_2d<f32>;
@group(0) @binding(19) var ctlC: texture_2d<f32>;
@group(0) @binding(20) var ctlD: texture_2d<f32>;
`;

// the garden (the day's page), or with <body data-scene="far"> the first take: the long flight, in git history
// as index.html before the garden became the page
const scene = document.body.dataset.scene === "far" ? "far" : "garden";

const defaults = {
  ...worldDefaults,
  seed: 3,
  // the sun: degrees to the right of the lane, degrees up, how strong, and how big it looks
  sunTurn: -6,
  sunHigh: 3.5,
  sunPower: 22,
  sunWide: 0.5,
  sunGlare: 0.35,
  haze: 1,
  bounce: 0.6, // light that has been scattered more than once
  // clouds: the low heaped deck, then the high thin one
  cover: 0.62,
  thick: 0.012,
  cloudLow: 1500,
  cloudHigh: 3800,
  cloudAtX: 0.3,
  cloudAtZ: 0.7,
  veil: 0.55,
  veilHigh: 8500,
  cloudSun: 0.16,
  cloudSky: 1,
  cloudUnder: 0.6,
  cloudAir: 65000,
  cloudPatch: 5200, // metres across a patch of cloud, a heap in it, and a wisp on that
  cloudHeap: 4300,
  cloudWisp: 1050,
  cloudFray: 0.3,
  cloudTilt: -6, // degrees lower the sun is for the clouds: lit from under
  // the dunes
  crests: 51, // of them across the 4 km the ground repeats in
  skew: 5,
  duneTall: 11,
  repose: 0.62,
  wander: 0.85,
  dunes: 0.2,
  land: 13,
  lift: 4,
  swell: 1.2,
  pans: 0,
  // small dunes between the big ones: how tall, how many across the 4 km (under zero, facing the other way),
  // how far they take the big ones' wander, under what height of big dune they stand at all, and how patchy
  smallTall: 0,
  smallCrests: 186,
  smallSkew: 30,
  smallWander: 2.5,
  smallUnder: 1.5,
  smallOver: 5,
  smallPatchy: 0.6,
  // boulders
  rockTone: "#66504a",
  rockRough: 0.25,
  // the sand
  sandTone: "#dba677",
  skyFill: 1.5, // how much more of the sky's light the sand gets than it would
  glint: 0.5,
  rippleLong: 0.17,
  rippleTall: 0.0055,
  // the mirage: the angle (degrees) under which flat ground turns to water, how wholly, how wet the pans are,
  // how much it trembles, and how many times a loop
  mirageAngle: 1.5,
  mirage: 0.95,
  wet: 1,
  tremble: 0.003,
  trembles: 40,
  // the oasis
  oasisWide: 300,
  oasisGap: 26,
  vanishFrom: 0,
  vanishTo: 1,
  // the air and the glass
  sight: 4.5, // km
  doorGlint: 0.16,
  rim: 0.07,
  silver: 0.9,
  // the rim: dark metal, rounded over at its outer edge (as far round as `rimRound`, 1 a quarter turn), that
  // shows the sun as a glint and little else; or (`rimDark` 0) polished steel, a dim mirror
  rimDark: 1,
  rimTone: "#1c1714",
  rimGloss: 300,
  rimShine: 1,
  rimRound: 1,
  rimDepth: 0.025, // how thick a glass is
  // the eye
  fov: 52,
  ahead: 22,
  pitch: 0.04,
  bank: 0.3,
  // looking about: a drag turns the eye off the way, up to `lookWide` degrees either side, `lookUp` up and
  // `lookDown` down; let go, and after a moment it comes back, in about `lookBack` seconds
  lookWide: 65,
  lookUp: 25,
  lookDown: 18,
  lookBack: 1.4,
  // the picture
  exposure: 1.15,
  grain: 0.02,
  vignette: 0.25,
  glow: 0.07, // how much of the picture is its own glow, and how far each size of it spreads
  spread: 0.9,
  colour: 1.25,
  cast: "#ffffff",
  dusk: 1,
  detail: 2.2, // millions of pixels it is traced with, at most
  fpsCap: 60, // frames a second, at most (0: as many as the screen asks for)
  adapt: true, // fewer pixels while frames come late, and back as they come in time
  edges: 1, // 1 smooths edges with more rays, 2 shows which pixels get them
  edgeWide: 0.8, // how near an edge a ray has to pass, in pixels, for its pixel to get them
  edgeRays: 2, // and how many
  tiles: true, // whether rays from the eye are told which glasses and boulders their part of the screen can show
  // the sun's light on the ground about the glasses, worked out once (lightBake in trace.wgsl): whether, in how
  // many million texels at most, and under what size of pixel (in texels) it is still worked out afresh
  baked: true,
  bakeTexels: 16,
  bakeNear: 0,
  cutoff: 0, // a ray with less than this left of it (it is mostly in mirrors facing each other) goes no further
  bounces: 7,
  bright: 40,
  view: "fly",
  mapX: 0,
  mapZ: 150,
  mapSpan: 220,
};
const scenes: Record<string, Partial<typeof defaults>> = {
  far: {},
  garden: {
    scene: "garden",
    mirrors: 37,
    doorWide: 3.6,
    doorTall: 7.4,
    eye: 2.1,
    lane: 18,
    rocks: 56,
    smallTall: 1.7,
    ahead: 12,
    bank: 0.5,
    edgeRays: 1,
    detail: 2,
    mapZ: 40,
    mapSpan: 70,
  },
};
export const look = { ...defaults, ...scenes[scene] };
const ranges: Record<string, [number, number, number?]> = {
  seed: [1, 99, 1],
  layout: [1, 99, 1],
  mirrors: [0, GLASSES - 3, 1],
  doorWide: [2, 8, 0.1],
  doorTall: [4, 14, 0.1],
  eye: [0.8, 8, 0.05],
  oasisFar: [300, 1500, 10],
  lane: [0, 60, 1],
  sunTurn: [-180, 180, 1],
  sunHigh: [0.5, 60, 0.1],
  sunPower: [1, 60, 0.5],
  sunWide: [0.2, 3, 0.01],
  sunGlare: [0, 2, 0.01],
  haze: [0, 6, 0.05],
  bounce: [0, 3, 0.01],
  cover: [0, 1, 0.01],
  thick: [0, 0.05, 0.0005],
  cloudLow: [500, 4000, 50],
  cloudHigh: [1000, 8000, 50],
  cloudAtX: [0, 4, 0.01],
  cloudAtZ: [0, 4, 0.01],
  veil: [0, 2, 0.01],
  veilHigh: [5000, 12000, 100],
  cloudSun: [0, 4, 0.01],
  cloudSky: [0, 4, 0.01],
  cloudUnder: [0, 3, 0.01],
  cloudAir: [10000, 200000, 1000],
  cloudPatch: [1000, 20000, 100],
  cloudHeap: [1000, 12000, 100],
  cloudWisp: [200, 4000, 50],
  cloudFray: [0, 1, 0.01],
  cloudTilt: [-20, 10, 0.5],
  crests: [10, 120, 1],
  skew: [-40, 40, 1],
  duneTall: [0, 30, 0.1],
  repose: [0.3, 0.8, 0.01],
  wander: [0, 2.5, 0.01],
  dunes: [-0.6, 0.6, 0.01],
  land: [0, 40, 0.5],
  lift: [0, 20, 0.5],
  swell: [0, 6, 0.1],
  pans: [0, 1, 0.01],
  smallTall: [0, 6, 0.05],
  smallCrests: [-400, 400, 1],
  smallSkew: [-120, 120, 1],
  smallWander: [0, 6, 0.05],
  smallUnder: [0, 12, 0.1],
  smallOver: [0.1, 14, 0.1],
  smallPatchy: [0, 1, 0.01],
  rocks: [0, ROCKS, 1],
  rockSize: [0.3, 3, 0.05],
  rockRough: [0, 1, 0.01],
  glint: [0, 3, 0.01],
  skyFill: [0, 4, 0.01],
  rippleLong: [0.05, 1, 0.005],
  rippleTall: [0, 0.04, 0.0005],
  mirageAngle: [0, 8, 0.05],
  mirage: [0, 1, 0.01],
  wet: [0, 1, 0.01],
  tremble: [0, 0.02, 0.0002],
  trembles: [0, 120, 1],
  oasisWide: [50, 600, 5],
  oasisGap: [0, 80, 1],
  vanishFrom: [0, 800, 5],
  vanishTo: [1, 900, 5],
  sight: [0.5, 30, 0.1],
  doorGlint: [0, 0.6, 0.01],
  rim: [0, 0.3, 0.005],
  silver: [0.5, 1, 0.01],
  rimDark: [0, 1, 1],
  rimGloss: [10, 3000, 10],
  rimShine: [0, 4, 0.01],
  rimRound: [0, 1, 0.01],
  rimDepth: [0, 0.2, 0.005],
  fov: [20, 100, 1],
  ahead: [4, 60, 1],
  pitch: [-0.3, 0.3, 0.005],
  bank: [0, 2, 0.05],
  lookWide: [0, 170, 1],
  lookUp: [0, 80, 1],
  lookDown: [0, 80, 1],
  lookBack: [0.2, 10, 0.1],
  exposure: [0.1, 5, 0.01],
  grain: [0, 0.2, 0.005],
  vignette: [0, 1.5, 0.01],
  glow: [0, 0.6, 0.005],
  spread: [0.3, 1.2, 0.01],
  colour: [0, 2, 0.01],
  dusk: [0, 2, 0.01],
  detail: [0.2, 9, 0.1],
  edges: [0, 3, 1],
  edgeWide: [0.5, 2, 0.05],
  edgeRays: [1, 4, 1],
  bakeTexels: [1, 40, 1],
  bakeNear: [0, 4, 0.05],
  cutoff: [0, 0.3, 0.005],
  bounces: [1, 10, 1],
  bright: [2, 200, 1],
  mapX: [-600, 600, 1],
  mapZ: [-300, 1200, 1],
  mapSpan: [20, 2000, 5],
};
// what has to be made again when one of these changes
const reground = new Set([
  "seed",
  "layout",
  "mirrors",
  "doorWide",
  "doorTall",
  "eye",
  "oasisFar",
  "lane",
  "crests",
  "skew",
  "duneTall",
  "repose",
  "wander",
  "dunes",
  "land",
  "lift",
  "swell",
  "pans",
  "smallTall",
  "smallCrests",
  "smallSkew",
  "smallWander",
  "smallUnder",
  "smallOver",
  "smallPatchy",
  "rocks",
  "rockSize",
]);
const resky = new Set([
  "sunTurn",
  "sunHigh",
  "sunPower",
  "haze",
  "bounce",
  "cover",
  "thick",
  "cloudLow",
  "cloudHigh",
  "cloudAtX",
  "cloudAtZ",
  "veil",
  "veilHigh",
  "cloudSun",
  "cloudSky",
  "cloudUnder",
  "cloudAir",
  "cloudPatch",
  "cloudHeap",
  "cloudWisp",
  "cloudFray",
  "cloudTilt",
  "sandTone",
]);
const folders: Record<string, string[]> = {
  "sun and air": [
    "sunTurn",
    "sunHigh",
    "sunPower",
    "sunWide",
    "sunGlare",
    "haze",
    "bounce",
    "sight",
  ],
  clouds: [
    "cover",
    "thick",
    "cloudLow",
    "cloudHigh",
    "cloudAtX",
    "cloudAtZ",
    "veil",
    "veilHigh",
    "cloudSun",
    "cloudSky",
    "cloudUnder",
    "cloudAir",
    "cloudPatch",
    "cloudHeap",
    "cloudWisp",
    "cloudFray",
    "cloudTilt",
  ],
  dunes: [
    "seed",
    "crests",
    "skew",
    "duneTall",
    "repose",
    "wander",
    "dunes",
    "land",
    "lift",
    "swell",
    "pans",
    "lane",
    "smallTall",
    "smallCrests",
    "smallSkew",
    "smallWander",
    "smallUnder",
    "smallOver",
    "smallPatchy",
  ],
  rocks: ["rocks", "rockSize", "rockTone", "rockRough"],
  sand: ["sandTone", "skyFill", "glint", "rippleLong", "rippleTall"],
  mirage: ["mirageAngle", "mirage", "wet", "tremble", "trembles"],
  "glass and oasis": [
    "layout",
    "mirrors",
    "doorWide",
    "doorTall",
    "doorGlint",
    "rim",
    "silver",
    "rimDark",
    "rimTone",
    "rimGloss",
    "rimShine",
    "rimRound",
    "rimDepth",
    "oasisFar",
    "oasisWide",
    "oasisGap",
    "vanishFrom",
    "vanishTo",
  ],
  eye: ["eye", "fov", "ahead", "pitch", "bank", "lookWide", "lookUp", "lookDown", "lookBack"],
  picture: [
    "exposure",
    "grain",
    "vignette",
    "glow",
    "spread",
    "colour",
    "cast",
    "dusk",
    "detail",
    "fpsCap",
    "adapt",
    "edges",
    "edgeWide",
    "edgeRays",
    "tiles",
    "baked",
    "bakeTexels",
    "bakeNear",
    "cutoff",
    "bounces",
    "bright",
    "view",
    "mapX",
    "mapZ",
    "mapSpan",
  ],
};

const dot = (a: number[], b: number[]) =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const scaled = (a: number[], s: number) => a.map((v) => v * s) as V3;
const sum = (...vs: number[][]) =>
  [0, 1, 2].map((i) => vs.reduce((t, v) => t + v[i], 0)) as V3;
const unit = (a: number[]) =>
  scaled(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const cross = (a: number[], b: number[]): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const tone = (hex: string, power = 1) =>
  new Color(hex).toArray().map((v) => v * power);

// what the air leaves of the sun's light on its way down to the ground (as `left` in sky.wgsl)
function sunLight(sun: V3, haze: number, power: number): V3 {
  const [ground, top] = [6360e3, 6460e3];
  const o = [0, ground + 300, 0];
  const b = dot(o, sun);
  const far = -b + Math.sqrt(b * b - (dot(o, o) - top * top));
  const depth = [0, 0, 0];
  let t0 = 0;
  for (let i = 1; i <= 40; i++) {
    const t1 = far * (i / 40) ** 2;
    const q = sum(o, scaled(sun, 0.5 * (t0 + t1)));
    const h = Math.max(Math.hypot(q[0], q[1], q[2]) - ground, 0);
    depth[0] += Math.exp(-h / 8000) * (t1 - t0);
    depth[1] += haze * Math.exp(-h / 1200) * (t1 - t0);
    depth[2] += Math.max(0, 1 - Math.abs(h - 25000) / 15000) * (t1 - t0);
    t0 = t1;
  }
  const blue = [5.802e-6, 13.558e-6, 33.1e-6];
  const ozone = [0.65e-6, 1.881e-6, 0.085e-6];
  return [0, 1, 2].map(
    (c) =>
      power *
      Math.exp(
        -(blue[c] * depth[0] + 4.44e-6 * depth[1] + ozone[c] * depth[2]),
      ),
  ) as V3;
}

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const adapter = await navigator.gpu?.requestAdapter({
    powerPreference: "high-performance",
  });
  if (!adapter) throw new Error("WebGPU is not available");
  const timed = adapter.features.has("timestamp-query");
  const device = await adapter.requestDevice({
    requiredFeatures: timed ? ["timestamp-query"] : [],
  });
  // how long the tracing takes on the GPU, where that can be asked
  const stamps = timed
    ? device.createQuerySet({ type: "timestamp", count: 2 })
    : null;
  const stampsOut = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
  });
  const stampsRead = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  let reading = false;
  const context = canvas.getContext("webgpu")!;
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const module = (code: string) => device.createShaderModule({ code });
  const paint = (
    m: GPUShaderModule,
    entryPoint: string,
    ...formats: GPUTextureFormat[]
  ) =>
    device.createRenderPipeline({
      layout: "auto",
      vertex: { module: m, entryPoint: "vert" },
      fragment: {
        module: m,
        entryPoint,
        targets: formats.map((format) => ({ format })),
      },
    });
  const fieldsPipe = paint(
    module(paramsCode + fieldsCode),
    "frag",
    "rgba16float",
    "rgba16float",
  );
  const topsModule = module(paramsCode + shared + groundCode + topsCode);
  const topsFirst = paint(topsModule, "first", "rg32float");
  const topsNext = paint(topsModule, "next", "rg32float");
  const heightsPipe = paint(topsModule, "heights", "rgba32float");
  const gridPipe = paint(topsModule, "grid", "r32float");
  const slopesPipe = paint(topsModule, "slopes", "rgba16float", "rgba16float");
  const noisyPipe = paint(topsModule, "noisy", "rgba16float");
  const grainModule = module(grainCode);
  const grainPipe = device.createComputePipeline({
    layout: "auto",
    compute: { module: grainModule, entryPoint: "main" },
  });
  const shrinkPipe = device.createComputePipeline({
    layout: "auto",
    compute: { module: grainModule, entryPoint: "shrink" },
  });
  const skyModule = module(paramsCode + skyCode);
  const clearPipe = paint(skyModule, "clear", "rgba16float");
  const cloudsPipe = paint(skyModule, "clouds", "rgba16float");
  const lightPipe = paint(skyModule, "light", "rgba16float");
  const traceModule = module(
    paramsCode + shared + groundCode + reachCode + traceCode,
  );
  const tracePipe = paint(traceModule, "frag", "rgba16float");
  const lightBakePipe = paint(traceModule, "lightBake", "rg8unorm");
  const glassBakePipe = paint(traceModule, "glassBake", "r8unorm");
  const gatherPipe = device.createComputePipeline({
    layout: "auto",
    compute: { module: traceModule, entryPoint: "gather" },
  });
  const mendPipe = device.createComputePipeline({
    layout: "auto",
    compute: { module: traceModule, entryPoint: "mend" },
  });
  const MARKS = 1 << 19; // pixels that can be given more rays in a frame, at most
  const marked = device.createBuffer({
    size: 4 + MARKS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const showModule = module(showCode);
  const showPipe = paint(showModule, "frag", format);
  const downPipe = paint(showModule, "down", "rgba16float");
  const upPipe = device.createRenderPipeline({
    layout: "auto",
    vertex: { module: showModule, entryPoint: "vert" },
    fragment: {
      module: showModule,
      entryPoint: "up",
      targets: [
        {
          format: "rgba16float",
          blend: {
            color: { srcFactor: "one", dstFactor: "one" },
            alpha: { srcFactor: "one", dstFactor: "one" },
          },
        },
      ],
    },
  });
  const GLOWS = 6;

  const SIZE = NAMES.length * 16 + GLASSES * (80 + 32);
  const data = new Float32Array(SIZE / 4);
  const params = device.createBuffer({
    size: SIZE,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const put = (name: Name, ...v: number[]) =>
    data.set(v, NAMES.indexOf(name) * 4);
  const padsData = new Float32Array(4 + 48 * 12);
  const padsBuffer = device.createBuffer({
    size: padsData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const rocksData = new Float32Array(4 + 32 + ROCKS * (8 + 64));
  const rocksBuffer = device.createBuffer({
    size: rocksData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const TILES = [16, 10]; // as in trace.wgsl
  const tilesData = new Uint32Array(TILES[0] * TILES[1] * 4);
  const tilesBuffer = device.createBuffer({
    size: tilesData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  // what a ray can meet once off each glass (see Lists in trace.wgsl)
  const listsData = new Uint32Array(GLASSES * 4 * 3);
  const listsBuffer = device.createBuffer({
    size: listsData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  const shown = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const lin = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
  });
  const skyS = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "clamp-to-edge",
  });
  const edgeS = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
  });
  const rep = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    mipmapFilter: "linear",
    addressModeU: "repeat",
    addressModeV: "repeat",
    addressModeW: "repeat",
  });
  const TEX =
    GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT;
  const picture = (
    w: number,
    h: number,
    format: GPUTextureFormat,
    mipLevelCount = 1,
    usage = TEX,
  ) => device.createTexture({ size: [w, h], format, mipLevelCount, usage });
  const ctlA = picture(CELLS, CELLS, "rgba16float");
  const ctlB = picture(CELLS, CELLS, "rgba16float");
  const ctlC = picture(CELLS, CELLS, "rgba16float");
  const ctlD = picture(CELLS, CELLS, "rgba16float");
  const noiseTex = picture(1024, 1024, "rgba16float");
  const LEVELS = Math.log2(CELLS) + 1;
  const tops = picture(CELLS, CELLS, "rg32float", LEVELS);
  const ASKS = 2048;
  const asked = device.createBuffer({
    size: ASKS * 16,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  const answers = picture(
    ASKS,
    1,
    "rgba32float",
    1,
    TEX | GPUTextureUsage.COPY_SRC,
  );
  const answersOut = device.createBuffer({
    size: ASKS * 16,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });
  const air = picture(AIR[0], AIR[1], "rgba16float");
  const skyTex = picture(SKY[0], SKY[1], "rgba16float", 1, TEX | GPUTextureUsage.COPY_SRC);
  const shed = picture(32, 16, "rgba16float");
  // the light baked on the ground (none yet: a texel that is never read), and where it lies
  let litTex = picture(1, 1, "rg8unorm");
  const glassSun = picture(GLASSES * 32, 128, "r8unorm"); // (GLASS_U and GLASS_V in trace.wgsl)
  const litAt = { x: 0, z: 0, w: 1, h: 1, texel: 1, rows: 0, done: false };
  let rebind = false;
  const grain = device.createTexture({
    size: [128, 128, 128],
    dimension: "3d",
    format: "rgba8unorm",
    mipLevelCount: 6,
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
  });

  type Bound = GPUBuffer | GPUTexture | GPUTextureView | GPUSampler;
  const bind = (
    of: GPURenderPipeline | GPUComputePipeline,
    entries: Record<number, Bound>,
  ) =>
    device.createBindGroup({
      layout: of.getBindGroupLayout(0),
      entries: Object.entries(entries).map(([binding, e]) => ({
        binding: +binding,
        resource:
          e instanceof GPUBuffer
            ? { buffer: e }
            : e instanceof GPUTexture
              ? e.createView()
              : e,
      })),
    });
  const draw = (
    encoder: GPUCommandEncoder,
    to: GPUTextureView[],
    of: GPURenderPipeline,
    bound: GPUBindGroup,
    rows?: [number, number, number],
  ) => {
    const pass = encoder.beginRenderPass({
      colorAttachments: to.map(
        (view) =>
          ({
            view,
            loadOp: rows ? "load" : "clear",
            storeOp: "store",
          }) as GPURenderPassColorAttachment,
      ),
    });
    pass.setPipeline(of);
    pass.setBindGroup(0, bound);
    if (rows) pass.setScissorRect(0, rows[0], rows[2], rows[1]);
    pass.draw(3);
    pass.end();
  };

  // the grain of the clouds, once
  {
    const encoder = device.createCommandEncoder();
    for (let level = 0; level < 6; level++) {
      const pass = encoder.beginComputePass();
      const to = grain.createView({ baseMipLevel: level, mipLevelCount: 1 });
      pass.setPipeline(level ? shrinkPipe : grainPipe);
      pass.setBindGroup(
        0,
        level
          ? bind(shrinkPipe, {
              0: to,
              1: grain.createView({
                baseMipLevel: level - 1,
                mipLevelCount: 1,
              }),
            })
          : bind(grainPipe, { 0: to }),
      );
      const n = Math.ceil((128 >> level) / 4);
      pass.dispatchWorkgroups(n, n, n);
      pass.end();
    }
    device.queue.submit([encoder.finish()]);
  }

  // the palms
  const grove = drawGrove(look.seed);
  let groveLevels = 1;
  while (grove.width >> groveLevels >= 4) groveLevels++;
  const groveTex = device.createTexture({
    size: [grove.width, grove.height],
    format: "rgba8unorm",
    mipLevelCount: groveLevels,
    usage: TEX | GPUTextureUsage.COPY_DST,
  });
  for (
    let level = 0, from: HTMLCanvasElement | OffscreenCanvas = grove;
    level < groveLevels;
    level++
  ) {
    if (level) {
      const smaller = document.createElement("canvas");
      smaller.width = Math.max(1, grove.width >> level);
      smaller.height = Math.max(1, grove.height >> level);
      smaller
        .getContext("2d")!
        .drawImage(from, 0, 0, smaller.width, smaller.height);
      from = smaller;
    }
    device.queue.copyExternalImageToTexture(
      { source: from },
      { texture: groveTex, mipLevel: level, premultipliedAlpha: true },
      [from.width, from.height],
    );
  }

  let world: World = createWorld(look);
  const state = {
    frame: 0,
    ready: false,
    hold: null as number | null,
    grounds: 0,
    skies: 0,
    busy: 0,
    ms: 0,
    ends: [] as number[],
    scale: 1, // of the pixels `detail` allows, the share traced now (see `pace`)
  };
  let grounding = 0;
  let sun: V3 = [0, 1, 0];
  let sunTone: V3 = [1, 1, 1];

  // the numbers that do not change from frame to frame
  const still = () => {
    const [turn, high] = [
      (look.sunTurn * Math.PI) / 180,
      (look.sunHigh * Math.PI) / 180,
    ];
    sun = [
      Math.sin(turn) * Math.cos(high),
      Math.sin(high),
      Math.cos(turn) * Math.cos(high),
    ];
    sunTone = sunLight(sun, look.haze, look.sunPower);
    const wide = (look.sunWide * Math.PI) / 180;
    put("sun", ...sun, 0);
    // (the disc is as bright as it has to be to shed that light, were it its true size; glare tames it)
    put("sunTone", ...sunTone, look.sunGlare / (Math.PI * wide * wide));
    put("sky", Math.tan(wide), wide, 0, 0);
    put(
      "wave",
      -look.crests / SPAN,
      look.skew / SPAN,
      world.glasses.length,
      look.trembles,
    );
    put("dune", look.duneTall, look.repose, look.wander, look.dunes);
    put("land", look.land, look.lift, look.swell, look.pans);
    put("sand", ...tone(look.sandTone), look.glint);
    put("ripple", look.rippleLong, look.rippleTall, 0, look.skyFill);
    put(
      "mirage",
      Math.sin((look.mirageAngle * Math.PI) / 180),
      look.mirage,
      look.wet,
      look.tremble,
    );
    put(
      "oasis",
      world.oasis.x,
      world.oasis.z,
      world.oasis.ground - 0.4,
      look.oasisWide / 2,
    );
    put(
      "oasis2",
      look.oasisWide / 8,
      look.vanishFrom,
      look.vanishTo,
      look.oasisGap,
    );
    put("air", 1 / (look.sight * 1000), look.doorGlint, look.rim, look.silver);
    put("frame", ...tone(look.rimTone), look.rimGloss);
    put("frame2", look.rimDark, look.rimShine, look.rimRound, look.rimDepth);
    put("air2", look.haze, look.bounce, look.sunPower, 0);
    put("cloud", look.cover, look.thick, look.cloudLow, look.cloudHigh);
    put("cloud2", look.veil, look.veilHigh, look.cloudAtX, look.cloudAtZ);
    put("cloud3", look.cloudSun, look.cloudSky, look.cloudUnder, look.cloudAir);
    put(
      "cloud4",
      look.cloudPatch,
      look.cloudHeap,
      look.cloudWisp,
      look.cloudFray,
    );
    put("cloud5", Math.tan((look.cloudTilt * Math.PI) / 180), 0, 0, 0);
    put("seed", look.seed, 0, 0, 0);
    put(
      "small",
      look.smallTall,
      look.smallCrests / SPAN,
      look.smallSkew / SPAN,
      look.smallWander,
    );
    put(
      "small2",
      look.smallUnder,
      Math.max(look.smallOver, look.smallUnder + 0.1),
      look.smallPatchy,
      0,
    );
    put("rock", ...tone(look.rockTone), look.rockRough);
    // the way across a way of the light, level
    const crossing = (to: number[]) => {
      const flat = Math.hypot(to[0], to[2]);
      return flat > 1e-4 ? [to[2] / flat, -to[0] / flat] : [1, 0];
    };
    const side = crossing(sun);
    put("side", ...side, 0, 0);
    put(
      "lit",
      litAt.x,
      litAt.z,
      1 / (litAt.w * litAt.texel),
      1 / (litAt.h * litAt.texel),
    );
    put(
      "lit2",
      litAt.texel,
      look.bakeNear,
      look.baked && litAt.done ? 1 : 0,
      Math.cos(high),
    );
    world.glasses.forEach((g, i) => {
      const n: V3 = [Math.sin(g.face), 0, Math.cos(g.face)];
      const into = g.face + Math.PI;
      const o = g.door ? through(world, i, [0, 0, 0]) : [0, 0, 0];
      const off = g.door
        ? [
            sun[0] * Math.cos(into) + sun[2] * Math.sin(into),
            sun[1],
            -sun[0] * Math.sin(into) + sun[2] * Math.cos(into),
          ]
        : sum(sun, scaled(n, -2 * dot(sun, n)));
      const tall = g.h + g.ground - g.bottom;
      data.set(
        [
          g.x,
          g.bottom,
          g.z,
          g.w / 2,
          ...n,
          tall,
          ...o,
          g.door ? 1 : 0,
          Math.cos(-into),
          Math.sin(-into),
          g.door ? 1 : 0,
          0,
          ...off,
          0,
        ],
        NAMES.length * 4 + i * 20,
      );
      // the stripes it shades and lights (see glassShade in trace.wgsl): between its two ends across the
      // light's way, and as much wider as the edge of its shadow can be soft
      const ends = (across: number[]) =>
        [-1, 1].map(
          (k) =>
            (g.x + (k * Math.cos(g.face) * g.w) / 2) * across[0] +
            (g.z - (k * Math.sin(g.face) * g.w) / 2) * across[1],
        );
      const blur =
        ((tall + 12) / Math.max(sun[1], 0.02)) * Math.tan(wide) + 0.05;
      const shaded = ends(side);
      data.set(
        [Math.min(...shaded) - blur, Math.max(...shaded) + blur, 0, 0],
        (NAMES.length * 16 + GLASSES * 80) / 4 + i * 4,
      );
      const lit = ends(crossing(off));
      const blur2 = 400 * Math.tan(wide) + look.rim + 0.05;
      data.set(
        [...crossing(off), Math.min(...lit) - blur2, Math.max(...lit) + blur2],
        (NAMES.length * 16 + GLASSES * 96) / 4 + i * 4,
      );
    });
  };
  const send = () => device.queue.writeBuffer(params, 0, data);

  // the ground: its fields, the tops of its squares, and then the heights the world asks for
  let making = 0;
  const makeGround = async () => {
    const mine = ++making;
    grounding++;
    world = createWorld(look);
    still();
    send();
    padsData.fill(0);
    padsData.set([world.wide, world.pads.length, 0, 0]);
    world.pads.forEach((p, i) => padsData.set(p, 4 + i * 12));
    device.queue.writeBuffer(padsBuffer, 0, padsData);
    const encoder = device.createCommandEncoder();
    draw(
      encoder,
      [ctlA.createView(), ctlB.createView()],
      fieldsPipe,
      bind(fieldsPipe, { 0: params, 8: padsBuffer }),
    );
    draw(
      encoder,
      [ctlC.createView(), ctlD.createView()],
      slopesPipe,
      bind(slopesPipe, { 2: ctlA, 3: ctlB }),
    );
    draw(
      encoder,
      [noiseTex.createView()],
      noisyPipe,
      device.createBindGroup({
        layout: noisyPipe.getBindGroupLayout(0),
        entries: [],
      }),
    );
    draw(
      encoder,
      [tops.createView({ baseMipLevel: 0, mipLevelCount: 1 })],
      topsFirst,
      bind(topsFirst, { 0: params, 1: lin, 2: ctlA, 3: ctlB }),
    );
    for (let level = 1; level < LEVELS; level++)
      draw(
        encoder,
        [tops.createView({ baseMipLevel: level, mipLevelCount: 1 })],
        topsNext,
        bind(topsNext, {
          9: tops.createView({ baseMipLevel: level - 1, mipLevelCount: 1 }),
        }),
      );
    const pts = asks(world);
    if (pts.length / 2 > ASKS) throw new Error("too many heights asked for");
    const list = new Float32Array(ASKS * 4);
    for (let i = 0; i < pts.length / 2; i++)
      list.set([pts[2 * i], pts[2 * i + 1]], i * 4);
    device.queue.writeBuffer(asked, 0, list);
    draw(
      encoder,
      [answers.createView()],
      heightsPipe,
      bind(heightsPipe, { 0: params, 1: lin, 2: ctlA, 3: ctlB, 10: asked }),
    );
    encoder.copyTextureToBuffer({ texture: answers }, { buffer: answersOut }, [
      ASKS,
      1,
    ]);
    device.queue.submit([encoder.finish()]);
    await answersOut.mapAsync(GPUMapMode.READ);
    const got = new Float32Array(answersOut.getMappedRange().slice(0));
    answersOut.unmap();
    grounding--;
    if (mine !== making) return;
    settle(
      world,
      look,
      Array.from({ length: pts.length / 2 }, (_, i) => got[i * 4]),
    );
    still();
    // the moments of the loop at which the eye goes through a door
    let run = 0;
    state.ends = world.laps.map((l) => (run += l.length) / world.length);
    rocksData.fill(0);
    rocksData.set([world.rocks.length, Math.ceil(world.rocks.length / 8)]);
    world.rocks.forEach((k, i) => {
      rocksData.set([k.x, k.y, k.z, k.round], 36 + i * 4);
      rocksData.set([k.tone, 0.07 * k.r, k.r, 0], 36 + ROCKS * 4 + i * 4);
      rocksData.set(k.faces, 36 + ROCKS * 8 + i * 64);
    });
    // a ball round each eight of them (they come in the order that keeps neighbours together), wide enough
    // for the sand each darkens at its foot
    for (let g = 0; g * 8 < world.rocks.length; g++) {
      const of = world.rocks.slice(g * 8, g * 8 + 8);
      const mid = [0, 1, 2].map(
        (j) => of.reduce((t, k) => t + [k.x, k.y, k.z][j], 0) / of.length,
      );
      rocksData.set(
        [
          ...mid,
          Math.max(
            ...of.map(
              (k) =>
                Math.hypot(k.x - mid[0], k.y - mid[1], k.z - mid[2]) +
                1.6 * k.round,
            ),
          ),
        ],
        4 + g * 4,
      );
    }
    device.queue.writeBuffer(rocksBuffer, 0, rocksData);
    makeLight();
    state.grounds++;
  };

  // The ground the light is baked for: wherever a glass or a boulder stands, the ways, and as far from each as
  // its shadow and the sun it throws reach. Texels as small as `bakeTexels` allows.
  const makeLight = () => {
    litAt.done = false;
    litAt.rows = 0;
    if (!look.baked) return;
    still();
    const [low, high] = [
      [1e9, 1e9],
      [-1e9, -1e9],
    ];
    const add = (x: number, z: number) => {
      low[0] = Math.min(low[0], x);
      low[1] = Math.min(low[1], z);
      high[0] = Math.max(high[0], x);
      high[1] = Math.max(high[1], z);
    };
    // where something `tall` metres high darkens or lights the ground, light coming the way `to`
    const reach = (x: number, z: number, tall: number, to: number[]) => {
      const far = Math.min(250, tall / Math.max(to[1], 0.02));
      add(x - to[0] * far, z - to[2] * far);
    };
    world.glasses.forEach((g) => {
      const tall = g.h + g.ground - g.bottom + 1;
      for (const k of [-1, 1]) {
        const [x, z] = [
          g.x + (k * Math.cos(g.face) * g.w) / 2,
          g.z - (k * Math.sin(g.face) * g.w) / 2,
        ];
        add(x, z);
        reach(x, z, tall, sun);
      }
    });
    world.rocks.forEach((k) => {
      add(k.x - k.round, k.z - k.round);
      add(k.x + k.round, k.z + k.round);
      reach(k.x, k.z, 2 * k.round, sun);
    });
    for (const l of world.laps)
      for (let i = 0; i < l.x.length; i += 8) add(l.x[i], l.z[i]);
    const margin = 4;
    const [sx, sz] = [
      high[0] - low[0] + 2 * margin,
      high[1] - low[1] + 2 * margin,
    ];
    const most = device.limits.maxTextureDimension2D;
    const texel = Math.max(
      Math.sqrt((sx * sz) / (look.bakeTexels * 1e6)),
      sx / most,
      sz / most,
    );
    Object.assign(litAt, {
      x: low[0] - margin,
      z: low[1] - margin,
      w: Math.ceil(sx / texel),
      h: Math.ceil(sz / texel),
      texel,
    });
    litTex.destroy();
    litTex = picture(litAt.w, litAt.h, "rg8unorm");
    rebind = true;
    console.log(
      `mirage: light baked over ${sx.toFixed(0)} x ${sz.toFixed(0)} m, ${litAt.w} x ${litAt.h} texels of ${(texel * 100).toFixed(1)} cm`,
    );
  };
  // a band of rows of it at a time, as many as are about two million texels
  const lightBand = (encoder: GPUCommandEncoder) => {
    const n = Math.min(
      litAt.h - litAt.rows,
      Math.max(1, Math.floor(2e6 / litAt.w)),
    );
    if (!litAt.rows)
      draw(
        encoder,
        [glassSun.createView()],
        glassBakePipe,
        bind(glassBakePipe, { 0: params, 1: lin, 2: ctlA, 3: ctlB, 4: tops }),
      );
    draw(
      encoder,
      [litTex.createView()],
      lightBakePipe,
      bind(lightBakePipe, {
        0: params,
        1: lin,
        2: ctlA,
        3: ctlB,
        4: tops,
        24: rocksBuffer,
      }),
      [litAt.rows, n, litAt.w],
    );
    litAt.rows += n;
    if (litAt.rows >= litAt.h) litAt.done = true;
  };

  // the sky: the air, the clouds on it (a band of rows at a time, not to hold the frame up), and its light
  let skyRow = SKY[1];
  const makeSky = () => {
    still();
    put("bake", AIR[0], AIR[1], 0, 0);
    send();
    const encoder = device.createCommandEncoder();
    draw(
      encoder,
      [air.createView()],
      clearPipe,
      bind(clearPipe, { 0: params }),
    );
    device.queue.submit([encoder.finish()]);
    skyRow = 0;
  };
  const skyBand = (rows: number) => {
    put("bake", SKY[0], SKY[1], 0, 0);
    send();
    const encoder = device.createCommandEncoder();
    const n = Math.min(rows, SKY[1] - skyRow);
    draw(
      encoder,
      [skyTex.createView()],
      cloudsPipe,
      bind(cloudsPipe, { 0: params, 11: grain, 12: rep, 13: air, 14: skyS }),
      [skyRow, n, SKY[0]],
    );
    skyRow += n;
    if (skyRow >= SKY[1]) {
      draw(
        encoder,
        [shed.createView()],
        lightPipe,
        bind(lightPipe, { 0: params, 13: air, 14: skyS }),
      );
      state.skies++;
    }
    device.queue.submit([encoder.finish()]);
  };

  // the picture it is traced into, never more pixels than `detail` allows
  let traced: GPUTexture | null = null;
  let mended: GPUTexture | null = null;
  let glows: GPUTexture[] = [];
  let groups: {
    trace: GPUBindGroup;
    gather: GPUBindGroup;
    mend: GPUBindGroup;
    show: GPUBindGroup;
    down: GPUBindGroup[];
    up: GPUBindGroup[];
  } | null = null;
  const soft = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
  });
  const fit = () => {
    const scale = Math.min(
      1,
      Math.sqrt(
        (look.detail * state.scale * 1e6) / (canvas.width * canvas.height),
      ),
    );
    const [w, h] = [
      Math.max(8, Math.round(canvas.width * scale)),
      Math.max(8, Math.round(canvas.height * scale)),
    ];
    if (traced && traced.width === w && traced.height === h && !rebind) return;
    rebind = false;
    traced?.destroy();
    mended?.destroy();
    traced = picture(w, h, "rgba16float", 1, TEX | GPUTextureUsage.COPY_SRC);
    mended = picture(
      w,
      h,
      "rgba16float",
      1,
      GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.STORAGE_BINDING |
        GPUTextureUsage.COPY_DST,
    );
    glows.forEach((g) => g.destroy());
    glows = Array.from({ length: GLOWS }, (_, i) =>
      picture(
        Math.max(1, w >> (i + 1)),
        Math.max(1, h >> (i + 1)),
        "rgba16float",
      ),
    );
    const world = {
      0: params,
      1: lin,
      2: ctlA,
      3: ctlB,
      4: tops,
      5: skyTex,
      6: skyS,
      7: air,
      15: shed,
      16: groveTex,
      17: edgeS,
      18: noiseTex,
      19: ctlC,
      20: ctlD,
      24: rocksBuffer,
      25: tilesBuffer,
      28: listsBuffer,
      26: litTex,
      27: glassSun,
    };
    groups = {
      trace: bind(tracePipe, world),
      gather: bind(gatherPipe, { 21: traced, 22: marked }),
      mend: bind(mendPipe, { ...world, 21: traced, 22: marked, 23: mended }),
      show: bind(showPipe, { 0: shown, 1: mended, 2: soft, 3: glows[0] }),
      down: glows.map((_, i) =>
        bind(downPipe, { 1: i ? glows[i - 1] : mended!, 2: soft }),
      ),
      up: glows.map((g) => bind(upPipe, { 0: shown, 1: g, 2: soft })),
    };
  };

  // where the eye is, and how it looks, at a moment of the loop
  const speed = () => world.length / LOOP;
  const pose = (playhead: number) => {
    const [k, s] = where(world, playhead);
    const eye = along(world, k, s);
    const aim = along(world, k, s + look.ahead);
    let fore = unit(sum(aim, scaled(eye, -1)));
    fore = unit([fore[0], fore[1] - look.pitch, fore[2]]);
    // leaning into a turn, by how fast the way ahead is turning
    const heading = (a: number, b: number) => {
      const [p, q] = [along(world, k, s + a), along(world, k, s + b)];
      return Math.atan2(q[0] - p[0], q[2] - p[2]);
    };
    let turning = heading(4, 14) - heading(-6, 4);
    turning = Math.atan2(Math.sin(turning), Math.cos(turning)) / 10;
    const roll = Math.max(
      -0.4,
      Math.min(0.4, turning * speed() ** 2 * 0.1 * look.bank),
    );
    const flatRight = unit(cross([0, 1, 0], fore));
    const right = unit(
      sum(scaled(flatRight, Math.cos(roll)), [0, -Math.sin(roll), 0]),
    );
    const up = cross(fore, right);
    const [a, b] = [along(world, k, s - 0.5), along(world, k, s + 0.5)];
    const vel = scaled(sum(b, scaled(a, -1)), speed());
    return { eye, fore, right, up, vel, lap: k, s };
  };

  // Looking about while flying. A drag turns the eye off the way, the picture following the hand (drag right and
  // what was on the left comes into view), within `lookWide` either side and `lookUp` / `lookDown`; let go and
  // after a moment it eases back. Only the eye's look turns: it flies on along the way, and through the doors
  // as before. A held moment, a film and the tools see the way as it is.
  const gaze = { yaw: 0, pitch: 0, aimYaw: 0, aimPitch: 0, held: -1, x: 0, y: 0, let: 0, at: 0 };
  canvas.style.cursor = "grab";
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", (e) => {
    if (gaze.held >= 0) return;
    gaze.held = e.pointerId;
    [gaze.x, gaze.y] = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId !== gaze.held) return;
    // (an angle a pixel: the picture's height is `fov`, so the ground under the hand stays under it)
    const k = (look.fov * Math.PI) / 180 / canvas.clientHeight;
    const rad = Math.PI / 180;
    gaze.aimYaw -= (e.clientX - gaze.x) * k;
    gaze.aimPitch += (e.clientY - gaze.y) * k;
    gaze.aimYaw = Math.max(-look.lookWide * rad, Math.min(look.lookWide * rad, gaze.aimYaw));
    gaze.aimPitch = Math.max(-look.lookDown * rad, Math.min(look.lookUp * rad, gaze.aimPitch));
    [gaze.x, gaze.y] = [e.clientX, e.clientY];
  });
  const letGo = (e: PointerEvent) => {
    if (e.pointerId !== gaze.held) return;
    gaze.held = -1;
    gaze.let = performance.now();
    canvas.style.cursor = "grab";
  };
  canvas.addEventListener("pointerup", letGo);
  canvas.addEventListener("pointercancel", letGo);
  // where the look is now: it follows the hand a little behind (no jerks from a jerky mouse), and once let go
  // for half a second the aim goes back to the way ahead
  const gazeNow = (now: number) => {
    const dt = Math.min(0.1, Math.max(0, (now - (gaze.at || now)) / 1000));
    gaze.at = now;
    if (gaze.held < 0 && now - gaze.let > 500) {
      const back = Math.exp(-dt / Math.max(0.05, look.lookBack / 3));
      gaze.aimYaw *= back;
      gaze.aimPitch *= back;
    }
    const follow = 1 - Math.exp(-dt / 0.09);
    gaze.yaw += (gaze.aimYaw - gaze.yaw) * follow;
    gaze.pitch += (gaze.aimPitch - gaze.pitch) * follow;
  };
  // the eye of `pose`, turned by the look: about the upright first (toward its right), then up
  const turned = <P extends { fore: V3; right: V3; up: V3 }>(p: P): P => {
    if (Math.abs(gaze.yaw) < 1e-5 && Math.abs(gaze.pitch) < 1e-5) return p;
    const aboutUp = (v: V3, a: number): V3 => {
      const [c, s] = [Math.cos(a), Math.sin(a)];
      // (Rodrigues about (0, 1, 0); a turn of +a takes the way ahead toward the right, as `right` lies)
      return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
    };
    const side = Math.sign(dot(aboutUp(p.fore, 0.01), p.right)) || 1;
    let [fore, right, up] = [p.fore, p.right, p.up].map((v) => aboutUp(v, gaze.yaw * side));
    const [c, s] = [Math.cos(gaze.pitch), Math.sin(gaze.pitch)];
    [fore, up] = [unit(sum(scaled(fore, c), scaled(up, s))), unit(sum(scaled(up, c), scaled(fore, -s)))];
    return { ...p, fore, right, up };
  };

  // Which glasses and boulders can show in each tile of the screen, a bit each, for trace.wgsl: each is in a
  // ball, a ball is seen as a round patch, and the tiles that patch's box touches get the bit.
  const tile = (
    eye: { eye: V3; fore: V3; right: V3; up: V3 },
    tanH: number,
    aspect: number,
  ) => {
    const [tx, ty] = TILES;
    tilesData.fill(0);
    const widest = Math.atan(tanH * Math.hypot(1, aspect)); // from the middle of the view to its corner
    const mark = (c: number[], r: number, word: number, bit: number) => {
      const d = sum(c, scaled(eye.eye, -1));
      const far = Math.hypot(d[0], d[1], d[2]);
      let box = [0, tx - 1, 0, ty - 1];
      if (far > r * 1.05) {
        const wide = Math.asin(r / far);
        const axis = scaled(d, 1 / far);
        const off = Math.acos(Math.max(-1, Math.min(1, dot(axis, eye.fore))));
        if (off - wide > widest + 0.03) return; // out of the view
        if (off + wide < 1.4) {
          const e1 = unit(
            cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]),
          );
          const e2 = cross(axis, e1);
          const [low, high] = [
            [1e9, 1e9],
            [-1e9, -1e9],
          ];
          for (let k = 0; k < 16; k++) {
            const a = (k / 16) * 2 * Math.PI;
            const v = sum(
              scaled(axis, Math.cos(wide)),
              scaled(e1, Math.sin(wide) * Math.cos(a)),
              scaled(e2, Math.sin(wide) * Math.sin(a)),
            );
            const p = [
              dot(v, eye.right) / dot(v, eye.fore) / (tanH * aspect),
              -dot(v, eye.up) / dot(v, eye.fore) / tanH,
            ];
            for (const j of [0, 1]) {
              low[j] = Math.min(low[j], p[j]);
              high[j] = Math.max(high[j], p[j]);
            }
          }
          // (the box of sixteen points of its rim, and a little over for the rim between them and a pixel more)
          const grown = [0, 1].map((j) => {
            const [mid, half] = [
              (low[j] + high[j]) / 2,
              ((high[j] - low[j]) / 2) * 1.03 + 0.01,
            ];
            return [mid - half, mid + half].map((v) =>
              Math.floor(((v + 1) / 2) * [tx, ty][j]),
            );
          });
          box = [grown[0][0], grown[0][1], grown[1][0], grown[1][1]];
          if (box[0] >= tx || box[1] < 0 || box[2] >= ty || box[3] < 0) return;
        }
      }
      for (let y = Math.max(0, box[2]); y <= Math.min(ty - 1, box[3]); y++)
        for (let x = Math.max(0, box[0]); x <= Math.min(tx - 1, box[1]); x++)
          tilesData[(y * tx + x) * 4 + word] |= 1 << bit;
    };
    world.glasses.forEach((g, i) => {
      const tall = g.h + g.ground - g.bottom;
      mark(
        [g.x, g.bottom + tall / 2, g.z],
        Math.hypot(g.w / 2, tall / 2) * 1.03 + 0.05,
        i >> 5,
        i & 31,
      );
    });
    world.rocks.forEach((k, i) =>
      mark([k.x, k.y, k.z], k.round * 1.03 + 0.02, 2 + (i >> 5), i & 31),
    );
    device.queue.writeBuffer(tilesBuffer, 0, tilesData);
    reflections(eye.eye, (2 * tanH) / traced!.height);
  };

  // What a ray can meet once off each glass (Lists in trace.wgsl). Every glass and boulder is taken as a ball
  // round it; what is kept is every ball that is not wholly out of a view: the view of a glass from where the
  // eye's image in it is (or from where it takes the eye, a door), or all on one side of it.
  const sub = (a: number[], b: number[]) =>
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]] as V3;
  const reflections = (at: V3, pixel: number) => {
    listsData.fill(0);
    const near = (pixel * look.edgeWide) / 0.08;
    const balls: {
      c: number[];
      r: number;
      word: number;
      bit: number;
      glass: number;
    }[] = [];
    world.glasses.forEach((g, i) => {
      const tall = g.h + g.ground - g.bottom;
      balls.push({
        c: [g.x, g.bottom + tall / 2, g.z],
        r: Math.hypot(g.w / 2, tall / 2) * 1.03 + 0.05,
        word: i >> 5,
        bit: i & 31,
        glass: i,
      });
    });
    world.rocks.forEach((k, i) =>
      balls.push({
        c: [k.x, k.y, k.z],
        r: k.round * 1.03 + 0.02,
        word: 2 + (i >> 5),
        bit: i & 31,
        glass: -1,
      }),
    );
    // the balls on the side of a plane through `o` that `n` points to, and (given an apex and the four corners
    // of a glass) within the four planes from the apex through its edges, but for glass `skip`
    const keep = (
      at: number,
      o: number[],
      n: number[],
      skip: number,
      apex?: number[],
      quad?: number[][],
    ) => {
      let planes: number[][] = [];
      if (apex && quad) {
        const mid = scaled(sum(...quad), 1 / 4);
        planes = quad.map((q, k) => {
          let m = cross(sub(q, apex), sub(quad[(k + 1) % 4], apex));
          if (dot(m, sub(mid, apex)) < 0) m = scaled(m, -1);
          return unit(m);
        });
      }
      for (const b of balls) {
        // (and a ball a little bigger the further it is: a ray that passes near enough an edge marks its pixel
        // for more rays, near enough being, at the most, 12.5 pixels at that distance; see `trace`)
        const r = b.r + Math.hypot(...sub(b.c, apex ?? o)) * near + 0.02;
        if ((b.glass >= 0 && b.glass === skip) || dot(sub(b.c, o), n) < -r)
          continue;
        if (apex && planes.some((m) => dot(sub(b.c, apex), m) < -r)) continue;
        listsData[at + b.word] |= 1 << b.bit;
      }
    };
    world.glasses.forEach((g, i) => {
      const tall = g.h + g.ground - g.bottom;
      const n: V3 = [Math.sin(g.face), 0, Math.cos(g.face)];
      const along: V3 = [Math.cos(g.face), 0, -Math.sin(g.face)];
      const c: V3 = [g.x, g.bottom, g.z];
      const quad = [
        [-1, 0],
        [1, 0],
        [1, 1],
        [-1, 1],
      ].map(([u, v]) => sum(c, scaled(along, (u * g.w) / 2), [0, v * tall, 0]));
      // a door, gone through: where it takes a point, and a way
      const to = (p: number[]) => through(world, i, p as V3);
      const way = (v: number[]) => sub(to(sum(c, v)), to(c));
      // ahead of it, or in front (sides[2i]), and behind (sides[2i + 1])
      if (g.door) keep(GLASSES * 4 + i * 8, to(c), way(scaled(n, -1)), -1);
      else keep(GLASSES * 4 + i * 8, c, n, i);
      keep(GLASSES * 4 + i * 8 + 4, c, scaled(n, -1), i);
      // and as the eye sees it, from where it is
      const off = dot(sub(at, c), n);
      if (Math.abs(off) < 0.02) {
        listsData.set(
          listsData.slice(
            GLASSES * 4 + i * 8 + (off > 0 ? 0 : 4),
            GLASSES * 4 + i * 8 + (off > 0 ? 4 : 8),
          ),
          i * 4,
        );
      } else if (g.door && off > 0) {
        keep(i * 4, to(c), way(scaled(n, -1)), -1, to(at), quad.map(to));
      } else {
        const side = scaled(n, Math.sign(off));
        keep(i * 4, c, side, i, sub(at, scaled(n, 2 * off)), quad);
      }
    });
    device.queue.writeBuffer(listsBuffer, 0, listsData);
  };

  // --- the controls
  const gui = new GUI();
  gui.close();
  let regroundSoon = 0;
  for (const [name, keys] of Object.entries(folders)) {
    const folder = gui.addFolder(name);
    folder.close();
    for (const key of keys) {
      const r = ranges[key];
      const c =
        key === "view"
          ? folder.add(look, "view", ["fly", "map", "sky"])
          : key === "fpsCap"
            ? folder.add(look, "fpsCap", [0, 30, 60, 120])
            : typeof (look as any)[key] === "string"
              ? folder.addColor(look, key as any)
              : folder.add(look, key as any, r?.[0], r?.[1], r?.[2]);
      c.onChange(() => changed(key));
    }
  }
  const changed = (key: string) => {
    if (reground.has(key)) {
      clearTimeout(regroundSoon);
      regroundSoon = window.setTimeout(() => makeGround(), 150);
    }
    if (resky.has(key)) makeSky();
    // (the light on the ground is made again with the ground, and when the sun or the glass changes)
    if (
      !reground.has(key) &&
      [
        "sunTurn",
        "sunHigh",
        "sunWide",
        "rim",
        "silver",
        "baked",
        "bakeTexels",
      ].includes(key)
    )
      makeLight();
  };
  const stats = new Stats();
  document.body.appendChild(stats.dom);

  // a plan of it all, drawn over the map view
  const plan = document.createElement("canvas");
  plan.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;display:none";
  document.body.appendChild(plan);
  const drawPlan = (at: number[]) => {
    plan.style.display = look.view === "map" ? "block" : "none";
    if (look.view !== "map") return;
    plan.width = canvas.width;
    plan.height = canvas.height;
    const c = plan.getContext("2d")!;
    const scale = canvas.height / (2 * look.mapSpan);
    const xy = (x: number, z: number) =>
      [
        canvas.width / 2 + (x - look.mapX) * scale,
        canvas.height / 2 - (z - look.mapZ) * scale,
      ] as const;
    c.lineWidth = 2;
    world.laps.forEach((l, k) => {
      c.strokeStyle = ["#fff", "#8cf", "#fc8"][k % 3];
      c.beginPath();
      for (let i = 0; i < l.x.length; i += 8) c.lineTo(...xy(l.x[i], l.z[i]));
      c.stroke();
    });
    for (const g of world.glasses) {
      const [ax, az] = [
        (Math.cos(g.face) * g.w) / 2,
        (-Math.sin(g.face) * g.w) / 2,
      ];
      c.strokeStyle = g.door ? "#f33" : "#000";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(...xy(g.x - ax, g.z - az));
      c.lineTo(...xy(g.x + ax, g.z + az));
      c.stroke();
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(...xy(g.x, g.z));
      c.lineTo(...xy(g.x + Math.sin(g.face) * 4, g.z + Math.cos(g.face) * 4));
      c.stroke();
    }
    c.strokeStyle = "#840";
    c.lineWidth = 2;
    for (const k of world.rocks) {
      c.beginPath();
      c.arc(...xy(k.x, k.z), Math.max(2, k.r * scale), 0, 7);
      c.stroke();
    }
    c.fillStyle = "#0f0";
    c.beginPath();
    c.arc(...xy(at[0], at[2]), 5, 0, 7);
    c.fill();
  };

  await makeGround();
  makeSky();
  state.ready = true;
  (window as any).__mirage = {
    look,
    state,
    world: () => world,
    pose,
    changed,
    makeGround,
    makeSky,
    device,
    bench: (n: number, ph: number, whole?: boolean) => bench(n, ph, whole),
    groundGrid: (x0: number, z0: number, nx: number, nz: number, texel: number) => groundGrid(x0, z0, nx, nz, texel),
    skyPicture: () => skyPicture(),
  };

  // Frames at a steady pace. A screen that asks for 120 a second gets every other one, when the GPU could do
  // 70 or 90 but not 120: a frame now one refresh late and now two looks worse than every frame two late. And
  // when even the cap is too many, the frames coming late are counted, and the pixels traced are cut back
  // until they come in time; then let back up, more slowly, and never again to where they last came late for
  // a while. Not while a film is made, or a moment is held, or the ground or the sky or the light is being made.
  let shownAt = 0;
  const pacing = {
    late: 0,
    kept: 0,
    quiet: 0,
    ceiling: 1,
    ceilingUntil: 0,
    raisedAt: 0,
  };
  const pace = (now: number, recording: boolean) => {
    const gap = now - shownAt;
    const free = recording || state.hold !== null || !look.fpsCap;
    if (!free && gap < 1000 / look.fpsCap - 2.5) return false;
    shownAt = now;
    // (a film, a held moment and a frame with nothing to keep pace with are all of them traced in full)
    if (free || !look.adapt) state.scale = 1;
    if (free || !look.adapt || state.busy || gap > 250) return true;
    if (gap > (1000 / look.fpsCap) * 1.4) pacing.late++;
    else pacing.kept++;
    if (pacing.late + pacing.kept < 30) return true;
    const late = pacing.late / (pacing.late + pacing.kept);
    pacing.late = pacing.kept = 0;
    if (late > 0.15) {
      // (and if it was only just let up, not that far again for half a minute)
      if (now - pacing.raisedAt < 2000) {
        pacing.ceiling = state.scale * 0.97;
        pacing.ceilingUntil = now + 30000;
      }
      state.scale = Math.max(0.3, state.scale * (late > 0.5 ? 0.75 : 0.87));
      pacing.quiet = 0;
    } else if (late === 0 && ++pacing.quiet >= 3 && state.scale < 1) {
      const top = now < pacing.ceilingUntil ? pacing.ceiling : 1;
      if (state.scale * 1.1 <= top || (top === 1 && state.scale > 0.92)) {
        state.scale = Math.min(1, state.scale * 1.1);
        pacing.raisedAt = now;
      }
      pacing.quiet = 0;
    }
    return true;
  };

  const loader = document.getElementById("loader");
  wrap.render = ({ playhead, recording }) => {
    if (!state.ready) return;
    if (!pace(performance.now(), recording)) return;
    fit();
    // (the sky in a few frames; a screenshot waits for `skies`)
    if (skyRow < SKY[1]) skyBand(96);
    if (!state.skies) return; // nothing to show until there is a first sky
    state.busy =
      grounding +
      (skyRow < SKY[1] ? 1 : 0) +
      (look.baked && !litAt.done ? 1 : 0);
    if (benching) return;
    const free = state.hold === null && !recording;
    if (free) gazeNow(performance.now());
    const eye = frame(
      state.hold ?? playhead,
      context.getCurrentTexture().createView(),
      true,
      true,
      free,
    );
    drawPlan(eye.eye);
    stats.update();
    state.frame++;
    // the loader goes when a picture is on the screen, not when it has been asked for: the first one has every
    // shader to build, and the frames come back from here long before the GPU has drawn them
    if (state.frame === 3 && loader && !loader.classList.contains("done"))
      device.queue.onSubmittedWorkDone().then(() => loader.classList.add("done"));
  };

  // One frame, onto `to`: the trace and, unless `whole` is false, the edges, the glow and the showing.
  const frame = (
    ph: number,
    to: GPUTextureView,
    whole: boolean,
    timed: boolean,
    looking = false,
  ) => {
    const eye = looking ? turned(pose(ph)) : pose(ph);
    const [w, h] = [traced!.width, traced!.height];
    const tanH = Math.tan((look.fov * Math.PI) / 360);
    still();
    put("size", w, h, state.frame, ph);
    put("eye", ...eye.eye, tanH);
    put("right", ...scaled(eye.right, (tanH * w) / h), 0);
    const map = look.view === "map";
    put(
      "up",
      ...scaled(eye.up, tanH),
      map ? (2 * look.mapSpan) / h / 300 : (2 * tanH) / h,
    );
    put("fore", ...eye.fore, 0);
    put("vel", ...scaled(eye.vel, 1 / 60), 0);
    put("tune", look.exposure, look.edges, look.bounces, look.bright);
    put("edge", look.edgeWide, look.edgeRays, look.tiles ? 0 : 1, look.cutoff);
    tile(eye, tanH, w / h);
    put(
      "map",
      look.mapX,
      look.mapZ,
      look.mapSpan,
      map ? 1 : look.view === "sky" ? 2 : 0,
    );
    send();
    device.queue.writeBuffer(
      shown,
      0,
      new Float32Array([
        canvas.width,
        canvas.height,
        look.exposure,
        look.grain,
        Math.floor(ph * LOOP * 60) % 997,
        look.vignette,
        look.glow,
        look.colour,
        ...tone(look.cast),
        look.spread,
        look.dusk,
        0,
        0,
        0,
      ]),
    );
    const encoder = device.createCommandEncoder();
    // (the light on the ground in a few frames, like the sky; until it is all there it is worked out afresh)
    if (look.baked && !litAt.done) lightBand(encoder);
    {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          { view: traced!.createView(), loadOp: "clear", storeOp: "store" },
        ],
        timestampWrites:
          stamps && timed
            ? {
                querySet: stamps,
                beginningOfPassWriteIndex: 0,
                endOfPassWriteIndex: 1,
              }
            : undefined,
      });
      pass.setPipeline(tracePipe);
      pass.setBindGroup(0, groups!.trace);
      pass.draw(3);
      pass.end();
    }
    // the picture as traced, then the marked pixels done again with more rays
    encoder.copyTextureToTexture({ texture: traced! }, { texture: mended! }, [
      w,
      h,
    ]);
    if (look.edges === 1 && whole) {
      encoder.clearBuffer(marked, 0, 4);
      const pass = encoder.beginComputePass();
      pass.setPipeline(gatherPipe);
      pass.setBindGroup(0, groups!.gather);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.setPipeline(mendPipe);
      pass.setBindGroup(0, groups!.mend);
      pass.dispatchWorkgroups(MARKS / 64);
      pass.end();
    }
    for (let i = 0; i < GLOWS && whole; i++)
      draw(encoder, [glows[i].createView()], downPipe, groups!.down[i]);
    for (let i = GLOWS - 1; i > 0 && whole; i--) {
      const pass = encoder.beginRenderPass({
        colorAttachments: [
          { view: glows[i - 1].createView(), loadOp: "load", storeOp: "store" },
        ],
      });
      pass.setPipeline(upPipe);
      pass.setBindGroup(0, groups!.up[i]);
      pass.draw(3);
      pass.end();
    }
    if (whole) draw(encoder, [to], showPipe, groups!.show);
    const ask = stamps && !reading && timed;
    if (ask) {
      encoder.resolveQuerySet(stamps, 0, 2, stampsOut, 0);
      encoder.copyBufferToBuffer(stampsOut, 0, stampsRead, 0, 16);
    }
    device.queue.submit([encoder.finish()]);
    if (ask) {
      reading = true;
      stampsRead.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigInt64Array(stampsRead.getMappedRange());
        const ms = Number(t[1] - t[0]) / 1e6;
        if (ms > 0 && ms < 5000) state.ms += (ms - state.ms) * 0.2;
        stampsRead.unmap();
        reading = false;
      });
    }
    return eye;
  };

  // For taking the world elsewhere: the ground's height on a grid (nx by nz points `texel` metres apart from
  // x0, z0; row by row along z), and the sky's picture as it is kept (4096 x 1536 half floats, rgba).
  const regionBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const readBack = async (tex: GPUTexture, w: number, h: number, bytes: number) => {
    const row = Math.ceil((w * bytes) / 256) * 256;
    const out = device.createBuffer({ size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    encoder.copyTextureToBuffer({ texture: tex }, { buffer: out, bytesPerRow: row }, [w, h]);
    device.queue.submit([encoder.finish()]);
    await out.mapAsync(GPUMapMode.READ);
    const all = new Uint8Array(out.getMappedRange());
    const packed = new Uint8Array(w * bytes * h);
    for (let y = 0; y < h; y++) packed.set(all.subarray(y * row, y * row + w * bytes), y * w * bytes);
    out.unmap();
    out.destroy();
    return packed;
  };
  const groundGrid = async (x0: number, z0: number, nx: number, nz: number, texel: number) => {
    device.queue.writeBuffer(regionBuffer, 0, new Float32Array([x0, z0, texel, 0]));
    const tex = device.createTexture({ size: [nx, nz], format: "r32float", usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
    const encoder = device.createCommandEncoder();
    draw(encoder, [tex.createView()], gridPipe, bind(gridPipe, { 0: params, 1: lin, 2: ctlA, 3: ctlB, 11: regionBuffer }));
    device.queue.submit([encoder.finish()]);
    const bytes = await readBack(tex, nx, nz, 4);
    tex.destroy();
    // (as base64, to get it out of the page)
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  };
  const skyPicture = async () => {
    const bytes = await readBack(skyTex, SKY[0], SKY[1], 8);
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  };

  // How long the GPU takes over a frame, in milliseconds: `n` frames at one moment, given it all at once so that
  // it is busy throughout (a GPU given one light frame at a time runs slowly, and its own clocks read long), and
  // the time until it has done them shared out. `whole` false: the trace alone.
  let benching = false;
  const bench = async (n: number, ph: number, whole = true) => {
    benching = true;
    state.scale = 1;
    fit();
    const off = picture(canvas.width, canvas.height, format);
    const go = (k: number) => {
      for (let i = 0; i < k; i++) frame(ph, off.createView(), whole, false);
    };
    await device.queue.onSubmittedWorkDone();
    go(8);
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    go(n);
    await device.queue.onSubmittedWorkDone();
    const ms = (performance.now() - t0) / n;
    off.destroy();
    benching = false;
    return ms;
  };

  wrap.resize = () => fit();

  wrap.unload = () => {
    gui.destroy();
    stats.dom.remove();
    plan.remove();
    device.destroy();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: LOOP * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
