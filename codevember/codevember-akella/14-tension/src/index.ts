// Tension: a stone bounces on a rope. Each time it lands the rope tears, and holding it is the rope's
// own core, thinner, which throws it up again; and so on, inwards for ever. The picture zooms in as it
// goes, so every tear looks like the first. See sim.ts for the rope, bounce.ts for the stone, and
// bake.ts for how one period is kept that repeats itself exactly.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import Stats from "three/examples/jsm/libs/stats.module.js";
import * as TSL from "three/tsl";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardNodeMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  RenderPipeline,
  Scene,
  Uint32BufferAttribute,
  Vector3,
  WebGPURenderer,
} from "three/webgpu";
import { bake, P } from "./bake.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const {
  abs,
  attribute,
  cos,
  cross,
  dot,
  float,
  fract,
  Fn,
  floor,
  mix,
  normalize,
  pass,
  positionLocal,
  screenCoordinate,
  screenUV,
  sin,
  smoothstep,
  transformNormalToView,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} = T;

export const look = {
  rope: "#c9a46a",
  rope2: "#94703f", // the colour in the grooves
  lay: 5, // segments a strand takes to go once round
  strands: 3,
  bump: 0.45,
  stone: "#6f6a63",
  wall: "#4a423a",
  wallZ: -0.9,
  sunUp: 38, // degrees
  sunTurn: -35,
  sun: 3.4,
  sky: 1.1,
  exposure: 1,
  vignette: 0.7,
  grain: 0.035,
  fov: 26,
  dist: 3.6,
  lookY: 0.28,
};
const ranges: Record<string, [number, number, number?]> = {
  lay: [2, 20, 0.5],
  strands: [1, 6, 1],
  bump: [0, 1.5, 0.01],
  wallZ: [-3, -0.2, 0.01],
  sunUp: [0, 89, 1],
  sunTurn: [-90, 90, 1],
  sun: [0, 8, 0.05],
  sky: [0, 3, 0.01],
  exposure: [0.2, 3, 0.01],
  vignette: [0, 1.5, 0.01],
  grain: [0, 0.2, 0.005],
  fov: [10, 60, 1],
  dist: [1, 10, 0.05],
  lookY: [-0.5, 1, 0.01],
};

/** three r0.18x's lighting has `v.xy.x`, which Chromium's WGSL compiler rejects without the unsafe flag */
function flattenSwizzles(renderer: WebGPURenderer) {
  const { device } = renderer.backend as unknown as { device?: GPUDevice };
  if (!device) return;
  const create = device.createShaderModule.bind(device);
  const flat = (_: string, first: string, second: string) =>
    `.${first["xyzw".indexOf(second)]}`;
  device.createShaderModule = (d) =>
    create({
      ...d,
      code: d.code.replace(/\.([xyzw]{2,4})\.([xyzw])\b/g, flat),
    });
}

const sketch: Sketch<"webgpu"> = async ({
  wrap,
  canvas,
  width,
  height,
  pixelRatio,
}) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }

  const renderer = new WebGPURenderer({ canvas, antialias: false });
  renderer.setPixelRatio(Math.min(pixelRatio, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  await renderer.init();
  flattenSwizzles(renderer);

  // ---- one period of the chain, kept
  let baked = bake();
  const F = baked.frames;

  const scene = new Scene();

  // ---- the rope: one tube through every node, with a ring each side of a place where the thickness steps
  const SIDES = 14;
  type Ring = { node: number; side: -1 | 0 | 1 };
  const rings: Ring[] = [];
  const g = baked.gen;
  const last = baked.n - 1;
  for (let i = 0; i <= last; i++) {
    if (i === 0) rings.push({ node: i, side: 1 });
    else if (i === last) rings.push({ node: i, side: -1 });
    else if (g[i - 1] !== g[i])
      rings.push({ node: i, side: -1 }, { node: i, side: 1 });
    else rings.push({ node: i, side: 0 });
  }
  const R = rings.length;
  const count = R * (SIDES + 1);
  const geometry = new BufferGeometry();
  const pos = new Float32Array(count * 3),
    nor = new Float32Array(count * 3),
    tan = new Float32Array(count * 3),
    surf = new Float32Array(count * 2);
  const around = new Float32Array(count);
  for (let r = 0; r < R; r++)
    for (let s = 0; s <= SIDES; s++) around[r * (SIDES + 1) + s] = s / SIDES;
  geometry.setAttribute("position", new BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new BufferAttribute(nor, 3));
  geometry.setAttribute("ropeTangent", new BufferAttribute(tan, 3));
  geometry.setAttribute("surf", new BufferAttribute(surf, 2));
  const index: number[] = [];
  for (let r = 0; r < R - 1; r++) {
    // a step is a flat ring between the thick tube and the thin one; it is the torn end of the sheath
    for (let s = 0; s < SIDES; s++) {
      const a = r * (SIDES + 1) + s,
        b = a + SIDES + 1;
      index.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(index), 1));

  const U = {
    rope: uniform(new Color(look.rope)),
    rope2: uniform(new Color(look.rope2)),
    lay: uniform(look.lay),
    strands: uniform(look.strands),
    bump: uniform(look.bump),
    exposure: uniform(look.exposure),
    vignette: uniform(look.vignette),
    grain: uniform(look.grain),
    frame: uniform(0),
  };

  const ropeMaterial = new MeshStandardNodeMaterial({
    roughness: 0.82,
    metalness: 0,
  });
  {
    const vS = varying(attribute("surf", "vec2"), "vSurf");
    const vT = varying(attribute("ropeTangent", "vec3"), "vRopeT");
    // strands: their phase goes once round the rope every `lay` segments, `strands` of them side by side
    const strand = () => {
      const along = vS.x;
      const ar = vS.y;
      const ph = U.strands.mul(ar.add(along.div(U.lay)));
      const f = fract(ph);
      const k = floor(ph);
      return { f, k, ph };
    };
    ropeMaterial.colorNode = Fn(() => {
      const { f, k } = strand();
      const along = vS.x;
      // a strand is round: dark where it meets the next one
      const crown = float(1)
        .sub(abs(f.mul(2).sub(1)))
        .pow(0.6);
      // fibres lie along each strand, steeper than the strand itself
      const fib = fract(
        sin(floor(f.mul(9)).add(k.mul(17.3)).mul(91.7)).mul(4375.5),
      );
      const streak = fract(
        sin(
          floor(along.mul(2.5).add(f.mul(5)))
            .add(k.mul(3.1))
            .mul(13.7),
        ).mul(9137.1),
      );
      const base = mix(U.rope2, U.rope, crown.mul(0.8).add(0.2));
      return vec4(
        base.mul(fib.mul(0.18).add(0.86)).mul(streak.mul(0.12).add(0.94)),
        1,
      );
    })();
    ropeMaterial.normalNode = Fn(() => {
      const { f } = strand();
      const n = normalize(T.normalLocal);
      const t = normalize(vT);
      const b = normalize(cross(n, t));
      // the bulge of a strand tilts the surface across it
      const tilt = f.sub(0.5).mul(U.bump).mul(2);
      const lean = 0.5; // the strand's angle to the rope
      const across = normalize(
        t.mul(-Math.sin(lean)).add(b.mul(Math.cos(lean))),
      );
      return transformNormalToView(
        normalize(n.mul(cos(tilt)).add(across.mul(sin(tilt)))),
      );
    })();
  }
  const rope = new Mesh(geometry, ropeMaterial);
  rope.frustumCulled = false;
  rope.castShadow = true;
  rope.receiveShadow = true;
  scene.add(rope);

  // ---- the torn sheaths: a tube for each tail, open at the loose end and thinning there, like a fray
  const TN = baked.tn,
    TS = baked.slots.length;
  const tailCount = TS * TN * (SIDES + 1);
  const tailGeometry = new BufferGeometry();
  const tpos = new Float32Array(tailCount * 3),
    tnor = new Float32Array(tailCount * 3),
    ttan = new Float32Array(tailCount * 3),
    tsurf = new Float32Array(tailCount * 2);
  tailGeometry.setAttribute("position", new BufferAttribute(tpos, 3));
  tailGeometry.setAttribute("normal", new BufferAttribute(tnor, 3));
  tailGeometry.setAttribute("ropeTangent", new BufferAttribute(ttan, 3));
  tailGeometry.setAttribute("surf", new BufferAttribute(tsurf, 2));
  {
    const idx: number[] = [];
    for (let sl = 0; sl < TS; sl++)
      for (let r = 0; r < TN - 1; r++)
        for (let s2 = 0; s2 < SIDES; s2++) {
          const a = (sl * TN + r) * (SIDES + 1) + s2,
            b = a + SIDES + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
    tailGeometry.setIndex(new Uint32BufferAttribute(new Uint32Array(idx), 1));
  }
  const tails = new Mesh(tailGeometry, ropeMaterial);
  tails.frustumCulled = false;
  tails.castShadow = true;
  tails.receiveShadow = true;
  scene.add(tails);

  // ---- the stone: a lumpy ball, the same size in the picture always
  const stoneGeometry = new IcosahedronGeometry(1, 6);
  {
    const p = stoneGeometry.getAttribute("position");
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const waves = Array.from({ length: 14 }, (_, i) => {
      const d = new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
      return { d, f: 0.5 + i * 0.12, a: 0.07 / (1 + i * 0.5), o: rnd() * 6.28 };
    });
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      let r = 1;
      for (const w of waves) r += w.a * Math.sin(v.dot(w.d) * w.f * 3 + w.o);
      // a little flattened, like a river stone
      v.multiplyScalar(r);
      v.y *= 0.82;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    stoneGeometry.computeVertexNormals();
  }
  const stoneMaterial = new MeshStandardNodeMaterial({
    roughness: 0.7,
    metalness: 0,
  });
  {
    const tint = uniform(new Color(look.stone));
    Object.assign(U, { stone: tint });
    stoneMaterial.colorNode = Fn(() => {
      const q = positionLocal.mul(9);
      const n1 = sin(q.x.add(sin(q.y.mul(1.7))))
        .mul(sin(q.y.add(sin(q.z.mul(1.3)))))
        .mul(sin(q.z.add(sin(q.x.mul(1.9)))));
      const speck = fract(
        sin(
          dot(floor(positionLocal.mul(70)), vec3(12.9898, 78.233, 37.719)),
        ).mul(43758.5453),
      );
      const c = tint
        .mul(n1.mul(0.12).add(0.95))
        .mul(smoothstep(0.86, 1, speck).mul(-0.35).add(1))
        .add(smoothstep(0.97, 1, speck).mul(0.25));
      return vec4(c, 1);
    })();
  }
  const stone = new Mesh(stoneGeometry, stoneMaterial);
  stone.castShadow = true;
  stone.receiveShadow = true;
  stone.scale.setScalar(P.stoneR * 0.92);
  scene.add(stone);

  // ---- a wall behind, to catch the shadows
  const wallMaterial = new MeshStandardNodeMaterial({
    roughness: 0.95,
    metalness: 0,
  });
  const wallTint = uniform(new Color(look.wall));
  wallMaterial.colorNode = wallTint;
  const wall = new Mesh(new PlaneGeometry(40, 40), wallMaterial);
  wall.receiveShadow = true;
  scene.add(wall);

  const sun = new DirectionalLight(0xfff1dc, look.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -3;
  sun.shadow.camera.right = sun.shadow.camera.top = 3;
  sun.shadow.camera.near = 0.1;
  sun.shadow.camera.far = 20;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.01;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);
  const sky = new HemisphereLight(0xdfe6f0, 0x3a3027, look.sky);
  scene.add(sky);

  // ---- camera
  const camera = new PerspectiveCamera(look.fov, width / height, 0.05, 50);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  const frameUp = () => {
    camera.fov = look.fov;
    camera.position.set(0, look.lookY, look.dist);
    controls.target.set(0, look.lookY, 0);
    camera.updateProjectionMatrix();
  };
  frameUp();

  // ---- the print
  const pipeline = new RenderPipeline(renderer);
  const drawn = pass(scene, camera, { samples: 4 });
  const picture = drawn.getTextureNode("output");
  pipeline.outputNode = Fn(() => {
    const c = picture.rgb.mul(U.exposure);
    const q = screenUV.sub(vec2(0.5, 0.45));
    const corner = float(1)
      .sub(U.vignette.mul(dot(q, q)).mul(1.4))
      .max(0);
    const seed = vec3(screenCoordinate.xy, U.frame)
      .mul(vec3(0.1031, 0.103, 0.0973))
      .fract()
      .toVar();
    seed.addAssign(dot(seed, seed.yzx.add(33.33)));
    const noise = fract(seed.x.add(seed.y).mul(seed.z)).sub(0.5);
    return vec4(c.mul(corner).add(noise.mul(U.grain)), 1);
  })();

  const refresh = () => {
    U.rope.value.set(look.rope);
    U.rope2.value.set(look.rope2);
    U.lay.value = look.lay;
    U.strands.value = look.strands;
    U.bump.value = look.bump;
    (U as unknown as { stone: { value: Color } }).stone.value.set(look.stone);
    wallTint.value.set(look.wall);
    wall.position.z = look.wallZ;
    const up = (look.sunUp * Math.PI) / 180,
      turn = (look.sunTurn * Math.PI) / 180;
    sun.position.set(
      Math.sin(turn) * Math.cos(up) * 6,
      Math.sin(up) * 6,
      Math.cos(turn) * Math.cos(up) * 6,
    );
    sun.intensity = look.sun;
    sky.intensity = look.sky;
    U.exposure.value = look.exposure;
    U.vignette.value = look.vignette;
    U.grain.value = look.grain;
    renderer.setClearColor(new Color(look.wall));
  };
  refresh();

  // ---- a frame of the bake into the tube
  const t3 = new Vector3();
  const show = (j: number) => {
    const n = baked.n;
    const X = baked.x.subarray(j * n, j * n + n),
      Y = baked.y.subarray(j * n, j * n + n),
      M = baked.mat.subarray(j * n, j * n + n);
    // frame 0 is the last before a tear, at the full size; the rest are after it
    const z = j === 0 ? 1 : Math.pow(P.S, j / F - 1);
    for (let r = 0; r < R; r++) {
      const { node: i, side } = rings[r];
      const a = side === 1 ? i : Math.max(i - 1, 0),
        b = side === -1 ? i : Math.min(i + 1, last);
      t3.set(X[b] - X[a], Y[b] - Y[a], 0).normalize();
      const k = side === -1 ? g[i - 1] : g[i];
      const rad = P.rope * Math.pow(P.S, k) * z;
      const along =
        side === -1
          ? M[i - 1] + 1
          : side === 1 && i < last
            ? M[i + 1] - 1
            : M[i];
      // the section: across the rope in the picture, and towards the viewer
      const nx = -t3.y,
        ny = t3.x;
      for (let s = 0; s <= SIDES; s++) {
        const q = r * (SIDES + 1) + s;
        const ang = (s / SIDES) * Math.PI * 2;
        const cx = Math.cos(ang),
          sz = Math.sin(ang);
        const ox = nx * cx,
          oy = ny * cx,
          oz = sz;
        pos[q * 3] = X[i] + ox * rad;
        pos[q * 3 + 1] = Y[i] + oy * rad;
        pos[q * 3 + 2] = oz * rad;
        nor[q * 3] = ox;
        nor[q * 3 + 1] = oy;
        nor[q * 3 + 2] = oz;
        tan[q * 3] = t3.x;
        tan[q * 3 + 1] = t3.y;
        tan[q * 3 + 2] = 0;
        surf[q * 2] = along;
        surf[q * 2 + 1] = s / SIDES;
      }
    }
    for (const k of ["position", "normal", "ropeTangent", "surf"])
      geometry.getAttribute(k).needsUpdate = true;
    // the tails
    for (let sl = 0; sl < TS; sl++) {
      const { gen } = baked.slots[sl];
      const o = (j * TS + sl) * TN;
      for (let q = 0; q < TN; q++) {
        const r = sl * TN + q;
        const a = Math.max(q - 1, 0),
          b = Math.min(q + 1, TN - 1);
        const px = baked.tx[o + q],
          py = baked.ty[o + q];
        t3.set(
          baked.tx[o + b] - baked.tx[o + a],
          baked.ty[o + b] - baked.ty[o + a],
          0,
        ).normalize();
        // a sheath is a shell, a little thinner than the rope it was; ragged at the loose end
        const fray = q >= TN - 4 ? 0.35 + 0.65 * ((TN - 1 - q) / 3) : 1;
        const rad = P.rope * Math.pow(P.S, gen) * z * 0.8 * fray;
        // in front of the rope it hangs from, so as not to pass through it
        const lift = P.rope * Math.pow(P.S, gen) * z * 0.6;
        const nx = -t3.y,
          ny = t3.x;
        for (let s2 = 0; s2 <= SIDES; s2++) {
          const v = r * (SIDES + 1) + s2;
          const ang = (s2 / SIDES) * Math.PI * 2;
          const cx = Math.cos(ang),
            sz = Math.sin(ang);
          const ok = Number.isFinite(px);
          tpos[v * 3] = ok ? px + nx * cx * rad : 0;
          tpos[v * 3 + 1] = ok ? py + ny * cx * rad : 0;
          tpos[v * 3 + 2] = ok ? sz * rad + lift : -50;
          tnor[v * 3] = nx * cx;
          tnor[v * 3 + 1] = ny * cx;
          tnor[v * 3 + 2] = sz;
          ttan[v * 3] = t3.x;
          ttan[v * 3 + 1] = t3.y;
          ttan[v * 3 + 2] = 0;
          tsurf[v * 2] = baked.tmat[o + q];
          tsurf[v * 2 + 1] = s2 / SIDES;
        }
      }
    }
    for (const k of ["position", "normal", "ropeTangent", "surf"])
      tailGeometry.getAttribute(k).needsUpdate = true;
    // the stone turns once a period, while it flies
    const ph = j / F;
    const spin = smooth((ph - 0.27) / 0.66) * Math.PI * 2;
    stone.position.set(0, baked.stone[j], 0);
    stone.rotation.set(0.4, spin * 0.35, -spin + 0.3);
  };
  const smooth = (t: number) =>
    t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10);

  const gui = new GUI({ title: "tension" });
  gui.close();
  for (const k of Object.keys(look) as (keyof typeof look)[]) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = look as any;
    const c =
      typeof look[k] === "string"
        ? gui.addColor(o, k)
        : gui.add(o, k, ...(ranges[k] as [number, number, number]));
    if (["fov", "dist", "lookY"].includes(k)) c.onChange(frameUp);
    else c.onChange(refresh);
  }
  const stats = new Stats();
  stats.dom.style.cssText = "position:fixed;top:0;left:0";
  canvas.after(stats.dom);

  const state = { hold: -1, frame: 0, pause: false };
  const rebake = () => {
    baked = bake();
  };
  Object.assign(window, {
    __tension: {
      look,
      state,
      refresh,
      frameUp,
      rebake,
      baked: () => baked,
      P,
      camera,
      controls,
      renderer,
      scene,
    },
  });
  console.log(
    `tension: one period of ${F} frames, ${baked.n} nodes, repeats to ${baked.off.toExponential(1)}`,
  );

  wrap.render = ({ playhead }) => {
    if (state.pause) return;
    const ph = state.hold >= 0 ? state.hold : playhead;
    const j = Math.floor(ph * F + 1e-6) % F;
    show(j);
    controls.update();
    U.frame.value = state.frame % 1024;
    pipeline.render();
    stats.update();
    state.frame++;
  };

  wrap.resize = ({ width, height }) => {
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  wrap.unload = () => {
    renderer.dispose();
    controls.dispose();
    gui.destroy();
    stats.dom.remove();
  };
};

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: P.T * 1000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
