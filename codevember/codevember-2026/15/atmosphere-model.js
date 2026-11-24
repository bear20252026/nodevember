// Extinction coefficients and scale heights from the pinned SkyMesh. Sharing
// them keeps terrain haze and direct sunlight consistent with the visible sky.
export const RAYLEIGH = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
export const RAYLEIGH_HEIGHT = 8400;
export const AEROSOL_HEIGHT = 1250;
const MIE = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];

export function aerosolState(settings) {
  // Drifting dust represents regional loading; individual tire puffs must not
  // change the whole sky. This is an art-directed coupling, not a fluid model.
  const turbidity = settings.turbidity + Math.max(0, settings.dust) * 1.2;
  const scale = .434 * .2 * 10e-18 * turbidity * settings.mie;
  return { turbidity, extinction: MIE.map(value => value * scale) };
}

export function sunlightTransmission(elevation, rayleigh, aerosol) {
  const cosine = Math.max(0, Math.min(1, elevation));
  const airMass = 1 / (cosine + .02739 / (cosine * (cosine * 26 + 18.6) + 1));
  return RAYLEIGH.map((beta, i) => Math.exp(-(beta * rayleigh * RAYLEIGH_HEIGHT + aerosol[i] * AEROSOL_HEIGHT) * airMass));
}
