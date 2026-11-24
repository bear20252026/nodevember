// The cloth on the GPU: buffers, pipelines, and one submit per frame of all its substeps. It shares
// three's device and writes straight into the two textures the cloth mesh reads.
import source from "./cloth.wgsl?raw";

export type PusherState = { kind: number; c: [number, number, number]; q: [number, number, number, number]; size: [number, number, number, number] };
export type PinSpec = { gx: number; gy: number; anchor: [number, number, number]; rest: number };

/** A signed distance field (half floats, x fastest) for the face pusher: see tools/bakeface.mjs */
export type Face = { data: Uint16Array<ArrayBuffer>; dims: [number, number, number]; origin: [number, number, number]; cell: number };

export const physics = {
  size: 2.0, // sheet side, m
  density: 1.0, // kg/m²: 0.1 a light lawn, 0.2 a bed sheet, 0.5 canvas; heavier falls through the air faster
  substeps: 24,
  gravity: 9.81,
  damping: 0.4, // 1/s, everywhere
  air: 3.0, // 1/s against the face only, for a 0.12 kg/m² sheet: drag is per area, so it goes as 1/density
  stretch: 0, // compliance in units of the particle's inverse mass: 0 is inextensible
  shear: 0.5,
  bend: 30,
  thick: 0.006, // how far the cloth keeps off a pusher
  friction: 0.25,
  slack: 1.0, // > 1 lets the sheet stretch that much before the pins feel it
  pinMass: 0.25, // kg
  cableK: 80, // N/m
  pinDamping: 25, // 1/s, near critical: pins that ring yank the whole sheet
  maxSpeed: 12,
};

const STORAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
const PASS_STRIDE = 256;
const MAX_PUSHERS = 12;
const MAX_PINS = 16;
const KERNELS = ["step", "edges", "pinStep", "collide", "publish", "keep"] as const;

export class ClothSim {
  readonly n: number;
  readonly d: number;
  readonly pins: PinSpec[];
  private device: GPUDevice;
  private pipelines = {} as Record<(typeof KERNELS)[number], GPUComputePipeline>;
  private group: GPUBindGroup;
  private buffers: Record<"pos" | "old" | "vel" | "params" | "passes" | "pushers" | "pins" | "bodies" | "react" | "target", GPUBuffer>;
  private params = new ArrayBuffer(128);
  private face: Face;
  private f32 = new Float32Array(this.params);
  private u32 = new Uint32Array(this.params);
  private pusherData = new Float32Array(MAX_PUSHERS * 20);
  private last: PusherState[] = [];
  feed = 0;
  steps = 0;

  constructor(device: GPUDevice, n: number, pins: PinSpec[], posTexture: GPUTexture, norTexture: GPUTexture, napTexture: GPUTexture, face: Face) {
    this.face = face;
    if (n % 4) throw new Error("n must be a multiple of 4");
    this.device = device;
    this.n = n;
    this.pins = pins;
    this.d = physics.size / (n - 1);
    const make = (size: number, usage = STORAGE) => device.createBuffer({ size, usage });
    const count = n * n;
    this.buffers = {
      pos: make(count * 16),
      old: make(count * 16),
      vel: make(count * 16),
      target: make(count * 16),
      params: make(this.params.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
      passes: make(PASS_STRIDE * (12 + 128), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST),
      pushers: make(this.pusherData.byteLength),
      pins: make(MAX_PINS * 32),
      bodies: make(MAX_PINS * 32),
      react: make(MAX_PINS * 16),
    };
    const module = device.createShaderModule({ code: source });
    module.getCompilationInfo().then((info) => info.messages.forEach((m) => console.warn(`cloth.wgsl ${m.lineNum}:${m.linePos} ${m.message}`)));
    const C = { visibility: GPUShaderStage.COMPUTE };
    const buffer = (binding: number, type: GPUBufferBindingType, hasDynamicOffset = false) => ({ binding, ...C, buffer: { type, hasDynamicOffset } });
    const texture = (binding: number) => ({ binding, ...C, storageTexture: { access: "write-only", format: "rgba32float", viewDimension: "2d" } as GPUStorageTextureBindingLayout });
    const layout = device.createBindGroupLayout({
      entries: [
        buffer(0, "storage"),
        buffer(1, "storage"),
        buffer(2, "storage"),
        buffer(3, "uniform"),
        buffer(4, "uniform", true),
        buffer(5, "read-only-storage"),
        buffer(6, "read-only-storage"),
        buffer(7, "storage"),
        buffer(8, "storage"),
        texture(9),
        texture(10),
        buffer(11, "storage"),
        { binding: 12, ...C, texture: { sampleType: "float", viewDimension: "3d" } as GPUTextureBindingLayout },
        { binding: 13, ...C, sampler: { type: "filtering" } as GPUSamplerBindingLayout },
        texture(14),
      ],
    });
    const [fx, fy, fz] = face.dims;
    const faceTexture = device.createTexture({ size: [fx, fy, fz], dimension: "3d", format: "r16float", usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: faceTexture }, face.data, { bytesPerRow: fx * 2, rowsPerImage: fy }, [fx, fy, fz]);
    const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
    for (const entryPoint of KERNELS) this.pipelines[entryPoint] = device.createComputePipeline({ layout: pipelineLayout, compute: { module, entryPoint } });
    const b = this.buffers;
    this.group = device.createBindGroup({
      layout,
      entries: [
        { binding: 0, resource: { buffer: b.pos } },
        { binding: 1, resource: { buffer: b.old } },
        { binding: 2, resource: { buffer: b.vel } },
        { binding: 3, resource: { buffer: b.params } },
        { binding: 4, resource: { buffer: b.passes, size: 16 } },
        { binding: 5, resource: { buffer: b.pushers } },
        { binding: 6, resource: { buffer: b.pins } },
        { binding: 7, resource: { buffer: b.bodies } },
        { binding: 8, resource: { buffer: b.react } },
        { binding: 9, resource: posTexture.createView() },
        { binding: 10, resource: norTexture.createView() },
        { binding: 11, resource: { buffer: b.target } },
        { binding: 12, resource: faceTexture.createView() },
        { binding: 13, resource: device.createSampler({ magFilter: "linear", minFilter: "linear", addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge", addressModeW: "clamp-to-edge" }) },
        { binding: 14, resource: napTexture.createView() },
      ],
    });
    this.reset();
  }

  /** The sheet flat and still, pins where they are on it */
  reset() {
    const { n, d, device } = this;
    const L = physics.size;
    const m = (physics.density * L * L) / (n * n);
    const x = new Float32Array(n * n * 4);
    const pinned = new Set(this.pins.map((p) => p.gy * n + p.gx));
    for (let y = 0; y < n; y++)
      for (let k = 0; k < n; k++) {
        const i = (y * n + k) * 4;
        x[i] = k * d - L / 2;
        x[i + 1] = 0;
        x[i + 2] = y * d - L / 2;
        x[i + 3] = pinned.has(y * n + k) ? 0 : 1 / m;
      }
    device.queue.writeBuffer(this.buffers.pos, 0, x);
    device.queue.writeBuffer(this.buffers.old, 0, x);
    device.queue.writeBuffer(this.buffers.target, 0, x);
    device.queue.writeBuffer(this.buffers.vel, 0, new Float32Array(n * n * 4));
    const pins = new ArrayBuffer(MAX_PINS * 32);
    const pu = new Uint32Array(pins);
    const pf = new Float32Array(pins);
    const bodies = new Float32Array(MAX_PINS * 8);
    this.pins.forEach((p, j) => {
      pu.set([p.gy * n + p.gx, p.gx, p.gy, 0], j * 8);
      pf.set([...p.anchor, p.rest], j * 8 + 4);
      bodies.set([p.gx * d - L / 2, 0, p.gy * d - L / 2, 0], j * 8);
    });
    device.queue.writeBuffer(this.buffers.pins, 0, pins);
    device.queue.writeBuffer(this.buffers.bodies, 0, bodies);
    device.queue.writeBuffer(this.buffers.react, 0, new Int32Array(MAX_PINS * 4));
    this.steps = 0;
    this.last = [];
  }

  private writeParams(dt: number, pushers: number) {
    const { f32, u32, n } = this;
    const S = physics.substeps;
    const h = dt / S;
    const m = (physics.density * physics.size * physics.size) / (n * n);
    u32.set([n, S, pushers, this.pins.length], 0);
    f32.set([h, this.d, physics.gravity, Math.exp(-physics.damping * h)], 4);
    f32.set([physics.stretch, physics.shear, physics.bend, 1 - Math.exp(-physics.air * (0.12 / physics.density) * h)], 8);
    f32.set([physics.thick, physics.friction, physics.slack, m], 12);
    f32.set([physics.pinMass, physics.cableK, Math.exp(-physics.pinDamping * h), physics.maxSpeed], 16);
    f32.set([this.feed, 0, 0, 0], 20);
    f32.set([...this.face.origin, this.face.cell, ...this.face.dims, 0], 24);
    this.device.queue.writeBuffer(this.buffers.params, 0, this.params);
    const passes = new ArrayBuffer(PASS_STRIDE * (12 + S));
    const pu = new Uint32Array(passes);
    const pf = new Float32Array(passes);
    for (let k = 0; k < 6; k++) for (let c = 0; c < 2; c++) pu.set([k, c], ((2 * k + c) * PASS_STRIDE) / 4);
    for (let s = 0; s < S; s++) {
      const o = ((12 + s) * PASS_STRIDE) / 4;
      pf[o + 2] = (s + 1) / S;
      pu[o + 3] = s;
    }
    this.device.queue.writeBuffer(this.buffers.passes, 0, passes);
  }

  /** One frame: the pushers move from where they were to `now`, through every substep */
  advance(dt: number, now: PusherState[], publish = true, keep = false) {
    const { device, n } = this;
    const prev = this.last.length === now.length ? this.last : now;
    const data = this.pusherData;
    data.fill(0);
    now.forEach((s, k) => {
      const p = prev[k];
      // a shape that appears or vanishes this frame jumps: it starts where it ends
      const from = p.kind === s.kind ? p : s;
      // keep the turn on the short way round
      const q0 = from.q;
      const sign = q0[0] * s.q[0] + q0[1] * s.q[1] + q0[2] * s.q[2] + q0[3] * s.q[3] < 0 ? -1 : 1;
      data.set([...from.c, s.kind, ...s.c, 0, ...q0, ...s.q.map((v) => v * sign), ...s.size], k * 20);
    });
    device.queue.writeBuffer(this.buffers.pushers, 0, data);
    this.writeParams(dt, now.length);
    this.last = now.map((s) => ({ ...s, c: [...s.c], q: [...s.q] }) as PusherState);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginComputePass();
    const nodes = Math.ceil((n * n) / 256);
    const edges = Math.ceil(((n / 2) * n) / 256);
    const run = (kernel: (typeof KERNELS)[number], groups: number, slot = 0) => {
      pass.setPipeline(this.pipelines[kernel]);
      pass.setBindGroup(0, this.group, [slot * PASS_STRIDE]);
      pass.dispatchWorkgroups(groups);
    };
    for (let s = 0; s < physics.substeps; s++) {
      run("step", nodes);
      for (let slot = 0; slot < 12; slot++) run("edges", edges, slot);
      run("pinStep", 1);
      run("collide", nodes, 12 + s);
    }
    if (publish) run("publish", nodes);
    if (keep) run("keep", nodes);
    pass.end();
    device.queue.submit([encoder.finish()]);
    this.steps++;
  }

  /** Reads positions (and pins) back, for tests */
  async read() {
    const { device, n } = this;
    const size = n * n * 16;
    const a = device.createBuffer({ size, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const b = device.createBuffer({ size: MAX_PINS * 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(this.buffers.old, 0, a, 0, size);
    encoder.copyBufferToBuffer(this.buffers.bodies, 0, b, 0, MAX_PINS * 32);
    device.queue.submit([encoder.finish()]);
    await Promise.all([a.mapAsync(GPUMapMode.READ), b.mapAsync(GPUMapMode.READ)]);
    const pos = new Float32Array(a.getMappedRange().slice(0));
    const bodies = new Float32Array(b.getMappedRange().slice(0));
    a.destroy();
    b.destroy();
    return { pos, bodies };
  }
}
