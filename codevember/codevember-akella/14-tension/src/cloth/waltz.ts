// The real recording: The Blue Danube, 1:56.70 to 2:14.68, the first waltz theme's second half (bars 17-32:
// D D F# A d . d' d' . a a, D D F# A d . d' d' . b b, E . E G B~ B G# A F#~ D' F#) and its cadence, three
// chords G, A, D. public/waltz.flac is that stretch, faded in over 60 ms and out after the last chord's tap
// (what follows is the next section already), with 0.3 s of silence before and 1.0 s after: the loop
// opens with every shape down (one already up when the sim starts tears the fresh sheet), and the sheet
// gets a breath to settle before it comes round.
// Note times were read off the recording (onsets, and the strongest pitch in the tune's range after each),
// against the score; the recording plays freely (rubato), so they are seconds, not beats.
export const FROM = 116.4; // where in the recording the loop's time 0 falls (0.3 s of silence, then 116.70), s
export const PERIOD = 19.28;
/** where the music stops (its fade out ends): no note is held past it */
export const END = +(134.68 - FROM).toFixed(3);

/** t: s into the loop; midi: the notes; chord: struck as a chord (rises slower, together) */
export type Hit = { t: number; midi: number[]; chord?: boolean; hold?: number };

const at = (rec: number) => +(rec - FROM).toFixed(3);
const D4 = 62, FS4 = 66, A4 = 69, G4 = 67, B4 = 71, CS5 = 73, D5 = 74, E5 = 76, FS5 = 78, G5 = 79, GS5 = 80, A5 = 81, B5 = 83, D6 = 86;

// the tune, one note at a time: [time in the recording, note, how long its drum stays up if set by hand]
// (the hand-set ones, and the upbeat D left out, were tuned by eye in the note editor)
const TUNE: [number, number, number?][] = [
  // [116.8, D4], the upbeat: its pop read too early, before the music had really begun
  [117.25, D4],
  [117.63, FS4],
  [117.95, A4],
  [118.31, D5, 0.61],
  [118.98, D6],
  [119.42, D6],
  [120.04, A5],
  [120.43, A5],
  [121.08, D4],
  [121.4, D4],
  [121.75, FS4],
  [122.11, A4],
  [122.41, D5],
  [123.05, D6],
  [123.37, D6],
  [123.97, B5],
  [124.32, B5],
  [124.96, E5, 0.24],
  [125.44, E5],
  [126.32, G5],
  [126.85, B5], // held two seconds
  [129.02, GS5],
  [129.38, A5],
  [129.7, FS5], // held
  [130.97, D6],
  [131.33, FS5],
  [131.63, FS5], // over the first chord
  [132.28, E5],
  [132.62, B5], // over the second
  [133.26, A5],
  [133.66, D5, 0.36], // the last chord
  [134.26, D5, 0.05], // and its tap
];

// the cadence: G, A, then D
const CHORDS: [number, number[]][] = [
  [131.63, [G4, B4, D5]],
  [132.62, [A4, CS5, E5]],
  [133.66, [D4, FS4, A4]],
];

export const HITS: Hit[] = [...TUNE.map(([t, m, hold]): Hit => ({ t: at(t), midi: [m], hold })), ...CHORDS.map(([t, ms]): Hit => ({ t: at(t), midi: ms, chord: true }))].sort((a, b) => a.t - b.t);

/** One drum per pitch class, round a ring like a clock face, D first on the screen's left, going on round the far side */
export const CLASSES = [2, 4, 6, 7, 8, 9, 11, 1]; // D E F# G G# A B C#
/** where drum k stands, `turn` radians on round the ring from its place */
export function ringPlace(k: number, turn = 0): [number, number] {
  // from the saved camera: screen right is (0.71, -0.70) in x z, towards the camera (0.70, 0.71)
  const R = [0.7096, -0.7046];
  const T = [0.7046, 0.7096];
  const th = (k / CLASSES.length) * Math.PI * 2 + turn;
  const c = [0.12, -0.08];
  const a = -Math.cos(th) * 0.52;
  const b = -Math.sin(th) * 0.52;
  return [c[0] + a * R[0] + b * T[0], c[1] + a * R[1] + b * T[1]];
}
