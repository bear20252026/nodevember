// The Milky Way, caught inside the machine: a spiral of star-dust laid in the
// plane of the planets, wound round the sun-lamp and slowly turning, as the
// plates of the 1870s showed the nebulae — as if the instrument maker had
// trapped the galaxy in his brass cage.
//  - the stars: many fine points along two great arms and two lesser ones,
//    blue-white in the arms, warmer between them and towards the middle, a
//    thicker swarm round the sun,
//  - the clouds: soft wisps lying flat in the disc along the arms, drawn
//    additively so they glow like the plates' milky nebulae.
import * as THREE from 'three';
import { rng, noise3, fbm } from './noise.js';
import { MASK_LAYER } from './look.js';

// seen face on, from above, the disc shows all its dust at once and glows
// too strong: it fades the more squarely it is looked at (to `low` face on)
const faceFade = (low) => /* glsl */ `
  float faceFade() {
    vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 n = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    float face = abs(dot(normalize(cameraPosition - wp), n));
    return mix(1.0, ${low.toFixed(2)}, smoothstep(0.3, 0.9, face));
  }`;

const R0 = 0.32, R1 = 3.25; // inside the zodiac ring
const B = 3.6; // the arms' winding: θ = θ0 + B · ln(r / R0)
const ARMS = [
  { a: 0, w: 1 },
  { a: Math.PI, w: 1 },
  { a: Math.PI / 2 + 0.4, w: 0.45 },
  { a: -Math.PI / 2 + 0.4, w: 0.45 },
];
const armAngle = (arm, r) => arm.a + B * Math.log(r / R0);

export function createGalaxy() {
  const rand = rng(1871);
  const gauss = () => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += rand();
    return (u - 2) * 1.73; // about N(0, 1)
  };
  const pickArm = () => {
    const tot = ARMS.reduce((s, a) => s + a.w, 0);
    let x = rand() * tot;
    for (const a of ARMS) if ((x -= a.w) <= 0) return a;
    return ARMS[0];
  };
  const thickness = (r) => 0.05 + 0.16 * Math.exp(-(r - R0) * 1.8);

  const group = new THREE.Group();
  const U = { uTime: { value: 0 }, uViewH: { value: 800 } };

  // ---- the stars
  const N = 18000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), siz = new Float32Array(N), seed = new Float32Array(N);
  const c = new THREE.Color();
  const young = new THREE.Color(0.75, 0.85, 1.25), old = new THREE.Color(1.35, 0.95, 0.55);
  for (let i = 0; i < N; i++) {
    const f = rand();
    let r, a, inArm;
    if (f < 0.12) {
      // the bulge round the sun
      r = R0 + Math.abs(gauss()) * 0.35;
      a = rand() * Math.PI * 2;
      inArm = 0;
    } else if (f < 0.35) {
      // the field between the arms
      r = R0 + (R1 - R0) * Math.pow(rand(), 0.75);
      a = rand() * Math.PI * 2;
      inArm = 0.2;
    } else {
      r = R0 + (R1 - R0) * Math.pow(rand(), 0.85);
      const arm = pickArm();
      // tighter on the arm's spine, frayed further out
      const spread = 0.1 + 0.08 * (r / R1);
      a = armAngle(arm, r) + gauss() * spread * arm.w ** -0.3;
      r += gauss() * 0.03;
      inArm = Math.exp(-0.5 * ((a - armAngle(arm, r)) / spread) ** 2);
    }
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = gauss() * thickness(r);
    pos[i * 3 + 2] = Math.sin(a) * r;
    c.copy(old).lerp(young, inArm * (0.6 + 0.4 * rand()));
    const bright = rand() < 0.03 ? 1.4 + rand() * 1.2 : 0.2 + rand() * 0.35;
    const fall = 0.6 + 0.6 * Math.exp(-(r - R0) * 0.8); // brighter inwards
    col[i * 3] = c.r * bright * fall;
    col[i * 3 + 1] = c.g * bright * fall;
    col[i * 3 + 2] = c.b * bright * fall;
    siz[i] = (bright > 2 ? 0.01 : 0.0055) * (0.7 + 0.6 * rand());
    seed[i] = rand();
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sg.setAttribute('size', new THREE.BufferAttribute(siz, 1));
  sg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const stars = new THREE.Points(sg, new THREE.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uTime, uViewH;
      attribute vec3 color;
      attribute float size, seed;
      varying vec3 vC;
      ${faceFade(0.88)}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float px = size * projectionMatrix[1][1] * uViewH * 0.5 / -mv.z;
        // too small to draw: keep it a pixel or so, dimmer
        float s = max(px, 1.2);
        float tw = 0.75 + 0.25 * sin(uTime * (1.5 + seed * 3.0) + seed * 60.0);
        vC = color * tw * min(1.0, (px * px) / (s * s) + 0.25);
        // and fade out what comes right up to the eye
        vC *= smoothstep(0.25, 0.8, -mv.z) * faceFade();
        gl_PointSize = s;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC;
      void main() {
        vec2 q = gl_PointCoord * 2.0 - 1.0;
        float d = dot(q, q);
        float a = exp(-d * 4.0) + 0.6 * exp(-d * 18.0);
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
  }));
  stars.frustumCulled = false;
  stars.renderOrder = 1.2;
  stars.onBeforeRender = (renderer) => {
    U.uViewH.value = renderer.getDrawingBufferSize(_v).y;
  };
  stars.layers.enable(MASK_LAYER);
  group.add(stars);

  // ---- the clouds: flat wisps lying in the disc
  const map = wispTexture();
  const glow = wisps(rand, gauss, {
    count: 900,
    place: () => {
      if (rand() < 0.05) return { r: R0 + Math.abs(gauss()) * 0.45, a: rand() * Math.PI * 2, s: 0.35 + rand() * 0.35 };
      const arm = pickArm();
      const r = R0 + 0.1 + (R1 - R0 - 0.1) * Math.pow(rand(), 0.9);
      return { r: r + gauss() * 0.05, a: armAngle(arm, r) + gauss() * 0.12, s: (0.18 + rand() * 0.3) * (0.6 + 0.4 * arm.w), arm };
    },
    color: ({ r }) => {
      const t = Math.min(1, (r - R0) / (R1 - R0));
      // thin near the sun, where they pile up and the corona already glows,
      // fullest about mid-way out
      const near = 0.15 + 0.85 * Math.min(1, t / 0.45) ** 1.5;
      const k = 0.024 * near * (1.15 - t * 0.5);
      // a warm milky core going to a pale, cooler haze outwards
      return [k * (1.3 - 0.4 * t), k * (1.0 - 0.1 * t), k * (0.65 + 0.35 * t), 1];
    },
    thickness,
  });
  const wispMat = (additive) => new THREE.ShaderMaterial({
    uniforms: { map: { value: map } },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute vec4 color;
      varying vec4 vC;
      varying vec2 vUv;
      ${faceFade(0.72)}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        vUv = uv;
        vC = color;
        vC.a *= smoothstep(0.3, 1.2, -mv.z) * faceFade(); // no fog right in the eye
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec4 vC;
      varying vec2 vUv;
      void main() {
        float m = texture2D(map, vUv).r * vC.a;
        gl_FragColor = ${additive ? 'vec4(vC.rgb * m, 1.0)' : 'vec4(vC.rgb, m)'};
      }`,
  });
  const glowMesh = new THREE.Mesh(glow, wispMat(true));
  glowMesh.renderOrder = 1;
  group.add(glowMesh);

  return {
    group,
    update(time) {
      U.uTime.value = time % 1000;
      // the whole wheel turns, slowly, against the planets
      group.rotation.y = -time * 0.012;
    },
  };
}
const _v = new THREE.Vector2();

// flat quads in the disc, each with one of the four wisps of the atlas,
// stretched along the arm
function wisps(rand, gauss, { count, place, color, thickness, stretch = 1.8 }) {
  const P = new Float32Array(count * 4 * 3), UV = new Float32Array(count * 4 * 2), C = new Float32Array(count * 4 * 4);
  const idx = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < count; i++) {
    const { r, a, s, arm } = place();
    const rr = Math.max(0.05, r);
    // along the arm (or at random in the bulge), with a slight tilt
    const tang = arm ? Math.atan2(B, 1) : rand() * Math.PI;
    e.set(gauss() * 0.14, -a - tang + gauss() * 0.25, gauss() * 0.14, 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(Math.cos(a) * rr, gauss() * thickness(rr), Math.sin(a) * rr), q,
      new THREE.Vector3(s * (arm ? stretch : 1.1), 1, s));
    const cell = Math.floor(rand() * 4), cu = (cell % 2) * 0.5, cv = Math.floor(cell / 2) * 0.5;
    const flip = rand() < 0.5 ? -1 : 1;
    const col = color({ r: rr });
    corners.forEach(([x, z], k) => {
      v.set(x, 0, z * flip).applyMatrix4(m);
      P.set([v.x, v.y, v.z], (i * 4 + k) * 3);
      UV.set([cu + (x * 0.5 + 0.5) * 0.5, cv + (z * 0.5 + 0.5) * 0.5], (i * 4 + k) * 2);
      C.set(col, (i * 4 + k) * 4);
    });
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(UV, 2));
  g.setAttribute('color', new THREE.BufferAttribute(C, 4));
  g.setIndex(idx);
  return g;
}

// four soft, ragged wisps of cloud in a 2×2 atlas
function wispTexture(S = 128) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S * 2;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S * 2, S * 2);
  for (let cell = 0; cell < 4; cell++) {
    const n = noise3(cell + 11);
    const ox = (cell % 2) * S, oy = Math.floor(cell / 2) * S;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S * 2 - 1, w = (y + 0.5) / S * 2 - 1;
      const d = Math.hypot(u, w);
      // the edge itself pushed about by the noise, and streaks inside
      const ragged = d + 0.35 * fbm(n, u * 1.6, w * 1.6, 0.5, 3);
      const fall = Math.max(0, 1 - ragged);
      const streak = 0.5 + 0.5 * fbm(n, u * 3.5, w * 1.2, 4.5, 4);
      const val = Math.pow(fall, 1.6) * (0.35 + 0.9 * streak);
      const o = ((oy + y) * S * 2 + ox + x) * 4;
      const b = Math.max(0, Math.min(255, val * 255 * Math.min(1, (1 - d) * 4)));
      img.data[o] = img.data[o + 1] = img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
