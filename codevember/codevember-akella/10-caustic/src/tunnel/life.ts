/**
 * What lives in the tunnel: rapana shells lying on the sand, and small schools of grey mullet that keep close over
 * it. "Down" here is the wall, all the way round, so both are placed by an angle round the tunnel and a distance
 * along it. The meshes are made here; where each animal is, every frame, is worked out here too.
 */

/** a vertex: where, its normal, then how far along the body or the shell's coil, how far round, and what part it is */
export const VERT = 9;
/** an instance: two fours of numbers, read differently by shells, fish and shadows */
export const INST = 8;

export type Mesh = { verts: Float32Array; idx: Uint32Array };

type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** a grid of points wrapped into a tube: normals from its own neighbours, turned to point away from `inside`. The
 * first column is written again at the end, so "how far round" runs 0 to 1 without jumping back across a seam. */
const skin = (pts: V3[][], inside: V3[], uvk: (i: number, j: number) => V3) => {
  const rows = pts.length;
  const cols = pts[0].length;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < rows; i++) {
    for (let jj = 0; jj <= cols; jj++) {
      const j = jj % cols;
      const a = pts[Math.min(i + 1, rows - 1)][j];
      const b = pts[Math.max(i - 1, 0)][j];
      const c = pts[i][(j + 1) % cols];
      const d = pts[i][(j + cols - 1) % cols];
      let n = unit(cross(sub(a, b), sub(c, d)));
      if (dot(n, sub(pts[i][j], inside[i])) < 0) n = [-n[0], -n[1], -n[2]];
      verts.push(...pts[i][j], ...n, ...uvk(i, jj));
    }
  }
  for (let i = 0; i < rows - 1; i++) {
    for (let j = 0; j < cols; j++) {
      const a = i * (cols + 1) + j;
      const c = (i + 1) * (cols + 1) + j;
      idx.push(a, c, a + 1, a + 1, c, c + 1);
    }
  }
  return { verts, idx };
};

/**
 * The rapana: a scanned shell ("Рапан ракушка" by caplazavrmem, CC-BY 4.0, public/rapan.glb), read straight out of
 * its glb. It is laid the way a living one goes: the mouth flat to the sand, the spire trailing behind, the canal
 * leading (x forward, y up from the sand, a unit long). Which way the mouth opens was found once, off the model:
 * its faces lying deepest under the shell's own outline add up to it, and a look at a few turns of that settled it.
 */
export const loadShell = async (url: string) => {
  const buf = await (await fetch(url)).arrayBuffer();
  const dv = new DataView(buf);
  const jsonLen = dv.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const bin = 20 + jsonLen + 8;
  const prim = json.meshes[0].primitives[0];
  const floats = (index: number, n: number) => {
    const acc = json.accessors[index];
    const view = json.bufferViews[acc.bufferView];
    const at = bin + (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
    const stride = view.byteStride ?? n * 4;
    return Array.from({ length: acc.count }, (_, k) => Array.from({ length: n }, (_, d) => dv.getFloat32(at + k * stride + d * 4, true)));
  };
  // the file's own node turns z up to y up
  const up = ([x, y, z]: number[]): V3 => [x, z, -y];
  const pos = floats(prim.attributes.POSITION, 3).map(up);
  const nrm = floats(prim.attributes.NORMAL, 3).map(up);
  const uv = floats(prim.attributes.TEXCOORD_0, 2);
  const ia = json.accessors[prim.indices];
  const iv = json.bufferViews[ia.bufferView];
  const iat = bin + (iv.byteOffset ?? 0) + (ia.byteOffset ?? 0);
  const idx = Uint32Array.from({ length: ia.count }, (_, k) => (ia.componentType === 5125 ? dv.getUint32(iat + k * 4, true) : dv.getUint16(iat + k * 2, true)));

  const down = unit([-0.6829, 0.0257, 0.7302]);
  const apex: V3 = [0.302, 0.953, 0.011];
  const ad = dot(apex, down);
  const fwd = unit([-(apex[0] - down[0] * ad), -(apex[1] - down[1] * ad), -(apex[2] - down[2] * ad)]);
  const side = cross([-down[0], -down[1], -down[2]], fwd);
  let low = -1e9;
  let front = -1e9;
  let back = 1e9;
  for (const p of pos) {
    low = Math.max(low, dot(p, down));
    front = Math.max(front, dot(p, fwd));
    back = Math.min(back, dot(p, fwd));
  }
  const size = front - back;
  // sunk a little: the lip is under the sand
  const sink = 0.04 * size;
  const verts = new Float32Array(pos.length * VERT);
  pos.forEach((p, k) => {
    const n = nrm[k];
    verts.set([(dot(p, fwd) - (front + back) / 2) / size, (low - dot(p, down) - sink) / size, dot(p, side) / size, dot(n, fwd), -dot(n, down), dot(n, side), uv[k][0], uv[k][1], 0], k * VERT);
  });
  // its picture, and that picture halved again and again for when the shell is far off
  const img = json.images[json.textures[json.materials[prim.material].pbrMetallicRoughness.baseColorTexture.index].source];
  const iview = json.bufferViews[img.bufferView];
  const blob = new Blob([new Uint8Array(buf, bin + (iview.byteOffset ?? 0), iview.byteLength)], { type: img.mimeType });
  const full = await createImageBitmap(blob);
  const pictures = [full];
  for (let w = full.width >> 1, h = full.height >> 1; w >= 4 && h >= 4; w >>= 1, h >>= 1) {
    pictures.push(await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: "high" }));
  }
  return { verts, idx, pictures };
};

/** half the depth and half the width of a mullet's body, a way `u` from nose (0) to the root of the tail (1) */
const girth = (u: number): [number, number] => {
  const hy = 0.088 * (u < 0.36 ? Math.pow(u / 0.36, 0.55) : 1 - 0.68 * Math.pow(smooth(0.36, 1, u), 1.15));
  const hz = 0.057 * (u < 0.22 ? Math.pow(u / 0.22, 0.6) : 1 - 0.88 * Math.pow((u - 0.22) / 0.78, 1.2));
  return [hy, hz];
};

/**
 * A grey mullet: a blunt broad head, a body nearly round in section tapering to a narrow tail root, a forked
 * tail, two small fins on the back, one below, and pairs at the breast and belly. One unit long, nose toward +x,
 * y up, the tail fin in the upright plane. Fins are part 1 (drawn thin and darker), the tail part 2.
 */
export const makeFish = (): Mesh => {
  const ALONG = 30;
  const ROUND = 16;
  const NOSE = 0.48;
  const BODY = 0.85;
  const pts: V3[][] = [];
  const mid: V3[] = [];
  for (let i = 0; i <= ALONG; i++) {
    const u = Math.max(i / ALONG, 0.004);
    const [hy, hz] = girth(u);
    const x = NOSE - BODY * u;
    const row: V3[] = [];
    for (let j = 0; j < ROUND; j++) {
      const a = (j / ROUND) * Math.PI * 2;
      // a little squarer than an ellipse; the top of the head flatter than the belly
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const k = Math.pow(Math.pow(Math.abs(c), 2.4) + Math.pow(Math.abs(sn), 2.4), -1 / 2.4);
      row.push([x, hy * sn * k * (sn > 0 ? 0.9 : 1.05), hz * c * k]);
    }
    pts.push(row);
    mid.push([x, 0, 0]);
  }
  const s = skin(pts, mid, (i, j) => [i / ALONG, j / ROUND, 0]);
  const verts = s.verts;
  const idx = s.idx;
  // flat fins: a fan of triangles each, seen from both sides
  const fin = (ps: V3[], part: number) => {
    const n = unit(cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])));
    const base = verts.length / VERT;
    for (const p of ps) verts.push(...p, ...n, (NOSE - p[0]) / BODY, 0, part);
    for (let k = 1; k < ps.length - 1; k++) idx.push(base, base + k, base + k + 1);
  };
  const top = (x: number) => girth((NOSE - x) / BODY)[0] * 0.9;
  const bottom = (x: number) => -girth((NOSE - x) / BODY)[0] * 1.05;
  const side = (x: number) => girth((NOSE - x) / BODY)[1];
  // the tail, forked
  const root = NOSE - BODY + 0.012;
  fin(
    [
      [root, 0.034, 0],
      [-0.45, 0.075, 0],
      [-0.53, 0.125, 0],
      [-0.455, 0, 0],
      [root, 0, 0],
    ],
    2,
  );
  fin(
    [
      [root, -0.034, 0],
      [root, 0, 0],
      [-0.455, 0, 0],
      [-0.53, -0.125, 0],
      [-0.45, -0.075, 0],
    ],
    2,
  );
  // the back: a spiny first fin and a soft second
  fin(
    [
      [0.1, top(0.1) - 0.006, 0],
      [0.075, top(0.08) + 0.062, 0],
      [0.03, top(0.03) + 0.03, 0],
      [0.0, top(0.0) - 0.006, 0],
    ],
    1,
  );
  fin(
    [
      [-0.11, top(-0.11) - 0.005, 0],
      [-0.14, top(-0.14) + 0.058, 0],
      [-0.2, top(-0.2) + 0.022, 0],
      [-0.215, top(-0.215) - 0.005, 0],
    ],
    1,
  );
  // below, toward the tail
  fin(
    [
      [-0.1, bottom(-0.1) + 0.005, 0],
      [-0.215, bottom(-0.215) + 0.005, 0],
      [-0.2, bottom(-0.2) - 0.022, 0],
      [-0.135, bottom(-0.135) - 0.055, 0],
    ],
    1,
  );
  for (const m of [-1, 1]) {
    // at the breast, high on the side, swept back
    fin(
      [
        [0.275, 0.022, m * side(0.275) * 0.96],
        [0.25, -0.012, m * side(0.25) * 0.98],
        [0.15, 0.0, m * (side(0.15) + 0.045)],
        [0.16, 0.04, m * (side(0.16) + 0.035)],
      ],
      1,
    );
    // at the belly
    fin(
      [
        [0.12, bottom(0.12) + 0.012, m * 0.02],
        [0.05, bottom(0.05) + 0.012, m * 0.02],
        [0.03, bottom(0.03) - 0.035, m * 0.05],
      ],
      1,
    );
  }
  return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
};

const mulberry = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** shells scattered over one length of tunnel: angle round, distance along, size, which way it is headed; then
 * nothing, its own number, nothing, nothing */
export const scatterShells = (count: number, seed: number, length: number) => {
  const rnd = mulberry(seed * 31 + 5);
  const out = new Float32Array(count * INST);
  for (let k = 0; k < count; k++) out.set([rnd() * Math.PI * 2, rnd() * length, 0.085 + 0.06 * rnd(), rnd() * Math.PI * 2, 0, rnd(), 0, 0], k * INST);
  return out;
};

/**
 * A rate (of an angle, a second), brought to a whole number of turns in a loop of `loop` seconds, so that whatever
 * turns at it is back where it began when the loop comes round; never to none, unless `still` allows. Itself, when
 * no loop is asked for.
 */
export const inLoop = (rate: number, loop: number, still = false) => {
  if (!(loop > 0)) return rate;
  const q = (2 * Math.PI) / loop;
  const turns = Math.round(Math.abs(rate) / q);
  return (rate < 0 ? -1 : 1) * (still ? turns : Math.max(turns, 1)) * q;
};

type Member = { back: number; side: number; lift: number; phase: number; size: number; sway: number; was: number; wasAt: number; nose: number; beat: number; w: number[] };
type School = { z0: number; a0: number; vz: number; va: number; p1: number; p2: number; w: number[]; fish: Member[] };

/** schools of four or five: most go the way the eye flies, some a little faster, a few come the other way; all
 * of them wind round the tunnel as they go. For a loop of `loop` seconds (in which the eye goes one length of the
 * tunnel) every school goes a whole number of lengths and of turns, and every sway a whole number of times. */
export const makeSchools = (count: number, seed: number, length: number, loop = 0): School[] => {
  const rnd = mulberry(seed * 53 + 11);
  const schools: School[] = [];
  let abreast = 0;
  for (let k = 0; k < count; k++) {
    const with_ = rnd() < 0.7;
    const fish: Member[] = [];
    const n = rnd() < 0.5 ? 4 : 5;
    for (let i = 0; i < n; i++) {
      fish.push({
        back: i * (0.13 + 0.1 * rnd()),
        side: (i === 0 ? 0 : (i % 2 ? 1 : -1) * (0.07 + 0.1 * rnd())) + 0.03 * (rnd() - 0.5),
        lift: 0.075 + 0.08 * rnd(),
        phase: rnd() * 6.28,
        size: 0.27 + 0.1 * rnd(),
        sway: rnd() * 6.28,
        was: 0,
        wasAt: 0,
        nose: 0,
        beat: 0,
        w: [],
      });
    }
    let vz = with_ ? 0.36 + 0.5 * rnd() : -(0.2 + 0.3 * rnd());
    // (in a loop: abreast of the eye, or twice as fast, or against it; those abreast are set a little way ahead of
    // it one after another, where they are seen the whole way round)
    let z0 = ((k + rnd() * 0.7) / count) * length;
    if (loop > 0) {
      const lengths = with_ ? (k % 3 === 2 ? 2 : 1) : -1;
      vz = (length / loop) * lengths;
      if (lengths === 1) z0 = 1.1 + 1.25 * abreast++;
    }
    schools.push({
      z0,
      a0: rnd() * Math.PI * 2,
      vz,
      // round the tunnel as well as along it: a spiral, one way or the other, some tight and some long
      va: inLoop((rnd() < 0.5 ? -1 : 1) * (0.1 + 0.3 * rnd()), loop),
      p1: rnd() * 6.28,
      p2: rnd() * 6.28,
      w: [0.11, 0.37, 0.19].map((r) => inLoop(r, loop)),
      fish,
    });
    for (const f of fish) {
      // the tail beats at a rate of its own, quicker in a quicker school; a slow roll; a drift aside and up and down
      f.beat = inLoop((7 + 11 * Math.abs(vz)) * (0.9 + 0.2 * rnd()), loop);
      f.w = [inLoop(0.5, loop), inLoop(0.33, loop), inLoop(0.13 * f.beat, loop)];
    }
  }
  return schools;
};

/** a fish: three fours of numbers */
export const FISH = 12;

/**
 * Where every fish is at a time, and the shadow under it. A school's path is a spiral along and round the tunnel
 * with a slow wander; each fish follows it a little behind the leader and to one side.
 *
 * How high it swims is worked out along its own path: `ground` (the sand's broad shape, rocks counted in) is read at
 * where the fish was a second ago and where it will be for the next two, and a soft greatest of those
 * is taken, weighted toward what is just ahead. So it starts to rise well before a stone and comes down well after,
 * in one slow line, and its nose follows the line. (Read off the ground under it, however smoothed, it bobbed.)
 *
 * Written as instances: fish (angle round, distance along, heading, length; height over the bare wall, where it is
 * in its tail beat, how much it is turning, its own number; how far its nose is up, and three spare) and shadows
 * (angle, distance, heading, half length; half width, darkness, 0, 0). Distances along are put within a length of
 * tunnel of the eye. Returns how many fish.
 */
export const swim = (
  schools: School[],
  t: number,
  eye: number,
  length: number,
  radius: number,
  lean: number,
  ground: (a: number, z: number) => number,
  fishOut: Float32Array,
  shadowOut: Float32Array,
  shadowAt: number,
) => {
  let n = 0;
  const path = (s: School, tt: number): [number, number] => [s.a0 + s.va * tt + 0.4 * Math.sin(s.w[0] * tt + s.p2) + 0.12 * Math.sin(s.w[1] * tt + s.p1), s.z0 + s.vz * tt + 0.45 * Math.sin(s.w[2] * tt + s.p1)];
  const heading = (s: School, tt: number) => {
    const a = path(s, tt - 0.06);
    const b = path(s, tt + 0.06);
    return { psi: Math.atan2(radius * (b[0] - a[0]), b[1] - a[1]), speed: Math.hypot(radius * (b[0] - a[0]), b[1] - a[1]) / 0.12 };
  };
  // (a soft greatest, and not a sharp one: sharp, a single reading touching a stone pulled the fish up at once.
  // The readings are weighed by a bell that falls to nothing at both ends, so none arrives or leaves with a jolt.)
  // The readings are close together (much closer than the ground's own grid), or the sum ripples as they step
  // across a stone's edge and the fish trembles.
  const SHARP = 6.5;
  const under = (s: School, f: Member, tt: number) => {
    // (to one side of the path by the school's heading now: near enough over the second or two this looks along)
    const psi = heading(s, tt).psi;
    const da = (f.side * Math.cos(psi)) / radius;
    const dz = -f.side * Math.sin(psi);
    let sum = 0;
    let weight = 0;
    for (let k = -68; k <= 120; k++) {
      const [a, z] = path(s, tt + k * 0.025);
      const w = Math.pow(Math.cos((Math.PI * (k - 26)) / 192), 2);
      sum += w * Math.exp(SHARP * ground(a + da, z + dz));
      weight += w;
    }
    return Math.log(sum / weight) / SHARP;
  };
  for (const s of schools) {
    for (const f of s.fish) {
      if ((n + 1) * FISH > fishOut.length) return n;
      const lead = heading(s, t);
      const tt = t - f.back / Math.max(lead.speed, 0.15);
      const h = heading(s, tt);
      const turn = heading(s, tt + 0.25).psi - heading(s, tt - 0.25).psi;
      // to one side of the path, a little adrift
      const off = f.side * (1 + 0.25 * Math.sin(f.w[0] * t + f.sway));
      const [a, z] = path(s, tt);
      const arc = a + (off * Math.cos(h.psi)) / radius;
      let zz = z - off * Math.sin(h.psi);
      zz = eye - 3 + ((((zz - eye + 3) % length) + length) % length);
      const clear = f.lift * (1 + 0.2 * Math.sin(f.w[1] * t + f.sway * 1.7));
      // (its nose follows how its height changed since the last frame: one look along the path a fish, not three)
      const base = under(s, f, tt);
      const lift = base + clear;
      const went = tt - f.wasAt;
      const nose = went > 1e-4 && went < 0.2 ? Math.atan2(base - f.was, went * Math.max(h.speed, 0.15)) : f.nose;
      f.nose += (nose - f.nose) * 0.2;
      f.was = base;
      f.wasAt = tt;
      // (the tail's beat is a steady one: taken as the time by a rate that changes, it raced whenever the rate did,
      // the more the longer the page had run)
      fishOut.set([arc, zz, h.psi, f.size, lift, f.phase + tt * f.beat, Math.max(-1, Math.min(1, turn * 1.6)), f.sway, 0.7 * f.nose, f.w[2] * tt + 6 * f.sway, 0, 0], n * FISH);
      shadowOut.set([arc, zz + lean * clear, h.psi, 0.55 * f.size * (1 + clear), 0.15 * f.size * (1 + 3 * clear), 0.95 / (1 + 2.5 * clear), 0, 0], (shadowAt + n) * INST);
      n++;
    }
  }
  return n;
};

/**
 * Eelgrass, in meadows: plants are kept where a slow noise over the wall is high (and a few strays elsewhere), so
 * there are stretches of grass and stretches of bare sand. Each plant is a handful of leaves from one foot.
 * Leaves: angle round, distance along, length, which way the water bends it; width, its own number, how far it
 * bends, its tint. And a shadow under each plant, as the animals have.
 */
export const scatterGrass = (plants: number, seed: number, length: number, radius: number, tall: number, lean: number) => {
  const rnd = mulberry(seed * 97 + 3);
  // a noise that wraps round the tunnel and along it
  const NA = 5;
  const NZ = 15;
  const grid = Float32Array.from({ length: NA * NZ }, () => rnd());
  const noise = (a: number, z: number) => {
    const x = (a / (Math.PI * 2)) * NA;
    const y = (z / length) * NZ;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const at = (ii: number, jj: number) => grid[(((ii % NA) + NA) % NA) + (((jj % NZ) + NZ) % NZ) * NA];
    return (at(i, j) * (1 - ux) + at(i + 1, j) * ux) * (1 - uy) + (at(i, j + 1) * (1 - ux) + at(i + 1, j + 1) * ux) * uy;
  };
  const leaves: number[] = [];
  const shadows: number[] = [];
  let made = 0;
  for (let tries = 0; made < plants && tries < plants * 30; tries++) {
    const a = rnd() * Math.PI * 2;
    const z = rnd() * length;
    const thick = noise(a, z);
    if (thick < 0.6 && rnd() > 0.03) continue;
    made++;
    // taller in the thick of a meadow
    const high = tall * (0.55 + 0.6 * rnd()) * (0.75 + 0.9 * Math.max(thick - 0.5, 0));
    const yaw = (rnd() - 0.5) * 0.8;
    const count = 5 + Math.floor(rnd() * 5);
    for (let k = 0; k < count; k++) {
      const off = 0.012;
      leaves.push(a + ((rnd() - 0.5) * off) / radius, z + (rnd() - 0.5) * off, high * (0.6 + 0.4 * rnd()), yaw + (rnd() - 0.5) * 0.25, 0.0042 + 0.003 * rnd(), rnd() * 10, 0.45 + 0.7 * rnd(), rnd());
    }
    shadows.push(a, z + lean * 0.3 * high + 0.25 * high * Math.cos(yaw), yaw, 0.42 * high, 0.05 + 0.12 * high, 0.42, 0, 1);
  }
  return { leaves: new Float32Array(leaves), shadows: new Float32Array(shadows), plants: made };
};

/**
 * A hamsa (the Black Sea anchovy, Engraulis encrasicolus): slender, the snout pointed past a big eye, one small fin
 * on the back, a deeply forked tail. A unit long, nose toward +x, y up; few points, since each is drawn tiny and
 * there are hundreds. The fin on the back is part 1, the tail part 2.
 */
export const makeAnchovy = (): Mesh => {
  const ALONG = 11;
  const ROUND = 8;
  const NOSE = 0.5;
  const BODY = 0.84;
  const deep = (u: number) => 0.074 * (u < 0.3 ? Math.pow(u / 0.3, 0.6) : 1 - 0.8 * Math.pow(smooth(0.3, 1, u), 1.1));
  const wide = (u: number) => 0.046 * (u < 0.25 ? Math.pow(u / 0.25, 0.65) : 1 - 0.9 * Math.pow((u - 0.25) / 0.75, 1.15));
  const pts: V3[][] = [];
  const mid: V3[] = [];
  for (let i = 0; i <= ALONG; i++) {
    const u = Math.max(i / ALONG, 0.01);
    const x = NOSE - BODY * u;
    const row: V3[] = [];
    for (let j = 0; j < ROUND; j++) {
      const a = (j / ROUND) * Math.PI * 2;
      row.push([x, deep(u) * Math.sin(a), wide(u) * Math.cos(a)]);
    }
    pts.push(row);
    mid.push([x, 0, 0]);
  }
  const s = skin(pts, mid, (i, j) => [i / ALONG, j / ROUND, 0]);
  const verts = s.verts;
  const idx = s.idx;
  const fin = (ps: V3[], part: number) => {
    const n = unit(cross(sub(ps[1], ps[0]), sub(ps[2], ps[0])));
    const base = verts.length / VERT;
    for (const q of ps) verts.push(...q, ...n, (NOSE - q[0]) / BODY, 0, part);
    for (let k = 1; k < ps.length - 1; k++) idx.push(base, base + k, base + k + 1);
  };
  const root = NOSE - BODY + 0.01;
  fin(
    [
      [root, 0.016, 0],
      [-0.43, 0.06, 0],
      [-0.5, 0.115, 0],
      [-0.415, 0, 0],
      [root, 0, 0],
    ],
    2,
  );
  fin(
    [
      [root, -0.016, 0],
      [root, 0, 0],
      [-0.415, 0, 0],
      [-0.5, -0.115, 0],
      [-0.43, -0.06, 0],
    ],
    2,
  );
  const top = (x: number) => deep((NOSE - x) / BODY);
  fin(
    [
      [0.03, top(0.03) - 0.004, 0],
      [-0.01, top(-0.01) + 0.05, 0],
      [-0.07, top(-0.07) + 0.012, 0],
      [-0.08, top(-0.08) - 0.004, 0],
    ],
    1,
  );
  return { verts: new Float32Array(verts), idx: new Uint32Array(idx) };
};

type Small = { lag: number; r: number; turn: number; spin: number; along: number; phase: number; size: number; own: number; aside: number; asideAt: number; beat: number; w: number[] };
type Shoal = { z0: number; a0: number; vz: number; va: number; slosh: number; rate: number; every: number; starts: number; salt: number; p: number[]; w: number[]; fish: Small[] };

/**
 * Schools of hamsa, in the open water. Each fish swims the school's own path a little later than its leader (up to
 * a couple of seconds), and a little way off it: so the school is a ribbon along its own trail, bunching to a ball
 * when it slows and drawing out when it darts, and every swerve of the path passes down it fish by fish.
 */
export const makeShoals = (count: number, each: number, seed: number, length: number, loop = 0): Shoal[] => {
  const rnd = mulberry(seed * 71 + 29);
  const shoals: Shoal[] = [];
  for (let k = 0; k < count; k++) {
    const fish: Small[] = [];
    for (let i = 0; i < each; i++) {
      fish.push({
        // most of them toward the front, a thinning tail of stragglers
        lag: 2.4 * Math.pow(rnd(), 1.5),
        r: Math.sqrt(rnd()) * (0.55 + 0.45 * rnd()),
        turn: rnd() * Math.PI * 2,
        spin: inLoop((rnd() - 0.5) * 0.5, loop, true),
        along: (rnd() - 0.5) * 0.3,
        phase: rnd() * 6.28,
        size: 0.066 + 0.024 * rnd(),
        own: rnd(),
        aside: 0,
        asideAt: -1,
        beat: 0,
        w: [inLoop(0.7, loop), inLoop(1.3, loop)],
      });
    }
    // (in a loop it keeps abreast of the eye, falling behind it and darting ahead; and starts aside a whole number
    // of times, the same starts each time round)
    const every = 5 + 4 * rnd();
    const starts = loop > 0 ? Math.max(1, Math.round(loop / every)) : 0;
    // (and in a loop the first of them is set to wash to and fro through the eye, the next ones farther ahead)
    const spread = ((k + 0.3 + rnd() * 0.4) / count) * length;
    shoals.push({
      z0: loop > 0 ? 1.1 + 1.9 * k : spread,
      a0: rnd() * Math.PI * 2,
      vz: loop > 0 ? length / loop : 0.66 + 0.2 * rnd(),
      va: inLoop((rnd() < 0.5 ? -1 : 1) * (0.06 + 0.16 * rnd()), loop),
      // (how much quicker and slower it goes, as a distance to and fro; never so slow that it turns back)
      slosh: 0,
      rate: inLoop(0.13 + 0.06 * rnd(), loop),
      every: starts ? loop / starts : every,
      starts,
      salt: Math.floor(rnd() * 1e6),
      p: Array.from({ length: 6 }, () => rnd() * 6.28),
      w: [0.13, 0.41, 0.17, 0.53].map((r) => inLoop(r, loop)),
      fish,
    });
    const s = shoals[k];
    s.slosh = ((s.vz - 0.28) * (0.75 + 0.25 * rnd())) / s.rate;
    for (const f of fish) {
      f.beat = inLoop((16 + 22 * s.vz) * (0.9 + 0.2 * rnd()), loop);
      f.w.push(inLoop(0.05 * f.beat, loop));
    }
  }
  return shoals;
};

const hash01 = (n: number) => {
  let x = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/**
 * Where every hamsa is at a time, and its shadow (`eye` is where the eye is, in its own ring's plane and along): written as the mullet are (a fish is angle round, distance along,
 * heading, length; height over the bare wall, where it is in its tail beat, how hard it is turning, its own number;
 * how far its nose is up, and three spare). Places are worked out in the ring's own plane (across, up, along), so a
 * school may cross the middle of the tunnel; they keep clear of the sand, and part round the eye. A fish's heading,
 * its nose and how it banks come from where it was a moment ago and will be a moment on.
 */
export const shoal = (
  shoals: Shoal[],
  t: number,
  eye: [number, number, number],
  drift: (z: number) => [number, number],
  length: number,
  radius: number,
  lean: number,
  ground: (a: number, z: number) => number,
  fishOut: Float32Array,
  shadowOut: Float32Array,
  shadowAt: number,
) => {
  let n = 0;
  /** the school's path: winding round the tunnel, in toward the middle and out, now quick and now slow; and every
   * few seconds a start to one side, quickly made and slowly recovered */
  const path = (s: Shoal, tt: number): [number, number, number, number] => {
    const ang = s.a0 + s.va * tt + 0.8 * Math.sin(s.w[0] * tt + s.p[0]) + 0.25 * Math.sin(s.w[1] * tt + s.p[1]);
    const rho = radius * (0.36 + 0.2 * Math.sin(s.w[2] * tt + s.p[2]) + 0.07 * Math.sin(s.w[3] * tt + s.p[3]));
    let u = rho * Math.cos(ang);
    let v = rho * Math.sin(ang);
    const e = Math.floor(tt / s.every);
    for (let k = e - 1; k <= e; k++) {
      // (which start it is: in a loop, the same few over again)
      const id = s.starts ? ((k % s.starts) + s.starts) % s.starts : k;
      const x = (tt - (k + 0.7 * hash01(id * 2 + s.salt)) * s.every) / 0.35;
      if (x <= 0) continue;
      // (it sets off smoothly, if quickly: a start with a corner in it snapped every fish round at once)
      const kick = 0.14 * 0.25 * x * x * Math.exp(2 - x) * (0.5 + hash01(id * 2 + 1 + s.salt));
      const way = hash01(id * 2 + 7 + s.salt) * Math.PI * 2;
      u += kick * Math.cos(way);
      v += kick * Math.sin(way);
    }
    const speed = s.vz + s.slosh * s.rate * Math.cos(s.rate * tt + s.p[4]);
    return [u, v, s.z0 + s.vz * tt + s.slosh * Math.sin(s.rate * tt + s.p[4]), speed];
  };
  /** where a fish would be with nothing in its way */
  const free = (s: Shoal, f: Small, tt: number): [number, number, number] => {
    const [cu, cv, cz, speed] = path(s, tt - f.lag);
    // fuller across when it is slow and short, drawn thin when it is quick and long
    const girth = 0.2 * Math.min(1.5, Math.max(0.65, Math.sqrt(s.vz / Math.max(speed, 0.15))));
    const at = f.turn + f.spin * tt;
    const out = f.r * girth * (1 + 0.2 * Math.sin(f.w[0] * tt + f.phase));
    return [cu + out * Math.cos(at), cv + out * Math.sin(at), cz + f.along * girth * 2 + 0.03 * Math.sin(f.w[1] * tt + f.phase * 2)];
  };
  /** how it lies from the eye, sideways (`drift` is how far the tunnel's middle has wound aside between the eye's
   * ring and the fish's: the two are placed each from its own); nothing, when it is not near */
  const fromEye = (p: [number, number, number]): [number, number, number] | undefined => {
    const off = ((((p[2] - eye[2] + length / 2) % length) + length) % length) - length / 2;
    if (Math.abs(off) >= 1) return undefined;
    const wound = drift(eye[2] + off);
    return [p[0] + wound[0] - eye[0], p[1] + wound[1] - eye[1], 0.5 * off];
  };
  /** and where it is: round the eye, not through it, and never into the sand */
  const place = (s: Shoal, f: Small, tt: number, p = free(s, f, tt)): [number, number, number] => {
    let [u, v] = p;
    // pushed aside, the way it has been leaning (`aside`, which turns only so fast: pushed straight away from the
    // eye, a fish headed right at it leapt from one side of it to the other as it passed)
    const d = fromEye(p);
    if (d) {
      const near = Math.hypot(d[0], d[1], d[2]);
      if (near < 0.42) {
        const push = 0.2 * (1 - near / 0.42) * (1 - near / 0.42);
        u += push * Math.cos(f.aside);
        v += push * Math.sin(f.aside);
      }
    }
    // the nearer the wall, the more it is held off
    const rho = Math.hypot(u, v);
    const most = radius - ground(Math.atan2(v, u), p[2]) - 0.09;
    const soft = 0.12;
    if (rho > most - soft) {
      const held = most - soft * Math.exp(-(rho - (most - soft)) / soft);
      u *= held / rho;
      v *= held / rho;
    }
    return [u, v, p[2]];
  };
  const D = 0.06;
  for (const s of shoals) {
    for (const f of s.fish) {
      if ((n + 1) * FISH > fishOut.length) return n;
      // which side of the eye it leans to: the side it is on, come round to no faster than a fish turns
      const now = free(s, f, t);
      const d = fromEye(now);
      const want = d ? Math.atan2(d[1], d[0]) : f.aside;
      const since = t - f.asideAt;
      if (!d || f.asideAt < 0 || since < 0 || since > 0.5) f.aside = want;
      else {
        let turn = want - f.aside;
        turn -= Math.PI * 2 * Math.round(turn / (Math.PI * 2));
        f.aside += Math.max(-2.5 * since, Math.min(2.5 * since, turn));
      }
      f.asideAt = t;
      const a = place(s, f, t - D);
      const b = place(s, f, t, now);
      const c = place(s, f, t + D);
      const ang = Math.atan2(b[1], b[0]);
      const rho = Math.hypot(b[0], b[1]);
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      // its way, as the ring has it there: along the tunnel, round it, and up toward the middle
      const vel = [(c[0] - a[0]) / (2 * D), (c[1] - a[1]) / (2 * D), (c[2] - a[2]) / (2 * D)];
      const along = vel[2];
      const round = -vel[0] * sa + vel[1] * ca;
      const up = -(vel[0] * ca + vel[1] * sa);
      const level = Math.hypot(along, round);
      const speed = Math.hypot(level, up);
      const psi = Math.atan2(round, along);
      // how hard it is turning: its sideways pull over its speed
      const acc = [(c[0] - 2 * b[0] + a[0]) / (D * D), (c[1] - 2 * b[1] + a[1]) / (D * D), (c[2] - 2 * b[2] + a[2]) / (D * D)];
      const accRound = -acc[0] * sa + acc[1] * ca;
      const side = -acc[2] * Math.sin(psi) + accRound * Math.cos(psi);
      const turn = Math.max(-1, Math.min(1, (1.1 * side) / Math.max(speed, 0.2)));
      const lift = radius - rho;
      const zz = eye[2] - 3 + ((((b[2] - eye[2] + 3) % length) + length) % length);
      fishOut.set([ang, zz, psi, f.size, lift, f.phase + t * f.beat, turn, f.own, Math.max(-0.9, Math.min(0.9, Math.atan2(up, Math.max(level, 1e-3)))), f.w[2] * t + 40 * f.own, 0, 0], n * FISH);
      const clear = Math.max(lift - ground(ang, b[2]), 0);
      shadowOut.set([ang, zz + lean * clear, psi, 0.6 * f.size * (1 + 1.2 * clear), 0.22 * f.size * (1 + 3 * clear), 0.3 / (1 + 3 * clear), 0, 0], (shadowAt + n) * INST);
      n++;
    }
  }
  return n;
};
