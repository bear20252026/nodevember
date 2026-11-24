// Weed that keeps growing, and an eye that goes with it: day 4's composition (a body up the diagonal, its front
// ragged, each shoot surging on in its own time), and the body is the seaweed of the shapes (weed.ts): short fronds
// lying along a skin and lit as that skin, weed all the way through, streamers where the current leaves it.
// Nothing is simulated.
//
// Everything is drawn in the frame that travels with the growth, where the front stays about the origin and the
// body streams back from it. The body is a lumpy tube about a wandering spine, and all of that is fixed in the
// plant and repeats once a loop of growth. A stipe is a thin shoot that runs the length of it, in its skin or
// inside it, each with a small wander of its own; nothing winds round the axis and nothing draws in behind the
// front. A head is where a shoot has got to: the loop's phase, plus day 4's ease, which repeats every loop too, so
// heads surge and rest in turn and none is left behind.
//
// A frond has a place in the loop (0..1) and a lap. When the head passes its place again the frond that was there
// has become the one a lap older, which is the same frond drawn by the next lap's slot: so one loop on, the same
// picture has moved one pitch, and so has the eye.
import { Fn, abs, attribute, cos, cross, dot, exp, float, floor, fract, max, mix, normalize, positionGeometry, pow, sin, smoothstep, texture, uniform, varying, varyingProperty, vec2, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { BufferAttribute, DataTexture, DataUtils, HalfFloatType, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, LinearFilter, RGBAFormat, RepeatWrapping, Vector3, RedFormat } from "three/webgpu";
import type { BladeIn, SolidIn } from "./look.ts";
import { skinU } from "./look.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;
type V4 = Node<"vec4">;
const TAU = Math.PI * 2;
const LONG = 0.19; // a frond longer than this is drawn with more quads

export const defaults = {
  seed: 12,
  count: 300, // shoots shown to begin with
  perLoop: 125, // fronds a shoot puts out in a loop, to begin with
  most: 420, // how many of each are made, so that the panel can show more or fewer without building again
  mostPerLoop: 170,
  laps: 2, // loops of growth that are drawn behind the front
  pitch: 3.2, // how far the growth goes in a loop
  axis: [0.74, 0.64, 0.2] as [number, number, number], // which way: up the picture's diagonal, and a little towards the eye
  wide: 0.42, // the tube's radius
  lumps: 0.8, // how far from a plain tube it is
  bends: 1, // and how far its spine wanders
  cube: 0.55, // half the edge of a rounded cube that the tube goes through from corner to corner, once a loop; 0 for none
  cubeRound: 0.14, // the radius of its edges
  cubeAt: 0.55, // where in the loop its middle is
  cubeRoll: 0.6, // and how it is turned about the tube
  put: "cube" as Put, // what the tube goes through: nothing, the cube, a figure (a mesh given to `reshape`), or both
  figure: 0.9, // how big the figure is: this times its mesh
  figureTurn: -30, // degrees it is turned about the upright, from facing the eye: the sun is to rake across a face
  blend: 0.3, // how softly the figure comes out of the tube: the two are joined over this much of a difference in radius
  skin: 0.7, // how many of the shoots run in its skin; the rest are inside it
  dome: 0.05, // loops the middle of the front is ahead of its rim
  flow: [-0.5, 0.42, -0.76] as [number, number, number], // the way the current goes: over the body's sunny side, up and away
  hold: 0.15, // how far round to the side the current leaves by fronds begin to let go (0 the middle, 1 that side)
  gone: 1.25, // and where they all have
  thin: 0.5, // how many of the free ones are left out, so that the fringe is not a wall
  stray: 0.05, // how many on the shaped side are long anyway
  tail: 0.75, // how long a streamer can be
  thick: 0.006, // an old shoot's radius
  quads: [5, 2] as [number, number], // along and across a short frond: what costs is vertices, and there are many fronds
  longQuads: [10, 2] as [number, number], // and a streamer
};
export type StemOptions = Partial<typeof defaults>;
export type Put = "none" | "cube" | "figure" | "both";
export type Mesh = { position: ArrayLike<number>; index: ArrayLike<number> };
// a thing the tube goes through, for whoever draws the thing itself (rock.ts): where in the loop its middle is and
// how far off the axis; a cube's half edge, the radius of its edges and its three axes; a figure's size and turn
export type Thing = { kind: "cube" | "figure"; at: number; off: Vector3; half: number; round: number; axes: Vector3[]; size: number; turn: number };

// the body's lumps: how big (of its radius), how many round it and where the first is, how many along a loop and
// where. Each stands where it is (so many round times so many along): one that ran round the body as it went along
// it would be a strand of rope, and this is not rope
const LUMPS = [
  [0.2, 2, 0.4, 1, 1.3],
  [0.15, 3, 2.1, 2, 0.2],
  [0.11, 1, 4.4, 3, 2.6],
  [0.08, 4, 1.0, 5, 4.1],
  [0.07, 5, 3.3, 4, 5.5],
];

export function createStems(opts: StemOptions = {}) {
  const o = { ...defaults, ...opts };
  let s = o.seed >>> 0;
  const R = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const axis = new Vector3(...o.axis).normalize();
  const across = new Vector3(0, 0, 1).cross(axis).normalize(); // square to the axis, in the picture
  const depth = axis.clone().cross(across).normalize(); // and towards the eye
  const flow = new Vector3(...o.flow).normalize();
  const side = flow.clone().cross(new Vector3(0, 1, 0)).normalize(); // across the current

  const U = {
    phase: uniform(0),
    pitch: uniform(o.pitch),
    axis: uniform(axis),
    across: uniform(across),
    depth: uniform(depth),
    flow: uniform(flow),
    side: uniform(side),
    surge: uniform(1), // how unevenly the heads go on, part of the front by part: 0 abreast
    gust: uniform(1), // and how unevenly the whole front does
    bends: uniform(o.bends), // how far the spine wanders (`reshape` sets it)
    sway: uniform(1),
    flutter: uniform(1),
    stream: uniform(0.55), // how much a frond that holds the shape is combed downstream all the same
    bladeLength: uniform(1),
    bladeWidth: uniform(1),
    cup: uniform(0.45),
    smooth: uniform(0.8), // how far a frond of the skin is lit as the skin it lies on, not as itself
    breathe: uniform(0.5), // how far the fronds on the skin lift as the water's push passes, letting the sun in
    ripe: uniform(0.7), // how long a frond takes to grow
    leaves: uniform(o.perLoop), // fronds a loop on each shoot that are let grow
  };
  const tau = U.phase.mul(TAU);
  const LAPS = o.laps;

  // ---- what every vertex is told about its shoot
  // dealt out so that however many are shown, they are spread evenly round the body and through it
  // The front goes on a part at a time. The body is cut round into a few big uneven parts and into more small
  // ones, and a part has its own time to go and its own size of going; at a cut the two parts' are run together
  // over a short way, so that a part's edge is a slope and not a step. Each shoot going at its own time, three
  // hundred of them made a front that was ragged and yet came on perfectly evenly
  const sm = (a: number, b: number, x: number) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const partsOf = (n: number, edge: number) => {
    const cuts = Array.from({ length: n }, () => R() * TAU).sort((a, b) => a - b);
    const what = cuts.map(() => [R(), R()]); // when, how big: part k is from cut k round to the next
    return (turn: number) => {
      let k = n - 1;
      for (let i = 0; i < n; i++) if (cuts[i] <= turn) k = i;
      const from = (turn - cuts[k] + TAU) % TAU,
        to = (cuts[(k + 1) % n] - turn + TAU) % TAU;
      const other = what[(from < to ? k + n - 1 : k + 1) % n];
      const own = 0.5 + 0.5 * sm(0, edge, Math.min(from, to));
      return what[k].map((v, i) => v * own + other[i] * (1 - own));
    };
  };
  const bigPart = partsOf(5, 0.22),
    smallPart = partsOf(11, 0.1);
  const stipes = Array.from({ length: o.most }, (_, i) => {
    const turn = ((0.5 + i * 0.7548776662) % 1) * TAU;
    const v = (0.5 + i * 0.569840291) % 1;
    const inSkin = v < o.skin;
    const far = inSkin ? 1 - 0.1 * Math.pow(v / o.skin, 1.5) : 0.12 + 0.72 * Math.sqrt((v - o.skin) / (1 - o.skin));
    // Its goings: one a loop with its big part, two with its small part (those inside the body at another time
    // than the skin over them), three of its own. How big each is, as how nearly it stops the head between
    // goings: together never more than 0.66, which with the gusts and the panel's most is still under 1, and at 1
    // a head would go backwards
    const [when1, size1] = bigPart(turn),
      [when2, size2] = smallPart(turn);
    const stop1 = (0.16 + 0.24 * size1) * (0.85 + 0.15 * R()),
      stop2 = (0.05 + 0.12 * size2) * (0.8 + 0.2 * R()),
      stop3 = 0.03 + 0.06 * R();
    return {
      inSkin,
      turn,
      // where round the body, how far out (1 the skin), how far ahead of the rest it runs (loops), its own number
      sa: [turn, far, (R() - 0.5) * 0.09 + o.dome * (0.5 - far * far), R()],
      // its wander round the body: how far, how many times a loop, where it begins; and how thick it is
      sb: [(0.03 + 0.05 * R()) / (o.wide * Math.max(far, 0.25)), (1 + Math.floor(R() * 5)) * (R() < 0.5 ? -1 : 1), R() * TAU, 0.75 + 0.5 * R()],
      // its wander out and in, the same
      sc: [0.03 + 0.05 * R(), 2 + Math.floor(R() * 5), R() * TAU, 0],
      // its goings: how far the one a loop and when, how far the two a loop and when; and the three a loop
      sd: [stop1, when1 + (R() - 0.5) * 0.08, stop2 / 2, when2 + (R() - 0.5) * 0.12 + (inSkin ? 0 : 0.37)],
      se: [stop3 / 3, R(), 0, 0],
    };
  });
  const inSkin = stipes.reduce((n, st) => n + (st.inSkin ? 1 : 0), 0);
  // WebGPU takes eight vertex buffers, so what an instance is told goes in one buffer, side by side
  const strideOf = (parts: [string, number][]) => parts.reduce((n, [, size]) => n + size, 0);
  const tell = (g: InstancedBufferGeometry, buffer: InstancedInterleavedBuffer, parts: [string, number][]) => {
    let at = 0;
    for (const [name, size] of parts) {
      g.setAttribute(name, new InterleavedBufferAttribute(buffer, size, at));
      at += size;
    }
  };
  const perInstance = (g: InstancedBufferGeometry, rows: number[][], parts: [string, number][]) => {
    const stride = strideOf(parts);
    const data = new Float32Array(rows.length * stride);
    for (const [k, row] of rows.entries()) data.set(row, k * stride);
    tell(g, new InstancedInterleavedBuffer(data, stride), parts);
  };
  const stipeParts: [string, number][] = [
    ["sa", 4],
    ["sb", 4],
    ["sc", 4],
    ["sd", 4],
    ["se", 4],
  ];
  const stipeRow = (i: number) => [...stipes[i].sa, ...stipes[i].sb, ...stipes[i].sc, ...stipes[i].sd, ...stipes[i].se];
  const sa = attribute("sa", "vec4") as V4,
    sb = attribute("sb", "vec4") as V4,
    sc = attribute("sc", "vec4") as V4,
    sd = attribute("sd", "vec4") as V4,
    se = attribute("se", "vec4") as V4;

  // A going: for most of a loop the head falls behind the loop's phase as fast as that goes on, which is to stand
  // still; in the rest (`RISE` of it) it makes all of that up. So a part of the front is left behind, and then
  // comes on through the others. Its slope is never under -1, and it is nothing on average
  const RISE = 0.4;
  const lunge = (y: N) => {
    const x = fract(y).toVar();
    const u = x.div(RISE).min(1).toVar();
    return u
      .sub(sin(u.mul(TAU)).div(TAU))
      .sub(x)
      .sub((1 - RISE) / 2);
  };
  const lungeOf = (y: number) => {
    const x = y - Math.floor(y);
    const u = Math.min(1, x / RISE);
    return u - Math.sin(u * TAU) / TAU - x - (1 - RISE) / 2;
  };
  // day 4's ease less its own straight line: 2x³ - 3x² + x, the same every loop; its slope is never under -1/2
  const ease = (y: N) => {
    const x = fract(y).toVar();
    return x.mul(x).mul(x).mul(2).sub(x.mul(x).mul(3)).add(x);
  };
  const easeOf = (y: number) => {
    const x = y - Math.floor(y);
    return 2 * x * x * x - 3 * x * x + x;
  };
  // the whole front's surges, gentler: how big, how many a loop, when
  const GUSTS = [
    [0.25, 1, 0.13],
    [0.15, 2, 0.61],
  ];
  // how far ahead of the loop's phase a head is at a time
  const ahead = (t: N) => {
    let far = lunge(t.add(sd.y))
      .mul(sd.x)
      .add(lunge(t.mul(2).add(sd.w)).mul(sd.z))
      .add(lunge(t.mul(3).add(se.y)).mul(se.x))
      .mul(U.surge) as N;
    for (const [size, n, when] of GUSTS) far = far.add(ease(t.mul(n).add(when)).mul(U.gust.mul(size / n)));
    return far;
  };
  // where a shoot has got to, in loops
  const head = () => U.phase.add(ahead(U.phase)).add(sa.z);
  // And the other way about: when its head was at a place. That has no inverse to write down, so it is found (by
  // halving: the head never goes back, so there is one answer), and not by the vertex shader: a head is at a
  // frond's place at the same moment of every loop, so that moment is one number a frond, found here. It is found
  // again when `surge` or `gust` change (`pace`)
  const wasThere = (at: number, shoot: number) => {
    const [, , lead] = stipes[shoot].sa,
      [far1, when1, far2, when2] = stipes[shoot].sd,
      [far3, when3] = stipes[shoot].se;
    const surge_ = U.surge.value,
      gust = U.gust.value;
    let lo = at - lead - 0.5,
      hi = at - lead + 0.5;
    for (let i = 0; i < 27; i++) {
      const t = (lo + hi) / 2;
      let far = surge_ * (far1 * lungeOf(t + when1) + far2 * lungeOf(2 * t + when2) + far3 * lungeOf(3 * t + when3));
      for (const [size, n, at_] of GUSTS) far += ((gust * size) / n) * easeOf(t * n + at_);
      if (t + far + lead < at) lo = t;
      else hi = t;
    }
    return (lo + hi) / 2;
  };

  // ---- the body's skin: how far from the spine it is, for every way round (across the texture) and every place
  // in the loop (up it), with how that changes each way, for the skin's outward. It is a lumpy tube, and once a
  // loop a rounded cube that the tube goes through from corner to corner: so set, no face of the cube is square
  // to the tube, and its skin is still one distance for each way round and place along
  const TW = 256,
    TH = 512;
  const skinData = new Uint16Array(TW * TH * 4);
  const skinMap = new DataTexture(skinData, TW, TH, RGBAFormat, HalfFloatType);
  skinMap.wrapS = skinMap.wrapT = RepeatWrapping;
  skinMap.minFilter = skinMap.magFilter = LinearFilter;
  const radius = new Float32Array(TW * TH),
    stretch = new Float32Array(TW * TH), // how much skin there is here for a step round and a step along
    ring = new Float32Array(TH), // the same, on average round the body at one place
    upTo = new Float32Array(TH + 1); // and how much of a loop's skin is before each place in it
  const figureAt = new Float32Array(TW * TH); // how far out the figure's skin is, 0 where there is none
  const bulk = new Float32Array(TW * TH); // the skin without anything sudden, and never inside it: for what keeps clear of the body
  const bulkData = new Uint16Array(TW * TH);
  const bulkMap = new DataTexture(bulkData, TW, TH, RedFormat, HalfFloatType);
  bulkMap.wrapS = bulkMap.wrapT = RepeatWrapping;
  bulkMap.minFilter = bulkMap.magFilter = LinearFilter;
  const calm = new Float32Array(TW * TH), // the skin without its small things, and never outside it: for what is inside the body
    spare = new Float32Array(TW * TH);
  const shape = { wide: o.wide, lumps: o.lumps, bends: o.bends, cube: o.cube, cubeRound: o.cubeRound, put: o.put, figure: o.figure, figureTurn: o.figureTurn, blend: o.blend, mesh: null as Mesh | null };
  // the further out of two skins, run together where they are within `k` of each other
  const joined = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
  };
  // every place's least (or its most), or its mean, over so many steps either way along the loop or round the body
  const over = (from: Float32Array, to: Float32Array, half: number, alongLoop: boolean, least: boolean, most = false) => {
    for (let j = 0; j < TH; j++)
      for (let i = 0; i < TW; i++) {
        let got = most ? -Infinity : least ? Infinity : 0;
        for (let d = -half; d <= half; d++) {
          const v = alongLoop ? from[((j + d + TH) % TH) * TW + i] : from[j * TW + ((i + d + TW) % TW)];
          got = most ? Math.max(got, v) : least ? Math.min(got, v) : got + v;
        }
        to[j * TW + i] = most || least ? got : got / (2 * half + 1);
      }
  };
  const spineAt = (at: number) => {
    const a = at * TAU;
    return [shape.bends * (0.17 * Math.sin(a + 0.7) + 0.07 * Math.sin(2 * a + 2.9)), shape.bends * (0.1 * Math.sin(a + 3.9) + 0.04 * Math.sin(3 * a + 5.1))];
  };
  // A figure in the tube: any closed mesh, stood upright in the picture as it was made (its +z to the eye), the
  // tube going through it on the slant. Its skin as the tube has it is the furthest of it from the spine each way,
  // so a hollow that cannot be seen from the spine is filled; found a slice of the loop at a time, each triangle
  // cut by the slice into a line, and that line seen from the spine
  const bakeFigure = (mesh: Mesh, size: number, where: number) => {
    figureAt.fill(0);
    const P = mesh.position,
      I = mesh.index;
    const pts = new Float32Array(P.length);
    const turn = (shape.figureTurn * Math.PI) / 180,
      ct = Math.cos(turn),
      st = Math.sin(turn);
    for (let v = 0; v < P.length; v += 3) {
      const x = P[v] * ct + P[v + 2] * st,
        y = P[v + 1],
        z = P[v + 2] * ct - P[v] * st;
      pts[v] = (x * across.x + y * across.y + z * across.z) * size;
      pts[v + 1] = (x * depth.x + y * depth.y + z * depth.z) * size;
      pts[v + 2] = (x * axis.x + y * axis.y + z * axis.z) * size;
    }
    const middle = spineAt(where);
    const cut = [0, 0, 0, 0];
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t] * 3,
        b = I[t + 1] * 3,
        c = I[t + 2] * 3;
      const low = Math.min(pts[a + 2], pts[b + 2], pts[c + 2]),
        high = Math.max(pts[a + 2], pts[b + 2], pts[c + 2]);
      for (let row = Math.ceil((where + low / o.pitch) * TH); row <= Math.floor((where + high / o.pitch) * TH); row++) {
        const z = (row / TH - where) * o.pitch;
        // where the slice cuts the triangle's edges: two places
        let n = 0;
        for (const [e, f] of [
          [a, b],
          [b, c],
          [c, a],
        ]) {
          const ze = pts[e + 2] - z,
            zf = pts[f + 2] - z;
          if (ze >= 0 === zf >= 0 || n > 1) continue;
          const k = ze / (ze - zf);
          cut[n * 2] = pts[e] + (pts[f] - pts[e]) * k;
          cut[n * 2 + 1] = pts[e + 1] + (pts[f + 1] - pts[e + 1]) * k;
          n++;
        }
        if (n < 2) continue;
        // as the spine sees them, from where it really is in this slice
        const sp = spineAt(row / TH);
        const px = cut[0] - (sp[0] - middle[0]),
          py = cut[1] - (sp[1] - middle[1]),
          qx = cut[2] - (sp[0] - middle[0]),
          qy = cut[3] - (sp[1] - middle[1]);
        const from = Math.atan2(py, px);
        let turn = Math.atan2(qy, qx) - from;
        if (turn > Math.PI) turn -= TAU;
        if (turn < -Math.PI) turn += TAU;
        if (Math.abs(turn) > 3.1) continue;
        const j = ((row % TH) + TH) % TH;
        const first = Math.ceil((Math.min(from, from + turn) / TAU) * TW - 0.01),
          last = Math.floor((Math.max(from, from + turn) / TAU) * TW + 0.01);
        for (let col = first; col <= last; col++) {
          const th = (col / TW) * TAU,
            cs = Math.cos(th),
            sn = Math.sin(th);
          const under = cs * (qy - py) - sn * (qx - px);
          if (Math.abs(under) < 1e-9) continue;
          const far = (px * (qy - py) - py * (qx - px)) / under;
          const k = j * TW + (((col % TW) + TW) % TW);
          if (far > figureAt[k]) figureAt[k] = far;
        }
      }
    }
  };
  const things: Thing[] = [];
  const offAt = (at: number) => {
    const [x, y] = spineAt(at);
    return across.clone().multiplyScalar(x).addScaledVector(depth, y);
  };
  const bake = () => {
    const withCube = (shape.put === "cube" || shape.put === "both") && shape.cube > 0,
      withFigure = (shape.put === "figure" || shape.put === "both") && shape.mesh !== null && shape.figure > 0;
    // both in one loop: each a little smaller, a third of the loop from the middle either way
    const both = withCube && withFigure;
    const cubeAt = both ? o.cubeAt - 0.27 : o.cubeAt,
      figAt = both ? o.cubeAt + 0.23 : o.cubeAt;
    if (withFigure) bakeFigure(shape.mesh!, shape.figure * (both ? 0.82 : 1), figAt);
    else figureAt.fill(0);
    // the tube is thinner where the figure is, or it would fill the hollows of a face
    const thin = new Float32Array(TH);
    if (withFigure) {
      const has = new Float32Array(TH);
      for (let j = 0; j < TH; j++) for (let i = 0; i < TW; i += 8) if (figureAt[j * TW + i] > 0) has[j] = 1;
      for (let j = 0; j < TH; j++) {
        let sum = 0;
        for (let d = -14; d <= 14; d++) sum += has[(j + d + TH) % TH];
        thin[j] = (sum / 29) * 0.5;
      }
    }
    const h = withCube ? shape.cube * (both ? 0.8 : 1) : 0,
      soft = Math.min(shape.cubeRound, h);
    // the cube's three axes, as (across, depth, along the tube): its long diagonal lies along the tube
    const axes = [0, 1, 2].map((k) => {
      const turn = o.cubeRoll + (k * TAU) / 3;
      return [Math.sqrt(2 / 3) * Math.cos(turn), Math.sqrt(2 / 3) * Math.sin(turn), Math.sqrt(1 / 3)];
    });
    const inCube = (x: number, y: number, z: number) => {
      let out = 0,
        most = -Infinity;
      for (const u of axes) {
        const q = Math.abs(x * u[0] + y * u[1] + z * u[2]) - (h - soft);
        if (q > 0) out += q * q;
        most = Math.max(most, q);
      }
      return Math.sqrt(out) + Math.min(most, 0) - soft;
    };
    things.length = 0;
    if (withCube) things.push({ kind: "cube", at: cubeAt, off: offAt(cubeAt), half: h, round: soft, axes: axes.map((u) => across.clone().multiplyScalar(u[0]).addScaledVector(depth, u[1]).addScaledVector(axis, u[2])), size: 0, turn: 0 });
    if (withFigure) things.push({ kind: "figure", at: figAt, off: offAt(figAt), half: 0, round: 0, axes: [], size: shape.figure * (both ? 0.82 : 1), turn: shape.figureTurn });
    const middle = spineAt(cubeAt);
    for (let j = 0; j < TH; j++) {
      const at = j / TH;
      const sp = spineAt(at);
      // the cube keeps its shape where the spine bends: it is measured from where the spine really is
      const ox = sp[0] - middle[0],
        oy = sp[1] - middle[1],
        oz = (((at - cubeAt + 2.5) % 1) - 0.5) * o.pitch;
      for (let i = 0; i < TW; i++) {
        const th = (i / TW) * TAU,
          c = Math.cos(th),
          sn = Math.sin(th);
        let tube = 1;
        for (const [a, m, p, n, q] of LUMPS) tube += shape.lumps * a * Math.sin(th * m + p) * Math.sin(at * n * TAU + q);
        tube *= shape.wide * (1 - thin[j]);
        let box = 0;
        if (h > 0 && inCube(ox, oy, oz) < 0) {
          let lo = 0,
            hi = 2 * h + 1;
          for (let k = 0; k < 22; k++) {
            const mid = (lo + hi) / 2;
            if (inCube(ox + c * mid, oy + sn * mid, oz) < 0) lo = mid;
            else hi = mid;
          }
          box = lo;
        }
        // whichever is further out, with a small fillet where the cube meets the tube
        radius[j * TW + i] = box > 0 ? joined(tube, box, 0.07) : tube;
      }
    }
    // The figure comes out of the tube as softly as is asked. Where their skins cross, the further out with the
    // two run together; but much of a figure stands straight out of the tube (under a chin there is no figure,
    // and then all of it), and running together does nothing for a step. So the tube swells towards a figure that
    // is near along it: by what the figure stands out (no more than twice `blend`: the foot of the step, not
    // an ear), less with the square of how far off it is, to nothing at twice `blend` away
    if (withFigure) {
      const soft = Math.max(shape.blend, 1e-3);
      const reach = Math.max(1, Math.round(((2 * soft) / o.pitch) * TH));
      for (let j = 0; j < TH; j++)
        for (let i = 0; i < TW; i++) {
          const tube = radius[j * TW + i];
          let swell = 0;
          for (let d = -reach; d <= reach; d++) {
            const out = figureAt[((j + d + TH) % TH) * TW + i] - tube;
            if (out > swell) swell = Math.max(swell, Math.min(out, 2 * soft) * (1 - Math.abs(d) / reach) ** 2);
          }
          const fig = figureAt[j * TW + i];
          spare[j * TW + i] = fig > 0 ? joined(tube + swell, fig, soft) : tube + swell;
        }
      radius.set(spare);
    }
    // What is inside the body is put by a skin with nothing small in it: an ear is a cliff in the real one, and a
    // shoot that is half way out to the skin would have half a cliff in it. The least of the skin round about,
    // then smoothed over no more than that, so that it is never outside the real one
    over(radius, spare, 20, true, true);
    over(spare, calm, 6, false, true);
    over(calm, spare, 10, true, false);
    over(spare, calm, 10, true, false);
    over(calm, spare, 3, false, false);
    over(spare, calm, 3, false, false);
    // And what swims round the body keeps clear of a skin with nothing sudden in it: a chin is a cliff in the real
    // one, and a fish that kept its distance from that was thrown out and let back in a frame. The most of the
    // skin round about, then smoothed over no more than that, so that it is never inside the real one
    over(radius, spare, 28, true, false, true);
    over(spare, bulk, 8, false, false, true);
    over(bulk, spare, 14, true, false);
    over(spare, bulk, 14, true, false);
    over(bulk, spare, 4, false, false);
    over(spare, bulk, 4, false, false);
    for (let k = 0; k < TW * TH; k++) bulkData[k] = DataUtils.toHalfFloat(bulk[k]);
    bulkMap.needsUpdate = true;
    for (let j = 0; j < TH; j++) {
      let sum = 0;
      for (let i = 0; i < TW; i++) {
        const k = j * TW + i;
        const r = radius[k];
        const round_ = (radius[j * TW + ((i + 1) % TW)] - radius[j * TW + ((i + TW - 1) % TW)]) / ((2 * TAU) / TW);
        const along = (radius[((j + 1) % TH) * TW + i] - radius[((j + TH - 1) % TH) * TW + i]) / (2 / TH);
        stretch[k] = r * Math.sqrt(1 + (along / o.pitch) ** 2 + (round_ / r) ** 2);
        sum += stretch[k];
        skinData[k * 4] = DataUtils.toHalfFloat(r);
        skinData[k * 4 + 1] = DataUtils.toHalfFloat(round_);
        skinData[k * 4 + 2] = DataUtils.toHalfFloat(along);
        skinData[k * 4 + 3] = DataUtils.toHalfFloat(calm[k]);
      }
      ring[j] = sum / TW;
      upTo[j + 1] = upTo[j] + sum;
    }
    for (let j = 0; j <= TH; j++) upTo[j] /= upTo[TH];
    skinMap.needsUpdate = true;
    U.bends.value = shape.bends;
  };
  bake();
  // Where there is more skin there must be more fronds, or the cube would be thinly covered. Along the loop that
  // is done by where the fronds are put: `spread` takes an even 0..1 to a place, more of them where there is more
  // skin. Round the body it cannot be (shoots are evenly spaced round it), so a frond far out is made bigger
  const spread = (even: number) => {
    let lo = 0,
      hi = TH;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (upTo[mid] <= even) lo = mid;
      else hi = mid;
    }
    return (lo + (even - upTo[lo]) / Math.max(upTo[hi] - upTo[lo], 1e-9)) / TH;
  };
  const bigger = (turn: number, place: number) => {
    const i = ((Math.round((turn / TAU) * TW) % TW) + TW) % TW,
      j = Math.min(TH - 1, Math.floor(place * TH));
    return Math.min(1.4, Math.max(0.85, Math.sqrt(stretch[j * TW + i] / ring[j])));
  };

  // ---- the body. Where a shoot is when it is `at` loops along, in still water, and the skin's outward there.
  // `round`, `out`: a frond's own step aside from its shoot
  // the skin as it was baked: how far out, how that changes round and along, and the calm one
  const skinAt = (th: N, at: N) => texture(skinMap, vec2(th.div(TAU).add(0.5 / TW), at.add(0.5 / TH))).level(float(0));
  // and how far out to keep, to be clear of it
  const bulkAt = (th: N, at: N) =>
    texture(bulkMap, vec2(th.div(TAU).add(0.5 / TW), at.add(0.5 / TH)))
      .level(float(0))
      .x.toFloat() as N;
  // how far off the axis the spine is at a place in the loop (`spineAt`, for the shader)
  const spine = (at: N) => {
    const a = at.mul(TAU);
    return U.across
      .mul(
        sin(a.add(0.7))
          .mul(0.17)
          .add(sin(a.mul(2).add(2.9)).mul(0.07)),
      )
      .add(
        U.depth.mul(
          sin(a.add(3.9))
            .mul(0.1)
            .add(sin(a.mul(3).add(5.1)).mul(0.04)),
        ),
      )
      .mul(U.bends);
  };
  const placed = (at: N, age: N, round?: N, out?: N) => {
    let th = sa.x.add(sb.x.mul(sin(at.mul(sb.y).mul(TAU).add(sb.z)))) as N;
    let far = sa.y.mul(sc.x.mul(sin(at.mul(sc.y).mul(TAU).add(sc.z))).add(1)) as N;
    if (round) th = th.add(round);
    if (out) far = far.add(out);
    th = th.toVar();
    const skin = skinAt(th, at).toVar();
    // (a shoot of the skin is no further in than 0.9, one inside the body no further out than 0.84)
    const r = mix(skin.w, skin.x, smoothstep(0.84, 0.9, far)),
      dth = skin.y,
      ds = skin.z;
    const er = U.across.mul(cos(th)).add(U.depth.mul(sin(th))).toVar();
    const et = U.depth.mul(cos(th)).sub(U.across.mul(sin(th)));
    const still = U.axis
      .mul(at.sub(U.phase).mul(U.pitch))
      .add(spine(at))
      .add(er.mul(r.mul(far)));
    // the skin's outward: away from the spine, tipped by the lumps' slopes; and at the front it faces the way of growth
    const N_ = normalize(
      er
        .sub(et.mul(dth.div(r)))
        .sub(U.axis.mul(ds.div(U.pitch)))
        .add(U.axis.mul(exp(age.mul(-9)).mul(0.9))),
    );
    return { still, N: N_ };
  };
  // ---- the water's push (weed.ts'): it comes down the current in waves long against the body, so that rides
  // them nearly whole; thin and young things get a finer shiver on top
  const pushAt = (p: V3) => {
    const along = dot(p, U.flow);
    const a = sin(along.mul(1.1).sub(tau.mul(2)).add(p.y.mul(0.7)));
    const b = sin(along.mul(2.7).sub(tau.mul(5)).add(p.z.mul(1.9)).add(1.3));
    return a.mul(0.45).add(b.mul(0.2)).add(0.55);
  };
  const lean = (p: V3, loose: N) => {
    const along = dot(p, U.flow);
    const push = pushAt(p);
    const c = sin(p.y.mul(2.3).add(along.mul(0.9)).sub(tau.mul(3)).add(0.7));
    const d = sin(along.mul(7).sub(tau.mul(9)).add(p.y.mul(5)).add(p.z.mul(4)));
    const e = sin(p.x.mul(6).add(p.y.mul(8)).sub(tau.mul(7)).add(2));
    const big = U.flow
      .mul(push.mul(0.07))
      .add(U.side.mul(c.mul(0.03)))
      .add(vec3(0, push.mul(push).mul(-0.015), 0));
    const small = U.flow
      .mul(d.mul(0.014))
      .add(U.side.mul(e.mul(0.01)))
      .add(vec3(0, d.mul(e).mul(0.007), 0));
    return big.add(small.mul(loose)).mul(U.sway);
  };
  const looseOf = (age: N) => exp(age.mul(-4)).mul(0.8).add(0.2);
  // the middle of a shoot where it is `at` loops along and `age` loops old
  const middle = (at: N, age: N) => {
    const still = placed(at, age).still.toVar();
    return still.add(lean(still, looseOf(age)));
  };
  // and which way it runs there
  const runs = (at: N, age: N, here: V3) => normalize(middle(at.add(0.012), age.sub(0.012)).sub(here));
  // a shoot thickens as it ages, from nothing at its head
  const girth = (age: N) =>
    smoothstep(0, 0.04, age)
      .mul(0.45)
      .add(smoothstep(0.03, 1.4, age).mul(0.55))
      .mul(o.thick)
      .mul(sb.w);

  // ---- shoots: a thin tube back from each head. Behind the front the fronds hide them.
  // Its rings are not so far behind its head each: they are at places on the plant, `GRID` of them a loop, and
  // stay there, and only the first is the head. A ring that kept its distance from the head would slide along the
  // skin as the head went on, and where the skin is not smooth (a figure's ear) the shoot, a line from ring to
  // ring, would cut each corner differently every frame: which was seen, as a tremor
  const stipe = (() => {
    const GRID = 48,
      RINGS = LAPS * GRID + 2,
      SIDES = 5;
    const position = new Float32Array(RINGS * SIDES * 3);
    const index = new Uint16Array((RINGS - 1) * SIDES * 6);
    for (let j = 0, v = 0; j < RINGS; j++) for (let k = 0; k < SIDES; k++, v++) position.set([j, (k / SIDES) * TAU, 0], v * 3); // which ring, round
    for (let j = 0, t = 0; j < RINGS - 1; j++)
      for (let k = 0; k < SIDES; k++, t += 6) {
        const a = j * SIDES + k,
          b = j * SIDES + ((k + 1) % SIDES);
        index.set([a, b, a + SIDES, b, b + SIDES, a + SIDES], t);
      }
    const geometry = new InstancedBufferGeometry();
    geometry.instanceCount = Math.min(o.count, o.most);
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setIndex(new BufferAttribute(index, 1));
    perInstance(
      geometry,
      stipes.map((_, i) => stipeRow(i)),
      stipeParts,
    );
    const normal = varyingProperty("vec3", "stipeNormal") as V3;
    const aged = varyingProperty("float", "stipeAge") as N;
    const position_ = (withNormal: boolean) =>
      Fn(() => {
        const round = positionGeometry.y;
        // the first ring is the head, the last is as far back as shoots are drawn, the rest are on the grid
        const got = head().toVar();
        const at = floor(got.mul(GRID)).add(1).sub(positionGeometry.x).div(GRID).clamp(got.sub(LAPS), got).toVar();
        const age = got.sub(at).toVar();
        if (withNormal) aged.assign(age);
        const centre = middle(at, age).toVar();
        const way = runs(at, age, centre);
        const e1 = normalize(cross(way, U.depth)),
          e2 = cross(way, e1);
        const out = e1.mul(cos(round)).add(e2.mul(sin(round)));
        if (withNormal) normal.assign(out);
        return centre.add(out.mul(girth(age)));
      })();
    const drawn: SolidIn = { along: aged.mul(40), round: positionGeometry.y.div(TAU), seed: sa.w, bulb: float(0), at: vec3(cos(positionGeometry.y).mul(2.5), sin(positionGeometry.y).mul(2.5), aged.mul(30)).add(sa.w.mul(40)) };
    return { geometry, position: position_, normal, drawn };
  })();

  // ---- fronds
  const blade = (() => {
    // a strip of quads, u along 0..1 and v across -1..1
    const ribbon = (nu: number, nv: number) => {
      const position = new Float32Array((nu + 1) * (nv + 1) * 3);
      const index = new Uint16Array(nu * nv * 6);
      for (let j = 0, v = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, v++) position.set([i / nu, (j / nv) * 2 - 1, 0], v * 3);
      for (let j = 0, t = 0; j < nv; j++)
        for (let i = 0; i < nu; i++, t += 6) {
          const a = j * (nu + 1) + i;
          index.set([a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1], t);
        }
      return { position, index };
    };
    const PER = o.mostPerLoop;
    const GOLD = 0.6180339887;
    // by the golden ratio: the first so many of a shoot's fronds are spread evenly round the loop
    const turnOf = Array.from({ length: PER }, (_, m) => m)
      .sort((a, b) => ((a * GOLD) % 1) - ((b * GOLD) % 1))
      .reduce((turn, m, k) => ((turn[m] = k), turn), new Array<number>(PER));
    // the side the current leaves by, as seen from the spine
    const lee = flow.clone().addScaledVector(axis, -flow.dot(axis)).normalize();
    const leeA = lee.dot(across),
      leeD = lee.dot(depth);
    // b0: its place in the loop, its lap, its turn to be shown (0 first), its own number
    // b1: length, half width, how free it is (0 lies on the skin .. 1 goes with the current), its age for the colour
    // b2: its step aside from its shoot, round the body and out; how far it lifts off the skin; 1 if it is inside
    const rows: [number[][], number[][]] = [[], []]; // short ones, streamers
    const whose: [number[], number[]] = [[], []]; // which shoot each is on
    const plain: [number[], number[]] = [[], []]; // and, before the skin's shape has its say: its even place, where round, length, half width
    let freed = 0,
      inside = 0;
    for (let i = 0; i < o.most; i++) {
      const st = stipes[i];
      const first = Math.floor(R() * PER); // not the same places on every shoot
      for (let m = 0; m < PER; m++) {
        // a frond is the same frond on every lap
        const even = (m + 0.15 + 0.7 * R()) / PER;
        const place = spread(even);
        const seed = R();
        // off its shoot, so that fronds do not stand in rows
        const round = st.inSkin ? ((R() - 0.5) * TAU * 1.8) / inSkin : (R() - 0.5) * 0.6;
        const out = st.inSkin ? (R() - 0.5) * 0.05 : (R() - 0.5) * 0.14;
        const th = st.turn + round;
        const down = Math.cos(th) * leeA + Math.sin(th) * leeD;
        const ragged = 0.5 * Math.sin(th * 2 + place * TAU * 2 + 1) * Math.sin(place * TAU * 3 + 2) + 0.3 * Math.sin(th * 3 - place * TAU * 5);
        const lets = sm(o.hold, o.gone, down + 0.45 * ragged);
        const skip = R() < lets * o.thin;
        let free: number, long: number;
        if (st.inSkin) {
          free = lets;
          long = 0.05 + 0.06 * R() + free * (0.05 + 0.05 * R()) + free * free * o.tail * (0.3 + R() * R());
          if (free < 0.3 && R() < o.stray) {
            long = 0.18 + 0.25 * R();
            free = 0.35 + 0.3 * R();
          }
        } else {
          free = Math.max(0.6 + 0.25 * R(), lets);
          long = 0.07 + 0.09 * R() + lets * lets * o.tail * (0.3 + R() * R());
        }
        const half = Math.min(long * 0.3, 0.011 + 0.012 * R());
        const lift = 0.03 + 0.3 * R() * R();
        const old = -30 + 32 * Math.pow(R(), 1.6);
        if (skip) continue;
        if (free > 0.5 && st.inSkin) freed++;
        if (!st.inSkin) inside++;
        const which = long > LONG ? 1 : 0;
        for (let lap = 0; lap < LAPS; lap++) {
          rows[which].push([...stipeRow(i), place, lap, turnOf[(m + first) % PER], seed, long, half, free, old, round, out, lift, st.inSkin ? 0 : 1]);
          whose[which].push(i);
          plain[which].push(even, th, long, half);
        }
      }
    }
    // Each kind of frond is two meshes off one buffer: one for the picture, and one of very few quads for the sun
    // map, which is drawn three times and in which a frond is a few texels. Only the fronds that are shown are in
    // the buffer (`show` packs it), so that the ones that are not cost nothing
    const parts: [string, number][] = [...stipeParts, ["b0", 4], ["b1", 4], ["b2", 4]];
    const stride = strideOf(parts);
    const TURN = strideOf(stipeParts) + 2; // where in a row its turn is
    const sets = [0, 1].map((which) => {
      const all = new Float32Array(rows[which].length * stride);
      for (const [k, row] of rows[which].entries()) all.set(row, k * stride);
      const buffer = new InstancedInterleavedBuffer(new Float32Array(all.length), stride);
      const make = ([nu, nv]: [number, number]) => {
        const { position, index } = ribbon(nu, nv);
        const geometry = new InstancedBufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(position, 3));
        geometry.setIndex(new BufferAttribute(index, 1));
        tell(geometry, buffer, parts);
        return geometry;
      };
      return { all, whose: whose[which], plain: plain[which], buffer, seen: make(which ? o.longQuads : o.quads), shadow: make(which ? [6, 1] : [3, 1]) };
    });
    rows[0].length = rows[1].length = 0;
    // the skin has a shape (or a new one): every frond to its place on it, and its size there
    const PLACE = strideOf(stipeParts),
      SIZE = PLACE + 4,
      BORN = 11; // the last of `sc`
    const settle = () => {
      for (const { all, plain, whose } of sets)
        for (let r = 0, born = 0; r * stride < all.length; r++) {
          const place = spread(plain[r * 4]);
          const k = bigger(plain[r * 4 + 1], place);
          all[r * stride + PLACE] = place;
          // (a frond's laps are rows next to each other, and were born at the same moment of the loop)
          if (r % LAPS === 0) born = wasThere(place, whose[r]);
          all[r * stride + BORN] = born;
          all[r * stride + SIZE] = plain[r * 4 + 2] * k;
          all[r * stride + SIZE + 1] = plain[r * 4 + 3] * k;
        }
    };
    settle();
    // the fronds of the first `n` shoots whose turn is before `leaves`; how many that is
    const pack = (n: number, leaves: number) => {
      let shown = 0;
      for (const set of sets) {
        const { all, whose, buffer } = set;
        const out = buffer.array as Float32Array;
        let k = 0;
        for (let r = 0; r < whose.length && whose[r] < n; r++) {
          if (all[r * stride + TURN] >= leaves) continue;
          out.set(all.subarray(r * stride, (r + 1) * stride), k * stride);
          k++;
        }
        buffer.needsUpdate = true;
        set.seen.instanceCount = set.shadow.instanceCount = k;
        shown += k;
      }
      return shown;
    };
    const geometries = sets.map((set) => set.seen),
      shadows = sets.map((set) => set.shadow);
    const a0 = attribute("b0", "vec4") as V4,
      a1 = attribute("b1", "vec4") as V4,
      a2 = attribute("b2", "vec4") as V4;
    // how old it is, in loops: where the head is past its place, and its lap
    const ageOf = () => fract(head().sub(a0.x)).add(a0.y);
    // when it was born, this lap: `wasThere` of its place (kept where a shoot's row has a number to spare), and
    // a whole loop for every time the head has passed it since
    const born = sc.w;
    // How long it has lived, which is not how far behind the head it is: a head that stands leaves its fronds to
    // grow. But a head that has rushed on would leave a long bare shoot behind it, so half of what it is ahead by
    // counts as time lived too. (That falls as the head stands again, half as fast as the time goes on at most,
    // so a frond never grows backwards)
    const livedAt = (got: N) => {
      const time = U.phase.sub(born.add(floor(got.sub(a0.x))).sub(a0.y)).toVar();
      const far = fract(got.sub(a0.x)).add(a0.y);
      return time.add(far.sub(time).max(0).mul(0.5)).max(0);
    };
    const livedOf = () => livedAt(head().toVar());
    // a ribbon: soon as wide as it gets, a long taper to the tip, never quite nothing
    const outline = (u: N) =>
      pow(max(sin(pow(u, 0.5).mul(Math.PI)), 0), 0.5)
        .mul(0.97)
        .add(0.03);
    const normal = varyingProperty("vec3", "bladeNormal") as V3;
    const position_ = (withNormal: boolean) =>
      Fn(() => {
        const seed = a0.w,
          free = a1.z,
          kind = a2.w;
        const got = head().toVar();
        const age = fract(got.sub(a0.x)).add(a0.y).toVar();
        const at = got.sub(age).toVar();
        const lived = livedAt(got).toVar();
        // a bud, then it opens and grows, a long one for longer; at the far end of what is drawn it dwindles, so
        // that none is seen to go. One whose turn has not come is nothing at all, and the last let in is part
        // grown, so that the panel does not pop
        const takes = a1.x.mul(1.1).add(0.1).mul(U.ripe).toVar();
        const open = smoothstep(0, takes.mul(0.7), lived).toVar();
        const grown = smoothstep(0, takes, lived)
          .mul(smoothstep(LAPS, LAPS - 0.3, age))
          .mul(U.leaves.sub(a0.z).saturate())
          .toVar();
        // (quickest at first: a head that is rushing on leaves less bare shoot behind it)
        const L = a1.x.mul(U.bladeLength).mul(pow(grown, 0.6)).toVar();
        // as wide as it will be long before it is as long: a young streamer is a short frond, not a hair
        const W = a1.y
          .mul(U.bladeWidth)
          .mul(grown.div(smoothstep(0, takes, lived).max(1e-4)))
          .mul(smoothstep(0, takes.mul(0.2).min(0.07), lived))
          .toVar();
        const where = placed(at, age, a2.x, a2.y);
        const root = where.still.toVar();
        const base = root.add(lean(root, looseOf(age))).toVar();
        const along = dot(root, U.flow);
        const push = pushAt(root).toVar();
        // whole numbers of turns in a loop, its own
        const n1 = floor(seed.mul(3)).add(3),
          n2 = floor(fract(seed.mul(13.7)).mul(3)).add(3),
          n3 = floor(fract(seed.mul(5.1)).mul(2)).add(2);
        const any1 = vec3(fract(seed.mul(17.1)), fract(seed.mul(29.3)), fract(seed.mul(41.7))).sub(0.5).toVar();
        const any2 = vec3(fract(seed.mul(53.9)), fract(seed.mul(71.3)), fract(seed.mul(97.1))).sub(0.5);
        // downstream as this frond finds it just now: up a little (weed floats), and wandering from side to side
        const F = normalize(
          U.flow
            .mul(push.mul(0.5).add(0.6))
            .add(vec3(0, 0.22, 0))
            .add(U.side.mul(sin(tau.mul(n3).add(along.mul(1.3)).add(seed.mul(30))).mul(0.3)))
            .add(any1.mul(0.7)),
        ).toVar();
        // the skin it lies on; inside the body there is none, and it faces as it likes
        const Nn = normalize(mix(where.N, normalize(any2.add(vec3(1e-3, 2e-3, 0))), kind)).toVar();
        // along the skin: back from the front, downstream, and as it likes; lifted off it a little
        const want = U.axis
          .mul(-0.5)
          .add(U.flow.mul(0.6))
          .add(any1.mul(mix(float(1.0), float(2.2), kind)));
        const lies = normalize(want.sub(Nn.mul(dot(want, Nn))).add(U.across.mul(1e-4)));
        const grain = normalize(lies.add(Nn.mul(a2.z)));
        // it sets out along its shoot as a bud, and its own way as it opens
        const T = normalize(mix(U.axis, grain, open.mul(0.94).add(0.06))).toVar();
        // what it is flat to: the skin where it lies on it; where it streams, whatever it likes
        const lie = seed.mul(TAU);
        const any = normalize(cross(F, U.side)).mul(cos(lie)).add(normalize(cross(F, vec3(0, 1, 0))).mul(sin(lie)));
        const flatTo = normalize(mix(Nn, any, free)).toVar();
        // how far it has turned downstream by u, and all of that up to u; one that holds the shape is combed a little too
        const comb = free.oneMinus().mul(U.stream).mul(push).mul(0.3).toVar();
        const turned = (u: N) => free.mul(float(1).sub(exp(u.mul(-4)))).add(comb.mul(u));
        const turnedUpTo = (u: N) =>
          free
            .mul(u.sub(float(1).sub(exp(u.mul(-4))).div(4)))
            .add(comb.mul(u).mul(u).mul(0.5));
        // waves run out along it, as long as the frond is free; never steeper than a ribbon will bend
        const waveLong = mix(float(0.15), float(0.36), free);
        const cycles = L.div(waveLong).mul(TAU).toVar();
        const high = mix(float(0.011), float(0.048), free).mul(U.flutter).mul(open).toVar();
        const curl = fract(seed.mul(7.3))
          .sub(0.25)
          .mul(0.3)
          .add(
            sin(tau.mul(n1).add(seed.mul(40)).sub(along.mul(3)))
              .mul(0.2)
              .mul(U.flutter),
          )
          // and all together as the push passes over them: the canopy opens and shuts, and the light inside with it
          .add(push.sub(0.45).mul(0.5).mul(U.breathe))
          .mul(free.oneMinus())
          .toVar();
        const twist = fract(seed.mul(3.3)).sub(0.5).mul(free.mul(2.5).add(1.2)).toVar();
        const cup = mix(float(2.6), U.cup, open).toVar();
        const at_ = (u: N, v: N) => {
          const w = turned(u),
            wAll = turnedUpTo(u);
          const way = normalize(mix(T, F, w));
          const side_ = normalize(cross(flatTo, way));
          const off = cross(way, side_);
          const reach = pow(u, 1.3);
          const wave = sin(u.mul(cycles).sub(tau.mul(n2)).add(seed.mul(90))).mul(reach).mul(high);
          const wave2 = sin(u.mul(cycles).mul(0.63).sub(tau.mul(n1)).add(seed.mul(53))).mul(reach).mul(high).mul(0.5);
          const mid = T.mul(u.sub(wAll))
            .add(F.mul(wAll))
            .mul(L)
            .add(off.mul(wave))
            .add(side_.mul(wave2))
            // a frond of the skin lifts off it towards its tip
            .add(Nn.mul(curl.mul(u).mul(u).mul(L)));
          const psi = u.mul(
            twist.add(
              sin(tau.mul(n3).add(seed.mul(70)).sub(u.mul(3)))
                .mul(0.45)
                .mul(U.flutter),
            ),
          );
          const Bu = side_.mul(cos(psi)).add(off.mul(sin(psi)));
          const Nw = off.mul(cos(psi)).sub(side_.mul(sin(psi)));
          // across: a hollow arc, rolled nearly shut in a bud; and its edges, which are longer than its middle, wave
          const wide = W.mul(outline(u));
          const x = wide.mul(sin(cup.mul(v))).div(cup);
          const z = wide.mul(float(1).sub(cos(cup.mul(v)))).div(cup);
          const ruffle = v
            .mul(abs(v))
            .mul(wide)
            .mul(0.3)
            .mul(sin(u.mul(cycles).mul(2.3).sub(tau.mul(n2)).add(v.mul(1.3)).add(seed.mul(50))))
            .mul(U.flutter);
          return base
            .add(mid)
            .add(Bu.mul(x))
            .add(Nw.mul(z.add(ruffle)));
        };
        const u = positionGeometry.x,
          v = positionGeometry.y;
        const here = at_(u, v).toVar();
        if (withNormal) {
          const e = 0.02;
          const own = normalize(cross(at_(u.add(e), v).sub(here), at_(u, v.add(e)).sub(here)).add(Nn.mul(1e-9)));
          // one that holds the shape is lit mostly as the skin under it: the leaves of a clipped hedge show its
          // shape, not their own. A free one is its own
          normal.assign(normalize(mix(own.mul(dot(own, Nn).sign()), Nn, U.smooth.mul(free.oneMinus()))));
        }
        return here;
      })();
    const u = positionGeometry.x as N,
      v = positionGeometry.y as N;
    // look.ts' ages run from -42 (newborn) to 12 (old): pale when it has just come, then its own. Found once a
    // vertex: left to the picture's pixels, each would look for when its head went by
    const old = varying(mix(float(-40), a1.w, smoothstep(0, 0.45, livedOf()))) as N;
    const drawn: BladeIn = { u, v, long: a1.x.mul(U.bladeLength), half: a1.y.mul(U.bladeWidth), edge: outline(u), age: old, seed: a0.w, veined: float(0.25) };
    // what a frond keeps of the sun, for the sun map: look.ts' own without its veins, which are smaller than a
    // texel there and cost a noise for every texel of every frond
    const keeps = float(0.91).mul(smoothstep(-28, 2, old).mul(skinU.aged).add(1).sub(skinU.aged.mul(0.5)));
    return { geometries, shadows, position: position_, normal, drawn, keeps, pack, settle, freed, inside };
  })();

  // how many shoots, and how many fronds a loop on each. The shoots are simply not drawn past that number; the
  // fronds are packed again, which is quick
  let shown = [-1, -1, 0];
  const show = (count: number, perLoop: number) => {
    const n = Math.max(1, Math.min(o.most, Math.round(count)));
    const leaves = Math.max(0, Math.min(o.mostPerLoop, perLoop));
    if (n !== shown[0] || leaves !== shown[1]) shown = [n, leaves, blade.pack(n, leaves)];
    stipe.geometry.instanceCount = n;
    U.leaves.value = leaves;
    return { stipes: n, blades: shown[2] };
  };
  show(o.count, o.perLoop);
  // how unevenly the heads go on, from the panel: every frond's birth is found again
  const pace = (surge_: number, gust: number) => {
    if (surge_ === U.surge.value && gust === U.gust.value) return;
    U.surge.value = surge_;
    U.gust.value = gust;
    blade.settle();
    const [n, leaves] = shown;
    shown = [-1, -1, 0];
    show(n, leaves);
  };
  // the body's shape, from the panel: any of `wide`, `lumps`, `bends`, `cube`, `cubeRound`, `put`, `figure`, `figureTurn`, `blend`, `mesh`
  const reshape = (to: Partial<typeof shape>) => {
    if ((Object.keys(to) as (keyof typeof shape)[]).every((k) => to[k] === undefined || to[k] === shape[k])) return false;
    Object.assign(shape, to);
    bake();
    blade.settle();
    const [n, leaves] = shown;
    shown = [-1, -1, 0];
    show(n, leaves);
    return true;
  };
  // `things`: what is in the tube now (a new list's worth after `reshape`); `skinAt`, `spine`, `sway`: the body
  // and the water's push for what else lives here (rock.ts, fish.ts)
  return { U, stipe, blade, show, reshape, pace, skinMap, skin: { radius, across: TW, along: TH }, things, skinAt, bulkAt, spine, sway: lean, axis, across, depth, flow, options: o };
}
