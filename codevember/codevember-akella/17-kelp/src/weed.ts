// The grown plant (grow.ts), drawn as seaweed. Nothing is moved on the CPU: each frond knows where it is rooted and
// how it lies, and its vertex shader puts it where it is now.
//
// A frond has one number that says how much it belongs to the shape: 0, it is short, lies along the shape's skin
// and is lit as that skin, so together they are the shape; 1, it is long, turns downstream within its first quarter
// and goes with the current. That number is low on the side the current comes from and high on the side it leaves
// by, so the head holds upstream and comes apart into streamers downstream.
//
// Of the branches that space colonization made, only the limbs are drawn: the rest is what the fronds hang from.
//
//   phase  the loop, for the water's push: every wave of it goes round a whole number of times.
//   grow   a growth clock, 0 nothing .. 1.4 all there (the page keeps it full; it is on the panel).
//   bent   one small vector for each frond: how far something has pushed its tip. It is the only thing the CPU
//          moves: `touch` is a hand in the weed, and each frond a spring under it (see there).
//
// The same position functions go to the sun map (light.ts), so what the plant does to the light follows it.
import { Fn, abs, attribute, cos, cross, dot, exp, float, floor, fract, max, min, mix, normalize, positionGeometry, pow, saturate, sin, smoothstep, sqrt, step, uniform, varyingProperty, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Vector3 } from "three/webgpu";
import type { Grown } from "./grow.ts";
import type { BladeIn, SolidIn } from "./look.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;
type V4 = Node<"vec4">;
const TAU = Math.PI * 2;
const LONG = 0.19; // a frond longer than this is drawn with more quads
export const FLOW = [0.93, 0, -0.37]; // the way the current goes: across the picture and a little away

const defaults = {
  limb: 0.009, // branches thinner than this are not drawn
  hold: 0.6, // how far downstream of the head's middle fronds begin to let go
  gone: 1.4, // and where they all have
  thin: 0.5, // how many of the free ones are left out, so that the tail is not a wall
  stray: 0.06, // how many on the shaped side are long anyway
  reach: 0.2, // how big the hand in the weed is
  quads: [6, 2] as [number, number], // along and across a short frond. Small fronds want few: a triangle a pixel or two across costs as much to draw as a big one
};

export type WeedOptions = Partial<typeof defaults>;

export function createWeed(g: Grown, opts: WeedOptions = {}) {
  const o = g.options;
  const m = { ...defaults, ...opts };
  const R = g.random;
  let thickest = 0;
  for (let i = 0; i < g.count; i++) thickest = Math.max(thickest, g.radius[i]);

  const U = {
    grow: uniform(1.4),
    phase: uniform(0),
    flow: uniform(new Vector3(...FLOW)),
    side: uniform(new Vector3(FLOW[2], 0, -FLOW[0])), // across the current
    sway: uniform(1), // how far the water moves the whole plant
    flutter: uniform(1), // and a frond
    stream: uniform(0.55), // how much a frond that holds the shape is combed downstream all the same
    bladeLength: uniform(1),
    bladeWidth: uniform(1),
    cup: uniform(0.45), // how hollow a frond is across
    smooth: uniform(0.8), // how far a frond of the shape is lit as the skin it lies on, not as itself
    breathe: uniform(1), // how far the fronds on the skin lift as the water's push passes, letting the sun in
    age: uniform(0), // added to every frond's age
  };
  const tau = U.phase.mul(TAU);

  // ---- the water's push. It comes down the current in waves long against the plant, so the head rides them
  // nearly whole; thin things get a finer shiver on top
  const pushAt = (p: V3) => {
    const s = dot(p, U.flow);
    const a = sin(s.mul(1.1).sub(tau.mul(2)).add(p.y.mul(0.7)));
    const b = sin(s.mul(2.7).sub(tau.mul(5)).add(p.z.mul(1.9)).add(1.3));
    return a.mul(0.45).add(b.mul(0.2)).add(0.55);
  };
  const lean = (p: V3, flex: N, loose: N) => {
    const s = dot(p, U.flow);
    const push = pushAt(p);
    const c = sin(p.y.mul(2.3).add(s.mul(0.9)).sub(tau.mul(3)).add(0.7));
    const d = sin(s.mul(7).sub(tau.mul(9)).add(p.y.mul(5)).add(p.z.mul(4)));
    const e = sin(p.x.mul(6).add(p.y.mul(8)).sub(tau.mul(7)).add(2));
    const big = U.flow
      .mul(push.mul(0.09))
      .add(U.side.mul(c.mul(0.035)))
      .add(vec3(0, push.mul(push).mul(-0.02), 0));
    const small = U.flow
      .mul(d.mul(0.012))
      .add(U.side.mul(e.mul(0.008)))
      .add(vec3(0, d.mul(e).mul(0.006), 0));
    return big.add(small.mul(loose)).mul(flex).mul(U.sway);
  };
  // how much of that a node gets: the stalk bends from its foot, the head goes whole; thin things are looser
  const neck = g.pos[g.stalkTop * 3 + 1];
  const flexOf = (j: number) => Math.pow(Math.min(1, Math.max(0, (g.pos[j * 3 + 1] - o.floor) / (neck - o.floor))), 1.7);
  const looseOf = (j: number) => Math.min(1, Math.max(0, 1 - (g.radius[j] - o.twig) / 0.006));

  // ---- limbs: a tube from each node to its parent, where the branch is thick enough to be one
  const branch = (() => {
    const dir = new Float32Array(g.count * 3);
    for (let i = 0; i < g.count; i++) {
      const p = g.parent[i];
      if (p < 0) dir.set([0, 1, 0], 0);
      else {
        const dx = g.pos[i * 3] - g.pos[p * 3],
          dy = g.pos[i * 3 + 1] - g.pos[p * 3 + 1],
          dz = g.pos[i * 3 + 2] - g.pos[p * 3 + 2];
        const l = Math.hypot(dx, dy, dz) || 1;
        dir.set([dx / l, dy / l, dz / l], i * 3);
      }
    }
    // the ring at a node stands square to the way the branch passes through it
    const frame = (x: number, y: number, z: number) => {
      const l = Math.hypot(x, y, z) || 1;
      x /= l;
      y /= l;
      z /= l;
      // across something fixed, so that rings along a branch agree
      let ax = y * 0.94 - z * 0.12,
        ay = z * 0.31 - x * 0.94,
        az = x * 0.12 - y * 0.31;
      const al = Math.hypot(ax, ay, az) || 1;
      ax /= al;
      ay /= al;
      az /= al;
      return [ax, ay, az, y * az - z * ay, z * ax - x * az, x * ay - y * ax];
    };
    const through = (i: number) => {
      const h = g.heir[i];
      return h < 0 ? frame(dir[i * 3], dir[i * 3 + 1], dir[i * 3 + 2]) : frame(dir[i * 3] + dir[h * 3], dir[i * 3 + 1] + dir[h * 3 + 1], dir[i * 3 + 2] + dir[h * 3 + 2]);
    };
    const drawnOne = (i: number) => g.radius[i] >= m.limb || i < g.fixed;
    const SIDES = 8;
    let verts = 0;
    for (let i = 1; i < g.count; i++) if (drawnOne(i)) verts += SIDES * 2;
    const position = new Float32Array(verts * 3),
      prev = new Float32Array(verts * 3),
      ring = new Float32Array(verts * 3),
      info = new Float32Array(verts * 4), // radius, born, begins to slide, flex
      tex = new Float32Array(verts * 4), // along, round, loose, -
      index = new Uint32Array(verts * 3);
    let v = 0,
      t = 0;
    for (let i = 1; i < g.count; i++) {
      if (!drawnOne(i)) continue;
      const p = g.parent[i];
      const main = g.heir[p] === i;
      // a limb ends where its heir is too thin to be drawn: in a point, among the fronds
      const tipEnd = g.heir[i] < 0 || !drawnOne(g.heir[i]);
      const begins = Math.max(g.born[p], g.born[i] - 1.3 * g.beat);
      const f0 = main ? through(p) : frame(dir[i * 3], dir[i * 3 + 1], dir[i * 3 + 2]),
        f1 = through(i);
      for (let end = 0; end < 2; end++) {
        const at = end ? i : p,
          f = end ? f1 : f0;
        const r = end ? g.radius[i] * (tipEnd ? 0.25 : 1) : main ? g.radius[p] : g.radius[i];
        for (let k = 0; k < SIDES; k++) {
          const a = (k / SIDES) * TAU,
            c = Math.cos(a),
            s = Math.sin(a);
          position.set([g.pos[at * 3], g.pos[at * 3 + 1], g.pos[at * 3 + 2]], v * 3);
          prev.set([g.pos[p * 3], g.pos[p * 3 + 1], g.pos[p * 3 + 2]], v * 3);
          ring.set([f[0] * c + f[3] * s, f[1] * c + f[4] * s, f[2] * c + f[5] * s], v * 3);
          // the lower ring is there as soon as the branch begins; the upper one slides out to its place
          info.set(end ? [r, g.born[i], begins, flexOf(at)] : [r, main ? g.born[p] : begins, (main ? g.born[p] : begins) - 1e-4, flexOf(at)], v * 4);
          tex.set([g.way[at] / 0.06, k / SIDES, looseOf(at), 0], v * 4);
          v++;
        }
      }
      const b = v - SIDES * 2;
      for (let k = 0; k < SIDES; k++) {
        const k1 = (k + 1) % SIDES;
        index.set([b + k, b + k1, b + SIDES + k, b + k1, b + SIDES + k1, b + SIDES + k], t);
        t += 6;
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("prev", new BufferAttribute(prev, 3));
    geometry.setAttribute("ring", new BufferAttribute(ring, 3));
    geometry.setAttribute("info", new BufferAttribute(info, 4));
    geometry.setAttribute("tex", new BufferAttribute(tex, 4));
    geometry.setIndex(new BufferAttribute(index, 1));

    const aPrev = attribute("prev", "vec3") as V3,
      aRing = attribute("ring", "vec3") as V3,
      aInfo = attribute("info", "vec4") as V4,
      aTex = attribute("tex", "vec4") as V4;
    const position_ = () =>
      Fn(() => {
        const r0 = aInfo.x,
          born = aInfo.y,
          begins = aInfo.z;
        const slide = saturate(U.grow.sub(begins).div(born.sub(begins)));
        const centre = mix(aPrev, positionGeometry, slide).toVar();
        // a branch thickens for as long as more grows beyond it, and more grows beyond a thick one
        const span = sqrt(r0.div(thickest)).mul(0.55).add(0.2);
        const r = mix(min(r0, o.twig * 0.6), r0, smoothstep(born, born.add(span), U.grow)).mul(step(begins, U.grow));
        return centre.add(lean(centre, aInfo.w, aTex.z)).add(aRing.mul(r));
      })();
    // streaks along it, read from where round the branch (the ring's direction has no seam)
    const drawn: SolidIn = { along: aTex.x, round: aTex.y, seed: float(0.3), bulb: float(0), at: aRing.mul(2.5).add(aTex.x.mul(0.9)) };
    return { geometry, position: position_, normal: aRing, drawn, verts, tris: t / 3 };
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
    const root: number[] = [],
      grain: number[] = [], // the way it sets out
      face: number[] = [], // the skin's outward at its root
      dims: number[] = [], // length, half width, born, flex
      more: number[] = []; // its own number, how free it is, age, loose
    const sm = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
      return t * t * (3 - 2 * t);
    };
    let freed = 0,
      inside = 0;
    for (let b = 0; b < g.bladeAt.length; b++) {
      const j = g.bladeAt[b];
      const p = [g.pos[j * 3], g.pos[j * 3 + 1], g.pos[j * 3 + 2]];
      const n = [g.bladeOut[b * 3], g.bladeOut[b * 3 + 1], g.bladeOut[b * 3 + 2]];
      // how far downstream of the middle, and not along a straight edge
      const s = (p[0] - o.at[0]) * FLOW[0] + (p[2] - o.at[2]) * FLOW[2];
      const ragged = 0.5 * Math.sin(p[1] * 4.1 + 1) * Math.sin(p[2] * 3.3 + 2) + 0.3 * Math.sin(p[0] * 6 + p[1] * 5);
      let free = sm(m.hold, m.gone, s + 0.22 * ragged);
      if (R() < free * m.thin) continue;
      const stray = free < 0.3 && R() < m.stray;
      // along the skin: upward (weed floats), downstream, and as it likes
      const want = [FLOW[0] * 0.6 + (R() - 0.5) * 0.9, 0.5 + (R() - 0.5) * 0.5, FLOW[2] * 0.6 + (R() - 0.5) * 0.9];
      const lift = 0.03 + 0.3 * R() * R();
      let long = 0.05 + 0.06 * R() + free * (0.05 + 0.05 * R()) + free * free * (0.3 + 0.9 * R() * R());
      if (stray) {
        long = 0.2 + 0.3 * R();
        free = 0.35 + 0.3 * R();
      }
      const age = -30 + 32 * Math.pow(R(), 1.6);
      const d = want[0] * n[0] + want[1] * n[1] + want[2] * n[2];
      let t = [want[0] - n[0] * d, want[1] - n[1] * d, want[2] - n[2] * d];
      let tl = Math.hypot(t[0], t[1], t[2]);
      if (tl < 0.02) {
        t = [n[1], -n[0], 0.01];
        tl = Math.hypot(t[0], t[1], t[2]);
      }
      const gr = [t[0] / tl + n[0] * lift, t[1] / tl + n[1] * lift, t[2] / tl + n[2] * lift];
      const gl = Math.hypot(gr[0], gr[1], gr[2]);
      root.push(p[0], p[1], p[2]);
      grain.push(gr[0] / gl, gr[1] / gl, gr[2] / gl);
      face.push(n[0], n[1], n[2]);
      dims.push(long, Math.min(long * 0.3, 0.011 + 0.012 * R()), g.born[j] + 0.07 + 0.12 * R(), flexOf(j));
      more.push(R(), free, age, looseOf(j));
      if (free > 0.5) freed++;
    }
    // and inside it is weed too, all the way through: combed by the current, lit as itself
    for (const j of g.innerAt) {
      const p = [g.pos[j * 3], g.pos[j * 3 + 1], g.pos[j * 3 + 2]];
      const s = (p[0] - o.at[0]) * FLOW[0] + (p[2] - o.at[2]) * FLOW[2];
      const ragged = 0.5 * Math.sin(p[1] * 4.1 + 1) * Math.sin(p[2] * 3.3 + 2) + 0.3 * Math.sin(p[0] * 6 + p[1] * 5);
      const let_go = sm(m.hold, m.gone, s + 0.22 * ragged);
      if (R() < let_go * m.thin) continue;
      const turn = R() * TAU,
        tilt = R() * 2 - 1,
        flat = Math.sqrt(1 - tilt * tilt);
      const n = [Math.cos(turn) * flat, tilt, Math.sin(turn) * flat];
      const want = [FLOW[0] * 0.5 + (R() - 0.5) * 1.3, 0.45 + (R() - 0.5) * 0.9, FLOW[2] * 0.5 + (R() - 0.5) * 1.3];
      const d = want[0] * n[0] + want[1] * n[1] + want[2] * n[2];
      const t = [want[0] - n[0] * d, want[1] - n[1] * d, want[2] - n[2] * d];
      const tl = Math.hypot(t[0], t[1], t[2]) || 1;
      const long = 0.07 + 0.09 * R() + let_go * let_go * (0.3 + 0.9 * R() * R());
      root.push(p[0], p[1], p[2]);
      grain.push(t[0] / tl, t[1] / tl, t[2] / tl);
      face.push(n[0], n[1], n[2]);
      dims.push(long, Math.min(long * 0.3, 0.011 + 0.012 * R()), g.born[j] + 0.07 + 0.12 * R(), flexOf(j));
      more.push(R(), Math.max(0.6 + 0.25 * R(), let_go), -30 + 36 * Math.pow(R(), 1.3), looseOf(j));
      inside++;
    }
    // and the stalk is not bare: weed all the way up it, going with the current
    for (let j = 5; j < g.stalkTop; j += 1) {
      if (R() < 0.35) continue;
      const turn = R() * TAU;
      const n = [Math.cos(turn), 0.15, Math.sin(turn)];
      const long = 0.1 + 0.3 * R() * R();
      root.push(g.pos[j * 3] + n[0] * g.radius[j] * 0.7, g.pos[j * 3 + 1], g.pos[j * 3 + 2] + n[2] * g.radius[j] * 0.7);
      const gr = [n[0] * 0.5, 0.85, n[2] * 0.5];
      const gl = Math.hypot(gr[0], gr[1], gr[2]);
      grain.push(gr[0] / gl, gr[1] / gl, gr[2] / gl);
      face.push(n[0], n[1], n[2]);
      dims.push(long, Math.min(long * 0.3, 0.01 + 0.01 * R()), g.born[j] + 0.07 + 0.12 * R(), flexOf(j));
      more.push(R(), 0.55 + 0.45 * R(), -30 + 32 * R(), 1);
    }
    const count = root.length / 3;
    // most are short and need few quads; the streamers get many. The same shader poses both
    const pick = (from: number[], size: number, which: number[]) => {
      const out = new Float32Array(which.length * size);
      for (const [k, i] of which.entries()) for (let c = 0; c < size; c++) out[k * size + c] = from[i * size + c];
      return out;
    };
    const sets: { n: number; where: Float32Array; long: Float32Array; bent: InstancedBufferAttribute; push: Float32Array; speed: Float32Array }[] = [];
    const geometries = [false, true].map((streamers) => {
      const which: number[] = [];
      for (let i = 0; i < count; i++) if (dims[i * 4] > LONG === streamers) which.push(i);
      const { position, index } = streamers ? ribbon(14, 4) : ribbon(m.quads[0], m.quads[1]);
      const geometry = new InstancedBufferGeometry();
      geometry.instanceCount = which.length;
      geometry.setAttribute("position", new BufferAttribute(position, 3));
      geometry.setIndex(new BufferAttribute(index, 1));
      geometry.setAttribute("root", new InstancedBufferAttribute(pick(root, 3, which), 3));
      geometry.setAttribute("grain", new InstancedBufferAttribute(pick(grain, 3, which), 3));
      geometry.setAttribute("face", new InstancedBufferAttribute(pick(face, 3, which), 3));
      geometry.setAttribute("dims", new InstancedBufferAttribute(pick(dims, 4, which), 4));
      geometry.setAttribute("more", new InstancedBufferAttribute(pick(more, 4, which), 4));
      // how far its tip is pushed, over its length
      const bent = new InstancedBufferAttribute(new Float32Array(which.length * 3), 3);
      bent.setUsage(DynamicDrawUsage);
      geometry.setAttribute("bent", bent);
      // for the hand: about where each frond is (two thirds along the way it sets out), and how long
      const n = which.length;
      const where = new Float32Array(n * 3),
        long = new Float32Array(n);
      for (const [k, i] of which.entries()) {
        long[k] = dims[i * 4];
        for (let c = 0; c < 3; c++) where[k * 3 + c] = root[i * 3 + c] + grain[i * 3 + c] * Math.min(dims[i * 4], 0.25) * 0.66;
      }
      sets.push({ n, where, long, bent, push: new Float32Array(n * 3), speed: new Float32Array(n * 3) });
      return geometry;
    });

    // ---- a hand in the weed. Each frond is one body: the hand pushes it as a whole, and what is kept of it is how
    // far its tip has gone. Its vertex shader bends it by that from root to tip, the same on both edges, so a
    // frond that is pushed turns and bows and is no wider or longer than it was.
    //
    // The hand is a ball on the pointer's line, at the first weed that line comes to. A frond within its reach
    // wants its tip away from the ball and along with the way the ball is moving; it goes there as a spring in
    // water does, the long ones slowly, and when the hand has gone it swings back a little past where it was.
    //   from, way   the pointer's line (way is a unit vector);  move  the hand's speed, units a second
    //   there       0..1, how much the hand is in the water;    hard  how hard it pushes
    let still = true;
    const touch = (dt: number, from: Vector3, way: Vector3, move: Vector3, there: number, hard: number) => {
      const reach = m.reach;
      let nearest = Infinity;
      if (there > 0.01)
        for (const set of sets)
          for (let k = 0; k < set.n; k++) {
            const x = set.where[k * 3] - from.x,
              y = set.where[k * 3 + 1] - from.y,
              z = set.where[k * 3 + 2] - from.z;
            const along = x * way.x + y * way.y + z * way.z;
            if (along > 0 && along < nearest && x * x + y * y + z * z - along * along < reach * reach * 0.35) nearest = along;
          }
      const touching = nearest < Infinity;
      if (!touching && still) return;
      const hx = from.x + way.x * (nearest + reach * 0.35),
        hy = from.y + way.y * (nearest + reach * 0.35),
        hz = from.z + way.z * (nearest + reach * 0.35);
      const fast = Math.min(1, Math.hypot(move.x, move.y, move.z) * 0.7);
      let moving = 0;
      for (const set of sets) {
        const { push, speed, long } = set;
        const out = set.bent.array as Float32Array;
        for (let k = 0; k < set.n; k++) {
          const L = long[k];
          let tx = 0,
            ty = 0,
            tz = 0;
          if (touching) {
            const x = set.where[k * 3] - hx,
              y = set.where[k * 3 + 1] - hy,
              z = set.where[k * 3 + 2] - hz;
            const far = (x * x + y * y + z * z) / (reach * reach);
            if (far < 5) {
              const near = Math.exp(-far) * there * hard;
              const l = Math.sqrt(x * x + y * y + z * z) || 1;
              // away from the hand, more the faster it moves; and along with it
              const away = (near * Math.min(L, 0.3) * (0.75 + 0.6 * fast)) / l;
              const with_ = near * 0.16;
              tx = x * away + move.x * with_;
              ty = y * away + move.y * with_;
              tz = z * away + move.z * with_;
            }
          }
          // a spring in water: a short frond is quick and stiff, a streamer slow; neither quite stops dead
          const quick = Math.min(11, Math.max(2.4, 9.5 * Math.pow(0.06 / L, 0.45)));
          const pull = quick * quick,
            drag = 2 * 0.42 * quick;
          for (let c = 0; c < 3; c++) {
            const i = k * 3 + c;
            const t = c === 0 ? tx : c === 1 ? ty : tz;
            speed[i] += (pull * (t - push[i]) - drag * speed[i]) * dt;
            push[i] += speed[i] * dt;
          }
          // it cannot be pushed further than it is long
          const far2 = push[k * 3] ** 2 + push[k * 3 + 1] ** 2 + push[k * 3 + 2] ** 2;
          const most = 0.9 * L;
          const held = far2 > most * most ? most / Math.sqrt(far2) : 1;
          for (let c = 0; c < 3; c++) {
            const i = k * 3 + c;
            push[i] *= held;
            out[i] = push[i] / L;
            moving += Math.abs(speed[i]) + Math.abs(push[i]);
          }
        }
        set.bent.needsUpdate = true;
      }
      // once everything has come to rest there is nothing to do until the hand is back
      still = !touching && moving < 1e-4;
      if (still)
        for (const set of sets) {
          set.push.fill(0);
          set.speed.fill(0);
          (set.bent.array as Float32Array).fill(0);
          set.bent.needsUpdate = true;
        }
    };

    const aRoot = attribute("root", "vec3") as V3,
      aGrain = attribute("grain", "vec3") as V3,
      aFace = attribute("face", "vec3") as V3,
      aDims = attribute("dims", "vec4") as V4,
      aMore = attribute("more", "vec4") as V4,
      aBent = attribute("bent", "vec3") as V3;
    // a ribbon: soon as wide as it gets, a long taper to the tip, never quite nothing
    const outline = (u: N) =>
      pow(max(sin(pow(u, 0.5).mul(Math.PI)), 0), 0.5)
        .mul(0.97)
        .add(0.03);
    const normal = varyingProperty("vec3", "bladeNormal") as V3;
    const position_ = (withNormal: boolean) =>
      Fn(() => {
        const seed = aMore.x,
          free = aMore.y;
        const open = smoothstep(aDims.z, aDims.z.add(0.16), U.grow).toVar();
        const L = aDims.x.mul(U.bladeLength).mul(pow(open, 0.8)).toVar();
        const W = aDims.y.mul(U.bladeWidth).mul(open).toVar();
        const base = aRoot.add(lean(aRoot, aDims.w, aMore.w)).toVar();
        const s = dot(aRoot, U.flow);
        const push = pushAt(aRoot).toVar();
        // whole numbers of turns in a loop, its own
        const n1 = floor(seed.mul(3)).add(3),
          n2 = floor(fract(seed.mul(13.7)).mul(3)).add(3),
          n3 = floor(fract(seed.mul(5.1)).mul(2)).add(2);
        // downstream as this frond finds it just now: up a little (weed floats), and wandering from side to side
        const F = normalize(
          U.flow
            .mul(push.mul(0.5).add(0.6))
            .add(vec3(0, 0.22, 0))
            .add(U.side.mul(sin(tau.mul(n3).add(s.mul(1.3)).add(seed.mul(30))).mul(0.3)))
            .add(vec3(fract(seed.mul(17.1)), fract(seed.mul(29.3)), fract(seed.mul(41.7))).sub(0.5).mul(0.7)),
        ).toVar();
        const T = aGrain,
          Nn = aFace;
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
            sin(tau.mul(n1).add(seed.mul(40)).sub(s.mul(3)))
              .mul(0.2)
              .mul(U.flutter),
          )
          // and all together as the push passes over them: the canopy opens and shuts, and the light inside with it
          .add(push.sub(0.45).mul(0.5).mul(U.breathe))
          .mul(free.oneMinus())
          .toVar();
        const twist = fract(seed.mul(3.3)).sub(0.5).mul(free.mul(2.5).add(1.2)).toVar();
        const cup = mix(float(2.6), U.cup, open).toVar();
        const at = (u: N, v: N) => {
          const w = turned(u),
            wAll = turnedUpTo(u);
          // pushed, it bows from its root to its tip: its way leans over by more the further along
          const way = normalize(mix(T, F, w).add(aBent.mul(u.mul(1.3).add(0.35))));
          const across = normalize(cross(flatTo, way));
          const out = cross(way, across);
          const reach = pow(u, 1.3);
          const gives = u.mul(0.35).add(u.mul(u).mul(0.65));
          const wave = sin(u.mul(cycles).sub(tau.mul(n2)).add(seed.mul(90))).mul(reach).mul(high);
          const wave2 = sin(u.mul(cycles).mul(0.63).sub(tau.mul(n1)).add(seed.mul(53))).mul(reach).mul(high).mul(0.5);
          const mid = T.mul(u.sub(wAll))
            .add(F.mul(wAll))
            .mul(L)
            .add(out.mul(wave))
            .add(across.mul(wave2))
            // a frond of the shape lifts off the skin towards its tip
            .add(Nn.mul(curl.mul(u).mul(u).mul(L)))
            // the push: none at the root, all of it at the tip; and shortened by as much as that would lengthen it,
            // so that it bends and does not stretch
            .add(aBent.mul(L).mul(gives))
            .mul(dot(aBent, aBent).mul(gives).mul(gives).add(1).inverseSqrt());
          const psi = u.mul(
            twist.add(
              sin(tau.mul(n3).add(seed.mul(70)).sub(u.mul(3)))
                .mul(0.45)
                .mul(U.flutter),
            ),
          );
          const Bu = across.mul(cos(psi)).add(out.mul(sin(psi)));
          const Nw = out.mul(cos(psi)).sub(across.mul(sin(psi)));
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
          const p = base
            .add(mid)
            .add(Bu.mul(x))
            .add(Nw.mul(z.add(ruffle)));
          return p;
        };
        const u = positionGeometry.x,
          v = positionGeometry.y;
        const here = at(u, v).toVar();
        if (withNormal) {
          const e = 0.02;
          const own = normalize(cross(at(u.add(e), v).sub(here), at(u, v.add(e)).sub(here)).add(Nn.mul(1e-9)));
          // one that holds the shape is lit mostly as the skin under it: the leaves of a clipped hedge show its
          // shape, not their own. A free one is its own
          normal.assign(normalize(mix(own.mul(dot(own, Nn).sign()), Nn, U.smooth.mul(free.oneMinus()))));
        }
        return here;
      })();
    const u = positionGeometry.x as N,
      v = positionGeometry.y as N;
    const drawn: BladeIn = { u, v, long: aDims.x.mul(U.bladeLength), half: aDims.y.mul(U.bladeWidth), edge: outline(u), age: aMore.z.add(U.age), seed: aMore.x, veined: float(0.25) };
    return { geometries, position: position_, normal, drawn, count, freed, inside, touch };
  })();

  return { U, branch, blade, thickest };
}
