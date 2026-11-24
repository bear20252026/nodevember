// An orrery in the hall of an observatory, at night, as an engraved plate in
// a Voyages Extraordinaires: a brass machine whose sun is a lamp, the gears
// turning in its cage, the planets going round on their arms, their shadows
// sweeping the walls; above, through the iron dome, a ringed giant. And a
// meteorite and its fragments on their own tilted ellipse, threading between
// Earth and Mars and climbing high over the machine (its ellipse goes about
// the Sun; seen from another centre it loops like the planets' paths).
//   (default)    the geocentric machine, the Sun at the centre to begin with;
//                click on any body to put it at the centre instead (&centre=earth)
//                Ptolemy / Copernicus, under the plate, glide the centre to
//                the Earth or the Sun
//   &helio       the heliocentric machine (a different build, with &tilt)
//   &speed=1     how fast (an Earth year in 31.5 s at 1)
//   &plain       without the engraving (the plain render)
//   &still       the camera doesn't drift (Drift, or D, under the plate,
//                stops and starts it); &cam=x,y,z another viewpoint
//   &follow=mars the camera follows a body, going round it as it goes round.
//                A click on a body follows it; a click on it again, on nothing,
//                or Esc lets go (back to the middle of the machine).
//                Alt-click a body to put it at the centre (geocentric)
//   &pr=2        the pixel ratio (2 at most by default)
//   &t=10        start the machine that many seconds in
//   time         above the plate, Back / Pause / Forward (← Space →): the
//                machine runs backwards in time, stops, or forwards; asked
//                again, a way goes faster (2×, 4×, 8×), and it winds up and
//                down to its new pace rather than jumping
//   &comet=0.9   where the meteorite starts on its orbit (0 at perihelion)
//   &tilt        each orbit tilted its own way (T, or the switch below the
//                plate, goes between that and all in one plane)
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { setupRenderer, createEnvironment, createPost } from './look.js';
import { createOrrery, materials, PLANE_Y } from './orrery.js';
import { createRoom, ROOM_R, WALL_H } from './room.js';
import { createComet } from './comet.js';
import { createGeocentric, BODIES } from './geo.js';

const params = new URLSearchParams(location.search);
const speed = parseFloat(params.get('speed')) || 1;

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, parseFloat(params.get('pr')) || 2));
renderer.setSize(innerWidth, innerHeight);
setupRenderer(renderer);
document.getElementById('plate').prepend(renderer.domElement);

const scene = new THREE.Scene();
const env = createEnvironment(renderer);
const geo = !params.has('helio');
const centreName = params.get('centre') || params.get('center') || 'sun';
const orrery = geo ? createGeocentric(env, BODIES[centreName] ? centreName : 'sun') : createOrrery(env);
const room = createRoom(env, materials(env));
const comet = createComet(new THREE.Vector3(0, PLANE_Y, 0), params.has('comet') ? parseFloat(params.get('comet')) : undefined);
// the meteorite goes round the Sun; seen from another centre, its path is
// carried round on the Sun's motion about it
if (orrery.sunAt) comet.follow(orrery);
scene.add(room.group, orrery.group, comet.group);

// the switch under the plate, and T: the orbits tilt, in either machine
const tiltSwitch = document.getElementById('tilt');
{
  const setTilted = (on, instant) => {
    orrery.setTilted(on, instant);
    tiltSwitch.setAttribute('aria-pressed', on);
  };
  setTilted(params.has('tilt'), true);
  tiltSwitch.addEventListener('click', () => setTilted(!orrery.tilted));
  addEventListener('keydown', (e) => {
    if ((e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey) setTilted(!orrery.tilted);
  });
}

const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 200);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.5;
controls.maxDistance = 8;
controls.maxPolarAngle = 1.75; // a little from below: the machine towers
controls.rotateSpeed = 0.5;
controls.enablePan = false; // the eye moves about by following the bodies instead
// the drift: the eye going slowly round; switched off and on, it slows to a
// stop and gathers way again rather than jerking
const DRIFT = -0.35;
const drift = { on: !params.has('still') };
controls.autoRotate = true;
controls.autoRotateSpeed = drift.on ? DRIFT : 0;
{
  const sw = document.getElementById('drift');
  const setDrift = (on) => { drift.on = on; sw.setAttribute('aria-pressed', on); };
  setDrift(drift.on);
  sw.addEventListener('click', () => { sw.blur(); setDrift(!drift.on); });
  addEventListener('keydown', (e) => {
    if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) setDrift(!drift.on);
  });
}
function updateDrift(dt) {
  const to = drift.on ? DRIFT : 0;
  controls.autoRotateSpeed += (to - controls.autoRotateSpeed) * Math.min(1, dt * 2.5);
  if (Math.abs(to - controls.autoRotateSpeed) < 1e-3) controls.autoRotateSpeed = to;
}
// low, close, looking up past the machine at the sky
controls.target.set(0, PLANE_Y - 0.1, 0);
const cam = (params.get('cam') || '2.35,0.85,1.6').split(',').map(Number);
camera.position.set(...cam);
controls.update();

// ---- staying in the hall: the eye is kept a little off the floor, the walls
// and the glass of the dome; when it is pushed against them, what it looks at
// is pushed back with it, and that point itself stays over the floor, under
// the dome
const EYE_MARGIN = 0.45, FLOOR_EYE = 0.25;
const TARGET_R = ROOM_R - 2.2, TARGET_LO = 0.4, TARGET_HI = WALL_H + 4.5;
const domeC = new THREE.Vector3(0, WALL_H, 0);
const push = new THREE.Vector3(), v = new THREE.Vector3();
function inside(p, margin, floorY, out) {
  v.copy(p);
  if (v.y < floorY) v.y = floorY;
  const r = Math.hypot(v.x, v.z), rMax = ROOM_R - margin;
  if (r > rMax) { v.x *= rMax / r; v.z *= rMax / r; }
  if (v.y > WALL_H) {
    const d = v.distanceTo(domeC);
    if (d > rMax) v.sub(domeC).multiplyScalar(rMax / d).add(domeC);
  }
  return out.subVectors(v, p);
}
function keepInRoom() {
  const t = controls.target;
  const r = Math.hypot(t.x, t.z);
  if (r > TARGET_R) { t.x *= TARGET_R / r; t.z *= TARGET_R / r; }
  t.y = THREE.MathUtils.clamp(t.y, TARGET_LO, TARGET_HI);
  inside(camera.position, EYE_MARGIN, FLOOR_EYE, push);
  if (push.lengthSq() > 0) {
    camera.position.add(push);
    t.add(push);
    // the target is kept in its own bounds; the eye wins if they disagree
    const r2 = Math.hypot(t.x, t.z);
    if (r2 > TARGET_R) { t.x *= TARGET_R / r2; t.z *= TARGET_R / r2; }
    t.y = THREE.MathUtils.clamp(t.y, TARGET_LO, TARGET_HI);
  }
}
keepInRoom();

// ---- following a body: what the eye looks at glides to it and then rides with
// it, the eye carried along by the same motion (so it keeps going round with
// the drift), and comes in close; letting go glides back to the spindle
const GLIDE = 1.6; // seconds
const follow = { body: null, t: 1, from: new THREE.Vector3(), d0: 0, d1: 0 };
const fp = new THREE.Vector3(), nt = new THREE.Vector3(), off = new THREE.Vector3();
const findBody = (name) => orrery.picks.find((p) => p.name === name);
const labelOf = (name) => BODIES[name]?.label || name[0].toUpperCase() + name.slice(1);
const centreBody = () => (geo ? orrery.centre : 'sun');
// the centre of the machine, where the centre body always ends up: following
// this fixed point rather than the body, a change of centre is seen whole
const anchorObj = new THREE.Object3D();
anchorObj.position.set(0, PLANE_Y, 0);
anchorObj.updateMatrixWorld();
const ANCHOR = { name: null, obj: anchorObj, size: 0.27, anchor: true };
function glide(body, instant = false) {
  follow.body = body;
  follow.t = instant ? 0.9999 : 0;
  follow.from.copy(controls.target);
  follow.d0 = camera.position.distanceTo(controls.target);
  // close in on a planet; the body at the centre is seen with the machine round it
  follow.d1 = body.anchor
    ? THREE.MathUtils.clamp(follow.d0, 2.6, 4)
    : THREE.MathUtils.clamp(0.75 + body.size * 5, 0.95, 2.4);
  controls.minDistance = 0.4;
  showLabel();
}
const startFollow = (name, instant) => { const b = findBody(name); if (b && b !== follow.body) glide(b, instant); };
const followCentre = () => { if (follow.body !== ANCHOR) glide(ANCHOR); };
function updateFollow(dt) {
  if (!follow.body) return;
  follow.t = Math.min(1, follow.t + dt / GLIDE);
  const k = follow.t * follow.t * (3 - 2 * follow.t);
  follow.body.obj.getWorldPosition(fp);
  nt.lerpVectors(follow.from, fp, k);
  camera.position.add(off.subVectors(nt, controls.target));
  controls.target.copy(nt);
  if (follow.t < 1) {
    off.subVectors(camera.position, nt);
    off.setLength(THREE.MathUtils.lerp(follow.d0, follow.d1, k));
    camera.position.copy(nt).add(off);
  }
}
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !e.metaKey && !e.ctrlKey) followCentre();
});

// ---- the label under the plate: the centre (geocentric) and who is followed;
// and the two systems under it, Ptolemy's Earth and Copernicus' Sun, the one
// in use marked
const label = document.getElementById('centre');
const systems = { earth: document.getElementById('ptolemy'), sun: document.getElementById('copernicus') };
function showLabel() {
  const parts = [];
  if (geo) {
    parts.push('the heavens, seen from ' + BODIES[orrery.centre].label);
    for (const [name, b] of Object.entries(systems)) b.setAttribute('aria-pressed', orrery.centre === name);
  }
  const f = follow.body?.name;
  if (f && f !== centreBody()) parts.push('following ' + labelOf(f) + ' (click it again to let go)');
  label.textContent = parts.join(' — ');
}
showLabel();
if (params.get('follow')) startFollow(params.get('follow'), true);

// ---- clicks (a click, not a drag): on a body, follow it; on the body already
// followed or on nothing, let go (follow the middle of the machine); with alt,
// on a body, put it at the centre (geocentric), whatever is followed
{
  const el = renderer.domElement;
  const at = (e) => { const r = el.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, r.width, r.height]; };
  let down = null;
  const setCentre = (name) => {
    if (!geo || !orrery.setCentre(name)) return;
    showLabel();
    const q = new URLSearchParams(location.search);
    q.set('centre', name);
    history.replaceState(null, '', '?' + q.toString().replace(/=(&|$)/g, '$1'));
  };
  // while a body is followed the eye rides with it and the others sweep across
  // the view, fast when it is close: the body is looked for where it was when
  // the button went down (then where it is when it comes up), with more slack
  const pickAt = (e) => {
    const [x, y, w, h] = at(e);
    return orrery.pick(x, y, camera, w, h, follow.body && !follow.body.anchor ? 12 : 0);
  };
  el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY, pickAt(e)]; });
  el.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
    const name = down[2] || pickAt(e);
    down = null;
    if (e.altKey) { if (name) setCentre(name); return; }
    if (!name || follow.body?.name === name) { if (follow.body) followCentre(); return; }
    startFollow(name);
  });
  el.addEventListener('pointermove', (e) => {
    if (e.buttons) return;
    el.style.cursor = pickAt(e) ? 'pointer' : '';
  });
  // the systems under the plate glide the centre to the Earth or the Sun
  if (geo) for (const [name, b] of Object.entries(systems)) b.addEventListener('click', () => setCentre(name));
}
if (!geo) {
  // the heliocentric build has no centre to move: its switch leads back
  // to the geocentric machine, the Earth in the middle
  document.getElementById('copernicus').hidden = true;
  document.querySelector('#system span').hidden = true;
  const b = document.getElementById('ptolemy');
  b.addEventListener('click', () => {
    const q = new URLSearchParams(location.search);
    q.delete('helio'); q.delete('tilt'); q.set('centre', 'earth');
    location.search = q.toString().replace(/=(&|$)/g, '$1');
  });
}

const fx = createPost(renderer, scene, camera);
fx.amount = params.has('plain') ? 0 : 1;

function resize() {
  const el = renderer.domElement.parentElement;
  const w = el.clientWidth, h = el.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  fx.resize();
  // the comet's dust: world size → pixels
  comet.setScale(renderer.getDrawingBufferSize(new THREE.Vector2()).y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))));
}
addEventListener('resize', resize);
resize();

// ---- time: the machine runs forwards, backwards or not at all, `pace` times
// its speed; `rate` follows `pace` smoothly, the works winding up and down.
// The lamp's flame, the room and the camera keep the real time.
const clockwork = { dir: 1, mult: 1, held: 1, rate: 1 };
{
  const btn = { [-1]: document.getElementById('backward'), 0: document.getElementById('pause'), 1: document.getElementById('forward') };
  const words = { [-1]: '◂ Back', 1: 'Forward ▸' };
  const show = () => {
    for (const d of [-1, 0, 1]) btn[d].setAttribute('aria-pressed', clockwork.dir === d);
    for (const d of [-1, 1]) btn[d].textContent = words[d] + (clockwork.dir === d && clockwork.mult > 1 ? ' ×' + clockwork.mult : '');
  };
  // a way asked for again goes faster; the other way, or after a pause, starts at 1×
  const go = (d) => {
    if (d === clockwork.dir) clockwork.mult = clockwork.mult >= 8 ? 1 : clockwork.mult * 2;
    else { clockwork.dir = d; clockwork.mult = 1; clockwork.held = d; }
    show();
  };
  const pause = () => {
    if (clockwork.dir) { clockwork.held = clockwork.dir; clockwork.dir = 0; }
    else { clockwork.dir = clockwork.held; clockwork.mult = 1; }
    show();
  };
  // (the buttons don't keep the focus, or Space would press them as well)
  btn[-1].addEventListener('click', (e) => { e.currentTarget.blur(); go(-1); });
  btn[1].addEventListener('click', (e) => { e.currentTarget.blur(); go(1); });
  btn[0].addEventListener('click', (e) => { e.currentTarget.blur(); pause(); });
  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (!e.repeat) pause(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); if (!e.repeat) go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); if (!e.repeat) go(1); }
  });
  show();
}
const yearOut = document.getElementById('year');
let shownYear = null;
function showYear() {
  // the years since the start, counted in Earth's turns round the Sun
  const y = Math.round(orrery.years * 10) / 10;
  if (y === shownYear) return;
  shownYear = y;
  yearOut.textContent = 'year ' + (y < 0 ? '−' : '') + Math.abs(y).toFixed(1);
}

// ---- the loop
const clock = new THREE.Clock();
let time = 0;
const t0 = parseFloat(params.get('t')) || 0;
if (t0) orrery.update(t0, speed, t0);
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;
  const pace = clockwork.dir * clockwork.mult;
  clockwork.rate += (pace - clockwork.rate) * Math.min(1, dt * 3);
  if (Math.abs(pace - clockwork.rate) < 1e-3) clockwork.rate = pace;
  const sp = speed * clockwork.rate;
  orrery.update(dt, sp, time);
  // the meteorite still burns going backwards; stopped, its fire hangs still
  comet.update(orrery.years, Math.abs(dt * sp), time);
  showYear();
  room.update(dt, time);
  updateFollow(dt);
  updateDrift(dt);
  controls.update(dt);
  keepInRoom();
  fx.render(time);
});
