// the tunnel's wall, drawn from the inside: a tube of rings pushed in by the sand's height, finest near the eye;
// lit by the caustic map, hazed by the water; and specks adrift in it

@group(0) @binding(1) var heightTex: texture_2d<f32>;
@group(0) @binding(2) var auxTex: texture_2d<f32>;
@group(0) @binding(3) var causticTex: texture_2d<f32>;
@group(0) @binding(4) var smp: sampler;
@group(0) @binding(5) var blobTex: texture_2d<f32>;

// a coarse band behind the eye (seen only when looking round), then finest at the eye and twice as coarse each band on
const BANDS = 5u;
const STEP = array<u32, 5>(4u, 1u, 2u, 4u, 8u);
const BACK = 64u;

struct WOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) uv: vec2f,
};

@vertex
fn vsWall(@builtin(vertex_index) vi: u32) -> WOut {
  let cols = u32(U.mesh.z);
  let per = u32(U.mesh.w);
  let col = vi % (cols + 1u);
  var left = vi / (cols + 1u);
  // every ring on its own band's grid, so none ever moves as the eye goes on
  var z = U.mesh.x;
  var lod = 0.0;
  for (var b = 0u; b < BANDS; b++) {
    let n = min(left, select(per, BACK, b == 0u));
    z += f32(n) * U.mesh.y * f32(STEP[b]);
    left -= n;
    if (n > 0u) { lod = log2(f32(STEP[b])); }
  }
  let u = f32(col) / f32(cols);
  let uv = vec2f(u, z / U.tile.x);
  let h = textureSampleLevel(heightTex, smp, uv, lod).r;
  let ax = ringAxes(z);
  let a = u * TAU;
  var o: WOut;
  o.world = centre(z) + (U.tile.y - h) * (ax[0] * cos(a) + ax[1] * sin(a));
  o.pos = toClip(o.world);
  o.uv = uv;
  return o;
}

fn wrapi(a: i32, n: i32) -> i32 { return ((a % n) + n) % n; }
/** smooth value noise, 0..1, repeating every `per` cells */
fn pnoise(p: vec2f, per: vec2i, salt: u32) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let x0 = wrapi(i.x, per.x);
  let x1 = wrapi(i.x + 1, per.x);
  let y0 = wrapi(i.y, per.y);
  let y1 = wrapi(i.y + 1, per.y);
  return mix(mix(h01(hash2(x0, y0, salt)), h01(hash2(x1, y0, salt)), u.x), mix(h01(hash2(x0, y1, salt)), h01(hash2(x1, y1, salt)), u.x), u.y);
}


@fragment
fn fsWall(in: WOut) -> @location(0) vec4f {
  let hg = textureSample(heightTex, smp, in.uv);
  let aux = textureSample(auxTex, smp, in.uv);
  // the caustic map holds the light and which way it was bent: red is bent a little less, blue a little more
  let lightHere = textureSample(causticTex, smp, in.uv);
  let part = U.light.w * lightHere.yz / max(lightHere.x, 0.05) * select(0.0, 1.0, U.light2.y > 1.5);
  let caustic = vec3f(textureSample(causticTex, smp, in.uv + part).x, lightHere.x, textureSample(causticTex, smp, in.uv - part).x);
  let turns = U.tile.x / (TAU * U.tile.y);
  let rock = hg.a;

  // the rocks' own roughness, finer than the map holds: a noise on the wall, its slope added to the map's
  var grad = hg.yz;
  let cells = vec2i(160, i32(round(160.0 * turns)));
  let np = in.uv * vec2f(cells);
  let e = 0.35;
  let n0 = pnoise(np, cells, 5u) + 0.5 * pnoise(np * 2.0, cells * 2, 6u);
  let nx = pnoise(np + vec2f(e, 0.0), cells, 5u) + 0.5 * pnoise(np * 2.0 + vec2f(2.0 * e, 0.0), cells * 2, 6u);
  let ny = pnoise(np + vec2f(0.0, e), cells, 5u) + 0.5 * pnoise(np * 2.0 + vec2f(0.0, 2.0 * e), cells * 2, 6u);
  // (it fades with distance, where it would only shimmer)
  let dist = length(in.world - U.cam.xyz);
  let close = 1.0 - smoothstep(2.0, 6.0, dist);
  grad += rock * U.light2.w * close * vec2f(nx - n0, ny - n0) / e;

  let z = in.uv.y * U.tile.x;
  let a = in.uv.x * TAU;
  let ax = ringAxes(z);
  let er = ax[0] * cos(a) + ax[1] * sin(a);
  let et = -ax[0] * sin(a) + ax[1] * cos(a);
  let r = U.tile.y - hg.x;
  let n = -normalize(er + grad.x * (U.tile.y / r) * et + grad.y * ax[2]);

  // the light comes out from the middle, leaning along the tunnel
  let lean = U.light.y;
  let toLight = -normalize(er + lean * ax[2]);
  // (what the map holds is light per patch of wall as the bare tunnel has it; a slope takes more or less of it)
  let facing = dot(n, toLight) * sqrt(1.0 + lean * lean);
  let direct = max(mix(facing, 1.0, 0.18), 0.0);
  // (past where the caustics are traced the light is left even: it is deep in the haze by then)
  let traced = 1.0 - smoothstep(U.misc2.y - 2.0, U.misc2.y - 0.4, in.uv.y * U.tile.x - U.cam.z);
  let web = max(vec3f(1.0) + (caustic - 1.0) * U.lookA.y * traced, vec3f(0.0));
  let sun = U.lookA.w * mix(vec3f(1.0), vec3f(1.12, 0.96, 0.7), U.right.w);

  // sand: paler on the crests, darker where the fines settle; rocks grey, each its own
  let mottle = pnoise(in.uv * vec2f(24.0, 24.0 * turns), vec2i(24, i32(round(24.0 * turns))), 21u);
  let sand = U.lookC.rgb * (0.78 + 0.3 * aux.z) * (0.92 + 0.16 * mottle);
  let stone = mix(vec3f(0.13, 0.13, 0.125), vec3f(0.3, 0.27, 0.22), aux.w) * (0.6 + 0.8 * n0 / 1.5);
  let albedo = mix(sand, stone, rock);

  let around = U.lookA.z * mix(U.lookB.rgb * 1.6, vec3f(1.0), 0.45) * aux.y * (0.75 + 0.25 * dot(n, -er));
  // the water scatters light into every shadow: none is black
  // (and the shadows of whatever lives here, drawn each frame into a map of the wall)
  let shadows = textureSampleLevel(blobTex, smp, in.uv, 0.0).r;
  let shade = mix(1.0 - U.up.w, 1.0, aux.x) * (1.0 - shadows);
  var c = albedo * (sun * web * direct * shade + around * (1.0 - 0.35 * shadows));

  // grains that catch the light, near the eye
  let gp = vec2i(floor(in.uv * vec2f(U.tile.zw) * 6.0));
  let view = normalize(U.cam.xyz - in.world);
  let glint = h01(hash2(gp.x, gp.y, 77u));
  let flash = pow(max(dot(reflect(-toLight, n), view), 0.0), 6.0);
  c += (1.0 - rock) * U.lookB.w * close * step(0.992 - 0.02 * flash, glint) * sun * web * shade * (0.25 + flash);

  return vec4f(hazed(c, dist), 1.0);
}

// ---------------------------------------------------------------- specks adrift

struct SOut {
  @builtin(position) pos: vec4f,
  @location(0) q: vec2f,
  @location(1) light: vec3f,
};

@vertex
fn vsSpeck(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SOut {
  let corner = vec2f(f32(vi & 1u), f32((vi >> 1u) & 1u)) * 2.0 - 1.0;
  let ha = hashu(ii * 3u + 1u);
  let hb = hashu(ii * 3u + 2u);
  let hc = hashu(ii * 3u + 3u);
  // each keeps its place in a stretch of water that goes along with the eye
  // (half the tunnel's length, so that when the eye's distance along starts again from nothing each speck is
  // where it was; and in a loop being recorded they do not drift, only waver)
  let reach = 0.5 * U.tile.x;
  let t = U.cam.w;
  let adrift = select(1.0, 0.0, U.lens.z > 0.0);
  let z = U.cam.z - 0.5 + fract(h01(ha) - U.cam.z / reach + adrift * 0.01 * t * (h01(hc) - 0.5)) * reach;
  let a = TAU * h01(hb) + adrift * 0.05 * t * (h01(ha + 9u) - 0.5);
  let rad = 0.78 * U.tile.y * sqrt(h01(hc));
  let ax = ringAxes(z);
  let p = centre(z) + rad * (ax[0] * cos(a) + ax[1] * sin(a)) + 0.03 * vec3f(sin(t * beat(0.3) + f32(ii)), sin(t * beat(0.23) + 1.7 * f32(ii)), 0.0);
  let dist = length(p - U.cam.xyz);
  // a pixel or two wide; softer and wider up close, as if out of focus
  let px = (1.2 + 2.5 * h01(ha + 5u)) * (1.0 + 1.5 / (0.3 + dist)) * U.misc.w / 900.0;
  var o: SOut;
  o.pos = toClip(p);
  o.pos = vec4f(o.pos.xy + corner * 2.0 * px * o.pos.w / vec2f(U.misc.w * U.misc2.x, U.misc.w), o.pos.zw);
  o.q = corner;
  let fade = smoothstep(0.0, 0.6, z - U.cam.z + 0.5) * (1.0 - smoothstep(reach - 2.5, reach - 0.5, z - U.cam.z + 0.5));
  // a speck in a shaft of light is lit by it: what the light there is on its way to being, where it lands
  let at = vec2f(a / TAU, z / U.tile.x);
  let ground = textureSampleLevel(heightTex, smp, at, 3.0).r;
  let down = (rad - (U.tile.y - U.light.x)) / max(U.light.x - ground, 0.05);
  let landed = textureSampleLevel(causticTex, smp, at + vec2f(0.0, U.light.y * max(U.tile.y - rad - ground, 0.0) / U.tile.x), 1.0).x;
  let lit = mix(1.0, min(gathered(landed, down), 6.0), U.shaft.w * step(0.0, down));
  o.light = U.misc.z * fade * lit * through(dist) * vec3f(0.9, 1.0, 1.0) * (0.25 + 0.75 * h01(hb + 3u)) / (1.0 + 1.5 / (0.3 + dist));
  return o;
}

@fragment
fn fsSpeck(in: SOut) -> @location(0) vec4f {
  let d = dot(in.q, in.q);
  if (d > 1.0) { discard; }
  return vec4f(in.light * (1.0 - d) * (1.0 - d), 0.0);
}
