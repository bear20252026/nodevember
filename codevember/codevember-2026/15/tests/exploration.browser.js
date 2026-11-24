import { Vector3, Raycaster, DataUtils } from 'three/webgpu';
import { cathedral } from '../world-layout.js';
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export async function checkExploration(app = window.mirage) {
  const { rover, navigation, camera, landscape, settings, renderer } = app;
  const saved = { ...settings }, manual = app.manual, roverState = rover.capture();
  const eye = camera.position.clone(), target = navigation.controls.target.clone();
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await renderer.backend.device.queue.onSubmittedWorkDone(); };
  const report = { mirage: [] };
  app.manual = true; settings.drift = false;
  try {
    // Probe the rendered shelf under the terrace edges, wing walls and outer
    // parapet columns. These were left suspended by the tapered island rocks.
    landscape.bedrock.updateMatrixWorld(true);
    const ray = new Raycaster(), support = [];
    for (const side of [-1, 1]) for (const [x, z, bottom] of [
      [24, 54, 35.84], [46, 52, 35.84], [54, -12, 46.46],
      [56.05, 32.45, 50], [54.87, 25.96, 50],
      [68, 0, 50], [86, -28, 50], [94.4, -47, 48.82], [94.4, 1.18, 48.82]
    ]) {
      ray.set(new Vector3(cathedral.x + side * x, 100, cathedral.z + z), new Vector3(0, -1, 0));
      const hit = ray.intersectObject(landscape.bedrock, false)[0];
      assert(hit && hit.point.y >= bottom, `Unsupported sanctuary foundation at ${side * x}, ${z}`);
      support.push({ x: side * x, z, overlap: hit.point.y - bottom });
    }
    report.foundation = { supported: true, probes: support };
    navigation.setView('Rover');
    assert(settings.view === 'Rover' && rover.active, 'Rover mode did not activate');
    assert(camera.position.distanceTo(navigation.controls.target) > 3, 'Camera is not third person');
    const before = rover.position.clone();
    const canvas = document.querySelector('canvas');
    canvas.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', bubbles: true, cancelable: true }));
    for (let i = 0; i < 100; i++) app.advance(.025);
    canvas.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true }));
    for (let i = 0; i < 80; i++) app.advance(.025);
    const travelled = rover.position.distanceTo(before);
    assert(travelled > 10 && travelled < 40, `Unexpected rover travel: ${travelled}`);
    assert(rover.speed < .03, 'Rover does not stop after releasing controls');
    assert(rover.physics.diagnostics.contacts === 4, 'Suspension lost ground contact');
    const point = new Vector3(); let contactError = 0;
    for (let i = 0; i < rover.legs.length; i++) {
      rover.legs[i].wheel.getWorldPosition(point);
      contactError = Math.max(contactError, Math.abs(point.distanceTo(new Vector3().fromArray(rover.physics.wheels[i].point)) - .385));
    }
    assert(contactError < .002, `Wheel contact error: ${contactError}`);
    // Physics and rendering must agree even when the global meshlet LOD is
    // coarse. A large terrain's sphere center is far from these contacts.
    for (const ground of [landscape.ground, ...landscape.distanceTerrain]) {
      assert(app.meshlets._getClusters(ground.geometry).lodCount === 1, 'Terrain simplification can separate wheels from the visible ground');
    }
    assert(rover.tracks.count > 50, 'Driving must leave tracks in the sand');
    assert(getComputedStyle(canvas).outlineStyle === 'none', 'Focused canvas must stay unframed');
    assert(camera.position.distanceTo(navigation.controls.target) > 1, 'Follow camera collapsed');
    report.rover = { travelled, stopped: rover.speed < .03, contactError, cameraDistance: camera.position.distanceTo(navigation.controls.target) };
    const reverseStart = rover.capture(), reversePosition = rover.position.clone(), reverseYaw = rover.yaw;
    rover.keys.add('KeyS'); for (let i = 0; i < 160; i++) app.advance(.025); rover.keys.clear();
    assert(Math.abs(Math.atan2(Math.sin(rover.yaw - reverseYaw), Math.cos(rover.yaw - reverseYaw))) < .08, 'Reverse flipped the rover heading');
    assert(rover.position.z > reversePosition.z + 5, 'S did not reverse');
    rover.restore(reverseStart); rover.keys.add('KeyW'); rover.keys.add('KeyA');
    for (let i = 0; i < 100; i++) app.advance(.025); rover.keys.clear();
    assert(rover.yaw > reverseYaw + .3, 'Steering did not turn the chassis');
    assert(rover.legs.filter(l => l.end < 0).every(l => l.wheel.rotation.y > .1), 'Front wheels did not steer');
    const behind = camera.position.clone().sub(navigation.controls.target).normalize();
    const heading = new Vector3(Math.sin(rover.yaw), 0, Math.cos(rover.yaw));
    assert(behind.dot(heading) > .8, 'Chase camera did not follow behind the turn');
    const turningDistance = camera.position.distanceTo(navigation.controls.target);
    assert(turningDistance > 6.3 && turningDistance < 6.9, `Chase distance drifted during a turn: ${turningDistance}`);
    for (let i = 0; i < 80; i++) app.advance(.025);
    const stoppedDistance = camera.position.distanceTo(navigation.controls.target);
    assert(stoppedDistance > 6.3 && stoppedDistance < 6.9, `Chase camera stayed too close after stopping: ${stoppedDistance}`);
    report.rover.turningCameraDistance = turningDistance; report.rover.stoppedCameraDistance = stoppedDistance;
    report.rover.tracks = rover.tracks.count;
    assert(app.atmosphere.sun.shadow.mapSize.x === 4096, 'SunLight lost high-resolution cascades');
    await frame();
    assert(app.atmosphere.sun.shadow._cascadeSplits[1] < 50, 'Near rover cascade is too broad');
    const drivingState = rover.capture();
    rover.physics.restore({ ...drivingState, position: [-12, 2, -192], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angular: [0, 0, 0], steering: 0 });
    for (let i = 0; i < 25 * 120; i++) rover.physics.update(1 / 120, 1);
    assert(rover.physics.position[1] > 45 && rover.physics.position[2] < -330, 'Sanctuary stairs do not support the rover');
    report.stairs = { reachedTerrace: true, position: [...rover.physics.position] };
    rover.restore(drivingState);
    // Verify contact against actual far-ring vertices, not only the analytic field.
    let farError = 0;
    for (const mesh of landscape.distanceTerrain) {
      const p = mesh.geometry.attributes.position;
      const used = [...new Set(mesh.geometry.index.array)];
      for (let j = 120; j < used.length; j += 251) {
        const i = used[j];
        farError = Math.max(farError, Math.abs(landscape.heightAt(p.getX(i), p.getZ(i)) - p.getY(i)));
      }
    }
    // Stitched ring edges reuse the preceding mesh boundary exactly.
    assert(farError <= .025, `Far terrain contact mismatch: ${farError}`);
    report.farTerrainError = farError;
    navigation.setView('Dunes'); settings.ssgi = false; settings.heat = 0;
    camera.position.set(0, landscape.heightAt(0, -140) + 1.2, -140);
    let mirageFloor;
    for (const heading of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      camera.lookAt(Math.sin(heading) * 600, camera.position.y, -140 - Math.cos(heading) * 600);
      settings.mirage = 0; await frame();
      const rt = app.post.mirageImage.renderTarget;
      const a = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
      settings.mirage = 1; await frame();
      const reflection = app.post.reflectedScene;
      assert(reflection.reflection.reflector.hasOutput, 'Reflector did not render');
      assert(Math.abs(reflection.virtual.projectionMatrix.elements[6]) > .01, 'Reflector lost its oblique clipping plane');
      const b = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
      let changed = 0;
      for (let i = 0; i < a.length; i += 32) {
        const x = DataUtils.fromHalfFloat(a[i]), y = DataUtils.fromHalfFloat(b[i]);
        assert(Number.isFinite(x + y), 'Mirage produced invalid radiance');
        if (Math.abs(x - y) > .001) changed++;
      }
      const floor = app.post.mirageFrame.floor.value;
      assert(Number.isFinite(floor), 'Invalid mirage plane');
      if (mirageFloor === undefined) mirageFloor = floor;
      assert(Math.abs(floor - mirageFloor) < 1e-9, 'Turning the camera moved the mirage plane');
      assert(changed > 30, `Mirage absent at heading ${heading}`);
      report.mirage.push({ heading, changedSamples: changed, floor });
    }
  } finally {
    rover.restore(roverState); Object.assign(settings, saved); navigation.setView(saved.view);
    camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    app.post.invalidate(); await frame(); app.manual = manual;
  }
  return report;
}
