import { relaxTerrain, sampleTerrain } from './terrain-relaxation.js';

export function randomSeed(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash(x, y, z) {
  let h = Math.imul(x, 1597334677) ^ Math.imul(y, 3812015801) ^ Math.imul(z, 2798796415);
  h = Math.imul(h ^ h >>> 16, 2246822519);
  return ((h ^ h >>> 13) >>> 0) / 4294967295;
}
const mix = (p, q, t) => p + (q - p) * t;
export function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  let a = x - ix, c = z - iz;
  a = a * a * (3 - 2 * a); c = c * c * (3 - 2 * c);
  const x00 = mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), a);
  const x01 = mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), a);
  if (y === iy) return mix(x00, x01, c) * 2 - 1;
  let b = y - iy; b = b * b * (3 - 2 * b);
  const x10 = mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), a);
  const x11 = mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), a);
  return mix(mix(x00, x10, b), mix(x01, x11, b), c) * 2 - 1;
}
export function fbm(x, y, z, octaves = 4) {
  let v = 0, a = .5;
  for (let i = 0; i < octaves; i++) { v += noise(x, y, z) * a; x = x * 2.03 + 13.1; y = y * 2.03 + 7.7; z = z * 2.03 + 5.3; a *= .5; }
  return v;
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// Broad connected mountain chains, separated by dry plains. Values are in
// metres; the furthest chain is almost 180 km beyond the sanctuary.
export const mountainRanges = [
  [-4000, -6500, 5000, 4200, 1400],
  [5200, -10400, 6200, 5000, 1700],
  [-13000, -23000, 7500, 14000, 2100],
  [18000, -39000, 11000, 20000, 3200],
  [-38000, -68000, 17000, 26000, 4400],
  [4000, -95000, 18000, 22000, 3900],
  [53000, -122000, 24000, 32000, 5200],
  [-69000, -154000, 31000, 29000, 5800],
  [0, -179000, 35000, 23000, 4800]
];

// Triangular-lattice gradient noise avoids the rectangular ridges produced
// by taking the absolute value of a square-grid value-noise field.
const mountainGradients = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
function mountainCorner(a, b, u, v, seed) {
  const falloff = .5 - u * u - v * v;
  if (falloff <= 0) return 0;
  const g = mountainGradients[Math.min(7, Math.floor(hash(a, seed, b) * 8))], f2 = falloff * falloff;
  return f2 * f2 * (g[0] * u + g[1] * v);
}
function mountainNoise(x, z, seed) {
  const skew = (x + z) * .3660254037844386, i = Math.floor(x + skew), j = Math.floor(z + skew);
  const unskew = (i + j) * .21132486540518713, dx = x - i + unskew, dz = z - j + unskew;
  const ix = dx > dz ? 1 : 0, iz = 1 - ix;
  return clamp(70 * (mountainCorner(i, j, dx, dz, seed)
    + mountainCorner(i + ix, j + iz, dx - ix + .21132486540518713, dz - iz + .21132486540518713, seed)
    + mountainCorner(i + 1, j + 1, dx - .5773502691896257, dz - .5773502691896257, seed)), -1, 1);
}
// A rounded absolute value keeps ridge slopes continuous. In particular,
// no cusp can flip a normal between two coarse terrain-ring samples.
const ridge = value => (1 - Math.sqrt(value * value + .012)) ** 2;
const rangeFields = new Array(mountainRanges.length).fill(null), RANGE_SIZE = 257;
function rangeField(range) {
  const cached = rangeFields[range];
  if (cached !== null) return cached;
  const [, , rx, rz, height] = mountainRanges[range];
  const field = new Float32Array(RANGE_SIZE * RANGE_SIZE), seed = 137 + range * 23;
  // Connected, branching drainage divides rather than products of periodic
  // dune waves. Broad saddles join the peaks; smaller relief follows the same
  // parent ridge instead of growing independent cones on its slopes.
  for (let z = 0; z < RANGE_SIZE; z++) for (let x = 0; x < RANGE_SIZE; x++) {
    const dx = x / (RANGE_SIZE - 1) * 4 - 2, dz = z / (RANGE_SIZE - 1) * 4 - 2;
    const radius2 = dx * dx + dz * dz;
    const wx = dx + mountainNoise(dx * 1.3, dz * 1.3, seed) * .16;
    const wz = dz + mountainNoise(dx * 1.1, dz * 1.1, seed + 7) * .13;
    const u = wx * 3.4 + wz * 1.1, v = wz * 2.7 - wx * .6;
    const spine = ridge(mountainNoise(u, v, seed + 11));
    const foothill = ridge(mountainNoise(u * 2.07 + 17, v * 2.07 - 9, seed + 29));
    const folded = ridge(mountainNoise(u * 4.13 - 5, v * 4.13 + 23, seed + 47));
    const relief = .06 + spine * .66 + spine * foothill * .32 + spine * foothill * folded * .12;
    const envelope = Math.exp(-radius2 * 1.25);
    const edge = (1 - smoothstep(1.65, 2, Math.abs(dx))) * (1 - smoothstep(1.65, 2, Math.abs(dz)));
    field[z * RANGE_SIZE + x] = envelope * relief * height * 1.35 * edge;
  }
  const relaxed = relaxTerrain(field, RANGE_SIZE, 4 * rx / (RANGE_SIZE - 1), 4 * rz / (RANGE_SIZE - 1));
  rangeFields[range] = relaxed; return relaxed;
}
function mountainHeight(x, z) {
  if (z > -1800) return 0;
  let sum4 = 0;
  for (let range = 0; range < mountainRanges.length; range++) {
    const r = mountainRanges[range];
    const dx = (x - r[0]) / r[2];
    if (dx <= -2 || dx >= 2) continue;
    const dz = (z - r[1]) / r[3];
    if (dz <= -2 || dz >= 2) continue;
    const h = sampleTerrain(rangeField(range), RANGE_SIZE, (dx + 2) * .25 * (RANGE_SIZE - 1), (dz + 2) * .25 * (RANGE_SIZE - 1));
    // Smooth union preserves a continuous grade where neighbouring ranges
    // meet, instead of leaving a crease through the saddle.
    const h2 = h * h;
    sum4 += h2 * h2;
  }
  return sum4 > 0 ? smoothstep(1800, 5400, -z) * Math.sqrt(Math.sqrt(sum4)) : 0;
}

export function terrainHeight(x, z) {
  const uplands = mountainHeight(x, z);
  const exposedRock = uplands <= 120 ? 0 : uplands >= 450 ? 1 : smoothstep(120, 450, uplands);
  if (exposedRock === 1) return uplands;
  // A dry, almost level basin carries the inverted image beneath the city.
  const width = canyonWidth(z), offset = Math.abs(x - canyonCenter(z));
  let basin = 0;
  if (z > -1050 && z < 130 && offset < width * .9) {
    basin = (1 - smoothstep(width * .57, width * .9, offset)) * smoothstep(-1050, -750, z) * (1 - smoothstep(35, 130, z));
    if (basin === 1) return -1.4 + noise(x * .035, 29, z * .035) * .025 + uplands;
  }
  // Windward ramps climb slowly toward a sinuous crest; the short lee side
  // falls at the angle of repose. Broad wavelengths keep whole dune faces
  // readable at the sanctuary's scale instead of becoming small rolling bumps.
  const warp = noise(x * .0025, 3, z * .003) * 90 + Math.sin(z * .009) * 24;
  // Broader sand seas in the distance stay resolved by the terrain rings;
  // retaining the near basin's 270 m dunes there produced faceted ripples.
  const r2 = x * x + z * z;
  const wavelength = r2 <= 1500 * 1500 ? 270 : r2 >= 7000 * 7000 ? 1000 : 270 + 730 * smoothstep(1500, 7000, Math.sqrt(r2));
  const cycle = (x + z * .58 + warp) / wavelength;
  const phase = cycle - Math.floor(cycle), crest = .77;
  const ramp = phase < crest ? smoothstep(0, crest, phase) : 1 - smoothstep(crest, 1, phase);
  const dunes = ramp * (32 + 10 * noise(x * .0015, 4, z * .0017));
  const shoulder = smoothstep(width - 30, width + 16, offset);
  const talus = shoulder > 0 ? shoulder * (12 + noise(z * .017, 23, x * .009) * 5) : 0;
  const sculpted = dunes + fbm(x * .009, 17, z * .009, 3) * 1.5 - 3.5 + talus;
  const floor = basin > 0 ? (-1.4 + noise(x * .035, 29, z * .035) * .025) * basin : 0;
  return sculpted * (1 - basin) * (1 - exposedRock) + floor + uplands;
}

export function canyonCenter(z) { return Math.sin(z * .007) * 21 + Math.sin(z * .019) * 5; }
export function canyonWidth(z) { return 150 + Math.max(0, -z) * .09 + Math.exp(-Math.pow((z + 220) / 400, 2)) * 95; }
