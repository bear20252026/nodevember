// Sustained loss of mobility, rather than a momentary airborne wheel or a
// slow climb, triggers the driving assist. Timers use simulation seconds.
export function createRecoveryMonitor() {
  let tipped = 0, stalled = 0, anchor = null, cooldown = 0;
  return {
    reset(delay = 0) { tipped = stalled = 0; anchor = null; cooldown = delay; },
    update(dt, { position, up, speed, verticalSpeed, angularSpeed, throttle }) {
      if (cooldown > 0) { cooldown -= dt; return null; }
      const settled = speed < 1.5 && Math.abs(verticalSpeed) < 1 && angularSpeed < 1.5;
      tipped = up < .3 && settled ? tipped + dt : 0;
      if (tipped >= 1.8) return 'tipped';
      if (Math.abs(throttle) < .2 || Math.abs(verticalSpeed) > 1) {
        stalled = 0; anchor = null; return null;
      }
      if (!anchor || Math.hypot(position[0] - anchor[0], position[2] - anchor[2]) > .8) {
        anchor = [...position]; stalled = 0;
      }
      stalled += dt;
      return stalled >= 3.5 ? 'stuck' : null;
    }
  };
}
