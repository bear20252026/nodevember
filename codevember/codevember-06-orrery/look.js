// How it's shown: as a plate engraved for a novel of the 1870s, coloured by
// hand. The scene is drawn as usual (linear light, half float), the lamp's
// glow blooms, then one pass turns it into a print:
//  - the colours are graded to the plate's palette (night blue, ochre, brass,
//    sepia) and lifted into a wash on cream paper,
//  - the tones are put back with ink, as the engraver draws: strokes laid
//    along each thing's form (latitudes on a ball, circles on a ring, along
//    a rod or a tube), fine and close (about a 280th of the picture apart),
//    each swelling, tapering and breaking off; a second set across in the
//    shadow, a third in the deepest; the brass and wood bare in the light,
//    the planets lined all over; the sky in long wavy strokes, darker and
//    lighter than its blue. Subtle: the colour carries the tone, the ink is
//    that colour made deeper, so the lines are seen but read as its grain.
//    The lines belong to the scene, not to the screen: a second pass writes,
//    for every pixel, its lines counted along its object's form, so they
//    turn and travel with it; the sky's strokes are laid by direction, so
//    they stay with the stars. To keep the lines as far apart on screen near
//    and far, each set has octaves: as a surface recedes every other line
//    fades out, as it comes closer new ones fade in between,
//  - the palette in two hues: night blue in the shadows, ochre in the lights,
//  - an outline round the things in their own colour, deepened, wider on
//    their shadow side, and a faint one where the tone jumps,
//  - a fine paper grain and a heavy vignette. (No stains or foxing: they
//    stayed on the screen while the lines travel with the scene, and read
//    as smudges on the glass.)
// `amount` blends from the plain render (0) to the print (1).
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { GLSL_NOISE } from './noise.js';

export function setupRenderer(renderer) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // crisp: a drawn shadow has an edge
  renderer.toneMapping = THREE.NoToneMapping; // done in the print pass
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
}

// an environment for the metal to reflect: the dark hall, warm low down, the
// night blue above through the glass. Broad only — no glints of lamps or
// windows: those photographic cues fight the print, where one light (the
// sun) does the drawing
export function createEnvironment(renderer) {
  const s = new THREE.Scene();
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    vertexShader: /* glsl */ `varying vec3 vD; void main() { vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vD;
      ${GLSL_NOISE}
      void main() {
        vec3 d = normalize(vD);
        vec3 c = mix(vec3(0.09, 0.045, 0.02), vec3(0.02, 0.035, 0.08), smoothstep(-0.2, 0.5, d.y));
        // the wood panelling, catching the lamp
        c += vec3(0.22, 0.11, 0.045) * smoothstep(0.35, 0.0, abs(d.y - 0.05));
        // the sky's side a little bluer
        c += vec3(0.05, 0.08, 0.16) * smoothstep(0.2, 0.9, dot(d, normalize(vec3(-0.9, 0.42, -0.15))));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), m));
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture;
  pm.dispose();
  return env;
}

const printShader = {
  uniforms: {
    tColor: { value: null },
    tDepth: { value: null },
    tMask: { value: null },
    tVeil: { value: null },
    uNear: { value: 0.1 },
    uFar: { value: 200 },
    uPr: { value: 1 },
    uTime: { value: 0 },
    uAmount: { value: 1 },
    uExposure: { value: 1.0 },
    tCoord: { value: null },
    tFreq: { value: null },
    uCssH: { value: 800 },
    uInvProj: { value: new THREE.Matrix4() },
    uCamWorld: { value: new THREE.Matrix4() },
    uPxPerRad: { value: 1000 },
  },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tColor, tDepth, tCoord, tFreq, tMask, tVeil;
    uniform float uNear, uFar, uPr, uTime, uAmount, uExposure, uPxPerRad, uCssH;
    uniform mat4 uInvProj, uCamWorld;
    varying vec2 vUv;
    ${GLSL_NOISE}
    float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    vec3 aces(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }
    float viewZ(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      return (uNear * uFar) / (uFar - z * (uFar - uNear));
    }
    // a line of ink every period of u, covering w of it (0..1). Box-filtered:
    // a line thinner than a pixel stays a pixel wide and fades instead of
    // breaking up, so the hairlines read as hairlines.
    float inkA(float u, float w, float aa) {
      if (w <= 0.0) return 0.0;
      float d = abs(fract(u) - 0.5);      // 0 on the line's axis
      aa = max(aa, 1e-4);
      float hw = w * 0.5;
      float hwp = max(hw, aa * 0.5);
      return clamp((hwp - d) / aa + 0.5, 0.0, 1.0) * (hw / hwp);
    }
    float ink(float u, float w) { return inkA(u, w, fwidth(u)); }
    // one octave of a set of strokes: each line a stroke of the burin, that
    // swells as it bites, tapers to a point and breaks off, then starts again
    // a little further; the darker, the longer the strokes and the shorter
    // the gaps. al counts along the stroke, alS0 and alS1 the two octaves
    // of that count (about one per sp px) and alT how far between them:
    // the breaks blend from one to the other as the surface comes nearer or
    // recedes, instead of jumping.
    float breaks(float line, float al, float s0, float s1, float t, float seed) {
      float n0 = vnoise(vec3(al / s0 * 0.12, line * 1.73 + seed, seed * 0.37));
      float n1 = vnoise(vec3(al / s1 * 0.12, line * 1.73 + seed, seed * 0.37 + 4.0));
      float n = mix(n0, n1, t);
      return clamp(0.5 + (n - 0.5) * (1.0 + 0.6 * sin(t * 3.14159)), 0.0, 1.0); // the blend keeps its contrast
    }
    float strokeOct(float ua, float aa, float w, float al, vec3 alS, float seed, float k) {
      float line = floor(ua);
      float nb = breaks(line, al, alS.x, alS.y, alS.z, seed);
      float thr = mix(0.55, 0.05, k);
      float taper = smoothstep(thr, thr + 0.3, nb);
      return inkA(ua, min(w * taper * (0.7 + 0.6 * nb), 0.85), aa);
    }
    // a set of lines laid along a surface (u counts them, f of them fall per
    // device px), kept about sp px apart on screen however near or far:
    // octaves of the set, every other line of one fading out as the surface
    // recedes. w: the width as a fraction of sp. al, fal: another set's count,
    // to measure along the strokes.
    float hatch(float u, float f, float w, float sp, float al, float fal, float seed, float k) {
      if (w <= 0.0 || f < 1e-5) return 0.0;
      float lv = clamp(log2(f * sp), -10.0, 16.0);
      float lf = floor(lv), t = lv - lf;
      float s = exp2(lf);
      float ua = u / s, aa = f / s;
      float la = clamp(log2(max(fal, 1e-5) * sp), -10.0, 16.0);
      vec3 alS = vec3(exp2(floor(la)), exp2(floor(la) + 1.0), fract(la));
      float fine = strokeOct(ua, aa, w * exp2(t), al, alS, seed, k);
      float coarse = strokeOct(ua * 0.5, aa * 0.5, w * exp2(t - 1.0), al, alS, seed + 11.0, k);
      return max(coarse, fine * (1.0 - t));
    }
    // the tone in a few flat steps with short soft edges between them, as a
    // colourist lays it: a clean terminator instead of a photographic ramp
    float bands(float x) {
      float y = clamp(x, 0.0, 1.0) * 4.0;
      return (floor(y) + smoothstep(0.3, 0.7, fract(y))) / 4.0;
    }
    vec3 shade(vec2 uv) { return aces(texture2D(tColor, uv).rgb * uExposure); }
    // a neighbour's tone, graded as the pixel's own is below
    float toneAt(vec2 uv) {
      vec3 c = shade(uv);
      float L = luma(c);
      c = mix(vec3(L), c, 0.85);
      c = mix(c * vec3(0.72, 0.9, 1.35), c * vec3(1.1, 1.0, 0.8), smoothstep(0.03, 0.3, L));
      return luma(pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2)));
    }

    void main() {
      vec2 px = 1.0 / vec2(textureSize(tColor, 0));
      vec3 hdr = texture2D(tColor, vUv).rgb;
      float dz = texture2D(tDepth, vUv).x;
      bool sky = dz > 0.99999;
      vec3 photo = aces(hdr * uExposure);

      // ---- the plate's palette: blue-black shadows, warm ochre lights
      vec3 c = photo;
      float L = luma(c);
      c = mix(vec3(L), c, 0.85);
      // essentially two hues, as on the plate: night blue in the shadows,
      // ochre and gold in the lights
      c = mix(c * vec3(0.72, 0.9, 1.35), c * vec3(1.1, 1.0, 0.8), smoothstep(0.03, 0.3, L));
      vec3 disp = pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
      float T = luma(disp);
      // the tone as the colourist and the engraver lay it: broad (they don't
      // follow every grain of the wood), in flat steps
      float Ts = T * 0.3;
      {
        // over about two strokes' width: the wood's grain, the stones'
        // speckle are lost, the light and shade stay
        vec2 r = px * max(3.0, uPr * max(3.0, uCssH / 280.0) * 1.6);
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.785398 + 0.39;
          Ts += 0.0875 * toneAt(vUv + vec2(cos(a), sin(a)) * r);
        }
      }
      float Tb = mix(Ts, bands(Ts), 0.3);

      // ---- the wash on paper: the colour carries the tone (the lines only
      // texture it), so it goes deep in the shadows
      vec2 p = gl_FragCoord.xy / uPr; // in css pixels
      vec3 paper = vec3(0.94, 0.87, 0.71);
      paper *= 0.94 + 0.06 * vnoise(vec3(p * 0.9, 1.0));
      vec3 hue = clamp(disp / max(T, 0.03), 0.0, 2.2);
      hue = mix(vec3(1.0), hue, sky ? 0.9 : 0.78);
      // the bodies (the planets, the sun, the rings) keep their colour's own
      // detail — bands, spots, the sun's mottling — under a fine screen of
      // lines; the rest is laid broad, the lines doing the drawing
      float kd0 = floor(texture2D(tCoord, vUv).w);
      bool body = kd0 == 2.0 || kd0 == 3.0;
      vec3 wash = paper * hue * mix(0.34, 1.0, smoothstep(0.0, 0.85, mix(T, Tb, body ? 0.15 : 0.5))) * (sky ? 0.85 : 1.0);
      wash = mix(wash, disp, 0.12);

      // ---- the engraver's lines
      float k = 1.0 - Tb; // darkness
      // fine and close, as a burin cuts: about a 280th of the picture's
      // height apart, never under 3 css px — seen, but as a texture
      float SP = max(3.0, uCssH / 280.0);
      // ---- the veil: the light of what's see-through and glowing in front
      // (the sun's rays and halo, the Milky Way, the lamp): seen through it,
      // the things behind lose their engraving, as the engraver leaves a
      // glow bare instead of cutting through it
      float va = smoothstep(0.004, 0.14, luma(aces(texture2D(tVeil, vUv).rgb * uExposure)));
      vec4 oc = texture2D(tCoord, vUv); // the line counts (w: the kind; 0 if none)
      vec4 of = texture2D(tFreq, vUv);  // how many per device px (w: a seed)
      bool cut = oc.w > 0.5;
      float cover, lift = 0.0;
      if (!cut) {
        // long horizontal strokes, wavering and breaking off, as the burin
        // cuts a sky; laid by direction, so they stay with the sky
        vec4 vv = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 dir = normalize((uCamWorld * vec4(vv.xyz / vv.w, 0.0)).xyz);
        float R = uPxPerRad;                 // css px per radian
        float el = asin(clamp(dir.y, -1.0, 1.0)) * R;
        float az = atan(dir.z, dir.x);
        float wob = vnoise(dir * 6.0 + 2.0) * 2.0 - 1.0;
        float wob2 = vnoise(dir * R * 0.05 + 5.0) * 2.0 - 1.0;
        float u = (el + 9.0 * sin(az * 4.0 + wob * 2.5) + 4.0 * wob2) / (SP * 0.9);
        float br = vnoise(dir * R * 0.025 + vec3(0.0, floor(u) * 1.7, 7.0)); // strokes break off
        float taper = smoothstep(mix(0.62, 0.2, k), mix(0.62, 0.2, k) + 0.25, br);
        float w = clamp(0.1 + k * 0.35, 0.0, 0.42) * taper * (0.7 + 0.6 * br);
        cover = ink(u, w) * 0.85;
        // and between them, here and there, a lighter stroke: the sky is
        // worked both ways, darker and lighter than its blue
        float br2 = vnoise(dir * R * 0.03 + vec3(floor(u + 0.5) * 2.3, 3.0, 1.0));
        lift = ink(u + 0.5, 0.22 * smoothstep(0.55, 0.8, br2)) * smoothstep(0.15, 0.5, Tb) * 0.5;
        // in the darkest, a few slanting ones; a whole number of them round
        // the sky so they close up behind
        float n = floor(6.2832 * R * 0.5 / (SP * 1.1) + 0.5);
        float u2 = (el * 0.85 + 6.0 * wob) / (SP * 1.1) + az * n / 6.2832;
        cover = max(cover, ink(u2, clamp((k - 0.84) * 1.6, 0.0, 0.25) * taper) * 0.6);
      } else {
        // the thing's own strokes, laid along its form: one set, a second
        // across it in the shadow, a third in the deepest. Nothing in the
        // lights: the paper shows, as the engraver leaves it
        // On the bodies, a fine screen, as a banknote's engraver lays it:
        // lines half as far apart, long and even (they hardly break), thin
        // and of one weight, the colour showing between them; none at all in
        // their lights, so the sun is a glow, not a striped ball. Elsewhere,
        // coarser strokes that swell, break and taper: the lines draw.
        float lead = fract(oc.w) / 0.45;
        float sp = SP * uPr * (body ? 0.55 : 1.0);
        float kb = body ? min(1.0, k + 0.4) : k; // (how long the strokes run)
        float lit = body ? 1.0 - smoothstep(0.6, 0.88, T) : smoothstep(0.05, 0.3, k); // bare in the light
        float w1 = (body ? clamp(0.2 + k * 0.25, 0.0, 0.4) : clamp(0.12 + k * 0.45, 0.0, 0.5)) * lead * lit;
        float w2 = max(clamp((k - 0.45) * (body ? 0.5 : 0.8), 0.0, body ? 0.3 : 0.38), clamp(0.12 + k * 0.45, 0.0, 0.5) * (1.0 - lead) * lit);
        float w3 = body ? 0.0 : clamp((k - 0.75) * 1.0, 0.0, 0.26);
        cover = max(max(
          hatch(oc.x, of.x, w1, sp, oc.y, of.y, of.w, kb),
          hatch(oc.y, of.y, w2, sp, oc.x, of.x, of.w + 5.0, kb)),
          hatch(oc.z, of.z, w3, sp * 0.9, oc.x, of.x, of.w + 9.0, kb));
      }
      cover *= 1.0 - 0.9 * va;
      lift *= 1.0 - va;
      // the ink is the colour itself, deeper: blue lines on the blue sky,
      // brown on the ochre — close in value, so the lines read as the grain
      // of the colour, not as black over it; a little stronger in the darks
      vec3 inkCol = wash * mix(0.52, 0.7, Tb) * vec3(0.93, 0.91, 0.95);
      vec3 print = mix(wash, inkCol, cover * mix(0.85, 0.6, Tb));
      print = mix(print, min(wash * 1.45 + 0.03, vec3(1.0)), lift);

      // ---- outlines, where the depth or the tone jumps: heavy round the
      // things, heavier still on their shadow side (a second, wider look,
      // counted only where it's dark); the tone's jumps inside them in a
      // finer line
      float zc = viewZ(vUv);
      float ez = 0.0, ez2 = 0.0, et = 0.0;
      float r1 = max(1.0, uPr * 0.75);
      for (int i = 0; i < 4; i++) {
        vec2 d = vec2(i == 0 ? 1.0 : i == 1 ? -1.0 : 0.0, i == 2 ? 1.0 : i == 3 ? -1.0 : 0.0) * px;
        ez = max(ez, (viewZ(vUv + d * r1) - zc) / zc);
        ez2 = max(ez2, (viewZ(vUv + d * r1 * 2.6) - zc) / zc);
        et = max(et, abs(luma(shade(vUv + d * r1)) - luma(photo)));
      }
      float edge = max(smoothstep(0.03, 0.12, ez), smoothstep(0.03, 0.12, ez2) * smoothstep(0.5, 0.9, k) * 0.6);
      edge = max(edge, smoothstep(0.35, 0.6, et) * 0.15);
      if (sky) edge *= 0.0;
      edge *= 1.0 - 0.85 * va;
      print = mix(print, wash * 0.3 + vec3(0.02, 0.012, 0.008), edge * 0.6); // the colour's own, deep

      // the bright things stay bright: the lamp and the stars glow through
      float glow = smoothstep(0.8, 1.0, T);
      print = mix(print, mix(paper, disp, 0.4) * 1.05, glow * 0.6);
      // (only what stands out from its surroundings: the stars, not the
      // broad light of the sun's corona over the sky)
      if (sky) {
        vec2 o3 = px * 3.0 * max(1.0, uPr * 0.6);
        float nb = 0.25 * (luma(shade(vUv + vec2(o3.x, 0.0))) + luma(shade(vUv - vec2(o3.x, 0.0)))
                         + luma(shade(vUv + vec2(0.0, o3.y))) + luma(shade(vUv - vec2(0.0, o3.y))));
        float star = smoothstep(0.03, 0.2, luma(photo) - nb);
        // but not the orrery's own star-dust seen against the sky: it would
        // shine far brighter than over the floor
        star *= 1.0 - clamp(luma(texture2D(tMask, vUv).rgb) * 8.0, 0.0, 1.0);
        print += mix(vec3(luma(disp)), disp, 0.4) * smoothstep(0.35, 0.9, luma(disp)) * 0.9 * star;
      }

      // hand colouring is a thin wash: pull everything towards the paper's sepia
      print = mix(vec3(luma(print)) * vec3(1.06, 0.99, 0.86), print, 0.9);
      vec3 col = mix(disp, print, uAmount);

      // ---- the vignette, deep
      vec2 q = vUv - 0.5;
      q.x *= 1.25;
      float vig = smoothstep(0.85, 0.25, length(q));
      col *= mix(vec3(0.62, 0.5, 0.4), vec3(1.0), vig);
      // and the foreground sinks into a dark warm mass, as the plate's figures
      // stand against the sky: the eye goes up, to the sky and the giant
      col *= mix(vec3(0.72, 0.6, 0.5), vec3(1.0), smoothstep(0.0, 0.38, vUv.y));
      col += (hash13(vec3(p, uTime)) - 0.5) * 0.02;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// MASK_LAYER: what's on that layer (the orrery's star-dust) is drawn once
// more on its own, so the print can tell it from the stars of the real sky
export const MASK_LAYER = 1;
export function createPost(renderer, scene, camera) {
  const size = new THREE.Vector2();
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const maskRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
  // what's light and see-through, alone, hidden behind the solid things
  const veilRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const veil = veilPass(scene);
  const black = new THREE.Color(0);
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  rt.depthTexture.type = THREE.FloatType;
  // where each pixel is in its object's frame, for the engraving's lines
  const coordRT = new THREE.WebGLRenderTarget(1, 1, { count: 2, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const coords = coordPass(scene);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.15, 0.3, 2.2);
  const mat = new THREE.ShaderMaterial({ ...printShader, uniforms: THREE.UniformsUtils.clone(printShader.uniforms) });
  const quad = new FullScreenQuad(mat);
  const U = mat.uniforms;
  U.uNear.value = camera.near;
  U.uFar.value = camera.far;

  function resize() {
    renderer.getDrawingBufferSize(size);
    rt.setSize(size.x, size.y);
    coordRT.setSize(size.x, size.y);
    maskRT.setSize(size.x, size.y);
    veilRT.setSize(size.x >> 1, size.y >> 1);
    bloom.setSize(size.x, size.y);
  }
  resize();

  return {
    resize,
    amount: 1,
    render(time) {
      renderer.getDrawingBufferSize(size);
      if (size.x !== rt.width || size.y !== rt.height) resize();
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      // the star-dust alone, on black, without the room to hide it
      const bg = scene.background, mask = camera.layers.mask, sh = renderer.shadowMap.autoUpdate;
      scene.background = black;
      renderer.shadowMap.autoUpdate = false; // the shadows are done already
      camera.layers.set(MASK_LAYER);
      renderer.setRenderTarget(maskRT);
      renderer.render(scene, camera);
      camera.layers.mask = mask;
      scene.background = bg;
      renderer.shadowMap.autoUpdate = sh;
      bloom.render(renderer, null, rt, 0, false);
      if (this.amount > 0.001) {
        coords.render(renderer, camera, coordRT);
        veil.render(renderer, camera, veilRT);
      }
      renderer.setRenderTarget(null);
      U.tCoord.value = coordRT.textures[0];
      U.tFreq.value = coordRT.textures[1];
      U.uCssH.value = size.y / renderer.getPixelRatio();
      U.uInvProj.value.copy(camera.projectionMatrixInverse);
      U.uCamWorld.value.copy(camera.matrixWorld);
      U.uPxPerRad.value = (size.y / renderer.getPixelRatio()) * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
      U.tColor.value = rt.texture;
      U.tDepth.value = rt.depthTexture;
      U.tMask.value = maskRT.texture;
      U.tVeil.value = veilRT.texture;
      U.uPr.value = renderer.getPixelRatio();
      U.uTime.value = time % 100;
      U.uAmount.value = this.amount;
      quad.render(renderer);
    },
  };
}

// The pass that tells the engraving how to cut each thing: every opaque
// thing drawn again, writing for each pixel three sets of lines laid along its
// form (as coordinates that count the lines) and how many lines of each set
// fall per screen pixel. The lines follow the shape, as an engraver's do:
//  - a ball (a planet, the sun, the giant): along its latitudes, bent a little
//    as its bands are; crossed by latitudes about two tilted axes,
//  - a ring (Saturn's, the giant's): concentric; crossed by radial strokes,
//  - a turned part (column, sleeves, rods): along its length; crossed by
//    rings round it; or ('rings') the other way about, for the walls: in
//    level courses, as an engraver lays a wall, not in a curtain of uprights,
//  - a tube (legs, struts, hoops, the dome's ribs): along it; crossed by rings,
//  - a box (the arms, the pilasters, the books): along its longest side,
//  - anything else (gears, stones): three sets of planes in its own frame.
// The kind comes from the geometry, or from userData.strokes.
const KINDS = { planes: 1, sphere: 2, ring: 3, lathe: 4, tube: 5, rings: 6, box0: 7, box1: 7, box2: 7 };
function strokeKind(o) {
  if (o.userData.strokes) return o.userData.strokes;
  switch (o.geometry?.type) {
    case 'SphereGeometry': return 'sphere';
    case 'RingGeometry': return 'ring';
    case 'LatheGeometry': case 'CylinderGeometry': return 'lathe';
    case 'TubeGeometry': case 'TorusGeometry': return 'tube';
    case 'BoxGeometry': {
      const p = o.geometry.parameters, sc = o.scale;
      const e = [p.width * sc.x, p.height * sc.y, p.depth * sc.z];
      return 'box' + e.indexOf(Math.max(...e));
    }
    default: return 'planes';
  }
}

const coordShader = {
  glslVersion: THREE.GLSL3,
  uniforms: { map: { value: null }, alphaTest: { value: 0 }, uSeed: { value: 0 } },
  vertexShader: /* glsl */ `
    uniform float uSeed;
    varying vec3 vC, vP;
    varying vec2 vUv;
    varying float vSeed;
    void main() {
      mat4 m = modelMatrix;
      vec3 off = vec3(0.0);
      // each thing's own seed, fixed: never from where it is, or a planet's
      // strokes would reshuffle all along its orbit
      float seed = uSeed;
      #ifdef USE_INSTANCING
        m = m * instanceMatrix;
        off = instanceMatrix[3].xyz * 0.37;
        seed += dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719)); // the instances stay put in their mesh
      #endif
      vC = position * vec3(length(m[0].xyz), length(m[1].xyz), length(m[2].xyz)) + off;
      vP = position;
      vUv = uv;
      vSeed = fract(seed) * 40.0;
      gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D map;
    uniform float alphaTest;
    varying vec3 vC, vP;
    varying vec2 vUv;
    varying float vSeed;
    layout(location = 0) out highp vec4 oU;
    layout(location = 1) out highp vec4 oF;
    ${GLSL_NOISE}
    float fw(float u) { return length(vec2(dFdx(u), dFdy(u))); }
    // the same for a count that wraps round at N (a whole number of lines)
    float fwWrap(float u, float N) { return min(fw(u), fw(mod(u + N * 0.5, N))); }
    mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
    mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }
    void main() {
      #ifdef USE_CUT
        if (texture(map, vUv).a < alphaTest) discard;
      #endif
      vec3 u, f;
      float lead = 1.0; // how much the first set leads (less round a ball's poles)
      #if KIND == 2
        // latitudes, bent a little the way bands are: slow waves, and a
        // finer streaking that runs along the bands
        vec3 n = normalize(vP);
        float wob = (vnoise(n * 2.0 + vSeed) - 0.5) * 0.07; // slow waves only: the lines run clean
        const float NS = 160.0 / 3.14159265;
        u.x = (asin(clamp(n.y, -1.0, 1.0)) + wob) * NS;
        vec3 n2 = rotZ(0.6) * n; // a shallow crossing, as the burin crosses
        u.y = (asin(clamp(n2.y, -1.0, 1.0)) + wob * 0.5) * NS;
        vec3 n3 = rotZ(-0.8) * rotX(-0.5) * n;
        u.z = asin(clamp(n3.y, -1.0, 1.0)) * NS;
        f = vec3(fw(u.x), fw(u.y), fw(u.z));
        // round the poles the latitudes close into a target: let the tilted
        // set take over there
        lead = smoothstep(0.985, 0.88, abs(n.y));
      #elif KIND == 3
        // concentric round the hole, crossed by strokes along the radius
        float r = length(vC.xy) / 0.01;
        float wob = (vnoise(vec3(normalize(vP.xy) * 2.5, r * 0.01 + vSeed)) - 0.5) * 4.0;
        u.x = r + wob;
        const float NA = 1024.0;
        u.y = (atan(vP.y, vP.x) / 6.2831853 + 0.5) * NA;
        u.z = u.y + r * 0.5;
        f = vec3(fw(u.x), fwWrap(u.y, NA), fwWrap(u.z, NA));
      #elif KIND == 4 || KIND == 5 || KIND == 6
        // along the length (a whole number of lines round, so they close
        // up), crossed by rings round it
        #if KIND == 4 || KIND == 6
          float around = vUv.x;
          float along = (vC.y + length(vC.xz)) / 0.01; // up the walls, across the tops
        #else
          float around = vUv.y;
          float along = vUv.x * 2048.0;
        #endif
        const float NR = 128.0;
        // the lines waver by a pixel or so on screen, whatever their count
        // (a fixed sway on the thing would span many lines on a thin rod and
        // twist them into a rope)
        float wob = (vnoise(vC * 5.0 + vSeed) - 0.5) * 2.0 + (vnoise(vC * 23.0 + vSeed) - 0.5) * 0.6;
        u.x = around * NR + wob * fw(around * NR);
        u.y = along + wob * fw(along);
        u.z = along * 0.7 + around * NR * 0.7;
        #if KIND == 5
          // on a tube, rings round it read as a rope: cross it on a slant
          u.y = u.x + along;
        #endif
        f = vec3(fw(u.x), fw(u.y), fw(u.z));
        #if KIND == 6
          // level courses first; across them, in the shadow, a slant (a
          // whole number of lines round, so it closes up), and the uprights
          // only in the deepest
          float NC = floor(6.2832 * length(vC.xz) / 0.01 + 0.5);
          float slant = u.y + around * NC;
          u = vec3(u.y, slant, u.x);
          f = vec3(f.y, fwWrap(slant, NC), f.x);
        #endif
      #elif KIND == 7
        // along the longest side (AXIS): planes that all contain it, and
        // two slants across in the shadow
        vec3 Cl = AXIS == 0 ? vC : AXIS == 1 ? vC.yzx : vC.zxy;
        float ow = vnoise(vC * 4.0 + 2.0) * 2.0 - 1.0;
        Cl += 0.004 * ow;
        const float S0 = 0.01;
        u.x = dot(Cl.yz, vec2(0.8, 0.6)) / S0;
        // (shallow, nearly along it: steep ones read as a rope on a thin bar)
        u.y = dot(Cl, normalize(vec3(0.18, -0.6, 0.78))) / S0;
        u.z = dot(Cl, normalize(vec3(-0.18, 0.78, -0.6))) / S0;
        f = vec3(fw(u.x), fw(u.y), fw(u.z));
      #else
        // three sets of planes; the cuts waver a little, with the object
        float ow = vnoise(vC * 4.0 + 2.0) * 2.0 - 1.0;
        float ow2 = vnoise(vC * 18.0 + 5.0) * 2.0 - 1.0;
        vec3 Cw = vC + (0.006 * ow + 0.002 * ow2);
        const float S0 = 0.01;
        u.x = dot(Cw, normalize(vec3(0.62, 0.74, 0.26))) / S0;
        u.y = dot(Cw, normalize(vec3(0.78, -0.45, 0.43))) / S0;
        u.z = dot(Cw, normalize(vec3(-0.21, 0.35, 0.91))) / (S0 * 0.85);
        f = vec3(fw(u.x), fw(u.y), fw(u.z));
      #endif
      oU = vec4(u, float(KIND) + lead * 0.45);
      oF = vec4(f, vSeed);
    }`,
};

function coordPass(scene) {
  // one material per thing (they share their programs), for its own seed
  const cache = new WeakMap();
  const coordMat = (o, mat, kind, cutAt) => {
    let byKind = cache.get(o);
    if (!byKind) cache.set(o, (byKind = {}));
    const key = mat.uuid + kind;
    let m = byKind[key];
    if (!m) {
      const map = mat.alphaMap || mat.map || mat.uniforms?.map?.value || null;
      const cut = cutAt > 0 && !!map;
      m = new THREE.ShaderMaterial({
        ...coordShader,
        uniforms: { map: { value: map }, alphaTest: { value: cutAt }, uSeed: { value: (o.id * 0.6180339) % 1 } },
        defines: { KIND: KINDS[kind], AXIS: kind.startsWith('box') ? +kind[3] : 0, ...(cut ? { USE_CUT: '' } : {}) },
        side: mat.side,
      });
      byKind[key] = m;
    }
    return m;
  };
  const swapped = [], hidden = [], unspun = [];
  const clear = new THREE.Color();
  return {
    render(renderer, camera, target) {
      scene.traverseVisible((o) => {
        const mat = o.material;
        if (!mat) return;
        const one = Array.isArray(mat) ? mat[0] : mat;
        // a see-through thing is cut only if it asks to be (the giant's rings)
        const asked = o.isMesh && !!o.userData.strokes;
        if (!asked && (!o.isMesh || one.depthWrite === false || (one.transparent && !(one.alphaTest > 0)))) {
          hidden.push(o);
          return;
        }
        // a ball turning on its axis (userData.unspin) is cut as if it stood
        // still: its lines stay put while its bands go round under them,
        // instead of the whole engraving whirling with it. (A ball turned
        // about its axis covers the same pixels, so only the lines change.)
        if (o.userData.unspin) {
          unspun.push([o, o.rotation.y]);
          o.rotation.y = 0;
        }
        const kind = strokeKind(o);
        const cutAt = asked && one.transparent ? 0.3 : one.alphaTest;
        swapped.push([o, mat]);
        o.material = Array.isArray(mat) ? mat.map((m) => coordMat(o, m, kind, cutAt)) : coordMat(o, mat, kind, cutAt);
      });
      for (const o of hidden) o.visible = false;
      const shadows = renderer.shadowMap.autoUpdate;
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      renderer.shadowMap.autoUpdate = false;
      renderer.setClearColor(0x000000, 0);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setClearColor(clear, alpha);
      renderer.shadowMap.autoUpdate = shadows;
      for (const o of hidden) o.visible = true;
      for (const [o, mat] of swapped) o.material = mat;
      for (const [o, ry] of unspun) {
        o.rotation.y = ry;
        o.updateMatrixWorld();
      }
      swapped.length = hidden.length = unspun.length = 0;
    },
  };
}

// The veil: only what's light and see-through (drawn additively, or
// transparent without writing depth — but not the sky), on black; the solid
// things drawn in black, so a glow behind them is hidden.
function veilPass(scene) {
  const black = { [THREE.FrontSide]: null, [THREE.BackSide]: null, [THREE.DoubleSide]: null };
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) black[side] = new THREE.MeshBasicMaterial({ color: 0, side });
  const isVeil = (m) => m.blending === THREE.AdditiveBlending || (m.transparent && m.depthWrite === false);
  const swapped = [], hidden = [];
  const clear = new THREE.Color(), bgBlack = new THREE.Color(0);
  return {
    render(renderer, camera, target) {
      scene.traverseVisible((o) => {
        const mat = o.material;
        if (!mat) return;
        const one = Array.isArray(mat) ? mat[0] : mat;
        if (o.userData.sky) return hidden.push(o);
        if (isVeil(one)) return;
        if (!o.isMesh) return hidden.push(o);
        swapped.push([o, mat]);
        o.material = black[one.side];
      });
      for (const o of hidden) o.visible = false;
      const shadows = renderer.shadowMap.autoUpdate, bg = scene.background;
      const alpha = renderer.getClearAlpha();
      renderer.getClearColor(clear);
      renderer.shadowMap.autoUpdate = false;
      scene.background = bgBlack;
      renderer.setClearColor(0x000000, 1);
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setClearColor(clear, alpha);
      scene.background = bg;
      renderer.shadowMap.autoUpdate = shadows;
      for (const o of hidden) o.visible = true;
      for (const [o, mat] of swapped) o.material = mat;
      swapped.length = hidden.length = 0;
    },
  };
}
