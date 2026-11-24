// Idea 3: iron-oxide rings. A sandstone specimen on a turntable; a fixed cutting plane slices through it, so the
// polished section shows a different face of the same fixed volume every moment. Inside, iron came in from the
// joints of the old rock and precipitated in Liesegang bands: nested shells parallel to each joint block, spaced
// wider and wider inwards (Jablczynski: x_n ∝ (1+p)^n), some bands broken into spots, a black crust on the joints.
import { lab, rgb } from "./lab.ts";

const look = {
  ratio: 0.2, // band spacing ratio p: each band (1+p)× further from the joint
  first: 0.014, // spacing scale of the first bands
  block: 1.05, // size of the joint blocks
  warp: 0.35, // how far the joints wander from planes
  wobble: 0.5, // band wander: lets neighbours merge and branch
  spots: 0.35, // share of bands that break into rows of spots
  sweep: 0.12, // the plane moves in and out by this much over the loop
  yaw: 34, // the cut faces the camera, turned by this much
  cream: "#eadfc8",
  ochre: "#c98a3a",
  orange: "#a8441a",
  dark: "#2a120a",
  key: 3.2,
  rim: 1.6,
  env: 0.35,
  gloss: 0.12, // roughness of the polished cut
  exposure: 1.0,
  seed: 2,
  res: 1,
};

lab({
  title: "rings",
  look,
  duration: 24_000,
  ranges: {
    ratio: [0.05, 0.6, 0.005],
    first: [0.004, 0.06, 0.001],
    block: [0.4, 3, 0.01],
    warp: [0, 1, 0.01],
    wobble: [0, 2, 0.01],
    spots: [0, 1, 0.01],
    sweep: [0, 0.5, 0.005],
    yaw: [-60, 60, 1],
    key: [0, 8, 0.05],
    rim: [0, 5, 0.05],
    env: [0, 2, 0.01],
    gloss: [0.02, 0.6, 0.01],
    exposure: [0.2, 3, 0.01],
    seed: [0, 50, 1],
    res: [0.25, 2, 0.05],
  },
  pack: (l) =>
    [
      ...[l.ratio, l.first, l.block, l.warp],
      ...[l.wobble, l.spots, l.sweep, l.yaw],
      ...rgb(l.cream as string),
      l.seed,
      ...rgb(l.ochre as string),
      l.key,
      ...rgb(l.orange as string),
      l.rim,
      ...rgb(l.dark as string),
      l.env,
      ...[l.gloss, l.exposure],
    ] as number[],
  wgsl: /* wgsl */ `
fn lab(px: vec2f, res: vec2f, t: f32, a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f, h: vec4f) -> vec4f {
  var P: rgP;
  P.ratio = a.x; P.first = a.y; P.block = a.z; P.warp = a.w;
  P.wobble = b.x; P.spots = b.y; P.seed = u32(c.w); P.env = f.w; P.gloss = g.x; P.exposure = g.y; P.key = d.w; P.rim = e.w;
  P.cream = c.xyz; P.ochre = d.xyz; P.orange = e.xyz; P.dark = f.xyz;
  let tau = 6.2831853;
  // turntable: one turn per loop; the plane breathes in and out once
  P.ang = tau * t;
  let yaw = radians(b.w);
  P.pn = normalize(vec3f(sin(yaw), 0.1, cos(yaw)));
  P.po = b.z * sin(tau * t) + 0.22;

  let ro = vec3f(0.0, 0.75, 4.3);
  let ta = vec3f(0.0, -0.08, 0.0);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = cross(rt, fw);
  let uv = (px - 0.5 * res) / res.y;
  let rd = normalize(fw + (uv.x * rt + uv.y * up) * 2.0 * tan(radians(17.0)));

  let keyL = normalize(vec3f(-0.55, 0.7, 0.45));
  let rimL = normalize(vec3f(0.75, 0.35, -0.6));
  // backdrop: a dark warm studio sweep
  var col = mix(vec3f(0.012, 0.010, 0.009), vec3f(0.05, 0.043, 0.036), smoothstep(-0.6, 0.5, uv.y)) * (1.0 - 0.4 * length(uv));

  // floor: dark velvet at y = -1, catching the stone's shadow
  var tmax = 12.0;
  let tf = (-1.0 - ro.y) / rd.y;
  if (rd.y < 0.0) { tmax = tf; }

  // march the stone
  var tt = 1.5;
  var hit = false;
  for (var i = 0; i < 140; i++) {
    let p = ro + rd * tt;
    let bound = length(p) - 1.35;
    var dd = bound;
    if (bound < 0.05) { dd = rgMap(p, P); }
    if (dd < 0.0006 * tt) { hit = true; break; }
    tt += dd;
    if (tt > tmax) { break; }
  }
  if (hit) {
    let p = ro + rd * tt;
    let cut = rgIsCut(p, P);
    var n = rgNormal(p, P);
    let q = rgToObj(p, P);
    var base = rgField(q, P);
    var rough = 0.85;
    if (cut) {
      n = P.pn;
      rough = P.gloss;
    } else {
      // weathered rind: the same bands, dulled under a limonite skin, pitted
      let bump = rgNoise(q * 38.0, P.seed + 3u) - 0.5;
      base = mix(base * 0.35, vec3f(0.13, 0.055, 0.02), 0.55 + 0.35 * bump);
      n = normalize(n + 0.25 * vec3f(rgNoise(q * 31.0, P.seed + 5u) - 0.5, rgNoise(q * 31.0 + 4.1, P.seed + 5u) - 0.5, rgNoise(q * 31.0 + 8.3, P.seed + 5u) - 0.5));
    }
    let v = -rd;
    let ao = rgAO(p, n, P);
    let sh = rgShadow(p + n * 0.002, keyL, P);
    var lit = base * (P.key * max(dot(n, keyL), 0.0) * sh * vec3f(1.0, 0.95, 0.88));
    lit += base * P.rim * max(dot(n, rimL), 0.0) * rgShadow(p + n * 0.002, rimL, P) * vec3f(0.7, 0.8, 1.0);
    lit += base * mix(vec3f(0.035, 0.03, 0.025), vec3f(0.11, 0.105, 0.1), 0.5 + 0.5 * n.y) * ao * 3.0 * P.env;
    // specular: GGX for the lights, a soft studio for reflections
    let fres = 0.04 + 0.96 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
    lit += P.key * rgGGX(n, v, keyL, rough) * sh * fres * vec3f(1.0, 0.95, 0.88);
    lit += P.rim * rgGGX(n, v, rimL, rough) * fres * vec3f(0.7, 0.8, 1.0);
    let rr = reflect(rd, n);
    lit += rgStudio(rr, keyL) * fres * ao * select(0.15, 1.0, cut);
    col = lit;
  } else if (rd.y < 0.0) {
    let p = ro + rd * tf;
    let sh = rgShadow(p + vec3f(0.0, 0.002, 0.0), keyL, P);
    let ao = rgAO(p, vec3f(0.0, 1.0, 0.0), P);
    let velvet = vec3f(0.03, 0.026, 0.022) * (0.25 + 0.75 * sh) * ao;
    let fade = exp(-0.12 * max(tf - 3.0, 0.0));
    col = mix(col, velvet * P.key * 0.5, fade);
  }
  return vec4f(col * P.exposure, 1.0);
}

struct rgP { key: f32, rim: f32, env: f32, gloss: f32, exposure: f32, ratio: f32, first: f32, block: f32, warp: f32, wobble: f32, spots: f32, seed: u32, ang: f32, pn: vec3f, po: f32, cream: vec3f, ochre: vec3f, orange: vec3f, dark: vec3f }

fn rgHashU(x: u32) -> u32 {
  let v = x * 747796405u + 2891336453u;
  let w = ((v >> ((v >> 28u) + 4u)) ^ v) * 277803737u;
  return (w >> 22u) ^ w;
}
fn rgHash(c: vec3i, s: u32) -> vec4f {
  let k = rgHashU((bitcast<u32>(c.x) * 1597334677u) ^ rgHashU((bitcast<u32>(c.y) * 3812015801u) ^ rgHashU(bitcast<u32>(c.z) ^ (s * 2654435761u))));
  return vec4f(f32(k), f32(rgHashU(k)), f32(rgHashU(k ^ 0x9e3779b9u)), f32(rgHashU(k + 0x7f4a7c15u))) / 4294967295.0;
}
fn rgNoise(p: vec3f, s: u32) -> f32 {
  let i = vec3i(floor(p));
  let fr = fract(p);
  let u = fr * fr * (3.0 - 2.0 * fr);
  let a = mix(mix(rgHash(i, s).x, rgHash(i + vec3i(1, 0, 0), s).x, u.x), mix(rgHash(i + vec3i(0, 1, 0), s).x, rgHash(i + vec3i(1, 1, 0), s).x, u.x), u.y);
  let b = mix(mix(rgHash(i + vec3i(0, 0, 1), s).x, rgHash(i + vec3i(1, 0, 1), s).x, u.x), mix(rgHash(i + vec3i(0, 1, 1), s).x, rgHash(i + vec3i(1, 1, 1), s).x, u.x), u.y);
  return mix(a, b, u.z);
}

fn rgToObj(p: vec3f, P: rgP) -> vec3f {
  let c = cos(P.ang);
  let s = sin(P.ang);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
fn rgSmax(a: f32, b: f32, k: f32) -> f32 {
  let h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}
// the stone: an ellipsoid knocked flat on a few joint faces, then weathered
fn rgStone(q: vec3f, P: rgP) -> f32 {
  let R = vec3f(1.05, 0.78, 0.86);
  let k0 = length(q / R);
  var dd = (k0 - 1.0) * k0 / length(q / (R * R));
  dd = rgSmax(dd, dot(q, normalize(vec3f(0.3, -1.0, 0.15))) - 0.62, 0.12);
  dd = rgSmax(dd, dot(q, normalize(vec3f(1.0, 0.25, -0.2))) - 0.86, 0.14);
  dd = rgSmax(dd, dot(q, normalize(vec3f(-0.6, 0.55, -0.7))) - 0.7, 0.16);
  dd += 0.06 * (rgNoise(q * 1.7, P.seed + 11u) - 0.5) + 0.018 * (rgNoise(q * 5.0, P.seed + 12u) - 0.5);
  return dd * 0.85;
}
fn rgMap(p: vec3f, P: rgP) -> f32 {
  return max(rgStone(rgToObj(p, P), P), dot(p, P.pn) - P.po);
}
fn rgIsCut(p: vec3f, P: rgP) -> bool {
  return dot(p, P.pn) - P.po > rgStone(rgToObj(p, P), P);
}
fn rgNormal(p: vec3f, P: rgP) -> vec3f {
  let h = 0.0015;
  let k = vec2f(1.0, -1.0);
  return normalize(k.xyy * rgMap(p + k.xyy * h, P) + k.yyx * rgMap(p + k.yyx * h, P) + k.yxy * rgMap(p + k.yxy * h, P) + k.xxx * rgMap(p + k.xxx * h, P));
}
fn rgShadow(p: vec3f, l: vec3f, P: rgP) -> f32 {
  var res = 1.0;
  var tt = 0.01;
  for (var i = 0; i < 40; i++) {
    let h = rgMap(p + l * tt, P);
    res = min(res, 10.0 * h / tt);
    tt += clamp(h, 0.01, 0.2);
    if (res < 0.001 || tt > 4.0) { break; }
  }
  return clamp(res, 0.0, 1.0);
}
fn rgAO(p: vec3f, n: vec3f, P: rgP) -> f32 {
  var occ = 0.0;
  var w = 1.0;
  for (var i = 1; i <= 5; i++) {
    let h = 0.03 * f32(i * i);
    occ += w * (h - min(rgMap(p + n * h, P), p.y + 1.0 + n.y * h));
    w *= 0.6;
  }
  return clamp(1.0 - 1.8 * occ, 0.0, 1.0);
}
fn rgGGX(n: vec3f, v: vec3f, l: vec3f, r: f32) -> f32 {
  let h = normalize(v + l);
  let nh = max(dot(n, h), 0.0);
  let nl = max(dot(n, l), 0.0);
  let a2 = r * r * r * r;
  let dn = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dn * dn) * nl * 0.25;
}
// a dim studio: one big softbox in the key direction, a strip light behind on the right
fn rgStudio(r: vec3f, keyL: vec3f) -> vec3f {
  var c = mix(vec3f(0.01), vec3f(0.06, 0.055, 0.05), smoothstep(-0.2, 0.6, r.y));
  c += vec3f(2.2, 2.1, 1.9) * smoothstep(0.86, 0.92, dot(r, keyL));
  // a tall softbox off to the right: the polished cut catches its edge
  c += vec3f(5.0, 4.9, 4.6) * smoothstep(0.978, 0.988, dot(r, normalize(vec3f(0.95, 0.3, 0.35))));
  c += vec3f(0.6, 0.7, 0.9) * smoothstep(0.08, 0.04, abs(r.x - 0.75)) * smoothstep(-0.1, 0.2, r.y) * smoothstep(0.0, -0.3, r.z);
  return c;
}

// the bands: distance inside a joint block (soft so fronts round off into the corners), spaced geometrically
fn rgField(q: vec3f, P: rgP) -> vec3f {
  let wv = vec3f(rgNoise(q * 1.3, P.seed + 21u), rgNoise(q * 1.3 + 5.2, P.seed + 21u), rgNoise(q * 1.3 + 9.7, P.seed + 21u)) - 0.5;
  let qw = q + P.warp * wv;
  let x = qw / P.block;
  let base = vec3i(floor(x));
  var best = 1e9;
  var ac = base;
  var asd = vec3f(0.0);
  for (var k = -1; k <= 1; k++) {
    for (var j = -1; j <= 1; j++) {
      for (var i = -1; i <= 1; i++) {
        let cl = base + vec3i(i, j, k);
        let sp = vec3f(cl) + 0.15 + 0.7 * rgHash(cl, P.seed).xyz;
        let dd = dot(x - sp, x - sp);
        if (dd < best) { best = dd; ac = cl; asd = sp; }
      }
    }
  }
  var dh = 1e9;
  for (var k = -1; k <= 1; k++) {
    for (var j = -1; j <= 1; j++) {
      for (var i = -1; i <= 1; i++) {
        if (i == 0 && j == 0 && k == 0) { continue; }
        let cl = ac + vec3i(i, j, k);
        let sp = vec3f(cl) + 0.15 + 0.7 * rgHash(cl, P.seed).xyz;
        dh = min(dh, dot(0.5 * (asd + sp) - x, normalize(sp - asd)));
      }
    }
  }
  // soft min of the faces: fronts round off more the further in they are
  let ks = 0.02 + 0.35 * dh;
  var sum = 0.0;
  for (var k = -1; k <= 1; k++) {
    for (var j = -1; j <= 1; j++) {
      for (var i = -1; i <= 1; i++) {
        if (i == 0 && j == 0 && k == 0) { continue; }
        let cl = ac + vec3i(i, j, k);
        let sp = vec3f(cl) + 0.15 + 0.7 * rgHash(cl, P.seed).xyz;
        let di = dot(0.5 * (asd + sp) - x, normalize(sp - asd));
        sum += exp(-(di - dh) / ks);
      }
    }
  }
  let dist = max(dh - ks * log(sum), 0.0) * P.block;
  let dj = dh * P.block;

  // sandstone: cream, stained warmer near the joints
  var col = mix(P.cream, mix(P.cream, P.orange, 0.5), exp(-dist / 0.08));
  // bands
  let lr = log(1.0 + P.ratio);
  var u = log(1.0 + dist / P.first) / lr;
  u += P.wobble * (rgNoise(q * 5.0, P.seed + 31u) - 0.5) * (0.4 + 0.6 * smoothstep(0.0, 8.0, u));
  let nb = floor(u);
  let fb = fract(u);
  let hb = rgHash(vec3i(i32(nb), ac.x * 7 + ac.y * 3, ac.z), P.seed + 41u);
  let w = 0.35 + 0.55 * hb.x;
  var band = pow(smoothstep(1.0 - w, 0.97, fb), 1.6) * smoothstep(1.0, 0.975, fb);
  var strength = 0.35 + 0.65 * smoothstep(0.05, 0.25, hb.y);
  // some bands break into rows of spots
  if (hb.z < P.spots) {
    strength *= smoothstep(0.42, 0.58, rgNoise(q * 16.0 + nb * 3.7, P.seed + 51u));
  }
  // and every band thins out here and there
  strength *= smoothstep(0.15, 0.45, rgNoise(q * 2.6 + nb * 1.3, P.seed + 61u));
  // deep in the block the bands give out
  strength *= 0.25 + 0.75 * smoothstep(0.75, 0.35, dist);
  var bc = P.ochre;
  if (hb.w > 0.35) { bc = P.orange; }
  if (hb.w > 0.8) {
    // goethite: thin, sharp, nearly black
    bc = P.dark;
    band = smoothstep(0.9 - 0.1 * hb.x, 0.97, fb) * smoothstep(1.0, 0.975, fb);
    strength = max(strength, 0.6) * step(0.3, strength);
  }
  col = mix(col, bc, band * strength);
  // a dark rim on the sharp side of the strong bands
  let rim = smoothstep(0.93, 0.97, fb) * smoothstep(1.0, 0.975, fb) * step(0.5, hb.y) * strength;
  col = mix(col, P.dark, 0.6 * rim);
  // the joint itself: iron crust
  col = mix(col, P.dark, 0.85 * smoothstep(0.005, 0.0015, dj));
  // grains
  let g1 = rgNoise(q * 160.0, P.seed + 71u);
  col *= 0.93 + 0.14 * g1;
  col *= 1.0 - 0.3 * smoothstep(0.86, 0.93, rgNoise(q * 230.0, P.seed + 72u));
  return col;
}
`,
});
