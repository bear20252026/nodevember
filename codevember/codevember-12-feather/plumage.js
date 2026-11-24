import * as THREE from 'three';
import { rng } from './common.js';

// The plumage: a bird's colours, drawn anew from a seed, so it is a different bird at
// every visit. Exotic: saturated, a few strong hues in harmony (one of a handful of
// schemes on the colour wheel: neighbours, opposites, a triad, a split, a single hue for
// a plainer bird), each region of the coat with its own:
//
// - primary (crown, back, the outer coat), the bird's main colour, darkest, glossiest;
// - secondary (breast and belly), a related or opposite hue, lighter;
// - face, the small feathers round the eyes, often an accent of its own;
// - display, the few feathers standing out of the coat (a tail, brows, a crest), boldest.
//
// Each region's feathers are multicoloured: the vane's colour (a) shading to a second
// towards the tip (c), a fringe of a third (b), and a mark (d) laid out in a pattern:
// spots, bars, a streak along the shaft, an eye, a dark edge (scales) — or none, for a
// plainer bird. And a sheen, iridescent: a thin film (its thickness sets the colours it
// throws) over the darker feathers mostly.

// patterns, as the shader has them (feather.js)
export const MARKS = { none: 0, spots: 1, bars: 2, streak: 3, eye: 4, scales: 5 };

const SRGB = THREE.SRGBColorSpace;
const wrap = (h) => ((h % 1) + 1) % 1;
const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
export const hsl = (h, s, l) => new THREE.Color().setHSL(wrap(h), clamp01(s), clamp01(l), SRGB);

// muddy hues (yellows and oranges in the dark turn olive and brown): kept light enough
function lift(h, l) {
  const y = Math.exp(-(((wrap(h) - 0.14) / 0.06) ** 2));
  return Math.max(l, 0.5 * y);
}

// the hues a bird starts from: scarlet, orange, gold, emerald, jade, teal, azure, royal
// blue, violet, purple, magenta; and away from the limes and khakis between gold and green
const ANCHORS = [0.985, 0.03, 0.075, 0.125, 0.37, 0.43, 0.49, 0.55, 0.61, 0.7, 0.78, 0.87];
function tame(h) {
  h = wrap(h);
  if (h > 0.165 && h < 0.33) return h < 0.235 ? 0.145 + (h - 0.165) * 0.2 : 0.34 + (h - 0.235) * 0.3;
  return h;
}

// The eyes go with the plumage: the iris in one of the bird's own colours (the display
// feathers', the crown's or the breast's, not the face's, which rings the eye and would
// swallow it), toned to an iris: never too pale nor too dark, a little less saturated
// than the feathers, darker and duller towards the pupil. (r: a random, or none)
export function irisOf(regions, r = null) {
  const hslOf = (c) => c.getHSL({}, SRGB);
  const face = hslOf(regions.face.a);
  const unlike = (k) => {
    const c = hslOf(regions[k].a);
    const dh = Math.abs(((c.h - face.h + 1.5) % 1) - 0.5);
    return dh > 0.05 || Math.abs(c.l - face.l) > 0.15 || Math.abs(c.s - face.s) > 0.3;
  };
  const keys = ['display', 'display', 'back', 'breast'];
  const ok = keys.filter(unlike);
  const from = ok.length ? ok : keys;
  const k = r ? from[Math.floor(r() * from.length)] : from[0];
  const { h, s, l } = hslOf(regions[k].a);
  const outer = hsl(h, Math.min(Math.max(s * 0.8, 0.12), 0.65), lift(h, Math.min(Math.max(l, 0.38), 0.5)));
  const inner = hsl(h, Math.min(s * 0.7, 0.6), 0.2);
  return [inner, outer];
}

export function plumage(seed) {
  const r = rng(seed * 2654435761 + 97);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const range = (a, b) => a + (b - a) * r();
  const sign = () => (r() < 0.5 ? -1 : 1);

  const h0 = pick(ANCHORS) + range(-0.02, 0.02);
  const scheme = pick(['neighbours', 'neighbours', 'opposites', 'triad', 'split', 'single']);
  const d1 = range(0.07, 0.14) * sign();
  const hues = {
    neighbours: [h0, h0 + d1, h0 + 2 * d1],
    opposites: [h0, h0 + 0.5 + range(-0.04, 0.04), r() < 0.5 ? h0 + 0.5 : h0 - d1],
    triad: [h0, h0 + 1 / 3, h0 + 2 / 3],
    split: [h0, h0 + 0.5 - 0.09, h0 + 0.5 + 0.09],
    single: [h0, h0 + range(-0.03, 0.03), h0 + range(-0.05, 0.05)],
  }[scheme].map(tame);
  // a plain bird, one colour or two, no marks (image 7), or a marked one
  const plain = scheme === 'single' || r() < 0.25;
  const sat = range(0.62, 0.95);

  // a region's colours from its hue and lightness
  const region = (h, l, s, { mark = 'none', density = 0, strength = 1, iri = 0.2 } = {}) => {
    l = lift(h, l);
    const a = hsl(h, s, l);
    // towards the tip: its neighbour on the wheel, lighter or darker, or another region's hue
    const hc = tame(r() < 0.4 ? pick(hues) : h + range(0.04, 0.12) * sign());
    const c = hsl(hc, s * range(0.85, 1.05), lift(hc, l + range(-0.12, 0.2)));
    // the fringe: a pale tint, or (now and then) a bright accent
    const b = r() < 0.7 ? hsl(h, s * 0.65, Math.min(l + 0.2, 0.82)) : hsl(pick(hues) + 0.02, 0.9, 0.62);
    // the mark: near black, near white, or an accent
    // (bars, streaks and scales only dark: light ones read as stripes painted on)
    const dm = mark === 'spots' || mark === 'eye' ? r() : r() * 0.5;
    const d = dm < 0.5 ? hsl(h, s * 0.5, 0.07) : dm < 0.8 ? hsl(h, 0.25, 0.93) : hsl(tame(pick(hues) + 0.5), 0.85, 0.5);
    return {
      a, b, c, d,
      band: plain ? range(0, 0.15) : range(0, 0.5),
      grad: range(0.25, 0.85),
      mark: MARKS[mark], density, strength,
      iri, film: 0,
    };
  };

  // the marks: a main one on one or two regions, edges (scales) or nothing on the others
  const markOf = () => {
    const m = pick(['spots', 'spots', 'bars', 'bars', 'streak', 'eye', 'scales']);
    const density = { spots: range(3, 6), bars: range(4, 8), streak: 1, eye: 1, scales: 1 }[m];
    return { mark: m, density, strength: range(0.7, 1) };
  };
  const main = plain ? null : markOf();
  const where = plain ? [] : pick([['secondary'], ['primary'], ['primary', 'secondary'], ['secondary', 'face']]);
  const marks = (k) => (where.includes(k) ? main : !plain && r() < 0.3 ? { mark: 'scales', density: 1, strength: range(0.4, 0.8) } : {});

  // (every bird glints: some a touch, most strongly)
  const iri = range(0.55, 1);
  const lP = range(0.2, 0.4), lS = range(0.36, 0.56);
  const regions = {
    back: region(hues[0], lP, sat, { ...marks('primary'), iri }),
    breast: region(hues[1], lS, sat * range(0.85, 1), { ...marks('secondary'), iri: iri * 0.6 }),
  };
  // the belly: the breast's, lighter (or the same)
  const belly = region(hues[1] + range(-0.03, 0.03), Math.min(lS + range(0, 0.22), 0.85), sat * range(0.6, 0.95), { ...marks('secondary'), iri: iri * 0.45 });
  regions.belly = belly;
  // the face: an accent (the third hue), or the crown's colour carried round
  const faceH = r() < 0.6 ? hues[2] : hues[0];
  regions.face = region(faceH, range(0.36, 0.62), Math.min(sat * 1.1, 1), { ...marks('face'), iri: iri * 0.8 });
  if (!where.includes('face')) regions.face.mark = 0;

  // the film's thickness (µm): one bird glints green-violet, another gold-copper
  const film = range(0.28, 0.62);
  for (const k in regions) regions[k].film = film * range(0.95, 1.05);

  const skin = hsl(range(-0.02, 0.04), range(0.45, 0.65), range(0.68, 0.78));

  // the display feathers (a tail, brows, a crest): the boldest, an accent hue, marked
  // (an eye, on most) and glinting, drawn last so a seed's bird keeps its other colours
  const dispH = r() < 0.6 ? hues[2] : hues[0] + 0.5;
  const showy = plain ? {} : r() < 0.6 ? { mark: 'eye', density: 1, strength: 1 } : markOf();
  regions.display = region(dispH, range(0.3, 0.55), Math.min(sat * 1.1, 1), { ...showy, iri: Math.min(iri * 1.3, 1.25) });
  regions.display.film = film * range(0.95, 1.05);
  // (its own random, so a seed's bird keeps its other colours)
  const iris = irisOf(regions, rng(seed * 2246822519 + 31));
  return { seed, scheme, plain, regions, skin, face: regions.face.a.clone(), iris };
}

// the old named palettes, as plumages: plain, a touch of sheen
export function namedPlumage(p) {
  const regions = {};
  for (const k of ['back', 'face', 'breast', 'belly', 'display']) {
    const [a, b, band] = p[k] || p.face;
    const ca = new THREE.Color(a);
    regions[k] = {
      a: ca, b: new THREE.Color(b), c: ca.clone(), d: ca.clone().multiplyScalar(0.2), band,
      grad: 0, mark: 0, density: 0, strength: 0, iri: k === 'back' || k === 'display' ? 0.6 : 0.35, film: 0.4,
    };
  }
  return { regions, skin: new THREE.Color(p.skin), face: new THREE.Color(p.face[0]), plain: true, iris: irisOf(regions) };
}
