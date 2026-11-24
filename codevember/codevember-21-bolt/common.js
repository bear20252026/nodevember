// Shared bits: the seeded random, a 2D noise, the diorama's outline (a convex pentagon or
// hexagon, never regular, a new one each seed) and the height of its ground.

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// value noise, 2D, smooth, from a hashed lattice
function hash2(x, y) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
export function fbm2(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += amp * (noise2(x * f + i * 17.3, y * f - i * 9.1) - 0.5);
    f *= 2.03;
    amp *= 0.5;
  }
  return s;
}

// the outline: 5 or 6 corners round the middle, their angles and distances jittered,
// kept only if every corner stays on the hull (convex) and no corner is nearly flat
export function makeOutline(rand) {
  for (let tries = 0; tries < 500; tries++) {
    const n = rand() < 0.5 ? 5 : 6;
    const step = (Math.PI * 2) / n;
    const a0 = rand() * Math.PI * 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + i * step + (rand() - 0.5) * step * 0.62;
      const r = 4.3 + rand() * 1.6;
      pts.push([Math.cos(a) * r * 1.08, Math.sin(a) * r]);
    }
    let ok = true;
    let minEdge = Infinity, maxEdge = 0;
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], s = pts[(i + 2) % n];
      const e1 = [q[0] - p[0], q[1] - p[1]], e2 = [s[0] - q[0], s[1] - q[1]];
      const cross = e1[0] * e2[1] - e1[1] * e2[0];
      const turn = Math.asin(Math.min(1, cross / (Math.hypot(...e1) * Math.hypot(...e2))));
      if (turn < 0.32) ok = false; // concave, or a corner too flat to read as one
      const len = Math.hypot(...e1);
      minEdge = Math.min(minEdge, len);
      maxEdge = Math.max(maxEdge, len);
    }
    if (ok && minEdge > 2.2 && maxEdge / minEdge > 1.25) return pts; // not regular-looking
  }
  return [[5, 0], [1.4, 4.6], [-4.2, 3], [-4.6, -2.4], [0.6, -5], [4.2, -2.6]];
}

// the polygon's distance inside (positive) / outside (negative) the outline
export function insideDist(pts, x, z) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const ex = q[0] - p[0], ez = q[1] - p[1];
    const len = Math.hypot(ex, ez);
    // CCW outline: inward normal is (-ez, ex)
    d = Math.min(d, ((x - p[0]) * -ez + (z - p[1]) * ex) / len);
  }
  return d;
}

// how deep in the block a point is, its corners rounded off: the polygon's distance inside
// blended with the distance inside the largest circle it holds, so a fade along it reads as
// a soft blob over the middle, not as the polygon's outline. Gives { cx, cz, r, at(x, z) }.
export function core(pts) {
  let xs = Infinity, xe = -Infinity, zs = Infinity, ze = -Infinity;
  for (const [x, z] of pts) {
    xs = Math.min(xs, x); xe = Math.max(xe, x); zs = Math.min(zs, z); ze = Math.max(ze, z);
  }
  let cx = 0, cz = 0, r = -Infinity;
  for (let j = 0; j <= 60; j++) for (let i = 0; i <= 60; i++) {
    const x = xs + ((xe - xs) * i) / 60, z = zs + ((ze - zs) * j) / 60;
    const d = insideDist(pts, x, z);
    if (d > r) { r = d; cx = x; cz = z; }
  }
  return { cx, cz, r, at: (x, z) => 0.5 * insideDist(pts, x, z) + 0.5 * (r - Math.hypot(x - cx, z - cz)) };
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// the block's worn rim, so the meadow doesn't end on a ruler's line: the turf rounds over
// and sinks towards the edge (more at the corners, by chunks here and there), the edge is
// bitten back in places, and the grass gives out raggedly before it, the earth showing.
export function makeEdge(outline, ground) {
  const n = outline.length, K = 0.09; // how soft the corners
  const sides = outline.map((p, i) => {
    const q = outline[(i + 1) % n];
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return { p, ex: (q[0] - p[0]) / len, ez: (q[1] - p[1]) / len };
  });
  // distance inside, the corners softened (and so lower), and the way out
  const soft = (x, z) => {
    let s = 0, ox = 0, oz = 0, dmin = Infinity;
    for (const { p, ex, ez } of sides) {
      const d = (x - p[0]) * -ez + (z - p[1]) * ex;
      dmin = Math.min(dmin, d);
    }
    for (const { p, ex, ez } of sides) {
      const d = (x - p[0]) * -ez + (z - p[1]) * ex;
      const w = Math.exp(-(d - dmin) / K);
      s += w;
      ox += w * ez;
      oz -= w * ex;
    }
    const ol = Math.hypot(ox, oz) || 1;
    return { d: dmin - K * Math.log(s), ox: ox / ol, oz: oz / ol };
  };
  // how far the edge has crumbled back, in plan
  const bite = (x, z) => 0.2 * smoothstep(0.02, 0.22, fbm2(x * 1.4 + 7.1, z * 1.4 - 3.3, 3)) + 0.05 * noise2(x * 6.3 + 1.7, z * 6.3 - 8.2);
  const drop = (x, z) => {
    const d = Math.max(0, soft(x, z).d);
    const R = 0.2 + 0.25 * noise2(x * 1.7 - 4, z * 1.7 + 2); // how wide the rounding
    const t = Math.max(0, 1 - d / R);
    if (t === 0) return 0;
    const chunk = smoothstep(0.08, 0.25, fbm2(x * 2.1 - 13, z * 2.1 + 5, 3)); // a lump broken off
    const Rv = 0.08 + 0.07 * noise2(x * 2.9 + 9, z * 2.9) + 0.12 * chunk;
    return Rv * (1 - Math.sqrt(1 - t * t)) + 0.025 * t * t * noise2(x * 14, z * 14 + 3); // crumbs
  };
  const height = (x, z) => ground(x, z) - drop(x, z);
  // the grass's margin: >0 inside where it may grow, and how worn the turf (0 … 1 bare)
  const at = (x, z) => {
    const s = soft(x, z);
    const margin = s.d - bite(x, z);
    const gap = 0.05 + 0.3 * smoothstep(-0.1, 0.25, fbm2(x * 2.6 + 21, z * 2.6 - 17, 3)) + 0.05 * noise2(x * 11, z * 11);
    return { margin, wear: 1 - smoothstep(0, gap, margin), ox: s.ox, oz: s.oz };
  };
  return { height, bite, at };
}
