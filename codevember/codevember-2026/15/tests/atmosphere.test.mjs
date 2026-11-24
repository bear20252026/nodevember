import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aerosolState, sunlightTransmission } from '../atmosphere-model.js';

test('regional dust increases shared aerosol extinction and reduces direct sunlight', () => {
  const clear = aerosolState({ turbidity: 4.8, mie: .008, dust: 0 });
  const dusty = aerosolState({ turbidity: 4.8, mie: .008, dust: 2 });
  assert.ok(Math.abs(dusty.turbidity - 7.2) < 1e-12);
  const direct = sunlightTransmission(.56, 1.8, clear.extinction);
  const hazy = sunlightTransmission(.56, 1.8, dusty.extinction);
  for (let i = 0; i < 3; i++) {
    assert.ok(dusty.extinction[i] > clear.extinction[i]);
    assert.ok(hazy[i] > 0 && hazy[i] < direct[i] && direct[i] < 1);
  }
  const low = sunlightTransmission(.08, 1.8, dusty.extinction);
  assert.ok(low.every((v, i) => v < hazy[i]));
  assert.ok(low[0] / low[2] > hazy[0] / hazy[2]);
  assert.deepEqual(sunlightTransmission(1, 0, [0, 0, 0]), [1, 1, 1]);
});
