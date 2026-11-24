// Shared light for everything on the bird. No three lights: one sun, a sky/ground hemisphere, and a map
// rendered from the sun that counts how much feather (and how much solid body) lies along each sun ray.
//
// The map holds three sums over the feathers a sun ray crosses (drawn additively, so order never matters):
//   r = Σ τ   optical depth of the vanes      g = Σ τ·z      b = Σ τ·z²   (z = distance along the ray, from the bird's middle)
// and in alpha the nearest solid (body, legs, wing arm) along the ray, kept with a "min" blend.
// τ gives the light coming through the wing (one vane glows, two are dimmer, a shaft is a dark line); the
// mean and spread of z tell a point how much of that τ lies above it rather than being its own.
import * as TSL from "three/tsl";
import { Color, Vector3 } from "three/webgpu";
import type { Texture } from "three/webgpu";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const T: Record<string, any> = TSL;
const { abs, cameraPosition, clamp, dot, exp, float, Fn, max, mix, normalize, pow, smoothstep, sqrt, texture, uniform, vec2, vec3, vec4, select } = T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type N = any;

export interface Light {
  sunDir: N; // towards the sun
  sunColor: N;
  skyColor: N;
  groundColor: N;
  lx: N; // light map axes (world)
  ly: N;
  extent: N; // half size of the light map, metres
  through: N; // one vane lets 1 / (1 + through) of the sun past
  shadow: N; // how hard feathers shade what is far below them
  glow: N; // strength and colour of the light that comes through
  glowColor: N;
  ambient: N;
  mapNode: N;
  texel: N;
}

export function createLight(map: Texture): Light {
  const mapNode = texture(map);
  return {
    sunDir: uniform(new Vector3(0, 1, 0)),
    sunColor: uniform(new Color(1, 1, 1)),
    skyColor: uniform(new Color(0.3, 0.5, 0.9)),
    groundColor: uniform(new Color(0.2, 0.25, 0.25)),
    lx: uniform(new Vector3(1, 0, 0)),
    ly: uniform(new Vector3(0, 0, 1)),
    extent: uniform(1),
    through: uniform(0.6),
    shadow: uniform(1.2),
    glow: uniform(1),
    glowColor: uniform(new Color(1, 0.93, 0.78)),
    ambient: uniform(1),
    mapNode,
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
  self: N; // this surface's own optical depth (taken out when asking what lies above it)
  gloss: N; // 0..1
  ao: N;
  fibre?: N; // world direction of the barbs, for surfaces made of parallel fibres
}

// returns linear rgb
export const shade = (L: Light, s: Surface) =>
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
    // white feathers light each other, so a shaded one is never left with the sky alone
    const cast = mix(exp(tau.mul(above).mul(L.shadow).negate()), 1, 0.14);

    // sunlit side: wrapped a little, feathers scatter
    const wrap = mix(0.25, 0.45, s.thin);
    const lit = clamp(ndl.add(wrap).div(wrap.add(1)), 0, 1);
    // barbs are fibres: how bright one is depends on the angle between it and the light, so the two vanes
    // of a feather, whose barbs run mirrored, take different tones under the same sun
    const fib = s.fibre ? normalize(s.fibre) : null;
    const along = fib ? mix(float(1), sqrt(max(float(1).sub(dot(fib, L.sunDir).mul(dot(fib, L.sunDir))), 0)).mul(1.18), 0.5) : float(1);
    const direct = L.sunColor.mul(lit).mul(along).mul(solid).mul(cast);

    // far side of a vane: what is left of the sun after every layer on this ray
    const back = smoothstep(0.25, -0.3, ndl).mul(s.thin);
    // (light scattering from layer to layer falls off more gently than a plain exponential)
    const rest = float(1).div(max(tau, s.self).mul(L.through).add(1));
    // looking up towards the sun through the wing it flares
    const forward = pow(max(dot(V, L.sunDir).negate(), 0), 3)
      .mul(0.9)
      .add(1);
    const glow = L.sunColor.mul(L.glowColor).mul(back.mul(rest).mul(solid).mul(L.glow).mul(forward));

    // sky above, river and banks below
    const hemi = mix(L.groundColor, L.skyColor, Nf.y.mul(0.5).add(0.5)).mul(L.ambient).mul(s.ao);

    // a soft sheen, wide on feathers, tighter on bill and legs
    const H = normalize(V.add(L.sunDir));
    const shin = mix(14, 90, s.gloss);
    const spec = pow(max(dot(Nf, H), 0), shin)
      .mul(mix(0.05, 0.6, s.gloss))
      .mul(solid)
      .mul(cast)
      .mul(smoothstep(-0.05, 0.2, ndl));
    // grazing views of white plumage pick up the sky
    const rim = pow(float(1).sub(abs(dot(Nf, V))), 3).mul(0.25);

    const Hf = normalize(V.add(L.sunDir));
    const sheen = fib
      ? pow(sqrt(max(float(1).sub(dot(fib, Hf).mul(dot(fib, Hf))), 0)), 60)
          .mul(0.16)
          .mul(lit)
          .mul(solid)
          .mul(cast)
      : float(0);
    const col = s.albedo.mul(direct.add(hemi).add(glow)).add(L.sunColor.mul(sheen)).add(L.sunColor.mul(spec)).add(L.skyColor.mul(rim).mul(s.ao).mul(L.ambient).mul(s.albedo));
    return vec4(col, 1);
  })();
