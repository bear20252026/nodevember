// shared by the glass page's shaders; `struct Uni` is written out from index.ts
//
// The slab in its own frame: x and y across it (half side U.half), z out of its top. The top is flat at
// z = U.th, the underside is the designed height field z = s(x, y) <= 0. World is y up, the paper is y = 0,
// light falls straight down. M's columns are the slab's axes in the world; the pivot sits at z = U.pivot.

const PI = 3.14159265;

fn toWorld(p: vec3f) -> vec3f {
  let q = p - vec3f(0.0, 0.0, U.pivot);
  return vec3f(U.cx, U.cy, U.cz) + vec3f(U.mx0, U.mx1, U.mx2) * q.x + vec3f(U.my0, U.my1, U.my2) * q.y + vec3f(U.mz0, U.mz1, U.mz2) * q.z;
}
fn dirToWorld(d: vec3f) -> vec3f {
  return vec3f(U.mx0, U.mx1, U.mx2) * d.x + vec3f(U.my0, U.my1, U.my2) * d.y + vec3f(U.mz0, U.mz1, U.mz2) * d.z;
}
fn dirToLocal(d: vec3f) -> vec3f {
  return vec3f(dot(d, vec3f(U.mx0, U.mx1, U.mx2)), dot(d, vec3f(U.my0, U.my1, U.my2)), dot(d, vec3f(U.mz0, U.mz1, U.mz2)));
}
fn toLocal(p: vec3f) -> vec3f {
  return dirToLocal(p - vec3f(U.cx, U.cy, U.cz)) + vec3f(0.0, 0.0, U.pivot);
}

// signed distance to the slab's rounded-square outline in its plane (negative inside)
fn outline(uv: vec2f) -> f32 {
  let r = U.corner;
  let q = abs(uv) - vec2f(U.half - r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// the underside: height and slopes, bilinear between cell centres
fn under(uv: vec2f) -> vec3f {
  let n = i32(U.n);
  let g = clamp((uv + U.half) / (2.0 * U.half) * U.n - 0.5, vec2f(0.0), vec2f(U.n - 1.001));
  let i0 = vec2i(floor(g));
  let w = g - floor(g);
  let a = field[i0.y * n + i0.x].xyz;
  let b = field[i0.y * n + i0.x + 1].xyz;
  let c = field[(i0.y + 1) * n + i0.x].xyz;
  let d = field[(i0.y + 1) * n + i0.x + 1].xyz;
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// upward normal of the underside
fn underNormal(uv: vec2f) -> vec3f {
  let f = under(uv);
  return normalize(vec3f(-f.y, -f.z, 1.0));
}

fn schlick(cosi: f32, ior: f32) -> f32 {
  let r0 = (ior - 1.0) / (ior + 1.0);
  let f0 = r0 * r0;
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosi, 0.0, 1.0), 5.0);
}

fn hash(x: u32) -> u32 {
  var s = x * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash01(x: u32) -> f32 { return f32(hash(x)) / 4294967295.0; }

fn channelIor(ch: u32) -> f32 { return U.ior + (f32(ch) - 1.0) * U.disp; }
