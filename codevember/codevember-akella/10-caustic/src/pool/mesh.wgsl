// the landed grid drawn as triangles into the light texture: each triangle's brightness is its area on
// the water over its area on the floor, so focused light is bright and every line stays sharp

@group(0) @binding(1) var<storage, read> verts: array<vec4f>;

struct VO {
  @builtin(position) pos: vec4f,
  @location(0) old: vec2f,
  @location(1) now: vec2f,
  @location(2) a: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VO {
  let mx = u32(U.mx);
  let v = verts[i];
  var o: VO;
  o.old = vec2f(f32(i % mx), f32(i / mx)) / vec2f(U.mx - 1.0, U.mz - 1.0) * vec2f(2.0 * U.PX, 2.0 * U.PZ);
  o.now = v.xy;
  o.a = v.zw;
  let uv = (v.xy - vec2f(U.cMinX, U.cMinZ)) / vec2f(U.cSizeX, U.cSizeZ);
  o.pos = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  return o;
}

fn area(a: vec2f, b: vec2f) -> f32 { return abs(a.x * b.y - a.y * b.x); }

@fragment
fn fs(in: VO) -> @location(0) vec4f {
  let a0 = area(dpdx(in.old), dpdy(in.old));
  let a1 = area(dpdx(in.now), dpdy(in.now));
  let I = min(a0 / max(a1, 1e-14), U.cmax) * in.a.x;
  return vec4f(I * mix(vec3f(1.0), vec3f(1.0, 0.5, 0.68), in.a.y), 1.0);
}
