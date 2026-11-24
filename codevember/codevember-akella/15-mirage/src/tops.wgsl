// The highest point and the steepest slope of every square of the ground, for reach.wgsl: first of the 2 m
// squares, from the ground itself, then of each bigger square from the four in it.

@group(0) @binding(9) var below: texture_2d<f32>;

@vertex
fn vert(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

@fragment
fn first(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let corner = floor(at.xy) * CELL - 0.5 * SPAN;
  let n = 8;
  let d = CELL / f32(n);
  var top = -1e9;
  var across = 0.0;
  var along = 0.0;
  var row: array<f32, 9>;
  for (var j = 0; j <= n; j++) {
    var left = 0.0;
    for (var i = 0; i <= n; i++) {
      let h = ground(corner + vec2f(f32(i), f32(j)) * d);
      top = max(top, h);
      if (i > 0) {
        across = max(across, abs(h - left));
      }
      if (j > 0) {
        along = max(along, abs(h - row[i]));
      }
      left = h;
      row[i] = h;
    }
  }
  // a little over, for what lies between the points read
  return vec4f(top + 0.03, length(vec2f(across, along)) / d * 1.1 + 0.02, 0.0, 0.0);
}

@fragment
fn next(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let i = vec2i(at.xy) * 2;
  return max(max(textureLoad(below, i, 0), textureLoad(below, i + vec2i(1, 0), 0)), max(textureLoad(below, i + vec2i(0, 1), 0), textureLoad(below, i + vec2i(1, 1), 0)));
}

// the height of the ground at a list of points, one to a pixel
@group(0) @binding(10) var<storage, read> asked: array<vec4f>;

@fragment
fn heights(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let f = fieldsAt(asked[u32(at.x)].xy);
  return vec4f(groundOf(f, asked[u32(at.x)].xy), f.base, f.amp, f.pan);
}

// how the fields change across and along, from the texels either side
struct Slopes {
  @location(0) c: vec4f, // of the push and of the land: across, along, across, along
  @location(1) d: vec4f, // of the height and of the brink
};
fn fieldsOf(at: vec2i) -> vec4f {
  let w = at & vec2i(CELLS - 1);
  let a = textureLoad(ctlA, w, 0);
  let b = textureLoad(ctlB, w, 0);
  return vec4f(a.x + a.y, a.z + a.w, b.x, b.y + b.z);
}
@fragment
fn slopes(@builtin(position) at: vec4f) -> Slopes {
  let i = vec2i(at.xy);
  let dx = (fieldsOf(i + vec2i(1, 0)) - fieldsOf(i - vec2i(1, 0))) / (2.0 * CELL);
  let dz = (fieldsOf(i + vec2i(0, 1)) - fieldsOf(i - vec2i(0, 1))) / (2.0 * CELL);
  var made: Slopes;
  made.c = vec4f(dx.x, dz.x, dx.y, dz.y);
  made.d = vec4f(dx.z, dz.z, dx.w, dz.w);
  return made;
}

// smooth noise 0..1 as a picture, with how it changes across and along: 128 cells of it, 8 texels to a cell,
// repeating. Read between texels it is the noise itself, near enough, for one read.
fn pcgOf(v: u32) -> u32 {
  let s = v * 747796405u + 2891336453u;
  let w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
fn lattice(i: vec2i) -> f32 {
  let w = i & vec2i(127);
  return f32(pcgOf(u32(w.x) + pcgOf(u32(w.y) + 77u))) / 4294967296.0;
}
@fragment
fn noisy(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let x = (at.xy - 0.5) / 8.0;
  let i = vec2i(floor(x));
  let f = x - floor(x);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let du = 30.0 * f * f * (f * (f - 2.0) + 1.0);
  let a = lattice(i);
  let b = lattice(i + vec2i(1, 0));
  let c = lattice(i + vec2i(0, 1));
  let d = lattice(i + vec2i(1, 1));
  let k = a - b - c + d;
  return vec4f(a + (b - a) * u.x + (c - a) * u.y + k * u.x * u.y, du * vec2f(b - a + k * u.y, c - a + k * u.x), 1.0);
}

// the height of the ground on a grid, for taking it elsewhere (a Blender scene): from region.xy, region.z metres
// to a texel
@group(0) @binding(11) var<uniform> region: vec4f;

@fragment
fn grid(@builtin(position) at: vec4f) -> @location(0) vec4f {
  return vec4f(ground(region.xy + floor(at.xy) * region.z), 0.0, 0.0, 0.0);
}
