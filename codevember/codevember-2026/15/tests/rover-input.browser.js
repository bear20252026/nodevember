import { PerspectiveCamera } from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRoverInput } from '../rover-input.js';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Synthetic pointer events cannot acquire a native pointer capture. Emulate
// only capture bookkeeping; use real DOM propagation and OrbitControls so a
// touch-handler ordering regression cannot silently rotate the chase camera.
export function checkRoverInput(app = window.mirage) {
  const wasActive = app.rover.active;
  app.rover.active = false;
  const canvas = document.createElement('canvas'); document.body.append(canvas);
  const captures = new Set();
  canvas.setPointerCapture = id => captures.add(id);
  canvas.hasPointerCapture = id => captures.has(id);
  canvas.releasePointerCapture = id => { captures.delete(id); pointer('lostpointercapture', id); };
  const orbit = new OrbitControls(new PerspectiveCamera(), canvas);
  let active = true, starts = 0;
  orbit.addEventListener('start', () => { starts++; });
  const input = createRoverInput(canvas, () => active, () => {});
  const stick = document.querySelector('.rover-joystick:last-child');
  function pointer(type, id = 71, x = 120, y = 300, pointerType = 'touch') {
    canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, pointerType, bubbles: true, cancelable: true, button: 0 }));
  }
  const resting = () => input.sample().throttle === 0 && input.sample().turn === 0 && stick.hidden && captures.size === 0;
  try {
    pointer('pointerdown'); pointer('pointermove', 71, 120, 254);
    assert(input.sample().throttle === 1 && starts === 0 && !stick.hidden, 'Touch did not drive exclusively through the joystick');
    pointer('pointerdown', 72, 300, 300); pointer('pointermove', 72, 300, 400); pointer('pointerup', 72);
    assert(input.sample().throttle === 1, 'A second finger took over or released the joystick');
    pointer('pointermove', 71, 166, 300);
    assert(input.sample().turn === -1 && input.sample().throttle === 0, 'Right drag did not steer right');
    pointer('pointermove', 71, 120, 346);
    assert(input.sample().throttle === -1, 'Down drag did not reverse');
    pointer('pointerup'); assert(resting(), 'Release left the rover driving');
    for (const event of ['pointercancel', 'lostpointercapture']) {
      pointer('pointerdown'); pointer('pointermove', 71, 120, 254); pointer(event);
      assert(resting(), `${event} left the rover driving`);
    }
    pointer('pointerdown'); pointer('pointermove', 71, 120, 254); input.clear();
    assert(resting(), 'View change did not release the joystick');
    active = false; pointer('pointerdown'); pointer('pointerup');
    assert(starts === 1 && resting(), 'Non-driving views lost touch orbiting');
    active = true; pointer('pointerdown', 73, 120, 300, 'mouse'); pointer('pointerup', 73, 120, 300, 'mouse');
    assert(starts === 2 && resting(), 'Mouse orbit was intercepted by the joystick');
    input.keys.add('KeyW');
    const field = document.createElement('input'); document.body.append(field);
    field.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', bubbles: true })); field.remove();
    assert(input.sample().throttle === 0, 'Moving focus into Settings left a movement key held');
    return { forward: true, reverse: true, steering: true, independentOrbit: true, secondFingerIgnored: true, releaseAndCancel: true, focusRelease: true };
  } finally {
    input.dispose(); orbit.dispose(); canvas.remove(); app.rover.active = wasActive;
  }
}
