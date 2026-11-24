const assert = (value, message) => { if (!value) throw new Error(message); };

// Inspect the actual GPU work queues: transitions must submit both adjacent
// LODs of an instance with the same complementary coverage, in every pass.
export async function checkLodTransitions(app = window.mirage) {
  const { renderer, meshlets, settings, camera, navigation, post } = app;
  const saved = { ...settings }, manual = app.manual, eye = camera.position.clone(), target = navigation.controls.target.clone();
  const device = renderer.backend.device;
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await device.queue.onSubmittedWorkDone(); };
  async function queueRange(culling, offset, count) {
    const buffer = device.createBuffer({ size: count * 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    try {
      const encoder = device.createCommandEncoder();
      encoder.copyBufferToBuffer(renderer.backend.get(culling.queueAttribute).buffer, offset * 16, buffer, 0, count * 16);
      device.queue.submit([encoder.finish()]); await buffer.mapAsync(GPUMapMode.READ);
      return new Uint32Array(buffer.getMappedRange().slice(0));
    } finally { buffer.destroy(); }
  }
  async function audit(enabled) {
    const reports = [];
    for (const ref of meshlets._records) {
      const r = ref.deref(), c = r?.culling; if (!c) continue;
      const records = new Uint32Array(await renderer.getArrayBufferAsync(c.recordAttribute));
      let fading = 0;
      for (let i = 1; i < records.length; i += 4) if ((records[i] & 255) !== 255 && ((records[i] >>> 10) & 63) > 0) fading++;
      if (!enabled) { assert(fading === 0, 'Disabling transitions leaves a stale fade'); continue; }
      assert(fading > 0, 'A render pass is missing LOD transitions');
      const counts = new Uint32Array(await renderer.getArrayBufferAsync(c.countersAttribute));
      const entries = [...r.entries, ...[...r.staticGroups.values()].flatMap(g => g.entries)].filter(e => e.count > 0);
      let pairedInstances = 0;
      for (const entry of entries) {
        const b = entry.batch, near = Math.min(counts[1 + b.index * 2], b.queueCapacity);
        if (b.ditherQueue && !entry.material.maskNode) assert(b.clusterMesh.material.maskNode === null, 'Opaque meshlet queue retained fragment discard');
        const count = b.ditherQueue ? Math.min(counts[2 + b.index * 2], b.queueCapacity - near) : near;
        if (!count) continue;
        const start = b.ditherQueue ? b.queueOffset + b.queueCapacity - count : b.queueOffset;
        const work = await queueRange(c, start, count), instances = new Map();
        for (let i = 0; i < work.length; i += 4) {
          const packed = work[i + 3], coverage = (packed >>> 25) & 63;
          if (!coverage) continue;
          const key = `${work[i]}/${coverage}`, pair = instances.get(key) ?? { bits: 0, starts: new Set() };
          pair.bits |= packed & (1 << 24) ? 2 : 1; pair.starts.add(work[i + 1]); instances.set(key, pair);
        }
        pairedInstances += [...instances.values()].filter(p => p.bits === 3 && p.starts.size === 2).length;
        if (pairedInstances > 10) break;
      }
      assert(pairedInstances > 0, 'Transition submits only one LOD or mismatched coverage');
      reports.push({ pass: c.shadow ? 'shadow' : c.cameraPosition.value.distanceTo(camera.position) < .001 ? 'main' : 'reflection', fading, pairedInstances });
    }
    return reports;
  }
  let report, failure; app.manual = true; device.pushErrorScope('validation');
  try {
    Object.assign(settings, { paused: true, drift: false, heat: 0, ssgi: false, lodDither: true });
    navigation.setView('Overlook'); app.atmosphere.sun.shadow.needsUpdate = true;
    await frame(); await frame(); report = { passes: await audit(true) };
    const rt = post.scenePass.renderTarget;
    const before = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    await frame(); await frame();
    const after = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
    let changed = 0; for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) changed++;
    report.stationaryChangedChannels = changed;
    assert(changed < before.length * .001, 'Stationary dither introduces temporal flicker');
    settings.lodDither = false; await frame(); await audit(false); report.toggle = true;
  } catch (error) { failure = error; }
  finally {
    const error = await device.popErrorScope(); if (error) failure ||= new Error(error.message);
    Object.assign(settings, saved); navigation.setView(saved.view); camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    post.invalidate(); await frame(); app.manual = manual;
  }
  if (failure) throw failure;
  return report;
}
