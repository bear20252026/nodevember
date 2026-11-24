// node --experimental-strip-types tools/bake.ts: times the bake and prints its sizes
import { bake } from "../src/bake.ts";
const b = bake();
console.log(b.ms, "flakes", b.flakes, "verts", b.position.length / 3, "tris", b.index.length / 3);
let lo = Infinity, hi = -Infinity;
for (let i = 0; i < b.cut.length; i++) { lo = Math.min(lo, b.cut[i]); hi = Math.max(hi, b.cut[i]); }
console.log("cut", lo, hi);
