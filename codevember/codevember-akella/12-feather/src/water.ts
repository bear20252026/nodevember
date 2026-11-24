// The sea the flock skims: flat, and a mirror, but a mirror that the swell has cut into strips. Each strip
// shows the sky and the birds slipped a little to one side, more the nearer it is; far off, where the strips
// are too thin to see, it is glass. That is how a painted sea shows a reflection: in stacked bands.
//
// The picture in the mirror is the real scene drawn a second time, from where the camera's own reflection
// would stand below the surface. (three's reflector does the same, but into a plain target, and the birds'
// materials write a second sheet beside the picture: so it is a pass of its own, set up as the main one is.)
//
// From as low as the camera stands, flat water shows only the sky just over the horizon, and the birds are far
// above that: their images lie below the bottom of the frame. So in this second picture the birds are drawn
// flying low over the water (`low` in shade.ts), each under where it really is, and the sea shows them.
// The strips are noise that repeats along the line of flight and slides back as the birds fly on.
//
// On top of the mirror the sea is painted as a background painter does it: short level dashes of light and
// of shadow, large far off and small close to, each size dropped where it would be finer than a pixel. Under
// the sun they crowd together and take its colour: the glitter path, from the horizon down towards the viewer.
import * as TSL from "three/tsl";
import { Color, Mesh, MeshBasicNodeMaterial, PerspectiveCamera, PlaneGeometry, Vector3 } from "three/webgpu";
import type { Scene } from "three/webgpu";
import { vnoise } from "./sky.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { cameraPosition, dot, float, fwidth, length, max, mix, mrt, normalize, output, pass, positionWorld, pow, screenUV, smoothstep, uniform, vec2, vec4 } = T;

export const SEA_PERIOD = 24; // metres along the line of flight after which the swell repeats
export const ABOVE = 1; // the layer the water is on: the camera sees it, its reflection does not

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createWater(level: number, scene: Scene, sunDir: any) {
  const u = {
    tint: uniform(new Color("#1a45a6")), // the sea's own colour
    depth: uniform(0.3), // how much of that shows through the mirror
    near: uniform(0.75), // and how much more close to, where one looks down into it
    sway: uniform(0.035), // how far a strip slips sideways, as a share of the frame
    slide: uniform(0), // metres the sea has slid back
    dashes: uniform(0.5), // how strongly the dashes of light and shadow are painted
    light: uniform(new Color("#cfe6ff")), // the light ones
    glitter: uniform(0.9), // how thick and bright they get under the sun
    sun: uniform(new Color("#fffdf0")),
    haze: uniform(0.3), // how far the sea pales towards the horizon
    pale: uniform(new Color("#5f9ee6")),
    birds: uniform(0), // how far the birds in the mirror are sunk into the sea's colour
  };
  const eye = new PerspectiveCamera(); // the camera's reflection
  const seen = pass(scene, eye);
  seen.setMRT(mrt({ output, mask: vec4(0) }));
  const mirror = seen.getTextureNode("output");
  const marked = seen.getTextureNode("mask"); // where that picture is bird (the birds write it themselves)

  const p = positionWorld;
  const along = p.x.add(u.slide);
  const far = length(p.xz.sub(cameraPosition.xz));
  // strips: long along the line of flight, thin across it, in two sizes
  const cut = (k: number, seed: number) => vnoise(vec2(along.mul(k / SEA_PERIOD), p.z.mul(k * 0.09).add(seed)), float(k));
  const slip = cut(6, 1.7).sub(0.5).mul(0.7).add(cut(18, 5.3).sub(0.5).mul(0.3));
  // glass far off, broken close to
  const rough = smoothstep(90, 6, far);
  // (the reflection is drawn left for right, as any mirror image is when you stand behind it)
  const at = vec2(float(1).sub(screenUV.x), screenUV.y).add(vec2(slip.mul(u.sway).mul(rough), slip.mul(u.sway).mul(rough).mul(0.25)));

  const material = new MeshBasicNodeMaterial();
  const down = pow(smoothstep(40, 3, far), 1.5); // close to, one looks down into it
  const still = mix(mirror.sample(at).xyz, u.tint, max(mix(u.depth, u.near, down), marked.sample(at).x.mul(u.birds)));
  // dashes: `count` of them along one length of sea, each `deep` metres from front to back. The eye is so low
  // that a metre of depth is a few pixels and a metre of width a hundred, so a dash that is drawn level and
  // thin is, on the water, far deeper than it is wide; and each size suits one distance, where its depth is
  // some pixels: nearer it would be a slab and further a shimmer, so it is dropped on both sides
  const dash = (count: number, deep: number, seed: number) => {
    const n = vnoise(vec2(along.mul(count / SEA_PERIOD), p.z.div(deep).add(seed)), float(count));
    const w = fwidth(n);
    return { n, soft: max(w, 0.012), keep: smoothstep(0.42, 0.2, w).mul(smoothstep(0.025, 0.06, w)) };
  };
  // where the sun's light comes off the water towards the eye: a column under it, all the way to the horizon
  const column = smoothstep(0.9915, 0.9996, dot(normalize(p.xz.sub(cameraPosition.xz)), normalize(sunDir.xz))).mul(u.glitter);
  const sizes: [number, number][] = [
    [78, 0.5],
    [47, 1.4],
    [28, 4],
    [16, 12],
    [9, 40],
    [5, 135],
  ];
  let lit = float(0);
  let dark = float(0);
  sizes.forEach(([count, deep], i) => {
    const a = dash(count, deep, 3.1 + i * 7.7);
    const b = dash(count, deep, 40.3 + i * 5.9);
    const from = mix(0.74, 0.47, column);
    lit = max(lit, smoothstep(from, from.add(a.soft), a.n).mul(a.keep));
    dark = max(dark, smoothstep(float(0.27), float(0.27).sub(b.soft), b.n).mul(b.keep));
  });
  const hazed = mix(still, u.pale, smoothstep(30, 400, far).mul(u.haze));
  const shaded = mix(hazed, u.tint.mul(0.75), dark.mul(u.dashes).mul(float(1).sub(column)));
  material.colorNode = mix(shaded, mix(u.light, u.sun, column), lit.mul(mix(u.dashes, 1, column)));
  const mesh = new Mesh(new PlaneGeometry(900, 900), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = level;
  mesh.frustumCulled = false;
  mesh.layers.set(ABOVE);

  const ahead = new Vector3();
  const top = new Vector3();
  // stand the reflection where the camera would be seen in the water
  const follow = (camera: PerspectiveCamera) => {
    eye.projectionMatrix.copy(camera.projectionMatrix);
    eye.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    camera.getWorldDirection(ahead).add(camera.position);
    top.setFromMatrixColumn(camera.matrixWorld, 1);
    eye.position.set(camera.position.x, 2 * level - camera.position.y, camera.position.z);
    eye.up.set(top.x, -top.y, top.z);
    eye.lookAt(ahead.x, 2 * level - ahead.y, ahead.z);
    eye.updateMatrixWorld();
  };
  return { mesh, follow, u };
}
