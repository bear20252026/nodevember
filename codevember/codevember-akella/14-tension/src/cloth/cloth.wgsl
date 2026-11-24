// A sheet of cloth, n x n particles on a square grid, position based (XPBD, one Gauss-Seidel sweep per
// substep, many substeps). Every distance constraint of one kind and one colour touches each particle at
// most once, so a dispatch solves them all at once with no races:
//   kind 0/1  stretch, along x / along y          colour = first end's coordinate % 2
//   kind 2/3  shear, the two diagonals            colour = x % 2
//   kind 4/5  bend, skipping one, along x / y     colour = (coordinate / 2) % 2
// The sheet hangs from a few pins, each a small heavy body on an elastic cable. The cloth can never be
// further from a pin than it is across the flat sheet (long range attachments), which is what keeps a
// fine sheet from stretching like rubber; the pins feel the pull back, so they give when the sheet is
// pushed. Pushers are invisible solid shapes moving on given paths.

struct Params {
  n: u32, subs: u32, npush: u32, npin: u32,
  h: f32, d: f32, g: f32, damp: f32,
  aStretch: f32, aShear: f32, aBend: f32, air: f32,
  thick: f32, mu: f32, slack: f32, mass: f32,
  pinMass: f32, cableK: f32, pinDamp: f32, maxV: f32,
  feed: f32, pad0: f32, pad1: f32, pad2: f32,
  faceO: vec4f, // the face's field: origin (from the nose tip), cell
  faceD: vec4f, // and its size in cells
}

// one moving shape: centre and turn at the start and end of the frame; c0.w is its kind, size its measures
struct Pusher { c0: vec4f, c1: vec4f, q0: vec4f, q1: vec4f, size: vec4f }
// a pin: its particle (and grid place) and the cable's far end, anchor.w the cable's rest length
struct Pin { node: u32, gx: u32, gy: u32, pad: u32, anchor: vec4f }
struct Body { p: vec4f, v: vec4f }
struct Pass { kind: u32, color: u32, frac: f32, sub: u32 }

@group(0) @binding(0) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> old: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
@group(0) @binding(3) var<uniform> P: Params;
@group(0) @binding(4) var<uniform> pass_: Pass;
@group(0) @binding(5) var<storage, read> pushers: array<Pusher>;
@group(0) @binding(6) var<storage, read> pins: array<Pin>;
@group(0) @binding(7) var<storage, read_write> bodies: array<Body>;
@group(0) @binding(8) var<storage, read_write> react: array<atomic<i32>>;
@group(0) @binding(9) var outPos: texture_storage_2d<rgba32float, write>;
@group(0) @binding(10) var outNor: texture_storage_2d<rgba32float, write>;
@group(0) @binding(11) var<storage, read_write> target_: array<vec4f>;
@group(0) @binding(12) var faceField: texture_3d<f32>;
@group(0) @binding(13) var faceSampler: sampler;
// the nap: which way the hairs lean, in the world; combed along the sheet's grid +y, never brushed
@group(0) @binding(14) var outNap: texture_storage_2d<rgba32float, write>;

const SCALE = 1e7; // reaction sums are fixed point, so they add up the same in any order
const MAX_PINS = 16u;

fn normalOf(i: u32) -> vec3f {
  let n = P.n;
  let x = i % n;
  let y = i / n;
  let l = old[select(i - 1u, i, x == 0u)].xyz;
  let r = old[select(i + 1u, i, x == n - 1u)].xyz;
  let b = old[select(i - n, i, y == 0u)].xyz;
  let t = old[select(i + n, i, y == n - 1u)].xyz;
  let c = cross(r - l, t - b);
  let len = length(c);
  return select(vec3f(0.0), c / len, len > 1e-12);
}

var<workgroup> wacc: array<atomic<i32>, 64>;

@compute @workgroup_size(256)
fn step(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lid: u32) {
  if (lid < 64u) { atomicStore(&wacc[lid], 0); }
  workgroupBarrier();
  let n = P.n;
  let i = gid.x;
  if (i < n * n) {
    let p = old[i];
    if (p.w > 0.0) {
      var v = vel[i].xyz * P.damp;
      // air pushes back on the sheet's face, hardly on its edge
      let nn = normalOf(i);
      v -= nn * (dot(v, nn) * P.air);
      v.y -= P.g * P.h;
      // while recording a loop: drawn softly towards where it was at the start (vanishes once it repeats)
      if (P.feed > 0.0) {
        let tg = target_[i];
        v += (tg.xyz - p.xyz) * (P.feed * P.h);
      }
      let s = length(v);
      if (s > P.maxV) { v *= P.maxV / s; }
      var x = p.xyz + v * P.h;
      // never further from a pin than across the flat sheet; first, so the stretch and bend passes
      // after it mend whatever this tugs out of shape
      let gx = f32(i % n);
      let gy = f32(i / n);
      for (var j = 0u; j < P.npin; j++) {
        let pin = pins[j];
        let R = P.d * P.slack * length(vec2f(gx - f32(pin.gx), gy - f32(pin.gy)));
        let df = x - bodies[j].p.xyz;
        let dist = length(df);
        if (dist > R && dist > 1e-9) {
          let C = dist - R;
          let dir = df / dist;
          x -= dir * C;
          let r = dir * min(C, 1e-3) * SCALE;
          atomicAdd(&wacc[4u * j], i32(round(r.x)));
          atomicAdd(&wacc[4u * j + 1u], i32(round(r.y)));
          atomicAdd(&wacc[4u * j + 2u], i32(round(r.z)));
          atomicAdd(&wacc[4u * j + 3u], 1);
        }
      }
      pos[i] = vec4f(x, p.w);
    }
  }
  workgroupBarrier();
  if (lid < 4u * P.npin) {
    let v = atomicLoad(&wacc[lid]);
    if (v != 0) { atomicAdd(&react[lid], v); }
  }
}

@compute @workgroup_size(256)
fn edges(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let half = n / 2u;
  let t = gid.x;
  if (t >= half * n) { return; }
  let row = t / half;
  let m = t % half;
  let kind = pass_.kind;
  let c = pass_.color;
  var k: u32;
  var span = 1u;
  if (kind < 4u) {
    k = 2u * m + c;
  } else {
    k = 4u * (m / 2u) + 2u * c + (m % 2u);
    span = 2u;
  }
  if (k + span >= n) { return; }
  var ia: u32;
  var ib: u32;
  var rest = P.d;
  var alpha = P.aStretch;
  switch kind {
    case 0u: { ia = row * n + k; ib = ia + 1u; }
    case 1u: { ia = k * n + row; ib = ia + n; }
    case 2u: {
      if (row >= n - 1u) { return; }
      ia = row * n + k; ib = ia + n + 1u; rest = P.d * 1.41421356; alpha = P.aShear;
    }
    case 3u: {
      if (row >= n - 1u) { return; }
      ia = row * n + k + 1u; ib = ia + n - 1u; rest = P.d * 1.41421356; alpha = P.aShear;
    }
    case 4u: { ia = row * n + k; ib = ia + 2u; rest = 2.0 * P.d; alpha = P.aBend; }
    default: { ia = k * n + row; ib = ia + 2u * n; rest = 2.0 * P.d; alpha = P.aBend; }
  }
  let pa = pos[ia];
  let pb = pos[ib];
  let w = pa.w + pb.w;
  if (w == 0.0) { return; }
  let dv = pa.xyz - pb.xyz;
  let len = length(dv);
  if (len < 1e-9) { return; }
  let C = len - rest;
  // compliance is given per unit of the particles' own inverse mass
  let dl = -C / (w * (1.0 + alpha));
  let corr = dv * (dl / len);
  pos[ia] = vec4f(pa.xyz + corr * pa.w, pa.w);
  pos[ib] = vec4f(pb.xyz - corr * pb.w, pb.w);
}

// one thread: the pins, as small bodies on springs, tied to each other by the sheet between them
@compute @workgroup_size(1)
fn pinStep() {
  let h = P.h;
  var before: array<vec3f, MAX_PINS>;
  var at: array<vec3f, MAX_PINS>;
  for (var j = 0u; j < P.npin; j++) {
    let b = bodies[j];
    let pin = pins[j];
    let rx = f32(atomicExchange(&react[4u * j], 0)) / SCALE;
    let ry = f32(atomicExchange(&react[4u * j + 1u], 0)) / SCALE;
    let rz = f32(atomicExchange(&react[4u * j + 2u], 0)) / SCALE;
    let count = f32(atomicExchange(&react[4u * j + 3u], 0));
    var v = b.v.xyz;
    let toA = pin.anchor.xyz - b.p.xyz;
    let dist = length(toA);
    let stretch = max(dist - pin.anchor.w, 0.0);
    v += toA * (P.cableK * stretch / (P.pinMass * dist) * h);
    v *= P.pinDamp;
    var p = b.p.xyz + v * h;
    // the sheet's pull: what the particles held back by this pin asked of it, shared by mass
    p += vec3f(rx, ry, rz) * (P.mass / (P.pinMass + count * P.mass));
    before[j] = b.p.xyz;
    at[j] = p;
  }
  // two pins are never further apart than across the sheet
  for (var it = 0; it < 4; it++) {
    for (var a = 0u; a < P.npin; a++) {
      for (var b = a + 1u; b < P.npin; b++) {
        let g = vec2f(f32(pins[a].gx) - f32(pins[b].gx), f32(pins[a].gy) - f32(pins[b].gy));
        let rest = length(g) * P.d * P.slack;
        let dv = at[a] - at[b];
        let len = length(dv);
        if (len > rest) {
          let corr = dv * (0.5 * (len - rest) / len);
          at[a] -= corr;
          at[b] += corr;
        }
      }
    }
  }
  for (var j = 0u; j < P.npin; j++) {
    bodies[j] = Body(vec4f(at[j], 0.0), vec4f((at[j] - before[j]) / h, 0.0));
    let node = pins[j].node;
    pos[node] = vec4f(at[j], 0.0);
    old[node] = vec4f(at[j], 0.0);
  }
}

fn turn(q: vec4f, v: vec3f) -> vec3f {
  let t = 2.0 * cross(q.xyz, v);
  return v + q.w * t + cross(q.xyz, t);
}
fn unturn(q: vec4f, v: vec3f) -> vec3f { return turn(vec4f(-q.xyz, q.w), v); }

fn shape(p: vec3f, kind: u32, s: vec4f) -> f32 {
  switch kind {
    case 1u: { return length(p) - s.x; } // ball
    case 2u: { // rod along y, round ended: a finger
      let q = vec3f(p.x, p.y - clamp(p.y, -s.y, s.y), p.z);
      return length(q) - s.x;
    }
    case 3u: { // rounded box
      let q = abs(p) - s.xyz;
      return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - s.w;
    }
    case 4u: { // ring in the xz plane
      let q = vec2f(length(p.xz) - s.x, p.y);
      return length(q) - s.y;
    }
    case 5u: { // egg: an ellipsoid (approximate distance)
      let k0 = length(p / s.xyz);
      let k1 = length(p / (s.xyz * s.xyz));
      return k0 * (k0 - 1.0) / max(k1, 1e-6);
    }
    case 6u: { // cone, round tipped, point up: s.x base radius, s.y height, s.z tip radius
      let q = vec2f(length(p.xz), p.y);
      let r1 = s.x;
      let r2 = s.z;
      let hh = s.y;
      let b = (r1 - r2) / hh;
      let a = sqrt(1.0 - b * b);
      let k = dot(q, vec2f(-b, a));
      if (k < 0.0) { return length(q) - r1; }
      if (k > a * hh) { return length(q - vec2f(0.0, hh)) - r2; }
      return dot(q, vec2f(a, b)) - r1;
    }
    case 7u: { // drum: upright cylinder, s.x radius, s.y half height, s.z edge rounding
      let q = vec2f(length(p.xz) - (s.x - s.z), abs(p.y) - (s.y - s.z));
      return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - s.z;
    }
    case 8u: { // the face, s.x metres per field unit; looking along +z, nose tip at the origin
      let q = p / s.x;
      let size = P.faceD.xyz * P.faceO.w;
      let rel = q - P.faceO.xyz;
      let out = length(max(max(-rel, rel - size), vec3f(0.0)));
      let uvw = clamp(rel / size, vec3f(0.0), vec3f(1.0));
      let d = textureSampleLevel(faceField, faceSampler, uvw, 0.0).x;
      return (d + out) * s.x;
    }
    default: { return 1e9; }
  }
}

@compute @workgroup_size(256)
fn collide(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i < n * n) {
    let p = pos[i];
    let o = old[i];
    if (p.w > 0.0) {
      var x = p.xyz;
      let f1 = pass_.frac;
      let f0 = f1 - 1.0 / f32(P.subs);
      for (var k = 0u; k < P.npush; k++) {
        let s = pushers[k];
        let kind = u32(s.c0.w);
        if (kind == 0u) { continue; }
        let c = mix(s.c0.xyz, s.c1.xyz, f1);
        let q = normalize(mix(s.q0, s.q1, f1));
        let lp = unturn(q, x - c);
        let dd = shape(lp, kind, s.size);
        if (dd < P.thick) {
          let e = 1e-3;
          let gr = vec3f(
            shape(lp + vec3f(e, 0.0, 0.0), kind, s.size) - shape(lp - vec3f(e, 0.0, 0.0), kind, s.size),
            shape(lp + vec3f(0.0, e, 0.0), kind, s.size) - shape(lp - vec3f(0.0, e, 0.0), kind, s.size),
            shape(lp + vec3f(0.0, 0.0, e), kind, s.size) - shape(lp - vec3f(0.0, 0.0, e), kind, s.size));
          let gl = length(gr);
          if (gl > 1e-9) {
            var nw = turn(q, gr / gl);
            var pen = P.thick - dd;
            let cp = mix(s.c0.xyz, s.c1.xyz, f0);
            let qp = normalize(mix(s.q0, s.q1, f0));
            // where it was at the start of the substep, seen from the shape: if that was on the other
            // side, it has been pulled through (a thin finger, a tether's tug), so put it back on that side
            let lo = unturn(qp, o.xyz - cp);
            let dOld = shape(lo, kind, s.size);
            if (dOld > 0.0) {
              let go = vec3f(
                shape(lo + vec3f(e, 0.0, 0.0), kind, s.size) - shape(lo - vec3f(e, 0.0, 0.0), kind, s.size),
                shape(lo + vec3f(0.0, e, 0.0), kind, s.size) - shape(lo - vec3f(0.0, e, 0.0), kind, s.size),
                shape(lo + vec3f(0.0, 0.0, e), kind, s.size) - shape(lo - vec3f(0.0, 0.0, e), kind, s.size));
              let gol = length(go);
              if (gol > 1e-9) {
                let no = turn(q, go / gol);
                if (dot(no, nw) < 0.2) {
                  // the old surface point, carried with the shape, and the plane through it
                  let surf = c + turn(q, lo - (go / gol) * dOld);
                  nw = no;
                  pen = max(P.thick - dot(x - surf, no), 0.0);
                }
              }
            }
            x += nw * pen;
            // friction: how the shape's surface moved here this substep, against how the cloth did
            let carried = x - (cp + turn(qp, unturn(q, x - c)));
            let rel = (x - o.xyz) - carried;
            let tang = rel - nw * dot(rel, nw);
            let tl = length(tang);
            if (tl > 1e-12) { x -= tang * min(1.0, P.mu * pen / tl); }
          }
        }
      }
      pos[i] = vec4f(x, p.w);
      old[i] = vec4f(x, p.w);
      vel[i] = vec4f((x - o.xyz) / P.h, 0.0);
    } else {
      vel[i] = vec4f(0.0);
    }
  }
}

// once a frame: positions, and normals with how hollow the sheet is there (w), for drawing
@compute @workgroup_size(256)
fn publish(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i >= n * n) { return; }
  let x = i % n;
  let y = i / n;
  let c = old[i].xyz;
  let l = old[select(i - 1u, i, x == 0u)].xyz;
  let r = old[select(i + 1u, i, x == n - 1u)].xyz;
  let b = old[select(i - n, i, y == 0u)].xyz;
  let t = old[select(i + n, i, y == n - 1u)].xyz;
  let cr = cross(r - l, t - b);
  let len = length(cr);
  let nn = select(vec3f(0.0, 1.0, 0.0), cr / len, len > 1e-12);
  // the Laplacian against the normal: > 0 where the sheet curls towards its normal side
  var lap = vec3f(0.0);
  var cnt = 0.0;
  if (x > 0u && x < n - 1u) { lap += l + r - 2.0 * c; cnt += 1.0; }
  if (y > 0u && y < n - 1u) { lap += b + t - 2.0 * c; cnt += 1.0; }
  let hollow = select(0.0, dot(lap, nn) / (cnt * P.d), cnt > 0.0);
  textureStore(outPos, vec2u(x, y), vec4f(c, 1.0));
  textureStore(outNor, vec2u(x, y), vec4f(nn, hollow));
  // the nap in the world: combed along the grid's +y, so it turns only as the sheet does
  let tv = t - b;
  textureStore(outNap, vec2u(x, y), vec4f(select(vec3f(0.0, 0.0, 1.0), normalize(tv), length(tv) > 1e-9), 1.0));
}

// while recording a loop: keep this frame's sheet as the target for the same frame next period
@compute @workgroup_size(256)
fn keep(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n * P.n) { return; }
  target_[i] = old[i];
}
