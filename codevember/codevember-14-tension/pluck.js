// The cursor plucks the rope like a guitar string: the whole of it, top to bottom, a stiff
// string held a little beyond the frame. Swept across it, the cursor catches it and pushes it
// aside a little, the rope giving in one long stiff curve (not a kink: it is too stiff to bend
// sharply), its top and bottom drawn along; past the little it gives it slips off and the rope rings: a fast tight shudder through its whole length, its harmonics
// sounding together, slightly sharp as a stiff string's are, the high ones dying first, the
// whole of it settling within a second or so, orbiting a little out of the plane. As modes over
// its length (u 0..1, its ends at ±L in the view): a string held at u0 d aside is Σ bₙ sin(nπu),
// bₙ ∝ sin(nπu0) / n², softened for the stiffness and scaled to put it at d there.
export const NM = 10; // the modes drawn (see look.js)
export const L = 2.6; // the string's half length, in the view's units (the view's half height is 1.8):
// held not far beyond the frame, so that its top and bottom are drawn along only a little
const FREQ = 7; // the fundamental, Hz
const STIFF = 0.03; // the harmonics' sharpening: fₙ = n·FREQ·√(1 + STIFF n²)
const ROUND = 0.15; // how much the stiffness rounds the bend while held
const DECAY = 0.9; // the fundamental's ringing, s (the n-th's DECAY / n)
const GIVE = 0.045; // how far it gives before it slips off, in the view's units
const FINGER = 2 * Math.PI * 16; // how fast it follows the cursor while held (rad/s)

export function createPluck() {
  const a = new Float32Array(2 * NM), v = new Float32Array(2 * NM); // per mode (x, z)
  const w = Array.from({ length: NM }, (_, k) => 2 * Math.PI * FREQ * (k + 1) * Math.sqrt(1 + STIFF * (k + 1) ** 2));
  const pointer = { x: 0, y: 0, px: 0, py: 0, on: false, down: false, moved: false };
  let held = null; // { side, u, d }
  let slack = false; // (the rope broken: nothing to pluck any more, what rings rings down)

  const uAt = (y) => (y + L) / (2 * L);
  const shape = (u) => {
    let x = 0;
    for (let n = 1; n <= NM; n++) x += a[2 * n - 2] * Math.sin(n * Math.PI * u);
    return x;
  };
  // the modes of the rope held d aside at u0
  const bend = (u0, d) => {
    const b = [];
    let at = 0;
    for (let n = 1; n <= NM; n++) {
      b.push(Math.sin(n * Math.PI * u0) / (n * n * (1 + ROUND * n * n)));
      at += b[n - 1] * Math.sin(n * Math.PI * u0);
    }
    return b.map((x) => (x * d) / at);
  };
  const release = () => {
    // let go, it swings a little out of the plane too, as a plucked string does
    for (let n = 1; n <= NM; n++) v[2 * n - 1] += held.side * 0.15 * a[2 * n - 2] * w[n - 1];
    held = null;
  };

  // camera: the view's shake. Returns the modes to draw, in the view's units.
  function update(dt, camera) {
    const px = pointer.x + camera.x, py = pointer.y + camera.y;
    const qx = pointer.px + camera.x, qy = pointer.py + camera.y;
    if (held) {
      const u = uAt(py);
      const d = px;
      const give = GIVE * Math.min(1, 4 * u * (1 - u));
      // (the button down, the drag turns the view instead, see orbit.js: it lets go)
      if (slack || !pointer.on || pointer.down || d * held.side > 0) release();
      else if (Math.abs(d) > give) {
        // drawn past what it gives: it slips off from there, however fast the cursor went
        // through it (a quick strum plucks it as well as a slow pull)
        const b = bend(Math.min(0.97, Math.max(0.03, u)), Math.sign(d) * give);
        for (let n = 1; n <= NM; n++) {
          const q = 2 * n - 2;
          if (Math.abs(b[n - 1]) > Math.abs(a[q]) || Math.sign(b[n - 1]) !== Math.sign(a[q])) a[q] = b[n - 1];
        }
        release();
      } else { held.u = u; held.d = d; }
    } else if (!slack && pointer.on && !pointer.down && pointer.moved) {
      // swept across it
      const before = qx - shape(uAt(qy)), now = px - shape(uAt(py));
      if (before !== 0 && Math.sign(before) !== Math.sign(now)) {
        held = { side: Math.sign(before), u: uAt(py), d: 0 };
      }
    }
    pointer.px = pointer.x; pointer.py = pointer.y; pointer.moved = false;

    // each mode a damped oscillator, ringing on its own once free, drawn to the cursor's bend
    // while held (and damped by it); in small steps, the high modes being fast
    const steps = Math.ceil(dt / 0.0007);
    const h = dt / steps;
    const target = held ? bend(Math.min(0.97, Math.max(0.03, held.u)), held.d) : null;
    for (let n = 1; n <= NM; n++) {
      let wk = w[n - 1], damp = n / DECAY;
      if (held) { wk = Math.max(wk, FINGER); damp = 0.9 * wk; }
      for (let i = 0; i < 2; i++) {
        const q = 2 * n - 2 + i, tq = held && i === 0 ? target[n - 1] : 0;
        let aq = a[q], vq = v[q];
        for (let k = 0; k < steps; k++) {
          vq += (-wk * wk * (aq - tq) - 2 * damp * vq) * h;
          aq += vq * h;
        }
        a[q] = aq; v[q] = vq;
      }
    }
    return a;
  }

  // the cursor over the view (in the view's units, at the rope: halfHeight up from the middle)
  function attach(el, halfHeight) {
    const at = (e) => {
      const r = el.getBoundingClientRect();
      pointer.x = ((e.clientX - r.left) / r.height - (0.5 * r.width) / r.height) * 2 * halfHeight;
      pointer.y = (0.5 - (e.clientY - r.top) / r.height) * 2 * halfHeight;
    };
    el.addEventListener('pointermove', (e) => {
      at(e);
      if (!pointer.on) { pointer.px = pointer.x; pointer.py = pointer.y; pointer.on = true; }
      pointer.moved = true;
    });
    el.addEventListener('pointerdown', (e) => {
      at(e);
      pointer.px = pointer.x; pointer.py = pointer.y;
      pointer.on = true; pointer.down = true;
      el.setPointerCapture?.(e.pointerId);
    });
    const up = () => { pointer.down = false; if (pointer.type === 'touch') pointer.on = false; };
    el.addEventListener('pointerup', (e) => { pointer.type = e.pointerType; up(); });
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => { if (!pointer.down) pointer.on = false; });
  }

  return {
    update,
    attach,
    get holding() { return !!held; },
    // the rope broken for good: it lets go and can't be caught again
    slacken() { slack = true; },
    // a new rope in its place: still, and to be plucked again
    renew() { slack = false; held = null; a.fill(0); v.fill(0); },
  };
}
