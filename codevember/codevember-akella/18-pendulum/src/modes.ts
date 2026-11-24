// 2. A hanging mobile of pendulums tied by fine springs, moving in its normal modes. The structure is a tree of
//    rigid bodies, each tilting two ways about its pivot. M and K come straight from exact forward kinematics
//    (K is the Hessian of gravity plus springs at rest, M = sum m J^T J), then K v = w^2 M v gives the modes.
//    One branch is pulled aside and let go; that start is projected on the modes, and each mode's frequency is
//    rounded to a whole number of swings in the loop, so the motion spreads through the structure and gathers
//    back into the pulled branch exactly as the loop ends.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { CatmullRomCurve3, CylinderGeometry, InstancedMesh, Mesh, Object3D, SphereGeometry, TubeGeometry, Vector3 } from "three/webgpu";
import { generalizedEigen } from "./linalg.ts";
import { blackSteel, brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

const G = 9.81;

const look = {
  ...studioLook,
  pull: 0.45, // radians the plucked branch is pulled out
  branch: 0, // which of the three is plucked
  keep: 8, // modes kept, by the share of the motion they carry
  coupling: 2.2, // spring stiffness between the branches
  key: 2.4,
  keyAzimuth: -30,
  keyElevation: 60,
  mirror: 0.3,
  fov: 31,
};

type V = [number, number, number];
type Body = {
  parent: number;
  pivot: V; // where it hangs, at rest
  hub: V; // the end of its rod
  tips: V[]; // arm ends (children hang from these)
  points: { p: V; m: number }[];
  kind: "root" | "bar" | "bob" | "tail";
  radius: number; // of the bob or hub drawn
  branch: number;
};

function buildMobile() {
  const bodies: Body[] = [];
  const add = (b: Body) => bodies.push(b) - 1;
  const BR = 5; // branches off the root
  const BOB = [1.0, 0.55, 1.35, 0.75, 0.65, 1.15, 0.9, 0.5, 1.2, 0.7];
  const ROD3 = [0.78, 0.55, 0.95, 0.62, 0.7, 0.86, 0.66, 0.9, 0.58, 0.8];
  const TAIL = 0.17;
  const TAIL_ROD = 0.3;
  const TIP = 0.03; // a bar end's own mass
  const ROD = 0.02; // a rod's mass, at its middle
  const top: V = [0, 3.55, 0];
  const rootHub: V = [0, 2.85, 0];
  // weights first, from the bottom up: tier 3 is a bob on a rod with its tail
  const w3 = BOB.map((m) => m + TAIL + 2 * ROD);
  const w2 = Array.from({ length: BR }, (_, i) => i).map((b) => w3[2 * b] + w3[2 * b + 1] + 2 * TIP + 0.3 + ROD);
  // the root's arms balance: r_i (w_i + TIP) is the same for all three
  const meanR = 1.15;
  const inv = w2.map((w) => 1 / (w + TIP));
  const C = (BR * meanR) / inv.reduce((a, b) => a + b, 0);
  const rootTips: V[] = w2.map((w, b) => {
    const a = Math.PI / 2 + (b * 2 * Math.PI) / BR;
    const r = C / (w + TIP);
    return [r * Math.cos(a), rootHub[1] - 0.06, r * Math.sin(a)];
  });
  const root = add({
    parent: -1,
    pivot: top,
    hub: rootHub,
    tips: rootTips,
    points: [{ p: rootHub, m: 0.6 }, { p: [0, (top[1] + rootHub[1]) / 2, 0], m: ROD }, ...rootTips.map((p) => ({ p, m: TIP }))],
    kind: "root",
    radius: 0.06,
    branch: -1,
  });
  for (let b = 0; b < BR; b++) {
    const pivot = rootTips[b];
    const hub: V = [pivot[0], pivot[1] - 0.55, pivot[2]];
    // the bar lies across the root arm; its two arms balance the two bobs below
    const radial = new Vector3(pivot[0], 0, pivot[2]).normalize();
    const across = new Vector3(-radial.z, 0, radial.x);
    const S = 0.84;
    const wl = w3[2 * b] + TIP;
    const wr = w3[2 * b + 1] + TIP;
    const al = (S * wr) / (wl + wr);
    const ar = (S * wl) / (wl + wr);
    const tl: V = [hub[0] - across.x * al, hub[1] - 0.03, hub[2] - across.z * al];
    const tr: V = [hub[0] + across.x * ar, hub[1] - 0.03, hub[2] + across.z * ar];
    const bar = add({
      parent: root,
      pivot,
      hub,
      tips: [tl, tr],
      points: [{ p: hub, m: 0.3 }, { p: [pivot[0], pivot[1] - 0.27, pivot[2]], m: ROD }, { p: tl, m: TIP }, { p: tr, m: TIP }],
      kind: "bar",
      radius: 0.035,
      branch: b,
    });
    for (const [side, tip] of [tl, tr].entries()) {
      const i = 2 * b + side;
      const bobAt: V = [tip[0], tip[1] - ROD3[i], tip[2]];
      const bob = add({
        parent: bar,
        pivot: tip,
        hub: bobAt,
        tips: [bobAt],
        points: [{ p: bobAt, m: BOB[i] }, { p: [tip[0], tip[1] - ROD3[i] / 2, tip[2]], m: ROD }],
        kind: "bob",
        radius: 0.085 * Math.cbrt(BOB[i]),
        branch: b,
      });
      const tailAt: V = [bobAt[0], bobAt[1] - TAIL_ROD, bobAt[2]];
      add({
        parent: bob,
        pivot: bobAt,
        hub: tailAt,
        tips: [],
        points: [{ p: tailAt, m: TAIL }, { p: [bobAt[0], bobAt[1] - TAIL_ROD / 2, bobAt[2]], m: ROD }],
        kind: "tail",
        radius: 0.085 * Math.cbrt(TAIL),
        branch: b,
      });
    }
  }
  // springs: each bob to the nearest bob of the next branch, and the bars' hubs round the ring
  const bobs = bodies.map((b, i) => [b, i] as const).filter(([b]) => b.kind === "bob");
  const bars = bodies.map((b, i) => [b, i] as const).filter(([b]) => b.kind === "bar");
  const springs: { a: number; b: number; pa: V; pb: V; scale: number }[] = [];
  for (let b = 0; b < BR; b++) {
    const [ra, ia] = bobs[2 * b + 1];
    const [rb, ib] = bobs[2 * ((b + 1) % BR)];
    springs.push({ a: ia, b: ib, pa: ra.hub, pb: rb.hub, scale: 1 });
    const [ha, ja] = bars[b];
    const [hb, jb] = bars[(b + 1) % BR];
    springs.push({ a: ja, b: jb, pa: ha.hub, pb: hb.hub, scale: 0.5 });
  }
  return { bodies, springs };
}

// ---- kinematics: each body turns by a tilt (x, z) about its pivot, on top of its parent's turn
type Pose = { R: Float64Array[]; P: Float64Array[] }; // per body: 3x3 turn, pivot in the world

function tiltMatrix(x: number, z: number, out: Float64Array) {
  const a = Math.hypot(x, z);
  if (a < 1e-12) {
    out.set([1, 0, 0, 0, 1, 0, 0, 0, 1]);
    return out;
  }
  const kx = x / a;
  const kz = z / a;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  // Rodrigues with axis (kx, 0, kz)
  out[0] = c + t * kx * kx;
  out[1] = -s * kz;
  out[2] = t * kx * kz;
  out[3] = s * kz;
  out[4] = c;
  out[5] = -s * kx;
  out[6] = t * kx * kz;
  out[7] = s * kx;
  out[8] = c + t * kz * kz;
  return out;
}
const mul3 = (A: Float64Array, B: Float64Array, out: Float64Array) => {
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) out[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return out;
};

function makeKinematics(bodies: Body[]) {
  const n = bodies.length;
  const pose: Pose = { R: bodies.map(() => new Float64Array(9)), P: bodies.map(() => new Float64Array(3)) };
  const tmp = new Float64Array(9);
  const solve = (q: ArrayLike<number>) => {
    for (let k = 0; k < n; k++) {
      const b = bodies[k];
      tiltMatrix(q[2 * k], q[2 * k + 1], tmp);
      if (b.parent < 0) {
        pose.R[k].set(tmp);
        pose.P[k].set(b.pivot);
      } else {
        const R = pose.R[b.parent];
        const pp = bodies[b.parent].pivot;
        const P = pose.P[b.parent];
        const d = [b.pivot[0] - pp[0], b.pivot[1] - pp[1], b.pivot[2] - pp[2]];
        for (let i = 0; i < 3; i++) pose.P[k][i] = P[i] + R[i * 3] * d[0] + R[i * 3 + 1] * d[1] + R[i * 3 + 2] * d[2];
        mul3(R, tmp, pose.R[k]);
      }
    }
    return pose;
  };
  // where a body's rest point is now
  const place = (k: number, p: V, out: number[] | Float64Array = [0, 0, 0]) => {
    const R = pose.R[k];
    const P = pose.P[k];
    const pv = bodies[k].pivot;
    const d0 = p[0] - pv[0];
    const d1 = p[1] - pv[1];
    const d2 = p[2] - pv[2];
    for (let i = 0; i < 3; i++) out[i] = P[i] + R[i * 3] * d0 + R[i * 3 + 1] * d1 + R[i * 3 + 2] * d2;
    return out;
  };
  return { solve, place, pose };
}

function analyse(coupling: number) {
  const { bodies, springs } = buildMobile();
  const kin = makeKinematics(bodies);
  const n = bodies.length * 2;
  const rest = springs.map((s) => Math.hypot(s.pa[0] - s.pb[0], s.pa[1] - s.pb[1], s.pa[2] - s.pb[2]));
  const pa = [0, 0, 0];
  const pb = [0, 0, 0];
  const energy = (q: Float64Array) => {
    kin.solve(q);
    let V = 0;
    for (const [k, b] of bodies.entries()) for (const { p, m } of b.points) V += m * G * kin.place(k, p, pa)[1];
    for (const [i, s] of springs.entries()) {
      kin.place(s.a, s.pa, pa);
      kin.place(s.b, s.pb, pb);
      const L = Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]);
      V += 0.5 * coupling * s.scale * (L - rest[i]) ** 2;
    }
    return V;
  };
  const h = 1e-4;
  const q = new Float64Array(n);
  const K = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i; j < n; j++) {
      let v = 0;
      for (const [si, sj, w] of [
        [1, 1, 1],
        [1, -1, -1],
        [-1, 1, -1],
        [-1, -1, 1],
      ]) {
        q.fill(0);
        q[i] += si * h;
        q[j] += sj * h;
        v += w * energy(q);
      }
      K[i * n + j] = K[j * n + i] = v / (4 * h * h);
    }
  const M = new Float64Array(n * n);
  const J: Float64Array[] = []; // per point: 3 x n
  const masses: number[] = [];
  for (const [k, b] of bodies.entries())
    for (const { p, m } of b.points) {
      const Jp = new Float64Array(3 * n);
      for (let i = 0; i < n; i++) {
        q.fill(0);
        q[i] = h;
        kin.solve(q);
        const a = kin.place(k, p, [0, 0, 0]);
        q[i] = -h;
        kin.solve(q);
        const c = kin.place(k, p, [0, 0, 0]);
        for (let d = 0; d < 3; d++) Jp[d * n + i] = (a[d] - c[d]) / (2 * h);
      }
      J.push(Jp);
      masses.push(m);
    }
  for (const [pi, Jp] of J.entries())
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        let s = 0;
        for (let d = 0; d < 3; d++) s += Jp[d * n + i] * Jp[d * n + j];
        M[i * n + j] += masses[pi] * s;
      }
  const { values, vectors } = generalizedEigen(K, M, n);
  return { bodies, springs, kin, n, M, omegas: values.map((v) => Math.sqrt(Math.max(v, 0))), vectors };
}

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "modes", look, floorSize: 8 });
  const { scene, camera, controls } = st;
  st.aimKey(3.5, { x: 0, y: 1.8, z: 0 });

  let mobile = analyse(look.coupling);
  const { bodies, springs } = mobile;

  // ---- the motion: pluck, project, keep, round
  const motion = { c: [] as number[], n: [] as number[], kept: [] as number[], T: 30 };
  const plan = () => {
    const { n, M, omegas, vectors } = mobile;
    const q0 = new Float64Array(n);
    for (const [k, b] of bodies.entries()) {
      if (b.branch !== look.branch) continue;
      const radial = new Vector3(b.hub[0], 0, b.hub[2]).normalize();
      // tilting about axis (x, z) swings the far end along (z, -x)... pull the branch outward
      const pull = b.kind === "bar" ? 0.35 : b.kind === "bob" ? 1 : 0.6;
      // a tilt about x moves a hanging point towards -z... about z towards +x: so outward = (-radial.z, radial.x)
      q0[2 * k] = -radial.z * look.pull * pull;
      q0[2 * k + 1] = radial.x * look.pull * pull;
    }
    const c = vectors.map((v) => {
      let s = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += v[i] * M[i * n + j] * q0[j];
      return s;
    });
    const share = c.map((ci, j) => ci * ci * omegas[j] * omegas[j]);
    const order = share.map((_, j) => j).sort((a, b) => share[b] - share[a]);
    const kept = order.slice(0, Math.max(1, Math.min(look.keep, n)));
    // the loop length that bends the kept frequencies least
    let best = { T: 30, err: Infinity };
    for (let T = 22; T <= 40; T += 0.005) {
      let err = 0;
      for (const j of kept) {
        const f = (omegas[j] * T) / (2 * Math.PI);
        err += share[j] * ((f - Math.round(f)) / T) ** 2;
      }
      if (err < best.err) best = { T, err };
    }
    motion.T = best.T;
    motion.kept = kept;
    motion.c = c;
    motion.n = omegas.map((w) => Math.max(1, Math.round((w * best.T) / (2 * Math.PI))));
    console.log(
      `pendulum: loop ${best.T.toFixed(2)} s, modes ${kept.map((j) => `${(omegas[j] / (2 * Math.PI)).toFixed(3)}Hz->${motion.n[j]}`).join(" ")}`,
    );
  };
  plan();

  // ---- what is drawn
  const steel = chrome(0.1, "#d4d6da");
  const rods = new InstancedMesh(rodGeometry(8), steel, 64);
  const bars = new InstancedMesh(rodGeometry(12), brass({ rough: 0.18 }), 32);
  const balls = new InstancedMesh(new SphereGeometry(1, 48, 24), chrome(0.04, "#f1efe9"), 32);
  const hubs = new InstancedMesh(new SphereGeometry(1, 24, 12), brass({ rough: 0.2 }), 32);
  const coilPts: Vector3[] = [];
  for (let i = 0; i <= 200; i++) {
    const s = i / 200;
    const a = s * 14 * Math.PI * 2;
    coilPts.push(new Vector3(0.016 * Math.cos(a), s, 0.016 * Math.sin(a)));
  }
  const coils = new InstancedMesh(new TubeGeometry(new CatmullRomCurve3(coilPts), 600, 0.0026, 5, false), brass({ rough: 0.25, color: "#e0aa5c" }), springs.length);
  for (const m of [rods, bars, balls, hubs, coils]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }
  const mount = new Mesh(new CylinderGeometry(0.16, 0.2, 0.06, 32), blackSteel());
  mount.position.set(0, bodies[0].pivot[1] + 0.03, 0);
  scene.add(mount);

  const at = new Object3D();
  const up = new Vector3(0, 1, 0);
  const A = new Vector3();
  const B = new Vector3();
  const segment = (mesh: InstancedMesh, i: number, a: Vector3, b: Vector3, r: number) => {
    const d = B.copy(b).sub(a);
    const len = d.length();
    at.position.copy(a);
    at.quaternion.setFromUnitVectors(up, d.divideScalar(len || 1));
    at.scale.set(r, len, r);
    at.updateMatrix();
    mesh.setMatrixAt(i, at.matrix);
  };
  const ball = (mesh: InstancedMesh, i: number, p: Vector3, r: number) => {
    at.position.copy(p);
    at.quaternion.identity();
    at.scale.setScalar(r);
    at.updateMatrix();
    mesh.setMatrixAt(i, at.matrix);
  };

  const q = new Float64Array(mobile.n);
  const tmp = [0, 0, 0];
  const pose = (phase: number) => {
    const { n, vectors, kin } = mobile;
    q.fill(0);
    for (const j of motion.kept) {
      const w = Math.cos(2 * Math.PI * motion.n[j] * phase) * motion.c[j];
      const v = vectors[j];
      for (let i = 0; i < n; i++) q[i] += w * v[i];
    }
    kin.solve(q);
    const p = (k: number, x: V) => new Vector3().fromArray(kin.place(k, x, tmp));
    let r = 0;
    let s = 0;
    let bb = 0;
    let h = 0;
    for (const [k, b] of bodies.entries()) {
      const pivot = new Vector3().fromArray(kin.pose.P[k]);
      const hub = p(k, b.hub);
      segment(rods, r++, pivot, hub, b.kind === "tail" ? 0.0028 : 0.004);
      if (b.kind === "root" || b.kind === "bar") {
        for (const t of b.tips) segment(bars, s++, hub, p(k, t), b.kind === "root" ? 0.012 : 0.008);
        ball(hubs, h++, hub, b.radius);
      } else ball(balls, bb++, hub, b.radius);
    }
    for (const [i, sp] of springs.entries()) {
      A.fromArray(kin.place(sp.a, sp.pa, tmp));
      const a = A.clone();
      B.fromArray(kin.place(sp.b, sp.pb, tmp));
      const b = B.clone();
      segment(coils, i, a, b, sp.scale < 1 ? 0.7 : 1);
    }
    rods.count = r;
    bars.count = s;
    balls.count = bb;
    hubs.count = h;
    for (const m of [rods, bars, balls, hubs, coils]) m.instanceMatrix.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    camera.position.set(1.4, 1.35, 6.0);
    controls.target.set(0, 1.9, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const mf = st.gui.addFolder("modes");
  mf.add(look, "branch", 0, 4, 1).onChange(plan);
  mf.add(look, "pull", 0, 0.8, 0.01).onChange(plan);
  mf.add(look, "keep", 1, mobile.n, 1).onChange(plan);
  mf.add(look, "coupling", 0, 20, 0.1).onChange(() => {
    mobile = analyse(look.coupling);
    plan();
  });
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, motion, get mobile() { return mobile; } } });

  // the loop's length is the one the modes chose: play by our own clock, not ssam's duration
  const t0 = performance.now();
  wrap.render = () => {
    const phase = st.state.hold >= 0 ? st.state.hold : (((performance.now() - t0) / 1000 / motion.T) % 1);
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
  duration: 30_000,
  exportFps: 60,
  framesFormat: ["webm"],
};

ssam(sketch, settings);
