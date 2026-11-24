// the sand, made once: ripples and dunes as phasor noise (many small wave packets summed as complex numbers, and
// only the phase kept, so every ripple is as tall as the next and they fork and end as real ones do), the bore's
// own swell, rocks half buried with a scoured moat. Then its slopes, its shadows and its hollows.

@group(0) @binding(1) var rawOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(2) var rawIn: texture_2d<f32>;
@group(0) @binding(3) var smp: sampler;
@group(0) @binding(4) var heightOut: texture_storage_2d<rgba16float, write>;
@group(0) @binding(5) var auxOut: texture_storage_2d<rgba16float, write>;

fn wrapi(a: i32, n: i32) -> i32 { return ((a % n) + n) % n; }

/** smooth value noise, 0..1, that repeats every `per` cells each way */
fn pnoise(p: vec2f, per: vec2i, salt: u32) -> f32 {
  let i = vec2i(floor(p));
  let f = fract(p);
  let u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  let x0 = wrapi(i.x, per.x);
  let x1 = wrapi(i.x + 1, per.x);
  let y0 = wrapi(i.y, per.y);
  let y1 = wrapi(i.y + 1, per.y);
  let a = h01(hash2(x0, y0, salt));
  let b = h01(hash2(x1, y0, salt));
  let c = h01(hash2(x0, y1, salt));
  let d = h01(hash2(x1, y1, salt));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
fn pfbm(p: vec2f, per: vec2i, salt: u32) -> f32 { return (pnoise(p, per, salt) + 0.5 * pnoise(p * 2.0, per * 2, salt ^ 0x5bd1u)) / 1.5; }

/**
 * Phasor noise: wave packets scattered over a grid of cells that wraps round the tunnel and along it. Left alone
 * the packets all agree and the crests are perfect rings. Three things undo that: the whole field is read through
 * a slow warp, so crests meander and bunch without breaking; each cell's packets are a little out of step (more in
 * some patches than others), and where they cancel a crest forks or ends; each cell has its own spacing, so a fork
 * has to make up the count. f0 is turns per unit along the tunnel, a whole number in its length.
 */
fn phasor(x0: vec2f, cells: vec2i, f0: f32, count: i32, wander: f32, grain: f32, vary: f32, loose: f32, salt: u32) -> vec2f {
  let span = vec2f(TAU * U.tile.y, U.tile.x);
  let turns = U.tile.x / (TAU * U.tile.y);
  let wp = x0 / span * vec2f(grain, grain * turns);
  let wper = vec2i(i32(grain), i32(round(grain * turns)));
  let x = x0 + wander * 2.0 * (vec2f(pfbm(wp, wper, salt ^ 0x77u), pfbm(wp + 0.5, wper, salt ^ 0x3311u)) - 0.5);
  let size = span / vec2f(cells);
  let ic = vec2i(floor(x / size));
  let rho = 0.7 * min(size.x, size.y);
  var sum = vec2f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = ic + vec2i(i, j);
      let cw = vec2i(wrapi(c.x, cells.x), wrapi(c.y, cells.y));
      let mid = (vec2f(cw) + 0.5) / vec2f(cells);
      let fi = f0 * (1.0 + vary * (pfbm(mid * vec2f(4.0, 4.0 * turns), vec2i(4, i32(round(4.0 * turns))), salt ^ 0x1234u) * 2.0 - 1.0) * 1.6);
      let slack = loose * (0.2 + 1.6 * pnoise(mid * vec2f(3.0, 3.0 * turns) + 0.31, vec2i(3, i32(round(3.0 * turns))), salt ^ 0x999u));
      for (var k = 0; k < count; k++) {
        let h1 = hash2(cw.x, cw.y, salt + u32(k) * 7919u);
        let h2 = hashu(h1 + 0x9e3779b9u);
        let h3 = hashu(h2 + 0x9e3779b9u);
        let pos = (vec2f(c) + vec2f(h01(h1), h01(h2))) * size;
        let d = x - pos;
        let w = exp(-PI * dot(d, d) / (rho * rho));
        let ph = TAU * (fi * d.y + fract(f0 * pos.y) + slack * (h01(h3) - 0.5));
        sum += w * vec2f(cos(ph), sin(ph));
      }
    }
  }
  // as if every packet agreed: then the sum is about 1
  return sum / (f32(count) * 0.49);
}

/** the lesser of two, rounded where they meet over a width k */
fn soft(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

/** a leaning wave from a phase: 0 in the trough to 1 at the crest, steeper on one side */
fn leaning(ph: f32, lean: f32) -> f32 { return 0.5 + 0.5 * sin(ph + lean * sin(ph)); }

struct Rocks {
  top: f32, // the tallest rock here, above the sand's own level (below 0: none)
  moat: f32, // how far the sand is scoured away round them
  calm: f32, // 1 where the ripples run free, 0 against a rock
  tone: f32,
};

fn rocks(x: vec2f) -> Rocks {
  var o = Rocks(-1.0, 0.0, 1.0, 0.0);
  let cells = vec2i(5, i32(round(U.tile.x / (TAU * U.tile.y) * 5.0)));
  let size = vec2f(TAU * U.tile.y, U.tile.x) / vec2f(cells);
  let ic = vec2i(floor(x / size));
  let salt = u32(U.sandC.w) * 0x2545f491u + 0x51u;
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let c = ic + vec2i(i, j);
      let cw = vec2i(wrapi(c.x, cells.x), wrapi(c.y, cells.y));
      let h0 = hash2(cw.x, cw.y, salt);
      if (h01(h0) >= U.sandC.y) { continue; }
      let ha = hashu(h0 + 1u);
      let hb = hashu(h0 + 2u);
      let hc = hashu(h0 + 3u);
      let home = (vec2f(c) + 0.2 + 0.6 * vec2f(h01(ha), h01(hb))) * size;
      let big = U.sandC.z * (0.45 + 0.8 * h01(hc) * h01(hc));
      // the big one, and a few smaller beside it
      for (var k = 0u; k < 4u; k++) {
        let hk = hashu(h0 + 17u * (k + 1u));
        var pos = home;
        var r = big;
        if (k > 0u) {
          if (h01(hk) > 0.6) { continue; }
          let a = TAU * h01(hk + 5u);
          r = big * (0.22 + 0.3 * h01(hk + 6u));
          pos = home + (big * (0.9 + 0.9 * h01(hk + 7u)) + r) * vec2f(cos(a), sin(a));
        }
        let turn = TAU * h01(hk + 8u);
        let d = x - pos;
        let q = vec2f(d.x * cos(turn) - d.y * sin(turn), d.x * sin(turn) + d.y * cos(turn)) / (r * vec2f(1.0, 0.62 + 0.38 * h01(hk + 9u)));
        let off = vec2f(f32(hk & 255u), f32((hk >> 8u) & 255u));
        let wide = vec2i(1 << 20);
        let t = length(q) * (1.0 + 0.3 * (pnoise(q * 1.6 + off, wide, 3u) - 0.5));
        let tall = r * (0.5 + 0.5 * h01(hk + 10u));
        let lumps = 0.78 + 0.44 * pnoise(q * 3.1 + off, wide, 9u);
        let dome = pow(max(1.0 - pow(t, 2.6), 0.0), 0.55);
        // worn faces: the stone is what is left under a handful of leaning planes, but each cut is rounded into
        // the next (cut hard, with flat faces and sharp creases, a stone looked like a low-poly model), and the
        // whole is pitted and lumped at finer scales
        var faces = 2.0;
        for (var f = 0u; f < 6u; f++) {
          let hf = hashu(hk + 101u * (f + 1u));
          let fa = TAU * (f32(f) + h01(hf)) / 6.0;
          faces = soft(faces, 0.8 + 0.5 * h01(hf + 1u) - (0.45 + 0.9 * h01(hf + 2u)) * dot(vec2f(cos(fa), sin(fa)), q), 0.22);
        }
        let worn = 0.11 * (pnoise(q * 6.3 + off, wide, 31u) - 0.5) + 0.06 * (pnoise(q * 13.0 + off, wide, 37u) - 0.5) + 0.03 * (pnoise(q * 27.0 + off, wide, 41u) - 0.5);
        let top = tall * (soft(dome * lumps * 1.15, faces, 0.12) + worn * smoothstep(0.0, 0.25, dome) - 0.3);
        if (top > o.top) {
          o.top = top;
          o.tone = h01(hk + 11u);
        }
        o.moat += 0.3 * tall * exp(-(t - 1.0) * (t - 1.0) / 0.2);
        o.calm = min(o.calm, smoothstep(0.9, 1.9, t));
      }
    }
  }
  return o;
}

@compute @workgroup_size(8, 8)
fn heights(@builtin(global_invocation_id) id: vec3u) {
  let W = u32(U.tile.z);
  let H = u32(U.tile.w);
  if (id.x >= W || id.y >= H) { return; }
  let uv = (vec2f(id.xy) + 0.5) / vec2f(f32(W), f32(H));
  let x = uv * vec2f(TAU * U.tile.y, U.tile.x);
  let seed = u32(U.sandC.w) * 0x9e3779b9u;
  let turns = U.tile.x / (TAU * U.tile.y);

  // the bore swells and narrows
  let swell = U.sandC.x * (pfbm(uv * vec2f(3.0, 3.0 * turns), vec2i(3, i32(round(3.0 * turns))), seed ^ 0xa1u) * 2.0 - 1.0);

  // dunes: long leaning ridges across the tunnel, in some stretches and not in others
  let dn = vec2i(3, i32(round(3.0 * turns)));
  let dp = phasor(x, dn, round(U.sandB.w) / U.tile.x, 6, 0.6, 2.0, 0.12, 0.9, seed ^ 0xd00eu);
  let stretch = smoothstep(0.38, 0.62, pfbm(uv * vec2f(2.0, 2.0 * turns) + 0.37, vec2i(2, i32(round(2.0 * turns))), seed ^ 0xbeefu));
  let dune = U.sandB.z * pow(leaning(atan2(dp.y, dp.x), 0.75), 1.3) * smoothstep(0.0, 0.45, length(dp)) * stretch;

  let rk = rocks(x);

  // ripples: finer, and they keep clear of the rocks
  // (cells about three ripples across, however fine the ripples)
  let across = clamp(i32(round(U.sandA.x / turns / 3.1)), 6, 48);
  let rn = vec2i(across, i32(round(f32(across) * turns)));
  let rp = phasor(x, rn, round(U.sandA.x) / U.tile.x, 10, U.sandB.x, 6.0, U.sandB.y, U.sandA.w, seed ^ 0x51ffu);
  let crest = pow(leaning(atan2(rp.y, rp.x), U.sandA.z), 1.1);
  let rough = 0.65 + 0.7 * pfbm(uv * vec2f(5.0, 5.0 * turns), vec2i(5, i32(round(5.0 * turns))), seed ^ 0x33u);
  let ripple = U.sandA.y * (crest * 2.0 - 1.0) * smoothstep(0.0, 0.4, length(rp)) * rough * rk.calm;

  let sand = swell + dune + ripple - rk.moat;
  let rock = swell + dune + rk.top;
  let h = max(sand, rock);
  let isRock = smoothstep(-0.003, 0.003, rock - sand);
  textureStore(rawOut, vec2i(id.xy), vec4f(h, isRock, crest * rk.calm, rk.tone));
}

/** the slopes (per unit round the wall and along it), the shadow of whatever stands toward the light, the hollows */
@compute @workgroup_size(8, 8)
fn bake(@builtin(global_invocation_id) id: vec3u) {
  let W = i32(U.tile.z);
  let H = i32(U.tile.w);
  if (i32(id.x) >= W || i32(id.y) >= H) { return; }
  let p = vec2i(id.xy);
  let texel = vec2f(TAU * U.tile.y / f32(W), U.tile.x / f32(H));
  let me = textureLoad(rawIn, p, 0);
  let hl = textureLoad(rawIn, vec2i(wrapi(p.x - 1, W), p.y), 0).r;
  let hr = textureLoad(rawIn, vec2i(wrapi(p.x + 1, W), p.y), 0).r;
  let hd = textureLoad(rawIn, vec2i(p.x, wrapi(p.y - 1, H)), 0).r;
  let hu = textureLoad(rawIn, vec2i(p.x, wrapi(p.y + 1, H)), 0).r;
  let grad = vec2f(hr - hl, hu - hd) / (2.0 * texel);
  textureStore(heightOut, p, vec4f(me.r, grad, me.g));

  let uv = (vec2f(p) + 0.5) / vec2f(f32(W), f32(H));
  // the light leans along the tunnel: walk toward where it comes from, and see whether anything stands above the ray
  let lean = U.light.y;
  var lit = 1.0;
  if (abs(lean) > 0.02) {
    let reach = min(0.7 * abs(lean), 1.5);
    for (var k = 1; k <= 48; k++) {
      let t = reach * f32(k) / 48.0;
      let q = uv - vec2f(0.0, sign(lean) * t / U.tile.x);
      let hq = textureSampleLevel(rawIn, smp, q, 0.0).r;
      let ray = me.r + 0.004 + t / abs(lean);
      lit = min(lit, clamp((ray - hq) / ((0.03 + 0.45 * t) / abs(lean)), 0.0, 1.0));
    }
  }
  // hollows: how much of what lies round about stands higher
  var over = 0.0;
  for (var k = 0; k < 16; k++) {
    let a = TAU * (f32(k) + 0.5) / 8.0;
    let rad = select(0.035, 0.1, k >= 8);
    let q = uv + rad * vec2f(cos(a), sin(a)) / vec2f(TAU * U.tile.y, U.tile.x);
    over += max(textureSampleLevel(rawIn, smp, q, 0.0).r - me.r, 0.0) / rad;
  }
  let open = 1.0 / (1.0 + 1.4 * over / 16.0);
  textureStore(auxOut, p, vec4f(lit, open, me.b, me.a));
}
