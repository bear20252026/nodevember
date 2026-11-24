// Routes: where on the pile one can walk, and rounds to walk there.
//
// Every face of the pile is a floor for someone: the tops for those whose up is y, the faces toward +x for
// those whose up is x, the faces toward +z for z. (Seen down the cube diagonal the three are alike, and so
// are the three kinds of walker.) A staircase in an inner edge is the same shape seen from either of its two
// faces, so it serves both: it climbs toward one face for the walkers standing on the other. A fan serves
// those whose up is the line it turns about. A cube with a door in each of two walls is a way through.
//
// Cells are named as the pile repeats them: (i, k) the column, taken round the tile, and s = x + y + z, which
// a step of the repeat does not change. So the whole endless pile is one finite map, and a round on the map
// either closes in the world too, or comes out a whole repeat further on: a walk across the picture for ever,
// which closes all the same, because the picture is the same there.
import { WORDS, KIND } from "./world.ts";

type V = [number, number, number];
const ORDERS = ["xyz", "xzy", "yxz", "yzx", "zxy", "zyx"];
const AXIS: Record<string, number> = { x: 0, y: 1, z: 2 };
const along = (a: number, by = 1): V => [a === 0 ? by : 0, a === 1 ? by : 0, a === 2 ? by : 0];
const add = (a: V, b: V, s = 1): V => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V): V => mul(a, 1 / (len(a) || 1));
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// where a foot goes, and which way the walker faces there
export type Foot = { p: V; fore: V };
export type Route = {
  up: number; // the axis that is up for whoever walks it
  feet: Foot[]; // once round
  shift: V; // where once round leaves one, in the world (a step of the repeat, or nothing)
  kind: "round" | "on and on" | "there and back" | "fall";
  special: number; // staircases, fans and ways through on it
  // one who falls: where it ends, in a hole; the first foot of the way that is in sight (one out of a door comes
  // through the cube behind it first); and the hole it comes up out of, if it does
  fall?: { at: V; from: number; rise?: V };
};
// a way found, not yet tried: and the cells it takes
export type Found = { route: Route; cells: string[]; holes: string[]; score: number };

type Cell = { i: number; k: number; s: number };
type Stair = { fan: boolean; B: number; W: number }; // climbs toward -B (a fan: turns from along B to along W)
// a place to stand: a floor with nothing on it, or the lowest or the highest step of a staircase or a fan
// (or a floor with a hole in it, an arch cut into it: walked into only by those who fall in)
type Spot = Cell & { key: string; cell: string; end: "floor" | "low" | "top" | "hole"; stair: Stair | null; edges: Edge[] };
// a step from one place to another. `mid`: where it crosses from one to the other (from the first one's corner)
type Edge = { to: string; m: number; n: number; how: "level" | "stairs" | "door"; mid: V };

export function findRoutes(world: { P: number; data: Uint32Array; g: Int32Array; path?: { i: number; k: number; s: number }[]; onPath?: Int8Array }, o: { seed: number; steps: number; turns: number; tall: number; pace: number; loop: number }) {
  const { P, data, g } = world;
  const rand = rng(o.seed ^ 0x51ed270b);
  const mod = (v: number) => ((v % P) + P) % P;
  const col = (i: number, k: number) => mod(k) * P + mod(i);
  const solid = (c: Cell) => c.s < g[col(c.i, c.k)];
  const step = (c: Cell, a: number, by: number): Cell => ({ i: c.i + (a === 0 ? by : 0), k: c.k + (a === 2 ? by : 0), s: c.s + by });
  // what stands in a cell: the thing on top of its column, if this is one of the cells it fills
  const content = (c: Cell) => {
    const n = col(c.i, c.k);
    const w = data[n * WORDS + 1];
    const kind = w & 15;
    if (!kind || c.s < g[n] || c.s >= g[n] + Math.max(1, (w >> 12) & 15)) return null;
    const order = ORDERS[(w >> 7) & 7];
    return { kind, u: AXIS[order[0]], v: AXIS[order[1]], w: AXIS[order[2]] };
  };
  // whether the face a floor is has an arch cut into it (the face of the cube under it, toward up)
  const holed = (c: Cell, a: number) => {
    const d = step(c, a, -1);
    const n = col(d.i, d.k);
    const w = data[n * WORDS + (a === 1 ? 2 : a === 0 ? 3 : 4)];
    return (w & 1) === 1 && (a === 1 ? 1 : (w >> 7) & 15) === g[n] - d.s;
  };
  // ...and what that is to a walker whose up is a: a floor (null), a staircase, a hole, or in the way (false)
  const use = (c: Cell, a: number): Stair | null | false | "hole" => {
    if (solid(c) || !solid(step(c, a, -1))) return false;
    const t = content(c);
    if (!t) return holed(c, a) ? "hole" : null;
    // (on the upper steps a walker stands up into the cell above, which must be clear)
    if (content(step(c, a, 1))) return false;
    if (t.kind === KIND.stair && (t.u === a || t.v === a)) {
      const B = t.u === a ? t.v : t.u;
      return { fan: false, B, W: 3 - a - B };
    }
    if (t.kind === KIND.fan && t.v === a) return { fan: true, B: t.u, W: t.w };
    return false;
  };
  const cellName = (c: Cell) => `${mod(c.i)},${mod(c.k)},${c.s}`;
  const name1 = (c: Cell) => `1:${cellName(c)}:floor`;
  // a cell's corner in the world, for a cell taken round the tile m times along x and n times along z
  const corner = (c: Cell, m = 0, n = 0): V => {
    const x = mod(c.i) + m * P;
    const z = mod(c.k) + n * P;
    return [x, c.s - x - z, z];
  };
  const lattice = (m: number, n: number): V => [m * P, -(m + n) * P, n * P];

  // ---- the shapes of the places: the steps of a staircase or a fan from the lowest to the highest, the part of
  // its floor each place is (a rectangle, along the other two axes), and where in it one stands
  const treads = (st: Stair, c: V, a: number): V[] => {
    const at = (b: number, w: number, h: number) => add(add(add(c, along(st.B, b)), along(st.W, w)), along(a, h));
    if (!st.fan) return Array.from({ length: o.steps }, (_, t) => at((o.steps - 0.5 - t) / o.steps, 0.5, (t + 1) / o.steps));
    const wedge = (0.5 * Math.PI) / o.turns;
    // (round at 0.62 from the line it turns about; not on its lowest step nor its highest, which are thin wedges
    // hard against the walls, where a shoulder would be in the wall)
    const r = 0.62;
    const clear = (t: number) => r * Math.min(Math.sin((t + 0.5) * wedge), Math.cos((t + 0.5) * wedge)) >= 0.11;
    const steps = Array.from({ length: o.turns }, (_, t) => t).filter(clear);
    // (its two ends are stood on out where the end steps are widest, near the open edge of the cell and a shoulder
    // off the wall: the lowest at its own height, the highest at the top)
    return [at(0.92, 0.1, 1 / o.turns), ...steps.map((t) => at(r * Math.cos((t + 0.5) * wedge), r * Math.sin((t + 0.5) * wedge), (t + 1) / o.turns)), at(0.1, 0.92, 1)];
  };
  type Shape = { lo: [number, number]; hi: [number, number]; h: number; stand: V };
  const shape = (sp: Spot, c: V, a: number): Shape => {
    const [t1, t2] = [(a + 1) % 3, (a + 2) % 3];
    if (!sp.stair) return { lo: [c[t1], c[t2]], hi: [c[t1] + 1, c[t2] + 1], h: c[a], stand: add(add(c, along(t1, 0.5)), along(t2, 0.5)) };
    const st = sp.stair;
    const run = treads(st, c, a);
    const low = sp.end === "low";
    const thin = st.fan ? 0.12 : 1 / o.steps;
    // along B and along W, then as the walker's two axes
    const [b, w] = st.fan ? (low ? [[0.55, 1], [0, thin]] : [[0, thin], [0.55, 1]]) : low ? [[1 - thin, 1], [0, 1]] : [[0, thin], [0, 1]];
    const lo: [number, number] = [0, 0];
    const hi: [number, number] = [0, 0];
    for (const [axis, range] of [[st.B, b], [st.W, w]] as [number, number[]][]) {
      const slot = axis === t1 ? 0 : 1;
      lo[slot] = c[axis] + range[0];
      hi[slot] = c[axis] + range[1];
    }
    const stand = low ? run[0] : run[run.length - 1];
    return { lo, hi, h: stand[a], stand };
  };
  // where two places touch: the middle of the edge they share, if it is long enough to pass (and they are near
  // enough in height to step from one to the other)
  const touch = (p: Shape, q: Shape, a: number): V | null => {
    if (Math.abs(p.h - q.h) > 0.13) return null;
    const [t1, t2] = [(a + 1) % 3, (a + 2) % 3];
    const e = 1e-4;
    for (let d = 0; d < 2; d++) {
      const x = Math.abs(p.hi[d] - q.lo[d]) < e ? p.hi[d] : Math.abs(p.lo[d] - q.hi[d]) < e ? p.lo[d] : null;
      if (x === null) continue;
      const o2 = 1 - d;
      const from = Math.max(p.lo[o2], q.lo[o2]);
      const to = Math.min(p.hi[o2], q.hi[o2]);
      if (to - from < 0.1) continue;
      const mid: V = [0, 0, 0];
      mid[d === 0 ? t1 : t2] = x;
      mid[d === 0 ? t2 : t1] = (from + to) / 2;
      mid[a] = Math.max(p.h, q.h);
      return mid;
    }
    return null;
  };

  // ---- the map, one for each way up
  const maps: Map<string, Spot>[] = [0, 1, 2].map(() => new Map());
  const doors: number[] = []; // (columns with a way through, which are not doors to come out of)
  for (let a = 0; a < 3; a++) {
    const map = maps[a];
    const name = (c: Cell, end: Spot["end"]) => `${a}:${cellName(c)}:${end}`;
    for (let k = 0; k < P; k++)
      for (let i = 0; i < P; i++)
        for (let s = g[col(i, k)] - 1; s <= g[col(i, k)] + 6; s++) {
          const c = { i, k, s };
          const u = use(c, a);
          if (u === false) continue;
          const stair = typeof u === "object" ? u : null;
          for (const end of u === "hole" ? (["hole"] as const) : u ? (["low", "top"] as const) : (["floor"] as const)) map.set(name(c, end), { ...c, key: name(c, end), cell: cellName(c), end, stair, edges: [] });
        }
    for (const p of map.values()) {
      const here = corner(p);
      const mine = shape(p, here, a);
      // up or down its own stairs
      if (p.stair) p.edges.push({ to: name(p, p.end === "low" ? "top" : "low"), m: 0, n: 0, how: "stairs", mid: [0, 0, 0] });
      // and to every place it touches, in the cells about it
      const [t1, t2] = [(a + 1) % 3, (a + 2) % 3];
      for (let d1 = -1; d1 <= 1; d1++)
        for (let d2 = -1; d2 <= 1; d2++)
          for (let d3 = -1; d3 <= 1; d3++) {
            if (!d1 && !d2 && !d3) continue;
            const t = step(step(step(p, t1, d1), t2, d2), a, d3);
            for (const end of ["floor", "low", "top", "hole"] as const) {
              const q = map.get(name(t, end));
              if (!q) continue;
              const [m, n] = [Math.floor(t.i / P), Math.floor(t.k / P)];
              const mid = touch(mine, shape(q, corner(q, m, n), a), a);
              if (mid) p.edges.push({ to: q.key, m, n, how: "level", mid: sub(mid, here) });
            }
          }
    }
    // ways through: a cube with a door in each of its two walls toward +x and +z, both on the floor
    if (a === 1)
      for (let k = 0; k < P; k++)
        for (let i = 0; i < P; i++) {
          const n = col(i, k);
          const [wx, wz] = [data[n * WORDS + 3], data[n * WORDS + 4]];
          const door = (w: number) => (w & 1) === 1 && w >>> 31 === 1 && ((w >> 16) & 31) === 0 && ((w >> 21) & 31) / 31 >= 0.55;
          if (!door(wx) || !door(wz) || ((wx >> 7) & 15) !== ((wz >> 7) & 15)) continue;
          const s0 = g[n] - ((wx >> 7) & 15);
          const A = map.get(name({ i: i + 1, k, s: s0 + 1 }, "floor"));
          const B = map.get(name({ i, k: k + 1, s: s0 + 1 }, "floor"));
          doors.push(n);
          if (!A || !B) continue;
          // (the middle of the cube, from each one's corner)
          A.edges.push({ to: B.key, m: Math.floor((A.i - 1) / P), n: Math.floor((A.k + 1) / P), how: "door", mid: [-0.5, 0, 0.5] });
          B.edges.push({ to: A.key, m: Math.floor((B.i + 1) / P), n: Math.floor((B.k - 1) / P), how: "door", mid: [0.5, 0, -0.5] });
        }
  }

  // ---- rounds on the map: a way back to where one set out (by another way than the one taken), or out and back
  type Node = Spot;
  // a door to come out of: the cube, the way its face looks, how deep the room behind it is
  type Door = { cube: Cell; face: number; deep: number };
  type Way = { a: number; nodes: Node[]; edges: Edge[]; closed: boolean; door?: Door };
  const special = (w: Way) => w.edges.filter((e) => e.how === "door").length + w.edges.filter((e) => e.how === "stairs").length;
  // the cheapest way from one place to every other, with every step costed anew at random (so each search finds
  // other ways); steps onto stairs and through doors cost less, to draw the ways to them
  const search = (map: Map<string, Node>, from: Node, avoid: (n: Node, e: Edge) => boolean, holes = false) => {
    const cost = new Map<string, number>([[from.key, 0]]);
    const back = new Map<string, [Node, Edge]>();
    const open: Node[] = [from];
    const done = new Set<string>();
    while (open.length) {
      open.sort((p, q) => cost.get(p.key)! - cost.get(q.key)!);
      const n = open.shift()!;
      if (done.has(n.key)) continue;
      done.add(n.key);
      for (const e of n.edges) {
        if (avoid(n, e)) continue;
        const to = map.get(e.to)!;
        if (to.end === "hole" && !holes) continue;
        if (n.end === "hole" && n.key !== from.key) continue; // (one falls in, and goes no further)
        const c = cost.get(n.key)! + (e.how === "level" ? 1 : 0.45) * (0.5 + 1.5 * rand());
        if (c < (cost.get(to.key) ?? Infinity)) {
          cost.set(to.key, c);
          back.set(to.key, [n, e]);
          open.push(to);
        }
      }
    }
    const way = (to: Node) => {
      const nodes: Node[] = [to];
      const edges: Edge[] = [];
      for (let n = to; n.key !== from.key; ) {
        const [p, e] = back.get(n.key)!;
        nodes.unshift(p);
        edges.unshift(e);
        n = p;
      }
      return { nodes, edges };
    };
    return { cost, back, way };
  };
  const found: Way[] = [];
  for (let a = 0; a < 3; a++) {
    const map = maps[a];
    const all = [...map.values()].filter((n) => n.edges.length && n.end !== "hole");
    if (!all.length) continue;
    for (let tries = 0; tries < 60; tries++) {
      const s = all[Math.floor(rand() * all.length)];
      if (rand() < 0.6 && s.edges.length >= 2) {
        // round: out by one step, and back to s by any other way
        const first = s.edges[Math.floor(rand() * s.edges.length)];
        const t = map.get(first.to)!;
        const r = search(map, t, (n, e) => n.key === t.key && e.to === s.key);
        if (!r.back.has(s.key)) continue;
        const w = r.way(s);
        found.push({ a, nodes: [s, ...w.nodes.slice(0, -1)], edges: [first, ...w.edges], closed: true });
      } else {
        // out and back: to somewhere a fair way off
        const r = search(map, s, () => false);
        const far = [...r.cost.keys()].map((k) => map.get(k)!).filter((n) => n.key !== s.key);
        if (!far.length) continue;
        const w = r.way(far[Math.floor(rand() * far.length)]);
        found.push({ a, ...w, closed: false });
      }
    }
  }

  // ---- out of a door, and some way off into a hole: those who walk it come out of the dark of the door and fall
  // into the hole, and are out of sight at both ends, so that each time round can begin again where it began
  {
    const map = maps[1];
    for (let k = 0; k < P; k++)
      for (let i = 0; i < P; i++) {
        const n = col(i, k);
        for (const [word, face] of [[3, 0], [4, 2]]) {
          const w = data[n * WORDS + word];
          const upright = ORDERS[((w >> 1) & 63) >> 3][1] === "y";
          if (!(w & 1) || w >>> 31 || ((w >> 16) & 31) !== 0 || !upright || ((w >> 21) & 31) / 31 < 0.55 || doors.includes(n)) continue;
          const cube = { i, k, s: g[n] - ((w >> 7) & 15) };
          const front = map.get(name1(step(cube, face, 1)));
          if (!front || front.end !== "floor") continue;
          const r = search(map, front, () => false, true);
          const holes = [...r.cost.keys()].map((key) => map.get(key)!).filter((q) => q.end === "hole");
          for (const hole of holes) {
            const way = r.way(hole);
            if (way.nodes.length >= 4) found.push({ a: 1, ...way, closed: false, door: { cube, face, deep: ((w >>> 26) & 31) / 31 } });
          }
        }
      }
  }

  // ---- up out of one hole, and some way off into another (any way up: a window is a hole in the wall that is a
  // floor to some)
  for (let a = 0; a < 3; a++) {
    const map = maps[a];
    const holes = [...map.values()].filter((q) => q.end === "hole" && q.edges.length);
    for (const start of holes) {
      const r = search(map, start, () => false, true);
      const ends = [...r.cost.keys()].map((key) => map.get(key)!).filter((q) => q.end === "hole" && q.key !== start.key);
      for (let t = 0; t < 3 && ends.length; t++) {
        const way = r.way(ends.splice(Math.floor(rand() * ends.length), 1)[0]);
        if (way.nodes.length >= 4) found.push({ a, ...way, closed: false });
      }
    }
  }

  // ---- each way as feet, in the world
  const H = o.tall;
  const stride = 0.38 * H;
  // the way as a line of points: the treads of stairs, where feet must go, and between them level ground, which
  // feet are spread over evenly. (A point's height holds from it to the next: the line is level or steps.)
  type Mark = { p: V; fixed: boolean; corner: boolean };
  const feetOf = (w: Way) => {
    const a = w.a;
    const up = along(a);
    let [m, n] = [0, 0];
    const at: [number, number][] = [];
    w.nodes.forEach((_, j) => {
      at.push([m, n]);
      const e = w.edges[j];
      if (e) ((m += e.m), (n += e.n));
    });
    const shift = w.closed ? lattice(m, n) : ([0, 0, 0] as V);
    const at0 = (j: number) => at[j];
    const marks: Mark[] = [];
    const count = w.nodes.length;
    // out of a door: from within the cube behind its room, through the room, and out
    let face: V | null = null;
    if (w.door) {
      const { cube, face: f, deep } = w.door;
      const out = along(f);
      face = add(add(add(corner(cube), along(2 - f, 0.5)), out, 1), [0, 0, 0]);
      for (const back of [deep + 0.55, deep + 0.3, deep, deep * 0.5, 0]) marks.push({ p: add(face, out, -back), fixed: false, corner: false });
    }
    for (let j = 0; j < count; j++) {
      const q = w.nodes[j];
      const c = corner(q, ...at[j]);
      const here = shape(q, c, a);
      const e = w.edges[j];
      // (out of a hole: from where the way leaves its cell)
      if (q.end === "hole" && j === 0) {
      } else if (q.end === "hole") {
        // (into a hole: only to its edge, a little in from where the way crosses into its cell)
        const last = marks[marks.length - 1].p;
        marks.push({ p: add(last, unit(sub(here.stand, last)), 0.12), fixed: false, corner: false });
        continue;
      }
      if (!(e?.how === "stairs" && j > 0 && w.edges[j - 1]?.how === "stairs")) marks.push({ p: here.stand, fixed: !!q.stair, corner: !q.stair });
      if (!e) continue;
      if (e.how === "stairs") {
        // up or down its treads (the first and last are the two places themselves)
        const run = treads(q.stair!, c, a);
        const steps = q.end === "low" ? run : [...run].reverse();
        marks.push(...steps.slice(1, -1).map((p) => ({ p, fixed: true, corner: false })));
      } else if (e.how === "level") {
        // across the edge between them: at this one's height up to it, and the next one's after
        const mid = add(c, e.mid);
        const next = j + 1 < count ? w.nodes[j + 1] : w.nodes[0];
        const nextAt: [number, number] = j + 1 < count ? at[j + 1] : [at[j][0] + e.m, at[j][1] + e.n];
        const there = shape(next, corner(next, ...nextAt), a);
        const [low, high]: V[] = [mid, mid].map((p, t) => {
          const x: V = [...p];
          x[a] = t ? there.h : here.h;
          return x;
        });
        marks.push({ p: low, fixed: false, corner: false });
        if (Math.abs(here.h - there.h) > 1e-4) marks.push({ p: high, fixed: false, corner: false });
      } else marks.push({ p: add(c, e.mid), fixed: false, corner: true });
    }
    // round off the corners of the level ways
    const ring = w.closed;
    const get = (j: number): V => (j >= marks.length ? add(marks[j - marks.length].p, shift) : j < 0 ? sub(marks[j + marks.length].p, shift) : marks[j].p);
    const line: Mark[] = [];
    marks.forEach((mk, j) => {
      const has = ring || (j > 0 && j < marks.length - 1);
      if (!mk.corner || !has) return line.push(mk);
      const into = sub(mk.p, get(j - 1));
      const out = sub(get(j + 1), mk.p);
      const level = Math.abs(dot(into, up)) < 1e-4 && Math.abs(dot(out, up)) < 1e-4;
      if (!level || len(into) < 0.4 || len(out) < 0.4 || dot(unit(into), unit(out)) > 0.85) return line.push(mk);
      return line.push({ p: sub(mk.p, mul(unit(into), 0.2)), fixed: false, corner: false }, { p: add(mk.p, mul(unit(out), 0.2)), fixed: false, corner: false });
    });
    // feet: on every tread, and spread over the level stretches between, a stride or a little less apart
    const point = (j: number) => (j >= line.length ? { ...line[j - line.length], p: add(line[j - line.length].p, shift) } : line[j]);
    const flatten = (v: V) => sub(v, mul(up, dot(v, up)));
    const feet: V[] = [];
    const total = ring ? line.length : line.length - 1;
    let j = 0;
    // (a ring starts at a tread if it has one, so that every stretch runs between two)
    const first = ring ? Math.max(0, line.findIndex((mk) => mk.fixed)) : 0;
    while (j < total) {
      const p = point(first + j);
      if (p.fixed || !ring || j === 0) feet.push(p.p);
      // the stretch to the next tread (or the end)
      let e = j + 1;
      while (e < total && !point(first + e).fixed) e++;
      const pts = Array.from({ length: e - j + 1 }, (_, t) => point(first + j + t).p);
      const lengths = pts.slice(1).map((q, t) => len(flatten(sub(q, pts[t]))));
      const L = lengths.reduce((t, v) => t + v, 0);
      const gaps = Math.max(1, Math.round(L / stride));
      for (let f = 1; f < gaps; f++) {
        let d = (L * f) / gaps;
        let t = 0;
        while (t < lengths.length - 1 && d > lengths[t]) d -= lengths[t++];
        const x = add(pts[t], sub(pts[t + 1], pts[t]), lengths[t] > 0 ? d / lengths[t] : 0);
        x[a] = pts[t][a];
        feet.push(x);
      }
      j = e;
    }
    if (!ring) feet.push(point(line.length - 1).p);
    // which way one faces at each: along the way (across the up)
    const across = (v: V) => unit(sub(v, mul(up, dot(v, up))));
    const near = (j: number): V => (ring ? (j >= feet.length ? add(feet[j - feet.length], shift) : j < 0 ? sub(feet[j + feet.length], shift) : feet[j]) : feet[Math.max(0, Math.min(feet.length - 1, j))]);
    const fore = feet.map((_, j) => across(sub(near(j + 1), near(j - 1))));
    if (ring) return { feet: feet.map((p, j) => ({ p, fore: fore[j] })), shift };
    if (w.door || w.nodes[0].end === "hole") {
      const hole = w.nodes[count - 1];
      const at = shape(hole, corner(hole, ...at0(count - 1)), a).stand;
      const start = w.nodes[0];
      const from = w.door ? feet.findIndex((p) => dot(sub(p, face!), along(w.door!.face)) > 0.01) : 0;
      const rise = w.door ? undefined : shape(start, corner(start, ...at0(0)), a).stand;
      return { feet: feet.map((p, j) => ({ p, fore: fore[j] })), shift, fall: { at, from, rise } };
    }
    // out and back: turn round in three steps at each end
    const turned = (f: V, by: number): V => add(mul(f, Math.cos(by)), cross(up, f), Math.sin(by));
    const last = feet.length - 1;
    const list: Foot[] = feet.map((p, j) => ({ p, fore: fore[j] }));
    list.push({ p: feet[last], fore: turned(fore[last], Math.PI / 2) }, { p: feet[last], fore: mul(fore[last], -1) });
    for (let j = last - 1; j >= 1; j--) list.push({ p: feet[j], fore: mul(fore[j], -1) });
    list.push({ p: feet[0], fore: turned(fore[0], -Math.PI / 2) }, { p: feet[0], fore: fore[0] });
    return { feet: list, shift: [0, 0, 0] as V };
  };

  // ---- all of them, best first, and short enough to go round in a loop at a walking pace. (Which are walked is
  // chosen once they have been tried: people.ts)
  const most = o.loop * o.pace * 1.4;
  const found2: Found[] = found
    .map((w) => ({ w, built: feetOf(w) }))
    .filter(({ w, built }) => built.feet.length >= 8 && built.feet.length <= most && w.nodes.length >= (w.closed ? 4 : 3))
    .map(({ w, built }) => {
      const shifted = len(built.shift) > 0;
      const falls = !!w.door || w.nodes[0].end === "hole";
      const kind: Route["kind"] = falls ? "fall" : !w.closed ? "there and back" : shifted ? "on and on" : "round";
      const cells = w.nodes.map((n) => n.cell);
      if (w.door) cells.push(cellName(w.door.cube), cellName(step(w.door.cube, w.door.face, 1)));
      const holes = w.nodes.filter((n) => n.end === "hole").map((n) => n.cell);
      // (those who fall in are few, and first)
      const score = special(w) * 3 + Math.min(w.nodes.length, 16) / 3 + (w.closed ? 2 : 0) + rand() * 2 + (falls ? 8 : 0);
      return { route: { up: w.a, feet: built.feet, shift: built.shift, kind, special: special(w), fall: built.fall }, cells, holes, score };
    })
    .sort((p, q) => q.score - p.score);
  // (for looking at the map: places, ways between them, pieces it falls in, and staircases, for each way up)
  const layout = maps.map((map) => {
    const seen = new Set<string>();
    let pieces = 0;
    let biggest = 0;
    for (const n of map.values()) {
      if (seen.has(n.key)) continue;
      pieces++;
      let size = 0;
      const todo = [n];
      seen.add(n.key);
      while (todo.length) {
        const q = todo.pop()!;
        size++;
        for (const e of q.edges) if (!seen.has(e.to)) (seen.add(e.to), todo.push(map.get(e.to)!));
      }
      biggest = Math.max(biggest, size);
    }
    const ways = [...map.values()].reduce((t, n) => t + n.edges.length, 0) / 2;
    const stairs = [...map.values()].filter((n) => n.stair).length;
    const through = [...map.values()].filter((n) => n.stair && n.edges.length === 2).length;
    return { places: map.size, ways, pieces, biggest, loops: ways - map.size + pieces, stairs, through };
  });
  // ---- the one way through the whole pile (world.ts), made a round: its places in order, each staircase or fan
  // from the end it is come to by to the other, and the steps between them as the map has them (the last back to
  // the first, a repeat on)
  let way: Found | null = null;
  let broken = "";
  if (world.path?.length) {
    const map = maps[1];
    const cells = world.path;
    const nodes: Spot[] = [];
    const steps: Edge[] = [];
    const ends: [number, number][] = []; // (where in the world each place's cell is: times round the tile)
    for (let j = 0; j < cells.length && !broken; j++) {
      const c = cells[j];
      const kind = world.onPath![mod(c.k) * P + mod(c.i)];
      const wrap: [number, number] = [Math.floor(c.i / P), Math.floor(c.k / P)];
      const these = kind === 1 ? ["floor"] : kind === 5 ? ["low", "top"] : ["top", "low"];
      for (const end of these) {
        const q = map.get(`1:${cellName(c)}:${end}`);
        if (!q) {
          broken = `no place ${end} at ${c.i},${c.k}`;
          break;
        }
        nodes.push(q);
        ends.push(wrap);
      }
    }
    // the steps between, each to the next (and the last to the first, a repeat on along x)
    for (let j = 0; j < nodes.length && !broken; j++) {
      const [from, to] = [nodes[j], nodes[(j + 1) % nodes.length]];
      const [m0, n0] = ends[j];
      const [m1, n1] = j + 1 < nodes.length ? ends[j + 1] : [ends[0][0] + 1, ends[0][1]];
      const e = from.edges.find((e) => e.to === to.key && (e.how === "stairs" ? from.cell === to.cell : e.m === m1 - m0 && e.n === n1 - n0));
      if (!e) broken = `no step from ${from.key} to ${to.key}`;
      else steps.push(e);
    }
    if (!broken) {
      const w = { a: 1, nodes, edges: steps, closed: true };
      const built = feetOf(w);
      // (an even number of footholds round it, so that once round a loop brings the feet back as they were: one more
      // put in the longest level stride if need be)
      if (built.feet.length % 2) {
        let best = -1;
        let far = 0;
        built.feet.forEach((f, j) => {
          const g = built.feet[(j + 1) % built.feet.length].p;
          const d = len(sub(g, f.p));
          if (j + 1 < built.feet.length && Math.abs(g[1] - f.p[1]) < 1e-4 && d > far) ((far = d), (best = j));
        });
        if (best >= 0) built.feet.splice(best + 1, 0, { p: mul(add(built.feet[best].p, built.feet[best + 1].p), 0.5), fore: built.feet[best].fore });
      }
      way = { route: { up: 1, feet: built.feet, shift: built.shift, kind: "on and on", special: special(w) }, cells: nodes.map((n) => n.cell), holes: [], score: 99 };
    }
  }
  return { found: found2, way, broken, places: maps.map((m) => m.size), layout };
}
