import * as THREE from "three/webgpu";
import { mix, uv, vec3, vec4 } from "three/tsl";
import {
  COLOR_GRADING_DEFAULTS,
  createColorGrading,
} from "../color-grading.js";

export async function checkColorGrading(app) {
  const grade = createColorGrading();
  const source = vec3(
    uv().x.mul(0.95).add(0.025),
    uv().y.mul(0.9).add(0.05),
    0.35,
  );
  const material = new THREE.MeshBasicNodeMaterial();
  material.fragmentNode = vec4(grade.apply(source), 1);
  material.toneMapped = false;
  const reference = new THREE.MeshBasicNodeMaterial();
  reference.fragmentNode = vec4(
    mix(
      vec3(source.dot(vec3(0.2126, 0.7152, 0.0722))),
      source,
      COLOR_GRADING_DEFAULTS.saturation,
    ).max(0),
    1,
  );
  reference.toneMapped = false;
  const quad = new THREE.QuadMesh(material);
  const target = new THREE.RenderTarget(128, 96, { type: THREE.HalfFloatType });
  const renderer = app.renderer,
    previous = renderer.getRenderTarget();
  const read = async (settings = {}, override = material) => {
    // The neutral reference is independent of the experiment's chosen grade.
    grade.update({
      ...COLOR_GRADING_DEFAULTS,
      contrast: 1,
      temperature: 0,
      tint: 0,
      ...settings,
    });
    quad.material = override;
    await new Promise(requestAnimationFrame);
    renderer.setRenderTarget(target);
    quad.render(renderer);
    renderer.setRenderTarget(previous);
    const values = Float32Array.from(
      await renderer.readRenderTargetPixelsAsync(target, 0, 0, 128, 96),
      THREE.DataUtils.fromHalfFloat,
    );
    if (!values.every(Number.isFinite))
      throw new Error("Non-finite color grading pixels");
    return values;
  };
  const difference = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 4)
      for (let k = 0; k < 3; k++) sum += Math.abs(a[i + k] - b[i + k]);
    return sum / ((a.length / 4) * 3);
  };
  try {
    const base = await read();
    const neutralError = difference(base, await read({}, reference));
    if (neutralError > 0.0002)
      throw new Error(
        "Neutral grading must preserve the existing saturation look",
      );
    const effects = {};
    for (const [key, value] of Object.entries({
      contrast: 1.4,
      saturation: 0,
      vibrance: 1,
      temperature: 1,
      tint: 1,
      shadows: 0.8,
      midtones: 0.8,
      highlights: 0.8,
      shadowTint: 1,
      highlightTint: 1,
    })) {
      const pixels = await read({ [key]: value });
      effects[key] = difference(base, pixels);
      if (effects[key] < 0.002)
        throw new Error(`${key} must visibly change the grade`);
      if (key === "saturation")
        for (let i = 0; i < pixels.length; i += 4)
          if (
            Math.abs(pixels[i] - pixels[i + 1]) +
              Math.abs(pixels[i] - pixels[i + 2]) >
            0.001
          )
            throw new Error("Zero saturation must produce grayscale");
    }
    for (const direction of [-1, 1])
      await read({
        contrast: direction > 0 ? 1.75 : 0.5,
        saturation: 2.5,
        vibrance: direction,
        temperature: direction,
        tint: direction,
        shadows: direction,
        midtones: direction,
        highlights: direction,
        shadowTint: 1,
        highlightTint: 1,
      });
    if (difference(base, await read()) > 1e-6)
      throw new Error("Resetting the grade must restore the image");
    return { neutralError, effects };
  } finally {
    renderer.setRenderTarget(previous);
    material.dispose();
    reference.dispose();
    target.dispose();
  }
}
