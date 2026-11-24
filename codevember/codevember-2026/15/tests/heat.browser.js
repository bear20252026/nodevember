import { RenderPipeline, DataUtils, Vector2 } from 'three/webgpu';
import { rtt, vec2, vec4, screenUV, uniform, getViewPosition } from 'three/tsl';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Read the actual GPU displacement across distant geometry/sky boundaries.
// The old depth-dependent phase jumped by multiple pixels at these edges.
export async function checkHeat(app = window.mirage) {
  const { camera, renderer, post, settings, navigation } = app;
  const saved = { ...settings }, manual = app.manual;
  const eye = camera.position.clone(), target = navigation.controls.target.clone();
  const size = renderer.getDrawingBufferSize(new Vector2());
  const view = getViewPosition(screenUV, post.scenePass.getTextureNode('depth'), uniform(camera.projectionMatrixInverse));
  const offset = post.heatUV.sub(screenUV).mul(vec2(size.x, size.y));
  const field = rtt(vec4(offset, view.z.negate().max(1).log2(), 1), null, null, { depthBuffer: false });
  const pipeline = new RenderPipeline(renderer, field); pipeline.outputColorTransform = false;
  const report = [];
  app.manual = true; Object.assign(settings, { paused: true, drift: false, heat: 3 });
  try {
    for (const name of ['Overlook', 'Sanctuary']) {
      navigation.setView(name);
      for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); app.render(); }
      pipeline.render();
      const rt = field.renderTarget, raw = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height);
      const values = Float32Array.from(raw, DataUtils.fromHalfFloat);
      let edges = 0, jump = 0, minJacobian = Infinity, pixels = 0, maxOffset = 0;
      for (let y = 20; y < rt.height - 20; y++) for (let x = 20; x < rt.width - 20; x++) {
        const i = (y * rt.width + x) * 4, right = i + 4, below = i + rt.width * 4;
        if (Math.min(values[i + 2], values[right + 2], values[below + 2]) < Math.log2(120)) continue;
        const dx = values[right] - values[i], dy = values[right + 1] - values[i + 1];
        const ex = values[below] - values[i], ey = values[below + 1] - values[i + 1];
        assert(Number.isFinite(dx + dy + ex + ey), 'Nonfinite heat displacement');
        minJacobian = Math.min(minJacobian, (1 + dx) * (1 + ey) - dy * ex); pixels++;
        maxOffset = Math.max(maxOffset, Math.hypot(values[i], values[i + 1]));
        if (Math.abs(values[i + 2] - values[right + 2]) > 2) { edges++; jump = Math.max(jump, Math.hypot(dx, dy)); }
        if (Math.abs(values[i + 2] - values[below + 2]) > 2) { edges++; jump = Math.max(jump, Math.hypot(ex, ey)); }
      }
      assert(edges > 50, `${name}: no distant silhouettes tested`);
      assert(jump < 2, `${name}: heat tears across silhouettes (${jump.toFixed(2)} px)`);
      assert(minJacobian > 0, `${name}: heat mapping folds over itself (${minJacobian})`);
      report.push({ view: name, edges, maxEdgeJumpPixels: jump, minJacobian, pixels, maxOffsetPixels: maxOffset });
    }
    // Heat must also move the reflected image, not just the opaque backdrop.
    // Compare the actual pre/post-refraction buffers at reflective sand pixels.
    navigation.setView('Dunes'); Object.assign(settings, { dust: 0, wheelDust: 0, mirage: 0, heat: 0 });
    const read = async node => {
      const rt = node.renderTarget;
      return Float32Array.from(await renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height), DataUtils.fromHalfFloat);
    };
    for (let i = 0; i < 8; i++) { await new Promise(requestAnimationFrame); app.render(); }
    const base = await read(post.reflectionImage);
    settings.mirage = 1;
    for (const strength of [0, 3]) {
      settings.heat = strength; await new Promise(requestAnimationFrame); app.render();
      const reflected = await read(post.reflectionImage), refracted = await read(post.mirageImage);
      let reflective = 0, moved = 0, maxDifference = 0;
      for (let i = 0; i < base.length; i += 16) {
        const reflectionDifference = Math.max(...[0, 1, 2].map(c => Math.abs(base[i + c] - reflected[i + c])));
        const heatDifference = Math.max(...[0, 1, 2].map(c => Math.abs(reflected[i + c] - refracted[i + c])));
        assert(Number.isFinite(reflectionDifference + heatDifference), 'Nonfinite final refraction');
        maxDifference = Math.max(maxDifference, heatDifference);
        if (reflectionDifference > .01) { reflective++; if (heatDifference > .002) moved++; }
      }
      assert(reflective > 50, 'No visible mirage pixels tested');
      if (strength === 0) assert(maxDifference < .002, 'Zero heat changes the composite');
      else assert(moved > 30, 'Heat is not distorting the reflection');
      report.push({ heat: strength, reflectiveSamples: reflective, refractedReflectionSamples: moved, maxRadianceDifference: maxDifference });
    }
  } finally {
    pipeline.dispose(); field.dispose(); Object.assign(settings, saved); navigation.setView(saved.view);
    camera.position.copy(eye); navigation.controls.target.copy(target); navigation.controls.update();
    post.invalidate(); app.render(); app.manual = manual;
  }
  return report;
}
