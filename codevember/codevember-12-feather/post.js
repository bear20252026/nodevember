import * as THREE from 'three';

// The last pass: the multisampled HDR picture tone mapped (ACES, fitted), graded a
// little, a soft vignette, a fine grain, out in sRGB.
export class Post {
  constructor(renderer) {
    this.renderer = renderer;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.material = new THREE.ShaderMaterial({
      uniforms: { uTex: { value: this.target.texture }, uExposure: { value: 1.0 }, uTime: { value: 0 }, uRes: { value: new THREE.Vector2() } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D uTex;
        uniform float uExposure, uTime;
        uniform vec2 uRes;
        varying vec2 vUv;
        vec3 aces(vec3 x) {
          const mat3 m1 = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
          const mat3 m2 = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
          vec3 v = m1 * x;
          vec3 a = v * (v + 0.0245786) - 0.000090537;
          vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
          return clamp(m2 * (a / b), 0.0, 1.0);
        }
        float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
        vec3 srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
        void main() {
          vec3 c = texture2D(uTex, vUv).rgb * uExposure;
          c = aces(c * 1.12);
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, 1.06);
          vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
          c *= mix(1.0, 0.78, smoothstep(0.35, 1.25, length(q)));
          c = srgb(max(c, 0.0));
          c += (hash(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * 0.018;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    this.target.setSize(w, h);
    this.material.uniforms.uRes.value.set(w, h);
  }

  render(time) {
    this.material.uniforms.uTime.value = time;
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }
}
