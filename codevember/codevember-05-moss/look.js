// How it's shown: a macro shot of a moss cushion on a rock slab in a wood,
// a low sun breaking through behind it. The wood all around, out of focus,
// for the reflections, a warm key that casts shadows and shines through the
// leaves and the stalks, a cool fill from the front. Then ambient occlusion,
// a shallow depth of field, a soft bloom, tone mapping, vignette and grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { GLSL_NOISE } from './noise.js';

export const KEY_DIR = new THREE.Vector3(-1.6, 1.25, -1.9).normalize(); // towards the sun

export function setupRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.95;
}

// all around: a wood, out of focus — foliage in deep and sunlit greens,
// dark trunks, the sky through gaps in the canopy, discs of sunlight through
// the leaves, a hazy depth at the horizon, the forest floor below. Seen as the
// backdrop, and (with the sun) as the light from around, through PMREM.
const forestShader = {
  uniforms: { uSun: { value: KEY_DIR.clone() }, uSunAmt: { value: 1 }, uStrength: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uSun; uniform float uSunAmt; uniform float uStrength;
    varying vec3 vDir;
    ${GLSL_NOISE}
    const vec3 HAZE = vec3(0.27, 0.35, 0.2);
    void main() {
      vec3 d = normalize(vDir);
      float y = d.y;
      vec2 dh = normalize(d.xz + 1e-5);
      // foliage, deep and mid greens, with sunlit patches
      float f1 = vnoise(d * 4.0) * 0.5 + vnoise(d * 8.0 + 2.0) * 0.32 + vnoise(d * 16.0) * 0.18;
      vec3 c = mix(vec3(0.03, 0.055, 0.022), vec3(0.12, 0.19, 0.06), smoothstep(0.3, 0.72, f1));
      float lp = smoothstep(0.52, 0.78, vnoise(d * 6.0 + 3.0) * 0.6 + vnoise(d * 14.0) * 0.4);
      c = mix(c, vec3(0.42, 0.5, 0.17), lp * 0.75);
      // the far wood towards the horizon: paler, bluer, hazy
      c = mix(c, HAZE, exp(-abs(y - 0.02) * 14.0) * 0.5);
      // trunks: two layers, the far ones paler
      float t1 = smoothstep(0.68, 0.76, vnoise(vec3(dh * 16.0, 1.0)));
      float t2 = smoothstep(0.66, 0.74, vnoise(vec3(dh * 34.0, 5.0)));
      float tm = smoothstep(-0.3, -0.1, y) * (1.0 - smoothstep(0.35, 0.8, y));
      vec3 bark = mix(vec3(0.05, 0.045, 0.035), vec3(0.2, 0.17, 0.12), vnoise(vec3(dh * 40.0, y * 3.0)) * 0.6);
      c = mix(c, mix(c, vec3(0.24, 0.27, 0.24), 0.7), t2 * tm * 0.7);
      c = mix(c, bark, t1 * tm * 0.9);
      // the sky through the canopy, more of it higher up
      float gap = smoothstep(0.6, 0.72, vnoise(d * 3.5 + 11.0) * 0.6 + vnoise(d * 8.0) * 0.4 + y * 0.35);
      c = mix(c, vec3(0.9, 0.95, 0.92) * 1.4, gap * smoothstep(0.15, 0.6, y) * (1.0 - t1 * tm));
      // the forest floor below the horizon
      // below the horizon: undergrowth — ferns and shrubs, darker, with
      // sunlit fronds — then the floor far down (only seen through the haze)
      float ug = vnoise(d * 9.0 + 21.0) * 0.6 + vnoise(d * 20.0) * 0.4;
      vec3 under = mix(vec3(0.03, 0.05, 0.02), vec3(0.16, 0.24, 0.06), smoothstep(0.35, 0.75, ug));
      under = mix(under, vec3(0.38, 0.45, 0.14), smoothstep(0.7, 0.85, ug) * 0.6);
      c = mix(c, under, smoothstep(0.0, -0.06, y) * (1.0 - t1 * tm * 0.6));
      c = mix(c, mix(vec3(0.09, 0.07, 0.04), vec3(0.16, 0.13, 0.07), vnoise(d * 12.0)), smoothstep(-0.25, -0.45, y));
      // discs of sunlight through the leaves, where the foliage is lit
      vec3 p = d * 28.0, i = floor(p);
      float bok = 0.0;
      for (int z = -1; z <= 1; z++) for (int yy = -1; yy <= 1; yy++) for (int x = -1; x <= 1; x++) {
        vec3 g = i + vec3(float(x), float(yy), float(z));
        vec3 h = hash33(g);
        if (h.x < 0.5) continue;
        float r = 0.16 + 0.26 * h.y;
        float dist = length(p - (g + h));
        bok += smoothstep(r, r * 0.7, dist) * (0.5 + h.z) * (0.7 + 0.3 * smoothstep(r * 0.5, r * 0.85, dist));
      }
      c += vec3(1.0, 0.92, 0.65) * bok * 0.9 * smoothstep(0.3, 0.8, lp + gap * 0.5) * smoothstep(-0.02, 0.1, y);
      // the sun, for the light only
      float s = max(dot(d, normalize(uSun)), 0.0);
      c += uSunAmt * vec3(1.0, 0.86, 0.66) * (pow(s, 8.0) * 0.5 + pow(s, 64.0) * 2.0 + pow(s, 2000.0) * 40.0);
      gl_FragColor = vec4(c * uStrength, 1.0);
    }`,
};

// the forest floor the slab sits in: fragments of dead leaves and needles,
// soil, patches of moss and grass, a bit damp
// far off, things on the ground take the backdrop's colour in their direction,
// so the floor melts into the wood. For any material: fadeToBack(m, back)
export const FADE = { near: 4.5, far: 13 };
const FADE_CODE = /* glsl */ `
  {
    vec3 vd = inverseTransformDirection(-vViewPosition, viewMatrix);
    float fade = smoothstep(${FADE.near.toFixed(2)}, ${FADE.far.toFixed(2)}, length(vViewPosition));
    gl_FragColor.rgb = mix(gl_FragColor.rgb, textureCube(uBack, vd).rgb, fade);
  }`;
export function fadeToBack(m, back) {
  const before = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => {
    if (before) before.call(m, s, r);
    s.uniforms.uBack = { value: back };
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform samplerCube uBack;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + FADE_CODE);
  };
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => key() + '+fade';
  return m;
}

export function forestFloorMaterial(back) {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0 });
  m.onBeforeCompile = (s) => {
    s.uniforms.uBack = { value: back };
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vW;
        uniform samplerCube uBack;
        ${GLSL_NOISE}
        float floorH;`,
      )
      .replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
        ${FADE_CODE}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 p = vec3(vW.x, 0.0, vW.z);
        vec3 dist = vec3(vnoise(p * 2.5), 0.0, vnoise(p * 2.5 + 5.0)) * 0.9;
        // two layers of elongated leaf fragments, crossing; the nearer one
        // (higher in the middle of its cell) on top
        vec3 A = worley2(vec2(p.x * 26.0, p.z * 14.0) + dist.xz);
        vec3 B = worley2(vec2(p.x * 13.0, p.z * 24.0) + dist.zx + 31.7);
        float hA = 1.0 - A.x, hB = 1.0 - B.x * 1.05;
        bool top = hA > hB;
        float id = top ? A.z : B.z;
        float F = top ? A.x : B.x;
        vec3 leaf = id < 0.3 ? vec3(0.24, 0.14, 0.06) : id < 0.55 ? vec3(0.17, 0.1, 0.045) : id < 0.75 ? vec3(0.3, 0.21, 0.09) : id < 0.9 ? vec3(0.19, 0.16, 0.12) : vec3(0.08, 0.055, 0.035);
        leaf *= 0.8 + 0.4 * vnoise(p * 90.0);
        leaf *= 1.0 - 0.35 * smoothstep(0.35, 0.85, F); // lower towards its edges
        // dark soil where neither covers
        float bare = smoothstep(0.62, 0.78, min(A.x, B.x)) * smoothstep(0.4, 0.6, vnoise(p * 5.0));
        vec3 col = mix(leaf, vec3(0.05, 0.035, 0.022), bare);
        // fallen needles: thin streaks here and there
        float nd = 1.0 - smoothstep(0.0, 0.035, abs(fract(dot(p.xz, vec2(37.0, 21.0)) + vnoise(p * 7.0) * 3.0) - 0.5));
        col = mix(col, vec3(0.26, 0.17, 0.08), nd * smoothstep(0.62, 0.8, vnoise(p * 4.0 + 9.0)) * 0.6);
        // moss and grass, speckled
        float gN = fbm3(p * 1.2 + 4.0) + (vnoise(p * 30.0) - 0.5) * 0.15;
        float g = smoothstep(0.52, 0.68, gN);
        col = mix(col, vec3(0.06, 0.12, 0.03) * (0.4 + 1.0 * vnoise(p * 140.0)), g * 0.75);
        col *= 0.75 + 0.35 * fbm3(p * 0.7);
        diffuseColor.rgb *= col;
        floorH = (1.0 - F) * 0.3 - bare * 0.3 + g * vnoise(p * 140.0) * 0.4;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
          float hx = dFdx(floorH), hy = dFdy(floorH);
          vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
          float det = dot(dpdx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2) * 0.02);
        }`,
      );
  };
  return m;
}

export function createStage(renderer, scene) {
  // what's reflected and what lights the shadows: the sky, through PMREM
  const envScene = new THREE.Scene();
  const envSky = new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), new THREE.ShaderMaterial({ ...forestShader, uniforms: THREE.UniformsUtils.clone(forestShader.uniforms), side: THREE.BackSide, depthWrite: false }));
  envScene.add(envSky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.75;
  pmrem.dispose();

  // the backdrop seen behind: the same wood, without the sun, drawn once into
  // a cube map (the shader is costly, the view of it never changes). As the
  // background it writes no depth: the far distance, for the occlusion and the
  // depth of field
  const bakeScene = new THREE.Scene();
  const backdropMat = new THREE.ShaderMaterial({ ...forestShader, uniforms: { uSun: { value: KEY_DIR.clone() }, uSunAmt: { value: 0 }, uStrength: { value: 1 } }, side: THREE.BackSide, depthWrite: false });
  const backdropGeo = new THREE.SphereGeometry(10, 96, 48);
  bakeScene.add(new THREE.Mesh(backdropGeo, backdropMat));
  const cube = new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.1, 100, cube);
  const toneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  cubeCam.update(renderer, bakeScene);
  renderer.toneMapping = toneMapping;
  backdropGeo.dispose();
  backdropMat.dispose();
  scene.background = cube.texture;
  // (the forest floor itself: floor.js, it fades into this backdrop)

  scene.add(new THREE.HemisphereLight(0xdde6c8, 0x3a3a20, 0.55));

  // the sun, low and behind on the left: warm, it casts the shadows and comes
  // through the leaves and the stalks
  const key = new THREE.DirectionalLight(0xffe7c4, 3.6);
  key.position.copy(KEY_DIR).multiplyScalar(6);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.012;
  key.shadow.radius = 3;
  const c = key.shadow.camera;
  c.left = c.bottom = -2.6;
  c.right = c.top = 2.6;
  c.near = 2;
  c.far = 12;
  c.updateProjectionMatrix();
  scene.add(key, key.target);

  // a cool fill from the front right, so the side we see isn't black
  const fill = new THREE.DirectionalLight(0xdfe6d2, 0.85);
  fill.position.set(2.5, 1.6, 3).normalize();
  // and a faint warm bounce from below the cushion
  const bounce = new THREE.DirectionalLight(0xffc89a, 0.25);
  bounce.position.set(0.5, -1, 1).normalize();
  scene.add(fill, bounce);
  return { key, back: cube.texture };
}

// the plants' materials: MeshStandardMaterial with the light that comes
// through thin, translucent tissue (leaves, stalks) when it shines from behind
// vertex: an optional (shader) => void to change the vertex shader too (key: its cache key)
export function plantMaterial({ roughness = 0.5, through = 0xb8e060, amount = 1, side = THREE.DoubleSide, vertex = null, key = '' } = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness: 0, side });
  const uniforms = { uThrough: { value: new THREE.Color(through).multiplyScalar(amount) } };
  m.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    if (vertex) vertex(s);
    s.fragmentShader = s.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec3 uThrough;`,
      )
      .replace(
        '#include <lights_physical_pars_fragment>',
        `#include <lights_physical_pars_fragment>
        void through(IncidentLight L, vec3 N, vec3 V, vec3 albedo, inout ReflectedLight rl) {
          // forward scattering towards the eye, and light from the other side of the blade
          float fwd = pow(saturate(dot(V, -L.direction)), 4.0);
          float back = saturate(-dot(N, L.direction));
          rl.directDiffuse += uThrough * albedo * L.color * (fwd * 0.9 + back * 0.45);
        }`,
      )
      .replaceAll(
        'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
        `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
        through( directLight, geometryNormal, geometryViewDir, material.diffuseColor, reflectedLight );`,
      );
  };
  m.customProgramCacheKey = () => 'plant' + key;
  return m;
}

// depth of field: a gather over a disc, each sample counted if its own blur
// reaches the pixel (so a blurred foreground spills over a sharp background,
// not the other way round). Depth from the scene pass, full size.
const DofShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNear: { value: 0.05 },
    uFar: { value: 100 },
    uFocus: { value: 2 },
    uAperture: { value: 1 },
    uMaxR: { value: 12 }, // px
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform float uNear, uFar, uFocus, uAperture, uMaxR; uniform vec2 uRes;
    varying vec2 vUv;
    float viewZ(vec2 uv) {
      float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
      return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
    }
    float coc(float d) { return clamp(uAperture * abs(d - uFocus) / d, 0.0, 1.0) * uMaxR; }
    #define N 40
    void main() {
      float d0 = viewZ(vUv);
      float c0 = coc(d0);
      vec3 col = texture2D(tDiffuse, vUv).rgb;
      vec4 acc = vec4(col, 1.0);
      if (c0 < 0.3 && uMaxR < 0.5) { gl_FragColor = vec4(col, 1.0); return; }
      for (int i = 0; i < N; i++) {
        float fi = float(i) + 0.5;
        float r = sqrt(fi / float(N)) * uMaxR;
        float a = fi * 2.39996;
        vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
        float d = viewZ(uv);
        float c = coc(d);
        // behind the pixel: it can't spill over it more than the pixel is blurred
        if (d > d0) c = min(c, c0);
        float w = smoothstep(r - 1.5, r, c);
        vec3 s = texture2D(tDiffuse, uv).rgb;
        // a little extra weight on the bright ones: rounder highlights
        w *= 1.0 + 0.6 * smoothstep(1.0, 4.0, dot(s, vec3(0.3, 0.5, 0.2)));
        acc += vec4(s * w, w);
      }
      gl_FragColor = vec4(acc.rgb / acc.a, 1.0);
    }`,
};

// the last touch, in display space: grade, vignette, faint colour split, grain
const Finish = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main() {
      vec2 d = vUv - 0.5;
      d.x *= uAspect;
      float r = length(d);
      vec2 off = (vUv - 0.5) * 0.003 * r;
      vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
      // a touch more saturation and a gentle S-curve
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, 1.12);
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.25);
      // cooler shadows, warmer highlights
      c += (vec3(-0.01, 0.0, 0.015) * (1.0 - l) + vec3(0.012, 0.004, -0.01) * l);
      c *= mix(1.0, smoothstep(1.2, 0.25, r), 0.55);
      float g = hash(vUv * 1000.0 + fract(uTime) * 100.0) - 0.5;
      c += g * 0.03 * (1.0 - 0.5 * c);
      gl_FragColor = vec4(c, 1.0);
    }`,
};

// the scene drawn into a target of its own that keeps the depth, full size,
// for the occlusion and the depth of field (thin stalks need every pixel)
class ScenePass extends Pass {
  constructor(scene, camera) {
    super();
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthTexture: new THREE.DepthTexture(1, 1) });
    this.copy = new FullScreenQuad(new THREE.ShaderMaterial({ ...CopyShader, uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), depthTest: false, depthWrite: false }));
    this.copy.material.uniforms.tDiffuse.value = this.target.texture;
  }
  setSize(w, h) {
    this.target.setSize(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    renderer.setRenderTarget(this.target);
    renderer.clear();
    renderer.render(this.scene, this.camera);
    renderer.setRenderTarget(readBuffer);
    this.copy.render(renderer);
  }
}

export function createPost(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  const scenePass = new ScenePass(scene, camera);
  composer.addPass(scenePass);
  const gtao = new GTAOPass(scene, camera, 1, 1);
  // from the scene's depth (the normals rebuilt from it): no second drawing
  gtao.setGBuffer(scenePass.target.depthTexture);
  const gtaoSize = gtao.setSize.bind(gtao);
  gtao.setSize = (w, h) => gtaoSize(Math.ceil(w / 2), Math.ceil(h / 2));
  gtao.updateGtaoMaterial({ radius: 0.05, distanceExponent: 1.4, thickness: 0.4, scale: 1.0, samples: 16 });
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 8 });
  gtao.blendIntensity = 0.75;
  composer.addPass(gtao);
  const dof = new ShaderPass(DofShader);
  dof.uniforms.tDepth.value = scenePass.target.depthTexture;
  composer.addPass(dof);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.28, 0.55, 0.85);
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSize(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const dense = renderer.getPixelRatio() >= 1.5;
  const fxaa = new ShaderPass(FXAAShader);
  composer.addPass(dense ? fxaa : new SMAAPass(1, 1));
  const finish = new ShaderPass(Finish);
  composer.addPass(finish);
  let w = 0, h = 0;
  const api = {
    dof: true,
    aperture: 1,
    render(width, height, time, focus) {
      const pr = renderer.getPixelRatio();
      if (width !== w || height !== h) {
        w = width;
        h = height;
        composer.setPixelRatio(pr);
        composer.setSize(w, h);
      }
      fxaa.uniforms.resolution.value.set(1 / (w * pr), 1 / (h * pr));
      const u = dof.uniforms;
      u.uNear.value = camera.near;
      u.uFar.value = camera.far;
      u.uFocus.value = focus;
      // the blur grows with the screen, about the same look at any size
      u.uMaxR.value = api.dof ? h * pr * 0.016 : 0;
      u.uAperture.value = api.aperture * 0.9;
      u.uRes.value.set(w * pr, h * pr);
      finish.uniforms.uTime.value = time;
      finish.uniforms.uAspect.value = w / h;
      composer.render();
    },
  };
  return api;
}
