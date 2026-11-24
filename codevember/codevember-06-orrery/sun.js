// The sun, as an engraver of the 1870s would draw it for a frontispiece: a
// boiling globe from which long fine beams of light fan out into the hall.
//  - the globe: its own shader, a churning surface (cells and swirls moving
//    over it), white-hot in the middle, darkening to deep orange at the limb,
//  - the beams: blades of light fixed in space around the globe (below),
//  - the halo: one quad that always faces the camera, drawn additively in
//    linear HDR so the bloom and the print pass see it as light; everything
//    on it is in polar coordinates around the sun's centre, in sun radii.
import * as THREE from 'three';
import { GLSL_NOISE } from './noise.js';

export function createSun(R) {
  const group = new THREE.Group();
  const body = new THREE.Group(); // what turns: the globe
  group.add(body);
  const U = { uTime: { value: 0 }, uFlicker: { value: 1 } };

  // ---- the globe
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      varying vec3 vP, vN, vV;
      void main() {
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlicker;
      varying vec3 vP, vN, vV;
      ${GLSL_NOISE}
      void main() {
        vec3 p = normalize(vP);
        float t = uTime;
        // a swirl: the surface is pushed about by a slow, larger noise
        vec3 q = p * 3.0 + vec3(vnoise(p * 2.0 + t * 0.07), vnoise(p * 2.0 + 5.0 - t * 0.06), vnoise(p * 2.0 + 9.0 + t * 0.05)) * 1.6;
        float big = fbm3(q + vec3(0.0, t * 0.12, 0.0));
        // the granulation: bright cells with dark lanes between them
        vec3 w = worley(p * 11.0 + q * 0.6 + vec3(t * 0.15));
        float cells = smoothstep(0.0, 0.5, w.y - w.x);
        float v = 0.55 + 0.55 * big + 0.25 * cells;
        // limb darkening, and a deeper, redder rim
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        vec3 hot = vec3(1.9, 1.05, 0.36);
        vec3 deep = vec3(1.3, 0.3, 0.05);
        vec3 c = mix(deep, hot, pow(mu, 0.55) * smoothstep(0.25, 1.1, v));
        c *= mix(0.55, 1.0, pow(mu, 0.35)) * v;
        // a hot glow at the very edge
        c += vec3(1.2, 0.4, 0.08) * pow(1.0 - mu, 4.0) * (0.6 + 0.8 * big);
        // kept within what the print can show, so its granulation and its
        // redder rim read on the plate instead of washing out to bare paper
        // (its glow is the halo's and the rays' work)
        gl_FragColor = vec4(c * uFlicker * 0.6, 1.0);
      }`,
  }));
  body.add(globe);

  // ---- the halo: a glow round the globe, the same from every side
  const EXT = 9; // the quad's half size, in sun radii
  const corona = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { ...U, uExt: { value: EXT }, uR: { value: R } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uExt, uR;
      varying vec2 vQ;
      void main() {
        vQ = position.xy * uExt; // in sun radii
        // a billboard: the quad laid out in view space around the centre
        vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        c.xy += position.xy * uExt * uR;
        gl_Position = projectionMatrix * c;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uFlicker;
      varying vec2 vQ;
      ${GLSL_NOISE}
      #define TAU 6.28318530718
      void main() {
        float r = length(vQ);
        if (r < 0.9) discard;
        float a = atan(vQ.y, vQ.x);
        float t = uTime;
        float x = r - 1.0; // from the limb

        vec3 col = vec3(0.0);
        // -- and a halo to sit it all in
        col += vec3(1.6, 0.75, 0.25) * exp(-x * 2.4) * 0.28;
        col += vec3(0.5, 0.28, 0.1) * exp(-x * 0.5) * 0.03;

        // fade out well before the quad's edge
        col *= smoothstep(8.8, 5.5, r);
        gl_FragColor = vec4(col * uFlicker, 1.0);
      }`,
  }));
  corona.frustumCulled = false;
  corona.renderOrder = 3;
  group.add(corona);

  // ---- the long beams: fine rays of light standing out of the globe in every
  //      direction of space. Each one is a blade along its own fixed direction,
  //      turned about that axis only so that its broad side meets the eye: seen
  //      from aside it is long, seen end-on it shrinks into the globe and fades.
  const beams = createBeams(R, U);
  group.add(beams);

  return {
    group,
    globe: body,
    update(time, flicker) {
      U.uTime.value = time % 1000;
      U.uFlicker.value = flicker;
      beams.rotation.y = time * 0.025; // the whole crown wheels slowly round
    },
  };
}

function createBeams(R, U) {
  const N = 170;
  const dir = new Float32Array(N * 4 * 3), uv = new Float32Array(N * 4 * 2), seed = new Float32Array(N * 4 * 2);
  const idx = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
  for (let i = 0; i < N; i++) {
    // spread evenly over the sphere, then shaken a little
    const y = 1 - (2 * (i + 0.5)) / N;
    const rr = Math.sqrt(1 - y * y), th = i * golden;
    const d = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    d.add(new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(0.18)).normalize();
    const h = rnd(), h2 = rnd();
    for (let k = 0; k < 4; k++) {
      const v = i * 4 + k;
      dir.set([d.x, d.y, d.z], v * 3);
      uv.set([k & 1 ? 1 : -1, k >> 1], v * 2); // across, along
      seed.set([h, h2], v * 2);
    }
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dir, 3)); // the direction
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
  geo.setIndex(idx);

  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms: { ...U, uR: { value: R } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uR;
      attribute vec2 seed;
      varying vec2 vUv;
      varying float vR, vLen, vFace, vH;
      void main() {
        float h = seed.x, h2 = seed.y;
        // its length, in sun radii from the centre, breathing in and out
        float len = 2.0 + 4.5 * pow(h, 1.6);
        len *= 0.85 + 0.15 * sin(uTime * (0.6 + h2) + h * 20.0);
        float r = mix(0.95, len, uv.y);
        vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 d = normalize(mat3(modelMatrix) * position);
        vec3 p = c + d * r * uR;
        // turned about its own axis to face the eye
        vec3 toEye = normalize(cameraPosition - p);
        vec3 side = cross(d, toEye);
        float s = length(side);
        side = s > 1e-4 ? side / s : vec3(0.0, 1.0, 0.0);
        // a wedge: its width grows with the distance, as the old fan's did
        float w = (0.012 + 0.03 * h2) * r * uR;
        p += side * uv.x * w;
        vUv = uv; vR = r; vLen = len; vH = h2;
        vFace = s; // 1 seen broadside, 0 seen end-on
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFlicker;
      varying vec2 vUv;
      varying float vR, vLen, vFace, vH;
      void main() {
        float x = vR - 1.0; // from the limb
        float across = smoothstep(1.0, 0.0, abs(vUv.x));
        across *= across;
        float beam = across * smoothstep(vLen, vLen * 0.25, vR) * smoothstep(1.0, 2.0, vR);
        // end-on, a blade crowds its whole length into a point: let it go
        beam *= smoothstep(0.15, 0.6, vFace);
        vec3 col = vec3(1.6, 0.95, 0.4) * beam * (0.4 + 0.6 * vH) * 0.5 / (0.6 + x * 0.35);
        gl_FragColor = vec4(col * uFlicker, 1.0);
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  return mesh;
}
