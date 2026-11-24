// shared by every prism module; `struct Uni` is written out from index.ts

@group(0) @binding(0) var<uniform> U: Uni;
// per band: (index of refraction, r, g, b), the colours summing to white over the bands
@group(0) @binding(1) var<uniform> bands: array<vec4f, 16>;

const PI = 3.14159265;
const TAU = 6.2831853;

fn lightDir() -> vec3f { return normalize(vec3f(U.lx, U.ly, U.lz)); }
fn knotCentre() -> vec3f { return vec3f(U.cx, U.cy, U.cz); }

fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
fn rotX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

// a (2,3) torus knot, which is a trefoil, as a tube whose elliptical section twists, swells along its
// length and is warped as if it were melting. The distance is measured in the meridional plane, which
// overestimates a little, so marches step short.
fn sdKnot(p: vec3f) -> f32 {
  var q = rotX(rotY(p - knotCentre(), U.spin), U.tilt);
  q += U.melt * vec3f(sin(q.y * 4.3 + U.meltPh), sin(q.z * 3.7 - 2.0 * U.meltPh), sin(q.x * 4.1 + U.meltPh + 1.3));
  let r = length(q.xz);
  let a = atan2(q.z, q.x);
  var d = 1e9;
  for (var k = 0; k < 2; k++) {
    // t runs 0..6 pi round the whole knot; the section's twist and swelling must agree where it closes
    let t = (a + TAU * f32(k)) * 1.5;
    let c = vec2f(r - U.R, q.y) - U.r0 * vec2f(cos(t), sin(t));
    let tw = t * 0.5 + U.twistPh;
    let cs = vec2f(cos(tw), sin(tw));
    let cr = vec2f(c.x * cs.x + c.y * cs.y, -c.x * cs.y + c.y * cs.x);
    let rad = U.tube * (1.0 + U.bulge * sin(t * 4.0 / 3.0 + U.bulgePh));
    let ab = rad * vec2f(U.ex, U.ey);
    d = min(d, (length(cr / ab) - 1.0) * min(ab.x, ab.y));
  }
  return d;
}

// four taps on a tetrahedron
fn knotNormal(p: vec3f) -> vec3f {
  let e = vec2f(1.0, -1.0) * 5e-4;
  return normalize(e.xyy * sdKnot(p + e.xyy) + e.yyx * sdKnot(p + e.yyx) + e.yxy * sdKnot(p + e.yxy) + e.xxx * sdKnot(p + e.xxx));
}

// where a ray meets the knot's bounding sphere: (enter, leave), or leave < 0 for a miss
fn boundKnot(o: vec3f, d: vec3f) -> vec2f {
  let oc = o - knotCentre();
  let b = dot(oc, d);
  let c = dot(oc, oc) - U.bound * U.bound;
  let h = b * b - c;
  if (h < 0.0) { return vec2f(1.0, -1.0); }
  let s = sqrt(h);
  return vec2f(-b - s, -b + s);
}

// first surface from outside along the ray, or -1
fn marchOutside(o: vec3f, d: vec3f) -> f32 {
  let span = boundKnot(o, d);
  if (span.y < 0.0) { return -1.0; }
  var t = max(span.x, 0.0);
  for (var i = 0; i < 120; i++) {
    let h = sdKnot(o + d * t);
    if (h < 2e-4) { return t; }
    t += h * 0.6;
    if (t > span.y) { break; }
  }
  return -1.0;
}

// the way out from inside the glass, or -1
fn marchInside(o: vec3f, d: vec3f) -> f32 {
  var t = 2e-3;
  for (var i = 0; i < 56; i++) {
    let h = -sdKnot(o + d * t);
    if (h < 2e-4) { return t; }
    t += max(h * 0.7, 4e-4);
  }
  return -1.0;
}

fn fresnel(cosi: f32, eta: f32) -> f32 {
  let r0 = (1.0 - eta) / (1.0 + eta);
  let f0 = r0 * r0;
  return f0 + (1.0 - f0) * pow(1.0 - clamp(cosi, 0.0, 1.0), 5.0);
}

fn hash(x: u32) -> u32 {
  var s = x * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash01(x: u32) -> f32 { return f32(hash(x)) / 4294967295.0; }
