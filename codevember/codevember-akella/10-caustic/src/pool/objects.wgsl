// rays against the things in the pool: balls, stones and marbles are ellipsoids, petals are flat

@group(0) @binding(1) var<storage, read> objs: array<Obj>;

struct Hit {
  t: f32,
  i: u32,
  n: vec3f,
  // where on the object, in its own frame (unit sphere, or the petal's outline coordinates)
  lp: vec3f,
};

/** a sakura petal, base at y = -1, the notched tip at y = 1 */
fn petalIn(u: vec2f) -> bool {
  let w = 0.62 * (0.32 + 0.68 * smoothstep(-1.0, 0.45, u.y));
  if ((u.x * u.x) / (w * w) + u.y * u.y > 1.0) { return false; }
  return u.y < 0.74 + 1.3 * abs(u.x);
}

fn objHit(i: u32, ro: vec3f, rd: vec3f) -> Hit {
  let o = objs[i];
  var h: Hit;
  h.t = -1.0;
  h.i = i;
  // nothing near the ray: skip early
  let rel = ro - o.a.xyz;
  let bound = o.a.w * max(o.c.x, max(o.c.y, o.c.z));
  let bb = dot(rel, rd);
  let cc = dot(rel, rel) - bound * bound;
  if (bb * bb - cc < 0.0 || (cc > 0.0 && bb > 0.0)) { return h; }

  let qi = vec4f(-o.q.xyz, o.q.w);
  let lo = qrot(qi, rel);
  let ld = qrot(qi, rd);
  if (u32(o.b.w) == 3u) {
    if (abs(ld.y) < 1e-6) { return h; }
    let t = -lo.y / ld.y;
    if (t <= 1e-4) { return h; }
    let u = (lo.xz + ld.xz * t) / o.a.w;
    if (!petalIn(u)) { return h; }
    h.t = t;
    h.lp = vec3f(u.x, 0.0, u.y);
    var n = qrot(o.q, vec3f(0.0, 1.0, 0.0));
    if (dot(n, rd) > 0.0) { n = -n; }
    h.n = n;
    return h;
  }
  let s = o.c.xyz * o.a.w;
  let so = lo / s;
  let sd = ld / s;
  let a = dot(sd, sd);
  let b = dot(so, sd);
  let c = dot(so, so) - 1.0;
  let disc = b * b - a * c;
  if (disc < 0.0) { return h; }
  let sq = sqrt(disc);
  var t = (-b - sq) / a;
  if (t <= 1e-4) {
    t = (-b + sq) / a;
    if (t <= 1e-4) { return h; }
  }
  let lp = so + sd * t;
  h.t = t;
  h.lp = lp;
  h.n = normalize(qrot(o.q, lp / s));
  return h;
}

/** the nearest object along the ray, petals optional */
fn trace(ro: vec3f, rd: vec3f, tmax: f32, petals: bool) -> Hit {
  var best: Hit;
  best.t = -1.0;
  var tb = tmax;
  for (var i = 0u; i < u32(U.nObj); i++) {
    if (!petals && u32(objs[i].b.w) == 3u) { continue; }
    let h = objHit(i, ro, rd);
    if (h.t > 0.0 && h.t < tb) {
      tb = h.t;
      best = h;
    }
  }
  return best;
}

/** light let through towards the sun: (amount, how pink) */
fn shadow(ro: vec3f, rd: vec3f) -> vec2f {
  var lum = 1.0;
  var pink = 0.0;
  for (var i = 0u; i < u32(U.nObj); i++) {
    let h = objHit(i, ro, rd);
    if (h.t <= 0.0) { continue; }
    if (u32(objs[i].b.w) == 3u) {
      lum *= 0.5;
      pink = 1.0;
    } else {
      return vec2f(0.0, 0.0);
    }
  }
  return vec2f(lum, pink);
}
