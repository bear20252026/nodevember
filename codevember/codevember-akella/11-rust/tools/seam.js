// EVAL="$(cat tools/seam.js)" node tools/shot.mjs out.png 800x600 0: settles the flake sim into its exact cycle, runs one
// more loop (two turns) and prints how far the flakes ended up from where they started (should be 0).
(async () => {
  const r = window.__rust;
  const device = r.renderer.backend.device;
  const read = async () => new Float32Array(await r.renderer.getArrayBufferAsync(r.simState.value));
  const wait = () => new Promise((f) => setTimeout(f, 400));
  r.state.pause = true;
  await wait();
  r.state.exact = true;
  r.state.hold = 0;
  const t0 = performance.now();
  r.state.pause = false;
  await new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(f)));
  r.state.pause = true;
  await device.queue.onSubmittedWorkDone();
  console.log(`bake settle wall ${(performance.now() - t0).toFixed(0)} ms`);
  const A = await read();
  await r.simBench(7200);
  const B = await read();
  let n = 0,
    max = 0,
    qmax = 0;
  for (let f = 0; f < A.length / 20; f++) {
    const a = f * 20;
    if (A[a + 3] !== B[a + 3]) n++;
    max = Math.max(max, Math.hypot(A[a] - B[a], A[a + 1] - B[a + 1], A[a + 2] - B[a + 2]));
    for (let k = 8; k < 12; k++) qmax = Math.max(qmax, Math.abs(A[a + k] - B[a + k]));
  }
  console.log(`bake seam two turns: mode diffs ${n}, max pos diff ${max.toExponential(2)}, max quat diff ${qmax.toExponential(2)}`);
})();
