import { Vector3, DataUtils } from 'three/webgpu';
import { createDust } from '../dust.js';

const assert = (value, message) => { if (!value) throw new Error(message); };

export async function checkDust(app = window.mirage) {
  const { camera, atmosphere, settings, dust, rover, navigation } = app;
  const report = {}, saved = { ...settings }, state = rover.capture(), manual = app.manual;
  const savedCloudPhase = atmosphere.cloudPhase.value, savedSun = atmosphere.sun.position.clone();
  const eye = camera.position.clone(), target = navigation.controls.target.clone();
  const rig = { active: true, moving: true, position: new Vector3(), physics: {
    position: [0, 1.05, 0], rotation: [0, 0, 0, 1], velocity: [0, 0, -10], angularVelocity: [0, 0, 0],
    wheels: [-1, 1].flatMap(side => [-1, 1].map(end => ({ side, end, angle: 0, point: [side * .93, 0, end * .92], normal: [0, 1, 0], contact: true, sand: true })))
  } };
  const probeCamera = camera.clone();
  const probe = createDust(probeCamera, { heightAt: () => 0 }, atmosphere), options = { ...settings, dust: 0, wheelDust: 1, paused: false };
  const tick = count => { for (let i = 0; i < count; i++) probe.update(1 / 60, rig, options); };
  const wheelParticles = () => probe.particles.filter(p => p.kind !== 'wind' && p.age < p.life);
  try {
    tick(3); let particles = wheelParticles();
    assert(particles.length > 0 && particles.every(p => p.vz > 0), 'Forward tires must throw sand behind the vehicle');
    report.forwardSpray = particles.length;
    probe.clear(); rig.physics.velocity[2] = 10; tick(3); particles = wheelParticles();
    assert(particles.length > 0 && particles.every(p => p.vz < 0), 'Reverse driving must reverse the spray direction');
    report.reverseSpray = particles.length;
    for (const mode of ['stationary', 'stone', 'airborne', 'inactive', 'disabled']) {
      probe.clear(); rig.physics.velocity[2] = mode === 'stationary' ? 0 : -10;
      rig.active = mode !== 'inactive'; options.wheelDust = mode === 'disabled' ? 0 : 1;
      for (const w of rig.physics.wheels) { w.sand = mode !== 'stone'; w.contact = mode !== 'airborne'; }
      tick(60); assert(probe.diagnostics.wheel === 0, `${mode} wheels emit sand`);
    }
    report.contactAndSpeedGates = true;
    rig.active = true; options.wheelDust = 1; for (const w of rig.physics.wheels) w.sand = w.contact = true;
    tick(1800); assert(probe.diagnostics.alive <= probe.diagnostics.capacity, 'Particle pool grows without bounds');
    report.peakPool = probe.diagnostics.alive;
    report.stoppedWake = [];
    for (const paused of [false, true]) {
      probe.clear(); options.paused = paused; rig.moving = true; rig.physics.velocity[2] = -10; tick(30);
      const puff = wheelParticles().find(p => p.kind === 'wake' && p.age < .2);
      const before = { age: puff.age, x: puff.x, y: puff.y, z: puff.z }, emitted = probe.diagnostics.emitted;
      rig.moving = false; rig.physics.velocity[2] = 0;
      assert(probe.needsFrame, 'Lingering wheel dust does not request rendering');
      tick(30);
      const drift = Math.hypot(puff.x - before.x, puff.y - before.y, puff.z - before.z);
      assert(Math.abs(puff.age - before.age - .5) < 1e-8 && drift > .05, 'Wheel dust freezes when the rover stops');
      assert(probe.diagnostics.emitted === emitted, 'Stopped wheels keep emitting dust');
      tick(240);
      assert(probe.diagnostics.wheel === 0 && !probe.needsFrame, 'Stopped wheel dust never finishes fading');
      report.stoppedWake.push({ paused, drift, emissionStopped: true, dissipated: true });
    }
    const regionalState = () => probe.particles.filter(p => p.zone >= 0).map(p => [p.age, p.x, p.y, p.z]);
    const fixed = regionalState(); probeCamera.position.x += 600; probeCamera.position.z -= 400; tick(1);
    assert(JSON.stringify(fixed) === JSON.stringify(regionalState()), 'Regional dust follows the camera');
    assert(new Set(probe.particles.filter(p => p.zone >= 0).map(p => p.zone)).size === 16, 'Regional dust sources are missing');
    options.paused = false; tick(30);
    assert(JSON.stringify(fixed) !== JSON.stringify(regionalState()), 'World dust does not drift after unpausing');
    report.worldAnchoredRegions = { zones: probe.dustZones.length, particles: fixed.length };
  } finally { probe.dispose(); }

  app.manual = true; settings.dust = 0; settings.wheelDust = 1; settings.paused = true;
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); };
  const read = async () => {
    const rt = app.post.dustPass.renderTarget, data = await app.renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    let alpha = 0, radiance = 0, covered = 0, maximum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const rgba = Array.from(data.subarray(i, i + 4), DataUtils.fromHalfFloat);
      assert(rgba.every(Number.isFinite), 'Nonfinite dust pixel');
      assert(rgba[3] >= 0 && rgba[3] <= 1.001, 'Invalid dust alpha');
      alpha += rgba[3]; radiance += rgba[0] + rgba[1] + rgba[2]; maximum = Math.max(maximum, rgba[3]);
      if (rgba[3] > .001) covered++;
    }
    return { alpha, radiance, covered, maximum };
  };
  app.renderer.backend.device.pushErrorScope('validation');
  let failure;
  try {
    dust.clear(); dust.update(0, rover, settings);
    // Place one sprite in clear sand beside the rover; then bury it beneath
    // that same surface to test scene-depth occlusion without an opaque quad.
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const point = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion).multiplyScalar(7).add(camera.position).addScaledVector(right, 2.5);
    const ground = app.landscape.heightAt(point.x, point.z);
    const p = dust.particles[dust.ambientCount];
    Object.assign(p, { kind: 'wake', age: .2, life: 2, x: point.x, y: ground + .7, z: point.z, size: .8, aspect: 1, angle: 0, spin: 0, tile: 0, opacity: .8, shade: 1 });
    await frame(); report.aboveGround = await read();
    assert(report.aboveGround.covered > 20, 'Dust is invisible above the sand');
    assert(report.aboveGround.radiance > report.aboveGround.alpha * .2, 'Dust rendered black instead of lit sand');
    p.y = ground - 2; await frame(); report.belowGround = await read();
    assert(report.belowGround.covered === 0, 'Dust shows through opaque terrain');
    dust.clear(); dust.update(0, rover, settings); await frame(); report.empty = await read();
    assert(report.empty.alpha === 0 && report.empty.radiance === 0, 'Empty dust pass changes the scene');
    report.daylight = [];
    for (const name of ['Dawn', 'Sunset', 'Day']) {
      const previousDirection = atmosphere.sun.position.clone();
      const previousPhase = atmosphere.cloudPhase.value;
      document.querySelector(`#daylight [data-time="${name}"]`).click();
      assert(atmosphere.sun.position.distanceTo(previousDirection) < 1e-9, 'Lighting jumps on preset selection');
      assert(atmosphere.cloudPhase.value === previousPhase, 'Clouds jump on preset selection');
      app.daylight.update(1);
      assert(app.daylight.active, 'Lighting transition finished before two seconds');
      assert(atmosphere.sun.position.distanceTo(previousDirection) > .01, 'Lighting does not animate while paused');
      assert(Math.abs(atmosphere.cloudPhase.value - previousPhase) > 1, 'Clouds do not animate while paused');
      await frame();
      assert(atmosphere.sky.cloudTime.value === app.time + atmosphere.cloudPhase.value, 'Cloud captures use a different clock from the sky');
      app.daylight.update(1);
      assert(!app.daylight.active, 'Lighting transition did not finish in two seconds');
      await frame();
      assert(atmosphere.sun.position.angleTo(atmosphere.sky.sunPosition.value) < 1e-7, 'Sky sun and shadows diverged');
      assert(document.querySelectorAll('#daylight [aria-pressed="true"]').length === 1, 'Time-of-day selection is ambiguous');
      report.daylight.push({ name, sun: atmosphere.sun.position.toArray(), intensity: atmosphere.sun.intensity, exposure: settings.exposure, cloudPhase: atmosphere.cloudPhase.value, turbidity: settings.turbidity, transitionSeconds: 2, groundHeat: app.post.groundHeat.value });
    }
    app.daylight.select('Dawn'); app.daylight.update(.7);
    const interrupted = atmosphere.sun.position.clone(), interruptedClouds = atmosphere.cloudPhase.value;
    app.daylight.select('Sunset');
    assert(atmosphere.sun.position.distanceTo(interrupted) < 1e-9, 'Interrupting a transition jumps the light');
    assert(atmosphere.cloudPhase.value === interruptedClouds, 'Interrupting a transition jumps the clouds');
    app.daylight.update(2);
    atmosphere.sun.position.set(-.6, -.05, .8).normalize(); await frame();
    assert(app.post.groundHeat.value === 0 && app.post.mirage.value === 0 && app.post.heat.value === 0, 'Night retains the hot-ground effect');
    const image = app.post.mirageImage.renderTarget;
    const night = await app.renderer.readRenderTargetPixelsAsync(image, 0, 0, image.width, image.height);
    for (let i = 0; i < night.length; i += 64) assert(Number.isFinite(DataUtils.fromHalfFloat(night[i])), 'Zero heat produces invalid radiance');
    report.interruptibleTransition = report.nightMirageDisabled = true;
  } catch (error) { failure = error; }
  finally {
    const error = await app.renderer.backend.device.popErrorScope(); if (error) failure ||= new Error(error.message);
    rover.restore(state); app.daylight.select(saved.timeOfDay); app.daylight.update(2); Object.assign(settings, saved); navigation.setView(saved.view); camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    atmosphere.cloudPhase.value = savedCloudPhase; atmosphere.sun.position.copy(savedSun);
    for (const b of document.querySelectorAll('#daylight button')) b.setAttribute('aria-pressed', String(b.dataset.time === settings.timeOfDay));
    dust.clear(); dust.update(0, rover, settings); app.post.invalidate(); await frame(); app.manual = manual;
  }
  if (failure) throw failure;
  return report;
}
