import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRockCuts, carveRadius, erosionField } from '../rock-shaping.js';

test('a subtractive cut finds its analytic near boundary and leaves opposite rays alone', () => {
  const cuts = [{ x: 2, y: 0, z: 0, radius: 1.4, distanceSquared: 4 }];
  assert.ok(Math.abs(carveRadius(1, 0, 0, 1, cuts) - .6) < 1e-12);
  assert.equal(carveRadius(-1, 0, 0, 1, cuts), 1);
  assert.equal(carveRadius(0, 1, 0, 1, cuts), 1);
});

test('seeded cuts retain a positive, continuous surface in every direction', () => {
  for (let seed = 151; seed < 151 + 32 * 7919; seed += 7919) {
    const cuts = createRockCuts(seed, true, false);
    assert.deepEqual(cuts, createRockCuts(seed, true, false));
    for (const cut of cuts) assert.ok(Math.sqrt(cut.distanceSquared) > cut.radius);
    for (let i = 0; i < 1000; i++) {
      const a = i * 2.3999632297, y = 1 - 2 * (i + .5) / 1000, r = Math.sqrt(1 - y * y);
      const radius = carveRadius(Math.cos(a) * r, y, Math.sin(a) * r, 1, cuts);
      const nearby = carveRadius(Math.cos(a + 1e-5) * r, y, Math.sin(a + 1e-5) * r, 1, cuts);
      assert.ok(radius >= .32 && radius <= 1);
      assert.ok(Math.abs(radius - nearby) < .001);
    }
  }
});

test('erosion is finite, reproducible and continuous across the noise grid', () => {
  for (let i = -20; i <= 20; i++) {
    const value = erosionField(i, .2, 1.3, 151);
    assert.equal(value, erosionField(i, .2, 1.3, 151));
    assert.ok(value >= 0 && value < 1.5);
    assert.ok(Math.abs(value - erosionField(i + .00001, .2, 1.3, 151)) < .001);
  }
});
