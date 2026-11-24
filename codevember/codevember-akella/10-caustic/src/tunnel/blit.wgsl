// halves a picture: for the mip chains of the sand's maps and of the caustics

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;

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

@fragment
fn fs(in: VOut) -> @location(0) vec4f { return textureSampleLevel(src, smp, in.uv, 0.0); }

/** halves a picture more softly, each texel a tent over four each way (1 3 3 1): a plain halving's squares show
 * when its smaller copies are looked at close, as the shafts of light look at the caustic map's */
@fragment
fn fsHalfSoft(in: VOut) -> @location(0) vec4f {
  let t = 0.75 / vec2f(textureDimensions(src));
  return 0.25 * (textureSampleLevel(src, smp, in.uv + vec2f(-t.x, -t.y), 0.0) + textureSampleLevel(src, smp, in.uv + vec2f(t.x, -t.y), 0.0) +
    textureSampleLevel(src, smp, in.uv + vec2f(-t.x, t.y), 0.0) + textureSampleLevel(src, smp, in.uv + vec2f(t.x, t.y), 0.0));
}

/** a small tent over three texels each way: the caustic map's fold edges are drawn hard, and show as steps close up */
@fragment
fn fsSoft(in: VOut) -> @location(0) vec4f {
  let t = 0.5 / vec2f(textureDimensions(src));
  return 0.25 * (textureSampleLevel(src, smp, in.uv + vec2f(-t.x, -t.y), 0.0) + textureSampleLevel(src, smp, in.uv + vec2f(t.x, -t.y), 0.0) +
    textureSampleLevel(src, smp, in.uv + vec2f(-t.x, t.y), 0.0) + textureSampleLevel(src, smp, in.uv + vec2f(t.x, t.y), 0.0));
}

/** a wide soft blur, one way then the other: the sand as the light mesh sees it, without ripples or sharp rocks */
fn gauss(uv: vec2f, way: vec2f) -> vec4f {
  let t = way / vec2f(textureDimensions(src));
  var sum = vec4f(0.0);
  var total = 0.0;
  for (var k = -10; k <= 10; k++) {
    let w = exp(-f32(k * k) / 32.0);
    sum += w * textureSampleLevel(src, smp, uv + f32(k) * t, 0.0);
    total += w;
  }
  return sum / total;
}
@fragment
fn fsGaussX(in: VOut) -> @location(0) vec4f { return gauss(in.uv, vec2f(1.0, 0.0)); }
@fragment
fn fsGaussY(in: VOut) -> @location(0) vec4f { return gauss(in.uv, vec2f(0.0, 1.0)); }

/** a wider tent, three texels each way: the shafts of light, drawn small and grainy, laid softly over the picture */
@fragment
fn fsWide(in: VOut) -> @location(0) vec4f {
  let t = 1.0 / vec2f(textureDimensions(src));
  var sum = vec4f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      sum += f32((2 - abs(i)) * (2 - abs(j))) * textureSampleLevel(src, smp, in.uv + vec2f(f32(i), f32(j)) * t, 0.0);
    }
  }
  return sum / 16.0;
}
