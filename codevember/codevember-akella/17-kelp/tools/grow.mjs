// node --experimental-strip-types tools/grow.mjs ['{"step":0.02}']: grows the plant outside the browser and says what came of it.
// (needs node --experimental-strip-types, node 22.6 or later)
import fs from "node:fs";
const { grow } = await import("../src/grow.ts");
const shape = JSON.parse(fs.readFileSync(new URL(`../public/${process.env.SHAPE ?? "suzanne"}.json`, import.meta.url), "utf8"));
const t0 = performance.now();
const g = grow(shape, JSON.parse(process.argv[2] ?? "{}"));
const ms = performance.now() - t0;
let out = 0;
for (let i = g.fixed; i < g.count; i++) if (!g.isInside(g.pos[i * 3], g.pos[i * 3 + 1], g.pos[i * 3 + 2])) out++;
let thick = 0;
for (let i = 0; i < g.count; i++) thick = Math.max(thick, g.radius[i]);
const hist = new Array(10).fill(0);
for (let i = 0; i < g.count; i++) hist[Math.min(9, Math.floor(g.born[i] * 10))]++;
console.log(`${ms.toFixed(0)} ms: ${g.count} nodes (${g.fixed} of them stalk and holdfast), ${g.tips} tips, ${g.left} points never reached`);
console.log(`outside the shape ${out} (${((out / (g.count - g.fixed)) * 100).toFixed(1)}%), thickest ${thick.toFixed(4)}, longest way ${g.longest.toFixed(2)}`);
console.log(`fronds ${g.bladeAt.length} under the skin, ${g.innerAt.length} inside; born by tenths: ${hist.join(" ")}`);
