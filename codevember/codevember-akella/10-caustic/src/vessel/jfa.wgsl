// from web to geometry: the ridge of every strand becomes a seed carrying its thickness, and the strongest
// knots become seeds for thorns; a jump flood then gives every texel its nearest seed

@group(0) @binding(1) var<storage, read_write> trail: array<f32>;
@group(0) @binding(2) var<storage, read_write> food: array<f32>;
@group(0) @binding(3) var<storage, read_write> jIn: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> jOut: array<vec4f>;
@group(0) @binding(5) var<storage, read_write> knots: array<vec4f>;
@group(0) @binding(6) var<storage, read_write> knotCount: array<atomic<u32>>;
@group(0) @binding(7) var<uniform> P: vec4f;
@group(0) @binding(8) var<storage, read_write> soft: array<f32>;

/** the web's strength, about 1 on average */
fn web(x: i32, y: i32, L: i32) -> f32 {
  let k = cell(x, y, L);
  if (U.mode == 1.0 || U.mode == 3.0) { return food[k]; }
  return trail[k] / max(U.trailMean, 1e-3);
}

/** the web softened (5 x 5 Gaussian): the agents' footprints are noisy at the scale of a texel, and a ridge
 * test on the raw web finds hairs of false ridge along every strand */
fn webS(x: i32, y: i32, L: i32) -> f32 { return soft[cell(x, y, L)]; }

fn texel(id: vec3u) -> vec3i {
  let H = i32(U.H);
  return vec3i(i32(id.x), i32(id.y) % H, i32(id.y) / H);
}
fn inside(id: vec3u) -> bool { return id.x < u32(U.W) && id.y < u32(U.H) * u32(U.layers); }

@compute @workgroup_size(16, 16)
fn soften(@builtin(global_invocation_id) id: vec3u) {
  if (!inside(id)) { return; }
  let t = texel(id);
  var sum = 0.0;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let w = exp(-f32(i * i + j * j) / 2.4);
      sum += w * web(t.x + i, t.y + j, t.z);
    }
  }
  soft[cell(t.x, t.y, t.z)] = sum / 7.2697;
}

@compute @workgroup_size(16, 16)
fn seedStrands(@builtin(global_invocation_id) id: vec3u) {
  if (!inside(id)) { return; }
  let t = texel(id);
  let T = webS(t.x, t.y, t.z);
  var out = vec4f(0.0, 0.0, 0.0, -1.0);
  if (T > U.thr) {
    // a ridge, found with the web's Hessian: across the strand it falls fastest (the most negative
    // eigenvalue), along it barely. A Newton step across puts the seed on the peak between texels, and
    // the seed keeps the strand's direction, so the glass is made of short overlapping capsules (smooth
    // tubes) rather than a string of balls
    let l = webS(t.x - 1, t.y, t.z);
    let r = webS(t.x + 1, t.y, t.z);
    let d = webS(t.x, t.y - 1, t.z);
    let u = webS(t.x, t.y + 1, t.z);
    let g = vec2f(r - l, u - d) * 0.5;
    let hxx = r - 2.0 * T + l;
    let hyy = u - 2.0 * T + d;
    let hxy = (webS(t.x + 1, t.y + 1, t.z) - webS(t.x + 1, t.y - 1, t.z) - webS(t.x - 1, t.y + 1, t.z) + webS(t.x - 1, t.y - 1, t.z)) * 0.25;
    let m = 0.5 * (hxx + hyy);
    let q = sqrt(max(0.25 * (hxx - hyy) * (hxx - hyy) + hxy * hxy, 0.0));
    let l1 = m - q;
    let l2 = m + q;
    var across = vec2f(1.0, 0.0);
    if (abs(hxy) > 1e-6) {
      across = normalize(vec2f(l1 - hyy, hxy));
    } else if (hyy < hxx) {
      across = vec2f(0.0, 1.0);
    }
    if (l1 < 0.0 && abs(l1) > abs(l2)) {
      let sOff = -dot(g, across) / l1;
      if (abs(sOff) <= 0.55) {
        let tang = vec2f(-across.y, across.x);
        let ang = atan2(tang.y, tang.x);
        out = vec4f(f32(t.x) + across.x * sOff, f32(t.y) + across.y * sOff, U.rMin + U.rK * sqrt(T - U.thr), 1.0 + (ang - PI * floor(ang / PI)));
      }
    }
  }
  jOut[cell(t.x, t.y, t.z)] = out;
}

// knots are found and flooded on a grid four times coarser: thorns stand far apart

fn kdims() -> vec2i { return vec2i(i32(U.W) / 4, (i32(U.H) + 3) / 4); }
fn kcell(x: i32, y: i32) -> u32 {
  let d = kdims();
  return u32(clamp(y, 0, d.y - 1) * d.x + ((x % d.x) + d.x) % d.x);
}

/** each block's strongest texel on the outer skin */
@compute @workgroup_size(16, 16)
fn blockMax(@builtin(global_invocation_id) id: vec3u) {
  let d = kdims();
  if (i32(id.x) >= d.x || i32(id.y) >= d.y) { return; }
  var best = vec4f(0.0, 0.0, -1.0, 1.0);
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < 4; i++) {
      let x = i32(id.x) * 4 + i;
      let y = min(i32(id.y) * 4 + j, i32(U.H) - 1);
      let T = webS(x, y, 0);
      if (T > best.z) { best = vec4f(f32(x), f32(y), T, 1.0); }
    }
  }
  jIn[kcell(i32(id.x), i32(id.y))] = best;
}

/** a knot: a block stronger than the eight round it */
@compute @workgroup_size(16, 16)
fn seedKnots(@builtin(global_invocation_id) id: vec3u) {
  let d = kdims();
  let x = i32(id.x);
  let y = i32(id.y);
  if (x >= d.x || y >= d.y) { return; }
  let c = jIn[kcell(x, y)];
  var top = c.z > U.nodeThr;
  for (var j = -1; j <= 1 && top; j++) {
    for (var i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) { continue; }
      if (y + j < 0 || y + j >= d.y) { continue; }
      let o = jIn[kcell(x + i, y + j)];
      if (o.z > c.z || (o.z == c.z && (j < 0 || (j == 0 && i < 0)))) {
        top = false;
        break;
      }
    }
  }
  // spikes stand all along the crown and threads hang all along the foot, a block in so many
  if (y == d.y - 1 && h01(u32(x) * 2654435761u + 7u) < U.crown) {
    top = true;
  }
  if (y == 0 && h01(u32(x) * 2246822519u + 3u) < U.hem) {
    top = true;
  }
  // and over the body only the strongest junctions, some of them
  if (y > 0 && y < d.y - 1 && h01((u32(x) * 3266489917u) ^ (u32(y) * 668265263u)) > U.thorns) {
    top = false;
  }
  var out = vec4f(0.0, 0.0, 0.0, -1.0);
  if (top) {
    out = c;
    out.z = max(out.z, U.nodeThr);
    let n = atomicAdd(&knotCount[0], 1u);
    if (n < arrayLength(&knots)) { knots[n] = c; }
  }
  jOut[kcell(x, y)] = out;
}

@compute @workgroup_size(16, 16)
fn floodKnots(@builtin(global_invocation_id) id: vec3u) {
  let dm = kdims();
  let x = i32(id.x);
  let y = i32(id.y);
  if (x >= dm.x || y >= dm.y) { return; }
  let s = i32(P.x);
  let me = vec2f(f32(x * 4) + 1.5, f32(y * 4) + 1.5);
  var best = jIn[kcell(x, y)];
  var bd = 1e20;
  if (best.w > 0.0) {
    let d = vec2f(wrapd(best.x - me.x), best.y - me.y);
    bd = dot(d, d);
  }
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) { continue; }
      let yy = y + j * s;
      if (yy < 0 || yy >= dm.y) { continue; }
      let c = jIn[kcell(x + i * s, yy)];
      if (c.w <= 0.0) { continue; }
      let d = vec2f(wrapd(c.x - me.x), c.y - me.y);
      let dd = dot(d, d);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
  }
  jOut[kcell(x, y)] = best;
}

@compute @workgroup_size(16, 16)
fn flood(@builtin(global_invocation_id) id: vec3u) {
  if (!inside(id)) { return; }
  let t = texel(id);
  let s = i32(P.x);
  var best = jIn[cell(t.x, t.y, t.z)];
  var bd = 1e20;
  if (best.w > 0.0) {
    let d = vec2f(wrapd(best.x - f32(t.x)), best.y - f32(t.y));
    bd = dot(d, d);
  }
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) { continue; }
      let y = t.y + j * s;
      if (y < 0 || y >= i32(U.H)) { continue; }
      let c = jIn[cell(t.x + i * s, y, t.z)];
      if (c.w <= 0.0) { continue; }
      let d = vec2f(wrapd(c.x - f32(t.x)), c.y - f32(t.y));
      let dd = dot(d, d);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
  }
  jOut[cell(t.x, t.y, t.z)] = best;
}
