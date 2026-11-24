// Three ways to look at the growth, all with the same views side by side and
// one camera they share:
//   ?seed=n          one generation (a random seed without it)
//   ?grid[=9]        several random seeds at once, quick and in lines unless &full
//   ?saved[=1,4,7]   the generations saved (s), all or those ids
// &quick grows the shortcut version (growth.js QUICK), &lines shows the
// skeleton, &tubes the geometry. Keys: n new, s save, l lines/tubes, q quick,
// r turn, g grid, p grow (again) / pause, e the post-processing (&nopost:
// without), b the pedestal (&bare: without, &plinth=0.7 its height); the slider scrubs through the growth, &secs=10 is how long it
// lasts, &at=0.4 starts it that far, &still doesn't play (grown, or at &at).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { grow, VERSION } from './growth.js';
import { skeletonGeometry, stalksGeometry, baseGeometry, skeletonOcclusion, bakeOcclusion, timeline, TIP, taper, tipRadius } from './mesh.js';
import { setupRenderer, createStage, aragonite, prepare, createPost } from './look.js';
import { pedestal } from './pedestal.js';
import * as store from './store.js';

const params = new URLSearchParams(location.search);
const mode = params.has('saved') ? 'saved' : params.has('grid') ? 'grid' : 'single';
const multi = mode !== 'single';
let quick = params.has('quick') || (mode === 'grid' && !params.has('full'));
let lines = params.has('lines') || (mode === 'grid' && !params.has('full') && !params.has('tubes'));
if (params.has('tubes')) lines = false;
let post = !params.has('nopost');
let onPedestal = !params.has('bare');
const plinth = parseFloat(params.get('plinth')) || 0.3; // its height, × the first one

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
setupRenderer(renderer);
renderer.setScissorTest(true);
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const stage = createStage(renderer, scene, { shadowSize: multi ? 2048 : 4096 });

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
const viewsEl = document.getElementById('views');
const controls = new OrbitControls(camera, viewsEl);
// on its pedestal: the camera aimed at the middle of it all, from far enough
// to see it whole (the largest of the views); keeps the direction looked from
function frame() {
  const d = multi ? 6.2 : 5.4;
  const target = new THREE.Vector3(), dir = new THREE.Vector3(0, 1.5, d).normalize();
  let dist = Math.hypot(1.5, d);
  if (camera.position.lengthSq() > 0) dir.subVectors(camera.position, controls.target).normalize();
  if (onPedestal && !lines && views.length) {
    const box = new THREE.Box3();
    for (const v of views) box.union(v.box);
    box.getCenter(target);
    // the nearest distance where all the box's corners are in the view, with a margin
    const r = views[0].el.getBoundingClientRect();
    camera.aspect = r.width / r.height || 1;
    const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
    const fits = (t) => {
      camera.position.copy(dir).multiplyScalar(t).add(target);
      camera.lookAt(target);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      return corners.every((c) => {
        const p = c.clone().project(camera);
        return p.z < 1 && Math.abs(p.x) < 0.9 && Math.abs(p.y) < 0.86;
      });
    };
    let lo = 1, hi = 30;
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    dist = Math.max(dist * 0.4, hi);
  }
  controls.target.copy(target);
  camera.position.copy(dir).multiplyScalar(dist).add(target);
  controls.update();
  redraw();
}
controls.enableDamping = true;
controls.autoRotateSpeed = 1.2;
controls.addEventListener('change', () => redraw());

// ——— the growth, animated: every view at the same pace, all done together.
// A stalk's segments appear as the time passes the step they were laid at,
// the newest sliding out of the one before (aTime, aBack: see mesh.js), and
// a cone points each tip still growing.
const anim = { p: params.has('at') ? Math.min(1, +params.get('at')) : params.has('still') ? 1 : 0, playing: !params.has('still'), secs: parseFloat(params.get('secs')) || 10, last: 0 };
const uTime = { value: 1e9 };
// tubes: also thinner towards the tip while it grows (the geometry is thinned
// as it is once grown, aTaper.x is when that is), see TIP in mesh.js.
// Added to what the material already does to its shader.
const thinned = (e) => `(${TIP.thin.toFixed(4)} + ${(1 - TIP.thin).toFixed(4)} * ${e} * (2.0 - ${e}))`;
function growMaterial(mat, tubes = false) {
  const before = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    before.call(mat, sh, r);
    sh.uniforms.uTime = uTime;
    sh.vertexShader = 'attribute float aTime;\nattribute vec3 aBack;\nattribute vec3 aCenter;\nattribute vec2 aTaper;\nuniform float uTime;\n' +
      sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float slide = clamp(aTime - uTime, 0.0, 1.0);
        transformed += aBack * slide;
        ${tubes ? `
        vec3 mid = aCenter + aBack * slide;
        float e = clamp((min(uTime, aTaper.x) - aTime) / aTaper.y, 0.0, 1.0);
        float grown = clamp((aTaper.x - aTime) / aTaper.y, 0.0, 1.0);
        transformed = mid + (transformed - mid) * ${thinned('e')} / ${thinned('grown')};` : ''}`);
  };
  const key = `${mat.type}-${tubes ? 'grow-tubes' : 'grow'}`;
  mat.customProgramCacheKey = () => key;
  return mat;
}

const stalkMat = aragonite();
const growStalkMat = growMaterial(aragonite(), true);
// the shadows of the growing stalks, thinned and sliding out the same way
const growDepthMat = growMaterial(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), true);
const lineMat = growMaterial(new THREE.LineBasicMaterial({ color: 0xe8e4dc, fog: false }));
// a growing tip: radius 1, pointing up (+y), a little skirt below to cover the tube's open end
const tipGeo = prepare(new THREE.LatheGeometry(
  [new THREE.Vector2(1, -0.5), ...Array.from({ length: 7 }, (_, k) => new THREE.Vector2(tipRadius(k / 6), (k / 6) * TIP.length))], 12), { radius: 0.02 });
const rockLineMat = new THREE.MeshBasicMaterial({ color: 0x6a645a, wireframe: true, fog: false });
const postChain = createPost(renderer, scene, camera);

// a view: a generation, its objects, and the box of the page it's drawn in
const views = [];

function addView(gen, html) {
  const el = document.createElement('div');
  el.className = 'view';
  el.innerHTML = `<div class="label">${html}</div>`;
  viewsEl.append(el);
  const view = { gen, el, group: new THREE.Group(), built: null, ...timeline(gen), at: -1 };
  views.push(view);
  build(view);
  layout();
  return view;
}

function build(view) {
  const want = lines ? 'lines' : onPedestal ? 'tubes-pedestal' : 'tubes';
  if (view.built === want) return;
  for (const o of view.group.children) if (o.geometry !== tipGeo) o.geometry?.dispose();
  for (const o of view.group.children) o.shadow?.dispose();
  for (const o of view.group.children) o.userData.dispose?.();
  view.group.clear();
  const { gen } = view;
  if (lines) {
    view.stalks = new THREE.LineSegments(skeletonGeometry(gen), lineMat);
    view.group.add(view.stalks);
    view.group.add(new THREE.Mesh(baseGeometry(gen), rockLineMat));
    view.tips = null;
  } else {
    const occlusion = skeletonOcclusion(gen);
    view.stalks = new THREE.Mesh(stalksGeometry(gen, { radial: multi ? 8 : 12, occlusion }), growStalkMat);
    view.stalks.customDepthMaterial = growDepthMat;
    const baseGeo = prepare(bakeOcclusion(gen, baseGeometry(gen)));
    const base = new THREE.Mesh(baseGeo, stalkMat);
    view.tips = new THREE.InstancedMesh(tipGeo, stalkMat, gen.branches.length);
    view.tips.count = 0; // (none yet: they'd count in the box below)
    view.tips.frustumCulled = false;
    for (const m of [view.stalks, base, view.tips]) m.castShadow = m.receiveShadow = true;
    view.group.add(view.stalks, base, view.tips);
    if (onPedestal) {
      baseGeo.computeBoundingBox();
      view.group.add(pedestal(baseGeo.boundingBox, baseGeo, gen.seed, plinth));
    }
  }
  view.at = -1;
  // each one centered on itself, on the table
  const box = new THREE.Box3().setFromObject(view.group.children[0]);
  const center = box.getCenter(new THREE.Vector3());
  view.group.position.copy(center).negate();
  let all = new THREE.Box3().setFromObject(view.group);
  // on its pedestal: the whole of it centered instead, so they line up side by side
  if (onPedestal && !lines) {
    view.group.position.sub(all.getCenter(new THREE.Vector3()));
    all = new THREE.Box3().setFromObject(view.group);
  }
  // around the middle of the stalks (where the key aims), all of it
  view.radius = all.getBoundingSphere(new THREE.Sphere()).radius + all.getCenter(new THREE.Vector3()).distanceTo(center.clone().add(view.group.position));
  view.floorY = all.min.y - 0.002;
  view.box = all;
  const key = stage.keyFor(center, view.radius);
  view.group.add(key, key.target);
  view.key = key;
  view.built = want;
  redraw();
}

// a view at time t (in steps of its growth)
const M = new THREE.Matrix4(), V = new THREE.Vector3(), S = new THREE.Vector3(), D = new THREE.Vector3(), Qn = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function growTo(view, t) {
  if (view.at === t) return;
  view.at = t;
  // its shadows change as it grows (drawn once otherwise)
  view.key.shadow.needsUpdate = true;
  const g = view.stalks.geometry, { times, per } = g.userData;
  // the segments laid before t + 1 (the last of them still sliding out)
  let lo = 0, hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < t + 1) lo = mid + 1;
    else hi = mid;
  }
  g.setDrawRange(0, t >= view.end ? Infinity : lo * per);
  if (!view.tips) return;
  let n = 0;
  if (t < view.end)
    view.gen.branches.forEach((b, k) => {
      const f = t - view.birth[k], p = b.points, last = p.length / 4 - 1;
      if (f < 0 || f >= last) return;
      const i = Math.floor(f), u = f - i, a = i * 4, c = a + 4;
      V.set(p[a] + (p[c] - p[a]) * u, p[a + 1] + (p[c + 1] - p[a + 1]) * u, p[a + 2] + (p[c + 2] - p[a + 2]) * u);
      const r = (p[a + 3] + (p[c + 3] - p[a + 3]) * u) * taper(0) * 0.98;
      D.set(p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]).normalize();
      view.tips.setMatrixAt(n++, M.compose(V, Qn.setFromUnitVectors(UP, D), S.setScalar(r)));
    });
  view.tips.count = n;
  view.tips.instanceMatrix.needsUpdate = true;
}

function layout() {
  const n = Math.max(1, views.length);
  const W = viewsEl.clientWidth, H = viewsEl.clientHeight;
  let best = 1, bestSize = 0;
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols);
    const size = Math.min(W / cols, H / rows);
    if (size > bestSize) (bestSize = size), (best = cols);
  }
  viewsEl.style.gridTemplateColumns = `repeat(${best}, 1fr)`;
  viewsEl.style.gridTemplateRows = `repeat(${Math.ceil(n / best)}, 1fr)`;
  redraw();
}

// drawn only when something changed: the camera, a view, the size, the growth
let dirty = true;
function redraw() {
  dirty = true;
}
function loop(now = 0) {
  const dt = Math.min(0.1, (now - anim.last) / 1000);
  anim.last = now;
  if (anim.playing) {
    anim.p = Math.min(1, anim.p + dt / anim.secs);
    if (anim.p >= 1) setPlaying(false);
    scrub.value = anim.p;
    redraw();
  }
  if (controls.update() || dirty) draw(now);
  dirty = false;
  requestAnimationFrame(loop);
}

function draw(now = 0) {
  renderer.setScissor(0, 0, innerWidth, innerHeight);
  renderer.clear();
  for (const v of views) {
    const r = v.el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const y = innerHeight - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height);
    renderer.setScissor(r.left, y, r.width, r.height);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    const at = anim.p >= 1 ? v.end : anim.p * v.end;
    growTo(v, at);
    uTime.value = at;
    scene.add(v.group);
    stage.floor.visible = !lines;
    stage.floor.position.y = v.floorY;
    if (post && !lines) postChain.render(r.width, r.height, now / 1000);
    else renderer.render(scene, camera);
    scene.remove(v.group);
  }
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  layout();
});
addEventListener('scroll', redraw, true);

// ——— the bar at the bottom

const bar = document.getElementById('bar');
const info = document.getElementById('info');
function button(text, title, fn) {
  const b = document.createElement('button');
  b.textContent = text;
  b.title = title;
  b.onclick = fn;
  bar.append(b);
  return b;
}
function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('on');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('on'), 1600);
}
const url = (q) => `${location.pathname}?${new URLSearchParams(q).toString().replace(/=(&|$)/g, '$1')}`;
const flags = () => ({ ...(quick ? { quick: '' } : {}), ...(onPedestal ? {} : { bare: '' }), ...(params.has('plinth') ? { plinth: params.get('plinth') } : {}), ...(lines ? { lines: '' } : { tubes: '' }), ...(params.has('secs') ? { secs: params.get('secs') } : {}), ...(post ? {} : { nopost: '' }) });
const randomSeed = () => (Math.random() * 1e6) | 0;

function setLines(v) {
  lines = v;
  views.forEach(build);
  frame();
  linesBtn.textContent = lines ? 'tubes' : 'lines';
  const q = new URLSearchParams(location.search);
  q.delete('lines');
  q.delete('tubes');
  q.set(lines ? 'lines' : 'tubes', '');
  history.replaceState(null, '', url(q));
}

async function saveGen(gen) {
  const id = await store.save(gen);
  toast(`saved #${id}`);
  savedBtn.textContent = `saved (${(await store.list()).length})`;
}

let linesBtn, savedBtn, growBtn;
function setPlaying(v) {
  anim.playing = v;
  if (v && anim.p >= 1) anim.p = 0;
  if (growBtn) growBtn.textContent = v ? 'pause' : anim.p >= 1 ? 'grow' : 'go on';
}
const keys = {};

if (mode === 'single') {
  const seed = params.has('seed') ? parseInt(params.get('seed')) >>> 0 : randomSeed();
  const gen = grow(seed, { quick });
  const s = gen.stats;
  info.textContent = `seed ${seed}${quick ? ' · quick' : ''} · ${s.branches} stalks · ${s.points} points · ${s.ms} ms`;
  history.replaceState(null, '', url({ seed, ...flags() }));
  document.title = `04 — tangle ${seed}`;
  addView(gen, '');
  keys.n = button('new', 'n — another seed', () => (location.href = url({ seed: randomSeed(), ...flags() })));
  keys.s = button('save', 's — keep this one to compare it later', () => saveGen(gen));
  keys.q = button(quick ? 'full' : 'quick', 'q — the same seed, quick or full', () => {
    quick = !quick;
    location.href = url({ seed, ...flags() });
  });
} else if (mode === 'grid') {
  const n = parseInt(params.get('grid')) || 9;
  info.textContent = `${n} seeds${quick ? ' · quick' : ''} · click a seed to open it`;
  const grid = async () => {
    for (const v of views.splice(0)) v.el.remove();
    anim.p = 0;
    setPlaying(true);
    for (let i = 0; i < n; i++) {
      const seed = randomSeed();
      const gen = grow(seed, { quick });
      const view = addView(gen, `<a href="${url({ seed, ...flags() })}">${seed}</a> <button>save</button>`);
      view.el.querySelector('button').onclick = () => saveGen(gen);
      await new Promise(requestAnimationFrame); // shows them as they come
    }
    frame();
  };
  keys.n = button('new', 'n — other seeds', grid);
  keys.q = button(quick ? 'full' : 'quick', 'q — quick or full', () => {
    quick = !quick;
    location.href = url({ grid: n, ...(quick ? {} : { full: '' }), ...(lines ? { lines: '' } : { tubes: '' }) });
  });
  grid();
} else {
  const ids = params.get('saved') ? params.get('saved').split(',').map(Number) : null;
  const items = (await store.list()).filter((it) => !ids || ids.includes(it.id));
  const selected = new Set();
  info.textContent = items.length ? `${items.length} saved · tick some to compare them` : 'nothing saved yet: s saves the generation you look at';
  for (const it of items) {
    const date = new Date(it.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const view = addView(it, `
      <label><input type="checkbox"> #${it.id}</label>
      <a href="${url({ seed: it.seed, ...(it.quick ? { quick: '' } : {}) })}" title="grow this seed again with the algorithm as it is now">seed ${it.seed}</a>
      <span class="dim">v${it.version}${it.quick ? ' quick' : ''} · ${it.stats.branches} stalks · ${date}</span>
      <span class="note" title="click to write a note">${it.note || '+ note'}</span>
      <button class="del" title="delete">×</button>`);
    const q = (s) => view.el.querySelector(s);
    q('input').onchange = (e) => (e.target.checked ? selected.add(it.id) : selected.delete(it.id));
    q('.note').onclick = async () => {
      const note = prompt('note', it.note || '');
      if (note === null) return;
      it.note = note;
      q('.note').textContent = note || '+ note';
      await store.update(it);
    };
    q('.del').onclick = async () => {
      if (!confirm(`delete #${it.id}?`)) return;
      await store.remove(it.id);
      view.el.remove();
      views.splice(views.indexOf(view), 1);
      layout();
    };
  }
  button('compare', 'only the ones ticked, side by side', () => {
    if (selected.size) location.href = url({ saved: [...selected].join(','), ...flags() });
  });
  if (ids) button('all', 'all the saved ones', () => (location.href = url({ saved: '', ...flags() })));
  button('export', 'download them all as a JSON file', () => store.exportAll());
  const file = Object.assign(document.createElement('input'), { type: 'file', accept: '.json', hidden: true });
  file.onchange = async () => {
    const n = await store.importFile(file.files[0]);
    toast(`${n} imported`);
    setTimeout(() => location.reload(), 600);
  };
  document.body.append(file);
  button('import', 'add the generations of an exported JSON file', () => file.click());
}

const scrub = Object.assign(document.createElement('input'), { type: 'range', min: 0, max: 1, step: 0.001, value: anim.p, title: 'scrub through the growth' });
scrub.oninput = () => {
  anim.p = +scrub.value;
  setPlaying(false);
  redraw();
};
scrub.onchange = () => scrub.blur();
bar.append(scrub);
growBtn = button('', 'p — grow it again, or pause', () => setPlaying(!anim.playing));
keys.p = growBtn;
setPlaying(anim.playing);
linesBtn = button(lines ? 'tubes' : 'lines', 'l — the skeleton as lines, or the tubes', () => setLines(!lines));
keys.l = linesBtn;
keys.e = button(post ? 'raw' : 'post', 'e — with or without the post-processing (occlusion, bloom, grain)', () => {
  post = !post;
  redraw();
  keys.e.textContent = post ? 'raw' : 'post';
  const q = new URLSearchParams(location.search);
  if (post) q.delete('nopost');
  else q.set('nopost', '');
  history.replaceState(null, '', url(q));
});
keys.b = button(onPedestal ? 'bare' : 'pedestal', 'b — on its pedestal or bare on the table', () => {
  onPedestal = !onPedestal;
  views.forEach(build);
  frame();
  keys.b.textContent = onPedestal ? 'bare' : 'pedestal';
  const q = new URLSearchParams(location.search);
  if (onPedestal) q.delete('bare');
  else q.set('bare', '');
  history.replaceState(null, '', url(q));
});
keys.r = button('turn', 'r — turn around', () => (controls.autoRotate = !controls.autoRotate));
if (mode !== 'grid') keys.g = button('grid', 'g — several quick seeds at once', () => (location.href = url({ grid: 9 })));
if (mode !== 'single') button('one', 'a single random seed', () => (location.href = url({ ...flags() })));
savedBtn = button(`saved (${(await store.list()).length})`, 'the generations saved, side by side', () => (location.href = url({ saved: '', ...flags() })));

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.metaKey || e.ctrlKey) return;
  keys[e.key]?.click();
});

console.log(`tangle v${VERSION}`);
frame();
loop();
window.tangle = { draw }; // to time a frame from the console
