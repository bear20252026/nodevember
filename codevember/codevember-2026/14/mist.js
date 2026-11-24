import * as THREE from "three/webgpu";
import {
  Fn,
  color,
  mix,
  rtt,
  screenUV,
  uniform,
  vec2,
  vec3,
  vec4,
  mx_noise_float,
  mx_fractal_noise_float,
} from "three/tsl";

export function createMist(clock, aspect) {
  const position = uniform(new THREE.Vector3());
  const tangent = uniform(Math.tan((23 * Math.PI) / 180));
  const strength = uniform(1);
  const referenceTangent = Math.tan((23 * Math.PI) / 180);
  const centered = screenUV
    .sub(0.5)
    .mul(vec2(aspect, 1))
    .mul(tangent.div(referenceTangent));
  // Screen Y points down, while camera Y points up. Project the camera's
  // lateral travel at each sheet's depth so nearer mist has more parallax.
  const cameraOffset = vec2(position.x, position.y.negate()).div(
    2 * referenceTangent,
  );
  const coordinatesAt = (depth) => centered.add(cameraOffset.div(depth));
  const travel = position.z.div(30).add(clock.mul(0.015));
  const drift = vec2(clock.mul(0.009), clock.mul(-0.004));
  const layers = Array.from({ length: 3 }, (_, i) => {
    const cycle = travel.add(i / 3);
    const generation = cycle.floor();
    const phase = cycle.fract();
    const scale = mix(Math.log(4.2), Math.log(0.6), phase).exp();
    const envelope = phase
      .smoothstep(0, 0.18)
      .mul(phase.smoothstep(0.62, 1).oneMinus());
    const offset = vec2(
      generation.mul(7.13).add(i * 13.7),
      generation.mul(-5.91).add(i * 17.9),
    );
    const distance = scale.reciprocal().mul(24);
    const sample = vec3(
      coordinatesAt(distance)
        .div(scale)
        .mul(vec2(5, 3.6))
        .add(drift)
        .add(offset),
      generation.mul(0.47).add(i * 19.7),
    );
    const noise = Fn(() => {
      const broad = mx_fractal_noise_float(sample, 2, 2, 0.5).toVar();
      // Stretch and gently curl finer wisps inside each moving sheet. They
      // share its fade envelope, so the extra detail never pops at a recycle.
      const fine = mx_fractal_noise_float(
        sample
          .mul(vec3(2.4, 5.2, 1.5))
          .add(vec3(broad.mul(1.4), broad.mul(0.6), clock.mul(0.025))),
        3,
        2,
        0.48,
      );
      // Broad, drifting pockets leave genuinely smooth areas between the
      // turbulent wisps, instead of applying fine noise everywhere.
      const pockets = mx_noise_float(
        sample.mul(0.55).add(vec3(11, 7, clock.mul(0.009))),
      )
        .smoothstep(-0.12, 0.26)
        .pow2();
      return broad
        .mul(0.78)
        .add(fine.mul(0.55).mul(pockets))
        .mul(0.7)
        .add(0.5)
        .smoothstep(0.15, 0.85);
    })();
    return { distance, envelope, noise };
  });
  const palette = mx_noise_float(
    vec3(
      coordinatesAt(70).mul(0.8).add(drift.mul(0.2)),
      travel.mul(0.12).add(17),
    ),
  );
  const fields = Fn(() =>
    vec4(...layers.map((layer) => layer.noise), palette),
  )();
  // Evaluate the costly noise once per frame, then share four channels across
  // the sky and every surface. Depth-dependent fog stays at native resolution.
  const fieldTexture = rtt(fields, null, null, {
    depthBuffer: false,
    resolutionScale: 0.5,
  });
  fieldTexture.name = "fogFields";
  fieldTexture.uvNode = screenUV;
  function apply(input, viewDepth, cached = true) {
    return Fn(() => {
      const sample = (cached ? fieldTexture : fields).toVar();
      const palette = sample.a;
      const sky = (cached ? mist.skyColor : mist.skySource) ?? color("#102b39");
      let tint = mix(color("#173846"), sky, 0.45);
      tint = mix(tint, color("#3b5b4d"), palette.smoothstep(0, 0.5).mul(0.42));
      tint = mix(
        tint,
        color("#6b4140"),
        palette.negate().smoothstep(0, 0.5).mul(0.34),
      );
      const transmission = viewDepth
        .sub(3)
        .max(0)
        .mul(0.016)
        .pow2()
        .mul(strength)
        .negate()
        .exp()
        .toVar();
      const scattered = tint.mul(transmission.oneMinus()).toVar();
      for (let i = 0; i < layers.length; i++) {
        const { distance, envelope } = layers[i];
        const noise = sample[i === 0 ? "r" : i === 1 ? "g" : "b"];
        const amount = envelope
          .mul(noise.mul(0.85).add(0.15))
          .mul(0.45)
          .mul(strength)
          .mul(viewDepth.smoothstep(distance.sub(2), distance.add(2)))
          .mul(viewDepth.smoothstep(5, 20));
        // Overlapping layers multiply their transmission, retaining the
        // shrinking / fading illusion while behaving like pockets of fog.
        const through = amount.negate().exp().toVar();
        const layerTint = tint.mul(noise.mul(0.7).add(0.8));
        scattered.assign(
          scattered.mul(through).add(layerTint.mul(through.oneMinus())),
        );
        transmission.mulAssign(through);
      }
      return input.mul(transmission).add(scattered);
    })();
  }
  const mist = {
    position,
    tangent,
    strength,
    skyColor: null,
    skySource: null,
    fieldTexture,
    coordinatesAt,
    apply,
    dispose: () => fieldTexture.dispose(),
  };
  return mist;
}
