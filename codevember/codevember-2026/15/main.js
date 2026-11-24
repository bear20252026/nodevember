import * as THREE from 'three/webgpu';
import { time as nodeTime } from 'three/tsl';
import { MirageDrawingPipeline } from './mirage-pipeline.js';
import { createMaterials } from './materials.js';
import { createLandscape } from './landscape.js';
import { createArchitecture } from './architecture.js';
import { createAtmosphere } from './atmosphere.js';
import { createPostProcessing } from './post-processing.js';
import { createCameraControls } from './camera.js';
import { createSettings, createSettingsPanel } from './settings.js';
import { createRover } from './rover.js';
import { createDust } from './dust.js';
import { createDaylightControls } from './daylight.js';

export async function startExperiment(loading) {
  if (!navigator.gpu) throw new Error('Mirage needs a browser with WebGPU.');
  const canvas = document.querySelector('canvas');
  loading.update(.05, 'Preparing the view…');
  // This revision's meshlet pipeline requires ordinary depth. A 2 m near
  // plane retains useful precision across the 200 km landscape without fallback.
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true });
  renderer._getFallback = null; await renderer.init();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  const meshlets = new MirageDrawingPipeline({ lodThreshold: 1.4, shadowLodThreshold: 3, occlusionCulling: true });
  renderer.drawingPipeline = meshlets;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, 1, 2, 260000);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)'), settings = createSettings(reduced.matches);
  const performanceInfo = { fps: 0, frameMs: 0 };
  let meterStart = null, meterFrames = 0;
  let manual = false, disposed = false, dirty = true, last = null, time = 0;
  let post;
  const changed = () => { dirty = true; post?.requestFrames(); };
  const navigation = createCameraControls(camera, canvas, settings, changed);
  loading.update(.1, 'Mixing sand and stone…'); await new Promise(requestAnimationFrame);
  const materials = createMaterials(), atmosphere = createAtmosphere(scene, camera, renderer);
  const landscape = await createLandscape(scene, materials, (fraction, message) => loading.update(.12 + fraction * .6, message));
  loading.update(.72, 'Carving the sanctuary…'); await new Promise(requestAnimationFrame);
  const architecture = createArchitecture(scene, materials, landscape.surfaceAt);
  loading.update(.8, 'Preparing your rover…'); await new Promise(requestAnimationFrame);
  const rover = await createRover(scene, canvas, landscape, architecture, changed); navigation.attachRover(rover);
  loading.update(.85, 'Stirring the dust…'); await new Promise(requestAnimationFrame);
  const dust = createDust(camera, landscape, atmosphere);
  post = createPostProcessing(renderer, scene, camera, atmosphere, dust);
  nodeTime.onRenderUpdate(() => time);
  const abort = new AbortController(), events = { signal: abort.signal };
  function resize() {
    camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < .8 ? 63 : 52; camera.updateProjectionMatrix();
    const limit = renderer.backend.device.limits.maxTextureDimension2D / Math.max(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(settings.resolution || devicePixelRatio, limit)); renderer.setSize(innerWidth, innerHeight);
    materials.pixelRatio.value = renderer.getPixelRatio(); changed();
    post?.invalidate();
  }
  function render() {
    camera.updateMatrixWorld(); renderer.toneMappingExposure = settings.exposure;
    if (architecture.stairLod.update(camera, renderer.domElement.height, settings.lodDither !== false)) atmosphere.sun.shadow.needsUpdate = true;
    architecture.projection.update(time, rover);
    const transition = settings.lodDither === false ? 0 : .1;
    if (meshlets.lodTransition !== transition) {
      meshlets.lodTransition = transition;
      atmosphere.sun.shadow.needsUpdate = true;
      architecture.projection.light.shadow.needsUpdate = true;
      post.invalidate();
    }
    meshlets.debug = settings.meshlets; meshlets.lodThreshold = settings.lod * renderer.getPixelRatio();
    meshlets.minScreenRadius = .6 * renderer.getPixelRatio(); meshlets.coarseScreenRadius = 2 * renderer.getPixelRatio();
    materials.relief.value = settings.relief; atmosphere.update(settings, time); dust.prepare(); post.update(time, settings);
    if (rover.moving || rover.shadowDirty) atmosphere.sun.shadow.needsUpdate = true;
    post.render(); rover.markShadowRendered(); dirty = false;
  }
  function advance(dt, daylightDt = dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new Error('advance expects a finite, nonnegative timestep.');
    if (!settings.paused) time += dt;
    daylight.update(daylightDt);
    navigation.update(dt, time);
    // Include the frame that removes the last puff when ambient animation
    // is paused; otherwise its final image can remain on the canvas.
    if (dust.needsFrame) changed();
    dust.update(dt, rover, settings);
    if (!settings.paused) changed();
  }
  function reset() { time = 0; navigation.reset(); post?.invalidate(); last = null; changed(); }
  const gui = createSettingsPanel(settings, { changed, resize, reset, setView: navigation.setView }, performanceInfo);
  const daylight = createDaylightControls(settings, atmosphere.sun, atmosphere.cloudPhase, changed, events);
  window.addEventListener('resize', resize, events);
  document.addEventListener('visibilitychange', () => { last = null; }, events);
  reduced.addEventListener('change', () => { settings.paused = reduced.matches; settings.drift = !reduced.matches; changed(); }, events);
  window.addEventListener('keydown', event => {
    if (/INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName) || event.target.isContentEditable || event.repeat) return;
    if (event.code === 'Space') { event.preventDefault(); settings.paused = !settings.paused; changed(); }
    if (event.code === 'KeyH') document.body.classList.toggle('ui-hidden');
    if (event.code === 'KeyR') reset();
  }, events);
  resize(); navigation.update(0, 0); dust.update(0, rover, settings);
  window.mirage = { ready: false, renderer, meshlets, scene, camera, settings, gui, materials, atmosphere, landscape, architecture, rover, dust, daylight, post, navigation, performanceInfo,
    render, advance, reset, resize,
    get time() { return time; }, get manual() { return manual; }, set manual(value) { manual = value; last = null; },
    inspect() { return { time, rockVariants: landscape.variants.length, rockInstances: landscape.instances, grassInstances: landscape.detailInstances, masonryInstances: architecture.instances, roverInstances: rover.instances, terrainExtent: 200000, sourceTriangles: landscape.triangles + architecture.triangles, dpr: renderer.getPixelRatio(), meshlets: meshlets.isMeshletDrawingPipeline }; },
    dispose() { disposed = true; renderer.setAnimationLoop(null); abort.abort(); navigation.dispose(); rover.dispose(); dust.dispose(); gui.destroy(); post.dispose(); landscape.dispose(); architecture.dispose(); atmosphere.dispose(); materials.dispose(); renderer.dispose(); }
  };
  renderer.onDeviceLost = info => { disposed = true; renderer.setAnimationLoop(null); loading.fail(`Graphics device lost: ${info.message}. Reload to start again.`); };
  loading.update(.9, 'Warming the desert light…'); await new Promise(requestAnimationFrame);
  await post.compile();
  if (disposed) return;
  loading.update(.97, 'Opening the desert…'); await new Promise(requestAnimationFrame);
  render(); await renderer.backend.device.queue.onSubmittedWorkDone();
  if (disposed) return;
  loading.finish(); window.mirage.ready = true;
  renderer.setAnimationLoop(timestamp => {
    if (disposed || manual || document.hidden) { last = null; meterStart = null; meterFrames = 0; return; }
    const elapsed = last === null ? 0 : (timestamp - last) / 1000, dt = Math.min(elapsed, .05); last = timestamp;
    // Keep the lighting transition at two wall-clock seconds even if a heavy
    // frame requires a smaller timestep for the vehicle simulation.
    advance(dt, elapsed);
    if (dirty || !settings.paused || post.needsFrame || dust.needsFrame) {
      render();
      if (meterStart === null) meterStart = timestamp;
      meterFrames++;
      if (timestamp - meterStart >= 1000) {
        performanceInfo.frameMs = Math.round((timestamp - meterStart) / meterFrames * 10) / 10;
        performanceInfo.fps = Math.round(meterFrames * 1000 / (timestamp - meterStart));
        meterStart = timestamp; meterFrames = 0;
      }
    } else { meterStart = null; meterFrames = 0; }
  });
}
