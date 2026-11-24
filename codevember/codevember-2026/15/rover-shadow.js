// Compare against the last rendered pose, not velocity or the previous frame.
// Slow downhill creep and suspension settling must accumulate until the map
// is refreshed, even when the vehicle is below the driving-camera threshold.
export function createRoverShadowTracker(physics) {
  const current = new Float64Array(19), rendered = new Float64Array(19);
  let initialized = false;
  function read() {
    current.set(physics.position, 0); current.set(physics.rotation, 3);
    physics.wheels.forEach((wheel, i) => {
      current[7 + i * 3] = wheel.length;
      current[8 + i * 3] = wheel.angle;
      current[9 + i * 3] = wheel.spin;
    });
  }
  return {
    get dirty() {
      if (!initialized) return true;
      read();
      return current.some((value, i) => Math.abs(value - rendered[i]) > (i < 3 ? .001 : .0002));
    },
    markRendered() { read(); rendered.set(current); initialized = true; }
  };
}
