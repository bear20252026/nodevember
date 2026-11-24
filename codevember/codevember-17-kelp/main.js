// Kelp. Under water, over a sandy floor: draw a line up from the seafloor and it grows into
// kelp along it as it is drawn — its holdfast gripping the sand, its blades unfurling
// off the stipe as the stroke passes — and, let go, it sways in the surge. A line started
// in open water grows kelp just the same, but nothing holds it: let go, it floats up and
// out of view. Seven kinds (styles.js): giant kelp, bull kelp, sugar kelp, feather boa,
// strap kelp, sea lace, knotted wrack; each plant is a set of strands bent by buoyancy and the current
// (kelp.js), its tissue blistered, spotted, worn and lit through (water.js).
//   ?seed=n      the kinds and shapes picked
//   &style=bull  start with that kind (giant, bull, sugar, boa, strap, lace, wrack)
//   &demo=12     plant that many at the start (of every kind, unless &style is given)
//   &current=1   how hard the surge pushes (0: still water)
//   &pr=2        a fixed pixel ratio
//   &exposure=1  the light let in before the tone mapping
// The kind a stroke grows into is picked in the selector down the left side (giant kelp to
// start). Hover a kelp's stipe and it slows to a stop (with what it branches off; its blades,
// and its own branches, sway on), the stipe lit, a point where the pointer
// is on it: draw from there and a branch grows off it (of the same kind), riding it as it sways.
// The selector's undo, redo and clear (past its wells) take back a stroke, put it back, and
// cut them all loose (as c does). Keys: 1–7 a kind, k plant one somewhere, c cut them all loose,
// ⌘/ctrl z undo, ⇧⌘/ctrl z (or ctrl y) redo, space pause, h hide the selector. Moving the pointer stirs the water
// (stir.js): it parts the kelp and sets its blades flapping, swirls the marine snow, bends the forest beyond.
// ?lab: the kelp lab (lab.js), the kinds side by side, each named.
import * as THREE from 'three';
import { sharedUniforms, createBackground, createFloor, createForest, createForeground, createSnow, hitFloor, FOREST_NEAR } from './water.js';
import { Plant } from './kelp.js';
import { createPost } from './post.js';
import { STYLES, STYLE_KEYS } from './styles.js';
import { createSelector } from './selector.js';
import { createStir, stirSnow, stirForest } from './stir.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
const seed = Math.floor(num('seed', Math.floor(Math.random() * 1e5)));
const CURRENT = num('current', 1);
const MAX_ROOTED = 45;

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
const rand = rngOf(seed);

// ---- renderer, camera (looking level, along -z, the horizon lowered by a lens shift so
// the floor takes the lower part of the screen and every plant's plane faces the camera)
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }) // multisampled in post.js;
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 2)));
renderer.setSize(innerWidth, innerHeight);
document.body.prepend(renderer.domElement);

const FOV = 50, SHIFT = 0.24;
const camera = new THREE.PerspectiveCamera(FOV, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 3.0, 12);
camera.updateMatrixWorld();
function fit() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  camera.projectionMatrix.elements[9] = SHIFT; // horizon at ndc y = -SHIFT
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  renderer.setSize(innerWidth, innerHeight);
  foreground.userData.fit();
  snow.material.uniforms.uPx.value = renderer.getPixelRatio() * innerHeight / 800 * 6;
  post.setSize(innerWidth, innerHeight);
}

const scene = new THREE.Scene();
scene.add(createBackground(camera));
const floor = createFloor(seed);
scene.add(floor);
const forest = createForest(seed);
scene.add(forest);
const snow = createSnow();
scene.add(snow);
const foreground = createForeground(seed, camera);
scene.add(foreground);
const post = createPost(renderer, scene, camera, num('exposure', undefined));
addEventListener('resize', fit);
fit();

// ---- the water's motion: the surge, and the wake the pointer leaves (stir.js; screen units:
// 1 = 1% of the screen's height, from its bottom left)
const stir = createStir();
let clock = 0;
// the surge alone, the pointer's wake left out: the selector's plants sway by themselves
function surge(x, y, t, out) {
  out.x = CURRENT * (0.5 * Math.sin(t * 0.42 + x * 0.017) + 0.28 * Math.sin(t * 0.93 + x * 0.045 - y * 0.03 + 1.7) + 0.18);
  out.y = CURRENT * 0.12 * Math.sin(t * 0.7 + x * 0.04 + y * 0.02);
  out.stir = 0;
}
function flow(x, y, t, out) {
  surge(x, y, t, out);
  stir.field(x, y, t, out);
}

// ---- the plants
const plants = [];
let styleKey = STYLES[params.get('style')] ? params.get('style') : 'giant';
let drawing = null;

const toScreen = (cx, cy) => ({ x: (cx / innerHeight) * 100, y: ((innerHeight - cy) / innerHeight) * 100 });
const U = (d) => (2 * d * Math.tan((FOV * Math.PI) / 360)) / 100;

// where a plant started at the screen point (cx, cy) would be: rooted where it meets the
// floor or a rock on it, or adrift in the water; none on the floor beyond the forest's
// nearest row (the background), short of it by a little so a plant stands clear of it
const NEAREST = FOREST_NEAR + 3;
const ray = new THREE.Raycaster();
function placeAt(cx, cy) {
  const ndc = new THREE.Vector3((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1, 0.5).unproject(camera);
  const dir = ndc.sub(camera.position).normalize();
  const reach = (camera.position.z - FOREST_NEAR) / -dir.z + 1;
  let hit = hitFloor(camera.position, dir, reach);
  // or a rock, if one stands nearer
  ray.set(camera.position, dir);
  ray.far = hit ? camera.position.distanceTo(hit) : reach;
  const rock = ray.intersectObjects(floor.userData.rocks, false)[0];
  if (rock) hit = rock.point;
  if (hit) return hit.z >= NEAREST ? { origin: hit, anchored: true } : null;
  if (dir.y < 0) return null; // under the horizon: the floor, out of reach
  return { dir, anchored: false };
}

// a plant rooted where the screen point (cx, cy) meets the floor or a rock, or adrift in the water;
// null where none can be (the background)
function startPlant(cx, cy, key) {
  const at = placeAt(cx, cy);
  if (!at) return null;
  const anchored = at.anchored;
  const origin = at.origin ?? camera.position.clone().addScaledVector(at.dir, (11 + rand() * 5) / -at.dir.z);
  const d = camera.position.z - origin.z;
  const k = key === 'mix' ? STYLE_KEYS[Math.floor(rand() * STYLE_KEYS.length)] : key;
  const p = new Plant({ style: STYLES[k], origin, U: U(d), screen: toScreen(cx, cy), anchored, rand: rngOf(Math.floor(rand() * 1e9)), time: clock });
  p.key = k;
  p.clock = clock; // its own time, which stands still while it is put aside (undone)
  plants.push(p);
  scene.add(p.mesh);
  return p;
}

// a branch off the stipe of h.plant, at the point hovered, of the same kind as it
function startBranch(h) {
  const host = h.plant, hs = host.spine;
  const x = hs.px[h.i] + (hs.px[h.i + 1] - hs.px[h.i]) * h.f, y = hs.py[h.i] + (hs.py[h.i + 1] - hs.py[h.i]) * h.f;
  // where it is on screen, and which way the stipe runs there, as the host is turned
  const o = host.project(x, y), a = host.project(hs.px[h.i + 1] - hs.px[h.i], hs.py[h.i + 1] - hs.py[h.i]);
  const origin = host.mesh.position.clone().add(new THREE.Vector3(x * host.U, y * host.U, 0).applyQuaternion(host.mesh.quaternion));
  const k = host.key;
  const p = new Plant({
    style: STYLES[k], origin, U: host.U, screen: { x: host.so.x + o.x, y: host.so.y + o.y }, anchored: true,
    rand: rngOf(Math.floor(rand() * 1e9)), time: clock, host, at: { i: h.i, f: h.f, ang0: hs.ang[h.i], dir0: Math.atan2(a.y, a.x) },
  });
  p.key = k;
  p.clock = clock;
  plants.push(p); // after its host, so the host has moved before the branch follows it
  scene.add(p.mesh);
  return p;
}

function endPlant(p) {
  p.release(p.clock);
  if (p.spine.n < 3) return removePlant(p);
  record(p);
  if (p.anchored && !p.host) {
    const rooted = plants.filter((q) => q.anchored && !q.drawing && !q.host);
    if (rooted.length > MAX_ROOTED) rooted[0].detach(rooted[0].clock);
  }
}

// a plant goes with its branches
function removePlant(p) {
  if (p.removed) return;
  p.removed = true;
  if (hover?.plant === p) setHover(null);
  plants.splice(plants.indexOf(p), 1);
  scene.remove(p.mesh);
  p.dispose();
  p.disposed = true;
  for (const q of plants.filter((q) => q.host === p)) removePlant(q);
}

// ---- undo, redo. What is undone is put aside as it was, not thrown away: redone, a plant
// comes back where it was, its own time resuming. A step is a plant drawn (or planted with k).
// Plants the sea takes (drifted out of view) are gone for good: a step left with nothing to
// act on is skipped. Clear cuts them all loose (as c does), which is not a step: a plant cut
// loose can still be undone while it floats.
const done = [], undone = [];
const MAX_STEPS = 100;
const live = (p) => !p.removed;

function stash(p) {
  if (hover?.plant === p) setHover(null);
  p.removed = true;
  plants.splice(plants.indexOf(p), 1);
  scene.remove(p.mesh);
}
function unstash(p) {
  p.removed = false;
  plants.push(p); // in the order they were drawn: a host before its branches
  scene.add(p.mesh);
}
// a plant put aside for good
function drop(p) {
  if (p.disposed || live(p)) return;
  p.dispose();
  p.disposed = true;
}

const canUndo = (p) => live(p);
const canRedo = (p) => !p.disposed && (!p.host || live(p.host));

function record(p) {
  undone.splice(0).forEach(drop);
  done.push(p);
  if (done.length > MAX_STEPS) done.shift();
}
function undo() {
  if (drawing) return;
  while (done.length) {
    const p = done.pop();
    if (!canUndo(p)) continue;
    stash(p);
    undone.push(p);
    return;
  }
}
function redo() {
  if (drawing) return;
  while (undone.length) {
    const p = undone.pop();
    if (!canRedo(p)) { drop(p); continue; }
    unstash(p);
    done.push(p);
    return;
  }
}
// cut every rooted plant loose: it floats up and out of view (its branches with it). Not all
// at once: one after another in no order, a beat apart (shorter the more there are), each on
// its own time (p.cutAt), so one put aside meanwhile leaves when it comes back
const CUT_GAP = 0.09, CUT_SPREAD = 1.1; // s between two, at most s for them all
const cuttable = (p) => p.anchored && !p.host && p.cutAt == null;
function cutLoose() {
  const todo = plants.filter(cuttable);
  for (let i = todo.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [todo[i], todo[j]] = [todo[j], todo[i]];
  }
  const gap = Math.min(CUT_GAP, CUT_SPREAD / Math.max(1, todo.length - 1));
  todo.forEach((p, i) => { p.cutAt = p.clock + (i === 0 ? 0 : (i + (Math.random() - 0.5) * 0.6) * gap); });
}
function cutDue(p) {
  if (p.cutAt == null || p.clock < p.cutAt) return;
  p.cutAt = null;
  p.detach(p.clock);
}

// ---- hovering a stipe: the stipe (and what it branches off) slows to a stop, its
// stipe lit, a point on it where the pointer is
let hover = null; // { plant, i, f, x, y } (x, y: on the stipe, plant units)
let pointer = null; // the pointer on screen (units), while it is over the canvas
let quiet = null; // where a stroke ended: the stipe just drawn is not held until the pointer moves off

// where no plant can start (the far floor, the background), a stroke can still start from
// a stipe: there, one a little off the pointer is taken too, since a miss draws nothing
const FAR_REACH = 3;
const isOut = (sx, sy) => !placeAt((sx / 100) * innerHeight, innerHeight * (1 - sy / 100));
function pickAt(pt) {
  const h = pick(pt.x, pt.y);
  if (h) return h;
  if (pt.out === undefined) pt.out = isOut(pt.x, pt.y);
  return pt.out ? pick(pt.x, pt.y, FAR_REACH) : null;
}

// the stipe nearest the screen point (units), if close enough (reach: how many times its
// usual margin away it may be)
function pick(sx, sy, reach = 1) {
  let best = null, bs = reach;
  for (const p of plants) {
    if (p.floating || p.drawing) continue;
    const s = p.spine, n = s.n;
    if (n < 2) continue;
    // on screen, as the plant is turned (a branch, by its host's torsion)
    const lx = sx - p.so.x, ly = sy - p.so.y;
    let b = p.project(s.px[0], s.py[0]);
    for (let i = 0; i < n; i++) {
      const e = p.project(s.px[i + 1], s.py[i + 1]);
      const ax = b.x, ay = b.y, dx = e.x - ax, dy = e.y - ay;
      b = e;
      const l2 = dx * dx + dy * dy || 1e-9;
      const f = Math.min(1, Math.max(0, ((lx - ax) * dx + (ly - ay) * dy) / l2));
      const tol = Math.max(1.2, Math.min(3, s.width(i, n)) + 0.5);
      const sc = Math.hypot(lx - ax - dx * f, ly - ay - dy * f) / tol;
      if (sc < bs) {
        bs = sc;
        best = { plant: p, i, f, x: s.px[i] + (s.px[i + 1] - s.px[i]) * f, y: s.py[i] + (s.py[i + 1] - s.py[i]) * f };
      }
    }
  }
  return best;
}

// held: the stipe hovered and those it rides (its host, its host's host…), not its
// branches nor its siblings, which sway on from it
const held = (p) => {
  if (!hover || p === drawing) return false;
  for (let q = hover.plant; q; q = q.host) if (q === p) return true;
  return false;
};

// the lit stipe: a soft hairline along it; the point: a small dot
const hlMat = new THREE.MeshBasicMaterial({ color: 0xe4fcff, transparent: true, opacity: 0.45, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
const hlGeo = new THREE.BufferGeometry();
{
  const MAX = 200;
  hlGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MAX + 1) * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let i = 0; i < MAX; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  hlGeo.setIndex(idx);
}
const hl = new THREE.Mesh(hlGeo, hlMat);
hl.renderOrder = 10; hl.frustumCulled = false;
const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false, depthWrite: false });
const haloMat = new THREE.MeshBasicMaterial({ color: 0xe4fcff, transparent: true, opacity: 0.6, depthTest: false, depthWrite: false });
const dot = new THREE.Group();
dot.add(new THREE.Mesh(new THREE.CircleGeometry(0.4, 20), dotMat));
dot.add(new THREE.Mesh(new THREE.RingGeometry(0.68, 0.78, 32), haloMat));
dot.children.forEach((m) => { m.renderOrder = 11; m.frustumCulled = false; });

// the guide (lit stipe and dot) shows only once a stipe has been hovered a moment:
// passing quickly over several stipes doesn't flash a line on each
const GUIDE_DELAY = 120; // ms
let hoverSince = 0;

function setHover(h) {
  if (h?.plant !== hover?.plant) {
    hl.removeFromParent(); dot.removeFromParent();
    hoverSince = performance.now();
  }
  hover = h;
  if (h) drawHover();
  setCursor();
}

// put the guide on the hovered stipe, once it has been hovered long enough (or now)
function showGuide(now = false) {
  if (!hover || hl.parent) return;
  if (!now && performance.now() - hoverSince < GUIDE_DELAY) return;
  hover.plant.mesh.add(hl); hover.plant.mesh.add(dot);
}

// the cursor: a branch over a stipe, none over the background, the pen elsewhere
function setCursor() {
  if (drawing) return;
  const out = !hover && pointer && (pointer.out ??= isOut(pointer.x, pointer.y));
  canvas.style.cursor = hover ? 'copy' : out ? 'default' : '';
}

function drawHover() {
  const s = hover.plant.spine, n = s.n, P = hlGeo.attributes.position.array;
  for (let i = 0; i <= n; i++) {
    const a0 = s.ang[Math.max(0, i - 1)], a1 = s.ang[Math.min(n - 1, i)];
    let tx = Math.cos(a0) + Math.cos(a1), ty = Math.sin(a0) + Math.sin(a1);
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const hw = 0.09; // about a pixel either side
    P.set([s.px[i] + ty * hw, s.py[i] - tx * hw, 0.2, s.px[i] - ty * hw, s.py[i] + tx * hw, 0.2], i * 6);
  }
  hlGeo.attributes.position.needsUpdate = true;
  hlGeo.setDrawRange(0, n * 6);
  dot.position.set(hover.x, hover.y, 0.4);
}

// a stroke drawn by itself: up from the floor (or anywhere), leaning and curving a little;
// near (cx0, sy0), a clump's middle, if given (screen units)
const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;
function plantSomewhere(key = styleKey, sy, near) {
  for (let tries = 0; tries < 20; tries++) {
    const cx = near ? Math.min(0.98, Math.max(0.02, near.x + gauss() * near.spread)) * innerWidth : (0.04 + rand() * 0.92) * innerWidth;
    const yy = sy ?? (near ? Math.max(2, near.y + gauss() * 8) : 3 + rand() * 30);
    const cy = innerHeight * (1 - yy / 100);
    const p = startPlant(cx, cy, key);
    if (!p) continue;
    if (!p.anchored && sy === undefined) { removePlant(p); continue; }
    const depth = camera.position.z - p.mesh.position.z;
    // (in a clump, the sizes spread wider: a tall one or two among shorter)
    const L = Math.min(85, (near ? 15 + 75 * rand() ** 1.6 : 25 + rand() * 50) * Math.min(1.3, 14 / depth));
    const lean = (rand() - 0.5) * 0.6, bendA = (rand() - 0.5) * 18, ph = rand() * 6;
    for (let s = 0; s <= L; s += 0.5) {
      const u = s / L;
      p.extend(Math.sin(lean) * s + bendA * Math.sin(u * 2.4 + ph) - bendA * Math.sin(ph), Math.cos(lean) * s);
    }
    p.update(0, p.clock, flow);
    endPlant(p);
    return p;
  }
}

// ---- input
const canvas = renderer.domElement;
let last = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || drawing) return;
  canvas.setPointerCapture(e.pointerId);
  pointer = toScreen(e.clientX, e.clientY);
  if (!hover) setHover(pickAt(pointer)); // a touch: no hover before it
  showGuide(true); // pressed on a stipe: no waiting
  drawing = hover ? startBranch(hover) : startPlant(e.clientX, e.clientY, styleKey);
  if (!drawing) return; // the background: nothing to draw on
  // the stroke from where it was pressed: on a broad stipe the branch's root is a little off the pointer
  drawing.grab = { x: drawing.so.x - pointer.x, y: drawing.so.y - pointer.y };
});
canvas.addEventListener('pointermove', (e) => {
  const s = toScreen(e.clientX, e.clientY);
  const now = performance.now();
  if (last && now > last.t) {
    const dt = (now - last.t) / 1000;
    const vx = (s.x - last.x) / dt, vy = (s.y - last.y) / dt;
    stir.move(s.x, s.y, vx, vy, clock, now);
  }
  last = { x: s.x, y: s.y, t: now };
  pointer = s;
  setCursor();
  if (drawing) {
    // the stroke on screen, into the plant's plane (a branch's is turned with its host)
    const l = drawing.unproject(s.x + drawing.grab.x - drawing.so.x, s.y + drawing.grab.y - drawing.so.y);
    drawing.extend(l.x, l.y);
  }
});
const stop = () => {
  if (!drawing) return;
  const p = drawing;
  drawing = null;
  endPlant(p);
  quiet = pointer && { ...pointer };
  setHover(null); // let go of the branch: its host moves on
};
canvas.addEventListener('pointerup', stop);
canvas.addEventListener('pointercancel', stop);
canvas.addEventListener('pointerleave', () => { if (!drawing) { pointer = null; setHover(null); } });

let playing = true;
const brushEl = document.getElementById('brush');
const selector = createSelector({
  container: document.getElementById('wells'),
  choices: STYLE_KEYS,
  camPos: camera.position,
  flow: surge,
  onPick: (k) => setStyle(k),
});
function setStyle(k) {
  styleKey = k;
  selector.select(k, clock);
}
setStyle(styleKey);

addEventListener('keydown', (e) => {
  if (e.key === ' ') { playing = !playing; e.preventDefault(); }
  else if (e.key === 'h') brushEl.classList.toggle('hidden');
  else if (e.key === 'k') { plantSomewhere(); }
  else if (e.key === 'c') cutLoose();
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { (e.shiftKey ? redo : undo)(); e.preventDefault(); }
  else if ((e.metaKey || e.ctrlKey) && e.key === 'y') { redo(); e.preventDefault(); }
  else if (/^[1-9]$/.test(e.key) && STYLE_KEYS[+e.key - 1]) setStyle(STYLE_KEYS[+e.key - 1]);
});

// the plants given at the start stand in a few clumps, not spread evenly: open water between
{
  const n = num('demo', 0);
  const nc = Math.max(1, Math.min(4, Math.round(n / 5)));
  const clumps = Array.from({ length: nc }, (_, k) => ({
    x: ((k + 0.25 + 0.5 * rand()) / nc) * 0.9 + 0.05, y: 4 + rand() * 22, spread: 0.04 + rand() * 0.06,
  }));
  for (let i = 0; i < n; i++) plantSomewhere(params.has('style') ? styleKey : 'mix', undefined, clumps[Math.floor(rand() * clumps.length)]);
}
done.length = 0; // the plants given at the start are not a step to undo

// the toolbar's buttons; pressed, they don't take the focus (space stays pause)
const tools = { undo: [undo, () => done.some(canUndo)], redo: [redo, () => undone.some(canRedo)], clear: [cutLoose, () => plants.some(cuttable)] };
for (const [id, [act]] of Object.entries(tools)) {
  const b = document.getElementById(id);
  b.addEventListener('pointerdown', (e) => e.preventDefault());
  b.addEventListener('click', () => { act(); syncTools(); });
}
function syncTools() {
  for (const [id, [, can]] of Object.entries(tools)) document.getElementById(id).disabled = !can();
}

// ---- the loop
// the water as it is now, whatever a plant's own time
const flowNow = (x, y, t, out) => flow(x, y, clock, out);
let prev = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - prev) / 1000);
  prev = now;
  // what the pointer is over, unless it is drawing (a branch keeps its host held)
  if (quiet && (!pointer || Math.hypot(pointer.x - quiet.x, pointer.y - quiet.y) > 4)) quiet = null;
  if (!drawing && !quiet) {
    const h = pointer && pickAt(pointer);
    if (h || hover) setHover(h);
  }
  if (playing) {
    clock += dt;
    stir.prune(clock);
    stirSnow(snow, stir, camera, dt, clock);
    for (const p of [...plants]) {
      if (p.removed) continue;
      // a held plant's stipe slows to a stop (and back); its blades and the rest go on
      p.hold += ((held(p) ? 1 : 0) - p.hold) * Math.min(1, dt * 8);
      if (p.hold > 0.9999) p.hold = 1;
      p.clock += dt;
      cutDue(p);
      p.update(dt, p.clock, flowNow);
      const off = p.so.x < -80 || p.so.x > (innerWidth / innerHeight) * 100 + 80;
      if (p.floating && (p.bottom > 104 || off)) removePlant(p);
    }
    selector.update(dt, clock);
  } else if (drawing) drawing.update(0, drawing.clock, flowNow);
  showGuide();
  if (hover) drawHover();
  stirForest(forest, stir, camera);
  sharedUniforms.uTime.value = clock;
  sharedUniforms.uCam.value.copy(camera.position);

  syncTools();
  post.render(clock);
  if (!brushEl.classList.contains('hidden')) selector.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
