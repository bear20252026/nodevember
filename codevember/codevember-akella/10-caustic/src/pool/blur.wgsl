// a little blur over the light (the lines' softness) and a big one at quarter size for their glow

@group(0) @binding(2) var texIn: texture_2d<f32>;
@group(0) @binding(3) var texOut: texture_storage_2d<rgba16float, write>;

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

/** quarter size, keeping only light above the floor's flat level */
@compute @workgroup_size(8, 8)
fn down4(@builtin(global_invocation_id) id: vec3u) {
  let out = vec2i(textureDimensions(texOut));
  let q = vec2i(id.xy);
  if (q.x >= out.x || q.y >= out.y) { return; }
  let size = vec2i(textureDimensions(texIn));
  var sum = vec3f(0.0);
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < 4; i++) {
      sum += max(textureLoad(texIn, min(q * 4 + vec2i(i, j), size - 1), 0).rgb - U.glowFloor, vec3f(0.0));
    }
  }
  textureStore(texOut, q, vec4f(sum / 16.0, 1.0));
}
