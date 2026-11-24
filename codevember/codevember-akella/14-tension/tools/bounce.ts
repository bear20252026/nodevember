import { bounce } from "../src/bounce.ts";
const o = {
  T: 2.4,
  G: 1.5,
  r1: 0.1,
  k1: 60,
  k2: 20,
  dt: 1 / 1200,
  ...JSON.parse(process.env.SET ?? "{}"),
};
const b = bounce(o);
console.log(o, {
  v0: b.v0,
  top: b.top,
  low: b.low,
  off: b.off,
  on: b.on,
  n: b.y.length,
});
for (let i = 0; i < b.y.length; i += 120)
  console.log((i * b.dt).toFixed(2), b.y[i].toFixed(3), b.v[i].toFixed(3));
