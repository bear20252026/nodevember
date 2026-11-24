import { RenderTarget, PerspectiveCamera, HalfFloatType, RedFormat, LinearFilter, NoToneMapping, LinearSRGBColorSpace } from 'three/webgpu';
import { uniform, texture, positionWorld, mix } from 'three/tsl';

// A directional transmission map from the same density integration as SkyMesh.
// The map lies on y=0; project elevated receivers along the shared sun direction.
export function createCloudShadows(renderer, sky, skyScene, camera, sun) {
  const target = new RenderTarget(512, 512, { type: HalfFloatType, format: RedFormat, depthBuffer: false, minFilter: LinearFilter, magFilter: LinearFilter });
  target.texture.name = 'Cloud transmission / direct sun';
  const captureCamera = new PerspectiveCamera(90, 1, 1, 20000);
  const center = sky.cloudShadowCenter, extent = sky.cloudShadowExtent;
  const direction = uniform(sun.position), strength = uniform(1);
  const projected = positionWorld.xz.sub(direction.xz.mul(positionWorld.y.div(direction.y.max(.08))));
  const uv = projected.sub(center).div(extent).add(.5);
  const border = uv.min(uv.oneMinus());
  const edge = border.x.min(border.y).smoothstep(0, .08);
  const transmission = texture(target.texture, uv.clamp(.001, .999)).r;
  const node = mix(1, transmission, edge.mul(strength));
  let key = '', capturedTime = -Infinity, updates = 0;
  return { target, node, strength, center, extent,
    get updates() { return updates; },
    update(settings, time) {
      strength.value = settings.cloudShadows ?? 1;
      if (strength.value === 0 && key !== '') return;
      const step = extent.value / target.width * 32;
      const x = Math.round(camera.position.x / step) * step, z = Math.round(camera.position.z / step) * step;
      const nextKey = `${x}/${z}/${sun.position.toArray()}/${settings.clouds}/${settings.cloudDensity}/${settings.cloudElevation}/${settings.cloudScale}/${sky.cloudSpeed.value}`;
      const moving = settings.clouds > 0 && settings.cloudDensity > 0 && sky.cloudSpeed.value !== 0;
      // Match the visible sky on every animated frame. Only reuse a map when
      // its density field is unchanged (paused time or stationary clouds).
      if (key === nextKey && time >= capturedTime && (!moving || time === capturedTime)) return;
      const renderTarget = renderer.getRenderTarget(), cubeFace = renderer.getActiveCubeFace(), mip = renderer.getActiveMipmapLevel();
      const tone = renderer.toneMapping, space = renderer.outputColorSpace, mrt = renderer.getMRT();
      try {
        center.value.set(x, z); sky.cloudShadowCapture.value = 1;
        captureCamera.position.copy(camera.position); captureCamera.updateMatrixWorld();
        renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
        renderer.setMRT(null); renderer.setRenderTarget(target); renderer.render(skyScene, captureCamera);
        key = nextKey; capturedTime = time; updates++;
      } finally {
        sky.cloudShadowCapture.value = 0;
        renderer.setRenderTarget(renderTarget, cubeFace, mip); renderer.setMRT(mrt);
        renderer.toneMapping = tone; renderer.outputColorSpace = space;
      }
    },
    dispose() { target.dispose(); }
  };
}
