// N8AO (N8python, CC0, github.com/N8python/n8ao) in TSL: the library is WebGL only, this is its algorithm on
// the depth and normal textures the scene pass already makes.
//
// Not horizons like GTAO: points thrown into the hemisphere over each surface (a Fibonacci disc lifted onto it,
// so they fall cosine-weighted), each one projected and checked against the depth the picture has there; the
// part that lands behind something is the occlusion. Then a Poisson-disc blur that only mixes points lying on the
// same plane with the same normal, twice. The second pass can run at a finer size than the first: weighing by the
// plane and normal of its own pixels, it is also the upsample (no halo where the ball meets the cloth behind it).
//
// The noise is fixed to the screen (interleaved gradient noise, no frame count), so the loop's seam stays exact.
import { convertToTexture, dot, exp, float, Fn, fract, getScreenPosition, getViewPosition, If, max, screenCoordinate, screenSize, smoothstep, uniform, uv, vec2, vec3, vec4 } from "three/tsl";
import type { Node, PerspectiveCamera, TextureNode } from "three/webgpu";
import { finite3, notFinite, unitNormal } from "./finite.ts";

export const n8Look = {
  n8Radius: 0.5, // m the hemisphere reaches
  n8Falloff: 1, // how far in front an occluder may be and still count (x radius x 0.2)
  n8Intensity: 3, // a power on the open sky found (N8AO's default is 5)
  n8Blur: 8, // denoise reach, in texels of the occlusion
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type N = any;

export function n8ao(depth: TextureNode, normal: TextureNode, camera: PerspectiveCamera, o: { samples?: number; blurSamples?: number; size: number }) {
  const projInv = uniform(camera.projectionMatrixInverse);
  const proj = uniform(camera.projectionMatrix);
  const U = { radius: uniform(n8Look.n8Radius), falloff: uniform(n8Look.n8Falloff), blur: uniform(n8Look.n8Blur), ratio: uniform(1) };
  const count = o.samples ?? 16;
  const blurCount = o.blurSamples ?? 8;

  // N8AO's sample sets: a golden-angle spiral lifted onto the hemisphere, and a spiral disc for the blur
  const hemi = Array.from({ length: count }, (_, k) => {
    const th = 2.399963 * k, r = Math.sqrt(k + 0.5) / Math.sqrt(count);
    const x = r * Math.cos(th), y = r * Math.sin(th);
    return [x, y, Math.sqrt(1 - x * x - y * y)];
  });
  const disc = Array.from({ length: blurCount }, (_, i) => {
    const a = (2 * Math.PI * 11 * i) / blurCount, r = Math.pow((i + 1) / blurCount, 0.75);
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

  const open = (d: N) => d.lessThan(0.99999);
  const ign = (p: N) => fract(float(52.9829189).mul(fract(dot(p, vec2(0.06711056, 0.00583715)))));

  const occlusion = Fn(() => {
    const at = uv();
    const d = depth.sample(at).r;
    const out = vec4(1).toVar();
    // (a normal that is not a finite number leaves the point open: it must not spread through the blur)
    If(open(d).and(finite3(normal.sample(at).xyz)), () => {
      const P = getViewPosition(at, d, projInv).toVar();
      const Nn = unitNormal(normal.sample(at).xyz).toVar();
      const px = screenCoordinate.xy;
      const turn = ign(px).mul(Math.PI * 2);
      const shift = ign(px.add(vec2(37, 11)));
      const helper = Nn.y.abs().greaterThan(0.99).select(vec3(1, 0, 0), vec3(0, 1, 0));
      const T0 = helper.cross(Nn).normalize();
      const B0 = Nn.cross(T0);
      const c = turn.cos(), s = turn.sin();
      const T = T0.mul(c).add(B0.mul(s)).toVar();
      const B = B0.mul(c).sub(T0.mul(s)).toVar();
      const near = U.radius.mul(U.falloff).mul(0.2);
      const hit = float(0).toVar();
      const seen = float(0).toVar();
      hemi.forEach(([x, y, z], k) => {
        const dir = T.mul(x).add(B.mul(y)).add(Nn.mul(z));
        // each sample its own distance out, spread evenly and shifted per pixel
        const Q = P.add(dir.mul(U.radius.mul(fract(shift.add(k / count)))));
        const q = getScreenPosition(Q, proj);
        const inside = q.x.greaterThan(0).and(q.x.lessThan(1)).and(q.y.greaterThan(0)).and(q.y.lessThan(1)).and(Q.z.lessThan(-camera.near));
        const qc = q.clamp(0, 1);
        const there = getViewPosition(qc, depth.sample(qc).r, projInv).z.negate(); // what the picture shows
        const mine = Q.z.negate(); // where the sample is
        const range = smoothstep(0, 1, near.div(there.sub(mine).abs().max(1e-5)));
        const apart = qc.sub(at).mul(screenSize).length().greaterThanEqual(1); // not its own pixel
        const blocked = there.lessThan(mine).and(apart).select(range, 0);
        hit.addAssign(inside.select(blocked, 0));
        seen.addAssign(inside.select(1, 0));
      });
      const o = hit.div(max(seen, 1)).oneMinus().clamp(0, 1);
      out.assign(vec4(notFinite(o).select(1, o), 0, 0, 1));
    });
    return out;
  });

  const smooth = (src: N, pass: number) =>
    Fn(() => {
      const at = uv();
      const base = src.sample(at).r;
      const d = depth.sample(at).r;
      const out = vec4(base, 0, 0, 1).toVar();
      If(open(d).and(finite3(normal.sample(at).xyz)).and(notFinite(base).not()), () => {
        const P = getViewPosition(at, d, projInv).toVar();
        const Nn = unitNormal(normal.sample(at).xyz).toVar();
        const turn = ign(screenCoordinate.xy.add(pass * 23)).mul(Math.PI * 2);
        const c = turn.cos(), s = turn.sin();
        // the reach in texels of the occlusion, whatever size this pass draws at
        const step = vec2(1).div(screenSize).mul(U.blur).mul(pass === 0 ? float(1) : U.ratio);
        const inv = float(1).div(U.radius.mul(U.falloff).mul(0.2));
        const sum = float(base).toVar();
        const weight = float(1).toVar();
        disc.forEach(([x, y]) => {
          const q = at.add(vec2(c.mul(x).sub(s.mul(y)), s.mul(x).add(c.mul(y))).mul(step));
          const dq = depth.sample(q).r;
          const Pq = getViewPosition(q, dq, projInv);
          const plane = Pq.sub(P).dot(Nn).abs();
          const w0 = open(dq).select(exp(plane.mul(inv).negate()).mul(max(Nn.dot(unitNormal(normal.sample(q).xyz)), 0)), 0);
          const oq = src.sample(q).r;
          // (a sample that is not a finite number, or that a broken normal weighs as such, is left out)
          const w = notFinite(w0).or(notFinite(oq)).select(0, w0);
          sum.addAssign(notFinite(oq).select(0, oq).mul(w));
          weight.addAssign(w);
        });
        out.assign(vec4(sum.div(weight).clamp(0, 1), 0, 0, 1));
      });
      return out;
    });

  const raw = convertToTexture(occlusion(), null, null, { resolutionScale: o.size }) as N;
  const once = convertToTexture(smooth(raw, 0)(), null, null, { resolutionScale: o.size }) as N;
  const twice = convertToTexture(smooth(once, 1)(), null, null, { resolutionScale: Math.min(1, o.size * 2) }) as N;

  const setSize = (size: number) => {
    raw.setResolutionScale(size);
    once.setResolutionScale(size);
    const fine = Math.min(1, size * 2);
    twice.setResolutionScale(fine);
    U.ratio.value = fine / size;
  };
  setSize(o.size);
  const refresh = (l: typeof n8Look) => {
    U.radius.value = l.n8Radius;
    U.falloff.value = l.n8Falloff;
    U.blur.value = l.n8Blur;
  };
  return { raw: raw as Node, smooth: twice as Node, setSize, refresh, U };
}
