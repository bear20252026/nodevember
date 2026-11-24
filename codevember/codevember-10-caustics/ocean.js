// A wind sea, the way oceanographers (and Tessendorf, for films) describe it:
// not a few chosen waves but a statistical spectrum — the energy the wind puts
// into each wavelength and heading (Phillips' spectrum: a peak at a length set
// by the wind's speed, little against it, nothing much shorter than a few
// centimetres) — given random amplitudes and phases (Gaussian), summed by an
// inverse FFT over a square that then repeats. Each point of the surface also
// moves sideways, towards the crests (the "choppy" displacement, as real water
// particles do in their orbits), which sharpens the crests and widens the
// troughs. The sea is still: this is one instant of it.
//
// Returns, on an N×N grid over L metres, the height h and the sideways shifts
// dx, dz of each point of the undisturbed grid.

// in-place radix-2 FFT of one line (inverse: e^{+i...}, no 1/N)
function fft1(re, im, n, off, stride, rev) {
  for (let i = 0; i < n; i++) {
    const j = rev[i];
    if (j > i) {
      const a = off + i * stride, b = off + j * stride;
      let t = re[a]; re[a] = re[b]; re[b] = t;
      t = im[a]; im[a] = im[b]; im[b] = t;
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2, step = (2 * Math.PI) / size;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(step * k), wi = Math.sin(step * k);
      for (let s = 0; s < n; s += size) {
        const a = off + (s + k) * stride, b = a + half * stride;
        const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr; im[b] = im[a] - xi;
        re[a] += xr; im[a] += xi;
      }
    }
  }
}
function ifft2(re, im, n) {
  const bits = Math.log2(n);
  const rev = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    rev[i] = r;
  }
  for (let y = 0; y < n; y++) fft1(re, im, n, y * n, 1, rev);
  for (let x = 0; x < n; x++) fft1(re, im, n, x, n, rev);
}

export function makeOcean({
  N = 512,
  L = 32,
  wind = 3.4, // m/s: the spectrum's peak wavelength grows with it (about 10 m here)
  heading = 0.2, // where the wind blows towards (radians, in x-z)
  spread = 2, // how tightly the waves follow the wind (|cos|^spread)
  small = 0.04, // m: shorter waves than this die out
  rms = 0.24, // m: the sea's height, as a standard deviation (crest to trough about 4×)
  chop = 1.3, // how far points move towards the crests (1: as far as the theory says)
  fold = 0.012, // the share of the surface allowed to fold over (into a cusp) at the crests
  seed = 7,
} = {}) {
  let r = seed >>> 0 || 1;
  const rand = () => {
    r = (r + 0x6d2b79f5) >>> 0;
    let t = r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

  const Lw = (wind * wind) / 9.81;
  const wx = Math.cos(heading), wz = Math.sin(heading);
  const idx = (n) => ((n % N) + N) % N;
  // h0(k): Gaussian amplitudes shaped by the spectrum
  const h0r = new Float64Array(N * N), h0i = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const ni = i < N / 2 ? i : i - N, nj = j < N / 2 ? j : j - N;
      const kx = (2 * Math.PI * ni) / L, kz = (2 * Math.PI * nj) / L;
      const k = Math.hypot(kx, kz);
      const g1 = gauss(), g2 = gauss();
      if (k === 0) continue;
      let c = (kx * wx + kz * wz) / k;
      // waves running against the wind are much weaker
      const against = c < 0 ? 0.15 : 1;
      c = Math.abs(c) ** spread;
      const P = (Math.exp(-1 / (k * Lw) ** 2) / k ** 4) * c * against * Math.exp(-((k * small) ** 2));
      const a = Math.sqrt(P / 2);
      h0r[j * N + i] = g1 * a;
      h0i[j * N + i] = g2 * a;
    }
  }
  // H(k) = h0(k) + conj(h0(-k)): a real sea; Dx, Dz = -i k/|k| H
  const Hr = new Float64Array(N * N), Hi = new Float64Array(N * N);
  const Xr = new Float64Array(N * N), Xi = new Float64Array(N * N);
  const Zr = new Float64Array(N * N), Zi = new Float64Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const ni = i < N / 2 ? i : i - N, nj = j < N / 2 ? j : j - N;
      const m = idx(-nj) * N + idx(-ni), o = j * N + i;
      const hr = h0r[o] + h0r[m], hi = h0i[o] - h0i[m];
      Hr[o] = hr; Hi[o] = hi;
      const k = Math.hypot(ni, nj);
      if (k === 0) continue;
      const ux = ni / k, uz = nj / k;
      // -i * u * (hr + i hi) = u * (hi - i hr)
      Xr[o] = ux * hi; Xi[o] = -ux * hr;
      Zr[o] = uz * hi; Zi[o] = -uz * hr;
    }
  }
  ifft2(Hr, Hi, N);
  ifft2(Xr, Xi, N);
  ifft2(Zr, Zi, N);

  // scaled to the asked height
  let sum = 0;
  for (let o = 0; o < N * N; o++) sum += Hr[o] * Hr[o];
  const s = rms / Math.sqrt(sum / (N * N));
  const h = new Float32Array(N * N), dx = new Float32Array(N * N), dz = new Float32Array(N * N);
  for (let o = 0; o < N * N; o++) {
    h[o] = Hr[o] * s;
    // (towards the crests: -i k/|k| H, as summed here, points away from them)
    dx[o] = -Xr[o] * s;
    dz[o] = -Zr[o] * s;
  }
  // as choppy as asked, but only the very tips of the crests may fold over
  // (where the Jacobian of the sideways shift turns negative): drawn from above,
  // highest first, a fold becomes a sharp cusp
  const cell = L / N;
  const folded = (lam) => {
    let n = 0;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const xp = j * N + ((i + 1) % N), xm = j * N + ((i + N - 1) % N);
        const zp = ((j + 1) % N) * N + i, zm = ((j + N - 1) % N) * N + i;
        const jxx = 1 + (lam * (dx[xp] - dx[xm])) / (2 * cell);
        const jzz = 1 + (lam * (dz[zp] - dz[zm])) / (2 * cell);
        const jxz = (lam * (dx[zp] - dx[zm])) / (2 * cell);
        const jzx = (lam * (dz[xp] - dz[xm])) / (2 * cell);
        if (jxx * jzz - jxz * jzx < 0) n++;
      }
    }
    return n / (N * N);
  };
  let lam = chop;
  for (let i = 0; i < 16 && folded(lam) > fold; i++) lam *= 0.92;
  for (let o = 0; o < N * N; o++) {
    dx[o] *= lam;
    dz[o] *= lam;
  }
  return { N, L, h, dx, dz, chop: lam };
}
