// The backdrop: a blue gradient, the sun, thin cloud streaming past, and the river far below.
// The cloud is noise that repeats every PERIOD cells along the line of flight, so sliding it a whole number
// of periods per loop brings it back exactly.
import * as TSL from "three/tsl";
import type { Light, N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { clamp, dot, float, floor, Fn, fract, max, mix, mod, pow, sin, smoothstep, vec2, vec3 } = T;

const PERIOD = 8;

const hash2 = (p: N) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
// value noise whose x wraps every `period` cells
const vnoise = Fn(([p, period]: [N, N]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const wrap = (c: N) => vec2(mod(c.x, period), c.y);
  const a = hash2(wrap(i));
  const b = hash2(wrap(i.add(vec2(1, 0))));
  const c = hash2(wrap(i.add(vec2(0, 1))));
  const d = hash2(wrap(i.add(vec2(1, 1))));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});
const fbm = (p: N, octaves: number) => {
  let sum: N = float(0);
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum = sum.add(vnoise(p.mul(freq).add(vec2(0, o * 17.3)), float(PERIOD * freq)).mul(amp));
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
};

export interface SkyLook {
  zenith: N;
  horizon: N;
  haze: N;
  river: N;
  cloud: N; // how much of it
  travel: N; // 0..1 round the loop, times a whole number of periods
}

export const skyColor = (L: Light, k: SkyLook, d: N) =>
  Fn(() => {
    const up = clamp(d.y, -1, 1);
    const above = mix(k.horizon, k.zenith, pow(smoothstep(0.0, 0.85, up), 0.75));
    const s = max(dot(d, L.sunDir), 0);

    // cirrus on a sheet high above: stretched along the wind, thinning towards the horizon
    const sheet = d.xz.div(max(up, 0.0).add(0.12));
    const q = vec2(sheet.x.mul(0.7).add(k.travel), sheet.y.mul(1.9).add(3.7));
    const warp = fbm(q.mul(0.5).add(vec2(0, 9.1)), 2).sub(0.5);
    const n = fbm(q.add(vec2(0, warp.mul(1.6))), 5);
    // most of it sits low in the sky; overhead it thins so the wings stay against blue
    const wisp = smoothstep(float(0.62).sub(k.cloud.mul(0.3)), 0.86, n)
      .mul(smoothstep(0.02, 0.25, up))
      .mul(mix(1, 0.3, smoothstep(0.35, 0.8, up)));
    const lit = mix(vec3(0.82, 0.88, 0.97), vec3(1.0, 0.98, 0.94), pow(s, 3)).mul(mix(0.85, 1.15, n));
    const air = mix(above, lit, wisp.mul(0.6));

    // below the horizon: haze over the far bank, then the river, its surface sliding by
    const water = d.xz.div(max(up.negate(), 0.0).add(0.2));
    const ripple = fbm(vec2(water.x.mul(0.6).add(k.travel.mul(2)), water.y.mul(1.6)), 3);
    const riverCol = k.river.mul(mix(0.82, 1.2, ripple));
    const below = mix(k.haze, riverCol, smoothstep(-0.02, -0.4, up));
    const base = mix(below, mix(k.haze, air, smoothstep(0.0, 0.14, up)), smoothstep(-0.03, 0.02, up));

    const halo = pow(s, 10).mul(0.1).add(pow(s, 180).mul(0.3)).add(pow(s, 5000).mul(10));
    return base.add(L.sunColor.mul(halo));
  })();

export const CLOUD_PERIOD = PERIOD;
