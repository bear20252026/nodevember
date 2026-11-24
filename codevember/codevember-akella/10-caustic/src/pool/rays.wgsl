// the sun through the surface: one ray per point of a fine grid over the pool, refracted and carried
// to the floor's plane (past the walls too, which then look their light up there). Things above the
// water shade it, petals tint it, marbles bend it again.

@group(0) @binding(4) var<storage, read_write> verts: array<vec4f>;

@compute @workgroup_size(64)
fn rays(@builtin(global_invocation_id) id: vec3u) {
  let mx = u32(U.mx);
  let mz = u32(U.mz);
  if (id.x >= mx * mz) { return; }
  let ix = id.x % mx;
  let iz = id.x / mx;
  let xz = vec2f(-U.PX, -U.PZ) + vec2f(f32(ix), f32(iz)) / vec2f(U.mx - 1.0, U.mz - 1.0) * vec2f(2.0 * U.PX, 2.0 * U.PZ);
  let w = water(xz);
  let n = normalize(vec3f(-w.y, 1.0, -w.z));
  let S = sunDir();
  var p = vec3f(xz.x, w.x, xz.y);
  var lum = 1.0;
  // the coping's shadow on the water
  let e = p + S * ((U.RIM - p.y) / S.y);
  if (abs(e.x) > U.PX || abs(e.z) > U.PZ) { lum = 0.0; }
  let sh = shadow(p - S * 0.03, S);
  lum *= sh.x;
  var d = refract(-S, n, 1.0 / IOR);
  for (var k = 0; k < 3; k++) {
    if (lum <= 0.0) { break; }
    let h = trace(p, d, 1e3, false);
    if (h.t < 0.0) { break; }
    if (u32(objs[h.i].b.w) != 2u) {
      lum = 0.0;
      break;
    }
    // into the marble and out again
    let P = p + d * h.t;
    let d1 = refract(d, h.n, IOR / GLASS);
    let h2 = objHit(h.i, P + d1 * 1e-4, d1);
    if (h2.t < 0.0) { break; }
    let X = P + d1 * (1e-4 + h2.t);
    var d2 = refract(d1, -h2.n, GLASS / IOR);
    if (dot(d2, d2) < 0.5) { d2 = reflect(d1, -h2.n); }
    p = X + d2 * 1e-4;
    d = d2;
    lum *= 0.9;
  }
  if (d.y > -0.05) { lum = 0.0; }
  let t = (-U.D - p.y) / min(d.y, -0.05);
  let q = p + d * t;
  verts[id.x] = vec4f(q.x, q.z, lum, sh.y);
}
