// The sea's constants, the tank's size and shared shader parts: the water's level, the sand's
// gentle dunes (the same in JS and GLSL), what the water does to light, the
// sky. The surface itself is in ocean.js and field.js.

export const WATER_Y = 0;
export const FLOOR_Y = -3; // the sand's mean level
export const IOR = 1.333;

// the diorama: a long, shallow glass tank, BOX_HX either side of the middle
// across and BOX_HZ front to back, holding a block of sand (down to BASE_Y)
// and the water over it; the glass is open at the top, ending at the waves,
// the whole standing on a shelf against a wall
export const BOX_HX = 4;
export const BOX_HZ = 1.7;
export const BASE_Y = FLOOR_Y - 0.8;
export const GLASS = 0.03; // the glass stands that far out of the water and sand
// the room, in its own frame, turned ROOM_ANGLE round the vertical from the
// tank's (so the tank isn't quite square to the wall): a back wall at WALL_Z,
// side walls at ±ROOM_HALF, and on the back wall, centred, a thick shelf of
// light wood (SHELF_HALF either side) whose
// top is the tank's foot (BASE_Y), from the back wall to SHELF_FRONT; a
// window in the left wall lets the sun in
export const ROOM_ANGLE = 0.12;
export const ROOM_HALF = 27.5;
export const SHELF_HALF = 11;
export const SHELF_THICK = 0.6;
export const WALL_Z = -BOX_HZ - 1.9;
export const SHELF_FRONT = BOX_HZ + 2.7;
// under the shelf, down to the room's floor, a low wall (a built-in stand)
// set back a little under the plank, so the plank's edge stands proud of it
export const STAND_INSET = 0.28;
export const ROOM_FLOOR_Y = BASE_Y - SHELF_THICK - 9.6;
// its opening, in the left wall: where the sun through it lands about the tank
export const WINDOW = { z0: 8.6, z1: 16.6, y0: 5.8, y1: 16.9 };
// from the tank's frame (world) to the room's, and back
const RC = Math.cos(ROOM_ANGLE), RS = Math.sin(ROOM_ANGLE);
export const toRoom = (x, z) => [x * RC - z * RS, x * RS + z * RC];
export const fromRoom = (x, z) => [x * RC + z * RS, -x * RS + z * RC];
// the light is seen only inside the cube the tank stands for: its glass
// walls carried on up, as high as the tank is wide
export const CUBE_TOP = BASE_Y + 2 * BOX_HX;

// the sea (ocean.js, field.js) repeats every SEA_L metres
export const SEA_L = 32;

const f = (n) => n.toFixed(6);

// ---- each visit its own tank: one seed (?seed=…, else drawn at random)
// sets the sand's dunes and its markings, the sea, where the ball rests and
// the pebbles lie
export const SEED = (() => {
  const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '').get('seed');
  const n = q !== null ? parseInt(q, 10) : NaN;
  return Number.isFinite(n) ? n >>> 0 : Math.floor(Math.random() * 1e6);
})();
function mulberry(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry(SEED * 2654435761 + 1);
// the seed for the sea (ocean.js), its wind's heading — along the tank's
// length, one way or the other (blowing across it, seen from the front, the
// waves' steep backs show dark folds) — and its strength
export const SEA_SEED = Math.floor(rnd() * 1e9);
export const SEA_HEADING = 0.2 + (rnd() < 0.5 ? 0 : Math.PI) + (rnd() - 0.5) * 0.6;
export const SEA_WIND = 2.5 + 1.1 * rnd();

// ---- the floor: low dunes, the same in JS and GLSL — a few long swells,
// each its own heading, length and height (together never more than 0.39 m
// from the mean level)
const DUNES = (() => {
  const out = [];
  const lens = [17 + 9 * rnd(), 9 + 5 * rnd(), 5 + 3 * rnd(), 3 + 2 * rnd()];
  const amps = [0.1 + 0.12 * rnd(), 0.06 + 0.08 * rnd(), 0.03 + 0.04 * rnd(), 0.015 + 0.025 * rnd()];
  const total = amps.reduce((a, b) => a + b, 0);
  const k = Math.min(1, 0.39 / total);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2, w = (2 * Math.PI) / lens[i];
    out.push({ kx: w * Math.cos(a), kz: w * Math.sin(a), ph: rnd() * Math.PI * 2, amp: amps[i] * k });
  }
  return out;
})();
export function floorHeight(x, z) {
  let h = FLOOR_Y;
  for (const d of DUNES) h += d.amp * Math.sin(d.kx * x + d.kz * z + d.ph);
  return h;
}
export const FLOOR_MIN = FLOOR_Y - 0.4;
export const FLOOR_GLSL = /* glsl */ `
float floorHeight(vec2 q) {
  return ${f(FLOOR_Y)}${DUNES.map((d) => `
    + ${f(d.amp)} * sin(${f(d.kx)} * q.x + ${f(d.kz)} * q.y + ${f(d.ph)})`).join('')};
}
`;
// the sand's markings: where its paler and darker patches fall, which way
// its ripples run, and how its layers lie in the cut
export const SAND_LOOK = {
  off: [rnd() * 10, rnd() * 10],
  ripple: rnd() * Math.PI,
  wobble: rnd() * 50,
  layers: [0.62 + 0.1 * rnd(), 0.5 + 0.12 * rnd(), 0.4 + 0.1 * rnd(), 0.18 + 0.08 * rnd()],
};

// ---- night: one value every shader shares (0 the afternoon, 1 a moonlit
// night), so the room can go from one to the other. At night the window shows
// a deep blue sky, the moon comes in through it, cool and much fainter than
// the sun, the room is lit only by what it gives back — dim, blue, never black —
// and the grains of light are moonlight.
export const NIGHT = { value: 0 };
// and how the night looks (set from main.js, &blue, &light, &moon): how
// blue (0 a grey night), how much light the room keeps, and how bright the
// moon through the window (1 each: the colours and levels written below)
export const NIGHT_LOOK = { blue: { value: 1 }, light: { value: 1 }, moon: { value: 1 } };
export const NIGHT_GLSL = /* glsl */ `
#ifndef NIGHT_DECLARED
#define NIGHT_DECLARED
uniform float uNight, uNightBlue, uNightLight, uMoon;
// the night's colour, as blue as asked, no brighter or darker for it
// (its channels' mean is 1; never below 0)
vec3 nightTint(vec3 blue) { return max(mix(vec3(1.0), blue, uNightBlue), 0.0); }
// the room's own light, as the night dims it and turns it blue (a factor)
vec3 nightDim() { return mix(vec3(1.0), 0.175 * uNightLight * nightTint(vec3(0.686, 0.886, 1.428)), uNight); }
// the same, for what's in the tank: already dim by day, it keeps more (the
// eye, used to the dark, still makes out the sand)
vec3 nightDimIn() { return mix(vec3(1.0), 0.397 * sqrt(uNightLight) * nightTint(vec3(0.756, 0.932, 1.311)), uNight); }
// a light's colour by day, as the moon's by night (as bright)
vec3 moonTint(vec3 day) { return mix(day, nightTint(vec3(0.82, 0.95, 1.23)) * dot(day, vec3(0.3333)), uNight); }
#endif
`;

// what the water does to light crossing it: absorbed (red first), and
// scattered back as a soft green-grey veil — clear, not too blue
export const WATER_GLSL = /* glsl */ `
${NIGHT_GLSL}
const vec3 WATER_SIGMA = vec3(0.16, 0.075, 0.07);
const vec3 WATER_VEIL = vec3(0.035, 0.058, 0.06);
// how much of the light from p reaches the eye: through the part of the way
// between them that is inside the tank, under the water (taken as flat)
vec3 waterT(vec3 p, vec3 eye) {
  vec3 d = eye - p;
  vec3 inv = vec3(d.x >= 0.0 ? 1.0 : -1.0, d.y >= 0.0 ? 1.0 : -1.0, d.z >= 0.0 ? 1.0 : -1.0) / max(abs(d), vec3(1e-6));
  vec3 t0 = (vec3(${f(-BOX_HX)}, ${f(BASE_Y)}, ${f(-BOX_HZ)}) - p) * inv;
  vec3 t1 = (vec3(${f(BOX_HX)}, ${f(WATER_Y)}, ${f(BOX_HZ)}) - p) * inv;
  vec3 a = min(t0, t1), b = max(t0, t1);
  float tin = clamp(max(max(a.x, a.y), a.z), 0.0, 1.0);
  float tout = clamp(min(min(b.x, b.y), b.z), 0.0, 1.0);
  float len = max(tout - tin, 0.0) * length(d);
  return exp(-WATER_SIGMA * min(len, 40.0));
}
vec3 throughWater(vec3 col, vec3 p, vec3 eye) {
  vec3 T = waterT(p, eye);
  return col * T + WATER_VEIL * nightDim() * (1.0 - T);
}
`;

// how much of the light at p is shown: none outside the cube; a hard edge
// along the glass, under the water (lifted spots on the sand let a little
// past), and a short fade in the air, where no face is drawn
export const CUBE_GLSL = /* glsl */ `
float inCube(vec3 p) {
  float qx = ${f(BOX_HX)} - abs(p.x), qz = ${f(BOX_HZ)} - abs(p.z);
  if (p.y < ${f(WATER_Y - 0.3)}) return step(-0.08, min(qx, qz));
  return smoothstep(0.0, 0.35, min(min(qx, qz), ${f(CUBE_TOP)} - p.y));
}
// the same, cut right at the glass under the water (for what's in flight: a
// thin margin outside the glass, seen edge on along a pane, would gather the
// trails of all the grains passing it into a bright bar)
float inCubeStrict(vec3 p) {
  float qx = ${f(BOX_HX)} - abs(p.x), qz = ${f(BOX_HZ)} - abs(p.z);
  if (p.y < ${f(WATER_Y - 0.3)}) return step(0.0, min(qx, qz));
  return smoothstep(0.0, 0.35, min(min(qx, qz), ${f(CUBE_TOP)} - p.y));
}
`;

// the room the diorama stands in, as the water and the glass reflect it: warm
// white walls in the afternoon sun, the window's side (left) lighter, the
// ceiling a little dimmer, the wooden floor far below
export const SKY_GLSL = /* glsl */ `
${NIGHT_GLSL}
vec3 skyColor(vec3 d) {
  float y = clamp(d.y, -1.0, 1.0);
  // (at night the window's side a little more so: the moon comes in there)
  float win = 0.82 + mix(0.25, 0.45, uNight) * clamp(-d.x, 0.0, 1.0);
  vec3 horizon = vec3(0.48, 0.42, 0.34) * win;
  vec3 ceiling = vec3(0.38, 0.34, 0.29);
  vec3 c = mix(horizon, ceiling, pow(max(y, 0.0), 0.7));
  return (y < 0.0 ? mix(horizon, vec3(0.24, 0.17, 0.11), min(1.0, -y * 3.0)) : c) * nightDim();
}
`;

// ---- the ball: a tribute to Evan Wallace's WebGL Water — resting on the sand,
// off to one side, well under the water. It catches the grains that come its
// way (they go out on it and leave their glow there) so the sand behind it
// stays in its shadow.
export const BALL_R = 0.496; // (0.62 * 0.8)
export const BALL = (() => {
  // (anywhere well inside the shallow tank, clear of the glass)
  const x = (rnd() * 2 - 1) * (BOX_HX - 1.3), z = (rnd() * 2 - 1) * (BOX_HZ - 0.95);
  return { x, y: floorHeight(x, z) + BALL_R * 0.82, z }; // sunk a little in the sand
})();
// how far along the ray from o, along unit d, it meets the ball (Infinity if it doesn't)
export function ballHit(ox, oy, oz, dx, dy, dz) {
  const lx = ox - BALL.x, ly = oy - BALL.y, lz = oz - BALL.z;
  const b = lx * dx + ly * dy + lz * dz;
  const c = lx * lx + ly * ly + lz * lz - BALL_R * BALL_R;
  const h = b * b - c;
  if (h < 0) return Infinity;
  const s = -b - Math.sqrt(h);
  return s >= 0 ? s : Infinity;
}
// the ball's glow map: latitude and longitude about a level axis (z), its seam
// on the ball's underside away from the light, where nothing lands
export const BALL_GLSL = /* glsl */ `
const vec3 BALL_C = vec3(${f(BALL.x)}, ${f(BALL.y)}, ${f(BALL.z)});
const float BALL_R = ${f(BALL_R)};
const vec3 BALL_REF = vec3(-0.447214, 0.894427, 0.0); // up and towards the light: u = 0.5
const vec3 BALL_Q = vec3(-0.894427, -0.447214, 0.0);
vec2 ballUV(vec3 n) {
  float lon = atan(dot(n, BALL_Q), dot(n, BALL_REF));
  float lat = asin(clamp(n.z, -1.0, 1.0));
  return vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5);
}
`;

// ---- a few pebbles lying on the sand (mostly it is sand): flattened, each
// its own size, turn and shade, sunk a little; none against the ball or the glass
// (five to twelve of them)
export const PEBBLES = (() => {
  const out = [];
  const count = 5 + Math.floor(rnd() * 8);
  for (let tries = 0; out.length < count && tries < 500; tries++) {
    // some alone, some in twos or threes
    const near = out.length && rnd() < 0.45 ? out[Math.floor(rnd() * out.length)] : null;
    const x = near ? near.x + (rnd() - 0.5) * 0.7 : (rnd() * 2 - 1) * (BOX_HX - 0.4);
    const z = near ? near.z + (rnd() - 0.5) * 0.7 : (rnd() * 2 - 1) * (BOX_HZ - 0.35);
    const r = 0.09 + 0.14 * rnd() ** 1.5;
    if (Math.abs(x) > BOX_HX - 0.25 || Math.abs(z) > BOX_HZ - 0.25) continue;
    if (Math.hypot(x - BALL.x, z - BALL.z) < BALL_R + r + 0.25) continue;
    if (out.some((p) => Math.hypot(x - p.x, z - p.z) < r + p.r + 0.04)) continue;
    const sy = 0.45 + 0.2 * rnd(), sz = 0.65 + 0.3 * rnd();
    out.push({ x, z, r, sy, sz, rot: rnd() * Math.PI, tone: rnd(), y: floorHeight(x, z) + r * sy * 0.45 });
  }
  return out;
})();
