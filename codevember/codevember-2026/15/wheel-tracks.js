import { CanvasTexture, InstancedMesh, MeshStandardNodeMaterial, PlaneGeometry, Object3D, Vector3, LinearMipmapLinearFilter, SRGBColorSpace } from 'three/webgpu';

// A bounded ring of tire impressions: one instanced draw, independent of
// landscape extent. Four wheel paths share the same stamped tread texture.
export function createWheelTracks(scene, heightAt) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const shade = ctx.createLinearGradient(0, 0, 128, 0);
  shade.addColorStop(0, '#b69b7100'); shade.addColorStop(.22, '#b69b712e');
  shade.addColorStop(.4, '#b69b7148'); shade.addColorStop(.6, '#b69b7148');
  shade.addColorStop(.78, '#b69b712e'); shade.addColorStop(1, '#b69b7100');
  ctx.fillStyle = shade; ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#8e795974'; ctx.lineWidth = 6; ctx.lineJoin = 'round';
  ctx.shadowColor = '#8e79592c'; ctx.shadowBlur = 3;
  for (let y = -20; y < 160; y += 32) {
    ctx.beginPath(); ctx.moveTo(13, y); ctx.lineTo(64, y + 18); ctx.lineTo(115, y); ctx.stroke();
  }
  // Feather both ends as well as the shoulders; overlapping stamps should
  // resemble compressed sand, not dark rectangular strips.
  ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, '#ffffff00'); fade.addColorStop(.22, '#ffffffff');
  fade.addColorStop(.78, '#ffffffff'); fade.addColorStop(1, '#ffffff00');
  ctx.fillStyle = fade; ctx.fillRect(0, 0, 128, 128);
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 16; texture.minFilter = LinearMipmapLinearFilter;
  const material = new MeshStandardNodeMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const geometry = new PlaneGeometry(.27, .40); geometry.rotateX(-Math.PI / 2);
  const capacity = 8192, mesh = new InstancedMesh(geometry, material, capacity), dummy = new Object3D();
  mesh.name = 'Wheel impressions in sand'; mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = 1;
  scene.add(mesh);
  const previous = [null, null, null, null], up = new Vector3(0, 1, 0), normal = new Vector3(), forward = new Vector3();
  let cursor = 0, total = 0;
  function stamp(x, z, surfaceNormal, heading) {
    dummy.position.set(x, heightAt(x, z) + .014, z);
    dummy.quaternion.setFromUnitVectors(up, surfaceNormal); dummy.rotateY(heading); dummy.updateMatrix();
    mesh.setMatrixAt(cursor, dummy.matrix); mesh.instanceMatrix.addUpdateRange(cursor * 16, 16);
    cursor = (cursor + 1) % capacity; total++;
  }
  function commit() { mesh.count = Math.min(total, capacity); mesh.instanceMatrix.needsUpdate = true; }
  function seedApproach(wheels, yaw, length = 70) {
    // A gently curved approach ending at the settled rear contact patches.
    // Sample the same terrain as live impressions, including dune normals.
    // The two rear paths represent all four tires following the same route.
    const backX = Math.sin(yaw), backZ = Math.cos(yaw), rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
    const steps = Math.ceil(length / .22);
    for (const wheel of wheels.filter(w => w.end === 1 && w.contact && w.sand)) {
      for (let k = steps; k >= 0; k--) {
        const d = length * k / steps;
        const bend = 3 * (d / length) ** 2, tangent = 6 * d / (length * length);
        const x = wheel.point[0] + backX * d + rightX * bend, z = wheel.point[2] + backZ * d + rightZ * bend;
        normal.set(heightAt(x - .15, z) - heightAt(x + .15, z), .3, heightAt(x, z - .15) - heightAt(x, z + .15)).normalize();
        stamp(x, z, normal, Math.atan2(backX + rightX * tangent, backZ + rightZ * tangent));
      }
    }
    previous.fill(null); commit();
  }
  function update(wheels) {
    let dirty = false;
    wheels.forEach((wheel, i) => {
      if (!wheel.sand) { previous[i] = null; return; }
      const point = new Vector3().fromArray(wheel.point), last = previous[i];
      if (!last || point.distanceTo(last) > 4) { previous[i] = point; return; }
      const distance = point.distanceTo(last);
      if (distance < .22) return;
      const steps = Math.floor(distance / .22); forward.subVectors(point, last).normalize();
      for (let k = 1; k <= steps; k++) {
        const x = last.x + forward.x * k * .22, z = last.z + forward.z * k * .22;
        normal.fromArray(wheel.normal).normalize(); stamp(x, z, normal, Math.atan2(forward.x, forward.z)); dirty = true;
      }
      previous[i] = last.clone().addScaledVector(forward, steps * .22);
    });
    if (dirty) commit();
  }
  return { mesh, update, seedApproach, get count() { return mesh.count; },
    breakPaths() { previous.fill(null); },
    clear() { previous.fill(null); cursor = total = mesh.count = 0; },
    dispose() { scene.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); texture.dispose(); }
  };
}
