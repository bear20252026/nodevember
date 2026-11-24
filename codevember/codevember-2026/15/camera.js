import { Vector3, Euler, Quaternion } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { terrainHeight, canyonCenter, canyonWidth, clamp } from './noise.js';

export function createCameraControls(camera, canvas, settings, changed) {
  const initialView = settings.view;
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06; controls.enablePan = false;
  controls.minDistance = 80; controls.maxDistance = 320;
  controls.minPolarAngle = Math.PI * .26; controls.maxPolarAngle = Math.PI * .485;
  controls.minAzimuthAngle = -.27; controls.maxAzimuthAngle = .48;
  controls.rotateSpeed = .35; controls.zoomSpeed = .6;
  const views = {
    Overlook: { eye: [65, 6, -125], target: [-12, 56, -380], min: 160, max: 740 },
    Dunes: { eye: [70, terrainHeight(70, -40) + 1.4, -40], target: [-12, 35, -380], min: 130, max: 500 },
    Sanctuary: { eye: [73, 61, -190], target: [-12, 101, -368], min: 65, max: 310 },
    Stone: { eye: [-15, terrainHeight(-8, 91) + 8, 76], target: [-8, terrainHeight(-8, 91) + 2, 91], min: 10, max: 45 },
    Outcrop: { eye: [28, terrainHeight(28, 100) + 5, 100], target: [48, terrainHeight(48, 68) + 7, 68], min: 15, max: 65 },
  };
  let rover = null;
  const roverTarget = new Vector3(), targetDelta = new Vector3(), chaseOffset = new Vector3(), axisY = new Vector3(0, 1, 0);
  let followRadius = 6.5, followHeight = 1.05;
  const motionEuler = new Euler(0, 0, 0, 'YXZ'), motionRotation = new Quaternion();
  let motionWeight = 0, motionSpeed = 0;
  function animateRoverCamera(dt, time) {
    const ease = 1 - Math.exp(-Math.min(dt, .1) * 4);
    const enabled = settings.drift && !settings.paused && !interacting;
    motionWeight += ((enabled ? 1 : 0) - motionWeight) * ease;
    motionSpeed += (Math.min(1, Math.abs(rover.speed) / 12) - motionSpeed) * ease;
    // Slow, irregular sway around the freshly computed chase rotation.
    // Never feed this into position, orbit radius or the collision sweep.
    // Idle breathing remains gentle; driving adds a little higher-frequency
    // vibration, eased independently of tire contacts and throttle changes.
    const pitch = Math.sin(time * .71) * .0015 + Math.sin(time * 1.13 + .8) * .0006
      + Math.sin(time * 5.3) * motionSpeed * .0014;
    const yaw = Math.sin(time * .53 + 1.7) * .0017 + Math.sin(time * .91) * .0005;
    const roll = Math.sin(time * .63 + 2.4) * .0007 + Math.sin(time * 3.7) * motionSpeed * .0005;
    const strength = motionWeight * 3;
    motionEuler.set(pitch * strength, yaw * strength, roll * strength);
    camera.quaternion.multiply(motionRotation.setFromEuler(motionEuler));
  }
  function rememberFollowDistance() {
    if (settings.view !== 'Rover') return;
    chaseOffset.subVectors(camera.position, controls.target);
    followRadius = Math.max(3, Math.hypot(chaseOffset.x, chaseOffset.z));
    followHeight = Math.max(.85, chaseOffset.y);
  }
  function showMode(driving) {
    document.body.classList.toggle('roving', driving);
    const hud = document.querySelector('#rover-hud'); if (hud) hud.hidden = !driving;
  }
  let interacting = false, following = false, quiet = 0, previous = 0;
  controls.addEventListener('start', () => { interacting = true; following = false; quiet = 0; });
  controls.addEventListener('end', () => { rememberFollowDistance(); interacting = false; quiet = 0; });
  controls.addEventListener('change', changed);
  function setView(name) {
    following = false; motionWeight = 0; motionSpeed = 0;
    if (name === 'Rover' && rover) {
      settings.view = 'Rover'; rover.active = true; showMode(true);
      controls.target.copy(rover.position).add(new Vector3(0, 1.1, 0));
      camera.position.set(0, 2.15, 6.5).applyAxisAngle(axisY, rover.yaw).add(rover.position);
      followRadius = 6.5; followHeight = 1.05; quiet = 0;
      controls.minDistance = 3; controls.maxDistance = 22; controls.minPolarAngle = Math.PI * .12; controls.maxPolarAngle = Math.PI * .49;
      controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
      camera.near = .25; camera.updateProjectionMatrix(); controls.update(); changed(); return;
    }
    if (rover) rover.active = false; showMode(false);
    const view = views[name] || views.Overlook;
    settings.view = name in views ? name : 'Overlook';
    camera.position.fromArray(view.eye); controls.target.fromArray(view.target);
    controls.minAzimuthAngle = -Infinity; controls.maxAzimuthAngle = Infinity;
    controls.minDistance = view.min; controls.maxDistance = view.max;
    controls.maxPolarAngle = settings.view === 'Stone' ? Math.PI * .485 : Math.PI * .58;
    controls.minPolarAngle = Math.PI * .26; camera.near = 2; camera.updateProjectionMatrix();
    controls.update(); quiet = 0; previous = 0; changed();
  }
  function reset() { setView(initialView); }
  function update(dt, time) {
    if (settings.view === 'Rover' && rover) {
      controls.update(); rover.update(dt); quiet += dt;
      roverTarget.copy(rover.position); roverTarget.y += 1.1;
      targetDelta.subVectors(roverTarget, controls.target);
      camera.position.add(targetDelta); controls.target.copy(roverTarget);
      if (interacting) rememberFollowDistance();
      // A turn starts a follow transition; stopping the rover must not cancel
      // its remaining ease. Manual orbiting takes ownership until driving resumes.
      if (!interacting && rover.moving) following = true;
      if (!interacting && quiet > .65 && following) {
        chaseOffset.subVectors(camera.position, controls.target);
        const angle = Math.atan2(chaseOffset.x, chaseOffset.z);
        const difference = Math.atan2(Math.sin(rover.yaw - angle), Math.cos(rover.yaw - angle));
        const settled = Math.abs(difference) < .0001;
        const heading = settled ? rover.yaw : angle + difference * (1 - Math.exp(-Math.min(dt, .1) * 3));
        // Interpolate around an arc. Cartesian lerp cuts the corner and would
        // progressively shorten the next frame's follow radius during turns.
        camera.position.set(Math.sin(heading) * followRadius, followHeight, Math.cos(heading) * followRadius).add(roverTarget);
        following = rover.moving || !settled;
        changed();
      }
      rover.clipCamera(camera.position, controls.target);
      camera.lookAt(controls.target); animateRoverCamera(dt, time); camera.updateMatrixWorld();
      const speed = document.querySelector('#rover-speed'); if (speed) speed.textContent = `${Math.round(rover.speed * 3.6)} KM/H`;
      return;
    }
    quiet += dt;
    if (settings.view === 'Overlook' && settings.drift && !settings.paused && !interacting && quiet > 3) {
      const delta = Math.sin(time * .045) * .055 - Math.sin(previous * .045) * .055;
      const relative = camera.position.clone().sub(controls.target); relative.applyAxisAngle(new Vector3(0, 1, 0), delta);
      camera.position.copy(controls.target).add(relative);
    }
    previous = time;
    controls.update();
    if (settings.view !== 'Stone' && settings.view !== 'Outcrop') {
      const center = canyonCenter(camera.position.z), width = canyonWidth(camera.position.z) - 32;
      camera.position.x = clamp(camera.position.x, center - width, center + width);
    }
    camera.position.y = Math.max(camera.position.y, terrainHeight(camera.position.x, camera.position.z) + 5);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
  }
  reset();
  return { controls, views, setView, reset, update,
    attachRover(value) { rover = value; reset(); },
    dispose() { controls.dispose(); } };
}
