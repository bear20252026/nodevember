// the picture to the screen: bloom, exposure, a filmic curve, vignette, grain; or the web lab

@group(0) @binding(1) var hdr: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var b0: texture_2d<f32>;
@group(0) @binding(4) var b1: texture_2d<f32>;
@group(0) @binding(5) var b2: texture_2d<f32>;
@group(0) @binding(6) var b3: texture_2d<f32>;
@group(0) @binding(7) var b4: texture_2d<f32>;
@group(0) @binding(8) var<storage, read> trail: array<f32>;
@group(0) @binding(9) var<storage, read> food: array<f32>;
@group(0) @binding(10) var<storage, read> strands: array<vec4f>;

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

/** the sheets laid flat, outer skin on top: the web, the light it feeds on, and the strands made of it */
fn lab(uv: vec2f) -> vec3f {
  let n = U.layers;
  let L = i32(floor(uv.y * n));
  let v = 1.0 - fract(uv.y * n);
  let x = uv.x * U.W;
  let y = v * (U.H - 1.0);
  let k = cell(i32(x), i32(y), L);
  var T = trail[k] / max(U.trailMean, 1e-3);
  if (U.mode == 1.0 || U.mode == 3.0) { T = food[k]; }
  var col = vec3f(0.55, 0.75, 1.0) * min(T / 5.0, 1.0);
  if (U.mode == 2.0) { col += vec3f(0.1, 0.5, 0.6) * min(food[k] / 5.0, 1.0) * 0.6; }
  let s = strands[k];
  if (s.w > 0.0) {
    let R = U.Rmax * profile(v);
    let o = vec2f(wrapd(x - s.x) * TAU * R / U.W, (y - s.y) * U.Hlen / (U.H - 1.0));
    let tw = vec2f(cos(s.w - 1.0) * TAU * R / U.W, sin(s.w - 1.0) * U.Hlen / (U.H - 1.0));
    let tn = normalize(tw);
    let d = length(o - tn * clamp(dot(o, tn), -length(tw) * 0.8, length(tw) * 0.8));
    col = mix(col, vec3f(1.0), 0.75 * (1.0 - smoothstep(s.z * 0.8, s.z, d)));
  }
  // a line between the sheets
  col *= smoothstep(0.0, 0.003, abs(fract(uv.y * n + 0.5) - 0.5) * 2.0 / n + step(n, 1.0));
  return pow(col, vec3f(1.0 / 2.2));
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  if (U.viewMode == 1.0) { return vec4f(lab(in.uv), 1.0); }
  var c = textureSampleLevel(hdr, smp, in.uv, 0.0).rgb;
  // mostly tight bloom: the wide levels would wash the dark water blue
  let bl = textureSampleLevel(b0, smp, in.uv, 0.0).rgb * 0.4 + textureSampleLevel(b1, smp, in.uv, 0.0).rgb * 0.3 + textureSampleLevel(b2, smp, in.uv, 0.0).rgb * 0.16 +
    textureSampleLevel(b3, smp, in.uv, 0.0).rgb * 0.08 + textureSampleLevel(b4, smp, in.uv, 0.0).rgb * 0.05;
  c = (c + bl * U.bloom) * U.exposure;
  c = aces(c);
  c *= 1.0 - 0.45 * pow(length((in.uv - 0.5) * vec2f(1.0, 0.8)) * 1.35, 2.2);
  let g = h01(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u + u32(U.frame) * 26699u) - 0.5;
  return vec4f(pow(clamp(c, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)) + g * 0.012, 1.0);
}
