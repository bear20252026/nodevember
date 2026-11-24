import { checkDust } from "./dust.browser.js";
import { checkFractureSurface } from "./fracture-surface.browser.js";
import { checkAppearance } from "./appearance.browser.js";
import { checkMountSurface } from "./mount-surface.browser.js";
import { checkMist } from "./mist.browser.js";
import { checkColorGrading } from "./color-grading.browser.js";
import { DataUtils, Vector3, Matrix4 } from "three/webgpu";
import { TRANSITION_DURATION } from "../journey.js";

// Run in a separate preview tab. This reads rendered GPU pixels, resets the
// sequence and restores settings on completion.
export async function checkRendering(app = window.tension) {
  const settings = { ...app.settings },
    manual = app.manual,
    paused = app.paused;
  const read = async (
    pass = app.post.scenePass,
    point = null,
    cropSize = 384,
  ) => {
    await new Promise(requestAnimationFrame);
    app.render();
    const rt = pass.renderTarget,
      size = Math.min(cropSize, rt.width, rt.height);
    const ndc = point?.clone().project(app.camera);
    const x = ndc ? (ndc.x * 0.5 + 0.5) * rt.width : rt.width / 2;
    const y = ndc ? (-ndc.y * 0.5 + 0.5) * rt.height : rt.height / 2;
    const pixels = await app.renderer.readRenderTargetPixelsAsync(
      rt,
      Math.max(0, Math.min(rt.width - size, Math.floor(x - size / 2))),
      Math.max(0, Math.min(rt.height - size, Math.floor(y - size / 2))),
      size,
      size,
      0,
    );
    const floats = Float32Array.from(pixels, DataUtils.fromHalfFloat);
    if (!floats.every(Number.isFinite))
      throw new Error("Non-finite rendered pixels");
    return floats;
  };
  const difference = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 4)
      sum +=
        (Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2])) /
        3;
    return sum / (a.length / 4);
  };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  try {
    app.manual = true;
    app.pause(true);
    app.reset(2);
    for (const mesh of app.journey.current.visual.meshes.slice(1)) {
      const g = mesh.geometry,
        p = g.attributes.position.array,
        n = g.attributes.normal.array,
        cap = g.attributes.fracture.array;
      for (let i = 0; i < g.index.count; i += 3) {
        const [a, b, c] = Array.from(g.index.array.slice(i, i + 3));
        if (!cap[a] || !cap[b] || !cap[c]) continue;
        const u = [0, 1, 2].map((k) => p[b * 3 + k] - p[a * 3 + k]),
          v = [0, 1, 2].map((k) => p[c * 3 + k] - p[a * 3 + k]);
        const cross = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        check(
          cross.reduce((s, x, k) => s + x * n[a * 3 + k], 0) > 0,
          "Fresh fracture caps face outward",
        );
      }
    }
    check(app.renderer.backend.isWebGPUBackend, "Native WebGPU backend");
    const reactiveDust = await checkDust(app);
    Object.assign(app.settings, settings);
    app.corrosion.relief.value = settings.relief;
    const fractureSurface = await checkFractureSurface(app);
    const appearance = await checkAppearance(app);
    const { corrosion, relief } = appearance;
    const mountSurface = await checkMountSurface(app);
    const mist = await checkMist(app);
    const grading = await checkColorGrading(app);
    app.settings.fractureLight = 2;
    app.pause(false);
    app.setAuto(true);
    const warningShot = app.journey.current,
      warningSim = warningShot.simulation;
    for (
      let i = 0;
      i < 1200 &&
      (warningShot.stressLink === null ||
        warningSim.load < warningSim.strength * 0.78);
      i++
    )
      app.advance(1 / 120);
    app.pause(true);
    const selected = warningShot.stressLink;
    check(
      selected !== null && !warningSim.fracture,
      "Warning precedes failure",
    );
    const warningPoint = new Vector3(...warningSim.links[selected].position);
    warningPoint.z += warningShot.z;
    const glowing = await read(app.post.scenePass, warningPoint);
    const warningIntensity = app.atmosphere.flash.intensity;
    check(warningIntensity > 1, "Tension raises the localized light");
    app.settings.fractureLight = 0;
    const unlit = await read(app.post.scenePass, warningPoint);
    const warningPixels = difference(glowing, unlit);
    check(warningPixels > 0.001, "Warning light illuminates actual GPU pixels");
    app.settings.fractureLight = 2;
    app.pause(false);
    app.setAuto(false);
    app.advance(0.7);
    await read();
    check(
      app.atmosphere.flash.intensity < warningIntensity * 0.1,
      "Release fades the light",
    );
    check(
      warningShot.stressLink === selected,
      "Release preserves the chosen link",
    );
    app.setPull(true);
    for (let i = 0; i < 1200 && !warningSim.fracture; i++) app.advance(1 / 120);
    check(
      warningSim.fracture?.index === selected,
      "The illuminated link actually breaks",
    );
    const warning = {
      index: selected,
      intensity: warningIntensity,
      pixels: warningPixels,
    };
    Object.assign(app.settings, settings);
    app.reset(2);
    app.pause(true);
    const frozen = JSON.stringify(app.inspect());
    app.advance(2);
    check(
      JSON.stringify(app.inspect()) === frozen,
      "Pause freezes physics, particles and camera",
    );
    Object.assign(app.settings, settings);
    app.pause(false);
    app.setAuto(false);
    app.advance(2);
    check(
      !app.journey.current.simulation.broken,
      "Manual mode waits for a pull",
    );
    app.setAuto(true);
    app.setPull(true);
    check(
      !app.settings.auto,
      "Taking hold switches to manual pull and release",
    );
    for (let i = 0; i < 600 && !app.journey.current.simulation.broken; i++)
      app.advance(1 / 60);
    app.setPull(false);
    app.advance(0.5);
    const shot = app.journey.current;
    await read();
    check(shot.simulation.broken, "Holding fractures the chain");
    const matrix = new Matrix4();
    shot.visual.meshes[0].getMatrixAt(shot.simulation.weakLink, matrix);
    check(
      matrix.determinant() === 0 &&
        shot.visual.fragmentMeshes.every((mesh) => mesh.visible),
      "Rendered fragments replace only the fractured instance",
    );
    const fracturePoint = new Vector3(...shot.simulation.fracture.position);
    fracturePoint.z += shot.z;
    const glints = await read(app.post.particlesPass, fracturePoint),
      age = app.sparks.age.value;
    app.sparks.age.value = 100;
    const quiet = await read(app.post.particlesPass, fracturePoint);
    app.sparks.age.value = age;
    const sparks = difference(glints, quiet);
    check(
      sparks > 0.0001,
      `Fracture particles contribute to GPU output (${sparks})`,
    );
    const oldAngle = shot.simulation.angle,
      oldZ = app.camera.position.z;
    app.advance(TRANSITION_DURATION);
    await read();
    check(app.journey.index === 1, "Next chain becomes active");
    check(
      Math.abs(app.journey.current.simulation.angle - oldAngle) > 0.1,
      "Next chain has a different angle",
    );
    check(app.camera.position.z > oldZ + 4, "Camera has pulled back");
    check(
      app.journey.shots.includes(shot),
      "Outgoing chain remains in the scene after the transition",
    );
    check(
      shot.simulation.anchorsReleased,
      "Outgoing chain is free to fall out of view",
    );
    const assembly = app.journey.current;
    assembly.simulation.forcedWeakLink = assembly.simulation.centerLink;
    app.setAuto(true);
    for (let i = 0; i < 1200 && !assembly.reportedBreaks; i++)
      app.advance(1 / 60);
    check(
      assembly.reportedBreaks === 1 && !assembly.simulation.broken,
      "First break leaves loaded branches",
    );
    check(
      app.journey.next === null && app.journey.transitionAge === -1,
      "Camera remains with surviving chains",
    );
    await read();
    for (let i = 0; i < 1200 && !assembly.simulation.broken; i++)
      app.advance(1 / 60);
    await read();
    const cascade = assembly.simulation.fractures.length;
    check(
      cascade >= 2 && assembly.simulation.broken,
      "Surviving paths finish breaking",
    );
    check(
      assembly.visual.fragmentMeshes.every((mesh) => mesh.count === cascade),
      "All earlier fragments remain rendered",
    );
    for (const fracture of assembly.simulation.fractures) {
      assembly.visual.meshes[0].getMatrixAt(fracture.index, matrix);
      check(matrix.determinant() === 0, "Each fractured instance is replaced");
      const parentSerial =
        assembly.visual.meshes[0].geometry.attributes.serialData.array[
          fracture.index
        ];
      check(
        assembly.visual.fragmentMeshes.every(
          (mesh) =>
            mesh.geometry.attributes.serialData.array[fracture.order] ===
            parentSerial,
        ),
        "Broken pieces retain their original engraved serial number",
      );
    }
    return {
      passed: true,
      reactiveDust,
      fractureSurface,
      appearance,
      mountSurface,
      mist,
      grading,
      warning,
      cascade,
      corrosion,
      relief,
      sparks,
      backend: app.renderer.backend.constructor.name,
      revision: app.inspect().revision,
    };
  } finally {
    Object.assign(app.settings, settings);
    app.setAuto(settings.auto);
    app.reset();
    app.pause(paused);
    app.manual = manual;
    await new Promise(requestAnimationFrame);
    app.render();
  }
}
