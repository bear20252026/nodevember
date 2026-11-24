// The timing round each snap, shared by the picture and the sound: the rope creaks a few times
// as it is about to go (`creaks`), and time itself holds before the snap and rushes after it
// (`warp`), so that the strain builds and lets go.
import { strands } from './rope.js';

const TAUS = strands.filter((st) => !st.survivor).map((st) => st.tau);
// the creaks, seconds before the snap (at the default pace; a faster one squeezes them)
const CREAK = [0.48, 0.34, 0.21, 0.1];
// for T seconds a cycle: when each creak comes before the snap, and how long the pop of one
// lasts, in cycles
export const creaks = (T) => CREAK.map((d) => Math.min(d / T, d * 0.022));
export const popLength = (T) => Math.min(0.04 / T, 0.0035);

// the stage's time warped round each snap: slowed down to about half in the half second before
// it, sped up as much after, back to steady between snaps. Periodic (warp(c + 1) = warp(c) + 1)
// and steadily rising, so that it only shifts what happens when, never sends it back
const HOLD = 0.55;
export function warp(c, T) {
  const w = Math.min(0.42 / T, 0.035);
  let s = 0;
  for (const tau of TAUS) {
    let d = c - tau;
    d -= Math.round(d);
    s += Math.exp(-((d / w) ** 2));
  }
  return c - HOLD * w * s;
}
