// The look, that of 02_shatter: the paper and its vignette, the room the
// marble reflects, the lights, and the colors of the marble.
//
//   bg            the paper behind (center its middle, edge how it darkens around)
//   room          the environment (linear colors): floor, wall, ceiling, sun (the
//                 patch of sun on the floor), window, glow (around the window),
//                 strip (the light behind), panel (the small window on the right)
//   key, rim      the lights: color, intensity, direction; hemi: sky, ground, intensity
//   softness      the blur of the shadows; shade, how much they dim the room
//                 light too, not only the sun (0: only the sun)
//   cavity        how much of the room's light is left inside the shell
//   exposure, toneMapping ('neutral' or 'agx'), envIntensity
//   vignette, grain
//   brass         the color of the brass along the seams (materials.brass,
//                 materials.marble: settings of their materials)
//   saturation    of the marble's colors; palettes.marble, the colors to
//                 pick from: the stone, its veins

export const STYLE = {
  bg: '#d2d1cd', center: 1.03, edge: [0.9, 0.9, 0.9],
  room: {
    floor: [0.42, 0.4, 0.38], wall: [0.44, 0.44, 0.45], ceiling: [0.7, 0.71, 0.72], sun: [0.1, 0.085, 0.065],
    window: [3.8, 3.75, 3.7], glow: [0.54, 0.53, 0.52], strip: [1.4, 1.48, 1.58], panel: [0.6, 0.62, 0.66],
  },
  key: ['#f6f1e9', 1.3, [-4, 6.5, 2.2]], rim: ['#e0e7f0', 0.7, [4, 2.5, -5]], hemi: ['#efeeeb', '#9e978e', 0.7],
  softness: 5, shade: 0.8, cavity: 0.12, exposure: 1, toneMapping: 'neutral', envIntensity: 0.9,
  vignette: 0.05, grain: 0.03,
  brass: '#c8b07a',
  saturation: 0.62,
  palettes: {
    marble: [['#ecebe7', '#6f7472'], ['#e9e4dc', '#8c7462'], ['#e6ebe7', '#5c7468']],
  },
};
