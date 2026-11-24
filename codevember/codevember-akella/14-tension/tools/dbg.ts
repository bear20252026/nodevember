import { P, Chain } from "../src/sim.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const c = new Chain();
const [a, b] = c.child();
console.log(
  "n",
  c.n,
  "child",
  a,
  b,
  "anchor",
  c.ax.toFixed(3),
  c.ay.toFixed(3),
  "stone",
  c.sx,
  c.sy.toFixed(3),
);
const show = () => {
  let worst = 0,
    wi = 0;
  for (let i = 0; i < c.n - 1; i++) {
    const d = Math.hypot(c.x[i + 1] - c.x[i], c.y[i + 1] - c.y[i]) / c.rest[i];
    if (Math.abs(d - 1) > Math.abs(worst)) ((worst = d - 1), (wi = i));
  }
  let vmax = 0,
    vi = 0;
  for (let i = 0; i < c.n; i++) {
    const v = Math.hypot(c.vx[i], c.vy[i]);
    if (v > vmax) ((vmax = v), (vi = i));
  }
  const m = (a + b) / 2;
  console.log(
    `f ${c.frame} stone ${c.sx.toFixed(3)},${c.sy.toFixed(3)} v ${c.svy.toFixed(3)} touch ${c.touch} mid ${c.y[m].toFixed(3)} strain ${worst.toFixed(4)}@${wi}(g${c.gen[wi]}) vmax ${vmax.toFixed(3)}@${vi}`,
  );
};
show();
for (let f = 0; f < Number(process.argv[2] ?? 12); f++) {
  c.step();
  if (f < 6 || f % Number(process.argv[3] ?? 10) === 0) show();
}
