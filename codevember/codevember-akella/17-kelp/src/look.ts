// How the plant takes light. A blade is a thin sheet seen mostly from its dark side with the sun behind it, so most
// of what reaches the eye came through: the sun, less the blades it crossed first (light.ts), less this blade's
// own thickness, which is its picture: a midrib, veins leaving it, blisters between the veins.
import { Fn, abs, attribute, cameraPosition, cross, dFdx, dFdy, dot, exp, float, fract, length, max, mix, mx_noise_float, normalize, positionWorld, pow, reflect, saturate, sign, smoothstep, uniform, vec2, vec3, vec4 } from "three/tsl";
import type { Node } from "three/webgpu";
import { DoubleSide, NodeMaterial, Vector3 } from "three/webgpu";
import type { Light } from "./light.ts";

type N = Node<"float">;
type V3 = Node<"vec3">;

const aux = attribute("aux", "vec4");
const aux2 = attribute("aux2", "vec4");

const U = { aged: uniform(0.7) }; // how much thicker an old blade is than a young one
export const skinU = U;

// what a blade's picture is drawn from: where on it (u along 0..1, v across -1..1), its length and half width, how
// wide it is here against its widest, its age (-42 newborn .. 12 old) and a number of its own
// (`veined`: how strongly the side veins show, 1 if not said)
export type BladeIn = { u: N; v: N; long: N; half: N; edge: N; age: N; seed: N; veined?: N };
// and a stem or bladder: along it, round it (0..1), its own number, and 0 for stem, 1 for bladder
// (`at`: somewhere to read its streaks from instead of along and round; `tint`: its own colour over the common one)
export type SolidIn = { along: N; round: N; seed: N; bulb: N; at?: V3; tint?: V3 };
// as plant.ts packs them
const ownBlade: BladeIn = { u: aux.x, v: aux.y, long: aux.z, seed: aux.w, half: aux2.x, age: aux2.y, edge: aux2.w };
const ownSolid: SolidIn = { along: aux.x, round: aux.y, seed: aux.w, bulb: aux2.x };

// a blade's own picture. `fine` adds what only the eye needs; the sun map takes the coarse part
const skin = (fine: boolean, b: BladeIn) => {
  const { u, v, seed } = b;
  // a place on the blade measured in half widths both ways, so the marks on it are not stretched
  const c = vec2(u.mul(b.long).div(b.half), v.mul(b.edge));
  const off = abs(c.y);
  const rib = exp(off.div(0.075).pow(2).negate()).mul(u.mul(0.7).oneMinus());
  const wander = mx_noise_float(vec3(c.mul(1.4), seed.mul(17))).mul(0.45);
  const veinAt = fract(c.x.sub(off.mul(1.15)).mul(1.9).add(wander)).sub(0.5).abs().mul(2).oneMinus();
  const veins = pow(veinAt, 6)
    .mul(smoothstep(0.02, 0.16, off))
    .mul(smoothstep(1.0, 0.5, abs(v)));
  const vein = b.veined ? veins.mul(b.veined) : veins;
  if (!fine)
    return {
      keeps: float(0.85)
        .add(rib.mul(1.1))
        .add(vein.mul(0.4))
        .mul(smoothstep(-28, 2, b.age).mul(U.aged).add(1).sub(U.aged.mul(0.5))),
      height: float(0),
      c,
    };
  // finer marks are let go as they get smaller than a few pixels
  const px = max(length(dFdx(c)), length(dFdy(c)));
  const seen = (f: number) => smoothstep(0.55, 0.2, px.mul(f));
  const n1 = mx_noise_float(vec3(c.mul(4.2), seed.mul(31))).mul(seen(4.2));
  const n2 = mx_noise_float(vec3(c.mul(10.5), seed.mul(53))).mul(seen(10.5));
  const n3 = mx_noise_float(vec3(c.mul(27), seed.mul(71))).mul(seen(27));
  // blisters: the flesh between veins swells, and is thinner where it does
  const blister = n1.mul(0.6).add(n2.mul(0.4));
  // and the whole blade is not one colour: darker patches, as if older
  const patchy = mx_noise_float(vec3(c.mul(0.9), seed.mul(91)));
  const keeps = float(0.85)
    .add(rib.mul(1.1))
    .add(vein.mul(0.4).mul(seen(4)))
    .sub(blister.mul(0.32))
    .add(patchy.mul(0.4))
    // a young blade is thin and pale gold, an old one thick and brown
    .mul(smoothstep(-28, 2, b.age).mul(U.aged).add(1).sub(U.aged.mul(0.5)))
    .mul(smoothstep(1.02, 0.6, abs(v)).mul(0.22).add(0.78));
  const height = rib
    .mul(0.05)
    .add(vein.mul(0.035).mul(seen(4)))
    .add(blister.mul(0.05))
    .add(n3.mul(0.008));
  return { keeps, height, c };
};

export const bladeKeeps = (b: BladeIn = ownBlade) => skin(false, b).keeps;
// stem 0, bladder 1: a bladder is a thin wall round gas
export const solidKeeps = (bulb: N = aux2.x) => mix(float(0.65), float(0.3), bulb);

export function createLook(light: Light) {
  const U = {
    aged: skinU.aged,
    sun: uniform(4),
    sunColor: uniform(new Vector3(1, 0.97, 0.86)),
    up: uniform(new Vector3(0.1, 0.42, 0.5)), // light of the water above
    low: uniform(new Vector3(0.01, 0.07, 0.12)), // and below
    ambient: uniform(1),
    rind: uniform(new Vector3(0.2, 0.15, 0.035)), // a blade seen by the light it throws back
    thick: uniform(1), // how much its own thickness keeps
    glow: uniform(1), // how much of what comes through is thrown on to the eye
    relief: uniform(1),
    gloss: uniform(0.6),
    stem: uniform(new Vector3(0.75, 0.48, 0.1)),
    bladder: uniform(new Vector3(0.95, 0.66, 0.13)),
    webBlur: uniform(0.5),
    around: uniform(new Vector3(0.1, 0.055, 0.012)),
  };
  const L = light.U.dir;
  const ownNormal = attribute("normal", "vec3");

  const sky = (d: V3) => mix(U.low, U.up, smoothstep(-0.5, 0.9, d.y));

  // the colour of a blade, given what it is drawn from and its normal (plant.ts' own by default; another plant
  // posed in its vertex shader hands in its own)
  const bladeLit = (b: BladeIn = ownBlade, nor: V3 = ownNormal) => Fn(() => {
    const pos = positionWorld;
    const V = normalize(cameraPosition.sub(pos));
    const flat = normalize(nor).toVar();
    flat.mulAssign(sign(dot(flat, V).add(1e-5)));
    const { keeps, height } = skin(true, b);

    // lean the normal by the slope of the marks (their height is in half widths)
    const h = height.mul(b.half).mul(U.relief);
    const dpx = dFdx(pos),
      dpy = dFdy(pos);
    const r1 = cross(dpy, flat),
      r2 = cross(flat, dpx);
    const det = dot(dpx, r1);
    const slope = r1.mul(dFdx(h)).add(r2.mul(dFdy(h))).mul(sign(det));
    const normal = normalize(flat.mul(abs(det)).sub(slope)).toVar();

    // even the deepest shade is not black: some light finds its way round, the colour of what it came through
    const sun = U.sunColor
      .mul(U.sun)
      .mul(light.gathered(pos, U.webBlur))
      .mul(light.through(pos, skin(false, b).keeps).max(U.around));
    const facing = dot(flat, L);
    const ndl = dot(normal, L);
    // sun on the side we see: the dull rind, and a wet glint
    const front = saturate(ndl).mul(smoothstep(-0.05, 0.1, facing));
    const H = normalize(L.add(V));
    const glint = pow(saturate(dot(normalize(mix(flat, normal, 0.5)), H)), 24)
      .mul(U.gloss)
      .mul(0.25)
      .mul(smoothstep(0, 0.15, facing));
    // sun on the far side: what the blade lets through, brightest where it is thin and where we look up the ray
    const own = exp(light.U.takes.mul(keeps).mul(U.thick).negate());
    const back = saturate(ndl.negate().mul(0.75).add(0.25)).mul(smoothstep(0.05, -0.1, facing));
    const upRay = pow(saturate(dot(V.negate(), L)), 3).mul(0.7).add(0.75);
    const lit = sun.mul(U.rind.add(own.mul(0.3)).mul(front).add(own.mul(back).mul(upRay).mul(U.glow)).add(glint));

    // the water's own light, from all round: on the rind, through the blade, and mirrored in its wet face
    const shade = dot(light.through(pos.add(flat.mul(0.02))), vec3(0.3, 0.5, 0.2))
      .mul(0.6)
      .add(0.4);
    const round = sky(normal).mul(U.rind).mul(1.4).add(sky(normal.negate()).mul(own).mul(0.55));
    const edge = pow(saturate(dot(normal, V)).oneMinus(), 4);
    const mirror = sky(reflect(V.negate(), normal)).mul(edge.mul(0.6).add(0.03)).mul(U.gloss);
    return vec4(lit.add(round.add(mirror).mul(shade).mul(U.ambient)), 1);
  })();
  const blade = new NodeMaterial();
  blade.side = DoubleSide;
  blade.fragmentNode = bladeLit();

  const solidLit = (s: SolidIn = ownSolid, nor: V3 = ownNormal) => Fn(() => {
    const pos = positionWorld;
    const V = normalize(cameraPosition.sub(pos));
    const normal = normalize(nor).toVar();
    normal.mulAssign(sign(dot(normal, V).add(1e-5)));
    const bulb = s.bulb;
    const streak = mx_noise_float(s.at ?? vec3(s.round.mul(6.2832).cos().mul(2.5), s.round.mul(6.2832).sin().mul(2.5), s.along.mul(1.5)).add(s.seed.mul(40)));
    const plain = mix(U.stem, U.bladder, bulb).mul(streak.mul(0.18).mul(bulb.oneMinus()).add(1));
    const albedo = s.tint ? plain.mul(s.tint) : plain;
    const sun = U.sunColor
      .mul(U.sun)
      .mul(light.gathered(pos, U.webBlur))
      .mul(light.through(pos));
    const ndl = dot(normal, L);
    // a bladder is lit nearly all the way round: light gets about inside it
    const wrap = mix(float(0.7), float(0.9), bulb);
    const front = saturate(ndl.add(wrap).div(wrap.add(1)));
    const upRay = pow(saturate(dot(V.negate(), L)), 3).mul(bulb);
    const H = normalize(L.add(V));
    const glint = pow(saturate(dot(normal, H)), 110).mul(U.gloss).mul(2.2);
    const edge = pow(saturate(dot(normal, V)).oneMinus(), 3);
    // seen against the light, the wall is thickest at the outline
    const wall = mix(float(1), edge.mul(0.55).oneMinus(), bulb);
    const lit = sun.mul(albedo.mul(front.add(upRay.mul(0.6))).mul(wall).add(glint));
    const round = sky(normal).mul(albedo).mul(0.9);
    const mirror = sky(reflect(V.negate(), normal)).mul(edge.mul(0.7).add(0.04)).mul(U.gloss);
    return vec4(lit.add(round.add(mirror).mul(U.ambient)), 1);
  })();
  const solid = new NodeMaterial();
  solid.side = DoubleSide;
  solid.fragmentNode = solidLit();

  return { U, blade, solid, sky, bladeLit, solidLit };
}

export type { N, V3 };
