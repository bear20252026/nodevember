import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { Shape, Fold, spring, easeInOut, foldMaterial } from './fold.js';
import { findVisible } from './cull.js';
import { setSection, capGeometry } from './slice.js';
import { PALETTE } from './palettes.js';
import { patternGLSL } from './pattern.js';

const params = new URLSearchParams(location.search);

// ?seed=n makes the sequence of folds reproducible
if (params.has('seed')) {
  let seed = parseInt(params.get('seed')) >>> 0;
  Math.random = () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
renderer.shadowMap.autoUpdate = false; // once per frame, for the picture only
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 1, 200);
camera.position.set(9, 6, 12);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.6;

const key = new THREE.DirectionalLight('#fff4e8', 2.2);
scene.add(key, new THREE.HemisphereLight('#ffffff', '#d9b9a8', 0.8));

// a light from (almost) straight above, that only casts the shadow on the floor
const shadowLight = new THREE.DirectionalLight('#ffffff', 0);
const SHADOW_DIR = new THREE.Vector3(0.15, 1, 0.1).normalize();
shadowLight.castShadow = true;
shadowLight.shadow.mapSize.set(1024, 1024);
shadowLight.shadow.blurSamples = 16;
scene.add(shadowLight, shadowLight.target);

// a floor that only shows the soft shadow of the shape, just under it
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ color: '#8a5a48', opacity: 0.2, depthWrite: false })
);
ground.receiveShadow = true;
// it fades out around the shape (and never shows the edge of the shadow map)
const groundUniforms = { uCenter: { value: new THREE.Vector3() }, uReach: { value: 1 } };
ground.material.onBeforeCompile = (shader) => {
  Object.assign(shader.uniforms, groundUniforms);
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
    .replace('#include <fog_vertex>', '#include <fog_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;\nuniform vec3 uCenter;\nuniform float uReach;')
    .replace('#include <fog_fragment>', '#include <fog_fragment>\ngl_FragColor.a *= 1.0 - smoothstep(0.6, 1.0, distance(vWorld.xz, uCenter.xz) / uReach);');
};
scene.add(ground);
let floorY = 0; // where the floor should be: the bottom of the shape

// Each half of the slice keeps one side of a plane. Parked far away until slicing.
const planeA = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e5);
const planeB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e5);

// soft candy: the key light wraps a little past the terminator, the light that
// gets there tinted by the gum, as if scattered under its surface
const WRAP_LIGHTING = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  /* glsl */ `
  float wrapNL = saturate( ( dot( geometryNormal, directLight.direction ) + 0.35 ) / 1.35 );
  vec3 tint = material.diffuseColor / max( max( material.diffuseColor.r, max( material.diffuseColor.g, material.diffuseColor.b ) ), 1e-3 );
  vec3 scattered = max( wrapNL - dotNL, 0.0 ) * 0.6 * tint * tint * directLight.color;
  reflectedLight.directDiffuse += ( irradiance + scattered ) * BRDF_Lambert( material.diffuseColor );`
);

// The ambient occlusion is computed first, at half resolution, then each
// material darkens its own pixels by it: no post-processing pass over the
// whole picture.
const aoUniforms = { uAO: { value: null }, uAORes: { value: new THREE.Vector2(1, 1) } };
function withAO(material, key) {
  const patch = material.onBeforeCompile;
  material.customProgramCacheKey = () => key; // the patched shaders differ
  material.onBeforeCompile = (shader, r) => {
    patch?.call(material, shader, r);
    Object.assign(shader.uniforms, aoUniforms);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D uAO;\nuniform vec2 uAORes;')
      .replace(
        '#include <opaque_fragment>',
        'float aoFactor = texture2D(uAO, gl_FragCoord.xy / uAORes).r;\noutgoingLight *= aoFactor;\n#include <opaque_fragment>'
      );
  };
  return material;
}

function gumMaterial(plane) {
  const m = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    sheen: 0.25,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide,
    clippingPlanes: [plane],
    clipShadows: true,
  });
  foldMaterial(m);
  // Buried layers are culled, so the cut shows the inside of the shell: paint
  // those back faces flat, like the cut face of a solid.
  const patch = m.onBeforeCompile;
  m.onBeforeCompile = (shader) => {
    patch(shader);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 rest;\nvarying vec3 vRest;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvRest = rest;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;\n' + patternGLSL)
      .replace('#include <lights_physical_pars_fragment>', WRAP_LIGHTING)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = gumPattern(diffuseColor.rgb, vRest);')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\nif (!gl_FrontFacing) gl_FragColor.rgb = diffuseColor.rgb * 0.92 * aoFactor;'
      );
  };
  return withAO(m, 'gum');
}

// what the ambient occlusion sees: the same folded, clipped surface, as normals
const gumNormalMaterial = (plane) =>
  foldMaterial(new THREE.MeshNormalMaterial({ side: THREE.DoubleSide, clippingPlanes: [plane] }));

const meshA = new THREE.Mesh(undefined, gumMaterial(planeA));
const meshB = new THREE.Mesh(undefined, gumMaterial(planeB));
meshA.userData.normalMaterial = gumNormalMaterial(planeA);
meshB.userData.normalMaterial = gumNormalMaterial(planeB);
meshA.frustumCulled = meshB.frustumCulled = false;
for (const mesh of [meshA, meshB]) {
  mesh.castShadow = true;
  mesh.customDepthMaterial = foldMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }));
}
meshB.visible = false;
const group = new THREE.Group();
group.add(meshA, meshB);
scene.add(group);

const blade = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
);
scene.add(blade);

// ---- timeline -------------------------------------------------------------
// grow a flat grid, fold it FOLDS times (the first fold stretches it into long bars
// along Z and folds them along their length at once), then slice the shape in two and rest. While a fold animates, the
// mesh for the next one is refined in the background (a few ms per frame).

const FOLDS = 7;

let shape, fold, nextFold, planner, plan;
const folds = []; // all the folds so far, to unfold the cut
const center = new THREE.Vector3();
let radius = 3;
const bmin = new THREE.Vector3(), bmax = new THREE.Vector3();
const slice = {
  n: new THREE.Vector3(), d: 0, c: new THREE.Vector3(), t1: new THREE.Vector3(),
  // the opened halves: rotation and offset of each, and how to frame them
  qA: new THREE.Quaternion(), qB: new THREE.Quaternion(), tA: new THREE.Vector3(), tB: new THREE.Vector3(),
  center0: new THREE.Vector3(), radius0: 0, center1: new THREE.Vector3(), radius1: 0,
};

function frame(f) {
  shape.bounds(bmin, bmax, f);
  center.addVectors(bmin, bmax).multiplyScalar(0.5);
  radius = bmin.distanceTo(bmax) / 2;
  floorY = bmin.y;
}

function planNext(prevAxis, opts) {
  nextFold = new Fold(shape.finT, prevAxis, opts);
  planner = shape.plan(nextFold, (p, i) => findVisible(renderer, p, i));
  plan = null;
}

// advance the background refinement
function pump() {
  if (!planner) return;
  const r = planner.next();
  if (r.done) {
    plan = r.value;
    planner = null;
  }
}

function startFold() {
  shape.adopt(plan);
  shape.foldCount++;
  meshA.geometry = meshB.geometry = shape.geometry;
  fold = nextFold;
  folds.push(fold);
  shape.deform(fold, 0, 0);
  if (shape.foldCount < FOLDS) planNext(fold.u);
}

// the cut faces of the slice, filled; each moves with its half. They share
// their colors, each has its own outline (alpha map).
const capMaterial = () => withAO(new THREE.MeshPhysicalMaterial({
  roughness: 0.75,
  sheen: 0.4,
  sheenRoughness: 0.6,
  sheenColor: new THREE.Color('#ffffff'),
  color: new THREE.Color(0.93, 0.93, 0.93),
  alphaTest: 0.02,
  alphaToCoverage: true,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
}), 'cap');
const capA = new THREE.Mesh(undefined, capMaterial());
const capB = new THREE.Mesh(undefined, capMaterial());
capA.frustumCulled = capB.frustumCulled = false;
capA.visible = capB.visible = false;
// the caps are squares cut out by their alpha maps: so are their normals
const capNormalMaterial = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D map;
    varying vec2 vUv;
    varying vec3 vNormal;
    void main() {
      if (texture2D(map, vUv).g < 0.5) discard;
      gl_FragColor = vec4(packNormalToRGB(normalize(vNormal)), 1.0);
    }`,
});
capA.userData.normalMaterial = capNormalMaterial();
capB.userData.normalMaterial = capNormalMaterial();
meshA.add(capA);
meshB.add(capB);

function makeCaps() {
  const { n, c } = slice;
  const h = radius * 1.05;
  const { map, masks } = setSection(renderer, folds, shape, n, c, h);
  for (const [cap, sign, mask] of [[capA, 1, masks[0]], [capB, -1, masks[1]]]) {
    cap.material.map = map;
    cap.material.alphaMap = mask;
    cap.material.needsUpdate = true;
    cap.geometry?.dispose();
    cap.geometry = capGeometry(sign);
    cap.userData.normalMaterial.uniforms.map.value = mask;
    cap.visible = true;
  }
}

// where the halves end up: each swings around the cut like the pages of a book
// until its cut faces the camera, then they sit side by side, a gap between them
function planOpening(view, side) {
  const { n, d, c, qA, qB, tA, tB } = slice;
  const toCam = view.clone().negate();
  qA.setFromUnitVectors(n.clone().negate(), toCam);
  qB.setFromUnitVectors(n, toCam);
  const up = new THREE.Vector3().crossVectors(side, view);
  const gap = radius * 0.3;
  const p = new THREE.Vector3();
  const halves = [[qA, tA, 1, []], [qB, tB, -1, []]];
  const pos = shape.finT;
  const stride = Math.max(1, Math.floor(pos.length / 3 / 8000)) * 3;
  for (let i = 0; i < pos.length; i += stride) {
    p.fromArray(pos, i);
    const h = halves[n.dot(p) >= d ? 0 : 1];
    h[3].push(p.sub(c).applyQuaternion(h[0]).add(c).clone());
  }
  const box = new THREE.Box3();
  for (const [, t, sign, pts] of halves) {
    // the inner edge of the half at gap / 2 from the middle, centered vertically
    let inner = Infinity, lo = Infinity, hi = -Infinity;
    for (const q of pts) {
      inner = Math.min(inner, sign * side.dot(q));
      lo = Math.min(lo, up.dot(q)); hi = Math.max(hi, up.dot(q));
    }
    t.copy(side).multiplyScalar(sign * (gap / 2 + sign * side.dot(c) - inner))
      .addScaledVector(up, up.dot(c) - (lo + hi) / 2);
    for (const q of pts) box.expandByPoint(q.add(t));
  }
  slice.center0.copy(center);
  slice.radius0 = radius;
  box.getCenter(slice.center1);
  slice.floor0 = floorY;
  slice.floor1 = box.min.y;
  slice.radius1 = box.min.distanceTo(box.max) / 2;
}

const I = new THREE.Quaternion();

function placeHalf(mesh, plane, q, t, sign, r, x) {
  const { n, d, c } = slice;
  mesh.quaternion.slerpQuaternions(I, q, r);
  mesh.position.copy(c).sub(c.clone().applyQuaternion(mesh.quaternion)).addScaledVector(t, x);
  mesh.updateMatrix();
  plane.normal.copy(n).multiplyScalar(sign);
  plane.constant = -d * sign;
  plane.applyMatrix4(mesh.matrix);
}

// x: how far apart the halves are, r: how open
function setSlice(x, r) {
  placeHalf(meshA, planeA, slice.qA, slice.tA, 1, r, x);
  placeHalf(meshB, planeB, slice.qB, slice.tB, -1, r, x);
}

// a blade sweeps through, then the halves come apart and open to show their cut
const slicing = [
  {
    dur: 1.1,
    start: () => {
      // a cut across the Z axis, through the middle
      const view = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
      const right = new THREE.Vector3().crossVectors(view, camera.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, view);
      // the normal points to the right of the screen, so the halves part the natural way
      const n = new THREE.Vector3(0, 0, right.z < 0 ? -1 : 1);
      slice.n.copy(n);
      slice.c.copy(center);
      slice.d = n.dot(center);
      // the blade comes down from the top
      slice.t1.copy(up).addScaledVector(n, -up.dot(n)).normalize();
      const R = radius * 2.4;
      blade.scale.set(R, R, 1);
      blade.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
      meshB.visible = true;
      makeCaps();
      // the halves part along the cut's normal as seen on screen; seen end-on,
      // sideways
      const side = n.clone().addScaledVector(view, -n.dot(view));
      if (side.length() < 0.3) side.copy(right).multiplyScalar(right.dot(n) < 0 ? -1 : 1);
      side.normalize();
      planOpening(view, side);
      setSlice(0, 0);
    },
    update: (x) => {
      const e = easeInOut(x);
      blade.position.copy(slice.c).addScaledVector(slice.t1, (0.5 - e) * radius * 5);
      blade.material.opacity = 0.55 * Math.sin(Math.PI * x);
      // the camera comes to rest, so the opened halves face it
      controls.autoRotateSpeed = 0.6 * (1 - x);
    },
    end: () => {
      blade.material.opacity = 0;
      controls.autoRotate = false;
    },
  },
  {
    dur: 3,
    update: (x) => {
      const r = spring((x - 0.12) / 0.88, 4.5, 1.3);
      setSlice(spring(x, 4, 1.6), r);
      const f = Math.min(Math.max(r, 0), 1);
      center.lerpVectors(slice.center0, slice.center1, f);
      radius = THREE.MathUtils.lerp(slice.radius0, slice.radius1, f);
      floorY = THREE.MathUtils.lerp(slice.floor0, slice.floor1, f);
    },
  },
  {}, // rest
];

const phases = [
  // the next mesh may not be ready yet: wait for it (mostly at the very start)
  { update: pump, done: () => plan !== null, end: startFold },
  { dur: 2.1, update: (x) => { pump(); shape.deform(fold, x, 0); frame(fold); } },
  { dur: 3.4, update: (x) => { pump(); shape.deform(fold, 1, x); frame(fold); } },
];

const GRID = 4;
const BAR_LENGTH = (5 / 3) * GRID; // long enough to fold nicely

shape = new Shape(PALETTE, GRID);
meshA.geometry = meshB.geometry = shape.geometry;
frame();
planNext(null, { axis: new THREE.Vector3(0, 0, 1), stretch: BAR_LENGTH / (bmax.z - bmin.z), cap: 0.13 });
let timeline = [
  { dur: 1.3, update: (x) => { pump(); group.scale.setScalar(Math.max(spring(x, 4.5, 2), 1e-3)); } },
  { dur: 0.4, update: pump },
  phases[0],
  // a longer stretch than the others: it goes a long way
  { dur: 2.8, update: (x) => { pump(); shape.deform(fold, x, 0); frame(fold); } },
  phases[2],
];
let phase = -1, phaseTime = 0;

function nextPhase() {
  phase++;
  if (phase >= timeline.length) {
    // once the last fold is done, slice
    timeline = shape.foldCount < FOLDS ? phases : slicing;
    phase = 0;
  }
  phaseTime = 0;
  timeline[phase].start?.();
}

nextPhase();

// ---- loop -------------------------------------------------------------------

const clock = new THREE.Clock();
const camOffset = new THREE.Vector3();

function step(dt) {
  phaseTime += dt;
  const p = timeline[phase];
  p.update?.(p.dur ? Math.min(phaseTime / p.dur, 1) : 0);
  if (p.done ? p.done() : phaseTime >= p.dur) {
    p.end?.();
    nextPhase();
  }

  // keep the shape framed while it moves and grows
  const k = 1 - Math.exp(-dt * 2);
  controls.target.lerp(center, k);
  camOffset.subVectors(camera.position, controls.target);
  const want = (radius * 0.85) / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) + 1;
  camOffset.setLength(THREE.MathUtils.lerp(camOffset.length(), want, k));
  camera.position.copy(controls.target).add(camOffset);
  controls.update();

  // the floor follows the bottom of the shape: down at once, so the shape never
  // sinks into it, up gently. The shadow camera frames the shape.
  const floor = floorY * group.scale.y - 0.01;
  ground.position.y = Math.min(THREE.MathUtils.lerp(ground.position.y, floor, k), floor);
  groundUniforms.uCenter.value.copy(controls.target);
  groundUniforms.uReach.value = radius * 1.6;
  shadowLight.target.position.copy(controls.target);
  shadowLight.position.copy(controls.target).addScaledVector(SHADOW_DIR, radius * 3);
  const cam = shadowLight.shadow.camera;
  cam.left = cam.bottom = -radius * 1.8;
  cam.right = cam.top = radius * 1.8;
  cam.near = radius * 0.5;
  cam.far = radius * 8;
  cam.updateProjectionMatrix();
  // the same softness, whatever the size of the shape
  shadowLight.shadow.radius = (0.3 * shadowLight.shadow.mapSize.x) / (3.6 * radius);
}

// ?t=seconds fast-forwards the animation (handy to inspect a given moment)
const skip = parseFloat(params.get('t'));
if (skip > 0) {
  const t0 = performance.now();
  for (let t = 0; t < skip; t += 1 / 30) step(1 / 30);
  if (params.has('stats'))
    document.title = `phase ${phase} folds ${shape.foldCount} tris ${shape.triangleCount} ms ${(performance.now() - t0) | 0}`;
}

// ---- rendering --------------------------------------------------------------
// ambient occlusion darkens the creases between the pressed layers

const gtao = new GTAOPass(scene, camera);
gtao.output = GTAOPass.OUTPUT.Off; // only compute it: the materials apply it
gtao.updateGtaoMaterial({ distanceExponent: 1.2, thickness: 1, scale: 1.6, samples: 16 });
gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 6, normalPhi: 1, radius: 6, rings: 2, samples: 16 });
aoUniforms.uAO.value = gtao.pdRenderTarget.texture;
// the built-in normal pass can't follow the fold, done in the vertex shader:
// render each object with its own folded normal material instead
gtao.renderOverride = function (renderer, _, target, clearColor, clearAlpha) {
  const color = renderer.getClearColor(new THREE.Color()), alpha = renderer.getClearAlpha();
  const swapped = [];
  scene.traverse((o) => {
    if (o.userData.normalMaterial) {
      swapped.push([o, o.material]);
      o.material = o.userData.normalMaterial;
    }
  });
  const shown = noAO.map((o) => o.visible);
  noAO.forEach((o) => (o.visible = false));
  renderer.setRenderTarget(target);
  renderer.setClearColor(clearColor, clearAlpha);
  renderer.clear();
  renderer.render(scene, camera);
  noAO.forEach((o, i) => (o.visible = shown[i]));
  for (const [o, m] of swapped) o.material = m;
  renderer.setClearColor(color, alpha);
};

// the background, light in the middle, a little warmer and darker around; and
// over everything, a light vignette and a fine grain, so the pastels don't
// look plastic. Both straight in display colors, untouched by the tone mapping.
const screenQuad = (uniforms, fragmentShader, opts) => {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader,
    depthTest: false,
    depthWrite: false,
    ...opts,
  }));
  mesh.frustumCulled = false;
  scene.add(mesh);
  return mesh;
};
const aspect = { value: innerWidth / innerHeight };
const background = screenQuad(
  { uBg: { value: new THREE.Color(PALETTE.bg).convertLinearToSRGB() }, uAspect: aspect },
  /* glsl */ `
    uniform vec3 uBg;
    uniform float uAspect;
    varying vec2 vUv;
    void main() {
      float r = length((vUv - 0.5) * vec2(uAspect, 1.0));
      gl_FragColor = vec4(mix(uBg, uBg * vec3(0.975, 0.96, 0.945), smoothstep(0.2, 1.0, r)), 1.0);
    }`
);
background.renderOrder = -1;
// premultiplied: out = rgb + picture * (1 - a)
const finish = screenQuad(
  { uAspect: aspect, uTime: { value: 0 } },
  /* glsl */ `
    uniform float uAspect, uTime;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 q = fract(vec3(p.xyx) * 0.1031);
      q += dot(q, q.yzx + 33.33);
      return fract((q.x + q.y) * q.z);
    }
    void main() {
      float r = length((vUv - 0.5) * vec2(uAspect, 1.0));
      float vignette = 0.05 * smoothstep(0.55, 1.1, r);
      float g = (hash(gl_FragCoord.xy + fract(uTime * 7.31) * 1e3) - 0.5) * 0.028;
      gl_FragColor = vec4(vec3(max(g, 0.0)), vignette + max(-g, 0.0));
    }`,
  {
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  }
);
finish.renderOrder = 1000;
const noAO = [blade, ground, background, finish];

function setSize() {
  camera.aspect = aspect.value = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  aoUniforms.uAORes.value.copy(size);
  gtao.setSize(Math.ceil(size.x / 2), Math.ceil(size.y / 2));
}
setSize();

function render() {
  // reach of the occlusion: a fraction of the shape, so it scales as it grows
  gtao.gtaoMaterial.uniforms.radius.value = radius * 0.16;
  finish.material.uniforms.uTime.value = clock.elapsedTime;
  gtao.render(renderer);
  renderer.setRenderTarget(null);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(() => {
  step(Math.min(clock.getDelta(), 1 / 20));
  render();
});

addEventListener('resize', setSize);

