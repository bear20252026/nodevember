// What a renderer that follows light would give the studio, done on the picture: things seen in each other
// (screen-space reflections) and the dark of tight places (GTAO).
//
// Polished metal reflects whatever is next to it. Where that is more of the same metal (inside a fold, a funnel
// of cloth round the ball) the light has been coloured by the metal twice, three times: copper reflecting copper
// goes from pale pink to deep orange. That is the colour change in arc4g's cloth: no coloured lights, just
// interreflection. Two ways here, together:
//   - a reflected ray traced through the depth buffer: where it meets something on screen, a metal shows that
//     thing (already lit, already copper-coloured) times its own colour, in place of the room it would see;
//   - where the ray finds nothing (off screen, hidden), the occlusion stands in: a point that sees mostly
//     cloth is lit mostly by cloth, F + F^2 (1-p) + ... = p F / (1 - (1 - p) F) with p the open sky it sees.
import { gaussianBlur } from "three/examples/jsm/tsl/display/GaussianBlurNode.js";
import { denoise } from "three/examples/jsm/tsl/display/DenoiseNode.js";
import { ao } from "three/examples/jsm/tsl/display/GTAONode.js";
import { finite3, notFinite, safe1, safe3, unitNormal } from "./finite.ts";
import { n8ao, n8Look } from "./n8ao.ts";
import {
  Break,
  convertToTexture,
  float,
  Fn,
  getScreenPosition,
  getViewPosition,
  If,
  Loop,
  max,
  metalness,
  min,
  mix,
  mrt,
  normalView,
  output,
  roughness,
  smoothstep,
  specularColorBlended,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import type { Node, PerspectiveCamera } from "three/webgpu";
import type { Stage } from "./stage.ts";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export const screenLook = {
  reflections: 1, // how much of what a ray finds is seen
  reach: 6, // m a reflected ray travels
  ssrCap: 0.9, // brightest a found reflection may be
  occlusion: 0.6, // GTAO on everything
  aoRadius: 0.45, // m
  cavity: 3, // the occlusion as interreflection on metals (a power on the open sky GTAO finds; 0 is off)
  ...n8Look,
};

// what each surface tells the passes: its reflectance F0, and roughness (+2 when it is not a metal, so a floor
// adds a reflection to its own colour while a metal swaps the room for it; +4 when no rays are traced from it:
// it keeps the room it reflects, and only the occlusion works on it)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const reflectance = (f0: any, rough: any, metal: any = 1, traced = true) =>
  vec4(f0, float(rough).add(float(1).sub(metal).mul(2)).add(traced ? 0 : 4));

export function screenSpace(st: Stage, look: typeof screenLook) {
  const camera = st.camera as PerspectiveCamera;
  const sp = st.scenePass;
  // (the normal's alpha: how much of the occlusion a surface takes, 1 unless its material says less)
  sp.setMRT(mrt({ output, normal: vec4(normalView, 1), refl: reflectance(specularColorBlended, roughness, metalness) }));
  const colour = sp.getTextureNode("output");
  const normal = sp.getTextureNode("normal");
  const refl = sp.getTextureNode("refl");
  const depth = sp.getTextureNode("depth");
  const proj = uniform(camera.projectionMatrix);
  const projInv = uniform(camera.projectionMatrixInverse);
  const U = { cap: uniform(look.ssrCap), amount: uniform(look.reflections), reach: uniform(look.reach), occlusion: uniform(look.occlusion), cavity: uniform(look.cavity), n8Intensity: uniform(look.n8Intensity) };

  // (in a pass over the picture, cameraNear and cameraFar are the quad's, not the scene camera's)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewZ = (at: any) => getViewPosition(at, depth.sample(at).r, projInv).z;
  const STEPS = 40;
  const DEBUG = Number(new URLSearchParams(location.search).get("ssdebug") ?? 0);
  const trace = Fn(() => {
    const at = uv();
    const d = depth.sample(at).r;
    const result = vec4(0).toVar();
    If(d.lessThan(0.99999).and(refl.sample(at).a.lessThan(3.5)), () => {
      const P = getViewPosition(at, d, projInv).toVar();
      const N = unitNormal(normal.sample(at).xyz).toVar();
      const R = P.normalize().reflect(N).normalize().toVar();
      if (DEBUG === 3) result.assign(vec4(N.mul(0.5).add(0.5), 1));
      if (DEBUG === 4) result.assign(vec4(P.z.negate().fract(), viewZ(at).negate().fract(), 0, 1));
      const O = P.add(N.mul(P.z.negate().mul(0.002).add(0.004))).toVar();
      // steps that grow along the ray: fine near the surface, where folds see each other
      const grow = float(Math.pow(800, 1 / STEPS));
      const t = float(0.01).toVar();
      const tLast = float(0).toVar();
      const found = float(0).toVar();
      Loop(STEPS, () => {
        const Q = O.add(R.mul(t));
        If(Q.z.greaterThan(-camera.near).or(t.greaterThan(U.reach)), () => {
          Break();
        });
        const s = getScreenPosition(Q, proj);
        If(s.x.lessThan(0).or(s.x.greaterThan(1)).or(s.y.lessThan(0)).or(s.y.greaterThan(1)), () => {
          Break();
        });
        const sz = viewZ(s);
        const behind = sz.sub(Q.z); // > 0: the ray has gone behind what the picture shows there
        // a crossing close enough to be the surface; one far behind is something the ray passes behind (a
        // frame's foot between it and the floor), so it keeps going
        If(behind.greaterThan(0).and(behind.lessThan(t.sub(tLast).mul(1.5).add(0.04))), () => {
          found.assign(1);
          Break();
        });
        tLast.assign(t);
        t.mulAssign(grow);
      });
      If(found.greaterThan(0).and(DEBUG < 3), () => {
        // narrow it down between the last step in front and the first behind
        const lo = tLast.toVar(), hi = t.toVar();
        Loop(6, () => {
          const mid = lo.add(hi).mul(0.5);
          const Q = O.add(R.mul(mid));
          const sz = viewZ(getScreenPosition(Q, proj));
          If(sz.greaterThan(Q.z), () => {
            hi.assign(mid);
          }).Else(() => {
            lo.assign(mid);
          });
        });
        const Qh = O.add(R.mul(hi));
        const s = getScreenPosition(Qh, proj).toVar();
        // a real meeting: the ray ends on the surface, not somewhere behind a thin thing it passed
        const close = smoothstep(hi.mul(0.02).add(0.06), hi.mul(0.01).add(0.03), viewZ(s).sub(Qh.z));
        // what the ray meets must face it, and the picture's edge fades it out (it is about to lose the ray)
        const Nh = unitNormal(normal.sample(s).xyz);
        const facing = smoothstep(0, 0.15, R.dot(Nh).negate());
        const edge = smoothstep(0, 0.08, min(min(s.x, s.y), min(s.x.oneMinus(), s.y.oneMinus())));
        const far = smoothstep(U.reach, U.reach.mul(0.6), hi);
        const h = facing.mul(edge).mul(far).mul(close);
        // a highlight on a tiny wrinkle, found by one ray and missed by the next, is glitter: cap what is found
        const c = colour.sample(s).rgb;
        const lum = c.dot(vec3(0.2126, 0.7152, 0.0722));
        result.assign(vec4(c.mul(min(float(1), U.cap.div(max(lum, 1e-4)))).mul(h), h));
      });
    });
    return result;
  });
  // traced at half size: the cloth isn't traced (it mottled its fine folds), and on frames, ball and floor half
  // looks the same as full at a quarter of the cost (?ssr=1 for full)
  const scale = Number(new URLSearchParams(location.search).get("ssr") ?? 0.5);
  // what is on (the performance folder switches them while the page runs; ?skip=ssr,ao,denoise,blur at load)
  const skip = new Set((new URLSearchParams(location.search).get("skip") ?? "").split(","));
  // the defaults: reflections on (at half size; the page turns them off if it can't keep 60 frames a second with
  // them), no floor blur, N8AO for occlusion (?on=blur,gtao to start with those, ?skip=ssr without reflections)
  const on = new Set((new URLSearchParams(location.search).get("on") ?? "").split(","));
  const parts = {
    reflections: !skip.has("ssr"),
    reflectionSize: scale,
    floorBlur: on.has("blur") && !skip.has("blur"),
    occlusion: !skip.has("ao"),
    occlusionKind: (on.has("gtao") ? "gtao" : "n8ao") as "gtao" | "n8ao",
    denoise: !skip.has("denoise"),
    occlusionSize: 0.25, // a quarter of the picture's size: looks the same as half here, ~4 ms less a frame
  };
  const sharp = convertToTexture(trace(), null, null, { resolutionScale: scale });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // the soft version is only for rough surfaces (the floor): blur only theirs, so a mirror's sharp reflection
  // doesn't spread onto the floor round it
  const roughOnly = convertToTexture(sharp.mul(refl.sample(uv()).a.greaterThan(1.5).select(1, 0)), null, null, { resolutionScale: 0.5 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const soft = gaussianBlur(roughOnly as any, null, 6, { resolutionScale: 0.5 }).getTextureNode();

  const occ = ao(depth, normal, camera);
  occ.resolutionScale = parts.occlusionSize;
  occ.radius.value = look.aoRadius;
  // the denoiser draws its noise with Math.random: seeded, so every page load (every film) is the same picture
  const random = Math.random;
  let seed = 7;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const occRaw = occ.getTextureNode();
  const occSmooth = convertToTexture(denoise(occRaw, depth, normal, camera));
  Math.random = random;
  const n8 = n8ao(depth, normal, camera, { size: parts.occlusionSize });
  n8.refresh(look);

  const picture = Fn(() => {
    const n8on = parts.occlusionKind === "n8ao";
    const occTex = n8on ? (parts.denoise ? n8.smooth : n8.raw) : parts.denoise ? occSmooth : occRaw;
    const at = uv();
    // (anything not a finite number is caught here, so it can't spread: see finite.ts)
    const Craw = colour.sample(at).rgb;
    const C = safe3(Craw, vec3(0));
    const info = refl.sample(at);
    const a = info.a.sub(info.a.greaterThan(3.5).select(4, 0));
    const dielectric = a.greaterThan(1.5);
    const rough = dielectric.select(a.sub(2), a);
    const F0 = info.rgb;
    const P = getViewPosition(at, depth.sample(at).r, projInv);
    const N = unitNormal(normal.sample(at).xyz);
    // (clamped at 1 too: two unit vectors can dot a hair over it, and a power of the negative 1 - nv is NaN, which
    // the bloom turned into a black square over most of the screen)
    const nv = N.dot(P.normalize().negate()).clamp(0, 1);
    const F = F0.add(vec3(1).sub(F0).mul(nv.oneMinus().pow(5)));
    const S = !parts.reflections ? vec4(0) : (parts.floorBlur ? mix(sharp.sample(at), soft.sample(at), smoothstep(0.08, 0.45, rough)) : sharp.sample(at)).mul(U.amount);
    // a metal sees the thing in place of the room; anything else sees it on top of its own colour
    const seen = dielectric.select(C.add(S.rgb.mul(F)), C.mul(S.a.oneMinus()).add(S.rgb.mul(F)));
    // (N8AO's open sky is a share of points, kinder than GTAO's horizons: its power brings it to the same dark)
    const occRaw0 = !parts.occlusion ? float(1) : (occTex as N).sample(at).r;
    const p0 = safe1(n8on ? max(float(occRaw0), 0).pow(U.n8Intensity) : occRaw0, float(1)).clamp(0, 1);
    // (clamped: a power of a p a hair below 0 is NaN in WGSL, and was, on one pixel of a crumpled cloth)
    const p = mix(float(1), p0, normal.sample(at).a).clamp(0, 1);
    // tight places: darker, and on metal, lit by the metal itself
    // (GTAO is generous with open sky: the cavity power sharpens it to what a tight fold really sees)
    const pc = p.pow(U.cavity);
    const metalAO = vec3(pc).div(max(vec3(1).sub(F0.mul(pc.oneMinus())), vec3(1e-4)));
    const plainAO = mix(float(1), p, U.occlusion);
    const lit = dielectric.select(seen.mul(plainAO), seen.mul(metalAO).mul(mix(float(1), p, U.occlusion.mul(0.3))));
    // the backdrop has no surface to work on
    const shown = safe3(depth.sample(at).r.lessThan(0.99999).select(lit, C), C);
    // ?ssdebug=1 the reflections found, 2 the occlusion, 5 the normals, 6 the depth (in bands of 10 cm, 1 mm, 10 µm)
    if (DEBUG === 5) return vec4(N.mul(0.5).add(0.5), 1);
    if (DEBUG === 7) {
      // what is not a finite number, before it is caught: red the scene's colour, magenta its normal, cyan the
      // occlusion, green the reflectance, blue the picture made from them; yellow too bright to be real (a firefly); the rest grey
      const Nraw = normal.sample(at).xyz;
      const litRaw = depth.sample(at).r.lessThan(0.99999).select(lit, C);
      const grey = vec3(C.dot(vec3(0.3, 0.5, 0.2)).mul(0.3));
      const hot = max(C.x, max(C.y, C.z)).greaterThan(64).select(vec3(1, 1, 0), grey);
      const o = finite3(litRaw).select(hot, vec3(0, 0, 1));
      const q = notFinite(occRaw0).select(vec3(0, 1, 1), o);
      const nn = finite3(Nraw).and(Nraw.length().greaterThan(1e-4)).select(q, vec3(1, 0, 1)); // (or about zero)
      const rr = finite3(info.rgb).and(notFinite(info.a).not()).select(nn, vec3(0, 1, 0));
      return vec4(finite3(Craw).select(rr, vec3(1, 0, 0)), 1);
    }
    if (DEBUG === 8) {
      // which term of the composite is not finite (one colour each)
      const g = vec3(0.2);
      const t = (ok: N, c: number[], rest: N) => ok.select(rest, vec3(c[0], c[1], c[2]));
      const nvOk = notFinite(nv).not(), Pok = finite3(P);
      return vec4(t(Pok, [1, 0, 1], t(nvOk, [1, 1, 0], t(finite3(F), [1, 0, 0], t(finite3(seen), [0, 1, 0], t(finite3(metalAO), [0, 0, 1], t(notFinite(p).not(), [0, 1, 1], t(finite3(lit), [1, 0.5, 0], g))))))), 1);
    }
    if (DEBUG === 6) return vec4(P.z.negate().mul(10).fract(), P.z.negate().mul(1000).fract(), P.z.negate().mul(100000).fract(), 1);
    return vec4(DEBUG >= 3 ? sharp.sample(at).rgb : DEBUG === 1 ? S.rgb : DEBUG === 2 ? vec3(p) : shown, 1);
  });
  // when a part is switched the picture's graph is made again and handed to the same texture, so the finish
  // after it stays as it is; a pass the new graph doesn't reach is no longer rendered
  const result = convertToTexture(picture());
  const build = () => {
    const node = picture();
    const rtt = result as unknown as { node: unknown; _quadMesh: { material: { fragmentNode: unknown; needsUpdate: boolean } } };
    rtt.node = node;
    rtt._quadMesh.material.fragmentNode = node;
    rtt._quadMesh.material.needsUpdate = true;
  };
  st.finish(result);
  const setParts = (o: Partial<typeof parts> & { bloom?: boolean }) => {
    if (o.bloom !== undefined) st.setGlow(o.bloom);
    Object.assign(parts, o);
    sharp.setResolutionScale(parts.reflectionSize);
    occ.resolutionScale = parts.occlusionSize;
    n8.setSize(parts.occlusionSize);
    build();
  };

  const refresh = () => {
    U.amount.value = look.reflections;
    U.reach.value = look.reach;
    U.cap.value = look.ssrCap;
    U.occlusion.value = look.occlusion;
    U.cavity.value = look.cavity;
    occ.radius.value = look.aoRadius;
    U.n8Intensity.value = look.n8Intensity;
    n8.refresh(look);
  };
  const f = st.gui.addFolder("screen space");
  f.add(look, "reflections", 0, 1.5, 0.01).onChange(refresh);
  f.add(look, "reach", 0.5, 15, 0.1).onChange(refresh);
  f.add(look, "ssrCap", 0.1, 4, 0.01).onChange(refresh);
  f.add(look, "occlusion", 0, 1, 0.01).onChange(refresh);
  f.add(look, "aoRadius", 0.05, 2, 0.01).onChange(refresh);
  f.add(look, "cavity", 0, 10, 0.05).onChange(refresh);
  f.add(look, "n8Radius", 0.05, 2, 0.01).name("N8AO radius").onChange(refresh);
  f.add(look, "n8Falloff", 0.1, 4, 0.01).name("N8AO falloff").onChange(refresh);
  f.add(look, "n8Intensity", 0.5, 8, 0.05).name("N8AO intensity").onChange(refresh);
  f.add(look, "n8Blur", 1, 24, 0.5).name("N8AO denoise reach").onChange(refresh);
  return { refresh, parts, setParts, sharp: sharp as unknown as Node, occ };
}
