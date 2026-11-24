// the picture: a ray per pixel from the camera, onto the deck or into the pool, through the moving
// surface to painted stones lit by the light texture, with cel-shaded things floating and sinking

@group(0) @binding(4) var caus: texture_2d<f32>;
@group(0) @binding(5) var glowT: texture_2d<f32>;
/** each object's box on screen (clip x, y min and max), its refracted look under water included */
@group(0) @binding(6) var<storage, read> bounds: array<vec4f>;

var<private> NDC: vec2f;

/** trace() for rays from the camera: only the objects whose screen box holds this pixel */
fn traceView(ro: vec3f, rd: vec3f, tmax: f32, petals: bool) -> Hit {
  var best: Hit;
  best.t = -1.0;
  var tb = tmax;
  for (var i = 0u; i < u32(U.nObj); i++) {
    let b = bounds[i];
    if (NDC.x < b.x || NDC.x > b.z || NDC.y < b.y || NDC.y > b.w) { continue; }
    if (!petals && u32(objs[i].b.w) == 3u) { continue; }
    let h = objHit(i, ro, rd);
    if (h.t > 0.0 && h.t < tb) {
      tb = h.t;
      best = h;
    }
  }
  return best;
}

/** the deck is only shaded by what is above it */
fn deckShadow(ro: vec3f, rd: vec3f) -> f32 {
  var lum = 1.0;
  for (var i = 0u; i < u32(U.nObj); i++) {
    let o = objs[i];
    if (o.a.y + o.a.w * max(o.c.x, max(o.c.y, o.c.z)) < U.RIM) { continue; }
    let h = objHit(i, ro, rd);
    if (h.t > 0.0) { lum *= select(0.0, 0.5, u32(o.b.w) == 3u); }
  }
  return lum;
}

struct VOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vs(@builtin(vertex_index) i: u32) -> VOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var o: VOut;
  o.pos = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  o.uv = vec2f(p.x, 1.0 - p.y);
  return o;
}

fn sky(d: vec3f) -> vec3f {
  let y = clamp(d.y, 0.0, 1.0);
  return mix(vec3f(0.95, 0.98, 1.0), vec3f(0.42, 0.7, 0.97), pow(y, 0.55));
}

// ---------------------------------------------------------------- painted stones

/** voronoi: (distance to the nearest edge, offset from the stone's seed, the stone's id) */
fn stones(p: vec2f) -> vec4f {
  let ip = floor(p);
  let fp = fract(p);
  var mg = vec2f(0.0);
  var mr = vec2f(0.0);
  var md = 8.0;
  var id = 0u;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let g = vec2f(f32(i), f32(j));
      let hc = hcell(vec2i(ip + g));
      let o = vec2f(h01(hc), h01(hc ^ 0x5bd1e995u)) * 0.8 + 0.1;
      let r = g + o - fp;
      let d = dot(r, r);
      if (d < md) {
        md = d;
        mr = r;
        mg = g;
        id = hc;
      }
    }
  }
  md = 8.0;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let g = mg + vec2f(f32(i), f32(j));
      let hc = hcell(vec2i(ip + g));
      let o = vec2f(h01(hc), h01(hc ^ 0x5bd1e995u)) * 0.8 + 0.1;
      let r = g + o - fp;
      if (dot(mr - r, mr - r) > 1e-5) { md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
    }
  }
  return vec4f(md, -mr, f32(id & 0xffffu));
}

fn palette(k: u32) -> vec3f {
  switch (k) {
    case 0u: { return vec3f(0.2, 0.55, 0.68); }
    case 1u: { return vec3f(0.15, 0.42, 0.63); }
    case 2u: { return vec3f(0.28, 0.64, 0.71); }
    case 3u: { return vec3f(0.11, 0.33, 0.56); }
    default: { return vec3f(0.24, 0.5, 0.7); }
  }
}

fn stoneColor(p: vec2f) -> vec3f {
  // a hand-drawn wobble to the outlines
  let q = p + 0.22 * vec2f(vnoise(p * 2.1), vnoise(p * 2.1 + 7.13)) + 0.05 * vec2f(vnoise(p * 7.0), vnoise(p * 7.0 + 3.7));
  let v = stones(q);
  let idh = hashu(u32(v.w));
  var c = palette(idh % 5u) * (0.92 + 0.16 * h01(idh ^ 77u));
  // painted light, two flat tones per stone: lit towards the upper left
  let lit = dot(v.yz, vec2f(-0.7071, -0.7071)) + 0.12 * (vnoise(q * 3.0 + 9.0) - 0.5);
  c *= select(0.84, 1.05, lit > -0.08);
  c *= mix(0.8, 1.0, smoothstep(0.03, 0.14, v.x));
  // darker spots
  let sp = vnoise(q * 8.0 + f32(idh & 255u));
  c *= select(1.0, 0.7, sp > 0.76);
  // the gaps
  let gap = 1.0 - smoothstep(0.018, 0.034, v.x);
  return mix(c, vec3f(0.05, 0.17, 0.32), gap);
}

// ---------------------------------------------------------------- light on the stones

fn causUV(xz: vec2f) -> vec2f { return (xz - vec2f(U.cMinX, U.cMinZ)) / vec2f(U.cSizeX, U.cSizeZ); }

fn litStone(alb: vec3f, c: vec3f, g: vec3f) -> vec3f {
  var col = alb * (U.amb + U.diffuse * min(c, vec3f(U.clampLit)));
  let lines = smoothstep(vec3f(U.lineLo), vec3f(U.lineHi), c);
  col = mix(col, vec3f(0.93, 1.0, 1.0), lines * U.lineMix);
  return col + g * vec3f(0.3, 0.85, 1.0) * U.glow;
}

fn floorLit(xz: vec2f) -> vec3f {
  let uv = causUV(xz);
  let c = textureSampleLevel(caus, smp, uv, 0.0).rgb;
  let g = textureSampleLevel(glowT, smp, uv, 0.0).rgb;
  return litStone(stoneColor(xz * U.stoneScale), c, g);
}

/** a wall under water: its light is what would have reached the floor's plane, carried on past it */
fn wallLit(q: vec3f, nW: vec3f) -> vec3f {
  let along = select(q.z + 11.3 * nW.x, q.x + 5.7 * nW.z, abs(nW.z) > 0.5);
  let alb = stoneColor(vec2f(along, q.y) * U.stoneScale * 1.3) * 0.9;
  let dm = sunIn();
  let facing = dot(nW, -dm);
  var c = vec3f(0.0);
  var g = vec3f(0.0);
  if (facing > 0.0) {
    let s = q + dm * (-q.y / dm.y);
    let f = s + dm * (-U.D / dm.y);
    let k = facing / -dm.y;
    let uv = causUV(f.xz);
    c = textureSampleLevel(caus, smp, uv, 0.0).rgb * k;
    g = textureSampleLevel(glowT, smp, uv, 0.0).rgb * k;
  }
  var col = litStone(alb, c, g);
  // a bright line where the water meets the wall
  let hw = water(clamp(q.xz, vec2f(-U.PX, -U.PZ), vec2f(U.PX, U.PZ))).x;
  col = mix(col, vec3f(0.9, 1.0, 1.0), 1.0 - smoothstep(0.004, 0.012, abs(q.y - hw)));
  return col;
}

// ---------------------------------------------------------------- the pool's box

/** leaving the box through its side walls: (t, inward normal) */
fn wallsT(ro: vec3f, rd: vec3f) -> vec4f {
  var tx = 1e9;
  var tz = 1e9;
  if (abs(rd.x) > 1e-6) { tx = (select(-U.PX, U.PX, rd.x > 0.0) - ro.x) / rd.x; }
  if (abs(rd.z) > 1e-6) { tz = (select(-U.PZ, U.PZ, rd.z > 0.0) - ro.z) / rd.z; }
  if (tx < tz) { return vec4f(tx, -sign(rd.x), 0.0, 0.0); }
  return vec4f(tz, 0.0, 0.0, -sign(rd.z));
}

fn fog(col: vec3f, len: f32) -> vec3f {
  let T = exp(-vec3f(0.55, 0.16, 0.1) * U.absorb * len);
  return col * T + vec3f(0.07, 0.36, 0.52) * (1.0 - T);
}

/** floor or wall seen from under the surface: (colour, distance) */
fn poolEnv(p: vec3f, d: vec3f) -> vec4f {
  let w = wallsT(p, d);
  if (d.y < -1e-4) {
    let tf = (-U.D - p.y) / d.y;
    if (tf < w.x) { return vec4f(floorLit((p + d * tf).xz), tf); }
  }
  let q = p + d * w.x;
  if (q.y > 0.0) { return vec4f(vec3f(0.3, 0.7, 0.85), w.x); }
  return vec4f(wallLit(q, w.yzw), w.x);
}

// ---------------------------------------------------------------- things

fn ballColor(k: u32) -> vec3f {
  switch (k) {
    case 0u: { return vec3f(0.96, 0.3, 0.34); }
    case 2u: { return vec3f(1.0, 0.8, 0.26); }
    case 3u: { return vec3f(0.24, 0.5, 0.95); }
    case 5u: { return vec3f(0.33, 0.8, 0.5); }
    default: { return vec3f(0.98, 0.97, 0.94); }
  }
}

fn glass(h: Hit, ro: vec3f, rd: vec3f, under: bool) -> vec3f {
  let o = objs[h.i];
  let P = ro + rd * h.t;
  let n = h.n;
  let n1 = select(1.0, IOR, under);
  let d1 = refract(rd, n, n1 / GLASS);
  var env = sky(rd);
  let h2 = objHit(h.i, P + d1 * 1e-4, d1);
  if (h2.t > 0.0) {
    let X = P + d1 * (1e-4 + h2.t);
    var d2 = refract(d1, -h2.n, GLASS / n1);
    if (dot(d2, d2) < 0.5) { d2 = reflect(d1, -h2.n); }
    if (under) {
      let e = poolEnv(X, d2);
      env = fog(e.rgb, e.w);
    } else {
      env = select(sky(d2), vec3f(0.86, 0.83, 0.76), d2.y < 0.0);
    }
  }
  // a cat's eye ribbon inside
  let lp = qrot(vec4f(-o.q.xyz, o.q.w), P - o.a.xyz) / o.a.w;
  let rib = abs(lp.y + 0.25 * sin(3.0 * lp.x + o.c.w * 6.28));
  env = mix(env, vec3f(0.15, 0.62, 0.8), 0.55 * (1.0 - smoothstep(0.1, 0.16, rib)) * step(length(lp.xz), 0.75));
  let F = 0.04 + 0.96 * pow(1.0 - abs(dot(rd, n)), 5.0);
  // each marble its own colour of glass
  let tints = array<vec3f, 4>(vec3f(0.55, 0.95, 0.9), vec3f(0.6, 0.78, 1.0), vec3f(1.0, 0.8, 0.55), vec3f(0.98, 0.68, 0.85));
  let tint = tints[u32(o.c.w * 4.0) % 4u];
  var col = env * tint * (1.0 - F) + F * sky(reflect(rd, n));
  let L = select(sunDir(), -sunIn(), under);
  col += vec3f(1.0) * smoothstep(0.94, 0.955, dot(reflect(rd, n), L));
  return col;
}

fn shadeObj(h: Hit, ro: vec3f, rd: vec3f, under: bool) -> vec3f {
  let o = objs[h.i];
  let kind = u32(o.b.w);
  let P = ro + rd * h.t;
  let n = h.n;
  let edge = abs(dot(n, rd));
  var col: vec3f;
  if (kind == 2u) {
    col = glass(h, ro, rd, under);
  } else {
    let L = select(sunDir(), -sunIn(), under);
    let ndl = dot(n, L);
    var base: vec3f;
    var gloss = 0.0;
    if (kind == 0u) {
      let ang = atan2(h.lp.x, h.lp.z);
      let seg = u32(floor((ang / (2.0 * PI) + 0.5) * 6.0)) % 6u;
      base = ballColor(seg);
      if (abs(h.lp.y) > 0.88) { base = vec3f(0.98, 0.97, 0.94); }
      gloss = 1.0;
    } else if (kind == 1u) {
      // river pebbles, each its own warm grey
      let s = h.lp.xz * 3.0 + o.c.w * 40.0;
      let tint = mix(vec3f(0.52, 0.47, 0.44), vec3f(0.42, 0.45, 0.47), fract(o.c.w * 7.3));
      base = tint * (0.86 + 0.28 * vnoise(s));
      base *= select(1.0, 0.72, vnoise(s * 4.0) > 0.76);
      // a pale band now and then
      base = mix(base, vec3f(0.85, 0.82, 0.76), step(0.5, fract(o.c.w * 3.1)) * (1.0 - smoothstep(0.06, 0.1, abs(h.lp.y - 0.2 + 0.3 * h.lp.x))));
    } else {
      let u = h.lp.xz;
      // sakura: deeper pink at the base, a pale tip, a darker crease down the middle, a thin rim
      base = mix(vec3f(0.95, 0.45, 0.62), vec3f(1.0, 0.8, 0.87), smoothstep(-1.0, 0.5, u.y));
      base = mix(base, vec3f(0.9, 0.42, 0.6), 0.6 * (1.0 - smoothstep(0.0, 0.05, abs(u.x))) * smoothstep(0.5, -0.7, u.y));
      let w = 0.62 * (0.32 + 0.68 * smoothstep(-1.0, 0.45, u.y));
      base = mix(vec3f(0.85, 0.38, 0.55), base, smoothstep(0.86, 0.78, length(vec2f(u.x / w, u.y))));
    }
    let tone = smoothstep(-0.02, 0.05, select(ndl, abs(ndl), kind == 3u));
    col = base * mix(vec3f(0.6, 0.68, 0.86), vec3f(1.0), tone);
    // a rim of sky light, and a flat painted highlight on the shiny ones
    col += vec3f(0.25, 0.3, 0.35) * smoothstep(0.7, 0.85, 1.0 - edge) * tone;
    col += gloss * vec3f(0.9) * smoothstep(0.955, 0.965, dot(reflect(rd, n), L));
    // under water the light comes in cooler and patchier
    if (under) { col *= vec3f(0.72, 0.92, 1.0) * (0.85 + 0.3 * smoothstep(0.55, 0.75, vnoise(P.xz * 9.0 + U.time * 0.6))); }
  }
  // ink outline
  if (kind != 3u) { col = mix(vec3f(0.08, 0.14, 0.26), col, smoothstep(0.14, 0.26, edge)); }
  // a white meniscus where it pierces the water
  if (!under && kind != 3u && abs(P.x) < U.PX && abs(P.z) < U.PZ) {
    let hw = water(P.xz).x;
    col = mix(col, vec3f(1.0), 1.0 - smoothstep(0.004, 0.01, abs(P.y - hw)));
  }
  return col;
}

fn underwater(p: vec3f, d: vec3f) -> vec3f {
  let env = poolEnv(p, d);
  let h = traceView(p + d * 1e-4, d, env.w, false);
  if (h.t > 0.0) { return fog(shadeObj(h, p + d * 1e-4, d, true), h.t); }
  return fog(env.rgb, env.w);
}

// ---------------------------------------------------------------- out of the water

fn deck(p: vec3f) -> vec3f {
  let ax = abs(p.x) - U.PX;
  let az = abs(p.z) - U.PZ;
  let out = max(ax, az);
  var col: vec3f;
  if (out < U.coping) {
    let along = select(p.z, p.x, az > ax);
    let tile = floor(along / 0.3);
    col = vec3f(0.97, 0.94, 0.87) * (0.96 + 0.05 * h01(u32(tile + 500.0)));
    let gl = min(fract(along / 0.3), 1.0 - fract(along / 0.3)) * 0.3;
    col *= mix(0.8, 1.0, smoothstep(0.003, 0.007, min(gl, U.coping - out)));
    // the rounded lip catches the light
    col = mix(col * 1.06, col, smoothstep(0.0, 0.02, out));
  } else if (out < U.coping + 1.2) {
    let t = floor(p.xz / 0.45);
    let f = abs(fract(p.xz / 0.45) - 0.5);
    col = vec3f(0.88, 0.84, 0.76) * (0.95 + 0.07 * h01(hcell(vec2i(t))));
    col *= mix(0.82, 1.0, smoothstep(0.484, 0.474, max(f.x, f.y)));
  } else {
    let n = vnoise(p.xz * 9.0) + 0.5 * vnoise(p.xz * 31.0);
    col = select(vec3f(0.45, 0.74, 0.38), vec3f(0.36, 0.63, 0.32), n > 0.85);
  }
  // shade from anything in the air
  let sh = deckShadow(p + vec3f(0.0, 1e-3, 0.0), sunDir());
  return col * mix(vec3f(0.66, 0.72, 0.86), vec3f(1.0, 0.99, 0.96), sh);
}

/** the inside of the coping above the water */
fn copingFace(q: vec3f, nW: vec3f) -> vec3f {
  let lit = max(dot(nW, sunDir()), 0.0);
  return vec3f(0.86, 0.85, 0.82) * mix(0.68, 1.0, step(0.05, lit));
}

/** first water crossing, refined against the moving surface */
fn waterT(ro: vec3f, rd: vec3f) -> f32 {
  var t = -ro.y / rd.y;
  for (var k = 0; k < 4; k++) {
    let p = ro + rd * t;
    t = (water(p.xz).x - ro.y) / rd.y;
  }
  return t;
}

fn render(ro: vec3f, rd: vec3f) -> vec3f {
  let oh = traceView(ro, rd, 1e5, true);
  if (rd.y >= -1e-4) {
    if (oh.t > 0.0) { return shadeObj(oh, ro, rd, false); }
    return sky(rd);
  }
  let tTop = (U.RIM - ro.y) / rd.y;
  let pTop = ro + rd * tTop;
  if (abs(pTop.x) > U.PX || abs(pTop.z) > U.PZ) {
    if (oh.t > 0.0 && oh.t < tTop) { return shadeObj(oh, ro, rd, false); }
    return deck(pTop);
  }
  let tw = waterT(ro, rd);
  let wl = wallsT(pTop, rd);
  let tWall = tTop + wl.x;
  if (oh.t > 0.0 && oh.t < min(tw, tWall)) { return shadeObj(oh, ro, rd, false); }
  if (tWall < tw) { return copingFace(ro + rd * tWall, wl.yzw); }

  let pw = ro + rd * tw;
  let w = water(pw.xz);
  let n = normalize(vec3f(-w.y, 1.0, -w.z));
  // the view is bent less than the light is: the floor stays legible, the lines stay sharp
  let nv = normalize(vec3f(-w.y * U.viewBend, 1.0, -w.z * U.viewBend));
  var col = underwater(pw, refract(rd, nv, 1.0 / IOR));
  let rf = reflect(rd, n);
  let F = 0.02 + 0.98 * pow(1.0 - max(dot(-rd, n), 0.0), 5.0);
  col = mix(col, sky(rf), F);
  // the sun's reflection, as flat white shapes
  col += vec3f(1.0) * smoothstep(U.spec0, U.spec1, dot(rf, sunDir())) * U.specW;
  return col;
}

@fragment
fn fs(in: VOut) -> @location(0) vec4f {
  let ndc = vec2f(in.uv.x * 2.0 - 1.0, 1.0 - in.uv.y * 2.0);
  let F = vec3f(U.fX, U.fY, U.fZ);
  let R = vec3f(U.rX, U.rY, U.rZ);
  let Up = vec3f(U.uX, U.uY, U.uZ);
  let rd = normalize(F + R * ndc.x * U.tanFov * U.aspect + Up * ndc.y * U.tanFov);
  NDC = ndc;
  var col = render(vec3f(U.camX, U.camY, U.camZ), rd);
  col *= 1.0 - 0.25 * pow(length(in.uv - 0.5) * 1.3, 2.5);
  let n = f32(hashu(u32(in.pos.x) * 1973u + u32(in.pos.y) * 9277u) >> 8u) / 16777216.0 - 0.5;
  return vec4f(pow(clamp(col, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2)) + n / 255.0, 1.0);
}
