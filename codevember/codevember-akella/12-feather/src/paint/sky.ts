// The backdrop, painted rather than simulated: a deep blue sky, cumulus standing round the horizon with warm
// lit sides and lavender shade, thin cloud streaming overhead, shafts of light, and below a river plain
// sliding by: water, sandbars, meadow and trees, blue hills in the haze.
//
// The cumulus never moves (it is far away), so it is drawn once into a panorama: per pixel a signed "how far
// inside the cloud" and a light value, for two layers. Thresholding that at draw time keeps the edges crisp
// at any zoom and lets the colours change without redrawing. What does move (overhead cloud, the ground)
// is noise that repeats along the line of flight, so sliding it a whole number of periods loops exactly.
import * as TSL from "three/tsl";
import { Color, HalfFloatType, LinearFilter, NodeMaterial, QuadMesh, RenderTarget, RepeatWrapping } from "three/webgpu";
import type { WebGPURenderer } from "three/webgpu";
import type { Light, N } from "./shade.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { abs, atan, clamp, cross, dot, exp, float, floor, Fn, fract, length, max, min, mix, mod, normalize, pow, sin, smoothstep, sqrt, texture, uniform, uv, vec2, vec3, vec4 } = T;

const EL0 = -4; // the panorama spans these elevations, degrees
const EL1 = 60;
const PANO: [number, number] = [4096, 1024];
const RANGE = 8; // the "inside" value is kept to ±RANGE/2 degrees
export const GROUND_PERIOD = 12; // the ground repeats every this many heights flown
export const CLOUD_PERIOD = 8;

const hash2 = (p: N) => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));
const hash22 = (p: N) => fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))).mul(43758.5453));
// value noise whose x wraps every `period` cells
const vnoise = Fn(([p, period]: [N, N]) => {
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
const fbm = (p: N, octaves: number, period: number) => {
  let sum: N = float(0);
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum = sum.add(vnoise(p.mul(freq).add(vec2(0, o * 17.3)), float(period * freq)).mul(amp));
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
};
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

export function createSky(renderer: WebGPURenderer, L: Light) {
  const col = (hex: string) => uniform(new Color(hex));
  const u = {
    zenith: col("#1f5fd0"),
    horizon: col("#8cc4f5"),
    cloudLight: col("#fff6e2"),
    cloudMid: col("#eef0ff"),
    cloudShade: col("#9fb1ea"),
    sunTint: col("#ffe9b8"),
    haze: col("#cfe4fb"),
    water: col("#3f86d8"),
    meadow: col("#77b866"),
    trees: col("#3f8563"),
    sand: col("#efe6b6"),
    hill: col("#6f9ad6"),
    cloud: uniform(0.5), // how much cumulus
    wisp: uniform(0.4), // how much thin cloud overhead
    rays: uniform(0.5),
    travel: uniform(0), // overhead cloud, in its periods
    ground: uniform(0), // ground flown over, in heights
    sunAz: uniform(0), // degrees, for the cumulus light
    sunEl: uniform(40),
  };

  // ---- the cumulus panorama
  const target = new RenderTarget(PANO[0], PANO[1], { type: HalfFloatType, depthBuffer: false });
  target.texture.wrapS = RepeatWrapping;
  target.texture.minFilter = LinearFilter;
  target.texture.magFilter = LinearFilter;
  target.texture.generateMipmaps = false;

  // how far inside a cloud, in degrees of sky (its top line minus this elevation, plus the cauliflower),
  // and the cauliflower itself, whose bumps are what catches the light
  const inside = (az: N, el: N, cells: number, seed: number, base: number, tower: number, puff: number, more: number) => {
    const cell = 360 / cells;
    const x = az.div(cell).add(cells / 2);
    const y = el.div(cell);
    const mass = vnoise(vec2(x.mul(0.25), seed), float(cells / 4));
    const lump = vnoise(vec2(x, seed * 2.3 + 5.1), float(cells));
    // broad masses with sloping shoulders: where there is cloud at all, and how high it has grown
    const body = mass.mul(0.75).add(lump.mul(0.25));
    const from = float(0.7 - more).sub(u.cloud.mul(0.4));
    const cover = smoothstep(from, from.add(0.2), body);
    const grown = smoothstep(from.add(0.05), from.add(0.42), body);
    const top = cover.mul(grown.mul(tower).add(base)).sub(float(1).sub(cover).mul(5));
    // (1.5 keeps the wrap a whole number of cells, so the panorama closes without a seam)
    const at = vec2(x, y.mul(1.15))
      .mul(1.5)
      .add(vec2(0, seed * 3.1));
    const bumps = billow(at, 4, cells * 1.5);
    // only the big bumps take light, or the cloud turns to camouflage
    return { f: top.sub(el).add(bumps.sub(0.95).mul(puff)), bumps: billow(at, 2, cells * 1.5) };
  };
  // a low bank of small cloud nearly all the way round, and a few big towers in front of it
  const layers = (az: N, el: N) => [inside(az, el, 48, 1.7, 6.5, 7, 3.4, 0.24), inside(az, el, 24, 6.3, 6, 17, 7, 0.04)];
  const bakeMat = new NodeMaterial();
  bakeMat.fragmentNode = Fn(() => {
    const q = uv();
    const az = q.x.sub(0.5).mul(360);
    const el = mix(EL0, EL1, q.y);
    // which way the sun lies from here on the panorama; clouds are lit from above as well
    const dAz = mod(u.sunAz.sub(az).add(540), 360).sub(180);
    const to = normalize(vec2(clamp(dAz.div(50), -1, 1), clamp(u.sunEl.sub(el).div(50), -1, 1).add(0.55)));
    const here = layers(az, el);
    const step = [0.9, 1.7];
    const there = [0, 1].map((i) => layers(az.add(to.x.mul(step[i])), el.add(to.y.mul(step[i])))[i]);
    const enc = (f: N) => clamp(f.div(RANGE).add(0.5), 0, 1);
    // a bump is lit on the side that faces the sun; the rim that a step towards the sun would leave is
    // brightest; deep inside and low down it falls into shade
    const light = (i: number) =>
      clamp(
        float(0.52)
          .add(here[i].bumps.sub(there[i].bumps).mul(2.2))
          .add(smoothstep(0.3, -0.8, there[i].f).mul(0.3))
          .sub(smoothstep(1.0, 8, here[i].f).mul(0.3)),
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

  // ---- what the sky looks like in direction d
  const color = (d: N) =>
    Fn(() => {
      const up = clamp(d.y, -1, 1).toVar();
      const flat = max(length(d.xz), 1e-4);
      const el = atan(up, flat).mul(57.2958).toVar();
      const az = atan(d.z, d.x).mul(57.2958).toVar();
      const s = max(dot(d, L.sunDir), 0).toVar();

      const air = mix(u.horizon, u.zenith, pow(smoothstep(-0.02, 0.8, up), 0.62)).toVar();
      air.addAssign(u.sunTint.mul(pow(s, 6).mul(0.16).add(pow(s, 40).mul(0.25))));

      // thin cloud on a sheet high above, stretched along the wind, sliding back as the bird flies on
      const sheet = d.xz.div(max(up, 0.0).add(0.12));
      const q = vec2(sheet.x.mul(0.7).add(u.travel), sheet.y.mul(1.9).add(3.7));
      const warp = fbm(q.mul(0.5).add(vec2(0, 9.1)), 2, CLOUD_PERIOD / 2).sub(0.5);
      const n = fbm(q.add(vec2(0, warp.mul(1.6))), 5, CLOUD_PERIOD);
      const wisp = smoothstep(float(0.66).sub(u.wisp.mul(0.25)), 0.84, n).mul(smoothstep(0.1, 0.4, up));
      air.assign(mix(air, mix(u.cloudMid, u.cloudLight, pow(s, 2)), wisp.mul(0.7)));

      // cumulus, far layer then near: three tones and a warm flare towards the sun
      const p = pano.sample(vec2(az.div(360).add(0.5), el.sub(EL0).div(EL1 - EL0))).toVar();
      const inBand = smoothstep(EL1 - 2, EL1 - 8, el).mul(smoothstep(EL0, EL0 + 2, el));
      const paintCloud = (f: N, light: N, depth: number) => {
        const tone = mix(u.cloudShade, u.cloudMid, smoothstep(0.34, 0.5, light)).toVar();
        tone.assign(mix(tone, u.cloudLight, smoothstep(0.56, 0.7, light)));
        tone.addAssign(u.sunTint.mul(pow(s, 5).mul(0.22)));
        // the further layer sinks into the air, and every cloud's foot into the haze
        tone.assign(mix(tone, u.horizon, depth));
        tone.assign(mix(u.haze, tone, smoothstep(-1.0, 5.0, el)));
        return { tone, alpha: smoothstep(0.0, 0.3, f.sub(0.5).mul(RANGE)).mul(inBand) };
      };
      const farC = paintCloud(p.r, p.g, 0.5);
      const nearC = paintCloud(p.b, p.a, 0.2);
      air.assign(mix(air, farC.tone, farC.alpha));
      air.assign(mix(air, nearC.tone, nearC.alpha));

      // shafts of light fanning from the sun
      const t1 = normalize(cross(L.sunDir, vec3(0, 1, 0)));
      const t2 = cross(L.sunDir, t1);
      const fan = atan(dot(d, t1), dot(d, t2)).div(6.2832).add(0.5);
      const ray = vnoise(vec2(fan.mul(36), 0.5), float(36))
        .mul(0.6)
        .add(vnoise(vec2(fan.mul(108), 3.5), float(108)).mul(0.4));
      const shafts = smoothstep(0.5, 0.85, ray)
        .mul(pow(s, 3))
        .mul(float(1).sub(pow(s, 60)))
        .mul(u.rays);
      air.addAssign(u.sunTint.mul(shafts).mul(0.5));

      // far hills, two ranges, standing in the haze
      const hills = (cells: number, seed: number, h0: number, h1: number, depth: number) => {
        const x = az.div(360 / cells).add(cells / 2);
        const h = fbm(vec2(x, seed), 3, cells).mul(h1).add(h0);
        const tone = mix(u.hill, u.haze, depth);
        return { tone: mix(u.haze, tone, smoothstep(-0.3, h0 + h1 * 0.5, el)), alpha: smoothstep(0.0, 0.06, h.sub(el)) };
      };
      const h1 = hills(40, 2.2, 0.6, 3.6, 0.6);
      const h2 = hills(28, 8.4, 0.15, 2.6, 0.3);
      air.assign(mix(air, h1.tone, h1.alpha));
      air.assign(mix(air, h2.tone, h2.alpha));

      // ---- the plain below, in units of the bird's height above it
      const dn = max(up.negate(), 0.003);
      const far = float(1).div(dn);
      const gx = d.x.div(dn).add(u.ground);
      const gz = d.z.div(dn);
      const k = 6.2832 / GROUND_PERIOD;
      // the river under the bird, winding a little; backwaters either side; bars of sand in the stream
      const centre = sin(gx.mul(k))
        .mul(0.9)
        .add(sin(gx.mul(k * 2).add(1.3)).mul(0.35));
      const half = sin(gx.mul(k).add(2.1)).mul(0.5).add(2.4);
      const river = abs(gz.sub(centre)).sub(half);
      const pond = fbm(vec2(gx.mul(0.5), gz.mul(1.25).add(4.1)), 3, GROUND_PERIOD / 2)
        .sub(0.37)
        .mul(4);
      const bar = fbm(vec2(gx.mul(0.5).add(3.3), gz.mul(0.9).add(1.7)), 2, GROUND_PERIOD / 2)
        .sub(0.62)
        .mul(4);
      const land = max(min(river, pond), min(bar, river.negate().sub(0.35))).toVar();
      const soft = far.mul(0.012).add(0.02);
      const wet = float(1).sub(smoothstep(soft.negate(), soft, land));
      const patch = fbm(vec2(gx.mul(1.5), gz.mul(1.5)), 3, GROUND_PERIOD * 1.5);
      const wood = smoothstep(0.52, 0.58, fbm(vec2(gx.mul(2).add(7.7), gz.mul(2.4)), 3, GROUND_PERIOD * 2)).mul(smoothstep(0.1, 0.4, land));
      const green = mix(u.meadow, u.meadow.mul(vec3(1.18, 1.12, 0.8)), smoothstep(0.35, 0.7, patch)).toVar();
      green.assign(mix(green, u.trees, wood));
      green.assign(mix(u.sand, green, smoothstep(0.03, 0.14, land)));
      // water holds the sky: deep looking down, pale and bright at a glancing angle, sparkling under the sun
      const mirror = vec3(d.x, d.y.negate(), d.z);
      const glance = pow(float(1).sub(dn), 6);
      const pool = mix(u.water, u.horizon.mul(1.06), glance).toVar();
      const toSun = max(dot(mirror, L.sunDir), 0);
      const spark = smoothstep(0.8, 0.95, vnoise(vec2(gx.mul(30), gz.mul(50)), float(GROUND_PERIOD * 30))).mul(float(1).sub(smoothstep(3, 14, far)));
      pool.addAssign(u.sunTint.mul(pow(toSun, 120).mul(0.8).add(pow(toSun, 26).mul(spark).mul(1.5))));
      const ground = mix(green, pool, wet).toVar();
      // distance turns everything to haze, with a low mist lying on it
      const mist = fbm(vec2(gx.mul(0.25), gz.mul(0.6).add(9.3)), 2, GROUND_PERIOD / 4);
      const fog = float(1).sub(exp(far.mul(-0.03).mul(mist.add(0.5))));
      ground.assign(mix(ground, u.haze, fog));
      const low = smoothstep(0.0, -0.25, el);
      const scene = mix(air, ground, low).toVar();

      const disc = pow(s, 6000).mul(6).add(pow(s, 400).mul(0.35));
      return scene.add(u.sunTint.mul(disc).mul(float(1).sub(low)));
    })();

  return { u, bake, color, target };
}
export type Sky = ReturnType<typeof createSky>;
