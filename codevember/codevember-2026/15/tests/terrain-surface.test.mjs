import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relaxTerrain, sampleTerrain } from '../terrain-relaxation.js';
import { stitchTerrainEdge } from '../terrain-stitch.js';

test('talus relaxation spreads steep deposits without changing a flat bed', () => {
  const size = 65, flat = new Float32Array(size * size).fill(12);
  assert.deepEqual(relaxTerrain(flat, size, 1, 1), flat);
  const spike = new Float32Array(size * size); spike[32 * size + 32] = 200;
  const relaxed = relaxTerrain(spike, size, 1, 1);
  const mass = relaxed.reduce((sum, h) => sum + h, 0);
  assert.ok(Math.abs(mass - 200) < .001);
  assert.ok(Math.max(...relaxed) < 10 && relaxed.every(h => h >= 0));
  assert.ok(relaxed.filter(h => h > .01).length > 100);
  const sunken = new Float32Array(size * size).fill(-20); sunken[32 * size + 32] = 0;
  assert.ok(relaxTerrain(sunken, size, 1, 1)[32 * size + 32] < -10);
});

test('heightfield interpolation preserves a plane and continuous slopes at cell boundaries', () => {
  const size = 24, plane = Float32Array.from({ length: size * size }, (_, i) => (i % size) * 2 + Math.floor(i / size) * 3);
  for (let x = 2; x < size - 3; x += .23) assert.ok(Math.abs(sampleTerrain(plane, size, x, 7.4) - (x * 2 + 7.4 * 3)) < 1e-9);
  const relief = Float32Array.from(plane, (h, i) => h + Math.sin(i * .42) * 4);
  for (let x = 2; x < size - 3; x++) {
    const eps = 1e-5, at = sampleTerrain(relief, size, x, 7.4);
    const left = (at - sampleTerrain(relief, size, x - eps, 7.4)) / eps;
    const right = (sampleTerrain(relief, size, x + eps, 7.4) - at) / eps;
    assert.ok(Math.abs(left - right) < .001);
  }
});

test('terrain strips retain every boundary edge when resolutions increase or decrease', () => {
  for (const [a, b] of [[420, 128], [470, 128], [128, 256], [256, 512], [512, 256], [256, 192], [192, 192]]) {
    const inner = Array.from({ length: a + 1 }, (_, i) => i), outer = Array.from({ length: b + 1 }, (_, i) => a + 1 + i);
    const { triangles, bins } = stitchTerrainEdge(inner, outer), edges = new Map();
    const pos = i => i <= a ? [i / a, 0] : [(i - a - 1) / b, 1];
    let area = 0;
    for (let i = 0; i < triangles.length; i += 3) {
      const ids = triangles.slice(i, i + 3), [p, q, r] = ids.map(pos);
      const determinant = (q[0] - p[0]) * (r[1] - p[1]) - (r[0] - p[0]) * (q[1] - p[1]);
      assert.ok(determinant > 0); area += determinant / 2;
      for (const [u, v] of [[ids[0], ids[1]], [ids[1], ids[2]], [ids[2], ids[0]]]) {
        const key = `${Math.min(u, v)}/${Math.max(u, v)}`; edges.set(key, (edges.get(key) || 0) + 1);
      }
      for (const fraction of [.1, .5, .9]) {
        const u = p[0] * fraction + q[0] * (1 - fraction) * .4 + r[0] * (1 - fraction) * .6;
        assert.ok(bins[Math.min(b - 1, Math.floor(u * b))].some(t => t.every((id, k) => id === ids[k])));
      }
    }
    assert.ok(Math.abs(area - 1) < 1e-10);
    for (const edge of [inner, outer]) for (let i = 1; i < edge.length; i++) assert.equal(edges.get(`${edge[i - 1]}/${edge[i]}`), 1);
    assert.equal([...edges.values()].filter(n => n === 1).length, a + b + 2);
    assert.ok([...edges.values()].every(n => n === 1 || n === 2));
  }
});
