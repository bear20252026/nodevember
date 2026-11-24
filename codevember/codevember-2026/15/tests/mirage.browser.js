import { RenderPipeline, Vector2, Vector3, DataUtils } from 'three/webgpu';
import { rtt, vec2, vec4, screenUV, texture, uniform, getViewPosition, isBackgroundDepth } from 'three/tsl';

const assert = (value, message) => { if (!value) throw new Error(message); };

// Rendered regressions: invalid rays, foreground leakage, heading-dependent
// plane jumps, the former 45 m cutoff, and pitch/roll-dependent image sliding.
export async function checkMirage(app = window.mirage) {
  const { camera, settings, post, renderer } = app;
  const saved = { ...settings }, manual = app.manual, eye = camera.position.clone();
  const rotation = camera.quaternion.clone(), fov = camera.fov;
  const report = { views: [], heights: [], reprojection: [] };
  const frame = async () => { await new Promise(requestAnimationFrame); app.render(); await renderer.backend.device.queue.onSubmittedWorkDone(); };
  const read = async (rt, attachment = 0) => renderer.readRenderTargetPixelsAsync(rt, 0, 0, rt.width, rt.height, attachment);
  const orient = (heading, pitch, roll = 0) => {
    camera.lookAt(camera.position.clone().add(new Vector3(Math.sin(heading) * Math.cos(pitch), Math.sin(pitch), -Math.cos(heading) * Math.cos(pitch))));
    camera.rotateZ(roll); camera.updateMatrixWorld();
  };
  app.manual = true; Object.assign(settings, { paused: true, drift: false, ssgi: false, heat: 0, ao: 0, dust: 0, wheelDust: 0 });
  const bufferSize = uniform(new Vector2(1, 1));
  const inverse = uniform(camera.projectionMatrixInverse), worldMatrix = uniform(camera.matrixWorld);
  const beauty = texture(post.scenePass.getTextureNode('output').value, screenUV);
  const depth = texture(post.scenePass.getTextureNode('depth').value, screenUV);
  let adjacentDepth = depth.r;
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    adjacentDepth = adjacentDepth.min(depth.sample(screenUV.add(vec2(x, y).div(bufferSize)).clamp(0, 1)).r);
  }
  adjacentDepth = adjacentDepth.toVar();
  const adjacentView = getViewPosition(screenUV, adjacentDepth, inverse);
  const distantCoverage = isBackgroundDepth(depth.r).and(isBackgroundDepth(adjacentDepth).not()).and(adjacentView.z.negate().greaterThan(5000));
  const hazeDepth = distantCoverage.select(adjacentDepth, depth.r);
  const hazeView = getViewPosition(screenUV, hazeDepth, inverse).toVar();
  const hazeWorld = worldMatrix.mul(vec4(hazeView, 1)).xyz.toVar();
  const baseline = rtt(vec4(app.atmosphere.applyHaze(beauty.rgb, hazeView, hazeWorld, hazeDepth), 1), null, null, { depthBuffer: false });
  const baselinePipeline = new RenderPipeline(renderer, baseline); baselinePipeline.outputColorTransform = false;
  renderer.backend.device.pushErrorScope('validation');
  let failure;
  try {
    // A hot-air mirage is confined to roughly half a degree. At 8 m eye
    // height this short playa is occluded before the turning-ray distance.
    camera.position.set(0, app.landscape.heightAt(0, -140) + 1.2, -140);
    let floor;
    for (const [name, heading, pitch, roll] of [
      ['north', 0, 0, 0], ['east', Math.PI / 2, 0, 0], ['south', Math.PI, 0, 0], ['west', -Math.PI / 2, 0, 0],
      ['pitched up', 0, .4, 0], ['pitched down', 0, -.4, 0], ['rolled', 0, 0, .6],
      ['zenith', 0, Math.PI / 2, 0], ['nadir', 0, -Math.PI / 2, 0]
    ]) {
      orient(heading, pitch, roll);
      settings.mirage = 1; await frame(); await frame();
      // Compare input/output of the same frame, excluding unrelated changes
      // in occlusion culling or cached shadows between two different frames.
      renderer.getDrawingBufferSize(bufferSize.value);
      beauty.value = post.scenePass.getTextureNode('output').value;
      depth.value = post.scenePass.getTextureNode('depth').value;
      baselinePipeline.render();
      const before = await read(baseline.renderTarget), after = await read(post.mirageImage.renderTarget);
      const diffuse = await read(post.scenePass.renderTarget, 1);
      floor ??= post.mirageFrame.floor.value;
      assert(Math.abs(post.mirageFrame.floor.value - floor) < 1e-9, `${name}: looking around shifted the ground plane`);
      for (const matrix of [post.reflectedScene.virtual.matrixWorld, post.reflectedScene.virtual.projectionMatrixInverse]) {
        assert(matrix.elements.every(Number.isFinite), `${name}: invalid reflection camera`);
      }
      let changed = 0, leaked = 0;
      for (let i = 0; i < before.length; i += 16) {
        let difference = 0;
        for (let c = 0; c < 3; c++) {
          const a = DataUtils.fromHalfFloat(before[i + c]), b = DataUtils.fromHalfFloat(after[i + c]);
          assert(Number.isFinite(a + b), `${name}: nonfinite radiance`);
          difference = Math.max(difference, Math.abs(a - b));
        }
        if (difference > .002) changed++;
        if (DataUtils.fromHalfFloat(diffuse[i + 3]) === 0 && difference > .002) {
          // Ignore the resolved MSAA coverage at sand silhouettes, but catch
          // any reflection that spills into an opaque foreground or the sky.
          const rt = post.mirageImage.renderTarget, pixel = i / 4, x = pixel % rt.width, y = Math.floor(pixel / rt.width);
          let interior = x > 1 && y > 1 && x < rt.width - 2 && y < rt.height - 2;
          if (interior) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) interior &&= DataUtils.fromHalfFloat(diffuse[((y + dy) * rt.width + x + dx) * 4 + 3]) === 0;
          if (interior) leaked++;
        }
      }
      assert(leaked === 0, `${name}: mirage leaked onto ${leaked} nonsand samples`);
      if (['north', 'east', 'south', 'west'].includes(name)) assert(changed > 30, `${name}: mirage absent`);
      if (name === 'zenith' || name === 'nadir') assert(changed === 0, `${name}: mirage visible away from grazing ground`);
      report.views.push({ name, changedSamples: changed, leakedSamples: leaked, floor });
    }
    orient(0, 0);
    for (const height of [.1, .4, .8, 22, 40, 44.9, 45.1, 59.9, 60.1]) {
      camera.position.y = floor + height; await frame();
      const weight = post.reflectedScene.available.value;
      assert(Number.isFinite(weight) && weight >= 0 && weight <= 1, 'Invalid height fade');
      report.heights.push({ height, weight });
    }
    const below = report.heights.find(r => r.height === 44.9).weight;
    const above = report.heights.find(r => r.height === 45.1).weight;
    assert(below > 0 && above > 0 && Math.abs(below - above) < .01, 'Mirage still pops at the old height cutoff');
    assert(report.heights.at(-1).weight === 0, 'Mirage does not fade at altitude');

    camera.position.set(65, app.landscape.heightAt(65, -125) + 1.2, -125);
    const heading = Math.atan2(-77, 255);
    const points = [30, 45, 60].flatMap(x => [-300, -330, -360].map(z => new Vector3(x, app.landscape.heightAt(x, z), z)));
    const samples = data => points.map(point => {
      const p = point.clone().project(camera), rt = post.mirageImage.renderTarget;
      const x = Math.round((p.x * .5 + .5) * rt.width - .5), y = Math.round((.5 - p.y * .5) * rt.height - .5);
      assert(x > 1 && y > 1 && x < rt.width - 2 && y < rt.height - 2, 'Reprojection sample is offscreen');
      const rgb = [0, 0, 0];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) for (let c = 0; c < 3; c++) rgb[c] += DataUtils.fromHalfFloat(data[((y + dy) * rt.width + x + dx) * 4 + c]) / 9;
      return rgb;
    });
    let reference;
    for (const [pitch, roll] of [[0, 0], [.19, 0], [-.19, 0], [0, .35]]) {
      orient(heading, pitch, roll); await frame();
      const values = samples(await read(post.mirageImage.renderTarget));
      reference ??= values;
      let error = 0;
      values.forEach((rgb, i) => rgb.forEach((value, c) => { error += Math.abs(value - reference[i][c]); }));
      error /= values.length * 3;
      assert(error < .035, `Mirage slides when pitching/rolling: mean radiance error ${error}`);
      report.reprojection.push({ pitch, roll, meanRadianceError: error });
    }
  } catch (error) { failure = error; }
  finally {
    baselinePipeline.dispose(); baseline.dispose();
    const error = await renderer.backend.device.popErrorScope(); if (error) failure ||= new Error(error.message);
    Object.assign(settings, saved); camera.position.copy(eye); camera.quaternion.copy(rotation); camera.fov = fov; camera.updateProjectionMatrix();
    post.invalidate(); await frame(); app.manual = manual;
  }
  if (failure) { failure.report = report; throw failure; }
  return report;
}
