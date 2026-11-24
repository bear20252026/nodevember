import "../lib/modulepreload-polyfill.js";
import { s as jn } from "../lib/studio-presets.js";
import "../lib/three.js";
import {
  P as Yn,
  aG as dn,
  V as be,
  a4 as Xn,
  p as un,
  f as It,
  c as $n,
  r as ot,
  L as Qn,
  az as Kn,
  u as Zn,
  C as Jn,
  aF as eo,
  g as at,
} from "../lib/leva.js";
import { p as to, a as no, w as oo } from "../lib/studio-light.js";
import { c as ao, l as ro } from "../lib/look.js";
const io = `// Yarn drawn fibre by fibre. The simulation only knows a centre line; each fibre is generated from it here, on the GPU, after
// Zhao et al. 2016 (plied yarn model) and Wu & Yuksel 2017 (real-time fibre-level rendering): plies twist round the yarn,
// fibres twist the other way round each ply, and some wander out and back. The blanket underneath is knitted from a height function.
diagnostic(off, derivative_uniformity);
struct Frame {
  viewProj: mat4x4f, lightProj: mat4x4f,
  eye: vec3f, time: f32,
  light: vec3f, shadowSize: f32,
  wool: array<vec4f, 3>, cloth: vec4f, night: vec4f,
  size: vec2f, pixel: f32, _a: f32,
  balls: array<vec4f, 3>, // x, y, z, radius
  cores: vec4f, // the solid middle of each
  paw: vec4f,
  yarnLook: vec4f, // ply twist, fibre twist, hair length, thickness
  lamp: vec4f, // brightness, pool size, back light, stitch size
  hover: vec4f, // which point the cursor is near, how lit, how many waves are going
  ripples: array<vec4f, 4>, // x, z, age, height
  ballQ: array<vec4f, 3>, // how each ball has turned
  env: vec4f, // how much of the HDR's light to use, how much the lamp's pool still shapes it, and its turn as cos, sin
  sh: array<vec4f, 9>, // the HDR's soft light from every direction
  envDir: array<vec4f, 2>, // its two brightest lights
  envCol: array<vec4f, 2>,
  dye: vec4f, // for the film: a change of colourway spreading out from x, z, at this radius and softness. No softness, no change.
  woolWas: array<vec4f, 3>, clothWas: vec4f, nightWas: vec4f, // the colours it hasn't reached yet
}
struct Point { p: vec4f, n: vec4f }
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowCmp: sampler_comparison;
@group(1) @binding(0) var<storage, read> points: array<Point>;

const R = 0.036;
const SEG = 0.042;
const RINGS_PER_POINT = 2.0;
const PER = 2000u; // points in each thread
const THREAD_VERTS = 7998u; // ((PER - 1) * RINGS_PER_POINT + 1) * 2
const TAU = 6.2831853;
const LAMP_AT = vec2f(0.1, 0.2);
const RIM = vec3f(0.47, 0.33, -0.82);

// How far the new colours have got here. The front is uneven, the way dye takes in cloth.
fn dyed(p: vec3f) -> f32 {
  if (frame.dye.w <= 0.0) { return 1.0; }
  let d = length(p.xz - frame.dye.xy) + (noise2(p.xz * 2.7) - 0.5) * 0.55;
  return 1.0 - smoothstep(frame.dye.z - frame.dye.w, frame.dye.z + frame.dye.w, d);
}
fn clothAt(p: vec3f) -> vec3f { return mix(frame.clothWas.rgb, frame.cloth.rgb, dyed(p)); }
fn hash(x: f32) -> f32 { return fract(sin(x * 12.9898 + 4.1) * 43758.5453); }
fn hash2(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(hash2(i), hash2(i + vec2f(1, 0)), u.x), mix(hash2(i + vec2f(0, 1)), hash2(i + vec2f(1, 1)), u.x), u.y);
}
// The HDR's light on a matte surface facing n (nine spherical harmonics, Ramamoorthi & Hanrahan 2001). It's a sum of smooth terms, so it's cheap.
fn envDiffuse(n: vec3f) -> vec3f {
  let d = vec3f(frame.env.z * n.x - frame.env.w * n.z, n.y, frame.env.w * n.x + frame.env.z * n.z);
  var c = frame.sh[0].rgb * 0.282095;
  c += (frame.sh[1].rgb * d.y + frame.sh[2].rgb * d.z + frame.sh[3].rgb * d.x) * 0.488603;
  c += (frame.sh[4].rgb * d.x * d.y + frame.sh[5].rgb * d.y * d.z + frame.sh[7].rgb * d.x * d.z) * 1.092548;
  c += frame.sh[6].rgb * 0.315392 * (3.0 * d.y * d.y - 1.0) + frame.sh[8].rgb * 0.546274 * (d.x * d.x - d.z * d.z);
  return max(c, vec3f(0.0));
}
// The lamp's pool: everything is lit by it, and falls off into the dark room around.
fn lampPool(p: vec3f) -> f32 {
  let d = p.xz - LAMP_AT;
  return 0.05 + 0.95 * exp(-dot(d, d) / (15.0 * frame.lamp.y * frame.lamp.y));
}
fn shadowAt(world: vec3f, n: vec3f, spread: f32, taps: i32) -> f32 {
  let c = frame.lightProj * vec4f(world + n * 0.03 + frame.light * 0.02, 1.0);
  let uv = vec2f(c.x * 0.5 + 0.5, 0.5 - c.y * 0.5);
  return pcss(uv, c.z, spread, frame.shadowSize, taps);
}

// ---- the centre line, smoothed between the simulated points
struct Line { p: vec3f, d: vec3f, n: vec3f, last: f32, tight: f32 }
fn lineAt(f: f32) -> Line {
  // Each thread is smoothed on its own, and never joined to the next.
  let lo = min(u32(max(f, 0.0)) / PER, 2u) * PER;
  let hi = lo + PER - 1u;
  let x = clamp(f, f32(lo), f32(hi));
  let i = min(u32(x), hi - 1u);
  let u = x - f32(i);
  let a = points[max(i, lo + 1u) - 1u];
  let b = points[i];
  let c = points[i + 1u];
  let e = points[min(i + 2u, hi)];
  let k1 = c.p.xyz - a.p.xyz;
  let k2 = 2.0 * a.p.xyz - 5.0 * b.p.xyz + 4.0 * c.p.xyz - e.p.xyz;
  let k3 = -a.p.xyz + 3.0 * b.p.xyz - 3.0 * c.p.xyz + e.p.xyz;
  var o: Line;
  o.p = 0.5 * (2.0 * b.p.xyz + k1 * u + k2 * u * u + k3 * u * u * u);
  o.d = normalize(0.5 * (k1 + 2.0 * k2 * u + 3.0 * k3 * u * u) + vec3f(0.0, 1e-5, 0.0));
  o.n = mix(b.n.xyz, c.n.xyz, u);
  o.tight = mix(b.n.w, c.n.w, u);
  o.last = f32(hi);
  return o;
}

// ---- fibres
struct FibreOut {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) tangent: vec3f,
  @location(2) radial: vec3f,
  @location(3) depth: f32,
  @location(4) along: f32,
  @location(5) shade: f32,
  @location(6) across: vec2f,
  @location(7) cover: f32,
}
fn ribbon(o: ptr<function, FibreOut>, p: vec3f, tangent: vec3f, side: f32, width: f32, thin: f32, least: f32) {
  let c = frame.viewProj * vec4f(p, 1.0);
  let across = normalize(cross(tangent, frame.eye - p) + vec3f(1e-5, 0.0, 0.0));
  // Never thinner than a pixel, so it can't flicker away.
  let wanted = width * thin;
  let least_ = frame.pixel * c.w * least;
  let w = max(wanted, least_);
  // Anything finer than that is drawn at that width but only partly covering the pixel, so it fades out smoothly and can't shimmer.
  (*o).cover = clamp(wanted / least_, 0.12, 1.0);
  (*o).world = p + across * side * w;
  (*o).clip = frame.viewProj * vec4f((*o).world, 1.0);
  (*o).tangent = tangent;
  (*o).across = vec2f(side, 0.0);
}
@vertex fn fibreVs(@builtin(vertex_index) v: u32, @builtin(instance_index) k: u32) -> FibreOut {
  let local_ = v % THREAD_VERTS;
  let f = f32(v / THREAD_VERTS * PER) + f32(local_ / 2u) / RINGS_PER_POINT;
  let side = f32(local_ & 1u) * 2.0 - 1.0;
  let l = lineAt(f);
  let n = normalize(l.n - l.d * dot(l.n, l.d));
  let b = cross(l.d, n);
  let s = f * SEG;
  let id = f32(k);
  let h1 = hash(id + 0.5);
  let h2 = hash(id * 1.7 + 11.0);
  let h3 = hash(id * 2.3 + 29.0);
  // Three plies round the yarn.
  let ply = s * frame.yarnLook.x + f32(k % 3u) * TAU / 3.0;
  let plyR = R * 0.36;
  // Fibres the other way round each ply. Most sit near its surface, and they migrate in and out.
  let fa = -s * frame.yarnLook.y + h1 * TAU;
  let wander = 0.12 * sin(s * 3.1 + h3 * 40.0) + 0.5 * pow(max(sin(s * 1.7 + h1 * 50.0) * sin(s * 5.3 + h3 * 30.0), 0.0), 6.0);
  // The cut end frays.
  let fray = 1.0 + 2.4 * h2 * exp(-(l.last - f) * 1.1);
  let fiberR = R * 0.66 * (0.62 + 0.38 * sqrt(h2)) * (1.0 + wander);
  // A thread under tension draws in thinner, so you can see how hard you're pulling.
  let local = (vec2f(cos(ply), sin(ply)) * plyR + vec2f(cos(fa), sin(fa)) * fiberR) * fray * frame.yarnLook.w * (1.0 - 0.32 * l.tight);
  let offset = n * local.x + b * local.y;
  let turn = n * (-sin(ply) * plyR * frame.yarnLook.x + sin(fa) * fiberR * frame.yarnLook.y) + b * (cos(ply) * plyR * frame.yarnLook.x - cos(fa) * fiberR * frame.yarnLook.y);
  var o: FibreOut;
  ribbon(&o, l.p + offset, normalize(l.d + turn), side, 0.0056 * frame.yarnLook.w, 1.0, 0.55);
  o.radial = normalize(offset + vec3f(1e-5));
  o.depth = length(local) / (R * frame.yarnLook.w * (1.0 - 0.32 * l.tight));
  o.along = f;
  o.shade = h3;
  o.across.y = id;
  return o;
}
// Stray hairs: short curved wisps standing off the surface, which catch the back light as a halo.
@vertex fn hairVs(@builtin(vertex_index) v: u32, @builtin(instance_index) k: u32) -> FibreOut {
  let u = f32(v / 2u) / 7.0;
  let side = f32(v & 1u) * 2.0 - 1.0;
  let id = f32(k);
  let last = f32(arrayLength(&points)) - 1.0;
  let f = hash(id + 3.3) * last;
  let l = lineAt(f);
  let n = normalize(l.n - l.d * dot(l.n, l.d));
  let b = cross(l.d, n);
  let a = hash(id * 1.3 + 7.0) * TAU;
  let radial = n * cos(a) + b * sin(a);
  let h = hash(id * 3.1 + 2.0);
  let len = (0.012 + h * h * h * 0.07) * frame.yarnLook.z;
  let dir = normalize(radial * 0.8 + l.d * (hash(id * 5.7) - 0.5) * 1.6);
  let bend = cross(l.d, radial) * (hash(id * 7.9) - 0.5) * 1.4 - vec3f(0.0, 0.35, 0.0);
  let p = l.p + radial * R * 0.82 * frame.yarnLook.w * (1.0 - 0.32 * l.tight) + (dir * u + bend * u * u) * len;
  var o: FibreOut;
  ribbon(&o, p, normalize(dir + bend * 2.0 * u), side, 0.0012, 1.0 - u * 0.8, 0.5);
  o.radial = radial;
  o.depth = 1.0;
  o.along = f;
  o.shade = 0.5 + h * 0.5;
  return o;
}
fn wool(along: f32, shade: f32, world: vec3f) -> vec3f {
  // Real dye drifts along the length, and every fibre took it a little differently.
  let dye = smoothstep(0.25, 0.75, noise2(vec2f(along * 0.012, 3.0)) * 0.6 + noise2(vec2f(along * 0.08, 9.0)) * 0.4);
  let which = min(u32(max(along, 0.0)) / PER, 2u);
  let base = mix(frame.woolWas[which].rgb, frame.wool[which].rgb, dyed(world));
  return mix(base * 0.9, base * 1.15 + vec3f(0.015), dye) * (0.78 + shade * 0.4);
}
// How buried a point is in a ball: threads under the top layer sit in the dark.
fn buried(p: vec3f) -> f32 {
  var ao = 1.0;
  for (var i = 0; i < 3; i++) {
    let b = frame.balls[i];
    if (b.w <= 0.0) { continue; }
    ao = min(ao, mix(0.6, 1.0, smoothstep(b.w - 0.1, b.w - 0.015, length(p - b.xyz))));
  }
  return ao;
}
@fragment fn fibreFs(o: FibreOut) -> @location(0) vec4f {
  let t = normalize(o.tangent);
  let v = normalize(frame.eye - o.world);
  let l = frame.light;
  let n = normalize(o.radial);
  // Each drawn strand stands for a small bundle of finer fibres (as Wu & Yuksel's core fibres do), which gives it fine lines down its length.
  let lines = hash(floor(o.across.x * 2.5 + 3.0) + o.across.y) * 0.55 + 0.45 * (0.5 + 0.5 * sin(o.across.x * 11.0 + o.across.y * 5.0));
  let albedo = wool(o.along, o.shade, o.world) * (0.72 + lines * 0.56);
  let pool = lampPool(o.world);
  let shadow = shadowAt(o.world, n, 2.0, 4);
  let inner = mix(0.34, 1.0, smoothstep(0.35, 0.95, o.depth));
  let ao = inner * buried(o.world) * mix(0.5, 1.0, smoothstep(0.03, 0.2, o.world.y));
  // A fibre is a thin cylinder: light depends on the angle to its length (Kajiya & Kay 1989), softened by the round yarn it's part of.
  let tl = dot(t, l);
  let sinTL = sqrt(max(1.0 - tl * tl, 0.0));
  let wrap = clamp(dot(n, l) * 0.6 + 0.4, 0.0, 1.0);
  var c = albedo * vec3f(1.0, 0.86, 0.68) * wrap * sinTL * shadow * pool * 2.1 * ao * frame.lamp.x;
  // Dim blue from the room, and warmth bouncing up off the blanket.
  let up = n.y * 0.5 + 0.5;
  c += albedo * mix(clothAt(o.world) * 1.6 + vec3f(0.03), vec3f(0.16, 0.2, 0.32), up) * ao * (0.25 + 0.75 * pool);
  // Fibre highlights: a white one off the surface, a dyed one that went through the fibre and came back.
  let h = normalize(l + v);
  let th = dot(t, h);
  let sinTH = sqrt(max(1.0 - th * th, 0.0));
  c += (vec3f(1.0, 0.92, 0.8) * pow(sinTH, 90.0) * 0.1 + albedo * pow(sinTH, 18.0) * 0.28) * shadow * pool * ao * max(dot(n, l) + 0.3, 0.0);
  // The back light shining through the fuzz at the silhouette.
  let edge = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.5);
  let tr = dot(t, RIM);
  c += (albedo * 0.7 + vec3f(0.12, 0.15, 0.24)) * edge * sqrt(max(1.0 - tr * tr, 0.0)) * clamp(dot(n, RIM) + 0.55, 0.0, 1.0) * inner * (0.25 + 0.75 * pool) * 0.95 * frame.lamp.z;
  // The stretch of thread you're about to pick up glows a little: light only, nothing moves.
  let near = (o.along - frame.hover.x) / 16.0;
  c += albedo * frame.hover.y * 0.38 * exp(-near * near);
  if (frame.env.x > 0.001) {
    // The same fibre in the HDR's light: its soft light from all round, then fibre highlights from its real lights.
    let shaped = mix(1.0, pool, frame.env.y);
    var e = albedo * envDiffuse(n) * (0.72 + 0.28 * sinTL) * mix(0.5, 1.0, shadow) * ao * shaped;
    e += albedo * clothAt(o.world) * (1.0 - up) * 0.9 * ao * shaped;
    for (var i = 0; i < 2; i++) {
      let il = frame.envDir[i].xyz;
      let ih = normalize(il + v);
      let ith = dot(t, ih);
      let isin = sqrt(max(1.0 - ith * ith, 0.0));
      let lit = max(dot(n, il) + 0.3, 0.0) * select(1.0, shadow, i == 0) * ao * shaped;
      e += frame.envCol[i].rgb * (pow(isin, 90.0) * 0.02 + albedo * pow(isin, 18.0) * 0.06) * lit;
    }
    e += albedo * envDiffuse(-v) * edge * inner * shaped * 0.55 * frame.lamp.z;
    e += albedo * frame.hover.y * 0.38 * exp(-near * near);
    c = mix(c, e, frame.env.x);
  }
  return vec4f(c, o.cover);
}

// ---- solid yarn under the fibres, so nothing shows through. It's also what casts shadows.
const SIDES = 10u;
fn tubePoint(v: u32, radius: f32) -> vec3f {
  let i = v / SIDES;
  let a = f32(v % SIDES) / f32(SIDES) * TAU;
  let q = points[i];
  let lo = i / PER * PER;
  let d = normalize(points[min(i + 1u, lo + PER - 1u)].p.xyz - points[max(i, lo + 1u) - 1u].p.xyz + vec3f(0.0, 1e-5, 0.0));
  let n = normalize(q.n.xyz - d * dot(q.n.xyz, d));
  return q.p.xyz + (n * cos(a) + cross(d, n) * sin(a)) * radius;
}
struct TubeOut { @builtin(position) clip: vec4f, @location(0) world: vec3f, @location(1) along: f32 }
@vertex fn tubeVs(@builtin(vertex_index) v: u32) -> TubeOut {
  var o: TubeOut;
  o.world = tubePoint(v, R * 0.42);
  o.clip = frame.viewProj * vec4f(o.world, 1.0);
  o.along = f32(v / SIDES);
  return o;
}
@fragment fn tubeFs(o: TubeOut) -> @location(0) vec4f {
  return vec4f(wool(o.along, 0.4, o.world) * 0.14 * lampPool(o.world) * buried(o.world), 1.0);
}
@vertex fn tubeShadowVs(@builtin(vertex_index) v: u32) -> @builtin(position) vec4f {
  return frame.lightProj * vec4f(tubePoint(v, R * 0.95), 1.0);
}
// The middle of the ball, so it's never hollow.
fn corePoint(v: u32, k: u32) -> vec3f {
  const C = array<vec2u, 6>(vec2u(0, 0), vec2u(1, 0), vec2u(0, 1), vec2u(0, 1), vec2u(1, 0), vec2u(1, 1));
  let cell = v / 6u;
  let g = vec2u(cell % 48u, cell / 48u) + C[v % 6u];
  let lat = f32(g.y) / 24.0 * 3.14159;
  let lon = f32(g.x) / 48.0 * TAU;
  return frame.balls[k].xyz + vec3f(sin(lat) * cos(lon), cos(lat), sin(lat) * sin(lon)) * frame.cores[k];
}
@vertex fn coreVs(@builtin(vertex_index) v: u32, @builtin(instance_index) k: u32) -> TubeOut {
  var o: TubeOut;
  o.world = corePoint(v, k);
  o.clip = frame.viewProj * vec4f(o.world, 1.0);
  o.along = f32(k * PER) + 0.5;
  return o;
}
// The heart of the ball is wound yarn too, drawn right here on the sphere rather than simulated: sets of parallel strands lying across each other,
// exactly as the real thread on top of it lies. Whatever you see between the top strands is more wool, turning as the ball turns.
const SET_AXES = array<vec3f, 9>(vec3f(0.12, 0.98, 0.15), vec3f(0.94, 0.2, -0.27), vec3f(-0.3, 0.42, 0.86), vec3f(0.62, -0.55, 0.56), vec3f(-0.72, -0.2, -0.66), vec3f(0.2, 0.64, -0.74), vec3f(-0.82, 0.54, 0.2), vec3f(0.42, 0.1, 0.9), vec3f(0.9, 0.42, 0.14));
fn turnedBy(v: vec3f, q: vec4f) -> vec3f { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
@fragment fn coreFs(o: TubeOut) -> @location(0) vec4f {
  let k = u32(o.along) / PER;
  let q = frame.ballQ[k];
  let d = turnedBy(normalize(o.world - frame.balls[k].xyz), vec4f(-q.xyz, q.w));
  // Find the topmost set here, and how close the edge of any set lying on top of it is, which casts a soft contact shadow.
  var above = 1.0;
  var strand = 0.0;
  var turn = 0.0;
  var across = vec3f(0.0);
  var row = 0.0;
  for (var i = 0u; i < 9u; i++) {
    let a = normalize(SET_AXES[(i + k * 2u) % 9u]);
    let s = dot(d, a);
    let lat = asin(clamp(s, -1.0, 1.0));
    let half_ = 0.34 + 0.07 * f32(i % 3u);
    if (abs(lat) < half_ || i == 8u) {
      strand = lat / 0.125;
      let b = normalize(cross(a, vec3f(0.31, 0.77, 0.56)));
      turn = atan2(dot(d, b), dot(d, cross(a, b)));
      across = normalize(a - d * s + vec3f(1e-4));
      row = floor(strand) + f32(i) * 13.0;
      break;
    }
    above = min(above, smoothstep(0.0, 0.09, abs(lat) - half_));
  }
  let f = fract(strand) - 0.5;
  let round_ = sqrt(max(1.0 - 4.0 * f * f, 0.0));
  let n = turnedBy(normalize(d + across * f * 1.5), q);
  let ply = 0.5 + 0.5 * sin(turn * 44.0 + f * 7.0 + hash(row) * 6.28);
  let fine = noise2(vec2f(turn * 90.0, strand * 7.0));
  let albedo = wool(o.along + hash(row) * 300.0, 0.3 + hash(row + 3.0) * 0.5, o.world) * (0.7 + 0.3 * ply) * (0.82 + 0.36 * fine);
  let pool = lampPool(o.world);
  let shadow = shadowAt(o.world, n, 2.0, 4);
  let ao = (0.34 + 0.66 * round_) * (0.45 + 0.55 * above);
  let wrap = clamp(dot(n, frame.light) * 0.6 + 0.4, 0.0, 1.0);
  var c = albedo * vec3f(1.0, 0.86, 0.68) * wrap * shadow * pool * 1.5 * ao * frame.lamp.x;
  let up = n.y * 0.5 + 0.5;
  c += albedo * mix(clothAt(o.world) * 1.6 + vec3f(0.03), vec3f(0.16, 0.2, 0.32), up) * ao * (0.25 + 0.75 * pool);
  if (frame.env.x > 0.001) {
    let e = albedo * (envDiffuse(n) * mix(0.5, 1.0, shadow) + clothAt(o.world) * (1.0 - up) * 0.9) * ao * mix(1.0, pool, frame.env.y);
    c = mix(c, e * 0.86, frame.env.x);
  }
  return vec4f(c, 1.0);
}
@vertex fn coreShadowVs(@builtin(vertex_index) v: u32, @builtin(instance_index) k: u32) -> @builtin(position) vec4f { return frame.lightProj * vec4f(corePoint(v, k), 1.0); }

// ---- the blanket
struct FloorOut { @builtin(position) clip: vec4f, @location(0) world: vec3f }
// The blanket snapped like a sheet: the same travelling crest as in yarn.js.
fn blanketAt(x: f32, z: f32) -> f32 {
  var h = 0.0;
  if (frame.hover.z < 0.5) { return h; } // nothing's moving it
  for (var i = 0; i < 4; i++) {
    let r = frame.ripples[i];
    if (r.w <= 0.0) { continue; }
    let u = length(vec2f(x, z) - r.xy) - 6.0 * r.z;
    h += r.w * exp(-r.z * 1.7) * min(r.z * 8.0, 1.0) * exp(-u * u / 0.5) * cos(u * 4.5);
  }
  return h;
}
// A grid dense near the middle and stretching off to the distance, so it can carry the wave where it's seen.
const FLOOR_GRID = 240u;
@vertex fn floorVs(@builtin(vertex_index) v: u32) -> FloorOut {
  const C = array<vec2u, 6>(vec2u(0, 0), vec2u(1, 0), vec2u(0, 1), vec2u(0, 1), vec2u(1, 0), vec2u(1, 1));
  let cell = v / 6u;
  let g = vec2u(cell % FLOOR_GRID, cell / FLOOR_GRID) + C[v % 6u];
  let u = vec2f(g) / f32(FLOOR_GRID) * 2.0 - 1.0;
  let xz = sign(u) * u * u * 40.0;
  var o: FloorOut;
  o.world = vec3f(xz.x, blanketAt(xz.x, xz.y), xz.y);
  o.clip = frame.viewProj * vec4f(o.world, 1.0);
  return o;
}
// One knitted stitch as a height: stockinette is rows of V-shaped legs, each pulled through a loop from the row below.
fn stitchLegs(x: f32, y: f32) -> f32 {
  let t = (y + 0.72) / 1.24;
  if (t <= 0.0 || t >= 1.0) { return 0.0; }
  let leg = (x - (0.05 + 0.31 * t)) / 0.15;
  return sqrt(max(1.0 - leg * leg, 0.0)) * pow(sin(3.14159 * t), 0.45);
}
// The soft creases of a blanket that was put down, not stretched: ridges that wander.
fn foldAt(p: vec2f) -> f32 {
  let w = p * 0.34 + vec2f(noise2(p * 0.42 + 4.0), noise2(p.yx * 0.42 + 9.0)) * 1.6;
  let n = noise2(w) * 0.7 + noise2(w * 2.1 + 5.0) * 0.3;
  // Rounded over the top, never a crease line: cloth this thick can't hold a sharp edge.
  let x = 2.0 * n - 1.0;
  return 1.0 - sqrt(x * x * 2.2 + 0.09) + 0.3;
}
fn knit(q: vec2f) -> f32 {
  let f = fract(q) - 0.5;
  let x = abs(f.x);
  // Each V's foot tucks into the V of the row below, so three rows can touch any one spot.
  let upper = stitchLegs(x, f.y);
  let next = stitchLegs(x, f.y - 1.0) * 0.86;
  let prior = stitchLegs(x, f.y + 1.0) * 0.86;
  // The columns stand apart, with a soft valley between.
  return max(upper, max(next, prior)) * smoothstep(0.5, 0.42, x);
}
@fragment fn floorFs(o: FloorOut) -> @location(0) vec4f {
  let p = o.world;
  // Slightly uneven, as anything made by hand is.
  let warp = vec2f(noise2(p.xz * 1.1) - 0.5, noise2(p.zx * 1.1 + 7.0) - 0.5) * 0.09;
  let q = (p.xz + warp) / (vec2f(0.125, 0.092) * frame.lamp.w);
  let e = 0.035;
  let h = knit(q);
  let hx = knit(q + vec2f(e, 0.0));
  let hy = knit(q + vec2f(0.0, e));
  // Far away the stitches are smaller than a pixel, and just become a soft surface.
  let detail = 1.0 - smoothstep(0.22, 0.6, length(vec2f(dpdx(q.x), dpdy(q.y))));
  let cell = floor(q);
  // Fine fibres on the stitch, and the soft folds of a blanket that's been put down, not stretched.
  let fuzz = noise2(p.xz * 60.0) * 0.5 + noise2(p.xz * 133.0) * 0.5;
  let fold0 = foldAt(p.xz);
  let folds = vec2f(fold0 - foldAt(p.xz + vec2f(0.03, 0.0)), fold0 - foldAt(p.xz + vec2f(0.0, 0.03))) / 0.03 * 0.28;
  var n = normalize(vec3f((h - hx) / e * 0.045 * detail + (fuzz - 0.5) * 0.34 * detail + folds.x, 1.0, (h - hy) / e * 0.045 * detail + (noise2(p.zx * 90.0) - 0.5) * 0.34 * detail + folds.y));
  // The wave's slope, as it goes by.
  if (frame.hover.z > 0.5) {
    let wave = blanketAt(p.x, p.z);
    n = normalize(n + vec3f(wave - blanketAt(p.x + 0.04, p.z), 0.0, wave - blanketAt(p.x, p.z + 0.04)) / 0.04);
  }
  // The ball's weight, and the hand, press it in.
  var contact = 1.0;
  for (var i = 0; i < 3; i++) {
    let ball = frame.balls[i];
    if (ball.w <= 0.0) { continue; }
    let toBall = p.xz - ball.xz;
    let dBall = length(toBall);
    n = normalize(n + vec3f(toBall.x, 0.0, toBall.y) / max(dBall, 1e-3) * 0.55 * exp(-pow((dBall - ball.w * 0.62) / (ball.w * 0.42), 2.0)));
    contact *= mix(0.14, 1.0, smoothstep(0.08, ball.w * 1.2, dBall));
  }
  var press = 1.0;
  if (frame.paw.w > 0.5) {
    let toPaw = p.xz - frame.paw.xz;
    let dPaw = length(toPaw);
    n = normalize(n + vec3f(toPaw.x, 0.0, toPaw.y) / max(dPaw, 1e-3) * 0.75 * exp(-pow((dPaw - 0.33) / 0.15, 2.0)));
    press = mix(0.62, 1.0, smoothstep(0.12, 0.42, dPaw));
  }
  let v = normalize(frame.eye - p);
  let pool = lampPool(p);
  let shadow = shadowAt(p, vec3f(0.0, 1.0, 0.0), 3.2, 12);
  let gaps = mix(1.0, mix(0.66, 1.0, smoothstep(0.05, 0.75, h)), detail) * mix(0.62, 1.08, smoothstep(0.1, 0.85, fold0));
  // Each stitch took the dye a bit differently, which is what makes it read as yarn and not a pattern.
  let heather = 0.84 + hash2(cell) * 0.3 + (noise2(p.xz * 2.3) - 0.5) * 0.22 + (fuzz - 0.5) * 0.42 * detail;
  let albedo = clothAt(p) * heather;
  let ndl = clamp(dot(n, frame.light) * 0.75 + 0.25, 0.0, 1.0);
  var c = albedo * vec3f(1.0, 0.84, 0.64) * ndl * shadow * pool * 1.75 * frame.lamp.x;
  c += albedo * vec3f(0.2, 0.24, 0.36) * (0.3 + 0.7 * pool);
  // Wool's sheen at a low angle.
  let edge = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
  c += (albedo + vec3f(0.03)) * edge * 1.2 * pool;
  // The fuzz standing off the surface catches the lamp as a soft bloom over the stitches.
  c += (albedo * 0.9 + vec3f(0.012)) * (0.1 + 0.16 * fuzz) * ndl * shadow * pool * frame.lamp.x;
  if (frame.env.x > 0.001) {
    let shaped = mix(1.0, pool, frame.env.y);
    var e = albedo * envDiffuse(n) * mix(0.42, 1.0, shadow) * shaped;
    e += (albedo + vec3f(0.02)) * envDiffuse(reflect(-v, n)) * edge * 0.6 * shaped;
    e += (albedo * 0.9 + vec3f(0.012)) * (0.1 + 0.16 * fuzz) * envDiffuse(vec3f(0.0, 1.0, 0.0)) * 0.4 * mix(0.5, 1.0, shadow) * shaped;
    c = mix(c, e, frame.env.x);
  }
  c *= gaps * contact * press;
  // Beyond the lamp it fades into the room.
  let far = smoothstep(9.0, 21.0, length(p.xz));
  return vec4f(mix(c, mix(frame.nightWas.rgb, frame.night.rgb, dyed(p)), far), 1.0);
}
`,
  Ne = 3,
  J = 2e3,
  B = Ne * J,
  ce = 0.036,
  we = 0.042,
  so = 420,
  lo = 40,
  ie = J - lo,
  Ue = 0.6,
  $t = 0.68,
  yt = 6,
  De = 0.028,
  rt = 0.42,
  Fe = ce * 2,
  bt = 32768,
  co = [
    [-2.15, -0.45],
    [2.15, -0.65],
    [0.05, -1.75],
  ],
  it = [0.05, 0.95],
  C = {
    peel: 1,
    snags: 1,
    roll: 1,
    gravity: -7,
    woolGrip: 0.14,
    blanketGrip: 0.55,
    snap: 0.14,
    wind: 1,
  },
  fo = 6,
  ho = 0.5,
  uo = 4.5,
  po = 1.7,
  mo = (n, t, e) => {
    const s = Math.hypot(t - n.x, e - n.z) - fo * n.t;
    return (
      n.a *
      Math.exp(-n.t * po) *
      Math.min(n.t * 8, 1) *
      Math.exp((-s * s) / ho) *
      Math.cos(s * uo)
    );
  },
  pn = (n) => () => {
    n = (n + 1831565813) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    return (
      (t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t),
      ((t ^ (t >>> 14)) >>> 0) / 4294967296
    );
  },
  St = (n, t) => [
    n[1] * t[2] - n[2] * t[1],
    n[2] * t[0] - n[0] * t[2],
    n[0] * t[1] - n[1] * t[0],
  ],
  pe = (n) => {
    const t = Math.hypot(...n) || 1;
    return n.map((e) => e / t);
  },
  oe = (n, t) => Math.max(Math.min(n, t), -t);
function vo(n) {
  const t = pn(n),
    e = new Float32Array(ie * 3);
  let s = pe([t() - 0.5, t() - 0.5, t() - 0.5]),
    h = 0;
  const k = [];
  for (; h < ie; ) {
    const T = Ue + (($t - Ue) * h) / ie,
      l = 3 + Math.floor(t() * 3),
      x = (l * ce * 2.1) / (2 * T);
    let u,
      p = 1 / 0;
    for (let Q = 0; Q < 12; Q++) {
      const _ = pe(St(s, pe([t() - 0.5, t() - 0.5, t() - 0.5]))),
        re = Math.cos(x),
        W = Math.sin(x),
        K = [_[0] * re - s[0] * W, _[1] * re - s[1] * W, _[2] * re - s[2] * W],
        de = k
          .slice(-8)
          .reduce(
            (Ke, Le) =>
              Math.max(
                Ke,
                Math.abs(K[0] * Le[0] + K[1] * Le[1] + K[2] * Le[2]),
              ),
            0,
          );
      de < p && ((p = de), (u = K));
    }
    k.push(u);
    const G = s[0] * u[0] + s[1] * u[1] + s[2] * u[2],
      F = pe([s[0] - u[0] * G, s[1] - u[1] * G, s[2] - u[2] * G]),
      U = St(u, F),
      Y = l * Math.PI * 2;
    let q = 0;
    for (; q < Y && h < ie; ) {
      const Q = Ue + (($t - Ue) * h) / ie,
        _ = ((q / Y) * 2 - 1) * x,
        re = Math.cos(_),
        W = Math.sin(_),
        K = Math.cos(q),
        de = Math.sin(q);
      ((s = [
        re * (F[0] * K + U[0] * de) + u[0] * W,
        re * (F[1] * K + U[1] * de) + u[1] * W,
        re * (F[2] * K + U[2] * de) + u[2] * W,
      ]),
        e.set([s[0] * Q, s[1] * Q, s[2] * Q], h * 3),
        (q += we / (Q * Math.max(re, 0.3))),
        h++);
    }
  }
  return e;
}
function mn({ seed: n = 1, drop: t = 0 } = {}) {
  const e = new Float32Array(B * 3),
    s = new Float32Array(B * 3),
    h = new Float32Array(B * 3),
    k = new Float32Array(B * 3),
    T = new Float32Array(B * 3),
    l = new Float32Array(B * 3),
    x = new Uint8Array(B),
    u = new Uint8Array(B),
    p = new Float32Array(B).fill(we),
    G = new Float32Array(B),
    F = new Int32Array(bt),
    U = new Int32Array(B),
    Y = pn(n ^ 1540483477),
    q = co.map(([o, r], d) => ({
      k: d,
      start: d * J,
      x: o,
      y: 0,
      z: r,
      vx: 0,
      vy: 0,
      vz: 0,
      q: [0, 0, 0, 1],
      w: [0, 0, 0],
      m: new Float32Array(9),
      radius: 0,
      core: Ue - 0.012,
      wound: 0,
      floor: 0,
      held: null,
      home: [o, r],
    })),
    Q = { x: 3.4, z: 2.8 },
    _ = { x: 0, z: 0, on: !1, vx: 0, vz: 0 },
    re = new Map(),
    W = [];
  let K = !1,
    de = 0,
    Ke = 0;
  const Le = (o) => {
    const [r, d, c, a] = o.q,
      i = o.m;
    i.set([
      1 - 2 * (d * d + c * c),
      2 * (r * d - c * a),
      2 * (r * c + d * a),
      2 * (r * d + c * a),
      1 - 2 * (r * r + c * c),
      2 * (d * c - r * a),
      2 * (r * c - d * a),
      2 * (d * c + r * a),
      1 - 2 * (r * r + d * d),
    ]);
    for (let m = o.start, w = o.start + ie; m < w; m++) {
      const b = l[m * 3],
        f = l[m * 3 + 1],
        g = l[m * 3 + 2];
      ((h[m * 3] = o.x + i[0] * b + i[1] * f + i[2] * g),
        (h[m * 3 + 1] = o.y + i[3] * b + i[4] * f + i[5] * g),
        (h[m * 3 + 2] = o.z + i[6] * b + i[7] * f + i[8] * g));
    }
  };
  for (const o of q) {
    const r = o.start,
      d = r + J - so,
      c = vo(n + o.k * 7919);
    l.set(c, r * 3);
    for (let M = r; M < r + ie; M++) G[M] = Y() ** 9;
    let a = 0;
    for (let M = r; M < d; M++)
      a = Math.max(a, l[M * 3] ** 2 + l[M * 3 + 1] ** 2 + l[M * 3 + 2] ** 2);
    ((o.radius = Math.sqrt(a) + ce), (o.y = o.radius + t));
    const i = pe([it[0] - o.x, 0, it[1] - o.z]),
      m = pe([i[0] * 0.7, -0.62, i[2] * 0.7]),
      w = (d - 1) * 3,
      b = pe([l[w], l[w + 1], l[w + 2]]);
    ((o.q = pe([...St(b, m), 1 + b[0] * m[0] + b[1] * m[1] + b[2] * m[2]])),
      Le(o));
    for (let M = r; M < d; M++)
      for (let R = 0; R < 3; R++) e[M * 3 + R] = h[M * 3 + R];
    for (let M = r; M < r + ie - 1; M++) {
      const R = M * 3;
      M < d - 1 &&
        (p[M] = Math.hypot(
          e[R + 3] - e[R],
          e[R + 4] - e[R + 1],
          e[R + 5] - e[R + 2],
        ));
    }
    let f = e[w],
      g = e[w + 1],
      P = e[w + 2],
      y = Math.atan2(i[2], i[0]),
      S = 0,
      D = Y() * 6.28;
    for (let M = d; M < r + J; M++) {
      const R = M - d;
      x[M] = 1;
      const H = Math.min(R / 60, 1),
        se = it[0] - f,
        ee = it[1] - P,
        X = Math.hypot(se, ee);
      if (
        ((S += (Y() - 0.5) * 0.3),
        (S = oe(S, 1.35)),
        (y += S * we * H),
        X > 1.65)
      ) {
        let V = Math.atan2(ee, se) - y;
        ((V = Math.atan2(Math.sin(V), Math.cos(V))),
          (y += V * Math.min((X - 1.65) * 0.3, 0.12)));
      }
      const Z =
        ce +
        0.1 +
        H *
          (0.55 +
            0.5 * Math.sin(R * we * 0.95 + D) +
            0.25 * Math.sin(R * we * 2.3 + D * 2.1)) *
          1.15;
      ((f += Math.cos(y) * we),
        (P += Math.sin(y) * we),
        (g += (Z - g) * 0.12),
        e.set([f, Math.max(g, ce), P], M * 3));
    }
  }
  s.set(e);
  const te = new Float32Array(B * 3),
    ke = new Float32Array(B * 3),
    xt = new Float32Array(B);
  for (const o of q) {
    let r = [0, 1, 0];
    for (let d = o.start, c = d + J; d < c; d++) {
      const a = d < o.start + ie,
        i = a ? l : e,
        m = a ? o.start + ie - 1 : c - 1,
        w = a ? o.start : o.start + ie,
        b = Math.max(d - 1, w) * 3,
        f = Math.min(d + 1, m) * 3,
        g = pe([i[f] - i[b], i[f + 1] - i[b + 1], i[f + 2] - i[b + 2]]),
        P = r[0] * g[0] + r[1] * g[1] + r[2] * g[2];
      ((r = pe([r[0] - g[0] * P, r[1] - g[1] * P, r[2] - g[2] * P])),
        T.set(r, d * 3),
        te.set(r, d * 3));
    }
  }
  ke.set(e);
  const Ze = (o, r) => {
    let d = 0;
    for (const c of W) d += mo(c, o, r);
    return d;
  };
  function qn(o, r) {
    let d = 0,
      c = 0,
      a = 0,
      i = 0,
      m = 0,
      w = 0,
      b = 0;
    const f = o.start,
      g = f + ie;
    for (let z = f; z < g; z++) {
      if (x[z]) continue;
      b++;
      const A = z * 3,
        j = e[A] - h[A],
        $ = e[A + 1] - h[A + 1],
        ze = e[A + 2] - h[A + 2],
        Me = h[A] - o.x,
        jt = h[A + 1] - o.y,
        Yt = h[A + 2] - o.z;
      ((d += j),
        (c += ze),
        (a += jt * ze - Yt * $),
        (i += Yt * j - Me * ze),
        (m += Me * $ - jt * j));
      const Xt = l[A] ** 2 + l[A + 1] ** 2 + l[A + 2] ** 2;
      Xt > w && (w = Xt);
    }
    if (
      ((o.wound = b),
      (o.core += ((b > 30 ? Ue - 0.012 : 0) - o.core) * Math.min(r * 3, 1)),
      b === 0)
    )
      return;
    o.radius = Math.sqrt(w) + ce;
    const P = o.x,
      y = o.y,
      S = o.z,
      D = o.q;
    if (o.held)
      ((o.vx = oe((o.held.x - o.x) * 14, 11)),
        (o.vz = oe((o.held.z - o.z) * 14, 11)));
    else {
      const z = Math.hypot(d, c),
        A = z > 0.012 ? (z - 0.012) / z : 0,
        j = 110 * C.roll * r;
      ((o.vx = oe((o.vx + d * A * j) * Math.exp(-r * 2.4), 11)),
        (o.vz = oe((o.vz + c * A * j) * Math.exp(-r * 2.4), 11)));
    }
    if (
      (K &&
        ((o.vx += ((o.home[0] - o.x) * 1.4 - o.vx) * Math.min(r * 3, 1)),
        (o.vz += ((o.home[1] - o.z) * 1.4 - o.vz) * Math.min(r * 3, 1))),
      _.on)
    ) {
      const z = o.x - _.x,
        A = o.z - _.z,
        j = Math.hypot(z, A) || 1e-6,
        $ = o.radius + rt * 0.6;
      j < $ &&
        ((o.vx += (z / j) * ($ - j) * 40 * r + _.vx * 0.2),
        (o.vz += (A / j) * ($ - j) * 40 * r + _.vz * 0.2));
    }
    for (const z of q) {
      if (z === o || z.wound < 30) continue;
      const A = o.x - z.x,
        j = o.z - z.z,
        $ = Math.hypot(A, j) || 1e-6,
        ze = o.radius + z.radius;
      if ($ < ze && Math.abs(o.y - z.y) < ze) {
        const Me = ((o.vx - z.vx) * A + (o.vz - z.vz) * j) / $;
        (Me < 0 &&
          ((o.vx -= (A / $) * Me * 0.8),
          (o.vz -= (j / $) * Me * 0.8),
          z.held ||
            ((z.vx += (A / $) * Me * 0.8), (z.vz += (j / $) * Me * 0.8))),
          (o.x += (A / $) * (ze - $) * 0.5),
          (o.z += (j / $) * (ze - $) * 0.5));
      }
    }
    if (W.length) {
      const z = Ze(o.x, o.z);
      ((o.vx -= ((Ze(o.x + 0.08, o.z) - z) / 0.08) * 9 * r),
        (o.vz -= ((Ze(o.x, o.z + 0.08) - z) / 0.08) * 9 * r),
        z > o.floor && (o.vy = Math.max(o.vy, ((z - o.floor) / r) * 0.8)),
        (o.floor = z));
    } else o.floor = 0;
    ((o.vy += C.gravity * r), (o.y += o.vy * r));
    const M = Math.max(o.radius, o.core + ce) + o.floor;
    (o.y < M && ((o.y = M), (o.vy = Math.abs(o.vy) > 1 ? -o.vy * 0.28 : 0)),
      (o.x += o.vx * r),
      (o.z += o.vz * r),
      Math.abs(o.x) > Q.x && ((o.x = Math.sign(o.x) * Q.x), (o.vx *= -0.45)),
      Math.abs(o.z) > Q.z && ((o.z = Math.sign(o.z) * Q.z), (o.vz *= -0.45)));
    const R = o.x - P,
      H = o.z - S,
      se = [H / r / o.radius, 0, -R / r / o.radius],
      ee = Math.hypot(a, i, m) > 0.012 ? 40 : 0;
    for (const [z, A] of [
      [0, a],
      [1, i],
      [2, m],
    ])
      ((o.w[z] = (o.w[z] + A * ee * C.roll * r) * Math.exp(-r * 5)),
        Math.abs(o.w[z]) < 0.002 && (o.w[z] = 0));
    K && ((o.w[0] += 16 * r), (o.w[1] += 7 * r));
    const X = o.w[0] + se[0],
      Z = o.w[1],
      V = o.w[2] + se[2],
      [ne, ge, et, tt] = o.q,
      nt = r * 0.5;
    if (
      Math.abs(X) + Math.abs(Z) + Math.abs(V) < 1e-4 &&
      o.y === y &&
      Math.abs(R) + Math.abs(H) < 1e-5
    ) {
      ((o.x = P), (o.z = S), (o.q = D), (o.vx = o.vz = 0));
      return;
    }
    const Ht = [
        ne + nt * (X * tt + Z * et - V * ge),
        ge + nt * (Z * tt + V * ne - X * et),
        et + nt * (V * tt + X * ge - Z * ne),
        tt + nt * (-X * ne - Z * ge - V * et),
      ],
      Hn = Math.hypot(...Ht);
    o.q = Ht.map((z) => z / Hn);
    for (let z = f * 3, A = g * 3; z < A; z++) k[z] = h[z];
    Le(o);
    for (let z = f; z < g; z++) {
      if (x[z]) continue;
      const A = z * 3;
      ((e[A] += h[A] - k[A]),
        (e[A + 1] += h[A + 1] - k[A + 1]),
        (e[A + 2] += h[A + 2] - k[A + 2]));
    }
  }
  function Vn(o) {
    let r = 0;
    const d = 1 + Math.min(de * 4, 6) * C.wind;
    for (let c = o.start, a = c + ie; c < a && r < d; c++) {
      if (!x[c] || u[c]) continue;
      const i = c * 3,
        m = h[i] - e[i],
        w = h[i + 1] - e[i + 1],
        b = h[i + 2] - e[i + 2],
        f = Math.hypot(m, w, b);
      if (f < 0.32) {
        ((e[i] = s[i] = h[i]),
          (e[i + 1] = s[i + 1] = h[i + 1]),
          (e[i + 2] = s[i + 2] = h[i + 2]),
          c > o.start &&
            (p[c - 1] = Math.max(
              Math.hypot(
                l[i] - l[i - 3],
                l[i + 1] - l[i - 2],
                l[i + 2] - l[i - 1],
              ),
              0.02,
            )),
          (x[c] = 0),
          r++);
        continue;
      }
      const g = 0.3 / f;
      ((e[i] += m * g),
        (e[i + 1] += w * g),
        (e[i + 2] += b * g),
        (s[i] = e[i]),
        (s[i + 1] = e[i + 1]),
        (s[i + 2] = e[i + 2]));
      break;
    }
  }
  function Nn() {
    F.fill(-1);
    for (let a = 0; a < B; a++) {
      const i =
        ((Math.floor(e[a * 3] / Fe) * 73856093) ^
          (Math.floor(e[a * 3 + 1] / Fe) * 19349663) ^
          (Math.floor(e[a * 3 + 2] / Fe) * 83492791)) &
        (bt - 1);
      ((U[a] = F[i]), (F[i] = a));
    }
    const o = ce * 1.9,
      r = 0.002,
      d = o * o,
      c = C.woolGrip;
    for (let a = 0; a < B; a++) {
      if (!x[a]) continue;
      const i = Math.floor(e[a * 3] / Fe),
        m = Math.floor(e[a * 3 + 1] / Fe),
        w = Math.floor(e[a * 3 + 2] / Fe);
      for (let b = -1; b <= 1; b++)
        for (let f = -1; f <= 1; f++)
          for (let g = -1; g <= 1; g++) {
            const P =
              (((i + b) * 73856093) ^
                ((m + f) * 19349663) ^
                ((w + g) * 83492791)) &
              (bt - 1);
            for (let y = F[P]; y !== -1; y = U[y]) {
              if (Math.abs(a - y) < 4 || (x[y] && y < a)) continue;
              const S = e[a * 3] - e[y * 3],
                D = e[a * 3 + 1] - e[y * 3 + 1],
                M = e[a * 3 + 2] - e[y * 3 + 2],
                R = S * S + D * D + M * M;
              if (R >= d || R < 1e-9) continue;
              const H = Math.sqrt(R);
              if (H > o - r) continue;
              const se = (o - r - H) / H,
                ee = u[a] ? 0 : 1,
                X = u[y] ? 0 : x[y] ? 1 : 0.08,
                Z = se / Math.max(ee + X, 1e-6);
              ((e[a * 3] += S * Z * ee),
                (e[a * 3 + 1] += D * Z * ee),
                (e[a * 3 + 2] += M * Z * ee),
                (e[y * 3] -= S * Z * X),
                (e[y * 3 + 1] -= D * Z * X),
                (e[y * 3 + 2] -= M * Z * X));
              for (const V of [a, y])
                if (x[V] && !u[V])
                  for (let ne = 0; ne < 3; ne++)
                    s[V * 3 + ne] += (e[V * 3 + ne] - s[V * 3 + ne]) * c;
            }
          }
    }
  }
  const Je = (o) => (u[o] ? 0 : x[o] ? 1 : 0.6);
  function Wn(o) {
    const r = C.gravity * o * o;
    for (let c = 0; c < B; c++) {
      const a = c * 3;
      if (!u[c])
        if (x[c])
          for (let i = 0; i < 3; i++) {
            const m = oe((e[a + i] - s[a + i]) * 0.998 + (i === 1 ? r : 0), De);
            ((s[a + i] = e[a + i]), (e[a + i] += m));
          }
        else
          for (let i = 0; i < 3; i++) e[a + i] += (h[a + i] - e[a + i]) * 0.15;
    }
    for (const [c, a] of re) {
      const i = c * 3;
      for (let m = 0; m < 3; m++) {
        const w = oe(a.to[m] - e[i + m], De);
        ((e[i + m] += w), (s[i + m] = e[i + m]));
      }
    }
    for (let c = 0; c < 4; c++)
      for (let a = 0; a < B - 1; a++) {
        if ((a + 1) % J === 0) continue;
        const i = a * 3,
          m = i + 3,
          w = Je(a),
          b = Je(a + 1),
          f = w + b;
        if (f === 0) continue;
        const g = e[m] - e[i],
          P = e[m + 1] - e[i + 1],
          y = e[m + 2] - e[i + 2],
          S = Math.hypot(g, P, y) || 1e-6,
          D = (S - p[a]) / S / f;
        ((e[i] += g * D * w),
          (e[i + 1] += P * D * w),
          (e[i + 2] += y * D * w),
          (e[m] -= g * D * b),
          (e[m + 1] -= P * D * b),
          (e[m + 2] -= y * D * b));
      }
    for (let c = 0; c < B - 2; c++) {
      if ((!x[c] && !x[c + 2]) || c % J >= J - 2) continue;
      const a = c * 3,
        i = a + 6,
        m = Je(c),
        w = Je(c + 2),
        b = m + w;
      if (b === 0) continue;
      const f = e[i] - e[a],
        g = e[i + 1] - e[a + 1],
        P = e[i + 2] - e[a + 2],
        y = Math.hypot(f, g, P) || 1e-6;
      if (y > we * 1.85) continue;
      const S = (0.34 * (y - we * 1.85)) / y / b;
      ((e[a] += f * S * m),
        (e[a + 1] += g * S * m),
        (e[a + 2] += P * S * m),
        (e[i] -= f * S * w),
        (e[i + 1] -= g * S * w),
        (e[i + 2] -= P * S * w));
    }
    Nn();
    const d = W.length > 0;
    for (let c = 0; c < B; c++) {
      const a = c * 3;
      if (!x[c]) {
        const f = e[a] - h[a],
          g = e[a + 1] - h[a + 1],
          P = e[a + 2] - h[a + 2],
          y = c % J,
          S = (y < J - 1 && x[c + 1]) || (y > 0 && x[c - 1]);
        !K &&
          S &&
          f * f + g * g + P * P > 5e-4 * C.peel * (1 + G[c] * 7 * C.snags) &&
          ((x[c] = 1),
          (s[a] = e[a]),
          (s[a + 1] = e[a + 1]),
          (s[a + 2] = e[a + 2]),
          Ke++);
        continue;
      }
      if (u[c]) continue;
      for (const f of q) {
        if (f.core < 0.02) continue;
        const g = e[a] - f.x,
          P = e[a + 1] - f.y,
          y = e[a + 2] - f.z,
          S = f.core + ce,
          D = g * g + P * P + y * y;
        if (D < S * S) {
          const M = Math.sqrt(D) || 1e-6,
            R = S / M;
          ((e[a] = f.x + g * R),
            (e[a + 1] = f.y + P * R),
            (e[a + 2] = f.z + y * R));
        }
      }
      if (_.on && e[a + 1] < 0.7) {
        const f = e[a] - _.x,
          g = e[a + 2] - _.z,
          P = f * f + g * g;
        if (P < rt * rt) {
          const y = Math.sqrt(P) || 1e-6,
            S = (rt - y) / y;
          ((e[a] += f * S),
            (e[a + 2] += g * S),
            (s[a] += (e[a] - s[a]) * 0.5),
            (s[a + 2] += (e[a + 2] - s[a + 2]) * 0.5));
        }
      }
      const i = ce + (d ? Ze(e[a], e[a + 2]) : 0);
      e[a + 1] < i &&
        ((e[a + 1] = i),
        (s[a] += (e[a] - s[a]) * C.blanketGrip),
        (s[a + 2] += (e[a + 2] - s[a + 2]) * C.blanketGrip));
      const m = e[a] - s[a],
        w = e[a + 1] - s[a + 1],
        b = e[a + 2] - s[a + 2];
      m * m + w * w + b * b < 4e-8 &&
        ((s[a] = e[a]), (s[a + 1] = e[a + 1]), (s[a + 2] = e[a + 2]));
    }
  }
  return {
    pos: e,
    balls: q,
    free: x,
    bounds: Q,
    paw: _,
    ripples: W,
    frameN: te,
    step(o) {
      const r = Math.min(o, 0.03333333333333333);
      for (let d = W.length - 1; d >= 0; d--)
        ((W[d].t += r), W[d].t > 2.4 && W.splice(d, 1));
      K && (de += r);
      for (const d of q) qn(d, r);
      for (let d = 0; d < yt; d++) {
        if (K && d % 2 === 0) for (const c of q) Vn(c);
        Wn(1 / 60 / yt);
      }
    },
    writeFrames(o) {
      const r = e;
      for (const d of q) {
        const c = d.m;
        let a = te[d.start * 3],
          i = te[d.start * 3 + 1],
          m = te[d.start * 3 + 2];
        for (let w = d.start, b = w + J; w < b; w++) {
          const f = w * 3,
            g = w * 8;
          let P,
            y,
            S,
            D = 0;
          if (x[w]) {
            const M = Math.max(w - 1, d.start) * 3,
              R = Math.min(w + 1, b - 1) * 3;
            let H = r[R] - r[M],
              se = r[R + 1] - r[M + 1],
              ee = r[R + 2] - r[M + 2];
            const X = Math.hypot(H, se, ee) || 1;
            ((H /= X), (se /= X), (ee /= X));
            const Z = Math.hypot(
                r[f] - ke[f],
                r[f + 1] - ke[f + 1],
                r[f + 2] - ke[f + 2],
              ),
              V = Math.min(Z * 3, 0.12);
            ((P = te[f] + (a - te[f]) * V),
              (y = te[f + 1] + (i - te[f + 1]) * V),
              (S = te[f + 2] + (m - te[f + 2]) * V));
            const ne = P * H + y * se + S * ee;
            ((P -= H * ne), (y -= se * ne), (S -= ee * ne));
            const ge = Math.hypot(P, y, S);
            (ge < 1e-4
              ? ((P = ee), (y = 0), (S = -H))
              : ((P /= ge), (y /= ge), (S /= ge)),
              w < b - 1 &&
                (D = Math.min(
                  Math.max(
                    (Math.hypot(
                      r[f + 3] - r[f],
                      r[f + 4] - r[f + 1],
                      r[f + 5] - r[f + 2],
                    ) /
                      p[w] -
                      1) *
                      18,
                    0,
                  ),
                  1,
                )));
          } else {
            const M = T[f],
              R = T[f + 1],
              H = T[f + 2];
            ((P = c[0] * M + c[1] * R + c[2] * H),
              (y = c[3] * M + c[4] * R + c[5] * H),
              (S = c[6] * M + c[7] * R + c[8] * H));
          }
          ((te[f] = a = P),
            (te[f + 1] = i = y),
            (te[f + 2] = m = S),
            (ke[f] = r[f]),
            (ke[f + 1] = r[f + 1]),
            (ke[f + 2] = r[f + 2]),
            (xt[w] += (D - xt[w]) * 0.2),
            (o[g] = r[f]),
            (o[g + 1] = r[f + 1]),
            (o[g + 2] = r[f + 2]),
            (o[g + 4] = P),
            (o[g + 5] = y),
            (o[g + 6] = S),
            (o[g + 7] = xt[w]));
        }
      }
    },
    pick(o, r, d = 0.16) {
      let c = -1,
        a = 1 / 0;
      for (let i = 0; i < B; i++) {
        if (!x[i] || u[i]) continue;
        const m = e[i * 3] - o[0],
          w = e[i * 3 + 1] - o[1],
          b = e[i * 3 + 2] - o[2],
          f = m * r[0] + w * r[1] + b * r[2],
          g = Math.hypot(m - r[0] * f, w - r[1] * f, b - r[2] * f);
        if (g > d) continue;
        const P = f + g * 8;
        P < a && ((a = P), (c = i));
      }
      return c;
    },
    ballAt(o, r) {
      let d = null,
        c = 1 / 0;
      for (const a of q) {
        if (a.wound < 30) continue;
        const i = a.x - o[0],
          m = a.y - o[1],
          w = a.z - o[2],
          b = i * r[0] + m * r[1] + w * r[2];
        b > 0 &&
          b < c &&
          Math.hypot(i - r[0] * b, m - r[1] * b, w - r[2] * b) < a.radius &&
          ((d = a), (c = b));
      }
      return d;
    },
    grab(o) {
      ((u[o] = 1), re.set(o, { to: [e[o * 3], e[o * 3 + 1], e[o * 3 + 2]] }));
    },
    moveTo(o, r, d, c) {
      const a = re.get(o);
      a && ((a.to[0] = r), (a.to[1] = Math.max(d, ce)), (a.to[2] = c));
    },
    release(o, r = 0, d = 0, c = 0) {
      ((u[o] = 0), re.delete(o));
      const a = 1 / 60 / yt;
      ((s[o * 3] = e[o * 3] - oe(r * a, De)),
        (s[o * 3 + 1] = e[o * 3 + 1] - oe(d * a, De)),
        (s[o * 3 + 2] = e[o * 3 + 2] - oe(c * a, De)));
    },
    holdBall(o) {
      o.held = { x: o.x, z: o.z };
    },
    moveBallTo(o, r, d) {
      o.held && ((o.held.x = r), (o.held.z = d));
    },
    dropBall(o, r, d) {
      ((o.held = null),
        r !== void 0 && ((o.vx = oe(r, 11)), (o.vz = oe(d, 11))));
    },
    setPaw(o, r) {
      ((_.vx = _.on ? oe((o - _.x) * 0.5, 2) : 0),
        (_.vz = _.on ? oe((r - _.z) * 0.5, 2) : 0),
        (_.x = o),
        (_.z = r),
        (_.on = !0));
    },
    liftPaw() {
      _.on = !1;
    },
    snap(o, r) {
      (W.length >= 4 && W.shift(), W.push({ x: o, z: r, t: 0, a: C.snap }));
    },
    set winding(o) {
      ((K = o), o && (de = 0));
    },
    get winding() {
      return K;
    },
    get tears() {
      return Ke;
    },
  };
}
const go = 21,
  wo = 150,
  Qt = { x: 3.7, z: 3 },
  xe = [
    {
      name: "Hearth",
      wool: ["#c9472a", "#ecdfc8", "#d99a35"],
      cloth: "#123a42",
      night: "#040d10",
    },
    {
      name: "Marigold",
      at: 3.7,
      from: [0, 0.6],
      wool: ["#a92b22", "#fff0d2", "#155a60"],
      cloth: "#e8a51c",
      night: "#7a4a08",
    },
    {
      name: "Clay",
      at: 8.1,
      from: [0.3, 0.4],
      wool: ["#1f7f83", "#efe3cf", "#e9b04f"],
      cloth: "#9c3d26",
      night: "#2a0c06",
    },
    {
      name: "Orchard",
      at: 12.4,
      from: [0, 0.8],
      wool: ["#d43c68", "#f6c4b6", "#efe3cf"],
      cloth: "#1f4a39",
      night: "#06120c",
    },
    {
      name: "Oatmeal",
      at: 16.2,
      from: [0, -0.5],
      wool: ["#b8402b", "#274a66", "#d39a37"],
      cloth: "#d9c7a4",
      night: "#54452e",
    },
  ],
  xo = 0.26,
  yo = (n) => 6 * n + 2 * n ** 4,
  bo = 2.4,
  zo = 0.42,
  qe = (n, t) => n * J + J - t,
  Mo = [
    {
      i: qe(0, 375),
      on: 0.1,
      off: 3.65,
      path: [
        [1.3, -1.1, 1.9, 0.5],
        [2.5, -0.5, 3.3, 0.7],
        [3.65, 0.1, 4.3, 0.6],
      ],
      flick: !0,
    },
    {
      i: qe(2, 375),
      on: 1.2,
      off: 3.65,
      path: [
        [2.4, 0.6, 2, -0.6],
        [3.65, 1, 3.5, 0.2],
      ],
      flick: !0,
    },
    {
      i: qe(0, 300),
      on: 8.5,
      off: 12.25,
      path: [
        [9.7, -1, 2.2, 0.9],
        [11, -1.5, 3.7, 0.5],
        [12.25, -0.9, 4.5, 0.1],
      ],
      flick: !0,
    },
    {
      i: qe(1, 300),
      on: 8.7,
      off: 12.25,
      path: [
        [9.8, 1.1, 2.4, 0.9],
        [11, 1.6, 3.5, 0.6],
        [12.25, 1, 4.7, 0.2],
      ],
      flick: !0,
    },
    {
      i: qe(2, 300),
      on: 9,
      off: 12.25,
      path: [
        [10, 0, 2.9, 1.3],
        [11.2, -0.2, 4.5, 1],
        [12.25, 0.1, 5.2, 0.5],
      ],
      flick: !0,
    },
  ],
  Po = [
    {
      k: 0,
      on: 4.3,
      off: 7.4,
      path: [
        [5.2, -2.6, 1.3],
        [6.3, -1, 2.5],
        [7.4, 1.5, 2.2],
      ],
    },
    {
      k: 1,
      on: 4.6,
      off: 7.7,
      path: [
        [5.5, 2.9, 0.9],
        [6.6, 2.4, -1.4],
        [7.7, 0.4, -2.2],
      ],
    },
    {
      k: 2,
      on: 5.1,
      off: 7.7,
      path: [
        [6.1, -1.6, -2.1],
        [7, -3, -1.2],
        [7.7, -3.2, 0.6],
      ],
    },
  ],
  Kt = { on: 13, speed: 0.55 };
function At(n, t, e = !1) {
  const s = n.length - 1;
  if (t <= n[0][0]) return e ? n[0].slice(1).map(() => 0) : n[0].slice(1);
  if (t >= n[s][0]) return e ? n[0].slice(1).map(() => 0) : n[s].slice(1);
  let h = 0;
  for (; t >= n[h + 1][0]; ) h++;
  const k = n[h],
    T = n[h + 1],
    l = T[0] - k[0],
    x = (t - k[0]) / l,
    u = x * x,
    p = u * x,
    G = (F, U) =>
      F === 0 || F === s
        ? 0
        : (n[F + 1][U] - n[F - 1][U]) / (n[F + 1][0] - n[F - 1][0]);
  return k.slice(1).map((F, U) => {
    const Y = U + 1,
      q = G(h, Y) * l,
      Q = G(h + 1, Y) * l;
    return e
      ? ((6 * u - 6 * x) * k[Y] +
          (3 * u - 4 * x + 1) * q +
          (6 * x - 6 * u) * T[Y] +
          (3 * u - 2 * x) * Q) /
          l
      : (2 * p - 3 * u + 1) * k[Y] +
          (p - 2 * u + x) * q +
          (-2 * p + 3 * u) * T[Y] +
          (p - u) * Q;
  });
}
function To(n, t) {
  const e = Mo.map((T) => ({ ...T, state: 0 })),
    s = Po.map((T) => ({ ...T, state: 0 })),
    h = xe.slice(1).map((T) => ({ ...T, done: !1 }));
  let k = !1;
  return (T) => {
    for (const l of e)
      if (
        (l.state === 0 &&
          T >= l.on &&
          (n.grab(l.i),
          (l.keys = [
            [l.on, n.pos[l.i * 3], n.pos[l.i * 3 + 1], n.pos[l.i * 3 + 2]],
            ...l.path,
          ]),
          (l.state = 1)),
        l.state === 1)
      )
        if (T >= l.off) {
          const x = l.keys.length - 1,
            u = l.keys[x - 1],
            p = l.keys[x],
            G = (1 / (p[0] - u[0])) * 0.6;
          (n.release(
            l.i,
            ...(l.flick
              ? [(p[1] - u[1]) * G, (p[2] - u[2]) * G, (p[3] - u[3]) * G]
              : [0, 0, 0]),
          ),
            (l.state = 2));
        } else n.moveTo(l.i, ...At(l.keys, T));
    for (const l of s) {
      const x = n.balls[l.k];
      if (
        (l.state === 0 &&
          T >= l.on &&
          (n.holdBall(x),
          (l.keys = [[l.on, x.x, x.z], ...l.path]),
          (l.state = 1)),
        l.state === 1)
      )
        if (T >= l.off) {
          const u = l.keys.length - 1,
            p = l.keys[u - 1],
            G = l.keys[u],
            F = (1 / (G[0] - p[0])) * 0.8;
          (n.dropBall(x, (G[1] - p[1]) * F, (G[2] - p[2]) * F), (l.state = 2));
        } else n.moveBallTo(x, ...At(l.keys, T));
    }
    for (const l of h)
      !l.done &&
        T >= l.at &&
        ((l.done = !0), (t.snap = xo), n.snap(l.from[0], l.from[1]));
    !k && T >= Kt.on && ((k = !0), (t.wind = Kt.speed), (n.winding = !0));
  };
}
function Eo(n) {
  let t = 0;
  for (; t + 1 < xe.length && n >= xe[t + 1].at; ) t++;
  const e = t ? n - xe[t].at : 1 / 0;
  return e >= bo
    ? { to: xe[t], from: xe[t], radius: 0 }
    : { to: xe[t], from: xe[t - 1], at: xe[t].from, radius: yo(e) };
}
const ko = [
    [0, -24, 13, 8.6, -0.2, 0.75, 0.5, 24],
    [2, -10, 15, 9.6, -0.15, 1.5, 0.4, 24],
    [3.6, 2, 21, 11.4, 0, 1.7, 0.2, 24],
    [5.4, 8, 46, 15.5, 0, 0.3, 0.3, 24],
    [7.8, -14, 40, 13.5, 0, 0.3, 0.5, 24],
    [9.4, -20, 17, 11.5, 0, 1.3, 0.5, 24],
    [12.2, 10, 11, 12.2, 0, 2.2, 0.4, 24],
    [14.2, 24, 26, 12.2, 0, 0.9, 0.2, 24],
    [17, 2, 30, 12.6, 0, 0.5, -0.4, 24],
    [20, -14, 21, 10.6, 0, 0.55, -0.7, 24],
  ],
  So = [
    [0, -24, 12, 8.8, -0.3, 1, 0.5, 30],
    [2, -10, 13, 10.2, -0.1, 1.9, 0.4, 30],
    [3.6, 2, 18, 12.4, 0.2, 2.2, 0.3, 30],
    [5.4, 8, 52, 18.5, 0, 0.1, 0.3, 30],
    [7.8, -14, 46, 17.5, 0, 0.1, 0.5, 30],
    [9.4, -20, 15, 13.5, 0, 1.9, 0.5, 30],
    [12.2, 10, 9, 14.5, 0, 2.7, 0.4, 30],
    [14.2, 24, 30, 16, 0, 1, 0.2, 30],
    [17, 2, 36, 17, 0, 0.3, -0.5, 30],
    [20, -14, 24, 14.6, 0, 0.5, -0.8, 30],
  ],
  Zt = (n) => (n * Math.PI) / 180;
function Ao(n, t) {
  const [e, s, h, k, T, l, x] = At(t < 1 ? So : ko, n),
    u = Zt(e + Math.sin(n * 0.83) * 0.4),
    p = Zt(s + Math.sin(n * 1.17 + 1) * 0.25);
  return {
    position: [
      k + h * Math.sin(u) * Math.cos(p),
      T + h * Math.sin(p),
      l + h * Math.cos(u) * Math.cos(p),
    ],
    target: [k, T, l],
    fov: x,
  };
}
const vn = io + to,
  gn = ro + no,
  ye = new URLSearchParams(location.search),
  Re = ye.has("capture"),
  Ce = Re ? +ye.get("w") : innerWidth,
  Ge = Re ? +ye.get("h") : innerHeight;
if (Re)
  for (const n of ["#title", "#hint", "#bar", "#controls"])
    document.querySelector(n).style.display = "none";
const Rt = document.querySelector("#message"),
  ae = document.querySelector("#view"),
  ft = document.querySelector("#hint"),
  Ro = (n) => {
    throw ((Rt.textContent = n), new Error(n));
  },
  wn = await navigator.gpu?.requestAdapter();
wn ||
  Ro(
    "This piece needs WebGPU. Try a recent version of Chrome or Edge, or Safari with WebGPU turned on.",
  );
const E = await wn.requestDevice(),
  xn = ao(E);
E.addEventListener("uncapturederror", (n) => console.error(n.error.message));
const yn = ae.getContext("webgpu"),
  bn = navigator.gpu.getPreferredCanvasFormat();
yn.configure({ device: E, format: bn, alphaMode: "opaque" });
for (const n of [vn, gn]) {
  const t = await E.createShaderModule({ code: n }).getCompilationInfo();
  for (const e of t.messages)
    e.type === "error" &&
      console.error(`${e.lineNum}:${e.linePos} ${e.message}`);
}
const he = [
    {
      name: "Hearth",
      wool: ["#c9472a", "#ecdfc8", "#d99a35"],
      cloth: "#123a42",
      night: "#040d10",
    },
    {
      name: "Fjord",
      wool: ["#efe6d6", "#7fa9c4", "#df6b4c"],
      cloth: "#1b2638",
      night: "#05080e",
    },
    {
      name: "Orchard",
      wool: ["#c23a5e", "#f0b9ae", "#e9dcc6"],
      cloth: "#2b4a3a",
      night: "#060e0a",
    },
    {
      name: "Heather",
      wool: ["#d98c9a", "#9fb48d", "#efe5d4"],
      cloth: "#35203c",
      night: "#0a0610",
    },
    {
      name: "Clay",
      wool: ["#1f7f83", "#efe3cf", "#e0a15a"],
      cloth: "#7c3524",
      night: "#130604",
    },
    {
      name: "Oatmeal",
      wool: ["#b8402b", "#274a66", "#d39a37"],
      cloth: "#b9a78a",
      night: "#1c1711",
      light: !0,
    },
  ],
  v = {
    plyTwist: 40,
    fibreTwist: 17,
    hairLength: 1,
    thickness: 1,
    lamp: 1,
    pool: 1.25,
    backLight: 1,
    stitch: 1,
    fibres: 60,
    hairs: 36e3,
    hdr: 1,
    hdrFall: 0.65,
    hdrStrength: 1,
    hdrTurn: 200,
    hdrWarmth: 0.35,
  },
  Be = (n) => {
    const t = new Jn(n);
    return [t.r, t.g, t.b, 1];
  },
  Lt = new Float32Array(B * 8),
  zn = E.createBuffer({
    size: Lt.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  }),
  Se = 10,
  Ye = new Uint32Array((B - Ne) * Se * 6);
for (let n = 0, t = 0; n < B - 1; n++)
  for (let e = 0; e < Se; e++) {
    if ((n + 1) % J === 0) continue;
    const s = n * Se + e,
      h = n * Se + ((e + 1) % Se),
      k = s + Se,
      T = h + Se;
    (Ye.set([s, h, k, h, T, k], t), (t += 6));
  }
const Ft = E.createBuffer({
  size: Ye.byteLength,
  usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
});
E.queue.writeBuffer(Ft, 0, Ye);
const O = new Float32Array(204),
  Dt = E.createBuffer({
    size: O.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  }),
  Ct = 2048,
  Gt = 4,
  Te = "rgba16float",
  Lo = 57600 * 6,
  Jt = 1152 * 6,
  Mn = E.createTexture({
    size: [Ct, Ct],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  }),
  Pn = E.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.FRAGMENT,
        texture: { sampleType: "depth" },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        sampler: { type: "comparison" },
      },
    ],
  }),
  Tn = E.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  }),
  qt = E.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "read-only-storage" },
      },
    ],
  }),
  Fo = E.createBindGroup({
    layout: Pn,
    entries: [
      { binding: 0, resource: { buffer: Dt } },
      { binding: 1, resource: Mn.createView() },
      {
        binding: 2,
        resource: E.createSampler({
          compare: "less",
          magFilter: "linear",
          minFilter: "linear",
        }),
      },
    ],
  }),
  Co = E.createBindGroup({
    layout: Tn,
    entries: [{ binding: 0, resource: { buffer: Dt } }],
  }),
  en = E.createBindGroup({
    layout: qt,
    entries: [{ binding: 0, resource: { buffer: zn } }],
  }),
  _t = E.createShaderModule({ code: vn }),
  Go = E.createPipelineLayout({ bindGroupLayouts: [Pn, qt] }),
  Qe = (n, t, e = "triangle-list", s = !1) =>
    E.createRenderPipeline({
      layout: Go,
      vertex: { module: _t, entryPoint: n },
      fragment: { module: _t, entryPoint: t, targets: [{ format: Te }] },
      primitive: { topology: e, cullMode: "none" },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: !0,
        depthCompare: "less",
      },
      multisample: { count: Gt, alphaToCoverageEnabled: s },
    }),
  _o = Qe("floorVs", "floorFs"),
  Uo = Qe("coreVs", "coreFs"),
  Bo = Qe("tubeVs", "tubeFs"),
  Oo = Qe("fibreVs", "fibreFs", "triangle-strip"),
  Io = Qe("hairVs", "fibreFs", "triangle-strip", !0),
  En = (n) =>
    E.createRenderPipeline({
      layout: E.createPipelineLayout({ bindGroupLayouts: [Tn, qt] }),
      vertex: { module: _t, entryPoint: n },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: !0,
        depthCompare: "less",
        depthBias: 2,
        depthBiasSlopeScale: 2,
      },
    }),
  Do = En("tubeShadowVs"),
  qo = En("coreShadowVs"),
  tn = E.createShaderModule({ code: gn }),
  Vo = E.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  }),
  kn = E.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      {
        binding: 2,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      {
        binding: 4,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { type: "uniform" },
      },
    ],
  }),
  vt = (n, t, e) =>
    E.createRenderPipeline({
      layout: E.createPipelineLayout({ bindGroupLayouts: [kn] }),
      vertex: { module: tn, entryPoint: "quadVs" },
      fragment: {
        module: tn,
        entryPoint: n,
        targets: [e ? { format: t, blend: e } : { format: t }],
      },
    }),
  No = {
    color: { srcFactor: "one", dstFactor: "one" },
    alpha: { srcFactor: "one", dstFactor: "zero" },
  },
  Wo = vt("brightFs", Te),
  Ho = vt("downFs", Te),
  jo = vt("upFs", Te, No),
  Yo = vt("finishFs", bn),
  Sn = E.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  }),
  Oe = new Float32Array(4),
  zt = E.createTexture({
    size: [1, 1],
    format: Te,
    usage: GPUTextureUsage.TEXTURE_BINDING,
  }),
  Mt = 4;
let Ut,
  Bt,
  Ve,
  le = [],
  ht = [],
  An,
  ue = 0,
  fe = 0,
  We = Re ? +(ye.get("ss") ?? 2) : Math.min(devicePixelRatio, 1.5);
const I = new Yn(24, 1, 1, 90);
I.coordinateSystem = dn;
const me = { yaw: 0.1, pitch: 0.6, distance: 15.5, sway: new It() },
  st = new be(0, 0.3, 0),
  Rn = new be(-0.48, 0.76, 0.44).normalize(),
  He = Rn.clone(),
  Pe = new Xn(-8, 8, 8, -8, 1, 34);
Pe.coordinateSystem = dn;
Pe.up.set(0, 1, 0);
const Ln = new un();
let ut = null;
function Ae() {
  const n = oo(O, 124, ut, {
    amount: v.hdr,
    falloff: v.hdrFall,
    strength: v.hdrStrength,
    turn: v.hdrTurn,
    warmth: v.hdrWarmth,
  });
  (He.copy(Rn)
    .lerp(new be(...n), v.hdr)
    .normalize(),
    Pe.position.copy(He).multiplyScalar(17),
    Pe.lookAt(0, 0, 0),
    Pe.updateProjectionMatrix(),
    Pe.updateMatrixWorld(),
    Ln.multiplyMatrices(Pe.projectionMatrix, Pe.matrixWorldInverse));
}
const nn = new un();
let Fn = 1;
function Vt() {
  ((ue = Math.max(1, Math.floor(Ce * We))),
    (fe = Math.max(1, Math.floor(Ge * We))),
    (ae.width = ue),
    (ae.height = fe),
    Ut?.destroy(),
    Bt?.destroy(),
    Ve?.destroy(),
    le.forEach((e) => e.destroy()),
    (Ut = E.createTexture({
      size: [ue, fe],
      format: Te,
      sampleCount: Gt,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })),
    (Bt = E.createTexture({
      size: [ue, fe],
      format: "depth32float",
      sampleCount: Gt,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })),
    (Ve = E.createTexture({
      size: [ue, fe],
      format: Te,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })),
    (le = Array.from({ length: Mt }, (e, s) =>
      E.createTexture({
        size: [Math.max(ue >> (s + 1), 1), Math.max(fe >> (s + 1), 1)],
        format: Te,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      }),
    )));
  const n = (e, s) => {
      const h = E.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      return (
        E.queue.writeBuffer(h, 0, new Float32Array([1 / e, 1 / s, 0, 0])),
        h
      );
    },
    t = (e, s, h) =>
      E.createBindGroup({
        layout: kn,
        entries: [
          { binding: 0, resource: e.createView() },
          { binding: 1, resource: Vo },
          { binding: 2, resource: { buffer: s } },
          { binding: 3, resource: h.createView() },
          { binding: 4, resource: { buffer: xn.buffer } },
        ],
      });
  ht = [
    { pipeline: Wo, group: t(Ve, n(ue, fe), zt), target: le[0], clear: !0 },
  ];
  for (let e = 1; e < Mt; e++)
    ht.push({
      pipeline: Ho,
      group: t(le[e - 1], n(le[e - 1].width, le[e - 1].height), zt),
      target: le[e],
      clear: !0,
    });
  for (let e = Mt - 1; e > 0; e--)
    ht.push({
      pipeline: jo,
      group: t(le[e], n(le[e].width, le[e].height), zt),
      target: le[e - 1],
      clear: !1,
    });
  ((An = t(Ve, Sn, le[0])),
    (Oe[0] = 1 / ue),
    (Oe[1] = 1 / fe),
    (Oe[2] = v.bloom ?? 0.05),
    (I.aspect = ue / fe),
    I.updateProjectionMatrix(),
    (Fn = Math.max(1, 1 / I.aspect)),
    L && (L.bounds.x = 3.5 * Math.max(I.aspect, 1) - 0.9));
}
let L,
  pt = -1,
  gt;
const _e = (n, t, e) => {
  (n &&
    n.forEach((s, h) => {
      s && O.set(Be(s), 40 + h * 4);
    }),
    t && O.set(Be(t), 52),
    e && (O.set(Be(e), 56), (document.body.style.background = e)));
};
function Cn(n) {
  pt = n;
  const t = he[n];
  (_e(t.wool, t.cloth, t.night),
    document.body.classList.toggle("on-light", !!t.light),
    gt?.({
      "wool 1": t.wool[0],
      "wool 2": t.wool[1],
      "wool 3": t.wool[2],
      blanket: t.cloth,
      room: t.night,
    }));
}
function wt(n) {
  const t = he.map((e, s) => s).filter((e) => e !== pt);
  (Cn(n ? 0 : t[Math.floor(Math.random() * t.length)]),
    gt?.({ colourway: he[pt].name }));
  for (const [e] of ve) Wt(e);
  ((L = mn({ seed: Math.floor(Math.random() * 1e9), drop: n ? 0 : 0.9 })),
    (L.bounds.x = 3.5 * Math.max(I.aspect, 1) - 0.9));
  for (let e = 0; e < 12; e++) L.step(1 / 60);
}
const ve = new Map(),
  on = new Kn(),
  an = new It(),
  N = new be(),
  Ot = new be(0, 1, 0),
  Gn = new be(),
  Ee = { at: 0, glow: 0, goal: 0 },
  Xo = 320,
  $o = 8,
  je = (n) => (
    an.set(
      (n.clientX / innerWidth) * 2 - 1,
      -(n.clientY / innerHeight) * 2 + 1,
    ),
    on.setFromCamera(an, I),
    on.ray
  ),
  dt = (n, t, e, s) => {
    const h = t.clone().sub(n.origin).dot(e) / n.direction.dot(e);
    return h > 0 ? s.copy(n.direction).multiplyScalar(h).add(n.origin) : null;
  },
  _n = (n) => {
    const { origin: t, direction: e } = je(n),
      s = [t.x, t.y, t.z],
      h = [e.x, e.y, e.z],
      k = L.pick(s, h);
    if (k >= 0) return { thread: k };
    const T = L.ballAt(s, h);
    return T ? { ball: T } : {};
  },
  mt = (n, t, e, s) => {
    const h = performance.now();
    for (
      n.path.push([h, t, e, s]);
      n.path.length > 2 && h - n.path[0][0] > 90;

    )
      n.path.shift();
  },
  rn = (n) => {
    const t = n.path[0],
      e = n.path[n.path.length - 1],
      s = (e?.[0] - t?.[0]) / 1e3;
    return !(s > 0.008) || performance.now() - e[0] > 70
      ? [0, 0, 0]
      : [(e[1] - t[1]) / s, (e[2] - t[2]) / s, (e[3] - t[3]) / s];
  },
  Un = (n) => {
    navigator.vibrate && navigator.vibrate(n);
  },
  Nt = [
    ["thread", "Pull a thread out of the knot"],
    ["ball", "Throw a ball through it"],
    ["snap", "Tap the blanket to snap it"],
    ["sweep", "Drag across the blanket to sweep thread with your hand"],
    ["wind", "Hold to wind it all back up"],
  ],
  Pt = new Set();
let sn = Nt[0][0];
const Xe = (n) => {
  if (Pt.has(n)) return;
  Pt.add(n);
  const t = Nt.find(([e]) => !Pt.has(e));
  t?.[0] !== sn &&
    ((sn = t?.[0]),
    (ft.style.opacity = 0),
    t &&
      setTimeout(() => {
        ((ft.textContent = t[1]), (ft.style.opacity = 1));
      }, 450));
};
ft.textContent = Nt[0][1];
ae.addEventListener("contextmenu", (n) => n.preventDefault());
ae.addEventListener("pointerdown", (n) => {
  if ((ae.setPointerCapture?.(n.pointerId), (Ee.goal = 0), n.button === 2)) {
    ve.set(n.pointerId, { kind: "orbit", from: [n.clientX, n.clientY] });
    return;
  }
  const t = _n(n),
    e = {
      path: [],
      x0: n.clientX,
      y0: n.clientY,
      t0: performance.now(),
      moved: !1,
    };
  (ve.set(n.pointerId, e),
    t.thread !== void 0
      ? ((e.kind = "thread"),
        (e.i = t.thread),
        L.grab(e.i),
        (e.point = new be().fromArray(L.pos, e.i * 3)),
        (e.normal = I.getWorldDirection(new be())),
        mt(e, e.point.x, e.point.y, e.point.z),
        (ae.style.cursor = "grabbing"),
        Xe("thread"))
      : t.ball
        ? ((e.kind = "ball"),
          (e.ball = t.ball),
          L.holdBall(e.ball),
          mt(e, e.ball.x, 0, e.ball.z),
          (ae.style.cursor = "grabbing"),
          Xe("ball"))
        : ((e.kind = "blanket"),
          dt(je(n), Gn, Ot, N) &&
            ((e.x = N.x), (e.z = N.z), L.setPaw(N.x, N.z))));
});
addEventListener("pointermove", (n) => {
  n.pointerType === "mouse" &&
    me.sway.set(n.clientX / innerWidth - 0.5, n.clientY / innerHeight - 0.5);
  const t = ve.get(n.pointerId);
  if (!t) {
    if (n.target !== ae || ve.size) return;
    const e = _n(n);
    ((ae.style.cursor = e.thread !== void 0 || e.ball ? "grab" : ""),
      e.thread !== void 0 && (Ee.at = e.thread),
      (Ee.goal = e.thread !== void 0 ? 1 : 0));
    return;
  }
  t.kind === "orbit"
    ? ((me.yaw -= (n.clientX - t.from[0]) * 0.005),
      (me.pitch = Math.max(
        0.14,
        Math.min(1.25, me.pitch + (n.clientY - t.from[1]) * 0.004),
      )),
      (t.from = [n.clientX, n.clientY]))
    : t.kind === "thread"
      ? dt(je(n), t.point, t.normal, N) &&
        (L.moveTo(t.i, N.x, N.y, N.z), mt(t, N.x, N.y, N.z))
      : t.kind === "ball"
        ? dt(je(n), new be(0, t.ball.y * 0.5, 0), Ot, N) &&
          (L.moveBallTo(t.ball, N.x, N.z), mt(t, N.x, 0, N.z))
        : t.kind === "blanket" &&
          (Math.hypot(n.clientX - t.x0, n.clientY - t.y0) > $o &&
            (t.moved = !0),
          t.moved && dt(je(n), Gn, Ot, N) && (L.setPaw(N.x, N.z), Xe("sweep")));
});
function Wt(n) {
  const t = ve.get(n);
  if (t) {
    if ((ve.delete(n), t.kind === "thread")) {
      const [e, s, h] = rn(t);
      L.release(t.i, e, s, h);
    } else if (t.kind === "ball") {
      const [e, , s] = rn(t);
      L.dropBall(t.ball, e, s);
    } else
      t.kind === "blanket" &&
        (L.liftPaw(),
        !t.moved &&
          performance.now() - t.t0 < Xo &&
          t.x !== void 0 &&
          (L.snap(t.x, t.z), Un(25), Xe("snap")));
    ve.size || (ae.style.cursor = "");
  }
}
const Bn = (n) => Wt(n.pointerId);
addEventListener("pointerup", Bn);
addEventListener("pointercancel", Bn);
addEventListener("blur", () => {
  for (const [n] of ve) Wt(n);
});
ae.addEventListener(
  "wheel",
  (n) => {
    (n.preventDefault(),
      (me.distance = Math.max(
        3.4,
        Math.min(24, me.distance * Math.exp(n.deltaY * 0.001)),
      )));
  },
  { passive: !1 },
);
const On = document.querySelector("#wind");
let $e = null;
const Ie = (n) => {
  ((L.winding = n), On.setAttribute("aria-pressed", n), n && Xe("wind"));
};
On.addEventListener("pointerdown", (n) => {
  (($e = n.pointerId), Ie(!0));
});
addEventListener("pointerup", (n) => {
  n.pointerId === $e && (($e = null), Ie(!1));
});
addEventListener("pointercancel", (n) => {
  n.pointerId === $e && (($e = null), Ie(!1));
});
addEventListener("blur", () => Ie(!1));
addEventListener("keydown", (n) => {
  n.target.tagName !== "INPUT" &&
    (n.code === "Space" && !n.repeat && (n.preventDefault(), Ie(!0)),
    n.code === "KeyR" && !n.repeat && wt(!1));
});
addEventListener("keyup", (n) => {
  n.code === "Space" && Ie(!1);
});
Ae();
wt(!0);
Vt();
Re || addEventListener("resize", Vt);
document.querySelector("#random").addEventListener("click", () => wt(!1));
const Qo = jn(ye, (n) => {
  ((ut = n), Ae());
});
function Ko() {
  const [, n] = Zn(() => ({
    Studio: Qo,
    Light: at({
      "hdr light": {
        value: v.hdr,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (t) => {
          ((v.hdr = t), Ae());
        },
      },
      "hdr strength": {
        value: v.hdrStrength,
        min: 0.2,
        max: 2.5,
        step: 0.01,
        onChange: (t) => {
          ((v.hdrStrength = t), Ae());
        },
      },
      "hdr turn": {
        value: v.hdrTurn,
        min: 0,
        max: 360,
        step: 1,
        onChange: (t) => {
          ((v.hdrTurn = t), Ae());
        },
      },
      "hdr warmth": {
        value: v.hdrWarmth,
        min: -1,
        max: 2,
        step: 0.01,
        onChange: (t) => {
          ((v.hdrWarmth = t), Ae());
        },
      },
      "room falloff": {
        value: v.hdrFall,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (t) => {
          ((v.hdrFall = t), Ae());
        },
      },
    }),
    colourway: {
      options: he.map((t) => t.name),
      value: he[0].name,
      onChange: (t, e, s) => {
        if (!s.initial) {
          const h = he.findIndex((k) => k.name === t);
          h !== pt && Cn(h);
        }
      },
    },
    Wool: at({
      "wool 1": { value: he[0].wool[0], onChange: (t) => _e([t]) },
      "wool 2": { value: he[0].wool[1], onChange: (t) => _e([null, t]) },
      "wool 3": { value: he[0].wool[2], onChange: (t) => _e([null, null, t]) },
      thickness: {
        value: v.thickness,
        min: 0.7,
        max: 1.3,
        step: 0.01,
        onChange: (t) => {
          v.thickness = t;
        },
      },
      "ply twist": {
        value: v.plyTwist,
        min: 0,
        max: 80,
        step: 0.5,
        onChange: (t) => {
          v.plyTwist = t;
        },
      },
      "fibre twist": {
        value: v.fibreTwist,
        min: 0,
        max: 30,
        step: 0.5,
        onChange: (t) => {
          v.fibreTwist = t;
        },
      },
      fibres: {
        value: v.fibres,
        min: 16,
        max: 110,
        step: 1,
        onChange: (t) => {
          v.fibres = t;
        },
      },
      hairs: {
        value: v.hairs,
        min: 0,
        max: 6e4,
        step: 500,
        onChange: (t) => {
          v.hairs = t;
        },
      },
      "hair length": {
        value: v.hairLength,
        min: 0,
        max: 2.5,
        step: 0.01,
        onChange: (t) => {
          v.hairLength = t;
        },
      },
    }),
    Feel: at({
      "peel strength": {
        value: C.peel,
        min: 0.2,
        max: 5,
        step: 0.05,
        onChange: (t) => {
          C.peel = t;
        },
      },
      snags: {
        value: C.snags,
        min: 0,
        max: 4,
        step: 0.05,
        onChange: (t) => {
          C.snags = t;
        },
      },
      "ball rolls": {
        value: C.roll,
        min: 0,
        max: 3,
        step: 0.05,
        onChange: (t) => {
          C.roll = t;
        },
      },
      gravity: {
        value: -C.gravity,
        min: 1,
        max: 15,
        step: 0.1,
        onChange: (t) => {
          C.gravity = -t;
        },
      },
      "wool grip": {
        value: C.woolGrip,
        min: 0,
        max: 0.4,
        step: 0.005,
        onChange: (t) => {
          C.woolGrip = t;
        },
      },
      "blanket grip": {
        value: C.blanketGrip,
        min: 0.05,
        max: 0.95,
        step: 0.01,
        onChange: (t) => {
          C.blanketGrip = t;
        },
      },
      "snap height": {
        value: C.snap,
        min: 0.05,
        max: 0.6,
        step: 0.01,
        onChange: (t) => {
          C.snap = t;
        },
      },
      "wind speed": {
        value: C.wind,
        min: 0.2,
        max: 3,
        step: 0.05,
        onChange: (t) => {
          C.wind = t;
        },
      },
    }),
    Room: at(
      {
        blanket: { value: he[0].cloth, onChange: (t) => _e(null, t) },
        room: { value: he[0].night, onChange: (t) => _e(null, null, t) },
        "stitch size": {
          value: v.stitch,
          min: 0.5,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            v.stitch = t;
          },
        },
        lamp: {
          value: v.lamp,
          min: 0.2,
          max: 2,
          step: 0.01,
          onChange: (t) => {
            v.lamp = t;
          },
        },
        "light pool": {
          value: v.pool,
          min: 0.4,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            v.pool = t;
          },
        },
        "back light": {
          value: v.backLight,
          min: 0,
          max: 2.5,
          step: 0.01,
          onChange: (t) => {
            v.backLight = t;
          },
        },
        glow: {
          value: 0.05,
          min: 0,
          max: 0.4,
          step: 0.005,
          onChange: (t) => {
            ((v.bloom = t), (Oe[2] = t));
          },
        },
      },
      { collapsed: !0 },
    ),
    "new tangle": eo(() => wt(!1)),
    ...xn.controls(),
  }));
  return ((gt = n), null);
}
Re ||
  $n.createRoot(document.querySelector("#controls")).render(
    ot.createElement(
      ot.Fragment,
      null,
      ot.createElement(Qn, {
        collapsed: !0,
        titleBar: { title: "Controls" },
      }),
      ot.createElement(Ko),
    ),
  );
let Tt = 0,
  Et = performance.now(),
  lt = 0,
  ln = performance.now(),
  ct = 0,
  cn = 0,
  fn = 0;
const hn = ((J - 1) * 2 + 1) * 2,
  kt = new It();
function In(n) {
  const t = (n - ln) / 1e3;
  for (ct = Math.min(ct + t, 3 / 60), ln = n; ct >= 1 / 60; )
    (L.step(1 / 60), (ct -= 1 / 60));
  (L.tears > cn &&
    (ve.size && n - fn > 70 && (Un(6), (fn = n)), (cn = L.tears)),
    (Ee.glow += (Ee.goal - Ee.glow) * Math.min(t * 10, 1)),
    kt.lerp(me.sway, 0.04));
  const e = me.distance * Fn,
    s = me.yaw + kt.x * 0.16,
    h = Math.max(0.12, me.pitch + kt.y * 0.06);
  if (
    (I.position.set(
      st.x + Math.sin(s) * Math.cos(h) * e,
      st.y + Math.sin(h) * e,
      st.z + Math.cos(s) * Math.cos(h) * e,
    ),
    I.lookAt(st),
    Dn(n / 1e3),
    Tt++,
    n - Et > 1e3)
  ) {
    const k = (Tt * 1e3) / (n - Et);
    ((Tt = 0),
      (Et = n),
      (lt = k < 40 && !document.hidden && n > 5e3 ? lt + 1 : 0),
      lt >= 3 &&
        ((lt = 0),
        v.fibres > 40
          ? ((v.fibres = 40),
            (v.hairs = Math.min(v.hairs, 12e3)),
            gt?.({ fibres: v.fibres, hairs: v.hairs }))
          : We > 0.75 && ((We = Math.max(We * 0.85, 0.75)), Vt())));
  }
  requestAnimationFrame(In);
}
function Dn(n) {
  (L.writeFrames(Lt),
    E.queue.writeBuffer(zn, 0, Lt),
    I.updateMatrixWorld(),
    nn.multiplyMatrices(I.projectionMatrix, I.matrixWorldInverse),
    O.set(nn.elements, 0),
    O.set(Ln.elements, 16),
    O.set([I.position.x, I.position.y, I.position.z, n], 32),
    O.set([He.x, He.y, He.z, Ct / (ut ? Math.sqrt(ut.soft / 4) : 1)], 36),
    O.set([ue, fe, (2 * Math.tan((I.fov * Math.PI) / 360)) / fe, 0], 60));
  const { balls: t, paw: e, ripples: s } = L;
  (t.forEach((u, p) => {
    (O.set([u.x, u.y, u.z, u.wound > 30 ? u.radius : 0], 64 + p * 4),
      (O[76 + p] = u.core),
      O.set(u.q, 112 + p * 4));
  }),
    O.set([e.x, 0, e.z, e.on ? 1 : 0], 80),
    O.set([v.plyTwist, v.fibreTwist, v.hairLength, v.thickness], 84),
    O.set([v.lamp, v.pool, v.backLight, v.stitch], 88),
    O.set([Ee.at, Ee.glow, s.length, 0], 92));
  for (let u = 0; u < 4; u++) {
    const p = s[u];
    O.set(p ? [p.x, p.z, p.t, p.a] : [0, 0, 0, 0], 96 + u * 4);
  }
  E.queue.writeBuffer(Dt, 0, O);
  const h = E.createCommandEncoder(),
    k = h.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: Mn.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
  (k.setBindGroup(0, Co),
    k.setBindGroup(1, en),
    k.setPipeline(Do),
    k.setIndexBuffer(Ft, "uint32"),
    k.drawIndexed(Ye.length),
    k.setPipeline(qo),
    k.draw(Jt, Ne),
    k.end());
  const T = O.subarray(56, 59),
    l = h.beginRenderPass({
      colorAttachments: [
        {
          view: Ut.createView(),
          resolveTarget: Ve.createView(),
          clearValue: [T[0], T[1], T[2], 1],
          loadOp: "clear",
          storeOp: "discard",
        },
      ],
      depthStencilAttachment: {
        view: Bt.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard",
      },
    });
  (l.setBindGroup(0, Fo),
    l.setBindGroup(1, en),
    l.setPipeline(_o),
    l.draw(Lo),
    l.setPipeline(Uo),
    l.draw(Jt, Ne),
    l.setPipeline(Bo),
    l.setIndexBuffer(Ft, "uint32"),
    l.drawIndexed(Ye.length),
    l.setPipeline(Oo));
  for (let u = 0; u < Ne; u++) l.draw(hn, v.fibres, u * hn);
  (v.hairs && (l.setPipeline(Io), l.draw(16, v.hairs)), l.end());
  for (const u of ht) {
    const p = h.beginRenderPass({
      colorAttachments: [
        {
          view: u.target.createView(),
          clearValue: [0, 0, 0, 1],
          loadOp: u.clear ? "clear" : "load",
          storeOp: "store",
        },
      ],
    });
    (p.setPipeline(u.pipeline), p.setBindGroup(0, u.group), p.draw(3), p.end());
  }
  ((Oe[3] = n), E.queue.writeBuffer(Sn, 0, Oe));
  const x = h.beginRenderPass({
    colorAttachments: [
      {
        view: yn.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  (x.setPipeline(Yo),
    x.setBindGroup(0, An),
    x.draw(3),
    x.end(),
    E.queue.submit([h.finish()]));
}
if (!Re) (Rt.remove(), requestAnimationFrame(In));
else {
  (Rt.remove(),
    (ae.style.cssText = `position:fixed;left:0;top:0;width:${Ce}px;height:${Ge}px`));
  const n = +ye.get("fps"),
    t = +ye.get("frames"),
    e = +(ye.get("every") ?? 1),
    s = ye.get("port");
  ((v.fibres = 70),
    (v.hairs = 42e3),
    (I.near = 0.3),
    (L = mn({ seed: go })),
    (L.bounds.x = Qt.x),
    (L.bounds.z = Qt.z));
  for (let p = 0; p < wo; p++) L.step(1 / 60);
  const h = To(L, C),
    k = (p, G) => {
      (G.wool.forEach((F, U) => O.set(Be(F), p + U * 4)),
        O.set(Be(G.cloth), p + 12),
        O.set(Be(G.night), p + 16));
    },
    T = document.createElement("canvas");
  ((T.width = Ce), (T.height = Ge));
  const l = T.getContext("2d");
  l.imageSmoothingQuality = "high";
  let x = 0;
  ((window.__frame = async (p) => {
    for (; x <= p; ) (h(x / n), L.step(1 / n), x++);
    const G = (p + 1) / n,
      F = Ao(G, Ce / Ge),
      U = Eo(G);
    return (
      (I.fov = F.fov),
      (I.aspect = Ce / Ge),
      I.position.set(...F.position),
      I.lookAt(...F.target),
      I.updateProjectionMatrix(),
      k(40, U.to),
      k(184, U.from),
      O.set(U.radius ? [U.at[0], U.at[1], U.radius, zo] : [0, 0, 0, 0], 180),
      Dn(G),
      l.drawImage(ae, 0, 0, Ce, Ge),
      new Promise((Y) => T.toBlob(Y, "image/png"))
    );
  }),
    (window.__ready = !0));
  const u = (p) =>
    s &&
    fetch(`http://localhost:${s}/log?m=${encodeURIComponent(p)}`).catch(
      () => {},
    );
  if (
    (addEventListener("error", (p) => u(`error ${p.message}`)),
    addEventListener("unhandledrejection", (p) => u(`rejection ${p.reason}`)),
    E.addEventListener("uncapturederror", (p) => u(`gpu ${p.error.message}`)),
    E.lost.then((p) => u(`DEVICE LOST ${p.reason} ${p.message}`)),
    s)
  ) {
    for (let p = 0; p < t; p++) {
      const G = await window.__frame(p);
      if (p % e) continue;
      const F = await G.arrayBuffer();
      for (let U = 0; ; U++)
        try {
          await fetch(`http://localhost:${s}/frame?i=${p / e}`, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: F,
          });
          break;
        } catch (Y) {
          if (U > 20) throw Y;
          await new Promise((q) => setTimeout(q, 100 + U * 100));
        }
    }
    await fetch(`http://localhost:${s}/done`);
  }
}
