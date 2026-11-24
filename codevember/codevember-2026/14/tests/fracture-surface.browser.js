import * as THREE from "three/webgpu";
import { createLinkGeometry } from "../breaking-chain.js";
import { CUT } from "../tension-simulation.js";
import { linkPoint } from "../link-shape.js";

// Look directly at a real broken end, so this cannot pass by measuring bump
// on the intact outside of the chain or on the environment behind it.
export async function checkFractureSurface(app) {
  const geometry = createLinkGeometry({ start: CUT, span: 0.5, caps: true });
  geometry.setAttribute(
    "linkData",
    new THREE.InstancedBufferAttribute(new Float32Array([0.7, 0.3]), 2),
  );
  const mesh = new THREE.InstancedMesh(geometry, app.corrosion.material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#05080c");
  scene.environment = app.scene.environment;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.005, 3);
  const center = new THREE.Vector3(...linkPoint(CUT));
  camera.position.copy(center).add(new THREE.Vector3(0.025, 0.25, 0.025));
  camera.lookAt(center);
  const light = new THREE.DirectionalLight("#d8e5ef", 3);
  light.position.copy(center).add(new THREE.Vector3(-0.12, 0.3, 0.15));
  light.target.position.copy(center);
  scene.add(mesh, light, light.target);
  const target = new THREE.RenderTarget(256, 256, {
    type: THREE.HalfFloatType,
  });
  const renderer = app.renderer,
    previous = renderer.getRenderTarget();
  const saved = app.corrosion.fractureRelief.value;
  const read = async (relief) => {
    app.corrosion.fractureRelief.value = relief;
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(previous);
    const pixels = await renderer.readRenderTargetPixelsAsync(
      target,
      80,
      80,
      96,
      96,
    );
    return Float32Array.from(pixels, THREE.DataUtils.fromHalfFloat);
  };
  try {
    const flat = await read(0),
      textured = await read(1);
    let difference = 0,
      light = 0;
    for (let i = 0; i < flat.length; i += 4) {
      for (let k = 0; k < 3; k++) {
        if (!Number.isFinite(textured[i + k]))
          throw new Error("Non-finite fracture pixels");
        difference += Math.abs(textured[i + k] - flat[i + k]);
        light += textured[i + k];
      }
    }
    difference /= (flat.length / 4) * 3;
    light /= (flat.length / 4) * 3;
    if (difference < 0.003 || difference / Math.max(light, 0.001) < 0.08)
      throw new Error(
        `Fracture faces need visible grain and bump (${difference}, ${light})`,
      );
    return {
      difference,
      brightness: light,
      relativeRelief: difference / light,
    };
  } finally {
    app.corrosion.fractureRelief.value = saved;
    renderer.setRenderTarget(previous);
    geometry.dispose();
    mesh.dispose();
    target.dispose();
  }
}
