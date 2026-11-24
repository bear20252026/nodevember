import * as THREE from 'three';
import { litMaterial, LIGHTS, SHADOW_BOX } from './common.js';
import { BALL, BodyGeometry, skinAt } from './body.js';

// The creature under its feathers: a small skinny body (an ellipsoid of skin, goose-
// pimpled), two big glossy eyes without lids, staring wide open whatever happens to it,
// and two bird legs (a bare drumstick, a scaly shank bending back at the ankle, three
// toes forward and one back, with claws).
//
// Its motion: a mass on springs. Held, it is pulled towards the pointer by a stiff, a
// little bouncy spring, so a shake of the pointer is a shake of the body; let go, it flies
// (thrown) and lands on its legs, which give like springs. It leans with its acceleration,
// squashes as it lands, breathes, turns a little towards the pointer and looks at it;
// left alone it now and then rouses (fluffs and shakes its coat, as birds do); naked it
// shivers. Its legs: the feet planted, each leg bent by a two-bone reach from the hip, a
// foot stepping again when it is left too far behind (bare, it
// now and then shuffles a side step or two, see walkAbout); lifted, they dangle and swing, their
// toes curled.

const UP = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion();

const DEPTH = new THREE.ShaderMaterial({
  vertexShader: 'void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'void main() { gl_FragColor = vec4(1.0); }',
});

const VERT_STD = /* glsl */ `
varying vec3 vW, vN, vL, vLN;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
  vL = position;
  vLN = normal;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// ---------------------------------------------------------------- skin
// Plucked skin, as a chicken's is: pale and wet-looking, the follicles soft domes of
// different sizes, big and close along the feather tracts (down the back, on either side
// of the breast, all over the head and neck), small and few in the bare lanes between
// (down the belly's middle, along the flanks), which ripple in fine wavy wrinkles; thin
// skin on the head with veins showing through; the long neck folded into rings; a sharp
// sheen on every bump; light through it all at the terminator. All of it drawn on the skin's parameters (vP), so it stays in place as
// the body changes shape.
// Bare, it is cold: the skin shivers, in fits (see `shiverFit` in the update), and it shows
// on its dots: each fit sends a band down the body, head to toes, the follicles standing up
// one by one as it reaches them (pimples with a pale tip and a dark pore, flushed round),
// trembling, and sinking back once it has passed.
// The same band carries the shudders, small waves running down through it, that move the
// surface and catch the light (a faint tremble elsewhere while it shivers). Nothing moves
// round the eyes and the hips, where the skin holds on to them.
const QUIVER = /* glsl */ `
  uniform float uShiver, uShiverT;
  uniform vec4 uGoose;
  // the shudders' height (-1 … 1) at p (the body's own space): all running down, from
  // the head to the feet (their waves' y negative), a little askew each; drawn broader
  // and slower than they could be (0.7 of it), so they don't drown the goosebumps
  float quiver(vec3 p) {
    float t = uShiverT * 0.7;
    p *= 0.7;
    float a = sin(dot(p, vec3(11.0, -34.0, 6.0)) - t * 47.0);
    float b = sin(dot(p, vec3(-9.0, -30.0, 10.0)) - t * 59.0 + 1.7);
    float c = sin(dot(p, vec3(6.0, -38.0, -9.0)) - t * 71.0 + 4.1);
    // the three beat against each other: the shudder comes and goes across the skin
    return (a + b * 0.8 + c * 0.6) / 2.4 * (0.55 + 0.45 * sin(dot(p, vec3(2.0, -7.0, 1.0)) - t * 9.0));
  }
  // the band each fit sends down the body (see uGoose): how far it has got to at the
  // height py (1 at the top, -1 at the feet), late by r (0 … 1), the last fit's still
  // passing. It carries both the shudders and the goosebumps: they come together
  float popped(float t, float r) {
    t -= r * 0.12;
    return smoothstep(0.0, 0.08, t) * exp(-max(t, 0.0) * 1.8) * (0.7 + 0.3 * r);
  }
  float band(float py, float r) {
    float lag = (1.0 - py) * 0.6;
    return max(popped(uGoose.x - lag, r), popped(uGoose.y - lag, r));
  }
  // where the skin may shiver: not on the eyes' rims, not where the legs go in
  float quiverMask(float eyeD, vec3 p, vec3 hipL, vec3 hipR) {
    return smoothstep(0.15, 0.7, eyeD) * smoothstep(0.1, 0.25, min(distance(p, hipL), distance(p, hipR)));
  }
`;
function skinMaterial(color) {
  return litMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uBumps: { value: 1 }, uRing: { value: new THREE.Color('#3a2a22') },
      uEyeL: { value: new THREE.Vector3() }, uEyeR: { value: new THREE.Vector3() }, uMorph: { value: 0 },
      uEyeCL: { value: new THREE.Vector4() }, uEyeCR: { value: new THREE.Vector4() }, uSocket: { value: 0 },
      uHipL: { value: new THREE.Vector3() }, uHipR: { value: new THREE.Vector3() },
      uFilL: { value: new THREE.Vector4(0, -1, 0, 0) }, uFilR: { value: new THREE.Vector4(0, -1, 0, 0) },
      uShiver: { value: 0 }, uShiverT: { value: 0 }, uGoose: { value: new THREE.Vector4(99, 99, 0, 0) } },
    vertexShader: /* glsl */ `
      attribute vec3 param;
      uniform vec4 uEyeCL, uEyeCR;
      uniform vec3 uHipL, uHipR;
      ${QUIVER}
      uniform float uSocket;
      uniform vec4 uFilL, uFilR;
      varying vec3 vW, vN, vL, vP;
      varying float vEyeD, vFil;
      // where a leg goes in, the body and the thigh are one skin: the skin is pushed out
      // along its normal onto the smooth union of the body and the thigh (a polynomial
      // smooth min of the two distances, the body's 0 on its own skin), which wraps a soft
      // concave fillet round the thigh's top, meeting it tangentially, as a bird's skin
      // goes on down its drumstick; the normal is the union's gradient (exactly: the
      // blend of the two). The thigh: its axis f.xyz from its root p, f.w its length, its
      // radius along it as the drumstick's profile (see drumstick)
      const float FIL_K = 0.13;
      float thighR(float y) {
        if (y < 0.07) return mix(0.066, 0.078, y / 0.07);
        if (y < 0.2) return mix(0.078, 0.072, (y - 0.07) / 0.13);
        if (y < 0.36) return mix(0.072, 0.054, (y - 0.2) / 0.16);
        return mix(0.054, 0.037, clamp((y - 0.36) / 0.16, 0.0, 1.0));
      }
      void fillet(vec4 f, vec3 p, inout vec3 pos, inout vec3 n, inout float k) {
        if (f.w <= 0.0) return;
        vec3 v = pos - p;
        float a = clamp(dot(v, f.xyz), 0.0, f.w * 0.5);
        vec3 r = v - f.xyz * a;
        float rl = length(r);
        float dt = rl - thighR(a / f.w);
        vec3 gt = r / max(rl, 1e-5);
        // smin(0, dt): the union's value at the skin (negative: under the union's surface)
        float h = clamp(0.5 + 0.5 * dt / FIL_K, 0.0, 1.0);
        float u = mix(dt, 0.0, h) - FIL_K * h * (1.0 - h);
        if (u >= 0.0) return;
        pos += n * min(-u, FIL_K * 0.5);
        n = normalize(mix(gt, n, h));
        k = max(k, 1.0 - h);
      }
      // round each eye the skin swells up and climbs a little onto it, in a soft fillet
      // (no seam where a ball is stuck into a body): raised along its normal by how near
      // it is to the eye's surface, its normal tilted with the slope; only as the coat goes
      // (under it, the face's hairs are rooted on the skin as it was)
      void socket(vec4 e, inout vec3 pos, inout vec3 n, inout float dmin) {
        vec3 g = pos - e.xyz;
        float L = length(g);
        g /= max(L, 1e-5);
        float d = (L - e.w) / e.w;
        const float W = 0.5;
        float H = 0.13 * uSocket;
        float t = clamp(1.0 - d / W, 0.0, 1.0);
        vec3 gt = g - n * dot(g, n);
        pos += n * e.w * H * t * t;
        n = normalize(n + gt * (2.0 * H * t / W));
        // how far from the eye it ends up
        dmin = min(dmin, (length(pos - e.xyz) - e.w) / e.w);
      }
      void main() {
        vec3 pos = position, nrm = normal;
        float dmin = 10.0;
        socket(uEyeCL, pos, nrm, dmin);
        socket(uEyeCR, pos, nrm, dmin);
        vEyeD = dmin;
        float fil = 0.0;
        fillet(uFilL, uHipL, pos, nrm, fil);
        fillet(uFilR, uHipR, pos, nrm, fil);
        vFil = fil;
        // the shudders: the surface itself moves (it shows on the outline)
        float sb = 0.15 * uShiver + uGoose.z * band(normalize(param).y, 0.5);
        pos += nrm * quiver(pos) * 0.003 * sb * quiverMask(dmin, pos, uHipL, uHipR);
        vec4 w = modelMatrix * vec4(pos, 1.0);
        vW = w.xyz;
        vN = normalize(transpose(inverse(mat3(modelMatrix))) * nrm);
        vL = pos;
        vP = param;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor, uRing, uEyeL, uEyeR, uHipL, uHipR;
      uniform float uBumps, uMorph;
      varying vec3 vW, vN, vL, vP;
      varying float vEyeD, vFil;
      ${QUIVER}
      // the follicles: soft domes of different sizes on a jittered lattice, (height, its
      // own random, how far it stands up, its pore). Cold, the goosebumps are these same
      // dots standing up: each fit sends a band down the body, head to feet, and each
      // follicle pops up as it reaches it (a little early or late, its own), into a pimple
      // with a tip and its pore open on it, and sinks back once the band has passed: the
      // dots rising in a wave, one after another. gh their rise, on top of the domes (not
      // squeezed with them, nor flattened in the lanes: there, the small follicles stand up
      // as well). py the height on the body (1 at the top, -1 at the feet), gm how cold,
      // tw how hard it shivers (they twitch with it)
      const float FOL = 50.0;
      vec4 follicles(vec3 p, float py, float gm, float tw, out float gh) {
        vec3 i = floor(p), f = fract(p);
        float h = 0.0, rnd = 0.0, gs = 0.0, po = 0.0;
        gh = 0.0;
        for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
          vec3 g = vec3(x, y, z);
          vec3 r3 = hash33(i + g);
          vec3 o = 0.5 + (r3 - 0.5) * 0.6;
          float r = 0.5 + 0.22 * r3.x;
          float k = clamp(length(g + o - f) / r, 0.0, 1.0);
          float dome = pow(1.0 - k * k, 2.0) * (0.7 + 0.6 * r3.y);
          // summed (where two meet they merge, no crease)
          h += dome;
          rnd += dome * r3.z;
          // when the band reaches it (its own height, not the pixel's: the whole dot at once)
          float yc = py + (g.y + o.y - f.y) / FOL * 2.1;
          float up = gm * band(yc, r3.z);
          if (up > 0.002) {
            // up, it trembles: nudged about; narrower, pointed
            o += (hash33(i + g + 7.0) - 0.5) * 0.1 * tw * sin(uShiverT * 43.0 + r3.y * 40.0);
            float kp = clamp(length(g + o - f) / (r * 0.8), 0.0, 1.0);
            gh += up * pow(1.0 - kp, 1.6) * (0.8 + 0.4 * r3.y);
            gs = max(gs, up * smoothstep(1.0, 0.3, kp));
            po = max(po, up * smoothstep(0.22, 0.07, kp));
          }
        }
        return vec4(1.0 - exp(-h * 1.3), rnd / max(h, 1e-3), gs, po);
      }
      void main() {
        vec3 p = normalize(vP);
        float th = acos(clamp(p.y, -1.0, 1.0));
        // the tracts, and the bare lanes between them
        float belly = exp(-pow(p.x / 0.14, 2.0)) * smoothstep(0.05, -0.35, p.y) * smoothstep(-0.5, 0.2, p.z);
        float flank = exp(-pow((abs(p.x) - 0.86) / 0.14, 2.0)) * smoothstep(0.3, 0.0, p.y) * smoothstep(-0.92, -0.6, p.y);
        float tract = (1.0 - max(belly, flank)) * smoothstep(0.15, 0.45, vnoise(p * 4.0) + 0.25);
        tract = max(tract, smoothstep(-0.05, 0.25, p.y) * 0.85); // the head and neck: all tract
        // on the parameters while it is a ball, on the body itself once it is drawn out
        // (the neck, the head would squeeze them into needles)
        float wb = smoothstep(0.35, 0.9, uMorph);
        vec3 q = mix(p * 0.47, vL, wb);
        // cold: goosebumps, in a wave rolling down the body (each fit, a new one), carried
        // by the follicles themselves, each twitching on its own once it is up
        float qm = quiverMask(vEyeD, vL, uHipL, uHipR);
        float sm = uShiver * qm;
        float gh;
        vec4 fo = follicles(q * FOL, p.y, uGoose.z * qm, uShiver, gh);
        // finer than a pixel: flattened, not shimmering
        float sharp = smoothstep(0.9, 0.35, length(fwidth(q * FOL)));
        float dome = fo.x * mix(0.12, 1.0, tract * tract) * mix(0.6, 1.0, smoothstep(0.3, 0.7, vnoise(q * 18.0)));
        // risen, flickering a little while it shivers
        dome += gh * 1.5 * (1.0 + uShiver * 0.25 * sin(uShiverT * 37.0 + fo.y * 50.0));
        float pore = fo.w;
        // the skin between rippled in fine wavy wrinkles, most in the lanes
        float wr = sin(q.y * 260.0 + vnoise(q * 14.0) * 7.0 + vnoise(q * 45.0) * 1.6);
        float ripples = (0.5 + 0.5 * wr) * smoothstep(0.25, 0.75, vnoise(q * 7.0 + 2.0)) * mix(1.0, 0.35, tract)
          * smoothstep(0.7, 0.25, length(fwidth(q.y * 41.0)));
        // the neck folded in rings (as it becomes one)
        float neck = smoothstep(98.0, 106.0, degrees(th)) * smoothstep(128.0, 121.0, degrees(th)) * uMorph;
        float fold = pow(0.5 + 0.5 * sin(vL.y * 120.0 + vnoise(p * 9.0) * 4.0 + vnoise(vL * 30.0) * 2.0), 4.0) * neck * (0.5 + vnoise(vL * vec3(20.0, 6.0, 20.0))) * smoothstep(0.6, 0.2, length(fwidth(vL.y * 24.0)));
        float fine = vnoise(vL * 300.0) * smoothstep(1.0, 0.4, length(fwidth(vL * 300.0)));
        float h = dome * sharp * 1.1 + ripples * 0.22 + fine * 0.08 + fold * 0.9;
        // the shudders, the same as the vertices' (their slope lights them): in the band that
        // raises the goosebumps, with them, a faint tremble elsewhere while it shivers
        h += quiver(vL) * qm * (0.15 * uShiver + uGoose.z * band(p.y, 0.5)) * 1.2 / max(uBumps, 0.05);
        // smooth, stretched skin round the eyes
        h *= mix(0.25, 1.0, smoothstep(0.0, 0.4, vEyeD));
        // and on the sleeve over the thigh, pulled smoother the nearer the leg
        h *= 1.0 - smoothstep(0.0, 0.5, vFil) * 0.45;

        // bump mapped from the screen-space slope of the height
        vec3 N = normalize(vN);
        float hw = h * 0.004 * uBumps;
        vec3 dpx = dFdx(vW), dpy = dFdy(vW);
        vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
        float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dFdx(hw) * r1 + dFdy(hw) * r2);
        N = normalize(abs(det) * N - grad);
        vec3 V = normalize(cameraPosition - vW);

        // the colour: pale, a little mottled, the domes paler and creamier (the fat under
        // them), pinker between; violet where it is thin (head, neck, the lanes), veins
        float blotch = vnoise(p * 7.0 + 3.0) * 0.6 + vnoise(p * 19.0) * 0.4;
        vec3 albedo = uColor * mix(0.93, 1.05, blotch);
        albedo = mix(albedo * vec3(0.98, 0.9, 0.9), albedo * vec3(1.06, 1.04, 0.96), smoothstep(0.1, 0.8, dome * sharp));
        albedo = mix(albedo, albedo * vec3(1.02, 0.88, 0.9), smoothstep(0.55, 0.85, vnoise(p * 5.0 + 11.0)) * 0.5);
        float thin = max(max(belly, flank) * 0.5, smoothstep(0.1, 0.5, p.y) * 0.6 + neck * 0.4);
        albedo = mix(albedo, albedo * vec3(0.9, 0.86, 1.0), thin * 0.35);
        float vr = 1.0 - abs(vnoise(p * vec3(11.0, 17.0, 11.0) + 5.0) * 2.0 - 1.0);
        float vein = smoothstep(0.9, 0.98, vr) * smoothstep(0.0, 0.4, p.y) * (0.5 + 0.5 * vnoise(p * 4.0));
        albedo = mix(albedo, albedo * vec3(0.76, 0.68, 0.92), vein * 0.4);
        albedo *= 1.0 - fold * 0.18;
        // a risen follicle: blanched on top, its pore a dark point, flushed round its foot
        float gz = fo.z * sharp;
        albedo = mix(albedo, albedo * vec3(1.08, 1.05, 0.98), gz * 0.8);
        albedo = mix(albedo, albedo * vec3(1.02, 0.86, 0.86), smoothstep(0.0, 0.35, sm) * (1.0 - gz) * smoothstep(0.05, 0.4, fo.x) * 0.35);
        albedo *= 1.0 - pore * sharp * 0.6;
        // round the eyes, a ring of tiny dark feathers while the coat holds, then just darker skin
        float ang = acos(clamp(max(dot(p, uEyeL), dot(p, uEyeR)), -1.0, 1.0));
        float fuzz = vnoise(p * 140.0) * 0.5 + 0.5;
        float ring = smoothstep(0.5, 0.3, ang + (fuzz - 0.5) * 0.08);
        albedo = mix(albedo, mix(albedo * vec3(0.84, 0.74, 0.78), uRing * fuzz, smoothstep(0.1, 0.6, uCoverage)), ring);
        // a little shade in the hollow of the fillet, where the skin turns down the leg
        float ao = 1.0 - smoothstep(0.1, 0.5, vFil) * 0.2;
        // where the skin meets the eye: shaded in the fold, a little pinker and wetter
        float meet = smoothstep(0.3, 0.0, vEyeD);
        ao *= mix(1.0, 0.35, smoothstep(0.12, 0.0, vEyeD));
        albedo = mix(albedo, albedo * vec3(0.92, 0.72, 0.74), meet * 0.6);

        float nl = dot(N, uKeyDir);
        float sh = shadowAt(vW, N, 2.5, 0.006);
        // soft, light through the skin at the terminator (more where it is thin)
        float wrap = max((nl + 0.55) / 1.55, 0.0);
        vec3 diff = albedo * wrap * wrap * mix(vec3(1.0), vec3(1.25, 0.78, 0.7), (1.0 - clamp(nl, 0.0, 1.0)) * (0.5 + thin * 0.3));
        vec3 H = normalize(uKeyDir + V);
        // wet: a sharp sheen on every dome and ripple, a broad one under it
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float nh = max(dot(N, H), 0.0);
        float spec = (pow(nh, 90.0) * 0.55 + pow(nh, 14.0) * 0.06) * (0.6 + fres * 2.0) * step(0.0, nl);
        vec3 col = uKeyColor * sh * (diff + spec) * mix(1.0, ao, 0.6);
        float nr = dot(N, uRimDir);
        col += uRimColor * albedo * vec3(1.1, 0.88, 0.84) * max((nr + 0.2) / 1.2, 0.0) * 0.5 * pow(1.0 - max(dot(N, V), 0.0), 1.5);
        col += albedo * hemi(N) * 0.9 * ao;
        col += hemi(reflect(-V, N)) * fres * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- eyes
// A big glossy eye: the pupil is never quite the same. It widens with fright (held,
// thrown, shaken, and slowly calming down after), more still once it is bare, narrows a
// little when the pointer comes close, and breathes all the time (hippus), each eye on
// its own. The pupil is not a flat disc: its edge a little uneven, fringed by the
// iris' dark ruff, a faint depth in it, the lens' small upside-down glint behind the
// cornea's. The iris' fibres stretch and bunch with it, a paler collarette half-way.
// The iris takes its colour from the plumage (see irisOf in plumage.js).
function eyeMaterial(seed) {
  return litMaterial({
    uniforms: { uPupil: { value: 0.55 }, uSeed: { value: seed }, uOut: { value: new THREE.Vector3(0, 0, 1) },
      uIrisIn: { value: new THREE.Color(0.12, 0.055, 0.016) }, uIrisOut: { value: new THREE.Color(0.44, 0.21, 0.055) } },
    vertexShader: /* glsl */ `
      varying vec3 vW, vN, vL, vAxis;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal);
        vL = position;
        vAxis = normalize(mat3(modelMatrix) * vec3(0.0, 0.0, 1.0));
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uPupil, uSeed;
      uniform vec3 uIrisIn, uIrisOut, uOut;
      varying vec3 vW, vN, vL, vAxis;
      void main() {
        vec3 p = normalize(vL);
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float ang = acos(clamp(p.z, -1.0, 1.0));
        float ph = atan(p.y, p.x);
        vec2 cs = vec2(cos(ph), sin(ph));
        float sd = uSeed * 17.0;
        // the pupil's edge, a little uneven (crinkled finely, lobed a little)
        float wob = (vnoise(vec3(cs * 2.0, sd)) - 0.5) * 0.05 + (vnoise(vec3(cs * 9.0, sd + 4.0)) - 0.5) * 0.022;
        float pr = uPupil * (1.0 + wob);
        float aa = fwidth(ang) * 1.5 + 0.004;
        float pupil = smoothstep(pr + aa, pr - aa, ang);
        float irisR = 0.84;
        float iris = smoothstep(irisR + 0.02, irisR - 0.02, ang);
        // the iris: on its own width, so its fibres follow the pupil as it moves
        float t = clamp((ang - pr) / (irisR - pr), 0.0, 1.0);
        // fibres: radial, wavy, bunched where the iris is narrow (pupil wide)
        float bunch = mix(1.0, 1.6, smoothstep(0.5, 0.7, pr));
        float fib = vnoise(vec3(ph * 11.0 * bunch + vnoise(vec3(t * 3.0, ph * 2.0, sd)) * 2.5, t * 2.0, sd + 1.0));
        float fib2 = vnoise(vec3(ph * 31.0 * bunch, t * 5.0, sd + 2.0));
        float streak = 0.62 + 0.28 * fib + 0.16 * fib2;
        vec3 irisCol = mix(uIrisIn, uIrisOut, smoothstep(0.0, 0.75, t)) * streak;
        // a paler collarette, wavy, a third of the way out
        float col1 = 0.35 + 0.06 * sin(ph * 7.0 + sd) + (vnoise(vec3(cs * 4.0, sd + 3.0)) - 0.5) * 0.1;
        irisCol *= 1.0 + 0.35 * exp(-pow((t - col1) / 0.07, 2.0));
        // crypts: little dark pits
        float crypt = smoothstep(0.62, 0.78, vnoise(vec3(ph * 6.0, t * 7.0, sd + 5.0))) * smoothstep(0.1, 0.3, t) * smoothstep(0.8, 0.55, t);
        irisCol *= 1.0 - crypt * 0.45;
        // the limbal ring, dark
        irisCol *= mix(1.0, 0.35, smoothstep(0.8, 1.0, t));
        vec3 albedo = mix(vec3(0.06, 0.04, 0.035), irisCol, iris);
        // the ruff: a dark, beaded fringe at the pupil's edge
        float ruff = smoothstep(0.07, 0.0, ang - pr) * (0.6 + 0.4 * vnoise(vec3(cs * 26.0, sd + 6.0)));
        albedo = mix(albedo, vec3(0.03, 0.015, 0.008), ruff * iris * 0.8);
        // the pupil itself: deep, a faint brown-grey haze at its rim, blacker inside
        float q = ang / max(pr, 1e-3);
        vec3 pupilCol = mix(vec3(0.0015, 0.0012, 0.0012), vec3(0.018, 0.012, 0.01), smoothstep(0.5, 1.0, q));
        albedo = mix(albedo, pupilCol, pupil);
        // sunk in the skin: in its shade towards where it meets it, the room's reflection
        // hidden there too
        float out_ = dot(p, uOut);
        float occ = mix(0.25, 1.0, smoothstep(0.5, 0.75, out_));
        float sh = shadowAt(vW, N, 2.0, 0.004);
        vec3 col = albedo * (uKeyColor * sh * max(dot(N, uKeyDir), 0.0) * 0.6 + hemi(N) * 0.8) * occ;
        // the wet cornea: the lights and the room mirrored
        vec3 Rf = reflect(-V, N);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 env = mix(uBounce * 1.2, uSky * 2.2, smoothstep(-0.2, 0.6, Rf.y)) * occ;
        env += vec3(1.0, 0.95, 0.9) * smoothstep(0.93, 0.97, dot(Rf, uKeyDir)) * 6.0 * sh * occ;
        env += uKeyColor * pow(max(dot(Rf, uKeyDir), 0.0), 900.0) * 30.0 * sh;
        env += uRimColor * pow(max(dot(Rf, uRimDir), 0.0), 300.0) * 6.0;
        col += env * mix(0.06, 1.0, fres);
        // behind it, in the pupil, the lens' glint: small, dim, warm, mirrored across the axis
        vec3 H = normalize(uKeyDir + V);
        vec3 Hm = normalize(2.0 * dot(vAxis, H) * vAxis - H);
        float lens = smoothstep(0.9975, 0.9995, dot(N, Hm)) * pupil * sh;
        col += uKeyColor * vec3(1.0, 0.85, 0.65) * lens * 0.35;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- beak
// A small beak, peeking out of the fluff and still there once it is bare: short,
// a little hooked, wider than high, pale horn going yellow-orange at the base, the line
// of the mouth along its sides, glossy.
function beakMesh() {
  const prof = [[0.0, -0.01], [1.0, 0.0], [0.95, 0.18], [0.78, 0.4], [0.52, 0.65], [0.26, 0.86], [0.08, 0.97], [0.0, 1.0]];
  const curve = new THREE.CatmullRomCurve3(prof.map(([r, y]) => new THREE.Vector3(r, y, 0)));
  const g = new THREE.LatheGeometry(curve.getPoints(24).map((p) => new THREE.Vector2(Math.max(p.x, 0), p.y)), 32);
  // to size (along y: its length; z: down), hooked down towards the tip
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    pos.setXYZ(i, x * 0.036, y * 0.075, z * 0.03 + y * y * 0.022);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, litMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vW, vN, vL; varying vec2 vUv;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(transpose(inverse(mat3(modelMatrix))) * normal); vL = position; vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vW, vN, vL; varying vec2 vUv;
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float t = vUv.y;
        vec3 albedo = mix(vec3(0.52, 0.2, 0.03), vec3(0.7, 0.4, 0.1), smoothstep(0.1, 0.8, t));
        albedo *= 0.94 + 0.1 * vnoise(vec3(vUv * vec2(20.0, 40.0), 1.0));
        // the mouth's line along both sides, from the corner (the gape, pinker) to the tip
        float side = min(abs(vUv.x - 0.25), abs(vUv.x - 0.75));
        float mouth = smoothstep(0.018, 0.006, side) * smoothstep(0.02, 0.1, t) * smoothstep(0.98, 0.85, t);
        albedo = mix(albedo, vec3(0.86, 0.5, 0.42), smoothstep(0.08, 0.0, t) * 0.6);
        albedo = mix(albedo, vec3(0.12, 0.06, 0.04), mouth);
        // the nostrils, near the base on top
        float top = abs(vUv.x - 0.5);
        float nos = smoothstep(0.035, 0.015, abs(abs(vUv.x - 0.5) - 0.09)) * smoothstep(0.03, 0.0, abs(t - 0.3));
        albedo = mix(albedo, vec3(0.25, 0.14, 0.08), nos * 0.8);
        float nl = dot(N, uKeyDir);
        float sh = shadowAt(vW, N, 2.0, 0.004);
        vec3 H = normalize(uKeyDir + V);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float spec = (pow(max(dot(N, H), 0.0), 70.0) * 0.4 + pow(max(dot(N, H), 0.0), 12.0) * 0.05) * (0.6 + 2.0 * fres) * step(0.0, nl);
        vec3 col = uKeyColor * sh * (albedo * max((nl + 0.3) / 1.3, 0.0) + spec);
        col += albedo * vec3(1.0, 0.8, 0.5) * max(-nl, 0.0) * 0.25 * smoothstep(0.4, 1.0, t);
        col += albedo * hemi(N) * 0.85 + hemi(reflect(-V, N)) * fres * 0.3;
        gl_FragColor = vec4(col, 1.0);
      }`,
  }));
  m.userData.depthMaterial = DEPTH;
  return m;
}

// ---------------------------------------------------------------- legs
// A hen's legs (image 3): pale yellow, broad overlapping plates (scutes) down the front of
// the shank and across the top of the toes, the rest of the skin in small rounded scales
// like pebbles, all of it bump mapped, the grooves darker and warmer, the knuckles padded
// and pinker, the claws pale horn going translucent at the tip. The drumstick above is the
// body's skin going on.
function legMaterial(kind, color) {
  return litMaterial({
    uniforms: { uLen: { value: 1 }, uColor: { value: new THREE.Color(color) }, uKind: { value: kind },
      uAxis: { value: new THREE.Vector3(0, -1, 0) }, uContact: { value: 0.12 }, uTo: { value: new THREE.Color(color) }, uPad: { value: 0 }, uFwd: { value: new THREE.Vector3(0, 0, 1) } },
    vertexShader: VERT_STD,
    fragmentShader: /* glsl */ `
      uniform float uLen, uKind, uPad;
      uniform vec3 uColor, uAxis, uTo;
      uniform float uContact;
      varying vec3 vW, vN, vL, vLN;
      uniform vec3 uFwd;
      // cells in space: (distance to the nearest centre, to the edge between it and the next)
      vec2 cells(vec3 x) {
        vec3 i = floor(x), f = fract(x);
        float d1 = 9.0, d2 = 9.0;
        for (int a = -1; a <= 1; a++) for (int b = -1; b <= 1; b++) for (int c = -1; c <= 1; c++) {
          vec3 g = vec3(a, b, c);
          vec3 o = 0.5 + (hash33(i + g) - 0.5) * 0.75;
          float d = length(g + o - f);
          if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
        }
        return vec2(d1, d2 - d1);
      }
      void main() {
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vW);
        float s = vL.y * uLen;
        float ph = atan(vL.z, vL.x);
        float rad = max(length(vL.xz), 0.008);
        vec3 x3 = vec3(vL.x, s, vL.z);
        vec3 albedo = uColor;
        float h = 0.0, groove = 0.0, gloss = 0.25, scaleK = 0.0015, ao = 1.0;
        if (uKind < 0.5) {
          // scutes down the front (or over the top of a toe), overlapping (each rising to
          // its lower edge, under the next one's), split down the middle every other row
          float front = smoothstep(0.15, 0.6, dot(normalize(vN), uFwd)) * (1.0 - uPad);
          float row = s / 0.02 + vnoise(x3 * 60.0) * 0.3;
          float fr = fract(row);
          float plate = smoothstep(0.0, 0.14, fr) * (0.5 + 0.5 * fr) * smoothstep(1.0, 0.94, fr);
          float split = smoothstep(0.25, 0.05, abs(dot(normalize(vN), normalize(cross(uFwd, vec3(0.0, 1.0, 0.0)) + 1e-4)) - (hash11(floor(row)) - 0.5) * 0.3))
            * step(0.5, fract(floor(row) * 0.5)) * step(abs(uFwd.y), 0.9);
          float hs = plate * (1.0 - split * 0.8);
          // small round scales elsewhere, pebbles
          vec2 c = cells(x3 / 0.0075);
          float pebble = smoothstep(0.0, 0.3, c.y) * (1.0 - c.x * 0.5);
          h = mix(pebble, hs, front);
          groove = 1.0 - h;
          // finer than a pixel: just the colour, no relief
          float sharp = smoothstep(1.0, 0.35, length(fwidth(x3 / 0.0075)));
          h *= sharp;
          groove *= mix(0.35, 1.0, sharp);
          albedo *= mix(1.05, 0.74, groove) * (0.94 + 0.12 * vnoise(x3 * 40.0));
          albedo = mix(albedo, albedo * vec3(0.95, 0.74, 0.62), groove * 0.45);
          // the knuckles and the pads (the joints): pinker
          albedo = mix(albedo, albedo * vec3(1.03, 0.84, 0.8), uPad * 0.55);
          gloss = 0.3;
        } else if (uKind < 1.5) {
          // the drumstick: the body's skin going on (the body's skin flows down onto its top
          // in a fillet, see the skin's), the same soft domes, the same colour and light as
          // the body's, so the two read as one skin; up to where the fillet lets go of it
          // (uContact) smoother and shaded as the fillet's hollow is; scaly towards the ankle
          float t = vL.y;
          vec2 c = cells(x3 / 0.022);
          float dome = pow(max(1.0 - c.x * c.x / 0.36, 0.0), 1.5);
          h = dome * smoothstep(0.7, 0.25, length(fwidth(x3 / 0.022)));
          float under = smoothstep(uContact + 0.07, uContact, s);
          h *= 1.0 - under * 0.45;
          albedo *= 0.95 + 0.08 * vnoise(vec3(ph * 2.0, s * 12.0, 3.0));
          albedo = mix(albedo * vec3(0.98, 0.9, 0.9), albedo * vec3(1.06, 1.04, 0.96), h);
          ao = 1.0 - under * 0.2;
          float toLeg = smoothstep(0.74, 0.95, t);
          albedo = mix(albedo, uTo * 0.92, toLeg);
          h *= 1.0 - toLeg;
          scaleK = 0.0018;
          gloss = 0.5;
        } else {
          // claws: pale horn, a little darker at the root, going translucent at the tip
          albedo = mix(vec3(0.3, 0.19, 0.08), vec3(0.56, 0.42, 0.22), smoothstep(0.0, 0.85, vL.y));
          h = vnoise(vec3(ph * 3.0, vL.y * 30.0, 5.0)) * 0.3;
          gloss = 0.3;
        }
        // bump mapped from the screen-space slope of the height
        float hw = h * scaleK;
        vec3 dpx = dFdx(vW), dpy = dFdy(vW);
        vec3 r1 = cross(dpy, N), r2 = cross(N, dpx);
        float det = dot(dpx, r1);
        vec3 grad = sign(det) * (dFdx(hw) * r1 + dFdy(hw) * r2);
        N = normalize(abs(det) * N - grad);

        float nl = dot(N, uKeyDir);
        float sh = shadowAt(vW, N, 2.0, 0.004);
        vec3 H = normalize(uKeyDir + V);
        float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        float spec = (pow(max(dot(N, H), 0.0), 60.0) * gloss + pow(max(dot(N, H), 0.0), 10.0) * 0.04) * (1.0 - groove * 0.7) * (0.6 + fres * 2.0) * step(0.0, nl);
        vec3 diff = albedo * max((nl + 0.35) / 1.35, 0.0);
        // light through the claws' tips and the thin skin
        if (uKind > 1.5) diff += albedo * vec3(1.0, 0.85, 0.6) * smoothstep(0.5, 1.0, vL.y) * max(-nl, 0.0) * 0.4;
        vec3 col = uKeyColor * sh * (diff + spec);
        col += uRimColor * albedo * max(dot(N, uRimDir), 0.0) * 0.3;
        col += albedo * hemi(N) * 0.85;
        if (uKind > 0.5 && uKind < 1.5) {
          // the drumstick's skin: lit exactly as the body's (see skinMaterial), going over
          // to the leg's own light as it turns to scales at the ankle
          float sk = 1.0 - smoothstep(0.74, 0.95, vL.y);
          float shS = shadowAt(vW, N, 2.5, 0.006);
          float wrap = max((nl + 0.55) / 1.55, 0.0);
          vec3 dS = albedo * wrap * wrap * mix(vec3(1.0), vec3(1.25, 0.78, 0.7), (1.0 - clamp(nl, 0.0, 1.0)) * 0.5);
          float nh = max(dot(N, H), 0.0);
          float spS = (pow(nh, 90.0) * 0.55 + pow(nh, 14.0) * 0.06) * (0.6 + fres * 2.0) * step(0.0, nl);
          vec3 cS = uKeyColor * shS * (dS + spS) * mix(1.0, ao, 0.6);
          cS += uRimColor * albedo * vec3(1.1, 0.88, 0.84) * max((dot(N, uRimDir) + 0.2) / 1.2, 0.0) * 0.5 * pow(1.0 - max(dot(N, V), 0.0), 1.5);
          cS += albedo * hemi(N) * 0.9 * ao;
          cS += hemi(reflect(-V, N)) * fres * 0.35;
          col = mix(col, cS, sk);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

// a segment: a tapered tube from its base (y = 0) to its end (y = 1), stretched to length
function segment(r0, r1, kind, color, radial = 14) {
  const g = new THREE.CylinderGeometry(r1, r0, 1, radial, 6, false);
  g.translate(0, 0.5, 0);
  const m = new THREE.Mesh(g, legMaterial(kind, color));
  m.userData.depthMaterial = DEPTH;
  return m;
}
// the drumstick: plump where it leaves the body, tapering to the ankle
function drumstick(color, to) {
  const prof = [[0.0, -0.02], [0.066, 0.0], [0.078, 0.07], [0.072, 0.2], [0.054, 0.36], [0.037, 0.52], [0.028, 0.7], [0.024, 0.88], [0.028, 0.96], [0.0, 1.0]];
  const pts = [];
  // a smooth outline through those
  const curve = new THREE.CatmullRomCurve3(prof.map(([r, y]) => new THREE.Vector3(r, y, 0)));
  for (const p of curve.getPoints(40)) pts.push(new THREE.Vector2(Math.max(p.x, 0), p.y));
  const g = new THREE.LatheGeometry(pts, 20);
  const m = new THREE.Mesh(g, legMaterial(1, color));
  m.material.uniforms.uTo.value.set(to);
  m.userData.depthMaterial = DEPTH;
  return m;
}
function joint(r, kind, color) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), legMaterial(kind, color));
  m.userData.depthMaterial = DEPTH;
  m.material.uniforms.uPad.value = 1;
  return m;
}
function place(mesh, a, b) {
  v1.subVectors(b, a);
  const len = v1.length();
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, v1.multiplyScalar(1 / Math.max(len, 1e-5)));
  mesh.scale.set(1, Math.max(len, 1e-4), 1);
  mesh.material.uniforms.uLen.value = len;
}

class Leg {
  constructor(scene, side, color, skin) {
    this.side = side;
    this.hipLocal = new THREE.Vector3(0.17 * side, -0.3, 0.03);
    this.hipN = new THREE.Vector3(0, -1, 0);
    this.l1 = 0.47;
    this.l2 = 0.5;
    this.foot = new THREE.Vector3();
    this.footVel = new THREE.Vector3();
    this.planted = false;
    this.step = null;
    this.curl = 0;
    this.hip = new THREE.Vector3();
    this.ankle = new THREE.Vector3();
    this.group = new THREE.Group();
    scene.add(this.group);
    this.thigh = drumstick(skin, color);
    this.shank = segment(0.03, 0.023, 0, color);
    this.ankleJ = joint(0.033, 0, color);
    this.pad = joint(0.03, 0, color);
    this.group.add(this.thigh, this.shank, this.ankleJ, this.pad);
    // toes: angle from forward, length; three forward, one back
    this.toes = [[-0.5, 0.15], [0, 0.19], [0.5, 0.155], [Math.PI, 0.11]].map(([ang, len]) => {
      const a = segment(0.02, 0.016, 0, color, 10), b = segment(0.016, 0.012, 0, color, 10), c = segment(0.013, 0.0015, 2, color, 10);
      const k1 = joint(0.018, 0, color), k2 = joint(0.015, 0, color);
      this.group.add(a, b, c, k1, k2);
      return { ang: ang * side, len, a, b, c, k1, k2 };
    });
  }
}

// how deep in the body the thigh is rooted, and about how far down it, past where it
// comes out, the skin's fillet holds on to it (see the skin's fillet)
const FIL_DEPTH = 0.07, FIL_REACH = 0.05;

const SHADOW_REACH = 1.15;
const sx = new THREE.Vector3(), sy = new THREE.Vector3(), sd = new THREE.Vector3(), sh = new THREE.Vector3();

export class Creature {
  constructor(scene, { skin = '#e9a48f', legColor = '#dcaa4e' } = {}) {
    this.scene = scene;
    this.skinRadii = BALL;
    // where the eyes are, on the skin's parameters (see body.js): on the ball, and on the
    // bare head, further apart (they slide there as the body changes)
    this.eyeDirs = [new THREE.Vector3(-0.42, 0.26, 0.87).normalize(), new THREE.Vector3(0.42, 0.26, 0.87).normalize()];
    // the beak, between and under the eyes (the coat parts round it, see coat.js)
    this.beakDir = new THREE.Vector3(0, Math.cos(83 * Math.PI / 180), Math.sin(83 * Math.PI / 180));
    this.eyeDirsBare = [new THREE.Vector3(-0.6, 0.3, 0.74).normalize(), new THREE.Vector3(0.6, 0.3, 0.74).normalize()];
    // where the legs go in
    this.hipDirs = [new THREE.Vector3(-0.27, -0.94, 0.14).normalize(), new THREE.Vector3(0.27, -0.94, 0.14).normalize()];
    // the shape: 0 the ball … 1 the bare bird, on a spring towards what the coat left
    this.morph = 0;
    this.morphV = 0;
    this.gravity = 30;
    this.standH = 1.2;
    this.pos = new THREE.Vector3(0, this.standH, 0);
    this.vel = new THREE.Vector3();
    this.acc = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.scale = new THREE.Vector3(1, 1, 1);
    this.lean = new THREE.Vector2();
    this.leanV = new THREE.Vector2();
    this.yaw = 0;
    this.sq = 0;
    this.sqV = 0;
    this.shake = 0;
    this.ruffle = 0;
    this.spinAcc = 0;
    this.coverage = 1;
    this.radius = 0.92;
    this.time = 0;
    this.grab = null; // { target: Vector3 } while held
    this.lookAt = new THREE.Vector3(0, 1.2, 5);
    this.nextRouse = 6 + Math.random() * 6;
    this.rouseT = -1;
    // fright (0 calm … 1 terrified): quick to rise, slow to go
    this.fright = 0;
    this.still = false;
    // shivering (bare): its fits, and the skin's own clock
    this.shiverFit = 0;
    this.shiverT = 0;
    this.fitT = -1;
    this.fitLen = 1;
    this.nextFit = 1;
    // the goosebumps' clock: time since this fit began, since the one before (each fit
    // sends its own front of goosebumps down the body, the last one's still settling)
    this.goose = new THREE.Vector4(99, 99, 0, 0);
    // bare, it now and then shuffles a side step or two (see walkAbout)
    this.walk = null;
    this.nextWalk = 3 + Math.random() * 3;

    // the body: skin, eyes
    this.body = new THREE.Group();
    scene.add(this.body);
    const skinMesh = new THREE.Mesh(new BodyGeometry(), skinMaterial(skin));
    skinMesh.userData.depthMaterial = DEPTH;
    skinMesh.frustumCulled = false;
    this.skinMesh = skinMesh;
    this.body.add(skinMesh);
    this.eyes = this.eyeDirs.map((dir0, k) => {
      const r = 0.15;
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), eyeMaterial(Math.random()));
      ball.userData.depthMaterial = DEPTH;
      this.body.add(ball);
      return { ball, dir0, dir1: this.eyeDirsBare[k], par: new THREE.Vector3(), dir: new THREE.Vector3(), center: new THREE.Vector3(),
        // each pupil a little its own: a size, a rhythm
        pupilBias: (Math.random() - 0.5) * 0.03, phase: Math.random() * 100 };
    });
    // the beak, on the head between and under the eyes
    this.beak = beakMesh();
    this.body.add(this.beak);
    this.head = new THREE.Vector3();
    this.placeOnSkin();

    this.legs = [-1, 1].map((side) => new Leg(scene, side, legColor, skin));
    this.placeOnSkin();
    for (const leg of this.legs) {
      this.hipWorld(leg, leg.hip);
      leg.foot.set(leg.hip.x, 0, leg.hip.z + 0.05);
      leg.planted = true;
    }
  }

  // its irises' colour: from the pupil (dark) out to the rim (light)
  setIris([inner, outer]) {
    for (const e of this.eyes) {
      e.ball.material.uniforms.uIrisIn.value.copy(inner);
      e.ball.material.uniforms.uIrisOut.value.copy(outer);
    }
  }

  // the eyes and the hips, where the skin has them for the current shape
  placeOnSkin() {
    const m = this.morph;
    this.skinMesh.geometry.set(m);
    const u = this.skinMesh.material.uniforms;
    u.uMorph.value = THREE.MathUtils.clamp(m, 0, 1);
    const mc = THREE.MathUtils.clamp(m, 0, 1);
    const n = v3;
    for (const e of this.eyes) {
      e.par.lerpVectors(e.dir0, e.dir1, mc).normalize();
      skinAt(e.par, m, e.center, n);
      e.dir.copy(n);
      // smaller on the small head, sunk in by half
      const r = 0.15 * THREE.MathUtils.lerp(1, 0.6, mc);
      e.center.addScaledVector(n, -r * 0.47);
      e.ball.position.copy(e.center);
      e.ball.scale.setScalar(r / 0.15);
      e.r = r;
    }
    u.uEyeL.value.copy(this.eyes[0].par);
    u.uEyeCL.value.set(...this.eyes[0].center.toArray(), this.eyes[0].r);
    u.uEyeCR.value.set(...this.eyes[1].center.toArray(), this.eyes[1].r);
    u.uSocket.value = 1 - THREE.MathUtils.smoothstep(this.coverage ?? 1, 0.1, 0.5);
    u.uEyeR.value.copy(this.eyes[1].par);
    // the beak, poking out of the face's short hairs on the ball (a little bigger there,
    // so it reads in the fluff), its own size on the bare head
    {
      skinAt(this.beakDir, m, this.beak.position, n);
      this.beak.position.addScaledVector(n, THREE.MathUtils.lerp(0.012, -0.008, mc));
      const fwd = v2.copy(n).addScaledVector(UP, -0.25).normalize();
      const side = v1.crossVectors(UP, fwd).normalize();
      const dn = new THREE.Vector3().crossVectors(side, fwd);
      this.beak.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, fwd, dn));
      this.beak.scale.setScalar(THREE.MathUtils.lerp(1.3, 1, mc));
    }
    // the head's middle (between the eyes, behind them), for picking it up
    this.head.addVectors(this.eyes[0].center, this.eyes[1].center).multiplyScalar(0.5);
    if (!this.legs) return;
    for (const leg of this.legs) {
      const d = this.hipDirs[leg.side < 0 ? 0 : 1];
      skinAt(d, m, leg.hipLocal, n);
      leg.hipN.copy(n);
      leg.hipLocal.addScaledVector(n, -FIL_DEPTH);
      (leg.side < 0 ? u.uHipL : u.uHipR).value.copy(leg.hipLocal);
    }
  }

  hipWorld(leg, out) {
    return out.copy(leg.hipLocal).multiply(this.scale).applyQuaternion(this.quat).add(this.pos);
  }

  get onGround() {
    return !this.grab && this.pos.y <= this.standH + 0.04;
  }

  // feet on the floor, held or not
  get touching() {
    return this.pos.y <= this.standH + 0.04;
  }

  // Kept where the key's shadow map reaches (SHADOW_BOX), all of it: the coat with its
  // flared feathers (a ball of SHADOW_REACH round its center) and the feet down on the
  // floor below. Seen from the key, across: the light's horizontal axis X; along: its
  // other axis Y, tilted up (raised, the creature goes up it; its feet stay lower).
  // Pushed back across X, or along the floor's direction of Y, and bounced off softly.
  keepInShadow() {
    const L = LIGHTS.uKeyDir.value;
    const X = sx.set(L.z, 0, -L.x).normalize();
    const Y = sy.crossVectors(L, X);
    const d = sd.subVectors(this.pos, SHADOW_BOX.center);
    const E = SHADOW_BOX.extent, R = SHADOW_REACH;
    const u = d.dot(X), v = d.dot(Y);
    const vFeet = v - this.pos.y * Y.y - 0.3;
    let du = 0, dv = 0;
    if (u > E - R) du = E - R - u;
    else if (u < R - E) du = R - E - u;
    if (v > E - R) dv = E - R - v;
    else if (vFeet < -E) dv = -E - vFeet;
    if (du) {
      this.pos.addScaledVector(X, du);
      const vn = this.vel.dot(X);
      if (vn * du < 0) this.vel.addScaledVector(X, -vn * 1.4);
    }
    if (dv) {
      // along the floor: H, the horizontal part of Y, moves v by |H|² per unit
      const H = sh.set(Y.x, 0, Y.z);
      const k = H.lengthSq();
      this.pos.addScaledVector(H, dv / k);
      const vn = this.vel.dot(H);
      if (vn * dv < 0) this.vel.addScaledVector(H, -vn * 1.4 / k);
    }
  }

  update(dt) {
    this.time += dt;
    const g = this.gravity;
    const prevVel = v3.copy(this.vel);
    const n = 4, h = dt / n;
    const a = v2;
    for (let i = 0; i < n; i++) {
      a.set(0, -g, 0);
      if (this.grab) {
        const K = 520, C = 17;
        a.x += K * (this.grab.target.x - this.pos.x) - C * this.vel.x;
        a.y += K * (this.grab.target.y - this.pos.y) - C * this.vel.y + g;
        a.z += K * (this.grab.target.z - this.pos.z) - C * this.vel.z;
      } else {
        // standing on its legs: springs that only push
        if (this.pos.y < this.standH) {
          a.y += 900 * (this.standH - this.pos.y) - 26 * this.vel.y;
          const fr = Math.exp(-10 * h);
          this.vel.x *= fr;
          this.vel.z *= fr;
        }
        this.vel.multiplyScalar(Math.exp(-0.15 * h));
      }
      this.vel.addScaledVector(a, h);
      this.pos.addScaledVector(this.vel, h);
      // held, it is stopped by its own legs on the floor (the hold's spring would overshoot)
      if (this.grab && this.pos.y < this.standH) { this.pos.y = this.standH; this.vel.y = Math.max(this.vel.y, 0); }
      // the room's bounds
      const lim = [[-3.2, 3.2], [0.5, 4.5], [-2.6, 2.4]];
      ['x', 'y', 'z'].forEach((k, j) => {
        if (this.pos[k] < lim[j][0]) { this.pos[k] = lim[j][0]; this.vel[k] = Math.abs(this.vel[k]) * 0.4; }
        if (this.pos[k] > lim[j][1]) { this.pos[k] = lim[j][1]; this.vel[k] = -Math.abs(this.vel[k]) * 0.4; }
      });
      this.keepInShadow();
    }
    this.acc.subVectors(this.vel, prevVel).multiplyScalar(1 / Math.max(dt, 1e-4));
    // how hard it is being shaken (free fall is not shaking)
    const jolt = v1.copy(this.acc).setY(this.acc.y + g * (this.grab || !this.onGround ? 1 : 0)).length();
    this.shake += (jolt - this.shake) * (1 - Math.exp(-dt / 0.06));

    // leaning with the acceleration, squashing as it lands
    const ax = THREE.MathUtils.clamp(this.acc.x, -900, 900), az = THREE.MathUtils.clamp(this.acc.z, -900, 900);
    this.leanV.x += (-110 * this.lean.x - 7 * this.leanV.x + 0.0035 * 110 * ax) * dt;
    this.leanV.y += (-110 * this.lean.y - 7 * this.leanV.y - 0.0035 * 110 * az) * dt;
    this.lean.addScaledVector(this.leanV, dt).clampScalar(-0.9, 0.9);
    const ay = THREE.MathUtils.clamp(this.acc.y + (this.onGround ? 0 : g), -900, 900);
    this.sqV += (-380 * this.sq - 9 * this.sqV - 0.0009 * 380 * ay) * dt;
    this.sq = THREE.MathUtils.clamp(this.sq + this.sqV * dt, -0.25, 0.25);
    const breath = this.still ? 0 : Math.sin(this.time * 2.4) * 0.012;
    const sy = 1 + this.sq + breath;
    this.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));

    // turning towards the pointer a little
    const want = THREE.MathUtils.clamp(Math.atan2(this.lookAt.x - this.pos.x, Math.max(this.lookAt.z - this.pos.z, 0.5)) * 0.45, -0.5, 0.5);
    this.yaw += (want - this.yaw) * (1 - Math.exp(-dt * 3));
    // bare, a side step now and then
    this.walkAbout(dt);

    // rousing now and then, shivering when bare
    const idle = !this.grab && this.onGround && !this.still;
    this.nextRouse -= dt;
    if (idle && this.nextRouse < 0 && this.rouseT < 0 && this.coverage > 0.15) { this.rouseT = 0; this.nextRouse = 8 + Math.random() * 9; }
    let rouseWob = 0;
    this.ruffle = 0;
    if (this.rouseT >= 0) {
      this.rouseT += dt;
      const t = this.rouseT;
      this.ruffle = Math.sin(Math.min(t / 1.1, 1) * Math.PI);
      rouseWob = Math.sin(t * 70) * 0.09 * Math.sin(Math.min(Math.max((t - 0.25) / 0.6, 0), 1) * Math.PI);
      if (t > 1.1) this.rouseT = -1;
    }
    this.ruffle = Math.max(this.ruffle, Math.min(this.shake / 300, 1) * 0.6);
    const bare = Math.pow(1 - this.coverage, 2);
    // the shivering comes in fits: every second or few, a strong one (quick to come, slower
    // to die down), a faint tremble between; the whole body twitching with it, the skin
    // shuddering (see the skin's material)
    this.nextFit -= dt;
    if (this.nextFit < 0) { this.goose.y = this.goose.x; this.goose.x = 0; this.fitT = 0; this.fitLen = 0.7 + Math.random() * 0.8; this.nextFit = this.fitLen + 0.8 + Math.random() * 2.4; }
    let fit = 0;
    if (this.fitT >= 0) {
      this.fitT += dt;
      const k = this.fitT / this.fitLen;
      fit = k < 0.15 ? k / 0.15 : Math.pow(Math.max(1 - (k - 0.15) / 0.85, 0), 1.5);
      if (k > 1) this.fitT = -1;
    }
    const cold = this.still ? 0 : bare * (0.3 + 0.7 * fit);
    this.shiverFit += (cold - this.shiverFit) * (1 - Math.exp(-dt * 12));
    if (!this.still) this.shiverT += dt;
    const su = this.skinMesh.material.uniforms;
    su.uShiver.value = this.shiverFit;
    su.uShiverT.value = this.shiverT;
    if (!this.still) { this.goose.x += dt; this.goose.y += dt; }
    this.goose.z = this.still ? 0 : bare;
    su.uGoose.value.copy(this.goose);
    const shiver = this.shiverFit * (Math.sin(this.time * 61) * 0.6 + Math.sin(this.time * 47 + 1)) * 0.016;
    // and a chatter up and down
    this.scale.y *= 1 + this.shiverFit * 0.008 * Math.sin(this.time * 53);

    // the twist's angular acceleration (about UP): what the coat feels of these shakes, its
    // feathers flung from side to side as the body whips back and forth under them
    this.spinAcc = -4900 * rouseWob - this.shiverFit * (61 * 61 * 0.6 * Math.sin(this.time * 61) + 47 * 47 * Math.sin(this.time * 47 + 1)) * 0.016;
    q1.setFromAxisAngle(UP, this.yaw + rouseWob + shiver);
    q2.setFromEuler(new THREE.Euler(this.lean.y, 0, this.lean.x, 'XYZ'));
    this.quat.multiplyQuaternions(q2, q1);

    // the shape follows the coat: still a ball while the coat is thick, drawn out into the
    // bare bird as the last of it goes, overshooting a little (a stretch, a wobble)
    const bareness = THREE.MathUtils.smoothstep(1 - this.coverage, 0.4, 0.93);
    this.morphV += (90 * (bareness - this.morph) - 9 * this.morphV) * dt;
    this.morph = THREE.MathUtils.clamp(this.morph + this.morphV * dt, -0.04, 1.08);
    this.placeOnSkin();
    const mc = THREE.MathUtils.clamp(this.morph, 0, 1);
    // and, bare, longer in the leg
    this.standH = THREE.MathUtils.lerp(1.2, 1.3, mc);
    for (const leg of this.legs) { leg.l1 = THREE.MathUtils.lerp(0.47, 0.53, mc); leg.l2 = THREE.MathUtils.lerp(0.5, 0.6, mc); }

    this.radius = THREE.MathUtils.lerp(THREE.MathUtils.lerp(0.5, 0.86, Math.pow(this.coverage, 0.6)), 0.26, mc);

    this.body.position.copy(this.pos);
    this.body.quaternion.copy(this.quat);
    this.body.scale.copy(this.scale);
    this.body.updateMatrixWorld(true);

    this.updateEyes(dt);
    for (const leg of this.legs) this.updateLeg(leg, dt);
  }

  // Bare and left alone on the floor, it now and then shuffles sideways a little, still
  // facing you: a hesitant side step or two (the foot on that side out first, the other
  // closing in after it, a little pause of doubt between each, the body carried over with
  // a small bob and a tilt towards it). Strayed off the middle, it shuffles back towards
  // it. Picked up, or covered again, it stops.
  walkAbout(dt) {
    const can = !this.grab && this.onGround && !this.still && this.morph > 0.85 && this.rouseT < 0;
    if (!can) {
      if (this.walk) { this.walk = null; this.nextWalk = 2 + Math.random() * 3; }
      // (once it can, the first shuffle comes soon: it is not left bare long, see main.js)
      else this.nextWalk = THREE.MathUtils.clamp(this.nextWalk, 1, 2.5);
      return;
    }
    if (!this.walk) {
      this.nextWalk -= dt;
      if (this.nextWalk > 0) return;
      // its right, as it faces
      const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      const off = this.pos.dot(right);
      const side = Math.abs(off) > 0.5 ? -Math.sign(off) : Math.random() < 0.5 ? -1 : 1;
      // out and in: two moves a side step, one or two of them
      const n = Math.random() < 0.6 ? 2 : 4;
      this.walk = { dir: right.multiplyScalar(side), side, n, i: -1, t: 0, dur: 0.3, wait: 0.15, move: 0.05 + Math.random() * 0.025 };
      return;
    }
    const w = this.walk;
    w.t += dt;
    if (w.i < 0 || w.t > w.dur + w.wait) {
      // the next move, after its moment of hesitation
      w.i++;
      if (w.i >= w.n) { this.walk = null; this.nextWalk = 2 + Math.random() * 3; return; }
      w.t = 0;
      w.dur = 0.24 + Math.random() * 0.1;
      w.wait = w.i % 2 === 0 ? 0.05 + Math.random() * 0.15 : 0.2 + Math.random() * 0.5;
      // first the foot on that side, out a little wider; then the other, closing in
      const out = w.i % 2 === 0;
      const leg = this.legs.find((l) => (l.side === w.side) === out);
      leg.step = { from: leg.foot.clone(), t: 0, dur: w.dur * 0.85, lead: w.dir.clone().multiplyScalar(out ? w.move * 0.6 : 0) };
      this.sqV += 0.5;
      this.vel.y += 0.2;
      w.prevK = 0;
    }
    // the body carried over through the move, eased
    const k = THREE.MathUtils.smootherstep(Math.min(w.t / w.dur, 1), 0, 1);
    this.pos.addScaledVector(w.dir, (k - w.prevK) * w.move);
    w.prevK = k;
    // tilting towards it a little as it goes
    const push = Math.sin(Math.min(w.t / w.dur, 1) * Math.PI) * 2.5 * dt;
    this.leanV.x -= w.dir.x * push;
    this.leanV.y += w.dir.z * push;
  }

  updateEyes(dt) {
    // looking at the pointer
    const local = v1.copy(this.lookAt).sub(this.pos).applyQuaternion(q1.copy(this.quat).invert());
    // no lids: the eyes stay wide open, staring, whatever happens to it
    // the pupils: wide with fright and when bare, narrower when the pointer is close
    const scared = Math.max(this.grab ? 0.55 : 0, this.onGround ? 0 : 0.45, THREE.MathUtils.smoothstep(this.shake, 25, 200));
    this.fright += (scared - this.fright) * (1 - Math.exp(-dt * (scared > this.fright ? 8 : 0.45)));
    const near = THREE.MathUtils.smoothstep(local.length(), 3.5, 1.2);
    const dil = THREE.MathUtils.clamp(0.32 + 0.55 * this.fright + 0.25 * (1 - this.coverage) - 0.22 * near, 0, 1);
    for (const e of this.eyes) {
      const d = v2.copy(local).sub(e.center).normalize();
      // no further than 0.45 rad off the eye's own axis
      const ang = d.angleTo(e.dir);
      if (ang > 0.45) d.lerpVectors(e.dir, d, 0.45 / ang).normalize();
      e.ball.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      // the skin's normal at the eye, in the eye's frame (for the skin's shade on it)
      e.ball.material.uniforms.uOut.value.copy(e.dir).applyQuaternion(q1.copy(e.ball.quaternion).invert());
      const tt = this.still ? 0 : this.time + e.phase;
      const hippus = (Math.sin(tt * 0.9) * 0.6 + Math.sin(tt * 2.3 + 1.3) * 0.3 + Math.sin(tt * 5.1) * 0.1) * 0.022;
      const want = THREE.MathUtils.lerp(0.4, 0.71, dil) + e.pupilBias + hippus;
      const pu = e.ball.material.uniforms.uPupil;
      // a pupil narrows faster than it widens
      pu.value += (want - pu.value) * (1 - Math.exp(-dt * (want < pu.value ? 7 : 3)));
    }
  }

  updateLeg(leg, dt) {
    const hip = this.hipWorld(leg, leg.hip);
    const reach = leg.l1 + leg.l2;
    const yawQ = q1.setFromAxisAngle(UP, this.yaw);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(yawQ);
    const mc = THREE.MathUtils.clamp(this.morph, 0, 1);
    const rest = new THREE.Vector3(THREE.MathUtils.lerp(0.2, 0.13, mc) * leg.side, 0, 0.06).applyQuaternion(yawQ).add(this.pos).setY(0.025);

    if (this.touching || (!this.grab && hip.y < reach * 0.98 && this.vel.y <= 0)) {
      if (!leg.planted) {
        // touching down
        leg.planted = true;
        leg.foot.set(leg.foot.x, 0.025, leg.foot.z);
      }
      leg.curl += (0 - leg.curl) * (1 - Math.exp(-dt * 10));
      const other = this.legs.find((l) => l !== leg);
      if (!leg.step && !other.step && leg.foot.distanceTo(rest) > 0.2) {
        leg.step = { from: leg.foot.clone(), t: 0 };
      }
      if (leg.step) {
        leg.step.t += dt / (leg.step.dur || 0.16);
        const t = Math.min(leg.step.t, 1);
        // a side step lands where it will stand (out a little wider), lifted less high
        const to = leg.step.lead ? v2.copy(rest).add(leg.step.lead) : rest;
        leg.foot.lerpVectors(leg.step.from, to, leg.step.lead ? THREE.MathUtils.smoothstep(t, 0, 1) : t);
        leg.foot.y = 0.025 + Math.sin(t * Math.PI) * (leg.step.lead ? 0.05 : 0.1);
        if (t >= 1) leg.step = null;
      }
      leg.footVel.set(0, 0, 0);
    } else {
      // dangling: the foot hangs below the hip on a spring, swinging
      leg.planted = false;
      leg.step = null;
      const down = new THREE.Vector3(0, -1, 0).applyQuaternion(this.quat);
      const target = v2.copy(hip).addScaledVector(down.add(new THREE.Vector3(0, -1, 0)).normalize(), reach * 0.86).addScaledVector(fwd, 0.08);
      leg.footVel.addScaledVector(v3.subVectors(target, leg.foot), 140 * dt).multiplyScalar(Math.exp(-6 * dt));
      leg.foot.addScaledVector(leg.footVel, dt);
      leg.foot.y = Math.max(leg.foot.y, 0.025);
      leg.curl += (1 - leg.curl) * (1 - Math.exp(-dt * 5));
    }

    // the reach: hip → ankle (bending back) → foot
    const dir = v1.subVectors(leg.foot, hip);
    let d = dir.length();
    dir.multiplyScalar(1 / Math.max(d, 1e-5));
    d = THREE.MathUtils.clamp(d, Math.abs(leg.l1 - leg.l2) + 0.02, reach * 0.999);
    leg.foot.copy(hip).addScaledVector(dir, d);
    const along = (leg.l1 * leg.l1 - leg.l2 * leg.l2 + d * d) / (2 * d);
    const off = Math.sqrt(Math.max(leg.l1 * leg.l1 - along * along, 0));
    const back = new THREE.Vector3().copy(fwd).negate().addScaledVector(dir, fwd.dot(dir)).normalize();
    leg.ankle.copy(hip).addScaledVector(dir, along).addScaledVector(back, off);

    place(leg.thigh, hip, leg.ankle);
    // the skin's sleeve over the thigh: along its axis in the body's own space
    {
      const tu = leg.thigh.material.uniforms;
      tu.uAxis.value.subVectors(leg.ankle, hip).normalize();
      const axL = v2.copy(tu.uAxis.value).applyQuaternion(q2.copy(this.quat).invert()).divide(this.scale).normalize();
      const su = this.skinMesh.material.uniforms;
      (leg.side < 0 ? su.uFilL : su.uFilR).value.set(axL.x, axL.y, axL.z, leg.l1);
      // where the fillet lets go of the thigh: past where it comes out of the skin
      tu.uContact.value = FIL_DEPTH / Math.max(axL.dot(leg.hipN), 0.3) + FIL_REACH;
      // and the same skin: retinted with the body's
      tu.uColor.value.copy(su.uColor.value);
    }
    place(leg.shank, leg.ankle, leg.foot);
    leg.shank.material.uniforms.uFwd.value.copy(fwd);
    leg.ankleJ.position.copy(leg.ankle);
    leg.pad.position.copy(leg.foot);

    // toes, curled when lifted
    const c = leg.curl;
    const side = new THREE.Vector3().crossVectors(UP, fwd).normalize();
    for (const toe of leg.toes) {
      const td = new THREE.Vector3().copy(fwd).applyAxisAngle(UP, toe.ang + (toe.ang === 0 ? 0 : 0.1 * c * Math.sign(toe.ang)));
      const axis = new THREE.Vector3().crossVectors(td, UP).normalize();
      const l1 = toe.len * 0.56, l2 = toe.len * 0.44;
      const d1 = td.clone().applyAxisAngle(axis, -(0.12 + c * 0.9));
      const d2 = td.clone().applyAxisAngle(axis, -(0.02 + c * 1.9));
      const d3 = td.clone().applyAxisAngle(axis, -(0.7 + c * 1.6));
      const p0 = leg.foot, p1 = p0.clone().addScaledVector(d1, l1);
      const p2 = p1.clone().addScaledVector(d2, l2);
      if (leg.planted) { p1.y = Math.max(p1.y, 0.018); p2.y = Math.max(p2.y, 0.014); }
      const p3 = p2.clone().addScaledVector(d3, 0.058);
      for (const sg of [toe.a, toe.b]) sg.material.uniforms.uFwd.value.set(0, 1, 0);
      place(toe.a, p0, p1);
      place(toe.b, p1, p2);
      place(toe.c, p2, p3);
      toe.k1.position.copy(p1);
      toe.k2.position.copy(p2);
    }
    void side;
  }
}
