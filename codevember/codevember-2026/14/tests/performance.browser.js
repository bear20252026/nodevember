// Run in a preview tab:
// await (await import('./tests/performance.browser.js')).profileFrames()
// Queue-drained wall time includes CPU submission and GPU completion. It is
// not a GPU timestamp or an estimate of animation FPS (physics is frozen).
export async function profileFrames(
  app = window.tension,
  {
    seed = 2,
    times = [4, 14.91666666666646, 20],
    frames = 18,
    warmup = 5,
  } = {},
) {
  const renderer = app.renderer;
  const saved = {
    manual: app.manual,
    paused: app.paused,
    autoReset: renderer.info.autoReset,
  };
  const summarize = (values) => {
    values.sort((a, b) => a - b);
    return {
      median: values[Math.floor(values.length / 2)],
      p95: values[
        Math.min(values.length - 1, Math.floor(values.length * 0.95))
      ],
    };
  };
  const report = {
    seed,
    frames,
    warmup,
    settings: { ...app.settings },
    viewport: [innerWidth, innerHeight, devicePixelRatio],
    buffer: [renderer.domElement.width, renderer.domElement.height],
    benchmarks: [],
  };
  try {
    app.manual = true;
    renderer.info.autoReset = false;
    for (const time of times) {
      app.pause(false);
      app.reset(seed);
      app.advance(time);
      app.pause(true);
      const samples = [];
      for (let i = -warmup; i < frames; i++) {
        await new Promise(requestAnimationFrame);
        await renderer.backend.device.queue.onSubmittedWorkDone();
        renderer.info.reset();
        const start = performance.now();
        app.render();
        const submitted = performance.now();
        await renderer.backend.device.queue.onSubmittedWorkDone();
        if (i >= 0)
          samples.push({
            cpu: submitted - start,
            frame: performance.now() - start,
            draws: renderer.info.render.drawCalls,
            passes: renderer.info.render.frameCalls,
            triangles: renderer.info.render.triangles,
          });
      }
      report.benchmarks.push({
        time: app.time,
        ...Object.fromEntries(
          Object.keys(samples[0]).map((key) => [
            key,
            summarize(samples.map((sample) => sample[key])),
          ]),
        ),
      });
    }
    return report;
  } finally {
    renderer.info.autoReset = saved.autoReset;
    app.reset();
    app.pause(saved.paused);
    app.manual = saved.manual;
  }
}
