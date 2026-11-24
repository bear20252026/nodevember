import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bakeCurvature } from '../curvature.js';

test('curvature distinguishes a flat surface, an exposed convex surface and a sheltered hollow', () => {
  const grid = bend => {
    const positions = [], normals = [], indices = [], n = 12;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const x = i / n * 2 - 1, z = j / n * 2 - 1;
      positions.push(x, bend * (x * x + z * z), z);
      const nx = -2 * bend * x, nz = -2 * bend * z, length = Math.hypot(nx, 1, nz);
      normals.push(nx / length, 1 / length, nz / length);
      if (i < n && j < n) { const a = j * (n + 1) + i; indices.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
    }
    return bakeCurvature(positions, indices, normals);
  };
  const plane = grid(0), convex = grid(-.5), hollow = grid(.5);
  assert(plane.every(v => Math.abs(v) < 1e-6));
  const center = 6 * 13 + 6;
  assert(convex[center] > .07, 'Exposed crest must have positive curvature');
  assert(hollow[center] < -.07, 'Hollow must have negative curvature');
  for (let i = 0; i < convex.length; i++) assert(Math.abs(convex[i] + hollow[i]) < 1e-6, 'Curvature signs must be symmetric');
});

test('curvature stays finite at zero-area triangles and isolated vertices', () => {
  const values = bakeCurvature([0,0,0, 1,0,0, 2,0,0, 3,0,0], [0,1,2], [0,1,0, 0,1,0, 0,1,0, 0,1,0]);
  assert(values.every(v => Number.isFinite(v) && v === 0));
});
