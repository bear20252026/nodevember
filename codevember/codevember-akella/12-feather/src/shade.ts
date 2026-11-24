// The cel: what the bird is painted with. No light is computed; a hand-drawn bird is flat colours and ink:
// one colour for the body and one for the wings, a second tone on whatever faces down, a dark one on the
// flight feathers towards their tips. (The bright edge towards the sun is laid on afterwards, see index.ts.)
import * as TSL from "three/tsl";
import { Color } from "three/webgpu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { cameraPosition, cameraProjectionMatrix, cameraViewMatrix, dot, float, length, max, mix, modelWorldMatrix, positionWorld, sign, smoothstep, step, uniform, vec4 } = T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type N = any;

export interface Cel {
  fill: N; // the body
  wing: N; // wings and tail
  under: N; // the tone of whatever faces down
  underWing: N; // how much of that tone the underside of a wing takes, 0..1
  pale: N; // the flight feathers, towards their tips
  cap: N; // the dark streak on the head
  ink: N;
  linePx: N; // width of an ink stroke, pixels
  strokes: N; // how many feathers get a stroke along their edge, 0..1
  boil: N; // a number that changes a few times a second: redrawn lines never sit quite the same
}

export const createCel = (): Cel => ({
  fill: uniform(new Color("#f3ecdb")),
  wing: uniform(new Color("#e6e6e6")),
  under: uniform(new Color("#b4c8e8")),
  underWing: uniform(0.15),
  pale: uniform(new Color("#2e333d")),
  cap: uniform(new Color("#0d111a")),
  ink: uniform(new Color("#2b3f63")),
  linePx: uniform(1.6),
  strokes: uniform(0.42),
  boil: uniform(0),
});

// The colour of plumage whose normal (in the world) is n: the body's colour or the wings', turned towards the
// under tone where the face that is seen looks down. A feather is seen from either side, so the normal is
// first turned to face the eye
export const plumage = (C: Cel, n: N, wingish: N) => {
  const seen = n.mul(sign(dot(n, cameraPosition.sub(positionWorld))));
  const down = float(1).sub(smoothstep(-0.5, -0.22, seen.normalize().y));
  return mix(mix(C.fill, C.wing, wingish), C.under, down.mul(mix(1, C.underWing, wingish)));
};

// which part of the bird a pixel belongs to, written beside the picture so that ink can be laid where two
// parts meet (see index.ts). Kept apart by more than the ink's threshold
// (loose: a feather on its own in the air, which is coloured as a wing is)
export const PART = { body: 0.1, neck: 0.2, rightWing: 0.4, loose: 0.5, leftWing: 0.6, tail: 0.75, bare: 0.9 };
// distance from the eye goes onto the same sheet, divided by this many metres
export const DEPTH_SCALE = 40;

// The birds in the sea. From as low as the camera stands, flat water shows only the sky just over the horizon,
// and the birds' images lie far below the bottom of the frame. So where the sea's picture is drawn (by a camera
// under the water: that is how it is told apart) each bird is brought straight down to fly `skim` metres over
// the water, with `keep` of its own height on top, and is seen there whole and the right way round for a mirror.
// All of them at once crowd the strip of sea, so there they are also drawn `size` of their size, and those
// further than `far` metres from the eye not at all (they dwindle over the last `fade` metres before it).
export const low = { level: uniform(0), on: uniform(1), skim: uniform(0.02), keep: uniform(0.02), size: uniform(1), far: uniform(100), fade: uniform(2) };
// where a vertex of a bird goes on the screen (for `vertexNode`): as usual, but lower and smaller in the sea's picture
export const lowered = () => {
  const centre = modelWorldMatrix.mul(vec4(0, 0, 0, 1)).xyz; // the bird's
  const sea = step(cameraPosition.y, low.level).mul(low.on); // the sea's picture, and how far the birds are changed in it
  const drop = max(0, centre.y.sub(low.level).mul(float(1).sub(low.keep)).sub(low.skim)).mul(sea);
  const away = length(centre.xz.sub(cameraPosition.xz));
  const shown = low.size.mul(float(1).sub(smoothstep(low.far.sub(low.fade), low.far, away)));
  const at = centre.add(positionWorld.sub(centre).mul(mix(1, shown, sea)));
  return cameraProjectionMatrix.mul(cameraViewMatrix).mul(vec4(at.x, at.y.sub(drop), at.z, 1));
};
