// The people, drawn over the tile: every capsule of every figure as a small rectangle of the screen, in which
// each pixel finds where its ray meets the capsule. They are behind whatever of the pile is nearer the eye (the
// guide picture knows how far off the pile is), and they are lit by what the tile says of the ground they are
// on: how much of the sun reaches it, and how much other light there is about.
struct View {
  screen: vec2f,
  tile: vec2f,
  centre: vec2f,
  scale: f32,
  period: f32,
  exposure: f32,
  grain: f32,
  time: f32,
  raw: f32,
  sun: vec4f,
  sunTone: vec4f,
  clay: vec4f,
  grid: vec4f,
  copies: vec4f,
  turn: vec4f,
}
@group(0) @binding(0) var<uniform> V: View;
@group(0) @binding(1) var picture: texture_2d<f32>;
@group(0) @binding(2) var cleaned: texture_2d<f32>;
@group(0) @binding(3) var faces: texture_2d<f32>;
@group(0) @binding(4) var<storage, read> bodies: array<vec4f>;

const HEAD = 3u;

struct Drawn {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) which: vec2u, // the figure's first number, and the capsule's
  @location(1) @interpolate(flat) shift: vec2f, // which likeness of the tile this one is in
  @location(2) @interpolate(flat) about: vec4f, // the light about it that is not the sun's; w: how much of the sun reaches it
}

fn texel(p: vec2i) -> vec4f {
  let size = vec2i(V.tile);
  let q = ((p % size) + size) % size;
  return mix(textureLoad(cleaned, q, 0), textureLoad(picture, q, 0), V.raw);
}

@vertex
fn vert(@builtin(vertex_index) v: u32, @builtin(instance_index) inst: u32) -> Drawn {
  var o: Drawn;
  let caps = u32(V.grid.w);
  let each = u32(V.grid.z) * caps;
  let copy = inst / each;
  let base = ((inst % each) / caps) * (HEAD + 2u * caps);
  let cap = base + HEAD + (inst % caps) * 2u;
  let a = bodies[cap];
  let b = bodies[cap + 1u];
  let extent = V.period * vec2f(sqrt(2.0), sqrt(6.0));
  let across = u32(V.copies.x);
  o.which = vec2u(base, cap);
  o.shift = (vec2f(f32(copy % across), f32(copy / across)) + V.copies.zw) * extent;
  if (a.w <= 0.0) {
    o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
    return o;
  }
  let corner = vec2f(f32(v & 1u), f32((v >> 1u) & 1u));
  let pad = a.w + 1.5 / V.scale;
  let at = mix(min(a.xy, b.xy) - pad, max(a.xy, b.xy) + pad, corner) + o.shift;
  let rel = at - V.centre;
  o.pos = vec4f(vec2f(rel.x * V.turn.x - rel.y * V.turn.y, rel.x * V.turn.y + rel.y * V.turn.x) * V.scale / (0.5 * V.screen), 0.5, 1.0);

  // the light on the ground it is on: a few pixels of the tile about that spot
  let head = bodies[base];
  let spot = vec2i(floor(vec2f(head.x, -head.y) / extent * V.tile));
  var lit = vec4f(0.0);
  var taps = array<vec2i, 5>(vec2i(0, 0), vec2i(7, 3), vec2i(-7, -3), vec2i(-3, 7), vec2i(3, -7));
  for (var j = 0; j < 5; j++) {
    lit += texel(spot + taps[j]) * 0.2;
  }
  let reaches = select(0.7, clamp(lit.a / max(head.z, 1e-3), 0.0, 1.0), head.z > 0.08);
  o.about = vec4f(max(lit.rgb / V.clay.rgb - V.sunTone.rgb * lit.a, vec3f(0.0)), reaches);
  return o;
}

// where a ray straight down the eye's way meets a capsule: how far toward the eye that is (or -1e9)
fn met(p: vec2f, a: vec3f, b: vec3f, r: f32) -> f32 {
  var z = -1e9;
  // the two round ends
  let da = p - a.xy;
  let ha = r * r - dot(da, da);
  if (ha > 0.0) { z = max(z, a.z + sqrt(ha)); }
  let db = p - b.xy;
  let hb = r * r - dot(db, db);
  if (hb > 0.0) { z = max(z, b.z + sqrt(hb)); }
  // the side
  let ba = b - a;
  let baba = dot(ba, ba);
  let oa = vec3f(da, 0.0); // the ray's start, taken level with a
  let k2 = baba - ba.z * ba.z;
  if (k2 > 1e-7) {
    let baoa = dot(ba, oa);
    let k1 = baoa * ba.z; // (the ray goes along -z)
    let k0 = baba * dot(oa, oa) - baoa * baoa - r * r * baba;
    let h = k1 * k1 - k2 * k0;
    if (h > 0.0) {
      let t = (k1 + sqrt(h)) / k2; // how far toward the eye from a's level
      let y = baoa + t * ba.z;
      if (y > 0.0 && y < baba) { z = max(z, a.z + t); }
    }
  }
  return z;
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

struct Paint {
  @location(0) tone: vec4f,
  @builtin(frag_depth) depth: f32,
}

@fragment
fn frag(d: Drawn) -> Paint {
  let caps = u32(V.grid.w);
  let a = bodies[d.which.y];
  let b = bodies[d.which.y + 1u];
  let off = vec2f(d.pos.x - 0.5 * V.screen.x, 0.5 * V.screen.y - d.pos.y) / V.scale;
  let world = vec2f(off.x * V.turn.x + off.y * V.turn.y, off.y * V.turn.x - off.x * V.turn.y) + V.centre;
  let p = world - d.shift;
  // how much of the pixel the capsule's outline covers
  let ba = b.xy - a.xy;
  let pa = p - a.xy;
  let out = length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-9), 0.0, 1.0)) - a.w;
  var cover = clamp(0.5 - out * V.scale, 0.0, 1.0);
  if (cover <= 0.0) { discard; }
  let r = a.w + max(out, 0.0) + 0.25 / V.scale;
  let z = met(p, a.xyz, b.xyz, r);
  if (z < -1e8) { discard; }
  let hit = vec3f(p, z);

  // is the pile in front of it here? Asked of the four pixels of the tile about this one, so that its edge is soft
  let extent = V.period * vec2f(sqrt(2.0), sqrt(6.0));
  let q = vec2f(world.x, -world.y) / extent * V.tile - 0.5;
  let size = vec2i(V.tile);
  let f = q - floor(q);
  var clear = 0.0;
  for (var j = 0; j < 4; j++) {
    let o = vec2i(j & 1, j >> 1);
    let face = textureLoad(faces, (((vec2i(floor(q)) + o) % size) + size) % size, 0);
    let w = mix(1.0 - f.x, f.x, f32(o.x)) * mix(1.0 - f.y, f.y, f32(o.y));
    clear += w * select(0.0, 1.0, face.w < 0.0 || z > V.sunTone.w - face.w - 0.012);
  }
  cover *= clear;
  if (cover < 0.02) { discard; }

  let h = clamp(dot(hit - a.xyz, b.xyz - a.xyz) / max(dot(b.xyz - a.xyz, b.xyz - a.xyz), 1e-9), 0.0, 1.0);
  let n = normalize(hit - a.xyz - (b.xyz - a.xyz) * h);
  // the sun, where the rest of the figure leaves it
  var sun = max(dot(n, V.sun.xyz), 0.0) * d.about.w;
  if (sun > 0.0) {
    for (var m = 0u; m < caps; m++) {
      let c = d.which.x + HEAD + m * 2u;
      let ca = bodies[c];
      if (c == d.which.y || ca.w <= 0.0) { continue; }
      sun *= sunPast(hit + n * 0.002, V.sun.xyz, ca.xyz, bodies[c + 1u].xyz, ca.w, V.sun.w);
    }
  }
  let ground = bodies[d.which.x + 2u].xyz;
  let light = V.sunTone.rgb * sun + d.about.rgb * (0.72 + 0.28 * dot(n, ground));
  // what it is made of: the suit (each figure its own), skin, socks, hair
  let suit = mix(vec3f(0.13, 0.022, 0.045), vec3f(0.2, 0.04, 0.07), bodies[d.which.x].w);
  var made = suit;
  if (b.w > 3.5) { made = vec3f(0.035, 0.035, 0.04); } else if (b.w > 2.5) { made = vec3f(0.03, 0.016, 0.02); } else if (b.w > 1.5) { made = vec3f(0.8, 0.77, 0.74); } else if (b.w > 0.5) { made = vec3f(0.72, 0.5, 0.42); }
  var c = made * light * V.exposure;
  // (a phone's screen shines of itself)
  if (b.w > 4.5) { c = vec3f(0.72, 0.92, 1.0) * 1.35; }
  c = c * (1.0 + c * 0.12) / (1.0 + c * 0.55);
  c = pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  let grain = fract(sin(dot(d.pos.xy + V.time * 61.0, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  var paint: Paint;
  paint.tone = vec4f(c + grain * V.grain, cover);
  paint.depth = clamp(0.5 - z / 128.0, 0.0, 1.0);
  return paint;
}
