import * as THREE from "three/webgpu";
import {
  Fn,
  If,
  Loop,
  instancedArray,
  instanceIndex,
  uniformArray,
  float,
  attribute,
  positionView,
  uniform,
  uv,
  vec3,
  cameraPosition,
  mix,
  color,
} from "three/tsl";

export function createDust(scene, opaqueViewZ, focus) {
  const count = 4000,
    plane = new THREE.PlaneGeometry(1, 1),
    geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes = plane.attributes;
  geometry.instanceCount = count;
  const data = new Float32Array(count * 4);
  let state = 931;
  const random = () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++)
    data.set([random(), random(), random(), random()], i * 4);
  geometry.setAttribute(
    "dustSeed",
    new THREE.InstancedBufferAttribute(data, 4),
  );
  const clock = uniform(0),
    strength = uniform(0.35),
    seed = attribute("dustSeed", "vec4");
  const seeds = instancedArray(data, "vec4");
  const positions = instancedArray(count, "vec3"),
    velocities = instancedArray(count, "vec3");
  const volumeCenter = uniform(new THREE.Vector3(0, 0, 3.15)),
    delta = uniform(0);
  const wakePositions = uniformArray(
    Array.from({ length: 32 }, () => new THREE.Vector4()),
  );
  const wakeVelocities = uniformArray(
    Array.from({ length: 32 }, () => new THREE.Vector4()),
  );
  const wakeCount = uniform(0, "int");
  const shockPositions = uniformArray(
    Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, 0, 100)),
  );
  const shockPower = uniformArray([0, 0, 0, 0], "float");
  const halfBox = vec3(6, 4, 11),
    box = halfBox.mul(2);
  const initialize = Fn(() => {
    positions
      .element(instanceIndex)
      .assign(
        seeds.element(instanceIndex).xyz.sub(0.5).mul(box).add(volumeCenter),
      );
    velocities.element(instanceIndex).assign(vec3(0));
  })().compute(count);
  const compute = Fn(() => {
    const p = positions.element(instanceIndex),
      v = velocities.element(instanceIndex);
    const s = seeds.element(instanceIndex);
    const relative = p.sub(volumeCenter).add(halfBox).toVar();
    const wrapped = relative
      .sub(relative.div(box).floor().mul(box))
      .sub(halfBox)
      .add(volumeCenter)
      .toVar();
    If(p.sub(wrapped).length().greaterThan(1), () => {
      v.assign(vec3(0));
    });
    p.assign(wrapped);
    v.mulAssign(delta.mul(-1.8).exp());
    // Tiny ambient currents remain, with momentum carried by each mote.
    const breeze = vec3(
      clock.mul(0.3).add(s.y.mul(30)).sin(),
      clock.mul(0.2).add(s.z.mul(20)).cos().mul(0.5),
      s.x.sub(0.5),
    );
    v.addAssign(breeze.mul(delta).mul(0.09));
    Loop({ start: 0, end: wakeCount, type: "int" }, ({ i }) => {
      const body = wakePositions.element(i),
        motion = wakeVelocities.element(i);
      const offset = p.sub(body.xyz).toVar(),
        d2 = offset.dot(offset).toVar();
      const influence = d2
        .div(body.w)
        .negate()
        .exp()
        .mul(motion.w)
        .mul(delta)
        .toVar();
      v.addAssign(motion.xyz.sub(v).mul(influence).mul(2.8));
      // Metal pushes nearby motes outward as well as entraining its wake.
      v.addAssign(offset.div(d2.sqrt().max(0.04)).mul(influence).mul(0.32));
    });
    Loop(4, ({ i }) => {
      const shock = shockPositions.element(i),
        age = shock.w;
      const offset = p.sub(shock.xyz).toVar(),
        distance = offset.length().max(0.03).toVar();
      const shell = distance.sub(age.mul(3.4)).div(0.3).pow2().negate().exp();
      const power = shell
        .mul(age.mul(-2).exp())
        .mul(shockPower.element(i))
        .mul(delta)
        .mul(18);
      v.addAssign(offset.div(distance).mul(power));
    });
    v.mulAssign(float(4).div(v.length().max(4)));
    p.addAssign(v.mul(delta));
  })().compute(count);
  const center = positions.toAttribute();
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.positionNode = center;
  const distance = center.sub(cameraPosition).length();
  const size = seed.w.pow(4).mul(0.008).add(0.0015);
  const blur = distance.sub(focus).abs().mul(0.004).min(0.035);
  const rendered = size.add(blur);
  material.scaleNode = rendered;
  material.colorNode = mix(
    color("#81b8c3"),
    color("#f5be85"),
    seed.x.smoothstep(0.4, 0.85),
  );
  const disc = uv().sub(0.5).length().mul(2).smoothstep(0.55, 1).oneMinus();
  const depth = positionView.z.sub(opaqueViewZ).smoothstep(0, 0.05);
  material.opacityNode = disc
    .mul(strength)
    .mul(size.div(rendered).pow(1.3))
    .mul(depth)
    .mul(distance.smoothstep(0.1, 0.8))
    .mul(distance.smoothstep(8, 13).oneMinus());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  let pending = 0,
    initialized = false,
    nextShock = 0;
  return {
    clock,
    strength,
    mesh,
    positions,
    velocities,
    get wakeCount() {
      return wakeCount.value;
    },
    advance(dt) {
      pending += dt;
      for (const shock of shockPositions.array) shock.w += dt;
    },
    burst(point, power = 1) {
      shockPositions.array[nextShock].set(point.x, point.y, point.z, 0);
      shockPower.array[nextShock] = power;
      nextShock = (nextShock + 1) % 4;
    },
    clear() {
      pending = 0;
      initialized = false;
      for (const shock of shockPositions.array) shock.w = 100;
    },
    update(renderer, journey, camera) {
      mesh.visible = strength.value > 0;
      if (!mesh.visible) {
        // Recreate the volume around the current camera if dust is enabled
        // again. Disabled dust needs neither wake sorting nor GPU dispatches.
        pending = 0;
        initialized = false;
        wakeCount.value = 0;
        return;
      }
      volumeCenter.value.copy(camera.position);
      if (!initialized) {
        renderer.compute(initialize);
        initialized = true;
      }
      if (pending <= 0) return;
      const bodies = [];
      for (const shot of journey.shots) {
        if (shot === journey.next) continue;
        for (const body of [
          ...shot.simulation.links,
          ...shot.simulation.fragments,
        ]) {
          if (!body) continue;
          const p = body.position,
            v = body.velocity;
          const distance =
            (p[0] - camera.position.x) ** 2 +
            (p[1] - camera.position.y) ** 2 +
            (p[2] + shot.z - camera.position.z) ** 2;
          const speed = Math.hypot(...v);
          if (distance < 64 && speed > 0.04)
            bodies.push({
              p,
              v,
              z: shot.z,
              distance,
              speed,
              radius: 0.4,
            });
        }
      }
      bodies.sort((a, b) => a.distance - b.distance);
      wakeCount.value = Math.min(32, bodies.length);
      for (let i = 0; i < wakeCount.value; i++) {
        const { p, v, z, speed, radius } = bodies[i];
        wakePositions.array[i].set(p[0], p[1], p[2] + z, radius);
        wakeVelocities.array[i].set(...v, Math.min(1, speed * 0.65));
      }
      // One dispatch per rendered frame, independent of the rigid-body substeps.
      delta.value = Math.min(pending, 0.05);
      renderer.compute(compute);
      pending = 0;
    },
    dispose() {
      initialize.dispose();
      compute.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

// Short-lived fracture glints: ballistic motion and lens discs stay on the GPU.
export function createSparks(scene, opaqueViewZ, focus) {
  const bursts = Array.from({ length: 3 }, () =>
    createSparkBurst(scene, opaqueViewZ, focus),
  );
  let current = 0;
  return {
    get age() {
      return bursts[current].age;
    },
    burst(point) {
      current = (current + 1) % bursts.length;
      bursts[current].burst(point);
    },
    update(dt) {
      for (const burst of bursts) burst.update(dt);
    },
    clear() {
      for (const burst of bursts) burst.clear();
    },
    dispose() {
      for (const burst of bursts) burst.dispose();
    },
  };
}
function createSparkBurst(scene, opaqueViewZ, focus) {
  const plane = new THREE.PlaneGeometry(1, 1),
    geometry = new THREE.InstancedBufferGeometry();
  geometry.index = plane.index;
  geometry.attributes = plane.attributes;
  geometry.instanceCount = 240;
  const values = new Float32Array(240 * 4);
  let state = 713;
  const random = () =>
    (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 240; i++)
    values.set([random(), random(), random(), random()], i * 4);
  geometry.setAttribute(
    "sparkSeed",
    new THREE.InstancedBufferAttribute(values, 4),
  );
  const age = uniform(100),
    origin = uniform(new THREE.Vector3()),
    seed = attribute("sparkSeed", "vec4"),
    t = age.min(4);
  const azimuth = seed.x.mul(Math.PI * 2),
    z = seed.y.mul(2).sub(1),
    radius = z.pow2().oneMinus().sqrt();
  const speed = seed.z.pow(2).mul(5).add(0.8);
  const velocity = vec3(
    azimuth.cos().mul(radius),
    azimuth.sin().mul(radius).add(0.16),
    z.mul(0.85),
  ).mul(speed);
  const center = origin.add(velocity.mul(t)).sub(vec3(0, t.pow2().mul(0.5), 0));
  const size = seed.w.pow(3).mul(0.013).add(0.003);
  const distance = cameraPosition.z.sub(center.z).abs();
  const blur = distance.sub(focus).abs().mul(0.028).min(0.12),
    rendered = size.add(blur);
  const material = new THREE.SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  material.positionNode = center;
  material.scaleNode = rendered;
  material.colorNode = mix(color("#ffb16a"), color("#fff0d5"), seed.w).mul(
    seed.z.mul(2).add(2),
  );
  const disc = uv().sub(0.5).length().mul(2).smoothstep(0.35, 1).oneMinus();
  const lifetime = age.smoothstep(0.08, 1.25).oneMinus();
  const depth = positionView.z.sub(opaqueViewZ).smoothstep(0, 0.02);
  material.opacityNode = disc
    .mul(lifetime)
    .mul(size.div(rendered).pow(1.35))
    .mul(depth);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  scene.add(mesh);
  return {
    age,
    burst(point) {
      origin.value.copy(point);
      age.value = 0;
    },
    update(dt) {
      age.value += dt;
    },
    clear() {
      age.value = 100;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
