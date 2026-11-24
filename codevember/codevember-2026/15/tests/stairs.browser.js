import { Vector3, Raycaster, DataUtils } from 'three/webgpu';

const assert = (value, message) => { if (!value) throw new Error(message); };

export async function checkStairs(app = window.mirage) {
  const { architecture, camera, settings, renderer, atmosphere } = app, lod = architecture.stairLod;
  const saved = { ...settings }, manual = app.manual, eye = camera.position.clone(), rotation = camera.quaternion.clone(), fov = camera.fov;
  const update = lod.update, shadow = atmosphere.sun.shadow.intensity;
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); };
  const report = { views: [], feet: [] };
  app.manual = true; Object.assign(settings, { paused: true, drift: false, ssgi: false, heat: 0, mirage: 0, dust: 0, wheelDust: 0 });
  renderer.backend.device.pushErrorScope('validation');
  try {
    assert(app.post.scenePass.renderTarget.samples === 4, 'Original MSAA was not retained');
    for (const [name, position, target] of [
      ['far', [0, 6, 145], [-12, 25, -260]],
      ['approach', [4, 4, -181], [-12, 16, -251]],
      ['near', [-12, 3, -200], [-12, 9, -220]]
    ]) {
      camera.position.fromArray(position); camera.lookAt(new Vector3().fromArray(target)); await frame();
      const weights = [...lod.weights.array];
      assert(weights.every(w => Number.isFinite(w) && w >= 0 && w <= 1), 'Invalid stair transition');
      if (name === 'far') assert(weights.every(w => w === 0), 'Subpixel treads remain visible at distance');
      if (name === 'approach') assert(weights.some(w => w > 0 && w < 1), 'Approach has no crossfade');
      if (name === 'near') assert(weights[0] === 1, 'Nearby flight lost its treads');
      report.views.push({ name, pixels: [...lod.pixels], weights });
    }
    // Roll and zoom must not change the decision for unrelated reasons.
    camera.position.set(0, 6, -145); camera.lookAt(-12, 10, -220); await frame();
    const pitch = [...lod.pixels]; camera.rotateZ(.6); await frame();
    assert(lod.pixels.every((v, i) => Math.abs(v - pitch[i]) < 1e-6), 'Camera roll changes stair detail');
    camera.fov = 26; camera.updateProjectionMatrix(); await frame();
    assert(lod.pixels.every((v, i) => v > pitch[i] * 1.8), 'Zoom does not reveal stair detail');
    camera.fov = fov; camera.updateProjectionMatrix();

    // At a fixed view, each interior pixel of the transition must come from
    // one endpoint. This catches unmatched masks, double draws and holes.
    camera.position.set(-12, 5, -150); camera.lookAt(-12, 6, -215); camera.updateMatrixWorld();
    lod.update = () => false; atmosphere.sun.shadow.intensity = 0;
    const rt = app.post.scenePass.renderTarget;
    const p = new Vector3(-12, architecture.stairs[10].y, architecture.stairs[10].z).project(camera);
    const x = Math.round((p.x * .5 + .5) * rt.width) - 8, y = Math.round((.5 - p.y * .5) * rt.height) - 8;
    const images = [];
    for (const weight of [0, 1, .5, .5]) {
      lod.weights.array.fill(weight); await frame(); await frame();
      images.push(Float32Array.from(await renderer.readRenderTargetPixelsAsync(rt, x, y, 16, 16), DataUtils.fromHalfFloat));
    }
    let nearPixels = 0, farPixels = 0, unmatched = 0, unstable = 0;
    for (let i = 0; i < images[0].length; i += 4) {
      const error = (a, b) => Math.max(...[0, 1, 2].map(c => Math.abs(a[i + c] - b[i + c])));
      const far = error(images[2], images[0]), near = error(images[2], images[1]);
      assert(Number.isFinite(far + near), 'Nonfinite stair image');
      if (far < .006) farPixels++;
      if (near < .006) nearPixels++;
      if (Math.min(far, near) > .006) unmatched++;
      if (error(images[2], images[3]) > .001) unstable++;
    }
    assert(nearPixels > 30 && farPixels > 30, 'Transition does not draw both surfaces');
    assert(unmatched < 8, `Dither leaves mismatched coverage: ${unmatched} pixels`);
    assert(unstable === 0, 'Stationary stair dither flickers');
    report.coverage = { nearPixels, farPixels, unmatched, unstable };

    // A low horizontal ray through each outer front corner used to pass
    // through the gap beneath the newel. Test real rendered geometry.
    architecture.group.updateMatrixWorld(true);
    const supports = architecture.batches.filter(mesh => mesh.geometry.type === 'BoxGeometry'
      && mesh.geometry.userData.preserveSurface && mesh.material === app.materials.masonry);
    for (const side of [-1, 1]) {
      const x = -12 + side * 11.7 * 1.18, z = architecture.stairs[0].z + 1.3;
      const y = app.landscape.surfaceAt(x, z) + .06;
      const ray = new Raycaster(new Vector3(x + side * 5, y, z), new Vector3(-side, 0, 0));
      const hit = ray.intersectObjects(supports, false)[0];
      assert(hit && hit.distance < 3.6, 'Entrance plinth floats above the sand');
      report.feet.push({ side, clearanceProbe: .06, distance: hit.distance });
    }
    report.gpuValidation = 'passed'; return report;
  } finally {
    lod.update = update; atmosphere.sun.shadow.intensity = shadow; atmosphere.sun.shadow.needsUpdate = true;
    Object.assign(settings, saved); camera.position.copy(eye); camera.quaternion.copy(rotation); camera.fov = fov; camera.updateProjectionMatrix();
    app.post.invalidate(); await frame(); app.manual = manual;
    const error = await renderer.backend.device.popErrorScope(); assert(!error, error?.message);
  }
}
