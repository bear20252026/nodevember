// Idea 4: corrosion under an impossible microscope. A polished, colour-etched steel: grains tinted by an oxide
// film whose thickness follows their orientation. Pits open with crystallographic walls (squares, triangles,
// hexagons, slots, by grain), change direction when they cross a grain boundary, crack the boundaries between
// them, throw rust around their mouths and interference halos further out; then they close again and the metal heals.
import { lab, rgb } from "./lab.ts";

const look = {
  zoom: 0.6, // field of view height (a grain is 0.1)
  ageMin: 0.08,
  ageMax: 0.75,
  grainTint: 1.0, // how strongly the etch film colours the grains
  pitRate: 0.6,
  slope: 0.9, // pit wall steepness
  terraces: 0.6, // ledges down the walls
  crack: 1.0,
  deposit: 1.0, // rust heaped round the mouths
  halo: 1.0, // interference halo beyond the rust
  darkField: 0.55, // oblique ring light: lights the walls
  aperture: 0.94, // cos of the objective's half angle: what still reflects into it
  rust: "#a8461a",
  ring: "#ffd9a8",
  seed: 3,
  exposure: 1.25,
  res: 1,
  debug: 0, // 1 depth, 2 film, 3 rust, 4 n.z
};

lab({
  title: "microscope",
  look,
  duration: 16_000,
  ranges: {
    zoom: [0.3, 3, 0.01],
    ageMin: [0, 1, 0.01],
    ageMax: [0, 1.5, 0.01],
    grainTint: [0, 2, 0.01],
    pitRate: [0, 3, 0.01],
    slope: [0.2, 4, 0.01],
    terraces: [0, 1, 0.01],
    crack: [0, 3, 0.01],
    deposit: [0, 3, 0.01],
    halo: [0, 3, 0.01],
    darkField: [0, 2, 0.01],
    aperture: [0.8, 0.999, 0.001],
    seed: [0, 50, 1],
    exposure: [0.2, 3, 0.01],
    res: [0.25, 2, 0.05],
    debug: [0, 4, 1],
  },
  pack: (l) =>
    [
      ...[l.zoom, l.ageMin, l.ageMax, l.grainTint],
      ...[l.pitRate, l.slope, l.terraces, l.crack],
      ...[l.deposit, l.halo, l.darkField, l.aperture],
      ...rgb(l.rust as string),
      l.seed as number,
      ...rgb(l.ring as string),
      l.exposure as number,
      l.debug as number,
    ] as number[],
  wgsl: /* wgsl */ `
fn lab(px: vec2f, res: vec2f, t: f32, a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f, h: vec4f) -> vec4f {
  let tau = 6.2831853;
  let ph = tau * t;
  // corrosion advances and retreats once per loop
  let age = mix(a.y, a.z, 0.5 - 0.5 * cos(ph));
  let pan = vec2f(cos(ph), sin(ph)) * 0.04 + vec2f(3.7, 1.3);
  let pxw = a.x / res.y; // one pixel in world units
  let x = (px - 0.5 * res) * pxw + pan;
  var P: mcParams;
  P.age = age; P.rate = b.x; P.slope = b.y; P.terr = b.z; P.crack = b.w; P.dep = c.x; P.halo = c.y; P.seed = u32(d.w);
  let s0 = mcField(x, P);
  let hx = mcField(x + vec2f(pxw, 0.0), P).h;
  let hy = mcField(x + vec2f(0.0, pxw), P).h;
  let n = normalize(vec3f(-(hx - s0.h) / pxw, -(hy - s0.h) / pxw, 1.0));

  // metal: silver, coloured by the oxide film (grain etch + halo)
  let film = s0.tint * a.w + s0.film;
  let metal = vec3f(0.66, 0.64, 0.6) * mcFilm(film);
  // bright field: only what tilts less than the objective's half angle reflects back up into it
  let bf = smoothstep(c.w, mix(c.w, 1.0, 0.7), n.z);
  // DIC-like shear shading so flat-ish relief reads
  let shear = 1.0 + 2.5 * dot(n.xy, normalize(vec2f(0.7, 0.5)));
  // dark field: a ring light low around the lens lights steep walls
  let tilt = sqrt(max(1.0 - n.z * n.z, 0.0));
  let df = smoothstep(0.25, 0.6, tilt) * (0.6 + 0.4 * dot(normalize(n.xy + 1e-5), normalize(vec2f(-0.4, 0.9))));
  var col = metal * (bf * shear * 0.9 + 0.05) + metal * e.xyz * df * c.z;
  // pit floors are out of focus: a little flatter
  col = mix(col, vec3f(dot(col, vec3f(0.33))), clamp(s0.depth * 6.0, 0.0, 0.5));
  // rust: rough, scatters the light back whatever its slope
  let rough = mix(d.xyz * vec3f(0.35, 0.22, 0.2), d.xyz * 1.25, smoothstep(0.3, 0.75, s0.lump)) * (0.35 + 0.65 * n.z);
  col = mix(col, rough, s0.rust);
  // cracks are black
  col *= 1.0 - 0.92 * s0.crk;
  // a soft field stop
  let r = length((px - 0.5 * res) / res.y);
  col *= (1.0 - 0.55 * smoothstep(0.35, 0.95, r)) * (1.0 + 0.12 * dot((px - 0.5 * res) / res.y, vec2f(-0.5, 0.6)));
  let dbg = i32(f.x);
  if (dbg == 1) { return vec4f(vec3f(s0.depth * 8.0), 1.0); }
  if (dbg == 2) { return vec4f(vec3f(s0.film / 300.0), 1.0); }
  if (dbg == 3) { return vec4f(vec3f(s0.rust), 1.0); }
  if (dbg == 4) { return vec4f(vec3f(n.z), 1.0); }
  return vec4f(col * e.w, 1.0);
}

struct mcParams { age: f32, rate: f32, slope: f32, terr: f32, crack: f32, dep: f32, halo: f32, seed: u32 }
struct mcOut { h: f32, depth: f32, rust: f32, lump: f32, film: f32, tint: f32, crk: f32 }

fn mcHashU(x: u32) -> u32 {
  let v = x * 747796405u + 2891336453u;
  let w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
  return (w >> 22u) ^ w;
}
fn mcHash(cell: vec2i, s: u32) -> vec4f {
  let k = mcHashU((bitcast<u32>(cell.x) * 1597334677u) ^ mcHashU(bitcast<u32>(cell.y) ^ (s * 3812015801u)));
  return vec4f(f32(k), f32(mcHashU(k)), f32(mcHashU(k ^ 0x9e3779b9u)), f32(mcHashU(k + 0x7f4a7c15u))) / 4294967295.0;
}
fn mcNoise(p: vec2f, s: u32) -> f32 {
  let i = vec2i(floor(p));
  let fr = fract(p);
  let u = fr * fr * (3.0 - 2.0 * fr);
  let n00 = mcHash(i, s).x;
  let n10 = mcHash(i + vec2i(1, 0), s).x;
  let n01 = mcHash(i + vec2i(0, 1), s).x;
  let n11 = mcHash(i + vec2i(1, 1), s).x;
  return mix(mix(n00, n10, u.x), mix(n01, n11, u.x), u.y);
}

const mcG = 0.1; // grain size

fn mcSeedPt(cell: vec2i, s: u32) -> vec2f {
  let h = mcHash(cell, s);
  return (vec2f(cell) + 0.1 + 0.8 * h.xy) * mcG;
}
// the crystal of a grain: which way its lattice points, the shape of its pits, how fast it corrodes
struct mcGrain { ang: f32, sides: f32, aspect: f32, susc: f32, tint: f32 }
fn mcGrainOf(cell: vec2i, s: u32) -> mcGrain {
  let h = mcHash(cell, s + 17u);
  let k = mcHash(cell, s + 29u);
  var g: mcGrain;
  g.sides = select(select(4.0, 3.0, h.y < 0.3), 6.0, h.y > 0.85);
  g.ang = h.x * 6.2831853 / g.sides;
  g.aspect = select(1.0, 1.0 + 1.5 * k.x, h.y > 0.6 && h.y <= 0.85);
  g.susc = 0.45 + 0.9 * h.z;
  g.tint = 30.0 + 190.0 * h.w; // nm of etch film
  return g;
}
// polygon "radius": the pit outline is the level set of this
fn mcPoly(v: vec2f, g: mcGrain) -> f32 {
  var r = -1e9;
  let n = i32(g.sides);
  for (var k = 0; k < 6; k++) {
    if (k >= n) { break; }
    let an = g.ang + 6.2831853 * f32(k) / g.sides;
    let dir = vec2f(cos(an), sin(an));
    // slots: stretched across alternate facets
    r = max(r, dot(v, dir) * select(1.0, g.aspect, k % 2 == 0));
  }
  return r;
}

fn mcField(x: vec2f, P: mcParams) -> mcOut {
  // which grain, and how far to its boundary (looked up on a warped copy so boundaries curve)
  let xg = x + 0.014 * vec2f(mcNoise(x * 18.0, P.seed + 9u), mcNoise(x * 18.0 + 7.3, P.seed + 9u)) - 0.007;
  let base = vec2i(floor(xg / mcG));
  var best = 1e9;
  var gc = base;
  var gs = vec2f(0.0);
  for (var j = -1; j <= 1; j++) {
    for (var i = -1; i <= 1; i++) {
      let cl = base + vec2i(i, j);
      let sp = mcSeedPt(cl, P.seed);
      let dd = dot(xg - sp, xg - sp);
      if (dd < best) { best = dd; gc = cl; gs = sp; }
    }
  }
  var bd = 1e9;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let cl = gc + vec2i(i, j);
      if (i == 0 && j == 0) { continue; }
      let sp = mcSeedPt(cl, P.seed);
      bd = min(bd, dot(0.5 * (gs + sp) - xg, normalize(sp - gs)));
    }
  }
  var g = mcGrainOf(gc, P.seed);
  // annealing twins: a straight band across some grains, the lattice mirrored inside it
  let th = mcHash(gc, P.seed + 63u);
  var twin = 0.0;
  if (th.x < 0.45) {
    let dir = vec2f(cos(g.ang + 0.6), sin(g.ang + 0.6));
    let off = dot(x - gs, dir) - (th.y - 0.5) * 0.06;
    let w = 0.006 + 0.016 * th.z;
    twin = smoothstep(w + 0.0006, w - 0.0006, abs(off));
    bd = min(bd, abs(abs(off) - w) + 0.0007);
    g.tint = mix(g.tint, g.tint + 45.0 + 50.0 * th.w, twin);
    g.ang = mix(g.ang, g.ang + 0.5, twin);
  }

  var depth = 0.0;
  var rust = 0.0;
  var film = 0.0;
  var act = 0.0;
  for (var j = -2; j <= 2; j++) {
    for (var i = -2; i <= 2; i++) {
      let cl = gc + vec2i(i, j);
      let h = mcHash(cl, P.seed + 41u);
      if (h.x < 0.55) { continue; }
      let onset = h.y * 0.75;
      let S = P.rate * mcG * max(P.age - onset, 0.0) * (0.55 + 0.9 * h.z) * mcGrainOf(cl, P.seed).susc;
      if (S <= 0.0) { continue; }
      let sp = mcSeedPt(cl, P.seed);
      let c0 = sp + (h.zw - 0.5) * 0.3 * mcG;
      var reach: f32;
      if (cl.x == gc.x && cl.y == gc.y) {
        reach = S - mcPoly(x - c0, g);
      } else {
        // the front crosses the boundary between the pit's grain and ours, then follows our lattice
        let gp = mcGrainOf(cl, P.seed);
        let nb = normalize(gs - sp);
        let mid = 0.5 * (gs + sp);
        let b = x - nb * dot(x - mid, nb);
        let left = S - mcPoly(b - c0, gp);
        reach = left * g.susc / gp.susc - mcPoly(x - b, g);
      }
      let dmax = 0.32 * S + 0.004;
      var dp = clamp(P.slope * reach, 0.0, dmax);
      // ledges down the walls
      let stepH = 0.012;
      let q = dp / stepH;
      dp = mix(dp, stepH * (floor(q) + smoothstep(0.7, 1.0, fract(q))), P.terr);
      depth = max(depth, dp);
      film += 130.0 * smoothstep(0.0, dmax, dp) * min(S / mcG * 2.0, 1.0);
      // rust heaped just outside the mouth, a halo of thin oxide further out
      let out = max(-reach, 0.0);
      rust = max(rust, P.dep * smoothstep(0.0, 0.3, S / mcG) * exp(-max(out, 0.0) / (0.4 * S + 0.002)) * smoothstep(-0.25 * S, 0.0, -reach + 0.04 * S));
      film += P.halo * 150.0 * min(S / mcG, 1.0) * exp(-max(length(x - c0) - 0.5 * S, 0.0) / (0.7 * S + 0.01));
      act += S * exp(-length(x - c0) / (1.3 * mcG));
    }
  }
  // cracks run along grain boundaries from busy pits
  let cw = P.crack * 0.0035 * smoothstep(0.07, 0.2, act);
  let crk = smoothstep(cw, cw * 0.3, bd) * step(0.0005, cw);
  let groove = 0.0009 * smoothstep(0.0016, 0.0, bd);

  // lumpy rust
  let lump = mcNoise(x * 60.0, P.seed + 4u) * 0.4 + mcNoise(x * 160.0, P.seed + 5u) * 0.35 + mcNoise(x * 420.0, P.seed + 6u) * 0.25;
  let rm = smoothstep(0.42, 0.62, rust * (0.15 + 1.25 * lump));
  // polishing scratches: faint straight grooves in a few directions
  var scr = 0.0;
  for (var k = 0u; k < 3u; k++) {
    let hk = mcHash(vec2i(i32(k), 5), P.seed + 77u);
    let an = hk.x * 3.14159;
    let dir = vec2f(-sin(an), cos(an));
    let u = dot(x, dir) * (90.0 + 160.0 * hk.y);
    let id = floor(u);
    let hl = mcHash(vec2i(i32(id), i32(k)), P.seed + 91u);
    let along = dot(x, vec2f(cos(an), sin(an)));
    let on = step(0.94, hl.x) * smoothstep(0.0, 0.2, mcNoise(vec2f(along * 6.0, id), P.seed + 3u) - 0.35);
    scr = max(scr, on * smoothstep(0.12, 0.0, abs(fract(u) - 0.5)));
  }
  // inclusions: small dark specks, and one at every pit's heart
  let inc = smoothstep(0.0028, 0.0018, length(x - gs - (mcHash(gc, P.seed + 5u).xy - 0.5) * 0.06)) * step(0.7, mcHash(gc, P.seed + 6u).x);
  var o: mcOut;
  o.depth = depth;
  o.h = -depth - 0.00025 * scr - 0.001 * inc - groove - 0.05 * crk + rm * 0.012 * (0.5 + lump) + 0.0015 * (g.susc - 1.0);
  o.rust = rm;
  o.lump = lump;
  o.film = film;
  o.tint = g.tint + 25.0 * (mcNoise(x * 9.0, P.seed + 2u) - 0.5);
  o.crk = crk;
  return o;
}

fn mcFilm(nm: f32) -> vec3f {
  let lam = vec3f(640.0, 540.0, 455.0);
  let ph = 4.0 * 3.14159265 * 2.3 * nm / lam;
  let fade = exp(-nm / 900.0);
  return mix(vec3f(0.7), 0.3 + 0.7 * (0.5 + 0.5 * cos(ph)), fade);
}
`,
});
