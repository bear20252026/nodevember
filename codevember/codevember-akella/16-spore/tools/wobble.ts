// node --experimental-strip-types tools/wobble.ts [periods=5] [out.svg]: how much the stems swing. Runs the pile
// (SET, FREE, LEARN, GUIDE as in bake.ts), and for every life that ends takes the track of its top, less its own
// slow drift (a one second mean): what is left is the swing. Prints how big and how fast it is, and draws a few.
import fs from "node:fs";
import { P, Pile } from "../src/sim.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const periods = Number(process.argv[2] ?? 5);
const out = process.argv[3];
const FREE = Number(process.env.FREE ?? 3);
const LEARN = Number(process.env.LEARN ?? 3);
const GUIDE = Number(process.env.GUIDE ?? 0);
const R = 0.033;
const pile = new Pile();
const NN = pile.NN;
const WIN = Math.round(P.FPS / 2); // half the mean's width, in frames

type Life = { key: number; gen: number; L: number; swing: Float32Array; rms: number; peak: number; hz: number };
const lives: Life[] = [];
const mean: (Float64Array | null)[] = Array(P.NK).fill(null);
const count = new Int32Array(P.NK);
const off: { rms: number; max: number; n: number }[] = [];
const last: (Float32Array | null)[] = Array(P.NK).fill(null);
pile.done = (key, gen, rec, frames) => {
  const prev = last[key];
  if (prev) {
    let sum = 0,
      max = 0;
    for (let i = 0; i < rec.length; i += 3) {
      const d = Math.hypot(rec[i] - prev[i], rec[i + 1] - prev[i + 1], rec[i + 2] - prev[i + 2]);
      sum += d * d;
      if (d > max) max = d;
    }
    const o = (off[gen] ??= { rms: 0, max: 0, n: 0 });
    o.rms += sum / (rec.length / 3);
    o.max = Math.max(o.max, max);
    o.n++;
  }
  last[key] = rec;
  if (gen >= FREE && gen < FREE + LEARN && GUIDE > 0) {
    const m = (mean[key] ??= new Float64Array(rec.length));
    for (let i = 0; i < rec.length; i++) m[i] += rec[i];
    count[key]++;
    if (gen === FREE + LEARN - 1) {
      const t = new Float32Array(rec.length);
      for (let i = 0; i < rec.length; i++) t[i] = m[i] / count[key];
      pile.target[key] = t;
    }
  }
  // the top, sideways
  const tip = (f: number, d: number) => rec[(f * NN + NN - 1) * 3 + d];
  const swing = new Float32Array(frames * 2);
  let sum = 0,
    peak = 0,
    cross = 0,
    n = 0;
  for (let d = 0; d < 2; d++) {
    let was = 0;
    for (let f = WIN; f < frames - WIN; f++) {
      let m = 0;
      for (let j = -WIN; j <= WIN; j++) m += tip(f + j, d * 2);
      const s = tip(f, d * 2) - m / (2 * WIN + 1);
      swing[f * 2 + d] = s;
      sum += s * s;
      n++;
      if (Math.abs(s) > peak) peak = Math.abs(s);
      if (Math.abs(s) > 0.05 * R) {
        const sg = Math.sign(s);
        if (was && sg !== was) cross++;
        was = sg;
      }
    }
  }
  const secs = (frames - 2 * WIN) / P.FPS;
  lives.push({ key, gen, L: pile.keys[key].L, swing, rms: Math.sqrt(sum / (n || 1)) / R, peak: peak / R, hz: cross / 4 / secs });
};

const TF = P.T * P.FPS;
const t0 = performance.now();
for (let p = 0; p < periods; p++) {
  if (GUIDE > 0 && pile.target.every((t) => t)) pile.guide = GUIDE;
  for (let f = 0; f < TF; f++) pile.step();
  console.log(`period ${p}: guide ${pile.guide}, ${((performance.now() - t0) / 1000).toFixed(0)} s`);
}
const pct = (a: number[], q: number) => [...a].sort((x, y) => x - y)[Math.floor(q * (a.length - 1))] ?? NaN;
const gens = [...new Set(lives.map((l) => l.gen))].sort((a, b) => a - b);
for (const g of gens) {
  const ls = lives.filter((l) => l.gen === g);
  const o = off[g];
  console.log(
    `gen ${g} (${ls.length}): swing rms ${pct(ls.map((l) => l.rms), 0.5).toFixed(3)} r (9 in 10 under ${pct(ls.map((l) => l.rms), 0.9).toFixed(3)}), peak ${pct(ls.map((l) => l.peak), 0.5).toFixed(2)} r (${pct(ls.map((l) => l.peak), 0.9).toFixed(2)}), turns ${pct(ls.map((l) => l.hz), 0.5).toFixed(2)} a second` +
      (o ? `; from the one before: rms ${(Math.sqrt(o.rms / o.n) / R).toFixed(3)} r, worst ${(o.max / R).toFixed(2)} r` : ""),
  );
}
if (out) {
  const g = [...gens].reverse().find((g) => lives.filter((l) => l.gen === g).length >= 40) ?? gens[gens.length - 1];
  const ls = lives.filter((l) => l.gen === g).sort((a, b) => a.L - b.L);
  const pick = Array.from({ length: 10 }, (_, i) => ls[Math.floor(((i + 0.5) / 10) * ls.length)]).filter(Boolean);
  const W = 1600,
    ROW = 110,
    SEC = 40;
  let svg = "";
  pick.forEach((l, row) => {
    const y0 = ROW * (row + 0.5);
    svg += `<line x1="0" x2="${W}" y1="${y0}" y2="${y0}" stroke="#333"/>`;
    for (const r of [-1, 1]) svg += `<line x1="0" x2="${W}" y1="${y0 + r * 40}" y2="${y0 + r * 40}" stroke="#222" stroke-dasharray="4 6"/>`;
    for (let d = 0; d < 2; d++) {
      let path = "";
      for (let f = 0; f < l.swing.length / 2; f++) path += `${f ? "L" : "M"}${((f / P.FPS) * SEC).toFixed(1)} ${(y0 - (l.swing[f * 2 + d] / R) * 40).toFixed(1)}`;
      svg += `<path d="${path}" fill="none" stroke="${d ? "#6cf" : "#f96"}" stroke-width="1.3"/>`;
    }
    svg += `<text x="6" y="${y0 - 42}" fill="#aaa" font-size="13" font-family="monospace">key ${l.key}, length ${l.L.toFixed(1)}, rms ${l.rms.toFixed(2)} r, ${l.hz.toFixed(1)} Hz (dashes: one stem radius)</text>`;
  });
  for (let s = 0; s <= W / SEC; s += 5) svg += `<text x="${s * SEC + 2}" y="${ROW * pick.length + 14}" fill="#777" font-size="12" font-family="monospace">${s}s</text>`;
  fs.writeFileSync(out, `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${ROW * pick.length + 20}" style="background:#0b0d12">${svg}</svg>`);
}
