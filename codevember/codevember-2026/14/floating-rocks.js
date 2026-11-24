import * as THREE from "three/webgpu";
import { positionView, lights } from "three/tsl";
import { RockField, ROCK_NEAR_FADE, ROCK_FAR_FADE } from "./rock-field.js";

const ROTATION_SPEED = 6;

export function createFloatingRocks(scene, assets) {
  const group = new THREE.Group();
  group.name = "Distant scanned rock field";
  scene.add(group);
  const moon = new THREE.DirectionalLight("#86d7ff", 3.2);
  moon.position.set(12, 18, -15);
  moon.target.position.set(0, 0, -30);
  group.add(moon, moon.target);
  const fill = new THREE.AmbientLight("#42627c", 0.65);
  const materials = assets.variants.map(({ material }) => {
    const distant = material.clone();
    distant.color.set("#71828e");
    distant.lightsNode = lights([moon, fill]);
    const depth = positionView.z.negate();
    distant.opacityNode = depth
      .smoothstep(...ROCK_NEAR_FADE)
      .mul(depth.smoothstep(...ROCK_FAR_FADE).oneMinus());
    distant.transparent = true;
    distant.depthWrite = false;
    return distant;
  });
  // The attached rocks occupy the foreground; a sparse field supplies depth.
  const field = new RockField();
  const rocks = Array.from({ length: 10 }, (_, i) => {
    const variant = i % assets.variants.length;
    const mesh = new THREE.Mesh(
      assets.variants[variant].geometry,
      materials[variant],
    );
    mesh.name = `Distant floating rock ${i + 1}`;
    group.add(mesh);
    return { mesh };
  });
  return {
    group,
    rocks,
    field,
    update(time, cameraPosition, aspect) {
      if (!cameraPosition) return;
      const positions = field.update(time, cameraPosition.z);
      const width = Math.max(0.55, Math.min(1.3, aspect / 1.45));
      const spin = time * ROTATION_SPEED;
      for (const [i, { mesh }] of rocks.entries()) {
        const { x, y, z, size, phase } = positions[i];
        mesh.scale.setScalar(size);
        mesh.position.set(
          x * width + Math.sin(time * 0.023 + phase) * 0.5,
          y + Math.cos(time * 0.019 + phase) * 0.45,
          z,
        );
        mesh.rotation.set(
          phase * 0.31 + spin * 0.009,
          phase + spin * (0.012 + Math.sin(phase) * 0.005),
          phase * 0.23 + Math.sin(spin * 0.015 + phase) * 0.08,
        );
      }
    },
    dispose() {
      scene.remove(group);
      for (const material of materials) material.dispose();
    },
  };
}
