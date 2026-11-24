// The motion work on top of the cage: lying on the top bridge, between it
// and the lowest arm, clusters of wheels and pinions on two levels, each
// driven from an arbor that comes up through the bridge (the takeoffs, and
// the pinion shaft), some ending in a dial. Pure layout: where each wheel
// stands, what drives it; works.js builds them.
//
// A cluster is a tree from its root arbor. Each entry:
//   { n, level, from, at }   a wheel meshing with wheel `from` (an index in
//                            the cluster; -1, -2: the root's deck pinions), its
//                            centre in the direction `at` (radians, relative
//                            to the root's angle round the machine)
//   { n, level, on }         a pinion fixed on the same arbor as wheel `on`
//   dial: r                  a dial on its arbor, over the deck
export const PITCH = 0.034;
const TAU = Math.PI * 2;
export const pitchR = (n) => (n * PITCH) / TAU;
const H = Math.PI / 2;

// one branch from each arbor, going round (anticlockwise seen from above)
// into the gap before the next, along the circle of the arbors: a wheel, its
// pinion driving a second on the upper level, and that one a small wheel
// out towards the rim, with a dial; and back the other way, a single wheel
const branch = (r, bigN = 28) => {
  const c1 = pitchR(12) + pitchR(bigN), c2 = pitchR(10) + pitchR(24);
  const a1 = 2 * Math.asin(c1 / (2 * r)), a2 = a1 + 2 * Math.asin(c2 / (2 * r));
  return {
    root: [{ n: 12, level: 0 }],
    gears: [
      { n: bigN, level: 0, from: -1, at: H + a1 / 2 }, // 0
      { n: 10, level: 1, on: 0 }, // 1
      { n: 24, level: 1, from: 1, at: H + (a1 + a2) / 2 }, // 2
      { n: 14, level: 1, from: 2, at: a2 - 0.8, dial: 0.045 }, // 3
      { n: 15, level: 0, from: -1, at: -H + 0.5 }, // 4: back the other way
    ],
  };
};
export const TAKEOFF = branch(0.47);
export const SHAFT = branch(0.42, 26);

// centres of a cluster's arbors, from its root at c0 = [x, z] (at angle phi
// round the machine); returns per gear { c, n, level, from, on, dial }
export function place(spec, c0, phi) {
  const roots = spec.root.map((r) => ({ ...r, c: c0 }));
  const out = [];
  for (const g of spec.gears) {
    if (g.on !== undefined) {
      out.push({ ...g, c: out[g.on].c });
      continue;
    }
    const drv = g.from < 0 ? roots[-g.from - 1] : out[g.from];
    const d = pitchR(drv.n) + pitchR(g.n), a = phi + g.at;
    out.push({ ...g, c: [drv.c[0] + Math.cos(a) * d, drv.c[1] + Math.sin(a) * d] });
  }
  return { roots, gears: out };
}
