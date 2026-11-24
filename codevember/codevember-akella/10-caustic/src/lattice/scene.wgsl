// the lattice drawn: the dark water and the glow behind, the glass tubes added on top (glass that glows
// more than it hides needs no sorting), then glints and drifting specks. All into a 4x multisampled target.

struct Uni {
  vp: mat4x4f,
  cam: vec4f, // camera position, time
  fwd: vec4f, // forward, spin angle
  right: vec4f, // right, tan of half the fov
  up: vec4f, // up, aspect
  core: vec4f, // the glow's middle, its strength
  look: vec4f, // exposure, bloom, glow size, strand brightness
  fx: vec4f, // specks, glints, glint size in pixels, sway
  size: vec4f, // render width, height, far side's dimming, glint count
  depth: vec4f, // near, far, whether the form's own depth is there to dim what lies behind it, how far behind counts
  shape: vec4f, // how much the form's own surface shades the glass, how much the rods' middles hide what is behind
  dof: vec4f, // blur in pixels per unit of (distance - focus) / distance, the focus distance, the most blur in pixels
  wrap: vec4f, // the wrapping: the front's height, how deep its band is, how far out the new glass curls, how uneven the front is
  wrap2: vec4f, // on, the hot edge's glow, the unevenness's scale (patches per unit), how far it has got (0..1)
};

/** how out of focus something this far away is, in pixels */
fn coc(z: f32) -> f32 { return clamp(U.dof.x * (z - U.dof.y) / z, -U.dof.z, U.dof.z); }

/**
 * Depth of field by layers. Glass adds light, so the picture is a sum, and a sum can be blurred piece by piece:
 * every fragment shares its light between a sharp layer (full size, multisampled) and three blurred ones (half
 * size, blurred later by a quarter, a half and all of the most blur), by how out of focus it is. What lies behind
 * a sharp strand is then blurred all the way under it, with no outline.
 */
fn layers(z: f32) -> vec4f {
  let R = U.dof.z;
  if (R < 0.5) { return vec4f(1.0, 0.0, 0.0, 0.0); }
  let c = abs(coc(z));
  let s1 = R * 0.25;
  let s2 = R * 0.5;
  if (c <= s1) {
    let t = c / s1;
    return vec4f(1.0 - t, t, 0.0, 0.0);
  }
  if (c <= s2) {
    let t = (c - s1) / (s2 - s1);
    return vec4f(0.0, 1.0 - t, t, 0.0);
  }
  let t = clamp((c - s2) / (R - s2), 0.0, 1.0);
  return vec4f(0.0, 0.0, 1.0 - t, t);
}

struct Blurred {
  @location(0) a: vec4f,
  @location(1) b: vec4f,
  @location(2) c: vec4f,
};

@group(0) @binding(0) var<uniform> U: Uni;
@group(0) @binding(1) var<storage, read> glints: array<vec4f>;
/** the form's own front surface, drawn first and unseen */
@group(0) @binding(2) var front: texture_depth_2d;

const PI = 3.14159265;

fn hashu(x0: u32) -> u32 {
  var x = x0;
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}
fn h01(x: u32) -> f32 { return f32(hashu(x) >> 8u) / 16777216.0; }

fn spin(p: vec3f) -> vec3f {
  let a = U.fwd.w;
  return vec3f(p.x * cos(a) - p.z * sin(a), p.y, p.x * sin(a) + p.z * cos(a));
}

/** a [0, 1] depth back to distance */
fn linear(z: f32) -> f32 {
  let n = U.depth.x;
  let f = U.depth.y;
  return 2.0 * n * f / (f + n - (2.0 * z - 1.0) * (f - n));
}

@vertex
fn vsDepth(@location(0) p: vec3f) -> @builtin(position) vec4f { return toClip(spin(p)); }

/** smooth value noise in 3D, -1..1 */
fn vnoise(p: vec3f) -> f32 {
  let i = vec3i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  var v = array<f32, 8>();
  for (var c = 0; c < 8; c++) {
    let o = vec3i(c & 1, (c >> 1) & 1, (c >> 2) & 1);
    let q = bitcast<vec3u>(i + o);
    v[c] = h01((q.x * 0x8da6b343u) ^ hashu((q.y * 0xd8163841u) ^ hashu(q.z * 0xcb1ab31fu + 7u)));
  }
  let x0 = mix(mix(v[0], v[1], u.x), mix(v[2], v[3], u.x), u.y);
  let x1 = mix(mix(v[4], v[5], u.x), mix(v[6], v[7], u.x), u.y);
  return mix(x0, x1, u.z) * 2.0 - 1.0;
}

/**
 * The glass wraps itself onto the form from the bottom up. A front rises, uneven: a noise over the form's own
 * surface moves it up or down, so some patches wrap well ahead of others. Where it has just passed, the new glass
 * stands off the form, out along its normal and a little down, and as the front moves on it settles back onto its
 * place, so a strand crossing the front curls outwards. Returns the moved point and s: below 0 not yet there,
 * 0..1 settling, past 1 in place.
 */
fn wrapped(p: vec3f, bn: vec3f) -> vec4f {
  if (U.wrap2.x < 0.5 || U.wrap2.w >= 1.0) { return vec4f(p, 2.0); }
  if (U.wrap2.w <= 0.0) { return vec4f(p, -1.0); }
  // the noise sits on the form, not on the screen: two octaves, the finer one weaker
  let np = p * U.wrap2.z;
  let n = (vnoise(np) + 0.45 * vnoise(np * 2.3 + 11.7)) / 1.45;
  let front = U.wrap.x + U.wrap.w * n;
  let s = (front - p.y) / U.wrap.y;
  let e = clamp(s, 0.0, 1.0);
  let k = (1.0 - e * e * (3.0 - 2.0 * e)) * (1.0 - e * e * (3.0 - 2.0 * e));
  // out along the form, and a little down, so the new end hangs off like a frond before it lies down
  let q = p + (bn * U.wrap.z + vec3f(0.0, -0.35 * U.wrap.z, 0.0)) * k;
  return vec4f(q, s);
}

fn toClip(p: vec3f) -> vec4f {
  var c = U.vp * vec4f(p, 1.0);
  // three's projection maps depth to [-1, 1]; WebGPU keeps [0, 1]
  c.z = (c.z + c.w) * 0.5;
  return c;
}

// ---------------------------------------------------------------- the water behind

struct BOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vsBack(@builtin(vertex_index) i: u32) -> BOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: BOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

@fragment
fn fsBack(in: BOut) -> @location(0) vec4f {
  let ndc = vec2f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0);
  let rd = normalize(U.fwd.xyz + U.right.xyz * ndc.x * U.right.w * U.up.w + U.up.xyz * ndc.y * U.right.w);
  var c = mix(vec3f(0.0008, 0.0025, 0.007), vec3f(0.004, 0.011, 0.026), rd.y * 0.5 + 0.5);
  c += vec3f(0.004, 0.012, 0.026) * exp(-dot(in.uv - vec2f(0.5, 0.45), in.uv - vec2f(0.5, 0.45)) * 6.0);
  // the glow in the middle, all along the ray
  let ro = U.cam.xyz;
  let tc = dot(U.core.xyz - ro, rd);
  let d = length(ro + rd * tc - U.core.xyz);
  // kept inside the form, not a fog across the frame
  c += vec3f(0.15, 0.75, 1.0) * U.core.w * 0.35 * exp(-d * d / (U.look.z * U.look.z * 0.6));
  return vec4f(c, 1.0);
}

// ---------------------------------------------------------------- the glass

struct TOut {
  @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,
  @location(1) n: vec3f,
  @location(2) e: vec4f,
  @location(3) far: f32,
  @location(4) bn: vec3f,
  @location(5) rv: f32,
};

@vertex
fn vsTube(@location(0) p: vec3f, @location(1) n: vec3f, @location(2) e: vec4f, @location(3) bn: vec3f) -> TOut {
  var q = p;
  // threads sway, more towards their ends
  if (e.z > 0.0) {
    let ph = p.x * 7.0 + p.z * 5.0 + e.w * 30.0;
    q += vec3f(sin(U.cam.w * 0.6 + ph), 0.0, cos(U.cam.w * 0.5 + ph * 1.3)) * e.z * U.fx.w;
  }
  let wr = wrapped(q, normalize(bn));
  q = spin(wr.xyz);
  var o: TOut;
  o.rv = wr.w;
  o.pos = toClip(q);
  o.wp = q;
  o.n = spin(n);
  o.bn = spin(bn);
  o.e = e;
  let rad = normalize(vec3f(q.x, 0.0, q.z) + vec3f(1e-5, 0.0, 0.0));
  o.far = smoothstep(-0.2, 0.5, dot(rad, normalize(vec3f(U.fwd.x, 0.0, U.fwd.z))));
  return o;
}

/** the glass's light (and how much of what is behind its middle it hides); `scale` maps this pass's pixels to
 * the form's depth texture */
fn glass(in: TOut, scale: f32) -> vec4f {
  let n = normalize(in.n);
  let v = normalize(U.cam.xyz - in.wp);
  let ndv = abs(dot(n, v));
  // a glass rod: bright at its edges (Fresnel), clear and dark in the middle where it shows the water behind
  // bent, and streaked where the room's lights reflect in it
  let edge = pow(1.0 - ndv, 1.4);
  let r = reflect(-v, n);
  let top = smoothstep(0.45, 0.85, r.y);
  let strip = smoothstep(0.86, 0.97, dot(r, normalize(vec3f(-0.9, 0.25, 0.35))));
  let back = smoothstep(0.9, 0.985, dot(r, normalize(vec3f(0.6, 0.35, -0.7))));
  let env = 1.6 * top + 1.3 * strip + 0.9 * back;
  let spark = pow(max(dot(r, normalize(vec3f(-0.35, 0.85, 0.4))), 0.0), 260.0) * 8.0;
  let tc = U.core.xyz - in.wp;
  let dc = length(tc);
  let core = U.core.w * (0.5 + 0.5 * dot(n, tc / dc)) / (1.0 + dc * dc / (U.look.z * U.look.z * 2.0));
  // behind the form's front surface the glass is seen through it, dimmer; or, for the vessel, its far side
  var far = in.far;
  if (U.depth.z > 0.5) {
    let zf = textureLoad(front, vec2i(in.pos.xy * scale), 0);
    far = smoothstep(U.depth.w * 0.3, U.depth.w, linear(in.pos.z) - linear(zf));
  }
  // the form underneath: its turned-away parts and silhouette catch the light like the edge of a glass, the planes
  // facing up take a little of the key, so eye sockets, brows and cheeks read through the lattice
  let bn = normalize(in.bn);
  let fedge = pow(1.0 - abs(dot(bn, v)), 1.6);
  let key = max(dot(bn, normalize(vec3f(-0.3, 0.9, 0.4))), 0.0);
  let form = mix(1.0, 0.35 + 1.5 * fedge + 0.45 * key, U.shape.x);
  let dim = mix(1.0, U.size.z, far) * form;
  let white = vec3f(0.92, 0.96, 1.0);
  var c = white * (0.02 + 0.85 * edge + env * (0.12 + 0.88 * edge)) * dim + white * spark * dim;
  c += vec3f(0.2, 0.9, 1.0) * core * (0.25 + 0.75 * edge) * mix(1.0, 0.6, far);
  // how much of what is behind the middle of the rod it hides: glass darkens the glow it crosses
  let a = U.shape.y * (1.0 - edge) * mix(1.0, 0.25, far);
  // not there yet; then fading in with a hot edge where the front has just passed
  if (in.rv < 0.0) { discard; }
  let born = smoothstep(0.0, 0.12, in.rv);
  c = c * born + vec3f(0.5, 0.95, 1.0) * U.wrap2.y * exp(-in.rv * in.rv / 0.006) * (0.3 + edge);
  return vec4f(c * U.look.w, a * born);
}

@fragment
fn fsTube(in: TOut) -> @location(0) vec4f {
  let g = glass(in, 1.0);
  return g * layers(linear(in.pos.z)).x;
}

@fragment
fn fsTubeBlurred(in: TOut) -> Blurred {
  let g = glass(in, 2.0);
  let w = layers(linear(in.pos.z));
  var o: Blurred;
  o.a = vec4f(g.rgb * w.y, 0.0);
  o.b = vec4f(g.rgb * w.z, 0.0);
  o.c = vec4f(g.rgb * w.w, 0.0);
  return o;
}

// ---------------------------------------------------------------- glints and specks

struct SOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) k: f32,
};

fn corner(vi: u32) -> vec2f { return vec2f(f32(vi & 1u), f32(vi >> 1u)) * 2.0 - 1.0; }

@vertex
fn vsStar(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SOut {
  let g = glints[ii];
  let gr = normalize(vec3f(g.x, g.y * 0.3, g.z) + vec3f(1e-5, 0.0, 0.0));
  let wr = wrapped(g.xyz, gr);
  let p = spin(wr.xyz);
  let id = u32(g.w * 16777216.0);
  let tt = U.cam.w * (0.25 + 0.3 * h01(id)) + h01(id ^ 99u);
  let on = smoothstep(0.86, 1.0, h01(id + u32(floor(tt)) * 31u)) * sin(PI * fract(tt));
  let rad = normalize(vec3f(p.x, 0.0, p.z) + vec3f(1e-5, 0.0, 0.0));
  let facing = mix(1.0, 0.3, smoothstep(-0.2, 0.4, dot(rad, normalize(vec3f(U.fwd.x, 0.0, U.fwd.z)))));
  let I = on * facing * U.fx.y * smoothstep(0.3, 1.0, wr.w);
  var c = toClip(p);
  let px = select(0.0, U.fx.z * (0.5 + 0.5 * I), I > 0.01);
  let k = corner(vi);
  c = vec4f(c.xy + k * px / U.size.xy * 2.0 * c.w, c.z, c.w);
  var o: SOut;
  o.pos = c;
  o.uv = k;
  o.k = I;
  return o;
}

fn star(in: SOut) -> vec3f {
  let u = in.uv;
  let a = abs(u);
  let core = exp(-dot(u, u) * 40.0);
  let rays = exp(-a.y * 70.0) * pow(max(1.0 - a.x, 0.0), 3.0) + exp(-a.x * 70.0) * pow(max(1.0 - a.y, 0.0), 3.0);
  return vec3f(0.85, 0.95, 1.0) * (core * 3.0 + rays) * in.k * 4.0;
}

@fragment
fn fsStar(in: SOut) -> @location(0) vec4f { return vec4f(star(in) * layers(linear(in.pos.z)).x, 0.0); }

@fragment
fn fsStarBlurred(in: SOut) -> Blurred {
  let c = star(in);
  let w = layers(linear(in.pos.z));
  var o: Blurred;
  o.a = vec4f(c * w.y, 0.0);
  o.b = vec4f(c * w.z, 0.0);
  o.c = vec4f(c * w.w, 0.0);
  return o;
}

@vertex
fn vsSnow(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SOut {
  let box = vec3f(5.0, 3.4, 4.0);
  let h = vec3f(h01(ii * 3u + 1u), h01(ii * 3u + 2u), h01(ii * 3u + 3u));
  var p = (h - 0.5) * box;
  p.y += U.cam.w * (0.01 + 0.02 * h.x);
  p.x += 0.06 * sin(U.cam.w * 0.2 + h.z * 30.0);
  p.y = (fract(p.y / box.y + 0.5) - 0.5) * box.y;
  var c = toClip(p);
  let focus = length(U.cam.xyz);
  let s = U.size.y / 900.0;
  let size = (1.0 + 2.0 * h01(ii * 7u)) * s;
  let px = size + min(abs(c.w - focus) * 5.0, 14.0) * s;
  let k = corner(vi);
  var o: SOut;
  o.pos = vec4f(c.xy + k * select(px, 0.0, c.w < 0.05) / U.size.xy * 2.0 * c.w, c.z, c.w);
  o.uv = k;
  o.k = U.fx.x * (0.4 + 0.6 * h.y) * size * size / (px * px);
  return o;
}

@fragment
fn fsSnow(in: SOut) -> @location(0) vec4f {
  // the specks are already as blurred as their distance makes them
  let a = (1.0 - smoothstep(0.6, 1.0, length(in.uv))) * in.k;
  return vec4f(vec3f(0.6, 0.8, 1.0) * a, 0.0);
}
