// the HDR image with its glow, the glass drawn faintly over it, tonemapped

@group(0) @binding(1) var hdr: texture_2d<f32>;
@group(0) @binding(2) var glowTex: texture_2d<f32>;
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
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn aces(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), vec3f(0.0), vec3f(1.0));
}

fn planeHit(ro: vec3f, rd: vec3f) -> f32 {
  if (U.planeOn < 0.5) { return 1e9; }
  let N = vec3f(U.planeNX, U.planeNY, U.planeNZ);
  let P0 = vec3f(U.planeX, U.planeY, U.planeZ);
  let den = dot(rd, N);
  if (abs(den) < 1e-6) { return 1e9; }
  let t = dot(P0 - ro, N) / den;
  if (t < 0.0) { return 1e9; }
  let x = ro + rd * t - P0;
  let Ux = vec3f(U.planeUX, U.planeUY, U.planeUZ);
  let uv = vec2f(dot(x, Ux), dot(x, cross(N, Ux))) / U.planeSize;
  if (any(abs(uv) > vec2f(0.5))) { return 1e9; }
  return t;
}

fn shaft(ro: vec3f, rd: vec3f, L: vec3f, tEnd: f32) -> vec3f {
  if (U.shaft <= 0.0) { return vec3f(0.0); }
  // distance from the axis, in the plane across the light
  let o = ro - L * dot(ro, L);
  let d = rd - L * dot(rd, L);
  let a = dot(d, d);
  if (a < 1e-8) { return vec3f(0.0); }
  let b = dot(o, d);
  let c = dot(o, o) - U.spotR * U.spotR;
  let h = b * b - a * c;
  if (h < 0.0) { return vec3f(0.0); }
  let s = sqrt(h);
  var t0 = max((-b - s) / a, 0.0);
  var t1 = min((-b + s) / a, tEnd);
  // only above the glass: the light below it is all in the beams
  let top = -(U.ringR * 0.3);
  let ra = dot(ro, L);
  let rb = dot(rd, L);
  if (abs(rb) > 1e-6) {
    let tc = (top - ra) / rb;
    if (rb > 0.0) { t1 = min(t1, tc); } else { t0 = max(t0, tc); }
  } else if (ra > top) {
    return vec3f(0.0);
  }
  if (t1 <= t0) { return vec3f(0.0); }
  let mid = ro + rd * (t0 + t1) * 0.5;
  let fade = exp(-U.sigma * (0.5 * (t0 + t1)));
  // the spot softens toward its rim
  let r = length(mid - L * dot(mid, L)) / U.spotR;
  return vec3f(1.0, 0.96, 0.9) * U.shaft * (t1 - t0) * phaseHG(dot(rd, -L), U.phaseG) * fade * (1.0 - smoothstep(0.6, 1.0, r) * 0.6);
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  var col = textureLoad(hdr, vec2i(in.pos.xy), 0).rgb + textureSampleLevel(glowTex, smp, in.uv, 0.0).rgb * U.glow;

  let ndc = vec2f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0);
  let pn = U.invViewProj * vec4f(ndc, 0.0, 1.0);
  let pf = U.invViewProj * vec4f(ndc, 1.0, 1.0);
  let ro = vec3f(U.camX, U.camY, U.camZ);
  let rd = normalize(pf.xyz / pf.w - pn.xyz / pn.w);
  let L = normalize(vec3f(U.lightX, U.lightY, U.lightZ));

  // haze: the fog faintly lit everywhere, brightest looking toward the light
  col += vec3f(0.55, 0.65, 0.85) * U.haze * (0.15 + phaseHG(dot(rd, -L), 0.7) * 2.0);
  // the shaft of the spot itself above the glass, as a cylinder of lit fog (its beams aren't drawn)
  col += shaft(ro, rd, L, planeHit(ro, rd));

  // the glass: a faint rim and the light's glint
  let span = sphereSpan(ro, rd, glassBound());
  if (span.x < span.y && span.y > 0.0) {
    var t = max(span.x, 0.0);
    var hit = false;
    for (var i = 0; i < 96; i++) {
      let d = sdGlass(ro + rd * t);
      if (d < 3e-4) {
        hit = true;
        break;
      }
      t += d;
      if (t > span.y) { break; }
    }
    if (hit && t < planeHit(ro, rd)) {
      let n = glassNormal(ro + rd * t);
      let c = abs(dot(n, rd));
      let fres = 0.04 + 0.96 * pow(1.0 - c, 5.0);
      let spec = pow(max(dot(reflect(rd, n), -L), 0.0), 900.0);
      col = col * (1.0 - 0.15 * U.glassRim) + vec3f(0.55, 0.65, 0.8) * fres * U.glassRim * 0.25 + vec3f(1.0, 0.95, 0.85) * spec * U.glassSpec;
    }
  }

  col = aces(col * U.exposure);
  let n = hash01(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u) - 0.5;
  return vec4f(pow(col, vec3f(1.0 / 2.2)) + n / 255.0, 1.0);
}
