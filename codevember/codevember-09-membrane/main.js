// Membrane. A slice of a life form, under the microscope, and its death: a ring of jelly
// blocks, each with a small dark core, between two thin blurry films, holding a thick,
// marbled fluid (a continuum, on a grid) with a nucleus, vesicles, and the inclusions it
// carries: filaments, mitochondria, reticulum, granules. The membrane breathes
// and the fluid streams round inside, until it is killed (k) or torn by hand — where it is
// clicked, or pulled too far — and the fluid oozes out, thickening as it sets, while the
// slackened membrane crumples and falls apart in loose blocks, its films peeling off in a few
// long ribbons. All of it lies in a thick,
// invisible medium that slows what leaves the cell and drifts it slowly, specks, fibres and
// small wrigglers drifting and swimming about in it (medium.js). Then a new cell.
// The logic is all 2d (sim.js), in the plane; the scene is 3d, seen from above, tilted.
//   ?seed=n     the cell (the seed is in the bar)
//   &after=40   seconds of death before a new cell
//   &t=12       start that many seconds in
//   &still      stopped there, &pr=2 a fixed pixel ratio
//   &medium=1   how much drifts in the medium round the cell (0: nothing)
//   &hair=1     how many hairs on the cell's outside (0: none)
//   &cells=0.18 how strongly the outer film shows its pattern of small cells (0: plain; 0.18 barely, 1 fully)
//   &sound=0    silent until m is pressed, &vol=0.8 its volume (sound.js: it starts on the first
//               click, key or wheel, browsers allowing no sooner)
// Keys: k kill (tear it somewhere), r a new cell, space pause, m sound, h hide the bar. Grab the cell
// (membrane, fluid, nucleus) and pull it about; pulled too far it tears; double click to
// tear it there; drag off the cell to tilt and turn the slide.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSim, rng, N, R, T } from './sim.js';
import { G, FW } from './fluid.js';
import {
  createBackdrop, createFluidSurface, createJellyMaterial, createBlockGeometry, createCoreMaterial,
  createFilmMaterial, createLiquidMaterial, createNucleusMaterial, createVesicleMaterial,
  createStrandMaterial, createGranulePoints, createDomeGeometry, createBodyShadowMaterial, fluidProfile,
  createMediumPoints, createMediumStrandMaterial, createFlocMaterial, createHairMaterial,
} from './look.js';
import { createMedium } from './medium.js';
import { KIND } from './inclusions.js';
import { createFilms, createCurve, ringCurve, S, M } from './films.js';
import { createHairs, HP } from './hairs.js';
import { createSound } from './sound.js';

const params = new URLSearchParams(location.search);
const num = (k, d) => (params.has(k) && !isNaN(parseFloat(params.get(k))) ? parseFloat(params.get(k)) : d);
let seed = Math.floor(num('seed', Math.floor(Math.random() * 1e5)));
const AFTER = num('after', 40);
const DT = 1 / 60;
const DEPTH = 0.27; // the blocks' depth (out of the plane)
const EASE_POP = 4; // how fast a block eases into its new shape when a link gives way (per second)

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, num('pr', 2)));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.style.transition = 'opacity 0.9s';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;
const key = new THREE.DirectionalLight(0xfff4f8, 2.2);
key.position.set(-4, 5, 8);
scene.add(key, new THREE.HemisphereLight(0xffeef6, 0x8a6a80, 0.6));

// ---- camera: from above, tilted, turning slowly
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 200);
// zoomed in (mag > 1), it looks at a point of the slide off the centre: the one the zoom went to
const view = { tilt: 0.85, turn: -0.5, dist: 22, mag: 1, tx: 0, ty: 0 };
function placeCamera(clock) {
  const turn = view.turn + clock * 0.012;
  camera.position.set(
    view.tx + Math.sin(view.tilt) * Math.sin(turn) * view.dist,
    view.ty - Math.sin(view.tilt) * Math.cos(turn) * view.dist,
    Math.cos(view.tilt) * view.dist,
  );
  // away from the camera, along the slide (tilted with the view, so it stays defined near the floor)
  camera.up.set(-Math.cos(view.tilt) * Math.sin(turn), Math.cos(view.tilt) * Math.cos(turn), Math.sin(view.tilt));
  camera.lookAt(view.tx, view.ty, 0);
}

// ---- the fluid's grid, for its surface (and its shadow on the slide): its dye and walls,
// its material coordinates (half floats,
// which every WebGL2 filters)
const dyeData = new Uint16Array(G * G * 2), flowData = new Uint16Array(G * G * 4);
const dyeTex = new THREE.DataTexture(dyeData, G, G, THREE.RGFormat, THREE.HalfFloatType);
const flowTex = new THREE.DataTexture(flowData, G, G, THREE.RGBAFormat, THREE.HalfFloatType);
// and the medium's grain (fixed for a cell): its fibres' direction (doubled: cos 2θ, sin 2θ,
// so it filters across their ends) and how readily the fluid creeps along them; in its alpha,
// how far the spill has soaked into it there (soak)
const grainData = new Uint8Array(G * G * 4);
const grainTex = new THREE.DataTexture(grainData, G, G, THREE.RGBAFormat);
function setGrain({ fc, fs, fk }) {
  for (let k = 0; k < G * G; k++) {
    grainData[k * 4] = Math.round((fc[k] * fc[k] - fs[k] * fs[k] + 1) * 127.5);
    grainData[k * 4 + 1] = Math.round((2 * fc[k] * fs[k] + 1) * 127.5);
    grainData[k * 4 + 2] = Math.round(fk[k] * 255);
    grainData[k * 4 + 3] = 0;
  }
  soak.fill(0);
  grainTex.needsUpdate = true;
}
// the spill soaks into the medium slowly: where it lies free of the membrane's walls, each
// spot of the slide takes it up over a couple of seconds, slower where it lies thin, and keeps it
const SOAK_T = 2.2;
const soak = new Float32Array(G * G);
function soakIn(c, simDt) {
  if (sim.dying < 0 || simDt <= 0) return;
  const lo = sim.RW + 0.02, hi = sim.RW + 2 * sim.fluid.HC;
  for (let k = 0; k < G * G; k++) {
    if (c[k] < 0.01 || soak[k] >= 1) continue;
    const free = THREE.MathUtils.smoothstep(wall[k], lo, hi);
    soak[k] = Math.min(1, soak[k] + (simDt / SOAK_T) * free * Math.min(1, c[k] / 0.3));
    grainData[k * 4 + 3] = Math.round(soak[k] * 255);
  }
  grainTex.needsUpdate = true;
}
for (const t of [dyeTex, flowTex, grainTex]) { t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
const backdrop = createBackdrop();
Object.assign(backdrop.material.uniforms, { uDye: { value: dyeTex }, uGrain: { value: grainTex } });
backdrop.material.uniforms.uTexel.value = 1 / G;
backdrop.material.uniforms.uFW.value = FW;
scene.add(backdrop);
// the fluid's surface: just under the blocks' height inside the living cell (it fills it), settling
// lower as it dies and spreads
const FLUID_H = 0.105; // a little under the blocks' height
const SUNK = 0.4; // how much of the nucleus's height is under the fluid's surface (the vesicles: each its own, vesicleSink)
const surface = createFluidSurface(FW, G);
const su = surface.material.uniforms;
su.uDye.value = dyeTex; su.uFlow.value = flowTex; su.uGrain.value = grainTex;
scene.add(surface);
// the fluid's own surface (as high as its mesh, inside the cell), and where what floats in it
// is drawn (a little above it, surfaceZ)
const waterZ = (x, y) => su.uH.value * fluidProfile(sim.fluid.dye(x, y));
const surfaceZ = (x, y) => (su.uH.value + 0.008) * fluidProfile(sim.fluid.dye(x, y)) + 0.012;
const toHalf = THREE.DataUtils.toHalfFloat;

let zoom = 0; // 0 the cell at rest, 1 pulled far out of shape
function fit() {
  const aspect = innerWidth / innerHeight;
  const halfH = Math.max(4.3 + zoom * 1.9, (5.2 + zoom * 2.4) / aspect) / view.mag; // the cell, however pulled, on any screen (no zooming out over the leak once it is torn), then zoomed in by hand
  camera.fov = (2 * Math.atan(halfH / view.dist) * 180) / Math.PI;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.getDrawingBufferSize(su.uRes.value);
}
addEventListener('resize', fit);
fit();

// ---- what drifts in the medium round the cell: not the cell's, it stays from one cell to the next
const medium = createMedium(rng(seed * 3 + 11), num('medium', 1));
const motes = createMediumPoints(medium.P);
motes.geometry.attributes.kind.array.set(medium.pkind);
motes.geometry.attributes.size.array.set(medium.psize);
motes.geometry.attributes.vary.array.set(medium.pvary);
motes.renderOrder = -6;
const fibres = makeMediumStrands();
fibres.renderOrder = -6;
const flocs = makeFlocs();
flocs.renderOrder = -7;
scene.add(motes, fibres, flocs);
// the flocs: a quad each, lying on the slide at its height
function makeFlocs() {
  const nv = medium.F * 4, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(nv), 1));
  const local = new Float32Array(nv * 2), seed = new Float32Array(nv), kind = new Float32Array(nv), index = [];
  for (let i = 0; i < medium.F; i++) {
    local.set([-1, -1, 1, -1, 1, 1, -1, 1], i * 8);
    seed.fill(medium.fseed[i], i * 4, i * 4 + 4);
    kind.fill(medium.fkind[i], i * 4, i * 4 + 4);
    const v = i * 4;
    index.push(v, v + 1, v + 2, v, v + 2, v + 3);
  }
  geo.setAttribute('local', new THREE.BufferAttribute(local, 2));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, createFlocMaterial());
  mesh.frustumCulled = false;
  return mesh;
}
function makeMediumStrands() {
  const nv = medium.NN * 2, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  for (const k of ['along', 'alpha']) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(nv), 1));
  const side = new Float32Array(nv), kind = new Float32Array(nv), vary = new Float32Array(nv), taper = new Float32Array(nv), index = [];
  for (const s of medium.strands) {
    for (let i = 0; i < s.n; i++) {
      const v = (s.start + i) * 2, f = Math.min(i, s.n - 1 - i) + 0.5;
      // the ends: thinning out (a fibre), rounded (a wriggler)
      const k = s.kind === 1 ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(1, f / 1.5)) ** 2)) : 0.3 + 0.7 * Math.min(1, f / 3);
      side.set([-1, 1], v); kind.fill(s.crust ? 3 : s.kind, v, v + 2); vary.fill(s.v, v, v + 2); taper.fill(k, v, v + 2);
      if (i < s.n - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  for (const [k, a] of Object.entries({ side, kind, vary, taper })) geo.setAttribute(k, new THREE.BufferAttribute(a, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, createMediumStrandMaterial());
  mesh.frustumCulled = false;
  return mesh;
}
function syncMedium() {
  const m = medium, ga = motes.geometry.attributes, P = ga.position.array, A = ga.alpha.array;
  for (let i = 0; i < m.P; i++) {
    P[i * 3] = m.px[i]; P[i * 3 + 1] = m.py[i]; P[i * 3 + 2] = m.pz[i];
    A[i] = m.plife[i] * m.edge(m.px[i], m.py[i]);
  }
  ga.position.needsUpdate = ga.alpha.needsUpdate = true;
  const gs = fibres.geometry.attributes, SP = gs.position.array, SA = gs.alpha.array, AL = gs.along.array;
  const { nx, ny } = m;
  for (const s of m.strands) {
    const e = s.start + s.n, blur = Math.min(1.5, Math.abs(s.z - 0.12) * 2.4), hw = s.w * 0.5 * (1 + blur * 1.2);
    const a = s.life * m.edge(nx[s.start], ny[s.start]);
    let along = 0;
    for (let i = s.start; i < e; i++) {
      const i0 = Math.max(s.start, i - 1), i1 = Math.min(e - 1, i + 1);
      let tx = nx[i1] - nx[i0], ty = ny[i1] - ny[i0];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl; ty /= tl;
      if (i > s.start) along += Math.hypot(nx[i] - nx[i - 1], ny[i] - ny[i - 1]);
      const v = i * 2;
      SP.set([nx[i] + ty * hw, ny[i] - tx * hw, s.z, nx[i] - ty * hw, ny[i] + tx * hw, s.z], v * 3);
      SA[v] = SA[v + 1] = a; AL[v] = AL[v + 1] = along;
    }
  }
  gs.position.needsUpdate = gs.alpha.needsUpdate = gs.along.needsUpdate = true;
  const gf = flocs.geometry.attributes, FP = gf.position.array, FA = gf.alpha.array;
  for (let i = 0; i < m.F; i++) {
    const h = m.fsize[i] * 0.65, c = Math.cos(m.frot[i]) * h, sn = Math.sin(m.frot[i]) * h;
    const x = m.fx[i], y = m.fy[i], z = m.fz[i];
    FP.set([x - c + sn, y - sn - c, z, x + c + sn, y + sn - c, z, x + c - sn, y + sn + c, z, x - c - sn, y - sn + c, z], i * 12);
    FA.fill(m.flife[i] * m.edge(x, y), i * 4, i * 4 + 4);
  }
  gf.position.needsUpdate = gf.alpha.needsUpdate = true;
}

// ---- the cell's meshes, made anew for each cell
const jelly = createJellyMaterial();
// dead, a little duller and warmer, but still a clear jelly: what lies under it (the spill, the
// slide) is seen through it, not a beige, sugar-cube opaque block
const JELLY_ALIVE = jelly.attenuationColor.clone(), JELLY_DEAD = new THREE.Color(0xccc6c0);
const TINT_ALIVE = jelly.color.clone(), TINT_DEAD = new THREE.Color(0xe6e3df);
const coreMat = createCoreMaterial();
const ROUGH_ALIVE = jelly.roughness, SHEEN_ALIVE = jelly.sheen, RIM_ALIVE = jelly.userData.rim.value, GLOW_ALIVE = coreMat.userData.glow.value;
// the cores' colours: dark ones, wine, plum, aubergine, deep rose, rust (picked per blob, nudged
// a little), muted: greyed down to only a hint of their hue
const CORE_SAT = 0.35; // how much of their saturation is left
const CORE_HUES = [0x5a1430, 0x4a1846, 0x2e1238, 0x6a1c3a, 0x6a2a1c, 0x3c1028].map((c) => {
  const col = new THREE.Color(c), hsl = {};
  col.getHSL(hsl);
  return col.setHSL(hsl.h, hsl.s * CORE_SAT, hsl.l);
});
const BLOBS = 2; // per block: a big one and a small one
const blockGeo = createBlockGeometry(0.2);
const aJ0 = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
const aJ1 = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
const aShape = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4);
for (const a of [aJ0, aJ1, aShape]) a.setUsage(THREE.DynamicDrawUsage);
blockGeo.setAttribute('aJ0', aJ0);
blockGeo.setAttribute('aJ1', aJ1);
blockGeo.setAttribute('aShape', aShape);
const coreGeo = new THREE.SphereGeometry(1, 24, 16);
const outerFilm = createFilmMaterial(0x9a4f88, num('cells', 0.18)); // patterned, barely: a sheet of small cells
const innerFilm = createFilmMaterial(0x8a4a86);
const liquidMat = createLiquidMaterial();
const nucleusMat = createNucleusMaterial();
const dome = createDomeGeometry();
const disc = new THREE.CircleGeometry(1, 64);
const shadowMat = createBodyShadowMaterial();
let vesicleMats = [];
const strandMat = createStrandMaterial();
const hairMat = createHairMaterial();
const HAIR = num('hair', 1);
strandMat.uniforms.uDepth = su.uDepth; // as deep in the fluid as it looks

let vesicleSink = [];
let sim, cell, blocks, cores, films, filmSim, hairSim, hairs, liquid, nucleus, vesicles, shadows, look, strands, granules;

function build(s) {
  if (cell) {
    scene.remove(cell);
    for (const f of films) f.geometry.dispose();
    hairs.geometry.dispose();
    liquid.geometry.dispose();
    strands.geometry.dispose(); granules.geometry.dispose(); granules.material.dispose();
    blocks.dispose(); cores.dispose();
    for (const m of vesicleMats) m.dispose();
  }
  seed = s;
  sim = createSim(seed);
  setGrain(sim.fluid.fiber);
  const rand = rng(seed * 7 + 3);
  cell = new THREE.Group();
  scene.add(cell);

  blocks = new THREE.InstancedMesh(blockGeo, jelly, N);
  cores = new THREE.InstancedMesh(coreGeo, coreMat, N * BLOBS);
  blocks.frustumCulled = cores.frustumCulled = false;
  cell.add(cores, blocks);
  // each block its own: thickness, swelling phase, the place of its core; loose ones roll
  look = [...Array(N)].map(() => ({
    thick: 0.94 + rand() * 0.12, phase: rand() * 6.28,
    // its cores: a big blob and a small one, each its place, size, colour, and slow wander
    // inside it (per axis, two slow sines: their rates, their phases)
    blobs: [...Array(BLOBS)].map((_, b) => ({
      at: [(rand() - 0.5) * (b ? 0.24 : 0.06), (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.2], // near the middle
      // small, mostly: a few bigger ones (the spread skewed towards the small end)
      r: b ? 0.016 + rand() * 0.014 : 0.028 + rand() ** 2 * 0.034,
      wf: [...Array(6)].map(() => 0.015 + rand() * 0.03), // slow: a cycle every 20 to 60 s or so
      wp: [...Array(6)].map(() => rand() * 6.28),
    })),
    angle: 0, roll: 0, rollV: (rand() - 0.5) * 2,
    sq: 1, sqV: 0, ox: 0, oy: 0, // the squash (a damped spring: it wobbles), the last position
    // its ends and heading as drawn, and how far they still are off their new ones after a
    // link gave way (which links it holds: 1 the previous, 2 the next)
    topo: -1, off: new Float32Array(7), shown: new Float32Array(7),
  }));
  // the blobs' colours
  for (let k = 0; k < N * BLOBS; k++) {
    const c = CORE_HUES[Math.floor(rand() * CORE_HUES.length)].clone();
    c.offsetHSL((rand() - 0.5) * 0.04, (rand() - 0.5) * 0.15 * CORE_SAT, (rand() - 0.5) * 0.08);
    cores.setColorAt(k, c);
  }
  cores.instanceColor.needsUpdate = true;

  filmSim = createFilms(sim);
  films = [makeFilm(outerFilm, filmSim.films[0]), makeFilm(innerFilm, filmSim.films[1])];
  for (const f of films) { f.renderOrder = 2; cell.add(f); }
  hairSim = createHairs(sim, filmSim.films[0], HAIR);
  hairs = makeHairs();
  hairs.renderOrder = 3; // over the outer film's sheet, which it comes out of
  cell.add(hairs);
  liquid = makeLiquid();
  liquid.renderOrder = 1;
  cell.add(liquid);

  // the nucleus and the vesicles: domes on the slide, each casting a soft shadow on the fluid;
  // the vesicles each of a kind (what's inside them), a little rounder or flatter
  nucleus = new THREE.Mesh(dome, nucleusMat);
  nucleusMat.uniforms.uSeed.value = (seed % 997) * 0.37;
  // (a single dense-core one, two lysosomes at most: two dark-centred discs that happen to
  // drift side by side are a pair of eyes, and the cell a face)
  const most = [Infinity, Infinity, 1, 2], count = [0, 0, 0, 0];
  vesicleMats = sim.bodies.slice(1).map(() => {
    const u = rand();
    let kind = u < 0.35 ? 0 : u < 0.6 ? 1 : u < 0.8 ? 2 : 3;
    if (count[kind] >= most[kind]) kind = u < 0.7 ? 0 : 1;
    count[kind]++;
    return createVesicleMaterial(kind, rand() * 50, 0.17 + rand() * 0.08);
  });
  vesicles = vesicleMats.map((m) => new THREE.Mesh(dome, m));
  // each vesicle floats at its own depth: a few breaking the surface, the others under it,
  // high or low, rising and sinking a little, slowly
  vesicleSink = vesicleMats.map(() => {
    const out = rand() < 0.3;
    return { out, at: out ? 0.35 + rand() * 0.35 : 0.05 + rand() * 0.8, rate: 0.03 + rand() * 0.05, ph: rand() * 6.28 };
  });
  for (const m of [nucleusMat, ...vesicleMats]) m.uniforms.uDepth = su.uDepth;
  shadows = sim.bodies.map(() => new THREE.Mesh(disc, shadowMat));
  for (const m of [nucleus, ...vesicles]) cell.add(m);
  for (const m of shadows) { m.renderOrder = -3; cell.add(m); }

  // the inclusions, under the nucleus and vesicles
  strands = makeStrands();
  strands.renderOrder = -5;
  // (and one more: the centrosome, the microtubules' hub)
  granules = createGranulePoints(sim.inc.G + 1);
  granules.geometry.attributes.kind.array.set([...sim.inc.gkind, 3]);
  granules.geometry.attributes.size.array.set([...sim.inc.gsize, 0.36]);
  // each at its own depth in the fluid (the centrosome halfway down)
  granules.geometry.attributes.depth.array.set([...Array.from(sim.inc.gkind, () => rand() ** 0.8), 0.45]);
  granules.material.uniforms.uDepth = su.uDepth;
  granules.renderOrder = -4;
  cell.add(strands, granules);
  su.uSeed.value = (seed % 113) * 0.61;
  su.uRW.value = backdrop.material.uniforms.uRW.value = sim.RW;
  su.uHC.value = backdrop.material.uniforms.uHC.value = sim.fluid.HC;
}

// per film point: 4 vertices, the upright sheet (bottom, top) then its top edge (a narrow
// cap: inner, outer); a quad from each point to the next, but across the film's cuts
const FV = 4;
function makeFilm(material, film) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(M * FV * 3), 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(M * FV), 1));
  geo.setAttribute('sheetN', new THREE.BufferAttribute(new Float32Array(M * FV * 3), 3));
  const across = new Float32Array(M * FV), kind = new Float32Array(M * FV);
  for (let k = 0; k < M; k++) {
    across.set([-1, 1, -1, 1], k * FV);
    kind.set([0, 0, 1, 1], k * FV);
  }
  geo.setAttribute('across', new THREE.BufferAttribute(across, 1));
  geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  // along the film (its rest spacing: the pattern stays put on it), up the sheet (per frame)
  const pat = new Float32Array(M * FV * 2), step = (2 * Math.PI * R) / M;
  for (let k = 0; k < M * FV; k++) pat[k * 2] = Math.floor(k / FV) * step;
  geo.setAttribute('pat', new THREE.BufferAttribute(pat, 2));
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  mesh.userData.film = film;
  mesh.userData.cuts = -1;
  return mesh;
}
function filmIndex(mesh) {
  const { cut } = mesh.userData.film, index = [];
  for (let k = 0; k < M; k++) {
    if (cut[k]) continue;
    const a = k * FV, b = ((k + 1) % M) * FV;
    for (const o of [0, 2]) index.push(a + o, a + o + 1, b + o, a + o + 1, b + o + 1, b + o);
  }
  mesh.geometry.setIndex(index);
}

// a catmull-rom curve through A, B, C, D (from B to C) at t, and its tangent there
function cr(A, B, C, D, t) {
  const t2 = t * t;
  return 0.5 * (2 * B + (C - A) * t + (2 * A - 5 * B + 4 * C - D) * t2 + (3 * B - A - 3 * C + D) * t2 * t);
}
function dcr(A, B, C, D, t) {
  return 0.5 * ((C - A) + 2 * (2 * A - 5 * B + 4 * C - D) * t + 3 * (3 * B - A - 3 * C + D) * t * t);
}

// the hairs: a ribbon each, smooth (a catmull-rom curve through its points, HS pieces between
// two), a pair of vertices across it at each step
const HS = 3, HV = (HP - 1) * HS + 1;
function makeHairs() {
  const { H, hairs: list } = hairSim, nv = H * HV * 2, geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  const side = new Float32Array(nv), along = new Float32Array(nv), vary = new Float32Array(nv), index = [];
  for (let k = 0; k < H; k++) {
    for (let j = 0; j < HV; j++) {
      const v = (k * HV + j) * 2;
      side.set([-1, 1], v); along.fill(j / (HV - 1), v, v + 2); vary.fill(list[k].v, v, v + 2);
      if (j < HV - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  for (const [k, a] of Object.entries({ side, along, vary })) geo.setAttribute(k, new THREE.BufferAttribute(a, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, hairMat);
  mesh.frustumCulled = false;
  return mesh;
}
function syncHairs(death) {
  const { H, hairs: list, x, y, rz, el } = hairSim, P = hairs.geometry.attributes.position.array;
  for (let k = 0; k < H; k++) {
    const h = list[k], o = k * HP, last = o + HP - 1;
    let z = rz[k], lx = x[o], ly = y[o];
    for (let a = 0; a < HP - 1; a++) {
      const i0 = o + Math.max(0, a - 1), i1 = o + a, i2 = i1 + 1, i3 = Math.min(last, i2 + 1);
      for (let u = 0; u <= (a === HP - 2 ? HS : HS - 1); u++) {
        const t = u / HS;
        const X = cr(x[i0], x[i1], x[i2], x[i3], t), Y = cr(y[i0], y[i1], y[i2], y[i3], t);
        let tx = dcr(x[i0], x[i1], x[i2], x[i3], t), ty = dcr(y[i0], y[i1], y[i2], y[i3], t);
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        // out of the film at its own height, rising or sinking its own way and sagging along
        // it (climbing along its xy path: its slope there), kept off the slide; flared where it
        // comes out, tapering to a fine tip
        const f = (a + t) / (HP - 1), slope = Math.tan(Math.max(-1, Math.min(1, el[k] - h.sag * f)));
        z = Math.max(0.012, Math.min(0.6, z + Math.hypot(X - lx, Y - ly) * slope));
        lx = X; ly = Y;
        const hw = h.w * 0.5 * (1 - 0.75 * f) * (1 + 0.9 * Math.exp(-f * 14));
        P.set([X + ty * hw, Y - tx * hw, z, X - ty * hw, Y + tx * hw, z], (k * HV + a * HS + u) * 6);
      }
    }
  }
  hairs.geometry.attributes.position.needsUpdate = true;
  hairMat.uniforms.uDeath.value = death;
}

// the liquid between the films: per link, S + 1 rows along it (on the curve through the
// blocks), of LK columns across (inner film to outer film)
const LK = 7, LR = S + 1;
function makeLiquid() {
  const geo = new THREE.BufferGeometry();
  const nv = N * LR * LK;
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute('alpha', new THREE.BufferAttribute(new Float32Array(nv), 1));
  const across = new Float32Array(nv), index = [];
  for (let i = 0; i < N; i++) {
    for (let e = 0; e < LR; e++) for (let c = 0; c < LK; c++) across[(i * LR + e) * LK + c] = (c / (LK - 1)) * 2 - 1;
    for (let e = 0; e < LR - 1; e++) {
      const v0 = (i * LR + e) * LK, v1 = v0 + LK;
      for (let c = 0; c < LK - 1; c++) index.push(v0 + c, v0 + c + 1, v1 + c, v0 + c + 1, v1 + c + 1, v1 + c);
    }
  }
  geo.setAttribute('across', new THREE.BufferAttribute(across, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, liquidMat);
  mesh.frustumCulled = false;
  return mesh;
}

// the inclusions' strands: per link a strip of SUB pieces (SUB + 1 pairs of vertices)
const SUB = 4, SV = (SUB + 1) * 2;
const WIDTH = { [KIND.TUBULE]: 0.045, [KIND.ACTIN]: 0.032, [KIND.MITO]: 0.13, [KIND.ER]: 0.09 };
function makeStrands() {
  const { strands: list } = sim.inc;
  const nseg = list.reduce((a, s) => a + s.n - 1, 0), nv = nseg * SV;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  for (const k of ['along', 'alpha', 'width']) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(nv), 1));
  geo.setAttribute('tang', new THREE.BufferAttribute(new Float32Array(nv * 2), 2));
  const side = new Float32Array(nv), kind = new Float32Array(nv), vary = new Float32Array(nv), index = [];
  let v = 0;
  for (const s of list) {
    for (let a = 0; a < s.n - 1; a++, v += SV) {
      for (let u = 0; u <= SUB; u++) { side[v + u * 2] = -1; side[v + u * 2 + 1] = 1; }
      kind.fill(s.kind, v, v + SV);
      vary.fill(s.v, v, v + SV);
      for (let u = 0; u < SUB; u++) { const q = v + u * 2; index.push(q, q + 1, q + 2, q + 1, q + 3, q + 2); }
    }
  }
  geo.setAttribute('side', new THREE.BufferAttribute(side, 1));
  geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1));
  geo.setAttribute('vary', new THREE.BufferAttribute(vary, 1));
  geo.setIndex(index);
  const mesh = new THREE.Mesh(geo, strandMat);
  mesh.frustumCulled = false;
  return mesh;
}
const strandEnd = (f, fat, cap) => (fat ? Math.sqrt(Math.max(0, 1 - (1 - Math.min(1, f / cap)) ** 2)) : 0.3 + 0.7 * Math.min(1, f * 2));
// each link, a curve through its nodes and their neighbours (catmull-rom, not past a broken
// link); tapered at a strand's ends (rounded for the fat ones), swelling as it dies
let arc = new Float32Array(0);
function syncStrands(death) {
  const { nx, ny, link, strands: list, NN } = sim.inc;
  if (arc.length < NN) arc = new Float32Array(NN);
  for (const s of list) {
    arc[s.start] = 0;
    for (let i = s.start + 1; i < s.start + s.n; i++) arc[i] = arc[i - 1] + Math.hypot(nx[i] - nx[i - 1], ny[i] - ny[i - 1]);
  }
  const g = strands.geometry.attributes;
  const P = g.position.array, AL = g.along.array, A = g.alpha.array, W = g.width.array, TG = g.tang.array;
  let v = 0;
  for (const s of list) {
    const e = s.start + s.n, fat = s.kind === KIND.MITO || s.kind === KIND.ER;
    const mito = s.kind === KIND.MITO;
    const w = WIDTH[s.kind] * s.w * (mito ? 1 + 0.35 * death : 1);
    for (let a = s.start; a < e - 1; a++, v += SV) {
      const b = a + 1;
      const p0 = a > s.start && link[a - 1] ? a - 1 : a, p3 = b < e - 1 && link[b] ? b + 1 : b;
      const endA = p0 === a, endB = p3 === b;
      const segL = Math.max(1e-4, arc[b] - arc[a]), cap = Math.min(1, (w * 0.5) / segL);
      for (let u = 0; u <= SUB; u++) {
        const t = u / SUB;
        const X = cr(nx[p0], nx[a], nx[b], nx[p3], t), Y = cr(ny[p0], ny[a], ny[b], ny[p3], t);
        let tx = dcr(nx[p0], nx[a], nx[b], nx[p3], t), ty = dcr(ny[p0], ny[a], ny[b], ny[p3], t);
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        // the ends: rounded caps (fat ones), or thinning out (fibres)
        let k = 1;
        if (endA) k *= strandEnd(t, fat, cap);
        if (endB) k *= strandEnd(1 - t, fat, cap);
        let hw = w * 0.5 * Math.max(k, fat ? 0.25 : 0);
        // a mitochondrion's outline: a little uneven, pinched here, swollen there (its own)
        if (mito) hw *= 1 + 0.1 * Math.sin((arc[a] + t * segL) * (14 + s.v * 16) + s.v * 40) * (0.3 + s.v);
        const q = v + u * 2, z = surfaceZ(X, Y) - 0.004;
        P[q * 3] = X + ty * hw; P[q * 3 + 1] = Y - tx * hw; P[q * 3 + 2] = z;
        P[q * 3 + 3] = X - ty * hw; P[q * 3 + 4] = Y + tx * hw; P[q * 3 + 5] = z;
        AL[q] = AL[q + 1] = arc[a] + t * segL;
        A[q] = A[q + 1] = link[a];
        W[q] = W[q + 1] = w;
        TG[q * 2] = TG[q * 2 + 2] = tx; TG[q * 2 + 1] = TG[q * 2 + 3] = ty;
      }
    }
  }
  g.position.needsUpdate = g.along.needsUpdate = g.alpha.needsUpdate = g.width.needsUpdate = g.tang.needsUpdate = true;

  const gp = granules.geometry.attributes.position, gpa = gp.array, { gx, gy, G } = sim.inc;
  for (let i = 0; i < G; i++) { gpa[i * 3] = gx[i]; gpa[i * 3 + 1] = gy[i]; gpa[i * 3 + 2] = surfaceZ(gx[i], gy[i]) - 0.001; }
  const { x: cx, y: cy } = sim.inc.centro;
  gpa.set([cx, cy, surfaceZ(cx, cy)], G * 3);
  gp.needsUpdate = true;
  strandMat.uniforms.uDeath.value = death;
  granules.material.uniforms.uDeath.value = death;
}

// ---- each frame: the sim's state into the meshes
const halfT = new Float32Array(N), halfH = new Float32Array(N); // each block's half thickness, half height (at its middle)
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e3 = new THREE.Euler(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
const coreOff = new THREE.Vector3(), qYaw = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1);
const L0 = (2 * Math.PI * R) / N;
const jointX = new Float32Array(N), jointY = new Float32Array(N), jointA = new Float32Array(N);
const curve = createCurve();
const wrap = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

// the membrane's walls (not the nucleus's), for the fluid's surface: not the sim's cells (all
// or nothing, the surface's rim against the blocks would follow their staircase) but their
// true distance (to the capsules along the intact links, discs at the nodes of broken ones),
// up to a little past their edge. The distance, not the ramp across the edge made of it (the
// shader makes that): filtered, a distance stays a distance, so the edge's contour and the
// surface's slope down to it are as smooth between the cells as along them, where a clamped
// ramp would be bent at each cell
const wall = new Float32Array(G * G), wallD = new Float32Array(G * G);
function wallField(fluid) {
  const { mx, my, linkOn, RW } = sim, { HC, X, at } = fluid, reach = RW + HC * 2;
  wallD.fill(1e9);
  for (let a = 0; a < N; a++) {
    const b = (a + 1) % N, on = linkOn[a];
    const x0 = mx[a], y0 = my[a], x1 = on ? mx[b] : x0, y1 = on ? my[b] : y0;
    const sx = x1 - x0, sy = y1 - y0, s2 = sx * sx + sy * sy;
    const i0 = Math.max(0, Math.floor(at(Math.min(x0, x1) - reach))), i1 = Math.min(G - 1, Math.ceil(at(Math.max(x0, x1) + reach)));
    const j0 = Math.max(0, Math.floor(at(Math.min(y0, y1) - reach))), j1 = Math.min(G - 1, Math.ceil(at(Math.max(y0, y1) + reach)));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = X(i) - x0, py = X(j) - y0;
      let t = s2 > 1e-9 ? (px * sx + py * sy) / s2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.hypot(px - sx * t, py - sy * t), k = j * G + i;
      if (d < wallD[k]) wallD[k] = d;
    }
  }
  for (let k = 0; k < G * G; k++) wall[k] = Math.min(wallD[k], reach);
}

// (the fluid's textures only when the sim has moved since: not while paused)
let synced = { sim: null, time: -1 };
// warm: catching up to &t=, only what lives its own life here (the films, the hairs: their
// own sims, stepped along the blocks), none of the drawing
function sync(dt, simDt, warm = false) {
  const { mx, my, linkOn, bodies, fluid } = sim;
  // the fluid
  if (!warm && (synced.sim !== sim || synced.time !== sim.time)) {
    synced = { sim, time: sim.time };
    const { c, ax, ay, bx, by } = fluid;
    wallField(fluid);
    for (let k = 0; k < G * G; k++) {
      dyeData[k * 2] = toHalf(c[k]);
      dyeData[k * 2 + 1] = toHalf(wall[k]);
      flowData[k * 4] = toHalf(ax[k]); flowData[k * 4 + 1] = toHalf(ay[k]);
      flowData[k * 4 + 2] = toHalf(bx[k]); flowData[k * 4 + 3] = toHalf(by[k]);
    }
    dyeTex.needsUpdate = flowTex.needsUpdate = true;
    soakIn(c, simDt);
    su.uWA.value = fluid.weightA(sim.time);
  }

  // the membrane: each block fills the space between its joints with its neighbours (the
  // middles of its links); at a torn end the joint is its own end; loose, it rolls over
  for (let k = 0; k < N; k++) {
    const k1 = (k + 1) % N;
    jointX[k] = (mx[k] + mx[k1]) / 2; jointY[k] = (my[k] + my[k1]) / 2;
    jointA[k] = Math.atan2(my[k1] - my[k], mx[k1] - mx[k]);
  }
  const J0 = aJ0.array, J1 = aJ1.array, SH = aShape.array;
  for (let i = 0; i < N; i++) {
    const a = (i - 1 + N) % N;
    const toPrev = linkOn[a], toNext = linkOn[i];
    const lk = look[i];
    if (toPrev && toNext) lk.angle = jointA[a] + wrap(jointA[i] - jointA[a]) / 2;
    else if (toPrev) lk.angle = jointA[a];
    else if (toNext) lk.angle = jointA[i];
    if (toPrev || toNext) lk.roll *= 0.98;
    else { lk.roll += lk.rollV * dt * 0.6; lk.rollV *= 0.995; }
    const half = sim.L * 0.47, ca = Math.cos(lk.angle), sa = Math.sin(lk.angle);
    let x0 = mx[i] - ca * half, y0 = my[i] - sa * half, a0 = lk.angle;
    let x1 = mx[i] + ca * half, y1 = my[i] + sa * half, a1 = lk.angle;
    if (toPrev) { x0 = jointX[a]; y0 = jointY[a]; a0 = jointA[a]; }
    if (toNext) { x1 = jointX[i]; y1 = jointY[i]; a1 = jointA[i]; }
    a0 = lk.angle + wrap(a0 - lk.angle); a1 = lk.angle + wrap(a1 - lk.angle);
    // a link giving way changes where its ends are taken from (a shared joint, or its own
    // end) and its heading: it doesn't pop into its new shape but eases into it (the step,
    // kept as an offset from the new one, relative to its node, melts away)
    const topo = (toPrev ? 1 : 0) + (toNext ? 2 : 0);
    const now = [x0 - mx[i], y0 - my[i], a0, x1 - mx[i], y1 - my[i], a1, lk.angle];
    if (lk.topo >= 0 && lk.topo !== topo) {
      for (let q = 0; q < 7; q++) {
        const dv = lk.shown[q] - now[q]; // (what was shown already holds the last offset)
        lk.off[q] = q === 2 || q >= 5 ? wrap(dv) : dv;
      }
    }
    lk.topo = topo;
    const fade = Math.exp(-dt * EASE_POP);
    for (let q = 0; q < 7; q++) { lk.off[q] *= fade; lk.shown[q] = now[q] + lk.off[q]; }
    x0 = mx[i] + lk.shown[0]; y0 = my[i] + lk.shown[1]; a0 = lk.shown[2];
    x1 = mx[i] + lk.shown[3]; y1 = my[i] + lk.shown[4]; a1 = lk.shown[5];
    const heading = lk.shown[6];
    J0.set([x0, y0, a0], i * 3); J1.set([x1, y1, a1], i * 3);

    // squishy: squashed thinner when stretched, fatter when pressed (it keeps its volume),
    // overshooting and wobbling back, kicked by sudden moves; and swelling slowly
    const len = Math.hypot(x1 - x0, y1 - y0);
    const target = Math.pow((L0 * 0.94) / Math.max(len * (L0 / sim.L), 0.02), 0.6);
    const speed = dt > 0 ? Math.hypot(mx[i] - lk.ox, my[i] - lk.oy) / dt : 0;
    lk.ox = mx[i]; lk.oy = my[i];
    lk.sqV += ((target - lk.sq) * 90 - lk.sqV * 5) * dt + (speed > 0.4 ? (speed - 0.4) * 0.08 * Math.sin(lk.phase * 13 + clock * 30) : 0);
    lk.sq = THREE.MathUtils.clamp(lk.sq + lk.sqV * dt, 0.6, 1.6);
    const swell = 1 + 0.035 * Math.sin(clock * 1.6 + lk.phase);
    const th = lk.sq * lk.thick * swell;
    const bulge = 0.1 + 0.04 * Math.sin(clock * 2.3 + lk.phase * 2), depth = DEPTH * (0.6 + 0.4 * th) * lk.thick;
    SH.set([T * th, bulge, depth, lk.roll], i * 4);
    halfT[i] = T * th * (1 + bulge) * 0.5; halfH[i] = depth * (1 + bulge) * 0.5;

    // its cores, drifting slowly about inside it (along it, across, up and down), each kept
    // inside it, whatever its squash; and up and down only in its upper part, above the
    // fluid's surface under the block (opaque, about a quarter to half the fluid's height
    // there, shifting a little every frame with the walls): a core dipping into it would
    // flicker in and out of sight. A loose block rolling over carries them round with it,
    // but still only through its upper part (as high as it stands, rolled), so none sinks
    // into the fluid and blinks
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const zFloor = su.uH.value * 0.5;
    const cr = Math.cos(lk.roll), sr = Math.sin(lk.roll), acr = Math.abs(cr), asr = Math.abs(sr);
    const hz = acr * depth * 0.5 + asr * T * th * 0.5; // its half height, rolled
    q4.setFromEuler(e3.set(lk.roll, 0, heading));
    qYaw.setFromAxisAngle(zAxis, heading);
    if (!warm) lk.blobs.forEach((bl, b) => {
      const wander = (j) => 0.6 * Math.sin(clock * bl.wf[j] * 6.2832 + bl.wp[j]) + 0.4 * Math.sin(clock * bl.wf[j + 3] * 6.2832 * 1.7 + bl.wp[j + 3]);
      const rx = bl.r * 1.1, ry = bl.r * Math.sqrt(th), rz = bl.r * 0.9;
      const mx0 = Math.max(0, len * 0.5 - rx - 0.03), my0 = Math.max(0, T * th * 0.5 - ry - 0.015);
      const clamp = (v, m) => Math.max(-m, Math.min(m, v));
      // its middle (its outline seen from above) kept above the fluid, its top inside the block
      const zTop = depth * 0.5 - rz - 0.015, zLo = Math.min(zFloor, zTop);
      const oy = clamp((bl.at[1] + wander(1) * 0.22) * my0 * 2, my0);
      const oz = (zLo + zTop) / 2 + clamp((bl.at[2] + wander(2) * 0.22) * 2, 1) * (zTop - zLo) / 2;
      // rolled over: across it and up, then its height brought back into the upper part of
      // the block as it now stands (the same as above, unrolled)
      const ry2 = oy * cr - oz * sr, rz2 = oy * sr + oz * cr;
      const zc = (zLo + zTop) / 2 * cr, ext = my0 * asr + (zTop - zLo) / 2 * acr;
      const zTopR = hz - (acr * rz + asr * ry) - 0.015, zLoR = Math.min(zFloor, zTopR);
      const u = ext > 1e-6 ? clamp((rz2 - zc) / ext, 1) : 0;
      coreOff.set(
        clamp((bl.at[0] + wander(0) * 0.16) * len, mx0),
        ry2,
        (zLoR + zTopR) / 2 + u * (zTopR - zLoR) / 2,
      ).applyQuaternion(qYaw);
      m4.compose(p3.set(cx, cy, 0).add(coreOff), q4, s3.set(rx, ry, rz));
      cores.setMatrixAt(i * BLOBS + b, m4);
    });
  }
  aJ0.needsUpdate = aJ1.needsUpdate = aShape.needsUpdate = true;
  cores.instanceMatrix.needsUpdate = true;

  // the films: their own strands (films.js), held on a smooth curve through the blocks,
  // close against them and as tall as they are; torn, cut in a few long strands drifting off
  ringCurve(sim, halfT, halfH, curve);
  filmSim.step(simDt, curve);
  if (warm) { hairSim.step(simDt, curve); return; }
  for (const f of films) {
    const film = f.userData.film, w = 0.055;
    if (f.userData.cuts !== film.cuts) { filmIndex(f); f.userData.cuts = film.cuts; }
    const g = f.geometry.attributes;
    const P = g.position.array, A = g.alpha.array, SN = g.sheetN.array, PT = g.pat.array;
    for (let k = 0; k < M; k++) {
      const a = (k - 1 + M) % M, b = (k + 1) % M;
      // the sheet's normal, from the strand itself
      let tx = film.x[b] - film.x[a], ty = film.y[b] - film.y[a];
      if (film.cut[k]) { tx = film.x[k] - film.x[a]; ty = film.y[k] - film.y[a]; }
      else if (film.cut[a]) { tx = film.x[b] - film.x[k]; ty = film.y[b] - film.y[k]; }
      const l = Math.hypot(tx, ty) || 1, nx = ty / l, ny = -tx / l;
      const x = film.x[k], y = film.y[k], h = film.h[k], v = k * FV;
      // twisted (free, here and there), the sheet is turned about the strand: its height
      // leans over to one side, its face tilts up
      const tw = film.twist[k], ct = Math.cos(tw), st = Math.sin(tw);
      const ux = nx * st * h, uy = ny * st * h, uz = ct * h; // up the sheet, to its top
      const sx = nx * ct, sy = ny * ct, sz = -st; // the sheet's normal
      P.set([x - ux, y - uy, -uz, x + ux, y + uy, uz,
        x + ux - sx * w, y + uy - sy * w, uz - sz * w, x + ux + sx * w, y + uy + sy * w, uz + sz * w], v * 3);
      // fading at the torn ends
      const al = film.cut[k] || film.cut[a] ? 0.15 : 1;
      A[v] = A[v + 1] = A[v + 2] = A[v + 3] = al;
      for (let u = v; u < v + 4; u++) { SN[u * 3] = sx; SN[u * 3 + 1] = sy; SN[u * 3 + 2] = sz; }
      PT[v * 2 + 1] = -h; PT[v * 2 + 3] = PT[v * 2 + 5] = PT[v * 2 + 7] = h;
    }
    g.position.needsUpdate = g.alpha.needsUpdate = g.sheetN.needsUpdate = g.pat.needsUpdate = true;
  }

  // the liquid, filling the space between the films' places up to their top, a little lower
  // in the middle (the meniscus rises against them); it stays with the blocks: torn, it
  // goes with their links
  {
    const g = liquid.geometry.attributes;
    const Pp = g.position.array, NR = g.normal.array, A = g.alpha.array;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const on = linkOn[i] ? 1 : 0;
      for (let e = 0; e < LR; e++) {
        const n = (i * S + e) % M; // the curve's point (the last row: the next block's)
        const W = curve.ht[n] + 0.03, h = curve.hh[n];
        const end = e === 0 ? linkOn[(i - 1 + N) % N] : e === LR - 1 ? linkOn[j] : 1;
        const nx = curve.nx[n], ny = curve.ny[n];
        for (let c = 0; c < LK; c++) {
          const v = (i * LR + e) * LK + c, a = (c / (LK - 1)) * 2 - 1;
          Pp[v * 3] = curve.x[n] + nx * a * W; Pp[v * 3 + 1] = curve.y[n] + ny * a * W;
          Pp[v * 3 + 2] = h * (0.9 + 0.1 * a * a);
          const slope = (h * 0.2 * a) / W, l = Math.hypot(slope, 1);
          NR[v * 3] = (-slope * nx) / l; NR[v * 3 + 1] = (-slope * ny) / l; NR[v * 3 + 2] = 1 / l;
          A[v] = on * (end ? 1 : 0.15);
        }
      }
    }
    g.position.needsUpdate = g.normal.needsUpdate = g.alpha.needsUpdate = true;
  }

  // the content
  const death = sim.dying < 0 ? 0 : THREE.MathUtils.smoothstep(sim.dying, 0, 22);
  const nb = bodies[0];
  // the content floats in the fluid, just under its surface
  // sunk in it, its lower part (SUNK of its height) under the fluid's surface
  nucleus.scale.set(nb.r * 1.04, nb.r * 1.04, nb.r * 1.04 * nucleusMat.uniforms.uH.value);
  nucleus.position.set(nb.x, nb.y, surfaceZ(nb.x, nb.y) - nucleus.scale.z * SUNK);
  nucleusMat.uniforms.uWater.value = waterZ(nb.x, nb.y);
  nucleus.rotation.z = nb.angle;
  nucleusMat.uniforms.uDeath.value = death;
  for (const m of vesicleMats) { m.uniforms.uDeath.value = death; m.uniforms.uTime.value = clock; }
  shadowMat.uniforms.uDeath.value = death;
  liquidMat.uniforms.uDeath.value = death;
  liquidMat.uniforms.uTime.value = clock;
  syncStrands(death);
  hairSim.step(simDt, curve);
  syncHairs(death);
  bodies.slice(1).forEach((b, k) => {
    const v = vesicles[k], r = b.r * 1.05;
    v.scale.set(r, r, r * vesicleMats[k].uniforms.uH.value);
    // breaking the surface: that much of its height under it; under it: its top that far
    // down (a fraction of the depth it has room for)
    const sk = vesicleSink[k], h = v.scale.z, water = waterZ(b.x, b.y);
    const bob = 0.1 * Math.sin(clock * sk.rate * 6.28 + sk.ph);
    const z = sk.out
      ? water - h * THREE.MathUtils.clamp(sk.at + bob, 0.25, 0.8)
      : water - h - THREE.MathUtils.clamp(sk.at + bob, 0.02, 0.95) * Math.max(water - h, 0);
    v.position.set(b.x, b.y, Math.max(z, 0));
    vesicleMats[k].uniforms.uWater.value = water;
    v.rotation.z = b.angle;
  });
  // their lower part, under the surface: seen through the fluid (and fading with the nucleus)
  const UB = su.uBodies.value;
  for (let k = 0; k < UB.length; k++) {
    const m = k === 0 ? nucleus : vesicles[k - 1];
    if (!m) { UB[k].set(0, 0, 0, 0); continue; }
    const a = k === 0 ? 1 - THREE.MathUtils.smoothstep(death, 0.55, 1) * 0.85 : 1 - death * 0.5;
    UB[k].set(m.position.x, m.position.y, m.scale.x * (k === 0 ? 0.95 : 1), a);
  }
  // the shadows (from what stands out of the fluid), cast away from the key light (upper left), as far as the dome is tall, on the fluid's surface
  bodies.forEach((b, k) => {
    // (only what stands out of it casts one)
    const m = k === 0 ? nucleus : vesicles[k - 1], h = m.position.z + m.scale.z - waterZ(b.x, b.y) - (k === 0 ? 0.02 : 0);
    shadows[k].visible = h > 0;
    const sx = b.x + h * 0.32, sy = b.y - h * 0.4;
    shadows[k].position.set(sx, sy, surfaceZ(sx, sy) + 0.002);
    shadows[k].scale.setScalar(m.scale.x * 1.08);
  });

  // dying, the jelly dulls a little but clears rather than clouding over: less frosted (what
  // lies under it is seen through it, a little blurred) and less of a sheen on it
  jelly.attenuationColor.lerpColors(JELLY_ALIVE, JELLY_DEAD, death); // a faint cool grey, going dull and warm
  jelly.color.lerpColors(TINT_ALIVE, TINT_DEAD, death);
  jelly.roughness = ROUGH_ALIVE - death * 0.25;
  jelly.sheen = SHEEN_ALIVE * (1 - death * 0.6);
  coreMat.userData.glow.value = GLOW_ALIVE * (1 - death * 0.7); // the cores' glow dims
  jelly.userData.rim.value = RIM_ALIVE * (1 - death * 0.5);
  su.uDeath.value = backdrop.material.uniforms.uDeath.value = death;
  su.uH.value = FLUID_H * (1 - 0.3 * death);
}

// ---- input
let playing = !params.has('still');
let clock = 0, acc = 0, reborn = -1;
let camClock = 0; // the camera's slow turn: it only runs while the cell is whole
const bar = document.getElementById('bar');
const info = document.getElementById('info');
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), hit = new THREE.Vector3();

function tearSomewhere() {
  const r = rng(seed + Math.floor(clock * 1000));
  const a = r() * Math.PI * 2;
  const i = Math.floor((a / (Math.PI * 2)) * N) % N;
  sim.tear([sim.mx[i], sim.my[i]]);
}
function rebirth() {
  if (reborn >= 0) return;
  renderer.domElement.style.opacity = 0;
  reborn = 0;
}

// ---- the sound: the sim's state drives it (sound.js)
const sound = createSound({ volume: num('vol', 0.8), on: params.get('sound') !== '0' });
for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, () => sound.wake(), { capture: true });
const heard = { sim: null, alive: true, links: new Uint8Array(N) };
const panOf = (x, y) => THREE.MathUtils.clamp(new THREE.Vector3(x, y, 0).project(camera).x, -1, 1);
function listen() {
  if (heard.sim !== sim) { // a new cell
    if (heard.sim) sound.born();
    heard.sim = sim; heard.alive = sim.dying < 0; heard.links.set(sim.linkOn);
  }
  const alive = sim.dying < 0;
  // pulled, the strain of its most stretched link (it gives way at 2.4 times its rest)
  let strain = 0;
  if (alive && sim.grabbed()) {
    let worst = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      worst = Math.max(worst, Math.hypot(sim.mx[j] - sim.mx[i], sim.my[j] - sim.my[i]) / sim.L);
    }
    strain = THREE.MathUtils.clamp((worst - 1.25) / 1.05, 0, 1);
  }
  if (heard.alive && !alive) {
    const i = Math.max(0, sim.tearAt), j = (i + 1) % N;
    sound.torn(panOf((sim.mx[i] + sim.mx[j]) / 2, (sim.my[i] + sim.my[j]) / 2));
  } else if (!alive) {
    for (let i = 0; i < N; i++) if (heard.links[i] && !sim.linkOn[i]) sound.loosened(panOf(sim.mx[i], sim.my[i]));
  }
  heard.alive = alive;
  heard.links.set(sim.linkOn);
  sound.update({ strain });
}

addEventListener('keydown', (e) => {
  if (e.key === ' ') { playing = !playing; sound.pause(!playing); e.preventDefault(); }
  else if (e.key === 'm') sound.toggle();
  else if (e.key === 'k') { if (sim.dying < 0) tearSomewhere(); }
  else if (e.key === 'r') rebirth();
  else if (e.key === 'h') bar.classList.toggle('hidden');
});
// the pointer on the slide's plane
function onSlide(e) {
  ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  return ray.ray.intersectPlane(plane, hit) ? [hit.x, hit.y] : null;
}
// zoom in (wheel, pinch, + and -), towards the pointer: the point of the slide under it stays under it
const MAG_MAX = 8;
function zoomBy(f, cx = innerWidth / 2, cy = innerHeight / 2) {
  const mag = THREE.MathUtils.clamp(view.mag * f, 1, MAG_MAX);
  if (mag === view.mag) return;
  const at = { clientX: cx, clientY: cy };
  const before = onSlide(at);
  view.mag = mag;
  fit();
  placeCamera(camClock);
  camera.updateMatrixWorld();
  const after = onSlide(at);
  if (before && after) { view.tx += before[0] - after[0]; view.ty += before[1] - after[1]; }
  // never off the slide: the further out, the closer to the centre, back on it at 1
  const lim = 7 * (1 - 1 / view.mag), d = Math.hypot(view.tx, view.ty);
  if (d > lim) { view.tx *= lim / d; view.ty *= lim / d; }
  placeCamera(camClock);
  camera.updateMatrixWorld();
}
addEventListener('wheel', (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
  zoomBy(Math.exp(-THREE.MathUtils.clamp(e.deltaY * px * (e.ctrlKey ? 5 : 1), -100, 100) * 0.002), e.clientX, e.clientY);
}, { passive: false });
addEventListener('keydown', (e) => {
  if (e.key === '+' || e.key === '=') zoomBy(1.25);
  else if (e.key === '-' || e.key === '_') zoomBy(1 / 1.25);
  else if (e.key === '0') zoomBy(1 / view.mag);
});

// on the cell, the pointer grabs what's under it and pulls; elsewhere it tilts and turns
// the slide; a double click tears the membrane there
let drag = null;
const el = renderer.domElement;
const touches = new Map(); // two fingers down: a pinch, zooming in between them
let pinch = null;
const spread = () => { const [a, b] = [...touches.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) { sim.release(); drag = null; pinch = spread(); return; }
  if (touches.size > 2 || pinch) return;
  const at = onSlide(e);
  if (at && sim.grabAt(at)) { drag = { grab: true }; el.style.cursor = 'grabbing'; return; }
  drag = { x: e.clientX, y: e.clientY, tilt: view.tilt, turn: view.turn };
});
el.addEventListener('pointermove', (e) => {
  if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pinch) {
    if (touches.size !== 2) return;
    const p = spread();
    if (pinch.d > 0) zoomBy(p.d / pinch.d, p.x, p.y);
    pinch = p;
    return;
  }
  if (!drag) {
    const at = onSlide(e);
    el.style.cursor = at && sim.near(at) ? 'grab' : 'crosshair';
    return;
  }
  if (drag.grab) { const at = onSlide(e); if (at) sim.moveGrab(at); return; }
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
  view.turn = drag.turn - dx * 0.005;
  view.tilt = THREE.MathUtils.clamp(drag.tilt - dy * 0.004, 0, 1.5); // down to ~1.5 above the slide, never through it
});
const drop = () => { sim.release(); drag = null; el.style.cursor = 'crosshair'; };
const lift = (e) => {
  touches.delete(e.pointerId);
  if (pinch) { if (touches.size === 0) pinch = null; return; } // no grab nor turn till every finger is up
  drop();
};
el.addEventListener('pointerup', lift);
el.addEventListener('pointercancel', lift);
el.addEventListener('dblclick', (e) => { const at = onSlide(e); if (at) sim.tear(at); });

// ---- go
build(seed);
for (let t = num('t', 0); t > 0; t -= DT) {
  sim.step(DT);
  medium.step(DT, sim);
  sync(DT, DT, true); // the films and hairs live their own life
}

let last = performance.now();
function frame(now) {
  const dt = THREE.MathUtils.clamp((now - last) / 1000, 0, 0.1); // the first frame's time can come before the start
  last = now;
  clock += dt;
  if (playing) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 3) { sim.step(DT); medium.step(DT, sim); acc -= DT; n++; }
    if (n === 3) acc = 0;
    if (sim.dying > AFTER) rebirth();
  }
  if (reborn >= 0) {
    reborn += dt;
    if (reborn > 1) { drop(); build(seed + 1); reborn = -1; renderer.domElement.style.opacity = 1; }
  }

  // pulled out of shape, or stretched long, the cell is kept in view; once it is torn the
  // view holds (it no longer pulls back over the leak) and stops turning
  if (sim.dying < 0) {
    let ext = 0;
    for (let i = 0; i < N; i++) ext = Math.max(ext, Math.hypot(sim.mx[i], sim.my[i]));
    const z = THREE.MathUtils.clamp((ext - 3.6) / 2.2, 0, 1);
    if (Math.abs(z - zoom) > 1e-4) { zoom += (z - zoom) * Math.min(1, dt * 2); fit(); }
    camClock += dt;
  }
  placeCamera(camClock);
  camera.updateMatrixWorld();
  sync(dt, playing ? dt : 0);
  const u = backdrop.material.uniforms;
  u.uInvViewProj.value.multiplyMatrices(camera.matrixWorld, camera.projectionMatrixInverse);
  u.uCamPos.value.copy(camera.position);
  u.uTime.value = su.uTime.value = clock;
  granules.material.uniforms.uScale.value = innerHeight * renderer.getPixelRatio() * camera.projectionMatrix.elements[5] * 0.5;
  motes.material.uniforms.uScale.value = granules.material.uniforms.uScale.value;
  motes.material.uniforms.uTime.value = flocs.material.uniforms.uTime.value = clock;
  syncMedium();
  renderer.render(scene, camera);
  listen();

  const state = sim.dying < 0 ? `alive ${sim.time.toFixed(0)} s` : `torn ${sim.dying.toFixed(0)} s ago · ${Math.round(sim.measure() * 100)} % leaked`;
  info.textContent = `seed ${seed} · ${state}${playing ? '' : ' · paused'}${sound.on ? '' : ' · muted'}`;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
