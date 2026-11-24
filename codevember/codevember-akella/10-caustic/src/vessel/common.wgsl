// shared: hashing, the vessel's outline, indexing into the unrolled sheets
// (Uni and the caustic's waves are written in front of this by index.ts)

@group(0) @binding(0) var<uniform> U: Uni;

const PI = 3.14159265;
const TAU = 6.28318531;

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

/** the vessel's radius over its widest, from the foot (v = 0) to the crown (v = 1) */
fn profile(v: f32) -> f32 {
  // a rounded foot, like the end of an egg
  let f = clamp(v / 0.3, 0.0, 1.0);
  var r = mix(0.5, 1.0, sqrt(1.0 - (1.0 - f) * (1.0 - f)));
  // a body nearly straight, fullest a little above the middle
  r *= 1.0 + 0.04 * sin(PI * clamp((v - 0.2) / 0.6, 0.0, 1.0));
  // a slight neck, then a crown that flares wider than the body
  r = mix(r, 0.9, smoothstep(0.62, 0.86, v));
  r = mix(r, 1.12, pow(smoothstep(0.86, 1.0, v), 1.3));
  return r;
}

/** a texel of the sheets: x wraps round the vessel, y stops at the rims, layers stack */
fn cell(x: i32, y: i32, L: i32) -> u32 {
  let W = i32(U.W);
  let H = i32(U.H);
  let xw = ((x % W) + W) % W;
  return u32((L * H + clamp(y, 0, H - 1)) * W + xw);
}

/** the shortest way round from a to b, in texels */
fn wrapd(d: f32) -> f32 { return d - U.W * round(d / U.W); }

fn skinR(v: f32, L: i32) -> f32 { return U.Rmax * profile(clamp(v, 0.0, 1.0)) * pow(U.shrink, f32(L)); }

struct Thorn {
  B: vec3f,
  a: vec3f,
  len: f32,
  r1: f32,
};

/** a knot's thorn: out of the belly, up and out of the crown, a long thread hanging from the hem */
fn thornOf(k: vec4f) -> Thorn {
  let seed = hashu(u32(k.x) * 7919u + u32(k.y) * 104729u);
  let vn = k.y / (U.H - 1.0);
  let phi = (k.x / U.W - U.rot) * TAU;
  let radial = vec3f(cos(phi), 0.0, sin(phi));
  var t: Thorn;
  t.B = radial * skinR(vn, 0) + vec3f(0.0, U.y0 + vn * U.Hlen, 0.0);
  let strength = min(k.z / U.nodeThr, 2.5);
  // each at its own slant, up or down and to either side
  let side = vec3f(-radial.z, 0.0, radial.x);
  t.a = normalize(radial + vec3f(0.0, (h01(seed ^ 5u) - 0.45) * 1.1, 0.0) + side * (h01(seed ^ 9u) - 0.5) * 0.8);
  t.r1 = 0.0025 + 0.0012 * strength;
  // never shorter than four widths, or a thorn is a bead
  t.len = max(U.thornLen * (0.35 + 0.65 * h01(seed)) * (0.5 + 0.5 * strength), t.r1 * 8.0);
  if (vn > 0.9) {
    // crown spikes flare outwards, each at its own angle and length
    let up = mix(0.35, 1.1, h01(seed ^ 21u));
    t.a = normalize(radial * (0.7 + 0.4 * h01(seed ^ 13u)) + vec3f(0.0, up, 0.0) + side * (h01(seed ^ 31u) - 0.5) * 0.5);
    t.len *= 0.8 + 1.6 * h01(seed ^ 41u) * h01(seed ^ 43u) + 0.4;
  } else if (vn < 0.1) {
    let sway = 0.25 * sin(U.time * 0.6 + f32(seed & 255u));
    t.a = normalize(vec3f(0.0, -1.0, 0.0) + radial * (0.3 + sway) + vec3f(-radial.z, 0.0, radial.x) * sway);
    t.len = U.tendril * (0.4 + 0.6 * h01(seed ^ 77u));
    t.r1 = 0.0035;
  }
  return t;
}
