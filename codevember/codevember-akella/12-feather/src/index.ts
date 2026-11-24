import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TSL from "three/tsl";
import { BackSide, Color, Mesh, MeshBasicNodeMaterial, NoToneMapping, Object3D, PerspectiveCamera, RenderPipeline, Scene, SphereGeometry, Spherical, TextureLoader, Vector2, Vector3, WebGPURenderer } from "three/webgpu";
import { createHeron, motion } from "./heron.ts";
import { createCel, DEPTH_SCALE, low, PART, type N } from "./shade.ts";
import { createShed, fall } from "./shed.ts";
import { ARRIVE, createStory, shows, tale } from "./story.ts";
import { createSky } from "./sky.ts";
import { ABOVE, createWater, SEA_PERIOD } from "./water.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { abs, dot, exp, float, floor, Fn, fract, length, max, mix, mrt, normalize, output, pass, positionLocal, sin, smoothstep, step, uniform, uv, vec2, vec3, vec4 } = T;

export const look = {
  beats: 10, // wingbeats in the loop
  drawnOn: 0, // poses per second, as an animator would draw them (12 = "on twos"); 0 = every frame
  wave: 0.16, // the beat runs down the V as a wave: how much of a beat each bird is behind the one ahead of it (0: all together)
  still: 0.1, // the glide goes down the V as well: how much later each bird glides than the one ahead of it, as a share of the loop (0: all at once)
  ragged: 0.15, // how much each bird keeps to its own time instead, in its beat and in when it glides (1, with wave 0, is every bird to itself)
  glide: 0.22, // share of the loop a bird spends riding the air instead of beating (when its place allows)
  nearer: 0.4, // how much larger the birds at the back of the long arm (the nearest) are drawn, and the furthest smaller: 0.3 = 30% either way
  bank: 0.35, // the V rolled about its line of flight, metres of height per metre towards the viewer: seen from the side it opens out
  shed: 0, // feathers let go in a loop that only fall. None by default: here every feather becomes a bird
  // the cel
  fill: "#f3ecdb", // the body: warm ivory
  wing: "#e6e6e6", // wings and tail
  under: "#b4c8e8", // whatever faces down: pale blue
  underWing: 0.15, // how much of that the underside of a wing takes: little, since from the water it is mostly undersides that are seen
  pale: "#2e333d", // the flight feathers towards their tips: charcoal
  cap: "#0d111a", // the dark streak over the eye and the plume behind it
  ink: "#22407f",
  outlineColor: "#101c44", // the contour round each bird: dark navy
  edgeLight: 0.35, // how much of the contour is left along an edge that faces the sun and the sky; underneath it is whole
  rim: 2.2, // width of the bright edge a bird has towards the sun, same units as the lines; 0 for none
  rimFeather: 0.3, // and how much of that width a loose feather gets: it is too slight a thing for the whole of it
  rimTone: "#ffffff",
  // distance: a bird far off sinks into the air, and its contour thins
  haze: 0.55, // how far it goes towards hazeTone
  hazeTone: "#6f9be4",
  hazeFrom: 7, // metres from the eye where that begins
  hazeTo: 24, // and where it is complete
  outlineOnCloud: "#22407f", // and what it turns to over a bright ground, where the first would be lost
  outlineAdapts: 0, // how far it turns: 0 keeps the one colour everywhere
  line: 1.4, // ink stroke width, pixels at 800 px of height
  strokes: 0.42, // how many feathers get a stroke
  outline: 1.3, // width of the contour, same units
  seams: 1, // the contour also goes round a part of the bird that passes in front of another
  seamGap: 0.07, // and only if they are at least this far apart in depth, metres
  boil: 6, // times a second the lines are "redrawn"
  wobble: 1.4, // how far a redrawn line strays, pixels
  // the print
  fringe: 0, // colours pulled apart, pixels at the frame's edge. These three are off: a clean picture
  grain: 0,
  vignette: 0,
  // sky
  zenith: "#0232a9", // (matched to the top of the painted sky)
  horizon: "#5f9ee6",
  cloudLight: "#ffffff",
  cloudMid: "#cfe4fb",
  cloudShade: "#7fb0ec",
  cloud: 0.5, // how much cumulus, while it is made here and not painted
  paintWide: 58, // degrees of horizon that a painted sky (public/sky.png) covers: larger makes its clouds larger. The frame is about 52 wide; any narrower and the mirrored edges show
  paintTurn: -20, // and how far its middle is turned from straight behind the flock
  // the sun, placed in the frame: degrees right of where the camera looks, and above the horizon
  sun: "#fffdf0",
  sunRight: 19,
  sunUp: 20,
  // a painted sun (public/sun.png: light on black, the sun in the middle of a square) replaces the drawn one
  sunWide: 46, // degrees of sky its square covers
  sunGain: 0.67, // how bright it is laid on
  sunRock: 4, // it cannot turn for ever as the drawn rays do (it is not alike all the way round): it rocks, degrees either way
  sunBreath: 0.04, // and swells and shrinks by this share, twice a loop
  glare: 0.37, // how much of it lies over whatever passes in front
  glareWide: 0.13, // and how far that reaches, in frame heights
  // the sea
  sea: "#0a2f9e",
  seaDepth: 0.16, // how much of its own colour shows through the mirror, far off
  seaNear: 0.5, // and close to
  sway: 0.035, // how far the swell slips a strip of the reflection sideways
  seaDashes: 0.5, // the painted dashes of light and shadow on it
  seaLight: "#cfe6ff", // the light ones
  glitter: 0.9, // how they crowd and brighten under the sun
  seaHaze: 0.3, // how far it pales towards the horizon
  seaBirds: 1, // how far the birds are brought down in the sea's picture so that it shows them (0: where they are, which from here is out of the frame)
  seaSkim: 0.02, // the height they are brought down to, metres over the water
  seaKeep: 0.02, // and how much of each one's own height is left on top of that
  seaBirdsSize: 0.75, // how large they are drawn there, of their size
  seaBirdsFar: 15, // only those nearer the eye than this are drawn there, metres (the flock is 10 to 17 away, those coming and going up to 33)
  seaBirdsDim: 0, // how far they are sunk into the sea's colour
  swell: 2, // whole lengths of sea (24 m each) that slide back in a loop
  // the camera stays put, low over the water. It can be let drift, but the story is composed for where it stands
  framing: "low horizon, V banked", // which of FRAMINGS: where it stands and looks, with the sun and the roll of the V that suit it
  drift: false,
  driftAzimuth: 6,
  driftElevation: 2,
};

// The places in the V, along one line: -1 is the short arm, 0 the point, 1 to 4 the long arm. Everything
// about a bird that is not the same for all of them (where it is, never quite on the line; its size; where in
// its wingbeat it is; when it glides) belongs to the place, and a bird moving from one place to the next
// takes on the next one's by degrees.
const PLACES = [
  { at: [-1.2, 0.05, -1.4], size: 0.96, phase: 2.1, glide: 0.86 },
  { at: [0, 0, 0], size: 1, phase: 0, glide: 0.4 },
  { at: [-1.1, 0.1, 1.3], size: 1.02, phase: 4.4, glide: 0.62 },
  { at: [-2.4, 0.0, 2.8], size: 0.95, phase: 1.0, glide: 0.72 },
  { at: [-3.45, 0.2, 4.05], size: 1.0, phase: 5.3, glide: 0.55 },
  { at: [-4.75, 0.1, 5.5], size: 0.97, phase: 3.2, glide: 0.8 },
];

// Framings to choose between: where the camera stands (eye) and what it looks at (aim), and the sun and the roll
// of the V that go with it. The eye is always just over the water; what changes is how far it tips up, how
// near it is, and which side of the flock it is on.
const FRAMINGS: Record<string, { eye: [number, number, number]; aim: [number, number, number]; sunRight: number; sunUp: number; bank: number; seaBirds: number }> = {
  level: { eye: [0.299, -2.301, 14.026], aim: [-2.3, -2.41, 1.8], sunRight: 19, sunUp: 11.5, bank: 0, seaBirds: 0 }, // horizon across the middle, half the frame is sea, which shows the birds in it as it is
  "low horizon": { eye: [0.299, -2.301, 14.026], aim: [-2.3, 0.1, 1.8], sunRight: 19, sunUp: 20, bank: 0, seaBirds: 1 }, // the same place, looking up: a strip of sea
  "low horizon, V banked": { eye: [0.299, -2.301, 14.026], aim: [-2.3, 0.3, 1.8], sunRight: 19, sunUp: 20, bank: 0.35, seaBirds: 1 }, // and the flock opened out over the sky
  "close, from under": { eye: [0.5, -2.5, 10], aim: [-2.3, 0.2, 1.8], sunRight: 15, sunUp: 17, bank: 0, seaBirds: 1 }, // large birds, no sea to speak of
  "from behind": { eye: [-9, -2.4, 11], aim: [-1.5, 0.2, 1.5], sunRight: 12, sunUp: 17.5, bank: 0, seaBirds: 1 }, // over the shoulder, flying off into the sun
};

const FOV = 34;
const WATER = -2.8; // the sea, this far under the flock: low enough to see them in it, high enough that a feather has room to fall
const LOOP = 12; // seconds
const GLIDES = 0.55; // how far into the loop the bird at the point is in the middle of its glide, when the flock keeps time
const EVERY = 4; // seconds between one bird and the next on the same arm: each moves up one place in that time
const AHEAD = [0.972, 0.126, -0.2]; // which way a bird flies off from the point: forward, a little up, towards the sun
const GONE = 17; // metres ahead of the point at which it is out of sight
// how far a bird has gone, in metres, r spans of EVERY after it starts to pull away: at the arm's own pace
// at first, then faster and faster
const run = (r: number) => 1.8 * r + 2.7 * Math.pow(r, 2.5);

// The loop: the flock is a steady stream, and nothing in it waits for anything else. A bird joins at the back
// of an arm, slides up it at an even pace, quickens as it nears the point, rounds it and flies off ahead
// into the sun; four seconds behind it comes the next on the same arm, and two seconds behind it the next
// on the other arm, so they go through the point by turns. The long arm holds four birds on their way up;
// on the short arm a bird sets off for the point as soon as it has joined.
//
// Each bird began as a feather: when it is let go, which place's bird lets it go, which arm its bird joins,
// and which way it swings first. They go two seconds apart and each takes 11.4 s to become a bird at the
// back of its arm, so five or six are always under way.
// Only the three birds on the long arm are ever in a place to let one go, and a bird moves up a place in four
// seconds: so two places are asked by turns, and each bird lets go two, six seconds apart, one a third of the
// way up the arm (near place 3) and one just before it leaves for the point (near place 1). Asked otherwise
// (3, 2, 2, ...), the same bird is the nearest four times running and is seen to shed feather after feather.
// (Places 3 and 2 by turns also give two each, but then every other feather turns into its bird at the very
// edge of the frame.)
const FEATHERS = Array.from({ length: 6 }, (_, k) => ({ born: 0.4 + 2 * k, arm: k % 2 ? -1 : 1, source: [3, 1, 3, 1, 3, 1][k], way: [1, 1, -1, 1, 1, -1][k] }));
// A bird's whole life (feather, up the arm, round the point, gone) is longer than the loop, so each life
// ("line") is lived by several birds at once, twelve seconds apart: the newest is a feather, the next is in
// the arm, the oldest is leaving. At the end of the loop each has become exactly what the next one was at the
// start, which is how it closes. `steps`: the places it moves up before it starts to pull away.
const LINES = FEATHERS.map((f) => {
  const steps = f.arm > 0 ? 3 : 0;
  let r = 0;
  while (run(r) < GONE + 2) r += 0.01;
  const ends = ARRIVE + 1 + (steps + r - 1 / EVERY) * EVERY; // its age when it is out of sight
  return { ...f, steps, copies: Math.ceil(ends / LOOP) };
});

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

  const scene = new Scene();
  const cel = createCel();
  const flock = LINES.flatMap((line, l) =>
    Array.from({ length: line.copies }, (_, copy) => {
      const bird = createHeron(cel);
      const place = new Object3D();
      place.add(bird.group);
      scene.add(place);
      return { line, l, copy, bird, place, u: 0, settled: false };
    }),
  );
  const places = PLACES.map(() => [0, 0, 0] as [number, number, number]);
  const shed = createShed(cel, 24, PLACES.length);
  const story = createStory(cel, LINES.length);
  scene.add(shed.mesh, story.mesh);

  // ---- sky and sea
  const sunDir = uniform(new Vector3(0, 1, 0));
  const sky = createSky(renderer, sunDir);
  const skyMat = new MeshBasicNodeMaterial();
  skyMat.side = BackSide;
  skyMat.depthWrite = false;
  skyMat.colorNode = sky.color(normalize(positionLocal));
  const dome = new Mesh(new SphereGeometry(200, 48, 24), skyMat);
  dome.renderOrder = -1;
  dome.frustumCulled = false;
  scene.add(dome);
  const water = createWater(WATER, scene, sunDir);
  low.level.value = WATER;
  scene.add(water.mesh);

  // ---- camera: it stands just above the water, off to the side and a little ahead, looking across at the
  // flock, so that the sky is above them and their reflections below. The orbit controls move a stand-in
  const camera = new PerspectiveCamera(FOV, width / height, 0.05, 1200);
  const stand = new PerspectiveCamera(FOV, width / height, 0.05, 1200);
  camera.layers.enable(ABOVE);
  const controls = new OrbitControls(stand, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 0.6;
  controls.maxDistance = 60;
  controls.maxPolarAngle = 125 * (Math.PI / 180); // it may look up from below what it looks at; it is kept out of the water when it is placed
  const sph = new Spherical();
  const off = new Vector3();
  const aim = new Vector3();

  // ---- the picture is drawn with a second sheet beside it (is this bird, and which part of it), from
  // which the contour and the seams are inked afterwards
  const p = {
    px: uniform(new Vector2(1, 1)), // one pixel, in screen units
    unit: uniform(1), // pixels per "pixel at 800 px of height"
    outline: uniform(look.outline),
    seams: uniform(look.seams),
    gap: uniform(look.seamGap),
    wobble: uniform(look.wobble),
    boil: uniform(0),
    fringe: uniform(look.fringe),
    grain: uniform(look.grain),
    vignette: uniform(look.vignette),
    tick: uniform(0), // changes every frame, for the grain
    paper: uniform(new Color(look.outlineColor)),
    paper2: uniform(new Color(look.outlineOnCloud)),
    adapts: uniform(look.outlineAdapts),
    edgeLight: uniform(look.edgeLight),
    rim: uniform(look.rim),
    rimFeather: uniform(look.rimFeather),
    rimTone: uniform(new Color(look.rimTone)),
    haze: uniform(look.haze),
    hazeTone: uniform(new Color(look.hazeTone)),
    hazeFrom: uniform(look.hazeFrom),
    hazeTo: uniform(look.hazeTo),
    sunAt: uniform(new Vector2(2, 2)), // where the sun is on the screen
    sunTone: uniform(new Color(look.sun)),
    glare: uniform(look.glare),
    glareWide: uniform(look.glareWide),
    aspect: uniform(1),
  };
  const size = (w: number, h: number) => {
    p.px.value.set(1 / (w * pixelRatio), 1 / (h * pixelRatio));
    p.unit.value = (h * pixelRatio) / 800;
    p.aspect.value = w / h;
    cel.linePx.value = look.line * p.unit.value;
  };
  size(width, height);

  const pipeline = new RenderPipeline(renderer);
  const drawn = pass(scene, camera);
  drawn.setMRT(mrt({ output, mask: vec4(0) }));
  const picture = drawn.getTextureNode("output");
  const sheet = drawn.getTextureNode("mask");
  const hash = (q: N) => fract(sin(dot(q, vec2(127.1, 311.7))).mul(43758.5453));
  const vn = (q: N) => {
    const i = floor(q);
    const f = fract(q);
    const u = f.mul(f).mul(float(3).sub(f.mul(2)));
    return mix(mix(hash(i), hash(i.add(vec2(1, 0))), u.x), mix(hash(i.add(vec2(0, 1))), hash(i.add(vec2(1, 1))), u.x), u.y);
  };
  // the inked picture at a place on the screen
  const inked = (q: N) => {
    // a hand does not put a line down twice in the same place: every redraw nudges it
    const cell = q.div(p.px).div(p.unit).div(26);
    const stray = vec2(vn(cell.add(p.boil.mul(13.7))), vn(cell.add(p.boil.mul(7.3)).add(31.4)))
      .sub(0.5)
      .mul(2)
      .mul(p.wobble)
      .mul(p.unit)
      .mul(p.px);
    const at = q.add(stray);
    const here = sheet.sample(at);
    // the contour: outside the bird, within a brush width of it. The same brush goes round a part of the
    // bird that passes in front of another (body over a wing, neck over the far wing): there the contour is
    // laid on the part behind. It needs a real gap in depth, so a wing joins the body without a line
    const brush = p.outline.mul(p.unit).mul(mix(0.75, 1.2, vn(cell.mul(0.6).add(p.boil.mul(3.1)))));
    let near: N = float(0);
    let front: N = float(0);
    let toward: N = vec2(0); // which way the bird lies from here
    let depths: N = float(0); // and how far off it is
    let covers: N = float(0);
    // an edge pixel is only partly bird, and what the sheet holds there is thinned by the sky in it:
    // divide by the cover to get the part and the depth back
    const part = (m: N) => m.y.div(max(m.x, 0.001));
    const depth = (m: N) => m.z.div(max(m.x, 0.001)).mul(DEPTH_SCALE);
    const tap = (a: number, reach: number) => {
      const there = sheet.sample(at.add(vec2(Math.cos(a), Math.sin(a)).mul(brush).mul(reach).mul(p.px)));
      near = max(near, there.x);
      toward = toward.add(vec2(Math.cos(a), Math.sin(a)).mul(there.x));
      depths = depths.add(there.z.mul(DEPTH_SCALE));
      covers = covers.add(there.x);
      const nearer = smoothstep(p.gap.mul(0.6), p.gap.mul(1.2), depth(here).sub(depth(there)));
      front = max(
        front,
        smoothstep(0.04, 0.08, abs(part(there).sub(part(here))))
          .mul(nearer)
          .mul(step(0.5, there.x)),
      );
    };
    for (let i = 0; i < 12; i++) tap((i / 12) * Math.PI * 2, 1);
    for (let i = 0; i < 6; i++) tap(((i + 0.5) / 6) * Math.PI * 2, 0.5);
    const inside = smoothstep(0.35, 0.65, here.x);
    // light comes from the sun and from the sky overhead. Where the edge faces it the contour is let go
    // thin; underneath, and on the side away from the sun, it is whole
    const sunward = normalize(p.sunAt.sub(at).mul(vec2(p.aspect, 1)));
    const lightFrom = normalize(sunward.add(vec2(0, -0.8)));
    const facing = dot(toward.div(max(length(toward), 1e-4)).negate(), lightFrom);
    const kept = mix(1, p.edgeLight, smoothstep(-0.2, 0.7, facing));
    // far off, the air takes the bird and its line
    const far = (d: N) => smoothstep(p.hazeFrom, p.hazeTo, d).mul(p.haze);
    const lineFar = far(depths.div(max(covers, 0.001)));
    const contour = max(
      smoothstep(0.3, 0.6, near)
        .mul(float(1).sub(inside))
        .mul(kept)
        .mul(float(1).sub(lineFar.mul(0.6))),
      front
        .mul(inside)
        .mul(p.seams)
        .mul(float(1).sub(far(depth(here)).mul(0.6))),
    );
    // the bright edge: plumage within a brush width of open sky in the sun's direction
    const loose = step(PART.loose - 0.05, part(here)).mul(float(1).sub(step(PART.loose + 0.05, part(here))));
    const rimWide = p.rim.mul(mix(1, p.rimFeather, loose));
    let open: N = float(0);
    const look2 = (turn: number, reach: number) => {
      const way = vec2(sunward.x.mul(Math.cos(turn)).sub(sunward.y.mul(Math.sin(turn))), sunward.x.mul(Math.sin(turn)).add(sunward.y.mul(Math.cos(turn))));
      open = max(open, float(1).sub(sheet.sample(at.add(way.mul(rimWide).mul(p.unit).mul(reach).mul(p.px))).x));
    };
    for (const turn of [-0.7, -0.35, 0, 0.35, 0.7]) look2(turn, 1);
    for (const turn of [-0.5, 0, 0.5]) look2(turn, 0.5);
    const lit = smoothstep(0.4, 0.6, open)
      .mul(inside)
      .mul(float(1).sub(step(0.82, part(here))))
      .mul(step(0.01, p.rim));
    const base = picture.sample(q).xyz;
    const bird = mix(mix(base, p.rimTone, lit), p.hazeTone, far(depth(here)).mul(here.x));
    // on a bright ground (a cloud) a white line would be lost, so there it takes its other colour
    const bright = smoothstep(0.62, 0.8, dot(base, vec3(0.3, 0.55, 0.15)));
    return mix(bird, mix(p.paper, p.paper2, bright.mul(p.adapts)), contour);
  };
  pipeline.outputNode = Fn(() => {
    const q = uv();
    // printed a little out of register, worse towards the corners
    const pull = q
      .sub(0.5)
      .mul(2)
      .mul(p.fringe)
      .mul(p.unit)
      .mul(p.px)
      .add(vec2(p.fringe.mul(0.35).mul(p.unit).mul(p.px.x), 0));
    const col = vec3(inked(q.add(pull)).x, inked(q).y, inked(q.sub(pull)).z).toVar();
    const speck = hash(q.div(p.px).div(p.unit).floor().add(p.tick.mul(17.3))).sub(0.5);
    // the sun's glare lies over everything: a bird that flies into it is lost in it
    const off = q.sub(p.sunAt).mul(vec2(p.aspect, 1));
    col.assign(mix(col, p.sunTone, exp(dot(off, off).div(p.glareWide.mul(p.glareWide)).negate()).mul(p.glare)));
    col.addAssign(speck.mul(p.grain));
    col.mulAssign(float(1).sub(length(q.sub(0.5)).mul(1.4).pow(2).mul(p.vignette)));
    return vec4(col, 1);
  })();

  let baked = "";
  let framed = "";
  let shown: (() => void) | null = null; // puts the panel right after a framing has changed the values under it
  const refresh = () => {
    const framing = FRAMINGS[look.framing] ?? FRAMINGS.level;
    if (look.framing !== framed) {
      const first = framed === "";
      framed = look.framing;
      controls.target.set(...framing.aim);
      stand.position.set(...framing.eye);
      if (!first) Object.assign(look, { sunRight: framing.sunRight, sunUp: framing.sunUp, bank: framing.bank, seaBirds: framing.seaBirds });
      shown?.();
    }
    // the sun is put where it sits well in the frame as the camera stands: up and to the right, ahead of the flock
    const ahead = new Vector3(framing.aim[0] - framing.eye[0], 0, framing.aim[2] - framing.eye[2]).normalize();
    const right = new Vector3().crossVectors(ahead, new Vector3(0, 1, 0)).normalize();
    const above = new Vector3().crossVectors(right, ahead);
    sunDir.value
      .copy(ahead)
      .addScaledVector(right, Math.tan(look.sunRight * (Math.PI / 180)))
      .addScaledVector(above, Math.tan(look.sunUp * (Math.PI / 180)))
      .normalize();
    cel.fill.value.set(look.fill);
    cel.pale.value.set(look.pale);
    cel.wing.value.set(look.wing);
    cel.under.value.set(look.under);
    cel.underWing.value = look.underWing;
    p.edgeLight.value = look.edgeLight;
    p.rim.value = look.rim;
    p.rimFeather.value = look.rimFeather;
    p.rimTone.value.set(look.rimTone);
    p.haze.value = look.haze;
    p.hazeTone.value.set(look.hazeTone);
    p.hazeFrom.value = look.hazeFrom;
    p.hazeTo.value = look.hazeTo;
    cel.cap.value.set(look.cap);
    cel.ink.value.set(look.ink);
    cel.strokes.value = look.strokes;
    cel.linePx.value = look.line * p.unit.value;
    p.paper.value.set(look.outlineColor);
    p.paper2.value.set(look.outlineOnCloud);
    p.adapts.value = look.outlineAdapts;
    p.outline.value = look.outline;
    p.seams.value = look.seams;
    p.gap.value = look.seamGap;
    p.wobble.value = look.wobble;
    p.fringe.value = look.fringe;
    p.grain.value = look.grain;
    p.vignette.value = look.vignette;
    p.sunTone.value.set(look.sun);
    p.glare.value = look.glare;
    p.glareWide.value = look.glareWide;
    for (const k of ["zenith", "horizon", "cloudLight", "cloudMid", "cloudShade", "sea", "sun"] as const) sky.u[k].value.set(look[k]);
    sky.u.cloud.value = look.cloud;
    sky.u.sunGain.value = look.sunGain;
    sky.u.lit.value = look.sunRight >= 0 ? 1 : -1;
    sky.u.middle.value = Math.atan2(ahead.z, ahead.x) * (180 / Math.PI) + look.paintTurn;
    if (sky.u.painted.value) sky.u.tall.value = (sky.u.tall.value / sky.u.wide.value) * look.paintWide;
    sky.u.wide.value = look.paintWide;
    water.u.tint.value.set(look.sea);
    water.u.depth.value = look.seaDepth;
    water.u.near.value = look.seaNear;
    water.u.sway.value = look.sway;
    water.u.dashes.value = look.seaDashes;
    water.u.light.value.set(look.seaLight);
    water.u.glitter.value = look.glitter;
    water.u.haze.value = look.seaHaze;
    low.on.value = look.seaBirds;
    low.skim.value = look.seaSkim;
    low.keep.value = look.seaKeep;
    low.size.value = look.seaBirdsSize;
    low.far.value = look.seaBirdsFar;
    water.u.birds.value = look.seaBirdsDim;
    water.u.sun.value.set(look.sun);
    water.u.pale.value.set(look.horizon);
    // the cumulus is made once, and again only if what shapes or lights it changes
    const key = [look.cloud, sky.u.lit.value].join();
    if (key !== baked) {
      baked = key;
      sky.bake();
    }
  };
  refresh();
  // a painted sky, if one has been put in public/: sky.jpg, .png or .webp (the dev server answers every path, so ask what it is)
  (async () => {
    for (const name of ["sky.png", "sky.jpg", "sky.webp"]) {
      const head = await fetch(`./${name}`, { method: "HEAD" }).catch(() => null);
      if (!head?.ok || !(head.headers.get("content-type") ?? "").startsWith("image/")) continue;
      const tex = await new TextureLoader().loadAsync(`./${name}`);
      sky.hang(tex, look.paintWide, (look.paintWide * tex.image.height) / tex.image.width);
      console.log(`heron sky: ${name} ${tex.image.width}x${tex.image.height}`);
      break;
    }
    for (const name of ["sun.png", "sun.jpg", "sun.webp"]) {
      const head = await fetch(`./${name}`, { method: "HEAD" }).catch(() => null);
      if (!head?.ok || !(head.headers.get("content-type") ?? "").startsWith("image/")) continue;
      const tex = await new TextureLoader().loadAsync(`./${name}`);
      sky.rise(tex);
      console.log(`heron sun: ${name} ${tex.image.width}x${tex.image.height}`);
      break;
    }
  })();

  // ---- panel
  const stats = new Stats();
  document.body.appendChild(stats.dom);
  const gui = new GUI({ title: "feather" });
  shown = () => gui.controllersRecursive().forEach((c) => c.updateDisplay());
  gui.close();
  const ff = gui.addFolder("flight");
  ff.add(look, "beats", 4, 24, 1);
  ff.add(look, "drawnOn", 0, 24, 1);
  ff.add(look, "glide", 0, 0.9, 0.01);
  ff.add(look, "wave", 0, 0.5, 0.01);
  ff.add(look, "still", 0, 0.3, 0.005);
  ff.add(look, "ragged", 0, 1, 0.01);
  ff.add(look, "bank", -0.2, 0.7, 0.01);
  ff.add(look, "nearer", 0, 0.6, 0.01);
  ff.add(motion, "soar", 0, 3, 0.01);
  ff.add(motion, "amp", 0.3, 1.4, 0.01);
  ff.add(motion, "lag", 0, 1.8, 0.01);
  ff.add(motion, "fold", 0, 1.6, 0.01);
  ff.add(motion, "flex", 0, 2.5, 0.01);
  ff.add(motion, "twist", 0, 2, 0.01);
  ff.add(motion, "open", 0, 2, 0.01);
  ff.add(motion, "bob", 0, 0.05, 0.001);
  const ft = gui.addFolder("feather to bird");
  ft.add(tale, "swing", 0, 1.2, 0.01);
  ft.add(tale, "period", 1, 4, 0.01);
  ft.add(tale, "rock", 0, 1.2, 0.01);
  ft.add(tale, "sink", 0, 1, 0.01);
  ft.add(tale, "small", 0.3, 2, 0.01);
  ft.add(tale, "size", 0.5, 3, 0.01);
  ft.add(tale, "toward", 0, 0.7, 0.01);
  ft.add(tale, "far", 2, 12, 0.1);
  ft.add(tale, "drawn", 0, 1, 0.01);
  ft.add(tale, "bow", 0, 0.5, 0.01);
  ft.add(tale, "wakes", 4.2, 6, 0.05);
  ft.add(tale, "speed", 0, 15, 0.1);
  const fm = gui.addFolder("moult");
  fm.add(look, "shed", 0, shed.max, 1);
  fm.add(fall, "sink", 0.1, 1.5, 0.01);
  fm.add(fall, "behind", 0, 3, 0.01);
  fm.add(fall, "swing", 0, 0.8, 0.01);
  fm.add(fall, "period", 0.6, 4, 0.01);
  fm.add(fall, "lift", 0, 0.3, 0.005);
  fm.add(fall, "rock", 0, 1.4, 0.01);
  fm.add(fall, "size", 0.4, 3, 0.01);
  const fb = gui.addFolder("cel");
  for (const k of ["fill", "wing", "under", "pale", "cap", "ink", "rimTone", "outlineColor", "outlineOnCloud", "hazeTone"] as const) fb.addColor(look, k).onChange(refresh);
  fb.add(look, "underWing", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "edgeLight", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "rim", 0, 6, 0.1).onChange(refresh);
  fb.add(look, "rimFeather", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "haze", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "hazeFrom", 0, 40, 0.5).onChange(refresh);
  fb.add(look, "hazeTo", 5, 120, 1).onChange(refresh);
  fb.add(look, "outlineAdapts", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "line", 0, 4, 0.05).onChange(refresh);
  fb.add(look, "strokes", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "outline", 0, 10, 0.1).onChange(refresh);
  fb.add(look, "seams", 0, 1, 0.01).onChange(refresh);
  fb.add(look, "seamGap", 0, 0.4, 0.005).onChange(refresh);
  fb.add(look, "boil", 0, 24, 1);
  fb.add(look, "wobble", 0, 6, 0.05).onChange(refresh);
  const fp = gui.addFolder("print");
  fp.add(look, "fringe", 0, 6, 0.05).onChange(refresh);
  fp.add(look, "grain", 0, 0.3, 0.005).onChange(refresh);
  fp.add(look, "vignette", 0, 1, 0.01).onChange(refresh);
  const fs = gui.addFolder("sky");
  for (const k of ["zenith", "horizon", "cloudLight", "cloudMid", "cloudShade", "sun"] as const) fs.addColor(look, k).onChange(refresh);
  fs.add(look, "cloud", 0, 1, 0.01).onFinishChange(refresh);
  fs.add(look, "paintWide", 40, 240, 1).onChange(refresh);
  fs.add(look, "paintTurn", -90, 90, 0.5).onChange(refresh);
  fs.add(look, "sunRight", -28, 28, 0.1).onFinishChange(refresh);
  fs.add(look, "sunUp", -10, 30, 0.1).onChange(refresh);
  fs.add(look, "sunWide", 10, 90, 0.5);
  fs.add(look, "sunGain", 0, 2, 0.01).onChange(refresh);
  fs.add(look, "sunRock", 0, 30, 0.5);
  fs.add(look, "sunBreath", 0, 0.2, 0.005);
  fs.add(look, "glare", 0, 1, 0.01).onChange(refresh);
  fs.add(look, "glareWide", 0.02, 0.6, 0.01).onChange(refresh);
  const fw = gui.addFolder("sea");
  fw.addColor(look, "sea").onChange(refresh);
  fw.add(look, "seaDepth", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "seaNear", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "sway", 0, 0.15, 0.001).onChange(refresh);
  fw.add(look, "seaDashes", 0, 1, 0.01).onChange(refresh);
  fw.addColor(look, "seaLight").onChange(refresh);
  fw.add(look, "glitter", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "seaHaze", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "seaBirds", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "seaSkim", 0, 2, 0.01).onChange(refresh);
  fw.add(look, "seaKeep", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "seaBirdsSize", 0.2, 1.5, 0.01).onChange(refresh);
  fw.add(look, "seaBirdsFar", 8, 40, 0.5).onChange(refresh);
  fw.add(look, "seaBirdsDim", 0, 1, 0.01).onChange(refresh);
  fw.add(look, "swell", 0, 8, 1);
  const fv = gui.addFolder("camera");
  fv.add(look, "framing", Object.keys(FRAMINGS)).onChange(refresh);
  fv.add(look, "drift");
  fv.add(look, "driftAzimuth", 0, 180, 1);
  fv.add(look, "driftElevation", 0, 20, 0.5);

  const starts = LINES.map(() => [0, 0, 0] as [number, number, number]); // where each line's feather is let go
  const state = { hold: -1, frame: 0, pause: false, view: null as number[] | null };
  Object.assign(window, { __feather: { look, motion, state, refresh, heron: flock[0].bird, flock, shed, fall, tale, story, places, starts, camera, stand, controls, renderer, scene, sky, water, cel } });

  const smooth = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // 1 while a bird beats its wings, 0 while it glides, easing over about a beat either side
  const flapping = (lap: number, middle: number) => {
    if (look.glide <= 0) return 1;
    const away = Math.abs(((((lap - middle) % 1) + 1.5) % 1) - 0.5);
    return smooth(look.glide / 2 - 0.055, look.glide / 2 + 0.055, away);
  };
  // The beat runs down the V as a wave: each place is `wave` of a beat behind the one ahead of it, counted from
  // the point. The glide goes down it too, far more slowly (`still` of the loop from one place to the next), so
  // that a patch of stillness two birds long travels back along the arms and the flock is never all at rest.
  // `ragged` is how much of each place's own time is left in that (1, with no wave: every bird to itself)
  const beatOf = (i: number) => look.ragged * PLACES[i].phase - Math.PI * 2 * look.wave * Math.abs(i - 1);
  const glideOf = (i: number) => {
    const inStep = GLIDES + look.still * Math.abs(i - 1);
    return inStep + (PLACES[i].glide - inStep) * look.ragged;
  };
  // what a place asks of whoever is in it, for any point u along the line of places
  const asked = (u: number, t: number) => {
    const here = { at: [0, 0, 0] as [number, number, number], size: 1, near: 1, phase: 0, flap: 1 };
    const x = Math.min(PLACES.length - 1, Math.max(0, u + 1));
    const i = Math.min(PLACES.length - 2, Math.floor(x));
    const f = x - i;
    const lap = (t / LOOP) % 1;
    const w = lap * Math.PI * 2;
    const a = PLACES[i];
    const b = PLACES[i + 1];
    // (no bird holds its place exactly: each wanders a hand's breadth about it)
    const wander = (q: (typeof PLACES)[number], k: number) => q.at[k] + [0.09 * Math.sin(w * 2 + q.phase * 3), 0.06 * Math.sin(w * 3 + q.phase * 5), 0.08 * Math.sin(w + q.phase * 7)][k];
    // (a smooth line through the places, so that a bird moving up the arm never turns a corner)
    const before = PLACES[Math.max(0, i - 1)];
    const after = PLACES[Math.min(PLACES.length - 1, i + 2)];
    for (let k = 0; k < 3; k++) {
      const [p0, p1, p2, p3] = [wander(before, k), wander(a, k), wander(b, k), wander(after, k)];
      here.at[k] = 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f * f * f);
    }
    here.at[1] += look.bank * here.at[2]; // the whole V rolled towards the viewer: its near arm higher, its far arm lower
    // (the near end of the V larger and the far end smaller than life: more depth than there is)
    here.near = 1 + look.nearer * ((x - 2) / 3);
    here.size = (a.size + (b.size - a.size) * f) * here.near;
    here.phase = beatOf(i) + (beatOf(i + 1) - beatOf(i)) * f;
    here.flap = flapping(lap, glideOf(i)) + (flapping(lap, glideOf(i + 1)) - flapping(lap, glideOf(i))) * f;
    return here;
  };

  type Flyer = (typeof flock)[number];
  // pose bird b as it is t seconds into the loop (beat: the time its wings are drawn at, which may be held).
  // quiet: only find out where it is (used to choose which bird lets a feather go); the story is not told
  const fly = (b: Flyer, t: number, beat: number, quiet = false) => {
    const line = b.line;
    // how far into its life it is: the newest of its line was born in this loop or the last, the others whole loops before
    const age = ((((t - line.born) % LOOP) + LOOP) % LOOP) + b.copy * LOOP;
    // how far up the stream it is, in places: nothing until it has all but joined, then it eases into the
    // stream's pace over two seconds and keeps it
    const x = age - (ARRIVE - 1);
    const p = x <= 0 ? 0 : x <= 2 ? (x * x) / (4 * EVERY) : (x - 1) / EVERY;
    const r = p - line.steps; // above zero once it has started to pull away
    const from = line.arm > 0 ? 1 : -1; // the place it pulls away from
    const q = asked(line.arm > 0 ? 4 - Math.min(p, line.steps) : -1, t);
    const place = b.place;
    place.position.set(q.at[0], q.at[1], q.at[2]);
    place.quaternion.identity();
    let size = q.size;
    let flap = q.flap;
    let power = 1;
    let quicker = 0;
    b.u = line.arm > 0 ? 4 - Math.min(p, line.steps) : -1;
    b.settled = age >= ARRIVE && r <= 0.1;
    if (r > 0) {
      // along its arm to the point, round it in a curve, and on ahead: `d` metres along that way
      const s0 = asked(from, t).at;
      const tip = asked(0, t).at;
      const to = [tip[0] - s0[0], tip[1] - s0[1], tip[2] - s0[2]];
      const arm = Math.hypot(to[0], to[1], to[2]);
      const d = run(r);
      const turn = 0.9; // metres either side of the point over which the corner is rounded
      const ahead = d - arm;
      if (d <= arm - turn) place.position.set(s0[0] + (to[0] / arm) * d, s0[1] + (to[1] / arm) * d, s0[2] + (to[2] / arm) * d);
      else if (ahead < turn) {
        const k = (d - (arm - turn)) / (2 * turn);
        const m = 1 - k;
        for (let i = 0; i < 3; i++) off.setComponent(i, m * m * (tip[i] - (to[i] / arm) * turn) + 2 * m * k * tip[i] + k * k * (tip[i] + AHEAD[i] * turn));
        place.position.copy(off);
      } else place.position.set(tip[0] + AHEAD[0] * ahead, tip[1] + AHEAD[1] * ahead, tip[2] + AHEAD[2] * ahead);
      // it beats harder and faster as it goes, and is lost in the glare
      size = ahead >= GONE ? 0 : q.size * (1 - smooth(GONE - 4, GONE, ahead));
      flap = q.flap + (1 - q.flap) * smooth(0, 0.3, r);
      power = 1 + 0.28 * smooth(0, 0.8, r);
      quicker = Math.PI * 2 * 0.9 * r * r;
    }
    // where the stream has it now: what a joining bird flies to, so that it meets the stream already moving with it
    const slot: [number, number, number] = [place.position.x, place.position.y, place.position.z];
    // a bird that has just joined keeps beating for a moment before it takes up its place's rhythm
    flap += (1 - flap) * (1 - smooth(ARRIVE, ARRIVE + 1.6, age));
    if (b.copy === 0 && age < ARRIVE) {
      // the newest of the line is still a feather, or the far bird it turned out to be
      if (quiet) size = 0;
      else {
        const n = story.tell(b.l, age, camera, starts[b.l], slot, line.way);
        place.position.copy(n.position);
        place.quaternion.copy(n.quaternion);
        // (it is life size while it has to match its feather, and takes its place's size on the way in)
        size *= (n.scale * (1 + (q.near - 1) * smooth(shows() + 0.6, ARRIVE, age))) / q.near;
        flap = n.flap;
        // its first beat begins with the wings on their way up, whatever its place's beat is doing just then;
        // it falls in with that on the way in
        const then = ((line.born + tale.wakes) / LOOP) * look.beats * Math.PI * 2 + q.phase;
        const late = ((((Math.PI * 1.5 - then) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        quicker = late * (1 - smooth(tale.wakes + 1.2, ARRIVE - 1, age));
      }
    } else if (b.copy === 0 && !quiet) story.tell(b.l, age, camera, starts[b.l], slot, line.way); // (puts its feather away)
    place.visible = size > 0.001;
    place.scale.setScalar(Math.max(size, 0.0001));
    if (!place.visible) return;
    b.bird.update((beat / LOOP) * look.beats * Math.PI * 2 + q.phase + quicker, flap, (beat / LOOP) * 3 * Math.PI * 2 + q.phase + b.copy, power);
  };
  // the point under a bird's wing, some way along it, on the side given. Never above the bird's underside: while
  // the wing is raised a feather comes away from under the body at the wing's root instead, or it would appear
  // over the bird (all the more from below, where whatever is nearer the eye stands higher in the picture)
  const under = (f: Flyer, along: number, side: number): [number, number, number] => {
    const { elbow, wrist } = f.bird.state;
    const size = f.place.scale.x;
    const o = f.place.position;
    const belly = -0.1;
    const y = elbow[1] + (wrist[1] - elbow[1]) * along - 0.03;
    const raised = smooth(belly - 0.1, belly + 0.1, y);
    return [
      o.x + (elbow[0] + (wrist[0] - elbow[0]) * along - 0.1) * size,
      o.y + (Math.min(y, belly) + f.bird.group.position.y) * size,
      o.z + (elbow[2] + (wrist[2] - elbow[2]) * along) * (1 - 0.6 * raised) * side * size,
    ];
  };
  // the bird that is in (or nearest to) place u at time t, posed as it is then
  const birdAt = (u: number, t: number) => {
    let best = flock[0];
    let gap = Infinity;
    for (const f of flock) {
      fly(f, t, t, true);
      const d = f.place.visible && f.settled ? Math.abs(f.u - u) : Infinity;
      if (d < gap) [best, gap] = [f, d];
    }
    fly(best, t, t, true);
    return best;
  };
  let anchored = "";

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    const t = ph * LOOP; // seconds into the loop
    // the pose can be held as drawings are; everything else goes on moving between them
    const beat = look.drawnOn > 0 ? Math.floor(t * look.drawnOn + 1e-6) / look.drawnOn : t;

    // ---- camera first: the story is told along its line of sight
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
    camera.position.y = Math.max(camera.position.y, WATER + 0.15);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    dome.position.copy(camera.position);
    water.follow(camera);
    // where the sun falls on the screen, for its glare (far off-screen if it is behind)
    off.copy(sunDir.value).multiplyScalar(100).add(camera.position).project(camera);
    if (off.z < 1) p.sunAt.value.set(off.x * 0.5 + 0.5, 0.5 - off.y * 0.5);
    else p.sunAt.value.set(9, 9);

    // a feather is let go from under a wing, where that wing is at that moment
    const key = [look.beats, look.glide, look.drawnOn, look.bank, look.nearer, look.wave, look.still, look.ragged].join();
    if (key !== anchored) {
      anchored = key;
      LINES.forEach((line, l) => (starts[l] = under(birdAt(line.source, line.born), 0.6, 1)));
      for (const it of shed.items) {
        const f = birdAt(it.from - 1, it.at * LOOP);
        const w = under(f, it.along, it.side);
        const o = f.place.position;
        it.where = [w[0] - o.x, w[1] - o.y, w[2] - o.z];
      }
    }
    // nothing that falls may go into the water, nor below the eye: a bird set far off on a ray that slopes down would be under the sea
    tale.floor = fall.floor = Math.max(WATER + 0.3, camera.position.y + 0.15);
    for (const b of flock) fly(b, t, beat);
    story.touch();
    PLACES.forEach((_, i) => {
      const q = asked(i - 1, t);
      places[i][0] = q.at[0];
      places[i][1] = q.at[1];
      places[i][2] = q.at[2];
    });
    shed.update(ph, LOOP, places, look.shed);
    const redraws = Math.round(look.boil * LOOP);
    const boil = redraws > 0 ? Math.floor(ph * redraws + 1e-6) % redraws : 0;
    cel.boil.value = boil;
    p.boil.value = boil;
    p.tick.value = Math.round(t * 60) % (LOOP * 60);
    water.u.slide.value = ph * SEA_PERIOD * Math.round(look.swell);
    if (sky.u.sunPainted.value) {
      sky.u.spin.value = look.sunRock * (Math.PI / 180) * Math.sin(ph * Math.PI * 2);
      sky.u.sunWide.value = look.sunWide / (1 + look.sunBreath * Math.sin(ph * Math.PI * 4));
    } else sky.u.spin.value = (ph * Math.PI * 2) / 6; // twelve rays, long and short by turns: a sixth of a turn brings them back

    pipeline.render();
    stats.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = stand.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    size(width, height);
  };

  wrap.unload = () => {
    renderer.dispose();
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
  duration: LOOP * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
