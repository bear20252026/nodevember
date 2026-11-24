// The manual show: nothing moves till one presses on the sheet. Press, and a shape comes up under it there
// (mostly a drum, now and then a ball, a cube on its corner or an egg); drag, and it follows under the
// cloth; let go, and it drops away, faster than the cloth falls, so the cloth comes down on its own.
// One shape per pointer (fingers on a phone each get one), and a few more still on their way down.
import { HIDE, quat, restY } from "./show.ts";
import type { PusherState } from "./sim.ts";

type Kind = { kind: number; size: [number, number, number, number]; top: number; lift: number; tilt: number; axis: [number, number, number] };
const KINDS: [number, () => Kind][] = [
  [0.55, () => { const r = 0.12 + Math.random() * 0.05; return { kind: 7, size: [r, 0.3, 0.045, 0], top: 0.3, lift: 0.38, tilt: 0, axis: [1, 0, 0] }; }],
  [0.17, () => { const r = 0.17 + Math.random() * 0.07; return { kind: 1, size: [r, 0, 0, 0], top: r, lift: 0.36, tilt: 0, axis: [1, 0, 0] }; }],
  [0.14, () => ({ kind: 3, size: [0.14, 0.14, 0.14, 0.015], top: 0.25, lift: 0.34, tilt: 54.7, axis: [1, 0, 1] })],
  [0.14, () => ({ kind: 5, size: [0.13, 0.22, 0.13, 0], top: 0.22, lift: 0.34, tilt: 0, axis: [1, 0, 0] })],
];
function pick(): Kind {
  let u = Math.random();
  for (const [w, make] of KINDS) if ((u -= w) <= 0) return make();
  return KINDS[0][1]();
}

const SLOTS = 6;
const RISE = 12; // 1/s: how fast it comes up to its height (most of the way in a quarter second)
const FOLLOW = 14; // 1/s: how closely it follows the pointer
const SPEED = 2; // m/s at most sideways, so a flick can't tear the sheet
const FALL = 30; // m/s²: dropping, faster than the cloth can follow
const EDGE = 0.85; // m: kept this far in from the sheet's middle

type Slot = Kind & { id: number | null; x: number; z: number; tx: number; tz: number; h: number; v: number; yaw: number; live: boolean };

export class Touch {
  private slots: Slot[] = [];

  /** a pointer went down at x z on the sheet */
  press(id: number, x: number, z: number) {
    if (this.slots.some((s) => s.id === id)) return;
    let k = this.slots.findIndex((s) => !s.live);
    if (k < 0 && this.slots.length < SLOTS) k = this.slots.length;
    if (k < 0) return;
    const [cx, cz] = clamp(x, z);
    this.slots[k] = { ...pick(), id, x: cx, z: cz, tx: cx, tz: cz, h: HIDE, v: 0, yaw: Math.random() * 360, live: true };
  }

  move(id: number, x: number, z: number) {
    const s = this.slots.find((q) => q.id === id);
    if (s) [s.tx, s.tz] = clamp(x, z);
  }

  release(id: number) {
    const s = this.slots.find((q) => q.id === id);
    if (s) s.id = null;
  }

  get busy() {
    return this.slots.some((s) => s.live);
  }

  /** one frame of sim time */
  step(dt: number) {
    for (const s of this.slots) {
      if (!s.live) continue;
      if (s.id !== null) {
        s.h += (s.lift - s.h) * (1 - Math.exp(-RISE * dt));
        s.v = 0;
      } else {
        s.v += FALL * dt;
        s.h -= s.v * dt;
        if (s.h <= HIDE) s.live = false;
      }
      const f = 1 - Math.exp(-FOLLOW * dt);
      let dx = (s.tx - s.x) * f;
      let dz = (s.tz - s.z) * f;
      const d = Math.hypot(dx, dz);
      if (d > SPEED * dt) ((dx *= (SPEED * dt) / d), (dz *= (SPEED * dt) / d));
      s.x += dx;
      s.z += dz;
    }
  }

  /** what the sim pushes with: always SLOTS of them, the idle ones off */
  pushers(): PusherState[] {
    const out: PusherState[] = [];
    for (let k = 0; k < SLOTS; k++) {
      const s = this.slots[k];
      if (!s?.live) out.push({ kind: 0, c: [0, -3, 0], q: [0, 0, 0, 1], size: [0.1, 0, 0, 0] });
      else out.push({ kind: s.kind, c: [s.x, restY(s.x, s.z) + s.h - s.top, s.z], q: quat(s.yaw, s.tilt, s.axis), size: s.size });
    }
    return out;
  }
}

function clamp(x: number, z: number): [number, number] {
  return [Math.max(-EDGE, Math.min(EDGE, x)), Math.max(-EDGE, Math.min(EDGE, z))];
}
