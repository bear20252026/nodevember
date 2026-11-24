import { DataUtils } from 'three/webgpu';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Verify cloud radiance reaches shaded geometry through the environment,
// stays out of fog, and does not force six cube renders on every frame.
export async function checkCloudIBL(app = window.mirage) {
  const { atmosphere, renderer, settings, camera, navigation, post } = app;
  const saved = { ...settings }, manual = app.manual, eye = camera.position.clone();
  const savedCloudPhase = atmosphere.cloudPhase.value;
  const target = navigation.controls.target.clone();
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await renderer.backend.device.queue.onSubmittedWorkDone(); };
  const read = (rt, attachment = 0, face = 0) => renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height, attachment, face);
  const difference = (a, b, mask = null) => {
    let changed = 0, total = 0, sum = 0;
    for (let i = 0; i < a.length; i += 4) {
      // Background has no diffuse albedo; exclude it so visible cloud pixels
      // cannot masquerade as a material-lighting change.
      if (mask && mask[i] + mask[i + 1] + mask[i + 2] === 0) continue;
      let delta = 0;
      for (let c = 0; c < 3; c++) {
        const x = DataUtils.fromHalfFloat(a[i + c]), y = DataUtils.fromHalfFloat(b[i + c]);
        assert(Number.isFinite(x + y), 'Nonfinite IBL radiance');
        delta = Math.max(delta, Math.abs(x - y));
      }
      if (delta > .0005) changed++;
      total++; sum += delta;
    }
    return { changedPixels: changed, totalPixels: total, meanDifference: sum / Math.max(total, 1) };
  };
  app.manual = true;
  renderer.backend.device.pushErrorScope('validation');
  let report, failure;
  try {
    Object.assign(settings, { paused: true, drift: false, clouds: 0, cloudShadows: 0, ssgi: false, heat: 0 });
    navigation.setView('Sanctuary'); await frame(); await frame();
    const { skyCube, environmentCube } = atmosphere;
    assert(app.scene.environment === environmentCube.texture && environmentCube !== skyCube, 'IBL and fog must use separate captures');
    const clear = await read(environmentCube, 0, 2), fog = await read(skyCube, 0, 2);
    const unclouded = await read(post.scenePass.renderTarget);
    settings.clouds = .43; settings.cloudDensity = .6; await frame(); await frame();
    const cloudDifference = difference(clear, await read(environmentCube, 0, 2));
    const fogDifference = difference(fog, await read(skyCube, 0, 2));
    const surfaceDifference = difference(unclouded, await read(post.scenePass.renderTarget), await read(post.scenePass.renderTarget, 1));
    assert(cloudDifference.changedPixels > 100, 'Clouds are missing from IBL');
    assert(fogDifference.meanDifference === 0, 'Cloud settings changed the clear-air fog cube');
    assert(surfaceDifference.changedPixels > 100, 'Cloud radiance did not reach PBR surfaces');
    const version = environmentCube.texture.pmremVersion;
    await frame(); await frame();
    assert(environmentCube.texture.pmremVersion === version, 'Paused IBL rebuilds every frame');
    atmosphere.update(settings, app.time + 2.1);
    assert(environmentCube.texture.pmremVersion === version + 1, 'Cloud animation does not refresh PMREM');
    atmosphere.update(settings, app.time + 2.2);
    assert(environmentCube.texture.pmremVersion === version + 1, 'IBL ignores the refresh interval');
    // With light and simulation time fixed, advancing the cloud field must
    // move actual rendered clouds and refresh both IBL and projected shadows.
    await frame();
    const still = await read(environmentCube, 0, 2), oldPhaseVersion = environmentCube.texture.pmremVersion;
    const oldShadowVersion = atmosphere.cloudShadows.updates;
    settings.cloudShadows = 1; atmosphere.cloudPhase.value += 90; await frame();
    const movingDifference = difference(still, await read(environmentCube, 0, 2));
    assert(movingDifference.changedPixels > 100, 'Changing cloud phase does not move rendered clouds');
    assert(environmentCube.texture.pmremVersion > oldPhaseVersion, 'Cloud transition left IBL stale');
    assert(atmosphere.cloudShadows.updates > oldShadowVersion, 'Cloud transition left projected shadows stale');
    assert(atmosphere.sky.showSunDisc.value, 'IBL capture left the visible sun disabled');
    report = { cloudDifference, fogDifference, surfaceDifference, movingDifference, resolution: environmentCube.width, cachedWhilePaused: true, animationRefresh: true };
  } catch (error) { failure = error; }
  finally {
    const error = await renderer.backend.device.popErrorScope(); if (error) failure ||= new Error(error.message);
    atmosphere.cloudPhase.value = savedCloudPhase;
    Object.assign(settings, saved); navigation.setView(saved.view); camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    post.invalidate(); await frame(); app.manual = manual;
  }
  if (failure) throw failure;
  return report;
}
