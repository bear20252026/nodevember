// the caustics: a fine grid of light on a rippling sheet a little above the sand, each point sent down its own
// bent way and landed on the sand's real height. Where the grid bunches up the light is bright: every piece adds
// its own area over the area it lands on. Drawn straight into a map of the tunnel's unrolled wall.

@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;

@group(0) @binding(3) var sheetOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(4) var sheetTex: texture_2d<f32>;
@group(0) @binding(5) var landOut: texture_storage_2d<rgba32float, write>;
@group(0) @binding(6) var landTex: texture_2d<f32>;
@group(0) @binding(7) var curveOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(8) var curveTex: texture_2d<f32>;

/** the sheet's slopes and how they change (its curvature, three numbers) over the stretch the light mesh covers,
 * at half the mesh's fineness: the waves are smooth, and summing them for every point of the mesh was most of a frame */
@compute @workgroup_size(8, 8)
fn sheet(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(sheetOut);
  if (id.x >= size.x || id.y >= size.y) { return; }
  let a = vec2f((f32(id.x) + 0.5) / f32(size.x) * TAU, U.win.x + f32(id.y) * 2.0 * U.win.y);
  var g = vec2f(0.0);
  var curve = vec3f(0.0);
  let n = i32(U.light2.x);
  for (var i = 0; i < n; i++) {
    let w = U.waves[2 * i];
    let dir = U.waves[2 * i + 1].xy;
    let ph = w.x * a.x + w.y * a.y - w.z * U.lookC.w + w.w;
    g += dir * cos(ph);
    // per unit of length round the wall and along it
    let k = vec2f(w.x / U.tile.y, w.y);
    curve -= vec3f(dir.x * k.x, 0.5 * (dir.x * k.y + dir.y * k.x), dir.y * k.y) * sin(ph);
  }
  textureStore(sheetOut, vec2i(id.xy), vec4f(g, 0.0, 0.0));
  textureStore(curveOut, vec2i(id.xy), vec4f(curve, 0.0));
}

/** how far the ray from a point of the sheet has overshot the sand when it has gone `lam` down */
fn short(s: vec2f, way: vec2f, lam: f32) -> f32 {
  let h = textureSampleLevel(heightTex, smp, (s + lam * way) / vec2f(TAU * U.tile.y, U.tile.x), 0.0).r;
  return lam - (U.light.x - h);
}

/**
 * Where each point of the light mesh lands, and how bright. The sand it lands on is a blurred copy (no ripples,
 * rocks as mounds): on the true heights no solve settles on a rock's steep side, and the light there flickered.
 * The brightness is one over how much a patch of the sheet is stretched on landing, and that is worked out
 * exactly, from the sheet's curvature and the sand's slope where it lands (measured off neighbouring points or
 * off each triangle it was noisy just where a fold is brightest, and the folds sparkled).
 */
@compute @workgroup_size(8, 8)
fn land(@builtin(global_invocation_id) id: vec3u) {
  let cols = u32(U.win.z);
  let rows = u32(U.win.w);
  if (id.x > cols || id.y > rows) { return; }
  let margin = U.path.w;
  let around = (f32(id.x) - margin) / (f32(cols) - 2.0 * margin);
  let z = U.win.x + f32(id.y) * U.win.y;
  let span = vec2f(TAU * U.tile.y, U.tile.x);
  let s = vec2f(around * span.x, z);
  let at = vec2f(around, (f32(id.y) * 0.5 + 0.5) / f32(textureDimensions(sheetTex).y));
  let g = textureSampleLevel(sheetTex, smp, at, 0.0).xy;
  let c = textureSampleLevel(curveTex, smp, at, 0.0).xyz * U.light.z;
  let way = vec2f(0.0, U.light.y) + U.light.z * g;
  var l0 = U.light.x;
  var f0 = short(s, way, l0);
  var l1 = l0 - f0;
  var f1 = short(s, way, l1);
  for (var k = 0; k < 3; k++) {
    let d = f1 - f0;
    if (abs(d) < 1e-7) { break; }
    let l2 = l1 - f1 * (l1 - l0) / d;
    l0 = l1;
    f0 = f1;
    l1 = l2;
    f1 = short(s, way, l1);
  }
  // a patch of the sheet lands stretched by det(1 + depth * curvature), over (1 + the sand's slope along the ray)
  let slope = textureSampleLevel(heightTex, smp, (s + l1 * way) / span, 0.0).yz;
  let tilt = max(1.0 + dot(slope, way), 0.2);
  let stretch = ((1.0 + l1 * c.x) * (1.0 + l1 * c.z) - l1 * l1 * c.y * c.y) / tilt;
  // a fold (stretch 0) is far thinner than the mesh is fine, and some points would catch its core and others miss
  // it: beads along every line. So it is widened by as much as the stretch changes over one cell of the mesh.
  let cell = vec2f(1.0 / (f32(cols) - 2.0 * margin), 0.5 / f32(textureDimensions(sheetTex).y));
  let cx = textureSampleLevel(curveTex, smp, at + vec2f(cell.x, 0.0), 0.0).xyz * U.light.z;
  let cy = textureSampleLevel(curveTex, smp, at + vec2f(0.0, cell.y), 0.0).xyz * U.light.z;
  let sx = ((1.0 + l1 * cx.x) * (1.0 + l1 * cx.z) - l1 * l1 * cx.y * cx.y) / tilt;
  let sy = ((1.0 + l1 * cy.x) * (1.0 + l1 * cy.z) - l1 * l1 * cy.y * cy.y) / tilt;
  let soft = max(1.0 / U.light2.z, U.misc2.z * length(vec2f(sx - stretch, sy - stretch)));
  textureStore(landOut, vec2i(id.xy), vec4f(l1 * way, l1, 1.0 / sqrt(stretch * stretch + soft * soft)));
}

struct LOut {
  @builtin(position) pos: vec4f,
  @location(0) light: f32,
  @location(1) bent: vec2f,
};

@vertex
fn vsLight(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> LOut {
  let cols = i32(U.win.z);
  let margin = U.path.w;
  let col = i32(vi) % (cols + 1);
  let row = i32(vi) / (cols + 1);
  let around = (f32(col) - margin) / (f32(cols) - 2.0 * margin);
  let z = U.win.x + f32(row) * U.win.y;
  let lap = f32(ii);
  let span = vec2f(TAU * U.tile.y, U.tile.x);
  let me = textureLoad(landTex, vec2i(col, row), 0);
  let uv = (vec2f(around * span.x, z) + me.xy) / span - vec2f(0.0, lap - 1.0);
  var o: LOut;
  o.pos = vec4f(uv.x * 2.0 - 1.0, 1.0 - 2.0 * uv.y, 0.0, 1.0);
  o.light = me.w;
  // how far the waves alone threw it: the colours part along this
  o.bent = (me.xy - me.z * vec2f(0.0, U.light.y)) / span;
  return o;
}

/** the light, and with it which way it was bent, so the wall can part its colours */
@fragment
fn fsLight(in: LOut) -> @location(0) vec4f { return vec4f(in.light, in.light * in.bent, 1.0); }
