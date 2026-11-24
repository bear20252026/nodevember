import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomSeed, noise, terrainHeight, canyonCenter, canyonWidth } from '../noise.js';

test('the same seed reproduces placements and distinct seeds differ', () => {
  const a = randomSeed(1515), b = randomSeed(1515), c = randomSeed(1516);
  for (let i = 0; i < 1000; i++) { const v = a(); assert.equal(v, b()); assert.notEqual(v, c()); assert.ok(v >= 0 && v < 1); }
});

test('noise is continuous across negative and positive lattice boundaries', () => {
  for (let i = -12; i <= 12; i++) {
    assert.ok(Math.abs(noise(i - 1e-5, 1.3, -7.2) - noise(i + 1e-5, 1.3, -7.2)) < 1e-5);
  }
});

test('near terrain is finite and continuous with bounded dune heights', () => {
  for (let z = -1470; z <= 430; z += 13) for (let x = -850; x <= 850; x += 13) {
    const y = terrainHeight(x, z);
    assert.ok(Number.isFinite(y) && y > -10 && y < 65);
    assert.ok(Math.abs(y - terrainHeight(x + .001, z)) < .01);
    assert.ok(Math.abs(y - terrainHeight(x, z + .001)) < .01);
  }
});

test('the valley remains open along the city approach', () => {
  for (let z = 150; z >= -950; z -= 10) {
    assert.ok(canyonWidth(z) > 70);
    assert.ok(Math.abs(canyonCenter(z)) < 28);
  }
});

test('the mirage basin stays level across the city approach', () => {
  let low = Infinity, high = -Infinity;
  for (let z = -600; z <= -170; z += 5) for (let across = -.4; across <= .4; across += .05) {
    const x = canyonCenter(z) + canyonWidth(z) * across;
    const height = terrainHeight(x, z);
    low = Math.min(low, height); high = Math.max(high, height);
  }
  assert.ok(high - low < .05, `Basin varies by ${high - low} m`);
});

test('the expanded landscape is finite and continuous out to two hundred kilometres', () => {
  for (let z = -200520; z <= 199480; z += 1733) for (let x = -200000; x <= 200000; x += 1757) {
    const height = terrainHeight(x, z);
    assert.ok(Number.isFinite(height) && height > -50 && height < 6500);
    assert.ok(Math.abs(height - terrainHeight(x + .001, z)) < .01);
  }
});

test('mountain erosion crests have continuous slopes instead of unresolved cusps', () => {
  // The old abs(noise) foothills passed height continuity but reversed their
  // slope within a single triangle, creating serrated highlights on ridges.
  const step = .1;
  for (let x = -6000; x < 0; x += 20) for (let z = -9000; z < -3500; z += 20) {
    const center = terrainHeight(x, z);
    for (const [dx, dz] of [[step, 0], [0, step]]) {
      const bend = Math.abs(terrainHeight(x - dx, z - dz) + terrainHeight(x + dx, z + dz) - 2 * center);
      assert.ok(bend < .002, `Unresolved mountain crest at ${x}, ${z}: ${bend}`);
    }
  }
});
