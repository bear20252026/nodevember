import { BufferGeometry, Float32BufferAttribute, MeshStandardNodeMaterial, InstancedMesh, Object3D, Color } from 'three/webgpu';
import { mix, uv, vec3 } from 'three/tsl';
import { randomSeed } from './noise.js';

export function createDesertGrass(group, heightAt) {
  const random = randomSeed(15971), positions = [], uvs = [], indices = [], root = new Color('#51462b'), tip = new Color('#aa9863');
  for (let blade = 0; blade < 18; blade++) {
    const angle = random() * Math.PI * 2, lean = .10 + random() * .38, height = .23 + random() * .55;
    const width = .012 + random() * .017, x = Math.cos(angle) * random() * .1, z = Math.sin(angle) * random() * .1;
    // Explicit back faces keep the blades in the front-side meshlet pipeline.
    for (let face = 0; face < 2; face++) {
      const base = positions.length / 3;
      for (let row = 0; row < 3; row++) {
        const t = row / 2, half = width * (1 - t * .98);
        for (const side of [-1, 1]) {
          positions.push(x + Math.cos(angle) * lean * t * t - Math.sin(angle) * half * side, height * t, z + Math.sin(angle) * lean * t * t + Math.cos(angle) * half * side);
          uvs.push((side + 1) / 2, t);
        }
      }
      for (const triangle of [[0, 1, 2], [1, 3, 2], [2, 3, 4], [3, 5, 4]]) {
        if (face) triangle.reverse();
        indices.push(...triangle.map(i => base + i));
      }
    }
  }
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
  const material = new MeshStandardNodeMaterial({ roughness: 1 });
  material.colorNode = mix(vec3(root.r, root.g, root.b), vec3(tip.r, tip.g, tip.b), uv().y);
  const count = 360, mesh = new InstancedMesh(geometry, material, count), dummy = new Object3D();
  const centers = [[-120, -260], [-158, -310], [94, -250], [124, -286], [161, -312], [-54, -136], [96, -130], [60, 80]];
  for (let i = 0; i < count; i++) {
    const center = centers[i % centers.length], angle = random() * Math.PI * 2, radius = Math.pow(random(), .7) * 21;
    const x = center[0] + Math.cos(angle) * radius, z = center[1] + Math.sin(angle) * radius * .7;
    dummy.position.set(x, heightAt(x, z) - .04, z); dummy.scale.setScalar(.45 + random() * .8); dummy.rotation.y = random() * Math.PI * 2; dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.name = 'Dry grass around the ruins'; mesh.receiveShadow = true; mesh.frustumCulled = false; group.add(mesh);
  return { mesh, instances: count, triangles: count * indices.length / 3,
    dispose() { group.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); } };
}
