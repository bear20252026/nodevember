// The stone's path, in the picture: a bounce that repeats exactly once a period. Time 0 is a tear:
// the stone is pressing the rope down through y = 0 when the rope gives way and its softer core takes
// over. The core catches it (a spring resting at r2) and throws it up; it flies; it lands on the next
// rope (a stiffer spring resting at r1) and presses it down to y = 0 again just as the period ends.
// For this to repeat the tear must neither add nor take energy: k1 r1² = k2 r2². What is left, the
// speed at the tear, is found so that all of it takes exactly one period.

export type Bounce = {
  y: Float64Array;
  v: Float64Array;
  dt: number;
  v0: number;
  top: number;
  low: number;
  off: number;
  on: number;
};

export function bounce(o: {
  T: number;
  G: number;
  r1: number;
  k1: number;
  k2: number;
  dt: number;
}): Bounce {
  const { T, G, r1, k1, k2, dt } = o;
  const r2 = r1 * Math.sqrt(k1 / k2);
  // leapfrog through one cycle from the tear; returns the time it took and, if asked, the path
  const fly = (v0: number, out?: { y: number[]; v: number[] }) => {
    let y = 0,
      v = -v0,
      t = 0,
      stage = 0, // 0 on the core, 1 flying, 2 on the next rope
      off = 0,
      on = 0;
    const acc = (y: number) =>
      -G +
      (stage === 0
        ? k2 * Math.max(0, r2 - y)
        : stage === 2
          ? k1 * Math.max(0, r1 - y)
          : 0);
    let a = acc(y);
    while (t < 4 * T) {
      if (out) (out.y.push(y), out.v.push(v));
      const yp = y;
      v += a * dt * 0.5;
      y += v * dt;
      if (stage === 0 && y > r2 && v > 0) ((stage = 1), (off = t));
      if (stage === 1 && y < r1 && v < 0) ((stage = 2), (on = t));
      a = acc(y);
      v += a * dt * 0.5;
      t += dt;
      if (stage === 2 && yp > 0 && y <= 0)
        return { t: t - (y / (y - yp)) * dt, off, on };
    }
    return { t: Infinity, off, on };
  };
  // the faster it hits, the longer the flight: find the speed that takes one period
  let lo = 0.01,
    hi = 20;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (fly(mid).t < T) lo = mid;
    else hi = mid;
  }
  const v0 = (lo + hi) / 2;
  const path = { y: [] as number[], v: [] as number[] };
  const r = fly(v0, path);
  const n = Math.round(T / dt);
  const y = new Float64Array(n + 1),
    v = new Float64Array(n + 1);
  for (let i = 0; i <= n; i++) {
    y[i] = path.y[Math.min(i, path.y.length - 1)];
    v[i] = path.v[Math.min(i, path.v.length - 1)];
  }
  // the last few samples are bent onto the first ones so that it closes to the bit
  y[n] = 0;
  v[n] = -v0;
  let top = 0,
    low = 0;
  for (const q of y) ((top = Math.max(top, q)), (low = Math.min(low, q)));
  return { y, v, dt, v0, top, low, off: r.off, on: r.on };
}
