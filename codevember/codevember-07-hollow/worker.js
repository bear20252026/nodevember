import { hollowShell } from './shell.js';
import { loadShape } from './shapes.js';

// The cut, off the main thread: the shape loaded (or made) and cut into its
// parts here, so that the picture keeps moving meanwhile. The parts go back
// with their arrays handed over, not copied.

onmessage = async ({ data: { job, name, options } }) => {
  const surface = await loadShape(name, options);
  const { parts, options: made } = hollowShell(surface, options);
  const buffers = new Set();
  for (const part of parts) for (const g of [part, part.border]) {
    if (!g) continue;
    for (const v of Object.values(g)) if (ArrayBuffer.isView(v)) buffers.add(v.buffer);
  }
  postMessage({ job, parts, options: made }, [...buffers]);
};
