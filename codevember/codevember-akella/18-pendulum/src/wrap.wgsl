// A square of shiny cloth held in a frame, and a ball through it. n x n particles, position based (XPBD, a
// few Gauss-Seidel sweeps per substep, many short substeps). The grid's distance constraints come in kinds
// and colours so that one dispatch never touches a particle twice:
//   kind 0/1  stretch, along x / along y          colour = first end's coordinate % 2
//   kind 2/3  shear, the two diagonals            colour = x % 2
//   kind 4/5  bend, skipping one, along x / y     colour = (coordinate / 2) % 2
// The edge particles are held by the frame on stiff springs, each with its own grip: pulled out further
// than its grip, it lets go for good. The ball is solid and moves on a given path; the cloth clings to it.
// The ball hangs on a rod from a pivot, and the rod is solid too.
// The cloth also keeps off itself: particles of far-apart places on the sheet are kept a thickness apart
// (a spatial hash, rebuilt every few substeps into a short list of neighbours per particle). Still air
// pushes back on the cloth's faces, as the square of the speed.

struct Params {
  n: u32, subs: u32, selfOn: u32, hashMask: u32,
  h: f32, d: f32, g: f32, damp: f32,
  aStretch: f32, aShear: f32, aBend: f32, airQ: f32,
  airT: f32, mu: f32, rc: f32, muSelf: f32,
  soft: f32, maxV: f32, cell: f32, ballR: f32,
  gap: f32, gripScale: f32, ballGrew: f32, pad2: f32, // ballGrew: how much bigger the ball is at the frame's end than its start
  b0: vec4f, // the ball's centre at the start and end of the frame
  b1: vec4f,
  piv: vec4f, // the pendulum's pivot; w the rod's radius (0: no rod)
}
struct Pass { kind: u32, color: u32, frac: f32, sub: u32 }

@group(0) @binding(0) var<storage, read_write> pos: array<vec4f>;
@group(0) @binding(1) var<storage, read_write> old: array<vec4f>;
@group(0) @binding(2) var<storage, read_write> vel: array<vec4f>;
// the frame's hold on an edge particle: where it is held, w its grip (how far it may be pulled out); 0
// once let go, < 0 for a particle the frame never held
@group(0) @binding(3) var<storage, read_write> anchor: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> tmp: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> counts: array<atomic<u32>>;
@group(0) @binding(6) var<storage, read_write> slots: array<u32>;
@group(0) @binding(7) var<storage, read_write> nbr: array<u32>;
@group(0) @binding(8) var<uniform> P: Params;
@group(0) @binding(9) var<uniform> pass_: Pass;
@group(0) @binding(10) var outPos: texture_storage_2d<rgba32float, write>;
@group(0) @binding(11) var outNor: texture_storage_2d<rgba32float, write>;

const K = 16u; // neighbours a particle keeps
const NONE = 0xffffffffu;

fn normalOf(i: u32) -> vec3f {
  let n = P.n;
  let x = i % n;
  let y = i / n;
  let l = old[select(i - 1u, i, x == 0u)].xyz;
  let r = old[select(i + 1u, i, x == n - 1u)].xyz;
  let b = old[select(i - n, i, y == 0u)].xyz;
  let t = old[select(i + n, i, y == n - 1u)].xyz;
  let c = cross(r - l, t - b);
  let len = length(c);
  return select(vec3f(0.0), c / len, len > 1e-12);
}

@compute @workgroup_size(256)
fn predict(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i >= n * n) { return; }
  let p = old[i];
  var v = vel[i].xyz * P.damp;
  // still air: a push against the face as the square of its speed through it, a little along it
  let nn = normalOf(i);
  let vn = dot(v, nn);
  v -= nn * (vn * min(1.0, P.airQ * abs(vn) * P.h));
  let vt = v - nn * dot(v, nn);
  v -= vt * min(1.0, P.airT * P.h);
  v.y -= P.g * P.h;
  let s = length(v);
  if (s > P.maxV) { v *= P.maxV / s; }
  var x = p.xyz + v * P.h;
  // the frame's hold: a stiff spring, until the sheet pulls it out further than its grip
  let a = anchor[i];
  if (a.w > 0.0) {
    let df = x - a.xyz;
    let dist = length(df);
    if (dist > a.w * P.gripScale) {
      anchor[i] = vec4f(a.xyz, 0.0);
    } else {
      x -= df / (1.0 + P.soft);
    }
  }
  pos[i] = vec4f(x, p.w);
}

@compute @workgroup_size(256)
fn edges(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let half = n / 2u;
  let t = gid.x;
  if (t >= half * n) { return; }
  let row = t / half;
  let m = t % half;
  let kind = pass_.kind;
  let c = pass_.color;
  var k: u32;
  var span = 1u;
  if (kind < 4u) {
    k = 2u * m + c;
  } else {
    k = 4u * (m / 2u) + 2u * c + (m % 2u);
    span = 2u;
  }
  if (k + span >= n) { return; }
  var ia: u32;
  var ib: u32;
  var rest = P.d;
  var alpha = P.aStretch;
  switch kind {
    case 0u: { ia = row * n + k; ib = ia + 1u; }
    case 1u: { ia = k * n + row; ib = ia + n; }
    case 2u: {
      if (row >= n - 1u) { return; }
      ia = row * n + k; ib = ia + n + 1u; rest = P.d * 1.41421356; alpha = P.aShear;
    }
    case 3u: {
      if (row >= n - 1u) { return; }
      ia = row * n + k + 1u; ib = ia + n - 1u; rest = P.d * 1.41421356; alpha = P.aShear;
    }
    case 4u: { ia = row * n + k; ib = ia + 2u; rest = 2.0 * P.d; alpha = P.aBend; }
    default: { ia = k * n + row; ib = ia + 2u * n; rest = 2.0 * P.d; alpha = P.aBend; }
  }
  let pa = pos[ia];
  let pb = pos[ib];
  let w = pa.w + pb.w;
  if (w == 0.0) { return; }
  let dv = pa.xyz - pb.xyz;
  let len = length(dv);
  if (len < 1e-9) { return; }
  var C = len - rest;
  // a bend spring only resists folding (being pushed shorter), never pulls: the stretch springs do that
  if (kind >= 4u) { C = min(C, 0.0); }
  // compliance is given per unit of the particles' own inverse mass
  let dl = -C / (w * (1.0 + alpha));
  let corr = dv * (dl / len);
  pos[ia] = vec4f(pa.xyz + corr * pa.w, pa.w);
  pos[ib] = vec4f(pb.xyz - corr * pb.w, pb.w);
}

// ---- keeping off itself
fn cellOf(x: vec3f) -> vec3i { return vec3i(floor(x / P.cell)); }
fn bucket(c: vec3i) -> u32 {
  let h = (u32(c.x) * 73856093u) ^ (u32(c.y) * 19349663u) ^ (u32(c.z) * 83492791u);
  return h & P.hashMask;
}

// a counting sort of the particles by bucket, so a bucket holds every particle that hashes there (none
// dropped, whatever the crowd) in one run of `slots`: slots[0, T) the start of each bucket within its block
// of 256, slots[T, T + T/256) where each block starts, slots[SORTED...) the particles in bucket order
fn blocks() -> u32 { return (P.hashMask + 1u) / 256u; }
fn sortedAt() -> u32 { return P.hashMask + 1u + blocks(); }
fn bucketStart(b: u32) -> u32 {
  if (b > P.hashMask) { return P.n * P.n; }
  return slots[b] + slots[P.hashMask + 1u + b / 256u];
}

@compute @workgroup_size(256)
fn hashClear(@builtin(global_invocation_id) gid: vec3u) {
  if (gid.x <= P.hashMask) { atomicStore(&counts[gid.x], 0u); }
}

@compute @workgroup_size(256)
fn hashCount(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n * P.n) { return; }
  atomicAdd(&counts[bucket(cellOf(pos[i].xyz))], 1u);
}

var<workgroup> scan: array<u32, 256>;

// each block of 256 buckets: where each starts within the block, and the block's total
@compute @workgroup_size(256)
fn scanBlocks(@builtin(global_invocation_id) gid: vec3u, @builtin(local_invocation_index) lid: u32, @builtin(workgroup_id) wid: vec3u) {
  let c = atomicLoad(&counts[gid.x]);
  scan[lid] = c;
  workgroupBarrier();
  for (var o = 1u; o < 256u; o <<= 1u) {
    var v = 0u;
    if (lid >= o) { v = scan[lid - o]; }
    workgroupBarrier();
    scan[lid] += v;
    workgroupBarrier();
  }
  slots[gid.x] = scan[lid] - c;
  if (lid == 255u) { slots[P.hashMask + 1u + wid.x] = scan[lid]; }
}

// one workgroup: the blocks' totals become where each block starts
@compute @workgroup_size(256)
fn scanSums(@builtin(local_invocation_index) lid: u32) {
  let nb = blocks();
  let per = (nb + 255u) / 256u;
  let base = P.hashMask + 1u;
  var sum = 0u;
  for (var k = 0u; k < per; k++) {
    let j = lid * per + k;
    if (j < nb) { sum += slots[base + j]; }
  }
  scan[lid] = sum;
  workgroupBarrier();
  for (var o = 1u; o < 256u; o <<= 1u) {
    var v = 0u;
    if (lid >= o) { v = scan[lid - o]; }
    workgroupBarrier();
    scan[lid] += v;
    workgroupBarrier();
  }
  var at = scan[lid] - sum;
  for (var k = 0u; k < per; k++) {
    let j = lid * per + k;
    if (j < nb) {
      let t = slots[base + j];
      slots[base + j] = at;
      at += t;
    }
  }
}

@compute @workgroup_size(256)
fn scatter(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n * P.n) { return; }
  let b = bucket(cellOf(pos[i].xyz));
  let k = atomicSub(&counts[b], 1u) - 1u;
  slots[sortedAt() + bucketStart(b) + k] = i;
}

// the particles within reach, leaving out those near on the sheet itself (the grid's own springs keep those).
// When more are in reach than the list holds, it keeps the nearest (ties by index), and lists them in order of
// index: so the list, and the sums over it, come out the same whatever order the hash was filled in, and every
// run of the same cloth is the same run
@compute @workgroup_size(256)
fn neighbours(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i >= n * n) { return; }
  let x = pos[i].xyz;
  let c = cellOf(x);
  let gi = vec2f(f32(i % n), f32(i / n));
  let reach = P.cell * P.cell;
  let near = 2.0 * P.rc / P.d;
  var ids: array<u32, 16>;
  var ds: array<f32, 16>;
  var found = 0u;
  for (var dz = -1; dz <= 1; dz++) {
    for (var dy = -1; dy <= 1; dy++) {
      for (var dx = -1; dx <= 1; dx++) {
        let b = bucket(c + vec3i(dx, dy, dz));
        let s0 = bucketStart(b);
        let s1 = bucketStart(b + 1u);
        for (var s = s0; s < s1; s++) {
          let j = slots[sortedAt() + s];
          if (j == i) { continue; }
          let gj = vec2f(f32(j % n), f32(j / n));
          if (length(gi - gj) <= near) { continue; }
          let e = pos[j].xyz - x;
          let d2 = dot(e, e);
          if (d2 > reach) { continue; }
          // a bucket can hold the same particle twice over (two cells hashed alike): keep it once
          var dup = false;
          for (var q = 0u; q < found; q++) { if (ids[q] == j) { dup = true; } }
          if (dup) { continue; }
          // insert by (distance, index); when full, the farthest drops off the end
          var at = found;
          if (found == K) {
            let lj = ids[K - 1u];
            if (d2 > ds[K - 1u] || (d2 == ds[K - 1u] && j > lj)) { continue; }
            at = K - 1u;
          } else {
            found++;
          }
          while (at > 0u && (ds[at - 1u] > d2 || (ds[at - 1u] == d2 && ids[at - 1u] > j))) {
            ids[at] = ids[at - 1u];
            ds[at] = ds[at - 1u];
            at--;
          }
          ids[at] = j;
          ds[at] = d2;
        }
      }
    }
  }
  // in order of index
  for (var a = 1u; a < found; a++) {
    let v = ids[a];
    var b = a;
    while (b > 0u && ids[b - 1u] > v) {
      ids[b] = ids[b - 1u];
      b--;
    }
    ids[b] = v;
  }
  for (var q = 0u; q < K; q++) { nbr[i * K + q] = select(NONE, ids[q], q < found); }
}

// Jacobi: each particle moves itself half the overlap with every neighbour, so the pair together closes it;
// friction takes out some of their sliding past each other, so stacked folds stay stacked
@compute @workgroup_size(256)
fn selfCollide(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= P.n * P.n) { return; }
  let x = pos[i].xyz;
  if (P.selfOn == 0u) {
    tmp[i] = pos[i];
    return;
  }
  let mv = x - old[i].xyz;
  var corr = vec3f(0.0);
  var hits = 0.0;
  for (var q = 0u; q < K; q++) {
    let j = nbr[i * K + q];
    if (j == NONE) { break; }
    let xj = pos[j].xyz;
    let e = x - xj;
    let dist = length(e);
    if (dist >= P.rc || dist < 1e-9) { continue; }
    let nn = e / dist;
    let pen = P.rc - dist;
    corr += nn * (0.5 * pen);
    let rel = mv - (xj - old[j].xyz);
    let tang = rel - nn * dot(rel, nn);
    let tl = length(tang);
    if (tl > 1e-12) { corr -= tang * (0.5 * min(1.0, P.muSelf * pen / tl)); }
    hits += 1.0;
  }
  tmp[i] = vec4f(x + corr / max(1.0, hits * 0.5), pos[i].w);
}

// the ball, then the substep's velocities
@compute @workgroup_size(256)
fn collide(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i >= n * n) { return; }
  let p = tmp[i];
  let o = old[i];
  var x = p.xyz;
  let f1 = pass_.frac;
  let f0 = f1 - 1.0 / f32(P.subs);
  let c = mix(P.b0.xyz, P.b1.xyz, f1);
  let cp = mix(P.b0.xyz, P.b1.xyz, f0);
  // (a ball changing size does so over the frame's substeps; exactly ballR when it is not)
  let R = P.ballR - P.ballGrew * (1.0 - f1) + P.gap;
  let e = x - c;
  let dist = length(e);
  if (dist < R && dist > 1e-9) {
    let nn = e / dist;
    let pen = R - dist;
    x += nn * pen;
    // friction against the ball's surface, which moved (c - cp) this substep
    let rel = (x - o.xyz) - (c - cp);
    let tang = rel - nn * dot(rel, nn);
    let tl = length(tang);
    if (tl > 1e-12) { x -= tang * min(1.0, P.mu * pen / tl); }
  }
  // the rod: a thin capsule from the ball up to the pivot, swinging about the pivot
  if (P.piv.w > 0.0) {
    let pv = P.piv.xyz;
    let ax = c - pv;
    let u = clamp(dot(x - pv, ax) / dot(ax, ax), 0.0, 1.0);
    let q = pv + ax * u;
    let er = x - q;
    let dr = length(er);
    let Rr = P.piv.w + P.gap;
    if (dr < Rr && dr > 1e-9) {
      let nn = er / dr;
      let pen = Rr - dr;
      x += nn * pen;
      let qp = pv + (cp - pv) * u; // the same point on the rod a substep ago
      let rel = (x - o.xyz) - (q - qp);
      let tang = rel - nn * dot(rel, nn);
      let tl = length(tang);
      if (tl > 1e-12) { x -= tang * min(1.0, 0.3 * pen / tl); }
    }
  }
  pos[i] = vec4f(x, p.w);
  old[i] = vec4f(x, p.w);
  vel[i] = vec4f((x - o.xyz) / P.h, 0.0);
}

// once a frame: positions, and normals with how hollow the cloth is there (w), for drawing
@compute @workgroup_size(256)
fn publish(@builtin(global_invocation_id) gid: vec3u) {
  let n = P.n;
  let i = gid.x;
  if (i >= n * n) { return; }
  let x = i % n;
  let y = i / n;
  let c = old[i].xyz;
  let l = old[select(i - 1u, i, x == 0u)].xyz;
  let r = old[select(i + 1u, i, x == n - 1u)].xyz;
  let b = old[select(i - n, i, y == 0u)].xyz;
  let t = old[select(i + n, i, y == n - 1u)].xyz;
  let cr = cross(r - l, t - b);
  let len = length(cr);
  let nn = select(vec3f(0.0, 0.0, 1.0), cr / len, len > 1e-12);
  // the Laplacian against the normal: > 0 where the cloth curls towards its normal side
  var lap = vec3f(0.0);
  var cnt = 0.0;
  if (x > 0u && x < n - 1u) { lap += l + r - 2.0 * c; cnt += 1.0; }
  if (y > 0u && y < n - 1u) { lap += b + t - 2.0 * c; cnt += 1.0; }
  let hollow = select(0.0, dot(lap, nn) / (cnt * P.d), cnt > 0.0);
  textureStore(outPos, vec2u(x, y), vec4f(c, select(1.0, 0.0, anchor[i].w == 0.0)));
  textureStore(outNor, vec2u(x, y), vec4f(nn, hollow));
}
