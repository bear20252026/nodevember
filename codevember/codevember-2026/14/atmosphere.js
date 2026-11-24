import * as THREE from "three/webgpu";
import { createFloatingRocks } from "./floating-rocks.js";
import { createMist } from "./mist.js";
import {
  Fn,
  color,
  float,
  mix,
  rtt,
  screenUV,
  uv,
  vec2,
  vec3,
  uniform,
  output,
  positionView,
  vec4,
  mx_fractal_noise_float,
} from "three/tsl";

export function createAtmosphere(renderer, scene, rockAssets) {
  const clock = uniform(0),
    aspect = uniform(1);
  const mist = createMist(clock, aspect);
  // Broad blue haze drifts across the frame while its softer layers evolve.
  // The shared scene clock keeps this motion in step with pause and playback.
  const drift = vec2(clock.mul(0.017), clock.mul(-0.008));
  const hazeUV = mist
    .coordinatesAt(70)
    .add(vec2(aspect.mul(0.5), 0.5))
    .add(drift);
  const source = vec2(
    clock.mul(0.06).sin().mul(0.035).add(0.91),
    clock.mul(0.05).cos().mul(0.03).add(0.1),
  );
  const p = screenUV.sub(source).mul(vec2(aspect, 1));
  const halo = p.length().mul(1.7).pow2().negate().exp();
  const clouds = mx_fractal_noise_float(
    vec3(hazeUV.mul(vec2(3.1, 3)), clock.mul(0.04)),
    3,
    2,
    0.55,
  )
    .mul(0.7)
    .add(0.68);
  const wisps = mx_fractal_noise_float(
    vec3(hazeUV.mul(vec2(1.4, 5)).sub(drift.mul(2.3)), clock.mul(0.018).add(9)),
    2,
    2,
    0.5,
  )
    .mul(0.5)
    .add(0.65);
  const beam = screenUV.x
    .add(screenUV.y.mul(0.72))
    .sub(clock.mul(0.06).sin().mul(0.035).add(0.98))
    .abs()
    .smoothstep(0.02, 0.29)
    .oneMinus();
  const sky = mix(
    color("#01080d"),
    color("#236b8e").mul(clouds).mul(wisps.mul(0.35).add(0.75)),
    halo.mul(0.48).add(beam.pow2().mul(0.24)).clamp(),
  );
  const skyTexture = rtt(vec4(sky, 1), null, null, {
    depthBuffer: false,
    resolutionScale: 0.5,
  });
  skyTexture.name = "atmosphereColor";
  skyTexture.uvNode = screenUV;
  mist.skySource = sky;
  mist.skyColor = skyTexture.rgb;
  scene.backgroundNode = mist.apply(skyTexture.rgb, float(70));
  // Apply the same fog at each surface's real depth, including transparent
  // distant rocks. It shares its color and moving layers with the background.
  scene.fogNode = Fn(() =>
    vec4(mist.apply(output.rgb, positionView.z.negate()), output.a),
  )();
  const rocks = createFloatingRocks(scene, rockAssets);
  const tent = new THREE.Scene();
  const dark = new THREE.MeshBasicNodeMaterial({
    color: "#030916",
    side: THREE.BackSide,
  });
  tent.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), dark));
  const cards = [
    { p: [-4, 3, 5], s: [3, 6], c: "#c8d5d7", power: 3.8 },
    { p: [4, 4, -2], s: [1.2, 6], c: "#9fbef1", power: 7.0 },
    { p: [-3, -2, -4], s: [1.5, 4], c: "#df9c65", power: 1.4 },
    { p: [1, 5, 5], s: [4, 2], c: "#b2c1c3", power: 1.1 },
    { p: [-1, 2, 6], s: [1.2, 4], c: "#d2d8d6", power: 3 },
  ];
  for (const card of cards) {
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide });
    const edge = uv().sub(0.5).abs().mul(2);
    m.colorNode = color(card.c)
      .mul(card.power)
      .mul(edge.x.smoothstep(0.85, 1).oneMinus())
      .mul(edge.y.smoothstep(0.85, 1).oneMinus());
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(...card.s), m);
    mesh.position.fromArray(card.p);
    mesh.lookAt(0, 0, 0);
    tent.add(mesh);
  }
  const generator = new THREE.PMREMGenerator(renderer),
    environment = generator.fromScene(tent, 0.025, 0.1, 80, { size: 256 });
  generator.dispose();
  tent.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  scene.environment = environment.texture;
  const key = new THREE.DirectionalLight("#ffe6c7", 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, {
    left: -4.5,
    right: 4.5,
    top: 4.5,
    bottom: -4.5,
    near: 0.1,
    far: 20,
  });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0001;
  key.shadow.normalBias = 0.0015;
  key.shadow.radius = 2;
  const warm = new THREE.PointLight("#ffbd7d", 65, 14, 2);
  const rim = new THREE.PointLight("#8eaff0", 72, 16, 2);
  const flash = new THREE.PointLight("#ffbb7e", 0, 5, 2);
  flash.name = "Tension and fracture light";
  scene.add(key, key.target, warm, rim, flash);
  const lightCenter = new THREE.Vector3(),
    target = new THREE.Vector3(),
    lightOffset = new THREE.Vector3();
  let previousTime = null;
  let stressGlow = 0;
  return {
    clock,
    aspect,
    mist,
    skyTexture,
    key,
    warm,
    rim,
    flash,
    fractureLightStrength: 2,
    environment,
    rocks,
    update(
      time,
      z,
      burstAge = -1,
      [x, y] = [0, 0],
      fracture = null,
      tension = 0,
      cameraPosition = null,
      cameraFov = 46,
    ) {
      clock.value = time;
      if (cameraPosition) mist.position.value.copy(cameraPosition);
      mist.tangent.value = Math.tan((cameraFov * Math.PI) / 360);
      rocks.update(time, cameraPosition, aspect.value);
      target.set(x, y, z);
      const dt = time - (previousTime ?? time);
      const reset = previousTime === null || dt < 0 || dt > 0.25;
      if (reset) lightCenter.copy(target);
      else lightCenter.lerp(target, 1 - Math.exp(-dt * 10));
      previousTime = time;
      const load =
        fracture && burstAge < 0
          ? THREE.MathUtils.smoothstep(tension, 0.35, 1)
          : 0;
      if (reset) stressGlow = load;
      else
        stressGlow +=
          (load - stressGlow) *
          (1 - Math.exp(-dt * (load > stressGlow ? 12 : 7)));
      // Follow the actual focal depth, easing the handoff to the next assembly.
      key.position.set(
        lightCenter.x - 3.5,
        lightCenter.y + 2.2,
        lightCenter.z + 0.8,
      );
      key.target.position.copy(lightCenter);
      warm.position.set(
        lightCenter.x - 3.2,
        lightCenter.y + 0.5,
        lightCenter.z + 2.5,
      );
      rim.position.set(
        lightCenter.x + 2.5,
        lightCenter.y + 3,
        lightCenter.z - 1.2,
      );
      if (fracture) {
        flash.position.fromArray(fracture);
        // Keep the source just in front of the visible steel, including when
        // the camera follows a surviving branch after an earlier break.
        if (cameraPosition) {
          lightOffset.copy(cameraPosition).sub(flash.position).normalize();
          flash.position.addScaledVector(lightOffset, 0.35);
        }
      }
      flash.intensity = fracture
        ? (burstAge >= 0
            ? 10 * Math.exp(-burstAge * 8)
            : 4.5 * stressGlow ** 2) * this.fractureLightStrength
        : 0;
    },
    dispose() {
      mist.dispose();
      skyTexture.dispose();
      rocks.dispose();
      environment.dispose();
      key.shadow.dispose();
    },
  };
}
