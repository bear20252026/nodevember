// Relax over-steep deposits into their neighbouring slopes. Operating on the
// heightfield (rather than adding fragment noise) changes both the silhouette
// and the terrain the rover collides with.
export function relaxTerrain(source, size, stepX, stepZ, iterations = 48) {
  let height = new Float32Array(source), next = new Float32Array(source.length);
  const offsets = new Int32Array(8), limits = new Float64Array(8), excess = new Float64Array(8);
  let minLimit = Infinity, count = 0;
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
    if (!x && !z) continue;
    const limit = Math.hypot(x * stepX, z * stepZ) * .58;
    offsets[count] = z * size + x;
    limits[count++] = limit;
    if (limit < minLimit) minLimit = limit;
  }
  let minHeight = Infinity;
  for (let i = 0; i < height.length; i++) if (height[i] < minHeight) minHeight = height[i];
  const threshold = minHeight + minLimit;
  for (let pass = 0; pass < iterations; pass++) {
    next.set(height);
    let changed = false;
    for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) {
      const i = z * size + x, h = height[i];
      if (h <= threshold) continue;
      let sum = 0, maximum = 0;
      for (let k = 0; k < 8; k++) {
        const amount = Math.max(0, h - height[i + offsets[k]] - limits[k]);
        excess[k] = amount; sum += amount;
        if (amount > maximum) maximum = amount;
      }
      if (sum === 0) continue;
      changed = true;
      const transfer = maximum * .42;
      next[i] -= transfer;
      for (let k = 0; k < 8; k++) next[i + offsets[k]] += transfer * excess[k] / sum;
    }
    [height, next] = [next, height];
    if (!changed) break;
  }
  // A small reconstruction filter removes isolated one-cell extrema without
  // rounding entire mountains. Bicubic sampling below then has C1 continuity.
  next.set(height);
  for (let z = 1; z < size - 1; z++) for (let x = 1; x < size - 1; x++) {
    const i = z * size + x;
    next[i] = height[i] * .5 + (height[i - 1] + height[i + 1] + height[i - size] + height[i + size]) * .125;
  }
  return next;
}

const cubic = (a, b, c, d, t) => b + .5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
const clampIndex = (i, max) => i < 0 ? 0 : i > max ? max : i;
export function sampleTerrain(height, size, x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), tx = x - ix, tz = z - iz, max = size - 1;
  const x0 = clampIndex(ix - 1, max), x1 = clampIndex(ix, max), x2 = clampIndex(ix + 1, max), x3 = clampIndex(ix + 2, max);
  const z0 = clampIndex(iz - 1, max) * size, z1 = clampIndex(iz, max) * size, z2 = clampIndex(iz + 1, max) * size, z3 = clampIndex(iz + 2, max) * size;
  return cubic(
    cubic(height[z0 + x0], height[z0 + x1], height[z0 + x2], height[z0 + x3], tx),
    cubic(height[z1 + x0], height[z1 + x1], height[z1 + x2], height[z1 + x3], tx),
    cubic(height[z2 + x0], height[z2 + x1], height[z2 + x2], height[z2 + x3], tx),
    cubic(height[z3 + x0], height[z3 + x1], height[z3 + x2], height[z3 + x3], tx),
    tz
  );
}
