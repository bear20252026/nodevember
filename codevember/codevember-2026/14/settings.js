import GUI from "three/addons/libs/lil-gui.module.min.js";
import { COLOR_GRADING_DEFAULTS } from "./color-grading.js";

export function createSettings() {
  return {
    auto: true,
    speed: 1,
    strength: 1,
    rust: 0.18,
    relief: 0.65,
    exposure: 1,
    environment: 0.8,
    fractureLight: 4,
    bloom: 0.12,
    lensBlur: 1.6,
    dust: 0,
    vignette: 1.05,
    ...COLOR_GRADING_DEFAULTS,
    resolution: 0,
  };
}

export function createSettingsPanel(settings, { setAuto, resize, changed }) {
  const gui = new GUI({ title: "Settings", width: 238 });
  const sequence = gui.addFolder("Tension & fracture");
  sequence
    .add(settings, "auto")
    .name("Automatic pulling")
    .listen()
    .onChange(setAuto);
  sequence.add(settings, "speed", 0.2, 1.8, 0.05).name("Playback speed");
  sequence.add(settings, "strength", 0.6, 1.6, 0.05).name("Link strength");
  const material = gui.addFolder("Iron & oxide");
  material.add(settings, "rust", 0, 1, 0.01).name("Corrosion");
  material.add(settings, "relief", 0, 2, 0.05).name("Surface relief");
  material.close();
  const light = gui.addFolder("Light & lens");
  light.add(settings, "environment", 0, 2, 0.05).name("Reflected light");
  light.add(settings, "fractureLight", 0, 4, 0.05).name("Fracture light");
  light.add(settings, "bloom", 0, 0.6, 0.01).name("Bloom");
  light.add(settings, "lensBlur", 0, 4, 0.1).name("Depth of field");
  light.add(settings, "dust", 0, 1, 0.05).name("Dust");
  light.add(settings, "vignette", 0, 1.8, 0.05).name("Vignette");
  light
    .add(settings, "resolution", {
      "Native DPR": 0,
      "1×": 1,
      "1.5×": 1.5,
      "2×": 2,
    })
    .name("Resolution")
    .onChange(resize);
  light.close();
  const grade = gui.addFolder("Color grading");
  grade.add(settings, "exposure", 0.4, 2, 0.05).name("Exposure");
  grade.add(settings, "contrast", 0.5, 1.75, 0.01).name("Contrast");
  grade.add(settings, "saturation", 0, 2.5, 0.05).name("Saturation");
  grade.add(settings, "vibrance", -1, 1, 0.05).name("Vibrance");
  grade.add(settings, "temperature", -1, 1, 0.05).name("Temperature");
  grade.add(settings, "tint", -1, 1, 0.05).name("Tint");
  grade.add(settings, "shadows", -1, 1, 0.05).name("Shadows");
  grade.add(settings, "midtones", -1, 1, 0.05).name("Midtones");
  grade.add(settings, "highlights", -1, 1, 0.05).name("Highlights");
  const tones = grade.addFolder("Split toning");
  tones.addColor(settings, "shadowColor").name("Shadow color");
  tones.add(settings, "shadowTint", 0, 1, 0.05).name("Shadow amount");
  tones.addColor(settings, "highlightColor").name("Highlight color");
  tones.add(settings, "highlightTint", 0, 1, 0.05).name("Highlight amount");
  tones.close();
  grade
    .add(
      {
        reset() {
          Object.assign(settings, COLOR_GRADING_DEFAULTS, { exposure: 1 });
          for (const control of grade.controllersRecursive())
            control.updateDisplay();
          changed();
        },
      },
      "reset",
    )
    .name("Reset grading");
  grade.close();
  gui.close();
  gui.onChange(changed);
  return gui;
}
