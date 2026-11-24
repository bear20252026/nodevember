// 5. A crown of resonant swinging springs: a weight on a spring tuned so it bounces at twice the rate it swings.
//    Bouncing feeds a swing, the swing feeds back into bouncing, and the swing's plane steps round between
//    episodes (Lynch & Houghton). The orbit was found by shooting (tools/spring-search.mjs) so that after one
//    exchange it comes back turned by exactly a third of a turn: three exchanges make a truly periodic motion.
//    Every spring of the crown runs that same orbit, half an exchange after its neighbour and turned to face out,
//    an arrangement (they are not coupled).
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { CatmullRomCurve3, Color, CylinderGeometry, InstancedMesh, Mesh, Object3D, SphereGeometry, TorusGeometry, TubeGeometry, Vector3 } from "three/webgpu";
import { blackSteel, brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

type Orbit = { T: number; k: number; q: number; angle: number; samples: number; r: number[] };

const CROWN = 1.75; // radius
const TOP = 2.75; // crown height
const COUNT = 6;

const look = {
  ...studioLook,
  orbit: 0,
  copies: COUNT,
  key: 2.6,
  keyAzimuth: 30,
  keyElevation: 64,
  mirror: 0.35,
  fov: 34,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const data = (await (await fetch("./spring.json")).json()) as { orbits: Orbit[] };
  const st = await createStage({ canvas, width, height, pixelRatio, name: "spring", look, floorSize: 7 });
  const { scene, camera, controls } = st;
  st.aimKey(3.4, { x: 0, y: 1.5, z: 0 });

  // ---- the crown: a ring on three wires, hooks round it
  const ring = new Mesh(new TorusGeometry(CROWN, 0.022, 16, 160), brass({ rough: 0.18 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = TOP;
  const hub = new Mesh(new CylinderGeometry(0.06, 0.06, 0.05, 24), blackSteel());
  hub.position.y = TOP + 0.8;
  const stem = new Mesh(new CylinderGeometry(0.012, 0.012, 2, 12), blackSteel());
  stem.position.y = TOP + 1.8;
  scene.add(ring, hub, stem);
  const wires = new InstancedMesh(rodGeometry(6), chrome(0.15), 3);
  const at = new Object3D();
  const up = new Vector3(0, 1, 0);
  const seg = (mesh: InstancedMesh, i: number, a: Vector3, b: Vector3, r: number) => {
    const d = new Vector3().subVectors(b, a);
    at.position.copy(a);
    at.quaternion.setFromUnitVectors(up, d.clone().normalize());
    at.scale.set(r, d.length(), r);
    at.updateMatrix();
    mesh.setMatrixAt(i, at.matrix);
  };
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    seg(wires, i, new Vector3(CROWN * Math.cos(a), TOP, CROWN * Math.sin(a)), new Vector3(0, TOP + 0.8, 0), 0.003);
  }

  // ---- springs: a coil of unit length along +y, stretched to each spring's length
  const pts: Vector3[] = [];
  const TURNS = 26;
  for (let i = 0; i <= 600; i++) {
    const s = i / 600;
    // straight lead-in at both ends
    const coil = Math.min(1, Math.min(s, 1 - s) / 0.04);
    const a = s * TURNS * Math.PI * 2;
    pts.push(new Vector3(0.05 * coil * Math.cos(a), s, 0.05 * coil * Math.sin(a)));
  }
  const springs = new InstancedMesh(new TubeGeometry(new CatmullRomCurve3(pts), 1800, 0.0055, 6, false), chrome(0.18, "#cfd3da"), COUNT);
  const weightGeo = new CylinderGeometry(0.085, 0.085, 0.2, 40);
  weightGeo.translate(0, -0.13, 0);
  const weights = new InstancedMesh(weightGeo, brass({ rough: 0.16 }), COUNT);
  const hooks = new InstancedMesh(new SphereGeometry(0.028, 16, 8), brass(), 2 * COUNT);
  const colours = ["#e8b86c", "#d7dbe2", "#e8b86c", "#d7dbe2", "#e8b86c", "#d7dbe2"];
  for (let i = 0; i < COUNT; i++) weights.setColorAt(i, new Color(colours[i % colours.length]));
  for (const m of [springs, weights, hooks, wires, ring, hub, stem]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }

  let orbit = data.orbits[look.orbit];
  const Y = new Vector3(0, 1, 0);
  const sampleAt = (t: number, out: Vector3) => {
    const { T, angle, samples: n, r } = orbit;
    const k = Math.floor(t / T);
    const u = ((t - k * T) / T) * n;
    const i = Math.floor(u);
    const f = u - i;
    const a = new Vector3(r[3 * (i % n)], r[3 * (i % n) + 1], r[3 * (i % n) + 2]);
    const b = new Vector3(r[3 * ((i + 1) % n)], r[3 * ((i + 1) % n) + 1], r[3 * ((i + 1) % n) + 2]);
    if (i + 1 >= n) b.applyAxisAngle(Y, angle);
    return out.copy(a).lerp(b, f).applyAxisAngle(Y, k * angle);
  };

  const p = new Vector3();
  const pose = (phase: number) => {
    const loop = orbit.T * orbit.q;
    for (let c = 0; c < COUNT; c++) {
      const place = (c / COUNT) * Math.PI * 2;
      const hook = new Vector3(CROWN * Math.cos(place), TOP - 0.03, CROWN * Math.sin(place));
      // half an exchange behind its neighbour: the crown alternates bouncing and swinging
      sampleAt(phase * loop + c * (orbit.T / 2), p).applyAxisAngle(Y, -place);
      const bob = hook.clone().add(p);
      seg(springs, c, hook, bob, 1);
      // the weight hangs along its spring
      at.position.copy(bob);
      at.quaternion.setFromUnitVectors(up, p.clone().negate().normalize());
      at.scale.setScalar(1);
      at.updateMatrix();
      weights.setMatrixAt(c, at.matrix);
      for (const [h, q] of [hook, bob].entries()) {
        at.position.copy(q);
        at.quaternion.identity();
        at.updateMatrix();
        hooks.setMatrixAt(2 * c + h, at.matrix);
      }
    }
    for (const m of [springs, weights, hooks]) m.instanceMatrix.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    camera.position.set(2.7, 3.6, 8.3);
    controls.target.set(0, 1.75, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const sf = st.gui.addFolder("spring");
  sf.add(look, "orbit", 0, data.orbits.length - 1, 1).onChange(() => {
    orbit = data.orbits[look.orbit];
    console.log(`pendulum: orbit ${look.orbit}, exchange ${orbit.T.toFixed(2)} s, turns ${orbit.k}/${orbit.q}`);
  });
  sf.add(look, "fov", 15, 70, 1).onChange(frameUp);
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, get orbit() { return orbit; } } });

  const t0 = performance.now();
  wrap.render = () => {
    const loop = orbit.T * orbit.q;
    const phase = st.state.hold >= 0 ? st.state.hold : ((performance.now() - t0) / 1000 / loop) % 1;
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
  duration: 20_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
