import * as THREE from "three/webgpu";
import { uniform, vec4 } from "three/tsl";

export async function checkMist(app) {
  const mist = app.atmosphere.mist,
    clock = app.atmosphere.clock;
  const saved = {
    position: mist.position.value.clone(),
    clock: clock.value,
    strength: mist.strength.value,
  };
  const viewDepth = uniform(70);
  const surface = uniform(new THREE.Color("#061722"));
  const material = new THREE.MeshBasicNodeMaterial();
  material.fragmentNode = vec4(mist.apply(surface, viewDepth), 1);
  material.toneMapped = false;
  const quad = new THREE.QuadMesh(material);
  const referenceMaterial = new THREE.MeshBasicNodeMaterial();
  referenceMaterial.fragmentNode = vec4(
    mist.apply(surface, viewDepth, false),
    1,
  );
  referenceMaterial.toneMapped = false;
  const reference = new THREE.QuadMesh(referenceMaterial);
  const target = new THREE.RenderTarget(256, 192, {
    type: THREE.HalfFloatType,
  });
  const renderer = app.renderer,
    previous = renderer.getRenderTarget();
  const read = async (mesh = quad) => {
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);
    mesh.render(renderer);
    renderer.setRenderTarget(previous);
    const values = Float32Array.from(
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, 256, 192),
      THREE.DataUtils.fromHalfFloat,
    );
    if (!values.every(Number.isFinite))
      throw new Error("Non-finite mist pixels");
    return values;
  };
  const difference = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 4)
      for (let k = 0; k < 3; k++) sum += Math.abs(a[i + k] - b[i + k]);
    return sum / ((a.length / 4) * 3);
  };
  try {
    let cacheError = 0;
    mist.strength.value = 1;
    for (const [time, x, y, z, depth] of [
      [0, 0, 0, 12, 70],
      [8, 1.5, -0.8, 20, 25],
      [19, -2, 1, 59.999, 8],
    ]) {
      clock.value = time;
      mist.position.value.set(x, y, z);
      viewDepth.value = depth;
      cacheError = Math.max(
        cacheError,
        difference(await read(), await read(reference)),
      );
    }
    if (cacheError > 0.0001)
      throw new Error(
        `Cached fog must match the original procedural shader (${cacheError})`,
      );
    viewDepth.value = 70;
    clock.value = 0;
    mist.strength.value = 1;
    mist.position.value.set(0, 0, 12);
    const start = await read();
    mist.position.value.z += 8;
    const travelled = await read();
    const motion = difference(start, travelled);
    if (motion < 0.001)
      throw new Error(`Camera Z must move visibly through mist (${motion})`);
    if (difference(travelled, await read()) > 1e-6)
      throw new Error("Paused mist must remain still");
    mist.position.value.z += 0.1;
    const step = difference(travelled, await read());
    if (step > motion * 0.15) throw new Error("Mist travel must be continuous");
    mist.position.value.z = 12;
    if (difference(start, await read()) > 1e-6)
      throw new Error("Returning to the same Z restores the layer phases");
    const lateral = {};
    for (const axis of ["x", "y"]) {
      mist.position.value[axis] = 0.75;
      const shifted = await read();
      lateral[axis] = difference(start, shifted);
      if (lateral[axis] < 0.0001)
        throw new Error(
          `Camera ${axis.toUpperCase()} must move the fog layers`,
        );
      mist.position.value[axis] += 0.01;
      if (difference(shifted, await read()) > lateral[axis] * 0.15)
        throw new Error("Lateral mist travel must remain smooth");
      mist.position.value[axis] = 0;
      if (difference(start, await read()) > 1e-6)
        throw new Error("Returning to the same X/Y must restore the fog");
    }
    let largestSeam = 0;
    for (let layer = 0; layer < 3; layer++) {
      const seam = (3 - layer / 3) * 30;
      mist.position.value.z = seam - 0.001;
      const before = await read();
      mist.position.value.z = seam + 0.001;
      largestSeam = Math.max(largestSeam, difference(before, await read()));
    }
    if (largestSeam > motion * 0.01)
      throw new Error(`A mist layer pops when recycled (${largestSeam})`);
    viewDepth.value = 1;
    const near = await read();
    mist.strength.value = 0;
    const clear = await read();
    if (difference(near, clear) > 1e-6)
      throw new Error("Distant mist cannot cover a nearer object");
    mist.strength.value = 1;
    const contrast = async (depth) => {
      viewDepth.value = depth;
      surface.value.set("#050505");
      const dark = await read();
      surface.value.set("#cccccc");
      return difference(dark, await read());
    };
    const nearContrast = await contrast(8),
      farContrast = await contrast(70);
    if (farContrast > nearContrast * 0.3)
      throw new Error("Distant surfaces must lose contrast in the shared fog");
    return {
      cacheError,
      cameraTravel: motion,
      lateralTravel: lateral,
      frameStep: step,
      recycleSeam: largestSeam,
      distantContrast: farContrast / nearContrast,
    };
  } finally {
    mist.position.value.copy(saved.position);
    clock.value = saved.clock;
    mist.strength.value = saved.strength;
    renderer.setRenderTarget(previous);
    material.dispose();
    referenceMaterial.dispose();
    target.dispose();
  }
}
