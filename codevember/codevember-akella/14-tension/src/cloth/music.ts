// The Danube's tune, played as the sheet plays it: each note sounds in the frame the sim passes its
// beat, so the sound keeps to the sheet even when a slow machine runs the sim slower than real time.
// A small synth: two detuned saws and a sub through a closing low pass, vibrato on the long notes, and a
// room (noise impulse response) behind it. Browsers only let sound start after a click or a key.
import { NOTES, type Note } from "./danube.ts";

export class Music {
  volume = 0.6;
  muted = false;
  private ctx?: AudioContext;
  private master?: GainNode;
  private bus?: GainNode;
  private last = 0;

  constructor(
    private beat: number,
    private period: number,
  ) {}

  get started() {
    return this.ctx?.state === "running";
  }

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    this.ctx = new AudioContext();
    ({ master: this.master, bus: this.bus } = this.graph(this.ctx));
    this.setVolume();
    void this.ctx.resume();
  }

  /** The output: master (volume) through a gentle compressor, and a bus into it, dry and through a room */
  private graph(ctx: BaseAudioContext) {
    const master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    // a room: stereo noise dying away over ~2.5 s
    const len = Math.round(ctx.sampleRate * 3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp((-i / ctx.sampleRate) * 2.6);
    }
    const room = ctx.createConvolver();
    room.buffer = ir;
    const wet = ctx.createGain();
    wet.gain.value = 0.32;
    const bus = ctx.createGain();
    bus.connect(master);
    bus.connect(room).connect(wet).connect(master);
    return { master, bus };
  }

  /**
   * The tune offline, as a 16-bit stereo WAV: `periods` loops from time 0 (the sim's), plus the last
   * chord's tail; to lay under a recorded take
   */
  async renderWav(periods = 1, rate = 48000) {
    const ctx = new OfflineAudioContext(2, Math.ceil(rate * (periods * this.period + 2.5)), rate);
    const { master, bus } = this.graph(ctx);
    master.gain.value = this.volume;
    for (let k = 0; k < periods; k++) for (const n of NOTES) this.play(n, ctx, bus, n.at * this.beat + k * this.period);
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0);
    const R = buf.getChannelData(1);
    const out = new DataView(new ArrayBuffer(44 + L.length * 4));
    const str = (o: number, t: string) => [...t].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
    str(0, "RIFF");
    out.setUint32(4, 36 + L.length * 4, true);
    str(8, "WAVEfmt ");
    out.setUint32(16, 16, true);
    out.setUint16(20, 1, true);
    out.setUint16(22, 2, true);
    out.setUint32(24, rate, true);
    out.setUint32(28, rate * 4, true);
    out.setUint16(32, 4, true);
    out.setUint16(34, 16, true);
    str(36, "data");
    out.setUint32(40, L.length * 4, true);
    for (let i = 0; i < L.length; i++) {
      out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
      out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
    }
    return new Blob([out.buffer], { type: "audio/wav" });
  }

  dispose() {
    void this.ctx?.close();
  }

  setVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

  /** Each frame with the sim's time (s): sounds every note whose beat it has just passed */
  update(t: number) {
    const prev = this.last;
    this.last = t;
    // nothing to play into yet, or the sim jumped (restart, a catch up): just move on
    if (!this.started || t <= prev || t - prev > 0.25) return;
    for (const n of NOTES) {
      const at = n.at * this.beat;
      const k = Math.floor((t - at) / this.period);
      const when = at + k * this.period;
      if (when > prev && when <= t) this.play(n, this.ctx!, this.bus!, this.ctx!.currentTime + 0.005);
    }
  }

  private play(n: Note, ctx: BaseAudioContext, bus: AudioNode, now: number) {
    const chord = n.midi.length > 1;
    // short notes a little detached, long ones held to the next
    const len = n.dur * this.beat * (n.dur >= 2 ? 0.95 : 0.8);
    const voice = (m: number, vel: number) => this.voice(ctx, bus, m, now, len, vel, chord);
    for (const m of n.midi) voice(m, chord ? 0.2 : 0.34);
    if (chord) {
      // the bass under the closing chord
      voice(n.midi[0] - 12, 0.22);
      voice(n.midi[0] - 24, 0.16);
    }
  }

  private voice(ctx: BaseAudioContext, bus: AudioNode, midi: number, t0: number, len: number, vel: number, chord: boolean) {
    const f = 440 * 2 ** ((midi - 69) / 12);
    const attack = chord ? 0.09 : 0.012;
    const release = chord ? 1.6 : 0.18;
    const end = t0 + len + release;

    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, t0);
    amp.gain.linearRampToValueAtTime(vel, t0 + attack);
    amp.gain.setTargetAtTime(vel * 0.62, t0 + attack, 0.18);
    amp.gain.setTargetAtTime(0, t0 + len, release / 4);

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(Math.min(f * 7, 12000), t0);
    lp.frequency.setTargetAtTime(Math.min(f * (chord ? 2.5 : 3.2), 9000), t0 + attack, 0.25);
    lp.connect(amp).connect(bus);

    // vibrato, coming in once a long note has settled
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.4;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t0);
    depth.gain.setTargetAtTime(len > 0.6 ? 7 : 0, t0 + 0.3, 0.25);
    lfo.connect(depth);

    const oscs: OscillatorNode[] = [];
    const add = (type: OscillatorType, freq: number, cents: number, level: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = cents;
      depth.connect(o.detune);
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(lp);
      oscs.push(o);
    };
    add("sawtooth", f, -6, 0.5);
    add("sawtooth", f, 6, 0.5);
    add("triangle", f / 2, 0, 0.22);
    for (const o of [...oscs, lfo]) {
      o.start(t0);
      o.stop(end + 0.1);
    }
  }
}

/**
 * The real recording (one loop of it, cut to exactly `period`), played looped and kept to the sim's time:
 * small drifts are taken up by nudging its speed (at most 8%, which hardly shows), big ones (a slow
 * machine, a pause, a restart) by jumping to where the sim is. Stops while the sim stands still.
 */
export class Recording {
  volume = 0.8;
  muted = false;
  private ctx?: AudioContext;
  private gain?: GainNode;
  private buf?: AudioBuffer;
  private src?: AudioBufferSourceNode;
  private base = 0; // the context's time at which it was at pos0
  private pos0 = 0;
  private rate = 1;
  private lastT = NaN;
  private still = 0;

  constructor(
    private url: string,
    private period: number,
  ) {}

  get started() {
    return this.ctx?.state === "running" && !!this.buf;
  }

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.gain = ctx.createGain();
    this.gain.connect(ctx.destination);
    this.setVolume();
    void ctx.resume();
    void fetch(this.url)
      .then((r) => r.arrayBuffer())
      .then((a) => ctx.decodeAudioData(a))
      .then((b) => (this.buf = b));
  }

  setVolume() {
    if (this.gain) this.gain.gain.value = this.muted ? 0 : this.volume;
  }

  dispose() {
    void this.ctx?.close();
  }

  private stop() {
    this.src?.stop();
    this.src?.disconnect();
    this.src = undefined;
  }

  private play(at: number) {
    this.stop();
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.buf!;
    src.loop = true;
    src.loopStart = 0;
    src.loopEnd = this.buf!.duration;
    src.connect(this.gain!);
    this.rate = 1;
    this.base = ctx.currentTime + 0.01;
    this.pos0 = at;
    src.start(this.base, at);
    this.src = src;
  }

  /** Each frame with the sim's time (s); `hold` (recording a take, which runs the sim faster) stops it */
  update(t: number, hold = false) {
    const still = t === this.lastT;
    this.lastT = t;
    this.still = still ? this.still + 1 : 0;
    if (!this.started || hold || this.still > 6) {
      this.stop();
      return;
    }
    const P = this.period;
    const want = ((t % P) + P) % P;
    if (!this.src) return this.play(want);
    const now = this.ctx!.currentTime;
    const have = (((this.pos0 + Math.max(0, now - this.base) * this.rate) % P) + P) % P;
    let err = want - have;
    if (err > P / 2) err -= P;
    if (err < -P / 2) err += P;
    if (Math.abs(err) > 0.25) return this.play(want);
    const rate = Math.min(1.08, Math.max(0.92, 1 + err * 0.8));
    if (Math.abs(rate - this.rate) > 0.003) {
      this.pos0 = have;
      this.base = now;
      this.rate = rate;
      this.src.playbackRate.setValueAtTime(rate, now);
    }
  }
}
