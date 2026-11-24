import { g as i } from "./leva.js";
function g({
  renderer: v,
  pipeline: t,
  lights: u = [],
  pcss: r = [],
  onChange: l = () => {},
}) {
  const a = t.look,
    s = u.map((e) => e.shadow.radius),
    n = (e) => (o) => {
      ((e.value = o), l());
    };
  return {
    Finish: i(
      {
        Exposure: {
          value: a.exposure.value,
          min: 0.1,
          max: 4,
          step: 0.01,
          onChange: n(a.exposure),
        },
        Film: {
          value: t.tonemapper,
          options: ["agx", "aces", "neutral", "none"],
          onChange: (e) => {
            (t.setTonemapper(e), l());
          },
        },
        Colour: {
          value: a.saturation.value,
          min: 0,
          max: 2,
          step: 0.01,
          onChange: n(a.saturation),
        },
        Punch: {
          value: a.contrast.value,
          min: 0.5,
          max: 1.5,
          step: 0.01,
          onChange: n(a.contrast),
        },
        Tint: {
          value: a.tint.value,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: n(a.tint),
        },
        Fade: {
          value: a.fade.value,
          min: 0,
          max: 0.5,
          step: 0.005,
          onChange: n(a.fade),
        },
        ...(t.bloom
          ? {
              Glow: {
                value: t.bloom.strength.value,
                min: 0,
                max: 0.3,
                step: 0.001,
                onChange: (e) => {
                  ((t.bloom.strength.value = e), l());
                },
              },
              "Glow spread": {
                value: t.bloom.radius.value,
                min: 0,
                max: 1,
                step: 0.01,
                onChange: (e) => {
                  ((t.bloom.radius.value = e), l());
                },
              },
            }
          : {}),
        ...(a.halation
          ? {
              Halation: {
                value: a.halation.value,
                min: 0,
                max: 1,
                step: 0.01,
                onChange: n(a.halation),
              },
            }
          : {}),
        Vignette: {
          value: a.vignette.value,
          min: 0,
          max: 1,
          step: 0.005,
          onChange: n(a.vignette),
        },
        Grain: {
          value: a.grain.value,
          min: 0,
          max: 0.15,
          step: 0.001,
          onChange: n(a.grain),
        },
        ...(a.aberration
          ? {
              Fringe: {
                value: 0,
                min: 0,
                max: 1,
                step: 0.01,
                onChange: n(a.aberration),
              },
            }
          : {}),
        ...(u.length
          ? {
              "Cast shadows": {
                value: !0,
                onChange: (e) => {
                  (u.forEach((o) => {
                    o.castShadow = e;
                  }),
                    l());
                },
              },
              Softness: {
                value: 1,
                min: 0,
                max: 4,
                step: 0.05,
                onChange: (e) => {
                  (u.forEach((o, m) => {
                    o.shadow.radius = s[m] * e;
                  }),
                    r.forEach((o) => {
                      o.softness.value = e;
                    }),
                    l());
                },
              },
              Softbox: {
                value: r[0]?.lightSize.value ?? 0.3,
                min: 0,
                max: 0.6,
                step: 0.005,
                onChange: (e) => {
                  (r.forEach((o) => {
                    o.lightSize.value = e;
                  }),
                    l());
                },
              },
            }
          : {}),
        ...(a.aoStrength
          ? {
              Contact: {
                value: a.aoStrength.value,
                min: 0,
                max: 2,
                step: 0.01,
                onChange: n(a.aoStrength),
              },
            }
          : {}),
        ...(a.clipWarning
          ? {
              "Blown highlights": {
                value: !1,
                onChange: (e) => {
                  ((a.clipWarning.value = e ? 1 : 0), l());
                },
              },
            }
          : {}),
      },
      { collapsed: !0 },
    ),
  };
}
export { g as r };
