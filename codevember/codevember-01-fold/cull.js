import * as THREE from 'three';

// Folding again and again multiplies the layers inside the shape: they are
// never seen but the mesh would grow without bound. This finds the vertices
// buried inside: the shape is rendered (depth only) from many directions, and a
// vertex is hidden if, in every view, it is clearly behind the visible surface.
// Folds map the inside to the inside, so what is hidden now stays hidden.

const RES = 768;
const VIEWS = 22;

const target = new THREE.WebGLRenderTarget(RES, RES, { type: THREE.FloatType });
const material = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  vertexShader: /* glsl */ `
    varying float vDepth;
    void main() {
      vec4 p = modelViewMatrix * vec4(position, 1.0);
      vDepth = -p.z;
      gl_Position = projectionMatrix * p;
    }`,
  fragmentShader: /* glsl */ `
    varying float vDepth;
    void main() { gl_FragColor = vec4(vDepth, 0.0, 0.0, 1.0); }`,
});
const camera = new THREE.OrthographicCamera();
const scene = new THREE.Scene();
const pixels = new Float32Array(RES * RES * 4);

// generator: yields between steps; returns a Uint8Array, 1 for visible vertices
export function* findVisible(renderer, positions, index, budget = 5) {
  const nv = positions.length / 3;
  const pos = new Float32Array(positions);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(index), 1));
  geometry.computeBoundingSphere();
  const { center, radius: R } = geometry.boundingSphere;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);

  const margin = 0.003 * R;
  const visible = new Uint8Array(nv);
  const dir = new THREE.Vector3();
  const m = new THREE.Matrix4();
  let sliceStart = performance.now();
  const phase = Math.random();

  for (let view = 0; view < VIEWS; view++) {
    // directions spread over the sphere
    const z = 1 - (2 * (view + 0.5)) / VIEWS;
    const a = (view + phase) * Math.PI * (3 - Math.sqrt(5));
    const s = Math.sqrt(1 - z * z);
    dir.set(s * Math.cos(a), s * Math.sin(a), z);
    camera.left = camera.bottom = -R;
    camera.right = camera.top = R;
    camera.near = 0.5;
    camera.far = 3 * R + 1;
    camera.position.copy(center).addScaledVector(dir, 1.5 * R + 0.5);
    camera.up.set(Math.abs(dir.y) < 0.9 ? 0 : 1, Math.abs(dir.y) < 0.9 ? 1 : 0, 0);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    const prevTarget = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(target);
    renderer.setClearColor(0x000000, 0); // 0 = nothing there
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, RES, RES, pixels);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevColor, prevAlpha);
    yield;
    sliceStart = performance.now();

    const e = m.copy(camera.matrixWorldInverse).elements;
    for (let i = 0; i < nv; i++) {
      if ((i & 4095) === 0 && performance.now() - sliceStart > budget) {
        yield;
        sliceStart = performance.now();
      }
      if (visible[i]) continue;
      const x = pos[i * 3], y = pos[i * 3 + 1], zz = pos[i * 3 + 2];
      const vx = e[0] * x + e[4] * y + e[8] * zz + e[12];
      const vy = e[1] * x + e[5] * y + e[9] * zz + e[13];
      const depth = -(e[2] * x + e[6] * y + e[10] * zz + e[14]);
      const px = Math.floor((vx / R * 0.5 + 0.5) * RES);
      const py = Math.floor((vy / R * 0.5 + 0.5) * RES);
      // conservative: compare with the farthest surface around the pixel
      let far = 0;
      for (let oy = -1; oy <= 1 && far < Infinity; oy++)
        for (let ox = -1; ox <= 1; ox++) {
          const qx = px + ox, qy = py + oy;
          const d = qx < 0 || qy < 0 || qx >= RES || qy >= RES ? 0 : pixels[(qy * RES + qx) * 4];
          if (d === 0) { far = Infinity; break; }
          if (d > far) far = d;
        }
      if (depth <= far + margin) visible[i] = 1;
    }
  }

  scene.remove(mesh);
  geometry.dispose();
  return visible;
}
