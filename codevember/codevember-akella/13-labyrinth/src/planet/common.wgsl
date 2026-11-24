// Shared by the planet's passes (gather.wgsl, paint.wgsl): the ball's cells, the shapes in them, a ray through
// them, one sample of the light on a point of the ball, and where that point keeps its light.
//
// The ball turns round the line toward the sun, so the sun meets every point of it the same way all the time,
// and so does the sky: the light on a point never changes. So it is gathered once, on the ball itself, and
// kept. Each flat face is cut into small squares (texels) of 1/texel of a cube in its own plane; a face that is
// not flat to an axis (the risers of a fan, the vault of an arch) is cut into small cubes of space. Each texel is
// a slot in one big table, found by hashing what it is (which way it faces, how deep, where in its plane).
// gather.wgsl adds samples of light into the table; paint.wgsl reads it. Once a texel has enough, it stops
// taking more, and the picture is done for good.
struct Params {
  size: vec2f, // the painted picture, pixels
  scale: f32, // pixels to a cube
  frame: f32,
  steps: f32, // steps in a flight
  turns: f32, // steps in a fan
  small: f32, // side of the small cube
  texel: f32, // texels across a cube
  right: vec4f, // the eye's axes: across the screen; w: half the grid, in cells
  up: vec4f, // up it; w: cells along the grid
  fore: vec4f, // and the way its rays go
  sun: vec4f, // toward the sun; w: how wide it is (radians)
  sunTone: vec4f,
  skyHigh: vec4f,
  skyLow: vec4f,
  clay: vec4f,
  skyUp: vec4f,
  more: vec4f, // slots in the table (a power of two), samples a texel keeps at most, rays a pixel, exposure
  grid: vec4f, // the points sampled a frame, across and down
  glow: vec4f, // a lit room's light; w: how many of the rooms are lit
  metal: vec4f, // the colour of gold
  mix: vec4f, // how many of the lines of cubes are gold, how many of the small cubes, and a number for which
}
@group(0) @binding(0) var<uniform> U: Params;
@group(0) @binding(1) var<storage, read> cells: array<u32>;

const WORDS = 4;
const PI = 3.14159265;

var<private> seed: u32;
fn rnd() -> f32 {
  seed = seed * 747796405u + 2891336453u;
  let w = ((seed >> ((seed >> 28u) + 4u)) ^ seed) * 277803737u;
  return f32((w >> 22u) ^ w) / 4294967296.0;
}

//#shapes

struct Hit {
  t: f32,
  n: vec3f,
  met: bool,
  what: u32, // 0: clay. 8: lit (it gives light). 9: gold
}

// the same number for the same thing, and a different one for every other: what each line of cubes, room or
// small cube is
fn chance(a: u32, b: u32) -> f32 {
  var h = (a * 747796405u) ^ ((b + 0x9e3779b9u) * 2654435761u) ^ u32(U.mix.z);
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return f32(h) / 4294967296.0;
}
// On the flat pile a column, cubes and all, is gold or clay. A ball has no one up: here it is a line of cubes
// going out from the middle along the axis it is farthest along (which is up, for whoever stands there), and what
// stands in the cells of it
fn goldOf(cell: vec3i) -> u32 {
  let m = abs(vec3f(cell) + 0.5);
  let a = select(select(2, 1, m.y >= m.z), 0, m.x >= m.y && m.x >= m.z);
  let rest = select(select(cell.xy, cell.zx, a == 1), cell.yz, a == 0) + vec2i(128);
  // (and which side of the middle it is on: the two halves of a line are two lines)
  let key = u32(a) + 3u * (u32(rest.x) + 256u * (u32(rest.y) + 256u * u32(select(0, 1, cell[a] >= 0))));
  return select(0u, 9u, chance(key, 1u) < U.mix.x);
}

fn trace(o: vec3f, r: vec3f) -> Hit {
  var out: Hit;
  out.met = false;
  let dir = vec3f(select(r.x, 1e-6, abs(r.x) < 1e-6), select(r.y, 1e-6, abs(r.y) < 1e-6), select(r.z, 1e-6, abs(r.z) < 1e-6));
  let inv = 1.0 / dir;
  // into the grid, if the ray starts outside it
  let h = U.right.w;
  let ta = (vec3f(-h) - o) * inv;
  let tb = (vec3f(h) - o) * inv;
  let lo = min(ta, tb);
  let hi = max(ta, tb);
  let into = max(lo.x, max(lo.y, lo.z));
  let outOf = min(hi.x, min(hi.y, hi.z));
  if (outOf <= max(into, 0.0)) { return out; }
  var enter = 0.0;
  var axis = -1;
  if (into > 0.0) {
    enter = into;
    axis = select(select(2, 1, lo.y >= lo.z), 0, lo.x >= lo.y && lo.x >= lo.z);
  }
  let way = vec3i(sign(dir));
  let edge = i32(h);
  var cell = clamp(vec3i(floor(o + dir * (enter + 1e-4))), vec3i(-edge), vec3i(edge - 1));
  var next = (vec3f(cell) + max(sign(dir), vec3f(0.0)) - o) * inv;
  let g = i32(U.up.w);
  for (var n = 0; n < 160; n++) {
    if (any(cell < vec3i(-edge)) || any(cell >= vec3i(edge))) { return out; }
    let at = cell + vec3i(edge);
    let c = ((at.z * g + at.y) * g + at.x) * WORDS;
    let what = cells[c];
    let leave = min(next.x, min(next.y, next.z));
    let corner0 = vec3f(cell);
    if ((what & 1u) != 0u) {
      // a full cube. Which arch, if any, is cut into the face the ray comes in by
      // (one for each of its three outward faces: a ray that starts in here is in one of their rooms)
      var word = 0u;
      var other = 0u;
      var inside = false;
      let p0 = o + dir * enter - corner0;
      let outward = sign(vec3f(cell) + 0.5);
      for (var f = 0; f < 3 && !inside; f++) {
        let w = cells[c + 1 + f];
        if ((w & 1u) == 0u) { continue; }
        if (axis < 0) {
          inside = room(p0, w) > 0.0;
        } else if (axis == f && dir[f] * outward[f] < 0.0) {
          let q = laid(p0, (w >> 1u) & 63u);
          inside = outline(q.x, q.y, w) < 0.0;
        }
        if (inside) {
          word = w;
          // its twin in another face of the cube, if it has one
          let twin = (w >> 7u) & 3u;
          if (twin != 0u) { other = cells[c + i32(twin)]; }
        }
      }
      if (!inside) {
        out.met = true;
        out.t = enter;
        out.n = -dir;
        if (axis >= 0) {
          out.n = vec3f(0.0);
          out.n[axis] = -sign(dir[axis]);
        }
        out.what = goldOf(cell);
        return out;
      }
      var t = enter + 0.0005;
      for (var m = 0; m < 40 && t < leave; m++) {
        let p = o + dir * t - corner0;
        let d = rooms(p, word, other);
        if (d < 0.0008) {
          let e = vec2f(0.0015, -0.0015);
          out.met = true;
          out.t = t;
          out.n = normalize(e.xyy * rooms(p + e.xyy, word, other) + e.yyx * rooms(p + e.yyx, word, other) + e.yxy * rooms(p + e.yxy, word, other) + e.xxx * rooms(p + e.xxx, word, other));
          // (a lit room has its light on its back wall, the one that faces out of its mouth: the rest of it is lit by
          // that, as a room is by a lamp)
          let outward = -unlaidWay(vec3f(0.0, 0.0, 1.0), (word >> 1u) & 63u);
          let lit = chance(u32(c), word) < U.glow.w;
          out.what = select(select(goldOf(cell), 0u, lit), 8u, lit && dot(out.n, outward) > 0.8);
          return out;
        }
        t += d;
      }
    } else {
      let kind = (what >> 1u) & 7u;
      if (kind != 0u) {
        let code = (what >> 4u) & 63u;
        let a = laid(o - corner0, code);
        let b = laidWay(dir, code);
        let p = a + b * enter;
        var holds = false;
        var got = Got(-1.0, vec3f(0.0));
        if (kind == 1u) {
          holds = flightHolds(p);
          if (!holds) { got = flightMet(a, b, enter, leave); }
        } else if (kind == 2u) {
          holds = fanHolds(p);
          if (!holds) { got = fanMet(a, b, enter, leave); }
        } else {
          holds = max(p.x, max(p.y, p.z)) < U.small;
          if (!holds) { got = cubeMet(a, b, enter, leave); }
        }
        // (a small cube may be gold; stairs and fans are as their line of cubes is)
        let made = select(goldOf(cell), 9u, kind == 3u && chance(u32(c), 5u) < U.mix.y);
        if (holds) {
          // it came in through the open side of the shape
          out.met = true;
          out.what = made;
          out.t = enter;
          out.n = -dir;
          if (axis >= 0) {
            out.n = vec3f(0.0);
            out.n[axis] = -sign(dir[axis]);
          }
          return out;
        }
        if (got.t >= 0.0) {
          out.met = true;
          out.what = made;
          out.t = got.t;
          out.n = unlaidWay(got.n, code);
          return out;
        }
      }
    }
    if (next.x <= next.y && next.x <= next.z) {
      axis = 0;
      enter = next.x;
      next.x += abs(inv.x);
      cell.x += way.x;
    } else if (next.y <= next.z) {
      axis = 1;
      enter = next.y;
      next.y += abs(inv.y);
      cell.y += way.y;
    } else {
      axis = 2;
      enter = next.z;
      next.z += abs(inv.z);
      cell.z += way.z;
    }
  }
  return out;
}

fn sky(d: vec3f) -> vec3f {
  return mix(U.skyLow.rgb, U.skyHigh.rgb, clamp(dot(d, U.skyUp.xyz) * 0.5 + 0.5, 0.0, 1.0));
}

// a direction about n, more of them near it (as the clay takes light)
fn about(n: vec3f) -> vec3f {
  let a = 2.0 * PI * rnd();
  let z = 2.0 * rnd() - 1.0;
  let r = sqrt(max(1.0 - z * z, 0.0));
  return normalize(n + vec3f(r * cos(a), r * sin(a), z) * 0.999);
}

// the eye sees straight (no nearer is no bigger): a ray for a point of the painted picture, in pixels
struct Ray {
  o: vec3f,
  d: vec3f,
}
fn eye(px: vec2f) -> Ray {
  let s = (px - 0.5 * U.size) / U.scale;
  return Ray(U.right.xyz * s.x - U.up.xyz * s.y - U.fore.xyz * 2.0 * U.right.w, U.fore.xyz);
}

// Where a ray goes on from gold, as far as the first thing that is not gold (up to five turns: folds of gold
// face one another), and what it brings: the colour of the gold it met. A ray lost among them is `met` and
// `what` 9
struct Seen {
  hit: Hit,
  o: vec3f,
  d: vec3f,
  carry: vec3f,
  mirrored: bool,
}
fn onFrom(o0: vec3f, d0: vec3f) -> Seen {
  var s: Seen;
  s.o = o0;
  s.d = d0;
  s.carry = vec3f(1.0);
  s.mirrored = false;
  for (var turns = 0; turns < 6; turns++) {
    s.hit = trace(s.o, s.d);
    if (!s.hit.met || s.hit.what != 9u) { return s; }
    if (turns == 5) { return s; }
    s.o = s.o + s.d * s.hit.t + s.hit.n * 0.002;
    s.d = reflect(s.d, s.hit.n);
    s.carry *= U.metal.rgb;
    s.mirrored = true;
  }
  return s;
}
// what a ray that is not met sees: the sky, and the sun itself if gold turned it there. (Seen in gold the sky is
// made brighter, `metal.w` times, for the eye only: on the flat pile gold mostly faces more of the pile, on a ball
// it mostly faces the sky, and a dim sky in it looked like dull bronze. The light gold throws onto the clay
// about it is as it is)
fn away(d: vec3f, mirrored: bool, shown: bool) -> vec3f {
  var c = sky(d);
  if (mirrored) {
    if (shown) { c *= U.metal.w; }
    if (dot(d, U.sun.xyz) > cos(U.sun.w)) { c += U.sunTone.rgb / (2.0 * PI * (1.0 - cos(U.sun.w))); }
  }
  return c;
}

// one sample of the light on a point of the ball: the sun somewhere on its disc, the sky, three bounces off the
// clay (gold on the way turns a ray, and a lit room is light)
fn sample(here: vec3f, n0: vec3f) -> vec3f {
  var got = vec3f(0.0);
  var carry = U.clay.rgb;
  var o = here + n0 * 0.002;
  var n = n0;
  for (var bounce = 0; bounce < 3; bounce++) {
    let a = 2.0 * PI * rnd();
    let w = U.sun.w * sqrt(rnd());
    let side = normalize(cross(U.sun.xyz, vec3f(0.3, 1.0, 0.2)));
    let toSun = normalize(U.sun.xyz + (side * cos(a) + cross(U.sun.xyz, side) * sin(a)) * w);
    let facing = dot(n, toSun);
    if (facing > 0.0 && !trace(o, toSun).met) { got += carry * U.sunTone.rgb * facing; }
    // what further bounces would have brought, roughly
    if (bounce == 2) {
      got += carry * U.skyLow.rgb * 0.5;
      break;
    }
    let s = onFrom(o, about(n));
    carry *= s.carry;
    if (!s.hit.met) {
      got += carry * away(s.d, s.mirrored, false);
      break;
    }
    if (s.hit.what == 8u) {
      got += carry * U.glow.rgb;
      break;
    }
    if (s.hit.what == 9u) {
      got += carry * U.skyLow.rgb * 0.5; // (lost among mirrors: what it would have seen, roughly)
      break;
    }
    o = s.o + s.d * s.hit.t + s.hit.n * 0.002;
    n = s.hit.n;
    carry *= U.clay.rgb;
  }
  return got;
}

// ---- the table
fn hash(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
// a texel's slot (where to start looking), and what is written there to say it is this texel and no other: two
// hashes made apart, so that two texels are taken for one only if both agree
struct Key {
  slot: u32,
  check: u32,
}
fn keyOf(k: i32, a: i32, b: i32, c: i32) -> Key {
  var h = hash(bitcast<u32>(k) ^ 0x9e3779b9u);
  var g = hash(bitcast<u32>(k) + 0x7f4a7c15u);
  h = hash(h ^ bitcast<u32>(a));
  g = hash(g + bitcast<u32>(a) * 0x85ebca6bu);
  h = hash(h ^ bitcast<u32>(b));
  g = hash(g + bitcast<u32>(b) * 0xc2b2ae35u);
  h = hash(h ^ bitcast<u32>(c));
  g = hash(g + bitcast<u32>(c) * 0x27d4eb2fu);
  return Key(h & (u32(U.more.x) - 1u), g | 1u);
}
// the axis a face looks along, or -1 for one that looks along none
fn along(n: vec3f) -> i32 {
  let m = abs(n);
  if (m.x > 0.999) { return 0; }
  if (m.y > 0.999) { return 1; }
  if (m.z > 0.999) { return 2; }
  return -1;
}
// where a point is in the plane of a face that looks along axis a, in texels, less a half: the four texels
// nearest it are then the floor of this and the floor plus one
fn inPlane(p: vec3f, a: i32) -> vec2f {
  var q = p.xy;
  if (a == 0) { q = p.yz; }
  if (a == 1) { q = p.zx; }
  return q * U.texel - 0.5;
}
// a texel of a flat face: which way it looks, how deep its plane is (in 32nds of a cube: faces that look the same
// way are never nearer than a twelfth), and where in that plane
fn flatKey(p: vec3f, n: vec3f, a: i32, at: vec2i) -> Key {
  return keyOf(a * 2 + select(0, 1, n[a] > 0.0) + 8 * i32(round(p[a] * 32.0)), at.x, at.y, 0);
}
// a texel of a face that is not flat to an axis: a small cube of space, and which way the face looks (of 64)
fn roundKey(p: vec3f, n: vec3f) -> Key {
  var o = n.xy / (abs(n.x) + abs(n.y) + abs(n.z));
  if (n.z < 0.0) { o = (1.0 - abs(o.yx)) * select(vec2f(-1.0), vec2f(1.0), o >= vec2f(0.0)); }
  let bin = vec2i(clamp((o * 0.5 + 0.5) * 8.0, vec2f(0.0), vec2f(7.0)));
  let at = vec3i(floor(p * U.texel * 0.5));
  return keyOf(6 + 8 * (bin.x + 8 * bin.y), at.x, at.y, at.z);
}
