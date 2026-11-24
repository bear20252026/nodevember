// A cushion of moss on a boulder, and two little ones beside it. The soil first, bare; the short leafy
// shoots spread over it from a few spots until it's all green; then the long
// filaments rise, their capsules swell and they ripen to orange. Move the
// pointer through them: they bend out of its way, and the short shoots sink
// under it like a cushion, squashed against the soil, filling back slowly.
//   ?seed=n     one cushion (random without it)
//   &secs=12    how long the growth lasts (about 1.4 × that until all ripe)
//   &at=0.5     starts the growth that far (1: grown), &still doesn't play
//   &nopost     without the post-processing, &nodof without the depth of field
//   &density=7000 shoots per unit of area, &filaments=46, &pr=2 pixel ratio (max 1.5 by default)
// Keys: g grow again, p pause, n new cushion, d depth of field, e post-processing,
// h hide the bar. The slider scrubs through the growth.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupRenderer, createStage, createPost } from './look.js';
import { createSupport, GROUND_Y } from './support.js';
import { createFloor } from './floor.js';
import { createShoots } from './shoots.js';
import { createFilaments } from './filaments.js';

const params = new URLSearchParams(location.search);
let seed = params.has('seed') ? parseInt(params.get('seed'), 10) || 0 : Math.floor(Math.random() * 1e6);
const secs = parseFloat(params.get('secs')) || 12;
const density = parseFloat(params.get('density')) || 7000;
const filamentCount = parseInt(params.get('filaments'), 10) || 46;
const END = 1.45; // the growth goes a bit past 1: the last capsules ripen
let post = !params.has('nopost');
let playing = !params.has('still');
let growth = Math.min(END, parseFloat(params.get('at')) || (playing ? 0 : END));
if (params.has('still') && params.has('at')) growth = parseFloat(params.get('at'));

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, parseFloat(params.get("pr")) || 1.5));
renderer.setSize(innerWidth, innerHeight);
setupRenderer(renderer);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const stage = createStage(renderer, scene);

const camera = new THREE.PerspectiveCamera(26, innerWidth / innerHeight, 0.02, 120);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.6;
controls.maxDistance = 6;
controls.maxPolarAngle = 1.5;
controls.rotateSpeed = 0.6;

const fx = createPost(renderer, scene, camera);
fx.dof = !params.has('nodof');

let support, shoots, filaments, floor;
function build() {
  if (support) {
    scene.remove(support.group, shoots.group, filaments.group, floor.group);
    support.dispose();
    shoots.dispose();
    filaments.dispose();
    floor.dispose();
  }
  support = createSupport(seed);
  floor = createFloor(support, seed, GROUND_Y, stage.back);
  scene.add(floor.group);
  // the moss on each clump: the main one, then the little one with 3 or 4
  // filaments and the tiny one with 1 or 2
  const r = (seed * 7919) % 1000 / 1000;
  const counts = [filamentCount, 3 + (r < 0.5 ? 0 : 1), 1 + ((r * 10) % 1 < 0.5 ? 0 : 1)];
  shoots = combine(support.patches.map((p, i) => createShoots(p, seed + i * 1013, { density })));
  filaments = combine(support.patches.map((p, i) => createFilaments(p, seed + i * 1013, { count: counts[i] })));
  scene.add(support.group, shoots.group, filaments.group);
  const u = new URL(location.href);
  u.searchParams.set('seed', seed);
  history.replaceState(null, '', u);
}
// several of them as one: one group, one update, the counts summed
function combine(list) {
  const group = new THREE.Group();
  group.add(...list.map((l) => l.group));
  return {
    group,
    count: list.reduce((a, l) => a + l.count, 0),
    update: (...args) => list.forEach((l) => l.update(...args)),
    // the pointer pressing in: passed on to each, each keeps its own dent
    touch: (...args) => list.forEach((l) => l.touch?.(...args)),
    dispose: () => list.forEach((l) => l.dispose()),
  };
}
build();

// a low, close view, a little from the side, like a macro photograph
const target = support.center.clone().add(new THREE.Vector3(0, 0.14, 0));
controls.target.copy(target);
// &cam=x,y,z: from elsewhere (relative to the middle of the cushion), &look=y: aimed higher or lower
const cam = (params.get('cam') || '0.9,0.8,3.9').split(',').map(Number);
if (params.has('look')) target.y += parseFloat(params.get('look'));
controls.target.copy(target);
camera.position.copy(target).add(new THREE.Vector3(...cam));
controls.update();

// ---- the pointer: a ray from the camera, or none when it's away
const pointer = new THREE.Vector2();
let pointerIn = false;
const raycaster = new THREE.Raycaster();
const canvas = renderer.domElement;
canvas.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerIn = true;
});
canvas.addEventListener('pointerleave', () => (pointerIn = false));
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerType !== 'mouse') pointerIn = false;
});

// ---- the bar
const info = document.getElementById('info');
const bar = document.getElementById('bar');
const slider = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 1000, value: 0 });
const button = (label, title, fn) => {
  const b = Object.assign(document.createElement('button'), { textContent: label, title });
  b.addEventListener('click', fn);
  bar.append(b);
  return b;
};
bar.append(slider);
const playBtn = button('', 'p', () => togglePlay());
button('grow again', 'g', () => regrow());
button('new', 'n', () => renew());
const dofBtn = button('', 'd', () => { fx.dof = !fx.dof; showState(); });
const postBtn = button('', 'e', () => { post = !post; showState(); });
slider.addEventListener('input', () => {
  growth = (slider.value / 1000) * END;
  playing = false;
  showState();
});
function showState() {
  info.textContent = `05 — moss · seed ${seed} · ${shoots.count.toLocaleString()} shoots, ${filaments.count} filaments · drag to turn, move the pointer through the moss`;
  playBtn.textContent = playing ? 'pause' : growth >= END ? 'grown' : 'play';
  dofBtn.textContent = fx.dof ? 'focus: shallow' : 'focus: deep';
  dofBtn.style.opacity = post ? '' : 0.3;
  postBtn.textContent = post ? 'post: on' : 'post: off';
}
function togglePlay() {
  if (growth >= END) growth = 0;
  playing = !playing;
  showState();
}
function regrow() {
  growth = 0;
  playing = true;
  showState();
}
function renew() {
  seed = Math.floor(Math.random() * 1e6);
  build();
  regrow();
}
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'g') regrow();
  else if (k === 'p' || k === ' ') togglePlay();
  else if (k === 'n') renew();
  else if (k === 'd') { fx.dof = !fx.dof; showState(); }
  else if (k === 'e') { post = !post; showState(); }
  else if (k === 'h') bar.classList.toggle('hidden');
});
slider.value = Math.round((growth / END) * 1000);
showState();

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---- the loop
const clock = new THREE.Clock();
let time = 0;
document.getElementById('loading').remove();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;
  if (playing) {
    growth = Math.min(END, growth + dt / secs);
    if (growth >= END) {
      playing = false;
      showState();
    }
    slider.value = Math.round((growth / END) * 1000);
  }
  controls.update();
  let ray = null, onMoss = null;
  if (pointerIn) {
    raycaster.setFromCamera(pointer, camera);
    ray = raycaster.ray;
    // where the pointer meets the moss: on (a coarse copy of) the soil of any clump
    const hit = raycaster.intersectObjects(support.picks, false)[0];
    // brought back along the ray to about the top of the moss, where the eye meets it
    if (hit) onMoss = hit.point.addScaledVector(ray.direction, -0.07);
  }
  shoots.update(Math.min(growth, 1));
  shoots.touch(renderer, onMoss, dt);
  filaments.update(growth, dt, time, ray);
  if (post) fx.render(innerWidth, innerHeight, time, camera.position.distanceTo(controls.target));
  else renderer.render(scene, camera);
});
