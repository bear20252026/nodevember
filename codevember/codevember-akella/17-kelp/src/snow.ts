// Marine snow. It belongs to the water, not to the plant: it sinks at a steady pace, past the tip which hardly
// moves and alongside the blades lower down which are leaving as fast, and that is what says the plant is climbing.
// It is one slab of specks drawn again above itself; in a loop it sinks a whole number of slabs.
// Each speck is a disc as big as the lens makes it at its distance, lit by the sun through whatever stands above it.
import { Fn, abs, cameraFar, cameraNear, clamp, dot, exp, float, fract, instancedBufferAttribute, length, perspectiveDepthToViewZ, positionView, screenUV, sin, smoothstep, uniform, uv, vec3, vec4 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { AdditiveBlending, InstancedBufferAttribute, Sprite, SpriteNodeMaterial, Vector3 } from "three/webgpu";
import type { Light } from "./light.ts";

// `carried`: in a current, which takes the specks across the picture (a whole number of slab widths in a loop) as they sink
export function createSnow(light: Light, depth: TextureNode, takes: Node<"vec3">, count = 1400, carried = false) {
  let seed = 11;
  const R = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const SLAB = 2.4; // its height
  const WIDE = 7; // and width
  const place = new Float32Array(count * 4); // x, height in the slab (0..1), z, size
  const sway = new Float32Array(count * 4); // how far it wanders, how often in a loop, where it starts, slabs it sinks in a loop
  for (let i = 0; i < count; i++) {
    place.set([(R() - 0.5) * WIDE, R(), 2.2 - 5.5 * R(), 0.35 + 1.3 * R() * R()], i * 4);
    sway.set([0.03 + 0.08 * R(), 1 + Math.floor(R() * 3), R() * 6.2832, R() < 0.8 ? 1 : 2], i * 4);
  }
  const U = {
    phase: uniform(0),
    size: uniform(0.004),
    bright: uniform(1),
    eye: uniform(new Vector3()),
    ahead: uniform(new Vector3(0, 0, -1)),
    focus: uniform(3),
    range: uniform(1.5),
    blur: uniform(8), // the lens' largest disc, pixels
    pixel: uniform(0.001), // world size of a pixel a unit away
    top: uniform(1.3),
    sunColor: uniform(new Vector3(1, 1, 1)),
    sun: uniform(1),
    dim: uniform(new Vector3(0.1, 0.3, 0.35)), // what they catch of the water's own light
    flow: uniform(1), // slab widths a loop, when carried
  };
  const a = instancedBufferAttribute(new InstancedBufferAttribute(place, 4)) as unknown as Node<"vec4">;
  const b = instancedBufferAttribute(new InstancedBufferAttribute(sway, 4)) as unknown as Node<"vec4">;

  // where across the slab, 0..1, when the current carries it: the nearer specks pass quicker, as they would look to
  const ride = fract(a.x.div(WIDE).add(0.5).add(U.phase.mul(U.flow).mul(b.w)));
  const centre = Fn(() => {
    const beat = U.phase.mul(6.2832).mul(b.y).add(b.z);
    const y = U.top.sub(fract(a.y.add(U.phase.mul(b.w))).mul(SLAB));
    // the swell carries them the way it leans the plant
    const swell = sin(U.phase.mul(12.566).sub(y.mul(0.5))).mul(0.05);
    const x = carried ? ride.sub(0.5).mul(WIDE) : a.x;
    return vec3(x.add(sin(beat).mul(b.x)).add(swell), y, a.z.add(sin(beat.mul(1).add(1.7)).mul(b.x)));
  })().toVar();

  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthTest = false;
  material.depthWrite = false;
  material.positionNode = centre;
  const far = dot(centre.sub(U.eye), U.ahead);
  const disc = abs(clamp(far.sub(U.focus).div(U.range), -1, 1)).mul(U.blur).mul(U.pixel).mul(far);
  const own = U.size.mul(a.w);
  const radius = own.add(disc);
  material.scaleNode = radius.mul(2);
  // gone at the ends of the slab, so none is seen to jump back up; and too near the eye
  const fall = fract(a.y.add(U.phase.mul(b.w)));
  const ends = carried ? smoothstep(0, 0.1, ride).mul(smoothstep(1, 0.9, ride)) : float(1);
  const fade = smoothstep(0, 0.12, fall).mul(smoothstep(1, 0.8, fall)).mul(smoothstep(0.25, 0.9, far)).mul(ends);
  const lit = U.sunColor.mul(U.sun).mul(light.throughWater(centre)).mul(light.gathered(centre, float(1.5))).add(U.dim);
  // the same light spread over a bigger disc is dimmer
  const glow = lit
    .mul(U.bright)
    .mul(own.mul(own).div(radius.mul(radius)))
    .mul(fade)
    .mul(exp(takes.mul(length(centre.sub(U.eye))).negate()))
    .toVarying();
  material.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2);
    const behind = perspectiveDepthToViewZ(depth.sample(screenUV).r, cameraNear, cameraFar);
    const seen = smoothstep(-0.02, 0.0, positionView.z.sub(behind));
    return vec4(glow.mul(smoothstep(1, 0.7, d)).mul(seen), 1);
  })();
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, U };
}
