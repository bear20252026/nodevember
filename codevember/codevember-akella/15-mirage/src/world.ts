// What stands in the desert, and how the eye flies through it.
//
// The world is one place. The eye starts at its origin looking along +z, to the oasis, and flies to one of the
// doors: arched glasses that are not mirrors but ways through, each of them back to the origin. So going through
// a door starts the flight again in the same world, and a flight ("lap") to each door in turn makes the loop.
// Everything else that stands there is a plain mirror.
//
// Headings are angles from +z toward +x; a turn by an angle adds it to every heading.

export type P2 = [number, number];
export type V3 = [number, number, number];

export interface Glass {
  x: number;
  z: number;
  face: number; // the heading its front looks along
  w: number;
  h: number; // above the sand
  door: boolean;
  // known once the ground is
  ground: number; // the sand under its middle
  bottom: number; // its lower edge, under the sand
}

// a boulder: a ball cut by flat faces
export interface Rock {
  x: number;
  z: number;
  r: number; // about how big, metres
  round: number; // of the ball the faces are cut from
  sunk: number; // how far its middle is over the sand, in r
  tone: number;
  faces: number[]; // 16 of them: which way each looks, and how far from the middle it is
  y: number; // its middle, known once the ground is
}

export interface Lap {
  door: number; // which glass it ends in
  // the way, as points a quarter of a metre apart: x, z, and the eye's height
  x: Float64Array;
  z: Float64Array;
  y: Float64Array;
  step: number;
  length: number;
  // the way as it was first made, which the mirrors and boulders are set out by (see `curve`)
  guide: { x: Float64Array; z: Float64Array; step: number; length: number };
}

export interface World {
  glasses: Glass[];
  laps: Lap[];
  // 12 numbers each: the line, then radius, fade, whether it levels the land, wet; how much of the dunes it takes
  // off, how much of the small ones, and the place whose height it is levelled to
  pads: number[][];
  wide: number; // how many of the pads are the wide ones, that the others sit on
  length: number; // of all laps
  startGround: number;
  oasis: { x: number; z: number; ground: number };
  rocks: Rock[];
  lead: number; // metres of dead straight flight at each end of a lap, twice: what makes the joins seamless
  // how the eye rides over the ground: over the highest of it within `reach` (x 2 m) either way, smoothed over
  // `soft` (x 2 m); dead level for `level` metres at each end of a lap, and easing into the ride over `ease`
  ride: { reach: number; soft: number; level: number; ease: number };
}

export const worldDefaults = {
  scene: "far", // or "garden": the same things, close together (see createGarden)
  layout: 4, // seed of where the mirrors stand
  mirrors: 32,
  doorWide: 4.2,
  doorTall: 8.5,
  eye: 2.3, // metres over the sand
  oasisFar: 440, // metres from the start to the oasis
  lane: 30, // half the width of the flat way to it
  rocks: 0,
  rockSize: 1,
};

const LEAD = 8;
const STEP = 0.25;

const rng = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const dir = (heading: number): P2 => [Math.sin(heading), Math.cos(heading)];

// The ways as they were first made (a Catmull-Rom curve through the points, cut into steps of equal length):
// still what the mirrors and boulders are set out by, so that they stand where they always have.
function curve(pts: P2[]): {
  x: Float64Array;
  z: Float64Array;
  length: number;
} {
  const fine: P2[] = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const [a, b, c, d] = [pts[i - 1], pts[i], pts[i + 1], pts[i + 2]];
    for (let k = 0; k < 256; k++) {
      const t = k / 256;
      const at = (j: number) =>
        0.5 *
        (2 * b[j] +
          (c[j] - a[j]) * t +
          (2 * a[j] - 5 * b[j] + 4 * c[j] - d[j]) * t * t +
          (3 * b[j] - a[j] - 3 * c[j] + d[j]) * t * t * t);
      fine.push([at(0), at(1)]);
    }
  }
  fine.push(pts[pts.length - 2]);
  const along = [0];
  for (let i = 1; i < fine.length; i++)
    along.push(
      along[i - 1] +
        Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]),
    );
  const length = along[along.length - 1];
  const n = Math.round(length / STEP);
  const x = new Float64Array(n + 1);
  const z = new Float64Array(n + 1);
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * length;
    while (j < along.length - 2 && along[j + 1] < s) j++;
    const f = Math.min(
      1,
      Math.max(0, (s - along[j]) / (along[j + 1] - along[j] || 1)),
    );
    x[i] = fine[j][0] + (fine[j + 1][0] - fine[j][0]) * f;
    z[i] = fine[j][1] + (fine[j + 1][1] - fine[j][1]) * f;
  }
  return { x, z, length };
}

// Points along a way, cut into steps of equal length.
function resample(fine: P2[]): {
  x: Float64Array;
  z: Float64Array;
  length: number;
} {
  const along = [0];
  for (let i = 1; i < fine.length; i++)
    along.push(
      along[i - 1] +
        Math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]),
    );
  const length = along[along.length - 1];
  const n = Math.round(length / STEP);
  const x = new Float64Array(n + 1);
  const z = new Float64Array(n + 1);
  let j = 0;
  for (let i = 0; i <= n; i++) {
    const s = (i / n) * length;
    while (j < along.length - 2 && along[j + 1] < s) j++;
    const f = Math.min(
      1,
      Math.max(0, (s - along[j]) / (along[j + 1] - along[j] || 1)),
    );
    x[i] = fine[j][0] + (fine[j + 1][0] - fine[j][0]) * f;
    z[i] = fine[j][1] + (fine[j + 1][1] - fine[j][1]) * f;
  }
  return { x, z, length };
}

// A smooth way through points, leaving the first going `from` and coming into the last going `to`, unbent at
// both. Between each two points it is a quintic, which is given at both ends the way and the bend it is to have
// there: so neither turns nor bends all at once anywhere. (A Catmull-Rom curve through points set out along a
// straight is not straight between them: the first of them it leaves going the way the curve came, and it
// swings across the straight and back to make up for it. Right before a door, that was the eye swaying.)
function smoothWay(pts: P2[], from: P2, to: P2): P2[] {
  const n = pts.length;
  const sub2 = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
  const len = (a: P2) => Math.hypot(a[0], a[1]);
  const unit2 = (a: P2): P2 => [a[0] / (len(a) || 1), a[1] / (len(a) || 1)];
  // the way and the bend (1/m) at every point
  const ways: P2[] = [];
  const bends: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1) {
      ways.push(unit2(i === 0 ? from : to));
      bends.push(0);
      continue;
    }
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    ways.push(unit2(sub2(c, a)));
    // of the circle through it and its neighbours
    const ab = sub2(b, a);
    const bc = sub2(c, b);
    const ac = sub2(c, a);
    bends.push(
      (2 * (ab[0] * bc[1] - ab[1] * bc[0])) /
        (len(ab) * len(bc) * len(ac) || 1),
    );
  }
  const fine: P2[] = [];
  for (let i = 0; i < n - 1; i++) {
    const [p0, p1] = [pts[i], pts[i + 1]];
    const c = len(sub2(p1, p0));
    // ways as long as the stretch, bends as sideways pulls that long squared
    const t0: P2 = [ways[i][0] * c, ways[i][1] * c];
    const t1: P2 = [ways[i + 1][0] * c, ways[i + 1][1] * c];
    // (the bend, signed as the turn from one stretch to the next is, pulls toward the inside of the turn)
    const left = (w: P2): P2 => [-w[1], w[0]];
    const a0: P2 = [
      left(ways[i])[0] * bends[i] * c * c,
      left(ways[i])[1] * bends[i] * c * c,
    ];
    const a1: P2 = [
      left(ways[i + 1])[0] * bends[i + 1] * c * c,
      left(ways[i + 1])[1] * bends[i + 1] * c * c,
    ];
    for (let k = 0; k < 512; k++) {
      const t = k / 512;
      const [t2, t3, t4, t5] = [t * t, t ** 3, t ** 4, t ** 5];
      const h0 = 1 - 10 * t3 + 15 * t4 - 6 * t5;
      const h1 = t - 6 * t3 + 8 * t4 - 3 * t5;
      const h2 = 0.5 * t2 - 1.5 * t3 + 1.5 * t4 - 0.5 * t5;
      const h3 = 0.5 * t3 - t4 + 0.5 * t5;
      const h4 = -4 * t3 + 7 * t4 - 3 * t5;
      const h5 = 10 * t3 - 15 * t4 + 6 * t5;
      fine.push(
        [0, 1].map(
          (j) =>
            h0 * p0[j] +
            h1 * t0[j] +
            h2 * a0[j] +
            h3 * a1[j] +
            h4 * t1[j] +
            h5 * p1[j],
        ) as P2,
      );
    }
  }
  fine.push(pts[n - 1]);
  return fine;
}

// a lap: straight off the start for twice `lead`, smoothly by a few points on the way, and straight into the
// door for twice `lead` again
function lapTo(glasses: Glass[], to: number, via: P2[], lead: number): Lap {
  const g = glasses[to];
  const f = dir(g.face + Math.PI);
  const off: P2 = [0, 2 * lead];
  const on: P2 = [g.x - 2 * lead * f[0], g.z - 2 * lead * f[1]];
  const line = (a: P2, b: P2): P2[] =>
    Array.from(
      { length: 64 },
      (_, k) =>
        [
          a[0] + ((b[0] - a[0]) * k) / 64,
          a[1] + ((b[1] - a[1]) * k) / 64,
        ] as P2,
    );
  const fine = [
    ...line([0, 0], off),
    ...smoothWay([off, ...via, on], [0, 1], f).slice(0, -1),
    ...line(on, [g.x, g.z]),
    [g.x, g.z] as P2,
  ];
  const c = resample(fine);
  const guide = curve([
    [0, -lead],
    [0, 0],
    [0, lead],
    [0, 2 * lead],
    ...via,
    on,
    [g.x - lead * f[0], g.z - lead * f[1]],
    [g.x, g.z],
    [g.x + lead * f[0], g.z + lead * f[1]],
  ]);
  return {
    door: to,
    x: c.x,
    z: c.z,
    y: new Float64Array(c.x.length),
    step: c.length / (c.x.length - 1),
    length: c.length,
    guide: { ...guide, step: guide.length / (guide.x.length - 1) },
  };
}

export function createWorld(look: typeof worldDefaults): World {
  if (look.scene === "garden") return createGarden(look);
  const glasses: Glass[] = [];
  const door = (x: number, z: number, into: number) =>
    glasses.push({
      x,
      z,
      face: into + Math.PI,
      w: look.doorWide,
      h: look.doorTall,
      door: true,
      ground: 0,
      bottom: 0,
    }) - 1;
  // three doors, and the heading the eye goes into each with
  const right = door(31, 104, 0.52);
  const left = door(-27, 124, -0.42);
  const deep = door(6, 176, 0.14);

  const lap = (to: number, via: P2[]) => lapTo(glasses, to, via, LEAD);
  const laps = [
    lap(right, [
      [-5, 44],
      [3, 70],
    ]),
    lap(deep, [
      [4, 46],
      [-7, 88],
      [-3, 128],
    ]),
    lap(left, [
      [5, 42],
      [0, 76],
    ]),
  ];
  const guides = laps.map((l) => l.guide);

  // mirrors, wherever there is room: clear of the ways, of the doors, of each other, and of the view down the lane
  const random = rng(look.layout * 7919 + 13);
  const clear = (x: number, z: number, room: number) => {
    for (const l of guides)
      for (let i = 0; i < l.x.length; i += 8)
        if (Math.hypot(l.x[i] - x, l.z[i] - z) < room) return false;
    return true;
  };
  let tries = 0;
  while (glasses.length < 3 + look.mirrors && tries++ < 4000) {
    // more of them near the lane than far out, and more ahead than behind
    const z = -60 + 460 * Math.pow(random(), 1.25);
    const side = random() < 0.5 ? -1 : 1;
    const x = side * (9 + 85 * Math.pow(random(), 1.6));
    const w = 1.8 + 1.9 * random();
    const h = w * (2.2 + 1.2 * random());
    const turn = (random() - 0.5) * 1.3;
    if (
      Math.hypot(x, z) < 22 ||
      (z > 150 && Math.abs(x) < 11) ||
      !clear(x, z, 9)
    )
      continue;
    if (glasses.some((g) => Math.hypot(g.x - x, g.z - z) < (g.door ? 16 : 13)))
      continue;
    // looking back down the lane, at where the eye comes from, give or take
    const face = Math.atan2(-x, -70) + turn;
    glasses.push({ x, z, face, w, h, door: false, ground: 0, bottom: 0 });
  }

  const oasis = { x: 0, z: look.oasisFar, ground: 0 };
  const pads: number[][] = [
    // the wide ones: the lane, and the oasis at its end
    [0, -160, 0, look.oasisFar + 40, look.lane, 55, 1, 0, 0.93, 0, 0, -160],
    [
      oasis.x,
      oasis.z,
      oasis.x,
      oasis.z + 1,
      90,
      110,
      1,
      1,
      1,
      0,
      oasis.x,
      oasis.z,
    ],
  ];
  const wide = pads.length;
  // and on those: the start, and the last of the way into each door
  pads.push([0, -2 * LEAD, 0, 2.5 * LEAD, 9, 18, 0, 0, 1, 0, 0, -2 * LEAD]);
  for (const g of glasses) {
    if (!g.door) continue;
    const f = dir(g.face + Math.PI);
    const from: P2 = [g.x - 2.5 * LEAD * f[0], g.z - 2.5 * LEAD * f[1]];
    pads.push([
      ...from,
      g.x + 2 * f[0],
      g.z + 2 * f[1],
      8,
      16,
      0,
      0,
      1,
      0,
      ...from,
    ]);
  }
  return {
    glasses,
    laps,
    pads,
    wide,
    length: laps.reduce((t, l) => t + l.length, 0),
    startGround: 0,
    oasis,
    rocks: [],
    lead: LEAD,
    ride: { reach: 5, soft: 3, level: 2 * LEAD, ease: 24 },
  };
}

// A boulder's faces: flat cuts of a ball, each touching a squashed, turned egg inside it, some deeper than others.
function boulder(
  random: () => number,
  r: number,
): { faces: number[]; round: number } {
  const [sx, sy, sz] = [
    0.75 + 0.5 * random(),
    0.5 + 0.3 * random(),
    0.75 + 0.5 * random(),
  ];
  const turn = random() * Math.PI;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  const faces: number[] = [];
  for (let i = 0; i < 16; i++) {
    // spread evenly over the ball, then each pushed off its place
    const y = 1 - (2 * (i + 0.5)) / 16;
    const a = i * 2.39996 + turn;
    const q = Math.sqrt(1 - y * y);
    let n = [
      q * Math.cos(a) + 0.7 * (random() - 0.5),
      y + 0.7 * (random() - 0.5),
      q * Math.sin(a) + 0.7 * (random() - 0.5),
    ];
    const len = Math.hypot(n[0], n[1], n[2]);
    n = n.map((v) => v / len);
    const [ex, ez] = [n[0] * c + n[2] * s, -n[0] * s + n[2] * c];
    const far =
      Math.hypot(sx * ex, sy * n[1], sz * ez) * r * (0.7 + 0.3 * random());
    faces.push(n[0], n[1], n[2], far);
  }
  return { faces, round: r * Math.max(sx, sz) * 1.12 };
}

// The same things close together: a valley floor of small dunes and boulders, three doors within 70 m of the
// start, and the mirrors crowding the ways to them, so that the eye goes slowly and close by.
function createGarden(look: typeof worldDefaults): World {
  const lead = 5;
  const glasses: Glass[] = [];
  const door = (x: number, z: number, into: number) =>
    glasses.push({
      x,
      z,
      face: into + Math.PI,
      w: look.doorWide,
      h: look.doorTall,
      door: true,
      ground: 0,
      bottom: 0,
    }) - 1;
  const right = door(12.5, 43, 0.46);
  const left = door(-11.5, 50, -0.4);
  const deep = door(2.5, 68, 0.1);
  const lap = (to: number, via: P2[]) => lapTo(glasses, to, via, lead);
  const laps = [
    lap(right, [[-3.5, 20]]),
    lap(deep, [
      [4, 20],
      [-5, 36],
      [-1.5, 50],
    ]),
    lap(left, [
      [4.5, 19],
      [1, 32],
    ]),
  ];
  const guides = laps.map((l) => l.guide);

  const random = rng(look.layout * 7919 + 131);
  // how near a place is to the ways
  const off = (x: number, z: number) => {
    let least = 1e9;
    for (const l of guides)
      for (let i = 0; i < l.x.length; i += 4)
        least = Math.min(least, Math.hypot(l.x[i] - x, l.z[i] - z));
    return least;
  };
  // a place beside a way: so far along one of them, so far to a side; and the way to look from it to see the
  // eye coming
  const beside = (from: number, to: number): [number, number, number] => {
    const l = guides[Math.floor(random() * guides.length)];
    const i = 1 + Math.floor(random() * (l.x.length - 2));
    const t = [l.x[i + 1] - l.x[i - 1], l.z[i + 1] - l.z[i - 1]];
    const len = Math.hypot(t[0], t[1]) || 1;
    const side =
      (random() < 0.5 ? -1 : 1) *
      (from + (to - from) * Math.pow(random(), 1.4));
    const [x, z] = [l.x[i] + (side * t[1]) / len, l.z[i] - (side * t[0]) / len];
    const j = Math.max(0, i - 40);
    return [x, z, Math.atan2(l.x[j] - x, l.z[j] - z)];
  };
  const fits = (x: number, z: number, w: number, room: number) =>
    off(x, z) >= 2 + w / 2 &&
    Math.hypot(x, z) >= 6 &&
    !(z > 60 && Math.abs(x - 2) < 4.5) &&
    !glasses.some((g) => Math.hypot(g.x - x, g.z - z) < (g.door ? 6.5 : room));
  // tall and thin, most of them
  const slab = () => {
    const w = 0.9 + 1.5 * random();
    return [w, Math.min(7.5, w * (2.3 + 1.6 * random()))];
  };
  // first an avenue: along each way one every few metres, now on this side and now on that, near enough to
  // touch, and turned to the eye as it comes (give or take a good deal)
  for (const l of guides) {
    let side = random() < 0.5 ? -1 : 1;
    for (
      let s = 9 + 4 * random();
      s < l.length - 7 && glasses.length < 3 + look.mirrors;
      s += 5.5 + 4 * random()
    ) {
      const i = Math.min(l.x.length - 2, Math.round(s / l.step));
      const t = [l.x[i + 1] - l.x[i - 1], l.z[i + 1] - l.z[i - 1]];
      const len = Math.hypot(t[0], t[1]) || 1;
      const [w, h] = slab();
      side = random() < 0.25 ? side : -side;
      const out = side * (2.1 + w / 2 + 2.6 * random() * random());
      const [x, z] = [l.x[i] + (out * t[1]) / len, l.z[i] - (out * t[0]) / len];
      if (!fits(x, z, w, 3.4)) continue;
      const j = Math.max(0, i - 36);
      glasses.push({
        x,
        z,
        face: Math.atan2(l.x[j] - x, l.z[j] - z) + (random() - 0.5) * 1.3,
        w,
        h,
        door: false,
        ground: 0,
        bottom: 0,
      });
    }
  }
  // then the rest, further off the ways, down the valley and behind the start
  let tries = 0;
  while (glasses.length < 3 + look.mirrors && tries++ < 8000) {
    const [w, h] = slab();
    let [x, z, face] = beside(5, 18);
    if (random() < 0.4) {
      x = (random() < 0.5 ? -1 : 1) * (5 + 24 * random());
      z = -30 + 160 * random();
      face = Math.atan2(-x, -25);
    }
    if (!fits(x, z, w, 4.2)) continue;
    glasses.push({
      x,
      z,
      face: face + (random() - 0.5) * 1.5,
      w,
      h,
      door: false,
      ground: 0,
      bottom: 0,
    });
  }

  // boulders: a few big ones, each with smaller ones about it, and stones on their own
  const rocks: Rock[] = [];
  const rock = (x: number, z: number, r: number) => {
    if (
      rocks.length >= look.rocks ||
      off(x, z) < 1.7 + 1.1 * r ||
      Math.hypot(x, z) < 5 + r
    )
      return false;
    if (
      glasses.some(
        (g) =>
          Math.hypot(g.x - x, g.z - z) < (g.door ? 4.5 : g.w / 2 + 0.4) + r,
      )
    )
      return false;
    if (rocks.some((k) => Math.hypot(k.x - x, k.z - z) < 0.75 * (k.r + r)))
      return false;
    rocks.push({
      x,
      z,
      r,
      ...boulder(random, r),
      sunk: 0.1 + 0.3 * random(),
      tone: 0.75 + 0.5 * random(),
      y: 0,
    });
    return true;
  };
  tries = 0;
  while (rocks.length < look.rocks && tries++ < 4000) {
    const [x, z] =
      random() < 0.75
        ? beside(2.5, 13)
        : [(random() - 0.5) * 60, -25 + 150 * random()];
    const big = random() < 0.3;
    const r =
      look.rockSize * (big ? 0.7 + 0.9 * random() : 0.16 + 0.4 * random());
    if (!rock(x, z, r) || !big) continue;
    for (let k = 0, n = 2 + Math.floor(random() * 4); k < n; k++) {
      const [a, d] = [random() * 2 * Math.PI, r * (0.9 + 2.2 * random())];
      rock(
        x + Math.cos(a) * d,
        z + Math.sin(a) * d,
        look.rockSize * (0.12 + 0.35 * random()),
      );
    }
  }

  // in eights of neighbours: the one nearest the start that is not yet in a group, and the seven nearest it
  const loose = rocks.splice(0);
  while (loose.length) {
    loose.sort((a, b) => a.z - b.z);
    const first = loose.shift()!;
    loose.sort(
      (a, b) =>
        Math.hypot(a.x - first.x, a.z - first.z) -
        Math.hypot(b.x - first.x, b.z - first.z),
    );
    rocks.push(first, ...loose.splice(0, 7));
  }

  const oasis = { x: 0, z: look.oasisFar, ground: 0 };
  const pads: number[][] = [
    // the valley; beyond the doors its floor is bare, for the mirage to lie on; and the oasis at its end
    [0, -160, 0, look.oasisFar + 40, look.lane, 42, 1, 0, 0.93, 0, 0, -160],
    [0, 135, 0, look.oasisFar + 40, look.lane, 40, 1, 0, 0.93, 1, 0, -160],
    [
      oasis.x,
      oasis.z,
      oasis.x,
      oasis.z + 1,
      90,
      110,
      1,
      1,
      1,
      1,
      oasis.x,
      oasis.z,
    ],
  ];
  const wide = pads.length;
  // level sand at the start and before each door, as wide as a door and no more
  pads.push([0, -1.5 * lead, 0, 1.5 * lead, 3.2, 7, 0, 0, 1, 1, 0, 0]);
  for (const g of glasses) {
    if (!g.door) continue;
    const f = dir(g.face + Math.PI);
    pads.push([
      g.x - 1.5 * lead * f[0],
      g.z - 1.5 * lead * f[1],
      g.x + 1.5 * f[0],
      g.z + 1.5 * f[1],
      3.2,
      7,
      0,
      0,
      1,
      1,
      g.x,
      g.z,
    ]);
  }
  return {
    glasses,
    laps,
    pads,
    wide,
    length: laps.reduce((t, l) => t + l.length, 0),
    startGround: 0,
    oasis,
    rocks,
    lead,
    ride: { reach: 1, soft: 1.6, level: lead, ease: 10 },
  };
}

// the points whose ground the world needs to know: under each glass (middle and both ends), the start, the
// oasis, along the laps every 2 m, and under each boulder
export function asks(world: World): number[] {
  const pts: number[] = [0, 0, world.oasis.x, world.oasis.z];
  for (const g of world.glasses) {
    const along: P2 = [Math.cos(g.face), -Math.sin(g.face)];
    for (const k of [0, -1, 1])
      pts.push(g.x + (k * along[0] * g.w) / 2, g.z + (k * along[1] * g.w) / 2);
  }
  for (const l of world.laps)
    for (let i = 0; i < l.x.length; i += 8) pts.push(l.x[i], l.z[i]);
  for (const k of world.rocks) pts.push(k.x, k.z);
  return pts;
}

export function settle(
  world: World,
  look: typeof worldDefaults,
  heights: Float32Array | number[],
) {
  let at = 0;
  world.startGround = heights[at++];
  world.oasis.ground = heights[at++];
  for (const g of world.glasses) {
    const [mid, a, b] = [heights[at++], heights[at++], heights[at++]];
    g.ground = mid;
    g.bottom = Math.min(mid, a, b) - 0.25;
  }
  for (const l of world.laps) {
    const n = Math.ceil(l.x.length / 8);
    const under: number[] = [];
    for (let i = 0; i < n; i++) under.push(heights[at++]);
    // over the highest ground a little way either way, then smoothed: it rides over a rise, never into it
    const { reach, soft: wide, level, ease: easing } = world.ride;
    const high = under.map((_, i) =>
      Math.max(...under.slice(Math.max(0, i - reach), i + reach + 1)),
    );
    const span = Math.round((wide * 8) / 3);
    const soft = high.map((_, i) => {
      let sum = 0;
      let weight = 0;
      for (let k = -span; k <= span; k++) {
        const w = Math.exp(-(k * k) / (2 * wide * wide));
        sum += w * high[Math.min(n - 1, Math.max(0, i + k))];
        weight += w;
      }
      return sum / weight;
    });
    const end = world.glasses[l.door].ground;
    for (let i = 0; i < l.x.length; i++) {
      const s = i * l.step;
      const j = Math.min(n - 2, Math.floor(i / 8));
      const f = i / 8 - j;
      const ride = soft[j] + (soft[j + 1] - soft[j]) * f;
      // dead level at both ends, as it is dead straight there
      const ease = (v: number) => {
        const u = Math.min(1, Math.max(0, v));
        return u * u * (3 - 2 * u);
      };
      const a = ease((s - level) / easing);
      const b = ease((l.length - level - s) / easing);
      l.y[i] =
        look.eye +
        (a < 1
          ? world.startGround + (ride - world.startGround) * a
          : end + (ride - end) * b);
    }
  }
  for (const k of world.rocks) k.y = heights[at++] + k.sunk * k.r;
}

// going through a door: a point of the world just inside it is this point of the world at the start
export function through(world: World, door: number, p: V3): V3 {
  const g = world.glasses[door];
  const turn = -(g.face + Math.PI);
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  const [x, z] = [p[0] - g.x, p[2] - g.z];
  return [x * c + z * s, p[1] - g.ground + world.startGround, -x * s + z * c];
}
export function back(world: World, door: number, p: V3): V3 {
  const g = world.glasses[door];
  const turn = g.face + Math.PI;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  return [
    g.x + p[0] * c + p[2] * s,
    p[1] - world.startGround + g.ground,
    g.z - p[0] * s + p[2] * c,
  ];
}

// the eye's place on lap `k`, s metres along it; before its start or past its end it is on the lap before or
// after, seen from this one's world (so the way is one unbroken curve, however far it is followed)
export function along(world: World, k: number, s: number): V3 {
  const n = world.laps.length;
  const l = world.laps[((k % n) + n) % n];
  if (s > l.length)
    return back(world, l.door, along(world, k + 1, s - l.length));
  if (s < 0) {
    const prev = world.laps[(((k - 1) % n) + n) % n];
    return through(world, prev.door, along(world, k - 1, prev.length + s));
  }
  const i = Math.min(l.x.length - 2, Math.floor(s / l.step));
  const f = s / l.step - i;
  return [
    l.x[i] + (l.x[i + 1] - l.x[i]) * f,
    l.y[i] + (l.y[i + 1] - l.y[i]) * f,
    l.z[i] + (l.z[i + 1] - l.z[i]) * f,
  ];
}

// which lap the loop is on at a moment of it (0..1), and how far along
export function where(world: World, playhead: number): [number, number] {
  let s = (((playhead % 1) + 1) % 1) * world.length;
  for (let k = 0; k < world.laps.length; k++) {
    // (the last 2 mm before a door count as through it: a ray that starts within a millimetre of a glass does
    // not meet it, and the one frame in eighty that fell there showed what is behind the door instead)
    if (s < world.laps[k].length - 0.002) return [k, s];
    s = Math.max(0, s - world.laps[k].length);
  }
  return [0, 0];
}
