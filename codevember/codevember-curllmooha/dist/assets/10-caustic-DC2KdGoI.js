import"./modulepreload-polyfill-ulV_1b7r.js";import{y as pt,k as ht,c as Ne}from"./studio-presets-CDYyrMX7.js";import{P as mt,O as fe,a as vt,aP as gt,r as ke,e as xt,S as yt}from"./leva-C0l7872o.js";import"./three-C2t3z6N3.js";import{u as bt,i as wt}from"./look-DcDmlVv9.js";const St=`// Acid on a sculpture. The piece is a signed distance (Suzanne baked from a mesh, or an analytic form) cut back
// by a voxel field of how much has been eaten. Acid lives on the surface voxels: it runs down under gravity,
// spreads, eats the material (in pits, or a smooth melt for plastic) and stains it. Smoke is a second, coarser
// volume, given off where the acid bites, lifted by buoyancy and curled by turbulence.

struct Uni {
  view: vec4f,    // width, height, time, dt
  eye: vec4f,     // xyz, shape id
  fwd: vec4f,     // xyz, focal
  right: vec4f,   // xyz, smoke amount
  up: vec4f,      // xyz, concentration
  pickO: vec4f,   // xyz, pit sharpness
  pickD: vec4f,   // xyz, metallic
  inject: array<vec4f, 4>,
  drop: array<vec4f, 4>,
  albedo: vec4f,  // rgb, roughness
  f0: vec4f,      // reflectance at normal incidence (for metals, their colour), metalness
  etch: vec4f,    // freshly bitten colour, roughness of the bite
  stain: vec4f,   // stain colour, how fast it spreads
  scorch: vec4f,  // deepest burn colour, bubble amount
  crust: vec4f,   // crust colour (verdigris), amount
  acidTint: vec4f, // what the acid turns as it reacts, foam
  smokeDark: vec4f,
  smokeLit: vec4f,
  pipette: vec4f,  // dropper tip xyz, visible
  studioKey: vec4f,
  studioColor: vec4f,
  studioSweep: vec4f,
}

@group(0) @binding(0) var<uniform> u: Uni;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var suzanne: texture_3d<f32>;
@group(0) @binding(3) var volR: texture_3d<f32>;   // eaten, acid, stain, pit threshold
@group(0) @binding(4) var volW: texture_storage_3d<rgba16float, write>;
@group(0) @binding(5) var<storage, read_write> pick: array<vec4f, 1>;
@group(0) @binding(6) var smokeR: texture_3d<f32>;
@group(0) @binding(7) var smokeW: texture_storage_3d<rgba16float, write>;
@group(0) @binding(12) var<uniform> look: Look;
@group(0) @binding(11) var meshTex: texture_2d<f32>; // the shaded mesh: rgb, distance from the eye in a

const BMIN = vec3f(-0.8, -0.5, -0.8);
const BSIZE = vec3f(1.6, 1.6, 1.6);
const VOX = 0.0142857;
const SMIN = vec3f(-1.4, -0.5, -1.1);
const SSIZE = vec3f(2.8, 2.7, 2.2);
const FLOOR_Y = -0.46;

fn hash3(p: vec3f) -> vec3f {
  let q = vec3f(dot(p, vec3f(127.1, 311.7, 74.7)), dot(p, vec3f(269.5, 183.3, 246.1)), dot(p, vec3f(113.5, 271.9, 124.6)));
  return fract(sin(q) * 43758.5453);
}
fn vnoise(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let a = mix(mix(hash3(i).x, hash3(i + vec3f(1, 0, 0)).x, w.x), mix(hash3(i + vec3f(0, 1, 0)).x, hash3(i + vec3f(1, 1, 0)).x, w.x), w.y);
  let b = mix(mix(hash3(i + vec3f(0, 0, 1)).x, hash3(i + vec3f(1, 0, 1)).x, w.x), mix(hash3(i + vec3f(0, 1, 1)).x, hash3(i + vec3f(1, 1, 1)).x, w.x), w.y);
  return mix(a, b, w.z);
}
fn worley(p: vec3f) -> f32 {
  let i = floor(p);
  var best = 9.0;
  for (var z = -1; z <= 1; z++) {
    for (var y = -1; y <= 1; y++) {
      for (var x = -1; x <= 1; x++) {
        let c = i + vec3f(f32(x), f32(y), f32(z));
        best = min(best, length(c + hash3(c) - p));
      }
    }
  }
  return best;
}
fn smin(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

fn sdSuzanne(p: vec3f) -> f32 {
  let s = 0.6;
  let q = (p - vec3f(0.0, -0.02, 0.0)) / s;
  let uvw = q * (0.5 / 1.05) + 0.5;
  let inside = textureSampleLevel(suzanne, samp, clamp(uvw, vec3f(0.0), vec3f(1.0)), 0.0).r;
  let out = length(max(abs(q) - 1.05, vec3f(0.0)));
  // thickened a touch so the ears survive the acid's first bite
  return (inside + out) * s - 0.006;
}

// a spiral orb: a sphere whose radius swells in six lobes that wind round it from pole to pole
fn spiralRadius(d: vec3f) -> f32 {
  let lat = asin(clamp(d.y, -1.0, 1.0));
  let c = cos(lat);
  return 0.40 * (1.0 + 0.14 * c * c * cos(6.0 * (atan2(d.z, d.x) + 1.4 * lat)));
}
fn sdSpiral(p: vec3f) -> f32 {
  let q = p - vec3f(0.0, -0.06, 0.0);
  let l = max(length(q), 1e-4);
  return (l - spiralRadius(q / l)) * 0.55;
}

// a turned vase: a full belly, a slim neck and a flared lip
fn vaseRadius(y: f32) -> f32 {
  return 0.11 + 0.22 * exp(-pow((y + 0.12) / 0.24, 2.0)) + 0.05 * smoothstep(0.3, 0.52, y) - 0.03 * smoothstep(0.1, 0.3, y);
}
fn sdVase(p: vec3f) -> f32 {
  let y = clamp(p.y, -0.46, 0.52);
  let side = (length(p.xz) - vaseRadius(y)) * 0.85;
  return max(side, max(-0.46 - p.y, p.y - 0.52));
}

fn baseSDF(p: vec3f) -> f32 {
  let id = u32(u.eye.w);
  if (id == 1u) { return sdVase(p); }
  if (id == 2u) { return sdSpiral(p); }
  return sdSuzanne(p);
}

fn vol(p: vec3f) -> vec4f { return textureSampleLevel(volR, samp, (p - BMIN) / BSIZE, 0.0); }

// the piece minus what the acid has taken: a voxel is gone once its eaten amount passes its own threshold
fn sceneSDF(p: vec3f) -> f32 {
  let s = vol(p);
  return max(baseSDF(p), (s.x - s.w) * 0.065);
}

// ---- acid ----

fn voxCentre(c: vec3i) -> vec3f { return BMIN + (vec3f(c) + 0.5) * VOX; }
fn ldv(c: vec3i) -> vec4f {
  let n = vec3i(textureDimensions(volR));
  return textureLoad(volR, clamp(c, vec3i(0), n - 1), 0);
}
fn surfDist(c: vec3i) -> f32 {
  let s = ldv(c);
  return max(baseSDF(voxCentre(c)), (s.x - s.w) * 0.065);
}
fn isSurf(d: f32) -> bool { return d > -2.2 * VOX && d < 0.9 * VOX; }

@compute @workgroup_size(4, 4, 4)
fn initCS(@builtin(global_invocation_id) gid: vec3u) {
  let n = vec3i(textureDimensions(volR));
  let c = vec3i(gid);
  if (any(c >= n)) { return; }
  let p = voxCentre(c);
  // a cellular threshold gives metal and stone rounded pits; plastic (low sharpness) gets a smooth, slumped melt
  let cells = smoothstep(0.15, 0.85, worley(p * 15.0)) + 0.4 * (vnoise(p * 34.0) - 0.5);
  let slump = (vnoise(p * 7.0) - 0.5) * 1.5 + 0.5;
  let pits = mix(slump, cells, u.pickO.w);
  let thr = 0.55 + (pits - 0.5) * (0.22 + 0.58 * u.pickO.w);
  textureStore(volW, c, vec4f(0.0, 0.0, 0.0, thr));
}

@compute @workgroup_size(4, 4, 4)
fn updateCS(@builtin(global_invocation_id) gid: vec3u) {
  let n = vec3i(textureDimensions(volR));
  let c = vec3i(gid);
  if (any(c >= n)) { return; }
  let dt = u.view.w;
  let stepScale = min(dt * 60.0, 2.0);
  var s = ldv(c);
  let p = voxCentre(c);
  var acid = s.y;
  var stain = s.z;

  if (isSurf(surfDist(c))) {
    let flow = min(0.2, 2.4 * dt);
    let dDown = surfDist(c - vec3i(0, 1, 0));
    if (isSurf(dDown)) { acid -= flow * s.y; } else if (dDown > 0.9 * VOX) { acid -= flow * 0.25 * s.y; }
    let upC = c + vec3i(0, 1, 0);
    if (isSurf(surfDist(upC))) { acid += flow * ldv(upC).y; }
    let offs = array<vec3i, 6>(vec3i(1, 0, 0), vec3i(-1, 0, 0), vec3i(0, 0, 1), vec3i(0, 0, -1), vec3i(0, 1, 0), vec3i(0, -1, 0));
    var stainSum = 0.0;
    for (var k = 0; k < 6; k++) {
      let nc = c + offs[k];
      let ns = ldv(nc);
      let nd = surfDist(nc);
      if (isSurf(nd)) { acid += 0.07 * stepScale * (ns.y - s.y); } else if (nd > 0.9 * VOX) { acid += stepScale * ns.y / 6.0; }
      stainSum += ns.z;
    }
    if (baseSDF(p) < VOX) { s.x = min(s.x + 1.5 * s.y * u.up.w * dt, 1.6); }
    acid -= 0.12 * s.y * dt;
    stain = min(1.0, stain + 1.2 * s.y * u.up.w * dt + u.stain.w * stepScale * (stainSum / 6.0 - stain));
    for (var i = 0; i < 4; i++) {
      let inj = u.inject[i];
      if (inj.w > 0.0) {
        let e = p - inj.xyz;
        acid += inj.w * exp(-dot(e, e) / (0.05 * 0.05));
      }
    }
  } else {
    acid = 0.0;
  }
  textureStore(volW, c, vec4f(s.x, clamp(acid, 0.0, 4.0), stain, s.w));
}

@compute @workgroup_size(1)
fn pickCS() {
  var t = 0.0;
  let ro = u.pickO.xyz;
  let rd = normalize(u.pickD.xyz);
  var hit = vec4f(0.0);
  for (var i = 0; i < 220; i++) {
    let p = ro + rd * t;
    let d = sceneSDF(p);
    if (d < 0.002) { hit = vec4f(p, 1.0); break; }
    t += max(d * 0.7, 0.004);
    if (t > 12.0) { break; }
  }
  pick[0] = hit;
}

// ---- smoke ----

fn curlNoise(q: vec3f) -> vec3f {
  let e = 0.05;
  let a = vec3f(vnoise(q + vec3f(0.0, e, 0.0)) - vnoise(q - vec3f(0.0, e, 0.0)), vnoise(q + vec3f(0.0, 0.0, e)) - vnoise(q - vec3f(0.0, 0.0, e)), vnoise(q + vec3f(e, 0.0, 0.0)) - vnoise(q - vec3f(e, 0.0, 0.0)));
  let b = vec3f(vnoise(q + vec3f(31.0, e, 0.0)) - vnoise(q + vec3f(31.0, -e, 0.0)), vnoise(q + vec3f(31.0, 0.0, e)) - vnoise(q + vec3f(31.0, 0.0, -e)), vnoise(q + vec3f(31.0 + e, 0.0, 0.0)) - vnoise(q + vec3f(31.0 - e, 0.0, 0.0)));
  return vec3f(a.y - b.z, a.z - b.x, a.x - b.y) / (2.0 * e);
}

@compute @workgroup_size(4, 4, 4)
fn clearSmokeCS(@builtin(global_invocation_id) gid: vec3u) {
  if (any(gid >= textureDimensions(smokeW))) { return; }
  textureStore(smokeW, vec3i(gid), vec4f(0.0));
}

@compute @workgroup_size(4, 4, 4)
fn smokeCS(@builtin(global_invocation_id) gid: vec3u) {
  let n = vec3i(textureDimensions(smokeR));
  let c = vec3i(gid);
  if (any(c >= n)) { return; }
  let dt = u.view.w;
  let t = u.view.z;
  let uvw = (vec3f(c) + 0.5) / vec3f(n);
  let p = SMIN + uvw * SSIZE;
  let here = textureLoad(smokeR, c, 0);
  // buoyancy from heat, a slow draught, and two scales of curl that twist the plume into wisps
  let v = vec3f(0.05, 0.16 + 0.8 * here.y, 0.02)
    + curlNoise(p * 2.0 + vec3f(0.0, -t * 0.3, t * 0.08)) * (0.08 + 0.2 * here.y)
    + curlNoise(p * 5.0 + vec3f(7.0, -t * 0.6, 0.0)) * 0.035;
  var s = textureSampleLevel(smokeR, samp, (p - v * dt - SMIN) / SSIZE, 0.0);
  let a = vol(p);
  let reaction = smoothstep(0.18, 0.72, a.z);
  let src = min(a.y * 4.0, 1.8) * reaction * smoothstep(0.1, 0.0, abs(sceneSDF(p))) * u.right.w;
  s.x = (s.x + src * 1.6 * dt) * exp(-dt * 0.45);
  s.y = (s.y + src * 4.0 * dt) * exp(-dt * 0.9);
  let m = min(uvw, 1.0 - uvw);
  s.x *= smoothstep(0.0, 0.06, min(m.x, min(m.y, m.z)));
  textureStore(smokeW, c, vec4f(s.x, s.y, 0.0, 0.0));
}

fn smoke(p: vec3f) -> f32 {
  let s = textureSampleLevel(smokeR, samp, (p - SMIN) / SSIZE, 0.0).x;
  let w = vnoise(p * 9.0 + vec3f(0.0, -u.view.z * 0.5, 0.0)) * 0.65 + vnoise(p * 23.0 + vec3f(0.0, -u.view.z, 0.0)) * 0.35;
  return s * smoothstep(0.3, 0.8, w) * 1.8;
}

// ---- picture ----

struct VOut { @builtin(position) pos: vec4f }

@vertex
fn fullVS(@builtin(vertex_index) vi: u32) -> VOut {
  var o: VOut;
  let p = vec2f(f32((vi << 1u) & 2u), f32(vi & 2u));
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  return o;
}

// a falling drop: round at the bottom, drawn to a point above, longer the faster it goes
fn dropSDF(p: vec3f) -> f32 {
  var d = 9.0;
  for (var i = 0; i < 4; i++) {
    let dr = u.drop[i];
    if (dr.w > 0.0) {
      let q = p - dr.xyz;
      let stretch = 1.0 + dr.w * 0.35;
      let y = q.y / stretch;
      let r = 0.032 * (1.0 - 0.55 * smoothstep(-0.2, 1.0, y / 0.032));
      d = min(d, (length(vec3f(q.x, y, q.z)) - r) * 0.8);
    }
  }
  return d;
}

fn normalAt(p: vec3f) -> vec3f {
  let e = vec2f(0.012, 0.0); // about a voxel, so the interpolation lattice does not show
  return normalize(vec3f(sceneSDF(p + e.xyy) - sceneSDF(p - e.xyy), sceneSDF(p + e.yxy) - sceneSDF(p - e.yxy), sceneSDF(p + e.yyx) - sceneSDF(p - e.yyx)));
}

fn shadow(p: vec3f, l: vec3f) -> f32 {
  var res = 1.0;
  var t = 0.03;
  for (var i = 0; i < 40; i++) {
    let d = sceneSDF(p + l * t);
    res = min(res, 9.0 * d / (t * u.studioKey.w));
    if (res < 0.01) { break; }
    t += clamp(d, 0.01, 0.12);
    if (t > 2.5) { break; }
  }
  return clamp(res, 0.0, 1.0);
}

fn occlusion(p: vec3f, n: vec3f) -> f32 {
  var o = 0.0;
  var w = 1.0;
  for (var i = 1; i <= 5; i++) {
    let h = 0.012 * f32(i * i);
    o += w * (h - sceneSDF(p + n * h));
    w *= 0.7;
  }
  return clamp(1.0 - o * 3.0, 0.0, 1.0);
}

fn boxRange(ro: vec3f, rd: vec3f, bmin: vec3f, bmax: vec3f) -> vec2f {
  let inv = 1.0 / rd;
  let t0 = (bmin - ro) * inv;
  let t1 = (bmax - ro) * inv;
  let tn = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tf = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  return vec2f(max(tn, 0.0), tf);
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

// ---- light: the studio from Shatter (day 2), written out as a function of direction ----
// A big round softbox front left, a smaller round fill on the right, a ceiling panel and dim walls. \`rough\`
// widens every edge, which stands in for a prefiltered environment.

fn softDisc(d: vec3f, centre: vec3f, radius: f32, blur: f32) -> f32 {
  let c = normalize(centre);
  let ang = acos(clamp(dot(d, c), -1.0, 1.0));
  let size = atan(radius / length(centre));
  // a wider blur spreads the same light thinner
  let spread = size * size / (size * size + blur * blur * 0.6);
  return (1.0 - smoothstep(size - blur, size + blur, ang)) * mix(1.0, spread, smoothstep(0.0, 0.5, blur));
}

fn studio(d: vec3f, rough: f32) -> vec3f {
  let blur = 0.02 + rough * 0.9;
  // walls: paler overhead, darker toward the horizon so the piece's edges read
  var col = mix(vec3f(0.16, 0.165, 0.175), vec3f(0.44, 0.45, 0.47), smoothstep(-0.1, 0.75, d.y));
  // dark flags left-behind and right-behind, the way a product shot frames polished metal
  let flag = max(softDisc(d, vec3f(-9.0, 1.5, -6.0), 5.0, blur), softDisc(d, vec3f(8.0, 3.0, -7.0), 4.0, blur));
  col *= 1.0 - 0.8 * flag;
  // ceiling panel
  let m = max(abs(d.x), abs(d.z)) / max(d.y, 1e-3);
  col = mix(col, vec3f(1.25), (1.0 - smoothstep(1.08 - blur * 2.0, 1.08 + blur * 2.0, m)) * step(0.0, d.y));
  col = mix(col, vec3f(1.05, 1.07, 1.1), softDisc(d, vec3f(9.0, 2.0, 6.0), 4.0, blur));
  col = mix(col, mix(vec3f(3.4, 3.35, 3.25), u.studioColor.rgb * 1.48, u.studioSweep.w), softDisc(d, u.studioKey.xyz, 6.5 * u.studioKey.w, blur));
  return col;
}

fn irradiance(n: vec3f) -> vec3f {
  let key = max(dot(n, normalize(u.studioKey.xyz)) * 0.5 + 0.5, 0.0);
  return vec3f(0.34, 0.345, 0.36) * u.studioColor.w + vec3f(0.95, 0.93, 0.9) * key * key + vec3f(0.3) * max(n.y, 0.0);
}

// the floor as lit, which is what anything sees when it looks down
fn floorLight() -> vec3f {
  return u.studioSweep.rgb * (irradiance(vec3f(0.0, 1.0, 0.0)) * 0.3 + u.studioColor.rgb * normalize(u.studioKey.xyz).y / 3.14159);
}

// the studio as the piece sees it: softboxes above the horizon, our floor below
fn envLook(d: vec3f, rough: f32) -> vec3f {
  return mix(studio(d, rough), floorLight() * 0.75, smoothstep(0.02, -0.12 - rough * 0.3, d.y));
}

// split-sum BRDF, Karis's analytic fit
fn envBRDF(f0: vec3f, rough: f32, ndv: f32) -> vec3f {
  let r = rough * vec4f(-1.0, -0.0275, -0.572, 0.022) + vec4f(1.0, 0.0425, 1.04, -0.04);
  let a004 = min(r.x * r.x, exp2(-9.28 * ndv)) * r.x + r.y;
  let ab = vec2f(-1.04, 1.04) * a004 + r.zw;
  return f0 * ab.x + ab.y;
}

fn ggx(n: vec3f, v: vec3f, l: vec3f, rough: f32) -> f32 {
  let h = normalize(v + l);
  let a = max(rough * rough, 0.002);
  let nh = max(dot(n, h), 0.0);
  let d = a * a / (3.14159 * pow(nh * nh * (a * a - 1.0) + 1.0, 2.0));
  return d * 0.25 / max(dot(n, l) * dot(n, v), 0.05) * max(dot(n, l), 0.0);
}


// the seamless warm-grey sweep behind the piece
fn backdrop(rd: vec3f, sp: vec2f) -> vec3f {
  let glow = exp(-dot(sp - vec2f(0.05, -0.1), sp - vec2f(0.05, -0.1)) * 1.6);
  return floorLight() * (0.26 + 0.4 * glow);
}

// bubbles on the live acid: little domes that swell and pop, each on its own clock.
// Returns the dome's height (0 off a bubble) and its outward tilt.
fn bubble(p: vec3f, t: f32) -> vec4f {
  let q = p * 46.0;
  let i = floor(q);
  let f = fract(q);
  let h = hash3(i);
  let phase = fract(t * (0.5 + h.y * 0.8) + h.z);
  let r = 0.12 + 0.32 * phase;
  let v = f - (0.3 + 0.4 * h);
  let d = length(v);
  if (h.x > 0.38 || d > r) { return vec4f(0.0); }
  return vec4f(sqrt(r * r - d * d) / r, v / r);
}

fn shade(p: vec3f, rd: vec3f, n: vec3f) -> vec3f {
  let v = -rd;
  let s = vol(p);
  let t = u.view.z;
  let bitten = smoothstep(0.03, 0.6, s.x);
  let acid = smoothstep(0.01, 0.3, s.y);
  let stain = smoothstep(0.0, 1.0, s.z);
  // roughness of a bitten surface: rough materials crumble, smooth ones (plastic) slump and stay glossy
  let crumble = clamp(u.etch.w * 1.4, 0.12, 1.0);
  let grit = 1.0 + (0.82 + 0.36 * vnoise(p * 150.0) - 1.0) * crumble;

  // the material: f0.x is how veined it is, f0.y how much light scatters inside it, f0.z a clear coat
  var alb = u.albedo.rgb * (0.97 + 0.05 * vnoise(p * 30.0));
  let veinAmt = u.f0.x;
  if (veinAmt > 0.0) {
    // veins run in long curving bands, with fine hairlines beside them
    let warp = vnoise(p * 4.0) * 1.6 + vnoise(p * 11.0) * 0.45;
    let band = dot(p, normalize(vec3f(1.0, 0.45, 0.3))) * 4.5 + warp * 1.8;
    let vein = (1.0 - smoothstep(0.0, 0.05, abs(fract(band) - 0.5) - 0.0)) * smoothstep(0.35, 0.65, vnoise(p * 7.0 + 3.0));
    let hair = (1.0 - smoothstep(0.0, 0.018, abs(fract(band * 2.7 + 0.3) - 0.5))) * 0.5;
    alb = mix(alb, vec3f(0.50, 0.50, 0.54), (vein * 0.6 + hair * smoothstep(0.4, 0.7, vnoise(p * 9.0))) * veinAmt * 0.55);
  }
  var metal = u.f0.w;
  // polish is never perfect: broad swirls of slightly different roughness
  var rough = u.albedo.w * (0.75 + 0.5 * vnoise(p * vec3f(40.0, 7.0, 40.0)) + 0.25 * vnoise(p * 9.0));
  alb = mix(alb, u.etch.rgb * grit, bitten);
  rough = mix(rough, u.etch.w, bitten);
  alb = mix(alb, u.stain.rgb * grit, smoothstep(0.1, 0.55, stain));
  alb = mix(alb, u.scorch.rgb * grit, smoothstep(0.5, 1.0, stain) * 0.9);
  rough = mix(rough, 0.7, smoothstep(0.2, 0.8, stain));
  metal *= 1.0 - smoothstep(0.25, 0.75, stain) * 0.8;
  // tarnish blooms with a thin-film tint at its edge
  let film = smoothstep(0.12, 0.3, stain) * smoothstep(0.55, 0.3, stain);
  let phase = 6.0 * stain + 2.0 * vnoise(p * 20.0);
  alb = mix(alb, alb * (0.55 + 0.45 * vec3f(sin(phase), sin(phase + 2.1), sin(phase + 4.2)) * 0.5 + 0.5) * vec3f(0.95, 0.8, 1.15), film * u.crust.w);
  let crustMask = smoothstep(0.25, 0.6, stain) * (1.0 - acid) * smoothstep(0.45, 0.7, vnoise(p * 45.0) + 0.25 * (1.0 - bitten)) * u.crust.w;
  alb = mix(alb, u.crust.rgb * grit, crustMask);
  metal *= 1.0 - crustMask;
  rough = mix(rough, 0.95, crustMask);

  let l = normalize(u.studioKey.xyz);
  let sh = shadow(p + n * 0.012, l);
  let ao = occlusion(p, n);
  let ndv = max(dot(n, v), 0.001);
  let f0 = mix(vec3f(0.04), alb, metal);
  let r = reflect(rd, n);
  // soft light going into the material and coming back out (marble, plastic) wraps past the terminator
  let wrap = max(dot(n, l) * 0.5 + 0.5, 0.0);
  let lit = mix(max(dot(n, l), 0.0), wrap * wrap, u.f0.y);
  var col = alb * (1.0 - metal) * (irradiance(n) * ao + u.studioColor.rgb * lit * sh / 3.14159);
  col += alb * u.f0.y * (1.0 - metal) * vec3f(0.12, 0.07, 0.04) * wrap * ao;
  col += envLook(r, rough) * envBRDF(f0, rough, ndv) * mix(1.0, ao, 0.75) * (0.55 + 0.45 * sh);
  col += u.studioColor.rgb * f0 * ggx(n, v, l, max(rough, 0.25)) * sh * (1.0 - metal);
  // plastic's glossy clear coat
  if (u.f0.z > 0.0) {
    col += envLook(r, 0.04) * (0.04 + 0.96 * pow(1.0 - ndv, 5.0)) * u.f0.z * ao;
  }

  // ---- the acid: a real liquid film ----
  if (acid > 0.001) {
    let thick = s.y;
    // light goes down through the liquid to the surface and back: it takes the acid's colour, more the deeper it is
    col *= mix(vec3f(1.0), pow(u.acidTint.rgb, vec3f(0.5 + thick * 1.6)), acid);
    // the surface of the liquid: it bulges where there is more acid, and climbs toward the edge of a patch (meniscus)
    let e = 0.011;
    let g = vec3f(vol(p + vec3f(e, 0.0, 0.0)).y - vol(p - vec3f(e, 0.0, 0.0)).y,
                  vol(p + vec3f(0.0, e, 0.0)).y - vol(p - vec3f(0.0, e, 0.0)).y,
                  vol(p + vec3f(0.0, 0.0, e)).y - vol(p - vec3f(0.0, 0.0, e)).y) / (2.0 * e);
    let gt = g - n * dot(g, n);
    var nw = normalize(n - gt * 0.045);
    // beads, rivulets: low ridges the liquid gathers into as it runs
    let ripple = (vnoise(p * vec3f(38.0, 14.0, 38.0) + vec3f(0.0, -t * 0.8, 0.0)) - 0.5) * 0.8;
    nw = normalize(nw + cross(n, vec3f(0.0, 1.0, 0.0)) * ripple * 0.12 * acid);
    // bubbles: glossy domes that swell and pop
    let b = bubble(p, t) * u.scorch.w * max(smoothstep(0.3, 0.7, crumble), 0.55 * smoothstep(0.12, 0.65, thick));
    if (b.x > 0.001) {
      let tilt = vec3f(b.y, b.z, b.w);
      nw = normalize(nw * (1.0 + 2.0 * b.x) + (tilt - nw * dot(tilt, nw)) * 1.4);
    }
    let cv = max(dot(nw, v), 0.001);
    let fres = 0.045 + 0.955 * pow(1.0 - cv, 5.0);
    let rc = reflect(rd, nw);
    // a clear liquid is nearly invisible straight on and a mirror at grazing angles
    col = col * (1.0 - fres * acid) + envLook(rc, 0.02) * fres * acid * ao;
    // the contact line round a patch: a hairline of shadow, with a bright rim of light caught in the meniscus
    let rim = smoothstep(0.015, 0.07, s.y) * smoothstep(0.30, 0.09, s.y);
    col *= 1.0 - 0.22 * rim;
    col += envLook(reflect(rd, normalize(n - gt * 0.12)), 0.05) * 0.35 * rim * ao;
    col += u.studioColor.rgb * 0.11 * rim * max(dot(nw, l), 0.0) * sh;
    // foam, where bubbles crowd and along the fizzing edge
    let fizz = smoothstep(0.35, 0.06, s.y) * smoothstep(0.55, 0.8, vnoise(p * 110.0 + vec3f(0.0, t * 0.4, 0.0)));
    col = mix(col, u.acidTint.rgb * (irradiance(n) * 0.8 + u.studioColor.rgb * 0.22 * sh), fizz * u.acidTint.w * 0.55 * max(smoothstep(0.3, 0.7, crumble), 0.38 * acid));
    // spent acid is hot: a deep ember in the fiercest bites
    col += vec3f(1.0, 0.32, 0.05) * smoothstep(0.9, 2.6, s.y) * stain * 0.35;
  }
  return col;
}

@fragment
fn displayFS(in: VOut) -> @location(0) vec4f {
  let res = u.view.xy;
  let sp = (in.pos.xy - 0.5 * res) / res.y;
  let ro = u.eye.xyz;
  let rd = normalize(u.fwd.xyz * u.fwd.w + u.right.xyz * sp.x - u.up.xyz * sp.y);
  let l = normalize(u.studioKey.xyz);
  let time = u.view.z;

  var tFloor = 1e9;
  if (rd.y < 0.0) { tFloor = (FLOOR_Y - ro.y) / rd.y; }

  var hit = false;
  var isDrop = false;
  let range = boxRange(ro, rd, BMIN - vec3f(0.08), BMIN + BSIZE + vec3f(0.08, 0.75, 0.08));
  var t = range.x;
  let hasDrops = max(max(u.drop[0].w, u.drop[1].w), max(u.drop[2].w, u.drop[3].w)) > 0.0;
  if (hasDrops && range.y > range.x) {
    for (var i = 0; i < 72; i++) {
      let p = ro + rd * t;
      let b = dropSDF(p);
      let m = b;
      if (m < 0.001) { hit = true; isDrop = true; break; }
      t += m * 0.75;
      if (t > range.y || t > tFloor) { break; }
    }
  }

  var col = backdrop(rd, sp);
  var tEnd = 1e9;
  let mesh = textureLoad(meshTex, vec2i(in.pos.xy), 0);
  if (mesh.a < 1e5 && mesh.a < tFloor && (!hit || mesh.a < t)) {
    hit = false;
    tEnd = mesh.a;
    col = mesh.rgb;
  }
  if (hit) {
    tEnd = t;
    let p = ro + rd * t;
    if (isDrop) {
      let e = vec2f(0.002, 0.0);
      let n = normalize(vec3f(dropSDF(p + e.xyy) - dropSDF(p - e.xyy), dropSDF(p + e.yxy) - dropSDF(p - e.yxy), dropSDF(p + e.yyx) - dropSDF(p - e.yyx)));
      let fres = 0.04 + 0.96 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
      // a clear, faintly yellow bead: mostly the room bent through it, plus its reflection
      col = backdrop(rd, sp) * vec3f(0.92, 0.9, 0.62) * (0.55 + 0.45 * max(dot(n, -rd), 0.0)) + envLook(reflect(rd, n), 0.03) * (fres + 0.06);
    } else {
      col = shade(p, rd, normalAt(p));
    }
  } else if (tEnd > 1e8 && tFloor < 1e8) {
    tEnd = tFloor;
    let p = ro + rd * tFloor;
    let sh = shadow(p + vec3f(0.0, 0.002, 0.0), l);
    let near = clamp(sceneSDF(p + vec3f(0.0, 0.04, 0.0)) / 0.1, 0.0, 1.0);
    let pool = exp(-dot(p.xz - vec2f(0.0, 0.1), p.xz - vec2f(0.0, 0.1)) / 2.5);
    let ao = 0.5 + 0.5 * near;
    col = u.studioSweep.rgb * (irradiance(vec3f(0.0, 1.0, 0.0)) * 0.3 * ao + u.studioColor.rgb * l.y * sh / 3.14159 * (0.5 + 0.5 * pool));
    col = mix(col, backdrop(rd, sp), smoothstep(2.0, 6.0, tFloor));
  }

  // smoke: marched up to whatever is behind, lit by a short march toward the key light
  if (u.right.w > 0.0) {
    let sr = boxRange(ro, rd, SMIN, SMIN + SSIZE);
    let t1 = min(sr.y, tEnd);
    if (t1 > sr.x) {
      let steps = 44;
      let dtS = (t1 - sr.x) / f32(steps);
      let jitter = fract(sin(dot(in.pos.xy + fract(time) * 13.0, vec2f(12.9898, 78.233))) * 43758.5453);
      var trans = 1.0;
      var light = vec3f(0.0);
      for (var i = 0; i < steps; i++) {
        let p = ro + rd * (sr.x + (f32(i) + jitter) * dtS);
        let d = smoke(p) * 11.0;
        if (d < 0.002) { continue; }
        var od = 0.0;
        for (var k = 1; k <= 4; k++) { od += smoke(p + l * 0.08 * f32(k)) * 11.0 * 0.08; }
        let lit = exp(-od * 1.4);
        let c = mix(u.smokeDark.rgb, u.smokeLit.rgb, lit) * (irradiance(vec3f(0.0, 1.0, 0.0)) * 0.35 + u.studioColor.rgb * 0.25 * lit);
        let a = 1.0 - exp(-d * dtS);
        light += trans * a * c;
        trans *= 1.0 - a;
        if (trans < 0.02) { break; }
      }
      col = col * trans + light;
    }
  }

  let vig = 1.0 - 0.25 * smoothstep(0.35, 1.05, length(sp));
  let graded = lookGrade(col * vig, in.pos.xy / res, look);
  var shown = pow(aces(graded), vec3f(1.0 / 2.2));
  if (look.b.y > 0.5) { shown = lookTone(graded, look.b.y); }
  let grain = fract(sin(dot(in.pos.xy + time, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5;
  return vec4f(shown + grain * 0.01 + lookGrain(in.pos.xy, time, look), 1.0);
}

// ---- the piece as a real mesh: exact model and normals; where the acid has eaten, trace down into the pit ----

struct MeshOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
}

@vertex
fn meshVS(@location(0) position: vec3f, @location(1) normal: vec3f) -> MeshOut {
  var o: MeshOut;
  let rel = position - u.eye.xyz;
  let x = dot(rel, u.right.xyz);
  let y = dot(rel, u.up.xyz);
  let z = dot(rel, u.fwd.xyz);
  let aspect = u.view.x / u.view.y;
  o.pos = vec4f(u.fwd.w * x / aspect * 2.0, u.fwd.w * y * 2.0, (z - 0.05) / 30.0 * z, z);
  o.world = position;
  o.normal = normal;
  return o;
}

struct MeshFrag {
  @location(0) color: vec4f,
  @builtin(frag_depth) depth: f32,
}

@fragment
fn meshFS(in: MeshOut) -> MeshFrag {
  let rd = normalize(in.world - u.eye.xyz);
  var p = in.world;
  var n = normalize(in.normal);
  var o: MeshFrag;
  o.depth = in.pos.z;
  let s = vol(p);
  if (s.x > s.w * 0.92) {
    // eaten here: find the floor of the pit
    var t = 0.0;
    var found = false;
    for (var i = 0; i < 64; i++) {
      let d = sceneSDF(p + rd * t);
      if (d < 0.0008) { found = true; break; }
      t += max(d * 0.8, 0.002);
      if (t > 0.6) { break; }
    }
    if (!found) {
      o.color = vec4f(0.0, 0.0, 0.0, 1e6);
      o.depth = 1.0;
      return o;
    }
    p = p + rd * t;
    n = normalAt(p);
    let z = dot(p - u.eye.xyz, u.fwd.xyz);
    o.depth = clamp((z - 0.05) / 30.0, 0.0, 1.0);
  }
  o.color = vec4f(shade(p, rd, n), length(p - u.eye.xyz));
  return o;
}
`,kt=""+new URL(""+new URL("suzane-C3RaJ3Fv.glb",import.meta.url).href,import.meta.url).href;function zt(t){const e=new DataView(t).getUint32(12,!0),r=JSON.parse(new TextDecoder().decode(new Uint8Array(t,20,e))),o=20+e+8,s=(l,b)=>{const i=r.accessors[l],c=r.bufferViews[i.bufferView],g={SCALAR:1,VEC2:2,VEC3:3}[i.type],v=o+(c.byteOffset??0)+(i.byteOffset??0);return new b(t.slice(v,v+i.count*g*b.BYTES_PER_ELEMENT))},f=r.meshes[0].primitives[0],a=r.accessors[f.indices].componentType===5125?Uint32Array:Uint16Array;return{positions:Array.from(s(f.attributes.POSITION,Float32Array)),index:Array.from(s(f.indices,a))}}function Mt({positions:t,index:e}){const r=new Map,o=[],s=[];for(let a=0;a<t.length;a+=3){const l=`${Math.round(t[a]*1e4)},${Math.round(t[a+1]*1e4)},${Math.round(t[a+2]*1e4)}`;r.has(l)||(r.set(l,s.length/3),s.push(t[a],t[a+1],t[a+2])),o.push(r.get(l))}const f=[];for(let a=0;a<e.length;a+=3){const l=o[e[a]],b=o[e[a+1]],i=o[e[a+2]];l!==b&&b!==i&&i!==l&&f.push(l,b,i)}return{positions:s,index:f}}function Dt({positions:t,index:e}){const r=t.length/3,o=new Map,s=Array.from({length:r},()=>new Set),f=(i,c)=>i<c?i*1e7+c:c*1e7+i;for(let i=0;i<e.length;i+=3){const c=[e[i],e[i+1],e[i+2]];for(let g=0;g<3;g++){const v=c[g],m=c[(g+1)%3],x=c[(g+2)%3];s[v].add(m),s[m].add(v);const u=f(v,m);o.has(u)||o.set(u,{a:v,b:m,opposite:[],mid:-1}),o.get(u).opposite.push(x)}}const a=[],l=(i,c)=>t[i*3+c];for(let i=0;i<r;i++){const c=s[i].size,g=c===3?3/16:3/(8*Math.max(c,1)),v=[0,0,0];for(const m of s[i])for(let x=0;x<3;x++)v[x]+=l(m,x);for(let m=0;m<3;m++)a.push(l(i,m)*(1-c*g)+v[m]*g)}for(const i of o.values()){i.mid=a.length/3;for(let c=0;c<3;c++)a.push(i.opposite.length===2?(l(i.a,c)+l(i.b,c))*3/8+(l(i.opposite[0],c)+l(i.opposite[1],c))/8:(l(i.a,c)+l(i.b,c))/2)}const b=[];for(let i=0;i<e.length;i+=3){const c=e[i],g=e[i+1],v=e[i+2],m=o.get(f(c,g)).mid,x=o.get(f(g,v)).mid,u=o.get(f(v,c)).mid;b.push(c,m,u,m,g,x,u,x,v,m,x,u)}return{positions:a,index:b}}function Ct(t,e){let r=Mt(zt(t));const o=[1/0,1/0,1/0],s=[-1/0,-1/0,-1/0];for(let a=0;a<r.positions.length;a+=3)for(let l=0;l<3;l++)o[l]=Math.min(o[l],r.positions[a+l]),s[l]=Math.max(s[l],r.positions[a+l]);const f=1.9/Math.max(s[0]-o[0],s[1]-o[1],s[2]-o[2]);for(let a=0;a<e;a++)r=Dt(r);return{positions:Float32Array.from(r.positions,(a,l)=>(a-(o[l%3]+s[l%3])/2)*f),index:Uint32Array.from(r.index)}}function Pt(t,e){const r=new Float32Array(t.length);for(let o=0;o<e.length;o+=3){const s=e[o]*3,f=e[o+1]*3,a=e[o+2]*3,l=t[f]-t[s],b=t[f+1]-t[s+1],i=t[f+2]-t[s+2],c=t[a]-t[s],g=t[a+1]-t[s+1],v=t[a+2]-t[s+2],m=[b*v-i*g,i*c-l*v,l*g-b*c];for(const x of[s,f,a])r[x]+=m[0],r[x+1]+=m[1],r[x+2]+=m[2]}for(let o=0;o<r.length;o+=3){const s=Math.hypot(r[o],r[o+1],r[o+2])||1;r[o]/=s,r[o+1]/=s,r[o+2]/=s}return r}const Ft=wt+St,Me=bt(),B=new URLSearchParams(location.search),T=B.has("thumb"),Et=matchMedia("(prefers-reduced-motion: reduce)").matches,h=document.querySelector("canvas"),We=document.querySelector("#error"),Ze=document.querySelector("#loading"),$e=document.querySelector("#fresh");T&&document.body.classList.add("capture");const ze=[112,112,112],ue=[112,80,52],O=96,he=["Suzanne","Vase","Spiral"],Ee={Silver:{albedo:[.972,.96,.915,.11],f0:[0,0,0,1],etch:[.7,.7,.69,.62],stain:[.17,.155,.17,.006],scorch:[.03,.028,.032,.9],crust:[.27,.22,.34,.5],acidTint:[.93,.95,.9,.45],smokeDark:[.3,.31,.33],smokeLit:[.93,.94,.96],pits:1},Gold:{albedo:[1,.71,.29,.12],f0:[0,0,0,1],etch:[.8,.46,.22,.6],stain:[.36,.17,.06,.004],scorch:[.07,.04,.025,.9],crust:[0,0,0,0],acidTint:[.98,.82,.3,.5],smokeDark:[.26,.17,.05],smokeLit:[.97,.8,.42],pits:1},Plastic:{albedo:[.035,.15,.62,.3],f0:[0,.35,1,0],etch:[.06,.1,.3,.1],stain:[.14,.08,.04,.006],scorch:[.015,.012,.01,1.1],crust:[0,0,0,0],acidTint:[.88,.58,.22,.4],smokeDark:[.02,.02,.02],smokeLit:[.34,.33,.32],pits:.12},Marble:{albedo:[.9,.88,.84,.28],f0:[1,.75,.3,0],etch:[.84,.78,.62,.82],stain:[.6,.42,.2,.003],scorch:[.1,.07,.05,1.5],crust:[0,0,0,0],acidTint:[.95,.95,.92,1],smokeDark:[.3,.3,.29],smokeLit:[.95,.94,.92],pits:1}},y={shape:he.includes(B.get("shape"))?B.get("shape"):"Suzanne",material:Ee[B.get("material")]?B.get("material"):"Silver",concentration:1.2,smoke:1,auto:!Et},de=[0,.02,0];let De=.35,H=.22;const Xe=Number(B.get("dist"));let Ce=Xe>0?Xe:2.65;const N=[0,0,0],J=[0,0,0],me=[0,0,0],Te=[0,0,0],ve=t=>{const e=Math.hypot(...t);return t.map(r=>r/e)},je=(t,e)=>[t[1]*e[2]-t[2]*e[1],t[2]*e[0]-t[0]*e[2],t[0]*e[1]-t[1]*e[0]];function Tt(){const t=Ce;N[0]=de[0]+Math.sin(De)*Math.cos(H)*t,N[1]=de[1]+Math.sin(H)*t,N[2]=de[2]+Math.cos(De)*Math.cos(H)*t,J.splice(0,3,...ve(de.map((e,r)=>e-N[r]))),me.splice(0,3,...ve(je(J,[0,1,0]))),Te.splice(0,3,...je(me,J))}const He=()=>1.7*Math.min(1,h.width/h.height);function Je(t,e){const r=(t-h.width/2)/h.height,o=(e-h.height/2)/h.height;return ve([0,1,2].map(s=>J[s]*He()+me[s]*r-Te[s]*o))}const Q=[],R=[],Z=[];let k=0,ee=0,S,Pe=0;const Ut=.6;function pe(t,e){R.push({pos:t,start:k,amount:e}),R.length>4&&Z.push(R.shift())}function $(t,e,r){Q.length<6&&Q.push({origin:t,dir:e,fn:r,version:Pe})}function Ke(t){const e=h.getBoundingClientRect();return[(t.clientX-e.left)*h.width/e.width,(t.clientY-e.top)*h.height/e.height]}function Rt(){h.addEventListener("contextmenu",e=>e.preventDefault()),h.addEventListener("pointerdown",e=>{if(S)return;const[r,o]=Ke(e);if(S={id:e.pointerId,x:r,y:o,mode:e.shiftKey||e.button===2?"orbit":"pending",nextPour:1/0},h.setPointerCapture(e.pointerId),ee=k,S.mode==="pending"){const s=S;$([...N],Je(r,o),f=>{s!==S&&s.mode!=="pending"||(f?(s.mode="pour",s.nextPour=k+.28,pe(f,1.5)):s.mode==="pending"&&(s.mode="orbit"))})}}),h.addEventListener("pointermove",e=>{if(S?.id!==e.pointerId)return;const[r,o]=Ke(e);S.mode==="orbit"&&(De-=(r-S.x)/h.height*3,H=Math.max(.02,Math.min(1.3,H+(o-S.y)/h.height*2.4))),S.x=r,S.y=o,ee=k});const t=e=>{S?.id===e.pointerId&&(S=void 0)};h.addEventListener("pointerup",t),h.addEventListener("pointercancel",t),h.addEventListener("lostpointercapture",t),h.addEventListener("wheel",e=>{e.preventDefault(),Ce=Math.max(1.8,Math.min(6,Ce*Math.exp(e.deltaY*.0015)))},{passive:!1}),$e.addEventListener("click",()=>te())}let te=()=>{},M=null;const Bt=pt(B,t=>{M=t});function Lt(){return xt({Studio:Bt,Shape:{value:y.shape,options:he,onChange:t=>{t!==y.shape&&(y.shape=t,te())}},Material:{value:y.material,options:Object.keys(Ee),onChange:t=>{t!==y.material&&(y.material=t,te())}},"Concentration (mol/L)":{value:y.concentration,min:.2,max:3,step:.05,onChange:t=>{y.concentration=t}},Smoke:{value:y.smoke,min:0,max:2,step:.01,onChange:t=>{y.smoke=t}},"Auto drops":{value:y.auto,onChange:t=>{y.auto=t}},"Fresh piece":yt(()=>te()),...Me.controls()}),null}async function qt(){const{positions:t,index:e}=Ct(await fetch(kt).then(o=>o.arrayBuffer()),2),r=t.map((o,s)=>o*.6+(s%3===1?-.02:0));return{pos:r,nrm:Pt(r,e),idx:e}}function At(t){return{pos:Float32Array.from(t.attributes.position.array),nrm:Float32Array.from(t.attributes.normal.array),idx:Uint32Array.from(t.index.array)}}function Ot(){const t=f=>{const a=Math.asin(Math.max(-1,Math.min(1,f[1])));return .4*(1+.14*Math.cos(a)**2*Math.cos(6*(Math.atan2(f[2],f[0])+1.4*a)))},e=f=>{const a=Math.hypot(...f);return a-t(f.map(l=>l/a))},r=[],o=[],s=[];for(let f=0;f<=192;f++)for(let a=0;a<=384;a++){const l=(f/192-.5)*Math.PI*.9999,b=a/384*Math.PI*2,i=[Math.cos(l)*Math.cos(b),Math.sin(l),Math.cos(l)*Math.sin(b)],c=i.map(x=>x*t(i)),g=.001,v=[0,1,2].map(x=>e(c.map((u,W)=>u+(W===x?g:0)))-e(c.map((u,W)=>u-(W===x?g:0)))),m=Math.hypot(...v);r.push(c[0],c[1]-.06,c[2]),o.push(v[0]/m,v[1]/m,v[2]/m)}for(let f=0;f<192;f++)for(let a=0;a<384;a++){const l=f*385+a,b=l+1,i=l+384+1,c=i+1;s.push(l,i,b,b,i,c)}return{pos:Float32Array.from(r),nrm:Float32Array.from(o),idx:Uint32Array.from(s)}}function Vt(){const t=o=>.11+.22*Math.exp(-(((o+.12)/.24)**2))+.05*Ye(.3,.52,o)-.03*Ye(.1,.3,o),e=[new ke(0,-.46)];for(let o=0;o<=90;o++){const s=-.46+o/90*.98;e.push(new ke(t(s),s))}e.push(new ke(0,.52));const r=new gt(e,96);return r.computeVertexNormals(),At(r)}const Ye=(t,e,r)=>{const o=Math.max(0,Math.min(1,(r-t)/(e-t)));return o*o*(3-2*o)};async function It(){const t=await navigator.gpu?.requestAdapter();if(!t)throw new Error("This piece needs a browser with WebGPU enabled.");const e=await t.requestDevice();Me.attach(e);const r=h.getContext("webgpu"),o=navigator.gpu.getPreferredCanvasFormat();r.configure({device:e,format:o,alphaMode:"opaque"});const s=e.createShaderModule({code:Ft}),f=(await s.getCompilationInfo()).messages.filter(n=>n.type==="error");if(f.length)throw new Error(f.map(n=>`Line ${n.lineNum}: ${n.message}`).join(`
`));const a=n=>e.createComputePipelineAsync({layout:"auto",compute:{module:s,entryPoint:n}}),l=await e.createRenderPipelineAsync({layout:"auto",vertex:{module:s,entryPoint:"meshVS",buffers:[{arrayStride:12,attributes:[{shaderLocation:0,offset:0,format:"float32x3"}]},{arrayStride:12,attributes:[{shaderLocation:1,offset:0,format:"float32x3"}]}]},fragment:{module:s,entryPoint:"meshFS",targets:[{format:"rgba16float"}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth24plus",depthWriteEnabled:!0,depthCompare:"less"}}),b=[await qt(),Vt(),Ot()].map(n=>{const w=(U,F)=>{const D=e.createBuffer({size:U.byteLength,usage:F|GPUBufferUsage.COPY_DST});return e.queue.writeBuffer(D,0,U),D};return{pos:w(n.pos,GPUBufferUsage.VERTEX),nrm:w(n.nrm,GPUBufferUsage.VERTEX),idx:w(n.idx,GPUBufferUsage.INDEX),count:n.idx.length}}),[i,c,g,v,m,x]=await Promise.all([a("initCS"),a("updateCS"),a("pickCS"),a("smokeCS"),a("clearSmokeCS"),e.createRenderPipelineAsync({layout:"auto",vertex:{module:s,entryPoint:"fullVS"},fragment:{module:s,entryPoint:"displayFS",targets:[{format:o}]}})]),u=new Float32Array(112),W=e.createBuffer({size:u.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),K=e.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge",addressModeW:"clamp-to-edge"}),Ue=e.createTexture({size:[O,O,O],dimension:"3d",format:"r16float",usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),Qe=await fetch(new URL(""+new URL(""+new URL("suzanne-sdf-WHrbz0ZX.bin",import.meta.url).href,import.meta.url).href,import.meta.url)).then(n=>n.arrayBuffer());e.queue.writeTexture({texture:Ue},Qe,{bytesPerRow:O*2,rowsPerImage:O},[O,O,O]);const oe=n=>e.createTexture({size:n,dimension:"3d",format:"rgba16float",usage:GPUTextureUsage.STORAGE_BINDING|GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST}),et=[oe(ze),oe(ze)],tt=[oe(ue),oe(ue)],Re=e.createBuffer({size:16,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC}),re=e.createBuffer({size:16,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST}),p=(n,w)=>({binding:n,resource:w}),X={buffer:W},Y=Ue.createView(),L=et.map(n=>n.createView()),se=tt.map(n=>n.createView()),V=(n,w)=>e.createBindGroup({layout:n.getBindGroupLayout(0),entries:w}),Be=[0,1].map(n=>V(i,[p(0,X),p(3,L[n]),p(4,L[1-n])])),ot=[0,1].map(n=>V(c,[p(0,X),p(1,K),p(2,Y),p(3,L[n]),p(4,L[1-n])])),rt=[0,1].map(n=>V(g,[p(0,X),p(1,K),p(2,Y),p(3,L[n]),p(5,{buffer:Re})])),st=[0,1].map(n=>[0,1].map(w=>V(v,[p(0,X),p(1,K),p(2,Y),p(3,L[n]),p(6,se[w]),p(7,se[1-w])]))),at=se.map(n=>V(m,[p(7,n)])),it=[0,1].map(n=>V(l,[p(0,X),p(1,K),p(2,Y),p(3,L[n])]));let q;const nt=(n,w)=>{if(q?.w===n&&q.h===w)return;q?.color.destroy(),q?.depth.destroy();const U=e.createTexture({size:[n,w],format:"rgba16float",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),F=e.createTexture({size:[n,w],format:"depth24plus",usage:GPUTextureUsage.RENDER_ATTACHMENT}),D=U.createView();q={w:n,h:w,color:U,depth:F,colorView:D,depthView:F.createView(),displayB:[0,1].map(ie=>[0,1].map(C=>V(x,[p(0,X),p(1,K),p(2,Y),p(3,L[ie]),p(6,se[C]),p(11,D),p(12,{buffer:Me.buffer})])))}};let z=0,ae=0,ge=!0;te=()=>{ge=!0,Pe++,Q.length=R.length=Z.length=0,S=void 0,ee=k},T||(Rt(),mt.createRoot(document.querySelector("#controls")).render(fe.createElement(fe.Fragment,null,fe.createElement(vt,{collapsed:!0,titleBar:{title:"Controls"}}),fe.createElement(Lt))));const xe=T?[[.2,-.18],[.7,.2],[1.3,.02],[2,-.3],[2.6,.28],[3.3,0]]:[];let ye=!1,Le=1.5,be=performance.now(),qe=0,Ae=0;const Oe=1/60,lt=300;async function ct(n){await re.mapAsync(GPUMapMode.READ);const[w,U,F,D]=new Float32Array(re.getMappedRange().slice(0));re.unmap(),ye=!1,n.version===Pe&&n.fn(D>.5?[w,U,F]:null)}function we(n){const w=Math.min(.05,(n-be)/1e3);be=n,k+=T?Oe:w;const U=T?1:Math.min(devicePixelRatio,1.5),F=T?1e3:Math.round(h.clientWidth*U),D=T?1e3:Math.round(h.clientHeight*U);for((h.width!==F||h.height!==D)&&(h.width=F,h.height=D),nt(F,D),Tt(),S?.mode==="pour"&&k>=S.nextPour&&(S.nextPour=k+.17,ee=k,$([...N],Je(S.x,S.y),d=>{d&&pe(d,.75)}));xe.length&&xe[0][0]<=k;){const[,d]=xe.shift(),E=y.shape==="Suzanne"?[0,-.18,-1]:[0,-1,0],ce=y.shape==="Suzanne"?[d*.65,.53,1.6]:[d,1.6,.08];$(ce,ve(E),A=>{A&&pe(A,1.6)})}!T&&y.auto&&!S&&k-ee>5&&k>Le&&($([(Math.random()*2-1)*.34,1.6,(Math.random()*2-1)*.2],[0,-1,0],d=>{d&&pe(d,1.4)}),Le=k+1.4+Math.random()*1.6);const ie=[];for(let d=R.length-1;d>=0;d--){const E=k-R[d].start,ce=Ut-4.9*E*E;if(ce<=0){const A=R.splice(d,1)[0];Z.push(A);for(let Ve=0;Ve<3;Ve++){const Ie=Math.random()*Math.PI*2,_e=.05+Math.random()*.05;$([A.pos[0]+Math.cos(Ie)*_e,A.pos[1]+.3,A.pos[2]+Math.sin(Ie)*_e],[0,-1,0],Ge=>{Ge&&Z.push({pos:Ge,amount:A.amount*.18})})}}else ie.push([R[d].pos[0],R[d].pos[1]+ce+.035,R[d].pos[2],.01+9.8*E])}u.fill(0),u.set([F,D,k,T?Oe:w],0),u.set([...N,he.indexOf(y.shape)],4),u.set([...J,He()],8);const C=Ee[y.material];u.set([...me,y.smoke*(.5+.5*y.concentration)],12),u.set([...Te,y.concentration],16),u[23]=C.pits,u.set(C.albedo,60),u.set(C.f0,64),u.set(C.etch,68),u.set(C.stain,72),u.set(C.scorch,76),u.set(C.crust,80),u.set(C.acidTint,84),u.set([...C.smokeDark,0],88),u.set([...C.smokeLit,0],92);const ft=M?ht(M).map(d=>d*14):[-8,9,7],ut=M?Ne(M.keyColor).map(d=>d*2.3*M.keyLevel/4.4):[2.3,2.25,2.15],dt=M?Ne(M.sweep).map(d=>d*.64):[.36,.355,.35];u.set([...ft,M?Math.sqrt(M.soft/4):1],100),u.set([...ut,M?M.env/.5:1],104),u.set([...dt,M?1:0],108);let I;!ye&&Q.length&&(I=Q.shift(),u.set(I.origin,20),u.set(I.dir,24)),Z.splice(0,4).forEach((d,E)=>u.set([...d.pos,d.amount],28+E*4)),ie.slice(0,4).forEach((d,E)=>u.set(d,44+E*4)),e.queue.writeBuffer(W,0,u);const j=e.createCommandEncoder(),P=j.beginComputePass(),Se=ze.map(d=>Math.ceil(d/4));if(ge){P.setPipeline(i),P.setBindGroup(0,Be[z]),P.dispatchWorkgroups(...Se),z=1-z,P.setBindGroup(0,Be[z]),P.dispatchWorkgroups(...Se),z=1-z,P.setPipeline(m);for(const d of at)P.setBindGroup(0,d),P.dispatchWorkgroups(...ue.map(E=>Math.ceil(E/4)));ge=!1}P.setPipeline(c),P.setBindGroup(0,ot[z]),P.dispatchWorkgroups(...Se),z=1-z,P.end();const _=j.beginComputePass();I&&(_.setPipeline(g),_.setBindGroup(0,rt[z]),_.dispatchWorkgroups(1)),_.setPipeline(v),_.setBindGroup(0,st[z][ae]),_.dispatchWorkgroups(...ue.map(d=>Math.ceil(d/4))),ae=1-ae,_.end(),I&&j.copyBufferToBuffer(Re,0,re,0,16);const ne=b[he.indexOf(y.shape)],G=j.beginRenderPass({colorAttachments:[{view:q.colorView,loadOp:"clear",storeOp:"store",clearValue:{r:0,g:0,b:0,a:1e6}}],depthStencilAttachment:{view:q.depthView,depthLoadOp:"clear",depthStoreOp:"store",depthClearValue:1}});G.setPipeline(l),G.setBindGroup(0,it[z]),G.setVertexBuffer(0,ne.pos),G.setVertexBuffer(1,ne.nrm),G.setIndexBuffer(ne.idx,"uint32"),G.drawIndexed(ne.count),G.end();const le=j.beginRenderPass({colorAttachments:[{view:r.getCurrentTexture().createView(),loadOp:"clear",storeOp:"store",clearValue:{r:1,g:1,b:1,a:1}}]});le.setPipeline(x),le.setBindGroup(0,q.displayB[z][ae]),le.draw(3),le.end(),e.queue.submit([j.finish()]),I&&(ye=!0,ct(I)),qe++,T?qe<lt?setTimeout(()=>we(performance.now()),0):B.has("port")&&e.queue.onSubmittedWorkDone().then(()=>h.toBlob(d=>{d&&fetch(`http://localhost:${Number(B.get("port"))}/`,{method:"POST",body:d}).catch(Fe)},"image/jpeg",.94)):Ae=requestAnimationFrame(we)}we(be),Ze.hidden=!0,T||($e.hidden=!1),e.lost.then(()=>{cancelAnimationFrame(Ae),Fe(new Error("The graphics device stopped. Reload to reopen Caustic."))})}function Fe(t){console.error(t),Ze.hidden=!0,We.textContent=t.message.startsWith("Line ")?"Caustic couldn’t load its shader.":t.message,We.hidden=!1}It().catch(Fe);
