function U(t) {
  let o = t >>> 0 || 1;
  return () => (o = (o * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function B(t, o) {
  const x = new Float32Array(65536).map(() => o()),
    m = (c, g) => x[(g & 255) * 256 + (c & 255)];
  return (c, g) => {
    const i = Math.floor(c),
      l = Math.floor(g),
      y = c - i,
      n = g - l,
      f = y * y * (3 - 2 * y),
      r = n * n * (3 - 2 * n),
      a = m(i, l),
      s = m(i + 1, l),
      u = m(i, l + 1),
      d = m(i + 1, l + 1);
    return a + (s - a) * f + (u - a) * r + (a - s - u + d) * f * r;
  };
}
function G(t, o, { ridge: e = 0.55, scale: x = 3.2 } = {}) {
  const m = B(t, o),
    c = new Float32Array(t * t),
    g = o() * 100,
    i = o() * 100;
  for (let l = 0; l < t; l++)
    for (let y = 0; y < t; y++) {
      const n = y / (t - 1),
        f = l / (t - 1);
      let r = x,
        a = 0.5,
        s = 0;
      for (let M = 0; M < 6; M++) {
        const b = m(n * r + g, f * r + i);
        ((s += a * ((1 - e) * b + e * (1 - Math.abs(b * 2 - 1)))),
          (r *= 2.03),
          (a *= 0.5));
      }
      const u = n - 0.5,
        d = f - 0.5,
        h = 1 - Math.min(1, Math.sqrt(u * u + d * d) * 1.25),
        v = Math.min(1, Math.min(n, f, 1 - n, 1 - f) / 0.18);
      c[l * t + y] =
        (s * (0.35 + 0.65 * h) + h * 0.25) * v * v * (3 - 2 * v) + 0.02;
    }
  return c;
}
const W = 6,
  Y = 0.3,
  S = (t) => (t * W) % 1 < Y;
function I(t, o) {
  const e = B(t, o),
    x = new Float32Array(t * t),
    m = Array.from({ length: 6 }, () => o() * 100);
  for (let c = 0; c < t; c++)
    for (let g = 0; g < t; g++) {
      const i = g / (t - 1),
        l = c / (t - 1),
        y = (h, v, M) =>
          e(i * M + h, l * M + v) * 0.6 +
          e(i * M * 2.1 + h, l * M * 2.1 + v) * 0.3 +
          e(i * M * 4.3 + h, l * M * 4.3 + v) * 0.1,
        n = Math.abs(y(m[0], m[1], 2.2) - 0.5),
        f = Math.abs(y(m[2], m[3], 3.4) - 0.5),
        r = Math.min(1, n / 0.08, f / 0.05),
        a = 0.52 + 0.03 * y(m[4], m[5], 1.3) - 0.3 * (1 - r) ** 1.5,
        s = Math.hypot(i - 0.5, l - 0.5),
        u = y(m[1], m[4], 2.6) + 0.5 * (0.5 - s) - 0.02,
        d =
          Math.min(1, Math.max(0, (u - 0.5) / 0.03)) *
          Math.min(1, Math.min(i, l, 1 - i, 1 - l) / 0.12);
      x[c * t + g] = a * d + (0.03 + 0.02 * y(m[5], m[0], 4)) * (1 - d);
    }
  return x;
}
const T = {
  inertia: 0.05,
  capacity: 4,
  minCapacity: 0.01,
  deposit: 0.3,
  erode: 0.3,
  evaporate: 0.01,
  gravity: 4,
  life: 30,
  radius: 3,
  hardness: 0.9,
  talus: 0.01,
};
function _(t, o, e = T) {
  const x = new Float32Array(t * t);
  let m,
    c = -1;
  function g() {
    c = e.radius;
    const n = [],
      f = [];
    let r = 0;
    for (let a = -c; a <= c; a++)
      for (let s = -c; s <= c; s++) {
        const u = Math.sqrt(s * s + a * a);
        u < c && (n.push(s, a), f.push(1 - u / c), (r += 1 - u / c));
      }
    m = { off: n, w: f.map((a) => a / r) };
  }
  function i(n, f) {
    const r = n | 0,
      a = f | 0,
      s = n - r,
      u = f - a,
      d = a * t + r,
      h = o[d],
      v = o[d + 1],
      M = o[d + t],
      b = o[d + t + 1];
    return {
      gx: (v - h) * (1 - u) + (b - M) * u,
      gy: (M - h) * (1 - s) + (b - v) * s,
      z: h * (1 - s) * (1 - u) + v * s * (1 - u) + M * (1 - s) * u + b * s * u,
    };
  }
  function l(n, f) {
    c !== e.radius && g();
    let r = 0,
      a = 0,
      s = 1,
      u = 1,
      d = 0;
    for (let h = 0; h < e.life; h++) {
      const v = n | 0,
        M = f | 0,
        b = n - v,
        P = f - M,
        A = M * t + v,
        j = i(n, f);
      ((r = r * e.inertia - j.gx * (1 - e.inertia)),
        (a = a * e.inertia - j.gy * (1 - e.inertia)));
      const q = Math.hypot(r, a);
      if (
        q < 1e-9 ||
        ((r /= q),
        (a /= q),
        (n += r),
        (f += a),
        n < 1 || f < 1 || n >= t - 2 || f >= t - 2)
      )
        break;
      const w = i(n, f).z - j.z,
        z = Math.max(-w * s * u * e.capacity, e.minCapacity);
      if (d > z || w > 0) {
        const k = w > 0 ? Math.min(w, d) : (d - z) * e.deposit;
        ((d -= k),
          (o[A] += k * (1 - b) * (1 - P)),
          (o[A + 1] += k * b * (1 - P)),
          (o[A + t] += k * (1 - b) * P),
          (o[A + t + 1] += k * b * P),
          (x[A] -= k));
      } else {
        const k = Math.min((z - d) * e.erode, -w),
          { off: R, w: C } = m;
        for (let F = 0; F < C.length; F++) {
          const D = v + R[2 * F],
            E = M + R[2 * F + 1];
          if (D < 0 || E < 0 || D >= t || E >= t) continue;
          const L = E * t + D,
            H = Math.min(o[L], k * C[F] * (S(o[L]) ? 1 - e.hardness : 1));
          ((o[L] -= H), (x[L] += H));
        }
        d += k;
      }
      ((s = Math.sqrt(Math.max(0, s * s + w * e.gravity))),
        (u *= 1 - e.evaporate));
    }
  }
  function y() {
    for (let n = 1; n < t - 1; n++)
      for (let f = 1; f < t - 1; f++) {
        const r = n * t + f,
          a = o[r],
          s = S(a) ? e.talus * 4 : e.talus;
        for (const u of [r + 1, r - 1, r + t, r - t]) {
          const d = a - o[u];
          if (d > s) {
            const h = (d - s) * 0.25;
            ((o[r] -= h), (o[u] += h), (x[r] += h * 0.3));
          }
        }
      }
  }
  return { wear: x, drop: l, slump: y, params: e };
}
if (typeof process < "u" && process.argv?.[1]?.endsWith("erode.js")) {
  const o = new Float32Array(4096).map(
      (i, l) => 1 - Math.hypot((l % 64) / 64 - 0.5, ((l / 64) | 0) / 64 - 0.5),
    ),
    e = o.reduce((i, l) => i + l),
    x = _(64, o, { ...T }),
    m = U(7);
  for (let i = 0; i < 5e3; i++) x.drop(1 + m() * 61, 1 + m() * 61);
  const c = o.reduce((i, l) => i + l),
    g = x.wear.some((i) => i > 0);
  (console.assert(
    g && c <= e + 0.001 && c > e * 0.9,
    "erosion self-check failed",
    e,
    c,
  ),
    console.log("erode ok", e.toFixed(2), c.toFixed(2)));
}
export { T as D, Y as H, W as L, G as a, _ as c, I as m, U as r };
