// what the camera sees: a dark room, a matte floor holding the light mesh, the beam faintly in the air,
// and the knot itself, refracting the floor and the room in three colours

struct Cam {
  invViewProj: mat4x4f,
  pos: vec4f,
};
@group(0) @binding(2) var<uniform> cam: Cam;
@group(0) @binding(3) var lightTex: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) ndc: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.ndc = p * 2.0 - 1.0;
  return o;
}

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = p - i;
  let u = f * f * (3.0 - 2.0 * f);
  let h = vec2u(vec2i(i) + 4096);
  let a = hash01(h.x * 1973u + h.y * 9277u);
  let b = hash01((h.x + 1u) * 1973u + h.y * 9277u);
  let c = hash01(h.x * 1973u + (h.y + 1u) * 9277u);
  let d = hash01((h.x + 1u) * 1973u + (h.y + 1u) * 9277u);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// the light that fell on the floor at xz
fn floorLight(xz: vec2f) -> vec3f {
  let uv = (xz - vec2f(U.fx0, U.fz0)) / U.fsize;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { return vec3f(0.0); }
  return textureSampleLevel(lightTex, smp, vec2f(uv.x, 1.0 - uv.y), 0.0).rgb;
}

fn floorColour(p: vec3f, dist: f32) -> vec3f {
  // matte plaster: a little mottle, a fine tooth that fades with distance
  let tooth = (vnoise(p.xz * 180.0) - 0.5) * 0.18 / (1.0 + dist * 0.4);
  let mottle = 0.85 + 0.15 * vnoise(p.xz * 2.3) + 0.08 * vnoise(p.xz * 11.0);
  let albedo = vec3f(U.floorR, U.floorG, U.floorB) * (mottle + tooth);
  // the room's light falls off away from the middle
  let room = U.ambient * exp(-dot(p.xz, p.xz) * 0.02);
  return albedo * (room + floorLight(p.xz) * U.exposure);
}

fn room(d: vec3f) -> vec3f {
  // a dark room, and the lamp itself, small and very bright, back along the beam
  let L = lightDir();
  let lamp = pow(max(dot(d, -L), 0.0), 2000.0) * 60.0 + pow(max(dot(d, -L), 0.0), 40.0) * 0.08;
  let g = 0.012 + 0.01 * max(d.y, 0.0);
  return vec3f(g * 0.9, g, g * 1.1) + vec3f(lamp);
}

// what a ray leaving the glass sees: the floor, or the room
fn beyond(o: vec3f, d: vec3f) -> vec3f {
  if (d.y < 0.0) {
    let t = -o.y / d.y;
    return floorColour(o + d * t, t);
  }
  return room(d);
}

// the incoming beam (a round one, or a thin sheet for a slit), faintly in the air above the knot:
// the length of the ray inside it, each bit weighted by how near the knot it is along the beam
fn beamGlow(o: vec3f, d: vec3f, tmax: f32) -> f32 {
  let L = lightDir();
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9);
  let u0 = normalize(cross(L, up));
  let v0 = cross(u0, L);
  let u = u0 * cos(U.slitAngle) + v0 * sin(U.slitAngle);
  let v = -u0 * sin(U.slitAngle) + v0 * cos(U.slitAngle);
  let oc = o - knotCentre();
  // in the beam's cross-section the ray is a 2d line: a + b t
  let a = vec2f(dot(oc, u), dot(oc, v) - select(0.0, U.slitOff * U.beamR, U.slitW > 0.0));
  let bd = vec2f(dot(d, u), dot(d, v));
  var t0 = 0.0;
  var t1 = tmax;
  if (U.slitW > 0.0) {
    let half = vec2f(U.beamR, U.slitW * U.beamR);
    for (var k = 0; k < 2; k++) {
      if (abs(bd[k]) < 1e-6) {
        if (abs(a[k]) > half[k]) { return 0.0; }
      } else {
        let ta = (-half[k] - a[k]) / bd[k];
        let tb = (half[k] - a[k]) / bd[k];
        t0 = max(t0, min(ta, tb));
        t1 = min(t1, max(ta, tb));
      }
    }
  } else {
    let A = dot(bd, bd);
    let B = dot(a, bd);
    let Cc = dot(a, a) - U.beamR * U.beamR;
    let h = B * B - A * Cc;
    if (h < 0.0 || A < 1e-8) { return 0.0; }
    let sq = sqrt(h);
    t0 = max(t0, (-B - sq) / A);
    t1 = min(t1, (-B + sq) / A);
  }
  // only the lamp's side of the knot
  let dl = dot(d, L);
  let tc = -dot(oc, L) / select(dl, 1e-6, abs(dl) < 1e-6);
  if (dl > 0.0) { t1 = min(t1, tc); } else { t0 = max(t0, tc); }
  if (t1 <= t0) { return 0.0; }
  let k = 2.5;
  let s0 = max(-dot(oc + d * t0, L), 0.0);
  let s1 = max(-dot(oc + d * t1, L), 0.0);
  let ds = abs(s1 - s0);
  if (ds < 1e-4) { return (t1 - t0) * exp(-k * s0); }
  return (t1 - t0) * abs(exp(-k * s0) - exp(-k * s1)) / (k * ds);
}

fn acesCurve(x: f32) -> f32 {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
// tone map the brightest channel and keep the hue, so spectral light stays coloured however bright,
// blending a little towards white only at the very top
fn aces(x: vec3f) -> vec3f {
  let m = max(max(x.r, x.g), max(x.b, 1e-6));
  let t = acesCurve(m);
  let hue = x / m;
  return mix(hue * t, vec3f(t), smoothstep(4.0, 30.0, m) * 0.35);
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let far = cam.invViewProj * vec4f(in.ndc, 1.0, 1.0);
  if (U.debug > 0.5) {
    // the light image, seen from straight above
    let xz = vec2f(U.fx0, U.fz0) + (vec2f(in.ndc.x, in.ndc.y) * 0.5 + 0.5) * U.fsize;
    let c = aces(floorLight(xz) * U.exposure);
    return vec4f(pow(c, vec3f(1.0 / 2.2)), 1.0);
  }
  let o = cam.pos.xyz;
  let d = normalize(far.xyz / far.w - o);
  var tmax = 1e4;
  var col = room(d);
  if (d.y < 0.0) {
    tmax = -o.y / d.y;
    col = floorColour(o + d * tmax, tmax);
  }
  let tk = marchOutside(o, d);
  if (tk > 0.0 && tk < tmax) {
    tmax = tk;
    let p = o + d * tk;
    let n = knotNormal(p);
    let cosi = max(-dot(d, n), 0.0);
    let mid = bands[u32(U.bands) / 2u].x;
    let f = fresnel(cosi, 1.0 / mid);
    var through = vec3f(0.0);
    // red, green and blue each take their own way through
    for (var ch = 0; ch < 3; ch++) {
      let bi = select(select(0u, u32(U.bands) / 2u, ch == 1), u32(U.bands) - 1u, ch == 0);
      let ior = bands[bi].x;
      var q = p;
      var dd = refract(d, n, 1.0 / ior);
      var seen = vec3f(0.0);
      for (var k = 0; k < 4; k++) {
        let ti = marchInside(q, dd);
        if (ti < 0.0) { break; }
        q += dd * ti;
        let nn = knotNormal(q);
        let r = refract(dd, -nn, ior);
        if (dot(r, r) < 1e-8) {
          dd = reflect(dd, -nn);
          continue;
        }
        seen = beyond(q, r);
        break;
      }
      through[ch] = seen[ch];
    }
    let tint = vec3f(0.92, 0.97, 1.0);
    col = mix(through * tint, room(reflect(d, n)), f) + vec3f(0.004);
    // it hangs in the beam: the lamp glints off it, and its edges catch the light
    let L = lightDir();
    let facing = max(dot(n, -L), 0.0);
    let glint = pow(max(dot(reflect(d, n), -L), 0.0), 90.0) * 6.0;
    let rim = pow(1.0 - cosi, 3.0) * (0.15 + 0.6 * facing);
    col += vec3f(1.0, 0.97, 0.92) * (glint + rim) * U.glassLight;
    // where the slit cuts the glass it glows, a line of light drawn across the knot
    if (U.slitW > 0.0) {
      let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9);
      let u0 = normalize(cross(L, up));
      let v0 = cross(u0, L);
      let v = -u0 * sin(U.slitAngle) + v0 * cos(U.slitAngle);
      let off = abs(dot(p - knotCentre(), v) - U.slitOff * U.beamR) / (U.slitW * U.beamR);
      let lit = (1.0 - smoothstep(0.6, 1.4, off)) * (0.3 + facing);
      col += vec3f(1.0, 0.96, 0.9) * lit * U.glassLight * 1.5;
    }
  }
  col += vec3f(1.0, 0.97, 0.92) * beamGlow(o, d, tmax) * U.haze * U.power;
  col = aces(col);
  let n = hash01(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u) - 0.5;
  return vec4f(pow(col, vec3f(1.0 / 2.2)) + n / 255.0, 1.0);
}
