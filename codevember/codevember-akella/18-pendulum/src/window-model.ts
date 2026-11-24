// Windows within windows: a pendulum whose bob is a square frame; inside it, from a pin in its top bar, hangs a
// pendulum a third the size whose bob is a frame, and so on. Every level is honest physics in a moving frame: a
// compound pendulum (square frame, its own moment of inertia) whose pin is carried by its parent's swing, so it
// feels the parent's acceleration. Each smaller window is taken as too light to push its parent (it is 1/27 of its
// mass), the one thing left out.
//
// The loop: one zoom (a factor 1/s) takes the eye from window k to window k+1. A pendulum 1/s smaller swings
// 1/sqrt(s) faster, so the clock slows by sqrt(s) over the zoom and the window being watched keeps its pace. Seven
// levels are simulated over one zoom from a fixed pin, and their starts are shot (Levenberg-Marquardt) so that at
// the end every level j+1 has the angle and (time-scaled) speed that level j had at the start, relative to its
// parent. The picture then comes back exactly; only the push from above changes at the seam, because the top of
// the chain is cut at a fixed pin.

export type Geo = { s: number; L: number; b: number; g: number; levels: number };
export const GEO: Geo = { s: 1 / 3, L: 0.75, b: 0.07, g: 9.81, levels: 7 };
// a level's own units: window side 1, rod L from the pin to the window's top edge, the child's pin in the middle of
// the top bar (L + b/2 from the pin), the window's centre at L + 1/2

export type Clip = {
  geo: Geo;
  lim: number; // largest swing of a window inside its parent before a corner touches
  dtau: number; // simulated seconds over one zoom (level 0's units)
  n: number; // samples over the zoom (n + 1 stored, the last is the seam)
  phi: Float64Array; // (n + 1) * levels: each level's angle relative to its parent (level 0: to the vertical)
  residual: number;
  start: number[];
};

const omega = (geo: Geo, j: number) => {
  // a square frame of side 1 about its centre: I = m / 3; about the pin, plus m d^2
  const d = geo.L + 0.5;
  return Math.sqrt((geo.g * d) / (d * d + 1 / 3)) / Math.pow(geo.s, j / 2);
};

// the largest relative swing before a child's corner meets its parent's frame (inside edges)
export function clearance(geo: Geo) {
  const { s, L, b } = geo;
  const corners = [
    [-s / 2, -s * L],
    [s / 2, -s * L],
    [-s / 2, -s * (L + 1)],
    [s / 2, -s * (L + 1)],
  ];
  const fits = (a: number) =>
    corners.every(([x, y]) => {
      const X = x * Math.cos(a) - y * Math.sin(a);
      const Y = x * Math.sin(a) + y * Math.cos(a) - b / 2;
      return Math.abs(X) < 0.5 - b && Y < -b && Y > -1 + b;
    });
  let lo = 0, hi = 1.5;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (fits(m) && fits(-m)) lo = m;
    else hi = m;
  }
  return lo;
}

// the clock over the zoom: display phase t in [0, 1] to simulated time, slowing by sqrt(s)
export const warp = (geo: Geo, dtau: number, t: number) => {
  const r = Math.sqrt(geo.s);
  return (dtau * (1 - Math.pow(r, t))) / (1 - r);
};

// z = relative angles (levels) then relative speeds (levels), at tau = 0
function simulate(geo: Geo, z: number[], dtau: number, n: number, lim: number, out?: Float64Array) {
  const N = geo.levels;
  const { s, L, b, g } = geo;
  const a = new Float64Array(N), w = new Float64Array(N); // absolute angles, speeds
  let sum = 0, wsum = 0;
  for (let j = 0; j < N; j++) {
    sum += z[j];
    wsum += z[N + j];
    a[j] = sum;
    w[j] = wsum;
  }
  const scale = Array.from({ length: N }, (_, j) => Math.pow(s, j));
  const kap = scale.map((c) => {
    const d = c * (L + 0.5);
    return d / (d * d + (c * c) / 3);
  });
  const pin = scale.map((c) => c * (L + b / 2));
  const acc = (a: Float64Array, w: Float64Array, out: Float64Array) => {
    let qx = 0, qy = 0; // the pin's acceleration; level 0 hangs from a fixed pin
    for (let j = 0; j < N; j++) {
      const sn = Math.sin(a[j]), cs = Math.cos(a[j]);
      const al = -kap[j] * (g * sn + qx * cs + qy * sn);
      out[j] = al;
      // the child's pin rides on this level's rod
      qx += pin[j] * (al * cs - w[j] * w[j] * sn);
      qy += pin[j] * (al * sn + w[j] * w[j] * cs);
    }
  };
  const k1a = new Float64Array(N), k1w = new Float64Array(N), k2a = new Float64Array(N), k2w = new Float64Array(N);
  const k3a = new Float64Array(N), k3w = new Float64Array(N), k4a = new Float64Array(N), k4w = new Float64Array(N);
  const ta = new Float64Array(N), tw = new Float64Array(N);
  const step = (h: number) => {
    acc(a, w, k1w);
    k1a.set(w);
    for (let j = 0; j < N; j++) (ta[j] = a[j] + (h / 2) * k1a[j]), (tw[j] = w[j] + (h / 2) * k1w[j]);
    acc(ta, tw, k2w);
    k2a.set(tw);
    for (let j = 0; j < N; j++) (ta[j] = a[j] + (h / 2) * k2a[j]), (tw[j] = w[j] + (h / 2) * k2w[j]);
    acc(ta, tw, k3w);
    k3a.set(tw);
    for (let j = 0; j < N; j++) (ta[j] = a[j] + h * k3a[j]), (tw[j] = w[j] + h * k3w[j]);
    acc(ta, tw, k4w);
    k4a.set(tw);
    for (let j = 0; j < N; j++) {
      a[j] += (h / 6) * (k1a[j] + 2 * k2a[j] + 2 * k3a[j] + k4a[j]);
      w[j] += (h / 6) * (k1w[j] + 2 * k2w[j] + 2 * k3w[j] + k4w[j]);
    }
  };
  const hmax = (2 * Math.PI) / omega(geo, N - 1) / 60;
  const over = new Float64Array(N); // time spent past the clearance, squared
  const record = (i: number) => {
    for (let j = 0; j < N; j++) {
      const rel = a[j] - (j ? a[j - 1] : 0);
      if (out) out[i * N + j] = rel;
    }
  };
  record(0);
  let tau = 0;
  for (let i = 1; i <= n; i++) {
    const next = warp(geo, dtau, i / n);
    const m = Math.max(1, Math.ceil((next - tau) / hmax));
    const h = (next - tau) / m;
    for (let k = 0; k < m; k++) {
      step(h);
      for (let j = 0; j < N; j++) {
        const rel = a[j] - (j ? a[j - 1] : 0);
        const e = Math.abs(rel) - lim;
        if (e > 0) over[j] += e * e * h * omega(geo, j);
      }
    }
    tau = next;
    record(i);
  }
  const rel = Array.from({ length: N }, (_, j) => a[j] - (j ? a[j - 1] : 0));
  const relw = Array.from({ length: N }, (_, j) => w[j] - (j ? w[j - 1] : 0));
  return { rel, relw, over };
}

function residual(geo: Geo, z: number[], dtau: number, n: number, lim: number) {
  const N = geo.levels;
  const { rel, relw, over } = simulate(geo, z, dtau, n, lim);
  const r: number[] = [];
  const rs = Math.sqrt(geo.s);
  for (let j = 0; j + 1 < N; j++) {
    r.push(rel[j + 1] - z[j]);
    r.push((rs * relw[j + 1] - z[N + j]) / omega(geo, j));
  }
  for (let j = 0; j < N; j++) r.push(3 * Math.sqrt(over[j]));
  return r;
}

function solveLinear(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

export function solveClip(o: { geo?: Geo; swings?: number; amp?: number; phase?: number; n?: number; log?: (s: string) => void } = {}): Clip {
  const geo = o.geo ?? GEO;
  const N = geo.levels;
  const n = o.n ?? 1200;
  const lim = clearance(geo) * 0.9;
  // over one zoom the watched window (level 1) swings about `swings` times
  const dtau = ((o.swings ?? 1.6) * 2 * Math.PI) / omega(geo, 1);
  // seed: each level on its own, its phase set so it ends where its parent began
  const amp = (o.amp ?? 0.55) * lim;
  const psi = [o.phase ?? 0.6];
  for (let j = 1; j < N; j++) psi.push(psi[j - 1] - omega(geo, j) * dtau);
  let z = [...psi.map((p) => amp * Math.cos(p)), ...psi.map((p, j) => -amp * omega(geo, j) * Math.sin(p))];
  let F = residual(geo, z, dtau, n, lim);
  const norm = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  let f = norm(F);
  let mu = 1e-2;
  for (let it = 0; it < 60 && f > 1e-11; it++) {
    const J: number[][] = [];
    for (let k = 0; k < z.length; k++) {
      const zp = z.slice();
      const e = 1e-7 * Math.max(1, Math.abs(z[k]));
      zp[k] += e;
      J.push(residual(geo, zp, dtau, n, lim).map((v, i) => (v - F[i]) / e));
    }
    const A = J.map((ca) => J.map((cb) => ca.reduce((s, v, i) => s + v * cb[i], 0)));
    const gvec = J.map((c) => -c.reduce((s, v, i) => s + v * F[i], 0));
    let improved = false;
    for (let tries = 0; tries < 12 && !improved; tries++) {
      const d = solveLinear(A.map((row, a) => row.map((v, b) => v + (a === b ? mu * (1 + A[a][a]) : 0))), gvec);
      const zn = z.map((v, i) => v + d[i]);
      const Fn = residual(geo, zn, dtau, n, lim);
      const fn = norm(Fn);
      if (fn < f) {
        z = zn;
        F = Fn;
        f = fn;
        mu = Math.max(mu / 4, 1e-12);
        improved = true;
      } else mu *= 6;
    }
    o.log?.(`it ${it}: residual ${f.toExponential(2)}`);
    if (!improved) break;
  }
  // the samples, on the same steps the shooting used
  const phi = new Float64Array((n + 1) * N);
  simulate(geo, z, dtau, n, lim, phi);
  return { geo, lim, dtau, n, phi, residual: f, start: z };
}
