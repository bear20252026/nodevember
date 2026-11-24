import * as THREE from 'three';
import { TABLE_SIZE } from './fold.js';
import { patternGLSL } from './pattern.js';

// The cut faces of the slice.
// Where: read off the folded mesh itself, so each covers exactly the hole the
// clipping plane opens in its half. The mesh is drawn from the other side of
// the cut, looking into the half, clipped by the plane: where the first
// surface seen is the inside of the shell, the cut goes through the gum. The
// cracks between pressed layers are closed, the small pockets filled.
// What: each pixel of the cut is unfolded: every fold, last first, is inverted
// (find where on the folded ribbon the point lies, then undo the stretch), which
// brings it back into the starting wall of cubes. There, the nearest cube gives
// its color, and the pattern inside the gum. Points in the gaps between layers
// unfold just past the layer they are closest to, so the layers simply swell
// into the gaps. Baked once, several samples per texel where the layers are
// thin, into a mipmapped texture.

const MAX_FOLDS = 16;
const MAX_CUBES = 64;
const RES = 2048; // of the cut face
const MASK_RES = 1024; // of its outline

const tableTexture = new THREE.DataTexture(
  new Float32Array(TABLE_SIZE * MAX_FOLDS * 4), TABLE_SIZE, MAX_FOLDS, THREE.RGBAFormat, THREE.FloatType);
tableTexture.minFilter = tableTexture.magFilter = THREE.NearestFilter;

const arr = (n, f) => Array.from({ length: n }, f);
const uniforms = {
  uFoldCount: { value: 0 },
  uFC: { value: arr(MAX_FOLDS, () => new THREE.Vector3()) },
  uFU: { value: arr(MAX_FOLDS, () => new THREE.Vector3()) },
  uFV: { value: arr(MAX_FOLDS, () => new THREE.Vector3()) },
  uFW: { value: arr(MAX_FOLDS, () => new THREE.Vector3()) },
  uFP: { value: arr(MAX_FOLDS, () => new THREE.Vector4()) }, // K, core, L, Lu
  uFT: { value: arr(MAX_FOLDS, () => new THREE.Vector4()) }, // turn: first and last sample, start angle, sweep
  uFO: { value: arr(MAX_FOLDS, () => new THREE.Vector4()) }, // turn center, slimmed (1) or not, ribbon thickness
  uFTable: { value: tableTexture },
  uCubeColors: { value: arr(MAX_CUBES, () => new THREE.Color()) },
  uGrid: { value: new THREE.Vector4() }, // n, pitch
  uSideA: { value: null },
  uSideB: { value: null },
  // the square of the cut: center, axes, half size
  uMaskC: { value: new THREE.Vector3() },
  uMaskE1: { value: new THREE.Vector3() },
  uMaskE2: { value: new THREE.Vector3() },
  uMaskH: { value: 1 },
};

const sectionGLSL = /* glsl */ `
#define MAX_FOLDS ${MAX_FOLDS}
const float TS = ${TABLE_SIZE}.0;
uniform int uFoldCount;
uniform vec3 uFC[MAX_FOLDS], uFU[MAX_FOLDS], uFV[MAX_FOLDS], uFW[MAX_FOLDS];
uniform vec4 uFP[MAX_FOLDS], uFT[MAX_FOLDS], uFO[MAX_FOLDS];
uniform sampler2D uFTable;
uniform vec3 uCubeColors[${MAX_CUBES}];
uniform vec4 uGrid;
${patternGLSL}

vec4 sampleAt(int f, int i) { return texelFetch(uFTable, ivec2(i, f), 0); }
vec2 dirOf(float th) { return vec2(cos(th), sin(th)); }

// the ribbon closest to q: keep the candidate with the smallest offset
void consider(float s, float b, inout vec2 best) { if (abs(b) < abs(best.y)) best = vec2(s, b); }

// along the turn the frame slides from sample j to j + 1: find where its normal
// passes through q
void turnSegment(int f, int j, vec2 q, float ds, inout vec2 best) {
  vec4 A = sampleAt(f, j), B = sampleAt(f, j + 1);
  float g0 = dot(q - A.xy, dirOf(A.z)), g1 = dot(q - B.xy, dirOf(B.z));
  if (g0 < 0.0 || g1 > 0.0) return;
  float m = g0 - g1 > 0.0 ? g0 / (g0 - g1) : 0.0;
  float th = mix(A.z, B.z, m);
  consider((float(j) + m) * ds, dot(q - mix(A.xy, B.xy, m), vec2(-sin(th), cos(th))), best);
}

// inverse of the fold f, at rest (see Fold.apply). Points off the ribbon (in
// the gaps between its layers) carry on its frame, past its surface
vec3 unfold(int f, vec3 p) {
  vec3 r = p - uFC[f];
  vec2 q = vec2(dot(r, uFU[f]), dot(r, uFV[f]));
  float d = dot(r, uFW[f]);
  float K = uFP[f].x, core = uFP[f].y, L = uFP[f].z, Lu = uFP[f].w;
  float ds = L / (TS - 1.0);
  int i0 = int(uFT[f].x), i1 = int(uFT[f].y);
  vec2 best = vec2(0.0, 1e9);
  // straight before the turn (or all along, without a turn)
  vec4 S = sampleAt(f, 0);
  vec2 t = dirOf(S.z);
  float s = dot(q - S.xy, t);
  if (i0 < 0 || s <= float(i0) * ds) consider(s, t.x * (q.y - S.y) - t.y * (q.x - S.x), best);
  if (i0 >= 0) {
    // straight after the turn, on past the end
    S = sampleAt(f, i1);
    t = dirOf(S.z);
    s = dot(q - S.xy, t);
    if (s >= 0.0) consider(float(i1) * ds + s, t.x * (q.y - S.y) - t.y * (q.x - S.x), best);
    // in the turn: guess the sample from the angle around its center, look around it
    vec2 o = q - uFO[f].xy;
    float sweep = uFT[f].w;
    float a = mod((atan(o.y, o.x) - uFT[f].z) * sign(sweep), 6.2831853);
    float g = a <= abs(sweep) ? a / abs(sweep) : a > 3.1415927 + abs(sweep) * 0.5 ? 0.0 : 1.0;
    int j0 = i0 + int(g * float(i1 - i0));
    for (int k = -5; k <= 5; k++) {
      int j = j0 + k;
      if (j >= i0 && j < i1) turnSegment(f, j, q, ds, best);
    }
  }
  // undo the stretch
  float a1 = best.x - L * 0.5;
  float aa = core > 0.0 && abs(a1) > core * K ? sign(a1) * (abs(a1) - core * K + core) : a1 / K;
  aa = clamp(aa, -Lu * 0.5, Lu * 0.5);
  float fa = clamp((aa / Lu + 0.5) * (TS - 1.0), 0.0, TS - 1.0001);
  int ia = int(floor(fa));
  float center = mix(sampleAt(f, ia).w, sampleAt(f, ia + 1).w, fa - float(ia));
  float b = best.y * mix(1.0, K, uFO[f].z) + center;
  return uFC[f] + uFU[f] * aa + uFV[f] * b + uFW[f] * d;
}

// the color there, and where it was in the starting wall (for the pattern)
void section(vec3 p, out vec3 color, out vec3 rest) {
  for (int f = MAX_FOLDS - 1; f >= 0; f--) if (f < uFoldCount) p = unfold(f, p);
  rest = p;
  float n = uGrid.x, pitch = uGrid.y;
  vec2 ij = clamp(floor((p.xy + (n - 1.0) * pitch * 0.5) / pitch + 0.5), 0.0, n - 1.0);
  color = uCubeColors[int(ij.x * n + ij.y)];
}

// w: how much the phase of the pattern changes over a pixel
vec3 colorAt(vec3 q, float w) {
  vec3 c, rest;
  section(q, c, rest);
  return gumPatternW(c, rest, w);
}

// the layers end up far thinner than a pixel: where neighbouring pixels differ,
// average several samples over the pixel
const int SAMPLES = 8;
vec3 sectionPixel(vec3 p) {
  vec3 dx = dFdx(p), dy = dFdy(p);
  vec3 c, rest;
  section(p, c, rest);
  // the pattern's filter width, taken at the center: the samples can't
  float w = fwidth(gumPhase(c, rest));
  vec3 center = gumPatternW(c, rest, w);
  vec3 change = fwidth(center);
  if (change.r + change.g + change.b < 1e-4) return center;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < SAMPLES; i++) {
    // points spread over the pixel (golden angle spiral)
    float r = sqrt((float(i) + 0.5) / float(SAMPLES)) * 0.5;
    float a = float(i) * 2.3999632;
    sum += colorAt(p + dx * r * cos(a) + dy * r * sin(a), w);
  }
  return sum / float(SAMPLES);
}
`;

function packFolds(folds) {
  const U = uniforms;
  const data = tableTexture.image.data;
  U.uFoldCount.value = folds.length;
  folds.forEach((fold, f) => {
    U.uFC.value[f].copy(fold.c);
    U.uFU.value[f].copy(fold.u);
    U.uFV.value[f].copy(fold.v);
    U.uFW.value[f].copy(fold.w);
    U.uFP.value[f].set(fold.K, fold.core || 0, fold.L, fold.Lu);
    const { tx, ty, tt } = fold.finalTable;
    for (let i = 0; i < TABLE_SIZE; i++) {
      const o = (f * TABLE_SIZE + i) * 4;
      data[o] = tx[i]; data[o + 1] = ty[i]; data[o + 2] = tt[i]; data[o + 3] = fold.centers[i];
    }
    // the turn: from the last sample of the first straight to the first of the second
    let i0 = 0, i1 = TABLE_SIZE - 1;
    while (i0 < TABLE_SIZE - 1 && tt[i0 + 1] === tt[0]) i0++;
    while (i1 > 0 && tt[i1 - 1] === tt[TABLE_SIZE - 1]) i1--;
    if (i0 >= i1) {
      U.uFT.value[f].set(-1, -1, 0, 0);
    } else {
      // center of the circle through the start, middle and end of the turn
      const m = (i0 + i1) >> 1;
      const [ax, ay, bx, by, cx, cy] = [tx[i0], ty[i0], tx[m], ty[m], tx[i1], ty[i1]];
      const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
      const ox = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / D;
      const oy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / D;
      U.uFT.value[f].set(i0, i1, Math.atan2(ay - oy, ax - ox), tt[i1] - tt[i0]);
      U.uFO.value[f].set(ox, oy, 0, 0);
    }
    U.uFO.value[f].z = fold.stretchOnly ? 0 : 1;
    U.uFO.value[f].w = fold.T;
  });
  tableTexture.needsUpdate = true;
}

// each half: alpha 1 where the first surface seen is the inside of the shell,
// 0.5 its outside, 0 nothing
const sideTargets = [new THREE.WebGLRenderTarget(MASK_RES, MASK_RES), new THREE.WebGLRenderTarget(MASK_RES, MASK_RES)];
const sideMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: { uN: { value: new THREE.Vector3() }, uD: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec3 vWorld;
    void main() {
      vWorld = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uN;
    uniform float uD;
    varying vec3 vWorld;
    void main() {
      if (dot(uN, vWorld) < uD) discard;
      gl_FragColor = vec4(gl_FrontFacing ? 0.5 : 1.0);
    }`,
});
const sideScene = new THREE.Scene();
const sideMesh = new THREE.Mesh(new THREE.BufferGeometry(), sideMaterial);
sideMesh.frustumCulled = false;
sideScene.add(sideMesh);
const sideCamera = new THREE.OrthographicCamera();

const quadVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = position.xy * 0.5 + 0.5;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }`;
// both halves' outlines, A in red, B in green (the camera looking into A sees
// the cut mirrored). Each is inside the gum where either side sees the inside
// of the shell, but only where the half has some surface behind the cut
const maskTarget = new THREE.WebGLRenderTarget(MASK_RES, MASK_RES);
const maskMaterial = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: quadVertex,
  fragmentShader: /* glsl */ `
    uniform sampler2D uSideA, uSideB;
    varying vec2 vUv;
    void main() {
      float a = texture2D(uSideA, vec2(1.0 - vUv.x, vUv.y)).a, b = texture2D(uSideB, vUv).a;
      // where only the other side sees the inside (the culled layers leave
      // holes in the shell), trust it, as long as this half is there at all
      bool ia = a > 0.75, ib = b > 0.75;
      gl_FragColor = vec4(ia || ib && a > 0.25 ? 1.0 : 0.0, ib || ia && b > 0.25 ? 1.0 : 0.0, 0.0, 1.0);
    }`,
});
// the cut face: its color all over the square (see the masks for its outline)
const colorTarget = new THREE.WebGLRenderTarget(RES, RES, {
  generateMipmaps: true,
  minFilter: THREE.LinearMipmapLinearFilter,
});
colorTarget.texture.anisotropy = 4;
const colorMaterial = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: quadVertex,
  fragmentShader: /* glsl */ `
    ${sectionGLSL}
    uniform vec3 uMaskC, uMaskE1, uMaskE2;
    uniform float uMaskH;
    varying vec2 vUv;
    void main() {
      vec2 xy = vUv * 2.0 - 1.0;
      gl_FragColor = vec4(sectionPixel(uMaskC + (uMaskE1 * xy.x + uMaskE2 * xy.y) * uMaskH), 1.0);
    }`,
});

const quadScene = new THREE.Scene();
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), maskMaterial);
quad.frustumCulled = false;
quadScene.add(quad);
const quadCamera = new THREE.Camera();
const pixels = new Uint8Array(MASK_RES * MASK_RES * 4);
let masks = [];

// The folds the shape went through (all at rest), the folded shape, and the
// cut: plane normal n through c, the section fitting in a square of half size
// h. Bakes the section (about a hundred ms) for the cut faces (see
// capGeometry): returns its colors, and the outlines of the A and B halves (in
// green, as alpha maps). `close`: cracks up to that wide are closed, `pocket`:
// enclosed gaps up to that area filled (in world units).
export function setSection(renderer, folds, shape, n, c, h, close = 0.2, pocket = 1) {
  packFolds(folds);
  const { n: count, pitch } = shape.grid;
  uniforms.uGrid.value.set(count, pitch, 0, 0);
  shape.cubeColors.forEach((col, i) => uniforms.uCubeColors.value[i].copy(col));
  const U = uniforms;
  U.uMaskC.value.copy(c);
  U.uMaskE1.value.set(1, 0, 0).cross(n);
  if (U.uMaskE1.value.lengthSq() < 0.1) U.uMaskE1.value.set(0, 1, 0).cross(n);
  U.uMaskE1.value.normalize();
  U.uMaskE2.value.crossVectors(n, U.uMaskE1.value);
  U.uMaskH.value = h;

  const prevTarget = renderer.getRenderTarget();
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);

  // the folded mesh, seen from each side of the cut, looking through it,
  // clipped by it
  const g = sideMesh.geometry;
  g.setAttribute('position', new THREE.BufferAttribute(shape.finT, 3));
  g.setIndex(shape.geometry.index);
  const R = h * 4;
  sideCamera.left = sideCamera.bottom = -h;
  sideCamera.right = sideCamera.top = h;
  sideCamera.near = 0;
  sideCamera.far = R * 2;
  sideCamera.updateProjectionMatrix();
  sideTargets.forEach((target, i) => {
    const s = i === 0 ? 1 : -1;
    sideCamera.position.copy(c).addScaledVector(n, -s * R);
    sideCamera.up.copy(U.uMaskE2.value);
    sideCamera.lookAt(c);
    sideMaterial.uniforms.uN.value.copy(n).multiplyScalar(s);
    sideMaterial.uniforms.uD.value = s * n.dot(c);
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(sideScene, sideCamera);
  });
  U.uSideA.value = sideTargets[0].texture;
  U.uSideB.value = sideTargets[1].texture;
  quad.material = maskMaterial;
  renderer.setRenderTarget(maskTarget);
  renderer.render(quadScene, quadCamera);
  renderer.readRenderTargetPixels(maskTarget, 0, 0, MASK_RES, MASK_RES, pixels);

  masks.forEach((m) => m.dispose());
  masks = [0, 1].map((channel) => {
    const solid = new Uint8Array(MASK_RES * MASK_RES);
    for (let i = 0; i < solid.length; i++) solid[i] = pixels[i * 4 + channel] > 127 ? 1 : 0;
    cleanUp(solid, Math.max(1, Math.round((close / 2 / (2 * h)) * MASK_RES)),
      Math.round(pocket * (MASK_RES / (2 * h)) ** 2));
    const data = new Uint8Array(solid.length * 4);
    for (let i = 0; i < solid.length; i++) data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = solid[i] * 255;
    const t = new THREE.DataTexture(data, MASK_RES, MASK_RES);
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  });

  quad.material = colorMaterial;
  renderer.setRenderTarget(colorTarget);
  renderer.render(quadScene, quadCamera);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevClear, prevAlpha);
  // only the cut face is kept
  for (const t of [...sideTargets, maskTarget]) t.dispose();
  return { map: colorTarget.texture, masks };
}

// closing: grow by k pixels, then shrink back, which seals the thin cracks.
// Then fill the pockets up to maxArea pixels: the larger ones are real gaps,
// and stay open.
function cleanUp(solid, k, maxArea) {
  const grown = distance(solid, 1, k);
  const out = new Uint8Array(solid.length);
  for (let i = 0; i < solid.length; i++) out[i] = grown[i] <= k ? 0 : 1;
  const away = distance(out, 1, k);
  for (let i = 0; i < solid.length; i++) if (grown[i] <= k && away[i] > k) solid[i] = 1;
  fillPockets(solid, maxArea);
}

// the 4-connected regions of 0s that don't touch the border and have at most
// maxArea pixels become 1s
function fillPockets(m, maxArea) {
  const seen = new Uint8Array(m.length);
  const queue = new Int32Array(m.length);
  for (let s = 0; s < m.length; s++) {
    if (m[s] || seen[s]) continue;
    let head = 0, tail = 0, border = false;
    seen[s] = 1;
    queue[tail++] = s;
    while (head < tail) {
      const i = queue[head++];
      const x = i % MASK_RES, y = (i / MASK_RES) | 0;
      if (x === 0 || y === 0 || x === MASK_RES - 1 || y === MASK_RES - 1) border = true;
      for (const j of [x > 0 ? i - 1 : -1, x < MASK_RES - 1 ? i + 1 : -1, i - MASK_RES, i + MASK_RES])
        if (j >= 0 && j < m.length && !m[j] && !seen[j]) {
          seen[j] = 1;
          queue[tail++] = j;
        }
    }
    if (!border && tail <= maxArea) for (let q = 0; q < tail; q++) m[queue[q]] = 1;
  }
}

// multi-source breadth-first distance (in pixels, 8-connected) to the pixels
// where src === value, up to `max`
function distance(src, value, max) {
  const N = MASK_RES * MASK_RES;
  const dist = new Uint16Array(N).fill(65535);
  const queue = new Int32Array(N);
  let head = 0, tail = 0;
  for (let i = 0; i < N; i++)
    if (src[i] === value) {
      dist[i] = 0;
      queue[tail++] = i;
    }
  while (head < tail) {
    const i = queue[head++];
    const di = dist[i];
    if (di >= max) continue;
    const x = i % MASK_RES, y = (i / MASK_RES) | 0;
    for (let oy = -1; oy <= 1; oy++)
      for (let ox = -1; ox <= 1; ox++) {
        const qx = x + ox, qy = y + oy;
        if (qx < 0 || qy < 0 || qx >= MASK_RES || qy >= MASK_RES) continue;
        const j = qy * MASK_RES + qx;
        if (dist[j] <= di + 1) continue;
        dist[j] = di + 1;
        queue[tail++] = j;
      }
  }
  return dist;
}

// the cut face of the half on the `sign` side of the plane, facing out of it,
// textured with the section baked by setSection()
export function capGeometry(sign) {
  const { uMaskC: { value: c }, uMaskE1: { value: e1 }, uMaskE2: { value: e2 }, uMaskH: { value: h } } = uniforms;
  const pos = [], uv = [];
  for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    const p = c.clone().addScaledVector(e1, x * h).addScaledVector(e2, y * h);
    pos.push(p.x, p.y, p.z);
    uv.push((x + 1) / 2, (y + 1) / 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  // e1 x e2 = n: counterclockwise faces n, the B side
  g.setIndex(sign < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
  g.computeVertexNormals();
  return g;
}
