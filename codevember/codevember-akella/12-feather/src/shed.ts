// Loose feathers. The birds keep all of theirs: these are spare ones that were never part of a wing. Now and
// then one slips out from under a wing, and it comes down the way a feather does: sliding to
// one side, stalling, tipping, sliding back, a chain of shallow U-shaped swings, turning slowly as it goes,
// while the flock flies on and leaves it behind.
//
// Nothing is simulated. Each feather has a moment in the loop when it is let go and a life shorter than the
// loop; where it is depends only on its age, (time − release) mod loop, so the loop closes. It grows out of
// nothing at the bird and shrinks away at the end, so neither end shows.
import * as TSL from "three/tsl";
import { Mesh } from "three/webgpu";
import { featherMaterial, featherSet } from "./feather.ts";
import { PART, type Cel } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { uniform } = T;

type V3 = [number, number, number];
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// how they fall
export const fall = {
  sink: 0.4, // metres a second, once it has settled into its swing
  behind: 0.3, // how fast the flock leaves it, metres a second (far slower than true: it is there to be watched)
  swing: 0.42, // half width of the swing, metres
  period: 2.1, // seconds for a swing there and back
  lift: 0.13, // how much it rises at each end of a swing
  rock: 0.75, // how far it banks, radians
  size: 1.35, // drawn larger than life so it reads from far off
  floor: -1e9, // none comes lower than this (set by the stage: above the water)
};

export function createShed(C: Cel, max: number, flock: number) {
  const set = featherSet(max, 7, 12, true);
  const mesh = new Mesh(set.geometry, featherMaterial(C, uniform(0), uniform(0)));
  mesh.frustumCulled = false;
  const rnd = rng(31);
  // a shuffled round of the birds, so no one of them moults twice running
  const order = Array.from({ length: max }, (_, k) => k % flock);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const items = Array.from({ length: max }, (_, k) => ({
    from: order[k],
    at: (k + rnd() * 0.8) / max, // when in the loop it is let go
    life: 0.5 + rnd() * 0.16, // as a share of the loop
    side: rnd() < 0.5 ? 1 : -1, // which wing it slips from
    along: 0.2 + rnd() * 0.8, // and where between elbow and wrist
    where: [0, 0, 0] as V3, // that place at the moment of release, from the bird's place (see index.ts)
    len: 0.17 + rnd() * 0.07,
    phase: rnd() * 6.283,
    heading: (rnd() - 0.5) * 1.5 + (rnd() < 0.5 ? Math.PI : 0), // which way it swings: more along the line of flight than across it
    turn: (rnd() - 0.5) * 0.25, // and how that drifts, radians a second
    skew: (rnd() - 0.5) * 0.9, // its shaft is not square to the swing
    pace: 0.85 + rnd() * 0.35,
    reach: 0.75 + rnd() * 0.5,
    wind: (rnd() - 0.5) * 0.12,
    seed: rnd() * 100,
  }));
  items.forEach((it, k) => set.shape.set([it.len, it.len * 0.14, 0.12, 0.6, it.seed, 0, 0, PART.loose], k * 8));

  const zero = new Float32Array(16);
  // ph: 0..1 round the lap; places: where each bird is now; hush: 0..1, how far they are stilled (they shrink away)
  const update = (ph: number, loop: number, places: V3[], count: number, hush = 0) => {
    const f = fall;
    items.forEach((it, k) => {
      const age = ((((ph - it.at) % 1) + 1) % 1) * loop;
      const life = it.life * loop;
      if (k >= count || age > life || hush > 0.999) {
        set.pose.set(zero, k * 16);
        return;
      }
      const size = smooth(0, 0.25, age) * (1 - smooth(life - 0.8, life, age)) * f.size * (1 - hush);
      // it leaves with the bird's speed and loses it to the air; then it only sinks and swings
      const back = f.behind * (age - 0.7 * (1 - Math.exp(-age / 0.7)));
      const down = f.sink * (age - 0.9 * (1 - Math.exp(-age / 0.9)));
      const on = 1 - Math.exp(-age / 1.0); // the swing takes a moment to set in
      const th = ((Math.PI * 2) / (f.period * it.pace)) * age + it.phase;
      const dir = it.heading + it.turn * age;
      const dx = Math.cos(dir);
      const dz = Math.sin(dir);
      const wide = f.swing * it.reach * on * (1 + 0.25 * Math.sin(th * 0.37 + it.seed));
      const sn = Math.sin(th);
      const o = places[it.from];
      const px = o[0] + it.where[0] - back + dx * wide * sn;
      let py = o[1] + it.where[1] - down + f.lift * on * sn * sn;
      if (py < f.floor + 0.4) py = f.floor + 0.4 * Math.exp((py - f.floor - 0.4) / 0.4); // it settles onto its floor, not through it
      const pz = o[2] + it.where[2] + it.wind * age + dz * wide * sn;
      // it lies flat with its shaft across the swing and rocks like a cradle: at each end the outer edge is up.
      // Twice a swing it nods; and for the first moment after it is let go it tumbles
      const sa = dir + Math.PI / 2 + it.skew;
      const roll = f.rock * sn * on;
      const nod = 0.22 * Math.sin(2 * th + 1) * on + 2.6 * Math.exp(-age / 0.35);
      const X: V3 = [dx * Math.cos(roll), Math.sin(roll), dz * Math.cos(roll)];
      const Z0: V3 = [Math.cos(sa) * Math.cos(nod), Math.sin(nod), Math.sin(sa) * Math.cos(nod)];
      // square the frame up: y from z and x, then x again from y and z
      let Y: V3 = [Z0[1] * X[2] - Z0[2] * X[1], Z0[2] * X[0] - Z0[0] * X[2], Z0[0] * X[1] - Z0[1] * X[0]];
      const ly = Math.hypot(Y[0], Y[1], Y[2]) || 1;
      Y = [Y[0] / ly, Y[1] / ly, Y[2] / ly];
      const X2: V3 = [Y[1] * Z0[2] - Y[2] * Z0[1], Y[2] * Z0[0] - Y[0] * Z0[2], Y[0] * Z0[1] - Y[1] * Z0[0]];
      set.pose.set([px, py, pz, 0.55 + 0.1 * Math.sin(th), X2[0] * size, X2[1] * size, X2[2] * size, 0.25, Y[0] * size, Y[1] * size, Y[2] * size, 0, Z0[0] * size, Z0[1] * size, Z0[2] * size, 0.15], k * 16);
    });
    set.touch();
  };
  return { mesh, update, max, items };
}
