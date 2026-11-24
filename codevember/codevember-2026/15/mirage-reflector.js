import { MeshBasicNodeMaterial, NoToneMapping, LinearSRGBColorSpace, MathUtils } from 'three/webgpu';
import { reflector, uniform, getViewPosition, vec4 } from 'three/tsl';

// ReflectorNode supplies a mirrored camera and an oblique clipping plane.
// We drive its capture explicitly because its texture is sampled in a
// fullscreen heat-compositing pass, not on a visible water/mirror mesh.
export function createMirageReflector(renderer, scene, camera, atmosphere) {
  const reflection = reflector({ resolutionScale: .5, depth: true, bounces: false, samples: 4 });
  reflection.target.rotation.x = -Math.PI / 2; scene.add(reflection.target);
  const captureCamera = camera.clone();
  const virtual = reflection.reflector.getVirtualCamera(captureCamera); virtual.layers.set(1);
  reflection.reflector.getRenderTarget(virtual).storeMultisampledColorBuffer = false;
  const inverse = uniform(virtual.projectionMatrixInverse), worldMatrix = uniform(virtual.matrixWorld);
  const projection = uniform(virtual.projectionMatrix), viewMatrix = uniform(virtual.matrixWorldInverse);
  const available = uniform(0), holder = new MeshBasicNodeMaterial();
  let initialized = false;
  function sample(uv) {
    const depth = reflection.getDepthNode().sample(uv).r;
    const view = getViewPosition(uv, depth, inverse), world = worldMatrix.mul(vec4(view, 1)).xyz;
    return atmosphere.applyHaze(reflection.sample(uv).rgb, view, world, depth, worldMatrix.element(3).xyz);
  }
  function project(point) {
    // Standard planar-reflector coordinates: project the actual ground-plane
    // intersection through the mirrored camera, including its translation.
    // No screen-color lookup or angular stretching of the reflected scene.
    const clip = projection.mul(viewMatrix.mul(vec4(point, 1))).toVar();
    return { uv: clip.xy.div(clip.w.max(.0001)).mul(.5).add(.5).flipY(), facing: clip.w.smoothstep(.01, .06) };
  }
  function render(settings, anchor) {
    const floor = anchor.y;
    const height = camera.position.y - floor;
    available.value = settings.mirage > 0 ? MathUtils.smoothstep(height, .15, .8) * (1 - MathUtils.smoothstep(height, 22, 60)) : 0;
    const enabled = available.value > 0;
    if (!enabled && initialized) return;
    reflection.target.position.set(anchor.x, floor, anchor.z); reflection.target.updateMatrixWorld();
    captureCamera.copy(camera, false);
    captureCamera.position.y = Math.max(floor + .2, camera.position.y);
    // A camera cloned during startup still has WebGL coordinates. Letting the
    // renderer convert it here would overwrite the reflector's oblique matrix.
    captureCamera.coordinateSystem = renderer.coordinateSystem; captureCamera.aspect = camera.aspect;
    captureCamera.projectionMatrix.copy(camera.projectionMatrix);
    // A modest symmetric guard band covers shimmer at the viewport edges.
    // The old flattened, very wide capture wasted most vertical resolution.
    captureCamera.projectionMatrix.elements[0] /= 1.08;
    captureCamera.projectionMatrix.elements[5] /= 1.08;
    captureCamera.projectionMatrixInverse.copy(captureCamera.projectionMatrix).invert();
    captureCamera.updateMatrixWorld();
    const shadowUpdate = atmosphere.sun.shadow.needsUpdate, backgroundNode = scene.backgroundNode, background = scene.background;
    const tone = renderer.toneMapping, space = renderer.outputColorSpace, lod = renderer.drawingPipeline.lodThreshold;
    try {
      atmosphere.sun.shadow.needsUpdate = false;
      // Sample atmospheric radiance in the reflected camera's direction.
      // Reusing a row of the main-view sky made the horizon follow the screen.
      scene.backgroundNode = null; scene.background = atmosphere.environmentCube.texture;
      renderer.toneMapping = NoToneMapping; renderer.outputColorSpace = LinearSRGBColorSpace;
      renderer.drawingPipeline.lodThreshold = Math.max(5, lod * 1.5);
      reflection.reflector.updateBefore({ renderer, scene, camera: captureCamera, material: holder });
      // The pinned Reflector updates its oblique projection, but leaves the
      // inverse unchanged. Depth reconstruction for atmospheric haze needs it.
      virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
      initialized = true;
    } finally {
      atmosphere.sun.shadow.needsUpdate = shadowUpdate; scene.backgroundNode = backgroundNode; scene.background = background;
      renderer.toneMapping = tone; renderer.outputColorSpace = space; renderer.drawingPipeline.lodThreshold = lod;
    }
  }
  return { reflection, virtual, available, sample, project, render,
    dispose() { scene.remove(reflection.target); holder.dispose(); reflection.dispose(); }
  };
}
