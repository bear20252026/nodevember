// The water round the kelp: its colour by the direction looked in (lighter up toward the
// surface, shafts of light slanting down), the fog that fades everything into it, the
// caustics the surface throws on what faces up, the sandy floor and its rocks, and the
// marine snow drifting through.
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FOREST_WAKES, FOREST_REACH2, FOREST_PUSH, FOREST_BEND } from './stir.js';

export const SURFACE_Y = 26; // the light dims below the surface

// where the light comes from: the sun, high overhead (a midday sun, out of the view: the scene
// lit by it, not the eye blinded by it), ahead and a little to the left, so the blades facing
// the camera are lit through, golden, and the shafts slant down toward the camera
const LX = -0.3, LY = 1.1, LZ = -0.6, LN = Math.hypot(LX, LY, LZ);
const LIGHT = `vec3(${(LX / LN).toFixed(4)}, ${(LY / LN).toFixed(4)}, ${(LZ / LN).toFixed(4)})`;

const SHAFT_GLSL = /* glsl */ `
// the shafts of light: the surface lets the light through in patches that drift, each a
// beam slanting down along the light; a point is in a beam if, followed up toward the
// light to the surface, it lands in a bright patch
float shaft(vec3 p) {
  vec2 s = p.xz + LIGHT.xz * ((SURFACE - p.y) / LIGHT.y);
  float t = uTime;
  float n = wNoise(s * 0.11 + vec2(t * 0.035, t * 0.018)) * 0.6 + wNoise(s * 0.29 + vec2(-t * 0.05, t * 0.04)) * 0.4;
  return smoothstep(0.58, 0.7, n);
}
`;

// shared GLSL: waterColor(dir), caustic(p, t), shaft(p), applyWater(col, worldPos) (fog)
export const WATER_GLSL = /* glsl */ `
uniform float uTime;
uniform vec3 uCam;
uniform float uFog;
uniform sampler2D uNoise;
#define LIGHT ${LIGHT}
#define SURFACE ${SURFACE_Y.toFixed(1)}

float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// smooth value noise, one fetch: the texture's own interpolation, eased between texels
float wNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return texture2D(uNoise, (i + f + 0.5) / 256.0).r;
}

// the colour of the water looked through in the direction d: a deep blue-black below,
// a dark blue-green level with the eye, brightening steeply to a clear turquoise toward the
// surface (deep and saturated, never milky), warm and bright round the sun, where the
// water scatters its light most
vec3 waterColor(vec3 d) {
  float y = d.y;
  vec3 deep = vec3(0.0, 0.012, 0.045);
  vec3 low = vec3(0.0, 0.06, 0.13);
  vec3 mid = vec3(0.0, 0.17, 0.27);
  vec3 hi = vec3(0.0, 0.36, 0.58);
  vec3 top = vec3(0.02, 0.6, 0.92);
  vec3 c = mix(deep, low, smoothstep(-0.45, -0.1, y));
  c = mix(c, mid, smoothstep(-0.12, 0.08, y));
  c = mix(c, hi, smoothstep(0.05, 0.35, y));
  c = mix(c, top, smoothstep(0.3, 0.75, y));
  float sw = max(dot(d, LIGHT), 0.0);
  c += vec3(0.03, 0.08, 0.07) * pow(sw, 8.0);
  return c;
}
// the sun seen through the water: a broad warm glow, a halo round it and its blinding core
// (far past white: the bloom spreads it); what stands in front of it hides it
vec3 sunGlow(vec3 d) {
  float sw = max(dot(d, LIGHT), 0.0);
  return vec3(0.1, 0.16, 0.12) * pow(sw, 24.0) + vec3(1.2, 1.1, 0.8) * pow(sw, 200.0) + vec3(16.0, 14.0, 10.0) * pow(sw, 2500.0);
}

// the water a point fades into darkens with the point's depth: the haze round the foot of
// the forest is the dark of the deep, the haze up toward the surface pale
float depthDim(float y) { return mix(0.55, 1.0, smoothstep(-3.0, 14.0, y)); }

// caustic network (after joltz0r's water shader): bright threads on a dark ground
float caustic(vec2 p, float t) {
  const float TAU = 6.28318530718;
  p = mod(p * TAU, TAU) - 250.0;
  vec2 i = p;
  float c = 1.0;
  float inten = 0.005;
  for (int n = 0; n < 4; n++) {
    float tt = t * (1.0 - (3.5 / float(n + 1)));
    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
  }
  c /= 4.0;
  c = 1.17 - pow(c, 1.4);
  return clamp(pow(abs(c), 8.0), 0.0, 3.0);
}

float lightAt(float y) { return exp(-max(0.0, SURFACE - y) * 0.03); }

${SHAFT_GLSL}
// the light the water scatters toward the eye along a ray, from the beams it crosses
vec3 inscatter(vec3 o, vec3 dir, float dist, float jitter) {
  float L = min(dist, 70.0);
  float acc = 0.0;
  for (int i = 0; i < 10; i++) {
    float t = (float(i) + jitter) / 10.0 * L;
    vec3 p = o + dir * t;
    acc += shaft(p) * exp(-t * 0.03) * exp(-max(0.0, SURFACE - p.y) * 0.03);
  }
  acc *= L / 10.0;
  // brighter looking toward the light, where the water scatters most
  float ph = 0.5 + 0.7 * pow(max(dot(dir, LIGHT), 0.0), 14.0);
  return vec3(0.3, 0.55, 0.45) * acc * 0.055 * ph;
}

// a stray non-finite colour (a degenerate normal at a blade's tip) would bloom into a hole
vec3 finite(vec3 c) { return (any(isnan(c)) || any(isinf(c))) ? vec3(0.0) : min(c, vec3(16.0)); }

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

vec3 applyWater(vec3 col, vec3 w) {
  vec3 v = w - uCam;
  float d = length(v);
  // the water takes the red first, then the green: what is warm near goes teal and greyer
  // with distance
  col *= exp(-max(d - 8.0, 0.0) * vec3(0.022, 0.004, 0.002));
  col = mix(col, vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), clamp((d - 8.0) * 0.004, 0.0, 0.08));
  float f = 1.0 - exp(-d * uFog);
  f = f * f * (3.0 - 2.0 * f) * 0.35 + f * 0.65;
  col = mix(col, waterColor(v / d) * mix(1.0, depthDim(w.y), smoothstep(0.0, 0.5, f)), clamp(f, 0.0, 1.0));
  return col + inscatter(uCam, v / d, d, ign(gl_FragCoord.xy));
}
`;

// a tile of random values, for wNoise
function noiseTexture() {
  const rand = rngOf(1234);
  const data = new Uint8Array(256 * 256 * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rand() * 256);
  const tex = new THREE.DataTexture(data, 256, 256);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export const sharedUniforms = {
  uNoise: { value: noiseTexture() },
  uTime: { value: 0 },
  uCam: { value: new THREE.Vector3() },
  uFog: { value: 0.015 },
};

const OUT = /* glsl */ `
  gl_FragColor = vec4(finite(col), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// ---- the background: the water seen past everything
export function createBackground(camera) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...sharedUniforms, uProjInv: { value: camera.projectionMatrixInverse }, uCamWorld: { value: camera.matrixWorld } },
    vertexShader: /* glsl */ `
      uniform mat4 uProjInv; uniform mat4 uCamWorld;
      varying vec3 vDir;
      void main() {
        vec4 p = uProjInv * vec4(position.xy, 1.0, 1.0);
        vDir = mat3(uCamWorld) * (p.xyz / p.w);
        gl_Position = vec4(position.xy, 0.9999, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      ${WATER_GLSL}
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = waterColor(d);
        // the surface far above: a wavering sheet, bright where the waves let the light
        // through, glittering, fading into the water with distance
        float far = 120.0;
        if (d.y > 0.0) {
          float t = (SURFACE - uCam.y) / d.y;
          far = min(far, t);
          vec2 q = (uCam + d * t).xz;
          vec2 wq = q + vec2(wNoise(q * 0.06 + uTime * 0.05), wNoise(q * 0.06 - uTime * 0.04 + 7.0)) * 6.0;
          // the waves' facets catching the sun: a bright net of light on a clear turquoise,
          // brightest toward the sun (its window through the surface), glittering
          float c = caustic(wq * 0.05, uTime * 0.35);
          float c2 = caustic(wq * 0.11 + 3.7, uTime * 0.5);
          float pat = 0.75 + 0.25 * wNoise(wq * 0.04 + uTime * 0.02);
          float sw = max(dot(d, LIGHT), 0.0);
          float win = 0.35 + 0.65 * pow(sw, 3.0) + 1.5 * pow(sw, 16.0);
          float gl = pow(wNoise(q * 0.9 + uTime * vec2(0.7, 0.4)) * wNoise(q * 1.3 - uTime * vec2(0.3, 0.8) + 3.0), 4.0);
          vec3 surf = vec3(0.02, 0.5, 0.82) * pat + vec3(0.7, 1.05, 0.95) * (c * 0.45 + c2 * 0.2) * win
            + vec3(0.9, 1.0, 0.85) * pow(sw, 6.0) * 0.6 + vec3(1.2, 1.15, 1.0) * gl * 1.2 * win;
          float vis = exp(-t * 0.012) * smoothstep(0.02, 0.2, d.y);
          col = mix(col, surf, vis);
        }
        col += inscatter(uCam, d, far, ign(gl_FragCoord.xy));
        col += sunGlow(d);
        ${OUT}
      }`,
    depthWrite: false,
  });
  // drawn last, at the far plane: only where nothing else is
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  return mesh;
}

// ---- the lit material shared by the kelp, the floor and the rocks: vertex colours, uv.x
// along a strand (0 base … 1 tip), uv.y across it (-1 … 1; |v| ≥ 2 marks a float/rock).
// The kelp's tissue (kelp.js): aInfo (arc length along the strand and distance across it,
// both in plant units, as grown; how blistered it is; how spotted) and aEdge (spines on
// its margins, how worn its tip, how dented its margins): a blade is wrinkled and blistered by a bump map in those
// coordinates, glows golden where the light comes through it, thinner at its edges,
// carries white specks of epiphytes, and its edges are spined and its tip torn by cutting
// it out (alpha to coverage, so the cut stays smooth).
export function createLitMaterial({ floor = false } = {}) {
  return new THREE.ShaderMaterial({
    uniforms: sharedUniforms,
    side: THREE.DoubleSide,
    defines: floor ? { FLOOR: 1 } : {},
    alphaToCoverage: !floor,
    // (centroid: multisampled, a pixel on the edge of a thin strand would otherwise be
    // shaded at its centre, off the triangle, its values carried past the vertices' —
    // |uv.y| past 2.5 shading a speck of a cord as a rock, red with the strand's numbers
    // read as the sand's colour)
    vertexShader: /* glsl */ `
      attribute vec4 aInfo; attribute vec3 aEdge; attribute vec2 aRip; attribute float aOcc;
      centroid varying vec3 vN; centroid varying vec3 vW; centroid varying vec3 vC; centroid varying vec2 vUv; centroid varying vec4 vInfo; centroid varying vec3 vEdge; centroid varying vec2 vRip; centroid varying float vOcc;
      void main() {
        vRip = aRip; vOcc = aOcc;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vC = color; vUv = uv; vInfo = aInfo; vEdge = aEdge;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${WATER_GLSL}
      centroid varying vec3 vN; centroid varying vec3 vW; centroid varying vec3 vC; centroid varying vec2 vUv; centroid varying vec4 vInfo; centroid varying vec3 vEdge; centroid varying vec2 vRip; centroid varying float vOcc;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float vnoise3(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
          f.z);
      }
      // a rock's relief, in world units: lumps, then a rough crust pitted with small round
      // holes (a few cells of a grid hold one), each scale weighted by w (faded where finer
      // than a pixel)
      float rockH(vec3 p, vec3 w) {
        float h = vnoise3(p * 1.3) * 0.5 * w.x;
        h += (vnoise3(p * 4.1 + 5.0) - 0.5) * 0.22 * w.y;
        vec3 c = floor(p * 6.0), f = fract(p * 6.0);
        vec3 o = vec3(hash3(c + 1.7), hash3(c + 4.3), hash3(c + 8.9)) * 0.5 + 0.25;
        float pr = 0.1 + 0.15 * hash3(c + 2.9);
        float pit = step(hash3(c), 0.35) * (1.0 - smoothstep(pr * 0.4, pr, length(f - o)));
        h -= pit * 0.05 * w.z;
        h += (vnoise3(p * 23.0) - 0.5) * 0.04 * w.z;
        return h;
      }
      // the blade's relief, in plant units (p: along, across): soft swells drawn out long
      // along it, and veins running lengthwise, kinked by the noise
      // and, close up (w: how much of each finer scale shows), a faint rugose skin: shallow
      // dimples stretched along it, and the fibres running its length
      float relief(vec2 p, vec2 w) {
        float b = vnoise(p * vec2(0.2, 1.1)) * 0.65 + vnoise(p * vec2(0.45, 2.4) + 11.0) * 0.35;
        float k = sin(p.y * 6.0 + vnoise(p * vec2(0.25, 1.6)) * 5.0);
        float h = b * b * 0.9 + k * 0.16;
        if (w.x > 0.0) {
          vec2 g = p * vec2(0.4, 1.35), c = floor(g), f = fract(g);
          float d = 9.0;
          for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++) {
            vec2 o = vec2(float(i), float(j));
            vec2 q = o + vec2(hash(c + o), hash(c + o + 5.3)) * 0.8 + 0.1 - f;
            d = min(d, dot(q, q));
          }
          h += smoothstep(0.05, 0.6, sqrt(d)) * 0.1 * w.x;
        }
        h += (vnoise(p * vec2(0.6, 4.0) + 3.0) - 0.5) * 0.12 * w.y;
        return h;
      }
      // white specks: a few cells of a grid hold a dot each
      float specks(vec2 p, float amount) {
        vec2 g = p * vec2(1.6, 2.2);
        vec2 c = floor(g), f = fract(g);
        float r = hash(c);
        if (r > amount) return 0.0;
        vec2 o = vec2(hash(c + 3.1), hash(c + 7.7)) * 0.6 + 0.2;
        float size = 0.06 + 0.16 * hash(c + 1.9) * hash(c + 5.3);
        float d = length((f - o) * vec2(1.0, 0.75));
        float aa = length(fwidth(g)) * 0.7 + 1e-4; // fwidth(d) would jump at the cells' seams
        return 1.0 - smoothstep(size - aa, size + aa, d);
      }
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(uCam - vW);
        if (dot(N, V) < 0.0) N = -N;
        vec3 L = LIGHT;
        vec3 base = vC;
        float tr = 0.0, gloss = 0.25, thin = 0.0, alpha = 1.0, kelp = 0.0;
      #ifdef FLOOR
        // the sand's texture, in world units (q: x, z), each scale faded out where it gets
        // finer than a pixel (px: the size of one here)
        vec2 q = vW.xz;
        float px = max(length(fwidth(q)), 1e-4);
        float smF = 1.0 - smoothstep(0.03, 0.12, px);  // small ripples, ~0.6 apart
        float grF = 1.0 - smoothstep(0.012, 0.05, px); // the grains
        // the ripples are in the mesh (ripple() below): here only where on one we are (rp:
        // 0 trough … 1 crest) and how strong they are there (rk), for the colour
        float rp = vRip.x, rk = vRip.y;
        float s = rp * 2.0 - 1.0;
        // smaller ripples riding over them, at an angle, in the troughs most
        float ph2 = q.x * 7.0 - q.y * 4.1 + vnoise(q * 1.3 + 7.0) * 6.0;
        float a2 = 0.018 * (0.6 - 0.4 * s) * (1.4 - rk);
        vec2 gRel = vec2(7.0, -4.1) * cos(ph2) * a2 * smF;
        // grains: fine noise in the relief and in the colour
        float g1 = vnoise(q * 22.0), g2 = vnoise(q * 53.0 + 3.0);
        float ge = 0.02;
        gRel += vec2(vnoise((q + vec2(ge, 0.0)) * 22.0) - g1, vnoise((q + vec2(0.0, ge)) * 22.0) - g1) / ge * 0.004 * grF;
        N = normalize(N - vec3(gRel.x, 0.0, gRel.y) * 1.8);
        // colour: paler on the crests, the troughs gather darker detritus
        float trough = smoothstep(0.3, 0.0, rp) * rk;
        base *= 1.0 + 0.12 * s * rk;
        base = mix(base, base * vec3(0.62, 0.58, 0.5), trough * 0.55 * (0.5 + vnoise(q * 2.2)));
        // patches: darker silt, pale shell-sand, a thin green-brown film of diatoms
        float m1 = vnoise(q * 0.45 + 2.0), m2 = vnoise(q * 0.13 - 5.0);
        base *= 0.86 + 0.28 * vnoise(q * 1.7);
        base = mix(base, base * vec3(0.72, 0.7, 0.62), smoothstep(0.55, 0.85, m2) * 0.7);
        base = mix(base, vec3(0.86, 0.82, 0.72), smoothstep(0.62, 0.9, m1) * 0.25);
        base = mix(base, base * vec3(0.78, 0.92, 0.6), smoothstep(0.5, 0.8, vnoise(q * 0.22 + 9.0)) * 0.45);
        // grains: light quartz and dark mineral specks, averaging out with distance
        float grain = (g1 - 0.5) * 0.6 + (g2 - 0.5) * 0.9;
        base *= 1.0 + grain * 0.35 * grF;
        vec2 dc = floor(q * 15.0);
        vec2 dj = vec2(hash(dc + 4.2), hash(dc + 8.6)) * 0.5 + 0.25;
        float dark = smoothstep(0.84, 0.94, hash(dc)) * smoothstep(0.2, 0.06, length(fract(q * 15.0) - dj));
        base = mix(base, base * 0.45, dark * grF);
        // scattered bits of shell and pebbles, a few to the cell, half buried
        vec2 cq = q * 1.6;
        vec2 cc = floor(cq), cf = fract(cq);
        float h = hash(cc + 17.0);
        if (h < 0.16) {
          vec2 o = vec2(hash(cc + 3.1), hash(cc + 7.7)) * 0.6 + 0.2;
          float an = hash(cc + 1.3) * 6.28;
          vec2 dv = mat2(cos(an), sin(an), -sin(an), cos(an)) * (cf - o);
          bool shell = h < 0.09;
          float size = (shell ? 0.07 : 0.1) + 0.12 * hash(cc + 5.3);
          float d = length(dv * vec2(1.0, 1.7)) / size;
          float aa = fwidth(d) + 1e-4;
          float m = (1.0 - smoothstep(1.0 - aa, 1.0 + aa, d)) * smF;
          float hc = hash(cc + 2.0);
          vec3 bc = shell ? mix(vec3(0.78, 0.7, 0.58), vec3(0.74, 0.56, 0.5), hc) // cream, pinkish
                          : mix(vec3(0.26, 0.25, 0.23), vec3(0.42, 0.34, 0.26), hc) * (0.7 + 0.4 * hash(cc + 6.1));
          if (shell) bc *= 0.85 + 0.15 * sin(atan(dv.y, dv.x) * 9.0); // ridges of a shell
          base = mix(base, bc, m * (0.75 + 0.25 * smoothstep(1.0, 0.4, d))); // sand dusting its rim
          // a dome: tilt the normal outward, and a shadow ring at its foot
          vec2 dn = cf - o;
          N = normalize(N + vec3(dn.x, 0.0, dn.y) / size * 0.35 * m);
          base *= 1.0 - 0.35 * smoothstep(0.9, 1.0, d) * (1.0 - smoothstep(1.0, 1.35, d)) * smF;
          gloss = mix(0.05, shell ? 0.2 : 0.1, m);
        } else {
          gloss = 0.05;
        }
      #else
        float v = abs(vUv.y);
        if (v < 1.5) {
          kelp = 1.0;
          vec2 p = vInfo.xy;
          float bump = vInfo.z;
          float edge = smoothstep(0.55, 1.0, v);
          // the cut-out: spines along the margins, a torn, worn tip
          // (a stipe or a cord is marked by teeth < 0: round, never cut)
          bool cord = vEdge.x < 0.0;
          float teeth = vEdge.x, tatter = vEdge.y;
          float lim = 1.0;
          if (teeth > 0.0) {
            float tp = fract(p.x * 1.15 + vnoise(vec2(p.x * 0.7, sign(vUv.y) * 9.0)) * 0.8);
            lim -= teeth * 0.13 * smoothstep(0.55, 1.0, tp) * step(0.12, vUv.x);
          }
          if (tatter > 0.0) {
            float wear = smoothstep(1.0 - 0.35 * tatter, 1.0, vUv.x);
            float nz = vnoise(vec2(p.y * 2.2, p.x * 0.6)) * 0.7 + vnoise(vec2(p.y * 6.0, p.x * 1.7)) * 0.3;
            lim -= wear * 1.3 * nz;
            lim -= tatter * 0.35 * smoothstep(0.75, 1.0, vnoise(vec2(p.x * 0.35, sign(vUv.y) * 5.0))) * smoothstep(0.4, 0.9, vUv.x);
          }
          if (vEdge.z > 0.0) {
            // small damage here and there: a bite out of the margin, a nick, in some of the
            // stretches (DENT units long) along each side, as deep in units whatever the
            // blade's width, rounded, with ragged lips
            const float DENT = 3.2;
            float sd = sign(vUv.y) * 7.0, ci = floor(p.x / DENT);
            if (hash(vec2(ci, sd + 3.0)) < vEdge.z) {
              float h2 = hash(vec2(ci, sd + 11.0)), h3 = hash(vec2(ci, sd + 19.0)), h4 = hash(vec2(ci, sd + 23.0));
              float w = 0.3 + 0.75 * h2 * h2; // half its length along the margin
              float c = (ci + 0.5) * DENT + (h3 - 0.5) * (DENT - 2.0 * w);
              float dx = (p.x - c) / w;
              float bite = sqrt(max(0.0, 1.0 - dx * dx)) * (0.85 + 0.3 * vnoise(vec2(p.x * 9.0, sd)));
              float hw = abs(p.y) / max(v, 1e-3);
              lim -= (0.25 + 0.5 * h4) * (0.6 + 0.5 * w) * bite / max(hw, 0.3) * step(0.08, vUv.x);
            }
          }
          float aa = fwidth(v) * 1.2 + 1e-4;
          alpha = cord ? 1.0 : 1.0 - smoothstep(lim - aa, lim + aa, v); // (a cord is never cut: a thin one would only dither)
          if (alpha < 0.02) discard;
          // how big a pixel is here, in plant units: the finer scales of the tissue fade
          // out where they would be smaller than one
          vec2 dx = dFdx(p), dy = dFdy(p);
          float fw = max(length(vec2(dx.x, dy.x)), length(vec2(dx.y, dy.y)));
          vec2 fine = vec2(1.0 - smoothstep(0.12, 0.28, fw), 1.0 - smoothstep(0.05, 0.11, fw));
          float h = 0.0;
          if (bump > 0.0) {
            // the relief's slope along and across, carried onto the surface: the screen
            // derivatives of (along, across) give the directions they run in, in the world
            float e = 0.03;
            h = relief(p, fine);
            float hs = (relief(p + vec2(e, 0.0), fine) - h) / e, ha = (relief(p + vec2(0.0, e), fine) - h) / e;
            vec3 px = dFdx(vW), py = dFdy(vW);
            float det = dx.x * dy.y - dy.x * dx.y;
            if (abs(det) > 1e-9) {
              vec3 Ts = (px * dy.y - py * dx.y) / det, Ta = (py * dx.x - px * dy.x) / det;
              float ls = length(Ts), la = length(Ta);
              // fade the relief out where it would be finer than a pixel
              float far = clamp(1.6 - 2.5 * fw, 0.0, 1.0);
              vec3 g = (Ts / max(ls * ls, 1e-12)) * hs + (Ta / max(la * la, 1e-12)) * ha;
              N = normalize(N - g * bump * 0.55 * far * ls);
            }
            base *= 0.86 + 0.24 * h; // the hollows darker
          }
          if (cord) {
            // a stipe, a cord: slick, its colour streaked along it, a little paler toward
            // its rounded sides where it is thinnest
            base *= 0.82 + 0.36 * vnoise(vec2(p.x * 0.4, 3.0));
            base *= 0.92 + 0.16 * mix(0.5, vnoise(vec2(p.x * 0.9, p.y * 3.0 + 5.0)), fine.x);
            thin = 0.55 + 0.45 * smoothstep(0.2, 0.6, v);
            tr = 0.7; gloss = 0.7;
          } else {
            // the tissue mottled: darker and lighter patches drifting along the blade, the
            // lightest gone to gold; and the fibres running its length
            float m = vnoise(p * vec2(0.1, 0.55) + 17.0) * 0.6 + vnoise(p * vec2(0.25, 1.3) + 4.0) * 0.4;
            base *= mix(0.7, 1.25, m);
            base = mix(base, base * vec3(1.3, 1.12, 0.62), smoothstep(0.58, 0.85, m) * 0.55);
            base *= 0.9 + 0.2 * mix(0.5, vnoise(p * vec2(0.5, 3.5) + 9.0), fine.y);
            // darker, thicker down its middle and at its base, a little paler toward its edges
            base *= mix(0.85, 1.03, edge);
            base *= mix(0.75, 1.1, smoothstep(0.0, 0.7, vUv.x));
            // its very margin: a fine line, hardly paler
            float rim = smoothstep(lim - 0.12, lim - 0.02, v);
            base = mix(base, base * vec3(1.15, 1.1, 0.95), rim * 0.4);
            thin = mix(0.75, 0.95, edge) * (1.2 - 0.4 * h) * mix(0.75, 1.25, m);
            tr = 1.0; gloss = 0.4;
          }
          float sp = vInfo.w > 0.0 ? specks(p, vInfo.w * (1.0 - 0.6 * vUv.x)) : 0.0;
          base = mix(base, vec3(0.78, 0.8, 0.74), sp * 0.85);
          tr *= 1.0 - sp;
        } else {
          gloss = v > 2.5 ? 0.06 : 0.75; // the floats, the rocks
          tr = v > 2.5 ? 0.0 : 0.35;
          thin = 0.7;
          kelp = v > 2.5 ? 0.0 : 1.0;
          if (v > 2.5) {
            // the rock's surface, in the world (the rocks never move): its relief bent into
            // the normal, darker in its hollows; tilted bands of strata; a crust of pink
            // coralline algae on its sides, green turf and a dusting of sand on top, and
            // white specks of encrusting animals
            // (in axes turned away from the world's, so the value noise's grid doesn't show
            // in its patches as blocks squared to the floor)
            vec3 p = mat3(0.0, 0.8, 0.6, -0.8, 0.36, -0.48, -0.6, -0.48, 0.64) * vW;
            float px = max(length(fwidth(p)), 1e-4);
            vec3 w = vec3(1.0 - smoothstep(0.2, 0.6, px), 1.0 - smoothstep(0.05, 0.2, px), 1.0 - smoothstep(0.012, 0.06, px));
            float e = 0.01;
            float h0 = rockH(p, w);
            vec3 g = vec3(rockH(p + vec3(e, 0, 0), w), rockH(p + vec3(0, e, 0), w), rockH(p + vec3(0, 0, e), w)) - h0;
            g /= e;
            vec3 Ng = N;
            N = normalize(N - (g - Ng * dot(g, Ng)) * 0.55);
            float cav = smoothstep(-0.12, 0.12, h0 - 0.25 * w.x);
            base *= 0.78 + 0.28 * cav;
            float band = sin(dot(vW, vec3(0.35, 3.2, 0.2)) + vnoise3(p * 0.8) * 4.0);
            base *= 0.93 + 0.09 * band;
            base *= 0.85 + 0.3 * vnoise3(p * 2.3 + 3.0);
            // its grain: light and dark crystals, close up
            float gr = hash3(floor(p * 38.0));
            base *= 1.0 + ((smoothstep(0.85, 0.95, gr) * 0.35) - smoothstep(0.1, 0.0, gr) * 0.4) * w.z;
            // cracks: thin dark lines where a noise crosses its middle, in some parts of it;
            // their width measured in the world (the noise's value over its slope), so they
            // stay lines where the noise flattens out instead of spreading into dark blotches
            vec3 cq = p * 1.4 + 21.0;
            float cn = vnoise3(cq) - 0.5;
            float ce = 0.02;
            vec3 cg = (vec3(vnoise3(cq + vec3(ce, 0, 0)), vnoise3(cq + vec3(0, ce, 0)), vnoise3(cq + vec3(0, 0, ce))) - 0.5 - cn) / ce * 1.4;
            float cs = length(cg);
            float cd = abs(cn) / max(cs, 1e-3); // distance to the line, in world units
            float cw = 0.012 + px * 0.5;
            float crack = (1.0 - smoothstep(cw * 0.4, cw, cd)) * smoothstep(0.15, 0.4, cs) * min(1.0, 0.01 / max(px, 0.01))
              * smoothstep(0.45, 0.6, vnoise3(p * 0.6 + 5.0)) * w.y;
            base *= 1.0 - 0.6 * crack;
            float up = Ng.y;
            // coralline crusts, pink, paler at their margins
            float cm = vnoise3(p * 0.9 + 11.0) + (vnoise3(p * 5.0) - 0.5) * 0.15;
            float cor = smoothstep(0.55, 0.62, cm) * smoothstep(0.75, 0.1, up);
            vec3 coral = vec3(0.62, 0.42, 0.5) * (0.85 + 0.3 * vnoise3(p * 12.0));
            coral = mix(coral, vec3(0.8, 0.7, 0.72), smoothstep(0.66, 0.58, cm) * 0.6);
            base = mix(base, coral, cor * 0.7 * (1.0 - crack));
            // turf on its upper faces: short, fuzzy, olive to rusty, thinning out in tufts
            // (ragged at their margins, never one flat sheet of colour over a broad patch)
            float tm = vnoise3(p * 1.3 + 2.0) * 0.55 + vnoise3(p * 4.5 + 9.0) * 0.3 + vnoise3(p * 11.0 + 4.0) * 0.15 * w.y + (cav - 0.5) * 0.25;
            float fuzz = vnoise3(p * vec3(40.0, 14.0, 40.0));
            float turf = smoothstep(0.3, 0.75, up) * smoothstep(0.38, 0.68, tm + (fuzz - 0.5) * 0.25 * w.z);
            vec3 tc = mix(vec3(0.28, 0.38, 0.18), vec3(0.42, 0.33, 0.2), vnoise3(p * 0.7 + 3.0));
            // (paler on a pale stone: a tint over it, not a dark stain)
            tc *= clamp(dot(base, vec3(0.33)) / 0.36, 0.9, 1.5) * (0.75 + 0.5 * mix(0.5, fuzz, w.z));
            base = mix(base, tc, turf * 0.7);
            float dust = smoothstep(0.75, 0.97, up) * smoothstep(0.42, 0.68, vnoise3(p * 3.0 + 7.0) + (vnoise3(p * 13.0) - 0.5) * 0.2 * w.y + 0.3 * (0.5 - cav));
            base = mix(base, vec3(0.66, 0.6, 0.47), dust * 0.5 * (1.0 - 0.5 * turf));
            vec3 sc = p * 7.0, ci = floor(sc), cf = fract(sc) - 0.5;
            float sp = step(hash3(ci), 0.12) * (1.0 - smoothstep(0.1, 0.18, length(cf))) * w.z * (1.0 - turf) * (1.0 - dust);
            base = mix(base, vec3(0.82, 0.8, 0.74), sp * 0.8);
            gloss = 0.06 + 0.12 * cor;
            // its foot under the sand drifted onto it (vInfo: the sand's colour there, how
            // high above it this is): up to a ragged line, higher where it lies back, the
            // sand's grain over it and its slope easing into the floor's
            float hy = vInfo.w;
            float lim = (0.04 + 0.16 * vnoise3(p * 1.6 + 30.0) + 0.06 * (vnoise3(p * 7.0) - 0.5) * w.y) * (0.6 + 0.8 * clamp(up, 0.0, 1.0));
            float sd = 1.0 - smoothstep(lim - 0.03 - px, lim + px, hy);
            vec3 sandC = vInfo.rgb * (0.86 + 0.28 * vnoise3(p * 1.7)) * (1.0 + ((vnoise3(p * 22.0) - 0.5) * 0.6 + (vnoise3(p * 53.0) - 0.5) * 0.9) * 0.35 * w.z);
            base = mix(base, sandC, sd);
            N = normalize(mix(N, vec3(0.0, 1.0, 0.0), sd * smoothstep(0.1, -0.1, hy - lim * 0.5) * 0.6));
            gloss *= 1.0 - sd;
          }
        }
      #endif
        float light = lightAt(vW.y);
        float diff = max(dot(N, L), 0.0);
        float back = max(dot(-N, L), 0.0);
        // (a blade, thin, is lit by the water above even where it faces down)
        vec3 amb = mix(vec3(0.004, 0.05, 0.065), vec3(0.06, 0.30, 0.30), mix(N.y * 0.5 + 0.5, 0.75, tr * 0.5));
        // dappled: brighter in the beams; and the kelp in the drifting shade of the fronds
        // above it, so a blade is gold in one place and dark olive a hand further on
        float dap = 1.0;
        if (kelp > 0.0) {
          vec2 dq = vW.xy * vec2(0.55, 0.4) + vec2(uTime * 0.07, -uTime * 0.045);
          dap = mix(1.0, 0.25 + 1.05 * smoothstep(0.3, 0.72, wNoise(dq) * 0.65 + wNoise(dq * 2.3 + 7.0) * 0.35), kelp * 0.85);
        }
        // and in its own shade (kelp.js: the plant between it and the light), which only
        // the scattered light gets under
        // (the water's own light dimming toward the bottom too)
        amb *= depthDim(vW.y) * 1.2;
        float occ = clamp(vOcc, 0.0, 1.0) * kelp;
        dap *= 1.0 - 0.75 * occ;
        amb *= 1.0 - 0.35 * occ;
        // (the sunlight itself bluer the deeper it has come: the red taken on its way down)
        vec3 tint = exp(-max(0.0, SURFACE - vW.y) * vec3(0.005, 0.001, 0.0005)) * vec3(1.0, 0.97, 0.9);
        vec3 sun = tint * light * (0.8 + 1.3 * shaft(vW)) * dap;
        float cau = caustic(vW.xz * mix(0.16, 0.11, kelp) + vW.y * 0.02, uTime * 0.45);
        // (thin tissue: the light wraps round a little past its edge)
        float wrap = mix(diff, max((dot(N, L) + 0.35) / 1.35, 0.0), kelp * 0.6);
        // (the sand and the rocks netted with the bright, dancing caustics of a sunny day)
        vec3 col = base * (amb * 1.3 + sun * wrap * mix(0.5 + 5.0 * cau, 0.75 + 0.9 * cau, kelp));
        // the light come through: the tissue's own colour, deepened (a thin brown blade glows
        // gold), most where the light is behind it, some always from the bright water above
        vec3 glow = pow(base, vec3(1.2)) * vec3(2.6, 2.4, 1.3);
        // (lit less by depth than the faces are: the whole bright water above shines through;
        // the direct light dappled, brighter in the beams; and brightest looking up into it)
        float through = (0.3 * (1.0 - 0.6 * occ) + 0.7 * light * (0.45 + 1.1 * shaft(vW))) * mix(1.0, 0.35 + 0.75 * dap, kelp);
        // only where the light is behind it: through the blade toward the eye (looking into
        // the light), or through its back face; seen with the light behind the eye, it is
        // only its own dark tissue, lit on its face
        float fwd = pow(max(dot(-V, L), 0.0), 1.5);
        float behind = 1.6 * back + 2.4 * fwd * kelp;
        col += glow * tint * through * tr * thin * (0.12 + behind * (1.0 + 0.3 * cau)) * (1.0 + 0.35 * kelp);
        vec3 H = normalize(L + V);
        float nh = max(dot(N, H), 0.0);
        // wet: on the floor and the rocks a glint; on the kelp no hard highlight, only a
        // broad, faint sheen (a sharp one over its relief reads as plastic)
        col += sun * gloss * mix(pow(nh, 48.0) * 0.55, pow(nh, 5.0) * 0.07, kelp);
        // a wet sheen at grazing angles
        col += amb * gloss * 0.6 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
        col = applyWater(col, vW);
        gl_FragColor = vec4(finite(col), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    vertexColors: true,
  });
}

// ---- the floor: rolling sand, a heightfield also used to aim strokes at it
// value noise for the sand's ripples (an integer hash, smoothly interpolated)
function hashI(i, j) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y);
  let fx = x - i, fy = y - j;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hashI(i, j), b = hashI(i + 1, j), c = hashI(i, j + 1), d = hashI(i + 1, j + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// the smaller of a and b, rounded over k where they meet
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
function hashI3(i, j, k) {
  let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(k, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise3(x, y, z) {
  const i = Math.floor(x), j = Math.floor(y), k = Math.floor(z);
  let fx = x - i, fy = y - j, fz = z - k;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  const plane = (kk) => l(l(hashI3(i, j, kk), hashI3(i + 1, j, kk), fx), l(hashI3(i, j + 1, kk), hashI3(i + 1, j + 1, kk), fx), fy);
  return l(plane(k), plane(k + 1), fz);
}
function fbm3(x, y, z, octaves) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += vnoise3(x, y, z) * amp;
    norm += amp;
    x = x * 2.03 + 1.7; y = y * 2.03 - 3.1; z = z * 2.03 + 0.9;
    amp *= 0.5;
  }
  return sum / norm;
}

// the sand ripples, ~2.7 apart, crests across the current, forking and bending with the
// noise; sharp crests and flat troughs, one side steeper than the other; lower where the
// sand lies calm and, past where the mesh gets too coarse to hold them, gone.
// → [height, profile (0 trough … 1 crest), strength (0 … 1)]
export function ripple(x, z) {
  const calm = smooth(0.5, 0.85, vnoise(x * 0.06 + 40, z * 0.06 + 40));
  const ph = x * 2.3 + z * 0.6 + vnoise(x * 0.35, z * 0.35) * 5 + vnoise(x * 0.9 + 30, z * 0.9) * 0.8;
  const u = (0.5 + 0.5 * Math.sin(ph + 0.55 * Math.cos(ph))) ** 1.4;
  const fade = (1 - smooth(32, 52, Math.abs(x))) * (1 - smooth(-36, -58, z));
  const k = (1 - 0.8 * calm) * (0.65 + 0.7 * vnoise(x * 0.12 + 9, z * 0.12)) * fade;
  return [(u - 0.35) * 0.3 * k, u, k];
}

function floorBase(x, z) {
  return (
    0.55 * Math.sin(x * 0.11 + z * 0.07) +
    0.4 * Math.sin(x * 0.047 - z * 0.12 + 1.0) +
    0.18 * Math.sin(x * 0.29 + z * 0.21 + 2.0) +
    Math.max(0, -z - 30) * 0.06 // rising gently into the distance
  );
}
export function floorH(x, z) {
  return floorBase(x, z) + ripple(x, z)[0];
}

// where a ray meets the floor (marching then bisecting), or null
export function hitFloor(o, d, maxDist = 140) {
  let prev = 0;
  for (let t = 0.5; t < maxDist; t += 0.4) {
    const y = o.y + d.y * t;
    if (y < floorH(o.x + d.x * t, o.z + d.z * t)) {
      let a = prev, b = t;
      for (let k = 0; k < 20; k++) {
        const m = (a + b) / 2;
        if (o.y + d.y * m < floorH(o.x + d.x * m, o.z + d.z * m)) b = m;
        else a = m;
      }
      const x = o.x + d.x * b, z = o.z + d.z * b;
      return new THREE.Vector3(x, floorH(x, z), z);
    }
    prev = t;
  }
  return null;
}

function rngOf(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the sand's colour at (x, z): patches darker and greener
const SAND = new THREE.Color('#a99d7c'), SAND_DARK = new THREE.Color('#5d5a48'), SAND_GREEN = new THREE.Color('#566540');
function sandAt(x, z, c) {
  const n1 = 0.5 + 0.5 * Math.sin(x * 0.21 + Math.sin(z * 0.17) * 2) * Math.sin(z * 0.19 + x * 0.05);
  const n2 = 0.5 + 0.5 * Math.sin(x * 0.7 + z * 0.4) * Math.sin(z * 0.9 - x * 0.3);
  return c.copy(SAND).lerp(SAND_DARK, n1 * 0.45 + n2 * 0.15).lerp(SAND_GREEN, Math.max(0, n1 - 0.6) * 0.6);
}
const RIM_BINS = 48;

export function createFloor(seed) {
  const rand = rngOf(seed * 7 + 3);
  const group = new THREE.Group();
  // the mesh: fine where the camera looks down on it (the ripples are in it, ~0.3 apart),
  // coarser to the sides and into the distance
  const geo = new THREE.PlaneGeometry(320, 170, 500, 350);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, -70);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getX(i) / 160, d = (15 - pos.getZ(i)) / 170;
    pos.setX(i, 160 * (0.47 * t + 0.53 * t ** 5));
    pos.setZ(i, 15 - 170 * (0.51 * d + 0.49 * d ** 5));
  }
  const col = new Float32Array(pos.count * 3), rip = new Float32Array(pos.count * 2);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const r = ripple(x, z);
    pos.setY(i, floorBase(x, z) + r[0]);
    rip[i * 2] = r[1];
    rip[i * 2 + 1] = r[2];
    sandAt(x, z, c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aRip', new THREE.BufferAttribute(rip, 2));
  geo.computeVertexNormals();
  group.add(new THREE.Mesh(geo, createLitMaterial({ floor: true })));

  // rocks, half sunk: boulders broken into a few flat faces with worn edges, and slabs
  // split along their layers, each lumpy and knobbly over that; darker where they meet
  // the sand, and the sand shadowed round them
  const rocks = [], feet = [];
  // grey granite, brown sandstone, dark basalt, pale limestone
  const rockCol = [new THREE.Color('#8a8478'), new THREE.Color('#8f7a62'), new THREE.Color('#5f5f5a'), new THREE.Color('#a39a86')];
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  for (let k = 0; k < 26; k++) {
    // the placement draws from rand in the same order as before, so a seed keeps its rocks
    // where they were; the shape draws from its own generator
    const f1 = 1 + rand() * 2, f2 = 3 + rand() * 4, ph = rand() * 10;
    const x = (rand() - 0.5) * (40 + k * 4), z = 2 - rand() * (10 + k * 3.5);
    const s = 0.5 + rand() * rand() * 2.8;
    const sx = s * (1 + rand() * 0.6), sy = s * (0.45 + rand() * 0.35) * 1.35, sz = s * (1 + rand() * 0.6);
    const rot = rand() * 6;
    const wr = rngOf(seed * 131 + k * 17 + 1);
    const slab = wr() < 0.3;
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, s > 1.2 ? 5 : 4).deleteAttribute('normal').deleteAttribute('uv'));
    const p = g.attributes.position;
    // the faces it broke along: planes cutting the round shape, mostly on its sides and top
    const cuts = [];
    for (let n = 5 + Math.floor(wr() * 4); n > 0; n--) {
      const a = wr() * 6.3, e = slab ? 0.6 + wr() * 0.9 : -0.2 + wr() * 1.4;
      cuts.push({ n: new THREE.Vector3(Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)), d: 0.5 + wr() * 0.35 });
    }
    if (slab) cuts.push({ n: new THREE.Vector3(0, 1, 0), d: 0.45 + wr() * 0.2 });
    const o = new THREE.Vector3(wr(), wr(), wr()).multiplyScalar(50);
    const layers = 5 + wr() * 4, tilt = (wr() - 0.5) * 0.5;
    const base = rockCol[Math.floor(wr() * rockCol.length)];
    const cc = new Float32Array(p.count * 3), uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      let r = 1 + 0.15 * Math.sin(v.x * f1 * 2 + ph) * Math.sin(v.y * f1 * 2.3 + ph);
      for (const cut of cuts) {
        const dn = v.dot(cut.n);
        if (dn > 0) r = smin(r, cut.d / dn, 0.05);
      }
      w.copy(v).multiplyScalar(1.6).add(o);
      r += (fbm3(w.x, w.y, w.z, 3) - 0.5) * 0.3;
      w.copy(v).multiplyScalar(6.5).add(o);
      r += (fbm3(w.x, w.y, w.z, 2) - 0.5) * 0.07;
      if (slab) r -= 0.03 * smooth(0.6, 0.9, Math.abs(Math.sin((v.y + v.x * tilt) * layers * 3.1)));
      v.multiplyScalar(r);
      p.setXYZ(i, v.x, v.y, v.z);
      c.copy(base).multiplyScalar(0.9 + 0.2 * Math.sin(v.x * 5 + ph) * Math.sin(v.z * 4 - ph));
      cc.set([c.r, c.g, c.b], i * 3);
      uv.set([0.5, 3], i * 2);
    }
    g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.scale(sx, sy, sz);
    g.rotateY(rot);
    g.translate(x, floorH(x, z) + 0.05 * s, z);
    // its outline where it goes into the sand: how far it reaches at each angle round it
    // (in its own stretched frame, so the sand can bank up against its real edge)
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const local = (px, pz) => [((px - x) * cos - (pz - z) * sin) / sx, ((px - x) * sin + (pz - z) * cos) / sz];
    const rim = new Float32Array(RIM_BINS);
    for (let i = 0; i < p.count; i++) {
      const hy = p.getY(i) - floorH(p.getX(i), p.getZ(i));
      if (hy < -0.1 * s || hy > 0.12 * s) continue;
      const [lx, lz] = local(p.getX(i), p.getZ(i));
      const b = Math.floor(((Math.atan2(lz, lx) / (2 * Math.PI)) + 1) * RIM_BINS) % RIM_BINS;
      rim[b] = Math.max(rim[b], Math.hypot(lx, lz));
    }
    for (let pass = 0; pass < 2; pass++)
      for (let b = 0; b < RIM_BINS; b++)
        if (!rim[b]) rim[b] = Math.max(rim[(b + 1) % RIM_BINS], rim[(b + RIM_BINS - 1) % RIM_BINS]);
    g.computeBoundingBox();
    const box = g.boundingBox, m = 0.8 * s;
    feet.push({ g, cc, s, local, rim, x0: box.min.x - m, x1: box.max.x + m, z0: box.min.z - m, z1: box.max.z + m });
    rocks.push(g);
  }
  // where a point of the floor is against a rock: [how far out from its edge, in its sizes
  // (0 at the edge, below inside), the rock], the nearest
  const near = (px, pz) => {
    let best = null, bt = Infinity;
    for (const r of feet) {
      if (px < r.x0 || px > r.x1 || pz < r.z0 || pz > r.z1) continue;
      const [lx, lz] = r.local(px, pz);
      const a = ((Math.atan2(lz, lx) / (2 * Math.PI)) + 1) * RIM_BINS;
      const b0 = Math.floor(a) % RIM_BINS, b1 = (b0 + 1) % RIM_BINS, f = a - Math.floor(a);
      const t = Math.hypot(lx, lz) / Math.max(1e-3, r.rim[b0] * (1 - f) + r.rim[b1] * f) - 1;
      if (t < bt) { bt = t; best = r; }
    }
    return [bt, best];
  };
  // the sand banked up against each rock, a little, unevenly, smooth and shadowed at its foot
  // (the rock and the sand dark together at the seam, not each in its own ring)
  const bank = (px, pz) => {
    const [t, r] = near(px, pz);
    if (!r) return [0, 1, 0];
    const n = vnoise(px * 1.7 + 13, pz * 1.7), n2 = vnoise(px * 0.6, pz * 0.6 - 7);
    const a = Math.min(0.06 + 0.06 * r.s, 0.24) * (0.45 + 0.9 * n2);
    const spread = 0.25 + 0.35 * n;
    const h = a * (1 - smooth(-0.1, spread, t));
    // (the ripples die out against it: the sand round it lies smooth)
    return [h, 0.72 + 0.28 * smooth(-0.15, spread + 0.25, t), 0.85 * (1 - smooth(0, spread + 0.7, t))];
  };
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), pz = pos.getZ(i);
    const [h, sh, calm] = bank(px, pz);
    if (calm > 0) {
      pos.setY(i, pos.getY(i) + h - ripple(px, pz)[0] * calm);
      rip[i * 2 + 1] *= 1 - calm;
    }
    if (sh < 1) for (let j = 0; j < 3; j++) col[i * 3 + j] *= sh;
  }
  geo.computeVertexNormals();
  // each rock's foot: darker toward the sand, and the sand drifted onto it (aInfo: the
  // sand's colour there, how high above it the rock is)
  for (const { g, cc } of feet) {
    const p = g.attributes.position, info = new Float32Array(p.count * 4);
    for (let i = 0; i < p.count; i++) {
      const px = p.getX(i), pz = p.getZ(i);
      const [h, sh, calm] = bank(px, pz);
      const hy = p.getY(i) - floorH(px, pz) - h + ripple(px, pz)[0] * calm;
      const f = 0.72 + 0.28 * smooth(-0.05, 0.4, hy);
      for (let j = 0; j < 3; j++) cc[i * 3 + j] *= f;
      sandAt(px, pz, c).multiplyScalar(sh);
      info.set([c.r, c.g, c.b, hy], i * 4);
    }
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 4));
  }
  // the rocks' meshes, for a ray to meet them (a plant can grip one as well as the sand)
  group.userData.rocks = rocks.map((g) => new THREE.Mesh(g, createLitMaterial()));
  group.add(...group.userData.rocks);
  return group;
}

// ---- marine snow: specks drifting slowly in the current, sinking
export function createSnow(count = 1200) {
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(count * 3), r = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p.set([(Math.random() - 0.5) * 70, Math.random() * 30, 12 - Math.random() * 70], i * 3);
    r[i] = Math.random();
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(r, 1));
  // how far the pointer's stirring has carried each speck off its drift (stir.js)
  geo.setAttribute('aOff', new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...sharedUniforms, uPx: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uPx; uniform vec3 uCam; uniform float uFog;
      #define LIGHT ${LIGHT}
      #define SURFACE ${SURFACE_Y.toFixed(1)}
      float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      uniform sampler2D uNoise;
      float wNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return texture2D(uNoise, (i + f + 0.5) / 256.0).r;
      }
      ${SHAFT_GLSL}
      attribute float aRand;
      attribute vec3 aOff;
      varying float vA; varying float vSoft;
      void main() {
        vec3 q = position + aOff;
        q.x += uTime * (0.25 + aRand * 0.2) + sin(uTime * 0.3 + aRand * 20.0) * 0.6;
        q.y -= uTime * (0.03 + aRand * 0.05);
        q.z += sin(uTime * 0.2 + aRand * 13.0) * 0.5;
        q.x = mod(q.x + 35.0, 70.0) - 35.0;
        q.y = mod(q.y, 30.0);
        vec4 mv = viewMatrix * vec4(q, 1.0);
        float d = -mv.z;
        // each its own size, most of them fine, a few flakes bigger; and out of focus away
        // from the plants (in focus ~11 off): those close to the eye blown up into broad,
        // faint discs, their light spread over them
        float r3 = fract(aRand * 7.31);
        float size = 0.4 + 2.4 * r3 * r3 * r3;
        float sharp = min(uPx * size * 9.0 / max(d, 1.0), 4.0 * uPx / 6.0) + 0.5;
        float coc = uPx * (1.8 * clamp((11.0 - d) / d, 0.0, 4.0) + 0.25 * clamp((d - 11.0) / d, 0.0, 1.0));
        gl_PointSize = sharp + coc;
        vSoft = coc / gl_PointSize;
        // glinting where it drifts through a beam
        vA = exp(-d * 0.05) * (0.45 + 0.9 * aRand) * (0.6 + 0.6 * size) * smoothstep(0.25, 1.0, d) * (0.5 + 2.2 * shaft(q))
           * min(1.0, (sharp * sharp) / (gl_PointSize * gl_PointSize) * 2.5);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vSoft;
      void main() {
        float r = length(gl_PointCoord - 0.5);
        // a point in focus soft-edged, a disc out of focus flat with a crisper rim
        float a = mix(smoothstep(0.5, 0.1, r), smoothstep(0.5, 0.4, r) * (0.75 + 0.25 * smoothstep(0.2, 0.45, r)), vSoft);
        gl_FragColor = vec4(vec3(0.6, 0.8, 0.7) * vA * a * 0.7, 1.0);
      }`,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  return pts;
}

// ---- the forest beyond: rows of giant kelp standing back in the haze, one sheet of them at
// each depth, drawn in the shader — stipes rising toward the surface, swaying, a blade off
// alternate sides at every node, lit through golden, fading into the water with distance
const FOREST_DEPTHS = [-27, -42, -62, -90, -124];
// the nearest row of it: nothing is drawn beyond it, the floor past it is the background's
export const FOREST_NEAR = FOREST_DEPTHS[0];
// one sheet of them: a row of the forest beyond (k: which), or (fg) the foreground's
function forestMaterial(k, seed, spread, fg = false) {
    return new THREE.ShaderMaterial({
      defines: fg ? { FG: 1 } : {},
      uniforms: {
        ...sharedUniforms, uSeed: { value: seed }, uSpread: { value: spread }, uRoots: { value: new THREE.Vector2() }, uFgLen: { value: 1 },
        // the pointer's wake where it crosses this row (stir.js): where, how fast, when; the
        // farther rows bent less
        uSegA: { value: Array.from({ length: FOREST_WAKES }, () => new THREE.Vector4()) },
        uSegB: { value: Array.from({ length: FOREST_WAKES }, () => new THREE.Vector4()) },
        uSegN: { value: 0 }, uStirX: { value: new THREE.Vector2() }, uWakeU: { value: 1 }, uWakeK: { value: [1, 0.8, 0.62, 0.48, 0.38][k] ?? 1 },
      },
      side: THREE.DoubleSide,
      // (the foreground out of focus: soft-edged, blended over what is behind it)
      alphaToCoverage: !fg,
      transparent: fg,
      depthWrite: !fg,
      vertexShader: /* glsl */ `
        varying vec3 vW;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        ${WATER_GLSL}
        uniform float uSeed; uniform float uSpread; uniform vec2 uRoots; uniform float uFgLen;
        uniform vec4 uSegA[${FOREST_WAKES}]; uniform vec4 uSegB[${FOREST_WAKES}];
        uniform int uSegN; uniform vec2 uStirX; uniform float uWakeU; uniform float uWakeK;
        varying vec3 vW;
        // how far the stirred water has pushed a stipe sideways at p: each stretch of the
        // wake a shove along the pointer's path, the plant giving way, then springing back
        // past where it stood and settling; capped (softly) so a plant bends but stays itself
        float stirred(vec2 p) {
          if (uSegN == 0 || p.x < uStirX.x || p.x > uStirX.y) return 0.0;
          float d = 0.0;
          float r2 = ${FOREST_REACH2.toFixed(1)} * uWakeU * uWakeU;
          for (int i = 0; i < ${FOREST_WAKES}; i++) {
            if (i >= uSegN) break;
            vec4 A = uSegA[i], B = uSegB[i];
            vec2 ab = A.zw - A.xy;
            float f = clamp(dot(p - A.xy, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
            float age = uTime - mix(B.z, B.w, f);
            if (age > 2.6 || age < 0.0) continue;
            vec2 r = p - A.xy - ab * f;
            d += B.x * exp(-dot(r, r) / r2) * exp(-1.8 * age) * sin(3.0 * age);
          }
          d *= ${FOREST_PUSH.toFixed(5)} * uWakeK;
          float L = min(${FOREST_BEND.toFixed(2)} * uWakeU, 0.4 * uSpread);
          return d * L / sqrt(L * L + d * d);
        }
        // coverage of the plants at p (x, y on the sheet), how much of it is blade, and the
        // shading across it: the ribs and blisters of the blades, the stipe's darker core
        // one plant (c: its cell, x0: where it is rooted, h1: its hash) laid over p
        void plant(vec2 p, float aa, float fine, float c, float x0, float h1, float top, inout float cov, inout float blade, inout float shade) {
            float h2 = wHash(vec2(c, uSeed + 7.7)), h3 = wHash(vec2(c, uSeed + 9.2));
            float yb = p.y + 4.0;
            if (p.y > top + 3.0) return;
            float ph = h1 * 40.0;
            float sway = sin(uTime * 0.42 + ph + p.y * 0.07) * 0.05 * yb + sin(uTime * 0.85 + ph * 1.3 + p.y * 0.23) * 0.12;
            // each stipe bent its own way, wandering as it climbs
            float bend = (wNoise(vec2(yb * 0.07 + c * 3.7, uSeed + c)) - 0.5) * (1.2 + 1.8 * h3)
                       + (wNoise(vec2(yb * 0.23, c * 5.3 + uSeed)) - 0.5) * 0.35;
            float xs = x0 + sway + bend + (h1 - 0.6) * 0.12 * yb;
            if (abs(p.x - xs) > 4.2 + 0.4 * uSpread) return; // out of reach of its blades, however bent
            // bent by the stirred water, the whole plant at once (blades carried with it),
            // rooted: the more the higher up
            xs += stirred(vec2(xs, p.y)) * smoothstep(-4.0, 14.0, p.y);
            float dx = p.x - xs;
            if (abs(dx) > 4.2) return;
            float w = 0.06 * (1.0 - 0.4 * clamp(yb / 30.0, 0.0, 1.0)) * (0.8 + 0.5 * h2);
            float st = (1.0 - smoothstep(w - aa, w + aa, abs(dx))) * (1.0 - smoothstep(top - 0.2, top, p.y));
            if (st > cov) { cov = st; shade = mix(1.0, 0.7 + 0.3 * smoothstep(0.0, w, abs(dx)), fine); }
            // blades at the nodes, not quite evenly spaced, mostly alternating sides, some
            // lost or torn, each its own length, angle and droop
            float sp = 0.95 + 0.6 * h2;           // each plant its own node spacing
            float lenS = 0.75 + 0.6 * h3;          // and its own blade size
            float y0 = 0.0;
          #ifdef FG
            // the foreground's: a short stipe low in the view, two or three blades bunched on
            // it, small enough to frame the view, not to hide it (shorter still in a narrow view)
            sp = 0.5 + 0.2 * h2;
            y0 = 0.0;
            float nb = 2.0 + step(0.5, h3);
            lenS = (0.8 + 0.3 * h3) * uFgLen;
            float outw = c < 1.0 ? 1.0 : -1.0;      // the edge of the view it stands past
          #endif
            float jj = floor((p.y - y0) / sp);
            for (int m = -4; m <= 1; m++) {
              float j = jj + float(m);
              float hj = wHash(vec2(j, c + uSeed));
              float hk = wHash(vec2(j + 0.37, c * 1.3 + uSeed));
            #ifdef FG
              if (j < 0.0 || j >= nb) continue;
            #else
              if (hk < 0.14) continue;             // a blade lost here
            #endif
              float yo = y0 + (j + 0.5 + (fract(hj * 31.7) - 0.5) * 0.7) * sp;
              if (yo > top || yo < -2.0) continue;
              float side = mod(j, 2.0) < 1.0 ? -1.0 : 1.0;
              if (fract(hk * 17.3) < 0.2) side = -side; // two on one side now and then
              float len = (1.2 + 2.3 * hj * hj) * lenS;
              float torn = fract(hk * 5.9) < 0.25 ? 0.55 + 0.4 * fract(hk * 23.1) : 1.0; // tip worn away
              float ang = 0.3 + 0.65 * fract(hj * 7.3) + 0.2 * sin(uTime * (0.5 + 0.4 * hk) + j * 0.9 + ph);
            #ifdef FG
              // kept low: the plant just past the edge, every blade reaching in from it, rising
              // more than leaning over, so only their tips come into the view's edges
              side = -outw;
              len = (1.0 + 0.8 * hj * hj) * lenS;
              ang = 0.3 + 0.2 * fract(hj * 7.3) + 0.2 * (1.0 - j / nb) + 0.1 * sin(uTime * (0.5 + 0.4 * hk) + j * 0.9 + ph);
            #endif
              vec2 dir = vec2(side * sin(ang), cos(ang));
              vec2 q = vec2(dx, p.y - yo);
              float u = dot(q, dir);
              if (u < 0.0 || u > len * torn + 0.1) continue;
              float droop = (0.02 + 0.2 * fract(hj * 3.7)) * (fract(hk * 41.3) < 0.15 ? -0.7 : 1.0);
              float t = u / len;
              float v = dot(q, vec2(-dir.y, dir.x)) + side * droop * u * u
                      + 0.12 * len * sin(t * 4.0 + hj * 6.3) * t; // a slight S as it streams
              // the outline: broad or narrow, widest at different points, ruffled at the edge
              float wid = 0.16 + 0.22 * fract(hj * 13.1);
            #ifdef FG
              wid *= 0.6; // slender, so the few blades read apart
            #endif
              float peak = 0.25 + 0.35 * fract(hk * 2.9);
              float prof = t < peak ? sin(1.5708 * t / peak) : cos(1.5708 * (t - peak) / (1.0 - peak));
              float hw = wid * sqrt(max(prof, 0.0)) * lenS;
              float rf = 7.0 + 6.0 * fract(hk * 11.7);
              hw *= 1.0 + 0.16 * sin(u * rf + hk * 20.0) * smoothstep(0.0, 0.25, t);
              hw += (wNoise(vec2(u * 5.0 + j * 2.1, c * 1.9 + side * 3.0)) - 0.5) * 0.08 * hw / max(wid, 0.01);
              if (torn < 1.0) {
                // a ragged tear, not a cut
                float rag = (wNoise(vec2(v * 9.0 + hk * 40.0, j)) - 0.5) * 0.5 + 0.3 * abs(v) / max(hw, 0.01);
                hw *= 1.0 - smoothstep(len * torn - 0.15, len * torn, u + rag);
              }
              float b = 1.0 - smoothstep(hw - aa, hw + aa, abs(v));
              // a few holes eaten through the older, lower blades (not the foreground's: a
              // hole so close reads as an eye)
            #ifndef FG
              float hole = wNoise(vec2(u * 3.3 + hj * 50.0, v * 4.0 + c));
              b *= mix(1.0, smoothstep(0.08, 0.14, hole + 0.12 * smoothstep(top * 0.5, 0.0, yo)), fine * step(0.55, fract(hj * 9.1)));
            #endif
              if (b > cov) {
                // the texture across it: blistered ridges along its length, darker at the
                // midrib, paler near the edges and the tip
                float x = v / max(hw, 1e-3);
                float rib = 0.5 + 0.5 * sin(x * 5.0 + u * 1.7 + hj * 9.0);
                float blis = wNoise(vec2(u * 6.0 + hj * 30.0, x * 2.2 + c));
                float s = 0.7 + 0.34 * rib * blis + 0.14 * abs(x) - 0.22 * exp(-x * x * 30.0) + 0.1 * t;
                shade = mix(1.0, s, fine * 0.9 + 0.1);
              }
              cov = max(cov, b);
              blade = max(blade, b * (0.5 + 0.5 * hj));
            }
        }
        // coverage of the plants at p, how much of it is blade, and the shading across it.
        // They stand in clumps with gaps between, not evenly: whether a cell holds a plant
        // is weighed by a slow noise across the row
        vec3 forest(vec2 p, float aa) {
          float cov = 0.0, blade = 0.0, shade = 1.0;
          float ci = floor(p.x / uSpread);
          // fine detail only where a pixel is small enough to hold it
          float fine = 1.0 - smoothstep(0.03, 0.12, aa);
        #ifdef FG
          // the foreground: a low plant at either edge of the view, rooted where told
          for (int k = 0; k < 2; k++) {
            float x0 = k == 0 ? uRoots.x : uRoots.y;
            plant(p, aa, fine, float(k) + 0.5, x0, 0.8, 2.8, cov, blade, shade);
          }
        #else
          // a stipe bent over by the stirring may come from a cell further off
          int reach = uSegN > 0 ? 2 : 1;
          for (int k = -2; k <= 2; k++) {
            if (k < -reach || k > reach) continue;
            float c = ci + float(k);
            float h1 = wHash(vec2(c, uSeed));
            if (h1 < 0.15 + 0.8 * smoothstep(0.2, 0.8, wNoise(vec2(c * 0.21, uSeed * 3.1)))) continue;
            float x0 = (c + 0.15 + 0.7 * wHash(vec2(c, uSeed + 1.7))) * uSpread;
            float top = mix(9.0, SURFACE + 2.0, pow(wHash(vec2(c, uSeed + 3.1)), 0.6));
            plant(p, aa, fine, c, x0, h1, top, cov, blade, shade);
          }
        #endif
          return vec3(cov, blade, shade);
        }
        void main() {
          float aa = fwidth(vW.x) * 0.9 + 1e-4;
        #ifdef FG
          aa += 0.05; // out of focus
        #endif
          vec3 f = forest(vW.xy, aa);
          if (f.x < 0.02) discard;
          float h = wHash(vec2(floor(vW.x / uSpread), uSeed + 5.0));
          // patches of darker and greener growth over the whole plant
          float mot = wNoise(vW.xy * vec2(0.9, 0.45) + uSeed) * 0.6 + wNoise(vW.xy * 2.3 - uSeed) * 0.4;
          vec3 base = mix(vec3(0.30, 0.22, 0.04), vec3(0.42, 0.40, 0.08), clamp(h + (mot - 0.5) * 0.6, 0.0, 1.0));
          base *= mix(0.55, 1.0, f.y) * f.z * (0.75 + 0.5 * mot);
          float light = lightAt(vW.y) * (0.45 + 1.1 * shaft(vW));
          vec3 amb = vec3(0.03, 0.2, 0.2);
          vec3 col = base * amb + pow(base, vec3(1.3)) * vec3(1.9, 1.75, 1.0) * light * (0.5 + 0.7 * f.y);
        #ifdef FG
          // close to the eye, against the light: a silhouette, near black, a faint glow
          // through its blades where they face the bright water above
          col = base * vec3(0.02, 0.05, 0.05) + pow(base, vec3(1.3)) * vec3(0.5, 0.6, 0.35) * light * f.y * 0.25;
        #endif
          col = applyWater(col, vW);
          gl_FragColor = vec4(finite(col), f.x);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
}

const sheet = () => {
  const geo = new THREE.PlaneGeometry(420, SURFACE_Y + 12, 1, 1);
  geo.translate(0, (SURFACE_Y + 12) / 2 - 6, 0);
  return geo;
};

export function createForest(seed) {
  const rand = rngOf(seed * 13 + 5);
  const group = new THREE.Group();
  const DEPTHS = FOREST_DEPTHS;
  for (let k = 0; k < DEPTHS.length; k++) {
    const z = DEPTHS[k];
    const geo = sheet();
    const mat = forestMaterial(k, rand() * 100, 2.6 + k * 0.5);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = z; // sorted front to back: the nearer rows hide the farther early
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  return group;
}

// ---- the foreground: a low kelp just past either edge of the view, close to the eye, two or three short blades, dark
// against the light and out of focus, for depth. Drawn last, over everything; nothing is
// planted in it (strokes reach past it)
const FG_Z = 5.5;
export function createForeground(seed, camera) {
  const rand = rngOf(seed * 29 + 11);
  const mat = forestMaterial(-1, rand() * 100, 1, true);
  const mesh = new THREE.Mesh(sheet(), mat);
  mesh.position.z = FG_Z;
  mesh.frustumCulled = false;
  mesh.renderOrder = 20;
  // where its stipes stand: just past the right edge and the left (the stipes out of view),
  // their blades reaching in from the sides; refitted to the view's width
  const r1 = rand(), r2 = rand();
  mesh.userData.fit = () => {
    const d = camera.position.z - FG_Z;
    const half = d * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
    mat.uniforms.uRoots.value.set(camera.position.x + half * (1.08 + 0.05 * r1), camera.position.x - half * (1.08 + 0.05 * r2));
    // the blades sized to the view: as long in a landscape view, shorter in a narrow one
    mat.uniforms.uFgLen.value = Math.min(1, Math.max(0.45, half / 5.4));
  };
  mesh.userData.fit();
  return mesh;
}
