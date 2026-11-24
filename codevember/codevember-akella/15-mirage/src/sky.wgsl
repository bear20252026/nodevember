// The sky, made once into a picture of the whole dome: across is the way round (from +z toward +x, a turn to
// the picture's width), up is the height above the horizon (a right angle to the picture's height).
//
// `clear` is the air alone: sunlight scattered once on its way through an atmosphere like the earth's, which is
// what makes the low sun red, the sky over it orange and the far side blue. `clouds` puts two decks of cloud on
// that, lit by the same sun from where it is. `light` is what all of it together sheds on a face, by the way the
// face looks (over the whole ball: under the horizon is the lit sand).

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(11) var grain: texture_3d<f32>;
@group(0) @binding(12) var rep: sampler;
@group(0) @binding(13) var air: texture_2d<f32>;
@group(0) @binding(14) var wrap: sampler;

const PI = 3.14159265359;
const GROUND = 6360e3;
const TOP = 6460e3;
const BLUE = vec3f(5.802e-6, 13.558e-6, 33.1e-6); // what air scatters, a metre
const DUST = 3.996e-6; // what haze scatters
const DUSTS = 4.44e-6; // and takes out
const OZONE = vec3f(0.65e-6, 1.881e-6, 0.085e-6);

@vertex
fn vert(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

fn way(uv: vec2f) -> vec3f {
  let az = (uv.x - 0.5) * 2.0 * PI;
  let el = uv.y * 0.5 * PI;
  return vec3f(sin(az) * cos(el), sin(el), cos(az) * cos(el));
}
fn place(rd: vec3f) -> vec2f {
  return vec2f(atan2(rd.x, rd.z) / (2.0 * PI) + 0.5, asin(clamp(rd.y, 0.0, 1.0)) / (0.5 * PI));
}

// how much air, haze and ozone there is at a height
fn thick(h: f32) -> vec3f {
  return vec3f(exp(-h / 8000.0), P.air2.x * exp(-h / 1200.0), max(0.0, 1.0 - abs(h - 25000.0) / 15000.0));
}
fn ball(o: vec3f, d: vec3f, r: f32) -> f32 {
  let b = dot(o, d);
  let c = dot(o, o) - r * r;
  let disc = b * b - c;
  if (disc < 0.0) {
    return -1.0;
  }
  return -b + sqrt(disc);
}
// what is left of light that comes to p from the way d
fn left(p: vec3f, d: vec3f) -> vec3f {
  let far = ball(p, d, TOP);
  var sum = vec3f(0.0);
  let n = 10;
  // more of the steps low down, where the air is
  var t0 = 0.0;
  for (var i = 1; i <= n; i++) {
    let t1 = far * pow(f32(i) / f32(n), 2.0);
    let q = p + d * 0.5 * (t0 + t1);
    sum += thick(max(length(q) - GROUND, 0.0)) * (t1 - t0);
    t0 = t1;
  }
  return exp(-(BLUE * sum.x + DUSTS * sum.y + OZONE * sum.z));
}

fn clearSky(rd: vec3f) -> vec3f {
  let o = vec3f(0.0, GROUND + 300.0, 0.0);
  let sun = P.sun.xyz;
  let far = ball(o, rd, TOP);
  let mu = dot(rd, sun);
  let pr = 3.0 / (16.0 * PI) * (1.0 + mu * mu);
  let g = 0.78;
  let pm = (1.0 - g * g) / (4.0 * PI * pow(1.0 + g * g - 2.0 * g * mu, 1.5));
  // light that has been scattered more than once comes from all round, and from a sun that is in effect higher
  let soft = normalize(sun + vec3f(0.0, 0.35, 0.0));
  var depth = vec3f(0.0);
  var lit = vec3f(0.0);
  let n = 28;
  var t0 = 0.0;
  for (var i = 1; i <= n; i++) {
    let t1 = far * pow(f32(i) / f32(n), 2.0);
    let dt = t1 - t0;
    let q = o + rd * 0.5 * (t0 + t1);
    let d = thick(max(length(q) - GROUND, 0.0)) * dt;
    depth += 0.5 * d;
    let gone = exp(-(BLUE * depth.x + DUSTS * depth.y + OZONE * depth.z));
    depth += 0.5 * d;
    let once = left(q, sun);
    let more = left(q, soft);
    lit += gone * (once * (BLUE * d.x * pr + DUST * d.y * pm) + more * (BLUE * d.x + DUST * d.y) * P.air2.y / (4.0 * PI));
    t0 = t1;
  }
  return lit * P.air2.z;
}

@fragment
fn clear(@builtin(position) at: vec4f) -> @location(0) vec4f {
  return vec4f(clearSky(way(at.xy / P.bake.xy)), 1.0);
}

fn airAt(rd: vec3f) -> vec3f {
  return textureSampleLevel(air, wrap, place(rd), 0.0).rgb;
}

// --- clouds

fn hash2(p: vec2f) -> f32 {
  var q = fract(p * vec2f(0.1031, 0.1030));
  q += dot(q, q.yx + 33.33);
  return fract((q.x + q.y) * q.x);
}
fn value(x: vec2f) -> f32 {
  let i = floor(x);
  let f = x - i;
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash2(i), hash2(i + vec2f(1.0, 0.0)), u.x), mix(hash2(i + vec2f(0.0, 1.0)), hash2(i + vec2f(1.0, 1.0)), u.x), u.y);
}
fn patches(x: vec2f) -> f32 {
  return 0.5 * value(x) + 0.28 * value(x * 2.13 + 7.7) + 0.15 * value(x * 4.31 + 3.1) + 0.07 * value(x * 8.7 + 1.3);
}
fn remap(v: f32, a: f32, b: f32) -> f32 {
  return clamp((v - a) / (b - a), 0.0, 1.0);
}

// how thick the cloud is at a place (metres, y from the ground). `rough` is the level of the grain to read: far
// off, where a step of the march is long, fine grain would only be noise
fn cloud(p: vec3f, rough: f32, fine: bool) -> f32 {
  let y = (p.y - P.cloud.z) / (P.cloud.w - P.cloud.z);
  if (y <= 0.0 || y >= 1.0) {
    return 0.0;
  }
  // where there is cloud at all: soft patches a few kilometres across
  let edge = mix(0.8, 0.3, P.cloud.x);
  let cover = remap(patches(p.xz / P.cloud4.x + P.cloud2.zw), edge, edge + 0.2);
  if (cover <= 0.0) {
    return 0.0;
  }
  // flat under, heaped on top, and taller where there is more of it
  let shape = smoothstep(0.0, 0.08, y) * (1.0 - smoothstep(0.2 + 0.45 * cover, 0.45 + 0.55 * cover, y));
  // the heaps themselves are the grain's, not the patches': cloud is where the grain rises over a bar, and the
  // bar is lower where there is to be more of it
  let n = textureSampleLevel(grain, rep, p * vec3f(1.0, 1.3, 1.0) / P.cloud4.y + vec3f(0.13, 0.31, 0.57), rough);
  var d = 0.62 * n.x + 0.38 * n.y - (1.0 - 0.66 * cover * shape);
  if (d <= -0.12) {
    return 0.0;
  }
  if (fine) {
    let m = textureSampleLevel(grain, rep, p / P.cloud4.z, rough);
    d -= (1.0 - (0.55 * m.y + 0.3 * m.z + 0.15 * m.w)) * P.cloud4.w;
  }
  return clamp(d * 7.0, 0.0, 1.0) * P.cloud.y;
}

@fragment
fn clouds(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let rd = way(at.xy / P.bake.xy);
  let behind = airAt(rd);
  let sun = P.sun.xyz;
  let o = vec3f(0.0, GROUND + 300.0, 0.0);
  let mu = dot(rd, sun);
  var col = vec3f(0.0);
  var open = 1.0;

  // the high thin deck first met last: streaks, one sheet deep
  let high = ball(o, rd, GROUND + 300.0 + P.cloud2.y);
  let ph = (o + rd * high).xz;
  let streak = patches(ph * vec2f(1.0, 0.22) / 9000.0 + 0.9 * vec2f(value(ph / 14000.0), value(ph / 11000.0 + 5.0)) + 11.0);
  let thin = P.cloud2.x * remap(streak, 0.42, 0.85) * remap(patches(ph / 30000.0 + 3.0), 0.3, 0.6) * exp(-high / 160000.0);

  // the low heaped deck, marched
  let t0 = ball(o, rd, GROUND + 300.0 + P.cloud.z);
  let t1 = min(ball(o, rd, GROUND + 300.0 + P.cloud.w), 110000.0);
  if (t1 > t0) {
    let n = i32(clamp((t1 - t0) / 60.0, 64.0, 220.0));
    let dt = (t1 - t0) / f32(n);
    let rough = clamp(log2(dt / 45.0), 0.0, 5.0);
    // the clouds have the sun a little lower than the sand does: from under, as after sunset
    let beamTo = normalize(vec3f(sun.x, sun.y + P.cloud5.x, sun.z));
    // (light is scattered so many times inside a cloud that it comes out nearly evenly all round)
    let g1 = 0.6;
    let phase = 0.5 * (1.0 - g1 * g1) / pow(1.0 + g1 * g1 - 2.0 * g1 * mu, 1.5) + 0.5;
    // the sun as the cloud has it, up there
    let mid = o + rd * 0.5 * (t0 + min(t1, t0 + 20000.0));
    let shine = left(mid, sun) * P.air2.z;
    // and the light of the sky round it: bluer from over, warmer from the horizon under
    let over = 0.25 * (airAt(vec3f(0.6, 0.8, 0.0)) + airAt(vec3f(-0.6, 0.8, 0.0)) + airAt(vec3f(0.0, 0.8, 0.6)) + airAt(vec3f(0.0, 0.8, -0.6)));
    let under = (airAt(normalize(vec3f(-sun.x, 0.12, -sun.z))) + airAt(normalize(vec3f(sun.z, 0.12, -sun.x))) + airAt(normalize(vec3f(-sun.z, 0.12, sun.x)))) / 3.0;
    let dither = fract(52.9829189 * fract(0.06711056 * at.x + 0.00583715 * at.y));
    for (var i = 0; i < n; i++) {
      if (open < 0.01) {
        break;
      }
      let t = t0 + (f32(i) + dither) * dt;
      let q = o + rd * t;
      // (the ground is a ball: the place over it)
      let alt = length(q) - GROUND - 300.0;
      let p = vec3f(q.x, alt, q.z);
      let d = cloud(p, rough, true);
      if (d <= 0.0) {
        continue;
      }
      // how much cloud is between here and the sun
      var shade = 0.0;
      var reach0 = 0.0;
      for (var k = 1; k <= 6; k++) {
        let reach1 = 30.0 * pow(2.0, f32(k));
        let ps = p + beamTo * 0.5 * (reach0 + reach1);
        shade += cloud(ps, rough + f32(k) * 0.5, k < 3) * (reach1 - reach0);
        reach0 = reach1;
      }
      let y = (alt - P.cloud.z) / (P.cloud.w - P.cloud.z);
      // light that goes on scattering inside gets further in than the first beam does
      let beam = exp(-shade) + 0.5 * exp(-0.25 * shade) * 0.7 + 0.25 * exp(-0.06 * shade) * 0.5;
      var glow = shine * beam * phase * P.cloud3.x;
      glow += (over * (0.35 + 0.65 * y) + under * (1.0 - y) * P.cloud3.z) * P.cloud3.y;
      // and the air between here and the eye
      let near = exp(-t / P.cloud3.w);
      let seen = mix(behind, glow, near);
      let take = 1.0 - exp(-d * dt);
      col += open * take * seen;
      open *= 1.0 - take;
    }
  }
  // the high deck shows where the low one leaves a way through; it is lit from under by a sun already redder
  let far = left(o + rd * high, sun) * P.air2.z;
  let veil = far * (0.35 + 0.65 * pow(max(mu, 0.0), 6.0) + 0.3) * 0.22 * P.cloud3.x + airAt(vec3f(0.0, 1.0, 0.0)) * 0.6;
  let back = mix(behind, mix(behind, veil, exp(-high / 220000.0)), clamp(thin, 0.0, 1.0));
  return vec4f(col + open * back, 1.0);
}

// what the sky sheds on a face, for the 32 x 16 ways a face can look
@fragment
fn light(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let uv = at.xy / vec2f(32.0, 16.0);
  let az = (uv.x - 0.5) * 2.0 * PI;
  let el = (uv.y - 0.5) * PI;
  let n = vec3f(sin(az) * cos(el), sin(el), cos(az) * cos(el));
  // the sand, as the sky's light and the sun's leave it
  let lit = P.sand.rgb * (P.sunTone.rgb * max(P.sun.y, 0.0) + 2.0 * airAt(vec3f(0.0, 1.0, 0.0))) / PI;
  var sum = vec3f(0.0);
  let rows = 24;
  let cols = 48;
  for (var j = 0; j < rows; j++) {
    for (var i = 0; i < cols; i++) {
      let a = (f32(i) + 0.5) / f32(cols) * 2.0 * PI;
      let s = (f32(j) + 0.5) / f32(rows) * 2.0 - 1.0; // sine of the height: equal shares of the ball
      let r = sqrt(1.0 - s * s);
      let d = vec3f(sin(a) * r, s, cos(a) * r);
      let c = max(dot(d, n), 0.0);
      sum += c * select(lit, airAt(d), s > 0.0);
    }
  }
  return vec4f(sum * 4.0 / f32(rows * cols), 1.0);
}
