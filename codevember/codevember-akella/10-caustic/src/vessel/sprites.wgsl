// into the light before the bloom: specks drifting in the water, out of focus away from the vessel, and
// glints that come and go on the thorns' tips

@group(0) @binding(1) var<storage, read> knots: array<vec4f>;
@group(0) @binding(2) var<storage, read> knotCount: array<u32>;

struct SO {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) k: vec2f,
};

/** clip x, y, and distance along the view */
fn project(p: vec3f) -> vec3f {
  let v = p - vec3f(U.camX, U.camY, U.camZ);
  let z = dot(v, vec3f(U.fX, U.fY, U.fZ));
  return vec3f(dot(v, vec3f(U.rX, U.rY, U.rZ)) / (z * U.tanFov * U.aspect), dot(v, vec3f(U.uX, U.uY, U.uZ)) / (z * U.tanFov), z);
}

fn quad(c: vec3f, vi: u32, px: f32) -> vec4f {
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  var s = px;
  if (c.z <= 0.05) { s = 0.0; }
  return vec4f(c.xy + (corner * s + vec2f(U.jx, U.jy)) / vec2f(U.rW, U.rH) * 2.0, 0.0, 1.0);
}

@vertex
fn vsSnow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  let box = vec3f(5.0, 3.4, 4.0);
  let h = vec3f(h01(ii * 3u + 1u), h01(ii * 3u + 2u), h01(ii * 3u + 3u));
  var p = (h - 0.5) * box;
  p.y += U.time * (0.01 + 0.02 * h.x);
  p.x += 0.06 * sin(U.time * 0.2 + h.z * 30.0);
  p.y = (fract(p.y / box.y + 0.5) - 0.5) * box.y;
  let c = project(p);
  // in focus at the vessel, blurred discs nearer and further
  let blur = min(abs(c.z - U.focus) * 5.0, 14.0) * U.rH / 900.0;
  let size = (1.0 + 2.0 * h01(ii * 7u)) * U.rH / 900.0;
  let px = size + blur;
  var o: SO;
  o.pos = quad(c, vi, px);
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  o.k = vec2f(U.snow * (0.4 + 0.6 * h.y) * size * size / (px * px), 0.0);
  return o;
}

@fragment
fn fsSnow(in: SO) -> @location(0) vec4f {
  let r = length(in.uv);
  let a = (1.0 - smoothstep(0.6, 1.0, r)) * in.k.x;
  return vec4f(vec3f(0.6, 0.8, 1.0) * a, 0.0);
}

@vertex
fn vsStar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  var o: SO;
  o.uv = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  if (ii >= min(knotCount[0], arrayLength(&knots))) {
    o.pos = vec4f(0.0, 0.0, 0.0, 1.0);
    o.k = vec2f(0.0);
    return o;
  }
  let k = knots[ii];
  let th = thornOf(k);
  let tip = th.B + th.a * th.len;
  // each one glints now and then, by where it is, not by its place in the list
  let id = hashu(u32(k.x) * 7919u + u32(k.y) * 104729u);
  let tt = U.time * (0.25 + 0.3 * h01(id)) + h01(id ^ 99u);
  let on = smoothstep(0.88, 1.0, h01(id + u32(floor(tt)) * 31u)) * sin(PI * fract(tt));
  // tips on the far side are seen through the glass, dimmer
  let facing = 0.35 + 0.65 * smoothstep(-0.2, 0.4, -dot(normalize(vec3f(th.B.x, 0.0, th.B.z)), vec3f(U.fX, 0.0, U.fZ)));
  let I = on * facing * U.stars;
  let c = project(tip);
  o.pos = quad(c, vi, select(0.0, U.starSize * U.rH / 900.0 * (0.5 + 0.5 * I), I > 0.01));
  o.k = vec2f(I, 0.0);
  return o;
}

@fragment
fn fsStar(in: SO) -> @location(0) vec4f {
  let u = in.uv;
  let a = abs(u);
  let core = exp(-dot(u, u) * 40.0);
  let rays = exp(-a.y * 70.0) * pow(max(1.0 - a.x, 0.0), 3.0) + exp(-a.x * 70.0) * pow(max(1.0 - a.y, 0.0), 3.0);
  return vec4f(vec3f(0.85, 0.95, 1.0) * (core * 3.0 + rays) * in.k.x * 4.0, 0.0);
}
