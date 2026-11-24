// node --experimental-strip-types tools/bake.ts [periods]: grows the pile until it repeats, and keeps one life of
// every key in public/spore.bin. SET='{"NK":40}' changes the pile; FREE=n periods left alone before the guide is
// learnt; LEARN=n periods it is learnt over; GUIDE=rate; SVG=file draws the last moment from the side and above.
import fs from "node:fs";
import { P, Pile, lengthAt, radAt, capAt, turnX, turnZ } from "../src/sim.ts";
if (process.env.SET) Object.assign(P, JSON.parse(process.env.SET));
const periods = Number(process.argv[2] ?? 18);
const FREE = Number(process.env.FREE ?? 3);
const LEARN = Number(process.env.LEARN ?? 3);
const GUIDE = Number(process.env.GUIDE ?? 3);
const KEEP = 2; // every KEEP-th node goes in the file
const KEEP_F = 3; // and every KEEP_F-th frame

const pile = new Pile();
const NN = pile.NN;
const last: (Float32Array | null)[] = Array(P.NK).fill(null);
const mean: (Float64Array | null)[] = Array(P.NK).fill(null);
const count = new Int32Array(P.NK);
const lastGen = new Int32Array(P.NK).fill(-1);
const off: { rms: number; max: number; n: number }[] = [];
pile.done = (key, gen, rec) => {
  const prev = last[key];
  if (prev) {
    let sum = 0,
      max = 0;
    for (let i = 0; i < rec.length; i += 3) {
      const d = Math.hypot(rec[i] - prev[i], rec[i + 1] - prev[i + 1], rec[i + 2] - prev[i + 2]);
      sum += d * d;
      if (d > max) max = d;
    }
    const o = (off[gen] ??= { rms: 0, max: 0, n: 0 });
    o.rms += sum / (rec.length / 3);
    o.max = Math.max(o.max, max);
    o.n++;
  }
  last[key] = rec;
  lastGen[key] = gen;
  if (gen >= FREE && gen < FREE + LEARN) {
    const m = (mean[key] ??= new Float64Array(rec.length));
    for (let i = 0; i < rec.length; i++) m[i] += rec[i];
    count[key]++;
    if (gen === FREE + LEARN - 1 && GUIDE > 0) {
      const t = new Float32Array(rec.length);
      for (let i = 0; i < rec.length; i++) t[i] = m[i] / count[key];
      pile.target[key] = t;
    }
  }
};

const t0 = performance.now();
const TF = P.T * P.FPS;
const maxLife = Math.max(...pile.keys.map((k) => k.life));
console.log(`keys ${P.NK}, lives ${Math.min(...pile.keys.map((k) => k.life)).toFixed(1)}..${maxLife.toFixed(1)} s, room for ${pile.max}`);
for (let p = 0; p < periods; p++) {
  // the guide comes on once every key has a target: gently, then firmly
  if (GUIDE > 0 && pile.target.every((t) => t)) pile.guide = GUIDE;
  let deep = 0,
    pairs = 0;
  pile.drawn = pile.moved = 0;
  for (let f = 0; f < TF; f++) {
    pile.step();
    deep = Math.max(deep, pile.deepest);
    pairs += pile.npairs;
  }
  let alive = 0;
  for (let s = 0; s < pile.max; s++) alive += pile.alive[s];
  console.log(
    `period ${p}: alive ${alive}, pairs ${(pairs / TF).toFixed(0)}, deepest ${(deep / 0.033).toFixed(2)} r, guide ${pile.guide}, drawn ${((100 * pile.drawn) / (pile.moved || 1)).toFixed(1)}%, ${((performance.now() - t0) / 1000).toFixed(0)} s`,
  );
}
for (const [g, o] of off.entries()) if (o) console.log(`gen ${g} from ${g - 1}: rms ${(Math.sqrt(o.rms / o.n) / 0.033).toFixed(3)} r, worst ${(o.max / 0.033).toFixed(2)} r (${o.n} keys)`);

// ---- the pile as it stands, for a look: side view and the cut at three heights
if (process.env.SVG) {
  const eye = (P.H / P.T) * pile.time;
  const turn = -(P.TURN * pile.time) / P.T;
  const c = Math.cos(turn),
    sn = Math.sin(turn);
  const S = 220;
  let side = "",
    cuts = "";
  const order: number[] = [];
  for (let s = 0; s < pile.max; s++) if (pile.alive[s]) order.push(s);
  const zOf = (s: number) => turnZ(pile.x[(s * NN + P.N) * 3], pile.x[(s * NN + P.N) * 3 + 2], c, sn);
  order.sort((a, b) => zOf(a) - zOf(b));
  for (const s of order) {
    const k = pile.keys[pile.key[s]];
    const o = s * NN * 3;
    const pts: string[] = [];
    for (let i = 0; i < NN; i++) {
      const X = turnX(pile.x[o + i * 3], pile.x[o + i * 3 + 2], c, sn);
      pts.push(`${(X * S).toFixed(1)},${(-(pile.x[o + i * 3 + 1] - eye) * S).toFixed(1)}`);
    }
    const shade = Math.round(150 + 100 * Math.min(1, Math.max(0, zOf(s) + 0.5)));
    const col = `rgb(${shade},${shade},${Math.round(shade * 0.92)})`;
    side += `<polyline points="${pts.join(" ")}" fill="none" stroke="#111" stroke-width="${(radAt(k, pile.age[s]) * 2 * S + 2).toFixed(1)}" stroke-linecap="round"/>`;
    side += `<polyline points="${pts.join(" ")}" fill="none" stroke="${col}" stroke-width="${(radAt(k, pile.age[s]) * 2 * S).toFixed(1)}" stroke-linecap="round"/>`;
    const [tx, ty] = pts[P.N].split(",");
    side += `<circle cx="${tx}" cy="${ty}" r="${(capAt(k, pile.age[s]) * S).toFixed(1)}" fill="${col}" stroke="#111"/>`;
  }
  [-1.5, -0.5, 0.6].forEach((h, hi) => {
    for (const s of order) {
      const k = pile.keys[pile.key[s]];
      const o = s * NN * 3;
      for (let i = 0; i < P.N; i++) {
        const y0 = pile.x[o + i * 3 + 1] - eye,
          y1 = pile.x[o + i * 3 + 4] - eye;
        if ((y0 - h) * (y1 - h) > 0) continue;
        const w = (h - y0) / (y1 - y0 || 1);
        const X = pile.x[o + i * 3] * (1 - w) + pile.x[o + i * 3 + 3] * w,
          Z = pile.x[o + i * 3 + 2] * (1 - w) + pile.x[o + i * 3 + 5] * w;
        cuts += `<circle cx="${((turnX(X, Z, c, sn) + 1.3 + hi * 2.6) * S).toFixed(1)}" cy="${(turnZ(X, Z, c, sn) * S).toFixed(1)}" r="${(radAt(k, pile.age[s]) * S).toFixed(1)}" fill="#ddd" stroke="#111"/>`;
        break;
      }
    }
  });
  const W = 2.6 * 3 * S;
  fs.writeFileSync(
    process.env.SVG,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${4.2 * S + 2.6 * S}" viewBox="0 0 ${W} ${4.2 * S + 2.6 * S}"><rect width="100%" height="100%" fill="#223"/>` +
      `<g transform="translate(${W / 2},${2.1 * S})"><rect x="${-1 * S}" y="${-1.78 * S}" width="${2 * S}" height="${3.56 * S}" fill="none" stroke="#f80"/><rect x="${-2.85 * S}" y="${-1.6 * S}" width="${5.7 * S}" height="${3.2 * S}" fill="none" stroke="#08f"/>${side}</g>` +
      `<g transform="translate(0,${4.2 * S + 1.3 * S})">${cuts}</g></svg>`,
  );
}

// ---- the file: a header, then every key's life as int16 from its root
if (!process.env.DRY) {
  const Q = 8 / 32767;
  const keys = pile.keys.map((k, i) => {
    const rec = last[i]!;
    const frames = rec.length / (NN * 3);
    const a0 = Math.ceil(k.tau * P.FPS - 1e-9) / P.FPS - k.tau; // its age at the first frame kept
    return { tau: k.tau, x: k.x, y: k.y, z: k.z, L: k.L, D: k.D, rad: k.rad, cap: k.cap, life: k.life, seed: k.seed, burst: k.burst, creep: k.creep, pop: k.pop, a0, frames: Math.ceil(frames / KEEP_F) };
  });
  const pts = Math.floor(P.N / KEEP) + 1;
  const total = keys.reduce((a, k) => a + k.frames, 0);
  const data = new Int16Array(total * pts * 3);
  let w = 0;
  keys.forEach((k, i) => {
    const rec = last[i]!;
    for (let f = 0; f < k.frames; f++) for (let n = 0; n < pts; n++) for (let d = 0; d < 3; d++) data[w++] = Math.round(rec[(f * KEEP_F * NN + n * KEEP) * 3 + d] / Q);
  });
  const head = JSON.stringify({ T: P.T, H: P.H, TURN: P.TURN, DEPTH: P.DEPTH, fps: P.FPS / KEEP_F, pts, Q, gens: [...lastGen], keys });
  const hb = Buffer.from(head + " ".repeat((4 - (head.length % 4)) % 4));
  const len = Buffer.alloc(4);
  len.writeUInt32LE(hb.length);
  fs.writeFileSync("public/spore.bin", Buffer.concat([len, hb, Buffer.from(data.buffer)]));
  console.log(`public/spore.bin: ${((4 + hb.length + data.byteLength) / 1e6).toFixed(2)} MB, ${total} frames of ${pts} points, generations ${Math.min(...lastGen)}..${Math.max(...lastGen)}`);
}
