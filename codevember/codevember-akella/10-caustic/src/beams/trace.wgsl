// photons from the light through the glass. Each leaves up to SEGS straight runs through the air (the
// beams), with where it started along the light's path (optical path length) and its power.
// segs[2k] = (start, optical path at start), segs[2k+1] = (end, power; negative if it never met the glass)

@group(0) @binding(1) var<storage, read_write> segs: array<vec4f>;
// the beams worth drawing, and the bundle each belongs to; args are the indirect draw's
@group(0) @binding(2) var<storage, read_write> list: array<u32>;
@group(0) @binding(3) var<storage, read_write> foot: array<vec4f>;
@group(0) @binding(4) var<storage, read_write> args: array<atomic<u32>>;

fn fresnelT(cosi: f32, eta: f32) -> f32 {
  // unpolarised dielectric transmission, eta = n_from / n_to
  let sint2 = eta * eta * max(0.0, 1.0 - cosi * cosi);
  if (sint2 >= 1.0) { return 0.0; }
  let cost = sqrt(1.0 - sint2);
  let rs = (eta * cosi - cost) / (eta * cosi + cost);
  let rp = (cosi - eta * cost) / (cosi + eta * cost);
  return 1.0 - 0.5 * (rs * rs + rp * rp);
}

// distance along the ray to the glass from outside, or -1
fn marchOutside(ro: vec3f, rd: vec3f, tMax: f32) -> f32 {
  let span = sphereSpan(ro, rd, glassBound());
  if (span.x > span.y || span.y < 0.0) { return -1.0; }
  var t = max(span.x, 0.0);
  let tEnd = min(span.y, tMax);
  for (var i = 0; i < 160; i++) {
    if (t > tEnd) { return -1.0; }
    let d = sdGlass(ro + rd * t);
    if (d < 2e-4) { return t; }
    t += d;
  }
  return -1.0;
}

// distance along the ray, from inside, to where it leaves the glass
fn marchInside(ro: vec3f, rd: vec3f) -> f32 {
  var t = 0.0;
  for (var i = 0; i < 128; i++) {
    let d = -sdGlass(ro + rd * t);
    if (d < 2e-4) { return t; }
    t += max(d, 1e-4);
    if (t > 4.0) { break; }
  }
  return t;
}

fn put(base: u32, k: u32, a: vec3f, b: vec3f, opl: f32, power: f32) {
  segs[2u * (base + k)] = vec4f(a, opl);
  segs[2u * (base + k) + 1u] = vec4f(b, power);
}

@compute @workgroup_size(64)
fn trace(@builtin(global_invocation_id) id: vec3u) {
  let n = u32(U.np);
  let photon = id.x;
  if (photon >= n * n) { return; }
  let S = u32(U.segs);
  let base = photon * S;
  for (var k = 0u; k < S; k++) { put(base, k, vec3f(0.0), vec3f(0.0), 0.0, 0.0); }

  // a jittered grid over a disc facing the light, a little way behind the glass
  let L = normalize(vec3f(U.lightX, U.lightY, U.lightZ));
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9);
  let ex = normalize(cross(up, L));
  let ey = cross(L, ex);
  let ix = photon % n;
  let iy = photon / n;
  let j = vec2f(hash01(photon * 2u + 11u), hash01(photon * 2u + 12u)) - 0.5;
  let g = ((vec2f(f32(ix), f32(iy)) + 0.5 + j * U.jitter) / f32(n)) * 2.0 - 1.0;
  let r = length(g);
  if (r > 1.0) { return; }
  // a spot, soft at its rim
  var power = 1.0 - smoothstep(0.82, 1.0, r);
  if (power <= 0.0) { return; }
  var pos = g.x * U.spotR * ex + g.y * U.spotR * ey - L * U.launch;
  var dir = L;
  var opl = 0.0;
  let ior = bandIor(photon);
  var k = 0u;
  var touched = false;
  var inside = false;
  for (var bounce = 0; bounce < 12; bounce++) {
    if (!inside) {
      let span = sphereSpan(pos, dir, U.far);
      let tFar = max(span.y, 0.0);
      let t = marchOutside(pos, dir, tFar);
      if (t < 0.0) {
        put(base, k, pos, pos + dir * tFar, opl, select(-power, power, touched));
        return;
      }
      let hit = pos + dir * t;
      put(base, k, pos, hit, opl, select(-power, power, touched));
      k++;
      opl += t;
      touched = true;
      let nrm = glassNormal(hit);
      let cosi = -dot(dir, nrm);
      power *= fresnelT(max(cosi, 0.0), 1.0 / ior);
      let rf = refract(dir, nrm, 1.0 / ior);
      if (dot(rf, rf) < 0.5) { return; }
      dir = normalize(rf);
      pos = hit - nrm * 6e-4;
      inside = true;
      if (k >= S) { return; }
    } else {
      let t = marchInside(pos, dir);
      let hit = pos + dir * t;
      opl += t * ior;
      // inside the glass light loses a touch, tinted
      power *= exp(-U.absorb * t);
      let nrm = glassNormal(hit);
      let cosi = dot(dir, nrm);
      let rf = refract(dir, -nrm, ior);
      if (dot(rf, rf) < 0.5) {
        // total internal reflection: it stays in the glass
        dir = reflect(dir, -nrm);
        pos = hit - nrm * 6e-4;
      } else {
        power *= fresnelT(max(cosi, 0.0), ior);
        dir = normalize(rf);
        pos = hit + nrm * 6e-4;
        inside = false;
      }
    }
  }
}

// the neighbour's matching beam, as (separation at the start, growth per unit along), if it took the same
// way through the glass; w = 0 if not
fn neighbour(q: i32, k: u32, a: vec3f, d: vec3f) -> vec4f {
  let n = i32(U.np);
  if (q < 0 || q >= n * n) { return vec4f(0.0); }
  let S = u32(U.segs);
  let i = u32(q) * S + k;
  let B = segs[2u * i + 1u];
  if (B.w == 0.0) { return vec4f(0.0); }
  let A = segs[2u * i];
  let dn = normalize(B.xyz - A.xyz);
  let e = A.xyz - a;
  // came out somewhere else, or on another course: not the same bundle
  if (length(e) > U.bundle || length(dn - d) > 0.6) { return vec4f(0.0); }
  return vec4f(e, 1.0);
}
fn neighbourDir(q: i32, k: u32) -> vec3f {
  let i = u32(q) * u32(U.segs) + k;
  return normalize(segs[2u * i + 1u].xyz - segs[2u * i].xyz);
}


// after a trace: list the beams that came through the glass, each with its bundle (the separations to
// the neighbouring photons' matching beams, and how they grow along it), which don't depend on the eye
@compute @workgroup_size(64)
fn compact(@builtin(global_invocation_id) id: vec3u) {
  let n = i32(U.np);
  let photon = id.x;
  if (photon >= u32(n * n)) { return; }
  let S = u32(U.segs);
  let pi = i32(photon);
  let px = pi % n;
  for (var k = 0u; k < S; k++) {
    let j = photon * S + k;
    let A = segs[2u * j];
    let B = segs[2u * j + 1u];
    // empty, or light that never met the glass (drawn as a smooth shaft instead)
    if (B.w <= 0.0) { continue; }
    let d = normalize(B.xyz - A.xyz);
    var qx = pi + 3;
    if (px + 3 >= n) { qx = pi - 3; }
    var nx = neighbour(qx, k, A.xyz, d);
    if (nx.w == 0.0 && px >= 3) {
      qx = pi - 3;
      nx = neighbour(qx, k, A.xyz, d);
    }
    var qy = pi + n;
    var ny = neighbour(qy, k, A.xyz, d);
    if (ny.w == 0.0) {
      qy = pi - n;
      ny = neighbour(qy, k, A.xyz, d);
    }
    var e1 = vec3f(0.0);
    var f1 = vec3f(0.0);
    var e2 = vec3f(0.0);
    var f2 = vec3f(0.0);
    if (nx.w > 0.0 && ny.w > 0.0) {
      e1 = nx.xyz;
      f1 = neighbourDir(qx, k) - d;
      e2 = ny.xyz;
      f2 = neighbourDir(qy, k) - d;
    }
    let slot = atomicAdd(&args[1], 1u);
    list[slot] = j;
    foot[3u * slot] = vec4f(e1, f1.x);
    foot[3u * slot + 1u] = vec4f(f1.yz, e2.xy);
    foot[3u * slot + 2u] = vec4f(e2.z, f2);
  }
}
