import { Vector3, Matrix4, Raycaster } from 'three/webgpu';
import { createRoverModel } from '../rover-model.js';

// Test actual link vertices against the tire annulus, including shoulder
// clearance throughout suspension travel and inner-wheel steering. The shin
// terminates inside the central opening, where it intentionally meets the hub.
export function checkRoverClearance() {
  const model = createRoverModel(), p = new Vector3(), transform = new Matrix4();
  const wheels = [-1, 1].flatMap(side => [-1, 1].map(end => ({ side, end, length: .76, angle: 0, spin: 0 })));
  const physics = { position: [0, 0, 0], rotation: [0, 0, 0, 1], wheels };
  let penetrations = 0, poses = 0, maximumMountGap = 0; const failures = [];
  try {
    for (const length of [.16, .3, .4, .55, .65, .76, 1.1, 1.45]) for (const angle of [-.85, -.58, -.35, -.2, 0, .2, .35, .58, .85]) {
      wheels.forEach(w => { w.length = length; w.angle = w.end < 0 ? angle : 0; }); model.pose(physics); poses++;
      for (const leg of model.legs) for (const part of [leg.upper, leg.lower, leg.knee, leg.barrel, leg.piston, leg.shockMount]) {
        let intersections = 0;
        part.traverse(mesh => {
          if (!mesh.isMesh) return;
          transform.copy(leg.wheel.matrixWorld).invert().multiply(mesh.matrixWorld);
          const positions = mesh.geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            p.fromBufferAttribute(positions, i).applyMatrix4(transform);
            const radius = Math.hypot(p.y, p.z);
            if (Math.abs(p.x) < .15 && radius > .24 && radius < .385) { penetrations++; intersections++; }
          }
        });
        if (intersections) failures.push({ length, angle, side: leg.side, end: leg.end, part: part === leg.upper ? 'upper' : part === leg.lower ? 'lower' : part === leg.knee ? 'knee' : 'shock', intersections });
      }
      for (const leg of model.legs) {
        const mount = leg.shockMount.getWorldPosition(new Vector3());
        const tip = new Vector3(0, .5, 0).applyMatrix4(leg.piston.matrixWorld);
        if (tip.distanceTo(mount) > 1e-7) throw new Error('Piston lost its lower pivot');
        const towardArm = new Vector3(leg.side, 0, 0).transformDirection(leg.lower.matrixWorld);
        const hit = new Raycaster(mount, towardArm, 0, .0475).intersectObjects(leg.lower.children, true)[0];
        if (!hit) throw new Error('Piston bracket does not reach the shin');
        maximumMountGap = Math.max(maximumMountGap, hit.distance);
      }
    }
    if (penetrations) throw new Error(`${penetrations} suspension vertices intersect the tire envelope: ${JSON.stringify(failures)}`);
    return { poses, wheels: 4, penetrations, pistonAttachments: poses * 4, maximumMountGap };
  } finally { model.dispose(); }
}
