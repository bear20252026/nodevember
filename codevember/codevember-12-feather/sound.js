import * as THREE from 'three';

// The sounds, all made on the fly with WebAudio (no samples):
//
// - the coat: a rustle of tiny dry grains, thick and crackling while it is shaken, a
//   "brrrr" when it rouses, gone once it is bare; a "pft" with a quill's tick for each
//   feather torn off; the soft hiss of the ones in the air; a soft brush when it is stroked
// - the body through the air: a whoosh, broad and woolly in its coat, thin when bare
// - its voice, a pigeon's: soft hollow coos with a rolled start, "brrlouuu brrrlloouu",
//   now and then when left alone; a startled "brrt?" when picked up, a rolling "brrrrr"
//   shaken out of it (its pitch jolted with the shaking), a grunt on landing, a
//   doleful slow coo when bare (a little higher and thinner the barer it is), a
//   happy double coo after a POOF; `&voice=0` keeps it quiet
// - its feet: little claw ticks on the floor, a thump when it lands
// - POOF: a soft burst, a puff of down sparkling, a happy chirp
//
// Everything sits in the room: panned and quieter as it is further off the camera, with
// a short soft reverb. The context starts on the first click or key (browsers want one).

const clamp = THREE.MathUtils.clamp;
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
const rnd = (a, b) => a + Math.random() * (b - a);
// the feathers' sounds all together, against the rest (the bird's voice, its feet, the poof)
const FEATHERS = 1;

export class Sound {
  constructor() {
    this.ctx = null;
    this.on = true;
    // the creature's own voice, its coos
    this.voice = true;
    this.grains = 0;
    this.t = 0;
    this.prev = null;
    this.voiceGate = { open: false, t: 0 };
    this.nextCall = 4;
    this.lastCall = -10;
    this.lastCount = -1;
    this.lastCoat = null;
    this.legState = new Map();
    this.pan = 0;
    this.near = 1;
  }

  // on the first gesture
  start() {
    if (this.ctx) {
      if (this.on && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const sr = ctx.sampleRate;

    // white and pink noise, 2 s
    const noise = (pink) => {
      const b = ctx.createBuffer(1, sr * 2, sr), d = b.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (!pink) { d[i] = w; continue; }
        b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
      }
      return b;
    };
    this.white = noise(false);
    this.pink = noise(true);

    // out: master → a gentle limiter; a send to a small room
    this.master = ctx.createGain();
    this.master.gain.value = this.on ? 0.9 : 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp).connect(ctx.destination);
    const verb = ctx.createConvolver();
    verb.buffer = this.room(1.3);
    this.wet = ctx.createGain();
    this.wet.gain.value = 0.22;
    this.wet.connect(verb).connect(this.master);
    // what is near the creature (panned with it, quieter far off)
    this.bus = ctx.createGain();
    this.busPan = ctx.createStereoPanner();
    this.bus.connect(this.busPan);
    // the feathers' share of it
    this.fBus = ctx.createGain(); this.fBus.gain.value = FEATHERS;
    this.fBus.connect(this.bus);
    this.busPan.connect(this.master);
    this.busPan.connect(this.wet);

    // ---- continuous layers
    const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, Math.random() * 2); return s; };
    // the body's whoosh
    this.whoosh = ctx.createBiquadFilter(); this.whoosh.type = 'bandpass'; this.whoosh.Q.value = 0.7; this.whoosh.frequency.value = 400;
    this.whooshG = ctx.createGain(); this.whooshG.gain.value = 0;
    loop(this.pink).connect(this.whoosh).connect(this.whooshG).connect(this.bus);
    // the coat's bed of rustle under the grains
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    this.rustle = ctx.createBiquadFilter(); this.rustle.type = 'bandpass'; this.rustle.Q.value = 0.6; this.rustle.frequency.value = 4500;
    this.rustleG = ctx.createGain(); this.rustleG.gain.value = 0;
    loop(this.white).connect(hp).connect(this.rustle).connect(this.rustleG).connect(this.fBus);
    // the feathers in the air
    this.drift = ctx.createBiquadFilter(); this.drift.type = 'bandpass'; this.drift.Q.value = 0.5; this.drift.frequency.value = 1400;
    this.driftG = ctx.createGain(); this.driftG.gain.value = 0;
    loop(this.pink).connect(this.drift).connect(this.driftG).connect(this.master);
    this.driftG.connect(this.wet);
    // a pigeon's throat: a hollow tone, a strong fundamental and a few soft harmonics
    this.throat = ctx.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.32, 0.12, 0.04]));
    // the voice when shaken or thrown: a rolled "brrrrr", its pitch jolted by the shaking
    this.vCar = ctx.createOscillator(); this.vCar.setPeriodicWave(this.throat); this.vCar.frequency.value = 360;
    this.vMod = ctx.createOscillator(); this.vMod.frequency.value = 800;
    this.vModG = ctx.createGain(); this.vModG.gain.value = 0;
    this.vMod.connect(this.vModG).connect(this.vCar.frequency);
    this.vVib = ctx.createOscillator(); this.vVib.frequency.value = 7;
    this.vVibG = ctx.createGain(); this.vVibG.gain.value = 20;
    this.vVib.connect(this.vVibG).connect(this.vCar.frequency);
    this.vForm = ctx.createBiquadFilter(); this.vForm.type = 'peaking'; this.vForm.frequency.value = 700; this.vForm.Q.value = 1.5; this.vForm.gain.value = 5;
    this.vLp = ctx.createBiquadFilter(); this.vLp.type = 'lowpass'; this.vLp.frequency.value = 1100; this.vLp.Q.value = 1.5;
    // the roll: the tone beaten at ~26 Hz
    this.vRoll = ctx.createGain(); this.vRoll.gain.value = 0.5;
    this.vAm = ctx.createOscillator(); this.vAm.frequency.value = 26;
    const amD = ctx.createGain(); amD.gain.value = 0.5;
    this.vAm.connect(amD).connect(this.vRoll.gain);
    this.vG = ctx.createGain(); this.vG.gain.value = 0;
    this.vCar.connect(this.vForm).connect(this.vLp).connect(this.vRoll).connect(this.vG).connect(this.bus);
    for (const o of [this.vCar, this.vMod, this.vVib, this.vAm]) o.start();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend();
      else if (this.on) ctx.resume();
    });
  }

  setOn(on) {
    this.on = on;
    if (!this.ctx) return;
    if (on) this.ctx.resume();
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05);
  }

  get live() {
    return this.ctx && this.on && this.ctx.state === 'running';
  }

  // a soft room: decaying stereo noise, darker as it dies
  room(len) {
    const ctx = this.ctx, sr = ctx.sampleRate, n = Math.floor(sr * len);
    const b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        const k = 0.15 + 0.8 * Math.exp(-t * 4);
        lp += (Math.random() * 2 - 1 - lp) * k;
        d[i] = lp * Math.exp(-t * 5.5) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return b;
  }

  // ---- one-shots

  // a grain of noise through a band, swept, enveloped, panned
  grain(t, { f = 4000, f1 = f, q = 1.5, dur = 0.03, att = 0.002, gain = 0.05, pan = 0, buf = this.white, type = 'bandpass', to = this.bus, wet = 0 }) {
    if (this.grains > 140) return;
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.Q.value = q;
    flt.frequency.setValueAtTime(f, t); flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + att); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    s.connect(flt).connect(g).connect(p).connect(to);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(this.wet); }
    s.start(t, Math.random() * 1.8, dur + 0.02);
    this.grains++;
    s.onended = () => { this.grains--; p.disconnect(); };
  }

  // a tone gliding through `pts` ([time, freq] pairs), FM for the beak's buzz
  tone(t, pts, { gain = 0.1, index = 0.6, ratio = 1, type = 'triangle', att = 0.012, rel = 0.05, form = 1800, vib = 0, vibF = 6, to = this.bus, pan = 0 }) {
    const ctx = this.ctx;
    const dur = pts[pts.length - 1][0];
    const car = ctx.createOscillator(); car.type = type;
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    car.frequency.setValueAtTime(pts[0][1], t); mod.frequency.setValueAtTime(pts[0][1] * ratio, t); mg.gain.setValueAtTime(pts[0][1] * index, t);
    for (const [dt, f] of pts.slice(1)) {
      car.frequency.exponentialRampToValueAtTime(f, t + dt);
      mod.frequency.exponentialRampToValueAtTime(f * ratio, t + dt);
      if (index > 0) mg.gain.exponentialRampToValueAtTime(f * index, t + dt);
    }
    if (index > 0) mod.connect(mg).connect(car.frequency);
    let vo;
    if (vib) {
      vo = ctx.createOscillator(); vo.frequency.value = vibF;
      const vg = ctx.createGain(); vg.gain.value = vib * pts[0][1];
      vo.connect(vg).connect(car.frequency);
    }
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = form; pk.Q.value = 1.8; pk.gain.value = 8;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + att);
    g.gain.setValueAtTime(gain, t + Math.max(att, dur - rel)); g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    car.connect(pk).connect(lp).connect(g).connect(p).connect(to);
    for (const o of [car, mod, vo]) if (o) { o.start(t); o.stop(t + dur + 0.05); }
    car.onended = () => p.disconnect();
  }

  // one coo, "brrlouuu": a hollow tone through `pts` ([time, ×f] pairs over `dur`),
  // beaten at the start (the rolled "brr", `roll` deep, for `rollT` s), its throat closing
  // from a brighter "l" to a dark "ouu"
  coo(t, f, dur, { pts = [[0, 0.86], [0.3, 1.05], [1, 0.8]], roll = 0.9, rollT = 0.18, rollF = 27, gain = 0.1, vib = 0.012, pan = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.throat);
    o.frequency.setValueAtTime(f * pts[0][1], t);
    for (const [u, k] of pts.slice(1)) o.frequency.exponentialRampToValueAtTime(f * k, t + u * dur);
    const vo = ctx.createOscillator(); vo.frequency.value = rnd(4.5, 6);
    const vg = ctx.createGain(); vg.gain.value = f * vib;
    vo.connect(vg).connect(o.frequency);
    // the throat
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(f * 3.2, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + Math.min(dur * 0.45, rollT + 0.15));
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = f * 2; pk.Q.value = 1.2; pk.gain.value = 4;
    // the roll
    const am = ctx.createOscillator(); am.frequency.value = rollF;
    const ad = ctx.createGain();
    ad.gain.setValueAtTime(roll * 0.5, t); ad.gain.setValueAtTime(roll * 0.5, t + rollT * 0.6); ad.gain.linearRampToValueAtTime(0, t + rollT);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(1 - roll * 0.5, t); rg.gain.setValueAtTime(1 - roll * 0.5, t + rollT * 0.6); rg.gain.linearRampToValueAtTime(1, t + rollT);
    am.connect(ad).connect(rg.gain);
    // swelling into the "ouu", dying away
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * 0.7, t + 0.03);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.4); g.gain.setTargetAtTime(1e-4, t + dur * 0.6, dur * 0.14);
    const p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    o.connect(pk).connect(lp).connect(rg).connect(g).connect(p).connect(this.bus);
    for (const x of [o, vo, am]) { x.start(t); x.stop(t + dur * 1.2 + 0.05); }
    o.onended = () => p.disconnect();
  }

  // the creature's calls; `bare` (0 … 1) makes it a little higher and thinner
  call(kind, bare = 0, k = 1) {
    if (!this.live || !this.voice) return;
    const t = this.ctx.currentTime + 0.01, f = 330 * (1 + 0.25 * bare);
    const pan = rnd(-0.08, 0.08);
    this.lastCall = this.t;
    if (kind === 'coo') {
      // "brrlouuu brrrlloouu", sometimes a third
      const n = Math.random() < 0.3 ? 3 : 2;
      let u = 0;
      for (let i = 0; i < n; i++) {
        const d = rnd(0.55, 0.75) * (i === n - 1 ? 1.15 : 1);
        this.coo(t + u, f * (1 - 0.04 * i) * rnd(0.97, 1.03), d, { rollT: rnd(0.14, 0.24), gain: 0.09 * k, pan });
        u += d + rnd(0.18, 0.3);
      }
    } else if (kind === 'eep') {
      // startled: a short rolled "brrt?" rising
      this.coo(t, f * 1.05, 0.28, { pts: [[0, 0.9], [0.7, 1.3], [1, 1.25]], roll: 1, rollT: 0.2, rollF: 32, gain: 0.1 * k, pan });
    } else if (kind === 'oof') {
      // a grunt
      this.coo(t, f * 0.85, 0.2, { pts: [[0, 1], [1, 0.75]], roll: 1, rollT: 0.12, rollF: 22, gain: 0.1 * k, pan });
    } else if (kind === 'whimper') {
      // bare: one doleful slow coo, sinking
      this.coo(t, f * 0.92, rnd(0.8, 1.1), { pts: [[0, 0.95], [0.25, 1.05], [1, 0.72]], roll: 0.6, rollT: 0.12, gain: 0.07 * k, vib: 0.025, pan });
    } else if (kind === 'yay') {
      // back in its coat: a quick happy double coo, brighter
      this.coo(t, f * 1.1, 0.32, { pts: [[0, 0.9], [0.4, 1.2], [1, 1]], rollT: 0.1, gain: 0.09 * k, pan });
      this.coo(t + 0.4, f * 1.15, 0.5, { pts: [[0, 0.9], [0.3, 1.2], [1, 0.9]], rollT: 0.12, gain: 0.1 * k, pan });
    } else if (kind === 'huh' || kind === 'trill') {
      // let go, or settled after a rouse: one soft short coo
      this.coo(t, f, rnd(0.4, 0.55), { rollT: 0.12, roll: 0.7, gain: 0.06 * k, pan });
    }
  }

  // a foot on the floor: a soft pad and the claws' ticks
  step(k = 1, pan = 0) {
    if (!this.live) return;
    const t = this.ctx.currentTime + rnd(0, 0.01);
    this.grain(t, { f: 260, f1: 120, q: 1, dur: 0.06, gain: 0.12 * k, pan, type: 'lowpass', buf: this.pink });
    for (let i = 0; i < 2; i++) this.grain(t + 0.004 + i * rnd(0.006, 0.014), { f: rnd(3000, 4800), q: 7, dur: 0.012, att: 0.0008, gain: 0.05 * k, pan: pan + rnd(-0.1, 0.1) });
  }

  // landing: a thump, the coat's "fwump"
  land(k, cov, pan) {
    if (!this.live) return;
    const t = this.ctx.currentTime;
    this.tone(t, [[0, 110], [0.16, 48]], { type: 'sine', index: 0, gain: 0.28 * k, att: 0.004, rel: 0.12, form: 200, pan });
    this.grain(t, { f: 700, f1: 200, q: 0.8, dur: 0.12, gain: 0.25 * k, pan, type: 'lowpass', buf: this.pink });
    if (cov > 0.05) this.grain(t + 0.01, { f: 2800, f1: 1600, q: 0.6, dur: 0.25 + 0.15 * cov, att: 0.02, gain: 0.06 * k * cov, pan, to: this.fBus });
  }

  // POOF
  poof(molt = false) {
    if (!this.live) return;
    const t = this.ctx.currentTime, big = molt ? 1.4 : 1;
    // the burst of air
    this.grain(t, { f: 3200, f1: 260, q: 0.5, dur: 0.5 * big, att: 0.006, gain: 0.5, type: 'lowpass', buf: this.pink, wet: 0.6 });
    this.grain(t, { f: 900, f1: 300, q: 0.9, dur: 0.22, att: 0.003, gain: 0.3 });
    this.tone(t, [[0, 210], [0.09, 70]], { type: 'sine', index: 0, gain: 0.3, att: 0.003, rel: 0.07, form: 200 });
    // the down sparkling out
    const n = molt ? 30 : 20;
    for (let i = 0; i < n; i++) {
      const dt = 0.02 + Math.pow(Math.random(), 1.6) * 0.5 * big;
      this.grain(t + dt, { f: rnd(4000, 9000), f1: rnd(2500, 6000), q: rnd(1, 3), dur: rnd(0.02, 0.07), gain: rnd(0.01, 0.03) * (1 - dt), pan: rnd(-0.7, 0.7), wet: 0.3, to: this.fBus });
    }
    setTimeout(() => this.call('yay', 0), (0.3 + 0.2 * big) * 1000);
  }

  // ---- every frame
  update(dt, creature, coat, camera) {
    if (!this.live) return;
    const ctx = this.ctx, now = ctx.currentTime;
    this.t += dt;
    const cr = creature, cov = cr.coverage, bare = 1 - cov;

    // where it is: panned, quieter far off
    const p = cr.pos.clone().project(camera);
    this.pan += (clamp(p.x * 0.8, -0.9, 0.9) - this.pan) * Math.min(1, dt * 10);
    this.busPan.pan.setTargetAtTime(this.pan, now, 0.03);
    const dist = cr.pos.distanceTo(camera.position);
    this.near = clamp(5.5 / dist, 0.35, 1.6);
    this.bus.gain.setTargetAtTime(this.near, now, 0.05);

    const speed = cr.vel.length();
    const shake = cr.shake;
    const held = !!cr.grab;
    const prev = this.prev || { held, touching: cr.touching, vy: cr.vel.y, rouseT: -1 };

    // ---- the body through the air
    const fluff = 0.6 + 0.4 * Math.pow(cov, 0.7);
    const sw = smooth(0.4, 9, speed);
    this.whooshG.gain.setTargetAtTime(sw * sw * 0.13 * fluff, now, 0.03);
    this.whoosh.frequency.setTargetAtTime(250 + 160 * speed * (1.4 - 0.5 * cov), now, 0.03);

    // ---- the coat rustling: shaking, rousing, landing
    let rouse = 0;
    if (cr.rouseT >= 0) {
      const t = cr.rouseT;
      // the "brrrr": its rattle, at the wobble's beat
      rouse = Math.sin(Math.min(t / 1.1, 1) * Math.PI) * (0.4 + 0.6 * Math.abs(Math.sin(t * 70)));
    }
    const rub = smooth(15, 260, shake);
    const rust = Math.pow(cov, 0.8) * Math.max(rub, rouse * 0.8, held ? 0.06 : 0, coat.touch ? coat.touch.rub * 0.35 : 0);
    // crackle: the bed flickers
    this.rustleG.gain.setTargetAtTime(rust * 0.04 * rnd(0.5, 1.3), now, 0.012);
    this.rustle.frequency.setTargetAtTime(rnd(3500, 6500), now, 0.02);
    // and the grains, the feathers' own scrapes and ticks
    let n = rust * 200 * dt;
    n = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
    for (let i = 0; i < Math.min(n, 12); i++) {
      const down = Math.random() < 0.35;
      const f = down ? rnd(5000, 9500) : rnd(1800, 6000);
      this.grain(now + Math.random() * dt, { f, f1: f * rnd(0.6, 0.9), q: rnd(0.8, 3), dur: down ? rnd(0.008, 0.025) : rnd(0.015, 0.06), gain: rnd(0.008, 0.03) * (0.4 + rust), pan: rnd(-0.35, 0.35), to: this.fBus });
    }

    // ---- feathers torn off
    const count = coat.attachedCount();
    if (coat !== this.lastCoat) { this.lastCoat = coat; this.lastCount = count; }
    const lost = Math.max(0, this.lastCount - count);
    this.lastCount = count;
    for (let i = 0; i < Math.min(lost, 2); i++) {
      const t = now + Math.random() * dt * 1.5, pn = rnd(-0.5, 0.5), k = lost > 2 ? 1.2 : 1;
      // the quill coming out, and the vane's "pft" as it lets go of the air
      this.grain(t, { f: rnd(3500, 6000), q: 6, dur: 0.01, att: 0.0008, gain: 0.022 * k, pan: pn, to: this.fBus });
      this.grain(t + 0.004, { f: rnd(1200, 2400), f1: rnd(3000, 5000), q: 0.9, dur: rnd(0.05, 0.1), att: 0.008, gain: 0.025 * k, pan: pn, wet: 0.2, to: this.fBus });
    }

    // ---- the feathers in the air: a faint hiss, only while some are still flying fast
    // (just torn off, flung); drifting down or lying they are silent
    const s = coat.s;
    let air = 0;
    for (let i = 0; i < coat.max; i++) {
      if (s.mode[i] !== 2 && s.mode[i] !== 5) continue;
      const i3 = i * 3;
      if (s.c[i3 + 1] < 0.05) continue;
      air += smooth(1.5, 5, Math.hypot(s.v[i3], s.v[i3 + 1], s.v[i3 + 2]));
    }
    const da = smooth(0, 25, air);
    this.driftG.gain.setTargetAtTime(FEATHERS * 0.022 * da * Math.min(this.near, 1.2), now, da > 0.01 ? 0.08 : 0.05);
    this.drift.frequency.setTargetAtTime(900 + 1800 * da, now, 0.1);

    // ---- the voice: wailing when shaken or flying
    const flying = !held && !cr.touching && speed > 3 ? smooth(3, 10, speed) : 0;
    const panic = Math.max(smooth(70, 320, shake) * (held ? 1 : 0.6), flying * 0.8);
    const g = this.voiceGate;
    g.t -= dt;
    if (g.t <= 0) {
      // breathing: phrases of wail and gasps between
      g.open = !g.open && panic > 0.05;
      g.t = g.open ? rnd(0.35, 1.1) : rnd(0.08, 0.3);
    }
    const base = 330 * (1 + 0.25 * bare);
    const jolt = clamp(cr.acc.y / 900, -0.3, 0.3);
    const wail = base * (1.05 + 0.25 * panic) * (1 + jolt) * (flying > panic * 0.9 ? 1 + 0.12 * clamp(cr.vel.y / 8, -1, 1) : 1);
    this.vCar.frequency.setTargetAtTime(wail, now, 0.02);
    this.vMod.frequency.setTargetAtTime(wail, now, 0.02);
    this.vModG.gain.setTargetAtTime(wail * 0.15 * panic, now, 0.03);
    this.vVibG.gain.setTargetAtTime(wail * 0.015, now, 0.05);
    this.vForm.frequency.setTargetAtTime(wail * 2, now, 0.05);
    this.vLp.frequency.setTargetAtTime(wail * (2.4 + 0.8 * panic), now, 0.05);
    this.vAm.frequency.setTargetAtTime(22 + 10 * panic, now, 0.05);
    this.vG.gain.setTargetAtTime(g.open && this.voice ? panic * 0.1 : 0, now, g.open ? 0.04 : 0.05);

    // ---- picked up, let go, landing
    if (held && !prev.held) this.call('eep', bare);
    if (!held && prev.held && cr.touching && speed < 2 && Math.random() < 0.6) this.call('huh', bare, 0.8);
    if (cr.touching && !prev.touching) {
      const impact = Math.max(0, -prev.vy);
      if (impact > 0.6) {
        const k = smooth(0.6, 9, impact);
        this.land(k, cov, 0);
        if (impact > 5 && !held) setTimeout(() => this.call('oof', bare, 0.6 + 0.4 * k), 70);
      }
    }

    // ---- footsteps: a foot set down, a step ended
    for (const leg of cr.legs) {
      const st = this.legState.get(leg) || { planted: leg.planted, step: !!leg.step };
      if (leg.planted && !st.planted && cr.touching) this.step(0.7, leg.side * 0.15);
      if (st.step && !leg.step && leg.planted) this.step(0.45, leg.side * 0.15);
      st.planted = leg.planted; st.step = !!leg.step;
      this.legState.set(leg, st);
    }

    // ---- left alone
    const idle = !held && cr.onGround && panic < 0.02;
    this.nextCall -= dt;
    if (!idle) this.nextCall = Math.max(this.nextCall, 2);
    if (this.nextCall <= 0) {
      if (bare > 0.6) { this.call('whimper', bare); this.nextCall = rnd(5, 10); }
      else if (cr.rouseT < 0) { this.call('coo', bare); this.nextCall = rnd(7, 16); }
      else this.nextCall = 1;
    }
    // a rouse ends with a little contented peep, sometimes
    if (prev.rouseT >= 0 && cr.rouseT < 0 && Math.random() < 0.5) setTimeout(() => this.call('trill', bare, 0.6), 200);

    this.prev = { held, touching: cr.touching, vy: cr.vel.y, rouseT: cr.rouseT };
  }
}
