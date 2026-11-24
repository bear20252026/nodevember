// every frame: where each photon's path first meets the white plane (the light stops there, and lands on
// it), the plane's light image, and the glow

@group(0) @binding(1) var<storage, read> segs: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> cut: array<vec2f>;
@group(0) @binding(3) var<storage, read_write> planeAcc: array<atomic<u32>>;
@group(0) @binding(4) var planeOut: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(64)
fn cutAndLand(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(U.np);
  let photon = id.x;
  if (photon >= n * n) { return; }
  let S = u32(U.segs);
  cut[photon] = vec2f(f32(S), 1.0);
  if (U.planeOn < 0.5) { return; }
  let P0 = vec3f(U.planeX, U.planeY, U.planeZ);
  let N = vec3f(U.planeNX, U.planeNY, U.planeNZ);
  let Ux = vec3f(U.planeUX, U.planeUY, U.planeUZ);
  let Vy = cross(N, Ux);
  for (var k = 0u; k < S; k++) {
    let A = segs[2u * (photon * S + k)];
    let B = segs[2u * (photon * S + k) + 1u];
    if (B.w == 0.0) { return; }
    let da = dot(A.xyz - P0, N);
    let db = dot(B.xyz - P0, N);
    if (da * db > 0.0 || da == db) { continue; }
    let t = da / (da - db);
    let x = mix(A.xyz, B.xyz, t);
    let uv = vec2f(dot(x - P0, Ux), dot(x - P0, Vy)) / U.planeSize + 0.5;
    // beyond the paper's edge the light carries on
    if (any(uv < vec2f(0.0)) || any(uv >= vec2f(1.0))) { continue; }
    cut[photon] = vec2f(f32(k), t);
    let opl = A.w + t * distance(A.xyz, B.xyz);
    var w = abs(B.w) * pulseWindow(opl);
    if (B.w < 0.0) { w *= U.planeDirect; }
    if (w <= 0.0) { return; }
    let R = u32(U.planeRes);
    let px = uv * f32(R) - 0.5;
    let i0 = vec2i(floor(px));
    let f = px - floor(px);
    let col = bandColor(photon) * w * 64.0;
    for (var c = 0; c < 4; c++) {
      let o = vec2i(c & 1, c >> 1);
      let q = i0 + o;
      if (q.x < 0 || q.y < 0 || q.x >= i32(R) || q.y >= i32(R)) { continue; }
      let ww = mix(1.0 - f.x, f.x, f32(o.x)) * mix(1.0 - f.y, f.y, f32(o.y));
      let cell = 3u * (u32(q.y) * R + u32(q.x));
      atomicAdd(&planeAcc[cell], u32(col.r * ww + 0.5));
      atomicAdd(&planeAcc[cell + 1u], u32(col.g * ww + 0.5));
      atomicAdd(&planeAcc[cell + 2u], u32(col.b * ww + 0.5));
    }
    return;
  }
}

// counts to irradiance, against the light's own (1 where it falls square on the paper), blurred a touch
@compute @workgroup_size(8, 8)
fn resolvePlane(@builtin(global_invocation_id) id: vec3u) {
  let R = i32(U.planeRes);
  let q = vec2i(id.xy);
  if (q.x >= R || q.y >= R) { return; }
  // light per photon over the paper's texel
  let photonArea = pow(2.0 * U.spotR / U.np, 2.0);
  let texel = pow(U.planeSize / f32(R), 2.0);
  let norm = photonArea / texel / 64.0;
  var sum = vec3f(0.0);
  var wsum = 0.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let p = clamp(q + vec2i(i, j), vec2i(0), vec2i(R - 1));
      let w = select(0.5, 1.0, i == 0 && j == 0) * select(0.5, 1.0, i == 0 || j == 0);
      let cell = 3u * u32(p.y * R + p.x);
      sum += vec3f(f32(atomicLoad(&planeAcc[cell])), f32(atomicLoad(&planeAcc[cell + 1u])), f32(atomicLoad(&planeAcc[cell + 2u]))) * w;
      wsum += w;
    }
  }
  textureStore(planeOut, q, vec4f(sum / wsum * norm, 1.0));
}
