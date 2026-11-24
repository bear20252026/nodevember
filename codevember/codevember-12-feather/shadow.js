import * as THREE from 'three';
import { LIGHTS, SHADOW_BOX } from './common.js';

// The key light's shadow map, drawn by hand: every mesh that casts carries its depth
// material in userData.depthMaterial (the feathers' one cuts their barbs out as their
// colour pass does, so they cast lacy, partial shadows on each other, the skin and the
// floor); the others are hidden for that pass. The map's depth is read in shadowAt
// (common.js).

export class KeyShadow {
  constructor(renderer, { size = 4096, extent = SHADOW_BOX.extent } = {}) {
    this.renderer = renderer;
    size = Math.min(size, renderer.capabilities.maxTextureSize);
    this.target = new THREE.WebGLRenderTarget(size, size, {
      depthTexture: new THREE.DepthTexture(size, size, THREE.UnsignedIntType),
      depthBuffer: true,
    });
    this.target.depthTexture.minFilter = this.target.depthTexture.magFilter = THREE.NearestFilter;
    this.camera = new THREE.OrthographicCamera(-extent, extent, extent, -extent, 0.5, 24);
    this.center = SHADOW_BOX.center.clone();
    LIGHTS.uShadowMap.value = this.target.depthTexture;
    LIGHTS.uShadowTexel.value = 1 / size;
    LIGHTS.uShadowSpan.value.set(2 * extent, this.camera.far - this.camera.near);
    this.swapped = [];
  }

  render(scene) {
    const { camera, center } = this;
    camera.position.copy(center).addScaledVector(LIGHTS.uKeyDir.value, 12);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    LIGHTS.uShadowMatrix.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const swapped = this.swapped;
    swapped.length = 0;
    scene.traverseVisible((o) => {
      if (!o.isMesh) return;
      swapped.push(o, o.material);
      if (o.userData.depthMaterial) o.material = o.userData.depthMaterial;
      else o.visible = false;
    });
    const r = this.renderer;
    const bg = scene.background;
    scene.background = null;
    r.setRenderTarget(this.target);
    r.clear(true, true, false);
    r.render(scene, camera);
    r.setRenderTarget(null);
    scene.background = bg;
    for (let i = 0; i < swapped.length; i += 2) {
      swapped[i].material = swapped[i + 1];
      swapped[i].visible = true;
    }
  }
}
