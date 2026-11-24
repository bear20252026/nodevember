// The tone mappings of three.js (neutral, agx), in JS, and their inverse: the
// scene is rendered in linear light, then tone mapped as a whole (see main.js).
// The paper behind and the fog are tone mapped with it; to come out the very
// color the style asks for, they are given the color that maps to it.

const neutral = ([r, g, b]) => {
  const start = 0.8 - 0.04, desat = 0.15;
  const x = Math.min(r, g, b);
  const offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
  let c = [r - offset, g - offset, b - offset];
  const peak = Math.max(...c);
  if (peak < start) return c;
  const d = 1 - start;
  const newPeak = 1 - (d * d) / (peak + d - start);
  c = c.map((v) => (v * newPeak) / peak);
  const k = 1 - 1 / (desat * (peak - newPeak) + 1);
  return c.map((v) => v + (newPeak - v) * k);
};

// GLSL mat3 are column major: m * v = col0 * v.x + col1 * v.y + col2 * v.z
const mul = (m, v) => [0, 1, 2].map((i) => m[0][i] * v[0] + m[1][i] * v[1] + m[2][i] * v[2]);
const SRGB_TO_2020 = [[0.6274, 0.0691, 0.0164], [0.3293, 0.9195, 0.088], [0.0433, 0.0113, 0.8956]];
const R2020_TO_SRGB = [[1.6605, -0.1246, -0.0182], [-0.5876, 1.1329, -0.1006], [-0.0728, -0.0083, 1.1187]];
const INSET = [[0.856627153315983, 0.137318972929847, 0.11189821299995], [0.0951212405381588, 0.761241990602591, 0.0767994186031903], [0.0482516061458583, 0.101439036467562, 0.811302368396859]];
const OUTSET = [[1.1271005818144368, -0.1413297634984383, -0.14132976349843826], [-0.11060664309660323, 1.157823702216272, -0.11060664309660294], [-0.016493938717834573, -0.016493938717834257, 1.2519364065950405]];
const contrast = (x) => {
  const x2 = x * x, x4 = x2 * x2;
  return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
};
const agx = (c) => {
  const min = -12.47393, max = 4.026069;
  c = mul(INSET, mul(SRGB_TO_2020, c)).map((v) => contrast(Math.min(Math.max((Math.log2(Math.max(v, 1e-10)) - min) / (max - min), 0), 1)));
  c = mul(OUTSET, c).map((v) => Math.pow(Math.max(v, 0), 2.2));
  return mul(R2020_TO_SRGB, c).map((v) => Math.min(Math.max(v, 0), 1));
};

const MAPPINGS = { neutral, agx };

// the linear color that the tone mapping (with its exposure) turns into the
// linear color `target`: a few steps of Newton, channel by channel
export function untonemap(target, mapping, exposure = 1) {
  const map = (c) => MAPPINGS[mapping](c.map((v) => v * exposure));
  const t = [target.r, target.g, target.b];
  let c = [...t];
  for (let i = 0; i < 40; i++) {
    const m = map(c);
    c = c.map((v, k) => {
      const h = Math.max(v * 1e-3, 1e-6);
      const bumped = [...c];
      bumped[k] += h;
      const slope = Math.max((map(bumped)[k] - m[k]) / h, 0.02);
      return Math.max(v + (t[k] - m[k]) / slope, 0);
    });
  }
  return target.clone().setRGB(...c);
}
