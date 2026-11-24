import * as THREE from 'three';
import { litMaterial } from './common.js';

// The room: a soft studio floor, warm pale grey, taking the key's shadow (the creature's,
// and the lacy ones of the feathers lying on it) soft, wide under the body and crisp
// where things touch, darkened right under the body (its occlusion, as a sphere's), with
// a faint grain like paper; far off it fades into the backdrop, a sweep from the floor's
// colour up to a cooler grey.

export function stage(scene, { floor = '#cdc5b9', horizon = '#d3cdc4', top = '#aeb5bb' } = {}) {
  const floorMat = litMaterial({
    uniforms: { uColor: { value: new THREE.Color(floor) }, uHorizon: { value: new THREE.Color(horizon) } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uHorizon;
      varying vec3 vW;
      void main() {
        vec3 N = vec3(0.0, 1.0, 0.0);
        float grain = vnoise(vW * 40.0) * 0.5 + vnoise(vW * 9.0) * 0.5;
        vec3 albedo = uColor * (0.95 + 0.06 * grain);
        float sh = softShadowAt(vW, 0.16, 2.0);
        // the body's occlusion: a sphere of its current size
        float rv = mix(uBody.w, uFluff, pow(uCoverage, 0.6)) * 0.95;
        vec3 toB = uBody.xyz - vW;
        float d = length(toB);
        float occ = clamp(rv * rv * max(toB.y, 0.0) / (d * d * d), 0.0, 1.0);
        float ao = 1.0 - occ * 0.75;
        vec3 col = albedo * (uKeyColor * sh * dot(N, uKeyDir) * 0.62 + hemi(N) * 1.25 * ao);
        col *= mix(1.0, ao, 0.5);
        float far = smoothstep(5.0, 18.0, length(vW.xz));
        gl_FragColor = vec4(mix(col, uHorizon, far), 1.0);
      }`,
  });
  const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), floorMat);
  scene.add(floorMesh);

  const sky = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uHorizon: { value: new THREE.Color(horizon) }, uTop: { value: new THREE.Color(top) } },
    vertexShader: /* glsl */ `
      varying vec3 vD;
      void main() { vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon, uTop;
      varying vec3 vD;
      void main() { gl_FragColor = vec4(mix(uHorizon, uTop, smoothstep(-0.02, 0.45, vD.y)), 1.0); }`,
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  return { floorMesh, sky };
}
