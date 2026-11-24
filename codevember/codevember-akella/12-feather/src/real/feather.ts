// One feather: a strip of triangles shaped, bent and twisted in the vertex stage, drawn many times.
// Local frame per feather: x across the vane (towards the wing tip / leading side: the narrow outer vane),
// y the upper face, z along the shaft from quill to tip.
import * as TSL from "three/tsl";
import { AddEquation, MinEquation, BufferAttribute, BufferGeometry, CustomBlending, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, MeshBasicNodeMaterial, OneFactor } from "three/webgpu";
import { shade, type Light, type N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const {
  abs,
  attribute,
  clamp,
  cos,
  cross,
  dot,
  float,
  floor,
  fract,
  fwidth,
  max,
  mix,
  modelWorldMatrix,
  mx_noise_float,
  normalize,
  positionGeometry,
  positionWorld,
  sign,
  sin,
  smoothstep,
  sqrt,
  varying,
  vec2,
  vec3,
  vec4,
} = T;

export const FLOATS = 24; // per feather: iA iB (shape, fixed) then iR iX iY iZ (pose)

// a grid of (u, 0, v): u across -1..1, v along 0..1, rows packed towards the tip where the outline turns
export function featherGrid(nu: number, nv: number) {
  const pos = new Float32Array(nu * nv * 3);
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const k = (j * nu + i) * 3;
      pos[k] = (i / (nu - 1)) * 2 - 1;
      pos[k + 2] = 1 - Math.pow(1 - j / (nv - 1), 1.7);
    }
  const idx: number[] = [];
  for (let j = 0; j < nv - 1; j++)
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i;
      idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

export interface FeatherSet {
  geometry: InstancedBufferGeometry;
  count: number;
  shape: Float32Array; // iA iB interleaved by hand: 8 per feather
  pose: Float32Array; // iR iX iY iZ: 16 per feather
  touch: () => void;
}

// iA = (length, half width, asymmetry, where the tip starts rounding)   iB = (seed, emargination, fluff, tone)
// iR = (root, bend)   iX = (x axis, twist)   iY = (y axis, head-steadying weight)   iZ = (z axis, sweep)
export function featherSet(count: number, nu: number, nv: number, dynamic: boolean): FeatherSet {
  const grid = featherGrid(nu, nv);
  const g = new InstancedBufferGeometry();
  g.setIndex(grid.index);
  g.setAttribute("position", grid.getAttribute("position"));
  const shape = new Float32Array(count * 8);
  const pose = new Float32Array(count * 16);
  const names = ["iA", "iB", "iR", "iX", "iY", "iZ"];
  const arrays: Float32Array[] = [];
  const attrs: InstancedBufferAttribute[] = [];
  for (let i = 0; i < 6; i++) {
    const arr = new Float32Array(count * 4);
    const at = new InstancedBufferAttribute(arr, 4);
    if (dynamic && i >= 2) at.setUsage(DynamicDrawUsage);
    g.setAttribute(names[i], at);
    arrays.push(arr);
    attrs.push(at);
  }
  g.instanceCount = count;
  const touch = () => {
    for (let f = 0; f < count; f++) {
      for (let c = 0; c < 4; c++) {
        arrays[0][f * 4 + c] = shape[f * 8 + c];
        arrays[1][f * 4 + c] = shape[f * 8 + 4 + c];
      }
    }
    for (let i = 2; i < 6; i++) {
      const a = arrays[i];
      const o = (i - 2) * 4;
      for (let f = 0; f < count; f++) {
        const k = f * 16 + o;
        a[f * 4] = pose[k];
        a[f * 4 + 1] = pose[k + 1];
        a[f * 4 + 2] = pose[k + 2];
        a[f * 4 + 3] = pose[k + 3];
      }
      attrs[i].needsUpdate = true;
    }
    attrs[0].needsUpdate = true;
    attrs[1].needsUpdate = true;
  };
  return { geometry: g, count, shape, pose, touch };
}

// the vertex stage, as plain expressions (shared by the picture and the sun's map)
function featherVertex(steady: N) {
  const g = positionGeometry;
  const uu = g.x;
  const v = g.z;
  const iA = attribute("iA", "vec4");
  const iB = attribute("iB", "vec4");
  const iR = attribute("iR", "vec4");
  const iX = attribute("iX", "vec4");
  const iY = attribute("iY", "vec4");
  const iZ = attribute("iZ", "vec4");
  const L = iA.x;
  const W = iA.y;
  const asym = iA.z;
  const tipAt = iA.w;
  const emarg = iB.y;
  const fluff = iB.z;
  const bend = iR.w;
  const twist = iX.w;
  const sweep = iZ.w;

  // outline: a bare quill, the vane opening out, a rounded end; outer primaries pinch in to make fingers
  const rise = smoothstep(0.02, 0.2, v);
  const tt = clamp(v.sub(tipAt).div(float(1).sub(tipAt)), 0, 1);
  const tipP = sqrt(max(float(1).sub(tt.mul(tt)), 0));
  const pinch = float(1).sub(emarg.mul(0.48).mul(smoothstep(0.4, 0.58, v)));
  const prof = mix(0.05, 1, rise).mul(tipP).mul(pinch);
  const half = W.mul(prof).mul(float(1).sub(asym.mul(sign(uu))));
  const x = uu.mul(half);
  // the vane is a shallow arch across
  const camber = fluff.mul(0.09).add(0.1);
  const yc = camber.mul(half).mul(uu.mul(uu)).negate();

  // the shaft bends more and more towards the tip, curves a little sideways, and twists
  const al = bend.mul(v).mul(v);
  const yb = L.mul(bend).mul(v.mul(v).mul(v)).div(3);
  const zb = L.mul(v.sub(bend.mul(bend).mul(v.mul(v).mul(v).mul(v).mul(v)).div(10)));
  const gam = sweep.mul(v);
  const xs = L.mul(sweep).mul(v).mul(v).mul(0.5);
  const Tn = normalize(vec3(sin(gam), sin(al), cos(al)));
  const A0 = normalize(vec3(cos(gam), 0, sin(gam).negate()));
  const N0 = normalize(cross(Tn, A0));
  const th = twist.mul(v);
  const across = A0.mul(cos(th)).add(N0.mul(sin(th)));
  const nrm = N0.mul(cos(th)).sub(A0.mul(sin(th)));
  const local = vec3(xs, yb, zb).add(across.mul(x)).add(nrm.mul(yc));
  // shade as if the arch were deeper than it is built, and no two feathers lie at quite the same angle
  const lean = fract(iB.x.mul(7.13)).sub(0.5).mul(0.22);
  const nl = normalize(nrm.add(across.mul(uu.mul(camber).mul(4.5).add(lean))));

  const toFrame = (p: N) => iX.xyz.mul(p.x).add(iY.xyz.mul(p.y)).add(iZ.xyz.mul(p.z));
  const position = iR.xyz.add(toFrame(local)).add(vec3(0, iY.w.mul(steady), 0));
  const world = (d: N) => modelWorldMatrix.mul(vec4(toFrame(d), 0)).xyz;
  return {
    position,
    vUV: varying(vec2(uu, v), "vFUV"),
    vN: varying(world(nl), "vFN"),
    vAcross: varying(world(across), "vFAcross"),
    vAlong: varying(world(Tn), "vFAlong"),
    vDim: varying(vec4(W.mul(prof), L, asym, fluff), "vFDim"),
    vId: varying(vec2(iB.x, iB.w), "vFId"),
  };
}

const hash1 = (p: N) => fract(sin(p.mul(127.1)).mul(43758.5453));

// what the vane is made of at a point: shaft, barbs, the gaps where barbs have unzipped
function featherSurface(vx: ReturnType<typeof featherVertex>) {
  const uu = vx.vUV.x;
  const v = vx.vUV.y;
  const au = abs(uu);
  const L = vx.vDim.y;
  const halfSide = vx.vDim.x.mul(float(1).sub(vx.vDim.z.mul(sign(uu))));
  const fluff = vx.vDim.w;
  const seed = vx.vId.x;
  const xm = au.mul(halfSide); // metres from the shaft
  const sm = v.mul(L); // metres along it
  // barbs leave the shaft at about 40 degrees towards the tip: b is constant along one
  const b = sm.sub(xm.mul(1.15)).add(seed.mul(0.37));
  const side = sign(uu).mul(7.3);

  const rw = L.mul(0.0042)
    .mul(float(1).sub(v.mul(0.82)))
    .add(0.00015);
  const shaft = float(1).sub(smoothstep(rw.mul(0.55), rw, xm));

  // streaks: barbs clump in bundles a few mm wide
  const streak = mx_noise_float(vec2(b.mul(520), side.add(seed.mul(11))))
    .mul(0.65)
    .add(
      mx_noise_float(vec2(b.mul(1700), side.add(seed.mul(5))))
        .mul(0.35)
        .mul(clamp(float(1).sub(fwidth(b).mul(900)), 0, 1)),
    );
  const fineFade = clamp(float(1).sub(fwidth(b).mul(1800)), 0, 1);
  const fine = sin(b.mul(6283 / 0.9)).mul(fineFade);

  // splits: here and there the barbs part, a thin wedge open at the edge
  const cellW = mix(0.007, 0.0035, fluff);
  const cb = b.div(cellW);
  const ci = floor(cb);
  const cf = fract(cb);
  const h1 = hash1(ci.add(side).add(seed.mul(53.7)));
  const h2 = hash1(ci.mul(1.31).add(side).add(seed.mul(17.3)));
  const isSplit = smoothstep(mix(0.86, 0.45, fluff), mix(0.88, 0.5, fluff), h1);
  const depth = mix(0.12, 0.55, h2).mul(mix(0.8, 1.5, fluff));
  const into = clamp(au.sub(float(1).sub(depth)).div(depth), 0, 1);
  const wedge = smoothstep(into.mul(mix(0.3, 0.46, fluff)), into.mul(mix(0.3, 0.46, fluff)).sub(fwidth(cb).mul(1.2)), abs(cf.sub(0.5))).mul(isSplit);
  // the edge itself frays
  const fray = mx_noise_float(vec2(b.mul(1400), side))
    .mul(0.5)
    .add(0.5)
    .mul(mix(0.03, 0.22, fluff));
  const edge = float(1).sub(au).sub(fray);
  const ew = clamp(fwidth(au).mul(1.3), 1e-4, 0.05); // (seen edge-on, a wide soft edge would dither into dots)
  const alpha = smoothstep(0, ew, edge).mul(float(1).sub(wedge));

  return { uu, v, au, shaft, streak, fine, alpha, fluff, seed };
}

export function featherMaterials(L: Light, steady: N) {
  // ---- the picture
  const vx = featherVertex(steady);
  const s = featherSurface(vx);
  const mat = new MeshBasicNodeMaterial();
  mat.side = DoubleSide;
  mat.alphaToCoverage = true;
  mat.positionNode = vx.position;
  const tone = vx.vId.y;
  // roots sit under other feathers: darker; the shaft is a touch warmer and brighter
  const tuck = mix(mix(0.8, 0.62, s.fluff), 1, smoothstep(0.0, 0.55, s.v));
  const base = vec3(0.93, 0.925, 0.9)
    .mul(tone)
    .mul(s.streak.mul(0.085).add(s.fine.mul(0.05)).add(1));
  const albedo = mix(base, vec3(0.97, 0.95, 0.88), s.shaft.mul(0.8));
  // barbs catch the light in bundles; the shaft is a ridge with a lit and a shaded flank
  const nn = normalize(vx.vN.add(vx.vAcross.mul(s.streak.mul(0.3).add(s.fine.mul(0.18)).add(sign(s.uu).mul(s.shaft).mul(0.55)))));
  // optical depth of this very layer, as written to the sun's map
  const own = vaneDepth(s);
  // barbs leave the shaft at about 40 degrees, towards the tip, on either side
  const barb = vx.vAlong
    .mul(0.77)
    .add(vx.vAcross.mul(sign(s.uu).mul(0.64)))
    .add(vx.vAcross.mul(s.streak.mul(0.25)));
  const lit = shade(L, { P: positionWorld, N: nn, albedo, thin: float(1).sub(s.fluff.mul(0.55)), self: own, gloss: s.shaft.mul(0.25), ao: tuck, fibre: barb });
  mat.colorNode = lit.xyz;
  mat.opacityNode = s.alpha;

  // ---- the sun's map: add up τ and τ·z
  const vx2 = featherVertex(steady);
  const s2 = featherSurface(vx2);
  const depth = new MeshBasicNodeMaterial();
  depth.side = DoubleSide;
  depth.depthTest = false;
  depth.depthWrite = false;
  depth.transparent = true;
  depth.blending = CustomBlending;
  depth.blendEquation = AddEquation;
  depth.blendSrc = OneFactor;
  depth.blendDst = OneFactor;
  depth.blendEquationAlpha = MinEquation;
  depth.blendSrcAlpha = OneFactor;
  depth.blendDstAlpha = OneFactor;
  depth.positionNode = vx2.position;
  const tau = vaneDepth(s2).mul(s2.alpha);
  const z = dot(positionWorld, L.sunDir).negate();
  depth.outputNode = vec4(tau, tau.mul(z), tau.mul(z).mul(z), 1);
  return { mat, depth };
}

// a vane is thinner towards its edge and its tip; the shaft is all but opaque
function vaneDepth(s: ReturnType<typeof featherSurface>) {
  const vane = mix(1, 0.55, s.au.mul(s.au))
    .mul(mix(1, 0.7, smoothstep(0.6, 1, s.v)))
    .mul(s.streak.mul(0.16).add(s.fine.mul(0.12)).add(1));
  return mix(vane, 5, s.shaft).mul(mix(1, 0.7, s.fluff));
}

const additive = (m: MeshBasicNodeMaterial) => {
  m.side = DoubleSide;
  m.depthTest = false;
  m.depthWrite = false;
  m.transparent = true;
  m.blending = CustomBlending;
  m.blendEquation = AddEquation;
  m.blendSrc = OneFactor;
  m.blendDst = OneFactor;
  m.blendEquationAlpha = MinEquation;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneFactor;
  return m;
};

// solids write the nearest depth into alpha
export function solidDepthMaterial(L: Light, position?: N) {
  const m = additive(new MeshBasicNodeMaterial());
  if (position) m.positionNode = position;
  const z = dot(positionWorld, L.sunDir).negate();
  m.outputNode = vec4(0, 0, 0, z.mul(0.25).add(0.5));
  return m;
}

// the wing's arm is skin and thin muscle under its coverts: dense, but light still gets through
export function skinDepthMaterial(L: Light, tau: number) {
  const m = additive(new MeshBasicNodeMaterial());
  const z = dot(positionWorld, L.sunDir).negate();
  m.outputNode = vec4(tau, z.mul(tau), z.mul(z).mul(tau), 1);
  return m;
}
