// The rain: streaks falling slant out of the cloud's base onto the block (only over it, as
// in a diorama), each landing where it was aimed and splashing there, then falling again.
// Heaviest under the middle of the storm, thinning out and fainter towards the edge, as the
// clouds do, so the block's outline doesn't show in it.
// They glint in the bolt's light: brighter the nearer they pass to its channel.
import * as THREE from 'three';
import { insideDist, core, smoothstep } from './common.js';
import { GLSL_SCAR } from './ground.js';

const WIND = new THREE.Vector3(0.9, -9.5, 0.45); // the drops' velocity

export function createRain(rand, { outline, height, top, boltSamples, uniforms, count = 17000 }) {
  let xs = Infinity, xe = -Infinity, zs = Infinity, ze = -Infinity;
  for (const [x, z] of outline) {
    xs = Math.min(xs, x); xe = Math.max(xe, x); zs = Math.min(zs, z); ze = Math.max(ze, z);
  }
  const mid = core(outline);
  const land = [], prm = [], fade = [];
  while (land.length / 3 < count) {
    const x = xs + rand() * (xe - xs), z = zs + rand() * (ze - zs);
    if (insideDist(outline, x, z) < 0.03) continue;
    // fewer drops away from the middle, none right at the edge
    const k = smoothstep(-0.1, 0.6, mid.at(x, z) / mid.r + (rand() - 0.5) * 0.15);
    if (rand() > k) continue;
    const y = height(x, z);
    // the time it takes to fall from the cloud to there
    land.push(x, y + 0.04, z);
    prm.push((top - y) / -WIND.y, rand() * 100, 0.7 + rand() * 0.6, rand());
    fade.push(0.35 + 0.65 * k);
  }
  const shared = {
    uWind: { value: WIND },
    uBolt: { value: boltSamples },
    uPx: { value: 0.001 },
    uBoltK: { value: 1 }, // how bright the bolt (0 gone)
  };

  // ---- the streaks ----
  const quad = new THREE.InstancedBufferGeometry();
  quad.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3));
  quad.setIndex([0, 1, 2, 1, 3, 2]);
  quad.setAttribute('land', new THREE.InstancedBufferAttribute(new Float32Array(land), 3));
  quad.setAttribute('prm', new THREE.InstancedBufferAttribute(new Float32Array(prm), 4));
  quad.setAttribute('fade', new THREE.InstancedBufferAttribute(new Float32Array(fade), 1));
  quad.instanceCount = count;
  const common = /* glsl */ `
    attribute vec3 land; attribute vec4 prm; attribute float fade;
    uniform vec3 uWind; uniform vec3 uBolt[24]; uniform float uTime, uPx, uBoltK;
    ${GLSL_SCAR}
    // how lit by the bolt a point is
    float boltLight(vec3 p) {
      float s = 0.0;
      for (int i = 0; i < 24; i++) { vec3 d = p - uBolt[i]; s += 1.0 / (dot(d, d) + 0.25); }
      return s * uBoltK;
    }
    // where it lands: down in the strikes' scars too
    vec3 landAt() { return land + vec3(0.0, scarH(land.xz), 0.0); }
    // the drop's time since it left the cloud (0 .. its fall time)
    float dropTime(out float cycle) {
      float T = prm.x;
      float k = (uTime * prm.z + prm.y) / T;
      cycle = floor(k);
      return fract(k) * T;
    }`;
  const streaks = new THREE.Mesh(
    quad,
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...shared },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${common}
        varying float vA, vX;
        void main() {
          float cyc;
          float t = dropTime(cyc);
          vec3 v = uWind * (0.9 + 0.2 * prm.w);
          vec3 p = landAt() + v * (t - prm.x);
          float len = 0.32 + 0.2 * prm.w;
          vec3 tail = p - normalize(v) * len * position.y;
          vec4 mv = viewMatrix * vec4(tail, 1.0);
          vec3 dir = normalize((viewMatrix * vec4(v, 0.0)).xyz);
          vec3 side = normalize(cross(dir, normalize(mv.xyz)));
          float w = 0.0045, px = -mv.z * uPx * 0.9;
          float we = max(w, px);
          mv.xyz += side * position.x * we;
          gl_Position = projectionMatrix * mv;
          float lit = boltLight(tail);
          vA = fade * (0.024 + 0.04 * lit) * (w / we) * smoothstep(0.0, 0.4, t) * (1.0 - position.y * 0.85);
          vX = position.x;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA, vX;
        void main() {
          float a = vA * (1.0 - vX * vX);
          gl_FragColor = vec4(vec3(0.78, 0.8, 1.0) * a, 1.0);
        }`,
    }),
  );
  streaks.frustumCulled = false;
  streaks.renderOrder = 30;

  // ---- the splashes: a ring spreading and fading where each drop lands ----
  const ring = new THREE.InstancedBufferGeometry();
  ring.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, -1, 0, 1, 1, 0, 1], 3));
  ring.setIndex([0, 2, 1, 1, 2, 3]);
  ring.setAttribute('land', quad.attributes.land);
  ring.setAttribute('prm', quad.attributes.prm);
  ring.setAttribute('fade', quad.attributes.fade);
  ring.instanceCount = count;
  const splashes = new THREE.Mesh(
    ring,
    new THREE.ShaderMaterial({
      uniforms: { ...uniforms, ...shared },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        ${common}
        varying vec2 vP; varying float vK, vA;
        void main() {
          float cyc;
          float t = dropTime(cyc);
          // the time since it landed: the previous fall's end
          float since = t / prm.z;
          vK = since / 0.22;
          float r = 0.01 + 0.045 * sqrt(clamp(vK, 0.0, 1.0));
          vec3 p = landAt() + position * r;
          vP = position.xz;
          vA = fade * (0.04 + 0.065 * boltLight(landAt())) * step(vK, 1.0);
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vP; varying float vK, vA;
        void main() {
          float d = length(vP);
          float ring = exp(-pow((d - 0.75) * 7.0, 2.0)) * (1.0 - vK);
          gl_FragColor = vec4(vec3(0.8, 0.82, 1.0) * ring * vA, 1.0);
        }`,
    }),
  );
  splashes.frustumCulled = false;
  splashes.renderOrder = 31;

  const group = new THREE.Group();
  group.add(streaks, splashes);
  return {
    group,
    setGlow(k) {
      shared.uBoltK.value = k;
    },
    setPx(camera, heightPx) {
      shared.uPx.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / heightPx;
    },
  };
}
