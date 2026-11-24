// The things the tube goes through (stems.ts' cube and figure), as themselves: rock, hanging in the water ahead of
// the front, which comes up to it, runs over it and takes it. Behind the front the same rock is inside the weed,
// a little smaller than the skin the fronds lie on, so that the shoots are seen to run over it.
//
// A rock is at a place in the loop, so in the frame that goes with the growth it comes back down the picture's
// diagonal: one a loop. Four are drawn of each (two loops ahead to one behind), as instances of one mesh.
import { Fn, abs, attribute, cameraPosition, cross, dFdx, dFdy, dot, float, mix, mx_noise_float, normalize, positionGeometry, positionWorld, pow, saturate, sign, smoothstep, uniform, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { BufferAttribute, FrontSide, InstancedBufferAttribute, InstancedBufferGeometry, NodeMaterial, Vector3 } from "three/webgpu";
import type { Light } from "./light.ts";
import type { createLook } from "./look.ts";
import type { Mesh as Shape, Thing, createStems } from "./stems.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;
const SHRINK = 0.86; // the rock against the skin the weed lies on
const LAPS = [2, 1, 0, -1];

// ---- a number for every place, 0..1, smooth: for a rock's dents
const corner = (x: number, y: number, z: number) => {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};
const noise = (x: number, y: number, z: number) => {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const fade = (t: number) => t * t * (3 - 2 * t);
  const u = fade(x - xi),
    v = fade(y - yi),
    w = fade(z - zi);
  let sum = 0;
  for (let k = 0; k < 8; k++) {
    const a = k & 1,
      b = (k >> 1) & 1,
      c = k >> 2;
    sum += corner(xi + a, yi + b, zi + c) * (a ? u : 1 - u) * (b ? v : 1 - v) * (c ? w : 1 - w);
  }
  return sum;
};
const rough = (x: number, y: number, z: number) => 0.6 * noise(x, y, z) + 0.28 * noise(x * 2.1 + 7.3, y * 2.1 + 1.9, z * 2.1 + 4.1) + 0.12 * noise(x * 4.7 + 2.2, y * 4.7 + 8.4, z * 4.7 + 5.5);

// smooth normals of a mesh whose vertices are shared
const normalsOf = (position: Float32Array, index: ArrayLike<number>, normal: Float32Array) => {
  normal.fill(0);
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t] * 3,
      b = index[t + 1] * 3,
      c = index[t + 2] * 3;
    const ux = position[b] - position[a],
      uy = position[b + 1] - position[a + 1],
      uz = position[b + 2] - position[a + 2];
    const vx = position[c] - position[a],
      vy = position[c + 1] - position[a + 1],
      vz = position[c + 2] - position[a + 2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    for (const k of [a, b, c]) {
      normal[k] += nx;
      normal[k + 1] += ny;
      normal[k + 2] += nz;
    }
  }
  for (let k = 0; k < normal.length; k += 3) {
    const l = Math.hypot(normal[k], normal[k + 1], normal[k + 2]) || 1;
    normal[k] /= l;
    normal[k + 1] /= l;
    normal[k + 2] /= l;
  }
};

export function createRocks(stems: ReturnType<typeof createStems>, monkey: Shape) {
  const colour = { stone: uniform(new Vector3(0.42, 0.38, 0.33)), dark: uniform(new Vector3(0.16, 0.15, 0.13)) };

  // one kind of rock: a mesh whose vertices are put again when its thing changes (`fill`), never more or fewer
  const kind = (count: number, index: ArrayLike<number>) => {
    const position = new Float32Array(count * 3),
      normal = new Float32Array(count * 3);
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(position, 3));
    geometry.setAttribute("normal", new BufferAttribute(normal, 3));
    geometry.setIndex(new BufferAttribute(count > 65535 ? Uint32Array.from(index) : Uint16Array.from(index), 1));
    geometry.setAttribute("lap", new InstancedBufferAttribute(new Float32Array(LAPS), 1));
    geometry.instanceCount = LAPS.length;
    // where in the loop its middle is, how far off the axis, and 1 if there is one at all
    const U = { at: uniform(0), off: uniform(new Vector3()), on: uniform(0) };
    const lap = attribute("lap", "float") as N;
    // it rides the water's push as the weed round it does, or it would come through its coat on one side
    const where = Fn(() => {
      const middle = stems.U.axis.mul(U.at.add(lap).sub(stems.U.phase).mul(stems.U.pitch)).add(U.off);
      const p = (positionGeometry as V3).mul(U.on).add(middle).toVar();
      return p.add(stems.sway(p, float(0.2)));
    })();
    const measure = { reach: 1, long: 1 }; // the furthest of it from its middle, and the furthest along the tube
    const done = () => {
      normalsOf(position, index, normal);
      let reach = 0,
        long = 0;
      for (let v = 0; v < position.length; v += 3) {
        reach = Math.max(reach, Math.hypot(position[v], position[v + 1], position[v + 2]));
        long = Math.max(long, Math.abs(position[v] * stems.axis.x + position[v + 1] * stems.axis.y + position[v + 2] * stems.axis.z));
      }
      Object.assign(measure, { reach, long });
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.normal.needsUpdate = true;
    };
    return { geometry, position, normal, U, where, measure, done, index };
  };

  // ---- the cube: a grid on each face of a cube, shared along the edges, brought in to a rounded cube
  const cube = (() => {
    const G = 26;
    const ids = new Map<number, number>();
    const cells: number[] = [];
    const idOf = (c: number[]) => {
      const key = c[0] + (G + 1) * (c[1] + (G + 1) * c[2]);
      let id = ids.get(key);
      if (id === undefined) {
        id = cells.length / 3;
        ids.set(key, id);
        cells.push(c[0], c[1], c[2]);
      }
      return id;
    };
    const index: number[] = [];
    for (let d = 0; d < 3; d++)
      for (const side of [0, G])
        for (let i = 0; i < G; i++)
          for (let j = 0; j < G; j++) {
            const at = (a: number, b: number) => {
              const c = [0, 0, 0];
              c[d] = side;
              c[(d + 1) % 3] = a;
              c[(d + 2) % 3] = b;
              return idOf(c);
            };
            const q = [at(i, j), at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)];
            // outward: the face's own way
            if (side) index.push(q[0], q[1], q[2], q[0], q[2], q[3]);
            else index.push(q[0], q[2], q[1], q[0], q[3], q[2]);
          }
    const made = kind(cells.length / 3, index);
    const fill = (thing: Thing) => {
      const h = thing.half,
        r = Math.max(Math.min(thing.round, h), 0.02);
      const [ux, uy, uz] = thing.axes;
      const q = [0, 0, 0],
        n = [0, 0, 0],
        p = [0, 0, 0];
      for (let v = 0; v < cells.length; v += 3) {
        let far = 0;
        for (let k = 0; k < 3; k++) {
          q[k] = ((cells[v + k] / G) * 2 - 1) * h;
          const inner = Math.max(-(h - r), Math.min(h - r, q[k]));
          n[k] = q[k] - inner;
          p[k] = inner;
          far += n[k] * n[k];
        }
        far = Math.sqrt(far) || 1;
        // dents: broad ones and small ones, in from the rounded cube, never out of it
        for (let k = 0; k < 3; k++) p[k] += (n[k] / far) * r;
        const dent = h * (0.1 * rough(p[0] * 2.6, p[1] * 2.6, p[2] * 2.6) + 0.035 * noise(p[0] * 9 + 3, p[1] * 9 + 5, p[2] * 9 + 7));
        for (let k = 0; k < 3; k++) p[k] = (p[k] - (n[k] / far) * dent) * SHRINK;
        made.position[v] = p[0] * ux.x + p[1] * uy.x + p[2] * uz.x;
        made.position[v + 1] = p[0] * ux.y + p[1] * uy.y + p[2] * uz.y;
        made.position[v + 2] = p[0] * ux.z + p[1] * uy.z + p[2] * uz.z;
      }
      made.done();
    };
    return { ...made, fill };
  })();

  // ---- the figure: its mesh, stood as stems.ts' `bakeFigure` stands it
  const figure = (() => {
    const P = monkey.position;
    // a mesh that is inside out would be lit from within
    let volume = 0;
    for (let t = 0; t < monkey.index.length; t += 3) {
      const a = monkey.index[t] * 3,
        b = monkey.index[t + 1] * 3,
        c = monkey.index[t + 2] * 3;
      volume += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1]) + P[a + 1] * (P[b + 2] * P[c] - P[b] * P[c + 2]) + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
    }
    const index = Array.from(monkey.index);
    if (volume < 0) for (let t = 0; t < index.length; t += 3) [index[t + 1], index[t + 2]] = [index[t + 2], index[t + 1]];
    const made = kind(P.length / 3, index);
    const fill = (thing: Thing) => {
      const turn = (thing.turn * Math.PI) / 180,
        ct = Math.cos(turn),
        st = Math.sin(turn);
      const size = thing.size * SHRINK;
      for (let v = 0; v < P.length; v += 3) {
        made.position[v] = (P[v] * ct + P[v + 2] * st) * size;
        made.position[v + 1] = P[v + 1] * size;
        made.position[v + 2] = (P[v + 2] * ct - P[v] * st) * size;
      }
      normalsOf(made.position, index, made.normal);
      // weathered, but not so that a face is lost
      for (let v = 0; v < P.length; v += 3) {
        const x = made.position[v] / size,
          y = made.position[v + 1] / size,
          z = made.position[v + 2] / size;
        const dent = size * (0.035 * rough(x * 3.1, y * 3.1, z * 3.1) + 0.012 * noise(x * 11 + 3, y * 11 + 5, z * 11 + 7));
        for (let k = 0; k < 3; k++) made.position[v + k] -= made.normal[v + k] * dent;
      }
      made.done();
    };
    return { ...made, fill };
  })();

  const kinds = { cube, figure };
  // the rocks that there are now, for whoever lives round them (fish.ts)
  const there: { at: number; off: Vector3; reach: number; long: number }[] = [];
  const update = (things: Thing[]) => {
    there.length = 0;
    for (const name of ["cube", "figure"] as const) {
      const thing = things.find((t) => t.kind === name);
      const made = kinds[name];
      made.U.on.value = thing ? 1 : 0;
      if (!thing) continue;
      made.fill(thing);
      made.U.at.value = thing.at;
      made.U.off.value.copy(thing.off);
      there.push({ at: thing.at, off: thing.off, ...made.measure });
    }
    return there;
  };

  // for the sun map: each is a thing that lets no light through
  const solids = [cube, figure].map((made) => ({ geometry: made.geometry, side: FrontSide, position: made.where }));

  // ---- stone, in the plant's light: the sun's web on it and the weed's shadow, and the water's light from all round
  const dress = (light: Light, shade: ReturnType<typeof createLook>) => {
    const lit = Fn(() => {
      const pos = positionWorld;
      const V = normalize(cameraPosition.sub(pos));
      const L = light.U.dir;
      const flat = normalize(attribute("normal", "vec3")).toVar();
      // its marks are its own: read where it is on the rock, not where the rock is
      const at = positionGeometry as V3;
      const broad = mx_noise_float(at.mul(2.4)),
        mid = mx_noise_float(at.mul(9).add(11)),
        fine = mx_noise_float(at.mul(26).add(23)),
        grit = mx_noise_float(at.mul(70).add(5));
      // pits and grain lean the normal (as look.ts leans a blade's by its veins)
      const h = mid.mul(0.5).add(fine.mul(0.3)).add(grit.mul(0.12)).mul(0.011).mul(shade.U.relief);
      const dpx = dFdx(pos),
        dpy = dFdy(pos);
      const r1 = cross(dpy, flat),
        r2 = cross(flat, dpx);
      const det = dot(dpx, r1);
      const slope = r1.mul(dFdx(h)).add(r2.mul(dFdy(h))).mul(sign(det));
      const normal = normalize(flat.mul(abs(det)).sub(slope)).toVar();
      // two stones run together, darker in its pits, and a bloom of weed-green where it faces up
      const stone = mix(colour.dark, colour.stone, smoothstep(-0.55, 0.45, broad.add(mid.mul(0.35))))
        .mul(smoothstep(-0.7, 0.1, mid.add(fine.mul(0.5))).mul(0.4).add(0.6))
        .mul(grit.mul(0.12).add(1));
      const albedo = mix(stone, stone.mul(vec3(0.55, 0.85, 0.4)), smoothstep(0.1, 0.8, flat.y.add(broad.mul(0.4))).mul(0.45));
      // (a little towards the sun: the map's own picture of the rock is a texel coarse)
      const sun = shade.U.sunColor
        .mul(shade.U.sun)
        .mul(light.gathered(pos, shade.U.webBlur))
        .mul(light.through(pos.add(L.mul(0.035)).add(flat.mul(0.012))));
      const front = saturate(dot(normal, L)).mul(smoothstep(-0.05, 0.12, dot(flat, L)));
      const H = normalize(L.add(V));
      const glint = pow(saturate(dot(normal, H)), 30).mul(shade.U.gloss).mul(0.12);
      const dim = dot(light.through(pos.add(flat.mul(0.03))), vec3(0.3, 0.5, 0.2))
        .mul(0.6)
        .add(0.4);
      const round = shade.sky(normal).mul(albedo).mul(0.95);
      return vec4(sun.mul(albedo.mul(front).add(glint.mul(front))).add(round.mul(dim).mul(shade.U.ambient)), 1);
    })();
    return [cube, figure].map((made) => {
      const material = new NodeMaterial();
      material.side = FrontSide;
      material.positionNode = made.where;
      material.fragmentNode = lit;
      return { geometry: made.geometry, material };
    });
  };

  return { colour, solids, dress, update, there };
}
