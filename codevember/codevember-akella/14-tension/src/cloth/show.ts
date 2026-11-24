// What holds the sheet up, and what moves it: the pins and their cables, and the invisible shapes that
// come up from below, press, drag and go. All on one period, so it can loop.
import { physics, type PinSpec, type PusherState } from "./sim.ts";
import * as danube from "./danube.ts";
import * as waltz from "./waltz.ts";

/**
 * Which show: the waltz (the default; a real recording's stretch of the Blue Danube, a drum for each pitch
 * class), `?show=danube` (its tune synthesised, a drum for each note), `?show=beats` (silent, on a beat) or
 * `?show=manual` (nothing moves till one presses on the sheet: see touch.ts)
 */
const asked = typeof location !== "undefined" ? new URLSearchParams(location.search).get("show") : null;
export const SHOW: "beats" | "danube" | "waltz" | "manual" = asked === "danube" || asked === "beats" || asked === "manual" ? asked : "waltz";

// everything happens on a beat grid: 96 bpm, 32 beats (8 bars of 4) to the period; the Danube 120 bpm,
// 33 beats (11 bars of 3)
export const BPM = SHOW === "danube" ? danube.BPM : 96;
export const BEAT = 60 / BPM;
export const PERIOD = SHOW === "waltz" ? waltz.PERIOD : (SHOW === "danube" ? danube.BEATS : 32) * BEAT;
/**
 * How far the shapes run behind the sound, s: a drum peaks on its note, but the eye takes the bump as it
 * rises (the pop's ease-out has it 90% up 0.14 s before), and an onset read off a recording is the very
 * start of its attack, so on time looks early.
 * `?lag=` or the sound folder sets it
 */
const lagAsked = typeof location !== "undefined" ? new URLSearchParams(location.search).get("lag") : null;
export const sync = { lag: lagAsked !== null ? Number(lagAsked) : SHOW === "waltz" ? 0.39 : 0 };
/** what a key's time counts in: beats, or for the recording (which plays freely) seconds */
const UNIT = SHOW === "waltz" ? 1 : BEAT;

/** Pins at fractions of the sheet, each with its cable's heading (deg round from +x), rise (deg) and pre-stretch */
const PINS: [number, number, number, number, number][] = [
  [0, 0, 225, 22, 0.07],
  [1, 0, 315, 16, 0.06],
  [1, 1, 45, 4, 0.07],
  [0, 1, 135, 10, 0.06],
  [0.56, 0, 268, 30, 0.05],
  [1, 0.52, 2, -8, 0.06],
  [0, 0.62, 180, -4, 0.06],
];
const CABLE = 3.2;

export function makePins(n: number): PinSpec[] {
  const L = physics.size;
  return PINS.map(([fx, fy, heading, rise, pre]) => {
    const gx = Math.round(fx * (n - 1));
    const gy = Math.round(fy * (n - 1));
    const x = (gx / (n - 1) - 0.5) * L;
    const z = (gy / (n - 1) - 0.5) * L;
    const a = (heading * Math.PI) / 180;
    const e = (rise * Math.PI) / 180;
    const anchor: [number, number, number] = [x + CABLE * Math.cos(e) * Math.cos(a), CABLE * Math.sin(e), z + CABLE * Math.cos(e) * Math.sin(a)];
    return { gx, gy, anchor, rest: CABLE - pre };
  });
}

/**
 * How a segment runs into its key: c through the keys (Catmull-Rom), o a pop (fast, braking into the key),
 * i a drop (gathering speed: it leaves the cloth to fall on its own), s smooth (still at both ends)
 */
type Ease = "c" | "o" | "i" | "s";
/** beat, place, lift (how far its top stands above the resting sheet there; HIDE is under it), turn, and the ease in */
type Key = [beat: number, x: number, lift: number, z: number, yaw: number, tilt: number, ease: Ease];
/** top: from its centre to its highest point, as posed */
type Act = { kind: number; size: [number, number, number, number]; top: number; keys: Key[]; tiltAxis?: [number, number, number] };
type Abs = [t: number, x: number, y: number, z: number, yaw: number, tilt: number, ease: Ease];

// the sheet's height at rest, on a 9x9 grid over it (rows z -1..1, columns x -1..1), measured after the warm up
const REST = [
  [0.19, 0.14, 0.12, 0.12, 0.12, 0.11, 0.1, 0.1, 0.12],
  [0.07, 0.05, 0.04, 0.03, 0.02, 0.02, 0.02, 0.02, 0.03],
  [0.0, -0.02, -0.03, -0.04, -0.05, -0.06, -0.06, -0.05, -0.04],
  [-0.06, -0.08, -0.09, -0.1, -0.11, -0.11, -0.11, -0.11, -0.09],
  [-0.1, -0.12, -0.13, -0.14, -0.14, -0.14, -0.15, -0.14, -0.14],
  [-0.1, -0.14, -0.15, -0.16, -0.16, -0.17, -0.17, -0.16, -0.14],
  [-0.08, -0.13, -0.15, -0.16, -0.17, -0.17, -0.17, -0.16, -0.13],
  [-0.05, -0.11, -0.13, -0.15, -0.16, -0.16, -0.15, -0.14, -0.11],
  [-0.02, -0.09, -0.11, -0.13, -0.14, -0.15, -0.15, -0.13, -0.08],
];
/** The resting sheet's height at x z */
export function restY(x: number, z: number) {
  const u = Math.min(Math.max((x / physics.size + 0.5) * 8, 0), 7.999);
  const v = Math.min(Math.max((z / physics.size + 0.5) * 8, 0), 7.999);
  const i = Math.floor(u);
  const j = Math.floor(v);
  const fu = u - i;
  const fv = v - j;
  const r = (a: number, b: number) => REST[b][a];
  return (r(i, j) * (1 - fu) + r(i + 1, j) * fu) * (1 - fv) + (r(i, j + 1) * (1 - fu) + r(i + 1, j + 1) * fu) * fv;
}

export const HIDE = -0.3;

type Pop = { at: number; x: number; z: number; lift: number; hold?: number; up?: number; down?: number; yaw?: number; tilt?: number };
/** Pops of one shape: up from under the sheet to peak on beat `at`, hold, drop back under */
function pops(list: Pop[]): Key[] {
  const keys: Key[] = [];
  for (const { at, x, z, lift, hold = 1, up = 0.5, down = 0.5, yaw = 0, tilt = 0 } of list) {
    const from = at - up;
    const last = keys.length ? keys[keys.length - 1][0] : -Infinity;
    if (last > from + 1e-6) throw new Error(`pops overlap at beat ${at}`);
    if (last < from - 1e-6) keys.push([from, x, HIDE, z, yaw, tilt, "s"]);
    keys.push([at, x, lift, z, yaw, tilt, "o"]);
    if (hold > 0) keys.push([at + hold, x, lift, z, yaw, tilt, "s"]);
    keys.push([at + hold + down, x, HIDE, z, yaw, tilt, "i"]);
  }
  return keys;
}

// four medium drums on a line across the sheet; they take turns
const ROW: [number, number][] = [
  [-0.54, 0.32],
  [-0.18, 0.1],
  [0.18, -0.12],
  [0.54, -0.34],
];
const DRUM: [number, number, number, number] = [0.15, 0.3, 0.045, 0];
const drum = (d: number, at: number, lift = 0.4, more: Partial<Pop> = {}): Pop => ({ at, x: ROW[d][0], z: ROW[d][1], lift, ...more });
const tick = { hold: 0.5, up: 0.35, down: 0.35 };

// kinds: 1 ball, 2 rod along y (round ended), 3 rounded box, 4 ring, 5 egg, 6 cone, 7 drum (rounded cylinder), 8 the face
// beats: bars 1-2 the drums walk across and back and all hit together; 3-4 a ball breathes and a cube ticks round;
// 5 a ring, with two drums on the off beats; 6-7 the face looks about on the beat; 8 an egg, then the sheet settles
const BEAT_ACTS: Act[] = [
  ...[0, 1, 2, 3].map(
    (d): Act => ({
      kind: 7,
      size: DRUM,
      top: DRUM[1],
      keys: pops(
        [
          // walk there (each up as the last goes down) and back
          drum(d, 1 + d),
          ...(d < 3 ? [drum(d, 7 - d, 0.4, d === 0 ? { hold: 2 } : { hold: 1 })] : []),
          // all four on beat 8
          ...(d > 0 ? [drum(d, 8, 0.46, { hold: 1 })] : []),
          // off beats under the ring
          ...(d === 3 ? [drum(3, 16.5, 0.34, tick), drum(3, 18.5, 0.34, tick)] : []),
          ...(d === 2 ? [drum(2, 17.5, 0.34, tick), drum(2, 19.5, 0.34, tick)] : []),
          // answering the face's turns, from the far ends
          ...(d === 0 ? [drum(0, 23, 0.36, tick)] : []),
          ...(d === 3 ? [drum(3, 25, 0.36, tick)] : []),
        ].sort((a, b) => a.at - b.at),
      ),
    }),
  ),
  // a ball breathes in the middle, swelling on every other beat as it rolls over
  {
    kind: 1,
    size: [0.28, 0, 0, 0],
    top: 0.28,
    keys: [
      [9, -0.25, HIDE, 0.15, 0, 0, "s"],
      [11, -0.25, 0.42, 0.15, 0, 0, "o"],
      [12, -0.15, 0.34, 0.1, 0, 0, "c"],
      [13, -0.05, 0.46, 0.03, 0, 0, "c"],
      [14, 0.05, 0.36, -0.03, 0, 0, "c"],
      [15, 0.12, 0.44, -0.08, 0, 0, "c"],
      [16, 0.15, HIDE, -0.1, 0, 0, "i"],
    ],
  },
  // a cube, one corner up, giving a twist on each beat: the cloth winds round it
  {
    kind: 3,
    size: [0.15, 0.15, 0.15, 0.015],
    top: 0.26,
    tiltAxis: [1, 0, 1],
    keys: [
      [11.5, 0.36, HIDE, -0.42, 0, 54.7, "s"],
      [12, 0.36, 0.34, -0.42, 0, 54.7, "o"],
      [13, 0.34, 0.36, -0.4, 40, 54.7, "o"],
      [14, 0.32, 0.38, -0.38, 80, 54.7, "o"],
      [15, 0.3, 0.38, -0.36, 120, 54.7, "o"],
      [16, 0.3, HIDE, -0.36, 130, 54.7, "i"],
    ],
  },
  // a ring presses flat on the one, tips on the three
  {
    kind: 4,
    size: [0.25, 0.045, 0, 0],
    top: 0.045,
    keys: [
      [16, -0.45, HIDE, 0.4, 0, 0, "s"],
      [17, -0.45, 0.24, 0.4, 0, 0, "o"],
      [18, -0.44, 0.26, 0.39, 0, 0, "s"],
      [19, -0.4, 0.3, 0.36, 0, 28, "o"],
      [20, -0.4, HIDE, 0.34, 0, 40, "i"],
    ],
  },
  // the face: up over two beats, looking up; then looks one way, the other, nods, and sinks. Tipped 18°
  // chin-down from straight up (-90), so the forehead (3 cm below the nose) pushes too, not the chin
  // (at -90 the chin stood 7 cm below the nose, the forehead 9-17)
  {
    kind: 8,
    size: [0.45, 0, 0, 0],
    top: 0,
    tiltAxis: [1, 0, 0],
    keys: [
      [20, 0.0, -0.4, 0.05, 0, -72, "s"],
      [22, 0.0, 0.33, 0.08, 0, -72, "o"],
      [23, 0.03, 0.36, 0.07, 14, -70, "o"],
      [24, -0.03, 0.36, 0.08, -12, -74, "o"],
      [25, 0.0, 0.38, 0.07, 0, -64, "o"],
      [26, 0.0, 0.36, 0.08, 0, -72, "o"],
      [27.5, 0.0, -0.4, 0.05, 0, -72, "i"],
    ],
  },
  // the egg, the last one up, on the one of the last bar
  {
    kind: 5,
    size: [0.13, 0.22, 0.13, 0],
    top: 0.2,
    tiltAxis: [1, 0, 0],
    keys: pops([{ at: 28, x: -0.5, z: -0.45, lift: 0.3, hold: 0.75, up: 0.5, down: 0.6, yaw: 40, tilt: 30 }]),
  },
];

// the Danube: one drum per pitch, up on its note. A short note pops and goes; a long one stays up
// longer and higher; the same note twice running dips and strikes again rather than going right under;
// the chord's four come up slower, together, and swell as it rings
const DIP = 0.06;
const DANUBE_ACTS: Act[] = Object.entries(danube.DRUMS).map(([m, [x, z, r]]): Act => {
  const notes = danube.NOTES.filter((n) => n.midi.includes(+m)).sort((a, b) => a.at - b.at);
  const keys: Key[] = [];
  const key = (b: number, lift: number, ease: Ease) => keys.push([b, x, lift, z, 0, 0, ease]);
  let end = -Infinity;
  let down = 0;
  for (const n of notes) {
    const chord = n.midi.length > 1;
    const long = n.dur >= 2;
    const lift = chord ? 0.42 : long ? 0.42 : 0.34;
    const hold = chord ? 3.3 : long ? 1.0 : 0.12;
    const up = chord ? 0.7 : 0.4;
    if (n.at - end > 1.3) {
      if (keys.length) key(end + down, HIDE, "i");
      key(n.at - up, HIDE, "s");
    } else key(end + (n.at - end) * 0.45, DIP, "i");
    key(n.at, lift, "o");
    key(n.at + hold, chord ? 0.5 : lift, "s");
    end = n.at + hold;
    down = chord ? 0.7 : 0.4;
  }
  key(end + down, HIDE, "i");
  return { kind: 7, size: [r, 0.3, 0.045, 0], top: 0.3, keys };
});

// the recording: a drum per pitch class round a ring. Octave sets how high it pops (D4 low, D6 high); a
// note held till the next stays up till just before it; a chord's drums rise a little slower, together.
// While a held note (or a chord) sounds, its drum sweeps on round the ring, waltzing the cloth along for
// as long as the note lasts; struck again, it carries on from there; down, it glides home under the sheet.
// Times in seconds. The loop is played three times over (before, this, after) so a drum striking across
// the wrap (the closing tap into the upbeat) runs on smoothly, and only this period is ever looked at.
const SWEEP = 0.35; // rad/s round the ring (0.18 m/s on its 0.52 m radius)

/** Hand edits to the recording's notes (see editor.ts), by note id `<t>:<pitch class>`: mute it, or hold it this long (s) */
export type NoteEdit = { mute?: boolean; hold?: number };
export type NoteEdits = Record<string, NoteEdit>;
/** A drum's note as built, for the editor: where it is, how long it is up, and whether it is edited */
export type BuiltNote = { ids: string[]; drum: number; t: number; hold: number; oct: number; chord: boolean; muted: boolean; edited: boolean };

function buildWaltz(edits: NoteEdits) {
  const notes: BuiltNote[] = [];
  const all = waltz.HITS.map((h) => h.t);
  const acts = waltz.CLASSES.map((pc, k): Act => {
    type Ev = { t: number; oct: number; chord: boolean; gap: number; ids: string[]; cycle: number; hold?: number };
    const evs: Ev[] = [];
    for (const cycle of [-1, 0, 1])
      for (const h of waltz.HITS) {
        const ms = h.midi.filter((m) => m % 12 === pc);
        if (!ms.length) continue;
        const t = h.t + cycle * waltz.PERIOD;
        // till the next note of the tune, anywhere
        const nextAny = all.find((q) => q > h.t + 0.02) ?? all[0] + waltz.PERIOD;
        // (and none outlasts the music: the last tap is short, not held through the silence to the upbeat)
        const ev = { t, oct: Math.floor(Math.max(...ms) / 12) - 1, chord: !!h.chord, gap: Math.min(nextAny, waltz.END) - h.t, ids: [`${h.t.toFixed(2)}:${pc}`], cycle, hold: h.hold };
        const same = evs.find((e) => Math.abs(e.t - t) < 0.02);
        if (!same) evs.push(ev);
        else {
          // two notes on one drum at once (the last chord's D and the tune's): one strike
          same.oct = Math.max(same.oct, ev.oct);
          same.chord ||= ev.chord;
          same.gap = Math.max(same.gap, ev.gap);
          if (ev.hold !== undefined) same.hold = Math.max(same.hold ?? 0, ev.hold);
          if (!same.ids.includes(ev.ids[0])) same.ids.push(...ev.ids);
        }
      }
    evs.sort((a, b) => a.t - b.t);
    const muted = (e: Ev) => e.ids.every((id) => edits[id]?.mute);
    const asked = (e: Ev) => {
      const hs = e.ids.map((id) => edits[id]?.hold).filter((h): h is number => h !== undefined);
      return hs.length ? Math.max(...hs) : e.hold;
    };
    const live = evs.filter((e) => !muted(e));
    const keys: Key[] = [];
    let turn = 0; // how far on round the ring it has swept from its place
    const key = (b: number, lift: number, ease: Ease) => {
      const [x, z] = waltz.ringPlace(k, turn);
      keys.push([b, x, lift, z, 0, 0, ease]);
    };
    const UP = 0.28;
    const DOWN = 0.3;
    const holdOf = (e: Ev) => {
      const h = asked(e);
      const long = h !== undefined ? h >= 0.3 : e.gap >= 0.55;
      return { long, hold: h ?? (e.chord ? (e.gap > 0.9 ? 1.0 : 0.85) : long ? Math.min(e.gap - 0.3, 2.0) : 0.08) };
    };
    let end = -Infinity;
    live.forEach((e, i) => {
      const next = live[i + 1];
      let { long, hold } = holdOf(e);
      const lift = e.chord ? 0.4 : 0.26 + 0.07 * (e.oct - 4) + (long ? 0.05 : 0);
      const up = e.chord ? 0.35 : UP;
      if (e.t - up - end > DOWN + 0.05) {
        if (keys.length) key(end + DOWN, HIDE, "i");
        // down under the sheet: back to its place for the next rise
        turn = 0;
        key(e.t - up, HIDE, "s");
      } else key(end + (e.t - end) * 0.45, DIP, "i");
      key(e.t, lift, "o");
      // struck again soon: come off it in time to dip
      if (next && next.t - (e.t + hold) < 0.15) hold = Math.max(0.05, next.t - e.t - 0.15);
      if (long || e.chord) turn += SWEEP * hold;
      key(e.t + hold, lift, "s");
      end = e.t + hold;
      if (e.cycle === 0) notes.push({ ids: e.ids, drum: k, t: e.t, hold, oct: e.oct, chord: e.chord, muted: false, edited: e.ids.some((id) => edits[id]) });
    });
    for (const e of evs) if (e.cycle === 0 && muted(e)) notes.push({ ids: e.ids, drum: k, t: e.t, hold: holdOf(e).hold, oct: e.oct, chord: e.chord, muted: true, edited: true });
    if (keys.length) key(end + DOWN, HIDE, "i");
    else {
      // every note muted: it stays under, out of the way
      key(-1, HIDE, "s");
      key(waltz.PERIOD + 1, HIDE, "s");
    }
    return { kind: 7, size: [0.13, 0.3, 0.045, 0], top: 0.3, keys };
  });
  return { acts, notes };
}

const tracksOf = (acts: Act[]): Abs[][] => acts.map((act) => act.keys.map(([b, x, lift, z, yaw, tilt, ease]): Abs => [b * UNIT, x, restY(x, z) + lift - act.top, z, yaw, tilt, ease]));

let built = SHOW === "waltz" ? buildWaltz({}) : undefined;
let ACTS = built ? built.acts : SHOW === "danube" ? DANUBE_ACTS : SHOW === "manual" ? [] : BEAT_ACTS;
/** The keys in seconds and absolute height */
let TRACKS: Abs[][] = tracksOf(ACTS);

/** The recording's notes as now built (for the editor) */
export const waltzNotes = () => built?.notes ?? [];
/** Rebuild the recording's drums with these edits; the sheet just goes on from where it is */
export function setWaltzEdits(edits: NoteEdits) {
  if (SHOW !== "waltz") return;
  built = buildWaltz(edits);
  ACTS = built.acts;
  TRACKS = tracksOf(ACTS);
}

export function quat(yaw: number, tilt: number, axis: [number, number, number]): [number, number, number, number] {
  // tilt round `axis` first, then yaw round y
  const l = Math.hypot(...axis) || 1;
  const t = (tilt * Math.PI) / 360;
  const a: [number, number, number, number] = [(axis[0] / l) * Math.sin(t), (axis[1] / l) * Math.sin(t), (axis[2] / l) * Math.sin(t), Math.cos(t)];
  const y = (yaw * Math.PI) / 360;
  const b: [number, number, number, number] = [0, Math.sin(y), 0, Math.cos(y)];
  // b * a
  return [
    b[3] * a[0] + b[0] * a[3] + b[1] * a[2] - b[2] * a[1],
    b[3] * a[1] - b[0] * a[2] + b[1] * a[3] + b[2] * a[0],
    b[3] * a[2] + b[0] * a[1] - b[1] * a[0] + b[2] * a[3],
    b[3] * a[3] - b[0] * a[0] - b[1] * a[1] - b[2] * a[2],
  ];
}

/** Where every shape is at time t (seconds, any; it repeats every PERIOD) */
export function pushersAt(t: number): PusherState[] {
  const v = t - sync.lag;
  const u = ((v % PERIOD) + PERIOD) % PERIOD;
  return ACTS.map((act, n) => {
    const k = TRACKS[n];
    const first = k[0][0];
    const last = k[k.length - 1][0];
    if (u <= first || u >= last) return { kind: 0, c: [0, -3, 0], q: [0, 0, 0, 1], size: act.size };
    let j = 0;
    while (k[j + 1][0] < u) j++;
    const a = k[j];
    const b = k[j + 1];
    const s = (u - a[0]) / (b[0] - a[0]);
    const dt = b[0] - a[0];
    let lerp: (i: number) => number;
    if (b[6] === "c") {
      // through the keys smoothly (Hermite, Catmull-Rom tangents), stopping only at the ends
      const tangent = (m: number, i: number) => (m <= 0 || m >= k.length - 1 ? 0 : (((k[m + 1][i] as number) - (k[m - 1][i] as number)) / (k[m + 1][0] - k[m - 1][0])) * dt);
      const s2 = s * s;
      const s3 = s2 * s;
      lerp = (i) => (2 * s3 - 3 * s2 + 1) * (a[i] as number) + (s3 - 2 * s2 + s) * tangent(j, i) + (-2 * s3 + 3 * s2) * (b[i] as number) + (s3 - s2) * tangent(j + 1, i);
    } else {
      const f = b[6] === "o" ? 1 - (1 - s) ** 3 : b[6] === "i" ? s * s : s * s * (3 - 2 * s);
      lerp = (i) => (a[i] as number) + ((b[i] as number) - (a[i] as number)) * f;
    }
    return { kind: act.kind, c: [lerp(1), lerp(2), lerp(3)], q: quat(lerp(4), lerp(5), act.tiltAxis ?? [1, 0, 0]), size: act.size };
  });
}
