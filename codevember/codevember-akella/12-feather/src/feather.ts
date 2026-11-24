// One feather: a strip of triangles shaped, bent and twisted in the vertex stage, drawn many times.
// Local frame per feather: x across the vane (towards the wing tip / leading side: the narrow outer vane),
// y the upper face, z along the shaft from quill to tip.
import * as TSL from "three/tsl";
import { BufferAttribute, BufferGeometry, DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, MeshBasicNodeMaterial } from "three/webgpu";
import { DEPTH_SCALE, lowered, plumage, type Cel, type N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const {
  abs,
  attribute,
  clamp,
  cos,
  cross,
  float,
  floor,
  fract,
  fwidth,
  max,
  mix,
  modelWorldMatrix,
  mrt,
  mx_noise_float,
  normalize,
  positionGeometry,
  positionView,
  sign,
  sin,
  smoothstep,
  sqrt,
  step,
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

// iA = (length, half width, asymmetry, where the tip starts rounding)   iB = (seed, emargination, fluff, part of the bird)
// (fluff below zero is no fluff, and asks instead for the feather to be drawn as one: shaft and barbs, that much)
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
function featherVertex(steady: N, beat: N) {
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
  // iB.y above zero pinches the tip into a finger; below zero it marks a plume that the air plays with
  const emarg = max(iB.y, 0);
  const loose = max(iB.y.negate(), 0);
  const ph = iB.x.mul(6.283);
  const fluff = max(iB.z, 0);
  const bend = iR.w.add(
    loose.mul(
      sin(beat.add(ph))
        .mul(0.5)
        .add(sin(beat.mul(3).add(ph.mul(1.9))).mul(0.22)),
    ),
  );
  const twist = iX.w;
  const sweep = iZ.w.add(loose.mul(sin(beat.mul(2).add(ph.mul(1.55))).mul(0.35)));

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
  const nl = normalize(nrm.add(across.mul(uu.mul(camber).mul(3).add(lean))));

  const toFrame = (p: N) => iX.xyz.mul(p.x).add(iY.xyz.mul(p.y)).add(iZ.xyz.mul(p.z));
  const position = iR.xyz.add(toFrame(local)).add(vec3(0, iY.w.mul(steady), 0));
  const world = (d: N) => modelWorldMatrix.mul(vec4(toFrame(d), 0)).xyz;
  return {
    position,
    vUV: varying(vec2(uu, v), "vFUV"),
    vN: varying(world(nl), "vFN"),
    vAcross: varying(world(across), "vFAcross"),
    vAlong: varying(world(Tn), "vFAlong"),
    vDim: varying(vec4(W.mul(prof), L, asym, iB.z), "vFDim"),
    vId: varying(vec2(iB.x, iB.w), "vFId"),
  };
}

const hash1 = (p: N) => fract(sin(p.mul(127.1)).mul(43758.5453));

// what is drawn of the vane at a point: its edge with a few splits, the pale tip, an ink stroke
function featherSurface(vx: ReturnType<typeof featherVertex>, C: Cel) {
  const uu = vx.vUV.x;
  const v = vx.vUV.y;
  const au = abs(uu);
  const L = vx.vDim.y;
  const halfSide = vx.vDim.x.mul(float(1).sub(vx.vDim.z.mul(sign(uu))));
  const fluff = max(vx.vDim.w, 0);
  const drawn = max(vx.vDim.w.negate(), 0);
  const seed = vx.vId.x;
  const xm = au.mul(halfSide); // metres from the shaft
  const sm = v.mul(L); // metres along it
  // barbs leave the shaft at about 40 degrees towards the tip: b is constant along one
  const b = sm.sub(xm.mul(1.15)).add(seed.mul(0.37));
  const side = sign(uu).mul(7.3);

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
    .mul(mix(0.015, 0.16, fluff));
  const edge = float(1).sub(au).sub(fray);
  const ew = clamp(fwidth(au).mul(1.3), 1e-4, 0.05); // (seen edge-on, a wide soft edge would dither into dots)
  const alpha = smoothstep(0, ew, edge).mul(float(1).sub(wedge));

  // ink: not every feather is drawn, and none all the way round. A chosen feather gets a stroke along its
  // edges from somewhere down its length to the tip, as a hand would mark where one feather ends over another.
  // A feather only a few pixels across gets none, or the wing would fill with ink
  const px = max(fwidth(au), 1e-5);
  const big = smoothstep(2.5, 7, float(1).div(px));
  const flight = float(1)
    .sub(smoothstep(0.0, 0.04, fluff))
    .mul(smoothstep(0.1, 0.16, L));
  const chosen = step(hash1(seed.mul(3.7)), C.strokes.mul(mix(0.45, 0.9, flight)));
  // a dash, not a line: it starts somewhere down the feather and gives out before the end as often as not
  const from = mix(0.25, 0.7, hash1(seed.mul(9.1).add(C.boil.mul(0.37))));
  const run = mix(0.12, 0.5, hash1(seed.mul(2.3)));
  const dash = smoothstep(from, from.add(0.04), v).mul(float(1).sub(smoothstep(from.add(run), from.add(run).add(0.05), v)));
  const wide = C.linePx.mul(mix(0.8, 1.5, hash1(seed.mul(5.3).add(C.boil))));
  const stroke = float(1)
    .sub(smoothstep(wide.mul(0.5), wide.mul(1.3), edge.div(px)))
    .mul(big)
    .mul(chosen)
    .mul(dash);
  // the flight feathers thin towards the tip and go pale there, with an edge that wanders a little
  const tip = smoothstep(0.4, 0.44, v.add(mx_noise_float(vec2(b.mul(60), seed)).mul(0.07))).mul(flight);

  // a feather shown for its own sake: the shaft down its middle, and barbs slanting off it to either side
  const spine = float(1)
    .sub(smoothstep(0.7, 1.5, xm.div(max(fwidth(xm), 1e-7))))
    .mul(smoothstep(0.02, 0.1, v))
    .mul(float(1).sub(smoothstep(0.9, 0.97, v)));
  const rows = b.div(L.mul(0.12));
  const barbs = float(1)
    .sub(smoothstep(0.35, 1.0, abs(fract(rows).sub(0.5)).div(max(fwidth(rows), 1e-5))))
    .mul(smoothstep(0.12, 0.22, v))
    .mul(float(1).sub(smoothstep(0.82, 0.93, v)))
    .mul(float(1).sub(smoothstep(0.55, 0.8, au)))
    .mul(0.6);
  const quill = max(spine, barbs).mul(big).mul(drawn);

  return { uu, v, au, alpha, fluff, seed, stroke: max(stroke, quill), tip };
}

// ofBird: it is on a bird, and goes where the bird goes in the sea's picture
export function featherMaterial(C: Cel, steady: N, beat: N, ofBird = false) {
  const vx = featherVertex(steady, beat);
  const s = featherSurface(vx, C);
  const mat = new MeshBasicNodeMaterial();
  mat.side = DoubleSide;
  mat.alphaToCoverage = true;
  mat.positionNode = vx.position;
  if (ofBird) mat.vertexNode = lowered();
  // (wings and tail have part ids from 0.4 up, see PART)
  mat.colorNode = mix(mix(plumage(C, vx.vN, step(0.3, vx.vId.y)), C.pale, s.tip), C.ink, s.stroke);
  mat.opacityNode = s.alpha;
  // beside the picture: this is bird, which part of it, and how far from the eye
  mat.mrtNode = mrt({ mask: vec4(1, vx.vId.y, positionView.z.negate().div(DEPTH_SCALE), 1) });
  return mat;
}
