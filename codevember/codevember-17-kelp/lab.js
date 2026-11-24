// The kelp lab (?lab): the kinds of kelp the piece can grow, side by side on the same sea
// floor, in the same water, drawn by the same code (styles.js, kelp.js), each grown up from
// the sand in turn and named under its holdfast. Click a kind's name (or 1–7) to see three
// of it at once, how much one plant of a kind differs from the next; 0 (or click again)
// back to all of them. Clicking a plant grows another in its place.
//   ?lab&seed=n   the shapes grown (the seed is in the bar)
//   &kind=bull    start on that kind (giant, bull, sugar, boa, strap, lace, wrack)
//   &current=1    how hard the surge pushes (0: still water)
//   &pr=2         a fixed pixel ratio
//   &t=8          start that many seconds in (all grown)
// Keys: 1–7 a kind, 0 all, r grow them all again, space pause, h hide the names.
import * as THREE from 'three';
import { sharedUniforms, createBackground, createFloor, createSnow, hitFloor } from './water.js';
import { Plant } from './kelp.js';
import { createPost } from './post.js';
import { STYLES, STYLE_KEYS } from './styles.js';
import { createStir, stirSnow } from './stir.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
let seed = Math.floor(num('seed', Math.floor(Math.random() * 1e5)));
const CURRENT = num('current', 1);

function rngOf(s) {
  let a = s >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// what the lab says of each kind, and the stroke it is grown along: its length (1 = 1% of
// the screen's height), its lean and how much it bends, how fast it is drawn
const KINDS = {
  giant: {
    name: 'giant kelp', latin: 'Macrocystis pyrifera',
    about: 'a glossy orange stipe, a blade on its own gas float at every node, a scimitar at the tip',
    L: 52, lean: 0.06, bendA: 5, speed: 26,
  },
  bull: {
    name: 'bull kelp', latin: 'Nereocystis luetkeana',
    about: 'a whip of a stipe swelling into one big float, a mane of long ribbons streaming off it',
    L: 38, lean: 0.04, bendA: 4, speed: 24,
  },
  sugar: {
    name: 'sugar kelp', latin: 'Saccharina latissima',
    about: 'a short stalk and one long, broad blade, blistered down its middle, frilled along its edges',
    L: 40, lean: 0.1, bendA: 6, speed: 18,
  },
  boa: {
    name: 'feather boa', latin: 'Egregia menziesii',
    about: 'a flat strap fringed all along with little blades and, here and there, a float',
    L: 50, lean: 0.08, bendA: 7, speed: 22,
  },
  strap: {
    name: 'strap kelp', latin: 'after Lessonia',
    about: 'a dark, supple stipe bearing only a few blades, far apart: long, broad, wavy-edged straps, limp as ribbons, streaming slowly each its own way',
    L: 46, lean: 0.06, bendA: 5, speed: 22,
  },
  lace: {
    name: 'sea lace', latin: 'Chorda filum',
    about: 'a tangle of long, thin, round cords, some pale, some dark, meandering and swerving in open S-curves, their tips hooked over, now and then into a small spiral',
    L: 44, lean: 0.05, bendA: 6, speed: 20,
  },
  wrack: {
    name: 'knotted wrack', latin: 'Ascophyllum nodosum',
    about: 'olive-gold cords swelling every so often into an egg-shaped bladder, forking just past them, short shoots tipped with yellow pods',
    L: 40, lean: 0.06, bendA: 5, speed: 18,
  },
};

// ---- renderer, camera: as in the piece (main.js), the horizon lowered by a lens shift
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }) // multisampled in post.js;
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 2)));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const FOV = 50, SHIFT = 0.24;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 3.0, 12);
camera.updateMatrixWorld();

const scene = new THREE.Scene();
scene.add(createBackground(camera));
let floor = createFloor(seed);
scene.add(floor);
const snow = createSnow();
scene.add(snow);
const post = createPost(renderer, scene, camera);

function fit() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] = SHIFT;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  renderer.setSize(innerWidth, innerHeight);
  snow.material.uniforms.uPx.value = renderer.getPixelRatio() * innerHeight / 800 * 6;
  post.setSize(innerWidth, innerHeight);
}
fit();

// ---- the water's motion: the surge and the pointer's wake (as in main.js; stir.js)
const stir = createStir();
let clock = 0;
function flow(x, y, t, out) {
  out.x = CURRENT * (0.5 * Math.sin(t * 0.42 + x * 0.017) + 0.28 * Math.sin(t * 0.93 + x * 0.045 - y * 0.03 + 1.7) + 0.18);
  out.y = CURRENT * 0.12 * Math.sin(t * 0.7 + x * 0.04 + y * 0.02);
  out.stir = 0;
  stir.field(x, y, t, out);
}

const toScreen = (cx, cy) => ({ x: (cx / innerHeight) * 100, y: ((innerHeight - cy) / innerHeight) * 100 });
const U = (d) => (2 * d * Math.tan((FOV * Math.PI) / 360)) / 100;

// ---- the names, a card under each plant
const style = document.createElement('style');
style.textContent = `
  #bar { display: none; }
  canvas { cursor: pointer; }
  #lab { position: fixed; left: 0; right: 0; bottom: 34px; height: 0; pointer-events: none; transition: opacity 0.4s; }
  #lab.hidden { opacity: 0; }
  #lab .card { position: absolute; bottom: 0; transform: translateX(-50%); max-width: 240px; min-width: 110px;
    text-align: center; pointer-events: auto; cursor: pointer; padding: 8px 6px 6px; border-radius: 6px;
    text-shadow: 0 0 8px #000a, 0 0 2px #0008; transition: background 0.3s, opacity 0.6s; opacity: 0; }
  #lab .card.in { opacity: 1; }
  #lab .card:hover { background: #06233055; }
  #lab .name { font-size: 15px; letter-spacing: 0.06em; color: #eef7f2; }
  #lab .latin { font-style: italic; opacity: 0.8; margin: 1px 0 5px; }
  #lab .about { opacity: 0.7; line-height: 1.35; }
  #lab .draw { display: inline-block; margin-top: 5px; color: #cfe6e4; opacity: 0.55; text-decoration: underline; text-underline-offset: 3px; }
  #lab .draw:hover { opacity: 1; }
  #labbar { position: fixed; left: 0; right: 0; bottom: 0; height: 34px; display: flex; align-items: center; gap: 16px;
    padding: 0 14px; letter-spacing: 0.04em; user-select: none; text-shadow: 0 0 6px #0008; transition: opacity 0.4s; }
  #labbar.hidden { opacity: 0; pointer-events: none; }
  #labinfo { margin-right: auto; opacity: 0.75; }
  #labkinds { display: flex; gap: 10px; }
  #labkinds span { cursor: pointer; opacity: 0.5; }
  #labkinds span.on { opacity: 1; text-decoration: underline; text-underline-offset: 3px; }
  #labkeys { opacity: 0.5; }
  #labtitle { position: fixed; left: 0; right: 0; top: 18px; text-align: center; font-size: 13px; letter-spacing: 0.3em;
    text-transform: uppercase; opacity: 0.7; pointer-events: none; text-shadow: 0 0 10px #0009; transition: opacity 0.4s; }
  #labtitle.hidden { opacity: 0; }
  @media (max-width: 900px) { #lab .about { display: none; } #labkeys { display: none; } }
`;
document.head.append(style);
const lab = Object.assign(document.createElement('div'), { id: 'lab' });
const title = Object.assign(document.createElement('div'), { id: 'labtitle' });
const bar = Object.assign(document.createElement('div'), { id: 'labbar' });
bar.innerHTML = '<span id="labinfo"></span><span id="labkinds"></span><span id="labkeys">r grow again · space pause · h hide</span>';
document.body.append(title, lab, bar);
const info = bar.querySelector('#labinfo');
const kindsEl = bar.querySelector('#labkinds');
['all', ...STYLE_KEYS].forEach((k, i) => {
  const el = document.createElement('span');
  el.dataset.k = k;
  el.textContent = `${i} ${k === 'all' ? 'all' : KINDS[k]?.name ?? STYLES[k].label}`;
  el.addEventListener('click', () => show(k));
  kindsEl.append(el);
});

// ---- the specimens: one of each kind, or three of one
let view = STYLE_KEYS.includes(params.get('kind')) ? params.get('kind') : 'all';
let specimens = [];
let generation = 0;
const ROOT_Y = 21; // where the roots are, % of the screen's height from its bottom

function grow(spec, delay) {
  if (spec.plant) remove(spec.plant);
  const k = spec.key;
  const kind = KINDS[k] ?? { L: 45, lean: 0, bendA: 4, speed: 20 };
  const rand = rngOf(seed * 131 + spec.slot * 7919 + (spec.gen++) * 104729 + 1);
  const cx = spec.x * innerWidth;
  const cy = innerHeight * (1 - ROOT_Y / 100);
  const ndc = new THREE.Vector3((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const origin = hitFloor(camera.position, dir) ?? camera.position.clone().addScaledVector(dir, 14 / -dir.z);
  const p = new Plant({
    style: STYLES[k], origin, U: U(camera.position.z - origin.z), screen: toScreen(cx, cy),
    anchored: true, rand: rngOf(Math.floor(rand() * 1e9)), time: clock + delay,
  });
  // the stroke: up from the sand, leaning a little and curving, a bit longer or shorter
  // than the kind's usual, never past the top of the column it stands in
  const L = Math.min(84 - ROOT_Y, kind.L * (0.88 + rand() * 0.24) * spec.scale);
  const lean = kind.lean * (spec.x < 0.5 ? 1 : -1) + (rand() - 0.5) * 0.1; // leaning in, toward the middle
  const bendA = kind.bendA * (0.6 + rand() * 0.8) * (rand() < 0.5 ? -1 : 1), ph = rand() * 6;
  spec.path = (s) => {
    const u = s / L;
    return [Math.sin(lean) * s + bendA * Math.sin(u * 2.4 + ph) - bendA * Math.sin(ph), Math.cos(lean) * s];
  };
  spec.L = L; spec.s = 0; spec.speed = kind.speed; spec.start = clock + delay;
  spec.plant = p;
  spec.root = origin;
  scene.add(p.mesh);
  clearRocks();
  p.mesh.visible = false;
}

// the floor's rocks in front of a root (or on it) are taken away, so each plant is seen
// whole from its holdfast up
function clearRocks() {
  for (const rock of floor.children.slice(1)) {
    const g = rock.geometry;
    if (!g.boundingSphere) g.computeBoundingSphere();
    const { center: c, radius: r } = g.boundingSphere;
    rock.visible = !specimens.some((s) => s.root && c.z + r > s.root.z - 1.5 && Math.abs(c.x - s.root.x) < r + 1.2);
  }
}

function remove(p) {
  scene.remove(p.mesh);
  p.dispose();
}

function show(k) {
  view = k;
  for (const el of kindsEl.children) el.classList.toggle('on', el.dataset.k === k);
  for (const s of specimens) if (s.plant) remove(s.plant);
  lab.replaceChildren();
  generation++;
  const keys = k === 'all' ? STYLE_KEYS : [k, k, k];
  const n = keys.length;
  specimens = keys.map((key, i) => {
    const spec = { key, slot: k === 'all' ? i : 10 + STYLE_KEYS.indexOf(k) * 3 + i, gen: 0, x: 0.07 + (0.86 * (i + 0.5)) / n, scale: 1, plant: null };
    spec.card = card(key, spec, k !== 'all' && i !== 1);
    return spec;
  });
  specimens.forEach((s, i) => grow(s, 0.3 + i * 0.45));
  title.textContent = k === 'all' ? `kelp lab · ${STYLE_KEYS.length} kinds` : `kelp lab · ${KINDS[k]?.name ?? k} · three of a kind`;
  layout();
}

function card(key, spec, quiet) {
  const kind = KINDS[key] ?? { name: STYLES[key].label, latin: '', about: '' };
  const el = document.createElement('div');
  el.className = 'card';
  if (quiet) {
    el.innerHTML = `<div class="latin">${kind.latin}</div>`;
    el.title = 'grow another';
    el.addEventListener('click', () => grow(spec, 0));
  } else {
    el.innerHTML = `<div class="name">${kind.name}</div><div class="latin">${kind.latin}</div>` +
      `<div class="about">${kind.about}</div><a class="draw" href="?style=${key}">draw it</a>`;
    el.title = view === 'all' ? 'three of this kind' : 'back to all the kinds';
    el.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      show(view === 'all' ? key : 'all');
    });
  }
  lab.append(el);
  spec.card = el;
  return el;
}

function layout() {
  // as wide as the column each plant stands in, no wider
  const w = Math.min(18, 86 / specimens.length - 1.5);
  for (const s of specimens) { s.card.style.left = `${s.x * 100}%`; s.card.style.width = `${w}vw`; }
}

// ---- input: the pointer stirs the water; a click on a plant grows another in its place
const canvas = renderer.domElement;
let last = null;
canvas.addEventListener('pointermove', (e) => {
  const s = toScreen(e.clientX, e.clientY);
  const now = performance.now();
  if (last && now > last.t) {
    const dt = (now - last.t) / 1000;
    const vx = (s.x - last.x) / dt, vy = (s.y - last.y) / dt;
    stir.move(s.x, s.y, vx, vy, clock, now);
  }
  last = { x: s.x, y: s.y, t: now };
});
canvas.addEventListener('click', (e) => {
  const n = specimens.length;
  const spec = specimens[Math.min(n - 1, Math.floor((e.clientX / innerWidth) * n))];
  if (spec) grow(spec, 0);
});

let playing = true;
addEventListener('keydown', (e) => {
  if (e.key === ' ') { playing = !playing; e.preventDefault(); }
  else if (e.key === 'h') for (const el of [lab, bar, title]) el.classList.toggle('hidden');
  else if (e.key === 'r') specimens.forEach((s, i) => grow(s, i * 0.3));
  else if (e.key === '0') show('all');
  else if (/^[1-9]$/.test(e.key) && STYLE_KEYS[+e.key - 1]) show(STYLE_KEYS[+e.key - 1]);
});

let resizing = 0;
addEventListener('resize', () => {
  fit();
  layout();
  clearTimeout(resizing);
  resizing = setTimeout(() => specimens.forEach((s, i) => grow(s, i * 0.15)), 250); // re-rooted for the new frame
});

show(view);

// ---- the loop: each plant drawn up its stroke, then let go into the surge
function step(dt) {
  clock += dt;
  stir.prune(clock);
  stirSnow(snow, stir, camera, dt, clock);
  for (const s of specimens) {
    const p = s.plant;
    if (!p) continue;
    if (p.drawing) {
      if (clock < s.start) continue;
      p.mesh.visible = true;
      s.card.classList.add('in');
      const to = Math.min(s.L, s.s + s.speed * dt);
      for (; s.s < to; s.s = Math.min(to, s.s + 0.5)) {
        const [x, y] = s.path(s.s + 0.5);
        p.extend(x, y);
      }
      if (s.s >= s.L) {
        const [x, y] = s.path(s.L);
        for (let k = 0; k < 6; k++) p.extend(x, y); // the tip catches up with the stroke's end
        p.release(clock);
      }
    }
    p.update(dt, clock, flow);
  }
}
for (let k = 0, n = Math.round(num('t', 0) * 30); k < n; k++) step(1 / 30);

let prev = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - prev) / 1000);
  prev = now;
  if (playing) step(dt);
  sharedUniforms.uTime.value = clock;
  sharedUniforms.uCam.value.copy(camera.position);
  info.textContent = `kelp lab · seed ${seed}${playing ? '' : ' · paused'}`;
  post.render(clock);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
