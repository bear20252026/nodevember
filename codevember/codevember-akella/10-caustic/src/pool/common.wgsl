// shared by every pass: the object record, hashing and noise, quaternions, the pool's own small waves
// (Uni, NW, WV and WA are written in front of this by index.ts)

struct Obj {
  a: vec4f, // centre, radius
  q: vec4f, // orientation
  b: vec4f, // centre a frame ago, kind (0 ball, 1 stone, 2 marble, 3 petal)
  c: vec4f, // semi-axes over the radius, seed
};

@group(0) @binding(0) var<uniform> U: Uni;

const PI = 3.14159265;
const IOR = 1.333;
const GLASS = 1.52;

fn hashu(x0: u32) -> u32 {
  var x = x0;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
fn h01(x: u32) -> f32 { return f32(hashu(x) >> 8u) / 16777216.0; }
fn hcell(c: vec2i) -> u32 { return hashu((bitcast<u32>(c.x) * 0x8da6b343u) ^ hashu(bitcast<u32>(c.y) * 0xd8163841u + 0x9e3779b9u)); }

fn vnoise(p: vec2f) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = h01(hcell(i));
  let b = h01(hcell(i + vec2i(1, 0)));
  let c = h01(hcell(i + vec2i(0, 1)));
  let d = h01(hcell(i + vec2i(1, 1)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn qrot(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}

fn sunDir() -> vec3f { return vec3f(U.sunX, U.sunY, U.sunZ); }
/** the sun's light once it is in flat water, going down */
fn sunIn() -> vec3f { return vec3f(U.dmX, U.dmY, U.dmZ); }
