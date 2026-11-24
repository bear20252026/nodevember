// The picture as the eye takes it: the bright surface and the blades lit through bloom
// into the water around them, the colours graded toward the deep sea's (shadows into blue,
// the light kept warm), the corners darkened, the bottom of the view sinking into the deep,
// and the light, rendered in HDR, brought down to the screen by AgX tone mapping, the way
// film takes it: what is too bright fades softly to white instead of clipping to a
// saturated yellow. Then a touch of chromatic softness toward the edges and a fine grain
// against banding in the gradients. The scene is rendered multisampled (the kelp's cut-out
// edges rely on it), at most 1.5 pixels per css pixel, the bloom at half that, the grade
// and the output in one pass.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const MAX_RATIO = 1.5, MIN_RATIO = 0.75;
const EXPOSURE = 1.45; // before the tone mapping (?exposure=…)

export function createPost(renderer, scene, camera, exposure = EXPOSURE) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.45, 0.65, 0.62);
  const bloomSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSize(Math.ceil(w / 2), Math.ceil(h / 2));
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 }, uExposure: { value: exposure } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime; uniform float uAspect; uniform float uExposure;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      // AgX (Troy Sobotka's, in the sRGB primaries): the light compressed in log space by a
      // sigmoid, the brightest colours desaturating toward white as film's do
      vec3 agxContrast(vec3 x) {
        vec3 x2 = x * x, x4 = x2 * x2;
        return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
      }
      vec3 agx(vec3 c) {
        const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995,
                                0.0951212405381588, 0.761241990602591, 0.0767994186031903,
                                0.0482516061458583, 0.101439036467562, 0.811302368396859);
        const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826,
                                 -0.11060664309660323, 1.157823702216272, -0.11060664309660294,
                                 -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
        const float lo = -12.47393, hi = 4.026069;
        c = inset * c;
        c = clamp((log2(max(c, 1e-10)) - lo) / (hi - lo), 0.0, 1.0);
        c = agxContrast(c);
        // a little more punch than AgX's base look: deeper shadows, a touch more colour
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = pow(max(c, 0.0), vec3(1.3));
        c = mix(vec3(pow(l, 1.3)), c, 1.45);
        c = outset * c;
        return clamp(pow(max(c, 0.0), vec3(2.2)), 0.0, 1.0);
      }
      void main() {
        // chromatic softness: red and blue a hair apart, more toward the edges
        vec2 off = (vUv - 0.5) * vec2(uAspect, 1.0);
        off *= 0.0018 * dot(off, off) * 4.0 / vec2(uAspect, 1.0);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        // the deep below and the corners: darker, bluer
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float vig = smoothstep(1.15, 0.25, length(q * vec2(0.85, 1.0)));
        float sink = smoothstep(0.0, 0.42, vUv.y);
        c *= mix(0.5, 1.0, vig) * mix(0.8, 1.0, sink);
        c = mix(c, c * vec3(0.6, 0.9, 1.1), (1.0 - sink) * 0.2);
        // shadows toward blue-green, a little more saturation
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c += vec3(-0.004, 0.006, 0.012) * (1.0 - smoothstep(0.0, 0.15, l));
        c = max(mix(vec3(l), c, 1.12), 0.0);
        c = agx(c * uExposure);
        gl_FragColor = sRGBTransferOETF(vec4(c, 1.0));
        // grain
        gl_FragColor.rgb += (hash(vUv * 1000.0 + fract(uTime * 7.3)) - 0.5) * 0.022;
      }`,
  });
  composer.addPass(grade);
  // the scene at most 1.5 pixels per css pixel, the grade upscaling it to the screen:
  // nearly the same picture on a dense screen (the water is soft), at half the cost. And
  // fewer when the frames come too slowly (a big screen, a small GPU): measured over a
  // second at a time, a step down when slow, back up when there is room, never again up to
  // a ratio that was too slow
  let ratio = Math.min(renderer.getPixelRatio(), MAX_RATIO), ceiling = ratio;
  let frames = 0, since = performance.now();
  const apply = () => {
    composer.setPixelRatio(ratio);
    composer.setSize(innerWidth, innerHeight);
  };
  function adapt() {
    const now = performance.now();
    frames++;
    if (now - since < 1000) return;
    const dt = (now - since) / frames;
    frames = 0; since = now;
    if (document.hidden || dt > 250) return; // a stall, not the GPU
    if (dt > 20 && ratio > MIN_RATIO) {
      ceiling = ratio - 0.25;
      ratio = Math.max(MIN_RATIO, ratio - 0.25);
      apply();
    } else if (dt < 17.5 && ratio + 0.25 <= ceiling) {
      ratio += 0.25;
      apply();
    }
  }
  return {
    composer,
    setSize(w, h) {
      ratio = Math.min(ratio, renderer.getPixelRatio());
      ceiling = Math.min(renderer.getPixelRatio(), MAX_RATIO);
      apply();
      grade.uniforms.uAspect.value = w / h;
    },
    render(time) {
      adapt();
      grade.uniforms.uTime.value = time;
      composer.render();
    },
  };
}
