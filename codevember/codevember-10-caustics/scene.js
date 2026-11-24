// The diorama — a long, shallow glass tank holding a block of sand and the
// water over it, on a thick wooden shelf on the wall of a white room,
// in warm sunlight from a window —, the glow map the grains leave on
// the sand, and the post-processing. What's inside the tank (the sand, the
// grains in the water, the surface's underside) is drawn first into a picture;
// the water's top and its sides show that picture (the top bending it with
// its waves), with the room reflected on them at grazing angles.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import {
  FLOOR_GLSL, WATER_GLSL, SKY_GLSL, IOR, FLOOR_Y, WATER_Y, BOX_HX, BOX_HZ, BASE_Y, GLASS,
  SHELF_HALF, SHELF_THICK, SHELF_FRONT, WALL_Z, ROOM_HALF, ROOM_ANGLE, WINDOW, fromRoom,
  BALL, BALL_R, BALL_GLSL, STAND_INSET, ROOM_FLOOR_Y, PEBBLES, SAND_LOOK, NIGHT_GLSL,
} from './sea.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLOW_HALF } from './light.js';

const BX = BOX_HX, BZ = BOX_HZ;
const f = (n) => n.toFixed(4);

// the tank's floor plan, as a fine grid (its edges line up with edgeStrips')
const SEGS = 256;
function boxGrid() {
  const g = new THREE.PlaneGeometry(2 * BX, 2 * BZ, SEGS, SEGS);
  g.rotateX(-Math.PI / 2);
  return g;
}

// the four sides of a rectangle hx across and hz deep (half-sizes), each a
// strip SEGS long, from aT = 0 at the bottom to 1 at the top (the shaders set
// the heights), facing out
function edgeStrips(hx, hz) {
  const pos = [], t = [], nrm = [], idx = [];
  for (const [nx, nz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const base = pos.length / 3;
    const h = nx ? hz : hx; // half the length of this side
    for (let i = 0; i <= SEGS; i++) {
      const c = -h + (2 * h * i) / SEGS;
      const x = nx ? nx * hx : c, z = nz ? nz * hz : c;
      pos.push(x, 0, z, x, 0, z);
      t.push(0, 1);
      nrm.push(nx, 0, nz, nx, 0, nz);
    }
    // winding: cross(top - bottom, along) points out when along runs this way
    const along = nx ? [0, 0, 1] : [1, 0, 0];
    const out = along[2] * nx - along[0] * nz > 0;
    for (let i = 0; i < SEGS; i++) {
      const a = base + 2 * i, b = a + 1, c = a + 2, d = a + 3;
      if (out) idx.push(a, b, c, c, b, d);
      else idx.push(a, c, b, c, d, b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setIndex(idx);
  return g;
}

export function createGlow(renderer, size = 2048, height = size) {
  const target = new THREE.WebGLRenderTarget(size, height, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
  });
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  // fading: a black veil laid over it, as thick as the time passed asks
  const veil = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false, depthWrite: false }),
  );
  veil.frustumCulled = false;
  const veilScene = new THREE.Scene().add(veil);
  const depositScene = new THREE.Scene();
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.setRenderTarget(null);
  return {
    texture: target.texture,
    depositScene,
    clear() {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.setRenderTarget(null);
    },
    update(dt, tau) {
      const auto = renderer.autoClear;
      renderer.autoClear = false;
      renderer.setRenderTarget(target);
      veil.material.opacity = 1 - Math.exp(-dt / tau);
      if (dt > 0) renderer.render(veilScene, cam);
      renderer.render(depositScene, cam);
      renderer.setRenderTarget(null);
      renderer.autoClear = auto;
    },
  };
}

// the room; seen through the tank (fog), the water dims it on the way
export function createSky(fog = false) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      defines: fog ? { FOG: 1 } : {},
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`,
      fragmentShader: /* glsl */ `
${SKY_GLSL}
${WATER_GLSL}
varying vec3 vDir;
void main() {
  vec3 col = skyColor(normalize(vDir));
  #ifdef FOG
  col = throughWater(col, cameraPosition + normalize(vDir) * 100.0, cameraPosition);
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.onBeforeRender = (r, s, camera) => mesh.position.copy(camera.position);
  return mesh;
}

// The sand is one even colour under one even light: whatever light and shade
// it shows comes from the patches the grains leave on it, nothing else.
// (Shared by the sand itself and its reflection under the surface.)
const SAND_GLSL = /* glsl */ `
${NIGHT_GLSL}
const vec3 PEBBLE_XZR[${PEBBLES.length}] = vec3[](${PEBBLES.map((p) => `vec3(${f(p.x)}, ${f(p.z)}, ${f(p.r)})`).join(', ')});
uniform sampler2D uGlow;
uniform float uGlowHalf, uGlowGain;
float sHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float sNoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(sHash(i), sHash(i + vec2(1.0, 0.0)), u.x), mix(sHash(i + vec2(0.0, 1.0)), sHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec3 sandColor(vec2 q0) {
  vec3 albedo = vec3(0.68, 0.6, 0.46);
  // (this visit's markings: shifted, the ripples turned)
  vec2 q = mat2(${f(Math.cos(SAND_LOOK.ripple))}, ${f(Math.sin(SAND_LOOK.ripple))}, ${f(-Math.sin(SAND_LOOK.ripple))}, ${f(Math.cos(SAND_LOOK.ripple))}) * q0 + vec2(${f(SAND_LOOK.off[0])}, ${f(SAND_LOOK.off[1])});
  // its surface: broad patches a little paler or darker, small ripples left
  // by the current (one side of each catching the light a little more), and
  // dark grains scattered in it
  albedo *= 0.92 + 0.14 * sNoise(q * 0.9 + 3.0) + 0.05 * sNoise(q * 3.7);
  float rp = q.x * 0.8 + q.y * 0.35 + 0.35 * sin(q.y * 1.3 + q.x * 0.4) + 0.2 * sNoise(q * 1.5);
  float ripple = sin(rp * 9.0);
  albedo *= 1.0 + 0.07 * ripple * (0.5 + 0.5 * sNoise(q * 0.7 + 9.0));
  albedo *= 1.0 - 0.18 * step(0.94, sHash(floor(q * 180.0)));
  // a little darker round the foot of the ball
  float occ = mix(0.55, 1.0, smoothstep(${f(BALL_R * 0.55)}, ${f(BALL_R * 1.5)}, distance(q0, vec2(${f(BALL.x)}, ${f(BALL.z)}))));
  // and round each pebble's
  for (int i = 0; i < ${PEBBLES.length}; i++) {
    vec3 pb = PEBBLE_XZR[i];
    occ *= mix(0.75, 1.0, smoothstep(pb.z * 0.7, pb.z * 1.4, distance(q0, pb.xy)));
  }
  vec3 lit = albedo * vec3(0.17, 0.19, 0.19) * nightDimIn() * occ;
  vec2 uv = q0 / uGlowHalf * 0.5 + 0.5;
  float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0);
  float g = texture2D(uGlow, uv).r * inside * uGlowGain;
  g = pow(max(g, 0.0), 1.5) * 0.8; // the focused lines stand out from the rest
  g = g / (1.0 + 0.12 * g); // a soft knee: dense spots don't burn out
  vec3 glowCol = moonTint(vec3(1.0, 0.82, 0.55));
  return lit + glowCol * g * (albedo * 1.6 + 0.12);
}
`;
// the light that leaves the tank through the glass, lying on the shelf
// beside it: the same glow map, 80% fainter
// than it would be (like the grains that leave it)
const OUT_GLOW_GLSL = /* glsl */ `
uniform sampler2D uGlow;
uniform float uGlowHalf, uGlowGain;
vec3 outGlow(vec2 q) {
  vec2 uv = q / uGlowHalf * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec3(0.0);
  float g = texture2D(uGlow, uv).r * uGlowGain;
  g = pow(max(g, 0.0), 1.5) * 0.8;
  g = g / (1.0 + 0.12 * g);
  return moonTint(vec3(1.0, 0.82, 0.55)) * g * 0.42 * 0.2;
}
`;
const glowUniforms = (glow) => ({
  uGlow: { value: glow.texture },
  uGlowHalf: { value: GLOW_HALF },
  uGlowGain: { value: 1 },
});

// the sand's top, inside the tank
export function createFloor(glow) {
  const mesh = new THREE.Mesh(
    boxGrid(),
    new THREE.ShaderMaterial({
      uniforms: glowUniforms(glow),
      vertexShader: /* glsl */ `
${FLOOR_GLSL}
varying vec3 vWorld;
void main() {
  vec3 p = position;
  p.y = floorHeight(p.xz);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${FLOOR_GLSL}
${WATER_GLSL}
${SAND_GLSL}
varying vec3 vWorld;
void main() {
  vec3 lit = sandColor(vWorld.xz);
  gl_FragColor = vec4(throughWater(lit, vWorld, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

// the ball on the sand (for Evan Wallace): pale, matte, lit like the sand
// only by the glow the grains leave on it, and the room's dim light
export function createBall(ballGlow) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 96, 64),
    new THREE.ShaderMaterial({
      uniforms: { uGlow: { value: ballGlow.texture }, uGlowGain: { value: 1 } },
      vertexShader: /* glsl */ `
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vN = normalize(position);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: /* glsl */ `
${FLOOR_GLSL}
${WATER_GLSL}
${BALL_GLSL}
uniform sampler2D uGlow;
uniform float uGlowGain;
varying vec3 vWorld;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  vec3 albedo = vec3(0.86, 0.86, 0.84);
  // the room's light, from above more than below, and less where it meets the sand
  float sky = 0.85 + 0.4 * n.y;
  float occ = mix(0.35, 1.0, smoothstep(0.0, 0.25, vWorld.y - floorHeight(vWorld.xz)));
  vec3 lit = albedo * vec3(0.17, 0.19, 0.19) * nightDimIn() * sky * occ;
  float g = texture2D(uGlow, ballUV(n)).r * uGlowGain;
  g = pow(max(g, 0.0), 1.5) * 0.8;
  g = g / (1.0 + 0.12 * g);
  vec3 col = lit + moonTint(vec3(1.0, 0.82, 0.55)) * g * (albedo * 1.6 + 0.12);
  gl_FragColor = vec4(throughWater(col, vWorld, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.position.set(BALL.x, BALL.y, BALL.z);
  return mesh;
}

// the pebbles on the sand: matte, of greys and browns, lit like the sand by
// the room's dim light and by the glow on the sand where they lie, on the
// faces that look up (the grains landing there show on them)
export function createPebbles(glow) {
  const geos = PEBBLES.map((p) => {
    const g = new THREE.IcosahedronGeometry(1, 4);
    // a little lumpy, each its own way
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const k = 1 + 0.07 * Math.sin(3.1 * x + 7 * p.tone) * Math.sin(2.7 * z + 3.3 * y + p.tone * 11);
      pos.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    g.scale(p.r, p.r * p.sy, p.r * p.sz).rotateY(p.rot).translate(p.x, p.y, p.z);
    g.setAttribute('aTone', new THREE.Float32BufferAttribute(new Array(pos.count).fill(p.tone), 1));
    return g;
  });
  const mesh = new THREE.Mesh(
    mergeGeometries(geos),
    new THREE.ShaderMaterial({
      uniforms: glowUniforms(glow),
      vertexShader: /* glsl */ `
attribute float aTone;
varying vec3 vWorld;
varying vec3 vN;
varying float vTone;
void main() {
  vN = normal;
  vTone = aTone;
  vWorld = position;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
${FLOOR_GLSL}
${WATER_GLSL}
${SAND_GLSL}
varying vec3 vWorld;
varying vec3 vN;
varying float vTone;
float pHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
  vec3 n = normalize(vN);
  vec3 albedo = mix(vec3(0.7, 0.69, 0.66), vec3(0.8, 0.7, 0.56), vTone);
  albedo *= vTone > 0.85 ? 0.7 : 1.0; // a darker one or two
  albedo *= 0.9 + 0.2 * pHash(floor(vWorld * 90.0)); // its grain
  float sky = 0.85 + 0.45 * n.y;
  float occ = mix(0.55, 1.0, smoothstep(0.0, 0.08, vWorld.y - floorHeight(vWorld.xz)));
  vec3 lit = albedo * vec3(0.17, 0.19, 0.19) * nightDimIn() * sky * occ;
  // the glow where it lies, on the faces turned up to the light
  vec3 g = sandColor(vWorld.xz) - vec3(0.68, 0.6, 0.46) * vec3(0.17, 0.19, 0.19) * nightDimIn();
  vec3 col = lit + max(g, 0.0) * smoothstep(-0.1, 0.7, n.y) * (albedo / vec3(0.68, 0.6, 0.46));
  gl_FragColor = vec4(throughWater(col, vWorld, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

// the sand block's sides, seen through the glass: its cut, in layers (fine
// pale sand, darker sand, a line of silt, ochre sand, grit, gravel at the
// bottom), darker deeper down, with the glow of the sand's top showing along its rim
export function createSandSides(glow) {
  const mesh = new THREE.Mesh(
    edgeStrips(BX, BZ),
    new THREE.ShaderMaterial({
      uniforms: glowUniforms(glow),
      vertexShader: /* glsl */ `
${FLOOR_GLSL}
attribute float aT;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vTop;
void main() {
  vec3 p = position;
  vTop = floorHeight(p.xz);
  p.y = mix(${f(BASE_Y)}, vTop, aT);
  vWorld = p;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${SAND_GLSL}
varying vec3 vWorld;
varying vec3 vNormal;
varying float vTop;
float hash(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(hash2(i), hash2(i + vec2(1.0, 0.0)), u.x), mix(hash2(i + vec2(0.0, 1.0)), hash2(i + vec2(1.0, 1.0)), u.x), u.y);
}
// gravel: rounded pebbles in the cut, about s across, each its own size and
// shade; returns how much of a pebble is here (0 between them), its shade in
// tone, and in dome how far in from its rim (for its roundness)
float gravel(vec2 q, float s, out float tone, out float dome) {
  vec2 c = q / s;
  vec2 i = floor(c);
  float cover = 0.0;
  tone = 0.0; dome = 0.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = i + vec2(x, y);
    vec2 o = g + 0.5 + 0.5 * (vec2(hash2(g), hash2(g + 7.3)) - 0.5);
    float r = 0.3 + 0.22 * hash2(g + 1.9);
    vec2 d = (c - o) * vec2(0.8 + 0.4 * hash2(g + 4.4), 1.25);
    float k = 1.0 - smoothstep(r - 0.07, r, length(d));
    if (k > cover) { cover = k; tone = hash2(g + 3.1); dome = 1.0 - dot(d, d) / (r * r) - 0.5 * d.y / r; }
  }
  return cover;
}
// one grain of sand per cell of size 1/k (in the cut's plane), round, a
// little off the cell's centre, each its own size; returns how much of it is
// here and, in id, a number of its own
float grain(vec2 q, float k, float seed, out float id) {
  vec2 c = q * k, i = floor(c);
  id = hash2(i + seed);
  vec2 o = i + 0.5 + 0.35 * (vec2(hash2(i + seed + 3.7), hash2(i + seed + 8.1)) - 0.5);
  float r = 0.3 + 0.25 * hash2(i + seed + 1.3);
  return 1.0 - smoothstep(r - 0.12, r + 0.05, length(c - o));
}
void main() {
  float depth = vTop - vWorld.y;
  float along = vWorld.x * vNormal.z + vWorld.z * vNormal.x + ${f(SAND_LOOK.wobble)};
  // the layers, laid down one over the other, their boundaries wandering:
  // pale fine sand on top, a band of darker sand, a thin dark line of silt,
  // ochre sand, coarse grit, and gravel at the bottom
  float wob = 0.05 * sin(along * 0.9 + 0.4) + 0.03 * sin(along * 2.3 + 1.7) + 0.04 * (vnoise(vec2(along * 1.4, 0.0)) - 0.5);
  float h = vWorld.y - ${f(BASE_Y)} + wob; // height above the tank's foot
  float H = vTop - ${f(BASE_Y)};
  vec3 pale = vec3(0.7, 0.62, 0.48), dark = vec3(0.55, 0.47, 0.36), silt = vec3(0.34, 0.29, 0.24);
  vec3 ochre = vec3(0.66, 0.53, 0.36), grit = vec3(0.5, 0.46, 0.4), stone = vec3(0.52, 0.5, 0.46);
  float x = h / max(H, 0.3); // 0 at the foot, 1 at the top
  vec3 albedo = pale;
  // (where each layer begins is this visit's own)
  albedo = mix(dark, albedo, smoothstep(${f(SAND_LOOK.layers[0])} - 0.02, ${f(SAND_LOOK.layers[0])} + 0.02, x));
  albedo = mix(silt, albedo, smoothstep(0.015, 0.03, abs(x - ${f(SAND_LOOK.layers[1])})));
  albedo = mix(ochre, albedo, smoothstep(${f(SAND_LOOK.layers[2])} - 0.02, ${f(SAND_LOOK.layers[2])} + 0.02, x));
  albedo = mix(grit, albedo, smoothstep(${f(SAND_LOOK.layers[3])} - 0.02, ${f(SAND_LOOK.layers[3])} + 0.02, x));
  // fine laminations within each layer
  float band = floor((h + 0.02 * sin(along * 3.1)) * 26.0);
  albedo *= 0.9 + 0.16 * hash(band);
  // grains, plainly seen through the glass: fine speckle under two sizes of
  // round grains, each lighter or darker, coarser lower down; and here and
  // there a grain of another colour — dark rock, white quartz, rust
  float coarse = 1.0 - smoothstep(0.2, 0.5, x);
  float silty = 1.0 - smoothstep(0.015, 0.035, abs(x - ${f(SAND_LOOK.layers[1])}));
  vec2 gq = vec2(along, h);
  float sc = mix(1.0, 2.2, coarse);
  float sp = hash2(floor(gq * 300.0));
  float id1, id2;
  float g1 = grain(gq, 120.0 / sc, 11.0, id1);
  float g2 = grain(gq + 0.37, 62.0 / sc, 29.0, id2);
  float tex = (0.86 + 0.28 * sp) * mix(1.0, 0.62 + 0.75 * id1, g1) * mix(1.0, 0.55 + 0.85 * id2, g2);
  // (between the grains, a little shade)
  tex *= 1.0 - 0.18 * (1.0 - max(g1, g2));
  albedo *= mix(tex, 1.0 + 0.5 * (tex - 1.0), silty);
  float pick = fract(id2 * 13.7);
  float odd = g2 * (1.0 - silty);
  albedo = mix(albedo, vec3(0.16, 0.14, 0.13), odd * step(0.86, pick));
  albedo = mix(albedo, vec3(0.92, 0.9, 0.84), odd * step(pick, 0.08));
  albedo = mix(albedo, vec3(0.66, 0.36, 0.2), odd * step(0.08, pick) * step(pick, 0.13));
  // the gravel at the bottom, pebbles packed against the glass
  float tone, dome;
  float inGravel = 1.0 - smoothstep(0.1, 0.17, x + 0.02 * sin(along * 5.0));
  float peb = gravel(vec2(along, h), 0.1, tone, dome) * inGravel;
  vec3 pebble = stone * (0.55 + 0.6 * tone) * mix(vec3(1.0), vec3(1.06, 0.95, 0.82), step(0.6, hash(tone * 91.0)));
  pebble *= 0.75 + 0.35 * clamp(dome, 0.0, 1.0);
  albedo = mix(albedo, pebble, peb);
  albedo *= mix(1.0, 0.7, (1.0 - peb) * inGravel); // the grit between them, in their shade
  vec3 col = albedo * vec3(0.2, 0.21, 0.21) * nightDimIn() * mix(1.0, 0.55, smoothstep(0.0, 0.8, depth));
  // the light gathered on the sand's top, bleeding a little into the cut
  col += (sandColor(vWorld.xz - vNormal.xz * 0.04) - albedo * vec3(0.17, 0.19, 0.19) * nightDimIn()) * exp(-depth * 18.0) * 0.6;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

export function createWater(sea, lightDir, below) {
  const mesh = new THREE.Mesh(
    boxGrid(),
    new THREE.ShaderMaterial({
      uniforms: {
        uBelow: { value: below },
        ...sea.uniforms,
        uRes: { value: new THREE.Vector2(1, 1) },
        uLight: { value: lightDir.clone().negate().normalize() },
      },
      vertexShader: /* glsl */ `
${sea.glsl}
varying vec3 vWorld;
void main() {
  vec3 p = position;
  p.y = seaHeight(p.xz);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${sea.glsl}
${SKY_GLSL}
uniform sampler2D uBelow;
uniform vec2 uRes;
uniform vec3 uLight;
varying vec3 vWorld;
void main() {
  vec3 toEye = cameraPosition - vWorld;
  float dist = length(toEye);
  vec3 v = toEye / dist;
  vec3 n = seaNormal(vWorld.xz);
  float cosv = max(dot(n, v), 0.0);
  // (held below a mirror: the water stays clear even on the crests' backs)
  float fres = min(0.02 + 0.98 * pow(max(1.0 - cosv, 0.0), 5.0), 0.5);
  // what's in the tank, seen through the surface, shifted by its slope
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 shift = n.xz * 0.03 * 18.0 / max(dist, 6.0);
  vec3 under = texture2D(uBelow, clamp(uv + shift, vec2(0.001), vec2(0.999))).rgb;
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  vec3 sky = skyColor(r);
  // the light the grains come from, glinting on the slopes that face it
  float spec = pow(max(dot(r, uLight), 0.0), 2500.0) * 3.0;
  vec3 col = mix(under, sky, fres) + moonTint(vec3(1.0, 0.9, 0.75)) * spec * mix(1.0, 0.6, uNight);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

// the water's sides, against the glass, from the sand up to the waves: they
// show what's in the tank (fogged by the water on the way), the room
// reflected at grazing angles, and a thin bright line where the waves meet the glass
export function createWaterSides(sea, below) {
  const mesh = new THREE.Mesh(
    edgeStrips(BX, BZ),
    new THREE.ShaderMaterial({
      uniforms: {
        uBelow: { value: below },
        ...sea.uniforms,
        uRes: { value: new THREE.Vector2(1, 1) },
      },
      vertexShader: /* glsl */ `
${sea.glsl}
${FLOOR_GLSL}
attribute float aT;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vTop;
void main() {
  vec3 p = position;
  vTop = seaHeight(p.xz);
  p.y = mix(floorHeight(p.xz), vTop, aT);
  vWorld = p;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${SKY_GLSL}
uniform sampler2D uBelow;
uniform vec2 uRes;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vTop;
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 n = normalize(vNormal);
  float cosv = max(dot(n, v), 0.0);
  float fres = min(0.03 + 0.97 * pow(max(1.0 - cosv, 0.0), 5.0), 0.6);
  vec3 under = texture2D(uBelow, gl_FragCoord.xy / uRes).rgb;
  vec3 col = mix(under, skyColor(reflect(-v, n)), fres);
  // the meniscus
  col += vec3(0.55, 0.62, 0.62) * nightDim() * exp(-(vTop - vWorld.y) * 90.0) * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

// the glass: four panes round the sand and the water, open at the top: they
// end where the waves meet them, so the box has no lid; all but clear,
// reflecting the room at grazing angles, with bright edges down the corners
// and along the foot (both faces drawn: the far panes are seen from inside)
export function createGlass(sea) {
  const hx = BX + GLASS, hz = BZ + GLASS;
  const mesh = new THREE.Mesh(
    edgeStrips(hx, hz),
    new THREE.ShaderMaterial({
      uniforms: { ...sea.uniforms },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
${sea.glsl}
attribute float aT;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 p = position;
  // up to the waves just inside the pane
  p.y = mix(${f(BASE_Y)}, seaHeight(clamp(p.xz, vec2(${f(-BX)}, ${f(-BZ)}), vec2(${f(BX)}, ${f(BZ)}))), aT);
  vWorld = p;
  vNormal = normal;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${SKY_GLSL}
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 v = normalize(cameraPosition - vWorld);
  vec3 n = normalize(vNormal);
  n = gl_FrontFacing ? n : -n;
  float cosv = abs(dot(n, v));
  float fres = 0.04 + 0.96 * pow(max(1.0 - cosv, 0.0), 5.0);
  // how far to the pane's nearest edge — the corners and the foot; none
  // along the top, which is open (the middle of the three distances: the
  // smallest is across the pane itself)
  vec3 e = vec3(${f(hx)} - abs(vWorld.x), vWorld.y - ${f(BASE_Y)}, ${f(hz)} - abs(vWorld.z));
  float edge = e.x + e.y + e.z - min(min(e.x, e.y), e.z) - max(max(e.x, e.y), e.z);
  // (never below 0: a pane seen edge on is shaded a little past its own
  // triangles, where this would go negative and the rim flare to no end)
  edge = max(edge, 0.0);
  float rim = exp(-edge * 140.0) * 0.55 + exp(-edge * 25.0) * 0.08;
  // (along the foot, where the glass sits in the shade on the wood, much less)
  float foot = 1.0 - smoothstep(0.0, 0.05, e.y);
  rim *= mix(1.0, 0.3, foot * step(e.y, min(e.x, e.z)));
  vec3 col = skyColor(reflect(-v, n)) * 1.6 + vec3(0.7, 0.8, 0.78) * nightDim() * rim;
  float a = clamp(fres * 0.9 + rim + 0.025, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  return mesh;
}

// ---- the room: the tank stands on a thick shelf of light wood, in a
// recess between two walls, a little out from the back wall and not quite
// square to it (the room is turned ROOM_ANGLE). Warm late-afternoon sun comes
// in low through a window in the left wall, lies on the wood and the walls
// in a patch crossed by the window's bars, and the tank's soft shadow runs
// off to the right; the rest is lit by the warm light the room gives back.
// Everything here is worked out in the room's frame (vRoom), but for the
// tank's shadow, the glow and the water, in the tank's (vWorld).
const SUN = new THREE.Vector3(-1, 0.45, 0.55).normalize();
const SUN_W = (() => {
  const [x, z] = fromRoom(SUN.x, SUN.z);
  return new THREE.Vector3(x, SUN.y, z);
})();
const RH = ROOM_HALF;
const SHELF_BOTTOM = BASE_Y - SHELF_THICK;
const ROOM_FRONT = 60; // how far the side walls come forward
const v3 = (v) => `vec3(${f(v.x)}, ${f(v.y)}, ${f(v.z)})`;
// the shelf and the stand under it, as boxes (centre, half-sizes; room frame)
const SHELF_C = { x: 0, y: BASE_Y - SHELF_THICK / 2, z: (WALL_Z + SHELF_FRONT) / 2 };
const SHELF_H = { x: SHELF_HALF, y: SHELF_THICK / 2, z: (SHELF_FRONT - WALL_Z) / 2 };
const STAND_FRONT = SHELF_FRONT - STAND_INSET, STAND_HALF = SHELF_HALF - STAND_INSET;
const STAND_C = { x: 0, y: (SHELF_BOTTOM + ROOM_FLOOR_Y) / 2, z: (WALL_Z + STAND_FRONT) / 2 };
const STAND_H = { x: STAND_HALF, y: (SHELF_BOTTOM - ROOM_FLOOR_Y) / 2, z: (STAND_FRONT - WALL_Z) / 2 };
const ROOM_GLSL = /* glsl */ `
const vec3 SUN = ${v3(SUN)};
const vec3 SUN_W = ${v3(SUN_W)};
float rHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rNoise(vec2 p) {
  vec2 i = floor(p), u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(mix(rHash(i), rHash(i + vec2(1.0, 0.0)), u.x), mix(rHash(i + vec2(0.0, 1.0)), rHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float rFbm(vec2 p) {
  return 0.5 * rNoise(p) + 0.27 * rNoise(p * 2.03 + 5.1) + 0.15 * rNoise(p * 4.1 + 1.7) + 0.08 * rNoise(p * 8.3 + 3.3);
}
vec3 toRoom(vec3 w) {
  return vec3(w.x * ${f(Math.cos(ROOM_ANGLE))} - w.z * ${f(Math.sin(ROOM_ANGLE))}, w.y, w.x * ${f(Math.sin(ROOM_ANGLE))} + w.z * ${f(Math.cos(ROOM_ANGLE))});
}
// the window: its opening in the left wall, and its bars (a cross)
const vec4 WIN_RECT = vec4(${f(WINDOW.z0)}, ${f(WINDOW.z1)}, ${f(WINDOW.y0)}, ${f(WINDOW.y1)});
const vec2 WIN_BARS = vec2(${f((WINDOW.z0 + WINDOW.z1) / 2)}, ${f(WINDOW.y0 + (WINDOW.y1 - WINDOW.y0) * 0.62)});
// how much of the window's opening is seen at (z, y) on the wall, softened by s
float windowOpen(vec2 q, float s) {
  float a = smoothstep(WIN_RECT.x - s, WIN_RECT.x + s, q.x) * (1.0 - smoothstep(WIN_RECT.y - s, WIN_RECT.y + s, q.x));
  float b = smoothstep(WIN_RECT.z - s, WIN_RECT.z + s, q.y) * (1.0 - smoothstep(WIN_RECT.w - s, WIN_RECT.w + s, q.y));
  vec2 bar = abs(q - WIN_BARS);
  float bars = smoothstep(0.07, 0.07 + 2.0 * s, bar.x) * smoothstep(0.07, 0.07 + 2.0 * s, bar.y);
  return a * b * bars;
}
// the shelf and the low wall under it (room frame), as a distance
float sdBox(vec3 p, vec3 c, vec3 h) {
  vec3 d = abs(p - c) - h;
  return length(max(d, 0.0)) + min(max(max(d.x, d.y), d.z), 0.0);
}
float sdShelf(vec3 p) {
  return sdBox(p, ${v3(SHELF_C)}, ${v3(SHELF_H)});
}
float sdStand(vec3 p) {
  return sdBox(p, ${v3(STAND_C)}, ${v3(STAND_H)});
}
// the sun at p (room frame): through the window, past the shelf and the
// wall under it (a soft shadow, the softer the further they are)
float sunThrough(vec3 p) {
  float t = (${f(-RH)} - p.x) / SUN.x;
  if (t <= 0.0) return 0.0;
  vec3 q = p + SUN * t;
  float lit = windowOpen(q.zy, 0.03 + 0.012 * t);
  if (lit <= 0.0 || p.y > ${f(BASE_Y)} + 0.01) return lit;
  float s = 0.08, res = 1.0;
  for (int i = 0; i < 40; i++) {
    vec3 c = p + SUN * s;
    if (c.y > ${f(BASE_Y)} + 0.05 || s > t) break;
    float d = min(sdShelf(c), sdStand(c));
    res = min(res, 9.0 * max(d, 0.0) / s);
    if (res < 0.01) break;
    s += clamp(d, 0.04, 1.5);
  }
  return lit * smoothstep(0.0, 1.0, res);
}
// the tank's soft shadow (tank frame): along the way to the sun, how much of
// the tank is crossed (its water and glass let some light through); the
// further the tank, the softer the edge
float tankShadow(vec3 p) {
  float sh = 0.0;
  for (int i = 0; i < 10; i++) {
    float y = ${f(BASE_Y)} + (float(i) + 0.5) / 10.0 * ${f(WATER_Y - BASE_Y)};
    float t = (y - p.y) / SUN_W.y;
    if (t < 0.0) continue;
    vec3 q = p + SUN_W * t;
    vec2 d = abs(q.xz) - vec2(${f(BX)}, ${f(BZ)});
    float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    float soft = 0.04 + 0.12 * t;
    sh = max(sh, 1.0 - smoothstep(-soft, soft, sd));
  }
  return sh * 0.5;
}
// the light falling on a surface at r (room frame; w the same in the tank's)
// facing n, of colour albedo; ao: how open it is to the room
vec3 roomLight(vec3 r, vec3 w, vec3 n, vec3 albedo, float ao) {
  float cosS = max(dot(n, SUN), 0.0);
  float sun = cosS > 0.0 ? cosS * sunThrough(r) * (1.0 - tankShadow(w)) : 0.0;
  // the room's light: the window's side brighter, warm from the wood and walls
  float side = mix(1.2, 0.8, smoothstep(${f(-RH)}, ${f(RH)}, r.x));
  float sky = (0.7 + 0.14 * n.y + 0.14 * max(-n.x, 0.0)) * ao * side;
  // (at night: the moon in place of the sun, much fainter; the room's own light dim and blue)
  return albedo * (moonTint(vec3(1.0, 0.82, 0.6)) * sun * mix(1.3, 0.3 * uMoon, uNight) + vec3(1.0, 0.91, 0.8) * nightDim() * sky);
}
// a soft glint of the sun on a satin finish
float sunGlint(vec3 r, vec3 n, float sharp) {
  vec3 v = normalize(toRoom(cameraPosition) - r);
  return pow(max(dot(reflect(-SUN, n), v), 0.0), sharp) * sunThrough(r) * mix(1.0, 0.3 * uMoon, uNight);
}
`;
const WOOD_GLSL = /* glsl */ `
// light wood in boards BOARD wide; q.x along the grain, q.y across it (from
// the first board's edge); returns the colour, and in relief the grain's
vec3 wood(vec2 q, float BOARD, out float relief) {
  // two boards side by side, each its own cut of the tree
  float b = floor(q.y / BOARD);
  float across = q.y - b * BOARD;
  vec2 p = vec2(q.x + b * 13.7, across + b * 3.1);
  // knots, the grain bending round them
  float knot = 0.0, bend = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 k = vec2(i == 0 ? -6.3 : 5.2, i == 0 ? 1.5 : 2.6) + b * vec2(9.0, -0.8);
    vec2 d = (p - k) * vec2(0.45, 1.0);
    float r2 = dot(d, d);
    bend += 0.8 * exp(-r2 * 1.2);
    knot = max(knot, 1.0 - smoothstep(0.03, 0.09, r2));
  }
  // the rings, in wide arches (flat sawn) wandering along the board
  // (rings a board's width apart near the heart, the arches' tips, wider at its sides)
  float py = p.y - BOARD * (0.5 + 0.25 * sin(p.x * 0.05 + b)); // the heart wanders across the board
  float arch = py * py * 0.35 - p.x * 0.11 + 0.6 * sin(p.x * 0.13 + b * 2.0);
  float w = arch + 0.45 * sin(p.x * 0.09 + p.y * 0.3) + 1.5 * rFbm(vec2(p.x * 0.07, p.y * 0.3)) + bend;
  float ring = fract(w * 1.7);
  float late = smoothstep(0.62, 0.86, ring) * (1.0 - smoothstep(0.9, 1.0, ring));
  late *= 0.45 + 0.55 * rNoise(vec2(p.x * 0.3, w * 2.0)); // some rings fainter than others
  // each ring: pale early wood darkening towards the late wood's sharp line
  vec3 c = mix(vec3(0.74, 0.58, 0.4), vec3(0.66, 0.5, 0.33), smoothstep(0.0, 0.62, ring) * 0.6);
  c = mix(c, vec3(0.5, 0.35, 0.21), late * 0.9);
  // thin secondary lines between the rings
  float fine = fract(w * 5.1 + 0.3 * rNoise(vec2(p.x * 0.2, p.y * 3.0)));
  c *= 1.0 - 0.07 * smoothstep(0.8, 0.95, fine) * (1.0 - smoothstep(0.95, 1.0, fine));
  // a few long darker streaks along the grain
  c *= 1.0 - 0.1 * smoothstep(0.6, 0.85, rNoise(vec2(p.x * 0.06, p.y * 6.0 + 2.0)));
  c *= 0.93 + 0.12 * rFbm(p * vec2(0.15, 0.8)); // broad mottling
  // fibres and pores: long fine streaks along the grain
  float fib = rNoise(vec2(p.x * 0.8, p.y * 38.0)) * 0.6 + rNoise(vec2(p.x * 2.5, p.y * 90.0)) * 0.4;
  float pores = smoothstep(0.75, 0.95, rNoise(vec2(p.x * 3.5, p.y * 140.0)));
  c *= 0.9 + 0.16 * fib;
  c *= 1.0 - 0.22 * pores * (0.5 + late);
  c *= 0.94 + 0.08 * rNoise(vec2(b * 7.1, 0.5)); // board to board
  c = mix(c, vec3(0.33, 0.2, 0.11), knot * 0.85);
  // the seam between the boards
  float seam = min(across, BOARD - across);
  c *= 1.0 - 0.45 * exp(-seam * 120.0);
  relief = late * 0.6 + fib * 0.3 - pores * 0.3;
  return c;
}
`;
const roomVert = /* glsl */ `
varying vec3 vRoom;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vRoom = position;
  vNormal = normal;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// the walls: the back one and the two at the room's sides, warm white
// paint, its grain (a fine orange peel and the roller's faint streaks)
// catching the low sun; soft shade in the corners; the window in the left one
export function createWalls(fog = false) {
  const H = 300;
  const depth = ROOM_FRONT - WALL_Z;
  const back = new THREE.PlaneGeometry(2 * RH, H).translate(0, 0, WALL_Z);
  const left = new THREE.PlaneGeometry(depth, H).rotateY(Math.PI / 2).translate(-RH, 0, WALL_Z + depth / 2);
  const right = new THREE.PlaneGeometry(depth, H).rotateY(-Math.PI / 2).translate(RH, 0, WALL_Z + depth / 2);
  // the low wall under the shelf: its front and its two ends
  const sh = SHELF_BOTTOM - ROOM_FLOOR_Y, sd = STAND_FRONT - WALL_Z, sy = (SHELF_BOTTOM + ROOM_FLOOR_Y) / 2;
  const sFront = new THREE.PlaneGeometry(2 * STAND_HALF, sh).translate(0, sy, STAND_FRONT);
  const sLeft = new THREE.PlaneGeometry(sd, sh).rotateY(-Math.PI / 2).translate(-STAND_HALF, sy, WALL_Z + sd / 2);
  const sRight = new THREE.PlaneGeometry(sd, sh).rotateY(Math.PI / 2).translate(STAND_HALF, sy, WALL_Z + sd / 2);
  const geo = mergeGeometries([back, left, right, sFront, sLeft, sRight]);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.ShaderMaterial({
      defines: fog ? { FOG: 1 } : {},
      vertexShader: roomVert,
      fragmentShader: /* glsl */ `
${WATER_GLSL}
${ROOM_GLSL}
varying vec3 vRoom;
varying vec3 vWorld;
varying vec3 vNormal;
// the paint's relief
float paint(vec2 q) {
  return 0.55 * rNoise(q * 11.0) + 0.3 * rNoise(q * 29.0 + 3.1) + 0.15 * rNoise(q * 71.0 + 7.7)
    + 0.5 * rNoise(vec2(q.x * 7.0, q.y * 0.45)); // the roller, up and down
}
void main() {
  vec3 n = normalize(vNormal);
  vec3 r = vRoom;
  vec3 u = normalize(cross(vec3(0.0, 1.0, 0.0), n)); // along the wall
  vec2 q = vec2(dot(r, u), r.y);
  float h = paint(q);
  float e = 0.012;
  vec2 g = vec2(paint(q + vec2(e, 0.0)) - h, paint(q + vec2(0.0, e)) - h) / e;
  vec3 nb = normalize(n - 0.0045 * (g.x * u + g.y * vec3(0.0, 1.0, 0.0)));
  vec3 albedo = vec3(0.88, 0.84, 0.77) * (0.95 + 0.06 * rFbm(q * 0.35) + 0.03 * h);
  // the corners: against the other walls, round the shelf and the wall
  // under it, along the floor
  bool stand = abs(r.x) < ${f(RH - 0.5)} && r.z > ${f(WALL_Z + 0.01)};
  float dWall = stand ? 100.0 : n.z > 0.5 ? ${f(RH)} - abs(r.x) : r.z - ${f(WALL_Z)};
  float dShelf = max(sdShelf(r), 0.0);
  float dStand = stand ? 100.0 : max(sdStand(r), 0.0);
  float ao = (1.0 - 0.32 * exp(-dWall * 1.4)) * (1.0 - 0.4 * exp(-dShelf * 1.8)) * (1.0 - 0.3 * exp(-dStand * 1.4));
  ao *= 1.0 - 0.3 * exp(-(r.y - ${f(ROOM_FLOOR_Y)}) * 1.2);
  // under the plank's overhang, and against the back wall
  if (stand) ao *= (1.0 - 0.5 * exp(-(${f(SHELF_BOTTOM)} - r.y) * 3.5) - 0.15 * exp(-(${f(SHELF_BOTTOM)} - r.y) * 0.6)) * (1.0 - 0.3 * exp(-(r.z - ${f(WALL_Z)}) * 1.4));
  vec3 col = roomLight(r, vWorld, nb, albedo, ao);
  // the window: the bright day outside, and its white frame
  if (n.x > 0.5 && !stand) {
    float open = windowOpen(r.zy, 0.004);
    vec2 dz = vec2(r.z - WIN_RECT.x, WIN_RECT.y - r.z), dy = vec2(r.y - WIN_RECT.z, WIN_RECT.w - r.y);
    float frame = step(-0.22, min(min(dz.x, dz.y), min(dy.x, dy.y)));
    col *= 1.0 + 0.15 * frame;
    float up = smoothstep(WIN_RECT.z, WIN_RECT.w, r.y);
    vec3 day = mix(vec3(1.9, 1.7, 1.4), vec3(1.25, 1.4, 1.6), up);
    // the night outside: a deep blue sky, paler low down where the moon
    // lights the haze, and a few stars
    vec3 night = mix(0.153 * nightTint(vec3(0.588, 0.85, 1.57)), 0.0517 * nightTint(vec3(0.484, 0.774, 1.74)), up) * sqrt(uNightLight);
    vec2 sc = r.zy * 9.0, si = floor(sc);
    float star = step(0.985, rHash(si)) * (1.0 - smoothstep(0.03, 0.12, length(sc - si - 0.5)));
    night += vec3(0.85, 0.9, 1.0) * star * (0.4 + 0.8 * rHash(si + 7.1)) * up;
    col = mix(col, mix(day, night, uNight), open);
  }
  #ifdef FOG
  col = throughWater(col, vWorld, cameraPosition);
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.rotation.y = ROOM_ANGLE;
  mesh.frustumCulled = false;
  return mesh;
}

// the shelf: a thick plank of light wood, centred on the back wall, with its grain
// running along it (rings, fibres, pores, two boards, a knot or two), a
// satin sheen in the sun, the tank's soft shadow on it, and the light come
// out of the tank through the glass lying on it beside the tank
export function createShelf(fog = false, glow = null) {
  const depth = SHELF_FRONT - WALL_Z;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2 * SHELF_HALF, SHELF_THICK, depth).translate(0, BASE_Y - SHELF_THICK / 2, WALL_Z + depth / 2),
    new THREE.ShaderMaterial({
      defines: { ...(fog ? { FOG: 1 } : {}), ...(glow ? { GLOW: 1 } : {}) },
      uniforms: glow ? glowUniforms(glow) : {},
      vertexShader: roomVert,
      fragmentShader: /* glsl */ `
${WATER_GLSL}
${ROOM_GLSL}
${WOOD_GLSL}
#ifdef GLOW
${OUT_GLOW_GLSL}
#endif
const float BOARD = ${f((SHELF_FRONT - WALL_Z) / 2)};
varying vec3 vRoom;
varying vec3 vWorld;
varying vec3 vNormal;
void main() {
  vec3 n = normalize(vNormal);
  vec3 r = vRoom;
  vec3 albedo;
  float relief = 0.0, ao = 1.0;
  if (n.y > 0.5) {
    albedo = wood(vec2(r.x, r.z - ${f(WALL_Z)}), BOARD, relief);
    // against the walls, and round the tank's foot
    ao = 1.0 - 0.35 * exp(-(r.z - ${f(WALL_Z)}) * 2.0);
    vec2 d = abs(vWorld.xz) - vec2(${f(BX + GLASS)}, ${f(BZ + GLASS)});
    float sd = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    // the tank's foot: a tight dark line where the glass meets the wood, and
    // a wider soft shade round it, the tank shutting out the room's light
    sd = max(sd, 0.0);
    ao *= (1.0 - 0.75 * exp(-sd * 20.0)) * (1.0 - 0.5 * exp(-sd * 3.0)) * (1.0 - 0.2 * exp(-sd * 0.8));
  } else if (abs(n.z) > 0.5) {
    // the front edge: the same grain, seen on its side, its corners rounded off by the light
    albedo = wood(vec2(r.x, ${f(SHELF_FRONT - WALL_Z)} - 0.05 - (${f(BASE_Y)} - r.y) * 0.25), BOARD, relief) * 0.95;
    float edge = min(${f(BASE_Y)} - r.y, r.y - ${f(SHELF_BOTTOM)});
    albedo *= 1.0 + 0.2 * exp(-edge * 50.0);
  } else {
    albedo = vec3(0.55, 0.4, 0.26) * (0.85 + 0.15 * rNoise(r.zy * vec2(3.0, 30.0)));
  }
  // underneath, the shelf only sees the room below
  if (n.y < -0.5) albedo *= 0.6;
  vec3 col = roomLight(r, vWorld, n, albedo, ao);
  // its satin finish: a soft sheen in the sun, broken by the grain
  // (faint, and gone at grazing angles, where it would stretch into a long
  // blinding streak along the plank)
  if (n.y > 0.5) {
    float facing = smoothstep(0.08, 0.45, dot(n, normalize(toRoom(cameraPosition) - r)));
    col += moonTint(vec3(1.0, 0.82, 0.6)) * sunGlint(r, n, 30.0) * (0.07 - 0.03 * relief) * facing * (1.0 - tankShadow(vWorld));
  }
  #ifdef GLOW
  if (n.y > 0.5 && (abs(vWorld.x) > ${f(BX + GLASS)} || abs(vWorld.z) > ${f(BZ + GLASS)})) col += outGlow(vWorld.xz) * 1.6;
  #endif
  #ifdef FOG
  col = throughWater(col, vWorld, cameraPosition);
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.rotation.y = ROOM_ANGLE;
  mesh.frustumCulled = false;
  return mesh;
}

// the room's floor: boards of the same light wood as the shelf, running out
// from the back wall, their ends staggered; the sun through the window lies
// on it, the shelf's wall casts its shadow; darker along the walls
export function createRoomFloor(fog = false) {
  const depth = ROOM_FRONT - WALL_Z;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * RH, depth).rotateX(-Math.PI / 2).translate(0, ROOM_FLOOR_Y, WALL_Z + depth / 2),
    new THREE.ShaderMaterial({
      defines: fog ? { FOG: 1 } : {},
      vertexShader: roomVert,
      fragmentShader: /* glsl */ `
${WATER_GLSL}
${ROOM_GLSL}
${WOOD_GLSL}
varying vec3 vRoom;
varying vec3 vWorld;
varying vec3 vNormal;
const float FB = 1.15; // a floorboard's width
void main() {
  vec3 r = vRoom;
  vec3 n = vec3(0.0, 1.0, 0.0);
  // along the boards (z), across them (x); each board in lengths, staggered
  vec2 q = vec2(r.z - ${f(WALL_Z)}, r.x + ${f(RH)});
  float b = floor(q.y / FB);
  float L = 14.0;
  float off = fract(sin(b * 12.9898) * 43758.5453) * L;
  float seg = floor((q.x + off) / L);
  float along = q.x + off - seg * L;
  float relief;
  vec3 albedo = wood(vec2(q.x + seg * 31.7, q.y + seg * 0.37), FB, relief);
  albedo = mix(albedo, vec3(0.66, 0.5, 0.34), 0.3); // (seen from afar: a quieter grain)
  albedo *= 0.9 + 0.12 * fract(sin(dot(vec2(b, seg), vec2(7.13, 3.71))) * 9137.31); // board to board
  // the joints at the boards' ends
  albedo *= 1.0 - 0.45 * exp(-min(along, L - along) * 90.0);
  // along the walls and the low wall under the shelf
  float dw = min(min(${f(RH)} - abs(r.x), r.z - ${f(WALL_Z)}), max(sdStand(r), 0.0));
  float ao = 1.0 - 0.4 * exp(-dw * 1.3) - 0.2 * exp(-dw * 6.0);
  vec3 col = roomLight(r, vWorld, n, albedo, ao);
  // a soft satin sheen in the sun, broken by the grain
  col += moonTint(vec3(1.0, 0.82, 0.6)) * sunGlint(r, n, 10.0) * (0.06 - 0.03 * relief);
  #ifdef FOG
  col = throughWater(col, vWorld, cameraPosition);
  #endif
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.rotation.y = ROOM_ANGLE;
  mesh.frustumCulled = false;
  return mesh;
}

// the surface seen from under it (through the glass, from low down): the
// room only through Snell's window overhead, bent by the waves; beyond it the
// surface is a mirror (total internal reflection) giving back the sand and
// its patches of light, wobbling with every wave
export function createWaterUnderside(sea, lightDir, glow) {
  const mesh = new THREE.Mesh(
    boxGrid(),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        ...sea.uniforms,
        uLight: { value: lightDir.clone().negate().normalize() },
        ...glowUniforms(glow),
      },
      vertexShader: /* glsl */ `
${sea.glsl}
varying vec3 vWorld;
void main() {
  vec3 p = position;
  p.y = seaHeight(p.xz);
  vWorld = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: /* glsl */ `
${sea.glsl}
${WATER_GLSL}
${FLOOR_GLSL}
${SAND_GLSL}
${SKY_GLSL}
uniform vec3 uLight;
varying vec3 vWorld;
void main() {
  vec3 v = normalize(cameraPosition - vWorld); // down, towards the eye
  vec3 n = -seaNormal(vWorld.xz);              // the surface's face turned to the water
  float cosi = clamp(dot(n, v), 0.0, 1.0);
  float eta = ${IOR.toFixed(4)};
  float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
  // the water mirrored: down the reflected ray to the sand (taken as flat at
  // its mean level, and kept in the tank), dimmed by the water on the way
  vec3 r = reflect(-v, n);
  r.y = min(r.y, -0.05);
  vec3 hit = vWorld + r * ((${FLOOR_Y.toFixed(3)} - vWorld.y) / r.y);
  hit.xz = clamp(hit.xz, vec2(${f(-BX)}, ${f(-BZ)}), vec2(${f(BX)}, ${f(BZ)}));
  vec3 mirror = throughWater(sandColor(hit.xz), hit, vWorld);
  vec3 col = mirror;
  if (k > 0.0) {
    float cost = sqrt(k);
    float r0 = ((eta - 1.0) / (eta + 1.0)) * ((eta - 1.0) / (eta + 1.0));
    float fres = r0 + (1.0 - r0) * pow(max(1.0 - cost, 0.0), 5.0);
    vec3 t = normalize(-eta * v + (eta * cosi - cost) * n);
    vec3 sky = skyColor(t);
    float sun = pow(max(dot(t, uLight), 0.0), 400.0) * 4.0;
    col = mix(mirror, mix(sky + moonTint(vec3(1.0, 0.9, 0.75)) * sun * mix(1.0, 0.6, uNight), mirror, fres), smoothstep(0.0, 0.25, k));
  }
  gl_FragColor = vec4(throughWater(col, vWorld, cameraPosition), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    }),
  );
  mesh.frustumCulled = false;
  return mesh;
}

export function createPost(renderer, scene, camera) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  // a pixel gone bad (not a number, or past what a half float holds) would be
  // spread by the bloom's blurs into a big black block: put out before it
  composer.addPass(
    new ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  bool bad = any(isnan(c)) || any(isinf(c));
  gl_FragColor = bad ? vec4(0.0, 0.0, 0.0, 1.0) : clamp(c, 0.0, 1000.0);
}`,
    }),
  );
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.55, 0.35, 1.05);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    pass: composer.passes[0],
    setSize(w, h) {
      composer.setSize(w, h);
    },
  };
}
