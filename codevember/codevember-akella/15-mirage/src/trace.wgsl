// The picture: one ray a pixel, followed from thing to thing.
//
// A ray that meets a mirror goes on reflected. One that meets a door goes on from the world's start, turned the
// way the door is turned. One that meets hot flat ground at a shallow enough angle goes on as if the ground were
// water: the mirage. Whatever it ends on (sand, sky) is what the pixel shows, through the air it crossed. Since
// the picture is nothing but this, the view into a door from just before it is the view from just inside it,
// and flying through one is seamless without anything being done about it.

@group(0) @binding(5) var skyTex: texture_2d<f32>;
@group(0) @binding(6) var skyS: sampler; // round and round across, held at the edges up and down
@group(0) @binding(7) var airTex: texture_2d<f32>;
@group(0) @binding(15) var shedTex: texture_2d<f32>;
@group(0) @binding(16) var groveTex: texture_2d<f32>;
@group(0) @binding(17) var edgeS: sampler;
@group(0) @binding(18) var noiseTex: texture_2d<f32>;

const PI = 3.14159265359;

fn turn(v: vec3f, cs: vec2f) -> vec3f {
  return vec3f(v.x * cs.x + v.z * cs.y, v.y, -v.x * cs.y + v.z * cs.x);
}

fn sky(rd: vec3f) -> vec3f {
  let uv = vec2f(atan2(rd.x, rd.z) / (2.0 * PI) + 0.5, asin(clamp(rd.y, 0.0, 1.0)) / (0.5 * PI));
  return textureSampleLevel(skyTex, skyS, uv, 0.0).rgb;
}
// the colour of the air a long way off, that way
fn airOf(rd: vec3f) -> vec3f {
  return textureSampleLevel(airTex, skyS, vec2f(atan2(rd.x, rd.z) / (2.0 * PI) + 0.5, 0.012), 0.0).rgb;
}
// what the sky sheds on a face looking the way n
fn shedOn(n: vec3f) -> vec3f {
  return textureSampleLevel(shedTex, skyS, vec2f(atan2(n.x, n.z) / (2.0 * PI) + 0.5, asin(clamp(n.y, -1.0, 1.0)) / PI + 0.5), 0.0).rgb;
}
fn sunDisc(rd: vec3f) -> vec3f {
  let off = length(cross(rd, P.sun.xyz));
  let r = P.sky.y;
  return P.sunTone.rgb * P.sunTone.w * smoothstep(r + P.up.w, r - P.up.w, off) * step(0.0, dot(rd, P.sun.xyz));
}

// --- glass

// how far outside a glass's outline a point of its plane is (negative inside), metres
fn outline(g: Glass, p: vec3f) -> f32 {
  let a = dot(p - g.c.xyz, vec3f(g.n.z, 0.0, -g.n.x));
  let b = p.y - g.c.y;
  let hw = g.c.w;
  let h = g.n.w;
  if (g.rot.z > 0.5) {
    let spring = h - hw;
    let d = select(length(vec2f(a, b - spring)) - hw, abs(a) - hw, b < spring);
    return max(d, -b);
  }
  return max(abs(a) - hw, abs(b - 0.5 * h) - 0.5 * h);
}

// the share of the sun the ground leaves a point
fn groundShade(p: vec3f, to: vec3f) -> f32 {
  let r = reach(p, to, 0.05, 3000.0, P.sky.x, 0.0);
  if (r.t >= 0.0) {
    return 0.0;
  }
  return smoothstep(0.0, 2.0, r.near);
}
// and the share the glasses leave it. (`to` is the way to the sun. Whatever a glass shades lies behind it in a
// stripe along the sun's way, so how far a point is across that way, one number, tells for most glasses that
// they are no concern of it: P.shade holds each one's stripe.)
fn glassShade(p: vec3f, to: vec3f) -> f32 {
  var lit = 1.0;
  let count = i32(P.wave.z);
  let across = dot(p.xz, P.side.xy);
  for (var i = 0; i < count; i++) {
    let stripe = P.shade[i];
    if (across < stripe.x || across > stripe.y) {
      continue;
    }
    let g = P.glass[i];
    let dn = dot(to, g.n.xyz);
    if (abs(dn) < 1e-4) {
      continue;
    }
    let t = dot(g.c.xyz - p, g.n.xyz) / dn;
    if (t < 0.02) {
      continue;
    }
    let w = t * P.sky.x + 0.01;
    lit *= smoothstep(-w, w, outline(g, p + to * t));
  }
  return lit;
}
// The sun again, off every mirror and out of every door: a mirror throws a patch of it on the sand, and a door
// lets it through from where the door leads, where the sun is another way round.
fn glassLight(p: vec3f, n: vec3f) -> f32 {
  var sum = 0.0;
  let count = i32(P.wave.z);
  for (var i = 0; i < count; i++) {
    // (a stripe again, along the way this glass sends the sun)
    let stripe = P.shine[i];
    let across = dot(p.xz, stripe.xy);
    if (across < stripe.z || across > stripe.w) {
      continue;
    }
    let facing = dot(n, P.glass[i].sun.xyz);
    if (facing <= 0.0) {
      continue;
    }
    sum += facing * thrownBy(i, p);
  }
  return sum;
}
// how much of glass i's sun gets to a point, whichever way the point faces
fn thrownBy(i: i32, p: vec3f) -> f32 {
  let g = P.glass[i];
  let to = g.sun.xyz;
  let dn = dot(to, g.n.xyz);
  if (abs(dn) < 1e-4) {
    return 0.0;
  }
  let t = dot(g.c.xyz - p, g.n.xyz) / dn;
  if (t < 0.02 || t > 400.0) {
    return 0.0;
  }
  let x = p + to * t;
  let w = t * P.sky.x + 0.01;
  let d = outline(g, x) + P.air.z;
  let share = 1.0 - smoothstep(-w, w, d);
  if (share <= 0.0) {
    return 0.0;
  }
  var open = 0.0;
  if (g.to.w > 0.5 && dn >= 0.0) {
    // (a door, only out of its front)
    return 0.0;
  }
  if (P.lit2.z > 0.5) {
    open = glassSunAt(i, g, x);
  } else {
    open = glassSun(g, x, dn);
  }
  return share * open * select(P.air.w, 1.0, g.to.w > 0.5);
}

// How much of the sun gets to a place x on a glass: past the dunes to a mirror, or, out of a door, past the
// dunes of where it leads. Worked out here, or (`glassSunAt`) read from a small picture of each glass made once
// (`glassBake`), GLASS_U across and GLASS_V up it, side by side.
const GLASS_U = 32;
const GLASS_V = 128;
@group(0) @binding(27) var glassSunTex: texture_2d<f32>;

fn glassSun(g: Glass, x: vec3f, dn: f32) -> f32 {
  if (g.to.w > 0.5) {
    return groundShade(turn(x, g.rot.xy) + g.to.xyz + vec3f(0.0, 0.02, 0.0), P.sun.xyz);
  }
  return groundShade(x - sign(dn) * g.n.xyz * 0.02, P.sun.xyz);
}
fn glassSunAt(i: i32, g: Glass, x: vec3f) -> f32 {
  let a = dot(x - g.c.xyz, vec3f(g.n.z, 0.0, -g.n.x));
  let uv = clamp(vec2f(a / (2.0 * g.c.w) + 0.5, (x.y - g.c.y) / g.n.w), vec2f(0.5 / f32(GLASS_U), 0.5 / f32(GLASS_V)), vec2f(1.0 - 0.5 / f32(GLASS_U), 1.0 - 0.5 / f32(GLASS_V)));
  return textureSampleLevel(glassSunTex, edgeS, vec2f((f32(i) + uv.x) * f32(GLASS_U) / f32(textureDimensions(glassSunTex).x), uv.y), 0.0).x;
}

@fragment
fn glassBake(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let i = i32(at.x) / GLASS_U;
  let uv = vec2f((at.x - f32(i * GLASS_U)) / f32(GLASS_U), at.y / f32(GLASS_V));
  let g = P.glass[i];
  let x = g.c.xyz + vec3f(g.n.z, 0.0, -g.n.x) * (uv.x - 0.5) * 2.0 * g.c.w + vec3f(0.0, uv.y * g.n.w, 0.0);
  return vec4f(glassSun(g, x, dot(g.sun.xyz, g.n.xyz)), 0.0, 0.0, 0.0);
}

// --- boulders: balls cut by flat faces

// (They are kept eight to a group, neighbours together, each group in a ball of its own: a ray that misses the
// group's ball has missed all eight. And kept apart, middles in one list and faces in another: asking every
// boulder in turn, each a long record, cost a third of the frame.)
const FACES = 16;
struct Rocks {
  count: vec4f, // how many boulders, how many groups
  group: array<vec4f, 8>, // a ball round each group's boulders and the sand they darken
  c: array<vec4f, 64>, // a boulder's middle, and the radius of its ball
  how: array<vec4f, 64>, // how light, how far its edges are worn round (metres), how big
  face: array<vec4f, 1024>, // the way each face looks, and how far from the middle it is
};
@group(0) @binding(24) var<uniform> rocks: Rocks;

// For a ray from the eye there is a quicker way than asking every glass and boulder: the screen is cut into
// tiles, and for each the glasses and boulders that can show in it are worked out beforehand (index.ts), a bit
// each: glasses in .xy, boulders in .zw.
@group(0) @binding(25) var<uniform> tiles: array<vec4u, 160>;

// the first n bits
fn ones(n: i32) -> vec2u {
  let lo = select((1u << u32(clamp(n, 0, 31))) - 1u, 0xffffffffu, n >= 32);
  let hi = select((1u << u32(clamp(n - 32, 0, 31))) - 1u, 0xffffffffu, n >= 64);
  return vec2u(lo, hi);
}

// a ray and boulder i: is it nearer than what the ray has met so far (*tk, *ik), or its edge within a pixel
fn rockTry(i: i32, ro: vec3f, rd: vec3f, gone: f32, tk: ptr<function, f32>, ik: ptr<function, i32>, tedge: ptr<function, f32>) {
  let sp = rockSpan(i, ro, rd);
  if (sp.x < 1e-3 || sp.x > *tk) {
    return;
  }
  if (abs(sp.y - sp.x) < 2.0 * P.edge.x * (gone + sp.x) * P.up.w) {
    *tedge = min(*tedge, sp.x);
  }
  if (sp.x < sp.y) {
    *tk = sp.x;
    *ik = i;
  }
}

// does a ray pass through a group's ball, before `far`?
fn rockGroup(g: i32, ro: vec3f, rd: vec3f, far: f32) -> bool {
  let s = rocks.group[g];
  let oc = ro - s.xyz;
  let b = dot(oc, rd);
  let h = b * b - dot(oc, oc) + s.w * s.w;
  if (h <= 0.0) {
    return false;
  }
  let q = sqrt(h);
  return q - b > 0.0 && -b - q < far;
}

// the stretch of a ray that is inside a boulder: from .x to .y along it, and none if .x is the greater. (Close to
// its outline the stretch is short, in or out, which is how its edge is known.)
fn rockSpan(i: i32, ro: vec3f, rd: vec3f) -> vec2f {
  let c = rocks.c[i];
  let oc = ro - c.xyz;
  let b = dot(oc, rd);
  let h = b * b - dot(oc, oc) + c.w * c.w;
  if (h <= 0.0) {
    return vec2f(1e9, -1e9);
  }
  let q = sqrt(h);
  var tn = -b - q;
  var tf = -b + q;
  if (tf < 0.0) {
    return vec2f(1e9, -1e9);
  }
  for (var f = 0; f < FACES; f++) {
    let pl = rocks.face[i * FACES + f];
    let dn = dot(pl.xyz, rd);
    let s = pl.w - dot(pl.xyz, oc);
    if (dn > 1e-6) {
      tf = min(tf, s / dn);
    } else if (dn < -1e-6) {
      tn = max(tn, s / dn);
    } else if (s < 0.0) {
      return vec2f(1e9, -1e9);
    }
  }
  return vec2f(tn, tf);
}

// what the boulders leave a point: of the sun (to: the way to it), and of the sky, which one hides from the sand
// at its foot
fn rockShade(p: vec3f, to: vec3f) -> vec2f {
  var lit = 1.0;
  var open = 1.0;
  let count = i32(rocks.count.x);
  let across = dot(p.xz, P.side.xy);
  for (var i = 0; i < count; i++) {
    let c = rocks.c[i];
    // (only those in whose stripe along the sun's way the point lies)
    if (abs(dot(c.xz, P.side.xy) - across) > 1.6 * c.w + 0.7) {
      continue;
    }
    let oc = p - c.xyz;
    let rr = c.w * c.w;
    open *= 0.5 + 0.5 * smoothstep(0.45 * rr, 2.4 * rr, dot(oc, oc));
    let sp = rockSpan(i, p, to);
    let t = max(sp.x, 0.0);
    let w = 3.0 * (t * P.sky.x + 0.004);
    lit *= smoothstep(-w, w, t - sp.y);
  }
  return vec2f(lit, open);
}

// --- sand

// smooth noise 0..1, and how it changes across and along (a picture of it, see tops.wgsl; the texel middles are
// where the noise was worked out, hence the half texel)
fn noised(x: vec2f) -> vec3f {
  return textureSampleLevel(noiseTex, lin, (x * 8.0 + 0.5) / 1024.0, 0.0).xyz;
}

// Wind ripples: how they tilt the sand (across, along) and how high they stand (metres).
// `foot` is the pixel's size on the ground, across the view and along it, `view` the way the eye looks over the
// ground, and `slid` how far the ground slides under a pixel while one frame is taken: ripples finer than a
// pixel, or that slide most of their own length in a frame, are smoothed away instead of flickering.
//
// A ripple field is crests across the wind that wander, and every so often one ends or two join. Pushing the
// crests about by a noise does the wandering; pushing them by a finer, stronger one tears them, which is where
// the ends and joins come from.
fn ripples(xz: vec2f, foot: vec2f, view: vec2f, slid: vec2f) -> vec3f {
  let wind = normalize(P.wave.xy);
  var made = vec3f(0.0);
  for (var k = 0; k < 1; k++) {
    let len = P.ripple.x;
    let a = select(0.5, -0.08, k == 0);
    let d = vec2f(wind.x * cos(a) - wind.y * sin(a), wind.x * sin(a) + wind.y * cos(a));
    let along = vec2f(-d.y, d.x);
    // (stretched along the crests: they are long things)
    let q = vec2f(dot(xz, d), dot(xz, along) * 0.3);
    let w1 = noised(q / (len * 2.2) + f32(k) * 17.0);
    let w2 = noised(q / (len * 11.0) + 5.0 + f32(k) * 3.0);
    let w3 = noised(xz / (len * 60.0) + 2.0 + f32(k) * 7.0);
    let g1 = (d * w1.y + along * 0.3 * w1.z) / (len * 2.2);
    let g2 = (d * w2.y + along * 0.3 * w2.z) / (len * 11.0);
    let phase = q.x / len + 0.55 * w1.x + 1.6 * w2.x + 3.0 * w3.x;
    let dphase = d / len + 0.55 * g1 + 1.6 * g2 + 3.0 * w3.yz / (len * 60.0);
    let across = abs(dot(dphase, view)) * foot.y + abs(dot(dphase, vec2f(-view.y, view.x))) * foot.x;
    let s = dot(slid, dphase) * PI;
    let blur = select(sin(s) / s, 1.0, abs(s) < 1e-3) * (1.0 - smoothstep(0.7, 1.3, abs(s) / PI));
    let keep = smoothstep(0.55, 0.2, across) * blur;
    // taller here, lower there
    let tall = P.ripple.y * len / P.ripple.x * keep * (0.55 + 0.9 * w3.x);
    let turnA = 2.0 * PI * phase;
    // a ripple is not a sine: a long back, a short steep front
    made += tall * vec3f((cos(turnA) + 0.6 * cos(2.0 * turnA + 1.1) + 0.2 * cos(3.0 * turnA + 2.0)) * 2.0 * PI * dphase, sin(turnA) + 0.3 * sin(2.0 * turnA + 1.1) + 0.07 * sin(3.0 * turnA + 2.0));
  }
  return made;
}

struct Sand {
  col: vec3f,
  shine: f32, // the share of the ray that goes on, as off water
  up: vec3f, // off what
  thin: f32, // 1 where the ray would be out of the sand again within a pixel or two: a crest's edge
};

// The sun's light on the ground, as far as it does not hang on the way the eye looks: how much of the sun gets to
// a point past the dunes, the glasses and the boulders, and how much of the sky the boulders leave it. Neither
// changes, so both are worked out once, for the ground about the glasses (`lightBake`, texels a few centimetres
// across), and read back. (The sun the glasses throw is not baked here: on rippled sand it hangs on the way
// each ripple faces each glass, and kept for a place it would need the way of every glass that lights it. What
// is dear in it, whether the sun gets to the glass at all, is baked on the glass instead: see `glassSunAt`.)
@group(0) @binding(26) var litTex: texture_2d<f32>;

@fragment
fn lightBake(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let xz = P.lit.xy + at.xy * P.lit2.x;
  let p = vec3f(xz.x, ground(xz), xz.y);
  let sun = P.sun.xyz;
  let rocky = rockShade(p + vec3f(0.0, 0.03, 0.0), sun);
  return vec4f(groundShade(p + vec3f(0.0, 0.03, 0.0), sun) * glassShade(p, sun) * rocky.x, rocky.y, 0.0, 0.0);
}

// (`cheap`: the ray has been off a mirror or a door, and is not to be lit more finely than the picture can)
fn sandAt(p: vec3f, rd: vec3f, gone: f32, vel: vec3f, cheap: bool) -> Sand {
  let lay = layAt(p.xz);
  let f = fieldOf(lay.a, lay.b);
  let foot = gone * P.up.w;
  let lie = slopeAt(lay, p.xz, clamp(foot, 0.04, 3.0));
  let steep = length(lie);
  let nm = normalize(vec3f(-lie.x, 1.0, -lie.y));
  let graze = max(-dot(rd, nm), 0.0);

  // wet, where a pan holds water: an uneven shore
  let shore = 0.6 * noised(p.xz * 0.09).x + 0.3 * noised(p.xz * 0.37).x + 0.1 * noised(p.xz * 1.7).x;
  let wet = smoothstep(0.47, 0.53, f.pan + (shore - 0.5) * 0.45) * P.mirage.z;

  let view = normalize(rd.xz + vec2f(1e-5, 0.0));
  let rip = ripples(p.xz, vec2f(foot, foot / max(graze, 0.04)), view, vel.xz) * (1.0 - smoothstep(0.4, 0.58, steep)) * (1.0 - 0.9 * wet);
  let n = normalize(vec3f(-lie.x - rip.x, 1.0, -lie.y - rip.y));

  let sun = P.sun.xyz;
  let facing = dot(n, sun);
  var direct = 0.0;
  var open = 1.0;
  // the light as baked, where there is one and it is fine enough for this pixel; else worked out here
  let uvL = (p.xz - P.lit.xy) * P.lit.zw;
  if (P.lit2.z > 0.5 && all(uvL > vec2f(0.0)) && all(uvL < vec2f(1.0)) && (cheap || foot >= P.lit2.y * P.lit2.x)) {
    let b = textureSampleLevel(litTex, edgeS, uvL, 0.0);
    if (facing > 0.0 && dot(nm, sun) > -0.08) {
      direct = facing * b.x;
    }
    direct += glassLight(p, n);
    open = b.y;
  } else {
    let rocky = rockShade(p + vec3f(0.0, 0.03, 0.0), sun);
    if (facing > 0.0 && dot(nm, sun) > -0.08) {
      direct = facing * groundShade(p + vec3f(0.0, 0.03, 0.0), sun) * glassShade(p, sun) * rocky.x;
    }
    direct += glassLight(p, n);
    open = rocky.y;
  }
  // the troughs of ripples see less of the sky, and so does the sand at a boulder's foot
  let hollow = (1.0 - 0.35 * clamp(-rip.z / max(P.ripple.y, 1e-4), 0.0, 1.0)) * open;
  // the sand is not one colour: broad stains, and near the eye its grains
  let grains = (noised(p.xz * 37.0).x + noised(p.xz * 131.0).x - 1.0) * (1.0 - smoothstep(0.004, 0.03, foot / max(graze, 0.1)));
  let tone = P.sand.rgb * (0.9 + 0.2 * noised(p.xz * 0.045).x + 0.07 * grains) * mix(1.0, 0.5, wet);
  var col = tone * (P.sunTone.rgb * direct / PI + shedOn(n) * hollow * P.ripple.w);
  // grains glint back at a low sun
  let mid = normalize(sun - rd);
  col += P.sunTone.rgb * P.sand.w * pow(max(dot(n, mid), 0.0), 60.0) * step(0.0, facing) * direct / max(facing, 0.05) * 0.1;

  var s: Sand;
  s.col = col;
  // the mirage: flat hot ground, seen shallower than some angle, shows what is beyond it upside down
  let level = 1.0 - smoothstep(0.025, 0.09, steep);
  let hot = P.mirage.y * level * (1.0 - smoothstep(0.55 * P.mirage.x, P.mirage.x, graze));
  let water = wet * (0.02 + 0.98 * pow(1.0 - graze, 5.0));
  s.shine = max(hot, water);
  s.up = vec3f(0.0, 1.0, 0.0);
  if (s.shine > 0.004) {
    // and it trembles
    let beat = 2.0 * PI * P.size.w * P.wave.w;
    let wob = noised(p.xz * vec2f(0.05, 0.3) + 3.0 * vec2f(cos(beat), sin(beat))).yz + noised(p.xz * vec2f(0.21, 0.9) - 2.0 * vec2f(cos(beat), sin(beat))).yz;
    s.up = normalize(vec3f(0.0, 1.0, 0.0) + vec3f(wob.x, 0.0, wob.y) * P.mirage.w * mix(1.0, 0.15, wet) + (n - nm) * wet * 0.15);
  }
  // would the ray be out of the sand again, a couple of pixels in?
  let inside = min(2.0 * foot / max(graze, 0.03), 40.0 * foot + 0.3);
  let q = p + rd * inside;
  s.thin = step(ground(q.xz) + 0.25 * foot, q.y);
  return s;
}

// what a boulder looks like where a ray meets it
fn rockAt(i: i32, p: vec3f, rd: vec3f, gone: f32) -> vec3f {
  let c = rocks.c[i];
  let how = rocks.how[i];
  let q = p - c.xyz;
  // the face it is on, and near an edge some of the next one too: edges are worn round
  let far = length(q);
  var least = max(c.w - far, 0.0);
  var face = q / far;
  var n = face * exp(-least / how.y);
  for (var f = 0; f < FACES; f++) {
    let pl = rocks.face[i * FACES + f];
    let s = max(pl.w - dot(pl.xyz, q), 0.0);
    n += pl.xyz * exp(-s / how.y);
    if (s < least) {
      least = s;
      face = pl.xyz;
    }
  }
  n = normalize(n);
  // rough, at two sizes, as far as a pixel can show
  let foot = gone * P.up.w;
  let k = 2.2 / how.z;
  let keep = vec2f(1.0 - smoothstep(0.25, 0.8, foot * k), 1.0 - smoothstep(0.25, 0.8, foot * k * 5.0));
  let a = noised(q.xz * k + c.xz) * keep.x + 0.35 * noised(q.xz * k * 5.0 + 3.0) * keep.y;
  let b = noised(q.xy * k + c.zx + 7.0) * keep.x + 0.35 * noised(q.xy * k * 5.0 + 11.0) * keep.y;
  let d = noised(q.zy * k + c.xz + 13.0) * keep.x + 0.35 * noised(q.zy * k * 5.0 + 17.0) * keep.y;
  let bump = vec3f(a.y + b.y, b.z + d.z, a.z + d.y);
  n = normalize(n - P.rock.w * (bump - n * dot(bump, n)));

  let sun = P.sun.xyz;
  let facing = dot(n, sun);
  let lifted = p + face * 0.004;
  var direct = 0.0;
  if (facing > 0.0 && dot(face, sun) > -0.1) {
    direct = facing * groundShade(lifted, sun) * glassShade(lifted, sun) * rockShade(lifted, sun).x;
  }
  direct += glassLight(lifted, n);
  // sand lies banked against its foot, and on whatever of it looks up; low down it sees little of the sky
  let over = p.y - ground(p.xz);
  let sandy = max(0.85 * (1.0 - smoothstep(0.0, 0.2 * how.z + 0.02, over)), 0.6 * smoothstep(0.7, 0.97, n.y) * (0.5 + a.x));
  let stone = P.rock.rgb * how.x * (0.6 + 0.3 * (a.x + b.x + d.x));
  let tone = mix(stone, P.sand.rgb * 0.92, sandy);
  let open = mix(0.4, 1.0, smoothstep(0.0, 0.6 * how.z, over));
  return tone * (P.sunTone.rgb * direct / PI + shedOn(n) * open * P.ripple.w);
}

// --- the oasis: three screens of palms, one behind another, far off at the end of the lane

fn grove(ro: vec3f, rd: vec3f, tmax: f32, gone: f32, col: ptr<function, vec3f>, thr: ptr<function, vec3f>) {
  if (abs(rd.z) < 1e-5) {
    return;
  }
  for (var j = 0; j < 3; j++) {
    // the nearest first
    let k = select(2 - j, j, rd.z > 0.0);
    let z = P.oasis.y + (f32(k) - 1.0) * P.oasis2.w;
    let t = (z - ro.z) / rd.z;
    if (t <= 0.0 || t >= tmax) {
      continue;
    }
    let p = ro + rd * t;
    var uv = vec2f((p.x - P.oasis.x) / (2.0 * P.oasis.w) + 0.5, 1.0 - (p.y - P.oasis.z) / P.oasis2.x);
    if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) {
      continue;
    }
    let far = gone + t;
    let lod = log2(max(far * P.up.w / (2.0 * P.oasis.w / 4096.0), 1.0));
    let tex = textureSampleLevel(groveTex, edgeS, vec2f(uv.x, (f32(k) + uv.y) / 3.0), lod);
    // come near, and it is not there
    let a = tex.a * smoothstep(P.oasis2.y, P.oasis2.z, far);
    if (a <= 0.003) {
      continue;
    }
    let body = tex.rgb / max(tex.a, 1e-3);
    // lit from behind: leaves let some of the sun through, trunks none
    let leaf = clamp((body.g - body.r) * 4.0, 0.0, 1.0);
    let through = pow(max(dot(rd, P.sun.xyz), 0.0), 3.0) * leaf;
    let lit = body * (shedOn(vec3f(0.0, 0.3, -1.0)) * 1.3 + P.sunTone.rgb / PI * (0.12 + 0.9 * through));
    let clearT = exp(-P.air.x * t);
    *col += *thr * a * mix(airOf(rd), lit, clearT);
    *thr *= 1.0 - a;
  }
}

// --- a glass's rim

// which way is out of a glass's outline, in its plane, at p
fn outward(g: Glass, p: vec3f) -> vec3f {
  let along = vec3f(g.n.z, 0.0, -g.n.x);
  let e = 0.003;
  let dx = outline(g, p + along * e) - outline(g, p - along * e);
  let dy = outline(g, p + vec3f(0.0, e, 0.0)) - outline(g, p - vec3f(0.0, e, 0.0));
  return normalize(along * dx + vec3f(0.0, dy, 0.0) + vec3f(1e-7));
}

// Dark metal, flat where it meets the glass and rounded over to its outer edge, so that somewhere across it
// it faces the way that sends the sun to the eye: a thin glint along the edges, and the rest near black.
//
// The glint is far narrower than the rim, and the rim, far off, narrower than a pixel: taken at one place, it
// comes out in specks. So it is the mean over the part of the rim a pixel takes in (`px` across it, about
// `dg`, how far in from the outline the ray is; `band` how far in the rim goes, past its own width the side).
fn rimAt(i: i32, g: Glass, p: vec3f, rd: vec3f, nn: vec3f, dg: f32, band: f32, px: f32, out: vec3f) -> vec3f {
  let sun = P.sun.xyz;
  // how much of the sun gets there: on a mirror, as baked for the place on it; on a door, worked out
  var lit = 1.0;
  if (g.to.w > 0.5) {
    lit = groundShade(p + nn * 0.01, sun);
  } else if (P.lit2.z > 0.5) {
    lit = glassSunAt(i, g, p);
  } else {
    lit = glassSun(g, p, dot(g.sun.xyz, g.n.xyz));
  }
  let lo = max(dg - 0.5 * px, -band);
  let hi = min(dg + 0.5 * px, 0.0);
  let taps = select(1, 8, hi - lo > 0.01 * P.air.z);
  let h = normalize(sun - rd);
  let k = P.frame.w;
  var c = vec3f(0.0);
  for (var j = 0; j < taps; j++) {
    let x = select(clamp(dg, -band, 0.0), mix(lo, hi, (f32(j) + 0.5) / f32(taps)), taps > 1);
    let u = select(1.0, clamp((x + P.air.z) / max(P.air.z, 1e-4), 0.0, 1.0), x > -P.air.z);
    let a = 1.5707963 * P.frame2.z * smoothstep(0.15, 1.0, u);
    let n = normalize(nn * cos(a) + out * sin(a));
    let facing = max(dot(n, sun), 0.0);
    let fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, -rd), 1e-3), 5.0);
    let spec = pow(max(dot(n, h), 0.0), k) * (k + 8.0) / (8.0 * PI) * facing * fres;
    var back = reflect(rd, n);
    back.y = abs(back.y);
    c += P.frame.rgb * (shedOn(n) * P.ripple.w + P.sunTone.rgb * facing * lit / PI) + P.frame2.y * (P.sunTone.rgb * spec * lit + 0.2 * fres * sky(back));
  }
  return c / f32(taps);
}

// --- a ray

// What a ray can meet once it is off a glass, as bits like the tiles' (glasses .xy, boulders .zw), worked out in
// index.ts. All that a mirror shows is what an eye would see through it from where the eye's image in the mirror
// is, and all that a door shows, what the eye would see through it from where the door takes the eye: so for a
// ray from the eye, `seen[i]` is what is in that view of glass i. Off a glass again, or off the mirage, the eye
// is no help: `sides[2i]` is what is on the front of glass i (for a door, ahead of it where it leads), and
// `sides[2i + 1]` what is behind it.
struct Lists {
  seen: array<vec4u, 40>,
  sides: array<vec4u, 80>,
};
@group(0) @binding(28) var<uniform> lists: Lists;

// (`first`: the glasses and boulders the ray can meet before it has met anything; `tiled` says they are not
// simply all of them, and that the ray is from the eye)
fn trace(ro0: vec3f, rd0: vec3f, first: vec4u, tiled: bool) -> vec4f {
  var ro = ro0;
  var rd = rd0;
  var vel = P.vel.xyz;
  var thr = vec3f(1.0);
  var col = vec3f(0.0);
  var gone = 0.0;
  var flag = 0.0;
  var skip = -1;
  var done = false;
  var mirrored = false; // off a mirror yet (not through a door: what a door shows must be lit as if seen at first hand)
  let pix = P.up.w;
  let every = ones(i32(P.wave.z));
  // what this bounce can meet, and whether that is known (or is all there is)
  var can = first;
  var known = tiled;
  let bounces = i32(P.tune.z);
  for (var bounce = 0; bounce < bounces; bounce++) {
    // so little is left of the ray that what it would meet hardly shows: the air that way stands for it
    if (bounce > 0 && max(max(thr.r, thr.g), thr.b) < P.edge.w) {
      break;
    }
    var tg = 20000.0;
    var ig = -1;
    var dg = 0.0;
    var gdn = 1.0; // how square on the ray meets it
    var tedge = 1e9;
    // the nearest glass the ray passes just outside of, within half a pixel: its rim shows a little (see below)
    var tf = 1e9;
    var jf = -1;
    var df = 0.0;
    let some = select(every, can.xy, known);
    for (var word = 0; word < 2; word++) {
      var bits = some[word];
      while (bits != 0u) {
        let i = i32(countTrailingZeros(bits)) + 32 * word;
        bits &= bits - 1u;
        if (i == skip) {
          continue;
        }
        let g = P.glass[i];
        let dn = dot(rd, g.n.xyz);
        if (abs(dn) < 1e-5) {
          continue;
        }
        let t = dot(g.c.xyz - ro, g.n.xyz) / dn;
        if (t < 1e-3 || t > tg) {
          continue;
        }
        let d = outline(g, ro + rd * t);
        if (abs(d) < P.edge.x * (gone + t) * pix / max(abs(dn), 0.08)) {
          tedge = min(tedge, t);
        }
        if (d < 0.0) {
          tg = t;
          ig = i;
          dg = d;
          gdn = dn;
        } else if (P.frame2.x > 0.5 && t < tf && d < 0.6 * (gone + t) * pix / max(abs(dn), 0.05)) {
          tf = t;
          jf = i;
          df = d;
        }
      }
    }
    var tk = tg;
    var ik = -1;
    if (known) {
      for (var word = 2; word < 4; word++) {
        var bits = can[word];
        while (bits != 0u) {
          let i = i32(countTrailingZeros(bits)) + 32 * (word - 2);
          bits &= bits - 1u;
          rockTry(i, ro, rd, gone, &tk, &ik, &tedge);
        }
      }
    } else {
      for (var k = 0; k < i32(rocks.count.y); k++) {
        if (!rockGroup(k, ro, rd, tk)) {
          continue;
        }
        for (var i = k * 8; i < min(k * 8 + 8, i32(rocks.count.x)); i++) {
          rockTry(i, ro, rd, gone, &tk, &ik, &tedge);
        }
      }
    }
    let r = reach(ro, rd, 0.0, tk, pix, gone);
    var t = tk;
    var hit = 0; // nothing, ground, glass, a boulder
    if (r.t >= 0.0) {
      t = r.t;
      hit = 1;
    } else if (ik >= 0) {
      hit = 3;
    } else if (ig >= 0) {
      hit = 2;
    }
    // an edge within a pixel of the ray: this pixel wants more than one
    if (tedge <= t + 1e-3 || (hit != 1 && r.near < 1.25 * P.edge.x)) {
      flag = 1.0;
    }
    // A ray that passes just outside a glass, within half a pixel, takes as much of its rim as that half pixel
    // has, as the rays just inside do: so the rim's outer edge is as soft as its inner one, however thin it is.
    if (jf >= 0 && tf < t && jf != ig) {
      let gf = P.glass[jf];
      let pf = ro + rd * tf;
      let dnf = dot(rd, gf.n.xyz);
      let nnf = select(-gf.n.xyz, gf.n.xyz, dnf < 0.0);
      let bandf = P.air.z + P.frame2.w * sqrt(max(1.0 - dnf * dnf, 0.0)) / max(abs(dnf), 0.02);
      let outf = outward(gf, pf);
      let pxf = 1.2 * (gone + tf) * pix / max(length(outf - rd * dot(outf, rd)), 0.05);
      let coverf = clamp((min(df + 0.5 * pxf, 0.0) - max(df - 0.5 * pxf, -bandf)) / pxf, 0.0, 1.0);
      if (coverf > 0.0) {
        col += thr * coverf * mix(airOf(rd), rimAt(jf, gf, pf, rd, nnf, df, bandf, pxf, outf), exp(-P.air.x * tf));
        thr *= 1.0 - coverf;
      }
    }
    grove(ro, rd, t, gone, &col, &thr);
    if (hit == 0) {
      col += thr * (sky(rd) + sunDisc(rd));
      done = true;
      break;
    }
    let clearT = exp(-P.air.x * t);
    col += thr * (1.0 - clearT) * airOf(rd);
    thr *= clearT;
    gone += t;
    let p = ro + rd * t;
    if (hit == 1) {
      let s = sandAt(p, rd, gone, vel, mirrored);
      flag = max(flag, s.thin);
      col += thr * s.col * (1.0 - s.shine);
      if (s.shine < 0.004) {
        done = true;
        break;
      }
      thr *= s.shine;
      rd = reflect(rd, s.up);
      rd.y = abs(rd.y);
      vel = reflect(vel, s.up);
      ro = p + vec3f(0.0, 0.3, 0.0);
      skip = -1;
      known = false;
      continue;
    }
    if (hit == 3) {
      col += thr * rockAt(ik, p, rd, gone);
      done = true;
      break;
    }
    let g = P.glass[ig];
    let front = dot(rd, g.n.xyz) < 0.0;
    let nn = select(-g.n.xyz, g.n.xyz, front);
    // (what it can meet next: through a door it goes on ahead of where the door leads, off a mirror back on the
    // side it came from)
    // (a door's rim is steel, and sends a ray back, not through: no list fits it, and it is thin)
    can = select(lists.sides[2 * ig + select(1, 0, front)], lists.seen[ig], bounce == 0 && tiled && P.edge.z < 0.5);
    known = P.edge.z < 0.5 && !(dg > -P.air.z && g.to.w > 0.5 && P.frame2.x < 0.5);
    // (a glass has a thickness, and seen edge on its side shows: as a rim as wide as that side looks, in its
    // own plane)
    let side = P.frame2.w * sqrt(max(1.0 - gdn * gdn, 0.0)) / max(abs(gdn), 0.02);
    let band = P.air.z + side;
    // A rim is not left to the rays that happen to meet it, which for one narrower than a pixel are few: a ray
    // stands for a pixel's width across the rim (taken in the glass's plane, as far as the rim's way out is
    // across the ray), and `cover` is how much of that is rim; through the rest the glass beneath shows. So a
    // thin rim is a faint line a pixel wide, and a wide one has soft edges.
    if (P.frame2.x > 0.5 && dg > -(band + gone * pix / 0.05)) {
      let out = outward(g, p);
      let px = 1.2 * gone * pix / max(length(out - rd * dot(out, rd)), 0.05);
      if (dg > -(band + 0.5 * px)) {
        let cover = clamp((min(dg + 0.5 * px, 0.0) - max(dg - 0.5 * px, -band)) / px, 0.0, 1.0);
        col += thr * cover * rimAt(ig, g, p, rd, nn, dg, band, px, out);
        if (cover > 0.999) {
          done = true;
          break;
        }
        thr *= 1.0 - cover;
      }
    }
    if (dg > -P.air.z && P.frame2.x < 0.5) {
      // its rim: polished steel
      thr *= vec3f(0.3, 0.29, 0.28);
    } else if (g.to.w > 0.5 && front) {
      // a door. A little of this side's sky glints on it, and the rest is the world from its start
      // (less of it the nearer the eye comes, and none as it goes through: the door must not be felt)
      let glint = P.air.y * (0.2 + 0.8 * pow(1.0 - abs(dot(rd, nn)), 3.0)) * smoothstep(0.5, 12.0, gone);
      var back = reflect(rd, nn);
      back.y = abs(back.y);
      col += thr * glint * sky(back);
      thr *= 1.0 - glint;
      ro = turn(p, g.rot.xy) + g.to.xyz;
      rd = turn(rd, g.rot.xy);
      vel = turn(vel, g.rot.xy);
      skip = -1;
      continue;
    } else {
      thr *= P.air.w * vec3f(0.97, 0.985, 1.0);
    }
    rd = reflect(rd, nn);
    vel = reflect(vel, nn);
    ro = p + nn * 1e-3;
    skip = ig;
    mirrored = true;
  }
  if (!done) {
    col += thr * airOf(rd);
  }
  return vec4f(col, flag);
}

fn shoot(at: vec2f) -> vec4f {
  let ndc = vec2f(at.x / P.size.x * 2.0 - 1.0, 1.0 - at.y / P.size.y * 2.0);
  if (P.map.w > 1.5) {
    // the picture of the sky, as it is kept
    return vec4f(textureSampleLevel(skyTex, skyS, vec2f(at.x / P.size.x, 1.0 - at.y / P.size.y), 0.0).rgb, 0.0);
  }
  if (P.map.w > 0.5) {
    // looking straight down, for laying things out
    let ro = vec3f(P.map.x + ndc.x * P.map.z * P.size.x / P.size.y, 300.0, P.map.y + ndc.y * P.map.z);
    return trace(ro, normalize(vec3f(0.0, -1.0, 1e-4)), vec4u(0u), false);
  }
  let tile = min(vec2u(at / P.size.xy * vec2f(16.0, 10.0)), vec2u(15u, 9u));
  return trace(P.eye.xyz, normalize(P.fore.xyz + P.right.xyz * ndc.x + P.up.xyz * ndc.y), tiles[tile.y * 16u + tile.x], P.edge.z < 0.5);
}

@vertex
fn vert(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

// nothing brighter than `bright` (the sun is, thousands of times), but still its own colour
fn tame(c: vec3f) -> vec3f {
  // (a colour that is not a number, or is endless, is none: on some GPUs, now and then, a pixel comes out so;
  // one such pixel goes into every halving of the glow, and comes back as a black octagon a quarter of the
  // screen across. Asked by its bits, as a compiler may take x != x to be false.)
  let bad = (bitcast<vec3u>(c) & vec3u(0x7f800000u)) == vec3u(0x7f800000u);
  let k = max(select(c, vec3f(0.0), bad), vec3f(0.0));
  return k * min(1.0, P.tune.w / max(max(k.r, k.g), max(k.b, 1e-6)));
}

// A pixel is one ray through its middle. Where that ray passed within a pixel of an edge (of a glass, of a
// crest against what is behind it) the pixel is marked, in alpha, and gets four more rays afterwards.
@fragment
fn frag(@builtin(position) at: vec4f) -> @location(0) vec4f {
  let c = shoot(at.xy);
  if (P.tune.y > 2.5) {
    // what it cost: black none, through red and yellow to white at 600 looks at the ground
    let w = work / 200.0;
    return vec4f(clamp(vec3f(w, w - 1.0, w - 2.0), vec3f(0.0), vec3f(1.0)), 0.0);
  }
  if (P.tune.y > 1.5 && c.a > 0.5) {
    return vec4f(1.0, 0.0, 1.0, 0.0);
  }
  return vec4f(tame(c.rgb), c.a * step(0.5, P.tune.y));
}

// The four more rays. Done in the pixel's own shader they made the whole picture take three times as long,
// though only a pixel in fifty is marked: the GPU shades pixels in batches, and a batch takes as long as its
// slowest pixel. So the marked pixels are listed (`gather`), and the list is worked through on its own
// (`mend`), every batch of it full.
struct Marked {
  count: atomic<u32>,
  list: array<u32>,
};
@group(0) @binding(21) var traced: texture_2d<f32>;
@group(0) @binding(22) var<storage, read_write> marked: Marked;
@group(0) @binding(23) var mended: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8)
fn gather(@builtin(global_invocation_id) id: vec3u) {
  let size = textureDimensions(traced);
  if (id.x >= size.x || id.y >= size.y) {
    return;
  }
  if (textureLoad(traced, id.xy, 0).a > 0.5) {
    let i = atomicAdd(&marked.count, 1u);
    if (i < arrayLength(&marked.list)) {
      marked.list[i] = id.x | (id.y << 16u);
    }
  }
}

@compute @workgroup_size(64)
fn mend(@builtin(global_invocation_id) id: vec3u) {
  if (id.x >= min(atomicLoad(&marked.count), arrayLength(&marked.list))) {
    return;
  }
  let packed = marked.list[id.x];
  let at = vec2u(packed & 0xffffu, packed >> 16u);
  let spread = array<vec2f, 4>(vec2f(0.125, -0.375), vec2f(-0.375, -0.125), vec2f(0.375, 0.125), vec2f(-0.125, 0.375));
  let pair = array<vec2f, 2>(vec2f(-0.3125, 0.1875), vec2f(0.1875, -0.3125));
  // (four of them, or where that is too dear, two)
  let more = i32(P.edge.y);
  var col = textureLoad(traced, at, 0).rgb;
  for (var i = 0; i < more; i++) {
    col += tame(shoot(vec2f(at) + 0.5 + select(spread[i], pair[i & 1], more == 2)).rgb);
  }
  textureStore(mended, at, vec4f(col / f32(more + 1), 1.0));
}
