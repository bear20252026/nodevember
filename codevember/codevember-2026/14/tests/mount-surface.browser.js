import * as THREE from "three/webgpu";

export async function checkMountSurface(app) {
  const scene = new THREE.Scene();
  scene.environment = app.scene.environment;
  scene.background = new THREE.Color("#05080c");
  // Inspect the actual plate, pin and bolts used on a rock, without DOF.
  const mount = app.journey.current.rockVisual.mounts[0].mount.clone(true);
  mount.position.set(0, 0, 0);
  mount.quaternion.identity();
  scene.add(mount);
  const light = new THREE.DirectionalLight("#d8e5ef", 3);
  light.position.set(-1, 2, 1);
  scene.add(light);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 10);
  camera.position.set(0.55, 0.35, 1.1);
  camera.lookAt(0, 0, 0.1);
  const renderer = app.renderer,
    previous = renderer.getRenderTarget();
  const target = new THREE.RenderTarget(384, 384, {
    type: THREE.HalfFloatType,
  });
  const saved = app.mountSteel.detail.value;
  const read = async (detail) => {
    app.mountSteel.detail.value = detail;
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    return Float32Array.from(
      await renderer.readRenderTargetPixelsAsync(target, 96, 96, 192, 192),
      THREE.DataUtils.fromHalfFloat,
    );
  };
  try {
    const flat = await read(0),
      bumped = await read(1);
    let difference = 0;
    for (let i = 0; i < flat.length; i += 4)
      for (let k = 0; k < 3; k++) {
        if (!Number.isFinite(bumped[i + k]))
          throw new Error("Non-finite mounting hardware pixels");
        difference += Math.abs(flat[i + k] - bumped[i + k]);
      }
    difference /= (flat.length / 4) * 3;
    if (difference < 0.001)
      throw new Error(
        `Mounting hardware needs visible bump relief (${difference})`,
      );
    return { relief: difference };
  } finally {
    app.mountSteel.detail.value = saved;
    renderer.setRenderTarget(previous);
    target.dispose();
  }
}
