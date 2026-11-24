import "../lib/modulepreload-polyfill.js";
import { s as Pe, a as Ee, b as he } from "../lib/studio-presets.js";
import "../lib/three.js";
import {
  c as Re,
  r as W,
  L as Ge,
  V as a,
  e as T,
  u as qe,
  aF as Fe,
  Q as Oe,
  b3 as Te,
} from "../lib/leva.js";
import { c as Ve, l as Ue } from "../lib/look.js";
const Be = `struct Scene {
  frame: vec4f,       // viewport width, height, time, focal length
  eye: vec4f,         // camera origin, index of refraction
  forward: vec4f,     // camera forward, thin-film strength
  right: vec4f,       // camera right, absorption strength
  up: vec4f,          // camera up, bubble visibility
  grab: vec4f,        // contact point, pulse strength
  stretch: vec4f,     // displacement, softness
  cool: vec4f,
  warm: vec4f,
  lobes: array<vec4f, 5>,
  air: array<vec4f, 20>,
  key: vec4f,
  keyColor: vec4f,
  sweep: vec4f,
}

@group(0) @binding(0) var<uniform> scene: Scene;
@group(0) @binding(1) var<uniform> look: Look;

const PI = 3.14159265;
const FLOOR = -1.48;


@vertex fn vertexMain(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let uv = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(uv * 2.0 - 1.0, 0.0, 1.0);
}

fn hash(p: vec2f) -> f32 {
  return fract(52.9829189 * fract(dot(p, vec2f(0.06711056, 0.00583715))));
}

fn softUnion(a: f32, b: f32, k: f32) -> f32 {
  let h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

fn unstretch(p: vec3f) -> vec3f {
  if (dot(scene.stretch.xyz, scene.stretch.xyz) < 0.0000001) { return p; }
  let relative = p - scene.grab.xyz - scene.stretch.xyz * 0.48;
  let influence = exp(-dot(relative, relative) * 1.12);
  return p - scene.stretch.xyz * influence * 0.72;
}

fn field(point: vec3f) -> f32 {
  let p = unstretch(point);
  let k = mix(0.26, 0.57, scene.stretch.w);
  var distance = 5.0;
  for (var i = 0u; i < 5u; i++) {
    let lobe = scene.lobes[i];
    let relative = (p - lobe.xyz) * vec3f(1.0, 1.0, 1.08);
    distance = softUnion(distance, length(relative) - lobe.w, k);
  }
  if (scene.grab.w > 0.001) {
    let ripple = length(p - scene.grab.xyz);
    distance += scene.grab.w * 0.066 * cos(ripple * 6.1 + scene.grab.w * 5.0) * exp(-ripple * 1.25);
  }
  return distance + 0.008 * sin(5.8 * p.x - 4.1 * p.y + 3.5 * p.z + scene.frame.z);
}

fn normalAt(p: vec3f) -> vec3f {
  let a = vec3f(1.0, -1.0, -1.0);
  let b = vec3f(-1.0, -1.0, 1.0);
  let c = vec3f(-1.0, 1.0, -1.0);
  let d = vec3f(1.0, 1.0, 1.0);
  return normalize(a * field(p + 0.002 * a) + b * field(p + 0.002 * b)
    + c * field(p + 0.002 * c) + d * field(p + 0.002 * d));
}

fn sphereHit(origin: vec3f, direction: vec3f, radius: f32) -> vec2f {
  let along = dot(origin, direction);
  let discriminant = along * along - dot(origin, origin) + radius * radius;
  if (discriminant < 0.0) { return vec2f(-1.0); }
  let offset = sqrt(discriminant);
  return vec2f(-along - offset, -along + offset);
}

fn entryDistance(origin: vec3f, direction: vec3f, limit: f32) -> f32 {
  let bound = sphereHit(origin, direction, 3.0);
  let far = min(bound.y, limit);
  var t = max(bound.x, 0.0);
  for (var i = 0; i < 76 && t < far; i++) {
    let d = field(origin + direction * t);
    if (d < 0.0017) { return t; }
    t += d * 0.75;
  }
  return -1.0;
}

fn gelThickness(origin: vec3f, direction: vec3f) -> f32 {
  var t = 0.008;
  for (var i = 0; i < 56; i++) {
    let d = field(origin + direction * t);
    if (d > -0.0014 && t > 0.012) { break; }
    t += clamp(-d * 0.77, 0.003, 0.38);
  }
  return t;
}

fn paper(uv: vec2f) -> vec3f {
  let glow = exp(-dot(uv - vec2f(-0.21, 0.12), uv - vec2f(-0.21, 0.12)) * 1.8);
  let edge = smoothstep(0.08, 1.4, length(uv * vec2f(0.70, 1.0)));
  return mix(vec3f(0.81, 0.88, 0.90), vec3f(0.978, 0.987, 0.958), 0.58 + glow * 0.37)
    - edge * vec3f(0.042, 0.045, 0.039);
}

// Each lobe projects a broad penumbra and a narrower pool of tinted light.
fn backdrop(origin: vec3f, direction: vec3f, uv: vec2f) -> vec3f {
  let base = paper(uv) * mix(vec3f(1.0), sqrt(scene.sweep.rgb), scene.sweep.w * 0.65);
  let t = (FLOOR - origin.y) / min(direction.y, -0.0001);
  if (t > 24.0 || t <= 0.0) { return base; }
  let hit = origin + t * direction;
  var shadow = 0.0;
  var spill = vec3f(0.0);
  var caustic = vec3f(0.0);
  for (var i = 0u; i < 5u; i++) {
    let lobe = scene.lobes[i];
    let height = lobe.y - FLOOR;
    let drift = scene.stretch.xz * exp(-dot(lobe.xyz - scene.grab.xyz, lobe.xyz - scene.grab.xyz));
    let projection = lobe.xz - scene.key.xz * height * 0.69 / scene.key.y + drift * 0.50;
    let delta = (hit.xz - projection) * vec2f(0.92, 1.13);
    let r = length(delta) / (lobe.w + 0.17 * height * scene.key.w);
    shadow += exp(-r * r * 1.52) * 0.28;
    let tint = mix(scene.cool.rgb, scene.warm.rgb, f32(i) * 0.22);
    spill += tint * exp(-r * r * 2.5) * 0.092;
    let crescent = length(delta + vec2f(0.09, -0.10)) / lobe.w;
    let arc = (vec3f(crescent) - vec3f(0.69, 0.66, 0.63)) * 8.2;
    caustic += exp(-arc * arc) * smoothstep(-0.25, 0.48, delta.x) * (0.028 + tint * 0.034);
  }
  let gradient = exp(-dot(hit.xz, hit.xz) * 0.10) * 0.033;
  return base * exp(-shadow * 0.66) + spill * scene.right.w + caustic + gradient;
}

fn softbox(r: vec3f, aim: vec3f, size: vec2f, feather: f32) -> f32 {
  let x = normalize(cross(aim, vec3f(0.0, 1.0, 0.0)));
  let y = normalize(cross(x, aim));
  let v = abs(vec2f(dot(r, x), dot(r, y)));
  return (1.0 - smoothstep(size.x, size.x + feather, v.x))
    * (1.0 - smoothstep(size.y, size.y + feather, v.y))
    * smoothstep(0.35, 0.70, dot(r, aim));
}

fn studio(r: vec3f) -> vec3f {
  let keyAim = normalize(mix(vec3f(-0.51, 0.63, 0.59), scene.key.xyz, scene.sweep.w));
  let edgeAim = normalize(vec3f(0.82, 0.35, -0.46));
  let stripAim = normalize(vec3f(0.61, -0.19, 0.76));
  let key = softbox(r, keyAim, vec2f(0.30, 0.12) * scene.key.w, 0.12);
  let edge = softbox(r, edgeAim, vec2f(0.082, 0.47), 0.085);
  let strip = softbox(r, stripAim, vec2f(0.052, 0.25), 0.061);
  let ceiling = smoothstep(-0.45, 0.94, r.y);
  let broad = pow(max(0.0, dot(r, keyAim)), 10.0);
  return mix(vec3f(0.15, 0.27, 0.35), vec3f(0.94, 0.98, 1.0), ceiling)
    + scene.keyColor.rgb * scene.keyColor.w * (key * 5.1 + broad * 1.2)
    + vec3f(0.66, 0.84, 1.0) * edge * 1.65
    + vec3f(0.81, 1.0, 0.91) * strip * 0.87;
}

fn spectralFilm(facing: f32, p: vec3f) -> vec3f {
  let thickness = 0.92 + 0.16 * sin(p.x * 1.8 + p.y * 1.9 - p.z)
    + 0.08 * sin(p.y * 5.4 - p.x * 2.3 + scene.frame.z * 0.55);
  let phase = (thickness * (0.57 + 0.62 * facing)) * vec3f(1.44, 1.82, 2.15);
  return 0.51 + 0.49 * cos(2.0 * PI * (phase + vec3f(0.08, 0.19, 0.39)));
}

// Air inclusions reflect at their curved rims and shorten the path through gel.
fn bubbles(origin: vec3f, direction: vec3f, path: f32, tint: vec3f) -> vec4f {
  let localStart = unstretch(origin);
  let localEnd = unstretch(origin + direction * path);
  let localRay = normalize(localEnd - localStart);
  let localPath = length(localEnd - localStart);
  var nearest = localPath;
  var result = vec4f(0.0);
  for (var i = 0u; i < 20u; i++) {
    let bubble = scene.air[i];
    let hits = sphereHit(localStart - bubble.xyz, localRay, bubble.w);
    if (hits.x > 0.005 && hits.x < nearest && hits.y < localPath) {
      nearest = hits.x;
      let n = normalize(localStart + localRay * hits.x - bubble.xyz);
      let reflected = reflect(localRay, n);
      let facing = clamp(dot(-localRay, n), 0.0, 1.0);
      let rim = pow(1.0 - facing, 2.0);
      let glint = pow(max(dot(reflected, scene.key.xyz), 0.0), 17.0);
      let ring = smoothstep(0.21, 0.55, facing) * (1.0 - smoothstep(0.52, 0.82, facing));
      let light = (vec3f(0.90, 0.98, 1.0) * (0.64 * glint + rim * 0.33)
        - (vec3f(0.18) + (1.0 - tint) * 0.15) * ring) * exp(-hits.x * 0.70);
      result = vec4f(light, hits.y - hits.x);
    }
  }
  return result;
}

fn shadeGel(origin: vec3f, ray: vec3f, entry: f32, uv: vec2f) -> vec3f {
  let surface = origin + ray * entry;
  let n = normalAt(surface);
  let facing = clamp(dot(-ray, n), 0.0, 1.0);
  let ior = scene.eye.w;
  let inside = refract(ray, n, 1.0 / ior);
  let thickness = gelThickness(surface, inside);
  let exit = surface + inside * thickness;
  let exitNormal = normalAt(exit);
  let outgoing = refract(inside, -exitNormal, ior);
  let local = unstretch(surface + inside * thickness * 0.37);
  let blend = clamp(0.50 + 0.36 * local.x - 0.22 * local.y + 0.13 * sin(local.x * 2.4 - local.y * 3.0 - scene.frame.z * 0.8), 0.0, 1.0);
  let tint = mix(scene.cool.rgb, scene.warm.rgb, blend);
  var inclusion = vec4f(0.0);
  if (scene.up.w > 0.5 && thickness > 0.08) { inclusion = bubbles(surface, inside, thickness, tint); }

  let absorption = (1.0 - tint) * vec3f(0.99, 1.21, 0.98) + vec3f(0.04);
  let transmission = exp(-absorption * max(0.0, thickness - inclusion.w) * scene.right.w * 1.52);
  let bend = (inside.xy - ray.xy) * thickness;
  let refractedPaper = vec3f(paper(uv + bend * 0.56).r, paper(uv + bend * 0.61).g, paper(uv + bend * 0.67).b);
  let reflectedLight = mix(refractedPaper, studio(reflect(inside, -exitNormal)), 0.30);
  var transmittedLight = reflectedLight;
  if (dot(outgoing, outgoing) > 0.01) {
    let edgeLight = smoothstep(-0.70, 0.57, outgoing.y);
    let exitGlint = softbox(outgoing, normalize(vec3f(0.14, 0.58, -0.80)), vec2f(0.43, 0.09), 0.12);
    let exitLight = mix(refractedPaper * (0.68 + 0.36 * edgeLight), backdrop(exit, outgoing, uv + bend * 0.6), 0.39)
      + vec3f(0.84, 0.98, 1.0) * exitGlint * 0.38;
    let exitCos = dot(outgoing, exitNormal);
    transmittedLight = mix(reflectedLight, exitLight, smoothstep(0.0, 0.36, exitCos));
  }

  let internalGlow = pow(max(dot(inside, -scene.key.xyz), 0.0), 3.0) * 0.20 + 0.12 + exp(-thickness * 1.7) * 0.11;
  var body = transmittedLight * transmission + tint * (1.0 - transmission) * internalGlow;
  body += inclusion.rgb;

  let reflectance = pow((ior - 1.0) / (ior + 1.0), 2.0);
  let fresnel = reflectance + (1.0 - reflectance) * pow(1.0 - facing, 4.5);
  let reflection = studio(reflect(ray, n));
  let film = spectralFilm(facing, local);
  let filmWeight = scene.forward.w * pow(1.0 - facing, 1.8);
  let filmReflection = mix(reflection, reflection * (0.58 + 0.93 * film), clamp(filmWeight, 0.0, 0.9));
  let sheen = film * filmWeight * smoothstep(0.09, 0.40, facing) * 0.24;
  return mix(body, filmReflection, fresnel) + sheen;
}

@fragment fn fragmentMain(@builtin(position) pixel: vec4f) -> @location(0) vec4f {
  let uv = (pixel.xy - scene.frame.xy * 0.5) * vec2f(1.0, -1.0) / scene.frame.y;
  let origin = scene.eye.xyz;
  let ray = normalize(scene.forward.xyz * scene.frame.w + scene.right.xyz * uv.x + scene.up.xyz * uv.y);
  let floorDistance = (FLOOR - origin.y) / min(ray.y, -0.0001);
  let entry = entryDistance(origin, ray, floorDistance);
  var linearColor = vec3f(0.0);
  if (entry > 0.0) {
    linearColor = shadeGel(origin, ray, entry, uv);
  } else {
    linearColor = backdrop(origin, ray, uv);
  }
  // A soft highlight shoulder keeps the reflections legible on a white sweep.
  // Exposure leaves paper whites near 0.96 on screen, so highlights still have room above them.
  linearColor = lookGrade(linearColor, pixel.xy / scene.frame.xy, look) * 0.95;
  linearColor = min(linearColor, vec3f(0.85)) + 0.15 * (1.0 - exp(-max(linearColor - 0.85, vec3f(0.0)) / 0.15));
  let c = max(linearColor, vec3f(0.0));
  let srgb = select(c * 12.92, 1.055 * pow(c, vec3f(1.0 / 2.4)) - vec3f(0.055), c > vec3f(0.0031308));
  var shown = srgb;
  if (look.b.y > 0.5) { shown = lookTone(c, look.b.y); }
  return vec4f(shown + (hash(pixel.xy) - 0.5) / 140.0 + lookGrain(pixel.xy, 0.0, look), 1.0);
}
`,
  Ie = Ue + Be,
  J = Ve(),
  x = new URLSearchParams(location.search),
  p = x.has("thumb"),
  me = matchMedia("(prefers-reduced-motion: reduce)").matches,
  o = document.querySelector("canvas"),
  de = document.querySelector("#status");
p && document.body.classList.add("capture");
const Y = {
    "Sea glass": [
      [0.028, 0.42, 0.78],
      [0.18, 0.89, 0.49],
    ],
    Citrus: [
      [0.89, 0.31, 0.055],
      [0.8, 0.91, 0.19],
    ],
    Garnet: [
      [0.54, 0.015, 0.095],
      [0.98, 0.17, 0.21],
    ],
    Ultraviolet: [
      [0.25, 0.025, 0.66],
      [0.16, 0.29, 0.97],
    ],
    Graphite: [
      [0.06, 0.075, 0.1],
      [0.34, 0.38, 0.44],
    ],
    Peach: [
      [0.95, 0.38, 0.27],
      [1, 0.72, 0.5],
    ],
  },
  i = {
    palette: Y[x.get("palette")] ? x.get("palette") : "Sea glass",
    speed: me ? 0 : 1,
    softness: 0.73,
    film: 0.45,
    absorption: 0.84,
    refraction: 1.34,
    bubbles: !0,
    orbit: !1,
  },
  g = { x: 0, v: 0 },
  De = new a(),
  X = [
    [-1.02, 0.12, 0.18, 0.71],
    [-0.32, 0.57, -0.22, 0.67],
    [0.55, 0.36, 0.23, 0.69],
    [0.84, -0.35, -0.11, 0.55],
    [-0.22, -0.5, 0.27, 0.62],
  ],
  Z = new a(-0.11, -0.12, 0),
  M = new a(),
  C = new a(),
  L = new a(),
  R = new a(),
  Ne = new a(0, 1, 0),
  V = new a(),
  ee = new a(),
  E = new a(),
  O = new a(),
  j = new a(),
  te = new a(),
  $ = new a(),
  ge = X.map(() => new a()),
  be = new Float32Array(X.length),
  pe = new a(),
  H = new a(),
  K = new Oe(),
  We = new Te(),
  ne = [
    [0.141, 0.061, 0.026, 0.036],
    [0.085, 0.029, 0.045, 0.025],
    [0.128, 0.06, 0.031, 0.019],
    [0.059, 0.033, 0.025, 0.015],
    [0.094, 0.041, 0.028, 0.021],
  ],
  ve = 36,
  ye = ve + X.length * 4,
  He = 2 * Math.PI;
let G = 0.12,
  m = 0.17,
  y = 6.55,
  Q = 0,
  c;
const re = 1.66;
function Ye() {
  const t = 1 - Math.min(1, o.clientWidth / Math.max(o.clientHeight, 1));
  (M.set(Math.sin(G) * Math.cos(m), Math.sin(m), Math.cos(G) * Math.cos(m))
    .multiplyScalar(y * (1 + 0.55 * t))
    .add(Z),
    C.subVectors(Z, M).normalize(),
    L.crossVectors(C, Ne).normalize(),
    R.crossVectors(L, C));
}
function Qe(t) {
  const e = o.getBoundingClientRect();
  return te
    .copy(C)
    .multiplyScalar(re * Math.min(1, e.width / e.height))
    .addScaledVector(L, (t.clientX - e.left - e.width / 2) / e.height)
    .addScaledVector(R, (e.top + e.height / 2 - t.clientY) / e.height)
    .normalize();
}
function ue(t) {
  Qe(t);
  let e = 1 / 0;
  for (const [r, h] of ge.entries()) {
    $.subVectors(h, M);
    const d = be[r],
      S = te.dot($),
      w = (d + 0.14) ** 2 - $.lengthSq() + S ** 2;
    w >= 0 && (e = Math.min(e, S - Math.sqrt(w)));
  }
  return Number.isFinite(e) ? (V.copy(M).addScaledVector(te, e), !0) : !1;
}
function xe() {
  ((Q = 1), (g.v -= 5.5));
}
function Xe() {
  (o.addEventListener("pointerdown", (e) => {
    if (c || e.button !== 0) return;
    const r = e.shiftKey || !ue(e);
    ((c = { id: e.pointerId, x: e.clientX, y: e.clientY, orbit: r }),
      o.setPointerCapture(e.pointerId),
      r || ((Q = 1), (g.v -= 2.4)));
  }),
    o.addEventListener("pointermove", (e) => {
      if (!c) {
        e.pointerType === "mouse" &&
          (ue(e)
            ? O.copy(De.subVectors(V, Z).normalize().multiplyScalar(0.085))
            : O.set(0, 0, 0));
        return;
      }
      if (c?.id !== e.pointerId) return;
      const r = e.clientX - c.x,
        h = e.clientY - c.y;
      if (c.orbit) {
        ((G -= r * 0.008),
          (m = T.clamp(m + h * 0.006, -0.1, 0.7)),
          (c.x = e.clientX),
          (c.y = e.clientY));
        return;
      }
      const d =
        y / (o.clientHeight * re * Math.min(1, o.clientWidth / o.clientHeight));
      (ee
        .copy(L)
        .multiplyScalar(r * d)
        .addScaledVector(R, -h * d),
        O.copy(ee).clampLength(0, 1.3));
    }));
  function t(e) {
    c?.id === e.pointerId &&
      (c.orbit || (g.v += E.length() * 3), (c = void 0), O.set(0, 0, 0));
  }
  (o.addEventListener("lostpointercapture", t),
    o.addEventListener("pointercancel", t),
    o.addEventListener(
      "wheel",
      (e) => {
        (e.preventDefault(),
          (y = T.clamp(y * Math.exp(e.deltaY * 0.0015), 4.4, 10)));
      },
      { passive: !1 },
    ),
    o.addEventListener("keydown", (e) => {
      switch (e.key) {
        case " ":
          xe();
          break;
        case "ArrowLeft":
          G -= 0.15;
          break;
        case "ArrowRight":
          G += 0.15;
          break;
        case "ArrowUp":
          m = Math.min(m + 0.12, 0.7);
          break;
        case "ArrowDown":
          m = Math.max(m - 0.12, -0.1);
          break;
        case "+":
        case "=":
          y = Math.max(4.4, y - 0.45);
          break;
        case "-":
          y = Math.min(10, y + 0.45);
          break;
        default:
          return;
      }
      e.preventDefault();
    }));
}
function _e(t, e) {
  const r = (e * He) / 7,
    h = Math.sin(r),
    d = Math.sin(r - 0.65) * 0.13;
  (K.setFromEuler(
    We.set(
      0.17 * Math.sin(r - 0.6),
      0.42 * Math.sin(r + 0.4),
      -0.13 * Math.sin(r + 0.9),
    ),
  ),
    X.forEach(([S, w, U, A], n) => {
      const q = r - S * 1.45,
        B = Math.sin(q),
        P = g.x;
      pe.set(
        S * (1 + 0.1 * h) * (1 - 0.07 * P) +
          0.028 * Math.sin(r * 1.7 + n * 2.1),
        w * (1 - 0.14 * h) * (1 + 0.15 * P) +
          B * 0.16 +
          0.026 * Math.sin(r * 2.3 + n * 1.3),
        (U + Math.cos(q) * 0.19) * (1 - 0.07 * P) +
          0.026 * Math.cos(r * 1.9 + n * 1.7),
      );
      const b = ge[n].copy(pe).applyQuaternion(K);
      b.y += d;
      const k = A * (1 + B * 0.055 + 0.025 * Math.sin(r * 2 + n * 1.7));
      ((be[n] = k),
        t.set([b.x, b.y, b.z, k], ve + n * 4),
        ne[n].forEach((F, z) => {
          const v = n * 2.4 + z * 2.1,
            u = r * (z < 2 ? 1 : 2) + v;
          H.set(
            0.29 * Math.cos(v) + 0.13 * Math.sin(u),
            0.24 * Math.sin(v) + 0.13 * Math.sin(u - 1.1),
            0.32 - z * 0.11 + 0.11 * Math.cos(u),
          )
            .multiplyScalar(k / 0.72)
            .applyQuaternion(K)
            .add(b);
          const _ = ye + (n * ne[n].length + z) * 4;
          t.set([H.x, H.y, H.z, F], _);
        }));
    }));
}
let l = null;
const je = Pe(x, (t) => {
  l = t;
});
function $e() {
  return (
    qe({
      Studio: je,
      Palette: {
        value: i.palette,
        options: Object.keys(Y),
        onChange: (t) => {
          i.palette = t;
        },
      },
      Motion: {
        value: i.speed,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (t) => {
          i.speed = t;
        },
      },
      Softness: {
        value: i.softness,
        min: 0.2,
        max: 1,
        step: 0.01,
        onChange: (t) => {
          i.softness = t;
        },
      },
      "Thin film": {
        value: i.film,
        min: 0,
        max: 1.3,
        step: 0.01,
        onChange: (t) => {
          i.film = t;
        },
      },
      Absorption: {
        value: i.absorption,
        min: 0,
        max: 2,
        step: 0.01,
        onChange: (t) => {
          i.absorption = t;
        },
      },
      Refraction: {
        value: i.refraction,
        min: 1.05,
        max: 1.55,
        step: 0.01,
        onChange: (t) => {
          i.refraction = t;
        },
      },
      "Air bubbles": {
        value: i.bubbles,
        onChange: (t) => {
          i.bubbles = t;
        },
      },
      "Auto-orbit": {
        value: i.orbit,
        onChange: (t) => {
          i.orbit = t;
        },
      },
      Pulse: Fe(xe),
      ...J.controls(),
    }),
    null
  );
}
async function Ke() {
  const t = await navigator.gpu?.requestAdapter();
  if (!t) throw new Error("This piece needs a browser with WebGPU enabled.");
  const e = await t.requestDevice();
  J.attach(e);
  const r = o.getContext("webgpu"),
    h = navigator.gpu.getPreferredCanvasFormat();
  r.configure({ device: e, format: h, alphaMode: "opaque" });
  const d = e.createShaderModule({ code: Ie }),
    w = (await d.getCompilationInfo()).messages.filter(
      (f) => f.type === "error",
    );
  if (w.length)
    throw new Error(
      w.map((f) => `Line ${f.lineNum}: ${f.message}`).join(`
`),
    );
  const U = await e.createRenderPipelineAsync({
      layout: "auto",
      vertex: { module: d, entryPoint: "vertexMain" },
      fragment: {
        module: d,
        entryPoint: "fragmentMain",
        targets: [{ format: h }],
      },
    }),
    A = ye + ne.flat().length * 4,
    n = new Float32Array(A + 12),
    q = e.createBuffer({
      size: n.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    }),
    B = e.createBindGroup({
      layout: U.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: q } },
        { binding: 1, resource: { buffer: J.buffer } },
      ],
    });
  p ||
    (Xe(),
    Re.createRoot(document.querySelector("#controls")).render(
      W.createElement(
        W.Fragment,
        null,
        W.createElement(Ge, { collapsed: !0, titleBar: { title: "Controls" } }),
        W.createElement($e),
      ),
    ));
  const P = 0.75,
    b = x.has("t") ? Number(x.get("t")) : P;
  let k = p && Number.isFinite(b) ? b : P,
    F = performance.now(),
    z = 0,
    v = 1 / 60,
    u = 1;
  const [_, we] = Y[i.palette].map((f) => new a(...f)),
    ke = new a(),
    ze = new a();
  function oe(f) {
    const s = Math.min(0.045, (f - F) / 1e3);
    ((F = f),
      (v += (s - v) * 0.05),
      p ||
        (u = T.clamp(
          v > 1 / 44 ? u * 0.985 : v < 1 / 56 ? u * 1.004 : u,
          0.55,
          1,
        )),
      p || (k += s * i.speed),
      i.orbit && !c && (G += s * 0.2),
      j.addScaledVector(ee.subVectors(O, E), s * T.lerp(160, 70, i.softness)),
      j.multiplyScalar(Math.exp(-s * T.lerp(14, 6, i.softness))),
      E.addScaledVector(j, s),
      (Q *= Math.exp(-s * 3.4)),
      (g.v += (-150 * g.x - 7.5 * g.v) * s),
      (g.x += g.v * s),
      Ye());
    const ae = p ? 1e3 : o.clientWidth,
      se = p ? 1e3 : o.clientHeight,
      ce = p
        ? 1
        : Math.min(devicePixelRatio, 1.5, Math.sqrt(135e4 / (ae * se))) * u,
      I = Math.max(1, Math.round(ae * ce)),
      D = Math.max(1, Math.round(se * ce));
    ((o.width !== I || o.height !== D) && ((o.width = I), (o.height = D)),
      n.set([I, D, k, re * Math.min(1, I / D)], 0),
      n.set([M.x, M.y, M.z, i.refraction], 4),
      n.set([C.x, C.y, C.z, i.film], 8),
      n.set([L.x, L.y, L.z, i.absorption], 12),
      n.set([R.x, R.y, R.z, Number(i.bubbles)], 16),
      n.set([V.x, V.y, V.z, Q], 20),
      n.set([E.x, E.y, E.z, i.softness], 24));
    const [Me, Ce] = Y[i.palette],
      le = me ? 1 : 1 - Math.exp(-s * 10);
    (_.lerp(ke.fromArray(Me), le).toArray(n, 28),
      we.lerp(ze.fromArray(Ce), le).toArray(n, 32),
      _e(n, k));
    const Le = l ? Ee(l) : [-0.5, 0.77, 0.39],
      Se = l ? he(l.keyColor) : [0.94, 0.99, 1.04],
      Ae = l ? he(l.sweep) : [1, 1, 1];
    (n.set([...Le, l ? Math.sqrt(l.soft / 4) : 1], A),
      n.set([...Se, l ? l.keyLevel / 4.4 : 1], A + 4),
      n.set([...Ae, l ? 1 : 0], A + 8),
      e.queue.writeBuffer(q, 0, n));
    const fe = e.createCommandEncoder(),
      N = fe.beginRenderPass({
        colorAttachments: [
          {
            view: r.getCurrentTexture().createView(),
            loadOp: "clear",
            storeOp: "store",
            clearValue: { r: 1, g: 1, b: 1, a: 1 },
          },
        ],
      });
    (N.setPipeline(U),
      N.setBindGroup(0, B),
      N.draw(3),
      N.end(),
      e.queue.submit([fe.finish()]),
      p || (z = requestAnimationFrame(oe)));
  }
  if ((oe(F), p && x.has("port"))) {
    const f = Number(x.get("port"));
    o.toBlob(
      (s) => {
        s &&
          fetch(`http://localhost:${f}/`, { method: "POST", body: s }).catch(
            ie,
          );
      },
      "image/jpeg",
      0.94,
    );
  }
  e.lost.then(() => {
    (cancelAnimationFrame(z),
      ie(new Error("The graphics device stopped. Reload to reopen Membrane.")));
  });
}
function ie(t) {
  (console.error(t),
    (de.textContent = t.message.startsWith("Line ")
      ? "Membrane couldn’t load its shader."
      : t.message),
    (de.hidden = !1));
}
Ke().catch(ie);
