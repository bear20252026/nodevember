// the field, upsampled as a complex amplitude (Catmull-Rom on re and im), shown as intensity

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var field: texture_2d<f32>;

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

fn cr(x: f32) -> vec4f {
  // Catmull-Rom weights for taps at -1, 0, 1, 2
  let x2 = x * x;
  let x3 = x2 * x;
  return vec4f(-0.5 * x3 + x2 - 0.5 * x, 1.5 * x3 - 2.5 * x2 + 1.0, -1.5 * x3 + 2.0 * x2 + 0.5 * x, 0.5 * x3 - 0.5 * x2);
}

fn amplitude(uv: vec2f) -> vec2f {
  let size = vec2i(textureDimensions(field));
  let g = uv * vec2f(size) - 0.5;
  let i0 = vec2i(floor(g));
  let f = g - floor(g);
  let wx = cr(f.x);
  let wy = cr(f.y);
  var v = vec2f(0.0);
  for (var j = 0; j < 4; j++) {
    var row = vec2f(0.0);
    for (var i = 0; i < 4; i++) {
      let q = clamp(i0 + vec2i(i - 1, j - 1), vec2i(0), size - 1);
      row += wx[i] * textureLoad(field, q, 0).xy;
    }
    v += wy[j] * row;
  }
  return v;
}

fn hash(p: vec2u) -> f32 {
  var s = p.x * 747796405u + p.y * 2891336453u;
  s = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return f32((s >> 22u) ^ s) / 4294967295.0;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let a = amplitude(in.uv);
  var I = dot(a, a);
  if (U.showCost > 0.5) { I = a.x * a.x; }
  // fringes live in the dim parts too: a soft shoulder, then a gamma that lifts the faint ones
  let x = I * U.exposure;
  var v = pow(x / (1.0 + x), U.gamma);
  // the field of a microscope: dark at the rim
  let r = length((in.uv - 0.5) * vec2f(U.ax, 1.0)) * 2.0 / max(U.ax, 1.0);
  v *= mix(1.0, smoothstep(1.25, 0.55, r), U.vignette);
  // cool in the dark, warm white in the light
  let tint = mix(vec3f(U.darkR, U.darkG, U.darkB), vec3f(U.lightR, U.lightG, U.lightB), v);
  var col = tint * v;
  col += (hash(vec2u(in.pos.xy)) - 0.5) / 255.0;
  return vec4f(col, 1.0);
}
