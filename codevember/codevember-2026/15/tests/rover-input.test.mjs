import { test } from 'node:test';
import assert from 'node:assert/strict';
import { joystickAxes } from '../rover-input.js';

test('the floating joystick has a quiet centre and progressive analogue travel', () => {
  assert.deepEqual(joystickAxes(0, 0), { x: 0, y: 0 });
  assert.deepEqual(joystickAxes(3, -3), { x: 0, y: 0 });
  const gentle = joystickAxes(0, -12), full = joystickAxes(0, -46);
  assert.ok(gentle.y < 0 && gentle.y > -.2);
  assert.equal(full.y, -1);
  assert.equal(joystickAxes(0, 46).y, 1);
});

test('diagonal and off-screen joystick drags retain direction without exceeding full input', () => {
  for (const [x, y] of [[46, -46], [10000, 3000], [-8000, -15000]]) {
    const axes = joystickAxes(x, y);
    assert.ok(Math.abs(Math.hypot(axes.x, axes.y) - 1) < 1e-12);
    assert.ok(Math.abs(axes.x / axes.y - x / y) < 1e-12);
  }
});
