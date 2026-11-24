// the floor, lit by the light image

@group(0) @binding(2) var lit: texture_2d<f32>;
@group(0) @binding(3) var glow: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
@group(0) @binding(5) var floorTex: texture_2d<f32>;

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

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let L = textureSampleLevel(lit, smp, in.uv, 0.0).rgb;
  let G = textureSampleLevel(glow, smp, in.uv, 0.0).rgb;
  // a floor of pale stone, mottled (baked once per size)
  let albedo = vec3f(U.floorR, U.floorG, U.floorB) * textureSampleLevel(floorTex, smp, in.uv, 0.0).r;
  let tint = vec3f(U.tintR, U.tintG, U.tintB);
  var col = albedo * (U.ambient + L * tint * U.exposure) + G * tint * U.glow;
  // a soft vignette
  col *= 1.0 - 0.35 * pow(length(in.uv - 0.5) * 1.25, 2.5);
  col = aces(col);
  // the canvas is not sRGB: encode here, with a whisper of dither
  let n = hash01(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u) - 0.5;
  return vec4f(pow(col, vec3f(1.0 / 2.2)) + n / 255.0, 1.0);
}
