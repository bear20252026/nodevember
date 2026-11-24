import {
  FPS,
  SIZE,
  DURATION,
  LOOP_BLEND_FRAMES,
  SOURCE_DURATION,
  SEED,
  START_TIME,
  PLAYBACK_SPEED,
} from "./capture-sequence.js";

const nextFrame = () => new Promise(requestAnimationFrame);
const png = (canvas) =>
  new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG capture failed")),
      "image/png",
    ),
  );

// Recording controls only the timeline and output size. Camera motion,
// fractures, materials and lighting use the interactive experiment unchanged.
export function createCaptureSession({
  renderSize = 1536,
  startTime = START_TIME,
} = {}) {
  const app = window.tension;
  if (!app || !document.querySelector("#status").hidden)
    throw new Error("Wait for Tension to load");
  if (innerWidth !== SIZE || innerHeight !== SIZE || devicePixelRatio !== 1)
    throw new Error("Use a 1024 × 1024 viewport at device scale 1");
  if (!Number.isInteger(renderSize) || renderSize < SIZE)
    throw new Error("Render size must be an integer of at least 1024");
  const startFrame = Math.round(startTime * FPS);
  if (
    startFrame < 0 ||
    !Number.isFinite(startFrame) ||
    Math.abs(startFrame / FPS - startTime) > 1e-8
  )
    throw new Error("Start time must be nonnegative and use whole frames");
  const { renderer, settings, gui } = app;
  const source = renderer.domElement,
    header = document.querySelector("header"),
    panel = gui.domElement;
  const previous = {
    settings: { ...settings },
    manual: app.manual,
    paused: app.paused,
    ratio: renderer.getPixelRatio(),
    width: source.width,
    height: source.height,
    headerStyle: header.style.cssText,
    panelStyle: panel.style.cssText,
    canvasStyle: source.style.cssText,
    panelInert: panel.inert,
    closed: gui._closed,
    uiHidden: document.body.classList.contains("ui-hidden"),
  };
  const input = new AbortController();
  for (const type of [
    "keydown",
    "keyup",
    "pointerdown",
    "pointermove",
    "pointerup",
    "wheel",
  ]) {
    window.addEventListener(
      type,
      (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { signal: input.signal, capture: true, passive: false },
    );
  }
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  const uiScale = Math.SQRT2;
  let nextIndex = 0,
    restored = false,
    previousEvent = "";
  const events = [];

  app.manual = true;
  app.pause(false);
  app.setPull(false);
  Object.assign(settings, {
    auto: true,
    speed: 1,
    resolution: renderSize / SIZE,
  });
  renderer.setPixelRatio(renderSize / SIZE);
  renderer.setSize(SIZE, SIZE, false);
  gui.close();
  panel.inert = true;
  source.style.pointerEvents = "none";
  document.body.classList.remove("ui-hidden");
  header.style.zoom = panel.style.zoom = uiScale;
  header.style.left = panel.style.right = `${28 / uiScale}px`;
  header.style.top = `${24 / uiScale}px`;
  panel.style.top = `${20 / uiScale}px`;

  function text(
    element,
    label = element.textContent.trim().replace(/\s+/g, " "),
    center = false,
  ) {
    const rect = element.getBoundingClientRect(),
      style = getComputedStyle(element);
    ctx.font = `${style.fontWeight} ${parseFloat(style.fontSize) * uiScale}px ${style.fontFamily}`;
    ctx.letterSpacing =
      style.letterSpacing === "normal"
        ? "0px"
        : `${parseFloat(style.letterSpacing) * uiScale}px`;
    ctx.fillStyle = style.color;
    ctx.textAlign = center ? "center" : "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
      label,
      center ? rect.x + rect.width / 2 : rect.x,
      rect.y + rect.height / 2,
    );
  }
  function snapshot() {
    // Copy immediately after rendering, before WebGPU presentation clears it.
    ctx.drawImage(source, 0, 0, SIZE, SIZE);
    ctx.save();
    text(header);
    text(panel.querySelector(":scope > .title"), "› SETTINGS", true);
    ctx.restore();
  }
  function advance() {
    app.advance(1 / FPS);
    // Advance the world-space recycling during preroll and previews too.
    app.atmosphere.rocks.field.update(app.time, app.journey.cameraPose(1).z);
  }
  function event(frame) {
    const j = app.journey,
      simulation = j.current.simulation;
    const key = `${j.index}:${j.breaks}:${j.transitionAge >= 0}`;
    if (key !== previousEvent) {
      events.push({
        frame,
        time: frame / FPS,
        simulationTime: j.time,
        assembly: j.index,
        chains: simulation.chainCount,
        mode: simulation.fractureMode,
        breaks: j.breaks,
        transition: j.transitionAge >= 0,
      });
      previousEvent = key;
    }
  }
  async function reset() {
    app.pause(false);
    app.reset(SEED);
    settings.speed = 1;
    nextIndex = 0;
    previousEvent = "";
    events.length = 0;
    for (let i = 0; i < startFrame; i++) {
      advance();
      if (i % 60 === 0) await nextFrame();
    }
    settings.speed = PLAYBACK_SPEED;
  }
  return {
    app,
    canvas,
    events,
    reset,
    startTime,
    async preview(frame) {
      if (
        !Number.isInteger(frame) ||
        frame < 0 ||
        frame >= SOURCE_DURATION * FPS
      )
        throw new RangeError("Invalid preview frame");
      await reset();
      for (let i = 1; i <= frame; i++) {
        advance();
        if (i % 60 === 0) await nextFrame();
      }
      await nextFrame();
      app.render();
      snapshot();
      return { frame, time: app.time, state: app.inspect() };
    },
    async warmup() {
      await reset();
      for (let i = 0; i < 3; i++) {
        await nextFrame();
        app.render();
      }
      await renderer.backend.device.queue.onSubmittedWorkDone();
    },
    async draw(frame) {
      if (frame !== nextIndex)
        throw new Error(`Expected frame ${nextIndex}; received ${frame}`);
      if (
        innerWidth !== SIZE ||
        innerHeight !== SIZE ||
        devicePixelRatio !== 1 ||
        source.width !== renderSize ||
        source.height !== renderSize
      )
        throw new Error("Canvas resized during capture");
      if (frame > 0) advance();
      event(frame);
      await nextFrame();
      app.render();
      snapshot();
      nextIndex++;
    },
    async restore() {
      if (restored) return;
      restored = true;
      input.abort();
      Object.assign(settings, previous.settings);
      app.reset();
      renderer.setPixelRatio(previous.ratio);
      renderer.setSize(
        previous.width / previous.ratio,
        previous.height / previous.ratio,
        false,
      );
      header.style.cssText = previous.headerStyle;
      panel.style.cssText = previous.panelStyle;
      source.style.cssText = previous.canvasStyle;
      panel.inert = previous.panelInert;
      document.body.classList.toggle("ui-hidden", previous.uiHidden);
      gui.close(previous.closed);
      gui.controllersRecursive().forEach((c) => c.updateDisplay());
      app.pause(previous.paused);
      await nextFrame();
      app.render();
      app.manual = previous.manual;
    },
  };
}

export async function captureVideo({
  receiver = "http://127.0.0.1:8025",
  renderSize = 1536,
  duration = SOURCE_DURATION,
  startTime = START_TIME,
} = {}) {
  if (
    ["preparing", "capturing", "encoding"].includes(
      window.captureProgress?.status,
    )
  )
    throw new Error("A capture is already running");
  const totalFrames = Math.round(duration * FPS);
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > SOURCE_DURATION ||
    Math.abs(totalFrames / FPS - duration) > 1e-8
  )
    throw new RangeError(
      "Duration must be within the sequence and use whole frames",
    );
  const session = createCaptureSession({ renderSize, startTime });
  const state = (window.captureProgress = {
    status: "preparing",
    frame: 0,
    totalFrames,
    started: performance.now(),
    cancelled: false,
    cancel() {
      this.cancelled = true;
    },
  });
  const device = session.app.renderer.backend.device;
  const post = async (path, body) => {
    const response = await fetch(receiver + path, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(120000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || `Capture receiver: ${response.status}`);
    return result;
  };
  let started = false,
    errorScope = false;
  try {
    device.pushErrorScope("validation");
    errorScope = true;
    await session.warmup();
    if (state.cancelled) throw new Error("Capture cancelled");
    await post(
      "/start",
      JSON.stringify({
        fps: FPS,
        totalFrames,
        width: SIZE,
        height: SIZE,
        renderSize,
        duration,
        finalDuration: DURATION,
        loopBlendFrames: LOOP_BLEND_FRAMES,
        seed: SEED,
        startTime,
        uiScale: Math.SQRT2,
        overlays: "Title and collapsed settings",
        cursor: false,
        audio: false,
        settings: { ...session.app.settings },
        method:
          "Fixed 30 Hz timeline, original automatic experiment, supersampled rendering, ordered lossless PNG frames with encoder backpressure",
      }),
    );
    started = true;
    state.status = "capturing";
    for (let frame = 0; frame < totalFrames; frame++) {
      if (state.cancelled) throw new Error("Capture cancelled");
      await session.draw(frame);
      const receipt = await post(`/frame/${frame}`, await png(session.canvas));
      if (receipt.frame !== frame)
        throw new Error("Out-of-order frame receipt");
      state.frame = frame + 1;
      state.simulationTime = session.app.time;
    }
    const validation = await device.popErrorScope();
    errorScope = false;
    if (validation) throw new Error(`WebGPU validation: ${validation.message}`);
    state.status = "encoding";
    state.result = await post(
      "/finish",
      JSON.stringify({
        elapsedSeconds: (performance.now() - state.started) / 1000,
        events: session.events,
      }),
    );
    state.status = "complete";
    return state.result;
  } catch (error) {
    state.status = state.cancelled ? "cancelled" : "failed";
    state.error = error.message;
    if (started) await post("/abort", "").catch(() => {});
    throw error;
  } finally {
    try {
      if (errorScope) await device.popErrorScope();
    } finally {
      await session.restore();
    }
  }
}
