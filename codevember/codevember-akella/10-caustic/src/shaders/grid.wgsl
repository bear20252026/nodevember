// the flow on a coarse grid. The leads' wishes are fitted by a smooth field (least squares with a
// smoothness term, relaxed by Jacobi steps, warm started from the last frame), its divergence is taken
// out as much as `liquid` says (a pressure solve), and turbulence is curl noise. The cursor's stir is a
// little fluid of its own on the same grid.

@group(0) @binding(2) var<storage, read> acc: array<i32>;
@group(0) @binding(3) var<storage, read> uIn: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> uOut: array<vec2f>;
@group(0) @binding(5) var<storage, read> pIn: array<f32>;
@group(0) @binding(6) var<storage, read_write> pOut: array<f32>;
@group(0) @binding(7) var<storage, read_write> dv: array<f32>;

fn dims() -> vec2i { return vec2i(i32(U.gx), i32(U.gy)); }
fn at(q: vec2i) -> u32 { return u32(q.y * i32(U.gx) + q.x); }
fn inside(q: vec2i) -> bool { let G = dims(); return q.x >= 0 && q.y >= 0 && q.x < G.x && q.y < G.y; }
fn uClamped(q: vec2i) -> vec2f { return uIn[at(clamp(q, vec2i(0), dims() - 1))]; }
// open edges: no pressure beyond them, so flow may leave
fn pOpen(q: vec2i) -> f32 { if (inside(q)) { return pIn[at(q)]; } return 0.0; }

const FIX = 1024.0;
const N4 = array<vec2i, 4>(vec2i(1, 0), vec2i(-1, 0), vec2i(0, 1), vec2i(0, -1));

@compute @workgroup_size(8, 8)
fn fit(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  let k = at(q);
  let wv = vec2f(f32(acc[3u * k]), f32(acc[3u * k + 1u])) / FIX;
  let w = f32(acc[3u * k + 2u]) / FIX;
  var s = vec2f(0.0);
  var n = 0.0;
  for (var j = 0; j < 4; j++) {
    let o = q + N4[j];
    if (inside(o)) {
      s += uIn[at(o)];
      n += 1.0;
    }
  }
  // minimises sum w |u - v|^2 + smooth * sum |u_i - u_j|^2, one Jacobi step
  uOut[k] = (wv + U.smoothing * s) / max(w + U.smoothing * n, 1e-6);
}

@compute @workgroup_size(8, 8)
fn divergence(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  let h = cellSize();
  let ddx = (uClamped(q + vec2i(1, 0)).x - uClamped(q - vec2i(1, 0)).x) / (2.0 * h.x);
  let ddy = (uClamped(q + vec2i(0, 1)).y - uClamped(q - vec2i(0, 1)).y) / (2.0 * h.y);
  dv[at(q)] = ddx + ddy;
}

@compute @workgroup_size(8, 8)
fn pressure(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  let h = cellSize();
  let ax = 1.0 / (h.x * h.x);
  let ay = 1.0 / (h.y * h.y);
  let sum = (pOpen(q + vec2i(1, 0)) + pOpen(q - vec2i(1, 0))) * ax + (pOpen(q + vec2i(0, 1)) + pOpen(q - vec2i(0, 1))) * ay;
  pOut[at(q)] = (sum - dv[at(q)]) / (2.0 * ax + 2.0 * ay);
}

fn gradP(q: vec2i) -> vec2f {
  let h = cellSize();
  return vec2f((pOpen(q + vec2i(1, 0)) - pOpen(q - vec2i(1, 0))) / (2.0 * h.x), (pOpen(q + vec2i(0, 1)) - pOpen(q - vec2i(0, 1))) / (2.0 * h.y));
}

// curl of a noise stream function (Bridson et al.), a few octaves
fn stream(p: vec2f) -> f32 {
  var v = 0.0;
  var f = U.turbScale;
  var a = 1.0;
  for (var o = 0; o < 3; o++) {
    v += a * gnoise(vec3f(p * f, U.time * U.turbSpeed * f + f32(o) * 17.3)) / f;
    f *= 2.1;
    a *= 0.55;
  }
  return v;
}
fn curlNoise(p: vec2f) -> vec2f {
  let e = 0.01;
  let dx = (stream(p + vec2f(e, 0.0)) - stream(p - vec2f(e, 0.0))) / (2.0 * e);
  let dy = (stream(p + vec2f(0.0, e)) - stream(p - vec2f(0.0, e))) / (2.0 * e);
  return vec2f(dy, -dx);
}

@compute @workgroup_size(8, 8)
fn projectFit(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  let p = domainMin() + (vec2f(q) + 0.5) * cellSize();
  var u = uIn[at(q)] - U.liquid * gradP(q);
  if (U.turb > 0.0) { u += curlNoise(p) * U.turb; }
  uOut[at(q)] = u;
}

fn sampleIn(g0: vec2f) -> vec2f {
  let g = clamp(g0, vec2f(0.0), vec2f(U.gx, U.gy) - 1.001);
  let i0 = vec2i(floor(g));
  let w = g - floor(g);
  let a = uIn[at(i0)];
  let b = uIn[at(i0 + vec2i(1, 0))];
  let c = uIn[at(i0 + vec2i(0, 1))];
  let d = uIn[at(i0 + vec2i(1, 1))];
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

@compute @workgroup_size(8, 8)
fn stirAdvect(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  let h = cellSize();
  let p = domainMin() + (vec2f(q) + 0.5) * h;
  // semi-Lagrangian: carried along by itself
  let back = vec2f(q) - uIn[at(q)] * U.dt / h;
  var u = sampleIn(back) * U.stirDecay;
  // the cursor pushes along its own motion, strongest at its centre; a hair of swirl about it too
  let m = vec2f(U.mouseX, U.mouseY);
  let d = p - m;
  let fall = exp(-dot(d, d) / (U.mouseR * U.mouseR));
  u += vec2f(U.mouseVX, U.mouseVY) * U.mouseForce * fall;
  uOut[at(q)] = u;
}

@compute @workgroup_size(8, 8)
fn projectStir(@builtin(global_invocation_id) id: vec3u) {
  let q = vec2i(id.xy);
  if (!inside(q)) { return; }
  uOut[at(q)] = uIn[at(q)] - gradP(q);
}
