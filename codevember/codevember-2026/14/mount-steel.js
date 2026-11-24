import * as THREE from "three/webgpu";
import {
  color,
  mix,
  texture,
  positionGeometry,
  normalGeometry,
  vec3,
  uniform,
  mx_noise_float,
} from "three/tsl";
import { ironNormal } from "./corrosion.js";

export function createMountSteel(surface, corrosion) {
  const detail = uniform(1);
  const local = positionGeometry.toVarying("mountSteelPosition");
  const weights = normalGeometry.abs().pow(4);
  const total = weights.x.add(weights.y).add(weights.z).max(1e-5);
  const fieldAt = (scale) => {
    const p = local.mul(scale).add(vec3(0.137, 0.371, 0.719));
    return texture(surface.texture, p.yz)
      .mul(weights.x)
      .add(texture(surface.texture, p.xz).mul(weights.y))
      .add(texture(surface.texture, p.xy).mul(weights.z))
      .div(total);
  };
  // Physical-scale grain on every face, including the small bolts and pins.
  const field = fieldAt(2.2),
    fine = fieldAt(8.1);
  const scratches = mx_noise_float(local.mul(vec3(230, 16, 230))).smoothstep(
    0.25,
    0.65,
  );
  const oxide = corrosion.age
    .add(0.04)
    .sub(field.r.mul(0.58))
    .smoothstep(-0.04, 0.1)
    .mul(0.6);
  const steel = mix(
    color("#39434a"),
    color("#7c8589"),
    field.a.mul(0.7).add(0.1),
  );
  const rust = mix(
    color("#3e2b20"),
    color("#9c643b"),
    field.a.mul(0.7).add(0.15),
  );
  const material = new THREE.MeshStandardNodeMaterial({
    name: "Pitted and brushed steel mounting hardware",
  });
  material.colorNode = mix(steel, rust, oxide).mul(fine.a.mul(0.15).add(0.9));
  material.metalnessNode = mix(0.9, 0.18, oxide);
  material.roughnessNode = field.a
    .mul(0.17)
    .add(0.32)
    .add(oxide.mul(0.3))
    .sub(scratches.mul(0.08));
  material.normalNode = ironNormal(
    field.g
      .mul(0.0012)
      .add(fine.b.mul(0.00018))
      .sub(scratches.mul(0.00022))
      .add(oxide.mul(field.r).mul(0.0018))
      .mul(corrosion.relief)
      .mul(detail),
  );
  return { material, detail, dispose: () => material.dispose() };
}
