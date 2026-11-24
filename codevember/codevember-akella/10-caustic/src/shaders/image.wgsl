// photon counts to a light image: averaged with the last frames, then blurred a little (the kernel of
// the density estimate) and a lot at quarter size for the glow

@group(0) @binding(2) var<storage, read> light: array<u32>;
@group(0) @binding(3) var texIn: texture_2d<f32>;
@group(0) @binding(4) var texOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var texPrev: texture_2d<f32>;

@compute @workgroup_size(8, 8)
fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(U.W);
  let H = u32(U.H);
  if (id.x >= W || id.y >= H) { return; }
  let k = id.y * W + id.x;
  let n = W * H;
  let now = vec3f(f32(light[k]), f32(light[n + k]), f32(light[2u * n + k])) * U.norm;
  let before = textureLoad(texPrev, vec2i(id.xy), 0).rgb;
  textureStore(texOut, vec2i(id.xy), vec4f(mix(before, now, U.ema), 1.0));
}

fn blur(id: vec2i, dir: vec2i, sigma: f32) {
  let size = vec2i(textureDimensions(texIn));
  if (id.x >= size.x || id.y >= size.y) { return; }
  if (sigma < 0.2) {
    textureStore(texOut, id, textureLoad(texIn, id, 0));
    return;
  }
  let r = min(i32(ceil(sigma * 2.5)), 24);
  var sum = vec3f(0.0);
  var wsum = 0.0;
  for (var k = -r; k <= r; k++) {
    let q = clamp(id + dir * k, vec2i(0), size - 1);
    let w = exp(-f32(k * k) / (2.0 * sigma * sigma));
    sum += textureLoad(texIn, q, 0).rgb * w;
    wsum += w;
  }
  textureStore(texOut, id, vec4f(sum / wsum, 1.0));
}

@compute @workgroup_size(8, 8)
fn kdeH(@builtin(global_invocation_id) id: vec3u) { blur(vec2i(id.xy), vec2i(1, 0), U.blur); }
@compute @workgroup_size(8, 8)
fn kdeV(@builtin(global_invocation_id) id: vec3u) { blur(vec2i(id.xy), vec2i(0, 1), U.blur); }
@compute @workgroup_size(8, 8)
fn glowH(@builtin(global_invocation_id) id: vec3u) { blur(vec2i(id.xy), vec2i(1, 0), U.glowSigma); }
@compute @workgroup_size(8, 8)
fn glowV(@builtin(global_invocation_id) id: vec3u) { blur(vec2i(id.xy), vec2i(0, 1), U.glowSigma); }

@compute @workgroup_size(8, 8)
fn down4(@builtin(global_invocation_id) id: vec3u) {
  let out = vec2i(textureDimensions(texOut));
  let q = vec2i(id.xy);
  if (q.x >= out.x || q.y >= out.y) { return; }
  let size = vec2i(textureDimensions(texIn));
  var sum = vec3f(0.0);
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < 4; i++) {
      sum += textureLoad(texIn, min(q * 4 + vec2i(i, j), size - 1), 0).rgb;
    }
  }
  textureStore(texOut, q, vec4f(sum / 16.0, 1.0));
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var o = 0; o < 4; o++) {
    v += a * gnoise(vec3f(q, 3.1));
    q *= 2.03;
    a *= 0.5;
  }
  return v;
}

// the floor's mottle, at two sizes, worked out once for the light image's size
@compute @workgroup_size(8, 8)
fn bakeFloor(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2f(textureDimensions(texOut));
  if (f32(id.x) >= size.x || f32(id.y) >= size.y) { return; }
  let uv = (vec2f(id.xy) + 0.5) / size;
  let w = vec2f(U.ax * (uv.x * 2.0 - 1.0), 1.0 - uv.y * 2.0);
  let mottle = 0.8 + 0.25 * fbm(w * 3.0) + 0.12 * fbm(w * 19.0);
  textureStore(texOut, vec2i(id.xy), vec4f(mottle, 0.0, 0.0, 1.0));
}
