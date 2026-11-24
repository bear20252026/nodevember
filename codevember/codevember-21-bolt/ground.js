// The diorama's block: its ground on top (a meadow, burnt where the bolt strikes), the
// layers of the soil on its sides, and the wooden base under it.
import * as THREE from 'three';
import { fbm2, insideDist, smoothstep } from './common.js';

export const SOIL = 0.85; // depth of the soil, from the meadow down to the wood
const LAYERS = (SOIL / 1.35).toFixed(4); // the soil's layers are drawn for a depth of 1.35: scaled to fit
export const WOOD = 0.44; // height of the wooden base
const RIM = 0.42; // how far the wood sticks out round the soil

// the ground's height: gentle swells (the scar where the bolt hits is added on, `scar`)
export function makeHeight() {
  return (x, z) => 0.2 * fbm2(x * 0.21 + 3.1, z * 0.21 - 1.7, 4) * 2 + 0.035 * fbm2(x * 1.4, z * 1.4, 3);
}

// the scar where a bolt struck, at a distance d from it: a shallow hollow with a lip thrown up
export const scarDepth = (d) => -0.16 * Math.exp(-(d * d) / 0.18) + 0.045 * Math.exp(-((d - 0.62) ** 2) / 0.05);

// GLSL: the strikes on the meadow, two of them (the one there now and the one before, to
// heal one as the other comes): uScar[i] = (x, z, how much there 0..1, how hot 0..1), their
// burns (R scorched, G bare) in uBurn[i]. The scar's depth and slope, and the burn at a point.
export const GLSL_SCAR = /* glsl */ `
  uniform vec4 uScar[2];
  uniform sampler2D uBurn0, uBurn1;
  uniform float uBurnSize;
  float scarProfile(float d) { return -0.16 * exp(-d * d / 0.18) + 0.045 * exp(-(d - 0.62) * (d - 0.62) / 0.05); }
  float scarH(vec2 p) {
    return uScar[0].z * scarProfile(length(p - uScar[0].xy)) + uScar[1].z * scarProfile(length(p - uScar[1].xy));
  }
  vec2 scarG(vec2 p) {
    vec2 g = vec2(0.0);
    for (int i = 0; i < 2; i++) {
      vec2 q = p - uScar[i].xy;
      float d = max(length(q), 1e-4), e = d - 0.62;
      float dd = 0.16 * exp(-d * d / 0.18) * 2.0 * d / 0.18 - 0.045 * exp(-e * e / 0.05) * 2.0 * e / 0.05;
      g += uScar[i].z * dd * q / d;
    }
    return g;
  }
  vec2 burnAt(vec2 p) {
    vec2 uv = p / uBurnSize + 0.5;
    return max(texture2D(uBurn0, uv).rg * uScar[0].z, texture2D(uBurn1, uv).rg * uScar[1].z);
  }
`;

// GLSL shared by the ground's materials: hash, value noise, fbm and a cellular noise (the
// pebbles), and a bump that tilts the normal by the slope of a pattern
export const GLSL_NOISE = /* glsl */ `
  float bh1(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  vec2 bh2(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
  float bn(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(bh1(i), bh1(i + vec2(1, 0)), f.x), mix(bh1(i + vec2(0, 1)), bh1(i + vec2(1, 1)), f.x), f.y);
  }
  float bfbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * bn(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
  // cells: x the distance to the nearest seed, y to the second, z an id of the nearest
  vec3 cells(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    float d1 = 8.0, d2 = 8.0, id = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(x, y), o = bh2(i + g);
      float d = length(g + o - f);
      if (d < d1) { d2 = d1; d1 = d; id = bh1(i + g + 0.37); } else if (d < d2) d2 = d;
    }
    return vec3(d1, d2, id);
  }
  vec3 bumpN(vec3 n, vec3 p, float h, float k) {
    vec3 dpx = dFdx(p), dpy = dFdy(p);
    float hx = dFdx(h), hy = dFdy(h);
    vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
    float det = dot(dpx, r1);
    vec3 g = sign(det) * (hx * r1 + hy * r2);
    vec3 r = abs(det) * n - k * g;
    float l = length(r);
    return l > 1e-12 ? r / l : n;
  }
`;

// how the bolt burnt the meadow, as a texture over the block (and read back by the grass):
// R how scorched (0 green … 1 charred), G bare (the grass gone, earth showing).
// Round the strike a ragged burnt patch, and running off it the branching scars of the
// current spreading through the wet grass (Lichtenberg figures).
export function makeBurn(rand, strike, outline) {
  const N = 512, S = 14; // pixels, units across
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  const px = (v) => ((v + S / 2) / S) * N;
  g.lineCap = 'round';
  g.strokeStyle = '#fff';
  const scar = (x, z, a, len, w, depth) => {
    let px0 = x, pz0 = z;
    const steps = Math.ceil(len / 0.06);
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.7;
      const nx = px0 + Math.cos(a) * 0.06, nz = pz0 + Math.sin(a) * 0.06;
      const t = i / steps;
      g.lineWidth = Math.max(0.6, w * (1 - t) * (N / S));
      g.globalAlpha = 0.85 * (1 - t * 0.6);
      g.beginPath();
      g.moveTo(px(px0), px(pz0));
      g.lineTo(px(nx), px(nz));
      g.stroke();
      if (depth < 3 && rand() < 0.07) scar(nx, nz, a + (rand() < 0.5 ? -1 : 1) * (0.4 + rand() * 0.6), len * (1 - t) * (0.4 + rand() * 0.4), w * (1 - t) * 0.7, depth + 1);
      px0 = nx;
      pz0 = nz;
      if (insideDist(outline, nx, nz) < 0.1) break;
    }
  };
  const arms = 5 + Math.floor(rand() * 5);
  for (let i = 0; i < arms; i++) {
    const a = (i / arms) * Math.PI * 2 + rand() * 0.8;
    scar(strike.x + Math.cos(a) * 0.4, strike.z + Math.sin(a) * 0.4, a, 1.2 + rand() * 2.4, 0.09 + rand() * 0.05, 0);
  }
  const lines = g.getImageData(0, 0, N, N).data;
  const data = new Uint8Array(N * N * 4);
  const R0 = 0.75 + rand() * 0.35, R1 = R0 + 0.45 + rand() * 0.2; // bare, then scorched out to
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = (i + 0.5) / N * S - S / 2, z = (j + 0.5) / N * S - S / 2;
      const d = Math.hypot(x - strike.x, z - strike.z) + 0.55 * fbm2(x * 1.1 + 5, z * 1.1, 4) + 0.12 * fbm2(x * 5, z * 5, 2);
      const bare = 1 - smoothstep(R0 - 0.15, R0 + 0.15, d);
      const k = 4 * (j * N + i);
      const line = lines[k] / 255;
      let scorch = Math.max(1 - smoothstep(R0, R1, d), line);
      // just past it the heat yellowed then wilted the grass: a narrow fringe, patchy
      const fringe = 0.45 + 0.25 * fbm2(x * 3.1 - 11, z * 3.1 + 4, 3);
      scorch = Math.max(scorch, 0.3 * (1 - smoothstep(R1 - 0.25, R1 + fringe, d)));
      data[k] = Math.round(255 * Math.min(1, scorch));
      data[k + 1] = Math.round(255 * Math.max(bare, smoothstep(0.55, 0.95, line) * 0.8));
      data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  const at = (x, z) => {
    const fx = THREE.MathUtils.clamp(((x + S / 2) / S) * N - 0.5, 0, N - 1.001);
    const fz = THREE.MathUtils.clamp(((z + S / 2) / S) * N - 0.5, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    const s = (c) => {
      const a = data[4 * (j * N + i) + c], b = data[4 * (j * N + i + 1) + c];
      const cc = data[4 * ((j + 1) * N + i) + c], dd = data[4 * ((j + 1) * N + i + 1) + c];
      return ((a * (1 - u) + b * u) * (1 - v) + (cc * (1 - u) + dd * u) * v) / 255;
    };
    return { scorch: s(0), bare: s(1) };
  };
  return { tex, size: S, at };
}

export function createBlock({ outline, height, edge, uniforms }) {
  const group = new THREE.Group();
  const n = outline.length;
  const centre = [0, 0];

  // ---- the meadow's floor: fans from the middle out to each side, finely cut ----
  {
    const RINGS = 110, SEG = 110;
    const pos = [], wear = [], idx = [];
    for (let e = 0; e < n; e++) {
      const p = outline[e], q = outline[(e + 1) % n];
      const base = pos.length / 3;
      for (let r = 0; r <= RINGS; r++) {
        const v = Math.pow(r / RINGS, 0.8);
        for (let s = 0; s <= SEG; s++) {
          const u = s / SEG;
          const ex = p[0] + (q[0] - p[0]) * u, ez = p[1] + (q[1] - p[1]) * u;
          // the rim drawn in where the edge has crumbled back (the same as the wall's top)
          const k = v * (1 - (edge.bite(ex, ez) / Math.hypot(ex - centre[0], ez - centre[1])) * v ** 8);
          const x = centre[0] + k * (ex - centre[0]);
          const z = centre[1] + k * (ez - centre[1]);
          pos.push(x, height(x, z), z);
          wear.push(edge.at(x, z).wear);
        }
      }
      for (let r = 0; r < RINGS; r++) {
        for (let s = 0; s < SEG; s++) {
          const a = base + r * (SEG + 1) + s, b = a + 1, c = a + SEG + 1, d = c + 1;
          idx.push(a, b, d, a, d, c);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('wear', new THREE.Float32BufferAttribute(wear, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, shadowSide: THREE.DoubleSide });
    mat.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float wear;\nvarying vec3 vW;\nvarying float vWear;\n${GLSL_SCAR}`)
        // the scar dug into it (and its slope into the normal)
        .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = normalize(objectNormal - vec3(scarG(position.xz), 0.0).xzy * objectNormal.y);')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += scarH(position.xz);')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWear = wear;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; varying float vWear;
          uniform float uTime;
          ${GLSL_NOISE}
          ${GLSL_SCAR}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 bw = burnAt(vW.xz);
          float scorch = bw.r, bare = bw.g;
          float n1 = bfbm(vW.xz * 3.0), n2 = bfbm(vW.xz * 11.0 + 4.0);
          // under the grass: dark, damp, with old blades lying
          vec3 floorC = mix(vec3(0.05, 0.075, 0.03), vec3(0.12, 0.11, 0.05), n1);
          // burnt: brown grass to ash to char
          vec3 burnt = mix(vec3(0.16, 0.09, 0.035), vec3(0.025, 0.02, 0.018), smoothstep(0.45, 0.95, scorch + (n2 - 0.5) * 0.4));
          vec3 col = mix(floorC, burnt, smoothstep(0.1, 0.6, scorch));
          // the worn rim, the grass gone: crumbly turf, its roots, a few dead blades
          float wr = smoothstep(0.15, 0.75, vWear + (n2 - 0.5) * 0.5);
          vec3 rimC = mix(vec3(0.06, 0.045, 0.03), vec3(0.15, 0.11, 0.065), n2);
          rimC = mix(rimC, vec3(0.27, 0.22, 0.12), smoothstep(0.6, 0.75, bn(vW.xz * vec2(38.0, 9.0) + n1 * 4.0)) * 0.45);
          col = mix(col, rimC, wr);
          // the bare earth: wet soil, stones, ash in its hollows
          vec3 cl = cells(vW.xz * 9.0);
          float pebble = smoothstep(0.42, 0.3, cl.x) * step(0.55, cl.z);
          vec3 soilC = mix(vec3(0.075, 0.05, 0.035), vec3(0.17, 0.12, 0.08), n2);
          soilC = mix(soilC, mix(vec3(0.22, 0.21, 0.2), vec3(0.36, 0.33, 0.3), fract(cl.z * 7.0)), pebble);
          // blackened at the heart
          float d0 = length(vW.xz - uScar[0].xy), d1 = length(vW.xz - uScar[1].xy);
          float heart = max(uScar[0].z * (1.0 - smoothstep(0.08, 0.5, d0 + n1 * 0.2)), uScar[1].z * (1.0 - smoothstep(0.08, 0.5, d1 + n1 * 0.2)));
          soilC *= 1.0 - 0.65 * heart;
          col = mix(col, soilC, smoothstep(0.2, 0.7, bare));
          diffuseColor.rgb = col;
          float bumpH = pebble * (0.42 - cl.x) * 0.5 + n2 * 0.02;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = bumpN(normal, -vViewPosition, bumpH, smoothstep(0.2, 0.7, bare) * 1.0);`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          roughnessFactor = mix(0.95, 0.45, smoothstep(0.2, 0.7, bare) * (1.0 - pebble * 0.3)); // wet`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          { // the soil fused and glowing where the bolt went in, and embers in the ash
            // (each as hot as its strike still is: they cool once the bolt is gone)
            float glint = smoothstep(0.5, 0.8, bfbm(vW.xz * 18.0));
            float core = uScar[0].w * (exp(-d0 * d0 / 0.012) + 0.6 * exp(-d0 * d0 / 0.08) * glint)
                       + uScar[1].w * (exp(-d1 * d1 / 0.012) + 0.6 * exp(-d1 * d1 / 0.08) * glint);
            float heat = max(uScar[0].w * smoothstep(1.6, 0.6, d0), uScar[1].w * smoothstep(1.6, 0.6, d1));
            float ember = heat * smoothstep(0.82, 0.95, bfbm(vW.xz * 7.0 + 2.0)) * smoothstep(0.7, 1.0, scorch) * (0.6 + 0.4 * sin(uTime * 2.0 + n2 * 30.0));
            totalEmissiveRadiance += vec3(1.0, 0.75, 0.5) * core * 2.5 + vec3(1.0, 0.35, 0.08) * ember * 0.9;
          }`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    // its shadow (from the bolt's point lights) cast with the scar dug in too
    const dist = new THREE.MeshDistanceMaterial();
    dist.onBeforeCompile = (s) => {
      Object.assign(s.uniforms, uniforms);
      s.vertexShader = s.vertexShader
        .replace('#include <common>', `#include <common>\n${GLSL_SCAR}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed.y += scarH(position.xz);');
    };
    mesh.customDistanceMaterial = dist;
    group.add(mesh);
  }

  // ---- the soil's sides: one wall per side, from the meadow's edge down to the wood ----
  {
    const SEG = 160, ROWS = 40;
    const pos = [], along = [], tops = [], idx = [];
    let run = 0;
    for (let e = 0; e < n; e++) {
      const p = outline[e], q = outline[(e + 1) % n];
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
      const base = pos.length / 3;
      for (let r = 0; r <= ROWS; r++) {
        for (let s = 0; s <= SEG; s++) {
          const u = s / SEG;
          const ex = p[0] + (q[0] - p[0]) * u, ez = p[1] + (q[1] - p[1]) * u;
          // where the edge crumbled back, the face is scooped in towards its top
          const b = edge.bite(ex, ez) / Math.hypot(ex - centre[0], ez - centre[1]);
          const tx = ex - b * (ex - centre[0]), tz = ez - b * (ez - centre[1]);
          const top = height(tx, tz);
          const t = r / ROWS;
          const y = top + (-SOIL - top) * Math.pow(t, 1.25); // rows closer near the top
          const k = smoothstep(0, 0.1 + b * 4, top - y); // 0 at the top … 1 down the face
          const sc = 1 - b * (1 - k) * (1 - k);
          pos.push(centre[0] + sc * (ex - centre[0]), y, centre[1] + sc * (ez - centre[1]));
          along.push(run + u * len);
          tops.push(top);
        }
      }
      for (let r = 0; r < ROWS; r++) {
        for (let s = 0; s < SEG; s++) {
          const a = base + r * (SEG + 1) + s, b = a + 1, c = a + SEG + 1, d = c + 1;
          idx.push(a, b, d, a, d, c);
        }
      }
      run += len;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    geo.setAttribute('top', new THREE.Float32BufferAttribute(tops, 1));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, shadowSide: THREE.DoubleSide });
    mat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float along, top;\nvarying vec3 vW;\nvarying float vAlong, vTop;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvAlong = along; vTop = top;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW; varying float vAlong, vTop;
          ${GLSL_NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec2 p = vec2(vAlong, vW.y);
          const float L = ${LAYERS};
          float y = vW.y / L + 0.05 * (bn(p * vec2(1.3, 0.0)) - 0.5) + 0.02 * (bn(p * vec2(6.0, 0.0) + 3.0) - 0.5);
          float n1 = bfbm(p * vec2(4.0, 9.0)), n2 = bfbm(p * vec2(20.0, 30.0) + 7.0);
          // the layers, from the top: the turf and its roots, dark humus, muted ochre clay with
          // faint streaks, then a bed of stones and gravel; kept close in tone, so they read subtly
          float b1 = min(-0.13, vTop / L - 0.08) + 0.05 * (bn(p * vec2(2.2, 0.0) + 11.0) - 0.5); // the turf follows the rim down
          float b2 = -0.5 + 0.12 * (bn(p * vec2(0.9, 0.0) + 21.0) - 0.5);
          float b3 = -0.86 + 0.14 * (bn(p * vec2(0.7, 0.0) + 31.0) - 0.5);
          vec3 turf = mix(vec3(0.06, 0.05, 0.03), vec3(0.13, 0.1, 0.05), n2);
          float roots = smoothstep(0.62, 0.7, bn(vec2(vAlong * 40.0, y * 3.0))) * smoothstep(-0.32, -0.05, y);
          turf = mix(turf, vec3(0.24, 0.2, 0.14), roots * 0.45);
          vec3 humus = mix(vec3(0.1, 0.07, 0.045), vec3(0.2, 0.14, 0.09), n1);
          vec3 clay = mix(vec3(0.21, 0.15, 0.09), vec3(0.3, 0.22, 0.13), n1);
          clay = mix(clay, vec3(0.32, 0.26, 0.19), smoothstep(0.55, 0.75, bn(vec2(vAlong * 1.5, y * 40.0))) * 0.3);
          // the stone bed: rounded stones of all sizes packed in a gritty grey-brown matrix
          vec3 cl = cells(p * vec2(6.0, 7.5));
          vec3 cm = cells(p * vec2(15.0, 17.0) + 3.1);
          float big = smoothstep(0.5 + 0.15 * cl.z, 0.36 + 0.15 * cl.z, cl.x);
          float small = smoothstep(0.42, 0.3, cm.x) * (1.0 - big);
          vec3 matrix = mix(vec3(0.14, 0.12, 0.09), vec3(0.22, 0.19, 0.14), n2) * (0.8 + 0.4 * bn(p * 90.0));
          vec3 stoneA = mix(vec3(0.22, 0.2, 0.18), vec3(0.36, 0.32, 0.27), cl.z) * (0.85 + 0.3 * n1);
          stoneA = mix(stoneA, vec3(0.32, 0.23, 0.16), step(0.8, fract(cl.z * 13.0)) * 0.5); // a few rusty ones
          vec3 stoneB = mix(vec3(0.19, 0.17, 0.15), vec3(0.32, 0.29, 0.25), cm.z);
          vec3 gravel = mix(mix(matrix, stoneB, small), stoneA, big);
          float stone = big;
          // small pebbles here and there in the humus and clay
          vec3 cs = cells(p * vec2(22.0, 26.0));
          float peb = smoothstep(0.26, 0.16, cs.x) * step(0.88, cs.z);
          vec3 col = turf;
          col = mix(col, humus, smoothstep(b1 + 0.05, b1 - 0.05, y));
          col = mix(col, clay, smoothstep(b2 + 0.12, b2 - 0.12, y));
          col = mix(col, gravel, smoothstep(b3 + 0.08, b3 - 0.08, y));
          float inMid = smoothstep(b1, b1 - 0.05, y) * smoothstep(b3 - 0.03, b3 + 0.03, y);
          col = mix(col, vec3(0.2, 0.18, 0.15) * (0.7 + 0.8 * fract(cs.z * 7.0)), peb * inMid);
          col *= 0.75 + 0.5 * n2;
          diffuseColor.rgb = col;
          float isStone = smoothstep(b3 + 0.08, b3 - 0.08, y);
          float bumpH = isStone * (big * sqrt(max(0.0, 0.55 - cl.x + 0.01)) * 0.06 + small * (0.42 - cm.x) * 0.03) + peb * inMid * (0.26 - cs.x) * 0.04 + n2 * 0.01;`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          normal = bumpN(normal, -vViewPosition, bumpH, 1.0);`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
  }

  // ---- the wooden base: the outline pushed out a little, bevelled, varnished walnut ----
  {
    const shape = new THREE.Shape();
    const grown = growOutline(outline, RIM);
    grown.forEach(([x, z], i) => (i ? shape.lineTo(x, z) : shape.moveTo(x, z)));
    shape.closePath();
    const bevel = 0.035;
    const geo = new THREE.ExtrudeGeometry(shape, { depth: WOOD - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 1 });
    geo.rotateX(Math.PI / 2); // (x, z) stays (x, z), the extrusion goes down
    geo.translate(0, -SOIL - bevel, 0);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.25 });
    mat.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      s.fragmentShader = s.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vW;
          ${GLSL_NOISE}`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          // the grain runs along x: growth rings round an axis far below, warped
          vec3 q = vW + vec3(0.0, 0.0, 0.0);
          float w = bfbm(vec2(q.x * 0.35, q.z * 0.6)) * 2.0 + bn(vec2(q.x * 3.0, q.y * 8.0)) * 0.15;
          float r = length(vec2(q.y + 3.0, q.z * 0.6)) * 9.0 + w * 3.0;
          float ring = pow(abs(sin(r * 3.14159)), 0.35);
          float fleck = bn(vec2(q.x * 60.0, r * 6.0));
          vec3 light = vec3(0.36, 0.2, 0.1), dark = vec3(0.14, 0.07, 0.035);
          vec3 col = mix(dark, light, ring * 0.8 + fleck * 0.2);
          col *= 0.85 + 0.3 * bn(vec2(q.x * 1.5, q.z * 1.5));
          diffuseColor.rgb = col;`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

// the outline pushed out by d: each corner moved out along its bisector, so that each side
// moves out by d (the wooden base's outline, and its footprint on the floor)
export function growOutline(outline, d = RIM) {
  const n = outline.length;
  return outline.map((p, i) => {
    const a = outline[(i + n - 1) % n], b = outline[(i + 1) % n];
    const n1 = norm([p[1] - a[1], -(p[0] - a[0])]), n2 = norm([b[1] - p[1], -(b[0] - p[0])]);
    const m = norm([n1[0] + n2[0], n1[1] + n2[1]]);
    const k = d / (m[0] * n1[0] + m[1] * n1[1]);
    return [p[0] + m[0] * k, p[1] + m[1] * k];
  });
}

function norm([x, y]) {
  const l = Math.hypot(x, y);
  return [x / l, y / l];
}
