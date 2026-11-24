// shared by every module; `struct Uni` is written out from index.ts so the two never disagree

@group(0) @binding(0) var<uniform> U: Uni;
// per wave: (k.x, k.y, amplitude, angular speed), (phase, -, -, -)
@group(0) @binding(1) var<uniform> waves: array<vec4f, 32>;

const PI = 3.14159265;

// the light's units: the screen is 2 high, 2 * ax wide, centred; photons start a margin beyond it
fn domainMin() -> vec2f { return vec2f(-U.ax - U.margin, -1.0 - U.margin); }
fn domainSize() -> vec2f { return vec2f(2.0 * (U.ax + U.margin), 2.0 * (1.0 + U.margin)); }

fn photonUV(ix: u32, iy: u32) -> vec2f {
  return domainMin() + (vec2f(f32(ix), f32(iy)) + 0.5) / vec2f(U.nx, U.ny) * domainSize();
}

// red, green, blue photons interleaved so every small patch holds all three
fn channel(ix: u32, iy: u32) -> u32 { return (ix + 2u * iy) % 3u; }

// gradient of the water's height
fn slope(p: vec2f, t: f32) -> vec2f {
  var g = vec2f(0.0);
  let n = u32(U.waveCount);
  for (var i = 0u; i < n; i++) {
    let a = waves[2u * i];
    let b = waves[2u * i + 1u];
    g += a.xy * (a.z * cos(dot(a.xy, p) - a.w * t + b.x));
  }
  return g;
}

// where light falling straight down through the surface above p meets the floor, for one colour
fn caustic(p: vec2f, t: f32, ch: u32) -> vec2f {
  let g = slope(p, t);
  let n = normalize(vec3f(-g, 1.0));
  let ior = U.ior + (f32(ch) - 1.0) * U.dispersion;
  let d = refract(vec3f(0.0, 0.0, -1.0), n, 1.0 / ior);
  return p + U.depth * d.xy / max(-d.z, 0.05);
}

// grid of the flow: cell centres at integer coordinates
fn toGrid(p: vec2f) -> vec2f { return (p - domainMin()) / domainSize() * vec2f(U.gx, U.gy) - 0.5; }
fn cellSize() -> vec2f { return domainSize() / vec2f(U.gx, U.gy); }

fn hash(x: u32) -> u32 {
  var s = x * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash01(x: u32) -> f32 { return f32(hash(x)) / 4294967295.0; }

// 3d gradient noise
fn ghash(c: vec3i) -> vec3f {
  let h = hash((u32(c.x) * 73856093u) ^ (u32(c.y) * 19349663u) ^ (u32(c.z) * 83492791u));
  let a = f32(h & 1023u) / 1023.0 * 2.0 * PI;
  let z = f32((h >> 10u) & 1023u) / 1023.0 * 2.0 - 1.0;
  let r = sqrt(max(0.0, 1.0 - z * z));
  return vec3f(r * cos(a), r * sin(a), z);
}
fn gnoise(p: vec3f) -> f32 {
  let i = vec3i(floor(p));
  let f = p - floor(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  var v = 0.0;
  for (var k = 0; k < 8; k++) {
    let o = vec3i(k & 1, (k >> 1) & 1, (k >> 2) & 1);
    let w = mix(1.0 - u, u, vec3f(o));
    v += w.x * w.y * w.z * dot(ghash(i + o), f - vec3f(o));
  }
  return v;
}
