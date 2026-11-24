// the vessel: a ray per pixel through nested skins of glass strands. Each skin is the web's flood field
// wrapped round the outline: distance to the nearest strand point along the skin, with height off the skin,
// minus that strand's radius. Thorns grow from knots. Fibres let most light through, so layers show
// behind layers, and a cyan glow sits in the middle where the light gathers.

@group(0) @binding(1) var<storage, read> strands: array<vec4f>;
@group(0) @binding(2) var<storage, read> knotField: array<vec4f>;

/** half a pixel at the current distance: thinner strands are drawn this wide but fainter */
var<private> PIXR: f32;
/** how much of the drawn width the nearest strand really fills */
var<private> COVER: f32;
/** the nearest strand's surface normal, exact for a round tube, and its drawn radius */
var<private> NRM: vec3f;
var<private> RAD: f32;

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn roundCone(q: vec2f, r1: f32, r2: f32, h: f32) -> f32 {
  let b = (r1 - r2) / h;
  let a = sqrt(1.0 - b * b);
  let k = dot(q, vec2f(-b, a));
  if (k < 0.0) { return length(q) - r1; }
  if (k > a * h) { return length(q - vec2f(0.0, h)) - r2; }
  return dot(q, vec2f(a, b)) - r1;
}

fn thorn(p: vec3f, around: f32, vc: f32) -> f32 {
  let kw = i32(U.W) / 4;
  let kh = (i32(U.H) + 3) / 4;
  let kx = ((i32(floor(around * U.W / 4.0)) % kw) + kw) % kw;
  let ky = clamp(i32(floor(vc * (U.H - 1.0) / 4.0)), 0, kh - 1);
  let k = knotField[u32(ky * kw + kx)];
  if (k.w <= 0.0) { return 1e9; }
  let th = thornOf(k);
  let q = p - th.B;
  let h = dot(q, th.a);
  return roundCone(vec2f(length(q - th.a * h), h), th.r1, 0.0007, th.len);
}

/** (distance, which: 0 outer skin, 1 inner skins, 2 thorns) */
fn sdf(p: vec3f) -> vec2f {
  let rr = length(p.xz);
  let v = (p.y - U.y0) / U.Hlen;
  let th = fract(atan2(p.z, p.x) / TAU + U.rot);
  let ix = i32(th * U.W);
  let vc = clamp(v, 0.0, 1.0);
  let iy = i32(round(vc * (U.H - 1.0)));
  var best = vec2f(1e9, 0.0);
  var cover = 1.0;
  var nrm = vec3f(0.0);
  var rad = 0.0;
  for (var L = 0; L < i32(U.layers); L++) {
    COVER = 1.0;
    let R = skinR(vc, L);
    let band = abs(rr - R);
    // no strand near: at least this far, and beyond the rims by however far past them the point is
    var d = max(max(band, 0.05) - 0.02, max(-v, v - 1.0) * U.Hlen);
    if (band < 0.05) {
      // the nearest seed held by any of the four texels round the point, so the surface does not step
      // where the point crosses from one texel to the next
      let fx = th * U.W - 0.5;
      let fy = vc * (U.H - 1.0) - 0.5;
      let bx = i32(floor(fx));
      let by = i32(floor(fy));
      // nearest seed first, by plain distance; then only its capsule along the strand
      var bs = vec4f(0.0, 0.0, 0.0, -1.0);
      var bo = vec2f(0.0);
      var bdd = 1e9;
      let mx = TAU * R / U.W;
      let my = U.Hlen / (U.H - 1.0);
      for (var k = 0; k < 4; k++) {
        let s = strands[cell(bx + (k & 1), by + (k >> 1), L)];
        if (s.w > 0.0) {
          let o = vec2f(wrapd(th * U.W - s.x) * mx, p.y - (U.y0 + s.y * my));
          let dd = dot(o, o) - s.z * s.z;
          if (dd < bdd) {
            bdd = dd;
            bs = s;
            bo = o;
          }
        }
      }
      if (bs.w > 0.0) {
        let ang = bs.w - 1.0;
        let tw = vec2f(cos(ang) * mx, sin(ang) * my);
        let tl = length(tw);
        let tn = tw / tl;
        let e = bo - tn * clamp(dot(bo, tn), -tl * 0.8, tl * 0.8);
        let rr2 = max(bs.z, PIXR);
        d = sqrt(dot(e, e) + band * band) - rr2;
        COVER = bs.z / rr2;
        RAD = rr2;
        // from the strand's axis to the point: round the skin, up it, and off it
        let phi = atan2(p.z, p.x);
        NRM = vec3f(-sin(phi), 0.0, cos(phi)) * e.x + vec3f(0.0, e.y, 0.0) + vec3f(cos(phi), 0.0, sin(phi)) * (rr - R);
      }
    }
    if (d < best.x) {
      best = vec2f(d, select(1.0, 0.0, L == 0));
      cover = COVER;
      nrm = NRM;
      rad = RAD;
    }
  }
  // thorns stand off the outer skin, threads hang below it
  let R0 = skinR(vc, 0);
  if (rr > R0 - 0.03 && rr - R0 < U.thornLen * 2.7 + 0.02 && v > -(U.tendril + 0.05) / U.Hlen && v < 1.0 + (U.thornLen * 2.7 + 0.02) / U.Hlen) {
    let d = thorn(p, th, vc);
    if (d < best.x) {
      best = vec2f(d, 2.0);
      cover = 1.0;
    }
  }
  COVER = cover;
  NRM = nrm;
  RAD = rad;
  return best;
}

fn normalAt(p: vec3f) -> vec3f {
  let e = vec2f(1.0, -1.0) * 0.0008;
  return normalize(e.xyy * sdf(p + e.xyy).x + e.yyx * sdf(p + e.yyx).x + e.yxy * sdf(p + e.yxy).x + e.xxx * sdf(p + e.xxx).x);
}

fn background(rd: vec3f, uv: vec2f) -> vec3f {
  let up = rd.y * 0.5 + 0.5;
  var c = mix(vec3f(0.0015, 0.004, 0.011), vec3f(0.006, 0.016, 0.036), up);
  // a soft lighter haze behind the vessel
  c += vec3f(0.006, 0.02, 0.04) * exp(-dot(uv - vec2f(0.5, 0.45), uv - vec2f(0.5, 0.45)) * 6.0);
  return c;
}

fn corePos() -> vec3f { return vec3f(0.0, U.y0 + U.coreY * U.Hlen, 0.0); }

fn shade(p: vec3f, n: vec3f, rd: vec3f, kind: f32) -> vec4f {
  let ndv = abs(dot(n, rd));
  let rim = pow(1.0 - ndv, 2.2);
  // a key light from above and behind, a cool fill from the left
  let K = normalize(vec3f(-0.4, 0.8, -0.5));
  let Fl = normalize(vec3f(-0.8, 0.1, 0.5));
  let spec = pow(max(dot(reflect(rd, n), K), 0.0), 70.0) * 3.0 + pow(max(dot(reflect(rd, n), Fl), 0.0), 40.0) * 0.6;
  // the glow in the middle lights the strands that face it
  let tc = corePos() - p;
  let dc = length(tc);
  let core = U.coreI * (0.55 + 0.45 * dot(n, tc / dc)) / (1.0 + dc * dc / (U.coreSize * U.coreSize * 4.0));
  let inner = select(0.6, 1.4, kind == 1.0);
  // the near side crisp and white, the far side seen through the glass, dimmer and lit cyan from inside
  let radial = normalize(vec3f(p.x, 0.0, p.z) + vec3f(1e-5, 0.0, 0.0));
  let far = smoothstep(-0.2, 0.5, dot(radial, vec3f(U.fX, 0.0, U.fZ)) / max(length(vec2f(U.fX, U.fZ)), 1e-3));
  let white = vec3f(0.8, 0.9, 1.0) * (0.05 + 0.9 * rim) * mix(1.0, 0.35, far) + vec3f(0.95, 0.98, 1.0) * spec * mix(1.0, 0.3, far);
  var c = white + vec3f(0.25, 0.95, 1.0) * core * inner * mix(0.5, 0.9, far);
  let a = clamp(U.alpha * (0.45 + 0.8 * rim), 0.0, 0.95);
  return vec4f(c, a);
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let ndc = vec2f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0) + vec2f(U.jx, U.jy) * 2.0 / vec2f(U.rW, U.rH);
  let F = vec3f(U.fX, U.fY, U.fZ);
  let R = vec3f(U.rX, U.rY, U.rZ);
  let Up = vec3f(U.uX, U.uY, U.uZ);
  let rd = normalize(F + R * ndc.x * U.tanFov * U.aspect + Up * ndc.y * U.tanFov);
  let ro = vec3f(U.camX, U.camY, U.camZ);
  let bg = background(rd, in.uv);

  // the glow in the middle, all along the ray, laid in where the ray passes closest to it
  let pc = corePos();
  let tc = dot(pc - ro, rd);
  let dperp = length(ro + rd * tc - pc);
  let glow = vec3f(0.2, 0.85, 1.0) * U.coreI * 0.5 * exp(-dperp * dperp / (U.coreSize * U.coreSize));

  // only march inside the vessel's bounding cylinder
  let Rb = U.Rmax * 1.05 + U.thornLen * 2.7 + 0.03;
  let yb0 = U.y0 - U.tendril - 0.05;
  let yb1 = U.y0 + U.Hlen + U.thornLen * 2.7;
  let a = dot(rd.xz, rd.xz);
  let b = dot(ro.xz, rd.xz);
  let c = dot(ro.xz, ro.xz) - Rb * Rb;
  let disc = b * b - a * c;
  if (disc < 0.0) { return vec4f(bg + glow, 1e4); }
  var t0 = (-b - sqrt(disc)) / a;
  var t1 = (-b + sqrt(disc)) / a;
  let ty0 = (yb0 - ro.y) / rd.y;
  let ty1 = (yb1 - ro.y) / rd.y;
  t0 = max(t0, min(ty0, ty1));
  t1 = min(t1, max(ty0, ty1));
  if (t1 <= t0) { return vec4f(bg + glow, 1e4); }

  var col = vec3f(0.0);
  var T = 1.0;
  var t = max(t0, 0.0);
  var coreDone = false;
  // the first strand's distance, for the anti-aliasing to follow it as the vessel turns
  var tFirst = 1e4;
  for (var i = 0; i < 180; i++) {
    if (t > t1 || T < 0.02) { break; }
    if (!coreDone && t > tc) {
      col += T * glow;
      coreDone = true;
    }
    let p = ro + rd * t;
    let pix = U.pix * t;
    PIXR = pix * 0.5;
    let s = sdf(p);
    let cover = COVER;
    let nrm = NRM;
    let rad = RAD;
    // strands too thin for a pixel still glow faintly as the ray passes them
    if (s.x < pix * 4.0) { col += T * vec3f(0.55, 0.8, 1.0) * U.halo * exp(-max(s.x, 0.0) / pix) * 0.025; }
    if (s.x < pix * 0.6) {
      // strands know their normal; only thorns need it worked out
      var n = normalAt(p);
      if (s.y < 2.0 && dot(nrm, nrm) > 1e-12) { n = normalize(nrm); }
      let sh = shade(p, n, rd, s.y);
      let al = sh.a * cover;
      if (tFirst > 9e3 && al > 0.15) { tFirst = t; }
      col += T * al * sh.rgb;
      T *= 1.0 - al;
      // out the far side: a strand is a tube of known radius; a thorn is stepped through
      if (s.y < 2.0) {
        t += 2.0 * rad + pix;
      } else {
        t += pix;
        for (var j = 0; j < 12; j++) {
          let d = sdf(ro + rd * t).x;
          if (d > 0.0) { break; }
          t += max(-d, pix * 0.7);
        }
        t += pix;
      }
      continue;
    }
    t += max(s.x * 0.85, pix * 0.5);
  }
  if (!coreDone) { col += T * glow; }
  return vec4f(col + T * bg, tFirst);
}
