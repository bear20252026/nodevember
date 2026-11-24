// shared by every pass of the tunnel: the settings, hashes, the tunnel's winding path

struct Uniforms {
  vp: mat4x4f,
  cam: vec4f, // where the eye is, the time
  tile: vec4f, // the tunnel's length before it repeats, its radius, the height map's width and height
  light: vec4f, // how far above the sand the rippling sheet of light is, the light's lean along the tunnel, the waves' strength, the colours' spread
  win: vec4f, // the light mesh: where it starts along the tunnel, its row step, its columns and rows
  sandA: vec4f, // ripples in the tunnel's length, their height, their lean, how loose their phases are
  sandB: vec4f, // how far the ripples wander, how much their spacing varies, the dunes' height, dunes in the tunnel's length
  sandC: vec4f, // the bore's own swell, how many rocks, their size, the seed
  lookA: vec4f, // fog, the caustics' strength, the light from all round, the direct light
  lookB: vec4f, // the water's colour, the sand's sparkle
  lookC: vec4f, // the sand's colour, the wave clock
  mesh: vec4f, // the wall mesh: where it starts, its finest row step, columns, rows in a band
  path: vec4f, // how far the tunnel winds: side to side, a finer wiggle, up and down; the light mesh's margin in columns
  misc: vec4f, // the caustic map's width and height, the specks, the picture's height
  light2: vec4f, // how many waves, how many colours are traced apart (1 or 3), the brightest a fold may be, the rocks' own roughness
  right: vec4f, // the eye's right; the sun's warmth
  up: vec4f, // the eye's up; how dark a shadow is
  misc2: vec4f, // the picture's width over its height, how far ahead the caustics are traced, how much a fold is widened (in cells of the light mesh), how far off the haze begins
  deep: vec4f, // the water's colour far off, deeper and bluer; how much sooner the reds are lost than the blues
  grass: vec4f, // how much the eelgrass sways, how much it leans with the current, pixels a unit wide at a unit's distance, how many shadows are plants
  shaft: vec4f, // the shafts of light in the water: how strong, how soft (a level of the caustic map), how far up from the sand they show, how much the specks light up in them
  lens: vec4f, // the nearest and the farthest the eye sees; a turn of an angle in the loop being recorded, as a rate (none: no loop); one spare
  waves: array<vec4f, 64>, // each wave: turns round the tunnel, turns per unit along, turns per second, phase; then its slope along each way
};
@group(0) @binding(0) var<uniform> U: Uniforms;

const PI = 3.14159265;
const TAU = 6.2831853;

fn hashu(x0: u32) -> u32 {
  var x = x0;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
fn h01(x: u32) -> f32 { return f32(hashu(x) >> 8u) / 16777216.0; }
fn hash2(a: i32, b: i32, salt: u32) -> u32 { return hashu((bitcast<u32>(a) * 0x8da6b343u) ^ hashu(bitcast<u32>(b) * 0xd8163841u + salt)); }

/** the middle of the tunnel at a distance along it: it winds, and comes back to where it was after one length */
fn centre(z: f32) -> vec3f {
  let k = TAU / U.tile.x;
  return vec3f(U.path.x * sin(k * z) + U.path.y * sin(3.0 * k * z + 1.7), U.path.z * sin(2.0 * k * z + 0.6), z);
}
fn heading(z: f32) -> vec3f {
  let k = TAU / U.tile.x;
  return normalize(vec3f(U.path.x * k * cos(k * z) + U.path.y * 3.0 * k * cos(3.0 * k * z + 1.7), U.path.z * 2.0 * k * cos(2.0 * k * z + 0.6), 1.0));
}
/** the ring's two axes at a distance along the tunnel, square to its heading */
fn ringAxes(z: f32) -> mat3x3f {
  let t = heading(z);
  let a = normalize(cross(vec3f(0.0, 1.0, 0.0), t));
  return mat3x3f(a, cross(t, a), t);
}

fn toClip(p: vec3f) -> vec4f {
  var c = U.vp * vec4f(p, 1.0);
  // three's projection maps depth to [-1, 1]; WebGPU keeps [0, 1]
  c.z = (c.z + c.w) * 0.5;
  return c;
}

/** a place on the wall: an angle round the tunnel, a distance along it, a height above the bare wall */
struct Spot {
  p: vec3f,
  up: vec3f, // toward the middle of the tunnel: up, to whatever sits on the sand
  round: vec3f,
  along: vec3f,
};
fn spot(a: f32, z: f32, lift: f32) -> Spot {
  let ax = ringAxes(z);
  let er = ax[0] * cos(a) + ax[1] * sin(a);
  var o: Spot;
  o.p = centre(z) + (U.tile.y - lift) * er;
  o.up = -er;
  o.round = -ax[0] * sin(a) + ax[1] * cos(a);
  o.along = ax[2];
  return o;
}

/** what the water does to light over a distance: reds go first */
fn through(dist: f32) -> vec3f {
  // (clear up to a little way off, then hazing: what is close keeps its own colour)
  let far = dist - U.misc2.w * (1.0 - exp(-dist / max(U.misc2.w, 1e-3)));
  return exp(-far * U.lookA.x * mix(vec3f(1.0), vec3f(1.9, 0.85, 0.6), U.deep.w));
}

/** a colour seen through that much water: dimmed, and the water's own colour in its place, deeper the farther */
fn hazed(c: vec3f, dist: f32) -> vec3f {
  let t = through(dist);
  let water = mix(U.lookB.rgb, U.deep.rgb, 1.0 - exp(-dist * U.lookA.x * 0.8));
  return c * t + water * (1.0 - t.g);
}


/**
 * How bright the light is part of the way down from the sheet to the sand (`down`: 0 at the sheet, 1 on the sand),
 * given how bright it is where it lands: even at the sheet, all of what the caustic map holds at the sand, and
 * between them a share of each. (A share, and not the lens's own law, one over one less the way down times its
 * power: read straight above where it lands, that law's average falls short of one, and the water went dark.)
 */
fn gathered(landed: f32, down: f32) -> f32 { return 1.0 + (landed - 1.0) * pow(clamp(down, 0.0, 1.0), U.shaft.z); }

/** a rate (of an angle, a second), brought to a whole number of turns in the loop when one is being recorded, so
 * that whatever sways at it is back where it began when the loop comes round */
fn beat(rate: f32) -> f32 {
  if (U.lens.z <= 0.0) { return rate; }
  return max(round(rate / U.lens.z), 1.0) * U.lens.z;
}
