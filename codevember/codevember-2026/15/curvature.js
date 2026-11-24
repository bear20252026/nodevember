// Signed mean curvature from the cotangent Laplacian of a welded triangle
// surface. Positive = convex/exposed, negative = concave/sheltered. This is
// baked once; the shader only interpolates one scalar through the meshlets.
export function bakeCurvature(positions, indices, normals) {
  const count = positions.length / 3;
  const area = new Float64Array(count), laplacian = new Float64Array(positions.length);
  const p = (i, axis) => positions[i * 3 + axis];
  function edge(a, b, weight) {
    for (let axis = 0; axis < 3; axis++) {
      const value = (p(a, axis) - p(b, axis)) * weight;
      laplacian[a * 3 + axis] += value; laplacian[b * 3 + axis] -= value;
    }
  }
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    const ux = p(b, 0) - p(a, 0), uy = p(b, 1) - p(a, 1), uz = p(b, 2) - p(a, 2);
    const vx = p(c, 0) - p(a, 0), vy = p(c, 1) - p(a, 1), vz = p(c, 2) - p(a, 2);
    const cross = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (cross < 1e-14) continue;
    const uv = ux * vx + uy * vy + uz * vz;
    edge(b, c, uv / cross);
    edge(a, c, (ux * ux + uy * uy + uz * uz - uv) / cross);
    edge(a, b, (vx * vx + vy * vy + vz * vz - uv) / cross);
    area[a] += cross / 6; area[b] += cross / 6; area[c] += cross / 6;
  }
  let values = new Float64Array(count), next = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const j = i * 3;
    values[i] = (laplacian[j] * normals[j] + laplacian[j + 1] * normals[j + 1] + laplacian[j + 2] * normals[j + 2]) / Math.max(1e-14, area[i] * 4);
  }
  // Area-weighted smoothing suppresses tessellation and individual grain
  // noise, retaining the wider lips of fractures and recessed sediment beds.
  const weight = new Float64Array(count);
  for (let pass = 0; pass < 5; pass++) {
    next.fill(0); weight.fill(0);
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i], b = indices[i + 1], c = indices[i + 2];
      next[a] += values[b] * area[b] + values[c] * area[c]; weight[a] += area[b] + area[c];
      next[b] += values[a] * area[a] + values[c] * area[c]; weight[b] += area[a] + area[c];
      next[c] += values[a] * area[a] + values[b] * area[b]; weight[c] += area[a] + area[b];
    }
    for (let i = 0; i < count; i++) next[i] = values[i] * .4 + (weight[i] > 0 ? next[i] / weight[i] : values[i]) * .6;
    [values, next] = [next, values];
  }
  return Float32Array.from(values, value => { const k = value * .12; return k / (1 + Math.abs(k)); });
}
