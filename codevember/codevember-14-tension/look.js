// How the rope looks: a matte cotton-like fabric (three's physical material, light wrapping round it,
// soft studio light from an environment and a key light with soft shadows), with the yarns
// of each strand and the fibres of each yarn worked out per pixel, and the animation of the
// snapping in the vertex shader; then a lens: depth of field, tone, grain, a soft backdrop.
import * as THREE from 'three';
import { S, PITCH, SURVIVOR } from './rope.js';
import { NM } from './pluck.js';

export const NL = 9; // the levels drawn at once
const NECK = 0.12; // how much thinner the survivor is, alone across the gap

const NOISE = /* glsl */ `
  float t_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float t_noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(t_hash(i), t_hash(i + vec2(1, 0)), f.x), mix(t_hash(i + vec2(0, 1)), t_hash(i + 1.0), f.x), f.y);
  }
`;

const VERT_PARS = /* glsl */ `
  attribute float tw, fr, pull, dend, sig, tuft, rad, ord;
  attribute vec3 anchor, ctr;
  uniform float uStrand, uRecoil, uSpread, uNeck, uYb, uPix, uThin, uOut, uCut, uMode, uUntw;
  uniform vec3 uWhip;
  // a broken piece pulled out along its lay, away from the break (σ its way): a screw
  // motion round the rope's axis, so it slides along its groove round the rope's middle
  uniform vec2 uApart;
  // (and, while the survivor comes in to the middle, drawn further apart from the break, each
  // half its own way: uApart top, bottom)
  float t_out() { return uOut + (sig > 0.0 ? uApart.x : uApart.y); }
  float t_outAngle() { return sig * t_out() * ${(2 * Math.PI / PITCH).toFixed(6)}; }
  vec3 t_rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }
  varying vec2 vRuv;
  varying float vTw, vFr, vRad;
  varying vec3 vRadial, vStrand;
  varying float vTuft, vRadV;
  // Each level is the survivor strand of the level above (whose index is one less), laid
  // in it: per level j, uChainA[j] = (the survivor's lay angle at height 0, its lay's turn per
  // unit of height, how far it has untwisted in to the middle 0..1, the level's mirror ±1:
  // -1 laying it the other way to the one above; main.js lays them all the same way) and
  // uChainB[j] = (where it is straight up to above, below, the length of its bend back into the
  // lay, the stretch of the lay unwound by the rope's halves spinning), all in that level's own units, its own way round (its mirror applied),
  // and uChainC[j] = the survivor's sideways swing across its span (x, z of its first mode, then its
  // second): taut, it hums, and each snap shakes it (main.js), and uChainN[j] how drawn in it is
  // under the load (0..1, see NECK), and uChainW[j] how strained it shows there (its fibres
  // paling, its grains drawn out along it), while the load is new on it
  uniform vec4 uChainA[${NL}], uChainB[${NL}], uChainC[${NL}];
  uniform float uChainN[${NL}], uChainW[${NL}];
  // and uChainS[j] how far the level's top half has turned (its bottom half as far the other way),
  // its halves spinning as a whole beyond the stretch they unwind, the right way round (mirrors
  // applied): what holds its ends, the broken halves of the ropes it is the survivor of, turns with them
  uniform float uChainS[${NL}];
  // once the rope has broken for good (space, main.js): how far its top half has been flung
  // up and its bottom half down (in the view's units), and how far each has gone sideways
  // (uSplitX) and turned over as it goes (uSplitR, radians, round its broken end)
  uniform vec2 uSplit, uSplitX, uSplitR;
  uniform vec4 uPluck[${NM / 2}];
  uniform float uPluckL;
  // how strained the surface is here (0..1): where a strand necks before it snaps, or across the
  // gap a survivor holds
  varying float vStrain;
  float t_load;
  uniform float uLevel;
  float t_straight(vec4 B, float h) { return smoothstep(B.x, B.x - B.z, h) * smoothstep(-B.y, -B.y + B.z, h); }
  // As the survivor comes in, the rope's two broken halves spin opposite ways, top against
  // bottom, unwinding the lay between them (out to B.w each way, easing back into the lay over
  // 0.7): by height h, how much of the lay's height has been unwound from the break, and
  // how unwound it is there (0..1, the former's slope); beyond the stretch the rope is turned
  // whole, the halves spinning on as the stretch grows
  float t_unwound(vec4 B, float h) {
    float b = max(1e-5, min(0.7, B.w)), a = B.w - b, x = abs(h);
    float t = clamp((x - a) / b, 0.0, 1.0);
    return sign(h) * (min(x, a) + b * (t - t * t * t + 0.5 * t * t * t * t));
  }
  float t_unwinding(vec4 B, float h) {
    float b = max(1e-5, min(0.7, B.w));
    return B.w > 0.0 ? 1.0 - smoothstep(B.w - b, B.w, abs(h)) : 0.0;
  }
  // the survivor's lay angle at h, unwound with the rest
  float t_layAngle(vec4 A, vec4 B, float h) { return A.y * (h - t_unwound(B, h)); }
  // The rope is held tight: at each height the strands still there close up, evenly round, in
  // as small a ring as they make touching each other (so with a strand missing there is no gap
  // left in its place), the survivor's place kept where it is. Per level j and strand i,
  // uRing[6j + i] = (broken 0/1, where its piece above ends, where the one below ends): it is
  // there at h unless broken and h within its ends. t_ring: strand i's turn round the rope
  // from its own place, and the ring's radius (relative to the full one's)
  int t_ringLevel;
  uniform vec3 uRing[${NL * 6}];
  float t_pres(vec3 R, float h) {
    if (R.x < 0.5) return 1.0;
    return h >= 0.0 ? smoothstep(R.y - 0.2, R.y + 0.2, h) : smoothstep(R.z - 0.2, R.z + 0.2, -h);
  }
  vec2 t_ring(int j, float h, int me) {
    float C = 0.0, cm = 0.0;
    int km = 0;
    for (int k = 0; k < 6; k++) {
      int i = (${SURVIVOR} + k) % 6;
      float p = t_pres(uRing[6 * j + i], h);
      if (i == me) { cm = C + 0.5 * p; km = k; }
      C += p;
    }
    float n = max(C, 1.0);
    float r = n >= 2.0 ? 0.5 / sin(3.14159265 / n) : 0.5 * (n - 1.0);
    return vec2(6.2831853 * (cm - 0.5) / n - float(km) * 1.04719755, min(r, 1.0));
  }
  vec3 t_lay(vec4 A, vec4 B, vec4 C, float h) {
    float r = ${S.toFixed(6)} * min(1.0 - A.z * t_straight(B, h), t_ring(t_ringLevel, h, ${SURVIVOR}).y), a = A.x + t_layAngle(A, B, h);
    // swinging like a plucked string between the broken ends that hold it
    float u = clamp((h + B.y) / max(B.x + B.y, 1e-3), 0.0, 1.0);
    vec2 sw = C.xy * sin(3.14159265 * u) + C.zw * sin(6.2831853 * u);
    return vec3(r * cos(a) + sw.x, h, r * sin(a) + sw.y);
  }
  // the least rotation taking the y axis to t
  vec3 t_tilt(vec3 t, vec3 v) {
    vec3 w = vec3(t.z, 0.0, -t.x), wv = cross(w, v);
    return v + wv + cross(w, wv) / (1.0 + t.y);
  }
  // a point of this level (and three directions with it) in its own units to where it is in
  // the rope above and that one's above, and so on up, still in this level's units: round
  // each survivor's centre line, tilted along it, turning with its lay where it's laid
  void t_chain(inout vec3 p, inout vec3 d0, inout vec3 d1, inout vec3 d2) {
    int L = int(uLevel + 0.5);
    vec3 m = vec3(uChainA[L].w, 1.0, 1.0);
    p *= m; d0 *= m; d1 *= m; d2 *= m;
    float f = 1.0;
    for (int j = ${NL - 2}; j >= 0; j--) {
      if (j >= L) continue;
      f *= 3.0;
      vec4 A = uChainA[j], B = uChainB[j], C = uChainC[j];
      t_ringLevel = j;
      float h = p.y / f;
      float tn = t_layAngle(A, B, h);
      vec3 t = normalize(t_lay(A, B, C, h + 0.002) - t_lay(A, B, C, h - 0.002));
      // alone across the gap it carries the whole load: stretched, it draws in thinner there
      float st = t_straight(B, h);
      float neck = 1.0 - ${NECK.toFixed(4)} * uChainN[j] * st;
      t_load = max(t_load, uChainW[j] * st);
      p = f * t_lay(A, B, C, h) + t_tilt(t, t_rotY(vec3(p.x * neck, 0.0, p.z * neck), tn));
      d0 = t_tilt(t, t_rotY(d0, tn));
      d1 = t_tilt(t, t_rotY(d1, tn));
      d2 = t_tilt(t, t_rotY(d2, tn));
    }
    p *= m; d0 *= m; d1 *= m; d2 *= m;
  }
`;
const VERT_MOVE = /* glsl */ `
  // the outer yarns of a strand give way one by one before it snaps (uCut: the time since the
  // first could, ord: when this one does): laid (uMode 1) until it breaks, then (2) its two
  // broken pieces springing back and bursting open; once the strand snaps (3) they're open
  float rec = uRecoil, spr = uSpread;
  bool gone = false;
  if (ord >= 0.0) {
    if (uMode > 2.5) spr = 1.0;
    else if (uMode > 1.5) {
      float k = clamp((uCut - ord) / 0.025, 0.0, 1.0), k1 = k - 1.0;
      rec = 1.0 + 2.2 * k1 * k1 * k1 + 1.2 * k1 * k1;
      spr = 0.1 + 0.9 * sqrt(k);
      gone = uCut < ord;
    } else if (uMode > 0.5) gone = uCut >= ord;
  }
  // a tuft gathered at the end until it bursts open
  transformed = mix(transformed, anchor + (transformed - anchor) * spr, tuft);
  // a broken end springing back from the break
  float back = -sig * pull * (1.0 - rec) * exp(-dend / 0.6);
  if (uMode > 1.5 && uMode < 2.5) {
    // a broken yarn slips back along its own lay, round its strand (whose centre line is laid
    // round the rope): moved along the strand by \`back\`, turned round it as its lay turns
    float th = atan(ctr.z, ctr.x);
    vec3 A = normalize(vec3(-sin(th) * ${(2 * Math.PI * S) / PITCH}, 1.0, cos(th) * ${(2 * Math.PI * S) / PITCH}));
    float a = ${(2 * Math.PI) / (PITCH * S)} * back / A.y, c = cos(a), sn = sin(a);
    vec3 q = transformed - ctr;
    transformed = ctr + q * c + cross(A, q) * sn + A * dot(A, q) * (1.0 - c) + A * (back / A.y);
  } else transformed.y += back;
  // and, snapped, whipping sideways as it springs back, the more the nearer its end (the two
  // pieces lashing out opposite ways)
  if (uMode > 2.5) transformed += uWhip * (sig > 0.0 ? 1.0 : -0.8) * min(pull, 1.4) * exp(-dend / 0.45);
  // a strand about to snap thins round its weak point
  float t_neck = uNeck * 0.45 * exp(-pow((position.y - uYb) / 0.07, 2.0));
  transformed = mix(transformed, ctr, t_neck);
  t_load = t_neck / 0.45;
  // its last yarn holding (ord -2) untwists out of the lay into the middle there, between the
  // broken ends of the others
  if (ord < -1.5 && uMode > 0.5 && uMode < 1.5)
    transformed -= (position - normal * rad - ctr) * (1.0 - t_neck) * uUntw * smoothstep(0.13, 0.04, abs(position.y - uYb));
  // and, later, pulled out of the frame
  transformed = t_rotY(transformed, t_outAngle());
  transformed.y += sig * t_out();
  // fibres kept at least about half a pixel wide, so they draw as fine lines rather than specks
  // (those torn out at a break a little wider, to read against the light behind)
  if (uThin > 0.5) {
    float sc = length(modelViewMatrix[0].xyz);
    float depth = -(modelViewMatrix * vec4(transformed, 1.0)).z;
    float minR = mix(0.32, 0.48, step(0.5, tuft)) * uPix * depth / sc;
    transformed += t_rotY(normal, t_outAngle()) * max(0.0, minR - rad);
  }
  if (gone) transformed = vec3(0.0);
  vRuv = uv; vTw = tw; vFr = fr; vRad = rad; vTuft = tuft;
  vRadV = rad * length(modelViewMatrix[0].xyz);
  vec3 t_sDir = t_rotY(position - ctr + normal * 1e-5, t_outAngle());
  vec3 t_rDir = t_rotY(vec3(position.x, 0.0, position.z) + vec3(1e-6, 0.0, 0.0), t_outAngle());
`;
// then the level is laid where it is in the rope above it, as that rope's survivor strand
const VERT_LAY = /* glsl */ `
  {
    // the level's own unwinding (see t_unwound), its own way round (unmirrored)
    vec4 A0 = uChainA[int(uLevel + 0.5)], B0 = uChainB[int(uLevel + 0.5)];
    float h0 = transformed.y;
    // a strand laid slanting is round across itself, so longer across a level slice: as it
    // straightens it's drawn in to stay round
    vec3 c0 = t_rotY(ctr, t_outAngle());
    vec3 e0 = normalize(vec3(-c0.z, 0.0, c0.x) + vec3(1e-6, 0.0, 0.0));
    transformed -= e0 * dot(transformed - c0, e0) * ${(1 - 1 / Math.hypot(1, (2 * Math.PI * S) / PITCH)).toFixed(6)} * t_unwinding(B0, h0);
    // closed up with the strands still there at this height (see t_ring), as a whole about the
    // strand's centre
    {
      // (taken at the height of the strand's own centre there, not the point's: each of its
      // cross-sections moved as a whole, so that it bends where the ring narrows, rather than its
      // level slices sliding past each other and shearing it, yarns smeared across)
      float hc = t_rotY(ctr, t_outAngle()).y + (h0 - position.y);
      vec2 rg = t_ring(int(uLevel + 0.5), hc, int(uStrand + 0.5));
      vec3 cr = t_rotY(c0, rg.x);
      transformed = t_rotY(transformed, rg.x);
      transformed.xz += (rg.y - 1.0) * cr.xz;
      t_nDir = t_rotY(t_nDir, rg.x); t_sDir = t_rotY(t_sDir, rg.x); t_rDir = t_rotY(t_rDir, rg.x);
    }
    float spin = -A0.y * A0.w * t_unwound(B0, h0);
    // the halves of the ropes inside, spinning, carry this one's halves round with them (each
    // half the way of the half it holds, easing across the break)
    float held = 0.0;
    for (int j = 1; j < ${NL}; j++) if (j > int(uLevel + 0.5)) held += uChainS[j];
    spin += A0.w * held * (2.0 * smoothstep(-0.12, 0.12, h0) - 1.0);
    transformed = t_rotY(transformed, spin);
    t_nDir = t_rotY(t_nDir, spin); t_sDir = t_rotY(t_sDir, spin); t_rDir = t_rotY(t_rDir, spin);
  }
  t_chain(transformed, t_nDir, t_sDir, t_rDir);
  // (each piece with the half it is of; a whole strand's, by where it is)
  {
    float t_side = sig != 0.0 ? sig : position.y;
    bool t_top = t_side >= 0.0;
    float t_sc = length(modelViewMatrix[0].xyz), t_a = t_top ? uSplitR.x : uSplitR.y;
    float t_c = cos(t_a), t_s = sin(t_a);
    transformed.xy = vec2(t_c * transformed.x - t_s * transformed.y, t_s * transformed.x + t_c * transformed.y);
    transformed.xy += (t_top ? vec2(uSplitX.x, uSplit.x) : vec2(uSplitX.y, -uSplit.y)) / t_sc;
  }
  // and the whole rope, top to bottom, plucked by the cursor like a string held beyond the
  // frame (see pluck.js): its modes' sideways (x, z), two to each of uPluck (.xy the odd ones),
  // over its length, in the view's units
  {
    float wy = modelMatrix[1][1] * transformed.y;
    float u = clamp((wy + uPluckL) / (2.0 * uPluckL), 0.0, 1.0);
    float th = 3.14159265 * u, c2 = 2.0 * cos(th), s0 = 0.0, s1 = sin(th);
    vec2 sw = vec2(0.0);
    for (int k = 0; k < ${NM / 2}; k++) {
      vec4 P = uPluck[k];
      sw += P.xy * s1;
      float s2 = c2 * s1 - s0;
      sw += P.zw * s2;
      s0 = s2; s1 = c2 * s2 - s1;
    }
    transformed.x += sw.x / modelMatrix[0][0];
    transformed.z += sw.y / modelMatrix[2][2];
  }
  vStrand = normalize(normalMatrix * t_sDir);
  vRadial = normalize(normalMatrix * t_rDir);
  vStrain = t_load;
`;

const FRAG_PARS = /* glsl */ `
  uniform float uDetail, uSS;
  varying float vTuft, vRadV;
  varying vec2 vRuv;
  varying float vTw, vFr, vRad;
  varying vec3 vRadial, vStrand;
  varying float vStrain;
  ${NOISE}
  // the surface gradient of a smooth coordinate c, from screen derivatives
  vec3 t_grad(float c, vec3 n, vec3 pos) {
    vec3 dpx = dFdx(pos), dpy = dFdy(pos);
    vec3 r1 = cross(dpy, n), r2 = cross(n, dpx);
    float det = dot(dpx, r1);
    return (r1 * dFdx(c) + r2 * dFdy(c)) / (abs(det) > 1e-24 ? det : 1e-24);
  }
`;

// the yarns: six laid round each strand the same way as the strands round the rope, each a twisted bundle (diagonal
// grains along it), fibres streaking them; bent onto the normal, shading the grooves,
// fading out as they get smaller than a pixel
const FRAG_DETAIL = /* glsl */ `
  float t_ao = 1.0;
  if (uDetail < 0.5) {
    // a fibre: darker toward its root, deep in the brush; each its own shade. Those torn
    // out at a break (the tufts) more so, darker deep in and more unlike each other, with
    // some much darker, so that they stand out from the light behind and from each other
    float t_br = step(0.5, vTuft);
    t_ao = mix(mix(0.62, 0.3, t_br), mix(1.0, 0.9, t_br), smoothstep(0.0, 0.9, vFr));
    // thinner than a pixel, it only adds a haze of its colour, not dark specks (a deeper one
    // for the tufts, which would be lost against the light otherwise)
    float sub = smoothstep(0.4, 1.5, length(uSS * fwidth(vViewPosition)) / max(vRadV, 1e-7));
    t_ao = mix(t_ao, mix(0.9, 0.62, t_br), sub);
    float t_sh = t_hash(vec2(vTw * 91.7, 3.1));
    diffuseColor.rgb *= mix(0.82 + 0.3 * t_sh, 0.55 + 0.55 * t_sh * t_sh, t_br);
  }
  if (uDetail > 0.5) {
    vec3 pos = -vViewPosition;
    vec3 n0 = normal;
    float yarnW = 6.2832 * vRad / 6.0;
    float c1 = (vRuv.y - vTw) * 6.0;
    float q = vRuv.x / max(yarnW, 1e-6);
    float w1 = 1.0 - smoothstep(0.18, 0.6, uSS * fwidth(c1));
    float f = fract(c1) * 2.0 - 1.0;
    float yid0 = t_hash(vec2(floor(c1), 7.3));
    // each yarn a soft, rounded bundle (no sharp shoulders to catch the light)
    float hy = 1.0 - f * f;
    float dhy = -4.0 * f;                               // d(hy)/d(c1)
    // each yarn a row of slanted grains (the twist of its fibres): soft lumps, uneven in
    // size and spacing and broken up along their length, not machined ridges
    float wob = 0.22 * (t_noise(vec2(q * 0.55, c1 * 1.7)) - 0.5) + yid0;
    // stretched, the grains are drawn out along the yarn, further apart, and flatten
    float t_a = 1.0 - 0.4 * vStrain, t_ga = 0.62 * t_a, t_gb = 0.38 / t_a;
    float kq = q * t_ga + f * t_gb + wob;
    float gi = floor(kq);
    float fk = fract(kq) * 2.0 - 1.0;
    float hk = 1.0 - fk * fk;
    float dhk = -4.0 * fk;                              // d(hk)/d(kq)
    float wk = 1.0 - smoothstep(0.2, 0.6, uSS * fwidth(kq));
    // along a grain: it swells and thins, short lumps of fibres staggered like a plait's
    float sg = q * 0.38 - f * 0.62;
    float sq = sg * 1.3 + t_hash(vec2(gi, 2.7)) * 3.0 + 0.5 * t_noise(vec2(gi * 3.1, sg * 0.8));
    float ls = fract(sq) * 2.0 - 1.0;
    float lump = 1.0 - ls * ls;
    float dlump = -4.0 * ls * 1.3;                     // d(lump)/d(sg), roughly
    float gs = 0.8 + 0.4 * t_hash(vec2(gi, floor(sq)));
    float gh = mix(0.35, 1.0, lump) * gs;
    float dgh = 0.65 * dlump * gs;
    float t_fl = 1.0 - 0.55 * vStrain;
    float K = mix(0.75, 0.75 + t_fl * (0.55 * hk * gh - 0.3), wk);
    float dK = t_fl * 0.55 * gh * dhk * wk;            // d(K)/d(kq)
    float dKs = t_fl * 0.55 * hk * dgh * wk;           // d(K)/d(sg)
    float dHdc = dhy * K + hy * (dK * t_gb + dKs * -0.62) * 2.0;
    float dHdq = hy * (dK * t_ga + dKs * 0.38);
    // the fibres of each grain: fine combed streaks along it, bumpy, fading under a pixel
    float fx = kq * 9.0;
    float wf = (1.0 - smoothstep(0.25, 0.8, uSS * fwidth(fx))) * w1;
    vec2 fp = vec2(fx, sg * 1.4);
    float fib = t_noise(fp) * 0.6 + t_noise(fp * vec2(2.3, 1.9) + 4.1) * 0.4;
    float dfib = (t_noise(fp + vec2(0.15, 0.0)) - t_noise(fp - vec2(0.15, 0.0))) / 0.3 * 9.0; // d/d(kq)
    float bF = 0.05 * wf;
    dHdc += bF * dfib * t_gb * 2.0;
    dHdq += bF * dfib * t_ga;
    // finer still: the single filaments, long and thin, two sizes of them, each a ridge in the
    // surface (a filament's bump) and a thin light or dark line; under a pixel they leave only a
    // soft grain
    float filA = 0.0, filB = 0.0, dfil = 0.0;
    float wA = (1.0 - smoothstep(0.3, 0.9, uSS * fwidth(kq * 32.0))) * w1;
    float wB = (1.0 - smoothstep(0.3, 0.9, uSS * fwidth(kq * 80.0))) * w1;
    if (wA > 0.0) {
      vec2 pa = vec2(kq * 32.0 + 2.0 * fib, sg * 3.0);
      filA = t_noise(pa);
      dfil += wA * 0.02 * (t_noise(pa + vec2(0.2, 0.0)) - t_noise(pa - vec2(0.2, 0.0))) / 0.4 * 32.0;
    }
    if (wB > 0.0) {
      vec2 pb = vec2(kq * 80.0 + 5.0 * fib, sg * 5.0 + 17.0);
      filB = t_noise(pb);
      dfil += wB * 0.008 * (t_noise(pb + vec2(0.2, 0.0)) - t_noise(pb - vec2(0.2, 0.0))) / 0.4 * 80.0;
    }
    dHdc += dfil * t_gb * 2.0;
    dHdq += dfil * t_ga;
    vec3 g = dHdc * t_grad(c1, n0, pos) + dHdq * t_grad(q, n0, pos);
    normal = normalize(n0 - g * yarnW * 0.28 * w1);
    // a fuzz of loose fibres stands off the surface: seen edge-on it hides the relief under it
    // and catches the light, a soft pale halo round every yarn and strand (as on felt or cotton)
    float t_rim = 1.0 - abs(dot(n0, normalize(vViewPosition)));
    float t_fz = smoothstep(0.35, 1.0, t_rim);
    normal = normalize(mix(normal, n0, t_fz * 0.5));

    // the colour: each yarn and grain a little its own shade, fibres streaking them, a few
    // darker stray fibres and a fine fuzz of lighter ones
    float yid = t_hash(vec2(floor(c1), gi));
    vec3 tint = vec3(1.0) * mix(1.0, 0.9 + 0.2 * yid, wk);
    tint *= mix(1.0, 0.88 + 0.24 * fib, wf);
    tint *= mix(1.0, 0.84 + 0.32 * filA, wA) * mix(1.0, 0.88 + 0.24 * filB, wB);
    tint *= mix(1.0, 0.9 + 0.12 * lump + 0.08 * t_noise(vec2(gi * 1.7, sq)), wk);
    float fleck = t_hash(floor(fp * vec2(1.0, 0.5)));
    // (and the odd dark fleck, bits of husk left in the unbleached fibre)
    float husk = t_hash(floor(fp * vec2(0.5, 0.25)) + 31.0);
    tint *= mix(1.0, mix(1.0, 0.45, smoothstep(0.992, 0.998, husk)), wf);
    tint *= mix(1.0, mix(1.0, 0.88, smoothstep(0.94, 1.0, fleck)) * mix(1.0, 1.08, smoothstep(0.0, 0.07, 0.07 - fleck)), wf);
    tint *= mix(vec3(1.0), vec3(1.03, 1.0, 0.95), t_noise(pos.xy * 3.0 / max(yarnW * 20.0, 1e-6)));
    diffuseColor.rgb *= mix(vec3(1.0), tint, w1 * 0.9 + 0.1);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.84, 0.8, 0.76), t_fz * t_fz * 0.38);

    // grooves between yarns, and between the laid strands (they press on each other)
    float aoY = mix(0.92, (0.7 + 0.3 * smoothstep(0.0, 0.8, hy)) * mix(0.95, 0.86 + 0.14 * smoothstep(0.0, 0.8, hk * gh), wk), w1);
    float d = dot(n0, vRadial);
    float aoL = mix(0.65, 1.0, smoothstep(-0.6, 0.6, d));
    // and between the yarns of a strand, pressed round its middle
    float aoS = mix(0.68, 1.0, smoothstep(-0.6, 0.6, dot(n0, normalize(vStrand))));
    t_ao = mix(aoY, 1.0, t_fz * 0.5) * mix(aoL * aoS, 1.0, vFr * 0.8);
    // a free yarn's end, deep in the brush of its own fibres
    t_ao *= mix(1.0, 0.5, smoothstep(0.45, 1.0, vTuft));
  }
  // stress whitening: strained fibres pale, as stretched cotton and nylon do, and their
  // shadows among them lighten
  float t_w = smoothstep(0.0, 1.0, vStrain);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.575, 0.49), 0.45 * t_w);
  t_ao = mix(t_ao, 1.0, 0.3 * t_w);
`;
const FRAG_AO = /* glsl */ `
  reflectedLight.indirectDiffuse *= t_ao;
  reflectedLight.indirectSpecular *= t_ao;
  reflectedLight.directDiffuse *= mix(1.0, t_ao, 0.45);
  reflectedLight.directSpecular *= t_ao;
  #ifdef USE_SHEEN
    sheenSpecularDirect *= t_ao;
    sheenSpecularIndirect *= t_ao;
  #endif
`;

// uniforms of one mesh's snapping, shared by its material and its shadow's
// the size of a pixel at distance 1 (set on resize)
export const pixel = { value: 0.001 };
// a shown pixel, in drawn pixels: 1, but more when drawn finer than shown, scaled down after
// (&ss, for the GIF), the detail then fading out at the shown pixel, not at a drawn one, so
// that what is finer than it is not drawn only to beat against it as moiré
export const footprint = { value: 1 };
const snapUniforms = () => ({
  uPix: pixel,
  uRecoil: { value: 1 },
  uSpread: { value: 1 },
  uNeck: { value: 0 },
  uYb: { value: 0 },
  uOut: { value: 0 },
  uApart: { value: new THREE.Vector2() },
  uCut: { value: 0 },
  uMode: { value: 0 },
  uUntw: { value: 0 },
  uStrand: { value: 0 },
  uWhip: { value: new THREE.Vector3() },
});

// cotton and hemp are matte: light gets in among the fibres and scatters back out, so it
// wraps round past the terminator and comes back softly, with no gloss on the yarns — only
// the faintest dusty sheen at grazing angles
const MATTE_LIGHT = THREE.ShaderChunk.lights_physical_pars_fragment.replace(
  'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  'float t_nl = dot( geometryNormal, directLight.direction );\n\tfloat t_wrap = saturate( ( t_nl + 0.45 ) / 1.45 );\n\tvec3 t_bleed = mix( vec3( 1.0, 0.84, 0.74 ), vec3( 1.0 ), smoothstep( -0.45, 0.35, t_nl ) );\n\treflectedLight.directDiffuse += t_wrap * t_wrap * 1.15 * t_bleed * directLight.color * BRDF_Lambert( material.diffuseColor );'
);
if (MATTE_LIGHT === THREE.ShaderChunk.lights_physical_pars_fragment) console.warn('tension: wrapped light not patched in');

// the levels' lay, shared by all (see t_chain); main.js sets it each frame
export const chain = {
  uChainA: { value: Array.from({ length: NL }, () => new THREE.Vector4(0, 0, 0, 1)) },
  uChainB: { value: Array.from({ length: NL }, () => new THREE.Vector4(9, 9, 0.3, 0)) },
  uChainC: { value: Array.from({ length: NL }, () => new THREE.Vector4()) },
  uChainN: { value: new Array(NL).fill(0) },
  uChainW: { value: new Array(NL).fill(0) },
  uChainS: { value: new Array(NL).fill(0) },
  uRing: { value: Array.from({ length: NL * 6 }, () => new THREE.Vector3()) },
  uSplit: { value: new THREE.Vector2() },
  uSplitX: { value: new THREE.Vector2() },
  uSplitR: { value: new THREE.Vector2() },
  uPluck: { value: Array.from({ length: NM / 2 }, () => new THREE.Vector4()) },
  uPluckL: { value: 3 },
};

// `level`: its index in the chain (0 the outermost)
export function ropeMaterial(kind, level) {
  const u = snapUniforms();
  Object.assign(u, chain, { uLevel: { value: level } });
  const fibre = kind === 'fibre';
  u.uThin = { value: fibre ? 1 : 0 };
  const m = new THREE.MeshPhysicalMaterial({
    color: fibre ? '#9c9187' : '#85796f',
    roughness: 1,
    specularIntensity: 0,
    sheen: fibre ? 0.5 : 0.22,
    sheenRoughness: 1,
    sheenColor: new THREE.Color('#e6ded4'),
    envMapIntensity: 1,
    side: fibre ? THREE.DoubleSide : THREE.FrontSide,
  });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u, { uDetail: { value: fibre ? 0 : 1 }, uSS: footprint });
    // (moved before the normal is used, so that it is laid along with it)
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + VERT_PARS).replace('#include <begin_vertex>', '')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vec3 transformed = vec3(position);\n' + VERT_MOVE +
        '\n  vec3 t_nDir = t_rotY(objectNormal, t_outAngle());\n' + VERT_LAY + '\n  objectNormal = t_nDir;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_PARS)
      .replace('#include <lights_physical_pars_fragment>', MATTE_LIGHT)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_DETAIL)
      .replace('#include <aomap_fragment>', FRAG_AO);
  };
  m.customProgramCacheKey = () => kind;
  // its shadow moves with it
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: m.side });
  depth.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + VERT_MOVE + '\n  vec3 t_nDir = normal;\n' + VERT_LAY);
  };
  m.userData.snap = u;
  m.userData.depth = depth;
  return m;
}

// the studio: soft light from all round (a room), a large warm key from the upper left with
// soft shadows over the part of the world in view (the world is scaled, not the camera, so
// that part never moves), a cool fill from the right
export function setupLights(renderer, scene) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  import('three/addons/environments/RoomEnvironment.js').then(({ RoomEnvironment }) => {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.75;
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const key = new THREE.DirectionalLight('#fff1e0', 2.3);
  key.position.set(-9, 5, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4.5, right: 4.5, top: 3.2, bottom: -3.2, near: 1, far: 40 });
  key.shadow.radius = 12;
  key.shadow.intensity = 0.5; // the room's light reaches into the shadows
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.004;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#d9dde6', 0.22);
  fill.position.set(8, -2, 4);
  // and the window's brightness above the frame, grazing the tops of the strands
  const top = new THREE.DirectionalLight('#fff8ee', 0.6);
  top.position.set(-1, 10, 2);
  scene.add(top);
  scene.add(fill);
}

// ---------- the lens ----------
const LENS_FRAG = /* glsl */ `
  uniform sampler2D tColor, tDepth;
  uniform vec2 uRes;
  uniform float uNear, uFar, uFocus, uAperture, uMaxR, uTime, uExposure, uSS;
  varying vec2 vUv;
  ${NOISE}
  float linZ(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
  vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
  // the backdrop: a creamy plaster or linen wall far out of focus, in soft blotches, a little
  // greyer up top, brightest round the middle and below
  vec3 backdrop(vec2 uv) {
    vec2 p = (uv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
    vec3 cream = vec3(0.905, 0.9, 0.885), grey = vec3(0.8, 0.8, 0.795);
    vec3 c = mix(cream, grey, smoothstep(0.45, 1.0, uv.y) * 0.75 + smoothstep(0.3, 0.9, abs(p.x)) * 0.35);
    // blotches: large soft patches, and finer mottling inside them (the wall's own texture,
    // blurred)
    vec2 q = p * vec2(1.0, 1.6);
    float m = t_noise(q * 2.2 + 3.0) * 0.55 + t_noise(q * 5.0 + 11.0) * 0.3 + t_noise(q * 11.0) * 0.15;
    c *= 0.93 + 0.12 * m;
    // a touch of the warmer light pooled behind the rope
    c += vec3(0.02, 0.015, 0.005) * exp(-p.x * p.x * 6.0) * smoothstep(0.9, 0.3, uv.y);
    return c;
  }
  vec3 shade(vec2 uv, out float z) {
    float d = texture2D(tDepth, uv).x;
    if (d >= 1.0) { z = 1e4; return backdrop(uv); }
    z = linZ(d);
    vec3 c = aces(texture2D(tColor, uv).rgb * uExposure);
    return pow(c, vec3(1.0 / 2.2));
  }
  float coc(float z) { return min(uMaxR, uAperture * abs(z - uFocus) / z); }
  // contact shadows: wherever something stands close in front of a point (a piece crossing
  // over another, a yarn end lying across the next strand, the gap between the broken ends),
  // the room's light can't reach in so well; looked for in a ring around it, at the scale of
  // what is there (a few of its strands' widths), however far the zoom has gone
  uniform float uPix1;
  float zAt(vec2 uv) { float d = texture2D(tDepth, uv).x; return d >= 1.0 ? 1e4 : linZ(d); }
  float occlusion(float z0) {
    if (z0 > 1e3) return 1.0;
    float occ = 0.0;
    const int M = 16;
    float rPx = 0.03 * uRes.y;
    // what that ring spans at this depth, in the scene's units
    float wr = rPx * uPix1 * z0;
    float spin = t_hash(vUv * uRes) * 6.2832;
    for (int i = 0; i < M; i++) {
      float f = (float(i) + 0.5) / float(M);
      float a = float(i) * 2.39996 + spin;
      vec2 o = vec2(cos(a), sin(a)) * rPx * sqrt(f) / uRes;
      float dz = z0 - zAt(vUv + o);
      float rr = wr * sqrt(f);
      // in front by up to about the ring's span: shadowing, less the further off
      occ += smoothstep(0.02 * rr, 0.35 * rr, dz) * (1.0 - smoothstep(1.0 * wr, 2.5 * wr, dz));
    }
    return 1.0 - occ / float(M);
  }
  void main() {
    float z0;
    vec3 c0 = shade(vUv, z0);
    float k0 = coc(z0);
    vec3 acc = c0;
    float ws = 1.0;
    const int N = 40;
    for (int i = 0; i < N; i++) {
      float r = uMaxR * sqrt((float(i) + 0.5) / float(N));
      float a = float(i) * 2.39996;
      vec2 uv = vUv + vec2(cos(a), sin(a)) * r / uRes;
      float z;
      vec3 c = shade(uv, z);
      float k = coc(z);
      // what is behind can't spread over what is nearer and sharper
      float ke = z > z0 ? min(k, k0) : k;
      float w = smoothstep(r - 1.0, r + 1.0, ke);
      acc += c * w;
      ws += w;
    }
    vec3 c = acc / ws;
    // (on what is sharp; out of focus the shadows are lost in the blur)
    float ao = occlusion(z0);
    c *= mix(1.0, 0.45 + 0.55 * ao, 0.85 * (1.0 - smoothstep(0.2, 1.0, k0 / uMaxR)));
    // the window's light spilling in from above the frame: the top washes out toward white
    float spill = smoothstep(0.78, 1.0, vUv.y);
    c = mix(c, vec3(0.97, 0.958, 0.94), spill * spill * 0.4);
    // a muted, quiet grade: colour held back, the lights a little warm, the shadows a cool
    // brownish grey, never black
    float l = dot(c, vec3(0.299, 0.587, 0.114));
    c = mix(vec3(l), c, 0.88);
    vec3 cool = vec3(0.965, 0.985, 1.035), warm = vec3(1.015, 1.0, 0.975);
    c *= mix(cool, warm, smoothstep(0.25, 0.8, l));
    c = mix(vec3(0.075, 0.07, 0.075), vec3(1.0), c);
    vec2 p = vUv - 0.5;
    c *= 1.0 - 0.1 * dot(p, p);
    // fine film grain, strongest in the mid-tones
    // (its specks a shown pixel each)
    vec2 gp = floor(vUv * uRes / uSS) + 0.5 + fract(uTime * 7.31) * 113.0;
    float gr = (t_hash(gp) + t_hash(gp + 37.0) - 1.0);
    c += gr * (0.028 + 0.03 * l * (1.0 - l));
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createLens(renderer) {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  rt.depthTexture.type = THREE.FloatType;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: rt.texture },
      tDepth: { value: rt.depthTexture },
      uRes: { value: new THREE.Vector2() },
      uNear: { value: 0.3 },
      uFar: { value: 600 },
      uFocus: { value: 12 },
      uAperture: { value: 40 },
      uMaxR: { value: 20 },
      uTime: { value: 0 },
      uSS: footprint,
      uExposure: { value: 0.8 },
      uPix1: { value: 0.001 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: LENS_FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  const qScene = new THREE.Scene();
  qScene.add(quad);
  const qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  return {
    uniforms: mat.uniforms,
    setSize(w, h, pr) {
      rt.setSize(Math.round(w * pr), Math.round(h * pr));
      mat.uniforms.uRes.value.set(Math.round(w * pr), Math.round(h * pr));
      // the blur scales with the picture
      mat.uniforms.uAperture.value = 0.045 * h * pr;
      mat.uniforms.uMaxR.value = Math.min(28 * footprint.value, 0.022 * h * pr);
    },
    render(scene, camera, time) {
      mat.uniforms.uNear.value = camera.near;
      mat.uniforms.uFar.value = camera.far;
      mat.uniforms.uPix1.value = (2 * Math.tan((camera.fov * Math.PI) / 360)) / mat.uniforms.uRes.value.y;
      mat.uniforms.uTime.value = time;
      renderer.setRenderTarget(rt);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(qScene, qCam);
    },
  };
}
