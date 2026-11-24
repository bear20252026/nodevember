// The Blue Danube (Johann Strauss II, 1866), the first waltz's theme: its opening phrase twice
// (D D F# A A . a a . f# f#, then the same ending g g) and a D major chord to close, in 3/4.
// Beats are quarters from the downbeat of an empty first bar; the tune starts on its upbeat, beat 2.
export const BPM = 120;
export const BEATS = 33; // 11 bars: the chord rings out over the last two, then the upbeat comes round again (a 12th bar of rest did not close the loop any better)

/** at: beat; midi: the notes struck together; dur: beats it sounds (a short "tu" 1, the long one after it 2) */
export type Note = { at: number; midi: number[]; dur: number };

const D4 = 62;
const FS4 = 66;
const A4 = 69;
const D5 = 74;
const FS5 = 78;
const G5 = 79;
const A5 = 81;

const phrase = (from: number, last: number): Note[] =>
  (
    [
      [0, D4, 1],
      [1, D4, 1],
      [2, FS4, 1],
      [3, A4, 1],
      [4, A4, 2],
      [6, A5, 1],
      [7, A5, 2],
      [9, last, 1],
      [10, last, 2],
    ] as const
  ).map(([b, m, dur]) => ({ at: from + b, midi: [m], dur }));

export const NOTES: Note[] = [...phrase(2, FS5), ...phrase(14, G5), { at: 27, midi: [D4, FS4, A4, D5], dur: 4 }];

/**
 * Where each note's drum stands: two rows, like a keyboard's two octaves seen from the saved camera
 * (screen right is +x -z): the low D F# A on the near row, the high D F# G A behind, rising left to right.
 * [x, z, radius]
 */
export const DRUMS: Record<number, [number, number, number]> = {
  [D4]: [-0.03, 0.5, 0.15],
  [FS4]: [0.33, 0.15, 0.15],
  [A4]: [0.68, -0.2, 0.15],
  [D5]: [-0.38, 0.07, 0.12],
  [FS5]: [-0.06, -0.24, 0.12],
  [G5]: [0.15, -0.45, 0.12],
  [A5]: [0.39, -0.69, 0.12],
};
