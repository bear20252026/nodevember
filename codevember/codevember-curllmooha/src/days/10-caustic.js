import "../lib/modulepreload-polyfill.js";
import { s as ht, a as mt, b as We } from "../lib/studio-presets.js";
import {
  c as vt,
  r as ue,
  L as gt,
  aP as xt,
  f as ze,
  u as yt,
  aF as bt,
} from "../lib/leva.js";
import "../lib/three.js";
import { c as wt, l as kt } from "../lib/look.js";
const St = `// Acid on a sculpture. The piece is a signed distance (Suzanne baked from a mesh, or an analytic form) cut back
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
`,
  zt = "" + new URL("../assets/suzane.glb", import.meta.url).href;
function Mt(t) {
  const o = new DataView(t).getUint32(12, !0),
    n = JSON.parse(new TextDecoder().decode(new Uint8Array(t, 20, o))),
    r = 20 + o + 8,
    x = (l, s) => {
      const c = n.accessors[l],
        m = n.bufferViews[c.bufferView],
        v = { SCALAR: 1, VEC2: 2, VEC3: 3 }[c.type],
        h = r + (m.byteOffset ?? 0) + (c.byteOffset ?? 0);
      return new s(t.slice(h, h + c.count * v * s.BYTES_PER_ELEMENT));
    },
    f = n.meshes[0].primitives[0],
    a =
      n.accessors[f.indices].componentType === 5125 ? Uint32Array : Uint16Array;
  return {
    positions: Array.from(x(f.attributes.POSITION, Float32Array)),
    index: Array.from(x(f.indices, a)),
  };
}
function Dt({ positions: t, index: e }) {
  const o = new Map(),
    n = [],
    r = [];
  for (let f = 0; f < t.length; f += 3) {
    const a = `${Math.round(t[f] * 1e4)},${Math.round(t[f + 1] * 1e4)},${Math.round(t[f + 2] * 1e4)}`;
    (o.has(a) || (o.set(a, r.length / 3), r.push(t[f], t[f + 1], t[f + 2])),
      n.push(o.get(a)));
  }
  const x = [];
  for (let f = 0; f < e.length; f += 3) {
    const a = n[e[f]],
      l = n[e[f + 1]],
      s = n[e[f + 2]];
    a !== l && l !== s && s !== a && x.push(a, l, s);
  }
  return { positions: r, index: x };
}
function Pt({ positions: t, index: e }) {
  const o = t.length / 3,
    n = new Map(),
    r = Array.from({ length: o }, () => new Set()),
    x = (s, c) => (s < c ? s * 1e7 + c : c * 1e7 + s);
  for (let s = 0; s < e.length; s += 3) {
    const c = [e[s], e[s + 1], e[s + 2]];
    for (let m = 0; m < 3; m++) {
      const v = c[m],
        h = c[(m + 1) % 3],
        y = c[(m + 2) % 3];
      (r[v].add(h), r[h].add(v));
      const z = x(v, h);
      (n.has(z) || n.set(z, { a: v, b: h, opposite: [], mid: -1 }),
        n.get(z).opposite.push(y));
    }
  }
  const f = [],
    a = (s, c) => t[s * 3 + c];
  for (let s = 0; s < o; s++) {
    const c = r[s].size,
      m = c === 3 ? 3 / 16 : 3 / (8 * Math.max(c, 1)),
      v = [0, 0, 0];
    for (const h of r[s]) for (let y = 0; y < 3; y++) v[y] += a(h, y);
    for (let h = 0; h < 3; h++) f.push(a(s, h) * (1 - c * m) + v[h] * m);
  }
  for (const s of n.values()) {
    s.mid = f.length / 3;
    for (let c = 0; c < 3; c++)
      f.push(
        s.opposite.length === 2
          ? ((a(s.a, c) + a(s.b, c)) * 3) / 8 +
              (a(s.opposite[0], c) + a(s.opposite[1], c)) / 8
          : (a(s.a, c) + a(s.b, c)) / 2,
      );
  }
  const l = [];
  for (let s = 0; s < e.length; s += 3) {
    const c = e[s],
      m = e[s + 1],
      v = e[s + 2],
      h = n.get(x(c, m)).mid,
      y = n.get(x(m, v)).mid,
      z = n.get(x(v, c)).mid;
    l.push(c, h, z, h, m, y, z, y, v, h, y, z);
  }
  return { positions: f, index: l };
}
function Ct(t, e) {
  let o = Dt(Mt(t));
  const n = [1 / 0, 1 / 0, 1 / 0],
    r = [-1 / 0, -1 / 0, -1 / 0];
  for (let a = 0; a < o.positions.length; a += 3)
    for (let l = 0; l < 3; l++)
      ((n[l] = Math.min(n[l], o.positions[a + l])),
        (r[l] = Math.max(r[l], o.positions[a + l])));
  const x = 1.9 / Math.max(r[0] - n[0], r[1] - n[1], r[2] - n[2]);
  for (let a = 0; a < e; a++) o = Pt(o);
  return {
    positions: Float32Array.from(
      o.positions,
      (a, l) => (a - (n[l % 3] + r[l % 3]) / 2) * x,
    ),
    index: Uint32Array.from(o.index),
  };
}
function Et(t, e) {
  const o = new Float32Array(t.length);
  for (let n = 0; n < e.length; n += 3) {
    const r = e[n] * 3,
      x = e[n + 1] * 3,
      f = e[n + 2] * 3,
      a = t[x] - t[r],
      l = t[x + 1] - t[r + 1],
      s = t[x + 2] - t[r + 2],
      c = t[f] - t[r],
      m = t[f + 1] - t[r + 1],
      v = t[f + 2] - t[r + 2],
      h = [l * v - s * m, s * c - a * v, a * m - l * c];
    for (const y of [r, x, f])
      ((o[y] += h[0]), (o[y + 1] += h[1]), (o[y + 2] += h[2]));
  }
  for (let n = 0; n < o.length; n += 3) {
    const r = Math.hypot(o[n], o[n + 1], o[n + 2]) || 1;
    ((o[n] /= r), (o[n + 1] /= r), (o[n + 2] /= r));
  }
  return o;
}
const Ft = kt + St,
  De = wt(),
  A = new URLSearchParams(location.search),
  U = A.has("thumb"),
  Bt = matchMedia("(prefers-reduced-motion: reduce)").matches,
  g = document.querySelector("canvas"),
  je = document.querySelector("#error"),
  He = document.querySelector("#loading"),
  $e = document.querySelector("#fresh");
U && document.body.classList.add("capture");
const Me = [112, 112, 112],
  de = [112, 80, 52],
  V = 96,
  me = ["Suzanne", "Vase", "Spiral"],
  Be = {
    Silver: {
      albedo: [0.972, 0.96, 0.915, 0.11],
      f0: [0, 0, 0, 1],
      etch: [0.7, 0.7, 0.69, 0.62],
      stain: [0.17, 0.155, 0.17, 0.006],
      scorch: [0.03, 0.028, 0.032, 0.9],
      crust: [0.27, 0.22, 0.34, 0.5],
      acidTint: [0.93, 0.95, 0.9, 0.45],
      smokeDark: [0.3, 0.31, 0.33],
      smokeLit: [0.93, 0.94, 0.96],
      pits: 1,
    },
    Gold: {
      albedo: [1, 0.71, 0.29, 0.12],
      f0: [0, 0, 0, 1],
      etch: [0.8, 0.46, 0.22, 0.6],
      stain: [0.36, 0.17, 0.06, 0.004],
      scorch: [0.07, 0.04, 0.025, 0.9],
      crust: [0, 0, 0, 0],
      acidTint: [0.98, 0.82, 0.3, 0.5],
      smokeDark: [0.26, 0.17, 0.05],
      smokeLit: [0.97, 0.8, 0.42],
      pits: 1,
    },
    Plastic: {
      albedo: [0.035, 0.15, 0.62, 0.3],
      f0: [0, 0.35, 1, 0],
      etch: [0.06, 0.1, 0.3, 0.1],
      stain: [0.14, 0.08, 0.04, 0.006],
      scorch: [0.015, 0.012, 0.01, 1.1],
      crust: [0, 0, 0, 0],
      acidTint: [0.88, 0.58, 0.22, 0.4],
      smokeDark: [0.02, 0.02, 0.02],
      smokeLit: [0.34, 0.33, 0.32],
      pits: 0.12,
    },
    Marble: {
      albedo: [0.9, 0.88, 0.84, 0.28],
      f0: [1, 0.75, 0.3, 0],
      etch: [0.84, 0.78, 0.62, 0.82],
      stain: [0.6, 0.42, 0.2, 0.003],
      scorch: [0.1, 0.07, 0.05, 1.5],
      crust: [0, 0, 0, 0],
      acidTint: [0.95, 0.95, 0.92, 1],
      smokeDark: [0.3, 0.3, 0.29],
      smokeLit: [0.95, 0.94, 0.92],
      pits: 1,
    },
  },
  b = {
    shape: me.includes(A.get("shape")) ? A.get("shape") : "Suzanne",
    material: Be[A.get("material")] ? A.get("material") : "Silver",
    concentration: 1.2,
    smoke: 1,
    auto: !Bt,
  },
  pe = [0, 0.02, 0];
let Pe = 0.35,
  J = 0.22;
const Xe = Number(A.get("dist"));
let Ce = Xe > 0 ? Xe : 2.65;
const j = [0, 0, 0],
  Q = [0, 0, 0],
  ve = [0, 0, 0],
  Ue = [0, 0, 0],
  ge = (t) => {
    const e = Math.hypot(...t);
    return t.map((o) => o / e);
  },
  Ke = (t, e) => [
    t[1] * e[2] - t[2] * e[1],
    t[2] * e[0] - t[0] * e[2],
    t[0] * e[1] - t[1] * e[0],
  ];
function Ut() {
  const t = Ce;
  ((j[0] = pe[0] + Math.sin(Pe) * Math.cos(J) * t),
    (j[1] = pe[1] + Math.sin(J) * t),
    (j[2] = pe[2] + Math.cos(Pe) * Math.cos(J) * t),
    Q.splice(0, 3, ...ge(pe.map((e, o) => e - j[o]))),
    ve.splice(0, 3, ...ge(Ke(Q, [0, 1, 0]))),
    Ue.splice(0, 3, ...Ke(ve, Q)));
}
const Je = () => 1.7 * Math.min(1, g.width / g.height);
function Qe(t, e) {
  const o = (t - g.width / 2) / g.height,
    n = (e - g.height / 2) / g.height;
  return ge([0, 1, 2].map((r) => Q[r] * Je() + ve[r] * o - Ue[r] * n));
}
const ee = [],
  L = [],
  H = [];
let S = 0,
  te = 0,
  k,
  Ee = 0;
const Tt = 0.6;
function he(t, e) {
  (L.push({ pos: t, start: S, amount: e }), L.length > 4 && H.push(L.shift()));
}
function $(t, e, o) {
  ee.length < 6 && ee.push({ origin: t, dir: e, fn: o, version: Ee });
}
function Ye(t) {
  const e = g.getBoundingClientRect();
  return [
    ((t.clientX - e.left) * g.width) / e.width,
    ((t.clientY - e.top) * g.height) / e.height,
  ];
}
function Lt() {
  (g.addEventListener("contextmenu", (e) => e.preventDefault()),
    g.addEventListener("pointerdown", (e) => {
      if (k) return;
      const [o, n] = Ye(e);
      if (
        ((k = {
          id: e.pointerId,
          x: o,
          y: n,
          mode: e.shiftKey || e.button === 2 ? "orbit" : "pending",
          nextPour: 1 / 0,
        }),
        g.setPointerCapture(e.pointerId),
        (te = S),
        k.mode === "pending")
      ) {
        const r = k;
        $([...j], Qe(o, n), (x) => {
          (r !== k && r.mode !== "pending") ||
            (x
              ? ((r.mode = "pour"), (r.nextPour = S + 0.28), he(x, 1.5))
              : r.mode === "pending" && (r.mode = "orbit"));
        });
      }
    }),
    g.addEventListener("pointermove", (e) => {
      if (k?.id !== e.pointerId) return;
      const [o, n] = Ye(e);
      (k.mode === "orbit" &&
        ((Pe -= ((o - k.x) / g.height) * 3),
        (J = Math.max(0.02, Math.min(1.3, J + ((n - k.y) / g.height) * 2.4)))),
        (k.x = o),
        (k.y = n),
        (te = S));
    }));
  const t = (e) => {
    k?.id === e.pointerId && (k = void 0);
  };
  (g.addEventListener("pointerup", t),
    g.addEventListener("pointercancel", t),
    g.addEventListener("lostpointercapture", t),
    g.addEventListener(
      "wheel",
      (e) => {
        (e.preventDefault(),
          (Ce = Math.max(1.8, Math.min(6, Ce * Math.exp(e.deltaY * 0.0015)))));
      },
      { passive: !1 },
    ),
    $e.addEventListener("click", () => ne()));
}
let ne = () => {},
  P = null;
const Rt = ht(A, (t) => {
  P = t;
});
function At() {
  return (
    yt({
      Studio: Rt,
      Shape: {
        value: b.shape,
        options: me,
        onChange: (t) => {
          t !== b.shape && ((b.shape = t), ne());
        },
      },
      Material: {
        value: b.material,
        options: Object.keys(Be),
        onChange: (t) => {
          t !== b.material && ((b.material = t), ne());
        },
      },
      "Concentration (mol/L)": {
        value: b.concentration,
        min: 0.2,
        max: 3,
        step: 0.05,
        onChange: (t) => {
          b.concentration = t;
        },
      },
      Smoke: {
        value: b.smoke,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (t) => {
          b.smoke = t;
        },
      },
      "Auto drops": {
        value: b.auto,
        onChange: (t) => {
          b.auto = t;
        },
      },
      "Fresh piece": bt(() => ne()),
      ...De.controls(),
    }),
    null
  );
}
async function It() {
  const { positions: t, index: e } = Ct(
      await fetch(zt).then((n) => n.arrayBuffer()),
      2,
    ),
    o = t.map((n, r) => n * 0.6 + (r % 3 === 1 ? -0.02 : 0));
  return { pos: o, nrm: Et(o, e), idx: e };
}
function qt(t) {
  return {
    pos: Float32Array.from(t.attributes.position.array),
    nrm: Float32Array.from(t.attributes.normal.array),
    idx: Uint32Array.from(t.index.array),
  };
}
function Ot() {
  const t = (a) => {
      const l = Math.asin(Math.max(-1, Math.min(1, a[1])));
      return (
        0.4 *
        (1 +
          0.14 *
            Math.cos(l) ** 2 *
            Math.cos(6 * (Math.atan2(a[2], a[0]) + 1.4 * l)))
      );
    },
    e = (a) => {
      const l = Math.hypot(...a);
      return l - t(a.map((s) => s / l));
    },
    r = [],
    x = [],
    f = [];
  for (let a = 0; a <= 192; a++)
    for (let l = 0; l <= 384; l++) {
      const s = (a / 192 - 0.5) * Math.PI * 0.9999,
        c = (l / 384) * Math.PI * 2,
        m = [Math.cos(s) * Math.cos(c), Math.sin(s), Math.cos(s) * Math.sin(c)],
        v = m.map((p) => p * t(m)),
        h = 0.001,
        y = [0, 1, 2].map(
          (p) =>
            e(v.map((X, R) => X + (R === p ? h : 0))) -
            e(v.map((X, R) => X - (R === p ? h : 0))),
        ),
        z = Math.hypot(...y);
      (r.push(v[0], v[1] - 0.06, v[2]), x.push(y[0] / z, y[1] / z, y[2] / z));
    }
  for (let a = 0; a < 192; a++)
    for (let l = 0; l < 384; l++) {
      const s = a * 385 + l,
        c = s + 1,
        m = s + 384 + 1,
        v = m + 1;
      f.push(s, m, c, c, m, v);
    }
  return {
    pos: Float32Array.from(r),
    nrm: Float32Array.from(x),
    idx: Uint32Array.from(f),
  };
}
function Vt() {
  const t = (n) =>
      0.11 +
      0.22 * Math.exp(-(((n + 0.12) / 0.24) ** 2)) +
      0.05 * Ze(0.3, 0.52, n) -
      0.03 * Ze(0.1, 0.3, n),
    e = [new ze(0, -0.46)];
  for (let n = 0; n <= 90; n++) {
    const r = -0.46 + (n / 90) * 0.98;
    e.push(new ze(t(r), r));
  }
  e.push(new ze(0, 0.52));
  const o = new xt(e, 96);
  return (o.computeVertexNormals(), qt(o));
}
const Ze = (t, e, o) => {
  const n = Math.max(0, Math.min(1, (o - t) / (e - t)));
  return n * n * (3 - 2 * n);
};
async function Gt() {
  const t = await navigator.gpu?.requestAdapter();
  if (!t) throw new Error("This piece needs a browser with WebGPU enabled.");
  const e = await t.requestDevice();
  De.attach(e);
  const o = g.getContext("webgpu"),
    n = navigator.gpu.getPreferredCanvasFormat();
  o.configure({ device: e, format: n, alphaMode: "opaque" });
  const r = e.createShaderModule({ code: Ft }),
    f = (await r.getCompilationInfo()).messages.filter(
      (i) => i.type === "error",
    );
  if (f.length)
    throw new Error(
      f.map((i) => `Line ${i.lineNum}: ${i.message}`).join(`
`),
    );
  const a = (i) =>
      e.createComputePipelineAsync({
        layout: "auto",
        compute: { module: r, entryPoint: i },
      }),
    l = await e.createRenderPipelineAsync({
      layout: "auto",
      vertex: {
        module: r,
        entryPoint: "meshVS",
        buffers: [
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }],
          },
          {
            arrayStride: 12,
            attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }],
          },
        ],
      },
      fragment: {
        module: r,
        entryPoint: "meshFS",
        targets: [{ format: "rgba16float" }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: !0,
        depthCompare: "less",
      },
    }),
    s = [await It(), Vt(), Ot()].map((i) => {
      const w = (T, B) => {
        const C = e.createBuffer({
          size: T.byteLength,
          usage: B | GPUBufferUsage.COPY_DST,
        });
        return (e.queue.writeBuffer(C, 0, T), C);
      };
      return {
        pos: w(i.pos, GPUBufferUsage.VERTEX),
        nrm: w(i.nrm, GPUBufferUsage.VERTEX),
        idx: w(i.idx, GPUBufferUsage.INDEX),
        count: i.idx.length,
      };
    }),
    [c, m, v, h, y, z] = await Promise.all([
      a("initCS"),
      a("updateCS"),
      a("pickCS"),
      a("smokeCS"),
      a("clearSmokeCS"),
      e.createRenderPipelineAsync({
        layout: "auto",
        vertex: { module: r, entryPoint: "fullVS" },
        fragment: {
          module: r,
          entryPoint: "displayFS",
          targets: [{ format: n }],
        },
      }),
    ]),
    p = new Float32Array(112),
    X = e.createBuffer({
      size: p.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
    R = e.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      addressModeW: "clamp-to-edge",
    }),
    Te = e.createTexture({
      size: [V, V, V],
      dimension: "3d",
      format: "r16float",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    }),
    et = await fetch(
      new URL(
        "" + new URL("../assets/suzanne-sdf.bin", import.meta.url).href,
        import.meta.url,
      ),
    ).then((i) => i.arrayBuffer());
  e.queue.writeTexture(
    { texture: Te },
    et,
    { bytesPerRow: V * 2, rowsPerImage: V },
    [V, V, V],
  );
  const oe = (i) =>
      e.createTexture({
        size: i,
        dimension: "3d",
        format: "rgba16float",
        usage:
          GPUTextureUsage.STORAGE_BINDING |
          GPUTextureUsage.TEXTURE_BINDING |
          GPUTextureUsage.COPY_DST,
      }),
    tt = [oe(Me), oe(Me)],
    nt = [oe(de), oe(de)],
    Le = e.createBuffer({
      size: 16,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    }),
    re = e.createBuffer({
      size: 16,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    }),
    d = (i, w) => ({ binding: i, resource: w }),
    K = { buffer: X },
    Z = Te.createView(),
    I = tt.map((i) => i.createView()),
    se = nt.map((i) => i.createView()),
    G = (i, w) =>
      e.createBindGroup({ layout: i.getBindGroupLayout(0), entries: w }),
    Re = [0, 1].map((i) => G(c, [d(0, K), d(3, I[i]), d(4, I[1 - i])])),
    ot = [0, 1].map((i) =>
      G(m, [d(0, K), d(1, R), d(2, Z), d(3, I[i]), d(4, I[1 - i])]),
    ),
    rt = [0, 1].map((i) =>
      G(v, [d(0, K), d(1, R), d(2, Z), d(3, I[i]), d(5, { buffer: Le })]),
    ),
    st = [0, 1].map((i) =>
      [0, 1].map((w) =>
        G(h, [
          d(0, K),
          d(1, R),
          d(2, Z),
          d(3, I[i]),
          d(6, se[w]),
          d(7, se[1 - w]),
        ]),
      ),
    ),
    at = se.map((i) => G(y, [d(7, i)])),
    it = [0, 1].map((i) => G(l, [d(0, K), d(1, R), d(2, Z), d(3, I[i])]));
  let q;
  const ct = (i, w) => {
    if (q?.w === i && q.h === w) return;
    (q?.color.destroy(), q?.depth.destroy());
    const T = e.createTexture({
        size: [i, w],
        format: "rgba16float",
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      }),
      B = e.createTexture({
        size: [i, w],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      }),
      C = T.createView();
    q = {
      w: i,
      h: w,
      color: T,
      depth: B,
      colorView: C,
      depthView: B.createView(),
      displayB: [0, 1].map((ie) =>
        [0, 1].map((E) =>
          G(z, [
            d(0, K),
            d(1, R),
            d(2, Z),
            d(3, I[ie]),
            d(6, se[E]),
            d(11, C),
            d(12, { buffer: De.buffer }),
          ]),
        ),
      ),
    };
  };
  let D = 0,
    ae = 0,
    xe = !0;
  ((ne = () => {
    ((xe = !0),
      Ee++,
      (ee.length = L.length = H.length = 0),
      (k = void 0),
      (te = S));
  }),
    U ||
      (Lt(),
      vt.createRoot(document.querySelector("#controls")).render(
        ue.createElement(
          ue.Fragment,
          null,
          ue.createElement(gt, {
            collapsed: !0,
            titleBar: { title: "Controls" },
          }),
          ue.createElement(At),
        ),
      )));
  const ye = U
    ? [
        [0.2, -0.18],
        [0.7, 0.2],
        [1.3, 0.02],
        [2, -0.3],
        [2.6, 0.28],
        [3.3, 0],
      ]
    : [];
  let be = !1,
    Ae = 1.5,
    we = performance.now(),
    Ie = 0,
    qe = 0;
  const Oe = 1 / 60,
    lt = 300;
  async function ft(i) {
    await re.mapAsync(GPUMapMode.READ);
    const [w, T, B, C] = new Float32Array(re.getMappedRange().slice(0));
    (re.unmap(),
      (be = !1),
      i.version === Ee && i.fn(C > 0.5 ? [w, T, B] : null));
  }
  function ke(i) {
    const w = Math.min(0.05, (i - we) / 1e3);
    ((we = i), (S += U ? Oe : w));
    const T = U ? 1 : Math.min(devicePixelRatio, 1.5),
      B = U ? 1e3 : Math.round(g.clientWidth * T),
      C = U ? 1e3 : Math.round(g.clientHeight * T);
    for (
      (g.width !== B || g.height !== C) && ((g.width = B), (g.height = C)),
        ct(B, C),
        Ut(),
        k?.mode === "pour" &&
          S >= k.nextPour &&
          ((k.nextPour = S + 0.17),
          (te = S),
          $([...j], Qe(k.x, k.y), (u) => {
            u && he(u, 0.75);
          }));
      ye.length && ye[0][0] <= S;

    ) {
      const [, u] = ye.shift(),
        M = b.shape === "Suzanne" ? [0, -0.18, -1] : [0, -1, 0],
        fe = b.shape === "Suzanne" ? [u * 0.65, 0.53, 1.6] : [u, 1.6, 0.08];
      $(fe, ge(M), (O) => {
        O && he(O, 1.6);
      });
    }
    !U &&
      b.auto &&
      !k &&
      S - te > 5 &&
      S > Ae &&
      ($(
        [(Math.random() * 2 - 1) * 0.34, 1.6, (Math.random() * 2 - 1) * 0.2],
        [0, -1, 0],
        (M) => {
          M && he(M, 1.4);
        },
      ),
      (Ae = S + 1.4 + Math.random() * 1.6));
    const ie = [];
    for (let u = L.length - 1; u >= 0; u--) {
      const M = S - L[u].start,
        fe = Tt - 4.9 * M * M;
      if (fe <= 0) {
        const O = L.splice(u, 1)[0];
        H.push(O);
        for (let Ve = 0; Ve < 3; Ve++) {
          const Ge = Math.random() * Math.PI * 2,
            _e = 0.05 + Math.random() * 0.05;
          $(
            [
              O.pos[0] + Math.cos(Ge) * _e,
              O.pos[1] + 0.3,
              O.pos[2] + Math.sin(Ge) * _e,
            ],
            [0, -1, 0],
            (Ne) => {
              Ne && H.push({ pos: Ne, amount: O.amount * 0.18 });
            },
          );
        }
      } else
        ie.push([
          L[u].pos[0],
          L[u].pos[1] + fe + 0.035,
          L[u].pos[2],
          0.01 + 9.8 * M,
        ]);
    }
    (p.fill(0),
      p.set([B, C, S, U ? Oe : w], 0),
      p.set([...j, me.indexOf(b.shape)], 4),
      p.set([...Q, Je()], 8));
    const E = Be[b.material];
    (p.set([...ve, b.smoke * (0.5 + 0.5 * b.concentration)], 12),
      p.set([...Ue, b.concentration], 16),
      (p[23] = E.pits),
      p.set(E.albedo, 60),
      p.set(E.f0, 64),
      p.set(E.etch, 68),
      p.set(E.stain, 72),
      p.set(E.scorch, 76),
      p.set(E.crust, 80),
      p.set(E.acidTint, 84),
      p.set([...E.smokeDark, 0], 88),
      p.set([...E.smokeLit, 0], 92));
    const ut = P ? mt(P).map((u) => u * 14) : [-8, 9, 7],
      dt = P
        ? We(P.keyColor).map((u) => (u * 2.3 * P.keyLevel) / 4.4)
        : [2.3, 2.25, 2.15],
      pt = P ? We(P.sweep).map((u) => u * 0.64) : [0.36, 0.355, 0.35];
    (p.set([...ut, P ? Math.sqrt(P.soft / 4) : 1], 100),
      p.set([...dt, P ? P.env / 0.5 : 1], 104),
      p.set([...pt, P ? 1 : 0], 108));
    let _;
    (!be &&
      ee.length &&
      ((_ = ee.shift()), p.set(_.origin, 20), p.set(_.dir, 24)),
      H.splice(0, 4).forEach((u, M) => p.set([...u.pos, u.amount], 28 + M * 4)),
      ie.slice(0, 4).forEach((u, M) => p.set(u, 44 + M * 4)),
      e.queue.writeBuffer(X, 0, p));
    const Y = e.createCommandEncoder(),
      F = Y.beginComputePass(),
      Se = Me.map((u) => Math.ceil(u / 4));
    if (xe) {
      (F.setPipeline(c),
        F.setBindGroup(0, Re[D]),
        F.dispatchWorkgroups(...Se),
        (D = 1 - D),
        F.setBindGroup(0, Re[D]),
        F.dispatchWorkgroups(...Se),
        (D = 1 - D),
        F.setPipeline(y));
      for (const u of at)
        (F.setBindGroup(0, u),
          F.dispatchWorkgroups(...de.map((M) => Math.ceil(M / 4))));
      xe = !1;
    }
    (F.setPipeline(m),
      F.setBindGroup(0, ot[D]),
      F.dispatchWorkgroups(...Se),
      (D = 1 - D),
      F.end());
    const N = Y.beginComputePass();
    (_ && (N.setPipeline(v), N.setBindGroup(0, rt[D]), N.dispatchWorkgroups(1)),
      N.setPipeline(h),
      N.setBindGroup(0, st[D][ae]),
      N.dispatchWorkgroups(...de.map((u) => Math.ceil(u / 4))),
      (ae = 1 - ae),
      N.end(),
      _ && Y.copyBufferToBuffer(Le, 0, re, 0, 16));
    const ce = s[me.indexOf(b.shape)],
      W = Y.beginRenderPass({
        colorAttachments: [
          {
            view: q.colorView,
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 0, g: 0, b: 0, a: 1e6 },
          },
        ],
        depthStencilAttachment: {
          view: q.depthView,
          depthLoadOp: "clear",
          depthStoreOp: "store",
          depthClearValue: 1,
        },
      });
    (W.setPipeline(l),
      W.setBindGroup(0, it[D]),
      W.setVertexBuffer(0, ce.pos),
      W.setVertexBuffer(1, ce.nrm),
      W.setIndexBuffer(ce.idx, "uint32"),
      W.drawIndexed(ce.count),
      W.end());
    const le = Y.beginRenderPass({
      colorAttachments: [
        {
          view: o.getCurrentTexture().createView(),
          loadOp: "clear",
          storeOp: "store",
          clearValue: { r: 1, g: 1, b: 1, a: 1 },
        },
      ],
    });
    (le.setPipeline(z),
      le.setBindGroup(0, q.displayB[D][ae]),
      le.draw(3),
      le.end(),
      e.queue.submit([Y.finish()]),
      _ && ((be = !0), ft(_)),
      Ie++,
      U
        ? Ie < lt
          ? setTimeout(() => ke(performance.now()), 0)
          : A.has("port") &&
            e.queue.onSubmittedWorkDone().then(() =>
              g.toBlob(
                (u) => {
                  u &&
                    fetch(`http://localhost:${Number(A.get("port"))}/`, {
                      method: "POST",
                      body: u,
                    }).catch(Fe);
                },
                "image/jpeg",
                0.94,
              ),
            )
        : (qe = requestAnimationFrame(ke)));
  }
  (ke(we),
    (He.hidden = !0),
    U || ($e.hidden = !1),
    e.lost.then(() => {
      (cancelAnimationFrame(qe),
        Fe(
          new Error("The graphics device stopped. Reload to reopen Caustic."),
        ));
    }));
}
function Fe(t) {
  (console.error(t),
    (He.hidden = !0),
    (je.textContent = t.message.startsWith("Line ")
      ? "Caustic couldn’t load its shader."
      : t.message),
    (je.hidden = !1));
}
Gt().catch(Fe);
