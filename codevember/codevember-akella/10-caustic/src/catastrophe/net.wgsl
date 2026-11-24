// A general diffraction catastrophe: a plane wave picks up the phase k h(x) from a smooth random screen
// and travels a distance z. In Fourier space travel is a phase, exp(-i z |q|^2 / 2k) (Fresnel), so the
// field is FFT^-1[ FFT[exp(i k h)] * that ]. Geometrically the screen focuses light into a net of folds
// that meet in cusps; at this wavelength every fold wears Airy fringes and every cusp a Pearcey.
//
// The FFT is radix-2 Stockham, one pass per stage along rows then columns, ping-ponging two buffers.
// The screen is a sum of plane waves on the FFT's own lattice, so it repeats seamlessly, and each
// turns a whole number of times per loop.

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var field: texture_storage_2d<rg32float, write>;
@group(0) @binding(2) var<uniform> pass_: vec4u; // stage, axis (0 rows, 1 columns), inverse, -
@group(0) @binding(3) var<storage, read> src: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> dst: array<vec2f>;
@group(0) @binding(5) var<storage, read> screenWaves: array<vec4f>; // (nx, ny, amplitude, turns per loop), (phase, -, -, -)

const PI = 3.14159265;

fn N() -> u32 { return u32(U.netN); }

fn height(x: vec2f) -> f32 {
  var h = 0.0;
  let count = u32(U.netWaves);
  let th = 2.0 * PI * U.playhead;
  for (var i = 0u; i < count; i++) {
    let a = screenWaves[2u * i];
    let b = screenWaves[2u * i + 1u];
    h += a.z * cos(2.0 * PI * dot(a.xy, x) + a.w * th + b.x);
  }
  return h;
}

@compute @workgroup_size(16, 16)
fn screen(@builtin(global_invocation_id) id: vec3u) {
  let n = N();
  if (id.x >= n || id.y >= n) { return; }
  // the domain is the unit square
  let x = (vec2f(id.xy) + 0.5) / f32(n);
  let ph = U.netK * U.netAmp * height(x);
  dst[id.y * n + id.x] = vec2f(cos(ph), sin(ph));
}

@compute @workgroup_size(256)
fn fft(@builtin(global_invocation_id) id: vec3u) {
  let n = N();
  let half = n / 2u;
  if (id.x >= half || id.y >= n) { return; }
  let stage = pass_.x;
  let ns = 1u << stage;
  let j = id.x;
  let line = id.y;
  // element e of this line
  var stride = 1u;
  var base = line * n;
  if (pass_.y == 1u) {
    stride = n;
    base = line;
  }
  let a = src[base + j * stride];
  let b = src[base + (j + half) * stride];
  let k = j % ns;
  var sgn = -1.0;
  if (pass_.z == 1u) { sgn = 1.0; }
  let ang = sgn * PI * f32(k) / f32(ns);
  let w = vec2f(cos(ang), sin(ang));
  let bw = vec2f(b.x * w.x - b.y * w.y, b.x * w.y + b.y * w.x);
  let o = (j / ns) * ns * 2u + k;
  dst[base + o * stride] = a + bw;
  dst[base + (o + ns) * stride] = a - bw;
}

@compute @workgroup_size(16, 16)
fn propagate(@builtin(global_invocation_id) id: vec3u) {
  let n = N();
  if (id.x >= n || id.y >= n) { return; }
  // signed frequencies, in cycles per unit; travel z, wavenumber k
  var f = vec2f(id.xy);
  if (id.x >= n / 2u) { f.x -= f32(n); }
  if (id.y >= n / 2u) { f.y -= f32(n); }
  let q = 2.0 * PI * f;
  let ph = -U.netZ * dot(q, q) / (2.0 * U.netK);
  let v = src[id.y * n + id.x];
  let w = vec2f(cos(ph), sin(ph));
  // the inverse transform's 1/N^2, here once
  dst[id.y * n + id.x] = vec2f(v.x * w.x - v.y * w.y, v.x * w.y + v.y * w.x) / f32(n * n);
}

fn at(i: vec2i) -> vec2f {
  let n = i32(N());
  let q = ((i % n) + n) % n;
  return src[u32(q.y * n + q.x)];
}

@compute @workgroup_size(8, 8)
fn toField(@builtin(global_invocation_id) id: vec3u) {
  let size = vec2u(u32(U.W), u32(U.H));
  if (id.x >= size.x || id.y >= size.y) { return; }
  // the screen shows a window of the periodic domain, 1/zoom wide (the same scale whatever the aspect)
  let uv = (vec2f(id.xy) + 0.5) / vec2f(size);
  let p = vec2f(0.5) + (uv - 0.5) * vec2f(U.ax, 1.0) * U.scale * 0.5;
  let g = p * f32(N()) - 0.5;
  let i0 = vec2i(floor(g));
  let f = g - floor(g);
  let v = mix(mix(at(i0), at(i0 + vec2i(1, 0)), f.x), mix(at(i0 + vec2i(0, 1)), at(i0 + vec2i(1, 1)), f.x), f.y);
  textureStore(field, vec2i(id.xy), vec4f(v, 0.0, 0.0));
}
