// Diffraction catastrophe integrals, one per texel:
//   psi(a) = integral over real t of exp(i phi(t)),  phi(t) = t^n + a4 t^4 + a3 t^3 + a2 t^2 + a1 t
// n = 4 Pearcey (cusp), 5 swallowtail, 6 butterfly; only the a_k below n count.
//
// The contour: the real axis between -TL and TR, where the integrand has modulus 1 (no cancellation of
// big numbers), then two straight rays into the complex plane. Beyond the last real root of every derivative
// of phi, every Taylor coefficient of phi at the edge has one sign, so along a ray at an angle under pi/n
// each term adds to Im phi: the integrand only shrinks, and we stop when it is e^-stop. Panels are 3-point
// Gauss-Legendre, as wide as about `rad` radians of phase allow.

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var field: texture_storage_2d<rg32float, write>;

const PI = 3.14159265;
const GX = array<f32, 3>(-0.7745966692, 0.0, 0.7745966692);
const GW = array<f32, 3>(0.2777777778, 0.4444444444, 0.2777777778); // halved, for a panel of width w: sum GW*w

var<private> c: array<f32, 7>; // phi's coefficients, c[n] = 1
var<private> deg: i32;

fn re(t: f32) -> f32 {
  var v = 0.0;
  for (var k = deg; k >= 0; k--) { v = v * t + c[k]; }
  return v;
}
fn d1(t: f32) -> f32 {
  var v = 0.0;
  for (var k = deg; k >= 1; k--) { v = v * t + f32(k) * c[k]; }
  return v;
}
fn d2(t: f32) -> f32 {
  var v = 0.0;
  for (var k = deg; k >= 2; k--) { v = v * t + f32(k * (k - 1)) * c[k]; }
  return v;
}
fn cmul(a: vec2f, b: vec2f) -> vec2f { return vec2f(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
fn cphi(z: vec2f) -> vec2f {
  var v = vec2f(0.0);
  for (var k = deg; k >= 0; k--) { v = cmul(v, z) + vec2f(c[k], 0.0); }
  return v;
}
fn cd1(z: vec2f) -> vec2f {
  var v = vec2f(0.0);
  for (var k = deg; k >= 1; k--) { v = cmul(v, z) + vec2f(f32(k) * c[k], 0.0); }
  return v;
}
fn cd2(z: vec2f) -> vec2f {
  var v = vec2f(0.0);
  for (var k = deg; k >= 2; k--) { v = cmul(v, z) + vec2f(f32(k * (k - 1)) * c[k], 0.0); }
  return v;
}

// the k-th derivative's coefficient of t^m, made monic, evaluated by Horner (and its derivative)
fn fall(j: i32, k: i32) -> f32 {
  var v = 1.0;
  for (var i = 0; i < k; i++) { v *= f32(j - i); }
  return v;
}
fn derivAt(k: i32, t: f32) -> vec2f {
  // value and slope of phi^(k)(t) / (n!/(n-k)!)
  let lead = fall(deg, k);
  var v = 0.0;
  var s = 0.0;
  for (var j = deg; j >= k; j--) {
    s = s * t + v;
    v = v * t + c[j] * fall(j, k) / lead;
  }
  return vec2f(v, s);
}

// past the last real root of every derivative, from a bound on all of them
fn edge() -> f32 {
  // Fujiwara's bound on the roots of phi' (Gauss-Lucas: the higher derivatives' roots lie within theirs)
  var R = 0.0;
  for (var j = 1; j < deg; j++) {
    R = max(R, pow(abs(f32(j) * c[j] / f32(deg)), 1.0 / f32(deg - j)));
  }
  R = 2.0 * R + 0.05;
  var T = 0.0;
  for (var k = 1; k < deg; k++) {
    // Newton from the right walks down to the largest real root
    var t = R;
    for (var it = 0; it < 40; it++) {
      let vs = derivAt(k, t);
      if (vs.x <= 0.0 || vs.y <= 1e-12) { break; }
      let step = vs.x / vs.y;
      t -= step;
      if (step < 1e-5) { break; }
    }
    T = max(T, t);
  }
  return T;
}

var<private> evals: i32;

fn realSegment(a: f32, b: f32) -> vec2f {
  var acc = vec2f(0.0);
  var t = a;
  loop {
    if (t >= b || evals > i32(U.maxEvals)) { break; }
    let w = min(min(b - t, U.cap), U.rad / (abs(d1(t)) + sqrt(abs(d2(t))) + 0.5));
    for (var j = 0; j < 3; j++) {
      let p = re(t + w * (0.5 + 0.5 * GX[j]));
      acc += GW[j] * w * vec2f(cos(p), sin(p));
    }
    evals += 3;
    t += w;
  }
  return acc;
}

fn ray(t0: f32, ang: f32) -> vec2f {
  let e = vec2f(cos(ang), sin(ang));
  var acc = vec2f(0.0);
  var s = 0.0;
  var last = 0.0;
  loop {
    if (evals > i32(U.maxEvals)) { break; }
    let z = vec2f(t0, 0.0) + e * s;
    // the further out, the smaller the integrand, the coarser the panels may be
    let grow = 1.0 + U.grow * last;
    let w = grow * min(U.cap, U.rad / (length(cmul(cd1(z), e)) + sqrt(length(cd2(z))) + 0.5));
    for (var j = 0; j < 3; j++) {
      let p = cphi(vec2f(t0, 0.0) + e * (s + w * (0.5 + 0.5 * GX[j])));
      acc += GW[j] * w * exp(-p.y) * vec2f(cos(p.x), sin(p.x));
      last = p.y;
    }
    evals += 3;
    s += w;
    if (last > U.stop) { break; }
  }
  return cmul(acc, e);
}

fn psi(a: vec4f, n: i32) -> vec2f {
  deg = n;
  for (var k = 0; k < 7; k++) { c[k] = 0.0; }
  c[n] = 1.0;
  c[1] = a.x;
  c[2] = a.y;
  if (n >= 5) { c[3] = a.z; }
  if (n >= 6) { c[4] = a.w; }
  let TR = edge();
  // the left edge: the same for (-1)^n phi(-u), whose leading coefficient is positive
  for (var k = 1; k < n; k++) { if ((n + k) % 2 == 1) { c[k] = -c[k]; } }
  let TL = edge();
  for (var k = 1; k < n; k++) { if ((n + k) % 2 == 1) { c[k] = -c[k]; } }
  evals = 0;
  let al = U.alphaF * PI / f32(n);
  var left = PI + al;
  if (n % 2 == 1) { left = PI - al; }
  return realSegment(-TL, TR) + ray(TR, al) - ray(-TL, left);
}

// screen to control space: a slice through (a1, a2, a3, a4), bent a little
fn control(p: vec2f) -> vec4f {
  let C0 = vec4f(U.c1, U.c2, U.c3, U.c4);
  let Ux = vec4f(U.u1, U.u2, U.u3, U.u4);
  let Vy = vec4f(U.v1, U.v2, U.v3, U.v4);
  let B = vec4f(U.b1, U.b2, U.b3, U.b4);
  let q = p * U.scale;
  // two travelling sine warps: different parts of the screen cut the control space differently
  let w1 = vec4f(U.wa1, U.wa2, U.wa3, U.wa4) * sin(dot(q, vec2f(U.wakx, U.waky)) + U.waph);
  let w2 = vec4f(U.wb1, U.wb2, U.wb3, U.wb4) * sin(dot(q, vec2f(U.wbkx, U.wbky)) + U.wbph);
  let a = C0 + q.x * Ux + q.y * Vy + dot(q, q) * B + w1 + w2;
  // the slice is drawn in shape units; a wavenumber lam turns them into the integral's own, where a_k
  // scales as lam^(n-k) (t ~ lam), so lam sets how many fringes there are and nothing else
  let n = f32(U.n);
  return a * vec4f(pow(U.lam, n - 1.0), pow(U.lam, n - 2.0), pow(U.lam, n - 3.0), pow(U.lam, n - 4.0));
}

@compute @workgroup_size(8, 8)
fn integrate(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2u(u32(U.W), u32(U.H));
  if (id.x >= size.x || id.y >= size.y) { return; }
  // texel centres, in units where the screen is 2 high
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let p = vec2f((uv.x * 2.0 - 1.0) * U.ax, 1.0 - uv.y * 2.0);
  var v = psi(control(p), i32(U.n));
  if (U.showCost > 0.5) { v = vec2f(sqrt(f32(evals) / 400.0), 0.0); }
  textureStore(field, vec2i(id.xy), vec4f(v, 0.0, 0.0));
}
