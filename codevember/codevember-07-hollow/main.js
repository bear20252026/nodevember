import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { partCaster } from './shell.js';
import { SHAPES } from './shapes.js';
import { marbleMaterial, brassMaterial } from './materials.js';
import { STYLE } from './styles.js';
import { untonemap } from './tonemap.js';

// A hollow sphere of marble, a thin shell, split along seams where a noise
// crosses a threshold (see shell.js), each part framed in brass. It starts
// thrown apart and rebuilds itself; the parts hovered fly off for good, and
// when three are left they all lift off and the next shape comes (see shapes.js), round the four.

const params = new URLSearchParams(location.search);
const num = (key) => (params.has(key) && !isNaN(parseFloat(params.get(key))) ? parseFloat(params.get(key)) : undefined);

// ?seed=n: the same seams, the same marble
let seed = params.has('seed') ? parseInt(params.get('seed')) >>> 0 : Math.floor(Math.random() * 1e6);
const seeded = (s) => {
  Math.random = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const random = Math.random;

// the cut, from the address: ?freq= ?threshold= ?seam= ?wall= ?layers= (see shell.js)
const cutOptions = Object.fromEntries(['freq', 'threshold', 'seam', 'wall', 'border', 'lip', 'round', 'layers', 'octaves', 'wobble', 'detail'].map((k) => [k, num(k)]).filter(([, v]) => v !== undefined));

const style = STYLE;

// ?shape=: which shape (see shapes.js), also picked below the picture
let shapeName = SHAPES[params.get('shape')] ? params.get('shape') : 'sphere';

// antialiased in its own render target, see below
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// the light the marble reflects: a quiet room around it, a tall window up on
// the left where the sun comes from, a strip of light behind on the right (as
// in 02_shatter). Its directions are those of the lights below.
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
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 9;

// the sun through the window models the shell and throws the seams' light
// inside, its shadows soft; a cool light from behind draws the outline
const key = new THREE.DirectionalLight();
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.bias = -0.0005;
key.shadow.normalBias = 0.01;
const shadowCam = key.shadow.camera;
shadowCam.left = shadowCam.bottom = -2.7;
shadowCam.right = shadowCam.top = 2.7;
shadowCam.near = 2;
shadowCam.far = 14;
const rim = new THREE.DirectionalLight();
const hemi = new THREE.HemisphereLight();
scene.add(key, rim, hemi);

// ---- the shell --------------------------------------------------------------
// Each part its own mesh, at its place: the points relative to its middle,
// so that the parts can move on their own later. One marble for all.

const sphere = new THREE.Group();
scene.add(sphere);
// it turns slowly, on a tilted axis; the models, that have a top, upright
const TILTED = new THREE.Vector3(0, 1, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), 0.35).normalize();
const UPRIGHT = new THREE.Vector3(0, 1, 0);
let SPIN = TILTED;
// &pace=: how fast the parts come back to their places, 1 the default
const PACE = num('pace') ?? 1;
let shell = null;
let hovered = null;

// the old shape put away: its parts gone, but those still flying out, and
// its marble once the last of these has vanished
function retire(old) {
  old.retired = true;
  for (const mesh of old.meshes) {
    if (mesh.userData.state === 'leaving') continue;
    sphere.remove(mesh);
    mesh.traverse((o) => o.geometry?.dispose());
  }
  if (!old.flying) {
    old.material.dispose();
    old.brass.dispose();
  }
}

// The shape is cut in a worker (worker.js), the picture moving on meanwhile;
// its arrays then made into geometries here, and these sent to the GPU a few
// at a time over the next frames (see warm), before they are shown. While a
// shape plays, the next one round is cut and readied already, so that it is
// there at once when its turn comes.
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let jobs = 0;
const jobsWaiting = new Map();
worker.onmessage = ({ data }) => {
  jobsWaiting.get(data.job)(data);
  jobsWaiting.delete(data.job);
};
const geometryOf = (g) => {
  const geometry = new THREE.BufferGeometry();
  for (const k of ['position', 'normal', 'rest', 'cut', 'depth']) if (g[k]) geometry.setAttribute(k, new THREE.BufferAttribute(g[k], k === 'cut' || k === 'depth' ? 1 : 3));
  geometry.setIndex(new THREE.BufferAttribute(g.index, 1));
  geometry.computeBoundingSphere();
  return geometry;
};
function cut(name, seed) {
  const job = ++jobs;
  const options = { ...SHAPES[name].options, ...cutOptions, seed };
  worker.postMessage({ job, name, options });
  return new Promise((resolve) => jobsWaiting.set(job, resolve)).then(({ parts, options: made }) => {
    for (const part of parts) {
      part.geometry = geometryOf(part);
      if (part.border) part.border.geometry = geometryOf(part.border);
      warming.push(part.geometry, part.border?.geometry);
    }
    // the options as the shell was made with them, the defaults filled in
    return { parts, made, locate: partCaster(parts, made) };
  });
}

// the geometries sent to the GPU ahead, two parts a frame: each drawn once,
// plainly, into a target of a pixel
const warming = [];
const warmTarget = new THREE.WebGLRenderTarget(1, 1);
const warmMesh = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial());
warmMesh.frustumCulled = false;
const warmCamera = new THREE.OrthographicCamera();
function warm() {
  for (let n = 0; n < 4 && warming.length; n++) {
    const geometry = warming.shift();
    if (!geometry) continue;
    warmMesh.geometry = geometry;
    renderer.setRenderTarget(warmTarget);
    renderer.render(warmMesh, warmCamera);
  }
  renderer.setRenderTarget(null);
}

// the next shape round, with its seed, being readied
let upcoming = null;

// the shape is built after the picker shows the choice; a later choice wins
let building = 0;
async function build(ready = cut(shapeName, seed)) {
  const ticket = ++building;
  const shape = SHAPES[shapeName];
  document.body.classList.add('busy');
  const { parts, made, locate } = await ready;
  // picked over by another meanwhile: let go, unless it is the next round's
  if (ticket !== building) {
    if (ready !== upcoming?.ready) parts.forEach((p) => { p.geometry.dispose(); p.border?.geometry.dispose(); });
    return;
  }
  document.body.classList.remove('busy');
  if (shell) retire(shell);
  seeded(seed);
  const { material, uniforms } = marbleMaterial(style);
  const { material: brass } = brassMaterial(style);
  const R = made.radius;
  const meshes = parts.map((part, id) => {
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.castShadow = mesh.receiveShadow = true;
    // its brass frame, carried with it
    if (part.border) {
      const border = new THREE.Mesh(part.border.geometry, brass);
      border.castShadow = border.receiveShadow = true;
      mesh.add(border);
    }
    const u = mesh.userData;
    u.id = id;
    u.home = new THREE.Vector3().fromArray(part.center);
    // the way out of the shape, from where it is
    u.out = u.home.clone().normalize();
    // it starts thrown out along it, a little aside, turned; it comes back
    // after a while of its own, at a speed of its own
    u.from = u.home.clone().addScaledVector(u.out, R * (2.2 + 2 * Math.random()))
      .add(new THREE.Vector3().randomDirection().multiplyScalar(0.8 * R * Math.random()));
    u.turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().randomDirection(), 0.5 + 1.8 * Math.random());
    u.delay = 2.6 * Math.random() * Math.random();
    u.duration = (1.3 + 2.4 * Math.random()) / PACE;
    u.t = 0;
    u.state = 'arriving';
    mesh.position.copy(u.from);
    mesh.quaternion.copy(u.turn);
    sphere.add(mesh);
    return mesh;
  });
  Math.random = random;
  // the first one sets off at once
  const first = Math.min(...meshes.map((m) => m.userData.delay));
  for (const mesh of meshes) mesh.userData.delay -= first;
  if (SPIN !== (shape.upright ? UPRIGHT : TILTED)) {
    SPIN = shape.upright ? UPRIGHT : TILTED;
    sphere.quaternion.identity();
  }
  // away: the parts not at their place, that the pointer sees through
  shell = { meshes, material, brass, uniforms, options: made, name: shapeName, locate,
    away: new Set(meshes.keys()), left: meshes.length, flying: 0 };
  for (const mesh of meshes) mesh.userData.shell = shell;
  hovered = null;
  renderer.domElement.style.cursor = '';
  if (params.has('stats')) document.title = `07 — hollow · ${shapeName} · seed ${seed} · ${parts.length} parts`;
  // the next one round, other seams and another marble, readied meanwhile
  const name = names[(names.indexOf(shapeName) + 1) % names.length], next = Math.floor(random() * 1e6);
  // the one readied before, if another was picked instead, let go
  if (upcoming && upcoming.ready !== ready) upcoming.ready.then(({ parts }) => parts.forEach((p) => { p.geometry.dispose(); p.border?.geometry.dispose(); }));
  upcoming = { name, seed: next, ready: cut(name, next) };
}
build();

// the picker: one button per shape; 1, 2, 3… too
const picker = document.getElementById('shapes');
const names = Object.keys(SHAPES);
const buttons = names.map((name, i) => {
  if (i) picker.append(Object.assign(document.createElement('span'), { textContent: '·' }));
  const b = Object.assign(document.createElement('button'), { textContent: SHAPES[name].label, title: `${i + 1}` });
  b.addEventListener('click', () => pick(name));
  picker.append(b);
  return b;
});
function pick(name, ready) {
  shapeName = name;
  buttons.forEach((b, i) => b.setAttribute('aria-pressed', names[i] === name));
  const url = new URL(location.href);
  url.searchParams.set('shape', name);
  history.replaceState(null, '', url);
  if (ready) build(ready);
  else if (shell?.name !== name) build();
}
buttons.forEach((b, i) => b.setAttribute('aria-pressed', names[i] === shapeName));

// n: other seams, another marble
addEventListener('keydown', (e) => {
  const i = parseInt(e.key) - 1;
  if (names[i]) pick(names[i]);
  if (e.key === 'n') {
    seed = Math.floor(random() * 1e6);
    build();
  }
});

// ---- hover --------------------------------------------------------------------
// The shape starts thrown apart, and its parts come back to their places,
// each after its own wait, at its own speed. A part at its place, once under
// the pointer, leaves for good: it lifts out, slowly at first, then faster
// and faster, up and away, and vanishes. Through the holes the pointer finds
// the parts on the far side, from inside. When three are left, they all lift
// off together, and the next shape comes, thrown apart, and rebuilds itself; and so on, round the four.
// On a touch screen, a tap sends a part away.

const pointer = { x: 0, y: 0, in: false };
const setPointer = (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  pointer.in = true;
};
renderer.domElement.addEventListener('pointermove', setPointer);
renderer.domElement.addEventListener('pointerdown', setPointer);
renderer.domElement.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') pointer.in = false;
});
// a finger lifted: no pointer left there, for the parts that come back to it
renderer.domElement.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') setTimeout(() => (pointer.in = false), 120);
});

// the part at its place under the pointer, the others seen through
const raycaster = new THREE.Raycaster();
const _ray = new THREE.Ray();
const _inv = new THREE.Matrix4();
function hover() {
  hovered = null;
  if (pointer.in) {
    raycaster.setFromCamera(pointer, camera);
    // in the shape's own frame, where the parts have their place (it only
    // turns: the distances along the ray are the same)
    _ray.copy(raycaster.ray).applyMatrix4(_inv.copy(sphere.matrixWorld).invert());
    const hit = shell.locate(_ray.origin.toArray(), _ray.direction.toArray(), shell.away);
    if (hit) hovered = shell.meshes[hit.id];
  }
  renderer.domElement.style.cursor = hovered ? 'pointer' : '';
}

// back to its place: eased in and out, gentler at the end, settling in
const IDENTITY = new THREE.Quaternion();
const ease = (s) => 1 - Math.pow(1 - s * s * (3 - 2 * s), 2);
function arrive(mesh, dt) {
  const u = mesh.userData;
  u.t += dt;
  const s = THREE.MathUtils.clamp((u.t - u.delay) / u.duration, 0, 1);
  const e = ease(s);
  mesh.position.lerpVectors(u.from, u.home, e);
  mesh.quaternion.slerpQuaternions(u.turn, IDENTITY, e);
  if (s === 1) {
    u.state = 'home';
    shell.away.delete(u.id);
  }
}

// away: out of its place, then up, and away from the eye rather than towards
// it; it leaves the turning shape for the room, so that it goes straight
const flying = [];
const UP = new THREE.Vector3(0, 1, 0);
const _eye = new THREE.Vector3();
function leave(mesh) {
  const u = mesh.userData;
  u.state = 'leaving';
  u.t = 0;
  shell.away.add(u.id);
  shell.left--;
  shell.flying++;
  scene.attach(mesh);
  const out = u.out.clone().transformDirection(sphere.matrixWorld);
  const dir = out.clone().addScaledVector(UP, 0.6);
  _eye.copy(camera.position).normalize();
  const k = dir.dot(_eye);
  if (k > 0) dir.addScaledVector(_eye, -0.8 * k);
  u.dir = dir.normalize();
  u.start = mesh.position.clone();
  u.spin = new THREE.Vector3().randomDirection();
  u.speed = (0.8 + 0.5 * Math.random()) * shell.options.radius;
  u.rate = 0.4 + 0.5 * Math.random();
  u.turn0 = mesh.quaternion.clone();
  flying.push(mesh);
}
const LEAVE = 3.2;
const _q2 = new THREE.Quaternion();
function fly(dt) {
  for (let i = flying.length - 1; i >= 0; i--) {
    const mesh = flying[i], u = mesh.userData;
    u.t += dt;
    const t = u.t;
    // lifts, then speeds away
    mesh.position.copy(u.start).addScaledVector(u.dir, u.speed * (0.3 * t + 0.45 * t * t + 0.35 * t * t * t));
    mesh.quaternion.copy(u.turn0).premultiply(_q2.setFromAxisAngle(u.spin, u.rate * t * t));
    mesh.scale.setScalar(Math.max(1 - THREE.MathUtils.smoothstep(t, 1.3, LEAVE), 1e-4));
    if (t < LEAVE) continue;
    flying.splice(i, 1);
    scene.remove(mesh);
    mesh.traverse((o) => o.geometry?.dispose());
    const owner = u.shell;
    owner.flying--;
    if (owner.retired && !owner.flying) {
      owner.material.dispose();
      owner.brass.dispose();
    }
  }
}

// the next shape, round the four, readied while this one played
function nextShape() {
  seed = upcoming.seed;
  pick(upcoming.name, upcoming.ready);
}
// ---- loop -------------------------------------------------------------------

const clock = new THREE.Clock();
const _q = new THREE.Quaternion();
function step(dt, real) {
  sphere.quaternion.premultiply(_q.setFromAxisAngle(SPIN, 0.12 * dt));
  controls.update();
  sphere.updateMatrixWorld();
  // the shape loads after the first frames
  if (!shell) return;
  hover();
  for (const mesh of shell.meshes) if (mesh.userData.state === 'arriving') arrive(mesh, real);
  if (hovered?.userData.state === 'home') {
    leave(hovered);
    // three left: they lift off all together, and the next shape comes
    if (shell.left <= 3 && !shell.done) {
      shell.done = true;
      for (const mesh of shell.meshes) if (mesh.userData.state !== 'leaving') leave(mesh);
      nextShape();
    }
  }
  fly(real);
}

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

// ---- the look ---------------------------------------------------------------

function applyStyle() {
  finish.defines = style.toneMapping === 'agx' ? { AGX: '' } : {};
  finish.needsUpdate = true;
  finish.uniforms.toneMappingExposure.value = style.exposure;
  // the paper, of the colors that come out of the tone mapping as the
  // style's own (its middle and edge are shades of it, on its sRGB color)
  const bg = new THREE.Color(style.bg);
  const shade = (k) => untonemap(new THREE.Color().setRGB(...bg.clone().convertLinearToSRGB().toArray().map((v, i) => v * k[i])).convertSRGBToLinear(), style.toneMapping, style.exposure);
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
  const env = roomEnvironment();
  scene.environment?.dispose();
  scene.environment = pmrem.fromScene(env, 0.015).texture;
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  scene.environmentIntensity = style.envIntensity;
}
applyStyle();

function setSize() {
  camera.aspect = aspect.value = innerWidth / innerHeight;
  // the sphere fits on narrow screens too
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
// &still: it does not turn
const still = params.has('still');
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  step(still ? 0 : dt, dt);
  finish.uniforms.uTime.value = clock.elapsedTime;
  warm();
  render();
});
