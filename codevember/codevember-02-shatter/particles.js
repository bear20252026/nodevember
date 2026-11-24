import * as THREE from 'three';
import { noiseGLSL, materialGLSL } from './materials.js';

// The fine debris of a break: tiny shards of glass, splinters of wood, grit.
// Each is a small solid, its shape that of its material (thin sharp flakes of
// glass, long splinters of wood along the grain, angular crystals of marble,
// round grains of sand, chips of ceramic glazed on one side), painted with the
// pattern of the volume where it came off: the dark ring of the wood, the vein
// of the marble, the bed of the stone. It comes off the crack faces as a piece
// flies off, and goes along with the pieces: thrown out with them, a little
// faster or slower, falling with them, the air holding it back a little;
// tumbling, its faces turn to the sun and away, and the glossy ones flash. All
// of it is worked out on the GPU from its start: where, when, how fast, its
// turn.
//
// They have their own random numbers: ?seed=n replays the same volumes, with
// or without them.

let seed = 0x9e3779b9;
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const range = (a, b) => a + (b - a) * rand();

// The shapes of the debris, solids of unit size, x along their length, y
// across, z their thickness; each corner numbered (it is jittered as one, so
// the faces stay closed) and each face marked: 0 a broken face, 1 the outside
// of the volume (the glaze of a ceramic chip), 2 an edge (where glass shows
// its tint, thick)
//   flake     a thin triangular slab, its tip at the front: glass, obsidian,
//             ceramic chips
//   splinter  long, four-sided, pointed at both ends: wood, along its grain
//   chunk     an angular lump, eight faces: ice, marble crystals
//   grit      a rounder lump, twenty faces: sand grains
const SHAPES = {
  flake: {
    corners: [[0.65, 0, 0.5], [-0.35, 0.5, 0.5], [-0.35, -0.5, 0.5], [0.65, 0, -0.5], [-0.35, 0.5, -0.5], [-0.35, -0.5, -0.5]],
    faces: [[[0, 1, 2], 1], [[3, 4, 5], 0], [[0, 1, 4, 3], 2], [[1, 2, 5, 4], 2], [[2, 0, 3, 5], 2]],
  },
  splinter: {
    corners: [[0.5, 0, 0], [0.12, 0.5, 0], [0.12, 0, 0.5], [0.12, -0.5, 0], [0.12, 0, -0.5], [-0.2, 0.5, 0], [-0.2, 0, 0.5], [-0.2, -0.5, 0], [-0.2, 0, -0.5], [-0.5, 0, 0]],
    faces: [0, 1, 2, 3].flatMap((i) => {
      const j = (i + 1) % 4;
      return [[[0, 1 + i, 1 + j], 0], [[1 + i, 1 + j, 5 + j, 5 + i], 0], [[5 + i, 5 + j, 9], 0]];
    }),
  },
  chunk: {
    corners: [[0.5, 0, 0], [-0.5, 0, 0], [0, 0.5, 0], [0, -0.5, 0], [0, 0, 0.5], [0, 0, -0.5]],
    faces: [[0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]].map((f) => [f, 0]),
  },
  grit: (() => {
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    const pos = g.getAttribute('position');
    const corners = [], faces = [];
    for (let i = 0; i < pos.count; i += 3) {
      const tri = [];
      for (let k = 0; k < 3; k++) {
        const c = [pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k)];
        let at = corners.findIndex((d) => Math.hypot(d[0] - c[0], d[1] - c[1], d[2] - c[2]) < 1e-4);
        if (at < 0) at = corners.push(c) - 1;
        tri.push(at);
      }
      faces.push([tri, 0]);
    }
    g.dispose();
    return { corners, faces };
  })(),
};

// the triangles of a shape, turned outward
function shapeGeometry({ corners, faces }) {
  const center = new THREE.Vector3();
  for (const c of corners) center.add(new THREE.Vector3(...c));
  center.divideScalar(corners.length);
  const position = [], corner = [], face = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (const [ids, type] of faces) {
    for (let k = 1; k + 1 < ids.length; k++) {
      let tri = [ids[0], ids[k], ids[k + 1]];
      a.set(...corners[tri[0]]), b.set(...corners[tri[1]]), c.set(...corners[tri[2]]);
      m.copy(a).add(b).add(c).divideScalar(3).sub(center);
      if (b.sub(a).cross(c.sub(a)).dot(m) < 0) tri = [tri[0], tri[2], tri[1]];
      for (const i of tri) position.push(...corners[i]), corner.push(i), face.push(type);
    }
  }
  return { position, corner, face };
}

// per material, in volume units (radius 1):
//   shape    of a shard (above); count, over the whole volume
//   length   of a shard, its long side; width and thick, for its length;
//            jitter, how irregular its corners
//   along    1: it lies along the grain of the material (the fibers of wood)
//   chips    how many of them, among the grains, are bigger chips (and how
//            much bigger)
//   speed    how much faster than its piece it can leave; spread, sideways
//   drag     how much the air holds it back; life, in seconds
//   glint    how bright the sun on its face, shine how sharp, rough the
//            polish of the material (its pattern makes it vary); body, how
//            much light its color takes (little for glass: its flashes)
//   tone     how light its color (1 the material's own), alpha its opacity;
//            edge, how much its edges show the tint of the glass; deep, how
//            much it takes the deep color of the ice
//   micro    the texture of the shard itself, how strong; its scale along,
//            across and through it (fibers along a splinter, grains of sand)
//   metal    1: its flashes and the room in it take its color, it hardly
//            takes the light otherwise
//   sparks   how many of them, among the shards, are sparks: bright, thin,
//            fast, gone in a moment (steel)
const KINDS = {
  glass: { shape: 'flake', count: 1300, length: [0.01, 0.04], width: [0.2, 0.5], thick: [0.05, 0.1], jitter: 0.12, glint: 3, shine: 40, rough: 0.06, body: 0.35, tone: 0.75, alpha: 0.6, edge: 1, micro: 0, microScale: [1, 1, 1], drag: 0.35 },
  obsidian: { shape: 'flake', count: 900, length: [0.012, 0.05], width: [0.15, 0.4], thick: [0.04, 0.08], jitter: 0.15, glint: 4, shine: 50, rough: 0.14, body: 0.9, tone: 1, alpha: 1, edge: 0, micro: 0, microScale: [1, 1, 1], drag: 0.3 },
  ceramic: { shape: 'flake', count: 900, length: [0.01, 0.035], width: [0.45, 0.85], thick: [0.12, 0.22], jitter: 0.2, glint: 1.4, shine: 24, rough: 0.3, body: 0.9, tone: 0.92, alpha: 1, edge: 0, micro: 0.08, microScale: [6, 6, 6], drag: 0.45 },
  ice: { shape: 'chunk', count: 1300, length: [0.008, 0.03], width: [0.45, 0.8], thick: [0.35, 0.7], jitter: 0.3, glint: 2.6, shine: 30, rough: 0.12, body: 0.6, tone: 0.8, alpha: 0.8, edge: 0, deep: 0.8, micro: 0.1, microScale: [4, 4, 4], drag: 0.45 },
  wood: { shape: 'splinter', count: 650, length: [0.02, 0.1], width: [0.07, 0.16], thick: [0.05, 0.12], jitter: 0.15, along: 1, glint: 0.6, shine: 8, rough: 0.55, body: 0.95, tone: 0.9, alpha: 1, edge: 0, micro: 0.22, microScale: [1.5, 18, 18], drag: 0.4 },
  marble: { shape: 'chunk', count: 1700, length: [0.006, 0.026], width: [0.55, 0.9], thick: [0.45, 0.85], jitter: 0.3, glint: 1.4, shine: 20, rough: 0.25, body: 0.95, tone: 0.9, alpha: 1, edge: 0, chips: [0.06, 2.2], micro: 0.1, microScale: [5, 5, 5], drag: 0.6 },
  // gold leaf: thin flakes, the air holds them, they flutter down slowly
  gold: { shape: 'flake', count: 700, length: [0.012, 0.05], width: [0.5, 0.9], thick: [0.015, 0.04], jitter: 0.25, glint: 5, shine: 30, rough: 0.2, body: 0.3, tone: 1, alpha: 1, edge: 0, metal: 1, micro: 0.05, microScale: [5, 5, 5], drag: 1.6 },
  silver: { shape: 'chunk', count: 1100, length: [0.01, 0.04], width: [0.4, 0.8], thick: [0.25, 0.5], jitter: 0.3, glint: 5, shine: 40, rough: 0.15, body: 0.3, tone: 1, alpha: 1, edge: 0, metal: 1, chips: [0.05, 2], micro: 0.05, microScale: [5, 5, 5], drag: 0.5 },
  // steel: small sharp chips, like the pieces it breaks into, not hairs
  steel: { shape: 'flake', count: 1100, length: [0.008, 0.035], width: [0.4, 0.8], thick: [0.15, 0.3], jitter: 0.25, glint: 4, shine: 50, rough: 0.3, body: 0.3, tone: 1, alpha: 1, edge: 0, metal: 1, sparks: 0.1, micro: 0.05, microScale: [2, 12, 12], drag: 0.4 },
  stone: { shape: 'grit', count: 2100, length: [0.005, 0.02], width: [0.6, 1], thick: [0.5, 0.9], jitter: 0.35, glint: 1, shine: 16, rough: 0.92, body: 0.95, tone: 0.85, alpha: 1, edge: 0, chips: [0.05, 2.5], micro: 0.3, microScale: [7, 7, 7], drag: 0.65 },
};
const SPEED = [0.75, 1.3], SPREAD = 0.6, LIFE = [3.6, 4.9];

const vertexShader = /* glsl */ `
  #include <common>
  #include <fog_pars_vertex>
  // the corner of the shape, and its face
  attribute float corner, face;
  attribute vec3 aOrigin, aVel, aDir, aSide, aSpin, aRest;
  // length, width, thickness, how far its tip is off to one side
  attribute vec4 aShape;
  // birth, life
  attribute vec2 aLife;
  // how light, and a number of its own
  attribute vec2 aTone;
  uniform float uTime, uDrag, uGravity, uJitter, uSparks;
  uniform vec3 uDir;
  varying vec3 vView, vRest, vLocal;
  varying float vFace, vTone, vAlpha, vSpark;

  vec3 rotate(vec3 v, vec3 axis, float a) {
    float c = cos(a), s = sin(a);
    return v * c + cross(axis, v) * s + axis * dot(axis, v) * (1.0 - c);
  }
  vec3 hash3(float n) { return fract(sin(vec3(n, n + 1.7, n + 3.1)) * vec3(43758.5453, 22578.1459, 19642.349)); }

  void main() {
    // a spark: a few tenths of a second, thrown faster, hardly held back
    float spark = step(aTone.y, uSparks);
    float t = uTime - aLife.x, life = mix(aLife.y, 0.25 + 0.5 * aTone.y / max(uSparks, 1e-3), spark);
    if (t < 0.0 || t > life) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }

    // flung off with the pieces, falling with them, a little slowed by the
    // air: v' = g - k v
    float k = mix(uDrag, 0.15, spark), e = exp(-k * t);
    vec3 vt = vec3(0.0, -uGravity, 0.0) / k;
    vec3 vel = aVel * (1.0 + 1.5 * spark);
    vec3 center = aOrigin + (vel - vt) * (1.0 - e) / k + vt * t;

    // its own shape: the corners moved a little, the tip to one side
    vec3 local = position + uJitter * (hash3(corner * 7.13 + aTone.y * 113.0) - 0.5);
    local.y += aShape.w * local.x;
    // sparks: thin bright streaks along their way
    vec3 s = local * mix(aShape.xyz, aShape.xxx * vec3(2.5, 0.12, 0.12), spark);
    vLocal = local;
    // where it was in the volume, its pattern: lying along the grain
    vec3 b1 = normalize(cross(uDir, abs(uDir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vRest = aRest + uDir * s.x + b1 * s.y + cross(uDir, b1) * s.z;

    // the shard tumbles
    float spin = length(aSpin);
    vec3 axis = spin > 0.0 ? aSpin / spin : vec3(0.0, 1.0, 0.0);
    vec3 dir = rotate(aDir, axis, spin * t * (1.0 - spark)), side = rotate(aSide, axis, spin * t);
    if (spark > 0.5) {
      vec3 v = vel * exp(-k * t) + vt * (1.0 - exp(-k * t));
      dir = normalize(v);
      side = normalize(cross(dir, abs(dir.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    }
    vec3 p = center + dir * s.x + side * s.y + cross(dir, side) * s.z;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
    vView = mvPosition.xyz;
    vFace = face;
    vTone = aTone.x;
    // in at once, out at the end of the fall
    vAlpha = smoothstep(0.0, 0.03, t) * (1.0 - smoothstep(0.75 * life, life, t));
    // a spark cools as it goes: 1 white hot, 0 gone
    vSpark = spark * (1.0 - t / life);
  }
`;

// the pattern of its material, where it came from; lit face by face
const fragmentShader = (glsl) => /* glsl */ `
  #include <common>
  #include <fog_pars_fragment>
  uniform vec3 uDir, uOff, uC0, uC1, uC2;
  uniform float uStraight;
  uniform vec3 uKeyDir, uKeyColor, uRimDir, uRimColor, uAmbient;
  uniform float uGlint, uShine, uRough, uBody, uOpacity, uEdge, uDeep, uMicro, uMetal;
  uniform vec3 uMicroScale;
  varying vec3 vView, vRest, vLocal;
  varying float vFace, vTone, vAlpha, vSpark;
  #ifdef METAL_ENV
  // the room the volumes mirror, the same: a metal shard mirrors it too
  uniform sampler2D envMap;
  uniform float uEnvIntensity;
  #include <cube_uv_reflection_fragment>
  #endif
  ${noiseGLSL}
  ${glsl}

  // lit by L, its color taking the light, a flash when the face turns to it
  vec3 facet(vec3 N, vec3 V, vec3 L, vec3 base, float body, float wrap, float gloss) {
    float diffuse = max((dot(N, L) + wrap) / (1.0 + wrap), 0.0);
    float shine = mix(uShine, 3.0, gloss);
    float spec = pow(max(dot(N, normalize(L + V)), 0.0), shine) * (1.0 - 0.85 * gloss);
    // a metal's flash is of its own color
    return base * diffuse * body + uGlint * spec * mix(vec3(1.0), base * 1.3, uMetal);
  }

  void main() {
    // the outside of the volume (the glaze), or broken
    float cut = abs(vFace - 1.0) < 0.5 ? 0.0 : 1.0;
    #ifdef SURF_INIT
    surfInit(vRest, cut);
    #endif
    vec3 base = surfColor(vRest, cut) * vTone;
    // its own grain, finer than the pattern
    base *= 1.0 + uMicro * snoise(vLocal * uMicroScale);
    float rough = clamp(surfRough(vRest, cut, uRough), 0.03, 1.0);
    // through its edges glass shows its tint, deep
    float edge = uEdge * step(1.5, vFace);
    base = mix(base, pow(base, vec3(4.0)), edge);
    float body = mix(uBody, 1.0, edge);
    // ice, thick, takes its deep color
    base *= mix(vec3(1.0), uC2, uDeep);

    // its faces, flat, sharp
    vec3 N = normalize(cross(dFdx(vView), dFdy(vView)));
    vec3 V = normalize(-vView);
    vec3 L = normalize((viewMatrix * vec4(uKeyDir, 0.0)).xyz);
    vec3 R = normalize((viewMatrix * vec4(uRimDir, 0.0)).xyz);
    // what is seen through takes the light around a little
    float wrap = uOpacity < 1.0 ? 0.5 : 0.1;
    vec3 color = base * uAmbient + uKeyColor * facet(N, V, L, base, body, wrap, rough) + 0.6 * uRimColor * facet(N, V, R, base, body, wrap, rough);
    // the polished ones mirror the room a little, more at a glance
    float fresnel = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    color += uAmbient * fresnel * (1.0 - rough) * 0.8 * (1.0 - uMetal);
    #ifdef METAL_ENV
    // a metal: what it mirrors is all there is of it, the room as the pieces
    // mirror it, blurred by its roughness, in its color (white at a glance).
    // Each flat face, as it turns, goes from the dark floor to the window
    // and back: the glitter of the metal
    vec3 Rw = normalize((vec4(reflect(-V, N), 0.0) * viewMatrix).xyz);
    float nv = max(dot(N, V), 0.0);
    vec3 F = base + (1.0 - base) * pow(1.0 - nv, 5.0);
    vec3 env = textureCubeUV(envMap, Rw, rough).rgb * uEnvIntensity;
    color = mix(color, F * env + (color - base * uAmbient) * 0.6, uMetal);
    #endif
    // a spark: a pale glint, barely warm, that fades into the color of the
    // steel as it goes (no orange: it stays with the material)
    if (vSpark > 0.0) {
      vec3 glint = mix(vec3(1.0, 0.96, 0.9), vec3(1.0), smoothstep(0.6, 1.0, vSpark));
      color = mix(uC0 * 0.9, glint * mix(1.0, 2.2, vSpark), smoothstep(0.0, 0.5, vSpark));
    }
    gl_FragColor = vec4(color, vAlpha * mix(uOpacity, 1.0, edge));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// the lights, shared by all
export const particleLights = {
  uKeyDir: { value: new THREE.Vector3() },
  uKeyColor: { value: new THREE.Color() },
  uRimDir: { value: new THREE.Vector3() },
  uRimColor: { value: new THREE.Color() },
  uAmbient: { value: new THREE.Color() },
};

// the debris of one volume, in the frame of its fall, under the same gravity
// as its pieces. colors are the uniforms of the volume's material: a change of
// style recolors them too
export class Particles extends THREE.Mesh {
  constructor(kind, colors, pieces, gravity) {
    const k = KINDS[kind] ?? KINDS.marble;
    // a little more than needed, the counts vary
    const capacity = Math.ceil(k.count * 1.6) + pieces * 4;
    const geometry = new THREE.InstancedBufferGeometry();
    const shape = shapeGeometry(SHAPES[k.shape]);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(shape.position, 3));
    geometry.setAttribute('corner', new THREE.Float32BufferAttribute(shape.corner, 1));
    geometry.setAttribute('face', new THREE.Float32BufferAttribute(shape.face, 1));
    const attr = (name, size) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * size), size);
      geometry.setAttribute(name, a);
      return a;
    };
    const attrs = { aOrigin: attr('aOrigin', 3), aVel: attr('aVel', 3), aDir: attr('aDir', 3), aSide: attr('aSide', 3), aSpin: attr('aSpin', 3), aRest: attr('aRest', 3), aShape: attr('aShape', 4), aLife: attr('aLife', 2), aTone: attr('aTone', 2) };
    geometry.instanceCount = 0;
    const opaque = k.alpha >= 1;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
        ...particleLights,
        uTime: { value: 0 },
        uDrag: { value: k.drag },
        uGravity: { value: gravity },
        uJitter: { value: k.jitter },
        uGlint: { value: k.glint },
        uShine: { value: k.shine },
        uRough: { value: k.rough },
        uBody: { value: k.body },
        uOpacity: { value: k.alpha },
        uEdge: { value: k.edge },
        uDeep: { value: k.deep ?? 0 },
        uMicro: { value: k.micro },
        uMetal: { value: k.metal ?? 0 },
        uSparks: { value: k.sparks ?? 0 },
        uMicroScale: { value: new THREE.Vector3(...k.microScale) },
        // the volume's own: its pattern, its colors (a change of style
        // recolors the debris too)
        uDir: colors.uDir,
        uOff: colors.uOff,
        uC0: colors.uC0,
        uC1: colors.uC1,
        uC2: colors.uC2,
        uStraight: colors.uStraight,
        ...particleEnv,
      },
      vertexShader,
      fragmentShader: fragmentShader(materialGLSL(kind)),
      defines: k.metal ? envDefines(particleEnv.envMap.value) : {},
      transparent: true,
      // solid, the opaque ones hide each other
      depthWrite: opaque,
      fog: true,
    });
    super(geometry, material);
    this.frustumCulled = false;
    this.kind = k;
    this.attrs = attrs;
    this.capacity = capacity;
    this.perPiece = k.count / Math.max(pieces, 1);
    this.grain = colors.uDir.value;
  }

  // the shards that come off a piece as it leaves, from its crack faces, at
  // the time `time` of the fall. The piece is in the same frame.
  emit(mesh, time) {
    const k = this.kind;
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position'), rest = geo.getAttribute('rest'), cut = geo.getAttribute('cut');
    // the triangles of the cracks
    const tris = [];
    for (let i = 0; i < cut.count; i += 3) if (cut.getX(i) > 0.5) tris.push(i);
    if (!tris.length) return;
    mesh.updateMatrix();
    const v0 = mesh.userData.v;
    const n = Math.round(this.perPiece * range(0.5, 1.5));
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3(), r = new THREE.Vector3();
    const out = new THREE.Vector3(), v = new THREE.Vector3(), d = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Vector3();
    // the grain, as the piece lies now
    const grain = this.grain.clone().transformDirection(mesh.matrix);
    const { aOrigin, aVel, aDir, aSide, aSpin, aRest, aShape, aLife, aTone } = this.attrs;
    const geometry = this.geometry;
    const at3 = (attr, i, out, u, w) => {
      a.fromBufferAttribute(attr, i);
      b.fromBufferAttribute(attr, i + 1).sub(a);
      c.fromBufferAttribute(attr, i + 2).sub(a);
      return out.copy(a).addScaledVector(b, u).addScaledVector(c, w);
    };
    for (let j = 0; j < n && geometry.instanceCount < this.capacity; j++) {
      const i = tris[Math.floor(rand() * tris.length)];
      let u = rand(), w = rand();
      if (u + w > 1) (u = 1 - u), (w = 1 - w);
      at3(rest, i, r, u, w);
      at3(pos, i, p, u, w).applyMatrix4(mesh.matrix);
      // along with its piece, a little off it, away from the face it comes off
      out.copy(b).cross(c).transformDirection(mesh.matrix);
      if (out.dot(p.clone().sub(mesh.position)) < 0) out.negate();
      v.copy(v0).multiplyScalar(range(...SPEED))
        .addScaledVector(out, range(0, SPREAD))
        .add(s.randomDirection().multiplyScalar(SPREAD * 0.5 * rand()));
      // a splinter lies along the grain of its piece; the others any way
      if (k.along) d.copy(grain).addScaledVector(s.randomDirection(), 0.15).normalize();
      else d.randomDirection();
      // a direction square to it, for its width
      e.randomDirection().cross(d).normalize();
      // the bigger the slower it turns
      let len = k.length[0] + (k.length[1] - k.length[0]) * rand() ** 2;
      if (k.chips && rand() < k.chips[0]) len *= k.chips[1];
      s.randomDirection().multiplyScalar(range(2, 12) * Math.sqrt(k.length[0] / len) * 1.6);
      const at = geometry.instanceCount++;
      aOrigin.setXYZ(at, p.x, p.y, p.z);
      aVel.setXYZ(at, v.x, v.y, v.z);
      aDir.setXYZ(at, d.x, d.y, d.z);
      aSide.setXYZ(at, e.x, e.y, e.z);
      aSpin.setXYZ(at, s.x, s.y, s.z);
      aRest.setXYZ(at, r.x, r.y, r.z);
      // small, most of them, a few bigger; the tip off to one side
      const width = len * range(...k.width);
      aShape.setXYZW(at, len, width, len * range(...k.thick), range(-0.4, 0.4) * (k.shape === 'flake' ? 1 : 0.3));
      aLife.setXY(at, time + range(0, 0.04), range(...LIFE));
      aTone.setXY(at, k.tone * range(0.85, 1.1), rand());
    }
    for (const attr of Object.values(this.attrs)) attr.needsUpdate = true;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// the room, as the volumes mirror it (scene.environment, a PMREM texture), for
// the metals; the defines are those three.js gives its own materials for it
export const particleEnv = { envMap: { value: null }, uEnvIntensity: { value: 1 } };
// The room may come after the first debris (?t= fast-forwards before the
// style is set): its size is then PMREMGenerator.fromScene's, 4 × 256 high
function envDefines(texture) {
  const height = texture?.image.height ?? 4 * 256;
  const maxMip = Math.log2(height) - 2;
  return {
    METAL_ENV: '',
    ENVMAP_TYPE_CUBE_UV: '',
    CUBEUV_TEXEL_WIDTH: 1 / (3 * Math.max(2 ** maxMip, 7 * 16)),
    CUBEUV_TEXEL_HEIGHT: 1 / height,
    CUBEUV_MAX_MIP: `${maxMip}.0`,
  };
}
export function updateParticleEnvironment(texture, intensity) {
  particleEnv.envMap.value = texture;
  particleEnv.uEnvIntensity.value = intensity;
}

// the lights, from main.js
export function updateParticleLights({ keyDir, keyColor, keyIntensity, rimDir, rimColor, rimIntensity, ambient }) {
  const l = particleLights;
  l.uKeyDir.value.copy(keyDir);
  l.uKeyColor.value.copy(keyColor).multiplyScalar(keyIntensity);
  l.uRimDir.value.copy(rimDir);
  l.uRimColor.value.copy(rimColor).multiplyScalar(rimIntensity);
  l.uAmbient.value.copy(ambient);
}

