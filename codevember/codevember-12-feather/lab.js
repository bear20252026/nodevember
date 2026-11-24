import * as THREE from 'three';
import { LIGHTS, rng } from './common.js';
import { KeyShadow } from './shadow.js';
import { stage } from './stage.js';
import { FeatherMesh, setFlow } from './feather.js';
import { CHARACTERS, CHARACTER_NAMES, DISPLAY_SHAPES, DISPLAY_SHAPE_NAMES } from './characters.js';
import { Post } from './post.js';
import { plumage, MARKS } from './plumage.js';

// The feather lab (?lab): a few feathers on their own in front of the eye, in groups, one
// per type of feather, each group with its own settings in the panel on the right (its
// shape, its colours, how much its feathers differ from each other). The same feathers,
// drawn the same way, as on the creature, only free and standing upright, turning a little
// to catch the light. Drag the room to turn round them, wheel to zoom, a group's ◎ to look
// at it closer. The settings are kept (in this browser) from one visit to the next;
// `copy` puts them on the clipboard as JSON, `reset` brings back the ones below, `bird`
// dresses the four types in the colours of a bird drawn at random (plumage.js): its
// primary, secondary and display feathers, and its down (white, tinted by the belly).

// a type of feather: kind 0 a contour feather, 1 down (a soft white feather under the
// others). A contour type has a character (characters.js), which sets its shape when picked;
// the display type also a wilder shape (racket, curl…, or a plain feather), which sets
// its width and twist when picked.
const FORM = ['width', 'tip', 'cup', 'twist', 'fray', 'splits', 'sheen', 'barbs', 'flow', 'scurve', 'locks', 'stir'];
const withChar = (ty, c) => ({ ...ty, char: c, ...Object.fromEntries(FORM.map((k) => [k, CHARACTERS[c][k]])) });
const DEFAULTS = [
  withChar({
    name: 'primary', kind: 0, count: 3, L: 0.62, downTo: 0.26, bend: 0.05, sweep: 0.0,
    colA: '#1f6a83', colB: '#b8e6e0', colC: '#2a9d7c', colD: '#0c1a22', fringe: 0.16, band: 0.35, bandAt: 0.76, hue: 0.03, vary: 0.15, seed: 1,
    mark: 0, density: 5, strength: 0.9, grad: 0.5, iri: 0.8, film: 0.42,
  }, 'proud'),
  withChar({
    name: 'secondary', kind: 0, count: 3, L: 0.34, downTo: 0.3, bend: 0.04, sweep: 0.0,
    colA: '#e0662a', colB: '#f7cf86', colC: '#f2b33a', colD: '#2a120a', fringe: 0.22, band: 0.1, bandAt: 0.78, hue: 0.03, vary: 0.2, seed: 2,
    mark: 1, density: 4, strength: 0.9, grad: 0.4, iri: 0.45, film: 0.42,
  }, 'cute'),
  { ...withChar({
    name: 'display', kind: 0, count: 3, L: 1.3, downTo: 0.14, bend: -0.12, sweep: 0.08,
    colA: '#a3205a', colB: '#f2c14e', colC: '#5a2a8c', colD: '#10303a', fringe: 0.3, band: 0.6, bandAt: 0.86, hue: 0.04, vary: 0.12, seed: 3,
    mark: 4, density: 1, strength: 1, grad: 0.6, iri: 0.75, film: 0.5,
  }, 'aggressive'), shape: 'racket', width: DISPLAY_SHAPES.racket.width, twist: DISPLAY_SHAPES.racket.twist },
  {
    name: 'down', kind: 1, count: 5, L: 0.15, width: 0.36, tip: 0.5, cup: 0.32, twist: 0.08, downTo: 0.0, bend: 0.12, sweep: 0.0,
    ruffle: 0.7, flow: 0.04, scurve: 0.03, locks: 0, stir: 0.02, colA: '#f3f0ea', colB: '#ffffff', colC: '#f3f0ea', colD: '#f3f0ea', fringe: 0.0, band: 0.0, bandAt: 0.75, hue: 0.01, vary: 0.25, seed: 4,
    mark: 0, density: 1, strength: 0, grad: 0, iri: 0, film: 0.4,
  },
];

// the settings in the panel: key, label, min, max, step; `contour` for those a down
// feather hasn't got
const SHAPE = [
  ['count', 'count', 1, 6, 1],
  ['L', 'length', 0.1, 1.8, 0.01],
  ['width', 'width', 0.03, 0.45, 0.005],
  ['tip', 'tip taper', 0.1, 1.6, 0.01, 'contour'],
  ['cup', 'cup', -0.3, 0.6, 0.01],
  ['twist', 'twist', -8, 8, 0.01],
  ['downTo', 'downy base', 0, 0.7, 0.01, 'contour'],
  ['bend', 'bend', -0.5, 0.5, 0.01],
  ['sweep', 'sweep', -0.5, 0.5, 0.01],
  ['ruffle', 'dishevelled', 0, 1, 0.01, 'down'],
];
const CHARACTER = [
  ['fray', 'loose edge', 0, 1, 0.01],
  ['splits', 'notches', 0, 0.4, 0.005],
  ['sheen', 'sheen', 0, 2.5, 0.01],
  ['barbs', 'barbs sweep', 0.6, 1.8, 0.01],
  ['flow', 'flow', -0.4, 0.4, 0.005],
  ['scurve', 'S curve', -0.2, 0.2, 0.005],
  ['locks', 'locks', 0, 1, 0.01, 'contour'],
  ['stir', 'stir', 0, 0.2, 0.002],
];
const COLOUR = [
  ['fringe', 'fringe', 0, 0.6, 0.01, 'contour'],
  ['band', 'band', 0, 1, 0.01, 'contour'],
  ['bandAt', 'band place', 0.4, 0.97, 0.01, 'contour'],
  ['hue', 'colour spread', 0, 0.15, 0.005],
  ['grad', 'to the tip', 0, 1, 0.01, 'contour'],
];
const MARK = [
  ['density', 'density', 1, 14, 0.1, 'contour'],
  ['strength', 'strength', 0, 1, 0.01, 'contour'],
];
const SHEEN = [
  ['iri', 'iridescence', 0, 1, 0.01, 'contour'],
  ['film', 'film (µm)', 0.2, 0.8, 0.005, 'contour'],
];
const VARY = [['vary', 'shape spread', 0, 0.6, 0.01]];

const STORE = 'feather-lab-5';
const clone = (o) => JSON.parse(JSON.stringify(o));
function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE));
    if (Array.isArray(saved) && saved.length === DEFAULTS.length) return DEFAULTS.map((d, i) => ({ ...clone(d), ...saved[i], name: d.name, kind: d.kind }));
  } catch {}
  return clone(DEFAULTS);
}
let types = load();
// ?lab&shape=sickle: the display type in that shape, for this visit
{
  const S = DISPLAY_SHAPES[new URLSearchParams(location.search).get('shape')];
  if (S) Object.assign(types[2], { shape: new URLSearchParams(location.search).get('shape'), width: S.width, twist: S.twist, ...(S.eye ? { mark: 4 } : {}) });
}
const save = () => localStorage.setItem(STORE, JSON.stringify(types));

// ---- the scene
document.getElementById('hint').remove();
document.getElementById('bar').remove();
const params = new URLSearchParams(location.search);
const pr = params.has('pr') ? +params.get('pr') : Math.min(devicePixelRatio, 2);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(pr);
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.02, 200);
stage(scene);
const shadow = new KeyShadow(renderer);
const post = new Post(renderer);
// no body here: nothing darkening the floor or the feathers round it
LIGHTS.uBody.value.set(0, -100, 0, 0);
LIGHTS.uCoverage.value = 0;

const MAX = DEFAULTS.length * 6;
const feathers = new FeatherMesh(MAX);
scene.add(feathers.mesh);

// the feathers stand upright, centred at this height, side by side
const MID = 0.95;
let placed = []; // { x, y, phase, group }
let groups = []; // { x0, x1, h }

const col = new THREE.Color(), hsl = {};
function build() {
  const a = feathers.arrays;
  a.iBend.fill(0);
  placed = [];
  groups = [];
  let slot = 0, x = 0;
  types.forEach((ty, g) => {
    const down = ty.kind === 1;
    const x0 = x;
    let h = 0;
    for (let i = 0; i < ty.count; i++, slot++) {
      const r = rng(ty.seed * 977 + i * 131 + 7);
      const v = (k = 1) => 1 + (r() - 0.5) * 2 * ty.vary * k;
      const L = ty.L * v();
      const width = ty.width * v(0.7);
      const half = Math.max(width * L * (down ? 1.4 : 1.15), 0.03);
      const side = Math.abs(ty.sweep) * L * 0.6;
      x += half + side;
      const y = MID - L * 0.5;
      placed.push({ slot, x, y, phase: slot * 1.7, group: g });
      x += half + side + 0.05;
      h = Math.max(h, L);

      const s4 = slot * 4, s3 = slot * 3;
      a.iPos.set([x, y, 0], s3);
      a.iQuat.set([0, 0, 0, 1], s4);
      a.iBend.set([ty.sweep + (r() - 0.5) * ty.vary * 0.3, 0, ty.bend + (r() - 0.5) * ty.vary * 0.3, 1], s4);
      a.iShape.set([L, width, ty.cup * v(0.5), ty.twist + (r() - 0.5) * ty.vary * 0.5], s4);
      a.iCurve.set([1.4, 0.15, 0.3, 0], s4); // (only for a feather on the body)
      // (a display shape: 2 + its index)
      const shape = DISPLAY_SHAPE_NAMES.indexOf(ty.shape);
      a.iLook.set([r() * 997, !down && shape >= 0 ? 2 + shape : ty.kind, ty.downTo * v(0.3), 0], s4);
      a.iPat.set([ty.fringe * v(0.5), ty.band * v(0.5), ty.bandAt + (r() - 0.5) * ty.vary * 0.05, ty.tip * v(0.4)], s4);
      a.iForm.set(down ? [Math.min(1, ty.ruffle * v(0.5)), 0, 1, 1] : [ty.fray * v(0.5), ty.splits * v(0.5), ty.sheen, ty.barbs * v(0.1)], s4);
      col.set(ty.colA).getHSL(hsl);
      col.setHSL(hsl.h + (r() - 0.5) * 2 * ty.hue, hsl.s * (1 + (r() - 0.5) * ty.hue * 4), hsl.l * (1 + (r() - 0.5) * ty.hue * 5));
      a.iColA.set([col.r, col.g, col.b], s4);
      col.set(ty.colB).getHSL(hsl);
      col.setHSL(hsl.h + (r() - 0.5) * ty.hue, hsl.s, hsl.l);
      a.iColB.set([col.r, col.g, col.b], s4);
      col.set(ty.colC).getHSL(hsl);
      col.setHSL(hsl.h + (r() - 0.5) * ty.hue, hsl.s, hsl.l);
      const tip = col.clone();
      col.set(ty.colD);
      a.iMark.set([down ? 0 : ty.mark, ty.density * v(0.2), ty.strength, ty.grad * v(0.5)], s4);
      // the tip's and the mark's colours, the sheen in their w (iridescence, film)
      const iri = down ? 0 : ty.iri * v(0.3), film = ty.film * (1 + (r() - 0.5) * 0.04);
      a.iColC.set([tip.r, tip.g, tip.b], s4);
      a.iColD.set([col.r, col.g, col.b], s4);
      setFlow(a, slot, [ty.flow * v(0.5), ty.scurve * v(0.5), down ? 0 : ty.locks * v(0.3), ty.stir], iri, film);
    }
    groups.push({ x0, x1: x - 0.05, h });
    x += 0.25;
  });
  // centred on x = 0
  const shift = -(x - 0.25) / 2;
  for (const p of placed) p.x += shift;
  for (const gr of groups) { gr.x0 += shift; gr.x1 += shift; }
  feathers.touch(...Object.keys(feathers.arrays));
  pose(time);
  placeLabels();
}

// each feather turns about its shaft: a little to and fro, all the way round, or not
let motion = params.get('motion') || 'sway';
const qa = new THREE.Quaternion(), yAxis = new THREE.Vector3(0, 1, 0);
function pose(t) {
  const a = feathers.arrays;
  for (const p of placed) {
    const ang = motion === 'spin' ? t * 0.5 + p.phase : motion === 'sway' ? Math.sin(t * 0.45 + p.phase) * 0.5 : 0;
    qa.setFromAxisAngle(yAxis, ang);
    a.iQuat.set([qa.x, qa.y, qa.z, qa.w], p.slot * 4);
    a.iPos[p.slot * 3] = p.x;
  }
  feathers.touch('iQuat', 'iPos');
}

// ---- the view: turned round by dragging, zoomed with the wheel, eased to a group
const view = { az: 0, el: 0.12, dist: 6, target: new THREE.Vector3(0, MID, 0) };
const want = { target: new THREE.Vector3(0, MID, 0), dist: 6 };
function fit(x0, x1, h) {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const w = (x1 - x0) * 0.5 + 0.15, hh = h * 0.5 + 0.12;
  // room for the panel on the right
  const usable = Math.max(camera.aspect * (1 - 300 / innerWidth), 0.5);
  return Math.max(w / (tan * usable), hh / tan) * 1.05 / zoom;
}
let focus = -1;
const zoom = params.has('zoom') ? +params.get('zoom') || 1 : 1;
function lookAll() {
  focus = -1;
  const x0 = groups[0].x0, x1 = groups.at(-1).x1;
  want.dist = fit(x0, x1, Math.max(...groups.map((g) => g.h)));
  want.target.set((x0 + x1) / 2 + offsetForPanel(want.dist), MID, 0);
}
function lookAt(g) {
  focus = g;
  groupBoxes.forEach((b, i) => (b.open = i === g));
  const gr = groups[g];
  want.dist = fit(gr.x0, gr.x1, gr.h);
  want.target.set((gr.x0 + gr.x1) / 2 + offsetForPanel(want.dist), MID, 0);
}
// the target a little to the right so the feathers sit in the space left of the panel
function offsetForPanel(dist) {
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  return (170 / innerWidth) * 2 * tan * camera.aspect * dist * 0.5;
}
function placeCamera(dt) {
  const k = 1 - Math.exp(-dt * 4);
  view.target.lerp(want.target, k);
  if (want.dist) view.dist += (want.dist - view.dist) * k;
  camera.position.set(Math.sin(view.az) * Math.cos(view.el), Math.sin(view.el), Math.cos(view.az) * Math.cos(view.el)).multiplyScalar(view.dist).add(view.target);
  camera.lookAt(view.target);
  camera.updateMatrixWorld();
}
const el = renderer.domElement;
let orbit = null;
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  orbit = { x: e.clientX, y: e.clientY, az: view.az, el: view.el };
});
el.addEventListener('pointermove', (e) => {
  if (!orbit) return;
  view.az = orbit.az - (e.clientX - orbit.x) * 0.006;
  view.el = THREE.MathUtils.clamp(orbit.el + (e.clientY - orbit.y) * 0.004, -0.3, 1.3);
});
const up = () => { orbit = null; };
el.addEventListener('pointerup', up);
el.addEventListener('pointercancel', up);
el.addEventListener('wheel', (e) => {
  e.preventDefault();
  want.dist = null;
  view.dist = THREE.MathUtils.clamp(view.dist * Math.exp(e.deltaY * 0.0012), 0.15, 14);
}, { passive: false });

// ---- the panel
const CSS = `
#lab { position: fixed; top: 10px; right: 10px; bottom: 10px; width: 270px; overflow-y: auto; z-index: 2;
  font: 12px/1.3 system-ui, -apple-system, sans-serif; color: #2f2b27; user-select: none;
  display: flex; flex-direction: column; gap: 6px; scrollbar-width: thin; }
#lab.hidden > :not(.top) { display: none; }
#lab .box { background: rgba(240, 236, 229, 0.86); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  border-radius: 9px; box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12); padding: 6px 10px; }
#lab .top { display: flex; flex-wrap: wrap; gap: 2px 4px; align-items: center; }
#lab button { font: inherit; color: inherit; background: none; border: 0; padding: 3px 6px; border-radius: 6px; cursor: pointer; }
#lab button:hover { background: rgba(0, 0, 0, 0.07); }
#lab button.on { background: #2f2b27; color: #f0ece5; }
#lab summary { cursor: pointer; display: flex; align-items: center; gap: 6px; font: italic 14px Georgia, serif; padding: 2px 0; }
#lab summary::-webkit-details-marker { display: none; }
#lab summary .name { flex: 1; }
#lab summary .swatch { width: 10px; height: 10px; border-radius: 50%; box-shadow: 0 0 0 1px rgba(0,0,0,0.2); }
#lab details[open] summary { margin-bottom: 4px; }
#lab .row { display: grid; grid-template-columns: 78px 1fr 34px; align-items: center; gap: 6px; height: 20px; }
#lab .row .k { opacity: 0.6; white-space: nowrap; overflow: hidden; }
#lab .row .v { font-variant-numeric: tabular-nums; text-align: right; opacity: 0.8; }
#lab input[type=range] { width: 100%; margin: 0; accent-color: #9b5a3c; }
#lab select { font: inherit; width: 100%; background: none; border: 1px solid rgba(0,0,0,0.15); border-radius: 4px; }
#lab input[type=color] { width: 100%; height: 18px; padding: 0; border: 0; background: none; cursor: pointer; }
#lab .sub { margin: 6px 0 2px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.4; }
#lab .chars { display: flex; gap: 2px; margin: 2px 0 4px; }
#lab .chars button { flex: 1; font-style: italic; }
#lab .seed { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
#lab .seed span { opacity: 0.6; flex: 1; }
.lab-label { position: fixed; transform: translate(-50%, 0); font: italic 13px Georgia, serif; color: #2f2b27;
  opacity: 0.55; pointer-events: none; white-space: nowrap; }
`;
const style = document.createElement('style');
style.textContent = CSS;
document.head.append(style);
const mk = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const panel = mk('div');
panel.id = 'lab';
document.body.append(panel);

const top = mk('div', 'box top');
panel.append(top);
const motionButtons = ['still', 'sway', 'spin'].map((m) => {
  const b = mk('button', null, m);
  b.onclick = () => { motion = m; motionButtons.forEach((x) => x.classList.toggle('on', x === b)); };
  b.classList.toggle('on', m === motion);
  top.append(b);
  return b;
});
top.append(mk('span', null, '·'));
const allB = mk('button', null, 'all');
allB.onclick = lookAll;
const copyB = mk('button', null, 'copy');
copyB.title = 'the settings, as JSON, to the clipboard';
copyB.onclick = async () => {
  await navigator.clipboard.writeText(JSON.stringify(types, null, 2));
  copyB.textContent = 'copied';
  setTimeout(() => (copyB.textContent = 'copy'), 1200);
};
const birdB = mk('button', null, 'bird');
birdB.title = 'the colours of a bird drawn at random';
birdB.onclick = () => {
  const p = plumage(Math.floor(Math.random() * 1e6));
  const hex = (c) => `#${c.getHexString()}`;
  [p.regions.back, p.regions.breast, p.regions.display].forEach((rg, g) => {
    Object.assign(types[g], {
      colA: hex(rg.a), colB: hex(rg.b), colC: hex(rg.c), colD: hex(rg.d),
      band: rg.band, grad: rg.grad, mark: rg.mark, density: rg.density, strength: rg.strength, iri: rg.iri, film: rg.film,
    });
  });
  // the down white, barely tinted by the belly over it (as on the creature)
  types[3].colA = hex(p.regions.belly.a.clone().lerp(new THREE.Color(0.95, 0.94, 0.92), 0.9));
  save(); buildPanel(); build();
};
const resetB = mk('button', null, 'reset');
resetB.onclick = () => { types = clone(DEFAULTS); save(); buildPanel(); build(); lookAll(); };
const back = mk('a', null, 'creature ↗');
back.href = location.pathname;
back.style.cssText = 'margin-left:auto;color:inherit;opacity:.6;text-decoration:none';
top.append(allB, birdB, copyB, resetB, back);

const labels = [];
let groupBoxes = [];
function buildPanel() {
  const wasOpen = groupBoxes.map((b) => b.open);
  groupBoxes.forEach((b) => b.remove());
  labels.forEach((l) => l.remove());
  labels.length = 0;
  groupBoxes = types.map((ty, g) => {
    const box = mk('details', 'box');
    box.open = wasOpen[g] ?? g === 0;
    const sum = mk('summary');
    const sw = mk('span', 'swatch');
    const name = mk('span', 'name', ty.name);
    const fb = mk('button', null, '◎');
    fb.title = 'look closer';
    fb.onclick = (e) => { e.preventDefault(); lookAt(g); };
    sum.append(sw, name, fb);
    box.append(sum);
    const paint = () => { sw.style.background = ty.kind ? ty.colA : `linear-gradient(135deg, ${ty.colA} 55%, ${ty.colB} 55%)`; };
    paint();
    const contour = ty.kind === 0;
    const section = (title, list) => {
      box.append(mk('div', 'sub', title));
      for (const [k, text, min, max, step, only] of list) {
        if ((only === 'contour' && !contour) || (only === 'down' && contour)) continue;
        const row = mk('div', 'row');
        const input = mk('input');
        Object.assign(input, { type: 'range', min, max, step, value: ty[k] });
        const fmt = (x) => (step >= 1 ? String(x) : x.toFixed(2));
        const val = mk('span', 'v', fmt(ty[k]));
        input.oninput = () => { ty[k] = +input.value; val.textContent = fmt(ty[k]); build(); save(); };
        input.ondblclick = () => { ty[k] = DEFAULTS[g][k]; input.value = ty[k]; val.textContent = fmt(ty[k]); build(); save(); };
        row.append(mk('span', 'k', text), input, val);
        box.append(row);
      }
    };
    if (contour) {
      const row = mk('div', 'chars');
      const bs = CHARACTER_NAMES.map((c) => {
        const b = mk('button', null, c);
        b.classList.toggle('on', ty.char === c);
        b.onclick = () => {
          Object.assign(ty, withChar(ty, c));
          // (a display shape keeps its own width and twist)
          const S = DISPLAY_SHAPES[ty.shape];
          if (S) Object.assign(ty, { width: S.width, twist: S.twist });
          save(); buildPanel(); build();
        };
        row.append(b);
        return b;
      });
      box.append(row);
    }
    if ('shape' in ty) {
      // the display type's wilder shapes
      const row = mk('div', 'chars');
      for (const name of ['feather', ...DISPLAY_SHAPE_NAMES]) {
        const b = mk('button', null, name);
        b.classList.toggle('on', (DISPLAY_SHAPES[ty.shape] ? ty.shape : 'feather') === name);
        b.onclick = () => {
          const S = DISPLAY_SHAPES[name];
          Object.assign(ty, S ? { shape: name, width: S.width, twist: S.twist, ...(S.eye ? { mark: 4 } : {}) } : { shape: 'feather', width: CHARACTERS[ty.char].width, twist: CHARACTERS[ty.char].twist });
          save(); buildPanel(); build();
        };
        row.append(b);
      }
      row.style.flexWrap = 'wrap';
      box.append(row);
    }
    section('shape', SHAPE);
    if (contour) section('character', CHARACTER);
    box.append(mk('div', 'sub', 'colour'));
    for (const [k, text] of contour ? [['colA', 'vane'], ['colC', 'tip colour'], ['colB', 'fringe colour'], ['colD', 'mark colour']] : [['colA', 'colour']]) {
      const row = mk('div', 'row');
      const input = mk('input');
      Object.assign(input, { type: 'color', value: ty[k] });
      const val = mk('span', 'v');
      input.oninput = () => { ty[k] = input.value; paint(); build(); save(); };
      row.append(mk('span', 'k', text), input, val);
      box.append(row);
    }
    section('', COLOUR);
    box.querySelectorAll('.sub:empty').forEach((s) => s.remove());
    if (contour) {
      box.append(mk('div', 'sub', 'mark'));
      const row = mk('div', 'row');
      const sel = mk('select');
      for (const [name, v] of Object.entries(MARKS)) {
        const o = mk('option', null, name);
        o.value = v;
        sel.append(o);
      }
      sel.value = ty.mark;
      sel.onchange = () => { ty.mark = +sel.value; build(); save(); };
      row.append(mk('span', 'k', 'pattern'), sel, mk('span', 'v'));
      box.append(row);
      section('', MARK);
      section('sheen', SHEEN);
      box.querySelectorAll('.sub:empty').forEach((s) => s.remove());
    }
    section('variation', VARY);
    const seedRow = mk('div', 'seed');
    const seedText = mk('span', null, `seed ${ty.seed}`);
    const prev = mk('button', null, '‹');
    const next = mk('button', null, 'other ›');
    const step = (d) => { ty.seed = Math.max(1, ty.seed + d); seedText.textContent = `seed ${ty.seed}`; build(); save(); };
    prev.onclick = () => step(-1);
    next.onclick = () => step(1);
    seedRow.append(seedText, prev, next);
    box.append(seedRow);
    panel.append(box);

    const label = mk('div', 'lab-label', ty.name);
    document.body.append(label);
    labels.push(label);
    return box;
  });
}

// the groups' names on the floor under them
const pv = new THREE.Vector3();
function placeLabels() {
  groups.forEach((gr, g) => {
    pv.set((gr.x0 + gr.x1) / 2, MID - gr.h * 0.5 - 0.1, 0).project(camera);
    const l = labels[g];
    if (!l) return;
    l.style.left = `${(pv.x * 0.5 + 0.5) * innerWidth}px`;
    l.style.top = `${(-pv.y * 0.5 + 0.5) * innerHeight}px`;
    l.style.display = pv.z < 1 ? '' : 'none';
    l.style.opacity = focus < 0 || focus === g ? 0.55 : 0.2;
  });
}

addEventListener('keydown', (e) => {
  if (e.target.matches?.('input, select, textarea')) return;
  if (e.key === 'h') {
    panel.classList.toggle('hidden');
    labels.forEach((l) => (l.hidden = panel.classList.contains('hidden')));
  }
  if (e.key === 'a') lookAll();
  if (e.key >= '1' && e.key <= String(types.length)) lookAt(+e.key - 1);
});

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.setSize(Math.floor(innerWidth * pr), Math.floor(innerHeight * pr));
  if (focus < 0) lookAll(); else lookAt(focus);
}
focus = params.has('focus') ? THREE.MathUtils.clamp(+params.get('focus') - 1, 0, DEFAULTS.length - 1) : -1;

let time = 0;
buildPanel();
build();
addEventListener('resize', resize);
resize();
view.dist = want.dist;
view.target.copy(want.target);

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  if (motion !== 'still') time += dt;
  else time = 0;
  placeCamera(dt);
  pose(time);
  placeLabels();
  LIGHTS.uTime.value = time;
  shadow.render(scene);
  renderer.setRenderTarget(post.target);
  renderer.render(scene, camera);
  post.render(time);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__lab = { get types() { return types; }, build, lookAt, lookAll, view };
