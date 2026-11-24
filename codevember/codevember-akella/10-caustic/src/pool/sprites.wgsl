// drawn over the picture: four-point glints where the sun's reflection meets the eye, and splash drops

@group(0) @binding(1) var<storage, read> drops: array<vec4f>;

struct SO {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) k: f32,
};

/** to clip space: (x, y, distance along the view) */
fn project(p: vec3f) -> vec3f {
  let v = p - vec3f(U.camX, U.camY, U.camZ);
  let z = dot(v, vec3f(U.fX, U.fY, U.fZ));
  return vec3f(dot(v, vec3f(U.rX, U.rY, U.rZ)) / (z * U.tanFov * U.aspect), dot(v, vec3f(U.uX, U.uY, U.uZ)) / (z * U.tanFov), z);
}

@vertex
fn vsStar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  let gx = u32(U.starsX);
  let cell = vec2f(f32(ii % gx), f32(ii / gx));
  // each glint lives a moment at a random spot in its cell, then moves on
  let tt = U.time * (0.7 + 0.9 * h01(ii * 7u + 1u)) + h01(ii * 13u + 5u);
  let epoch = u32(floor(tt));
  let life = fract(tt);
  let j = vec2f(h01(ii * 0x9e37u + epoch * 0x632bu), h01(ii * 0x85ebu + epoch * 31u + 7u));
  let size = vec2f(2.0 * U.PX / U.starsX, 2.0 * U.PZ / f32(u32(U.starsN) / gx));
  let xz = vec2f(-U.PX, -U.PZ) + (cell + j) * size;
  let w = water(xz);
  let n = normalize(vec3f(-w.y, 1.0, -w.z));
  let p = vec3f(xz.x, w.x, xz.y);
  let e = normalize(vec3f(U.camX, U.camY, U.camZ) - p);
  let I = smoothstep(U.spark0, U.spark1, dot(reflect(-sunDir(), n), e)) * sin(PI * life);
  let c = project(p);
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  let a = (h01(ii * 3u + epoch) - 0.5) * 0.6;
  let rc = vec2f(corner.x * cos(a) - corner.y * sin(a), corner.x * sin(a) + corner.y * cos(a));
  var px = U.starSize * U.dpr * (0.35 + 0.65 * I);
  if (I < 0.02) { px = 0.0; }
  var o: SO;
  o.pos = vec4f(c.xy + rc * px / vec2f(U.W, U.H) * 2.0, 0.0, 1.0);
  o.uv = corner;
  o.k = I;
  return o;
}

@fragment
fn fsStar(in: SO) -> @location(0) vec4f {
  let u = in.uv;
  let a = abs(u);
  let core = exp(-dot(u, u) * 30.0);
  let rays = exp(-a.y * 60.0) * pow(max(1.0 - a.x, 0.0), 2.5) + exp(-a.x * 60.0) * pow(max(1.0 - a.y, 0.0), 2.5);
  let d = abs(vec2f(u.x + u.y, u.x - u.y) * 0.7071);
  let diag = exp(-d.y * 80.0) * pow(max(1.0 - d.x * 2.0, 0.0), 3.0) + exp(-d.x * 80.0) * pow(max(1.0 - d.y * 2.0, 0.0), 3.0);
  let v = (core + rays + 0.35 * diag) * in.k;
  return vec4f(vec3f(0.85, 0.97, 1.0) * v, 0.0);
}

@vertex
fn vsDrop(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SO {
  let a = drops[ii * 2u];
  let b = drops[ii * 2u + 1u];
  let c = project(a.xyz);
  let c1 = project(a.xyz + b.xyz * 0.02);
  var dir = (c1.xy - c.xy) * vec2f(U.W, U.H);
  dir = select(vec2f(0.0, 1.0), normalize(dir), length(dir) > 1e-4);
  let side = vec2f(-dir.y, dir.x);
  let r = a.w / (c.z * U.tanFov) * U.H * 0.5;
  let stretch = 1.0 + min(length(b.xyz) * 0.35, 1.5);
  let corner = vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0;
  var off = (dir * corner.y * stretch + side * corner.x) * r;
  if (a.w <= 0.0 || c.z <= 0.0) { off = vec2f(0.0); }
  var o: SO;
  o.pos = vec4f(c.xy + off / vec2f(U.W, U.H) * 2.0, 0.0, 1.0);
  o.uv = corner;
  o.k = clamp(b.w * 4.0, 0.0, 1.0);
  return o;
}

@fragment
fn fsDrop(in: SO) -> @location(0) vec4f {
  let r = length(in.uv);
  let alpha = (1.0 - smoothstep(0.85, 1.0, r)) * in.k;
  // white drops with a thin cyan rim and a darker cyan underside
  var col = mix(vec3f(1.0), vec3f(0.62, 0.9, 1.0), smoothstep(0.1, 0.9, -in.uv.y * 0.7 + 0.25));
  col = mix(col, vec3f(0.3, 0.72, 0.92), smoothstep(0.72, 0.84, r));
  return vec4f(col * alpha, alpha);
}
