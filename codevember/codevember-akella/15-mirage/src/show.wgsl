// The traced picture, put on the screen: bright things glow, the whole is brought into the range a screen has
// and tinted, and a little grain goes over it.

struct Shown {
  size: vec4f, // of the screen, then exposure and grain
  more: vec4f, // frame, vignette, how much glow, how much colour
  wash: vec4f, // a colour over everything, and how far the glow spreads
  dusk: vec4f, // how far the colours are pushed toward dusk
};
@group(0) @binding(0) var<uniform> S: Shown;
@group(0) @binding(1) var traced: texture_2d<f32>;
@group(0) @binding(2) var soft: sampler;
@group(0) @binding(3) var glow: texture_2d<f32>;

@vertex
fn vert(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

// The glow: the picture halved again and again (`down`), then each size added back onto the one above it
// (`up`), so every bright thing ends with a wide soft skirt.
@fragment
fn down(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let texel = 1.0 / vec2f(textureDimensions(traced));
  let uv = at.xy * 2.0 * texel;
  var sum = textureSampleLevel(traced, soft, uv, 0.0).rgb * 4.0;
  sum += textureSampleLevel(traced, soft, uv + vec2f(-1.0, -1.0) * texel, 0.0).rgb;
  sum += textureSampleLevel(traced, soft, uv + vec2f(1.0, -1.0) * texel, 0.0).rgb;
  sum += textureSampleLevel(traced, soft, uv + vec2f(-1.0, 1.0) * texel, 0.0).rgb;
  sum += textureSampleLevel(traced, soft, uv + vec2f(1.0, 1.0) * texel, 0.0).rgb;
  return vec4f(sum / 8.0, 1.0);
}
@fragment
fn up(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let texel = 1.0 / vec2f(textureDimensions(traced));
  let uv = at.xy * 0.5 * texel;
  var sum = vec3f(0.0);
  for (var k = 0; k < 4; k++) {
    let o = vec2f(f32(k & 1), f32(k >> 1)) * 2.0 - 1.0;
    sum += textureSampleLevel(traced, soft, uv + o * texel, 0.0).rgb * 2.0;
    sum += textureSampleLevel(traced, soft, uv + vec2f(o.x * f32(k >> 1), o.y * f32(1 - (k >> 1))) * 2.0 * texel, 0.0).rgb;
  }
  return vec4f(sum / 12.0 * S.wash.w, 1.0);
}

// a film's shoulder and toe (Hable), on each colour
fn curve(x: vec3f) -> vec3f {
  let a = 0.22;
  let b = 0.3;
  let c = 0.1;
  let d = 0.2;
  let e = 0.01;
  let f = 0.3;
  return (x * (a * x + c * b) + d * e) / (x * (a * x + b) + d * f) - e / f;
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let uv = at.xy / S.size.xy;
  var col = textureSampleLevel(traced, soft, uv, 0.0).rgb;
  col = mix(col, textureSampleLevel(glow, soft, uv, 0.0).rgb, S.more.z);
  // dusk: blue goes toward violet, cream toward rose
  col = mix(col, vec3f(col.r + 0.2 * col.b, 0.9 * col.g + 0.02 * col.b, col.b + 0.05 * col.r), S.dusk.x);
  col *= S.size.z * S.wash.rgb;
  let away = uv - 0.5;
  col *= 1.0 - S.more.y * dot(away, away) * 1.6;
  col = curve(col) / curve(vec3f(11.2));
  let grey = dot(col, vec3f(0.2126, 0.7152, 0.0722));
  col = mix(vec3f(grey), col, S.more.w);
  col = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  let n = fract(52.9829189 * fract(dot(at.xy + S.more.x * vec2f(5.3, 9.1), vec2f(0.06711056, 0.00583715))));
  col += (n - 0.5) * S.size.w;
  return vec4f(col, 1.0);
}
