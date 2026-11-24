// A page that is one full-screen WGSL shader: the sketches for the other three ideas (pit, rings, microscope).
// The shader's first function is its entry, with this exact signature:
//   fn lab(px: vec2f, res: vec2f, t: f32, a: vec4f, b: vec4f, c: vec4f, d: vec4f, e: vec4f, f: vec4f, g: vec4f, h: vec4f) -> vec4f
// px is the pixel (origin bottom left), t the playhead 0..1, a..f the look values packed by `pack`.
// It returns linear HDR colour; three tone maps it. Helper functions can follow the entry in the same string.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TSL from "three/tsl";
import { ACESFilmicToneMapping, Color, MeshBasicNodeMaterial, QuadMesh, Vector4, WebGPURenderer } from "three/webgpu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { screenCoordinate, screenSize, uniform, vec2, wgslFn } = T;

export type Look = Record<string, number | string>;
export type Lab = {
  title: string;
  look: Look;
  ranges: Record<string, [number, number, number?]>; // GUI ranges; colours are found by their "#"
  pack: (look: Look) => number[]; // up to 32 numbers, into a..h
  wgsl: string;
  duration: number; // ms
  exposure?: number;
};

// a colour in the GUI's sRGB hex, as the linear rgb the shader works in
export const rgb = (hex: string | number) => new Color(hex as string).toArray() as number[];

export function lab(def: Lab) {
  const { look } = def;
  const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
    if (import.meta.hot) {
      import.meta.hot.dispose(() => wrap.dispose());
      import.meta.hot.accept(() => wrap.hotReload());
    }
    const renderer = new WebGPURenderer({ canvas, antialias: false });
    let scale = 1; // render scale, see look.res
    const fit = (w: number, h: number) => {
      renderer.setPixelRatio(pixelRatio * scale);
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = def.exposure ?? 1;
    await renderer.init();

    const packed = Array.from({ length: 8 }, () => uniform(new Vector4()));
    const time = uniform(0);
    const main = wgslFn(def.wgsl);
    const px = vec2(screenCoordinate.x, screenSize.y.sub(screenCoordinate.y));
    const material = new MeshBasicNodeMaterial();
    const [a, b, c, d, e, f, g, h] = packed;
    material.colorNode = main({ px, res: screenSize, t: time, a, b, c, d, e, f, g, h });
    const quad = new QuadMesh(material);

    const refresh = () => {
      const v = def.pack(look);
      packed.forEach((u, i) => u.value.set(v[i * 4] ?? 0, v[i * 4 + 1] ?? 0, v[i * 4 + 2] ?? 0, v[i * 4 + 3] ?? 0));
      const s = Number(look.res ?? 1);
      if (s !== scale) ((scale = s), fit(width, height));
    };
    scale = Number(look.res ?? 1);
    fit(width, height);
    refresh();

    const gui = new GUI({ title: def.title });
    gui.close();
    for (const k of Object.keys(look)) {
      const v = look[k];
      if (typeof v === "string" && v.startsWith("#")) gui.addColor(look, k).onChange(refresh);
      else if (def.ranges[k]) {
        const [lo, hi, step] = def.ranges[k];
        gui.add(look as Record<string, number>, k, lo, hi, step).onChange(refresh);
      }
    }
    const stats = new Stats();
    stats.dom.style.cssText = "position:fixed;top:0;left:0";
    canvas.after(stats.dom);
    document.getElementById("note")?.remove();

    const state = { hold: -1, frame: 0, pause: false };
    Object.assign(window, { __rust: { look, state, refresh, renderer, time } });

    wrap.render = ({ playhead }) => {
      if (state.pause) return;
      time.value = state.hold >= 0 ? state.hold : playhead;
      quad.render(renderer);
      stats.update();
      state.frame++;
    };
    wrap.resize = ({ width: w, height: h }) => ((width = w), (height = h), fit(w, h));
    wrap.unload = () => {
      renderer.dispose();
      gui.destroy();
      stats.dom.remove();
    };
  };
  const settings: SketchSettings = {
    mode: "webgpu",
    pixelRatio: window.devicePixelRatio,
    animate: true,
    duration: def.duration,
    exportFps: 60,
    framesFormat: ["webm"],
  };
  ssam(sketch, settings);
}
