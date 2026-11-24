import { DataUtils } from 'three/webgpu';

const assert = (value, message) => { if (!value) throw new Error(message); };

export async function checkCloudShadows(app = window.mirage) {
  const { renderer, atmosphere, camera, settings, navigation, post } = app;
  const saved = { ...settings }, manual = app.manual, eye = camera.position.clone();
  const target = navigation.controls.target.clone(), sun = atmosphere.sun.position.clone();
  const clouds = atmosphere.cloudShadows;
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await renderer.backend.device.queue.onSubmittedWorkDone(); };
  const read = async () => {
    const rt = clouds.target, raw = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    return Float32Array.from(raw, DataUtils.fromHalfFloat);
  };
  const stats = values => {
    let min = 1, max = 0, sum = 0;
    for (const v of values) { assert(Number.isFinite(v) && v >= 0 && v <= 1, 'Invalid cloud transmission'); min = Math.min(min, v); max = Math.max(max, v); sum += v; }
    return { min, max, mean: sum / values.length };
  };
  let report, failure;
  app.manual = true; renderer.backend.device.pushErrorScope('validation');
  try {
    Object.assign(settings, { paused: true, drift: false, clouds: .43, cloudDensity: .6, cloudShadows: 1, ssgi: false, heat: 0 });
    navigation.setView('Overlook'); settings.clouds = 0; await frame();
    // Establish both maps at the same simulation time, independently of the
    // previous two-second cache interval.
    settings.clouds = .43; await frame(); await frame();
    const initial = await read(), initialStats = stats(initial), version = clouds.updates;
    assert(initialStats.min < .2 && initialStats.max === 1, 'Cloud map lacks clear gaps or dense clouds');
    await frame(); assert(clouds.updates === version, 'Stationary paused cloud shadows rebuild every frame');
    camera.position.x += clouds.extent.value / clouds.target.width * 32;
    await frame();
    const shifted = await read(); let overlapError = 0;
    for (let z = 0; z < 512; z++) for (let x = 0; x < 480; x++) overlapError += Math.abs(initial[z * 512 + x + 32] - shifted[z * 512 + x]);
    overlapError /= 512 * 480;
    assert(overlapError < .001, `Cloud shadows swim when their map recenters: ${overlapError}`);
    camera.position.x -= clouds.extent.value / clouds.target.width * 32;
    camera.position.z += clouds.extent.value / clouds.target.width * 32;
    await frame(); const shiftedZ = await read(); let overlapZError = 0;
    for (let z = 0; z < 480; z++) for (let x = 0; x < 512; x++) overlapZError += Math.abs(initial[(z + 32) * 512 + x] - shiftedZ[z * 512 + x]);
    overlapZError /= 512 * 480;
    assert(overlapZError < .001, `Cloud shadows are flipped or swim along Z: ${overlapZError}`);
    camera.position.copy(eye); navigation.setView('Overlook');
    settings.cloudDensity = 1.2; await frame(); const dense = stats(await read());
    assert(dense.mean < initialStats.mean, 'Increasing cloud density does not attenuate sunlight');
    atmosphere.sun.position.set(.6, .56, -.55).normalize(); await frame();
    const movedSun = await read(); let changed = 0;
    for (let i = 0; i < movedSun.length; i++) if (Math.abs(movedSun[i] - initial[i]) > .05) changed++;
    assert(changed > 1000, 'Cloud shadows do not respond to the sun direction');
    atmosphere.sun.position.copy(sun);
    // Force broad shadow coverage to verify the map reaches direct lighting,
    // independently of visible clouds, IBL and temporal GI.
    settings.clouds = .8; settings.cloudShadows = 0; await frame(); await frame();
    const rt = post.scenePass.renderTarget;
    const before = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    settings.cloudShadows = 1; await frame(); await frame();
    const after = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    const albedo = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height, 1);
    let darkened = 0, lit = 0, sumBefore = 0, sumAfter = 0;
    for (let i = 0; i < after.length; i += 4) {
      if (albedo[i] + albedo[i + 1] + albedo[i + 2] === 0) continue;
      const a = DataUtils.fromHalfFloat(before[i]), b = DataUtils.fromHalfFloat(after[i]);
      assert(Number.isFinite(a + b), 'Cloud shadows produced invalid surface radiance');
      if (a - b > .001) darkened++;
      lit++; sumBefore += a; sumAfter += b;
    }
    assert(darkened > 100 && sumAfter < sumBefore, 'Cloud transmission did not attenuate direct surface lighting');
    settings.clouds = 0; await frame(); const clear = stats(await read());
    assert(clear.min === 1 && clear.max === 1, 'Clearing clouds leaves stale cloud shadows');
    settings.clouds = .43; await frame(); const refreshed = clouds.updates;
    atmosphere.update(settings, app.time + 1 / 60); assert(clouds.updates === refreshed + 1, 'Cloud shadows skipped an animated frame');
    atmosphere.update(settings, app.time + 2 / 60); assert(clouds.updates === refreshed + 2, 'Cloud shadows still update in visible steps');
    atmosphere.update(settings, app.time + 2 / 60); assert(clouds.updates === refreshed + 2, 'Paused cloud shadows rebuild needlessly');
    assert(atmosphere.sky.cloudShadowCapture.value === 0 && atmosphere.sky.showSunDisc.value, 'Cloud capture leaked into the visible sky');
    report = { transmission: initialStats, denseTransmission: dense, recenterMeanError: [overlapError, overlapZError], sunChangedPixels: changed, darkenedSurfacePixels: darkened, totalSurfacePixels: lit, clearTransmission: clear, cachedWhilePaused: true, animationRefresh: true };
  } catch (error) { failure = error; }
  finally {
    const error = await renderer.backend.device.popErrorScope(); if (error) failure ||= new Error(error.message);
    Object.assign(settings, saved); atmosphere.sun.position.copy(sun); navigation.setView(saved.view);
    camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    post.invalidate(); await frame(); app.manual = manual;
  }
  if (failure) throw failure;
  return report;
}
