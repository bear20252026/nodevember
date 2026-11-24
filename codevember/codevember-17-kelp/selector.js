// The brush selector: a liquid-glass pill of round wells, one per kind of kelp, each a
// little live view of that kind, fully grown, swaying in the scene's surge (but not stirred
// by the pointer: they keep to themselves), on a
// pale ground. Picking a well shows a fresh plant of that kind, a new shape.
// The camera stands where the main one does (the lighting is relative to it); the water's
// fog is left out, so the plants keep their colours against the pale ground.
// Each well is framed close on what tells its kind apart (FRAME), not the whole plant.
// One small offscreen renderer draws every well in turn, copied into each well's canvas.
import * as THREE from 'three';
import { sharedUniforms } from './water.js';
import { Plant } from './kelp.js';
import { STYLES } from './styles.js';

const DIST = 12; // the camera's distance to the plants (as the main view's foreground)
// how long a stroke each kind is drawn with, its head (float, mane) kept in the well
const LEN = { giant: 52, bull: 30, sugar: 44, boa: 48, strap: 46, lace: 44, wrack: 40 };
// how a kind is drawn in its well, thicker and darker: sea lace's cords, true to scale, are
// finer than a pixel there, and their pale greens wash out against the pale ground
const BOLD = { lace: { thick: 2.4, shade: 0.6 } };
// how each well frames its plant: not the whole plant (at that size they are all a thin
// stalk) but close on what tells that kind apart, `at` that far up the stipe (0 the
// holdfast, 1 the tip) or, `head`, on the middle of all it bears beyond the stipe there
// (a mane, straps), `zoom` times nearer than the whole plant
const FRAME = {
  giant: { at: 0.72, zoom: 2.3 }, // blades on their pear floats
  bull: { at: 0.8, head: true, zoom: 1.9 }, // the one big float and its mane
  sugar: { at: 0.55, zoom: 1.75 }, // the one broad frilled blade
  boa: { at: 0.68, zoom: 2.8 }, // a strap fringed with little blades
  strap: { at: 0.6, head: true, zoom: 1.5 }, // its few broad straps
  lace: { at: 0.55, zoom: 1.6 }, // the tuft of cords
  wrack: { at: 0.4, zoom: 2.4 }, // its bladders and where it forks past them
};

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

export function createSelector({ container, choices, camPos, flow, onPick }) {
  const rand = rngOf(Math.floor(Math.random() * 1e9));
  const size = () => container.querySelector('canvas')?.clientWidth || 56;
  const dpr = Math.min(devicePixelRatio, 2);

  // transparent: the well's pale ground (CSS) shows behind the plant
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x000000, 0);
  const FOV = 27; // the whole plant's; each well narrows it to its frame
  const cam = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);
  cam.position.copy(camPos);
  cam.lookAt(0, camPos.y - 0.2, camPos.z - DIST);
  cam.updateMatrixWorld();
  const scene = new THREE.Scene();
  // world per plant unit: a plant of ~70 units fills most of the well
  const U = (2 * DIST * Math.tan((FOV * Math.PI) / 360)) / 68;
  // where the root sits: a little above the bottom of the well
  const rootY = camPos.y - 0.2 - (DIST * Math.tan((FOV * Math.PI) / 360)) * 0.82;

  const wells = choices.map((key) => {
    const el = document.createElement('button');
    el.className = 'well';
    el.dataset.k = key;
    el.title = STYLES[key].label;
    const canvas = document.createElement('canvas');
    el.append(canvas);
    el.addEventListener('click', () => onPick(key));
    container.append(el);
    return { key, el, canvas, ctx: canvas.getContext('2d'), plant: null, focus: new THREE.Vector3() };
  });

  // a plant of the well's kind, drawn all at once and already grown
  function sprout(w, t) {
    if (w.plant) { scene.remove(w.plant.mesh); w.plant.dispose(); }
    const k = w.key;
    const x = (rand() - 0.5) * 0.6;
    const origin = new THREE.Vector3(x, rootY, camPos.z - DIST);
    const born = t - 10; // its blades and floats long unfurled
    const p = new Plant({ style: STYLES[k], origin, U, screen: { x: 40 + x * 6, y: 8 }, anchored: true, rand: rngOf(Math.floor(rand() * 1e9)), time: born });
    const b = BOLD[k];
    if (b) for (const st of p.strands) {
      const wf = st.width;
      st.width = (i, n) => wf(i, n) * b.thick;
      st.color.multiplyScalar(b.shade);
    }
    const L = LEN[k] * (0.9 + rand() * 0.2);
    const lean = (rand() - 0.5) * 0.35, bend = (rand() - 0.5) * 12, ph = rand() * 6;
    for (let s = 0; s <= L; s += 0.5) {
      const u = s / L;
      p.extend(Math.sin(lean) * s + bend * Math.sin(u * 2.4 + ph) - bend * Math.sin(ph), Math.cos(lean) * s);
    }
    p.release(born); // already given to the current
    p.update(0, t, flow);
    w.plant = p;
    aim(w, 1);
  }

  // the point the well is framed on, eased after the plant as it sways, so the sway still shows
  const tmp = new THREE.Vector3();
  function aim(w, k) {
    const p = w.plant, sp = p.spine, f = FRAME[w.key];
    const i = Math.min(sp.n, Math.round(sp.n * f.at));
    let x = sp.px[i] ?? 0, y = sp.py[i] ?? 0;
    if (f.head) {
      let n = 1;
      for (const st of p.strands) if (st !== sp) for (let j = 0; j <= st.n; j++) { x += st.px[j]; y += st.py[j]; n++; }
      x /= n; y /= n;
    }
    tmp.set(x, y, 0).multiplyScalar(p.U).add(p.mesh.position);
    w.focus.lerp(tmp, k);
  }
  for (const w of wells) sprout(w, 0);

  function update(dt, t) {
    for (const w of wells) { w.plant.update(dt, t, flow); aim(w, Math.min(1, dt * 0.6)); }
  }

  function render() {
    const px = Math.round(size() * dpr);
    if (renderer.domElement.width !== px) renderer.setSize(px, px, false);
    const fog = sharedUniforms.uFog.value;
    sharedUniforms.uFog.value = 0;
    for (const w of wells) {
      if (w.canvas.width !== px) { w.canvas.width = px; w.canvas.height = px; }
      const f = FRAME[w.key];
      cam.fov = (2 * Math.atan(Math.tan((FOV * Math.PI) / 360) / f.zoom) * 180) / Math.PI;
      cam.updateProjectionMatrix();
      cam.lookAt(w.focus);
      cam.updateMatrixWorld();
      scene.add(w.plant.mesh);
      renderer.render(scene, cam);
      scene.remove(w.plant.mesh);
      w.ctx.clearRect(0, 0, px, px);
      w.ctx.drawImage(renderer.domElement, 0, 0);
    }
    sharedUniforms.uFog.value = fog;
  }

  return {
    update,
    render,
    // mark the picked well, and give it a new plant to show it off
    select(key, t) {
      for (const w of wells) {
        const on = w.key === key;
        if (on && !w.el.classList.contains('on') && t !== undefined) sprout(w, t);
        w.el.classList.toggle('on', on);
      }
    },
  };
}
