import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoverPhysics } from '../rover-physics.js';

const run = (p, seconds, throttle = 0, turn = 0) => { for (let i = 0; i < seconds * 120; i++) p.update(1 / 120, throttle, turn); };
test('Box3D supports the chassis, drives backward without a heading flip, and steers through tire forces', async () => {
  const p = await createRoverPhysics(() => 0);
  try {
    assert.equal(p.diagnostics.contacts, 4);
    assert.ok(Math.abs(p.position[1] - 1.045) < .02);
    const start = p.capture(); run(p, 2, -1);
    assert.ok(p.position[2] > start.position[2] + 6, 'S must reverse along +Z');
    assert.ok(Math.abs(p.yaw) < .01, 'Reversing must not turn the body');
    run(p, 2); assert.ok(p.speed < .03, 'Parking brake must stop the rover');
    p.restore(start); run(p, 2, 1, 1);
    assert.ok(p.yaw > .3 && p.position[0] < start.position[0] - 2, 'A should steer left while moving');
    assert.ok(p.wheels.filter(w => w.end < 0).every(w => w.angle > .1), 'Front wheels must visibly steer');
    assert.ok(p.wheels.every(w => Number.isFinite(w.spin)));
  } finally { p.dispose(); }
});

test('suspension settles on slopes, catches a falling chassis, and survives collision-patch rebasing', async () => {
  const p = await createRoverPhysics((x, z) => (z - 150) * .06);
  try {
    const dropped = p.capture(); dropped.position[1] += 3; p.restore(dropped); run(p, 4);
    assert.equal(p.diagnostics.contacts, 4);
    assert.ok(Math.abs(p.position[1] - ((p.position[2] - 150) * .06 + 1.045)) < .1);
    const start = p.capture(); run(p, 8, 1);
    assert.ok(start.position[2] - p.position[2] > 50);
    assert.ok(p.diagnostics.patch[1] < 120, 'Collision patch must follow the rover');
    assert.equal(p.diagnostics.contacts, 4);
    const far = p.capture(); far.position = [95000, (120000 - 150) * .06 + 1.05, 120000]; far.velocity = [0, 0, 0];
    p.restore(far); run(p, 2); assert.equal(p.diagnostics.contacts, 4);
    assert.ok(p.position.every(Number.isFinite));
  } finally { p.dispose(); }
});

test('the rigid chassis cannot drive through a rock collider', async () => {
  const p = await createRoverPhysics(() => 0, [{ x: 95, z: 140, rx: 5, rz: 3, top: 8 }]);
  try {
    run(p, 4, 1);
    assert.ok(p.position[2] > 142, `Passed through rock: ${p.position}`);
    assert.ok(p.position.every(Number.isFinite));
  } finally { p.dispose(); }
});

test('the tire envelope climbs a low stone and resumes sand contact', async () => {
  const positions = [-.5,0,-.5,.5,0,-.5,.5,1,-.5,-.5,1,-.5,-.5,0,.5,.5,0,.5,.5,1,.5,-.5,1,.5];
  const indices = [0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,0,1,5,0,5,4,3,7,6,3,6,2];
  const p = await createRoverPhysics(() => 0, [{ x: 94.07, z: 144, rx: .55, rz: .65, top: .28, positions, indices,
    matrix: [1.1,0,0,0,0,.28,0,0,0,0,1.3,0,94.07,0,144,1] }]);
  try {
    let stoneContacts = 0, lift = 0, compression = 0, leadingContact = false;
    for (let i = 0; i < 5 * 120; i++) {
      p.update(1 / 120, 1);
      stoneContacts += p.diagnostics.stoneContacts; lift = Math.max(lift, p.position[1] - 1.045);
      compression = Math.max(compression, ...p.wheels.map(w => .76 - w.length));
      if (p.wheels[0].contact && !p.wheels[0].sand && p.position[2] - .92 > 144.65) leadingContact = true;
      assert.ok(p.position.every(Number.isFinite));
    }
    assert.ok(stoneContacts > 10, 'Tires ignored the stone');
    assert.ok(leadingContact, 'Tire did not touch the leading edge before its center ray');
    assert.ok(lift > .08 && lift < .4, `Unexpected chassis lift: ${lift}`);
    assert.ok(compression > .10, 'Suspension did not articulate over the stone');
    assert.ok(p.position[2] < 138, 'Low stone blocked forward travel');
    assert.ok(p.wheels.every(w => w.contact && w.sand), 'Tires did not return to sand after crossing');
  } finally { p.dispose(); }
});
