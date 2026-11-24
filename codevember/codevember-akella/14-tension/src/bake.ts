// Runs the chain unseen until it repeats itself, then keeps one period of it, as the picture sees it.
// Frame 0 is the moment before a tear, frame 1 the first after it.
import { P, Chain } from "./sim.ts";

export type Baked = {
  frames: number; // a period
  n: number; // nodes
  x: Float32Array; // frames * n
  y: Float32Array;
  mat: Float32Array;
  gen: Int8Array; // of the segment after node i: the same in every frame
  stone: Float32Array; // its height, frames
  // the torn sheath: a slot for each side and age (1 .. K-1), each `tn` nodes, frames * slots * tn
  slots: { right: boolean; gen: number }[];
  tn: number;
  tx: Float32Array;
  ty: Float32Array;
  tmat: Float32Array;
  off: number; // how far the last period was from the one before, at its worst
  ms: number; // how long it took
};

export function bake(settle = 14): Baked {
  const t0 = performance.now();
  const c = new Chain();
  const TF = c.TF;
  for (let i = 0; i < settle * TF; i++) c.step();
  const n = c.n;
  const slots: Baked["slots"] = [];
  for (let k = 1; k < P.K; k++)
    for (const right of [false, true]) slots.push({ right, gen: k });
  const tn = P.NC / 2 + 1;
  const take = () => {
    const x = new Float32Array(TF * n),
      y = new Float32Array(TF * n),
      mat = new Float32Array(TF * n),
      stone = new Float32Array(TF),
      tx = new Float32Array(TF * slots.length * tn),
      ty = new Float32Array(TF * slots.length * tn),
      tmat = new Float32Array(TF * slots.length * tn);
    for (let k = 1; k <= TF; k++) {
      c.step();
      const j = k % TF;
      const z = c.zoom(k / TF);
      for (let i = 0; i < n; i++) {
        x[j * n + i] = c.x[i] * z;
        y[j * n + i] = c.y[i] * z;
        mat[j * n + i] = c.mat[i];
      }
      stone[j] = c.sy * z;
      slots.forEach((sl, si) => {
        const t = c.tails.find((t) => t.right === sl.right && t.gen === sl.gen);
        for (let q = 0; q < tn; q++) {
          const o = (j * slots.length + si) * tn + q;
          tx[o] = t ? t.x[q] * z : NaN;
          ty[o] = t ? t.y[q] * z : NaN;
          tmat[o] = t ? t.mat[q] : 0;
        }
      });
    }
    return { x, y, mat, stone, tx, ty, tmat };
  };
  const a = take();
  const b = take();
  let off = 0;
  for (let i = 0; i < a.x.length; i++)
    off = Math.max(off, Math.abs(a.x[i] - b.x[i]), Math.abs(a.y[i] - b.y[i]));
  for (let i = 0; i < a.tx.length; i++)
    off = Math.max(
      off,
      Math.abs(a.tx[i] - b.tx[i]) || 0,
      Math.abs(a.ty[i] - b.ty[i]) || 0,
    );
  return {
    frames: TF,
    n,
    ...b,
    gen: c.gen.slice(0, n),
    slots,
    tn,
    off,
    ms: performance.now() - t0,
  };
}
export { P };
