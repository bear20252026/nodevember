// The feather that turns out to be a bird.
//
// A feather near by and a bird far off, on the same line of sight, are the same size on the screen. A curved
// feather seen from the side is an arc; so is a far bird gliding straight at you, wings in a shallow V. And
// a feather's swing (sliding along its length, the leading end tipping up) is how a bird sways when it banks
// one way and then the other. So:
//
//   1. a feather slips from a wing and swings to and fro twice, lying across the view, drifting towards the viewer;
//   2. a real bird is put far behind it on the camera's own ray, head-on, gliding, tilted and swaying exactly
//      as the feather is, a little smaller than it so that it is hidden;
//   3. the feather thins to a line and is gone, and what is left is the bird, which starts to beat its wings
//      at that moment and no sooner (`wakes`): a wing lifting off the feather's line would be seen double;
//   4. the bird sways a little more and flies in on a curve, nose first and
//      leaning into the turn, round behind the empty place in the V and up into it.
//
// Everything is a function of the time since the feather was let go and of where the camera is, so it holds
// from any angle and can be told as often as there are feathers.
import * as TSL from "three/tsl";
import { Matrix4, Mesh, Quaternion, Vector3 } from "three/webgpu";
import type { PerspectiveCamera } from "three/webgpu";
import { featherMaterial, featherSet } from "./feather.ts";
import { PART, type Cel } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { uniform } = T;

type V3 = [number, number, number];
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// slower to start and to stop than `smooth`: for a flight
const glideIn = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export const tale = {
  swing: 0.5, // half width of the feather's swing, metres
  period: 2.3, // seconds there and back
  rock: 0.5, // how far it tips at each end, radians
  sink: 0.22, // metres a second
  behind: 0.25, // how fast the flock leaves it
  small: 1, // the feather's size as it leaves the wing: life size, a fifth of a metre, right for the bird
  size: 1.5, // and what it has grown to by the time it becomes a bird (it also nears the viewer, which enlarges it more)
  toward: 0.42, // how much of the way to the viewer it drifts as it falls, so that it is seen well
  far: 4.7, // how many times further off than the feather the bird is when it takes over
  drawn: 1, // how plainly the feather is drawn as one at first: its shaft and barbs
  speed: 5, // how fast the flock is taken to fly, metres a second: what turns a joining bird's nose forward as it slows
  bow: 0.12, // how far its way in dips below and behind the straight line, as a share of the distance
  wakes: 4.6, // seconds after the feather is let go that it is gone and its bird starts to beat (the feather thins over the 0.75 s before, the bird is put behind it 0.6 s before that)
  floor: -1e9, // the feather comes no lower than this (set by the stage: above the water and above the eye)
};
const LEN = 0.2; // the feather, metres, before `size`
const FALLS = 2; // seconds the feather falls and swings before anything else begins: one more swing
export const ARRIVE = 9.4 + FALLS; // seconds after the feather is let go that the bird is in its place
export const shows = () => tale.wakes - 1.35; // and when the bird first has to exist

export function createStory(C: Cel, count: number) {
  const set = featherSet(count, 7, 14, true);
  for (let k = 0; k < count; k++) set.shape.set([LEN, LEN * 0.19, 0.1, 0.6, 37.1 + k * 11.3, 0, 0, PART.loose], k * 8);
  const mesh = new Mesh(set.geometry, featherMaterial(C, uniform(0), uniform(0)));
  mesh.frustumCulled = false;

  const up = new Vector3(0, 1, 0);
  const rh = new Vector3(); // the camera's right, laid flat: the feather swings along it
  const x0 = new Vector3();
  const zf = new Vector3();
  const yf = new Vector3();
  const pf = new Vector3(); // where the feather is, or would be
  const xb = new Vector3();
  const yb = new Vector3();
  const zb = new Vector3();
  const toCam = new Vector3();
  const basis = new Matrix4();
  const flown = new Quaternion();
  const b0 = new Vector3();
  const b1 = new Vector3();
  const b2 = new Vector3();
  const b3 = new Vector3();
  const tmp = new Vector3();
  const ahead = new Vector3();
  const newcomer = { position: new Vector3(), quaternion: new Quaternion(), scale: 1, flap: 1 };
  const zero = new Float32Array(16);

  // k: which feather. tau: seconds since it was let go (below zero or past ARRIVE: nothing to tell).
  // start: the point under a wing where it is let go. slot: the place in the formation that will be taken.
  // way: +1 or -1, which way it swings first. Returns where its bird is, how it is turned, and whether it beats
  const tell = (k: number, tau: number, camera: PerspectiveCamera, start: V3, slot: V3, way: number) => {
    const n = newcomer;
    n.position.set(slot[0], slot[1], slot[2]);
    n.quaternion.identity();
    n.scale = 0;
    n.flap = 1;
    if (tau < 0 || tau >= ARRIVE) {
      set.pose.set(zero, k * 16);
      return n;
    }
    rh.setFromMatrixColumn(camera.matrixWorld, 0);
    rh.y = 0;
    rh.normalize();
    // the feather's fall: one swing in earnest, then it loses heart
    const a = 2.6 + FALLS;
    const b = 4.2 + FALLS;
    const e = tau < a ? tau : a + (b - a) * (1 - Math.exp(-(tau - a) / (b - a))); // its time runs down
    const back = tale.behind * (e - 0.7 * (1 - Math.exp(-e / 0.7)));
    const down = tale.sink * (e - 0.9 * (1 - Math.exp(-e / 0.9)));
    const drop = 0.2 * (1 - Math.exp(-tau / 0.3)); // it falls clear of the bird at once, and only then takes to the air
    const th = ((Math.PI * 2) / tale.period) * tau;
    const amp = (1 - Math.exp(-tau / 0.45)) * (tau < 3 + FALLS ? 1 : Math.exp(-(tau - 3 - FALLS) / 1.5));
    const sn = Math.sin(th) * way;
    // (it does not rise at the end of its first swing, which would carry it back up beside the bird it left)
    pf.set(start[0] - back, start[1] - down - drop + 0.14 * amp * smooth(0.3, 1.6, tau) * sn * sn, start[2]).addScaledVector(rh, tale.swing * amp * sn);
    // and it comes towards whoever is watching
    pf.lerp(camera.position, tale.toward * smooth(0.15, 2.7 + FALLS, tau));
    // it settles onto its floor rather than through it
    if (pf.y < tale.floor + 0.4) pf.y = tale.floor + 0.4 * Math.exp((pf.y - tale.floor - 0.4) / 0.4);
    const tip = tale.rock * amp * sn; // the end it is sliding towards rides up

    // ---- the feather itself, for as long as it is one
    if (tau < tale.wakes) {
      // life size as it leaves the wing; it grows as it falls, and grows again on the screen as it nears the viewer
      const size = smooth(0, 0.25, tau) * (tale.small + (tale.size - tale.small) * smooth(0.4, 2.7 + FALLS, tau));
      const thin = 1 - smooth(tale.wakes - 0.75, tale.wakes, tau); // it narrows to a line: the line of two wings
      // (its curve is all towards the tip, so it is tipped back a little to lie level; and it tumbles as it goes)
      const lie = tip - 0.18 + 2.4 * Math.exp(-tau / 0.3);
      zf.copy(rh).multiplyScalar(Math.cos(lie)).addScaledVector(up, Math.sin(lie));
      x0.crossVectors(up, rh);
      yf.crossVectors(zf, x0);
      // it comes away broad side on, so that it is seen for what it is; then it turns to lie flat on the air
      const shown = 1 - smooth(1.8, 3.4, tau);
      const roll = 0.3 * Math.sin(2 * th + 0.6) * amp + 1.3 * shown * tale.drawn;
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const L = LEN * size;
      const grown = 1;
      set.shape[k * 8 + 6] = -tale.drawn * (1 - smooth(2.8, 4.0, tau)); // drawn as a feather at first, plain by the time it thins
      set.pose.set(
        [
          pf.x - zf.x * L * grown * 0.5,
          pf.y - zf.y * L * grown * 0.5,
          pf.z - zf.z * L * grown * 0.5,
          0.55,
          (x0.x * cr + yf.x * sr) * size * grown * thin,
          (x0.y * cr + yf.y * sr) * size * grown * thin,
          (x0.z * cr + yf.z * sr) * size * grown * thin,
          0,
          (yf.x * cr - x0.x * sr) * size * grown,
          (yf.y * cr - x0.y * sr) * size * grown,
          (yf.z * cr - x0.z * sr) * size * grown,
          0,
          zf.x * size * grown,
          zf.y * size * grown,
          zf.z * size * grown,
          0,
        ],
        k * 16,
      );
    } else set.pose.set(zero, k * 16);

    // ---- the bird: on the ray through the feather's path, `far` times as distant, for as long as it has to
    // pass for the feather.
    const match = tale.far;
    b0.copy(pf).sub(camera.position).multiplyScalar(match).add(camera.position);
    // Then it flies in, on a curve: it dips below the straight line and a little behind it, and comes up to its
    // place from behind, below and outside, as a bird catches a formation up
    const out = Math.sign(slot[2]) || 1;
    b3.set(slot[0], slot[1], slot[2]);
    b2.set(slot[0] - 1.1, slot[1] - 0.4, slot[2] + out * 0.4);
    const d = b0.distanceTo(b2);
    b1.copy(b0).lerp(b2, 0.5);
    b1.x -= tale.bow * d * 0.4;
    b1.y -= tale.bow * d * 0.5;
    const t0 = 4.0 + FALLS;
    const at = clamp01((tau - t0) / (ARRIVE - t0));
    const w = at * at * at * (at * (at * 6 - 15) + 10);
    const rate = (30 * at * at * (1 - at) * (1 - at)) / (ARRIVE - t0); // how fast w grows
    const along = (w: number, out: Vector3) => {
      const m = 1 - w;
      return out
        .copy(b0)
        .multiplyScalar(m * m * m)
        .addScaledVector(b1, 3 * m * m * w)
        .addScaledVector(b2, 3 * m * w * w)
        .addScaledVector(b3, w * w * w);
    };
    // which way its nose points at w: along its own way through the air, which is its way towards the flock
    // plus the flock's way forward. Far off the first is all there is to see; as it draws level, the second
    const nose = (w: number, rate: number, out: Vector3) => {
      const m = 1 - w;
      out
        .copy(b1)
        .sub(b0)
        .multiplyScalar(3 * m * m)
        .addScaledVector(tmp.copy(b2).sub(b1), 6 * m * w)
        .addScaledVector(tmp.copy(b3).sub(b2), 3 * w * w)
        .multiplyScalar(rate);
      out.x += tale.speed * w;
      if (out.lengthSq() < 1e-8) out.copy(b1).sub(b0);
      out.normalize();
      out.y = Math.max(-0.3, Math.min(0.3, out.y));
      return out.normalize();
    };
    along(w, n.position);
    // head-on to the camera with its wings along the feather, tipped as the feather is
    zb.copy(rh).multiplyScalar(-Math.cos(tip)).addScaledVector(up, -Math.sin(tip));
    toCam.copy(camera.position).sub(n.position).normalize();
    xb.copy(toCam).addScaledVector(zb, -toCam.dot(zb)).normalize();
    yb.crossVectors(zb, xb);
    n.quaternion.setFromRotationMatrix(basis.makeBasis(xb, yb, zb));
    // and then nose first along its curve, leaning into the turn
    if (tau > t0) {
      nose(w, rate, xb);
      const at2 = clamp01((tau + 0.08 - t0) / (ARRIVE - t0));
      nose(at2 * at2 * at2 * (at2 * (at2 * 6 - 15) + 10), (30 * at2 * at2 * (1 - at2) * (1 - at2)) / (ARRIVE - t0), ahead);
      const turning = (xb.z * ahead.x - xb.x * ahead.z) / 0.08; // radians a second, to its right when above zero
      const lean = Math.max(-0.6, Math.min(0.6, turning * 0.55)) * smooth(t0, t0 + 1, tau);
      zb.crossVectors(xb, up).normalize();
      yb.crossVectors(zb, xb);
      const cl = Math.cos(lean);
      const sl = Math.sin(lean);
      tmp.copy(zb).multiplyScalar(cl).addScaledVector(yb, -sl); // its right wing goes down as it turns right
      yb.multiplyScalar(cl).addScaledVector(zb, sl);
      flown.setFromRotationMatrix(basis.makeBasis(xb, yb, tmp));
      n.quaternion.slerp(flown, smooth(t0, t0 + 1.7, tau));
    }
    n.scale = smooth(shows(), shows() + 0.6, tau); // it arrives behind the feather, out of sight
    n.flap = smooth(tale.wakes, tale.wakes + 0.9, tau); // gliding for as long as there is any feather, then it beats
    return n;
  };
  return { mesh, tell, touch: set.touch };
}
