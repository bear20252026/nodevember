// The ground: dunes.
//
// Only the slow things about it are kept as pictures (two, repeating every SPAN metres, the world's origin at
// their middle): how far the dunes' crests are pushed along the wind, the lie of the land under them, how tall
// they stand, and where across each one its brink is. The dune itself, with its sharp brink, is worked out on
// top of those, so it is as sharp near as far.
//
// Half floats are too coarse for the push and the lie of the land (a centimetre and more, which the low sun
// shows as steps), so each is kept as two numbers to add: a round one, and what is left over.

const SPAN = 4096.0; // metres until the ground repeats
const CELLS = 2048; // texels across its pictures
const CELL = 2.0; // metres to one

struct Field {
  warp: f32, // how far the crests are pushed, in dunes
  base: f32, // the land under the dunes, metres
  amp: f32, // how tall a dune is here, metres
  brink: f32, // where from trough (0) to trough (1) the brink is
  pan: f32, // how much of a wet pan this is; under zero, how much the small dunes are taken off
};

fn fieldOf(a: vec4f, b: vec4f) -> Field {
  return Field(a.x + a.y, a.z + a.w, b.x, b.y + b.z, b.w);
}

fn fieldsAt(xz: vec2f) -> Field {
  let uv = xz / SPAN + 0.5;
  return fieldOf(textureSampleLevel(ctlA, lin, uv, 0.0), textureSampleLevel(ctlB, lin, uv, 0.0));
}

// a dune across the wind: up the long windward side from the trough (u = 0) to the brink (u = c), a rounded
// crest there, then down the slip face, which lies at the sand's angle of repose and eases into the next trough
fn dune(u: f32, c: f32) -> f32 {
  let s = u / c;
  let windward = s * s * (3.0 - 2.0 * s);
  let r = (1.0 - u) / (1.0 - c);
  let e = 0.14;
  let slip = (sqrt(r * r + e * e) - e) / (sqrt(1.0 + e * e) - e);
  return select(slip, windward, u < c);
}

// Between the big dunes, small ones of their own spacing and heading (P.small: how tall, their wave, and how much
// of the big ones' push they take). They stand only where the big ones are low, and not where the sand has been
// levelled or is wet (`pan` under zero is how much it has been levelled), and in patches: taller here, none there.
fn smallAt(f: Field, xz: vec2f) -> f32 {
  let calm = clamp(select(smoothstep(0.1, 0.4, f.pan), -f.pan, f.pan < 0.0), 0.0, 1.0);
  let clump = 0.5 + 0.5 * sin(6.2831853 * (dot(xz, vec2f(37.0, 53.0)) / SPAN + f.warp)) * sin(6.2831853 * (dot(xz, vec2f(-49.0, 31.0)) / SPAN + 0.3));
  let tall = P.small.x * (1.0 - smoothstep(P.small2.x, P.small2.y, f.amp)) * (1.0 - calm) * mix(1.0, clump, P.small2.z);
  let v = fract(dot(xz, P.small.yz) + P.small.w * f.warp);
  // (the slip face a little under the angle of repose: where the push packs the crests closer it is steeper)
  let brink = 1.0 - clamp(tall * length(P.small.yz) / P.dune.y * 1.3, 0.03, 0.5);
  return tall * dune(v, brink);
}

fn groundOf(f: Field, xz: vec2f) -> f32 {
  let u = fract(dot(xz, P.wave.xy) + f.warp);
  return f.base + f.amp * dune(u, f.brink) + smallAt(f, xz);
}

fn ground(xz: vec2f) -> f32 {
  return groundOf(fieldsAt(xz), xz);
}

// The fields, and how each changes across (x) and along (z). The changes are kept as pictures of their own
// (made from the fields, see tops.wgsl) and read between texels like the fields: a slope taken from the fields
// as the march reads them would have a crease at every texel, and the low sun shows every one.
struct Lay {
  a: vec4f,
  b: vec4f,
  ax: vec4f,
  bx: vec4f,
  az: vec4f,
  bz: vec4f,
};

fn layAt(xz: vec2f) -> Lay {
  let uv = xz / SPAN + 0.5;
  let c = textureSampleLevel(ctlC, lin, uv, 0.0);
  let d = textureSampleLevel(ctlD, lin, uv, 0.0);
  var lay: Lay;
  lay.a = textureSampleLevel(ctlA, lin, uv, 0.0);
  lay.b = textureSampleLevel(ctlB, lin, uv, 0.0);
  lay.ax = vec4f(c.x, 0.0, c.z, 0.0);
  lay.az = vec4f(c.y, 0.0, c.w, 0.0);
  lay.bx = vec4f(d.x, d.z, 0.0, 0.0);
  lay.bz = vec4f(d.y, d.w, 0.0, 0.0);
  return lay;
}

// the ground a little way (o, metres) from where the lay was read
fn groundNear(lay: Lay, xz: vec2f, o: vec2f) -> f32 {
  return groundOf(fieldOf(lay.a + lay.ax * o.x + lay.az * o.y, lay.b + lay.bx * o.x + lay.bz * o.y), xz + o);
}

// how the ground rises across (x) and along (z), measured over e metres either way
fn slopeAt(lay: Lay, xz: vec2f, e: f32) -> vec2f {
  return vec2f(groundNear(lay, xz, vec2f(e, 0.0)) - groundNear(lay, xz, vec2f(-e, 0.0)), groundNear(lay, xz, vec2f(0.0, e)) - groundNear(lay, xz, vec2f(0.0, -e))) / (2.0 * e);
}
