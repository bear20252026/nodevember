// A ball built of the same things as the stairs page: cubes, and on them stairs, fans, small cubes and arches.
//
// The flat pile was a field of columns, and showed one side: every face of it looked along (1, 1, 1). A ball
// has eight such sides, one for each way the three axes can point, and what holds in each is the same rule
// turned round: a cube is there only if the cubes behind it, toward the middle along each axis, are there. So
// seen along any of the eight diagonals a side is a pile like the flat one, and they meet along the three
// middle planes without a seam, because they are one body.
//
// Every empty cell that touches the body is then looked at for what it touches: two cubes (floor and wall, an
// inner edge) can take stairs, three (an inner corner) a fan, stairs or a small cube; and a cube's bare face
// can take an arch. Each is laid in its cell by flips and an order of the axes, as on the flat page, so the
// shapes are the very same ones (the shader takes them from the stairs page's file).

export type PlanetOptions = {
  seed: number;
  size: number; // the ball's radius, in cubes
  round: number; // 1: eight flat sides (an octahedron). 2: a ball. Between: between
  rough: number; // cubes added or taken away, per cube of the surface
  stairs: number; // 0..1: how much of the inner edges gets stairs
  fans: number; // 0..1: how many inner corners get a fan
  pleats: number; // 0..1: how many get stairs
  cubes: number; // 0..1: how many get a small cube
  arches: number; // 0..1: how many bare faces get an arch
  pairs: number; // 0..1: how many of the cubes with an arch get a second in another face, joined to it
};
export const planetDefaults: PlanetOptions = { seed: 7, size: 9, round: 1.6, rough: 0.9, stairs: 0.5, fans: 0.3, pleats: 0.25, cubes: 0.12, arches: 0.2, pairs: 0.6 };

export const WORDS = 4; // numbers per cell: what it is and what stands in it, and an arch for each of its three outward faces
export const KIND = { none: 0, stair: 1, fan: 2, cube: 3 };
const ORDER: Record<string, number> = { xyz: 0, xzy: 1, yxz: 2, yzx: 3, zxy: 4, zyx: 5 };
const AXES = "xyz";

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function createPlanet(options: Partial<PlanetOptions> = {}) {
  const o = { ...planetDefaults, ...options };
  const rand = rng(o.seed);
  const half = Math.ceil(o.size) + 4; // cells from the middle to the edge of the grid: the ball, what is added, and air
  const G = half * 2;
  const at = (c: number[]) => ((c[2] + half) * G + c[1] + half) * G + c[0] + half;
  const inside = (c: number[]) => c.every((v) => v >= -half && v < half);
  const solid = new Uint8Array(G * G * G);
  const far = (c: number[]) => (Math.abs(c[0] + 0.5) ** o.round + Math.abs(c[1] + 0.5) ** o.round + Math.abs(c[2] + 0.5) ** o.round) ** (1 / o.round);
  const out = (c: number[], a: number) => (c[a] >= 0 ? 1 : -1); // which way is outward along an axis
  const step = (c: number[], a: number, by: number) => c.map((v, n) => (n === a ? v + by : v));
  const is = (c: number[]) => inside(c) && solid[at(c)] === 1;

  // ---- the body
  const all: number[][] = [];
  for (let z = -half; z < half; z++) for (let y = -half; y < half; y++) for (let x = -half; x < half; x++) all.push([x, y, z]);
  for (const c of all) if (far(c) < o.size) solid[at(c)] = 1;
  // roughened as the flat pile is: a cube more where the three behind it are there, a cube less where nothing is before it
  const shell = all.filter((c) => Math.abs(far(c) - o.size) < 2.5);
  let faces = 0;
  for (const c of shell) if (is(c)) for (let a = 0; a < 3; a++) if (!is(step(c, a, out(c, a)))) faces++;
  for (let n = Math.round((o.rough * faces) / 3) * 4; n > 0; n--) {
    const c = shell[Math.floor(rand() * shell.length)];
    const here = solid[at(c)];
    if (rand() < 0.5) {
      // (a cube against a middle plane has nothing behind it that way: the other side begins there)
      if (!here && far(c) < o.size + 1.6 && [0, 1, 2].every((a) => c[a] === 0 || c[a] === -1 || is(step(c, a, -out(c, a))))) solid[at(c)] = 1;
    } else if (here && far(c) > o.size - 1.6 && [0, 1, 2].every((a) => !is(step(c, a, out(c, a))))) solid[at(c)] = 0;
  }

  // slow fields, so that neighbouring cells tend to choose alike and stairs join into flights
  const waves = Array.from({ length: 5 }, () => [Math.round(rand() * 4 - 2), Math.round(rand() * 4 - 2), Math.round(rand() * 4 - 2), rand() * Math.PI * 2]);
  const field = (c: number[]) => waves.reduce((sum, [a, b, d, e]) => sum + Math.cos(((a * c[0] + b * c[1] + d * c[2]) / 8) * Math.PI * 2 + e), 0) / 5;

  // ---- what stands in the empty cells that touch the body
  const data = new Uint32Array(G * G * G * WORDS);
  const count = { cube: 0, stair: 0, fan: 0, small: 0, arch: 0, pair: 0 };
  const put = (c: number[], kind: number, flips: number, order: string) => (data[at(c) * WORDS] = (kind << 1) | ((flips | (ORDER[order] << 3)) << 4));
  for (const c of all) {
    if (solid[at(c)]) {
      data[at(c) * WORDS] = 1;
      count.cube++;
      continue;
    }
    // the cubes it touches are behind it, toward the middle: against the low side of the cell where the cell is
    // on the high side of the ball, and the other way round, which the flips put right
    const touch = [0, 1, 2].filter((a) => is(step(c, a, -out(c, a))));
    const flips = [0, 1, 2].reduce((bits, a) => bits | (out(c, a) < 0 ? 1 << a : 0), 0);
    const [r, way, which] = [rand(), rand(), rand()];
    if (touch.length === 2) {
      // an inner edge: stairs, standing on one of the two and leaning on the other. Mostly on the one that is more
      // underfoot, for whoever stands on the ball here
      if (field(c) < 0.3 - o.stairs) continue;
      const [a, b] = touch;
      const under = Math.abs(c[a] + 0.5) > Math.abs(c[b] + 0.5) ? a : b;
      const v = way < 0.75 ? under : a + b - under;
      const u = a + b - v;
      put(c, KIND.stair, flips, AXES[u] + AXES[v] + AXES[3 - u - v]);
      count.stair++;
    } else if (touch.length === 3) {
      // an inner corner
      const orders = Object.keys(ORDER);
      if (r < o.fans) (put(c, KIND.fan, flips, orders[Math.floor(way * 6)]), count.fan++);
      else if (r < o.fans + o.pleats) (put(c, KIND.stair, flips, orders[Math.floor(way * 6)]), count.stair++);
      else if (r < o.fans + o.pleats + o.cubes) (put(c, KIND.cube, flips, "xyz"), count.small++);
      void which;
    }
  }

  // ---- arches, cut into the bare faces of cubes
  // one number each: there(1) lay(6) the face its twin is in, counted from 1 (2) half width(5) from(5) to(5)
  // depth(5), the last four in 31sts, and a last bit for one of two that meet inside the cube
  const q = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 31);
  for (const c of all) {
    if (!solid[at(c)]) continue;
    // the faces that could take one: outward, with nothing standing before them
    const bare = [0, 1, 2].filter((a) => {
      const before = step(c, a, out(c, a));
      return inside(before) && !solid[at(before)] && data[at(before) * WORDS] === 0;
    });
    const picks = [rand(), rand(), rand()];
    const [twin, turn, door, wide, tall, from, deep] = [rand(), rand(), rand(), rand(), rand(), rand(), rand()];
    let cut = bare.filter((a) => picks[a] < o.arches);
    if (!cut.length) continue;
    // a second in another bare face, alike and joined to the first: and never two that are not (each for itself
    // they would cut across one another inside the cube)
    if (cut.length === 1 && bare.length > 1 && twin < o.pairs) cut = [cut[0], bare.find((a) => a !== cut[0])!];
    cut = cut.slice(0, twin < o.pairs ? 2 : 1);
    const long = 0.42 + tall * 0.3;
    const lo = door < 0.2 ? 0 : (1 - long) * (0.35 + from * 0.3);
    const shape = (q(0.13 + wide * 0.08) << 11) | (q(lo) << 16) | (q(lo + long) << 21) | (q(0.3 + deep * 0.45) << 26);
    cut.forEach((a, n) => {
      // across it and up it are the other two axes: up is the one both faces share, where there are two
      const others = [0, 1, 2].filter((b) => b !== a);
      const up = cut.length === 2 ? 3 - cut[0] - cut[1] : others[turn < 0.5 ? 0 : 1];
      const across = 3 - a - up;
      const flips = (out(c, a) > 0 ? 1 << a : 0) | (turn * 2 - Math.floor(turn * 2) < 0.3 ? 1 << up : 0);
      const lay = flips | (ORDER[AXES[across] + AXES[up] + AXES[a]] << 3);
      const other = cut.length === 2 ? cut[1 - n] + 1 : 0;
      data[at(c) * WORDS + 1 + a] = (1 | (lay << 1) | (other << 7) | shape | (other ? 0x80000000 : 0)) >>> 0;
      count.arch++;
    });
    if (cut.length === 2) count.pair++;
  }
  return { G, half, data, count };
}
