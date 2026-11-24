// The still sea, worked out once (ocean.js: a wind spectrum summed by FFT,
// each point shifted towards the crests) and turned into what the rest needs:
// its height and slope at any point. The shifted grid is no longer a grid, so
// it is drawn as a mesh, seen from straight above, into a float texture of
// heights (the GPU's rasteriser finds, for every texel, the bit of surface
// over it); the slopes come from neighbouring heights. The square repeats
// seamlessly to the horizon. The texture is read back for the CPU (where each
// grain meets the water) and kept, mipmapped, for the shaders.
import * as THREE from 'three';
import { SEA_L } from './sea.js';
import { makeOcean } from './ocean.js';

export function createSeaField(renderer, oceanOpts = {}, size = 1024) {
  const N = size;
  const L = SEA_L;
  const ocean = makeOcean({ ...oceanOpts, L });
  const M = ocean.N;
  // the shifted surface as a mesh, one vertex per point of the ocean's grid
  // (plus a closing row and column, wrapping round)
  const pos = new Float32Array((M + 1) * (M + 1) * 3);
  for (let j = 0; j <= M; j++) {
    for (let i = 0; i <= M; i++) {
      const o = (j % M) * M + (i % M), v = (j * (M + 1) + i) * 3;
      pos[v] = (i * L) / M + ocean.dx[o];
      pos[v + 1] = ocean.h[o];
      pos[v + 2] = (j * L) / M + ocean.dz[o];
    }
  }
  const index = new Uint32Array(M * M * 6);
  for (let j = 0, k = 0; j < M; j++) {
    for (let i = 0; i < M; i++) {
      const a = j * (M + 1) + i, b = a + 1, c = a + M + 1, d = c + 1;
      index.set([a, c, b, b, c, d], k);
      k += 6;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const material = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
    uniforms: { uOffset: { value: new THREE.Vector2() } },
    vertexShader: /* glsl */ `
in vec3 position;
uniform vec2 uOffset;
out float vH;
void main() {
  vec2 q = (position.xz + uOffset) / ${L.toFixed(1)};
  vH = position.y;
  // seen from above: the highest bit of surface over each texel wins
  gl_Position = vec4(q * 2.0 - 1.0, -position.y * 0.1, 1.0);
}`,
    fragmentShader: /* glsl */ `
precision highp float;
in float vH;
out vec4 color;
void main() { color = vec4(vH, 0.0, 0.0, 1.0); }`,
  });
  const bake = new THREE.WebGLRenderTarget(N, N, {
    type: THREE.FloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: true,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene().add(mesh);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const auto = renderer.autoClear;
  renderer.autoClear = false;
  renderer.setRenderTarget(bake);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  // the mesh and its neighbours, for the bits shifted over the square's edges
  for (const ox of [-L, 0, L]) {
    for (const oz of [-L, 0, L]) {
      material.uniforms.uOffset.value.set(ox, oz);
      renderer.render(scene, cam);
    }
  }
  renderer.autoClear = auto;
  const data = new Float32Array(N * N * 4);
  renderer.readRenderTargetPixels(bake, 0, 0, N, N, data);
  renderer.setRenderTarget(null);
  bake.dispose();
  geo.dispose();
  material.dispose();
  // slopes from the neighbouring heights (wrapping round)
  const cell = L / N;
  const hgt = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) hgt[i] = data[i * 4];
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const o = (j * N + i) * 4;
      data[o + 1] = (hgt[j * N + ((i + 1) % N)] - hgt[j * N + ((i + N - 1) % N)]) / (2 * cell);
      data[o + 2] = (hgt[((j + 1) % N) * N + i] - hgt[((j + N - 1) % N) * N + i]) / (2 * cell);
    }
  }

  let min = Infinity, max = -Infinity;
  const half = new Uint16Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const h = data[i * 4];
    if (h < min) min = h;
    if (h > max) max = h;
  }
  for (let i = 0; i < half.length; i++) half[i] = THREE.DataUtils.toHalfFloat(data[i]);
  const texture = new THREE.DataTexture(half, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;

  // bilinear lookup of channel c, wrapping round the square
  const scale = N / SEA_L;
  function sample(x, z, c) {
    const fx = x * scale - 0.5, fz = z * scale - 0.5;
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz;
    const x0 = ((ix % N) + N) % N, x1 = (x0 + 1) % N;
    const z0 = ((iz % N) + N) % N, z1 = (z0 + 1) % N;
    const a = data[(z0 * N + x0) * 4 + c], b = data[(z0 * N + x1) * 4 + c];
    const d = data[(z1 * N + x0) * 4 + c], e = data[(z1 * N + x1) * 4 + c];
    return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
  }

  return {
    texture,
    min,
    max,
    height: (x, z) => sample(x, z, 0),
    normal(x, z, out) {
      const gx = sample(x, z, 1), gz = sample(x, z, 2);
      const l = Math.hypot(gx, 1, gz);
      out.x = -gx / l;
      out.y = 1 / l;
      out.z = -gz / l;
      return out;
    },
    uniforms: { uSea: { value: texture } },
    // seaHeight: the finest level (for where things are), seaNormal: filtered
    // with distance (for shading, no shimmer far off)
    glsl: /* glsl */ `
uniform sampler2D uSea;
float seaHeight(vec2 q) { return textureLod(uSea, q / ${SEA_L.toFixed(1)}, 0.0).r; }
vec3 seaNormal(vec2 q) {
  vec2 g = texture(uSea, q / ${SEA_L.toFixed(1)}).gb;
  return normalize(vec3(-g.x, 1.0, -g.y));
}
`,
  };
}
