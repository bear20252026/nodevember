// The people: walkers going round the ways routes.ts finds (over floors, up and down stairs and fans, through
// doors), and sitters in windows.
//
// Up for a walker is the way up of the floors it walks (y, x or z), and for a sitter whatever way its window
// stands: as many ways up as the pile has. A figure is a handful of capsules, posed anew every frame from the loop's playhead (every
// motion goes round a whole number of times a loop) and handed to the shaders in the picture's own axes:
// across, up the picture, and toward the eye.
import { WORDS } from "./world.ts";
import { findRoutes, type Route } from "./routes.ts";
import { solidKind, solidTest } from "./solid.ts";

export type PeopleOptions = {
  seed: number;
  walkers: number; // 0..1: how many of the ways found have someone on them
  sitters: number; // 0..1: how many of the windows have someone in them
  tall: number; // a figure's height, in cubes
  pace: number; // steps a second, about
  onWay?: number; // walkers on the way through the whole pile
};
export const peopleDefaults = { walkers: 0.9, sitters: 0.6, tall: 0.5, pace: 1.7 };

export const CAPS = 18; // capsules in a figure (the last two: a phone, when there is one)
export const HEAD = 3; // numbers of four before them: where it takes its light from, its bounds, the way its ground faces
export const FIG = HEAD + CAPS * 2; // numbers of four for a figure
export const MOST = 96; // figures at most, counting each twice (the tile shows the pile twice over)
export const SLOTS = 12; // figures a square of the grid can list
export const tally = { dropped: 0 };
export const turned = { away: 0 }; // sitters left out for being in a walker's way, at the last count // times a square had no room for a figure, at the last posing (it should be none)
const SUIT = 0;
const SKIN = 1;
const SOCK = 2;
const HAIR = 3;
const PHONE = 4;
const SCREEN = 5; // (it shines: it takes no light)

type V = [number, number, number];
const add = (a: V, b: V, s = 1): V => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, s: number): V => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V): V => mul(a, 1 / (len(a) || 1));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);

const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// a point of a cell, laid the way a shape wants it (as in trace.wgsl), and the way back: where a point of the
// shape's own space is in the world, for a cell with its corner at `corner`
const laid = (p: V, code: number): V => {
  const q: V = [code & 1 ? 1 - p[0] : p[0], code & 2 ? 1 - p[1] : p[1], code & 4 ? 1 - p[2] : p[2]];
  const o = code >> 3;
  return o === 1 ? [q[0], q[2], q[1]] : o === 2 ? [q[1], q[0], q[2]] : o === 3 ? [q[1], q[2], q[0]] : o === 4 ? [q[2], q[0], q[1]] : o === 5 ? [q[2], q[1], q[0]] : q;
};
type Frame = { at: (q: V) => V; way: (d: V) => V };
const frame = (corner: V, code: number): Frame => {
  const t = laid([0, 0, 0], code);
  const cols = ([[1, 0, 0], [0, 1, 0], [0, 0, 1]] as V[]).map((e) => sub(laid(e, code), t)); // where each of the world's axes goes
  const way = (d: V): V => [dot(cols[0], d), dot(cols[1], d), dot(cols[2], d)];
  return { at: (q) => add(corner, way(sub(q, t))), way };
};

// the world, in the picture's axes
const ACROSS: V = [Math.SQRT1_2, 0, -Math.SQRT1_2];
const UP: V = [-1 / Math.sqrt(6), 2 / Math.sqrt(6), -1 / Math.sqrt(6)];
const EYE: V = [1 / Math.sqrt(3), 1 / Math.sqrt(3), 1 / Math.sqrt(3)];
export const seen = (p: V): V => [dot(p, ACROSS), dot(p, UP), dot(p, EYE)];

// a walker: a way, how many times round it in a loop, and where on it to begin
// ...who now and then stops on the level, and looks at a phone, or about, or at a watch, or stretches; and has
// ways of its own: a size, how much it swings its arms, its hands in its pockets, or a phone it walks along with
type Act = "phone" | "look" | "watch" | "stretch";
type Pause = { at: number; long: number; act: Act }; // from the beat it stops at (of its way), for so many beats
type Style = { size: number; swing: number; pockets: boolean; texting: boolean; look: number };
type Walker = { kind: "walker"; frame: Frame; route: Route; laps: number; phase: number; suit: number; pauses: Pause[]; style: Style };
const PLAIN: Style = { size: 1, swing: 1, pockets: false, texting: false, look: 0 };
// a sitter: in an arch, on its sill with the legs out, in the arch's own way up: so in a window it sits as one
// does, and in a hole in a floor it lies back in the hole, face to the sky, its legs out over the edge
type Sitter = { kind: "sitter"; frame: Frame; lo: number; aside: number; swings: number; phase: number; suit: number; phone: boolean };
export type Figure = Walker | Sitter;
const SAME: Frame = { at: (q) => q, way: (d) => d };

export function createPeople(world: { P: number; data: Uint32Array; g: Int32Array; path?: { i: number; k: number; s: number }[]; onPath?: Int8Array }, options: PeopleOptions, steps: number, turns: number, loop: number, small = 0.5) {
  const { P, data, g } = world;
  const rand = rng(options.seed ^ 0x2545f491);
  const H = options.tall;
  const inside = solidTest(world, steps, turns, small);
  const what = solidKind(world, steps, turns, small);
  // A way is walked once in advance, and kept only if the walker stays out of the pile: never with its body or
  // head, and with a hand or a foot for no more than a moment (a hand brushing a wall as it swings)
  const walk = (route: Route, phase = 0, dressed = false): Walker => {
    const f: Walker = { kind: "walker", frame: SAME, route, laps: 1, phase, suit: rand(), pauses: [], style: PLAIN };
    if (dressed) {
      const r = rand();
      f.style = { size: 0.93 + 0.14 * rand(), swing: 0.7 + 0.6 * rand(), texting: r < 0.12, pockets: r >= 0.12 && r < 0.26, look: rand() < 0.45 ? 1 : 0 };
      // where it may stop: on the level, going straight, in sight
      const { feet, up, fall } = route;
      const R = fall?.rise ? RISE : 0;
      const level = (j: number) => Math.abs(feet[j].p[up] - feet[j - 1].p[up]) < 1e-3 && Math.abs(feet[j + 1].p[up] - feet[j].p[up]) < 1e-3;
      const straight = (j: number) => dot(feet[j].fore, feet[j - 1].fore) > 0.95 && len(sub(feet[j].p, feet[j - 1].p)) > 0.1;
      const can = Array.from({ length: feet.length }, (_, j) => j).filter((j) => j >= 2 + (fall?.from ?? 0) && j < feet.length - 3 && level(j) && straight(j));
      const many = [rand(), rand()].filter((x) => x < 0.55).length;
      for (let n = 0; n < many && can.length; n++) {
        const j = can[Math.floor(rand() * can.length)];
        can.splice(0, can.length, ...can.filter((c) => Math.abs(c - j) > 6));
        const pick = rand();
        let act: Act = pick < 0.45 ? "phone" : pick < 0.7 ? "look" : pick < 0.85 ? "watch" : "stretch";
        if (act === "phone" && f.style.texting) act = "look";
        const long = act === "phone" ? 8 + 4 * rand() : act === "look" ? 5 + 2 * rand() : act === "watch" ? 4 : 4.5;
        f.pauses.push({ at: R + j + 0.2, long, act });
      }
      f.pauses.sort((p, q) => p.at - q.at);
      // a whole number of times round a loop, near enough at its pace (and of strides, or the feet come back the
      // other way round)
      f.laps = Math.max(1, Math.round((loop * options.pace) / lapOf(f)));
      if (!route.fall && (f.laps * beats(route)) % 2) f.laps++;
    }
    return f;
  };
  const fits = (route: Route) => {
    const f = walk(route);
    const N = beats(route);
    const R = route.fall?.rise ? RISE : 0;
    let limbs = 0;
    let count = 0;
    let fine = true;
    for (let beat = 0; beat < N && fine; beat += 0.125) {
      // (one who comes out of a door, or falls into a hole, is in the cube at either end, out of sight)
      if (route.fall && (beat < R + route.fall.from || beat > R + route.feet.length - 1)) continue;
      count++;
      stroll(f, beat / N, H).caps.forEach(([a, b, r], part) => {
        if (part === 1 || r === 0) return; // (the shoulders are in the body; and a phone it has not got is nowhere)
        // (a knee in a step: the stairs here are steep, a riser a fifth of a walker's height, and going up the knee
        // goes into the step before it. Seen from above it is hidden by the riser or by the walker: let it be)
        if ((part === 4 || part === 10) && what(b) === 2 && !inside(a) && !inside(mul(add(a, b), 0.5))) return;
        if ((part === 5 || part === 11) && what(a) === 2 && !inside(b) && !inside(mul(add(a, b), 0.5))) return;
        const into = inside(a) || inside(mul(add(a, b), 0.5)) || inside(b);
        if (into && part <= 3) fine = false;
        if (into && part > 3) limbs++;
        // (the head as a ball, not a point: it must not graze a wall either)
        if ((part === 2 || part === 3) && !into) for (const e of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as V[]) if (inside(add(a, e, r * 0.8))) fine = false;
      });
    }
    return fine && limbs <= count * 0.15;
  };
  turned.away = 0;
  const figures: Figure[] = [];
  const { found, way } = findRoutes(world, { seed: options.seed, steps, turns, tall: H, pace: options.pace, loop });
  // the best that fit and do not cross one another; a few of them fall into holes
  const taken = new Set<string>();
  // First, the way through the whole pile: walkers spread along it, each once round it a loop, a repeat of the
  // pile on, which is how far the picture drifts: so they keep up with the view, and are never seen to come back
  if (way) {
    way.cells.forEach((c) => taken.add(c));
    const many = options.onWay ?? 4;
    for (let n = 0; n < many; n++) {
      const f = walk(way.route, n / many, true);
      f.pauses = [];
      f.laps = 1;
      figures.push(f);
    }
  }
  const fallen = new Set<string>(); // holes fallen into, or come up out of
  const chosen: Route[] = [];
  let falls = 0;
  for (const { route, cells, holes } of found) {
    if (chosen.length >= 16 || (route.kind === "fall" && falls >= 4)) continue;
    if (cells.some((c) => taken.has(c)) || !fits(route)) continue;
    cells.forEach((c) => taken.add(c));
    holes.forEach((c) => fallen.add(c));
    chosen.push(route);
    if (route.kind === "fall") falls++;
  }
  // and for each of the two gravities that are not the floor's, someone on stairs, if no one is yet: up a wall
  // and along it, it is what the pile is for (the best way of that kind there is that fits)
  const climbs = (r: Route) => r.feet.filter((q, j) => j > 0 && Math.abs(q.p[r.up] - r.feet[j - 1].p[r.up]) > 0.01).length / r.feet.length;
  for (const up of [0, 2]) {
    if (chosen.some((r) => r.up === up && r.kind !== "fall" && climbs(r) >= 0.3)) continue;
    const pick = found.find(({ route, cells }) => route.up === up && route.kind !== "fall" && climbs(route) >= 0.3 && !cells.some((c) => taken.has(c)) && fits(route));
    if (!pick) continue;
    pick.cells.forEach((c) => taken.add(c));
    chosen.push(pick.route);
  }
  // walkers: one on each of the ways it was asked for (two on a long round, half round apart)
  // (each as it is, with its size and its stops, tried again: if that goes into the pile, the same at the plain
  // size and without stops; and failing that, plain)
  const still = (f: Walker) => {
    if (f.route.fall) return true;
    const L = lapOf(f);
    const phase = f.phase;
    f.phase = 0;
    let limbs = 0;
    let count = 0;
    let fine = true;
    for (let tau = 0; tau < L && fine; tau += 0.125, count++)
      stroll(f, tau / (L * f.laps), H).caps.forEach(([a, b, r], part) => {
        if (part === 1 || r === 0) return;
        const into = inside(a) || inside(mul(add(a, b), 0.5)) || inside(b);
        if (into && part <= 3) fine = false;
        if (into && part > 3) limbs++;
        // (the head as a ball, not a point: it must not graze a wall either)
        if ((part === 2 || part === 3) && !into) for (const e of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as V[]) if (inside(add(a, e, r * 0.8))) fine = false;
      });
    f.phase = phase;
    return fine && limbs <= count * 0.15;
  };
  chosen.slice(0, Math.round(chosen.length * options.walkers)).forEach((route) => {
    const many = beats(route) > 60 && (route.kind === "round" || route.kind === "on and on") ? 2 : 1;
    const start = rand();
    for (let w = 0; w < many; w++) {
      const f = walk(route, start + w / many, true);
      if (!still(f)) {
        f.style = { ...f.style, size: 1 };
        f.pauses = [];
        f.laps = Math.max(1, Math.round((loop * options.pace) / lapOf(f)));
        if (!route.fall && (f.laps * beats(route)) % 2) f.laps++;
        if (!still(f)) f.style = { ...PLAIN };
      }
      figures.push(f);
    }
  });
  // where the walkers go, over a loop: for keeping sitters out of their way
  const near: V[][] = Array.from({ length: 48 }, () => []);
  for (const f of figures)
    if (f.kind === "walker") for (let t = 0; t < 48; t++) for (const [a, b, r] of stroll(f, t / 48, H).caps) if (r > 0) near[t].push(a, b);
  const clear = (s: Sitter) => {
    for (let t = 0; t < 48; t++)
      for (const [a, b] of sit(s, t / 48, H).caps)
        for (const p of [s.frame.at(a), s.frame.at(b)])
          for (const q of near[t]) {
            // (a walker may be a repeat of the pile away)
            const d = sub(p, q);
            const m = Math.round(d[0] / P);
            const n = Math.round(d[2] / P);
            if (len(add(d, [-m * P, (m + n) * P, -n * P])) < 0.12) return false;
          }
    return true;
  };
  // a sitter laid a new way is kept only if its body and head stay out of the pile (and its legs for most of it)
  const sitsClear = (s: Sitter) => {
    let limbs = 0;
    for (let t = 0; t < 24; t++)
      for (const [n, [a, b, r]] of poseInWorld(s, t / 24, H).entries()) {
        if (n === 1 || r === 0) continue;
        const into = inside(a) || inside(mul(add(a, b), 0.5)) || inside(b);
        if (into && n <= 3) return false;
        if (into) limbs++;
      }
    return limbs <= 24 * 2;
  };
  const sideways = rng(options.seed ^ 0x3c6ef372); // (its own numbers, so that the rest come out as they did)
  const seat = (s: Sitter) => {
    if (figures.length >= MOST / 2) return;
    if (!clear(s)) return void turned.away++;
    figures.push(s);
  };
  for (let k = 0; k < P; k++)
    for (let i = 0; i < P; i++) {
      const c = k * P + i;
      // someone in an arch that does not come down to a floor: a window in a wall, or a hole in a top (none where
      // the walkers fall in)
      for (const [w, corner] of [[3, [i, 0, k]], [4, [i, 0, k]], [2, [i, 0, k]]] as [number, V][]) {
        const arch = data[c * WORDS + w];
        const [sits, aside, swing, begin, cloth, phone] = [rand(), rand(), rand(), rand(), rand(), rand()];
        const lo = ((arch >> 16) & 31) / 31;
        const half = ((arch >> 11) & 31) / 31;
        if (!(arch & 1) || (w !== 2 && lo === 0)) continue;
        // (some of the upright windows, as many as asked for; and every window that is not upright, and every hole:
        // those are the ones who sit the other ways up, and there are few of them)
        const upright = w !== 2 && frame([0, 0, 0], (arch >> 1) & 63).way([0, 1, 0])[1] > 0.5;
        if (upright && sits >= options.sitters) continue;
        const below = w === 2 ? 1 : (arch >> 7) & 15;
        // (the hole this is, to those whose floor the face is: the cell before it)
        const [hi, hk] = w === 3 ? [i + 1, k] : w === 4 ? [i, k + 1] : [i, k];
        if (fallen.has(`${hi % P},${hk % P},${g[c] - below + 1}`)) continue;
        corner[1] = g[c] - below - i - k;
        const room = frame(corner, (arch >> 1) & 63);
        const sitter: Sitter = { kind: "sitter", frame: room, lo, aside: (aside - 0.5) * Math.max(0, half * 2 - 0.3 * H) * 0.8, swings: 6 + Math.floor(swing * 8), phase: begin, suit: cloth, phone: phone < 0.3 };
        // Two in three of those in upright windows sit across them instead, on a side, their back to the other: so they sit
        // on a wall, as those do who walk the walls. Which side: the one whose up is a floor's up (+x or +z). (Laid
        // a quarter turn round the window's depth: their up is across it, their across is up it)
        const top = ((arch >> 21) & 31) / 31;
        // (of two windows joined in one cube, always the one toward +z: one sits up, the other across)
        const across = arch >>> 31 ? w === 4 : sideways() < 0.67;
        if (upright && across && half >= 0.15 && top - half - lo > 0.3 * H)
          for (const turn of [1, -1]) {
            const at = (q: V): V => (turn > 0 ? [q[1], 1 - q[0], q[2]] : [1 - q[1], q[0], q[2]]);
            const way = (d: V): V => (turn > 0 ? [d[1], -d[0], d[2]] : [-d[1], d[0], d[2]]);
            if (Math.max(...room.way(way([0, 1, 0]))) < 0.5) continue;
            // (its seat a little above the sill, along the side: its across is the window's up, one way or the other)
            const up = lo + 0.14 * H + (top - half - lo - 0.28 * H) * aside;
            const turned: Sitter = { ...sitter, frame: { at: (q) => room.at(at(q)), way: (d) => room.way(way(d)) }, lo: 0.5 - half, aside: turn > 0 ? 0.5 - up : up - 0.5 };
            if (sitsClear(turned)) Object.assign(sitter, turned);
            break;
          }
        seat(sitter);
      }
    }
  return figures;
}

// ---- a figure's capsules, in the space of the thing it is on. H: its height
type Cap = [V, V, number, number]; // from, to, radius, what it is made of
type Posed = { caps: Cap[]; ground: V; up: V; riser: V | null };

const cross3 = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
// from one way to another, turning about `up` (the short way round; a half turn goes to the left)
const turnTo = (a: V, b: V, k: number, up: V): V => {
  const left = cross3(up, a);
  const angle = Math.atan2(dot(b, left), dot(b, a));
  const turn = (Math.abs(angle) > Math.PI - 1e-3 ? Math.PI : angle) * k;
  return add(mul(a, Math.cos(turn)), left, Math.sin(turn));
};
const leg = (hip: V, ankle: V, thigh: number, shin: number, fore: V): [V, V] => {
  // the knee, bent the way the figure faces; an ankle out of reach is drawn in toward the hip (the heel comes up)
  let to = sub(ankle, hip);
  const far = Math.min(len(to), (thigh + shin) * 0.9995);
  to = unit(to);
  const along = (thigh * thigh - shin * shin + far * far) / (2 * far);
  const out = Math.sqrt(Math.max(thigh * thigh - along * along, 0));
  let bend = sub(fore, mul(to, dot(fore, to)));
  bend = len(bend) > 1e-4 ? unit(bend) : [0, 1, 0];
  return [add(add(hip, to, along), bend, out), add(hip, to, far)];
};

// the body and the head; the head turned round (yaw) and nodded down (pitch) from the way the body faces. The hair
// is on the back of the head, so the way it looks shows. Returns where the head is
const body = (caps: Cap[], hips: V, neck: V, up: V, fore: V, side: V, H: number, yaw = 0, pitch = 0): V => {
  caps.push([add(hips, up, 0.03 * H), add(neck, up, -0.07 * H), 0.068 * H, SUIT]);
  caps.push([add(add(neck, up, -0.035 * H), side, 0.075 * H), add(add(neck, up, -0.035 * H), side, -0.075 * H), 0.045 * H, SUIT]);
  const g = add(mul(fore, Math.cos(yaw)), side, Math.sin(yaw));
  const look = add(mul(g, Math.cos(pitch)), up, -Math.sin(pitch));
  const top = add(mul(up, Math.cos(pitch)), g, Math.sin(pitch));
  const head = add(add(neck, top, 0.1 * H), look, 0.012 * H);
  caps.push([head, add(head, up, 0.001), 0.058 * H, SKIN]);
  const hair = add(add(head, top, 0.014 * H), look, -0.016 * H);
  caps.push([hair, add(hair, up, 0.001), 0.059 * H, HAIR]);
  return head;
};
// a phone held in the hands, its face to the head; `show` 0..1 brings it out of the pocket
const phoneIn = (caps: Cap[], hands: V[], head: V, up: V, H: number, show: number) => {
  const at = mul(hands.reduce((t, h) => add(t, h), [0, 0, 0] as V), 1 / hands.length);
  const face = unit(sub(head, at));
  const long = unit(sub(up, mul(face, dot(up, face))));
  const r = Math.max(0, Math.min(1, show));
  const middle = add(at, up, 0.012 * H);
  caps.push([add(middle, long, -0.03 * H), add(middle, long, 0.03 * H), 0.016 * H * r, PHONE]);
  const glass = add(middle, face, 0.01 * H);
  caps.push([add(glass, long, -0.022 * H), add(glass, long, 0.022 * H), 0.01 * H * r, SCREEN]);
};
// the arm's two lengths; the hand goes on from the wrist the way the forearm points, a little curled
const UPPER = 0.16;
const FOREARM = 0.14;
const palm = (caps: Cap[], elbow: V, wrist: V, H: number, curl: V = [0, 0, 0]) => {
  const d = unit(add(unit(sub(wrist, elbow)), curl, 0.3));
  caps.push([add(wrist, d, 0.014 * H), add(wrist, d, 0.04 * H), 0.021 * H, SKIN]);
};
const none = (caps: Cap[]) => caps.push([[0, 0, 0], [0, 0, 0], 0, PHONE], [[0, 0, 0], [0, 0, 0], 0, SCREEN]);

// A walker on its way. The feet go one after the other on the footholds of the way, a foothold a beat, so
// that where steps are, there is a foot on every step; each foot is down from the beat it lands on until a
// little after the next, then swings to the next but one. The hips go as high as a straight leg holds them over
// the foothold the body is passing, and from there to the same over the next, made late, on the leg just put
// down: so on the level the knees are straight, and on stairs the climb is made on the leading leg.
const FALL = 3; // beats a fall into a hole takes, from the edge to out of sight
const RISE = 3; // and coming up out of one (a fall the other way: thrown up, slowing, onto the edge)
// beats once round a way
const beats = (r: Route) => r.feet.length + (r.fall ? FALL + (r.fall.rise ? RISE : 0) : 0);
// ...and with the walker's pauses
const lapOf = (f: Walker) => beats(f.route) + f.pauses.reduce((t, p) => t + p.long, 0);

function stroll(f: Walker, playhead: number, H0: number): Posed {
  const { feet, shift, fall } = f.route;
  const st = f.style;
  const H = H0 * st.size;
  const N = feet.length;
  const a = f.route.up;
  const up: V = [a === 0 ? 1 : 0, a === 1 ? 1 : 0, a === 2 ? 1 : 0];
  const flat = (v: V): V => sub(v, mul(up, dot(v, up)));
  // where in its time round it is: walking (a beat of its way), or stopped
  const L = lapOf(f);
  const total = (playhead * f.laps + f.phase) * L;
  const round = Math.floor(total / L);
  let tau = total - round * L;
  let pause: Pause | null = null;
  let u = 0;
  for (const p of f.pauses) {
    if (tau < p.at) break;
    if (tau < p.at + p.long) {
      pause = p;
      u = (tau - p.at) / p.long;
      tau = p.at;
      break;
    }
    tau -= p.long;
  }
  // (one who falls goes the way once a time round, out of a hole or a door and into a hole, and begins again out
  // of sight)
  const lap = beats(f.route);
  let beat = round * lap + tau;
  if (fall) {
    beat = tau;
    const R = fall.rise ? RISE : 0;
    if (beat < R) return tumble(f, 1 - beat / R, H, up, true);
    if (beat > R + N - 0.5) return tumble(f, (beat - R - (N - 0.5)) / FALL, H, up, false);
    beat -= R;
  }
  // the j-th foothold, going round as many times as it takes (each time round a step of the repeat further on)
  const at = (j: number) => {
    if (fall) return feet[Math.max(0, Math.min(N - 1, j))];
    const lap = Math.floor(j / N);
    const foot = feet[j - lap * N];
    return { p: add(foot.p, shift, lap), fore: foot.fore };
  };
  const b = beat - 0.5; // the body is over foothold j at beat j + 1/2
  const j0 = Math.floor(b);
  const t = b - j0;
  const [A, B] = [at(j0), at(j0 + 1)];
  const ground = add(A.p, sub(B.p, A.p), t);
  const fore = unit(flat(add(mul(A.fore, 1 - t), B.fore, t)));
  const side = cross3(up, fore);
  const stride = 0.38 * H0;
  // how far it goes and how much it climbs, foothold to foothold (0 while turning on the spot); blended on into
  // the next, so nothing changes all at once where stairs begin and end
  const goingOf = (j: number) => Math.min(1, len(flat(sub(at(j + 1).p, at(j).p))) / (0.5 * stride));
  const riseOf = (j: number) => dot(sub(at(j + 1).p, at(j).p), up);
  const going = mix(goingOf(j0), goingOf(j0 + 1), t);
  const rise = dot(sub(B.p, A.p), up);
  const slope = mix(riseOf(j0), riseOf(j0 + 1), t);
  const climbing = Math.min(1, Math.max(0, slope / (0.15 * H)));

  const reach = 0.4695 * H; // (a leg a hair short of straight: the knee a few degrees bent, as a standing one is)
  const ankleUp = 0.035 * H;
  // where the hips are, across, and the joint of a leg in them, at any beat: they lean over the foot they stand
  // on, and turn a little with the leg that swings
  const overAt = (bt: number) => {
    const b1 = bt - 0.5;
    const j1 = Math.floor(b1);
    const t1 = b1 - j1;
    const [A1, B1] = [at(j1), at(j1 + 1)];
    const fore1 = unit(flat(add(mul(A1.fore, 1 - t1), B1.fore, t1)));
    const side1 = cross3(up, fore1);
    const going1 = mix(goingOf(j1), goingOf(j1 + 1), t1);
    const over1 = add(add(flat(add(A1.p, sub(B1.p, A1.p), t1)), fore1, 0.015 * H * going1), side1, Math.sin(Math.PI * bt) * 0.012 * H * going1);
    const turn = -0.12 * Math.sin(Math.PI * (bt - 0.5)) * going1;
    return { over: over1, hipSide: add(mul(side1, Math.cos(turn)), fore1, Math.sin(turn)) };
  };
  const { over, hipSide } = overAt(beat);
  const hipJoint = (bt: number, sign: number) => {
    const o = bt === beat ? { over, hipSide } : overAt(bt);
    return add(o.over, o.hipSide, sign * 0.05 * H);
  };
  const held = (p: V) => dot(p, up) + ankleUp + Math.sqrt(Math.max(reach * reach - dot(flat(sub(p, over)), flat(sub(p, over))), 0));
  // How high the hips go: as high as a straight leg holds them over the footholds either side (lowest between
  // them), on a level that goes from foothold to foothold. Going up, the climb is made late, on the leg put down: it
  // lifts the body. Going down it is the other way about, and early: the leg it stands on bends and lets the body
  // down while the other reaches down for the step below. (The lower of the two ways: going up, the late one is
  // lower, going down the early one; and on the level they are the same. Over it, the higher of the two straight
  // legs, a hair more: the feet that bear have the last word, below)
  const way = (from: number) => mix(dot(A.p, up), dot(B.p, up), ease(Math.min(1, Math.max(0, (t - from) / (1 - from)))));
  const level = Math.min(way(0.3), way(0));
  let height = level + Math.max(held(A.p) - dot(A.p, up), held(B.p) - dot(B.p, up)) + 0.01 * H;
  const placed = (j: number, sign: number) => {
    const foot = at(j);
    return { p: add(foot.p, unit(cross3(up, foot.fore)), sign * 0.05 * H), fore: foot.fore };
  };
  // the feet first: where each is, and where it holds the body up from: where it stands, or, in the air, where it
  // left and where it will land, each for a while (so the body is let go of, and taken up, at its own pace, not
  // at the pace the foot goes)
  const feetNow = ([[0, 1], [1, -1]] as const).map(([n, sign]) => {
    // this foot's footholds are every other one: the last it was put on, and the beats since
    let J = Math.floor(beat);
    if ((((J % 2) + 2) % 2) !== n) J--;
    const since = beat - J;
    const from = placed(J, sign);
    const to = placed(J + 2, sign);
    const d = dot(to.p, up) - dot(from.p, up);
    const lift = 0.22; // beats with both feet down
    // (and going up, toward its push off the foot behind lets the body go on without it: its knee bends as the
    // heel comes up, so the leg is not straight when it leaves, to fold all at once. On the level the heel does it)
    let pushing = d > 0.01 ? Math.min(1, Math.max(0, (since - 0.8) / (0.2 + lift))) : 0;
    let sole = from.p;
    let toward = from.fore;
    let ankle: V;
    let toes: V;
    // (did it step down onto this foothold? then it lands on the ball of the foot, not the heel)
    const stepped = dot(from.p, up) - dot(placed(J - 2, sign).p, up);
    const holds: { ankle: V; at: number; bears: number; slack: number; pushing: number }[] = [];
    let landing: { bears: number; slack: number } | null = null;
    if (since > 1 + lift) {
      const s = (since - 1 - lift) / (1 - lift);
      const h0 = dot(from.p, up);
      if (d > 0.01) pushing = 1;
      // (the one it left holds as it did when it left, letting go; the one it lands on, from where the foot is)
      const off = J + 1 + lift;
      holds.push({ ankle: add(from.p, up, ankleUp + 0.065 * H * mix(goingOf(Math.floor(off - 0.5)), goingOf(Math.floor(off - 0.5) + 1), off - 0.5 - Math.floor(off - 0.5))), at: off, bears: 1, slack: 0.6 * H * s, pushing });
      const arrive = Math.max(0, 1 - (1 - s) / (d < -0.01 ? 0.45 : 0.25));
      landing = { bears: arrive, slack: arrive > 0 ? ((1 - arrive) ** 2 / arrive) * 0.25 * H : Infinity };
      // On the level it goes along, just clear of the ground. On stairs it goes the way the steps go, a riser at a
      // time: the step between is the other foot's, its edges a quarter and three quarters of the way, so up a
      // stair it is lifted to that step's height as it sets off and to the next as it comes to it; and down one it
      // goes out over the edge and down to the step between, then on over the next edge and down. Forward goes
      // ahead of up and down, so the foot is never left behind the hips with the knee folded
      const ramp = (a: number, b: number, v: number) => ease(Math.min(1, Math.max(0, (v - a) / (b - a))));
      // (forward at an even pace with the body, only half eased at the ends: a foot that got to where it lands too
      // soon would wait there, out of reach of the hips, and the knee would snap straight)
      const along = (v: number) => 0.5 * v + 0.5 * ease(v);
      let x: number;
      let h: number;
      let clear: number;
      if (d > 0.01) {
        x = along(s ** 0.7);
        h = h0 + d * (0.5 * ramp(0, 0.24, x) + 0.5 * ramp(0.42, 0.74, x));
        clear = 0.035 * H;
      } else if (d < -0.01) {
        x = along(s ** 0.75);
        h = h0 + d * (0.5 * ramp(0.24, 0.55, x) + 0.5 * ramp(0.76, 1, x));
        clear = 0.035 * H;
      } else {
        x = along(s);
        h = h0 + d * x;
        clear = 0.045 * H;
      }
      const m = add(from.p, sub(to.p, from.p), x);
      const run = Math.min(1, len(flat(sub(to.p, from.p))) / stride + 0.3);
      // (the heel was up as it pushed off: it is let down as the foot goes)
      const pushed = 0.065 * H * going * (1 - ease(Math.min(1, s / 0.35)));
      sole = add(m, up, h - dot(m, up) + clear * run * Math.sin(Math.PI * s));
      toward = turnTo(unit(flat(from.fore)), unit(flat(to.fore)), x, up);
      // in the air the toes hang after the push, and come up before the heel lands (or reach down for a lower step)
      // (and coming down onto a lower step, the heel stays up: it lands on the ball of the foot)
      const ball = d < -0.01 ? 0.03 * H * going * ease(Math.min(1, Math.max(0, (s - 0.6) / 0.4))) : 0;
      ankle = add(sole, up, ankleUp + pushed + ball);
      const toe = mix(-0.85, d < -0.01 ? -0.65 : 0.12, ease(s)) * going;
      toes = add(ankle, add(mul(toward, Math.cos(toe)), up, Math.sin(toe)), 0.07 * H);
    } else {
      // down: the heel first, toes up, then flat, then the heel rises as the other leg goes by; or, on a lower
      // step, the ball of the foot first, and the heel let down
      const heel = since > 0.65 ? 0.065 * H * ease(Math.min(1, (since - 0.65) / (0.35 + lift))) * going : 0;
      const down = since < 0.22 ? (1 - since / 0.22) * going : 0;
      if (heel > 0) {
        ankle = add(sole, up, ankleUp + heel);
        toes = add(add(sole, toward, 0.075 * H), up, 0.012 * H);
      } else if (stepped < -0.01 && down > 0) {
        ankle = add(sole, up, ankleUp + 0.03 * H * going * ease(down / Math.max(going, 1e-3)));
        toes = add(add(sole, toward, 0.07 * H), up, 0.012 * H);
      } else {
        const toe = 0.3 * ease(down);
        ankle = add(sole, up, ankleUp);
        toes = add(ankle, add(mul(toward, Math.cos(toe)), up, Math.sin(toe) - 0.18), 0.07 * H);
      }
      holds.push({ ankle, at: beat, bears: 1, slack: 0, pushing });
    }
    if (landing) holds.push({ ankle, at: beat, ...landing, pushing: 0 });
    return { sign, ankle, toes, holds };
  });
  // the hips lean over the foot they stand on, and turn a little with the leg that swings; the shoulders turn
  // the other way, with the arms
  const turnHips = -0.12 * Math.sin(Math.PI * (beat - 0.5)) * going;
  const shoulderSide = add(mul(side, Math.cos(-0.8 * turnHips)), fore, Math.sin(-0.8 * turnHips));
  // (no higher than a foot that bears can reach, so the one put down in front is straight and the one behind
  // bends at the knee as it pushes off, its heel up)
  for (const q of feetNow)
    for (const hold of q.holds) {
      // (the one it left gives way steadily, so the body goes up or down from it at a walking pace; the one it lands
      // on comes in from out of all bounds, so its coming is no jump)
      if (hold.bears <= 0) continue;
      const across = flat(sub(hold.ankle, hipJoint(hold.at, q.sign)));
      const short = reach * (1 - 0.02 * ease(hold.pushing));
      height = Math.min(height, dot(hold.ankle, up) + Math.sqrt(Math.max(short * short - dot(across, across), 0)) + hold.slack);
    }
  const hips = add(over, up, height);
  const neck = add(add(hips, up, 0.34 * H), fore, 0.016 * H + 0.065 * H * climbing * going);
  // where it looks: down at stairs, down at a phone, now and then about
  const steep = Math.max(-1, Math.min(1, slope / (0.1 * H)));
  const pitch = st.texting ? 0.65 : 0.05 + (steep > 0 ? 0.25 * steep : -0.4 * steep);
  const yaw = st.texting ? 0 : 0.4 * st.look * Math.sin(2 * Math.PI * (3 * tau / L + f.phase)) ** 3; // (three looks a time round, so the loop closes)
  const caps: Cap[] = [];
  const head = body(caps, hips, neck, up, fore, shoulderSide, H, yaw, pitch);
  const hands: V[] = [];
  for (const { sign, ankle, toes } of feetNow) {
    const hip = add(hips, hipSide, sign * 0.05 * H);
    const [knee, ankleAt] = leg(hip, ankle, 0.24 * H, 0.23 * H, fore);
    caps.push([hip, knee, 0.042 * H, SUIT], [knee, ankleAt, 0.033 * H, SUIT]);
    caps.push([ankleAt, add(ankleAt, unit(sub(toes, ankleAt)), 0.07 * H), 0.024 * H, SOCK]);
    // the arm on this side swings against the leg, the elbow a little bent; or holds a phone; or is in a pocket
    const shoulder = add(add(neck, up, -0.04 * H), shoulderSide, sign * 0.115 * H);
    let elbow: V;
    let hand: V;
    if (st.texting && sign < 0) {
      [elbow, hand] = leg(shoulder, add(add(add(neck, up, -0.18 * H), fore, 0.13 * H), side, -0.02 * H), UPPER * H, FOREARM * H, add(mul(up, -1), side, -0.4));
    } else if (st.pockets) {
      [elbow, hand] = leg(shoulder, add(add(add(hips, side, sign * 0.085 * H), fore, 0.01 * H), up, -0.01 * H), UPPER * H, FOREARM * H, mul(fore, -1));
    } else {
      // (less on stairs, as one does, so the hands keep clear of the steps)
      const onStairs = Math.abs(steep);
      // The upper arm swings from the shoulder against the leg; the forearm follows a moment late, bending as the
      // arm comes forward and letting out as it goes back, and in front the hand comes in a little toward the middle
      const amp = 0.4 * st.swing * (st.texting ? 0.5 : 1) * (1 - 0.5 * onStairs) * going;
      const swing = sign * amp * Math.sin(Math.PI * (beat - 0.5)) + 0.05;
      const late = sign * amp * Math.sin(Math.PI * (beat - 0.62));
      const bent = swing + 0.2 + 0.08 * going + 0.75 * Math.max(0, late);
      elbow = add(add(shoulder, add(mul(up, -Math.cos(swing)), fore, Math.sin(swing)), UPPER * H), side, sign * 0.012 * H);
      hand = add(elbow, unit(add(add(mul(up, -Math.cos(bent)), fore, Math.sin(bent)), side, -sign * (0.04 + 0.25 * Math.max(0, late)))), FOREARM * H);
    }
    if (st.texting && sign < 0) hands.push(hand);
    caps.push([shoulder, elbow, 0.03 * H, SUIT], [elbow, hand, 0.025 * H, SUIT]);
    palm(caps, elbow, hand, H, fore);
  }
  if (st.texting) phoneIn(caps, hands, head, up, H, 1);
  else none(caps);
  const walking: Posed = { caps, ground, up, riser: Math.abs(rise) > 0.02 ? (rise > 0 ? mul(fore, -1) : fore) : null };
  if (!pause) return walking;
  // stopped: from the stride it stopped in into a stance, and the thing it does, and back
  const still = idle(pause, u, ground, up, fore, side, H, f.phase);
  const w = ease(Math.min(1, u * pause.long / 0.9)) * ease(Math.min(1, (1 - u) * pause.long / 0.9));
  walking.caps = walking.caps.map(([p, q, r, made], i) => {
    const [p2, q2, r2] = still[i];
    // (a thing only one of the two has, a phone, is where that one has it: an empty one is at the world's origin)
    if (r <= 0) return [p2, q2, r2 * w, made];
    if (r2 <= 0) return [p, q, r * (1 - w), made];
    return [add(p, sub(p2, p), w), add(q, sub(q2, q), w), mix(r, r2, w), made];
  });
  return walking;
}

// Standing still, at ease (its weight from foot to foot, breathing), and doing what it stopped to do. u: 0..1
// through the stop. The same capsules, in the same order, as walking
function idle(p: Pause, u: number, ground: V, up: V, fore: V, side: V, H: number, phase: number): Cap[] {
  const time = u * p.long; // beats
  const breathe = Math.sin(time * 2.4 + phase * 6) * 0.004 * H;
  const shift = Math.sin(time * 0.9 + phase * 6) * 0.01 * H;
  // (within the stop: in, holding, out)
  const mid = ease(Math.min(1, u / 0.2)) * ease(Math.min(1, (1 - u) / 0.2));
  let yaw = 0;
  let pitch = 0;
  let lean = 0;
  if (p.act === "phone") pitch = 0.7 * mid;
  if (p.act === "watch") pitch = 0.55 * ease(Math.min(1, Math.max(0, (u - 0.2) / 0.2))) * ease(Math.min(1, Math.max(0, (0.8 - u) / 0.2)));
  if (p.act === "look") ((yaw = 0.9 * Math.sin(2 * Math.PI * u) * mid), (pitch = -0.15 * mid));
  if (p.act === "stretch") ((pitch = -0.45 * mid), (lean = -0.025 * H * mid));
  // (straight legs: thigh and shin are 0.47 of the height, the ankle 0.035 off the ground)
  const hips = add(add(ground, up, 0.5045 * H + breathe * 0.3), side, shift);
  const neck = add(add(hips, up, 0.34 * H + breathe), fore, 0.012 * H + lean);
  const caps: Cap[] = [];
  const head = body(caps, hips, neck, up, fore, side, H, yaw, pitch);
  const hands: V[] = [];
  for (const sign of [1, -1]) {
    const hip = add(hips, side, sign * 0.05 * H);
    const sole = add(add(ground, side, sign * 0.06 * H), side, -shift * 0.3);
    const [knee, ankle] = leg(hip, add(sole, up, 0.035 * H), 0.24 * H, 0.23 * H, fore);
    caps.push([hip, knee, 0.042 * H, SUIT], [knee, ankle, 0.033 * H, SUIT], [ankle, add(ankle, unit(add(add(fore, side, sign * 0.25), up, -0.2)), 0.07 * H), 0.024 * H, SOCK]);
    const shoulder = add(add(neck, up, -0.04 * H), side, sign * 0.115 * H);
    // the hands: by the sides, unless the thing it does wants them
    let target: V = add(add(add(shoulder, up, -0.29 * H), fore, 0.05 * H), side, sign * 0.005 * H);
    let bend: V = add(fore, side, sign * 0.2);
    if (p.act === "phone") {
      target = add(add(add(neck, up, -0.17 * H), fore, 0.14 * H), side, sign * 0.022 * H);
      if (sign < 0) target = add(target, up, 0.006 * H * Math.sin(time * 9)); // (a thumb going over the screen)
      bend = add(mul(up, -1), side, sign * 0.6);
    }
    if (p.act === "watch" && sign > 0) ((target = add(add(add(neck, up, -0.18 * H), fore, 0.12 * H), side, -0.01 * H)), (bend = add(mul(up, -1), side, 0.7)));
    if (p.act === "stretch") ((target = add(add(neck, up, 0.36 * H * mid + (1 - mid) * -0.29 * H), side, sign * 0.07 * H)), (bend = side.map((v) => v * sign) as V));
    if (p.act === "look" && sign > 0) target = add(add(hips, side, 0.1 * H), up, 0.02 * H); // (a hand on the hip)
    const [elbow, hand] = leg(shoulder, target, UPPER * H, FOREARM * H, bend);
    if (p.act === "phone") hands.push(hand);
    caps.push([shoulder, elbow, 0.03 * H, SUIT], [elbow, hand, 0.025 * H, SUIT]);
    palm(caps, elbow, hand, H, p.act === "phone" ? up : fore);
  }
  if (p.act === "phone") phoneIn(caps, hands, head, up, H, (mid - 0.3) / 0.4);
  else none(caps);
  return caps;
}

// Falling into a hole: a step on from its edge toward its middle, and down, faster and faster, arms up, through
// the floor of the hole and out of sight (the pile hides what is in it). u: 0 at the edge, 1 a long way down
function tumble(f: Walker, u: number, H: number, up: V, rising: boolean): Posed {
  const { feet, fall } = f.route;
  const last = rising ? feet[0] : feet[feet.length - 1];
  const into = sub(rising ? fall!.rise! : fall!.at, last.p);
  // (falling, it faces the hole; coming up, the way it will walk)
  const fore = mul(unit(sub(into, mul(up, dot(into, up)))), rising ? -1 : 1);
  const side: V = [up[1] * fore[2] - up[2] * fore[1], up[2] * fore[0] - up[0] * fore[2], up[0] * fore[1] - up[1] * fore[0]];
  const over = add(last.p, into, ease(Math.min(1, u / 0.3)));
  const drop = u < 0.1 ? 0 : 7 * (u - 0.1) * (u - 0.1);
  const hips = add(over, up, 0.44 * H - drop);
  const neck = add(hips, up, 0.34 * H);
  const caps: Cap[] = [];
  body(caps, hips, neck, up, fore, side, H);
  const flail = Math.min(1, u / 0.25);
  for (const sign of [1, -1]) {
    const hip = add(hips, side, sign * 0.05 * H);
    const knee = add(add(hip, up, -0.235 * H), fore, 0.04 * H * flail);
    const ankle = add(knee, up, -0.23 * H);
    caps.push([hip, knee, 0.042 * H, SUIT], [knee, ankle, 0.033 * H, SUIT], [ankle, add(ankle, fore, 0.07 * H), 0.024 * H, SOCK]);
    const shoulder = add(add(neck, up, -0.04 * H), side, sign * 0.115 * H);
    // (the arms thrown up and out, in a V)
    const reach = (v: number) => add(mul(up, -Math.cos(v)), side, sign * Math.sin(v));
    const elbow = add(shoulder, unit(reach(0.3 + 2.0 * flail)), UPPER * H);
    const hand = add(elbow, unit(reach(0.5 + 2.1 * flail)), FOREARM * H);
    caps.push([shoulder, elbow, 0.03 * H, SUIT], [elbow, hand, 0.025 * H, SUIT]);
    palm(caps, elbow, hand, H);
  }
  return { caps, ground: last.p, up, riser: null };
}

function sit(f: Sitter, playhead: number, H: number): Posed {
  // the window's own space: across it, up it, and into the wall; its sill at `lo`, its mouth at 0
  const up: V = [0, 1, 0];
  const fore: V = [0, 0, -1];
  const side: V = [1, 0, 0];
  const hips: V = [0.5 + f.aside, f.lo + 0.05 * H, 0.06 * H];
  const sway = Math.sin(2 * Math.PI * (playhead * Math.max(1, f.swings >> 2) + f.phase));
  const neck = add(add(add(hips, up, 0.33 * H), fore, 0.03 * H), side, 0.012 * H * sway);
  const caps: Cap[] = [];
  // (one with a phone looks down at it, and up now and then)
  const glance = f.phone ? 0.6 - 0.75 * Math.max(0, Math.sin(2 * Math.PI * (playhead * 3 + f.phase))) ** 8 : 0;
  const head = body(caps, hips, neck, up, fore, side, H, 0, glance);
  const hands: V[] = [];
  for (const [n, sign] of [[0, 1], [1, -1]]) {
    const hip = add(hips, side, sign * 0.05 * H);
    const knee = add(add(hip, fore, 0.235 * H), up, -0.005 * H);
    // the legs hang outside, and swing a little, one against the other
    const hang = 0.12 + 0.3 * Math.sin(2 * Math.PI * (playhead * f.swings + f.phase) + n * Math.PI);
    const ankle = add(knee, add(mul(up, -Math.cos(hang)), fore, Math.sin(hang)), 0.23 * H);
    caps.push([hip, knee, 0.042 * H, SUIT], [knee, ankle, 0.033 * H, SUIT]);
    caps.push([ankle, add(ankle, add(mul(up, -Math.cos(hang + 1.1)), fore, Math.sin(hang + 1.1)), 0.07 * H), 0.024 * H, SOCK]);
    // the hands on the sill, either side
    const shoulder = add(add(neck, up, -0.04 * H), side, sign * 0.115 * H);
    let hand: V = [hips[0] + sign * 0.13 * H, f.lo + 0.024 * H, 0.03 * H];
    if (f.phone && sign < 0) hand = add(add(hips, fore, 0.15 * H), up, 0.13 * H);
    const [elbow, wrist] = leg(shoulder, hand, UPPER * H, FOREARM * H, [sign * 0.6, 0, 1]);
    if (f.phone && sign < 0) hands.push(wrist);
    caps.push([shoulder, elbow, 0.03 * H, SUIT], [elbow, wrist, 0.025 * H, SUIT]);
    palm(caps, elbow, wrist, H, f.phone && sign < 0 ? up : fore);
  }
  if (f.phone) phoneIn(caps, hands, head, up, H, 1);
  // it takes its light from the wall under the window
  return { caps, ground: [0.5 + f.aside, Math.max(f.lo - 0.06, 0.01), 0], up: [0, 0, -1], riser: null };
}

// a figure's capsules in the world (for checking where they go)
export const poseInWorld = (f: Figure, playhead: number, H: number) => {
  const posed = f.kind === "walker" ? stroll(f, playhead, H) : sit(f, playhead, H);
  return posed.caps.map(([a, b, r, made]) => [f.frame.at(a), f.frame.at(b), r, made] as Cap);
};

// Every figure posed, and written out for the shaders (twice: the tile shows the pile twice over, the second
// time half a tile across and half a tile down). Also a grid over the tile that lists, for each square, the
// figures near enough to shade it. `sun`: toward the sun, in the world. Returns how many were written.
export function posePeople(figures: Figure[], playhead: number, o: { tall: number; steps: number; turns: number; P: number; sun: V }, bodies: Float32Array, grid: Uint32Array, across: number, down: number) {
  const size: V = [o.P * Math.SQRT2, o.P * Math.sqrt(6), 0];
  grid.fill(0, 0, across * down * SLOTS);
  tally.dropped = 0;
  let n = 0;
  for (const f of figures) {
    const posed = f.kind === "walker" ? stroll(f, playhead, o.tall) : sit(f, playhead, o.tall);
    if (f.kind === "walker") {
      // a walker may be any number of repeats of the pile away by now: brought back over its own tile, where it
      // looks just the same
      const m = Math.floor(posed.ground[0] / o.P);
      const n = Math.floor(posed.ground[2] / o.P);
      const back: V = [-m * o.P, (m + n) * o.P, -n * o.P];
      posed.caps = posed.caps.map(([a, b, r, made]) => (r > 0 ? [add(a, back), add(b, back), r, made] : [a, b, r, made]));
      posed.ground = add(posed.ground, back);
    }
    const up = f.frame.way(posed.up);
    // how squarely the sun meets the ground it takes its light from (stairs: the steps' tops and fronts, half and half)
    const facing = posed.riser ? 0.5 * (Math.max(dot(up, o.sun), 0) + Math.max(dot(f.frame.way(posed.riser), o.sun), 0)) : Math.max(dot(up, o.sun), 0);
    const caps = posed.caps.map(([a, b, r, made]) => [seen(f.frame.at(a)), seen(f.frame.at(b)), r, made] as Cap);
    const ground = seen(f.frame.at(posed.ground));
    const upSeen = seen(up);
    let lo: V = [1e9, 1e9, 1e9];
    let hi: V = [-1e9, -1e9, -1e9];
    // (a phone it has not got is nowhere, and no part of it)
    for (const [a, b, r] of caps)
      for (const p of r > 0 ? [a, b] : []) {
        lo = lo.map((v, j) => Math.min(v, p[j] - r)) as V;
        hi = hi.map((v, j) => Math.max(v, p[j] + r)) as V;
      }
    const mid = mul(add(lo, hi), 0.5);
    const reach = len(sub(hi, lo)) / 2;
    for (const [dx, dy] of [[0, 0], [size[0] / 2, -size[1] / 2]]) {
      const at = n * FIG * 4;
      bodies.set([ground[0] + dx, ground[1] + dy, facing, f.suit, mid[0] + dx, mid[1] + dy, mid[2], reach, ...upSeen, 0], at);
      caps.forEach(([a, b, r, made], j) => bodies.set([a[0] + dx, a[1] + dy, a[2], r, b[0] + dx, b[1] + dy, b[2], made], at + (HEAD + j * 2) * 4));
      for (let j = caps.length; j < CAPS; j++) bodies.fill(0, at + (HEAD + j * 2) * 4, at + (HEAD + j * 2 + 2) * 4);
      // the squares its shade may fall in
      const far = reach + 0.6; // (as in show.wgsl)
      const [x0, x1] = [Math.floor(((mid[0] + dx - far) / size[0]) * across), Math.floor(((mid[0] + dx + far) / size[0]) * across)];
      const [y0, y1] = [Math.floor((-(mid[1] + dy + far) / size[1]) * down), Math.floor((-(mid[1] + dy - far) / size[1]) * down)];
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const cell = ((((y % down) + down) % down) * across + (((x % across) + across) % across)) * SLOTS;
          let slot = 0;
          while (slot < SLOTS && grid[cell + slot]) slot++;
          if (slot < SLOTS) grid[cell + slot] = n + 1;
          else tally.dropped++;
        }
      n++;
    }
  }
  return n;
}
