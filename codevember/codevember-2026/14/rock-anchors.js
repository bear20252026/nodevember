import * as THREE from "three/webgpu";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { STEP } from "./tension-simulation.js";
import { createLinkGeometry } from "./breaking-chain.js";
import { CLEVIS } from "./link-shape.js";

export function createRockAnchors(
  scene,
  simulation,
  assets,
  z,
  chainMaterial,
  steel,
) {
  const group = new THREE.Group();
  group.name = "Rocks pulling the chain";
  group.position.z = z;
  scene.add(group);
  const plate = new RoundedBoxGeometry(0.5, 0.42, 0.07, 5, 0.028);
  const ear = new RoundedBoxGeometry(0.075, 0.18, 0.34, 5, 0.021);
  function beveledCylinder(radius, height, bevel, segments, flat = false) {
    const half = height / 2;
    const geometry = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, -half),
        new THREE.Vector2(radius - bevel, -half),
        new THREE.Vector2(radius, -half + bevel),
        new THREE.Vector2(radius, half - bevel),
        new THREE.Vector2(radius - bevel, half),
        new THREE.Vector2(0, half),
      ],
      segments,
    );
    if (!flat) return geometry;
    const faceted = geometry.toNonIndexed();
    geometry.dispose();
    faceted.computeVertexNormals();
    return faceted;
  }
  const pin = beveledCylinder(0.045, 0.38, 0.014, 24);
  pin.rotateZ(Math.PI / 2);
  const bolt = beveledCylinder(0.035, 0.065, 0.012, 6, true);
  bolt.rotateX(Math.PI / 2);
  const shank = beveledCylinder(0.085, 0.6, 0.024, 20);
  shank.rotateX(Math.PI / 2);
  function addMount(root, rock, surface, link) {
    const mount = new THREE.Group();
    mount.name = "Bolted steel clevis and captive pin";
    mount.position.fromArray(surface.socket).multiplyScalar(rock.size);
    const normal = new THREE.Vector3(...surface.normal).normalize();
    const inverse = new THREE.Quaternion(...rock.quaternion).invert();
    const x = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(new THREE.Quaternion(...link.quaternion))
      .applyQuaternion(inverse);
    x.addScaledVector(normal, -x.dot(normal)).normalize();
    const y = new THREE.Vector3().crossVectors(normal, x);
    mount.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(x, y, normal),
    );
    function part(geometry, x, y, z) {
      const item = new THREE.Mesh(geometry, steel);
      item.position.set(x, y, z);
      item.castShadow = item.receiveShadow = true;
      mount.add(item);
    }
    part(plate, 0, 0, 0);
    part(shank, 0, 0, -0.27);
    part(ear, -0.14, 0, 0.18);
    part(ear, 0.14, 0, 0.18);
    part(pin, 0, 0, CLEVIS.pinHeight);
    for (const x of [-0.18, 0.18])
      for (const y of [-0.14, 0.14]) part(bolt, x, y, 0.065);
    root.add(mount);
    return mount;
  }
  const anchors = [
    ...simulation.anchors,
    ...simulation.tethers.map((t) => t.anchor),
  ];
  const mounts = anchors.map((anchor) => {
    const rock = anchor.rock,
      asset = assets.variants[rock.shapeIndex];
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(asset.geometry, asset.material);
    mesh.scale.setScalar(rock.size);
    mesh.castShadow = mesh.receiveShadow = true;
    root.add(mesh);
    const mount = addMount(root, rock, asset, anchor.linkBody);
    group.add(root);
    return { root, mesh, mount, rock };
  });
  for (const tether of simulation.tethers) {
    const parent = mounts.find((m) => m.rock === tether.parent);
    parent.supportMount = addMount(
      parent.root,
      tether.parent,
      tether.port,
      tether.bodies[0],
    );
  }
  const geometry = createLinkGeometry();
  const count = simulation.tetherLinks.length;
  const fields = new Float32Array(count * 2);
  for (let i = 0; i < fields.length; i++)
    fields[i] = i * 0.371 + simulation.seed;
  geometry.setAttribute(
    "linkData",
    new THREE.InstancedBufferAttribute(fields, 2),
  );
  geometry.setAttribute(
    "serialData",
    new THREE.InstancedBufferAttribute(new Float32Array(count).fill(-1), 1),
  );
  const tethers = new THREE.InstancedMesh(geometry, chainMaterial, count);
  tethers.name = "Permanent rock-to-rock chains";
  tethers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  tethers.frustumCulled = false;
  tethers.castShadow = tethers.receiveShadow = true;
  group.add(tethers);
  const position = new THREE.Vector3(),
    quaternion = new THREE.Quaternion(),
    pose = new THREE.Object3D();
  function place(root, body, alpha) {
    root.position
      .fromArray(body.previousPosition)
      .lerp(position.fromArray(body.position), alpha);
    root.quaternion
      .fromArray(body.previousQuaternion)
      .slerp(quaternion.fromArray(body.quaternion), alpha);
  }
  function update(interpolate = true) {
    const alpha = interpolate
      ? Math.max(0, Math.min(1, simulation.accumulator / STEP))
      : 1;
    for (const { root, rock } of mounts) place(root, rock, alpha);
    simulation.tetherLinks.forEach((body, i) => {
      place(pose, body, alpha);
      pose.updateMatrix();
      tethers.setMatrixAt(i, pose.matrix);
    });
    tethers.instanceMatrix.needsUpdate = true;
  }
  update(false);
  return {
    group,
    mounts,
    tethers,
    update,
    dispose() {
      scene.remove(group);
      for (const g of [plate, ear, pin, bolt, shank, geometry]) g.dispose();
      tethers.dispose();
    },
  };
}
