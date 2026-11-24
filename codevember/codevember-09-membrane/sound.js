// Sound. A generative score for the slide, synthesised live with Web Audio (nothing
// recorded), driven by the sim:
//   the medium   a thick, low, viscous bed of dark noise, a drone beating slowly under it
//   the membrane a pad, one chord per cell, breathing; the gummy squelch of its blocks pressed
//                against each other; pulled, a creak rising with the strain; torn, a crackling
//                rip and a soft thud, the chord sagging out of tune and muffled as it sets,
//                a squelch for each link giving way as the ring crumbles
//   the heart    a low, slow "bom bom", quicker when pulled; torn, it slows, weakens,
//                falters, stops
//   life about   wrigglers swishing past, free cells pulsing, specks ticking, droplets
// Browsers only let sound start on a gesture: it starts on the first click, key or wheel.
//   &sound=0  silent until m is pressed     &vol=0.8  its volume
// Key: m sound on / off.

const BREATH = 9; // seconds per breath of the pad
const DRONE = 36.71; // D1, the medium's pitch
const ROOTS = [73.42, 55.0, 87.31, 49.0, 65.41, 61.74]; // the cells' roots over it
const COLOURS = [
  [1, 1.5, 2, 2.25, 3, 4.5],
  [1, 1.5, 2, 2.4, 3, 3.6],
  [1, 1.333, 2, 2.667, 3, 4],
  [1, 1.5, 1.8, 2.25, 3, 4.5],
];
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createSound({ volume = 0.8, on = true } = {}) {
  let ctx = null, master, reverbIn, noise;
  const layers = {};
  let cell = null, tension = null, t0 = 0;
  const heart = { next: 0 };
  let wanted = on, playing = true; // m: on / off; space: the slide paused

  // ---- building blocks
  function noiseBuffer(kind, sec = 6) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') d[i] = w * 0.5;
        else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      }
    }
    return buf;
  }
  function noiseSrc(kind, t) {
    const s = ctx.createBufferSource();
    s.buffer = noise[kind]; s.loop = true;
    s.start(t ?? ctx.currentTime, Math.random() * 5);
    return s;
  }
  // a dark, long room: the slide under glass, wet
  function impulse(sec) {
    const len = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, a = 0.04 + 0.5 * (1 - x) * (1 - x);
        lp += (Math.random() * 2 - 1 - lp) * a;
        d[i] = lp * Math.pow(1 - x, 2.6) * (i < 600 ? i / 600 : 1);
      }
    }
    return buf;
  }
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const gain = (v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filter = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const panner = (p) => { const s = ctx.createStereoPanner(); s.pan.value = Math.max(-1, Math.min(1, p)); return s; };
  function lfo(rate, depth, target) {
    const o = osc('sine', rate), g = gain(depth);
    o.connect(g).connect(target); o.start();
    return o;
  }
  function makeLayer(name, level, send) {
    const input = gain(1), duck = gain(1), out = gain(level), s = gain(send);
    input.connect(duck).connect(out); out.connect(master); out.connect(s).connect(reverbIn);
    layers[name] = { input, duck, out };
  }

  // ---- events
  // a gummy block pressed or giving way: a pitched blob dropping, and a wet smack
  function squelch(t, { f = 150, dur = 0.3, amp = 0.2, pan = 0, bright = 1 } = {}) {
    const p = panner(pan); p.connect(layers.membrane.input);
    const o = osc('sine', f * 1.4), g = gain(0);
    o.frequency.setValueAtTime(f * 1.4, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    o.frequency.exponentialRampToValueAtTime(f * 0.68, t + dur);
    const w = osc('sine', rnd(11, 22)), wg = gain(f * 0.05); w.connect(wg).connect(o.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(p);
    const n = noiseSrc('white', t), bp = filter('bandpass', 1700 * bright, 7), ng = gain(0);
    bp.frequency.setValueAtTime(1700 * bright, t);
    bp.frequency.exponentialRampToValueAtTime(300, t + dur * 0.6);
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(amp * 0.7, t + 0.006);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5);
    n.connect(bp).connect(ng).connect(p);
    o.start(t); w.start(t); o.stop(t + dur + 0.05); w.stop(t + dur + 0.05); n.stop(t + dur);
  }
  // a droplet: a sine rising as it closes, dulled
  function bubble(t, { f = 400, amp = 0.1, pan = 0, dull = 1400 } = {}) {
    const dur = Math.min(0.25, 0.03 + 25 / f);
    const p = panner(pan), lp = filter('lowpass', dull, 0.5), o = osc('sine', f), g = gain(0);
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * rnd(1.5, 2.3), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(lp).connect(p).connect(layers.life.input);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function click(t, { f = 2500, amp = 0.1, pan = 0, q = 3, len = 0.008, dest = layers.membrane.input } = {}) {
    const n = noiseSrc('white', t), bp = filter('bandpass', f, q), g = gain(0), p = panner(pan);
    g.gain.setValueAtTime(amp, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    n.connect(bp).connect(g).connect(p).connect(dest); n.stop(t + len + 0.01);
  }
  // a wriggler darting past
  function swish(t) {
    const dur = rnd(0.5, 1.3), a = rnd(-1, 1), b = Math.max(-1, Math.min(1, a + rnd(-1.2, 1.2)));
    const n = noiseSrc('pink', t), bp = filter('bandpass', 300, 3.5), g = gain(0), p = panner(a);
    bp.frequency.setValueAtTime(rnd(250, 400), t);
    bp.frequency.exponentialRampToValueAtTime(rnd(1400, 2600), t + dur * 0.35);
    bp.frequency.exponentialRampToValueAtTime(rnd(350, 600), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rnd(0.12, 0.25), t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.setValueAtTime(a, t); p.pan.linearRampToValueAtTime(b, t + dur);
    n.connect(bp).connect(g).connect(p).connect(layers.life.input); n.stop(t + dur + 0.05);
    for (let i = 0, k = Math.floor(rnd(2, 6)); i < k; i++)
      click(t + dur * 0.2 + i * rnd(0.05, 0.09), { f: rnd(900, 1600), amp: 0.04, pan: a + (b - a) * 0.4, q: 6, dest: layers.life.input });
  }
  // a free cell pulsing, close by in the medium
  function pulse(t) {
    const n = Math.floor(rnd(2, 5)), pan = rnd(-0.8, 0.8), f = rnd(55, 85), gap = rnd(0.32, 0.5);
    for (let i = 0; i < n; i++) {
      const tt = t + i * gap, o = osc('sine', f * 1.25), g = gain(0), p = panner(pan), lp = filter('lowpass', 300);
      o.frequency.setValueAtTime(f * 1.25, tt); o.frequency.exponentialRampToValueAtTime(f, tt + 0.25);
      g.gain.setValueAtTime(0, tt);
      g.gain.linearRampToValueAtTime(0.22 * (1 - i / (n + 1)), tt + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.4);
      o.connect(g).connect(lp).connect(p).connect(layers.life.input);
      o.start(tt); o.stop(tt + 0.45);
    }
  }
  // the heart: a round, low "bom" — a sine swelling in softly (no click), sagging a little in
  // pitch, held and fading; its octave and twelfth, quieter and shorter, let it through small
  // speakers without making it knock; the bed gives way under it
  function thump(t, { f, amp, dur }) {
    const att = 0.045;
    for (const [h, lvl, len] of [[1, 1, 1], [2, 0.32, 0.6], [3, 0.1, 0.4]]) {
      const o = osc('sine', f * h * 1.12), g = gain(0), end = t + dur * len;
      o.frequency.setValueAtTime(f * h * 1.12, t);
      o.frequency.exponentialRampToValueAtTime(f * h, t + 0.12);
      o.frequency.exponentialRampToValueAtTime(f * h * 0.88, end);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(amp * lvl, t + att);
      g.gain.setTargetAtTime(0, t + att, (end - t - att) / 3.5);
      o.connect(g).connect(layers.heart.input);
      o.start(t); o.stop(end + 0.1);
    }
    const d = layers.medium.duck.gain;
    d.setTargetAtTime(1 - Math.min(0.6, amp * 0.7), t, att / 2);
    d.setTargetAtTime(1, t + att, dur * 0.4);
  }
  function heartbeat(t, amp, { dub = true } = {}) {
    thump(t, { f: 41, amp, dur: 0.75 });
    if (dub) thump(t + rnd(0.36, 0.42), { f: 46, amp: amp * 0.7, dur: 0.6 });
  }

  // ---- the beds
  function startMedium() {
    const L = layers.medium.input;
    const n = noiseSrc('brown'), lp = filter('lowpass', 170, 0.9), g = gain(0.55);
    lfo(0.031, 70, lp.frequency);
    lfo(0.013, 0.2, g.gain);
    n.connect(lp).connect(g).connect(L);
    // the drone: two sines beating slowly, a faint fifth above
    const d1 = osc('sine', DRONE), d2 = osc('sine', DRONE * 1.004), d3 = osc('triangle', DRONE * 3);
    const dg = gain(0.16), d3g = gain(0.018), d3lp = filter('lowpass', 160);
    d1.connect(dg); d2.connect(dg); dg.connect(L);
    d3.connect(d3lp).connect(d3g).connect(L);
    lfo(0.021, 0.014, d3g.gain);
    [d1, d2, d3].forEach((o) => o.start());
  }
  function startTension() {
    // a rubber band stretched: a low sawtooth catching and slipping (stick-slip), through a
    // resonance that rises with the strain
    const o = osc('sawtooth', 38), slip = noiseSrc('white'), slp = filter('lowpass', 25), sg = gain(26);
    slip.connect(slp).connect(sg).connect(o.frequency);
    const bp = filter('bandpass', 380, 9), g = gain(0);
    o.connect(bp).connect(g).connect(layers.membrane.input);
    o.start();
    tension = { bp, g };
  }
  // one cell: a pad on its own root and colour, breathing
  function buildCell() {
    const t = ctx.currentTime, root = pick(ROOTS), colour = pick(COLOURS);
    const out = gain(0), breathDepth = gain(260);
    out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(1, t + 7);
    out.connect(layers.membrane.input);
    const breath = osc('sine', 1 / BREATH);
    breath.connect(breathDepth);
    breath.start(t0 + Math.ceil((t - t0) / BREATH) * BREATH);
    const voices = colour.map((r, i) => {
      const f = root * r, lp = filter('lowpass', 420 + i * 60, 1.4), amp = gain(0.11 / Math.sqrt(i + 1)), sw = gain(0.65);
      breathDepth.connect(lp.frequency);
      const a = osc('sawtooth', f), b = osc('triangle', f * 1.0035), c = osc('sine', f * 0.998);
      a.connect(gain(0.5)).connect(lp); b.connect(gain(0.7)).connect(lp); c.connect(gain(0.6)).connect(lp);
      lp.connect(sw).connect(amp).connect(out);
      lfo(rnd(0.018, 0.06), 0.35, sw.gain);
      const oscs = [a, b, c];
      oscs.forEach((o) => { lfo(rnd(0.07, 0.2), rnd(1.5, 4), o.detune); o.start(t); });
      return { oscs, lp };
    });
    return { root, voices, out, breath, born: t, dead: false };
  }
  function dropCell(c, fade) {
    const t = ctx.currentTime;
    c.out.gain.cancelScheduledValues(t);
    c.out.gain.setValueAtTime(c.out.gain.value, t);
    c.out.gain.linearRampToValueAtTime(0, t + fade);
    c.voices.forEach((v) => v.oscs.forEach((o) => o.stop(t + fade + 0.1)));
    c.breath.stop(t + fade + 0.1);
  }

  // ---- death
  function rip(t, pan) {
    const L = layers.membrane.input;
    tension.bp.frequency.setTargetAtTime(1800, t, 0.12);
    // crackle: links giving way, dense at first, spreading round
    for (let i = 0; i < 110; i++) {
      const tt = t + 1.9 * Math.pow(Math.random(), 1.7), age = (tt - t) / 1.9;
      click(tt, { f: rnd(900, 5000), amp: rnd(0.05, 0.32) * (1 - 0.7 * age), pan: pan + rnd(-0.4, 0.4) * (1 + age), q: rnd(2, 8), len: rnd(0.004, 0.02) });
    }
    // the tearing itself: a wet rasp sweeping down
    const n = noiseSrc('white', t), bp = filter('bandpass', 3000, 1.6), g = gain(0), p = panner(pan);
    bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(420, t + 1.5);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.32, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    n.connect(bp).connect(g).connect(p).connect(L); n.stop(t + 1.7);
    // the ring giving way: a low, soft thud
    const o = osc('sine', 90), og = gain(0);
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 1.1);
    og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.55, t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    o.connect(og).connect(layers.medium.input); o.start(t); o.stop(t + 1.4);
    squelch(t + 0.03, { f: 240, dur: 0.6, amp: 0.3, pan, bright: 1.4 });
  }

  // ---- the sim's events (from main.js)
  function torn(pan = 0) {
    if (!ctx || !cell || cell.dead) return;
    const t = ctx.currentTime;
    cell.dead = true; cell.deadAt = t;
    rip(t, pan);
    // the pad sagging out of tune, each voice its own way, muffled as it sets
    cell.voices.forEach((v, i) => {
      const sag = -rnd(120, 650) * (0.5 + i / cell.voices.length);
      v.oscs.forEach((o) => {
        o.frequency.setValueAtTime(o.frequency.value, t);
        o.frequency.exponentialRampToValueAtTime(o.frequency.value * Math.pow(2, sag / 1200), t + rnd(18, 30));
      });
      v.lp.frequency.setValueAtTime(v.lp.frequency.value, t);
      v.lp.frequency.exponentialRampToValueAtTime(rnd(90, 160), t + 26);
    });
    cell.out.gain.cancelScheduledValues(t);
    cell.out.gain.setValueAtTime(cell.out.gain.value, t);
    cell.out.gain.linearRampToValueAtTime(1.25, t + 3);
    cell.out.gain.exponentialRampToValueAtTime(0.12, t + 34);
  }
  // a link of the torn ring giving way (rate-limited: they can go many at once)
  let lastLoose = 0;
  function loosened(pan = 0) {
    if (!ctx || !cell || !cell.dead) return;
    const t = ctx.currentTime;
    if (t - lastLoose < 0.07) return;
    lastLoose = t;
    squelch(t + rnd(0.01, 0.05), { f: cell.root * rnd(1, 2.2), amp: rnd(0.03, 0.08), pan, dur: rnd(0.25, 0.5), bright: 0.5 });
  }
  function born() {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (cell) dropCell(cell, cell.dead ? 8 : 5);
    cell = buildCell();
    heart.next = 0;
    tension.bp.frequency.setTargetAtTime(380, t, 0.5);
    for (let i = 0; i < 5; i++) squelch(t + 1 + i * rnd(0.5, 1.2), { f: cell.root * rnd(1.5, 3), amp: 0.08, pan: rnd(-0.7, 0.7), dur: 0.35 });
  }

  // ---- the score, each frame: random events, the heart, the strain
  let last = 0;
  function update({ strain = 0 } = {}) {
    if (!ctx || ctx.state !== 'running' || !cell) return;
    const now = ctx.currentTime, dt = Math.min(0.25, now - last); last = now;
    if (dt <= 0) return;
    const at = () => now + 0.05 + Math.random() * dt;
    const chance = (r) => Math.random() < r * dt;
    const dead = cell.dead;
    if (!playing) { tension.g.gain.setTargetAtTime(0, now, 0.05); return; }

    if (!dead) {
      // blocks pressed against each other, more at the top of the breath and under strain
      const breath = 0.5 + 0.5 * Math.sin((2 * Math.PI * (now - t0)) / BREATH);
      if (chance(0.35 + 0.9 * breath * breath + strain * 5))
        squelch(at(), { f: cell.root * pick([2, 3, 4, 2.25, 1.5]) * rnd(0.97, 1.03), amp: rnd(0.04, 0.11) * (1 + strain), pan: rnd(-0.9, 0.9), dur: rnd(0.18, 0.42), bright: rnd(0.6, 1.2) });
    }
    // the heart: about 36 beats a minute, a little quicker on the breath's rise and much
    // quicker when pulled; once torn, it slows, weakens, falters, and stops
    if (heart.next < now) heart.next = now + 0.1;
    while (heart.next < now + 0.2) {
      const tb = heart.next, a = tb - cell.born;
      if (!dead) {
        const fade = Math.min(1, Math.max(0, (a - 1.5) / 5));
        if (fade > 0) heartbeat(tb, 0.6 * fade * (1 + 0.5 * strain) * rnd(0.92, 1.05));
        heart.next = tb + (1.7 * (1 - 0.05 * Math.sin((2 * Math.PI * (tb - t0)) / BREATH))) / (1 + 0.8 * strain) * rnd(0.97, 1.03);
      } else {
        const ag = tb - cell.deadAt, k = Math.max(0, 1 - ag / 20);
        if (k > 0 && (ag < 6 || Math.random() < 0.65)) heartbeat(tb, 0.6 * k * k * rnd(0.8, 1.1), { dub: ag < 12 || Math.random() < 0.4 });
        heart.next = k > 0 ? tb + (1.7 + ag * 0.12) * rnd(0.9, 1.25) : Infinity;
      }
    }
    // life about, whatever happens to the cell
    if (chance(1 / 8)) swish(at());
    if (chance(1 / 13)) pulse(at());
    if (chance(0.9)) click(at(), { f: rnd(1800, 4200), amp: rnd(0.008, 0.03), q: 10, pan: rnd(-1, 1), len: 0.004, dest: layers.life.input });
    if (chance(0.12)) bubble(at(), { f: rnd(700, 1500), amp: 0.025, pan: rnd(-1, 1), dull: 2200 });
    // the strain on the ring, heard as a creak
    if (!dead) {
      tension.g.gain.setTargetAtTime(Math.min(0.5, strain * strain * 0.9), now, 0.05);
      tension.bp.frequency.setTargetAtTime(380 + strain * 1400, now, 0.05);
      cell.voices.forEach((v) => v.oscs.forEach((o) => o.detune.setTargetAtTime(strain * 25, now, 0.1)));
    } else tension.g.gain.setTargetAtTime(0, now, 0.04);
  }

  // ---- on, off
  function level() { return wanted ? (playing ? volume : volume * 0.3) : 0; }
  function start() {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'playback' });
    noise = { white: noiseBuffer('white'), pink: noiseBuffer('pink'), brown: noiseBuffer('brown') };
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4;
    master = gain(0);
    master.connect(comp).connect(ctx.destination);
    const reverb = ctx.createConvolver(); reverb.buffer = impulse(6.5);
    reverbIn = gain(1);
    reverbIn.connect(reverb).connect(gain(0.7)).connect(master);
    makeLayer('medium', 0.9, 0.25);
    makeLayer('membrane', 0.8, 0.55);
    makeLayer('life', 0.5, 0.9);
    makeLayer('heart', 1.6, 0.1);
    t0 = last = ctx.currentTime;
    startMedium(); startTension();
    cell = buildCell();
    master.gain.setTargetAtTime(level(), t0, 1.2);
  }
  // the first gesture starts it (if it is wanted)
  function wake() {
    if (!wanted) return;
    if (!ctx) start();
    else if (ctx.state !== 'running') ctx.resume();
  }
  function setLevel(tc = 0.4) { if (ctx) master.gain.setTargetAtTime(level(), ctx.currentTime, tc); }
  function toggle() {
    wanted = !wanted;
    if (wanted) { wake(); ctx.resume(); }
    setLevel(0.3);
    return wanted;
  }
  // the slide paused: the sound draws back, the events stop
  function pause(p) { playing = !p; setLevel(0.6); }

  return { wake, toggle, pause, update, torn, loosened, born, get on() { return wanted; } };
}
