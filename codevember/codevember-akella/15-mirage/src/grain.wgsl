// The grain the clouds are cut from: a block of noise that repeats, 128 each way. Red is billows (smooth noise
// with cells bitten out of it), green, blue and alpha are cells at finer and finer sizes, for wisps.

@group(0) @binding(0) var made: texture_storage_3d<rgba8unorm, write>;

fn pcg(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash(c: vec3i, period: i32, salt: u32) -> vec3f {
  let w = (c % period + period) % period;
  let h = pcg(u32(w.x) + pcg(u32(w.y) + pcg(u32(w.z) + pcg(salt + u32(period)))));
  let h2 = pcg(h);
  let h3 = pcg(h2);
  return vec3f(f32(h), f32(h2), f32(h3)) / 4294967296.0;
}
fn smoothNoise(x: vec3f, period: i32) -> f32 {
  let i = vec3i(floor(x));
  let f = x - floor(x);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  var sum = 0.0;
  for (var k = 0; k < 8; k++) {
    let o = vec3i(k & 1, (k >> 1) & 1, k >> 2);
    let g = normalize(hash(i + o, period, 7u) * 2.0 - 1.0);
    let w = mix(1.0 - u, u, vec3f(o));
    sum += w.x * w.y * w.z * dot(g, f - vec3f(o));
  }
  return sum;
}
// 1 at the middle of a cell, 0 as far from any as can be
fn cells(x: vec3f, period: i32) -> f32 {
  let i = vec3i(floor(x));
  let f = x - floor(x);
  var least = 1e9;
  for (var k = 0; k < 27; k++) {
    let o = vec3i(k % 3, (k / 3) % 3, k / 9) - 1;
    let d = vec3f(o) + hash(i + o, period, 3u) - f;
    least = min(least, dot(d, d));
  }
  return 1.0 - min(sqrt(least), 1.0);
}

@compute @workgroup_size(4, 4, 4)
fn main(@builtin(global_invocation_id) id: vec3u) {
  let x = (vec3f(id) + 0.5) / 128.0;
  let billow = 0.5 + 0.9 * (smoothNoise(x * 4.0, 4) + 0.5 * smoothNoise(x * 8.0, 8) + 0.25 * smoothNoise(x * 16.0, 16) + 0.125 * smoothNoise(x * 32.0, 32));
  let c0 = 0.625 * cells(x * 4.0, 4) + 0.25 * cells(x * 8.0, 8) + 0.125 * cells(x * 16.0, 16);
  let c1 = 0.625 * cells(x * 6.0, 6) + 0.25 * cells(x * 12.0, 12) + 0.125 * cells(x * 24.0, 24);
  let c2 = 0.625 * cells(x * 12.0, 12) + 0.25 * cells(x * 24.0, 24) + 0.125 * cells(x * 48.0, 48);
  let c3 = 0.625 * cells(x * 24.0, 24) + 0.25 * cells(x * 48.0, 48) + 0.125 * cells(x * 64.0, 64);
  // billows: the smooth noise, swollen by the cells
  let puff = clamp((clamp(billow, 0.0, 1.0) - (c0 - 1.0)) / (2.0 - c0), 0.0, 1.0);
  textureStore(made, id, vec4f(puff, c1, c2, c3));
}

// each smaller level of it: eight texels to one
@group(0) @binding(1) var bigger: texture_3d<f32>;

@compute @workgroup_size(4, 4, 4)
fn shrink(@builtin(global_invocation_id) id: vec3u) {
  var sum = vec4f(0.0);
  for (var k = 0u; k < 8u; k++) {
    sum += textureLoad(bigger, id * 2u + vec3u(k & 1u, (k >> 1u) & 1u, k >> 2u), 0);
  }
  textureStore(made, id, sum / 8.0);
}
