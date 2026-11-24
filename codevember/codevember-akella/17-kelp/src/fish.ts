// Bright fish that live in the weed's shadow and keep up with its growing. Nothing is simulated: where a fish is,
// is written down as a thing of the loop's phase that comes round every loop, and it faces the way it is going.
//
//   home     a place under the body on its shaded side, a little way out from the skin as that goes by (so a lump
//            pushes it out). When it is bold it wanders out into the light and back; when it is not, it is in
//            among the fronds.
//   rock     as a rock (rock.ts) comes down towards the front, the fish that live near the front go out to meet
//            it, those nearest first and the rest after them, and go slowly round it in the sun. When the weed
//            touches the rock they bolt home: off quickly, and then a long glide in. The others, further down the
//            body, take fright as these come home. Then nobody is bold for a while.
//   frights  twice a loop one of them starts at nothing, and those near it dart away from it, the nearer the
//            sooner and the further.
//
// What makes it water: nothing goes in a straight line or stops at once (every way out is an arc, every arrival a
// glide), a fish turns by bending (its body lies along its path), and its tail beats as it has to: so many beats
// to a length swum, harder when it gathers speed and hardly at all when it glides.
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { Fn, attribute, cameraPosition, clamp, cos, cross, dot, float, floor, fract, int, ivec2, length, max, min, mix, mod, normalize, positionGeometry, positionWorld, pow, saturate, sign, sin, smoothstep, sqrt, step, texture, textureLoad, uniform, uv, varyingProperty, vec2, vec3, vec4, vertexIndex } from "three/tsl";
import type { Mesh, MeshStandardMaterial, Node, SkinnedMesh, Texture } from "three/webgpu";
import { AnimationMixer, BufferAttribute, DataTexture, DoubleSide, FloatType, InstancedBufferGeometry, InstancedInterleavedBuffer, InterleavedBufferAttribute, Matrix3, Matrix4, NearestFilter, NodeMaterial, RGBAFormat, SRGBColorSpace, TextureLoader, Vector3 } from "three/webgpu";
import type { Light } from "./light.ts";
import type { createLook } from "./look.ts";
import type { createStems } from "./stems.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;
type V4 = Node<"vec4">;
const TAU = Math.PI * 2;
// the small frights: how long after the first rock's middle is at the front, where along the body (loops behind
// the heads) and where across the shaded side (0..1) the fish that starts is
const FRIGHTS = [
  [0.1, -0.2, 0.4],
  [0.235, -0.48, 0.75],
];
// loops: how long the way out to a rock takes, and the way home (most of that the glide)
const OUT = 0.4,
  BACK = 0.17;
// how hard a fish keeps its nose into the water coming at it, of the growth's speed; and the steepest it goes
// (the sine of that)
const STAY = 0.3,
  STEEP = 0.8;
// the clear space a fish keeps between its middle and the weed or a rock
const CLEAR = 0.07;
// where about a point of a fish the light is asked for: two rings
const PATCH = [...Array.from({ length: 4 }, (_, k) => [0.42 * Math.cos(k * 1.571 + 0.4), 0.42 * Math.sin(k * 1.571 + 0.4)]), ...Array.from({ length: 6 }, (_, k) => [Math.cos(k * 1.047), Math.sin(k * 1.047)])];

// A fish a length of 1, its nose at +x, its back up (+y), thin in z.
//   map    its paint. `silver` says where a sheen plays: "alpha" if the paint's alpha says how silvery each part
//          is (tools/repaint.mjs), "white" if it is to be the parts that have no colour
//   size   of the lengths the fish are given
//   stiff  how far down the body the bending is put off (2 is an eel of a fish, 3 one that sculls with its tail)
//   beat   how wide its tail goes, of what a long fish's does: a fish that is a plate hardly bends at all
//   pace   how many beats it takes, of a long fish's
//   kick   beats more than its usual that it gives to get away, at least and at most
//   pale   what its paint is multiplied by: a white fish in this sun is a lamp
//   swum   if the model came with its own swimming: where every point is at each of `frames` moments of it (a
//          picture a point wide and a moment high), and then `beat` is not used and a "beat" is once through it
export type Swim = { size: number; stiff: number; beat: number; pace: number; kick: [number, number]; pale: number };
export type Model = Swim & { position: Float32Array; normal: Float32Array; uv: Float32Array; index: number[]; map: Texture | null; silver: "alpha" | "white" | "none"; swum: { map: DataTexture; frames: number } | null };
const LONG: Swim = { size: 1, stiff: 2.2, beat: 1, pace: 1, kick: [5, 8], pale: 1 };

// a model from a file. `face`: how far it is to be turned about the upright for its nose to be at +x. `paint`: a
// picture to use and not the file's own (tools/repaint.mjs makes one from that). If the file has bones and a
// clip, the clip is played here once and kept as points (`swum`): the fish are drawn in one go, each at its own
// moment of it, and bones cannot be
export async function loadFish(url: string, face: number, paint?: string, swim: Partial<Swim> = {}, frames = 48): Promise<Model> {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const meshes: Mesh[] = [];
  gltf.scene.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
  });
  const mesh = meshes[0];
  if (!mesh) throw new Error(`no fish in ${url}`);
  const P = mesh.geometry.getAttribute("position"),
    Q = mesh.geometry.getAttribute("normal"),
    T = mesh.geometry.getAttribute("uv");
  const count = P.count;
  const clip = (mesh as SkinnedMesh).isSkinnedMesh ? gltf.animations[0] : undefined;
  const poses = clip ? frames : 1;
  // where every point is at every moment, in the file's own space
  const moved = new Float32Array(poses * count * 3);
  const v = new Vector3();
  const mixer = clip ? new AnimationMixer(gltf.scene) : null;
  if (mixer && clip) mixer.clipAction(clip).play();
  for (let k = 0; k < poses; k++) {
    if (mixer && clip) {
      mixer.setTime((k / poses) * clip.duration);
      gltf.scene.updateMatrixWorld(true);
    }
    for (let i = 0; i < count; i++) {
      mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
      moved.set([v.x, v.y, v.z], (k * count + i) * 3);
    }
  }
  // its shape at rest is the mean of those; turned, middled and made a length of 1
  const turn = new Matrix4().makeRotationY(face);
  const rest = new Float32Array(count * 3);
  for (let k = 0; k < poses; k++) for (let j = 0; j < count * 3; j++) rest[j] += moved[k * count * 3 + j] / poses;
  const low = new Vector3(Infinity, Infinity, Infinity),
    high = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < count; i++) {
    v.fromArray(rest, i * 3).applyMatrix4(turn);
    low.min(v);
    high.max(v);
  }
  const mid = low.clone().add(high).multiplyScalar(0.5);
  const scale = 1 / (high.x - low.x);
  const fit = (from: Float32Array, at: number) => v.fromArray(from, at).applyMatrix4(turn).sub(mid).multiplyScalar(scale);
  const position = new Float32Array(count * 3),
    normal = new Float32Array(count * 3),
    uvs = new Float32Array(count * 2);
  const world = new Matrix3().getNormalMatrix(new Matrix4().multiplyMatrices(turn, mesh.matrixWorld));
  for (let i = 0; i < count; i++) {
    fit(rest, i * 3).toArray(position, i * 3);
    v.set(Q.getX(i), Q.getY(i), Q.getZ(i)).applyMatrix3(world).normalize().toArray(normal, i * 3);
    uvs.set([T.getX(i), T.getY(i)], i * 2);
  }
  let swum: Model["swum"] = null;
  const index = Array.from(mesh.geometry.index!.array);
  if (clip) {
    normal.fill(0);
    for (let t = 0; t < index.length; t += 3) {
      const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
      const u = [0, 1, 2].map((k) => position[b + k] - position[a + k]),
        w = [0, 1, 2].map((k) => position[c + k] - position[a + k]);
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      for (const k of [a, b, c]) for (let d = 0; d < 3; d++) normal[k + d] += n[d];
    }
    for (let k = 0; k < normal.length; k += 3) {
      const l = Math.hypot(normal[k], normal[k + 1], normal[k + 2]) || 1;
      for (let d = 0; d < 3; d++) normal[k + d] /= l;
    }
    const data = new Float32Array(poses * count * 4);
    for (let k = 0; k < poses; k++) for (let i = 0; i < count; i++) fit(moved, (k * count + i) * 3).toArray(data, (k * count + i) * 4);
    const map = new DataTexture(data, count, poses, RGBAFormat, FloatType);
    map.minFilter = map.magFilter = NearestFilter;
    map.needsUpdate = true;
    swum = { map, frames: poses };
  }
  let map = (mesh.material as MeshStandardMaterial).map;
  if (paint) {
    map = await new TextureLoader().loadAsync(paint);
    map.colorSpace = SRGBColorSpace;
    map.flipY = false; // as a glTF's own pictures are
  }
  if (map) map.anisotropy = 4;
  return { ...LONG, ...swim, position, normal, uv: uvs, index, map, silver: paint ? "alpha" : "white", swum };
}

// and one that is only drawn: rings from nose to tail. A deep body, a ridge of fin along its back and belly, a
// narrow wrist and a fan of tail
export function drawnFish(): Model {
  const RINGS = 18,
    ROUND = 12;
  const position = new Float32Array((RINGS + 1) * ROUND * 3);
  const index: number[] = [];
  for (let j = 0, v = 0; j <= RINGS; j++) {
    const u = j / RINGS;
    const body = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(Math.min(u / 0.8, 1), 0.72)), 0), 0.75);
    let tall = 0.2 * body,
      wide = 0.07 * body;
    // the ridge: most over the middle of the back
    let fin = 0.4 * Math.pow(Math.max(Math.sin((Math.PI * (u - 0.22)) / 0.5), 0), 0.6) * (u > 0.22 && u < 0.72 ? 1 : 0);
    if (u > 0.74) {
      const k = (u - 0.74) / 0.26;
      tall = Math.max(tall, 0.03 + 0.2 * Math.pow(k, 1.25));
      wide = Math.max(wide * (1 - k), 0.004);
      fin = 0;
    }
    for (let m = 0; m < ROUND; m++, v++) {
      const a = (m / ROUND) * TAU,
        up = Math.sin(a);
      position.set([0.5 - u, tall * up * (1 + fin * Math.pow(Math.abs(up), 6)), wide * Math.cos(a)], v * 3);
    }
  }
  for (let j = 0; j < RINGS; j++)
    for (let m = 0; m < ROUND; m++) {
      const a = j * ROUND + m,
        b = j * ROUND + ((m + 1) % ROUND);
      index.push(a, a + ROUND, b, b, a + ROUND, b + ROUND);
    }
  const normal = new Float32Array(position.length);
  for (let t = 0; t < index.length; t += 3) {
    const [a, b, c] = [index[t] * 3, index[t + 1] * 3, index[t + 2] * 3];
    const u = [0, 1, 2].map((k) => position[b + k] - position[a + k]),
      w = [0, 1, 2].map((k) => position[c + k] - position[a + k]);
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    for (const k of [a, b, c]) for (let d = 0; d < 3; d++) normal[k + d] += n[d];
  }
  for (let k = 0; k < normal.length; k += 3) {
    const l = Math.hypot(normal[k], normal[k + 1], normal[k + 2]) || 1;
    for (let d = 0; d < 3; d++) normal[k + d] /= l;
  }
  return { position, normal, uv: new Float32Array((position.length / 3) * 2), index, map: null, silver: "none", swum: null, ...LONG, stiff: 2 };
}

// `models`: the kinds of fish there may be. Each kind has all the fish; `show` says how many of each are seen, and
// the odd kinds count from the far end, so that two kinds shown together are different fish.
export function createFish(stems: ReturnType<typeof createStems>, light: Light, shade: ReturnType<typeof createLook>, models: Model[], most = 90, seed = 5) {
  let s = seed >>> 0;
  const R = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- what each is told
  // fa: how far behind the heads its home is (loops, under 0), where across the shaded side (0..1), how far out it
  //     goes when bold (0..1), its own number
  // fb: where about a rock it hangs: how far along the growth from the rock's middle (-1..1 of how far out it
  //     is), where round it (0..1, the middle of that the eye's side), -, and how far out, of the rock's reach
  // fc: how long it is, how many times it beats its tail in a loop to keep up with the growth, when it sets out
  //     for a rock among those that set out with it (0..1), how long after the weed touches the rock it bolts (loops)
  const rows = Array.from({ length: most }, () => {
    // about a rock: anywhere along it, and round it more on the eye's side than behind, where they would not be seen
    const up = (R() - 0.5) * 1.5;
    const round = 0.5 + (R() - 0.5) * Math.pow(R(), 0.6);
    const near = up / 1.5 + 0.5; // 0 on the side the weed comes from
    const long = 0.085 + 0.065 * R();
    // a fish goes about 1.3 of its length for a beat of its tail
    const beats = Math.round(stems.options.pitch / (1.3 * long));
    return [-(0.04 + 0.72 * Math.pow(R(), 1.4)), R(), R(), R(), up, round, 0, 1.0 + 0.4 * R(), long, beats, R(), 0.012 + 0.065 * near + 0.02 * R()];
  });
  const fa = attribute("fa", "vec4") as V4,
    fb = attribute("fb", "vec4") as V4,
    fc = attribute("fc", "vec4") as V4;

  const rock = () => ({ at: uniform(0), reach: uniform(1), long: uniform(1), touch: uniform(-0.27), on: uniform(0), half: uniform(0) });
  const U = {
    size: uniform(1),
    colour: uniform(new Vector3(1, 1, 1)), // what the fish's own colours are seen through
    shine: uniform(0.09), // a little light of their own, so that one in the shade is a fish and not a hole
    shaded: uniform(0), // the way round the body that is furthest from the sun
    eyeward: uniform(1), // and which way round from there is towards the eye
    eye: uniform(0), // the way round the body that the eye is
    gain: uniform(1.2), // how much of the sun they give back: they are the bright things here
    wander: uniform(1),
    sheen: uniform(1), // how much of a film of colours plays on the silvery parts
    hurry: uniform(1), // how quick the ways out and home are: 1 as written, 2 in half the time
    rocks: [rock(), rock()],
  };
  const { axis, across, depth, pitch, phase } = stems.U;
  const er = (th: N) => across.mul(cos(th)).add(depth.mul(sin(th)));
  const turnOf = (part: N | number) => U.shaded.add(U.eyeward.mul(mix(float(-0.35), float(1.25), part)));
  // its own numbers, and whole numbers of turns in a loop
  const own = (k: number) => fract(fa.w.mul(k).add(k * 0.37));
  const wob = (t: N, k: number, least: number, span: number) =>
    sin(
      t
        .mul(floor(own(k).mul(span)).add(least))
        .add(own(k + 0.5))
        .mul(TAU),
    );
  const ease = (x: N) => x.mul(x).mul(x.mul(-2).add(3));

  // where it is at a time, and how many beats of its tail its errands have cost it by then
  const where = (t: N, model: Model) => {
    const turn = turnOf(fa.y).toVar();
    // its home as it is on average: for how far it is from where a fright starts
    const usual = axis.mul(fa.x.mul(pitch)).add(er(turn).mul(fa.z.mul(0.3).add(0.55)));
    let bold: N = float(1),
      beats: N = float(0),
      dart: V3 = vec3(0);
    for (const [after, back, part] of FRIGHTS) {
      const from = axis.mul(pitch.mul(back)).add(er(turnOf(part)).mul(0.6));
      const away = usual.sub(from).toVar();
      const far = length(away).toVar();
      const near = saturate(far.div(0.9).oneMinus()).toVar();
      // it goes through them: 0.05 of a loop for every unit of water
      const x = fract(t.sub(U.rocks[0].at).sub(after).sub(far.mul(0.05))).toVar();
      // away in a third of a second, and back in three
      const jump = ease(saturate(x.div(0.035))).mul(ease(saturate(x.sub(0.045).div(0.27))).oneMinus());
      dart = dart.add(
        normalize(away.add(axis.mul(1e-3)))
          .mul(near)
          .mul(0.3)
          .mul(jump),
      );
      bold = bold.mul(
        near
          .mul(ease(saturate(x.div(0.035))))
          .mul(ease(saturate(x.sub(0.08).div(0.3))).oneMinus())
          .oneMinus(),
      );
      beats = beats.add(ease(saturate(x.div(0.06))).mul(step(0.05, near)).mul(Math.ceil(model.kick[0] / 2)));
    }
    // 0 for those that live at the front, 1 for those a long way down the body, which do not go to a rock
    const down = saturate(fa.x.negate().sub(0.04).div(0.4)).toVar();
    const goes = smoothstep(0.3, 0.44, fa.x.negate()).oneMinus().toVar();
    const first = step(own(9.1), 0.5);
    const outs: { out: N; along: N; round: N; far: N; arcOut: N; arcRound: N; since: N; rock: (typeof U.rocks)[number] }[] = [];
    for (const r of U.rocks) {
      // with two rocks, half the fish are for each
      const mine = mix(float(1), mix(first, first.oneMinus(), r.half.sub(1)), min(r.half, 1)).mul(r.on).toVar();
      // loops since its middle was at the front: -0.9 (far ahead) to 0.1 (taken)
      const since = fract(t.sub(r.at).add(0.9)).sub(0.9).toVar();
      // those at the front first, and the rest after them
      const leaves = max(r.touch.sub(OUT + 0.2), -0.88).add(mix(down, fc.z, 0.35).mul(0.13));
      const bolts = r.touch.add(fc.w);
      const x = fract(t.sub(r.at).sub(leaves)).toVar(); // loops since it set out
      // out: off gently and a long time arriving. Home: off at once, and most of the time is the glide in
      const rise = pow(ease(saturate(x.mul(U.hurry).div(OUT))).oneMinus(), 1.6).oneMinus().toVar();
      const y = saturate(x.sub(bolts.sub(leaves)).mul(U.hurry).div(BACK)).toVar();
      const fall = pow(pow(y, 1.6).oneMinus(), 3).oneMinus().toVar();
      const out = rise.mul(fall.oneMinus()).mul(mine).mul(goes).toVar();
      // nobody is bold for a while after: those that went, from when they bolt; the rest as the fright comes down the body
      const scared = fract(
        t
          .sub(r.at)
          .sub(bolts)
          .sub(goes.mul(mine).oneMinus().mul(down.mul(0.1).add(0.05))),
      ).toVar();
      bold = bold.mul(
        ease(saturate(scared.div(0.05)))
          .mul(ease(saturate(scared.sub(0.12).div(0.36))).oneMinus())
          .mul(r.on)
          .oneMinus(),
      );
      // its place at the rock: so far along it, so far round it from its home's side (the short way, and that
      // is settled once: not as it goes, or a fish opposite its place would change its mind half way there),
      // and it goes slowly round the rock, one way, as it hangs there
      const hand = sign(own(15.7).sub(0.5));
      const spot = U.eye.add(fb.y.sub(0.5).mul(4.4));
      const short = mod(spot.sub(turn).add(Math.PI), TAU).sub(Math.PI);
      const round = turn
        .add(short)
        .add(since.sub(r.touch).mul(own(16.9).mul(0.4).add(0.35)).mul(hand).mul(TAU))
        .add(wob(t, 13.3, 1, 2).mul(0.15).mul(U.wander));
      const reach = r.reach.mul(fb.w).mul(wob(t, 19.1, 1, 2).mul(0.07).add(1));
      const share = fb.x.add(wob(t, 17.9, 1, 2).mul(0.05)).toVar();
      // neither way is straight: out, it swings wide of the front; home, it comes in round the body's side
      const home = step(bolts.sub(leaves), x);
      const swing = sin(out.mul(Math.PI));
      outs.push({
        out,
        along: since.negate().mul(pitch).add(share.mul(reach)),
        round,
        far: sqrt(share.mul(share).oneMinus().max(0.05)).mul(reach),
        arcOut: swing.mul(mix(own(23.1).mul(0.3).add(0.2), float(0.12), home)),
        arcRound: swing.mul(home).mul(hand).mul(own(24.7).mul(0.5).add(0.35)),
        since,
        rock: r,
      });
      const went = step(0.5, goes.mul(mine));
      beats = beats.add(rise.mul(floor(own(21.3).mul(model.kick[1] - model.kick[0] + 1)).add(model.kick[0])).add(fall.mul(floor(own(22.9).mul(model.kick[1] - model.kick[0])).add(model.kick[0]))).mul(went));
    }
    bold = bold.toVar();
    // home: under the body as it goes by, a little way off its skin
    let along = fa.x
      .mul(pitch)
      .add(wob(t, 7.7, 1, 2).mul(0.15).mul(U.wander))
      .add(wob(t, 11.9, 3, 3).mul(0.03).mul(U.wander)) as N;
    let th = turn.add(wob(t, 3.1, 1, 2).mul(bold.mul(0.7).add(0.3)).mul(0.3).mul(U.wander)) as N;
    for (const o of outs) {
      along = mix(along, o.along, o.out);
      th = mix(th, o.round, o.out).add(o.arcRound);
    }
    // a dart is a way in space: so far along, so far round, so far out
    along = along.add(dot(dart, axis)).toVar();
    th = th.add(dot(dart, across.mul(sin(turn).negate()).add(depth.mul(cos(turn)))).div(0.7)).toVar();
    const place = t.add(along.div(pitch));
    // what is in the way, at that place along and that way round: the weed, where it has grown to (and its
    // fronds, a tenth more than its skin), and a rock, which is the skin's own shape at its place, a little
    // smaller, and comes to an end before and behind. The skin as stems.ts keeps it for this: with nothing
    // sudden in it, or a fish by the monkey's chin is thrown out and let back as the chin goes by
    const skin = stems.bulkAt(th, place).toVar();
    let solid = skin.mul(1.1).mul(smoothstep(-0.1, 0.3, along.div(pitch)).oneMinus()) as N;
    for (const o of outs) {
      // (its ends come on gently: an end that is there all at once shoves a fish waiting at the front, the
      // moment the monkey's chin gets to it)
      const off = along.add(o.since.mul(pitch)).div(o.rock.long).abs();
      solid = max(solid, skin.mul(0.92).mul(smoothstep(0.7, 1.2, off).oneMinus()).mul(o.rock.on));
    }
    solid = solid.toVar();
    // how far out: at home, a little off what is there, and further when it is bold; at a rock, its place there.
    // And never nearer than a clear space to what is in the way, wherever it is and whatever it is doing: a fish
    // that went through the weed or the stone was seen to vanish and come back
    let far = solid
      .add(0.05)
      .add(bold.mul(fa.z.mul(0.5).add(0.06)))
      .add(wob(t, 5.3, 2, 2).mul(bold).mul(0.05)) as N;
    for (const o of outs) far = mix(far, o.far, o.out).add(o.arcOut);
    far = far.add(dot(dart, er(turn)));
    const least = solid.add(CLEAR);
    const h = far.sub(least).abs().div(0.08).oneMinus().max(0);
    far = max(far, least).add(h.mul(h).mul(0.02));
    return vec4(axis.mul(along).add(stems.spine(place)).add(er(th).mul(far)), beats);
  };

  const kinds = models.map((model, k) => {
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(model.position, 3));
    geometry.setAttribute("normal", new BufferAttribute(model.normal, 3));
    geometry.setAttribute("uv", new BufferAttribute(model.uv, 2));
    geometry.setIndex(new BufferAttribute(model.position.length / 3 > 65535 ? Uint32Array.from(model.index) : Uint16Array.from(model.index), 1));
    const data = new Float32Array(most * 12);
    for (const [i, row] of rows.entries()) data.set(row, (k % 2 ? most - 1 - i : i) * 12);
    const buffer = new InstancedInterleavedBuffer(data, 12);
    geometry.setAttribute("fa", new InterleavedBufferAttribute(buffer, 4, 0));
    geometry.setAttribute("fb", new InterleavedBufferAttribute(buffer, 4, 4));
    geometry.setAttribute("fc", new InterleavedBufferAttribute(buffer, 4, 8));
    geometry.instanceCount = 0;

    const normal = varyingProperty("vec3", "fishNormal") as V3;
    const position = Fn(() => {
      // which way it is going: in the water, which goes back past this frame at the speed of the growth. From where
      // it was and will be a seventh of a second either side, so that it comes round to a new way and is not at once on it
      const e = 0.012;
      const was = where(phase.sub(e), model).toVar(),
        now = where(phase, model).toVar(),
        will = where(phase.add(e), model).toVar();
      const water = axis.mul(pitch.mul(e));
      const h1 = now.xyz.sub(was.xyz).add(water).toVar(),
        h2 = will.xyz.sub(now.xyz).add(water).toVar();
      // a fish that is hardly moving in the water has no way it is going, and the least thing would spin it. It
      // has a way it likes to face, though: into the water coming at it, which here is up the growth. That is
      // added, as a third of the growth's speed, so a fish comes about only as fast as it could at that speed
      const stay = axis.mul(pitch.mul(e * STAY));
      const g1 = h1.add(stay).toVar(),
        g2 = h2.add(stay).toVar();
      const going = normalize(g1.add(g2)).toVar();
      // and none stands on its head or its tail: it goes up and down at a slant
      const flat = normalize(vec2(going.x, going.z).add(vec2(axis.x, axis.z).mul(1e-4)));
      const up = clamp(going.y, -STEEP, STEEP).toVar();
      const level = up.mul(up).oneMinus().sqrt();
      const ahead = vec3(flat.x.mul(level), up, flat.y.mul(level)).toVar();
      const aside = normalize(cross(vec3(0, 1, 0), ahead)).toVar();
      const above = cross(ahead, aside).toVar();
      // how fast, where 1 is the growth's speed, and how much faster than a moment ago
      const l1 = length(h1).toVar(),
        l2 = length(h2).toVar();
      const fast = l1.add(l2).div(pitch.mul(2 * e));
      const gains = l2.sub(l1).div(pitch.mul(e));
      // how far it has come round in that time: its body lies along its path, so nose and tail are both inside the turn
      const least = pitch.mul(e * STAY);
      const round = dot(cross(g1, g2), above).div(max(length(g1).mul(length(g2)), least.mul(least)));
      const bend = clamp(round.mul(2.6), -0.9, 0.9);
      const rest = positionGeometry as V3;
      const back = rest.x.oneMinus().sub(0.5).toVar(); // 0 at the nose, 1 at the tail
      // the beat runs down it to the tail: wide when it gathers speed, hardly there when it glides
      const turns = phase.mul(floor(fc.y.mul(model.pace))).add(now.w).add(fa.w);
      const beat = sin(turns.mul(TAU).sub(back.mul(5)));
      const wide = min(
        min(fast, 2.5)
          .mul(0.045)
          .add(0.035)
          .mul(clamp(gains, -0.22, 1.2).mul(3).add(1)),
        0.3,
      );
      let local = rest;
      if (model.swum) {
        // its own swimming: where the point is at this moment of it, between the two moments kept either side;
        // and more or less of that than was kept, as it swims harder or hardly at all
        const { map, frames } = model.swum;
        const at = fract(turns).mul(frames).toVar();
        const a = floor(at).toVar();
        const one = (k: N) => textureLoad(map, ivec2(int(vertexIndex), int(mod(k, frames)))).xyz as V3;
        const posed = mix(one(a), one(a.add(1)), at.sub(a));
        local = rest.add(posed.sub(rest).mul(clamp(wide.div(0.08), 0.5, 1.9))).toVar() as V3;
      }
      const sideways = local.z.add(model.swum ? float(0) : beat.mul(pow(max(back, 0), model.stiff)).mul(wide).mul(model.beat)).add(bend.mul(local.x.mul(local.x).sub(0.06)));
      const n = attribute("normal", "vec3") as V3;
      normal.assign(ahead.mul(n.x).add(above.mul(n.y)).add(aside.mul(n.z)));
      return now.xyz.add(
        ahead
          .mul(local.x)
          .add(above.mul(local.y))
          .add(aside.mul(sideways))
          .mul(fc.x)
          .mul(U.size.mul(model.size)),
      );
    })();

    const lit = Fn(() => {
      const pos = positionWorld;
      const V = normalize(cameraPosition.sub(pos));
      const L = light.U.dir;
      const n = normalize(normal).toVar();
      n.mulAssign(sign(dot(n, V).add(1e-5)));
      const at = positionGeometry as V3;
      let hue: V3,
        silver: N = float(0);
      if (model.map) {
        const paint = texture(model.map, uv());
        hue = paint.rgb as V3;
        // a model's own paint does not say where it is silvery: its white is taken to be, half as much
        const bright = max(max(hue.x, hue.y), hue.z);
        const coloured = bright.sub(min(min(hue.x, hue.y), hue.z)).div(max(bright, 1e-4));
        silver = (model.silver === "alpha" ? paint.a.mul(paint.a) : smoothstep(0.15, 0.45, coloured).oneMinus().mul(smoothstep(0.25, 0.6, bright)).mul(0.5)).mul(U.sheen) as N;
      } else {
        // orange: paler below, darker along the fins and the edge of the tail; an eye
        const eye = smoothstep(0.016, 0.026, length(vec2(at.x.sub(0.36), at.y.sub(0.035))));
        hue = vec3(1, 0.36, 0.03)
          .mul(mix(float(1), float(1.3), smoothstep(0.03, -0.14, at.y)))
          .mul(mix(float(1), float(0.5), smoothstep(0.2, 0.27, at.y.abs())))
          .mul(mix(float(1), float(0.6), smoothstep(-0.42, -0.5, at.x)))
          .mul(eye.mul(0.96).add(0.04));
      }
      // the film: a colour that goes round with the angle the skin is seen at, with the angle the sun is at, and a
      // little with the place on the fish, so that it runs over it as it turns. Pale, as mother of pearl is
      const H = normalize(L.add(V));
      const round_ = dot(n, V).oneMinus().mul(1.5).add(dot(n, H).mul(0.8)).add(at.x.mul(0.35)).add(at.y.mul(0.5));
      const film = cos(round_.add(vec3(0, 0.33, 0.67)).mul(TAU)).mul(0.5).add(0.5);
      const albedo = hue.mul(U.colour).mul(model.pale).mul(mix(vec3(1), film.mul(0.9).add(0.5), silver.mul(0.38)));
      // what gets through the weed to it is taken over a patch the size of the fish, and not at the point: the
      // edge of a frond's shadow, or the rock's, goes over a fish in two frames, and a pale fish was seen to flicker
      const wide1 = normalize(cross(L, vec3(0, 1, 0))).toVar(),
        wide2 = cross(L, wide1).toVar();
      const patch = U.size.mul(0.085 * model.size);
      let got = light.through(pos) as V3;
      for (const [x, y] of PATCH) got = got.add(light.throughWater(pos.add(wide1.mul(patch.mul(x))).add(wide2.mul(patch.mul(y))))) as V3;
      const through = got.div(PATCH.length + 1).toVar();
      const sun = shade.U.sunColor
        .mul(shade.U.sun)
        .mul(light.gathered(pos, shade.U.webBlur))
        .mul(through);
      // a small fish is lit all round: its side away from the sun is not half so dark as a stone's, with the water
      // and the weed about it bright, and its fins let the light through
      const front = saturate(dot(n, L).mul(0.5).add(0.5)).mul(0.55).add(0.45).mul(U.gain);
      // silver is a mirror of sorts: a broad shine in the film's colour, besides the small white one
      const glint = pow(saturate(dot(n, H)), 36)
        .mul(0.3)
        .add(film.mul(pow(saturate(dot(n, H)), 5)).mul(silver).mul(0.35));
      const dim = dot(through, vec3(0.3, 0.5, 0.2)).mul(0.6).add(0.4);
      const round = shade.sky(n).mul(albedo.add(film.mul(silver).mul(0.12))).mul(1.1);
      return vec4(sun.mul(albedo.mul(front).add(glint)).add(round.mul(dim).mul(shade.U.ambient)).add(albedo.mul(U.shine)), 1);
    })();
    const material = new NodeMaterial();
    material.side = DoubleSide;
    material.positionNode = position;
    material.fragmentNode = lit;
    return { geometry, material };
  });

  // how many of each kind are shown
  const show = (counts: number[]) => {
    for (const [k, kind] of kinds.entries()) kind.geometry.instanceCount = Math.max(0, Math.min(most, Math.round(counts[k] ?? 0)));
  };
  // the rocks there are (rock.ts' `there`): up to two
  const about = (rocks: { at: number; off: Vector3; reach: number; long: number }[]) => {
    for (const [k, r] of U.rocks.entries()) {
      const one = rocks[k];
      r.on.value = one ? 1 : 0;
      r.half.value = rocks.length > 1 ? k + 1 : 0;
      if (!one) continue;
      r.at.value = one.at;
      r.long.value = one.long;
      r.reach.value = one.reach;
      // the weed touches it when its near end is at the front, and the boldest parts of the front a little before
      r.touch.value = -one.long / stems.options.pitch - 0.02;
    }
  };
  // where the shade is, given the way to the sun and the way to the eye
  const face = (sun: Vector3, eye: Vector3) => {
    const turnTo = (v: Vector3) => Math.atan2(v.dot(stems.depth), v.dot(stems.across));
    const shaded = turnTo(sun) + Math.PI;
    U.shaded.value = shaded;
    U.eye.value = turnTo(eye);
    U.eyeward.value = Math.sin(turnTo(eye) - shaded) >= 0 ? 1 : -1;
  };
  return { kinds, U, show, about, face, most };
}
