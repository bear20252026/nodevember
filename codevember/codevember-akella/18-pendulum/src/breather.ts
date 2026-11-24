// 1. A spine of pendulums coupled by torsion springs, breathing: the sine-Gordon breather sampled onto the arms.
//    theta(x, t) = 4 atan( sqrt(1 - w^2) sin(w t) / (w cosh(sqrt(1 - w^2) x)) ), period 2 pi / w: the loop is
//    a whole number of periods, so it closes by itself.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { attribute, cos, mix, normalLocal, positionLocal, sin, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { BoxGeometry, CatmullRomCurve3, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, TubeGeometry, Vector3 } from "three/webgpu";
import { blackSteel, brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

const N = 100; // arms
const DZ = 0.06; // between arms along the spine
const HIGH = 0.78; // spine above the floor
const ARM = 0.4; // spine to paddle centre
const PADDLE = { h: 0.24, w: DZ * 0.92, t: 0.006 };
const LOOP = 10; // seconds

const look = {
  ...studioLook,
  omega: 0.28, // breather frequency, of the pendulums' own: smaller swings further and longer
  width: 0.13, // spine distance between arms, in the breather's units: smaller is a wider bundle
  periods: 2, // breaths in a loop
  key: 2.6,
  keyAzimuth: 50,
  keyElevation: 52,
  mirror: 0.4,
  fov: 30,
  eyeAzimuth: 34, // degrees off the spine
  eyeElevation: 13,
  eyeDistance: 4.3,
  eyeAlong: 0.35, // where along the spine the eye aims
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "breather", look, floorSize: 7 });
  const { scene, camera, controls } = st;
  st.aimKey(3.6, { x: 0, y: 0.4, z: 0 });

  const spineLen = N * DZ + 0.5;
  const z0 = -((N - 1) * DZ) / 2;
  const steel = chrome(0.12, "#c9ccd2");
  const dark = blackSteel();

  // spine and its two stands
  const spine = new Mesh(new CylinderGeometry(0.011, 0.011, spineLen, 16), steel);
  spine.rotation.x = Math.PI / 2;
  spine.position.y = HIGH;
  spine.castShadow = true;
  scene.add(spine);
  for (const s of [-1, 1]) {
    const z = s * (spineLen / 2 + 0.02);
    const block = new Mesh(new BoxGeometry(0.07, 0.07, 0.05), dark);
    block.position.set(0, HIGH, z);
    scene.add(block);
    for (const side of [-1, 1]) {
      const leg = new Mesh(rodGeometry(12), dark);
      const foot = new Vector3(side * 0.32, 0, z);
      const top = new Vector3(0, HIGH, z);
      leg.position.copy(foot);
      leg.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), top.clone().sub(foot).normalize());
      leg.scale.set(0.013, foot.distanceTo(top), 0.013);
      leg.castShadow = true;
      scene.add(leg);
    }
    const bar = new Mesh(new CylinderGeometry(0.012, 0.012, 0.66, 12), dark);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.012, z);
    scene.add(bar);
  }

  // the arms: collar on the spine, a rod, a paddle facing the way it swings
  const collars = new InstancedMesh(new CylinderGeometry(0.019, 0.019, DZ * 0.34, 20).rotateX(Math.PI / 2), brass({ rough: 0.25 }), N);
  const rods = new InstancedMesh(rodGeometry(8), steel, N);
  const paddleGeometry = new BoxGeometry(PADDLE.t, PADDLE.h, PADDLE.w);
  paddleGeometry.computeTangents();
  const paddles = new InstancedMesh(paddleGeometry, brass({ rough: 0.15, brushed: 0.7, color: "#e3bb72" }), N);
  for (const m of [collars, rods, paddles]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }

  // torsion springs between neighbouring collars: a coil along +z, wound in the shader from one arm's angle
  // to the next one's, so the twist the coupling holds can be seen
  const coilPoints: Vector3[] = [];
  const TURNS = 3.5;
  const COIL_R = 0.016;
  const span = DZ * 0.66;
  for (let i = 0; i <= 120; i++) {
    const s = i / 120;
    const a = s * TURNS * Math.PI * 2;
    coilPoints.push(new Vector3(COIL_R * Math.cos(a), COIL_R * Math.sin(a), s * span));
  }
  const coilGeometry = new TubeGeometry(new CatmullRomCurve3(coilPoints), 240, 0.0022, 6, false);
  const twist = new InstancedBufferAttribute(new Float32Array((N - 1) * 3), 3);
  coilGeometry.setAttribute("twist", twist);
  const coilMaterial = brass({ rough: 0.3, color: "#c58f4a" });
  // (three r187 places the instance before positionNode runs, so positionLocal is already on the spine)
  const ends = attribute("twist", "vec3");
  const along = positionLocal.z.sub(ends.z).div(span).clamp(0, 1);
  const turn = mix(ends.x, ends.y, along);
  const spin = (v: Node<"vec3">) => vec3(v.x.mul(cos(turn)).sub(v.y.mul(sin(turn))), v.x.mul(sin(turn)).add(v.y.mul(cos(turn))), v.z);
  const axis = vec3(0, HIGH, 0);
  coilMaterial.positionNode = spin(positionLocal.sub(axis)).add(axis);
  coilMaterial.normalNode = spin(normalLocal);
  const coils = new InstancedMesh(coilGeometry, coilMaterial, N - 1);
  coils.frustumCulled = false;
  coils.castShadow = true;
  scene.add(coils);

  const at = new Object3D();
  const mat = new Matrix4();
  const q = new Quaternion();
  const zAxis = new Vector3(0, 0, 1);
  const theta = new Float32Array(N);
  for (let i = 0; i < N - 1; i++) {
    mat.makeTranslation(0, HIGH, z0 + i * DZ + (DZ - span) / 2);
    coils.setMatrixAt(i, mat);
  }
  coils.instanceMatrix.needsUpdate = true;

  const pose = (phase: number) => {
    const w = look.omega;
    const k = Math.sqrt(1 - w * w);
    const t = (phase * look.periods * 2 * Math.PI) / w;
    const top = k * Math.sin(w * t);
    for (let i = 0; i < N; i++) {
      const x = (i - (N - 1) / 2) * look.width;
      theta[i] = 4 * Math.atan(top / (w * Math.cosh(k * x)));
    }
    for (let i = 0; i < N; i++) {
      const z = z0 + i * DZ;
      const a = theta[i];
      q.setFromAxisAngle(zAxis, a);
      // collar
      at.position.set(0, HIGH, z);
      at.quaternion.copy(q);
      at.scale.set(1, 1, 1);
      at.updateMatrix();
      collars.setMatrixAt(i, at.matrix);
      // rod: hangs down at angle a about the spine
      at.quaternion.copy(q).multiply(new Quaternion().setFromAxisAngle(zAxis, Math.PI));
      at.scale.set(0.0042, ARM - PADDLE.h / 2, 0.0042);
      at.updateMatrix();
      rods.setMatrixAt(i, at.matrix);
      // paddle
      at.position.set(Math.sin(a) * ARM, HIGH - Math.cos(a) * ARM, z);
      at.quaternion.copy(q);
      at.scale.set(1, 1, 1);
      at.updateMatrix();
      paddles.setMatrixAt(i, at.matrix);
    }
    for (let i = 0; i < N - 1; i++) twist.setXYZ(i, theta[i], theta[i + 1], z0 + i * DZ + (DZ - span) / 2);
    twist.needsUpdate = true;
    for (const m of [collars, rods, paddles]) m.instanceMatrix.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    const az = (look.eyeAzimuth * Math.PI) / 180;
    const el = (look.eyeElevation * Math.PI) / 180;
    controls.target.set(0, 0.62, look.eyeAlong);
    camera.position.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(look.eyeDistance).add(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const bf = st.gui.addFolder("breather");
  bf.add(look, "omega", 0.08, 0.95, 0.01);
  bf.add(look, "width", 0.04, 0.4, 0.005);
  bf.add(look, "periods", 1, 4, 1);
  bf.add(look, "fov", 15, 70, 1).onChange(frameUp);
  bf.add(look, "eyeAzimuth", -90, 90, 1).onChange(frameUp);
  bf.add(look, "eyeElevation", -10, 60, 1).onChange(frameUp);
  bf.add(look, "eyeDistance", 1, 10, 0.05).onChange(frameUp);
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, theta } });

  wrap.render = ({ playhead }) => {
    pose(st.phase(playhead));
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => st.renderer.dispose();
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: LOOP * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
