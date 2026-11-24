// 8. A factory of mirrors (a tribute to arc4g). Square rose-gold cloths, each held taut in a frame, ride a
//    conveyor past a pendulum. The ball swings through the mirror in the station, the frame lets go, and the ball
//    carries the cloth off wrapped round it; at the top of the swing the ball turns back and leaves the cloth to
//    fall away, while the conveyor brings the next frame in with a mechanical shove. The ball comes back through
//    the new mirror from the other side, and so on for ever.
//
//    Real cloth on the GPU (wrap.wgsl), and an exact loop: every cloth starts from the same settled sheet and
//    meets the same swing (every other one turned round), so every cloth lives the same life; one swing there and
//    back is the loop. Three cloths are alive at once (the one being taken, two falling away); the waiting ones
//    are the settled sheet, drawn still.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import {
  attribute,
  cameraPosition,
  cameraViewMatrix,
  float,
  Fn,
  fog,
  ivec2,
  mix,
  max,
  min,
  modelWorldMatrix,
  mrt,
  normalize,
  normalLocal,
  normalView,
  pmremTexture,
  positionLocal,
  positionWorld,
  rangeFogFactor,
  reflectVector,
  roughness,
  metalness,
  specularColorBlended,
  smoothstep,
  textureLoad,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  FloatType,
  FrontSide,
  Group,
  Mesh,
  MeshBasicNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  NearestFilter,
  Path,
  PlaneGeometry,
  RGBAFormat,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  StorageTexture,
  Vector2,
  Vector3,
  Vector4,
  VSMShadowMap,
} from "three/webgpu";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { reflectance, screenLook, screenSpace } from "./screen-space.ts";
import { blackSteel, chrome, createStage, studioLook } from "./stage.ts";
import { cloth, WrapSim } from "./wrap-sim.ts";

const query = new URLSearchParams(location.search);
// three's GPU timestamps, read back every frame for the readout, cost frames at 60 Hz (and read wrong): ?gputime=1
const gpuTime = query.get("gputime") === "1";
// the sheet: 224 particles a side (256 costs 0.8 ms a frame more and looks the same; ?n= for others, a multiple
// of 4); the layers keep about one spacing apart, as they did at 256
cloth.n = Number(query.get("n") ?? 224);
cloth.thick = (0.008 * 255) / (cloth.n - 1);
const withPost = query.get("post") !== "0"; // ?post=0: the plain picture, no screen-space passes

const look = {
  ...studioLook,
  ...screenLook,
  grade: 1, // a gentle S curve, a touch more colour, cool darks and warm lights (see stage.ts)
  speed: 0.25, // simulated seconds per second: slow motion
  // the pendulum
  length: 2.5, // pivot above the ball's lowest point, m
  amp: 41, // degrees each way
  ballR: Number(query.get("ball") ?? 0.16), // the ball's radius, m (?ball=0.4 for a big one)
  rodR: 0.005, // a cord
  // the conveyor
  pitch: 3.1, // frame to frame, m
  // the frames wobble on their carriages as the line moves them (wiggle bones: the carriage is driven, the
  // rest lags on springs), and calm as the ball comes, so the slot in the top bar is still for the cord
  wobble: 1.5, // how much (scales the angles the springs give)
  wobbleHz: 6, // each bone's spring (in simulated time: a quarter of that on screen, ~1.25 Hz)
  flex: 0.8, // how much the upper bone (the frame's top half) bends on the lower
  wobbleDamp: 0.15, // damping ratio of the springs (the lower bone's: the sway)
  calm: 0.15, // s before the cloth wakes over which what is left fades out
  moveAfter: 0.45, // s after a hit, the line starts to index
  moveFor: 0.75, // s
  overshoot: 0.004, // of the pitch: the clunk at the end of each move
  // each cloth's life, from its hit (s): what is simulated, and how well
  wake: 0.1, // before the hit it is the settled sheet, drawn still; it wakes as the ball comes (sooner for a big one)
  farAfter: 1.5, // the ball long gone, it falls: one sweep, neighbour lists less often
  retireAfter: 3.3, // out of sight below: no longer simulated or drawn
  // substeps between self-collision's neighbour lists while the ball is in the cloth (rebuilding them is most of
  // self-collision's cost: 8 saves ~1.3 ms a frame over 4 and looks the same; ?lists=4 for the old)
  listNear: Number(query.get("lists") ?? 8),
  listFar: 8, // and once it falls
  // the cloth (see wrap-sim.ts)
  density: cloth.density,
  grip: 90,
  gripSpread: cloth.gripSpread,
  give: cloth.give,
  tension: 9,
  air: cloth.air,
  bend: cloth.bend,
  gravity: 3, // a light, slow world (real gravity drags the cloth straight off the ball); still enough that a
  // shed cloth drops out of sight before its slot is needed again
  friction: 0.3, // low enough that the ball, turning back, leaves the cloth behind (0.9 drags it back along)
  self: cloth.self,
  // the look
  clothColor: "#f4b399",
  clothRough: 0.06,
  hollowTint: 3,
  thickness: 0.006, // drawn
  frameColor: "#bfbfbf",
  ballColor: "#e9e9ee",
  ballRough: 0.04,
  back: "#bdc8d4",
  backEdge: "#9eafc0",
  exposure: 1,
  envLight: 1.0,
  key: 3.4,
  keyAzimuth: -40,
  keyElevation: 50,
  bloom: 0.1,
  bloomThreshold: 1.3,
  floorColor: "#c6ced8",
  floorShine: 0.12, // how much the floor reflects what stands on it
  rim: 1.4,
  hazeNear: 16,
  hazeFar: 48,
  pool: 0.5, // the floor darkens this much away from the light's pool round the machine
  poolSize: 9,
  keySize: 5, // the key's shadow covers this far round the station
  targetX: -0.3,
  targetY: -0.8,
  targetZ: 0,
  vignette: 0.3,
  film: 0.01,
  yaw: 132.78, // the user's view (taken with C): from higher, so no mirror shows another's empty frame
  pitchView: 22.5,
  distance: 8.691,
  fov: 27,
};

const storageTexture = (n: number) => {
  const t = new StorageTexture(n, n);
  t.format = RGBAFormat;
  t.type = FloatType;
  t.minFilter = t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
};

// ---- the pendulum: exact (not small-angle), one quarter swing integrated, the rest by symmetry
function makePendulum(length: number, ampDeg: number, g = 9.81) {
  const a0 = (ampDeg * Math.PI) / 180;
  const f = (th: number) => -(g / length) * Math.sin(th);
  const rk = (th: number, w: number, h: number) => {
    const k1t = w, k1w = f(th);
    const k2t = w + (h / 2) * k1w, k2w = f(th + (h / 2) * k1t);
    const k3t = w + (h / 2) * k2w, k3w = f(th + (h / 2) * k2t);
    const k4t = w + h * k3w, k4w = f(th + h * k3t);
    return [th + (h / 6) * (k1t + 2 * k2t + 2 * k3t + k4t), w + (h / 6) * (k1w + 2 * k2w + 2 * k3w + k4w)];
  };
  // the quarter: from the top of the swing to the bottom
  let th = a0, w = 0, t = 0;
  const h0 = 1e-4;
  for (;;) {
    const [t1, w1] = rk(th, w, h0);
    if (t1 <= 0) {
      t += (h0 * th) / (th - t1);
      break;
    }
    th = t1;
    w = w1;
    t += h0;
  }
  const Q = t;
  const M = 4096;
  const tab = new Float64Array(M + 1);
  th = a0;
  w = 0;
  tab[0] = a0;
  for (let i = 1; i <= M; i++) {
    [th, w] = rk(th, w, Q / M);
    tab[i] = th;
  }
  tab[M] = 0;
  const at = (u: number) => {
    const x = (u / Q) * M;
    const i = Math.min(M - 1, Math.floor(x));
    return tab[i] + (tab[i + 1] - tab[i]) * (x - i);
  };
  const T = 4 * Q;
  const theta = (time: number) => {
    const u = ((time % T) + T) % T;
    if (u < Q) return at(u);
    if (u < 2 * Q) return -at(2 * Q - u);
    if (u < 3 * Q) return -at(u - 2 * Q);
    return at(4 * Q - u);
  };
  return { Q, T, theta, length };
}

type Tex = { pos: StorageTexture; nor: StorageTexture };

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "veil", look, room: "cyc", timestamps: gpuTime });
  const { scene, camera, controls, renderer } = st;
  st.floor.visible = false;
  // soft shadows, as under a big source (variance shadow maps blur evenly; the occlusion pass gives contact)
  if (query.get("shadows") !== "pcf") renderer.shadowMap.type = VSMShadowMap;
  st.key.castShadow = true;
  // (the blur runs over the whole map every frame: 2048 is a quarter of 4096's work, ~2.5 ms less a frame; the radius
  // is in texels, so half of 4096's 6 keeps the same softness; ?shadowmap=4096 for the old one)
  const shadowMap = Number(query.get("shadowmap") ?? 2048);
  st.key.shadow.mapSize.set(shadowMap, shadowMap);
  st.key.shadow.radius = (6 * shadowMap) / 4096;
  st.aimKey(look.keySize, { x: 0, y: -1, z: 0 });

  const N = cloth.n;
  const backend = renderer.backend as unknown as { device?: GPUDevice; get(t: unknown): { texture: GPUTexture } };
  if (!backend.device) throw new Error("the cloth needs WebGPU");
  const device = backend.device;
  const texPair = (): Tex => {
    const p = storageTexture(N), n = storageTexture(N);
    renderer.initTexture(p);
    renderer.initTexture(n);
    return { pos: p, nor: n };
  };
  // three live cloths (the one being taken, two falling away), and the settled sheet every cloth starts
  // from (drawn still in the waiting frames)
  const LIVE = 3;
  const texs = Array.from({ length: LIVE + 1 }, texPair);
  const sims = texs.map((t) => new WrapSim(device, cloth, backend.get(t.pos).texture, backend.get(t.nor).texture));
  const rest = sims[LIVE];

  // ---- materials: the cloth reads its sim's textures; local to its group, which may be turned round
  const U = {
    thick: uniform(look.thickness),
    color: uniform(new Vector3()),
    hollow: uniform(look.hollowTint),
    ballAt: uniform(new Vector3()),
    ballR: uniform(look.ballR),
    ballColor: uniform(new Vector3()),
    ballRough: uniform(look.ballRough),
    pivot: uniform(new Vector3(0, look.length, 0)),
    cordR: uniform(look.rodR),
    env: uniform(look.envLight),
  };
  const env = scene.environment!;
  const ballSeen = () => {
    // the ball in the mirror, traced: where the reflected ray meets it, the polished ball's own reflection
    const rd = reflectVector.normalize();
    const oc = positionWorld.sub(U.ballAt);
    const b = oc.dot(rd);
    const disc = b.mul(b).sub(oc.dot(oc)).add(U.ballR.mul(U.ballR));
    const t = b.negate().sub(max(disc, 0).sqrt());
    const nb = oc.add(rd.mul(t)).normalize();
    const hit = smoothstep(0, 0.0004, disc).mul(smoothstep(0, 0.01, t));
    const seen = pmremTexture(env, rd.reflect(nb), U.ballRough).mul(U.env).mul(U.ballColor);
    // and the cord, from the pivot down to the ball: where the ray passes within its radius (widened to the
    // pixel the ray has spread to by then, so the line stays unbroken), dark steel
    const D = U.ballAt.sub(U.pivot);
    const L = D.length();
    const Dn = D.div(L);
    const w0 = positionWorld.sub(U.pivot);
    const bb = rd.dot(Dn), dd = rd.dot(w0), ee = Dn.dot(w0);
    const den = max(float(1).sub(bb.mul(bb)), 1e-5);
    const tc = bb.mul(ee).sub(dd).div(den);
    const sc = ee.sub(bb.mul(dd)).div(den).clamp(0, L);
    const gap = positionWorld.add(rd.mul(tc)).sub(U.pivot.add(Dn.mul(sc))).length();
    const width = max(U.cordR, tc.mul(0.0012));
    const fadeIn = smoothstep(U.pivot.y.sub(0.05), U.pivot.y.sub(0.9), U.pivot.y.add(Dn.y.mul(sc)));
    const cord = smoothstep(width.mul(1.6), width.mul(0.6), gap).mul(smoothstep(0, 0.01, tc)).mul(fadeIn).mul(hit.oneMinus());
    return { hit, seen, cord };
  };
  const pitTop = uniform(0);
  const pit = float(1).sub(smoothstep(pitTop.add(0.1), pitTop.sub(1.6), positionWorld.y).mul(0.97));
  const cellOf = () => ivec2(attribute("cell", "vec2"));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toWorld = (n: any) => normalize(modelWorldMatrix.mul(vec4(n, 0)).xyz);
  // a frame's wobble, in its own plane (x-y, y up): x rocks the whole frame about the top of its carriage, y
  // flexes the frame from its stem up (both angles at the top, rad). Each mesh says how its frame stands
  // (userData.bend), so one material serves all the frames, and the still cloth in a frame bends with it
  const frameTop = cloth.size / 2 - 0.01 + 0.035, carriageTop = -frameTop - 0.32 + 0.09;
  const noBend = new Vector4();
  const bendU = uniform(new Vector4()).onObjectUpdate(({ object }) => (object?.userData.bend as Vector4 | undefined) ?? noBend);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bendAt = (y: any): { c: any; s: any; lean: any } => {
    const span = 2 * frameTop;
    const u = y.add(frameTop).div(span).clamp(0, 1);
    const above = y.greaterThan(carriageTop).select(1, 0);
    const phi = bendU.x.mul(above).add(bendU.y.mul(u)); // how far the frame leans at this height
    const lean = bendU.x.mul(y.sub(carriageTop).max(0)).add(bendU.y.mul(u.mul(u)).mul(span / 2)); // and how far over
    return { c: phi.cos(), s: phi.sin(), lean };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bent = (p: any, y: any = p.y) => {
    const b = bendAt(y);
    return vec3(b.lean.add(p.x.mul(b.c)), p.y.sub(p.x.mul(b.s)), p.z);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const turned = (n: any, y: any) => {
    const b = bendAt(y);
    return vec3(n.x.mul(b.c).add(n.y.mul(b.s)), n.y.mul(b.c).sub(n.x.mul(b.s)), n.z);
  };
  const shell = (sign: 1 | -1, tex: Tex) => {
    const m = new MeshStandardNodeMaterial({ side: sign > 0 ? FrontSide : BackSide });
    m.metalness = 1;
    const P = textureLoad(tex.pos, cellOf()).xyz;
    const T = textureLoad(tex.nor, cellOf());
    m.positionNode = bent(P.add(T.xyz.mul(U.thick.mul(0.5 * sign))), P.y);
    const nw = varying(toWorld(turned(T.xyz.mul(sign), P.y)), "vClothNormal");
    const hollow = varying(T.w.mul(sign), "vClothHollow");
    // a smooth normal on a grazing fold can turn from the eye: keep it facing us
    const V = normalize(cameraPosition.sub(positionWorld));
    const n0 = normalize(nw);
    const n = normalize(n0.add(V.mul(max(n0.dot(V).negate().add(0.05), 0))));
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(n, 0)).xyz);
    // a fold turned in on itself sees mostly the cloth: its colour, deeper and darker
    const cav = max(hollow, 0).mul(U.hollow);
    const base = U.color.pow(float(1).add(cav)).div(float(1).add(cav.mul(0.25)));
    const { hit, seen, cord } = ballSeen();
    m.colorNode = base.mul(hit.oneMinus()).mul(cord.mul(0.95).oneMinus());
    // no rays traced from the cloth (on its fine folds they break up); it shows the room, the traced ball and
    // cord, and the occlusion's copper-in-copper colour
    // the occlusion fades out over the sheet's border: there the frame's lip, a step 2.5 cm proud of the
    // cloth, made a thin line the occlusion (a quarter of the picture's size) broke into dashes. By where on the
    // sheet, not by whether it is still in its frame, so nothing changes as a waiting cloth wakes
    const cl = attribute("cell", "vec2");
    const fromEdge = min(min(cl.x, cl.y), min(float(N - 1).sub(cl.x), float(N - 1).sub(cl.y))).mul(cloth.size / (N - 1));
    const takesAO = varying(smoothstep(0.03, 0.12, fromEdge), "vClothTakesAO");
    if (withPost) m.mrtNode = mrt({ refl: reflectance(base, roughness, 1, false), normal: vec4(normalView, takesAO) });
    m.emissiveNode = base.mul(seen).mul(hit).mul(pit);
    // down a shaft, the room's light can't reach it
    m.aoNode = pit;
    return m;
  };
  const rimMaterial = (tex: Tex) => {
    const m = new MeshStandardNodeMaterial({ side: DoubleSide });
    m.metalness = 1;
    const c = cellOf();
    const P = textureLoad(tex.pos, c).xyz;
    const T = textureLoad(tex.nor, c);
    const Pi = textureLoad(tex.pos, c.add(ivec2(attribute("inward", "vec2")))).xyz;
    m.positionNode = bent(P.add(T.xyz.mul(U.thick.mul(0.5).mul(attribute("side", "float")))), P.y);
    const out = P.sub(Pi);
    const ow = varying(toWorld(turned(normalize(out.sub(T.xyz.mul(out.dot(T.xyz))).add(T.xyz.mul(1e-4))), P.y)), "vRimNormal");
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(normalize(ow), 0)).xyz);
    m.colorNode = U.color;
    m.aoNode = pit;
    if (withPost) m.mrtNode = mrt({ refl: reflectance(U.color, roughness, 1, false), normal: vec4(normalView, 0) });
    return m;
  };

  // ---- the cloth's geometry: a grid, and a strip round its border for the edge's thickness
  const grid = new BufferGeometry();
  {
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
  }
  const rimGeo = new BufferGeometry();
  {
    const ring: [number, number, number, number][] = [];
    for (let x = 0; x < N; x++) ring.push([x, 0, 0, 1]);
    for (let y = 1; y < N; y++) ring.push([N - 1, y, -1, 0]);
    for (let x = N - 2; x >= 0; x--) ring.push([x, N - 1, 0, -1]);
    for (let y = N - 2; y >= 0; y--) ring.push([0, y, 1, 0]);
    const rc = new Float32Array(ring.length * 4), ri = new Float32Array(ring.length * 4), rs = new Float32Array(ring.length * 2);
    ring.forEach(([x, y, ix, iy], k) => {
      for (const s of [0, 1]) {
        rc.set([x, y], (2 * k + s) * 2);
        ri.set([ix, iy], (2 * k + s) * 2);
        rs[2 * k + s] = s ? 1 : -1;
      }
    });
    const idx: number[] = [];
    for (let k = 0; k < ring.length; k++) {
      const a = 2 * k, b = 2 * ((k + 1) % ring.length);
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    rimGeo.setAttribute("position", new BufferAttribute(new Float32Array(ring.length * 6), 3));
    rimGeo.setAttribute("cell", new BufferAttribute(rc, 2));
    rimGeo.setAttribute("inward", new BufferAttribute(ri, 2));
    rimGeo.setAttribute("side", new BufferAttribute(rs, 1));
    rimGeo.setIndex(idx);
  }
  const shellMats: MeshStandardNodeMaterial[] = [];
  const clothGroup = (tex: Tex) => {
    const g = new Group();
    const mats = [shell(1, tex), shell(-1, tex), rimMaterial(tex)];
    shellMats.push(...mats);
    g.add(new Mesh(grid, mats[0]), new Mesh(grid, mats[1]), new Mesh(rimGeo, mats[2]));
    for (const m of g.children) {
      m.frustumCulled = false;
      m.castShadow = true;
    }
    scene.add(g);
    return g;
  };
  const live = sims.slice(0, LIVE).map((_, i) => clothGroup(texs[i]));
  const waiting = Array.from({ length: 6 }, () => clothGroup(texs[LIVE]));

  // ---- the machine
  const frameMat = new MeshPhysicalNodeMaterial({ metalness: 1, roughness: 0.18 });
  // no occlusion on the frames: thin bars gain nothing from it, and the cloth's contact with the frame's lip,
  // a quarter of the picture's size, bled onto the bar's face as a dashed dirty band
  // and no traced reflections: on a thin silver bar, at half size, the copper mirrors beside it came out as broken
  // orange specks (it keeps the room's reflection; the floor and the ball keep theirs)
  if (withPost) frameMat.mrtNode = mrt({ normal: vec4(normalView, 0), refl: reflectance(specularColorBlended, roughness, metalness, false) });
  frameMat.positionNode = Fn(() => {
    normalLocal.assign(turned(normalLocal, positionLocal.y));
    return bent(positionLocal);
  })();
  const half = cloth.size / 2 - 0.01, band = 0.035, depth = 0.05, gap = 0.035;
  // the frame: a rounded square band with a slot in the top bar, where the rod comes through
  const corner = (a: number, r: number) => {
    // round the rectangle clockwise from the top middle
    const pts: Vector2[] = [];
    const arc = (cx: number, cy: number, from: number) => {
      for (let i = 0; i <= 10; i++) {
        const t = from - (i / 10) * (Math.PI / 2);
        pts.push(new Vector2(cx + r * Math.cos(t), cy + r * Math.sin(t)));
      }
    };
    arc(a - r, a - r, Math.PI / 2);
    arc(a - r, -a + r, 0);
    arc(-a + r, -a + r, -Math.PI / 2);
    arc(-a + r, a - r, Math.PI);
    return pts;
  };
  const outerPts = [new Vector2(gap, half + band), ...corner(half + band, 0.06), new Vector2(-gap, half + band)];
  const innerPts = [new Vector2(gap, half), ...corner(half, 0.03), new Vector2(-gap, half)].reverse();
  const frameGeo = new ExtrudeGeometry(new Shape([...outerPts, ...innerPts]), { depth: depth - 0.012, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.006, bevelSegments: 4, curveSegments: 24 });
  frameGeo.translate(0, 0, -(depth - 0.012) / 2);
  const railY = -half - band - 0.32;
  const stemLength = -railY - half - band;
  const stemGeo = new CylinderGeometry(0.018, 0.018, stemLength, 16);
  stemGeo.translate(0, -half - band - stemLength / 2, 0);
  const carriageGeo = new RoundedBoxGeometry(0.34, 0.12, 0.16, 3, 0.03);
  carriageGeo.translate(0, railY + 0.03, 0);
  const steel = blackSteel(0.3);
  const frames = Array.from({ length: 11 }, () => {
    const g = new Group();
    g.add(new Mesh(frameGeo, frameMat), new Mesh(stemGeo, frameMat), new Mesh(carriageGeo, steel));
    g.userData.bend = new Vector4();
    for (const m of g.children) {
      m.castShadow = m.receiveShadow = true;
      m.userData.bend = g.userData.bend;
    }
    scene.add(g);
    return g;
  });
  const rail = new Mesh(new BoxGeometry(80, 0.06, 0.1), chrome(0.2, "#b9bcc4"));
  rail.position.set(0, railY - 0.06, 0);
  rail.receiveShadow = true;
  scene.add(rail);

  // ---- the studio floor, with a square hole on each side where the shed cloths drop
  const floorY = railY - 0.08;
  pitTop.value = floorY;
  const hole = { half: 0.8, z: 2.35, depth: 4.6 };
  const square = <T extends Path>(path: T, cx: number, cz: number, a: number, r: number): T => {
    const pts = corner(a, r).map((v) => new Vector2(cx + v.x, cz + v.y));
    path.setFromPoints([new Vector2(cx, cz + a), ...pts]);
    return path;
  };
  const floorShape = new Shape().setFromPoints([new Vector2(-40, -40), new Vector2(40, -40), new Vector2(40, 40), new Vector2(-40, 40)]);
  for (const sz of [-1, 1]) floorShape.holes.push(square(new Path(), 0, sz * hole.z, hole.half, 0.06));
  const floorGeo = new ShapeGeometry(floorShape, 12);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new MeshStandardNodeMaterial({ roughness: 0.62, metalness: 0 });
  // a pool of light round the machine, falling off into the studio
  const poolU = { amount: uniform(look.pool), size: uniform(look.poolSize), color: uniform(new Color(look.floorColor)) };
  floorMat.colorNode = poolU.color.mul(float(1).sub(poolU.amount.mul(smoothstep(0, poolU.size, positionWorld.xz.length()))));
  const floorShine = uniform(look.floorShine);
  if (withPost) floorMat.mrtNode = mrt({ refl: reflectance(vec3(floorShine), roughness, 0) });
  const floor = new Mesh(floorGeo, floorMat);
  floor.position.y = floorY;
  floor.receiveShadow = true;
  floor.castShadow = true; // so the shafts below are in its shadow
  scene.add(floor);
  // each hole: a machined lip, and a shaft into the dark
  const lipShape = square(new Shape(), 0, 0, hole.half + 0.045, 0.08);
  lipShape.holes.push(square(new Path(), 0, 0, hole.half, 0.06));
  const lipGeo = new ExtrudeGeometry(lipShape, { depth: 0.012, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 3, curveSegments: 12 });
  lipGeo.rotateX(-Math.PI / 2);
  const lipMat = chrome(0.22, "#a7adb6");
  const shaftMat = new MeshStandardNodeMaterial({ side: DoubleSide, roughness: 0.9, metalness: 0 });
  const deep = smoothstep(floorY + 0.05, floorY - 1.8, positionWorld.y);
  shaftMat.colorNode = mix(vec3(0.07, 0.075, 0.085), vec3(0, 0, 0), deep);
  shaftMat.aoNode = float(1).sub(deep.mul(0.97)).mul(0.4);
  for (const sz of [-1, 1]) {
    const lip = new Mesh(lipGeo, lipMat);
    lip.position.set(0, floorY, sz * hole.z);
    lip.castShadow = lip.receiveShadow = true;
    scene.add(lip);
    for (let w = 0; w < 4; w++) {
      const wall = new Mesh(new PlaneGeometry(2 * hole.half, hole.depth), shaftMat);
      const a = (w * Math.PI) / 2;
      wall.position.set(Math.sin(a) * hole.half, floorY - hole.depth / 2, sz * hole.z + Math.cos(a) * hole.half);
      wall.rotation.y = a;
      wall.receiveShadow = true;
      scene.add(wall);
    }
    const bottom = new Mesh(new PlaneGeometry(2 * hole.half, 2 * hole.half), new MeshBasicNodeMaterial({ color: 0x000000 }));
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(0, floorY - hole.depth, sz * hole.z);
    scene.add(bottom);
  }
  // the haze of a big studio: far things (the line's ends, the floor's edge) go into the backdrop
  const haze = uniform(new Color(look.back));
  const hazeNear = uniform(look.hazeNear), hazeFar = uniform(look.hazeFar);
  scene.fogNode = fog(haze, rangeFogFactor(hazeNear, hazeFar));
  const rim = new DirectionalLight(0xdfe8ff, look.rim);
  rim.position.set(6, 5, -9);
  scene.add(rim);

  // the pendulum: just its cord and its ball (what it hangs from is out of the picture)
  const swing = new Group(); // at the pivot, turned by the swing
  scene.add(swing);
  const rodGeo = new CylinderGeometry(1, 1, 1, 12);
  rodGeo.translate(0, -0.5, 0);
  // the cord comes down out of nowhere: it fades in below the pivot
  const cordMat = blackSteel(0.35);
  cordMat.transparent = true;
  cordMat.opacityNode = smoothstep(look.length - 0.05, look.length - 0.9, positionWorld.y);
  const rod = new Mesh(rodGeo, cordMat);
  const ballMat = new MeshStandardNodeMaterial({ metalness: 1 });
  const ball = new Mesh(new SphereGeometry(1, 96, 48), ballMat);
  rod.castShadow = ball.castShadow = true;
  swing.add(rod, ball);

  // ---- the clock and the schedule (simulated seconds; t = 0 is a top of the swing on the +z side)
  let pend = makePendulum(look.length, look.amp);
  let F = 0, dt = 0; // frames over one loop, and the step: a whole number of frames, even, so both halves match
  const timing = () => {
    F = 2 * Math.round((pend.T * 60) / look.speed / 2);
    dt = pend.T / F;
  };
  timing();
  const H = () => 2 * pend.Q; // a half swing: hit to hit
  const hitAt = (k: number) => pend.Q + k * H();
  // cloth k's frame comes into the station after cloth k-1 is hit; its sim starts as the ball comes
  const moveStart = (k: number) => hitAt(k - 1) + look.moveAfter;
  // every other cloth is met from the other side: its own frame is turned round, so in it the ball always
  // comes from -z
  const side = (k: number) => (((k % 2) + 2) % 2 === 0 ? -1 : 1);
  const ballWorld = (time: number) => {
    const th = pend.theta(time), l = pend.length;
    return [0, l - l * Math.cos(th), l * Math.sin(th)];
  };
  const ballLocal = (k: number, time: number) => {
    const b = ballWorld(time);
    return [0, b[1], side(k) * b[2]];
  };
  // how long before the hit a ball of this size first touches the sheet (its centre a radius away), and a little
  // more: a cloth must be awake by then, or the ball is already through it
  const wakeFor = (R: number) => {
    let s = 0;
    while (s < 0.4 && Math.abs(ballWorld(hitAt(0) - s)[2]) < R) s += 0.001;
    return Math.max(look.wake, s + 0.03);
  };
  let wake = wakeFor(look.ballR);
  const startAt = (k: number) => hitAt(k) - wake;
  // the line's position, in frames: frame k is in the station while it equals k
  const ease = (u: number) => {
    if (u <= 0) return 0;
    // a firm move: its push starts and ends at once (smoothstep), so the frames, sprung on their carriages, lean
    // back as it sets off and sway in place when it stops
    if (u < 1) return u * u * (3 - 2 * u);
    // the clunk: it overshoots a hair and rings out as the stop takes it
    const v = (u - 1) / 0.22;
    return v >= 1 ? 1 : 1 + look.overshoot * Math.sin(Math.PI * 2 * v) * Math.exp(-4 * v) * (1 - v);
  };
  const line = (time: number) => {
    const j = Math.floor((time - pend.Q - look.moveAfter) / H()) + 1;
    return j - 1 + ease((time - moveStart(j)) / look.moveFor);
  };

  // ---- the frames' wobble, worked out once for frame 0's whole life, frame by frame: every frame's ride is
  // frame 0's, k half swings later (in whole frames), so every frame wobbles the same and the loop stays exact.
  // Two damped modes driven by the carriage's acceleration (the rest lags behind it, swings past, rings out;
  // the clunk at the end of a move is a kick). From `calm` before its cloth wakes it is damped hard to rest,
  // and it is held still from the wake until the line moves on (the cloth's sim holds it at a frame that
  // doesn't move)
  const wob = { from: 0, q: new Float32Array(0) };
  const buildWobble = () => {
    const half = F / 2, from = -7 * half, to = 7 * half, pre = 3 * half;
    wob.from = from;
    wob.q = new Float32Array((to - from) * 2);
    const S = 8, h = dt / S;
    // wiggle bones, as in the wiggle library: two bones, carriage to the frame's middle and middle to its top.
    // Each bone's tip is a spring pulled toward where it would rest on its parent (straight on from it), damped on
    // its own speed, so it trails while the frame moves and swings past when it stops; the bone points at it. The
    // carriage is where the line puts it (the same move, clunk and all, that is drawn)
    const carriage = (time: number) => -line(time) * look.pitch;
    const L1 = -carriageTop, L2 = frameTop;
    const K = (2 * Math.PI * look.wobbleHz) ** 2, D = 2 * look.wobbleDamp * Math.sqrt(K);
    // (the top bone damped more, and against the lower bone's motion rather than the world's: it bends on the lower
    // as the frame speeds up and slows, without trailing or ringing of its own to beat against it)
    const D2 = 2 * Math.max(look.wobbleDamp, 0.55) * Math.sqrt(K);
    const still = -wake, calmFrom = still - look.calm;
    let c = carriage((from - pre) * dt);
    let p1 = c, v1 = 0, p2 = c, v2 = 0; // the tips' sideways positions in the world, and speeds
    for (let a = from - pre; a < to; a++) {
      for (let j = 0; j < S; j++) {
        const time = a * dt + (j + 1) * h;
        const tau = time - hitAt(0);
        c = carriage(time);
        if (tau >= still && tau < look.moveAfter) {
          p1 = p2 = c; // held still while its cloth is simulated in it
          v1 = v2 = 0;
          continue;
        }
        const t1 = Math.atan2(p1 - c, L1);
        v1 += h * (K * (c - p1) - D * v1);
        p1 += h * v1;
        const goal2 = p1 + L2 * Math.sin(t1);
        v2 += h * (K * (goal2 - p2) - D2 * (v2 - v1));
        p2 += h * v2;
      }
      if (a < from) continue;
      const t1 = Math.atan2(p1 - c, L1), t2 = Math.atan2(p2 - p1, L2);
      // on the way to its own hit, what is left fades out smoothly just before the cloth wakes
      const tau = a * dt - hitAt(0);
      const u = tau >= look.moveAfter ? 0 : Math.min(1, Math.max(0, (tau - calmFrom) / look.calm));
      const fade = (1 - u * u * (3 - 2 * u)) * look.wobble;
      wob.q[(a - from) * 2] = t1 * fade;
      wob.q[(a - from) * 2 + 1] = (t2 - t1) * fade * look.flex;
    }
  };



  // ---- the live cloths
  const slots = sims.slice(0, LIVE).map((sim) => ({ sim, k: -1 }));
  // in whole frames, so that every cloth sees exactly the same numbers as every other: cloth k starts at frame
  // start0 + k F/2, and its ball is the first cloth's ball, k half swings on (exactly the same arc, from its
  // side). Times worked out from the clock instead round differently a loop later, and the cloth's chaos
  // makes something of that
  const start0 = () => Math.ceil(startAt(0) / dt);
  const clothOf = (s: number, frame: number) => {
    // the newest cloth that has started of those this slot takes (every third)
    let k = Math.floor((frame - start0()) / (F / 2));
    while (k >= 0 && k % LIVE !== s) k--;
    return k;
  };
  const ballOwn = (frame: number) => {
    // the first cloth's ball, in its own frame (cloth 0 is met from +z, so turned round)
    const b = ballWorld(frame * dt);
    return [0, b[1], -b[2]];
  };
  let f = 0;
  const t = () => f * dt;
  const SETTLE = 240; // frames
  const settleStart = () => {
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
    rest.reset();
  };
  const settleStep = (k: number) => rest.advance(1 / 120, [0, 0, -10], [0, 0, -10], look.ballR, k === SETTLE - 1);
  // the ball's size changes as the page runs: nothing starts again, it eases to its new size and the cloths feel
  // it. A bigger one needs its cloths awake sooner, and that is only changed while no frame is settling for its
  // hit (there the two schedules agree, so nothing jumps): up to a second or two later
  const BALL_EASE = 90; // frames
  const size = { from: look.ballR, to: look.ballR, at: BALL_EASE, need: wake };
  const setBall = (R: number) => {
    size.from = look.ballR;
    size.to = R;
    size.at = 0;
    size.need = wakeFor(Math.max(look.ballR, R));
  };
  // one frame of it: how much the radius grew
  const easeBall = () => {
    const need = size.need;
    if (need !== wake) {
      const now = f * dt;
      const next = hitAt(Math.floor((now - pend.Q) / H()) + 1) - now;
      if (next > Math.max(wake, need) + look.calm + 0.02) {
        wake = need;
        buildWobble();
      }
    }
    if (size.at >= BALL_EASE || wake < need) return 0;
    const was = look.ballR;
    const u = ++size.at / BALL_EASE;
    look.ballR = size.at >= BALL_EASE ? size.to : size.from + (size.to - size.from) * u * u * (3 - 2 * u);
    if (size.at >= BALL_EASE) size.need = wakeFor(size.to); // (a smaller ball: its cloths may sleep longer again)
    return look.ballR - was;
  };
  const begin = () => {
    pend = makePendulum(look.length, look.amp);
    timing();
    look.ballR = size.from = size.to;
    size.at = BALL_EASE;
    wake = size.need = wakeFor(look.ballR);
    buildWobble();
    settleStart();
    f = 0;
    for (const s of slots) s.k = -1;
  };
  const restart = () => {
    begin();
    for (let k = 0; k < SETTLE; k++) settleStep(k);
  };
  // the sims' GPU time, now and then, for the performance readout
  const canTime = device.features.has("timestamp-query");
  const timer = canTime
    ? {
        querySet: device.createQuerySet({ type: "timestamp", count: 2 * LIVE }),
        resolve: device.createBuffer({ size: 16 * LIVE, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC }),
        read: device.createBuffer({ size: 16 * LIVE, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }),
        busy: false,
      }
    : null;
  const perf = { fps: 0, gpu: 0, sim: 0, frameMs: 0 };
  const stepFrame = () => {
    const ballGrew = easeBall();
    const timing = timer !== null && !timer.busy && (ctl.timeEvery || (f % 15 === 0 && !ctl.manual));
    const timed: number[] = [];
    slots.forEach((s, i) => {
      const k = clothOf(i, f + 1);
      if (k < 0) return;
      if (s.k !== k) {
        s.sim.restore(rest);
        s.k = k;
      }
      const a = f - (k * F) / 2; // this cloth's frame, on the first cloth's clock
      const age = (a + 1) * dt - hitAt(0);
      if (age > look.retireAfter) return;
      const far = age > look.farAfter;
      s.sim.advance(dt, ballOwn(a), ballOwn(a + 1), look.ballR, true, {
        pivot: [0, pend.length, 0],
        rod: look.rodR,
        gripScale: age >= look.moveAfter ? 0 : 1,
        sweeps: far ? 1 : undefined,
        listEvery: far ? look.listFar : look.listNear,
        ballGrew,
        timer: timing ? { querySet: timer.querySet, at: 2 * i } : undefined,
      });
      if (timing) timed.push(i);
    });
    if (timing && timed.length) {
      const enc = device.createCommandEncoder();
      enc.resolveQuerySet(timer.querySet, 0, 2 * LIVE, timer.resolve, 0);
      enc.copyBufferToBuffer(timer.resolve, 0, timer.read, 0, 16 * LIVE);
      device.queue.submit([enc.finish()]);
      timer.busy = true;
      ctl.timed = timer.read.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigUint64Array(timer.read.getMappedRange().slice(0));
        timer.read.unmap();
        timer.busy = false;
        perf.sim = +timed.reduce((a, i) => a + Number(t[2 * i + 1] - t[2 * i]) / 1e6, 0).toFixed(2);
      });
    } else if (timing) perf.sim = 0;
    f++;
  };
  // one frame like stepFrame, but each live cloth profiled kernel by kernel (GPU timestamps)
  const profileFrame = async () => {
    const out = [];
    for (const [i, s] of slots.entries()) {
      const k = clothOf(i, f + 1);
      if (k < 0) continue;
      if (s.k !== k) {
        s.sim.restore(rest);
        s.k = k;
      }
      const a = f - (k * F) / 2;
      const age = (a + 1) * dt - hitAt(0);
      if (age > look.retireAfter) continue;
      const far = age > look.farAfter;
      const r = await s.sim.profile(dt, ballOwn(a), ballOwn(a + 1), look.ballR, {
        pivot: [0, pend.length, 0],
        rod: look.rodR,
        gripScale: age >= look.moveAfter ? 0 : 1,
        sweeps: far ? 1 : undefined,
        listEvery: far ? look.listFar : look.listNear,
      });
      out.push({ k, sinceHit: +age.toFixed(2), ...r });
    }
    f++;
    return out;
  };
  // at load the same, two frames at a time: all at once it is over a second of the card's work in one lump, and
  // nothing else gets onto the screen till it is done (the loader's ball stood still in the air)
  begin();
  for (let k = 0; k < SETTLE; k++) {
    settleStep(k);
    if (k % 2) await device.queue.onSubmittedWorkDone();
  }

  const place = () => {
    const time = t();
    const c = line(time);
    // the frames on the line, and the still cloths in those not yet in use
    let w = 0;
    const k0 = Math.floor(c) - 5;
    frames.forEach((g, i) => {
      const k = k0 + i;
      g.position.x = (k - c) * look.pitch;
      g.rotation.y = side(k) < 0 ? Math.PI : 0;
      // its wobble: frame 0's at the same point of its life (and turned round with the frame)
      const at = (f - (k * F) / 2 - wob.from) * 2;
      const turn = side(k) < 0 ? -1 : 1;
      const bend = g.userData.bend as Vector4;
      if (at >= 0 && at < wob.q.length) bend.set(wob.q[at] * turn, wob.q[at + 1] * turn, 0, 0);
      else bend.set(0, 0, 0, 0);
      if (f < start0() + (k * F) / 2 && w < waiting.length) {
        const wg = waiting[w++];
        wg.visible = true;
        wg.position.x = g.position.x;
        wg.rotation.y = g.rotation.y;
        for (const m of wg.children) m.userData.bend = bend;
      }
    });
    for (; w < waiting.length; w++) waiting[w].visible = false;
    slots.forEach((s, i) => {
      live[i].visible = s.k >= 0 && (f - (s.k * F) / 2) * dt - hitAt(0) <= look.retireAfter;
      live[i].rotation.y = side(s.k) < 0 ? Math.PI : 0;
    });
    const th = pend.theta(time);
    swing.position.set(0, pend.length, 0);
    swing.rotation.x = -th;
    rod.scale.set(look.rodR, pend.length, look.rodR);
    ball.position.y = -pend.length;
    ball.scale.setScalar(look.ballR);
    U.ballR.value = look.ballR;
    const b = ballWorld(time);
    U.ballAt.value.set(b[0], b[1], b[2]);
    U.pivot.value.set(0, pend.length, 0);
    U.cordR.value = look.rodR;
  };

  // where things are, for tests: each live cloth's age, how much of its edge is held, where it has gone (local)
  const probe = async () => {
    const out = [];
    for (const s of slots) {
      if (s.k < 0) continue;
      const { pos, anchor } = await s.sim.read();
      let held = 0, edge = 0, ymin = 1e9, ymax = -1e9, zmin = 1e9, zmax = -1e9, zsum = 0;
      const n = pos.length / 4;
      for (let i = 0; i < n; i++) {
        ymin = Math.min(ymin, pos[4 * i + 1]);
        ymax = Math.max(ymax, pos[4 * i + 1]);
        zmin = Math.min(zmin, pos[4 * i + 2]);
        zmax = Math.max(zmax, pos[4 * i + 2]);
        zsum += pos[4 * i + 2];
        if (anchor[4 * i + 3] >= 0) {
          edge++;
          if (anchor[4 * i + 3] > 0) held++;
        }
      }
      const b = ballLocal(s.k, t());
      out.push({ k: s.k, sinceHit: +(t() - hitAt(s.k)).toFixed(3), held: +(held / edge).toFixed(3), y: [+ymin.toFixed(2), +ymax.toFixed(2)], z: [+zmin.toFixed(2), +zmax.toFixed(2)], zMean: +(zsum / n).toFixed(2), ball: b.map((v) => +v.toFixed(2)) });
    }
    return { t: +t().toFixed(3), loop: +(t() / pend.T).toFixed(3), T: +pend.T.toFixed(3), out };
  };

  const frameUp = () => {
    camera.fov = look.fov;
    const y = (look.yaw * Math.PI) / 180, x = (look.pitchView * Math.PI) / 180;
    const target = new Vector3(look.targetX, look.targetY, look.targetZ);
    camera.position.set(Math.sin(y) * Math.cos(x), Math.sin(x), Math.cos(y) * Math.cos(x)).multiplyScalar(look.distance).add(target);
    controls.target.copy(target);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  // C: take the view as it is now (after dragging it about) as the page's own, and print it to paste into `look`
  const takeView = () => {
    const off = camera.position.clone().sub(controls.target);
    const r = off.length();
    const deg = (a: number) => +((a * 180) / Math.PI).toFixed(2);
    Object.assign(look, {
      yaw: deg(Math.atan2(off.x, off.z)),
      pitchView: deg(Math.asin(off.y / r)),
      distance: +r.toFixed(3),
      fov: +camera.fov.toFixed(2),
      targetX: +controls.target.x.toFixed(3),
      targetY: +controls.target.y.toFixed(3),
      targetZ: +controls.target.z.toFixed(3),
    });
    for (const c of st.gui.controllersRecursive()) c.updateDisplay();
    const keys = ["yaw", "pitchView", "distance", "fov", "targetX", "targetY", "targetZ"] as const;
    const text = keys.map((k) => `${k}: ${look[k]},`).join("\n");
    console.log(`view (paste into look in src/veil.ts):\n${text}`);
    navigator.clipboard?.writeText(text).catch(() => {});
    return Object.fromEntries(keys.map((k) => [k, look[k]]));
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
    if (e.key === "c" || e.key === "C") takeView();
  };
  window.addEventListener("keydown", onKey);

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
    for (const m of shellMats) m.roughness = look.clothRough;
    U.thick.value = look.thickness;
    U.hollow.value = look.hollowTint;
    U.env.value = look.envLight;
    U.ballR.value = look.ballR;
    poolU.color.value.set(look.floorColor);
    poolU.amount.value = look.pool;
    poolU.size.value = look.poolSize;
    haze.value.set(look.back);
    hazeNear.value = look.hazeNear;
    hazeFar.value = look.hazeFar;
    rim.intensity = look.rim;
    floorShine.value = look.floorShine;
    st.aimKey(look.keySize, { x: 0, y: -1, z: 0 });
  };
  paint();

  const ev = st.gui.addFolder("machine");
  ev.add(look, "speed", 0.05, 1, 0.01).onFinishChange(restart);
  for (const [k, lo, hi, s] of [
    ["length", 1.6, 4, 0.05],
    ["amp", 20, 70, 0.5],
    ["moveAfter", 0.2, 1, 0.01],
    ["moveFor", 0.2, 1.2, 0.01],
  ] as const)
    ev.add(look, k, lo, hi, s).onFinishChange(restart);
  ev.add(look, "overshoot", 0, 0.05, 0.001);
  ev.add(look, "pitch", 2.2, 4, 0.01).onFinishChange(buildWobble);
  // the ball's size, for play: the slider, and the page's links, change it as it runs (the address keeps it)
  const BALL = 0.16;
  const ballUi = { r: look.ballR };
  const ballSlider = st.gui.add(ballUi, "r", 0.06, 0.7, 0.01).name("ball size (radius, m)");
  const ballLinks = [...document.querySelectorAll<HTMLAnchorElement>(".balls a")];
  const ballOf = (a: HTMLAnchorElement) => Number(new URL(a.href).searchParams.get("ball") ?? BALL);
  const showBall = (R: number) => {
    for (const a of ballLinks) {
      if (Math.abs(ballOf(a) - R) < 1e-6) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    }
  };
  const chooseBall = (R: number) => {
    setBall(R);
    showBall(R);
    ballUi.r = R;
    ballSlider.updateDisplay();
    const u = new URL(location.href);
    if (R === BALL) u.searchParams.delete("ball");
    else u.searchParams.set("ball", String(R));
    history.replaceState(null, "", u);
  };
  ballSlider.onChange((R: number) => {
    setBall(R);
    showBall(R);
  });
  ballSlider.onFinishChange(chooseBall);
  const onBall = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // (a new tab is still a new tab)
    e.preventDefault();
    chooseBall(ballOf(e.currentTarget as HTMLAnchorElement));
  };
  for (const a of ballLinks) a.addEventListener("click", onBall);
  showBall(look.ballR);
  const wf = st.gui.addFolder("wobble");
  wf.add(look, "wobble", 0, 3, 0.01).onFinishChange(buildWobble);
  wf.add(look, "wobbleHz", 1, 12, 0.1).name("spring Hz (sim)").onFinishChange(buildWobble);
  wf.add(look, "flex", 0, 2, 0.01).name("top bone bends").onFinishChange(buildWobble);
  wf.add(look, "wobbleDamp", 0.02, 1, 0.01).name("damping").onFinishChange(buildWobble);
  wf.add(look, "calm", 0.05, 0.6, 0.01).onFinishChange(buildWobble);
  const cf = st.gui.addFolder("cloth");
  for (const [k, lo, hi, s] of [
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
    cf.add(look, k, lo, hi, s).onFinishChange(restart);
  cf.add(look, "self").name("keeps off itself").onChange(restart);
  cf.add({ restart }, "restart");
  const lk = st.gui.addFolder("look");
  lk.addColor(look, "clothColor").onChange(paint);
  lk.add(look, "clothRough", 0, 0.5, 0.005).onChange(paint);
  lk.add(look, "hollowTint", 0, 6, 0.05).onChange(paint);
  lk.add(look, "thickness", 0, 0.03, 0.0005).onChange(paint);
  lk.addColor(look, "frameColor").onChange(paint);
  lk.addColor(look, "ballColor").onChange(paint);
  lk.add(look, "ballRough", 0, 1, 0.01).onChange(paint);
  lk.add(look, "fov", 10, 70, 1).onChange(frameUp);
  lk.add(look, "yaw", -180, 180, 0.1).onChange(frameUp);
  lk.add(look, "pitchView", -30, 89, 0.1).name("pitch").onChange(frameUp);
  lk.add(look, "distance", 2, 30, 0.1).onChange(frameUp);
  for (const k of ["targetX", "targetY", "targetZ"] as const) lk.add(look, k, -4, 4, 0.01).onChange(frameUp);
  lk.add({ frameUp }, "frameUp").name("reset view");
  const sf = st.gui.addFolder("setting");
  sf.addColor(look, "floorColor").onChange(paint);
  sf.add(look, "rim", 0, 5, 0.01).onChange(paint);
  sf.add(look, "floorShine", 0, 1, 0.01).onChange(paint);
  sf.add(look, "pool", 0, 1, 0.01).onChange(paint);
  sf.add(look, "poolSize", 1, 30, 0.1).onChange(paint);
  sf.add(look, "keyAzimuth", -180, 180, 1).onChange(paint);
  sf.add(look, "keyElevation", 5, 90, 1).onChange(paint);
  sf.add(look, "keySize", 2, 12, 0.1).onChange(paint);
  sf.add(look, "hazeNear", 0, 40, 0.1).onChange(paint);
  sf.add(look, "hazeFar", 1, 80, 0.1).onChange(paint);
  st.gui.onChange(() => {
    st.refresh();
    paint();
  });
  st.refresh();
  const post = withPost ? screenSpace(st, look) : null;

  // adaptive performance: the page runs at 60 frames a second; if with the reflections on it can't (under 57 for two
  // 2 s windows running, from 2 s in), they go, once and for good: no back and forth. A switch thrown by hand in the
  // performance folder ends it (?adaptive=0 never; ?adaptfps= another target, for testing)
  const adapt = { on: query.get("adaptive") !== "0" && post !== null, target: Number(query.get("adaptfps") ?? 57), strikes: 0, frames: 0, ms: 0, warm: 120, note: "watching" };
  let onAdapt = () => {};
  const judge = (interval: number) => {
    if (!adapt.on || !post?.parts.reflections) return;
    if (interval > 100) {
      adapt.frames = adapt.ms = 0; // the tab was away, or something stalled: start the window again
      return;
    }
    if (adapt.warm > 0) {
      adapt.warm--;
      return;
    }
    adapt.frames++;
    adapt.ms += interval;
    if (adapt.frames < 120) return;
    const fps = (1000 * adapt.frames) / adapt.ms;
    adapt.frames = adapt.ms = 0;
    // (two windows running, so one hiccup, a tab switch or a slider dragged, doesn't take them)
    adapt.strikes = fps >= adapt.target ? 0 : adapt.strikes + 1;
    if (adapt.strikes < 2) return;
    post.setParts({ reflections: false });
    adapt.on = false;
    adapt.note = `reflections off (${fps.toFixed(0)} fps with them)`;
    console.log(`pendulum: ${adapt.note}`);
    onAdapt();
  };

  // performance: readouts, and switches for every costly part, to see what can go
  {
    const pf = st.gui.addFolder("performance");
    pf.add(perf, "fps").listen().disable();
    pf.add(perf, "frameMs").name("frame ms").listen().disable();
    if (gpuTime) pf.add(perf, "gpu").name("render GPU ms (?gputime=1)").listen().disable();
    pf.add(perf, "sim").name("cloth sim GPU ms").listen().disable();
    const sw = {
      renderScale: renderer.getPixelRatio(),
      reflections: post?.parts.reflections ?? false,
      reflectionSize: post?.parts.reflectionSize ?? 1,
      floorBlur: post?.parts.floorBlur ?? false,
      occlusion: post?.parts.occlusion ?? false,
      occlusionKind: post?.parts.occlusionKind ?? "n8ao",
      denoise: post?.parts.denoise ?? false,
      occlusionSize: post?.parts.occlusionSize ?? 0.5,
      bloom: true,
      shadowUpdates: true,
      selfCollision: look.self,
    };
    const byHand = () => {
      if (adapt.on) adapt.note = "off: set by hand";
      adapt.on = false;
    };
    onAdapt = () => {
      sw.reflections = post?.parts.reflections ?? false;
      pf.controllersRecursive().forEach((c) => c.updateDisplay());
    };
    pf.add(adapt, "note").name("adaptive").listen().disable();
    const parts = () => {
      byHand();
      setParts();
    };
    const setParts = () => post?.setParts({ reflections: sw.reflections, reflectionSize: sw.reflectionSize, floorBlur: sw.floorBlur, occlusion: sw.occlusion, occlusionKind: sw.occlusionKind, denoise: sw.denoise, occlusionSize: sw.occlusionSize, bloom: sw.bloom });
    pf.add(sw, "renderScale", [0.75, 1, 1.5, 2]).name("pixel ratio").onChange((v: number) => {
      byHand();
      renderer.setPixelRatio(v);
      st.resize(innerWidth, innerHeight);
    });
    if (post) {
      pf.add(sw, "reflections").name("reflections (SSR)").onChange(parts);
      pf.add(sw, "reflectionSize", [1, 0.75, 0.5]).name("reflection size").onChange(parts);
      pf.add(sw, "floorBlur").name("floor reflection blur").onChange(parts);
      pf.add(sw, "occlusion").name("occlusion + cloth inside colour").onChange(parts);
      pf.add(sw, "occlusionKind", ["n8ao", "gtao"]).name("occlusion kind").onChange(parts);
      pf.add(sw, "denoise").name("occlusion denoise").onChange(parts);
      pf.add(sw, "occlusionSize", [0.5, 0.25, 0.125]).name("occlusion size").onChange(parts);
    }
    pf.add(sw, "bloom").onChange(parts);
    pf.add(sw, "shadowUpdates").name("shadows follow (off: frozen)").onChange((v: boolean) => (st.key.shadow.autoUpdate = v));
    pf.add(look, "listNear", [4, 6, 8]).name("neighbour lists every (substeps)");
    pf.add(sw, "selfCollision").name("cloth keeps off itself").onChange((v: boolean) => {
      look.self = v;
      restart();
    });
    pf.add({ post: () => (location.search = "?post=0") }, "post").name("reload without post (no MRT)");
    pf.open();
  }

  // tests drive the clock themselves (manual), stop the page's own frames (off), time the sims every frame
  const ctl = { manual: false, off: false, timeEvery: false, timed: null as Promise<void> | null };
  Object.assign(window, {
    __pendulum: {
      ...st,
      frameUp,
      takeView,
      setBall,
      get wake() {
        return wake;
      },
      wakeFor,
      wob,
      cloth,
      post,
      perf,
      restart,
      probe,
      sims,
      slots,
      ctl,
      stepFrame,
      profileFrame,
      place,
      live,
      waiting,
      frames,
      get F() {
        return F;
      },
      get f() {
        return f;
      },
      get T() {
        return pend.T;
      },
    },
  });

  // 60 frames a second, whatever the screen: the clock is whole frames, so a 120 Hz screen played the loop twice
  // as fast. A frame is drawn once 1/60 s has gathered since the last (with a little slack, so a 60 Hz screen
  // draws every one; a 144 Hz one averages 60). Not while recording: then every frame is one
  const FRAME = 1000 / 60;
  let gathered = 0, lastTick = 0;
  wrap.render = ({ recording }) => {
    if (ctl.off) return;
    const tick = performance.now();
    if (!recording && !ctl.manual && st.state.hold < 0 && lastTick > 0) {
      gathered = Math.min(gathered + tick - lastTick, 2 * FRAME);
      lastTick = tick;
      if (gathered < FRAME - 1.5) return;
      gathered = Math.max(0, gathered - FRAME);
    } else lastTick = tick;
    if (ctl.manual) {
      // a test is driving
    } else if (st.state.hold >= 0) {
      // a still: one loop run first (so the cloth before is falling away), then on to the moment
      const target = F + Math.round(st.state.hold * F);
      if (target < f) restart();
      while (f < target) stepFrame();
    } else {
      stepFrame();
    }
    place();
    st.render();
    // the loader goes when a picture is on the screen, not when it has been asked for: the first one has every shader
    // to build, and the frames come back from here long before the card has drawn them
    if (loader && st.state.frame >= 3) {
      const gone = loader;
      loader = null;
      device.queue.onSubmittedWorkDone().then(() => {
        gone.classList.add("done");
        setTimeout(() => gone.remove(), 1500);
      });
    }
    // the readouts
    const now = performance.now();
    if (lastFrame > 0) {
      perf.frameMs = +(0.9 * perf.frameMs + 0.1 * (now - lastFrame)).toFixed(2);
      if (!recording && st.state.hold < 0 && !ctl.manual) judge(now - lastFrame);
    }
    perf.fps = perf.frameMs > 0 ? Math.round(1000 / perf.frameMs) : 0;
    lastFrame = now;
    framesSince++;
    if (gpuTime && !gpuBusy) {
      gpuBusy = true;
      const n = framesSince;
      framesSince = 0;
      renderer.resolveTimestampsAsync("render").then((ms) => {
        if (typeof ms === "number" && n > 0) perf.gpu = +(ms / n).toFixed(2);
        gpuBusy = false;
      });
    }
  };
  let loader = document.getElementById("loader");
  let lastFrame = 0, framesSince = 0, gpuBusy = false;
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => {
    window.removeEventListener("keydown", onKey);
    for (const a of ballLinks) a.removeEventListener("click", onBall);
    st.renderer.dispose();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 13_100, // one loop at the default speed: 786 frames
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
