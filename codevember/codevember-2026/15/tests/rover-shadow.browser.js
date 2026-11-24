export async function checkSlowRoverShadow(app = window.mirage) {
  const { rover, settings, post } = app, state = rover.capture(), manual = app.manual;
  const saved = { ...settings }, render = post.render;
  let requested = false, refreshes = 0, slowUpdates = 0;
  app.manual = true; settings.paused = false;
  post.render = (...args) => { requested = app.atmosphere.sun.shadow.needsUpdate; return render(...args); };
  try {
    rover.keys.clear(); rover.markShadowRendered();
    for (let i = 0; i < 120; i++) {
      rover.update(1 / 30);
      if (!rover.moving && rover.shadowDirty) {
        slowUpdates++; await new Promise(requestAnimationFrame); app.render();
        if (!requested) throw new Error('Slow chassis movement did not request a shadow map');
        if (rover.shadowDirty) throw new Error('Rendered shadow did not remember its pose');
        refreshes++;
      }
    }
    if (!slowUpdates) throw new Error('The opening slope did not exercise sub-threshold motion');
    return { slowUpdates, refreshes, displacement: Math.hypot(...rover.physics.position.map((p, i) => p - state.position[i])) };
  } finally {
    post.render = render; rover.restore(state); Object.assign(settings, saved);
    app.post.invalidate(); await new Promise(requestAnimationFrame); app.render(); app.manual = manual;
  }
}
