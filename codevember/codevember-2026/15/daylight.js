import { Vector3 } from 'three/webgpu';

// Sun azimuth/elevation and incident energy. SkyMesh, SunLight, IBL and haze
// derive their colors from this same direction, rather than color overlays.
export const daylightPresets = {
  Dawn: { elevation: 14, azimuth: 65, sun: 3.8, ambient: 1.9, exposure: 1.8, turbidity: 2.8, rayleigh: 1.35, mie: .0045, haze: .0002, cloudPhase: -600 },
  Day: { direction: [-.62, .56, .55], sun: 4.3, ambient: 1, exposure: 1.1, turbidity: 4.8, rayleigh: 1.8, mie: .008, haze: .0003, cloudPhase: 0 },
  Sunset: { elevation: 8, azimuth: -65, sun: 4.4, ambient: 1.5, exposure: 1.7, turbidity: 6, rayleigh: 1.8, mie: .009, haze: .00042, cloudPhase: 800 }
};
const lightingKeys = ['sun', 'ambient', 'exposure', 'turbidity', 'rayleigh', 'mie', 'haze'];

export function createDaylightControls(settings, sun, cloudPhase, changed, events) {
  const buttons = [...document.querySelectorAll('#daylight button')];
  let transition = null;
  function select(name) {
    const preset = daylightPresets[name];
    if (!preset) return;
    const direction = new Vector3();
    if (preset.direction) direction.fromArray(preset.direction).normalize();
    else {
      const elevation = preset.elevation * Math.PI / 180, azimuth = preset.azimuth * Math.PI / 180;
      direction.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    }
    transition = { elapsed: 0, from: sun.position.clone(), direction, preset, cloudPhase: cloudPhase.value,
      lighting: Object.fromEntries(lightingKeys.map(key => [key, settings[key]])) };
    settings.timeOfDay = name;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.time === name));
    changed();
  }
  for (const button of buttons) button.addEventListener('click', () => select(button.dataset.time), events);
  return { select,
    get active() { return transition !== null; },
    update(dt) {
      if (!transition) return;
      const t = transition; t.elapsed += dt;
      const phase = Math.min(1, t.elapsed / 2), ease = phase * phase * (3 - 2 * phase);
      sun.position.lerpVectors(t.from, t.direction, ease).normalize();
      for (const key of lightingKeys) settings[key] = t.lighting[key] + (t.preset[key] - t.lighting[key]) * ease;
      // Move the shared cloud field, rather than changing speed * elapsed time
      // (which would jump on selection). Preserve the current phase on retarget.
      cloudPhase.value = t.cloudPhase + (t.preset.cloudPhase - t.cloudPhase) * ease;
      changed(); if (phase === 1) transition = null;
    }
  };
}
