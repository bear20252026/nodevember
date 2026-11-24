import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TSL from "three/tsl";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  HalfFloatType,
  HemisphereLight,
  LinearFilter,
  Mesh,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PMREMGenerator,
  RepeatWrapping,
  ClampToEdgeWrapping,
  Data3DTexture,
  RedFormat,
  RGBAFormat,
  Scene,
  SphereGeometry,
  WebGPURenderer,
} from "three/webgpu";
import { bake, bakeMesh, FLAKE_RINGS, FLAKE_SEGS, loadSurface, shape, type BakedMesh } from "./bake.ts";

// the body: a watertight Suzanne by default (tools/suzanne.py); ?body=sphere is the piece as first made, ?body=face
// the face from day 3 (tools/face.mjs). tools/body.py makes more from any sealed mesh (day 3's statues were tried)
const BODIES = ["suzanne", "sphere", "face"];
const BODY = BODIES.find((b) => b === new URLSearchParams(location.search).get("body")) ?? BODIES[0];
const MESH = BODY !== "sphere";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const {
  abs,
  atan,
  attribute,
  bumpMap,
  clamp,
  color,
  cos,
  cross,
  dot,
  exp,
  float,
  Fn,
  fract,
  frontFacing,
  If,
  instanceIndex,
  instancedArray,
  int,
  ivec3,
  atomicAdd,
  atomicStore,
  storage,
  uint,
  floor,
  length,
  Loop,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  mx_worley_noise_float,
  normalize,
  normalLocal,
  positionGeometry,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
  screenUV,
  texture3D,
  normalGeometry,
} = T;

// how a patch ages on its way across the front of the sphere (units of "age": 0 = entering, see look.span)
export const look = {
  span: 2.5, // age reached at the far limb by a patch whose corrosion starts first
  veinAt: 0.0, // veins show through the enamel
  blisterAt: [0.12, 0.45],
  crackAt: [0.3, 0.55],
  crackWidth: 0.0016,
  peelAt: [0.45, 1.15],
  fallAt: 1.0, // plus up to fallSpread, per flake
  fallSpread: 0.35,
  fallShare: 0.05, // how many flakes drop off; the rest stay curled
  fallDown: 0.7, // 0: which ones fall is chance; 1: the ones facing down go first (with a small share, only those)
  gravity: 0.5,
  // loose flakes (a sim on the GPU)
  drag: 0.3, // air drag, 1/s: what makes them light
  airDrag: 0.9, // more drag once clear of the surface, 1/s: falling chips drift instead of speeding up
  friction: 0.2, // sliding on rust, 1/s, relative to the turning surface
  push: 0.35, // how much of an overlap a touch undoes per step
  bounce: 0.25, // how much of that push becomes velocity: light chips nudge, they do not bounce
  spin: 9, // a glancing touch sets a flake turning
  flutter: 0.35, // sideways sway once airborne
  stumble: 4, // how readily a sliding chip catches its leading edge and tips up, 1/s
  tipWeight: 0.5, // gravity on a tipping chip (less than 1: air holds it up)
  tipDrag: 3.5, // air drag on tipping, 1/s: slow flops
  enamel: "#e4e2d6",
  stain: "#b8692f",
  rust: "#6e2e10",
  rustDeep: "#24110a",
  rustBright: "#c25a1c",
  under: "#d8ccb4",
  background: "#1a1715",
  keyAzimuth: 100, // degrees, from the camera towards +x: from the right, a little behind
  keyElevation: 35,
  key: 4.2,
  kick: 0.9, // a cool light from the left so the clean side still reads
  kickAzimuth: -115,
  kickElevation: 15,
  fill: 0.06,
  env: 0.08,
  exposure: 1.0,
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: true });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(width, height);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = look.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  await renderer.init();
  flattenSwizzles(renderer);

  // the bake takes a few seconds on the main thread: let the note paint first
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  const surface = MESH ? loadSurface(...((await Promise.all([`./${BODY}.mesh.bin`, `./${BODY}.sdf.bin`].map(async (u) => (await fetch(u)).arrayBuffer()))) as [ArrayBuffer, ArrayBuffer])) : null;
  const baked = surface ? bakeMesh(surface, { ...shape, flake: 0.08 }) : bake();
  const bm = baked as BakedMesh;
  document.getElementById("note")?.remove();
  console.log("bake ms", baked.ms, "flakes", baked.flakes);

  const scene = new Scene();
  const camera = new PerspectiveCamera(26, width / height, 0.1, 50);
  const home = 5.2;
  camera.position.set(0, Math.sin(0.06) * home, Math.cos(0.06) * home);
  camera.lookAt(0, 0, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 7;
  // the reset happens behind the sphere, so the camera stays roughly in front
  controls.minAzimuthAngle = -0.7;
  controls.maxAzimuthAngle = 0.7;
  controls.minPolarAngle = Math.PI / 2 - 0.35;
  controls.maxPolarAngle = Math.PI / 2 + 0.25;

  const pmrem = new PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = look.env;

  const bg = uniform(new Color(look.background));
  scene.backgroundNode = Fn(() => {
    const p = screenUV.sub(vec2(0.55, 0.45));
    return bg.mul(float(1.25).sub(length(p).mul(1.1)));
  })();

  const key = new DirectionalLight(0xfff1de, look.key);
  key.castShadow = true;
  key.shadow.mapSize.set(4096, 4096);
  key.shadow.radius = 2;
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.002;
  const sc = key.shadow.camera;
  sc.left = sc.bottom = -1.15;
  sc.right = sc.top = 1.15;
  sc.near = 1;
  sc.far = 9;
  scene.add(key, key.target);
  const fill = new HemisphereLight(0xbfd0e0, 0x2a1d14, look.fill);
  scene.add(fill);
  const kick = new DirectionalLight(0xc8d8ff, look.kick);
  scene.add(kick);
  const placeKey = () => {
    const az = (look.keyAzimuth * Math.PI) / 180,
      el = (look.keyElevation * Math.PI) / 180;
    key.position.set(Math.sin(az) * Math.cos(el) * 5, Math.sin(el) * 5, Math.cos(az) * Math.cos(el) * 5);
    key.intensity = look.key;
    const ka = (look.kickAzimuth * Math.PI) / 180,
      ke = (look.kickElevation * Math.PI) / 180;
    kick.position.set(Math.sin(ka) * Math.cos(ke) * 5, Math.sin(ke) * 5, Math.cos(ka) * Math.cos(ke) * 5);
    kick.intensity = look.kick;
    fill.intensity = look.fill;
    scene.environmentIntensity = look.env;
    renderer.toneMappingExposure = look.exposure;
  };
  placeKey();

  // ---- the shared clock: age of a body point from where it is on its way round
  const field = new DataTexture(baked.field, baked.fieldW, baked.fieldH, RGBAFormat, HalfFloatType);
  field.minFilter = field.magFilter = LinearFilter;
  field.wrapS = RepeatWrapping;
  field.wrapT = ClampToEdgeWrapping;
  field.generateMipmaps = false;
  field.needsUpdate = true;

  const theta = uniform(0); // spin angle
  const limb = uniform(Math.acos(1 / home)); // half the visible arc
  const span = uniform(look.span);
  const omega = uniform(1); // spin rate, rad/s
  const u = {
    blister0: uniform(look.blisterAt[0]),
    blister1: uniform(look.blisterAt[1]),
    crack0: uniform(look.crackAt[0]),
    crack1: uniform(look.crackAt[1]),
    crackWidth: uniform(look.crackWidth),
    peel0: uniform(look.peelAt[0]),
    peel1: uniform(look.peelAt[1]),
    fallAt: uniform(look.fallAt),
    fallSpread: uniform(look.fallSpread),
    fallShare: uniform(look.fallShare),
    gravity: uniform(look.gravity),
    drag: uniform(look.drag),
    airDrag: uniform(look.airDrag),
    friction: uniform(look.friction),
    push: uniform(look.push),
    bounce: uniform(look.bounce),
    spin: uniform(look.spin),
    flutter: uniform(look.flutter),
    stumble: uniform(look.stumble),
    tipWeight: uniform(look.tipWeight),
    tipDrag: uniform(look.tipDrag),
    enamel: uniform(new Color(look.enamel)),
    stain: uniform(new Color(look.stain)),
    rust: uniform(new Color(look.rust)),
    rustDeep: uniform(new Color(look.rustDeep)),
    rustBright: uniform(new Color(look.rustBright)),
    under: uniform(new Color(look.under)),
  };

  const uvOf = (p: any) =>
    vec2(
      atan(p.x, p.z)
        .div(Math.PI * 2)
        .add(0.5),
      T.asin(clamp(p.y, -1, 1))
        .div(Math.PI)
        .add(0.5),
    );
  // view longitude: 0 facing the home camera, the front surface moves from -limb to +limb
  const clock = (p: any, th: any = theta) => {
    const psi = fract(
      atan(p.x, p.z)
        .add(th)
        .add(Math.PI)
        .div(Math.PI * 2),
    )
      .mul(Math.PI * 2)
      .sub(Math.PI);
    return psi.add(limb).div(limb.mul(2)).mul(span);
  };
  // on a mesh the clock reads the way the surface faces (its normal plus as much of where it is, for the
  // near-vertical bits): then the reset happens as a patch faces away, out of sight on any shape. By position,
  // the back of Suzanne's chin sits on the reset line facing the camera when she looks away.
  const faceDir = (p: any, n: any) => n.add(p.mul(1.0));
  // seconds per unit of age, for things that move in real time once they let go
  const ageRate = () => span.div(limb.mul(2)).mul(omega);

  // the body's surface: distance (to the bare iron) and normal, in the body's own frame or the world's (turned by th)
  let sdfTex: Data3DTexture | null = null;
  if (surface) {
    const { n, half } = surface.sdf;
    sdfTex = new Data3DTexture(half, n, n, n);
    sdfTex.format = RedFormat;
    sdfTex.type = HalfFloatType;
    sdfTex.minFilter = sdfTex.magFilter = LinearFilter;
    sdfTex.wrapS = sdfTex.wrapT = sdfTex.wrapR = ClampToEdgeWrapping;
    sdfTex.unpackAlignment = 1;
    sdfTex.needsUpdate = true;
  }
  const sdfObj = (p: any) => {
    const { n, origin, step } = surface!.sdf;
    return texture3D(sdfTex, p.sub(origin).div(n * step), float(0)).r;
  };
  const normObj = (p: any) => {
    const e = surface!.sdf.step * 0.5;
    const k0 = vec3(1, -1, -1),
      k1 = vec3(-1, -1, 1),
      k2 = vec3(-1, 1, -1),
      k3 = vec3(1, 1, 1);
    const g = k0
      .mul(sdfObj(p.add(k0.mul(e))))
      .add(k1.mul(sdfObj(p.add(k1.mul(e)))))
      .add(k2.mul(sdfObj(p.add(k2.mul(e)))))
      .add(k3.mul(sdfObj(p.add(k3.mul(e)))));
    // outside the field's box it is flat (chips falling away): point away from the middle instead
    return select(length(g).greaterThan(1e-6), normalize(g), normalize(p.add(vec3(0, 0, 1e-6))));
  };

  // ---- the iron and its rust
  // 256×128 is smooth at any framing; finer triangles only shade the same pixels several times over (2×2 quads)
  let core: BufferGeometry = new SphereGeometry(1, 256, 128);
  if (surface) {
    core = new BufferGeometry();
    core.setAttribute("position", new BufferAttribute(surface.position, 3));
    core.setAttribute("normal", new BufferAttribute(surface.normal, 3));
    core.setAttribute("aField", new BufferAttribute(bm.coreField, 2));
    core.setIndex(new BufferAttribute(surface.index, 1));
  }
  const metal = new MeshPhysicalNodeMaterial();
  {
    const p = MESH ? positionGeometry : normalize(positionGeometry);
    const f = MESH ? attribute("aField", "vec2") : texture(field, uvOf(p));
    const age = clock(MESH ? faceDir(p, normalGeometry) : p).sub(f.r);
    // scaly crust: plates that heave, blisters of oxide, fine grain, pits
    const warp = mx_noise_float(p.mul(9)).mul(0.5);
    const plates = smoothstep(0.0, 0.75, mx_worley_noise_float(p.mul(28).add(warp))).oneMinus();
    const nodules = smoothstep(0.1, 0.6, mx_worley_noise_float(p.mul(95).add(warp))).oneMinus();
    const grain = mx_fractal_noise_float(p.mul(240), 3, 2.1, 0.5);
    const mid = mx_fractal_noise_float(p.mul(22), 3, 2.0, 0.5);
    const big = mx_fractal_noise_float(p.mul(5), 3, 2.0, 0.55);
    const pits = smoothstep(0.6, 0.9, mx_noise_float(p.mul(90)).mul(0.5).add(0.5));
    // the vein tracks stay as dark furrows once the paint is off
    const track = f.g;
    const height = plates.mul(0.5).add(nodules.mul(0.35)).add(grain.mul(0.25)).add(mid.mul(0.4)).sub(pits.mul(0.6)).sub(track.mul(0.5));
    metal.normalNode = bumpMap(height.mul(0.004), float(1));
    // colour by height: crevices near black, the body brown, raised crust bright, a little ochre bloom
    const bloom = smoothstep(0.3, 1.4, age);
    const hgt = height.mul(0.6).add(big.mul(0.5)).add(0.35);
    let c = mix(u.rustDeep, u.rust, smoothstep(0.05, 0.55, hgt));
    c = mix(c, u.rustBright, smoothstep(0.45, 0.95, hgt.add(grain.mul(0.3))).mul(bloom.mul(0.7).add(0.3)));
    c = mix(c, vec3(0.6, 0.42, 0.2), smoothstep(0.55, 0.85, mid.mul(0.5).add(0.5)).mul(0.3).mul(bloom));
    c = mix(c, u.rustDeep.mul(0.45), pits.mul(0.85).max(track.mul(0.6)));
    // before corrosion gets here it is primed steel: a pinhole between flakes reads as paint, not as a black dot
    c = mix(u.under.mul(0.8), c, smoothstep(0.1, 0.3, age));
    metal.colorNode = c;
    metal.metalnessNode = float(0);
    // fresh exposure is damp and catches a little light; it dries to powder
    metal.roughnessNode = float(0.95).sub(bloom.oneMinus().mul(0.25));
  }
  const iron = new Mesh(core, metal);
  iron.receiveShadow = true;
  iron.castShadow = true;
  scene.add(iron);

  // ---- the enamel, cut into flakes that crack, roll up and drop
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(baked.position, 3));
  // rest normals; the vertex stage replaces them with the rolled ones
  geo.setAttribute("normal", new BufferAttribute(MESH ? bm.paintNormal : baked.position.map((v) => v / shape.paint), 3));
  if (MESH) geo.setAttribute("aField", new BufferAttribute(bm.paintField, 2));
  geo.setAttribute("aLift", new BufferAttribute(baked.lift, 4));
  geo.setAttribute("aCut", new BufferAttribute(baked.cut, 1));
  geo.setAttribute("aFlake", new BufferAttribute(baked.flake, 4));
  geo.setAttribute("aSeed", new BufferAttribute(baked.seed, 4));
  geo.setIndex(new BufferAttribute(baked.index, 1));
  geo.computeBoundingSphere();

  const aLift = attribute("aLift", "vec4");
  const aCut = attribute("aCut", "float");
  const aFlake = attribute("aFlake", "vec4");
  const aSeed = attribute("aSeed", "vec4");

  const aId = attribute("aId", "float");

  const randOf = (w: any, k: number) => fract(w.mul(k).add(0.37 * k));
  const rand = (k: number) => randOf(aSeed.w, k);
  // rank: this flake's place (0..1) in the order they fall in, from flakeInfo; the first fallShare of them go
  const fallStartOf = (w: any, rank: any) => select(rank.lessThan(u.fallShare), u.fallAt.add(randOf(w, 13.7).mul(u.fallSpread)), float(1e6));
  const flakeAge = () => clock(MESH ? faceDir(aSeed.xyz, flakeInfo.element(int(aId).mul(FI).add(2)).xyz) : aSeed.xyz).sub(aFlake.x);
  const fallTime = () =>
    flakeAge()
      .sub(fallStartOf(aSeed.w, flakeInfo.element(int(aId).mul(FI).add(1)).w))
      .div(ageRate());

  const rodrigues = (v: any, k: any, a: any) =>
    v
      .mul(cos(a))
      .add(cross(k, v).mul(sin(a)))
      .add(k.mul(dot(k, v)).mul(cos(a).oneMinus()));
  const turnY = (v: any, a: any) => vec3(v.x.mul(cos(a)).add(v.z.mul(sin(a))), v.y, v.z.mul(cos(a)).sub(v.x.mul(sin(a))));
  const qmul = (a: any, b: any) => vec4(b.xyz.mul(a.w).add(a.xyz.mul(b.w)).add(cross(a.xyz, b.xyz)), a.w.mul(b.w).sub(dot(a.xyz, b.xyz)));
  const qrot = (q: any, v: any) => v.add(cross(q.xyz, cross(q.xyz, v).add(v.mul(q.w))).mul(2));
  const qaxis = (k: any, a: any) => vec4(k.mul(sin(a.mul(0.5))), cos(a.mul(0.5)));

  // ---- loose flakes: one rigid disc per flake, stepped on the GPU so that chips sliding on the sphere push
  // each other. State per flake (4 × vec4, world frame): centre + mode (0 on, 1 loose, 2 gone), velocity + lift
  // (how far it rides up on the ones beneath), orientation quaternion (from the sphere's own frame), spin about
  // its normal + the time since it let go.
  const N = baked.flakes;
  const VPF = 1 + FLAKE_RINGS * FLAKE_SEGS;
  const flakeIds = new Float32Array(N * VPF);
  const FI = MESH ? 3 : 2; // vec4s per flake in flakeInfo
  const CS = MESH ? 1 : shape.paint; // aSeed.xyz times this is the centre on the paint skin
  const info = new Float32Array(N * FI * 4); // per flake: centre xyz + random, onset + footprint radius + furthest reach (+ normal on the mesh)
  for (let f = 0; f < N; f++) {
    const v0 = f * VPF;
    flakeIds.fill(f, v0, v0 + VPF);
    const cx = baked.seed[v0 * 4],
      cy = baked.seed[v0 * 4 + 1],
      cz = baked.seed[v0 * 4 + 2],
      w = baked.seed[v0 * 4 + 3];
    const [onset, Lmin, Lmax, R] = baked.flake.subarray(v0 * 4, v0 * 4 + 4);
    const [nx, ny, nz] = MESH ? bm.flakeNormal.subarray(f * 3, f * 3 + 3) : [cx, cy, cz];
    // footprint once cupped (the shader's curl at full peel): the outline's mean reach from the centre
    const reach = ((w * 5.9 + 0.37 * 5.9) % 1) * 0.3 + 0.45;
    const front = Lmin + (Lmax - Lmin) * reach;
    let sum = 0,
      far = 0;
    for (let k = 0; k < FLAKE_SEGS; k++) {
      let most = 0;
      for (let ring = 1; ring <= FLAKE_RINGS; ring++) {
        const j = v0 + 1 + (ring - 1) * FLAKE_SEGS + k;
        const px = baked.position[j * 3],
          py = baked.position[j * 3 + 1],
          pz = baked.position[j * 3 + 2];
        const [gx, gy, gz, L] = baked.lift.subarray(j * 4, j * 4 + 4);
        const glen = Math.max(Math.hypot(gx, gy, gz), 0.25);
        const along = Math.max(front - L, 0) / glen;
        const th = along / R;
        const r = R / (1 + 0.16 * th);
        const t = along - r * Math.sin(th);
        const qx = px + (gx / glen) * t - cx * CS,
          qy = py + (gy / glen) * t - cy * CS,
          qz = pz + (gz / glen) * t - cz * CS;
        const up = qx * nx + qy * ny + qz * nz;
        most = Math.max(most, Math.hypot(qx - nx * up, qy - ny * up, qz - nz * up));
      }
      sum += most;
      far = Math.max(far, most);
    }
    info.set([cx, cy, cz, w, onset, (sum / FLAKE_SEGS) * 0.9, far, 0, ...(MESH ? [nx, ny, nz, 0] : [])], f * FI * 4);
  }
  geo.setAttribute("aId", new BufferAttribute(flakeIds, 1));
  // the order flakes fall in: chance (the old per-flake coin) mixed with how much the flake faces down
  const facing = new Float32Array(N);
  for (let f = 0; f < N; f++) facing[f] = 0.5 + 0.5 * (MESH ? bm.flakeNormal[f * 3 + 1] : info[f * FI * 4 + 1]);
  const rankFlakes = () => {
    const key = new Float32Array(N);
    for (let f = 0; f < N; f++) {
      const w = info[f * FI * 4 + 3];
      const coin = (((w * 3.1 + 0.37 * 3.1) % 1) + 1) % 1;
      key[f] = coin + (facing[f] - coin) * look.fallDown;
    }
    const order = Array.from({ length: N }, (_, f) => f).sort((a, b) => key[a] - key[b] || a - b);
    order.forEach((f, k) => (info[f * FI * 4 + 7] = (k + 0.5) / N));
  };
  rankFlakes();
  let rankedFor = look.fallDown;
  const flakeInfo = instancedArray(N * FI, "vec4");
  flakeInfo.value.array.set(info);
  const STRIDE = 5;
  const simState = instancedArray(N * STRIDE, "vec4");
  const simNext = instancedArray(N * STRIDE, "vec4");
  // steps go to the GPU in batches; a counter there says which step of the batch is running
  const simCount = instancedArray(1, "float");
  const simK0 = uniform(0); // step index (round the lap) of the batch's first step
  const simLaps = uniform(3600); // steps per lap
  const simInit = uniform(0); // the batch starts a pre-roll: whatever is loose already counts as gone
  const SIM_HZ = 120;
  const REVS = 2;
  const dt = 1 / SIM_HZ;
  const sim = {
    lift0: 0.0015, // loose flakes slide this far above the paint
    thick: 0.005, // and ride up this much on each one beneath
  };

  // touches are looked up in a box grid round the sphere: cells as wide as the widest pair can reach
  const CELL = 0.19,
    G = Math.ceil(2.3 / CELL),
    CAP = 24;
  const cellCount = instancedArray(G ** 3, "uint").toAtomic();
  const cellCountRead = storage(cellCount.value, "uint", G ** 3).toReadOnly();
  const cellItems = instancedArray(G ** 3 * CAP, "uint");
  const cellOf = (p: any) => ivec3(floor(p.add(1.15).div(CELL)));
  const inGrid = (c: any) => c.x.greaterThanEqual(0).and(c.y.greaterThanEqual(0)).and(c.z.greaterThanEqual(0)).and(c.x.lessThan(G)).and(c.y.lessThan(G)).and(c.z.lessThan(G));
  const cellIndex = (c: any) => uint(c.z.mul(G).add(c.y).mul(G).add(c.x));
  const off = shape.paint - 1; // the paint skin's height over the iron
  // world-frame surface at x, the body turned by th: distance to the iron, and the normal
  const surfD = (x: any, th: any) => (MESH ? sdfObj(turnY(x, th.negate())) : length(x).sub(1));
  const surfN = (x: any, th: any) => (MESH ? turnY(normObj(turnY(x, th.negate())), th) : normalize(x));
  const stepTheta = () =>
    T.mod(simK0.add(simCount.element(0)), simLaps)
      .mul(Math.PI * 2)
      .div(simLaps);
  const onSurface = (X: any) => (MESH ? X.w.lessThan(1.5).and(surfD(X.xyz, stepTheta()).lessThan(off + 0.03)) : X.w.lessThan(1.5).and(length(X.xyz).lessThan(shape.paint + 0.03)));
  const gridClear = Fn(() => {
    atomicStore(cellCount.element(instanceIndex), uint(0));
  })().compute(G ** 3);
  const gridFill = Fn(() => {
    const X = simState.element(instanceIndex.mul(STRIDE));
    const c = cellOf(X.xyz);
    If(onSurface(X).and(inGrid(c)), () => {
      const cell = cellIndex(c);
      const slot = atomicAdd(cellCount.element(cell), uint(1));
      If(slot.lessThan(uint(CAP)), () => {
        cellItems.element(cell.mul(CAP).add(slot)).assign(instanceIndex);
      });
    });
  })().compute(N);
  // atomics fill a cell in whatever order the threads got there; sorted, each step sums its touches in the
  // same order every time, so a run repeats exactly (and the loop closes)
  const gridSort = Fn(() => {
    const base = instanceIndex.mul(CAP);
    const count = min(cellCountRead.element(instanceIndex), uint(CAP));
    Loop({ start: uint(1), end: count, type: "uint", name: "a" }, ({ a }: any) => {
      const key = uint(cellItems.element(base.add(a))).toVar();
      const b = a.toVar();
      Loop(b.greaterThan(uint(0)).and(cellItems.element(base.add(b).sub(1)).greaterThan(key)), () => {
        cellItems.element(base.add(b)).assign(cellItems.element(base.add(b).sub(1)));
        b.subAssign(1);
      });
      cellItems.element(base.add(b)).assign(key);
    });
  })().compute(G ** 3);
  const eachNear = (p: any, body: (j: any) => void) => {
    const c = cellOf(p);
    (Loop as any)({ start: int(-1), end: int(2), type: "int" }, { start: int(-1), end: int(2), type: "int" }, { start: int(-1), end: int(2), type: "int" }, ({ i, j, k }: any) => {
      const cc = c.add(ivec3(i, j, k));
      If(inGrid(cc), () => {
        const cell = cellIndex(cc);
        const count = min(cellCountRead.element(cell), uint(CAP));
        Loop({ start: uint(0), end: count, type: "uint", name: "s" }, ({ s }: any) => {
          body(int(cellItems.element(cell.mul(CAP).add(s))));
        });
      });
    });
  };

  const simStep = Fn(() => {
    const i = int(instanceIndex);
    const at = i.mul(STRIDE);
    const X = simState.element(at);
    const V = simState.element(at.add(1));
    const Q = simState.element(at.add(2));
    const S = simState.element(at.add(3));
    const Tp = simState.element(at.add(4));
    const ci = flakeInfo.element(i.mul(FI));
    const ki = flakeInfo.element(i.mul(FI).add(1));
    const rnd = ci.w;
    const c = simCount.element(0);
    const simTheta = T.mod(simK0.add(c), simLaps)
      .mul(Math.PI * 2)
      .div(simLaps);
    const ft = clock(MESH ? faceDir(ci.xyz, flakeInfo.element(i.mul(FI).add(2)).xyz) : ci.xyz, simTheta)
      .sub(ki.x)
      .sub(fallStartOf(rnd, ki.w))
      .div(ageRate());
    const x = vec3(X.xyz).toVar();
    const mode = float(X.w).toVar();
    const v = vec3(V.xyz).toVar();
    const h = float(V.w).toVar();
    const q = vec4(Q).toVar();
    const s = float(S.x).toVar();
    // tipping: a chip whose leading edge catches pivots up about it (lead: tangent towards that edge, phi: angle)
    const lead = vec3(Tp.xyz).toVar();
    const phi = float(Tp.w).toVar();
    const dphi = float(S.z).toVar();
    const spinY = vec3(0, omega, 0);
    const rc = float(shape.paint);
    const nOf = (p: any) => (MESH ? surfN(p, simTheta) : normalize(p));
    // on the mesh: lay a point back on the skin at height lvl (the sphere does this by its radius)
    const snapTo = (p: any, lvl: any, out: any = null) => {
      const dn = surfD(p, simTheta);
      If(dn.lessThan(lvl), () => {
        const push = surfN(p, simTheta).mul(lvl.sub(dn));
        p.addAssign(push);
        if (out) out.assign(push);
      });
    };

    If(ft.lessThanEqual(0), () => {
      // still on: carried round with the sphere
      x.assign(MESH ? turnY(ci.xyz, simTheta) : turnY(ci.xyz, simTheta).mul(rc));
      v.assign(cross(spinY, x));
      q.assign(qaxis(vec3(0, 1, 0), simTheta));
      mode.assign(0);
      h.assign(0);
      s.assign(0);
      lead.assign(vec3(0));
      phi.assign(0);
      dphi.assign(0);
    })
      .ElseIf(simInit.greaterThan(0.5).and(c.lessThan(0.5)), () => {
        mode.assign(2);
      })
      .ElseIf(mode.lessThan(0.5), () => {
        // lets go: no kick, it keeps only the motion it had riding on the body
        mode.assign(1);
      });

    If(mode.greaterThan(0.5).and(mode.lessThan(1.5)), () => {
      const n = MESH ? nOf(x).toVar() : normalize(x);
      const lvl = float(off + sim.lift0).add(h);
      const height = MESH ? surfD(x, simTheta).sub(lvl) : length(x).sub(rc.add(sim.lift0).add(h));
      const air = smoothstep(0.012, 0.1, height);
      const sway = vec3(sin(ft.mul(randOf(rnd, 2.3).add(1.6)).add(rnd.mul(40))), 0, cos(ft.mul(randOf(rnd, 4.1).add(1.3)).add(rnd.mul(17))));
      // gravity takes over gently as the last of the paint lets go; in the air a light chip soon drifts at a
      // steady speed (g / (drag + airDrag)) instead of picking up speed all the way down
      const letGo = smoothstep(0.0, 0.5, ft);
      v.addAssign(vec3(0, u.gravity.mul(letGo).negate(), 0).add(sway.mul(u.flutter).mul(air)).mul(dt));
      v.mulAssign(exp(u.drag.add(u.airDrag.mul(air)).mul(-dt)));
      If(height.lessThan(0.004), () => {
        const vs = cross(spinY, x);
        const rel = v.sub(vs);
        const rn = n.mul(dot(rel, n));
        // tipped up on an edge it is pinned there
        v.assign(vs.add(rn).add(rel.sub(rn).mul(exp(u.friction.add(smoothstep(0.0, 0.15, phi).mul(12)).mul(-dt)))));
      });
      const xp = x.add(v.mul(dt)).toVar();

      // touches: only between flakes on the surface (loose ones, and cupped ones still on)
      const push = vec3(0).toVar();
      const ride = float(0).toVar();
      const kick = float(0).toVar();
      If(air.lessThan(0.5), () => {
        const ri = ki.y;
        eachNear(xp, (j: any) => {
          const Xj = simState.element(j.mul(STRIDE));
          const d = xp.sub(Xj.xyz);
          const rr = ri.add(flakeInfo.element(j.mul(FI).add(1)).y);
          If(j.notEqual(i).and(dot(d, d).lessThan(rr.mul(rr))), () => {
            const Vj = simState.element(j.mul(STRIDE).add(1));
            const Sj = simState.element(j.mul(STRIDE).add(3));
            const dtan = d.sub(n.mul(dot(d, n)));
            const dl = length(dtan);
            const dir = select(dl.greaterThan(1e-5), dtan.div(max(dl, 1e-5)), normalize(cross(n, vec3(randOf(rnd, 7.7).sub(0.5), 0.3, randOf(rnd, 8.9).sub(0.5)))));
            const overlap = rr.sub(dl);
            const loose = Xj.w.greaterThan(0.5);
            // two loose ones share the push; a flake still on holds and only nudges
            push.addAssign(dir.mul(overlap.mul(select(loose, 0.5, 0.25))));
            // whichever let go first lies underneath: the newcomer rides up over it
            const under = loose
              .not()
              .or(Sj.y.greaterThan(S.y))
              .or(Sj.y.equal(S.y).and(j.lessThan(i)));
            If(under, () => {
              ride.assign(max(ride, Vj.w.add(sim.thick).mul(smoothstep(0.0, rr.mul(0.35), overlap))));
            });
            If(loose, () => {
              kick.addAssign(dot(n, cross(dir, v.sub(Vj.xyz))).mul(smoothstep(0.0, rr.mul(0.2), overlap)));
            });
          });
        });
      });
      // a soft touch, capped, and only partly turned into speed
      const pl = length(push);
      const moved = push.mul(min(pl.mul(u.push), 0.0025).div(max(pl, 1e-7)));
      h.assign(mix(h, ride, 1 - Math.exp(-10 * dt)));
      const xn = xp.add(moved).toVar();
      const floor = rc.add(sim.lift0).add(h);
      // on a body that is not round, a turning arm or shield sweeps into loose chips: the push back out is a
      // position fix, not a launch. The chip only gets the surface's own speed along the normal.
      const snapped = vec3(0).toVar();
      if (MESH) snapTo(xn, lvl, snapped);
      else
        If(length(xn).lessThan(floor), () => {
          xn.assign(normalize(xn).mul(floor));
        });
      v.assign(xn.sub(x).sub(moved.mul(u.bounce.oneMinus())).div(dt));
      if (MESH)
        If(length(snapped).greaterThan(0), () => {
          const nn = normalize(snapped);
          v.subAssign(snapped.div(dt));
          v.addAssign(nn.mul(max(dot(cross(spinY, xn).sub(v), nn), 0)));
        });

      // stumbling: the leading edge catches on a chip in the way, or on a lump of rust; the slide's momentum
      // goes into tipping up about that edge. Gravity lays it back down unless it gets past upright, then it
      // flops over onto its other face. Air on a light flat chip makes all of it slow.
      const rp = ki.z;
      If(air.lessThan(0.5), () => {
        const rel = v.sub(cross(spinY, xn));
        const vt = rel.sub(n.mul(dot(rel, n)));
        const sp = length(vt);
        const go = vt.div(max(sp, 1e-6));
        If(phi.lessThan(0.02).and(sp.greaterThan(0.005)), () => {
          lead.assign(go);
        });
        const blocked = max(dot(push, go).negate(), 0)
          .div(max(pl, 1e-7))
          .mul(smoothstep(0.0, 0.004, pl));
        const edge = turnY(xn.add(lead.mul(rp)), simTheta.negate());
        const lump = smoothstep(0.66, 0.86, mx_noise_float(edge.mul(22)).mul(0.5).add(0.5));
        const caught = min(blocked.add(lump).mul(u.stumble).mul(dt), 1).mul(max(dot(go, lead), 0));
        dphi.addAssign(caught.mul(sp).div(rp.mul(0.6)));
        v.subAssign(vt.mul(caught));
        // tipping about the edge: gravity's torque, and a lot of air drag
        lead.assign(normalize(lead.sub(nOf(xn).mul(dot(lead, nOf(xn)))).add(1e-7)));
        const ny = nOf(xn).y;
        dphi.addAssign(
          u.gravity
            .mul(u.tipWeight)
            .mul(lead.y.mul(sin(phi)).add(ny.mul(cos(phi))))
            .div(rp.mul(0.6))
            .mul(-dt),
        );
        dphi.mulAssign(exp(u.tipDrag.mul(-dt)));
        phi.addAssign(dphi.mul(dt));
        If(phi.lessThan(0), () => {
          phi.assign(0);
          dphi.assign(0);
        });
        // over the top: it lands on its back, one reach further on
        If(phi.greaterThan(Math.PI), () => {
          const axis = normalize(cross(nOf(xn), lead));
          q.assign(qmul(qaxis(axis, float(Math.PI)), q));
          xn.addAssign(lead.mul(rp.mul(2)));
          if (MESH) snapTo(xn, lvl);
          else xn.assign(normalize(xn).mul(floor));
          phi.assign(0);
          dphi.assign(0);
        });
      }).Else(() => {
        // knocked off the surface mid-tip: keep the pose, carry on as a free body
        If(phi.greaterThan(0), () => {
          const axis = normalize(cross(nOf(x), lead));
          const pivot = x.add(lead.mul(rp));
          xn.assign(pivot.add(rodrigues(xn.sub(pivot), axis, phi)));
          q.assign(qmul(qaxis(axis, phi), q));
          phi.assign(0);
          dphi.assign(0);
        });
      });

      // orientation: while on the surface it turns with its slide, so it stays lying on it; once clear it tumbles
      const n1 = MESH ? nOf(xn).toVar() : normalize(xn);
      const ax = cross(n, n1);
      const al = length(ax);
      const slideTurn = qaxis(ax.div(max(al, 1e-9)), atan(al, dot(n, n1)).mul(air.oneMinus()));
      q.assign(qmul(slideTurn, q));
      lead.assign(qrot(slideTurn, lead));
      s.assign(clamp(s.add(kick.mul(u.spin).mul(dt)), -1.2, 1.2).mul(exp(mix(float(-3), float(-0.3), air).mul(dt))));
      q.assign(qmul(qaxis(n1, s.mul(dt)), q));
      const tumbleAxis = normalize(vec3(sin(rnd.mul(91.3)), cos(rnd.mul(53.1)), sin(rnd.mul(27.7).add(1))));
      q.assign(qmul(qaxis(tumbleAxis, randOf(rnd, 7.3).mul(1.2).add(0.4).mul(air).mul(dt)), q));
      // touching down, a chip settles flat (on whichever face it lands)
      const fnorm = qrot(q, MESH ? flakeInfo.element(i.mul(FI).add(2)).xyz : ci.xyz);
      const want = n1.mul(select(dot(fnorm, n1).lessThan(0), float(-1), float(1)));
      const tilt = cross(fnorm, want);
      const tl = length(tilt);
      const landed = smoothstep(0.02, 0.003, MESH ? surfD(xn, simTheta).sub(lvl) : length(xn).sub(floor));
      q.assign(
        qmul(
          qaxis(
            tilt.div(max(tl, 1e-9)),
            atan(tl, dot(fnorm, want))
              .mul(landed)
              .mul(1 - Math.exp(-5 * dt)),
          ),
          q,
        ),
      );
      q.assign(normalize(q));
      x.assign(xn);
    });

    simNext.element(at).assign(vec4(x, mode));
    simNext.element(at.add(1)).assign(vec4(v, h));
    simNext.element(at.add(2)).assign(q);
    simNext.element(at.add(3)).assign(vec4(s, ft, dphi, 0));
    simNext.element(at.add(4)).assign(vec4(lead, phi));
  })().compute(N);
  const simCopy = Fn(() => {
    simState.element(instanceIndex).assign(simNext.element(instanceIndex));
    If(instanceIndex.equal(0), () => {
      simCount.element(0).addAssign(1);
    });
  })().compute(N * STRIDE);
  const simZero = Fn(() => {
    simCount.element(0).assign(0);
  })().compute(1);

  const paint = new MeshPhysicalNodeMaterial({ side: DoubleSide });
  paint.positionNode = Fn(() => {
    const rest = positionGeometry;
    const n = MESH ? normalGeometry : normalize(rest);
    const age = flakeAge();
    // the peel front sweeps across the flake from Lmin to past Lmax
    const t = smoothstep(u.peel0, u.peel1, age);
    // it stops short of the middle: the edges cup and scroll, the middle holds until the flake lets go
    const reach = rand(5.9).mul(0.3).add(0.45);
    const w = mix(aFlake.y, mix(aFlake.y, aFlake.z, reach), t);
    const gl = aLift.xyz;
    const glen = max(length(gl), 0.25);
    const gh = gl.div(glen);
    const along = max(w.sub(aLift.w), 0).div(glen);
    const R = aFlake.w;
    const th = along.div(R);
    const r = R.div(th.mul(0.16).add(1));
    const x = r.mul(sin(th));
    const y = R.sub(r.mul(cos(th)));
    // the blister lift before it lets go
    const blister = smoothstep(u.blister0, u.blister1, age).mul(t.oneMinus());
    // the cell noise is costly per vertex: only flakes that are blistering now pay for it
    const bump = float(0).toVar();
    If(blister.greaterThan(0), () => {
      const puff = mx_worley_noise_float((MESH ? rest : n).mul(70)).oneMinus();
      bump.assign(smoothstep(0.55, 0.95, puff).mul(blister).mul(0.004));
    });
    const p = rest
      .add(gh.mul(along.sub(x)))
      .add(n.mul(y.add(bump)))
      .toVar();
    const nn = normalize(n.mul(cos(th)).add(gh.mul(sin(th)))).toVar();
    // loose: placed by the sim (world frame), brought back into the turning sphere's frame
    If(fallTime().greaterThan(0), () => {
      const at = int(aId).mul(STRIDE);
      const X = simState.element(at);
      const q = simState.element(at.add(2));
      const tip = simState.element(at.add(4));
      If(X.w.greaterThan(0.5).and(X.w.lessThan(1.5)), () => {
        const world = qrot(q, p.sub(aSeed.xyz.mul(CS)))
          .add(X.xyz)
          .toVar();
        const nw = qrot(q, nn).toVar();
        // tipped up about its leading edge
        If(tip.w.greaterThan(0), () => {
          const axis = normalize(cross(MESH ? surfN(X.xyz, theta) : normalize(X.xyz), tip.xyz));
          const pivot = X.xyz.add(tip.xyz.mul(flakeInfo.element(int(aId).mul(FI).add(1)).z));
          world.assign(pivot.add(rodrigues(world.sub(pivot), axis, tip.w)));
          nw.assign(rodrigues(nw, axis, tip.w));
        });
        p.assign(turnY(world, theta.negate()));
        nn.assign(turnY(nw, theta.negate()));
      });
      // gone: fold away
      If(X.w.greaterThan(1.5), () => {
        p.assign(vec3(0));
      });
    });
    normalLocal.assign(nn);
    return p;
  })();
  {
    const p = MESH ? positionGeometry : normalize(positionGeometry);
    const f = MESH ? attribute("aField", "vec2") : texture(field, uvOf(p));
    const local = clock(MESH ? faceDir(p, normalGeometry) : p).sub(f.r);
    const age = flakeAge();
    // cracks open unevenly along their length: some edges gape, some stay joined a while
    const taper = smoothstep(0.25, 0.75, mx_noise_float(p.mul(38)).mul(0.5).add(0.5));
    // closed, neighbours overlap a little: the cut is a linear guess at a min of planes, so it errs inwards
    const crack = mix(float(MESH ? -0.0025 : -0.0015), u.crackWidth.mul(taper.mul(0.8).add(0.2)), smoothstep(u.crack0, u.crack1, age.sub(taper.oneMinus().mul(0.25))));
    const kept = aCut.greaterThan(crack);
    paint.maskNode = kept; // three uses it for the shadow pass too

    // veins of rust showing through, a yellowing halo round where corrosion has started
    const vein = f.g.mul(smoothstep(0.0, 0.18, local));
    const halo = smoothstep(-0.15, 0.5, local);
    const grime = mx_fractal_noise_float(p.mul(40), 3, 2, 0.5).mul(0.5).add(0.5);
    const edge = smoothstep(0.012, 0.0, aCut.sub(crack)).mul(smoothstep(u.crack0, u.crack1, age));
    let c = mix(u.enamel, u.enamel.mul(vec3(0.93, 0.86, 0.72)), halo.mul(0.55).mul(grime.mul(0.6).add(0.4)));
    c = mix(c, u.stain, vein.mul(0.85));
    c = mix(c, u.stain.mul(0.8), edge.mul(0.75));
    // the underside: chalky, stained by the rust it came off
    const blot = smoothstep(0.3, 0.7, mx_noise_float(p.mul(55)).mul(0.5).add(0.5));
    const under = mix(u.under, u.rust, blot.mul(0.6).add(0.2));
    paint.colorNode = select(frontFacing, c, under);
    // relief: veins raise the film, blisters swell
    const blister = smoothstep(u.blister0, u.blister1, age);
    const puff = smoothstep(0.55, 0.95, mx_worley_noise_float(p.mul(70)).oneMinus()).mul(blister);
    const orange = mx_noise_float(p.mul(150)).mul(0.04);
    const relief = vein.mul(0.6).add(puff.mul(0.7)).add(orange);
    paint.normalNode = bumpMap(relief.mul(0.0012), float(1));
    const chalk = smoothstep(0.0, 0.9, local);
    paint.roughnessNode = select(frontFacing, mix(float(0.18), float(0.5), chalk), float(0.85));
    paint.clearcoatNode = select(frontFacing, mix(float(1), float(0.15), chalk), float(0));
    paint.clearcoatRoughnessNode = mix(float(0.05), float(0.3), chalk);
  }
  const skin = new Mesh(geo, paint);
  skin.castShadow = true;
  skin.receiveShadow = true;
  skin.frustumCulled = false;
  // drawn before the iron: wherever the paint is still on, the iron's costly noise is then skipped by the depth test
  skin.renderOrder = -1;
  scene.add(skin);

  // ---- panel
  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;left:0;bottom:0;opacity:0.9;z-index:10000";
  document.body.appendChild(stats.dom);
  // which body: buttons top left; each is baked on load, so a switch reloads the page with ?body=
  const nav = document.createElement("div");
  nav.id = "bodies";
  for (const b of BODIES) {
    const button = document.createElement("button");
    button.textContent = b;
    if (b === BODY) button.className = "on";
    button.onclick = () => {
      if (b === BODY) return;
      const url = new URL(location.href);
      if (b === BODIES[0]) url.searchParams.delete("body");
      else url.searchParams.set("body", b);
      location.href = url.toString();
    };
    nav.appendChild(button);
  }
  document.body.appendChild(nav);
  const refresh = () => {
    span.value = look.span;
    u.blister0.value = look.blisterAt[0];
    u.blister1.value = look.blisterAt[1];
    u.crack0.value = look.crackAt[0];
    u.crack1.value = look.crackAt[1];
    u.crackWidth.value = look.crackWidth;
    u.peel0.value = look.peelAt[0];
    u.peel1.value = look.peelAt[1];
    u.fallAt.value = look.fallAt;
    u.fallSpread.value = look.fallSpread;
    u.fallShare.value = look.fallShare;
    u.gravity.value = look.gravity;
    for (const k of ["drag", "airDrag", "friction", "push", "bounce", "spin", "flutter", "stumble", "tipWeight", "tipDrag"] as const) u[k].value = look[k];
    for (const k of ["enamel", "stain", "rust", "rustDeep", "rustBright", "under"] as const) u[k].value.set(look[k]);
    bg.value.set(look.background);
    placeKey();
    if (look.fallDown !== rankedFor) {
      rankedFor = look.fallDown;
      rankFlakes();
      flakeInfo.value.array.set(info);
      flakeInfo.value.needsUpdate = true;
    }
  };
  const gui = new GUI({ title: "rust" });
  gui.close();
  const fa = gui.addFolder("ageing");
  fa.add(look, "span", 0.8, 3, 0.01).onChange(refresh);
  fa.add(look, "crackWidth", 0, 0.006, 0.0001).onChange(refresh);
  fa.add(look, "fallShare", 0, 1, 0.01).onChange(refresh);
  fa.add(look, "fallDown", 0, 1, 0.01).onChange(refresh);
  fa.add(look, "gravity", 0.05, 2, 0.01).onChange(refresh);
  const ff = gui.addFolder("flakes");
  ff.add(look, "drag", 0, 3, 0.01).onChange(refresh);
  ff.add(look, "airDrag", 0, 5, 0.01).onChange(refresh);
  ff.add(look, "friction", 0, 4, 0.01).onChange(refresh);
  ff.add(look, "push", 0, 1, 0.01).onChange(refresh);
  ff.add(look, "bounce", 0, 1, 0.01).onChange(refresh);
  ff.add(look, "spin", 0, 30, 0.1).onChange(refresh);
  ff.add(look, "flutter", 0, 2, 0.01).onChange(refresh);
  ff.add(look, "stumble", 0, 20, 0.1).onChange(refresh);
  ff.add(look, "tipWeight", 0, 2, 0.01).onChange(refresh);
  ff.add(look, "tipDrag", 0, 10, 0.1).onChange(refresh);
  const fc = gui.addFolder("colour");
  for (const k of ["enamel", "stain", "rust", "rustDeep", "rustBright", "under", "background"] as const) fc.addColor(look, k).onChange(refresh);
  const fl = gui.addFolder("light");
  fl.add(look, "keyAzimuth", -180, 180, 1).onChange(refresh);
  fl.add(look, "keyElevation", -30, 80, 1).onChange(refresh);
  fl.add(look, "key", 0, 10, 0.05).onChange(refresh);
  fl.add(look, "kickAzimuth", -180, 180, 1).onChange(refresh);
  fl.add(look, "kickElevation", -30, 80, 1).onChange(refresh);
  fl.add(look, "kick", 0, 5, 0.05).onChange(refresh);
  fl.add(look, "fill", 0, 2, 0.01).onChange(refresh);
  fl.add(look, "env", 0, 2, 0.01).onChange(refresh);
  fl.add(look, "exposure", 0.2, 3, 0.01).onChange(refresh);

  const state = { hold: -1, frame: 0, pause: false, exact: false };
  Object.assign(window, { __rust: { flakeInfoArray: info, look, state, refresh, sim, simState, camera, controls, renderer, scene, baked, iron, skin, paint, metal, key } });

  // the sim steps at fixed times k / SIM_HZ round the loop, so playback, holds and exports all see the same
  // flakes; after a jump it re-runs a whole lap first (what is loose at the start of it is dropped)
  let simK = -1;
  let simDirty = true;
  const BATCH = 60;
  const batches = new Map<number, unknown[]>();
  // n steps starting at step k
  const runSim = (k: number, n: number, laps: number, init = false) => {
    for (let done = 0; done < n; done += BATCH) {
      const m = Math.min(BATCH, n - done);
      if (!batches.has(m)) batches.set(m, [simZero, ...Array.from({ length: m }, () => [gridClear, gridFill, gridSort, simStep, simCopy]).flat()]);
      simK0.value = (((k + done) % laps) + laps) % laps;
      simLaps.value = laps;
      simInit.value = init && done === 0 ? 1 : 0;
      renderer.compute(batches.get(m) as never);
    }
  };
  // the loop is REVS turns of the sphere: the flakes settle into a cycle exactly two turns long (they jostle
  // one way one turn, the other way the next), reached from any start within about four turns
  let simLoop = -1;
  let simExact = false;
  const advance = (target: number, rev: number, loop: number, settle: number) => {
    const gap = (((target - simK) % loop) + loop) % loop;
    // a slow frame only leaves a small gap: run the missing steps. Re-settling then (a whole turn of steps) made
    // the next gap bigger still, and a body with a costly step (the meshes) never got out of it: 4 fps.
    // Only a real jump (scrubbing back, a long tab switch) is worth starting over for.
    if (simDirty || simK < 0 || loop !== simLoop || gap > rev / 2) {
      runSim(target - settle * rev, settle * rev + 1, rev, true);
      simDirty = false;
      simLoop = loop;
    } else if (gap > 0) runSim(simK + 1, gap, rev);
    simK = target;
  };
  const resim = () => (simDirty = true);
  for (const c of [...fa.controllers, ...ff.controllers]) c.onFinishChange(resim);
  // __rust.simBench(n): [cpu ms, wall ms with the GPU] for n steps
  const simBench = async (n: number): Promise<number[]> => {
    const device = (renderer.backend as unknown as { device: GPUDevice }).device;
    await device.queue.onSubmittedWorkDone();
    const t0 = performance.now();
    runSim(simK + 1, n, Math.round(SIM_HZ * 30));
    const cpu = performance.now() - t0;
    await device.queue.onSubmittedWorkDone();
    return [cpu, performance.now() - t0];
  };
  Object.assign((window as any).__rust, { resim, simBench });

  wrap.render = ({ playhead, duration, recording }) => {
    if (state.pause) return;
    const turn = duration / 1000 / REVS; // seconds per turn
    const rev = Math.round(turn * SIM_HZ);
    const loop = rev * REVS;
    if ((recording || state.exact) !== simExact) ((simExact = recording || state.exact), (simDirty = true));
    const ph = state.hold >= 0 ? state.hold : playhead;
    const target = Math.round(ph * loop) % loop;
    omega.value = (Math.PI * 2) / turn;
    // on the page a short settle looks the same; a recording waits for the exact cycle
    advance(target, rev, loop, recording || state.exact ? 6 : 1);
    const th = ((target % rev) / rev) * Math.PI * 2;
    theta.value = th;
    iron.rotation.y = th;
    skin.rotation.y = th;
    controls.update();
    stats.update();
    renderer.render(scene, camera);
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  wrap.unload = () => {
    nav.remove();
    renderer.dispose();
    gui.destroy();
    stats.dom.remove();
  };
};

// Chromium with unsafe-webgpu off chokes on three's `v.xy.x` in physical lighting (see day 4)
function flattenSwizzles(renderer: WebGPURenderer) {
  const { device } = renderer.backend as unknown as { device?: GPUDevice };
  if (!device) return;
  const create = device.createShaderModule.bind(device);
  const flat = (_: string, first: string, second: string) => `.${first["xyzw".indexOf(second)]}`;
  device.createShaderModule = (descriptor) => create({ ...descriptor, code: descriptor.code.replace(/\.([xyzw]{2,4})\.([xyzw])\b/g, flat) });
}

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 60_000, // REVS turns
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
