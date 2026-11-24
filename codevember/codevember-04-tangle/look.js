// How it's shown: a specimen on a dark table under a warm key light that casts
// shadows (the stalks shade each other), a cool light from behind that shines
// through the thin ones, a studio around it for the reflections, and after it
// ambient occlusion, a soft bloom, then tone mapping, vignette and grain.
// The aragonite itself: white, a silky sheen, a little translucent, darker and
// warmer deep inside the tangle (the occlusion baked in mesh.js), and glints
// of tiny crystals that catch the light.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

export const BACKGROUND = 0x141311;

export function setupRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.78;
  renderer.setClearColor(BACKGROUND);
}

export function createStage(renderer, scene, { shadowSize = 4096 } = {}) {
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.FogExp2(BACKGROUND, 0.12);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.4;
  scene.environmentRotation.set(0, 0.8, 0);
  pmrem.dispose();

  scene.add(new THREE.HemisphereLight(0xc8d4ff, 0x4a3e32, 0.35));
  // from behind: cool, it rims the outline and shines through the thin stalks
  const rim = new THREE.DirectionalLight(0xcfdcff, 2.4);
  rim.position.set(2.5, 2.2, -3.2).normalize();
  const rim2 = new THREE.DirectionalLight(0xffe6cc, 1.1);
  rim2.position.set(-3, 0.6, -2.4).normalize();
  // a touch from the front right so the shadows aren't black
  const fill = new THREE.DirectionalLight(0xdfe6ff, 0.7);
  fill.position.set(3, 1, 2.5).normalize();
  scene.add(rim, rim2, fill);

  // the table: lit by the key around the specimen, lost in the dark further
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x3e3a36, roughness: 0.92, metalness: 0 }),
  );
  floor.receiveShadow = true;
  scene.add(floor);

  // the key: warm, high on the left, the one that casts the shadows. One for
  // each generation shown, in its group, so each keeps its shadow map: drawn
  // once, since nothing moves but the camera. center: the middle of the
  // generation in its group, r: its bounding radius.
  const keyDir = new THREE.Vector3(-2.2, 4, 2.6).normalize();
  const keyFor = (center, r) => {
    const key = new THREE.DirectionalLight(0xffeedd, 3.2);
    key.target.position.copy(center);
    key.position.copy(keyDir).multiplyScalar(r * 3).add(center);
    key.castShadow = true;
    key.shadow.mapSize.set(shadowSize, shadowSize);
    key.shadow.bias = -0.0002;
    key.shadow.normalBias = 0.006;
    key.shadow.radius = 2;
    key.shadow.autoUpdate = false;
    key.shadow.needsUpdate = true;
    const c = key.shadow.camera;
    c.left = c.bottom = -r * 1.05;
    c.right = c.top = r * 1.05;
    c.near = r * 0.5;
    c.far = r * 6;
    c.updateProjectionMatrix();
    return key;
  };
  return { floor, keyFor };
}

// the aragonite, MeshPhysicalMaterial with a few additions in its shader
export function aragonite() {
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xf3f0ea,
    roughness: 0.48,
    metalness: 0,
    ior: 1.6,
    specularIntensity: 0.7,
    sheen: 0.3,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.12,
    clearcoatRoughness: 0.35,
    fog: false,
  });
  const uniforms = {
    uStain: { value: new THREE.Color(0xb39a78) }, // the warm tinge deep inside
    uThrough: { value: new THREE.Color(0xfff2e0).multiplyScalar(0.9) }, // light through
    uGlint: { value: 7 },
    uGlintScale: { value: 260 },
  };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = s.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float occlusion;
        attribute float radius;
        varying float vOcc;
        varying float vRadius;
        varying vec3 vObj;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vOcc = occlusion;
        vRadius = radius;
        vObj = position;`,
      );
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uStain;
        uniform vec3 uThrough;
        uniform float uGlint;
        uniform float uGlintScale;
        varying float vOcc;
        varying float vRadius;
        varying vec3 vObj;
        float hash13(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.zyx + 31.32);
          return fract((p.x + p.y) * p.z);
        }
        vec3 hash33(vec3 p) {
          p = fract(p * vec3(0.1031, 0.1030, 0.0973));
          p += dot(p, p.yxz + 33.33);
          return fract((p.xxy + p.yxx) * p.zyx);
        }
        float vnoise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`,
      )
      .replace(
        '#include <lights_physical_pars_fragment>',
        `#include <lights_physical_pars_fragment>
        vec3 glintCell;
        float glintOn;
        // after each light: what goes through the thin stalks, and the glints
        void extraDirect(IncidentLight L, vec3 N, vec3 V, inout ReflectedLight rl) {
          float thin = 1.0 - smoothstep(0.012, 0.07, vRadius);
          vec3 H = normalize(L.direction + N * 0.4);
          float t = pow(saturate(dot(V, -H)), 3.0) * (0.15 + 0.85 * thin);
          float wrap = saturate((dot(N, L.direction) + 0.5) / 1.5) * 0.12 * thin;
          rl.directDiffuse += uThrough * L.color * (t * 0.55 + wrap) * (0.35 + 0.65 * vOcc);
          if (glintOn > 0.0) {
            vec3 gn = normalize(N + (hash33(glintCell) - 0.5) * 1.1);
            float g = pow(saturate(dot(gn, normalize(L.direction + V))), 600.0);
            rl.directSpecular += L.color * g * uGlint * glintOn * saturate(dot(N, L.direction) * 3.0);
          }
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float occ = clamp(vOcc, 0.0, 1.0);
        diffuseColor.rgb *= mix(uStain, vec3(1.0), smoothstep(-0.25, 0.8, occ));
        // a fine, sugary unevenness of the crystal
        float grain = vnoise(vObj * 90.0) * 0.6 + vnoise(vObj * 23.0) * 0.4;
        diffuseColor.rgb *= 0.88 + 0.12 * grain;
        glintCell = floor(vObj * uGlintScale);
        glintOn = step(0.965, hash13(glintCell)) * smoothstep(0.3, 0.8, occ);`,
      )
      .replaceAll(
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
        extraDirect( directLight, geometryNormal, geometryViewDir, reflectedLight );`,
      )
      .replace(
        '#include <aomap_fragment>',
        `#include <aomap_fragment>
        // the shadow map is too coarse for the narrow hollows: the bake darkens
        // the direct light a bit too, and the light from around a lot
        reflectedLight.indirectDiffuse *= occ;
        reflectedLight.indirectSpecular *= occ * occ;
        reflectedLight.directDiffuse *= mix(0.55, 1.0, occ);
        reflectedLight.directSpecular *= mix(0.3, 1.0, occ);`,
      );
  };
  return m;
}

// gives a geometry without them the attributes the material reads
export function prepare(g, { occlusion = 1, radius = 0.2 } = {}) {
  const n = g.attributes.position.count;
  if (!g.attributes.occlusion) g.setAttribute('occlusion', new THREE.BufferAttribute(new Float32Array(n).fill(occlusion), 1));
  if (!g.attributes.radius) g.setAttribute('radius', new THREE.BufferAttribute(new Float32Array(n).fill(radius), 1));
  return g;
}

const Finish = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 d = vUv - 0.5;
      d.x *= uAspect;
      float r = length(d);
      // a faint split of the colours towards the corners
      vec2 off = (vUv - 0.5) * 0.0025 * r;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      c *= mix(1.0, smoothstep(1.15, 0.2, r), 0.5);
      float g = hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5;
      c += g * 0.028 * (1.0 - 0.5 * c);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// the chain after the render, for one view of width × height (css pixels)
export function createPost(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, 1, 1);
  // the occlusion is soft, it doesn't need every pixel: at half the size
  const gtaoSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSize(Math.ceil(w / 2), Math.ceil(h / 2));
  gtao.updateGtaoMaterial({ radius: 0.22, distanceExponent: 1.6, thickness: 0.6, scale: 1.1, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 8 });
  gtao.blendIntensity = 0.6;
  composer.addPass(gtao);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.4, 0.92);
  // a glow, so a quarter of the size is plenty (it halves it again inside)
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSize(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  // antialiasing here rather than multisampling the float buffer (10 × cheaper):
  // SMAA on ordinary screens, FXAA on dense ones where it's as good and 4 × cheaper
  const dense = renderer.getPixelRatio() >= 1.5;
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(dense ? fxaa : new SMAAPass(1, 1));
  const finish = new ShaderPass(Finish);
  composer.addPass(finish);
  let w = 0, h = 0;
  return {
    render(width, height, time) {
      if (width !== w || height !== h) {
        w = width;
        h = height;
        composer.setPixelRatio(renderer.getPixelRatio());
        composer.setSize(w, h);
      }
      const pr = renderer.getPixelRatio();
      fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      finish.uniforms.uTime.value = time;
      finish.uniforms.uAspect.value = w / h;
      composer.render();
    },
  };
}
