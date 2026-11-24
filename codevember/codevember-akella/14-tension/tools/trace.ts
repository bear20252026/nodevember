// node --experimental-strip-types tools/trace.ts [periods=3] [every=12]: what the stone and the rope under it do, as the picture sees it
import { P, Chain } from "../src/sim.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const c = new Chain();
const TF = c.TF;
const periods = Number(process.argv[2] ?? 3),
  every = Number(process.argv[3] ?? 12);
const from = Number(process.env.FROM ?? 0);
for (let n = 0; n < periods; n++)
  for (let f = 0; f < TF; f++) {
    c.step();
    if (n < from || f % every) continue;
    const z = c.zoom((f + 1) / TF);
    const [a, b] = c.child();
    let lo = 1e9;
    for (let i = a; i <= b; i++) lo = Math.min(lo, c.y[i]);
    let pk = 0;
    for (let i = a; i < b; i++) pk = Math.max(pk, c.pull[i]);
    console.log(
      `${n}.${String(f).padStart(3, "0")} mode ${c.mode} touch ${String(c.touch).padStart(4)} stone y ${(c.sy * z).toFixed(3)} vy ${(c.svy * z).toFixed(3)} need ${(c.need * z).toFixed(2)} trim ${c.trim.toFixed(2)} | rope low ${(lo * z).toFixed(3)} ends ${(c.x[a] * z).toFixed(3)},${(c.y[a] * z).toFixed(3)} ${(c.x[b] * z).toFixed(3)},${(c.y[b] * z).toFixed(3)} pull ${pk.toFixed(1)} | j1 ${(c.x[a - 20] * z).toFixed(2)},${(c.y[a - 20] * z).toFixed(2)}`,
    );
  }
