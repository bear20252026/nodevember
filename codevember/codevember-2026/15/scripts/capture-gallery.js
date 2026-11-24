import { createCaptureSession } from './capture-video.js';

export async function captureGallery({ receiver = 'http://127.0.0.1:8026', name = 'preview' } = {}) {
  const session = createCaptureSession({ renderSize: 1600, overlays: false }), app = session.app;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 800;
  const context = canvas.getContext('2d', { alpha: false }); context.imageSmoothingQuality = 'high';
  try {
    await session.warmup();
    app.camera.position.set(-8.3, 3.6, 153.8); app.camera.lookAt(-12, 45, -380);
    app.post.invalidate(); app.atmosphere.sun.shadow.needsUpdate = true;
    for (let i = 0; i < 8; i++) {
      await new Promise(requestAnimationFrame); app.render(); context.drawImage(app.renderer.domElement, 0, 0, 800, 800);
      await app.renderer.backend.device.queue.onSubmittedWorkDone();
    }
    const metadata = { width: 800, height: 800, renderSize: 1600, format: 'WebP', quality: .92, interface: false,
      camera: app.camera.position.toArray(), fov: app.camera.fov, target: [-12, 45, -380], settings: { ...app.settings } };
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .92));
    for (const [suffix, body] of [['webp', blob], ['json', JSON.stringify(metadata, null, 2)]]) {
      const response = await fetch(`${receiver}/asset/${name}.${suffix}`, { method: 'POST', body });
      if (!response.ok) throw new Error(await response.text());
    }
    return metadata;
  } finally { await session.restore(); }
}
