import"./modulepreload-polyfill-ulV_1b7r.js";import{y as Wa}from"./studio-presets-CDYyrMX7.js";import"./three-C2t3z6N3.js";import{u as ja,aG as ha,B as be,X as $a,f as da,r as Ot,P as Xa,O as ot,a as Ya,C as Ka,e as Qa,S as Za,l as nt,L as Ja}from"./leva-C0l7872o.js";import{q as eo,y as to,_ as ao}from"./studio-light-BWXy2tng.js";import{u as oo,i as no}from"./look-DcDmlVv9.js";const ro=`// Yarn drawn fibre by fibre. The simulation only knows a centre line; each fibre is generated from it here, on the GPU, after
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
`,Ne=3,J=2e3,_=Ne*J,ce=.036,we=.042,io=420,lo=40,ie=J-lo,Be=.6,Yt=.68,xt=6,Ie=.028,rt=.42,Fe=ce*2,bt=32768,so=[[-2.15,-.45],[2.15,-.65],[.05,-1.75]],it=[.05,.95],U={peel:1,snags:1,roll:1,gravity:-7,woolGrip:.14,blanketGrip:.55,snap:.14,wind:1},co=6,fo=.5,ho=4.5,uo=1.7,po=(a,t,e)=>{const l=Math.hypot(t-a.x,e-a.z)-co*a.t;return a.a*Math.exp(-a.t*uo)*Math.min(a.t*8,1)*Math.exp(-l*l/fo)*Math.cos(l*ho)},ua=a=>()=>{a=a+1831565813|0;let t=Math.imul(a^a>>>15,1|a);return t=t+Math.imul(t^t>>>7,61|t)^t,((t^t>>>14)>>>0)/4294967296},Rt=(a,t)=>[a[1]*t[2]-a[2]*t[1],a[2]*t[0]-a[0]*t[2],a[0]*t[1]-a[1]*t[0]],pe=a=>{const t=Math.hypot(...a)||1;return a.map(e=>e/t)},oe=(a,t)=>Math.max(Math.min(a,t),-t);function mo(a){const t=ua(a),e=new Float32Array(ie*3);let l=pe([t()-.5,t()-.5,t()-.5]),h=0;const E=[];for(;h<ie;){const P=Be+(Yt-Be)*h/ie,s=3+Math.floor(t()*3),y=s*ce*2.1/(2*P);let u,p=1/0;for(let K=0;K<12;K++){const C=pe(Rt(l,pe([t()-.5,t()-.5,t()-.5]))),re=Math.cos(y),H=Math.sin(y),Q=[C[0]*re-l[0]*H,C[1]*re-l[1]*H,C[2]*re-l[2]*H],de=E.slice(-8).reduce((Qe,Ge)=>Math.max(Qe,Math.abs(Q[0]*Ge[0]+Q[1]*Ge[1]+Q[2]*Ge[2])),0);de<p&&(p=de,u=Q)}E.push(u);const L=l[0]*u[0]+l[1]*u[1]+l[2]*u[2],F=pe([l[0]-u[0]*L,l[1]-u[1]*L,l[2]-u[2]*L]),B=Rt(u,F),$=s*Math.PI*2;let D=0;for(;D<$&&h<ie;){const K=Be+(Yt-Be)*h/ie,C=(D/$*2-1)*y,re=Math.cos(C),H=Math.sin(C),Q=Math.cos(D),de=Math.sin(D);l=[re*(F[0]*Q+B[0]*de)+u[0]*H,re*(F[1]*Q+B[1]*de)+u[1]*H,re*(F[2]*Q+B[2]*de)+u[2]*H],e.set([l[0]*K,l[1]*K,l[2]*K],h*3),D+=we/(K*Math.max(re,.3)),h++}}return e}function pa({seed:a=1,drop:t=0}={}){const e=new Float32Array(_*3),l=new Float32Array(_*3),h=new Float32Array(_*3),E=new Float32Array(_*3),P=new Float32Array(_*3),s=new Float32Array(_*3),y=new Uint8Array(_),u=new Uint8Array(_),p=new Float32Array(_).fill(we),L=new Float32Array(_),F=new Int32Array(bt),B=new Int32Array(_),$=ua(a^1540483477),D=so.map(([o,r],d)=>({k:d,start:d*J,x:o,y:0,z:r,vx:0,vy:0,vz:0,q:[0,0,0,1],w:[0,0,0],m:new Float32Array(9),radius:0,core:Be-.012,wound:0,floor:0,held:null,home:[o,r]})),K={x:3.4,z:2.8},C={x:0,z:0,on:!1,vx:0,vz:0},re=new Map,H=[];let Q=!1,de=0,Qe=0;const Ge=o=>{const[r,d,c,n]=o.q,i=o.m;i.set([1-2*(d*d+c*c),2*(r*d-c*n),2*(r*c+d*n),2*(r*d+c*n),1-2*(r*r+c*c),2*(d*c-r*n),2*(r*c-d*n),2*(d*c+r*n),1-2*(r*r+d*d)]);for(let m=o.start,w=o.start+ie;m<w;m++){const b=s[m*3],f=s[m*3+1],g=s[m*3+2];h[m*3]=o.x+i[0]*b+i[1]*f+i[2]*g,h[m*3+1]=o.y+i[3]*b+i[4]*f+i[5]*g,h[m*3+2]=o.z+i[6]*b+i[7]*f+i[8]*g}};for(const o of D){const r=o.start,d=r+J-io,c=mo(a+o.k*7919);s.set(c,r*3);for(let M=r;M<r+ie;M++)L[M]=$()**9;let n=0;for(let M=r;M<d;M++)n=Math.max(n,s[M*3]**2+s[M*3+1]**2+s[M*3+2]**2);o.radius=Math.sqrt(n)+ce,o.y=o.radius+t;const i=pe([it[0]-o.x,0,it[1]-o.z]),m=pe([i[0]*.7,-.62,i[2]*.7]),w=(d-1)*3,b=pe([s[w],s[w+1],s[w+2]]);o.q=pe([...Rt(b,m),1+b[0]*m[0]+b[1]*m[1]+b[2]*m[2]]),Ge(o);for(let M=r;M<d;M++)for(let S=0;S<3;S++)e[M*3+S]=h[M*3+S];for(let M=r;M<r+ie-1;M++){const S=M*3;M<d-1&&(p[M]=Math.hypot(e[S+3]-e[S],e[S+4]-e[S+1],e[S+5]-e[S+2]))}let f=e[w],g=e[w+1],k=e[w+2],x=Math.atan2(i[2],i[0]),R=0,I=$()*6.28;for(let M=d;M<r+J;M++){const S=M-d;y[M]=1;const W=Math.min(S/60,1),le=it[0]-f,ee=it[1]-k,X=Math.hypot(le,ee);if(R+=($()-.5)*.3,R=oe(R,1.35),x+=R*we*W,X>1.65){let V=Math.atan2(ee,le)-x;V=Math.atan2(Math.sin(V),Math.cos(V)),x+=V*Math.min((X-1.65)*.3,.12)}const Z=ce+.1+W*(.55+.5*Math.sin(S*we*.95+I)+.25*Math.sin(S*we*2.3+I*2.1))*1.15;f+=Math.cos(x)*we,k+=Math.sin(x)*we,g+=(Z-g)*.12,e.set([f,Math.max(g,ce),k],M*3)}}l.set(e);const te=new Float32Array(_*3),Ee=new Float32Array(_*3),yt=new Float32Array(_);for(const o of D){let r=[0,1,0];for(let d=o.start,c=d+J;d<c;d++){const n=d<o.start+ie,i=n?s:e,m=n?o.start+ie-1:c-1,w=n?o.start:o.start+ie,b=Math.max(d-1,w)*3,f=Math.min(d+1,m)*3,g=pe([i[f]-i[b],i[f+1]-i[b+1],i[f+2]-i[b+2]]),k=r[0]*g[0]+r[1]*g[1]+r[2]*g[2];r=pe([r[0]-g[0]*k,r[1]-g[1]*k,r[2]-g[2]*k]),P.set(r,d*3),te.set(r,d*3)}}Ee.set(e);const Ze=(o,r)=>{let d=0;for(const c of H)d+=po(c,o,r);return d};function Ia(o,r){let d=0,c=0,n=0,i=0,m=0,w=0,b=0;const f=o.start,g=f+ie;for(let z=f;z<g;z++){if(y[z])continue;b++;const A=z*3,j=e[A]-h[A],Y=e[A+1]-h[A+1],ze=e[A+2]-h[A+2],Me=h[A]-o.x,jt=h[A+1]-o.y,$t=h[A+2]-o.z;d+=j,c+=ze,n+=jt*ze-$t*Y,i+=$t*j-Me*ze,m+=Me*Y-jt*j;const Xt=s[A]**2+s[A+1]**2+s[A+2]**2;Xt>w&&(w=Xt)}if(o.wound=b,o.core+=((b>30?Be-.012:0)-o.core)*Math.min(r*3,1),b===0)return;o.radius=Math.sqrt(w)+ce;const k=o.x,x=o.y,R=o.z,I=o.q;if(o.held)o.vx=oe((o.held.x-o.x)*14,11),o.vz=oe((o.held.z-o.z)*14,11);else{const z=Math.hypot(d,c),A=z>.012?(z-.012)/z:0,j=110*U.roll*r;o.vx=oe((o.vx+d*A*j)*Math.exp(-r*2.4),11),o.vz=oe((o.vz+c*A*j)*Math.exp(-r*2.4),11)}if(Q&&(o.vx+=((o.home[0]-o.x)*1.4-o.vx)*Math.min(r*3,1),o.vz+=((o.home[1]-o.z)*1.4-o.vz)*Math.min(r*3,1)),C.on){const z=o.x-C.x,A=o.z-C.z,j=Math.hypot(z,A)||1e-6,Y=o.radius+rt*.6;j<Y&&(o.vx+=z/j*(Y-j)*40*r+C.vx*.2,o.vz+=A/j*(Y-j)*40*r+C.vz*.2)}for(const z of D){if(z===o||z.wound<30)continue;const A=o.x-z.x,j=o.z-z.z,Y=Math.hypot(A,j)||1e-6,ze=o.radius+z.radius;if(Y<ze&&Math.abs(o.y-z.y)<ze){const Me=((o.vx-z.vx)*A+(o.vz-z.vz)*j)/Y;Me<0&&(o.vx-=A/Y*Me*.8,o.vz-=j/Y*Me*.8,z.held||(z.vx+=A/Y*Me*.8,z.vz+=j/Y*Me*.8)),o.x+=A/Y*(ze-Y)*.5,o.z+=j/Y*(ze-Y)*.5}}if(H.length){const z=Ze(o.x,o.z);o.vx-=(Ze(o.x+.08,o.z)-z)/.08*9*r,o.vz-=(Ze(o.x,o.z+.08)-z)/.08*9*r,z>o.floor&&(o.vy=Math.max(o.vy,(z-o.floor)/r*.8)),o.floor=z}else o.floor=0;o.vy+=U.gravity*r,o.y+=o.vy*r;const M=Math.max(o.radius,o.core+ce)+o.floor;o.y<M&&(o.y=M,o.vy=Math.abs(o.vy)>1?-o.vy*.28:0),o.x+=o.vx*r,o.z+=o.vz*r,Math.abs(o.x)>K.x&&(o.x=Math.sign(o.x)*K.x,o.vx*=-.45),Math.abs(o.z)>K.z&&(o.z=Math.sign(o.z)*K.z,o.vz*=-.45);const S=o.x-k,W=o.z-R,le=[W/r/o.radius,0,-S/r/o.radius],ee=Math.hypot(n,i,m)>.012?40:0;for(const[z,A]of[[0,n],[1,i],[2,m]])o.w[z]=(o.w[z]+A*ee*U.roll*r)*Math.exp(-r*5),Math.abs(o.w[z])<.002&&(o.w[z]=0);Q&&(o.w[0]+=16*r,o.w[1]+=7*r);const X=o.w[0]+le[0],Z=o.w[1],V=o.w[2]+le[2],[ae,ge,et,tt]=o.q,at=r*.5;if(Math.abs(X)+Math.abs(Z)+Math.abs(V)<1e-4&&o.y===x&&Math.abs(S)+Math.abs(W)<1e-5){o.x=k,o.z=R,o.q=I,o.vx=o.vz=0;return}const Wt=[ae+at*(X*tt+Z*et-V*ge),ge+at*(Z*tt+V*ae-X*et),et+at*(V*tt+X*ge-Z*ae),tt+at*(-X*ae-Z*ge-V*et)],Ha=Math.hypot(...Wt);o.q=Wt.map(z=>z/Ha);for(let z=f*3,A=g*3;z<A;z++)E[z]=h[z];Ge(o);for(let z=f;z<g;z++){if(y[z])continue;const A=z*3;e[A]+=h[A]-E[A],e[A+1]+=h[A+1]-E[A+1],e[A+2]+=h[A+2]-E[A+2]}}function Da(o){let r=0;const d=1+Math.min(de*4,6)*U.wind;for(let c=o.start,n=c+ie;c<n&&r<d;c++){if(!y[c]||u[c])continue;const i=c*3,m=h[i]-e[i],w=h[i+1]-e[i+1],b=h[i+2]-e[i+2],f=Math.hypot(m,w,b);if(f<.32){e[i]=l[i]=h[i],e[i+1]=l[i+1]=h[i+1],e[i+2]=l[i+2]=h[i+2],c>o.start&&(p[c-1]=Math.max(Math.hypot(s[i]-s[i-3],s[i+1]-s[i-2],s[i+2]-s[i-1]),.02)),y[c]=0,r++;continue}const g=.3/f;e[i]+=m*g,e[i+1]+=w*g,e[i+2]+=b*g,l[i]=e[i],l[i+1]=e[i+1],l[i+2]=e[i+2];break}}function Va(){F.fill(-1);for(let n=0;n<_;n++){const i=(Math.floor(e[n*3]/Fe)*73856093^Math.floor(e[n*3+1]/Fe)*19349663^Math.floor(e[n*3+2]/Fe)*83492791)&bt-1;B[n]=F[i],F[i]=n}const o=ce*1.9,r=.002,d=o*o,c=U.woolGrip;for(let n=0;n<_;n++){if(!y[n])continue;const i=Math.floor(e[n*3]/Fe),m=Math.floor(e[n*3+1]/Fe),w=Math.floor(e[n*3+2]/Fe);for(let b=-1;b<=1;b++)for(let f=-1;f<=1;f++)for(let g=-1;g<=1;g++){const k=((i+b)*73856093^(m+f)*19349663^(w+g)*83492791)&bt-1;for(let x=F[k];x!==-1;x=B[x]){if(Math.abs(n-x)<4||y[x]&&x<n)continue;const R=e[n*3]-e[x*3],I=e[n*3+1]-e[x*3+1],M=e[n*3+2]-e[x*3+2],S=R*R+I*I+M*M;if(S>=d||S<1e-9)continue;const W=Math.sqrt(S);if(W>o-r)continue;const le=(o-r-W)/W,ee=u[n]?0:1,X=u[x]?0:y[x]?1:.08,Z=le/Math.max(ee+X,1e-6);e[n*3]+=R*Z*ee,e[n*3+1]+=I*Z*ee,e[n*3+2]+=M*Z*ee,e[x*3]-=R*Z*X,e[x*3+1]-=I*Z*X,e[x*3+2]-=M*Z*X;for(const V of[n,x])if(y[V]&&!u[V])for(let ae=0;ae<3;ae++)l[V*3+ae]+=(e[V*3+ae]-l[V*3+ae])*c}}}}const Je=o=>u[o]?0:y[o]?1:.6;function Na(o){const r=U.gravity*o*o;for(let c=0;c<_;c++){const n=c*3;if(!u[c])if(y[c])for(let i=0;i<3;i++){const m=oe((e[n+i]-l[n+i])*.998+(i===1?r:0),Ie);l[n+i]=e[n+i],e[n+i]+=m}else for(let i=0;i<3;i++)e[n+i]+=(h[n+i]-e[n+i])*.15}for(const[c,n]of re){const i=c*3;for(let m=0;m<3;m++){const w=oe(n.to[m]-e[i+m],Ie);e[i+m]+=w,l[i+m]=e[i+m]}}for(let c=0;c<4;c++)for(let n=0;n<_-1;n++){if((n+1)%J===0)continue;const i=n*3,m=i+3,w=Je(n),b=Je(n+1),f=w+b;if(f===0)continue;const g=e[m]-e[i],k=e[m+1]-e[i+1],x=e[m+2]-e[i+2],R=Math.hypot(g,k,x)||1e-6,I=(R-p[n])/R/f;e[i]+=g*I*w,e[i+1]+=k*I*w,e[i+2]+=x*I*w,e[m]-=g*I*b,e[m+1]-=k*I*b,e[m+2]-=x*I*b}for(let c=0;c<_-2;c++){if(!y[c]&&!y[c+2]||c%J>=J-2)continue;const n=c*3,i=n+6,m=Je(c),w=Je(c+2),b=m+w;if(b===0)continue;const f=e[i]-e[n],g=e[i+1]-e[n+1],k=e[i+2]-e[n+2],x=Math.hypot(f,g,k)||1e-6;if(x>we*1.85)continue;const R=.34*(x-we*1.85)/x/b;e[n]+=f*R*m,e[n+1]+=g*R*m,e[n+2]+=k*R*m,e[i]-=f*R*w,e[i+1]-=g*R*w,e[i+2]-=k*R*w}Va();const d=H.length>0;for(let c=0;c<_;c++){const n=c*3;if(!y[c]){const f=e[n]-h[n],g=e[n+1]-h[n+1],k=e[n+2]-h[n+2],x=c%J,R=x<J-1&&y[c+1]||x>0&&y[c-1];!Q&&R&&f*f+g*g+k*k>5e-4*U.peel*(1+L[c]*7*U.snags)&&(y[c]=1,l[n]=e[n],l[n+1]=e[n+1],l[n+2]=e[n+2],Qe++);continue}if(u[c])continue;for(const f of D){if(f.core<.02)continue;const g=e[n]-f.x,k=e[n+1]-f.y,x=e[n+2]-f.z,R=f.core+ce,I=g*g+k*k+x*x;if(I<R*R){const M=Math.sqrt(I)||1e-6,S=R/M;e[n]=f.x+g*S,e[n+1]=f.y+k*S,e[n+2]=f.z+x*S}}if(C.on&&e[n+1]<.7){const f=e[n]-C.x,g=e[n+2]-C.z,k=f*f+g*g;if(k<rt*rt){const x=Math.sqrt(k)||1e-6,R=(rt-x)/x;e[n]+=f*R,e[n+2]+=g*R,l[n]+=(e[n]-l[n])*.5,l[n+2]+=(e[n+2]-l[n+2])*.5}}const i=ce+(d?Ze(e[n],e[n+2]):0);e[n+1]<i&&(e[n+1]=i,l[n]+=(e[n]-l[n])*U.blanketGrip,l[n+2]+=(e[n+2]-l[n+2])*U.blanketGrip);const m=e[n]-l[n],w=e[n+1]-l[n+1],b=e[n+2]-l[n+2];m*m+w*w+b*b<4e-8&&(l[n]=e[n],l[n+1]=e[n+1],l[n+2]=e[n+2])}}return{pos:e,balls:D,free:y,bounds:K,paw:C,ripples:H,frameN:te,step(o){const r=Math.min(o,.03333333333333333);for(let d=H.length-1;d>=0;d--)H[d].t+=r,H[d].t>2.4&&H.splice(d,1);Q&&(de+=r);for(const d of D)Ia(d,r);for(let d=0;d<xt;d++){if(Q&&d%2===0)for(const c of D)Da(c);Na(1/60/xt)}},writeFrames(o){const r=e;for(const d of D){const c=d.m;let n=te[d.start*3],i=te[d.start*3+1],m=te[d.start*3+2];for(let w=d.start,b=w+J;w<b;w++){const f=w*3,g=w*8;let k,x,R,I=0;if(y[w]){const M=Math.max(w-1,d.start)*3,S=Math.min(w+1,b-1)*3;let W=r[S]-r[M],le=r[S+1]-r[M+1],ee=r[S+2]-r[M+2];const X=Math.hypot(W,le,ee)||1;W/=X,le/=X,ee/=X;const Z=Math.hypot(r[f]-Ee[f],r[f+1]-Ee[f+1],r[f+2]-Ee[f+2]),V=Math.min(Z*3,.12);k=te[f]+(n-te[f])*V,x=te[f+1]+(i-te[f+1])*V,R=te[f+2]+(m-te[f+2])*V;const ae=k*W+x*le+R*ee;k-=W*ae,x-=le*ae,R-=ee*ae;const ge=Math.hypot(k,x,R);ge<1e-4?(k=ee,x=0,R=-W):(k/=ge,x/=ge,R/=ge),w<b-1&&(I=Math.min(Math.max((Math.hypot(r[f+3]-r[f],r[f+4]-r[f+1],r[f+5]-r[f+2])/p[w]-1)*18,0),1))}else{const M=P[f],S=P[f+1],W=P[f+2];k=c[0]*M+c[1]*S+c[2]*W,x=c[3]*M+c[4]*S+c[5]*W,R=c[6]*M+c[7]*S+c[8]*W}te[f]=n=k,te[f+1]=i=x,te[f+2]=m=R,Ee[f]=r[f],Ee[f+1]=r[f+1],Ee[f+2]=r[f+2],yt[w]+=(I-yt[w])*.2,o[g]=r[f],o[g+1]=r[f+1],o[g+2]=r[f+2],o[g+4]=k,o[g+5]=x,o[g+6]=R,o[g+7]=yt[w]}}},pick(o,r,d=.16){let c=-1,n=1/0;for(let i=0;i<_;i++){if(!y[i]||u[i])continue;const m=e[i*3]-o[0],w=e[i*3+1]-o[1],b=e[i*3+2]-o[2],f=m*r[0]+w*r[1]+b*r[2],g=Math.hypot(m-r[0]*f,w-r[1]*f,b-r[2]*f);if(g>d)continue;const k=f+g*8;k<n&&(n=k,c=i)}return c},ballAt(o,r){let d=null,c=1/0;for(const n of D){if(n.wound<30)continue;const i=n.x-o[0],m=n.y-o[1],w=n.z-o[2],b=i*r[0]+m*r[1]+w*r[2];b>0&&b<c&&Math.hypot(i-r[0]*b,m-r[1]*b,w-r[2]*b)<n.radius&&(d=n,c=b)}return d},grab(o){u[o]=1,re.set(o,{to:[e[o*3],e[o*3+1],e[o*3+2]]})},moveTo(o,r,d,c){const n=re.get(o);n&&(n.to[0]=r,n.to[1]=Math.max(d,ce),n.to[2]=c)},release(o,r=0,d=0,c=0){u[o]=0,re.delete(o);const n=1/60/xt;l[o*3]=e[o*3]-oe(r*n,Ie),l[o*3+1]=e[o*3+1]-oe(d*n,Ie),l[o*3+2]=e[o*3+2]-oe(c*n,Ie)},holdBall(o){o.held={x:o.x,z:o.z}},moveBallTo(o,r,d){o.held&&(o.held.x=r,o.held.z=d)},dropBall(o,r,d){o.held=null,r!==void 0&&(o.vx=oe(r,11),o.vz=oe(d,11))},setPaw(o,r){C.vx=C.on?oe((o-C.x)*.5,2):0,C.vz=C.on?oe((r-C.z)*.5,2):0,C.x=o,C.z=r,C.on=!0},liftPaw(){C.on=!1},snap(o,r){H.length>=4&&H.shift(),H.push({x:o,z:r,t:0,a:U.snap})},set winding(o){Q=o,o&&(de=0)},get winding(){return Q},get tears(){return Qe}}}const vo=21,go=150,Kt={x:3.7,z:3},ye=[{name:"Hearth",wool:["#c9472a","#ecdfc8","#d99a35"],cloth:"#123a42",night:"#040d10"},{name:"Marigold",at:3.7,from:[0,.6],wool:["#a92b22","#fff0d2","#155a60"],cloth:"#e8a51c",night:"#7a4a08"},{name:"Clay",at:8.1,from:[.3,.4],wool:["#1f7f83","#efe3cf","#e9b04f"],cloth:"#9c3d26",night:"#2a0c06"},{name:"Orchard",at:12.4,from:[0,.8],wool:["#d43c68","#f6c4b6","#efe3cf"],cloth:"#1f4a39",night:"#06120c"},{name:"Oatmeal",at:16.2,from:[0,-.5],wool:["#b8402b","#274a66","#d39a37"],cloth:"#d9c7a4",night:"#54452e"}],wo=.26,yo=a=>6*a+2*a**4,xo=2.4,bo=.42,De=(a,t)=>a*J+J-t,zo=[{i:De(0,375),on:.1,off:3.65,path:[[1.3,-1.1,1.9,.5],[2.5,-.5,3.3,.7],[3.65,.1,4.3,.6]],flick:!0},{i:De(2,375),on:1.2,off:3.65,path:[[2.4,.6,2,-.6],[3.65,1,3.5,.2]],flick:!0},{i:De(0,300),on:8.5,off:12.25,path:[[9.7,-1,2.2,.9],[11,-1.5,3.7,.5],[12.25,-.9,4.5,.1]],flick:!0},{i:De(1,300),on:8.7,off:12.25,path:[[9.8,1.1,2.4,.9],[11,1.6,3.5,.6],[12.25,1,4.7,.2]],flick:!0},{i:De(2,300),on:9,off:12.25,path:[[10,0,2.9,1.3],[11.2,-.2,4.5,1],[12.25,.1,5.2,.5]],flick:!0}],Mo=[{k:0,on:4.3,off:7.4,path:[[5.2,-2.6,1.3],[6.3,-1,2.5],[7.4,1.5,2.2]]},{k:1,on:4.6,off:7.7,path:[[5.5,2.9,.9],[6.6,2.4,-1.4],[7.7,.4,-2.2]]},{k:2,on:5.1,off:7.7,path:[[6.1,-1.6,-2.1],[7,-3,-1.2],[7.7,-3.2,.6]]}],Qt={on:13,speed:.55};function At(a,t,e=!1){const l=a.length-1;if(t<=a[0][0])return e?a[0].slice(1).map(()=>0):a[0].slice(1);if(t>=a[l][0])return e?a[0].slice(1).map(()=>0):a[l].slice(1);let h=0;for(;t>=a[h+1][0];)h++;const E=a[h],P=a[h+1],s=P[0]-E[0],y=(t-E[0])/s,u=y*y,p=u*y,L=(F,B)=>F===0||F===l?0:(a[F+1][B]-a[F-1][B])/(a[F+1][0]-a[F-1][0]);return E.slice(1).map((F,B)=>{const $=B+1,D=L(h,$)*s,K=L(h+1,$)*s;return e?((6*u-6*y)*E[$]+(3*u-4*y+1)*D+(6*y-6*u)*P[$]+(3*u-2*y)*K)/s:(2*p-3*u+1)*E[$]+(p-2*u+y)*D+(-2*p+3*u)*P[$]+(p-u)*K})}function ko(a,t){const e=zo.map(P=>({...P,state:0})),l=Mo.map(P=>({...P,state:0})),h=ye.slice(1).map(P=>({...P,done:!1}));let E=!1;return P=>{for(const s of e)if(s.state===0&&P>=s.on&&(a.grab(s.i),s.keys=[[s.on,a.pos[s.i*3],a.pos[s.i*3+1],a.pos[s.i*3+2]],...s.path],s.state=1),s.state===1)if(P>=s.off){const y=s.keys.length-1,u=s.keys[y-1],p=s.keys[y],L=1/(p[0]-u[0])*.6;a.release(s.i,...s.flick?[(p[1]-u[1])*L,(p[2]-u[2])*L,(p[3]-u[3])*L]:[0,0,0]),s.state=2}else a.moveTo(s.i,...At(s.keys,P));for(const s of l){const y=a.balls[s.k];if(s.state===0&&P>=s.on&&(a.holdBall(y),s.keys=[[s.on,y.x,y.z],...s.path],s.state=1),s.state===1)if(P>=s.off){const u=s.keys.length-1,p=s.keys[u-1],L=s.keys[u],F=1/(L[0]-p[0])*.8;a.dropBall(y,(L[1]-p[1])*F,(L[2]-p[2])*F),s.state=2}else a.moveBallTo(y,...At(s.keys,P))}for(const s of h)!s.done&&P>=s.at&&(s.done=!0,t.snap=wo,a.snap(s.from[0],s.from[1]));!E&&P>=Qt.on&&(E=!0,t.wind=Qt.speed,a.winding=!0)}}function Po(a){let t=0;for(;t+1<ye.length&&a>=ye[t+1].at;)t++;const e=t?a-ye[t].at:1/0;return e>=xo?{to:ye[t],from:ye[t],radius:0}:{to:ye[t],from:ye[t-1],at:ye[t].from,radius:yo(e)}}const To=[[0,-24,13,8.6,-.2,.75,.5,24],[2,-10,15,9.6,-.15,1.5,.4,24],[3.6,2,21,11.4,0,1.7,.2,24],[5.4,8,46,15.5,0,.3,.3,24],[7.8,-14,40,13.5,0,.3,.5,24],[9.4,-20,17,11.5,0,1.3,.5,24],[12.2,10,11,12.2,0,2.2,.4,24],[14.2,24,26,12.2,0,.9,.2,24],[17,2,30,12.6,0,.5,-.4,24],[20,-14,21,10.6,0,.55,-.7,24]],Eo=[[0,-24,12,8.8,-.3,1,.5,30],[2,-10,13,10.2,-.1,1.9,.4,30],[3.6,2,18,12.4,.2,2.2,.3,30],[5.4,8,52,18.5,0,.1,.3,30],[7.8,-14,46,17.5,0,.1,.5,30],[9.4,-20,15,13.5,0,1.9,.5,30],[12.2,10,9,14.5,0,2.7,.4,30],[14.2,24,30,16,0,1,.2,30],[17,2,36,17,0,.3,-.5,30],[20,-14,24,14.6,0,.5,-.8,30]],Zt=a=>a*Math.PI/180;function Ro(a,t){const[e,l,h,E,P,s,y]=At(t<1?Eo:To,a),u=Zt(e+Math.sin(a*.83)*.4),p=Zt(l+Math.sin(a*1.17+1)*.25);return{position:[E+h*Math.sin(u)*Math.cos(p),P+h*Math.sin(p),s+h*Math.cos(u)*Math.cos(p)],target:[E,P,s],fov:y}}const ma=ro+eo,va=no+to,xe=new URLSearchParams(location.search),Se=xe.has("capture"),Ue=Se?+xe.get("w"):innerWidth,Le=Se?+xe.get("h"):innerHeight;if(Se)for(const a of["#title","#hint","#bar","#controls"])document.querySelector(a).style.display="none";const St=document.querySelector("#message"),ne=document.querySelector("#view"),ft=document.querySelector("#hint"),Ao=a=>{throw St.textContent=a,new Error(a)},ga=await navigator.gpu?.requestAdapter();ga||Ao("This piece needs WebGPU. Try a recent version of Chrome or Edge, or Safari with WebGPU turned on.");const T=await ga.requestDevice(),wa=oo(T);T.addEventListener("uncapturederror",a=>console.error(a.error.message));const ya=ne.getContext("webgpu"),xa=navigator.gpu.getPreferredCanvasFormat();ya.configure({device:T,format:xa,alphaMode:"opaque"});for(const a of[ma,va]){const t=await T.createShaderModule({code:a}).getCompilationInfo();for(const e of t.messages)e.type==="error"&&console.error(`${e.lineNum}:${e.linePos} ${e.message}`)}const he=[{name:"Hearth",wool:["#c9472a","#ecdfc8","#d99a35"],cloth:"#123a42",night:"#040d10"},{name:"Fjord",wool:["#efe6d6","#7fa9c4","#df6b4c"],cloth:"#1b2638",night:"#05080e"},{name:"Orchard",wool:["#c23a5e","#f0b9ae","#e9dcc6"],cloth:"#2b4a3a",night:"#060e0a"},{name:"Heather",wool:["#d98c9a","#9fb48d","#efe5d4"],cloth:"#35203c",night:"#0a0610"},{name:"Clay",wool:["#1f7f83","#efe3cf","#e0a15a"],cloth:"#7c3524",night:"#130604"},{name:"Oatmeal",wool:["#b8402b","#274a66","#d39a37"],cloth:"#b9a78a",night:"#1c1711",light:!0}],v={plyTwist:40,fibreTwist:17,hairLength:1,thickness:1,lamp:1,pool:1.25,backLight:1,stitch:1,fibres:60,hairs:36e3,hdr:1,hdrFall:.65,hdrStrength:1,hdrTurn:200,hdrWarmth:.35},_e=a=>{const t=new Ja(a);return[t.r,t.g,t.b,1]},Gt=new Float32Array(_*8),ba=T.createBuffer({size:Gt.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),Re=10,$e=new Uint32Array((_-Ne)*Re*6);for(let a=0,t=0;a<_-1;a++)for(let e=0;e<Re;e++){if((a+1)%J===0)continue;const l=a*Re+e,h=a*Re+(e+1)%Re,E=l+Re,P=h+Re;$e.set([l,h,E,h,P,E],t),t+=6}const Ft=T.createBuffer({size:$e.byteLength,usage:GPUBufferUsage.INDEX|GPUBufferUsage.COPY_DST});T.queue.writeBuffer(Ft,0,$e);const q=new Float32Array(204),It=T.createBuffer({size:q.byteLength,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),Ut=2048,Lt=4,Pe="rgba16float",So=57600*6,Jt=1152*6,za=T.createTexture({size:[Ut,Ut],format:"depth32float",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),Ma=T.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),ka=T.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),Dt=T.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}]}),Go=T.createBindGroup({layout:Ma,entries:[{binding:0,resource:{buffer:It}},{binding:1,resource:za.createView()},{binding:2,resource:T.createSampler({compare:"less",magFilter:"linear",minFilter:"linear"})}]}),Fo=T.createBindGroup({layout:ka,entries:[{binding:0,resource:{buffer:It}}]}),ea=T.createBindGroup({layout:Dt,entries:[{binding:0,resource:{buffer:ba}}]}),Ct=T.createShaderModule({code:ma}),Uo=T.createPipelineLayout({bindGroupLayouts:[Ma,Dt]}),Ke=(a,t,e="triangle-list",l=!1)=>T.createRenderPipeline({layout:Uo,vertex:{module:Ct,entryPoint:a},fragment:{module:Ct,entryPoint:t,targets:[{format:Pe}]},primitive:{topology:e,cullMode:"none"},depthStencil:{format:"depth32float",depthWriteEnabled:!0,depthCompare:"less"},multisample:{count:Lt,alphaToCoverageEnabled:l}}),Lo=Ke("floorVs","floorFs"),Co=Ke("coreVs","coreFs"),Bo=Ke("tubeVs","tubeFs"),_o=Ke("fibreVs","fibreFs","triangle-strip"),qo=Ke("hairVs","fibreFs","triangle-strip",!0),Pa=a=>T.createRenderPipeline({layout:T.createPipelineLayout({bindGroupLayouts:[ka,Dt]}),vertex:{module:Ct,entryPoint:a},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth32float",depthWriteEnabled:!0,depthCompare:"less",depthBias:2,depthBiasSlopeScale:2}}),Oo=Pa("tubeShadowVs"),Io=Pa("coreShadowVs"),ta=T.createShaderModule({code:va}),Do=T.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),Ta=T.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),vt=(a,t,e)=>T.createRenderPipeline({layout:T.createPipelineLayout({bindGroupLayouts:[Ta]}),vertex:{module:ta,entryPoint:"quadVs"},fragment:{module:ta,entryPoint:a,targets:[e?{format:t,blend:e}:{format:t}]}}),Vo={color:{srcFactor:"one",dstFactor:"one"},alpha:{srcFactor:"one",dstFactor:"zero"}},No=vt("brightFs",Pe),Ho=vt("downFs",Pe),Wo=vt("upFs",Pe,Vo),jo=vt("finishFs",xa),Ea=T.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),qe=new Float32Array(4),zt=T.createTexture({size:[1,1],format:Pe,usage:GPUTextureUsage.TEXTURE_BINDING}),Mt=4;let Bt,_t,Ve,se=[],ht=[],Ra,ue=0,fe=0,He=Se?+(xe.get("ss")??2):Math.min(devicePixelRatio,1.5);const O=new ja(24,1,1,90);O.coordinateSystem=ha;const me={yaw:.1,pitch:.6,distance:15.5,sway:new Ot},lt=new be(0,.3,0),Aa=new be(-.48,.76,.44).normalize(),We=Aa.clone(),ke=new $a(-8,8,8,-8,1,34);ke.coordinateSystem=ha;ke.up.set(0,1,0);const Sa=new da;let ut=null;function Ae(){const a=ao(q,124,ut,{amount:v.hdr,falloff:v.hdrFall,strength:v.hdrStrength,turn:v.hdrTurn,warmth:v.hdrWarmth});We.copy(Aa).lerp(new be(...a),v.hdr).normalize(),ke.position.copy(We).multiplyScalar(17),ke.lookAt(0,0,0),ke.updateProjectionMatrix(),ke.updateMatrixWorld(),Sa.multiplyMatrices(ke.projectionMatrix,ke.matrixWorldInverse)}const aa=new da;let Ga=1;function Vt(){ue=Math.max(1,Math.floor(Ue*He)),fe=Math.max(1,Math.floor(Le*He)),ne.width=ue,ne.height=fe,Bt?.destroy(),_t?.destroy(),Ve?.destroy(),se.forEach(e=>e.destroy()),Bt=T.createTexture({size:[ue,fe],format:Pe,sampleCount:Lt,usage:GPUTextureUsage.RENDER_ATTACHMENT}),_t=T.createTexture({size:[ue,fe],format:"depth32float",sampleCount:Lt,usage:GPUTextureUsage.RENDER_ATTACHMENT}),Ve=T.createTexture({size:[ue,fe],format:Pe,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),se=Array.from({length:Mt},(e,l)=>T.createTexture({size:[Math.max(ue>>l+1,1),Math.max(fe>>l+1,1)],format:Pe,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}));const a=(e,l)=>{const h=T.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return T.queue.writeBuffer(h,0,new Float32Array([1/e,1/l,0,0])),h},t=(e,l,h)=>T.createBindGroup({layout:Ta,entries:[{binding:0,resource:e.createView()},{binding:1,resource:Do},{binding:2,resource:{buffer:l}},{binding:3,resource:h.createView()},{binding:4,resource:{buffer:wa.buffer}}]});ht=[{pipeline:No,group:t(Ve,a(ue,fe),zt),target:se[0],clear:!0}];for(let e=1;e<Mt;e++)ht.push({pipeline:Ho,group:t(se[e-1],a(se[e-1].width,se[e-1].height),zt),target:se[e],clear:!0});for(let e=Mt-1;e>0;e--)ht.push({pipeline:Wo,group:t(se[e],a(se[e].width,se[e].height),zt),target:se[e-1],clear:!1});Ra=t(Ve,Ea,se[0]),qe[0]=1/ue,qe[1]=1/fe,qe[2]=v.bloom??.05,O.aspect=ue/fe,O.updateProjectionMatrix(),Ga=Math.max(1,1/O.aspect),G&&(G.bounds.x=3.5*Math.max(O.aspect,1)-.9)}let G,pt=-1,gt;const Ce=(a,t,e)=>{a&&a.forEach((l,h)=>{l&&q.set(_e(l),40+h*4)}),t&&q.set(_e(t),52),e&&(q.set(_e(e),56),document.body.style.background=e)};function Fa(a){pt=a;const t=he[a];Ce(t.wool,t.cloth,t.night),document.body.classList.toggle("on-light",!!t.light),gt?.({"wool 1":t.wool[0],"wool 2":t.wool[1],"wool 3":t.wool[2],blanket:t.cloth,room:t.night})}function wt(a){const t=he.map((e,l)=>l).filter(e=>e!==pt);Fa(a?0:t[Math.floor(Math.random()*t.length)]),gt?.({colourway:he[pt].name});for(const[e]of ve)Ht(e);G=pa({seed:Math.floor(Math.random()*1e9),drop:a?0:.9}),G.bounds.x=3.5*Math.max(O.aspect,1)-.9;for(let e=0;e<12;e++)G.step(1/60)}const ve=new Map,oa=new Ka,na=new Ot,N=new be,qt=new be(0,1,0),Ua=new be,Te={at:0,glow:0,goal:0},$o=320,Xo=8,je=a=>(na.set(a.clientX/innerWidth*2-1,-(a.clientY/innerHeight)*2+1),oa.setFromCamera(na,O),oa.ray),dt=(a,t,e,l)=>{const h=t.clone().sub(a.origin).dot(e)/a.direction.dot(e);return h>0?l.copy(a.direction).multiplyScalar(h).add(a.origin):null},La=a=>{const{origin:t,direction:e}=je(a),l=[t.x,t.y,t.z],h=[e.x,e.y,e.z],E=G.pick(l,h);if(E>=0)return{thread:E};const P=G.ballAt(l,h);return P?{ball:P}:{}},mt=(a,t,e,l)=>{const h=performance.now();for(a.path.push([h,t,e,l]);a.path.length>2&&h-a.path[0][0]>90;)a.path.shift()},ra=a=>{const t=a.path[0],e=a.path[a.path.length-1],l=(e?.[0]-t?.[0])/1e3;return!(l>.008)||performance.now()-e[0]>70?[0,0,0]:[(e[1]-t[1])/l,(e[2]-t[2])/l,(e[3]-t[3])/l]},Ca=a=>{navigator.vibrate&&navigator.vibrate(a)},Nt=[["thread","Pull a thread out of the knot"],["ball","Throw a ball through it"],["snap","Tap the blanket to snap it"],["sweep","Drag across the blanket to sweep thread with your hand"],["wind","Hold to wind it all back up"]],kt=new Set;let ia=Nt[0][0];const Xe=a=>{if(kt.has(a))return;kt.add(a);const t=Nt.find(([e])=>!kt.has(e));t?.[0]!==ia&&(ia=t?.[0],ft.style.opacity=0,t&&setTimeout(()=>{ft.textContent=t[1],ft.style.opacity=1},450))};ft.textContent=Nt[0][1];ne.addEventListener("contextmenu",a=>a.preventDefault());ne.addEventListener("pointerdown",a=>{if(ne.setPointerCapture?.(a.pointerId),Te.goal=0,a.button===2){ve.set(a.pointerId,{kind:"orbit",from:[a.clientX,a.clientY]});return}const t=La(a),e={path:[],x0:a.clientX,y0:a.clientY,t0:performance.now(),moved:!1};ve.set(a.pointerId,e),t.thread!==void 0?(e.kind="thread",e.i=t.thread,G.grab(e.i),e.point=new be().fromArray(G.pos,e.i*3),e.normal=O.getWorldDirection(new be),mt(e,e.point.x,e.point.y,e.point.z),ne.style.cursor="grabbing",Xe("thread")):t.ball?(e.kind="ball",e.ball=t.ball,G.holdBall(e.ball),mt(e,e.ball.x,0,e.ball.z),ne.style.cursor="grabbing",Xe("ball")):(e.kind="blanket",dt(je(a),Ua,qt,N)&&(e.x=N.x,e.z=N.z,G.setPaw(N.x,N.z)))});addEventListener("pointermove",a=>{a.pointerType==="mouse"&&me.sway.set(a.clientX/innerWidth-.5,a.clientY/innerHeight-.5);const t=ve.get(a.pointerId);if(!t){if(a.target!==ne||ve.size)return;const e=La(a);ne.style.cursor=e.thread!==void 0||e.ball?"grab":"",e.thread!==void 0&&(Te.at=e.thread),Te.goal=e.thread!==void 0?1:0;return}t.kind==="orbit"?(me.yaw-=(a.clientX-t.from[0])*.005,me.pitch=Math.max(.14,Math.min(1.25,me.pitch+(a.clientY-t.from[1])*.004)),t.from=[a.clientX,a.clientY]):t.kind==="thread"?dt(je(a),t.point,t.normal,N)&&(G.moveTo(t.i,N.x,N.y,N.z),mt(t,N.x,N.y,N.z)):t.kind==="ball"?dt(je(a),new be(0,t.ball.y*.5,0),qt,N)&&(G.moveBallTo(t.ball,N.x,N.z),mt(t,N.x,0,N.z)):t.kind==="blanket"&&(Math.hypot(a.clientX-t.x0,a.clientY-t.y0)>Xo&&(t.moved=!0),t.moved&&dt(je(a),Ua,qt,N)&&(G.setPaw(N.x,N.z),Xe("sweep")))});function Ht(a){const t=ve.get(a);if(t){if(ve.delete(a),t.kind==="thread"){const[e,l,h]=ra(t);G.release(t.i,e,l,h)}else if(t.kind==="ball"){const[e,,l]=ra(t);G.dropBall(t.ball,e,l)}else t.kind==="blanket"&&(G.liftPaw(),!t.moved&&performance.now()-t.t0<$o&&t.x!==void 0&&(G.snap(t.x,t.z),Ca(25),Xe("snap")));ve.size||(ne.style.cursor="")}}const Ba=a=>Ht(a.pointerId);addEventListener("pointerup",Ba);addEventListener("pointercancel",Ba);addEventListener("blur",()=>{for(const[a]of ve)Ht(a)});ne.addEventListener("wheel",a=>{a.preventDefault(),me.distance=Math.max(3.4,Math.min(24,me.distance*Math.exp(a.deltaY*.001)))},{passive:!1});const _a=document.querySelector("#wind");let Ye=null;const Oe=a=>{G.winding=a,_a.setAttribute("aria-pressed",a),a&&Xe("wind")};_a.addEventListener("pointerdown",a=>{Ye=a.pointerId,Oe(!0)});addEventListener("pointerup",a=>{a.pointerId===Ye&&(Ye=null,Oe(!1))});addEventListener("pointercancel",a=>{a.pointerId===Ye&&(Ye=null,Oe(!1))});addEventListener("blur",()=>Oe(!1));addEventListener("keydown",a=>{a.target.tagName!=="INPUT"&&(a.code==="Space"&&!a.repeat&&(a.preventDefault(),Oe(!0)),a.code==="KeyR"&&!a.repeat&&wt(!1))});addEventListener("keyup",a=>{a.code==="Space"&&Oe(!1)});Ae();wt(!0);Vt();Se||addEventListener("resize",Vt);document.querySelector("#random").addEventListener("click",()=>wt(!1));const Yo=Wa(xe,a=>{ut=a,Ae()});function Ko(){const[,a]=Qa(()=>({Studio:Yo,Light:nt({"hdr light":{value:v.hdr,min:0,max:1,step:.01,onChange:t=>{v.hdr=t,Ae()}},"hdr strength":{value:v.hdrStrength,min:.2,max:2.5,step:.01,onChange:t=>{v.hdrStrength=t,Ae()}},"hdr turn":{value:v.hdrTurn,min:0,max:360,step:1,onChange:t=>{v.hdrTurn=t,Ae()}},"hdr warmth":{value:v.hdrWarmth,min:-1,max:2,step:.01,onChange:t=>{v.hdrWarmth=t,Ae()}},"room falloff":{value:v.hdrFall,min:0,max:1,step:.01,onChange:t=>{v.hdrFall=t,Ae()}}}),colourway:{options:he.map(t=>t.name),value:he[0].name,onChange:(t,e,l)=>{if(!l.initial){const h=he.findIndex(E=>E.name===t);h!==pt&&Fa(h)}}},Wool:nt({"wool 1":{value:he[0].wool[0],onChange:t=>Ce([t])},"wool 2":{value:he[0].wool[1],onChange:t=>Ce([null,t])},"wool 3":{value:he[0].wool[2],onChange:t=>Ce([null,null,t])},thickness:{value:v.thickness,min:.7,max:1.3,step:.01,onChange:t=>{v.thickness=t}},"ply twist":{value:v.plyTwist,min:0,max:80,step:.5,onChange:t=>{v.plyTwist=t}},"fibre twist":{value:v.fibreTwist,min:0,max:30,step:.5,onChange:t=>{v.fibreTwist=t}},fibres:{value:v.fibres,min:16,max:110,step:1,onChange:t=>{v.fibres=t}},hairs:{value:v.hairs,min:0,max:6e4,step:500,onChange:t=>{v.hairs=t}},"hair length":{value:v.hairLength,min:0,max:2.5,step:.01,onChange:t=>{v.hairLength=t}}}),Feel:nt({"peel strength":{value:U.peel,min:.2,max:5,step:.05,onChange:t=>{U.peel=t}},snags:{value:U.snags,min:0,max:4,step:.05,onChange:t=>{U.snags=t}},"ball rolls":{value:U.roll,min:0,max:3,step:.05,onChange:t=>{U.roll=t}},gravity:{value:-U.gravity,min:1,max:15,step:.1,onChange:t=>{U.gravity=-t}},"wool grip":{value:U.woolGrip,min:0,max:.4,step:.005,onChange:t=>{U.woolGrip=t}},"blanket grip":{value:U.blanketGrip,min:.05,max:.95,step:.01,onChange:t=>{U.blanketGrip=t}},"snap height":{value:U.snap,min:.05,max:.6,step:.01,onChange:t=>{U.snap=t}},"wind speed":{value:U.wind,min:.2,max:3,step:.05,onChange:t=>{U.wind=t}}}),Room:nt({blanket:{value:he[0].cloth,onChange:t=>Ce(null,t)},room:{value:he[0].night,onChange:t=>Ce(null,null,t)},"stitch size":{value:v.stitch,min:.5,max:2.5,step:.01,onChange:t=>{v.stitch=t}},lamp:{value:v.lamp,min:.2,max:2,step:.01,onChange:t=>{v.lamp=t}},"light pool":{value:v.pool,min:.4,max:2.5,step:.01,onChange:t=>{v.pool=t}},"back light":{value:v.backLight,min:0,max:2.5,step:.01,onChange:t=>{v.backLight=t}},glow:{value:.05,min:0,max:.4,step:.005,onChange:t=>{v.bloom=t,qe[2]=t}}},{collapsed:!0}),"new tangle":Za(()=>wt(!1)),...wa.controls()}));return gt=a,null}Se||Xa.createRoot(document.querySelector("#controls")).render(ot.createElement(ot.Fragment,null,ot.createElement(Ya,{collapsed:!0,titleBar:{title:"Controls"}}),ot.createElement(Ko)));let Pt=0,Tt=performance.now(),st=0,la=performance.now(),ct=0,sa=0,ca=0;const fa=((J-1)*2+1)*2,Et=new Ot;function qa(a){const t=(a-la)/1e3;for(ct=Math.min(ct+t,3/60),la=a;ct>=1/60;)G.step(1/60),ct-=1/60;G.tears>sa&&(ve.size&&a-ca>70&&(Ca(6),ca=a),sa=G.tears),Te.glow+=(Te.goal-Te.glow)*Math.min(t*10,1),Et.lerp(me.sway,.04);const e=me.distance*Ga,l=me.yaw+Et.x*.16,h=Math.max(.12,me.pitch+Et.y*.06);if(O.position.set(lt.x+Math.sin(l)*Math.cos(h)*e,lt.y+Math.sin(h)*e,lt.z+Math.cos(l)*Math.cos(h)*e),O.lookAt(lt),Oa(a/1e3),Pt++,a-Tt>1e3){const E=Pt*1e3/(a-Tt);Pt=0,Tt=a,st=E<40&&!document.hidden&&a>5e3?st+1:0,st>=3&&(st=0,v.fibres>40?(v.fibres=40,v.hairs=Math.min(v.hairs,12e3),gt?.({fibres:v.fibres,hairs:v.hairs})):He>.75&&(He=Math.max(He*.85,.75),Vt()))}requestAnimationFrame(qa)}function Oa(a){G.writeFrames(Gt),T.queue.writeBuffer(ba,0,Gt),O.updateMatrixWorld(),aa.multiplyMatrices(O.projectionMatrix,O.matrixWorldInverse),q.set(aa.elements,0),q.set(Sa.elements,16),q.set([O.position.x,O.position.y,O.position.z,a],32),q.set([We.x,We.y,We.z,Ut/(ut?Math.sqrt(ut.soft/4):1)],36),q.set([ue,fe,2*Math.tan(O.fov*Math.PI/360)/fe,0],60);const{balls:t,paw:e,ripples:l}=G;t.forEach((u,p)=>{q.set([u.x,u.y,u.z,u.wound>30?u.radius:0],64+p*4),q[76+p]=u.core,q.set(u.q,112+p*4)}),q.set([e.x,0,e.z,e.on?1:0],80),q.set([v.plyTwist,v.fibreTwist,v.hairLength,v.thickness],84),q.set([v.lamp,v.pool,v.backLight,v.stitch],88),q.set([Te.at,Te.glow,l.length,0],92);for(let u=0;u<4;u++){const p=l[u];q.set(p?[p.x,p.z,p.t,p.a]:[0,0,0,0],96+u*4)}T.queue.writeBuffer(It,0,q);const h=T.createCommandEncoder(),E=h.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:za.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});E.setBindGroup(0,Fo),E.setBindGroup(1,ea),E.setPipeline(Oo),E.setIndexBuffer(Ft,"uint32"),E.drawIndexed($e.length),E.setPipeline(Io),E.draw(Jt,Ne),E.end();const P=q.subarray(56,59),s=h.beginRenderPass({colorAttachments:[{view:Bt.createView(),resolveTarget:Ve.createView(),clearValue:[P[0],P[1],P[2],1],loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:_t.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"discard"}});s.setBindGroup(0,Go),s.setBindGroup(1,ea),s.setPipeline(Lo),s.draw(So),s.setPipeline(Co),s.draw(Jt,Ne),s.setPipeline(Bo),s.setIndexBuffer(Ft,"uint32"),s.drawIndexed($e.length),s.setPipeline(_o);for(let u=0;u<Ne;u++)s.draw(fa,v.fibres,u*fa);v.hairs&&(s.setPipeline(qo),s.draw(16,v.hairs)),s.end();for(const u of ht){const p=h.beginRenderPass({colorAttachments:[{view:u.target.createView(),clearValue:[0,0,0,1],loadOp:u.clear?"clear":"load",storeOp:"store"}]});p.setPipeline(u.pipeline),p.setBindGroup(0,u.group),p.draw(3),p.end()}qe[3]=a,T.queue.writeBuffer(Ea,0,qe);const y=h.beginRenderPass({colorAttachments:[{view:ya.getCurrentTexture().createView(),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]});y.setPipeline(jo),y.setBindGroup(0,Ra),y.draw(3),y.end(),T.queue.submit([h.finish()])}if(!Se)St.remove(),requestAnimationFrame(qa);else{St.remove(),ne.style.cssText=`position:fixed;left:0;top:0;width:${Ue}px;height:${Le}px`;const a=+xe.get("fps"),t=+xe.get("frames"),e=+(xe.get("every")??1),l=xe.get("port");v.fibres=70,v.hairs=42e3,O.near=.3,G=pa({seed:vo}),G.bounds.x=Kt.x,G.bounds.z=Kt.z;for(let p=0;p<go;p++)G.step(1/60);const h=ko(G,U),E=(p,L)=>{L.wool.forEach((F,B)=>q.set(_e(F),p+B*4)),q.set(_e(L.cloth),p+12),q.set(_e(L.night),p+16)},P=document.createElement("canvas");P.width=Ue,P.height=Le;const s=P.getContext("2d");s.imageSmoothingQuality="high";let y=0;window.__frame=async p=>{for(;y<=p;)h(y/a),G.step(1/a),y++;const L=(p+1)/a,F=Ro(L,Ue/Le),B=Po(L);return O.fov=F.fov,O.aspect=Ue/Le,O.position.set(...F.position),O.lookAt(...F.target),O.updateProjectionMatrix(),E(40,B.to),E(184,B.from),q.set(B.radius?[B.at[0],B.at[1],B.radius,bo]:[0,0,0,0],180),Oa(L),s.drawImage(ne,0,0,Ue,Le),new Promise($=>P.toBlob($,"image/png"))},window.__ready=!0;const u=p=>l&&fetch(`http://localhost:${l}/log?m=${encodeURIComponent(p)}`).catch(()=>{});if(addEventListener("error",p=>u(`error ${p.message}`)),addEventListener("unhandledrejection",p=>u(`rejection ${p.reason}`)),T.addEventListener("uncapturederror",p=>u(`gpu ${p.error.message}`)),T.lost.then(p=>u(`DEVICE LOST ${p.reason} ${p.message}`)),l){for(let p=0;p<t;p++){const L=await window.__frame(p);if(p%e)continue;const F=await L.arrayBuffer();for(let B=0;;B++)try{await fetch(`http://localhost:${l}/frame?i=${p/e}`,{method:"POST",headers:{"content-type":"text/plain"},body:F});break}catch($){if(B>20)throw $;await new Promise(D=>setTimeout(D,100+B*100))}}await fetch(`http://localhost:${l}/done`)}}
