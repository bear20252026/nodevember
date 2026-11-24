import { test } from 'node:test';
import assert from 'node:assert/strict';
import { miragePlaneHeight, groundHeatAt } from '../mirage-conditions.js';
import { terrainHeight } from '../noise.js';

test('the basin mirage plane stays below the surrounding dune viewpoints', () => {
  for (const [x, z] of [[0, -140], [93, 194], [81, 153], [180, -250], [-190, -400]]) {
    assert.ok(Math.abs(miragePlaneHeight(x, z) + 1.32) < 1e-9);
  }
  assert.ok(terrainHeight(93, 194) > 25, 'Probe must lie on a raised dune');
  assert.equal(miragePlaneHeight(5000, -5000), terrainHeight(5000, -5000) + .08);
  for (let x = -1000; x <= 1000; x += 10) for (let z = -2000; z <= 1000; z += 20) {
    assert.ok(Math.abs(miragePlaneHeight(x + .001, z) - miragePlaneHeight(x, z)) < .01);
    assert.ok(Math.abs(miragePlaneHeight(x, z + .001) - miragePlaneHeight(x, z)) < .01);
  }
});

test('hot-ground visibility survives low sun and fades continuously to zero at night', () => {
  assert.equal(groundHeatAt(-.1), 0);
  assert.equal(groundHeatAt(0), 0);
  assert.ok(groundHeatAt(.001) < .001);
  assert.ok(groundHeatAt(Math.sin(8 * Math.PI / 180)) > .65);
  assert.equal(groundHeatAt(Math.sin(16 * Math.PI / 180)), 1);
  assert.equal(groundHeatAt(.56), 1);
});
