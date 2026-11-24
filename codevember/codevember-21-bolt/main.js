// Bolt. A diorama of a thunderstorm: on a block of meadow, its soil's layers showing over a
// wooden base, a bolt of lightning strikes, held at the very instant it touches the ground.
// It stands on one single board of dark wood, endless, lit only in a pool round it.
// Only the bolt is still: the storm clouds over it roll on, the rain keeps falling.
// Each visit a new block (a pentagon or a hexagon, convex, never regular), a new bolt and
// where it strikes, the grass charred round it.
//   ?seed=n    that block and that bolt (a new one each visit otherwise)
//   &still     the clouds and the rain stopped (for the shots)
//   &pr=2      a fixed pixel ratio
//   &mute      silent at first (so is &still)
// Its sound (sound.js): the rain and far thunder, on from the first click or key; hovered,
// the bolt crackles with static.
// Space (or a click) lets the bolt go: it flashes a few times, its thunder claps, stones fly out of the
// hole; then quietly a new one is there, from elsewhere in the cloud to elsewhere on the
// meadow, and the grass grows back where the last one struck.
// From space pressed until the new bolt holds still, the clouds roil in a ton of turbulence.
// Left alone, the bolt now and then glows down its length the way the new one came down.
// Keys: space (or a click) let it go, n a new strike, r turn round by itself, p pause the storm, s the sound on/off, h hide the bar.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { rng, makeOutline, insideDist, makeEdge, smoothstep } from './common.js';
import { createBlock, makeHeight, makeBurn, growOutline, scarDepth, SOIL, WOOD } from './ground.js';
import { createFloor } from './floor.js';
import { createPost } from './post.js';
import { createBolt } from './bolt.js';
import { createGrass, createRocks, createPebbles } from './grass.js';
import { createDebris } from './debris.js';
import { createClouds } from './clouds.js';
import { createRain } from './rain.js';
import { createSound } from './sound.js';

const CLOUD_BASE = 5.7;

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
const seed = Math.floor(num('seed', 1 + Math.random() * 100000));
const rand = rng(seed);
let paused = params.has('still');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 1.5)));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // nothing that casts a shadow moves: drawn once
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 200);
camera.position.set(15.5, 5.5, 17.5);
if (params.has("cam")) camera.position.fromArray(params.get("cam").split(",").map(Number));
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 3.2, 0);
if (params.has("at")) controls.target.fromArray(params.get("at").split(",").map(Number));
controls.enableDamping = true;
controls.minDistance = 6;
controls.maxDistance = 45;
controls.maxPolarAngle = Math.PI * 0.5 + 0.08; // never under the floor
controls.autoRotateSpeed = 0.35;

// ---- the block, and where the bolt comes down ----
const outline = makeOutline(rand);
// anywhere well inside, mostly off the middle (and, striking anew, away from `avoid`)
function pickStrike(r, avoid = []) {
  for (let tries = 0; ; tries++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 2.6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (insideDist(outline, x, z) <= 1.9) continue;
    if (tries < 300 && avoid.some(([ax, az, ad]) => Math.hypot(x - ax, z - az) < ad)) continue;
    return { x, z };
  }
}
const strike = pickStrike(rand);
const edge = makeEdge(outline, makeHeight()); // its rim rounded over and crumbling
const baseHeight = edge.height; // the ground without the scars
const burn = makeBurn(rand, strike, outline);
// the strikes on the meadow (ground.js's GLSL_SCAR): the one there now, and the one before it
// healing; each (x, z, how much there, how hot), and its burn
const blank = new THREE.DataTexture(new Uint8Array(4), 1, 1);
blank.needsUpdate = true;
const scars = [new THREE.Vector4(strike.x, strike.z, 1, 1), new THREE.Vector4(0, 0, 0, 0)];
const burns = [burn, null];
let slot = 0; // the one there now
const uniforms = {
  uTime: { value: 0 },
  uScreen: { value: new THREE.Vector2(1, 1) },
  uScar: { value: scars },
  uBurn0: { value: burn.tex },
  uBurn1: { value: blank },
  uBurnSize: { value: burn.size },
};
// the ground's height, the scars as they are now (or as given)
const scarred = (list) => (x, z) => {
  let h = baseHeight(x, z);
  for (const s of list) if (s.z > 0) h += s.z * scarDepth(Math.hypot(x - s.x, z - s.y));
  return h;
};
const height = scarred(scars);
scene.add(createBlock({ outline, height: baseHeight, edge, uniforms }));
scene.add(createGrass(rand, { outline, height: baseHeight, edge, uniforms, count: num('grass', 150000) }));
const rocks = createRocks(rand, { outline, height: baseHeight, avoid: [[strike.x, strike.z, 1.3]] });
scene.add(rocks.mesh);
let pebbles = createPebbles(rand, { height, burn, strike });
scene.add(pebbles.mesh);
// the floor it stands on, lit only round it
const rim = growOutline(outline);
scene.add(createFloor({ y: -SOIL - WOOD, footprint: rim, uniforms, radius: 10.9 }));
// the stones a strike throws out
const debris = createDebris({ outline, rim, height, baseY: -SOIL, floorY: -SOIL - WOOD });
scene.add(debris.mesh);

// ---- light: a little cold night light, and the bolt's own ----
const hemi = new THREE.HemisphereLight(0x46507a, 0x120c10, 0.5);
scene.add(hemi);
// the whole storm lit up for an instant as the bolt goes (off the rest of the time)
const skyFlash = new THREE.DirectionalLight(0xc4ccff, 0);
skyFlash.position.set(2, 12, 3);
scene.add(skyFlash);
const fill = new THREE.DirectionalLight(0xa4a8c8, 1.3);
fill.position.set(10, 5, 12);
scene.add(fill);
const strikeY = height(strike.x, strike.z);
const flash = new THREE.PointLight(0xc8d2ff, 34, 0, 2);
flash.position.set(strike.x, strikeY + 0.9, strike.z); // high enough not to burn a white disc into the ground under it
flash.castShadow = true;
flash.shadow.mapSize.set(1024, 1024);
flash.shadow.bias = -0.002;
flash.shadow.camera.near = 0.05;
scene.add(flash);

// ---- the bolt ----
// where it comes from, deep in the cloud: over the block, leaning toward the strike
const topFor = (r, s) => new THREE.Vector3(s.x * 0.3 + (r() - 0.5) * 3, 8.0, s.z * 0.3 + (r() - 0.5) * 3);
let boltTop = topFor(rand, strike);
const bolt = createBolt(rand, {
  top: boltTop,
  strike: new THREE.Vector3(strike.x, strikeY + 0.01, strike.z),
  ground: height,
  cloudBase: CLOUD_BASE,
});
scene.add(bolt.group);
const clouds = createClouds({ outline, channels: bolt.channels, base: CLOUD_BASE, top: 9.8, uniforms, steps: num('steps', 64) });
scene.add(clouds.mesh);
const rain = createRain(rand, { outline, height: baseHeight, top: CLOUD_BASE + 0.4, boltSamples: bolt.samples, uniforms, count: num('rain', 17000) });
scene.add(rain.group);
// its light higher up the channel, cast over the meadow from above
const boltLights = [];
for (const [i, power] of [[16, 30], [9, 40]]) {
  const l = new THREE.PointLight(0xb8c0ff, power, 0, 2);
  l.position.copy(bolt.samples[i]);
  boltLights.push([l, i]);
  l.castShadow = true;
  l.shadow.mapSize.set(512, 512);
  l.shadow.bias = -0.003;
  scene.add(l);
}

const post = createPost(renderer);

// ---- hovered, the bolt strikes anew between the same two ends (where it comes out of the
// cloud, and the strike): in a quarter of a second a run of flashes, each bolt much like the one
// before, closing in on the new one; and again and again for as long as it is hovered ----
const pointer = { x: 0, y: 0, in: false };
let overBolt = false;
// where the pointer last was on the bolt: the bolt moves under it as it strikes, so it
// stays hovered until the pointer moves off from there
const HOLD_PX = 40;
const lastOn = { x: 0, y: 0 };
// unhovered, it strikes no more: the run under way ends on its new bolt, and that one stays
// how hard it strikes anew while hovered: how far each flash of a run strays, how much its
// branches shoot about, how much it flickers (1: as wild as it goes)
const HOVER = 0.7;
const strikeRand = rng(Math.floor(Math.random() * 1e9));
const pa = new THREE.Vector3(), pb = new THREE.Vector3();
function pointerOnBolt(maxPx = 9) {
  const w = innerWidth, h = innerHeight;
  const toScreen = (v, out) => {
    out.copy(v).project(camera);
    out.set((out.x * 0.5 + 0.5) * w, (0.5 - out.y * 0.5) * h, out.z);
    return out;
  };
  for (const ch of bolt.channels) {
    if (ch.kind === 2) continue; // the streamers on the ground, too small to aim at
    const { pts } = ch;
    toScreen(pts[0], pa);
    for (let i = 1; i < pts.length; i++, pa.copy(pb)) {
      toScreen(pts[i], pb);
      if (pts[i].y > CLOUD_BASE + 0.6 || ch.power[i] < 0.05) continue; // lost in the cloud, or too faint
      if (pa.z > 1 || pb.z > 1) continue; // behind the camera
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const f = Math.max(0, Math.min(1, ((pointer.x - pa.x) * dx + (pointer.y - pa.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(pa.x + f * dx - pointer.x, pa.y + f * dy - pointer.y) < maxPx) return true;
    }
  }
  return false;
}
const lightPower = [flash, ...boltLights.map(([l]) => l)].map((l) => [l, l.intensity]);
function flicker(k) {
  bolt.setFlicker(k);
  for (const [l, p] of lightPower) l.intensity = p * k;
}
// while it strikes only the bolt changes; its lights' shadows and the clouds' glow are
// baked again once it holds still (too slow to follow every shape)
function settleBolt() {
  flicker(1);
  for (const [l, i] of boltLights) l.position.copy(bolt.samples[i]);
  renderer.shadowMap.needsUpdate = true;
  clouds.setChannels(bolt.channels);
}
function updateStrike(dt) {
  if (release) return sound.setHover(false); // (being let go, or not there yet)
  if (!pointer.in) overBolt = false;
  else if (overBolt || !bolt.striking) {
    if (pointerOnBolt()) {
      overBolt = true;
      lastOn.x = pointer.x;
      lastOn.y = pointer.y;
    } else if (overBolt && Math.hypot(pointer.x - lastOn.x, pointer.y - lastOn.y) > HOLD_PX) overBolt = false;
  }
  // strike after strike while it is hovered
  if (overBolt && !bolt.striking) bolt.strikeAnew(strikeRand);
  sound.setHover(overBolt); // its static crackling for as long as it is hovered
  const { changed, done } = bolt.stepStrike(dt, HOVER);
  if (done) settleBolt();
  else if (changed) {
    const k = 1 + (Math.random() * 0.7 - 0.3) * HOVER; // each flash of the run as bright as it comes
    flicker(k);
    sound.zap(k);
  }
}
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.in = e.buttons === 0; // not while orbiting
});
renderer.domElement.addEventListener('pointerleave', () => (pointer.in = false));

// ---- let go (space): in half a second a few flashes, as bright as the bolt gets and the
// whole storm lit up with them, its thunder clapping, stones flung out of the hole; then it's
// gone, the embers cool, and quietly a new bolt comes down, from elsewhere in the cloud to
// elsewhere on the meadow, burning in round its foot as the old scar heals over ----
let release = null;
const ejectDir = new THREE.Vector3(), ejectVel = new THREE.Vector3();
// the leader coming down, from the cloud to the ground in a blink, by jerks: faint, its
// branches feeling about with it, its front glowing; true once it touches the ground
const LEADER_TIME = 0.12, PULSE_TIME = 0.05, TAIL_TIME = 0.16;
function stepLeader(L, dt) {
  L.front += (dt / LEADER_TIME) * (0.3 + strikeRand() * 1.4);
  const near = Math.min(1, Math.max(0, L.front));
  bolt.setFront(L.front, 1.6);
  bolt.setFlicker(0.12);
  for (const [l, p] of lightPower) l.intensity = p * 0.06 * near * near;
  clouds.setGlow(0.3);
  rain.setGlow(0.15);
  return L.front >= 1;
}
// let go: the held bolt is gone and comes down again for real, then strikes (`strikeDown`).
// Once the new one has touched the ground it can be let go again at once (what is left of
// its settling and of the old scar healing over is skipped); let go before that, it goes
// as soon as it has
let queued = false;
function letGo() {
  if (bolt.striking) return;
  if (release) {
    if (release.contact >= 0) endRelease();
    else return void (queued = true);
  }
  queued = false;
  release = { leader: { front: -0.05 } };
}
function strikeDown() {
  bolt.setFront(1e3, 0);
  const r = strikeRand;
  // the flashes: the first the brightest, then a few return strokes down the same channel
  const n = 3 + Math.floor(r() * 3);
  const flashes = [[0, 1]];
  for (let i = 1; i < n; i++) flashes.push([flashes[i - 1][0] + 0.04 + r() * 0.06, 0.35 + r() * 0.5]);
  release = { t: 0, flashes, end: flashes[n - 1][0], built: false, fadeAt: -1 };
  sound.clap(flashes.map((f) => f[0]), flashes.map((f) => f[1]));
  // the stones: most of the pebbles in the bared earth, and clods out of the hole itself
  const s = scars[slot], cx = s.x, cz = s.y;
  const m = new THREE.Matrix4();
  pebbles.items.forEach((it, i) => {
    const d = Math.hypot(it.pos.x - cx, it.pos.z - cz);
    if (r() > 0.75 - d * 0.3) return; // the far ones mostly stay
    ejectDir.set(it.pos.x - cx + (r() - 0.5) * 0.4, 0, it.pos.z - cz + (r() - 0.5) * 0.4).normalize();
    const sp = (0.8 + r() * r() * 4.5) * (1.2 - d * 0.4);
    ejectVel.copy(ejectDir).multiplyScalar(sp).setY(1.8 + r() * 3.2 * (1.2 - d * 0.4));
    debris.fling(it.pos, ejectVel, it.q, it.scale, it.col);
    pebbles.mesh.setMatrixAt(i, m.makeScale(0, 0, 0));
  });
  pebbles.mesh.instanceMatrix.needsUpdate = true;
  const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const clods = 12 + Math.floor(r() * 10);
  for (let i = 0; i < clods; i++) {
    const a = r() * Math.PI * 2, size = 0.02 + r() ** 2 * 0.07;
    p.set(cx + Math.cos(a) * 0.15, height(cx, cz) + 0.05, cz + Math.sin(a) * 0.15);
    // (a few flung hard enough to clear the meadow and go over the edge)
    const sp = r() < 0.25 ? 4 + r() * 3 : 1 + r() * 3;
    ejectVel.set(Math.cos(a) * sp, 2.5 + r() * 3.5, Math.sin(a) * sp);
    q.setFromEuler(e.set(r() * 6.28, r() * 6.28, r() * 6.28));
    sc.set(size * (1 + r() * 0.6), size * (0.5 + r() * 0.4), size * (1 + r() * 0.5));
    col.setHSL(0.07 + r() * 0.05, 0.06 + r() * 0.08, 0.05 + r() * 0.1);
    debris.fling(p, ejectVel, q, sc, col);
  }
}

// the new strike, built while the storm is dark: its place, its burn, its pebbles, its bolt
function buildNext() {
  const r = strikeRand, old = scars[slot];
  const avoid = [[old.x, old.z, 2.4], ...rocks.at.map(([x, z]) => [x, z, 1.3])];
  const s = pickStrike(r, avoid);
  const next = 1 - slot;
  if (burns[next]) burns[next].tex.dispose();
  burns[next] = makeBurn(r, s, outline);
  uniforms[`uBurn${next}`].value = burns[next].tex;
  scars[next].set(s.x, s.z, 0, 0);
  // the ground as it will be, the old scar gone and the new one dug
  const final = scars.map((v, i) => new THREE.Vector4(v.x, v.y, i === next ? 1 : 0, 0));
  const ground = scarred(final);
  const newPebbles = createPebbles(r, { height: ground, burn: burns[next], strike: s });
  newPebbles.mesh.position.y = -0.25;
  scene.add(newPebbles.mesh);
  let top;
  for (let i = 0; i < 20; i++) if ((top = topFor(r, s)).distanceTo(boltTop) > 1.5) break;
  boltTop = top;
  const sy = ground(s.x, s.z);
  bolt.replace(r, { top, strike: new THREE.Vector3(s.x, sy + 0.01, s.z), ground });
  flicker(0);
  bolt.setTail(-1e3);
  bolt.setPulse(-1e3, 0);
  bolt.setFront(-1);
  flash.position.set(s.x, sy + 0.9, s.z);
  for (const [l, i] of boltLights) l.position.copy(bolt.samples[i]);
  clouds.setChannels(bolt.channels);
  release.old = { slot, pebbles };
  pebbles = newPebbles;
  slot = next;
}

// (after the next one is built: when the old scar starts healing, the new bolt fading in)
const BUILD_AT = 0.55, HEAL_AT = 0.1, HEAL_TIME = 2.2, FADE_AT = 0.25, LEADER_SETTLE = 0.3;
function updateRelease(dt) {
  if (!release) return;
  if (release.leader) {
    if (stepLeader(release.leader, dt)) strikeDown();
    return;
  }
  const R = release;
  R.t += dt;
  const t = R.t;
  if (!R.built) {
    // the flashes: each a sharp peak dying fast, a dim glow in the channel between them,
    // out after the last; the storm's light round them dying a little slower
    let k = 0, sky = 0;
    for (const [ti, a] of R.flashes) {
      if (t < ti) continue;
      k = Math.max(k, a * 3.2 * Math.exp(-(t - ti) / 0.035));
      sky += a * Math.exp(-(t - ti) / 0.07);
    }
    // and all the while the channel writhing, lashing to a new shape at each flash, each
    // flash a pulse of light running down it from the cloud into the ground; after the last,
    // the bolt goes the way it came: its tail runs down out of the cloud after it, its end
    // glowing, and the last of it drains into the ground
    const at = R.flashes.findLastIndex(([ti]) => t >= ti);
    const [ti, ta] = R.flashes[at];
    bolt.setPulse(-0.15 + (t - ti) / PULSE_TIME, 3 * ta * Math.exp(-(t - ti) / 0.08));
    const tailAt = R.end + 0.05;
    const tail = t < tailAt ? -1e3 : -0.15 + (1.2 * (t - tailAt)) / TAIL_TIME;
    if (tail < 1.05) bolt.writhe(strikeRand, dt, 0.4, 9, at !== R.kicked);
    R.kicked = at;
    bolt.setTail(tail, tail > -1 ? 1.6 : 0);
    if (t >= tailAt) k = Math.max(k, tail < 1.05 ? 0.4 : 0);
    flicker(k);
    clouds.setGlow(Math.min(2.5, k));
    rain.setGlow(k);
    skyFlash.intensity = 6 * sky;
    hemi.intensity = 0.5 + 1.6 * sky;
    // the hole's heart cooling from the first flash on
    scars[slot].w = Math.exp(-t / 0.9);
    // gone; the next one built in the dark once the stones are mostly down (it takes a
    // moment, which would freeze them in the air)
    if (t > R.end + 0.32) {
      skyFlash.intensity = 0;
      hemi.intensity = 0.5;
      clouds.setGlow(0);
      rain.setGlow(0);
    }
    if (t > Math.max(R.end + 0.32, BUILD_AT)) {
      buildNext();
      R.built = t;
    }
    return;
  }
  const old = scars[R.old.slot], cur = scars[slot];
  old.w = Math.exp(-t / 0.9);
  // the old scar healing over, the grass growing back, as the new one burns in
  const u = smoothstep(R.built + HEAL_AT, R.built + HEAL_AT + HEAL_TIME, t);
  old.z = 1 - u;
  cur.z = u;
  R.old.pebbles.mesh.position.y = -0.25 * u; // sunk back into the earth
  pebbles.mesh.position.y = -0.25 * (1 - u);
  renderer.shadowMap.needsUpdate = true; // (the ground under the bolt's lights is moving)
  // the new bolt coming down, once the clouds know its light: a faint leader stepping down
  // out of the cloud by jerks, its branches feeling about, its front glowing; when it
  // touches the ground the return stroke runs up it, a swell of light settling to the bolt
  // held as it was
  if (R.fadeAt < 0 && t > R.built + FADE_AT && !clouds.relighting) {
    R.fadeAt = t;
    R.descent = { front: -0.05 };
    R.contact = -1;
  }
  let f = 0;
  if (R.fadeAt >= 0) {
    if (R.contact < 0) {
      if (stepLeader(R.descent, dt)) R.contact = t;
    } else {
      const s = t - R.contact;
      bolt.setFront(1e3, 0);
      f = Math.min(1, s / LEADER_SETTLE);
      flicker(1 + 1.4 * Math.exp(-s / 0.06) * (s < 0.015 ? s / 0.015 : 1));
      clouds.setGlow(0.3 + 0.7 * smoothstep(0, 0.1, s) + 0.8 * Math.exp(-s / 0.1));
      rain.setGlow(smoothstep(0, 0.08, s));
    }
  }
  cur.w = f;
  if (u >= 1 && f >= 1) endRelease();
  else if (queued && R.contact >= 0) letGo();
}
// the new bolt held as it was, the old scar healed over
function endRelease() {
  const R = release, cur = scars[slot];
  flicker(1);
  clouds.setGlow(1);
  rain.setGlow(1);
  cur.z = cur.w = 1;
  pebbles.mesh.position.y = 0;
  scars[R.old.slot].set(0, 0, 0, 0);
  scene.remove(R.old.pebbles.mesh);
  R.old.pebbles.mesh.dispose();
  renderer.shadowMap.needsUpdate = true;
  release = null;
}

// ---- left alone, the held bolt now and then glows down its length the way the new one
// came down: a bead of light gliding down out of the cloud to the ground, a short tail
// behind it; never while it is played with (a moment after the last
// touch, it starts again) ----
const IDLE_AFTER = 2.5;
let idleFor = 0;
const glide = { on: false, at: -1, next: 0.8, k: 0 };
const GLIDE_SPEED = 0.9; // the whole bolt in a little over a second
const touched = () => (idleFor = 0);
for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown']) addEventListener(ev, touched, { passive: true });
function updateGlide(dt) {
  idleFor += dt;
  const idle = idleFor > IDLE_AFTER && !release && !bolt.striking && !paused;
  // (cut short at a touch, quickly faded)
  glide.k = idle ? Math.min(1, glide.k + dt / 0.3) : Math.max(0, glide.k - dt / 0.15);
  if (!glide.on) {
    if (idle && (glide.next -= dt) <= 0) {
      glide.on = true;
      glide.at = -0.08;
    }
  } else glide.at += dt * GLIDE_SPEED;
  if (glide.on && (glide.at > 1.25 || glide.k === 0)) {
    glide.on = false;
    glide.at = -1;
    glide.next = 1 + strikeRand() * 2;
  }
  // brightest coming out of the cloud, a little less low down; none at all off a run
  const g = !glide.on ? 0 : glide.k * 3.0 * (1 - 0.3 * smoothstep(0.6, 1.2, glide.at));
  if (!release) bolt.setGlide(glide.at, g);
  else bolt.setGlide(-1, 0);
}

// ---- let go, the clouds are thrown into turbulence: boiling and tearing, churning many
// times as fast, from the moment space is pressed until the new bolt is in place and holds
// still; then they calm down again. In the dark between the two bolts (the old one gone,
// the new one not yet coming down) they settle gently to almost calm, a breath held ----
let turb = 0;
function updateTurbulence(dt) {
  const R = release;
  const between = R && !R.leader && (R.built ? R.fadeAt < 0 : R.t > R.end + 0.32);
  const want = !R ? 0 : between ? 0.08 : 1;
  // eased toward it: quick to rise, settling into the pause gently (no sudden stop)
  const tau = want > turb ? 0.1 : R ? 0.45 : 0.5;
  turb += (want - turb) * (1 - Math.exp(-dt / tau));
  const k = 0.9 * turb * turb * (3 - 2 * turb);
  clouds.churn(paused ? 0 : dt, k, 1 + 7 * k);
}

function fit() {
  renderer.setSize(innerWidth, innerHeight);
  const pr = renderer.getPixelRatio();
  post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  uniforms.uScreen.value.set(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  camera.aspect = innerWidth / innerHeight;
  // keep the whole diorama in view in a tall window
  camera.fov = camera.aspect < 1 ? 2 * Math.atan(Math.tan((36 * Math.PI) / 360) / camera.aspect ** 0.7) * (180 / Math.PI) : 36;
  camera.updateProjectionMatrix();
  bolt.setPx(camera, innerHeight * pr);
  rain.setPx(camera, innerHeight * pr);
}
addEventListener('resize', fit);
fit();

// ---- the sound: on from the first gesture (browsers want one) ----
const sound = createSound();
sound.on = !params.has('mute') && !params.has('still');
sound.paused = paused;
addEventListener('pointerdown', () => sound.start(), true);
addEventListener('keydown', () => sound.start(), true);

// ---- the bar, the keys ----
const bar = document.getElementById('bar');
const info = document.getElementById('info');
const showInfo = () => {
  info.textContent = `seed ${seed} · ${outline.length === 5 ? 'pentagon' : 'hexagon'} · ${
    !sound.on ? 'silent' : sound.started ? 'sound' : 'click for sound'}`;
};
showInfo();
addEventListener('pointerdown', showInfo);
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (k === 'n') {
    params.set('seed', Math.floor(1 + Math.random() * 100000));
    location.search = params.toString();
  } else if (k === 'r') controls.autoRotate = !controls.autoRotate;
  else if (k === 'p') sound.paused = paused = !paused;
  else if (k === 's') sound.setOn(!sound.on);
  else if (k === 'h') bar.classList.toggle('hidden');
  else if (k === ' ') {
    e.preventDefault();
    letGo();
  }
  showInfo();
});
// a click anywhere (the bar too) lets it go: a press and release with the pointer barely
// moved (a drag orbits instead)
const press = { x: 0, y: 0, id: -1 };
addEventListener('pointerdown', (e) => {
  press.id = e.button === 0 && e.isPrimary ? e.pointerId : -1;
  press.x = e.clientX;
  press.y = e.clientY;
});
addEventListener('pointerup', (e) => {
  if (e.pointerId !== press.id) return;
  press.id = -1;
  if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 5) letGo();
});

const clock = new THREE.Clock();
let t = 0;
let shadowsDone = false;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!paused) t += dt;
  uniforms.uTime.value = t;
  controls.update(dt);
  // checked each frame, so it also strikes when the bolt comes under a still pointer
  updateStrike(dt);
  updateRelease(dt);
  updateGlide(dt);
  updateTurbulence(dt);
  debris.update(dt);
  // (in the dark between two bolts the clouds' light is baked faster, so the new one comes sooner)
  clouds.update(release && release.built && release.fadeAt < 0 ? 14 : 6);
  sound.update(dt, camera.position.distanceTo(controls.target));
  if (!shadowsDone) renderer.shadowMap.needsUpdate = shadowsDone = true;
  post.render(scene, camera);
});
