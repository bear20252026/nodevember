// the web grows here: physarum agents on the vessel's unrolled sheet (Jeff Jones's model), and a
// caustic traced onto the same sheet for them to feed on

@group(0) @binding(1) var<storage, read_write> agents: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> dep: array<atomic<u32>>;
@group(0) @binding(3) var<storage, read_write> trailIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> trailOut: array<f32>;
@group(0) @binding(5) var<storage, read_write> food: array<f32>;
@group(0) @binding(6) var<storage, read_write> photons: array<atomic<u32>>;
@group(0) @binding(7) var<storage, read_write> sums: array<atomic<u32>>;

/** what an agent smells: the trail, and in the fed mode the light it was given */
fn smell(p: vec2f, L: i32) -> f32 {
  let k = cell(i32(floor(p.x)), i32(floor(p.y)), L);
  // a scent along the crown, so a rim strand grows there for the crown's spikes to stand on
  let top = U.H - 1.0 - p.y;
  let rim = U.rim * U.trailMean * exp(-top * top / 18.0) * select(1.0, 0.35, L > 0);
  return trailIn[k] + U.foodW * U.trailMean * food[k] + rim;
}

@compute @workgroup_size(256)
fn crawl(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (i >= u32(U.nAgents)) { return; }
  var a = agents[i];
  if (i32(a.w) >= i32(U.layers)) { return; }
  let L = i32(a.w);
  var p = a.xy;
  var h = a.z;
  // a step round the vessel is longer in texels where it is narrow: the sheet's texels are square at the belly
  let s = 1.0 / profile(p.y / (U.H - 1.0));
  let dirF = vec2f(cos(h) * s, sin(h));
  let dirL = vec2f(cos(h + U.SA) * s, sin(h + U.SA));
  let dirR = vec2f(cos(h - U.SA) * s, sin(h - U.SA));
  let F = smell(p + dirF * U.SD, L);
  let FL = smell(p + dirL * U.SD, L);
  let FR = smell(p + dirR * U.SD, L);
  let r = h01(i * 0x9e3779b9u + u32(U.frame) * 0x85ebca6bu);
  if (F > FL && F > FR) {
  } else if (F < FL && F < FR) {
    h += select(-U.RA, U.RA, r < 0.5);
  } else if (FL > FR) {
    h += U.RA;
  } else if (FR > FL) {
    h -= U.RA;
  }
  h += (r - 0.5) * 0.15;
  p += vec2f(cos(h) * s, sin(h)) * U.SS;
  p.x = p.x - U.W * floor(p.x / U.W);
  // the rims turn them back, so a strand runs along each
  if (p.y < 0.0) {
    p.y = -p.y;
    h = -h;
  }
  if (p.y > U.H - 1.0) {
    p.y = 2.0 * (U.H - 1.0) - p.y;
    h = -h;
  }
  atomicAdd(&dep[cell(i32(p.x), i32(p.y), L)], 1u);
  agents[i] = vec4f(p, h, a.w);
}

var<workgroup> wsum: atomic<u32>;

/** the trail spreads a little and fades; this step's footprints are added; and its mean is tallied */
@compute @workgroup_size(16, 16)
fn diffuse(@builtin(global_invocation_id) id: vec3u, @builtin(local_invocation_index) li: u32) {
  if (li == 0u) { atomicStore(&wsum, 0u); }
  workgroupBarrier();
  let W = i32(U.W);
  let H = i32(U.H);
  let x = i32(id.x);
  let yy = i32(id.y);
  var v = 0.0;
  if (x < W && yy < H * i32(U.layers)) {
    let L = yy / H;
    let y = yy % H;
    var sum = 0.0;
    for (var j = -1; j <= 1; j++) {
      for (var i = -1; i <= 1; i++) { sum += trailIn[cell(x + i, y + j, L)]; }
    }
    let k = cell(x, y, L);
    let d = f32(atomicLoad(&dep[k]));
    atomicStore(&dep[k], 0u);
    v = min(sum / 9.0 * (1.0 - U.decay) + d * U.deposit, 2000.0);
    trailOut[k] = v;
    // tallied in quarters: 1.8M cells over a rush of 24 steps would overflow 32 bits otherwise
    atomicAdd(&wsum, u32(min(v, 2000.0) * 0.25));
  }
  workgroupBarrier();
  if (li == 0u) { atomicAdd(&sums[0], atomicLoad(&wsum)); }
}

// ---------------------------------------------------------------- light to feed on

/** light through a rippled surface held a little above the sheet, wrapped round it: a ray a texel */
@compute @workgroup_size(256)
fn shine(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(U.W);
  let H = u32(U.H);
  let n = W * H * u32(U.layers);
  if (id.x >= n) { return; }
  let L = id.x / (W * H);
  let r = id.x % (W * H);
  let p = vec2f(f32(r % W), f32(r / W)) + 0.5;
  let g = ripples(p, f32(L));
  let q = p + g * U.cDepth;
  atomicAdd(&photons[cell(i32(floor(q.x)), i32(floor(q.y)), i32(L))], 1u);
}

/** counts to light, mean 1, softened a little */
@compute @workgroup_size(16, 16)
fn resolve(@builtin(global_invocation_id) id: vec3u) {
  let W = i32(U.W);
  let H = i32(U.H);
  let x = i32(id.x);
  let yy = i32(id.y);
  if (x >= W || yy >= H * i32(U.layers)) { return; }
  let L = yy / H;
  let y = yy % H;
  var sum = 0.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let w = select(0.5, 1.0, i == 0 && j == 0);
      sum += w * f32(atomicLoad(&photons[cell(x + i, y + j, L)]));
    }
  }
  food[cell(x, y, L)] = sum / 5.0;
}

// ---------------------------------------------------------------- foam: a web with no loose ends

/** a texel-space value noise that wraps round the vessel every `period` lattice cells */
fn pnoise(p: vec2f, period: i32, salt: u32) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let x0 = ((i.x % period) + period) % period;
  let x1 = (x0 + 1) % period;
  let a = h01(hashu((u32(x0) * 73856093u) ^ (u32(i.y) * 19349663u) ^ salt));
  let b = h01(hashu((u32(x1) * 73856093u) ^ (u32(i.y) * 19349663u) ^ salt));
  let c = h01(hashu((u32(x0) * 73856093u) ^ (u32(i.y + 1) * 19349663u) ^ salt));
  let d = h01(hashu((u32(x1) * 73856093u) ^ (u32(i.y + 1) * 19349663u) ^ salt));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** a foam cell's seed, jittered in its cell */
fn seedOf(c: vec2i, n: i32, salt: u32) -> vec3f {
  let xw = ((c.x % n) + n) % n;
  let h = hashu((u32(xw) * 0x8da6b343u) ^ hashu(bitcast<u32>(c.y) * 0xd8163841u + salt));
  let j = vec2f(f32(h & 0xffffu), f32(h >> 16u)) / 65535.0;
  return vec3f(vec2f(c) + 0.12 + 0.76 * j, f32(h & 0xffffffu));
}

/** distance (in cells) to the nearest edge and the next nearest, and a number for the nearest edge */
fn foamEdges(p: vec2f, n: i32, salt: u32) -> vec3f {
  let ip = vec2i(floor(p));
  var md = 1e9;
  var mr = vec2f(0.0);
  var mc = vec2i(0);
  var mid = 0.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let s = seedOf(ip + vec2i(i, j), n, salt);
      let r = s.xy - p;
      let d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mc = ip + vec2i(i, j);
        mid = s.z;
      }
    }
  }
  var e1 = 1e9;
  var e2 = 1e9;
  var eid = 0u;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let c = mc + vec2i(i, j);
      if (i == 0 && j == 0) { continue; }
      let s = seedOf(c, n, salt);
      let r = s.xy - p;
      let e = dot(0.5 * (mr + r), normalize(r - mr));
      if (e < e1) {
        e2 = e1;
        e1 = e;
        eid = u32(mid) ^ u32(s.z);
      } else if (e < e2) {
        e2 = e;
      }
    }
  }
  return vec3f(e1, e2, h01(hashu(eid)));
}

/** the foam as a web: thick main strands, each its own weight, a finer partial net between them,
 * junctions thickened where two edges meet, a ring along the crown and the foot */
@compute @workgroup_size(16, 16)
fn foam(@builtin(global_invocation_id) id: vec3u) {
  let W = i32(U.W);
  let H = i32(U.H);
  let x = i32(id.x);
  let yy = i32(id.y);
  if (x >= W || yy >= H * i32(U.layers)) { return; }
  let L = yy / H;
  let y = yy % H;
  let salt = u32(L) * 0x51ed27u + 17u;
  // an organic wobble, wrapping round
  let q = vec2f(f32(x), f32(y));
  let wp = vec2f(pnoise(q / 40.0, W / 40, salt), pnoise(q / 40.0 + 19.7, W / 40, salt ^ 99u)) - 0.5;
  let n1 = i32(round(U.cells * pow(0.85, f32(L))));
  let c1 = U.W / f32(n1);
  let p1 = (q + wp * c1 * U.warp) / c1;
  let a = foamEdges(p1, n1, salt);
  // each strand its own weight: a few heavy ones carry the vessel, many light ones fill it
  let wgt = 0.35 + 1.3 * a.z * a.z;
  var T = U.webPeak * (0.55 + 0.6 * wgt) * exp(-pow(a.x / (0.045 * wgt), 2.0));
  T += U.webPeak * 0.45 * exp(-pow(a.y / 0.09, 2.0)) * exp(-pow(a.x / 0.09, 2.0));
  // the finer net, only some of its edges
  let n2 = n1 * 2;
  let c2 = U.W / f32(n2);
  let b = foamEdges((q + wp * c2 * U.warp * 1.5) / c2, n2, salt ^ 0xabcdu);
  if (b.z > 1.0 - U.fine) { T = max(T, U.webPeak * 0.45 * exp(-pow(b.x / 0.06, 2.0))); }
  // rings at the crown and the foot
  if (L == 0) {
    // a scalloped crown: the ring dips between points
    let around = f32(x) / U.W * TAU;
    let dip = 7.0 * pow(0.5 + 0.5 * sin(around * 13.0 + 0.6 * sin(around * 5.0)), 2.0);
    let top = f32(H - 1 - y) - dip;
    T = max(T, U.webPeak * 1.2 * exp(-top * top / 5.0));
    T = max(T, U.webPeak * 0.9 * exp(-f32(y * y) / 5.0));
  }
  food[cell(x, y, L)] = T;
}
