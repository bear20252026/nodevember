import { bake } from "../src/bake.ts";
const b = bake();
const f = b.field;
const ch = [0, 0, 0, 0], bad = [0, 0, 0, 0];
const hist: Record<string, number> = {};
for (let i = 0; i < f.length; i++) {
  const e = (f[i] >> 10) & 31;
  if (e === 31) bad[i % 4]++;
  if (i % 4 === 0) { const k = ((f[i] >> 10) & 31) + (f[i] & 0x8000 ? "-" : "+"); hist[k] = (hist[k] ?? 0) + 1; }
}
console.log("inf/nan per channel", bad, hist);
