// Spores: motes hanging in still air, which the pile grows up through. Like the mushrooms they are one slab
// drawn several times over, each copy a screw step lower and turned, so they loop. Each is a disc as big as the
// lens makes it at its distance, lit by the lamp through whatever stands between.
import { Fn, abs, cameraFar, cameraNear, clamp, cos, dot, float, instancedBufferAttribute, length, perspectiveDepthToViewZ, positionView, screenUV, sin, smoothstep, uniform, uv, vec3, vec4 } from "three/tsl";
import type { Node, TextureNode } from "three/webgpu";
import { AdditiveBlending, InstancedBufferAttribute, Sprite, SpriteNodeMaterial, Vector3 } from "three/webgpu";
import { mulberry } from "./sim.ts";

export function createMotes(head: { T: number; H: number; TURN: number }, lampAt: (p: Node<"vec3">, off: Node<"float">) => { E: Node<"vec3"> }, depth: TextureNode, per = 420, copies = 3) {
  const R = mulberry(5);
  const count = per * copies;
  const place = new Float32Array(count * 4); // radius, angle, height in the slab, copy
  const sway = new Float32Array(count * 4); // how far it wanders, how often in a loop, where it starts, size
  for (let g = 0; g < copies; g++)
    for (let i = 0; i < per; i++) {
      const o = (g * per + i) * 4;
      if (g === 0) {
        place.set([0.12 + 1.65 * Math.sqrt(R()), R() * 6.2832, R() * head.H, 0], o);
        sway.set([0.02 + 0.07 * R(), 1 + Math.floor(R() * 3), R() * 6.2832, 0.4 + 1.2 * R() * R()], o);
      } else {
        place.set(place.subarray(i * 4, i * 4 + 4), o);
        place[o + 3] = g;
        sway.set(sway.subarray(i * 4, i * 4 + 4), o);
      }
    }
  const U = {
    phase: uniform(0), // 0..1 through the loop
    size: uniform(0.0035),
    bright: uniform(0.5),
    cool: uniform(0.08), // light from outside on them, whatever the lamp does
    eye: uniform(new Vector3()),
    ahead: uniform(new Vector3(0, 0, -1)),
    focus: uniform(8),
    range: uniform(1.6),
    blur: uniform(8), // the lens' largest disc, pixels
    pixel: uniform(0.001), // world size of a pixel a unit away
    top: uniform(1.7),
    bottom: uniform(-2.0),
  };
  const a = instancedBufferAttribute(new InstancedBufferAttribute(place, 4)) as unknown as Node<"vec4">;
  const b = instancedBufferAttribute(new InstancedBufferAttribute(sway, 4)) as unknown as Node<"vec4">;

  const centre = Fn(() => {
    const step = a.w.add(U.phase);
    const turn = a.y.sub(step.mul(head.TURN));
    const beat = U.phase.mul(6.2832).mul(b.y).add(b.z);
    // high in the stage when new, sinking as the stage climbs past
    const y = float(U.top).add(a.z).sub(step.mul(head.H));
    const r = a.x.add(sin(beat).mul(b.x));
    return vec3(cos(turn).mul(r), y.add(cos(beat.mul(1).add(1.3)).mul(b.x)), sin(turn).mul(r));
  })().toVar();

  const material = new SpriteNodeMaterial();
  material.transparent = true;
  material.blending = AdditiveBlending;
  material.depthTest = false;
  material.depthWrite = false;
  material.positionNode = centre;
  const far = dot(centre.sub(U.eye), U.ahead);
  const disc = abs(clamp(far.sub(U.focus).div(U.range), -1, 1)).mul(U.blur).mul(U.pixel).mul(far);
  const own = U.size.mul(b.w);
  const radius = own.add(disc);
  material.scaleNode = radius.mul(2);
  // the same light spread over a bigger disc is dimmer; gone at the ends of its fall
  const fade = smoothstep(U.bottom, U.bottom.add(0.5), centre.y).mul(smoothstep(U.top.add(0.1), U.top.sub(0.5), centre.y));
  const glow = lampAt(centre, float(0)).E.add(vec3(0.45, 0.62, 1).mul(U.cool)).mul(U.bright).mul(own.mul(own).div(radius.mul(radius))).mul(fade).toVarying();
  material.colorNode = Fn(() => {
    const d = length(uv().sub(0.5)).mul(2);
    const behind = perspectiveDepthToViewZ(depth.sample(screenUV).r, cameraNear, cameraFar);
    const seen = smoothstep(-0.02, 0.0, positionView.z.sub(behind));
    return vec4(glow.mul(smoothstep(1, 0.75, d)).mul(seen), 1);
  })();
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  return { sprite, U };
}
