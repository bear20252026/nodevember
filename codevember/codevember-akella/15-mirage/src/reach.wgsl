// Where a ray reaches the ground.
//
// `tops` holds, for every 2 m square of the ground, the highest point in it and the steepest slope, and in its
// smaller levels the same for squares of 4, 8, 16 ... metres. A ray that stays above a square's top passes it in
// one go, and tries a bigger square next; one that does not looks into the four smaller ones. So a low ray over
// flat sand, which a plain march creeps along for hundreds of steps, takes a few dozen.
//
// In the smallest squares the ground itself is read, and the steepest slope there says how far the ray can
// safely go before reading it again: nothing is stepped through, however thin.

const TOPL = 11; // the level of `tops` that is a single texel: the top of everything

var<private> work: f32; // how many looks at the ground this pixel has cost

struct Reach {
  t: f32, // how far along the ray the ground is, or -1
  near: f32, // the closest it came to the ground before that (or at all), in widths of the ray's cone
};

// `cone` is how fast the ray widens (the size of a pixel, or of the sun), `lead` how far it had come before `ro`
fn reach(ro: vec3f, rd: vec3f, t0: f32, t1: f32, cone: f32, lead: f32) -> Reach {
  let top = textureLoad(tops, vec2i(0), TOPL).x;
  var found = Reach(-1.0, 1e9);
  var t = t0;
  var end = t1;
  let y0 = ro.y + rd.y * t;
  if (rd.y >= 0.0) {
    if (y0 > top) {
      return found;
    }
    if (rd.y > 1e-6) {
      end = min(end, (top - ro.y) / rd.y);
    }
  } else if (y0 > top) {
    t = (top - ro.y) / rd.y;
  }
  let d2 = rd.xz;
  let run = length(d2);
  let inv = vec2f(select(1e20, 1.0 / abs(d2.x), abs(d2.x) > 1e-8), select(1e20, 1.0 / abs(d2.y), abs(d2.y) > 1e-8));
  let ahead = step(vec2f(0.0), d2);
  let nudge = 0.004 / max(run, 1e-3);
  var level = 4;
  var before = 1e9; // the reading before this one, and whether the ray was closing on the ground then
  var closing = false;
  for (var i = 0; i < 200; i++) {
    if (t >= end) {
      break;
    }
    work += 1.0;
    // far off, a square a few pixels across is not worth looking into: the ground is read there anyway
    let least = i32(clamp(floor(log2(max(4.0 * (lead + t) * cone / CELL, 1.0))), 0.0, 6.0));
    level = max(level, least);
    let s = CELL * f32(1u << u32(level));
    let p = ro + rd * t;
    let q = p.xz + 0.5 * SPAN;
    // (which square it is in is asked a hair further on, the way it is going: a ray that runs along an edge
    // between two squares is then in one of them for good, and never stuck on the edge)
    let cell = floor((q + (ahead * 2.0 - 1.0) * 6e-4) / s);
    let dts = abs((cell + ahead) * s - q) * inv;
    let te = min(t + min(dts.x, dts.y) + nudge, end);
    let wide = cone * (lead + te);
    let m = textureLoad(tops, vec2i(cell) & vec2i((CELLS >> u32(level)) - 1), level);
    // has it crossed into a new bigger square, too? then that one is worth a try
    let side = i32(select(cell.y + ahead.y, cell.x + ahead.x, dts.x < dts.y));
    let wider = (side & 1) == 0 && level < TOPL - 2;
    if (min(p.y, ro.y + rd.y * te) - wide > m.x) {
      t = te;
      level += i32(wider);
      continue;
    }
    if (level > least) {
      level -= 1;
      continue;
    }
    // the ground itself
    let closes = m.y * run - rd.y; // how fast the gap can close, at most
    var ta = t;
    var last = t;
    for (var k = 0; k < 8; k++) {
      work += 2.0;
      let pa = ro + rd * ta;
      let gap = pa.y - ground(pa.xz);
      let r = cone * (lead + ta) + 1e-4;
      let ratio = gap / r;
      if (gap < 0.002) {
        if (gap < 0.0 && ta > last) {
          // stepped in (only the least step allowed can): find where
          var lo = last;
          var hi = ta;
          for (var b = 0; b < 5; b++) {
            let mid = 0.5 * (lo + hi);
            let pm = ro + rd * mid;
            if (pm.y - ground(pm.xz) < 0.0) {
              hi = mid;
            } else {
              lo = mid;
            }
          }
          ta = hi;
        }
        found.t = ta;
        return found;
      }
      // a low point passed over (the gap was closing, and now opens) is a near miss
      if (ratio > before && closing) {
        found.near = min(found.near, before);
      }
      closing = ratio < before;
      before = ratio;
      if (closes <= 0.0) {
        ta = te;
        break;
      }
      last = ta;
      ta = min(ta + max(gap / closes, max(0.02, 0.5 * r)), te);
      if (ta >= te) {
        break;
      }
    }
    t = ta;
    if (ta >= te) {
      level += i32(wider);
    }
  }
  if (closing) {
    found.near = min(found.near, before);
  }
  return found;
}
