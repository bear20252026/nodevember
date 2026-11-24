// 6. Two hanging platforms of identical metronomes, joined by a spring: one platform ticks as one, the other argues
//    with itself, after the mechanical chimera of Martens et al. (PNAS 2013). This is a choreography, not a
//    simulation: such disorder never closes into a loop. Each drifting metronome follows the closed form of
//    Adler's equation, psi' = D - K sin psi (lingering near the beat, then slipping a whole cycle), with D and K
//    chosen so it slips a whole number of times a loop. The platforms move as momentum asks: against the sum of
//    their own metronomes' swings, plus a share of the other's through the spring.
import type { Sketch, SketchSettings } from "ssam";
import { ssam } from "ssam";
import { BoxGeometry, CatmullRomCurve3, Color, CylinderGeometry, InstancedMesh, Mesh, MeshPhysicalNodeMaterial, MeshStandardNodeMaterial, Object3D, Quaternion, SphereGeometry, TubeGeometry, Vector3 } from "three/webgpu";
import { blackSteel, brass, chrome, createStage, rodGeometry, studioLook } from "./stage.ts";

const LOOP = 24; // seconds
const BEATS = 30; // swings of the beat in a loop
const COLS = 4;
const ROWS = 3;
const PER = COLS * ROWS;
const HANG = 2.9; // beam height
const DECK = 1.0; // platform height

const look = {
  ...studioLook,
  swing: 0.62, // metronome amplitude, radians
  sway: 0.05, // platform travel per unit of summed swing
  share: 0.18, // of the other platform's push, through the spring
  sound: false,
  key: 2.5,
  keyAzimuth: 25,
  keyElevation: 55,
  mirror: 0.3,
  exposure: 1.25,
  fov: 34,
};

// psi(t) for psi' = D - K sin psi, with w = sqrt(D^2 - K^2) set by the slips a loop, unwrapped
function adler(t: number, w: number, r: number, t0: number) {
  const D = w / Math.sqrt(1 - r * r);
  const K = r * D;
  const u = (w * (t - t0)) / 2;
  const m = Math.round(u / Math.PI);
  return 2 * Math.atan((K + w * Math.tan(u - m * Math.PI)) / D) + 2 * Math.PI * m;
}

type Beat = { slips: number; r: number; t0: number; offset: number; wobble: number; wf: number; wp: number };

function choreograph(): Beat[][] {
  let seed = 9;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const together: Beat[] = Array.from({ length: PER }, () => ({ slips: 0, r: 0, t0: 0, offset: 0, wobble: 0, wf: 0, wp: 0 }));
  const slips = [1, -1, 2, -2, 3, 1, -1, 0, 2, -3, 1, -2];
  const apart: Beat[] = slips.map((s) => ({
    slips: s,
    r: 0.45 + rnd() * 0.5, // near 1: long lingering near the beat, then a quick slip
    t0: rnd() * LOOP,
    offset: (rnd() - 0.5) * 1.2,
    wobble: s === 0 ? 0.5 : 0.12, // a held one still drifts about a little
    wf: 1 + Math.floor(rnd() * 3),
    wp: rnd() * 6.28,
  }));
  for (let i = apart.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [apart[i], apart[j]] = [apart[j], apart[i]];
  }
  return [together, apart];
}

const sketch: Sketch<"webgpu"> = async ({ wrap, canvas, width, height, pixelRatio }) => {
  if (import.meta.hot) {
    import.meta.hot.dispose(() => wrap.dispose());
    import.meta.hot.accept(() => wrap.hotReload());
  }
  const st = await createStage({ canvas, width, height, pixelRatio, name: "chimera", look, floorSize: 7 });
  const { scene, camera, controls } = st;
  st.aimKey(3.0, { x: 0, y: 1.3, z: 0 });
  const beats = choreograph();

  // ---- frame: a beam on two posts
  const dark = blackSteel();
  const beam = new Mesh(new BoxGeometry(4.4, 0.08, 0.08), dark);
  beam.position.y = HANG;
  scene.add(beam);
  for (const s of [-1, 1]) {
    const post = new Mesh(new BoxGeometry(0.08, HANG + 0.04, 0.08), dark);
    post.position.set(s * 2.2, (HANG + 0.04) / 2, 0);
    const foot = new Mesh(new BoxGeometry(0.1, 0.04, 1.0), dark);
    foot.position.set(s * 2.2, 0.02, 0);
    scene.add(post, foot);
  }

  // ---- platforms
  const W = 0.95;
  const Dp = 0.7;
  const wood = new MeshStandardNodeMaterial({ color: new Color("#2a2a2e"), roughness: 0.35, metalness: 0.6 });
  const decks = [-1, 1].map((s) => {
    const deck = new Mesh(new BoxGeometry(W, 0.045, Dp), wood);
    deck.position.set(s * 1.05, DECK, 0);
    const rim = new Mesh(new BoxGeometry(W + 0.02, 0.012, Dp + 0.02), brass({ rough: 0.3 }));
    rim.position.y = 0.028;
    deck.add(rim);
    scene.add(deck);
    return deck;
  });
  const cables = new InstancedMesh(rodGeometry(6), chrome(0.2), 8);

  // ---- metronomes: black lacquered pyramids, a brass rod on a pivot near the foot, a sliding weight
  const bodyGeo = new CylinderGeometry(0.03, 0.085, 0.24, 4, 1);
  bodyGeo.rotateY(Math.PI / 4);
  bodyGeo.translate(0, 0.12, 0);
  const lacquer = new MeshPhysicalNodeMaterial({ color: new Color("#5a321b"), roughness: 0.4, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 });
  const bodies = new InstancedMesh(bodyGeo, lacquer, 2 * PER);
  const rods = new InstancedMesh(rodGeometry(6), brass({ rough: 0.2 }), 2 * PER);
  const weightGeo = new CylinderGeometry(0.022, 0.022, 0.03, 20);
  const weights = new InstancedMesh(weightGeo, brass({ rough: 0.15, color: "#e6bf7a" }), 2 * PER);
  const pins = new InstancedMesh(new SphereGeometry(0.008, 10, 6), chrome(0.1), 2 * PER);
  // spring between the platforms
  const pts: Vector3[] = [];
  for (let i = 0; i <= 300; i++) {
    const s = i / 300;
    const a = s * 18 * Math.PI * 2;
    const c = Math.min(1, Math.min(s, 1 - s) / 0.05);
    pts.push(new Vector3(s, 0.022 * c * Math.cos(a), 0.022 * c * Math.sin(a)));
  }
  const spring = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 900, 0.003, 6, false), chrome(0.18, "#d0d4da"));
  for (const m of [cables, bodies, rods, weights, pins, spring, ...decks, beam]) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    scene.add(m);
  }

  // where each metronome stands on its deck
  const spots = Array.from({ length: PER }, (_, k) => {
    const c = k % COLS;
    const r = Math.floor(k / COLS);
    return new Vector3((c - (COLS - 1) / 2) * 0.22, 0.0225, (r - (ROWS - 1) / 2) * 0.2);
  });

  // ---- sound: a click when a rod passes the middle (off until asked: browsers need a gesture)
  let audio: AudioContext | null = null;
  const click = (gain: number, pitch: number) => {
    if (!audio) return;
    const t = audio.currentTime;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "square";
    o.frequency.value = pitch;
    g.gain.setValueAtTime(Math.min(0.4, gain), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g).connect(audio.destination);
    o.start(t);
    o.stop(t + 0.04);
  };
  const lastSide = new Float32Array(2 * PER);

  const at = new Object3D();
  const Z = new Vector3(0, 0, 1);
  const up = new Vector3(0, 1, 0);
  const omega = (2 * Math.PI * BEATS) / LOOP;
  const angles = new Float64Array(2 * PER);
  const seg = (i: number, a: Vector3, b: Vector3) => {
    const d = new Vector3().subVectors(b, a);
    at.position.copy(a);
    at.quaternion.setFromUnitVectors(up, d.clone().normalize());
    at.scale.set(0.0025, d.length(), 0.0025);
    at.updateMatrix();
    cables.setMatrixAt(i, at.matrix);
  };
  const pose = (phase: number) => {
    const t = phase * LOOP;
    const sums = [0, 0];
    for (let p = 0; p < 2; p++)
      for (let k = 0; k < PER; k++) {
        const b = beats[p][k];
        let psi = b.offset;
        if (b.slips !== 0) {
          const w = (2 * Math.PI * Math.abs(b.slips)) / LOOP;
          psi += Math.sign(b.slips) * adler(t, w, b.r, b.t0);
        }
        psi += b.wobble * Math.sin((2 * Math.PI * b.wf * t) / LOOP + b.wp);
        const a = look.swing * Math.sin(omega * t + psi);
        angles[p * PER + k] = a;
        sums[p] += a;
        const side = Math.sign(a);
        if (look.sound && st.state.hold < 0 && side !== lastSide[p * PER + k] && lastSide[p * PER + k] !== 0) click(0.05, p ? 1900 + k * 40 : 2100);
        lastSide[p * PER + k] = side;
      }
    // the platforms swing against their metronomes, and pass a share through the spring
    const shift = [-(sums[0] + look.share * sums[1]) * look.sway, -(sums[1] + look.share * sums[0]) * look.sway];
    for (let p = 0; p < 2; p++) {
      const deck = decks[p];
      const home = p ? 1.05 : -1.05;
      deck.position.x = home + shift[p];
      // a swing: the deck rises a little at the ends of its travel
      const len = HANG - DECK;
      deck.position.y = DECK + len - Math.sqrt(len * len - shift[p] * shift[p]);
      deck.updateMatrixWorld();
      let c = 0;
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) {
          const corner = new Vector3(sx * (W / 2 - 0.03), 0.02, sz * (Dp / 2 - 0.03)).applyMatrix4(deck.matrixWorld);
          seg(p * 4 + c++, corner, new Vector3(home + sx * (W / 2 - 0.03), HANG - 0.04, sz * (Dp / 2 - 0.03)));
        }
      for (let k = 0; k < PER; k++) {
        const i = p * PER + k;
        const base = spots[k].clone().applyMatrix4(deck.matrixWorld);
        at.position.copy(base);
        at.quaternion.identity();
        at.scale.setScalar(1);
        at.updateMatrix();
        bodies.setMatrixAt(i, at.matrix);
        // rod pivots just in front of the body, near its foot
        const pivot = base.clone().add(new Vector3(0, 0.035, 0.06));
        const q = new Quaternion().setFromAxisAngle(Z, -angles[i]);
        at.position.copy(pivot);
        at.quaternion.copy(q);
        at.scale.set(0.0022, 0.21, 0.0022);
        at.updateMatrix();
        rods.setMatrixAt(i, at.matrix);
        at.position.copy(pivot).add(new Vector3(0, 0.15, 0).applyQuaternion(q));
        at.scale.setScalar(1);
        at.updateMatrix();
        weights.setMatrixAt(i, at.matrix);
        at.position.copy(pivot);
        at.quaternion.identity();
        at.updateMatrix();
        pins.setMatrixAt(i, at.matrix);
      }
    }
    // spring from the inner edge of one deck to the other
    const a = new Vector3(W / 2, 0, 0).applyMatrix4(decks[0].matrixWorld);
    const b = new Vector3(-W / 2, 0, 0).applyMatrix4(decks[1].matrixWorld);
    spring.position.copy(a);
    spring.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), b.clone().sub(a).normalize());
    spring.scale.set(a.distanceTo(b), 1, 1);
    for (const m of [cables, bodies, rods, weights, pins]) m.instanceMatrix.needsUpdate = true;
  };

  const frameUp = () => {
    camera.fov = look.fov;
    camera.position.set(0.55, 1.85, 3.9);
    controls.target.set(0, 1.12, 0);
    camera.updateProjectionMatrix();
    controls.update();
  };
  frameUp();

  const cf = st.gui.addFolder("chimera");
  cf.add(look, "swing", 0, 1, 0.01);
  cf.add(look, "sway", 0, 0.15, 0.001);
  cf.add(look, "share", 0, 1, 0.01);
  cf.add(look, "sound").onChange((on: boolean) => {
    if (on && !audio) audio = new AudioContext();
    void audio?.resume();
  });
  cf.add(look, "fov", 15, 70, 1).onChange(frameUp);
  st.refresh();

  Object.assign(window, { __pendulum: { ...st, frameUp, beats } });

  wrap.render = ({ playhead }) => {
    pose(st.phase(playhead));
    st.render();
  };
  wrap.resize = ({ width, height }) => st.resize(width, height);
  wrap.unload = () => {
    void audio?.close();
    st.renderer.dispose();
  };
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
