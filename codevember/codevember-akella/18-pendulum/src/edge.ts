// 4. A lattice of coupled pendulum pairs whose couplings act as a magnetic field on the waves (see edge-model.ts).
//    One rim pendulum is plucked; the part of that pluck inside the bulk gap can only travel along the rim, and it
//    splits into two waves going round in opposite senses, past corners and into the notch, through each other on
//    the far side and home again. Each mode's frequency is rounded to a whole number of swings in the loop, the
//    loop being the lap time at which they agree best, so the waves keep their shape and the loop is exact.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { attribute, mix, uniform, vec3 } from "three/tsl";
import { Color, CylinderGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Object3D, Quaternion, SphereGeometry, Vector3 } from "three/webgpu";
import { buildLattice, planPluck } from "./edge-model.ts";
import { brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

const D = 0.13; // between sites
const HIGH = 1.05; // pivots above the floor
const ROD = 0.34;
const LOOP = 24; // seconds on screen

const look = {
  ...studioLook,
  swing: 0.55, // radians of the widest swing
  width: 0.25, // of the gap window, in hopping units
  rim: 2, // extra weight on modes that live on the rim
  w0sq: 3.3, // pendulums' own stiffness, in hopping units (>= 3 keeps every mode stable)
  pluckI: 3,
  pluckJ: 0,
  glow: 3.5,
  glowColor: "#ff9a3d",
  key: 2.4,
  keyAzimuth: -25,
  keyElevation: 62,
  mirror: 0.1,
  fov: 34,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "edge", look, floorSize: 6 });
  const { scene, camera, controls } = st;
  st.aimKey(2.6, { x: 0, y: 0.6, z: 0 });

  const t0 = performance.now();
  const L = buildLattice();
  const { sites, N, shape } = L;
  console.log(`pendulum: ${N} sites, ${2 * N} pendulums, modes in ${(performance.now() - t0).toFixed(0)} ms`);
  const cx = ((shape.W - 1) * D) / 2;
  const cz = ((shape.H - 1) * D) / 2;
  // site (i, j) -> world; j runs away from the eye
  const place = (i: number, j: number) => new Vector3(i * D - cx, HIGH, cz - j * D);
  const OFF = D * 0.2; // the pair at a site: a in front, b behind

  let norm = 0; // largest displacement over the loop, found once
  let plan = planPluck(L, { w0: Math.sqrt(look.w0sq), kappa: 1, at: [look.pluckI, look.pluckJ], spread: 0.8, width: look.width, tmax: 260, rimPower: look.rim });
  const replan = () => {
    plan = planPluck(L, { w0: Math.sqrt(look.w0sq), kappa: 1, at: [look.pluckI, look.pluckJ], spread: 0.8, width: look.width, tmax: 260, rimPower: look.rim });
    norm = 0;
    console.log(`pendulum: gap at ${plan.centre.toFixed(2)}, ${plan.modes.length} modes, lap ${plan.T.toFixed(1)}, agreement ${plan.R.toFixed(3)}`);
  };
  replan();

  // ---- drawn: rails over each row's runs of sites, rods, bobs that glow with the motion they carry
  const steel = chrome(0.14, "#c4c7cd");
  const rails: { a: Vector3; b: Vector3 }[] = [];
  for (let j = 0; j < shape.H; j++) {
    let start = -1;
    for (let i = 0; i <= shape.W; i++) {
      const here = i < shape.W && L.at(i, j) >= 0;
      if (here && start < 0) start = i;
      if (!here && start >= 0) {
        for (const dz of [OFF, -OFF]) {
          const a = place(start, j).add(new Vector3(-D * 0.45, 0, dz));
          const b = place(i - 1, j).add(new Vector3(D * 0.45, 0, dz));
          rails.push({ a, b });
        }
        start = -1;
      }
    }
  }
  const railMesh = new InstancedMesh(new CylinderGeometry(0.0032, 0.0032, 1, 8).rotateZ(Math.PI / 2), brass({ rough: 0.35, color: "#8a6a3c" }), rails.length);
  const m4 = new Matrix4();
  for (const [k, r] of rails.entries()) {
    const mid = r.a.clone().add(r.b).multiplyScalar(0.5);
    m4.compose(mid, new Quaternion(), new Vector3(r.a.distanceTo(r.b), 1, 1));
    railMesh.setMatrixAt(k, m4);
  }
  // end posts holding the rails up, at the four corners of the panel
  const posts = new InstancedMesh(rodGeometry(10), steel, 4);
  for (const [k, [i, j]] of [
    [-0.8, -0.8],
    [shape.W - 0.2, -0.8],
    [-0.8, shape.H - 0.2],
    [shape.W - 0.2, shape.H - 0.2],
  ].entries()) {
    const p = place(i, j);
    m4.compose(new Vector3(p.x, 0, p.z), new Quaternion(), new Vector3(0.012, HIGH + 0.04, 0.012));
    posts.setMatrixAt(k, m4);
  }
  const frame = new InstancedMesh(new CylinderGeometry(0.008, 0.008, 1, 8).rotateZ(Math.PI / 2), steel, 4);
  {
    const a = place(-0.8, -0.8).setY(HIGH + 0.04);
    const b = place(shape.W - 0.2, shape.H - 0.2).setY(HIGH + 0.04);
    const bars = [
      [a, new Vector3(b.x, a.y, a.z)],
      [new Vector3(a.x, a.y, b.z), b],
      [a, new Vector3(a.x, a.y, b.z)],
      [new Vector3(b.x, a.y, a.z), b],
    ];
    for (const [k, [p, q]] of bars.entries()) {
      const d = q.clone().sub(p);
      m4.compose(p.clone().add(q).multiplyScalar(0.5), new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), d.clone().normalize()), new Vector3(d.length(), 1, 1));
      frame.setMatrixAt(k, m4);
    }
  }
  // the panel's cross bars, along x at the front and back of the frame, carry the rails
  const rods = new InstancedMesh(rodGeometry(6), steel, 2 * N);
  const bobGeometry = new SphereGeometry(1, 24, 12);
  const glowAttr = new InstancedBufferAttribute(new Float32Array(2 * N), 1);
  bobGeometry.setAttribute("glow", glowAttr);
  const bobMat = chrome(0.12, "#d9dde3");
  const glowColor = uniform(new Vector3().setFromColor(new Color(look.glowColor)));
  const glowStrength = uniform(look.glow);
  const g = attribute("glow", "float");
  bobMat.emissiveNode = glowColor.mul(g.mul(g)).mul(glowStrength);
  bobMat.colorNode = mix(vec3(0.85, 0.87, 0.9), glowColor, g.mul(0.6));
  const bobs = new InstancedMesh(bobGeometry, bobMat, 2 * N);
  for (const m of [railMesh, posts, frame, rods, bobs]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }

  // ---- motion
  const x = new Float64Array(2 * N);
  const v = new Float64Array(2 * N);
  const solve = (phase: number) => {
    x.fill(0);
    v.fill(0);
    const carrier = plan.turns.reduce((a, b) => a + b, 0) / plan.turns.length;
    for (const [k, m] of plan.modes.entries()) {
      const a = 2 * Math.PI * plan.turns[k] * phase;
      const c = m.A * Math.cos(a);
      const s = -m.A * Math.sin(a) * (plan.turns[k] / carrier); // velocity, in the carrier's units
      const vec = m.v;
      for (let i = 0; i < 2 * N; i++) {
        x[i] += c * vec[i];
        v[i] += s * vec[i];
      }
    }
  };
  const findNorm = () => {
    let big = 1e-9;
    for (let f = 0; f < 1; f += 1 / 400) {
      solve(f);
      for (let i = 0; i < 2 * N; i++) big = Math.max(big, Math.abs(x[i]));
    }
    norm = big;
  };

  const at = new Object3D();
  const Z = new Vector3(0, 0, 1);
  const pose = (phase: number) => {
    if (!norm) findNorm();
    solve(phase);
    for (let s = 0; s < N; s++) {
      const site = sites[s];
      // a site's energy, from both its pendulums: lights both
      const e = (x[s] ** 2 + x[N + s] ** 2 + v[s] ** 2 + v[N + s] ** 2) / (2 * norm * norm);
      const glow = Math.min(1, Math.sqrt(e));
      for (let p = 0; p < 2; p++) {
        const k = p * N + s;
        const angle = (look.swing * x[k]) / norm;
        const top = place(site.i, site.j).add(new Vector3(0, 0, p ? -OFF : OFF));
        at.position.copy(top);
        at.quaternion.setFromAxisAngle(Z, Math.PI + angle);
        at.scale.set(0.0026, ROD, 0.0026);
        at.updateMatrix();
        rods.setMatrixAt(k, at.matrix);
        at.position.set(top.x + Math.sin(angle) * ROD, top.y - Math.cos(angle) * ROD, top.z);
        at.quaternion.identity();
        at.scale.setScalar(0.026);
        at.updateMatrix();
        bobs.setMatrixAt(k, at.matrix);
        glowAttr.setX(k, glow);
      }
    }
    rods.instanceMatrix.needsUpdate = true;
    bobs.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    camera.position.set(0.7, 3.9, 3.7);
    controls.target.set(0.05, 0.6, -0.1);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const ef = st.gui.addFolder("edge");
  ef.add(look, "swing", 0, 1.2, 0.01);
  ef.add(look, "width", 0.08, 0.6, 0.01).onFinishChange(replan);
  ef.add(look, "rim", 0, 6, 0.1).onFinishChange(replan);
  ef.add(look, "w0sq", 2.9, 8, 0.05).onFinishChange(replan);
  ef.add(look, "pluckI", 0, shape.W - 1, 1).onFinishChange(replan);
  ef.add(look, "pluckJ", 0, shape.H - 1, 1).onFinishChange(replan);
  ef.add(look, "glow", 0, 10, 0.01).onChange(() => (glowStrength.value = look.glow));
  ef.addColor(look, "glowColor").onChange(() => glowColor.value.setFromColor(new Color(look.glowColor)));
  ef.add(look, "fov", 15, 70, 1).onChange(frameUp);
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, L, get plan() { return plan; } } });

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
