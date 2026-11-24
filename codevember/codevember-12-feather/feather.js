import * as THREE from 'three';
import { litMaterial, GLSL_COMMON, LIGHTS } from './common.js';

// Every feather of the scene, on the creature or flying or lying on the floor, is an
// instance of one curved strip, its look worked out entirely in its fragment shader, so it
// stays sharp however close the eye comes.
//
// A feather's own frame: its quill's base at the origin, the shaft along +y (t from 0 at
// the base to 1 at the tip, in units of its length L), the vanes across x, the outer face
// towards +z. Two kinds:
//
// - contour feathers: a bare quill (calamus) at the base, round, see-through, drawn to a
//   point at its end, narrowing at the umbilicus into the shaft (rachis), deeper than wide, grooved
//   underneath, tapering to the tip: a tube of its own (the quill mesh), not painted on the
//   vane; a wisp of afterfeather at the umbilicus; from the rachis' sides the barbs, about 85 per length, leaving at 50°
//   near the base and 40° further up and curving a little towards the tip. The lower barbs
//   are downy (plumulaceous): long, wavy, apart, with a haze of barbules, light grey and
//   see-through. The upper ones are locked into a closed vane, a little narrower on one
//   side, its outline drawn barb by barb (each ends a little longer or shorter, and frays
//   apart at the very edge), split here and there where a few barbs have come unzipped, a
//   V opening towards the edge. Colour: the feather's own, a pale fringe at the edge of the
//   tip (overlapping, they give the coat its scalloped look), sometimes a darker band just
//   inside it, the base greying into the down, each barb a shade lighter or darker. Its
//   character (characters.js) shapes it further: how loose and fluffy the vane's edge is,
//   how many notches, how glossy, how steeply the barbs sweep up.
// - down: not a tuft, but a small, very light, soft, white feather under the others,
//   domed: a fine shaft, its barbs close and silky, held together into one soft
//   see-through vane wavering in locks, coming apart into wisps only at the edge, the
//   lowest dishevelled.
// - display feathers: contour feathers grown into wilder, almost abstract shapes (the
//   shape in iLook.y, 2 + its index in characters.js' DISPLAY_SHAPES): a bare wire ending
//   in a round vane with an eye (racket), a slender blade curling sideways into a spiral
//   (curl), barbs all apart into wavering filaments (wisp), a narrow blade curling over
//   into a hook (sickle), a long even streamer twisting round itself, its end forked
//   (ribbon), a thin streamer corkscrewing to a lancet at its end (coil). The curling
//   ones carry their own frame along their shaft (shaftAt), so they can turn any way.
//
// The barbs are filtered by their own size on screen: closer than about a pixel apart they
// fade into their average, so far off a feather is a smooth vane and nothing shimmers.
// Lit as fibres (Kajiya-Kay along each barb, two lobes), wrapped diffuse, light shining
// through (much more through the down), shadowed by the key's shadow map they also cast
// into; the coat's depth darkens what lies deep in it. Drawn with alpha to coverage on the
// multisampled target, so the barbs' edges are smooth without sorting.

// per instance:
//   iPos  (vec3)  the quill's base, world
//   iQuat (vec4)  the feather's frame, world
//   iBend (vec4)  the tip's bend (xyz, in the feather's frame, units of L), grown (w, 0…1)
//   iShape (vec4) length L, half width / L, cup across, twist
//   iCurve (vec4) the shaft's rise from the skin, its angle at the tip, where it has bent over (t), the coat's curvature
//   iLook (vec4)  seed, kind (0 contour, 1 down, 2 + shape a display feather), where the
//                 down ends (t), on the body (0/1)
//   iPat  (vec4)  fringe width, band strength, band place (t), tip roundness
//   iForm (vec4)  its character: edge fray, splits, sheen, barbs' sweep (down: x how dishevelled its base)
//   iColA (vec3)  the vane's colour, iColB (vec3) the fringe's, iColC (vec4) the tip's the
//                 vane shades to (rgb) and the iridescence (w, 0…1), iColD (vec4) the mark's
//                 (rgb) and the sheen's film thickness (w, µm): packed, as there is room
//                 for only 16 attributes
//   iMark (vec4)  the mark (0 none, 1 spots, 2 bars, 3 a streak along the shaft, 4 an eye,
//                 5 a dark edge), its density (per length), its strength, how far the vane
//                 shades to iColC
//   and its movement, packed in the colours' w (setFlow below): the shaft's sideways
//   curve (iColA.w, the tip's offset, units of L), its S (iColB.w, the middle bowed the
//   other way), how much the vane parts into locks (0…1, in iColC.w's whole part, by
//   hundredths, times two), how much its tip stirs in the air (in iColD.w's whole part,
//   by thousandths)
export const ATTRS = { iPos: 3, iQuat: 4, iBend: 4, iShape: 4, iCurve: 4, iLook: 4, iPat: 4, iForm: 4, iColA: 4, iColB: 4, iColC: 4, iColD: 4, iMark: 4 };

// write slot i's colours' w: its movement (flow: sweep, S, locks, stir) and sheen
// (iridescence 0…1, film thickness under 1 µm)
export function setFlow(a, i, [sweep, scurve, locks, stir], iri, film) {
  a.iColA[i * 4 + 3] = sweep;
  a.iColB[i * 4 + 3] = scurve;
  a.iColC[i * 4 + 3] = Math.round(Math.min(Math.max(locks, 0), 1) * 100) * 2 + Math.min(Math.max(iri, 0), 1.99);
  a.iColD[i * 4 + 3] = Math.round(Math.max(stir, 0) * 1000) + Math.min(Math.max(film, 0), 0.999);
}

const VERT_HEAD = /* glsl */ `
attribute vec3 iPos;
attribute vec4 iQuat, iBend, iShape, iCurve, iLook, iPat, iForm;
attribute vec4 iColA, iColB, iColC, iColD, iMark;
uniform vec4 uBody;
uniform float uFluff, uCoverage, uTime;
varying vec2 vF;
varying vec3 vW, vN, vU, vV, vBodyN;
varying float vAO;
flat varying vec4 vShape, vLook, vPat, vForm, vMark, vFlow;
flat varying vec3 vColA, vColB, vColC, vColD;
flat varying vec2 vSheen;
flat varying float vWidthF;

vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }

${'' /* the outline's profile, shared with the fragment shader */}
PROFILE

// the strip's half width at t, generous enough for the downy barbs (units of L)
float geomHW(float t) {
  // the down: its oval, and room for the dishevelled barbs at its base
  if (iLook.y > 0.5 && iLook.y < 1.5) return iShape.y * (1.25 * max(softProfile(t), 1.0 - smoothstep(0.0, 0.55, t)) + 0.12) + 0.02;
  // a display feather: its outline (either side), and room round its rounded parts
  // between the strip's rows
  if (iLook.y > 1.5) {
    float sh = iLook.y - 2.0;
    float m = max(max(showProfile(t, sh, 0.0, iLook.x), showProfile(t, sh, 1.0, iLook.x)), max(showProfile(t + 0.04, sh, 0.0, iLook.x), showProfile(t - 0.04, sh, 0.0, iLook.x)));
    return iShape.y * (1.2 * m + 0.25) + 0.022;
  }
  // and for the afterfeather at the umbilicus
  float aft = iShape.y * 0.7 * smoothstep(0.06, 0.14, t) * (1.0 - smoothstep(0.2, 0.4, t)) * step(0.02, iLook.z);
  return max(iShape.y * 1.6 * profile(t, iPat.w), aft) + 0.022;
}

// the shaft's angle from the feather's base plane along t: on the body it rises steeply
// from the skin through the down and bends over to lie along the coat; free, it relaxes
// into a feather's own gentle curve
float shaftAngle(float t) {
  float on = iCurve.x - (iCurve.x - iCurve.y) * smoothstep(0.0, iCurve.z, t) - iCurve.w * max(t - iCurve.z * 0.6, 0.0);
  float off = iLook.y > 0.5 && iLook.y < 1.5 ? 0.32 - 0.6 * t : 0.28 - 0.6 * t;
  return mix(off, on, iLook.w);
}
// a display feather's curl, on the body or free: how far its shaft has turned by t
// (radians), and which way it turns there (0 over, towards its underside; ±π/2 sideways,
// in its vane's own plane, the way it sweeps), by shape (iLook.y - 2), none for most:
// - sickle: over into a hook, leaning a little outwards
// - curl: sideways in its own plane, tightening into a spiral at the end
// - coil: round and round, the way it turns itself turning as it goes: a corkscrew
vec2 curlAt(float t) {
  float sh = iLook.y - 2.0, r = fract(iLook.x * 0.291), side = iColA.w < 0.0 ? -1.0 : 1.0;
  if (abs(sh - 3.0) < 0.5) return vec2(3.4 * pow(smoothstep(0.3, 1.0, t), 1.4), side * 0.35 * r);
  if (abs(sh - 1.0) < 0.5) return vec2((5.4 + 1.4 * r) * pow(smoothstep(0.15, 1.0, t), 1.9), side * (1.45 + 0.12 * r));
  // (bent about 12 rad per length, the bend's way turning 6 or so: a neat spring, small
  // and even, a turn and a half along its length)
  float u = smoothstep(0.15, 0.35, t) * (t - 0.15);
  return vec2((11.5 + 1.0 * r) * u, side * (1.2 + (6.0 + 0.8 * r) * u));
}
bool curls() { float sh = iLook.y - 2.0; return abs(sh - 1.0) < 0.5 || abs(sh - 3.0) < 0.5 || abs(sh - 5.0) < 0.5; }
vec3 shaftX; // across the vane at the shaft, at the t of the last shaftAt (a curling feather's turns)
// the last point integrated in full (a plain shaft's), to step from to the points next to
// it (the neighbours for the normals): one midpoint step rather than the whole integral
// again, alike to well under a thousandth of a length
bool shaftHeld = false;
float shaftT0;
vec2 shaftP0;
// the shaft's point at t (y along, z out), integrated, and the way out of its vane there
vec3 shaftAt(float t, out vec3 nrm) {
  shaftX = vec3(1.0, 0.0, 0.0);
  if (iLook.y > 1.5 && curls()) {
    // a curling display feather: its frame carried along the shaft, turned at each step
    // by its own bend (round its vane's across) and by its curl (towards the curl's way)
    float a0 = shaftAngle(0.0);
    vec3 T = vec3(0.0, cos(a0), sin(a0)), X = shaftX, p = vec3(0.0);
    float h = t / 28.0, aPrev = a0;
    vec2 cPrev = curlAt(0.0);
    for (int i = 0; i < 28; i++) {
      float tt = (float(i) + 1.0) * h;
      float a = shaftAngle(tt);
      vec2 c = curlAt(tt);
      // half the step's turn, a step along, the other half
      for (int k = 0; k < 2; k++) {
        vec3 N = cross(X, T);
        float db = (a - aPrev) * 0.5;
        T = normalize(T * cos(db) + N * sin(db));
        N = cross(X, T);
        float psi = 0.5 * (c.y + cPrev.y), dc = (c.x - cPrev.x) * 0.5;
        vec3 D = -N * cos(psi) + X * sin(psi);
        vec3 T2 = T * cos(dc) + D * sin(dc);
        X = X + sin(dc) * (dot(X, T) * D - dot(X, D) * T) + (cos(dc) - 1.0) * (dot(X, T) * T + dot(X, D) * D);
        T = normalize(T2);
        X = normalize(X - T * dot(X, T));
        if (k == 0) p += T * h;
      }
      aPrev = a; cPrev = c;
    }
    shaftX = X;
    nrm = cross(X, T);
    return p;
  }
  vec2 p = vec2(0.0);
  if (shaftHeld) {
    float am = shaftAngle(0.5 * (t + shaftT0));
    p = shaftP0 + vec2(cos(am), sin(am)) * (t - shaftT0);
  } else {
    float h = t / 12.0;
    for (int i = 0; i < 12; i++) {
      float a = shaftAngle((float(i) + 0.5) * h);
      p += vec2(cos(a), sin(a)) * h;
    }
    shaftHeld = true; shaftT0 = t; shaftP0 = p;
  }
  float a = shaftAngle(t);
  nrm = vec3(0.0, -sin(a), cos(a));
  return vec3(0.0, p);
}

// its movement (see setFlow), unpacked by unpackFlow: sweep, S, locks, stir
vec4 iFlow;
vec2 sheenW; // the sheen, from under the packed movement
vec2 stir; // the breeze on it now: sideways, lifting
float phase;
void unpackFlow() {
  float lk = floor(iColC.w * 0.5);
  float sk = floor(iColD.w);
  iFlow = vec4(iColA.w, iColB.w, lk / 100.0, sk / 1000.0);
  sheenW = vec2(iColC.w - lk * 2.0, iColD.w - sk);
  phase = fract(iLook.x * 0.137) * 6.2832;
  // a breeze through the coat: gusts rolling over it in waves, each feather lifting and
  // swaying as one passes, fluttering a little of its own
  float gust = 0.55 + 0.45 * sin(uTime * 0.37 + 1.3) * sin(uTime * 0.23);
  float wave = sin(dot(iPos, vec3(4.0, 5.5, 3.0)) - uTime * 2.6);
  float lift = pow(0.5 + 0.5 * wave, 3.0);
  float flut = sin(uTime * 5.0 + phase * 4.0) * 0.15;
  stir = iFlow.w * gust * vec2(wave * 0.6 + flut, lift * 1.3 + flut * 0.4);
}
// the shaft's way sideways, in the vane's plane: a sweep to the tip, an S (the middle
// bowed one way, the tip flicked the other), and the breeze pushing the tip about
float sideAt(float t) {
  return (iFlow.x + stir.x) * t * t * (0.35 + 0.65 * t) + iFlow.y * 4.0 * t * t * (1.0 - t);
}
// the moving shaft's point at t: swept sideways, and supple: a soft wave along it, out
// of the coat and back, its tip lifted by the breeze (shared by the vane and the quill)
vec3 flowShaftAt(float t, out vec3 nrm) {
  vec3 c = shaftAt(t, nrm);
  c.x += sideAt(t);
  float soft = (0.025 + 0.35 * abs(iFlow.y)) * sin(3.1416 * 1.4 * t + phase) * t + stir.y * t * t;
  c += nrm * soft;
  return c;
}

// what both the vane and the quill pass on: the instance's own values, and how deep in
// the coat W lies (the body's skin is dark, the coat's surface open)
void passOn(vec3 W) {
  vW = W;
  vShape = iShape; vLook = iLook; vPat = iPat; vForm = iForm; vColA = iColA.rgb; vColB = iColB.rgb;
  vColC = iColC.rgb; vColD = iColD.rgb; vMark = iMark; vFlow = iFlow; vSheen = sheenW;
  vec3 rel = W - uBody.xyz;
  float r = length(rel);
  vBodyN = rel / max(r, 1e-4);
  float coat = clamp((r - uBody.w * 0.92) / max(uFluff - uBody.w, 0.1), 0.0, 1.0);
  vAO = mix(1.0, mix(0.3, 1.0, pow(coat, 0.7)), iLook.w * (0.3 + 0.7 * uCoverage));
}`;

const VERT_VANE = VERT_HEAD + /* glsl */ `
float widthF;
vec3 shapeAt(float s, float t) {
  float x = s * geomHW(t) * widthF;
  vec3 nrm;
  vec3 c = flowShaftAt(t, nrm);
  // cupped across, a little twisted along; the vane draped: its edges rippling, up and
  // down, along the length, swaying with the breeze (the down's less)
  float tw = iShape.w * t;
  float ax = abs(x);
  float ripple = sin(t * 11.0 + phase * 3.0 + stir.y * 9.0) * 0.22 * ax * smoothstep(0.1, 0.5, t)
               + sin(t * 7.0 + phase * 5.0 - stir.x * 6.0) * 0.18 * x;
  float drape = ripple * (abs(iLook.y - 1.0) < 0.5 ? 0.3 : 1.0);
  float z = -iShape.z * x * x / max(iShape.y, 0.05);
  // a display feather turns round its shaft (a ribbon twisting); the others are sheared
  if (iLook.y > 1.5) {
    vec2 r = vec2(x * cos(tw) - z * sin(tw), x * sin(tw) + z * cos(tw));
    return c + shaftX * r.x + nrm * (r.y + drape) + iBend.xyz * t * t;
  }
  z += x * tw + drape;
  return c + shaftX * x + nrm * z + iBend.xyz * t * t;
}

void main() {
  // (the display feathers drawn by their own finer meshes, see FeatherMesh)
#ifndef SHOW
  if (iLook.y > 1.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
#endif
  // (an empty slot: nothing to work out)
  if (iBend.w <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  unpackFlow();
  float grow = iBend.w;
  float lenF = smoothstep(0.0, 0.65, grow);
  widthF = mix(0.12, 1.0, smoothstep(0.3, 1.0, grow));
  vWidthF = widthF;
  float s = position.x, t = position.y;
  vec3 p = shapeAt(s, t);
  float e = 0.01;
  vec3 ds = shapeAt(s + e, t) - shapeAt(s - e, t);
  vec3 dt = shapeAt(s, t + e) - shapeAt(s, t - e);
  float L = iShape.x * lenF;
  vec3 W = iPos + qrot(iQuat, p * L);
  passOn(W);
  vU = normalize(qrot(iQuat, ds));
  vV = normalize(qrot(iQuat, dt));
  vN = normalize(cross(vU, vV));
  vF = vec2(s * geomHW(t) * widthF, t);

  gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.0);
  if (grow <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
}`;

// the quill: a tube along the same shaft (swept and swaying with it), round where it is a
// bare calamus, deeper than wide along the rachis with a groove down its underside, closed
// at both ends. It is never drawn thinner than about a pixel: thinner, it fades instead
// (vCover), so far off it neither vanishes nor shimmers.
const VERT_TUBE = VERT_HEAD + /* glsl */ `
uniform float uViewH;
varying vec2 vTh;
varying float vCover;
vec3 tubeAt(float t, out vec3 nrm) { return flowShaftAt(t, nrm) + iBend.xyz * t * t; }
void main() {
  // (the display feathers drawn by their own finer meshes, see FeatherMesh)
#ifndef SHOW
  if (iLook.y > 1.5) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
#endif
  if (iBend.w <= 0.0) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); return; }
  unpackFlow();
  float grow = iBend.w;
  float L = iShape.x * smoothstep(0.0, 0.65, grow);
  // kind 0 contour (display feathers too), 1 down
  float kind = abs(iLook.y - 1.0) < 0.5 ? 1.0 : 0.0;
  float t = position.y, tc = clamp(t, 0.0, 1.0);
  float th = position.x * 6.2832;
  vec3 nrm, nn;
  vec3 c = tubeAt(tc, nrm);
  vec3 X = shaftX + nrm * iShape.w * tc;
  vec3 T = normalize(tubeAt(tc + 0.005, nn) - tubeAt(tc - 0.005, nn));
  c += T * min(t, 0.0);
  // across: the vane's own direction at the shaft, twisted with it
  X = normalize(X - T * dot(X, T));
  vec3 Z = cross(X, T);
  // the base's point closed below it
  float r = shaftR(tc, kind) * clamp((t + 0.006) / 0.006, 0.0, 1.0);
  float c0 = calamusEnd(kind);
  float rach = smoothstep(c0 * 0.8, c0 * 1.6, t);
  float rx = r * mix(1.0, 0.9, rach), rz = r * mix(1.0, 1.25, rach * (1.0 - t));
  // on the body, pressed flat under the next layer, and finer: a line down the vane
  // rather than a rod lying on it
  rz *= mix(1.0, 0.45, iLook.w);
  float slim = mix(1.0, 0.6, iLook.w * (1.0 - kind));
  rx *= slim; rz *= slim;
  float ct = cos(th), st = sin(th);
  float groove = rach * 0.45 * exp(-ct * ct / 0.12) * step(st, 0.0);

  vec3 Wc = iPos + qrot(iQuat, c * L);
  vec4 cc = projectionMatrix * viewMatrix * vec4(Wc, 1.0);
  float px = uViewH > 0.0 ? 2.0 * cc.w / (projectionMatrix[1][1] * uViewH) : 0.0;
  // (widened across only, in the vane's plane, so it never stands out of the coat)
  float widen = max(1.0, 0.75 * px / max(rx * L, 1e-7));
  vCover = 1.0 / widen;
  vec3 W = Wc + qrot(iQuat, (ct * rx * widen * X + st * rz * (1.0 - groove) * Z) * L);
  passOn(W);
  vN = normalize(qrot(iQuat, ct / rx * X + st / rz * Z));
  vV = normalize(qrot(iQuat, T));
  vU = normalize(cross(vV, vN));
  vF = vec2(0.0, t);
  vTh = vec2(ct, st);
  vWidthF = 1.0;
  gl_Position = projectionMatrix * viewMatrix * vec4(W, 1.0);
  if (grow <= 0.0) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
}`;

const PROFILE = /* glsl */ `
// where the bare quill (calamus) ends and the vane begins (the superior umbilicus), in t;
// kind 0 contour, 1 down
float calamusEnd(float kind) { return kind > 0.5 ? 0.055 : 0.1; }
// the shaft's radius at t (units of L): the calamus round and full, narrowing at the
// umbilicus into the rachis, which tapers to nothing at the tip; drawn to a point at the
// very base; the down's much finer
float shaftR(float t, float kind) {
  float c = calamusEnd(kind);
  float rach = 0.0068 * pow(max(1.0 - t, 0.0), 0.8) + 0.0012 * (1.0 - smoothstep(0.9, 1.0, t));
  float cal = 0.0098 * (1.0 + 0.08 * smoothstep(0.0, c, t));
  float r = mix(cal, rach, smoothstep(c * 0.7, c * 1.35, t));
  // the base drawn to a point: a long ogive over the calamus' lower part
  float s = clamp(t / (c * 0.75), 0.0, 1.0);
  r *= mix(0.06, 1.0, 1.0 - (1.0 - s) * (1.0 - s));
  return r * (kind > 0.5 ? 0.6 : 1.0);
}
float profile(float t, float tipE) {
  float u = clamp((t - 0.09) / 0.91, 0.0, 1.0);
  float a = 0.58;
  float m = a / (a + tipE);
  return pow(u, a) * pow(1.0 - u, tipE) / (pow(m, a) * pow(1.0 - m, tipE));
}
// a display feather's outline: its half width at t (units of its width), by shape, on
// one side (0 the wider, x > 0); no hashes here, the vertex shader shares it
float showProfile(float t, float sh, float side, float seed) {
  float u = clamp((t - 0.07) / 0.93, 0.0, 1.0);
  float r1 = fract(seed * 0.618), r2 = fract(seed * 0.377);
  // a small vane round the base, before the bare wire
  float base = 0.32 * smoothstep(0.03, 0.08, t) * (1.0 - smoothstep(0.14, 0.26, t));
  if (sh < 0.5) {
    // racket: a bare wire, then a round vane, a little drawn to the tip
    float q = (t - 0.78) / mix(0.19, 0.23, r1);
    q *= q > 0.0 ? 1.15 : 0.9;
    return max(base, sqrt(max(1.0 - q * q, 0.0)) * (1.0 - smoothstep(0.985, 1.0, t)));
  }
  if (sh < 1.5) {
    // curl: a slender blade, even most of its way, drawn out to a fine point at the end
    // of its spiral
    return pow(u, 0.3) * pow(1.0 - u, 0.55) / (pow(0.35, 0.3) * pow(0.65, 0.55)) * (1.0 + 0.15 * sin(u * 9.0 + r2 * 6.28) * u);
  }
  if (sh < 2.5) {
    // wisp: a broad loose cloud of filaments, wider towards the tip
    return pow(u, 0.4) * pow(1.0 - u, 0.35) / (pow(0.55, 0.4) * pow(0.45, 0.35));
  }
  if (sh < 3.5) {
    // sickle: a narrow blade, broadest a third of the way, to a long point
    return profile(t, 1.5);
  }
  if (sh < 4.5) {
    // ribbon: even all along, swelling a little in waves
    return smoothstep(0.04, 0.16, t) * (0.9 + 0.1 * sin(t * 23.0 + r1 * 6.28));
  }
  // coil: a thin streamer of a vane round its corkscrewing wire, ending in a long
  // lancet that the coil swings round
  float wire = 0.4 * smoothstep(0.1, 0.22, t) * (1.0 - 0.3 * u);
  float q = (t - mix(0.84, 0.87, r1)) / 0.13;
  float lance = 0.75 * pow(max(1.0 - q * q, 0.0), 0.6) * (1.0 - smoothstep(0.985, 1.0, t));
  return max(base, max(wire, lance));
}
// the down's outline: a broad oval, blunt at the tip
float softProfile(float t) {
  float u = clamp((t - 0.03) / 0.97, 0.0, 1.0);
  return pow(u, 0.5) * pow(1.0 - u, 0.75) / (pow(0.4, 0.5) * pow(0.6, 0.75));
}`;

const FRAG_HEAD = /* glsl */ `
// a thin film (keratin, n 1.56) of thickness d µm seen at cos(angle) c: the colours
// its two reflections interfere into (one order, a cosine per channel)
vec3 thinFilm(float c, float d) {
  float ct = sqrt(1.0 - (1.0 - c * c) / (1.56 * 1.56));
  float opd = 2.0 * 1.56 * d * ct;
  return 0.5 + 0.5 * cos(6.2832 * opd / vec3(0.65, 0.54, 0.46) + 3.1416);
}

varying vec2 vF;
varying vec3 vW, vN, vU, vV, vBodyN;
varying float vAO;
flat varying vec4 vShape, vLook, vPat, vForm, vMark, vFlow;
flat varying vec3 vColA, vColB, vColC, vColD;
flat varying vec2 vSheen;
flat varying float vWidthF;

PROFILE

// box-filtered train of pulses [1 - th, 1) in each unit period, over a width w around x
float pulseI(float x, float th) { return floor(x) * th + max(fract(x) - (1.0 - th), 0.0); }
float pulse(float x, float th, float w) {
  w = max(w, 1e-4);
  return (pulseI(x + 0.5 * w, th) - pulseI(x - 0.5 * w, th)) / w;
}

// a fragment of feather: its coverage, colour, the fibres' direction (in the feather's
// u, v), how thin (light through it), how glossy, the slope across the fibre under it
// (-1 … 1, a barb's or the shaft's roundness: the normal map), its iridescence
struct Fe { float alpha; vec3 albedo; vec2 dir; float thin; float gloss; float bump; float iri; };
`;

const FRAG_VANE = FRAG_HEAD + /* glsl */ `

// the mark at (d across, t along), on a vane of half width hw at t, rel = d / hw; side 0/1;
// fwB the bars' filter width (taken before any branch: derivatives need all the pixels)
float markAt(float kind, float n, float d, float t, float rel, float hw, float side, float pd, float seed, float fwB) {
  if (kind < 0.5) return 0.0;
  if (kind < 1.5) {
    // spots: in pairs either side of the shaft, rows down from just under the tip
    float u = (0.82 - t) * n + 0.5 * side * step(n, 4.5);
    float row = floor(u + 0.5);
    float cu = (u - row) / n;
    float rad = min(0.27 / n, hw * 0.3) * (0.85 + 0.3 * hash11(row * 3.1 + side + seed));
    float dd = length(vec2(cu, d - hw * 0.52));
    return (1.0 - smoothstep(rad - pd, rad + pd, dd)) * step(-0.5, row) * smoothstep(0.25, 0.32, t);
  }
  if (kind < 2.5) {
    // bars: across both vanes, a little V along the barbs
    float u = (t - d * 0.55) * n + 0.35;
    return pulse(u, 0.3, fwB) * smoothstep(0.25, 0.32, t);
  }
  if (kind < 3.5) {
    // a streak along the shaft, widening to a drop under the tip
    float w = hw * mix(0.18, 0.45, smoothstep(0.4, 0.8, t)) * (1.0 - smoothstep(0.86, 0.95, t));
    return clamp((w - d) / pd + 0.5, 0.0, 1.0) * smoothstep(0.3, 0.45, t);
  }
  if (kind < 4.5) {
    // an eye under the tip: a dark pupil, a ring, a dark rim (see the colour)
    vec2 q = vec2(d / max(hw * 0.78, 1e-3), (t - 0.79) / 0.13);
    return length(q);
  }
  // a dark edge all round the vane's upper part: a scale
  return smoothstep(0.7, 0.86, rel) * smoothstep(0.42, 0.6, t);
}

Fe contour(vec2 p) {
  Fe o;
  float side = step(p.x, 0.0);
  float d = abs(p.x), t = p.y;
  float seed = vLook.x;
  // a display feather's shape (-1 none)
  float sh = vLook.y > 1.5 ? vLook.y - 2.0 : -1.0;
  float wisp = abs(sh - 2.0) < 0.5 ? 1.0 : 0.0;
  float aspect = vShape.y * mix(1.0, 0.84, side * step(sh, -0.5)) * vWidthF;
  float pd = max(length(fwidth(p)), 1e-5);
  // (the derivatives the parts worked out only where they show need, taken here, before
  // any branch)
  float fwHairs = max(fwidth(d * 420.0), 1e-4);
  float fwBars = max(fwidth((t - d * 0.55) * vMark.y), 1e-4);

  // the barb through this point, by where it leaves the shaft (at the rachis' side)
  float c0 = calamusEnd(0.0);
  float rs = shaftR(t, 0.0) * 0.85;
  float db = max(d - rs, 0.0);
  float k = mix(0.82, 1.25, smoothstep(0.05, 0.7, t)) * vForm.w;
  float curve = 3.6;
  float v0 = t - db * k - db * db * curve;
  // (the wisp's filaments fewer, further apart)
  float N = (78.0 + 18.0 * fract(seed * 0.618)) * mix(1.0, 0.42, wisp);
  float bc = v0 * N + side * 0.5 + seed;
  float fw = max(fwidth(bc), 1e-4);
  float id = floor(bc), f = fract(bc);
  float detail = 1.0 - smoothstep(0.3, 1.1, fw);
  float h1 = hash11(id * 1.37 + side * 91.0 + seed * 7.1);
  float h2 = hash11(id * 2.11 + side * 13.0 + seed * 3.3 + 5.0);
  float h3 = hash11(id * 0.71 + side * 37.0 + seed * 1.9 + 11.0);

  // none below the umbilicus, the first ones short
  float onShaft = smoothstep(c0 - 0.002, c0 + 0.006, v0);
  // the downy barbs: those leaving the shaft low, and the lowest of the vane's sides
  float down = 1.0 - smoothstep(-0.025, 0.025, mix(v0, t, 0.5) - vLook.z + (h1 - 0.5) * 0.07 * detail);

  // locks: the vane's outer part parted into strands of a few barbs each, wavering as
  // they go out, each drawn to its own point, some reaching further than others
  float lockA = vFlow.z;
  float lw = mix(6.0, 12.0, fract(seed * 0.377));
  // (roughly how far out across the vane: the locks curl towards the tip as they go out)
  float relA = d / max(aspect * (sh < -0.5 ? profile(t, vPat.w) : showProfile(t, sh, side, seed)), 1e-3);
  // (the noise only where it counts: on a vane parted into locks)
  float lc = bc / lw + (lockA > 0.0 ? (vnoise(vec3(d * 22.0, t * 3.0, seed + side * 5.0)) - 0.5) * 0.8 * lockA * smoothstep(0.0, 0.05, d) : 0.0)
           - lockA * 0.9 * relA * relA * (0.6 + 0.4 * fract(seed * 0.71));
  float lid = floor(lc), lf = fract(lc);
  float lh = hash11(lid * 7.31 + side * 17.0 + seed * 2.3);
  float lh2 = hash11(lid * 3.17 + side * 41.0 + seed * 1.1 + 3.0);

  // the closed vane, its edge barb by barb
  float prof = sh < -0.5 ? profile(t, vPat.w) : showProfile(t, sh, side, seed);
  float loose = max(vForm.x, wisp);
  float hwV = aspect * prof * (1.0 + (h2 - 0.5) * (0.11 + 0.3 * loose) * detail) * (1.0 + lockA * (lh - 0.35) * 0.55);
  float vane = clamp((hwV - d) / pd + 0.5, 0.0, 1.0);
  float rel = d / max(hwV, 1e-4);
  // apart from the next lock out towards the edge, deeper for some, each lock narrowing
  // to its point
  float lOpen = smoothstep(1.0 - mix(0.35, 0.95, lh2) * min(1.0, lockA * 1.6), 1.0, rel) * min(1.0, lockA * 2.0);
  float lHalf = 0.5 * (1.0 - 0.95 * pow(lOpen, 0.8));
  float lfw = max(fw / lw, 1e-4);
  float lDist = abs(lf - 0.5);
  float inLock = 1.0 - smoothstep(lHalf - lfw, lHalf + lfw, lDist);
  vane *= mix(1.0 - 0.5 * lOpen, inLock, detail);
  // the barbs' ends fine and see-through: a soft edge rather than a cut one
  vane *= 1.0 - 0.45 * smoothstep(0.78, 1.0, rel);
  // across a lock: rounded, its barbs a little shadowed where it parts from the next
  float lAcross = clamp((lf - 0.5) / max(lHalf, 1e-3), -1.0, 1.0);
  // frayed at the edge: the barbs' ends apart, the looser the wider and the more they
  // waver, thinner, softer
  float fray = smoothstep(1.0 - 0.08 - 0.42 * loose, 1.0, rel) * detail;
  float bcF = bc + fray * loose * (sin(d * (90.0 + 60.0 * h2) + h1 * 6.28) * 0.22 + (h2 - 0.5) * 0.3);
  vane *= mix(1.0, pulse(bcF, mix(0.55, 0.32, loose), fw), fray) * (1.0 - fray * loose * 0.3);
  // splits: a barb come apart from the next, a V opening towards the edge
  float split = step(h3, vForm.y);
  float depth = mix(0.2, 0.8, hash11(id * 3.3 + seed + side * 5.0));
  float open = smoothstep(1.0 - depth, 1.0, rel);
  float gw = 0.85 * open;
  float gap = split * step(0.001, gw) * smoothstep(1.0 - gw - fw, 1.0 - gw + fw, f) * detail;
  vane *= 1.0 - gap;
  // the ribbon's end, forked
  if (abs(sh - 4.0) < 0.5) vane *= clamp((rel - (t - 0.86) / 0.14 * 1.15) / max(pd / max(hwV, 1e-4), 1e-3) + 0.5, 0.0, 1.0);

  // the downy barbs: long, free, each wandering its own way, hazy with barbules
  // (the wisp all of such barbs, as long as its outline)
  // (worked out only where they show: low on the vane, or all over a wisp)
  float downW = max(down, wisp * smoothstep(0.1, 0.2, t));
  float downA = 0.0;
  if (downW > 0.0) {
  float lenD = mix(aspect * (0.45 + 0.35 * mix(0.5, h2, detail)), aspect * prof * (0.8 + 0.25 * mix(0.5, h2, detail)), wisp);
  float inD = clamp((lenD - d) / pd + 0.5, 0.0, 1.0);
  if (detail > 0.0) {
    for (int j = -1; j <= 1; j++) {
      float bj = id + float(j);
      float hj = hash11(bj * 1.37 + side * 91.0 + seed * 7.1);
      float hk = hash11(bj * 5.17 + side * 3.0 + seed);
      float wander = (sin(d * (18.0 + 22.0 * hj) + hj * 6.28) * 0.3 + sin(d * (70.0 + 40.0 * hk) + hk * 6.28) * 0.08) * smoothstep(0.0, 0.04, d);
      float dist = abs(bc - (bj + 0.5 + wander));
      float cw = mix(0.05, 0.13, wisp);
      float core = (1.0 - smoothstep(cw, cw + fw, dist)) * mix(0.85, 1.0, wisp);
      float hairs = pulse(d * 420.0 + hj * 13.0, 0.35, fwHairs);
      float halo = (1.0 - smoothstep(0.0, 0.4, dist)) * hairs * 0.35;
      float len = mix(aspect * (0.45 + 0.35 * hk), aspect * prof * (0.75 + 0.3 * hk), wisp);
      downA = max(downA, max(core, halo) * step(d, len));
    }
  }
  downA = mix(mix(0.3, 0.8, wisp), downA, detail) * inD * (1.0 - smoothstep(0.7, 1.0, d / lenD) * 0.5);
  }

  float barbs = onShaft * mix(vane, downA, downW);

  // the afterfeather: a small wisp of down from the umbilicus itself, fanning up and out
  // under the downy barbs, each strand curling up as it goes
  float aft = 0.0;
  vec2 q = vec2(d, t - c0 + 0.004);
  float r = length(q);
  if (vLook.z > 0.02 && r < aspect * 0.86) {
    float ang = atan(d, q.y) + r * 3.5;
    float u = ang / 0.13 + seed * 3.0;
    float sid = floor(u);
    float ha = hash11(sid * 1.91 + side * 17.0 + seed);
    float hb = hash11(sid * 3.07 + side * 5.0 + seed * 1.3);
    // each its own way: curling more or less, wavering
    u += r * (hb - 0.5) * 40.0;
    sid = floor(u);
    ha = hash11(sid * 1.91 + side * 17.0 + seed);
    float wav = (sin(r * (60.0 + 50.0 * ha) + ha * 6.28) * 0.2 + sin(r * 210.0 + hb * 6.28) * 0.06) * smoothstep(0.0, 0.03, r);
    float dist = abs(fract(u) - 0.5 - wav) * 0.13 * r;
    float len = aspect * (0.2 + 0.65 * ha * ha) * smoothstep(0.0, 0.12, vLook.z);
    float strand = 1.0 - smoothstep(0.0012, 0.0012 + pd, dist);
    float hz = (1.0 - smoothstep(0.0, 0.008 + pd, dist)) * 0.3 * detail;
    aft = max(strand * 0.7, hz) * (1.0 - smoothstep(len * 0.6, len, r)) * smoothstep(0.25, 0.5, ang) * (1.0 - smoothstep(1.3, 1.6, ang));
    aft = mix(0.15 * (1.0 - smoothstep(0.0, aspect * 0.5, r)) * step(0.25, ang), aft, detail);
  }

  // (nothing to colour where nothing is drawn: the colour pass drops it, the shadow's
  // only wants its coverage)
  o.alpha = max(barbs, aft);
  if (o.alpha < 0.02) return o;

  // colour: the vane's, shading towards the tip's, the mark, the fringe, the band
  float er = (hwV - d) / max(aspect, 1e-3);
  float fr = (1.0 - smoothstep(vPat.x * 0.3, vPat.x * 0.85, er)) * smoothstep(0.38, 0.7, t) * (1.0 - down);
  float hue = hash11(id * 0.13 + seed) - 0.5; // the barbs vary a little in tone
  vec3 col = mix(vColA, vColC, vMark.w * smoothstep(0.35, 0.92, t + hue * 0.06));
  float mk = markAt(vMark.x, vMark.y, d, t, rel, aspect * prof, side, pd * 1.5, seed, fwBars);
  if (vMark.x > 3.5 && vMark.x < 4.5) {
    // the eye, from the inside out: the mark's colour, the fringe's, the tip's, a dark rim
    float e = mk;
    vec3 eye = mix(vColD, vColB, smoothstep(0.42, 0.5, e));
    eye = mix(eye, vColC, smoothstep(0.66, 0.74, e));
    eye = mix(eye, vColD * 0.4, smoothstep(0.86, 0.92, e));
    col = mix(col, eye, (1.0 - smoothstep(0.98, 1.06, e)) * vMark.z);
    mk = 0.0;
  } else col = mix(col, vColD, mk * vMark.z);
  col = mix(col, vColB, fr * 0.65 * (1.0 - mk * vMark.z * 0.7));
  col *= 1.0 - vPat.y * exp(-pow((t - vPat.z) / 0.075, 2.0)) * (1.0 - fr);
  float lum = dot(vColA, vec3(0.3, 0.55, 0.15));
  vec3 downCol = mix(vec3(lum), vColA, 0.5) * 0.6 + 0.02;
  col = mix(downCol, col, smoothstep(vLook.z - 0.04, vLook.z + 0.22, t));
  col = mix(col, downCol * 1.1, max(down, step(barbs, aft)));
  // the barbs darker where they leave the shaft, deep in the vane
  col *= mix(0.78, 1.0, smoothstep(0.0, 0.025, db));
  col *= 1.0 + (h1 - 0.5) * 0.16 * detail;
  col *= 0.88 + 0.12 * pulse(bc, 0.6, fw);
  col *= 1.0 - 0.3 * lOpen * smoothstep(0.35, 1.0, abs(lAcross)) * detail;

  o.dir = normalize(vec2(1.0 - 2.0 * side, k + 2.0 * curve * d));
  o.thin = mix(0.45, 0.55, down);
  o.gloss = (1.0 - 0.85 * down) * vForm.z;
  // each barb round across, its barbules overlapping like tiles towards the tip; on the
  // vane only, fading out with the barbs
  o.bump = ((f * 2.0 - 1.0) * 0.55 + lAcross * lOpen * 0.7) * detail * (1.0 - down);
  o.iri = vSheen.x * (1.0 - down) * smoothstep(0.12, 0.45, t);

  // (the shaft is its own tube: the quill)
  o.albedo = col;
  return o;
}

Fe soft(vec2 p) {
  Fe o;
  float side = step(p.x, 0.0);
  float d = abs(p.x), t = p.y;
  float seed = vLook.x;
  float aspect = vShape.y * vWidthF;
  float ruffle = vForm.x;
  float pd = max(length(fwidth(p)), 1e-5);

  // the barb through this point: many, close, silky; the low ones leave more across,
  // the upper ones sweep up towards the tip
  float k = mix(0.35, 0.95, smoothstep(0.0, 0.5, t)), curve = 1.5;
  float v0 = t - d * k - d * d * curve;
  float N = 85.0 + 15.0 * fract(seed * 0.618);
  float prof = softProfile(t);
  float low = (1.0 - smoothstep(0.04, 0.4, t)) * ruffle;
  // the outline, gently uneven
  float lim0 = aspect * (prof * (0.92 + 0.12 * (vnoise(vec3(v0 * 9.0, side * 7.0, seed)) - 0.5)) + low * 0.25);
  float r = d / max(lim0, 1e-4);
  // the barbs held together into one soft vane, wavering together in locks; they come
  // apart only towards the edge (and at the dishevelled base)
  float apart = smoothstep(0.55, 1.0, r) * (0.6 + 0.4 * ruffle) + low * 0.5;
  float lock = (vnoise(vec3(v0 * 14.0, d * 6.0, seed + side * 3.0)) - 0.5) * 1.6;
  float bc = v0 * N + side * 0.5 + seed + lock + sin(d * 28.0 + seed) * 0.6 * apart;
  float fw = max(fwidth(bc), 1e-4);
  float detail = 1.0 - smoothstep(0.35, 1.2, fw);
  float id = floor(bc);
  float h1 = hash11(id * 1.37 + side * 91.0 + seed * 7.1);
  float h2 = hash11(id * 5.17 + side * 3.0 + seed);
  // each barb's own end, a little short or long, and stray ones out at the edge
  float lim = lim0 * (0.8 + 0.42 * mix(0.5, h2, detail * apart)) + aspect * low * 0.45 * h1 * h2 * detail;
  float on = clamp((lim - d) / pd + 0.5, 0.0, 1.0);
  // (past its outline, nothing more to work out)
  if (on <= 0.0) { o.alpha = 0.0; return o; }
  // the fibres: fine, close; in the body barely visible, apart at the edge
  float fibre = pulse(bc, mix(0.7, 0.32, apart), fw);
  float body = mix(1.0, fibre, mix(0.42, 1.0, apart) * detail);
  // the density: full in the middle, thinning out to wisps at the edge
  float dens = mix(0.5, 0.3, smoothstep(0.25, 1.0, r)) * (0.8 + 0.4 * vnoise(vec3(v0 * 30.0 + lock, d * 3.0, seed + side))) * (1.0 - 0.5 * smoothstep(0.75, 1.0, d / max(lim, 1e-4)));
  float a = on * body * dens;
  // from the umbilicus up (the shaft is its own tube: the quill)
  float c0 = calamusEnd(1.0);
  a *= smoothstep(c0 - 0.035, c0 - 0.005, v0) * (1.0 - smoothstep(0.985, 1.0, t));

  o.albedo = vColA * (0.97 + 0.06 * (h1 - 0.5) * detail * apart);
  o.alpha = a;
  o.dir = normalize(vec2(1.0 - 2.0 * side, k + 2.0 * curve * d));
  o.thin = 1.0;
  o.gloss = 0.45;
  o.bump = 0.0;
  o.iri = 0.0;
  return o;
}

Fe featherAt() {
  if (vLook.y > 0.5 && vLook.y < 1.5) return soft(vF);
  return contour(vF);
}
`;

// the quill: a bare calamus of horn, see-through, the dried pulp caps showing in it as a
// row of faint rings, pointed at the base; the rachis from the umbilicus up, pale at its base
// and taking on the vane's colour towards the tip, glossy, its underside's groove in shade
const FRAG_TUBE = FRAG_HEAD + /* glsl */ `
varying vec2 vTh;
varying float vCover;
Fe featherAt() {
  Fe o;
  // (kind 0 contour, display feathers too, 1 down)
  float t = vF.y, kind = abs(vLook.y - 1.0) < 0.5 ? 1.0 : 0.0;
  float c0 = calamusEnd(kind);
  vec3 V = normalize(cameraPosition - vW);
  float nv = abs(dot(normalize(vN), V));
  float cal = 1.0 - smoothstep(c0 * 0.75, c0 * 1.2, t);
  float groove = (1.0 - cal) * exp(-vTh.x * vTh.x / 0.12) * step(vTh.y, 0.0);
  vec3 ivory = kind > 0.5 ? vec3(0.9, 0.88, 0.85) : vec3(0.5, 0.46, 0.39);
  // on the body, where it only shows between the vanes, rising out of the skin: the
  // vane's own colour, the calamus (in the skin, really) darker still
  float onBody = vLook.w;
  ivory = mix(ivory, vColA * 0.9, onBody * (kind > 0.5 ? 0.3 : 1.0));
  // the rachis: the top a little paler than the sides
  float pig = mix(0.3, 0.8, smoothstep(c0, 0.85, t));
  // (on the body, all but the vane's own colour: it shows as a fine line, not a stalk)
  pig = mix(pig, 0.95, onBody * (1.0 - kind));
  vec3 rach = mix(ivory, vColA * mix(1.08, 1.0, onBody), pig * (kind > 0.5 ? 0.3 : 1.0));
  rach *= mix(0.9, 1.06, smoothstep(-0.2, 0.9, vTh.y));
  rach *= 1.0 - 0.5 * groove;
  // the calamus: horn, faintly tinted, the pulp caps inside it
  float pt = fwidth(t) * 11.0 / c0;
  float caps = pulse(t / c0 * 11.0 + 0.3, 0.12, max(pt, 1e-4)) * smoothstep(0.08, 0.2, t / c0) * (1.0 - smoothstep(0.75, 0.95, t / c0));
  caps *= 1.0 - smoothstep(0.4, 1.0, pt);
  caps *= smoothstep(0.2, 0.8, nv) * (1.0 - onBody);
  vec3 horn = mix(mix(ivory, vec3(0.7, 0.6, 0.42), 0.35 * (1.0 - onBody)), vColA, 0.1) * (1.0 - 0.07 * caps) * (1.0 - 0.35 * onBody);
  // the base's point: darker, the horn thick there
  horn *= mix(0.45, 1.0, smoothstep(-0.004, 0.012, t));
  // see-through in the middle, its walls opaque at the edges, like a glass tube
  float glassA = mix(0.5, 0.95, pow(1.0 - nv, 1.5)) + caps * 0.15;
  // round: its sides turned away a little darker
  rach *= mix(0.6, 1.0, smoothstep(0.0, 0.8, nv));
  o.albedo = mix(rach, horn, cal);
  o.alpha = mix(1.0, min(glassA, 1.0), cal * (kind > 0.5 ? 0.6 : 1.0) * (1.0 - onBody)) * vCover;
  // on the body, its lower part (the calamus, and the rachis through the downy barbs)
  // lies buried in the down and under the feathers before it: the shaft only comes out
  // of the coat where the closed vane begins, darkening and fading into it below, rather
  // than a bare stalk standing in the air
  float buried = onBody * (1.0 - kind) * (1.0 - smoothstep(vLook.z * 0.6, vLook.z + 0.06, t));
  o.albedo *= 1.0 - 0.5 * buried;
  o.alpha *= 1.0 - buried;
  o.dir = vec2(0.0, 1.0);
  o.thin = mix(mix(0.3, 0.12, groove), 0.85, cal) * (1.0 - 0.6 * onBody);
  o.gloss = mix(2.2, 3.0, cal) * (1.0 - 0.6 * onBody);
  o.bump = 0.0;
  o.iri = 0.0;
  return o;
}
`;

const MAIN = /* glsl */ `
void main() {
  Fe fe = featherAt();
  if (fe.alpha < 0.02) discard;
  vec3 V = normalize(cameraPosition - vW);
  vec3 N = gl_FrontFacing ? vN : -vN;
  vec3 T = normalize(vU * fe.dir.x + vV * fe.dir.y);
  // the smaller a feather on screen, the more it is lit as the coat it is part of (the
  // body's normal, matte, no barbs' relief): a few pixels across, its own tilt and its
  // fibres' highlight would only sparkle and blink as it moves
  float tiny = smoothstep(0.04, 0.2, fwidth(vF.y)) * vLook.w;
  N = normalize(mix(N, vBodyN * sign(dot(vBodyN, N) + 1e-3), tiny * 0.85));
  fe.bump *= 1.0 - tiny;
  fe.gloss *= 1.0 - 0.8 * tiny;
  // the normal map: tilted across each barb (and the shaft), the way it is round
  vec3 B = normalize(cross(N, T));
  N = normalize(N + B * fe.bump);
  T = normalize(T - N * dot(T, N));
  vec3 albedo = fe.albedo;
  // the sheen's colours: a thin film, changing with the angle it is seen at
  float nv = abs(dot(N, V));
  // (the film a little thicker towards the tip, and from one feather to the next: the
  // colours run along the vane and differ across the coat)
  float fd = vSheen.y * (0.9 + 0.2 * vF.y + 0.08 * (fract(vLook.x * 0.371) - 0.5));
  vec3 film = thinFilm(nv, fd);
  float iri = fe.iri;
  // structural colour sits on dark pigment: the vane a little darker under it, and the
  // film's colours in it, shifting as the feather turns
  albedo *= 1.0 - 0.3 * min(iri, 1.0);
  albedo = mix(albedo, albedo * film * 1.8 + film * 0.04, 0.35 * min(iri, 1.0));
  vec3 specTint = mix(vec3(1.0), film * 2.0, min(iri, 1.0));
  float ao = vAO;

  vec3 L = uKeyDir;
  float nl = dot(N, L);
  float sh = shadowAt(vW, N, 2.2, 0.004);
  float diff = max((nl + 0.4) / 1.4, 0.0);
  float trans = max(-nl, 0.0) * fe.thin;
  vec3 H = normalize(L + V);
  float s1 = fibre(normalize(T + N * 0.12), H, 70.0);
  float s2 = fibre(normalize(T - N * 0.2), H, 18.0);
  float specOn = smoothstep(-0.1, 0.3, nl);
  vec3 col = uKeyColor * sh * (albedo * diff * 0.95 + mix(albedo, albedo * albedo, 0.35) * trans * 0.8
             + (specTint * s1 * 0.09 + mix(albedo, film, iri * 0.8) * s2 * 0.12) * fe.gloss * specOn
             + film * iri * diff * (0.03 + 0.2 * pow(1.0 - nv, 1.5)));

  // the rim: through the coat's edge and the flying feathers
  vec3 Lr = uRimDir;
  float nlr = dot(N, Lr);
  float edge = mix(1.0, pow(1.0 - clamp(dot(vBodyN, V), 0.0, 1.0), 1.5), vLook.w);
  vec3 Hr = normalize(Lr + V);
  col += uRimColor * edge * (albedo * max((nlr + 0.2) / 1.2, 0.0) * 0.35 + albedo * sqrt(albedo) * max(-nlr, 0.0) * fe.thin * 1.1
         + albedo * fibre(T, Hr, 25.0) * 0.15 * fe.gloss) * mix(0.4, 1.0, ao);

  col += albedo * hemi(N) * 1.25 * ao;
  // and the sky in it, the film's colours at a grazing angle
  col += film * iri * hemi(reflect(-V, N)) * (0.07 + 0.65 * pow(1.0 - nv, 3.0)) * ao;
  col *= mix(0.7, 1.0, ao);
  gl_FragColor = vec4(col, fe.alpha);
}`;

const MAIN_DEPTH = /* glsl */ `
void main() {
  Fe fe = featherAt();
  if (fe.alpha < hash13(vec3(gl_FragCoord.xy, vLook.x))) discard;
  gl_FragColor = vec4(1.0);
}`;

function gridGeometry(xs, ys, closed) {
  const pos = [], idx = [];
  const nx = xs.length;
  for (const y of ys) for (const x of xs) pos.push(x, y, 0);
  for (let j = 0; j < ys.length - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      if (closed) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}
const range = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));

// the vane: a strip, x across (-1…1), y along (t), denser near the base where the shape
// changes fastest
export function featherGeometry(segX = 6, segY = 18, p = 1.15) {
  return gridGeometry(range(segX, (u) => u * 2 - 1), range(segY, (v) => Math.pow(v, p)), false);
}
// the quill: a tube, x round (0…1), y along (t): its rounded end below the base, rings
// close together through the calamus and the umbilicus, sparser up the rachis
export function quillGeometry(segX = 8, segY = 30, p = 1.7) {
  return gridGeometry(range(segX, (u) => u), [-0.006, -0.003, ...range(segY, (v) => Math.pow(v, p))], true);
}

// the pool of feathers: `max` instances, their attributes written by coat.js; the quills
// drawn by a second mesh (a child of the first) on the same attributes. The few display
// feathers (curling, coiling, long) are drawn apart, by finer meshes of their own: at each
// touch their slots are copied into a small pool of their own (the main meshes skip them)
export class FeatherMesh {
  constructor(max) {
    this.max = max;
    this.showMax = Math.min(max, 256);
    const geometry = featherGeometry();
    const quill = quillGeometry();
    const showGeometry = featherGeometry(6, 60, 1.05);
    const showQuill = quillGeometry(8, 72, 1.2);
    this.arrays = {};
    this.showArrays = {};
    for (const [name, size] of Object.entries(ATTRS)) {
      const arr = new Float32Array(max * size);
      const attr = new THREE.InstancedBufferAttribute(arr, size);
      attr.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(name, attr);
      quill.setAttribute(name, attr);
      this.arrays[name] = arr;
      const sArr = new Float32Array(this.showMax * size);
      const sAttr = new THREE.InstancedBufferAttribute(sArr, size);
      sAttr.setUsage(THREE.DynamicDrawUsage);
      showGeometry.setAttribute(name, sAttr);
      showQuill.setAttribute(name, sAttr);
      this.showArrays[name] = sArr;
    }
    geometry.instanceCount = quill.instanceCount = max;
    showGeometry.instanceCount = showQuill.instanceCount = 0;
    this.geometry = geometry;
    this.quillGeometry = quill;
    this.showGeometry = showGeometry;
    this.showQuillGeometry = showQuill;
    const fs = (src) => GLSL_COMMON + src.replace('PROFILE', PROFILE);
    const vane = VERT_VANE.replace('PROFILE', PROFILE);
    const tube = VERT_TUBE.replace('PROFILE', PROFILE);
    const viewH = { value: 800 };
    const size = new THREE.Vector2();
    const setViewH = (renderer) => {
      const rt = renderer.getRenderTarget();
      viewH.value = rt ? rt.height : renderer.getDrawingBufferSize(size).y;
    };
    // a vane mesh and its quills' (show: the display feathers' finer ones)
    const meshes = (vGeo, qGeo, show) => {
      const defines = show ? { SHOW: 1 } : {};
      const m = new THREE.Mesh(vGeo, litMaterial({
        defines, vertexShader: vane, fragmentShader: (FRAG_VANE + MAIN).replace('PROFILE', PROFILE),
        side: THREE.DoubleSide, alphaToCoverage: true,
      }));
      m.frustumCulled = false;
      m.userData.depthMaterial = new THREE.ShaderMaterial({
        defines, uniforms: LIGHTS, vertexShader: vane, fragmentShader: fs(FRAG_VANE + MAIN_DEPTH), side: THREE.DoubleSide,
      });
      const q = new THREE.Mesh(qGeo, litMaterial({
        defines, uniforms: { uViewH: viewH }, vertexShader: tube,
        fragmentShader: (FRAG_TUBE + MAIN).replace('PROFILE', PROFILE), alphaToCoverage: true,
      }));
      q.frustumCulled = false;
      // (in the shadow's pass at their true size)
      q.userData.depthMaterial = new THREE.ShaderMaterial({
        defines, uniforms: { ...LIGHTS, uViewH: { value: 0 } }, vertexShader: tube, fragmentShader: fs(FRAG_TUBE + MAIN_DEPTH),
      });
      q.onBeforeRender = setViewH;
      return [m, q];
    };
    [this.mesh, this.quill] = meshes(geometry, quill, false);
    this.material = this.mesh.material;
    this.mesh.add(this.quill);
    [this.showMesh, this.showQuill] = meshes(showGeometry, showQuill, true);
    this.mesh.add(this.showMesh, this.showQuill);
  }

  // drawn only up to the last slot in use (a fresh coat fills the first third of the pool,
  // the rest is room for the shed ones while their places grow back): the empty ones past
  // it not drawn. (The buffers still sent whole: sending only their used part, as ranges,
  // turned out far slower, the frame half again as long)
  touch(...names) {
    const bend = this.arrays.iBend;
    let c = this.max;
    while (c > 0 && !(bend[c * 4 - 1] > 0)) c--;
    this.geometry.instanceCount = this.quillGeometry.instanceCount = c;
    for (const n of names) this.geometry.attributes[n].needsUpdate = true;
    this.syncShow();
  }

  // the display feathers growing now, copied into their own pool
  syncShow() {
    const look = this.arrays.iLook, bend = this.arrays.iBend;
    let c = 0;
    for (let i = 0; i < this.max && c < this.showMax; i++) {
      if (look[i * 4 + 1] < 1.5 || bend[i * 4 + 3] <= 0) continue;
      for (const [name, size] of Object.entries(ATTRS)) this.showArrays[name].set(this.arrays[name].subarray(i * size, i * size + size), c * size);
      c++;
    }
    for (const name in ATTRS) this.showGeometry.attributes[name].needsUpdate = true;
    this.showGeometry.instanceCount = this.showQuillGeometry.instanceCount = c;
    this.showMesh.visible = this.showQuill.visible = c > 0;
  }

  dispose() {
    this.geometry.dispose();
    this.quillGeometry.dispose();
    this.showGeometry.dispose();
    this.showQuillGeometry.dispose();
  }
}
