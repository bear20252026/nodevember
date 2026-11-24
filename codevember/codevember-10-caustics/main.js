// Caustics, as the path of light, in a diorama: a long, shallow glass tank
// on a thick wooden shelf in a sunlit room, a block of sand with water over it. Grains of light fall from high up, all
// in one direction, each a tiny dot with a thin trail; the waves bend them
// where they enter the water (a few glance off), they slow down in it, and
// where they land on the sand they go out and leave a small glow. The glow
// fades slowly, kept alive only by new grains — so where the waves focus the
// light it gathers into the bright web of caustics. A ball rests on the sand
// (for Evan Wallace): the grains that meet it go out on it and light it, and
// the sand behind it stays in its shadow.
//   ?rate=5000   grains born each second (all drawn: a few bright, most faint)
//   &speed=5     how fast they fly (in the air; 1.33 times slower in the water)
//   &tau=2.5     how slowly the glow on the sand fades (seconds to fall to 1/e)
//   &trail=0.22  the trail's length, in seconds of flight
//   &seed=…      this tank again (each visit draws its own: the sand's dunes and markings, the
//                sea, the ball's and the pebbles' places; the seed is logged in the console)
//   &waves=1     the waves' height, &wind=3 the wind (longer waves; else 2.5–3.6, from the seed), &heading=0.2 its heading
//   &chop=1.3    how sharp the crests (0 round, 1.3 pinched; the very tips fold into cusps)
//   &glow=1      how bright the glow on the sand, &splat=0.08 the size of each grain's spot
//   &beams=3     how many whole rays are drawn at once (thick, steady, split at the water); 0 none
//   &beamfade=0.75 how long the rays take to fade out (s), &beamhold=0.4 how long after reaching the sand they start to
//   &edge=1      how strongly the rays and the brighter grains' trails are edged with shade (0 none)
//   &air=2       how much brighter the grains are in the air, against the white room
//   &water=2.2   and in the water, against its pale veil; &width=2 their trails' width (pixels)
//   &patch=1.7   how bright the rays' patches on the sand, &patchw=7 how much wider than a grain's
//   &cam=x,y,z   another viewpoint, &pr=2 the pixel ratio (2 at most by default)
//   &night       by night: moonlight through the window and in the grains, the room dim and blue (n to switch)
//   &blue=1.57   how blue the night (0 a grey night), &light=0.55 how much light the room
//                keeps, &moon=0.35 how bright the moon through the window
//   &nopost      without the bloom, &still paused, &stats frames a second in the bar
// Drag to turn round the tank, scroll to come closer.
// Keys: space pause, n night, e post-processing, c clear the sand, h hide the bar.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { BASE_Y, BOX_HX, BOX_HZ, WATER_Y, FLOOR_Y, ROOM_HALF, WALL_Z, toRoom, fromRoom, SEED, SEA_SEED, SEA_HEADING, SEA_WIND, NIGHT, NIGHT_LOOK } from './sea.js';
import { createSeaField } from './field.js';
import { createLight } from './light.js';
import { createBeams } from './beams.js';
import {
  createGlow, createSky, createFloor, createSandSides, createWater, createWaterSides, createWaterUnderside,
  createGlass, createShelf, createWalls, createRoomFloor, createPost, createBall, createPebbles,
} from './scene.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
const rate = num('rate', 5000);
const speed = num('speed', 5);
const tau = num('tau', 2.5);
let post = !params.has('nopost');
let playing = !params.has('still');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 2)));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.05, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 9; // (always outside the glass)
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI / 2 + 0.12; // down to a little below the water's level
controls.target.set(0, -1.7, 0);
camera.position.set(...(params.get('cam') || '-7.5,4.6,15.5').split(',').map(Number));
controls.update();

// ---- the light: one direction, from high up on the left, onto the tank
// born far up, each at its own height (&near, &far: metres over the water)
const near = num('near', 4.5), far = num('far', 10);
// enough room for every grain in flight (up to about 2.8 s, and the flight down from its height, from birth to going out)
const MAX = 2 ** Math.ceil(Math.log2(rate * (4.6 + (far - 4) / speed)));
const splat = num('splat', 0.08);
const lightDir = new THREE.Vector3(0.5, -1, -0.12).normalize();
// the still sea, worked out once into a texture
// (the still sea is this visit's own: its seed and wind come from the tank's seed)
const sea = createSeaField(renderer, { rms: 0.1 * num('waves', 1), wind: num('wind', SEA_WIND), heading: num('heading', SEA_HEADING), chop: num('chop', 1.3), seed: SEA_SEED });
// the light falls on the tank's water, and through the glass on the side it comes from: the strip of the
// water's level beside the tank whose light gets to the sand through it
const litArea = (2 * BOX_HX + Math.abs((lightDir.x / lightDir.y) * (WATER_Y - FLOOR_Y))) *
  (2 * BOX_HZ + Math.abs((lightDir.z / lightDir.y) * (WATER_Y - FLOOR_Y)));
const light = createLight(sea, {
  rate,
  speed,
  tau,
  trail: num('trail', 0.22),
  // each grain's share, so that the sand is as bright whatever the rate, the
  // fading and the area lit (it was first set for 25000 a second over 504 m²)
  deposit: ((num('glow', 1) * 0.16 * 80000 * 3.0) / (rate * tau)) * (0.11 / splat) ** 2 * (litArea / 504),
  splat,
  gain: 0.24,
  dir: lightDir,
  max: MAX,
  near,
  far,
  seed: Math.floor(Math.random() * 1e9),
  air: num('air', 2),
  water: num('water', 2.2),
  width: num('width', 2),
  edge: 0.25 * num('edge', 1),
});

// ---- a few rays of the same light drawn whole, splitting at the water
const beams = createBeams(sea, { dir: lightDir, count: num('beams', 3), near, far, tau, splat: num('patchw', 7) * splat, patch: num('patch', 1.7), fade: num('beamfade', 0.75), hold: num('beamhold', 0.4), edge: 0.35 * num('edge', 1) });

// ---- what's in the tank is drawn first into its own picture (inside), which
// the water's top and sides show, the top bending it with its waves: the
// sand, the grains in the water, the surface's underside, and the room behind
// the tank, all dimmed by the water they are seen through
const glow = createGlow(renderer);
glow.depositScene.add(light.deposit, beams.deposit);
// the ball's own glow map, fading the same way
const ballGlow = createGlow(renderer, 512, 256);
ballGlow.depositScene.add(light.ballDeposit, beams.ballDeposit);
const size = renderer.getDrawingBufferSize(new THREE.Vector2());
const inside = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
const insideScene = new THREE.Scene();
const underside = createWaterUnderside(sea, lightDir, glow);
insideScene.add(createSky(true), createWalls(true), createRoomFloor(true), createShelf(true, glow), createFloor(glow), createPebbles(glow), createBall(ballGlow), light.below, beams.below, underside);
// and the diorama as seen: the room, its walls, the shelf, the sand's sides,
// the water, the grains in the air, the glass
const scene = new THREE.Scene();
const water = createWater(sea, lightDir, inside.texture);
const waterSides = createWaterSides(sea, inside.texture);
scene.add(createSky(), createWalls(), createRoomFloor(), createShelf(false, glow), createSandSides(glow), water, waterSides, light.above, beams.above, createGlass(sea));
const fx = createPost(renderer, scene, camera);

// ---- night: every shader is handed the one value they share (before any is
// compiled); and the few things set from here — the grains' and the rays'
// colour, how much brighter they are made against the room, their shade, the
// glow's gain — are kept as they are by day, to be eased towards the night's
const dayOf = new Map(); // uniform -> [its name, its day value]
for (const root of [scene, insideScene, glow.depositScene, ballGlow.depositScene]) {
  root.traverse((o) => {
    const u = o.material?.uniforms;
    if (!u) return;
    u.uNight = NIGHT;
    u.uNightBlue = NIGHT_LOOK.blue;
    u.uNightLight = NIGHT_LOOK.light;
    u.uMoon = NIGHT_LOOK.moon;
    for (const k of ['uColor', 'uAir', 'uWater', 'uEdge', 'uGlowGain']) {
      if (u[k] && !dayOf.has(u[k])) dayOf.set(u[k], [k, u[k].value.clone ? u[k].value.clone() : u[k].value]);
    }
  });
}
// the grains' moonlight, as blue as the night is asked to be (as bright)
const MOON = new THREE.Color();
const moonColor = () => MOON.setRGB(...[0.82, 0.95, 1.23].map((c) => Math.max(0, 1 + (c - 1) * NIGHT_LOOK.blue.value)));
NIGHT_LOOK.blue.value = num('blue', 1.57);
NIGHT_LOOK.light.value = num('light', 0.55);
NIGHT_LOOK.moon.value = num('moon', 0.35);
const bloomDay = fx.bloom.strength;
let nightTo = params.has('night') ? 1 : 0;
function setNight(k) {
  NIGHT.value = k;
  moonColor();
  for (const [u, [name, day]] of dayOf) {
    if (name === 'uColor') {
      const lum = (day.r + day.g + day.b) / 3;
      u.value.copy(day).lerp(MOON.clone().multiplyScalar(lum), k);
    }
    // against the dark room the grains need no lifting, nor their shade
    else if (name === 'uAir') u.value = day * (1 - 0.5 * k);
    else if (name === 'uWater') u.value = day * (1 - 0.2 * k);
    else if (name === 'uEdge') u.value = day * (1 - k);
    else if (name === 'uGlowGain') u.value = day * (1 - 0.15 * k);
  }
  fx.bloom.strength = bloomDay * (1 + 0.3 * k);
  const c = new THREE.Color(0xb9b6b0).lerp(new THREE.Color(0x161c28), k);
  document.body.style.background = '#' + c.getHexString();
}
setNight(nightTo);

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.getDrawingBufferSize(size);
  inside.setSize(size.x, size.y);
  water.material.uniforms.uRes.value.copy(size);
  waterSides.material.uniforms.uRes.value.copy(size);
  light.setResolution(size.x, size.y, renderer.getPixelRatio());
  beams.setResolution(size.x, size.y);
  fx.setSize(innerWidth, innerHeight);
}
addEventListener('resize', resize);
resize();

// ---- the bar
const bar = document.getElementById('bar');
const info = document.getElementById('info');
const button = (title, fn) => {
  const b = Object.assign(document.createElement('button'), { title });
  b.addEventListener('click', fn);
  bar.append(b);
  return b;
};
const playBtn = button('space', () => togglePlay());
button('c', () => clearSand()).textContent = 'clear the sand';
const nightBtn = button('n', () => toggleNight());
function showState() {
  playBtn.textContent = playing ? 'pause' : 'play';
  nightBtn.textContent = nightTo ? 'day' : 'night';
}
const toggleNight = () => { nightTo = 1 - nightTo; showState(); };
const togglePlay = () => { playing = !playing; showState(); };
const togglePost = () => { post = !post; showState(); };
let clearing = false;
const clearSand = () => (clearing = true);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === ' ') togglePlay();
  else if (k === 'e') togglePost();
  else if (k === 'n') toggleNight();
  else if (k === 'c') clearSand();
  else if (k === 'h') bar.classList.toggle('hidden');
});

showState();
console.log(`caustics · seed ${SEED}`);

// ---- already falling when the page opens: the grains of the last few
// fadings, landing and leaving their glow step by step, so the sand is lit
// as it would be after a long while
let time = 0;
const warm = Math.min(3 * tau, 30);
for (let t = -warm; t < 0; t += 0.05) {
  const t1 = Math.min(0, t + 0.05);
  light.emit(t, t1);
  light.uniforms.uPrev.value = t;
  light.uniforms.uTime.value = t1;
  beams.update(t1, t1 - t);
  glow.update(t1 - t, tau);
  ballGlow.update(t1 - t, tau);
}
light.uniforms.uTime.value = 0;
beams.update(0, 0);

const clock = new THREE.Clock();
// &stats: frames a second, and the time spent working out new grains' paths, in the bar
const stats = { on: params.has('stats'), frames: 0, emit: 0, draw: 0, since: performance.now() };
function showStats() {
  stats.frames++;
  const now = performance.now();
  if (!stats.on || now - stats.since < 2000) return;
  const fps = (stats.frames * 1000) / (now - stats.since);
  const line = `${fps.toFixed(0)} fps · paths ${(stats.emit / stats.frames).toFixed(2)} ms · drawing ${(stats.draw / stats.frames).toFixed(1)} ms a frame`;
  info.textContent = line;
  console.log('[stats] ' + line);
  Object.assign(stats, { frames: 0, emit: 0, draw: 0, since: now });
}
renderer.setAnimationLoop(() => {
  const realDt = clock.getDelta();
  const dt = playing ? Math.min(realDt, 1 / 15) : 0;
  // (night falls, or day comes, over a second and a half, even paused)
  if (NIGHT.value !== nightTo) {
    const step = Math.min(realDt, 1 / 15) / 1.5;
    setNight(nightTo > NIGHT.value ? Math.min(nightTo, NIGHT.value + step) : Math.max(nightTo, NIGHT.value - step));
  }
  const prev = time;
  time += dt;
  const e0 = performance.now();
  if (dt > 0) light.emit(prev, time);
  stats.emit += performance.now() - e0;
  light.uniforms.uPrev.value = prev;
  light.uniforms.uTime.value = time;
  beams.update(time, dt);
  if (clearing) {
    glow.clear();
    ballGlow.clear();
    clearing = false;
  }
  glow.update(dt, tau);
  ballGlow.update(dt, tau);
  controls.update();
  // never under the shelf
  if (camera.position.y < BASE_Y + 0.2) camera.position.y = BASE_Y + 0.2;
  // and always in the room: between its side walls, in front of the back one
  {
    let [x, z] = toRoom(camera.position.x, camera.position.z);
    x = Math.max(-ROOM_HALF + 0.8, Math.min(ROOM_HALF - 0.8, x));
    z = Math.max(WALL_Z + 1, z);
    [camera.position.x, camera.position.z] = fromRoom(x, z);
  }

  const d0 = performance.now();
  renderer.setRenderTarget(inside);
  renderer.render(insideScene, camera);
  renderer.setRenderTarget(null);
  if (post) fx.composer.render();
  else renderer.render(scene, camera);
  // (with &stats, waits for the GPU to finish, to time its work)
  if (stats.on) {
    renderer.getContext().finish();
    stats.draw += performance.now() - d0;
  }
  showStats();
});
