import"./modulepreload-polyfill-ulV_1b7r.js";import{y as Eo}from"./studio-presets-CDYyrMX7.js";import"./three-C2t3z6N3.js";import{X as Do}from"./OrbitControls-VozILqJD.js";import{u as _o,aG as Jt,B as Kt,X as Co,f as vt,P as Fo,O as Be,a as Io,e as Lo,L as No}from"./leva-C0l7872o.js";import{q as Vo,y as Yo,_ as jo}from"./studio-light-BWXy2tng.js";import{u as Wo,i as $o}from"./look-DcDmlVv9.js";const eo=`// Every frame: rest shape + how melted it is + every nearby bead of liquid = where each vertex is now.
struct Rest { p: vec3f, part: f32, n: vec3f, detail: f32 }
struct Bead { p: vec3f, r: f32, dir: vec3f, stretch: f32, color: vec3f, height: f32, hang: f32, a: f32, b: f32, c: f32 }
struct Pool { xz: vec2f, r: f32, h: f32, color: vec3f, ripple: f32 }
struct Scoop { c: vec3f, r: f32, scale: vec3f, melt: f32 }
struct Stain { a: vec4f, b: vec4f } // a: colour, wetness. b.x: height of the liquid film left behind.
struct Params { scoops: array<Scoop, 3>, _a: vec4f, partStart: array<vec4u, 5>, time: f32, floorSize: f32, clear: f32, _b: f32, flavor0: vec4f }
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> rest: array<Rest>;
@group(0) @binding(2) var<storage, read> beads: array<Bead>;
@group(0) @binding(3) var<storage, read> pools: array<Pool>;
@group(0) @binding(4) var<storage, read_write> posOut: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> nrmOut: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> colOut: array<vec4f>;
@group(1) @binding(0) var<storage, read> colNow: array<vec4f>;
@group(1) @binding(1) var<storage, read> stainOld: array<Stain>;
@group(1) @binding(2) var<storage, read_write> stainNew: array<Stain>;
const DOWN = vec3f(0.0, -1.0, 0.0);
const TIP_Y = 0.5;
const RIM_Y = 2.75;
const RIM_R = 0.8;

fn ellipsoid(p: vec3f, s: Scoop) -> f32 {
  let a = s.scale * s.r;
  let q = p - s.c;
  let k0 = length(q / a);
  let k1 = length(q / (a * a));
  return k0 * (k0 - 1.0) / max(k1, 1e-4);
}
// Distance to a scoop as it really stands: wider than its ellipsoid once it has spread, by the same amounts as in deform().
fn slumpedGap(p: vec3f, s: Scoop, part: u32) -> f32 {
  let q = (p - s.c) / (s.scale * s.r);
  let y = q.y / max(length(q), 1e-4);
  let a = atan2(q.x, q.z);
  let spread = (1.0 + 0.1 * s.melt * smoothstep(0.25, -0.55, y)) * (1.0 + 0.07 * s.melt * sin(a * 2.0 + f32(part) * 1.7));
  return ellipsoid(s.c + (p - s.c) / vec3f(spread, 1.0, spread), s);
}
fn softMax(a: f32, b: f32) -> f32 {
  // Overlapping liquid joins smoothly, and never adds up to a spike.
  let m = max(0.28 * max(a, b), 1e-5);
  let g = max(m - abs(a - b), 0.0) / m;
  return max(a, b) + g * g * m * 0.25;
}

@compute @workgroup_size(128)
fn deform(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&rest)) { return; }
  let v = rest[i];
  let part = u32(v.part);
  if (part == 4u) {
    // The floor: a smooth union of flattened pools, with a ring running out of any fresh landing.
    var h = 0.0;
    var col = vec3f(0.0);
    var tot = 0.0;
    for (var k = 0u; k < arrayLength(&pools); k++) {
      let q = pools[k];
      if (q.r <= 0.0) { continue; }
      let off = v.p.xz - q.xz;
      // Never a perfect circle: a thick liquid spreads in soft lobes.
      let a = atan2(off.y, off.x);
      let lobes = 1.0 + 0.13 * sin(a * 3.0 + q.xz.x * 19.0) + 0.08 * sin(a * 5.0 - q.xz.y * 23.0) + 0.04 * sin(a * 9.0 + q.xz.x * 31.0);
      let d = length(off) / (q.r * lobes);
      if (d >= 1.25) { continue; }
      // Domed in the middle and steep at the edge, as a thick liquid sits.
      let s = pow(max(1.0 - d * d, 0.0), 0.5);
      let w = q.h * s * (0.7 + 0.3 * smoothstep(1.0, 0.45, d));
      let ring = sin(d * 18.0 - params.time * 7.0) * exp(-abs(d - 0.5) * 5.0) * q.ripple * 0.003 * s;
      let t = max(1.0 - d * 0.82, 0.0);
      let blend = max(0.5 * max(h, w), 1e-5);
      let g = max(blend - abs(h - w), 0.0) / blend;
      h = max(h, w) + g * g * blend * 0.25 + ring;
      col += q.color * t * t;
      tot += t * t;
    }
    posOut[i] = vec4f(v.p.x, h, v.p.z, h);
    colOut[i] = vec4f(col / max(tot, 1e-4), 1.0);
    return;
  }
  var base = v.p;
  var normal = v.n;
  var soft = 0.0;
  var drape = 0.0;
  var settle = 0.0;
  if (part < 3u) {
    let s = params.scoops[part];
    // Melt runs off the top and collects low down: the crown stays textured while the skirt goes smooth and glossy first.
    let lift = v.p.y * 0.5 + 0.5;
    soft = smoothstep(0.0, 1.0, s.melt * 2.1 - lift * 0.75);
    settle = smoothstep(0.1, 0.85, s.melt);
    // The weight settles low. The dome stays round: melting cream sags, it doesn't flatten into a disc.
    let a = atan2(v.p.x, v.p.z);
    let spread = (1.0 + 0.1 * s.melt * smoothstep(0.25, -0.55, v.p.y)) * (1.0 + 0.07 * s.melt * sin(a * 2.0 + f32(part) * 1.7));
    let slumped = v.p * vec3f(spread, 1.0, spread);
    base = s.c + slumped * s.scale * s.r;
    normal = normalize(slumped / s.scale);
    // The skirt slides down in uneven scallops. Melt runs from these, so they match the places in melt.js.
    let wave = sin(a * 5.0 + f32(part) * 2.1) * sin(a * 3.0 + f32(part) * 4.3 + 1.0);
    let lobe = pow(0.5 + 0.5 * wave, 1.5);
    // It fades out only below the cut edge (render.wgsl, y = -0.68). Any higher and the last rows pull back up and fold over.
    let band = smoothstep(0.12, -0.42, v.p.y) * smoothstep(-0.96, -0.74, v.p.y);
    drape = settle * (0.05 + 0.36 * lobe) * s.r * band;
  }
  var h = 0.0;
  var hang = 0.0;
  var col = vec3f(0.0);
  var tot = 0.0;
  let origin = base;
  for (var k = 0u; k < arrayLength(&beads); k++) {
    let b = beads[k];
    if (b.r <= 0.0) { continue; }
    let q = origin - b.p;
    let far = dot(q, q);
    let reach = b.r * b.stretch * 1.8;
    if (far > reach * reach) { continue; }
    // A real run: a full, blunt head that narrows behind it into its own trail.
    let along = dot(q, b.dir);
    let tail = clamp(-along / (b.r * b.stretch * 1.5), 0.0, 1.0);
    let side = (far - along * along) * (1.0 + tail * tail * 4.5);
    let longways = along / select(b.stretch * 1.5, 1.02, along > 0.0);
    let d = (side + longways * longways) / (b.r * b.r);
    if (d >= 1.0) { continue; }
    let t = 1.0 - d;
    let w = t * t * (3.0 - 2.0 * t);
    let bump = b.height * w;
    h = softMax(h, bump);
    hang = max(hang, b.hang * w * b.r);
    col += b.color * w;
    tot += w;
  }
  // The film runs left behind them, read from last frame. It's what joins a head back to where it came from.
  let left = stainOld[i];
  if (left.b.x > 0.0) {
    h = softMax(h, left.b.x);
    let w = left.b.x * 60.0;
    col += left.a.xyz * w;
    tot += w;
  }
  if (part == 3u) {
    // A cone's tip has nothing to hold a thick layer: the film thins to nothing at the point. Drops hang from it instead.
    h = min(h, length(v.p.xz) * 0.42 + 0.002);
    hang = 0.0;
  }
  let wet = smoothstep(0.0008, 0.03, h);
  // The torn detail relaxes as it softens, and everywhere liquid sits on it.
  let keep = 1.0 - max(soft * 0.76, wet * 0.8);
  let under = smoothstep(0.1, 0.7, dot(normal, DOWN));
  var moved = origin + normal * (v.detail * keep + h) + DOWN * (drape + min(hang * under * 1.6, 0.035));
  if (part < 3u) {
    // The crease between two scoops fills in as they melt, so they become one soft mass.
    // Only the upper scoop swells into it: if the lower one did too, it would burst up through the skirt lying on it.
    if (part > 0u) {
      let fillFrom = max(ellipsoid(moved, params.scoops[part - 1u]), 0.0);
      moved += normal * settle * 0.12 * smoothstep(0.34, 0.0, fillFrom);
    }
    // Melting cream can't pass through what's under it: it pours over it, so the skirt lies on the scoop or cone below.
    // Full strength on every visible row, so the edge lies on top instead of diving through.
    let lying = smoothstep(-0.92, -0.74, v.p.y);
    let lift = 0.03 + 0.012 * settle;
    if (part > 0u) {
      let low = params.scoops[part - 1u];
      let d = slumpedGap(moved, low, part - 1u);
      if (d < lift) { moved += normalize((moved - low.c) / (low.scale * low.scale)) * (lift - d) * lying; }
    } else if (moved.y < RIM_Y + 0.12) {
      let q = max(length(moved.xz), 1e-4);
      let slant = RIM_Y - TIP_Y;
      let d = (q * slant - (moved.y - TIP_Y) * RIM_R) / 2.388;
      if (d < lift) { moved += normalize(vec3f(moved.x / q * slant, -RIM_R, moved.z / q * slant)) * (lift - d) * lying; }
    }
  }
  posOut[i] = vec4f(moved, max(wet, soft));
  colOut[i] = vec4f(col / max(tot, 1e-4), h);
}
// Normals from the moved grid. Done after every vertex has moved, so they always match the shape.
@compute @workgroup_size(128)
fn normals(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&rest)) { return; }
  let part = u32(rest[i].part);
  let info = params.partStart[part];
  let local = i - info.x;
  let rows = info.y;
  let cols = info.z;
  let row = local / cols;
  let col = local % cols;
  let wraps = info.w == 1u;
  let left = select(max(col, 1u) - 1u, (col + cols - 1u) % cols, wraps);
  let right = select(min(col + 1u, cols - 1u), (col + 1u) % cols, wraps);
  let up = max(row, 1u) - 1u;
  let down = min(row + 1u, rows - 1u);
  let du = posOut[info.x + row * cols + right].xyz - posOut[info.x + row * cols + left].xyz;
  let dv = posOut[info.x + down * cols + col].xyz - posOut[info.x + up * cols + col].xyz;
  var n = cross(du, dv);
  let l = length(n);
  // The pole of a scoop has no neighbours to speak of, so it keeps its rest direction.
  if (l < 1e-7) { n = rest[i].n; } else { n = n / l; }
  if (dot(n, rest[i].n) < -0.1 && part != 4u) { n = -n; }
  if (part == 4u && n.y < 0.0) { n = -n; }
  nrmOut[i] = vec4f(n, rest[i].detail);
}

// What liquid leaves behind. Everywhere a run has been stays stained, wet and very slightly raised; waffle also drinks it in
// sideways through its pores (capillary wicking), slowly, with the wet front fading out, while cream only keeps a narrow film.
@compute @workgroup_size(128)
fn stain(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= arrayLength(&rest)) { return; }
  let part = u32(rest[i].part);
  if (part == 4u || params.clear > 0.5) { stainNew[i] = Stain(vec4f(0.0), vec4f(0.0)); return; }
  let info = params.partStart[part];
  let local = i - info.x;
  let rows = info.y;
  let cols = info.z;
  let row = local / cols;
  let col = local % cols;
  let at = info.x + row * cols;
  let a = stainOld[at + (col + 1u) % cols];
  let b = stainOld[at + (col + cols - 1u) % cols];
  let c = stainOld[info.x + (max(row, 1u) - 1u) * cols + col];
  let d = stainOld[info.x + min(row + 1u, rows - 1u) * cols + col];
  let me = stainOld[i];
  let isCone = part == 3u;
  let around = (a.a.w + b.a.w + c.a.w + d.a.w) * 0.25;
  // Gravity helps it down the cone: the row above feeds this one more than the row below.
  let reach = select(around * 0.72, (a.a.w + b.a.w + d.a.w * 2.0) * 0.25 * 0.93, isCone);
  let rate = select(0.03, 0.028, isCone);
  var amount = max(me.a.w, mix(me.a.w, reach, rate)) * (1.0 - 0.00004);
  let now = colNow[i];
  let touching = smoothstep(0.0005, 0.012, now.w);
  amount = max(amount, touching);
  // Cream melting on the cone's rim soaks in from above, as soon as the bottom scoop starts to go.
  if (isCone) {
    let y = rest[i].p.y;
    let rim = smoothstep(2.5, 2.75, y) * smoothstep(0.08, 0.45, params.scoops[0].melt) * (0.55 + 0.45 * sin(rest[i].p.x * 7.0 + rest[i].p.z * 5.0));
    amount = max(amount, rim);
  }
  // Colour comes from whatever is wettest nearby, or from the liquid here now.
  let weight = a.a.w + b.a.w + c.a.w + d.a.w + me.a.w * 2.0 + 1e-3;
  var tint = (a.a.xyz * a.a.w + b.a.xyz * b.a.w + c.a.xyz * c.a.w + d.a.xyz * d.a.w + me.a.xyz * me.a.w * 2.0) / weight;
  if (isCone && amount > 0.0 && weight <= 2e-3) { tint = params.flavor0.xyz; }
  tint = mix(tint, now.xyz, touching * 0.12);
  // The film: a run leaves some of its height behind. It evens out with its neighbours and very slowly drains away.
  let share = select(0.34, 0.13, isCone);
  let level = (a.b.x + b.b.x + c.b.x + d.b.x) * 0.25;
  var film = max(mix(me.b.x, level, 0.12) * 0.99982, now.w * share);
  if (film < 0.0005) { film = 0.0; }
  stainNew[i] = Stain(vec4f(tint, amount), vec4f(film, 0.0, 0.0, 0.0));
}
`,Xo=`diagnostic(off, derivative_uniformity);
struct Scoop { c: vec3f, r: f32, scale: vec3f, melt: f32 }
struct Frame {
  viewProj: mat4x4f, lightProj: mat4x4f, invViewProj: mat4x4f,
  eye: vec3f, time: f32,
  light: vec3f, shadowSize: f32,
  scoops: array<Scoop, 3>,
  flavors: array<vec4f, 3>,
  sky: vec4f, ground: vec4f,
  size: vec2f, _p: vec2f,
  _q: vec3f, syrup: f32,
  cone: array<vec4f, 4>, // the batter: base, iron lines, where it caught, palest squares
  env: vec4f, // how much of the HDR's light to use, unused, its turn as cos, sin
  sh: array<vec4f, 9>, // its soft light from every direction
  envDir: array<vec4f, 2>, // its two brightest lights
  envCol: array<vec4f, 2>,
}
struct Rest { p: vec3f, part: f32, n: vec3f, detail: f32 }
struct Drop { p: vec3f, r: f32, tall: f32, r2: f32, g2: f32, b2: f32, taper: f32, _a: f32, _b: f32, _c: f32 }
struct Stain { a: vec4f, b: vec4f }
@group(0) @binding(0) var<uniform> frame: Frame;
@group(0) @binding(1) var shadowMap: texture_depth_2d;
@group(0) @binding(2) var shadowCmp: sampler_comparison;
@group(1) @binding(0) var<storage, read> rest: array<Rest>;
@group(1) @binding(1) var<storage, read> pos: array<vec4f>;
@group(1) @binding(2) var<storage, read> nrm: array<vec4f>;
@group(1) @binding(3) var<storage, read> col: array<vec4f>;
@group(1) @binding(4) var<storage, read> drops: array<Drop>;
@group(1) @binding(5) var<storage, read> stains: array<Stain>;

// ---- noise
fn hash3(p: vec3f) -> f32 {
  var q = fract(p * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}
fn noise3(p: vec3f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3f(1, 0, 0)), u.x), mix(hash3(i + vec3f(0, 1, 0)), hash3(i + vec3f(1, 1, 0)), u.x), u.y),
    mix(mix(hash3(i + vec3f(0, 0, 1)), hash3(i + vec3f(1, 0, 1)), u.x), mix(hash3(i + vec3f(0, 1, 1)), hash3(i + vec3f(1, 1, 1)), u.x), u.y), u.z);
}
fn fbm2(p: vec3f) -> f32 { return noise3(p) * 0.65 + noise3(p * 2.17 + 3.1) * 0.35; }

// ---- light
fn shadowAt(world: vec3f, n: vec3f, spread: f32) -> f32 {
  let shifted = world + n * 0.025 + frame.light * 0.012;
  let c = frame.lightProj * vec4f(shifted, 1.0);
  let uv = vec2f(c.x * 0.5 + 0.5, 0.5 - c.y * 0.5);
  return pcss(uv, c.z, spread, frame.shadowSize, 12);
}
fn ellipsoid(p: vec3f, s: Scoop) -> f32 {
  let a = s.scale * s.r;
  let q = p - s.c;
  let k0 = length(q / a);
  let k1 = length(q / (a * a));
  return k0 * (k0 - 1.0) / max(k1, 1e-4);
}
fn coneDistance(p: vec3f) -> f32 {
  let q = length(p.xz);
  let h = 2.25;
  let r = 0.8;
  let side = (q * h - (p.y - 0.5) * r) / 2.388;
  return max(max(side, 0.5 - p.y), p.y - 2.8);
}
fn bodyDistance(p: vec3f) -> f32 {
  var d = coneDistance(p);
  for (var i = 0; i < 3; i++) { d = min(d, ellipsoid(p, frame.scoops[i])); }
  return d;
}
// The studio seen in gloss: a big soft window, a long strip, and dim walls for contrast.
fn studio(r: vec3f, sharp: f32) -> vec3f {
  let window = smoothstep(mix(0.6, 0.86, sharp), mix(0.96, 0.92, sharp), dot(r, normalize(vec3f(-0.52, 0.68, 0.52))));
  let bar = smoothstep(mix(0.82, 0.965, sharp), 1.0, dot(normalize(vec3f(r.x, r.y * 0.16, r.z)), normalize(vec3f(0.86, 0.0, 0.5))));
  let room = mix(frame.ground.rgb * 0.5, frame.sky.rgb * 0.8, r.y * 0.5 + 0.5);
  return room + vec3f(1.0, 0.97, 0.91) * (window * 3.4 + bar * 0.9);
}
fn ggx(n: vec3f, h: vec3f, rough: f32) -> f32 {
  let a = rough * rough;
  let d = max(dot(n, h), 0.0);
  let k = d * d * (a * a - 1.0) + 1.0;
  return a * a / (3.14159 * k * k);
}
// ---- the body
struct BodyOut {
  @builtin(position) clip: vec4f,
  @location(0) world: vec3f,
  @location(1) n: vec3f,
  @location(2) rest: vec3f,
  @location(3) wet: f32,
  @location(4) drip: vec4f,
  @location(5) @interpolate(flat) part: u32,
  @location(6) detail: f32,
  @location(7) stain: vec4f,
}
fn bodyVertex(i: u32) -> BodyOut {
  let r = rest[i];
  var o: BodyOut;
  let p = pos[i];
  o.world = p.xyz;
  o.clip = frame.viewProj * vec4f(p.xyz, 1.0);
  o.n = nrm[i].xyz;
  o.rest = r.p;
  o.wet = p.w;
  o.drip = col[i];
  o.part = u32(r.part);
  o.detail = r.detail;
  o.stain = stains[i].a;
  return o;
}
@vertex fn bodyVs(@builtin(vertex_index) i: u32) -> BodyOut { return bodyVertex(i); }
@vertex fn shadowVs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return frame.lightProj * vec4f(pos[i].xyz, 1.0);
}
// A drop's shape: volume stays the same as it stretches, and its top draws in to a neck when it has a taper.
fn dropScale(d: Drop, dir: vec3f) -> vec3f {
  let wide = 1.0 / sqrt(d.tall) * (1.0 - d.taper * smoothstep(-0.1, 1.0, dir.y));
  return vec3f(wide, d.tall, wide);
}
@vertex fn dropShadowVs(@builtin(vertex_index) i: u32, @builtin(instance_index) k: u32) -> @builtin(position) vec4f {
  let d = drops[k];
  return frame.lightProj * vec4f(d.p + rest[i].p * d.r * dropScale(d, rest[i].p), 1.0);
}

struct Surface { albedo: vec3f, rough: f32, spec: f32, scatter: vec3f, normal: vec3f, sparkle: f32 }

// The way each scoop was dragged across the tub (the same as in shape.js).
const DRAG = array<vec3f, 3>(vec3f(0.3, 0.2, 0.93), vec3f(-0.7, 0.1, 0.7), vec3f(0.8, 0.3, 0.5));
fn iceCream(o: BodyOut, face: vec3f, part: u32) -> Surface {
  let dir = normalize(o.rest);
  // The underside only ever sits inside what's below it. Cutting it away leaves the melted skirt a clean edge where it lies on the scoop beneath.
  if (dir.y < -0.68) { discard; }
  let flavor = frame.flavors[part];
  let seed = f32(part) * 7.3;
  let s = frame.scoops[part];
  // Frozen surfaces are made of pits and tiny ice grains. Melting closes them over.
  // Liquid lying on the surface: its edge is feathered by fine streaks running downhill.
  let streak = noise3(o.world * vec3f(15.0, 3.2, 15.0) + seed) - 0.5;
  let coat = smoothstep(0.0008, 0.02, o.drip.a + streak * 0.007);
  let film = max(coat, o.stain.a * 0.8);
  // It doesn't go glossy all at once: patches give way first, so the edge between frozen and melted wanders.
  let patchy = noise3(dir * 3.4 + seed * 2.0);
  let melted = smoothstep(0.22, 0.72, o.wet * 1.25 + (patchy - 0.5) * 0.7) * min(o.wet * 5.0, 1.0);
  let frozen = (1.0 - melted) * (1.0 - film);
  let p = dir * 8.0 + seed;
  // The scoop's drag leaves long fine ridges running one way, the most recognisable thing about a fresh scoop.
  let axis = DRAG[part];
  let along = dot(dir, axis);
  let across = dir - axis * along;
  let fold = noise3(vec3f(along * 25.0 + seed, across.x * 2.6, across.z * 2.6 + across.y * 2.6));
  let height = noise3(p) * 0.36 + noise3(p * 3.3) * 0.22 + fold * 0.34 + noise3(p * 13.0) * 0.08;
  // Bump mapping from screen derivatives (Mikkelsen, 2010): one noise lookup instead of four.
  let dpx = dpdx(o.world);
  let dpy = dpdy(o.world);
  let r1 = cross(dpy, face);
  let r2 = cross(face, dpx);
  let det = dot(dpx, r1);
  let grad = sign(det) * (dpdx(height) * r1 + dpdy(height) * r2);
  // Only frozen, matte surface has this texture. Any on a glossy one would show as blocky highlights.
  let n = normalize(abs(det) * face - grad * 0.034 * frozen * frozen);
  // Colour: real ice cream isn't flat. Air and fat lift it where it's torn and pale, and it deepens in its creases.
  let shade = smoothstep(0.32, 0.72, height);
  let torn = smoothstep(0.015, 0.08, o.detail / s.r);
  var c = mix(flavor.rgb * 0.8, flavor.rgb, shade);
  c = mix(c, c * 0.82 + vec3f(0.14), torn * frozen * 0.6);
  // Frost: the ridges are a touch paler than the creases between them.
  c = mix(c, c * 0.9 + vec3f(0.1), smoothstep(0.52, 0.78, height) * frozen * 0.5);
  // Bits and swirls through the ice cream, each flavour's own.
  let chunk = smoothstep(0.76, 0.8, noise3(dir * 38.0 + seed * 3.0)) * flavor.a * frozen;
  c = mix(c, flavor.rgb * vec3f(0.62, 0.42, 0.42), chunk * 0.7);
  let swirl = smoothstep(0.45, 0.6, noise3(dir * vec3f(2.4, 7.0, 2.4) + seed));
  c = mix(c, c * 1.1 + vec3f(0.03), swirl * 0.35);
  // Broad soft ribbons of a richer shade folded through it, as a real ripple flavour has.
  let ripple = abs(noise3(dir * vec3f(1.7, 3.6, 1.7) + seed * 2.0) - 0.5);
  c = mix(c, c * c * 0.5 + c * 0.42, smoothstep(0.13, 0.03, ripple) * (0.45 + 0.4 * flavor.a) * (1.0 - melted * 0.75));
  // Melted foam collapses: air leaves and the same colour turns deeper and richer.
  c = mix(c, c * c * 0.35 + c * 0.62, melted * 0.7);
  // A melted surface is still a foam. Tiny bubbles stay in it, and they're what stops it looking like plastic.
  let bubbles = smoothstep(0.69, 0.77, noise3(dir * 54.0 + seed)) * melted * (1.0 - coat) * (1.0 - frame.syrup * 0.65);
  c *= 1.0 - bubbles * 0.13;
  // Melted sorbet is a slush, with undissolved ice still showing in it as paler grains.
  let slush = smoothstep(0.58, 0.72, noise3(dir * 31.0 - seed)) * melted * frame.syrup * (1.0 - coat);
  c = mix(c, c * 0.8 + vec3f(0.17), slush * 0.32);
  // Liquid colours mix by absorption, as paint and syrup do: a thin yellow film over pink comes out orange, not grey.
  // The film filters what's under it, more the deeper it is. Thick cream also scatters, and hides what's below.
  let tint = mix(o.stain.rgb, o.drip.rgb, coat);
  // Kept gentle: its own melt shouldn't darken a scoop into stripes, only another colour should visibly change it.
  let depth = max(coat * (0.22 + o.drip.a * 8.0), o.stain.a * (0.14 + streak * 0.16));
  let filtered = c * pow(max(tint, vec3f(0.03)), vec3f(clamp(depth, 0.0, 2.2)));
  let hides = coat * smoothstep(0.006, 0.05, o.drip.a) * mix(0.92, 0.42, frame.syrup);
  c = mix(filtered, tint, hides);
  var out: Surface;
  out.albedo = c;
  out.normal = n;
  // Never one even gloss: some of it is slick, some still dull, and every bubble is a matte speck.
  let gloss = mix(0.14, 0.08, frame.syrup) + noise3(dir * 5.0 - seed) * mix(0.2, 0.08, frame.syrup) + bubbles * 0.3 + slush * 0.22;
  out.rough = mix(0.72, gloss, max(melted, film));
  out.spec = 1.0;
  // Light that gets into the cream comes back out warmer and more saturated.
  out.scatter = c * c * vec3f(1.05, 0.85, 0.75) + c * 0.2;
  // Sorbet is mostly water ice, so it glitters far more than dairy does.
  out.sparkle = frozen * smoothstep(mix(0.86, 0.8, frame.syrup), 0.95, noise3(dir * 86.0 + seed)) * mix(0.8, 1.15, frame.syrup);
  out.scatter *= mix(1.0, 1.35, frame.syrup);
  return out;
}

// The same fan as buildCone: straight grid lines on the flat sheet the cone was rolled from.
fn waffleLine(t: f32, y: f32) -> f32 {
  let s = (y - 0.5) / 0.9423;
  let phi = t * 0.335;
  let x = s * sin(phi);
  let z = s * cos(phi);
  let a = (x + z) / 0.27;
  let b = (x - z) / 0.27;
  let line = max(abs(fract(a) - 0.5), abs(fract(b) - 0.5)) * 2.0;
  return smoothstep(0.72, 0.92, line);
}
fn waffle(o: BodyOut, face: vec3f) -> Surface {
  let t = atan2(o.rest.x, o.rest.z);
  let y = o.rest.y;
  let line = waffleLine(t, y);
  let w = o.rest * vec3f(14.0, 14.0, 14.0);
  let grain = noise3(w * 4.0) * 0.5 + noise3(w * 11.0) * 0.5;
  let toast = fbm2(o.rest * 3.3 + 2.0);
  // Baked batter: pale gold in the sunk squares, deep brown along the iron's lines and wherever it caught.
  var c = mix(frame.cone[0].rgb, frame.cone[1].rgb, line * 0.75);
  c = mix(c, frame.cone[2].rgb, smoothstep(0.58, 0.85, toast) * (0.3 + line * 0.5));
  c = mix(c, frame.cone[3].rgb, smoothstep(0.5, 0.2, toast) * (1.0 - line) * 0.55);
  c *= 0.9 + grain * 0.26;
  // Batter blisters as it bakes, leaving tiny pits all over.
  let pits = smoothstep(0.7, 0.8, noise3(o.rest * 46.0));
  c *= 1.0 - pits * 0.2;
  let bumpN = fbm2(w * 3.0 + 1.0);
  let streak = noise3(o.world * vec3f(15.0, 3.2, 15.0)) - 0.5;
  let coat = smoothstep(0.0008, 0.02, o.drip.a + streak * 0.007);
  // Water in a porous solid fills the air gaps, so less light scatters back out: wet waffle turns darker and more saturated.
  // It soaks in unevenly, more in the thin sunk squares than along the dense raised lines.
  let soak = clamp(max(o.stain.a * (0.82 + streak * 0.5 + (1.0 - line) * 0.22), coat), 0.0, 1.0);
  c = mix(c, pow(c, vec3f(1.5)) * vec3f(0.74, 0.66, 0.6), soak);
  // What soaked in was coloured, and the batter takes some of that colour.
  let tint = mix(o.stain.rgb, o.drip.rgb, coat);
  c *= mix(vec3f(1.0), pow(max(tint, vec3f(0.05)), vec3f(0.55)), soak * mix(0.35, 0.8, frame.syrup));
  // Where liquid actually lies on it: a film that filters the waffle, and hides it once deep, more so for cream than syrup.
  let filtered = c * pow(max(tint, vec3f(0.05)), vec3f(clamp(coat * (0.6 + o.drip.a * 18.0), 0.0, 2.0)));
  let thick = coat * smoothstep(0.006, 0.05, o.drip.a) * mix(0.9, 0.38, frame.syrup);
  // Liquid fills the grid and levels it, so thick parts smooth out the bumps underneath.
  // The iron's pattern again, from the same formula as the shape, sharpened per pixel: still only one grid.
  let eps = 0.014;
  let around = eps / max(length(o.rest.xz), 0.04);
  let tangent = normalize(cross(vec3f(0.0, 1.0, 0.0), face));
  let press = (1.0 - coat) * mix(0.5, 0.26, soak);
  let n = normalize(face + (vec3f(bumpN) - 0.5) * 0.05 * (1.0 - coat) - tangent * (waffleLine(t + around, y) - line) * press - vec3f(0.0, 1.0, 0.0) * (waffleLine(t, y + eps) - line) * press);
  var out: Surface;
  out.albedo = mix(filtered, tint, thick);
  out.normal = n;
  // A damp surface takes on a dull sheen, and a real film of liquid is properly glossy.
  out.rough = mix(mix(mix(0.48, 0.34, line), 0.3, soak), 0.1, coat);
  out.spec = 1.0;
  out.scatter = mix(c * vec3f(1.15, 0.9, 0.62), tint * tint, thick);
  out.sparkle = (1.0 - soak) * smoothstep(0.82, 0.92, noise3(o.rest * 130.0)) * 0.35;
  return out;
}

// The HDR's light on a matte surface facing n (nine spherical harmonics, Ramamoorthi & Hanrahan 2001).
fn envDiffuse(n: vec3f) -> vec3f {
  let d = vec3f(frame.env.z * n.x - frame.env.w * n.z, n.y, frame.env.w * n.x + frame.env.z * n.z);
  var c = frame.sh[0].rgb * 0.282095;
  c += (frame.sh[1].rgb * d.y + frame.sh[2].rgb * d.z + frame.sh[3].rgb * d.x) * 0.488603;
  c += (frame.sh[4].rgb * d.x * d.y + frame.sh[5].rgb * d.y * d.z + frame.sh[7].rgb * d.x * d.z) * 1.092548;
  c += frame.sh[6].rgb * 0.315392 * (3.0 * d.y * d.y - 1.0) + frame.sh[8].rgb * 0.546274 * (d.x * d.x - d.z * d.z);
  return max(c, vec3f(0.0));
}
fn light(s: Surface, world: vec3f, shadow: f32) -> vec3f {
  let n = s.normal;
  let v = normalize(frame.eye - world);
  let l = frame.light;
  let d = dot(n, l);
  // Occlusion straight from the shape: dark where one scoop tucks into the next and where cream meets cone.
  let near = bodyDistance(world + n * 0.09);
  let wider = bodyDistance(world + n * 0.32);
  let ao = clamp(0.25 + near / 0.09 * 0.35 + wider / 0.32 * 0.4, 0.0, 1.0);
  // Diffuse, softened past the shadow line the way cream is, where light bleeds on through the body.
  let lit = max(d, 0.0) * shadow;
  let bleed = smoothstep(-0.55, 0.3, d) * (0.45 + 0.55 * shadow);
  var color = s.albedo * vec3f(1.0, 0.95, 0.88) * lit * 1.8;
  color += s.scatter * bleed * 0.5;
  // Fill from the room: cool from above, warm bounce from the surface below.
  let up = n.y * 0.5 + 0.5;
  let fill = mix(mix(vec3f(0.95, 0.82, 0.68), frame.ground.rgb, 0.3), mix(vec3f(0.88, 0.94, 1.0), frame.sky.rgb, 0.3), up);
  color += s.albedo * fill * ao * ao * 0.46;
  // A soft fill from the viewer's side, so it holds up from every angle you can turn it to.
  let toward = normalize(v + vec3f(0.0, 0.45, 0.0));
  color += s.albedo * max(dot(n, toward), 0.0) * 0.36 * ao;
  // Rim: a soft edge of light along the far side of a round thing.
  let rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  color += s.scatter * rim * 0.35 * ao;
  // Gloss.
  let r = reflect(-v, n);
  let sharp = 1.0 - clamp(s.rough * 1.5, 0.0, 1.0);
  let f = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
  color += studio(r, sharp) * f * ao * mix(0.35, 1.0, sharp) * mix(0.55, 1.0, shadow) * s.spec;
  let h = normalize(v + l);
  color += vec3f(1.0, 0.96, 0.88) * ggx(n, h, max(s.rough, 0.08)) * 0.09 * max(d, 0.0) * shadow * (0.25 + 0.75 * sharp);
  // A second window near the camera: every wet dome catches a highlight wherever you stand.
  let h2 = normalize(v + normalize(v + vec3f(-0.7, 0.9, 0.0)));
  color += vec3f(1.0, 0.98, 0.95) * ggx(n, h2, max(s.rough, 0.09)) * 0.035 * sharp * ao;
  color += vec3f(1.0, 0.98, 0.95) * s.sparkle * 0.32 * (0.25 + 0.75 * max(d, 0.0)) * shadow;
  if (frame.env.x > 0.001) {
    // The same surface in the HDR's light: soft light from all round, bleeding through the cream, then gloss from its real lights.
    var e = s.albedo * envDiffuse(n) * ao * mix(0.5, 1.0, shadow);
    e += s.scatter * envDiffuse(normalize(n + v * 0.6)) * (0.32 + 0.3 * bleed) * ao;
    e += s.scatter * envDiffuse(-v) * rim * 0.4 * ao;
    let fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    e += envDiffuse(r) * fres * ao * mix(0.3, 1.0, sharp) * s.spec;
    for (var i = 0; i < 2; i++) {
      let il = frame.envDir[i].xyz;
      let ih = normalize(v + il);
      e += frame.envCol[i].rgb * ggx(n, ih, max(s.rough, 0.09)) * 0.012 * max(dot(n, il), 0.0) * select(1.0, shadow, i == 0) * (0.2 + 0.8 * sharp);
    }
    e += vec3f(1.0, 0.98, 0.95) * s.sparkle * 0.3 * (0.25 + 0.75 * max(d, 0.0)) * shadow;
    color = mix(color, e, frame.env.x);
  }
  return color;
}

fn shadeBody(o: BodyOut, face: vec3f) -> vec3f {
  var s: Surface;
  if (o.part < 3u) { s = iceCream(o, face, o.part); } else { s = waffle(o, face); }
  let shadow = shadowAt(o.world, face, 2.2);
  var c = light(s, o.world, shadow);
  // Baked batter is warm and translucent, so the cone's shaded side glows rather than going black.
  if (o.part == 3u) { c += s.albedo * vec3f(0.36, 0.28, 0.2) * (1.0 - shadow * 0.7); }
  return c;
}
@fragment fn bodyFs(o: BodyOut, @builtin(front_facing) front: bool) -> @location(0) vec4f {
  var face = normalize(o.n);
  // Only the cone's inside really faces inward. Under a scoop's lip, keep the outer normal so it reads as the lip's thickness, not a black gap.
  if (!front && o.part == 3u) { face = -face; }
  return vec4f(shadeBody(o, face), 1.0);
}

// ---- falling drops
struct DropOut { @builtin(position) clip: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) tint: vec3f }
fn dropVertex(i: u32, k: u32) -> DropOut {
  let d = drops[k];
  let dir = rest[i].p;
  let scale = dropScale(d, dir);
  var o: DropOut;
  o.world = d.p + dir * d.r * scale;
  o.n = normalize(dir / scale);
  o.tint = vec3f(d.r2, d.g2, d.b2);
  o.clip = frame.viewProj * vec4f(o.world, 1.0);
  return o;
}
@vertex fn dropVs(@builtin(vertex_index) i: u32, @builtin(instance_index) k: u32) -> DropOut { return dropVertex(i, k); }
@fragment fn dropFs(o: DropOut) -> @location(0) vec4f {
  var s: Surface;
  s.albedo = o.tint;
  s.normal = normalize(o.n);
  s.rough = 0.1;
  s.spec = 1.0;
  s.scatter = o.tint * o.tint;
  s.sparkle = 0.0;
  var c = light(s, o.world, shadowAt(o.world, s.normal, 2.0));
  // A drop is a tiny lens: light that went in on the lit side gathers on the far side, so it glows there.
  let v = normalize(frame.eye - o.world);
  let gather = pow(clamp(dot(s.normal, normalize(v - frame.light * 0.9)), 0.0, 1.0), 4.0);
  c += o.tint * gather * mix(0.3, 1.0, frame.syrup);
  return vec4f(c, 1.0);
}

// ---- the room: a seamless sweep, with the shadow falling on it
struct Quad { @builtin(position) clip: vec4f }
@vertex fn quadVs(@builtin(vertex_index) v: u32) -> Quad {
  let c = array<vec2f, 3>(vec2f(-1, -1), vec2f(3, -1), vec2f(-1, 3));
  return Quad(vec4f(c[v], 1.0, 1.0));
}
@fragment fn roomFs(q: Quad) -> @location(0) vec4f {
  let uv = q.clip.xy / frame.size;
  let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let far = frame.invViewProj * vec4f(ndc, 1.0, 1.0);
  let rd = normalize(far.xyz / far.w - frame.eye);
  // A paper sweep lit by one big soft light from behind and above, brightest just behind the subject.
  let behind = length((uv - vec2f(0.5, 0.44)) * vec2f(frame.size.x / frame.size.y, 1.0));
  let pool = exp(-behind * behind * 2.3);
  // One continuous sheet of paper: no horizon, only the colour easing from wall to floor down the frame.
  var c = mix(frame.sky.rgb, frame.ground.rgb, smoothstep(0.35, 0.95, uv.y)) * mix(0.5, 1.2, pool);
  if (rd.y < 0.0) {
    let t = -frame.eye.y / rd.y;
    let p = frame.eye + rd * t;
    let dist = length(p.xz);
    let soft = shadowAt(p, vec3f(0.0, 1.0, 0.0), 34.0);
    // A real sweep keeps the shadow close and soft, so it never runs off as a long streak.
    c *= 1.0 - (1.0 - soft) * 0.36 * exp(-dist * dist / 7.0);
    c *= 1.0 - 0.2 * exp(-dist * dist / 1.1);
    // Light bounces off the ice cream onto the sweep, tinting it faintly right underneath.
    c = mix(c, c * (frame.flavors[0].rgb * 0.5 + 0.62), 0.5 * exp(-dist * dist / 1.8));
  }
  return vec4f(c, 1.0);
}

// ---- pools on the floor
struct PoolOut { @builtin(position) clip: vec4f, @location(0) world: vec3f, @location(1) n: vec3f, @location(2) tint: vec3f, @location(3) h: f32 }
@vertex fn poolVs(@builtin(vertex_index) i: u32) -> PoolOut {
  var o: PoolOut;
  let p = pos[i];
  o.world = p.xyz;
  o.n = nrm[i].xyz;
  o.tint = col[i].rgb;
  o.h = p.w;
  o.clip = frame.viewProj * vec4f(p.xyz, 1.0);
  return o;
}
@fragment fn poolFs(o: PoolOut) -> @location(0) vec4f {
  if (o.h < 0.0004) { discard; }
  let cover = smoothstep(0.0004, 0.007, o.h);
  var s: Surface;
  // Thin at the edge and pale, with the sweep showing through. Deep in the middle, so the colour goes rich.
  let deep = smoothstep(0.002, 0.03, o.h);
  s.albedo = mix(o.tint * 0.78, pow(o.tint, vec3f(1.6)) * 0.62, deep);
  s.normal = normalize(o.n);
  s.rough = 0.09;
  // The camera sees a puddle at a low angle, where the room's reflection would otherwise wash the colour out.
  s.spec = 0.5;
  s.scatter = o.tint * o.tint * 0.5;
  s.sparkle = 0.0;
  var c = light(s, o.world, shadowAt(o.world, s.normal, 7.0));
  // Where the rim meets the sweep it's dark, which lifts the puddle off the floor.
  c *= mix(0.68, 1.0, smoothstep(0.001, 0.012, o.h));
  return vec4f(c, cover);
}
`,b={tipY:.5,rimY:2.75,rimR:.8},to=[{y:3.2,r:.9,seed:1.3,axis:[.3,.2,.93],ox:.025,oz:-.02,lx:-.03,lz:.03},{y:4.22,r:.76,seed:7.9,axis:[-.7,.1,.7],ox:-.075,oz:.05,lx:.09,lz:.05},{y:5.02,r:.62,seed:4.2,axis:[.8,.3,.5],ox:.06,oz:.06,lx:-.2,lz:.08}],oe=124,H=248,oo=130,ro=260,F=170,ot=2.3,ao=e=>e-Math.floor(e),Q=(e,o,a)=>ao(Math.sin(e*127.1+o*311.7+a*74.7)*43758.5453),Te=e=>e*e*(3-2*e),ae=(e,o,a)=>Te(Math.min(Math.max((a-e)/(o-e),0),1));function Ho(e,o,a){const i=Math.floor(e),n=Math.floor(o),c=Math.floor(a),f=Te(e-i),p=Te(o-n),x=Te(a-c),g=(M,h,y)=>M+(h-M)*y;return g(g(g(Q(i,n,c),Q(i+1,n,c),f),g(Q(i,n+1,c),Q(i+1,n+1,c),f),p),g(g(Q(i,n,c+1),Q(i+1,n,c+1),f),g(Q(i,n+1,c+1),Q(i+1,n+1,c+1),f),p),x)}function te(e,o,a,i=4){let n=0,c=.5,f=0;for(let p=0;p<i;p++)n+=Ho(e,o,a)*c,f+=c,c*=.5,e=e*2.03+11.1,o=o*2.03+3.7,a=a*2.03+7.3;return n/f}function Qo(e,o,a,{seed:i,axis:n}){const[c,f,p]=n,x=e*c+o*f+a*p,g=e-c*x,M=o-f*x,h=a-p*x,y=te(g*2+i,x*13+i,h*2-M*2,3)-.5,z=te(e*2.3+i,o*2.3,a*2.3-i,3)-.5,k=te(e*5+i,o*9,a*5,3)-.5,S=(te(e*2.2-i,0,a*2.2,2)-.5)*.22,B=Math.exp(-(((o+.46+S)/.11)**2)),I=ae(-.5,-.8,o+S);return B*(.085+k*.2)+y*.05*ae(-.5,-.1,o)+z*.1-I*.08+k*.02}const Zo=b.rimR/Math.hypot(b.rimR,b.rimY-b.tipY),Jo=(b.rimY-b.tipY)/Math.hypot(b.rimR,b.rimY-b.tipY);function Ko(e,o){const a=(o-b.tipY)/Jo,i=e*Zo,n=a*Math.sin(i),c=a*Math.cos(i),f=(n+c)/.27,p=(n-c)/.27,x=g=>Math.abs(ao(g)-.5)*2;return ae(.72,.92,Math.max(x(f),x(p)))}function er(){const{tipY:e,rimY:o,rimR:a}=b,i=o-e,n=[],c=[],f=oo,p=ro,x=14;for(let g=0;g<=f;g++){const M=g>f-x,h=M?(f-g)/x:g/(f-x);for(let y=0;y<p;y++){const z=y/p*Math.PI*2-Math.PI,k=Math.sin(z),S=Math.cos(z);let B,I;if(M){const le=(te(k*2.5,1.5,S*2.5,3)-.5)*.13;B=o+le-(1-h)*.36,I=a*(1-(1-h)*.15)-.038}else{B=e+i*h,I=a*Math.sqrt(h*h+9e-4)*1;const le=Ko(z,B),E=ae(Math.PI-.1,Math.PI-.04,Math.abs(z))*.012;I+=(le*.016+E+(te(k*3,B*3,S*3,2)-.5)*.01)*ae(0,.12,h),B+=(te(k*2.5,1.5,S*2.5,3)-.5)*.13*ae(.92,1,h)}n.push(k*I,B,S*I);const ne=Math.hypot(i,a);c.push(k*i/ne,-a/ne,S*i/ne)}}return{positions:n,normals:c,rows:f+1,cols:p}}function tr(e){const o=[],a=[];for(let i=0;i<oe;i++){const n=i/(oe-1)*Math.PI,c=Math.cos(n),f=Math.sin(n);for(let p=0;p<H;p++){const x=p/H*Math.PI*2,g=f*Math.sin(x),M=f*Math.cos(x);o.push(g,c,M),a.push(Qo(g,c,M,e)*e.r)}}return{dirs:o,details:a,rows:oe,cols:H}}function rt(e,o,a,i=!0){const n=[];for(let c=0;c<e-1;c++)for(let f=0;f<(i?o:o-1);f++){const p=i?(f+1)%o:f+1,x=a+c*o+f,g=a+c*o+p,M=a+(c+1)*o+f,h=a+(c+1)*o+p;n.push(x,M,g,g,M,h)}return n}const He=110,Ct=36,fe=28,de=12,Ft=11,It=5,Lt=16,or=(e,o,a)=>{const i=Math.min(Math.max((a-e)/(o-e),0),1);return i*i*(3-2*i)};function so({colors:e,random:o=Math.random}){const a=to.map((r,s)=>({...r,id:s,base:r.y,melt:0,sx:1,sy:1,cx:r.ox,cy:r.y,cz:r.oz}));let i=[],n=[],c=[],f=0,p=0,x=0;const g=new Float32Array(He*Lt),M=new Float32Array(Ct*8),h=new Float32Array(fe*2*de);let y={volume:0,color:[1,1,1],releasedAt:-1e9},z=[],k=0,S=1.2,B=0;function I(r,s,l,t){const u=t.r*t.sx,m=t.r*t.sy,v=r-t.cx,w=s-t.cy,U=l-t.cz,Z=Math.hypot(v/u,w/m,U/u),L=Math.hypot(v/(u*u),w/(m*m),U/(u*u));return L>1e-6?Z*(Z-1)/L:-u}function ne(r,s,l){const t=b.rimY-b.tipY,u=Math.hypot(r,l),m=Math.hypot(t,b.rimR),v=(u*t-(s-b.tipY)*b.rimR)/m;return Math.max(v,b.tipY-s,s-b.rimY-.05)}const le=(r,s,l)=>{const t=Math.max(l-Math.abs(r-s),0)/l;return Math.min(r,s)-t*t*l*.25};function E(r,s,l){let t=ne(r,s,l);for(const u of a)t=le(t,I(r,s,l,u),.1);return t}const ke=[0,0,0];function Ne(r,s,l){const t=E(r+.01,s,l)-E(r-.01,s,l),u=E(r,s+.01,l)-E(r,s-.01,l),m=E(r,s,l+.01)-E(r,s,l-.01),v=Math.hypot(t,u,m)||1;return ke[0]=t/v,ke[1]=u/v,ke[2]=m/v,ke}const Go=.1,Ut=16e-5,Ot=34e-5,qt=()=>Ut+o()*(Ot-Ut);let Pe=qt();const Ve=r=>Math.max(Math.cbrt(r*.239)*1.35,.012),Ye=r=>Math.min(.62*r*r/(r+.05),.1),To=r=>Ye(r)*Math.PI*r*r*.4,Se=r=>{let s=Math.sqrt(r/.1);for(let l=0;l<10;l++)s=Math.min(Math.max(s*Math.pow(r/Math.max(To(s),1e-9),.3),.004),.6);return s};function Rt(r,s,l,t,u,m="run"){const v=Ne(r,s,l),w=E(r,s,l),U={x:r-v[0]*w,y:s-v[1]*w,z:l-v[2]*w,volume:t,grown:0,color:[...u],dir:[0,-1,0],speed:0,stretch:1,hang:0,kind:m,age:0,trailed:0,life:1/0,seed:o()*6.28};return i.push(U),U}const At=(r,s)=>Math.pow(.5+.5*Math.sin(r*5+s*2.1)*Math.sin(r*3+s*4.3+1),1.5);function Uo(){const r=a[Math.floor(o()*a.length)];if(r.melt<.02)return;if(o()<.2){const w=a[0],U=o()*Math.PI*2;Rt(w.cx+Math.sin(U)*w.r*w.sx*.92,w.cy-w.r*w.sy*.42,w.cz+Math.cos(U)*w.r*w.sx*.92,7e-4+o()*.0012,e[0]);return}let s=o()*Math.PI*2;for(let w=0;w<6&&At(s,r.id)<.55;w++)s=o()*Math.PI*2;const l=-.5-o()*.15*r.melt-At(s,r.id)*r.melt*.3,t=Math.sqrt(Math.max(1-l*l,.02)),u=r.cx+Math.sin(s)*t*r.r*r.sx,m=r.cy+l*r.r*r.sy,v=r.cz+Math.cos(s)*t*r.r*r.sx;Rt(u,m,v,6e-4+o()*.0015*(.4+r.melt),e[r.id])}function Et(r,{speed:s}){f+=r,a.forEach((l,t)=>{l.melt=Math.min(l.melt+r*s*(.0018+t*35e-5)*(1-l.melt*.72),1),l.sy=1-.15*l.melt,l.sx=Math.cbrt(1/l.sy)*(1+.03*l.melt),l.cx=l.ox+l.lx*l.melt,l.cz=l.oz+l.lz*l.melt}),a[0].cy=b.rimY+(a[0].base-b.rimY)*(a[0].sy*.85+.15);for(let l=1;l<a.length;l++){const t=a[l-1],u=a[l],m=(u.base-a[l-1].base)*(.5*(t.sy+u.sy));u.cy=t.cy+m}p-=r*s,p<=0&&i.length<He-6&&(Uo(),p=1.3+o()*2);for(let l=i.length-1;l>=0;l--){const t=i[l];t.age+=r,t.grown=Math.min(t.grown+r*.35,1);const u=Se(t.volume),m=Ye(u),v=Ne(t.x,t.y,t.z),w=v[0]*v[1],U=v[1]*v[1]-1,Z=v[2]*v[1],L=Math.hypot(w,U,Z),je=s*(.025+34*m*m)*L,We=Math.min(je,.32);if(t.speed+=(We-t.speed)*Math.min(r*3,1),L>.001){const G=w/L,J=U/L,O=Z/L;t.dir[0]+=(G-t.dir[0])*Math.min(r*4,1),t.dir[1]+=(J-t.dir[1])*Math.min(r*4,1),t.dir[2]+=(O-t.dir[2])*Math.min(r*4,1);const Xe=Math.hypot(...t.dir)||1;t.dir[0]/=Xe,t.dir[1]/=Xe,t.dir[2]/=Xe}const D=Math.sin(t.y*9+t.x*5+t.seed)*.35,N=Math.hypot(t.dir[2],t.dir[0])>.001?1:0;t.x+=t.dir[2]*D*N*t.speed*r,t.z+=(-t.dir[0]*D*N+Math.cos(t.y*7+t.seed)*.2*N)*t.speed*r,t.x+=t.dir[0]*t.speed*r,t.y+=t.dir[1]*t.speed*r,t.z+=t.dir[2]*t.speed*r;const ce=E(t.x,t.y,t.z),V=Ne(t.x,t.y,t.z);t.x-=V[0]*ce,t.y-=V[1]*ce,t.z-=V[2]*ce,t.stretch+=(1+Math.min(t.speed*7,1.1)-t.stretch)*Math.min(r*3,1);for(const G of a)if(Math.abs(I(t.x,t.y,t.z,G))<.06){const J=Math.min(r*.09*(.3+G.melt),1);for(let O=0;O<3;O++)t.color[O]+=(e[G.id][O]-t.color[O])*J}if(t.volume*=Math.exp(-t.speed*r*.42),t.y<b.tipY+.24){const G=Math.min(Math.min(r*1.6,1)*t.volume,Math.max(Pe*1.02-y.volume,0)),J=G/(y.volume+G+1e-9);for(let O=0;O<3;O++)y.color[O]+=(t.color[O]-y.color[O])*J;if(y.volume+=G,t.volume-=G,t.volume<12e-5){i.splice(l,1);continue}}const Ao=or(.15,.7,-V[1]),$e=a[0];if(Ao>.5&&t.volume>.0028&&t.y>b.rimY-.1&&t.y<$e.cy-$e.r*$e.sy*.2&&Math.hypot(t.x,t.z)>b.rimR+.06){if(t.hang+=r*s*(.25+u*3),t.hang>1.1&&B>3&&n.length<fe-1){const G=Math.min(t.volume*.5,Ot);t.volume-=G,t.hang=.15,B=0;const J=Ve(G);n.push({x:t.x,y:t.y-u*.9,z:t.z,vy:-.1,r:J,age:0,volume:G*It,color:[...t.color],anchorX:t.x,anchorY:t.y,anchorZ:t.z}),x++}}else t.hang=Math.max(t.hang-r*.5,0);if(t.volume<12e-5){i.splice(l,1);continue}}for(let l=0;l<i.length;l++){const t=i[l];if(t.volume<=0)continue;const u=Se(t.volume);for(let m=l+1;m<i.length;m++){const v=i[m];if(v.volume<=0||t.volume<=0)continue;const w=Se(v.volume),U=v.x-t.x,Z=v.y-t.y,L=v.z-t.z,je=Math.hypot(U,Z,L),We=(u+w)*.62;if(je<We){const D=t.volume>=v.volume?t:v,N=D===t?v:t,ce=N.volume/(D.volume+N.volume);for(let V=0;V<3;V++)D.color[V]+=(N.color[V]-D.color[V])*ce;D.volume=Math.min(D.volume+N.volume,.006),D.hang=Math.max(D.hang,N.hang),N.volume=0}}}if(i=i.filter(l=>l.volume>0),k+=r,B+=r,y.volume>=Pe&&k>S&&n.length<fe-1){const l=y.volume*.86;y.volume-=l,y.releasedAt=f,k=0,S=1.1+o()*2.2,Pe=qt();const t=Ve(l);n.push({x:0,y:b.tipY-t*1.5,z:0,vy:-.05,r:t,age:0,volume:l*It,color:[...y.color],anchorX:0,anchorY:b.tipY,anchorZ:0}),x++}for(let l=n.length-1;l>=0;l--){const t=n[l];t.age+=r,t.vy-=Ft*r,t.y+=t.vy*r,t.y<t.r*.5&&(Oo(t),n.splice(l,1))}for(let l=z.length-1;l>=0;l--){const t=z[l];t.vy-=Ft*r,t.x+=t.vx*r,t.y+=t.vy*r,t.z+=t.vz*r,t.y<t.r&&t.vy<0&&z.splice(l,1)}Dt()}function Oo(r){let s=null,l=.4;for(const u of c){const m=Math.hypot(u.x-r.x,u.z-r.z);Math.hypot(u.color[0]-r.color[0],u.color[1]-r.color[1],u.color[2]-r.color[2])<.12&&m<l+u.r*.45&&(s=u,l=m)}if(!s)c.length>=Ct&&c.shift(),s={x:r.x+(o()-.5)*.28,z:r.z+(o()-.5)*.28,volume:0,r:.02,color:[...r.color]},c.push(s);else{const u=r.volume/(s.volume+r.volume);for(let m=0;m<3;m++)s.color[m]+=(r.color[m]-s.color[m])*u}s.volume+=r.volume,s.ripple=1;const t=Math.min(-r.vy/6,1);for(let u=0,m=2+Math.floor(o()*3*t);u<m&&z.length<12;u++){const v=o()*Math.PI*2,w=(.35+o()*.5)*t;z.push({x:r.x,y:r.r*.5,z:r.z,vx:Math.cos(v)*w,vy:(.7+o()*.9)*t,vz:Math.sin(v)*w,r:.006+o()*.008,color:[...r.color]})}}function Dt(){g.fill(0),i.slice(-He).forEach((s,l)=>{const t=Se(s.volume),u=Math.min(t,Go),m=Math.min(1+(t/u-1)*1.6,2.2);g.set([s.x,s.y,s.z,u*(.4+.6*s.grown),s.dir[0],s.dir[1],s.dir[2],s.stretch*m,s.color[0],s.color[1],s.color[2],Ye(u)*s.grown,Math.min(s.hang,1.3),0,0,0],l*Lt)}),M.fill(0),c.forEach((s,l)=>{const t=Math.cbrt(s.volume)*1.5+.03;s.r+=(t-s.r)*.012,s.ripple=(s.ripple??0)*.985,M.set([s.x,s.z,s.r,Math.min(.05,.016+s.volume*4),s.color[0],s.color[1],s.color[2],s.ripple],l*8)}),h.fill(0);let r=0;if(y.volume>4e-5){const s=f-y.releasedAt,l=Math.exp(-s*8)*Math.cos(s*34)*.3,t=Ve(y.volume),u=1.1+.5*Math.min(y.volume/Pe,1)+l;h.set([0,b.tipY+.012-t*u*.94,0,t,u,...y.color,.86,0,0,0],r++*de)}for(const s of n){const l=Math.max(1-s.age/.14,0),t=Math.exp(-s.age*5)*Math.cos(s.age*26)*.22,u=Math.min(-s.vy*.05,.3);if(h.set([s.x,s.y,s.z,s.r,1+t+u,...s.color,.25*(1-Math.min(s.age*3,1)),0,0,0],r++*de),l>0){const m=(s.anchorY+s.y)/2,v=(s.anchorY-s.y)/2,w=s.r*.14*l+.002;h.set([s.x,m,s.z,w,Math.max(v,.005)/w,...s.color,0,0,0,0],r++*de)}}for(const s of z){if(r>=fe*2)break;h.set([s.x,s.y,s.z,s.r,1.1,...s.color,0,0,0,0],r++*de)}_t=r}function qo(){i=[],n=[],c=[],z=[],f=0,p=0,x=0,y={volume:0,color:[1,1,1],releasedAt:-1e9};for(const r of a)r.melt=0,r.sx=r.sy=1,r.cx=r.ox,r.cy=r.base,r.cz=r.oz}function Ro(r,s){for(let l=0;l<r;l+=1/30)Et(1/30,{speed:s})}let _t=0;return Dt(),{scoops:a,kernelData:g,poolData:M,dropData:h,step:Et,reset:qo,prewarm:Ro,field:E,setColors(r){e=r},get beads(){return i},get drops(){return n},get pools(){return c},get totalDrops(){return x},get pendant(){return y},dropCount:()=>Math.min(_t,fe*2)}}const rr=e=>()=>{e|=0,e=e+1831565813|0;let o=Math.imul(e^e>>>15,1|e);return o=o+Math.imul(o^o>>>7,61|o)^o,((o^o>>>14)>>>0)/4294967296},ar={Pistachio:{flavors:["#a8cf62","#f6e8c6","#e42f62"],bits:[.8,0,.7],sky:"#efe7d8",ground:"#f6f0e4",syrup:.35},Peach:{flavors:["#f47f9c","#fac648","#f6e8c6"],bits:[1,0,.4],sky:"#f4bfa6",ground:"#f8d2bd",syrup:.5}},sr=[{name:"hero",tall:!0,set:"Classic",seed:11,dur:4.6,pre:14,preSpeed:1,speed:2.5,timeScale:1,clockOffset:0,from:{az:-38,el:7,dist:16.5,target:[0,2.9,0],fov:24},to:{az:-6,el:6,dist:13.6,target:[0,3.05,0],fov:24}},{name:"scoop",set:"Pistachio",seed:5,dur:4.2,pre:24,preSpeed:2,speed:2,timeScale:1,clockOffset:10,from:{az:75,el:16,dist:4.4,target:[0,4.95,0],fov:24},to:{az:22,el:30,dist:3.7,target:[0,5.15,0],fov:24}},{name:"cone",set:"Peach",seed:23,dur:4.2,pre:45,preSpeed:2,speed:2,timeScale:1,clockOffset:20,from:{az:28,el:4,dist:5.4,target:[0,1.5,0],fov:24},to:{az:-14,el:9,dist:8.2,target:[0,3.8,0],fov:24}},{name:"runs",set:"Classic",seed:3,dur:4.4,pre:70,preSpeed:2.5,speed:2.5,timeScale:1,clockOffset:30,from:{az:-52,el:3,dist:4.6,target:[.2,3.5,0],fov:24},to:{az:14,el:5,dist:4.1,target:[.2,3,0],fov:24}},{name:"waffle",set:"Pistachio",seed:12,dur:5.4,pre:14,preSpeed:2,speed:2,timeScale:1,clockOffset:40,from:{az:-38,el:3,dist:3.4,target:[0,2.2,0],fov:24},to:{az:32,el:8,dist:2.9,target:[0,2.35,0],fov:24}},{name:"crane",tall:!0,set:"Classic",seed:9,dur:5.2,pre:6,preSpeed:1,speed:1.5,timeScale:1,clockOffset:50,from:{az:-24,el:2,dist:7.6,target:[0,1.3,0],fov:24},to:{az:14,el:15,dist:6.4,target:[0,4.3,0],fov:24}},{name:"finale",tall:!0,set:"Peach",seed:41,dur:5.6,pre:110,preSpeed:3,speed:3,timeScale:1,clockOffset:60,from:{az:26,el:6,dist:10.5,target:[0,2.9,0],fov:24},to:{az:-20,el:9,dist:15.5,target:[0,2.9,0],fov:24}}],ir=e=>e*e*e*(e*(e*6-15)+10),ue=(e,o,a)=>e+(o-e)*a,Nt=e=>e*Math.PI/180;function nr(e,o,a,i){const n=ir(Math.min(Math.max(o,0),1)),{from:c,to:f}=e,p=e.sway??1,x=Nt(ue(c.az,f.az,n)+Math.sin(a*.9)*.35*p),g=Nt(ue(c.el,f.el,n)+Math.sin(a*1.3+1)*.25*p),M=Math.max(1,(e.tall?.6:.9)/i),h=ue(c.dist,f.dist,n)*M,y=c.target.map((z,k)=>ue(z,f.target[k],n));return{position:[y[0]+h*Math.sin(x)*Math.cos(g),y[1]+h*Math.sin(g),y[2]+h*Math.cos(x)*Math.cos(g)],target:y,fov:ue(c.fov,f.fov,n)}}const io=Xo+Vo,no=$o+Yo,$=new URLSearchParams(location.search),j=$.has("capture"),he=j?+$.get("w"):innerWidth,pe=j?+$.get("h"):innerHeight;if(j)for(const e of["#title","#hint","#bar","#random","#controls"])document.querySelector(e)?.remove();const at=document.querySelector("#message"),ie=document.querySelector("#view"),lr=e=>{throw at.textContent=e,new Error(e)},lo=await navigator.gpu?.requestAdapter();lo||lr("This piece needs WebGPU. Try a recent version of Chrome or Edge, or Safari with WebGPU turned on.");const d=await lo.requestDevice(),st=Wo(d);d.addEventListener("uncapturederror",e=>console.error(e.error.message));const co=ie.getContext("webgpu"),fo=navigator.gpu.getPreferredCanvasFormat();co.configure({device:d,format:fo,alphaMode:"opaque"});for(const e of[eo,io,no]){const o=await d.createShaderModule({code:e}).getCompilationInfo();for(const a of o.messages)a.type==="error"&&console.error(`${a.lineNum}:${a.linePos} ${a.message}`)}const Me={Sorbet:{flavors:["#e42f62","#f88f28","#8567e0"],bits:[.5,0,.7],sky:"#f9dc9c",ground:"#fce6b4",syrup:1},Gelato:{flavors:["#a8cf62","#f47f9c","#fac648"],bits:[.8,1,0],sky:"#f2a488",ground:"#f6b59c",syrup:.35},Classic:{flavors:["#6d3f26","#f6e8c6","#ee8fa2"],bits:[.5,0,1],sky:"#f0c35e",ground:"#f5cf74",syrup:0}},uo={Waffle:[[.88,.54,.2],[.7,.36,.1],[.42,.2,.06],[.95,.72,.38]],Chocolate:[[.17,.07,.03],[.085,.032,.014],[.045,.017,.008],[.27,.12,.055]],Strawberry:[[.9,.36,.38],[.7,.18,.22],[.48,.1,.13],[.98,.6,.56]]};j&&Object.assign(Me,ar);const it={speed:1},Qe=e=>{const o=new No(e);return[o.r,o.g,o.b]},nt=oe*H,yt=(oo+1)*ro,cr=F*F,se=nt*3+yt+cr,De=new Float32Array(se*8),ze=[];let W=0;to.forEach((e,o)=>{const{dirs:a,details:i}=tr(e);ze.push([W,oe,H,1]);for(let n=0;n<nt;n++)De.set([a[n*3],a[n*3+1],a[n*3+2],o,a[n*3],a[n*3+1],a[n*3+2],i[n]],(W+n)*8);W+=nt});const Y=er();ze.push([W,Y.rows,Y.cols,1]);const fr=W;for(let e=0;e<yt;e++)De.set([Y.positions[e*3],Y.positions[e*3+1],Y.positions[e*3+2],3,Y.normals[e*3],Y.normals[e*3+1],Y.normals[e*3+2],0],(W+e)*8);W+=yt;ze.push([W,F,F,0]);const dr=W;for(let e=0;e<F;e++)for(let o=0;o<F;o++){const a=(o/(F-1)-.5)*ot*2,i=(e/(F-1)-.5)*ot*2;De.set([a,0,i,4,0,1,0,0],(W+e*F+o)*8)}const Oe=[];for(const e of[...ze.slice(0,3).map(o=>rt(oe,H,o[0])),rt(Y.rows,Y.cols,fr)])for(const o of e)Oe.push(o);const ho=rt(F,F,dr,!1),qe=[],Vt=20,Ze=40;for(let e=0;e<Vt;e++)for(let o=0;o<Ze;o++){const a=(i,n)=>Math.round(i/Vt*(oe-1))*H+Math.round(n%Ze/Ze*H)%H;qe.push(a(e,o),a(e+1,o),a(e,o+1),a(e,o+1),a(e+1,o),a(e+1,o+1))}const _e=(e,o)=>{const a=d.createBuffer({size:e.byteLength,usage:o|GPUBufferUsage.COPY_DST});return d.queue.writeBuffer(a,0,e),a},Ce=_e(De,GPUBufferUsage.STORAGE),Yt=_e(new Uint32Array(Oe),GPUBufferUsage.INDEX),ur=_e(new Uint32Array(ho),GPUBufferUsage.INDEX),jt=_e(new Uint32Array(qe),GPUBufferUsage.INDEX),wt=()=>d.createBuffer({size:se*16,usage:GPUBufferUsage.STORAGE}),xt=wt(),bt=wt(),Mt=wt(),Re=[0,1].map(()=>d.createBuffer({size:se*32,usage:GPUBufferUsage.STORAGE}));let q=so({colors:[[1,1,1],[1,1,1],[1,1,1]]});const po=d.createBuffer({size:q.kernelData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),mo=d.createBuffer({size:q.poolData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),go=d.createBuffer({size:q.dropData.byteLength,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST}),zt=new ArrayBuffer(224),me=new Float32Array(zt),hr=new Uint32Array(zt);hr.set(ze.flat(),28);const Fe=d.createBuffer({size:224,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),pr=d.createShaderModule({code:eo}),kt=e=>d.createComputePipeline({layout:"auto",compute:{module:pr,entryPoint:e}}),Pt=kt("deform"),vo=kt("normals"),St=kt("stain"),mr=[0,1].map(e=>d.createBindGroup({layout:Pt.getBindGroupLayout(1),entries:[{binding:1,resource:{buffer:Re[e]}}]})),gr=d.createBindGroup({layout:Pt.getBindGroupLayout(0),entries:[Fe,Ce,po,mo,xt,bt,Mt].map((e,o)=>({binding:o,resource:{buffer:e}})).filter(e=>e.binding!==5)}),vr=[0,1].map(e=>d.createBindGroup({layout:St.getBindGroupLayout(1),entries:[Mt,Re[e],Re[1-e]].map((o,a)=>({binding:a,resource:{buffer:o}}))})),yr=d.createBindGroup({layout:St.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:Ce}}]});let re=0,Ue=2;const wr=d.createBindGroup({layout:vo.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:Fe}},{binding:1,resource:{buffer:Ce}},{binding:4,resource:{buffer:xt}},{binding:5,resource:{buffer:bt}}]}),lt=d.createShaderModule({code:io}),Bt=d.createBuffer({size:720,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ct=1536,yo=d.createTexture({size:[ct,ct],format:"depth32float",usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),xr=d.createSampler({compare:"less",magFilter:"linear",minFilter:"linear"}),wo=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX|GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:1,visibility:GPUShaderStage.FRAGMENT,texture:{sampleType:"depth"}},{binding:2,visibility:GPUShaderStage.FRAGMENT,sampler:{type:"comparison"}}]}),xo=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.VERTEX,buffer:{type:"uniform"}}]}),Gt=d.createBindGroupLayout({entries:[0,1,2,3,4,5].map(e=>({binding:e,visibility:GPUShaderStage.VERTEX,buffer:{type:"read-only-storage"}}))}),br=d.createBindGroup({layout:wo,entries:[{binding:0,resource:{buffer:Bt}},{binding:1,resource:yo.createView()},{binding:2,resource:xr}]}),Mr=d.createBindGroup({layout:xo,entries:[{binding:0,resource:{buffer:Bt}}]}),Wt=[0,1].map(e=>d.createBindGroup({layout:Gt,entries:[Ce,xt,bt,Mt,go,Re[1-e]].map((o,a)=>({binding:a,resource:{buffer:o}}))})),zr=d.createPipelineLayout({bindGroupLayouts:[wo,Gt]}),ft=4,X="rgba16float",Ie=(e,o,a={})=>d.createRenderPipeline({layout:zr,vertex:{module:lt,entryPoint:e},fragment:{module:lt,entryPoint:o,targets:[a.blend?{format:X,blend:a.blend}:{format:X}]},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth32float",depthWriteEnabled:a.depthWrite??!0,depthCompare:a.compare??"less"},multisample:{count:ft}}),kr=Ie("quadVs","roomFs",{depthWrite:!1,compare:"always"}),Pr=Ie("bodyVs","bodyFs"),Sr=Ie("dropVs","dropFs"),Br={color:{srcFactor:"src-alpha",dstFactor:"one-minus-src-alpha"},alpha:{srcFactor:"one",dstFactor:"zero"}},Gr=Ie("poolVs","poolFs",{blend:Br}),Tr=d.createPipelineLayout({bindGroupLayouts:[xo,Gt]}),bo=e=>d.createRenderPipeline({layout:Tr,vertex:{module:lt,entryPoint:e},primitive:{topology:"triangle-list",cullMode:"none"},depthStencil:{format:"depth32float",depthWriteEnabled:!0,depthCompare:"less",depthBias:2,depthBiasSlopeScale:2}}),Ur=bo("shadowVs"),Or=bo("dropShadowVs"),$t=d.createShaderModule({code:no}),Xt=d.createSampler({magFilter:"linear",minFilter:"linear",addressModeU:"clamp-to-edge",addressModeV:"clamp-to-edge"}),dt=d.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:1,visibility:GPUShaderStage.FRAGMENT,sampler:{}},{binding:2,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}},{binding:3,visibility:GPUShaderStage.FRAGMENT,texture:{}},{binding:4,visibility:GPUShaderStage.FRAGMENT,buffer:{type:"uniform"}}]}),Le=(e,o,a)=>d.createRenderPipeline({layout:d.createPipelineLayout({bindGroupLayouts:[dt]}),vertex:{module:$t,entryPoint:"quadVs"},fragment:{module:$t,entryPoint:e,targets:[a?{format:o,blend:a}:{format:o}]}}),qr={color:{srcFactor:"one",dstFactor:"one"},alpha:{srcFactor:"one",dstFactor:"zero"}},Rr=Le("brightFs",X),Ar=Le("downFs",X),Er=Le("upFs",X,qr),Dr=Le("finishFs",fo),Mo=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST}),ye=new Float32Array(4),Je=4;let ut,ht,ge,A=[],ve=[],zo,_=0,C=0,we=j?1:Math.min(devicePixelRatio,1.25);function Tt(){_=j?he:Math.max(1,Math.floor(innerWidth*we)),C=j?pe:Math.max(1,Math.floor(innerHeight*we)),ie.width=_,ie.height=C,ut?.destroy(),ht?.destroy(),ge?.destroy(),A.forEach(i=>i.destroy()),ut=d.createTexture({size:[_,C],format:X,sampleCount:ft,usage:GPUTextureUsage.RENDER_ATTACHMENT}),ht=d.createTexture({size:[_,C],format:"depth32float",sampleCount:ft,usage:GPUTextureUsage.RENDER_ATTACHMENT}),ge=d.createTexture({size:[_,C],format:X,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}),A=Array.from({length:Je},(i,n)=>d.createTexture({size:[Math.max(_>>n+1,1),Math.max(C>>n+1,1)],format:X,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.TEXTURE_BINDING}));const e=(i,n)=>{const c=d.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});return d.queue.writeBuffer(c,0,new Float32Array([1/i,1/n,0,0])),c},o=(i,n,c,f)=>d.createBindGroup({layout:dt,entries:[{binding:0,resource:i.createView()},{binding:1,resource:Xt},{binding:2,resource:{buffer:f??e(n,c)}},{binding:3,resource:A[0].createView()},{binding:4,resource:{buffer:st.buffer}}]});Qt??=d.createTexture({size:[1,1],format:X,usage:GPUTextureUsage.TEXTURE_BINDING});const a=(i,n,c)=>d.createBindGroup({layout:dt,entries:[{binding:0,resource:i.createView()},{binding:1,resource:Xt},{binding:2,resource:{buffer:e(n,c)}},{binding:3,resource:Qt.createView()},{binding:4,resource:{buffer:st.buffer}}]});ve=[],ve.push({pipeline:Rr,group:a(ge,_,C),target:A[0],clear:!0});for(let i=1;i<Je;i++)ve.push({pipeline:Ar,group:a(A[i-1],A[i-1].width,A[i-1].height),target:A[i],clear:!0});for(let i=Je-1;i>0;i--)ve.push({pipeline:Er,group:a(A[i],A[i].width,A[i].height),target:A[i-1],clear:!1});zo=o(ge,_,C,Mo),ye[0]=1/_,ye[1]=1/C,ye[2]=.06,P.aspect=_/C,j||P.position.sub(R.target).setLength(_r*Math.max(1,.82/P.aspect)).add(R.target),P.updateProjectionMatrix()}const P=new _o(24,1,1,60);P.coordinateSystem=Jt;const _r=16.5;P.position.set(3.2,4.6,15);const R=new Do(P,ie);R.target.set(0,2.82,0);R.enableDamping=!0;R.enablePan=!1;R.minDistance=5;R.maxDistance=28;R.maxPolarAngle=Math.PI*.49;R.autoRotate=!0;R.addEventListener("start",()=>{R.autoRotate=!1,document.querySelector("#hint").style.opacity=0});const xe=new Kt(-.56,.66,.5).normalize(),K={amount:1,falloff:0,turn:200,warmth:.3,strength:1.75},ee=new Co(-6,6,6,-6,1,32);ee.coordinateSystem=Jt;const ko=new vt;let Ae=null;function be(){xe.set(...jo(T,124,Ae,K)).normalize(),ee.position.copy(xe).multiplyScalar(15).add(new Kt(0,3,0)),ee.lookAt(0,3,0),ee.updateProjectionMatrix(),ee.updateMatrixWorld(),ko.multiplyMatrices(ee.projectionMatrix,ee.matrixWorldInverse)}const Ke=new vt,Ht=new vt;let Qt,Ee="Sorbet";const T=new Float32Array(180);be();function pt(e,{random:o=Math.random,pre:a=18,preSpeed:i=1}={}){Ee=e;const n=Me[e],c=n.flavors.map(Qe);q=so({colors:c,random:o}),q.prewarm(a,i),Ue=2,me.set([...c[0],0],52),T[107]=n.syrup,c.forEach((f,p)=>T.set([f[0],f[1],f[2],n.bits[p]],80+p*4)),T.set([...Qe(n.sky),1],92),T.set([...Qe(n.ground),1],96),document.body.style.background=n.sky}let Po;function mt(e){Po=e,uo[e].forEach((o,a)=>T.set([...o,1],108+a*4))}document.querySelector("#random")?.addEventListener("click",()=>{const e=Object.keys(Me).flatMap(i=>Object.keys(uo).map(n=>[i,n])).filter(([i,n])=>i!==Ee||n!==Po),[o,a]=e[Math.floor(Math.random()*e.length)];o!==Ee&&pt(o),mt(a)});const Cr=Eo($,e=>{Ae=e,be()});function Fr(){return Lo(()=>({Studio:Cr,speed:{value:it.speed,min:0,max:5,step:.05,label:"melt speed",onChange:e=>{it.speed=e}},"hdr light":{value:K.amount,min:0,max:1,step:.01,onChange:e=>{K.amount=e,be()}},"hdr strength":{value:K.strength,min:.4,max:3,step:.01,onChange:e=>{K.strength=e,be()}},"hdr warmth":{value:K.warmth,min:-1,max:2,step:.01,onChange:e=>{K.warmth=e,be()}},...st.controls()})),null}j||Fo.createRoot(document.querySelector("#controls")).render(Be.createElement(Be.Fragment,null,Be.createElement(Io,{collapsed:!0,titleBar:{title:"Controls"}}),Be.createElement(Fr)));const Ir=ho.length;function Lr(e){P.updateMatrixWorld(),Ke.multiplyMatrices(P.projectionMatrix,P.matrixWorldInverse),Ht.copy(Ke).invert(),T.set(Ke.elements,0),T.set(ko.elements,16),T.set(Ht.elements,32),T.set([P.position.x,P.position.y,P.position.z,e],48),T.set([xe.x,xe.y,xe.z,ct/(Ae?Math.sqrt(Ae.soft/4):1)],52),q.scoops.forEach((o,a)=>{T.set([o.cx,o.cy,o.cz,o.r,o.sx,o.sy,o.sx,o.melt],56+a*8),me.set([o.cx,o.cy,o.cz,o.r,o.sx,o.sy,o.sx,o.melt],a*8)}),T.set([_,C],100),d.queue.writeBuffer(Bt,0,T),me[48]=e,me[49]=ot,me[50]=Ue>0?1:0,Ue>0&&Ue--,d.queue.writeBuffer(Fe,0,zt),d.queue.writeBuffer(po,0,q.kernelData),d.queue.writeBuffer(mo,0,q.poolData),d.queue.writeBuffer(go,0,q.dropData)}let gt=performance.now(),et=0,tt=gt,Zt=!1,Ge=0;function So(e){Lr(e);const o=d.createCommandEncoder();re=1-re;const a=o.beginComputePass();a.setPipeline(Pt),a.setBindGroup(0,gr),a.setBindGroup(1,mr[re]),a.dispatchWorkgroups(Math.ceil(se/128)),a.setPipeline(vo),a.setBindGroup(0,wr),a.dispatchWorkgroups(Math.ceil(se/128)),a.setPipeline(St),a.setBindGroup(0,yr),a.setBindGroup(1,vr[re]),a.dispatchWorkgroups(Math.ceil(se/128)),a.end();const i=q.dropCount();if(Zt=!Zt){const f=o.beginRenderPass({colorAttachments:[],depthStencilAttachment:{view:yo.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"store"}});f.setPipeline(Ur),f.setBindGroup(0,Mr),f.setBindGroup(1,Wt[re]),f.setIndexBuffer(Yt,"uint32"),f.drawIndexed(Oe.length),i&&(f.setPipeline(Or),f.setIndexBuffer(jt,"uint32"),f.drawIndexed(qe.length,i)),f.end()}const n=o.beginRenderPass({colorAttachments:[{view:ut.createView(),resolveTarget:ge.createView(),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"discard"}],depthStencilAttachment:{view:ht.createView(),depthClearValue:1,depthLoadOp:"clear",depthStoreOp:"discard"}});n.setBindGroup(0,br),n.setBindGroup(1,Wt[re]),n.setPipeline(kr),n.draw(3),n.setPipeline(Gr),n.setIndexBuffer(ur,"uint32"),n.drawIndexed(Ir),n.setPipeline(Pr),n.setIndexBuffer(Yt,"uint32"),n.drawIndexed(Oe.length),i&&(n.setPipeline(Sr),n.setIndexBuffer(jt,"uint32"),n.drawIndexed(qe.length,i)),n.end();for(const f of ve){const p=o.beginRenderPass({colorAttachments:[{view:f.target.createView(),clearValue:[0,0,0,1],loadOp:f.clear?"clear":"load",storeOp:"store"}]});p.setPipeline(f.pipeline),p.setBindGroup(0,f.group),p.draw(3),p.end()}ye[3]=e,d.queue.writeBuffer(Mo,0,ye);const c=o.beginRenderPass({colorAttachments:[{view:co.getCurrentTexture().createView(),clearValue:[0,0,0,1],loadOp:"clear",storeOp:"store"}]});c.setPipeline(Dr),c.setBindGroup(0,zo),c.draw(3),c.end(),d.queue.submit([o.finish()])}function Bo(e){const o=Math.min((e-gt)/1e3,.05);if(gt=e,q.step(o,{speed:it.speed*(1+Me[Ee].syrup*.5)}),R.autoRotateSpeed=.4*Math.cos(e*12e-5),R.update(o),So(e/1e3),et++,e-tt>1e3){const a=et*1e3/(e-tt);et=0,tt=e,Ge=a<40&&!document.hidden&&e>6e3?Ge+1:0,Ge>=4&&we>.72&&(we=Math.max(we*.88,.72),Ge=0,Tt())}requestAnimationFrame(Bo)}Tt();if(!j)addEventListener("resize",Tt),pt("Sorbet"),mt("Waffle"),at.remove(),requestAnimationFrame(Bo);else{at.remove(),ie.style.cssText=`position:fixed;left:0;top:0;width:${he}px;height:${pe}px`;const e=sr[+$.get("shot")],o=+($.get("every")??1),a=+$.get("fps"),i=+$.get("frames"),n=$.get("port");P.near=.05,mt("Waffle"),pt(e.set,{random:rr(e.seed),pre:e.pre,preSpeed:e.preSpeed});const c=document.createElement("canvas");c.width=he,c.height=pe;const f=c.getContext("2d"),p=e.speed*(1+Me[e.set].syrup*.5);let x=0,g=e.timeScale;window.__frame=async(h,y=!0)=>{for(;y&&x<h;){const S=e.hangScale&&!q.drops.some(B=>B.age<.9)?e.hangScale:e.timeScale;g+=(S-g)*.1,q.step(g/a,{speed:p}),x++}const z=h/a,k=nr(e,z/(i/a),z,he/pe);return P.fov=k.fov,P.aspect=he/pe,P.position.set(...k.position),P.up.set(0,1,0),P.lookAt(...k.target),P.updateProjectionMatrix(),So(z+e.clockOffset),f.drawImage(ie,0,0),new Promise(S=>c.toBlob(S,"image/png"))},window.__ready=!0;const M=h=>n&&fetch(`http://localhost:${n}/log?m=${encodeURIComponent(h)}`).catch(()=>{});if(addEventListener("error",h=>M(`error ${h.message}`)),addEventListener("unhandledrejection",h=>M(`rejection ${h.reason}`)),d.lost.then(h=>M(`DEVICE LOST ${h.reason} ${h.message}`)),n){for(let h=0;h<3;h++)await window.__frame(0,!1);for(let h=0;h<i;h++){const y=await window.__frame(h);if(h%o)continue;const z=await y.arrayBuffer();for(let k=0;;k++)try{await fetch(`http://localhost:${n}/frame?i=${h/o}`,{method:"POST",headers:{"content-type":"text/plain"},body:z});break}catch(S){if(k>20)throw S;await new Promise(B=>setTimeout(B,100+k*100))}}await fetch(`http://localhost:${n}/done`)}}
