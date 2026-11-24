import GUI from 'three/addons/libs/lil-gui.module.min.js';

export function createSettings(reducedMotion) {
  return { view: 'Rover', timeOfDay: 'Day', dust: 2, wheelDust: 1, paused: reducedMotion, drift: !reducedMotion, heat: 1.6, mirage: .78, mirageScale: 5, mirageNear: 25, haze: .0003, clouds: .43, turbidity: 4.8, rayleigh: 1.8, mie: .008, cloudDensity: .6, cloudShadows: 1, cloudElevation: .9, cloudScale: .00036, sun: 4.3, ambient: 1, relief: 1, exposure: 1.1, saturation: .98, contrast: 1.06, bloom: .12, vignette: .4, ao: .58, ssgi: true, gi: 14, giRadius: 24, resolution: 1.25, meshlets: false, lod: 3, lodDither: true };
}
export function createSettingsPanel(settings, actions, performanceInfo) {
  const gui = new GUI({ title: 'Settings', width: 245 });
  gui.add(settings, 'view', ['Overlook', 'Dunes', 'Sanctuary', 'Outcrop', 'Stone', 'Rover']).name('View').listen().onChange(actions.setView);
  const air = gui.addFolder('Mirage & atmosphere');
  air.add(settings, 'heat', 0, 3, .01).name('Heat shimmer');
  air.add(settings, 'mirage', 0, 1, .01).name('Inferior mirage');
  air.add(settings, 'mirageScale', 1, 10, .1).name('Mirage scale');
  air.add(settings, 'mirageNear', 10, 160, 1).name('Mirage near (m)');
  air.add(settings, 'haze', 0, .004, .00005).name('Desert haze').listen();
  air.add(settings, 'dust', 0, 2, .05).name('Drifting dust');
  air.add(settings, 'wheelDust', 0, 2, .05).name('Wheel spray');

  air.add(settings, 'paused').name('Paused').listen();
  air.add(settings, 'drift').name('Camera drift').listen();
  air.add(actions, 'reset').name('Reset view');
  const sky = gui.addFolder('Sky');
  sky.add(settings, 'turbidity', 1, 12, .1).name('Base turbidity').listen();
  sky.add(settings, 'rayleigh', .2, 3, .05).name('Rayleigh').listen();
  sky.add(settings, 'mie', .0001, .02, .00005).name('Mie scattering').listen();
  sky.add(settings, 'clouds', 0, .8, .01).name('Cloud coverage');
  sky.add(settings, 'cloudDensity', .1, 1, .01).name('Cloud density');
  sky.add(settings, 'cloudShadows', 0, 1, .05).name('Cloud shadows');
  sky.add(settings, 'cloudElevation', .1, .9, .01).name('Cloud elevation');
  sky.add(settings, 'cloudScale', .0001, .005, .00001).name('Cloud scale');
  sky.close();
  const light = gui.addFolder('Stone & light');
  light.add(settings, 'ssgi').name('SSGI');
  light.add(settings, 'gi', 0, 30, .1).name('Bounce light');
  light.add(settings, 'giRadius', 2, 60, .5).name('Bounce radius');
  light.add(settings, 'sun', 0, 12, .05).name('Sunlight').listen();
  light.add(settings, 'ambient', 0, 2, .05).name('Sky fill').listen();
  light.add(settings, 'relief', 0, 1.5, .05).name('Stone relief');
  light.add(settings, 'ao', 0, 1, .05).name('Contact shadows');
  light.close();
  const lens = gui.addFolder('Lens & color');
  lens.add(settings, 'exposure', .3, 1.8, .01).name('Exposure').listen();
  lens.add(settings, 'saturation', 0, 1.5, .01).name('Saturation');
  lens.add(settings, 'contrast', .7, 1.4, .01).name('Contrast');
  lens.add(settings, 'bloom', 0, .4, .01).name('Bloom');
  lens.add(settings, 'vignette', 0, 1, .01).name('Vignette');
  lens.close();
  const detail = gui.addFolder('Rendering');
  detail.add(performanceInfo, 'fps').name('Frames / second').listen().disable();
  detail.add(settings, 'resolution', { 'Native DPR': 0, '1×': 1, '1.25×': 1.25, '1.5×': 1.5, '2×': 2 }).name('Resolution').onChange(actions.resize);
  detail.add(settings, 'lod', .5, 4, .1).name('LOD error (pixels)');
  detail.add(settings, 'lodDither').name('LOD transitions');
  detail.add(settings, 'meshlets').name('Show meshlets');
  detail.close(); gui.close(); gui.onChange(actions.changed);
  return gui;
}
