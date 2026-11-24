// bloom (a chain of halvings), the tone, and the web lab: the unrolled sheets seen flat

@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var dst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn down(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2f(textureDimensions(dst));
  if (f32(id.x) >= size.x || f32(id.y) >= size.y) { return; }
  let uv = (vec2f(id.xy) + 0.5) / size;
  let ts = 1.0 / vec2f(textureDimensions(src));
  var c = textureSampleLevel(src, smp, uv, 0.0).rgb * 0.5;
  c += textureSampleLevel(src, smp, uv + vec2f(-ts.x, -ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(ts.x, -ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(-ts.x, ts.y), 0.0).rgb * 0.125;
  c += textureSampleLevel(src, smp, uv + vec2f(ts.x, ts.y), 0.0).rgb * 0.125;
  textureStore(dst, vec2i(id.xy), vec4f(c, 1.0));
}

// ---------------------------------------------------------------- temporal anti-aliasing

@group(0) @binding(4) var histIn: texture_2d<f32>;

// colours squeezed by their brightness while they are compared and blended, so a single bright glint
// does not dominate a pixel's history (Karis's trick)
fn squeeze(c: vec3f) -> vec3f { return c / (1.0 + max(c.r, max(c.g, c.b))); }
fn unsqueeze(c: vec3f) -> vec3f { return c / max(1.0 - max(c.r, max(c.g, c.b)), 1e-4); }

/** the history sampled with a Catmull-Rom filter in 9 bilinear taps (Jimenez): bilinear alone softens it a
 * little more every frame it is resampled at fractional positions, and a turning vessel always is */
fn historyAt(uv: vec2f) -> vec3f {
  let size = vec2f(textureDimensions(histIn));
  let sp = uv * size;
  let tp1 = floor(sp - 0.5) + 0.5;
  let f = sp - tp1;
  let w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  let w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  let w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  let w3 = f * f * (-0.5 + 0.5 * f);
  let w12 = w1 + w2;
  let tp0 = (tp1 - 1.0) / size;
  let tp3 = (tp1 + 2.0) / size;
  let tp12 = (tp1 + w2 / w12) / size;
  var c = vec3f(0.0);
  c += textureSampleLevel(histIn, smp, vec2f(tp0.x, tp0.y), 0.0).rgb * w0.x * w0.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp12.x, tp0.y), 0.0).rgb * w12.x * w0.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp3.x, tp0.y), 0.0).rgb * w3.x * w0.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp0.x, tp12.y), 0.0).rgb * w0.x * w12.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp12.x, tp12.y), 0.0).rgb * w12.x * w12.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp3.x, tp12.y), 0.0).rgb * w3.x * w12.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp0.x, tp3.y), 0.0).rgb * w0.x * w3.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp12.x, tp3.y), 0.0).rgb * w12.x * w3.y;
  c += textureSampleLevel(histIn, smp, vec2f(tp3.x, tp3.y), 0.0).rgb * w3.x * w3.y;
  return max(c, vec3f(0.0));
}

/** each frame is drawn a fraction of a pixel off (a Halton walk) and blended into the history; the history
 * is first clipped to what this frame's neighbourhood allows (mean +- a few deviations), so what moves
 * leaves no trail */
@compute @workgroup_size(8, 8)
fn taa(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2i(textureDimensions(dst));
  let p = vec2i(id.xy);
  if (p.x >= size.x || p.y >= size.y) { return; }
  var m1 = vec3f(0.0);
  var m2 = vec3f(0.0);
  var cur = vec3f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = squeeze(textureLoad(src, clamp(p + vec2i(i, j), vec2i(0), size - 1), 0).rgb);
      m1 += c;
      m2 += c * c;
      if (i == 0 && j == 0) { cur = c; }
    }
  }
  let mean = m1 / 9.0;
  let sd = sqrt(max(m2 / 9.0 - mean * mean, vec3f(0.0)));
  // where this pixel's strand was a frame ago: back by the vessel's turn, through last frame's camera
  var uv = (vec2f(p) + 0.5) / vec2f(size);
  let t = textureLoad(src, p, 0).a;
  if (t < 9e3) {
    let ndc = vec2f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
    let rd = normalize(vec3f(U.fX, U.fY, U.fZ) + vec3f(U.rX, U.rY, U.rZ) * ndc.x * U.tanFov * U.aspect + vec3f(U.uX, U.uY, U.uZ) * ndc.y * U.tanFov);
    let P = vec3f(U.camX, U.camY, U.camZ) + rd * t;
    let a = U.dRot * TAU;
    let Q = vec3f(P.x * cos(a) - P.z * sin(a), P.y, P.x * sin(a) + P.z * cos(a));
    let v = Q - vec3f(U.pcX, U.pcY, U.pcZ);
    let z = dot(v, vec3f(U.pfX, U.pfY, U.pfZ));
    let q = vec2f(dot(v, vec3f(U.prX, U.prY, U.prZ)) / (z * U.tanFov * U.aspect), dot(v, vec3f(U.puX, U.puY, U.puZ)) / (z * U.tanFov));
    uv = vec2f(q.x * 0.5 + 0.5, 0.5 - q.y * 0.5);
  }
  var alpha = U.taaAlpha;
  if (any(uv < vec2f(0.0)) || any(uv > vec2f(1.0))) { alpha = 1.0; }
  let hist = clamp(squeeze(historyAt(uv)), mean - U.taaClip * sd, mean + U.taaClip * sd);
  textureStore(dst, p, vec4f(unsqueeze(mix(hist, cur, alpha)), 1.0));
}
