// The water between the eye and everything: it takes the colour out of what is far (red first), puts its own in,
// and shows the sun as shafts. A shaft is the same web of gathered light that dances on the blades, seen from the
// side all the way down, and the plant stands in it: where the sun map says a blade is in the way the shaft is
// dimmer and amber. Above, the underside of the surface.
import { Fn, Loop, dot, exp, float, getViewPosition, interleavedGradientNoise, length, log2, max, min, mix, normalize, pow, rtt, saturate, screenCoordinate, screenSize, screenUV, select, smoothstep, texture, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { Node, PerspectiveCamera, TextureNode } from "three/webgpu";
import { Vector3 } from "three/webgpu";
import type { Light } from "./light.ts";
import type { createLook } from "./look.ts";

export function createWater(light: Light, look: ReturnType<typeof createLook>, colour: TextureNode, depth: TextureNode, camera: PerspectiveCamera, tick: Node<"float">, shaft: { steps?: number; scale?: number } = {}) {
  const U = {
    takes: uniform(new Vector3(0.2, 0.07, 0.05)), // what a unit of water keeps of red, green, blue
    haze: uniform(0.11), // how fast the water's own colour comes in
    top: uniform(3.2), // how far above the tip the surface is
    surface: uniform(1.4),
    glare: uniform(3),
    shafts: uniform(0.16),
    shaftSize: uniform(2.6), // the web the shafts are cut from, over the one on the blades
    shaftBlur: uniform(2.5),
    gap: uniform(1), // how dark the water between shafts may get, of the even light (the plant's own shadow may be all dark)
    eye: uniform(new Vector3()),
  };
  const projInv = uniform(camera.projectionMatrixInverse);
  const camWorld = uniform(camera.matrixWorld);
  const L = light.U.dir;
  const web = texture(light.web.texture);
  // the shafts: how many steps along each ray, and the size they are made at, of the picture's
  const STEPS = shaft.steps ?? 28;

  // what is seen along the picture's ray here: which way it goes and how far to the first thing
  const along = () => {
    const d = depth.sample(screenUV).r;
    const seen = getViewPosition(screenUV, d, projInv);
    const ray = normalize(camWorld.mul(vec4(seen, 0)).xyz);
    const empty = d.greaterThanEqual(0.99999);
    return { ray, empty, far: select(empty, float(60), length(seen)), toSun: saturate(dot(ray, L)) };
  };

  // shafts: walk the ray, adding the sun wherever it gets to. They are soft, so they are made at half size
  const shafts = rtt(
    Fn(() => {
      const { ray, far, toSun } = along();
      const reach = min(far, 7);
      const jitter = interleavedGradientNoise(screenCoordinate.xy.add(tick.mul(5.3)));
      const beam = vec3(0).toVar();
      Loop(STEPS, ({ i }) => {
        const t = reach.mul(float(i).add(jitter).div(STEPS));
        const p = U.eye.add(ray.mul(t));
        const lit = web
          .sample(light.spread(p).div(light.U.webSize.mul(U.shaftSize)))
          .level(U.shaftBlur)
          .r.div(1.25);
        // only what differs from the even light the water already has: brighter in a shaft, darker behind a blade
        beam.addAssign(
          light
            .throughWater(p)
            .mul(mix(float(1), lit, light.U.web).max(U.gap.oneMinus()))
            .sub(1)
            .mul(exp(U.takes.mul(t).negate())),
        );
      });
      // light is thrown mostly onward, so a shaft is brightest looked up along
      const forward = pow(toSun, 3).mul(0.85).add(0.15);
      return vec4(beam.mul(reach.div(STEPS)).mul(look.U.sunColor).mul(look.U.up.mul(3)).mul(forward), 1);
    })(),
    null,
    null,
    { resolutionScale: shaft.scale ?? 0.5 },
  );

  const node = Fn(() => {
    const { ray, empty, far, toSun } = along();
    // the water's colour in a direction: lighter up, and round the sun
    const own = look.sky(ray).add(look.U.up.mul(pow(toSun, 5)).mul(0.9));

    // the surface from below: a bright rippled ceiling, burning where the sun stands behind it
    const rise = max(ray.y, 1e-3);
    const way = U.top.sub(U.eye.y).div(rise);
    const hit = U.eye.add(ray.mul(way));
    // the same web read twice, at two sizes and turned, so that no tile of it shows
    const blur = log2(way.mul(0.45)).clamp(0, 6);
    const turned = vec2(hit.x.mul(0.8).add(hit.z.mul(0.6)), hit.z.mul(0.8).sub(hit.x.mul(0.6)));
    const ripple = web
      .sample(hit.xz.div(light.U.webSize.mul(1.9)))
      .level(blur)
      .r.mul(web.sample(turned.div(light.U.webSize.mul(4.3))).level(blur.sub(1).max(0)).r)
      .div(1.5)
      .pow(0.7);
    const ceiling = look.U.up
      .mul(U.surface)
      .mul(ripple.mul(0.5).add(0.5))
      .mul(pow(toSun, 3).mul(0.85).add(0.15))
      .add(look.U.sunColor.mul(U.glare).mul(pow(toSun, 14)).mul(ripple.mul(0.7).add(0.3)))
      .mul(smoothstep(0.05, 0.5, ray.y));
    const behind = select(empty, ceiling.mul(exp(U.takes.mul(way).negate())), colour.sample(screenUV).rgb.mul(exp(U.takes.mul(far).negate())));
    const veil = float(1).sub(exp(U.haze.mul(select(empty, way, far)).negate()));
    // four reads a pixel apart: the dither the walk was started with is gone in their mean
    const px = vec2(1).div(screenSize);
    const beams = shafts
      .sample(screenUV.add(px.mul(vec2(1, 1))))
      .add(shafts.sample(screenUV.add(px.mul(vec2(-1, 1)))))
      .add(shafts.sample(screenUV.add(px.mul(vec2(1, -1)))))
      .add(shafts.sample(screenUV.add(px.mul(vec2(-1, -1)))))
      .rgb.mul(0.25);
    return vec4(behind.add(own.mul(veil)).add(beams.mul(U.shafts)).max(0), 1);
  })();

  return { U, node, takes: U.takes };
}
