// photons: where each should be (its goal), the leads' wishes splatted onto the flow grid, and the move

@group(0) @binding(2) var<storage, read_write> pos: array<vec2f>;
@group(0) @binding(3) var<storage, read> leadT: array<vec2f>;
@group(0) @binding(4) var<storage, read_write> acc: array<atomic<i32>>;
@group(0) @binding(5) var<storage, read> field: array<vec2f>;
@group(0) @binding(6) var<storage, read> stir: array<vec2f>;
@group(0) @binding(7) var<storage, read_write> light: array<atomic<u32>>;

const FIX = 1024.0;

fn leadTarget(q: vec2i) -> vec2f {
  let L = vec2i(i32(U.lx), i32(U.ly));
  let c = clamp(q, vec2i(0), L - 1);
  return leadT[u32(U.creature) * u32(L.x * L.y) + u32(c.y * L.x + c.x)];
}

// the photon's place in the drawing: between its four leads, unless they went to different strokes
fn shapeTarget(ix: u32, iy: u32) -> vec2f {
  let f = (vec2f(f32(ix), f32(iy)) - floor(U.lstep * 0.5)) / U.lstep;
  let i0 = vec2i(floor(f));
  let w = f - floor(f);
  let a = leadTarget(i0);
  let b = leadTarget(i0 + vec2i(1, 0));
  let c = leadTarget(i0 + vec2i(0, 1));
  let d = leadTarget(i0 + vec2i(1, 1));
  let spread = max(max(distance(a, b), distance(c, d)), max(distance(a, c), distance(b, d)));
  if (spread < U.tear) {
    return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
  }
  // torn: go with the nearest lead, a little scattered so the dot is not a point
  let near = leadTarget(i0 + vec2i(round(w)));
  let h = hash(ix * 9781u + iy * 6271u);
  let a2 = f32(h & 1023u) / 1023.0 * 2.0 * PI;
  return near + vec2f(cos(a2), sin(a2)) * U.tear * 0.08 * f32((h >> 10u) & 255u) / 255.0;
}

fn isLead(ix: u32, iy: u32) -> bool {
  let st = u32(U.lstep);
  let off = st / 2u;
  return ix % st == off && iy % st == off;
}

// the share of photons starting at uv that join the drawing (reach01 in the worker)
fn reach(uv: vec2f) -> f32 {
  let r = distance(uv, vec2f(U.boxX, U.boxY)) / (U.boxSize * 0.5);
  let s = smoothstep(0.0, 1.0, (r - U.inner) / (U.outer - U.inner));
  return 1.0 + (U.far - 1.0) * s;
}

// whether this photon's light joins the drawing, or stays in the water's own pattern
fn joins(ix: u32, iy: u32, uv: vec2f) -> bool {
  let h = hash01(iy * u32(U.nx) + ix + 77u);
  return h < reach(uv) && hash01(iy * 7919u + ix * 31u + 5u) >= U.keep;
}

fn goal(uv: vec2f, ch: u32, t: f32, kept: bool, shape: vec2f) -> vec2f {
  let live = caustic(uv, t, ch);
  if (kept || U.phase < 0.5 || U.phase > 2.5) {
    return live;
  }
  // in the drawing, the light still trembles a little with the water
  return shape + U.shimmer * (live - uv);
}

fn guidance(want: vec2f, c: vec2f) -> vec2f {
  // straight on, at the speed that arrives as the transition ends (eq. 2)
  return (want - c) / max(1.0 - U.sPrev, 1e-3);
}

@compute @workgroup_size(256)
fn leads(@builtin(global_invocation_id) id: vec3u) {
  let lx = u32(U.lx);
  if (id.x >= lx * u32(U.ly)) { return; }
  let st = u32(U.lstep);
  let ix = (id.x % lx) * st + st / 2u;
  let iy = (id.x / lx) * st + st / 2u;
  let nx = u32(U.nx);
  let shape = shapeTarget(ix, iy);
  let c = pos[iy * nx + ix];
  let uv = photonUV(ix, iy);
  var v = guidance(goal(uv, channel(ix, iy), U.time, false, shape), c);
  // a lead speaks for the photons round it that join
  let p = reach(uv);
  let m = length(v);
  if (m > 60.0) { v *= 60.0 / m; }
  let g = toGrid(c);
  let i0 = vec2i(floor(g));
  let w = g - floor(g);
  let G = vec2i(i32(U.gx), i32(U.gy));
  for (var k = 0; k < 4; k++) {
    let o = vec2i(k & 1, k >> 1);
    let q = i0 + o;
    if (q.x < 0 || q.y < 0 || q.x >= G.x || q.y >= G.y) { continue; }
    let ww = mix(1.0 - w.x, w.x, f32(o.x)) * mix(1.0 - w.y, w.y, f32(o.y)) * p;
    let cell = 3u * u32(q.y * G.x + q.x);
    atomicAdd(&acc[cell], i32(round(ww * v.x * FIX)));
    atomicAdd(&acc[cell + 1u], i32(round(ww * v.y * FIX)));
    atomicAdd(&acc[cell + 2u], i32(round(ww * FIX)));
  }
}

fn sampleField(p: vec2f) -> vec2f {
  let g = clamp(toGrid(p), vec2f(0.0), vec2f(U.gx, U.gy) - 1.001);
  let i0 = vec2u(floor(g));
  let w = g - floor(g);
  let G = u32(U.gx);
  let a = field[i0.y * G + i0.x];
  let b = field[i0.y * G + i0.x + 1u];
  let c = field[(i0.y + 1u) * G + i0.x];
  let d = field[(i0.y + 1u) * G + i0.x + 1u];
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

fn sampleStir(p: vec2f) -> vec2f {
  let g = clamp(toGrid(p), vec2f(0.0), vec2f(U.gx, U.gy) - 1.001);
  let i0 = vec2u(floor(g));
  let w = g - floor(g);
  let G = u32(U.gx);
  let a = stir[i0.y * G + i0.x];
  let b = stir[i0.y * G + i0.x + 1u];
  let c = stir[(i0.y + 1u) * G + i0.x];
  let d = stir[(i0.y + 1u) * G + i0.x + 1u];
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

// bilinear splat into the light buffer, 256 parts for a photon at full strength
fn splat(p: vec2f, ch: u32, weight: f32) {
  let W = i32(U.W);
  let H = i32(U.H);
  let px = vec2f((p.x / U.ax * 0.5 + 0.5) * U.W, (0.5 - p.y * 0.5) * U.H) - 0.5;
  let i0 = vec2i(floor(px));
  if (i0.x < -1 || i0.y < -1 || i0.x >= W || i0.y >= H) { return; }
  let f = px - floor(px);
  let base = ch * u32(W * H);
  let w00 = u32((1.0 - f.x) * (1.0 - f.y) * weight + 0.5);
  let w10 = u32(f.x * (1.0 - f.y) * weight + 0.5);
  let w01 = u32((1.0 - f.x) * f.y * weight + 0.5);
  let w11 = u32(f.x * f.y * weight + 0.5);
  let x1 = i0.x + 1;
  let y1 = i0.y + 1;
  if (i0.y >= 0) {
    if (i0.x >= 0) { atomicAdd(&light[base + u32(i0.y * W + i0.x)], w00); }
    if (x1 < W) { atomicAdd(&light[base + u32(i0.y * W + x1)], w10); }
  }
  if (y1 < H) {
    if (i0.x >= 0) { atomicAdd(&light[base + u32(y1 * W + i0.x)], w01); }
    if (x1 < W) { atomicAdd(&light[base + u32(y1 * W + x1)], w11); }
  }
}

@compute @workgroup_size(256)
fn advance(@builtin(global_invocation_id) id: vec3u) {
  let nx = u32(U.nx);
  let i = id.x;
  if (i >= nx * u32(U.ny)) { return; }
  let ix = i % nx;
  let iy = i / nx;
  let ch = channel(ix, iy);
  let uv = photonUV(ix, iy);
  let shape = shapeTarget(ix, iy);
  let joined = joins(ix, iy, uv);
  // leads always ride the flow, since the fit is built on where they are; their light may not
  let kept = !joined && !isLead(ix, iy);
  var c = pos[i];
  let want = goal(uv, ch, U.time, kept, shape);
  if (U.reset > 0.5) {
    c = want;
  } else if (kept || U.phase < 0.5 || (U.phase > 1.5 && U.phase < 2.5)) {
    // at rest in the water's pattern or the drawing: pushed aside, it drifts back
    let before = goal(uv, ch, U.timePrev, kept, shape);
    c = want + (c - before) * U.relax;
  } else {
    // a transition: the fitted flow, handing over to the photon's own straight path near the end
    let ds = U.s - U.sPrev;
    let b = clamp((U.sPrev - U.tau) / (1.0 - U.tau), 0.0, 1.0);
    c += ((1.0 - b) * sampleField(c) + b * guidance(want, c)) * ds;
  }
  c += sampleStir(c) * U.dt;
  pos[i] = c;
  // light gathered into the drawing is dimmed as it goes (the paper's flux blend, to rho)
  if (joined) {
    splat(c, ch, 256.0 * U.flux);
  } else if (kept) {
    splat(c, ch, 256.0);
  } else {
    splat(caustic(uv, U.time, ch), ch, 256.0);
  }
}
