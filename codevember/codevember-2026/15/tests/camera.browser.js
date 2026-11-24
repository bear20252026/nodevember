import { PerspectiveCamera, Vector3 } from 'three/webgpu';
import { createCameraControls } from '../camera.js';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Use the actual controls with a stationary rover after a brief turn. Keeping
// physics out of this check ensures a braking tail cannot hide the regression.
export function checkCameraEasing() {
  const camera = new PerspectiveCamera(52, 1, .25, 1000), canvas = document.createElement('canvas');
  const settings = { view: 'Overlook', paused: true, drift: false };
  const bodyClass = document.body.className, hint = document.querySelector('#hint'), hud = document.querySelector('#rover-hud');
  const ui = { hint: hint?.textContent, hidden: hud?.hidden };
  let changes = 0;
  const navigation = createCameraControls(camera, canvas, settings, () => { changes++; });
  const rover = { position: new Vector3(0, 0, 0), yaw: 0, moving: false, active: false, speed: 0, update() {}, clipCamera() {} };
  const angle = () => Math.atan2(camera.position.x - navigation.controls.target.x, camera.position.z - navigation.controls.target.z);
  const error = () => Math.abs(Math.atan2(Math.sin(rover.yaw - angle()), Math.cos(rover.yaw - angle())));
  const step = count => { for (let i = 0; i < count; i++) navigation.update(1 / 60, 0); };
  try {
    navigation.attachRover(rover); navigation.setView('Rover'); step(60);
    rover.moving = true; rover.yaw = 1; step(8);
    rover.moving = false;
    const releasedError = error(), followDistance = camera.position.distanceTo(navigation.controls.target), changesBefore = changes;
    step(30);
    const afterReleaseError = error();
    assert(afterReleaseError < releasedError * .3, 'Camera stopped easing when the rover stopped');
    assert(changes > changesBefore, 'Camera easing did not request rendering while paused');
    step(180);
    assert(error() < .0002, 'Camera did not finish aligning behind the rover');
    assert(Math.abs(camera.position.distanceTo(navigation.controls.target) - followDistance) < 1e-8, 'Camera shortened its follow distance');

    // Looking around a parked rover should remain under manual control.
    navigation.controls.dispatchEvent({ type: 'start' });
    camera.position.set(Math.sin(2) * 8, 1.4, Math.cos(2) * 8).add(navigation.controls.target);
    navigation.controls.update(); navigation.controls.dispatchEvent({ type: 'end' });
    const orbitAngle = angle(); step(180);
    assert(Math.abs(angle() - orbitAngle) < 1e-8, 'Stationary manual orbit was pulled behind the rover');
    const orbitDistance = camera.position.distanceTo(navigation.controls.target);
    rover.moving = true; step(8); rover.moving = false; step(240);
    assert(error() < .0002, 'Driving did not resume camera follow');
    assert(Math.abs(camera.position.distanceTo(navigation.controls.target) - orbitDistance) < 1e-8, 'Manual follow distance was lost');
    return { releasedError, afterReleaseError, finalError: error(), followDistance, orbitDistance, stationaryOrbitPreserved: true, pausedRenderingRequested: true };
  } finally {
    navigation.dispose(); document.body.className = bodyClass;
    if (hint) hint.textContent = ui.hint; if (hud) hud.hidden = ui.hidden;
  }
}

// This route previously moved the camera 5.6 m in one frame as a rear tire
// crossed rubble. The old ellipse/top-height test hit empty space above rock.
export async function checkRubbleCamera(app = window.mirage) {
  const { rover, camera, navigation, settings, landscape } = app;
  const saved = { ...settings }, state = rover.capture(), manual = app.manual;
  const eye = camera.position.clone(), target = navigation.controls.target.clone();
  app.manual = true; settings.paused = true; settings.drift = false;
  const report = { rearContactFrames: 0, maximumRelativeStep: 0, maximumWorldStep: 0, minimumDistance: Infinity, maximumQueryMs: 0 };
  try {
    // Select the rendered rubble by location and size, not an instance index
    // that changes when the sanctuary's foundation gains another stone.
    const rock = landscape.obstacles.filter(o => o.variant === 14 && o.rx < 1 && o.rz < 1
      && o.x > 30 && o.x < 65 && o.z > 80 && o.z < 105 && o.top - landscape.heightAt(o.x, o.z) > .2)
      .sort((a, b) => Math.hypot(a.x - 48, a.z - 86) - Math.hypot(b.x - 48, b.z - 86))[0];
    assert(rock, 'The rubble camera route has no small rendered boulder');
    const x = rock.x + .93, z = rock.z + 6;
    rover.restore({ ...state, position: [x, landscape.heightAt(x, z) + 1.05, z], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angular: [0, 0, 0], steering: 0 });
    for (let i = 0; i < 120; i++) rover.update(1 / 120);
    navigation.setView('Rover'); for (let i = 0; i < 60; i++) navigation.update(1 / 60, 0);
    const previousEye = camera.position.clone(), previousOffset = camera.position.clone().sub(navigation.controls.target), offset = new Vector3();
    rover.keys.add('KeyW');
    for (let i = 0; i < 300; i++) {
      navigation.update(1 / 60, 0);
      offset.subVectors(camera.position, navigation.controls.target);
      if (rover.physics.wheels.some(w => w.end > 0 && w.contact && !w.sand
        && Math.hypot(w.point[0] - rock.x, w.point[2] - rock.z) < 2)) report.rearContactFrames++;
      report.maximumRelativeStep = Math.max(report.maximumRelativeStep, offset.distanceTo(previousOffset));
      report.maximumWorldStep = Math.max(report.maximumWorldStep, camera.position.distanceTo(previousEye));
      report.minimumDistance = Math.min(report.minimumDistance, offset.length());
      previousEye.copy(camera.position); previousOffset.copy(offset);
      // End beyond this stone. Continuing into the large outcrop tests real
      // camera obstruction, which is expected to shorten the boom.
      if (report.rearContactFrames > 10 && rover.position.z < rock.z - 4) break;
    }
    rover.keys.clear();
    assert(report.rearContactFrames > 10, 'Camera regression did not cross a rock with the rear tires');
    assert(report.maximumRelativeStep < .2, `Rear tire contact caused a camera jump: ${report.maximumRelativeStep} m`);
    assert(report.minimumDistance > 6.3, `Rubble incorrectly shortened the camera boom to ${report.minimumDistance} m`);

    // Keep real occlusion protection. This ray goes through the large seeded
    // boulder, while the open-space ray behind the rover must remain clear.
    rover.restore({ ...state, position: [-8, landscape.heightAt(-8, 109) + 1.05, 109], rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angular: [0, 0, 0], steering: 0 });
    for (let i = 0; i < 120; i++) rover.update(1 / 120);
    const origin = [...rover.physics.position];
    const start = performance.now();
    const blocked = rover.physics.cameraFraction(origin, [origin[0], origin[1], origin[2] - 22]);
    report.maximumQueryMs = performance.now() - start;
    const clear = rover.physics.cameraFraction(origin, [origin[0], origin[1] + 1.05, origin[2] + 6.5]);
    assert(blocked > 0 && blocked < .8, 'Camera sphere passed through the large boulder');
    assert(clear === 1, 'Open camera path was clipped');
    report.obstructionFraction = blocked; report.openFraction = clear;
    return report;
  } finally {
    rover.keys.clear(); rover.restore(state); Object.assign(settings, saved); navigation.setView(saved.view);
    camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    app.post.invalidate(); await new Promise(requestAnimationFrame); app.render(); app.manual = manual;
  }
}

export function checkCameraMotion() {
  const camera = new PerspectiveCamera(52, 1, .25, 1000), canvas = document.createElement('canvas');
  const settings = { view: 'Rover', paused: false, drift: true };
  const bodyClass = document.body.className, hud = document.querySelector('#rover-hud'), hidden = hud?.hidden;
  const navigation = createCameraControls(camera, canvas, settings, () => {});
  const rover = { position: new Vector3(), yaw: 0, moving: false, active: false, speed: 0, update() {}, clipCamera() {} };
  const baseline = camera.clone(); let time = 0, maximumAngle = 0, maximumStep = 0;
  try {
    navigation.attachRover(rover); navigation.setView('Rover');
    const eye = camera.position.clone(), radius = eye.distanceTo(navigation.controls.target);
    let previous = camera.quaternion.clone();
    const step = () => {
      time += 1 / 60; navigation.update(1 / 60, time);
      baseline.position.copy(camera.position); baseline.lookAt(navigation.controls.target);
      maximumAngle = Math.max(maximumAngle, baseline.quaternion.angleTo(camera.quaternion));
      maximumStep = Math.max(maximumStep, previous.angleTo(camera.quaternion)); previous.copy(camera.quaternion);
      assert(Math.abs(camera.position.distanceTo(navigation.controls.target) - radius) < 1e-8, 'Camera sway changed chase distance');
    };
    for (let i = 0; i < 1800; i++) step();
    assert(maximumAngle > .006 && maximumAngle < .012, 'Idle camera movement is absent or excessive');
    assert(camera.position.distanceTo(eye) < 1e-8, 'Sway accumulated into the camera position');
    rover.speed = 12; rover.moving = true; for (let i = 0; i < 600; i++) step();
    assert(maximumAngle < .016 && maximumStep < .001, 'Driving vibration jumps or shakes too strongly');
    settings.drift = false; for (let i = 0; i < 300; i++) step();
    assert(baseline.quaternion.angleTo(camera.quaternion) < 1e-6, 'Reduced-motion setting did not disable sway');
    return { maximumAngleDegrees: maximumAngle * 180 / Math.PI, maximumFrameStepDegrees: maximumStep * 180 / Math.PI, radius, noPositionalDrift: true, reducedMotionRespected: true };
  } finally {
    navigation.dispose(); document.body.className = bodyClass; if (hud) hud.hidden = hidden;
  }
}
