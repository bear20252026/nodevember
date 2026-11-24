// One more sample of light for every pixel of the tile, averaged into what is there already.
//
// The world is a grid of unit cells and every thing in it sits in one cell, so a ray goes from cell to cell and
// only ever asks about the one it is in: a full cube (hit, unless it comes in through the mouth of an arch),
// an empty cell (go on), or a cell with stairs, a fan or a small cube in it (find the way through that one shape).
// Light is the sun, with an edge, and the sky; it bounces off the clay, which is what tints the shade.
//
// And what only light that goes from thing to thing can show: some of the rooms behind the arches are lit from
// within, and their light falls out over the floors and walls about them; some columns, and the small cubes, are
// polished gold, and show the pile, the sky and the lit rooms in them.

struct Params {
  size: vec2f, // the tile, pixels
  period: f32, // columns before the pile repeats
  frame: f32, // samples so far
  top: f32, // no column's g is above this
  steps: f32, // steps in a flight
  turns: f32, // steps in a fan
  small: f32, // side of the small cube
  sun: vec4f, // toward the sun; w: how wide it is (radians)
  sunTone: vec4f,
  skyHigh: vec4f,
  skyLow: vec4f,
  clay: vec4f,
  glow: vec4f, // the light of a lit room; w: how many of the rooms are lit
  metal: vec4f, // the colour of the polished cubes; w: how rough their polish is
  mix: vec4f, // how many columns are polished, how many small cubes, a number from the pile's seed, and how bright the sky is seen in them
}
@group(0) @binding(0) var<uniform> U: Params;
@group(0) @binding(1) var<storage, read> cells: array<u32>;
@group(0) @binding(2) var before: texture_2d<f32>;

const WORDS = 8;
const PI = 3.14159265;

@vertex
fn vert(@builtin(vertex_index) n: u32) -> @builtin(position) vec4f {
  return vec4f(f32(n & 1u) * 4.0 - 1.0, f32(n >> 1u) * 4.0 - 1.0, 0.0, 1.0);
}

var<private> seed: u32;
fn rnd() -> f32 {
  seed = seed * 747796405u + 2891336453u;
  let w = ((seed >> ((seed >> 28u) + 4u)) ^ seed) * 277803737u;
  return f32((w >> 22u) ^ w) / 4294967296.0;
}

fn column(i: i32, k: i32) -> i32 {
  let p = i32(U.period);
  return ((((k % p) + p) % p) * p + (((i % p) + p) % p)) * WORDS;
}

// a point of a cell, laid the way a shape wants it: three flips, then one of six orders of the axes
fn laid(p: vec3f, code: u32) -> vec3f {
  var q = p;
  if ((code & 1u) != 0u) { q.x = 1.0 - q.x; }
  if ((code & 2u) != 0u) { q.y = 1.0 - q.y; }
  if ((code & 4u) != 0u) { q.z = 1.0 - q.z; }
  switch (code >> 3u) {
    case 1u { return q.xzy; }
    case 2u { return q.yxz; }
    case 3u { return q.yzx; }
    case 4u { return q.zxy; }
    case 5u { return q.zyx; }
    default { return q; }
  }
}

// the same for a direction, and back again
fn laidWay(d: vec3f, code: u32) -> vec3f {
  let f = vec3f(select(1.0, -1.0, (code & 1u) != 0u), select(1.0, -1.0, (code & 2u) != 0u), select(1.0, -1.0, (code & 4u) != 0u));
  let q = d * f;
  switch (code >> 3u) {
    case 1u { return q.xzy; }
    case 2u { return q.yxz; }
    case 3u { return q.yzx; }
    case 4u { return q.zxy; }
    case 5u { return q.zyx; }
    default { return q; }
  }
}
fn unlaidWay(d: vec3f, code: u32) -> vec3f {
  let f = vec3f(select(1.0, -1.0, (code & 1u) != 0u), select(1.0, -1.0, (code & 2u) != 0u), select(1.0, -1.0, (code & 4u) != 0u));
  var q = d;
  switch (code >> 3u) {
    case 1u { q = d.xzy; }
    case 2u { q = d.yxz; }
    case 3u { q = d.zxy; }
    case 4u { q = d.yzx; }
    case 5u { q = d.zyx; }
    default {}
  }
  return q * f;
}

// The shapes, each in its own lay (u, v, w), met exactly: a ray from a along b, between t0 and t1.
// (Feeling the way toward them by distance went wrong high above a staircase, where the nearest step is not
// one of the nearest few: rays came to rest a little inside, and their light was shut in.)
struct Got {
  t: f32, // under 0: nothing
  n: vec3f,
}

// stairs: against the wall u = 0 they are a whole cell high, and they come down to the floor at u = 1
fn flightHolds(q: vec3f) -> bool {
  let s = 1.0 / U.steps;
  // (the top step is level with the top of the cell: a ray that comes in there is on it, whatever the last digit says)
  return q.y < 1.0 - clamp(floor(q.x / s), 0.0, U.steps - 1.0) * s + 0.0002;
}
fn flightMet(a: vec3f, b: vec3f, t0: f32, t1: f32) -> Got {
  var got = Got(-1.0, vec3f(0.0));
  var last = t1;
  let s = 1.0 / U.steps;
  for (var m = 0.0; m < U.steps; m += 1.0) {
    let top = 1.0 - m * s;
    if (b.y < 0.0) {
      let t = (top - a.y) / b.y;
      let u = a.x + b.x * t;
      if (t > t0 && t < last && u >= m * s && u <= (m + 1.0) * s) {
        last = t;
        got = Got(t, vec3f(0.0, 1.0, 0.0));
      }
    }
    if (b.x < 0.0) {
      let t = ((m + 1.0) * s - a.x) / b.x;
      let v = a.y + b.y * t;
      if (t > t0 && t < last && v <= top && v >= top - s) {
        last = t;
        got = Got(t, vec3f(1.0, 0.0, 0.0));
      }
    }
  }
  return got;
}

// a fan: steps round the line u = w = 0, climbing as they turn from u toward w
fn fanHolds(q: vec3f) -> bool {
  let wedge = 0.5 * PI / U.turns;
  return q.y < (clamp(floor(atan2(q.z, q.x) / wedge), 0.0, U.turns - 1.0) + 1.0) / U.turns + 0.0002;
}
fn fanMet(a: vec3f, b: vec3f, t0: f32, t1: f32) -> Got {
  var got = Got(-1.0, vec3f(0.0));
  var last = t1;
  let wedge = 0.5 * PI / U.turns;
  for (var m = 0.0; m < U.turns; m += 1.0) {
    let top = (m + 1.0) / U.turns;
    let lo = vec2f(cos(m * wedge), sin(m * wedge));
    let hi = vec2f(cos((m + 1.0) * wedge), sin((m + 1.0) * wedge));
    if (b.y < 0.0) {
      let t = (top - a.y) / b.y;
      let p = a.xz + b.xz * t;
      if (t > t0 && t < last && lo.x * p.y - lo.y * p.x >= 0.0 && hi.x * p.y - hi.y * p.x <= 0.0) {
        last = t;
        got = Got(t, vec3f(0.0, 1.0, 0.0));
      }
    }
    // the upright face between this step and the next: a plane through the line they turn about
    let n = vec2f(hi.y, -hi.x);
    let toward = dot(n, b.xz);
    if (toward < 0.0 && m < U.turns - 0.5) {
      let t = -dot(n, a.xz) / toward;
      let p = a + b * t;
      if (t > t0 && t < last && p.y >= top && p.y <= top + 1.0 / U.turns && dot(p.xz, hi) > 0.0) {
        last = t;
        got = Got(t, vec3f(n.x, 0.0, n.y));
      }
    }
  }
  return got;
}

// a small cube in the corner
fn cubeMet(a: vec3f, b: vec3f, t0: f32, t1: f32) -> Got {
  let inv = 1.0 / b;
  let near = (vec3f(U.small) * step(vec3f(0.0), -b) - a) * inv; // the faces toward the ray (the others are in the walls)
  var got = Got(-1.0, vec3f(0.0));
  var last = t1;
  for (var k = 0; k < 3; k++) {
    if (b[k] >= 0.0) { continue; }
    let t = near[k];
    let p = a + b * t;
    var n = vec3f(0.0);
    n[k] = 1.0;
    let q = p * (vec3f(1.0) - n);
    if (t > t0 && t < last && max(q.x, max(q.y, q.z)) <= U.small) {
      last = t;
      got = Got(t, n);
    }
  }
  return got;
}

// an arch: how far inside its outline (negative inside), in the plane of the face
fn outline(a: f32, b: f32, word: u32) -> f32 {
  let half = f32((word >> 11u) & 31u) / 31.0;
  let lo = f32((word >> 16u) & 31u) / 31.0;
  let hi = f32((word >> 21u) & 31u) / 31.0;
  let x = abs(a - 0.5);
  var d = x - half;
  if (b > hi - half) { d = length(vec2f(x, b - (hi - half))) - half; }
  return max(d, lo - b);
}
// the room behind an arch: distance to its walls from inside (the mouth, at c = 0, is open)
fn room(p: vec3f, word: u32) -> f32 {
  let q = laid(p, (word >> 1u) & 63u);
  var deep = f32((word >> 26u) & 31u) / 31.0;
  // one of two that meet in the cube: in as far as the middle, and half its width more
  if ((word >> 31u) != 0u) { deep = 0.5 + f32((word >> 11u) & 31u) / 31.0; }
  return min(-outline(q.x, q.y, word), deep - q.z);
}
// two rooms that meet are one room
fn rooms(p: vec3f, word: u32, other: u32) -> f32 {
  let d = room(p, word);
  if (other == 0u) { return d; }
  return max(d, room(p, other));
}

struct Hit {
  t: f32,
  n: vec3f,
  met: bool,
  what: u32, // 0: clay. 8: lit (it gives light). 9: polished
}

// the same number for the same thing, and a different one for every other: what each column, room or cube is
fn chance(a: u32, b: u32) -> f32 {
  var h = (a * 747796405u) ^ ((b + 0x9e3779b9u) * 2654435761u) ^ u32(U.mix.z);
  h ^= h >> 16u;
  h *= 0x7feb352du;
  h ^= h >> 15u;
  h *= 0x846ca68bu;
  h ^= h >> 16u;
  return f32(h) / 4294967296.0;
}
// a column, cubes and all, polished, or clay
fn paintOf(c: i32) -> u32 {
  return select(0u, 9u, chance(u32(c), 1u) < U.mix.x);
}

fn trace(o: vec3f, r: vec3f) -> Hit {
  var out: Hit;
  out.met = false;
  let dir = vec3f(select(r.x, 1e-6, abs(r.x) < 1e-6), select(r.y, 1e-6, abs(r.y) < 1e-6), select(r.z, 1e-6, abs(r.z) < 1e-6));
  let inv = 1.0 / dir;
  let way = vec3i(sign(dir));
  var cell = vec3i(floor(o));
  var next = (vec3f(cell) + max(sign(dir), vec3f(0.0)) - o) * inv;
  var enter = 0.0;
  var axis = -1;
  let rising = dir.x + dir.y + dir.z > 0.0;
  for (var n = 0; n < 72; n++) {
    let level = cell.x + cell.y + cell.z;
    if (rising && f32(level) > U.top + 4.0) { return out; }
    let c = column(cell.x, cell.z);
    let g = i32(cells[c]) - 64;
    let leave = min(next.x, min(next.y, next.z));
    let corner0 = vec3f(cell);
    if (level < g) {
      // a full cube. Which arch, if any, is cut into the face the ray comes in by
      // (its top, its wall toward +x, its wall toward +z: a ray that starts in here is in one of their rooms)
      var word = 0u;
      var other = 0u;
      var inside = false;
      let p0 = o + dir * enter - corner0;
      for (var f = 0; f < 3 && !inside; f++) {
        let w = cells[c + 2 + f];
        let below = select(i32((w >> 7u) & 15u), 1, f == 0);
        let face = select(select(2, 0, f == 1), 1, f == 0);
        if ((w & 1u) == 0u || level != g - below) { continue; }
        if (axis < 0) {
          inside = room(p0, w) > 0.0;
        } else if (axis == face && dir[axis] < 0.0) {
          let q = laid(p0, (w >> 1u) & 63u);
          inside = outline(q.x, q.y, w) < 0.0;
        }
        if (inside) {
          word = w;
          // the arch in the cube's other wall, if it is one of a pair
          let v = cells[c + 5 - f];
          if (f > 0 && (w >> 31u) != 0u && (v & 1u) != 0u && (v >> 31u) != 0u && level == g - i32((v >> 7u) & 15u)) { other = v; }
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
        out.what = paintOf(c);
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
          out.what = select(select(paintOf(c), 0u, lit), 8u, lit && dot(out.n, outward) > 0.8);
          return out;
        }
        t += d;
      }
    } else {
      let word = cells[c + 1];
      let kind = word & 15u;
      if (kind != 0u && level - g < i32((word >> 12u) & 15u)) {
        let code = (word >> 4u) & 63u;
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
        // (a small cube may be polished; stairs and fans are as their column is)
        let made = select(paintOf(c), 9u, kind == 3u && chance(u32(c), 5u) < U.mix.y);
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
  let up = clamp(dot(d, normalize(vec3f(0.35, 1.0, 0.35))) * 0.5 + 0.5, 0.0, 1.0);
  return mix(U.skyLow.rgb, U.skyHigh.rgb, up);
}
// the sky as gold shows it. The pile falls away as it goes along x and z, so gold that leans that way shows the
// sky below the horizon, its dark bottom, and it looked like soot in the folds: in gold the sky is never lower
// than at the horizon, and `mix.w` times brighter
fn skyInGold(d: vec3f) -> vec3f {
  let up = clamp(dot(d, normalize(vec3f(0.35, 1.0, 0.35))) * 0.5 + 0.5, 0.5, 1.0);
  return mix(U.skyLow.rgb, U.skyHigh.rgb, up) * U.mix.w;
}

// any direction, all alike
fn anyWay() -> vec3f {
  let a = 2.0 * PI * rnd();
  let z = 2.0 * rnd() - 1.0;
  let r = sqrt(max(1.0 - z * z, 0.0));
  return vec3f(r * cos(a), r * sin(a), z);
}

// a direction about n, more of them near it (as the clay takes light)
fn about(n: vec3f) -> vec3f {
  let a = 2.0 * PI * rnd();
  let z = 2.0 * rnd() - 1.0;
  let r = sqrt(max(1.0 - z * z, 0.0));
  return normalize(n + vec3f(r * cos(a), r * sin(a), z) * 0.999);
}

// the eye looks down the cube diagonal: across the screen is (1, 0, -1), up it (-1, 2, -1)
struct Ray {
  o: vec3f,
  d: vec3f,
}
fn eye(uv: vec2f) -> Ray {
  let s = uv.x * U.period * sqrt(2.0);
  let t = -uv.y * U.period * sqrt(6.0);
  let diag = vec3f(1.0) / sqrt(3.0);
  return Ray(s * vec3f(1.0, 0.0, -1.0) / sqrt(2.0) + t * vec3f(-1.0, 2.0, -1.0) / sqrt(6.0) + diag * (U.top + 3.0) / sqrt(3.0), -diag);
}

// What the middle of each pixel shows: which way the face looks, and how far along the ray it is (under 0: nothing).
// Made once for a pile; the cleaning (clean.wgsl) goes by it
@fragment
fn guide(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let ray = eye(at.xy / U.size);
  let hit = trace(ray.o, ray.d);
  if (!hit.met) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  return vec4f(hit.n, hit.t);
}

@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let px = vec2u(at.xy);
  // (a pixel and its twin half a tile across and half a tile down see the same point of the pile, a repeat on:
  // they are given the same random numbers, so the light comes out the same in both, and the picture can drift
  // by half a tile a loop and close)
  let half = vec2u(U.size) / 2u;
  var twin = px;
  if (px.y >= half.y) { twin = vec2u((px.x + half.x) % u32(U.size.x), px.y - half.y); }
  seed = twin.x + 7919u * (twin.y + 104729u * u32(U.frame));
  rnd();
  seed ^= seed >> 15u;
  rnd();
  let ray = eye((at.xy - 0.5 + vec2f(rnd(), rnd())) / U.size);
  var o = ray.o;
  var d = ray.d;

  var light = vec3f(0.0);
  var direct = 0.0; // how much of the sun's own light reaches what the pixel shows (kept beside the light, for the people's shade)
  var carry = vec3f(1.0);
  var mirrored = false; // the ray was last turned by a polished face (so it can see the sun itself)
  let disc = 2.0 * PI * (1.0 - cos(U.sun.w)); // (how much of the sky the sun takes)
  // three bounces off the clay; a turn off a polished face is not one of them (folds of gold face one another, and
  // a ray can go from fold to fold: counted, it ran out between them and came back black), up to five of those
  var bounce = 0;
  var turns = 0;
  for (var step = 0; step < 9; step++) {
    let hit = trace(o, d);
    if (U.clay.w > 2.5) {
      let at3 = o + d * hit.t;
      return vec4f(mix(textureLoad(before, px, 0).rgb, at3 - floor(at3), 1.0 / (U.frame + 1.0)), 1.0);
    }
    if (U.clay.w > 0.5 && U.clay.w < 1.5) {
      // (for looking at the shapes themselves: the face each pixel shows)
      return vec4f(mix(textureLoad(before, px, 0).rgb, select(vec3f(0.0), hit.n * 0.5 + 0.5, hit.met), 1.0 / (U.frame + 1.0)), 1.0);
    }
    if (!hit.met) {
      light += carry * select(sky(d), skyInGold(d), mirrored);
      if (mirrored && dot(d, U.sun.xyz) > cos(U.sun.w)) { light += carry * U.sunTone.rgb / disc; }
      break;
    }
    // a lit room: its light, and no more
    if (hit.what == 8u) {
      light += carry * U.glow.rgb;
      break;
    }
    let p = o + d * hit.t + hit.n * 0.002;
    // a polished face: the way on is the mirror's way (a little spread), and the sun is seen as it is met
    if (hit.what == 9u) {
      turns++;
      // (lost among mirrors: what it would have seen, roughly)
      if (turns > 5) { light += carry * U.skyLow.rgb * 0.5; break; }
      carry *= U.metal.rgb;
      var r = reflect(d, hit.n) + anyWay() * U.metal.w;
      if (dot(r, hit.n) < 0.0) { r = reflect(r, hit.n); }
      o = p;
      d = normalize(r);
      mirrored = true;
      continue;
    }
    mirrored = false;
    carry *= U.clay.rgb;
    // the sun, somewhere on its disc
    let a = 2.0 * PI * rnd();
    let w = U.sun.w * sqrt(rnd());
    let side = normalize(cross(U.sun.xyz, vec3f(0.0, 1.0, 0.0)));
    let toSun = normalize(U.sun.xyz + (side * cos(a) + cross(U.sun.xyz, side) * sin(a)) * w);
    let facing = dot(hit.n, toSun);
    if (facing > 0.0) {
      let shade = trace(p, toSun);
      if (U.clay.w > 1.5) {
        return vec4f(mix(textureLoad(before, px, 0).rgb, select(vec3f(1.0), vec3f(shade.t * 4.0, shade.n.x * 0.5 + 0.5, shade.n.z * 0.5 + 0.5), shade.met), 1.0 / (U.frame + 1.0)), 1.0);
      }
      if (!shade.met) {
        light += carry * U.sunTone.rgb * facing;
        if (step == 0) { direct = facing; } // (only what the pixel shows itself, not what a mirror shows)
      }
    }
    o = p;
    d = about(hit.n);
    // what further bounces would have brought, roughly
    if (bounce == 2) { light += carry * U.skyLow.rgb * 0.5; break; }
    bounce++;
  }
  return mix(textureLoad(before, px, 0), vec4f(light, direct), 1.0 / (U.frame + 1.0));
}
