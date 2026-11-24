import { DataUtils } from 'three/webgpu';

function assert(value, message) { if (!value) throw new Error(message); }

export function checkRocks(app = window.mirage) {
  const reports = [];
  for (const geometry of [...app.landscape.variants, app.landscape.bedrock.geometry]) {
    const p = geometry.attributes.position, normal = geometry.attributes.normal, index = geometry.index.array;
    const edges = new Map();
    for (let i = 0; i < p.count; i++) {
      assert(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), `${geometry.name}: nonfinite vertex`);
      assert(Number.isFinite(geometry.attributes.sediment.getX(i)), `${geometry.name}: invalid sediment`);
      const weathering = geometry.attributes.weathering.getX(i);
      assert(weathering >= 0 && weathering <= 1, `${geometry.name}: invalid weathering`);
      const curvature = geometry.attributes.curvature.getX(i);
      assert(Number.isFinite(curvature) && curvature >= -1 && curvature <= 1, `${geometry.name}: invalid signed curvature`);
      const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
      assert(Math.abs(length - 1) < .001, `${geometry.name}: invalid normal`);
    }
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i], b = index[i + 1], c = index[i + 2];
      assert(a !== b && a !== c && b !== c, `${geometry.name}: collapsed triangle`);
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const key = Math.min(u, v) * p.count + Math.max(u, v);
        edges.set(key, (edges.get(key) || 0) + 1);
      }
    }
    assert([...edges.values()].every(count => count === 2), `${geometry.name}: open or nonmanifold seam`);
    assert(p.count - edges.size + index.length / 3 === 2, `${geometry.name}: unexpected topology`);
    reports.push({ name: geometry.name, vertices: p.count, triangles: index.length / 3, closed: true });
  }
  return reports;
}

export async function checkRendering(app = window.mirage) {
  assert(app.ready, 'Wait for startup to finish');
  const { renderer, meshlets, settings, camera, navigation, post } = app;
  const manual = app.manual, saved = { ...settings }, eye = camera.position.clone(), target = navigation.controls.target.clone();
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await renderer.backend.device.queue.onSubmittedWorkDone(); };
  const report = { views: [], effects: {} };
  app.manual = true; settings.drift = false;
  renderer.backend.device.pushErrorScope('validation');
  let failure;
  async function audit(label) {
    const pool = meshlets._geometryPool, limit = renderer.backend.device.limits.maxStorageBufferBindingSize;
    assert(pool.vertexArray.byteLength <= limit && pool.indexArray.byteLength <= limit, 'Meshlet geometry allocation exceeds the device binding limit');
    let instances = 0, visible = 0, maxOverflow = 0;
    const snapshots = [];
    for (const reference of meshlets._records) {
      const record = reference.deref(), culling = record?.culling;
      if (!culling) continue;
      const mainView = !culling.shadow && culling.cameraPosition.value.distanceTo(camera.position) < .001;
      // Cached reflection/shadow views can have new, unuploaded counters after
      // asynchronous queue resizing. They have no GPU work to audit until drawn.
      if (!renderer.backend.get(culling.countersAttribute).buffer) {
        assert(!mainView, `${label}: main-view GPU counters were not uploaded`);
        continue;
      }
      const entries = [...record.entries, ...[...record.staticGroups.values()].flatMap(g => g.entries)].filter(e => e.count > 0)
        .map(e => ({ count: e.count, batch: e.batch }));
      // Queue every copy before yielding: asynchronous capacity calibration
      // may retire another view's old GPU counter buffer while a read awaits.
      snapshots.push({ culling, mainView, entries, counts: renderer.getArrayBufferAsync(culling.countersAttribute) });
    }
    const counters = await Promise.all(snapshots.map(s => s.counts));
    for (const [i, { culling, mainView, entries }] of snapshots.entries()) {
      const counts = new Uint32Array(counters[i]);
      for (const entry of entries) {
        assert(entry.batch, 'Geometry fell back from meshlet rendering');
        if (mainView) instances += entry.count;
        const used = counts[1 + entry.batch.index * 2] + (entry.batch.ditherQueue ? counts[2 + entry.batch.index * 2] : 0);
        maxOverflow = Math.max(maxOverflow, used - entry.batch.queueCapacity);
      }
      if (mainView) visible += counts[0];
      maxOverflow = Math.max(maxOverflow, counts[0] - culling.capacity.clusters);
    }
    const expected = app.landscape.instances + app.landscape.detailInstances + app.architecture.instances + app.rover.instances + 1 + app.landscape.distanceTerrain.length;
    assert(instances === expected, `${label}: expected ${expected} meshlet instances, saw ${instances}`);
    assert(maxOverflow === 0, `${label}: GPU work queue overflow ${maxOverflow}`);
    assert(visible > 0, `${label}: no visible meshlets`);
    report.views.push({ label, instances, visibleMeshlets: visible, overflow: maxOverflow });
  }
  const pixels = async () => {
    const rt = post.mirageImage.renderTarget;
    return renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
  };
  function difference(a, b) {
    let sum = 0, changed = 0, finite = true;
    for (let i = 0; i < a.length; i += 16) {
      const va = DataUtils.fromHalfFloat(a[i]), vb = DataUtils.fromHalfFloat(b[i]);
      finite &&= Number.isFinite(va) && Number.isFinite(vb);
      const delta = Math.abs(va - vb); sum += delta; if (delta > .001) changed++;
    }
    assert(finite, 'Nonfinite rendered radiance');
    return { meanDifference: sum / (a.length / 16), changedSamples: changed };
  }
  try {
    await frame();
    assert(app.atmosphere.sky.sunPosition.value.angleTo(app.atmosphere.sun.position) < 1e-7, 'Visible sun diverged from SunLight direction');
    assert(app.scene.environment === app.atmosphere.environmentCube.texture, 'Environment lost the sky/cloud capture');
    assert(app.scene.environment !== app.atmosphere.skyCube.texture, 'Cloud IBL leaked into the fog capture');
    assert(renderer.backend.isWebGPUBackend, 'WebGPU is not active');
    assert(renderer.drawingPipeline === meshlets, 'Meshlet pipeline is not active');
    app.atmosphere.sun.shadow.needsUpdate = true; await frame();
    for (const view of ['Overlook', 'Dunes', 'Sanctuary', 'Outcrop', 'Stone']) {
      navigation.setView(view); await frame(); await audit(`${view}: first frame`); await frame(); await audit(`${view}: settled`);
    }
    // Abrupt orbit/zoom changes exercise queues after they have calibrated.
    for (const angle of [-.3, .3]) {
      navigation.setView('Overlook');
      camera.position.sub(navigation.controls.target).applyAxisAngle({ x: 0, y: 1, z: 0 }, angle).multiplyScalar(.6).add(navigation.controls.target);
      camera.lookAt(navigation.controls.target); await frame(); await audit(`orbit ${angle}`);
    }
    const sceneTarget = post.scenePass.renderTarget;
    const velocity = await renderer.readRenderTargetPixelsAsync(sceneTarget, 0, 0, sceneTarget.width, sceneTarget.height, 3);
    let movingSamples = 0;
    for (let i = 0; i < velocity.length; i += 32) {
      const vx = DataUtils.fromHalfFloat(velocity[i]), vy = DataUtils.fromHalfFloat(velocity[i + 1]);
      assert(Number.isFinite(vx + vy), 'Nonfinite motion vector');
      if (Math.abs(vx) + Math.abs(vy) > .0001) movingSamples++;
    }
    assert(movingSamples > 100, 'Camera movement produces no motion vectors for denoising');
    report.motionVectors = movingSamples;
    // Disable temporal GI for deterministic optical-effect comparisons.
    settings.ssgi = false;
    navigation.setView('Dunes'); settings.heat = 0; settings.mirage = 0; await frame();
    const baseline = await pixels();
    settings.heat = 1; await frame(); report.effects.heat = difference(baseline, await pixels());
    assert(report.effects.heat.changedSamples > 100, 'Heat distortion is not visible');
    // The physical grazing band needs a low eye over a clear stretch of playa.
    camera.position.set(0, app.landscape.heightAt(0, -140) + 1.2, -140);
    camera.lookAt(0, camera.position.y, 460);
    settings.heat = 0; settings.mirage = 0; await frame();
    const mirageBaseline = await pixels();
    settings.mirage = 1; await frame(); report.effects.mirage = difference(mirageBaseline, await pixels());
    assert(report.effects.mirage.changedSamples > 30, 'Inferior mirage is not visible');
    navigation.setView('Stone'); settings.heat = 0; settings.mirage = 0; settings.ssgi = true; settings.gi = 0;
    for (let i = 0; i < 10; i++) await frame();
    const unbounced = await pixels();
    settings.gi = 2; await frame();
    report.effects.bounce = difference(unbounced, await pixels());
    assert(report.effects.bounce.changedSamples > 100, 'SSGI adds no visible bounced light');
    const rt = post.indirect.input.renderTarget;
    const indirect = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    let energy = 0, occluded = 0;
    for (let i = 0; i < indirect.length; i += 4) {
      const r = DataUtils.fromHalfFloat(indirect[i]), g = DataUtils.fromHalfFloat(indirect[i + 1]), b = DataUtils.fromHalfFloat(indirect[i + 2]), ao = DataUtils.fromHalfFloat(indirect[i + 3]);
      assert(Number.isFinite(r + g + b + ao), 'SSGI produced nonfinite radiance');
      assert(r >= 0 && g >= 0 && b >= 0 && ao >= 0 && ao <= 1.001, 'SSGI produced invalid radiance or occlusion');
      energy += r + g + b; if (ao < .95) occluded++;
    }
    assert(energy > 1 && occluded > 100, 'SSGI did not gather light or occlusion from the scene');
    assert(!post.needsFrame, 'Temporal GI does not settle');
    post.invalidate(); assert(post.needsFrame, 'Camera/resize reset does not request convergence');
    for (let i = 0; i < 8; i++) await frame();
    assert(!post.needsFrame, 'Temporal GI does not settle after reset');
    report.effects.ssgi = { positiveRadiance: energy, occludedPixels: occluded, width: rt.width, height: rt.height, settled: true };
    settings.paused = true; const time = app.time; app.advance(1); assert(app.time === time, 'Pause advances time');
    report.paused = true;
  } catch (error) { failure = error; }
  finally {
    const error = await renderer.backend.device.popErrorScope(); if (error) failure ||= new Error(error.message);
    Object.assign(settings, saved); navigation.setView(saved.view); camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update(); await frame(); app.manual = manual;
  }
  if (failure) throw failure;
  return report;
}
