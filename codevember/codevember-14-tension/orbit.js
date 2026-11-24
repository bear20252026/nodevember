// Dragging turns the view round the rope, left and right only (round its own axis, the world's
// y): the camera stays level, at the same height and distance, looking at the rope's middle.
// Let go mid-swing, it glides on a little and settles.
const SPEED = 2 * Math.PI; // radians for a drag across the whole width of the view
const GLIDE = 0.25; // how long the swing lasts once let go, s

export function createOrbit(el) {
  let angle = 0, vel = 0; // (radians, radians/s)
  let drag = null; // { id, x, moved }
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, moved: 0 };
    vel = 0;
  });
  el.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = ((e.clientX - drag.x) / el.clientWidth) * SPEED;
    drag.x = e.clientX;
    drag.moved += Math.abs(d);
    angle -= d;
    // (its speed, smoothed over the last few moves, for the glide)
    const now = e.timeStamp, dt = drag.t ? Math.max(1, now - drag.t) / 1000 : 0.016;
    drag.t = now;
    vel = 0.6 * vel + 0.4 * (-d / dt);
  });
  const up = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    // (held still before letting go: no glide)
    if (e.timeStamp - (drag.t || 0) > 80) vel = 0;
    drag = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);

  return {
    get angle() { return angle; },
    get dragging() { return !!drag; },
    update(dt) {
      if (drag || !vel) return;
      angle += vel * dt;
      vel *= Math.exp(-dt / GLIDE);
      if (Math.abs(vel) < 1e-3) vel = 0;
    },
  };
}
