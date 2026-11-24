import * as THREE from 'three';

// What every material of the scene shares: the lights (a warm key from the upper left
// in front, the only one casting shadows; a cool rim from behind on the right that shines
// through the feathers at the edge of the coat; a sky and ground bounce for the rest),
// the key's shadow map (see shadow.js), the body's place (for the coat's occlusion and the
// floor's contact shadow), and a few noises.

export const LIGHTS = {
  uKeyDir: { value: new THREE.Vector3(-2.2, 4.2, 3.0).normalize() },
  uKeyColor: { value: new THREE.Color(1.0, 0.9, 0.78).multiplyScalar(3.1) },
  uRimDir: { value: new THREE.Vector3(2.6, 2.2, -3.6).normalize() },
  uRimColor: { value: new THREE.Color(0.75, 0.85, 1.0).multiplyScalar(2.2) },
  uSky: { value: new THREE.Color(0.55, 0.6, 0.68).multiplyScalar(0.62) },
  uBounce: { value: new THREE.Color(0.62, 0.52, 0.44).multiplyScalar(0.34) },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
  // the map's span in world units: across (its side) and in depth (far - near)
  uShadowSpan: { value: new THREE.Vector2(8.4, 23.5) },
  // the body: center (xyz) and the skin's radius (w); the coat's outer radius, and how
  // much of it is left (0 naked … 1 full)
  uBody: { value: new THREE.Vector4(0, 1, 0, 0.45) },
  uFluff: { value: 0.87 },
  uCoverage: { value: 1 },
  uTime: { value: 0 },
};

// The box the key's shadow map covers, seen from the key: a square of half-side extent
// round center, across the light. The creature is kept inside it (creature.js), so its
// shadow on the floor is never cut.
export const SHADOW_BOX = { center: new THREE.Vector3(0, 1.2, 0), extent: 4.2 };

export const GLSL_COMMON = /* glsl */ `
uniform vec3 uKeyDir, uKeyColor, uRimDir, uRimColor, uSky, uBounce;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform vec2 uShadowSpan;
uniform vec4 uBody;
uniform float uFluff, uCoverage, uTime;

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float hash13(vec3 p3) { p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
vec3 hash33(vec3 p3) { p3 = fract(p3 * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yxz + 33.33); return fract((p3.xxy + p3.yxx) * p3.zyx); }

float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

vec3 hemi(vec3 n) { return mix(uBounce, uSky, smoothstep(-0.6, 0.8, n.y)); }

// the key's shadow, softened by a disc of 12 taps turned per pixel
const vec2 POISSON[12] = vec2[12](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893),
  vec2(0.507, 0.064), vec2(0.896, 0.412), vec2(-0.322, -0.933), vec2(-0.792, -0.598));
float shadowAt(vec3 wp, vec3 n, float soft, float bias) {
  vec3 p = wp + n * uShadowTexel * 6.0 + uKeyDir * bias;
  vec4 sc = uShadowMatrix * vec4(p, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 1.0;
  float a = hash12(gl_FragCoord.xy) * 6.2832;
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  float lit = 0.0;
  for (int i = 0; i < 12; i++) {
    float d = texture2D(uShadowMap, s.xy + r * POISSON[i] * soft * uShadowTexel).r;
    lit += step(s.z - 0.0006, d);
  }
  return lit / 12.0;
}

// The key's shadow on the floor, contact hardening (PCSS): the blockers over the point
// found first, the penumbra then grows with their height above it, as under a broad
// soft key: crisp where a feather lies on the floor, wide and faint under the body.
// lightSize: the penumbra's width per unit of height; minSoft: in texels.
float softShadowAt(vec3 wp, float lightSize, float minSoft) {
  vec4 sc = uShadowMatrix * vec4(wp + uKeyDir * 0.002, 1.0);
  vec3 s = sc.xyz / sc.w * 0.5 + 0.5;
  if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 1.0;
  // interleaved gradient noise: an even turn per pixel, finer than white noise
  float a = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;
  mat2 r = mat2(cos(a), sin(a), -sin(a), cos(a));
  float uvPerWorld = 1.0 / uShadowSpan.x;
  // blockers: searched as wide as the widest penumbra (a blocker 1.6 above)
  float search = lightSize * 1.6 * uvPerWorld;
  float sum = 0.0, n = 0.0;
  for (int i = 0; i < 16; i++) {
    float f = (float(i) + 0.5) / 16.0;
    vec2 o = vec2(cos(float(i) * 2.39996), sin(float(i) * 2.39996)) * sqrt(f);
    float d = texture2D(uShadowMap, s.xy + r * o * search).r;
    if (d < s.z - 0.0006) { sum += d; n += 1.0; }
  }
  if (n < 0.5) return 1.0;
  float h = (s.z - sum / n) * uShadowSpan.y;
  float rad = max(h * lightSize * uvPerWorld, minSoft * uShadowTexel);
  float lit = 0.0;
  for (int i = 0; i < 32; i++) {
    float f = (float(i) + 0.5) / 32.0;
    vec2 o = vec2(cos(float(i) * 2.39996), sin(float(i) * 2.39996)) * sqrt(f);
    lit += step(s.z - 0.0006, texture2D(uShadowMap, s.xy + r * o * rad).r);
  }
  return lit / 32.0;
}

// Kajiya-Kay: the highlight of a fibre along T
float fibre(vec3 T, vec3 H, float e) {
  float th = dot(T, H);
  return pow(sqrt(max(1.0 - th * th, 0.0)), e);
}
`;

// a shader material on the shared lights, with its own uniforms
export function litMaterial({ uniforms = {}, vertexShader, fragmentShader, ...rest }) {
  return new THREE.ShaderMaterial({
    uniforms: { ...LIGHTS, ...uniforms },
    vertexShader,
    fragmentShader: GLSL_COMMON + fragmentShader,
    ...rest,
  });
}

// a seeded random (mulberry32)
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
