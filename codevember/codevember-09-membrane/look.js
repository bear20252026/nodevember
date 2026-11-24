// The look: a stained cell under the microscope, on a plain neutral slide (violet and magenta
// stains, dark nuclei). The fluid is the sim's grid, read from two textures: its dye (how
// much of it is cytoplasm) raises a surface, as high as the membrane's blocks inside the
// cell, rounded down to the slide where it lies spilt, a clear, stained jelly the slide's
// light is seen through (coloured by as much of it as it crosses); its material coordinates
// carry its stain, so the streaks and granules are carried, stretched and swirled by the
// flow (marbled). The surface is opaque to the renderer (the slide behind it is drawn in its
// own shader), so the jelly blocks of the membrane (transmissive) show it, blurred, through
// them; what it holds is drawn on its surface where it is seen down in it (SUBMERGE).
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const NOISE = /* glsl */ `
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;

// the slide's colour at (w), seen from (far) away, and the microscope's vignette and grain
// over the screen (uv) — shared by the slide and the fluid lying on it
const SLIDE = /* glsl */ `
  vec3 slide(vec2 w, float far) {
    // a plain, neutral lab surface, evenly lit, a very soft falloff away from the centre
    vec3 bg = vec3(0.925, 0.93, 0.935);
    bg *= 1.0 - min(dot(w, w) * 0.0009, 0.08);
    // seen low, the far slide blurs out of focus into a pale haze up to the horizon
    return mix(bg, vec3(0.915, 0.92, 0.925), smoothstep(30.0, 90.0, far));
  }
  // the slide darkened a little round and under the fluid lying on it (the light it holds
  // off), from the dye's texture at fu
  float underFluid(sampler2D dyeTex, vec2 fu, float texel) {
    float sh = 0.0;
    for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) sh += texture2D(dyeTex, fu + vec2(i, j) * texel * 2.0).r;
    return 1.0 - 0.09 * smoothstep(0.0, 0.45, sh / 9.0);
  }
  vec3 finish(vec3 col, vec2 uv, float time) {
    vec2 q = uv - 0.5;
    col *= 1.0 - dot(q, q) * 0.35;
    return col + (hash(uv * 1000.0 + fract(time)) - 0.5) * 0.018;
  }
`;

// the fluid's edge, shared by its surface's vertices and pixels: the dye (d) made a little
// ragged at (w), as a thick liquid's edge is; the edge where it is EDGE_AT; and the height's
// profile across it (main.js's fluidProfile): 0 there, rising steeply (the angle it meets
// the slide at) and rounding off to 1 at 0.8, carried on below 0 under the slide
export const EDGE_AT = 0.47;
const EDGE = /* glsl */ `
  const float EDGE_AT = ${EDGE_AT.toFixed(3)};
  float ragged(float d, vec2 w, float time) {
    return d + (fbm(w * 2.5 + vec2(time * 0.02, -time * 0.015)) - 0.5) * 0.18 * smoothstep(0.05, 0.4, d) * smoothstep(0.95, 0.6, d);
  }
  float profile(float d) {
    float u = (d - EDGE_AT) / (0.8 - EDGE_AT);
    return u >= 0.0 ? 1.0 - (1.0 - min(u, 1.0)) * (1.0 - min(u, 1.0)) : 2.0 * max(u, -1.0);
  }
`;
export const fluidProfile = (d) => {
  const u = Math.min(1, (d - EDGE_AT) / (0.8 - EDGE_AT));
  return u > 0 ? 1 - (1 - u) * (1 - u) : 0;
};

// the spill soaked into the slide: where the fluid has crept out into the medium (the sim:
// along its grain, the dye thinning out past its edge, away from the membrane's walls), the
// medium is wet with it, drawn into its fibres — a thin stain in the slide itself, not on the
// fluid, in the fine streaks each fibre is made of, reaching furthest where the grain runs out
// of the fluid (crosses its edge), least where it runs along it, fading as it thins out
const SEEP = /* glsl */ `
  // fine streaks in the slide's plane, combed along the angle th (0..π): the noise
  // stretched along it, in one of 8 fixed directions, crossfaded to the next (a field
  // fixed on the slide, as the medium's fibres are)
  float combed(vec2 w, float th) {
    float q = th / 3.14159265 * 8.0, q0 = floor(q), t = q - q0;
    float s = 0.0;
    for (int k = 0; k < 2; k++) {
      float an = (q0 + float(k)) * 3.14159265 / 8.0, ca = cos(an), sa = sin(an);
      vec2 p = vec2(-sa * w.x + ca * w.y, ca * w.x + sa * w.y); // x across the fibres, y along
      float o = mod(q0 + float(k), 8.0);
      float h = 0.55 * vnoise(vec2(p.x * 30.0, p.y * 2.6) + o * 7.1)
              + 0.45 * vnoise(vec2(p.x * 70.0, p.y * 5.0) + o * 3.7 + 11.0);
      s += h * (k == 0 ? 1.0 - t : t);
    }
    return s;
  }
  // how wet the slide is with it at w (fu on the dye's texture): x the wet (0..1), y its
  // front (a thin band where it stops, darker, as a drying stain's edge)
  vec2 seep(sampler2D dyeTex, sampler2D grainTex, vec2 fu, vec2 w, float texel, float rw, float hc) {
    vec2 t = texture2D(dyeTex, fu).rg;
    float free = smoothstep(rw + 0.02, rw + 2.0 * hc, t.y);
    if (t.x < 0.01 || free <= 0.0) return vec2(0.0);
    vec4 gr = texture2D(grainTex, fu);
    vec2 g2 = gr.xy * 2.0 - 1.0;
    float th = atan(g2.y, g2.x) * 0.5;
    th = th < 0.0 ? th + 3.14159265 : th;
    vec2 fib = vec2(cos(th), sin(th));
    float e = texel * 1.5;
    vec2 gd = vec2(texture2D(dyeTex, fu + vec2(e, 0.0)).r - texture2D(dyeTex, fu - vec2(e, 0.0)).r,
                   texture2D(dyeTex, fu + vec2(0.0, e)).r - texture2D(dyeTex, fu - vec2(0.0, e)).r);
    float across = length(gd) > 1e-4 ? abs(dot(normalize(gd), fib)) : 0.0;
    float hair = smoothstep(0.2, 0.8, combed(w, th));
    // drawn out along the fibres: the thin dye pushed further out along some, held back along
    // others, the more readily the medium takes it (gr.z) and across the edge
    float reach = t.x + (hair - 0.5) * (0.06 + 0.3 * gr.z) * (0.4 + 0.6 * across) * smoothstep(0.0, 0.2, t.x);
    // and it soaks in only as far as the medium lets it: far along its channels (gr.z), only
    // a little past the fluid's foot elsewhere
    float lo = mix(0.3, 0.04, gr.z);
    float wet = smoothstep(lo, lo + 0.2, reach) * free;
    float front = exp(-pow((reach - lo - 0.03) / 0.035, 2.0)) * free * gr.z;
    // densest at the fluid's foot, as stained as the fluid's thin edge there, so the two run
    // into each other, thinning out away from it
    float near = smoothstep(lo + 0.05, EDGE_AT, t.x) * free;
    // as far as it has soaked in yet (gr.w: a spot takes it up over a few seconds after the
    // spill reaches it), the fibres first, the rest after
    float soak = gr.w;
    float inFib = smoothstep(0.0, 0.45, soak * (0.6 + 0.8 * hair));
    // the stain soaked into the fibres themselves: a little denser along the streaks
    return vec2(wet * (0.6 + 0.4 * hair) * 0.6 + near * 0.55, front * hair) * inFib * sqrt(soak);
  }
  // the slide's colour stained by it: the light it takes out, as the fluid does (green most);
  // dying, it goes the fluid's dull greyish mauve with it, so its foot is no brighter a
  // magenta than the fluid it runs out of (it would read as an outline)
  vec3 soaked(vec3 col, vec2 sp, float death) {
    vec3 absorb = mix(vec3(0.42, 1.25, 0.32), vec3(0.55, 0.85, 0.7) * 1.3, death);
    vec3 s = col * exp(-absorb * (sp.x * 0.32 + sp.y * 0.2));
    return mix(s, vec3(dot(s, vec3(0.3, 0.55, 0.15))) * vec3(1.0, 0.97, 0.98), death * 0.45);
  }
`;

// ---- the slide (a fullscreen quad, opaque, drawn first), darkened a little round the
// fluid lying on it (the light it holds off), stained where the spill has soaked into it
export function createBackdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uDye: { value: null },
      uGrain: { value: null },
      uTexel: { value: 1 },
      uFW: { value: 1 },
      uRW: { value: 0.25 },
      uHC: { value: 0.1 },
      uInvViewProj: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uDeath: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDye, uGrain;
      uniform float uTexel, uFW, uTime, uRW, uHC, uDeath;
      uniform mat4 uInvViewProj;
      uniform vec3 uCamPos;
      varying vec2 vUv;
      ${NOISE}
      ${SLIDE}
      ${EDGE}
      ${SEEP}
      float far; // how far the slide is, along the view ray
      vec2 planePoint(vec2 uv) {
        vec4 p = uInvViewProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 dir = normalize(p.xyz / p.w - uCamPos);
        dir.z = min(dir.z, -0.01); // at and past the horizon, the slide far away
        far = -uCamPos.z / dir.z;
        return (uCamPos + dir * far).xy;
      }
      void main() {
        vec2 w = planePoint(vUv);
        vec3 col = slide(w, far);
        // the fluid's soft contact shadow, darkest where it meets the slide
        vec2 fu = (w + uFW) / (2.0 * uFW);
        col *= underFluid(uDye, fu, uTexel);
        // the spill soaked into it, along the medium's fibres
        col = soaked(col, seep(uDye, uGrain, fu, w, uTexel, uRW, uHC), uDeath);
        gl_FragColor = vec4(finish(col, vUv, uTime), 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
  quad.frustumCulled = false;
  quad.renderOrder = -10;
  return quad;
}

// ---- the fluid: a surface over the whole grid, raised where there is cytoplasm, as high as
// the membrane's blocks (it fills the cell), its edge rounded down to the slide where it
// lies free, climbing a little against the blocks (a meniscus). Translucent, but drawn
// opaque (so the jelly blocks show it through them), its edge cut out. The dye's texture:
// r the dye, g the distance to the membrane's walls (from their middle; the walls
// themselves, a ramp across their edge, made of it here).
export function createFluidSurface(fw, g) {
  const seg = g * 2;
  const geo = new THREE.PlaneGeometry(2 * fw, 2 * fw, seg, seg);
  geo.deleteAttribute('normal');
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uDye: { value: null },
      uFlow: { value: null },
      uGrain: { value: null }, // the medium's grain: its fibres (cos 2θ, sin 2θ), how readily it creeps along them
      uTexel: { value: 1 / g },
      uFW: { value: fw },
      uWA: { value: 1 },
      uH: { value: 0.13 },
      uRW: { value: 0.25 }, // the walls' half width
      uHC: { value: 0.1 }, // the grid's cell
      uRes: { value: new THREE.Vector2(1, 1) },
      uDeath: { value: 0 },
      uTime: { value: 0 },
      uSeed: { value: 0 },
      uDepth: { value: 3 },
      // the nucleus and the vesicles: x, y, radius, how much is left of it (it fades dying)
      uBodies: { value: [...Array(16)].map(() => new THREE.Vector4()) },
    },
    vertexShader: /* glsl */ `
      uniform sampler2D uDye;
      uniform float uTexel, uFW, uH, uRW, uHC, uTime;
      varying vec2 vW, vFu;
      varying vec3 vN;
      varying float vH, vD;
      ${NOISE}
      ${EDGE}
      // the walls: 1 inside, 0 a cell out, ½ on their edge
      float wallAt(float d) { return clamp(0.5 + (uRW - d) / (2.0 * uHC), 0.0, 1.0); }
      // the dye blurred over a few cells (the body's rounded edge), its edge a little ragged
      // (r), and the walls blurred the same (g)
      vec2 body(vec2 fu) {
        vec2 s = vec2(0.0);
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 t = texture2D(uDye, fu + vec2(i, j) * uTexel * 1.6).rg;
          s += vec2(t.r, wallAt(t.g));
        }
        s /= 9.0;
        s.r = ragged(s.r, fu * 2.0 * uFW - uFW, uTime);
        return s;
      }
      // the height: rounded down to the slide, reaching it (0) right where the edge is cut
      // (the profile carried on below it, under the slide, so that between two vertices it
      // still meets the slide there, not in the air), and the meniscus where it meets the
      // walls (under the membrane it sinks, out of the blocks' way)
      float height(vec2 fu, out float d) {
        vec2 s = body(fu);
        d = s.r;
        float wall = wallAt(texture2D(uDye, fu).g);
        return profile(d) * (uH * (1.0 - 0.75 * wall) + 0.025 * smoothstep(0.05, 0.4, s.g) * (1.0 - wall));
      }
      float height(vec2 fu) { float d; return height(fu, d); }
      void main() {
        vec2 w = position.xy;
        vec2 fu = (w + uFW) / (2.0 * uFW);
        float e = uTexel * 1.5, ew = e * 2.0 * uFW;
        float d;
        float h = height(fu, d);
        float hx = height(fu + vec2(e, 0.0)) - height(fu - vec2(e, 0.0));
        float hy = height(fu + vec2(0.0, e)) - height(fu - vec2(0.0, e));
        vN = normalize(vec3(-hx / (2.0 * ew), -hy / (2.0 * ew), 1.0));
        vW = w; vFu = fu; vH = h; vD = d;
        vec4 wp = modelMatrix * vec4(w, h, 1.0);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uDye, uFlow, uGrain;
      uniform float uTexel, uFW, uWA, uDeath, uTime, uSeed, uDepth, uRW, uHC;
      uniform vec4 uBodies[16];
      uniform vec2 uRes;
      varying vec2 vW, vFu;
      varying vec3 vN;
      varying float vH, vD;
      ${NOISE}
      ${SLIDE}
      ${EDGE}
      ${SEEP}
      float dye(vec2 uv) { return texture2D(uDye, uv).r; }
      // the stain, in the fluid (at its material coordinates X): broad streaks, patches dense
      // with granules, fine specks
      vec3 stain(vec2 X) {
        float streak = fbm(X * 1.7 + uSeed);
        float gran = smoothstep(0.5, 0.78, fbm(X * 4.2 + 7.3 + uSeed));
        float speck = smoothstep(0.62, 0.8, vnoise(X * 15.0 + fbm(X * 3.0) * 3.0));
        return vec3(streak, gran, speck);
      }
      // the same, deeper down, out of focus: its fine detail lost
      vec2 stainSoft(vec2 X) {
        return vec2(fbm(X * 1.7 + uSeed), smoothstep(0.42, 0.85, fbm(X * 4.2 + 7.3 + uSeed)));
      }
      // its skin's relief (at X): soft lumps, thin ridges (wrinkles, fibres) and a fine grain
      float skin(vec2 X) {
        X += uSeed * 0.37;
        float lumps = vnoise(X * 5.0) * 0.6 + vnoise(X * 11.0 + 3.7) * 0.4;
        float ridge = 1.0 - abs(vnoise(X * 7.5 + vnoise(X * 2.0) * 2.0) * 2.0 - 1.0);
        float grain = vnoise(X * 38.0);
        return lumps * 0.5 + ridge * ridge * 0.35 + grain * 0.15;
      }
      vec2 skinGrad(vec2 X) {
        float e = 0.012, c = skin(X);
        return vec2(skin(X + vec2(e, 0.0)) - c, skin(X + vec2(0.0, e)) - c) / e;
      }
      void main() {
        vec2 w = vW, fu = vFu;
        // its edge, cut out where it meets the slide (its height there nought, so it lies on
        // it rather than ending in a step above it); where it has crept out further into the
        // medium, it is soaked into the slide (SEEP), not drawn on the fluid
        if (vH < 0.0) discard;
        float d = vD;
        // the fine relief, over the body's own shape
        float t1 = uTexel * 1.5;
        float dx = dye(fu + vec2(t1, 0.0)) - dye(fu - vec2(t1, 0.0));
        float dy = dye(fu + vec2(0.0, t1)) - dye(fu - vec2(0.0, t1));
        vec3 nb = normalize(vN);
        // and its skin's own texture, carried (stretched, swirled) by the flow as its stain
        // is: soft lumps, a fine grain, wrinkles drawn out along the streams
        vec4 disp = texture2D(uFlow, fu);
        vec2 Xa = w + disp.zw, Xb = w + disp.xy;
        vec2 rg = mix(skinGrad(Xa), skinGrad(Xb), uWA);
        float rough = mix(skin(Xa), skin(Xb), uWA);
        // flat, thin films of it out on the slide show it less
        float body = smoothstep(0.02, 0.08, vH);
        vec3 n = normalize(nb + vec3(-dx * 0.25 - rg.x * 0.11 * body, -dy * 0.25 - rg.y * 0.11 * body, 0.0));
        vec3 P = vec3(w, vH);
        vec3 V = normalize(cameraPosition - P);
        float cosV = clamp(dot(n, V), 0.0, 1.0);

        // a clear, thick jelly lit from below, through the slide (as a microscope's light):
        // what's seen is the slide behind it, the light bent at its surface and coloured by
        // what the stain takes out of it along the way through. Its optical depth (uDepth: as
        // deep as it looks, a few times its height) sets how far in the eye sees, and how
        // much the view shifts down there as the slide is tilted
        float depth = max(vH, 0.03) * uDepth;
        vec3 R = refract(-V, n, 1.0 / 1.36);
        float down = max(-R.z, 0.25);
        vec2 slideAt = w + R.xy / down * depth;
        float path = depth / down; // how far the light crosses it
        vec2 fuAt = (slideAt + uFW) / (2.0 * uFW);
        // (the slide soaked with it seen through its thin edge only, carrying the stain on
        // past its foot; deeper in, the fluid's own stain is all there is)
        vec3 behind = soaked(slide(slideAt, length(cameraPosition - P)) * underFluid(uDye, fuAt, uTexel),
                             seep(uDye, uGrain, fuAt, slideAt, uTexel, uRW, uHC) * (1.0 - smoothstep(0.0, 0.1, vH)), uDeath);

        // the stain, through both fields of coordinates (crossfaded as one is reset): sharp
        // just under the surface, and again blurred, halfway down (seen there, along the
        // bent ray: it slides under the top layer as the view turns, a depth of its own)
        vec3 s = mix(stain(Xa), stain(Xb), uWA);
        vec2 mid = R.xy / down * depth * 0.55;
        vec4 dispM = texture2D(uFlow, fu + mid / (2.0 * uFW));
        vec2 sd = mix(stainSoft(w + mid + dispM.zw + 3.1), stainSoft(w + mid + dispM.xy + 3.1), uWA);

        // how much it takes out of the light, per unit of the way: green most (the lilac),
        // more where it's stained deeper, by streak and granule; dead, it turns a dull
        // brownish grey and clouds over
        float dens = 0.55 + ((s.x - 0.45) * 0.9 + s.y * 0.45 + s.z * 0.5 * (0.4 + 0.6 * s.y)
                   + (sd.x - 0.45) * 0.8 + sd.y * 0.5) * (1.0 - uDeath * 0.45);
        // the nucleus and the vesicles in it (drawn themselves, through it): a faint shade
        // round them, down along the bent ray
        vec2 low = w + R.xy / down * depth * 0.6;
        float sunk = 0.0;
        for (int i = 0; i < 16; i++) {
          vec4 b = uBodies[i];
          if (b.z <= 0.0) continue;
          float q = length(low - b.xy) / b.z;
          sunk += smoothstep(1.5, 1.0, q) * 0.25 * b.w;
        }
        dens += sunk;
        // its skin's texture in its colour too: thicker in the lumps and along the wrinkles
        dens += (rough - 0.4) * 0.6;
        dens = max(dens, 0.12);
        vec3 absorb = mix(vec3(0.42, 1.25, 0.32), vec3(0.55, 0.85, 0.7), uDeath) * (1.0 + uDeath * 0.3);
        vec3 T = exp(-absorb * dens * path * 1.45);
        // and some light scattered back up in it (milky, lilac): its body, lit from above
        vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
        float diff = clamp(dot(nb, L), 0.0, 1.0) * 0.7 + clamp(dot(n, L), 0.0, 1.0) * 0.3;
        vec3 milk = mix(vec3(0.78, 0.60, 0.80), vec3(0.76, 0.66, 0.68), uDeath) * (0.75 + 0.35 * diff);
        float cloud = 1.0 - exp(-path * (0.9 + uDeath * 2.2) * (0.6 + 0.4 * dens));
        vec3 f = behind * T;
        f = mix(f, milk * mix(vec3(1.0), T, 0.5), cloud * 0.4);
        // the specks and granules caught in its top: small dark points of stain, sharp
        vec3 granc = mix(vec3(0.50, 0.18, 0.46), vec3(0.42, 0.32, 0.30), uDeath);
        f = mix(f, granc, s.z * 0.28 * (0.4 + 0.6 * s.y));
        // (no line of its own where it meets the slide: it runs on into the stain soaked into it)

        // a matte, thick skin rather than a wet mirror: the room only faintly, blurred, at
        // grazing angles (its spilt edge mostly), and a broad dull sheen broken up by its relief
        float F = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
        vec3 Rr = reflect(-V, n);
        vec3 room = mix(f * 1.1, vec3(0.9, 0.88, 0.92), 0.5 * smoothstep(-0.2, 0.8, Rr.z));
        f = mix(f, room, min(F, 0.6) * 0.3);
        vec3 H = normalize(L + V);
        float wet = 1.0 - uDeath * 0.7;
        f += vec3(1.0, 0.97, 0.99) * pow(clamp(dot(n, H), 0.0, 1.0), 6.0) * 0.025 * (0.4 + 0.6 * rough) * wet;
        gl_FragColor = vec4(finish(f, gl_FragCoord.xy / uRes, uTime), 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

// ---- the membrane's blocks: translucent jelly with a small dark core each
export function createJellyMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe4e9e8, // milky, nearly colourless jelly
    // a frosted shell, not glass: nearly clear, but what's seen through is strongly blurred
    // (the cores glow soft and coloured inside, their edges lost); no clearcoat, a weak,
    // broad highlight, and a thin bright line along its silhouette (the rim, below)
    // three blurs what's seen through by a screen-space mip level, log2(width) × roughness ×
    // (2·ior − 2): about 3.5 levels here, enough to soften the cores into glows without
    // averaging them away (more, and only the fluid behind is left)
    roughness: 0.7,
    transmission: 1,
    thickness: 0.25,
    ior: 1.25,
    attenuationColor: new THREE.Color(0xd4dedc),
    attenuationDistance: 1.2,
    sheen: 0.12,
    sheenRoughness: 1,
    sheenColor: new THREE.Color(0xf2f6f5),
    specularIntensity: 0.1,
  });
  // each block is bent into the space between its two joints with its neighbours (the
  // midpoints of its links, faced square to them), so neighbours share a face: no gap.
  // Its thickness (squashed and swelling, jelly-like) bulges in the middle.
  //   aJ0, aJ1: the joints (x, y, angle of the link there); aShape: thickness, bulge, depth, roll
  mat.userData.rim = { value: 0.35 };
  mat.onBeforeCompile = (sh) => {
    // the rim: a thin pale line where the shell is seen edge-on (fresnel), outlining the blob
    sh.uniforms.uRim = mat.userData.rim;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uRim;`)
      .replace('#include <opaque_fragment>', `
        float jrim = 1.0 - abs(dot(normalize(vViewPosition), normalize(normal)));
        outgoingLight += vec3(0.97, 0.98, 1.0) * uRim * pow(jrim, 5.0);
        #include <opaque_fragment>`);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 aJ0, aJ1;
        attribute vec4 aShape;
        float jellyS() { return clamp(position.x + 0.5, 0.0, 1.0); }
        vec2 jellyDir(float s) { float a = mix(aJ0.z, aJ1.z, s); return vec2(cos(a), sin(a)); }
        vec3 jellyRoll(vec3 v) { float c = cos(aShape.w), sn = sin(aShape.w); return vec3(v.x, v.y * c - v.z * sn, v.y * sn + v.z * c); }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 jn = jellyRoll(normal);
        vec2 jt = jellyDir(jellyS());
        vec3 objectNormal = normalize(vec3(jn.x * jt + jn.y * vec2(-jt.y, jt.x), jn.z));`)
      .replace('#include <begin_vertex>', `
        float js = jellyS();
        vec2 jd = jellyDir(js);
        float jb = 1.0 + aShape.y * (1.0 - (2.0 * js - 1.0) * (2.0 * js - 1.0));
        vec3 jp = jellyRoll(position * vec3(1.0, aShape.x * jb, aShape.z * jb));
        // the centreline: from joint to joint, curving with their angles (hermite)
        float L = distance(aJ0.xy, aJ1.xy);
        vec2 m0 = vec2(cos(aJ0.z), sin(aJ0.z)) * L, m1 = vec2(cos(aJ1.z), sin(aJ1.z)) * L;
        float s2 = js * js, s3 = s2 * js;
        vec2 jc = (2.0 * s3 - 3.0 * s2 + 1.0) * aJ0.xy + (s3 - 2.0 * s2 + js) * m0 + (-2.0 * s3 + 3.0 * s2) * aJ1.xy + (s3 - s2) * m1;
        vec3 transformed = vec3(jc + vec2(-jd.y, jd.x) * jp.y, jp.z);`);
  };
  mat.customProgramCacheKey = () => 'jelly-blocks';
  return mat;
}

// a rounded box, subdivided along its length so it can bend and bulge
export function createBlockGeometry(radius = 0.2) {
  const box = new THREE.BoxGeometry(1, 1, 1, 12, 6, 6);
  box.deleteAttribute('normal');
  box.deleteAttribute('uv');
  const p = box.attributes.position, h = 0.5 - radius;
  const v = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    c.set(THREE.MathUtils.clamp(v.x, -h, h), THREE.MathUtils.clamp(v.y, -h, h), THREE.MathUtils.clamp(v.z, -h, h));
    v.sub(c);
    if (v.lengthSq() > 1e-12) v.setLength(radius);
    p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  const geo = mergeVertices(box, 1e-5);
  geo.computeVertexNormals();
  return geo;
}

// each block's cores: small dark blobs (wine, plum, aubergine: the instance colour), lit (a
// round body, a soft highlight) and glowing faintly from within, seen blurred through the
// frosted shell
export function createCoreMaterial() {
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.45,
    sheen: 0.5,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xf4ecee), // (only a hint of pink, like the cores)
  });
  mat.userData.glow = { value: 0.12 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = mat.userData.glow;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uGlow;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        #ifdef USE_COLOR
          totalEmissiveRadiance += vColor.rgb * uGlow;
        #endif`);
  };
  mat.customProgramCacheKey = () => 'gummy-cores';
  return mat;
}

// ---- the two thin membranes on each side: thin films standing beside the blocks, as tall
// as they are. Each is a sheet (upright) and its top edge (a narrow cap, so that seen from
// straight above it still reads as a line). Like a soap film, it is faint seen face-on and
// dense seen edge-on (the light crosses more of it), with a faint iridescence.
// The outer one (cells: 1) is a sheet of small cells, as a stained tissue is: pale, speckled
// cell bodies packed together, their walls a deeper pink, each with a dark purple nucleus
// (mottled, some in focus, some faint, out of the plane, a few cut without one). The
// pattern is in the film's own coordinates, so it is carried, stretched and twisted with it.
//   alpha: fading at the torn ends; across: -1..1 over the sheet's height or the cap's
//   width; kind: 0 the sheet, 1 the cap; sheetN: the sheet's normal (in the plane, but where
//   the film twists); pat: along the film, up the sheet (units)
export const FILM_CELL = 0.11; // a cell's size on the outer film (units)
export function createFilmMaterial(color, cells = 0) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.9 }, uCells: { value: cells } },
    vertexShader: /* glsl */ `
      attribute float alpha, across, kind;
      attribute vec3 sheetN;
      attribute vec2 pat;
      varying float vAlpha, vAcross, vKind;
      varying vec2 vPat;
      varying vec3 vN, vView;
      void main() {
        vAlpha = alpha; vAcross = across; vKind = kind; vPat = pat;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * sheetN);
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity, uCells;
      varying float vAlpha, vAcross, vKind;
      varying vec2 vPat;
      varying vec3 vN, vView;
      ${NOISE}
      vec2 h2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
      // the cells: packed, roundish polygons (a jittered grid, a little irregular). Returns
      // the distance to the nearest wall (x) and the point relative to its own cell's middle
      // (zw), and that cell's id (out)
      vec3 cellsAt(vec2 p, out vec2 id) {
        vec2 i = floor(p), f = fract(p), mr = vec2(0.0), mi = vec2(0.0);
        float md = 8.0;
        for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
          vec2 g = vec2(x, y), o = 0.5 + 0.38 * sin(6.2831 * h2(i + g)), r = g + o - f;
          float d = dot(r, r);
          if (d < md) { md = d; mr = r; mi = i + g; }
        }
        float wall = 8.0;
        for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
          vec2 g = mi - i + vec2(x, y), o = 0.5 + 0.38 * sin(6.2831 * h2(i + g)), r = g + o - f;
          if (dot(mr - r, mr - r) > 1e-5) wall = min(wall, dot(0.5 * (mr + r), normalize(r - mr)));
        }
        id = mi;
        return vec3(wall, -mr);
      }
      void main() {
        float c = abs(dot(normalize(vN), normalize(vView)));
        // the optical path through the film: faint face-on, only a little denser edge-on
        // (seen from above, it stays a soft line, not a dark one)
        float dens = 1.0 - exp(-0.28 / max(c, 0.55));
        float a2 = vAcross * vAcross;
        // the sheet: evenly coloured over its height, a floor so it never quite vanishes
        float sheet = 0.06 + 0.9 * dens;
        // the cap: its edge, soft across (blurred, out of focus)
        float cap = (0.07 + 0.2 * dens) * (exp(-a2 * 6.0) * 0.8 + exp(-a2 * 2.0) * 0.2);
        float a = mix(sheet, cap, vKind);
        vec3 col = uColor + 0.1 * (1.0 - c) * (0.5 + 0.5 * cos(6.2832 * (c * 1.3 + vAcross * 0.15 + vec3(0.0, 0.33, 0.67))));

        if (uCells > 0.0 && vKind < 0.5) {
          vec2 p = vPat / ${FILM_CELL.toFixed(3)};
          // a little wobble, so the walls aren't ruled straight
          p += (vec2(vnoise(p * 1.7), vnoise(p * 1.7 + 9.3)) - 0.5) * 0.35;
          vec2 id;
          vec3 cl = cellsAt(p, id);
          vec2 rnd = h2(id + 3.7), rnd2 = h2(id * 1.31 + 11.0);
          float px = max(fwidth(p.x) + fwidth(p.y), 1e-4);
          // seen edge-on the cells crowd into a blur: the pattern fades there (and very far)
          float vis = uCells * smoothstep(0.12, 0.45, c) * (1.0 - smoothstep(0.12, 0.35, px));
          // the walls: thin, a deeper pink, soft
          float wall = 1.0 - smoothstep(0.0, 0.07 + px, cl.x);
          // the bodies: pale and speckled, a little uneven from cell to cell
          float speck = vnoise(vPat * 260.0) * 0.6 + vnoise(vPat * 520.0 + 3.1) * 0.4;
          float body = 0.75 + 0.25 * rnd2.x;
          // the nucleus: a dark round blob off its cell's middle, mottled (its chromatin);
          // some sharp, some faint (out of the plane), a few cells without one
          vec2 off = (rnd - 0.5) * 0.22;
          float nr = 0.25 + 0.08 * rnd2.y;
          float nd = length((cl.yz - off) * vec2(1.0, 1.0 + 0.25 * (rnd.x - 0.5)));
          float focus = rnd2.x < 0.3 ? 0.06 : 0.025;
          float nuc = (1.0 - smoothstep(nr - focus - px, nr + focus + px, nd)) * step(0.12, rnd.y);
          float strength = rnd2.x < 0.3 ? 0.45 : 1.0;
          float chrom = 0.65 + 0.35 * vnoise(vPat * 330.0 + id * 7.0) + 0.25 * (1.0 - nd / nr);
          vec3 cBody = mix(vec3(0.92, 0.76, 0.90), vec3(0.80, 0.58, 0.82), speck * 0.6) * body;
          vec3 cWall = vec3(0.70, 0.33, 0.62);
          vec3 cNuc = mix(vec3(0.42, 0.24, 0.62), vec3(0.17, 0.06, 0.32), clamp(chrom, 0.0, 1.0));
          vec3 pc = mix(cBody, cWall, wall);
          pc = mix(pc, cNuc, nuc * strength);
          float pa = 0.22 + 0.12 * speck + 0.35 * wall + 0.55 * nuc * strength;
          col = mix(col, pc, vis * 0.85);
          a = mix(a, max(a * 0.6, pa), vis);
        }
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha * uOpacity);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- the liquid the blocks lie in, between the two films: like the cell's fluid inside,
// but clear (a lilac tint, faint granules), glossy, its surface rising against the films
// (a meniscus).  across: -1 (inner film) .. 1 (outer film); alpha: fading at torn ends
export function createLiquidMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uDeath: { value: 0 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float alpha, across;
      varying float vAlpha, vAcross;
      varying vec3 vN, vView, vW;
      void main() {
        vAlpha = alpha; vAcross = across;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vW = wp.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vView = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDeath, uTime;
      varying float vAlpha, vAcross;
      varying vec3 vN, vView, vW;
      ${NOISE}
      void main() {
        vec3 n = normalize(vN), v = normalize(vView);
        if (dot(n, v) < 0.0) n = -n;
        vec2 w = vW.xy;
        // granules and slow streaks, as in the fluid inside, much sparser
        float flow = fbm(w * 2.2 + vec2(uTime * 0.03, -uTime * 0.02));
        float speck = smoothstep(0.7, 0.85, vnoise(w * 26.0 + fbm(w * 3.0) * 3.0));
        vec3 base = mix(vec3(0.90, 0.78, 0.90), vec3(0.80, 0.74, 0.72), uDeath);
        vec3 deep = mix(vec3(0.66, 0.42, 0.70), vec3(0.56, 0.48, 0.46), uDeath);
        vec3 col = mix(base, deep, flow * 0.35 + speck * 0.4);
        // the meniscus against the films: a little deeper in colour
        float rim = smoothstep(0.6, 1.0, abs(vAcross));
        col = mix(col, deep, rim * 0.35);
        // a grainy, fibrous body, as the fluid inside: fine wrinkles along its flow
        float fib = 1.0 - abs(vnoise(w * 9.0 + flow * 3.0) * 2.0 - 1.0);
        float grain = vnoise(w * 45.0);
        col = mix(col, deep, fib * fib * 0.25 + (grain - 0.5) * 0.12);
        // matte: a dull broad sheen, a faint edge
        vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
        float spec = pow(clamp(dot(reflect(-L, n), v), 0.0, 1.0), 6.0) * 0.06;
        float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0);
        col += vec3(spec * (1.0 - uDeath * 0.6));
        float a = 0.16 + flow * 0.06 + speck * 0.12 + fib * fib * 0.06 + rim * 0.1 + fres * 0.1;
        // dying, it clouds over
        a += uDeath * 0.12;
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- the content: a nucleus, vesicles. Each a dome standing on the slide (a half
// ellipsoid, its height a fraction of its radius), shaded as a body by the key light (from
// the upper left, as the fluid's), its surface given a relief by what's in it, darker where
// it meets the fluid, and casting a soft shadow on it (createBodyShadow)
const LIGHT = /* glsl */ `const vec3 KEY = vec3(-0.43, 0.54, 0.72);`;
// Not a half sphere: a cushion, its side rising steep from the slide, rounded over into a
// low, almost flat top (the profile drawn in the design: a near upright side, a quarter of
// the radius high, then a broad gentle arch). Its section, from the rim on the slide to the
// pole, as two cubic arcs (the side, then the top up to the middle), in the drawing's units
const DOME_PROFILE = [
  [[201.6, 250.24], [201.6, 250.24], [197.31, 240.46], [201.6, 228.9]],
  [[201.6, 228.9], [205.9, 217.35], [365.53, 215.2], [372.46, 228.9]],
];
export function createDomeGeometry() {
  const cx = (201.6 + 372.46) / 2, base = 250.24;
  const bez = (c, t, k) => { const u = 1 - t; return u * u * u * c[0][k] + 3 * u * u * t * c[1][k] + 3 * u * t * t * c[2][k] + t * t * t * c[3][k]; };
  const pts = [];
  DOME_PROFILE.forEach((c, s) => {
    const n = s === 0 ? 16 : 60;
    for (let i = s === 0 ? 0 : 1; i <= n; i++) {
      const t = i / n, x = bez(c, t, 0), y = bez(c, t, 1);
      if (x >= cx) break; // only up to the middle
      pts.push([cx - x, base - y]);
    }
  });
  pts.push([0, Math.max(...pts.map((p) => p[1]))]); // the pole, flat
  // unit radius (its widest), unit height: the mesh's scale is (r, r, r h)
  const R = Math.max(...pts.map((p) => p[0])), H = pts[pts.length - 1][1];
  const g = new THREE.LatheGeometry(pts.map(([r, z]) => new THREE.Vector2(r / R, z / H)), 72);
  g.rotateX(Math.PI / 2); // its pole up (+z), its rim on the slide
  return g;
}
// the dome's normal, in the world: the unit cushion's, through the mesh's scale (r, r, r h).
// vQ: where it is on the unit cushion; vP: in the body (the nucleus's outline wavers: its
// cushion is pulled in, round its rim, by a noise of the direction — the side follows it,
// so the outline is its own wall, not cut out of a round one)
// Immersed in the fluid, as deep as it floats (any of it, or all of it): what's under the
// surface (uWater, the fluid's height there) is seen through it, where the eye sees it down
// there (raised to its apparent depth, as SUBMERGE does for the inclusions). The fluid is
// opaque to the depth test, so the whole dome is drawn along the eye's rays, a little above
// it: what stands out of it, lifted by 0.02 (as high as surfaceZ in main.js), what's under
// it just below that, deeper lower (so it still hides itself in the right order).
//   vSub: how far under the surface (world; < 0 above it)
// (a vesicle: soft, a bag, not a coin: its own outline, oval and lumpy, slowly kneaded by the
// streaming; its content and membrane drawn on the unit disc, so they follow it: vP = vQ)
const domeVert = (wobble, bag = false) => /* glsl */ `
  uniform float uH, uSeed, uWater, uDepth;
  ${bag ? 'uniform float uTime; uniform vec3 uShape; // oval-ness, its axis, lumpiness' : ''}
  varying vec2 vP, vQ;
  varying vec3 vN, vView;
  varying float vZ, vSub, vHt;
  ${wobble || bag ? NOISE : ''}
  void main() {
    vec3 p = position;
    vQ = p.xy;
    ${wobble ? 'p.xy *= 0.95 - fbm(normalize(p.xy + 1e-5) * 2.7 + uSeed) * 0.12;' : ''}
    ${bag ? `{
      vec2 d = normalize(p.xy + 1e-5);
      float t = uTime * 0.06;
      p.xy *= 1.0 + (fbm(d * 1.5 + uSeed + vec2(t, -t)) - 0.5) * uShape.z
                  + (fbm(d * 2.4 - uSeed + vec2(-t, t) * 1.7) - 0.5) * uShape.z * 0.18;
      float e = uShape.x * (1.0 + 0.35 * sin(uTime * 0.4 + uSeed)), ax = uShape.y + 0.25 * sin(uTime * 0.13 + uSeed * 2.0);
      mat2 R = mat2(cos(ax), sin(ax), -sin(ax), cos(ax));
      p.xy = (vec2(1.0 + e, 1.0 - e * 0.8) * (R * p.xy)) * R;
    }` : ''}
    vP = ${bag ? 'vQ' : 'p.xy'}; vZ = p.z;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vN = normalize(mat3(modelMatrix) * vec3(normal.xy, normal.z / (uH * uH)));
    vView = cameraPosition - wp.xyz;
    float sub = uWater - wp.z;
    vSub = sub; vHt = modelMatrix[2][2];
    vec3 q = wp.xyz;
    float zt = wp.z + 0.02;
    if (sub > 0.0) {
      // as deep as it floats, as deep as it looks (the fluid's optical depth, as the
      // inclusions'), but its own height only as the surface bends it (not drawn out)
      float top = max(uWater - modelMatrix[3][2] - modelMatrix[2][2], 0.0);
      q.z = uWater - (min(sub, top) * uDepth + max(sub - top, 0.0)) / 1.36;
      zt = uWater + 0.017 - sub * 0.01;
    }
    q += (cameraPosition - q) * ((zt - q.z) / max(cameraPosition.z - q.z, 1e-3));
    gl_Position = projectionMatrix * viewMatrix * vec4(q, 1.0);
  }`;
// under the surface: seen through the fluid above it (its depth, a fraction of the fluid's);
// the waterline: 1 at it, 0 a third of its height above it (and under it)
const DOME_WATER = /* glsl */ `
  uniform float uWater;
  varying float vSub, vHt;
  float underOf(float sub) { return sub > 0.0 ? clamp(0.12 + sub / max(uWater, 0.02), 0.0, 1.0) : 0.0; }
  float footOf(float sub) { return sub > 0.0 ? 0.0 : smoothstep(0.3 * vHt, 0.0, -sub); }`;
// lit: diffuse, only a faint, broad, diffuse sheen (soft matter, satin, not lacquered: no
// sharp wet glint), a faint fresnel rim, the foot of the dome in its own shade (where it
// meets the fluid)
const DOME_SHADE = /* glsl */ `
  ${LIGHT}
  vec3 shade(vec3 col, vec3 n, vec3 v, float foot, float wet) {
    float diff = clamp(dot(n, KEY), 0.0, 1.0);
    float wrapL = clamp(dot(n, KEY) * 0.5 + 0.5, 0.0, 1.0);
    vec3 h = normalize(KEY + v);
    float spec = pow(clamp(dot(n, h), 0.0, 1.0), 4.0) * 0.07 * wet;
    float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 3.0) * 0.5;
    col *= 0.55 + 0.35 * wrapL + 0.22 * diff;
    // at the waterline, wet with the fluid: its colour, a pale meniscus line
    col = mix(col, vec3(0.66, 0.44, 0.70), foot * 0.6);
    col += vec3(0.10, 0.07, 0.10) * exp(-pow((foot - 1.0) / 0.08, 2.0));
    return col + vec3(1.0, 0.96, 0.98) * spec * 0.55 + vec3(0.92, 0.86, 0.95) * fres * 0.12;
  }`;
export function createNucleusMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uDeath: { value: 0 }, uSeed: { value: 0 }, uH: { value: 0.2 }, uWater: { value: 0.13 }, uDepth: { value: 3 } },
    vertexShader: domeVert(true),
    fragmentShader: /* glsl */ `
      uniform float uDeath, uSeed, uH;
      varying vec2 vP, vQ;
      varying vec3 vN, vView;
      varying float vZ;
      ${NOISE}
      ${DOME_SHADE}
      ${DOME_WATER}
      ${FOG}
      // chromatin: dark clumps (heterochromatin), denser against the envelope
      float chromAt(vec2 p) {
        float r = length(p);
        return smoothstep(0.42, 0.74, fbm(p * 7.0 + uSeed * 3.0) + smoothstep(0.6, 0.9, r) * 0.18);
      }
      void main() {
        float r = length(vP);
        // its side: where the cushion turns down to the slide
        float side = smoothstep(0.62, 0.3, normalize(vN).z);
        float chrom = chromAt(vP);
        // the envelope: a double line, pierced by pores (pale gaps), round the rim of its top
        float er = length(vQ) * 0.95;
        float ang = atan(vP.y, vP.x);
        float pc = ang * 9.0, pid = floor(pc);
        float pore = step(0.55, hash(vec2(pid, uSeed))) * smoothstep(0.22, 0.08, abs(fract(pc) - 0.5));
        float env = (exp(-pow((er - 0.885) / 0.02, 2.0)) + exp(-pow((er - 0.83) / 0.018, 2.0)) * 0.6) * (1.0 - 0.8 * pore);
        // the nucleolus: a dense, granular knot, a pale ring round it; a second, smaller one
        vec2 c1 = vec2(0.2, -0.14), c2 = vec2(-0.3, 0.26);
        float n1 = smoothstep(0.24, 0.16, length(vP - c1) + (vnoise(vP * 18.0 + uSeed) - 0.5) * 0.08);
        float n2 = smoothstep(0.12, 0.07, length(vP - c2) + (vnoise(vP * 22.0) - 0.5) * 0.05);
        float halo = smoothstep(0.32, 0.24, length(vP - c1)) * (1.0 - n1);
        float nucl = max(n1, n2 * 0.9);
        vec3 col = mix(vec3(0.58, 0.40, 0.70), vec3(0.22, 0.08, 0.30), chrom * 0.8);
        col = mix(col, vec3(0.70, 0.55, 0.78), halo * 0.5);
        col = mix(col, vec3(0.13, 0.03, 0.17), nucl);
        col = mix(col, vec3(0.62, 0.42, 0.70), vnoise(vP * 30.0 + uSeed) * nucl * 0.25);
        col = mix(col, vec3(0.16, 0.05, 0.22), env * 0.75);
        // the side: the envelope seen edge on, a solid wall of it, dense, faintly banded
        // (the heterochromatin packed against it), its pores pale dents down it
        float band = fbm(vec2(ang * 4.0 + uSeed, vZ * 5.0));
        vec3 wall = mix(vec3(0.54, 0.36, 0.62), vec3(0.42, 0.24, 0.50), smoothstep(0.35, 0.7, band));
        wall = mix(wall, vec3(0.46, 0.28, 0.54), pore * 0.15);
        col = mix(col, wall, side);
        // its relief: the chromatin and the nucleolus stand out of its surface
        vec3 n = normalize(vN), v = normalize(vView);
        float e = 0.02;
        float hx = chromAt(vP + vec2(e, 0.0)) - chromAt(vP - vec2(e, 0.0));
        float hy = chromAt(vP + vec2(0.0, e)) - chromAt(vP - vec2(0.0, e));
        n = normalize(n - (vec3(hx, hy, 0.0) * 0.18 + vec3(vP - c1, 0.0) * n1 * 0.6) * (1.0 - side));
        float foot = footOf(vSub), under = underOf(vSub);
        col = shade(col, n, v, foot, (1.0 - uDeath * 0.8) * (1.0 - step(0.0, vSub) * 0.85));
        // under the surface, seen through the fluid
        col = fogged(col, min(under * 1.4, 1.0), uDeath);
        // dying: it darkens and clots, then fades away (pyknosis, karyolysis)
        float pyk = smoothstep(0.0, 0.4, uDeath) * (1.0 - smoothstep(0.6, 1.0, uDeath));
        col = mix(col, vec3(0.12, 0.05, 0.14), pyk * 0.6);
        float fade = 1.0 - smoothstep(0.55, 1.0, uDeath) * 0.85;
        gl_FragColor = vec4(col, fade * (1.0 - fogOf(under) * 0.4));
      }`,
    transparent: true,
  });
}

// a vesicle, of one of a few kinds, each with its own content:
//   0 a clear vesicle: a thin membrane, a pale lumen, a few particles drifting in it
//   1 a multivesicular body: small vesicles packed inside it
//   2 a dense-core granule: a dark core in a pale halo
//   3 a lysosome: dark, mottled, a few membrane whorls rolled up in it
// seed: its own; h: its height (a fraction of its radius)
const frac = (x) => x - Math.floor(x);
export function createVesicleMaterial(kind = 0, seed = 0, h = 0.6) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDeath: { value: 0 }, uKind: { value: kind }, uSeed: { value: seed }, uH: { value: h }, uTime: { value: 0 },
      uWater: { value: 0.13 }, uDepth: { value: 3 },
      // its own outline: a little or quite oval, along its own axis, more or less lumpy
      uShape: { value: new THREE.Vector3(0.04 + 0.14 * frac(seed * 7.13), frac(seed * 3.71) * Math.PI, 0.16 + 0.16 * frac(seed * 5.37)) },
    },
    vertexShader: domeVert(false, true),
    fragmentShader: /* glsl */ `
      uniform float uDeath, uKind, uSeed, uH;
      varying vec2 vP, vQ;
      varying vec3 vN, vView;
      varying float vZ;
      ${NOISE}
      ${DOME_SHADE}
      ${DOME_WATER}
      ${FOG}
      float ringAt(float d, float r, float w) { return exp(-pow((d - r) / w, 2.0)); }
      void main() {
        float r = length(vP);
        if (r > 1.0) discard;
        int k = int(uKind + 0.5);
        vec3 lumen = vec3(0.74, 0.56, 0.80), dark = vec3(0.24, 0.08, 0.30);
        vec3 col = lumen; float a = 0.62; float bump = 0.0; vec2 grad = vec2(0.0);
        if (k == 0) {
          // a clear lumen, faintly flocculent, a scatter of fine soft particles of all sizes
          // (not a few sharp dark dots: a button's holes)
          float g = 0.0;
          for (int i = 0; i < 14; i++) {
            float fi = float(i);
            vec2 c = (vec2(hash(vec2(fi, uSeed)), hash(vec2(uSeed, fi + 3.1))) - 0.5) * 1.35;
            float rr = 0.025 + 0.05 * pow(hash(vec2(fi, uSeed + 4.0)), 2.0);
            float d = length(vP - c);
            g = max(g, smoothstep(rr, rr * 0.2, d) * (0.3 + 0.4 * hash(vec2(fi, uSeed + 9.0))));
            grad += (vP - c) * smoothstep(rr * 1.2, 0.0, d) * 2.0;
          }
          col = mix(lumen, vec3(0.62, 0.44, 0.68), smoothstep(0.4, 0.75, fbm(vP * 6.0 + uSeed)) * 0.5);
          col = mix(col, dark, g * 0.7);
          a = 0.55 + g * 0.3;
        } else if (k == 1) {
          // small vesicles inside it, packed unevenly, of all sizes, some pressed together:
          // pale insides in light membranes, on a darker matrix (not an even ring of dark-
          // outlined holes: a button)
          col = mix(vec3(0.62, 0.44, 0.68), vec3(0.50, 0.32, 0.56), vnoise(vP * 14.0 + uSeed));
          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            if (hash(vec2(fi, uSeed + 2.0)) < 0.2) continue;
            vec2 c = (vec2(hash(vec2(fi, uSeed + 11.0)), hash(vec2(fi + 5.0, uSeed + 13.0))) - 0.5) * 1.3;
            float rr = 0.06 + 0.11 * hash(vec2(uSeed, fi));
            if (length(c) + rr > 0.78) c *= (0.78 - rr) / length(c);
            float d = length((vP - c) * vec2(1.0, 0.85 + 0.3 * hash(vec2(fi + 1.0, uSeed)))) + (vnoise(vP * 18.0 + fi) - 0.5) * 0.02;
            float inn = smoothstep(rr, rr - 0.04, d);
            col = mix(col, vec3(0.78, 0.64, 0.84), inn * 0.65);
            col = mix(col, vec3(0.86, 0.76, 0.90), ringAt(d, rr - 0.01, 0.02) * 0.45);
            grad += (vP - c) * inn * 1.2;
          }
          a = 0.85;
        } else if (k == 2) {
          // a dense core filling most of it, pushed against one side, lumpy, mottled, in a
          // thin, lopsided, tinted halo (a crescent): not a round pupil centred in a white,
          // or two of them side by side make a pair of eyes
          float ca = uSeed * 2.7;
          vec2 c = vec2(cos(ca), sin(ca)) * (0.12 + 0.06 * hash(vec2(uSeed, 1.0)));
          vec2 q = vP - c;
          float d = length(q * vec2(1.0, 1.1 + 0.15 * hash(vec2(2.0, uSeed))))
            + (vnoise(vP * 5.0 + uSeed) - 0.5) * 0.16 + (vnoise(vP * 13.0 - uSeed) - 0.5) * 0.06;
          float core = smoothstep(0.76, 0.64, d);
          col = mix(vec3(0.56, 0.38, 0.62), vec3(0.24, 0.07, 0.28), core);
          col = mix(col, vec3(0.42, 0.20, 0.46), core * smoothstep(0.3, 0.8, vnoise(vP * 6.0 + uSeed * 3.0)) * 0.7);
          a = mix(0.6, 0.95, core);
          grad += (vP - c) * core * 1.8;
        } else {
          // a lysosome: mottled dark content, a lighter vacuole, membrane whorls
          float m = fbm(vP * 5.0 + uSeed * 2.0);
          col = mix(vec3(0.52, 0.32, 0.56), vec3(0.20, 0.06, 0.24), smoothstep(0.35, 0.7, m));
          // its whorls: a stack of membranes, a bent band of parallel lamellae (not rings
          // round a centre: with a pale dot beside them, that was an iris and its glint)
          vec2 wc = (vec2(hash(vec2(uSeed, 4.0)), hash(vec2(6.0, uSeed))) - 0.5) * 0.4;
          float wa = uSeed * 1.9;
          vec2 wp = mat2(cos(wa), -sin(wa), sin(wa), cos(wa)) * (vP - wc);
          wp.y += wp.x * wp.x * (0.8 + 0.8 * hash(vec2(uSeed, 7.0))) + (fbm(vP * 4.0) - 0.5) * 0.08;
          float band = smoothstep(1.0, 0.6, length(wp / vec2(0.5, 0.17)));
          float whorl = (0.5 + 0.5 * sin(wp.y * 75.0)) * band;
          col = mix(col, vec3(0.74, 0.60, 0.78), whorl * 0.5);
          // a lighter vacuole, small, irregular, tinted
          vec2 vc = vec2(-wc.y, wc.x) * 1.2 + vec2(cos(wa + 2.0), sin(wa + 2.0)) * 0.3;
          float vd = length(vP - vc) + (vnoise(vP * 11.0 + uSeed) - 0.5) * 0.09;
          float vac = smoothstep(0.15, 0.1, vd);
          col = mix(col, vec3(0.70, 0.55, 0.75), vac * 0.7);
          a = 0.9;
          float e = 0.03;
          grad += vec2(fbm((vP + vec2(e, 0.0)) * 5.0 + uSeed * 2.0) - fbm((vP - vec2(e, 0.0)) * 5.0 + uSeed * 2.0),
                       fbm((vP + vec2(0.0, e)) * 5.0 + uSeed * 2.0) - fbm((vP - vec2(0.0, e)) * 5.0 + uSeed * 2.0)) * 6.0;
          grad -= (vP - vc) * vac * 2.0;
        }
        // its membrane: a light, milky sheath wrapping the content, not a ring laid on it —
        // the content fades into it (its inner edge soft and a little uneven), thicker here,
        // thinner there, and it is the body's side too, seen edge on (paler where it is
        // seen more obliquely, as a thin film is)
        float ang = atan(vP.y, vP.x);
        float th = 0.1 + 0.05 * vnoise(vec2(ang * 3.0 + uSeed, uSeed * 0.7));
        float sheath = smoothstep(0.98 - th - 0.12, 0.98 - th * 0.4, r + (vnoise(vP * 7.0 + uSeed) - 0.5) * 0.05);
        // its tint: its own, after its kind (clear: a cool pale lilac; multivesicular: pink;
        // dense core: a warm mauve; lysosome: a dusky rose), lighter or deeper, a little
        // warmer or cooler, uneven round it; and a milky film: what's under it shows through
        vec3 tint = k == 0 ? vec3(0.84, 0.82, 0.95) : k == 1 ? vec3(0.93, 0.76, 0.88)
                  : k == 2 ? vec3(0.82, 0.68, 0.84) : vec3(0.80, 0.64, 0.70);
        float hs = hash(vec2(uSeed, 21.0)), ls = hash(vec2(31.0, uSeed));
        tint += vec3(0.05, -0.02, -0.05) * (hs - 0.5) * 2.0;
        tint = mix(tint * 0.86, mix(tint, vec3(0.97, 0.95, 0.98), 0.35), ls);
        tint *= 0.95 + 0.1 * vnoise(vec2(ang * 2.0 + uSeed * 1.3, 4.0));
        vec3 film = mix(tint, col, 0.25);
        col = mix(col, film, sheath * 0.75);
        a = mix(a, 0.8, sheath);
        vec3 n = normalize(vN), v = normalize(vView);
        float side = smoothstep(0.62, 0.3, n.z);
        vec3 wall = mix(tint, mix(lumen, tint, 0.55), smoothstep(0.3, 0.75, fbm(vec2(ang * 4.0 + uSeed, vZ * 4.0))) * 0.6);
        col = mix(col, wall, side);
        // (its side a thin film the fluid shows through, not a solid edge: a coin, a button)
        a = mix(mix(a, 1.0, 0.5), 0.5, side);
        n = normalize(n - vec3(grad, 0.0) * 0.25 * (1.0 - side));
        float foot = footOf(vSub), under = underOf(vSub);
        col = shade(col, n, v, foot, (1.0 - uDeath * 0.8) * (1.0 - step(0.0, vSub) * 0.85));
        // under the surface, seen through the fluid
        col = fogged(col, min(under * 1.4, 1.0), uDeath);
        gl_FragColor = vec4(mix(col, vec3(0.45, 0.38, 0.38), uDeath * 0.6), a * (1.0 - uDeath * 0.5) * (1.0 - fogOf(under) * 0.55));
      }`,
    transparent: true,
  });
}

// the shadow a body casts on the fluid: a soft dark blob under it, pushed away from the light
export function createBodyShadowMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uDeath: { value: 0 }, uStrength: { value: 0.3 } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uDeath, uStrength;
      varying vec2 vP;
      void main() {
        float r = length(vP);
        float a = smoothstep(1.0, 0.55, r) * uStrength * (1.0 - uDeath * 0.6);
        gl_FragColor = vec4(vec3(0.16, 0.06, 0.18), a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

// ---- what the fluid holds is in it, not on it: each thing at its own depth (d: 0 just under
// the surface, 1 on the slide). Drawn at the surface (so the fluid, opaque to the depth
// test, doesn't hide it), but where the eye sees it there: along the ray from the eye to
// its place down in the fluid (raised to its apparent depth, bent by the surface), so it
// shifts under the surface as the slide is tilted and turned; and seen through the fluid
// above it, fogged by it (the lilac it scatters), paler, out of focus.
//   p: its place at the surface (world: the vertex is placed on surfaceZ, as high as the
//   fluid there, give or take its rim); uDepth: the fluid's optical depth, as a multiple of
//   its height (createFluidSurface's)
const SUBMERGE = /* glsl */ `
  uniform float uDepth;
  vec3 submerge(vec3 p, float d) {
    float z = max(p.z - 0.012, 0.0), a = d * z * uDepth / 1.36;
    // seen low, never deeper than the slide: deeper, it would be seen under the fluid's
    // edge, below the slide, as if the fluid floated above it
    float down = (cameraPosition.z - p.z) / max(length(cameraPosition - p), 1e-3);
    a = mix(min(a, z), a, smoothstep(0.25, 0.6, down));
    vec3 q = p - vec3(0.0, 0.0, a);
    return q + (cameraPosition - q) * (a / max(cameraPosition.z - q.z, 1e-3));
  }`;
const FOG = /* glsl */ `
  // seen through the fluid above it: how much of it is lost, the colour it takes
  float fogOf(float d) { return 1.0 - exp(-d * 1.6); }
  vec3 fogged(vec3 col, float d, float death) {
    vec3 lilac = mix(vec3(0.80, 0.62, 0.82), vec3(0.72, 0.64, 0.62), death);
    return mix(col, lilac, fogOf(d) * 0.45);
  }`;

// ---- the inclusions' strands, as flat ribbons on the slide (each link a strip, bent along a
// curve through the nodes). side: -1..1 across; along: distance along the strand (world);
// kind: 0 microtubule, 1 actin, 2 mitochondrion, 3 reticulum; alpha; width (world);
// vary: the strand's own (0..1, its look); tang: the strand's direction there (in the plane)
export function createStrandMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uDeath: { value: 0 }, uDepth: { value: 3 } },
    vertexShader: /* glsl */ `
      attribute float side, along, kind, alpha, width, vary;
      attribute vec2 tang;
      varying float vSide, vAlong, vKind, vAlpha, vWidth, vVary, vD;
      varying vec2 vTang;
      ${SUBMERGE}
      void main() {
        vSide = side; vAlong = along; vKind = kind; vAlpha = alpha; vWidth = width; vVary = vary; vTang = tang;
        // its depth: its own, wandering a little up and down along it (it dips in and out)
        float d = 0.08 + 0.6 * fract(vary * 17.31 + kind * 0.37) + 0.18 * sin(along * 1.7 + vary * 31.0);
        vD = clamp(d, 0.0, 1.0);
        // out of focus down there: spread wider (and fainter, in the fragment shader)
        vec3 p = position;
        p.xy -= side * vec2(tang.y, -tang.x) * width * 0.5 * vD * 0.7;
        gl_Position = projectionMatrix * viewMatrix * vec4(submerge((modelMatrix * vec4(p, 1.0)).xyz, vD), 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDeath;
      varying float vSide, vAlong, vKind, vAlpha, vWidth, vVary, vD;
      varying vec2 vTang;
      ${NOISE}
      ${LIGHT}
      ${FOG}
      // lit as a tube lying on the slide: its normal turns from the slide's up to sideways
      // across it (side -1..1 is offset along s * (-ty, tx))
      vec3 tube(vec3 col, float side, float gloss) {
        vec2 t = normalize(vTang + 1e-5);
        vec3 n = normalize(vec3(side * vec2(-t.y, t.x), sqrt(max(0.0, 1.0 - side * side)) + 0.15));
        float diff = clamp(dot(n, KEY), 0.0, 1.0);
        float spec = pow(clamp(dot(reflect(-KEY, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 24.0);
        return col * (0.55 + 0.6 * diff) + vec3(1.0, 0.94, 0.98) * spec * gloss;
      }
      void main() {
        // across it, as it was before it was spread out of focus
        float blur = 1.0 + vD * 0.7;
        float e = abs(vSide) * blur;
        int k = int(vKind + 0.5);
        vec3 col; float a;
        if (k == 0) {
          // microtubule: a dark violet line, a little soft (out of focus)
          a = exp(-e * e * 2.2) * 0.85;
          col = vec3(0.24, 0.08, 0.32);
        } else if (k == 1) {
          // actin: finer, beaded, magenta
          a = exp(-e * e * 2.2) * (0.5 + 0.35 * vnoise(vec2(vAlong * 70.0, 3.0)));
          col = vec3(0.42, 0.06, 0.34);
        } else if (k == 2) {
          // mitochondrion: a darker envelope round a matrix, folded inside by its cristae.
          // Each its own (vary): its tint (rose, violet, salmon), how dense its matrix is,
          // and its cristae: folds across it, reaching in from either side (most), long
          // wavy folds along it, or small round tubules (seen end on)
          float v = vVary;
          float style = fract(v * 5.37), tint = fract(v * 3.13), dens = fract(v * 7.91);
          float edge = smoothstep(0.55, 0.85, e);
          float cr = 0.0;
          if (style < 0.55) {
            float freq = 15.0 + 14.0 * fract(v * 11.3);
            float id = floor(vAlong * freq);
            float from = hash(vec2(id, 7.0 + v)) < 0.5 ? -1.0 : 1.0;
            float reach = 0.35 + 0.55 * hash(vec2(id, 3.0 + v));
            float u = fract(vAlong * freq) - 0.5 + (0.08 + 0.12 * v) * sin(vSide * 5.0 + id);
            float into = (vSide * from + 1.0) * 0.5; // 0 at the side it grows from
            cr = smoothstep(0.16, 0.05, abs(u)) * step(1.0 - reach, into);
          } else if (style < 0.8) {
            float lanes = 2.0 + floor(fract(v * 13.7) * 2.0);
            float y = vSide * lanes + 0.5 * sin(vAlong * (18.0 + 10.0 * v) + floor(vSide * lanes) * 2.0);
            float lane = abs(fract(y) - 0.5);
            cr = smoothstep(0.12, 0.04, lane) * step(0.3, vnoise(vec2(vAlong * 9.0, floor(y) + v * 10.0)));
          } else {
            vec2 cell = vec2(vAlong * 18.0, vSide * 2.2);
            vec2 id = floor(cell), f = fract(cell) - 0.5;
            vec2 o = (vec2(hash(id + v), hash(id.yx + 3.0 + v)) - 0.5) * 0.4;
            cr = smoothstep(0.26, 0.14, length(f - o)) * step(0.3, hash(id + 9.0 + v));
          }
          cr *= 1.0 - edge;
          vec3 rose = vec3(0.72, 0.40, 0.62), violet = vec3(0.58, 0.36, 0.68), salmon = vec3(0.80, 0.46, 0.54);
          vec3 base = tint < 0.5 ? mix(rose, violet, tint * 2.0) : mix(rose, salmon, tint * 2.0 - 1.0);
          base *= 0.86 + 0.24 * (1.0 - dens);
          col = mix(base, base * 0.85, vnoise(vec2(vAlong * 12.0, vSide * 2.0)));
          col = mix(col, vec3(0.94, 0.82, 0.90), cr * (0.65 + 0.25 * (1.0 - dens)));
          col = mix(col, vec3(0.26, 0.06, 0.26), edge * (0.75 + 0.25 * dens));
          col = tube(col, vSide, 0.35);
          a = 0.94 * (1.0 - smoothstep(0.88, 1.0, e));
        } else {
          // reticulum: a flat sac, two dark membranes round a pale lumen, studded with
          // ribosomes on the outside
          float hw = vWidth * 0.5;
          float wall = exp(-pow((e - 0.6) / 0.15, 2.0));
          float cell = 1.0 / 0.045;
          vec2 rp = vec2((fract(vAlong * cell + (vSide > 0.0 ? 0.5 : 0.0)) - 0.5) / cell, (e - 0.88) * hw);
          float on = step(0.45, hash(vec2(floor(vAlong * cell + (vSide > 0.0 ? 0.5 : 0.0)), sign(vSide))));
          float rib = on * smoothstep(0.009, 0.004, length(rp));
          col = mix(vec3(0.90, 0.80, 0.92), vec3(0.24, 0.06, 0.30), max(wall, rib));
          a = max(max(wall * 0.9, rib * 0.9), (1.0 - smoothstep(0.5, 0.6, e)) * 0.45);
        }
        // dead: dull, faded
        col = mix(col, vec3(0.45, 0.38, 0.37), uDeath * 0.6);
        a *= 1.0 - uDeath * 0.35;
        // seen through the fluid above it; blurred, its edge soft and its ink spread thinner
        col = fogged(col, vD, uDeath);
        a *= smoothstep(blur, blur - 0.25 - vD * 0.5, abs(vSide) * blur) / mix(1.0, blur, 0.6) * (1.0 - fogOf(vD) * 0.2);
        gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- the inclusions' granules: ribosomes (tiny, dark), lipid droplets (pale, bright-rimmed),
// dense granules (dark cores in a halo); size in world units
export function createGranulePoints(count) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('kind', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(count), 1));
  geo.setAttribute('depth', new THREE.BufferAttribute(new Float32Array(count), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uDeath: { value: 0 }, uDepth: { value: 3 } },
    vertexShader: /* glsl */ `
      attribute float kind, size, depth;
      uniform float uScale;
      varying float vKind, vD, vBlur;
      ${SUBMERGE}
      void main() {
        vKind = kind; vD = depth;
        // out of focus down there: a wider, softer disc (the granule itself inside it, 1 / vBlur)
        vBlur = 1.0 + depth * 0.9;
        vec4 mv = viewMatrix * vec4(submerge((modelMatrix * vec4(position, 1.0)).xyz, depth), 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.0, size * vBlur * uScale / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDeath;
      varying float vKind, vD, vBlur;
      ${FOG}
      void main() {
        vec2 c0 = gl_PointCoord * 2.0 - 1.0;
        float r0 = length(c0);
        if (r0 > 1.0) discard;
        // out of focus: a little bigger than it is, and its edge smeared out over the disc
        vec2 c = c0 * mix(1.0, vBlur, 0.55);
        float r = length(c);
        int k = int(vKind + 0.5);
        vec3 col; float a;
        if (k == 0) {
          col = vec3(0.28, 0.08, 0.32);
          a = smoothstep(1.0, 0.3, r) * 0.75;
        } else if (k == 1) {
          // a droplet: pale, a thin dark rim, a small highlight
          // (a little sphere: shaded from the upper left, a bright glint, its lower right in shade)
          float rim = exp(-pow((r - 0.82) / 0.1, 2.0));
          vec3 n = vec3(c.x, -c.y, sqrt(max(0.0, 1.0 - r * r)));
          float lit = clamp(dot(n, normalize(vec3(-0.5, 0.6, 0.65))), 0.0, 1.0);
          float hi = smoothstep(0.28, 0.0, length(c - vec2(-0.32, -0.34)));
          col = mix(vec3(0.95, 0.90, 0.86), vec3(0.40, 0.22, 0.38), rim);
          col *= 0.72 + 0.32 * lit;
          col += hi * 0.25;
          a = max(rim * 0.85, smoothstep(0.95, 0.75, r) * 0.6);
        } else if (k == 2) {
          float core = smoothstep(0.5, 0.3, r);
          col = mix(vec3(0.62, 0.40, 0.66), vec3(0.20, 0.05, 0.24), core);
          a = max(core * 0.9, smoothstep(1.0, 0.5, r) * 0.35);
        } else {
          // the centrosome: two dark centrioles in a pale halo of radiating matter
          float ca = smoothstep(0.26, 0.18, length(vec2(c.x + 0.2, (c.y + 0.04) * 2.2)));
          float cb = smoothstep(0.26, 0.18, length(vec2((c.x - 0.16) * 2.2, c.y - 0.16)));
          float halo = smoothstep(1.0, 0.1, r);
          col = mix(vec3(0.62, 0.36, 0.66), vec3(0.16, 0.03, 0.20), max(ca, cb));
          a = max(max(ca, cb) * 0.95, halo * 0.45);
        }
        col = mix(col, vec3(0.45, 0.38, 0.37), uDeath * 0.6);
        col = fogged(col, vD, uDeath);
        a *= mix(1.0, smoothstep(1.0, 0.0, r0), vD);
        a *= (1.0 - fogOf(vD) * 0.45) / (1.0 + (vBlur - 1.0) * 0.4);
        gl_FragColor = vec4(col, a * (1.0 - uDeath * 0.35));
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// some of the debris has taken up the stain: its colour pulled towards the cell's pinks
// (its darks to a deep magenta, its lights to a pale pink), by k
const DEBRIS_STAIN = /* glsl */ `
  vec3 stained(vec3 c, float k) {
    float l = dot(c, vec3(0.3, 0.55, 0.15));
    return mix(c, mix(vec3(0.44, 0.10, 0.36), vec3(0.96, 0.76, 0.92), smoothstep(0.15, 0.95, l)), k);
  }
`;
// ---- what drifts in the medium round the cell (medium.js): faint, unstained, a little grey
// beside the cell's violets, each at its own height (blur: how far out of focus, 0..1.5)
const MEDIUM_FOCUS = /* glsl */ `
  float blurOf(float z) { return clamp(abs(z - 0.12) * 2.4, 0.0, 1.5); }
`;
// its particles: 0 specks (small, dark), 1 droplets (pale, a dark rim), 2 motes (soft, high
// up, out of focus); size in world units, alpha (faded in and at the edge), vary (its own)
export function createMediumPoints(count) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  for (const k of ['kind', 'size', 'alpha', 'vary']) geo.setAttribute(k, new THREE.BufferAttribute(new Float32Array(count), 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 1 }, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float kind, size, alpha, vary;
      uniform float uScale;
      varying float vKind, vAlpha, vBlur, vVary;
      ${MEDIUM_FOCUS}
      void main() {
        vKind = kind; vAlpha = alpha; vVary = vary;
        vBlur = blurOf(position.z);
        vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.0, size * (1.0 + vBlur * 1.6) * uScale / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying float vKind, vAlpha, vBlur, vVary;
      void main() {
        vec2 c0 = gl_PointCoord * 2.0 - 1.0;
        float r0 = length(c0);
        if (r0 > 1.0) discard;
        vec2 c = c0 * (1.0 + vBlur * 1.6) / (1.0 + vBlur * 0.6); // the thing itself, inside its blur
        float r = length(c);
        float soft = 0.12 + vBlur * 0.6;
        int k = int(vKind + 0.5);
        vec3 col; float a;
        if (k == 0) {
          col = mix(vec3(0.34, 0.29, 0.36), vec3(0.42, 0.30, 0.38), vVary);
          a = smoothstep(1.0, 1.0 - soft - 0.4, r) * 0.75;
        } else if (k == 1) {
          // a droplet: pale, a thin grey rim (out of focus: a ring of light, as bokeh)
          float rim = exp(-pow((r - 0.8) / (0.1 + vBlur * 0.15), 2.0));
          col = mix(vec3(0.97, 0.96, 0.97), vec3(0.46, 0.40, 0.48), rim * (1.0 - vBlur * 0.4));
          a = max(rim * 0.75, smoothstep(1.0, 0.7 - soft, r) * 0.32);
        } else if (k == 2) {
          // a mote: a soft, faintly lilac disc, its edge a little brighter
          float d = smoothstep(1.0, 1.0 - soft - 0.2, r);
          col = mix(vec3(0.70, 0.64, 0.72), vec3(0.62, 0.56, 0.66), smoothstep(0.9, 0.3, r));
          a = d * 0.34;
        } else {
          // a tiny free cell: a pale, grainy body, a darker rim, a dark nucleus off its middle;
          // it pulses (swells and shrinks a little), its outline wobbling
          float t = uTime * (0.7 + vVary * 0.6) + vVary * 20.0;
          float ang = atan(c.y, c.x);
          float rr = r / (0.82 + 0.08 * sin(t) + 0.05 * sin(ang * 3.0 + t * 1.3 + vVary * 9.0) + 0.03 * sin(ang * 5.0 - t * 0.9));
          float body = smoothstep(1.0, 1.0 - soft * 0.5 - 0.06, rr);
          float rim = exp(-pow((rr - 0.88) / (0.09 + vBlur * 0.15), 2.0));
          vec2 o = 0.3 * vec2(cos(vVary * 40.0 + t * 0.2), sin(vVary * 40.0 + t * 0.2));
          float nuc = smoothstep(0.3 + soft * 0.2, 0.18, length(c - o));
          float gr = smoothstep(0.55, 0.85, fract(sin(dot(floor(c * 7.0), vec2(12.9898, 78.233)) + vVary) * 43758.5453));
          col = mix(vec3(0.86, 0.80, 0.84), vec3(0.62, 0.52, 0.60), gr * 0.4);
          col = mix(col, vec3(0.44, 0.32, 0.44), max(rim * 0.8, nuc * 0.9));
          a = max(body * 0.5, max(rim * 0.75, nuc * 0.85) * body);
        }
        a /= 1.0 + vBlur * 1.4;
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}
// its strands, as ribbons (a pair of vertices per node): side -1..1 across, along (world),
// kind (0 fibre, 1 wriggler), alpha, vary (its own), the height in position.z
export function createMediumStrandMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: /* glsl */ `
      attribute float side, along, kind, alpha, vary, taper;
      varying float vSide, vAlong, vKind, vAlpha, vVary, vBlur, vTaper;
      ${MEDIUM_FOCUS}
      void main() {
        vSide = side; vAlong = along; vKind = kind; vAlpha = alpha; vVary = vary; vTaper = taper;
        vBlur = blurOf(position.z);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vSide, vAlong, vKind, vAlpha, vVary, vBlur, vTaper;
      ${NOISE}
      ${DEBRIS_STAIN}
      void main() {
        // across it, as it is inside its blur (the ribbon is drawn that much wider)
        float e = abs(vSide) * (1.0 + vBlur * 1.2) / max(vTaper, 0.05);
        float soft = 0.25 + vBlur * 0.6;
        vec3 col; float a;
        if (vKind < 0.5) {
          // a fibre: a thin grey thread, unevenly dense along it
          a = smoothstep(1.0, 1.0 - soft, e) * (0.5 + 0.3 * vnoise(vec2(vAlong * 9.0 + vVary * 50.0, 1.0)));
          col = mix(vec3(0.42, 0.37, 0.45), vec3(0.50, 0.40, 0.46), vVary);
        } else if (vKind > 2.5) {
          // a fibre crusted over with debris: a thin thread, patchily wrapped in clumped grains
          // (ochre-grey, a few dark ones), its crust's edge ragged
          float spot = fbm(vec2(vAlong * 2.2 + vVary * 40.0, 0.5));
          float g = vnoise(vec2(vAlong * 26.0 + vVary * 13.0, vSide * 2.6 + vVary * 7.0));
          float reach = clamp((spot - 0.3) * 2.6, 0.0, 1.0) * (0.55 + 0.45 * g);
          float crust = smoothstep(reach + 0.04 + soft * 0.3, reach - 0.06, e);
          float dark = smoothstep(0.62, 0.78, vnoise(vec2(vAlong * 48.0 + vVary * 3.0, vSide * 4.0 + 9.0)));
          float thread = smoothstep(0.3 + soft * 0.3, 0.12, e);
          col = mix(vec3(0.72, 0.66, 0.58), vec3(0.58, 0.50, 0.44), g);
          col = mix(col, vec3(0.32, 0.25, 0.22), max(dark * crust, thread * (1.0 - crust) * 0.8));
          a = max(crust * (0.55 + 0.3 * dark), thread * 0.55);
          // some crusts stained pink, in patches
          float sk = step(0.5, fract(vVary * 7.13)) * (0.35 + 0.6 * fract(vVary * 3.71));
          col = stained(col, sk * crust * (0.35 + 0.65 * smoothstep(0.35, 0.6, fbm(vec2(vAlong * 1.3 + vVary * 20.0, 4.0)))));
        } else if (vKind > 1.5) {
          // a spiral: a fine dark thread, tightly coiled (its coil seen as a beading along it)
          float coil = 0.6 + 0.4 * sin(vAlong * 120.0 + vVary * 30.0);
          a = smoothstep(1.0, 1.0 - soft, e) * (0.45 + 0.35 * coil);
          col = mix(vec3(0.36, 0.26, 0.38), vec3(0.46, 0.30, 0.42), vVary);
        } else {
          // a wriggler: a small rod, a darker wall round a paler body, a few granules in it
          float wall = smoothstep(0.45, 0.85, e);
          float gr = smoothstep(0.6, 0.2, vnoise(vec2(vAlong * 40.0 + vVary * 30.0, vSide * 1.5))) * (1.0 - wall);
          col = mix(vec3(0.74, 0.62, 0.70), vec3(0.40, 0.26, 0.38), max(wall, gr * 0.6));
          a = smoothstep(1.0, 1.0 - soft * 0.6, e) * 0.78;
        }
        a /= 1.0 + vBlur * 1.3;
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- debris in the medium (flocs), as flat quads on the slide: uv -1..1 across the quad,
// seed, kind, alpha; its height in position.z. 0 clumps: irregular, porous, grainy,
// ochre-grey grains, darker clotted cores, a thin dark outline where it refracts the light, a
// little pale froth clinging round it; 1 ghosts: the same, pale and frothy, barely there;
// 2 cysts: a clear oval with a thin sharp wall, full of fine grains, on a thin stalk ending in
// a knob; 3 eggs: an oval with a thick dark wall, its inside pale, lumpy, a glint on it
export function createFlocMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec2 local;
      attribute float seed, alpha, kind;
      varying vec2 vP;
      varying float vSeed, vAlpha, vBlur, vKind;
      ${MEDIUM_FOCUS}
      void main() {
        vP = local; vSeed = seed; vAlpha = alpha; vKind = kind;
        vBlur = blurOf(position.z);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec2 vP;
      varying float vSeed, vAlpha, vBlur, vKind;
      ${NOISE}
      ${DEBRIS_STAIN}
      // a thin grey ring per cell of a grid (some of them): bubbles of froth
      float bubbles(vec2 c) {
        vec2 id = floor(c), f = fract(c) - 0.5;
        float br = 0.18 + 0.2 * hash(id + 7.7);
        float ring = exp(-pow((length(f - (vec2(hash(id), hash(id + 1.3)) - 0.5) * 0.3) - br) / (0.05 + vBlur * 0.1), 2.0));
        return ring * step(0.45, hash(id + 3.1));
      }
      vec4 clump(vec2 p, vec2 o, bool ghost) {
        float d = length(p);
        float field = fbm(p * 2.2 + o) * 1.15 - d * 0.95 + 0.08 * sin(uTime * 0.2 + vSeed);
        field -= 0.12 * smoothstep(0.62, 0.8, vnoise(p * 9.0 + o * 1.3));
        float soft = 0.015 + vBlur * 0.12;
        float body = smoothstep(-soft, soft, field);
        float rim = exp(-pow(field / (0.018 + vBlur * 0.06), 2.0)) * (1.0 - vBlur * 0.5);
        float g = vnoise(p * 20.0 + o * 2.0), g2 = vnoise(p * 44.0 + o * 3.0);
        float clot = 0.8 + 0.6 * step(0.6, hash(vec2(vSeed, 2.0))); // some clotted darker
        float core = smoothstep(0.55, 0.75, fbm(p * 3.5 + o + 7.0) + field * 0.6 * clot);
        float dark = smoothstep(0.7, 0.85, g2) * (1.0 - vBlur * 0.6);
        vec3 col; float a;
        if (ghost) {
          // pale, foamy: bubbles all through it, a faint grey outline
          float fr = max(bubbles(p * 11.0 + o), bubbles(p * 17.0 + o + 5.0) * 0.7);
          col = mix(vec3(0.90, 0.89, 0.88), vec3(0.55, 0.53, 0.55), max(fr * 0.8, rim * 0.5));
          col = mix(col, vec3(0.62, 0.56, 0.50), dark * 0.5);
          a = body * (0.16 + 0.3 * fr + 0.25 * dark) + rim * 0.25;
        } else {
          col = mix(vec3(0.76, 0.70, 0.62), vec3(0.60, 0.52, 0.45), g);
          col = mix(col, vec3(0.42, 0.32, 0.27) * (1.3 - clot * 0.4), core * 0.8);
          col = mix(col, vec3(0.26, 0.20, 0.18), max(dark * 0.8, rim * 0.7));
          a = body * (0.45 + 0.35 * core + 0.2 * dark) + rim * 0.5;
        }
        float near = smoothstep(-0.28, -0.08, field) * (1.0 - body);
        float froth = bubbles(p * 13.0 + o) * near;
        col = mix(col, vec3(0.52, 0.50, 0.53), froth * (1.0 - body));
        a = max(a, froth * 0.45);
        a *= smoothstep(1.0, 0.85, d);
        return vec4(col, a);
      }
      // an oval's normalised distance (1 on its outline), and its outline's width there
      float oval(vec2 p, vec2 r) { return length(p / r); }
      vec4 cyst(vec2 p, vec2 o) {
        vec2 q = p - vec2(-0.25, 0.0);
        float e = oval(q, vec2(0.55, 0.4));
        float w = 0.03 + vBlur * 0.08;
        float wall = exp(-pow((e - 1.0) / w, 2.0)) * 1.2;
        float inner = smoothstep(1.0, 1.0 - w, e);
        float g = vnoise(q * 34.0 + o), g2 = fbm(q * 5.0 + o);
        vec3 col = mix(vec3(0.88, 0.86, 0.83), vec3(0.58, 0.54, 0.52), g * 0.6 + g2 * 0.4);
        float a = inner * (0.34 + 0.4 * g * g2);
        // the stalk: from its narrow end, a thin wavering line, ending in a small knob
        float x = p.x - 0.28;
        float sy = 0.06 * sin(x * 5.0 + vSeed) * smoothstep(0.0, 0.3, x);
        float st = exp(-pow((p.y - sy) / (0.018 + vBlur * 0.05), 2.0)) * step(0.0, x) * step(x, 0.62);
        float knob = exp(-pow((length(p - vec2(0.92, 0.06 * sin(0.64 * 5.0 + vSeed))) - 0.06) / 0.025, 2.0));
        col = mix(col, vec3(0.30, 0.27, 0.30), max(wall, max(st, knob) * 0.8));
        a = max(a, max(wall * 0.8, max(st, knob) * 0.6));
        return vec4(col, a);
      }
      vec4 egg(vec2 p, vec2 o) {
        float e = oval(p, vec2(0.8, 0.62)) * (1.0 + 0.04 * sin(atan(p.y, p.x) * 3.0 + vSeed));
        float soft = 0.05 + vBlur * 0.12;
        float shell = smoothstep(1.0 + soft, 1.0 - soft, e);
        float wall = smoothstep(0.56 - soft, 0.62 + soft, e) * shell;
        float g = fbm(p * 4.0 + o);
        vec3 col = mix(vec3(0.94, 0.93, 0.92), vec3(0.74, 0.72, 0.72), smoothstep(0.4, 0.7, g));
        // the dark wall (a dark brownish grey, not black: no darker than the rest of the
        // debris), its outer edge catching a little light
        col = mix(col, vec3(0.27, 0.23, 0.24), wall);
        col += vec3(0.18) * exp(-pow((e - 0.95) / 0.04, 2.0)) * (1.0 - vBlur);
        float glint = smoothstep(0.2, 0.0, length(p - vec2(-0.3, 0.25)));
        col = mix(col, vec3(1.0), glint * 0.5 * (1.0 - wall));
        float a = max(wall * 0.82, shell * (0.45 + 0.3 * smoothstep(0.45, 0.7, g)));
        return vec4(col, a);
      }
      void main() {
        vec2 o = vec2(vSeed, vSeed * 1.7);
        vec4 c = vKind < 0.5 ? clump(vP, o, false) : vKind < 1.5 ? clump(vP, o, true) : vKind < 2.5 ? cyst(vP, o) : egg(vP, o);
        // about half of them (not the eggs) stained pink, unevenly (in blotches), some deeply
        float sk = step(0.5, hash(vec2(vSeed, 5.3))) * (0.35 + 0.6 * hash(vec2(vSeed, 8.1))) * step(vKind, 2.5);
        c.rgb = stained(c.rgb, sk * (0.35 + 0.65 * smoothstep(0.3, 0.65, fbm(vP * 2.0 + o + 3.0))));
        c.a /= 1.0 + vBlur * 1.2;
        gl_FragColor = vec4(c.rgb, c.a * vAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

// ---- the cell's hairs, outside it: thin ribbons, translucent, a greyish lilac like the
// films, a fine paler core along them, tapering to a soft tip, a little out of focus
// (as high as they are off the focal plane), dulling as it dies.
//   side: -1..1 across; along: 0 root .. 1 tip; vary: its own; uDeath
export function createHairMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uDeath: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float side, along, vary;
      varying float vSide, vAlong, vVary, vBlur;
      ${MEDIUM_FOCUS}
      void main() {
        vSide = side; vAlong = along; vVary = vary;
        vBlur = blurOf(position.z);
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uDeath;
      varying float vSide, vAlong, vVary, vBlur;
      void main() {
        float e = abs(vSide);
        float soft = 0.35 + vBlur * 0.5;
        float body = smoothstep(1.0, 1.0 - soft, e);
        float core = exp(-e * e * 10.0);
        // denser at the root (where it comes out of the film), fading towards the tip
        float a = body * (0.55 + 0.3 * core) * (1.0 - 0.45 * vAlong) * smoothstep(1.0, 0.85, vAlong);
        // where it comes out of the film: anchored in a small dark knot (its basal body), a
        // little denser, its edge soft
        float knot = 1.0 - smoothstep(0.0, 0.06, vAlong);
        float base = 1.0 - smoothstep(0.0, 0.18, vAlong);
        a = mix(a, smoothstep(1.0, 0.3, e) * 0.85, max(knot, base * 0.4));
        vec3 col = mix(vec3(0.50, 0.38, 0.54), vec3(0.42, 0.32, 0.48), vVary);
        col = mix(col, vec3(0.72, 0.62, 0.76), core * 0.35);
        col = mix(col, vec3(0.30, 0.18, 0.32), knot * 0.8);
        col = mix(col, vec3(0.66, 0.62, 0.58), uDeath * 0.7);
        a *= 1.0 - 0.35 * uDeath;
        // dead, some of them (two in five) shed, each in its own time
        float shed = step(fract(vVary * 7.31), 0.4);
        float when = 0.15 + 0.6 * fract(vVary * 13.7);
        a *= 1.0 - shed * smoothstep(when, when + 0.2, uDeath);
        gl_FragColor = vec4(col, a / (1.0 + vBlur));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
