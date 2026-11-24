import Box3D from 'box3d.js/inline';
import { createRecoveryMonitor } from './rover-recovery.js';

const STEP = 1 / 120, RADIUS = .385, REST = .90, TRAVEL = 1.45, PATCH_RADIUS = 32;
const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (v, s) => v.map(x => x * s);
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const rotate = (v, q) => {
  const t = scale(cross(q, v), 2);
  return add(v, add(scale(t, q[3]), cross(q, t)));
};

// Procedural rock transforms contain rotation and positive nonuniform scale.
// Keep those separate so Box3D can instance the variant's collision mesh.
function decompose(e) {
  const sx = Math.hypot(e[0], e[1], e[2]), sy = Math.hypot(e[4], e[5], e[6]), sz = Math.hypot(e[8], e[9], e[10]);
  const m11 = e[0] / sx, m12 = e[4] / sy, m13 = e[8] / sz, m21 = e[1] / sx, m22 = e[5] / sy, m23 = e[9] / sz, m31 = e[2] / sx, m32 = e[6] / sy, m33 = e[10] / sz;
  const trace = m11 + m22 + m33; let q;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2; q = [(m32 - m23) / s, (m13 - m31) / s, (m21 - m12) / s, s / 4];
  } else if (m11 > m22 && m11 > m33) {
    const s = Math.sqrt(1 + m11 - m22 - m33) * 2; q = [s / 4, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s];
  } else if (m22 > m33) {
    const s = Math.sqrt(1 + m22 - m11 - m33) * 2; q = [(m12 + m21) / s, s / 4, (m23 + m32) / s, (m13 - m31) / s];
  } else {
    const s = Math.sqrt(1 + m33 - m11 - m22) * 2; q = [(m13 + m31) / s, (m23 + m32) / s, s / 4, (m21 - m12) / s];
  }
  return { position: [e[12], e[13], e[14]], rotation: q, scale: [sx, sy, sz] };
}

// Raycast/swept tires apply suspension, drive and lateral grip forces to a full
// Box3D rigid body. The chassis still collides when it bottoms out or hits rock.
// A small moving collision patch keeps precision across the 200 km landscape.
export async function createRoverPhysics(heightAt, obstacles = [], architecture = []) {
  const b3 = await Box3D(), def = b3.b3DefaultWorldDef();
  def.gravity = [0, -9.81, 0]; def.enableContinuous = true;
  const world = b3.b3CreateWorld(def), origin = [96, 0, 144];
  const bodyDef = b3.b3DefaultBodyDef(); bodyDef.type = b3.b3BodyType.b3_dynamicBody;
  bodyDef.position = [-1, heightAt(95, 150) + 1.05, 6];
  bodyDef.linearDamping = .12; bodyDef.angularDamping = 2.8; bodyDef.enableSleep = false;
  const body = b3.b3CreateBody(world, bodyDef), shape = b3.b3DefaultShapeDef();
  shape.density = 330; shape.baseMaterial.friction = .5; shape.filter.categoryBits = 2n;
  // The rear shell extends 25 cm beyond the original chassis. Keep the
  // collision hull and its mass distribution aligned with that silhouette.
  const chassisVertices = [];
  for (const x of [-.43, .43]) for (const y of [-.23, .23]) for (const z of [-.84, 1.09]) chassisVertices.push(x, y, z);
  const chassisHull = b3.b3CreateHull(chassisVertices);
  b3.b3CreateHullShape(body, shape, chassisHull); b3.b3DestroyHull(chassisHull);
  const mass = b3.b3Body_GetMass(body), spring = mass * 9.81 / (4 * .14), damping = 2 * Math.sqrt(spring * mass / 4) * .72;
  const query = b3.b3DefaultQueryFilter(); query.maskBits = 1n;
  const wheels = [-1, 1].flatMap(side => [-1, 1].map(end => ({ side, end, length: .76, angle: 0, spin: 0, contact: false, point: [0, 0, 0], normal: [0, 1, 0], sand: false })));
  let ground = null, mesh = null, stoneMesh = null, staticBodies = [], patchX = Infinity, patchZ = Infinity, patchY = Infinity;
  let position = [95, heightAt(95, 150) + 1.05, 150], rotation = [0, 0, 0, 1], velocity = [0, 0, 0], angular = [0, 0, 0];
  let accumulator = 0, steering = 0, distance = 0, signedSpeed = 0;
  const recoveryMonitor = createRecoveryMonitor();
  let recovery = null, safePose = null, recoveries = 0, lastRecovery = null;
  let contactBounds = [], rockTriangles = 0, nearbyRocks = 0, patchMs = 0;
  const rockMeshes = new Map(), rockTransforms = new WeakMap();
  const tirePoints = [], sweepPoints = new Array(72);
  for (const x of [-.105, .105]) for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6; tirePoints.push([x, Math.cos(a) * (RADIUS - .025), Math.sin(a) * (RADIUS - .025)]);
  }
  function clearPatch() {
    for (const id of staticBodies) b3.b3DestroyBody(id); staticBodies = [];
    if (ground) b3.b3DestroyBody(ground);
    if (mesh) b3.b3DestroyMesh(mesh);
    if (stoneMesh) b3.b3DestroyMesh(stoneMesh);
    ground = mesh = stoneMesh = null;
  }
  function patch(force = false) {
    if (!force && Math.hypot(position[0] - patchX, position[2] - patchZ) < 24 && Math.abs(position[1] - patchY) < 8) return;
    const started = performance.now();
    clearPatch();
    contactBounds = []; rockTriangles = 0; nearbyRocks = 0;
    // Rebase physics before generating local vertices. No distant float32
    // coordinates enter the solver, and the visual world never jumps.
    origin[0] = patchX = Math.round(position[0] / 16) * 16;
    origin[2] = patchZ = Math.round(position[2] / 16) * 16;
    origin[1] = Math.floor(position[1] / 100) * 100;
    patchY = position[1];
    b3.b3Body_SetTransform(body, sub(position, origin), rotation);
    // Eight metres beyond the rebuild threshold cover the entire chassis and
    // suspension, even at boost speed. Distant colliders only slow BVH builds.
    const points = [], indices = [], n = PATCH_RADIUS * 2;
    for (let z = 0; z <= n; z++) for (let x = 0; x <= n; x++) {
      const px = patchX + x - n / 2, pz = patchZ + z - n / 2;
      points.push(px - origin[0], heightAt(px, pz) - origin[1], pz - origin[2]);
    }
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const a = z * (n + 1) + x, b = a + n + 1;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
    ground = b3.b3CreateBody(world, b3.b3DefaultBodyDef());
    mesh = b3.b3CreateMesh(new Float32Array(points), new Uint32Array(indices));
    const groundShape = b3.b3DefaultShapeDef(); groundShape.filter.categoryBits = 1n;
    groundShape.baseMaterial.friction = .8; groundShape.baseMaterial.userMaterialId = 1n;
    b3.b3CreateMeshShape(ground, groundShape, mesh, [1, 1, 1]);
    for (const o of obstacles) {
      if (Math.abs(o.x - patchX) > PATCH_RADIUS + o.rx || Math.abs(o.z - patchZ) > PATCH_RADIUS + o.rz) continue;
      contactBounds.push(o); nearbyRocks++;
      if (o.positions && o.indices) {
        // All instances of a seeded variant share its immutable mesh/BVH.
        // Moving the patch creates cheap transformed shapes, not a new merged
        // mesh containing hundreds of thousands of duplicate triangles.
        let data = rockMeshes.get(o.positions);
        if (!data) { data = b3.b3CreateMesh(o.positions, o.indices); rockMeshes.set(o.positions, data); }
        let transform = rockTransforms.get(o);
        if (!transform) { transform = decompose(o.matrix); rockTransforms.set(o, transform); }
        const bd = b3.b3DefaultBodyDef(); bd.position = sub(transform.position, origin); bd.rotation = transform.rotation;
        const id = b3.b3CreateBody(world, bd), sd = b3.b3DefaultShapeDef(); sd.filter.categoryBits = 1n; sd.baseMaterial.friction = .8;
        b3.b3CreateMeshShape(id, sd, data, transform.scale); staticBodies.push(id);
        rockTriangles += o.indices.length / 3;
        continue;
      }
      const bottom = heightAt(o.x, o.z) - 2, height = Math.max(1, o.top - bottom);
      const bd = b3.b3DefaultBodyDef(); bd.position = [o.x - origin[0], bottom + height / 2 - origin[1], o.z - origin[2]];
      const id = b3.b3CreateBody(world, bd), sd = b3.b3DefaultShapeDef(); sd.filter.categoryBits = 1n; sd.baseMaterial.friction = .8;
      // Octagonal tapered collision proxies retain rock shoulders without
      // feeding millions of render triangles into the contact solver.
      const vertices = [];
      for (const y of [-1, 1]) for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, taper = y > 0 ? .72 : 1;
        vertices.push(Math.cos(a) * o.rx * taper, y * height / 2, Math.sin(a) * o.rz * taper);
      }
      const hull = b3.b3CreateHull(vertices); b3.b3CreateHullShape(id, sd, hull); b3.b3DestroyHull(hull); staticBodies.push(id);
    }
    const stoneVertices = [], stoneIndices = [];
    const corners = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
    const faces = [0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,0,1,5,0,5,4,3,7,6,3,6,2];
    for (const stone of architecture) {
      if (Math.abs(stone.x - patchX) > PATCH_RADIUS + stone.rx || Math.abs(stone.z - patchZ) > PATCH_RADIUS + stone.rz || stone.y - stone.ry > position[1] + 12 || stone.y + stone.ry < position[1] - 6) continue;
      contactBounds.push(stone);
      const e = stone.matrix, base = stoneVertices.length / 3;
      for (const [x, y, z] of corners) stoneVertices.push(
        (e[0] * x + e[4] * y + e[8] * z) * .5 + e[12] - origin[0],
        (e[1] * x + e[5] * y + e[9] * z) * .5 + e[13] - origin[1],
        (e[2] * x + e[6] * y + e[10] * z) * .5 + e[14] - origin[2]);
      for (const index of faces) stoneIndices.push(base + index);
    }
    if (stoneIndices.length) {
      stoneMesh = b3.b3CreateMesh(new Float32Array(stoneVertices), new Uint32Array(stoneIndices));
      const id = b3.b3CreateBody(world, b3.b3DefaultBodyDef()), sd = b3.b3DefaultShapeDef();
      sd.filter.categoryBits = 1n; sd.baseMaterial.friction = .9;
      b3.b3CreateMeshShape(id, sd, stoneMesh, [1, 1, 1]); staticBodies.push(id);
    }
    patchMs = performance.now() - started;
  }
  function read() {
    position = add(b3.b3Body_GetPosition([0, 0, 0], body), origin);
    rotation = b3.b3Body_GetRotation([0, 0, 0, 1], body);
    velocity = b3.b3Body_GetLinearVelocity([0, 0, 0], body);
    angular = b3.b3Body_GetAngularVelocity([0, 0, 0], body);
    signedSpeed = dot(velocity, rotate([0, 0, -1], rotation));
  }
  function contacts(throttle, boost, apply) {
    const up = rotate([0, 1, 0], rotation), down = scale(up, -1), localPosition = sub(position, origin);
    for (const wheel of wheels) {
      const anchor = add(localPosition, rotate([wheel.side, .10, wheel.end * .92], rotation));
      // Ackermann front steering; rear tires keep their fixed rolling axis.
      wheel.angle = wheel.end < 0 ? Math.atan2(1.84 * Math.tan(steering), 1.84 + wheel.side * Math.tan(steering)) : 0;
      let hit = b3.b3World_CastRayClosest(world, anchor, scale(down, TRAVEL + RADIUS), query);
      let length = hit.fraction * (TRAVEL + RADIUS) - RADIUS;
      const nearStone = contactBounds.some(o => Math.abs(anchor[0] + origin[0] - o.x) < o.rx + 1.4 && Math.abs(anchor[2] + origin[2] - o.z) < o.rz + 1.4);
      if (nearStone) {
        // Sweep the actual tire envelope down the suspension axis. Unlike a
        // center ray, its leading edge meets a small stone before the axle is
        // directly over it, giving a continuous climb and independent travel.
        const cs = Math.cos(wheel.angle), sn = Math.sin(wheel.angle), [qx, qy, qz, qw] = rotation;
        for (let i = 0; i < tirePoints.length; i++) {
          const p = tirePoints[i], x = p[0] * cs + p[2] * sn, y = p[1], z = -p[0] * sn + p[2] * cs;
          const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
          sweepPoints[i * 3] = x + qw * tx + qy * tz - qz * ty;
          sweepPoints[i * 3 + 1] = y + qw * ty + qz * tx - qx * tz;
          sweepPoints[i * 3 + 2] = z + qw * tz + qx * ty - qy * tx;
        }
        let closest = 1, support = null;
        b3.b3World_CastShape(world, anchor, sweepPoints, .025, scale(down, TRAVEL), query, (id, point, normal, fraction) => {
          if (fraction < closest && dot(normal, up) > .25) {
            closest = fraction; support = { hit: true, point, normal, userMaterialId: b3.b3Shape_GetSurfaceMaterial(id).userMaterialId };
          }
          return closest;
        });
        if (support && (!hit.hit || closest * TRAVEL < length)) { hit = support; length = closest * TRAVEL; }
      }
      wheel.contact = hit.hit && dot(hit.normal, up) > .25;
      wheel.length = wheel.contact ? clamp(length, .16, TRAVEL) : TRAVEL;
      wheel.point = wheel.contact ? add(hit.point, origin) : add(add(anchor, origin), scale(down, TRAVEL + RADIUS));
      wheel.normal = wheel.contact ? hit.normal : up;
      wheel.sand = wheel.contact && hit.userMaterialId === 1n;
      if (!wheel.contact || !apply) continue;
      const pointVelocity = b3.b3Body_GetWorldPointVelocity([0, 0, 0], body, anchor);
      const load = clamp((REST - wheel.length) * spring - dot(pointVelocity, up) * damping, 0, mass * 9.81 * 1.2);
      const localForward = [-Math.sin(wheel.angle), 0, -Math.cos(wheel.angle)];
      let forward = rotate(localForward, rotation);
      forward = sub(forward, scale(hit.normal, dot(forward, hit.normal)));
      forward = scale(forward, 1 / Math.max(.001, Math.hypot(...forward)));
      const right = cross(forward, hit.normal), longitudinal = dot(pointVelocity, forward), lateral = dot(pointVelocity, right);
      const topSpeed = throttle < 0 ? 6 : boost ? 24 : 11;
      const drive = throttle ? clamp((throttle * topSpeed - longitudinal) * mass * .85, -mass * 2.2, mass * 2.2) : -longitudinal * mass * 4 - mass * .25 * dot([0, -9.81, 0], forward);
      let fx = -lateral * mass * 3.5 - mass * .25 * dot([0, -9.81, 0], right), fz = drive;
      const grip = load * 1.15, total = Math.hypot(fx, fz);
      if (total > grip) { fx *= grip / total; fz *= grip / total; }
      // Tire forces act near the axle; a small lever arm gives body roll
      // without the excessive rollover of a full-height contact application.
      const force = add(scale(up, load), add(scale(right, fx), scale(forward, fz)));
      b3.b3Body_ApplyForce(body, force, add(anchor, scale(down, wheel.length * .4)), true);
      wheel.spin -= longitudinal * STEP / RADIUS;
    }
  }
  function recoveryTarget(reason) {
    const forward = rotate([0, 0, -1], rotation);
    const yaw = Math.atan2(-forward[0], -forward[2]);
    const upright = [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
    const candidates = reason === 'tipped' ? [[position[0], position[2]]] : [];
    // Prefer backing away from the obstruction. Search only the local patch,
    // testing the actual collision surfaces, including the sanctuary stairs.
    for (const radius of [3, 5, 8]) for (const offset of [0, -.7, .7, -1.4, 1.4, Math.PI]) {
      candidates.push([position[0] + Math.sin(yaw + offset) * radius, position[2] + Math.cos(yaw + offset) * radius]);
    }
    const hull = [];
    for (let i = 0; i < chassisVertices.length; i += 3) hull.push(...rotate(chassisVertices.slice(i, i + 3), upright));
    for (const [x, z] of candidates) {
      const supports = [];
      for (const side of [-1, 1]) for (const end of [-1, 1]) {
        const offset = rotate([side, 0, end * .92], upright);
        const ray = [x + offset[0], position[1] + 3, z + offset[2]];
        const hit = b3.b3World_CastRayClosest(world, sub(ray, origin), [0, -7, 0], query);
        if (hit.hit && hit.normal[1] > .7) supports.push(hit.point[1] + origin[1]);
      }
      if (supports.length !== 4 || Math.max(...supports) - Math.min(...supports) > .9) continue;
      const target = [x, Math.max(...supports) + 1.2, z];
      let blocked = false;
      b3.b3World_OverlapShape(world, sub(target, origin), hull, .15, query, () => { blocked = true; return false; });
      if (!blocked) return { position: target, rotation: upright };
    }
    return safePose && Math.hypot(position[0] - safePose.position[0], position[2] - safePose.position[2]) < 16 ? safePose : null;
  }
  function startRecovery(reason) {
    const target = recoveryTarget(reason);
    recoveryMonitor.reset(3);
    if (!target) return;
    recovery = { from: [...position], rotation: [...rotation], target, elapsed: 0 };
    recoveries++; lastRecovery = reason; steering = 0;
  }
  function recoverStep() {
    recovery.elapsed += STEP;
    const t = Math.min(1, recovery.elapsed / 1.6), blend = t * t * (3 - 2 * t);
    const { from, target } = recovery;
    position = from.map((v, i) => v + (target.position[i] - v) * blend);
    // Lift before rolling so the roof and arms clear the terrain. The smooth
    // arc also gives the chase camera time to follow without a teleport.
    position[1] += Math.sin(Math.PI * t) ** 2 * 1.4;
    let q = target.rotation, cosine = dot(recovery.rotation, q);
    if (cosine < 0) { q = scale(q, -1); cosine = -cosine; }
    const angle = Math.acos(clamp(cosine, -1, 1));
    rotation = angle < .001 ? [...q] : add(scale(recovery.rotation, Math.sin((1 - blend) * angle) / Math.sin(angle)), scale(q, Math.sin(blend * angle) / Math.sin(angle)));
    velocity = [0, 0, 0]; angular = [0, 0, 0]; signedSpeed = 0;
    b3.b3Body_SetTransform(body, sub(position, origin), rotation);
    b3.b3Body_SetLinearVelocity(body, velocity); b3.b3Body_SetAngularVelocity(body, angular);
    if (t === 1) { recovery = null; recoveryMonitor.reset(3); }
  }
  function update(dt, throttle = 0, turn = 0, boost = false) {
    accumulator += Math.min(.1, Math.max(0, dt));
    while (accumulator >= STEP) {
      read(); patch();
      if (recovery) { recoverStep(); accumulator -= STEP; continue; }
      const maximumAngle = .58 / (1 + Math.abs(signedSpeed) * .06);
      steering += (turn * maximumAngle - steering) * (1 - Math.exp(-STEP * 7));
      contacts(throttle, boost, true);
      b3.b3World_Step(world, STEP, 2); distance += signedSpeed * STEP; accumulator -= STEP;
      const up = rotate([0, 1, 0], rotation)[1];
      if (up > .85 && wheels.every(w => w.contact) && Math.hypot(...angular) < .5 &&
          (!safePose || Math.hypot(position[0] - safePose.position[0], position[2] - safePose.position[2]) > 3)) {
        safePose = { position: [...position], rotation: [...rotation] };
      }
      const reason = recoveryMonitor.update(STEP, { position, up, speed: Math.hypot(velocity[0], velocity[2]),
        verticalSpeed: velocity[1], angularSpeed: Math.hypot(...angular), throttle });
      if (reason) startRecovery(reason);
    }
    read(); contacts(0, false, false);
    if (recovery) for (const wheel of wheels) wheel.contact = wheel.sand = false;
  }
  function capture() { return { position: [...position], rotation: [...rotation], velocity: [...velocity], angular: [...angular], steering, distance, spins: wheels.map(w => w.spin) }; }
  function restore(state) {
    recovery = safePose = null; recoveryMonitor.reset();
    position = [...state.position]; rotation = [...state.rotation]; velocity = [...state.velocity]; angular = [...state.angular];
    steering = state.steering; distance = state.distance; accumulator = 0;
    wheels.forEach((w, i) => { w.spin = state.spins[i]; });
    patchX = Infinity; patch();
    b3.b3Body_SetTransform(body, sub(position, origin), rotation);
    b3.b3Body_SetLinearVelocity(body, velocity); b3.b3Body_SetAngularVelocity(body, angular);
    read(); contacts(0, false, false);
  }
  patch(); for (let i = 0; i < 180; i++) update(STEP);
  const cameraCenter = [0, 0, 0];
  function cameraFraction(target, eye, radius = .3) {
    // Orbiting at maximum zoom can extend beyond the old physics patch.
    // Recenter before querying so the whole camera boom has collision data.
    if ([target, eye].some(p => Math.abs(p[0] - patchX) > PATCH_RADIUS - 2 || Math.abs(p[2] - patchZ) > PATCH_RADIUS - 2)) patch(true);
    let closest = 1;
    b3.b3World_CastShape(world, sub(target, origin), cameraCenter, radius, sub(eye, target), query, (id, point, normal, fraction) => {
      closest = Math.min(closest, fraction); return closest;
    });
    return closest;
  }
  return { wheels, update, capture, restore, cameraFraction,
    get position() { return position; }, get rotation() { return rotation; }, get velocity() { return velocity; },
    get angularVelocity() { return angular; },
    get recovering() { return recovery !== null; },
    get speed() { return Math.hypot(velocity[0], velocity[2]); }, get signedSpeed() { return signedSpeed; },
    get yaw() { const f = rotate([0, 0, -1], rotation); return Math.atan2(-f[0], -f[2]); },
    get steering() { return steering; }, get distance() { return distance; },
    get diagnostics() { return { engine: 'Box3D 0.1.1', step: STEP, mass, contacts: wheels.filter(w => w.contact).length, stoneContacts: wheels.filter(w => w.contact && !w.sand).length, recovering: recovery !== null, recoveries, lastRecovery, patch: [patchX, patchZ], patchMs, sharedRockMeshes: rockMeshes.size, bodies: staticBodies.length + 2, nearbyRocks, rockTriangles }; },
    dispose() { clearPatch(); for (const data of rockMeshes.values()) b3.b3DestroyMesh(data); rockMeshes.clear(); b3.b3DestroyWorld(world); }
  };
}
