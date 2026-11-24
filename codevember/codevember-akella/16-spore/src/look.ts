// How a mushroom takes light. There is a lamp inside the pile (a glowing length of its axis) and a cool one outside.
// Mushroom flesh passes light and reddens it, so what reaches a point is the lamp, less what it crossed on the way:
// that is read from a box of how full of mushroom each place is, walked towards the lamp. The stem or cap the point
// belongs to is done by itself: lit side, and the far side by what comes through its thickness.
import { Fn, atan, attribute, cameraPosition, clamp, cos, cross, dot, exp, float, floor, fract, fwidth, length, max, mix, mx_noise_float, mx_noise_vec3, normalize, positionWorld, pow, saturate, sin, smoothstep, texture3D, uniform, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { Data3DTexture, FrontSide, NodeMaterial, Vector3 } from "three/webgpu";
import { ROUND, VOL } from "./stage.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;

export function createLook(inside: Data3DTexture, outside: Data3DTexture) {
  const U = {
    lampA: uniform(new Vector3(0, -2.4, 0)), // the lamp: from here
    lampB: uniform(new Vector3(0, -0.5, 0)), // to here
    lampColor: uniform(new Vector3(1, 0.8, 0.56)),
    lamp: uniform(2.2),
    lampSize: uniform(0.3),
    redden: uniform(new Vector3(3.2, 7.5, 15)), // what a length of flesh takes from red, green, blue
    soft: uniform(0.55), // how much less it takes the deeper the light already is (it scatters round)
    keyDir: uniform(new Vector3(-0.5, 0.55, 0.67).normalize()),
    keyColor: uniform(new Vector3(0.72, 0.84, 1)),
    key: uniform(1.1),
    rimColor: uniform(new Vector3(0.55, 0.72, 1)),
    rim: uniform(0.5),
    skyColor: uniform(new Vector3(0.3, 0.42, 0.65)),
    sky: uniform(0.16),
    flesh: uniform(new Vector3(0.93, 0.9, 0.84)),
    through: uniform(1.0),
    shade: uniform(7), // how fast the outside light dies in the pile
    edge: uniform(0.5), // how much the lamp shows on edges turned from the eye
    hollow: uniform(2.6), // how dark the sky gets between stems
    grain: uniform(1),
    grainSize: uniform(70), // grains on a cap, per unit of length
    bumps: uniform(0.45),
  };
  const lo = vec3(VOL.x0, VOL.y0, VOL.z0);
  const size = vec3(VOL.nx * VOL.cell, VOL.ny * VOL.cell, VOL.nz * VOL.cell);
  // x: how full of mushroom a place is; y: flesh the outside light crossed to reach it
  const around = (p: V3) => texture3D(outside, p.sub(lo).div(size), float(0));
  // flesh the lamp's light crossed to reach a place
  const wayIn = (p: V3) => texture3D(inside, vec3(length(p.xz).div(ROUND.R), p.y.sub(VOL.y0).div(ROUND.ny * ROUND.dy), atan(p.z, p.x).div(6.283185)), float(0)).r;

  // light through `t` of flesh: red goes furthest, and the deeper it is the less each further length takes
  const passed = (t: N) => exp(U.redden.mul(t).div(t.mul(U.soft).mul(8).add(1)).negate());

  // the lamp's light arriving at a place (before any surface), and the way to it
  const lampAt = (p: V3, off: N) => {
    const ab = U.lampB.sub(U.lampA);
    const h = clamp(dot(p.sub(U.lampA), ab).div(dot(ab, ab)), 0, 1);
    const toL = U.lampA.add(ab.mul(h)).sub(p);
    const d2 = dot(toL, toL);
    const L = toL.div(d2.sqrt());
    // brighter low down, where the lamp's heart is
    const E = U.lampColor.mul(U.lamp).mul(mix(1, 0.55, h)).div(d2.add(U.lampSize.mul(U.lampSize))).mul(passed(wayIn(p.add(L.mul(off)))));
    return { E, L };
  };

  const lit = Fn(([albedo, normal, thick, gloss]: [V3, V3, N, N]) => {
    const pos = positionWorld;
    const V = normalize(cameraPosition.sub(pos));

    // ---- the lamp inside
    const { E, L } = lampAt(pos, thick.mul(1.2));
    const ndl = dot(normal, L);
    const front = saturate(ndl.add(0.35).div(1.35));
    const chord = thick.mul(2).mul(saturate(ndl.negate().add(0.15)));
    const behind = saturate(dot(V.negate(), L));
    const back = front.oneMinus().mul(passed(chord.mul(U.through))).mul(behind.mul(behind).mul(1.2).add(0.3));
    // the thin edge of anything catches whatever light is about
    const edge = pow(saturate(dot(normal, V)).oneMinus(), 2.5);
    const inner = E.mul(albedo).mul(back.add(front).add(edge.mul(U.edge)));

    // ---- the cool lamp outside, and the sky
    const K = U.keyDir;
    const kshade = exp(around(pos.add(K.mul(thick.mul(1.2)))).y.mul(U.shade).negate());
    const ndk = dot(normal, K);
    const kfront = saturate(ndk.add(0.3).div(1.3));
    const kchord = thick.mul(2).mul(saturate(ndk.negate().add(0.15)));
    const kback = kfront.oneMinus().mul(passed(kchord.mul(U.through))).mul(0.35);
    const H = normalize(K.add(V));
    const spec = pow(saturate(dot(normal, H)), 48).mul(gloss).mul(kfront);
    const key = U.keyColor.mul(U.key).mul(kshade).mul(albedo.mul(kback.add(kfront)).add(spec));

    const open = exp(around(pos.add(normal.mul(0.1))).x.add(around(pos.add(normal.mul(0.25))).x).mul(U.hollow).negate());
    const sky = U.skyColor.mul(U.sky).mul(albedo).mul(open).mul(normal.y.mul(0.3).add(0.7));
    const rim = U.rimColor.mul(U.rim).mul(edge).mul(open).mul(open);
    return inner.add(key).add(sky).add(rim);
  });

  const aux = attribute("aux", "vec4");
  const nor = normalize(attribute("normal", "vec3"));

  // ---- stems: fibres running up them
  const stem = new NodeMaterial();
  stem.side = FrontSide;
  stem.outputNode = Fn(() => {
    const seed = fract(aux.w);
    const round = aux.y.mul(6.2832);
    // noise that closes round the stem and is drawn out along it; read twice, a little apart, for its slope.
    // Two sizes of fibre, each let go once it is finer than a few pixels (it would only shimmer)
    const turn = fwidth(aux.y);
    const COARSE = 2.6,
      FINE = 6.5;
    const seenCoarse = smoothstep(0.36, 0.18, turn.mul(3.1416 * COARSE)),
      seenFine = smoothstep(0.36, 0.18, turn.mul(3.1416 * FINE));
    const fibres = (at: N) => {
      const c = cos(at),
        sn = sin(at);
      return mx_noise_float(vec3(c.mul(COARSE), sn.mul(COARSE), aux.x.mul(0.9)).add(seed.mul(71)))
        .mul(0.6)
        .mul(seenCoarse)
        .add(mx_noise_float(vec3(c.mul(FINE), sn.mul(FINE), aux.x.mul(2.4)).add(seed.mul(37))).mul(0.4).mul(seenFine));
    };
    const f0 = fibres(round.sub(0.08)),
      f1 = fibres(round.add(0.08));
    const streak = f0.add(f1).mul(0.5).mul(U.grain);
    // across the stem, in its surface: the way a ridge leans the normal
    const along = normalize(vec3(0, 1, 0).sub(nor.mul(nor.y)));
    const across = cross(along, nor);
    const normal = normalize(nor.sub(across.mul(f1.sub(f0).mul(U.grain).mul(1.6))));
    const tone = mix(vec3(1), vec3(1, 0.965, 0.9), fract(seed.mul(13.7)));
    const albedo = U.flesh.mul(tone).mul(streak.mul(0.2).add(1));
    return vec4(lit(albedo, normal, aux.z.mul(streak.mul(0.3).add(1)), float(0.22)), 1);
  })();

  // ---- caps: a warmer crown, a thin rim, gills underneath, a skin of fine grains
  const cap = new NodeMaterial();
  cap.side = FrontSide;
  cap.outputNode = Fn(() => {
    const seed = fract(aux.w);
    const open = floor(aux.w).div(250);
    const w = aux.x;
    const round = aux.y.mul(6.2832);
    const top = smoothstep(1.06, 0.98, w);
    const crown = smoothstep(0.55, 0, w);
    // a place on the cap that goes with the cap, so the grains stay put as it turns
    const own = vec3(cos(round).mul(w), sin(round).mul(w), seed.mul(9)).mul(aux.z);
    const grains = mx_noise_vec3(own.mul(U.grainSize)).mul(U.grain);
    const gills = sin(round.mul(46).add(sin(w.mul(9)).mul(1.5))).mul(0.5).add(0.5);
    const warm = vec3(0.97, 0.86, 0.66);
    const upper = mix(U.flesh, U.flesh.mul(warm), crown.mul(0.75)).mul(grains.x.mul(0.1).add(1));
    const under = U.flesh.mul(vec3(0.93, 0.88, 0.8)).mul(gills.mul(0.4).add(0.6));
    const albedo = mix(under, upper, top);
    const normal = normalize(nor.add(grains.mul(top).mul(U.bumps)));
    // thick at the crown, a skin at the rim; underneath it is the whole cap again
    const thick = aux.z.mul(mix(float(0.5), mix(float(0.1), float(0.55), crown), top)).mul(mix(1, 0.75, open));
    return vec4(lit(albedo, normal, thick, mix(float(0.05), float(0.3), top)), 1);
  })();

  return { U, stem, cap, lampAt };
}
