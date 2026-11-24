// A lens: things off the focal plane are spread into discs. One gather pass. Each pixel looks at a spiral of
// neighbours and takes those whose own disc reaches it; a neighbour further off than the pixel itself is
// allowed no more reach than the pixel has, so the background does not creep over a sharp stem.
import { Fn, Loop, abs, clamp, convertToTexture, cos, float, min, screenSize, screenUV, select, sin, smoothstep, sqrt, vec2, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";

export function lens(colour: Node<"vec3">, viewZ: Node<"float">, focus: Node<"float">, range: Node<"float">, radius: Node<"float">, taps = 40) {
  // -1 nearer than the focal plane .. 1 beyond it
  const off = clamp(viewZ.negate().sub(focus).div(range), -1, 1);
  const pre = convertToTexture(vec4(colour, off));
  return Fn(() => {
    const here = pre.sample(screenUV).level(float(0));
    const mine = abs(here.a).mul(radius);
    const sum = vec4(here.rgb, 1).toVar();
    const px = vec2(1).div(screenSize);
    Loop(taps, ({ i }) => {
      const fi = float(i).add(0.5);
      const d = sqrt(fi.div(taps)).mul(radius);
      const a = fi.mul(2.39996323);
      const s = pre.sample(screenUV.add(vec2(cos(a), sin(a)).mul(d).mul(px))).level(float(0));
      const its = abs(s.a).mul(radius);
      const reach = select(s.a.lessThan(here.a), its, min(its, mine));
      sum.addAssign(vec4(s.rgb, 1).mul(smoothstep(d.sub(1.5), d.add(0.5), reach)));
    });
    return vec4(sum.rgb.div(sum.a), 1);
  })();
}
