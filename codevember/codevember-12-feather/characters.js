// The characters a contour feather can have. A bird wears three types of feathers, each
// with one of these: a main type over most of the body, a secondary type over one region
// of it, and a few display feathers standing out of the coat (a
// tail and brows over the eyes, a crest; in wilder shapes). Shared by the creature's coat (coat.js) and the lab (lab.js).
//
//   width   the vane's half width, in units of the length
//   tip     the tip's taper: under 1 rounded, 1 a straight point, over 1 a drawn-out spike
//   cup     how much the vane is cupped across
//   twist   how much it twists along
//   fray    how loose the vane's edge is (its barbs apart, wavering, ragged), 0…1
//   splits  the share of barbs come apart from the next, a V notch in the vane
//   sheen   the fibres' highlight
//   barbs   how steeply the barbs sweep towards the tip (1 as is)
//   lift    on the body, the tip raised off the coat (radians): sleek, bristling or puffed
//   reach   on the body, how far beyond the coat's surface the tips reach
//   length  a display feather's length, relative to its site's
//   flow    its movement: how far the shaft sweeps sideways (the tip's offset, in units
//           of the length), neighbours sweeping together, in waves over the body
//   scurve  the S in it: the middle bowed the other way from the tip
//   locks   how much the vane's outer part parts into strands, wavering, pointed
//   stir    how much its tip stirs in the air
export const CHARACTERS = {
  // long, smooth, closed and glossy, lying sleek; a gentle point
  proud: { width: 0.165, tip: 0.62, cup: 0.12, twist: 0.04, fray: 0.1, splits: 0.025, sheen: 1.5, barbs: 1.1, lift: -0.04, reach: 0.02, length: 1.15, flow: 0.3, scurve: 0.09, locks: 0.5, stir: 0.025 },
  // narrow, a drawn-out point, notched, the tips bristling off the coat
  aggressive: { width: 0.115, tip: 1.3, cup: 0.03, twist: 0.14, fray: 0.04, splits: 0.17, sheen: 1.1, barbs: 1.45, lift: 0.32, reach: 0.05, length: 1.0, flow: 0.22, scurve: 0.11, locks: 0.65, stir: 0.018 },
  // short and round, deeply cupped, its edge soft and fluffy, the coat puffed up
  cute: { width: 0.27, tip: 0.32, cup: 0.32, twist: 0.0, fray: 0.7, splits: 0.015, sheen: 0.6, barbs: 0.8, lift: 0.06, reach: -0.01, length: 0.75, flow: 0.17, scurve: 0.07, locks: 0.28, stir: 0.035 },
};
export const CHARACTER_NAMES = Object.keys(CHARACTERS);

// where on the body the secondary type grows (dir: the unit direction from the body's
// centre, +z the face, +y up), a weight 0…1
export const SECONDARY_AREAS = {
  front: (d) => smooth(0.05, 0.45, d.z * 0.85 - d.y * 0.35),
  cape: (d) => smooth(0.25, 0.6, d.y * 0.9 - d.z * 0.25),
  flanks: (d) => smooth(0.5, 0.78, Math.abs(d.x) - 0.15 * d.z + 0.1 * d.y),
  belly: (d) => smooth(0.15, 0.5, -d.y + 0.1 * d.z),
};

// where the display feathers stand out: every bird has them at the back (its tail) and
// over the eyes (brows), some a crest too
export const DISPLAY_SITES = ['tail', 'brows', 'crest'];

// the display feathers' wilder shapes, almost abstract (drawn in feather.js), in this
// order (the shader knows them by index):
//   width   the vane's half width, in units of the length
//   length  the feather's length, relative to its site's
//   twist   how far it turns round its shaft (radians, root to tip)
//   eye     whether it always wears an eye
//   plain   whether it wears no eye (too narrow for one: bars instead)
export const DISPLAY_SHAPES = {
  // a bare wire ending in a round vane, an eye in it
  racket: { width: 0.2, length: 1.25, twist: 0.3, eye: true },
  // a slender blade curling sideways, in its own plane, into a spiral
  curl: { width: 0.045, length: 1.15, twist: 0.15, plain: true },
  // all its barbs apart, a cloud of wavering filaments
  wisp: { width: 0.17, length: 0.95, twist: 0.2, plain: true },
  // a narrow blade curling over into a hook
  sickle: { width: 0.085, length: 1.2, twist: 0.4 },
  // a long even streamer turning round itself, its end forked
  ribbon: { width: 0.06, length: 1.5, twist: 4.5, plain: true },
  // a thin streamer corkscrewing round, to a lancet at its end
  coil: { width: 0.07, length: 1.05, twist: 0.8 },
};
export const DISPLAY_SHAPE_NAMES = Object.keys(DISPLAY_SHAPES);

function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
}
