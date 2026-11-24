// The plant. Its tip stands still at the origin and everything else grows away from it: a part that is one blade
// older is GROW times further from the tip and GROW times bigger. Holding the eye on the tip, that growth is a zoom.
//
// Nothing here remembers anything. A blade is a function of three things only: how old it is (`ell`, in blades:
// 0 is the blade a unit below the tip, negative ones are younger and nearer it; `age` is the same in steps of 1.2 times,
// which is what the shape's numbers are written in), which of the KEYS characters it
// has (its number modulo KEYS), and where in the loop we are. One loop later blade n + KEYS is exactly what blade n
// was, so the last frame meets the first with nothing to settle.

const TAU = Math.PI * 2;
const AGE = () => Math.log(GROW) / Math.log(1.2);
const rad = (deg: number) => (deg * Math.PI) / 180;

export const KEYS = 13; // blades born in one loop
export const PHI = rad(137.5); // turn round the stem from one blade to the next
export const GROW = 1.12; // size of a blade over the next younger
// thirteen blades turn 1787.5 degrees, 12.5 short of five whole turns: the plant turns on by that much each loop
export const TURN = -(KEYS * PHI - TAU * Math.round((KEYS * PHI) / TAU));

export const LO = -42; // youngest blade drawn (GROW^-42 is under a hundredth)
export const HI = 12; // oldest, far below the picture
export const NB = HI - LO;
export const NU = 72; // points along a blade
export const NV = 13; // and across
const SUB = 6; // stem rings per blade
const SIDES = 10;
const TR = 18; // rings of a stalk with its bladder
const TS = 10;
const STEM_RINGS = NB * SUB + 1;

export const shape = {
  wobble: 0.03, // how far the stem steps aside at each blade
  stem: 0.016, // its radius
  length: 0.66, // of a blade, all three in units of its distance from the tip
  width: 0.155, // half width of a blade over its length
  stalk: 0.1,
  bladder: 0.048,
  open0: -22, // age at which a blade starts to unroll
  open1: -9, // and is flat
  face: 0.8, // how far a blade turns its face to the sun
  lean: 1, // how far blades stand out from the stem
  ruffle: 0.15, // waves along the edge
  sway: 1, // of the water
};

function hash(key: number, j: number) {
  let x = (Math.imul(key + 1, 374761393) + Math.imul(j + 1, 668265263)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = Math.imul(x ^ (x >>> 16), 2246822519);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
}
const R: number[][] = [];
for (let k = 0; k < KEYS; k++) R.push(Array.from({ length: 24 }, (_, j) => hash(k, j)));

// across a blade: -1..1, and how much of the edge's waving reaches that far in
const ACROSS = Array.from({ length: NV }, (_, j) => (j / (NV - 1)) * 2 - 1);
const EDGE = ACROSS.map((v) => Math.abs(v) * Math.sqrt(Math.abs(v)));

const ring = (sides: number) => Array.from({ length: sides + 1 }, (_, j) => [Math.cos((j / sides) * TAU), Math.sin((j / sides) * TAU)]);
const STEM_RING = ring(SIDES);
const TUBE_RING = ring(TS);

const sm = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createPlant() {
  const bladeVerts = NB * NU * NV;
  const blade = {
    pos: new Float32Array(bladeVerts * 3),
    nor: new Float32Array(bladeVerts * 3),
    aux: new Float32Array(bladeVerts * 4), // along, across (-1..1), length, seed
    aux2: new Float32Array(bladeVerts * 4), // half width, age, how open, half width here over the widest
    index: new Uint32Array(NB * (NU - 1) * (NV - 1) * 6),
  };
  {
    let o = 0;
    for (let b = 0; b < NB; b++)
      for (let i = 0; i < NU - 1; i++)
        for (let j = 0; j < NV - 1; j++) {
          const a = b * NU * NV + i * NV + j;
          blade.index.set([a, a + NV, a + 1, a + 1, a + NV, a + NV + 1], o);
          o += 6;
        }
  }
  const solidVerts = STEM_RINGS * (SIDES + 1) + NB * TR * (TS + 1);
  const solid = {
    pos: new Float32Array(solidVerts * 3),
    nor: new Float32Array(solidVerts * 3),
    aux: new Float32Array(solidVerts * 4), // along, round, radius, seed
    aux2: new Float32Array(solidVerts * 4), // how much of a bladder (0 stem, 1 bladder), age, 0, 0
    index: new Uint32Array(((STEM_RINGS - 1) * SIDES + NB * (TR - 1) * TS) * 6),
  };
  {
    let o = 0;
    const tube = (first: number, rings: number, sides: number) => {
      for (let i = 0; i < rings - 1; i++)
        for (let j = 0; j < sides; j++) {
          const a = first + i * (sides + 1) + j;
          solid.index.set([a, a + 1, a + sides + 1, a + 1, a + sides + 2, a + sides + 1], o);
          o += 6;
        }
    };
    tube(0, STEM_RINGS, SIDES);
    for (let b = 0; b < NB; b++) tube(STEM_RINGS * (SIDES + 1) + b * TR * (TS + 1), TR, TS);
  }

  // the stem's middle, for the stretch of it that was laid down as blade `m` (not only whole numbers)
  const centre = new Float64Array(4); // x y z, scale
  const stemAt = (m: number, base: number, ph: number) => {
    const s = Math.pow(GROW, base - m);
    const ell = (base - m) * AGE();
    const az = m * PHI + TURN * ph;
    const w = shape.sway * s;
    // the swell: the whole plant leans with it, the lean running down the stem as a wave
    const sx = w * (0.06 * Math.sin(TAU * 2 * ph - 0.5 * ell) + 0.03 * Math.sin(TAU * ph - 0.3 * ell + 0.5));
    const sz = w * 0.045 * Math.sin(TAU * 3 * ph - 0.4 * ell + 1.3);
    centre[0] = s * shape.wobble * Math.cos(az) + sx;
    centre[1] = -s;
    centre[2] = s * shape.wobble * Math.sin(az) + sz;
    centre[3] = s;
    return centre;
  };

  const mid = new Float64Array(NU * 12); // of the blade being made: place, along, normal, across
  const stemC = new Float64Array(STEM_RINGS * 3);

  const sun = [0, 1, 0];
  const pose = (phase: number) => {
    const ph = phase - Math.floor(phase);
    const base = ph * KEYS;

    // ---- stem
    const k0 = Math.ceil((base - HI) * SUB);
    for (let k = 0; k < STEM_RINGS; k++) stemC.set(stemAt((k0 + k) / SUB, base, ph).subarray(0, 3), k * 3);
    for (let k = 0; k < STEM_RINGS; k++) {
      const m = (k0 + k) / SUB;
      const s = Math.pow(GROW, base - m);
      const a = Math.max(0, k - 1) * 3,
        c = Math.min(STEM_RINGS - 1, k + 1) * 3;
      let tx = stemC[c] - stemC[a],
        ty = stemC[c + 1] - stemC[a + 1],
        tz = stemC[c + 2] - stemC[a + 2];
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz);
      (tx /= tl), (ty /= tl), (tz /= tl);
      // across: the way the stem last stepped aside, squared to the stem
      const az = m * PHI + TURN * ph;
      let nx = Math.cos(az),
        ny = 0,
        nz = Math.sin(az);
      const d = nx * tx + ny * ty + nz * tz;
      (nx -= tx * d), (ny -= ty * d), (nz -= tz * d);
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz);
      (nx /= nl), (ny /= nl), (nz /= nl);
      const bx = ty * nz - tz * ny,
        by = tz * nx - tx * nz,
        bz = tx * ny - ty * nx;
      // a little thicker where a blade leaves
      const knot = Math.cos(TAU * m) * 0.5 + 0.5;
      const r = shape.stem * s * (0.92 + 0.2 * knot * knot);
      for (let j = 0; j <= SIDES; j++) {
        const o = k * (SIDES + 1) + j;
        const cx = STEM_RING[j][0],
          sx = STEM_RING[j][1];
        const ux = nx * cx + bx * sx,
          uy = ny * cx + by * sx,
          uz = nz * cx + bz * sx;
        solid.pos[o * 3] = stemC[k * 3] + ux * r;
        solid.pos[o * 3 + 1] = stemC[k * 3 + 1] + uy * r;
        solid.pos[o * 3 + 2] = stemC[k * 3 + 2] + uz * r;
        solid.nor[o * 3] = ux;
        solid.nor[o * 3 + 1] = uy;
        solid.nor[o * 3 + 2] = uz;
        solid.aux[o * 4] = m;
        solid.aux[o * 4 + 1] = j / SIDES;
        solid.aux[o * 4 + 2] = r;
        solid.aux[o * 4 + 3] = 0.5;
        solid.aux2[o * 4] = 0;
        solid.aux2[o * 4 + 1] = base - m;
      }
    }

    // ---- blades, each on a stalk with a bladder
    const n0 = Math.ceil(base - HI);
    for (let b = 0; b < NB; b++) {
      const n = n0 + b;
      const ell = (base - n) * AGE();
      const key = ((n % KEYS) + KEYS) % KEYS;
      const r = R[key];
      const at = stemAt(n, base, ph);
      const s = at[3];
      const open = sm(shape.open0, shape.open1, ell);
      const grown = sm(shape.open0 - 2, shape.open1 + 1, ell);
      // how far it stands from the stem: a bud lies along it, a grown blade reaches out, an old one hangs
      const theta = rad(5 + shape.lean * (30 * open + 18 * sm(-10, 0, ell) + 24 * sm(0, 8, ell) + (r[1] - 0.5) * 16 * open));
      const az = n * PHI + TURN * ph + (r[2] - 0.5) * 0.6 * open;
      const ca = Math.cos(az),
        sa = Math.sin(az);

      // stalk and bladder: a tube that leaves the stem pointing out and turns up into the blade
      const stalk = shape.stalk * s * (0.35 + 0.65 * grown) * (0.8 + 0.4 * r[9]);
      const fat = shape.bladder * s * (0.12 + 0.88 * grown) * (0.8 + 0.45 * r[3]);
      const thin = 0.0062 * s;
      const long = stalk + fat * 2.9;
      const share = stalk / long;
      let px = at[0] + ca * shape.stem * s * 0.6,
        py = at[1],
        pz = at[2] + sa * shape.stem * s * 0.6;
      const first = STEM_RINGS * (SIDES + 1) + b * TR * (TS + 1);
      const radius = (w: number) => {
        if (w < share) return thin;
        const x = (w - share) / (1 - share);
        return thin * (1 - 0.45 * x) + (fat - thin) * Math.pow(Math.sin(Math.PI * Math.pow(x, 1.25)), 0.75);
      };
      let ex = px,
        ey = py,
        ez = pz;
      for (let k = 0; k < TR; k++) {
        const w = k / (TR - 1);
        const th = theta + rad(28) * (1 - w) * (1 - w) * open;
        const st = Math.sin(th),
          ct = Math.cos(th);
        const dx = st * ca,
          dy = ct,
          dz = st * sa;
        const nx = -ct * ca,
          ny = st,
          nz = -ct * sa;
        if (k > 0) (px += (dx * long) / (TR - 1)), (py += (dy * long) / (TR - 1)), (pz += (dz * long) / (TR - 1));
        if (k === TR - 2) (ex = px), (ey = py), (ez = pz);
        const rr = radius(w);
        const slope = (radius(Math.min(1, w + 0.02)) - radius(Math.max(0, w - 0.02))) / (0.04 * long);
        const bulb = sm(share * 0.9, share + (1 - share) * 0.3, w) * (1 - sm(0.93, 1, w));
        for (let j = 0; j <= TS; j++) {
          const o = first + k * (TS + 1) + j;
          const cf = TUBE_RING[j][0],
            sf = TUBE_RING[j][1];
          const ux = nx * cf - sa * sf,
            uy = ny * cf,
            uz = nz * cf + ca * sf;
          solid.pos[o * 3] = px + ux * rr;
          solid.pos[o * 3 + 1] = py + uy * rr;
          solid.pos[o * 3 + 2] = pz + uz * rr;
          const lx = ux - dx * slope,
            ly = uy - dy * slope,
            lz = uz - dz * slope;
          const ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
          solid.nor[o * 3] = lx / ll;
          solid.nor[o * 3 + 1] = ly / ll;
          solid.nor[o * 3 + 2] = lz / ll;
          solid.aux[o * 4] = w;
          solid.aux[o * 4 + 1] = j / TS;
          solid.aux[o * 4 + 2] = rr;
          solid.aux[o * 4 + 3] = r[4];
          solid.aux2[o * 4] = bulb;
          solid.aux2[o * 4 + 1] = base - n;
        }
      }

      // ---- the blade's middle line, walked from the bladder to the tip
      const len = shape.length * s * (0.82 + 0.36 * r[0]) * (1 + 0.35 * (1 - open));
      const half = len * shape.width * (0.8 + 0.4 * r[10]);
      const st = Math.sin(theta),
        ct = Math.cos(theta);
      let Tx = st * ca,
        Ty = ct,
        Tz = st * sa; // along
      let Nx = -ct * ca,
        Ny = st,
        Nz = -ct * sa; // the face turned to the stem
      let Bx = -sa,
        By = 0,
        Bz = ca; // across
      // bending away from the stem along its length: a bud curls in over the tip, an old blade droops
      const bend = rad(-34 * (1 - open) + 16 * open + 30 * sm(-4, 8, ell) + (r[5] - 0.5) * 34 * open);
      const curl = rad((r[6] - 0.5) * 60) * open;
      const twist = rad((r[7] - 0.5) * 50) * open;
      // a blade turns about its own length until its face meets the sun
      const ld = sun[0] * Tx + sun[1] * Ty + sun[2] * Tz;
      const fx = sun[0] - Tx * ld,
        fy = sun[1] - Ty * ld,
        fz = sun[2] - Tz * ld;
      const toSun = Math.atan2(fx * Bx + fy * By + fz * Bz, fx * Nx + fy * Ny + fz * Nz);
      const roll = (toSun * shape.face * Math.min(1, Math.sqrt(fx * fx + fy * fy + fz * fz) * 3) + rad((r[11] - 0.5) * 44)) * open;
      // what the water does to it: each wave starts at the stalk and runs out to the tip
      const sw = shape.sway * open;
      const pitchAt = (u: number) => bend * u * (0.4 + 0.6 * u) + sw * rad(9) * u * Math.sin(TAU * 2 * ph - 0.5 * ell - 2.4 * u + r[12] * 2);
      const yawAt = (u: number) => curl * u * u + sw * rad(13) * u * Math.sin(TAU * 3 * ph - 0.4 * ell - 3.1 * u + r[13] * TAU);
      const twistAt = (u: number) => roll + twist * u + sw * rad(16) * u * Math.sin(TAU * 2 * ph - 2.2 * u + r[14] * TAU);
      let pitch0 = 0,
        yaw0 = 0,
        twist0 = 0;
      px = ex;
      py = ey;
      pz = ez;
      for (let i = 0; i < NU; i++) {
        const u = i / (NU - 1);
        const dp = pitchAt(u) - pitch0,
          dy = yawAt(u) - yaw0,
          dt = twistAt(u) - twist0;
        (pitch0 += dp), (yaw0 += dy), (twist0 += dt);
        let c = Math.cos(dp),
          sn = Math.sin(dp);
        let ax = Tx * c - Nx * sn,
          ay = Ty * c - Ny * sn,
          az2 = Tz * c - Nz * sn;
        (Nx = Nx * c + Tx * sn), (Ny = Ny * c + Ty * sn), (Nz = Nz * c + Tz * sn);
        (Tx = ax), (Ty = ay), (Tz = az2);
        (c = Math.cos(dy)), (sn = Math.sin(dy));
        (ax = Tx * c + Bx * sn), (ay = Ty * c + By * sn), (az2 = Tz * c + Bz * sn);
        (Bx = Bx * c - Tx * sn), (By = By * c - Ty * sn), (Bz = Bz * c - Tz * sn);
        (Tx = ax), (Ty = ay), (Tz = az2);
        (c = Math.cos(dt)), (sn = Math.sin(dt));
        (ax = Nx * c + Bx * sn), (ay = Ny * c + By * sn), (az2 = Nz * c + Bz * sn);
        (Bx = Bx * c - Nx * sn), (By = By * c - Ny * sn), (Bz = Bz * c - Nz * sn);
        (Nx = ax), (Ny = ay), (Nz = az2);
        if (i > 0) (px += (Tx * len) / (NU - 1)), (py += (Ty * len) / (NU - 1)), (pz += (Tz * len) / (NU - 1));
        const o = i * 12;
        (mid[o] = px), (mid[o + 1] = py), (mid[o + 2] = pz);
        (mid[o + 3] = Tx), (mid[o + 4] = Ty), (mid[o + 5] = Tz);
        (mid[o + 6] = Nx), (mid[o + 7] = Ny), (mid[o + 8] = Nz);
        (mid[o + 9] = Bx), (mid[o + 10] = By), (mid[o + 11] = Bz);
      }

      // ---- its width, rolled up while young, with a wavy edge
      const v0 = b * NU * NV;
      const lobes = 3 + Math.floor(r[15] * 3);
      for (let i = 0; i < NU; i++) {
        const u = i / (NU - 1);
        const o = i * 12;
        // outline: quick to widen, long to taper, never quite regular
        const outline = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.62 + 0.2 * r[16])), 0.78);
        const edge = 1 + 0.07 * Math.sin(TAU * (lobes * u + r[17])) + 0.05 * Math.sin(TAU * ((lobes * 2 + 1) * u + r[18])) + 0.03 * Math.sin(TAU * (17 * u + r[19])) + 0.02 * Math.sin(TAU * (29 * u + r[20]));
        const w = half * outline * edge;
        // rolled into a tube as a bud, a shallow gutter when grown
        const arc = rad(310) * Math.pow(1 - open, 1.4) + rad(34) * (0.4 + r[20]) * (1 - 0.6 * u);
        const fr = 3.5 + 2.5 * r[21];
        // the edge is longer than the middle, so it has to wave; the waves crawl out to the tip. One side, then the other
        const wave0 = Math.sin(TAU * (fr * u - 2 * ph + r[8])) + 0.45 * Math.sin(TAU * (fr * 1.7 * u - 3 * ph + r[23]));
        const side = r[22] * TAU;
        const wave1 = Math.sin(TAU * (fr * u - 2 * ph + r[8]) + side) + 0.45 * Math.sin(TAU * (fr * 1.7 * u - 3 * ph + r[23]) + side * 1.7);
        const ruffle = shape.ruffle * w * open * (0.25 + 0.75 * sm(0, 0.25, u));
        // the section is an arc of a circle: its points by turning a step at a time, not a sine each
        const stepC = Math.cos(arc / (NV - 1)),
          stepS = Math.sin(arc / (NV - 1));
        let ac = Math.cos(arc / 2),
          as = -Math.sin(arc / 2);
        for (let j = 0; j < NV; j++) {
          const v = ACROSS[j];
          const a = (v * arc) / 2;
          const x = Math.abs(a) < 1e-4 ? w * v : (w * v * as) / a;
          const z = (Math.abs(a) < 1e-4 ? (w * v * a) / 2 : (w * v * (1 - ac)) / a) + ruffle * EDGE[j] * (v < 0 ? wave1 : wave0);
          const turned = ac * stepC - as * stepS;
          as = as * stepC + ac * stepS;
          ac = turned;
          const q = v0 + i * NV + j;
          blade.pos[q * 3] = mid[o] + mid[o + 9] * x + mid[o + 6] * z;
          blade.pos[q * 3 + 1] = mid[o + 1] + mid[o + 10] * x + mid[o + 7] * z;
          blade.pos[q * 3 + 2] = mid[o + 2] + mid[o + 11] * x + mid[o + 8] * z;
          blade.aux[q * 4] = u;
          blade.aux[q * 4 + 1] = v;
          blade.aux[q * 4 + 2] = len;
          blade.aux[q * 4 + 3] = r[4];
          blade.aux2[q * 4] = half;
          blade.aux2[q * 4 + 1] = base - n;
          blade.aux2[q * 4 + 2] = open;
          blade.aux2[q * 4 + 3] = outline * edge;
        }
      }
      // ---- normals from the finished sheet
      for (let i = 0; i < NU; i++) {
        const ia = Math.max(0, i - 1),
          ib = Math.min(NU - 1, i + 1);
        for (let j = 0; j < NV; j++) {
          const ja = Math.max(0, j - 1),
            jb = Math.min(NV - 1, j + 1);
          const A = (v0 + ia * NV + j) * 3,
            B = (v0 + ib * NV + j) * 3,
            C = (v0 + i * NV + ja) * 3,
            D = (v0 + i * NV + jb) * 3;
          const ux = blade.pos[B] - blade.pos[A],
            uy = blade.pos[B + 1] - blade.pos[A + 1],
            uz = blade.pos[B + 2] - blade.pos[A + 2];
          const wx = blade.pos[D] - blade.pos[C],
            wy = blade.pos[D + 1] - blade.pos[C + 1],
            wz = blade.pos[D + 2] - blade.pos[C + 2];
          let nx = uy * wz - uz * wy,
            ny = uz * wx - ux * wz,
            nz = ux * wy - uy * wx;
          const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
          const q = (v0 + i * NV + j) * 3;
          if (l > 1e-20) (nx /= l), (ny /= l), (nz /= l);
          else (nx = mid[i * 12 + 6]), (ny = mid[i * 12 + 7]), (nz = mid[i * 12 + 8]);
          blade.nor[q] = nx;
          blade.nor[q + 1] = ny;
          blade.nor[q + 2] = nz;
        }
      }
    }
  };

  return { blade, solid, pose, sun };
}
