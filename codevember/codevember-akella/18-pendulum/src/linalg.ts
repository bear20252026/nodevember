// Small dense linear algebra for mode shapes: row-major Float64Array n*n.

// lower triangular L with A = L L^T
export function cholesky(A: Float64Array, n: number) {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = A[i * n + j];
      for (let k = 0; k < j; k++) s -= L[i * n + k] * L[j * n + k];
      L[i * n + j] = i === j ? Math.sqrt(Math.max(s, 1e-300)) : s / L[j * n + j];
    }
  return L;
}

// eigenvalues and eigenvectors (columns of V) of a symmetric matrix, by cyclic Jacobi rotations
export function jacobiEigen(S: Float64Array, n: number, sweeps = 60) {
  const A = S.slice();
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) V[i * n + i] = 1;
  for (let sweep = 0; sweep < sweeps; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p * n + q] ** 2;
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++)
      for (let q = p + 1; q < n; q++) {
        const apq = A[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const theta = (A[q * n + q] - A[p * n + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k * n + p];
          const akq = A[k * n + q];
          A[k * n + p] = c * akp - s * akq;
          A[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p * n + k];
          const aqk = A[q * n + k];
          A[p * n + k] = c * apk - s * aqk;
          A[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k * n + p];
          const vkq = V[k * n + q];
          V[k * n + p] = c * vkp - s * vkq;
          V[k * n + q] = s * vkp + c * vkq;
        }
      }
  }
  const values = Array.from({ length: n }, (_, i) => A[i * n + i]);
  const order = values.map((_, i) => i).sort((a, b) => values[a] - values[b]);
  return {
    values: order.map((i) => values[i]),
    vectors: order.map((i) => Float64Array.from({ length: n }, (_, k) => V[k * n + i])),
  };
}

// K v = lambda M v, with M symmetric positive definite: vectors come back M-orthonormal
export function generalizedEigen(K: Float64Array, M: Float64Array, n: number) {
  const L = cholesky(M, n);
  // Linv by forward substitution
  const Li = new Float64Array(n * n);
  for (let c = 0; c < n; c++)
    for (let i = 0; i < n; i++) {
      let s = i === c ? 1 : 0;
      for (let k = 0; k < i; k++) s -= L[i * n + k] * Li[k * n + c];
      Li[i * n + c] = s / L[i * n + i];
    }
  // A = Li K Li^T
  const T = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Li[i * n + k] * K[k * n + j];
      T[i * n + j] = s;
    }
  const A = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += T[i * n + k] * Li[j * n + k];
      A[i * n + j] = s;
    }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) A[i * n + j] = A[j * n + i] = (A[i * n + j] + A[j * n + i]) / 2;
  const { values, vectors } = jacobiEigen(A, n);
  // v = Li^T y
  return {
    values,
    vectors: vectors.map((y) => Float64Array.from({ length: n }, (_, i) => {
      let s = 0;
      for (let k = 0; k < n; k++) s += Li[k * n + i] * y[k];
      return s;
    })),
  };
}

// All eigenpairs of a symmetric matrix by Householder tridiagonalisation and implicit QL (EISPACK tred2/tql2,
// as in JAMA). O(n^3); fine for n of a few hundred. Returns ascending values, vectors[j] the j-th eigenvector.
export function symmetricEigen(S: Float64Array, n: number) {
  // W[col * n + row] holds V[row][col], so the QL rotations run along contiguous memory
  const V = new Float64Array(n * n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) V[j * n + i] = S[i * n + j];
  const at = (r: number, c: number) => c * n + r;
  const d = new Float64Array(n);
  const e = new Float64Array(n);
  for (let j = 0; j < n; j++) d[j] = V[at(n - 1, j)];
  for (let i = n - 1; i > 0; i--) {
    let scale = 0;
    let h = 0;
    for (let k = 0; k < i; k++) scale += Math.abs(d[k]);
    if (scale === 0) {
      e[i] = d[i - 1];
      for (let j = 0; j < i; j++) {
        d[j] = V[at(i - 1, j)];
        V[at(i, j)] = 0;
        V[at(j, i)] = 0;
      }
    } else {
      for (let k = 0; k < i; k++) {
        d[k] /= scale;
        h += d[k] * d[k];
      }
      let f = d[i - 1];
      let g = Math.sqrt(h);
      if (f > 0) g = -g;
      e[i] = scale * g;
      h -= f * g;
      d[i - 1] = f - g;
      for (let j = 0; j < i; j++) e[j] = 0;
      for (let j = 0; j < i; j++) {
        f = d[j];
        V[at(j, i)] = f;
        g = e[j] + V[at(j, j)] * f;
        for (let k = j + 1; k <= i - 1; k++) {
          g += V[at(k, j)] * d[k];
          e[k] += V[at(k, j)] * f;
        }
        e[j] = g;
      }
      f = 0;
      for (let j = 0; j < i; j++) {
        e[j] /= h;
        f += e[j] * d[j];
      }
      const hh = f / (h + h);
      for (let j = 0; j < i; j++) e[j] -= hh * d[j];
      for (let j = 0; j < i; j++) {
        f = d[j];
        g = e[j];
        for (let k = j; k <= i - 1; k++) V[at(k, j)] -= f * e[k] + g * d[k];
        d[j] = V[at(i - 1, j)];
        V[at(i, j)] = 0;
      }
    }
    d[i] = h;
  }
  for (let i = 0; i < n - 1; i++) {
    V[at(n - 1, i)] = V[at(i, i)];
    V[at(i, i)] = 1;
    const h = d[i + 1];
    if (h !== 0) {
      for (let k = 0; k <= i; k++) d[k] = V[at(k, i + 1)] / h;
      for (let j = 0; j <= i; j++) {
        let g = 0;
        for (let k = 0; k <= i; k++) g += V[at(k, i + 1)] * V[at(k, j)];
        for (let k = 0; k <= i; k++) V[at(k, j)] -= g * d[k];
      }
    }
    for (let k = 0; k <= i; k++) V[at(k, i + 1)] = 0;
  }
  for (let j = 0; j < n; j++) {
    d[j] = V[at(n - 1, j)];
    V[at(n - 1, j)] = 0;
  }
  V[at(n - 1, n - 1)] = 1;
  e[0] = 0;
  // tql2
  for (let i = 1; i < n; i++) e[i - 1] = e[i];
  e[n - 1] = 0;
  let f = 0;
  let tst1 = 0;
  const eps = 2 ** -52;
  for (let l = 0; l < n; l++) {
    tst1 = Math.max(tst1, Math.abs(d[l]) + Math.abs(e[l]));
    let m = l;
    while (m < n) {
      if (Math.abs(e[m]) <= eps * tst1) break;
      m++;
    }
    if (m > l) {
      do {
        let g = d[l];
        let p = (d[l + 1] - g) / (2 * e[l]);
        let r = Math.hypot(p, 1);
        if (p < 0) r = -r;
        d[l] = e[l] / (p + r);
        d[l + 1] = e[l] * (p + r);
        const dl1 = d[l + 1];
        let h = g - d[l];
        for (let i = l + 2; i < n; i++) d[i] -= h;
        f += h;
        p = d[m];
        let c = 1;
        let c2 = c;
        let c3 = c;
        const el1 = e[l + 1];
        let s = 0;
        let s2 = 0;
        for (let i = m - 1; i >= l; i--) {
          c3 = c2;
          c2 = c;
          s2 = s;
          g = c * e[i];
          h = c * p;
          r = Math.hypot(p, e[i]);
          e[i + 1] = s * r;
          s = e[i] / r;
          c = p / r;
          p = c * d[i] - s * g;
          d[i + 1] = h + s * (c * g + s * d[i]);
          const ci = i * n;
          const cj = (i + 1) * n;
          for (let k = 0; k < n; k++) {
            h = V[cj + k];
            V[cj + k] = s * V[ci + k] + c * h;
            V[ci + k] = c * V[ci + k] - s * h;
          }
        }
        p = (-s * s2 * c3 * el1 * e[l]) / dl1;
        e[l] = s * p;
        d[l] = c * p;
      } while (Math.abs(e[l]) > eps * tst1);
    }
    d[l] += f;
    e[l] = 0;
  }
  const order = Array.from(d, (_, i) => i).sort((a, b) => d[a] - d[b]);
  return { values: order.map((i) => d[i]), vectors: order.map((i) => V.slice(i * n, i * n + n)) };
}
