import "../lib/modulepreload-polyfill.js";
import { s as qo } from "../lib/studio-presets.js";
import "../lib/three.js";
import { O as Ao } from "../lib/OrbitControls.js";
import {
  P as Co,
  aG as Jt,
  V as Kt,
  a4 as _o,
  p as vt,
  c as Io,
  r as Oe,
  L as Lo,
  u as Fo,
  C as No,
} from "../lib/leva.js";
import { p as Vo, a as Yo, w as jo } from "../lib/studio-light.js";
import { c as Wo, l as Ho } from "../lib/look.js";
const eo = `// Every frame: rest shape + how melted it is + every nearby bead of liquid = where each vertex is now.
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
`,
  Xo = `diagnostic(off, derivative_uniformity);
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
`,
  b = { tipY: 0.5, rimY: 2.75, rimR: 0.8 },
  to = [
    {
      y: 3.2,
      r: 0.9,
      seed: 1.3,
      axis: [0.3, 0.2, 0.93],
      ox: 0.025,
      oz: -0.02,
      lx: -0.03,
      lz: 0.03,
    },
    {
      y: 4.22,
      r: 0.76,
      seed: 7.9,
      axis: [-0.7, 0.1, 0.7],
      ox: -0.075,
      oz: 0.05,
      lx: 0.09,
      lz: 0.05,
    },
    {
      y: 5.02,
      r: 0.62,
      seed: 4.2,
      axis: [0.8, 0.3, 0.5],
      ox: 0.06,
      oz: 0.06,
      lx: -0.2,
      lz: 0.08,
    },
  ],
  oe = 124,
  $ = 248,
  oo = 130,
  no = 260,
  I = 170,
  ot = 2.3,
  ro = (e) => e - Math.floor(e),
  Q = (e, o, r) => ro(Math.sin(e * 127.1 + o * 311.7 + r * 74.7) * 43758.5453),
  Ge = (e) => e * e * (3 - 2 * e),
  re = (e, o, r) => Ge(Math.min(Math.max((r - e) / (o - e), 0), 1));
function $o(e, o, r) {
  const s = Math.floor(e),
    i = Math.floor(o),
    c = Math.floor(r),
    f = Ge(e - s),
    p = Ge(o - i),
    x = Ge(r - c),
    g = (M, h, y) => M + (h - M) * y;
  return g(
    g(
      g(Q(s, i, c), Q(s + 1, i, c), f),
      g(Q(s, i + 1, c), Q(s + 1, i + 1, c), f),
      p,
    ),
    g(
      g(Q(s, i, c + 1), Q(s + 1, i, c + 1), f),
      g(Q(s, i + 1, c + 1), Q(s + 1, i + 1, c + 1), f),
      p,
    ),
    x,
  );
}
function te(e, o, r, s = 4) {
  let i = 0,
    c = 0.5,
    f = 0;
  for (let p = 0; p < s; p++)
    ((i += $o(e, o, r) * c),
      (f += c),
      (c *= 0.5),
      (e = e * 2.03 + 11.1),
      (o = o * 2.03 + 3.7),
      (r = r * 2.03 + 7.3));
  return i / f;
}
function Qo(e, o, r, { seed: s, axis: i }) {
  const [c, f, p] = i,
    x = e * c + o * f + r * p,
    g = e - c * x,
    M = o - f * x,
    h = r - p * x,
    y = te(g * 2 + s, x * 13 + s, h * 2 - M * 2, 3) - 0.5,
    S = te(e * 2.3 + s, o * 2.3, r * 2.3 - s, 3) - 0.5,
    z = te(e * 5 + s, o * 9, r * 5, 3) - 0.5,
    k = (te(e * 2.2 - s, 0, r * 2.2, 2) - 0.5) * 0.22,
    O = Math.exp(-(((o + 0.46 + k) / 0.11) ** 2)),
    L = re(-0.5, -0.8, o + k);
  return (
    O * (0.085 + z * 0.2) +
    y * 0.05 * re(-0.5, -0.1, o) +
    S * 0.1 -
    L * 0.08 +
    z * 0.02
  );
}
const Zo = b.rimR / Math.hypot(b.rimR, b.rimY - b.tipY),
  Jo = (b.rimY - b.tipY) / Math.hypot(b.rimR, b.rimY - b.tipY);
function Ko(e, o) {
  const r = (o - b.tipY) / Jo,
    s = e * Zo,
    i = r * Math.sin(s),
    c = r * Math.cos(s),
    f = (i + c) / 0.27,
    p = (i - c) / 0.27,
    x = (g) => Math.abs(ro(g) - 0.5) * 2;
  return re(0.72, 0.92, Math.max(x(f), x(p)));
}
function en() {
  const { tipY: e, rimY: o, rimR: r } = b,
    s = o - e,
    i = [],
    c = [],
    f = oo,
    p = no,
    x = 14;
  for (let g = 0; g <= f; g++) {
    const M = g > f - x,
      h = M ? (f - g) / x : g / (f - x);
    for (let y = 0; y < p; y++) {
      const S = (y / p) * Math.PI * 2 - Math.PI,
        z = Math.sin(S),
        k = Math.cos(S);
      let O, L;
      if (M) {
        const le = (te(z * 2.5, 1.5, k * 2.5, 3) - 0.5) * 0.13;
        ((O = o + le - (1 - h) * 0.36), (L = r * (1 - (1 - h) * 0.15) - 0.038));
      } else {
        ((O = e + s * h), (L = r * Math.sqrt(h * h + 9e-4) * (h < 1, 1)));
        const le = Ko(S, O),
          q = re(Math.PI - 0.1, Math.PI - 0.04, Math.abs(S)) * 0.012;
        ((L +=
          (le * 0.016 + q + (te(z * 3, O * 3, k * 3, 2) - 0.5) * 0.01) *
          re(0, 0.12, h)),
          (O += (te(z * 2.5, 1.5, k * 2.5, 3) - 0.5) * 0.13 * re(0.92, 1, h)));
      }
      i.push(z * L, O, k * L);
      const ie = Math.hypot(s, r);
      c.push((z * s) / ie, -r / ie, (k * s) / ie);
    }
  }
  return { positions: i, normals: c, rows: f + 1, cols: p };
}
function tn(e) {
  const o = [],
    r = [];
  for (let s = 0; s < oe; s++) {
    const i = (s / (oe - 1)) * Math.PI,
      c = Math.cos(i),
      f = Math.sin(i);
    for (let p = 0; p < $; p++) {
      const x = (p / $) * Math.PI * 2,
        g = f * Math.sin(x),
        M = f * Math.cos(x);
      (o.push(g, c, M), r.push(Qo(g, c, M, e) * e.r));
    }
  }
  return { dirs: o, details: r, rows: oe, cols: $ };
}
function nt(e, o, r, s = !0) {
  const i = [];
  for (let c = 0; c < e - 1; c++)
    for (let f = 0; f < (s ? o : o - 1); f++) {
      const p = s ? (f + 1) % o : f + 1,
        x = r + c * o + f,
        g = r + c * o + p,
        M = r + (c + 1) * o + f,
        h = r + (c + 1) * o + p;
      i.push(x, M, g, g, M, h);
    }
  return i;
}
const $e = 110,
  _t = 36,
  fe = 28,
  de = 12,
  It = 11,
  Lt = 5,
  Ft = 16,
  on = (e, o, r) => {
    const s = Math.min(Math.max((r - e) / (o - e), 0), 1);
    return s * s * (3 - 2 * s);
  };
function ao({ colors: e, random: o = Math.random }) {
  const r = to.map((n, a) => ({
    ...n,
    id: a,
    base: n.y,
    melt: 0,
    sx: 1,
    sy: 1,
    cx: n.ox,
    cy: n.y,
    cz: n.oz,
  }));
  let s = [],
    i = [],
    c = [],
    f = 0,
    p = 0,
    x = 0;
  const g = new Float32Array($e * Ft),
    M = new Float32Array(_t * 8),
    h = new Float32Array(fe * 2 * de);
  let y = { volume: 0, color: [1, 1, 1], releasedAt: -1e9 },
    S = [],
    z = 0,
    k = 1.2,
    O = 0;
  function L(n, a, l, t) {
    const u = t.r * t.sx,
      m = t.r * t.sy,
      v = n - t.cx,
      w = a - t.cy,
      T = l - t.cz,
      Z = Math.hypot(v / u, w / m, T / u),
      F = Math.hypot(v / (u * u), w / (m * m), T / (u * u));
    return F > 1e-6 ? (Z * (Z - 1)) / F : -u;
  }
  function ie(n, a, l) {
    const t = b.rimY - b.tipY,
      u = Math.hypot(n, l),
      m = Math.hypot(t, b.rimR),
      v = (u * t - (a - b.tipY) * b.rimR) / m;
    return Math.max(v, b.tipY - a, a - b.rimY - 0.05);
  }
  const le = (n, a, l) => {
    const t = Math.max(l - Math.abs(n - a), 0) / l;
    return Math.min(n, a) - t * t * l * 0.25;
  };
  function q(n, a, l) {
    let t = ie(n, a, l);
    for (const u of r) t = le(t, L(n, a, l, u), 0.1);
    return t;
  }
  const Se = [0, 0, 0];
  function Ne(n, a, l) {
    const u = q(n + 0.01, a, l) - q(n - 0.01, a, l),
      m = q(n, a + 0.01, l) - q(n, a - 0.01, l),
      v = q(n, a, l + 0.01) - q(n, a, l - 0.01),
      w = Math.hypot(u, m, v) || 1;
    return ((Se[0] = u / w), (Se[1] = m / w), (Se[2] = v / w), Se);
  }
  const Bo = 0.1,
    Tt = 16e-5,
    Rt = 34e-5,
    Et = () => Tt + o() * (Rt - Tt);
  let Pe = Et();
  const Ve = (n) => Math.max(Math.cbrt(n * 0.239) * 1.35, 0.012),
    Ye = (n) => Math.min((0.62 * n * n) / (n + 0.05), 0.1),
    Go = (n) => Ye(n) * Math.PI * n * n * 0.4,
    ke = (n) => {
      let a = Math.sqrt(n / 0.1);
      for (let l = 0; l < 10; l++)
        a = Math.min(
          Math.max(a * Math.pow(n / Math.max(Go(a), 1e-9), 0.3), 0.004),
          0.6,
        );
      return a;
    };
  function Ut(n, a, l, t, u, m = "run") {
    const v = Ne(n, a, l),
      w = q(n, a, l),
      T = {
        x: n - v[0] * w,
        y: a - v[1] * w,
        z: l - v[2] * w,
        volume: t,
        grown: 0,
        color: [...u],
        dir: [0, -1, 0],
        speed: 0,
        stretch: 1,
        hang: 0,
        kind: m,
        age: 0,
        trailed: 0,
        life: 1 / 0,
        seed: o() * 6.28,
      };
    return (s.push(T), T);
  }
  const Dt = (n, a) =>
    Math.pow(
      0.5 + 0.5 * Math.sin(n * 5 + a * 2.1) * Math.sin(n * 3 + a * 4.3 + 1),
      1.5,
    );
  function To() {
    const n = r[Math.floor(o() * r.length)];
    if (n.melt < 0.02) return;
    if (o() < 0.2) {
      const w = r[0],
        T = o() * Math.PI * 2;
      Ut(
        w.cx + Math.sin(T) * w.r * w.sx * 0.92,
        w.cy - w.r * w.sy * 0.42,
        w.cz + Math.cos(T) * w.r * w.sx * 0.92,
        7e-4 + o() * 0.0012,
        e[0],
      );
      return;
    }
    let a = o() * Math.PI * 2;
    for (let w = 0; w < 6 && Dt(a, n.id) < 0.55; w++) a = o() * Math.PI * 2;
    const l = -0.5 - o() * 0.15 * n.melt - Dt(a, n.id) * n.melt * 0.3,
      t = Math.sqrt(Math.max(1 - l * l, 0.02)),
      u = n.cx + Math.sin(a) * t * n.r * n.sx,
      m = n.cy + l * n.r * n.sy,
      v = n.cz + Math.cos(a) * t * n.r * n.sx;
    Ut(u, m, v, 6e-4 + o() * 0.0015 * (0.4 + n.melt), e[n.id]);
  }
  function qt(n, { speed: a }) {
    ((f += n),
      r.forEach((l, t) => {
        ((l.melt = Math.min(
          l.melt + n * a * (0.0018 + t * 35e-5) * (1 - l.melt * 0.72),
          1,
        )),
          (l.sy = 1 - 0.15 * l.melt),
          (l.sx = Math.cbrt(1 / l.sy) * (1 + 0.03 * l.melt)),
          (l.cx = l.ox + l.lx * l.melt),
          (l.cz = l.oz + l.lz * l.melt));
      }),
      (r[0].cy = b.rimY + (r[0].base - b.rimY) * (r[0].sy * 0.85 + 0.15)));
    for (let l = 1; l < r.length; l++) {
      const t = r[l - 1],
        u = r[l],
        m = (u.base - r[l - 1].base) * (0.5 * (t.sy + u.sy));
      u.cy = t.cy + m;
    }
    ((p -= n * a), p <= 0 && s.length < $e - 6 && (To(), (p = 1.3 + o() * 2)));
    for (let l = s.length - 1; l >= 0; l--) {
      const t = s[l];
      ((t.age += n), (t.grown = Math.min(t.grown + n * 0.35, 1)));
      const u = ke(t.volume),
        m = Ye(u),
        v = Ne(t.x, t.y, t.z),
        w = v[0] * v[1],
        T = v[1] * v[1] - 1,
        Z = v[2] * v[1],
        F = Math.hypot(w, T, Z),
        je = a * (0.025 + 34 * m * m) * F,
        We = Math.min(je, 0.32);
      if (((t.speed += (We - t.speed) * Math.min(n * 3, 1)), F > 0.001)) {
        const B = w / F,
          J = T / F,
          R = Z / F;
        ((t.dir[0] += (B - t.dir[0]) * Math.min(n * 4, 1)),
          (t.dir[1] += (J - t.dir[1]) * Math.min(n * 4, 1)),
          (t.dir[2] += (R - t.dir[2]) * Math.min(n * 4, 1)));
        const Xe = Math.hypot(...t.dir) || 1;
        ((t.dir[0] /= Xe), (t.dir[1] /= Xe), (t.dir[2] /= Xe));
      }
      const A = Math.sin(t.y * 9 + t.x * 5 + t.seed) * 0.35,
        N = Math.hypot(t.dir[2], t.dir[0]) > 0.001 ? 1 : 0;
      ((t.x += t.dir[2] * A * N * t.speed * n),
        (t.z +=
          (-t.dir[0] * A * N + Math.cos(t.y * 7 + t.seed) * 0.2 * N) *
          t.speed *
          n),
        (t.x += t.dir[0] * t.speed * n),
        (t.y += t.dir[1] * t.speed * n),
        (t.z += t.dir[2] * t.speed * n));
      const ce = q(t.x, t.y, t.z),
        V = Ne(t.x, t.y, t.z);
      ((t.x -= V[0] * ce),
        (t.y -= V[1] * ce),
        (t.z -= V[2] * ce),
        (t.stretch +=
          (1 + Math.min(t.speed * 7, 1.1) - t.stretch) * Math.min(n * 3, 1)));
      for (const B of r)
        if (Math.abs(L(t.x, t.y, t.z, B)) < 0.06) {
          const J = Math.min(n * 0.09 * (0.3 + B.melt), 1);
          for (let R = 0; R < 3; R++)
            t.color[R] += (e[B.id][R] - t.color[R]) * J;
        }
      if (((t.volume *= Math.exp(-t.speed * n * 0.42)), t.y < b.tipY + 0.24)) {
        const B = Math.min(
            Math.min(n * 1.6, 1) * t.volume,
            Math.max(Pe * 1.02 - y.volume, 0),
          ),
          J = B / (y.volume + B + 1e-9);
        for (let R = 0; R < 3; R++) y.color[R] += (t.color[R] - y.color[R]) * J;
        if (((y.volume += B), (t.volume -= B), t.volume < 12e-5)) {
          s.splice(l, 1);
          continue;
        }
      }
      const Do = on(0.15, 0.7, -V[1]),
        He = r[0];
      if (
        Do > 0.5 &&
        t.volume > 0.0028 &&
        t.y > b.rimY - 0.1 &&
        t.y < He.cy - He.r * He.sy * 0.2 &&
        Math.hypot(t.x, t.z) > b.rimR + 0.06
      ) {
        if (
          ((t.hang += n * a * (0.25 + u * 3)),
          t.hang > 1.1 && O > 3 && i.length < fe - 1)
        ) {
          const B = Math.min(t.volume * 0.5, Rt);
          ((t.volume -= B), (t.hang = 0.15), (O = 0));
          const J = Ve(B);
          (i.push({
            x: t.x,
            y: t.y - u * 0.9,
            z: t.z,
            vy: -0.1,
            r: J,
            age: 0,
            volume: B * Lt,
            color: [...t.color],
            anchorX: t.x,
            anchorY: t.y,
            anchorZ: t.z,
          }),
            x++);
        }
      } else t.hang = Math.max(t.hang - n * 0.5, 0);
      if (t.volume < 12e-5) {
        s.splice(l, 1);
        continue;
      }
    }
    for (let l = 0; l < s.length; l++) {
      const t = s[l];
      if (t.volume <= 0) continue;
      const u = ke(t.volume);
      for (let m = l + 1; m < s.length; m++) {
        const v = s[m];
        if (v.volume <= 0 || t.volume <= 0) continue;
        const w = ke(v.volume),
          T = v.x - t.x,
          Z = v.y - t.y,
          F = v.z - t.z,
          je = Math.hypot(T, Z, F),
          We = (u + w) * 0.62;
        if (je < We) {
          const A = t.volume >= v.volume ? t : v,
            N = A === t ? v : t,
            ce = N.volume / (A.volume + N.volume);
          for (let V = 0; V < 3; V++)
            A.color[V] += (N.color[V] - A.color[V]) * ce;
          ((A.volume = Math.min(A.volume + N.volume, 0.006)),
            (A.hang = Math.max(A.hang, N.hang)),
            (N.volume = 0));
        }
      }
    }
    if (
      ((s = s.filter((l) => l.volume > 0)),
      (z += n),
      (O += n),
      y.volume >= Pe && z > k && i.length < fe - 1)
    ) {
      const l = y.volume * 0.86;
      ((y.volume -= l),
        (y.releasedAt = f),
        (z = 0),
        (k = 1.1 + o() * 2.2),
        (Pe = Et()));
      const t = Ve(l);
      (i.push({
        x: 0,
        y: b.tipY - t * 1.5,
        z: 0,
        vy: -0.05,
        r: t,
        age: 0,
        volume: l * Lt,
        color: [...y.color],
        anchorX: 0,
        anchorY: b.tipY,
        anchorZ: 0,
      }),
        x++);
    }
    for (let l = i.length - 1; l >= 0; l--) {
      const t = i[l];
      ((t.age += n),
        (t.vy -= It * n),
        (t.y += t.vy * n),
        t.y < t.r * 0.5 && (Ro(t), i.splice(l, 1)));
    }
    for (let l = S.length - 1; l >= 0; l--) {
      const t = S[l];
      ((t.vy -= It * n),
        (t.x += t.vx * n),
        (t.y += t.vy * n),
        (t.z += t.vz * n),
        t.y < t.r && t.vy < 0 && S.splice(l, 1));
    }
    At();
  }
  function Ro(n) {
    let a = null,
      l = 0.4;
    for (const u of c) {
      const m = Math.hypot(u.x - n.x, u.z - n.z);
      Math.hypot(
        u.color[0] - n.color[0],
        u.color[1] - n.color[1],
        u.color[2] - n.color[2],
      ) < 0.12 &&
        m < l + u.r * 0.45 &&
        ((a = u), (l = m));
    }
    if (!a)
      (c.length >= _t && c.shift(),
        (a = {
          x: n.x + (o() - 0.5) * 0.28,
          z: n.z + (o() - 0.5) * 0.28,
          volume: 0,
          r: 0.02,
          color: [...n.color],
        }),
        c.push(a));
    else {
      const u = n.volume / (a.volume + n.volume);
      for (let m = 0; m < 3; m++) a.color[m] += (n.color[m] - a.color[m]) * u;
    }
    ((a.volume += n.volume), (a.ripple = 1));
    const t = Math.min(-n.vy / 6, 1);
    for (
      let u = 0, m = 2 + Math.floor(o() * 3 * t);
      u < m && S.length < 12;
      u++
    ) {
      const v = o() * Math.PI * 2,
        w = (0.35 + o() * 0.5) * t;
      S.push({
        x: n.x,
        y: n.r * 0.5,
        z: n.z,
        vx: Math.cos(v) * w,
        vy: (0.7 + o() * 0.9) * t,
        vz: Math.sin(v) * w,
        r: 0.006 + o() * 0.008,
        color: [...n.color],
      });
    }
  }
  function At() {
    (g.fill(0),
      s.slice(-$e).forEach((a, l) => {
        const t = ke(a.volume),
          u = Math.min(t, Bo),
          m = Math.min(1 + (t / u - 1) * 1.6, 2.2);
        g.set(
          [
            a.x,
            a.y,
            a.z,
            u * (0.4 + 0.6 * a.grown),
            a.dir[0],
            a.dir[1],
            a.dir[2],
            a.stretch * m,
            a.color[0],
            a.color[1],
            a.color[2],
            Ye(u) * a.grown,
            Math.min(a.hang, 1.3),
            0,
            0,
            0,
          ],
          l * Ft,
        );
      }),
      M.fill(0),
      c.forEach((a, l) => {
        const t = Math.cbrt(a.volume) * 1.5 + 0.03;
        ((a.r += (t - a.r) * 0.012),
          (a.ripple = (a.ripple ?? 0) * 0.985),
          M.set(
            [
              a.x,
              a.z,
              a.r,
              Math.min(0.05, 0.016 + a.volume * 4),
              a.color[0],
              a.color[1],
              a.color[2],
              a.ripple,
            ],
            l * 8,
          ));
      }),
      h.fill(0));
    let n = 0;
    if (y.volume > 4e-5) {
      const a = f - y.releasedAt,
        l = Math.exp(-a * 8) * Math.cos(a * 34) * 0.3,
        t = Ve(y.volume),
        u = 1.1 + 0.5 * Math.min(y.volume / Pe, 1) + l;
      h.set(
        [0, b.tipY + 0.012 - t * u * 0.94, 0, t, u, ...y.color, 0.86, 0, 0, 0],
        n++ * de,
      );
    }
    for (const a of i) {
      const l = Math.max(1 - a.age / 0.14, 0),
        t = Math.exp(-a.age * 5) * Math.cos(a.age * 26) * 0.22,
        u = Math.min(-a.vy * 0.05, 0.3);
      if (
        (h.set(
          [
            a.x,
            a.y,
            a.z,
            a.r,
            1 + t + u,
            ...a.color,
            0.25 * (1 - Math.min(a.age * 3, 1)),
            0,
            0,
            0,
          ],
          n++ * de,
        ),
        l > 0)
      ) {
        const m = (a.anchorY + a.y) / 2,
          v = (a.anchorY - a.y) / 2,
          w = a.r * 0.14 * l + 0.002;
        h.set(
          [a.x, m, a.z, w, Math.max(v, 0.005) / w, ...a.color, 0, 0, 0, 0],
          n++ * de,
        );
      }
    }
    for (const a of S) {
      if (n >= fe * 2) break;
      h.set([a.x, a.y, a.z, a.r, 1.1, ...a.color, 0, 0, 0, 0], n++ * de);
    }
    Ct = n;
  }
  function Eo() {
    ((s = []),
      (i = []),
      (c = []),
      (S = []),
      (f = 0),
      (p = 0),
      (x = 0),
      (y = { volume: 0, color: [1, 1, 1], releasedAt: -1e9 }));
    for (const n of r)
      ((n.melt = 0),
        (n.sx = n.sy = 1),
        (n.cx = n.ox),
        (n.cy = n.base),
        (n.cz = n.oz));
  }
  function Uo(n, a) {
    for (let l = 0; l < n; l += 1 / 30) qt(1 / 30, { speed: a });
  }
  let Ct = 0;
  return (
    At(),
    {
      scoops: r,
      kernelData: g,
      poolData: M,
      dropData: h,
      step: qt,
      reset: Eo,
      prewarm: Uo,
      field: q,
      setColors(n) {
        e = n;
      },
      get beads() {
        return s;
      },
      get drops() {
        return i;
      },
      get pools() {
        return c;
      },
      get totalDrops() {
        return x;
      },
      get pendant() {
        return y;
      },
      dropCount: () => Math.min(Ct, fe * 2),
    }
  );
}
const nn = (e) => () => {
    ((e |= 0), (e = (e + 1831565813) | 0));
    let o = Math.imul(e ^ (e >>> 15), 1 | e);
    return (
      (o = (o + Math.imul(o ^ (o >>> 7), 61 | o)) ^ o),
      ((o ^ (o >>> 14)) >>> 0) / 4294967296
    );
  },
  rn = {
    Pistachio: {
      flavors: ["#a8cf62", "#f6e8c6", "#e42f62"],
      bits: [0.8, 0, 0.7],
      sky: "#efe7d8",
      ground: "#f6f0e4",
      syrup: 0.35,
    },
    Peach: {
      flavors: ["#f47f9c", "#fac648", "#f6e8c6"],
      bits: [1, 0, 0.4],
      sky: "#f4bfa6",
      ground: "#f8d2bd",
      syrup: 0.5,
    },
  },
  an = [
    {
      name: "hero",
      tall: !0,
      set: "Classic",
      seed: 11,
      dur: 4.6,
      pre: 14,
      preSpeed: 1,
      speed: 2.5,
      timeScale: 1,
      clockOffset: 0,
      from: { az: -38, el: 7, dist: 16.5, target: [0, 2.9, 0], fov: 24 },
      to: { az: -6, el: 6, dist: 13.6, target: [0, 3.05, 0], fov: 24 },
    },
    {
      name: "scoop",
      set: "Pistachio",
      seed: 5,
      dur: 4.2,
      pre: 24,
      preSpeed: 2,
      speed: 2,
      timeScale: 1,
      clockOffset: 10,
      from: { az: 75, el: 16, dist: 4.4, target: [0, 4.95, 0], fov: 24 },
      to: { az: 22, el: 30, dist: 3.7, target: [0, 5.15, 0], fov: 24 },
    },
    {
      name: "cone",
      set: "Peach",
      seed: 23,
      dur: 4.2,
      pre: 45,
      preSpeed: 2,
      speed: 2,
      timeScale: 1,
      clockOffset: 20,
      from: { az: 28, el: 4, dist: 5.4, target: [0, 1.5, 0], fov: 24 },
      to: { az: -14, el: 9, dist: 8.2, target: [0, 3.8, 0], fov: 24 },
    },
    {
      name: "runs",
      set: "Classic",
      seed: 3,
      dur: 4.4,
      pre: 70,
      preSpeed: 2.5,
      speed: 2.5,
      timeScale: 1,
      clockOffset: 30,
      from: { az: -52, el: 3, dist: 4.6, target: [0.2, 3.5, 0], fov: 24 },
      to: { az: 14, el: 5, dist: 4.1, target: [0.2, 3, 0], fov: 24 },
    },
    {
      name: "waffle",
      set: "Pistachio",
      seed: 12,
      dur: 5.4,
      pre: 14,
      preSpeed: 2,
      speed: 2,
      timeScale: 1,
      clockOffset: 40,
      from: { az: -38, el: 3, dist: 3.4, target: [0, 2.2, 0], fov: 24 },
      to: { az: 32, el: 8, dist: 2.9, target: [0, 2.35, 0], fov: 24 },
    },
    {
      name: "crane",
      tall: !0,
      set: "Classic",
      seed: 9,
      dur: 5.2,
      pre: 6,
      preSpeed: 1,
      speed: 1.5,
      timeScale: 1,
      clockOffset: 50,
      from: { az: -24, el: 2, dist: 7.6, target: [0, 1.3, 0], fov: 24 },
      to: { az: 14, el: 15, dist: 6.4, target: [0, 4.3, 0], fov: 24 },
    },
    {
      name: "finale",
      tall: !0,
      set: "Peach",
      seed: 41,
      dur: 5.6,
      pre: 110,
      preSpeed: 3,
      speed: 3,
      timeScale: 1,
      clockOffset: 60,
      from: { az: 26, el: 6, dist: 10.5, target: [0, 2.9, 0], fov: 24 },
      to: { az: -20, el: 9, dist: 15.5, target: [0, 2.9, 0], fov: 24 },
    },
  ],
  sn = (e) => e * e * e * (e * (e * 6 - 15) + 10),
  ue = (e, o, r) => e + (o - e) * r,
  Nt = (e) => (e * Math.PI) / 180;
function ln(e, o, r, s) {
  const i = sn(Math.min(Math.max(o, 0), 1)),
    { from: c, to: f } = e,
    p = e.sway ?? 1,
    x = Nt(ue(c.az, f.az, i) + Math.sin(r * 0.9) * 0.35 * p),
    g = Nt(ue(c.el, f.el, i) + Math.sin(r * 1.3 + 1) * 0.25 * p),
    M = Math.max(1, (e.tall ? 0.6 : 0.9) / s),
    h = ue(c.dist, f.dist, i) * M,
    y = c.target.map((z, k) => ue(z, f.target[k], i));
  return {
    position: [
      y[0] + h * Math.sin(x) * Math.cos(g),
      y[1] + h * Math.sin(g),
      y[2] + h * Math.cos(x) * Math.cos(g),
    ],
    target: y,
    fov: ue(c.fov, f.fov, i),
  };
}
const so = Xo + Vo,
  io = Ho + Yo,
  H = new URLSearchParams(location.search),
  j = H.has("capture"),
  he = j ? +H.get("w") : innerWidth,
  pe = j ? +H.get("h") : innerHeight;
if (j)
  for (const e of ["#title", "#hint", "#bar", "#random", "#controls"])
    document.querySelector(e)?.remove();
const rt = document.querySelector("#message"),
  se = document.querySelector("#view"),
  cn = (e) => {
    throw ((rt.textContent = e), new Error(e));
  },
  lo = await navigator.gpu?.requestAdapter();
lo ||
  cn(
    "This piece needs WebGPU. Try a recent version of Chrome or Edge, or Safari with WebGPU turned on.",
  );
const d = await lo.requestDevice(),
  at = Wo(d);
d.addEventListener("uncapturederror", (e) => console.error(e.error.message));
const co = se.getContext("webgpu"),
  fo = navigator.gpu.getPreferredCanvasFormat();
co.configure({ device: d, format: fo, alphaMode: "opaque" });
for (const e of [eo, so, io]) {
  const o = await d.createShaderModule({ code: e }).getCompilationInfo();
  for (const r of o.messages)
    r.type === "error" &&
      console.error(`${r.lineNum}:${r.linePos} ${r.message}`);
}
const Me = {
    Sorbet: {
      flavors: ["#e42f62", "#f88f28", "#8567e0"],
      bits: [0.5, 0, 0.7],
      sky: "#f9dc9c",
      ground: "#fce6b4",
      syrup: 1,
    },
    Gelato: {
      flavors: ["#a8cf62", "#f47f9c", "#fac648"],
      bits: [0.8, 1, 0],
      sky: "#f2a488",
      ground: "#f6b59c",
      syrup: 0.35,
    },
    Classic: {
      flavors: ["#6d3f26", "#f6e8c6", "#ee8fa2"],
      bits: [0.5, 0, 1],
      sky: "#f0c35e",
      ground: "#f5cf74",
      syrup: 0,
    },
  },
  uo = {
    Waffle: [
      [0.88, 0.54, 0.2],
      [0.7, 0.36, 0.1],
      [0.42, 0.2, 0.06],
      [0.95, 0.72, 0.38],
    ],
    Chocolate: [
      [0.17, 0.07, 0.03],
      [0.085, 0.032, 0.014],
      [0.045, 0.017, 0.008],
      [0.27, 0.12, 0.055],
    ],
    Strawberry: [
      [0.9, 0.36, 0.38],
      [0.7, 0.18, 0.22],
      [0.48, 0.1, 0.13],
      [0.98, 0.6, 0.56],
    ],
  };
j && Object.assign(Me, rn);
const st = { speed: 1 },
  Qe = (e) => {
    const o = new No(e);
    return [o.r, o.g, o.b];
  },
  it = oe * $,
  yt = (oo + 1) * no,
  fn = I * I,
  ae = it * 3 + yt + fn,
  Ae = new Float32Array(ae * 8),
  ze = [];
let W = 0;
to.forEach((e, o) => {
  const { dirs: r, details: s } = tn(e);
  ze.push([W, oe, $, 1]);
  for (let i = 0; i < it; i++)
    Ae.set(
      [
        r[i * 3],
        r[i * 3 + 1],
        r[i * 3 + 2],
        o,
        r[i * 3],
        r[i * 3 + 1],
        r[i * 3 + 2],
        s[i],
      ],
      (W + i) * 8,
    );
  W += it;
});
const Y = en();
ze.push([W, Y.rows, Y.cols, 1]);
const dn = W;
for (let e = 0; e < yt; e++)
  Ae.set(
    [
      Y.positions[e * 3],
      Y.positions[e * 3 + 1],
      Y.positions[e * 3 + 2],
      3,
      Y.normals[e * 3],
      Y.normals[e * 3 + 1],
      Y.normals[e * 3 + 2],
      0,
    ],
    (W + e) * 8,
  );
W += yt;
ze.push([W, I, I, 0]);
const un = W;
for (let e = 0; e < I; e++)
  for (let o = 0; o < I; o++) {
    const r = (o / (I - 1) - 0.5) * ot * 2,
      s = (e / (I - 1) - 0.5) * ot * 2;
    Ae.set([r, 0, s, 4, 0, 1, 0, 0], (W + e * I + o) * 8);
  }
const Re = [];
for (const e of [
  ...ze.slice(0, 3).map((o) => nt(oe, $, o[0])),
  nt(Y.rows, Y.cols, dn),
])
  for (const o of e) Re.push(o);
const ho = nt(I, I, un, !1),
  Ee = [],
  Vt = 20,
  Ze = 40;
for (let e = 0; e < Vt; e++)
  for (let o = 0; o < Ze; o++) {
    const r = (s, i) =>
      Math.round((s / Vt) * (oe - 1)) * $ +
      (Math.round(((i % Ze) / Ze) * $) % $);
    Ee.push(
      r(e, o),
      r(e + 1, o),
      r(e, o + 1),
      r(e, o + 1),
      r(e + 1, o),
      r(e + 1, o + 1),
    );
  }
const Ce = (e, o) => {
    const r = d.createBuffer({
      size: e.byteLength,
      usage: o | GPUBufferUsage.COPY_DST,
    });
    return (d.queue.writeBuffer(r, 0, e), r);
  },
  _e = Ce(Ae, GPUBufferUsage.STORAGE),
  Yt = Ce(new Uint32Array(Re), GPUBufferUsage.INDEX),
  hn = Ce(new Uint32Array(ho), GPUBufferUsage.INDEX),
  jt = Ce(new Uint32Array(Ee), GPUBufferUsage.INDEX),
  wt = () => d.createBuffer({ size: ae * 16, usage: GPUBufferUsage.STORAGE }),
  xt = wt(),
  bt = wt(),
  Mt = wt(),
  Ue = [0, 1].map(() =>
    d.createBuffer({ size: ae * 32, usage: GPUBufferUsage.STORAGE }),
  );
let E = ao({
  colors: [
    [1, 1, 1],
    [1, 1, 1],
    [1, 1, 1],
  ],
});
const po = d.createBuffer({
    size: E.kernelData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  }),
  mo = d.createBuffer({
    size: E.poolData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  }),
  go = d.createBuffer({
    size: E.dropData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  }),
  zt = new ArrayBuffer(224),
  me = new Float32Array(zt),
  pn = new Uint32Array(zt);
pn.set(ze.flat(), 28);
const Ie = d.createBuffer({
    size: 224,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  }),
  mn = d.createShaderModule({ code: eo }),
  St = (e) =>
    d.createComputePipeline({
      layout: "auto",
      compute: { module: mn, entryPoint: e },
    }),
  Pt = St("deform"),
  vo = St("normals"),
  kt = St("stain"),
  gn = [0, 1].map((e) =>
    d.createBindGroup({
      layout: Pt.getBindGroupLayout(1),
      entries: [{ binding: 1, resource: { buffer: Ue[e] } }],
    }),
  ),
  vn = d.createBindGroup({
    layout: Pt.getBindGroupLayout(0),
    entries: [Ie, _e, po, mo, xt, bt, Mt]
      .map((e, o) => ({ binding: o, resource: { buffer: e } }))
      .filter((e) => e.binding !== 5),
  }),
  yn = [0, 1].map((e) =>
    d.createBindGroup({
      layout: kt.getBindGroupLayout(1),
      entries: [Mt, Ue[e], Ue[1 - e]].map((o, r) => ({
        binding: r,
        resource: { buffer: o },
      })),
    }),
  ),
  wn = d.createBindGroup({
    layout: kt.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: Ie } },
      { binding: 1, resource: { buffer: _e } },
    ],
  });
let ne = 0,
  Te = 2;
const xn = d.createBindGroup({
    layout: vo.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: Ie } },
      { binding: 1, resource: { buffer: _e } },
      { binding: 4, resource: { buffer: xt } },
      { binding: 5, resource: { buffer: bt } },
    ],
  }),
  lt = d.createShaderModule({ code: so }),
  Ot = d.createBuffer({
    size: 720,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  }),
  ct = 1536,
  yo = d.createTexture({
    size: [ct, ct],
    format: "depth32float",
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
  }),
  bn = d.createSampler({
    compare: "less",
    magFilter: "linear",
    minFilter: "linear",
  }),
  wo = d.createBindGroupLayout({
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
  xo = d.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX,
        buffer: { type: "uniform" },
      },
    ],
  }),
  Bt = d.createBindGroupLayout({
    entries: [0, 1, 2, 3, 4, 5].map((e) => ({
      binding: e,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: "read-only-storage" },
    })),
  }),
  Mn = d.createBindGroup({
    layout: wo,
    entries: [
      { binding: 0, resource: { buffer: Ot } },
      { binding: 1, resource: yo.createView() },
      { binding: 2, resource: bn },
    ],
  }),
  zn = d.createBindGroup({
    layout: xo,
    entries: [{ binding: 0, resource: { buffer: Ot } }],
  }),
  Wt = [0, 1].map((e) =>
    d.createBindGroup({
      layout: Bt,
      entries: [_e, xt, bt, Mt, go, Ue[1 - e]].map((o, r) => ({
        binding: r,
        resource: { buffer: o },
      })),
    }),
  ),
  Sn = d.createPipelineLayout({ bindGroupLayouts: [wo, Bt] }),
  ft = 4,
  X = "rgba16float",
  Le = (e, o, r = {}) =>
    d.createRenderPipeline({
      layout: Sn,
      vertex: { module: lt, entryPoint: e },
      fragment: {
        module: lt,
        entryPoint: o,
        targets: [r.blend ? { format: X, blend: r.blend } : { format: X }],
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: r.depthWrite ?? !0,
        depthCompare: r.compare ?? "less",
      },
      multisample: { count: ft },
    }),
  Pn = Le("quadVs", "roomFs", { depthWrite: !1, compare: "always" }),
  kn = Le("bodyVs", "bodyFs"),
  On = Le("dropVs", "dropFs"),
  Bn = {
    color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha" },
    alpha: { srcFactor: "one", dstFactor: "zero" },
  },
  Gn = Le("poolVs", "poolFs", { blend: Bn }),
  Tn = d.createPipelineLayout({ bindGroupLayouts: [xo, Bt] }),
  bo = (e) =>
    d.createRenderPipeline({
      layout: Tn,
      vertex: { module: lt, entryPoint: e },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth32float",
        depthWriteEnabled: !0,
        depthCompare: "less",
        depthBias: 2,
        depthBiasSlopeScale: 2,
      },
    }),
  Rn = bo("shadowVs"),
  En = bo("dropShadowVs"),
  Ht = d.createShaderModule({ code: io }),
  Xt = d.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  }),
  dt = d.createBindGroupLayout({
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
  Fe = (e, o, r) =>
    d.createRenderPipeline({
      layout: d.createPipelineLayout({ bindGroupLayouts: [dt] }),
      vertex: { module: Ht, entryPoint: "quadVs" },
      fragment: {
        module: Ht,
        entryPoint: e,
        targets: [r ? { format: o, blend: r } : { format: o }],
      },
    }),
  Un = {
    color: { srcFactor: "one", dstFactor: "one" },
    alpha: { srcFactor: "one", dstFactor: "zero" },
  },
  Dn = Fe("brightFs", X),
  qn = Fe("downFs", X),
  An = Fe("upFs", X, Un),
  Cn = Fe("finishFs", fo),
  Mo = d.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  }),
  ye = new Float32Array(4),
  Je = 4;
let ut,
  ht,
  ge,
  D = [],
  ve = [],
  zo,
  C = 0,
  _ = 0,
  we = j ? 1 : Math.min(devicePixelRatio, 1.25);
function Gt() {
  ((C = j ? he : Math.max(1, Math.floor(innerWidth * we))),
    (_ = j ? pe : Math.max(1, Math.floor(innerHeight * we))),
    (se.width = C),
    (se.height = _),
    ut?.destroy(),
    ht?.destroy(),
    ge?.destroy(),
    D.forEach((s) => s.destroy()),
    (ut = d.createTexture({
      size: [C, _],
      format: X,
      sampleCount: ft,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })),
    (ht = d.createTexture({
      size: [C, _],
      format: "depth32float",
      sampleCount: ft,
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })),
    (ge = d.createTexture({
      size: [C, _],
      format: X,
      usage:
        GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    })),
    (D = Array.from({ length: Je }, (s, i) =>
      d.createTexture({
        size: [Math.max(C >> (i + 1), 1), Math.max(_ >> (i + 1), 1)],
        format: X,
        usage:
          GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
      }),
    )));
  const e = (s, i) => {
      const c = d.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      return (
        d.queue.writeBuffer(c, 0, new Float32Array([1 / s, 1 / i, 0, 0])),
        c
      );
    },
    o = (s, i, c, f) =>
      d.createBindGroup({
        layout: dt,
        entries: [
          { binding: 0, resource: s.createView() },
          { binding: 1, resource: Xt },
          { binding: 2, resource: { buffer: f ?? e(i, c) } },
          { binding: 3, resource: D[0].createView() },
          { binding: 4, resource: { buffer: at.buffer } },
        ],
      });
  Qt ??= d.createTexture({
    size: [1, 1],
    format: X,
    usage: GPUTextureUsage.TEXTURE_BINDING,
  });
  const r = (s, i, c) =>
    d.createBindGroup({
      layout: dt,
      entries: [
        { binding: 0, resource: s.createView() },
        { binding: 1, resource: Xt },
        { binding: 2, resource: { buffer: e(i, c) } },
        { binding: 3, resource: Qt.createView() },
        { binding: 4, resource: { buffer: at.buffer } },
      ],
    });
  ((ve = []),
    ve.push({ pipeline: Dn, group: r(ge, C, _), target: D[0], clear: !0 }));
  for (let s = 1; s < Je; s++)
    ve.push({
      pipeline: qn,
      group: r(D[s - 1], D[s - 1].width, D[s - 1].height),
      target: D[s],
      clear: !0,
    });
  for (let s = Je - 1; s > 0; s--)
    ve.push({
      pipeline: An,
      group: r(D[s], D[s].width, D[s].height),
      target: D[s - 1],
      clear: !1,
    });
  ((zo = o(ge, C, _, Mo)),
    (ye[0] = 1 / C),
    (ye[1] = 1 / _),
    (ye[2] = 0.06),
    (P.aspect = C / _),
    j ||
      P.position
        .sub(U.target)
        .setLength(_n * Math.max(1, 0.82 / P.aspect))
        .add(U.target),
    P.updateProjectionMatrix());
}
const P = new Co(24, 1, 1, 60);
P.coordinateSystem = Jt;
const _n = 16.5;
P.position.set(3.2, 4.6, 15);
const U = new Ao(P, se);
U.target.set(0, 2.82, 0);
U.enableDamping = !0;
U.enablePan = !1;
U.minDistance = 5;
U.maxDistance = 28;
U.maxPolarAngle = Math.PI * 0.49;
U.autoRotate = !0;
U.addEventListener("start", () => {
  ((U.autoRotate = !1), (document.querySelector("#hint").style.opacity = 0));
});
const xe = new Kt(-0.56, 0.66, 0.5).normalize(),
  K = { amount: 1, falloff: 0, turn: 200, warmth: 0.3, strength: 1.75 },
  ee = new _o(-6, 6, 6, -6, 1, 32);
ee.coordinateSystem = Jt;
const So = new vt();
let De = null;
function be() {
  (xe.set(...jo(G, 124, De, K)).normalize(),
    ee.position
      .copy(xe)
      .multiplyScalar(15)
      .add(new Kt(0, 3, 0)),
    ee.lookAt(0, 3, 0),
    ee.updateProjectionMatrix(),
    ee.updateMatrixWorld(),
    So.multiplyMatrices(ee.projectionMatrix, ee.matrixWorldInverse));
}
const Ke = new vt(),
  $t = new vt();
let Qt,
  qe = "Sorbet";
const G = new Float32Array(180);
be();
function pt(e, { random: o = Math.random, pre: r = 18, preSpeed: s = 1 } = {}) {
  qe = e;
  const i = Me[e],
    c = i.flavors.map(Qe);
  ((E = ao({ colors: c, random: o })),
    E.prewarm(r, s),
    (Te = 2),
    me.set([...c[0], 0], 52),
    (G[107] = i.syrup),
    c.forEach((f, p) => G.set([f[0], f[1], f[2], i.bits[p]], 80 + p * 4)),
    G.set([...Qe(i.sky), 1], 92),
    G.set([...Qe(i.ground), 1], 96),
    (document.body.style.background = i.sky));
}
let Po;
function mt(e) {
  ((Po = e), uo[e].forEach((o, r) => G.set([...o, 1], 108 + r * 4)));
}
document.querySelector("#random")?.addEventListener("click", () => {
  const e = Object.keys(Me)
      .flatMap((s) => Object.keys(uo).map((i) => [s, i]))
      .filter(([s, i]) => s !== qe || i !== Po),
    [o, r] = e[Math.floor(Math.random() * e.length)];
  (o !== qe && pt(o), mt(r));
});
const In = qo(H, (e) => {
  ((De = e), be());
});
function Ln() {
  return (
    Fo(() => ({
      Studio: In,
      speed: {
        value: st.speed,
        min: 0,
        max: 5,
        step: 0.05,
        label: "melt speed",
        onChange: (e) => {
          st.speed = e;
        },
      },
      "hdr light": {
        value: K.amount,
        min: 0,
        max: 1,
        step: 0.01,
        onChange: (e) => {
          ((K.amount = e), be());
        },
      },
      "hdr strength": {
        value: K.strength,
        min: 0.4,
        max: 3,
        step: 0.01,
        onChange: (e) => {
          ((K.strength = e), be());
        },
      },
      "hdr warmth": {
        value: K.warmth,
        min: -1,
        max: 2,
        step: 0.01,
        onChange: (e) => {
          ((K.warmth = e), be());
        },
      },
      ...at.controls(),
    })),
    null
  );
}
j ||
  Io.createRoot(document.querySelector("#controls")).render(
    Oe.createElement(
      Oe.Fragment,
      null,
      Oe.createElement(Lo, { collapsed: !0, titleBar: { title: "Controls" } }),
      Oe.createElement(Ln),
    ),
  );
const Fn = ho.length;
function Nn(e) {
  (P.updateMatrixWorld(),
    Ke.multiplyMatrices(P.projectionMatrix, P.matrixWorldInverse),
    $t.copy(Ke).invert(),
    G.set(Ke.elements, 0),
    G.set(So.elements, 16),
    G.set($t.elements, 32),
    G.set([P.position.x, P.position.y, P.position.z, e], 48),
    G.set([xe.x, xe.y, xe.z, ct / (De ? Math.sqrt(De.soft / 4) : 1)], 52),
    E.scoops.forEach((o, r) => {
      (G.set([o.cx, o.cy, o.cz, o.r, o.sx, o.sy, o.sx, o.melt], 56 + r * 8),
        me.set([o.cx, o.cy, o.cz, o.r, o.sx, o.sy, o.sx, o.melt], r * 8));
    }),
    G.set([C, _], 100),
    d.queue.writeBuffer(Ot, 0, G),
    (me[48] = e),
    (me[49] = ot),
    (me[50] = Te > 0 ? 1 : 0),
    Te > 0 && Te--,
    d.queue.writeBuffer(Ie, 0, zt),
    d.queue.writeBuffer(po, 0, E.kernelData),
    d.queue.writeBuffer(mo, 0, E.poolData),
    d.queue.writeBuffer(go, 0, E.dropData));
}
let gt = performance.now(),
  et = 0,
  tt = gt,
  Zt = !1,
  Be = 0;
function ko(e) {
  Nn(e);
  const o = d.createCommandEncoder();
  ne = 1 - ne;
  const r = o.beginComputePass();
  (r.setPipeline(Pt),
    r.setBindGroup(0, vn),
    r.setBindGroup(1, gn[ne]),
    r.dispatchWorkgroups(Math.ceil(ae / 128)),
    r.setPipeline(vo),
    r.setBindGroup(0, xn),
    r.dispatchWorkgroups(Math.ceil(ae / 128)),
    r.setPipeline(kt),
    r.setBindGroup(0, wn),
    r.setBindGroup(1, yn[ne]),
    r.dispatchWorkgroups(Math.ceil(ae / 128)),
    r.end());
  const s = E.dropCount();
  if ((Zt = !Zt)) {
    const f = o.beginRenderPass({
      colorAttachments: [],
      depthStencilAttachment: {
        view: yo.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });
    (f.setPipeline(Rn),
      f.setBindGroup(0, zn),
      f.setBindGroup(1, Wt[ne]),
      f.setIndexBuffer(Yt, "uint32"),
      f.drawIndexed(Re.length),
      s &&
        (f.setPipeline(En),
        f.setIndexBuffer(jt, "uint32"),
        f.drawIndexed(Ee.length, s)),
      f.end());
  }
  const i = o.beginRenderPass({
    colorAttachments: [
      {
        view: ut.createView(),
        resolveTarget: ge.createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: "clear",
        storeOp: "discard",
      },
    ],
    depthStencilAttachment: {
      view: ht.createView(),
      depthClearValue: 1,
      depthLoadOp: "clear",
      depthStoreOp: "discard",
    },
  });
  (i.setBindGroup(0, Mn),
    i.setBindGroup(1, Wt[ne]),
    i.setPipeline(Pn),
    i.draw(3),
    i.setPipeline(Gn),
    i.setIndexBuffer(hn, "uint32"),
    i.drawIndexed(Fn),
    i.setPipeline(kn),
    i.setIndexBuffer(Yt, "uint32"),
    i.drawIndexed(Re.length),
    s &&
      (i.setPipeline(On),
      i.setIndexBuffer(jt, "uint32"),
      i.drawIndexed(Ee.length, s)),
    i.end());
  for (const f of ve) {
    const p = o.beginRenderPass({
      colorAttachments: [
        {
          view: f.target.createView(),
          clearValue: [0, 0, 0, 1],
          loadOp: f.clear ? "clear" : "load",
          storeOp: "store",
        },
      ],
    });
    (p.setPipeline(f.pipeline), p.setBindGroup(0, f.group), p.draw(3), p.end());
  }
  ((ye[3] = e), d.queue.writeBuffer(Mo, 0, ye));
  const c = o.beginRenderPass({
    colorAttachments: [
      {
        view: co.getCurrentTexture().createView(),
        clearValue: [0, 0, 0, 1],
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  });
  (c.setPipeline(Cn),
    c.setBindGroup(0, zo),
    c.draw(3),
    c.end(),
    d.queue.submit([o.finish()]));
}
function Oo(e) {
  const o = Math.min((e - gt) / 1e3, 0.05);
  if (
    ((gt = e),
    E.step(o, { speed: st.speed * (1 + Me[qe].syrup * 0.5) }),
    (U.autoRotateSpeed = 0.4 * Math.cos(e * 12e-5)),
    U.update(o),
    ko(e / 1e3),
    et++,
    e - tt > 1e3)
  ) {
    const r = (et * 1e3) / (e - tt);
    ((et = 0),
      (tt = e),
      (Be = r < 40 && !document.hidden && e > 6e3 ? Be + 1 : 0),
      Be >= 4 &&
        we > 0.72 &&
        ((we = Math.max(we * 0.88, 0.72)), (Be = 0), Gt()));
  }
  requestAnimationFrame(Oo);
}
Gt();
if (!j)
  (addEventListener("resize", Gt),
    pt("Sorbet"),
    mt("Waffle"),
    rt.remove(),
    requestAnimationFrame(Oo));
else {
  (rt.remove(),
    (se.style.cssText = `position:fixed;left:0;top:0;width:${he}px;height:${pe}px`));
  const e = an[+H.get("shot")],
    o = +(H.get("every") ?? 1),
    r = +H.get("fps"),
    s = +H.get("frames"),
    i = H.get("port");
  ((P.near = 0.05),
    mt("Waffle"),
    pt(e.set, { random: nn(e.seed), pre: e.pre, preSpeed: e.preSpeed }));
  const c = document.createElement("canvas");
  ((c.width = he), (c.height = pe));
  const f = c.getContext("2d"),
    p = e.speed * (1 + Me[e.set].syrup * 0.5);
  let x = 0,
    g = e.timeScale;
  ((window.__frame = async (h, y = !0) => {
    for (; y && x < h; ) {
      const k =
        e.hangScale && !E.drops.some((O) => O.age < 0.9)
          ? e.hangScale
          : e.timeScale;
      ((g += (k - g) * 0.1), E.step(g / r, { speed: p }), x++);
    }
    const S = h / r,
      z = ln(e, S / (s / r), S, he / pe);
    return (
      (P.fov = z.fov),
      (P.aspect = he / pe),
      P.position.set(...z.position),
      P.up.set(0, 1, 0),
      P.lookAt(...z.target),
      P.updateProjectionMatrix(),
      ko(S + e.clockOffset),
      f.drawImage(se, 0, 0),
      new Promise((k) => c.toBlob(k, "image/png"))
    );
  }),
    (window.__ready = !0));
  const M = (h) =>
    i &&
    fetch(`http://localhost:${i}/log?m=${encodeURIComponent(h)}`).catch(
      () => {},
    );
  if (
    (addEventListener("error", (h) => M(`error ${h.message}`)),
    addEventListener("unhandledrejection", (h) => M(`rejection ${h.reason}`)),
    d.lost.then((h) => M(`DEVICE LOST ${h.reason} ${h.message}`)),
    i)
  ) {
    for (let h = 0; h < 3; h++) await window.__frame(0, !1);
    for (let h = 0; h < s; h++) {
      const y = await window.__frame(h);
      if (h % o) continue;
      const S = await y.arrayBuffer();
      for (let z = 0; ; z++)
        try {
          await fetch(`http://localhost:${i}/frame?i=${h / o}`, {
            method: "POST",
            headers: { "content-type": "text/plain" },
            body: S,
          });
          break;
        } catch (k) {
          if (z > 20) throw k;
          await new Promise((O) => setTimeout(O, 100 + z * 100));
        }
    }
    await fetch(`http://localhost:${i}/done`);
  }
}
