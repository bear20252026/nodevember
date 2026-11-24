// The cloth on the GPU (wrap.wgsl): buffers, pipelines, one submit per frame of all its substeps. It shares
// three's device and writes straight into the two textures the cloth mesh reads. The sheet lies in the x-y
// plane of its own frame, centred on the origin; the ball is given, a centre per frame, on a rod from a pivot.
// Runs repeat exactly: start two sims from the same state (restore) and drive them alike, and they stay alike.
import source from "./wrap.wgsl?raw";

export const cloth = {
  n: 256, // particles a side (a multiple of 4)
  size: 2.0, // the sheet's side, m
  density: 0.25, // kg/m²
  hStep: 1 / 2000, // the longest substep, s: the speed of the picture changes the count, not the physics
  sweeps: 2, // over the grid's springs, each substep
  gravity: 2, // m/s²: the world is slow and light, the cloth barely sags
  damping: 0.3, // 1/s, everywhere
  air: 1.2, // drag coefficient against the face (as the square of the speed)
  airAlong: 0.4, // 1/s along the face
  stretch: 0, // compliance in units of the particle's inverse mass: 0 is inextensible
  shear: 0.1,
  bend: 160,
  tension: 6, // N/m: the frame holds the sheet taut, a mirror (must stay under the grip)
  give: 0.004, // m/N: how much the frame's hold gives
  grip: 80, // N/m along the edge before it lets go
  gripSpread: 0.5, // grips vary by this fraction, so the edge lets go here and there, not all at once
  slot: 0.04, // half the width of the slot in the frame's top bar, where the rod comes through: no hold there
  gap: 0.004, // how far the cloth keeps off the ball
  friction: 0.9,
  self: true, // keep the cloth off itself
  thick: 0.008, // how far apart layers keep: about the particles' spacing, or a layer slips through the gaps
  selfFriction: 0.3,
  listEvery: 4, // substeps between rebuilding the neighbour lists
  maxSpeed: 25,
};
export type ClothParams = typeof cloth;
/** pivot and rod radius of the ball's rod; gripScale 0 makes the frame let go of everything; ballGrew: by how
 *  much the ball's radius grew over the frame (ballR is its radius at the end) */
export type Drive = { pivot?: number[]; rod?: number; gripScale?: number; sweeps?: number; listEvery?: number; ballGrew?: number; timer?: { querySet: GPUQuerySet; at: number } };

const STORAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
const PASS_STRIDE = 256;
const MAX_SUBS = 256;
const K = 16;
const KERNELS = ["predict", "edges", "hashClear", "hashCount", "scanBlocks", "scanSums", "scatter", "neighbours", "selfCollide", "collide", "publish"] as const;

export class WrapSim {
  readonly n: number;
  readonly d: number;
  readonly p: ClothParams;
  private device: GPUDevice;
  private pipelines = {} as Record<(typeof KERNELS)[number], GPUComputePipeline>;
  private group: GPUBindGroup;
  private buffers: Record<"pos" | "old" | "vel" | "anchor" | "tmp" | "counts" | "slots" | "nbr" | "params" | "passes", GPUBuffer>;
  private params = new ArrayBuffer(160);
  private anchors!: Float32Array<ArrayBuffer>;
  private f32 = new Float32Array(this.params);
  private u32 = new Uint32Array(this.params);
  private hashSize: number;
  time = 0;
  steps = 0;
  subs = 0;

  constructor(device: GPUDevice, p: ClothParams, posTexture: GPUTexture, norTexture: GPUTexture) {
    if (p.n % 4) throw new Error("n must be a multiple of 4");
    this.device = device;
    this.p = p;
    this.n = p.n;
    this.d = p.size / (p.n - 1);
    const count = this.n * this.n;
    this.hashSize = 1 << Math.max(16, Math.ceil(Math.log2(count * 4))); // at least 256 blocks of 256
    const make = (size: number, usage = STORAGE) => device.createBuffer({ size, usage });
    this.buffers = {
      pos: make(count * 16),
      old: make(count * 16),
      vel: make(count * 16),
      anchor: make(count * 16),
      tmp: make(count * 16),
      counts: make(this.hashSize * 4),
      slots: make((this.hashSize + this.hashSize / 256 + count) * 4), // bucket starts, block starts, sorted particles
      nbr: make(count * K * 4),
      params: make(this.params.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
      passes: make(PASS_STRIDE * (12 + MAX_SUBS), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
    };
    const module = device.createShaderModule({ code: source });
    module.getCompilationInfo().then((info) => info.messages.forEach((m) => console.warn(`wrap.wgsl ${m.lineNum}:${m.linePos} ${m.message}`)));
    const C = { visibility: GPUShaderStage.COMPUTE };
    const buffer = (binding: number, type: GPUBufferBindingType, hasDynamicOffset = false) => ({ binding, ...C, buffer: { type, hasDynamicOffset } });
    const texture = (binding: number) => ({ binding, ...C, storageTexture: { access: "write-only", format: "rgba32float", viewDimension: "2d" } as GPUStorageTextureBindingLayout });
    const layout = device.createBindGroupLayout({
      entries: [0, 1, 2, 3, 4, 5, 6, 7].map((k) => buffer(k, "storage")).concat([buffer(8, "uniform"), buffer(9, "uniform", true)]).concat([texture(10), texture(11)] as never[]),
    });
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    for (const entryPoint of KERNELS) this.pipelines[entryPoint] = device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint } });
    const b = this.buffers;
    this.group = device.createBindGroup({
      layout,
      entries: [
        ...(["pos", "old", "vel", "anchor", "tmp", "counts", "slots", "nbr", "params"] as const).map((k, binding) => ({ binding, resource: { buffer: b[k] } })),
        { binding: 9, resource: { buffer: b.passes, size: 16 } },
        { binding: 10, resource: posTexture.createView() },
        { binding: 11, resource: norTexture.createView() },
      ],
    });
    // the passes: 12 spring slots, then one per substep (its end as a fraction of the frame)
    const passes = new ArrayBuffer(PASS_STRIDE * (12 + MAX_SUBS));
    const pu = new Uint32Array(passes);
    for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) pu.set([k, c], ((2 * k + c) * PASS_STRIDE) / 4);
    device.queue.writeBuffer(this.buffers.passes, 0, passes);
    this.reset();
  }

  get mass() {
    return (this.p.density * this.p.size * this.p.size) / (this.n * this.n);
  }

  /** The sheet flat and still in its frame */
  reset() {
    const { n, d, device, p } = this;
    const L = p.size;
    const w = 1 / this.mass;
    const x = new Float32Array(n * n * 4);
    const a = new Float32Array(n * n * 4);
    // the grip a particle has: the pull it may take (line force times its share of the edge) over the give
    const hold = p.grip * d * p.give;
    let seed = 12345;
    const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let y = 0; y < n; y++)
      for (let k = 0; k < n; k++) {
        const i = (y * n + k) * 4;
        const px = k * d - L / 2, py = y * d - L / 2;
        x.set([px, py, 0, w], i);
        const edge = (k === 0 || y === 0 || k === n - 1 || y === n - 1) && !(y === n - 1 && Math.abs(px) < p.slot);
        // held out beyond its place by the stretch the starting tension puts on the frame's spring
        const ox = k === 0 ? -1 : k === n - 1 ? 1 : 0, oy = y === 0 ? -1 : y === n - 1 ? 1 : 0;
        const out = p.tension * d * p.give;
        const g = hold * (1 + p.gripSpread * (2 * rand() - 1));
        a.set([px + ox * out, py + oy * out, 0, edge ? Math.max(g, 1.5 * out * Math.hypot(ox, oy)) : -1], i);
      }
    device.queue.writeBuffer(this.buffers.pos, 0, x);
    device.queue.writeBuffer(this.buffers.old, 0, x);
    device.queue.writeBuffer(this.buffers.tmp, 0, x);
    device.queue.writeBuffer(this.buffers.anchor, 0, a);
    this.anchors = a;
    device.queue.writeBuffer(this.buffers.vel, 0, new Float32Array(n * n * 4));
    device.queue.writeBuffer(this.buffers.nbr, 0, new Uint32Array(n * n * K).fill(0xffffffff));
    this.time = 0;
    this.steps = 0;
  }

  /** This sim's state becomes `from`'s, still, freshly held in the frame */
  restore(from: WrapSim) {
    const { device, n } = this;
    const size = n * n * 16;
    const encoder = device.createCommandEncoder();
    for (const k of ["pos", "old", "tmp"] as const) encoder.copyBufferToBuffer(from.buffers.old, 0, this.buffers[k], 0, size);
    device.queue.submit([encoder.finish()]);
    device.queue.writeBuffer(this.buffers.anchor, 0, from.anchors);
    device.queue.writeBuffer(this.buffers.vel, 0, new Float32Array(n * n * 4));
    device.queue.writeBuffer(this.buffers.nbr, 0, new Uint32Array(n * n * K).fill(0xffffffff));
    this.time = 0;
    this.steps = 0;
  }

  private writeParams(dt: number, S: number, b0: number[], b1: number[], ballR: number, o: Drive) {
    const { f32, u32, n, p } = this;
    const h = dt / S;
    const m = this.mass;
    u32.set([n, S, p.self ? 1 : 0, this.hashSize - 1], 0);
    f32.set([h, this.d, p.gravity, Math.exp(-p.damping * h)], 4);
    // drag per area 1/2 rho_air C v², over the cloth's mass per area
    f32.set([p.stretch, p.shear, p.bend, (0.5 * 1.2 * p.air) / p.density], 8);
    f32.set([p.airAlong, p.friction, p.thick, p.selfFriction], 12);
    // the frame's spring: compliance over the particle's inverse mass and the substep squared
    f32.set([(p.give * m) / (h * h), p.maxSpeed, 2 * p.thick, ballR], 16);
    f32.set([p.gap, o.gripScale ?? 1, o.ballGrew ?? 0, 0], 20);
    f32.set([b0[0], b0[1], b0[2], 0, b1[0], b1[1], b1[2], 0], 24);
    const pv = o.pivot ?? [0, 0, 0];
    f32.set([pv[0], pv[1], pv[2], o.rod ?? 0], 32);
    this.device.queue.writeBuffer(this.buffers.params, 0, this.params);
    const passes = new ArrayBuffer(PASS_STRIDE * S);
    const pf = new Float32Array(passes);
    for (let s = 0; s < S; s++) pf[(s * PASS_STRIDE) / 4 + 2] = (s + 1) / S;
    this.device.queue.writeBuffer(this.buffers.passes, 12 * PASS_STRIDE, passes);
  }

  // the frame's dispatches, in order
  private schedule(S: number, run: (kernel: (typeof KERNELS)[number], groups: number, slot?: number) => void, publish: boolean, o: Drive = {}) {
    const { n, p } = this;
    const sweeps = o.sweeps ?? p.sweeps, every = o.listEvery ?? p.listEvery;
    const nodes = Math.ceil((n * n) / 256);
    const edges = Math.ceil(((n / 2) * n) / 256);
    for (let s = 0; s < S; s++) {
      run("predict", nodes);
      for (let k = 0; k < sweeps; k++) for (let slot = 0; slot < 12; slot++) run("edges", edges, slot);
      if (p.self) {
        if ((this.steps * S + s) % every === 0) {
          run("hashClear", this.hashSize / 256);
          run("hashCount", nodes);
          run("scanBlocks", this.hashSize / 256);
          run("scanSums", 1);
          run("scatter", nodes);
          run("neighbours", nodes);
        }
      }
      run("selfCollide", nodes);
      run("collide", nodes, 12 + s);
    }
    if (publish) run("publish", nodes);
  }

  /** One frame of dt simulated seconds: the ball moves from b0 to b1 through every substep */
  advance(dt: number, b0: number[], b1: number[], ballR: number, publish = true, o: Drive = {}) {
    const { device, p } = this;
    const S = Math.min(MAX_SUBS, Math.max(1, Math.ceil(dt / p.hStep)));
    this.subs = S;
    this.writeParams(dt, S, b0, b1, ballR, o);
    const encoder = device.createCommandEncoder();
    // (a page timing its sims passes a query set and where in it this sim's begin and end go)
    const pass = encoder.beginComputePass(o.timer ? { timestampWrites: { querySet: o.timer.querySet, beginningOfPassWriteIndex: o.timer.at, endOfPassWriteIndex: o.timer.at + 1 } } : undefined);
    this.schedule(
      S,
      (kernel, groups, slot = 0) => {
        pass.setPipeline(this.pipelines[kernel]);
        pass.setBindGroup(0, this.group, [slot * PASS_STRIDE]);
        pass.dispatchWorkgroups(groups);
      },
      publish,
      o,
    );
    pass.end();
    device.queue.submit([encoder.finish()]);
    this.steps++;
    this.time += dt;
  }

  /** The same frame, each dispatch in its own pass with GPU timestamps: milliseconds per kernel (needs the
   *  device's timestamp-query feature). It does advance the sim. */
  async profile(dt: number, b0: number[], b1: number[], ballR: number, o: Drive = {}) {
    const { device, p } = this;
    const S = Math.min(MAX_SUBS, Math.max(1, Math.ceil(dt / p.hStep)));
    this.writeParams(dt, S, b0, b1, ballR, o);
    const labels: string[] = [];
    this.schedule(S, (k) => labels.push(k), true, o);
    const count = labels.length * 2;
    const qs = device.createQuerySet({ type: "timestamp", count });
    const resolve = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
    const read = device.createBuffer({ size: count * 8, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    let q = 0;
    this.schedule(
      S,
      (kernel, groups, slot = 0) => {
        const pass = encoder.beginComputePass({ timestampWrites: { querySet: qs, beginningOfPassWriteIndex: q, endOfPassWriteIndex: q + 1 } });
        q += 2;
        pass.setPipeline(this.pipelines[kernel]);
        pass.setBindGroup(0, this.group, [slot * PASS_STRIDE]);
        pass.dispatchWorkgroups(groups);
        pass.end();
      },
      true,
      o,
    );
    encoder.resolveQuerySet(qs, 0, count, resolve, 0);
    encoder.copyBufferToBuffer(resolve, 0, read, 0, count * 8);
    device.queue.submit([encoder.finish()]);
    await read.mapAsync(GPUMapMode.READ);
    const t = new BigUint64Array(read.getMappedRange().slice(0));
    read.destroy();
    resolve.destroy();
    qs.destroy();
    const ms: Record<string, number> = {};
    labels.forEach((l, i) => (ms[l] = (ms[l] ?? 0) + Number(t[2 * i + 1] - t[2 * i]) / 1e6));
    this.steps++;
    this.time += dt;
    return { subs: S, ms };
  }

  /** Positions (w: 1 held, 0 let go... from the anchors) back to the CPU, for tests */
  async read() {
    const { device, n } = this;
    const size = n * n * 16;
    const a = device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const b = device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.buffers.old, 0, a, 0, size);
    encoder.copyBufferToBuffer(this.buffers.anchor, 0, b, 0, size);
    device.queue.submit([encoder.finish()]);
    await Promise.all([a.mapAsync(GPUMapMode.READ), b.mapAsync(GPUMapMode.READ)]);
    const pos = new Float32Array(a.getMappedRange().slice(0));
    const anchor = new Float32Array(b.getMappedRange().slice(0));
    a.destroy();
    b.destroy();
    return { pos, anchor };
  }
}
