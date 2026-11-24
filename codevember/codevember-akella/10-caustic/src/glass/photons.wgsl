// light through the slab onto the paper: one photon per cell of a grid over the slab, jittered each frame,
// traced through both faces with Snell's law and splatted into the paper's light buffer

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read> field: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> light: array<atomic<u32>>;
@group(0) @binding(3) var accPrev: texture_2d<f32>;
@group(0) @binding(4) var accOut: texture_storage_2d<rgba16float, write>;

fn splat(x: vec2f, ch: u32, weight: f32) {
  let R = i32(U.res);
  let px = (x / U.phalf * 0.5 + 0.5) * U.res - 0.5;
  let i0 = vec2i(floor(px));
  if (i0.x < 0 || i0.y < 0 || i0.x >= R - 1 || i0.y >= R - 1) { return; }
  let f = px - floor(px);
  let base = ch * u32(R * R);
  let k = u32(i0.y * R + i0.x);
  atomicAdd(&light[base + k], u32((1.0 - f.x) * (1.0 - f.y) * weight + 0.5));
  atomicAdd(&light[base + k + 1u], u32(f.x * (1.0 - f.y) * weight + 0.5));
  atomicAdd(&light[base + k + u32(R)], u32((1.0 - f.x) * f.y * weight + 0.5));
  atomicAdd(&light[base + k + u32(R) + 1u], u32(f.x * f.y * weight + 0.5));
}

@compute @workgroup_size(256)
fn shine(@builtin(global_invocation_id) id: vec3u) {
  let np = u32(U.np);
  if (id.x >= np * np) { return; }
  let i = id.x % np;
  let j = id.x / np;
  // a fresh place in the cell each frame: the light converges as frames add up
  let seed = id.x * 3u + u32(U.frame) * 2654435761u;
  let jit = vec2f(hash01(seed), hash01(seed ^ 0x9e3779b9u));
  let uv = (vec2f(f32(i), f32(j)) + jit) / U.np * 2.0 * U.half - U.half;
  if (outline(uv) > 0.0) { return; }
  let ch = (i + j * 2u + u32(U.frame)) % 3u;
  let ior = channelIor(ch);

  let dl = dirToLocal(vec3f(0.0, -1.0, 0.0));
  var p: vec3f;
  var d: vec3f;
  var keep = abs(dl.z);
  if (dl.z < 0.0) {
    // in through the flat top, out through the designed underside
    let n0 = vec3f(0.0, 0.0, 1.0);
    let t1 = refract(dl, n0, 1.0 / ior);
    keep *= 1.0 - schlick(-dl.z, ior);
    let top = vec3f(uv, U.th);
    var lam = (under(uv).x - U.th) / t1.z;
    for (var k = 0; k < 4; k++) {
      lam = (under(top.xy + t1.xy * lam).x - U.th) / t1.z;
    }
    p = top + t1 * lam;
    if (outline(p.xy) > 0.0) { return; }
    let nu = underNormal(p.xy);
    let t2 = refract(t1, nu, ior);
    if (dot(t2, t2) < 0.5) { return; }
    keep *= 1.0 - schlick(-dot(t1, nu), 1.0 / ior);
    d = t2;
  } else {
    // upside down: in through the underside, out through the top
    let s = under(uv).x;
    let nd = -underNormal(uv);
    let t1 = refract(dl, nd, 1.0 / ior);
    if (dot(t1, t1) < 0.5 || t1.z <= 0.0) { return; }
    keep *= 1.0 - schlick(-dot(dl, nd), ior);
    p = vec3f(uv, s) + t1 * ((U.th - s) / t1.z);
    if (outline(p.xy) > 0.0) { return; }
    let t2 = refract(t1, vec3f(0.0, 0.0, -1.0), ior);
    if (dot(t2, t2) < 0.5) { return; }
    keep *= 1.0 - schlick(t1.z, 1.0 / ior);
    d = t2;
  }
  let pw = toWorld(p);
  let dw = dirToWorld(d);
  if (dw.y >= -1e-4) { return; }
  let hit = pw + dw * (-pw.y / dw.y);
  splat(hit.xz, ch, 256.0 * keep);
}

// counts to light on the paper (the slab's share only; direct light is worked out where it is drawn),
// averaged over frames: progressively while nothing moves, briefly while it does
@compute @workgroup_size(8, 8)
fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let R = u32(U.res);
  if (id.x >= R || id.y >= R) { return; }
  let k = id.y * R + id.x;
  let n = R * R;
  let now = vec3f(f32(atomicLoad(&light[k])), f32(atomicLoad(&light[n + k])), f32(atomicLoad(&light[2u * n + k]))) * U.norm;
  let before = textureLoad(accPrev, vec2i(id.xy), 0).rgb;
  textureStore(accOut, vec2i(id.xy), vec4f(mix(before, now, U.ema), 1.0));
}
