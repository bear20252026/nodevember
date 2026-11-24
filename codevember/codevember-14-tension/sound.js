// The sound of the strain: a Risset rhythm that keeps slowing down (tick layers at tempos ×1,
// ×2, ×4…, each halving in one cycle, a new fast one fading in on top as the slowest fades
// out), each tick a short Shepard chord (octave-spaced partials under a fixed loudness bell)
// that keeps rising, with a fibre's snap. One cycle is one ×3 of the zoom. Over it, the rope
// itself: each strand's snap, a dry crack and a low thump, and the creaks just before it.
// Its clock drives the picture's while it plays: time() is where the picture's time is pulled to.
import { strands } from './rope.js';
import { warp, creaks } from './beat.js';

export function createSound(T) {
  const M = 8, FMIN = 30; // Shepard partials
  const N = 5, BASE = 34; // tick layers, slowest tempo (bpm)
  const PITCH = 1; // octaves risen per cycle
  const MOD = 2 ** 20, DT = 0.0005;
  let ctx = null, master, verb, noiseBuf, rawNoise;
  let offset = 0, t0 = 0, step = 0, stepOff = 0, simTime = 0, b = 0, p = 0, timer = null;
  const S = T / DT; // steps a cycle
  const api = { on: false, running: false };
  // the rope's own events in the stage of the level snapping (warped, see beat.js): snaps, creaks
  const TAUS = strands.filter((st) => !st.survivor).map((st) => st.tau);
  const CREAKS = creaks(T);
  const events = TAUS.flatMap((tau) => [{ at: tau, kind: 'snap' }, ...CREAKS.map((d, q) => ({ at: tau - d, kind: 'creak', q }))])
    .map((e, i) => ({ ...e, at: ((e.at % 1) + 1) % 1, seed: 1 + i }));
  let lastStage = 0, rand = Math.random;
  // the snaps' and creaks' own scatter, the same each cycle, so that it loops
  const seeded = (a) => () => {
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };

  const bell = (x) => (x <= 0 || x >= 1 ? 0 : Math.pow(Math.sin(Math.PI * x), 2));
  const partialX = (i, Q) => ((((i + Q) % M) + M) % M) / M;
  const freqOf = (x) => FMIN * Math.pow(2, x * M);
  const frac = (x) => ((x % 1) + 1) % 1;
  const phaseAt = (n) => (n + stepOff) / S; // cycles, at the step n (exact for an offline one)

  function setup(context) {
    ctx = context;
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    // a dim room
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    verb.connect(wet).connect(master);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.08), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = (rand() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.012));
    // plain noise, for the snap's thud
    rawNoise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.4), ctx.sampleRate);
    const rd = rawNoise.getChannelData(0);
    for (let i = 0; i < rd.length; i++) rd[i] = rand() * 2 - 1;
  }

  // a strand snapping: nothing pitched (a tone would sweep, "pew"), only noise, as a rope
  // gives way: a sharp, dry crack in the middle of the range, the fibres left tearing in a
  // quick rattle after it, and a dull thud of the load let go under them
  function grain(at, freq, q, gain, len, rate = 1) {
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.playbackRate.value = rate;
    bp.type = 'bandpass';
    bp.frequency.value = freq;
    bp.Q.value = q;
    g.gain.setValueAtTime(gain, at);
    g.gain.exponentialRampToValueAtTime(0.001, at + len);
    src.connect(bp).connect(g);
    g.connect(master);
    g.connect(verb);
    src.start(at);
    src.stop(at + len + 0.01);
  }
  function snap(time) {
    // the crack: broad, centred low in the treble, very short
    grain(time, 1600, 0.6, 1.6, 0.035);
    grain(time + 0.004, 2600, 0.9, 0.7, 0.025);
    // the fibres tearing on after it: a rattle of small ticks, thinning out
    for (let i = 0, at = time + 0.012; i < 14; i++) {
      at += 0.004 + 0.012 * (i / 14) ** 1.5 * (0.5 + rand());
      grain(at, 900 + 2200 * rand(), 1.5, 0.5 * (1 - i / 16) * (0.4 + 0.6 * rand()), 0.012, 0.8 + 0.4 * rand());
    }
    // the thud: dark noise, a short swell and decay, no pitch to it
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = rawNoise;
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    lp.Q.value = 0.5;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(0.9, time + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
    src.connect(lp).connect(g);
    g.connect(master);
    g.connect(verb);
    src.start(time);
    src.stop(time + 0.2);
  }
  // a creak before it: a few grainy clicks, low and dull, louder as the snap nears
  function creak(time, q) {
    const n = 3 + q;
    for (let i = 0; i < n; i++) {
      const at = time + i * (0.009 + 0.006 * rand());
      const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      src.buffer = noiseBuf;
      src.playbackRate.value = 0.35 + 0.1 * rand();
      bp.type = 'bandpass';
      bp.frequency.value = 380 + 160 * rand();
      bp.Q.value = 5;
      ng.gain.setValueAtTime((0.1 + 0.06 * q) * (0.6 + 0.4 * rand()), at);
      ng.gain.exponentialRampToValueAtTime(0.001, at + 0.03);
      src.connect(bp).connect(ng).connect(master);
      src.start(at);
    }
  }
  // the rope's events between the last step and this one (`c`, the stage, warped)
  function rope(time, c) {
    const wrapped = c < lastStage - 0.5;
    if (!wrapped && c <= lastStage) return; // (only ever on: a rounding step back fires nothing twice)
    for (const e of events) {
      const hit = wrapped ? e.at > lastStage || e.at <= c : e.at > lastStage && e.at <= c;
      // (none piled up at once after the tab was hidden)
      if (!hit || time < ctx.currentTime - 0.02) continue;
      rand = seeded(e.seed);
      if (e.kind === 'snap') snap(time);
      else creak(time, e.q);
      rand = Math.random;
    }
    lastStage = c;
  }

  function tick(time, gain, Q) {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain * 0.3, time + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    env.connect(master);
    env.connect(verb);
    for (let i = 0; i < M; i++) {
      const x = partialX(i, Q), a = bell(x);
      if (a < 0.02) continue;
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = freqOf(x);
      og.gain.value = a;
      o.connect(og).connect(env);
      o.start(time);
      o.stop(time + 0.15);
    }
    // a fibre snapping, its pitch following the rise
    const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    src.buffer = noiseBuf;
    bp.type = 'bandpass';
    bp.frequency.value = 1500 * Math.pow(2, frac(Q / 2) * 2);
    bp.Q.value = 3;
    ng.gain.value = gain * 0.5;
    src.connect(bp).connect(ng).connect(master);
    ng.connect(verb);
    src.start(time);
  }

  // the beat's step: the rhythm's counter b (each layer k ticks as b·2^k crosses a whole number)
  // moved on by the tempo, doubled at each turn of the cycle as the layers hand on
  function beat(n) {
    const u = phaseAt(n);
    const np = 1 - frac(u) === 1 ? 0 : 1 - frac(u); // slowing down: p falls from 1 to 0
    // a cycle over: layer k has slowed to layer k-1's tempo and becomes it; a new fast layer enters
    if (np > p + 0.5) b = (b * 2) % MOD;
    p = np;
    return b + (BASE / 60) * Math.pow(2, p) * DT;
  }
  function advance(until) {
    while (simTime < until) {
      const u = phaseAt(step);
      const c = warp(frac(u), T);
      rope(simTime, c);
      const Q = (((u * PITCH) % M) + M) % M;
      const nb = beat(step);
      for (let k = 0; k < N; k++) {
        const m = 2 ** k;
        if (Math.floor(nb * m) !== Math.floor(b * m)) {
          const gn = bell((k + p) / N);
          if (gn > 0.003) {
            tick(simTime, gn, Q);
          }
        }
      }
      b = nb % MOD;
      step++;
      simTime = t0 + step * DT;
    }
  }

  // the rhythm (and the rope's events) going from the picture's time `now`
  async function start(now) {
    clearInterval(timer);
    offset = now - ctx.currentTime;
    t0 = ctx.currentTime + 0.05;
    stepOff = (t0 + offset) / DT;
    step = 0;
    simTime = t0;
    p = 1 - frac(phaseAt(0));
    lastStage = warp(frac(phaseAt(0)), T);
    await ctx.resume();
    timer = setInterval(() => advance(ctx.currentTime + 0.15), 25);
    advance(ctx.currentTime + 0.15);
    api.running = true;
  }
  api.toggle = async (now) => {
    if (!ctx) {
      setup(new AudioContext());
      await start(now);
    }
    api.on = !api.on;
    master.gain.setTargetAtTime(api.on ? 0.7 : 0, ctx.currentTime, 0.05);
  };
  // the sound of `seconds` from the start of a cycle (a whole number of cycles), rendered offline
  // so that it loops exactly: started where the rhythm's counter comes back to itself after a
  // cycle, a cycle ahead (so that the room's tail is already there at the start), and the end
  // crossfaded into the start. A 16-bit stereo WAV, base64.
  api.offline = async (seconds, rate = 48000, XF = 0.3) => {
    // where b starts: one cycle from b = 0 gives 2b + c, so it comes back to itself mod 1 at -c
    p = 0; b = 0; stepOff = 0;
    for (let n = 0; n < S; n++) b = beat(n) % MOD;
    const b0 = frac(-b);
    const len = Math.ceil((T + seconds + XF) * rate);
    setup(new OfflineAudioContext(2, len, rate));
    master.gain.value = 0.7;
    b = b0; p = 0; step = 0; simTime = 0; t0 = 0;
    lastStage = warp(frac(-1 / S), T);
    advance(len / rate - 0.2);
    const buf = await ctx.startRendering();
    const a0 = Math.round(T * rate), L = Math.round(seconds * rate), X = Math.round(XF * rate);
    const ch = [0, 1].map((c) => {
      const d = buf.getChannelData(c), o = d.slice(a0, a0 + L);
      for (let i = 0; i < X; i++) {
        const k = i / X;
        o[i] = o[i] * k + d[a0 + L + i] * (1 - k);
      }
      return o;
    });
    let peak = 0;
    for (const o of ch) for (const v of o) peak = Math.max(peak, Math.abs(v));
    const g = 0.89 / peak;
    const wav = new DataView(new ArrayBuffer(44 + L * 4));
    const str = (o, s) => [...s].forEach((c, i) => wav.setUint8(o + i, c.charCodeAt(0)));
    str(0, 'RIFF'); wav.setUint32(4, 36 + L * 4, true); str(8, 'WAVEfmt ');
    wav.setUint32(16, 16, true); wav.setUint16(20, 1, true); wav.setUint16(22, 2, true);
    wav.setUint32(24, rate, true); wav.setUint32(28, rate * 4, true); wav.setUint16(32, 4, true); wav.setUint16(34, 16, true);
    str(36, 'data'); wav.setUint32(40, L * 4, true);
    for (let i = 0; i < L; i++) for (let c = 0; c < 2; c++) wav.setInt16(44 + 4 * i + 2 * c, Math.max(-32767, Math.min(32767, Math.round(ch[c][i] * g * 32767))), true);
    const bytes = new Uint8Array(wav.buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { wav: btoa(bin), peak, gain: g };
  };
  api.pause = async (paused) => {
    if (!ctx) return;
    if (paused) await ctx.suspend();
    else await ctx.resume();
  };
  // the whole rope breaking for good (a click): the last strands' cracks all at once, a long
  // tear of fibres and a deep thud as the load lets go; then the rhythm stops, for good, leaving the room ringing. (The click is a gesture: it starts the sound if it
  // was never started; turned off, it stays off.)
  function rupture(time) {
    snap(time);
    snap(time + 0.011);
    grain(time + 0.02, 1100, 0.5, 1.2, 0.06);
    for (let i = 0, at = time + 0.03; i < 40; i++) {
      at += 0.003 + 0.02 * (i / 40) ** 2 * (0.5 + Math.random());
      grain(at, 700 + 2600 * Math.random(), 1.5, 0.6 * (1 - i / 42) * (0.3 + 0.7 * Math.random()), 0.014, 0.7 + 0.5 * Math.random());
    }
    const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = rawNoise;
    src.playbackRate.value = 0.6;
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(1.6, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    src.connect(lp).connect(g);
    g.connect(master);
    g.connect(verb);
    src.start(time);
    src.stop(time + 0.65);
  }
  api.breakForGood = async (now) => {
    if (!ctx) {
      setup(new AudioContext());
      offset = now - ctx.currentTime;
      api.on = true;
      master.gain.value = 0.7;
    }
    clearInterval(timer);
    timer = null;
    api.running = false;
    await ctx.resume();
    const at = ctx.currentTime + 0.01;
    rupture(at);
  };
  // a new rope after the break: the rhythm starts again from the picture's time `now`, over the
  // old one's ringing tail (nothing if the sound was never started)
  api.renew = async (now) => {
    if (!ctx) return;
    await start(now);
  };
  api.time = () => ctx.currentTime + offset;
  return api;
}
