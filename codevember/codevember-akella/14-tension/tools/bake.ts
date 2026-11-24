// node --experimental-strip-types tools/bake.ts [settle]: how long a bake takes and how exactly it repeats
import { bake, P } from "../src/bake.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const b = bake(Number(process.argv[2] ?? 12));
const missing = [...b.tx].filter((v) => Number.isNaN(v)).length;
console.log(
  `baked ${b.frames} frames of ${b.n} nodes and ${b.slots.length} tails in ${b.ms.toFixed(0)} ms, off ${b.off.toExponential(2)}, missing tail values ${missing}`,
);
