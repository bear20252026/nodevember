// A kelp grown into a given shape by space colonization (Runions, Lane, Prusinkiewicz 2007).
//
// The shape is filled with points the plant wants to reach: many just under its skin, fewer deep inside. A stalk
// stands under it. Then, step after step, every point pulls on the branch node nearest to it, each node that is
// pulled puts out a new node a step further the way it is pulled, and a point that a branch has come close to is
// taken away. Nothing else decides where branches go, so they fill the shape the way a crown fills its light.
//
// The slow part of this is usually "which node is nearest to each point", asked again every step. Here it is turned
// round: points do not move, so each new node tells the points about it that it is nearer, and a step costs what
// was added in it.
//
// Pure arithmetic with its own random numbers, so it gives the same plant everywhere and runs in node for tests.

export type Shape = { position: ArrayLike<number>; index: ArrayLike<number> };

export const defaults = {
  seed: 5,
  size: 0.72, // of the shape, whose own half height is about 1
  at: [0, 0.36, 0] as [number, number, number], // where its middle goes
  floor: -1.05,
  stalkTime: 0.15, // how much of the growing is the stalk's
  step: 0.011, // a node to the next
  reach: 0.12, // how far a point pulls from
  near: 0.014, // how near a branch must come to take a point
  skin: 20000, // points under the skin
  skinDeep: 0.03,
  inside: 7000, // and in the middle
  twig: 0.0018, // radius of a tip
  pipe: 3.1, // a branch's radius to this power is the sum of its children's
  blades: 6000, // fronds rooted under the skin
  bladeGap: 0.02,
  inner: 6000, // and inside
  innerGap: 0.03,
};
export type Options = typeof defaults;

export type Grown = ReturnType<typeof grow>;

export function grow(shape: Shape, opts: Partial<Options> = {}) {
  const o = { ...defaults, ...opts };
  let s = o.seed >>> 0;
  const R = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- the shape, where it will stand
  const nv = shape.position.length / 3,
    nt = shape.index.length / 3;
  const P = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) for (let k = 0; k < 3; k++) P[i * 3 + k] = shape.position[i * 3 + k] * o.size + o.at[k];
  const I = shape.index;
  const VN = new Float32Array(nv * 3);
  const area = new Float32Array(nt);
  let total = 0;
  const lo = [1e9, 1e9, 1e9],
    hi = [-1e9, -1e9, -1e9];
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3,
      b = I[t * 3 + 1] * 3,
      c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a],
      uy = P[b + 1] - P[a + 1],
      uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a],
      vy = P[c + 1] - P[a + 1],
      vz = P[c + 2] - P[a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) {
      VN[v] += nx;
      VN[v + 1] += ny;
      VN[v + 2] += nz;
      for (let k = 0; k < 3; k++) {
        lo[k] = Math.min(lo[k], P[v + k]);
        hi[k] = Math.max(hi[k], P[v + k]);
      }
    }
    total += Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
    area[t] = total;
  }
  for (let i = 0; i < nv; i++) {
    const l = Math.hypot(VN[i * 3], VN[i * 3 + 1], VN[i * 3 + 2]) || 1;
    for (let k = 0; k < 3; k++) VN[i * 3 + k] /= l;
  }

  // is a place inside? Count the skins crossed going straight back (the monkey's only holes, its eye sockets, are in front)
  const G = 48;
  const cellX = (hi[0] - lo[0]) / G,
    cellY = (hi[1] - lo[1]) / G;
  const column: number[][] = Array.from({ length: G * G }, () => []);
  for (let t = 0; t < nt; t++) {
    const a = I[t * 3] * 3,
      b = I[t * 3 + 1] * 3,
      c = I[t * 3 + 2] * 3;
    const x0 = Math.max(0, Math.floor((Math.min(P[a], P[b], P[c]) - lo[0]) / cellX)),
      x1 = Math.min(G - 1, Math.floor((Math.max(P[a], P[b], P[c]) - lo[0]) / cellX));
    const y0 = Math.max(0, Math.floor((Math.min(P[a + 1], P[b + 1], P[c + 1]) - lo[1]) / cellY)),
      y1 = Math.min(G - 1, Math.floor((Math.max(P[a + 1], P[b + 1], P[c + 1]) - lo[1]) / cellY));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) column[y * G + x].push(t);
  }
  const isInside = (x: number, y: number, z: number) => {
    const cx = Math.floor((x - lo[0]) / cellX),
      cy = Math.floor((y - lo[1]) / cellY);
    if (cx < 0 || cy < 0 || cx >= G || cy >= G) return false;
    let crossed = 0;
    for (const t of column[cy * G + cx]) {
      const a = I[t * 3] * 3,
        b = I[t * 3 + 1] * 3,
        c = I[t * 3 + 2] * 3;
      const d = (P[b + 1] - P[c + 1]) * (P[a] - P[c]) + (P[c] - P[b]) * (P[a + 1] - P[c + 1]);
      if (Math.abs(d) < 1e-12) continue;
      const l1 = ((P[b + 1] - P[c + 1]) * (x - P[c]) + (P[c] - P[b]) * (y - P[c + 1])) / d;
      const l2 = ((P[c + 1] - P[a + 1]) * (x - P[c]) + (P[a] - P[c]) * (y - P[c + 1])) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      if (l1 * P[a + 2] + l2 * P[b + 2] + l3 * P[c + 2] < z) crossed++;
    }
    return (crossed & 1) === 1;
  };

  // ---- the points it wants
  const count = o.skin + o.inside;
  const A = new Float32Array(count * 3); // where
  const AN = new Float32Array(count * 3); // the skin's outward there (nothing for a deep one)
  for (let i = 0; i < o.skin; i++) {
    const want = R() * total;
    let l = 0,
      h = nt - 1;
    while (l < h) {
      const m = (l + h) >> 1;
      if (area[m] < want) l = m + 1;
      else h = m;
    }
    let u = R(),
      v = R();
    if (u + v > 1) {
      u = 1 - u;
      v = 1 - v;
    }
    const a = I[l * 3] * 3,
      b = I[l * 3 + 1] * 3,
      c = I[l * 3 + 2] * 3;
    const w = 1 - u - v;
    const n = [0, 1, 2].map((k) => w * VN[a + k] + u * VN[b + k] + v * VN[c + k]);
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const deep = o.skinDeep * (0.15 + 0.85 * R());
    for (let k = 0; k < 3; k++) {
      AN[i * 3 + k] = n[k] / nl;
      A[i * 3 + k] = w * P[a + k] + u * P[b + k] + v * P[c + k] - (n[k] / nl) * deep;
    }
  }
  for (let i = o.skin, tries = 0; i < count && tries < 400000; tries++) {
    const x = lo[0] + (hi[0] - lo[0]) * R(),
      y = lo[1] + (hi[1] - lo[1]) * R(),
      z = lo[2] + (hi[2] - lo[2]) * R();
    if (!isInside(x, y, z)) continue;
    A.set([x, y, z], i * 3);
    i++;
  }
  // which points are about a place: they stand still, so one grid for good
  const cell = o.reach;
  const gx = Math.ceil((hi[0] - lo[0]) / cell) + 3,
    gy = Math.ceil((hi[1] - lo[1]) / cell) + 3,
    gz = Math.ceil((hi[2] - lo[2]) / cell) + 3;
  const cellOf = (x: number, y: number, z: number) => {
    const cx = Math.floor((x - lo[0]) / cell) + 1,
      cy = Math.floor((y - lo[1]) / cell) + 1,
      cz = Math.floor((z - lo[2]) / cell) + 1;
    return cx < 0 || cy < 0 || cz < 0 || cx >= gx || cy >= gy || cz >= gz ? -1 : (cz * gy + cy) * gx + cx;
  };
  const bins: number[][] = Array.from({ length: gx * gy * gz }, () => []);
  for (let i = 0; i < count; i++) bins[cellOf(A[i * 3], A[i * 3 + 1], A[i * 3 + 2])]?.push(i);
  const nearest = new Int32Array(count).fill(-1);
  const nearestD = new Float32Array(count).fill(o.reach * o.reach);
  const alive = new Uint8Array(count).fill(1);
  const takenBy = new Int32Array(count).fill(-1);

  // ---- nodes
  let cap = 1 << 15,
    n = 0;
  let pos = new Float32Array(cap * 3),
    parent = new Int32Array(cap),
    born = new Float32Array(cap);
  const fine = o.step * 0.42; // no two nodes nearer than this
  const taken = new Map<number, number[]>();
  const key = (x: number, y: number, z: number) => (Math.floor(x / o.step) + 4096) * 67108864 + (Math.floor(y / o.step) + 4096) * 8192 + (Math.floor(z / o.step) + 4096);
  const crowded = (x: number, y: number, z: number) => {
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const list = taken.get(key(x + dx * o.step, y + dy * o.step, z + dz * o.step));
          if (!list) continue;
          for (const j of list) if ((pos[j * 3] - x) ** 2 + (pos[j * 3 + 1] - y) ** 2 + (pos[j * 3 + 2] - z) ** 2 < fine * fine) return true;
        }
    return false;
  };
  const add = (x: number, y: number, z: number, from: number, when: number) => {
    if (n === cap) {
      cap *= 2;
      const p2 = new Float32Array(cap * 3),
        q2 = new Int32Array(cap),
        b2 = new Float32Array(cap);
      p2.set(pos);
      q2.set(parent);
      b2.set(born);
      pos = p2;
      parent = q2;
      born = b2;
    }
    pos.set([x, y, z], n * 3);
    parent[n] = from;
    born[n] = when;
    const k = key(x, y, z);
    (taken.get(k) ?? taken.set(k, []).get(k)!).push(n);
    // tell the points about it
    const cx = Math.floor((x - lo[0]) / cell) + 1,
      cy = Math.floor((y - lo[1]) / cell) + 1,
      cz = Math.floor((z - lo[2]) / cell) + 1;
    for (let dz = -1; dz <= 1; dz++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const X = cx + dx,
            Y = cy + dy,
            Z = cz + dz;
          if (X < 0 || Y < 0 || Z < 0 || X >= gx || Y >= gy || Z >= gz) continue;
          for (const i of bins[(Z * gy + Y) * gx + X]) {
            if (!alive[i]) continue;
            const d = (A[i * 3] - x) ** 2 + (A[i * 3 + 1] - y) ** 2 + (A[i * 3 + 2] - z) ** 2;
            if (d < nearestD[i]) {
              nearestD[i] = d;
              nearest[i] = n;
              if (d < o.near * o.near) {
                alive[i] = 0;
                takenBy[i] = n;
              }
            }
          }
        }
    return n++;
  };

  // the stalk: from the floor up to under the shape, in a lazy S, and its holdfast
  let lowX = 0,
    lowZ = 0,
    lows = 0;
  const lowBelow = lo[1] + (hi[1] - lo[1]) * 0.16;
  for (let i = 0; i < count; i++)
    if (A[i * 3 + 1] < lowBelow) {
      lowX += A[i * 3];
      lowZ += A[i * 3 + 2];
      lows++;
    }
  const foot = [o.at[0] + 0.1, o.floor, o.at[2] - 0.12];
  const neck = [lowX / lows, lo[1] - o.reach * 0.55, lowZ / lows];
  const stalkLength = Math.hypot(neck[0] - foot[0], neck[1] - foot[1], neck[2] - foot[2]) * 1.05;
  const stalkNodes = Math.ceil(stalkLength / o.step);
  const turnA = R() * 6.28,
    turnB = R() * 6.28;
  let tip = -1;
  for (let i = 0; i <= stalkNodes; i++) {
    const f = i / stalkNodes;
    const bow = Math.sin(f * Math.PI);
    const x = foot[0] + (neck[0] - foot[0]) * f + bow * 0.07 * Math.sin(f * 4.4 + turnA),
      z = foot[2] + (neck[2] - foot[2]) * f + bow * 0.07 * Math.sin(f * 3.6 + turnB);
    tip = add(x, foot[1] + (neck[1] - foot[1]) * f, z, tip, i);
  }
  const stalkTop = tip;
  // the holdfast: fingers that leave the stalk a little above the sand, reach out and come down on it
  const fingers: number[] = []; // their tips
  const fingerCount = 9;
  for (let k = 0; k < fingerCount; k++) {
    const from = 2 + Math.floor(R() * 6);
    const turn = (k / fingerCount) * 6.2832 + R() * 0.5;
    const out = 0.07 + 0.09 * R();
    const steps = Math.ceil((out * 1.3) / o.step);
    let last = from;
    const x0 = pos[from * 3],
      y0 = pos[from * 3 + 1],
      z0 = pos[from * 3 + 2];
    for (let i = 1; i <= steps; i++) {
      const f = i / steps;
      const r = out * Math.pow(f, 0.8),
        bend = turn + 0.5 * Math.sin(f * 3 + k);
      last = add(x0 + Math.cos(bend) * r, y0 + (o.floor - 0.006 - y0) * (1 - (1 - f) ** 2.2), z0 + Math.sin(bend) * r, last, from * 0.3 + i * 0.5);
    }
    fingers.push(last);
  }
  const fixed = n; // nodes up to here never sway apart from the stalk's own lean

  // ---- growing
  const pullX = new Float32Array(cap),
    pullY = new Float32Array(cap),
    pullZ = new Float32Array(cap),
    pulled: number[] = [];
  let pullN = new Uint16Array(cap);
  let round = stalkNodes;
  for (let it = 0; it < 900; it++) {
    round++;
    if (pullN.length < cap) pullN = new Uint16Array(cap);
    pulled.length = 0;
    const px = pullX.length < cap ? new Float32Array(cap) : pullX,
      py = pullY.length < cap ? new Float32Array(cap) : pullY,
      pz = pullZ.length < cap ? new Float32Array(cap) : pullZ;
    for (let i = 0; i < count; i++) {
      if (!alive[i] || nearest[i] < 0) continue;
      const j = nearest[i];
      const dx = A[i * 3] - pos[j * 3],
        dy = A[i * 3 + 1] - pos[j * 3 + 1],
        dz = A[i * 3 + 2] - pos[j * 3 + 2];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      if (!pullN[j]) {
        pulled.push(j);
        px[j] = py[j] = pz[j] = 0;
      }
      pullN[j]++;
      px[j] += dx / l;
      py[j] += dy / l;
      pz[j] += dz / l;
    }
    let grew = 0;
    for (const j of pulled) {
      let dx = px[j],
        dy = py[j],
        dz = pz[j];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const even = l < 0.05 * pullN[j]; // pulled every way alike: go some way rather than nowhere
      pullN[j] = 0;
      if (even) {
        dx = R() - 0.5;
        dy = R() - 0.5;
        dz = R() - 0.5;
      }
      const ll = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      const x = pos[j * 3] + (dx / ll) * o.step + (R() - 0.5) * o.step * 0.12,
        y = pos[j * 3 + 1] + (dy / ll) * o.step + (R() - 0.5) * o.step * 0.12,
        z = pos[j * 3 + 2] + (dz / ll) * o.step + (R() - 0.5) * o.step * 0.12;
      if (crowded(x, y, z)) continue;
      add(x, y, z, j, round + R() * 0.8);
      grew++;
    }
    if (!grew) break;
  }
  const rounds = round;

  // ---- what the tree is like
  const children = new Uint16Array(n);
  for (let i = 1; i < n; i++) if (parent[i] >= 0) children[parent[i]]++;
  // a branch is as thick as what it carries (da Vinci's rule, with a power a little over two)
  const carry = new Float64Array(n);
  let tips = 0;
  for (let i = n - 1; i >= 0; i--) {
    if (!children[i]) {
      carry[i] = 1;
      tips++;
    }
    if (parent[i] >= 0) carry[parent[i]] += carry[i];
  }
  const radius = new Float32Array(n);
  for (let i = 0; i < n; i++) radius[i] = o.twig * Math.pow(carry[i], 1 / o.pipe);
  // the holdfast's fingers are stout all along, thinner at their tips
  for (const f of fingers) {
    let r = 0.0045;
    for (let j = f; j >= fixed - 0 && parent[j] >= 0 && j > stalkTop; j = parent[j]) {
      radius[j] = Math.max(radius[j], r);
      r = Math.min(0.014, r + 0.0011);
    }
  }
  // the heaviest child carries the branch on
  const heir = new Int32Array(n).fill(-1);
  for (let i = 1; i < n; i++) {
    const p = parent[i];
    if (p >= 0 && (heir[p] < 0 || carry[i] > carry[heir[p]])) heir[p] = i;
  }
  const way = new Float32Array(n); // how far along the plant from the foot
  let longest = 0;
  for (let i = 1; i < n; i++) {
    const p = parent[i];
    if (p < 0) continue;
    way[i] = way[p] + Math.hypot(pos[i * 3] - pos[p * 3], pos[i * 3 + 1] - pos[p * 3 + 1], pos[i * 3 + 2] - pos[p * 3 + 2]);
    longest = Math.max(longest, way[i]);
  }
  // the stalk is many steps but one thing: it gets a small part of the time, the filling of the shape the rest
  const beat = (1 - o.stalkTime) / (rounds - stalkNodes); // a step's worth of time, in the shape
  for (let i = 0; i < n; i++) born[i] = born[i] <= stalkNodes ? (born[i] / stalkNodes) * o.stalkTime : o.stalkTime + (born[i] - stalkNodes) * beat;

  // ---- fronds where a branch came to the skin, each a little way from the others
  const bladeAt: number[] = [], // node
    bladeOut: number[] = []; // the skin's outward there
  const spaced = (gap: number) => {
    const held = new Map<number, number[]>();
    const k = (x: number, y: number, z: number) => (Math.floor(x / gap) + 4096) * 67108864 + (Math.floor(y / gap) + 4096) * 8192 + (Math.floor(z / gap) + 4096);
    return (x: number, y: number, z: number) => {
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const list = held.get(k(x + dx * gap, y + dy * gap, z + dz * gap));
            if (!list) continue;
            for (let q = 0; q < list.length; q += 3) if ((list[q] - x) ** 2 + (list[q + 1] - y) ** 2 + (list[q + 2] - z) ** 2 < gap * gap) return false;
          }
      const kk = k(x, y, z);
      (held.get(kk) ?? held.set(kk, []).get(kk)!).push(x, y, z);
      return true;
    };
  };
  const order = Array.from({ length: o.skin }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const innerAt: number[] = []; // nodes for fronds inside
  const innerFree = spaced(o.innerGap);
  for (let i = o.skin; i < count && innerAt.length < o.inner; i++) {
    const j = takenBy[i];
    if (j >= 0 && innerFree(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2])) innerAt.push(j);
  }
  const bladeFree = spaced(o.bladeGap);
  for (const i of order) {
    const j = takenBy[i];
    if (j < 0) continue;
    const x = pos[j * 3],
      y = pos[j * 3 + 1],
      z = pos[j * 3 + 2];
    if (bladeAt.length < o.blades && bladeFree(x, y, z)) {
      bladeAt.push(j);
      bladeOut.push(AN[i * 3], AN[i * 3 + 1], AN[i * 3 + 2]);
    }
  }

  let left = 0;
  for (let i = 0; i < count; i++) left += alive[i];
  return {
    options: o,
    count: n,
    pos: pos.subarray(0, n * 3),
    parent: parent.subarray(0, n),
    born: born.subarray(0, n), // 0..1, the stalk first
    radius,
    heir,
    way,
    longest,
    stalkTop,
    fixed,
    tips,
    left, // points never reached
    lo,
    hi,
    bladeAt,
    bladeOut,
    innerAt,
    beat,
    random: R,
    isInside,
  };
}
