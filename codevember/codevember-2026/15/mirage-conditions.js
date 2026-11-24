import { terrainHeight, canyonCenter, canyonWidth, smoothstep } from './noise.js';

// The playa is at -1.4 m, including when viewed from its surrounding dunes.
// Keep one plane throughout that catchment, independent of camera heading.
// Outside the valley, blend back to the local terrain for distant exploration.
export function miragePlaneHeight(x, z) {
  const across = 1 - smoothstep(canyonWidth(z) + 100, canyonWidth(z) + 450, Math.abs(x - canyonCenter(z)));
  const along = smoothstep(-1800, -1150, z) * (1 - smoothstep(300, 850, z));
  const basin = across * along;
  return terrainHeight(x, z) * (1 - basin) - 1.4 * basin + .08;
}

// A hot desert remains visibly refractive under a low sun. Keep the artistic
// heating curve broad enough that low-sun opacity and angular cutoff do not
// both collapse. This is an elevation proxy, not a thermal-history simulation.
export function groundHeatAt(sunHeight) {
  return smoothstep(0, .22, sunHeight);
}
