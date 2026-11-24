import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecoveryMonitor } from '../rover-recovery.js';
import { createRoverPhysics } from '../rover-physics.js';

test('recovery ignores parking, slow progress, and a brief airborne roll', () => {
  const monitor = createRecoveryMonitor();
  const state = { position: [0, 1, 0], up: 1, speed: 0, verticalSpeed: 0, angularSpeed: 0, throttle: 0 };
  for (let i = 0; i < 900; i++) assert.equal(monitor.update(1 / 30, state), null);
  state.throttle = .8;
  for (let i = 0; i < 900; i++) { state.position[2] -= .01; assert.equal(monitor.update(1 / 30, state), null); }
  state.up = -1; state.verticalSpeed = -3;
  for (let i = 0; i < 30; i++) assert.equal(monitor.update(1 / 30, state), null);
  state.up = 1; state.verticalSpeed = 0; state.throttle = 0;
  for (let i = 0; i < 120; i++) assert.equal(monitor.update(1 / 30, state), null);
});

test('an upside-down rover smoothly rights itself and regains wheel contact', async () => {
  const p = await createRoverPhysics(() => 0);
  try {
    p.restore({ ...p.capture(), position: [95, .28, 150], rotation: [0, 0, 1, 0] });
    let recoveryFrames = 0, maximumStep = 0, last = [...p.position];
    for (let i = 0; i < 7 * 120; i++) {
      p.update(1 / 120); if (p.recovering) recoveryFrames++;
      maximumStep = Math.max(maximumStep, Math.hypot(...p.position.map((v, j) => v - last[j]))); last = [...p.position];
    }
    assert.equal(p.diagnostics.recoveries, 1);
    assert.equal(p.diagnostics.lastRecovery, 'tipped');
    assert.ok(recoveryFrames > 150, 'Recovery should be animated');
    assert.ok(maximumStep < .08, `Unexpected teleport: ${maximumStep}`);
    assert.equal(p.diagnostics.contacts, 4);
    assert.ok(p.rotation[0] ** 2 + p.rotation[2] ** 2 < .01);
  } finally { p.dispose(); }
});

test('holding the throttle against a boulder recovers onto clear ground', async () => {
  const p = await createRoverPhysics(() => 0, [{ x: 95, z: 140, rx: 5, rz: 3, top: 8 }]);
  try {
    let began = false;
    for (let i = 0; i < 10 * 120; i++) {
      p.update(1 / 120, began ? 0 : 1);
      began ||= p.recovering;
    }
    assert.equal(p.diagnostics.lastRecovery, 'stuck');
    assert.equal(p.diagnostics.recoveries, 1);
    assert.ok(p.position[2] > 145, `Did not back away from the wall: ${p.position}`);
    assert.equal(p.diagnostics.contacts, 4);
  } finally { p.dispose(); }
});

test('recovery respects an elevated stone landing instead of resetting to sand height', async () => {
  const landing = { x: 95, y: 49.5, z: 150, rx: 10, ry: .5, rz: 10,
    matrix: [20, 0, 0, 0, 0, 1, 0, 0, 0, 0, 20, 0, 95, 49.5, 150, 1] };
  const p = await createRoverPhysics(() => 0, [], [landing]);
  try {
    p.restore({ ...p.capture(), position: [95, 50.28, 150], rotation: [0, 0, 1, 0] });
    for (let i = 0; i < 7 * 120; i++) p.update(1 / 120);
    assert.equal(p.diagnostics.recoveries, 1);
    assert.equal(p.diagnostics.stoneContacts, 4);
    assert.ok(Math.abs(p.position[1] - 51.045) < .03, `Lost the elevated landing: ${p.position}`);
  } finally { p.dispose(); }
});
