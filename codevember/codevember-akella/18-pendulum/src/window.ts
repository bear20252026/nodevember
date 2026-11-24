// 7. Windows within windows (window-model.ts has the physics and the loop). The eye follows one window, then
//    drifts to the window swinging inside it, zooming by 3 while the clock slows by sqrt(3), so the window in view
//    always keeps its pace. The eye turns with the window it follows; the lights turn with the eye, so nothing in
//    the picture knows which way the world's gravity points, only how each window hangs in its parent.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CylinderGeometry, InstancedMesh, Matrix4, Object3D, Quaternion, Vector3 } from "three/webgpu";
import { blackSteel, brass, chrome, createStage, studioLook } from "./stage.ts";
import { GEO, solveClip, type Clip } from "./window-model.ts";

const look = {
  ...studioLook,
  seconds: 9, // one zoom
  swings: 1.6, // of the watched window over one zoom
  amp: 0.55, // seed swing, of the clearance
  phase: 0.6, // seed phase
  frameSize: 0.5, // the watched window's height, of the picture's
  key: 2.4,
  keyAzimuth: -30,
  keyElevation: 40,
  envLight: 1.6,
  bloom: 0.08,
  bloomThreshold: 1.2,
  vignette: 0.5,
  back: "#17181d",
  backEdge: "#040405",
  yaw: 16, // the eye a little to the side and above: flat-on brass reflects one dull direction
  pitch: 9,
  fov: 12, // narrow: the parent's bars come close to the eye, a wide lens bends them
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "window", look, room: "front" });
  const { scene, camera, controls } = st;
  controls.enabled = false;
  st.floor.visible = false;
  st.key.castShadow = false;
  st.aimKey(3, { x: 0, y: 0, z: 0 });

  const { s, L, b } = GEO;
  const N = GEO.levels;
  // ---- one level in its own units: the pin at the origin, the rod down to the window's top edge
  // the frame: four bars with rounded edges (flat faces would each reflect one direction, flat colour)
  const depth = b * 0.8;
  const bar = (w: number, h: number, x: number, y: number) => new RoundedBoxGeometry(w, h, depth, 4, Math.min(w, h, depth) * 0.42).translate(x, y, 0);
  const frameGeo = mergeGeometries([
    bar(1, b, 0, -L - b / 2),
    bar(1, b, 0, -L - 1 + b / 2),
    bar(b, 1 - b, -0.5 + b / 2, -L - 0.5),
    bar(b, 1 - b, 0.5 - b / 2, -L - 0.5),
  ])!;
  const rodGeo = new CylinderGeometry(0.011, 0.011, L + b * 0.5, 12);
  rodGeo.translate(0, -(L + b * 0.5) / 2, 0);
  const pinGeo = new CylinderGeometry(0.028, 0.028, b * 1.7, 20);
  pinGeo.rotateX(Math.PI / 2);
  const hubGeo = new CylinderGeometry(0.03, 0.045, 0.05, 20);
  hubGeo.translate(0, -L + 0.025, 0);

  const parts = [
    new InstancedMesh(frameGeo, brass({ rough: 0.16, color: "#e6b86a" }), N),
    new InstancedMesh(rodGeo, chrome(0.14, "#c9ccd2"), N),
    new InstancedMesh(pinGeo, blackSteel(0.3), N),
    new InstancedMesh(hubGeo, brass({ rough: 0.2 }), N),
  ];
  for (const m of parts) {
    m.frustumCulled = false;
    scene.add(m);
  }

  let clip: Clip;
  const solve = () => {
    const t = performance.now();
    clip = solveClip({ swings: look.swings, amp: look.amp, phase: look.phase });
    console.log(`pendulum: windows solved in ${(performance.now() - t).toFixed(0)} ms, seam residual ${clip.residual.toExponential(1)}, clearance ${((clip.lim / 0.9) * 180 / Math.PI).toFixed(1)} deg`);
  };
  solve();

  // relative angles at a display phase, the last interval running into the seam sample
  const rel = new Float64Array(N);
  const angles = (t: number) => {
    const u = t * clip.n;
    const i = Math.min(clip.n - 1, Math.floor(u));
    const f = u - i;
    for (let j = 0; j < N; j++) rel[j] = clip.phi[i * N + j] * (1 - f) + clip.phi[(i + 1) * N + j] * f;
  };

  const at = new Object3D();
  const view = new Matrix4();
  const M = new Matrix4();
  const Z = new Vector3(0, 0, 1);
  const q = new Quaternion();
  const pins: Vector3[] = Array.from({ length: N }, () => new Vector3());
  const centres: Vector3[] = Array.from({ length: N }, () => new Vector3());
  const abs = new Float64Array(N);
  const smoother = (x: number) => x * x * x * (x * (6 * x - 15) + 10);

  const pose = (t: number) => {
    angles(t);
    // the chain in level 0's units, from a fixed pin
    let a = 0;
    const p = new Vector3();
    for (let j = 0; j < N; j++) {
      a += rel[j];
      abs[j] = a;
      const c = Math.pow(s, j);
      pins[j].copy(p);
      const down = new Vector3(Math.sin(a), -Math.cos(a), 0);
      centres[j].copy(p).addScaledVector(down, c * (L + 0.5));
      p.addScaledVector(down, c * (L + b / 2));
    }
    // the eye: level 1 at the start, level 2 at the end; sized so the watched window is frameSize of the picture
    const w = smoother(t);
    const C = centres[1].clone().lerp(centres[2], w);
    const turn = abs[1] + (abs[2] - abs[1]) * w;
    const tall = 2 * Math.tan(((look.fov / 2) * Math.PI) / 180) * 10; // the picture's height at the eye's distance
    const S = (look.frameSize * tall) / Math.pow(s, 1 + t);
    view.makeScale(S, S, S).multiply(M.makeRotationZ(-turn)).multiply(new Matrix4().makeTranslation(-C.x, -C.y, 0));
    for (let j = 0; j < N; j++) {
      const c = Math.pow(s, j);
      // the smallest windows shrink into their pins as they fall below a few pixels (a size-only rule, so it loops)
      const size = (S * c) / tall;
      const fade = Math.min(1, Math.max(0, (size - 0.003) / 0.006));
      at.position.copy(pins[j]);
      at.quaternion.copy(q.setFromAxisAngle(Z, abs[j]));
      at.scale.setScalar(c * fade * fade * (3 - 2 * fade) + 1e-6);
      at.updateMatrix();
      M.multiplyMatrices(view, at.matrix);
      for (const m of parts) m.setMatrixAt(j, M);
    }
    for (const m of parts) m.instanceMatrix.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    const y = (look.yaw * Math.PI) / 180, x = (look.pitch * Math.PI) / 180;
    camera.position.set(Math.sin(y) * Math.cos(x), Math.sin(x), Math.cos(y) * Math.cos(x)).multiplyScalar(10);
    controls.target.set(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const wf = st.gui.addFolder("windows");
  wf.add(look, "seconds", 3, 30, 0.1);
  wf.add(look, "swings", 0.5, 4, 0.05).onFinishChange(solve);
  wf.add(look, "amp", 0.05, 1, 0.01).name("swing (seed)").onFinishChange(solve);
  wf.add(look, "phase", -3.2, 3.2, 0.01).name("phase (seed)").onFinishChange(solve);
  wf.add(look, "frameSize", 0.2, 0.9, 0.01);
  wf.add(look, "fov", 6, 60, 1).onChange(frameUp);
  wf.add(look, "yaw", -60, 60, 1).onChange(frameUp);
  wf.add(look, "pitch", -40, 40, 1).onChange(frameUp);
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, get clip() { return clip; } } });

  const t0 = performance.now();
  wrap.render = () => {
    const phase = st.state.hold >= 0 ? st.state.hold : ((performance.now() - t0) / 1000 / look.seconds) % 1;
    pose(phase);
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => st.renderer.dispose();
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 9_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
