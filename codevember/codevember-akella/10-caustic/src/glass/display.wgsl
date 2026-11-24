// the view: white paper under a soft overhead light, the slab floating above it, both traced per pixel.
// Rays through the slab are refracted by its real faces (the underside's height field included), so the
// paper seen through it is bent by the same surface that bends the light.

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read> field: array<vec4f>;
@group(0) @binding(2) var acc: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = p;
  return o;
}

// a dark studio with one big soft light straight above
fn env(d: vec3f) -> vec3f {
  let panel = smoothstep(0.93, 0.975, d.y);
  let rim = smoothstep(0.6, 1.0, d.y) * 0.08;
  // a long softbox behind and above, which the slab's top shows as a band of light
  let band = smoothstep(0.02, 0.0, abs(d.y - 0.42) - 0.07) * smoothstep(0.02, 0.0, abs(d.x) - 0.55) * step(d.z, 0.0);
  // and a dimmer one low to each side, for the edges
  let side = smoothstep(0.03, 0.0, abs(abs(d.x) - 0.93) - 0.04) * smoothstep(0.1, 0.0, abs(d.y - 0.12) - 0.15);
  return vec3f(0.012, 0.013, 0.015) + vec3f(1.0, 0.98, 0.95) * (panel * 6.0 + rim + band * 1.6 + side * 0.7);
}

fn inside(p: vec3f) -> bool {
  return outline(p.xy) < 0.0 && p.z < U.th && p.z > under(p.xy).x;
}

// outward normal of the slab nearest to a point on its surface
fn surfaceNormal(p: vec3f) -> vec3f {
  let dTop = abs(U.th - p.z);
  let dUnder = abs(p.z - under(p.xy).x);
  let dSide = abs(outline(p.xy));
  if (dTop <= dUnder && dTop <= dSide) {
    return vec3f(0.0, 0.0, 1.0);
  }
  if (dUnder <= dSide) {
    return -underNormal(p.xy);
  }
  let e = 0.002;
  let g = vec2f(outline(p.xy + vec2f(e, 0.0)) - outline(p.xy - vec2f(e, 0.0)), outline(p.xy + vec2f(0.0, e)) - outline(p.xy - vec2f(0.0, e)));
  return vec3f(normalize(g), 0.0);
}

// slab-box overlap of a ray, local frame
fn boxSpan(ro: vec3f, rd: vec3f) -> vec2f {
  let lo = vec3f(-U.half, -U.half, U.depth - 0.002);
  let hi = vec3f(U.half, U.half, U.th + 0.002);
  let inv = 1.0 / rd;
  let a = (lo - ro) * inv;
  let b = (hi - ro) * inv;
  let t0 = min(a, b);
  let t1 = max(a, b);
  return vec2f(max(max(t0.x, t0.y), t0.z), min(min(t1.x, t1.y), t1.z));
}

// first change from outside to inside (want = true) or back, along [t0, t1]; -1 if none
fn crossing(ro: vec3f, rd: vec3f, t0: f32, t1: f32, want: bool) -> f32 {
  let steps = 72;
  var prev = t0;
  for (var k = 1; k <= steps; k++) {
    let t = mix(t0, t1, f32(k) / f32(steps));
    if (inside(ro + rd * t) == want) {
      var lo = prev;
      var hi = t;
      for (var b = 0; b < 8; b++) {
        let m = 0.5 * (lo + hi);
        if (inside(ro + rd * m) == want) { hi = m; } else { lo = m; }
      }
      return hi;
    }
    prev = t;
  }
  return -1.0;
}

fn paperGrain(x: vec2f) -> f32 {
  let q = vec2u(vec2i(floor(x * 900.0) + 100000.0));
  let fine = hash01(q.x * 1973u + q.y * 9277u);
  let q2 = vec2u(vec2i(floor(x * 140.0) + 100000.0));
  let coarse = hash01(q2.x * 7919u + q2.y * 104729u);
  return 0.93 + 0.04 * fine + 0.03 * coarse;
}

// light on the paper at x: the direct light, unless the slab is straight above, plus what came through it
fn paper(x: vec3f) -> vec3f {
  let o = toLocal(x);
  let d = dirToLocal(vec3f(0.0, 1.0, 0.0));
  let mid = 0.5 * (U.th + U.depth);
  var direct = 1.0;
  if (abs(d.z) > 1e-4) {
    let hit = o + d * ((mid - o.z) / d.z);
    if ((mid - o.z) / d.z > 0.0) {
      direct = smoothstep(-0.004, 0.004, outline(hit.xy));
    }
  }
  // a pool of light round the slab, falling off into the dark room
  let r = length(x.xz) / U.spotR;
  let spot = 1.0 / (1.0 + r * r * r * r);
  let uv = x.xz / U.phalf * 0.5 + 0.5;
  var through = vec3f(0.0);
  if (all(uv > vec2f(0.0)) && all(uv < vec2f(1.0))) {
    through = textureSampleLevel(acc, smp, uv, 0.0).rgb;
  }
  let E = (vec3f(direct) * spot * U.direct + through) * U.exposure + U.ambient;
  return vec3f(0.92, 0.91, 0.88) * paperGrain(x.xz) * E;
}

fn ground(ro: vec3f, rd: vec3f) -> vec3f {
  if (rd.y >= -1e-4) { return env(rd); }
  return paper(ro + rd * (-ro.y / rd.y));
}

fn shade(ro: vec3f, rd: vec3f) -> vec3f {
  let lo = toLocal(ro);
  let ld = dirToLocal(rd);
  let span = boxSpan(lo, ld);
  if (span.y <= max(span.x, 0.0)) { return ground(ro, rd); }
  let t0 = max(span.x, 0.0);
  let tin = crossing(lo, ld, t0, span.y, true);
  if (tin < 0.0) { return ground(ro, rd); }
  let p = lo + ld * tin;
  let n = surfaceNormal(p);
  let cosi = clamp(-dot(ld, n), 0.0, 1.0);
  let fr = schlick(cosi, U.ior);
  let refl = env(dirToWorld(reflect(ld, n)));

  // through the glass: at most two inner bounces
  var q = p;
  var d = refract(ld, n, 1.0 / U.ior);
  var through = vec3f(0.0);
  var travelled = 0.0;
  var carry = 1.0 - fr;
  for (var b = 0; b < 3; b++) {
    let sp = boxSpan(q, d);
    let tout = crossing(q, d, 0.001, max(sp.y, 0.002), false);
    if (tout < 0.0) { break; }
    let e = q + d * tout;
    travelled += tout;
    let m = surfaceNormal(e);
    let out = refract(d, -m, U.ior);
    if (dot(out, out) > 0.5) {
      let ft = schlick(dot(d, m), 1.0 / U.ior);
      through += carry * (1.0 - ft) * ground(toWorld(e), dirToWorld(out));
      carry *= ft;
      d = reflect(d, -m);
    } else {
      d = reflect(d, -m);
    }
    q = e;
  }
  // a faint green in the thickness, as window glass has
  let absorb = exp(-travelled * vec3f(1.2, 0.5, 0.8) * U.glassTint);
  return fr * refl + through * absorb;
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let ndc = in.uv * 2.0 - 1.0;
  let fwd = vec3f(U.fX, U.fY, U.fZ);
  let right = vec3f(U.rX, U.rY, U.rZ);
  let up = vec3f(U.uX, U.uY, U.uZ);
  let rd = normalize(fwd + right * ndc.x * U.tanFov * U.aspect + up * ndc.y * U.tanFov);
  var col = shade(vec3f(U.camX, U.camY, U.camZ), rd);
  col *= 1.0 - 0.3 * pow(length(in.uv - 0.5) * 1.3, 2.5);
  col = aces(col);
  let n = hash01(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u) - 0.5;
  return vec4f(pow(col, vec3f(1.0 / 2.2)) + n / 255.0, 1.0);
}
