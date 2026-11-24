// shafts of light in the water. The light that makes the caustics crosses the water on its way to the sand, and the
// water scatters a little of it to the eye: brighter where a bundle is gathering toward a bright line, dimmer where
// it is spreading, dark behind a rock. Each pixel's line of sight is walked out to whatever it hits; at every step
// the caustic map is read where that step's light is going to land. Only the unevenness is kept: the even part is
// the haze the water has already. Drawn at half size or less and added to the picture.

@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var auxTex: texture_2d<f32>;
@group(0) @binding(3) var causticTex: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
@group(0) @binding(5) var depthTex: DEPTH_KIND;

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

const STEPS = 24;

/** the caustic map much blurred, read smoothly (a cubic over its fifth halving, in four reads): read plainly, that
 * small picture's own texels showed in the water as straight bars */
fn roundAbout(uv: vec2f) -> f32 {
  let size = vec2f(textureDimensions(causticTex, 5));
  let st = uv * size - 0.5;
  let i = floor(st);
  let f = st - i;
  let w0 = (1.0 - f) * (1.0 - f) * (1.0 - f) / 6.0;
  let w1 = (4.0 - 6.0 * f * f + 3.0 * f * f * f) / 6.0;
  let w3 = f * f * f / 6.0;
  let w2 = 1.0 - w0 - w1 - w3;
  let g0 = w0 + w1;
  let g1 = w2 + w3;
  let h0 = (i + w1 / g0 - 0.5) / size;
  let h1 = (i + w3 / g1 + 1.5) / size;
  return g0.y * (g0.x * textureSampleLevel(causticTex, smp, vec2f(h0.x, h0.y), 5.0).x + g1.x * textureSampleLevel(causticTex, smp, vec2f(h1.x, h0.y), 5.0).x) +
    g1.y * (g0.x * textureSampleLevel(causticTex, smp, vec2f(h0.x, h1.y), 5.0).x + g1.x * textureSampleLevel(causticTex, smp, vec2f(h1.x, h1.y), 5.0).x);
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  // how far off the picture is here
  let full = vec2i(textureDimensions(depthTex));
  let px = clamp(vec2i(in.uv * vec2f(full)), vec2i(0), full - 1);
  let d = textureLoad(depthTex, px, 0);
  let ahead = U.lens.x * U.lens.y / (U.lens.y - d * (U.lens.y - U.lens.x));
  let fwd = cross(U.up.xyz, U.right.xyz);
  let tanHalf = U.misc.w / (2.0 * U.grass.z);
  let ray = fwd + U.right.xyz * ((in.uv.x * 2.0 - 1.0) * tanHalf * U.misc2.x) + U.up.xyz * ((1.0 - 2.0 * in.uv.y) * tanHalf);
  let len = length(ray);
  let dir = ray / len;
  let reach = min(ahead * len, U.misc2.y);

  // every pixel starts its steps a different part of a step in, so the steps never show as bands
  let jitter = fract(52.9829189 * fract(dot(floor(in.pos.xy), vec2f(0.06711056, 0.00583715))));
  let sheetAt = U.tile.y - U.light.x;
  let lean = U.light.y;
  var sum = vec3f(0.0);
  for (var i = 0; i < STEPS; i++) {
    // closer together near the eye, where the water between hides least
    let e0 = pow(f32(i) / f32(STEPS), 1.4);
    let e1 = pow(f32(i + 1) / f32(STEPS), 1.4);
    let t = reach * mix(e0, e1, jitter);
    let p = U.cam.xyz + dir * t;
    // where that is in the tunnel: how far along, how far out from the middle, which way round
    let h0 = heading(p.z);
    let z = p.z + dot(p - centre(p.z), h0) * h0.z;
    let q = p - centre(z);
    let a0 = normalize(cross(vec3f(0.0, 1.0, 0.0), h0));
    let uv = vec2f(dot(q, a0), dot(q, cross(h0, a0)));
    let rho = length(uv);
    // nothing to see above the sheet: the light is even there
    if (rho <= sheetAt) { continue; }
    let at = vec2f(atan2(uv.y, uv.x) / TAU, z / U.tile.x);
    let ground = textureSampleLevel(heightTex, smp, at, 3.0).r;
    let above = max(U.tile.y - rho - ground, 0.0);
    let down = (rho - sheetAt) / max(U.light.x - ground, 0.05);
    let lands = at + vec2f(0.0, lean * above / U.tile.x);
    // (a bundle is wider the higher up it is: the map is read the more blurred)
    // (and against the light round about, much blurred: the map's own average is short of one, its brightest
    // folds being held down, and what is wanted is only brighter or dimmer than the water near by)
    let landed = textureSampleLevel(causticTex, smp, lands, U.shaft.y + 1.5 * (1.0 - clamp(down, 0.0, 1.0))).x / max(roundAbout(lands), 0.15);
    // (the baked light is about 0.3 on open sand, its soft edge reaching that far, and less in a ripple's lee:
    // read at its smallest, where the ripples are averaged away, only a rock's shadow is dark enough to count)
    let shade = mix(1.0 - U.up.w, 1.0, smoothstep(0.04, 0.16, textureSampleLevel(auxTex, smp, lands, 4.0).x));
    // (only as far along the tunnel as the caustics are traced; and the gaps between shafts only a little darker
    // than the water, or they read as dark rays of their own)
    let off = z - U.cam.z;
    let traced = smoothstep(-1.5, -0.9, off) * (1.0 - smoothstep(U.misc2.y - 2.0, U.misc2.y - 0.4, off));
    sum += through(t) * (max(gathered(landed, down) * shade - 1.0, -0.3) * traced * reach * (e1 - e0));
  }
  let glow = U.lookA.w * mix(vec3f(1.0), vec3f(1.12, 0.96, 0.7), U.right.w) * mix(U.lookB.rgb * 1.6, vec3f(1.0), 0.45);
  return vec4f(U.shaft.x * U.lookA.x * 1.5 * glow * sum, 1.0);
}
