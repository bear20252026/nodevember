import * as THREE from "three/webgpu";
import { bakeSurface, createCorrosion } from "./corrosion.js";
import { createAtmosphere } from "./atmosphere.js";
import { createBreakingChain } from "./breaking-chain.js";
import { BreakingJourney, cameraFov } from "./journey.js";
import { createDebris } from "./debris.js";
import { createDust, createSparks } from "./dust.js";
import { createSettings, createSettingsPanel } from "./settings.js";
import { createPostProcessing } from "./post-processing.js";
import { renderPixelRatio } from "./render-resolution.js";
import { loadRockAssets } from "./rock-assets.js";
import { createRockAnchors } from "./rock-anchors.js";
import { createMountSteel } from "./mount-steel.js";

export async function startExperiment() {
  if (!navigator.gpu)
    throw new Error("This experiment needs a browser with WebGPU.");
  const canvas = document.querySelector("canvas");
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: false });
  renderer._getFallback = null;
  await renderer.init();
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene(),
    dustScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, 0.018, 70);
  camera.position.set(0, 0, 3.15);
  const stressMatrix = new THREE.Matrix4(),
    stressPosition = new THREE.Vector3();
  const rockAssets = await loadRockAssets(renderer);
  const surface = bakeSurface(renderer),
    corrosion = createCorrosion(surface),
    mountSteel = createMountSteel(surface, corrosion),
    atmosphere = createAtmosphere(renderer, scene, rockAssets);
  const post = createPostProcessing(renderer, scene, camera, dustScene);
  const dust = createDust(dustScene, post.dustDepth, post.focus),
    sparks = createSparks(dustScene, post.dustDepth, post.focus),
    debris = createDebris(scene);
  const settings = createSettings();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let paused = reduced.matches,
    pulling = false,
    pointer = null,
    pointerTarget = null,
    manual = false,
    disposed = false;
  let last = null,
    lastDpr = devicePixelRatio,
    frame = 0,
    dirty = true,
    settle = 3;
  const abort = new AbortController(),
    events = { signal: abort.signal };
  let journey;
  function makeJourney(seed) {
    return new BreakingJourney({
      seed,
      rockShapes: rockAssets.shapes,
      linkCount: 13,
      branchLinkCount: 6,
      rockTethers: true,
      getAspect: () => innerWidth / innerHeight,
      onCreate(shot) {
        shot.visual = createBreakingChain(
          scene,
          shot.simulation,
          corrosion.material,
          shot.z,
          shot.index,
        );
        shot.rockVisual = createRockAnchors(
          scene,
          shot.simulation,
          rockAssets,
          shot.z,
          corrosion.material,
          mountSteel.material,
        );
      },
      onCrack(shot) {
        const p = shot.simulation.fracture.position;
        const point = new THREE.Vector3(p[0], p[1], p[2] + shot.z);
        dust.burst(point, 0.35);
      },
      onBreak(shot) {
        const p = shot.simulation.fracture.position;
        const point = new THREE.Vector3(p[0], p[1], p[2] + shot.z);
        debris.burst(point, shot.index * 3 + shot.simulation.fracture.order);
        sparks.burst(point);
        dust.burst(point, shot.simulation.fractureMode === "shatter" ? 1.4 : 1);
      },
      onRemove(shot) {
        shot.visual.dispose();
        shot.rockVisual.dispose();
      },
      onAdvance(dt) {
        debris.update(dt);
        sparks.update(dt);
        dust.advance(dt);
      },
    });
  }
  journey = makeJourney();
  function changed() {
    dirty = true;
    settle = 3;
  }
  function pause(value = !paused) {
    paused = value;
    last = null;
    changed();
  }
  function setAuto(value = !settings.auto) {
    settings.auto = value;
    changed();
  }
  function setPull(value) {
    pulling = value;
    document.body.classList.toggle("pulling", value);
    if (value) {
      setAuto(false);
      pause(false);
    }
    changed();
  }
  function reset(seed) {
    releasePull();
    journey.dispose();
    debris.clear();
    sparks.clear();
    dust.clear();
    journey = makeJourney(seed);
    last = null;
    changed();
    sync();
  }
  function resize() {
    camera.aspect = innerWidth / innerHeight;
    camera.fov = cameraFov(camera.aspect);
    camera.updateProjectionMatrix();
    atmosphere.aspect.value = camera.aspect;
    lastDpr = devicePixelRatio;
    const ratio = renderPixelRatio(
      innerWidth,
      innerHeight,
      devicePixelRatio,
      settings.resolution,
      renderer.backend.device?.limits.maxTextureDimension2D ?? 8192,
    );
    renderer.setPixelRatio(ratio);
    renderer.setSize(innerWidth, innerHeight);
    changed();
  }
  const gui = createSettingsPanel(settings, { setAuto, resize, changed });
  function sync() {
    const shot = journey.current,
      simulation = shot.simulation,
      pose = journey.cameraPose(camera.aspect);
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(pose.x, pose.y, pose.z);
    camera.lookAt(...pose.target);
    camera.updateMatrixWorld();
    for (const shot of journey.shots) {
      shot.visual.update(!paused);
      shot.rockVisual.update(!paused);
    }
    corrosion.age.value = settings.rust;
    corrosion.relief.value = settings.relief;
    renderer.toneMappingExposure = settings.exposure;
    scene.environmentIntensity = settings.environment;
    atmosphere.fractureLightStrength = settings.fractureLight;
    let fracture = simulation.fracture?.position;
    const warning = shot.stressLink !== null && !simulation.pendingFracture;
    if (warning) {
      shot.visual.meshes[0].getMatrixAt(shot.stressLink, stressMatrix);
      fracture = stressPosition.setFromMatrixPosition(stressMatrix).toArray();
    }
    const loading = simulation.loadedComponents.find((component) =>
      component.links.has(shot.stressLink),
    );
    atmosphere.update(
      journey.time,
      pose.target[2],
      warning || simulation.pendingFracture ? -1 : journey.fractureAge,
      [pose.x, pose.y],
      fracture && [fracture[0], fracture[1], fracture[2] + shot.z],
      simulation.pendingFracture
        ? 1
        : (settings.auto || pulling) && warning
          ? Math.min(1, (loading?.load ?? 0) / simulation.strength)
          : 0,
      camera.position,
      camera.fov,
    );
    dust.clock.value = journey.physicsTime;
    dust.strength.value = settings.dust;
    post.focus.value = pose.focus;
    post.focusRange.value = 0.5 + pose.focus * 0.16;
    post.lensBlur.value = settings.lensBlur;
    post.glow.strength.value = settings.bloom;
    post.vignette.value = settings.vignette;
    post.grading.update(settings);
  }
  function advance(dt) {
    if (paused || disposed) return;
    journey.advance(dt, {
      auto: settings.auto,
      pulling,
      speed: settings.speed,
      strength: settings.strength,
    });
    changed();
  }
  function render() {
    if (disposed) return;
    sync();
    dust.update(renderer, journey, camera);
    post.render();
    dirty = false;
  }
  function beginPull(e) {
    if (
      e.button !== 0 ||
      pointer !== null ||
      (e.pointerType === "touch" && !e.isPrimary)
    )
      return;
    e.preventDefault();
    pointer = e.pointerId;
    pointerTarget = e.currentTarget;
    pointerTarget.setPointerCapture(e.pointerId);
    setPull(true);
  }
  function releasePull() {
    const id = pointer,
      target = pointerTarget;
    pointer = null;
    pointerTarget = null;
    if (id !== null && target?.hasPointerCapture(id))
      target.releasePointerCapture(id);
    setPull(false);
  }
  function endPull(e) {
    if (pointer === e.pointerId) releasePull();
  }
  canvas.addEventListener("pointerdown", beginPull, events);
  canvas.addEventListener("pointerup", endPull, events);
  canvas.addEventListener("pointercancel", endPull, events);
  canvas.addEventListener("lostpointercapture", endPull, events);
  window.addEventListener("resize", resize, events);
  window.addEventListener("blur", releasePull, events);
  document.addEventListener(
    "visibilitychange",
    () => {
      last = null;
      if (document.hidden) releasePull();
      changed();
    },
    events,
  );
  reduced.addEventListener(
    "change",
    (e) => {
      if (e.matches) pause(true);
    },
    events,
  );
  window.addEventListener(
    "keydown",
    (e) => {
      if (
        e.target.matches("input,select,textarea,button") ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        pause();
      }
      if (e.code === "KeyA") setAuto();
      if (e.code === "KeyH") document.body.classList.toggle("ui-hidden");
    },
    events,
  );
  function loop(now) {
    if (disposed) return;
    if (devicePixelRatio !== lastDpr) resize();
    frame = requestAnimationFrame(loop);
    if (document.hidden || manual) {
      last = null;
      return;
    }
    const dt = last === null ? 0 : Math.min(0.05, (now - last) / 1000);
    last = now;
    advance(dt);
    if (!paused || dirty || settle > 0) {
      render();
      settle--;
    }
  }
  resize();
  pause(paused);
  setAuto(settings.auto);
  render();
  document.querySelector("#status").hidden = true;
  window.tension = {
    renderer,
    scene,
    camera,
    settings,
    corrosion,
    mountSteel,
    atmosphere,
    rockAssets,
    post,
    dust,
    sparks,
    debris,
    gui,
    get journey() {
      return journey;
    },
    get time() {
      return journey.time;
    },
    get paused() {
      return paused;
    },
    get pulling() {
      return pulling;
    },
    get manual() {
      return manual;
    },
    set manual(value) {
      manual = value;
      last = null;
      changed();
    },
    advance,
    render,
    pause,
    reset,
    setPull,
    setAuto,
    inspect() {
      return {
        backend: renderer.backend.constructor.name,
        revision: THREE.REVISION,
        paused,
        pulling,
        resolution: renderer.getPixelRatio(),
        debris: debris.count,
        ...journey.inspect(),
      };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      abort.abort();
      gui.destroy();
      journey.dispose();
      debris.dispose();
      dust.dispose();
      sparks.dispose();
      post.dispose();
      atmosphere.dispose();
      rockAssets.dispose();
      corrosion.dispose();
      mountSteel.dispose();
      surface.dispose();
      renderer.dispose();
    },
  };
  frame = requestAnimationFrame(loop);
}
