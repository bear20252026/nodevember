// The look of the piece: the paper and its vignette, the room the volumes
// reflect, the lights, and the colors of the materials.
//
//   bg            the paper, and the fog the pieces sink into (fog: near, far)
//   edge          how the paper darkens around (a multiplier), center its middle
//   room          the environment (linear colors): floor, wall, ceiling, sun (the
//                 patch of sun on the floor), window, glow (around the window),
//                 strip (the light behind), panel (the small window on the right)
//   key, rim      the lights: color, intensity, direction; hemi: sky, ground, intensity
//   softness      the blur of the shadows
//   exposure, toneMapping ('neutral' or 'agx'), envIntensity
//   vignette, grain
//   saturation    of all the colors of the materials
//   palettes      per material, the colors to pick from (see materials.js)
//   materials     per material, settings over its own

// overcast, with a little of the original back: the clouds thinning, a
// faint warm sun, the paper neutral rather than cool; the materials keep
// their restraint but find their colors again, muted: clay, sage, slate,
// honeyed wood, a vein of green or rust in the marble
export const STYLE = {
  bg: '#d2d1cd', fog: [5, 13], center: 1.03, edge: [0.9, 0.9, 0.9],
  room: {
    floor: [0.42, 0.4, 0.38], wall: [0.44, 0.44, 0.45], ceiling: [0.7, 0.71, 0.72], sun: [0.1, 0.085, 0.065],
    window: [3.8, 3.75, 3.7], glow: [0.54, 0.53, 0.52], strip: [1.4, 1.48, 1.58], panel: [0.6, 0.62, 0.66],
  },
  key: ['#f6f1e9', 1.3, [-4, 6.5, 2.2]], rim: ['#e0e7f0', 0.7, [4, 2.5, -5]], hemi: ['#efeeeb', '#9e978e', 0.7],
  softness: 12, exposure: 1, toneMapping: 'neutral', envIntensity: 0.9,
  vignette: 0.05, grain: 0.03,
  saturation: 0.62,
  palettes: {
    glass: [['#e2ece8'], ['#e5e9f0'], ['#eee9de']],
    ice: [['#e6f0f4', '#ffffff', '#bcd6e0']],
    wood: [['#c6ae92', '#8f7562'], ['#d6c4a6', '#a08a6c'], ['#b0937a', '#6e5948']],
    marble: [['#ecebe7', '#6f7472'], ['#e9e4dc', '#8c7462'], ['#e6ebe7', '#5c7468']],
    stone: [['#c4b6a4', '#a69582', '#d8cebf'], ['#bdbab3', '#9d9a93', '#d6d3cc'], ['#c0a796', '#9c8272', '#d6c3b5']],
    ceramic: [['#6f8892', '#c9a48a'], ['#a98d80', '#e6ded2'], ['#cdbb8a', '#e6ded2'], ['#8a9c8c', '#d4a283'], ['#dcd8cf', '#c9a184']],
    obsidian: [['#1f2022', '#26292c']],
  },
};
