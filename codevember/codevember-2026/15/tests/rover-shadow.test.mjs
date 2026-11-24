import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoverShadowTracker } from '../rover-shadow.js';

test('parked rover shadows follow accumulated creep and suspension changes', () => {
  const physics = { position: [0, 1, 0], rotation: [0, 0, 0, 1],
    wheels: Array.from({ length: 4 }, () => ({ length: .6, angle: 0, spin: 0 })) };
  const shadow = createRoverShadowTracker(physics);
  assert.equal(shadow.dirty, true);
  shadow.markRendered(); assert.equal(shadow.dirty, false);
  // 4 mm/s, well below the previous 15 mm/s moving threshold. Individual
  // frames are tiny, but the reference must stay at the last shadow render.
  let refreshes = 0;
  for (let i = 0; i < 1800; i++) {
    physics.position[0] += .004 / 30;
    if (shadow.dirty) { refreshes++; shadow.markRendered(); }
  }
  assert.ok(refreshes > 200);
  shadow.markRendered(); physics.rotation[1] += .001;
  assert.equal(shadow.dirty, true);
  shadow.markRendered(); physics.wheels[2].length -= .002;
  assert.equal(shadow.dirty, true);
  shadow.markRendered(); physics.wheels[0].angle += .001;
  assert.equal(shadow.dirty, true);
  shadow.markRendered(); physics.wheels[1].spin += .001;
  assert.equal(shadow.dirty, true);
  shadow.markRendered(); assert.equal(shadow.dirty, false);
});
