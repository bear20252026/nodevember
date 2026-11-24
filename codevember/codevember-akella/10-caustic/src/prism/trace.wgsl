// photons from the light, one grid of them per wavelength band, through the knot to the floor (y = 0).
// The way to the glass is the same for every band, so it is marched once; from the first surface on each
// band bends by its own index. Each photon keeps where it landed, its strength after the surfaces it
// crossed, and how many surfaces it met, so the light mesh only joins neighbours that went the same way.

@group(0) @binding(2) var<storage, read_write> landed: array<vec4f>;

fn floorHit(p: vec3f, d: vec3f) -> vec4f {
  if (d.y > -1e-4) { return vec4f(0.0, 0.0, 0.0, -1.0); }
  let q = p + d * (-p.y / d.y);
  return vec4f(q.x, q.z, 1.0, 0.0);
}

@compute @workgroup_size(8, 8)
fn trace(@builtin(global_invocation_id) id: vec3u) {
  let nu = u32(U.nu);
  let nv = u32(U.nv);
  if (id.x >= nu || id.y >= nv) { return; }
  let np = nu * nv;
  let idx = id.y * nu + id.x;
  let nb = u32(U.bands);
  let L = lightDir();
  let up = select(vec3f(0.0, 1.0, 0.0), vec3f(1.0, 0.0, 0.0), abs(L.y) > 0.9);
  let u0 = normalize(cross(L, up));
  let v0 = cross(u0, L);
  // the beam's own axes, turned by the slit's angle
  let u = u0 * cos(U.slitAngle) + v0 * sin(U.slitAngle);
  let v = -u0 * sin(U.slitAngle) + v0 * cos(U.slitAngle);
  // the grid is shifted by a fraction of a cell each frame and the light image averaged over frames
  let s = (vec2f(id.xy) + 0.5 + vec2f(U.jx, U.jy)) / vec2f(f32(nu), f32(nv)) * 2.0 - 1.0;
  // a round beam, or a thin slit of light across it (offset as it sweeps)
  let slit = U.slitW > 0.0;
  let sv = select(s.y, s.y * U.slitW + U.slitOff, slit);
  let o = knotCentre() - L * U.beamDist + (u * s.x + v * sv) * U.beamR;
  if ((!slit && dot(s, s) > 1.0) || (slit && s.x * s.x + U.slitOff * U.slitOff > 1.0)) {
    for (var b = 0u; b < nb; b++) { landed[b * np + idx] = vec4f(0.0, 0.0, 0.0, -1.0); }
    return;
  }
  let t0 = marchOutside(o, L);
  if (t0 < 0.0) {
    var hit = floorHit(o, L);
    hit.z = U.direct;
    for (var b = 0u; b < nb; b++) { landed[b * np + idx] = hit; }
    return;
  }
  let p0 = o + L * t0;
  let n0 = knotNormal(p0);
  for (var b = 0u; b < nb; b++) {
    let ior = bands[b].x;
    var p = p0;
    var d = L;
    var n = n0;
    var w = 1.0;
    var code = 1.0;
    var free = false;
    for (var e = 0; e < 4; e++) {
      // at a surface from outside: in
      w *= 1.0 - fresnel(max(-dot(d, n), 0.0), 1.0 / ior);
      d = refract(d, n, 1.0 / ior);
      var out = false;
      for (var k = 0; k < 4; k++) {
        let ti = marchInside(p, d);
        if (ti < 0.0) { break; }
        p += d * ti;
        n = knotNormal(p);
        code += 1.0;
        let r = refract(d, -n, ior);
        if (dot(r, r) < 1e-8) {
          // totally reflected inside, and on
          d = reflect(d, -n);
          code += 8.0;
          continue;
        }
        w *= 1.0 - fresnel(dot(d, n), ior);
        d = r;
        out = true;
        break;
      }
      if (!out) { break; }
      // out in the air: it may still meet another strand
      let to = marchOutside(p + d * 3e-3, d);
      if (to < 0.0) {
        free = true;
        break;
      }
      p = p + d * (to + 3e-3);
      n = knotNormal(p);
      code += 1.0;
    }
    var hit = vec4f(0.0, 0.0, 0.0, -1.0);
    if (free) {
      hit = floorHit(p, d);
      if (hit.w >= 0.0) {
        hit.z = w;
        hit.w = code;
      }
    }
    landed[b * np + idx] = hit;
  }
}
