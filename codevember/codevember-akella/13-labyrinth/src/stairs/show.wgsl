// The tile, laid over the screen as many times as it takes, wherever the view has wandered to.
// It is shown cleaned (clean.wgsl) while it has few samples in it, and more and more as it is while they gather.
// The people (people.wgsl) are drawn over it afterwards; here they take the light off the ground about them.
struct View {
  screen: vec2f, // pixels
  tile: vec2f, // pixels
  centre: vec2f, // what is in the middle of the screen, in the world's units across and up the picture
  scale: f32, // screen pixels to a unit
  period: f32,
  exposure: f32,
  grain: f32,
  time: f32,
  raw: f32, // how much of the picture as it is: the rest is the cleaned one
  sun: vec4f, // toward the sun, in the picture's axes (across, up, toward the eye); w: how sharp its shadows are
  sunTone: vec4f, // w: how far toward the eye the rays of the tile set out from
  clay: vec4f, // w: how dark the people's shade is
  grid: vec4f, // squares across the tile and down it, figures, capsules in a figure
  copies: vec4f, // tiles across the screen and down it, and the first of them
  turn: vec4f, // how the picture is turned on the screen: the cosine and sine of the angle
}
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var picture: texture_2d<f32>;
@group(0) @binding(2) var cleaned: texture_2d<f32>;
@group(0) @binding(3) var faces: texture_2d<f32>;
@group(0) @binding(4) var<storage, read> bodies: array<vec4f>;
@group(0) @binding(5) var<storage, read> nearby: array<u32>;
@group(0) @binding(6) var shaded: texture_2d<f32>; // the people's shade, made at half the size (by `shade`)
@group(0) @binding(7) var smooth_: sampler;
@group(0) @binding(8) var ready: texture_2d<f32>; // the tile as shown: cleaned and gathered light mixed, made once a sample (by `blend`)
@group(0) @binding(9) var round_: sampler; // (repeats, as the tile does)

const HEAD = 3u;
const SLOTS = 12u;

@vertex
fn vert(@builtin(vertex_index) n: u32) -> @builtin(position) vec4f {
  return vec4f(f32(n & 1u) * 4.0 - 1.0, f32(n >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}

fn texel(p: vec2i) -> vec4f {
  let size = vec2i(V.tile);
  let q = ((p % size) + size) % size;
  return mix(textureLoad(cleaned, q, 0), textureLoad(picture, q, 0), V.raw);
}

// How much of a wide sun a capsule leaves, seen from p. A thin thing far off hides only a strip of so wide a sun,
// so its shade is faint and broad; near to, it hides all of it. k: half over the tangent of the sun's half width
fn sunPast(p: vec3f, rd: vec3f, a: vec3f, b: vec3f, r: f32, k: f32) -> f32 {
  let ba = b - a;
  let oa = p - a;
  let oad = dot(oa, rd);
  let dba = dot(rd, ba);
  let baba = dot(ba, ba);
  let oaba = dot(oa, ba);
  let den = max(baba - dba * dba, 1e-7);
  let t = max((-oad * baba + dba * oaba) / den, 0.0001);
  let h = clamp((oaba - oad * dba) / den, 0.0, 1.0);
  let x = length(a + ba * h - p - rd * t) / t; // how far off the ray's line it is, as the ray sees it
  let thick = r / t;
  let wide = 0.5 / k;
  let edge = 1.0 - smoothstep(abs(thick - wide), thick + wide, x);
  return 1.0 - edge * min(1.0, 1.27 * thick / wide);
}
// and how much of the sky about n
fn skyPast(p: vec3f, n: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 {
  let ba = b - a;
  let pa = p - a;
  let h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);
  let d = pa - h * ba;
  let l = max(length(d), r * 0.6);
  let o = clamp(1.0 - max(0.0, dot(-d, n)) * r * r / (l * l * l), 0.0, 1.0);
  return sqrt(o * o * o);
}

// The tile as it is to be shown, once a sample: the cleaned picture and the gathered one, mixed as the samples
// say. (Showing reads this, filtered by the graphics card, and not the two of them four times each a pixel)
@fragment
fn blend(@builtin(position) at: vec4f) -> @location(0) vec4f {
  return texel(vec2i(at.xy));
}

// where a point of the screen is, in the picture's own axes (across and up it)
fn placed(px: vec2f) -> vec2f {
  // (the picture may be turned: by a third of a turn, the floors of another way up are the floors)
  let off = vec2f(px.x - 0.5 * V.screen.x, 0.5 * V.screen.y - px.y) / V.scale;
  return vec2f(off.x * V.turn.x + off.y * V.turn.y, off.y * V.turn.x - off.x * V.turn.y) + V.centre;
}

// The people's shade on the pile, at half the screen's size each way: it is soft (the sun is wide), so a
// quarter of the pixels do, smoothed back up. How much of the sun, and of the rest, each pixel keeps. Only the
// parts of a figure that cast much shade are asked: the body, the head, the legs
@fragment
fn shade(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let world = placed(at.xy * 2.0);
  let extent = V.period * vec2f(sqrt(2.0), sqrt(6.0));
  let uv = vec2f(world.x, -world.y) / extent;
  let size = vec2i(V.tile);
  let face = textureLoad(faces, ((vec2i(floor(uv * V.tile)) % size) + size) % size, 0);
  let square = vec2u(fract(uv) * V.grid.xy);
  let first = (square.y * u32(V.grid.x) + square.x) * SLOTS;
  if (nearby[first] == 0u || face.w < 0.0) { return vec4f(1.0); }
  let across = vec3f(1.0, 0.0, -1.0) / sqrt(2.0);
  let up = vec3f(-1.0, 2.0, -1.0) / sqrt(6.0);
  let eye = vec3f(1.0) / sqrt(3.0);
  let n = vec3f(dot(face.xyz, across), dot(face.xyz, up), dot(face.xyz, eye));
  let here = vec3f(world, V.sunTone.w - face.w) + n * 0.003;
  var parts = array<u32, 6>(0u, 2u, 4u, 5u, 10u, 11u); // (torso, head, thighs, shins)
  var sun = 1.0;
  var sky = 1.0;
  for (var slot = 0u; slot < SLOTS; slot++) {
    let who = nearby[first + slot];
    if (who == 0u) { break; }
    let base = (who - 1u) * (HEAD + 2u * u32(V.grid.w));
    let bound = bodies[base + 1u];
    // the nearest of the figure's likenesses, tile after tile
    let d = here.xy - bound.xy;
    let q = vec3f(bound.xy + d - round(d / extent) * extent, here.z);
    let off = distance(q, bound.xyz) / (bound.w + 0.4);
    if (off > 1.0) { continue; }
    var itsSun = 1.0;
    var itsSky = 1.0;
    for (var k = 0; k < 6; k++) {
      let m = parts[k];
      let a = bodies[base + HEAD + m * 2u];
      let b = bodies[base + HEAD + m * 2u + 1u];
      if (a.w <= 0.0) { continue; }
      itsSun *= sunPast(q, V.sun.xyz, a.xyz, b.xyz, a.w, V.sun.w);
      itsSky *= skyPast(q, n, a.xyz, b.xyz, a.w);
    }
    // (its shade is not looked for beyond a way off, and fades out before that)
    let fade = 1.0 - smoothstep(0.55, 1.0, off);
    sun *= mix(1.0, itsSun, fade);
    sky *= mix(1.0, itsSky, fade);
  }
  return vec4f(sun, sky, 1.0, 1.0);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let world = placed(at.xy);
  let extent = V.period * vec2f(sqrt(2.0), sqrt(6.0));
  let uv = vec2f(world.x, -world.y) / extent;
  let both = textureSampleLevel(ready, round_, uv, 0.0);
  var c = both.rgb;

  // the people's shade: of the sun's own light (the picture keeps how much of it is that), and of the rest
  if (V.grid.z > 0.5 && V.turn.z > 0.5) {
    let kept = textureSampleLevel(shaded, smooth_, at.xy / V.screen, 0.0);
    let direct = min(V.clay.rgb * V.sunTone.rgb * both.a, c);
    c = (c - direct) * mix(1.0, kept.g, V.clay.w) + direct * mix(1.0, kept.r, V.clay.w);
  }

  // a soft shoulder, then the screen's curve
  c = c * V.exposure;
  c = c * (1.0 + c * 0.12) / (1.0 + c * 0.55);
  c = pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  let grain = fract(sin(dot(at.xy + V.time * 61.0, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  return vec4f(c + grain * V.grain, 1.0);
}
