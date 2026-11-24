// what lives in the tunnel: rapana shells on the sand, grey mullet over it, and their shadows. The wall is "down"
// all the way round, so each is placed by an angle round the tunnel and a distance along it.

@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var auxTex: texture_2d<f32>;
@group(0) @binding(3) var causticTex: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;

struct VIn {
  @location(0) pos: vec3f,
  @location(1) nrm: vec3f,
  @location(2) uvk: vec3f,
  @location(3) a: vec4f,
  @location(4) b: vec4f,
};
struct LifeOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) n: vec3f,
  // where on the wall's map the light that reaches this point would have landed
  @location(2) uv: vec2f,
  @location(3) uvk: vec3f,
  @location(4) model: vec3f,
  @location(5) mn: vec3f,
  @location(6) @interpolate(flat) own: f32,
  // how far short of the sand it is, as a part of the way down from the sheet of light: the light has gathered
  // that much less there (nothing, for what lies on the sand or keeps close over it)
  @location(7) high: f32,
};

/** light as the wall has it: the caustic map and the baked shadows read where this point's light was going */
/** the caustic and the baked shadow where a point's light was going (read before any branch) */
fn lightAt(uv: vec2f) -> vec2f { return vec2f(textureSample(causticTex, smp, uv).x, textureSample(auxTex, smp, uv).x); }

/** `mirror` is how much of a thing is silver: that much of it shows `seen`, what lies round it, in place of its own colour */
fn lightOn(world: vec3f, n: vec3f, uv: vec2f, albedo: vec3f, gloss: f32, lightHere: vec2f) -> vec3f { return lightWith(world, n, uv, albedo, gloss, lightHere, 0.0, vec3f(0.0)); }

/** (`scale` tips the normal a little, each scale of a fish its own way: where one catches the sun it sparkles) */
fn lightWith(world: vec3f, n: vec3f, uv: vec2f, albedo: vec3f, gloss: f32, lightHere: vec2f, mirror: f32, scale: vec3f) -> vec3f {
  let z = uv.y * U.tile.x;
  let a = uv.x * TAU;
  let ax = ringAxes(z);
  let er = ax[0] * cos(a) + ax[1] * sin(a);
  let lean = U.light.y;
  let toLight = -normalize(er + lean * ax[2]);
  let traced = 1.0 - smoothstep(U.misc2.y - 2.0, U.misc2.y - 0.4, z - U.cam.z);
  let web = max(1.0 + (lightHere.x - 1.0) * U.lookA.y * traced, 0.0);
  let shade = mix(1.0 - U.up.w, 1.0, lightHere.y);
  let sun = U.lookA.w * mix(vec3f(1.0), vec3f(1.12, 0.96, 0.7), U.right.w);
  let direct = max(mix(dot(n, toLight) * sqrt(1.0 + lean * lean), 1.0, 0.25), 0.0);
  let around = U.lookA.z * mix(U.lookB.rgb * 1.6, vec3f(1.0), 0.45) * (0.65 + 0.35 * dot(n, -er));
  let view = normalize(U.cam.xyz - world);
  let flash = pow(max(dot(reflect(-toLight, n), view), 0.0), 30.0);
  // (and a little of the water itself, seen in anything smooth at a glancing angle)
  let sheen = gloss * 0.35 * pow(1.0 - abs(dot(n, view)), 3.0) * U.lookB.rgb;
  var c = albedo * (sun * web * direct * shade + around) + gloss * flash * sun * web * shade + sheen;
  if (mirror > 0.0) {
    // what a silver side shows: lit sand, all round and flickering with the caustics here; the water's haze up and
    // down the tunnel; brighter toward the middle, where the light comes from
    let r = reflect(-view, n);
    let sand = U.lookC.rgb * (sun * min(web, 2.5) * shade + around);
    var seen = mix(sand, mix(U.lookB.rgb, vec3f(1.0), 0.45) * 1.2, 0.55 * smoothstep(0.5, 0.95, abs(dot(r, ax[2]))));
    seen *= 0.85 + 0.8 * max(dot(r, -er), 0.0);
    c = mix(c, albedo * seen * 1.15, mirror);
    // and the light itself in the silver. It comes from the whole middle of the tunnel, a line of light, so a
    // rounded side shows it as a bright streak down its length that slides round as the fish rolls and turns; with
    // a hard core, and single scales sparkling beside it; all of it flaring as a caustic passes over
    let sunny = sun * min(web, 4.0) * shade * mirror;
    let rnd = -ax[0] * sin(a) + ax[1] * cos(a);
    let toward = vec2f(dot(r, -er), dot(r, rnd));
    let rl = max(toward.x, 0.0) / max(length(toward), 1e-4) * smoothstep(0.1, 0.45, length(toward));
    let r2 = reflect(-view, normalize(n + scale));
    let t2 = vec2f(dot(r2, -er), dot(r2, rnd));
    let rs = max(t2.x, 0.0) / max(length(t2), 1e-4) * smoothstep(0.1, 0.45, length(t2));
    c += sunny * (0.5 * pow(rl, 6.0) + 3.5 * pow(rl, 60.0) + 9.0 * pow(rs, 300.0) * step(1e-4, dot(scale, scale)));
  }
  return hazed(c, length(world - U.cam.xyz));
}

// ---------------------------------------------------------------- rapana

@group(0) @binding(6) var shellTex: texture_2d<f32>;

/** a scanned shell, laid mouth to the sand as a living one goes, headed its own way */
@vertex
fn vsShell(in: VIn) -> LifeOut {
  let at = vec2f(in.a.x / TAU, in.a.y / U.tile.x);
  let ground = textureSampleLevel(heightTex, smp, at, 2.0).r;
  let c = cos(in.a.w);
  let s = sin(in.a.w);
  let p = vec3f(in.pos.x * c - in.pos.z * s, in.pos.y, in.pos.x * s + in.pos.z * c) * in.a.z;
  let n = vec3f(in.nrm.x * c - in.nrm.z * s, in.nrm.y, in.nrm.x * s + in.nrm.z * c);
  let sp = spot(in.a.x, in.a.y, ground + p.y);
  var o: LifeOut;
  o.world = sp.p + sp.along * p.x + sp.round * p.z;
  o.n = sp.along * n.x + sp.up * n.y + sp.round * n.z;
  o.uv = at + vec2f(p.z / (TAU * (U.tile.y - ground)), (p.x + U.light.y * p.y) / U.tile.x);
  o.uvk = in.uvk;
  o.model = in.pos;
  o.mn = in.nrm;
  o.own = in.b.y;
  o.pos = toClip(o.world);
  // none on a rock
  if (textureSampleLevel(heightTex, smp, at, 3.0).a > 0.1) { o.pos = vec4f(0.0, 0.0, 2.0, 1.0); }
  return o;
}

@fragment
fn fsShell(in: LifeOut) -> @location(0) vec4f {
  let here = lightAt(in.uv);
  var albedo = textureSample(shellTex, smp, in.uvk.xy).rgb;
  let n = normalize(in.n);
  // silt settled on what faces up
  let ax = ringAxes(in.uv.y * U.tile.x);
  let up = -(ax[0] * cos(in.uv.x * TAU) + ax[1] * sin(in.uv.x * TAU));
  albedo = mix(albedo, U.lookC.rgb * 0.7, 0.22 * pow(max(dot(n, up), 0.0), 2.0));
  return vec4f(lightOn(in.world, n, in.uv, albedo, 0.2, here), 1.0);
}

// ---------------------------------------------------------------- grey mullet

struct FIn {
  @location(0) pos: vec3f,
  @location(1) nrm: vec3f,
  @location(2) uvk: vec3f,
  @location(3) a: vec4f,
  @location(4) b: vec4f,
  @location(5) c: vec4f,
};

@vertex
fn vsFish(in: FIn) -> LifeOut {
  let at = vec2f(in.a.x / TAU, in.a.y / U.tile.x);
  let c = cos(in.a.z);
  let s = sin(in.a.z);
  // how high it swims and how its nose points come worked out along its path (life.ts), so it rises before a
  // stone and comes down after it in one easy line
  let lift = in.b.x;
  let pitch = in.c.x;
  var p = in.pos;
  var n = in.nrm;
  // the swim: a wave down the body that grows toward the tail, and the bend of a turn
  let tail = 0.5 - p.x;
  let amp = 0.01 + 0.075 * tail * tail;
  let ph = 6.5 * tail - in.b.y;
  p.z += amp * sin(ph) + 0.13 * in.b.z * tail * tail;
  let sl = -(0.15 * tail * sin(ph) + amp * 6.5 * cos(ph) + 0.26 * in.b.z * tail);
  n = normalize(vec3f(n.x - n.z * sl, n.y, n.z + n.x * sl));
  // it rolls a little as it goes and banks into its turns, so a flank comes round to the light and flashes
  let roll = 0.6 * in.b.z + 0.38 * sin(in.c.y);
  let cr = cos(roll);
  let sr = sin(roll);
  p = vec3f(p.x, p.y * cr - p.z * sr, p.y * sr + p.z * cr);
  n = vec3f(n.x, n.y * cr - n.z * sr, n.y * sr + n.z * cr);
  let cp = cos(pitch);
  let spn = sin(pitch);
  p = vec3f(p.x * cp - p.y * spn, p.x * spn + p.y * cp, p.z);
  n = vec3f(n.x * cp - n.y * spn, n.x * spn + n.y * cp, n.z);
  p *= in.a.w;
  let sp = spot(in.a.x, in.a.y, lift + p.y);
  let fwd = sp.along * c + sp.round * s;
  let side = -sp.along * s + sp.round * c;
  var o: LifeOut;
  o.world = sp.p + fwd * p.x + side * p.z;
  o.n = fwd * n.x + sp.up * n.y + side * n.z;
  o.uv = at + vec2f((p.x * s + p.z * c) / (TAU * (U.tile.y - lift)), (p.x * c - p.z * s + U.light.y * (lift + p.y)) / U.tile.x);
  o.uvk = in.uvk;
  o.model = in.pos;
  o.mn = in.nrm;
  o.own = in.b.w;
  o.pos = toClip(o.world);
  return o;
}

@fragment
fn fsFish(in: LifeOut) -> @location(0) vec4f {
  var n = normalize(in.n);
  let here = lightAt(in.uv);
  let view = normalize(U.cam.xyz - in.world);
  let dist = length(U.cam.xyz - in.world);
  if (in.uvk.z > 0.5) {
    // fins: thin, pale grey-blue, rayed, lit from either side
    if (dot(n, view) < 0.0) { n = -n; }
    let ray = 0.8 + 0.2 * sin(in.model.y * 420.0 + in.model.x * 160.0);
    return vec4f(lightWith(in.world, n, in.uv, vec3f(0.5, 0.56, 0.62) * ray, 0.3, here, 0.25, vec3f(0.0)), 1.0);
  }
  // silver: bright mirror flanks and belly, a grey-green back that is still half mirror
  let lat = normalize(in.mn).y;
  let back = smoothstep(0.15, 0.8, lat);
  var albedo = mix(vec3f(0.95, 0.96, 0.97), vec3f(0.3, 0.35, 0.34), back);
  // scales: a net of dark edges in diamonds, each scale catching the light a little differently; rows of them read
  // as faint lines along the body. Left out far off, where they would only shimmer.
  let fine = (1.0 - smoothstep(1.5, 4.0, dist)) * smoothstep(0.1, 0.2, in.uvk.x) * (1.0 - smoothstep(0.93, 1.0, in.uvk.x));
  let sc = vec2f(in.uvk.x * 62.0, in.uvk.y * 40.0);
  let d1 = sc.x + sc.y;
  let d2 = sc.x - sc.y;
  let e1 = abs(fract(d1) - 0.5);
  let e2 = abs(fract(d2) - 0.5);
  let edge = 1.0 - smoothstep(0.3, 0.5, max(e1, e2));
  let each = h01(hash2(i32(floor(d1)), i32(floor(d2)), 91u));
  albedo *= mix(1.0, (0.84 + 0.16 * edge) * (0.84 + 0.32 * each), fine);
  let rows = (0.5 + 0.5 * cos(in.uvk.y * TAU * 15.0)) * smoothstep(-0.3, 0.0, lat) * (1.0 - smoothstep(0.5, 0.8, lat));
  albedo *= 1.0 - 0.14 * rows * smoothstep(0.15, 0.3, in.uvk.x);
  // an eye each side, well round on the side: a dark pupil in a yellow ring
  let eye = length(in.model.xy - vec2f(0.412, 0.008));
  let onSide = smoothstep(0.6, 0.8, abs(normalize(in.mn).z));
  let ring = onSide * (1.0 - smoothstep(0.012, 0.015, eye));
  let pupil = onSide * (1.0 - smoothstep(0.006, 0.008, eye));
  albedo = mix(albedo, vec3f(0.85, 0.7, 0.2), ring);
  albedo = mix(albedo, vec3f(0.01), pupil);
  let mirror = mix(0.92, 0.5, back) * (1.0 - ring);
  let tip = fine * 0.3 * (vec3f(each, h01(hash2(i32(floor(d1)), i32(floor(d2)), 17u)), h01(hash2(i32(floor(d1)), i32(floor(d2)), 53u))) - 0.5);
  return vec4f(lightWith(in.world, n, in.uv, albedo, 0.9, here, mirror, tip), 1.0);
}

// ---------------------------------------------------------------- hamsa

/** a hamsa, as the mullet is placed, but out in the open water: its tail beats quicker and wider for its size, it
 * banks hard into its turns, and the light on it is as far gathered as the water is where it swims */
@vertex
fn vsSmall(in: FIn) -> LifeOut {
  let at = vec2f(in.a.x / TAU, in.a.y / U.tile.x);
  let c = cos(in.a.z);
  let s = sin(in.a.z);
  let lift = in.b.x;
  var p = in.pos;
  var n = in.nrm;
  let tail = 0.5 - p.x;
  let amp = 0.012 + 0.1 * tail * tail;
  let ph = 7.0 * tail - in.b.y;
  p.z += amp * sin(ph) + 0.22 * in.b.z * tail * tail;
  let sl = -(0.2 * tail * sin(ph) + amp * 7.0 * cos(ph) + 0.44 * in.b.z * tail);
  n = normalize(vec3f(n.x - n.z * sl, n.y, n.z + n.x * sl));
  // (hard over in a turn: its silver side comes right up to the light, and the school flashes where it swerves)
  let roll = 1.35 * in.b.z + 0.2 * sin(in.c.y);
  let cr = cos(roll);
  let sr = sin(roll);
  p = vec3f(p.x, p.y * cr - p.z * sr, p.y * sr + p.z * cr);
  n = vec3f(n.x, n.y * cr - n.z * sr, n.y * sr + n.z * cr);
  let cp = cos(in.c.x);
  let spn = sin(in.c.x);
  p = vec3f(p.x * cp - p.y * spn, p.x * spn + p.y * cp, p.z);
  n = vec3f(n.x * cp - n.y * spn, n.x * spn + n.y * cp, n.z);
  p *= in.a.w;
  let sp = spot(in.a.x, in.a.y, lift + p.y);
  let fwd = sp.along * c + sp.round * s;
  let side = -sp.along * s + sp.round * c;
  let ground = textureSampleLevel(heightTex, smp, at, 3.0).r;
  var o: LifeOut;
  o.world = sp.p + fwd * p.x + side * p.z;
  o.n = fwd * n.x + sp.up * n.y + side * n.z;
  o.uv = at + vec2f((p.x * s + p.z * c) / (TAU * max(U.tile.y - lift, 0.1)), (p.x * c - p.z * s + U.light.y * max(lift + p.y - ground, 0.0)) / U.tile.x);
  o.uvk = in.uvk;
  o.model = in.pos;
  o.mn = in.nrm;
  o.own = in.b.w;
  o.high = 1.0 - clamp((U.light.x - lift) / max(U.light.x - ground, 0.05), 0.0, 1.0);
  o.pos = toClip(o.world);
  return o;
}

@fragment
fn fsSmall(in: LifeOut) -> @location(0) vec4f {
  var n = normalize(in.n);
  var here = lightAt(in.uv);
  here.x = gathered(here.x, 1.0 - in.high);
  let view = normalize(U.cam.xyz - in.world);
  if (in.uvk.z > 0.5) {
    if (dot(n, view) < 0.0) { n = -n; }
    return vec4f(lightWith(in.world, n, in.uv, vec3f(0.55, 0.62, 0.66), 0.3, here, 0.2, vec3f(0.0)), 1.0);
  }
  // a blue-green back, a flank and belly of bright silver, the brightest of it in a band along the side
  let lat = normalize(in.mn).y;
  let back = smoothstep(0.25, 0.75, lat);
  var albedo = mix(vec3f(0.95, 0.97, 0.98), vec3f(0.1, 0.27, 0.32), back);
  albedo *= 1.0 + 0.12 * (1.0 - smoothstep(0.0, 0.3, abs(lat - 0.12)));
  // a big dark eye close behind the snout
  let eye = length(in.model.xy - vec2f(0.385, 0.012));
  let onSide = smoothstep(0.5, 0.75, abs(normalize(in.mn).z));
  let pupil = onSide * (1.0 - smoothstep(0.014, 0.02, eye));
  albedo = mix(albedo, vec3f(0.02), pupil);
  // (each a little its own shade)
  albedo *= 0.9 + 0.2 * fract(in.own * 17.3);
  let mirror = mix(0.93, 0.45, back) * (1.0 - pupil);
  return vec4f(lightWith(in.world, n, in.uv, albedo, 0.9, here, mirror, vec3f(0.0)), 1.0);
}

// ---------------------------------------------------------------- eelgrass

struct GOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) n: vec3f,
  @location(2) uv: vec2f,
  // how far up the leaf, how far across it
  @location(3) st: vec2f,
  // its own tint; how much of a pixel it really covers (far leaves are drawn a pixel wide and thinned instead)
  @location(4) @interpolate(flat) own: vec2f,
};

/**
 * A leaf of eelgrass (Zostera marina): a ribbon bent over in an arc toward the way the water runs, leaning out
 * from its plant a little, twisting along its length. The current gusts in waves that travel along the tunnel,
 * so a meadow bows and rises in bands; each leaf wavers on its own besides. Drawn as a strip of ten pairs.
 */
@vertex
fn vsGrass(@builtin(vertex_index) vi: u32, @location(3) a: vec4f, @location(4) b: vec4f) -> GOut {
  let s = f32(vi / 2u) / 9.0;
  let edge = f32(vi & 1u) * 2.0 - 1.0;
  // kept within a length of tunnel of the eye
  let rel = a.y - U.cam.z + 3.0;
  let z = U.cam.z - 3.0 + rel - U.tile.x * floor(rel / U.tile.x);
  let at = vec2f(a.x / TAU, z / U.tile.x);
  let ground = textureSampleLevel(heightTex, smp, at, 2.0).r;
  let sp = spot(a.x, z, ground - 0.006);
  let flow = sp.along * cos(a.w) + sp.round * sin(a.w);
  let athwart = -sp.along * sin(a.w) + sp.round * cos(a.w);
  let t = U.cam.w;
  let gust = 1.0 + U.grass.x * (0.38 * sin(beat(0.9) * t - 1.4 * z - 2.0 * a.x + 0.5 * b.y) + 0.16 * sin(beat(2.1) * t - 3.1 * z + 2.0 * b.y));
  let bend = max(b.z * U.grass.y * gust, 0.05);
  let ang = bend * s;
  let fwd = a.z * (1.0 - cos(ang)) / bend;
  let rise = a.z * sin(ang) / bend;
  // each leaf leans out from its plant its own way
  let turn = fract(b.y * 7.31) * TAU;
  let lean = 0.04 + 0.22 * fract(b.y * 3.73);
  let outward = flow * cos(turn) + athwart * sin(turn);
  let waver = U.grass.x * 0.05 * a.z * s * s * sin(beat(1.7) * t - 5.0 * s + 9.0 * b.y);
  var p = sp.p + sp.up * (rise * cos(lean)) + flow * fwd + outward * (rise * sin(lean)) + athwart * waver;
  let tangent = normalize(sp.up * (cos(ang) * cos(lean)) + flow * sin(ang) + outward * (cos(ang) * sin(lean)));
  // the ribbon lies across the bend, and twists
  let twist = 3.0 * b.y + 1.6 * s + 0.35 * sin(beat(0.8) * t + 5.0 * b.y);
  let across = normalize(athwart - tangent * dot(athwart, tangent));
  let face = cross(tangent, across);
  let wide = across * cos(twist) + face * sin(twist);
  var width = b.x * (1.0 - 0.85 * s * s * s) * smoothstep(0.0, 0.08, s + 0.03);
  let dist = length(p - U.cam.xyz);
  // never thinner than a pixel and a bit: thinned in coverage instead, or far meadows would crawl
  let grow = max(1.0, 1.4 * dist / max(b.x * U.grass.z, 1e-4));
  p += wide * (edge * 0.5 * width * grow);
  var o: GOut;
  o.world = p;
  o.n = cross(tangent, wide);
  o.uv = at + vec2f((fwd * sin(a.w)) / (TAU * U.tile.y), (fwd * cos(a.w) + U.light.y * rise) / U.tile.x);
  o.st = vec2f(s, edge);
  o.own = vec2f(b.w, 1.0 / grow);
  o.pos = toClip(p);
  // none on a rock
  if (textureSampleLevel(heightTex, smp, at, 3.0).a > 0.1) { o.pos = vec4f(0.0, 0.0, 2.0, 1.0); }
  return o;
}

@fragment
fn fsGrass(in: GOut) -> @location(0) vec4f {
  let here = lightAt(in.uv);
  var n = normalize(in.n);
  let view = normalize(U.cam.xyz - in.world);
  if (dot(n, view) < 0.0) { n = -n; }
  let s = in.st.x;
  // dark at the foot, where the plant shades itself; green up the leaf; a yellower tip; some leaves old and brown
  var leaf = mix(vec3f(0.05, 0.1, 0.015), vec3f(0.24, 0.36, 0.045), smoothstep(0.0, 0.5, s));
  leaf = mix(leaf, vec3f(0.55, 0.52, 0.1), smoothstep(0.5, 1.0, s) * 0.6);
  leaf = mix(leaf, vec3f(0.3, 0.24, 0.08), smoothstep(0.82, 1.0, in.own.x) * 0.7);
  leaf *= (0.8 + 0.4 * fract(in.own.x * 13.7)) * (0.88 + 0.12 * abs(in.st.y));
  // light comes through a leaf as well as onto it
  let c = lightOn(in.world, n, in.uv, leaf * (1.1 + 0.35 * min(here.x, 3.0) * smoothstep(0.2, 0.8, s)), 0.25, here);
  return vec4f(c, in.own.y);
}

// ---------------------------------------------------------------- their shadows, onto a map of the wall

struct BOut {
  @builtin(position) pos: vec4f,
  @location(0) q: vec2f,
  @location(1) @interpolate(flat) dark: f32,
};

@vertex
fn vsBlob(@builtin(vertex_index) vi: u32, @location(3) a: vec4f, @location(4) b: vec4f) -> BOut {
  let k = vi % 6u;
  let q = vec2f(f32(k == 1u || k == 2u || k == 4u), f32(k == 2u || k == 4u || k == 5u)) * 2.0 - 1.0;
  let centre = fract(vec2f(a.x / TAU, a.y / U.tile.x));
  // the map wraps both ways: each shadow is drawn again past the nearer edge, round and along
  let copy = vi / 6u;
  let wrapped = vec2f(f32(copy & 1u) * select(-1.0, 1.0, centre.x < 0.5), f32(copy >> 1u) * select(-1.0, 1.0, centre.y < 0.5));
  let c = cos(a.z);
  let s = sin(a.z);
  let off = vec2f(q.x * a.w * s + q.y * b.x * c, q.x * a.w * c - q.y * b.x * s);
  let uv = centre + wrapped + off / vec2f(TAU * U.tile.y, U.tile.x);
  var o: BOut;
  o.pos = vec4f(uv.x * 2.0 - 1.0, 1.0 - 2.0 * uv.y, 0.0, 1.0);
  o.q = q;
  o.dark = b.y;
  // a shell that is not there (it fell on a rock) casts none
  if (b.w > 0.5 && textureSampleLevel(heightTex, smp, centre, 3.0).a > 0.1) { o.pos = vec4f(0.0, 0.0, 2.0, 1.0); }
  return o;
}

@fragment
fn fsBlob(in: BOut) -> @location(0) vec4f {
  // dark through the middle, soft at the edge
  return vec4f(in.dark * smoothstep(0.0, 0.6, 1.0 - dot(in.q, in.q)));
}
