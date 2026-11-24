import { Scene, InstancedMesh, PlaneGeometry, MeshBasicNodeMaterial, InstancedBufferAttribute, DataTexture, DepthTexture, LessEqualCompare, DynamicDrawUsage, LinearFilter, LinearMipmapLinearFilter, Color, Object3D, Quaternion, Vector3 } from 'three/webgpu';
import { Fn, If, attribute, texture, cubeTexture, uv, vec2, vec3, vec4, float, uniform, mix, smoothstep as smoothstepNode, screenUV, positionView, positionWorld, getViewPosition } from 'three/tsl';
import { fbm, noise, randomSeed, clamp, smoothstep } from './noise.js';

// Four seamless-edged, seeded density stamps. No image download or per-frame
// texture generation: wind wisps, airborne dust and ballistic sand share this atlas.
function createDustTexture() {
  const tileSize = 128, size = tileSize * 2, pixels = new Uint8Array(size * size * 4);
  for (let tile = 0; tile < 4; tile++) for (let y = 0; y < tileSize; y++) for (let x = 0; x < tileSize; x++) {
    const u = (x + .5) / tileSize * 2 - 1, v = (y + .5) / tileSize * 2 - 1;
    const warp = noise(u * 2.8, v * 2.8, tile * 13 + 5);
    const radius = Math.hypot(u, v) + warp * .12;
    const edge = 1 - smoothstep(.30, .96, radius);
    const billow = fbm(u * 3.2 + 31, v * 3.2, tile * 9 + 17, 4);
    const density = clamp((.58 + billow * .9) * edge * edge, 0, 1);
    const i = ((y + Math.floor(tile / 2) * tileSize) * size + x + tile % 2 * tileSize) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 255; pixels[i + 3] = Math.round(density * 255);
  }
  const map = new DataTexture(pixels, size, size);
  map.name = 'Procedural sand dust / four density stamps'; map.generateMipmaps = true;
  map.minFilter = LinearMipmapLinearFilter; map.magFilter = LinearFilter; map.needsUpdate = true;
  return map;
}

export function createDust(camera, landscape, atmosphere) {
  const scene = new Scene(); scene.name = 'Windblown dust and tire spray';
  // This pass is composited after GI. Transparent particles must not become
  // opaque surfaces in the normal, velocity or mirage terrain-mask buffers.
  let savedAlpha = 1;
  scene.onBeforeRender = renderer => { savedAlpha = renderer.getClearAlpha(); renderer.setClearAlpha(0); };
  scene.onAfterRender = renderer => renderer.setClearAlpha(savedAlpha);
  const capacity = 1024, windCount = 128, localWindCount = 48, random = randomSeed(150033);
  // Fixed sources at rock toes, dune saddles and distant outcrops. These
  // continue drifting in world space when the rover moves or the view changes.
  // x, z, scatter radius, puff size, lift above the local terrain (metres).
  const dustZones = [
    [-140, 90, 28, 18, 1.8], [145, 60, 35, 20, 2.4],
    [-210, -120, 45, 25, 2.8], [230, -170, 45, 24, 2.5],
    [-130, -310, 24, 12, 2.2], [125, -430, 35, 18, 3],
    [-290, -540, 55, 34, 4], [300, -660, 60, 35, 5],
    [-470, -920, 70, 45, 6], [490, -1040, 90, 52, 7],
    [-700, -1450, 110, 68, 8], [880, -1800, 120, 80, 9],
    [-1150, -2400, 130, 90, 12], [1500, -3500, 160, 110, 15],
    [-350, 280, 50, 30, 3], [340, 300, 50, 28, 3]
  ];
  const map = createDustTexture(), geometry = new PlaneGeometry(1, 1);
  const data = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4).setUsage(DynamicDrawUsage);
  const terrainSun = new InstancedBufferAttribute(new Float32Array(capacity), 1).setUsage(DynamicDrawUsage);
  geometry.setAttribute('dustData', data);
  geometry.setAttribute('dustSun', terrainSun);
  const material = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
  const values = attribute('dustData', 'vec4');
  // Each tile occupies half the atlas; retain a half-texel gutter when sampling.
  const tileUV = uv().mul(.992).add(.004).add(vec2(values.y.mod(2), values.y.div(2).floor())).mul(.5);
  const density = texture(map, tileUV).a;
  const sunColor = uniform(new Color()), skyFill = uniform(1), sunDirection = uniform(atmosphere.sun.position);
  // Sample the already rendered atlas. Creating a new shadow-rendering node
  // here would replace the landscape shadows with this particle-only scene.
  const fallbackDepth = new DepthTexture(1, 1); fallbackDepth.compareFunction = LessEqualCompare;
  const shadowTexture = texture(fallbackDepth), shadowReady = uniform(0), shadow = atmosphere.sun.shadow;
  const cascades = Array.from({ length: shadow.getViewportCount() }, (_, i) => ({
    matrix: uniform('mat4').onRenderUpdate(() => shadow.getMatrix(i)),
    range: uniform('vec4').onRenderUpdate(() => shadow._cascadeData[i])
  }));
  const sunlightVisibility = Fn(() => {
    const visibility = float(1).toVar(), viewDepth = positionView.z.negate().toVar();
    for (let i = cascades.length - 1; i >= 0; i--) {
      const { matrix, range } = cascades[i];
      If(viewDepth.greaterThanEqual(range.x).and(viewDepth.lessThan(range.y)), () => {
        const projected = matrix.mul(vec4(positionWorld.add(sunDirection.mul(.025)), 1));
        const coord = projected.xyz.div(projected.w).toVar();
        const visibilityHere = shadowTexture.sample(vec2(coord.x, coord.y.oneMinus())).compare(coord.z.sub(.000005));
        visibility.assign(mix(visibilityHere, visibility, smoothstepNode(range.z, range.y, viewDepth)));
      });
    }
    return mix(1, visibility, shadowReady);
  })();
  const eye = uniform(camera.position), albedo = new Color('#c6ae84');
  const towardSun = positionWorld.sub(eye).normalize().dot(sunDirection.normalize()).max(0);
  const scattering = towardSun.pow(5).mul(.75).add(.72);
  const skylight = cubeTexture(atmosphere.skyCube.texture, vec3(0, 1, 0)).rgb.mul(skyFill);
  const lighting = sunColor.mul(scattering).mul(atmosphere.cloudShadows.node).mul(sunlightVisibility).mul(attribute('dustSun', 'float')).add(skylight);
  const color = vec3(albedo.r, albedo.g, albedo.b).mul(lighting).mul(values.w);
  material.colorNode = atmosphere.applyHaze(color, positionView, positionWorld, float(0));
  const nearFade = positionView.length().smoothstep(.7, 2.2);
  material.opacityNode = density.mul(values.x).mul(nearFade);
  const mesh = new InstancedMesh(geometry, material, capacity);
  mesh.name = 'Sorted dust billboards'; mesh.count = 0; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(DynamicDrawUsage); scene.add(mesh);
  const particles = Array.from({ length: capacity }, (_, i) => ({ age: Infinity, life: 0, kind: 'wake',
    zone: i >= localWindCount && i < windCount ? (i - localWindCount) % dustZones.length : -1 }));
  const visible = [], dummy = new Object3D(), spin = new Quaternion(), axisZ = new Vector3(0, 0, 1);
  const rotation = new Quaternion(), forward = new Vector3(), normal = new Vector3(), pointVelocity = new Vector3();
  const offset = new Vector3(), angular = new Vector3(), bodyVelocity = new Vector3(), windAnchor = new Vector3(Infinity, 0, Infinity);
  const credits = new Float64Array(4), lastRover = new Vector3(Infinity, 0, Infinity);
  let cursor = windCount, clock = 0, emitted = 0, prepared = 0, zonesInitialized = false;
  let currentSettings = { dust: 2, wheelDust: 1, sun: 4.3, ambient: 1 };

  function windParticle(p, initial = false) {
    const zone = dustZones[p.zone], angle = random() * Math.PI * 2;
    const radius = zone ? Math.sqrt(random()) * zone[2] : 12 + Math.sqrt(random()) * 135;
    p.kind = 'wind'; p.x = (zone ? zone[0] : camera.position.x) + Math.sin(angle) * radius;
    p.z = (zone ? zone[1] : camera.position.z) + Math.cos(angle) * radius;
    p.lift = zone ? zone[4] * (.65 + random() * .55) : .8;
    p.gustPhase = random() * Math.PI * 2;
    p.ground = landscape.heightAt(p.x, p.z); p.y = p.ground + p.lift;
    p.life = zone ? 18 + random() * 22 : 9 + random() * 9; p.age = initial ? random() * p.life : 0;
    p.size = zone ? zone[3] * (.65 + random() * .65) : 8 + random() * 14;
    p.aspect = 2.4 + random(); p.angle = (random() - .5) * .18;
    p.tile = Math.floor(random() * 4); p.opacity = zone ? .10 + random() * .06 : .12 + random() * .10; p.shade = .92 + random() * .15;
    p.vx = zone ? 2.2 + random() * 1.7 : .9 + random() * .6; p.vz = zone ? .45 + random() * .5 : .28 + random() * .25;
  }
  function emit(wheel, velocity, longitudinal, lateral, amount, grain) {
    const p = particles[cursor]; cursor = cursor + 1 === capacity ? windCount : cursor + 1;
    const sign = Math.sign(longitudinal) || 1, kick = (.65 + Math.abs(longitudinal) * .13 + Math.abs(lateral) * .3) * (grain ? 1.8 : 1);
    const sideways = wheel.side * (.12 + random() * .35), scatter = (random() - .5) * .5;
    p.kind = grain ? 'grain' : 'wake'; p.age = 0; p.life = grain ? .4 + random() * .45 : 1.8 + random() * 1.6;
    p.x = wheel.point[0] - forward.x * sign * .14 + (random() - .5) * .16;
    p.y = wheel.point[1] + .06; p.z = wheel.point[2] - forward.z * sign * .14 + (random() - .5) * .16;
    p.ground = wheel.point[1];
    p.vx = -forward.x * sign * kick + velocity.x * .12 - forward.z * sideways + scatter;
    p.vz = -forward.z * sign * kick + velocity.z * .12 + forward.x * sideways - scatter;
    p.vy = (grain ? .9 + random() * 1.4 : .4 + random() * .65) + Math.abs(longitudinal) * .025;
    p.size = grain ? .035 + random() * .055 : .24 + random() * .23;
    p.aspect = grain ? .55 + random() * .4 : 1 + random() * .35;
    p.angle = random() * Math.PI * 2; p.spin = (random() - .5) * 1.2; p.tile = Math.floor(random() * 4);
    p.opacity = (grain ? .8 : .5) * amount; p.shade = grain ? .65 + random() * .3 : .88 + random() * .2;
    emitted++;
  }
  function update(dt, rover, settings) {
    currentSettings = settings;
    const ambientDt = settings.paused ? 0 : Math.min(.1, dt);
    // Driving remains interactive while ambient animation is paused. Its
    // emitted dust must also finish drifting and settling after a stop.
    const wheelDt = Math.min(.1, dt);
    clock += ambientDt;
    if (Math.hypot(camera.position.x - windAnchor.x, camera.position.z - windAnchor.z) > 180) {
      for (let i = 0; i < localWindCount; i++) windParticle(particles[i], true);
    }
    if (!zonesInitialized) { for (let i = localWindCount; i < windCount; i++) windParticle(particles[i], true); zonesInitialized = true; }
    windAnchor.copy(camera.position);
    for (let i = 0; i < capacity; i++) {
      const p = particles[i], step = p.kind === 'wind' ? ambientDt : wheelDt;
      if (p.age >= p.life) { if (i < windCount && ambientDt > 0) windParticle(p); continue; }
      p.age += step;
      if (p.kind === 'wind') {
        const gust = p.zone >= 0 ? .65 + Math.sin(clock * .2 + p.gustPhase) ** 2 * .7 : 1;
        p.x += p.vx * step * gust; p.z += p.vz * step * gust;
        p.ground = landscape.heightAt(p.x, p.z); p.y += (p.ground + p.lift * gust - p.y) * (1 - Math.exp(-step * 2));
        if (p.zone < 0 && Math.hypot(p.x - camera.position.x, p.z - camera.position.z) > 180) p.age = p.life;
      } else {
        const drag = Math.exp(-step * (p.kind === 'grain' ? .6 : 1.4));
        p.vx = .8 + (p.vx - .8) * drag; p.vz = .25 + (p.vz - .25) * drag;
        p.vy -= (p.kind === 'grain' ? 6.5 : .15) * step;
        p.x += p.vx * step; p.z += p.vz * step; p.y += p.vy * step;
        const ground = landscape.heightAt(p.x, p.z);
        if (p.kind === 'grain' && p.y < ground + .015) p.age = p.life;
        else p.y = Math.max(ground + .03, p.y);
      }
    }
    const physics = rover.physics;
    if (rover.position.distanceTo(lastRover) > 15) credits.fill(0);
    lastRover.copy(rover.position);
    rotation.fromArray(physics.rotation); angular.fromArray(physics.angularVelocity);
    bodyVelocity.fromArray(physics.velocity);
    physics.wheels.forEach((wheel, i) => {
      if (!rover.active || !wheel.contact || !wheel.sand || settings.wheelDust <= 0 || wheelDt <= 0) { credits[i] = 0; return; }
      normal.fromArray(wheel.normal);
      forward.set(-Math.sin(wheel.angle), 0, -Math.cos(wheel.angle)).applyQuaternion(rotation);
      forward.addScaledVector(normal, -forward.dot(normal)).normalize();
      offset.set(wheel.point[0] - physics.position[0], wheel.point[1] - physics.position[1], wheel.point[2] - physics.position[2]);
      pointVelocity.crossVectors(angular, offset).add(bodyVelocity);
      const longitudinal = pointVelocity.dot(forward), speed = Math.abs(longitudinal);
      const lateral = pointVelocity.x * -forward.z + pointVelocity.z * forward.x;
      if (speed < .45) { credits[i] = 0; return; }
      credits[i] += Math.min(52, 5 + speed * 2.6 + Math.abs(lateral) * 5) * wheelDt;
      const amount = smoothstep(.45, 3, speed) * (.65 + Math.min(.5, Math.abs(lateral) * .16));
      while (credits[i] >= 1) { emit(wheel, pointVelocity, longitudinal, lateral, amount, false); emit(wheel, pointVelocity, longitudinal, lateral, amount, true); credits[i]--; }
    });
  }
  function prepare() {
    sunColor.value.copy(atmosphere.sun.color).multiplyScalar(atmosphere.sun.intensity * .30);
    skyFill.value = currentSettings.ambient * 1.8;
    if (shadow.map) { shadowTexture.value = shadow.map.depthTexture; shadowReady.value = 1; }
    visible.length = 0;
    const e = camera.matrixWorldInverse.elements;
    for (const p of particles) {
      if (p.age >= p.life) continue;
      const amount = p.kind === 'wind' ? currentSettings.dust : currentSettings.wheelDust;
      if (!amount) continue;
      const t = p.age / p.life;
      p.alpha = p.opacity * amount * smoothstep(0, p.kind === 'wind' ? .18 : .07, t) * (1 - smoothstep(.3, 1, t));
      if (p.zone >= 0) {
        p.alpha *= .45 + Math.sin(clock * .17 + p.gustPhase) ** 2 * .55;
        // Keep drifting banks thin over the central reflective playa.
        const central = (1 - smoothstep(70, 145, Math.abs(p.x))) * smoothstep(-850, -650, p.z) * (1 - smoothstep(0, 100, p.z));
        p.alpha *= 1 - central * .7;
      }
      p.depth = -(e[2] * p.x + e[6] * p.y + e[10] * p.z + e[14]);
      if (p.alpha > .001 && p.depth > 0) visible.push(p);
    }
    visible.sort((a, b) => b.depth - a.depth);
    const light = atmosphere.sun.position;
    for (let i = 0; i < visible.length; i++) {
      const p = visible[i], size = p.kind === 'wake' ? p.size + p.age * .72 : p.size;
      // Dunes do not cast into the expensive geometry atlas. Trace a short
      // heightfield horizon for each puff so lee-side dust is shaded too.
      let terrainVisibility = 1;
      for (const distance of [1, 2, 4, 8, 16, 32, 64, 128]) {
        const ground = landscape.heightAt(p.x + light.x * distance, p.z + light.z * distance);
        terrainVisibility = Math.min(terrainVisibility, smoothstep(-.2, .35, p.y + light.y * distance - ground));
        if (terrainVisibility === 0) break;
      }
      terrainSun.setX(i, terrainVisibility);
      dummy.position.set(p.x, p.y, p.z); spin.setFromAxisAngle(axisZ, p.angle + (p.spin || 0) * p.age);
      dummy.quaternion.copy(camera.quaternion).multiply(spin); dummy.scale.set(size * p.aspect, size, 1); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); data.setXYZW(i, p.alpha, p.tile, p.kind === 'grain' ? .06 : Math.max(.18, size * .25), p.shade);
    }
    mesh.count = visible.length; mesh.instanceMatrix.needsUpdate = true; data.needsUpdate = true; terrainSun.needsUpdate = true; prepared++;
  }
  return { scene, mesh, material, map, particles, ambientCount: windCount, dustZones,
    connectDepth(depth) {
      const inverse = uniform(camera.projectionMatrixInverse);
      const surface = getViewPosition(screenUV, depth.sample(screenUV).r, inverse);
      const softIntersection = positionView.z.sub(surface.z).div(values.z).clamp(0, 1);
      material.opacityNode = density.mul(values.x).mul(nearFade).mul(softIntersection);
      material.needsUpdate = true;
    },
    update, prepare,
    get needsFrame() { return currentSettings.wheelDust > 0 && particles.some(p => p.kind !== 'wind' && p.age < p.life); },
    clear() { for (const p of particles) p.age = Infinity; credits.fill(0); windAnchor.set(Infinity, 0, Infinity); zonesInitialized = false; emitted = 0; mesh.count = 0; },
    get diagnostics() { return { capacity, alive: particles.filter(p => p.age < p.life).length, wind: particles.slice(0, windCount).filter(p => p.age < p.life).length, regional: particles.filter(p => p.zone >= 0 && p.age < p.life).length, zones: dustZones.length, wheel: particles.slice(windCount).filter(p => p.age < p.life).length, visible: mesh.count, emitted, prepared, clock }; },
    dispose() { scene.remove(mesh); mesh.dispose(); geometry.dispose(); material.dispose(); map.dispose(); fallbackDepth.dispose(); }
  };
}
