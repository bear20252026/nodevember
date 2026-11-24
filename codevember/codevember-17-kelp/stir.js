// The water the pointer stirs: its wake, a trail of moments left along its path (each where
// the pointer was, how fast it went, when), and the motion they set going. Round each, the
// water dragged along the path and parted round the pointer (the flow round a moving
// cylinder), and the eddies it sheds, a pair either side of its path turning opposite ways,
// lingering after it has gone. Screen units: 1 = 1% of the screen's height, from its bottom left.
// The kelp feels it through the flow (field), the marine snow is carried and swirled by it
// (stirSnow), the forest beyond bends to it and springs back (stirForest).
import * as THREE from 'three';

const PART = 0.55; // how much of the wake goes round the pointer rather than along with it
const LIFE = 2.6; // how long a moment of the wake lasts
const MAX = 96; // enough that none is dropped before it has done its work (at 40 a second)
const EDDY_OFF = 4.5, EDDY_R2 = 26; // the eddies: how far off the path, how broad
const EDDY = 0.0028, EDDY_DECAY = 1.15;

export function createStir() {
  const wakes = [];
  let seq = 0;
  return {
    wakes,
    // the pointer at (x, y), moving at (vx, vy) per second, at time t (now: real time, ms)
    move(x, y, vx, vy, t, now) {
      const sp = Math.hypot(vx, vy);
      if (sp <= 5 || now - (wakes.at(-1)?.real ?? 0) <= 25) return;
      const k = Math.min(1, 400 / sp);
      wakes.push({ x, y, vx: vx * k, vy: vy * k, t, real: now, seq: seq++ });
      if (wakes.length > MAX) wakes.shift();
    },
    prune(t) {
      while (wakes.length && t - wakes[0].t > LIFE) wakes.shift();
    },
    // the water's motion from the wake at (x, y), added to out.x, out.y (and set alone
    // in out.wx, out.wy); out.stir: how churned it is there (what makes the blades flap)
    field(x, y, t, out) {
      let stir = 0, wx = 0, wy = 0;
      for (const w of wakes) {
        const dx = x - w.x, dy = y - w.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 900) continue;
        const age = t - w.t;
        const f = Math.exp(-d2 / 110 - age * 1.6) * 0.012;
        const q = d2 / (d2 + 12), pr = (dx * w.vx + dy * w.vy) / (d2 + 12);
        wx += f * (w.vx * (1 - PART * q) + 2 * PART * pr * dx);
        wy += f * (w.vy * (1 - PART * q) + 2 * PART * pr * dy);
        // the eddies shed either side of the path: on its left one turning anticlockwise,
        // on its right one clockwise, so the water between them runs on after the pointer
        // and curls back outside
        const sp = Math.hypot(w.vx, w.vy) || 1;
        const nx = -w.vy / sp, ny = w.vx / sp; // to the left of the path
        const g = EDDY * sp * Math.exp(-age * EDDY_DECAY);
        for (let side = -1; side <= 1; side += 2) {
          const ex = dx - side * nx * EDDY_OFF, ey = dy - side * ny * EDDY_OFF;
          const e = g * side * Math.exp(-(ex * ex + ey * ey) / EDDY_R2);
          wx -= e * ey;
          wy += e * ex;
        }
        stir += f * sp + g * 2 * Math.exp(-d2 / 60);
      }
      out.x += wx; out.y += wy;
      out.wx = wx; out.wy = wy;
      out.stir = (out.stir || 0) + stir;
    },
  };
}

// ---- the marine snow, carried by the stirred water: each speck its own offset from where
// the drift alone would take it, eased toward the water's motion (a little inertia) and
// kept; the nearer specks moved the most (the pointer is in the water near the camera)
const v3 = new THREE.Vector3();
const wf = { x: 0, y: 0, stir: 0 };
export function stirSnow(snow, stir, camera, dt, t) {
  const geo = snow.geometry;
  const P = geo.attributes.position.array, R = geo.attributes.aRand.array;
  const off = geo.attributes.aOff;
  const O = off.array, V = (snow.userData.vel ??= new Float32Array(R.length * 2));
  const aspect = camera.aspect, tanH = Math.tan((camera.fov * Math.PI) / 360);
  const ease = Math.min(1, dt * 2.2), damp = Math.min(1, dt * 0.9);
  const busy = stir.wakes.length > 0;
  // the stretch of screen the wake reaches
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const w of stir.wakes) { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y0 = Math.min(y0, w.y); y1 = Math.max(y1, w.y); }
  x0 -= 30; x1 += 30; y0 -= 30; y1 += 30;
  let moved = false;
  for (let i = 0, n = R.length; i < n; i++) {
    let vx = V[i * 2], vy = V[i * 2 + 1];
    if (!busy && vx * vx + vy * vy < 1e-8) continue;
    // where it is now: as the shader has it (water.js createSnow)
    const r = R[i];
    let x = P[i * 3] + O[i * 3] + t * (0.25 + r * 0.2) + Math.sin(t * 0.3 + r * 20) * 0.6;
    let y = P[i * 3 + 1] + O[i * 3 + 1] - t * (0.03 + r * 0.05);
    const z = P[i * 3 + 2] + Math.sin(t * 0.2 + r * 13) * 0.5;
    x = ((((x + 35) % 70) + 70) % 70) - 35;
    y = ((y % 30) + 30) % 30;
    const d = camera.position.z - z;
    let wx = 0, wy = 0;
    if (busy && d > 0.5) {
      v3.set(x, y, z).project(camera);
      const sx = (v3.x + 1) * 50 * aspect, sy = (v3.y + 1) * 50;
      if (sx > x0 && sx < x1 && sy > y0 && sy < y1) {
        wf.x = 0; wf.y = 0;
        stir.field(sx, sy, t, wf);
        // screen units per second to the water's, at its depth; the far ones stirred less
        const u = (2 * d * tanH) / 100 / (1 + (d / 26) ** 2);
        wx = wf.x * u * 1.6; wy = wf.y * u * 1.6;
      }
    }
    // toward the water's motion where the wake is, slowing to a stop where it isn't
    const k = wx || wy ? ease : damp;
    vx += (wx - vx) * k; vy += (wy - vy) * k;
    V[i * 2] = vx; V[i * 2 + 1] = vy;
    O[i * 3] += vx * dt; O[i * 3 + 1] += vy * dt;
    moved = true;
  }
  if (moved) off.needsUpdate = true;
}

// ---- the forest beyond: each row given the wake where it crosses it (in its own units, on
// its plane), the shader bending its plants by it (water.js). The wake as a trail of short
// segments, so it is smooth along the pointer's path however far apart its moments are; the
// moments kept one in three by their number, so the trail doesn't change as it grows
const FOREST_WAKES = 32;
// the forest's own share of the stirring: felt further round the pointer than the kelp
// does (the reach squared, screen units), but gently, and bent only a little at most
// (screen units)
const FOREST_REACH2 = 400, FOREST_PUSH = 0.0025, FOREST_BEND = 1.6;
const DENSE = 0.025; // the wake's moments when the pointer moves steadily (s apart)
const ndc = new THREE.Vector3(), dir = new THREE.Vector3();
const pts = [];
export function stirForest(forest, stir, camera) {
  const ws = stir.wakes;
  const aspect = camera.aspect, tanH = Math.tan((camera.fov * Math.PI) / 360);
  const kept = ws.filter((w) => w.seq % 3 === 0).slice(1 - FOREST_WAKES);
  // and the newest moment, the trail's end growing smoothly toward the next one kept
  const newest = ws.at(-1);
  if (newest && newest !== kept.at(-1)) kept.push(newest);
  for (const mesh of forest.children) {
    const u = mesh.material.uniforms;
    const SA = u.uSegA.value, SB = u.uSegB.value;
    const z = mesh.position.z, d = camera.position.z - z, U = (2 * d * tanH) / 100;
    const R = Math.sqrt(FOREST_REACH2) * U; // the reach of a moment (as in water.js)
    pts.length = 0;
    for (const w of kept) {
      ndc.set((w.x / (50 * aspect)) - 1, w.y / 50 - 1, 0.5).unproject(camera);
      dir.copy(ndc).sub(camera.position);
      const s = (z - camera.position.z) / dir.z;
      pts.push({ x: camera.position.x + dir.x * s, y: camera.position.y + dir.y * s, vx: w.vx * U, vy: w.vy * U, t: w.t });
    }
    let n = 0, lo = 1e9, hi = -1e9;
    for (let i = 0; i < pts.length && n < FOREST_WAKES; i++) {
      const a = pts[i], last = i === pts.length - 1;
      // on to the next moment, unless the pointer stopped between them (then a point); the
      // newest is where the trail ends, nothing of its own (it grows into the next stretch)
      const b = !last && pts[i + 1].t - a.t < 0.4 ? pts[i + 1] : a;
      if (last && b === a && i > 0 && a.t - pts[i - 1].t < 0.4) break;
      const dt = b === a ? 3 * DENSE : b.t - a.t;
      const L = Math.hypot(b.x - a.x, b.y - a.y);
      // as strong as the moments it stands for, spread along it
      const wgt = (dt / DENSE) * Math.min(1, (Math.sqrt(Math.PI) * R) / (L || 1e-6));
      SA[n].set(a.x, a.y, b.x, b.y);
      SB[n].set((a.vx + b.vx) * 0.5 * wgt, (a.vy + b.vy) * 0.5 * wgt, a.t, b.t);
      lo = Math.min(lo, a.x, b.x); hi = Math.max(hi, a.x, b.x);
      n++;
    }
    u.uSegN.value = n;
    u.uWakeU.value = U;
    u.uStirX.value.set(lo - 3 * R - 5, hi + 3 * R + 5);
  }
}
export { FOREST_WAKES, FOREST_REACH2, FOREST_PUSH, FOREST_BEND };
