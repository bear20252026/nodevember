import * as THREE from 'three';
import { LIGHTS } from './common.js';
import { KeyShadow } from './shadow.js';
import { stage } from './stage.js';
import { Creature } from './creature.js';
import { Coat, PALETTES } from './coat.js';
import { plumage, namedPlumage } from './plumage.js';
import { Post } from './post.js';
import { Sound } from './sound.js';

// A small creature, a ball of feathers on two legs with two big eyes. Pick it up and
// shake it: its feathers work loose and fly off, drift down and settle on the floor, until
// it stands there naked, skinny and shivering. Left alone a while, it recovers, POOF:
// the fallen feathers gone but a few flung off, the missing ones back at once in a puff
// of down; plucked bare, a new coat altogether, another bird's. R now, M a molt.
//
// A different bird at every visit: its colours are drawn from the seed (plumage.js);
// `another bird` (N) draws a new one, ?seed= keeps one, ?palette= wears a named palette.
//
// The feathers are drawn in feather.js, laid out, held, shed and flown in coat.js, the
// creature under them is creature.js. The pointer passed over it strokes its feathers,
// parting and ruffling them (coat.js).

const params = new URLSearchParams(location.search);
const num = (key, def) => (params.has(key) && !isNaN(parseFloat(params.get(key))) ? parseFloat(params.get(key)) : def);

let seed = params.has('seed') ? parseInt(params.get('seed')) >>> 0 : Math.floor(Math.random() * 1e6);
let palette = PALETTES[params.get('palette')] ? params.get('palette') : null;
const bird = () => (palette ? namedPlumage(PALETTES[palette]) : plumage(seed));
let look = bird();
const still = params.has('still');

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
const pr = num('pr', Math.min(devicePixelRatio, 2));
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
renderer.autoClear = true;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.05, 200);
stage(scene);
const shadow = new KeyShadow(renderer);
const post = new Post(renderer);

const creature = new Creature(scene, { skin: look.skin });
// its sounds (sound.js): on from the first click or key, `&mute` starts silent, S toggles;
// `&voice=0` keeps the creature itself quiet (its coos)
const sound = new Sound();
sound.on = !params.has('mute') && !still;
sound.voice = params.get('voice') !== '0';
addEventListener('pointerdown', () => sound.start(), true);
addEventListener('keydown', () => sound.start(), true);
creature.still = still;
let coat;
// old coats poofed away by a molt, gone once the last of their flung feathers is
const leaving = [];
// `molt`: the old coat poofs away and the new one pops out of the skin
function makeCoat(molt = false) {
  if (coat && molt) {
    coat.poof({ molt: true, fly: 40 });
    leaving.push(coat);
  } else if (coat) {
    scene.remove(coat.mesh);
    coat.feathers.dispose();
  }
  look = bird();
  // its types of feathers: drawn from the seed, or set by &primary= &secondary= &display=
  // (proud, aggressive, cute), &area= (front, cape, flanks, belly), &site= (tail, brows,
  // crest, joined by +, or none), &shape= (racket, curl, wisp, sickle, ribbon, coil)
  const looks = Object.fromEntries(['primary', 'secondary', 'display', 'area', 'site', 'shape'].map((k) => [k, params.get(k)]));
  coat = new Coat(creature, { seed, plumage: look, contour: num('feathers', 1300), down: num('down', 1300), face: num('face', 3000), looks, bare: molt });
  scene.add(coat.mesh);
  tintSkin(1);
  if (molt) { pop(); sound.poof(true); }
  if (window.__feather) window.__feather.coat = coat;
}
// POOF: the missing feathers back at once (full size, not grown) in a puff of
// down, the fallen ones gone but a few flung off; the bird bouncing
function poof() {
  coat.poof();
  pop();
  sound.poof();
}
// (straight back to the ball: no drawing in of the bare bird, its shape snapped to the
// coat's and held there a moment)
let popHold = 0;
function pop() {
  creature.morph = 0;
  creature.morphV = 0;
  popHold = 0.6;
  coat.regrow();
  coat.puff();
  creature.sqV += 4.5;
  recovery.calm = 0;
}
// the skin and the irises take the bird's colours
function tintSkin(k) {
  creature.setIris(look.iris);
  creature.skinMesh.material.uniforms.uColor.value.lerp(look.skin, k);
}
makeCoat();
if (params.has('shed')) {
  // posed on the body first, then let go
  creature.update(1 / 60);
  coat.update(1 / 60);
  coat.shed(num('shed', 0.5));
}

// ---- the view: turned round by dragging the room, zoomed with the wheel
const view = { az: num('az', 0), el: num('el', 0.2), dist: num('dist', 6.4), target: new THREE.Vector3(0, 0.95, 0) };
function placeCamera(dt) {
  // the view always turns round the bird, wherever it has gone, so zooming heads for it,
  // never for the empty middle of the room; close up the eye also takes its height. While
  // it is held the centre only follows it close up, as before (from afar the camera would
  // chase the hand dragging it), and catches up once it is let go, gently from afar
  const follow = THREE.MathUtils.smoothstep(view.dist, 5.5, 2.5);
  const want = pointer.dragging
    ? view.target.clone().lerp(creature.pos, follow)
    : new THREE.Vector3(creature.pos.x, THREE.MathUtils.lerp(0.95, creature.pos.y, follow), creature.pos.z);
  view.target.lerp(want, 1 - Math.exp(-dt * THREE.MathUtils.lerp(1.5, 4, follow)));
  camera.position.set(Math.sin(view.az) * Math.cos(view.el), Math.sin(view.el), Math.cos(view.az) * Math.cos(view.el)).multiplyScalar(view.dist).add(view.target);
  camera.lookAt(view.target);
  camera.updateMatrixWorld();
}

// ---- the pointer
const ndc = new THREE.Vector2(), lastNdc = new THREE.Vector2();
const ray = new THREE.Raycaster();
const pointer = { in: false, dragging: null, orbit: null, moved: 0 };
const windPointer = { origin: new THREE.Vector3(), dir: new THREE.Vector3(), vel: new THREE.Vector3(), speed: 0 };
const hint = document.getElementById('hint');

function setNdc(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
}
function pointAtDepth(depth, out) {
  ray.setFromCamera(ndc, camera);
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const t = depth / Math.max(ray.ray.direction.dot(fwd), 1e-3);
  return out.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
}
// the body, and once it has one, the head on its neck
function hitsCreature() {
  ray.setFromCamera(ndc, camera);
  const spheres = [new THREE.Sphere(creature.pos, creature.radius * 1.05 + 0.05)];
  const m = THREE.MathUtils.clamp(creature.morph, 0, 1);
  if (m > 0.3) {
    const head = creature.head.clone().multiply(creature.scale).applyQuaternion(creature.quat).add(creature.pos);
    spheres.push(new THREE.Sphere(head, 0.26 * m));
    // and the neck between
    spheres.push(new THREE.Sphere(head.clone().lerp(creature.pos, 0.5), 0.16 * m));
  }
  for (const s of spheres) if (ray.ray.intersectsSphere(s)) return ray.ray.intersectSphere(s, new THREE.Vector3());
  return null;
}

const el = renderer.domElement;
el.addEventListener('pointerdown', (e) => {
  setNdc(e);
  lastNdc.copy(ndc);
  pointer.in = true;
  el.setPointerCapture(e.pointerId);
  const hit = hitsCreature();
  if (hit) {
    const fwd = camera.getWorldDirection(new THREE.Vector3());
    const depth = creature.pos.clone().sub(camera.position).dot(fwd);
    const at = pointAtDepth(depth, new THREE.Vector3());
    pointer.dragging = { depth, offset: creature.pos.clone().sub(at) };
    creature.grab = { target: creature.pos.clone() };
    el.style.cursor = 'grabbing';
    hint.style.opacity = 0;
  } else {
    pointer.orbit = { x: e.clientX, y: e.clientY, az: view.az, el: view.el };
  }
});
el.addEventListener('pointermove', (e) => {
  setNdc(e);
  pointer.in = true;
  if (pointer.orbit) {
    view.az = pointer.orbit.az - (e.clientX - pointer.orbit.x) * 0.006;
    view.el = THREE.MathUtils.clamp(pointer.orbit.el + (e.clientY - pointer.orbit.y) * 0.004, 0.02, 1.2);
  } else if (!pointer.dragging) {
    el.style.cursor = hitsCreature() ? 'grab' : '';
  }
});
const up = (e) => {
  if (pointer.dragging) {
    pointer.dragging = null;
    creature.grab = null;
  }
  pointer.orbit = null;
  el.style.cursor = '';
  if (e.pointerType !== 'mouse') pointer.in = false;
};
el.addEventListener('pointerup', up);
el.addEventListener('pointercancel', up);
el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointer.dragging) pointer.in = false; });
el.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.dist = THREE.MathUtils.clamp(view.dist * Math.exp(e.deltaY * 0.0012), 1.3, 12);
}, { passive: false });

// ---- the bar
const bar = document.getElementById('bar');
function buildBar() {
  bar.innerHTML = '';
  const another = document.createElement('button');
  another.textContent = 'another bird';
  another.title = palette ? palette : `bird ${seed} (${look.scheme}${look.plain ? ', plain' : ''}) — ?seed=${seed} keeps it`;
  another.onclick = () => anotherBird();
  bar.append(another);
  const sep = document.createElement('span');
  sep.className = 'sep';
  sep.textContent = '·';
  const regrow = document.createElement('button');
  regrow.textContent = 'grow back';
  regrow.onclick = poof;
  const moltB = document.createElement('button');
  moltB.textContent = 'molt';
  moltB.title = 'POOF, the whole coat for another bird\'s (M); left alone, a plucked bird does it by itself';
  const count = document.createElement('span');
  count.className = 'count';
  // this bird's types of feathers
  const looks = document.createElement('span');
  looks.className = 'looks';
  const l = coat.looks;
  const shows = l.sites.map((st) => `${l.shapes[st]} ${st}`).join(', ');
  looks.textContent = `${l.primary}, ${l.secondary} ${l.area}${shows ? `, ${l.display} ${shows}` : ''}`;
  looks.title = 'main type, secondary type and where, display feathers (their character, their shape and where)';
  const sep2 = sep.cloneNode(true);
  moltB.onclick = molt;
  const sep3 = sep.cloneNode(true);
  const snd = document.createElement('button');
  const showSound = () => { snd.textContent = sound.on ? 'sound' : 'silent'; snd.setAttribute('aria-pressed', sound.on); };
  snd.title = 'the creature\'s sounds on or off (S)';
  snd.onclick = () => { sound.start(); sound.setOn(!sound.on); showSound(); };
  showSound();
  bar.append(sep, regrow, moltB, count, sep2, looks, sep3, snd);
  bar.showSound = showSound;
  bar.count = count;
}
function anotherBird(molting = false) {
  palette = null;
  seed = Math.floor(Math.random() * 1e6);
  // the address keeps nothing: a refresh is another bird too
  params.delete('palette');
  params.delete('seed');
  history.replaceState(null, '', params.size ? `?${params}` : location.pathname);
  makeCoat(molting);
  buildBar();
}
// a new coat, another bird's, grown as the old one flies off
function molt() {
  anotherBird(true);
}

// ---- recovery: left alone a while (`&rest=` s since it was let go, `&recover=0` never),
// POOF, its feathers back; plucked bare (less than `&renew=` of its coat left), it molts
// into another bird
const recovery = { on: params.get('recover') !== '0', rest: num('rest', 7), renew: num('renew', 0.3), calm: 0 };
function recover(dt) {
  recovery.calm = creature.grab ? 0 : recovery.calm + dt;
  // (a poof's own flung feathers are gone in a second or two)
  if (!recovery.on || recovery.calm < recovery.rest || (coat.recovering() && recovery.calm < recovery.rest + 3)) return;
  if (coat.attachedCount() === coat.n) return;
  if (creature.coverage < recovery.renew) molt();
  else poof();
}
buildBar();
addEventListener('keydown', (e) => {
  if (e.key === 'r') poof();
  if (e.key === 'h') bar.classList.toggle('hidden');
  if (e.key === 'n') anotherBird();
  if (e.key === 'm') molt();
  if (e.key === 's') { sound.setOn(!sound.on); bar.showSound(); }
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
}
addEventListener('resize', resize);
resize();

// ---- the loop
const clock = new THREE.Clock();
let time = 0;
const fwd = new THREE.Vector3();
let lastCount = -1;
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  time += dt;
  placeCamera(dt);

  // the pointer: where it holds the creature, where it looks, the air it sweeps
  camera.getWorldDirection(fwd);
  if (pointer.dragging) {
    pointAtDepth(pointer.dragging.depth, creature.grab.target).add(pointer.dragging.offset);
    // pressed down, it stands on its feet: never lower than its standing height
    creature.grab.target.y = Math.max(creature.grab.target.y, creature.standH);
  }
  if (pointer.in) {
    const depth = creature.pos.clone().sub(camera.position).dot(fwd);
    pointAtDepth(depth + 1.5, creature.lookAt);
  } else creature.lookAt.lerp(camera.position, 1 - Math.exp(-dt * 2));
  ray.setFromCamera(ndc, camera);
  windPointer.origin.copy(ray.ray.origin);
  windPointer.dir.copy(ray.ray.direction);
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  const upv = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const dx = (ndc.x - lastNdc.x) * t * camera.aspect, dy = (ndc.y - lastNdc.y) * t;
  const v = right.multiplyScalar(dx / Math.max(dt, 1e-3)).addScaledVector(upv, dy / Math.max(dt, 1e-3));
  windPointer.vel.lerp(v, 0.5);
  windPointer.speed = pointer.in && !pointer.orbit ? windPointer.vel.length() : 0;
  lastNdc.copy(ndc);
  coat.wind.pointer = windPointer;
  // and passed over the coat without holding it, it strokes the feathers
  coat.stroke(pointer.in && !pointer.dragging && !pointer.orbit ? ray.ray : null, dt);

  popHold -= dt;
  creature.coverage = popHold > 0 ? 1 : coat.coverage();
  creature.update(dt);
  coat.update(dt);
  for (const old of leaving) {
    old.wind.pointer = windPointer;
    old.update(dt);
  }
  for (let k = leaving.length - 1; k >= 0; k--) {
    if (!leaving[k].empty()) continue;
    scene.remove(leaving[k].mesh);
    leaving[k].feathers.dispose();
    leaving.splice(k, 1);
  }
  recover(dt);
  sound.update(dt, creature, coat, camera);
  // a rouse shakes out a loose feather now and then
  if (creature.rouseT > 0.3 && creature.rouseT < 0.32 && Math.random() < 0.7) {
    const s = coat.s;
    for (let k = 0; k < 3; k++) {
      const i = Math.floor(Math.random() * coat.max);
      if (s.mode[i] === 1 && s.grow[i] >= 1) { coat.release(i, 0.6); break; }
    }
  }

  LIGHTS.uBody.value.set(creature.pos.x, creature.pos.y - 0.15 * THREE.MathUtils.clamp(creature.morph, 0, 1), creature.pos.z, THREE.MathUtils.lerp(0.49, 0.3, THREE.MathUtils.clamp(creature.morph, 0, 1)));
  LIGHTS.uCoverage.value = creature.coverage;
  LIGHTS.uTime.value = time;

  const n = coat.attachedCount();
  if (n !== lastCount) {
    bar.count.textContent = n ? `${n.toLocaleString('en')} feathers on` : 'not a feather left';
    lastCount = n;
  }

  shadow.render(scene);
  renderer.setRenderTarget(post.target);
  renderer.render(scene, camera);
  post.render(time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// for the tests: shake it from the console, `shake(3)` seconds
window.__feather = { creature, coat, view, camera, leaving, recover, recovery, sound };
