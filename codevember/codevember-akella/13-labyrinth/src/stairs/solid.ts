// Whether a point of the world is inside the pile: in a cube (and not in the room behind one of its arches), or
// in a staircase, a fan or a small cube. The same shapes as trace.wgsl draws, asked on the processor, so that the
// people's ways can be tried before they are walked.
import { WORDS } from "./world.ts";

type V = [number, number, number];
const laid = (p: V, code: number): V => {
  const q: V = [code & 1 ? 1 - p[0] : p[0], code & 2 ? 1 - p[1] : p[1], code & 4 ? 1 - p[2] : p[2]];
  const o = code >> 3;
  return o === 1 ? [q[0], q[2], q[1]] : o === 2 ? [q[1], q[0], q[2]] : o === 3 ? [q[1], q[2], q[0]] : o === 4 ? [q[2], q[0], q[1]] : o === 5 ? [q[2], q[1], q[0]] : q;
};
const outline = (a: number, b: number, w: number) => {
  const half = ((w >> 11) & 31) / 31;
  const lo = ((w >> 16) & 31) / 31;
  const hi = ((w >> 21) & 31) / 31;
  const x = Math.abs(a - 0.5);
  const d = b > hi - half ? Math.hypot(x, b - (hi - half)) - half : x - half;
  return Math.max(d, lo - b);
};
const room = (p: V, w: number) => {
  const q = laid(p, (w >> 1) & 63);
  const deep = w >>> 31 ? 0.5 + ((w >> 11) & 31) / 31 : ((w >>> 26) & 31) / 31;
  return Math.min(-outline(q[0], q[1], w), deep - q[2]);
};

// what a point is in: 0 nothing, 1 a cube, 2 stairs or a fan, 3 a small cube
export function solidKind(world: { P: number; data: Uint32Array; g: Int32Array }, steps: number, turns: number, small: number) {
  const { P, data, g } = world;
  const mod = (v: number) => ((v % P) + P) % P;
  return (p: V): number => {
    const c: V = [Math.floor(p[0]), Math.floor(p[1]), Math.floor(p[2])];
    const n = mod(c[2]) * P + mod(c[0]);
    const s = c[0] + c[1] + c[2];
    const local: V = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    if (s < g[n]) {
      for (const f of [2, 3, 4]) {
        const w = data[n * WORDS + f];
        if (w & 1 && s === g[n] - (f === 2 ? 1 : (w >> 7) & 15) && room(local, w) > 0) return 0;
      }
      return 1;
    }
    const word = data[n * WORDS + 1];
    const kind = word & 15;
    if (!kind || s >= g[n] + Math.max(1, (word >> 12) & 15)) return 0;
    const q = laid(local, (word >> 4) & 63);
    if (kind === 1) return q[1] < 1 - Math.min(steps - 1, Math.floor(q[0] * steps)) / steps - 0.002 ? 2 : 0;
    if (kind === 2) return q[1] < (Math.min(turns - 1, Math.floor(Math.atan2(q[2], q[0]) / (Math.PI / 2 / turns))) + 1) / turns - 0.002 ? 2 : 0;
    return Math.max(...q) < small - 0.002 ? 3 : 0;
  };
}
export function solidTest(world: { P: number; data: Uint32Array; g: Int32Array }, steps: number, turns: number, small: number) {
  const kind = solidKind(world, steps, turns, small);
  return (p: V) => kind(p) > 0;
}
