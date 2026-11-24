import { Vector3 } from 'three/webgpu';
import { FPS, SIZE, DURATION, opening, shots, ease, mix } from './capture-sequence.js';

const frame = () => new Promise(requestAnimationFrame);
const png = canvas => new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'));

export function createCaptureSession({ renderSize = 1536, overlays = true } = {}) {
  const app = window.mirage;
  if (!app?.ready) throw new Error('Wait for Mirage to finish loading');
  if (innerWidth !== SIZE || innerHeight !== SIZE || devicePixelRatio !== 1) throw new Error('Use a 1024 × 1024 CSS viewport at DPR 1');
  const { rover, renderer, camera, navigation, settings } = app;
  const saved = { settings: { ...settings }, manual: app.manual, rover: rover.capture(),
    eye: camera.position.clone(), rotation: camera.quaternion.clone(), up: camera.up.clone(), fov: camera.fov,
    update: navigation.update, physicsUpdate: rover.physics.update, controls: navigation.controls.enabled,
    projector: app.architecture.projection.light.visible,
    ui: document.body.classList.contains('ui-hidden') };
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext('2d', { alpha: false }); ctx.imageSmoothingQuality = 'high';
  const input = new AbortController();
  for (const name of ['keydown', 'keyup', 'pointerdown', 'pointermove', 'pointerup', 'wheel']) {
    window.addEventListener(name, event => { event.preventDefault(); event.stopImmediatePropagation(); }, { capture: true, passive: false, signal: input.signal });
  }
  app.manual = true; settings.paused = false; settings.drift = false;
  settings.resolution = renderSize / SIZE; app.resize(); camera.fov = 52; camera.updateProjectionMatrix();
  navigation.controls.enabled = false; document.body.classList.add('ui-hidden');
  // Leave the doorway beacon visible, but save its projected seal for the
  // playable experiment. Restore it even if a capture is cancelled.
  app.architecture.projection.light.visible = false;
  let drive = { throttle: 0, turn: 0 }, current = null, local = 0, next = 0, waypoint = 0;
  let smoothPosition = new Vector3(), smoothYaw = 0;
  const events = [];
  rover.physics.update = dt => saved.physicsUpdate(dt, drive.throttle, drive.turn, false);
  navigation.update = (dt, time) => current?.gameCamera ? saved.update(dt, time) : rover.update(dt);

  function ground(x, z, stairs) {
    if (!stairs || z > -203) return app.landscape.heightAt(x, z);
    if (z < -327) return 49.6;
    const step = app.architecture.stairs.reduce((a, b) => Math.abs(a.z - z) < Math.abs(b.z - z) ? a : b);
    return step.y + .2;
  }
  function steer() {
    if (current.route) while (waypoint < current.route.length - 1 && Math.hypot(current.route[waypoint][0] - rover.position.x, current.route[waypoint][1] - rover.position.z) < 6) waypoint++;
    const [gx, gz] = current.route?.[waypoint] || current.goal, dx = gx - rover.position.x, dz = gz - rover.position.z;
    const desired = Math.atan2(-dx, -dz), delta = Math.atan2(Math.sin(desired - rover.yaw), Math.cos(desired - rover.yaw));
    drive.turn = Math.max(-1, Math.min(1, delta * 2.5));
    // Brief, balanced steering inputs suggest a driver's small adjustments
    // without weaving between waypoints or changing the overall driving line.
    for (const [at, amount] of current.corrections || []) {
      const u = (local / FPS - at) / .55;
      if (u > 0 && u < 1) drive.turn += Math.sin(u * Math.PI * 2) * amount;
    }
    drive.turn = Math.max(-1, Math.min(1, drive.turn));
    drive.throttle = current.throttle;
    if (current.stop) drive.throttle *= Math.min(1, Math.max(0, Math.hypot(dx, dz) - 1) / 8);
    if (current.stop && rover.position.z > -327) drive.throttle = Math.max(.55, drive.throttle);
    // Once parked, straighten the tires instead of steering back toward a
    // waypoint just behind the chassis after its final braking movement.
    if (current.stop && Math.hypot(dx, dz) < 1) drive.turn = 0;
    // A short pause lets the viewer recognize the actual starting view.
    if (current.start === 'opening') drive.throttle *= ease((local / FPS - .5) / 1.4);
  }
  function compose() {
    if (current.gameCamera) return;
    const progress = local / Math.max(1, current.frames - 1);
    const t = current.rockTarget ? progress : ease(progress);
    const radius = mix(...current.radius, t), height = mix(...current.height, t);
    const angle = smoothYaw + mix(...current.orbit, t);
    if (current.rockTarget) {
      const target = new Vector3().fromArray(current.rockTarget);
      if (current.rockFollow) target.lerp(smoothPosition.clone().add(new Vector3(0, 1.5, 0)), current.rockFollow);
      const { x, y, z } = target, a = mix(...current.orbit, t);
      camera.position.set(x + Math.sin(a) * radius, y + height, z + Math.cos(a) * radius);
      camera.lookAt(x, y, z); camera.updateMatrixWorld(); return;
    }
    if (current.wheelCamera) {
      const axis = new Vector3(0, 1, 0);
      camera.position.set(mix(-1.65, -1.85, t), .55, 2.8).applyAxisAngle(axis, smoothYaw).add(smoothPosition);
      const target = new Vector3(-.9, .7, .1).applyAxisAngle(axis, smoothYaw).add(smoothPosition);
      camera.lookAt(target); camera.updateMatrixWorld(); return;
    }
    if (current.overhead) {
      // Start directly overhead, then lower the boom behind the rover. This
      // up vector remains well-defined at the vertical starting angle.
      camera.up.set(-Math.sin(smoothYaw), 0, -Math.cos(smoothYaw));
      camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius).add(smoothPosition);
      camera.lookAt(smoothPosition.x, smoothPosition.y + mix(...current.aim, t), smoothPosition.z);
      camera.updateMatrixWorld(); return;
    }
    camera.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius).add(smoothPosition);
    // Stay in front of the threshold: the projected seal is behind this
    // camera, rather than a foreground spoiler during the terrace reveal.
    if (current.stairs) camera.position.z = Math.max(camera.position.z, -325);
    // Cinematic crane paths remain above the actual terrain, without the
    // gameplay boom shortening when a distant outcrop crosses the sightline.
    camera.position.y = Math.max(camera.position.y, ground(camera.position.x, camera.position.z, current.stairs) + (current.lowCamera ? .45 : current.stairs ? 2 : 1.8));
    camera.lookAt(smoothPosition.x, smoothPosition.y + mix(...current.aim, t), smoothPosition.z);
    camera.updateMatrixWorld();
  }
  function begin(index) {
    const continued = shots[index].continueFrom !== undefined;
    current = shots[index]; local = 0; waypoint = 0; drive = { throttle: 0, turn: 0 };
    settings.drift = !!current.gameCamera;
    camera.up.set(0, 1, 0);
    camera.fov = current.fov ?? (current.wheelCamera ? 58 : 52); camera.updateProjectionMatrix();
    app.daylight.select(current.timeOfDay || 'Day'); app.daylight.update(2);
    if (current.start === 'opening') rover.restore(opening);
    else if (!continued) {
      const [x, z] = current.start, goal = current.route?.[0] || current.goal, yaw = Math.atan2(x - goal[0], z - goal[1]);
      rover.restore({ ...opening, position: [x, ground(x, z, current.stairs) + 1.2, z], rotation: [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)] });
    }
    if (!continued) {
      for (let i = 0; i < 180; i++) rover.update(1 / 120);
      if (index > 0) { steer(); for (let i = 0; i < 30; i++) { steer(); rover.update(1 / FPS); } }
      rover.tracks.clear(); rover.tracks.seedApproach(rover.physics.wheels, rover.yaw); app.dust.clear();
    }
    smoothPosition.copy(rover.position); smoothYaw = rover.yaw;
    if (current.gameCamera) navigation.setView('Rover');
    compose(); app.post.invalidate(); app.atmosphere.sun.shadow.needsUpdate = true;
    events.push({ shot: current.name, frame: current.startFrame, position: rover.position.toArray() });
  }
  function step() {
    local++; if (current.transition && local === Math.round((current.transitionAt ?? 1) * FPS)) app.daylight.select(current.transition);
    steer(); app.advance(1 / FPS);
    smoothPosition.lerp(rover.position, 1 - Math.exp(-8 / FPS));
    smoothYaw += Math.atan2(Math.sin(rover.yaw - smoothYaw), Math.cos(rover.yaw - smoothYaw)) * (1 - Math.exp(-3 / FPS));
    compose();
  }
  function snapshot() {
    ctx.drawImage(renderer.domElement, 0, 0, SIZE, SIZE);
    if (overlays) {
      ctx.save(); ctx.fillStyle = '#fff3df'; ctx.shadowColor = '#231407'; ctx.shadowBlur = 9;
      ctx.font = '15px Menlo, monospace'; ctx.letterSpacing = '2px'; ctx.fillText('CODEVEMBER 2026 / 15 / MIRAGE', 30, 40);
      ctx.font = 'bold 15px Arial, sans-serif'; ctx.letterSpacing = '.4px'; ctx.textAlign = 'right'; ctx.fillText('›  SETTINGS', 990, 40);
      ctx.font = '12px Menlo, monospace'; ctx.letterSpacing = '1px'; ctx.textAlign = 'left'; ctx.globalAlpha = .8;
      if (!current.rockTarget || current.throttle) ctx.fillText(`${Math.round(rover.speed * 3.6)} KM/H`, 30, 992);
      ctx.textAlign = 'right'; ctx.font = '11px Menlo, monospace';
      for (const [name, x] of [['Dawn', 828], ['Day', 895], ['Sunset', 990]]) {
        ctx.globalAlpha = settings.timeOfDay === name ? .95 : .6; ctx.fillText(name.toUpperCase(), x, 992);
        if (settings.timeOfDay === name) { ctx.fillStyle = '#fff3df'; ctx.fillRect(x - ctx.measureText(name.toUpperCase()).width, 997, ctx.measureText(name.toUpperCase()).width, 1); }
      }
      ctx.restore();
    }
  }
  async function render() { await frame(); app.render(); snapshot(); await renderer.backend.device.queue.onSubmittedWorkDone(); }
  return { app, canvas, events,
    async warmup() { app.reset(); app.daylight.select('Day'); app.daylight.update(2); begin(0); for (let i = 0; i < 8; i++) await render(); next = 0; },
    async draw(index) {
      if (index !== next) throw new Error('Capture frames must be sequential');
      const shotIndex = shots.findIndex(s => index >= s.startFrame && index < s.startFrame + s.frames);
      if (current !== shots[shotIndex]) { begin(shotIndex); for (let i = 0; i < 4; i++) await render(); }
      else if (index > current.startFrame) step();
      await render(); next++;
    },
    async preview(index, fraction = .5) {
      if (shots[index].continueFrom !== undefined) {
        begin(shots[index].continueFrom);
        for (let i = 1; i < current.frames; i++) step();
      }
      begin(index); const count = Math.round((current.frames - 1) * fraction);
      for (let i = 0; i < count; i++) step();
      for (let i = 0; i < 6; i++) await render();
      return { shot: current.name, fraction, rover: rover.position.toArray(), camera: camera.position.toArray(), speed: rover.speed, contacts: rover.physics.diagnostics.contacts };
    },
    async restore() {
      input.abort(); navigation.update = saved.update; rover.physics.update = saved.physicsUpdate;
      app.architecture.projection.light.visible = saved.projector;
      rover.restore(saved.rover); rover.tracks.clear(); rover.tracks.seedApproach(rover.physics.wheels, rover.yaw); app.dust.clear();
      app.daylight.select(saved.settings.timeOfDay); app.daylight.update(2);
      Object.assign(settings, saved.settings); navigation.controls.enabled = saved.controls;
      camera.up.copy(saved.up); navigation.setView(saved.settings.view); camera.position.copy(saved.eye); camera.quaternion.copy(saved.rotation);
      app.resize(); camera.fov = saved.fov; camera.updateProjectionMatrix();
      document.body.classList.toggle('ui-hidden', saved.ui); app.post.invalidate(); await frame(); app.render(); app.manual = saved.manual;
    }
  };
}

export async function captureVideo({ receiver = 'http://127.0.0.1:8026', renderSize = 1536 } = {}) {
  if (['preparing', 'capturing', 'encoding'].includes(window.captureProgress?.status)) throw new Error('A capture is already running');
  const session = createCaptureSession({ renderSize });
  const state = window.captureProgress = { status: 'preparing', frame: 0, totalFrames: FPS * DURATION, started: performance.now(), cancelled: false, cancel() { this.cancelled = true; } };
  const device = session.app.renderer.backend.device;
  const post = async (path, body) => {
    const response = await fetch(receiver + path, { method: 'POST', body, signal: AbortSignal.timeout(120000) });
    const result = await response.json(); if (!response.ok) throw new Error(result.error || response.status); return result;
  };
  let started = false, scope = false;
  try {
    device.pushErrorScope('validation'); scope = true; await session.warmup();
    await post('/start', JSON.stringify({ fps: FPS, totalFrames: state.totalFrames, width: SIZE, height: SIZE, renderSize, duration: DURATION, audio: false, shots,
      settings: { ...session.app.settings }, method: 'Fixed 30 Hz Box3D simulation, cinematic camera paths, supersampling and ordered lossless PNG streaming' }));
    started = true; state.status = 'capturing';
    for (let i = 0; i < state.totalFrames; i++) {
      if (state.cancelled) throw new Error('Capture cancelled');
      await session.draw(i); const receipt = await post(`/frame/${i}`, await png(session.canvas));
      if (receipt.frame !== i) throw new Error('Out-of-order frame receipt'); state.frame = i + 1;
    }
    const error = await device.popErrorScope(); scope = false; if (error) throw new Error(error.message);
    state.status = 'encoding'; state.result = await post('/finish', JSON.stringify({ elapsedSeconds: (performance.now() - state.started) / 1000, events: session.events }));
    state.status = 'complete'; return state.result;
  } catch (error) {
    state.status = state.cancelled ? 'cancelled' : 'failed'; state.error = error.message;
    if (started) await post('/abort', '').catch(() => {}); throw error;
  } finally { if (scope) await device.popErrorScope(); await session.restore(); }
}
