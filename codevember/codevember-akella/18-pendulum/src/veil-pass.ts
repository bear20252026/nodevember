// 8. A ball through a mirror that turns out to be cloth (a tribute to arc4g). A square of polished rose-gold
//    cloth, held taut in a frame, reads as a mirror; the ball meets its reflection, the mirror gives, the frame
//    lets go of the edges here and there, and the ball carries the whole sheet away wrapped round it, the tail
//    streaming back in folds. Real cloth (wrap.wgsl): inextensible, keeps off the ball and off itself, still
//    air against it. One pass, slowed down, to get the physics right before it goes on a pendulum.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import {
  attribute,
  cameraPosition,
  cameraViewMatrix,
  float,
  ivec2,
  max,
  normalize,
  pmremTexture,
  positionWorld,
  reflectVector,
  smoothstep,
  textureLoad,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ExtrudeGeometry,
  FloatType,
  FrontSide,
  Mesh,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NearestFilter,
  Path,
  RGBAFormat,
  Shape,
  SphereGeometry,
  StorageTexture,
  Vector3,
} from "three/webgpu";
import { createStage, studioLook } from "./stage.ts";
import { cloth, WrapSim } from "./wrap-sim.ts";

const query = new URLSearchParams(location.search);
if (query.has("n")) cloth.n = Number(query.get("n"));

const look = {
  ...studioLook,
  // the event
  speed: 0.25, // simulated seconds per second: slow motion
  cycle: 2.4, // simulated seconds before it starts again
  start: 1.0, // the ball's distance behind the mirror at the start
  v0: 3, // m/s
  ballR: 0.16,
  aim: 0, // off centre, m
  // the cloth (see wrap-sim.ts)
  density: cloth.density,
  grip: cloth.grip,
  gripSpread: cloth.gripSpread,
  give: cloth.give,
  tension: cloth.tension,
  air: cloth.air,
  bend: cloth.bend,
  gravity: cloth.gravity,
  friction: cloth.friction,
  self: cloth.self,
  // the look
  clothColor: "#f4b399",
  clothRough: 0.06,
  hollowTint: 3, // folds turned in on themselves see the cloth's own colour, deeper
  thickness: 0.006, // drawn
  frameColor: "#eab7a2",
  ballColor: "#e9e9ee",
  ballRough: 0.04,
  back: "#bccbd9",
  backEdge: "#a9bacb",
  exposure: 1,
  envLight: 1.2,
  key: 2.6,
  keyAzimuth: -40,
  keyElevation: 50,
  bloom: 0.1,
  bloomThreshold: 1.3,
  vignette: 0.15,
  film: 0.01,
  yaw: 52,
  pitch: 8,
  distance: 6,
  fov: 30,
};

const storageTexture = (n: number) => {
  const t = new StorageTexture(n, n);
  t.format = RGBAFormat;
  t.type = FloatType;
  t.minFilter = t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "veil", look, room: "sky" });
  const { scene, camera, controls, renderer } = st;
  st.floor.visible = false;
  st.key.castShadow = false;
  st.aimKey(4, { x: 0, y: 0, z: 0 });

  const N = cloth.n;
  const posTex = storageTexture(N);
  const norTex = storageTexture(N);
  renderer.initTexture(posTex);
  renderer.initTexture(norTex);
  const backend = renderer.backend as unknown as { device?: GPUDevice; get(t: unknown): { texture: GPUTexture } };
  if (!backend.device) throw new Error("the cloth needs WebGPU");
  const sim = new WrapSim(backend.device, cloth, backend.get(posTex).texture, backend.get(norTex).texture);

  // ---- the frame: a rounded square band; the sheet's edge sits inside it
  const half = cloth.size / 2 - 0.01, band = 0.035, depth = 0.05;
  const rounded = <T extends Path>(path: T, a: number, r: number): T => {
    path.moveTo(-a + r, -a);
    path.lineTo(a - r, -a);
    path.absarc(a - r, -a + r, r, -Math.PI / 2, 0, false);
    path.lineTo(a, a - r);
    path.absarc(a - r, a - r, r, 0, Math.PI / 2, false);
    path.lineTo(-a + r, a);
    path.absarc(-a + r, a - r, r, Math.PI / 2, Math.PI, false);
    path.lineTo(-a, -a + r);
    path.absarc(-a + r, -a + r, r, Math.PI, 1.5 * Math.PI, false);
    return path;
  };
  const outline = rounded(new Shape(), half + band, 0.06);
  outline.holes.push(rounded(new Path(), half, 0.03));
  const frameGeo = new ExtrudeGeometry(outline, { depth: depth - 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 4, curveSegments: 24 });
  frameGeo.translate(0, 0, -(depth - 0.012) / 2);
  const frameMat = new MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.18 });
  scene.add(new Mesh(frameGeo, frameMat));

  // ---- the ball
  const ballMat = new MeshStandardNodeMaterial({ metalness: 1 });
  const ball = new Mesh(new SphereGeometry(1, 96, 48), ballMat);
  scene.add(ball);

  // ---- the cloth: one grid drawn twice, half the thickness out each way, and a rim round its edge
  const grid = new BufferGeometry();
  const cell = new Float32Array(N * N * 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) cell.set([x, y], (y * N + x) * 2);
  const index = new Uint32Array((N - 1) * (N - 1) * 6);
  let o = 0;
  for (let y = 0; y < N - 1; y++)
    for (let x = 0; x < N - 1; x++) {
      const a = y * N + x;
      // wound to face the grid normal (+z on the flat sheet); diagonals alternate so the triangles don't lean
      if ((x + y) % 2) index.set([a, a + 1, a + N, a + 1, a + N + 1, a + N], o);
      else index.set([a, a + N + 1, a + N, a, a + 1, a + N + 1], o);
      o += 6;
    }
  grid.setAttribute("position", new BufferAttribute(new Float32Array(N * N * 3), 3));
  grid.setAttribute("cell", new BufferAttribute(cell, 2));
  grid.setIndex(new BufferAttribute(index, 1));

  const U = {
    thick: uniform(look.thickness),
    color: uniform(new Vector3()),
    hollow: uniform(look.hollowTint),
    ballAt: uniform(new Vector3()),
    ballR: uniform(look.ballR),
    ballColor: uniform(new Vector3()),
    ballRough: uniform(look.ballRough),
    env: uniform(look.envLight),
  };
  const env = scene.environment!;
  // the ball in the mirror, traced: where the reflected ray meets it, the polished ball's own reflection
  const ballSeen = () => {
    const rd = reflectVector.normalize();
    const oc = positionWorld.sub(U.ballAt);
    const b = oc.dot(rd);
    const disc = b.mul(b).sub(oc.dot(oc)).add(U.ballR.mul(U.ballR));
    const t = b.negate().sub(max(disc, 0).sqrt());
    const nb = oc.add(rd.mul(t)).normalize();
    const hit = smoothstep(0, 0.0004, disc).mul(smoothstep(0, 0.01, t));
    const seen = pmremTexture(env, rd.reflect(nb), U.ballRough).mul(U.env).mul(U.ballColor);
    return { hit, seen };
  };
  const cellOf = () => ivec2(attribute("cell", "vec2"));
  const shell = (sign: 1 | -1) => {
    const m = new MeshStandardNodeMaterial({ side: sign > 0 ? FrontSide : BackSide });
    m.metalness = 1;
    const P = textureLoad(posTex, cellOf()).xyz;
    const T = textureLoad(norTex, cellOf());
    m.positionNode = P.add(T.xyz.mul(U.thick.mul(0.5 * sign)));
    const nw = varying(T.xyz.mul(sign), "vClothNormal");
    const hollow = varying(T.w.mul(sign), "vClothHollow");
    // a smooth normal on a grazing fold can turn from the eye: keep it facing us
    const V = normalize(cameraPosition.sub(positionWorld));
    const n0 = normalize(nw);
    const n = normalize(n0.add(V.mul(max(n0.dot(V).negate().add(0.05), 0))));
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(n, 0)).xyz);
    // a fold turned in on itself sees mostly the cloth: its colour, deeper and darker
    const cav = max(hollow, 0).mul(U.hollow);
    const base = U.color.pow(float(1).add(cav)).div(float(1).add(cav.mul(0.25)));
    const { hit, seen } = ballSeen();
    m.colorNode = base.mul(hit.oneMinus());
    m.emissiveNode = base.mul(seen).mul(hit);
    return m;
  };
  const outer = shell(1), inner = shell(-1);
  for (const m of [outer, inner]) {
    const mesh = new Mesh(grid, m);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // the rim: the edge's thickness, a strip round the sheet's border
  const ring: [number, number, number, number][] = [];
  for (let x = 0; x < N; x++) ring.push([x, 0, 0, 1]);
  for (let y = 1; y < N; y++) ring.push([N - 1, y, -1, 0]);
  for (let x = N - 2; x >= 0; x--) ring.push([x, N - 1, 0, -1]);
  for (let y = N - 2; y >= 0; y--) ring.push([0, y, 1, 0]);
  const rimGeo = new BufferGeometry();
  const rc = new Float32Array(ring.length * 2 * 2), ri = new Float32Array(ring.length * 2 * 2), rs = new Float32Array(ring.length * 2);
  ring.forEach(([x, y, ix, iy], k) => {
    for (const s of [0, 1]) {
      rc.set([x, y], (2 * k + s) * 2);
      ri.set([ix, iy], (2 * k + s) * 2);
      rs[2 * k + s] = s ? 1 : -1;
    }
  });
  const rimIndex: number[] = [];
  for (let k = 0; k < ring.length; k++) {
    const a = 2 * k, b = 2 * ((k + 1) % ring.length);
    rimIndex.push(a, b, a + 1, a + 1, b, b + 1);
  }
  rimGeo.setAttribute("position", new BufferAttribute(new Float32Array(ring.length * 2 * 3), 3));
  rimGeo.setAttribute("cell", new BufferAttribute(rc, 2));
  rimGeo.setAttribute("inward", new BufferAttribute(ri, 2));
  rimGeo.setAttribute("side", new BufferAttribute(rs, 1));
  rimGeo.setIndex(rimIndex);
  const rimMat = new MeshStandardNodeMaterial({ side: DoubleSide });
  rimMat.metalness = 1;
  {
    const c = cellOf();
    const P = textureLoad(posTex, c).xyz;
    const T = textureLoad(norTex, c);
    const Pi = textureLoad(posTex, c.add(ivec2(attribute("inward", "vec2")))).xyz;
    rimMat.positionNode = P.add(T.xyz.mul(U.thick.mul(0.5).mul(attribute("side", "float"))));
    const out = P.sub(Pi);
    const ow = varying(normalize(out.sub(T.xyz.mul(out.dot(T.xyz))).add(T.xyz.mul(1e-4))), "vRimNormal");
    rimMat.normalNode = normalize(cameraViewMatrix.mul(vec4(normalize(ow), 0)).xyz);
    rimMat.colorNode = U.color;
  }
  const rim = new Mesh(rimGeo, rimMat);
  rim.frustumCulled = false;
  scene.add(rim);

  // ---- the event
  const ballAt = (t: number) => [look.aim, 0, -look.start - look.ballR + look.v0 * t];
  const step = () => sim.advance(look.speed / 60, ballAt(sim.time), ballAt(sim.time + look.speed / 60), look.ballR);
  const restart = () => {
    Object.assign(cloth, {
      density: look.density,
      grip: look.grip,
      gripSpread: look.gripSpread,
      give: look.give,
      tension: look.tension,
      air: look.air,
      bend: look.bend,
      gravity: look.gravity,
      friction: look.friction,
      self: look.self,
    });
    sim.reset();
    // a moment for the sheet to come taut in its frame, the ball still far off
    for (let k = 0; k < 20; k++) sim.advance(1 / 120, ballAt(-10), ballAt(-10), look.ballR, k === 19);
    sim.time = 0;
  };
  restart();

  // where the sheet is: how much of the edge the frame still holds, how far it has gone (for tests)
  const probe = async () => {
    const { pos, anchor } = await sim.read();
    let held = 0, edge = 0, zmin = 1e9, zmax = -1e9, rmax = 0;
    const n = sim.n;
    for (let i = 0; i < n * n; i++) {
      const z = pos[4 * i + 2];
      zmin = Math.min(zmin, z);
      zmax = Math.max(zmax, z);
      rmax = Math.max(rmax, Math.hypot(pos[4 * i], pos[4 * i + 1]));
      if (anchor[4 * i + 3] >= 0) {
        edge++;
        if (anchor[4 * i + 3] > 0) held++;
      }
    }
    // stretch: the longest grid spring over its rest length
    let worst = 0, sum = 0, cnt = 0;
    for (let y = 0; y < n; y++)
      for (let x = 0; x + 1 < n; x++) {
        const a = 4 * (y * n + x), b = a + 4;
        const l = Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]) / sim.d;
        worst = Math.max(worst, l);
        sum += l;
        cnt++;
      }
    return { t: +sim.time.toFixed(3), held: +(held / edge).toFixed(3), zmin: +zmin.toFixed(3), zmax: +zmax.toFixed(3), rmax: +rmax.toFixed(3), stretchMean: +(sum / cnt).toFixed(4), stretchWorst: +worst.toFixed(3), ball: ballAt(sim.time).map((v) => +v.toFixed(3)), subs: sim.subs };
  };

  const frameUp = () => {
    camera.fov = look.fov;
    const y = (look.yaw * Math.PI) / 180, x = (look.pitch * Math.PI) / 180;
    const target = new Vector3(0, 0, 0.5);
    camera.position.set(Math.sin(y) * Math.cos(x), Math.sin(x), Math.cos(y) * Math.cos(x)).multiplyScalar(look.distance).add(target);
    controls.target.copy(target);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const paint = () => {
    const c = new Color();
    c.set(look.clothColor);
    U.color.value.set(c.r, c.g, c.b);
    c.set(look.ballColor);
    U.ballColor.value.set(c.r, c.g, c.b);
    ballMat.color.set(look.ballColor);
    ballMat.roughness = look.ballRough;
    U.ballRough.value = look.ballRough;
    frameMat.color.set(look.frameColor);
    outer.roughness = inner.roughness = rimMat.roughness = look.clothRough;
    U.thick.value = look.thickness;
    U.hollow.value = look.hollowTint;
    U.env.value = look.envLight;
    U.ballR.value = look.ballR;
    ball.scale.setScalar(look.ballR);
  };
  paint();

  const ev = st.gui.addFolder("veil");
  ev.add(look, "speed", 0.05, 1, 0.01);
  ev.add(look, "cycle", 0.5, 6, 0.05);
  for (const [k, lo, hi, s] of [
    ["start", 0.3, 3, 0.01],
    ["v0", 0.5, 8, 0.05],
    ["ballR", 0.05, 0.4, 0.005],
    ["aim", -0.8, 0.8, 0.01],
    ["density", 0.05, 1, 0.01],
    ["grip", 2, 200, 1],
    ["gripSpread", 0, 1, 0.01],
    ["give", 0.0005, 0.03, 0.0005],
    ["tension", 0, 60, 0.5],
    ["air", 0, 4, 0.05],
    ["bend", 0, 400, 1],
    ["gravity", 0, 10, 0.1],
    ["friction", 0, 2, 0.01],
  ] as const)
    ev.add(look, k, lo, hi, s).onFinishChange(restart);
  ev.add(look, "self").name("keeps off itself").onChange(restart);
  ev.add({ restart }, "restart");
  const lk = st.gui.addFolder("look");
  lk.addColor(look, "clothColor").onChange(paint);
  lk.add(look, "clothRough", 0, 0.5, 0.005).onChange(paint);
  lk.add(look, "hollowTint", 0, 5, 0.05).onChange(paint);
  lk.add(look, "thickness", 0, 0.03, 0.0005).onChange(paint);
  lk.addColor(look, "frameColor").onChange(paint);
  lk.addColor(look, "ballColor").onChange(paint);
  lk.add(look, "ballRough", 0, 1, 0.01).onChange(paint);
  lk.add(look, "fov", 10, 70, 1).onChange(frameUp);
  lk.add(look, "yaw", -180, 180, 1).onChange(frameUp);
  lk.add(look, "pitch", -30, 60, 1).onChange(frameUp);
  lk.add(look, "distance", 2, 30, 0.1).onChange(frameUp);
  lk.add({ frameUp }, "frameUp").name("reset view");
  st.gui.onChange(() => {
    st.refresh();
    paint();
  });
  st.refresh();

  const ctl = { manual: false }; // tests drive the sim themselves
  Object.assign(window, { __pendulum: { ...st, frameUp, restart, probe, sim, cloth, ctl, step } });

  const dtFrame = () => look.speed / 60;
  wrap.render = () => {
    if (ctl.manual) {
      // a test is driving
    } else if (st.state.hold >= 0) {
      // a still: the event replayed to that moment, a frame's worth at a time
      const to = st.state.hold * look.cycle;
      if (to < sim.time - 1e-6) restart();
      while (sim.time + dtFrame() / 2 < to) step();
    } else {
      if (sim.time + dtFrame() > look.cycle) restart();
      step();
    }
    const b = ballAt(sim.time);
    ball.position.set(b[0], b[1], b[2]);
    U.ballAt.value.set(b[0], b[1], b[2]);
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => st.renderer.dispose();
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 10_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
