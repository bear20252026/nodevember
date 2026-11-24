// bloom (a chain of halvings) and the picture to the screen

struct Post {
  exposure: f32,
  bloom: f32,
  frame: f32,
  // only light above this blooms (taken off in the first halving, the one read straight from the picture)
  threshold: f32,
  width: f32,
  vignette: f32,
  pad0: f32,
  pad1: f32,
};
@group(0) @binding(0) var<uniform> P: Post;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var dst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn down(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2f(textureDimensions(dst));
  if (f32(id.x) >= size.x || f32(id.y) >= size.y) { return; }
  let uv = (vec2f(id.xy) + 0.5) / size;
  let ts = 1.0 / vec2f(textureDimensions(src));
  var c = textureSampleLevel(src, smp, uv, 0.0).rgb * 0.5;
  c += textureSampleLevel(src, smp, uv + vec2f(-ts.x, -ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(ts.x, -ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(-ts.x, ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(ts.x, ts.y), 0.0).rgb * 0.125;
  if (f32(textureDimensions(src).x) == P.width) { c = max(c - P.threshold, vec3f(0.0)); }
  textureStore(dst, vec2i(id.xy), vec4f(c, 1.0));
}

@group(0) @binding(4) var b0: texture_2d<f32>;
@group(0) @binding(5) var b1: texture_2d<f32>;
@group(0) @binding(6) var b2: texture_2d<f32>;
@group(0) @binding(7) var b3: texture_2d<f32>;
@group(0) @binding(8) var b4: texture_2d<f32>;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

fn hashu(x0: u32) -> u32 {
  var x = x0;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  var c = textureSampleLevel(src, smp, in.uv, 0.0).rgb;
  let bl = textureSampleLevel(b0, smp, in.uv, 0.0).rgb * 0.4 + textureSampleLevel(b1, smp, in.uv, 0.0).rgb * 0.3 + textureSampleLevel(b2, smp, in.uv, 0.0).rgb * 0.16 +
    textureSampleLevel(b3, smp, in.uv, 0.0).rgb * 0.08 + textureSampleLevel(b4, smp, in.uv, 0.0).rgb * 0.05;
  // (the shafts of light take a little away between them: never below nothing)
  c = aces(max(c + bl * P.bloom, vec3f(0.0)) * P.exposure);
  c *= 1.0 - P.vignette * pow(length((in.uv - 0.5) * vec2f(1.0, 0.8)) * 1.35, 2.2);
  let g = f32(hashu(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u + u32(P.frame) * 26699u) >> 8u) / 16777216.0 - 0.5;
  return vec4f(pow(c, vec3f(1.0 / 2.2)) + g * 0.012, 1.0);
}
