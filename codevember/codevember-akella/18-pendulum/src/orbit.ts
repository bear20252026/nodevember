// 3. A double (orbit.html) or triple (triple.html) spherical pendulum on a relative periodic orbit: after one
//    period T the whole state comes back turned by dphi about the vertical (found by shooting,
//    tools/orbit-search.mjs and tools/chain-search.mjs). The eye circles at dphi / T, so in its frame the motion
//    closes; drag to look from elsewhere, it keeps circling. The room, the floor and the overhead light are the same
//    all the way round the vertical, so they close with it.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { attribute, cos, exp, float, Fn, mix, instanceIndex, normalLocal, sin, step, uniform, varying, vec3 } from "three/tsl";
import type { Node } from "three/webgpu";
import { BufferAttribute, BufferGeometry, Color, CylinderGeometry, Fog, InstancedMesh, Mesh, MeshStandardNodeMaterial, Object3D, SphereGeometry, Vector3 } from "three/webgpu";
import { blackSteel, brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

type Orbit = { T: number; dphi: number; E: number; samples: number; r: number[] };

// the page says which chain: <body data-orbits="triple.json" data-pivot="2.9" ...>
const page = document.body.dataset;
const PIVOT = +(page.pivot ?? 2.35);
const AIM = PIVOT - +(page.drop ?? 0.5); // the eye looks here

const look = {
  ...studioLook,
  orbit: +(page.orbit ?? 3),
  follow: true, // the eye circles with the orbit (the loop closes); off: it stays put and the knot turns
  periods: 2, // periods in a loop: the eye turns by the same angle each one
  speed: 1, // of time
  trail: 12, // periods of trail
  trailWidth: 0.008,
  taper: 0.6, // how the tube thins towards its tail
  trailGlow: 2.0,
  glowFall: 0.15, // of the trail's length
  oldMetal: 0.15, // brightness of the metal at the trail's tail
  depth: 0.55, // how much the far side of the knot sinks into the dark
  keyElevation: 90, // straight down: the same light from every side
  keyAzimuth: 0,
  key: 2.0,
  mirror: 0.45,
  back: "#15161b",
  envLight: 1.3,
  bloom: 0.35,
  bloomThreshold: 0.7,
  fov: 33,
  eyeDistance: +(page.distance ?? 6.0),
  eyeElevation: +(page.elevation ?? 6),
};

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const data = (await (await fetch(`./${page.orbits ?? "orbit.json"}`)).json()) as { params: { n?: number; m?: number[]; m1?: number; m2?: number }; orbits: Orbit[] };
  const N = data.params.n ?? 2; // bobs
  const masses = data.params.m ?? [data.params.m1!, data.params.m2!];
  const st = await createStage({ canvas, width, height, pixelRatio, name: "orbit", look, room: "ring", floorSize: 7 });
  const { scene, camera, controls } = st;
  st.aimKey(3.2, { x: 0, y: 1, z: 0 });

  // ---- the pendulum: a mount, N rods, N bobs
  const mount = new Mesh(new CylinderGeometry(0.03, 0.03, 0.9, 16), blackSteel());
  mount.position.y = PIVOT + 0.45;
  const cap = new Mesh(new SphereGeometry(0.045, 24, 12), brass());
  cap.position.y = PIVOT;
  scene.add(mount, cap);
  // per bob: the trail's light, its metal; the outermost is always the blue one
  const palette = N === 2 ? [["#ff9a45", "#e8b56a"], ["#5fb4ff", "#cfd8e4"]] : [["#ff9a45", "#e8b56a"], ["#ff4f7b", "#e7a3a0"], ["#5fb4ff", "#cfd8e4"]];
  const rods = new InstancedMesh(rodGeometry(12), chrome(0.12, "#c8cad0"), N);
  const bobs = new InstancedMesh(new SphereGeometry(1, 64, 32), chrome(0.1, "#ffffff"), N);
  const joints = new InstancedMesh(new SphereGeometry(0.03, 20, 10), brass(), N);
  for (let b = 0; b < N; b++) bobs.setColorAt(b, new Color(palette[b][1]).lerp(new Color("#ffffff"), 0.15));
  for (const m of [rods, bobs, joints, mount, cap]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }
  const radii = masses.map((m) => (N === 2 ? 0.115 : 0.095) * Math.cbrt(m / 1.3));

  // ---- trails: lit tubes, many periods long. The orbit repeats turned by dphi, so its whole past is one period's
  //      tube copied and turned k * dphi about the vertical. The tube for a period is built once (with a frame that
  //      twists nowhere and closes onto the next copy); each instance is one period back. Only the clock moves.
  const MAXP = 64; // periods of tube at most
  const clock = { k0: uniform(0), tLoc: uniform(0), T: uniform(1), turn: uniform(0), length: uniform(1), radius: uniform(look.trailWidth), taper: uniform(look.taper), glow: uniform(look.trailGlow), old: uniform(look.oldMetal), fall: uniform(look.glowFall) };
  const tube = (hex: string, metal: string) => {
    const mat = new MeshStandardNodeMaterial();
    mat.color.set(metal);
    mat.metalness = 1;
    mat.roughness = 0.22;
    const centre = attribute("centre", "vec3");
    const radial = attribute("radial", "vec3");
    const s = attribute("s", "float");
    const j = float(instanceIndex);
    // how long ago this ring was drawn, and the turn of its period
    const age = clock.tLoc.add(j.mul(clock.T)).sub(s);
    const ang = clock.k0.sub(j).mul(clock.turn);
    const turnY = (v: Node<"vec3">) => vec3(v.x.mul(cos(ang)).add(v.z.mul(sin(ang))), v.y, v.z.mul(cos(ang)).sub(v.x.mul(sin(ang))));
    mat.positionNode = Fn(() => {
      const a = age.div(clock.length);
      const alive = step(0, age).mul(step(a, 1));
      const r = clock.radius.mul(alive).mul(float(1).sub(a).clamp(0, 1).pow(clock.taper));
      const n = turnY(radial);
      normalLocal.assign(n);
      return turnY(centre).add(n.mul(r)).add(vec3(0, PIVOT, 0));
    })();
    const ageV = varying(age);
    // older loops tarnish: the metal dims along the tube, so the knot reads in layers of time
    mat.colorNode = vec3(...hexRGB(metal)).mul(mix(float(1), clock.old, ageV.div(clock.length).clamp(0, 1).pow(0.7)));
    const tint = vec3(...hexRGB(hex));
    // brightest where the bob has just been, dying to bare metal along the tube
    mat.emissiveNode = tint.mul(clock.glow).mul(exp(ageV.div(clock.length).negate().div(clock.fall)).mul(0.92).add(0.08));
    const mesh = new InstancedMesh(new BufferGeometry(), mat, MAXP);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  };
  const tubes = palette.map(([light, metal]) => tube(light, metal));

  // one period of each bob's path as a tube: rotation-minimising frame (double reflection), its leftover twist
  // spread along the period so the last ring is the first turned by dphi
  const SIDES = 8;
  const buildTubes = () => {
    const { dphi, samples: n, r } = orbit;
    const c = Math.cos(dphi), sn = Math.sin(dphi);
    const turnD = (v: number[], sign = 1) => [c * v[0] + sign * sn * v[2], v[1], -sign * sn * v[0] + c * v[2]];
    const w = 3 * N;
    for (let b = 0; b < N; b++) {
      const at = (i: number): number[] => {
        if (i < 0) return turnD(at(i + n), -1);
        if (i >= n) return turnD(at(i - n));
        return [r[w * i + 3 * b], r[w * i + 3 * b + 1], r[w * i + 3 * b + 2]];
      };
      const X: number[][] = [];
      const Tg: number[][] = [];
      for (let i = 0; i <= n; i++) {
        X.push(at(i));
        Tg.push(nrm(sub(at(i + 1), at(i - 1))));
      }
      const R: number[][] = [nrm(cross(Tg[0], Math.abs(Tg[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]))];
      for (let i = 0; i < n; i++) {
        const v1 = sub(X[i + 1], X[i]);
        const c1 = dot(v1, v1) || 1e-12;
        const rL = sub(R[i], mul(v1, (2 / c1) * dot(v1, R[i])));
        const tL = sub(Tg[i], mul(v1, (2 / c1) * dot(v1, Tg[i])));
        const v2 = sub(Tg[i + 1], tL);
        const c2 = dot(v2, v2);
        R.push(nrm(c2 < 1e-14 ? rL : sub(rL, mul(v2, (2 / c2) * dot(v2, rL)))));
      }
      const want = turnD(R[0]);
      const theta = Math.atan2(dot(cross(R[n], want), Tg[n]), dot(R[n], want));
      const centre = new Float32Array((n + 1) * SIDES * 3);
      const radial = new Float32Array((n + 1) * SIDES * 3);
      const s = new Float32Array((n + 1) * SIDES);
      for (let i = 0; i <= n; i++) {
        const tw = (theta * i) / n;
        const ri = add(mul(R[i], Math.cos(tw)), mul(cross(Tg[i], R[i]), Math.sin(tw)));
        const bi = cross(Tg[i], ri);
        for (let k = 0; k < SIDES; k++) {
          const a = (k / SIDES) * Math.PI * 2;
          const d = add(mul(ri, Math.cos(a)), mul(bi, Math.sin(a)));
          const o = i * SIDES + k;
          centre.set(X[i], 3 * o);
          radial.set(d, 3 * o);
          s[o] = (i / n) * orbit.T;
        }
      }
      const index: number[] = [];
      for (let i = 0; i < n; i++)
        for (let k = 0; k < SIDES; k++) {
          const a = i * SIDES + k, b2 = i * SIDES + ((k + 1) % SIDES);
          index.push(a, a + SIDES, b2, b2, a + SIDES, b2 + SIDES);
        }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(centre.slice(), 3));
      g.setAttribute("centre", new BufferAttribute(centre, 3));
      g.setAttribute("radial", new BufferAttribute(radial, 3));
      g.setAttribute("normal", new BufferAttribute(radial.slice(), 3));
      g.setAttribute("s", new BufferAttribute(s, 1));
      g.setIndex(index);
      tubes[b].geometry.dispose();
      tubes[b].geometry = g;
    }
  };

  // ---- the orbit as a function of time: samples over one period, turned by dphi for each period away
  let orbit = data.orbits[look.orbit];
  buildTubes();
  const sampleAt = (t: number, outs: Vector3[]) => {
    const { T, dphi, samples: n, r } = orbit;
    const k = Math.floor(t / T);
    const u = ((t - k * T) / T) * n;
    const i = Math.floor(u);
    const f = u - i;
    const j0 = (i % n) * 3 * N;
    const j1 = ((i + 1) % n) * 3 * N;
    const turn1 = i + 1 >= n ? dphi : 0; // the sample after the last is the first, turned once
    for (let b = 0; b < N; b++) {
      const out = outs[b];
      const a0 = new Vector3(r[j0 + 3 * b], r[j0 + 3 * b + 1], r[j0 + 3 * b + 2]);
      const a1 = new Vector3(r[j1 + 3 * b], r[j1 + 3 * b + 1], r[j1 + 3 * b + 2]).applyAxisAngle(Y, turn1);
      out.copy(a0).lerp(a1, f).applyAxisAngle(Y, k * dphi);
    }
  };
  const Y = new Vector3(0, 1, 0);
  // the turn the eye makes in one period: dphi less whole turns, the smallest that closes
  const eyeTurn = () => {
    const d = orbit.dphi;
    return d - 2 * Math.PI * Math.round(d / (2 * Math.PI));
  };

  const at = new Object3D();
  const up = new Vector3(0, 1, 0);
  const ps = Array.from({ length: N }, () => new Vector3());
  const pivot = new Vector3(0, PIVOT, 0);
  const segment = (i: number, a: Vector3, b: Vector3, r: number) => {
    // a rod from a to b
    const d = new Vector3().subVectors(b, a);
    at.position.copy(a);
    at.quaternion.setFromUnitVectors(up, d.clone().normalize());
    at.scale.set(r, d.length(), r);
    at.updateMatrix();
    rods.setMatrixAt(i, at.matrix);
  };
  const ball = (i: number, p: Vector3, r: number) => {
    at.position.copy(p);
    at.quaternion.identity();
    at.scale.setScalar(r);
    at.updateMatrix();
    bobs.setMatrixAt(i, at.matrix);
  };

  let tLast: number | null = null;
  const reach = 0.32 * N + 1.2; // about the knot's radius
  const pose = (phase: number) => {
    const t = phase * look.periods * orbit.T;
    sampleAt(t, ps);
    let prev = pivot;
    for (let b = 0; b < N; b++) {
      ps[b].add(pivot);
      segment(b, prev, ps[b], 0.007 - 0.001 * b);
      ball(b, ps[b], radii[b]);
      at.position.copy(prev);
      at.scale.setScalar(b ? 1 : 0.001); // a joint at every rod's top but the first (the cap is there)
      at.updateMatrix();
      joints.setMatrixAt(b, at.matrix);
      prev = ps[b];
    }
    for (const m of [rods, bobs, joints]) m.instanceMatrix.needsUpdate = true;
    // the eye: wherever it was dragged, turned on about the vertical as the orbit turns. At the loop's wrap the
    // state jumps back by periods * dphi and the eye by the same turn, so the view goes on unbroken
    if (look.follow && tLast !== null) {
      const d = (eyeTurn() * (t - tLast)) / orbit.T;
      camera.position.applyAxisAngle(Y, d);
      controls.target.applyAxisAngle(Y, d);
    }
    tLast = t;
    // depth: the far side of the knot sinks into the dark (fog by distance from the eye)
    const fog = scene.fog as Fog;
    const dist = camera.position.distanceTo(new Vector3(0, AIM, 0));
    fog.near = dist - reach;
    fog.far = fog.near + (2 * reach) / Math.max(0.05, look.depth); // the knot's far side sinks by about `depth`
    // trails: the clock, counted from the start of the current period
    const k0 = Math.floor(t / orbit.T);
    const L = look.trail * orbit.T;
    clock.k0.value = k0;
    clock.tLoc.value = t - k0 * orbit.T;
    clock.T.value = orbit.T;
    clock.turn.value = orbit.dphi - 2 * Math.PI * Math.round(orbit.dphi / (2 * Math.PI)); // the same turn, less whole turns
    clock.length.value = L;
    for (const m of tubes) m.count = Math.min(MAXP, Math.ceil(L / orbit.T) + 1);
  };

  scene.fog = new Fog(new Color(look.back), 1, 100);
  // the eye's starting place (also "reset view"); after that it is the user's
  const frameUp = () => {
    camera.fov = look.fov;
    camera.updateProjectionMatrix();
    const el = (look.eyeElevation * Math.PI) / 180;
    const turn = tLast === null ? 0 : (eyeTurn() * tLast) / orbit.T;
    controls.target.set(0, AIM, 0);
    camera.position.set(0, Math.sin(el), Math.cos(el)).multiplyScalar(look.eyeDistance).applyAxisAngle(Y, turn).add(controls.target);
    controls.update();
  };
  frameUp();

  const of = st.gui.addFolder("orbit");
  const setOrbit = (i: number) => {
    look.orbit = i;
    orbit = data.orbits[i];
    tLast = null;
    buildTubes();
    st.gui.controllersRecursive().forEach((c) => c.updateDisplay());
  };
  of.add(look, "orbit", 0, data.orbits.length - 1, 1).onChange(() => {
    setOrbit(look.orbit);
    console.log(`pendulum: orbit ${look.orbit}, T ${orbit.T.toFixed(3)} s, turn ${((orbit.dphi * 180) / Math.PI).toFixed(1)} deg`);
  });
  of.add(look, "periods", 1, 6, 1);
  of.add(look, "trail", 0.1, MAXP - 1, 0.1).name("trail (periods)");
  of.add(look, "trailWidth", 0.001, 0.04, 0.0005).onChange((v: number) => (clock.radius.value = v));
  of.add(look, "taper", 0, 3, 0.01).onChange((v: number) => (clock.taper.value = v));
  of.add(look, "trailGlow", 0, 8, 0.01).onChange((v: number) => (clock.glow.value = v));
  of.add(look, "glowFall", 0.01, 1, 0.01).onChange((v: number) => (clock.fall.value = v));
  of.add(look, "oldMetal", 0, 1, 0.01).onChange((v: number) => (clock.old.value = v));
  of.add(look, "depth", 0, 1, 0.01);
  of.add(look, "follow").name("eye circles with it");
  of.add(look, "fov", 15, 70, 1).onChange(() => {
    camera.fov = look.fov;
    camera.updateProjectionMatrix();
  });
  of.add(look, "eyeDistance", 2, 16, 0.05).onChange(frameUp);
  of.add(look, "eyeElevation", -20, 80, 1).onChange(frameUp);
  of.add({ reset: frameUp }, "reset").name("reset view");
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, data, setOrbit, get orbit() { return orbit; } } });

  // the loop's length is periods * T; play by our own clock
  const t0 = performance.now();
  wrap.render = () => {
    const L = look.periods * orbit.T;
    const phase = st.state.hold >= 0 ? st.state.hold : (((performance.now() - t0) / 1000) * look.speed / L) % 1;
    pose(phase);
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => st.renderer.dispose();
};

type V = number[];
const add = (a: V, b: V) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V, b: V) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V, k: number) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const nrm = (a: V) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

function hexRGB(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  // linear
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => (c / 255) ** 2.2) as [number, number, number];
}

const settings: SketchSettings = {
  mode: "webgpu",
  pixelRatio: window.devicePixelRatio,
  animate: true,
  duration: 12_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
