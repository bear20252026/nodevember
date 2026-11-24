// Spores pouring from the ripe caps. A cap lets them go in spells, from its gills, and each falls slowly through
// still air, wandering as smoke does. Every spore is a fixed moment in its mushroom's life: where the cap was then
// is read off the baked track, and where the spore has got to since is a formula of how long ago that was. So a
// pour is replayed with its mushroom, a screw step lower each time round, and the loop stays whole.
// The page finds where each spore was let go (no sines in that); the fall and the wandering are worked out as it
// is drawn. Done all on the page, forty thousand spores took 7 ms a frame.
import { Fn, abs, cameraFar, cameraNear, clamp, cos, dot, exp, float, floor, fract, instancedBufferAttribute, length, max, min, perspectiveDepthToViewZ, positionView, screenUV, sin, smoothstep, sqrt, uniform, uv, vec3, vec4 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { AdditiveBlending, DynamicDrawUsage, InstancedBufferAttribute, Sprite, SpriteNodeMaterial, Vector3 } from "three/webgpu";
import { mulberry } from "./sim.ts";
import type { Stage } from "./stage.ts";

const LIFE = [3.5, 7]; // seconds a spore is seen for
const STEP = 0.2; // how finely a cap's past is looked up, seconds
const PAST = Math.ceil(LIFE[1] / STEP) + 2;
const F = 6; // numbers kept for a spore: when, how long, how fast, where on the gills (2), size and brightness

export function createPour(stage: Stage, lampAt: (p: Node<"vec3">, off: Node<"float">) => { E: Node<"vec3"> }, depth: TextureNode, room = 90000) {
  const { T, H, TURN, DEPTH, fps, keys } = stage.head;
  const R = mulberry(23);
  // ---- every spore each key will ever let go, in the order they go
  const spores: Float32Array[] = [];
  const PER = 520; // in a spell, at the most
  for (const k of keys) {
    const list: number[][] = [];
    let at = k.pop + 1 + 2.5 * R();
    while (at < k.life - 1.5) {
      const spell = 2.2 + 2.8 * R();
      const n = Math.round(PER * (0.45 + 0.55 * R()));
      for (let i = 0; i < n; i++) {
        // thick at first, thinning out
        const a = at + spell * (1 - Math.sqrt(1 - R()));
        const r = Math.sqrt(0.08 + 0.92 * R()),
          th = R() * 6.2832;
        list.push([a, LIFE[0] + (LIFE[1] - LIFE[0]) * R(), 0.6 + 0.8 * R(), r * Math.cos(th), r * Math.sin(th), Math.floor(R() * 8) + 0.15 + 0.8 * R() * R()]);
      }
      at += spell + 2 + 4.5 * R();
    }
    list.sort((p, q) => p[0] - q[0]);
    const flat = new Float32Array(list.length * F);
    list.forEach((s, i) => flat.set(s, i * F));
    spores.push(flat);
  }

  const place = new Float32Array(room * 4); // where it was let go, and how long ago
  const kind = new Float32Array(room * 4); // how fast it falls, how long it lasts, where in the air's wandering it is, (size class + how bright)
  const attr = new InstancedBufferAttribute(place, 4);
  const attr2 = new InstancedBufferAttribute(kind, 4);
  attr.setUsage(DynamicDrawUsage);
  attr2.setUsage(DynamicDrawUsage);
  const a = instancedBufferAttribute(attr) as unknown as Node<"vec4">;
  const b = instancedBufferAttribute(attr2) as unknown as Node<"vec4">;
  const U = {
    size: uniform(0.0016),
    bright: uniform(1),
    cool: uniform(0.5), // light from outside on them: up among the caps the lamp hardly reaches
    fall: uniform(0.22), // units a second
    stray: uniform(0.07), // how far a pour wanders as it falls
    spread: uniform(0.035), // and each spore on its own
    bottom: uniform(-2.3),
    eye: uniform(new Vector3()),
    ahead: uniform(new Vector3(0, 0, -1)),
    focus: uniform(8),
    range: uniform(1.6),
    blur: uniform(8),
    pixel: uniform(0.001),
  };
  // let go, it gathers speed for a moment and then just falls, straying as it goes: all of a pour the same way at
  // the same height, and a little on its own
  const since = a.w;
  const fell = U.fall.mul(b.x).mul(since.sub(float(1).sub(exp(since.mul(-2.5))).div(2.5)));
  const h = b.z.sub(fell.mul(2.3));
  const stray = U.stray.mul(float(1).sub(exp(since.div(-2.5))));
  const own = U.spread.mul(sqrt(since)).mul(sqrt(fract(sin(b.y.mul(12.9).add(b.x.mul(78.2))).mul(24634.6))));
  const way = fract(sin(b.y.mul(91.7).add(b.x.mul(47.3))).mul(43758.5)).mul(6.2832);
  const centre = a.xyz
    .add(
      vec3(
        stray.mul(sin(h).add(sin(h.mul(2.2).add(1.3)).mul(0.5))).add(own.mul(cos(way))),
        fell.negate(),
        stray.mul(cos(h.mul(1.13).add(2.1)).add(sin(h.mul(1.9).add(4)).mul(0.5))).add(own.mul(sin(way))),
      ),
    )
    .toVar();
  const seen = min(float(1), since.div(0.3))
    .mul(min(float(1), b.y.sub(since).div(b.y.mul(0.45))))
    .mul(smoothstep(U.bottom, U.bottom.add(0.3), centre.y));
  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthTest = false;
  material.depthWrite = false;
  material.positionNode = centre;
  const far = dot(centre.sub(U.eye), U.ahead);
  const disc = abs(clamp(far.sub(U.focus).div(U.range), -1, 1)).mul(U.blur).mul(U.pixel).mul(far);
  const mine = U.size.mul(floor(b.w).mul(0.11).add(0.6));
  // never smaller than a pixel can show: a smaller spore is a dimmer pixel
  const radius = max(mine.add(disc), U.pixel.mul(far).mul(0.8));
  material.scaleNode = radius.mul(2);
  const glow = lampAt(centre, float(0)).E.add(vec3(0.45, 0.62, 1).mul(U.cool)).mul(U.bright).mul(fract(b.w)).mul(seen).mul(mine.mul(mine).div(radius.mul(radius))).toVarying();
  material.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2);
    const behind = perspectiveDepthToViewZ(depth.sample(screenUV).r, cameraNear, cameraFar);
    const clear = smoothstep(-0.02, 0.0, positionView.z.sub(behind));
    return vec4(glow.mul(smoothstep(1, 0.6, d)).mul(clear), 1);
  })();
  const sprite = new Sprite(material);
  sprite.count = 0;
  sprite.frustumCulled = false;

  const past = new Float64Array(PAST * 12); // a cap's top, its stem's end and two directions across that
  const tune = { share: 1, count: 0 };

  // every spore in the air `t` seconds into the loop
  const update = (t: number) => {
    const v = H / T;
    const bottom = U.bottom.value,
      fall = U.fall.value;
    let n = 0;
    for (let ki = 0; ki < keys.length && tune.share > 0; ki++) {
      const k = keys[ki];
      if (stage.rank[ki] >= stage.share * keys.length) continue;
      const list = spores[ki];
      const total = list.length / F;
      const swirl = k.seed * 40;
      const reach = k.cap * 0.84;
      for (let g = 0; ; g++) {
        const age = t - k.tau + g * T;
        if (age < 0) continue;
        if (age >= k.life) break;
        // those let go within a spore's lifetime of now
        let lo = 0,
          hi = total;
        while (lo < hi) {
          const m = (lo + hi) >> 1;
          if (list[m * F] < age - LIFE[1]) lo = m + 1;
          else hi = m;
        }
        if (lo >= total || list[lo * F] > age) continue;
        const phase = g + t / T;
        const turn = -phase * TURN;
        const ca = Math.cos(turn),
          sa = Math.sin(turn);
        const rx = k.x * ca - k.z * sa,
          rz = k.x * sa + k.z * ca,
          ry = -DEPTH + k.y - v * age;
        let known = 0;
        for (let i = lo; i < total; i++) {
          const o = i * F;
          const p = age - list[o];
          if (p < 0) break;
          const life = list[o + 1];
          if (p >= life || (i * 0.618034) % 1 >= tune.share) continue;
          const back = p / STEP;
          const b0 = Math.floor(back);
          // where the cap has been and how it was tilted, every STEP back from now, as far back as is asked for
          while (known <= b0 + 1) {
            const f = (age - known * STEP - k.a0) * fps;
            const q = known * 12;
            stage.topAt(ki, k.frames, f, past, q);
            stage.topAt(ki, k.frames, f, past, q + 3, 1);
            let ax = past[q] - past[q + 3],
              ay = past[q + 1] - past[q + 4],
              az = past[q + 2] - past[q + 5];
            const al = Math.hypot(ax, ay, az) || 1;
            ax /= al;
            ay /= al;
            az /= al;
            // two directions across the stem's end: the plane of the gills
            let ux = 1 - ax * ax,
              uy = -ax * ay,
              uz = -ax * az;
            const ul = Math.hypot(ux, uy, uz) || 1;
            ux /= ul;
            uy /= ul;
            uz /= ul;
            past[q + 3] = ax;
            past[q + 4] = ay;
            past[q + 5] = az;
            past[q + 6] = ux;
            past[q + 7] = uy;
            past[q + 8] = uz;
            past[q + 9] = ay * uz - az * uy;
            past[q + 10] = az * ux - ax * uz;
            past[q + 11] = ax * uy - ay * ux;
            known++;
          }
          const w = back - b0,
            q0 = b0 * 12,
            q1 = q0 + 12;
          // it leaves the gills going outward, clear of its own stem
          const out = 1 + (0.9 * p) / (p + 0.7);
          const gx = list[o + 3] * reach,
            gz = list[o + 4] * reach;
          const under = 0.22 * k.cap * (list[o + 3] * list[o + 3] + list[o + 4] * list[o + 4]);
          const x = past[q0] + (past[q1] - past[q0]) * w + (past[q0 + 6] * gx + past[q0 + 9] * gz) * out - past[q0 + 3] * under,
            y = past[q0 + 1] + (past[q1 + 1] - past[q0 + 1]) * w + (past[q0 + 7] * gx + past[q0 + 10] * gz) * out - past[q0 + 4] * under,
            z = past[q0 + 2] + (past[q1 + 2] - past[q0 + 2]) * w + (past[q0 + 8] * gx + past[q0 + 11] * gz) * out - past[q0 + 5] * under;
          const Y = ry + y;
          // fallen out of the picture already, near enough
          if (Y - fall * list[o + 2] * (p - 0.4) < bottom || n >= room) continue;
          place[n * 4] = rx + x * ca - z * sa;
          place[n * 4 + 1] = Y;
          place[n * 4 + 2] = rz + x * sa + z * ca;
          place[n * 4 + 3] = p;
          kind[n * 4] = list[o + 2];
          kind[n * 4 + 1] = life;
          kind[n * 4 + 2] = (k.y + y) * 2.3 + swirl + 0.45 * list[o];
          kind[n * 4 + 3] = list[o + 5];
          n++;
        }
      }
    }
    sprite.count = tune.count = n;
    attr.clearUpdateRanges();
    attr.addUpdateRange(0, n * 4);
    attr.needsUpdate = true;
    attr2.clearUpdateRanges();
    attr2.addUpdateRange(0, n * 4);
    attr2.needsUpdate = true;
  };
  return { sprite, U, tune, update };
}
