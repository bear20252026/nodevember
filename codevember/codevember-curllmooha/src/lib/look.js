import { g as s } from "./leva.js";
const i = `// The shared look for the raw-WebGPU days: the same controls as the Rendering panel on the three.js days.
// a: exposure, saturation, contrast, vignette    b: grain, tonemapper (0 = the day's own, 1 aces, 2 agx, 3 neutral, 4 none)
// At the defaults (1, 1, 1, 0 / 0, 0) none of it changes the picture.
// c: tint (cool shadows, warm highlights), fade (lifted blacks)
struct Look { a: vec4f, b: vec4f, c: vec4f }

// Linear light in, linear light out: exposure, colour, contrast around mid grey, vignette.
fn lookGrade(c: vec3f, uv: vec2f, look: Look) -> vec3f {
  var x = c * look.a.x;
  let g = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  x = max(mix(vec3f(g), x, look.a.y), vec3f(0.0));
  x = pow(x / 0.18, vec3f(look.a.z)) * 0.18;
  let edge = smoothstep(0.25, 0.95, length(uv - 0.5) * 1.25);
  x = x * (1.0 - edge * look.a.w);
  let l = dot(x, vec3f(0.2126, 0.7152, 0.0722));
  let split = mix(x * vec3f(0.965, 0.99, 1.04), x * vec3f(1.04, 1.0, 0.955), smoothstep(0.02, 0.7, l));
  return mix(x, split, look.c.x) * (1.0 - look.c.y) + look.c.y * 0.015;
}

fn lookSrgb(c: vec3f) -> vec3f {
  let v = clamp(c, vec3f(0.0), vec3f(1.0));
  return select(v * 12.92, 1.055 * pow(v, vec3f(1.0 / 2.4)) - vec3f(0.055), v > vec3f(0.0031308));
}

fn lookAces(c: vec3f) -> vec3f {
  let v = c / 0.6;
  let m = vec3f(dot(vec3f(0.59719, 0.35458, 0.04823), v), dot(vec3f(0.07600, 0.90834, 0.01566), v), dot(vec3f(0.02840, 0.13383, 0.83777), v));
  let a = m * (m + 0.0245786) - 0.000090537;
  let b = m * (0.983729 * m + 0.4329510) + 0.238081;
  let f = a / b;
  return clamp(vec3f(dot(vec3f(1.60475, -0.53108, -0.07367), f), dot(vec3f(-0.10208, 1.10813, -0.00605), f), dot(vec3f(-0.00327, -0.07276, 1.07602), f)), vec3f(0.0), vec3f(1.0));
}

fn lookAgx(c: vec3f) -> vec3f {
  let toRec2020 = mat3x3f(vec3f(0.6274, 0.0691, 0.0164), vec3f(0.3293, 0.9195, 0.0880), vec3f(0.0433, 0.0113, 0.8956));
  let toSrgb = mat3x3f(vec3f(1.6605, -0.1246, -0.0182), vec3f(-0.5876, 1.1329, -0.1006), vec3f(-0.0728, -0.0083, 1.1187));
  let inset = mat3x3f(vec3f(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3f(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3f(0.0482516061458583, 0.101439036467562, 0.811302368396859));
  let outset = mat3x3f(vec3f(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3f(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3f(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
  var x = inset * (toRec2020 * c);
  x = log2(max(x, vec3f(1e-10)));
  x = clamp((x + 12.47393) / (4.026069 + 12.47393), vec3f(0.0), vec3f(1.0));
  let x2 = x * x;
  let x4 = x2 * x2;
  x = 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  x = pow(max(outset * x, vec3f(0.0)), vec3f(2.2));
  return clamp(toSrgb * x, vec3f(0.0), vec3f(1.0));
}

fn lookNeutral(c: vec3f) -> vec3f {
  let start = 0.76;
  let x = min(c.r, min(c.g, c.b));
  let offset = select(0.04, x - 6.25 * x * x, x < 0.08);
  var v = c - offset;
  let peak = max(v.r, max(v.g, v.b));
  if (peak < start) { return v; }
  let d = 1.0 - start;
  let newPeak = 1.0 - d * d / (peak + d - start);
  v = v * (newPeak / peak);
  let g = 1.0 - 1.0 / (0.15 * (peak - newPeak) + 1.0);
  return mix(v, vec3f(newPeak), g);
}

// Display-referred result for the chosen tonemapper (mode 1..4).
fn lookTone(c: vec3f, mode: f32) -> vec3f {
  if (mode < 1.5) { return lookSrgb(lookAces(c)); }
  if (mode < 2.5) { return lookSrgb(lookAgx(c)); }
  if (mode < 3.5) { return lookSrgb(lookNeutral(c)); }
  return lookSrgb(c);
}

fn lookGrain(pixel: vec2f, time: f32, look: Look) -> f32 {
  return (fract(sin(dot(pixel + fract(time) * 91.0, vec2f(12.9898, 78.233))) * 43758.5453) - 0.5) * look.b.x;
}
`,
  l = { own: 0, aces: 1, agx: 2, neutral: 3, none: 4 };
function u(f = null, { onChange: a = () => {} } = {}) {
  const o = new Float32Array([1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    e = { data: o },
    c = () => {
      e.buffer && e.device.queue.writeBuffer(e.buffer, 0, o);
    };
  ((e.attach = (t) => (
    (e.device = t),
    (e.buffer = t.createBuffer({
      size: 48,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })),
    c(),
    e
  )),
    (e.flush = c));
  const n = (t) => (v) => {
      ((o[t] = v), c(), a());
    },
    r = () => ({
      Finish: s(
        {
          Exposure: { value: 1, min: 0.1, max: 4, step: 0.01, onChange: n(0) },
          Film: {
            value: "own",
            options: Object.keys(l),
            onChange: (t) => {
              ((o[5] = l[t]), c(), a());
            },
          },
          Colour: { value: 1, min: 0, max: 2, step: 0.01, onChange: n(1) },
          Punch: { value: 1, min: 0.5, max: 1.5, step: 0.01, onChange: n(2) },
          Tint: { value: 0, min: 0, max: 1, step: 0.01, onChange: n(8) },
          Fade: { value: 0, min: 0, max: 0.5, step: 0.005, onChange: n(9) },
          Vignette: { value: 0, min: 0, max: 1, step: 0.005, onChange: n(3) },
          Grain: { value: 0, min: 0, max: 0.15, step: 0.001, onChange: n(4) },
        },
        { collapsed: !0 },
      ),
    });
  return ((e.controls = r), f && e.attach(f), e);
}
export { u as c, i as l };
