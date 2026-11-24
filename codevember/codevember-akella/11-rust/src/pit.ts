// Idea 2: an endless descent into a corrosion pit. A scratched steel plate with a rust spot; the spot is the
// mouth of an undercut pit with porous walls, and the pit's floor is the same plate again, `scale` times smaller
// and turned by `twist`. The camera falls towards the fixed point of that similarity, so after one loop it sees
// exactly what it saw at the start, one level down. Light comes down the shaft of mouths from far above.
import { lab, rgb } from "./lab.ts";

const look = {
  scale: 0.3, // each floor is this much smaller
  twist: 50, // and turned by this many degrees
  depth: 0.55, // pit depth, in plate units
  mouth: 0.26, // mouth radius
  cavity: 0.62, // undercut radius
  ragged: 0.35, // mouth raggedness
  pores: 0.55, // how holed the walls are
  rustReach: 0.45, // radius of the rust spot round the mouth
  steel: "#8d9096",
  rust: "#b4501c",
  rustDark: "#3a1708",
  key: 3.5,
  fill: 1.6, // a lamp on the camera
  sky: 0.25,
  fog: 0.5,
  exposure: 1.1,
  seed: 1,
  res: 1,
};

lab({
  title: "pit",
  look,
  duration: 12_000,
  ranges: {
    scale: [0.15, 0.5, 0.005],
    twist: [-180, 180, 1],
    depth: [0.2, 1.2, 0.01],
    mouth: [0.08, 0.5, 0.005],
    cavity: [0.2, 1, 0.005],
    ragged: [0, 1, 0.01],
    pores: [0, 1.2, 0.01],
    rustReach: [0.2, 2, 0.01],
    key: [0, 10, 0.05],
    fill: [0, 4, 0.01],
    sky: [0, 2, 0.01],
    fog: [0, 3, 0.01],
    exposure: [0.2, 3, 0.01],
    seed: [0, 50, 1],
    res: [0.25, 2, 0.05],
  },
  pack: (l) =>
    [
      ...[l.scale, l.twist, l.depth, l.mouth],
      ...[l.cavity, l.ragged, l.pores, l.rustReach],
      ...rgb(l.steel as string),
      l.seed,
      ...rgb(l.rust as string),
      l.key,
      ...rgb(l.rustDark as string),
      l.fill,
      ...[l.sky, l.fog, l.exposure],
    ] as number[],
  wgsl: /* wgsl */ `
fn lab(px: vec2f, res: vec2f, t: f32, a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f, h: vec4f) -> vec4f {
  var P: ptP;
  P.s = a.x; P.tw = radians(a.y); P.D = a.z; P.R = a.w;
  P.Rc = b.x; P.rag = b.y; P.por = b.z; P.reach = b.w;
  P.seed = u32(c.w); P.steel = c.xyz; P.rust = d.xyz; P.rustDark = e.xyz;
  P.F = vec3f(0.0, -P.D / (1.0 - P.s), 0.0);
  P.ls = log(P.s);

  // the camera falls towards F: one level per loop
  let cs = pow(P.s, t);
  let P0 = vec3f(0.55, 1.6, 0.15);
  let ro = P.F + cs * ptRotY(P0 - P.F, P.tw * t);
  let ta = P.F + cs * ptRotY(vec3f(0.08, -0.25, -0.1) - P.F, P.tw * t);
  let fw = normalize(ta - ro);
  let rt = normalize(cross(fw, vec3f(0.0, 1.0, 0.0)));
  let up = normalize(cross(rt, fw));
  let uv = (px - 0.5 * res) / res.y;
  let rd = normalize(fw + (uv.x * rt + uv.y * up) * 2.0 * tan(radians(32.0)));

  // the light turns with the twist, so after one loop the whole scene has turned rigidly by exactly one level
  let keyL = ptRotY(normalize(vec3f(0.22, 1.0, 0.12)), P.tw * t);
  let fogC = vec3f(0.035, 0.022, 0.016);
  var col = fogC;
  var tt = 0.0;
  var hit = false;
  let tmax = 25.0 * cs;
  for (var i = 0; i < 200; i++) {
    let p = ro + rd * tt;
    let dd = ptMap(p, P);
    if (dd < 0.0007 * tt + 1e-6 * cs) { hit = true; break; }
    tt += dd * 0.8;
    if (tt > tmax) { break; }
  }
  if (hit) {
    let p = ro + rd * tt;
    let sc = ptScaleAt(p, P);
    let n = ptNormal(p, max(0.0006 * tt, 1e-5), P);
    let m = ptMaterial(p, P);
    let v = -rd;
    let sh = ptShadow(p + n * 0.004 * sc, keyL, sc, P);
    let ao = ptAO(p, n, sc, P);
    let albedo = m.albedo;
    // key down the shaft
    var lit = albedo * d.w * max(dot(n, keyL), 0.0) * sh * vec3f(1.0, 0.93, 0.82);
    let fres = mix(vec3f(0.04), m.f0, m.metal);
    lit += d.w * ptGGX(n, v, keyL, m.rough) * sh * fres * vec3f(1.0, 0.93, 0.82);
    // lamp on the camera, falling off with distance in units of the camera's own scale
    let fl = e.w / (1.0 + (tt / cs) * (tt / cs) * 1.2);
    lit += (albedo * max(dot(n, v), 0.0) + ptGGX(n, v, v, m.rough) * fres) * fl * vec3f(1.0, 0.85, 0.7);
    // sky and rust bounce
    lit += albedo * mix(vec3f(0.25, 0.1, 0.04), vec3f(0.6, 0.62, 0.7), 0.5 + 0.5 * n.y) * f.x * ao * (0.3 + 0.7 * sh);
    // light bounced off the lit floor below warms the walls and the undersides
    lit += albedo * P.rust * d.w * 0.18 * (0.25 + 0.75 * max(-n.y, 0.0)) * ao;
    let fogA = exp(-f.y * tt / cs * 0.35);
    col = mix(fogC, lit, fogA);
  }
  return vec4f(col * f.z, 1.0);
}

struct ptP { steel: vec3f, rust: vec3f, rustDark: vec3f, s: f32, tw: f32, D: f32, R: f32, Rc: f32, rag: f32, por: f32, reach: f32, seed: u32, F: vec3f, ls: f32 }
struct ptMat { albedo: vec3f, f0: vec3f, metal: f32, rough: f32 }

fn ptRotY(p: vec3f, an: f32) -> vec3f {
  let c = cos(an);
  let s = sin(an);
  return vec3f(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
fn ptNoise(p: vec3f, s: u32) -> f32 {
  let i = floor(p);
  let fr = fract(p);
  let u = fr * fr * (3.0 - 2.0 * fr);
  let sf = f32(s);
  // corner values: z = i.z in one vec4 (x0y0, x1y0, x0y1, x1y1), z + 1 in the other
  let k = vec4f(0.0, 1.0, 0.0, 1.0);
  let j = vec4f(0.0, 0.0, 1.0, 1.0);
  let a = ptHashV(i.x + k, i.y + j, vec4f(i.z), sf);
  let b = ptHashV(i.x + k, i.y + j, vec4f(i.z + 1.0), sf);
  let z = mix(a, b, u.z);
  return mix(mix(z.x, z.y, u.x), mix(z.z, z.w, u.x), u.y);
}
fn ptHashV(x: vec4f, y: vec4f, z: vec4f, s: f32) -> vec4f {
  var h = x * 127.1 + y * 311.7 + z * 74.7 + s * 17.31;
  h = fract(sin(h) * 43758.5453);
  return h;
}

// level k's own coordinates: the plate at y = 0, its pit round the y axis
fn ptLocal(p: vec3f, k: i32, P: ptP) -> vec3f {
  return ptRotY((p - P.F) / pow(P.s, f32(k)), -P.tw * f32(k)) + P.F;
}
// continuous level of a point: k on plate k
fn ptLevel(p: vec3f, P: ptP) -> f32 {
  return log(max((p.y - P.F.y) / -P.F.y, 1e-6)) / P.ls;
}
fn ptScaleAt(p: vec3f, P: ptP) -> f32 {
  return pow(P.s, ptLevel(p, P));
}
// the plate, with the rust crust heaped up round the mouth
fn ptPlate(q: vec3f, P: ptP) -> f32 {
  if (abs(q.y) > 0.07) { return q.y * 0.9 - 0.02; }
  let rr = length(q.xz);
  if (rr > P.reach * 1.2) { return q.y * 0.9; }
  let spot = smoothstep(P.reach, P.reach * 0.35, rr + 0.25 * P.reach * (ptNoise(q * 3.0, P.seed + 1u) - 0.5));
  let crust = spot * (0.012 + 0.03 * ptNoise(q * 14.0, P.seed + 2u) + 0.012 * ptNoise(q * 40.0, P.seed + 3u)) * smoothstep(P.R * 0.8, P.R * 1.6, rr);
  return (q.y - crust) * 0.9;
}
// the column the pit eats out of the plate: ragged mouth, undercut below
fn ptColumn(q: vec3f, P: ptP) -> f32 {
  let rr = length(q.xz);
  if (rr > P.Rc * 1.5 + 0.1) { return (rr - P.Rc * 1.3) * 0.7; }
  let rag = 1.0 + P.rag * (ptNoise(q * 5.0, P.seed + 4u) - 0.5) * 1.4;
  let rad = mix(P.R * rag, P.Rc * (0.9 + 0.2 * ptNoise(q * 2.5, P.seed + 5u)), smoothstep(-0.02, -0.28, q.y));
  return (rr - rad) * 0.7;
}
// what stays of level k outside its column, with pores eaten into the walls
fn ptSolid(q: vec3f, c: f32, P: ptP) -> f32 {
  var dd = max(ptPlate(q, P), -c);
  if (abs(c - 0.035) > 0.09 || q.y > 0.02) { return dd; }
  let pn = ptNoise(q * 9.0, P.seed + 6u) * 0.65 + ptNoise(q * 21.0, P.seed + 7u) * 0.35;
  let pore = max((0.78 - 0.45 * P.por - pn) * 0.09, abs(c - 0.035) - 0.06);
  dd = max(dd, -max(pore, q.y));
  return dd;
}
fn ptMap(p: vec3f, P: ptP) -> f32 {
  // coarse to fine: stop once the point is well outside a level's column
  let k0 = i32(floor(ptLevel(p, P))) - 1;
  var A: array<f32, 6>;
  var C: array<f32, 6>;
  var last = 5;
  for (var j = 0; j < 6; j++) {
    let k = k0 + j;
    let sk = pow(P.s, f32(k));
    let q = ptLocal(p, k, P);
    let c = ptColumn(q, P);
    C[j] = c * sk;
    if (j == 5) { A[j] = ptPlate(q, P) * sk; break; }
    A[j] = ptSolid(q, c, P) * sk;
    if (c > 0.08) { last = j; break; }
  }
  var S = 1e9;
  // past the last level evaluated, its column interior is only bounded by the column itself
  if (last == 5) { S = A[5]; } else { S = min(A[last], C[last]); }
  for (var j = last - 1; j >= 0; j--) {
    S = min(A[j], max(C[j], S));
  }
  return S;
}
fn ptNormal(p: vec3f, h: f32, P: ptP) -> vec3f {
  let k = vec2f(1.0, -1.0);
  return normalize(k.xyy * ptMap(p + k.xyy * h, P) + k.yyx * ptMap(p + k.yyx * h, P) + k.yxy * ptMap(p + k.yxy * h, P) + k.xxx * ptMap(p + k.xxx * h, P));
}
fn ptShadow(p: vec3f, l: vec3f, sc: f32, P: ptP) -> f32 {
  var res = 1.0;
  var tt = 0.004 * sc;
  for (var i = 0; i < 56; i++) {
    let h = ptMap(p + l * tt, P);
    res = min(res, 8.0 * h / tt);
    tt += clamp(h, 0.004 * sc, 0.25 * sc / P.s);
    if (res < 0.001) { break; }
  }
  return clamp(res, 0.0, 1.0);
}
fn ptAO(p: vec3f, n: vec3f, sc: f32, P: ptP) -> f32 {
  var occ = 0.0;
  var w = 1.0;
  for (var i = 1; i <= 5; i++) {
    let hh = 0.025 * sc * f32(i * i);
    occ += w * (hh - ptMap(p + n * hh, P)) / sc;
    w *= 0.6;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}
fn ptGGX(n: vec3f, v: vec3f, l: vec3f, r: f32) -> f32 {
  let h = normalize(v + l);
  let nh = max(dot(n, h), 0.0);
  let nl = max(dot(n, l), 0.0);
  let a2 = r * r * r * r;
  let dn = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (3.14159 * dn * dn) * nl * 0.25;
}
fn ptMaterial(p: vec3f, P: ptP) -> ptMat {
  let lv = ptLevel(p, P);
  let kr = round(lv);
  var m: ptMat;
  if (abs(lv - kr) < 0.07) {
    // a plate: scratched steel, rust round the mouth
    let q = ptLocal(p, i32(kr), P);
    let rr = length(q.xz);
    let scr = ptNoise(vec3f(q.x * 3.0, q.z * 260.0, 0.5), P.seed + 8u);
    let scr2 = ptNoise(vec3f(q.x * 180.0 + q.z * 120.0, 1.5, q.x * 2.0), P.seed + 9u);
    let spot = smoothstep(P.reach, P.reach * 0.35, rr + 0.25 * P.reach * (ptNoise(q * 3.0, P.seed + 1u) - 0.5));
    let stain = smoothstep(P.reach * 1.5, P.reach * 0.6, rr + 0.4 * P.reach * (ptNoise(q * 6.0, P.seed + 10u) - 0.5));
    let rn = ptNoise(q * 26.0, P.seed + 11u) * 0.6 + ptNoise(q * 70.0, P.seed + 13u) * 0.4;
    m.albedo = P.steel * (0.8 + 0.25 * scr);
    m.f0 = P.steel * (0.85 + 0.2 * scr);
    m.metal = 1.0;
    m.rough = 0.22 + 0.25 * scr + 0.2 * smoothstep(0.7, 0.9, scr2);
    let rc = mix(P.rustDark, P.rust, smoothstep(0.25, 0.8, rn));
    let rm = max(spot * smoothstep(0.2, 0.5, rn + 0.4 * spot), stain * 0.45);
    m.albedo = mix(m.albedo * 0.35, rc, rm);
    m.metal = mix(1.0, 0.0, rm);
    m.rough = mix(m.rough, 0.9, rm);
  } else {
    // walls: dark magnetite with orange hydrated skins
    let k = i32(floor(lv));
    let q = ptLocal(p, k, P);
    let rn = ptNoise(q * 22.0, P.seed + 12u);
    let deep = smoothstep(0.0, -P.D, q.y);
    m.albedo = mix(P.rust, P.rustDark * 0.6, clamp(deep * 0.8 + 0.5 * rn - 0.2, 0.0, 1.0));
    m.f0 = vec3f(0.04);
    m.metal = 0.0;
    m.rough = 0.7 - 0.3 * smoothstep(0.75, 0.9, rn);
  }
  return m;
}
`,
});
