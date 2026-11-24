import { noise, randomSeed } from './noise.js';

// Study: TDM's "Wet stone" (2014). Large subtractive cuts establish the form
// before fine erosion. This mesh implementation solves each ray/sphere
// intersection analytically; it does not raymarch the Shadertoy distance field.
export function createRockCuts(seed, cliff, shelf) {
  const random = randomSeed(seed ^ 0x6ac83d91), cuts = [];
  const count = shelf ? 3 : cliff ? 5 : 8;
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const y = (random() * 2 - 1) * (cliff ? .7 : 1.5);
    // Broad, shallow cuts preserve dry cliff facets. Small-radius scoops on
    // a building-scale face read like softened clay rather than fractured rock.
    const length = Math.hypot(1, y), distance = cliff ? 6 + random() * 4 : 2.3 + random() * 1.1;
    const radius = distance - (cliff ? .72 : .53) - random() * .32;
    cuts.push({ x: Math.cos(angle) / length * distance, y: y / length * distance,
      z: Math.sin(angle) / length * distance, radius, distanceSquared: distance * distance });
  }
  return cuts;
}

// All cutters exclude the origin. Taking the first boundary on each outward
// ray preserves one connected, closed surface and a stable welded topology.
export function carveRadius(x, y, z, radius, cuts) {
  for (const cut of cuts) {
    const projection = x * cut.x + y * cut.y + z * cut.z;
    const discriminant = projection * projection - cut.distanceSquared + cut.radius * cut.radius;
    if (projection <= 0 || discriminant <= 0) continue;
    const entry = projection - Math.sqrt(discriminant);
    const blend = Math.max(0, .018 - Math.abs(radius - entry));
    radius = Math.min(radius, entry) - blend * blend / .072;
  }
  return Math.max(.32, radius);
}

// Coarse weak spots carry the finer erosion. Protected faces stay quiet,
// while a porous patch develops smaller pits instead of uniform fBm fuzz.
export function erosionField(x, y, z, seed) {
  let result = 0, weight = 1;
  for (let octave = 0; octave < 3; octave++) {
    const value = (noise(x + seed, y, z) + 1) * .5;
    const cavity = value * value;
    result += cavity * weight;
    weight *= .38 * (.18 + cavity * .82);
    const nx = (x * .8 + z * .6) * 2.7 + 11.3;
    z = (z * .8 - x * .6) * 2.7 + 5.7; x = nx; y = y * 2.7 + 8.1;
  }
  return result;
}
