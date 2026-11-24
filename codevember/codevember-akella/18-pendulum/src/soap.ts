// 8. A ball through a liquid mirror (a tribute to arc4g). A chrome film in a hoop; the ball meets its own
//    reflection, the mirror gives, wraps it, closes behind it and the ball flies on in a skin of chrome while the
//    sheet heals. The film is honest surface tension (veil-model.ts); one pass to get the physics right before it
//    goes on a pendulum.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { float, max, normalLocal, pmremTexture, positionLocal, positionWorld, reflectVector, smoothstep, uniform, vec3 } from "three/tsl";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  FrontSide,
  Group,
  Mesh,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three/webgpu";
import { blackSteel, chrome, createStage, studioLook } from "./stage.ts";
import { VEIL, Veil, type VeilParams } from "./veil-model.ts";

const H = VEIL.R + 0.9; // hoop centre above the floor

const look = {
  ...studioLook,
  // the event
  speed: 1.3, // simulated seconds per second
  cycle: 16, // simulated seconds before it starts again
  start: 4.5, // the ball's distance from the mirror at the start
  v0: VEIL.v0,
  mass: VEIL.mass,
  gamma: VEIL.gamma,
  rho: VEIL.rho,
  drag: VEIL.drag,
  viscosity: VEIL.viscosity,
  grip: VEIL.grip,
  fluid: VEIL.fluid,
  thick: VEIL.thick,
  aim: 0, // off centre
  tilt: 0, // degrees off square
  // the look
  filmColor: "#e4e7ee",
  filmRough: 0.03,
  ballColor: "#e0502a",
  ballRough: 0.28,
  key: 2.4,
  keyAzimuth: 50,
  keyElevation: 50,
  envLight: 2.1,
  mirror: 0.3,
  bloom: 0.12,
  bloomThreshold: 1.1,
  yaw: 48,
  pitch: 7,
  distance: 19,
  fov: 30,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "veil", look, room: "front", floorSize: 16 });
  const { scene, camera, controls } = st;
  st.aimKey(8, { x: 0, y: H * 0.7, z: -2 });

  // the hoop, on a post; the film's own frame: the sheet is z = 0 of the group, the ball runs to -z
  const rig = new Group();
  rig.position.y = H;
  scene.add(rig);
  const hoop = new Mesh(new TorusGeometry(VEIL.R + 0.05, 0.1, 24, 240), chrome(0.12, "#d8dade"));
  hoop.castShadow = true;
  rig.add(hoop);
  const post = new Mesh(new CylinderGeometry(0.07, 0.07, H - VEIL.R, 16), blackSteel(0.3));
  post.position.y = -(VEIL.R + H) / 2;
  const foot = new Mesh(new CylinderGeometry(0.9, 1, 0.12, 48), blackSteel(0.4));
  foot.position.y = -H + 0.06;
  post.castShadow = foot.castShadow = true;
  rig.add(post, foot);

  // the ball
  const ballMat = new MeshPhysicalNodeMaterial();
  ballMat.clearcoat = 0.7;
  ballMat.clearcoatRoughness = 0.06;
  const ball = new Mesh(new SphereGeometry(VEIL.ball, 96, 48), ballMat);
  ball.castShadow = true;
  rig.add(ball);

  // the film: one surface drawn twice, pushed half the thickness out each way, each side seen from outside
  let sim: Veil;
  const geo = new BufferGeometry();
  let pos: Float32Array, nrm: Float32Array;
  const thick = uniform(look.thick);
  const filmColor = uniform(new Vector3());
  const ballColor = uniform(new Vector3());
  // how much of the ball the film covers: a cap round the way it travels, cos of its half-angle (1: bare)
  const cover = uniform(1);
  const ahead = uniform(new Vector3(0, 0, -1));
  const ballRough = uniform(look.ballRough);
  const ballAt = uniform(new Vector3());
  const ballR = uniform(VEIL.ball + 0.0);
  const keyDir = uniform(new Vector3());
  const keyI = uniform(look.key);
  const envI = uniform(look.envLight);
  const env = scene.environment!;
  const filmSide = (sign: 1 | -1) => {
    const m = new MeshStandardNodeMaterial({ side: sign > 0 ? FrontSide : BackSide });
    m.metalness = 1;
    m.positionNode = positionLocal.add(normalLocal.mul(thick.mul(0.5 * sign)));
    // the ball in the mirror, traced: the room's light where the reflected ray misses it, the ball's where it hits
    const rd = reflectVector.normalize();
    const oc = positionWorld.sub(ballAt);
    const b = oc.dot(rd);
    const disc = b.mul(b).sub(oc.dot(oc)).add(ballR.mul(ballR));
    const t = b.negate().sub(max(disc, 0).sqrt());
    const nb = oc.add(rd.mul(t)).normalize();
    // where the film already lies on the ball, the mirror sees film, not ball (left to the room's light)
    const bare = smoothstep(cover.sub(0.03), cover.add(0.03), nb.dot(ahead)).oneMinus();
    const hit = smoothstep(0, 0.004, disc).mul(smoothstep(0, 0.02, t)).mul(bare);
    const diffuse = pmremTexture(env, nb, float(1)).mul(envI).add(vec3(1, 0.96, 0.9).mul(keyI).mul(max(nb.dot(keyDir), 0)).mul(0.6));
    const fres = float(0.04).add(float(0.96).mul(float(1).sub(max(rd.negate().dot(nb), 0)).pow(5)));
    const gloss = pmremTexture(env, rd.reflect(nb), ballRough).mul(envI).mul(fres);
    const seen = ballColor.mul(diffuse).mul(fres.oneMinus()).add(gloss);
    m.colorNode = filmColor.mul(hit.oneMinus());
    m.emissiveNode = filmColor.mul(seen).mul(hit);
    return m;
  };
  const outer = filmSide(1), inner = filmSide(-1);
  const films = [new Mesh(geo, outer), new Mesh(geo, inner)];
  for (const f of films) {
    f.frustumCulled = false;
    f.castShadow = true;
    rig.add(f);
  }

  let topology = -1;
  const upload = () => {
    const X = sim.x, n = sim.n;
    for (let i = 0; i < 3 * n; i++) pos[i] = X[i];
    // area-weighted normals
    nrm.fill(0);
    const t = sim.tris;
    for (let f = 0; f < t.length; f += 3) {
      const a = 3 * t[f], b = 3 * t[f + 1], c = 3 * t[f + 2];
      const ux = X[b] - X[a], uy = X[b + 1] - X[a + 1], uz = X[b + 2] - X[a + 2];
      const vx = X[c] - X[a], vy = X[c + 1] - X[a + 1], vz = X[c + 2] - X[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const k of [a, b, c]) {
        nrm[k] += nx;
        nrm[k + 1] += ny;
        nrm[k + 2] += nz;
      }
    }
    for (let k = 0; k < n; k++) {
      const l = Math.hypot(nrm[3 * k], nrm[3 * k + 1], nrm[3 * k + 2]) || 1;
      nrm[3 * k] /= l;
      nrm[3 * k + 1] /= l;
      nrm[3 * k + 2] /= l;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.normal.needsUpdate = true;
    if (topology !== sim.topology) {
      topology = sim.topology;
      geo.setIndex(new BufferAttribute(Uint32Array.from(sim.tris), 1));
    }
    ball.position.set(sim.ballX[0], sim.ballX[1], sim.ballX[2]);
    // the covered cap: the widest contact from the way the ball goes (all of it once sealed)
    const bv = sim.ballV, sp = Math.hypot(bv[0], bv[1], bv[2]) || 1;
    ahead.value.set(bv[0] / sp, bv[1] / sp, bv[2] / sp);
    let c = 1;
    if (sim.seals.length) c = -1.1;
    else {
      const rc = sim.p.ball + sim.p.thick / 2 + 0.01;
      for (let k = 0; k < sim.n; k++) {
        if (!sim.m[k]) continue;
        const dx = X[3 * k] - sim.ballX[0], dy = X[3 * k + 1] - sim.ballX[1], dz = X[3 * k + 2] - sim.ballX[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < rc) c = Math.min(c, (dx * bv[0] + dy * bv[1] + dz * bv[2]) / (d * sp));
      }
      if (c < 1) c -= 0.05;
    }
    cover.value = c;
    ballAt.value.set(sim.ballX[0], sim.ballX[1] + H, sim.ballX[2]);
  };

  const params = (): Partial<VeilParams> => {
    const a = (look.tilt * Math.PI) / 180;
    return {
      v0: look.v0,
      mass: look.mass,
      gamma: look.gamma,
      rho: look.rho,
      drag: look.drag,
      viscosity: look.viscosity,
      grip: look.grip,
      fluid: look.fluid,
      thick: look.thick,
      z0: look.start,
      dir: [Math.sin(a), 0, -Math.cos(a)],
      offset: [look.aim, 0],
    };
  };
  let seals = 0;
  const restart = () => {
    sim = new Veil(params());
    pos = new Float32Array(sim.cap * 3);
    nrm = new Float32Array(sim.cap * 3);
    geo.setAttribute("position", new BufferAttribute(pos, 3));
    geo.setAttribute("normal", new BufferAttribute(nrm, 3));
    topology = -1;
    seals = 0;
    upload();
  };
  restart();
  const advance = (to: number) => {
    if (to < sim.time - 1e-9) {
      sim.reset();
      seals = 0;
    }
    while (sim.time + sim.p.dt / 2 < to) {
      sim.step();
      if (sim.seals.length > seals) {
        seals = sim.seals.length;
        const s = sim.seals[seals - 1];
        console.log(`pendulum: sealed at t=${s.time.toFixed(2)} (ring ${s.ring}), ball speed ${Math.hypot(...sim.ballV).toFixed(2)} of ${look.v0}`);
      }
    }
    upload();
  };

  const frameUp = () => {
    camera.fov = look.fov;
    const y = (look.yaw * Math.PI) / 180, x = (look.pitch * Math.PI) / 180;
    const target = new Vector3(0, H - 0.3, -1.6);
    camera.position.set(Math.sin(y) * Math.cos(x), Math.sin(x), Math.cos(y) * Math.cos(x)).multiplyScalar(look.distance).add(target);
    controls.target.copy(target);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const paint = () => {
    const c = new Color();
    c.set(look.filmColor);
    filmColor.value.set(c.r, c.g, c.b);
    c.set(look.ballColor);
    ballColor.value.set(c.r, c.g, c.b);
    ballMat.color.set(look.ballColor);
    ballMat.roughness = look.ballRough;
    ballRough.value = look.ballRough;
    outer.roughness = inner.roughness = look.filmRough;
    thick.value = look.thick;
    keyI.value = look.key;
    envI.value = look.envLight;
    keyDir.value.copy(st.key.position).sub(st.key.target.position).normalize();
  };
  paint();

  const ev = st.gui.addFolder("veil");
  ev.add(look, "speed", 0.1, 4, 0.05);
  ev.add(look, "cycle", 6, 40, 0.5);
  for (const [k, lo, hi, s] of [
    ["start", 1.5, 10, 0.1],
    ["v0", 0.2, 4, 0.01],
    ["mass", 5, 400, 1],
    ["gamma", 0.1, 4, 0.01],
    ["rho", 0.02, 2, 0.01],
    ["drag", 0, 2, 0.01],
    ["viscosity", 0, 0.5, 0.005],
    ["grip", 0, 200, 1],
    ["fluid", 0, 1, 0.01],
    ["thick", 0.005, 0.3, 0.005],
    ["aim", -2, 2, 0.01],
    ["tilt", -40, 40, 1],
  ] as const)
    ev.add(look, k, lo, hi, s).onFinishChange(restart);
  ev.add({ restart }, "restart");
  const lk = st.gui.addFolder("look");
  lk.addColor(look, "filmColor").onChange(paint);
  lk.add(look, "filmRough", 0, 0.4, 0.005).onChange(paint);
  lk.addColor(look, "ballColor").onChange(paint);
  lk.add(look, "ballRough", 0, 1, 0.01).onChange(paint);
  lk.add(look, "fov", 10, 70, 1).onChange(frameUp);
  lk.add(look, "yaw", -180, 180, 1).onChange(frameUp);
  lk.add(look, "pitch", -30, 60, 1).onChange(frameUp);
  lk.add(look, "distance", 6, 40, 0.1).onChange(frameUp);
  lk.add({ frameUp }, "frameUp").name("reset view");
  st.gui.onChange(() => {
    st.refresh();
    paint();
  });
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, restart, get sim() { return sim; } } });

  let clock = 0, last = performance.now();
  wrap.render = () => {
    const now = performance.now();
    const dt = Math.min(1 / 30, (now - last) / 1000);
    last = now;
    if (st.state.hold >= 0) clock = st.state.hold * look.cycle;
    else clock = (clock + dt * look.speed) % look.cycle;
    advance(clock);
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => st.renderer.dispose();
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 12_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
