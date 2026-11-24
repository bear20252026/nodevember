// shared: the glass, a ring whose lens-shaped cross-section turns as it goes round. `struct Uni` and the
// uniform binding are written out from index.ts.

const PI = 3.14159265;

fn hash(x: u32) -> u32 {
  var s = x * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn hash01(x: u32) -> f32 { return f32(hash(x)) / 4294967295.0; }

// a lens made of two circles of radius r whose centres are d either side (iq's vesica), pointed along y
fn sdVesica(p0: vec2f, r: f32, d: f32) -> f32 {
  let p = abs(p0);
  let b = sqrt(r * r - d * d);
  if ((p.y - b) * d > p.x * b) {
    return length(p - vec2f(0.0, b));
  }
  return length(p - vec2f(-d, 0.0)) - r;
}

fn toRing(p: vec3f) -> vec3f { return (U.ringRot * vec4f(p, 0.0)).xyz; }
fn fromRing(p: vec3f) -> vec3f { return (transpose(U.ringRot) * vec4f(p, 0.0)).xyz; }

fn sdGlass(pw: vec3f) -> f32 {
  let p = toRing(pw);
  let phi = atan2(p.z, p.x);
  var q = vec2f(length(p.xz) - U.ringR, p.y);
  // the cross-section turns by `twist` half... whole turns per lap; a lens looks the same turned half way,
  // so any multiple of a half turn closes
  let a = U.twist * phi + U.twistPhase;
  let c = cos(a);
  let s = sin(a);
  q = vec2f(c * q.x + s * q.y, -s * q.x + c * q.y);
  // the section swells and thins a little round the ring
  let swell = 1.0 + U.swell * sin(3.0 * phi + 0.7);
  return (sdVesica(q / swell, U.lensR, U.lensD) * swell - U.lensRound) * 0.8;
}

fn glassNormal(p: vec3f) -> vec3f {
  let e = 4e-4;
  let k = vec2f(1.0, -1.0);
  return normalize(k.xyy * sdGlass(p + k.xyy * e) + k.yyx * sdGlass(p + k.yyx * e) + k.yxy * sdGlass(p + k.yxy * e) + k.xxx * sdGlass(p + k.xxx * e));
}

// the glass lies inside this sphere
fn glassBound() -> f32 { return U.ringR + U.lensR + 0.1; }

// distances along a ray to where it enters and leaves a sphere at the origin (no hit: enter > leave)
fn sphereSpan(ro: vec3f, rd: vec3f, r: f32) -> vec2f {
  let b = dot(ro, rd);
  let c = dot(ro, ro) - r * r;
  let h = b * b - c;
  if (h < 0.0) { return vec2f(1e9, -1e9); }
  let s = sqrt(h);
  return vec2f(-b - s, -b + s);
}

// a photon's colour: one of three bands when dispersed, white otherwise
fn bandColor(photon: u32) -> vec3f {
  if (U.dispersion <= 0.0) { return vec3f(1.0); }
  let ch = (photon % u32(U.np)) % 3u;
  return vec3f(f32(ch == 0u), f32(ch == 1u), f32(ch == 2u)) * 3.0;
}
fn bandIor(photon: u32) -> f32 {
  if (U.dispersion <= 0.0) { return U.ior; }
  return U.ior + (f32((photon % u32(U.np)) % 3u) - 1.0) * U.dispersion;
}

// the slow-motion pulse: lit only just behind its front, at optical path `pulseFront`, fading behind it
fn pulseWindow(opl: f32) -> f32 {
  if (U.pulseOn < 0.5) { return 1.0; }
  let x = U.pulseFront - opl;
  let front = smoothstep(-0.015, 0.015, x);
  let trail = exp(-max(x, 0.0) / U.pulseW);
  return max(U.pulseFloor, front * trail);
}

// Henyey-Greenstein phase, cosine between the light's travel and the way to the eye
fn phaseHG(c: f32, g: f32) -> f32 {
  let d = 1.0 + g * g - 2.0 * g * c;
  return (1.0 - g * g) / (4.0 * PI * d * sqrt(d));
}
