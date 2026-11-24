// The slow things about the ground, made once into two pictures (see ground.wgsl for how they are read).
// Everything here repeats over the picture, so the ground goes on for ever.

// a place the ground is flattened: along a line from one point to another, within a radius of it. The first few
// (count.x of count.y) are wide, and level the land itself to its height where their line begins; the rest only
// take the dunes off whatever the land is there by then, and so they can sit on the wide ones.
struct Pad {
  line: vec4f, // from x, z to x, z
  how: vec4f, // radius, how far beyond that it fades, -, how wet (0..1)
  more: vec4f, // how much of the dunes it takes off (0..1), and of the small ones; the place it is levelled to
};
struct Pads {
  count: vec4f,
  list: array<Pad, 48>,
};
@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(8) var<uniform> pads: Pads;

const SPAN = 4096.0;
const CELLS = 2048.0;

fn sd() -> u32 {
  return u32(P.seed.x) * 7919u;
}

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}

// smooth noise that repeats every `period` cells, about -1..1
fn noise(x: vec2f, period: i32, seed: u32) -> f32 {
  let i = vec2i(floor(x));
  let f = x - floor(x);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  var corner: array<f32, 4>;
  for (var k = 0; k < 4; k++) {
    let o = vec2i(k & 1, k >> 1);
    let c = ((i + o) % period + period) % period;
    let a = f32(pcg(u32(c.x) + pcg(u32(c.y) + pcg(seed)))) * (6.2831853 / 4294967296.0);
    corner[k] = dot(vec2f(cos(a), sin(a)), f - vec2f(o));
  }
  return 1.6 * mix(mix(corner[0], corner[1], u.x), mix(corner[2], corner[3], u.x), u.y);
}

fn fbm(x: vec2f, period: i32, octaves: i32, seed: u32) -> f32 {
  var sum = 0.0;
  var gain = 1.0;
  var most = 0.0;
  var scale = period;
  for (var o = 0; o < octaves; o++) {
    sum += gain * noise(x * f32(scale), scale, seed + u32(o) * 101u);
    most += gain;
    gain *= 0.5;
    scale *= 2;
  }
  return sum / most;
}

// uv is the place, as a share of the picture
fn warpAt(uv: vec2f) -> f32 {
  return P.dune.z * (fbm(uv, 7, 3, sd() + 11u) + 0.35 * noise(uv * 41.0, 41, sd() + 13u));
}
fn landAt(uv: vec2f) -> f32 {
  return P.land.x * fbm(uv, 3, 4, sd() + 23u) + P.land.z * noise(uv * 37.0, 37, sd() + 29u);
}
fn dunesAt(uv: vec2f) -> f32 {
  let n = fbm(uv, 5, 3, sd() + 37u);
  return smoothstep(-0.3, 0.3, n + P.dune.w);
}

// how much a pad has of a place: 1 within its radius, fading to 0
fn within(pad: Pad, xz: vec2f) -> f32 {
  let ab = pad.line.zw - pad.line.xy;
  let h = clamp(dot(xz - pad.line.xy, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return 1.0 - smoothstep(pad.how.x, pad.how.x + pad.how.y, length(xz - pad.line.xy - ab * h));
}

// the land, the dunes, the wet of a place and how much its small dunes are taken off, with the wide pads laid
fn wideAt(xz: vec2f) -> vec4f {
  let uv = xz / SPAN + 0.5;
  var dunes = dunesAt(uv);
  var land = landAt(uv) + P.land.y * dunes;
  var pan = P.land.w * smoothstep(0.3, 0.0, dunes);
  var hush = 0.0;
  for (var k = 0; k < i32(pads.count.x); k++) {
    let pad = pads.list[k];
    let w = within(pad, xz);
    if (w <= 0.0) {
      continue;
    }
    let uv0 = pad.more.zw / SPAN + 0.5;
    let left = 1.0 - pad.more.x; // what it leaves of the dunes
    land = mix(land, landAt(uv0) + P.land.y * dunesAt(uv0) * left, w);
    dunes *= 1.0 - w * pad.more.x;
    pan = max(pan, w * pad.how.w);
    hush = max(hush, w * pad.more.y);
  }
  return vec4f(land, dunes, pan, hush);
}

struct Made {
  @location(0) a: vec4f,
  @location(1) b: vec4f,
};

@vertex
fn vert(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> Made {
  let uv = at.xy / CELLS;
  let xz = (uv - 0.5) * SPAN;
  let warp = warpAt(uv);
  var laid = wideAt(xz);
  for (var k = i32(pads.count.x); k < i32(pads.count.y); k++) {
    let pad = pads.list[k];
    let w = within(pad, xz);
    if (w <= 0.0) {
      continue;
    }
    let under = wideAt(pad.more.zw);
    laid = vec4f(mix(laid.x, under.x, w), laid.y * (1.0 - w * pad.more.x), max(laid.z, w * pad.how.w), max(laid.w, w * pad.more.y));
  }
  let land = laid.x;
  let dunes = laid.y;
  let pan = select(laid.z, -laid.w, laid.w > 0.0 && laid.z <= 0.0);
  // how closely the crests are packed here (dunes to a metre): the wind's own spacing, changed by the push
  let e = 1.0 / SPAN;
  let push = vec2f(warpAt(uv + vec2f(e, 0.0)) - warpAt(uv - vec2f(e, 0.0)), warpAt(uv + vec2f(0.0, e)) - warpAt(uv - vec2f(0.0, e))) / 2.0;
  let packed = length(P.wave.xy + push);
  // closer crests are lower dunes; and the slip face is as long as the dune is tall, at the angle of repose
  let tall = P.dune.x * dunes * (0.62 + 0.38 * noise(uv * 31.0, 31, sd() + 41u) + 0.12 * noise(uv * 83.0, 83, sd() + 43u)) * min(1.0, length(P.wave.xy) / max(packed, 1e-6));
  let brink = 1.0 - clamp(tall / P.dune.y * packed, 0.02, 0.5);
  var made: Made;
  let w0 = round(warp * 64.0) / 64.0;
  let l0 = round(land * 16.0) / 16.0;
  let b0 = round(brink * 256.0) / 256.0;
  made.a = vec4f(w0, warp - w0, l0, land - l0);
  made.b = vec4f(tall, b0, brink - b0, pan);
  return made;
}
