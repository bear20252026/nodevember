const DRIVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const clampAxis = value => Math.max(-1, Math.min(1, value));
const STICK_RADIUS = 46;

// Match Labyrinth's floating stick: a dead zone and a gentle response near
// the centre, with a circular limit so diagonal drags cannot exceed full input.
export function joystickAxes(dx, dy, radius = STICK_RADIUS) {
  const length = Math.hypot(dx, dy), magnitude = Math.min(1, length / radius);
  if (magnitude <= .12) return { x: 0, y: 0 };
  const strength = ((magnitude - .12) / .88) ** 1.25;
  return { x: dx / length * strength, y: dy / length * strength };
}

export function createRoverInput(canvas, isActive, changed) {
  const abort = new AbortController(), events = { signal: abort.signal };
  const keys = new Set();
  const stick = document.createElement('div'), thumb = document.createElement('div');
  stick.className = 'rover-joystick'; thumb.className = 'rover-joystick-thumb';
  stick.setAttribute('aria-hidden', 'true'); stick.hidden = true;
  stick.append(thumb); document.body.append(stick);
  let pointer = null, originX = 0, originY = 0, x = 0, y = 0;

  function release() {
    const id = pointer;
    pointer = null; x = y = 0; stick.hidden = true; thumb.style.transform = '';
    if (id !== null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    changed();
  }
  function clear() { keys.clear(); release(); }
  window.addEventListener('keydown', event => {
    if (!isActive() || !DRIVE_KEYS.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.target.closest?.('input, textarea, select') || event.target.isContentEditable) return;
    event.preventDefault(); keys.add(event.code); changed();
  }, events);
  // Release even if focus moved into Settings while a key was held.
  window.addEventListener('keyup', event => { if (keys.delete(event.code)) changed(); }, events);
  canvas.addEventListener('pointerdown', event => {
    if (!isActive() || event.pointerType !== 'touch') return;
    // OrbitControls is registered first, so intercept touch in the capture
    // phase. Extra fingers must not start an orbit or take over the stick.
    event.preventDefault(); event.stopImmediatePropagation();
    if (pointer !== null) return;
    pointer = event.pointerId; originX = event.clientX; originY = event.clientY;
    stick.style.left = `${originX}px`; stick.style.top = `${originY}px`; stick.hidden = false;
    canvas.setPointerCapture(pointer); canvas.focus({ preventScroll: true }); changed();
  }, { ...events, capture: true, passive: false });
  window.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const dx = event.clientX - originX, dy = event.clientY - originY;
    ({ x, y } = joystickAxes(dx, dy));
    const limit = Math.min(1, STICK_RADIUS / Math.max(1, Math.hypot(dx, dy)));
    thumb.style.transform = `translate(${dx * limit}px, ${dy * limit}px)`; changed();
  }, { ...events, capture: true, passive: false });
  const end = event => { if (event.pointerId === pointer) release(); };
  window.addEventListener('pointerup', end, events);
  window.addEventListener('pointercancel', end, events);
  canvas.addEventListener('lostpointercapture', end, events);
  window.addEventListener('blur', clear, events);
  window.addEventListener('resize', clear, events);
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); }, events);

  return {
    keys, clear,
    sample() {
      return {
        throttle: clampAxis(Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - y),
        turn: clampAxis(Number(keys.has('KeyA') || keys.has('ArrowLeft')) - Number(keys.has('KeyD') || keys.has('ArrowRight')) - x),
        boost: keys.has('ShiftLeft') || keys.has('ShiftRight')
      };
    },
    dispose() { clear(); abort.abort(); stick.remove(); }
  };
}
