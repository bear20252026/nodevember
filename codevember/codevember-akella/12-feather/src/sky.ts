// The backdrop: a deep blue sky that pales to the horizon, a sun with its rings and rays, and towering
// cumulus standing on the sea.
//
// The cumulus can be a painting (public/sky.jpg, see README): it is hung round the horizon behind the
// flock, mirrored where it runs out so it never shows an edge. Until there is one, it is made here: drawn
// once into a panorama as, per pixel, a signed "how far inside the cloud" and a light value for two layers,
// and thresholded at draw time into three flat tones, so the edges stay crisp at any zoom.
// The sun too can be a painting (public/sun.png): a square of light on black, added to the sky where the sun is.
// The clouds do not move: they are far off, and the camera travels with the birds. What slides is the sea.
import * as TSL from "three/tsl";
import { ClampToEdgeWrapping, Color, DataTexture, HalfFloatType, LinearFilter, NodeMaterial, QuadMesh, RenderTarget, RepeatWrapping, SRGBColorSpace } from "three/webgpu";
import type { Texture, WebGPURenderer } from "three/webgpu";
import type { N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { abs, atan, clamp, cos, cross, dot, exp, float, floor, Fn, fract, length, max, min, mix, mod, normalize, sin, smoothstep, sqrt, texture, uniform, uv, vec2, vec3, vec4 } = T;

const EL0 = -2; // the made panorama spans these elevations, degrees
const EL1 = 46;
export const CLOUD_WIDTH = 120; // and this much of the horizon, repeating
const PANO: [number, number] = [4096, 1024];
const RANGE = 8; // the "inside" value is kept to ±RANGE/2 degrees

const hash2 = (p: N) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const hash22 = (p: N) => fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))).mul(43758.5453));
// value noise whose x wraps every `period` cells
export const vnoise = Fn(([p, period]: [N, N]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const wrap = (c: N) => vec2(mod(c.x, period), c.y);
  const a = hash2(wrap(i));
  const b = hash2(wrap(i.add(vec2(1, 0))));
  const c = hash2(wrap(i.add(vec2(0, 1))));
  const d = hash2(wrap(i.add(vec2(1, 1))));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
});
// distance to the nearest of a scatter of points, one per cell, wrapping in x: 1 - this is a field of round bumps
const worley = Fn(([p, period]: [N, N]) => {
  const i = floor(p).toVar();
  const f = fract(p).toVar();
  const d = float(4).toVar();
  for (let y = -1; y <= 1; y++)
    for (let x = -1; x <= 1; x++) {
      const g = vec2(x, y);
      const c = i.add(g);
      const r = g.add(hash22(vec2(mod(c.x, period), c.y))).sub(f);
      d.assign(min(d, dot(r, r)));
    }
  return sqrt(d);
});
const billow = (p: N, octaves: number, period: number) => {
  let sum: N = float(0);
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum = sum.add(
      float(1)
        .sub(worley(p.mul(freq).add(vec2(0, o * 7.7)), float(period * freq)))
        .mul(amp),
    );
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
};

export function createSky(renderer: WebGPURenderer, sunDir: N) {
  const col = (hex: string) => uniform(new Color(hex));
  const u = {
    zenith: col("#1d4db6"),
    horizon: col("#5f9ee6"),
    cloudLight: col("#ffffff"),
    cloudMid: col("#cfe4fb"),
    cloudShade: col("#7fb0ec"),
    sea: col("#1b47a8"), // what the sky gives way to below the horizon, where the water is not drawn
    sun: col("#fffdf2"),
    cloud: uniform(0.5), // how much cumulus, when it is made here
    spin: uniform(0), // the sun's rays turn, radians
    sunPainted: uniform(0), // 1 once there is a painted sun
    sunWide: uniform(40), // how much sky its square covers, degrees
    sunGain: uniform(1), // how bright it is laid on
    lit: uniform(1), // which side the clouds are lit from: +1 or -1 along the panorama
    painted: uniform(0), // 1 once there is a painting
    middle: uniform(0), // the azimuth, degrees, that the painting's middle hangs at
    wide: uniform(58), // how much of the horizon it covers, degrees
    tall: uniform(29), // and how high it reaches
  };

  // ---- the made cumulus
  const target = new RenderTarget(PANO[0], PANO[1], { type: HalfFloatType, depthBuffer: false });
  target.texture.wrapS = RepeatWrapping;
  target.texture.minFilter = LinearFilter;
  target.texture.magFilter = LinearFilter;
  target.texture.generateMipmaps = false;

  // how far inside a cloud, in degrees of sky (its top line minus this elevation, plus the cauliflower),
  // and the cauliflower itself, whose bumps are what catches the light. cells: how many across the panorama
  const inside = (az: N, el: N, cells: number, masses: number, seed: number, base: number, tower: number, puff: number, more: number) => {
    const cell = CLOUD_WIDTH / cells;
    const x = az.div(cell);
    const y = el.div(cell);
    const mass = vnoise(vec2(x.mul(masses / cells), seed), float(masses));
    const lump = vnoise(vec2(x, seed * 2.3 + 5.1), float(cells));
    // broad masses with sloping shoulders: where there is cloud at all, and how high it has grown
    const body = mass.mul(0.75).add(lump.mul(0.25));
    const from = float(0.7 - more).sub(u.cloud.mul(0.4));
    const cover = smoothstep(from, from.add(0.2), body);
    const grown = smoothstep(from.add(0.05), from.add(0.42), body);
    const top = cover.mul(grown.mul(tower).add(base)).sub(float(1).sub(cover).mul(12));
    // (1.5 keeps the wrap a whole number of cells, so the panorama closes without a seam)
    const at = vec2(x, y.mul(1.15))
      .mul(1.5)
      .add(vec2(0, seed * 3.1));
    const bumps = billow(at, 5, cells * 1.5);
    // only the big bumps take light, or the cloud turns to camouflage
    return { f: top.sub(el).add(bumps.sub(0.97).mul(puff)), bumps: billow(at, 3, cells * 1.5) };
  };
  // a low bank along the horizon, and great towers standing in front of it
  const layers = (az: N, el: N) => [inside(az, el, 24, 6, 1.7, 2.6, 3, 2.0, 0.3), inside(az, el, 12, 3, 6.3, 4, 11, 4.2, -0.02)];
  const bakeMat = new NodeMaterial();
  bakeMat.fragmentNode = Fn(() => {
    const q = uv();
    const az = q.x.mul(CLOUD_WIDTH);
    const el = mix(EL0, EL1, q.y);
    // the sun is up and to one side
    const to = normalize(vec2(u.lit.mul(0.75), 0.7));
    const here = layers(az, el);
    const step = [0.5, 1.5];
    const there = [0, 1].map((i) => layers(az.add(to.x.mul(step[i])), el.add(to.y.mul(step[i])))[i]);
    const enc = (f: N) => clamp(f.div(RANGE).add(0.5), 0, 1);
    // a bump is lit on the side that faces the sun; the rim that a step towards the sun would leave is
    // brightest; deep inside and low down it falls into shade
    const light = (i: number) =>
      clamp(
        float(0.55)
          .add(here[i].bumps.sub(there[i].bumps).mul(1.5))
          .add(smoothstep(0.3, -0.8, there[i].f).mul(0.3))
          .sub(smoothstep(0.6, 6, here[i].f).mul(0.42)),
        0,
        1,
      );
    return vec4(enc(here[0].f), light(0), enc(here[1].f), light(1));
  })();
  const quad = new QuadMesh(bakeMat);
  const bake = () => {
    renderer.setRenderTarget(target);
    quad.render(renderer);
    renderer.setRenderTarget(null);
  };
  const pano = texture(target.texture);

  // ---- the painting, if there is one (a blue pixel stands in until then)
  const blank = new DataTexture(new Uint8Array([40, 90, 190, 255]), 1, 1);
  blank.needsUpdate = true;
  const painting = texture(blank);
  const hang = (tex: Texture, wide: number, tall: number) => {
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    painting.value = tex;
    u.wide.value = wide;
    u.tall.value = tall;
    u.painted.value = 1;
  };

  // ---- the painted sun, if there is one: light on black, laid over the sky as light is (black adds nothing)
  const none = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  none.needsUpdate = true;
  const sunPicture = texture(none);
  const rise = (tex: Texture) => {
    tex.colorSpace = SRGBColorSpace;
    tex.wrapS = ClampToEdgeWrapping;
    tex.wrapT = ClampToEdgeWrapping;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    sunPicture.value = tex;
    u.sunPainted.value = 1;
  };

  // ---- what the sky looks like in direction d
  const color = (d: N) =>
    Fn(() => {
      const up = clamp(d.y, -1, 1).toVar();
      const flat = max(length(d.xz), 1e-4);
      const below = up.lessThan(0);
      // below the horizon the sky is seen as in a mirror (the water, where it is drawn, does this properly)
      const el = abs(atan(up, flat).mul(57.2958)).toVar();
      const az = atan(d.z, d.x).mul(57.2958).toVar();

      const air = mix(u.horizon, u.zenith, smoothstep(0.0, 0.62, abs(up)).pow(0.8)).toVar();

      // made cumulus, far layer then near: three flat tones, cut hard like paint on a cel
      const p = pano.sample(vec2(az.div(CLOUD_WIDTH), el.sub(EL0).div(EL1 - EL0))).toVar();
      const inBand = smoothstep(EL1 - 1, EL1 - 6, el);
      const paintCloud = (f: N, light: N, depth: number) => {
        const tone = mix(u.cloudShade, u.cloudMid, smoothstep(0.37, 0.39, light)).toVar();
        tone.assign(mix(tone, u.cloudLight, smoothstep(0.55, 0.57, light)));
        // the further layer sinks into the air
        tone.assign(mix(tone, u.horizon, depth));
        return { tone, alpha: smoothstep(0.0, 0.08, f.sub(0.5).mul(RANGE)).mul(inBand) };
      };
      const farC = paintCloud(p.r, p.g, 0.38);
      const nearC = paintCloud(p.b, p.a, 0.0);
      const made = mix(mix(air, farC.tone, farC.alpha), nearC.tone, nearC.alpha);

      // or the painting: its foot on the horizon, its middle behind the flock; above its top the sky carries on
      const turn = mod(az.sub(u.middle).add(540), 360).sub(180);
      // (where it runs out sideways it turns back on itself: no edge, whatever was painted)
      const across = mod(turn.div(u.wide).add(0.5), 2);
      const hung = painting.sample(vec2(clamp(float(1).sub(abs(across.sub(1))), 0.002, 0.998), clamp(el.div(u.tall), 0.002, 0.998))).xyz;
      const sky = mix(made, mix(hung, air, smoothstep(u.tall.mul(0.9), u.tall.mul(1.25), el)), u.painted).toVar();

      // the sun: a disc, two flat rings of glare round it, and rays that turn slowly, long and short by turns
      const s = dot(d, sunDir);
      const ang = sqrt(max(float(1).sub(s), 0).mul(2)).mul(57.2958); // degrees from the sun
      const t1 = normalize(cross(sunDir, vec3(0, 1, 0)));
      const t2 = cross(sunDir, t1);
      const round = atan(dot(d, t1), dot(d, t2)).add(u.spin);
      const long = smoothstep(0.9, 0.94, cos(round.mul(12))).mul(mix(0.55, 1, smoothstep(-0.2, 0.2, cos(round.mul(6)))));
      const reach = mix(9.5, 15, smoothstep(-0.2, 0.2, cos(round.mul(6))));
      const rays = long.mul(float(1).sub(smoothstep(reach.mul(0.5), reach, ang))).mul(0.22);
      const glare = float(1)
        .sub(smoothstep(1.7, 1.83, ang))
        .add(
          float(1)
            .sub(smoothstep(3.6, 3.75, ang))
            .mul(0.42),
        )
        .add(
          float(1)
            .sub(smoothstep(6.3, 6.5, ang))
            .mul(0.2),
        )
        .add(exp(ang.div(-7)).mul(0.2))
        .add(rays);
      const ringed = mix(sky, u.sun, clamp(glare, 0, 1));
      // the painted one: its middle on the sun, upright, `spin` turning it about that; faded out at its edge
      // so that a picture whose rays reach the border does not end in a square
      const out = ang.div(u.sunWide);
      const lie = vec2(dot(d, t1), dot(d, t2).negate());
      const way = lie.div(max(length(lie), 1e-5));
      const turned = vec2(way.x.mul(cos(u.spin)).sub(way.y.mul(sin(u.spin))), way.x.mul(sin(u.spin)).add(way.y.mul(cos(u.spin))));
      const light = sunPicture
        .sample(clamp(turned.mul(out).add(0.5), 0.002, 0.998))
        .xyz.mul(u.sunGain)
        .mul(float(1).sub(smoothstep(0.42, 0.5, out)));
      const drawn = float(1).sub(
        float(1)
          .sub(sky)
          .mul(float(1).sub(clamp(light, 0, 1))),
      );
      sky.assign(mix(ringed, drawn, u.sunPainted));
      // seen below the horizon it is darker and bluer, as water is
      return mix(sky, mix(sky, u.sea, 0.55), float(below));
    })();

  return { u, bake, color, hang, rise, target };
}
export type Sky = ReturnType<typeof createSky>;
