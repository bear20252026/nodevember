// The generator: a random pile of cubes, and what is put on it.
//
// The pile is a stepped surface: over every column (i, k) of a square grid the cubes are stacked up to a
// height H, and H never rises as i or k grow. Seen along the cube diagonal such a pile shows every one of its
// faces, the three directions in equal measure, and no direction is "up" more than another.
// Written as H(i, k) = g(i, k) - i - k, the pile repeats on the screen when g repeats every P columns, so one
// tile of it can be scrolled for ever. g = 0 is the plain pattern of cubes; a random pile is made from it by
// adding and taking away single cubes wherever the rule g(next) <= g(here) + 1 allows.
//
// On the pile, every decoration sits in one unit cell:
//   stairs fill an inner edge (floor and wall, or wall and wall: those are the upright pleats),
//   fans (stairs that turn a quarter round a line) and small cubes fill an inner corner,
//   arches are cut into a face of a cube, and stand on the floor as doors where they can.
// Each is laid in its cell by one of the cube's 48 symmetries (three flips, then one of six orders of the axes),
// so the shader knows one staircase, one fan and one arch.

export type WorldOptions = {
  P: number; // columns before the pile repeats (even)
  seed: number;
  rough: number; // cubes added or taken away, per column
  stairs: number; // 0..1: how much of the inner edges gets stairs
  pleats: number; // 0..1: how many inner corners get upright pleats
  fans: number; // 0..1: how many get a fan
  cubes: number; // 0..1: how many get a small cube
  arches: number; // 0..1: how many faces get an arch
  // two later additions, off unless asked for. They draw their chances from a generator of their own, so that at 0
  // the pile is to the last cube the one it is without them
  flights: number; // long flights laid on purpose, per column
  long: number; // cells in the longest of them
  passages: number; // 0..1: how many of the cubes that could have a way through them get one
  pairs: number; // 0..1: how many of the arches in a wall get a twin in the cube's other wall, where it is bare (and a fifth as many bare cubes get a pair outright)
  path: number; // 1: one way through the whole pile, along x, a repeat on each time round (0: none)
};
export const worldDefaults: WorldOptions = { P: 8, seed: 7, rough: 1.2, stairs: 0.55, pleats: 0.3, fans: 0.3, cubes: 0.15, arches: 0.22, flights: 0, long: 4, passages: 0.1, pairs: 0.8, path: 1 };

export const WORDS = 8; // numbers per column in `data`
export const KIND = { none: 0, stair: 1, fan: 2, cube: 3 };
const APART = 2; // columns between one way through and the next, at least

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// a symmetry of the cube: which axes are turned round (x: 1, y: 2, z: 4), then which order they are read in
const ORDER = { xyz: 0, xzy: 1, yxz: 2, yzx: 3, zxy: 4, zyx: 5 };
const lay = (flips: number, order: keyof typeof ORDER) => flips | (ORDER[order] << 3);

// The ways a fan may lie. Of the six orders of the axes, two ("xzy", "zxy") turn the fronts of the steps down to
// the floor and hang the fan over it: nobody could walk up that. In their two places stand the orders that put
// the same fan the other way up against the same wall (so a seed's other fans are where they were).
const FANS = ["xyz", "zyx", "yzx", "yzx", "yxz", "yxz"] as const;

export function createWorld(options: Partial<WorldOptions> = {}) {
  const o = { ...worldDefaults, ...options };
  const P = o.P;
  const rand = rng(o.seed);
  const extra = rng(o.seed ^ 0x5bd1e995); // for the flights and the ways through
  const at = (i: number, k: number) => (((k % P) + P) % P) * P + (((i % P) + P) % P);

  // ---- the pile
  const g = new Int32Array(P * P);
  for (let n = Math.round(o.rough * P * P * 4); n > 0; n--) {
    const i = Math.floor(rand() * P);
    const k = Math.floor(rand() * P);
    const here = g[at(i, k)];
    if (rand() < 0.5) {
      // a cube on top: allowed where the column is no higher than the two it leans on
      if (here <= g[at(i - 1, k)] && here <= g[at(i, k - 1)] && here < 2) g[at(i, k)]++;
    } else if (g[at(i + 1, k)] <= here && g[at(i, k + 1)] <= here && here > -2) g[at(i, k)]--;
  }

  // slow fields, so that neighbouring columns tend to choose alike and stairs join into flights
  const field = () => {
    const waves = Array.from({ length: 4 }, () => [Math.round(rand() * 4 - 2), Math.round(rand() * 4 - 2), rand() * Math.PI * 2]);
    return (i: number, k: number) => waves.reduce((sum, [a, b, c]) => sum + Math.cos(((a * i + b * k) / P) * Math.PI * 2 + c), 0) / 4;
  };
  const alongX = field();
  const alongZ = field();

  // ---- One way that goes through the whole pile along x and comes out a repeat further on, where it began: so
  // it goes on for ever, the way the picture drifts. Down stairs and fans, along level stretches, now and then a
  // row across and back. It is cut into the pile, column by column, and the columns about it are put right to
  // the rule about neighbours; nothing else is touched. What each of its columns is:
  // 1 level, 2 stairs down along x, 3 a fan down along x, 4 stairs down along z, 5 stairs up toward -z
  const onPath = new Int8Array(P * P);
  const path: { i: number; k: number; s: number }[] = [];
  for (let tries = 0; o.path > 0 && tries < 400 && !path.length; tries++) {
    // the moves: P along x, and one or two jogs across a row (there, some way on, and back)
    const moves: string[] = Array(P).fill("x");
    // (along x the pile goes down a cube a column, so a level step along x must be paid for by one back across a
    // row: the jogs are what make the level stretches)
    const jogs = extra() < 0.75 ? 2 : 1;
    let ok = true;
    const used = new Set<number>();
    for (let j = 0; j < jogs && ok; j++) {
      const a = 1 + Math.floor(extra() * (P - 3));
      const b = a + 2 + Math.floor(extra() * 3);
      if (b > P - 1 || [...used].some((u) => u >= a - 1 && u <= b + 1)) {
        ok = false;
        break;
      }
      for (let u = a; u <= b; u++) used.add(u);
      const there = extra() < 0.5 ? "+z" : "-z";
      // (put in at x-move counts a and b: later first, so the earlier place stays where it is)
      const back = there === "+z" ? "-z" : "+z";
      const xs = moves.map((m, n) => (m === "x" ? n : -1)).filter((n) => n >= 0);
      moves.splice(xs[b], 0, back);
      moves.splice(xs[a], 0, there);
    }
    if (!ok) continue;
    // how high each step goes: level, or down (stairs or a fan in the column stepped into); up only toward -z
    const dg: number[] = moves.map((m) => (m === "-z" ? (extra() < 0.85 ? -1 : 0) : extra() < 0.42 ? 1 : 0));
    let sum = dg.reduce((t, v) => t + v, 0);
    for (let guard = 0; sum !== 0 && guard < 50; guard++) {
      const n = Math.floor(extra() * moves.length);
      if (sum > 0 && dg[n] === 1) (dg[n] = 0), sum--;
      else if (sum < 0 && dg[n] === -1) (dg[n] = 0), sum++;
      else if (sum < 0 && moves[n] !== "-z" && dg[n] === 0) (dg[n] = 1), sum++;
    }
    if (sum !== 0) continue;
    // the columns, and what each is
    const i0 = Math.floor(extra() * P);
    const k0 = Math.floor(extra() * P);
    const cols = [{ i: i0, k: k0 }];
    for (const m of moves) {
      const l = cols[cols.length - 1];
      cols.push({ i: l.i + (m === "x" ? 1 : 0), k: l.k + (m === "+z" ? 1 : m === "-z" ? -1 : 0) });
    }
    cols.pop(); // (the last is the first, a repeat on)
    const kind = new Int8Array(cols.length).fill(1);
    for (let n = 0; n < moves.length && ok; n++) {
      const to = (n + 1) % cols.length;
      if (dg[n] !== 0) continue;
      if (moves[n] === "-z") {
        if (kind[n] !== 1) ok = false;
        kind[n] = 5;
      } else {
        if (kind[to] !== 1) ok = false;
        kind[to] = moves[n] === "x" ? 2 : 4;
      }
    }
    // (up toward -z: it is come into at its foot, on the level)
    for (let n = 0; n < cols.length && ok; n++) if (kind[n] === 5 && dg[(n - 1 + cols.length) % cols.length] !== 1 && moves[(n - 1 + cols.length) % cols.length] !== "+z") ok = false;
    // (and the way begins on a level column)
    if (!ok || kind[0] !== 1) continue;
    // heights, and the pile about put right
    const g2 = Int32Array.from(g);
    const mine = new Set<number>();
    let level = g[at(i0, k0)];
    cols.forEach((c, n) => {
      g2[at(c.i, c.k)] = level;
      mine.add(at(c.i, c.k));
      level += dg[n];
    });
    if (mine.size !== cols.length) continue;
    for (let pass = 0; pass < 60 && ok; pass++) {
      let changed = false;
      for (let c = 0; c < P * P && ok; c++) {
        const [i, k] = [c % P, Math.floor(c / P)];
        for (const n of [at(i + 1, k), at(i, k + 1)]) {
          if (g2[n] <= g2[c] + 1) continue;
          if (!mine.has(n)) g2[n] = g2[c] + 1;
          else if (!mine.has(c)) g2[c] = g2[n] - 1;
          else ok = false;
          changed = true;
        }
      }
      if (!changed) break;
    }
    if (!ok || g2.some((v) => Math.abs(v) > 4)) continue;
    g.set(g2);
    cols.forEach((c, n) => {
      let k = kind[n];
      // some of the stairs down along x are fans: where the column is in a corner, and the way goes on along x
      const here = at(c.i, c.k);
      // (not one fan straight after another: the first ends against its wall at one side, the next begins at the other)
      const before = n > 0 ? onPath[at(cols[n - 1].i, cols[n - 1].k)] : 0;
      if (k === 2 && moves[n] === "x" && before !== 3 && g[at(c.i, c.k - 1)] >= g[here] && !mine.has(at(c.i, c.k - 1)) && extra() < 0.45) k = 3;
      onPath[here] = k;
      path.push({ i: c.i, k: c.k, s: g[here] });
    });
  }
  // (so that nothing else is laid on it)
  const reserved = (c: number) => onPath[c] !== 0;

  // ---- long flights. A flight is a run of columns that each stand one lower than the one before, which is a run
  // of equal g; where the pile does not already give one, it is cut to (as far as the rule about neighbours allows)
  const flight = new Int8Array(P * P); // 1: stairs that climb toward -x, 2: toward -z, 3: the landing at the top of one (left as it is)
  const fits = (i: number, k: number, v: number) => v <= g[at(i - 1, k)] + 1 && v <= g[at(i, k - 1)] + 1 && g[at(i + 1, k)] <= v + 1 && g[at(i, k + 1)] <= v + 1;
  const flights: number[] = [];
  const least = Math.min(3, o.long); // shorter runs than this the stairs make by themselves
  for (let n = Math.round(o.flights * P * P); n > 0; n--) {
    const i0 = Math.floor(extra() * P);
    const k0 = Math.floor(extra() * P);
    const x = extra() < 0.5; // which way it runs
    const want = least + Math.floor(extra() * (o.long - least + 1));
    const wide = extra() < 0.2 ? 2 : 1;
    const col = (n: number, w: number) => (x ? at(i0 + n, k0 + w) : at(i0 + w, k0 + n));
    const cut: [number, number][] = []; // what the pile was, to put it back if the flight comes out short
    const set = (n: number, w: number, v: number) => {
      const c = col(n, w);
      if (flight[c] || reserved(c)) return false;
      const [i, k] = [c % P, Math.floor(c / P)];
      cut.push([c, g[c]]);
      g[c] = v;
      return fits(i, k, v);
    };
    const taken = (c: number) => flight[c] === 1 || flight[c] === 2;
    // the column above the top of the flight is its landing: one more of the same g
    const g0 = g[col(-1, 0)];
    let len = 0;
    while (len < want && len < P - 2) {
      // not alongside another flight: two of them together read as one slab of steps
      let ok = !taken(col(len, -1)) && !taken(col(len, wide));
      const mark = cut.length;
      // side by side at the same heights: one more in g for each column across
      for (let w = 0; w < wide && ok; w++) ok = (w === 0 || len > 0 || g[col(-1, w)] >= g0 + w) && set(len, w, g0 + w);
      if (!ok) {
        while (cut.length > mark) g[cut[cut.length - 1][0]] = cut.pop()![1];
        break;
      }
      len++;
    }
    if (len < least) {
      while (cut.length) g[cut[cut.length - 1][0]] = cut.pop()![1];
      continue;
    }
    for (let m = 0; m < len; m++) for (let w = 0; w < wide; w++) flight[col(m, w)] = x ? 1 : 2;
    for (let w = 0; w < wide; w++) if (!flight[col(-1, w)]) flight[col(-1, w)] = 3;
    flights.push(len);
  }

  // ---- ways through. A cube whose two walls stand on floors at one level can have a door in each that meet inside it.
  // The two floors are then kept clear for whoever walks through: what would have stood on them is left out, and
  // that is all that changes (everything is first laid as if there were no ways through, then these are cut in)
  const through = new Uint8Array(P * P);
  const clear = new Uint8Array(P * P);
  // taken in a random order and kept apart, so that the doors are spread over the pile and not gathered where it is plainest
  const order = Array.from({ length: P * P }, (_, c) => c);
  for (let n = order.length - 1; n > 0; n--) {
    const m = Math.floor(extra() * (n + 1));
    [order[n], order[m]] = [order[m], order[n]];
  }
  for (const c of order) {
    const [i, k] = [c % P, Math.floor(c / P)];
    const [a, b] = [at(i + 1, k), at(i, k + 1)];
    const tall = g[c] - g[a] + 1;
    if (tall < 1 || tall !== g[c] - g[b] + 1 || flight[a] === 1 || flight[a] === 2 || flight[b] === 1 || flight[b] === 2 || reserved(c) || reserved(a) || reserved(b) || extra() >= o.passages) continue;
    let near = false;
    for (let z = -APART; z <= APART; z++) for (let x = -APART; x <= APART; x++) if (through[at(i + x, k + z)]) near = true;
    if (near) continue;
    through[c] = tall;
    clear[a] = clear[b] = 1;
  }

  // ---- what stands in the cell on top of each column
  // (in a cell, x = 0 is the wall of the column before it in x, z = 0 likewise, y = 0 the floor)
  const data = new Uint32Array(P * P * WORDS);
  const stair = new Uint8Array(P * P); // cells it takes, upward
  const put = (c: number, kind: number, code: number, cells: number) => {
    data[c * WORDS + 1] = kind | (code << 4) | (cells << 12);
    stair[c] = cells;
  };
  for (let k = 0; k < P; k++)
    for (let i = 0; i < P; i++) {
      const c = at(i, k);
      data[c * WORDS] = g[c] + 64;
      const wallX = g[at(i - 1, k)] - g[c] + 1; // cells of wall above this column's top, on its low-x side
      const wallZ = g[at(i, k - 1)] - g[c] + 1;
      const r = rand();
      if (onPath[c]) {
        const k = onPath[c];
        if (k === 2) put(c, KIND.stair, lay(0, "xyz"), 1);
        if (k === 3) put(c, KIND.fan, lay(0, "xyz"), 1);
        if (k === 4 || k === 5) put(c, KIND.stair, lay(0, "zyx"), 1);
        continue;
      }
      if (flight[c] === 1 || flight[c] === 2) {
        if (flight[c] === 1 ? wallX > 0 : wallZ > 0) put(c, KIND.stair, lay(0, flight[c] === 1 ? "xyz" : "zyx"), 1);
        continue;
      }
      if (wallX > 0 && wallZ > 0) {
        // an inner corner
        if (r < o.fans) put(c, KIND.fan, lay(0, FANS[Math.floor(rand() * 6)]), 1);
        else if (r < o.fans + o.pleats) put(c, KIND.stair, lay(0, rand() < 0.5 ? "xzy" : "zxy"), Math.min(wallX, wallZ, 3));
        else if (r < o.fans + o.pleats + o.cubes) put(c, KIND.cube, 0, 1);
      }
      if (stair[c]) continue;
      const wantX = wallX > 0 && alongX(i, k) > 0.35 - o.stairs;
      const wantZ = wallZ > 0 && alongZ(i, k) > 0.35 - o.stairs;
      if (wantX && (!wantZ || alongX(i, k) > alongZ(i, k))) put(c, KIND.stair, lay(0, "xyz"), 1);
      else if (wantZ) put(c, KIND.stair, lay(0, "zyx"), 1);
    }

  // ---- arches, cut into faces that nothing covers
  // one number each: there(1) lay(6) cells below the top(4) half width(5) from(5) to(5) depth(5), the last four in 31sts,
  // and a last bit for one of two that meet inside a cube: then it goes in as far as the middle and half its width more
  const SHAPE = 0x7ffff800; // the bits of the last four
  const JOINED = 0x80000000;
  const q = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 31);
  const pack = (code: number, below: number, half: number, from: number, long: number, depth: number) => {
    return (1 | (code << 1) | (below << 7) | (q(half) << 11) | (q(from) << 16) | (q(from + long) << 21) | (q(depth) << 26)) >>> 0;
  };
  const arch = (code: number, below: number, door: boolean) => {
    const half = 0.13 + rand() * 0.08;
    const long = 0.42 + rand() * 0.3;
    const from = door ? 0 : (1 - long) * (0.35 + rand() * 0.3);
    return pack(code, below, half, from, long, 0.3 + rand() * 0.45);
  };
  // the two walls of a cube that show: toward +x and toward +z
  const WALLS = [
    { word: 3, upright: lay(1, "zyx"), flat: lay(1, "yzx"), turn: 4 },
    { word: 4, upright: lay(4, "xyz"), flat: lay(4, "yxz"), turn: 1 },
  ];
  for (let k = 0; k < P; k++)
    for (let i = 0; i < P; i++) {
      const c = at(i, k);
      // the top: any of four ways round
      // (no hole in the top of the way)
      const top = !stair[c] && rand() < o.arches && !onPath[c];
      if (top) data[c * WORDS + 2] = arch(lay(2 | (rand() < 0.5 ? 1 : 0) | (rand() < 0.5 ? 4 : 0), rand() < 0.5 ? "xzy" : "zxy"), 0, false);
      const next = [at(i + 1, k), at(i, k + 1)];
      const tall = next.map((n) => g[c] - g[n] + 1);
      // a wall: `tall` cells of it show, the lowest standing on the next column's top; what that column carries hides some
      const below = [0, 0];
      WALLS.forEach((wall, w) => {
        const free = tall[w] - stair[next[w]];
        if (free < 1 || rand() >= o.arches) return;
        const under = 1 + Math.floor(rand() * free); // cells below this column's top
        if (under === 1 && top) return; // the same cube already has one in its top
        const onFloor = under === tall[w];
        const up = rand() < 0.6;
        data[c * WORDS + wall.word] = arch((up ? wall.upright : wall.flat) | (!onFloor && rand() < 0.5 ? (up ? 2 : wall.turn) : 0), under, onFloor && up && rand() < 0.75);
        below[w] = under;
      });
      // two in the walls of one cube: each for itself they cut across one another inside it. Made alike instead, both
      // upright, and joined into one room, so that one could walk in at one and out at the other
      let pair = below[0] && below[0] === below[1] ? below[0] : 0;
      let shape = data[c * WORDS + 3] & SHAPE;
      // and an arch whose cube has its other wall bare (nothing before it, no arch in the cube's top) may be given
      // its twin there: nothing else of the pile is touched, the cube only gets its second arch
      if (!pair && !below[0] !== !below[1]) {
        const has = below[0] ? 0 : 1;
        const bare = tall[1 - has] - stair[next[1 - has]] >= below[has] && !(below[has] === 1 && top);
        if (bare && extra() < o.pairs) {
          pair = below[has];
          shape = data[c * WORDS + WALLS[has].word] & SHAPE;
        }
      }
      // and now and then a cube with both walls bare gets a pair outright: windows, or doors where both stand on a floor
      const both = Math.min(tall[0] - stair[next[0]], tall[1] - stair[next[1]]);
      if (!pair && !below[0] && !below[1] && both >= 1 && extra() < o.pairs * 0.2) {
        const under = 1 + Math.floor(extra() * both);
        if (!(under === 1 && top)) {
          const long = 0.42 + extra() * 0.3;
          const door = under === tall[0] && under === tall[1] && extra() < 0.6;
          pair = under;
          shape = (q(0.13 + extra() * 0.08) << 11) | (q(door ? 0 : (1 - long) * (0.35 + extra() * 0.3)) << 16);
          shape |= (q(((shape >> 16) & 31) / 31 + long) << 21) | (q(0.4) << 26);
        }
      }
      if (pair) WALLS.forEach((wall) => (data[c * WORDS + wall.word] = (1 | (wall.upright << 1) | (pair << 7) | shape | JOINED) >>> 0));
    }

  // ---- the ways through, cut in: the floors before them cleared, and a door each side, alike, that meet inside
  for (let c = 0; c < P * P; c++) {
    if (clear[c]) data[c * WORDS + 1] = 0;
    if (!through[c]) continue;
    const [half, long] = [0.15 + extra() * 0.09, 0.5 + extra() * 0.3];
    WALLS.forEach((wall) => (data[c * WORDS + wall.word] = (pack(wall.upright, through[c], half, 0, long, 0) | JOINED) >>> 0));
    if (through[c] === 1) data[c * WORDS + 2] = 0; // (an arch in the top of the same cube would cut into them)
  }

  // what there is of each
  const count = { stair: 0, pleat: 0, fan: 0, cube: 0, arch: 0, door: 0, passage: 0, flights: flights.sort().join(" ") };
  for (let c = 0; c < P * P; c++) {
    const thing = data[c * WORDS + 1];
    const order = (thing >> 7) & 7;
    if ((thing & 15) === KIND.stair) order === 1 || order === 4 ? count.pleat++ : count.stair++;
    if ((thing & 15) === KIND.fan) count.fan++;
    if ((thing & 15) === KIND.cube) count.cube++;
    for (const w of [2, 3, 4]) {
      const a = data[c * WORDS + w];
      if (!(a & 1)) continue;
      count.arch++;
      if (w > 2 && !((a >> 16) & 31)) count.door++;
    }
    if (data[c * WORDS + 3] >>> 31) count.passage++;
  }

  let low = 9;
  let high = -9;
  for (const v of g) ((low = Math.min(low, v)), (high = Math.max(high, v)));
  return { P, data, g, low, high, count, path, onPath };
}
