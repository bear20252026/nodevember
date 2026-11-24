import * as THREE from 'three';

// The marble of the shell, as in 02_shatter: solid, its pattern drawn in 3D
// at the point of the shell each pixel comes from (the `rest` attribute), so
// the veins carry on across the seams and through the thickness of the wall.
// The faces that were never polished (the `cut` attribute: the inside, the
// walls of the seams) are honed, sugary.

const noiseGLSL = /* glsl */ `
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
`;

// soft clouded veins, a few thin ones across them, pits; as in 02_shatter
const marbleGLSL = /* glsl */ `
  // vein, thin, cloud
  vec3 veinsAt(vec3 p) {
    vec3 q = p * 1.3 + uOff;
    float t = dot(q, uDir) * 1.6 + 1.8 * fbm(q * 1.2);
    float vein = smoothstep(0.7, 1.0, 1.0 - abs(sin(t * 3.14159))) * (0.6 + 0.4 * fbm(q * 3.0 + 5.0));
    float thin = smoothstep(0.97, 1.0, 1.0 - abs(sin((t * 3.1 + 0.8 * fbm(q * 4.0)) * 3.14159)));
    return vec3(vein, thin, fbm(q * 2.5));
  }
  // tiny pits where crystals came off in the polishing
  float pitAt(vec3 p) { return smoothstep(0.75, 0.95, snoise(p * 80.0 + 9.0)) * resolved(p, 80.0); }
  vec3 gVeins;
  float gPit;
  void surfInit(vec3 p) { gVeins = veinsAt(p); gPit = pitAt(p); }
  vec3 surfColor(vec3 p, float cut) {
    vec3 v = gVeins;
    vec3 base = mix(uC0, uC0 * 0.9, 0.5 + 0.5 * v.z);
    vec3 c = mix(base, uC1, clamp(0.75 * v.x + 0.35 * v.y, 0.0, 1.0)) * (1.0 - 0.12 * gPit);
    return mix(c, c * 1.03, cut);
  }
  // the softer veins take the polish less; scratches, pits
  float surfRough(vec3 p, float cut, float r) {
    float outside = r + 0.08 * gVeins.x + 0.3 * scratches(p, 70.0) + 0.3 * gPit;
    return mix(outside, 0.55, cut);
  }
  // the veins a hair sunken; sugary crystals on the unpolished faces
  float surfHeight(vec3 p, float cut) {
    return mix(-0.0003 * gVeins.x - 0.0006 * gPit, 0.0012 * snoise(p * 55.0), cut);
  }
`;

// Shared by the marble and the brass. Where a part hides the sun from
// another, it hides the window too: the room light dims in the sun's shadows
// (uShade: how much), as in 02_shatter. And the hollow: the room's light
// fades from the outside of the wall to its inside (vDepth, 0 to 1), down to
// uCavity. The shadows need vRest, the point in the shell.
const LIGHTS_BEGIN = 'float keyLit = 1.0;\n' + THREE.ShaderChunk.lights_fragment_begin.replace(
  'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]',
  'keyLit = ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]'
).replace(
  'vDirectionalShadowCoord[ i ] ) : 1.0;',
  'vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\tdirectLight.color *= keyLit;'
);
const AO_FRAGMENT = /* glsl */ `#include <aomap_fragment>
  {
    float shade = 1.0;
    #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
    float facing = smoothstep(0.0, 0.35, dot(geometryNormal, directionalLights[0].direction));
    shade = 1.0 - uShade * facing * (1.0 - keyLit);
    #endif
    // the hollow: darker the deeper in the wall, dark inside
    float depth = smoothstep(0.0, 1.0, vDepth);
    float cavity = mix(1.0, uCavity, depth);
    reflectedLight.indirectDiffuse *= shade * cavity;
    reflectedLight.indirectSpecular *= mix(1.0, shade, 0.6) * cavity;
  }`;

// a color with its saturation scaled by s
const _gray = new THREE.Color();
const desaturate = (c, s) => c.lerp(_gray.setScalar(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722), 1 - s);

// The marble, in the style (see styles.js). Inside the shell the room's light
// hardly gets in, through the seams only: the light of the room (not the sun's,
// which has its shadows) fades from the outside of the wall to its inside
// (the `depth` attribute), down to uCavity.
export function marbleMaterial(style) {
  const palette = style.palettes.marble;
  const colors = palette[Math.floor(Math.random() * palette.length)].map((c) => desaturate(new THREE.Color(c), style.saturation ?? 1));
  const uniforms = {
    uDir: { value: new THREE.Vector3().randomDirection() },
    uOff: { value: new THREE.Vector3().randomDirection().multiplyScalar(Math.random() * 0.6) },
    uC0: { value: colors[0] },
    uC1: { value: colors[1] },
    uScale: { value: 1 },
    uShade: { value: style.shade ?? 0.6 },
    uCavity: { value: style.cavity ?? 0.12 },
  };
  const m = new THREE.MeshPhysicalMaterial({ metalness: 0, roughness: 0.25, clearcoat: 0.2, clearcoatRoughness: 0.25, ...style.materials?.marble });
  m.customProgramCacheKey = () => 'marble';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rest;\nattribute float cut;\nattribute float depth;\nvarying vec3 vRest;\nvarying float vCut;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = rest;\nvCut = cut;\nvDepth = depth;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying float vCut;
        varying float vDepth;
        uniform vec3 uDir, uOff, uC0, uC1;
        uniform float uScale, uShade, uCavity;
        ${noiseGLSL}
        ${marbleGLSL}
        // bump from the height, in view space (Mikkelsen's surface gradient)
        vec3 bump(vec3 pos, vec3 n, float h) {
          vec3 dpx = dFdx(pos), dpy = dFdy(pos);
          vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
          float det = dot(dpx, r1);
          vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
          return normalize(abs(det) * n - grad);
        }`
      )
      .replace('#include <color_fragment>', '#include <color_fragment>\nsurfInit(vRest);\ndiffuseColor.rgb = surfColor(vRest, vCut) * (0.97 + 0.03 * fbm(vRest * 2.0 - uOff));')
      // nothing is evenly polished: the gloss varies a little over the surface
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = clamp(surfRough(vRest, vCut, roughnessFactor) * (1.0 + 0.4 * fbm(vRest * 3.0 + uOff)), 0.03, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = bump(-vViewPosition, normal, surfHeight(vRest, vCut) * uScale);')
      .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
      .replace('#include <aomap_fragment>', AO_FRAGMENT)
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= 1.0 - vCut;\n#endif'
      );
  };
  return { material: m, uniforms };
}

// The brass along the seams: polished, worn unevenly, a little tarnished in
// places (darker, duller), the same shading as the marble (uShade, the hollow).
// Its color from the style (style.brass), as are its material's settings.
export function brassMaterial(style) {
  const uniforms = {
    uOff: { value: new THREE.Vector3().randomDirection().multiplyScalar(5 + Math.random() * 5) },
    uShade: { value: style.shade ?? 0.6 },
    uCavity: { value: style.cavity ?? 0.12 },
  };
  const m = new THREE.MeshPhysicalMaterial({ color: style.brass ?? '#d9b46a', metalness: 1, roughness: 0.26, ...style.materials?.brass });
  m.customProgramCacheKey = () => 'brass';
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rest;\nattribute float depth;\nvarying vec3 vRest;\nvarying float vDepth;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = rest;\nvDepth = depth;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRest;
        varying float vDepth;
        uniform vec3 uOff;
        uniform float uShade, uCavity;
        ${noiseGLSL}
        float gTarnish;`
      )
      .replace('#include <color_fragment>', `#include <color_fragment>
        gTarnish = smoothstep(0.05, 0.6, fbm(vRest * 4.0 + uOff));
        diffuseColor.rgb *= mix(1.0, 0.62, gTarnish) * (0.94 + 0.06 * fbm(vRest * 30.0 + uOff));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + 0.5 * fbm(vRest * 9.0 - uOff)) + 0.25 * gTarnish + 0.25 * scratches(vRest, 120.0), 0.05, 1.0);`)
      .replace('#include <lights_fragment_begin>', LIGHTS_BEGIN)
      .replace('#include <aomap_fragment>', AO_FRAGMENT);
  };
  return { material: m, uniforms };
}
