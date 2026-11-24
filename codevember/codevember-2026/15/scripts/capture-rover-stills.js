import { Vector3 } from 'three/webgpu';
import { createCaptureSession } from './capture-video.js';

// Review the same settled pose from several angles after a model change.
export async function captureRoverStills({ receiver = 'http://127.0.0.1:8026', name = 'rover-review' } = {}) {
  const session = createCaptureSession({ overlays: false }), app = session.app;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1024;
  const context = canvas.getContext('2d', { alpha: false }); context.imageSmoothingQuality = 'high';
  const views = [['opening', null, .9], ['front', [3.2, 1.4, -4.2], .9], ['side', [4.3, 1.2, .5], .9], ['rear', [0, 1.1, 3.7], .85]];
  const report = [];
  const save = async (suffix, body) => {
    const response = await fetch(`${receiver}/asset/${name}-${suffix}`, { method: 'POST', body });
    if (!response.ok) throw new Error(await response.text());
  };
  try {
    await session.warmup();
    for (const [view, offset, aim] of views) {
      if (offset) {
        app.camera.position.set(...offset).applyAxisAngle(new Vector3(0, 1, 0), app.rover.yaw).add(app.rover.position);
        app.camera.lookAt(app.rover.position.x, app.rover.position.y + aim, app.rover.position.z);
      }
      app.post.invalidate(); app.atmosphere.sun.shadow.needsUpdate = true;
      for (let i = 0; i < 6; i++) {
        await new Promise(requestAnimationFrame); app.render(); context.drawImage(app.renderer.domElement, 0, 0, 1024, 1024);
        await app.renderer.backend.device.queue.onSubmittedWorkDone();
      }
      await save(`${view}.png`, await new Promise(resolve => canvas.toBlob(resolve, 'image/png')));
      report.push({ view, camera: app.camera.position.toArray(), rover: app.rover.capture() });
    }
    await save('metadata.json', JSON.stringify(report, null, 2)); return report.map(({ view, camera }) => ({ view, camera }));
  } finally { await session.restore(); }
}
