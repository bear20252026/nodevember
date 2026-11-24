import * as THREE from 'three';
import { SHELL_PLANES } from './fracture.js';

// The materials of the volumes. Each is solid: its pattern is drawn in 3D, at
// the point of the volume each pixel comes from (the `rest` attribute), so the
// grain carries on across the cut faces of the fragments. The cut faces (the
// `cut` attribute) have their own finish: raw wood under the varnish, bisque
// under the glaze, frosted ice...
// Each material is a few GLSL functions of the point p (in the volume, of
// radius 1) and of cut (0 outside, 1 on a cut):
//   vec3 surfColor(p, cut), float surfRough(p, cut), float surfHeight(p, cut)
// the height bumps the surface (in volume units).

export const noiseGLSL = /* glsl */ `
// 3D simplex noise, Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
float fbm(vec3 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * snoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
// how much of a detail of this frequency a pixel resolves: finer than the
// pixel, it fades out of the bumps (and into the roughness)
float resolved(vec3 p, float freq) { return 1.0 - smoothstep(0.15, 0.5, length(fwidth(p)) * freq); }
// a few fine straight scratches, here and there: 0 to 1
float scratches(vec3 p, float freq) {
  float s = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    vec3 dir = normalize(vec3(hash1(k + 1.3), hash1(k + 2.7), hash1(k + 4.1)) - 0.5);
    float t = dot(p, dir) * freq + 0.6 * snoise(p * 1.5 + k * 7.0);
    float w = fwidth(t);
    float line = 1.0 - smoothstep(0.0, 0.03 + w, abs(fract(t) - 0.5));
    float keep = step(0.75, hash1(floor(t) + k * 31.0));
    float mask = smoothstep(0.3, 0.7, snoise(p * 3.0 + dir * 11.0 + k));
    s += keep * line * mask * 0.03 / (0.03 + w);
  }
  return min(s, 1.0);
}
// the crystals of a metal, as its break shows them: the nearest of points
// jittered on a grid. x: a number of the crystal's own, yzw: p from its
// middle, in grid units
vec3 hash3v(vec3 c) { return fract(sin(vec3(dot(c, vec3(127.1, 311.7, 74.7)), dot(c, vec3(269.5, 183.3, 246.1)), dot(c, vec3(113.5, 271.9, 124.6)))) * 43758.5453); }
vec4 crystal(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  float best = 1e9;
  vec4 out_ = vec4(0.0);
  for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 h = hash3v(i + g);
        vec3 d = f - g - h;
        float dd = dot(d, d);
        if (dd < best) { best = dd; out_ = vec4(h.x + h.y * 7.0 + h.z * 13.0, d); }
      }
  out_.x = fract(out_.x);
  return out_;
}
// striations: the parallel grooves a tear or a shear leaves across the break
// of a metal, squeezed together, wavering, in bands: here deep and close, there
// faint. x: the height (-1 to 1), y: a number of the groove's own
vec2 striae(vec3 p, vec3 dir, float freq, float waver) {
  float t = dot(p, dir) * freq + waver * snoise(p * 2.5 + dir * 5.0) + 0.3 * waver * snoise(p * 9.0);
  float id = floor(t), f = fract(t);
  // each groove its own depth; a rounded crest, a sharp bottom
  float depth = 0.25 + 0.75 * hash1(id * 1.7 + 3.0);
  float ridge = 1.0 - pow(abs(2.0 * f - 1.0), 0.6) * 2.0;
  // finer ones in between
  float t2 = t * 3.7 + 0.5 * snoise(p * 20.0);
  float fine = 0.3 * sin(t2 * 6.2832) * resolved(p, freq * 3.7);
  // in bands
  float band = smoothstep(-0.4, 0.4, snoise(vec3(t * 0.08, p.yz * 1.5) + dir));
  return vec2((depth * ridge + fine) * mix(0.25, 1.0, band) * resolved(p, freq), hash1(id * 3.1 + 1.0));
}
// the break ground or brushed straight: countless fine scratches, dead
// straight, all one way, broken into dashes of all lengths, at three scales;
// glossy, they catch the light, darker metal between them. Same output as
// striae (y: 0 the glossiest, 1 the dullest)
vec2 ground(vec3 p, vec3 dir, float freq) {
  vec3 e1 = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 e2 = cross(dir, e1);
  float h = 0.0, g = 0.0, amp = 1.0;
  for (int i = 0; i < 3; i++) {
    float k = float(i);
    float t = dot(p, dir) * freq + k * 0.37;
    float id = floor(t), f = fract(t), fw = fwidth(t);
    float at = 0.2 + 0.6 * hash1(id * 1.3 + k * 17.0);
    float w = 0.04 + 0.08 * hash1(id * 2.9 + k * 5.0);
    float line = (1.0 - smoothstep(w, w + fw, abs(f - at))) * w / (w + fw);
    // dashes: long ones, short ones, along the line
    float len = 2.0 + 6.0 * hash1(id * 0.7 + k * 3.0);
    float dash = smoothstep(0.0, 0.35, snoise(vec3(id * 0.71 + k * 9.0, dot(p, e1) * len, dot(p, e2) * len)));
    float s = line * dash * (0.4 + 0.6 * hash1(id * 4.3 + k));
    h -= amp * s;
    g = max(g, amp * s);
    freq *= 2.3;
    amp *= 0.65;
  }
  return vec2(h, 1.0 - g);
}
// on some volumes (uStraight) the grooves are dead straight. (Every shader
// that takes this noise declares uStraight.)
vec2 metalStriae(vec3 p, vec3 dir, float freq, float waver) {
  return uStraight > 0.5 ? ground(p, dir, freq * 0.9) : striae(p, dir, freq, waver);
}
`;

// uDir: a direction (the axis of the tree, the bedding of the stone...),
// uOff: where the pattern starts, uC0..2: colors, uAxis: the axis toward the
// camera, set when the volume breaks (the splinters of wood fan out from it)
const KINDS = {
  glass: {
    transparent: true,
    palette: [['#e4f4ee'], ['#e8eef8'], ['#f4efe2'], ['#eaf6f0']],
    material: ([tint]) => ({
      transmission: 1, roughness: 0.06, ior: 1.5, thickness: 0.5, specularIntensity: 0.7, dispersion: 0.12, envMapIntensity: 1.2,
      attenuationColor: tint.clone().multiplyScalar(0.92), attenuationDistance: 0.9,
    }),
    shadow: false,
    glsl: /* glsl */ `
      vec3 surfColor(vec3 p, float cut) { return uC0; }
      // the polish is not perfect: fine scratches, a few hazy marks
      float surfRough(vec3 p, float cut, float r) {
        float worn = 0.25 * scratches(p, 90.0) + 0.04 * smoothstep(0.2, 0.8, fbm(p * 4.0 + uOff));
        return mix(r + worn, 0.07, cut);
      }
      // the slight waviness of blown glass; the conchoidal ripples of a fresh break
      float surfHeight(vec3 p, float cut) {
        return mix(0.0008 * snoise(p * 3.0 + uOff), 0.0015 * sin(length(p - uOff) * 70.0 + 2.0 * snoise(p * 3.0)) * resolved(p, 30.0), cut);
      }
    `,
  },
  ice: {
    transparent: true,
    // the tint, the bubbles, the color deep in it
    palette: [['#eaf6fb', '#ffffff', '#bfe3ef'], ['#e2f1f7', '#ffffff', '#bfe3ef']],
    material: ([, , deep]) => ({
      transmission: 1, roughness: 0.12, ior: 1.31, thickness: 0.6, specularIntensity: 0.7, envMapIntensity: 1.1,
      attenuationColor: deep, attenuationDistance: 1.2,
    }),
    shadow: false,
    glsl: /* glsl */ `
      // clouds of trapped bubbles
      vec3 surfColor(vec3 p, float cut) { return mix(uC0, uC1, smoothstep(0.1, 0.6, fbm(p * 2.5 + uOff))); }
      // frosted in patches, wet and clear elsewhere
      float frost(vec3 p) { return smoothstep(0.0, 0.5, fbm(p * 2.0 + uOff + 3.0)); }
      float surfRough(vec3 p, float cut, float r) {
        float f = frost(p);
        float outside = r + 0.3 * f + 0.1 * smoothstep(0.0, 0.6, fbm(p * 2.5 + uOff)) + 0.15 * f * (1.0 - resolved(p, 120.0));
        return mix(outside, 0.35, cut);
      }
      // melted pits all over, the fine crystals of the frost
      float surfHeight(vec3 p, float cut) {
        float crystals = (1.0 - cut) * frost(p) * 0.0006 * snoise(p * 120.0) * resolved(p, 120.0);
        return mix(0.002, 0.004, cut) * fbm(p * 14.0) + crystals;
      }
    `,
  },
  wood: {
    palette: [['#d4a876', '#9a6a45'], ['#e0c49a', '#b08558'], ['#b8875e', '#77503a'], ['#e6d4b4', '#bf9a6e']],
    material: () => ({ roughness: 0.55, clearcoat: 0.15, clearcoatRoughness: 0.45 }),
    glsl: /* glsl */ `
      // the growth rings around the axis of the tree, wavy, the fibers along
      // it, and the pores, long and thin along it too
      vec3 woodAt(vec3 p) {
        vec3 q = p + uOff;
        float along = dot(q, uDir);
        vec3 radial = q - uDir * along;
        float r = length(radial) + 0.05 * snoise(radial * 2.0 + uDir * along * 0.3) + 0.015 * sin(along * 3.0);
        float late = pow(fract(r * 13.0), 3.0);
        float fiber = snoise(radial * 40.0 + uDir * along * 1.5);
        float pore = smoothstep(0.6, 0.9, snoise(radial * 110.0 + uDir * along * 8.0)) * resolved(p, 110.0);
        return vec3(late, fiber, pore);
      }
      // on the breaks, the wood burst out from the inside: the fibers torn
      // along each splinter, fanned out from the axis toward the camera
      vec3 splinterAt(vec3 p, vec3 w) {
        vec3 a = p - uAxis * dot(p, uAxis);
        a = dot(a, a) > 1e-8 ? normalize(a) : uDir;
        vec3 q = p + uOff;
        vec3 across = q - a * dot(q, a);
        float fiber = snoise(across * 70.0 + a * dot(q, a) * 2.0);
        float streak = snoise(across * 22.0 + a * dot(q, a) * 0.8);
        float pore = smoothstep(0.55, 0.9, snoise(across * 160.0 + a * dot(q, a) * 6.0)) * resolved(p, 160.0);
        return vec3(clamp(w.x * 0.6 + 0.5 * max(streak, 0.0), 0.0, 1.0), fiber, max(pore, w.z * 0.5));
      }
      // the three functions below all need it, at the same point: worked out
      // once per pixel
      vec3 gWood;
      #define SURF_INIT
      void surfInit(vec3 p, float cut) {
        gWood = woodAt(p);
        if (cut > 0.0) gWood = mix(gWood, splinterAt(p, gWood), cut);
      }
      vec3 wood(vec3 p) { return gWood; }
      vec3 surfColor(vec3 p, float cut) {
        vec3 w = wood(p);
        vec3 c = mix(uC0, uC1, 0.6 * w.x) * (0.92 + 0.08 * w.y) * (1.0 - 0.18 * w.z);
        return mix(c, c * 1.15 + 0.03, cut);
      }
      // the dense late wood takes a sheen, the varnish sinks in the pores
      float surfRough(vec3 p, float cut, float r) {
        vec3 w = wood(p);
        return mix(r - 0.12 * w.x + 0.2 * w.z, 0.8 + 0.1 * w.z, cut);
      }
      float surfHeight(vec3 p, float cut) {
        vec3 w = wood(p);
        return mix(0.0004 * w.y + 0.0004 * w.x - 0.0008 * w.z, 0.003 * w.y + 0.002 * w.x - 0.002 * w.z, cut);
      }
    `,
  },
  marble: {
    palette: [['#f3efe8', '#6f6a66'], ['#efe6dc', '#9a7b62'], ['#e9efe9', '#4e6b5c'], ['#f2e4e2', '#8c5a5a']],
    material: () => ({ roughness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.25 }),
    glsl: /* glsl */ `
      // soft clouded veins, and a few thin ones across them: vein, thin, cloud
      vec3 veinsAt(vec3 p) {
        vec3 q = p * 1.3 + uOff;
        float t = dot(q, uDir) * 1.6 + 1.8 * fbm(q * 1.2);
        float vein = smoothstep(0.7, 1.0, 1.0 - abs(sin(t * 3.14159))) * (0.6 + 0.4 * fbm(q * 3.0 + 5.0));
        float thin = smoothstep(0.97, 1.0, 1.0 - abs(sin((t * 3.1 + 0.8 * fbm(q * 4.0)) * 3.14159)));
        return vec3(vein, thin, fbm(q * 2.5));
      }
      // tiny pits where crystals came off in the polishing
      float pitAt(vec3 p) { return smoothstep(0.75, 0.95, snoise(p * 80.0 + 9.0)) * resolved(p, 80.0); }
      // worked out once per pixel, as for the wood
      vec3 gVeins;
      float gPit;
      #define SURF_INIT
      void surfInit(vec3 p, float cut) { gVeins = veinsAt(p); gPit = pitAt(p); }
      vec3 veins(vec3 p) { return gVeins; }
      float pit(vec3 p) { return gPit; }
      vec3 surfColor(vec3 p, float cut) {
        vec3 v = veins(p);
        vec3 base = mix(uC0, uC0 * 0.9, 0.5 + 0.5 * v.z);
        vec3 c = mix(base, uC1, clamp(0.75 * v.x + 0.35 * v.y, 0.0, 1.0)) * (1.0 - 0.12 * pit(p));
        return mix(c, c * 1.03, cut);
      }
      // the softer veins take the polish less; scratches, pits
      float surfRough(vec3 p, float cut, float r) {
        float outside = r + 0.08 * veins(p).x + 0.3 * scratches(p, 70.0) + 0.3 * pit(p);
        return mix(outside, 0.55, cut);
      }
      // the veins a hair sunken; sugary crystals on the break
      float surfHeight(vec3 p, float cut) {
        return mix(-0.0003 * veins(p).x - 0.0006 * pit(p), 0.0012 * snoise(p * 55.0), cut);
      }
    `,
  },
  stone: {
    palette: [['#d8b48a', '#b9805a', '#e9d6b8'], ['#c9c2b6', '#9d968c', '#e2ddd3'], ['#c98f6b', '#a2604a', '#e0b494']],
    material: () => ({ roughness: 0.92 }),
    glsl: /* glsl */ `
      // sandstone: beds of slightly different colors, the grains, and pits
      float pit(vec3 p) { return smoothstep(0.55, 0.85, snoise(p * 22.0 + uOff * 3.0)); }
      vec3 surfColor(vec3 p, float cut) {
        float h = dot(p, uDir) * 5.0 + 0.5 * fbm(p * 1.2 + uOff);
        float id = floor(h), band = fract(h);
        vec3 c = mix(uC0, uC1, hash1(id));
        c = mix(c, uC2, 0.6 * smoothstep(0.8, 1.0, band) * hash1(id + 7.0));
        float grain = snoise(p * 60.0);
        return c * (0.9 + 0.1 * grain) * (0.94 + 0.06 * fbm(p * 6.0)) * (1.0 - 0.15 * pit(p));
      }
      // a few grains of quartz glint
      float surfRough(vec3 p, float cut, float r) {
        return r - 0.3 * smoothstep(0.8, 0.95, snoise(p * 90.0 + 4.0)) * resolved(p, 90.0);
      }
      float surfHeight(vec3 p, float cut) {
        return mix(0.003, 0.008, cut) * fbm(p * 10.0) + 0.0015 * snoise(p * 60.0) * resolved(p, 60.0) - 0.004 * pit(p);
      }
    `,
  },
  ceramic: {
    // the glaze, the clay body
    palette: ['#56788a', '#b9735e', '#d8c98e', '#6d8a74', '#e6e1d7', '#a87d8f'].flatMap((g) => [[g, '#c9805b'], [g, '#efe7dc']]),
    material: () => ({ roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.2 }),
    glsl: /* glsl */ `
      // a glaze outside, pooling a little, its orange peel, pinholes and the
      // fine crazing of an old glaze; the clay body inside
      float pinhole(vec3 p) { return smoothstep(0.8, 0.92, snoise(p * 35.0 + uOff * 5.0)) * resolved(p, 35.0); }
      float craze(vec3 p) {
        float n = snoise(p * 9.0 + uOff), w = fwidth(n);
        return (1.0 - smoothstep(0.0, 0.015 + w, abs(n))) * 0.015 / (0.015 + w);
      }
      vec3 surfColor(vec3 p, float cut) {
        vec3 glaze = uC0 * (0.88 + 0.12 * smoothstep(-0.5, 0.5, fbm(p * 2.5 + uOff)));
        glaze *= (1.0 - 0.12 * craze(p)) * (1.0 - 0.1 * pinhole(p));
        vec3 body = uC1 * (0.94 + 0.06 * snoise(p * 60.0));
        return mix(glaze, body, cut);
      }
      float surfRough(vec3 p, float cut, float r) {
        float glaze = r + 0.08 * fbm(p * 5.0 + uOff) + 0.15 * scratches(p, 60.0) + 0.2 * craze(p);
        return mix(glaze, 0.95, cut);
      }
      float surfHeight(vec3 p, float cut) {
        float glaze = 0.00035 * snoise(p * 28.0) * resolved(p, 28.0) - 0.001 * pinhole(p) - 0.0003 * craze(p);
        return mix(glaze, 0.0012 * snoise(p * 45.0) + 0.0008 * snoise(p * 130.0) * resolved(p, 130.0), cut);
      }
    `,
  },
  obsidian: {
    palette: [['#1c1a1a', '#2a1d18'], ['#1c1a1a', '#1c2127'], ['#1c1a1a', '#251a22']],
    material: () => ({ roughness: 0.14, clearcoat: 0.2, clearcoatRoughness: 0.15 }),
    glsl: /* glsl */ `
      // faint flow bands
      float band(vec3 p) { return snoise(vec3(dot(p, uDir) * 7.0, p.xy * 0.7) + uOff); }
      // outside, the weathered skin: dull patches, scratches
      float dull(vec3 p) { return smoothstep(0.2, 0.7, fbm(p * 2.0 + uOff + 2.0)); }
      vec3 surfColor(vec3 p, float cut) { return mix(uC0, uC1, smoothstep(0.0, 0.7, band(p))); }
      float surfRough(vec3 p, float cut, float r) { return mix(r + 0.35 * dull(p) + 0.3 * scratches(p, 80.0), 0.1, cut); }
      // the flow bands in faint ridges; conchoidal fracture: shells of
      // ripples around where the break started
      float surfHeight(vec3 p, float cut) {
        float skin = 0.0005 * band(p) + 0.0004 * dull(p) * snoise(p * 90.0) * resolved(p, 90.0);
        return mix(skin, 0.0035 * sin(length(p - uOff * 0.3) * 55.0 + 3.0 * snoise(p * 2.0)) * resolved(p, 25.0), cut);
      }
    `,
  },
  // The metals: their color is that of their reflection (metalness 1), the
  // room mirrored in them tinted by it. Broken, a metal is still a metal:
  // bright, fresh, a mirror; gold and silver pulled and torn smooth, steel
  // snapped, its crystals each a tiny mirror at its own angle.
  gold: {
    metal: true,
    // the gold, the deeper red of the alloy in places, the dirt in the hollows
    palette: [['#f5c252', '#e3923e', '#7a5428'], ['#f8d27a', '#e0a24c', '#7a6234'], ['#f0b08a', '#dc8466', '#7a4a38']],
    material: () => ({ metalness: 1, roughness: 0.16 }),
    glsl: /* glsl */ `
      // cast, then hammered: shallow dimples all over, each a soft cup;
      // polished on the bumps, the polish scratched
      float dimpleAt(vec3 p) {
        vec3 q = p * 9.0 + uOff;
        float a = snoise(q), b = snoise(q * 1.9 + 4.0);
        return 1.0 - abs(a) * 0.7 - abs(b) * 0.3;
      }
      float gDimple;
      #define SURF_INIT
      void surfInit(vec3 p, float cut) { gDimple = dimpleAt(p); }
      float dirt(vec3 p) { return smoothstep(0.55, 0.95, 1.0 - gDimple) * (0.5 + 0.5 * fbm(p * 4.0 + uOff)); }
      vec3 surfColor(vec3 p, float cut) {
        vec3 c = mix(uC0, uC1, 0.35 * smoothstep(0.0, 0.8, fbm(p * 2.0 + uOff + 1.0)));
        c = mix(c, uC2, 0.35 * dirt(p));
        // torn soft gold: a fresh bright yellow
        return mix(c, uC0 * 1.06, cut);
      }
      // the break: torn soft, glossy, satin where it was pulled the most
      float surfRough(vec3 p, float cut, float r) {
        float outside = r + 0.2 * scratches(p, 110.0) + 0.25 * dirt(p);
        return mix(outside, 0.1 + 0.08 * smoothstep(0.0, 0.6, snoise(p * 8.0 + uOff)), cut);
      }
      // the dimples; the break pulled out in long smooth ridges, flowing like
      // drawn taffy, the tiny cups of the tearing on them
      float surfHeight(vec3 p, float cut) {
        vec3 q = p * 6.0 + uOff;
        float flow = 0.004 * snoise(q + 0.6 * vec3(snoise(q * 0.7), snoise(q * 0.7 + 3.0), snoise(q * 0.7 + 6.0)));
        vec4 c = crystal(p * 70.0);
        float cups = 0.0003 * (1.0 - dot(c.yzw, c.yzw)) * resolved(p, 70.0);
        return mix(0.0018 * gDimple * resolved(p, 9.0), flow + cups, cut);
      }
    `,
  },
  silver: {
    metal: true,
    // the silver, its tarnish, the deep tarnish in the hollows
    palette: [['#e2e1de', '#a8987e', '#40362e'], ['#dfe1e3', '#96938c', '#343438'], ['#e6e1da', '#b0906c', '#503828']],
    material: () => ({ metalness: 1, roughness: 0.1 }),
    glsl: /* glsl */ `
      // tarnished in patches, darker and duller where the cloth did not reach,
      // bright where it was rubbed; the hairlines of the polishing
      float tarnish(vec3 p) { return smoothstep(-0.2, 0.45, fbm(p * 1.6 + uOff)); }

      vec3 surfColor(vec3 p, float cut) {
        float t = tarnish(p);
        vec3 c = mix(uC0, uC1, 0.75 * t);
        c = mix(c, uC2, 0.3 * smoothstep(0.6, 1.0, t) * smoothstep(0.0, 0.6, fbm(p * 6.0 + 3.0)));
        // the break: fresh, untarnished, bright
        return mix(c, uC0 * 1.02, cut);
      }
      // the break: torn, striated by the tearing, the grooves curving with
      // it, soft; each a little glossier or duller
      vec2 gStriae;
      #define SURF_INIT
      void surfInit(vec3 p, float cut) { gStriae = cut > 0.0 ? metalStriae(p, normalize(uDir.yzx), 16.0, 2.0) : vec2(0.0); }
      float surfRough(vec3 p, float cut, float r) {
        float outside = r + 0.35 * tarnish(p) + 0.25 * scratches(p, 140.0);
        return mix(outside, 0.1 + 0.18 * gStriae.y * resolved(p, 16.0), cut);
      }
      // a few dents; the break pulled out in soft swells, the striae on them
      float surfHeight(vec3 p, float cut) {
        float dents = -0.0015 * smoothstep(0.6, 0.9, snoise(p * 4.0 + uOff * 2.0));
        vec3 q = p * 8.0 + uOff;
        float flow = 0.002 * snoise(q + 0.5 * vec3(snoise(q * 0.6), snoise(q * 0.6 + 3.0), snoise(q * 0.6 + 6.0)));
        return mix(dents, flow + 0.005 * gStriae.x, cut);
      }
    `,
  },
  steel: {
    metal: true,
    // the steel, the faint marks of the brushing, the color of the break
    palette: [['#c6c9cc', '#aeb3b8', '#c4c6c8'], ['#bfc2c4', '#a2a6aa', '#c0c2c4'], ['#3e5478', '#8a7458', '#c4c6c8'], ['#c8c4bc', '#b0aaa0', '#c6c4c0']],
    material: () => ({ metalness: 1, roughness: 0.28 }),
    glsl: /* glsl */ `
      // brushed: countless fine lines, all along uDir, a few deeper; on the
      // blued steel, the temper colors drift across
      float brushAt(vec3 p) {
        float along = dot(p, uDir);
        vec3 across = p - uDir * along;
        float fine = snoise(across * 260.0 + uDir * along * 2.0) * resolved(p, 260.0);
        float deep = snoise(across * 70.0 + uDir * along * 0.6) * resolved(p, 70.0);
        return 0.6 * fine + 0.4 * deep;
      }
      float gBrush;
      #define SURF_INIT
      // the break: sheared, scored with straight close striae across it,
      // sharp, in bands; each groove a little glossier or duller
      vec2 gStriae;
      void surfInit(vec3 p, float cut) {
        gBrush = brushAt(p);
        gStriae = cut > 0.0 ? metalStriae(p, uDir, 28.0, 0.6) : vec2(0.0);
      }
      vec3 surfColor(vec3 p, float cut) {
        vec3 c = mix(uC0, uC1, smoothstep(-0.4, 0.6, fbm(p * 1.4 + uOff))) * (0.96 + 0.04 * gBrush);
        // the break: bright bare steel, even on the blued one, a hair darker
        // in the grooves
        vec3 bare = uC2 * (0.97 + 0.03 * gStriae.x);
        return mix(c, bare, cut);
      }
      // the lines in the gloss: what is left of the anisotropy of the brushing
      float surfRough(vec3 p, float cut, float r) {
        float outside = r + 0.1 * gBrush + 0.15 * scratches(p, 90.0);
        return mix(outside, 0.08 + 0.2 * gStriae.y * resolved(p, 28.0), cut);
      }
      // gently curved, the striae on it
      float surfHeight(vec3 p, float cut) {
        vec3 q = p * 5.0 + uOff;
        float wave = 0.004 * snoise(q + 0.4 * vec3(snoise(q * 0.5), snoise(q * 0.5 + 3.0), snoise(q * 0.5 + 6.0)));
        return mix(0.00025 * gBrush, wave + 0.0035 * gStriae.x, cut);
      }
    `,
  },
};

export const MATERIAL_NAMES = Object.keys(KINDS);
// the pattern of a material, for its debris (see particles.js)
export const materialGLSL = (kind) => (KINDS[kind] ?? KINDS.marble).glsl;
// the materials seen through, and the others
export const TRANSPARENT_NAMES = MATERIAL_NAMES.filter((k) => KINDS[k].transparent);
export const OPAQUE_NAMES = MATERIAL_NAMES.filter((k) => !KINDS[k].transparent);
export const METAL_NAMES = MATERIAL_NAMES.filter((k) => KINDS[k].metal);

// a color with its saturation scaled by s
const _gray = new THREE.Color();
const desaturate = (c, s) => c.lerp(_gray.setScalar(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722), 1 - s);

// a style (see styles.js) can give each material its own palette, change some
// of its settings, and mute all the colors. A metal's color is what it is
// (gold muted is brass): the metals are muted less, unless the style has no
// color at all
function look(kind, style, choice) {
  const k = KINDS[kind];
  const palette = style.palettes?.[kind] ?? k.palette;
  const saturation = (style.saturation ?? 1) ** (k.metal ? 0.3 : 1);
  const colors = palette[Math.floor(choice * palette.length)].map((c) => desaturate(new THREE.Color(c), saturation));
  return { colors, material: { ...k.material(colors), ...style.materials?.[kind] } };
}

// the material of a volume, in the style; restyle(style) gives it another
export function volumeMaterial(kind, style) {
  const { glsl, shadow = true } = KINDS[kind];
  // which color of the palette, kept from one style to the other
  const choice = Math.random();
  const { colors, material } = look(kind, style, choice);
  const uniforms = {
    uDir: { value: new THREE.Vector3().randomDirection() },
    uOff: { value: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.6) },
    uAxis: { value: new THREE.Vector3(0, 0, 1) },
    uC0: { value: colors[0] },
    uC1: { value: colors[1] ?? colors[0] },
    uC2: { value: colors[2] ?? colors[0] },
    // the volume's size on screen, for the bumps
    uScale: { value: 1 },
    // 1: the striae of a metal's break dead straight (see ground), else wavy
    uStraight: { value: Math.random() < 0.5 ? 1 : 0 },
    // 1 on a cylinder: its side refracts as a sphere would, see below
    uLens: { value: 0 },
    // a hollow volume, seen through: the shape of its inside (see shellShape
    // in fracture.js; uShell 0 if not hollow)
    uShell: { value: 0 },
    uShellPlanes: { value: Array.from({ length: SHELL_PLANES }, () => new THREE.Vector4()) },
    uShellOuter: { value: new Float32Array(SHELL_PLANES) },
    uShellCount: { value: 0 },
    uShellSize: { value: new THREE.Vector2() },
    uShellWall: { value: 0 },
    // 1 while it is whole: its pieces have no rim, nor the far edges
    uShellWhole: { value: 1 },
    // how much of the room its edges show, seen through (see below)
    uEdgeEnv: { value: style.edgeEnv ?? 0.85 },
  };
  const m = new THREE.MeshPhysicalMaterial({ metalness: 0, ...material });
  const restyle = (style) => {
    const { colors, material } = look(kind, style, choice);
    uniforms.uC0.value.copy(colors[0]);
    uniforms.uC1.value.copy(colors[1] ?? colors[0]);
    uniforms.uC2.value.copy(colors[2] ?? colors[0]);
    uniforms.uEdgeEnv.value = style.edgeEnv ?? 0.85;
    for (const [key, value] of Object.entries(material)) {
      if (value?.isColor) m[key].copy(value);
      else m[key] = value;
    }
  };
  m.customProgramCacheKey = () => kind;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rest;\nattribute float cut;\nvarying vec3 vRest;\nvarying float vCut;\nvarying vec3 vLens, vAxis;\nvarying vec3 vEyeRest, vRestNormal;')
      // the eye, and the normal, in the frame of the whole volume (rest)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = rest;\nvCut = cut;\nvLens = normalMatrix * rest;\nvAxis = normalMatrix * vec3(0.0, 1.0, 0.0);\nvEyeRest = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz + rest - position;\nvRestNormal = objectNormal;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying float vCut;
        varying vec3 vLens, vAxis;
        varying vec3 vEyeRest, vRestNormal;
        uniform float uLens, uEdgeEnv;
        uniform float uShell, uShellWall, uShellWhole;
        uniform vec4 uShellPlanes[${SHELL_PLANES}];
        uniform int uShellCount;
        uniform vec2 uShellSize;
        uniform float uShellOuter[${SHELL_PLANES}];
        // The ray o + t d against the hollow inside the shell: where it enters
        // it (x) and leaves it (y), how far it passes into it (z: > 0 if it goes
        // through it, < 0 if not); the normals of the hollow there, facing out
        vec3 shellHit(vec3 o, vec3 d, out vec3 n0, out vec3 n1) {
          n0 = -d;
          n1 = d;
          if (uShell < 1.5) {
            // convex, n·x <= w
            float t0 = -1e9, t1 = 1e9;
            for (int i = 0; i < ${SHELL_PLANES}; i++) {
              if (i >= uShellCount) break;
              vec4 q = uShellPlanes[i];
              float s = dot(q.xyz, d), h = q.w - dot(q.xyz, o);
              if (abs(s) < 1e-6) { if (h < 0.0) return vec3(0.0, 0.0, h); continue; }
              float ti = h / s;
              if (s < 0.0) { if (ti > t0) { t0 = ti; n0 = q.xyz; } }
              else if (ti < t1) { t1 = ti; n1 = q.xyz; }
            }
            return vec3(t0, t1, t1 - t0);
          }
          if (uShell < 2.5) {
            float b = dot(o, d), c = dot(o, o) - uShellSize.x * uShellSize.x, disc = b * b - c;
            if (disc < 0.0) return vec3(0.0, 0.0, -sqrt(-disc));
            float r = sqrt(disc);
            n0 = normalize(o + (-b - r) * d);
            n1 = normalize(o + (-b + r) * d);
            return vec3(-b - r, -b + r, 2.0 * r);
          }
          // the cylinder: its side, between its caps
          float a = max(dot(d.xz, d.xz), 1e-6), b = dot(o.xz, d.xz), c = dot(o.xz, o.xz) - uShellSize.x * uShellSize.x;
          float disc = b * b - a * c;
          if (disc < 0.0) return vec3(0.0, 0.0, -sqrt(-disc) / a);
          float r = sqrt(disc) / a;
          float s0 = -b / a - r, s1 = s0 + 2.0 * r;
          float dy = abs(d.y) < 1e-6 ? 1e-6 : d.y;
          float y0 = (-uShellSize.y - o.y) / dy, y1 = (uShellSize.y - o.y) / dy;
          float c0 = min(y0, y1), c1 = max(y0, y1);
          float t0 = max(s0, c0), t1 = min(s1, c1);
          vec3 p0 = o + s0 * d, p1 = o + s1 * d;
          n0 = s0 > c0 ? normalize(vec3(p0.x, 0.0, p0.z)) : vec3(0.0, -sign(dy), 0.0);
          n1 = s1 < c1 ? normalize(vec3(p1.x, 0.0, p1.z)) : vec3(0.0, sign(dy), 0.0);
          return vec3(t0, t1, t1 - t0);
        }
        // from p in the volume along d: how far to its outside
        float shellLeave(vec3 p, vec3 d) {
          if (uShell < 1.5) {
            float t = 1e3;
            for (int i = 0; i < ${SHELL_PLANES}; i++) {
              if (i >= uShellCount) break;
              float s = dot(uShellPlanes[i].xyz, d);
              if (s > 1e-6) t = min(t, (uShellOuter[i] - dot(uShellPlanes[i].xyz, p)) / s);
            }
            return max(t, 0.0);
          }
          vec2 size = uShellSize + uShellWall;
          if (uShell < 2.5) {
            float b = dot(p, d);
            return max(-b + sqrt(max(b * b - dot(p, p) + size.x * size.x, 0.0)), 0.0);
          }
          float a = max(dot(d.xz, d.xz), 1e-6), b = dot(p.xz, d.xz), c = dot(p.xz, p.xz) - size.x * size.x;
          float side = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
          float cap = abs(d.y) < 1e-6 ? 1e3 : (sign(d.y) * size.y - p.y) / d.y;
          return max(min(side, cap), 0.0);
        }
        uniform vec3 uDir, uOff, uC0, uC1, uC2, uAxis;
        uniform float uStraight;
        uniform float uScale;
        ${noiseGLSL}
        ${glsl}
        // bump from the height, in view space (Mikkelsen's surface gradient)
        vec3 bump(vec3 pos, vec3 n, float h) {
          vec3 dpx = dFdx(pos), dpy = dFdy(pos);
          vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
          return normalize(abs(det) * n - grad);
        }`
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\n#ifdef SURF_INIT\nsurfInit(vRest, vCut);\n#endif\ndiffuseColor.rgb = surfColor(vRest, vCut) * (0.97 + 0.03 * fbm(vRest * 2.0 - uOff));')
      .replace('#include <roughnessmap_fragment>', // nothing is evenly polished: the gloss varies a little over the surface
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(surfRough(vRest, vCut, roughnessFactor) * (1.0 + 0.4 * fbm(vRest * 3.0 + uOff)), 0.03, 1.0);')
      .replace(
        '#include <normal_fragment_maps>',
        '#include <normal_fragment_maps>\nvec3 smoothNormal = normal;\nnormal = bump(-vViewPosition, normal, surfHeight(vRest, vCut) * uScale);'
      )
      // The side of a cylinder is curved around its axis only: seen through,
      // it would be a cylindrical lens, what is inside it stretched across the
      // axis and not along it, a sphere become an ovoid. There the light is
      // refracted by the normal of the sphere through the point instead, curved
      // both ways like the side across, with the bumps on top: what is inside
      // looks as it would through a ball. The caps, the cuts, the reflections
      // are left as they are.
      // A hollow volume, seen through: where the ray, bent into the glass,
      // reaches the hollow, the light crosses the wall in front, the hollow,
      // and the wall behind, bent and tinted as much as the glass it went
      // through: little across a wall, more where it runs along one, by the
      // edges of the hollow and through its corners, where they show. The walls
      // inside reflect the room faintly, those in front from within the glass,
      // those behind from the hollow, each by its angle. Near the outline the
      // ray misses the hollow and stays in the glass: a rim, bent strongly and
      // darker, as thick as the glass would be whole. The pieces are thin,
      // their walls behind gone.
      .replace(
        '#include <transmission_fragment>',
        `#ifdef USE_TRANSMISSION
        float hollow = 0.0, through = 0.0, glassPath = 2.0 * uShellWall;
        // the ray in the wall in front, in the hollow, in the wall behind
        vec3 shellD, cavityD, backD, frontN, backN;
        if (uShell > 0.5) {
          vec3 rn = normalize(vRestNormal);
          vec3 eye = normalize(vRest - vEyeRest);
          shellD = refract(eye, rn, 1.0 / material.ior);
          vec3 hit = shellHit(vRest, shellD, frontN, backN);
          float aa = fwidth(hit.z) + 1e-4;
          // the outside only: the breaks and the inside are thin anyway
          bool outside = vCut < 0.5 && dot(rn, vRest) > 0.0;
          through = smoothstep(-aa, aa, hit.z) * step(0.0, hit.x);
          hollow = outside ? mix(1.0, through, uShellWhole) : 1.0;
          // out of the wall in front, the ray goes on as it came; across the
          // hollow, into the wall behind, and out
          vec3 p0 = vRest + hit.x * shellD;
          cavityD = eye;
          vec3 entered;
          vec3 h2 = shellHit(p0 - eye * 1e-3, eye, entered, backN);
          backD = refract(eye, -backN, 1.0 / material.ior);
          vec3 p1 = p0 + (h2.y - 1e-3) * eye;
          float back = shellLeave(p1, backD);
          if (outside) glassPath = mix(glassPath, hit.x + back, uShellWhole);
        }
        #endif
        ` + THREE.ShaderChunk.transmission_fragment.replace(
          'material.thickness = thickness;',
          'material.thickness = uShell > 0.5 ? mix(thickness, glassPath, hollow) : thickness;'
        ).replace(
          'vec3 n = inverseTransformDirection( normal, viewMatrix );',
          `float lensSide = uLens * (1.0 - vCut) * step(abs(dot(smoothNormal, normalize(vAxis))), 0.5);
        vec3 lensNormal = normalize(mix(normal, normalize(vLens) + normal - smoothNormal, lensSide));
        vec3 n = inverseTransformDirection( lensNormal, viewMatrix );`
        ).replace(
          'totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );',
          // Seen through, the volume only shows what is behind it on screen,
          // the paper: even, pale, as if it were milk. Toward its edges the
          // light, bent going in and again going out, comes from far aside:
          // there it shows the room, its dim walls and its bright softboxes,
          // and the edges are drawn as in a photograph of glass in a studio.
          `#ifdef ENVMAP_TYPE_CUBE_UV
          {
            vec3 exitDir = normalize(2.0 * refract(-v, n, 1.0 / material.ior) + v);
            float edge = uEdgeEnv * smoothstep(0.97, 0.45, abs(dot(n, v)));
            vec3 room = textureCubeUV(envMap, envMapRotation * exitDir, material.roughness + 0.04).rgb * envMapIntensity;
            transmitted.rgb = mix(transmitted.rgb, room * material.diffuseColor, edge);
          }
          #endif
          totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );`
        ) + `
        #ifdef USE_TRANSMISSION
        if (uShell > 0.5) {
          // the more glass, the dimmer: the walls seen along, the corners
          totalDiffuse *= mix(0.8, exp(-3.0 * max(glassPath - 2.0 * uShellWall, 0.0)), hollow);
          #ifdef USE_ENVMAP
          float inner = vCut < 0.5 && dot(vRestNormal, vRest) > 0.0 ? through : 0.0;
          // what the walls inside reflect: in front, from within the glass;
          // behind, from the hollow
          vec3 dView = normalize((viewMatrix * vec4(normalize((modelMatrix * vec4(shellD, 0.0)).xyz), 0.0)).xyz);
          vec3 nView = normalize((viewMatrix * vec4(normalize((modelMatrix * vec4(frontN, 0.0)).xyz), 0.0)).xyz);
          float f = 0.04 + 0.96 * pow(1.0 - abs(dot(dView, nView)), 5.0);
          totalSpecular += inner * 1.4 * f * getIBLRadiance(-dView, nView, material.roughness);
          vec3 cView = normalize((viewMatrix * vec4(normalize((modelMatrix * vec4(cavityD, 0.0)).xyz), 0.0)).xyz);
          vec3 bView = normalize((viewMatrix * vec4(normalize((modelMatrix * vec4(-backN, 0.0)).xyz), 0.0)).xyz);
          float fb = 0.04 + 0.96 * pow(1.0 - abs(dot(cView, bView)), 5.0);
          totalSpecular += inner * uShellWhole * (1.0 - f) * fb * getIBLRadiance(-cView, bView, material.roughness);
          #endif
        }
        #endif`
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - vCut;\n#endif'
      );
  };
  return { material: m, uniforms, shadow, restyle };
}
