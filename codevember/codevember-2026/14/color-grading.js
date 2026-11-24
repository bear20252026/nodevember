import { Color } from "three/webgpu";
import { Fn, mix, uniform, vec3 } from "three/tsl";

export const COLOR_GRADING_DEFAULTS = Object.freeze({
  saturation: 1.5,
  contrast: 1.5,
  vibrance: 0,
  temperature: 0.75,
  tint: 1,
  shadows: 0,
  midtones: 0,
  highlights: 0,
  shadowColor: "#4879b9",
  shadowTint: 0,
  highlightColor: "#f3ba82",
  highlightTint: 0,
});

export function createColorGrading() {
  const controls = Object.fromEntries(
    Object.entries(COLOR_GRADING_DEFAULTS).map(([key, value]) => [
      key,
      uniform(
        typeof value === "string"
          ? new Color(value).convertLinearToSRGB()
          : value,
      ),
    ]),
  );
  const weights = vec3(0.2126, 0.7152, 0.0722);
  function apply(input) {
    return Fn(() => {
      // Work after tone mapping, so the same grade affects sky, metal and glow.
      // Temperature moves blue ↔ amber; tint moves green ↔ magenta.
      const balance = vec3(
        controls.temperature.mul(0.3).add(controls.tint.mul(0.1)),
        controls.tint.mul(-0.15),
        controls.temperature.mul(-0.3).add(controls.tint.mul(0.1)),
      ).exp2();
      const rgb = input.mul(balance).toVar();
      const luminance = rgb.dot(weights).clamp().toVar();
      const shadowMask = luminance.smoothstep(0.05, 0.65).oneMinus().pow2();
      const highlightMask = luminance.smoothstep(0.35, 0.95);
      rgb.addAssign(controls.shadows.mul(0.18).mul(shadowMask));
      rgb.addAssign(controls.highlights.mul(0.25).mul(highlightMask));
      rgb.assign(rgb.max(0).pow(controls.midtones.mul(-0.7).exp2()));
      rgb.assign(rgb.sub(0.18).mul(controls.contrast).add(0.18));
      // Add only the tint's chroma: selecting a color doesn't wash out its
      // tonal range with a flat overlay. Both tint strengths start at zero.
      rgb.addAssign(
        controls.shadowColor
          .sub(controls.shadowColor.dot(weights))
          .mul(controls.shadowTint)
          .mul(shadowMask)
          .mul(0.25),
      );
      rgb.addAssign(
        controls.highlightColor
          .sub(controls.highlightColor.dot(weights))
          .mul(controls.highlightTint)
          .mul(highlightMask)
          .mul(0.25),
      );
      const maximum = rgb.r.max(rgb.g).max(rgb.b);
      const minimum = rgb.r.min(rgb.g).min(rgb.b);
      const colorfulness = maximum.sub(minimum).div(maximum.max(0.001)).clamp();
      const saturation = controls.saturation.mul(
        controls.vibrance.mul(colorfulness.oneMinus()).add(1),
      );
      return mix(vec3(rgb.dot(weights)), rgb, saturation).max(0);
    })();
  }
  function update(settings) {
    for (const [key, value] of Object.entries(controls)) {
      if (value.value.isColor)
        value.value.set(settings[key]).convertLinearToSRGB();
      else value.value = settings[key];
    }
  }
  return { controls, apply, update };
}
