import { Vector3 } from 'three/webgpu';
import { createRoverModel } from './rover-model.js';
import { createRoverPhysics } from './rover-physics.js';
import { createWheelTracks } from './wheel-tracks.js';
import { createRoverInput } from './rover-input.js';
import { createRoverShadowTracker } from './rover-shadow.js';

export async function createRover(scene, canvas, landscape, architecture, changed) {
  const { obstacles, heightAt } = landscape;
  const physics = await createRoverPhysics(heightAt, obstacles, architecture.colliders);
  const shadow = createRoverShadowTracker(physics);
  // Opening composition: parked on the dune, facing the sanctuary from the
  // user's chosen driving view. Settle the suspension before the first frame.
  const spawn = physics.capture(); spawn.position = [-8.30445671, 1.17500556, 141.80295944];
  spawn.rotation = [.031036027, .116930626, -.088466167, -.988705099];
  spawn.velocity = spawn.angular = [0, 0, 0]; spawn.distance = 0; spawn.spins = [0, 0, 0, 0];
  physics.restore(spawn); for (let i = 0; i < 180; i++) physics.update(1 / 120);
  const tracks = createWheelTracks(scene, heightAt);
  tracks.seedApproach(physics.wheels, physics.yaw);
  const model = createRoverModel(), { group, legs } = model;
  scene.add(group);
  const position = new Vector3(), velocity = new Vector3();
  let active = false, yaw = 0, speed = 0, moving = false, shadowDirty = true;
  const input = createRoverInput(canvas, () => active, changed), { keys } = input;
  function pose() {
    position.fromArray(physics.position); position.y -= 1.1;
    velocity.fromArray(physics.velocity); yaw = physics.yaw;
    model.pose(physics);
  }
  function update(dt) {
    const { throttle, turn, boost } = input.sample();
    physics.update(dt, throttle, turn, boost);
    speed = physics.speed; moving = physics.recovering || speed > .015 || Math.abs(physics.velocity[1]) > .015 || !!throttle || !!turn;
    pose();
    if (physics.recovering) tracks.breakPaths(); else tracks.update(physics.wheels);
    if (moving) changed();
  }
  const cameraTarget = [0, 0, 0], cameraEye = [0, 0, 0];
  function clipCamera(eye, target) {
    // The same rock/terrain triangles that support the tires protect a small
    // camera sphere. Tall bounding ellipses caused false hits behind the rover.
    const limit = physics.cameraFraction(target.toArray(cameraTarget), eye.toArray(cameraEye));
    if (limit < 1) eye.lerpVectors(target, eye, Math.max(0, limit - .02 / Math.max(.01, eye.distanceTo(target))));
  }
  pose();
  return { group, position, velocity, keys, legs, physics, tracks, pose, update, clipCamera,
    capture() { return physics.capture(); },
    restore(state) { physics.restore(state); input.clear(); tracks.breakPaths(); speed = physics.speed; moving = speed > .015; shadowDirty = true; pose(); },
    get active() { return active; }, set active(value) { active = value; input.clear(); tracks.breakPaths(); moving = false; if (value) canvas.focus({ preventScroll: true }); },
    get moving() { return moving; }, get speed() { return speed; }, get yaw() { return yaw; },
    get shadowDirty() { return shadowDirty || shadow.dirty; }, markShadowRendered() { shadowDirty = false; shadow.markRendered(); },
    instances: model.instances,
    dispose() { input.dispose(); physics.dispose(); tracks.dispose(); scene.remove(group); model.dispose(); }
  };
}
