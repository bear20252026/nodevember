// the white plane, then the beams as thin camera-facing ribbons, added up in the HDR image

@group(0) @binding(1) var<storage, read> segs: array<vec4f>;
@group(0) @binding(2) var<storage, read> cut: array<vec2f>;
@group(0) @binding(3) var planeTex: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
@group(0) @binding(5) var<storage, read> list: array<u32>;
@group(0) @binding(6) var<storage, read> foot: array<vec4f>;

fn camPos() -> vec3f { return vec3f(U.camX, U.camY, U.camZ); }

struct POut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) world: vec3f,
};

@vertex
fn planeVS(@builtin(vertex_index) vi: u32) -> POut {
  let corners = array<vec2f, 6>(vec2f(0, 0), vec2f(1, 0), vec2f(0, 1), vec2f(0, 1), vec2f(1, 0), vec2f(1, 1));
  let c = corners[vi];
  let N = vec3f(U.planeNX, U.planeNY, U.planeNZ);
  let Ux = vec3f(U.planeUX, U.planeUY, U.planeUZ);
  let Vy = cross(N, Ux);
  let w = vec3f(U.planeX, U.planeY, U.planeZ) + ((c.x - 0.5) * Ux + (c.y - 0.5) * Vy) * U.planeSize;
  var o: POut;
  o.pos = U.proj * U.view * vec4f(w, 1.0);
  o.uv = c;
  o.world = w;
  return o;
}

@fragment
fn planeFS(in: POut) -> @location(0) vec4f {
  let E = textureSampleLevel(planeTex, smp, in.uv, 0.0).rgb;
  // matte paper, its edge fading into the dark
  let edge = smoothstep(0.0, 0.04, min(min(in.uv.x, 1.0 - in.uv.x), min(in.uv.y, 1.0 - in.uv.y)));
  let d = distance(in.world, camPos());
  let col = U.albedo * (E * U.planeGain + U.ambient) * exp(-U.sigma * d) * edge;
  return vec4f(col, 1.0);
}

struct BOut {
  @builtin(position) pos: vec4f,
  // across the ribbon, -1..1
  @location(0) side: f32,
  // along the segment, 0..1
  @location(1) u: f32,
  // the beam's own width over the width drawn (1 unless widened to stay visible)
  @location(2) scale: f32,
  @location(3) @interpolate(flat) a: vec3f,
  @location(4) @interpolate(flat) b: vec3f,
  @location(5) @interpolate(flat) color: vec3f,
  @location(6) @interpolate(flat) opl0: f32,
  // separations to the neighbouring photons' beams at the start, and how fast they grow per unit along
  @location(7) @interpolate(flat) e1: vec3f,
  @location(8) @interpolate(flat) f1: vec3f,
  @location(9) @interpolate(flat) e2: vec3f,
  @location(10) @interpolate(flat) f2: vec3f,
};

@vertex
fn beamVS(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> BOut {
  var o: BOut;
  o.pos = vec4f(2.0, 2.0, 2.0, 1.0);
  o.side = 0.0;
  o.u = 0.0;
  o.scale = 0.0;
  o.a = vec3f(0.0);
  o.b = vec3f(0.0);
  o.color = vec3f(0.0);
  o.opl0 = 0.0;
  o.e1 = vec3f(0.0);
  o.f1 = vec3f(0.0);
  o.e2 = vec3f(0.0);
  o.f2 = vec3f(0.0);
  // only beams that came through the glass are listed (see compact in trace.wgsl)
  let S = u32(U.segs);
  let j = list[ii];
  let photon = j / S;
  let k = j % S;
  let A = segs[2u * j];
  let B = segs[2u * j + 1u];
  let c = cut[photon];
  if (f32(k) > c.x) { return o; }
  var a = A.xyz;
  var b = B.xyz;
  if (f32(k) == c.x) { b = mix(a, b, c.y); }
  if (distance(a, b) < 1e-5) { return o; }
  let power = B.w;
  o.a = a;
  o.b = b;
  o.opl0 = A.w;
  o.color = bandColor(photon) * power * U.gain;
  let f0 = foot[3u * ii];
  let f1 = foot[3u * ii + 1u];
  let f2 = foot[3u * ii + 2u];
  o.e1 = f0.xyz;
  o.f1 = vec3f(f0.w, f1.xy);
  o.e2 = vec3f(f1.zw, f2.x);
  o.f2 = f2.yzw;

  // into view space, cut at the near plane
  var va = (U.view * vec4f(a, 1.0)).xyz;
  var vb = (U.view * vec4f(b, 1.0)).xyz;
  var ua = 0.0;
  var ub = 1.0;
  let near = -0.06;
  if (va.z > near && vb.z > near) { return o; }
  if (va.z > near) {
    let f = (near - vb.z) / (va.z - vb.z);
    va = mix(vb, va, f);
    ua = 1.0 - f;
  }
  if (vb.z > near) {
    let f = (near - va.z) / (vb.z - va.z);
    vb = mix(va, vb, f);
    ub = f;
  }
  let ca = U.proj * vec4f(va, 1.0);
  let cb = U.proj * vec4f(vb, 1.0);
  let res = vec2f(U.resX, U.resY);
  let sa = ca.xy / ca.w * res * 0.5;
  let sb = cb.xy / cb.w * res * 0.5;
  var dir = sb - sa;
  if (dot(dir, dir) < 1e-8) { dir = vec2f(1.0, 0.0); }
  dir = normalize(dir);
  let perp = vec2f(-dir.y, dir.x);

  // corners: (end, side) for two triangles
  let ends = array<u32, 6>(0u, 1u, 0u, 0u, 1u, 1u);
  let sides = array<f32, 6>(-1.0, -1.0, 1.0, 1.0, -1.0, 1.0);
  let e = ends[vi];
  let sd = sides[vi];
  let cc = select(ca, cb, e == 1u);
  let vz = select(va.z, vb.z, e == 1u);
  let own = U.beamR * U.focalPx / max(-vz, 1e-3);
  // wide enough to meet the neighbouring beams, so a sheet reads as a sheet and not a hatching; the
  // beam's light is spread over the width, not added to
  let sAlong = select(ua, ub, e == 1u) * distance(a, b);
  var gap = 0.0;
  if (dot(o.e1, o.e1) > 0.0) {
    gap = max(length(o.e1 + o.f1 * sAlong) / 3.0, length(o.e2 + o.f2 * sAlong)) * U.focalPx / max(-vz, 1e-3);
  }
  let half = clamp(max(own, gap * 0.5 * U.fill), U.minPx, max(U.minPx, U.maxPx));
  // stretch a little past each end so joins between segments don't gap
  let along = select(-1.0, 1.0, e == 1u) * half * 0.5;
  let off = (perp * sd * half + dir * along) / (res * 0.5) * cc.w;
  o.pos = vec4f(cc.xy + off, cc.z, cc.w);
  o.side = sd;
  o.u = select(ua, ub, e == 1u);
  o.scale = own / half;
  return o;
}

@fragment
fn beamFS(in: BOut) -> @location(0) vec4f {
  let x = mix(in.a, in.b, clamp(in.u, 0.0, 1.0));
  let len = distance(in.a, in.b);
  let d = normalize(in.b - in.a);
  let toEye = camPos() - x;
  let dist = length(toEye);
  let v = toEye / dist;
  let cosT = dot(d, v);
  let sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
  let opl = in.opl0 + in.u * len;
  // light dims along its way through the fog and again on the way to the eye
  let T = exp(-U.sigma * (opl - U.launch + dist));
  let kernel = exp(-3.0 * in.side * in.side);
  // how bunched the light is here: the bundle's cross-section against what it was in the spot. A lone
  // stray ray (no neighbours on its course) counts as spread thin.
  let s = in.u * len;
  var bunch = U.stray;
  if (dot(in.e1, in.e1) > 0.0) {
    let w1 = in.e1 + in.f1 * s;
    let w2 = in.e2 + in.f2 * s;
    let area = abs(dot(cross(w1, w2), d));
    bunch = min(U.areaRef / max(area, 1e-12), U.bunchMax);
  }
  let L = in.color * in.scale * kernel * pow(bunch, U.bunchPow) * phaseHG(cosT, U.phaseG) * T / max(sinT, U.minSin) * pulseWindow(opl);
  return vec4f(L, 1.0);
}
