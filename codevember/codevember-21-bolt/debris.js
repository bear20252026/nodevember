// The stones a strike throws out of the ground: flung up and out of the hole it blasts, they
// fall back on the meadow, bounce and roll, settle in the grass; the ones flung far enough go
// over the block's edge, drop onto the wooden base or past it onto the board, and roll on it
// a little before they stop. A few hundred at most: the oldest are taken back to throw anew.
import * as THREE from 'three';
import { insideDist } from './common.js';
import { rockGeometry, rockMaterial } from './grass.js';

const G = 9.8;

export function createDebris({ outline, rim, height, baseY, floorY, max = 240 }) {
  const mesh = new THREE.InstancedMesh(rockGeometry(), rockMaterial, max);
  mesh.count = 0;
  mesh.frustumCulled = false;
  mesh.receiveShadow = true; // (not casting: the shadows are drawn once, and these move)
  const black = new THREE.Color(0);
  for (let i = 0; i < max; i++) mesh.setColorAt(i, black);
  const rocks = [];
  let next = 0;

  // the ground under a point: the meadow, the wooden base round it, or the board
  const surface = (x, z) => {
    if (insideDist(outline, x, z) > 0) return { y: height(x, z), zone: 0 };
    if (insideDist(rim, x, z) > 0) return { y: baseY, zone: 1 };
    return { y: floorY, zone: 2 };
  };
  const n = new THREE.Vector3(), vt = new THREE.Vector3(), axis = new THREE.Vector3(), dq = new THREE.Quaternion(), m = new THREE.Matrix4();
  const normalAt = (x, z, zone, out) => {
    if (zone !== 0) return out.set(0, 1, 0);
    const e = 0.04;
    return out.set(height(x - e, z) - height(x + e, z), 2 * e, height(x, z - e) - height(x, z + e)).normalize();
  };

  function step(r, h) {
    const { p, v, spin } = r;
    v.y -= G * h;
    const nx = p.x + v.x * h, nz = p.z + v.z * h;
    let ny = p.y + v.y * h;
    const here = surface(p.x, p.z), s = surface(nx, nz);
    // a wall in the way (the block's side from the base, the base's from the board): off it
    if (s.zone < here.zone && s.y > p.y - r.rad + 0.01) {
      v.x *= -0.35;
      v.z *= -0.35;
      p.y = ny;
      return;
    }
    p.x = nx;
    p.z = nz;
    if (ny - r.rad <= s.y) {
      normalAt(nx, nz, s.zone, n);
      ny = s.y + r.rad;
      const vn = v.dot(n);
      // the bounce: a little back up, less each time, none once it's only rolling
      if (vn < 0) v.addScaledVector(n, -(vn < -0.8 ? 1.3 : 1) * vn);
      // along the ground: the grass holds it back hard, the wood less
      vt.copy(v).addScaledVector(n, -v.dot(n));
      const sp = vt.length(), fr = (s.zone === 0 ? 3.2 : 1.1) * h;
      if (sp > fr) v.addScaledVector(vt, -fr / sp);
      else v.sub(vt);
      // rolling: turning about the ground's line across its way
      axis.crossVectors(n, vt);
      if (sp > 1e-4) spin.copy(axis).multiplyScalar(1 / r.rad);
      else spin.multiplyScalar(0.8);
      r.onGround = true;
    } else r.onGround = false;
    p.y = ny;
    const w = spin.length();
    if (w > 1e-4) r.q.premultiply(dq.setFromAxisAngle(axis.copy(spin).divideScalar(w), w * h));
  }

  return {
    mesh,
    // one more stone thrown: from `pos`, at `vel`, turned `q`, its size `scale`, its colour
    fling(pos, vel, q, scale, col) {
      const i = next;
      next = (next + 1) % max;
      const r = {
        i,
        p: pos.clone(),
        v: vel.clone(),
        q: q.clone(),
        scale: scale.clone(),
        rad: Math.min(scale.x, scale.y, scale.z) * 0.85,
        spin: new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30),
        onGround: false,
        still: 0,
      };
      rocks[i] = r;
      mesh.setColorAt(i, col);
      mesh.instanceColor.needsUpdate = true;
      mesh.count = Math.max(mesh.count, i + 1);
    },
    update(dt) {
      if (!mesh.count) return;
      for (const r of rocks) {
        if (!r) continue;
        if (r.still > 0.5) {
          // at rest, but kept on the ground as it heals (a scar filling back in under it)
          const s = surface(r.p.x, r.p.z);
          if (s.zone === 0) r.p.y = s.y + r.rad;
        } else {
          for (let k = 0; k < 3; k++) step(r, dt / 3);
          r.still = r.onGround && r.v.lengthSq() < 0.004 ? r.still + dt : 0;
        }
        mesh.setMatrixAt(r.i, m.compose(r.p, r.q, r.scale));
      }
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
