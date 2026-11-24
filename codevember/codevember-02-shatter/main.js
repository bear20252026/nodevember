import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { fracture, solidGeometry, shapeLens, shellShape, HOLLOW, SHAPE_COUNT } from './fracture.js';
import { volumeMaterial, MATERIAL_NAMES, TRANSPARENT_NAMES, OPAQUE_NAMES } from './materials.js';
import { STYLE } from './styles.js';
import { Particles, updateParticleLights, updateParticleEnvironment } from './particles.js';
import { untonemap } from './tonemap.js';

const params = new URLSearchParams(location.search);

// ?seed=n makes the sequence reproducible
if (params.has('seed')) {
  let seed = parseInt(params.get('seed')) >>> 0;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the look (see styles.js)
const style = STYLE;

// antialiased in its own render target, see below
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
// receding pieces sink into the paper
scene.fog = new THREE.Fog();

// the light the volumes reflect: a quiet room around them. A tall window up
// on the left, where the sun comes from, its frame faint; a strip of light
// behind on the right, for the outlines; a pale ceiling, walls a little darker,
// the warm paper floor bouncing the light back up. Its directions are those of
// the lights below. Its colors are the style's.
const KEY_DIR = new THREE.Vector3();
const RIM_DIR = new THREE.Vector3();

function roomEnvironment() {
  const env = new THREE.Scene();
  // a studio over the room: a softbox overhead, a strip on the left behind,
  // and the walls around dimmed (flags), for clean highlights with some
  // contrast to them. By default the softbox is a share of the window.
  const studio = { softbox: style.room.window.map((x) => x * 0.8), kicker: style.room.strip.map((x) => x * 0.5), flag: [0.85, 0, 0], ...style.room };
  const room = Object.fromEntries(Object.entries(studio).map(([k, v]) => ['u' + k[0].toUpperCase() + k.slice(1), { value: new THREE.Vector3(...v) }]));
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 128, 64), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uKey: { value: KEY_DIR }, uRim: { value: RIM_DIR }, ...room },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uKey, uRim, uFloor, uWall, uCeiling, uSun, uWindow, uGlow, uStrip, uPanel, uSoftbox, uKicker, uFlag;
      varying vec3 vDir;
      // where d meets a panel facing the center, in the panel's own frame
      vec2 onPanel(vec3 d, vec3 c) {
        vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), c));
        vec3 u = cross(c, r);
        return vec2(dot(d, r), dot(d, u)) / max(dot(d, c), 1e-3);
      }
      float rect(vec2 q, vec2 size, float soft) {
        vec2 e = smoothstep(size, size - soft, abs(q));
        return e.x * e.y;
      }
      void main() {
        vec3 d = normalize(vDir);
        // the room: floor, walls, ceiling
        vec3 c = mix(uFloor, uWall, smoothstep(-0.25, 0.05, d.y));
        c = mix(c, uCeiling, smoothstep(0.35, 0.8, d.y));
        // the flags: the walls dimmer around the horizon, away from the lights
        c *= 1.0 - uFlag.x * (1.0 - smoothstep(0.05, 0.45, abs(d.y + 0.08)));
        // the floor brighter where the sun lands on it
        c += uSun * smoothstep(0.2, 0.9, dot(d, normalize(vec3(0.4, -0.8, -0.2))));
        // the window, its mullions, and the glow around it
        if (dot(d, uKey) > 0.0) {
          vec2 q = onPanel(d, uKey);
          float w = rect(q, vec2(0.34, 0.5), 0.04);
          float bars = 1.0 - 0.75 * (1.0 - smoothstep(0.0, 0.012, abs(q.x))) - 0.75 * (1.0 - smoothstep(0.0, 0.012, abs(q.y - 0.08)));
          c += w * bars * uWindow * (0.85 + 0.15 * smoothstep(-0.5, 0.5, q.y));
          c += uGlow * exp(-6.0 * (1.0 - dot(d, uKey)));
        }
        // the softbox overhead, a little to the front: brighter in its
        // middle, its edges clean
        vec3 sb = normalize(vec3(-0.25, 1.0, 0.45));
        if (dot(d, sb) > 0.0) {
          vec2 q = onPanel(d, sb);
          c += rect(q, vec2(0.7, 0.42), 0.06) * uSoftbox * (0.7 + 0.3 * exp(-2.5 * dot(q, q)));
        }
        // a tall thin strip on the left behind, for the outlines on that side
        vec3 kk = normalize(vec3(-0.9, 0.25, -0.5));
        if (dot(d, kk) > 0.0) c += rect(onPanel(d, kk), vec2(0.05, 0.75), 0.03) * uKicker;
        // the strip behind
        if (dot(d, uRim) > 0.0) c += rect(onPanel(d, uRim), vec2(0.09, 0.6), 0.05) * uStrip;
        // a dim panel on the right, in front: a second, smaller window
        vec3 f = normalize(vec3(0.85, 0.2, 0.5));
        if (dot(d, f) > 0.0) c += rect(onPanel(d, f), vec2(0.3, 0.22), 0.12) * uPanel;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  return env;
}
const pmrem = new THREE.PMREMGenerator(renderer);

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 1, 5.2);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;

// the sun through the window models the volumes, its shadows soft; a cool
// light from behind draws their outlines
const key = new THREE.DirectionalLight();
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.01;
const shadowCam = key.shadow.camera;
shadowCam.left = shadowCam.bottom = -1.6;
shadowCam.right = shadowCam.top = 1.6;
shadowCam.near = 2;
shadowCam.far = 14;
const rim = new THREE.DirectionalLight();
const hemi = new THREE.HemisphereLight();
scene.add(key, rim, hemi);

// ---- the volumes ------------------------------------------------------------
// The world is scaled to zoom into the core of each volume: the next volume
// waits there, at the scale NEXT, inside the hollow of the fragments. Once it
// fills the screen the world is scaled back, the next volume at scale 1.

const NEXT = HOLLOW * 0.9;
const world = new THREE.Group();
scene.add(world);

// ?material=wood shows only that one
const onlyMaterial = MATERIAL_NAMES.includes(params.get('material')) ? params.get('material') : null;

// the whole sequence turns as one, on a single axis at a steady pace: each
// volume keeps the turn of the one it was nested in, without a jolt
const SPIN = new THREE.Vector3(0, 1, 0)
  .applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.randFloat(0.2, 0.5))
  .applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * Math.PI * 2)
  .multiplyScalar(0.22);

// how many of the volumes are hollow: half of them (&hollow: all of them)
const HOLLOW_SHARE = params.has('hollow') ? 1 : 0.5;

let lastShape = -1;
// the volumes alternate, seen through and not; the last material of each kind
let transparent = Math.random() < 0.5;
const lastMaterial = { [true]: -1, [false]: -1 };
// the materials alive, to restyle them
const looks = new Set();
const pickOther = (n, last) => {
  const i = Math.floor(Math.random() * (n - 1));
  return i >= last && last >= 0 ? i + 1 : i;
};

function makeVolume() {
  lastShape = pickOther(SHAPE_COUNT, lastShape);
  transparent = !transparent;
  const names = transparent ? TRANSPARENT_NAMES : OPAQUE_NAMES;
  lastMaterial[transparent] = pickOther(names.length, lastMaterial[transparent]);
  const kind = onlyMaterial ?? names[lastMaterial[transparent]];
  const { material, uniforms, shadow, restyle } = volumeMaterial(kind, style);
  // some are hollow: shells, their wall a little thick. Seen through, the
  // glass shows the hollow inside (see materials.js)
  const wall = Math.random() < HOLLOW_SHARE ? THREE.MathUtils.randFloat(0.035, 0.06) : 0;
  if (wall) {
    const inside = shellShape(lastShape, wall);
    uniforms.uShell.value = inside.kind;
    inside.planes.forEach((q, i) => uniforms.uShellPlanes.value[i].copy(q));
    uniforms.uShellCount.value = inside.planes.length;
    uniforms.uShellOuter.value.set(inside.outer);
    uniforms.uShellSize.value.copy(inside.size);
    uniforms.uShellWall.value = inside.wall;
  }
  // the cylinder's side refracts as a ball: not the shell's, curved inside too
  uniforms.uLens.value = shapeLens(lastShape) && !wall ? 1 : 0;
  looks.add(restyle);
  const group = new THREE.Group();
  // whole, until it breaks
  // most have sharp edges, the others softly rounded
  const round = Math.random() < 0.35;
  const solid = new THREE.Mesh(solidGeometry(lastShape, round, wall), material);
  solid.castShadow = shadow;
  solid.receiveShadow = true;
  group.add(solid);
  // seen through or not: with ?material= it is that material's own
  return { group, solid, shape: lastShape, round, wall, fragments: [], material, uniforms, shadow, restyle, kind, transparent: TRANSPARENT_NAMES.includes(kind) };
}

// it breaks where the camera sees it, more or less: the pieces are smaller there
function breakVolume(volume) {
  const { group, material, shadow } = volume;
  const impact = new THREE.Vector3(THREE.MathUtils.randFloatSpread(1.2), THREE.MathUtils.randFloatSpread(1), 0)
    .add(camera.position.clone().normalize().multiplyScalar(2));
  group.updateMatrixWorld();
  volume.impact = group.worldToLocal(group.parent.localToWorld(new THREE.Vector3()).add(impact)).normalize();
  // the splinters of wood fan out from the middle of the volume as the camera
  // sees it, not from the impact, a little aside
  const view = group.worldToLocal(camera.position.clone()).normalize();
  volume.uniforms.uAxis.value.copy(view);
  // each material breaks its own way, along its grain, its beds...
  volume.fragments = fracture(volume.shape, volume.impact, volume.kind, volume.uniforms.uDir.value, volume.round, view, volume.wall).map((cell) => {
    const mesh = new THREE.Mesh(cell.geometry, material);
    mesh.position.copy(cell.center);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.userData = { home: cell.center.clone(), volume: cell.volume };
    group.add(mesh);
    return mesh;
  });
  volume.uniforms.uShellWhole.value = 0;
  group.remove(volume.solid);
  volume.solid.geometry.dispose();
}

// ---- debris -----------------------------------------------------------------
// no physics: each fragment flies off the center, spinning, and falls. Each
// shatter has its own group, the frame of its fall.

const GRAVITY = 6;
const debris = [];

function release(volume, mesh, burst) {
  const fall = volume.fall;
  const dir = mesh.getWorldPosition(new THREE.Vector3()).sub(volume.group.getWorldPosition(new THREE.Vector3()));
  fall.group.attach(mesh);
  dir.normalize();
  // the small pieces fly farther and spin faster
  const small = THREE.MathUtils.clamp(0.02 / Math.max(mesh.userData.volume, 1e-4), 0.5, 2.5);
  const speed = burst * THREE.MathUtils.randFloat(0.7, 1.3) * Math.sqrt(small);
  mesh.userData.v = dir.multiplyScalar(speed).add(new THREE.Vector3(0, THREE.MathUtils.randFloat(0.4, 1.2), 0));
  // they keep the turn of the volume, and tumble on top of it
  mesh.userData.w = new THREE.Vector3().randomDirection().multiplyScalar(THREE.MathUtils.randFloat(1, 4) * Math.sqrt(small)).add(SPIN);
  fall.pieces.push(mesh);
  // the slivers, the grit, that come off its cracks
  fall.particles.emit(mesh, fall.age);
}

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
function stepDebris(dt) {
  for (let i = debris.length - 1; i >= 0; i--) {
    const fall = debris[i];
    fall.age += dt;
    fall.particles.material.uniforms.uTime.value = fall.age;
    for (const m of fall.pieces) {
      m.userData.v.y -= GRAVITY * dt;
      m.position.addScaledVector(m.userData.v, dt);
      const w = m.userData.w;
      _q.setFromAxisAngle(_v.copy(w).normalize(), w.length() * dt);
      m.quaternion.premultiply(_q);
    }
    if (fall.age > 5) {
      world.remove(fall.group);
      // the geometries are the volume's own, gone with it
      for (const m of fall.pieces) m.geometry.dispose();
      fall.material.dispose();
      fall.particles.dispose();
      looks.delete(fall.restyle);
      debris.splice(i, 1);
    }
  }
}

// ---- timeline ---------------------------------------------------------------

// the volumes nested in the current one, each in the core of the one before,
// aligned with it so that they turn with it. The next one is always there,
// ready for the break; deeper ones only behind glass, where they are seen: as
// soon as a transparent volume shows, its own next volume is in it.
const nested = [];
function nest() {
  if (nested.length && !nested.at(-1).transparent) return;
  const parent = nested.at(-1) ?? current;
  const v = makeVolume();
  v.group.scale.setScalar(NEXT);
  parent.group.add(v.group);
  nested.push(v);
  // past a few levels, too small to be seen
  if (nested.length < 5) nest();
}

let current = makeVolume();
current.group.quaternion.random();
world.add(current.group);
nest();

const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// a damped spring from 0 to 1
const spring = (x, f = 4, d = 1.4) => (x <= 0 ? 0 : 1 - Math.exp(-d * 4 * x) * Math.cos(f * Math.PI * x));

const ZOOM = 1 / NEXT;

const cycle = [
  // this one turns, the next one already in its core
  { dur: 0.5 },
  // it bursts, from the impact outward, while the camera dives to the core
  {
    dur: 2.2,
    start: () => {
      breakVolume(current);
      const group = new THREE.Group();
      world.add(group);
      const particles = new Particles(current.kind, current.uniforms, current.fragments.length, GRAVITY);
      group.add(particles);
      current.fall = { group, pieces: [], particles, age: 0, material: current.material, uniforms: current.uniforms, restyle: current.restyle };
      debris.push(current.fall);
    },
    update: (x, t) => {
      for (const m of current.fragments) {
        if (m.parent !== current.group) continue;
        if (t > m.userData.home.distanceTo(current.impact) * 0.09) release(current, m, 1);
      }
      world.scale.setScalar(THREE.MathUtils.lerp(1, ZOOM, easeInOut(THREE.MathUtils.clamp((x - 0.08) / 0.92, 0, 1))));
    },
    end: () => {
      // the next volume becomes the one: the world back to scale 1
      const next = nested.shift();
      world.attach(next.group);
      world.remove(current.group);
      const s = world.scale.x;
      world.scale.setScalar(1);
      for (const c of world.children) {
        c.position.multiplyScalar(s);
        c.scale.multiplyScalar(s);
      }
      current = next;
      nest();
    },
  },
];

// the very first volume grows from nothing, the next one with it
let timeline = [
  { dur: 0.6, update: (x) => current.group.scale.setScalar(Math.max(spring(x, 1.6, 1.5), 1e-3)) },
  { dur: 0.3 },
  ...cycle.slice(1),
];
let phase = -1, phaseTime = 0;

function nextPhase() {
  phase++;
  if (phase >= timeline.length) {
    timeline = cycle;
    phase = 0;
  }
  phaseTime = 0;
  timeline[phase].start?.();
}
nextPhase();

// ---- loop -------------------------------------------------------------------

const clock = new THREE.Clock();

// only the outer volume turns, in the world; the nested one turns with it
function turn(volume, dt) {
  _q.setFromAxisAngle(_v.copy(SPIN).normalize(), SPIN.length() * dt);
  volume.group.quaternion.premultiply(_q);
}

function step(dt) {
  phaseTime += dt;
  const p = timeline[phase];
  p.update?.(Math.min(phaseTime / p.dur, 1), phaseTime);
  if (phaseTime >= p.dur) {
    p.end?.();
    nextPhase();
  }
  turn(current, dt);
  stepDebris(dt);

  // the size of the volumes, for their bumps
  const s = world.scale.x;
  current.uniforms.uScale.value = s * current.group.scale.x;
  let scale = s * current.group.scale.x;
  for (const v of nested) v.uniforms.uScale.value = scale *= v.group.scale.x;
  for (const fall of debris) if (fall.pieces.length) fall.uniforms.uScale.value = s * fall.group.scale.x * fall.pieces[0].scale.x;
  controls.update();
}

// ?t=seconds fast-forwards the animation, &still stops it there
const still = params.has('still');
const skip = parseFloat(params.get('t'));
if (skip > 0) for (let t = 0; t < skip; t += 1 / 30) step(1 / 30);

// ---- rendering --------------------------------------------------------------
// The scene is rendered in linear light, antialiased, then: the brightest
// highlights, the glints on the glass, the sun on a facet, bloom a little, as
// through a good lens; the whole is tone mapped; over all, a light vignette
// and a fine grain, last, on the final colors.
// Behind, the paper: light in the middle, a little darker around.

const aspect = { value: innerWidth / innerHeight };
const background = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { uCenter: { value: new THREE.Color() }, uEdge: { value: new THREE.Color() }, uAspect: aspect },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uCenter, uEdge;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      float r = length((vUv - vec2(0.5, 0.55)) * vec2(uAspect, 1.0));
      gl_FragColor = vec4(mix(uCenter, uEdge, smoothstep(0.1, 1.1, r)), 1.0);
    }`,
  depthTest: false,
  depthWrite: false,
}));
background.frustumCulled = false;
background.renderOrder = -1;
scene.add(background);

// A few passes, kept lean: the scene in full, multisampled where the screen
// is not sharp enough on its own; its brightest points, a quarter of the size,
// blurred once there and once at an eighth; then a single pass on the screen
// that adds them, tone maps, and lays the vignette and grain.

const hdr = { type: THREE.HalfFloatType, depthBuffer: false };
const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
const glow = [0, 1, 2, 3].map(() => new THREE.WebGLRenderTarget(1, 1, hdr));
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
quad.frustumCulled = false;
const quadCamera = new THREE.OrthographicCamera();
const passVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;
const pass = (fragmentShader, uniforms, defines) =>
  new THREE.ShaderMaterial({ uniforms, defines, vertexShader: passVertex, fragmentShader, depthTest: false, depthWrite: false });
function drawPass(material, target) {
  quad.material = material;
  renderer.setRenderTarget(target);
  renderer.render(quad, quadCamera);
}

// the light above the threshold, each of the 4 taps on its own, so that a
// glint of a pixel or two keeps its share, averaged down
const brightPass = pass(/* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  uniform float uThreshold;
  varying vec2 vUv;
  vec3 over(vec2 uv) { vec3 c = texture2D(tMap, uv).rgb; return max(c - uThreshold, 0.0); }
  void main() {
    vec2 d = uTexel;
    gl_FragColor = vec4(0.25 * (over(vUv + vec2(-d.x, -d.y)) + over(vUv + vec2(d.x, -d.y)) + over(vUv + vec2(-d.x, d.y)) + over(vUv + d)), 1.0);
  }`, { tMap: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 } });
// a gaussian of 9 taps, in 5 bilinear reads, along uDir
const blurPass = pass(/* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tMap, vUv).rgb * 0.2270270;
    vec2 o1 = uDir * 1.3846154, o2 = uDir * 3.2307692;
    c += (texture2D(tMap, vUv + o1).rgb + texture2D(tMap, vUv - o1).rgb) * 0.3162162;
    c += (texture2D(tMap, vUv + o2).rgb + texture2D(tMap, vUv - o2).rgb) * 0.0702703;
    gl_FragColor = vec4(c, 1.0);
  }`, { tMap: { value: null }, uDir: { value: new THREE.Vector2() } });
const finish = pass(/* glsl */ `
  #include <tonemapping_pars_fragment>
  uniform sampler2D tScene, tGlow, tGlowWide;
  uniform float uAspect, uTime, uVignette, uGrain, uStrength, uWide;
  varying vec2 vUv;
  float hash(vec2 p) {
    vec3 q = fract(vec3(p.xyx) * 0.1031);
    q += dot(q, q.yzx + 33.33);
    return fract((q.x + q.y) * q.z);
  }
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    c += uStrength * (texture2D(tGlow, vUv).rgb + uWide * texture2D(tGlowWide, vUv).rgb);
    #ifdef AGX
      c = AgXToneMapping(c);
    #else
      c = NeutralToneMapping(c);
    #endif
    c = sRGBTransferOETF(vec4(c, 1.0)).rgb;
    float r = length((vUv - 0.5) * vec2(uAspect, 1.0));
    float vignette = uVignette * smoothstep(0.55, 1.1, r);
    float g = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 1e3) - 0.5) * uGrain;
    gl_FragColor = vec4(c * (1.0 - vignette - max(-g, 0.0)) + max(g, 0.0), 1.0);
  }`, {
  tScene: { value: sceneTarget.texture }, tGlow: { value: glow[0].texture }, tGlowWide: { value: glow[2].texture },
  uAspect: aspect, uTime: { value: 0 }, uVignette: { value: 0 }, uGrain: { value: 0 }, uStrength: { value: 0.15 }, uWide: { value: 0.25 },
  toneMappingExposure: { value: 1 },
});

function render() {
  renderer.setRenderTarget(sceneTarget);
  renderer.render(scene, camera);
  if (finish.uniforms.uStrength.value > 0) {
    // the bright points at a quarter, blurred; then at an eighth, blurred
    const [a, b, c, d] = glow;
    brightPass.uniforms.tMap.value = sceneTarget.texture;
    brightPass.uniforms.uTexel.value.set(1 / sceneTarget.width, 1 / sceneTarget.height);
    drawPass(brightPass, a);
    const blur = (src, tmp) => {
      blurPass.uniforms.tMap.value = src.texture;
      blurPass.uniforms.uDir.value.set(1 / src.width, 0);
      drawPass(blurPass, tmp);
      blurPass.uniforms.tMap.value = tmp.texture;
      blurPass.uniforms.uDir.value.set(0, 1 / src.height);
      drawPass(blurPass, src);
    };
    blur(a, b);
    blurPass.uniforms.tMap.value = a.texture;
    blurPass.uniforms.uDir.value.set(0, 0);
    drawPass(blurPass, c);
    blur(c, d);
  }
  drawPass(finish, null);
}

// ---- the look -----------------------------------------------------------------

function applyStyle() {
  finish.defines = style.toneMapping === 'agx' ? { AGX: '' } : {};
  finish.needsUpdate = true;
  finish.uniforms.toneMappingExposure.value = style.exposure;
  // the paper, and the fog the pieces sink into, of the colors that come out
  // of the tone mapping as the style's own (its middle and edge are shades
  // of it, worked out on its sRGB color)
  const bg = new THREE.Color(style.bg);
  const shade = (k) => untonemap(new THREE.Color().setRGB(...bg.clone().convertLinearToSRGB().toArray().map((v, i) => v * k[i])).convertSRGBToLinear(), style.toneMapping, style.exposure);
  scene.fog.color.copy(untonemap(bg, style.toneMapping, style.exposure));
  [scene.fog.near, scene.fog.far] = style.fog;
  document.body.style.background = style.bg;
  const bu = background.material.uniforms;
  bu.uCenter.value.copy(shade([style.center, style.center, style.center]));
  bu.uEdge.value.copy(shade(style.edge));
  finish.uniforms.uVignette.value = style.vignette;
  finish.uniforms.uGrain.value = style.grain;
  // the glow: how strong, how much of the wider one, above what light
  [finish.uniforms.uStrength.value, finish.uniforms.uWide.value, brightPass.uniforms.uThreshold.value] = style.bloom ?? [0.15, 0.25, 1.4];

  // the lights, and the room that goes with them
  const light = (l, [color, intensity, dir], d) => {
    l.color.set(color);
    l.intensity = intensity;
    d.set(...dir).normalize();
    l.position.copy(d).multiplyScalar(8);
  };
  light(key, style.key, KEY_DIR);
  light(rim, style.rim, RIM_DIR);
  hemi.color.set(style.hemi[0]);
  hemi.groundColor.set(style.hemi[1]);
  hemi.intensity = style.hemi[2];
  key.shadow.radius = style.softness;
  // the particles are lit by hand: the same sun and outline, the room around
  const ambient = new THREE.Color(...style.room.ceiling).multiplyScalar(style.envIntensity)
    .add(new THREE.Color().lerpColors(hemi.color, hemi.groundColor, 0.5).multiplyScalar(hemi.intensity));
  updateParticleLights({ keyDir: KEY_DIR, keyColor: key.color, keyIntensity: key.intensity, rimDir: RIM_DIR, rimColor: rim.color, rimIntensity: rim.intensity, ambient });
  const env = roomEnvironment();
  scene.environment?.dispose();
  scene.environment = pmrem.fromScene(env, 0.015).texture;
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  scene.environmentIntensity = style.envIntensity;
  updateParticleEnvironment(scene.environment, style.envIntensity);

  // the volumes there are, and those to come
  for (const restyle of looks) restyle(style);
}

applyStyle();

function setSize() {
  camera.aspect = aspect.value = innerWidth / innerHeight;
  // the volume fits on narrow screens too
  camera.fov = camera.aspect < 1 ? 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(17.5)) / camera.aspect)) : 35;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const pr = renderer.getPixelRatio();
  const w = Math.round(innerWidth * pr), h = Math.round(innerHeight * pr);
  sceneTarget.setSize(w, h);
  // a sharp screen hides the steps of the edges on its own: fewer samples
  const samples = pr >= 1.5 ? 2 : 4;
  if (sceneTarget.samples !== samples) {
    sceneTarget.samples = samples;
    sceneTarget.dispose();
  }
  const [a, b, c, d] = glow;
  a.setSize(Math.ceil(w / 4), Math.ceil(h / 4));
  b.setSize(a.width, a.height);
  c.setSize(Math.ceil(w / 8), Math.ceil(h / 8));
  d.setSize(c.width, c.height);
}
setSize();
addEventListener('resize', setSize);

renderer.setAnimationLoop(() => {
  step(still ? 0 : Math.min(clock.getDelta(), 1 / 20));
  finish.uniforms.uTime.value = clock.elapsedTime;
  render();
});
