import * as THREE from "three/webgpu";
import { createLinkGeometry } from "../breaking-chain.js";

export async function checkAppearance(app) {
  const renderer = app.renderer,
    previous = renderer.getRenderTarget();
  const target = new THREE.RenderTarget(384, 256, {
    type: THREE.HalfFloatType,
  });
  const camera = new THREE.PerspectiveCamera(35, 1.5, 0.005, 3);
  camera.position.set(0.16, 0, 0.65);
  camera.lookAt(0.16, 0, 0);
  const geometry = createLinkGeometry();
  geometry.setAttribute(
    "linkData",
    new THREE.InstancedBufferAttribute(new Float32Array([0.731, 0.317]), 2),
  );
  geometry.attributes.serialData.array[0] = 9;
  const mesh = new THREE.InstancedMesh(geometry, app.corrosion.material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  const steel = new THREE.Scene();
  steel.environment = app.scene.environment;
  const light = new THREE.DirectionalLight("#e5edf4", 3);
  light.position.set(-0.3, 0.4, 0.6);
  steel.add(mesh, light);
  const background = new THREE.Scene();
  background.backgroundNode = app.scene.backgroundNode;
  const serial = app.corrosion.serialRelief,
    clock = app.atmosphere.clock;
  const age = app.corrosion.age,
    reliefControl = app.corrosion.relief;
  const saved = [serial.value, clock.value, age.value, reliefControl.value];
  const read = async (scene) => {
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    // Measure the straight stock itself, excluding empty background pixels.
    const crop = scene === steel ? [144, 32, 96, 192] : [0, 0, 384, 256];
    const data = Float32Array.from(
      await renderer.readRenderTargetPixelsAsync(target, ...crop),
      THREE.DataUtils.fromHalfFloat,
    );
    if (!data.every(Number.isFinite))
      throw new Error("Non-finite appearance pixels");
    return data;
  };
  const difference = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 4)
      for (let k = 0; k < 3; k++) sum += Math.abs(a[i + k] - b[i + k]);
    return sum / ((a.length / 4) * 3);
  };
  try {
    // Material checks use a fixed close-up, independent of camera framing or
    // how many rocks and branches happen to cover the main scene's center.
    age.value = 0;
    const iron = await read(steel);
    age.value = 1;
    const rust = await read(steel);
    const corrosion = difference(iron, rust);
    if (corrosion < 0.01)
      throw new Error(`Corrosion changes the rendered material (${corrosion})`);
    reliefControl.value = 0;
    const flat = await read(steel);
    reliefControl.value = 1.3;
    const pitted = await read(steel);
    const relief = difference(flat, pitted);
    if (relief < 0.0005)
      throw new Error(`Surface relief changes the lighting (${relief})`);
    age.value = saved[2];
    reliefControl.value = saved[3];
    serial.value = 0;
    const plain = await read(steel);
    serial.value = 1;
    const stamped = await read(steel);
    const engraving = difference(plain, stamped);
    if (engraving < 0.001)
      throw new Error(
        `Serial engraving must affect metal lighting (${engraving})`,
      );
    geometry.attributes.serialData.array[0] = -1;
    geometry.attributes.serialData.needsUpdate = true;
    const unmarked = await read(steel);
    serial.value = 0;
    const unmarkedFlat = await read(steel);
    if (difference(unmarked, unmarkedFlat) > 1e-6)
      throw new Error("Unmarked links cannot show a serial stamp");
    clock.value = 0;
    const start = await read(background);
    clock.value = 8;
    const drifted = await read(background);
    const motion = difference(start, drifted);
    if (motion < 0.0002)
      throw new Error(`Background must visibly drift (${motion})`);
    const still = difference(drifted, await read(background));
    if (still > 1e-6)
      throw new Error(
        `Background must stay still when its clock is paused (${still}; motion ${motion})`,
      );
    clock.value += 1 / 60;
    const step = difference(drifted, await read(background));
    if (step > motion * 0.1)
      throw new Error("Background motion must be gradual");
    return {
      corrosion,
      relief,
      engraving,
      backgroundMotion: motion,
      backgroundFrameStep: step,
    };
  } finally {
    [serial.value, clock.value, age.value, reliefControl.value] = saved;
    renderer.setRenderTarget(previous);
    geometry.dispose();
    mesh.dispose();
    target.dispose();
  }
}
