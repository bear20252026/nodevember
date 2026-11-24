// Run in the live browser after startup. Includes the complete rendering graph,
// camera motion, clouds, heat, SSGI and denoising at the selected resolution.
export async function measurePerformance(app = window.mirage, frames = 240) {
  if (!app?.ready) throw new Error('Wait for startup before benchmarking.');
  const saved = { ...app.settings }, manual = app.manual;
  const roverState = app.rover.capture();
  const eye = app.camera.position.clone(), target = app.navigation.controls.target.clone();
  const reports = [];
  app.manual = true; app.settings.paused = false; app.settings.drift = false;
  try {
    for (const view of ['Overlook', 'Dunes', 'Sanctuary', 'Outcrop', 'Stone', 'Rover']) {
      app.navigation.setView(view);
      if (view === 'Rover') app.rover.keys.add('KeyW');
      const relative = app.camera.position.clone().sub(app.navigation.controls.target), intervals = [];
      let last = null;
      for (let i = 0; i < frames + 45; i++) {
        const now = await new Promise(requestAnimationFrame);
        if (last !== null && i >= 45) intervals.push(now - last);
        const dt = last === null ? 0 : (now - last) / 1000;
        last = now;
        app.advance(Math.min(dt, .05));
        if (view !== 'Rover') app.camera.position.copy(relative).applyAxisAngle({ x: 0, y: 1, z: 0 }, Math.sin(i * .018) * .17).add(app.navigation.controls.target);
        app.camera.lookAt(app.navigation.controls.target);
        app.render();
      }
      await app.renderer.backend.device.queue.onSubmittedWorkDone();
      intervals.sort((a, b) => a - b);
      const mean = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length;
      const p95 = intervals[Math.floor(intervals.length * .95)];
      const countsByView = {};
      for (const ref of app.meshlets._records) {
        const record = ref.deref(); if (!record?.culling || record.culling.shadow) continue;
        const counts = new Uint32Array(await app.renderer.getArrayBufferAsync(record.culling.countersAttribute));
        const entries = [...record.entries, ...[...record.staticGroups.values()].flatMap(g => g.entries)];
        const batches = new Set(entries.filter(e => e.count > 0).map(e => e.batch));
        let clusters = 0;
        for (const batch of batches) {
          const near = Math.min(counts[1 + batch.index * 2], batch.queueCapacity);
          clusters += near;
          if (batch.ditherQueue) clusters += Math.min(counts[2 + batch.index * 2], batch.queueCapacity - near);
          else if (batch.farMaterial !== null) clusters += Math.min(counts[2 + batch.index * 2], batch.queueCapacity);
        }
        const name = record.culling.cameraPosition.value.distanceTo(app.camera.position) < .001 ? 'main' : 'reflection';
        if (name === 'reflection' && app.post.reflectedScene.available.value === 0) continue;
        countsByView[name] = { clusters, triangles: clusters * 64 };
      }
      reports.push({ view, frames: intervals.length, fps: 1000 / mean, meanMs: mean, p95Ms: p95, slowFrames: intervals.filter(ms => ms > 34).length,
        meshlets: countsByView, meets30: mean <= 1000 / 30 && p95 <= 34 });
    }
  } finally {
    app.rover.keys.clear(); app.rover.restore(roverState);
    Object.assign(app.settings, saved); app.navigation.setView(saved.view);
    app.camera.position.copy(eye); app.navigation.controls.target.copy(target); app.navigation.controls.update();
    app.post.invalidate(); app.render(); app.manual = manual;
  }
  return { viewport: [innerWidth, innerHeight], dpr: app.renderer.getPixelRatio(), interfaceVisible: !document.body.classList.contains('ui-hidden'), settings: saved, reports };
}

// Include actual tire sweeps and collision-patch rebuilds while driving across
// the seeded outcrop rubble, with the same complete rendering graph.
export async function measureRockyPerformance(app = window.mirage, frames = 300) {
  const saved = { ...app.settings }, manual = app.manual, state = app.rover.capture();
  const eye = app.camera.position.clone(), target = app.navigation.controls.target.clone();
  const start = [40.994, app.landscape.heightAt(40.994, 54.3) + 1.05, 54.3];
  app.manual = true; app.settings.paused = false; app.settings.drift = false;
  try {
    app.rover.restore({ ...state, position: start, rotation: [0, 0, 0, 1], velocity: [0, 0, 0], angular: [0, 0, 0], steering: 0 });
    app.navigation.setView('Rover');
    const intervals = [], physicsTimes = []; let last = null, stoneFrames = 0;
    for (let i = 0; i < frames + 45; i++) {
      const now = await new Promise(requestAnimationFrame);
      if (i === 45) app.rover.keys.add('KeyW');
      if (last !== null && i >= 45) intervals.push(now - last);
      const dt = last === null ? 0 : (now - last) / 1000; last = now;
      const before = performance.now(); app.advance(Math.min(dt, .05));
      if (i >= 45) {
        physicsTimes.push(performance.now() - before);
        if (app.rover.physics.diagnostics.stoneContacts > 0) stoneFrames++;
      }
      app.render();
    }
    await app.renderer.backend.device.queue.onSubmittedWorkDone();
    intervals.sort((a, b) => a - b); physicsTimes.sort((a, b) => a - b);
    const mean = intervals.reduce((sum, ms) => sum + ms, 0) / intervals.length, p95 = intervals[Math.floor(intervals.length * .95)];
    return { view: 'Rover over outcrop rubble', viewport: [innerWidth, innerHeight], dpr: app.renderer.getPixelRatio(),
      interfaceVisible: !document.body.classList.contains('ui-hidden'), frames, fps: 1000 / mean, meanMs: mean, p95Ms: p95,
      slowFrames: intervals.filter(ms => ms > 34).length, meets30: mean <= 1000 / 30 && p95 <= 34,
      stoneFrames, updateP95Ms: physicsTimes[Math.floor(physicsTimes.length * .95)], updateMaxMs: physicsTimes.at(-1),
      start, end: [...app.rover.physics.position] };
  } finally {
    app.rover.restore(state); Object.assign(app.settings, saved); app.navigation.setView(saved.view);
    app.camera.position.copy(eye); app.navigation.controls.target.copy(target); app.navigation.controls.update();
    app.post.invalidate(); app.render(); app.manual = manual;
  }
}
