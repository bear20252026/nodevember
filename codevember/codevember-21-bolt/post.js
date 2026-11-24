// After the render: the bolt's glare blooming out (its halo, wide and soft over a tight
// one), a near-black, neutral backdrop behind the diorama, a vignette and a little film grain.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// the backdrop's colour at a point of the screen (uv 0..1): also what the floor fades into
// far off, so that it has no horizon
export const BACKDROP = /* glsl */ `
  vec3 backdrop(vec2 uv, float aspect) {
    vec2 q = (uv - vec2(0.5, 0.42)) * vec2(aspect, 1.0);
    float g = exp(-dot(q, q) * 2.2);
    vec3 c = mix(vec3(0.003, 0.003, 0.004), vec3(0.024, 0.023, 0.028), g);
    return c + vec3(0.01, 0.01, 0.012) * smoothstep(0.2, 1.0, uv.y);
  }
`;

export function createPost(renderer) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const render = new RenderPass(null, null);
  composer.addPass(render);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.2, 0.25, 2.0);
  composer.addPass(bloom);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime, uAspect; varying vec2 vUv;
      float h(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
      void main() {
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
        float v = 1.0 - smoothstep(0.35, 1.25, length(q));
        c *= 0.45 + 0.55 * v;
        c += (h(vUv * 1000.0 + fract(uTime * 7.3) * 100.0) - 0.5) * 0.012;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  // the backdrop: a near-black night, faintly lighter behind the diorama (no violet tint)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: { uAspect: { value: 1 } },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 1.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uAspect; varying vec2 vUv;
        ${BACKDROP}
        void main() { gl_FragColor = vec4(backdrop(vUv, uAspect), 1.0); }`,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -1000;

  return {
    bloom,
    setSize(w, h) {
      composer.setSize(w / renderer.getPixelRatio(), h / renderer.getPixelRatio());
      grade.uniforms.uAspect.value = w / h;
      bg.material.uniforms.uAspect.value = w / h;
    },
    render(scene, camera, time = 0) {
      if (bg.parent !== scene) scene.add(bg);
      render.scene = scene;
      render.camera = camera;
      grade.uniforms.uTime.value = time;
      composer.render();
    },
  };
}
