// The storm's sound, all made on the fly with WebAudio (no samples). Not a field recording: the
// sound of a diorama on a table, the storm in a box, heard from the room.
//
// - the rain: a steady wash (a soft hiss, its body a little lower), breathing with slow gusts,
//   kept low under the thunder (a backdrop, not the foreground)
// - the thunder: never the bolt's own (its time is stopped), the rest of the storm far off:
//   soft rolls every 10 to 35 s, a few swells each, rumbling unevenly and dying out in a
//   long dark tail; and under all of it a faint low drone, the storm's breath
// - the camera: the nearer it comes, the closer and brighter the rain;
//   from far off, the rain dulled to a wash and the thunder all there is
// - the bolt hovered: its static, close by (crackling, fizzing, a faint buzz under it), and a
//   sharp little zap at each flash of its run; gone the moment it is let be
// The context starts on the first click or key (browsers want one); p (pause) hushes it all.

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// the mix: each a gain over the defaults (1 = as designed), but the gusts' depth (0 still
// … 1 as designed … 2 stormy) and the thunder's gap (seconds between two rolls, min and max)
export const MIX = { volume: 1, wash: 1, gusts: 1, thunder: 1, gapMin: 10, gapMax: 35, drone: 1, room: 1, static: 1 };

export function createSound() {
  let ctx = null, mix, master, comp, verb, dry;
  let hiss, hissLp, hissGain, body, bodyGain, drone, verbGain, thunderBus, clapBus, nearBus, rainDuck;
  let white, brown, crackle, staticGain, staticBus, crackleHp, fizzBp;
  let hovered = false, nextCrack = 0;
  let nextThunder = 0, gust = 0.5, nextGust = 0;
  const api = { on: false, started: false, paused: false, mix: { ...MIX } };
  let near = 0.5, lastSolo = null, soloAt = -1;

  // ---- noise, made once ----
  function noiseBuffer(seconds, channels, kind) {
    const sr = ctx.sampleRate, b = ctx.createBuffer(channels, Math.floor(sr * seconds), sr);
    for (let c = 0; c < channels; c++) {
      const d = b.getChannelData(c);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
        else d[i] = w;
      }
    }
    return b;
  }

  // a dark room, more hall than room: the thunder needs a long tail
  function makeVerb(seconds) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds), ir = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        // darker as it decays: a one-pole lowpass closing down along the tail
        const k = 0.6 - 0.5 * x;
        lp += k * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x, 2.5);
      }
    }
    const v = ctx.createConvolver();
    v.buffer = ir;
    return v;
  }

  function loop(buffer) {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * buffer.duration);
    return s;
  }
  function filter(type, freq, q = 0.707) {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }
  function gain(v) {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  }

  function setup() {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    white = noiseBuffer(9, 2, 'white');
    brown = noiseBuffer(12, 1, 'brown');

    // out: the mix → a soft compressor (the thunder's swells kept in hand) → master → out
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.05;
    comp.release.value = 0.6;
    master = gain(0);
    // and last, a soft ceiling: untouched below 0.7, rounding off above, never past 1 (so the
    // bolt's roll can be pushed hard without breaking up into hard clipping)
    const ceil = ctx.createWaveShaper();
    ceil.curve = Float32Array.from({ length: 4096 }, (_, i) => {
      const x = (i / 2047.5 - 1) * 2, ax = Math.abs(x); // the curve spans -2 … 2
      return Math.sign(x) * (ax < 0.7 ? ax : 0.7 + 0.3 * Math.tanh((ax - 0.7) / 0.3));
    });
    ceil.oversample = '2x';
    const pre = gain(0.5), post = gain(2); // (a shaper maps -1…1: scaled to see -2…2)
    mix = gain(1);
    mix.connect(comp).connect(master).connect(pre).connect(ceil).connect(post).connect(ctx.destination);
    dry = gain(1);
    dry.connect(mix);
    verb = makeVerb(4.5);
    verbGain = gain(0.55);
    verb.connect(verbGain).connect(mix);
    thunderBus = gain(1);
    thunderBus.connect(dry);
    thunderBus.connect(gain(0.9)).connect(verb);
    // the bolt's own crack, right here in the box: dry and up front, only a touch of the room
    // (the room's long tail is what makes a sound far), through a soft clip so it can hit hard
    clapBus = gain(1);
    const clip = ctx.createWaveShaper();
    clip.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(2 * (i / 511.5 - 1)) / Math.tanh(2));
    clip.oversample = '2x';
    clapBus.connect(clip).connect(dry);
    clapBus.connect(gain(0.18)).connect(verb);
    // and its roll, right over the box: up front too, warmed into a growl, enough of the room
    // left for the roll to boom round it; its own fast limiter, past the mix's compressor (its
    // slow attack and release would pump on it), so it comes through loud and whole
    nearBus = gain(1);
    const growl = ctx.createWaveShaper();
    growl.curve = Float32Array.from({ length: 1024 }, (_, i) => Math.tanh(1.5 * (i / 511.5 - 1)) / Math.tanh(1.5));
    growl.oversample = '2x';
    const lim = ctx.createDynamicsCompressor();
    lim.threshold.value = -10;
    lim.knee.value = 4;
    lim.ratio.value = 12;
    lim.attack.value = 0.003;
    lim.release.value = 0.25;
    nearBus.connect(growl).connect(lim).connect(gain(1.3)).connect(master);
    nearBus.connect(gain(0.35)).connect(verb);

    // the rain, all of it, held down a moment under the bolt's own roll
    rainDuck = gain(1);
    rainDuck.connect(dry);
    // the wash: white noise shaped to rain, a hiss with a soft, dark top (no glassy fizz)
    hiss = loop(white);
    hissLp = filter('lowpass', 3500, 0.5);
    hissGain = gain(0.027);
    hiss.connect(filter('highpass', 700, 0.5)).connect(filter('peaking', 3200, 0.8)).connect(hissLp).connect(hissGain);
    hissGain.connect(rainDuck);
    hissGain.connect(gain(0.25)).connect(verb);
    // its body, lower down: the rain on the whole meadow at once
    body = loop(brown);
    bodyGain = gain(0.03);
    body.connect(filter('bandpass', 420, 0.6)).connect(bodyGain).connect(rainDuck);


    // the storm's breath: a faint, slow, very low drone
    const d = loop(brown);
    drone = gain(0.0);
    d.connect(filter('lowpass', 70, 0.5)).connect(drone);
    drone.connect(dry);
    drone.gain.setTargetAtTime(0.09, ctx.currentTime, 3);

    // the static, silent till the bolt is hovered: dry and close, only a breath of the room
    staticBus = gain(1);
    staticBus.connect(dry);
    staticBus.connect(gain(0.12)).connect(verb);
    staticGain = gain(0);
    staticGain.connect(staticBus);
    // its crackle: sparse pops, bunched in sputters, high-passed to a dry tick
    crackle = crackleBuffer(5);
    crackleHp = filter('highpass', 1800, 0.7);
    loop(crackle).connect(crackleHp).connect(gain(0.9)).connect(staticGain);
    // its fizz: a thin hiss up high, the air ionized round the channel
    fizzBp = filter('bandpass', 5200, 1.4);
    loop(white).connect(fizzBp).connect(gain(0.05)).connect(staticGain);
    // its buzz: a faint rough hum, a mains-like 100 Hz sawtooth kept to its upper overtones
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 100;
    hum.connect(filter('bandpass', 1400, 2)).connect(gain(0.035)).connect(staticGain);
    hum.start();

    nextThunder = ctx.currentTime + 3 + Math.random() * 4;
  }

  // static crackle: silence peppered with pops (a click and a few ms of decaying noise), some
  // alone, most in short sputters
  function crackleBuffer(seconds) {
    const sr = ctx.sampleRate, b = ctx.createBuffer(1, Math.floor(sr * seconds), sr), d = b.getChannelData(0);
    let i = 0;
    while (i < d.length) {
      i += Math.floor(sr * (Math.random() < 0.3 ? 0.06 + Math.random() * 0.25 : 0.004 + Math.random() * 0.03));
      const a = (Math.random() < 0.15 ? 0.7 : 0.15 + Math.random() * 0.35) * (Math.random() < 0.5 ? 1 : -1);
      const len = Math.floor(sr * (0.0005 + Math.random() * 0.004));
      for (let j = 0; j < len && i + j < d.length; j++) {
        const e = Math.exp(-j / (len * 0.3));
        d[i + j] += a * e * (j === 0 ? 1 : Math.random() * 2 - 1);
      }
    }
    return b;
  }

  // one zap, right now: a bright snap of noise, gone in a few tens of ms (each flash of a run)
  function zap(k) {
    const at = ctx.currentTime + 0.005, a = 0.1 * k * api.mix.static;
    const s = ctx.createBufferSource();
    s.buffer = white;
    const g = gain(0);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(a, at + 0.002);
    g.gain.setTargetAtTime(0, at + 0.004, 0.012 + Math.random() * 0.02);
    s.connect(filter('bandpass', 2500 + Math.random() * 3500, 0.9)).connect(g).connect(staticBus);
    s.start(at, Math.random() * 8);
    s.stop(at + 0.2);
  }

  // a far roll of thunder: brown noise through a lowpass closing down as it dies, its envelope a
  // few uneven swells, shaken by a slow random flutter (the roll's grain)
  // (`near`: the bolt's own, right over the box: huge, wide, a roar opening bright and dropping
  // into a deep sub, its swells longer and heavier)
  function thunder(at, near = false) {
    const dist = near ? 0.25 : 0.55 + Math.random() * 0.45; // all far, some farther
    const swells = near ? 3 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 4);
    const len = near ? 5.5 + Math.random() * 1.5 : 5 + Math.random() * 5 + swells * 0.8;
    const N = 512, curve = new Float32Array(N);
    const bumps = [];
    let tb = 0;
    for (let i = 0; i < swells; i++) {
      if (near) bumps.push({ t: tb, a: i === 0 ? 1 : 0.5 + Math.random() * 0.45, rise: i === 0 ? 0.02 : 0.08 + Math.random() * 0.2, fall: i === 0 ? 1.3 : 0.6 + Math.random() * 0.9 });
      else bumps.push({ t: tb, a: (i === 0 ? 1 : 0.4 + Math.random() * 0.7), rise: 0.15 + Math.random() * 0.6, fall: 0.8 + Math.random() * 2.2 });
      tb += near ? 0.3 + Math.random() * 0.7 : 0.4 + Math.random() * 1.6;
    }
    // the flutter: random values every ~1/9 s, smoothed
    const fl = Array.from({ length: Math.ceil(len * 9) + 2 }, () => 0.45 + Math.random() * 0.55);
    for (let i = 0; i < N; i++) {
      const t = (i / (N - 1)) * len;
      let v = 0;
      for (const b of bumps) {
        const s = t - b.t;
        if (s > 0) v += b.a * (1 - Math.exp(-s / b.rise)) * Math.exp(-s / b.fall);
      }
      const p = t * 9, k = Math.floor(p), w = p - k, ws = w * w * (3 - 2 * w);
      const flutter = fl[k] * (1 - ws) + fl[k + 1] * ws;
      curve[i] = v * flutter * (1 - (i / (N - 1)) ** 4);
    }
    let peak = 0;
    for (const v of curve) peak = Math.max(peak, v);
    const level = (api.mix.thunder * (near ? 1.4 : 0.75 - 0.5 * (dist - 0.55))) / peak;
    for (let i = 0; i < N; i++) curve[i] *= level;
    curve[0] = 0;

    const env = gain(0);
    env.gain.setValueCurveAtTime(curve, at, len);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = (Math.random() * 2 - 1) * (near ? 0.15 : 0.7);
    const out = pan ? (env.connect(pan), pan) : env;
    out.connect(near ? nearBus : thunderBus);

    // the rumble itself: closing down from a dull growl to a sub tail
    // (the near one twice over, each side its own stretch of noise: wide, all round you)
    const srcs = [];
    const lr = near && ctx.createChannelMerger ? ctx.createChannelMerger(2) : null;
    if (lr) lr.connect(env);
    for (let c = 0; c < (lr ? 2 : 1); c++) {
      const src = ctx.createBufferSource();
      src.buffer = brown;
      src.loop = true;
      const lp = filter('lowpass', 1, 0.9);
      if (near) { // a crashing roar at first, quickly darkening to a growl, then the sub tail
        lp.frequency.setValueAtTime(1600, at);
        lp.frequency.exponentialRampToValueAtTime(450, at + 0.9);
        lp.frequency.exponentialRampToValueAtTime(140, at + len);
      } else {
        const top = 320 - 200 * (dist - 0.55);
        lp.frequency.setValueAtTime(top, at);
        lp.frequency.exponentialRampToValueAtTime(top * 0.35, at + len);
      }
      src.connect(lp);
      if (lr) lp.connect(lr, 0, c); else lp.connect(env);
      srcs.push(src);
    }
    // and under the near one, the ground shaking: a deep sub, heavier as the roll darkens
    if (near) {
      const sub = ctx.createBufferSource();
      sub.buffer = brown;
      sub.loop = true;
      const sg = gain(0);
      sg.gain.setValueAtTime(0.9, at);
      sg.gain.linearRampToValueAtTime(1.3, at + 1);
      sub.connect(filter('lowpass', 75, 0.9)).connect(sg).connect(env);
      srcs.push(sub);
    }
    const src = srcs[0];
    // a little of the tearing above it, only at the start of the nearer ones
    const tear = ctx.createBufferSource();
    tear.buffer = white;
    const tg = gain(0);
    const tearAmt = (near ? 0.07 : 0.03) * clamp((0.85 - dist) / 0.3, 0, 1);
    tg.gain.setValueAtTime(0, at);
    tg.gain.linearRampToValueAtTime(tearAmt, at + 0.25);
    tg.gain.setTargetAtTime(0, at + 0.4, near ? 0.6 : 0.5);
    tear.connect(filter('bandpass', 500 + Math.random() * 300, 1.2)).connect(tg).connect(env);

    for (const x of srcs) {
      x.start(at, Math.random() * brown.duration);
      x.stop(at + len + 0.1);
    }
    tear.start(at, Math.random() * 4);
    tear.stop(at + (near ? 3 : 2));
    src.onended = () => { env.disconnect(); };
  }

  // the bolt let go, right there: the crack of each of its flashes (`times` from now, in s,
  // `amps` how strong), a dry tearing snap, and the near roll rumbling out after it
  function clap(times, amps) {
    const now = ctx.currentTime + 0.01;
    times.forEach((t, i) => {
      const at = now + t, a = amps[i] * api.mix.thunder;
      const s = ctx.createBufferSource();
      s.buffer = white;
      const g = gain(0);
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(0.32 * a, at + 0.003);
      g.gain.setTargetAtTime(0.08 * a, at + 0.006, 0.02); // the snap, then its rip
      g.gain.setTargetAtTime(0, at + 0.05, 0.07);
      const hp = filter('highpass', 1200 + Math.random() * 800, 0.6);
      const lp = filter('lowpass', 1, 0.5);
      lp.frequency.setValueAtTime(9000, at);
      lp.frequency.exponentialRampToValueAtTime(1800, at + 0.4);
      s.connect(hp).connect(lp).connect(g).connect(clapBus);
      // and the blow under it, in the chest: a low knock dropping fast, and a burst of rumble
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(120, at);
      o.frequency.exponentialRampToValueAtTime(42, at + 0.12);
      const og = gain(0);
      og.gain.setValueAtTime(0, at);
      og.gain.linearRampToValueAtTime(1 * a, at + 0.003);
      og.gain.setTargetAtTime(0, at + 0.01, 0.1);
      o.connect(og).connect(clapBus);
      const b = ctx.createBufferSource();
      b.buffer = brown;
      const bg = gain(0);
      bg.gain.setValueAtTime(0, at);
      bg.gain.linearRampToValueAtTime(1.4 * a, at + 0.004);
      bg.gain.setTargetAtTime(0, at + 0.02, 0.1);
      b.connect(filter('lowpass', 220, 0.8)).connect(bg).connect(clapBus);
      s.start(at, Math.random() * 6);
      b.start(at, Math.random() * 8);
      o.start(at);
      s.stop(at + 0.8);
      b.stop(at + 0.8);
      o.stop(at + 0.6);
    });
    thunder(now + 0.04, true);
    nextThunder = Math.max(nextThunder, now + 9); // no far roll over it
    // room for it: the rain ducks under it
    rainDuck.gain.cancelScheduledValues(now);
    rainDuck.gain.setTargetAtTime(0.2, now, 0.03);
    rainDuck.gain.setTargetAtTime(1, now + 1.5, 1.5);
  }

  // each frame: the gusts, the thunder's schedule, the camera's distance
  api.update = (dt, distance) => {
    if (!ctx || !api.on) return;
    const now = ctx.currentTime;
    // nearer, the rain closer: 0 at the farthest the controls go, 1 at the nearest
    near = clamp(1 - (distance - 6) / (40 - 6), 0, 1) ** 0.8;
    const m = api.mix, lift = api.paused ? 0 : 1;
    // one layer alone (`solo`: wash, thunder, drone, or room for the reverb only)
    const only = (k) => (!api.solo || api.solo === k ? 1 : 0);
    if (api.solo !== lastSolo) { lastSolo = api.solo; soloAt = now; }
    const snap = now - soloAt < 0.4; // a solo switches quick, not with the gusts' slow glide
    dry.gain.setTargetAtTime(api.solo === 'room' ? 0 : 1, now, 0.05);
    thunderBus.gain.setTargetAtTime(only('thunder'), now, 0.05);
    clapBus.gain.setTargetAtTime(only('thunder'), now, 0.05);
    nearBus.gain.setTargetAtTime(only('thunder'), now, 0.05);
    staticBus.gain.setTargetAtTime(only('static'), now, 0.05);
    // the static: quick in, a little slower out; its crackle and fizz shifting all the while
    staticGain.gain.setTargetAtTime(hovered ? m.static : 0, now, hovered ? 0.03 : 0.12);
    if (hovered && now > nextCrack) {
      crackleHp.frequency.setTargetAtTime(1200 + Math.random() * 2400, now, 0.04);
      fizzBp.frequency.setTargetAtTime(3800 + Math.random() * 3000, now, 0.08);
      nextCrack = now + 0.05 + Math.random() * 0.15;
    }
    if (now > nextGust) {
      gust = clamp(gust + (Math.random() - 0.5) * 0.6, 0.15, 1);
      nextGust = now + 1.2 + Math.random() * 2.5;
    }
    const g = 1 + m.gusts * (0.45 * gust - 0.2);
    verbGain.gain.setTargetAtTime(0.55 * m.room, now, 0.05);
    hissGain.gain.setTargetAtTime(lift * only('wash') * m.wash * g * (0.018 + 0.015 * near), now, snap ? 0.05 : 1.2);
    hissLp.frequency.setTargetAtTime(1600 + 3400 * near * (0.8 + 0.2 * gust), now, 0.4);
    bodyGain.gain.setTargetAtTime(lift * only('wash') * m.wash * g * 0.03, now, snap ? 0.05 : 1.2);
    drone.gain.setTargetAtTime(lift * only('drone') * m.drone * 0.09, now, snap ? 0.05 : 1.5);
    if (api.paused) { nextThunder = Math.max(nextThunder, now + 2); return; }
    if (nextThunder < now - 1) nextThunder = now + 2 + Math.random() * 6; // back from silence
    if (now > nextThunder - 0.2) {
      thunder(Math.max(now, nextThunder));
      nextThunder += m.gapMin + Math.random() * Math.max(0, m.gapMax - m.gapMin);
    }
  };

  api.setVolume = (v) => {
    api.mix.volume = v;
    if (ctx && api.on) master.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
  };
  // the bolt's own clap, now
  api.clap = (times, amps) => { if (ctx && api.on) clap(times, amps); };
  // the bolt hovered or not, and a zap at each flash of its run (`k` how bright)
  api.setHover = (on) => { hovered = on; };
  api.zap = (k = 1) => { if (ctx && api.on && hovered) zap(k); };
  // a roll now (for the controls page)
  api.thunderNow = () => { if (ctx && api.on) thunder(ctx.currentTime + 0.05); };

  // on the first gesture, then on and off
  api.start = () => {
    if (api.started) return;
    api.started = true;
    setup();
    api.setOn(api.on);
  };
  api.setOn = (on) => {
    api.on = on;
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    if (on) {
      ctx.resume();
      master.gain.setTargetAtTime(api.mix.volume, now, 0.8); // the rain blooming in
    } else {
      master.gain.setTargetAtTime(0, now, 0.15);
    }
  };
  return api;
}
