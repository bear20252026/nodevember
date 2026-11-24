// Shared light for everything on the bird, drawn the way a background painter would: a warm light tone, a
// cool shade tone, and a glow where the sun comes through a feather. No three lights: one sun and a map
// rendered from it that counts how much feather (and whether any solid body) lies along each sun ray.
//
// The map holds three sums over the feathers a sun ray crosses (drawn additively, so order never matters):
//   r = Σ τ   optical depth of the vanes      g = Σ τ·z      b = Σ τ·z²   (z = distance along the ray, from the bird's middle)
// and in alpha the nearest solid (body, legs) along the ray, kept with a "min" blend.
// τ gives the light coming through the wing (one vane glows, two are dimmer, the coverts stay in shade); the
// mean and spread of z tell a point how much of that τ lies above it rather than being its own.
import * as TSL from "three/tsl";
import { Color, Vector3 } from "three/webgpu";
import type { Texture } from "three/webgpu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { abs, cameraPosition, clamp, dot, exp, float, Fn, max, mix, normalize, pow, smoothstep, texture, uniform, vec2, vec4, select } = T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type N = any;

export interface Light {
  sunDir: N; // towards the sun
  lx: N; // light map axes (world)
  ly: N;
  extent: N; // half size of the light map, metres
  through: N; // one vane lets 1 / (1 + through) of the sun past
  shadow: N; // how hard feathers shade what is below them
  glow: N; // how readily light coming through turns a feather warm
  lightTone: N; // in the sun
  shadeTone: N; // out of it
  glowTone: N; // sun through a vane
  deepTone: N; // multiplies whatever is tucked under something else
  lineTone: N; // multiplies the surface where a line is drawn
  edge: N; // where light turns to shade, 0..1
  soft: N; // how soft that turn is
  rim: N; // warm edge where the sun is behind a solid
  mapNode: N;
  texel: N;
}

export function createLight(map: Texture): Light {
  return {
    sunDir: uniform(new Vector3(0, 1, 0)),
    lx: uniform(new Vector3(1, 0, 0)),
    ly: uniform(new Vector3(0, 0, 1)),
    extent: uniform(1),
    through: uniform(1.2),
    shadow: uniform(1.3),
    glow: uniform(1),
    lightTone: uniform(new Color(1, 1, 1)),
    shadeTone: uniform(new Color(0.7, 0.75, 0.95)),
    glowTone: uniform(new Color(1, 0.9, 0.65)),
    deepTone: uniform(new Color(0.8, 0.83, 0.95)),
    lineTone: uniform(new Color(0.6, 0.62, 0.78)),
    edge: uniform(0.42),
    soft: uniform(0.1),
    rim: uniform(0.8),
    mapNode: texture(map),
    texel: uniform(1 / 2048),
  };
}

// where a world point lands in the sun's map, and how deep along the ray
export const lightCoord = (L: Light, P: N) => {
  const uv = vec2(dot(P, L.lx), dot(P, L.ly).negate()).div(L.extent).mul(0.5).add(0.5);
  const z = dot(P, L.sunDir).negate();
  return { uv, z };
};

export interface Surface {
  P: N; // world position
  N: N; // world normal (either way round)
  albedo: N;
  thin: N; // 1 for a vane that light passes through, 0 for a solid
  self: N; // this surface's own optical depth (never less than this when asking what the sun has passed)
  gloss: N; // 0..1: a hard little highlight (bill, eye, legs)
  ao: N; // 1 in the open, less where it is tucked under something
}

// returns linear rgb
export const toon = (L: Light, s: Surface) =>
  Fn(() => {
    const V = normalize(cameraPosition.sub(s.P)).toVar();
    const n0 = normalize(s.N).toVar();
    const Nf = n0.mul(select(dot(n0, V).lessThan(0), float(-1), float(1))).toVar();
    const ndl = dot(Nf, L.sunDir).toVar();

    // the sun's map, a small soft tap
    const { uv, z } = lightCoord(L, s.P);
    const o = L.texel.mul(0.75);
    const m = L.mapNode
      .sample(uv.add(vec2(o, o)))
      .add(L.mapNode.sample(uv.add(vec2(o.negate(), o))))
      .add(L.mapNode.sample(uv.add(vec2(o, o.negate()))))
      .add(L.mapNode.sample(uv.add(vec2(o.negate(), o.negate()))))
      .mul(0.25)
      .toVar();
    const tau = m.r;
    const mean = m.g.div(max(tau, 1e-4));
    const spread = max(m.b.div(max(tau, 1e-4)).sub(mean.mul(mean)), 0);

    // solid things above this point block the sun (alpha keeps the nearest solid along the ray)
    const nearest = m.a.sub(0.5).mul(4);
    const solid = float(1).sub(smoothstep(0.006, 0.022, z.sub(nearest)));
    // feathers above this point dim it. With the mean and spread of the layers on this ray, and this point
    // sitting in one cluster of them, the share that belongs to the other cluster is d² / (spread + d²)
    const d = z.sub(mean);
    const above = smoothstep(0.0, 0.012, d)
      .mul(d.mul(d))
      .div(spread.add(d.mul(d)).add(0.00015));
    const cast = exp(tau.mul(above).mul(L.shadow).negate());

    // light or shade: one turn, kept soft enough to read as painted rather than cut out
    const wrap = float(0.25);
    const lit = clamp(ndl.add(wrap).div(wrap.add(1)), 0, 1)
      .mul(solid)
      .mul(cast);
    const band = smoothstep(L.edge.sub(L.soft), L.edge.add(L.soft), lit);

    // far side of a vane: what is left of the sun after every layer on this ray turns it warm
    const back = smoothstep(0.25, -0.3, ndl).mul(s.thin);
    const rest = float(1).div(max(tau, s.self).mul(L.through).add(1));
    const through = smoothstep(0.1, 0.5, rest.mul(back).mul(solid).mul(L.glow));

    const tone = mix(L.shadeTone, L.lightTone, band).toVar();
    tone.assign(mix(tone, L.glowTone, through));
    tone.assign(mix(tone.mul(L.deepTone), tone, s.ao));
    // the sun behind a solid lights its edge
    const behind = smoothstep(-0.2, 0.6, dot(V.negate(), L.sunDir));
    const rim = pow(float(1).sub(abs(dot(Nf, V))), 2.5)
      .mul(behind)
      .mul(float(1).sub(s.thin))
      .mul(L.rim);
    tone.assign(mix(tone, L.glowTone, clamp(rim, 0, 1)));

    const H = normalize(V.add(L.sunDir));
    const spec = smoothstep(0.55, 0.7, pow(max(dot(Nf, H), 0), 50))
      .mul(s.gloss)
      .mul(0.55);
    return vec4(s.albedo.mul(tone).add(spec), 1);
  })();
