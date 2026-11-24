import * as THREE from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { texture } from "three/tsl";

// CC0 scans by Rico Cilliers and Jenelle van Heerden / Poly Haven.
// See assets/rocks/CREDITS.txt for source URLs and license information.
export async function loadRockAssets(renderer) {
  const loader = new GLTFLoader();
  const variants = await Promise.all(
    ["boulder_01", "rock_07"].map(async (name) => {
      const gltf = await loader.loadAsync(
        `./assets/rocks/${name}/${name}.gltf`,
      );
      let source;
      gltf.scene.traverse((object) => {
        if (object.isMesh) source = object;
      });
      const geometry = source.geometry;
      geometry.center();
      geometry.computeBoundingSphere();
      const scale = 1 / geometry.boundingSphere.radius;
      geometry.scale(scale, scale, scale);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const original = source.material;
      const material = new THREE.MeshStandardNodeMaterial({
        map: original.map,
        normalMap: original.normalMap,
        roughnessMap: original.roughnessMap,
        aoMap: original.aoMap,
        metalness: 0,
        roughness: 1,
        color: "#a3acb1",
        envMapIntensity: 0.5,
      });
      material.normalScale.setScalar(0.9);
      material.roughnessNode = texture(material.roughnessMap)
        .g.mul(0.35)
        .add(0.6);
      material.aoMapIntensity = 0.85;
      material.name = `Scanned ${name}`;
      for (const texture of new Set([
        material.map,
        material.normalMap,
        material.roughnessMap,
        material.aoMap,
      ]))
        if (texture)
          texture.anisotropy = Math.min(8, renderer.getMaxAnisotropy());
      original.dispose();
      // A measured surface point keeps the mounting plate on the scanned rock.
      const probe = new THREE.Mesh(geometry, material);
      probe.updateMatrixWorld();
      const ray = new THREE.Raycaster();
      let hit,
        score = -Infinity;
      for (const x of [-0.3, -0.15, 0, 0.15, 0.3])
        for (const y of [-0.3, -0.15, 0, 0.15, 0.3]) {
          ray.set(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
          const candidate = ray.intersectObject(probe)[0];
          if (!candidate) continue;
          const value = candidate.face.normal.z - Math.hypot(x, y) * 0.2;
          if (value > score) {
            score = value;
            hit = candidate;
          }
        }
      const ports = [];
      for (const direction of [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ]) {
        const axis = new THREE.Vector3(...direction);
        const u = new THREE.Vector3(
          Math.abs(axis.y) < 0.8 ? 0 : 1,
          Math.abs(axis.y) < 0.8 ? 1 : 0,
          0,
        );
        const v = new THREE.Vector3().crossVectors(axis, u);
        let best,
          bestScore = -Infinity;
        for (const a of [-0.2, 0, 0.2])
          for (const b of [-0.2, 0, 0.2]) {
            ray.set(
              axis
                .clone()
                .multiplyScalar(3)
                .addScaledVector(u, a)
                .addScaledVector(v, b),
              axis.clone().negate(),
            );
            const candidate = ray.intersectObject(probe)[0];
            if (candidate && candidate.face.normal.dot(axis) > bestScore) {
              bestScore = candidate.face.normal.dot(axis);
              best = candidate;
            }
          }
        if (best)
          ports.push({
            socket: best.point.toArray(),
            normal: best.face.normal.toArray(),
          });
      }
      return {
        geometry,
        material,
        socket: hit.point.toArray(),
        normal: hit.face.normal.toArray(),
        ports,
      };
    }),
  );
  return {
    variants,
    shapes: variants.map(({ socket, normal, ports }) => ({
      socket,
      normal,
      ports,
    })),
    dispose() {
      const textures = new Set();
      for (const { geometry, material } of variants) {
        geometry.dispose();
        for (const texture of [
          material.map,
          material.normalMap,
          material.roughnessMap,
          material.aoMap,
        ])
          if (texture) textures.add(texture);
        material.dispose();
      }
      for (const texture of textures) texture.dispose();
    },
  };
}
